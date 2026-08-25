import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "dotenv";

async function main() {
  config({ path: ".env", quiet: true });

  const port = process.env.PORT?.trim() || "3000";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  const host = "127.0.0.1";
  const origin = `http://localhost:${port}`;
  const loopbackOrigin = `http://${host}:${port}`;
  const serverPath = path.resolve(".next/standalone/server.js");

  try {
    await access(serverPath);
  } catch {
    throw new Error("Standalone build not found. Run `npm run build` first.");
  }

  Object.assign(process.env, {
    NODE_ENV: "production",
    ANEI_LOCAL_PRODUCTION: "1",
    HOSTNAME: host,
    PORT: port,
    APP_URL: origin,
    BETTER_AUTH_URL: origin,
    TRUSTED_ORIGINS: `${origin},${loopbackOrigin}`,
  });

  console.log(`Starting ANEI local production smoke server at ${origin} (bound to and also trusted: ${loopbackOrigin})`);
  await import(pathToFileURL(serverPath).href);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
