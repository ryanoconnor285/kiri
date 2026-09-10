import { createAuthClient } from "better-auth/react";
import { API_ORIGIN } from "./config";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : API_ORIGIN,
  fetchOptions: {
    credentials: "include",
  },
});

export const { signIn, signUp, signOut, useSession } = authClient;
