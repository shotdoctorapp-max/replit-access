#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const SPEC_FILENAME = 'NativeAsyncStorageModule.ts';
const SPEC_SUBPATH = path.join('@react-native-async-storage', 'async-storage', 'src', SPEC_FILENAME);
const PNPM_PKG_PREFIX = '@react-native-async-storage+async-storage@';

function collectCandidates(root) {
  const candidates = [];

  // 1. Hoisted / flat install (npm, pnpm hoisted)
  candidates.push(path.join(root, 'node_modules', SPEC_SUBPATH));

  // 2. All .pnpm virtual-store instances (default pnpm symlink layout)
  const pnpmDir = path.join(root, 'node_modules', '.pnpm');
  if (fs.existsSync(pnpmDir)) {
    let entries = [];
    try { entries = fs.readdirSync(pnpmDir); } catch (_) {}
    for (const entry of entries) {
      if (entry.startsWith(PNPM_PKG_PREFIX)) {
        candidates.push(
          path.join(pnpmDir, entry, 'node_modules', SPEC_SUBPATH)
        );
      }
    }
  }

  return candidates;
}

const roots = [
  __dirname,
  path.join(__dirname, 'artifacts', 'mobile'),
];

let deleted = 0;
for (const root of roots) {
  for (const target of collectCandidates(root)) {
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
      console.log(`[patch-native-modules] Deleted ${target}`);
      deleted++;
    }
  }
}

if (deleted === 0) {
  console.log('[patch-native-modules] NativeAsyncStorageModule.ts not found in any location, nothing to do');
} else {
  console.log(`[patch-native-modules] Done — deleted ${deleted} file(s). Codegen will skip async-storage (pre-generated bindings used instead).`);
}
