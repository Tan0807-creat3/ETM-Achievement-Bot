import {
  Client,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, etmActionLogsTable, insertEtmActionLogSchema } from "@workspace/db";
import { logger } from "./logger";

type ActionKind = "hunt" | "battle_win" | "checkin" | "collect";
type ActionTotals = Record<ActionKind, number>;

const actionLabels: Record<ActionKind, string> = {
  hunt: "Lượt săn",
  battle_win: "Trận thắng",
  checkin: "Điểm danh",
  collect: "Sưu tầm",
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
    description: "Ghi lại lượt săn đầu tiên của bạn.",
    action: "hunt",
    target: 1,
  },
  {
    id: "steady-hunter",
    title: "Thợ săn bền bỉ",
    description: "Tự ghi nhận 10 lượt săn.",
    action: "hunt",
    target: 10,
  },
  {
    id: "first-victory",
    title: "Chiến thắng đầu tay",
    description: "Ghi lại trận thắng đầu tiên.",
    action: "battle_win",
    target: 1,
  },
  {
    id: "battle-hardened",
    title: "Vững tay chiến đấu",
    description: "Tự ghi nhận 5 trận thắng.",
    action: "battle_win",
    target: 5,
  },
  {
    id: "daily-regular",
    title: "Hẹn gặp mỗi ngày",
    description: "Ghi nhận điểm danh 7 lần.",
    action: "checkin",
    target: 7,
  },
  {
    id: "collector",
    title: "Người gom chuyện hay",
    description: "Tự ghi nhận 5 món sưu tầm.",
    action: "collect",
    target: 5,
  },
];

const etmCommand = new SlashCommandBuilder()
  .setName("etm")
  .setDescription("Theo dõi thành tựu OWO bằng ghi nhận thủ công.")
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
            { name: "Trận thắng", value: "battle_win" },
            { name: "Điểm danh", value: "checkin" },
            { name: "Sưu tầm", value: "collect" },
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
    .setFooter({ text: "Tiến độ dựa trên hành động bạn tự ghi nhận; ETM không xác minh với OWO." });
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
    .setFooter({ text: "Thành tựu mở khi bạn tự ghi nhận đủ hành động." });
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
        .setFooter({ text: "Xếp hạng theo tổng lượt người dùng tự ghi nhận." }),
    ],
    allowedMentions: { parse: [] },
  });
};

export async function startEtmBot(): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    throw new Error("DISCORD_BOT_TOKEN is required to start the ETM Discord bot.");
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const rest = new REST({ version: "10" }).setToken(token);
  const ready = new Promise<void>((resolve, reject) => {
    client.once(Events.ClientReady, async (readyClient) => {
      try {
        const applicationId = readyClient.user.id;
        await rest.put(Routes.applicationCommands(applicationId), {
          body: [etmCommand.toJSON()],
        });

        const inviteParams = new URLSearchParams({
          client_id: applicationId,
          permissions: "2048",
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
    if (!interaction.isChatInputCommand() || interaction.commandName !== "etm") {
      return;
    }

    const isLeaderboard = interaction.options.getSubcommand() === "top";
    try {
      await interaction.deferReply(
        isLeaderboard ? {} : { flags: MessageFlags.Ephemeral },
      );

      if (!interaction.guildId) {
        await interaction.editReply("ETM chỉ hoạt động trong server Discord.");
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

  try {
    await client.login(token);
    await ready;
  } catch (err) {
    client.destroy();
    throw err;
  }
}
