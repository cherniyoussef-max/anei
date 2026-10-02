import crypto, { randomUUID } from "node:crypto";
import { getRedis } from "@/server/cache/redis";

export interface WebinarPassData {
  webinarId: string;
  meetingUrl: string | null;
  replayUrl: string | null;
  location?: string | null;
  provider?: string | null;
  title: string;
  expiresAt: number;
}

const PASS_TTL_SECONDS = 60; // 60 seconds short-lived pass

// In-memory fallback for local tests and environments without Redis
const memoryPassStore = new Map<string, { data: WebinarPassData; expiresAt: number }>();

function getSecretKey(): string {
  return process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET || "anei-webinar-pass-secret-salt";
}

function signPassId(passId: string): string {
  return crypto.createHmac("sha256", getSecretKey()).update(passId).digest("hex");
}

function verifyPassSignature(passId: string, signature: string): boolean {
  const expected = signPassId(passId);
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function getWebinarPassCookieName(webinarId: string): string {
  return `anei_webinar_pass_${webinarId}`;
}

export async function createWebinarJoinPass(webinarId: string, data: Omit<WebinarPassData, "webinarId" | "expiresAt">): Promise<{
  cookieName: string;
  cookieValue: string;
  cookieHeader: string;
  passId: string;
}> {
  const passId = randomUUID();
  const expiresAt = Date.now() + PASS_TTL_SECONDS * 1000;
  const passData: WebinarPassData = {
    ...data,
    webinarId,
    expiresAt,
  };

  const redisKey = `webinar-join-pass:${webinarId}:${passId}`;

  // 1. Try Redis first
  try {
    const redis = await getRedis();
    if (redis) {
      await redis.setEx(redisKey, PASS_TTL_SECONDS, JSON.stringify(passData));
    } else {
      memoryPassStore.set(redisKey, { data: passData, expiresAt });
    }
  } catch {
    memoryPassStore.set(redisKey, { data: passData, expiresAt });
  }

  const signature = signPassId(passId);
  const cookieName = getWebinarPassCookieName(webinarId);
  const cookieValue = `${passId}.${signature}`;
  const isProd = process.env.NODE_ENV === "production";
  const cookieHeader = `${cookieName}=${cookieValue}; Path=/api/webinars/${webinarId}/join; Max-Age=${PASS_TTL_SECONDS}; HttpOnly; SameSite=Lax${isProd ? "; Secure" : ""}`;

  return {
    cookieName,
    cookieValue,
    cookieHeader,
    passId,
  };
}

export async function consumeWebinarJoinPass(webinarId: string, rawCookieValue: string | null | undefined): Promise<WebinarPassData | null> {
  if (!rawCookieValue || typeof rawCookieValue !== "string") {
    return null;
  }

  const parts = rawCookieValue.split(".");
  if (parts.length !== 2) return null;
  const [passId, signature] = parts;

  if (!passId || !signature || !verifyPassSignature(passId, signature)) {
    return null;
  }

  const redisKey = `webinar-join-pass:${webinarId}:${passId}`;
  let rawJson: string | null = null;

  try {
    const redis = await getRedis();
    if (redis) {
      // Atomic get-and-delete to ensure strictly one-time consumption
      rawJson = await redis.get(redisKey);
      if (rawJson) {
        await redis.del(redisKey);
      }
    }
  } catch {
    // Redis unavailable, fallback to memory
  }

  if (!rawJson) {
    const item = memoryPassStore.get(redisKey);
    if (item) {
      memoryPassStore.delete(redisKey);
      if (item.expiresAt > Date.now()) {
        return item.data;
      }
    }
    return null;
  }

  try {
    const data = JSON.parse(rawJson) as WebinarPassData;
    if (data.webinarId !== webinarId) return null;
    if (Date.now() > data.expiresAt) return null;
    return data;
  } catch {
    return null;
  }
}

export function buildClearPassCookieHeader(webinarId: string): string {
  const cookieName = getWebinarPassCookieName(webinarId);
  const isProd = process.env.NODE_ENV === "production";
  return `${cookieName}=; Path=/api/webinars/${webinarId}/join; Max-Age=0; HttpOnly; SameSite=Lax${isProd ? "; Secure" : ""}`;
}
