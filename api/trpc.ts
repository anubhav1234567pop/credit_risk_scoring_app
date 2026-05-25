import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createContext } from "../server/_core/context";
import { appRouter } from "../server/routers";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log("[tRPC] Handler called");
  console.log("[tRPC] DATABASE_URL exists:", !!process.env.DATABASE_URL);
  console.log("[tRPC] DATABASE_URL starts with:", process.env.DATABASE_URL?.substring(0, 20));

  // Handle CORS pre-flight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }

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

  try {
    const response = await fetchRequestHandler({
      endpoint: "/api/trpc",
      req: webRequest,
      router: appRouter,
      createContext: async () => {
        return createContext({ req, res } as any);
      },
      onError({ error, path }) {
        console.error(`[tRPC] Error on path "${path}":`, error.message);
        console.error(`[tRPC] Error cause:`, error.cause);
        console.error(`[tRPC] Full error:`, JSON.stringify(error, null, 2));
      },
    });

    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    console.error("[tRPC] Unhandled error:", err);
    res.status(500).json({ error: "Internal server error", detail: String(err) });
  }
}