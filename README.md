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
5. Run migrations after first deploy: `railway run pnpm db:migrate`

Build/start are configured in [`railway.toml`](railway.toml) and [`railpack.json`](railpack.json):

- **Build:** `pnpm --filter @kiri/schema build && pnpm --filter @kiri/db build && pnpm --filter @kiri/api build`
- **Start:** `node apps/api/dist/index.js`

## GraphQL API

Key operations:

- **Queries:** `me`, `decks`, `deck`, `cards`, `dueCards`
- **Mutations:** `createDeck`, `upsertCard`, `submitReview`, `aiImportCards`

Auth uses Better Auth with cookie sessions on web and bearer tokens for iOS.

## Phase 1 Scope

This scaffold includes minimal working skeletons. Deferred for later phases:

- Full bidirectional sync conflict resolution
- `.apkg` Anki import
- Production LLM integration (stub normalizes chemical formulas)
- Custom PencilKit tool palette
- App Store / TestFlight configuration
