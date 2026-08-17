import crypto from "node:crypto";

/**
 * Drives the Phase 9 worker engine for a single organization until nothing
 * claimable remains (bounded loop for safety). Because integration test files
 * run concurrently against the same database, every cycle is scoped to
 * `organizationId` so one test can never drain another test's events.
 * Retried events land back on PENDING with a future availableAt and are
 * intentionally not re-claimed here.
 */
export async function drainOutboxForOrg(organizationId: string, maxCycles = 25): Promise<number> {
  const { runOutboxCycle } = await import("../../../src/server/queue/worker-engine");
  let claimedTotal = 0;
  for (let i = 0; i < maxCycles; i += 1) {
    const result = await runOutboxCycle({
      organizationId,
      workerId: `test-worker-${crypto.randomUUID()}`,
      leaseSeconds: 1,
    });
    claimedTotal += result.claimed;
    if (result.claimed === 0) break;
  }
  return claimedTotal;
}