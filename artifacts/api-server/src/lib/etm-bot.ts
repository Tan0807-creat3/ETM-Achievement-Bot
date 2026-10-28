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
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  etmActionLogsTable,
  etmGuildSettingsTable,
  insertEtmActionLogSchema,
} from "@workspace/db";
import { logger } from "./logger";

type ActionKind = "hunt" | "battle_win" | "checkin" | "collect";
type ActionTotals = Record<ActionKind, number>;

const actionLabels: Record<ActionKind, string> = {
  hunt: "Lượt săn",
  battle_win: "Lượt battle",
  checkin: "Lượt daily",
  collect: "Lượt xem zoo",
};

const achievements: Array<{
  id: string;
  title: string;
  description: string;
  action: ActionKind;
  target: number;
}> = [
  {
    id: "first-hunt",
    title: "Bước chân đầu tiên",
    description: "Dùng lệnh hunt lần đầu.",
    action: "hunt",
    target: 1,
  },
  {
    id: "steady-hunter",
    title: "Thợ săn bền bỉ",
    description: "Dùng lệnh hunt 10 lần.",
    action: "hunt",
    target: 10,
  },
  {
    id: "first-victory",
    title: "Trận chiến đầu tay",
    description: "Dùng lệnh battle lần đầu.",
    action: "battle_win",
    target: 1,
  },
  {
    id: "battle-hardened",
    title: "Người mê so tài",
    description: "Dùng lệnh battle 5 lần.",
    action: "battle_win",
    target: 5,
  },
  {
    id: "daily-regular",
    title: "Hẹn gặp mỗi ngày",
    description: "Dùng lệnh daily 7 lần.",
    action: "checkin",
    target: 7,
  },
  {
    id: "collector",
    title: "Người khám phá sở thú",
    description: "Dùng lệnh zoo 5 lần.",
    action: "collect",
    target: 5,
  },
];

const etmCommand = new SlashCommandBuilder()
  .setName("etm")
  .setDescription("Theo dõi thành tựu từ các lệnh OWO đã nhận diện.")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("ghi")
      .setDescription("Ghi lại hành động bạn vừa hoàn thành.")
      .addStringOption((option) =>
        option
          .setName("hanh-dong")
          .setDescription("Chọn loại hành động.")
          .setRequired(true)
          .addChoices(
            { name: "Lượt săn", value: "hunt" },
            { name: "Lượt battle", value: "battle_win" },
            { name: "Lượt daily", value: "checkin" },
            { name: "Lượt xem zoo", value: "collect" },
          ),
      )
      .addIntegerOption((option) =>
        option
          .setName("so-luong")
          .setDescription("Số lượt muốn ghi nhận (tối đa 20).")
          .setMinValue(1)
          .setMaxValue(20),
      ),
  )
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
  battle: "battle_win",
  b: "battle_win",
  fight: "battle_win",
  daily: "checkin",
  zoo: "collect",
};

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

const parseOwoAction = (
  content: string,
): ActionKind | null => {
  const match = content.trimStart().match(/^(?:owo|ow)\s+([a-z][a-z0-9_-]*)\b/i);
  if (!match) {
    return null;
  }
  return commandActions[match[1].toLowerCase()] ?? null;
};

const getAutomaticAction = (
  message: Message,
): { userId: string; action: ActionKind } | null => {
  if (message.author.id === OFFICIAL_OWO_BOT_ID) {
    const commandName = message.interaction?.commandName.toLowerCase();
    const action = commandName ? commandActions[commandName] : undefined;
    const userId = message.interaction?.user.id;
    return action && userId ? { userId, action } : null;
  }

  if (message.author.bot) {
    return null;
  }

  const action = parseOwoAction(message.content);
  return action ? { userId: message.author.id, action } : null;
};

