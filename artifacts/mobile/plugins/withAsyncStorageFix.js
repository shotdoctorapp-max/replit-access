const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SPEC_SUBPATH = path.join('@react-native-async-storage', 'async-storage', 'src', 'NativeAsyncStorageModule.ts');
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

const withAsyncStorageFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const workspaceRoot = path.resolve(projectRoot, '../..');

      const roots = [workspaceRoot, projectRoot];
      let deleted = 0;

      for (const root of roots) {
        for (const target of collectCandidates(root)) {
          if (fs.existsSync(target)) {
            fs.unlinkSync(target);
            console.log(`[withAsyncStorageFix] Deleted ${target}`);
            deleted++;
          }
        }
      }

      if (deleted === 0) {
        console.log('[withAsyncStorageFix] NativeAsyncStorageModule.ts not found, nothing to do');
      }

      return config;
    },
  ]);
};

module.exports = withAsyncStorageFix;
