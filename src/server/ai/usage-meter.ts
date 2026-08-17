import "server-only";
import { db } from "@/server/db";
import { aiUsageLog } from "@/server/db/schema";
import { eq, and, sql } from "drizzle-orm";
import type { AIUsageMeter } from "./contracts";

const DAILY_TOKEN_LIMIT = 500_000;
const MONTHLY_TOKEN_LIMIT = 5_000_000;

export class DrizzleAIUsageMeter implements AIUsageMeter {
  async assertWithinQuota(input: { userId: string; estimatedInputTokens: number }): Promise<void> {
    const { userId, estimatedInputTokens } = input;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [dailyUsage] = await db
      .select({ total: sql<number>`coalesce(sum(${aiUsageLog.inputTokens} + ${aiUsageLog.outputTokens}), 0)` })
      .from(aiUsageLog)
      .where(and(eq(aiUsageLog.userId, userId), sql`${aiUsageLog.createdAt} >= ${today}`));

    const [monthlyUsage] = await db
      .select({ total: sql<number>`coalesce(sum(${aiUsageLog.inputTokens} + ${aiUsageLog.outputTokens}), 0)` })
      .from(aiUsageLog)
      .where(and(eq(aiUsageLog.userId, userId), sql`${aiUsageLog.createdAt} >= ${monthStart}`));

    const dailyTotal = Number(dailyUsage?.total ?? 0);
    const monthlyTotal = Number(monthlyUsage?.total ?? 0);

    if (dailyTotal + estimatedInputTokens > DAILY_TOKEN_LIMIT) {
      throw new Error(`Daily token quota exceeded (${dailyTotal}/${DAILY_TOKEN_LIMIT})`);
    }

    if (monthlyTotal + estimatedInputTokens > MONTHLY_TOKEN_LIMIT) {
      throw new Error(`Monthly token quota exceeded (${monthlyTotal}/${MONTHLY_TOKEN_LIMIT})`);
    }
  }

  async record(input: {
    userId: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
    success: boolean;
  }): Promise<void> {
    await db.insert(aiUsageLog).values({
      userId: input.userId,
      provider: input.provider,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      durationMs: input.durationMs,
      success: input.success,
    });
  }

  async getUsage(userId: string, since: Date) {
    return db
      .select()
      .from(aiUsageLog)
      .where(and(eq(aiUsageLog.userId, userId), sql`${aiUsageLog.createdAt} >= ${since}`))
      .orderBy(sql`${aiUsageLog.createdAt} desc`);
  }
}

export class TestAIUsageMeter implements AIUsageMeter {
  private quotas: Map<string, { daily: number; monthly: number }> = new Map();
  private logs: Array<{
    userId: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
    success: boolean;
  }> = [];

  setQuota(userId: string, daily: number, monthly: number): void {
    this.quotas.set(userId, { daily, monthly });
  }

  async assertWithinQuota(input: { userId: string; estimatedInputTokens: number }): Promise<void> {
    const quota = this.quotas.get(input.userId);
    if (quota && quota.daily + input.estimatedInputTokens > 500_000) {
      throw new Error("Daily token quota exceeded");
    }
    if (quota && quota.monthly + input.estimatedInputTokens > 5_000_000) {
      throw new Error("Monthly token quota exceeded");
    }
  }

  async record(input: {
    userId: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
    success: boolean;
  }): Promise<void> {
    this.logs.push(input);
    const quota = this.quotas.get(input.userId) ?? { daily: 0, monthly: 0 };
    quota.daily += input.inputTokens + input.outputTokens;
    quota.monthly += input.inputTokens + input.outputTokens;
    this.quotas.set(input.userId, quota);
  }
}

let usageMeterInstance: AIUsageMeter | null = null;

export function getAIUsageMeter(): AIUsageMeter {
  if (!usageMeterInstance) {
    usageMeterInstance = new DrizzleAIUsageMeter();
  }
  return usageMeterInstance;
}

export function setAIUsageMeter(meter: AIUsageMeter): void {
  usageMeterInstance = meter;
}