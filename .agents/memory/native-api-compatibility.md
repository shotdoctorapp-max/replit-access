---
name: Native API response compatibility
description: Preserve installed-client response shapes when adding analysis envelopes.
---
Keep existing top-level phase-selection fields when adding an analysis response envelope; do not move the final biomechanics object into another nested result.

**Why:** An API release immediately affects already-installed native binaries, which cannot acquire a matching response-parser change from a backend deployment. New envelope fields must be additive until an explicit client migration.

**How to apply:** Check both the current mobile parser and older flat phase/result contracts before changing video-analysis responses. A passing workspace test cannot establish what response a particular TestFlight session actually received.

## Auth tokens during video analysis (Nov 2026)
- Clerk session tokens expire after ~60s. One analysis makes up to 4 sequential `/api/analyze-video` requests (locate, prepare, refine-release, analyze) with frame extraction and AI calls between them, so it often takes longer than 60s.
- Always call `getToken()` immediately before EACH request (`authorizedRequest` in `app/(tabs)/index.tsx`). Never fetch one token up front and reuse it: the later requests then arrive signed out (401, and before `requireAuth()` was removed, a redirect to an HTML sign-in page that caused "right operand of 'in' is not an object").
- The rate limit counts only `mode: "analyze"` as an analysis (20/hour); phase modes have a separate 80/hour budget.
- If a phase step fails for any reason other than 401/403/429/offline, the pipeline grades the available frames (`availableEvidence`) instead of failing.
