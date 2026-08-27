import "server-only";
import { logger } from "@/server/security/logger";

export async function publicDataOr<T>(source: string, query: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await query();
  } catch {
    logger.warn("public.content_degraded", { source });
    return fallback;
  }
}
