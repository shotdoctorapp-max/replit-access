# Five-bug implementation and native acceptance

## Status
Code and local checks are implemented. No physical iPhone, EAS/TestFlight build, or on-device acceptance pass was available in this session. Expo web screenshots, unit checks and API builds are not native acceptance. No production publish or successful GitHub push is claimed.

## 1. iCloud slow-mo
- Confirmed: picker omitted representation/export settings; error alerts hid native errors; missing assets returned silently.
- Unproven: actual URI scheme and whether iCloud composition rendering caused the reported device failure.
- Changed: `artifacts/mobile/app/(tabs)/index.tsx`, `artifacts/mobile/utils/videoFrames.ts`.
- One attempted strategy: Current + Passthrough, real error display and bug-report submission, scheme-only logs, and duration read from the returned file rather than edited Photos metadata. The video enum, Files option and existing `ph://` support remain.
- Native acceptance: Optimize iPhone Storage on, select an iCloud-only slow-mo clip in TestFlight. Capture `shotdoctor.picker.result` and any bug-report error. If this attempt fails, STOP Photos work: put Files first, label it "Files (works with iCloud & slow-mo)", and keep the Save-to-Files instructions. Do not stack another Photos fix.

## 2. Grading
- Confirmed: current code had already removed overall `?? 0`, but counted components below 85 as issues despite labeling 70–84 Pro.
- Unproven: the exact zero-producing line for the reported native session; its failing raw response was not supplied/reproduced.
- Additional existing published-server evidence: a logged result had scores `[88,85,68,75,78,70,80,null]`, rhythm `20`, and `overallScore:null`, not zero. This supports checking the installed native version's handling of null, but does not establish the reported screenshot's exact response or build.
- Changed: server scoring helper and analysis routes; mobile grading, score ring, analysis/home/history displays and annotation overlay; API contract/generated types.
- New composite: follow-through, elbow and set point weighted 1.5, other components 1; reliable rhythm 15%; clamp/round once. Only explicitly unobservable elbow is excluded. Other missing/invalid scores reject with 422. Rejections log original model JSON; no zero substituted.
- One shared descriptor: Beginner <55 red; Rising 55–69 orange; Pro 70–84 green; Elite ≥85 purple. Needs-work is below Pro. The former Developing display tier is merged into Beginner; saved numbers are unchanged.
- Native acceptance: compare response component scores and rhythm with the final total. Pro tiles must not count as issues or expose corrective-step callouts. Missing saved totals must show "—". Correlate any reproduced zero with the original raw response and server calculation log.

## 3. Shooting elbow
- Confirmed: side-on guidance and biased generic elbow wording remained; no shooting-hand choice existed. High-detail key frames and neutral component examples were already present and retained.
- Changed: onboarding, new shooting-hand preference helper, upload requests, filming tips/diagrams, analysis tile, biomechanics prompt, server visibility gate, API contract.
- Right/Left choice is stored in onboarding; existing users are asked before their first new analysis. Every analysis-stage request carries it. The model identifies the shooting arm and visibility before scoring; false visibility forces null elbow with "Can't see from this angle".
- Native acceptance: test Right and Left shooters, mirrored views, a guide elbow visibly out, and a side-on/obscured shooting elbow. Confirm the guide elbow is not graded and the unobservable elbow is excluded.

## 4. Release
- Confirmed: old fixed-percent heuristics had already been replaced, but 100ms samples can miss a faster wrist transition.
- Changed: new client/server refinement helpers; sampling utility, upload orchestration, video route, rhythm fields/context, API contract/generated types.
- Flow: coarse localization if needed → prepare Dip/Set Point/approximate release anchor → extract up to 11 native images at 33ms offsets from −100 to +230ms → independent small selection request → replace and chronologically remap only the verified Release image → final scoring/annotations using that exact image.
- `armExtendFrame` is rhythm onset only; `ballLeavesHandFrame` and `followThroughFrame` are distinct. No `+1`/`+3` or percentage fallback is used: an unverified wrist flick fails explicitly rather than inventing a Release.
- Native acceptance: high-frame-rate source and clip ending just after release. Compare final thumbnail with the exact image sent for Release annotations, verify visible separation/downward wrist, and inspect original-video timestamps. Requested Expo seek times are not proof of exact source-frame PTS.

## 5. Colors
- Confirmed: score-derived annotation and weakest-component thumbnail wiring already existed. Reused it rather than retrying the earlier severity conversion.
- Changed: shared grading descriptor and consumers/tests, neutral annotation example in the prompt.
- Native acceptance: compare a component tile, its annotation dot/callout, and relevant thumbnail border. Border uses the lowest scored annotated component; legacy model severity must not affect colors. Unscored components stay neutral.

## Durable history
Key-frame images already used Documents. Source videos now use Documents too, and a failed durable video copy reports an error before saving/consuming the session. Temporary picker/extraction files may still use cache. Test reopening history after restart/cache clearing on the native build.

## Local verification
- Passed: mobile and scripts TypeScript checks, all 30 focused scoring/contract/tier/refinement regression tests, API esbuild build, and development API health check. API and Expo workflows restarted and running.
- Expo web screenshot reached the splash screen without fatal console errors; it did not verify the new native picker or signed-in analysis screens.
- OpenAPI code generation succeeds, but its chained shared-library typecheck is blocked by pre-existing OpenAI integration errors (p-retry AbortError and possibly undefined response.data). API-only typecheck also reports that library's missing declaration output.
- Native acceptance and the original failing-response trace remain open. App Store follow-on work must not start before the five-bug work is accepted.
