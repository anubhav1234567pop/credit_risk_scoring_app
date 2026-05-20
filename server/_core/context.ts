/**
 * server/_core/context.ts
 *
 * Creates the tRPC context from either:
 *   - Express req/res objects  (local dev via `pnpm dev`)
 *   - VercelRequest/VercelResponse objects (production serverless)
 *
 * The key change: we no longer rely on express-session or any
 * Manus-specific middleware. Session state lives in a signed JWT cookie
 * that both the Vercel OAuth handler and this context can read.
 */
import * as jose from "jose";
import type { Request, Response } from "express";
import { getUserByOpenId } from "../db";
import { ENV } from "./env";
import { COOKIE_NAME } from "../../shared/const";

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k.trim(), decodeURIComponent(v.join("="))];
    })
  );
}

async function verifySessionJwt(token: string) {
  try {
    const secret = new TextEncoder().encode(ENV.cookieSecret || "dev-secret-change-me");
    const { payload } = await jose.jwtVerify(token, secret);
    return payload as { openId?: string };
  } catch {
    return null;
  }
}

export type TrpcContext = {
  user: Awaited<ReturnType<typeof getUserByOpenId>> | null;
  req: Request;
  res: Response;
};

/**
 * Works with both Express and Vercel request shapes.
 * Both expose `headers.cookie` and `setHeader`.
 */
export async function createContext({
  req,
  res,
}: {
  req: { headers: Record<string, string | string[] | undefined> };
  res: { setHeader: (name: string, value: string) => void };
}): Promise<TrpcContext> {
  const cookieHeader = Array.isArray(req.headers.cookie)
    ? req.headers.cookie[0]
    : req.headers.cookie;

  const cookies = parseCookies(cookieHeader);
  const sessionToken = cookies[COOKIE_NAME];

  let user: TrpcContext["user"] = null;
  if (sessionToken) {
    const payload = await verifySessionJwt(sessionToken);
    if (payload?.openId) {
      user = (await getUserByOpenId(payload.openId)) ?? null;
    }
  }

  return { user, req: req as Request, res: res as Response };
}
