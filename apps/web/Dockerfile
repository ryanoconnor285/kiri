# Web app (Next.js) image.
#
# The web service uses this Dockerfile so Railway builds it with the Docker
# builder and ignores the repo-root railpack.json (which is API-only and would
# otherwise build the API instead, leaving no .next and crashing `next start`).
#
# Build context is the monorepo root, so COPY paths are repo-relative.

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile || pnpm install
# NEXT_PUBLIC_* is inlined into the client bundle at build time, so it must be
# present here. Railway passes service variables to Docker builds as build args.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN pnpm --filter @kiri/schema build && pnpm --filter @kiri/web build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app ./
WORKDIR /app/apps/web
# next start binds to $PORT (provided by Railway); EXPOSE is informational.
EXPOSE 3000
CMD ["pnpm", "start"]
