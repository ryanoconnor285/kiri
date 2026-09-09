FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/schema/package.json ./packages/schema/
RUN pnpm install --frozen-lockfile || pnpm install

FROM deps AS build
COPY . .
RUN pnpm --filter @kiri/schema build
RUN pnpm --filter @kiri/db build
RUN pnpm --filter @kiri/api build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/packages/db/dist ./packages/db/dist
COPY --from=build /app/packages/db/package.json ./packages/db/
COPY --from=build /app/packages/schema/dist ./packages/schema/dist
COPY --from=build /app/packages/schema/package.json ./packages/schema/
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-workspace.yaml ./
EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]
