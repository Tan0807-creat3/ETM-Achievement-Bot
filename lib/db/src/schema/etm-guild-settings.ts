import { createInsertSchema } from "drizzle-zod";
import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const etmGuildSettingsTable = pgTable("etm_guild_settings", {
  guildId: text("guild_id").primaryKey(),
  channelId: text("channel_id"),
  monitorAll: boolean("monitor_all").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertEtmGuildSettingsSchema = createInsertSchema(
  etmGuildSettingsTable,
).omit({ updatedAt: true });

export type InsertEtmGuildSettings = z.infer<
  typeof insertEtmGuildSettingsSchema
>;
export type EtmGuildSettings = typeof etmGuildSettingsTable.$inferSelect;
