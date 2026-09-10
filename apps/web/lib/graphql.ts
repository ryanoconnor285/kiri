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

  const json = (await response.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message ?? "GraphQL error");
  }

  return json.data as T;
}
