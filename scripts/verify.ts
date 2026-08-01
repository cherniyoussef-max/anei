import "dotenv/config";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const required = [
  "README.md",
  "CHANGELOG.md",
  "package-lock.json",
  "docs/CURRENT_STATE.md",
  "docs/IMPLEMENTATION_PLAN.md",
  "docs/ARCHITECTURE.md",
  "docs/SECURITY.md",
  "docs/SECURITY_SQL_INJECTION.md",
  "docs/THREAT_MODEL.md",
  "docs/PENTEST_PLAN.md",
  "docs/TESTING.md",
  "docs/DATABASE.md",
  "docs/AUTHENTICATION.md",
  "docs/AUTHORIZATION.md",
  "docs/DEPLOYMENT.md",
  "docs/DESIGN_SYSTEM.md",
  "docs/UPGRADE_FROM_V2.md",
  "docs/BACKUP_AND_RECOVERY.md",
  "docs/RUNBOOK.md",
  "docs/ENVIRONMENT_VARIABLES.md",
  "docs/PRIVACY_AND_DATA_LIFECYCLE.md",
  "docs/SECURITY_REVIEW_MATRIX.md",
  "docs/PRODUCTION_CHECKLIST.md",
  "drizzle/0000_initial.sql",
  "drizzle/0001_integrity_constraints.sql",
  "drizzle/0002_query_indexes.sql",
  "drizzle/0003_course_modules.sql",
];

async function main() {
  for (const file of required) await access(path.resolve(file));
  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as { scripts?: Record<string, string> };
  for (const script of ["typecheck", "lint", "test", "build", "db:migrate", "security:audit"]) {
    if (!packageJson.scripts?.[script]) throw new Error(`Missing npm script: ${script}`);
  }
  const migrations = (await readdir("drizzle")).filter((file) => file.endsWith(".sql")).sort();
  if (migrations.length < 4) throw new Error("Expected versioned SQL migrations.");
  console.log(`Repository verification passed. ${migrations.length} migrations found.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
