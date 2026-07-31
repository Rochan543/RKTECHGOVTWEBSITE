# SSC Exam Platform (RK TECH Portal)

A production-grade Online Examination Platform for SSC, Banking, Railway, UPSC, and other Indian competitive exams.

## Architecture

pnpm monorepo with three main parts:

| Package | Path | Description |
|---------|------|-------------|
| `@workspace/api-server` | `artifacts/api-server/` | Express 5 REST API, port 8080 |
| `@workspace/exam-platform` | `artifacts/exam-platform/` | React 19 + Vite frontend |
| `@workspace/db` | `lib/db/` | Drizzle ORM + PostgreSQL schema & migrations |
| `@workspace/api-client-react` | `lib/api-client-react/` | Generated React Query hooks (orval) |
| `@workspace/api-zod` | `lib/api-zod/` | Shared Zod validators |

## Running the Project

Two workflows must be running simultaneously:

- **`artifacts/api-server: API Server`** — `PORT=8080 SESSION_SECRET=$SESSION_SECRET pnpm --filter @workspace/api-server run dev`
- **`artifacts/exam-platform: web`** — `PORT=22619 BASE_PATH=/ pnpm --filter @workspace/exam-platform run dev`

The Vite dev server proxies `/api/*` to `localhost:8080`.

## Database

Uses Replit's built-in PostgreSQL. `DATABASE_URL` is injected automatically at runtime — do NOT set it manually.

To push schema changes:
```bash
cd lib/db && pnpm run push
```

Schema: `lib/db/src/schema/index.ts`
Migration SQL: `lib/db/migrations/0001_initial_schema.sql`

## Environment Variables / Secrets

| Key | Type | Notes |
|-----|------|-------|
| `SESSION_SECRET` | Secret | JWT signing key — already configured |
| `DATABASE_URL` | Runtime-managed | Auto-injected by Replit |
| `CLOUDINARY_CLOUD_NAME` | Secret | Optional — for PDF/image uploads |
| `CLOUDINARY_API_KEY` | Secret | Optional |
| `CLOUDINARY_API_SECRET` | Secret | Optional |

## Portals

- **Student Portal** — login/register, dashboard, exams, practice, analytics, leaderboard
- **Admin Portal** — question management, exam builder, user management, analytics
- **Super Admin Portal** — platform-wide analytics, admin management, audit logs

## Key Technical Notes

- **Zod imports**: Always `import { z } from "zod"` — never `"zod/v4"` (breaks esbuild bundler)
- **customFetch**: Returns `""` base URL in browser so relative paths flow through Vite proxy
- **Trust proxy**: `app.set("trust proxy", 1)` is required for express-rate-limit behind Replit's reverse proxy
- **API routes**: All backend routes mount under `/api` prefix. Route files define paths with `/v1/` prefix internally (e.g. `router.get("/v1/exams", ...)`)
- **Vite proxy**: Targets `http://localhost:8080` — must match API Server workflow PORT

## User Preferences

_No preferences recorded yet._
