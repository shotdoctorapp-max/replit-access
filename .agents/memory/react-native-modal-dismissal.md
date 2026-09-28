---
name: React Native modal dismissal across platforms
description: Native dismissal callbacks differ on iOS and Android in this project's React Native version.
---

React Native 0.81's `Modal.onDismiss` is implemented on iOS only; do not rely on it to open a second native dialog after closing a modal on Android.

**Why:** Presenting native upload choices in the same press handler that hides a modal can race with dismissal and leave the app unresponsive. Reading the installed React Native implementation showed Android does not invoke that callback.

**How to apply:** Wait for the actual `onDismiss` callback on iOS. On Android, with no modal closing animation, defer the next native presentation until after the hidden modal's render has committed and the UI has had frames to remove it. Guard duplicate presses and keep any pending presentation separate from plain cancellation.