# Auto mode

Updated: July 15, 2026

Auto mode is Reel AI's default concept-to-reel path. It removes the need to visit and approve every studio tab while preserving the complete manual workflow for review, editing, and regeneration.

## User experience

1. The user selects a creative concept.
2. Before the first production spend, Reel AI shows a Brand Kit handoff with the project website, uploaded logos, product images, documents, and reference material. The handoff explains that these assets ground scene generation and the final brand lockup.
3. The user can add brand material or proceed. Auto mode is on by default and can be turned off to continue with the existing step-by-step workflow.
4. Auto mode displays one persistent production surface with the current phase, completed phases, overall progress, retry status, and a link into the relevant manual editor.
5. When rendering completes, the surface links directly to the final reel. Storyboard, Production, Final, and Assets remain available for inspection or regeneration.

After the first Brand Kit confirmation, selecting a new concept uses a compact proceed panel instead of repeating the full asset handoff. The Auto mode preference is stored on the project.

## Pipeline and recovery

`AutoGenerationRun` is a durable coordinator over existing `GenerationJob` records. It does not replace the manual jobs or provider-specific state.

```text
Storyboard → Scene anchors → Video clips → Narration → Remotion render
```

Each poll advances at most one phase and first verifies persisted output. This makes the coordinator idempotent and avoids repeating successful, expensive work after a browser refresh or application restart. A database lease prevents overlapping browser polls from running the same phase concurrently.

- Storyboards are auto-approved only after structured generation, exact timing, narration-fit, and policy checks. A policy blocker stops for human review.
- Scene-count validation is output-mode aware: standard reels retain 2–4 scenes totaling 15–30 seconds, while Product Showcase uses a feasible 1–3 scenes totaling the project's exact 5, 10, or 15 second target. The same contract is enforced in the editor, production jobs, and final render.
- Near-valid model output is normalized before persistence: supported camera direction is preserved when it arrives in a separate sentence, common product motion remains valid, voiceover is fitted after timing correction, and Product Showcase scene durations are reconciled to the exact target. A bounded schema-repair pass retains the original project requirements.
- Anchor generation selects one current continuity-aware anchor per scene.
- Video polling reuses the existing provider task IDs. If only some scenes fail, retry generation targets only missing scenes; completed siblings remain selected.
- Narration is considered current only when every voiced scene links to a durable audio artifact.
- A final render must have completed during the current auto run before it can finish the run.
- Transient failures, including creative schema misses, receive up to three total phase attempts with bounded exponential backoff between attempts. Validation errors that require an actual user decision remain non-retryable. Provider-level HTTP/video polling has its own bounded retry behavior.
- Exhausted or non-transient failures retain the failed phase and expose **Review** and **Resume auto mode** actions.
- If a manual edit invalidates upstream output during an active run, the coordinator moves back to the earliest required phase instead of continuing with stale inputs. Navigating between tabs is safe; storyboard job claiming prevents a manual click and Auto mode from starting duplicate storyboard work.

The coordinator is app-driven for the current MVP: the studio polls `GET /api/projects/:projectId/auto`, which claims and advances the durable run. A future worker can call the same coordinator without changing the persisted state model or UI contract.

## API

- `POST /api/projects/:projectId/auto` with `{ "action": "start", "enabled": true }` confirms the Brand Kit and starts or returns the active run.
- The same request with `enabled: false` stores step-by-step mode without creating a run.
- `POST /api/projects/:projectId/auto` with `{ "action": "resume" }` resumes a stopped run from its retained phase.
- `GET /api/projects/:projectId/auto` returns and, when eligible, advances the latest run.

## Local database update

This feature adds `Project.autoMode`, `Project.brandKitConfirmedAt`, and `AutoGenerationRun`. Stop the local dev server, run `pnpm db:migrate`, and restart `pnpm dev`. Prisma generation runs automatically before development and typechecking. No seed or package installation is required.
