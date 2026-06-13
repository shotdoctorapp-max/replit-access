---
name: expo-router/unstable-native-tabs crash
description: Importing from expo-router/unstable-native-tabs chains to react-native-bottom-tabs at module load time; if that package isn't installed, the entire JS bundle crashes silently (blank white screen).
---

**Rule:** Never import from `expo-router/unstable-native-tabs` unless `react-native-bottom-tabs` is explicitly installed as a dependency.

**Why:** The module's build (`native-tabs/index.js`) unconditionally requires `NativeBottomTabsNavigator` which pulls in `react-native-bottom-tabs`. Metro bundles the full import graph regardless of whether the component is rendered. If `react-native-bottom-tabs` is missing, the app shows a blank white screen with no JS error thrown to the error boundary — the crash happens at module evaluation level, before React mounts.

**How to apply:** If you see a blank white screen after Clerk loads but before any component renders (and no error boundary fires), check for imports from `unstable-native-tabs` in layout files. Remove them (and any dead components using them) if `react-native-bottom-tabs` isn't installed.
