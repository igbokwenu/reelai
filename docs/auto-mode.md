# Auto mode

Updated: July 15, 2026

Auto mode is Reel AI's default concept-to-reel path. It removes the need to visit and approve every studio tab while preserving the complete manual workflow for review, editing, and regeneration.

## User experience

1. The user selects a creative concept.
2. Before the first production spend, Reel AI shows a Brand Kit handoff with the project website, uploaded logos, product images, documents, and reference material. The handoff explains that these assets ground scene generation and the final brand lockup.
3. The user can add brand material or proceed. Auto mode is on by default and can be turned off to continue with the existing step-by-step workflow.
4. Auto mode displays a focused production room with the current phase, completed phases, overall progress, and retry status. Manual tabs and generation controls are hidden while the coordinator owns an active run, preventing conflicting edits and duplicate provider spend.
5. If Auto mode exhausts recovery and pauses, the relevant editor returns with **Review** and **Resume auto mode** actions. When rendering completes, the complete manual workflow returns and the surface links directly to the final reel.

After the first Brand Kit confirmation, selecting a new concept uses a compact proceed panel instead of repeating the full asset handoff. The Auto mode preference is stored on the project.

## Pipeline and recovery

`AutoGenerationRun` is a durable coordinator over existing `GenerationJob` records. It does not replace the manual jobs or provider-specific state.

```text
Storyboard → Scene anchors → Video clips → Narration → Remotion render
```

Each poll advances at most one phase and first verifies persisted output. This makes the coordinator idempotent and avoids repeating successful, expensive work after a browser refresh or application restart. A database lease prevents overlapping browser polls from running the same phase concurrently.

- Storyboards are auto-approved only after structured generation, exact timing, narration-fit, and policy checks. A policy blocker stops for human review.
- Scene-count validation is output-mode aware: standard reels retain 2–4 scenes totaling 15–30 seconds, while Product Showcase uses a feasible 1–3 scenes totaling the project's exact 5, 10, or 15 second target. The same contract is enforced in the editor, production jobs, and final render.
- The persisted Cinematic Boost preference is read by both concept and storyboard generation in Auto and step-by-step modes. Scene transition choices are stored on the storyboard, and the exact same choices reach final Remotion composition.
- Product Showcase source clips and final composition remain voiceover-only: provider driving audio is omitted, source media is muted, BGM is suppressed at the render boundary, and only scene narration is mixed.
- Near-valid model output is normalized before persistence: substantive multi-sentence prose becomes one safe shot sentence, conflicting camera clauses collapse to one supported behavior, voiceover is fitted after timing correction, and Product Showcase scene durations are reconciled to the exact target. A missing top-level script is derived from the already-validated scene narration, while disabled BGM receives explicit non-empty `none` / voiceover-only metadata. Product Showcase always forces that narration-only policy even if a provider contradicts it. Subjective creative-interest vocabulary and cross-scene camera variety remain prompt-level quality guidance rather than paid-retry blockers. A bounded schema-repair pass retains the original project requirements for genuinely incomplete output.
- Anchor generation selects one current continuity-aware anchor per scene.
- Video polling reuses the existing provider task IDs. If only some scenes fail, retry generation targets only missing scenes; completed siblings remain selected.
- Narration is considered current only when every voiced scene links to a durable audio artifact.
- A final render must have completed during the current auto run before it can finish the run.
- Transient provider and polling failures receive up to three total phase attempts with bounded exponential backoff. A creative validation miss is not automatically rerun after the structured generator has already used its bounded repair pass; repeating the same deterministic miss would add cost without changing the inputs. The UI pauses safely with a plain-language explanation and lets the user explicitly retry only that phase. Provider-level HTTP/video polling retains its own bounded retry behavior.
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

The storyboard resilience and retry-policy hardening described above is application-only. If the existing project migrations are already current, restart `pnpm dev`; do not run a new migration, seed, or package install for this change. Prisma generation still runs automatically before development and typechecking.
