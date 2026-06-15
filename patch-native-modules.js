#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const SPEC_FILENAME = 'NativeAsyncStorageModule.ts';
const PACKAGE_SUBPATH = `@react-native-async-storage/async-storage/src/${SPEC_FILENAME}`;

const locations = [
  path.join(__dirname, 'node_modules', PACKAGE_SUBPATH),
  path.join(__dirname, 'artifacts/mobile/node_modules', PACKAGE_SUBPATH),
];

let deleted = 0;
for (const target of locations) {
  if (fs.existsSync(target)) {
    fs.unlinkSync(target);
    console.log(`[patch-native-modules] Deleted ${target}`);
    deleted++;
  }
}

if (deleted === 0) {
  console.log('[patch-native-modules] NativeAsyncStorageModule.ts not found in any location, nothing to do');
} else {
  console.log(`[patch-native-modules] Done — deleted ${deleted} file(s). Codegen will skip async-storage (pre-generated bindings used instead).`);
}