const recordAutomaticAction = async (
  guildId: string,
  userId: string,
  action: ActionKind,
): Promise<void> => {
  const entry = insertEtmActionLogSchema.parse({
    guildId,
    userId,
    action,
    amount: 1,
    sourceMessageId: null,
  });

  await db.insert(etmActionLogsTable).values(entry);

  logger.info({ guildId, userId, action }, "Recorded an OwO action");
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
  achievements.filter((achievement) => totals[achievement.action] >= achievement.target);

const formatActionTotals = (totals: ActionTotals): string =>
  (Object.keys(actionLabels) as ActionKind[])
    .map((action) => `${actionLabels[action]}: **${totals[action]}**`)
    .join("\n");

const progressEmbed = (totals: ActionTotals): EmbedBuilder => {
  const totalActions = Object.values(totals).reduce((sum, value) => sum + value, 0);
  const unlockedCount = getUnlockedAchievements(totals).length;

  return new EmbedBuilder()
    .setColor(0x26735f)
    .setTitle("Tiến độ của bạn")
    .setDescription(
      `Tổng lượt ghi nhận: **${totalActions}**\nThành tựu đã mở: **${unlockedCount}/${achievements.length}**`,
    )
    .addFields({ name: "Hoạt động", value: formatActionTotals(totals) })
    .setFooter({
      text: "ETM đếm lệnh đã nhận diện, không xác minh kết quả từ OWO.",
    });
};

const achievementsEmbed = (totals: ActionTotals): EmbedBuilder => {
  const lines = achievements.map((achievement) => {
    const current = totals[achievement.action];
    const status =
      current >= achievement.target ? "ĐÃ MỞ KHÓA" : "ĐANG THEO DÕI";

    return `**${achievement.title}** — ${status} (${Math.min(current, achievement.target)}/${achievement.target})\n${achievement.description}`;
  });

  return new EmbedBuilder()
    .setColor(0xe39c62)
    .setTitle("Bộ sưu tập thành tựu ETM")
    .setDescription(lines.join("\n\n"))
    .setFooter({
      text: "Thành tựu dựa trên lệnh OWO ETM nhận diện được.",
    });
};

const handleRecord = async (
  interaction: ChatInputCommandInteraction,
  guildId: string,
): Promise<void> => {
  const actionValue = interaction.options.getString("hanh-dong", true);
  const amount = interaction.options.getInteger("so-luong") ?? 1;

  if (!(actionValue in actionLabels) || amount < 1 || amount > 20) {
    await interaction.editReply("Thông tin ghi nhận không hợp lệ.");
    return;
  }

  const action = actionValue as ActionKind;
  const before = await getActionTotals(guildId, interaction.user.id);
  const entry = insertEtmActionLogSchema.parse({
    guildId,
    userId: interaction.user.id,
    action,
    amount,
  });

  await db.insert(etmActionLogsTable).values(entry);

  const after = await getActionTotals(guildId, interaction.user.id);
  const newlyUnlocked = achievements.filter(
    (achievement) =>
      before[achievement.action] < achievement.target &&
      after[achievement.action] >= achievement.target,
  );
  const unlockText = newlyUnlocked.length
    ? newlyUnlocked.map((achievement) => `**${achievement.title}**`).join("\n")
    : "Chưa mở khóa thành tựu mới lần này.";

  const embed = new EmbedBuilder()
    .setColor(0x26735f)
    .setTitle("Đã ghi nhận")
    .setDescription(
      `Đã thêm **${amount}** ${actionLabels[action].toLocaleLowerCase("vi-VN")}.`,
    )
    .addFields(
      { name: "Tiến độ hiện tại", value: formatActionTotals(after) },
      { name: "Thành tựu mới", value: unlockText },
    )
    .setFooter({ text: "Ghi nhận thủ công • ETM không tự chạy hoặc xác minh lệnh OWO." });

  await interaction.editReply({ embeds: [embed] });
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
    .where(eq(etmActionLogsTable.guildId, guildId))
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
    : "Chưa có lượt nào được ghi nhận. Dùng `/etm ghi` để bắt đầu.";

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x26735f)
        .setTitle("Bảng xếp hạng server")
        .setDescription(description)
        .setFooter({ text: "Xếp hạng theo các lệnh OWO ETM nhận diện được." }),
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
      `Đã chọn ${channel} làm kênh theo dõi. ETM sẽ chỉ xử lý lệnh OWO nhận diện được trong kênh này.${autoTrackingEnabled ? "" : "\nTự ghi nhận đang chờ bật Message Content Intent trong Developer Portal."}`,
    );
    return;
  }

  if (subcommand === "all") {
    await saveGuildMonitorSettings(guildId, null, true);
    await interaction.editReply(
      `Đã bật theo dõi lệnh OWO trong mọi kênh ETM có quyền xem.${autoTrackingEnabled ? "" : "\nTự ghi nhận đang chờ bật Message Content Intent trong Developer Portal."}`,
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
      if (subcommand === "ghi") {
        await handleRecord(interaction, interaction.guildId);
        return;
      }

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
      const settings = await getGuildMonitorSettings(message.guildId);
      if (
        !settings ||
        (!settings.monitorAll && settings.channelId !== message.channelId)
      ) {
        return;
      }

      const detected = getAutomaticAction(message);
      if (!detected) {
        return;
      }

      await recordAutomaticAction(
        message.guildId,
        detected.userId,
        detected.action,
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
