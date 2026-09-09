import { cacheExchange, createClient, fetchExchange } from "urql";
import { API_URL } from "./config";

export function createGraphQLClient() {
  return createClient({
    url: `${API_URL}/graphql`,
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
  const response = await fetch(`${API_URL}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ query, variables }),
  });

  const json = (await response.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message ?? "GraphQL error");
  }

  return json.data as T;
}
