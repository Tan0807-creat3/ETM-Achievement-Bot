import { createInsertSchema } from "drizzle-zod";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const etmActionKind = pgEnum("etm_action_kind", [
  "hunt",
  "battle_win",
  "checkin",
  "collect",
]);

export const etmActionLogsTable = pgTable(
  "etm_action_logs",
  {
    id: serial("id").primaryKey(),
    guildId: text("guild_id").notNull(),
    userId: text("user_id").notNull(),
    action: etmActionKind("action").notNull(),
    amount: integer("amount").notNull(),
    sourceMessageId: text("source_message_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("etm_action_logs_guild_user_idx").on(table.guildId, table.userId),
    index("etm_action_logs_guild_idx").on(table.guildId),
    uniqueIndex("etm_action_logs_source_message_idx").on(table.sourceMessageId),
  ],
);

export const insertEtmActionLogSchema = createInsertSchema(
  etmActionLogsTable,
).omit({ id: true, createdAt: true });

export type InsertEtmActionLog = z.infer<typeof insertEtmActionLogSchema>;
export type EtmActionLog = typeof etmActionLogsTable.$inferSelect;
