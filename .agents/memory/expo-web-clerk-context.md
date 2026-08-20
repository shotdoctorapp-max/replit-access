---
name: Expo web Clerk context
description: Browser-session compatibility requirements for Clerk inside this Expo app’s web preview.
---

# Expo web Clerk context

Use Clerk’s browser provider and Clerk React hooks for the Expo **web** bundle, while retaining Expo’s provider and token cache for iOS and Android. Metro must prevent the Expo package’s native Clerk module from being bundled on web.

**Why:** The Expo package’s compiled native-module import bypasses Metro’s normal web resolution, and its hook/provider bridge does not accept programmatically injected browser sessions. This can produce native-module errors or make an active browser Clerk session look signed out.

**How to apply:** When updating Clerk, Expo, or Metro, rerun a clean browser-context programmatic Clerk sign-in through onboarding to the authenticated Analyze tab. Keep native-specific provider/token-cache behavior isolated from the web compatibility layer.