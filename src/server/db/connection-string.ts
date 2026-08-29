const SSL_MODES_WITH_LEGACY_STRICT_BEHAVIOR = new Set(["prefer", "require", "verify-ca"]);

/**
 * Keep node-postgres connections on explicit certificate and hostname
 * verification. pg currently treats these modes as verify-full, but its next
 * major release will align them with weaker libpq semantics.
 */
export function hardenPostgresConnectionString(connectionString: string) {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return connectionString;
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    return connectionString;
  }

  const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
  if (!sslMode || !SSL_MODES_WITH_LEGACY_STRICT_BEHAVIOR.has(sslMode)) {
    return connectionString;
  }

  url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}
