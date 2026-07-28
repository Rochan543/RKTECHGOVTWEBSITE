# SSC Exam Platform

A full-stack exam preparation platform for SSC (Staff Selection Commission) aspirants.

## Stack

- **Frontend**: React 19 + Vite, Tailwind CSS v4, shadcn/ui, TanStack Query, Wouter
- **Backend**: Express 5, Drizzle ORM, PostgreSQL
- **Auth**: Custom JWT (HS256 via HMAC, stored in `sessionStorage`)
- **Monorepo**: pnpm workspaces

## Structure

```
artifacts/
  exam-platform/   # React/Vite frontend
  api-server/      # Express API server
lib/
  db/              # Drizzle schema + DB client
  api-zod/         # Zod schemas shared between FE and BE
  api-client-react/ # Generated API client hooks
```

## Running locally

Both services start automatically via Replit workflows:

| Service | Workflow | Command |
|---------|----------|---------|
| API server | `artifacts/api-server: API Server` | `pnpm --filter @workspace/api-server run dev` |
| Frontend | `artifacts/exam-platform: web` | `pnpm --filter @workspace/exam-platform run dev` |

## Required secrets

| Variable | Description |
|----------|-------------|
| `SESSION_SECRET` | JWT signing secret (already set) |
| `DATABASE_URL` | PostgreSQL connection string |

## Role hierarchy

```
student  →  admin  →  super_admin
```

- **student**: can take exams, view results, bookmarks, notes
- **admin**: all student access + admin portal (exam/question/user management)
- **super_admin**: all admin access + Super Admin Control Panel

## RBAC notes

- `requireAuth` middleware always re-validates the user's **current role from the database** — role changes take effect immediately without a re-login.
- `requireAdmin` allows both `admin` and `super_admin`.
- `requireSuperAdmin` is for super-admin-only API endpoints.
- Frontend route guard: `adminOnly` allows `admin`+`super_admin`; `superAdminOnly` allows only `super_admin`.

## Database migrations

```bash
cd lib/db
pnpm drizzle-kit push   # push schema to DB
pnpm drizzle-kit studio # open Drizzle Studio
```

## User preferences

<!-- Add any project-level conventions here -->
