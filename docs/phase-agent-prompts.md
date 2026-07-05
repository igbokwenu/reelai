# Reel AI Phase Agent Prompts

Updated: July 5, 2026

Use one prompt per implementation phase. Give the agent only the phase you want it to execute, unless you explicitly want it to continue across phases. Each prompt tells the agent to treat `docs/implementation-guide.md` as the build contract, preserve the hackathon spirit, use QwenCloud skills/docs where relevant, and stop at the phase exit checklist.

## Phase 1 Prompt: Foundation And Open-Source Repo

You are implementing Phase 1 of Reel AI. Read `docs/implementation-guide.md`, `docs/reel-ai-blueprint.md`, and `docs/architecture.md` before making changes. Treat `docs/implementation-guide.md` as the source of truth.

Goal: create a clean, secure, runnable open-source project foundation that is safe to make public.

Build exactly Phase 1 from the implementation guide:

- Next.js App Router app in `apps/web`.
- pnpm workspace.
- TypeScript, Tailwind, ESLint, Prettier.
- shadcn/ui/Radix setup.
- Prisma/Postgres setup.
- Env validation in `apps/web/lib/env.ts`.
- Open-source repo files.
- Basic studio shell route.

Rules:

- Do not commit or print `.env` contents.
- Keep `.env` ignored and `.env.example` placeholder-only.
- Do not add QwenCloud API execution yet; only prepare safe env validation and project structure.
- The app must open directly into a studio shell, not a marketing landing page.
- Use the implementation guide’s exact stack. If you believe a deviation is necessary, create an ADR under `docs/decisions/` before changing course.

Exit only when all Phase 1 checklist items pass:

