import { readFile } from "node:fs/promises";
import path from "node:path";

const expected: Record<string, string> = {
  next: "16.2.12",
  react: "19.2.8",
  "react-dom": "19.2.8",
  sharp: "0.35.3",
  postcss: "8.5.26",
  "drizzle-kit": "0.31.10",
  eslint: "9.39.5",
  "eslint-config-next": "16.2.12",
};

type LockPackage = { version?: string };
type PackageLock = { packages?: Record<string, LockPackage> };

function compareVersions(left: string, right: string) {
  const a = left.split(".").map((value) => Number.parseInt(value, 10) || 0);
  const b = right.split(".").map((value) => Number.parseInt(value, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function installedVersion(name: string) {
  // Read the package metadata by filesystem path instead of requiring
  // "<package>/package.json". Several modern packages intentionally hide
  // package.json through their exports map, which made the previous doctor
  // report false "not installed" failures.
  const packageJson = path.join(process.cwd(), "node_modules", ...name.split("/"), "package.json");
  const parsed = JSON.parse(await readFile(packageJson, "utf8")) as { version?: string };
  return parsed.version ?? "unknown";
}

async function main() {
  let failed = false;

  for (const [name, wanted] of Object.entries(expected)) {
    try {
      const actual = await installedVersion(name);
      const ok = actual === wanted;
      console.log(`${ok ? "✓" : "✗"} ${name}: ${actual}${ok ? "" : ` (expected ${wanted})`}`);
      if (!ok) failed = true;
    } catch {
      console.error(`✗ ${name}: not installed`);
      failed = true;
    }
  }

  try {
    const lock = JSON.parse(await readFile(path.join(process.cwd(), "package-lock.json"), "utf8")) as PackageLock;
    const packages = lock.packages ?? {};

    const vulnerableSharp = Object.entries(packages).filter(([location, pkg]) =>
      /(^|\/)node_modules\/sharp$/.test(location) && pkg.version && compareVersions(pkg.version, "0.35.0") < 0,
    );
    if (vulnerableSharp.length) {
      failed = true;
      console.error("✗ vulnerable nested sharp versions remain:");
      for (const [location, pkg] of vulnerableSharp) console.error(`  - ${location}: ${pkg.version}`);
    } else {
      console.log("✓ no sharp < 0.35.0 in package-lock.json");
    }

    const vulnerablePostcss = Object.entries(packages).filter(([location, pkg]) =>
      /(^|\/)node_modules\/postcss$/.test(location) && pkg.version && compareVersions(pkg.version, "8.5.18") < 0,
    );
    if (vulnerablePostcss.length) {
      failed = true;
      console.error("✗ vulnerable nested postcss versions remain:");
      for (const [location, pkg] of vulnerablePostcss) console.error(`  - ${location}: ${pkg.version}`);
    } else {
      console.log("✓ no postcss < 8.5.18 in package-lock.json");
    }

    const vulnerableNanoid = Object.entries(packages).filter(([location, pkg]) =>
      /(^|\/)node_modules\/nanoid$/.test(location) && pkg.version && compareVersions(pkg.version, "3.3.18") < 0,
    );
    if (vulnerableNanoid.length) {
      failed = true;
      console.error("✗ vulnerable nanoid versions remain:");
      for (const [location, pkg] of vulnerableNanoid) console.error(`  - ${location}: ${pkg.version}`);
    } else {
      console.log("✓ no nanoid < 3.3.18 in package-lock.json");
    }

    const vulnerableBraceExpansion = Object.entries(packages).filter(([location, pkg]) => {
      if (!/(^|\/)node_modules\/brace-expansion$/.test(location) || !pkg.version) return false;
      const major = Number.parseInt(pkg.version.split(".")[0] ?? "0", 10);
      return (major === 1 && compareVersions(pkg.version, "1.1.18") < 0)
        || ((major === 4 || major === 5) && compareVersions(pkg.version, "5.0.9") < 0);
    });
    if (vulnerableBraceExpansion.length) {
      failed = true;
      console.error("✗ vulnerable brace-expansion versions remain:");
      for (const [location, pkg] of vulnerableBraceExpansion) console.error(`  - ${location}: ${pkg.version}`);
    } else {
      console.log("✓ no vulnerable brace-expansion versions in package-lock.json");
    }

    const vulnerableJsYaml = Object.entries(packages).filter(([location, pkg]) =>
      /(^|\/)node_modules\/js-yaml$/.test(location) && pkg.version && compareVersions(pkg.version, "4.3.1") < 0,
    );
    if (vulnerableJsYaml.length) {
      failed = true;
      console.error("✗ vulnerable js-yaml versions remain:");
      for (const [location, pkg] of vulnerableJsYaml) console.error(`  - ${location}: ${pkg.version}`);
    } else {
      console.log("✓ no js-yaml < 4.3.1 in package-lock.json");
    }
  } catch {
    failed = true;
    console.error("✗ package-lock.json is missing or unreadable; run npm install first.");
  }

  if (failed) {
    console.error("\nDependency baseline mismatch. Remove node_modules and package-lock.json, then run npm install.");
    process.exit(1);
  }

  console.log("\nDependency baseline is consistent.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
