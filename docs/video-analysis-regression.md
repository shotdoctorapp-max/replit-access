# Video analysis investigation

## Findings and limits

Both supplied videos now complete the actual model → server handler → shared fetch/parser → mobile analysis-pipeline path. The prior evidence scorer rejects both returned analyses because `components.eyeTracking.score` is `null`, despite useful evidence for the other seven mechanics.

This confirms the current **evidence rejection**, not the precise historical Hermes exception. No native stack trace or historical raw iPhone response was supplied. We cannot honestly name the original throwing line/operand or prove which release last worked on the device. The supplied screenshot shows the newer friendly evidence alert, not the raw `in` error.

## Comparison boundary and relevant history

There is no verified last-working build/revision. This audit compares the parent of `20df44b` (the introduction of evidence-based scoring on October 24) through the previously pushed `a9e3e30`. It is an investigative boundary, **not** a claimed last-good release.

Reproducible commands:

```sh
git log --format='%h %as %s' 20df44b^..a9e3e30 -- artifacts/mobile artifacts/api-server lib/api-client-react lib/api-spec lib/api-zod
git diff 20df44b^..a9e3e30 -- artifacts/mobile artifacts/api-server lib/api-client-react lib/api-spec lib/api-zod
git diff 20df44b^..a9e3e30 -- '*package.json' pnpm-lock.yaml pnpm-workspace.yaml
```

Relevant commits, one line each:

| Revision | Change |
| --- | --- |
| `20df44b` | Introduced server-computed evidence scores and rejection of missing components, with stricter visible-evidence prompts and rhythm checks. |
| `fae2df6` | Allowed partial component results but suppressed the total when any component was unobservable; synchronized unscored UI behavior. |
| `2d6fe40` | Reintroduced rejection of missing scores except an explicitly hidden elbow; added weighted scoring, hand context, native picker changes and prepare/refine-release phases. |
| `46948c9` | Added the local iOS Pod deployment-target floor plugin; unrelated to response operands or missing eye evidence. |
| `28fd666` | Pinned the iOS build image to SDK 54 to address the separate pre-JavaScript launch crash. |
| `a9e3e30` | Added runtime object guards, JSON response parsing independent of Content-Type, schema-validated envelopes, JSON auth failures and friendly errors. |

File-level application/server changes across that boundary, one line each:

| File/area | Change |
| --- | --- |
| Server `lib/prompts.ts` | Added component evidence rubric, null-for-unseen guidance, handed elbow identification and stricter Release/rhythm cues. |
| Server `lib/scoring.ts` | Added server-owned score calculation, missing-evidence policies, weighted mechanics, elbow exclusion and rhythm validation. |
| Server `lib/frameSelection.ts` | Tightened image-based phase-selection guidance; existing object guards precede `in`. |
| Server `lib/releaseRefinement.ts` | Added separate preparation and 33ms wrist-flick verification. |
| Server `routes/analyze-video.ts` | Added prepare/refine modes, declared hand, supplied final phases, model parsing/validation and consistent JSON errors. |
| Server `routes/analyze.ts` | Added evidence scoring/hand context and schema validation for the shared photo endpoint. |
| Server `middlewares/analysisRateLimit.ts` | Added `ok:false` to JSON authentication/rate-limit responses. |
| Server `lib/videoResponse.ts` | Added validated success envelopes while retaining installed-client top-level phase fields. |
| Mobile home screen | Changed native picker representation, required hand, added preparation/refinement and response guards, and persisted authoritative frame positions. |
| Mobile analysis screen | Unified score/tier behavior, unscored mechanics and frame-position display. |
| Mobile History | Kept unknown totals neutral and out of score aggregates. |
| Mobile onboarding | Collected the player's declared shooting hand. |
| Mobile `FilmingTipsSheet` | Corrected modal dismissal/native picker handoff. |
| Mobile `FrameAnnotationOverlay` | Derived annotation treatment from scored evidence, not missing-score defaults. |
| Mobile `ScoreRing` | Displayed missing totals neutrally rather than as zero. |
| Mobile `SessionContext` | Preserved nullable totals and hand/elbow response metadata. |
| Mobile `utils/grading` | Centralized tier, issue, annotation and unscored color behavior. |
| Mobile `utils/shootingHand` | Required an explicit stored/player-selected shooting hand. |
| Mobile `utils/releaseRefinement` | Planned fine native seeks and merged verified Release without losing timestamp/annotation ownership. |
| Mobile `utils/videoFrames` | Kept frame extraction bounded, chronological and consistent for phase selection. |
| Mobile `utils/analysisErrors` | Mapped unexpected errors to friendly text instead of showing raw engine errors. |
| Mobile app configuration/plugin | Registered the local iOS Pod deployment-target fix. |
| Mobile build configuration | Changed the iOS build image to SDK 54. |
| Shared `custom-fetch` | Forced analysis JSON parsing and rejected primitives before UI property checks. |
| OpenAPI and generated client/Zod | Added hand/refinement request fields, nullable scores and additive validated response envelopes. |

