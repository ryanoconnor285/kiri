import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { authHandler, createContextFromHeaders, setCorsHeaders } from "./context.js";
import { schema } from "./graphql/schema.js";
import { handleImportApkg } from "./import-apkg.js";

const port = Number(process.env.PORT ?? 4000);

const yoga = createYoga({
  schema,
  context: ({ request }) => createContextFromHeaders(request.headers),
  graphqlEndpoint: "/graphql",
  landingPage: process.env.NODE_ENV !== "production",
});

const server = createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url?.split("?")[0];

  if (url?.startsWith("/api/auth")) {
    await authHandler(req, res);
    return;
  }

  if (url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (url === "/api/import/apkg") {
    await handleImportApkg(req, res);
    return;
  }

  yoga(req, res);
});

server.listen(port, () => {
  console.log(`Kiri API running at http://localhost:${port}`);
  console.log(`GraphQL endpoint: http://localhost:${port}/graphql`);
  console.log(`Auth endpoint: http://localhost:${port}/api/auth`);
});
