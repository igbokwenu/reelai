# Auto mode

Updated: July 15, 2026

Auto mode is Reel AI's default concept-to-reel path. It removes the need to visit and approve every studio tab while preserving the complete manual workflow for review, editing, and regeneration.

## User experience

1. The user selects a creative concept.
2. Before the first production spend, Reel AI shows a Brand Kit handoff with the project website, uploaded logos, product images, documents, and reference material. The handoff explains that these assets ground scene generation and the final brand lockup.
3. The user can add brand material or proceed. Auto mode is on by default and can be turned off to continue with the existing step-by-step workflow.
4. Auto mode displays a focused production room with the current phase, completed phases, overall progress, and retry status. Manual tabs and generation controls are hidden while the coordinator owns an active run, preventing conflicting edits and duplicate provider spend.
5. If Auto mode exhausts recovery and pauses, the relevant editor returns with **Review** and **Resume auto mode** actions. When rendering completes, the complete manual workflow returns with the **Final** stage already selected and scrolled into view.

After the first Brand Kit confirmation, selecting a new concept uses a compact proceed panel instead of repeating the full asset handoff. The Auto mode preference is stored on the project.

## Pipeline and recovery

`AutoGenerationRun` is a durable coordinator over existing `GenerationJob` records. It does not replace the manual jobs or provider-specific state.

```text
Storyboard → Scene anchors → Video clips → Narration → Remotion render
```

Each poll advances at most one phase and first verifies persisted output. This makes the coordinator idempotent and avoids repeating successful, expensive work after a browser refresh or application restart. A database lease prevents overlapping browser polls from running the same phase concurrently.

- Storyboards are auto-approved only after structured generation, exact timing, narration-fit, and policy checks. A policy blocker stops for human review.
- Scene-count validation is output-mode aware: standard reels retain 2–4 scenes totaling 15–30 seconds, while Product Showcase uses a feasible 1–3 scenes totaling the project's exact 5, 10, or 15 second target. Razzmatazz is the locked exception: exactly one 5-second scene with explicit product motion, an active surrounding energy effect, and hero framing. The same contract is enforced in the editor, production jobs, and final render.
- The persisted Cinematic Boost preference is read by both concept and storyboard generation in Auto and step-by-step modes. Scene transition choices are stored on the storyboard, and the exact same choices reach final Remotion composition.
- Standard-reel storyboards choose one exact curated BGM track from the shared five-track catalog. Auto mode carries the persisted choice into the final render; legacy projects are mood-matched from their existing soundtrack direction. The same resolver, looping, edge fades, and narration ducking are used by step-by-step renders.
- Product Showcase source clips remain silent: provider driving audio is omitted and Remotion mutes source media. The separate curated BGM layer defaults on for the first Auto render, is mood-matched by the storyboard agent, and ducks beneath scene narration. After Auto completes, users can turn it off or choose another track and re-render without regenerating scenes.
- Product Showcase concepts now persist a visible motion treatment used by both modes. Auto mode and step-by-step mode enforce no people or one person total, one readable screen interaction, and category-aware separation: verified food layers or explicit large visible modular pieces may separate judiciously, while electronics, fabrics, screens, and uncertain products cannot use teardown. A generated storyboard gets one bounded correction pass, manual saves are checked, and production rechecks the plan before provider spend.
- Razzmatazz tightens that shared Product Showcase policy to `NO_PERSON` plus `AVOID` separation for every category. Auto mode still advances through the usual storyboard, anchor, video, narration, and render phases; the generated source and shared Remotion composition both remain exactly 5 seconds.
- Near-valid model output is normalized before persistence: substantive multi-sentence prose becomes one safe shot sentence, conflicting camera clauses collapse to one supported behavior, voiceover is fitted after timing correction, and Product Showcase scene durations are reconciled to the exact target. An over-segmented five-second showcase is collapsed into one hero clip by retaining the opening product action and the closer's CTA copy. Caption and narration can recover from one another, safe continuity notes are supplied when omitted, and a clearly product-only showcase receives an explicit no-people cast plan. A missing top-level script is derived from validated scene narration. Standard disabled BGM receives explicit non-empty `none` / voiceover-only metadata; Product Showcase instead receives a valid default-on curated soundtrack when provider metadata is missing or contradictory. Subjective creative-interest vocabulary and cross-scene camera variety remain prompt-level quality guidance rather than paid-retry blockers. A bounded schema-repair pass retains the original project requirements for genuinely incomplete output. If a Brand Reel repair is still structurally incomplete, an internal deterministic creative rescue preserves usable concept/scene decisions, completes the three-direction or multi-scene contract from verified project context, repairs timing/narration/cast/continuity, and validates again before the phase can fail.
- Anchor generation selects one current continuity-aware anchor per scene.
- Video polling reuses the existing provider task IDs. If only some scenes fail, retry generation targets only missing scenes; completed siblings remain selected.
- Narration is considered current only when every voiced scene links to a durable audio artifact.
- A final render must have completed during the current auto run before it can finish the run.
- Transient provider and polling failures receive up to three total phase attempts with bounded exponential backoff. Brand Reel schema variance is resolved inside the creative call—normalization, one model repair, then one deterministic recovery—before Auto considers a phase retry, so the user does not watch the agent complain about its own output. A failure that remains after those layers may receive the existing bounded fresh Auto attempt, while provider-level HTTP/video polling retains its own retry behavior. The pipeline never loops creative repair indefinitely.
- Failed structured jobs persist only safe validation diagnostics (issue code, field path, and validator message) in `GenerationJob.output`. The customer-facing Auto message remains plain language, while local operations can identify the exact malformed field if the bounded reroll also fails.
- Exhausted or non-transient failures retain the failed phase and expose **Review** plus a phase-specific **Retry** action. Legacy persisted validation messages are translated into the same plain-language recovery copy, so an existing failed run improves immediately after an app restart.
- While a run is active, project mutation APIs reject manual Brand Kit, concept, source, storyboard, take-selection, production, narration, and render actions with a conflict response. This also protects against stale browser tabs or direct requests after the focused UI has hidden its controls.
- Existing upstream edits made before Auto mode starts are reconciled normally; if persisted output is no longer current, the coordinator moves back to the earliest required phase instead of continuing with stale inputs.