The package/lockfile diff above is **empty**. There is no dependency-version change in this comparison to attribute the error to.

## `in` operator inventory

At the problematic `2d6fe40` revision, mobile home had:

| File and historical line | Expression | Operand |
| --- | --- | --- |
| `artifacts/mobile/app/(tabs)/index.tsx:468` | `"shotIndex" in location` | Result of generated locate-mode request. |
| Same file, line 479 | `"keyFrameIndices" in preparation` | Result of generated preparation request. |
| Same file, line 488 | `"releaseIndex" in refinement` | Result of generated release-refinement request. |
| Same file, line 499 | `"analysis" in data` | Result of generated final-analysis request. |

Those generated return types were compile-time assertions, not runtime checks. Shared fetch could return a string for text/missing Content-Type, or a JSON primitive/null. Applying `in` to such a value reproduces this **class** of JavaScript failure. `2d6fe40` introduced the two middle checks; locate/final checks predated it. There is no evidence establishing which operand the actual phone received.

Current analysis-flow operators:

| Location | Operand and protection |
| --- | --- |
| Mobile `utils/videoAnalysisPipeline.ts` | `"data" in error` and `"code" in error.data`, both preceded by non-null/non-array object checks. |
| Mobile `utils/analysisErrors.ts` | `"data" in error` after `error instanceof Error`; `"code" in error.data` after an object check. |
| Server `lib/frameSelection.ts` | `"indices" in value` in strict parser and explicit-uncertainty parser, both after object checks. |
| Server `lib/videoResponse.ts` | `"bestFrameIndex" in payload`, where payload is an internal object literal supplied by the route. |
| Generated API client mutation helpers | `"mutationKey" in options.mutation` checks caller-supplied mutation options; this flow calls the direct request function, not those mutation hooks. |

There is no `in` operator in the native picker/extractor, session persistence, or History/result rendering. The unrelated theme hook uses a known imported theme object. No evidence implicated third-party native URL/Blob code.

## Observed evidence rejection

The actual first clip's new raw model output contains:

```json
{
  "eyeTracking": {
    "score": null,
    "feedback": "Cannot assess eye tracking as the eyes are not clearly visible in the release frame."
  }
}
```

The second clip likewise returned an unscored eye-tracking component. Neither HEVC rotation nor variable frame rate explains that field-policy rejection; both files decoded and all locate/prepare/refine/final responses parsed successfully.

Replaying the same observed component evidence through each historical scorer produced:

| Scorer revision | Outcome for a missing eye score |
| --- | --- |
| `20df44b` | Throws `ScoringEvidenceError`. |
| `fae2df6` | Returns available components with `overallScore:null`. |
| `2d6fe40` | Throws `ScoringEvidenceError` again. |
| `a9e3e30` | Still throws `ScoringEvidenceError`; response safety did not change that policy. |
| Current implementation | Computes a weighted score using only the seven observed components; no zero or invented eye score. |

