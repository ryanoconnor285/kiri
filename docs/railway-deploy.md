# Railway: API vs web deploys

This monorepo has **two services** in the same Railway project:

| Service | Build | Start |
|---------|--------|--------|
| **API** | Root `railway.toml` / Railpack | `node apps/api/dist/index.js` |
| **Web** | `apps/web/Dockerfile` | `pnpm start` in `apps/web` |

Do **not** put API-only `watchPatterns` in the repo-root `railway.toml`. Config-as-code watch patterns apply to services using that file and will make the **web** service log **“No changes to watched files”** when you only change `apps/web/**`.

## Watch paths (Railway dashboard)

Set these per service under **Settings → Build → Watch Paths** (gitignore-style, from repo `/`):

**API service**

```
/apps/api/**
/packages/**
/package.json
/pnpm-lock.yaml
/pnpm-workspace.yaml
/railpack.json
/railway.toml
```

**Web service**

```
/apps/web/**
/packages/schema/**
/package.json
/pnpm-lock.yaml
/pnpm-workspace.yaml
```

Also confirm the web service uses **Dockerfile** builder with path `apps/web/Dockerfile` (or variable `RAILWAY_DOCKERFILE_PATH=apps/web/Dockerfile`), **Root Directory** empty (monorepo root context).

## Verify a web deploy

1. Push to `staging`.
2. Web service deployment should **build** (not skip).
3. Open `/decks` → View Source → `/_next/static/css/<hash>.css` should change after a CSS change.

Staging web: `https://web-staging-997c.up.railway.app` (API CORS uses this origin).
