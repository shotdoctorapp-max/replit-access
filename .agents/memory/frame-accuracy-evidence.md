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