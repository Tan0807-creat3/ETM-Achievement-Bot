import {
  ChannelType,
  Client,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  type Message,
} from "discord.js";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import {
  db,
  etmActionLogsTable,
  etmGuildSettingsTable,
  insertEtmActionLogSchema,
} from "@workspace/db";
import { logger } from "./logger";
import {
  etmAchievements,
  etmActionLabels,
  type EtmActionKind,
} from "./etm-achievements";

type ActionKind = EtmActionKind;
type ActionTotals = Record<ActionKind, number>;

const etmCommand = new SlashCommandBuilder()
  .setName("etm")
  .setDescription("Theo dõi thành tựu từ kết quả OWO ETM xác nhận.")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("tiendo")
      .setDescription("Xem tiến độ thành tựu của bạn trong server."),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("thanhtuu")
      .setDescription("Xem danh sách thành tựu ETM tạo."),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("top")
      .setDescription("Xem bảng xếp hạng ghi nhận của server."),
  );

const setCommand = new SlashCommandBuilder()
  .setName("set")
  .setDescription("Chọn phạm vi ETM theo dõi lệnh OWO.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("channel")
      .setDescription("Chỉ theo dõi một kênh.")
      .addChannelOption((option) =>
        option
          .setName("kenh")
          .setDescription("Kênh OWO muốn theo dõi.")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("all")
      .setDescription("Theo dõi mọi kênh ETM có quyền xem."),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("off")
      .setDescription("Tắt tự ghi nhận trong server này."),
  );

const OFFICIAL_OWO_BOT_ID = "408785106942164992";
const autoTrackingEnabled = process.env.ETM_AUTO_TRACKING_ENABLED === "true";
const commandActions: Record<string, ActionKind> = {
  hunt: "hunt",
  h: "hunt",
  catch: "hunt",
  battle: "battle_win",
  b: "battle_win",
  fight: "battle_win",
  daily: "checkin",
  zoo: "collect",
};
const pendingPrefixActions = new Map<
  string,
  {
    guildId: string;
    channelId: string;
    userId: string;
    action: ActionKind;
    createdAt: number;
  }
>();
const pendingActionTtlMs = 20_000;

type GuildMonitorSettings = typeof etmGuildSettingsTable.$inferSelect;

const settingsCache = new Map<
  string,
  { settings: GuildMonitorSettings | null; expiresAt: number }
>();

const getGuildMonitorSettings = async (
  guildId: string,
): Promise<GuildMonitorSettings | null> => {
  const cached = settingsCache.get(guildId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.settings;
  }

  const [settings] = await db
    .select()
    .from(etmGuildSettingsTable)
    .where(eq(etmGuildSettingsTable.guildId, guildId))
    .limit(1);

  const value = settings ?? null;
  settingsCache.set(guildId, {
    settings: value,
    expiresAt: Date.now() + 30_000,
  });
  return value;
};

const saveGuildMonitorSettings = async (
  guildId: string,
  channelId: string | null,
  monitorAll: boolean,
): Promise<void> => {
  const [settings] = await db
    .insert(etmGuildSettingsTable)
    .values({ guildId, channelId, monitorAll })
    .onConflictDoUpdate({
      target: etmGuildSettingsTable.guildId,
      set: { channelId, monitorAll, updatedAt: new Date() },
    })
    .returning();

  if (settings) {
    settingsCache.set(guildId, {
      settings,
      expiresAt: Date.now() + 30_000,
    });
  }
};

const parseOwoAction = (content: string): ActionKind | null => {
  const match = content.trimStart().match(/^(?:owo|ow)\s+([a-z][a-z0-9_-]*)\b/i);
  if (!match) {
    return null;
  }
  return commandActions[match[1].toLowerCase()] ?? null;
};

const getMessageText = (message: Message): string =>
  [
    message.content,
    ...message.embeds.flatMap((embed) => [
      embed.title,
      embed.description,
      ...embed.fields.flatMap((field) => [field.name, field.value]),
    ]),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

const responseConfirmsSuccess = (
  message: Message,
  action: ActionKind,
  userId: string,
): boolean => {
  const text = getMessageText(message);
  if (!text) {
    return false;
  }

  const failureSignal =
    /\b(cooldown|not enough|insufficient|cannot|can't|unable|failed|failure|error|invalid|already claimed|try again|wait \d+|not ready|command usage|usage|syntax|help)\b/i;
  if (failureSignal.test(text)) {
    return false;
  }

  switch (action) {
    case "hunt":
      return /\b(you found|found \d+|caught|captured|animal found|animals found)\b/i.test(
        text,
      );
    case "checkin":
      return (
        /\bdaily\b/i.test(text) &&
        /\b(cowoncy|reward|lootbox|weapon crate|claimed)\b/i.test(text)
      );
    case "battle_win": {
      const victory = /\b(you won|victory|winner|won the battle)\b/i.test(text);
      if (!victory) {
        return false;
      }
      const mentionedUsers = message.mentions.users;
      return mentionedUsers.size === 0
        ? /\b(you won|your victory)\b/i.test(text)
        : mentionedUsers.has(userId);
    }
    case "collect":
      return /\bzoo\b/i.test(text) && /\b(animal|animals|total|zoo)\b/i.test(text);
  }
};

const recordAutomaticAction = async (
  guildId: string,
  userId: string,
  action: ActionKind,
  sourceMessageId: string,
): Promise<void> => {
  const entry = insertEtmActionLogSchema.parse({
    guildId,
    userId,
    action,
    amount: 1,
    sourceMessageId,
  });

  const inserted = await db
    .insert(etmActionLogsTable)
    .values(entry)
    .onConflictDoNothing({ target: etmActionLogsTable.sourceMessageId })
    .returning({ id: etmActionLogsTable.id });

  if (inserted.length > 0) {
    logger.info({ guildId, userId, action }, "Recorded a confirmed OwO result");
  }
};

const getActionTotals = async (
  guildId: string,
  userId: string,
): Promise<ActionTotals> => {
  const rows = await db
    .select({
      action: etmActionLogsTable.action,
      total: sql<number>`coalesce(sum(${etmActionLogsTable.amount}), 0)::int`,
    })
    .from(etmActionLogsTable)
    .where(
      and(
        eq(etmActionLogsTable.guildId, guildId),
        eq(etmActionLogsTable.userId, userId),
        isNotNull(etmActionLogsTable.sourceMessageId),
      ),
    )
    .groupBy(etmActionLogsTable.action);

  const totals: ActionTotals = {
    hunt: 0,
    battle_win: 0,
    checkin: 0,
    collect: 0,
  };

  for (const row of rows) {
    totals[row.action] = Number(row.total);
  }

  return totals;
};

const getUnlockedAchievements = (totals: ActionTotals) =>
  etmAchievements.filter(
    (achievement) => totals[achievement.action] >= achievement.target,
  );

const formatActionTotals = (totals: ActionTotals): string =>
  (Object.keys(etmActionLabels) as ActionKind[])
    .map((action) => `${etmActionLabels[action]}: **${totals[action]}**`)
    .join("\n");

const progressEmbed = (totals: ActionTotals): EmbedBuilder => {
  const totalActions = Object.values(totals).reduce((sum, value) => sum + value, 0);
  const unlockedCount = getUnlockedAchievements(totals).length;

  return new EmbedBuilder()
    .setColor(0x26735f)
    .setTitle("Tiến độ của bạn")
    .setDescription(
      `Tổng kết quả được xác nhận: **${totalActions}**\nThành tựu đã mở: **${unlockedCount}/${etmAchievements.length}**`,
    )
    .addFields({ name: "Hoạt động", value: formatActionTotals(totals) })
    .setFooter({
      text: "Chỉ tính phản hồi OwO được nhận diện là kết quả thành công.",
    });
};

const achievementsEmbed = (totals: ActionTotals): EmbedBuilder => {
  const lines = etmAchievements.map((achievement) => {
    const current = totals[achievement.action];
    const status = current >= achievement.target ? "✓" : "·";
    return `${status} **${achievement.title}** ${Math.min(current, achievement.target)}/${achievement.target}`;
  });

  return new EmbedBuilder()
    .setColor(0xe39c62)
    .setTitle("Bộ sưu tập thành tựu ETM")
    .setDescription(
      `**${etmAchievements.length} thành tựu** · ✓ đã mở · · đang theo đuổi\n\n${lines.join("\n")}`,
    )
    .setFooter({
      text: "Chỉ tính phản hồi thành công được nhận diện. Dashboard có mô tả chi tiết.",
    });
};

const handleLeaderboard = async (
  interaction: ChatInputCommandInteraction,
  guildId: string,
): Promise<void> => {
  const rows = await db
    .select({
      userId: etmActionLogsTable.userId,
      total: sql<number>`coalesce(sum(${etmActionLogsTable.amount}), 0)::int`,
    })
    .from(etmActionLogsTable)
    .where(
      and(
        eq(etmActionLogsTable.guildId, guildId),
        isNotNull(etmActionLogsTable.sourceMessageId),
      ),
    )
    .groupBy(etmActionLogsTable.userId)
    .orderBy(desc(sql<number>`sum(${etmActionLogsTable.amount})`))
    .limit(10);

  const description = rows.length
    ? rows
        .map(
          (row, index) =>
            `${index + 1}. <@${row.userId}> — **${Number(row.total)}** lượt`,
        )
        .join("\n")
    : "Chưa có kết quả OwO được ETM xác nhận.";

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x26735f)
        .setTitle("Bảng xếp hạng server")
        .setDescription(description)
        .setFooter({ text: "Xếp hạng theo kết quả OwO thành công đã xác nhận." }),
    ],
    allowedMentions: { parse: [] },
  });
};

