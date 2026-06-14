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
If a `package-lock.json` exists alongside `pnpm-lock.yaml`, EAS switches from pnpm to npm (`npm ci`) and fails on missing lockfile entries. Delete any `package-lock.json` not in `node_modules/`.
A failed `pnpm install --no-frozen-lockfile` (e.g. ENOTDIR crash mid-run) can silently regenerate a `package-lock.json` at the root. Always check with `ls . | grep lock` before retrying an EAS build after a failed local install.

## 6. Never update package.json version specs without regenerating the lockfile
Changing version specs (e.g. `~54.0.27` → `~54.0.35`) in `package.json` without running `pnpm install` breaks EAS's `--frozen-lockfile` check. Either: (a) revert specs to match the lockfile, or (b) run `pnpm install` successfully first. The expo-doctor patch-version warnings are non-blocking for EAS builds.

## 7. Root package.json must not contain runtime mobile deps
The monorepo root `package.json` must only hold workspace tooling (typescript, prettier, @types/react). Any expo/react-native packages in root dependencies (without react/react-native peers) causes EAS codegen to crash with `TypeError: expand is not a function` during pod install — codegen reads root package.json, finds react-native-safe-area-context/screens but no react or react-native peers. Also: `eas-cli` must never be in any workspace package.json; use `npx eas-cli@latest` instead.

## 5. node_modules/.bin missing after merged task
After the vulnerability fixes task merged and changed `pnpm-workspace.yaml`, the `.bin` directory disappeared (pnpm install was interrupted). Fixed by manually creating symlinks (`node_modules/.bin/expo → ../expo/bin/cli`). Real fix is letting `pnpm install` complete fully.

## 8. pnpm version conflicts create mobile-scoped node_modules that break EAS codegen
When `artifacts/mobile/package.json` pins a package to a DIFFERENT version than what another package in the monorepo requires, pnpm installs TWO copies: the shared version hoisted to root `node_modules/`, and the mobile-specific version in `artifacts/mobile/node_modules/`. On EAS, `expo prebuild` generates `react-native.config.js` pointing to the mobile-scoped copy. The react-native codegen then processes TypeScript spec files from that copy.

**Specific case:** `@react-native-async-storage/async-storage`
- Mobile specified `2.2.0` (exact pin) → installed at `artifacts/mobile/node_modules/`
- Something else needed `1.24.0` → installed at root `node_modules/`
- async-storage 2.2.0 has `src/NativeAsyncStorageModule.ts` which uses cross-file type imports (`ErrorLike` from `./types`) and `readonly string[]` syntax — features unsupported by `@react-native/codegen@0.81.5`
- Result: `TypeError: expand is not a function` during pod install on EAS
- The error does NOT reproduce locally (no `react-native.config.js` locally → codegen uses root node_modules path → 1.24.0 is processed → no TypeScript spec → no error)

**Fix:** Align the version in `artifacts/mobile/package.json` to match what's in root (e.g. `"1.24.0"` instead of `"2.2.0"`). This eliminates the version conflict, collapses to a single shared copy at root, and removes the problematic mobile-scoped installation.

**How to apply:** Any time EAS fails with `TypeError: X is not a function` in `[Codegen]` lines during pod install, check for native module packages with version conflicts between `artifacts/mobile/package.json` and what the lockfile resolves at root. Run `cat artifacts/mobile/node_modules/<package>/package.json | grep version` to see if the mobile-scoped copy is a different version with TypeScript spec files starting with `Native*.ts`.

**To diagnose:** Run `ls artifacts/mobile/node_modules/` — any real packages there (not just `@workspace` or `.bin`) indicate version conflicts. Check their `src/` or `src/specs/` for `Native*.ts` files.
