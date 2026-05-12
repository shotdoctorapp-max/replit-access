# Threat Model

## Project Overview

Shot Doctor is a pnpm monorepo with an Expo mobile client, a small React landing page, and an Express 5 API backed by PostgreSQL/Drizzle. The production system lets users sign in with Clerk, upload or record basketball shot videos, and send extracted frames to OpenAI-backed analysis endpoints that return biomechanics feedback.

## Assets

- **User accounts and sessions** — Clerk identities and any session material accepted by the API. Compromise would let an attacker impersonate users.
- **Paid / quota-limited analysis capacity** — OpenAI-backed analysis calls are the core monetizable resource. Abuse can create direct cost and service degradation.
- **User-submitted content** — video frames, derived analysis, bug reports, and waitlist emails. These contain personal data and app usage details.
- **Administrative data** — waitlist exports, bug-report contents, and operational views exposed through `/api/admin/*`.
- **Application secrets** — `CLERK_SECRET_KEY`, `ADMIN_SECRET`, `RESEND_API_KEY`, database credentials, and OpenAI integration keys.

## Trust Boundaries

- **Mobile / browser to API** — all client input is untrusted. The API must authenticate and authorize protected actions server-side.
- **API to OpenAI integration** — public requests can trigger paid model calls. The server must enforce quota, abuse controls, and size bounds before forwarding user-supplied content.
- **API to PostgreSQL** — bug reports, waitlist signups, and admin data access cross this boundary.
- **Public to admin boundary** — `/api/admin/*` data routes are more sensitive than public landing, waitlist, and analysis routes and must be protected independently of the client UI.
- **Public internet to production static server** — `artifacts/mobile/server/serve.js` constructs landing/deep-link responses from request metadata and must not trust inbound headers blindly.
- **Production vs dev-only artifacts** — `artifacts/mockup-sandbox/` is dev-only under current assumptions and should usually be ignored unless a production path explicitly serves it.

## Scan Anchors

- **Production entry points:** `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/*.ts`, `artifacts/mobile/server/serve.js`, `artifacts/landing/src/components/WaitlistForm.tsx`, `artifacts/mobile/app/(tabs)/index.tsx`, `artifacts/mobile/components/BugReportSheet.tsx`
- **Highest-risk areas:** public analysis routes (`analyze.ts`, `analyze-video.ts`), admin routes (`admin.ts`), auth/proxy handling (`clerkProxyMiddleware.ts`), public write endpoints (`waitlist.ts`, `bug-reports.ts`)
- **Public surfaces:** `/api/healthz`, `/api/waitlist`, `/api/bug-reports`, `/api/analyze`, `/api/analyze-video`, mobile landing server root
- **Protected surfaces:** `/api/admin/bug-reports`, `/api/admin/waitlist`, `/api/admin/waitlist/export.csv` via `x-admin-secret`
- **Dev-only areas:** `artifacts/mockup-sandbox/**`, build scripts and local tooling unless shown to be production-reachable

## Threat Categories

### Spoofing

User-facing authenticated flows rely on Clerk. Any endpoint that acts on user identity or user-owned data must derive identity from verified server-side Clerk state, not from client-local state or UI gating.

Administrative routes use a shared `ADMIN_SECRET` header rather than per-user identities. Those routes must reject unauthorized requests consistently and avoid exposing sensitive data through adjacent public paths.

### Tampering

All request bodies, headers, and route parameters are attacker-controlled. The API must validate public input before writing to PostgreSQL or forwarding data to external services, and the mobile client cannot be treated as an enforcement point for quotas or business rules.

### Information Disclosure

Waitlist emails, bug reports, device metadata, and any admin exports must only be available through properly protected server routes. Logs and API error paths must not leak credentials, cookies, or internal secrets.

### Denial of Service

The most important availability risk is unauthenticated or weakly gated access to expensive AI analysis endpoints and other public write endpoints. Production guarantees must include request-size bounds, abuse throttling, and server-side quotas for any route that creates material cost or load.

### Elevation of Privilege

The main privilege boundary is public users versus admin data access. Sensitive admin functions must not rely on frontend hiding alone, and shared-secret protection must be robust against guessing, replay, and accidental leakage.
