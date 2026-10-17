import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

interface RouteAudit {
  file: string;
  methods: string[];
  mutatingMethods: string[];
  hasOriginCheck: boolean;
  hasAuthCheck: boolean;
  hasRateLimit: boolean;
  isWebhookOrInternal: boolean;
  isPublicAllowlist: boolean;
  issues: string[];
}

const WEBHOOK_OR_INTERNAL_ROUTES = [
  "src/app/api/webhooks/",
  "src/app/api/payments/flouci/webhook",
  "src/app/api/internal/automation/",
  "src/app/api/auth/[...all]",
  "src/app/api/mcp",
];

const INTENTIONAL_PUBLIC_MUTATING_ROUTES = [
  "src/app/api/contact/route.ts",
  "src/app/api/newsletter/route.ts",
  "src/app/api/auth/password/forgot/route.ts",
  "src/app/api/auth/password/reset/route.ts",
  "src/app/api/auth/password/verify-otp/route.ts",
  "src/app/api/auth/verification/resend/route.ts",
  "src/app/api/invitation/claim/route.ts",
  "src/app/api/invitation/otp/request/route.ts",
  "src/app/api/invitation/otp/verify/route.ts",
  "src/app/api/webinars/register/route.ts",
  "src/app/api/payments/mock/complete/route.ts",
  "src/app/api/avs/bookings/route.ts",
  "src/app/api/assistant/public/route.ts",
  "src/app/api/auth/register-wizard/route.ts",
];

async function findRoutes(dir: string): Promise<string[]> {
  const routes: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      routes.push(...(await findRoutes(full)));
    } else if (entry.name === "route.ts") {
      routes.push(full);
    }
  }
  return routes;
}

export async function auditAllRoutes(): Promise<{ total: number; audits: RouteAudit[]; gaps: RouteAudit[] }> {
  const root = path.join(process.cwd(), "src/app/api");
  const routeFiles = (await findRoutes(root)).sort();
  const audits: RouteAudit[] = [];

  for (const file of routeFiles) {
    const content = await readFile(file, "utf8");
    const methods: string[] = [];
    for (const m of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      if (new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\b`).test(content)) {
        methods.push(m);
      }
    }

    const mutatingMethods = methods.filter((m) => m !== "GET");
    if (mutatingMethods.length === 0) continue;

    const isWebhookOrInternal = WEBHOOK_OR_INTERNAL_ROUTES.some((prefix) => file.includes(prefix));
    const isPublicAllowlist = INTENTIONAL_PUBLIC_MUTATING_ROUTES.some((p) => file.endsWith(p));

    const hasOriginCheck = /isTrustedMutation\s*\(/.test(content);
    const hasAuthCheck =
      /getSession|getFreshSession|getAdminSession|getSuperAdminSession|requireAdmin|requireUser|requireActivePersona|auth\.api\.getSession|resolveMcpActor|verifyServiceToken/.test(
        content,
      );
    const hasRateLimit = /consumeRateLimit|adminMutationRateLimit|rateLimit/.test(content);

    const issues: string[] = [];
    if (!isWebhookOrInternal) {
      if (!hasOriginCheck) {
        issues.push(`Missing isTrustedMutation check on mutating method (${mutatingMethods.join(",")})`);
      }
      if (!hasAuthCheck && !isPublicAllowlist) {
        issues.push(`Missing authentication check and not in intentional public allowlist`);
      }
      if (!hasRateLimit) {
        issues.push(`Missing rate limiting on mutating method (${mutatingMethods.join(",")})`);
      }
    }

    audits.push({
      file,
      methods,
      mutatingMethods,
      hasOriginCheck,
      hasAuthCheck,
      hasRateLimit,
      isWebhookOrInternal,
      isPublicAllowlist,
      issues,
    });
  }

  const gaps = audits.filter((a) => a.issues.length > 0);
  return { total: audits.length, audits, gaps };
}

async function main() {
  const { total, gaps } = await auditAllRoutes();
  console.log(`Audited ${total} mutating route handlers under src/app/api.`);
  if (gaps.length > 0) {
    console.error(`\nFound ${gaps.length} route handler(s) with security gaps:`);
    for (const gap of gaps) {
      console.error(`\n  File: ${gap.file}`);
      for (const issue of gap.issues) {
        console.error(`    - ✗ ${issue}`);
      }
    }
    process.exitCode = 1;
  } else {
    console.log(`\n✓ All ${total} mutating route handlers enforce origin checks, authorization, and rate limiting.`);
  }
}

if (process.argv[1]?.endsWith("audit-route-handlers.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
