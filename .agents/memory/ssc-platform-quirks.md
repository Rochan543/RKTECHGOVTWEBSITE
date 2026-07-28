---
name: SSC Platform build quirks
description: Non-obvious environment and build issues specific to this SSC Exam Platform monorepo
---

## esbuild cannot resolve `zod/v4` subpath

API server routes that import `import { z } from "zod/v4"` will fail the esbuild bundle step. Use `import { z } from "zod"` instead, and add `"zod": "catalog:"` to `artifacts/api-server/package.json` dependencies.

**Why:** esbuild bundles all deps; subpath exports like `zod/v4` are not resolvable without extra esbuild config.

**How to apply:** Any time a new API route file is added that needs Zod, import from `"zod"` not `"zod/v4"`.

## `customFetch` must be re-exported from api-client-react index

`lib/api-client-react/src/custom-fetch.ts` defines `customFetch` but the original `index.ts` only exported `setBaseUrl` and `setAuthTokenGetter`. Frontend pages that call `customFetch` directly will get a Vite runtime error. Fixed by adding `customFetch` to the named exports in `lib/api-client-react/src/index.ts`.

**Why:** Pages like `bookmarks.tsx`, `settings.tsx`, `wrong-answers.tsx` use `customFetch` directly rather than the generated hooks.

## DATABASE_URL is runtime-managed by Replit

`DATABASE_URL` is injected automatically by Replit's runtime — it does NOT need to be set manually. Attempting to set it will error. The drizzle config and `lib/db/src/index.ts` both read it at startup.

**How to apply:** To push schema changes: `cd lib/db && pnpm run push`.