const handleSet = async (
  interaction: ChatInputCommandInteraction,
  guildId: string,
): Promise<void> => {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.editReply("Chỉ quản trị viên server mới có thể đổi phạm vi theo dõi.");
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  if (subcommand === "channel") {
    const channel = interaction.options.getChannel("kenh", true);
    if (channel.type !== ChannelType.GuildText) {
      await interaction.editReply("Hãy chọn một kênh văn bản.");
      return;
    }

    await saveGuildMonitorSettings(guildId, channel.id, false);
    await interaction.editReply(
      `Đã chọn ${channel} làm kênh theo dõi. ETM chỉ xử lý lệnh và phản hồi OwO được hỗ trợ trong kênh này.${autoTrackingEnabled ? "" : "\nTự ghi nhận đang chờ bật ETM_AUTO_TRACKING_ENABLED và Message Content Intent trong Developer Portal."}`,
    );
    return;
  }

  if (subcommand === "all") {
    await saveGuildMonitorSettings(guildId, null, true);
    await interaction.editReply(
      `Đã bật theo dõi lệnh và phản hồi OwO được hỗ trợ trong mọi kênh ETM có quyền xem.${autoTrackingEnabled ? "" : "\nTự ghi nhận đang chờ bật ETM_AUTO_TRACKING_ENABLED và Message Content Intent trong Developer Portal."}`,
    );
    return;
  }

  await saveGuildMonitorSettings(guildId, null, false);
  await interaction.editReply("Đã tắt tự ghi nhận trong server này.");
};

