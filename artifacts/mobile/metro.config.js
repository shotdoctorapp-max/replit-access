const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);
const clerkExpoRoot = path.dirname(require.resolve("@clerk/expo/package.json"));

config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    // Expo's Clerk package re-exports Clerk React hooks, but its web bridge
    // maintains a separate provider assertion. Route all web imports through
    // the browser package so hooks and the web provider share one context.
    if (platform === "web" && moduleName === "@clerk/expo") {
      return {
        filePath: path.resolve(__dirname, "stubs/ClerkExpoWeb.js"),
        type: "sourceFile",
      };
    }

    if (platform === "web" && moduleName === "@clerk/expo/token-cache") {
      return {
        filePath: path.resolve(__dirname, "stubs/ClerkTokenCacheWeb.js"),
        type: "sourceFile",
      };
    }

    // @clerk/expo imports this module with an explicit .js extension. Metro
    // therefore cannot apply its normal .web.js platform resolution and tries
    // to load the native TurboModule in browsers. Clerk ships a web stub, so
    // use it only for the browser bundle.
    if (
      platform === "web" &&
      moduleName === "../specs/NativeClerkModule.js"
    ) {
      return {
        filePath: path.join(
          clerkExpoRoot,
          "dist/specs/NativeClerkModule.web.js",
        ),
        type: "sourceFile",
      };
    }

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
