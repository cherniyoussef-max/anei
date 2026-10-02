import "server-only";
import { env } from "@/server/env";

type LogLevel = "debug" | "info" | "warn" | "error";
type Metadata = Record<string, unknown>;

const rank: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const sensitiveKey =
  /password|secret|token|authorization|cookie|api[-_]?key|refresh|access|otp|bearer|credential|passcode|meeting[-_]?url/i;

function sanitizeString(str: string): string {
  let sanitized = str.replace(
    /([?&]|\b)((?:token|code|verification|secret|key|access_token|refresh_token|auth|passcode)=)([^&\s]+)/gi,
    "$1$2[REDACTED]",
  );
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]");
  if (sanitized.length > 2_000) return `${sanitized.slice(0, 2_000)}…`;
  return sanitized;
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[TRUNCATED]";
  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
      stack: value.stack ? sanitizeString(value.stack) : undefined,
    };
  }
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => sanitize(item, depth + 1));
  if (value && typeof value === "object") {
    const result: Metadata = {};
    for (const [key, entry] of Object.entries(value as Metadata)) {
      result[key] = sensitiveKey.test(key) ? "[REDACTED]" : sanitize(entry, depth + 1);
    }
    return result;
  }
  if (typeof value === "string") return sanitizeString(value);
  return value;
}

function write(level: LogLevel, event: string, metadata: Metadata = {}) {
  if (rank[level] < rank[env.LOG_LEVEL]) return;
  const payload = JSON.stringify({ ts: new Date().toISOString(), level, event, ...sanitize(metadata) as Metadata });
  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.log(payload);
}

export const logger = {
  debug: (event: string, metadata?: Metadata) => write("debug", event, metadata),
  info: (event: string, metadata?: Metadata) => write("info", event, metadata),
  warn: (event: string, metadata?: Metadata) => write("warn", event, metadata),
  error: (event: string, metadata?: Metadata) => write("error", event, metadata),
};

export function sanitizeLogPayload(value: unknown) {
  return sanitize(value);
}
