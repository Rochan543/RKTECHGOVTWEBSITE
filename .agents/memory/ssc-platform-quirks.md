---
name: SSC Platform build quirks
description: Non-obvious environment and build issues specific to this SSC Exam Platform monorepo
---

## drizzle-zod v0.8.x returns zod v4 types — use `_output` not `z.infer`

`createInsertSchema` from drizzle-zod v0.8.x (with zod ≥3.25) returns a zod v4 `ZodObject` that does NOT satisfy the `ZodType<any, any, any>` constraint used by `z.infer`. Using `z.infer<typeof insertXxxSchema>` produces TS2344 errors across all schema files.

**Why:** Zod 3.25+ ships with the v4 API internally. drizzle-zod v0.8.x uses the new API. `z.infer`'s generic constraint is still the old v3 `ZodType<any, any, any>`, which the v4 types don't satisfy.

**How to apply:** Replace `z.infer<typeof schema>` with `(typeof schema)['_output']`. Works on both single-line and multi-line type exports. `_output` is a class property on all ZodType derivatives in both v3 and v4.

## esbuild cannot resolve `zod/v4` subpath

API server routes and DB schema files that import `import { z } from "zod/v4"` will fail the esbuild bundle step. Use `import { z } from "zod"` instead.

**Why:** esbuild bundles all deps; subpath exports like `zod/v4` are not resolvable without extra esbuild config.

**How to apply:** Any time a new route or schema file needs Zod, import from `"zod"` not `"zod/v4"`. This applies to `lib/db/src/schema/*.ts` files as well as `artifacts/api-server/src/`.

## `customFetch` must be re-exported from api-client-react index

`lib/api-client-react/src/custom-fetch.ts` defines `customFetch` but the original `index.ts` only exported `setBaseUrl` and `setAuthTokenGetter`. Frontend pages that call `customFetch` directly will get a Vite runtime error. Fixed by adding `customFetch` to the named exports in `lib/api-client-react/src/index.ts`.

**Why:** Pages like `bookmarks.tsx`, `settings.tsx`, `wrong-answers.tsx` use `customFetch` directly rather than the generated hooks.

## DATABASE_URL is runtime-managed by Replit

`DATABASE_URL` is injected automatically by Replit's runtime — it does NOT need to be set manually. Attempting to set it will error. The drizzle config and `lib/db/src/index.ts` both read it at startup.

**How to apply:** To push schema changes: `cd lib/db && pnpm run push`.

## pnpm `packageManager` field must match the Nix-installed version

The `packageManager` field in `package.json` (and workspace artifact `package.json` files) must exactly match the pnpm version installed by the Nix module. Replit detects a mismatch and tries to upgrade pnpm via `pnpm add pnpm@X.Y.Z --no-dangerously-allow-all-builds`, which fails with SIGABRT and blocks all workflows.

**Why:** Replit's pnpm bootstrapper reads `packageManager` and attempts a self-upgrade that can't build native modules.

**How to apply:** Run `pnpm --version` to find the installed version and keep `"packageManager"` in sync. As of the last check, Nix provides pnpm 10.26.1.

## Vite proxy target must match the API Server workflow PORT

`artifacts/exam-platform/vite.config.ts` proxies `/api` to a localhost target. This target must match the `PORT` env var in the API Server workflow (currently 8080). A mismatch means all API calls return connection-refused errors in dev.

**Why:** customFetch uses relative paths (`/api/...`) in the browser, which the Vite proxy forwards to the backend.

**How to apply:** If the API Server workflow PORT changes, update the proxy target in `vite.config.ts` to match.

## customFetch base URL must be empty in browser environments

`lib/api-client-react/src/custom-fetch.ts` used to fall back to `http://localhost:3000` when `VITE_API_URL` is not set. In a browser this creates absolute URLs that bypass the Vite proxy entirely. The fix is to return `""` when `typeof window !== "undefined"`, letting relative paths go through the proxy naturally.

## Express `trust proxy` must be set when running behind Replit's reverse proxy

Without `app.set("trust proxy", 1)`, `express-rate-limit` throws `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` on every request because Replit's proxy injects `X-Forwarded-For` but Express defaults to not trusting it.
