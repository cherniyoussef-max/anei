process.env.ENABLE_AI = "true";
process.env.ENABLE_MCP = "false";

import test from "node:test";
import assert from "node:assert/strict";

test("MCP route is disabled when ENABLE_MCP is false", async () => {
  const { POST } = await import("@/app/api/mcp/route");
  const request = new Request("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
  });
  const response = await POST(request);
  assert.equal(response.status, 403);
});