import { createAuth } from "./auth.js";
import { createDb, type Database } from "@kiri/db";
import type { IncomingMessage, ServerResponse } from "node:http";
import { toNodeHandler } from "better-auth/node";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/kiri";

export const db: Database = createDb(connectionString);

// Accept scheme-less values (e.g. Railway's RAILWAY_PUBLIC_DOMAIN) and normalize
// to a full URL. Better Auth requires an absolute URL with a protocol, and the
// CORS origin must have no trailing slash.
function normalizeUrl(value: string | undefined, fallback: string): string {
  const raw = (value ?? "").trim() || fallback;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, "");
}

const baseUrl = normalizeUrl(process.env.API_URL, "http://localhost:4000");
const webOrigin = normalizeUrl(process.env.WEB_URL, "http://localhost:3000");

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
  // webOrigin is WEB_URL normalized to a scheme-prefixed origin with no trailing
  // slash — used directly as the CORS Access-Control-Allow-Origin value.
  res.setHeader("Access-Control-Allow-Origin", webOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Cookie",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}
