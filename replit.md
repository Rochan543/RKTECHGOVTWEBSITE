# SSC Exam Platform

A production-grade online examination platform for SSC, Banking, Railway, UPSC, and other competitive exams.

## Architecture

**Monorepo** managed with pnpm workspaces.

| Package | Location | Description |
|---------|----------|-------------|
| `@workspace/exam-platform` | `artifacts/exam-platform/` | React 19 + Vite frontend |
| `@workspace/api-server` | `artifacts/api-server/` | Express 5 API server |
| `@workspace/db` | `lib/db/` | Drizzle ORM + PostgreSQL schema |
| `@workspace/api-zod` | `lib/api-zod/` | Generated Zod validators |
| `@workspace/api-client-react` | `lib/api-client-react/` | Generated React Query API client |

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, TanStack Query, wouter, Framer Motion
- **Backend**: Node.js, Express 5, TypeScript, Pino logging
- **Database**: PostgreSQL (Replit built-in), Drizzle ORM
- **Auth**: JWT (custom HS256 via Node.js crypto), bcrypt, Bearer tokens stored in sessionStorage

## Running the Project

Both workflows are managed by Replit:
- **API Server**: `pnpm --filter @workspace/api-server run dev` → builds then starts on `$PORT`
- **Frontend**: `pnpm --filter @workspace/exam-platform run dev` → Vite dev server on `$PORT`

### Schema changes

```bash
cd lib/db && pnpm run push   # push schema to dev DB
```

## Portals

- **Student Portal** — `/` (login → `/dashboard`)
- **Admin Portal** — `/admin` (requires `admin` or `super_admin` role)

## Default Admin Account

After seeding, an admin account is created:
- **Email**: `admin@sscplatform.com`
- **Password**: `Admin@123456`

## User Preferences

- Keep the existing pnpm monorepo structure — do not restructure or migrate
- Use `zod` (not `zod/v4`) as the import for routes in `artifacts/api-server/` — esbuild can't resolve subpath exports
- `customFetch` must be exported from `lib/api-client-react/src/index.ts` for frontend pages that use it directly
- `DATABASE_URL` is runtime-managed by Replit — do not set it manually
