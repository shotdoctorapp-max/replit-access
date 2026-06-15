#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const PATCHED_SPEC = `import type { TurboModule } from "react-native";
import { TurboModuleRegistry } from "react-native";

export interface Spec extends TurboModule {
  multiGet: (
    keys: string[],
    callback: (error?: Object[], result?: Object[]) => void
  ) => void;
  multiSet: (
    kvPairs: Object[],
    callback: (error?: Object[]) => void
  ) => void;
  multiRemove: (
    keys: string[],
    callback: (error?: Object[]) => void
  ) => void;
  multiMerge: (
    kvPairs: Object[],
    callback: (error?: Object[]) => void
  ) => void;
  getAllKeys: (
    callback: (error?: Object[], result?: string[]) => void
  ) => void;
  clear: (callback: (error?: Object[]) => void) => void;
}

export default TurboModuleRegistry.get<Spec>("RNCAsyncStorage");
`;

const target = path.join(
  __dirname,
  'node_modules/@react-native-async-storage/async-storage/src/NativeAsyncStorageModule.ts'
);

if (fs.existsSync(target)) {
  fs.writeFileSync(target, PATCHED_SPEC, 'utf8');
  console.log('[patch-native-modules] Patched NativeAsyncStorageModule.ts for codegen compatibility');
} else {
  console.log('[patch-native-modules] NativeAsyncStorageModule.ts not found at expected path, skipping');
}
