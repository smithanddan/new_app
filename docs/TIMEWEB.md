# Timeweb Deployment

LabPrice OS can run on Timeweb App Platform as a regular Node.js/Next.js web app. Supabase remains the database, and GitHub Actions remains the crawler scheduler.

## Recommended Product

Choose **Timeweb Cloud -> App Platform**, not a raw VPS.

Use App Platform for:

- public Next.js app and API routes;
- PWA pages;
- checkout/lead/API tracking;
- automatic deploys from GitHub.

Do not run scheduled crawlers in Timeweb v1. Keep scheduled DNKOM/Gemotest syncs in GitHub Actions.

## Initial Size

Start with the smallest App Platform instance close to:

- 1 vCPU;
- 1 GB RAM;
- Node.js 22;
- Moscow/Russia region if available.

Scale later only if builds or API latency require it.

## Option A: Native Node.js App

Use this first if Timeweb correctly supports pnpm monorepos.

Settings:

- Repository: `smithanddan/new_app`
- Branch: `main`
- Working directory: repository root
- Runtime: Node.js 22
- Install command:

```bash
pnpm install --frozen-lockfile
```

- Build command:

```bash
pnpm build:admin
```

- Start command:

```bash
pnpm start:admin
```

If Timeweb asks for the app port, use `3000` or the platform-provided `$PORT` if it exposes one.

## Option B: Docker Fallback

Use Docker if native monorepo detection fails.

Settings:

- Repository: `smithanddan/new_app`
- Branch: `main`
- Dockerfile path:

```text
Dockerfile.timeweb
```

- Context: repository root
- Port: `3000`

The Dockerfile installs workspace dependencies, builds `@web-monitor/admin`, and starts the Next.js app.

## Environment Variables

Required:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Recommended:

```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.example
LABPRICE_API_KEYS=comma-separated-api-keys
```

Optional crawler limits are not needed in Timeweb unless crawler commands are run there:

```bash
DNKOM_SYNC_LIMIT=200
GEMOTEST_SYNC_LIMIT=100
```

## GitHub Actions

Keep these outside Timeweb:

- CI on pull requests;
- scheduled crawlers;
- manual crawler backfills.

Timeweb should only deploy web/API/PWA after `main` changes.

## Manual Smoke After Deploy

Open:

- `/search`
- `/compare?test=Ферритин&city=Москва`
- `/basket?tests=Глюкоза,ТТГ,Ферритин&city=Москва`
- `/api-docs`
- `/pricing`
- `/manifest.webmanifest`

API smoke:

```bash
curl "https://your-domain.example/api/v1/compare?test=Ферритин&city=Москва"
curl "https://your-domain.example/api/v1/basket-optimize?tests=Глюкоза,ТТГ,Ферритин&city=Москва"
```

If `LABPRICE_API_KEYS` is set, include:

```bash
-H "x-api-key: your-key"
```

## Troubleshooting

If native Node.js deployment fails:

1. switch to Docker mode;
2. verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`;
3. check that the exposed port is `3000`;
4. check build logs for pnpm workspace resolution errors;
5. make sure Timeweb deploys from the repository root, not `apps/admin`.
