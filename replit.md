# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Shot Doc — Mobile App

**Stack:** Expo SDK ~54, React Native, Express API server, OpenAI GPT-4 Vision  
**Theme:** Black (#000000) + Green (#00C853)  
**Version:** v2.1

### Auth — Clerk (Replit-managed)

- Provisioned via `setupClerkWhitelabelAuth()` — keys auto-set as secrets
- `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — auto-provisioned
- Mobile passes key via `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=$CLERK_PUBLISHABLE_KEY` in dev script
- Server: `clerkMiddleware` + `clerkProxyMiddleware` in `artifacts/api-server/src/app.ts`
- Mobile: `ClerkProvider` wraps root in `artifacts/mobile/app/_layout.tsx`
- Auth screens: `artifacts/mobile/app/(auth)/sign-in.tsx`, `sign-up.tsx`
- `(tabs)/_layout.tsx` redirects unauthenticated users to `/(auth)/sign-in`

### Token / Shots System

- **3 free shots** per user — tracked in AsyncStorage keyed by Clerk `userId`
- `artifacts/mobile/context/ShotsContext.tsx` — `useShots()` hook exposes `shotsRemaining`, `consumeShot()`
- Home screen shows shots bar with dots UI; tapping navigates to paywall
- Analysis gates behind shot check; on success calls `consumeShot()`
- Paywall: `artifacts/mobile/app/paywall.tsx` — layout only (payment integration TBD)

### Analysis (Video-only)

- **Photo analysis removed** — home screen is video-only
- Record Shot (primary green CTA) + Upload from library (secondary)
- Video: 8 frames extracted → AI selects best → biomechanics analyzed
- Frame display: `resizeMode: "contain"` on black background (shows full frame, no crop)
- Key files:
  - `artifacts/mobile/app/(tabs)/index.tsx` — home screen
  - `artifacts/mobile/app/analysis/[id].tsx` — analysis screen (body map, rhythm, frame strip)
  - `artifacts/mobile/context/SessionContext.tsx` — Session + RhythmAnalysis types; `feedback: string`
  - `artifacts/mobile/components/ComponentBar.tsx` — `parseBullets()` canonical split fn
  - `artifacts/api-server/src/lib/prompts.ts` — centralized AI prompts

### Important Notes

- `feedback` field on each component is a **single string** — parse with `parseBullets()` in ComponentBar
- `expo-file-system/legacy` must be used (not `expo-file-system`) for `readAsStringAsync`
- Frame selection fallback: rhythm indices unreliable; use percentage guards (Dip <45%, Set Point 40–80%)
- NEVER edit `artifact.toml` directly — use `.replit-artifact/artifact.edit.toml`
- API server localPort=8081, mobile localPort=18115
