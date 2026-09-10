import { cacheExchange, createClient, fetchExchange } from "urql";
import { apiPath } from "./config";

export function createGraphQLClient() {
  return createClient({
    url: apiPath("/graphql"),
    exchanges: [cacheExchange, fetchExchange],
    fetchOptions: {
      credentials: "include",
    },
  });
}

export const gqlClient = createGraphQLClient();

export async function gqlFetch<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(apiPath("/graphql"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ query, variables }),
  });

  let json: {
    data?: T;
    errors?: Array<{ message: string }>;
  };
  try {
    json = (await response.json()) as typeof json;
  } catch {
    throw new Error("Could not reach the API. Try signing in again.");
  }

  if (json.errors?.length) {
    const message = json.errors[0]?.message ?? "GraphQL error";
    if (/unauthor|sign in/i.test(message) || message === "Unexpected error.") {
      throw new Error("Please sign in again.");
    }
    throw new Error(message);
  }

  if (!json.data) {
    throw new Error("Please sign in again.");
  }

  return json.data;
}
