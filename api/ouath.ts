/**
 * api/oauth.ts  ←  Vercel serverless entry-point for OAuth routes
 *
 * Handles:
 *   GET  /api/oauth/login     → redirect to OAuth provider
 *   GET  /api/oauth/callback  → exchange code for token, set session cookie
 *   POST /api/oauth/logout    → clear session cookie
 *
 * This replaces the Manus OAuth flow.
 * Swap the provider URLs below for whichever OAuth server you use
 * (GitHub, Google, your own Manus-compatible server, etc.).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as jose from "jose";
import { upsertUser } from "../server/db";
import { ENV } from "../server/_core/env";
import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const";

// ─── helpers ────────────────────────────────────────────────────────────────

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k.trim(), decodeURIComponent(v.join("="))];
    })
  );
}

function cookieHeader(name: string, value: string, maxAge: number): string {
  const secure = ENV.isProduction ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=None${secure}`;
}

async function signJwt(payload: object): Promise<string> {
  const secret = new TextEncoder().encode(ENV.cookieSecret || "dev-secret-change-me");
  return new jose.SignJWT(payload as jose.JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1y")
    .sign(secret);
}

async function verifyJwt(token: string): Promise<jose.JWTPayload | null> {
  try {
    const secret = new TextEncoder().encode(ENV.cookieSecret || "dev-secret-change-me");
    const { payload } = await jose.jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

// ─── handler ────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url ?? "/", `https://${req.headers.host}`);
  const pathname = url.pathname; // e.g. /api/oauth/callback

  // ── GET /api/oauth/login ──────────────────────────────────────────────────
  if (pathname.endsWith("/login") || pathname.endsWith("/authorize")) {
    const returnTo = url.searchParams.get("returnTo") ?? "/";
    const redirectUri = `${url.origin}/api/oauth/callback`;

    // Build the authorization URL for your OAuth provider.
    // Replace OAUTH_SERVER_URL with your provider's authorize endpoint.
    const authUrl = new URL(`${ENV.oAuthServerUrl}/oauth/authorize`);
    authUrl.searchParams.set("client_id", ENV.appId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid profile email");
    authUrl.searchParams.set("state", Buffer.from(JSON.stringify({ returnTo, origin: url.origin })).toString("base64"));

    return res.redirect(302, authUrl.toString());
  }

  // ── GET /api/oauth/callback ───────────────────────────────────────────────
  if (pathname.endsWith("/callback")) {
    const code = url.searchParams.get("code");
    const rawState = url.searchParams.get("state") ?? "";

    let returnTo = "/";
    let clientOrigin = url.origin;
    try {
      const state = JSON.parse(Buffer.from(rawState, "base64").toString());
      returnTo = state.returnTo ?? "/";
      clientOrigin = state.origin ?? url.origin;
    } catch {}

    if (!code) {
      return res.status(400).json({ error: "Missing code parameter" });
    }

    // Exchange code for tokens with your OAuth provider
    const tokenRes = await fetch(`${ENV.oAuthServerUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: ENV.appId,
        code,
        redirect_uri: `${clientOrigin}/api/oauth/callback`,
      }),
    });

    if (!tokenRes.ok) {
      console.error("[OAuth] Token exchange failed:", await tokenRes.text());
      return res.status(401).json({ error: "Token exchange failed" });
    }

    const tokens = (await tokenRes.json()) as {
      access_token: string;
      openId?: string;
      open_id?: string;
      name?: string;
      email?: string;
      login_method?: string;
    };

    const openId = tokens.openId ?? tokens.open_id ?? "";
    if (!openId) {
      return res.status(401).json({ error: "No openId in token response" });
    }

    // Persist/update user in DB
    await upsertUser({
      openId,
      name: tokens.name,
      email: tokens.email,
      loginMethod: tokens.login_method ?? "oauth",
      lastSignedIn: new Date(),
    });

    // Issue session cookie
    const sessionToken = await signJwt({ openId, name: tokens.name, email: tokens.email });
    res.setHeader("Set-Cookie", cookieHeader(COOKIE_NAME, sessionToken, ONE_YEAR_MS / 1000));

    // Redirect back to the frontend
    return res.redirect(302, `${clientOrigin}${returnTo}`);
  }

  // ── POST /api/oauth/logout ────────────────────────────────────────────────
  if (req.method === "POST" && pathname.endsWith("/logout")) {
    res.setHeader("Set-Cookie", cookieHeader(COOKIE_NAME, "", -1));
    return res.status(200).json({ success: true });
  }

  // ── GET /api/oauth/me (optional health-check) ─────────────────────────────
  if (pathname.endsWith("/me")) {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[COOKIE_NAME];
    if (!token) return res.status(401).json({ user: null });
    const payload = await verifyJwt(token);
    return res.status(200).json({ user: payload });
  }

  return res.status(404).json({ error: "Not found" });
}
