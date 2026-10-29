import { Router } from "express";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db, etmActionLogsTable } from "@workspace/db";
import { etmAchievements, type EtmActionKind } from "../lib/etm-achievements";
import { getEtmSessionUser, requireEtmSession } from "./discord-auth";

const router = Router();

router.get("/etm/progress", requireEtmSession, async (request, response, next) => {
  try {
    const user = getEtmSessionUser(request);
    if (!user) {
      response.status(401).json({ error: "Discord login required." });
      return;
    }

    const [totalRows, guildRows, recentActions] = await Promise.all([
      db
        .select({
          action: etmActionLogsTable.action,
          total: sql<number>`coalesce(sum(${etmActionLogsTable.amount}), 0)::int`,
        })
        .from(etmActionLogsTable)
        .where(
          and(
            eq(etmActionLogsTable.userId, user.id),
            isNotNull(etmActionLogsTable.sourceMessageId),
          ),
        )
        .groupBy(etmActionLogsTable.action),
      db
        .select({
          count: sql<number>`count(distinct ${etmActionLogsTable.guildId})::int`,
        })
        .from(etmActionLogsTable)
        .where(
          and(
            eq(etmActionLogsTable.userId, user.id),
            isNotNull(etmActionLogsTable.sourceMessageId),
          ),
        ),
      db
        .select({
          id: etmActionLogsTable.id,
          action: etmActionLogsTable.action,
          amount: etmActionLogsTable.amount,
          createdAt: etmActionLogsTable.createdAt,
        })
        .from(etmActionLogsTable)
        .where(
          and(
            eq(etmActionLogsTable.userId, user.id),
            isNotNull(etmActionLogsTable.sourceMessageId),
          ),
        )
        .orderBy(desc(etmActionLogsTable.createdAt))
        .limit(20),
    ]);

    const totals: Record<EtmActionKind, number> = {
      hunt: 0,
      battle_win: 0,
      checkin: 0,
      collect: 0,
    };
    for (const row of totalRows) {
      totals[row.action] = Number(row.total);
    }

    const achievements = etmAchievements.map((achievement) => {
      const current = totals[achievement.action];
      return {
        ...achievement,
        current,
        unlocked: current >= achievement.target,
      };
    });

    response.json({
      totals,
      totalActions: Object.values(totals).reduce((sum, value) => sum + value, 0),
      guildCount: Number(guildRows[0]?.count ?? 0),
      achievements,
      recentActions: recentActions.map((action) => ({
        ...action,
        createdAt: action.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/etm/progress", requireEtmSession, async (request, response, next) => {
  try {
    const user = getEtmSessionUser(request);
    if (!user) {
      response.status(401).json({ error: "Discord login required." });
      return;
    }
    await db
      .delete(etmActionLogsTable)
      .where(eq(etmActionLogsTable.userId, user.id));
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
