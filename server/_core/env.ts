/**
 * server/_core/env.ts
 *
 * Centralised environment variable access.
 * All variables must be set in Vercel → Project → Settings → Environment Variables.
 *
 * Required on Vercel:
 *   DATABASE_URL          MySQL/TiDB connection string
 *   JWT_SECRET            Cookie signing secret (generate with: openssl rand -hex 32)
 *   VITE_APP_ID           OAuth client_id for your auth provider
 *   OAUTH_SERVER_URL      Base URL of your OAuth provider
 *
 * Optional / Manus-only (safe to leave empty on Vercel):
 *   OWNER_OPEN_ID         First user promoted to admin automatically
 *   BUILT_IN_FORGE_API_URL  Manus LLM proxy (not available on Vercel)
 *   BUILT_IN_FORGE_API_KEY  Manus API key (not available on Vercel)
 */
export const ENV = {
  appId:           process.env.VITE_APP_ID           ?? "",
  cookieSecret:    process.env.JWT_SECRET             ?? "",
  databaseUrl:     process.env.DATABASE_URL           ?? "",
  oAuthServerUrl:  process.env.OAUTH_SERVER_URL       ?? "",
  ownerOpenId:     process.env.OWNER_OPEN_ID          ?? "",
  isProduction:    process.env.NODE_ENV               === "production",
  forgeApiUrl:     process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey:     process.env.BUILT_IN_FORGE_API_KEY ?? "",
} as const;

// Warn loudly in production if critical vars are missing
if (ENV.isProduction) {
  const missing = (["cookieSecret", "databaseUrl"] as const).filter((k) => !ENV[k]);
  if (missing.length) {
    console.error("[ENV] Missing required environment variables:", missing.join(", "));
  }
}
