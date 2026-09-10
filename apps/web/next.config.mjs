const apiOrigin = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@kiri/schema"],
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiOrigin}/api/:path*` },
      { source: "/graphql", destination: `${apiOrigin}/graphql` },
    ];
  },
};

export default nextConfig;
