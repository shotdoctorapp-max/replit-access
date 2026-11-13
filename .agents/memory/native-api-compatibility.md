---
name: Native API response compatibility
description: Preserve installed-client response shapes when adding analysis envelopes.
---
Keep existing top-level phase-selection fields when adding an analysis response envelope; do not move the final biomechanics object into another nested result.

**Why:** An API release immediately affects already-installed native binaries, which cannot acquire a matching response-parser change from a backend deployment. New envelope fields must be additive until an explicit client migration.

**How to apply:** Check both the current mobile parser and older flat phase/result contracts before changing video-analysis responses. A passing workspace test cannot establish what response a particular TestFlight session actually received.
