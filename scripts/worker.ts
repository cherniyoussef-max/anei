import "dotenv/config";
import { runOutboxCycle, OUTBOX_BATCH_SIZE } from "../src/server/queue/worker-engine";
import { pool } from "../src/server/db";
import { env } from "../src/server/env";

/**
 * Phase 9 outbox worker — a separate process from the Next.js web server.
 * Polls the outbox with SELECT ... FOR UPDATE SKIP LOCKED (see
 * src/server/queue/worker-engine.ts), so multiple worker processes may run
 * concurrently without double-claiming. Graceful shutdown on SIGTERM/SIGINT:
 * the current batch finishes (its external calls are in-flight and owned by
 * this process), then the DB pool is drained. No provider calls, message
 * payloads, or error details are ever logged — only sanitized counts.
 *
 * Run: npm run worker:outbox
 */

const POLL_INTERVAL_MS = 2000;

function parseBoundedInt(name: string, fallback: number, min: number, max: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(Math.max(Math.trunc(raw), min), max);
}

async function main() {
  const batchSize = parseBoundedInt("OUTBOX_BATCH_SIZE", OUTBOX_BATCH_SIZE, 1, 50);
  const pollInterval = parseBoundedInt("OUTBOX_POLL_INTERVAL_MS", POLL_INTERVAL_MS, 100, 60_000);

  let shuttingDown = false;
  let inFlight = false;

  const onSignal = () => {
    shuttingDown = true;
  };
  process.on("SIGTERM", onSignal);
  process.on("SIGINT", onSignal);

  console.log(`[outbox-worker] started (batch=${batchSize}, poll=${pollInterval}ms, env=${env.NODE_ENV})`);

  while (!shuttingDown) {
    if (inFlight) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      continue;
    }
    inFlight = true;
    try {
      const result = await runOutboxCycle({ batchSize });
      if (result.claimed > 0) {
        console.log(`[outbox-worker] cycle claimed=${result.claimed} succeeded=${result.succeeded} retried=${result.retried} terminal=${result.terminal}`);
      }
    } catch (error) {
      // The cycle is built to swallow per-event failures; anything reaching
      // here is infrastructure-level (DB unavailable, etc.). Log only the
      // error class, never payloads or connection strings.
      const name = error instanceof Error ? error.name : "UNKNOWN";
      console.error(`[outbox-worker] cycle failed: ${name}`);
    } finally {
      inFlight = false;
    }
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  while (inFlight) await new Promise((resolve) => setTimeout(resolve, 100));
  await pool.end();
  console.log("[outbox-worker] stopped cleanly");
}

main().catch(async (error) => {
  const name = error instanceof Error ? error.name : "UNKNOWN";
  console.error(`[outbox-worker] fatal: ${name}`);
  await pool.end().catch(() => undefined);
  process.exitCode = 1;
});