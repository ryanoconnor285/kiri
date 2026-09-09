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
