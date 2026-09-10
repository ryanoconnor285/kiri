const fallbackApi = "http://localhost:4000";

/** Absolute API origin used by Next.js rewrites (server/build only). */
export const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL ?? fallbackApi).replace(/\/+$/, "");

/**
 * Browser calls same-origin `/graphql` and `/api/*`. Next.js rewrites those
 * to the API so session cookies are first-party (mobile Chrome / iOS block
 * third-party cookies on the separate Railway API domain).
 */
export function apiPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined") {
    return normalized;
  }
  return `${API_ORIGIN}${normalized}`;
}
