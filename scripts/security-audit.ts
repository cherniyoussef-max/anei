import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const roots = ["src", "scripts"];
const forbidden = [
  { label: "ts-ignore", pattern: /@ts-ignore/g },
  { label: "dangerouslySetInnerHTML", pattern: /dangerouslySetInnerHTML/g },
  { label: "dynamic eval", pattern: /\beval\s*\(/g },
  { label: "Function constructor", pattern: /new\s+Function\s*\(/g },
  { label: "shell execution", pattern: /node:child_process|child_process/g },
  { label: "dead href", pattern: /href=["']#["']/g },
];

async function filesUnder(dir: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await filesUnder(full));
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) result.push(full);
  }
  return result;
}

async function main() {
  const files = (await Promise.all(roots.map(filesUnder))).flat();
  const findings: string[] = [];
  for (const file of files) {
    if (file.endsWith("scripts/security-audit.ts")) continue;
    const content = await readFile(file, "utf8");
    for (const rule of forbidden) {
      if (rule.pattern.test(content)) findings.push(`${rule.label}: ${file}`);
      rule.pattern.lastIndex = 0;
    }
    // sql.raw is allowed only with a local security justification comment.
    if (/sql\.raw\s*\(/.test(content) && !/SECURITY:\s*sql\.raw/i.test(content)) findings.push(`unreviewed sql.raw: ${file}`);
  }
  if (findings.length) {
    console.error("Security audit failed:\n" + findings.map((item) => ` - ${item}`).join("\n"));
    process.exitCode = 1;
    return;
  }
  console.log(`Security audit passed across ${files.length} source files.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
