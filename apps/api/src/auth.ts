import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Database } from "@kiri/db";
import * as schema from "@kiri/db";

type AuthOptions = {
  db: Database;
  baseUrl: string;
  secret: string;
  trustedOrigins: string[];
};

export function createAuth({ db, baseUrl, secret, trustedOrigins }: AuthOptions) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    baseURL: baseUrl,
    secret,
    trustedOrigins,
    advanced: {
      database: {
        generateId: "uuid",
      },
      // In production the web app and API are served from different Railway
      // domains, which the browser treats as cross-site. Session cookies must
      // be SameSite=None; Secure to be sent on credentialed cross-origin
      // requests. Locally (http baseURL) we keep Better Auth's Lax defaults.
      ...(baseUrl.startsWith("https://")
        ? { defaultCookieAttributes: { sameSite: "none", secure: true } }
        : {}),
    },
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        enabled: Boolean(process.env.GOOGLE_CLIENT_ID),
      },
      apple: {
        clientId: process.env.APPLE_CLIENT_ID ?? "",
        clientSecret: process.env.APPLE_CLIENT_SECRET ?? "",
        enabled: Boolean(process.env.APPLE_CLIENT_ID),
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
