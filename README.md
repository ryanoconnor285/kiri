# Kiri

Hybrid STEM flashcard platform for pre-med and science coursework. Create cards on iPad with Apple Pencil, review on iPhone, and manage decks on the web.

## Architecture

```
kiri/
├── apps/
│   ├── api/          # GraphQL API (GraphQL Yoga + Pothos + Better Auth)
│   ├── web/          # Next.js web app
│   └── ios/          # SwiftUI iOS app (iPad editor + iPhone reviewer)
├── packages/
│   ├── db/           # Drizzle ORM schema + migrations
│   └── schema/       # Shared Zod types
```

## Prerequisites

- **Node.js 22+**
- **pnpm 10+** (`corepack enable`)
- **PostgreSQL** (local Docker or Railway)
- **Xcode 16+** (for iOS)
- **XcodeGen** (optional, for iOS project generation): `brew install xcodegen`

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit DATABASE_URL and secrets as needed
```

For the web app:

```bash
echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > apps/web/.env.local
```

### 3. Start PostgreSQL

Local Docker:

```bash
docker run --name kiri-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=kiri -p 5432:5432 -d postgres:16
```

Or use a Railway PostgreSQL instance and set `DATABASE_URL` in `.env`.

### 4. Run migrations

```bash
pnpm db:generate
pnpm db:migrate
```

### 5. Seed demo data

```bash
pnpm db:seed
```

Creates a demo user (`demo@kiri.app`) and a "STEM Fundamentals" deck with sample KaTeX cards.

### 6. Start development servers

```bash
pnpm dev
```

- **API:** http://localhost:4000/graphql
- **Web:** http://localhost:3000
- **Auth:** http://localhost:4000/api/auth

### 7. iOS app

Open the Xcode project:

```bash
open apps/ios/Kiri.xcodeproj
```

Run on iPad simulator for the PencilKit editor, iPhone for review mode. The scheme includes `KIRI_API_URL=http://localhost:4000` by default.

Alternatively, regenerate with [XcodeGen](https://github.com/yonaskolb/XcodeGen) from `apps/ios/project.yml`:

```bash
cd apps/ios && xcodegen generate
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start API + web in parallel |
| `pnpm build` | Build all packages |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm db:seed` | Seed demo deck and cards |

## Railway Deployment

Railway must build from the **monorepo root** (leave Root Directory empty in service settings). Railpack detects the pnpm workspace via `package.json` + `pnpm-workspace.yaml`.

1. **Commit and push** all scaffold files — if only `README.md` is on the remote, Railpack will fail with "could not determine how to build the app"
2. Create a Railway project and add a **PostgreSQL** plugin
3. Deploy the API service from this repo root
4. Set environment variables from `.env.example` (link `DATABASE_URL` from Postgres)
5. **Database migrations run automatically** via the API service's **Pre-Deploy
   Command** (Settings → Deploy): `pnpm --filter @kiri/db migrate`. This runs
   before each new version goes live and is idempotent — `drizzle-kit migrate`
   tracks applied migrations in a `__drizzle_migrations` table and only applies
   new ones. (The migration journal in `packages/db/drizzle/meta/` is committed
   so this is reproducible.)

Build/start are configured in [`railway.toml`](railway.toml) and [`railpack.json`](railpack.json):

- **Build:** `pnpm --filter @kiri/schema build && pnpm --filter @kiri/db build && pnpm --filter @kiri/api build`
- **Start:** `node apps/api/dist/index.js`

### Web app (second service, same project)

The web app runs as a **separate service** in the same Railway project. The repo
root `railpack.json` is **API-only** and is inherited by every Railpack service in
the repo, so a Railpack-built web service would build the API instead of the web
app (no `.next` → `next start` crashes). The web service therefore builds from
[`apps/web/Dockerfile`](apps/web/Dockerfile), which bypasses `railpack.json`
entirely:

1. In the project: **New → GitHub Repo → this repo** (creates a second service).
2. **Settings → Build → Builder:** Dockerfile, **Dockerfile Path:** `apps/web/Dockerfile`.
3. **Settings → Root Directory:** leave empty (the Docker build context is the
   monorepo root).
4. **Settings → Networking → Generate Domain** for both the web service and the API
   service (the API needs a public domain too).

`next start` binds to Railway's `$PORT` automatically. `NEXT_PUBLIC_API_URL` is a
build-time variable — the Dockerfile reads it as a build arg (Railway passes
service variables to Docker builds), so set it before the first deploy.

Environment variables:

| Service | Variable | Value |
|---------|----------|-------|
| web | `NEXT_PUBLIC_API_URL` | `https://<api-domain>` (baked in at build time) |
| api | `API_URL` | `https://<api-domain>` (the API's own public URL) |
| api | `WEB_URL` | `https://<web-domain>` (web app origin, used for CORS) |
| api | `AUTH_SECRET` | random secret (`openssl rand -base64 32`) |
| api | `NODE_ENV` | `production` |

`API_URL` and the web's `NEXT_PUBLIC_API_URL` are the **same** value (the API's
domain); `WEB_URL` is the **web app's** domain. Set the API's domain first so
`NEXT_PUBLIC_API_URL` / `API_URL` are known before the first web build. The web and
API live on different `*.up.railway.app` domains (cross-site), so the API issues
session cookies as `SameSite=None; Secure` in production (see `apps/api/src/auth.ts`).

## GraphQL API

Key operations:

- **Queries:** `me`, `decks`, `deck`, `cards`, `dueCards`
- **Mutations:** `createDeck`, `upsertCard`, `submitReview`, `aiImportCards`
- **REST:** `POST /api/import/apkg?deckId=…` (session cookie; raw `.apkg` body)

Auth uses Better Auth with cookie sessions on web and bearer tokens for iOS.

## Phase 1 Scope

This scaffold includes minimal working skeletons. Deferred for later phases:

- Full bidirectional sync conflict resolution
- Production LLM integration (stub normalizes chemical formulas)
- Custom PencilKit tool palette
- App Store / TestFlight configuration