The rejecting condition was `artifacts/api-server/src/lib/scoring.ts:42–44` at `a9e3e30`; the route converted it to HTTP 422 at `routes/analyze-video.ts:403–405`. Reintroduction in `2d6fe40` explains this policy regression relative to `fae2df6`. It does **not** prove the cause of the earlier Hermes exception.

## Implemented behavior

- Grade valid observed mechanics only; exclude unknown mechanics and independently unreliable rhythm, preserving existing weights and rounding.
- Normalize omitted unscored components to null with factual visibility feedback; reject corrupt numeric scores rather than coercing them.
- Default optional advice arrays safely, validate model output and return capture-quality issues, 1–3 prioritized tips and derived high/medium/low confidence.
- Reject no-person/no-shot/no-gradable-evidence content honestly; provider/network/invalid response failures remain errors.
- Fall back to genuinely available chronological frames when explicit phase uncertainty or sparse extraction prevents a complete sequence; label the representative image “Available frame,” never a guessed Dip/Release.
- Validate final responses before reading them. Keep final errors readable, including malformed JSON requests, and prevent final envelopes falling through a permissive phase schema.
- Preserve compatibility fields needed by installed clients. New clients persist confidence/capture quality, show filming guidance for medium/low confidence and label low-confidence History entries.
- Preserve legacy sessions and null-score display/aggregate behavior; avoid conditional hooks when a saved result loads after navigation/reload.

## Clip test results

| Input | Decode/request path | Score | Confidence | Evidence coverage | Outcome |
| --- | --- | --- | --- | --- | --- |
| `IMG_4484` | HEVC portrait, 30fps; locate → prepare → refine → analyze | 73 | Medium | 7/8 | HTTP 200, valid final response and filming tip; eyes unscored. |
| `IMG_2988` | HEVC portrait, variable ~27.6fps; same pipeline | 67 | Medium | 7/8 | HTTP 200, valid final response and filming tip; eyes unscored. |
| Third distinct control | Not supplied | — | — | — | Not run; the user confirmed both supplied clips worked before. |

Both test settings used the user's declared **right** shooting hand. These are one live analysis per clip, not retries selected to obtain a desirable score.

### Test scope

The diagnostic adapter used FFmpeg JPEG extraction at the same planned seek times, the real model/provider, actual post-auth route handler, serialized HTTP-like response text/status, generated request/shared fetch parsing and the mobile pipeline. Temporary diagnostics captured extraction metadata, request shape with image bytes removed, raw model JSON and serialized response in `/tmp` only. The adapter and verbose instrumentation were removed.

This is **not** native Photos/Files, Expo thumbnail decoding, a physical iPhone Hermes stack trace, actual HTTP auth/proxy coverage for the model calls, or proof of source-frame presentation timestamps. Requested seeks are not decoded PTS. Do not describe it as TestFlight end-to-end verification.

Separate proxy requests confirmed JSON 401 for unauthenticated analysis and JSON 400 for malformed request JSON. Automated scoring, schema, partial-phase and response regression tests passed. The workspace-wide typecheck remains blocked by pre-existing errors in the unrelated OpenAI integration (`pRetry.AbortError` and possibly undefined image data); the mobile/shared API types pass and the API server builds/starts.

### Saved-result browser verification

A single automated phone-sized browser pass verified:
- The real `IMG_4484` result shows 73, medium confidence, 7/8 mechanics and filming advice.
- A separately labeled low-confidence UI fixture shows its label in History and retains confidence, tips and score after refresh/reopening.
- A legacy session without either new field still opens and retains its old score.
- Null eye tracking renders “Unscored,” not zero, with no JavaScript page error.

These sessions were seeded in an isolated browser context; this verifies persistence/read/render behavior, **not** native upload or the actual native save/copy transaction. The low-confidence fixture is not an additional live clip result. Both iOS and Android JavaScript/Hermes exports also completed; those are bundle checks, not signed native builds or physical-device tests.
