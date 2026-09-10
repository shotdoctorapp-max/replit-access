---
name: Expo web Clerk context
description: Browser-session compatibility requirements for Clerk inside this Expo app’s web preview.
---

# Expo web Clerk context

Use Clerk’s browser provider and Clerk React hooks for the Expo **web** bundle, while retaining Expo’s provider, hooks, and token cache for iOS and Android. Isolate providers and hook exports with `.web.tsx`/`.web.ts` files; do not import `@clerk/react` from shared native modules or alias the whole `@clerk/expo` package in Metro.

**Why:** Direct browser-package imports in shared modules can crash native launches. Aliasing Expo Clerk to browser Clerk can create duplicate provider contexts on web, causing hooks to report that they are outside `ClerkProvider`.

**How to apply:** Keep native and web Clerk imports behind platform-resolved provider and hook wrappers. After Clerk, Expo, or Metro changes, build iOS/Android/web and rerun a clean browser-context sign-in through onboarding.