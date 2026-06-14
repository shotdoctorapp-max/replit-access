---
name: EAS Build + pnpm monorepo lessons
description: Hard-won fixes for EAS Build working with this pnpm workspace monorepo
---

# EAS Build + pnpm Monorepo — Lessons Learned

**Why:** These issues caused repeated EAS Build failures and took significant debugging to resolve.

## 1. Runtime packages must be in `dependencies`, not `devDependencies`
EAS production builds run with `NODE_ENV=production`, causing pnpm to skip `devDependencies`. All packages imported by Metro (expo-*, react-native-*, @clerk/expo, etc.) must be in `dependencies`. Only TypeScript types, Babel, @expo/cli belong in `devDependencies`.

**File:** `artifacts/mobile/package.json`

## 2. Remove expo-router from app.json plugins
expo-router v6 has no config plugin file. Listing it in `plugins` causes EAS CLI to crash during local validation before the build even uploads.

**File:** `artifacts/mobile/app.json` — `"plugins": []`

## 3. VirtualView codegen fix — match on filename, not full path
`@react-native/babel-plugin-codegen` crashes on `VirtualViewNativeComponent.js` and `VirtualViewExperimentalNativeComponent.js` in react-native 0.81.5. These are imported with relative paths (`./VirtualViewExperimentalNativeComponent`), so the metro `resolveRequest` pattern must match the filename directly, NOT the directory path.

**File:** `artifacts/mobile/metro.config.js` — check `moduleName.includes("VirtualViewNativeComponent") || moduleName.includes("VirtualViewExperimentalNativeComponent")`

## 4. No stray package-lock.json at repo root
If a `package-lock.json` exists alongside `pnpm-lock.yaml`, EAS (and expo doctor) treats it as a package manager conflict and aborts. Delete any `package-lock.json` not in `node_modules/`.

## 5. node_modules/.bin missing after merged task
After the vulnerability fixes task merged and changed `pnpm-workspace.yaml`, the `.bin` directory disappeared (pnpm install was interrupted). Fixed by manually creating symlinks (`node_modules/.bin/expo → ../expo/bin/cli`). Real fix is letting `pnpm install` complete fully.