- `pnpm install` works from repo root.
- `pnpm lint` passes.
- `pnpm typecheck` passes.
- `pnpm test` runs with at least one placeholder/unit test.
- `.env` is ignored and not tracked.
- `.env.example` contains only placeholders.
- `README.md`, `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `SECURITY.md` exist.
- `docs/architecture.md` renders a Mermaid architecture diagram.
- App starts locally and shows the studio shell.

Report what you changed, which commands passed, and any known gaps.

## Phase 2 Prompt: Data Model, Project Intake, And Artifact Storage

You are implementing Phase 2 of Reel AI. Read `docs/implementation-guide.md`, especially the database schema, API contract, media pipeline, and Phase 2 checklist. Build on the current repo; do not restart or replace Phase 1.

Goal: make the app persist real projects, accept sources, and store durable artifacts.

Build exactly Phase 2:

- Prisma schema from the implementation guide.
- Initial migration and seed script.
- `ProjectIntakeForm`.
- `SourceUploader`.
- Project detail page.
- Alibaba OSS helper in `apps/web/lib/oss`.
- Artifact creation and metadata retrieval.
- Project graph API.

Implementation expectations:

- Use Prisma and PostgreSQL as specified.
- Use a dev-compatible artifact storage fallback only if OSS env vars are absent, but keep the same interface so Alibaba OSS can be used unchanged later.
- Validate all route inputs with Zod.
- Do not call QwenCloud yet except for optional smoke placeholders. This phase is about persistence and sources.
- Do not commit generated files or uploaded artifacts.
- Keep the UI production-studio oriented, compact, and usable at 1280px width.

Exit only when all Phase 2 checklist items pass:

- Database migration applies cleanly.
- Seed script creates one demo project.
- User can create a project from the UI.
- User can add website URL/business metadata.
- User can upload at least one image/logo/document source.
- Uploaded source is stored in OSS or local dev-compatible storage with the same interface.
- `Artifact` and `BrandSource` rows are created.
- Project page reloads from persisted database state.
- Playwright smoke test creates or opens a project page.

Run lint/typecheck/tests. Report commands, changed files, and remaining risks.

## Phase 3 Prompt: QwenCloud Client And Brand Kit Agent

You are implementing Phase 3 of Reel AI. Read `docs/implementation-guide.md`, `docs/qwencloud-reference-links.md`, and the installed QwenCloud skills before changing code. Use the local skills for model/API guidance: qwencloud-text, qwencloud-vision, and qwencloud-model-selector. Do not expose secrets.

Goal: prove secure server-side QwenCloud integration and generate a useful Brand Kit.

Build exactly Phase 3:

- `apps/web/lib/qwen/client.ts` with visible QwenCloud base URL.
- Server-only QwenCloud structured text wrapper.
- Vision/asset analysis wrapper or adapter.
- Brand Kit prompt and Zod schema validation.
- `POST /api/projects/[projectId]/brand-kit`.
- `GenerationJob` creation and polling for Brand Kit.
- `BrandKitPanel`.

QwenCloud requirements:

- Use `DASHSCOPE_API_KEY` only server-side.
- The code must visibly include `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`.
- Use `qwen3.7-plus` for structured Brand Kit generation unless official docs or CLI show a better current default.
- Use Qwen vision only for uploaded visual assets; website text should be extracted by the backend first and then sent as text context.
- Validate model output with Zod before saving.
- Log model, operation, elapsed time, provider/request id if available, and sanitized errors only.
- Never log API keys, `.env`, raw private uploaded content, or full prompts in production.

Exit only when all Phase 3 checklist items pass:

- QwenCloud API key is read only server-side.
- QwenCloud base URL is visible in source code.
- Brand Kit generation creates a `GenerationJob`.
- Job status transitions are persisted.
- Brand Kit output validates with Zod before saving.
- UI displays summary, value props, tone, palette, claims, policy risks, and citations.
- Sanitized errors appear in UI when generation fails.
- No prompts, API keys, or uploaded private content are logged in production mode.

Run lint/typecheck/tests and a safe smoke test. Report what worked, what was mocked if anything, and how to verify with a real QwenCloud key.

## Phase 4 Prompt: Creative Concepts And Storyboard Editor

You are implementing Phase 4 of Reel AI. Read `docs/implementation-guide.md`, especially the Agent Output Schemas, Frontend Information Architecture, and Phase 4 checklist. Use the QwenCloud text and image generation skills/docs where relevant. Build on the existing Brand Kit workflow.

Goal: deliver Reel AI’s signature showrunner mechanic: three creative concepts, one selected direction, and an editable storyboard.

Build exactly Phase 4:

- Creative Director agent that returns exactly three concepts.
- Preview frame generation for each concept.
- `ConceptTable` and `ConceptCard`.
- Concept selection endpoint.
- Storyboard agent using selected concept and Brand Kit.
- Editable `StoryboardTimeline`.
- `SceneInspector`.
- Storyboard update endpoint.
- Claim/policy review pass for storyboard text.

Product requirements:

- Concepts must be genuinely different strategies, not three hook variants.
- Each concept must include title, hook, strategy, narrative arc, visual style, estimated scenes, estimated duration, preview prompt, rationale, and one preview frame.
- Storyboard generation must require a selected concept.
- MVP storyboard must contain 2 to 4 scenes and target 15 to 30 seconds.
- Scene voiceover text must respect TTS chunk limits from the guide.
- User edits must persist.
- The UI must make the human approval loop obvious: concept pick before storyboard, storyboard approval before generation.

QwenCloud requirements:

- Use `qwen3.7-plus` for structured concept/storyboard JSON unless verified otherwise.
- Use `wan2.7-image-pro` or current verified image model for concept preview frames.
- Validate all model outputs with Zod before persistence.
- Store generated preview frames as artifacts.

Exit only when all Phase 4 checklist items pass:

- User can generate exactly three concepts from a Brand Kit.
- Each concept has title, hook, strategy, narrative arc, preview prompt, rationale, and preview frame.
- User can select exactly one concept.
- Storyboard generation requires a selected concept.
- Storyboard contains 2 to 4 scenes for MVP.
- Each scene has duration, caption, voiceover text, start/end frame prompts, motion prompt, and continuity notes.
- User can edit scene caption, voiceover, prompts, duration, and BGM settings.
- Storyboard edits persist after refresh.
- Policy/claims warnings are visible before generation.

Run checks and include a concise demo path in your report.

## Phase 5 Prompt: Keyframes, Video Generation, And Take Compare

You are implementing Phase 5 of Reel AI. Read `docs/implementation-guide.md`, `docs/qwencloud-reference-links.md`, and the installed QwenCloud image/video generation skills before coding. This phase must make generation durable and additive, not destructive.

Goal: generate scene keyframes and i2v video clips, store them durably, and let users compare/select takes.

Build exactly Phase 5:

- Keyframe generation endpoint.
- Image generation wrapper for preview/start/end frames.
- `Take` creation for keyframes.
- `TakeCompare` for keyframe takes.
- Video generation endpoint using image-to-video.
- Async video task submission and polling.
- `GenerationConsole`.
- Artifact previews for images and videos.

Product requirements:

- Regeneration creates a new `Take`; it never overwrites a prior take.
- User can select preferred keyframe/video takes.
- Use approved storyboard scenes only.
- Generate 2 to 4 scenes for MVP.
- Use locked style language, brand palette, continuity notes, and selected keyframes in prompts.
- The UI must show model name, job status, provider task ID, artifact links, retries, and sanitized errors.

QwenCloud requirements:

- Use QwenCloud image generation for keyframes.
- Use image-to-video as the default video path.
- Use `happyhorse-1.1-i2v` or the latest verified Wan/HappyHorse i2v model based on docs/skills.
- Submit video tasks asynchronously; do not block a route waiting for all scenes.
- Poll provider tasks and persist state in `GenerationJob`.
- Copy provider output URLs into OSS before treating them as durable artifacts.

Exit only when all Phase 5 checklist items pass:

- User can generate start/end keyframes for approved scenes.
- Keyframe outputs are copied to OSS and saved as `Artifact` rows.
- Regenerating a keyframe creates a new `Take`; it does not overwrite the previous take.
- User can select the preferred keyframe take.
- User can submit 2 to 4 scenes for i2v generation.
- Video provider task IDs are stored on jobs.
- Video polling survives page refresh.
- Completed video clips are copied to OSS and shown in the UI.
- Failed scene generation can be retried.
- Generation console shows model, status, task ID, and artifact links.

Run lint/typecheck/tests. Include one manual verification path and note any QwenCloud quota/latency risks without inventing pricing.

## Phase 6 Prompt: Narration, Composition, And Final Export

You are implementing Phase 6 of Reel AI. Read `docs/implementation-guide.md`, the Remotion media pipeline section, and the installed qwencloud-audio-tts skill. This phase must produce a complete downloadable reel.

Goal: turn selected scene clips into one complete 9:16 MP4 with narration, captions, safe zones, optional BGM, and optional AI disclosure.

Build exactly Phase 6:

- TTS endpoint and narration job.
- Audio artifact storage.
- Waveform preview.
- Remotion composition.
- Captions with TikTok/Reels safe zones.
- Optional AI-content disclosure overlay.
- Optional uploaded/sample BGM mix.
- Final render endpoint.
- `FinalVideoPlayer` and download link.

Product requirements:

- Narrative voiceover only. Do not implement lip sync.
- TTS text must be chunked according to model limits.
- Captions must be safe-zone-aware.
- AI disclosure defaults on but can be toggled.
- BGM can be disabled; uploaded/sample BGM may be included.
- Final output is 9:16 MP4 for MVP.
- Store final MP4 and thumbnail as durable artifacts.

QwenCloud requirements:

- Use QwenCloud TTS, defaulting to `qwen3-tts-flash` unless docs/skills justify a better model.
- Keep all TTS calls server-side.
- Do not log raw private scripts in production logs.

Remotion requirements:

- Build a typed `ReelCompositionInput`.
- Combine selected scene video takes in order.
- Mix narration and optional BGM.
- Render final MP4 and thumbnail.
- Store render output in OSS.

Exit only when all Phase 6 checklist items pass:

- Narration is generated from scene voiceover text.
- TTS chunks respect model text limits.
- Narration audio is stored as an `Artifact`.
- UI shows narration status and waveform/metadata.
- Final render combines selected scene videos in order.
- Captions are visible and safe-zone-aware.
- AI disclosure can be toggled and defaults on for export.
- Optional BGM can be disabled or included.
- Final MP4 is stored in OSS as `FINAL_RENDER`.
- User can play and download the final reel.
- Manual demo path works end to end for a 15 to 30 second reel.

Run checks and report the final demo path clearly.

## Phase 7 Prompt: Deployment, Documentation, And Judging Package

You are implementing Phase 7 of Reel AI. Read `docs/implementation-guide.md`, `docs/architecture.md`, `docs/qwencloud-reference-links.md`, and the hackathon proof requirements. This phase makes Reel AI live and reusable.

Goal: deploy the MVP to Alibaba Cloud, complete public repo documentation, and prepare the judging package.

Build exactly Phase 7:

- Dockerfile.
- `docker-compose.yml`.
- `scripts/deploy/README.md`.
- ECS deployment.
- Production environment setup.
- README completion.
- Architecture and proof screenshots.
- Public demo project seed or fixture.
- Playwright deployed smoke test.

Deployment requirements:

- Use Alibaba Cloud ECS + Docker Compose for MVP.
- Use OSS for generated artifacts.
- Use RDS Postgres if available; otherwise document Docker Postgres as hackathon-only.
- Configure env vars on the server, not in git.
- Security group exposes only required web ports.
- Capture Alibaba Cloud console/Workbench proof screenshot or recording.
- The deployed URL must open the app and support the end-to-end demo path.

Open-source requirements:

- Public repo must include `LICENSE`, `README.md`, `.env.example`, `.gitignore`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `docs/architecture.md`, and ADRs.
- README must include product summary, features, setup, env vars, QwenCloud setup, Alibaba deployment, judging proof, and security notes.
- No `.env`, secrets, generated large media, or private artifacts may be committed.
- Repo must visibly contain QwenCloud API usage and base URL.

Exit only when all Phase 7 checklist items pass:

- Docker image builds successfully.
- App runs with Docker Compose locally.
- Database migration process is documented.
- Alibaba Cloud ECS deployment is live.
- OSS bucket is configured for generated artifacts.
- Public deployed URL opens the app.
- End-to-end demo succeeds on deployed app.
- Alibaba Cloud proof screenshot/recording is captured.
- README includes setup, env vars, QwenCloud usage, deployment, and judging proof.
- Repo contains visible QwenCloud API usage and no committed secrets.
- 1 to 3 minute demo video is recorded.
- Project can be reused for a second brand without code changes.

Run local and deployed smoke checks. Report deployed URL, proof artifact path, and any manual steps.

## Phase 8 Prompt: Post-MVP Polish And Reusability

You are implementing Phase 8 of Reel AI. Only start this after Phase 7 is complete and the deployed MVP works. Read `docs/implementation-guide.md` and add ADRs for meaningful feature additions.

Goal: improve Reel AI as a reusable open-source product without destabilizing the judged MVP.

Possible features:

- Shareable review links.
- Spokesperson mode with reference-to-video.
- Style analysis from reference ads.
- Multi-format export: 9:16, 1:1, 16:9.
- Tair/Redis queue if concurrent usage needs it.
- Separate render/worker service if media rendering blocks the web app.
- Better observability and analytics.

Rules:

- Do not break the Phase 1-7 demo path.
- Add an ADR or implementation note for each feature.
- Add feature flags/config toggles for risky or expensive features.
- Update README and docs when behavior changes.
- Keep all QwenCloud calls server-side.
- Do not add new infrastructure unless the current MVP bottleneck is demonstrated.

Feature-specific guidance:

- For review links, create no-login scoped project review URLs with comments/approval only, not full dashboard access.
- For spokesperson mode, use QwenCloud reference-to-video only after verifying model support and prompt stability.
- For reference ad style analysis, extract pacing/structure/tone only; do not copy protected visuals or scripts.
- For multi-format export, reuse selected scene assets and Remotion composition; do not regenerate all videos by default.
- For Redis/Tair, create an ADR explaining why Postgres jobs are insufficient.

Exit checklist:

- Each new feature has an ADR or implementation note.
- New feature can be disabled by config or feature flag.
- Existing end-to-end demo still passes.
- Public docs explain the feature and limitations.
- Deployment remains reproducible.

Run the full acceptance test suite before reporting completion.

