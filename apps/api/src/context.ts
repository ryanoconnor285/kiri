import { createAuth } from "./auth.js";
import { createDb, type Database } from "@kiri/db";
import type { IncomingMessage, ServerResponse } from "node:http";
import { toNodeHandler } from "better-auth/node";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/kiri";

export const db: Database = createDb(connectionString);

const baseUrl = process.env.API_URL ?? "http://localhost:4000";

export const auth = createAuth({
  db,
  baseUrl,
  secret: process.env.AUTH_SECRET ?? "dev-secret-change-in-production",
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:4000",
    baseUrl,
  ],
});

export const authHandler = toNodeHandler(auth);

export async function getSessionFromHeaders(
  headers: Headers,
): Promise<{ userId: string; email: string; name: string | null } | null> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) {
    return null;
  }

  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
  };
}

export async function getSessionFromRequest(
  request: IncomingMessage,
): Promise<{ userId: string; email: string; name: string | null } | null> {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value) {
      headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
  }

  return getSessionFromHeaders(headers);
}

export type GraphQLContext = {
  db: typeof db;
  user: { userId: string; email: string; name: string | null } | null;
};

export async function createContextFromHeaders(
  headers: Headers,
): Promise<GraphQLContext> {
  const user = await getSessionFromHeaders(headers);
  return { db, user };
}

export async function createContext(
  request: IncomingMessage,
): Promise<GraphQLContext> {
  const user = await getSessionFromRequest(request);
  return { db, user };
}

export function setCorsHeaders(res: ServerResponse) {
  // WEB_URL is the web app's origin (scheme://host, no trailing slash) — used
  // directly as the CORS Access-Control-Allow-Origin value.
  res.setHeader("Access-Control-Allow-Origin", process.env.WEB_URL ?? "http://localhost:3000");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Cookie",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}
