const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    // VirtualViewNativeComponent.js and VirtualViewExperimentalNativeComponent.js
    // crash @react-native/babel-plugin-codegen because the Flow parser can't resolve
    // the NativeModeChangeEvent type alias. Redirect both to a safe stub.
    // The import is relative (./VirtualViewExperimentalNativeComponent) so we match
    // on the filename directly, not the full path.
    if (
      moduleName.includes("VirtualViewNativeComponent") ||
      moduleName.includes("VirtualViewExperimentalNativeComponent")
    ) {
      return {
        filePath: path.resolve(
          __dirname,
          "stubs/VirtualViewNativeComponentStub.js"
        ),
        type: "sourceFile",
      };
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
