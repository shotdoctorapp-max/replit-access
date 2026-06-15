#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo ""
echo "=== [1/3] Deleting async-storage TurboModule spec ==="
node "$WORKSPACE_ROOT/patch-native-modules.js"

echo ""
echo "=== [2/3] Running expo prebuild (generates ios/) ==="
cd "$SCRIPT_DIR"
npx expo prebuild --platform ios --clean

echo ""
echo "=== [3/3] Running pod install ==="
cd "$SCRIPT_DIR/ios"
pod install

echo ""
echo "=== Done. Opening Xcode... ==="
open "$SCRIPT_DIR/ios/ShotDoctor.xcworkspace"
