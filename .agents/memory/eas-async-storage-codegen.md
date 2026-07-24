---
name: EAS async-storage codegen fix
description: Why and how to fix "TypeError: expand is not a function" from @react-native/codegen when building for iOS via EAS or locally
---

## The Rule
Delete `NativeAsyncStorageModule.ts` from async-storage (all install locations). Three layers of defence:
1. `postinstall` script (root `package.json`)
2. EAS `prebuildCommand` in `eas.json`
3. Expo config plugin `artifacts/mobile/plugins/withAsyncStorageFix.js` — fires during `expo prebuild`, handles local AND EAS builds automatically

Do NOT try to patch the file content.

## Why
- Locally: `@react-native/codegen` resolves `glob` to its nested `node_modules/glob@7.2.3` (created by pnpm due to version conflict with root glob@13). Codegen works fine.
- On EAS: pnpm may not create that nested glob installation, causing `@react-native/codegen` to use root glob@13 → different minimatch chain → `TypeError: expand is not a function` during `glob.sync()` with brace-expansion patterns.
- **Confirmed July 2026:** with the global `glob: ^7.2.3` override in place, the same error came from a different override conflict — a global `brace-expansion: ^5.0.6` pin forced v5 under glob@7's minimatch@3. See eas-pnpm-lessons.md lesson 9 for the per-major pin fix. Deleting the async-storage spec remains correct as defence for its separate spec-parsing crash.
- The codegen ONLY processes files matching `/extends TurboModule/`. Deleting the spec file means the codegen finds no spec for async-storage, returns empty modules (console.warn only, no exception). Pre-generated C++ bindings in `common/native/` handle New Architecture.

## How to Apply
1. `patch-native-modules.js` at workspace root — deletes spec from BOTH `node_modules/` (root) AND `artifacts/mobile/node_modules/` (nested when version conflict exists)
2. Root `package.json` has `"postinstall": "node patch-native-modules.js"` — runs after local `pnpm install`
3. `artifacts/mobile/eas.json` has `"prebuildCommand": "node ../../patch-native-modules.js"` in all build profiles — belt-and-suspenders for EAS
4. `artifacts/mobile/plugins/withAsyncStorageFix.js` — Expo config plugin registered in `app.json`; deletes spec during `expo prebuild` using `modRequest.projectRoot` to find both workspace-root and mobile-local node_modules. This is the primary fix for local builds — no manual script step required.
5. async-storage version: use 2.2.0 (what Expo SDK 54 expects).
6. Do NOT use pnpm patches (`pnpm.patchedDependencies`) — patching content of the file is insufficient and pnpm may not apply patches on EAS.

## Local Build Steps (no EAS)
From workspace root (`shotdoctor/`):
1. `pnpm install` — postinstall deletes spec
2. `cd artifacts/mobile && npx expo prebuild --platform ios --clean` — config plugin also deletes spec (redundant but safe)
3. `cd ios && pod install`
4. Open `*.xcworkspace` in Xcode → Product → Archive
