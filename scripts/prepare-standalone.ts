import { access, cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const standaloneRoot = path.join(root, ".next", "standalone");
const standaloneServer = path.join(standaloneRoot, "server.js");
const sourcePublic = path.join(root, "public");
const sourceStatic = path.join(root, ".next", "static");
const targetPublic = path.join(standaloneRoot, "public");
const targetStatic = path.join(standaloneRoot, ".next", "static");

async function main() {
  await access(standaloneServer);

  await rm(targetPublic, { recursive: true, force: true });
  await cp(sourcePublic, targetPublic, { recursive: true });

  await mkdir(path.dirname(targetStatic), { recursive: true });
  await rm(targetStatic, { recursive: true, force: true });
  await cp(sourceStatic, targetStatic, { recursive: true });

  console.log("Standalone runtime prepared with public and .next/static assets.");
}

main().catch((error) => {
  console.error("Failed to prepare standalone runtime:", error);
  process.exitCode = 1;
});