The coordinator is app-driven for the current MVP: the studio polls `GET /api/projects/:projectId/auto`, which claims and advances the durable run. A future worker can call the same coordinator without changing the persisted state model or UI contract.

## API

- `POST /api/projects/:projectId/auto` with `{ "action": "start", "enabled": true }` confirms the Brand Kit and starts or returns the active run.
- The same request with `enabled: false` stores step-by-step mode without creating a run.
- `POST /api/projects/:projectId/auto` with `{ "action": "resume" }` resumes a stopped run from its retained phase.
- `GET /api/projects/:projectId/auto` returns and, when eligible, advances the latest run.

## Local database update

The original Auto mode feature adds `Project.autoMode`, `Project.brandKitConfirmedAt`, and `AutoGenerationRun`. A checkout that has not applied that historical migration must stop the local dev server, run `pnpm db:migrate`, and restart `pnpm dev`.

The Product Showcase motion-plan guardrail adds nullable `CreativeConcept.showcaseMotionPlan`. Apply it with the same stop → `pnpm db:migrate` → `pnpm dev` sequence. No seed is required.

Curated soundtrack selection adds nullable `Storyboard.bgmTrackId`. Apply it with the same stop → `pnpm db:migrate` → `pnpm dev` sequence. Existing projects need no backfill or seed; see [background-music.md](background-music.md).

The storyboard resilience and retry-policy hardening described above is application-only. If the existing project migrations are already current, restart `pnpm dev`; do not run a new migration, seed, or package install for this change. Prisma generation still runs automatically before development and typechecking.

Concept opening-frame reuse and granular scene controls are application-only as well. Auto mode reuses the selected concept's raster preview as Scene 1 and generates only missing Scene 2+ anchors. Manual scene actions remain locked while Auto mode owns the run and return afterward. Restart `pnpm dev`; no migration, seed, or dependency install is required.
