import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

test("MCP has one active execution path through the canonical ToolRegistry", async () => {
  await assert.rejects(access("src/server/mcp/registry.ts"));
  const server = await readFile("src/server/mcp/server.ts", "utf8");
  assert.match(server, /server\/tools\/registry/);
  assert.match(server, /executeReadTool/);
  assert.match(server, /authorizeAndPropose/);
  assert.ok(!server.includes("class MCPRegistry"));
});
