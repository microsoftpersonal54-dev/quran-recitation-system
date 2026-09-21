import "server-only";

export function siteUrl(): string {
  const raw =
    process.env.APP_URL ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export function internalFunctionSecret(): string | undefined {
  return process.env.INTERNAL_FUNCTION_SECRET;
}
