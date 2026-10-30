# Evidence-based shot scoring

## Diagnosis

Previously, the video endpoint rounded `0.85 × model overallScore + 0.15 × rhythmScore`.
It never derived that overall score from the eight returned component scores. The UI only
maps the final number to a tier; tier thresholds cannot explain repeated numeric model totals.
The prompt also told the model to score all eight mechanics from Set Point, including
post-release mechanics, while the other phases were supplied as low-detail annotation images.
These are confirmed code paths, not proof of the frequency of clustering in historical sessions:
component outputs from the reported device session are not available.
An initial live diagnostic also repeated canned output-template diagnoses, including an
incomplete wrist finish despite a visible snapped wrist and foot-placement claims on a
cropped image. Those leading component examples were removed; output fields now ask for
phase-specific observations rather than sample flaws. Numeric stability alone is not
evidence that a diagnosis is correct.

## Formula

All eight components have equal weight in the biomechanics mean:
stance, hip alignment, elbow position, grip, set point, follow-through, balance, eye tracking.

- Without reliable rhythm: `round(sum(component scores) / 8)`.
- With reliable rhythm: `round((sum(component scores) / 8) × 0.85 + rhythmScore × 0.15)`.
- Thus each component contributes 12.5% without rhythm, or 10.625% with rhythm.
- Round once, at the end. Scores may have fractional values.
- Never use a tier, desired overall score, or model-written overall score as an input.

This preserves the existing 15% rhythm contribution without inventing unequal component
importance. Logs contain only numeric component scores, the unrounded mean, final total,
and whether rhythm was included. They do not log images or coaching text.

## Evidence requirements

Each component must contain a finite score in [0,100] or explicit null, with nonempty feedback.
No coercion, zero/default fill, or denominator changes are allowed. Unassessable components
retain null and explain missing evidence; assessable components are returned normally.
If any component is null, overallScore is null, even when rhythm is available.
The app displays Unscored rather than a tier or zero for the total, preserves these sessions
on reload, and excludes null totals from average/best statistics. Malformed or unexplained
component objects still cause a 422 response. Saved numeric totals are not rewritten.

Rhythm is included only if its original Dip/Set Point/Release indices match the selected
shot, its pattern is known, observations are present, its score is finite and bounded, and both motion indices exist
within the supplied shot. Invalid/unknown rhythm is omitted, and biomechanics gets 100%.
The summary receives rhythm context only after this check.

The production video model is unchanged. Video rhythm and biomechanics requests now use
temperature 0. That reduces sampling variation, but does not guarantee identical model
outputs across providers or model updates. Identical validated inputs always yield the same
total (zero aggregation tolerance). Live model stability must be measured separately; a
working monitoring tolerance is a range of at most 5 points per component and 3 points in
the total over three identical requests, not permission to add noise or hide larger drift.

Only new analyses use this calculation. No saved session is recalculated or migrated.

## Calibration

The calibration probe uses the two available May reference clips with fixed, manually
inspected phase samples, not the unavailable original TestFlight video. The first shows the
full body, but has dim, blurred hands/face; the second crops the feet/lower body. Neither
establishes measured gaze, spin, exact arc or shot outcome. Treat unavailable evidence as
unscored rather than asserting a ground-truth numeric ranking between these clips.

The probe repeats exactly the same supplied JPEGs three times at temperature 0, records
component scores/feedback, and reports component and total ranges. It isolates biomechanics
from frame selection and rhythm so that their variability cannot be mistaken for score drift.
It is diagnostic, not an automatic golden-score test. Run:

`pnpm --filter @workspace/scripts exec tsx src/score-calibration-probe.ts`

### Current live findings

After removing leading examples, the repeated three-frame samples correctly left eye
tracking unscored in both clips and stance unscored in the cropped clip. Consequently
both clips now return partial analyses with null overall totals. We cannot
claim a validated numeric ranking or total-score stability from these samples.

Before the final temporal-evidence instruction, the full-body clip's largest component
range was 7 points (Set Point), exceeding the proposed 5-point monitoring tolerance;
the cropped clip's largest range was 5 points. The model claimed an unsupported arm drop.
After explicitly prohibiting that inference, a further three-run probe measured a maximum
component range of 5 points on the full-body clip and zero on the cropped clip. Missing
gaze/feet remained correctly unscored. However, the full-body clip again received claims
of incomplete wrist snap/extension despite the inspected Release image showing both.
Thus repeatability improved in this small probe, but semantic calibration is not complete.
These findings are limitations, not evidence that remaining component judgments are ground truth.
Clearer, independently annotated footage is required before claiming semantic accuracy
or stable, explainably different overall totals.
