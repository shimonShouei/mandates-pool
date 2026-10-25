/** Point a Neon host at the pooled endpoint. Other Postgres URLs are left alone. */
export function pooledNeonUrl(connectionString: string): string {
  if (process.env.DATABASE_DIRECT === "1") return connectionString;
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    return connectionString;
  }
  if (!parsed.hostname.endsWith(".neon.tech")) return connectionString;
  if (parsed.hostname.includes("-pooler")) return connectionString;
  const labels = parsed.hostname.split(".");
  labels[0] = `${labels[0]}-pooler`;
  parsed.hostname = labels.join(".");
  return parsed.toString();
}