export async function startEtmBot(): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    throw new Error("DISCORD_BOT_TOKEN is required to start the ETM Discord bot.");
  }

  const intents = autoTrackingEnabled
    ? [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ]
    : [GatewayIntentBits.Guilds];
  const client = new Client({ intents });
  const rest = new REST({ version: "10" }).setToken(token);
  const ready = new Promise<void>((resolve, reject) => {
    client.once(Events.ClientReady, async (readyClient) => {
      try {
        const applicationId = readyClient.user.id;
        await rest.put(Routes.applicationCommands(applicationId), {
          body: [etmCommand.toJSON(), setCommand.toJSON()],
        });

        const inviteParams = new URLSearchParams({
          client_id: applicationId,
          permissions: "68608",
          scope: "bot applications.commands",
        });
        const inviteUrl = `https://discord.com/oauth2/authorize?${inviteParams.toString()}`;

        logger.info(
          { botTag: readyClient.user.tag, applicationId, inviteUrl },
          "ETM Discord bot is online",
        );
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });

  client.on(Events.Error, (err) => {
    logger.error({ err }, "ETM Discord gateway error");
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (
      !interaction.isChatInputCommand() ||
      (interaction.commandName !== "etm" && interaction.commandName !== "set")
    ) {
      return;
    }

    const isLeaderboard =
      interaction.commandName === "etm" &&
      interaction.options.getSubcommand() === "top";
    try {
      await interaction.deferReply(
        isLeaderboard ? {} : { flags: MessageFlags.Ephemeral },
      );

      if (!interaction.guildId) {
        await interaction.editReply("ETM chỉ hoạt động trong server Discord.");
        return;
      }

      if (interaction.commandName === "set") {
        await handleSet(interaction, interaction.guildId);
        return;
      }

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "tiendo") {
        const totals = await getActionTotals(
          interaction.guildId,
          interaction.user.id,
        );
        await interaction.editReply({ embeds: [progressEmbed(totals)] });
        return;
      }

      if (subcommand === "thanhtuu") {
        const totals = await getActionTotals(
          interaction.guildId,
          interaction.user.id,
        );
        await interaction.editReply({ embeds: [achievementsEmbed(totals)] });
        return;
      }

      if (subcommand === "top") {
        await handleLeaderboard(interaction, interaction.guildId);
      }
    } catch (err) {
      logger.error(
        {
          err,
          guildId: interaction.guildId,
          userId: interaction.user.id,
          subcommand: interaction.options.getSubcommand(),
        },
        "Failed to process ETM command",
      );

      const errorMessage = "ETM chưa xử lý được lệnh này. Hãy thử lại sau.";
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorMessage).catch((replyErr: unknown) => {
          logger.error({ err: replyErr }, "Failed to send ETM error response");
        });
      } else {
        await interaction
          .reply({ content: errorMessage, flags: MessageFlags.Ephemeral })
          .catch((replyErr: unknown) => {
            logger.error({ err: replyErr }, "Failed to send ETM error response");
          });
      }
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    if (!autoTrackingEnabled || !message.guildId) {
      return;
    }

    try {
      const now = Date.now();
      for (const [messageId, pending] of pendingPrefixActions) {
        if (now - pending.createdAt > pendingActionTtlMs) {
          pendingPrefixActions.delete(messageId);
        }
      }

      const settings = await getGuildMonitorSettings(message.guildId);
      if (
        !settings ||
        (!settings.monitorAll && settings.channelId !== message.channelId)
      ) {
        return;
      }

      if (message.author.id !== OFFICIAL_OWO_BOT_ID) {
        if (message.author.bot) {
          return;
        }
        const action = parseOwoAction(message.content);
        if (!action) {
          return;
        }
        pendingPrefixActions.set(message.id, {
          guildId: message.guildId,
          channelId: message.channelId,
          userId: message.author.id,
          action,
          createdAt: now,
        });
        return;
      }

      const commandName = message.interaction?.commandName.toLowerCase();
      let action = commandName ? commandActions[commandName] : undefined;
      let userId = message.interaction?.user.id;
      let pendingMessageId: string | undefined;

      if (!action || !userId) {
        const referencedId = message.reference?.messageId;
        let candidates = [...pendingPrefixActions.entries()].filter(
          ([, pending]) =>
            pending.guildId === message.guildId &&
            pending.channelId === message.channelId &&
            now - pending.createdAt <= pendingActionTtlMs,
        );

        if (referencedId) {
          candidates = candidates.filter(([id]) => id === referencedId);
        } else if (message.mentions.users.size > 0) {
          candidates = candidates.filter(([, pending]) =>
            message.mentions.users.has(pending.userId),
          );
        }

        if (candidates.length === 1) {
          const [matchedMessageId, pending] = candidates[0];
          pendingMessageId = matchedMessageId;
          action ??= pending.action;
          userId ??= pending.userId;
        }
      }

      if (!action || !userId) {
        return;
      }

      const confirmed = responseConfirmsSuccess(message, action, userId);
      if (pendingMessageId) {
        pendingPrefixActions.delete(pendingMessageId);
      }
      if (!confirmed) {
        return;
      }

      await recordAutomaticAction(
        message.guildId,
        userId,
        action,
        message.id,
      );
    } catch (err) {
      logger.error(
        { err, guildId: message.guildId },
        "Failed to automatically track an OWO action",
      );
    }
  });

  try {
    await client.login(token);
    await ready;
  } catch (err) {
    client.destroy();
    throw err;
  }
}
