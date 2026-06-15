const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withAsyncStorageFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const workspaceRoot = path.resolve(projectRoot, '../..');

      const candidates = [
        path.join(workspaceRoot, 'node_modules/@react-native-async-storage/async-storage/src/NativeAsyncStorageModule.ts'),
        path.join(projectRoot, 'node_modules/@react-native-async-storage/async-storage/src/NativeAsyncStorageModule.ts'),
      ];

      for (const file of candidates) {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          console.log(`[withAsyncStorageFix] Deleted ${file}`);
        }
      }

      return config;
    },
  ]);
};

module.exports = withAsyncStorageFix;
