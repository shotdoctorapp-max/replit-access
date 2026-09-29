---
name: Frame accuracy evidence
description: Distinguish sample positions from source-frame accuracy when evaluating shot phases.
---

Never equate a selected sample index or requested Expo thumbnail timestamp with an exact decoded source frame.

**Why:** The reference clips include variable timing, cropped knees, and blurred fingertip contact. At 30fps, ±2 source frames is about 67ms, whereas ±2 samples at 10fps is 200ms. Expo thumbnail seeks do not expose actual decoded-frame PTS.

**How to apply:** Define the index convention, inspect source PTS and independently annotate phase intervals before claiming accuracy. Separate deterministic parser/mapping tests from live model semantic accuracy; quota-blocked calls cannot establish a before/after accuracy result.

A second vision pass over every remaining post-Set-Point image is not inherently safer: on a reference shot it chose a later ball return even though an earlier separated follow-through was visible.

**Why:** A model can mistake "ball separate from hand" during a rebound or return for the first shooting release, even under a strict visual prompt.

**How to apply:** Evaluate the first release transition and neighboring samples rather than treating any later gap as a release. If the transition is unclear, fail explicitly; don't assume a later separated frame is correct. Continue distinguishing requested seek positions from decoded source-frame PTS.

Do not infer that a TestFlight analysis used the current workspace's API just because the fix is merged.

**Why:** On September 29, 2026, the production selection logs matched the screenshot's phase positions but did not contain the independent verification log that the workspace code always emits. A successful merge was not evidence that the published service had that change.

**How to apply:** Correlate the reported session's timestamp and phase indices with production logs, check for version-specific behavior, and confirm the API has been republished before judging a fix on a fresh TestFlight session. A saved session can still show old selected thumbnails.