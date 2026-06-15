---
name: EAS async-storage codegen fix
description: Why and how to fix "TypeError: expand is not a function" from @react-native/codegen when building for iOS via EAS
---

## The Rule
Delete `NativeAsyncStorageModule.ts` from async-storage (all install locations) via postinstall + EAS `prebuildCommand`. Do NOT try to patch the file content.

## Why
- Locally: `@react-native/codegen` resolves `glob` to its nested `node_modules/glob@7.2.3` (created by pnpm due to version conflict with root glob@13). Codegen works fine.
- On EAS: pnpm may not create that nested glob installation, causing `@react-native/codegen` to use root glob@13 → different minimatch chain → `TypeError: expand is not a function` during `glob.sync()` with brace-expansion patterns.
- The codegen ONLY processes files matching `/extends TurboModule/`. Deleting the spec file means the codegen finds no spec for async-storage, returns empty modules (console.warn only, no exception). Pre-generated C++ bindings in `common/native/` handle New Architecture.

## How to Apply
1. `patch-native-modules.js` at workspace root — deletes spec from BOTH `node_modules/` (root, 1.24.0) AND `artifacts/mobile/node_modules/` (nested, 2.2.0 when version conflict exists)
2. Root `package.json` has `"postinstall": "node patch-native-modules.js"` — runs after local `pnpm install`
3. `artifacts/mobile/eas.json` has `"prebuildCommand": "node ../../patch-native-modules.js"` in all build profiles — EAS may skip postinstall; prebuildCommand runs explicitly before `expo prebuild`
4. async-storage version: use 2.2.0 (what Expo SDK 54 expects). Both versions have the same spec file issue.
5. Do NOT use pnpm patches (`pnpm.patchedDependencies`) — patching content of the file is insufficient and pnpm may not apply patches on EAS.
