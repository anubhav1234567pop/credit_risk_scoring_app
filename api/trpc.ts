/**
 * api/trpc.ts  ←  Vercel serverless entry-point for ALL tRPC routes
 *
 * Vercel routes  /api/trpc/*  →  this file (configured in vercel.json).
 * We use the fetch-adapter so it works in both Node and Edge runtimes.
 */
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createContext } from "../server/_core/context";
import { appRouter } from "../server/routers";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS pre-flight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }

  // Convert Vercel's IncomingMessage → Web API Request
  const origin = `${req.headers["x-forwarded-proto"] ?? "https"}://${req.headers["x-forwarded-host"] ?? req.headers.host}`;
  const url = new URL(req.url ?? "/", origin);

  let body: string | undefined;
  if (req.method === "POST") {
    body = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks).toString()));
      req.on("error", reject);
    });
  }

  const webRequest = new Request(url.toString(), {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: body ?? null,
  });

  // Use the fetch adapter — it handles routing within the tRPC router
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req: webRequest,
    router: appRouter,
    /**
     * createContext now receives a Web API Request.
     * See the updated context.ts below for how to read cookies / set headers
     * back via the ResponseInit pattern.
     */
    createContext: async ({ req: webReq }) => {
      // We still need the raw Node objects for cookie writing.
      // Pass them through so context.ts can use res.setHeader.
      return createContext({ req, res } as any);
    },
    onError({ error, path }) {
      if (error.code === "INTERNAL_SERVER_ERROR") {
        console.error(`[tRPC] Error on ${path}:`, error);
      }
    },
  });

  // Stream the fetch Response back to Vercel
  res.status(response.status);
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.end(Buffer.from(await response.arrayBuffer()));
}
