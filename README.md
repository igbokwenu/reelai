# Reel AI

Reel AI is an AI showrunner studio for short-form business ads and story-led social videos. It takes a business website and optional brand materials, builds a reusable Brand Kit, pitches three distinct creative concepts, creates an editable storyboard, generates QwenCloud-powered keyframes/video/scene-timed narration, and exports a vertical 9:16 reel with a final closer, safe zones, optional standard-reel BGM, and AI disclosure.

The project is built for the QwenCloud hackathon Track 2, AI Showrunner. The repo is intentionally public-submission friendly: no committed secrets, visible server-side QwenCloud usage, reproducible Docker deployment, and a judging checklist.

## Features

- Next.js App Router studio in `apps/web`.
- Prisma/PostgreSQL project graph with projects, sources, artifacts, jobs, concepts, storyboards, takes, narration, and renders.
- Server-side QwenCloud clients for structured text, vision, image generation, video generation, and TTS.
- URL-first project creation with one optional logo and one optional product image uploaded before Brand Kit research begins; project and business names can be inferred from the website. A logo's analyzed dominant color is promoted into the Working palette.
- Product Showcase output mode for premium 5–15 second realistic or 3D product films. Intake requires exactly one named product and one real product image, accepts one optional logo and one project website, pitches exactly three directions, and gives each direction a visible motion-feasibility plan. Every shot uses one hero action; human concepts use one person total; screen choreography stays simple; and teardown is limited to verified food layers or clearly visible modular pieces rather than electronics, fabric, or uncertain internals.
- Optional **Razzmatazz mode** turns Product Showcase into a fixed 3-second commercial bumper: one intact-product hero scene, one identity-safe spin/turn/scale-forward move, premium surrounding light or particle energy, no people or teardown, and a short tagline/CTA revealed over the second half. Auto mode and step-by-step mode share the same guardrails and exact 90-frame Remotion export.
- Focused two-column landing workspace with optional pipeline guidance and confirmed project deletion, including local/OSS artifact cleanup.
- Dedicated premium media library at `/library` that collects only completed merged MP4 exports, groups them by originating project, labels Brand Reels and Product Showcases, preserves every completed cut, and supports search, filtering, focused playback, project return, and direct download.
- Focused horizontal project workflow with six stages: Brand, Concepts, Storyboard, Production, Final, and Assets. Downstream production stages unlock only when their prerequisite is complete, while completed stages and Assets remain available; switching stages preserves in-progress client state.
- Default-on Auto mode turns a selected concept into a finished reel without tab-by-tab approval: a one-time Brand Kit asset handoff precedes spend, a focused phase tracker replaces manual controls during active production, and resilient retries resume from the last valid storyboard, anchor, clip, narration, or render output. Step-by-step mode remains available before starting; manual editors return on pause or completion, and a completed Auto run opens the Final stage automatically.
- Each project accepts one logo, one product image, and one URL source. The UI exposes these as clear 0/1 or 1/1 slots, and the API serializes writes per project so stale tabs cannot exceed the limits.
- Premium contextual action guidance across consequential controls. Mouse hover and keyboard focus explain outcomes in plain language, including replacement, deletion, generation, and downstream effects; disabled controls remain discoverable and the guidance is screen-reader and reduced-motion aware.
- Reusable Brand Kit with value props, palette, claims, policy risks, locked style language, and citations.
- Multi-page website evidence collection covering metadata, visible copy, CSS color candidates, logos/social images, and QwenCloud visual analysis.
- Evidence-capability guardrails: website-only projects cannot manufacture product UI, logos, branded uniforms, badges, packaging, or unsupported trust claims.
- Storyboard grounding auto-recovery: missing logo, product, or interface references do not block creation. Reel AI preserves the selected strategy, adapts unsupported execution to source-safe unbranded storytelling, validates the replacement, and explains the adaptation in the editor.
- Pre-spend concept validation and post-generation visual grounding review; concept frames are generated sequentially with bounded provider/download retries and one corrective identity pass before an exhausted failure becomes an honest local concept card.
- Exactly three creative concepts before full generation spend, with optional note-guided regeneration of one direction without replacing the other two.
- Persisted **Cinematic Boost** on the concept screen heightens scale, lighting contrast, depth, reveal timing, motion, and transition design across concept and storyboard generation while preserving grounding constraints.
- Visual storyboard filmstrip with one anchor image and one directed shot sentence per scene, an engine-managed product/character/visual-world continuity bible, and a human approval loop. Short-format defaults are Razzmatazz 3s/1 scene, 5s/1 scene, 10s/2 scenes, and 15s/3 scenes; explicit supported scene-count directions override the default except for locked Razzmatazz. Standard reels otherwise use 2–4 scenes, while Product Showcase uses a feasible 1–3 scenes at the exact selected duration.
- A constrained shot engine validates generation-safe 14–60 word directions: one sentence, at most one motivated two-beat progression, exactly one reliable camera behavior, no passive framing, and a 5 to 10 second low-drift duration. Visible story change, layered composition, and camera variety remain creative guidance without becoming brittle retry blockers.
- The creative grammar is domain-neutral: people/services, products/retail/food, software, places/hospitality/property, expertise/B2B/education, and creator/event/abstract-brand work each receive offer-appropriate motion devices instead of one universal problem/relief template.
- Structured cast planning keeps product-only ads free of token people and gives every human role stable appearance/wardrobe anchors. Multi-person scenes require distinct face/silhouette signatures; neutral complexion or fictional ethnic-appearance anchors are allowed without inferring ethnicity for real reference-backed people or using stereotypes.
- Near-valid storyboard output is repaired deterministically before persistence: the first clear action is preserved, multi-sentence prose is collapsed safely, conflicting camera language becomes one supported behavior, and Product Showcase timing and narration are fitted to the exact project target. Genuinely missing creative direction still receives bounded model repair.
- Continuity-aware anchors reuse uploaded visual references when available. Every later anchor can reference the two most recent anchors to recover recurring identities after a scene gap while inheriting screen direction, spatial logic, lighting, and match-cut geometry; those locks are kept out of the video prompt.
- A recommended Production story flow auto-selects the newest coherent anchor and clip, keeps older anchors, legacy closing frames, and clips as optional history, and exposes only the single shot sentence for inline tuning with downstream dependency invalidation.
- Wan 2.7 scene video generation receives the approved shot sentence verbatim plus the anchor image. Artifact avoidance lives in the dedicated negative-prompt field, and prompt rewriting stays disabled so the provider cannot expand one action into a mangled compound shot.
- Storyboards persist a deliberate transition into each scene. Remotion uses clean match cuts plus short motivated fade, slide, wipe, iris, or clock-wipe presentations, compensating overlap so the final duration remains exact.
- Render media is read through Reel AI's same-origin, byte-range-aware artifact endpoint and decoded with Remotion Media. This avoids downloading an entire OSS clip for every frame, tolerates slower remote storage with bounded retries and a 120-second media timeout, and limits render concurrency to keep local exports stable.
- Qwen TTS narration is generated and stored per scene. Reel AI measures the real WAV duration, gives each line a short lead-in/tail, applies at most a natural 1.20× fit, rejects overlong copy instead of clipping it, and ducks BGM beneath speech. Silent scenes remain silent, while legacy one-track narration stays render-compatible.
- Brand Reels and Product Showcases use a five-track curated BGM catalog. The storyboard agent selects a mood-matched track, existing projects receive a deterministic fallback, and Auto mode honors it. Product Showcase defaults music on for its first final so users see the complete Reel AI mix, while the Final step supports preview, manual override, or a voiceover-only re-render. Remotion loops, edge-fades, and narration-ducks the chosen bed while source clips remain muted. See [docs/background-music.md](docs/background-music.md) for filenames, generation prompts, licensing guidance, and tests.
- Final renders keep early scenes text-free and reserve the first half of the closing shot for unobstructed video plus the verified logo. The closer/CTA enters smoothly at the midpoint in a restrained glass-and-pearl typographic treatment, including single-clip 3-second Razzmatazz and 5-second showcases. The latest uploaded logo, or a directly verified website logo asset—not an AI recreation—is displayed alone at 3× the former mark size; the business name appears only when no logo asset is available.
- Remotion final render path for 9:16 MP4 export.
- Alibaba OSS-compatible artifact storage with a local dev fallback.
- Dockerfile, Docker Compose, deploy runbook, seed fixture, and Playwright smoke tests.

## Architecture

See [docs/architecture.md](docs/architecture.md) for the Mermaid system diagram, runtime components, data flow, deployment topology, and security boundaries.

Key runtime services:

- `apps/web`: Next.js UI, API routes, lightweight job orchestration, and Remotion integration.
- PostgreSQL: Prisma-backed state for projects, jobs, artifacts, storyboards, takes, and renders.
- Alibaba Cloud OSS: durable storage for uploads and generated media.
- QwenCloud: server-side model calls through DashScope-compatible endpoints.
- Alibaba Cloud ECS: MVP deployment target running Docker Compose.

## Local Setup

Prerequisites:

- Node.js 20 or newer.
- pnpm 11.
- PostgreSQL, either local/RDS or Docker Compose.

Install and run:

```bash
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open `http://localhost:3000`.

Application-only updates that do not add a Prisma migration require only a restart of `pnpm dev`. Web development, typecheck, and build commands regenerate Prisma Client automatically so editor types stay aligned with `prisma/schema.prisma`. After switching to a branch with schema changes, run `pnpm db:generate` immediately if an already-open editor still shows missing Prisma fields, then restart its TypeScript server. The continuity-first anchor and single-shot-direction updates include migrations that preserve prior takes/artifacts, migrate the former motion brief into `shotPrompt`, and retire obsolete scene prompt columns. Existing local checkouts must stop `pnpm dev`, run `pnpm db:migrate` once, and then restart `pnpm dev`.

Existing storyboards remain generatable after migration. Their former motion brief becomes the shot direction and durations are safely clamped to 5–10 seconds; unchanged legacy wording is accepted until it is edited. For the best quality, regenerate an older storyboard and its anchors once so every shot is authored natively under the new one-sentence rules. Reseeding is not required.

Scene-timed narration adds the nullable `Scene.narrationArtifactId` link. Existing audio and renders are preserved, but a local checkout must stop `pnpm dev`, run `pnpm db:migrate` once, and restart `pnpm dev`. Then click **Generate Scene Narration** before the next render to replace any legacy project-wide track with measured scene clips. No seed is required.

Auto mode adds persisted project preferences, the first-production Brand Kit confirmation, and resumable `AutoGenerationRun` coordination. Existing projects default to Auto mode and will see the Brand Kit handoff the next time they proceed from a selected concept. Stop `pnpm dev`, run `pnpm db:migrate`, then restart `pnpm dev`. No `pnpm install` or seed is required. See [docs/auto-mode.md](docs/auto-mode.md) for recovery behavior and the API contract.

Product Showcase adds `Project.outputMode`, `ProjectProduct`, and the optional product link on uploaded sources. Existing projects remain `STANDARD`. Stop `pnpm dev`, run `pnpm db:migrate`, and restart `pnpm dev`; Prisma Client is regenerated automatically. No `pnpm install` or seed is required. See [docs/product-showcase.md](docs/product-showcase.md) for limits, grounding rules, and the end-to-end flow.

The Product Showcase motion-plan update adds nullable `CreativeConcept.showcaseMotionPlan` JSON. Stop `pnpm dev`, run `pnpm db:migrate`, and restart `pnpm dev`. Existing standard reels are unchanged; regenerate legacy Product Showcase concepts before selection so the premium motion-treatment panel and current safeguards are present.

Cinematic Boost and scene transitions add `Project.cinematicBoost`, `Scene.transitionStyle`, and the official `@remotion/transitions` dependency. After pulling into a fresh checkout, run `pnpm install`. Then stop `pnpm dev`, run `pnpm db:migrate`, and restart `pnpm dev`. Existing projects default to balanced intensity and clean cuts; no seed is required.

The domain-neutral creative grammar, structured cast planning, richer motion-hierarchy guardrails, recent-anchor identity recovery, and last-scene logo lockup are application-only changes. Existing databases and artifacts remain compatible; restart `pnpm dev` after pulling them, with no additional migration or seed command.

Granular concept/scene regeneration and concept-opening-frame reuse are application-only. Restart `pnpm dev`; do not run `pnpm db:migrate`, `pnpm db:seed`, or `pnpm install`. New concepts use product references in provider editing mode, their selected preview becomes Scene 1's image-to-video frame, and batch anchor generation starts at Scene 2. Existing projects remain compatible; regenerate one legacy concept (or its storyboard) to opt into the new opening-frame link.

The concept-preview reliability and duration-aware scene-default update is application-only. Restart `pnpm dev`; do not run `pnpm install`, `pnpm db:migrate`, `pnpm db:generate`, or `pnpm db:seed`. Existing projects remain compatible; regenerate their concepts to apply the new scene defaults.

The range-aware render media path is also application-only. Run `pnpm install` to install the Remotion Media dependency, then restart `pnpm dev`; no database migration or seed is required.

The midpoint closer timing and premium CTA treatment are application-only Remotion changes shared by Auto and step-by-step rendering. Restart `pnpm dev` after pulling them. Do not run `pnpm install`, `pnpm db:migrate`, `pnpm db:generate`, or `pnpm db:seed` for this update.

The curated soundtrack catalog adds nullable `Storyboard.bgmTrackId`. Existing storyboards are preserved and infer a track from their saved BGM direction. Stop `pnpm dev`, run `pnpm db:migrate`, and restart `pnpm dev`. No install or seed is required. See [docs/background-music.md](docs/background-music.md).

The Product Showcase default-on BGM expansion is application-only. If the curated soundtrack migration above is already applied, stop and restart `pnpm dev`; do not run another migration, install, generate, or seed command. Existing completed showcases can re-render immediately with AI Match, a manual track, or music disabled.

Razzmatazz mode adds the persisted `Project.razzmatazzMode` preference and therefore requires one migration. Stop `pnpm dev`, run `pnpm db:migrate`, then restart `pnpm dev`. No package install, seed, or manual Prisma generation is required. Existing projects are preserved with Razzmatazz off; create a new Product Showcase to exercise the setup toggle and complete 3-second pipeline.

The contextual action guidance layer is application-only and adds no package or database dependency. Next.js hot reload should pick it up during `pnpm dev`; otherwise restart `pnpm dev` once. Do not run `pnpm install`, `pnpm db:migrate`, `pnpm db:generate`, or `pnpm db:seed` for this update. See [docs/contextual-guidance.md](docs/contextual-guidance.md) for interaction behavior and the contributor pattern for future actions.

The media library is also application-only. It reads the existing `Render` and `Artifact` records, so existing completed finals appear automatically and no backfill is needed. Stop and restart `pnpm dev` once after pulling the update. Do not run `pnpm install`, `pnpm db:migrate`, `pnpm db:generate`, or `pnpm db:seed`. See [docs/media-library.md](docs/media-library.md) for inclusion rules and UI behavior.

The streamlined intake, single-slot source limits, progressive workflow unlocking, logo-led palette, and Auto-to-Final navigation are application-only. Restart `pnpm dev` once; do not run `pnpm install`, `pnpm db:migrate`, `pnpm db:generate`, or `pnpm db:seed`. Existing projects and generated media remain compatible. Limits apply to new source writes; a legacy project that already contains extra sources keeps them so existing generations are not silently invalidated.

The seed creates:

- `Demo Launch Reel`, a populated Northstar Coffee public demo fixture.
- `Reusable Second Brand`, a starter project that demonstrates reuse for another brand without code changes.

## Environment Variables

Copy `.env.example` to `.env` for local development or create a server-only env file such as `/opt/reelai/.env` for ECS. Keep real values out of git.

Required:

- `DASHSCOPE_API_KEY`: QwenCloud API key, server-side only.
- `DATABASE_URL`: PostgreSQL connection string.
- `OSS_REGION`: Alibaba Cloud OSS region.
- `OSS_BUCKET`: OSS bucket for generated artifacts.
- `OSS_ACCESS_KEY_ID`: OSS access key id.
- `OSS_ACCESS_KEY_SECRET`: OSS access key secret.
- `PUBLIC_APP_URL`: public app origin used for artifact/render callbacks and local URLs.

Optional:

- `REDIS_URL`: reserved for a future queue upgrade.
- `QWEN_BASE_URL`: structured text endpoint override. Defaults in code to `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`.
- `QWEN_VIDEO_BASE_URL`, `QWEN_IMAGE_BASE_URL`, `QWEN_TTS_BASE_URL`: media endpoint overrides. Default in code to `https://dashscope-intl.aliyuncs.com/api/v1`.
- `QWEN_I2V_MODEL`: scene-video model override. Defaults to `wan2.7-i2v`; set a dated Wan 2.7 ID if that is what your QwenCloud region exposes.
- `QWEN_VIDEO_RESOLUTION`: `720P` by default; set `1080P` for higher-resolution live exports after considering the additional per-second generation cost.
- `SENTRY_DSN`: production error monitoring.

## QwenCloud Usage

QwenCloud calls are made only from server-side modules. The judging-visible compatible base URL is in [apps/web/lib/qwen/client.ts](apps/web/lib/qwen/client.ts):

```text
https://dashscope-intl.aliyuncs.com/compatible-mode/v1
```

Model defaults used by the MVP:

- Structured Brand Kit, concepts, storyboard, and policy review: `qwen3.6-plus`.
- Image/keyframe generation: `wan2.7-image-pro`.
- Single-anchor scene generation: `wan2.7-i2v` by default; override with `QWEN_I2V_MODEL` when a region requires a dated Wan 2.7 model ID or a compatible legacy model.
- Narration: `qwen3-tts-flash`.

Secrets, raw private uploads, and full prompts must not be logged in production.

## Development Commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm e2e
pnpm format
```

The Playwright suite may reuse an existing `pnpm dev` server and therefore its configured database. Browser-test projects are named with the `[ReelAI E2E]` prefix and are removed through the application API at both the start and end of every run, including their stored artifacts. This works for local and deployed smoke tests and prevents fixtures such as `example.com` from appearing in the Projects list. Do not use that reserved prefix for projects you want to keep. If a dev server or test runner is interrupted mid-generation, jobs abandoned for more than 10 minutes no longer prevent their project from being deleted.

Inside a selected project, use the horizontal stage rail or the Previous/Next controls to move through the workflow. Brand Kit essentials (summary, audience, tone, value props, and palette) remain visible by default; visual motifs, approved claims, policy risks, and citations are grouped into expandable guardrail panels. Project uploads and generated artifacts live in the Assets stage.

Hover over or keyboard-focus a consequential action to open the Reel AI guide. The tooltip describes the outcome before you commit, and `Escape` dismisses it from the keyboard.

Run a deployed smoke test against an existing URL:

```bash
PLAYWRIGHT_BASE_URL=https://your-demo-domain.example \
PLAYWRIGHT_SKIP_WEBSERVER=1 \
pnpm --filter web e2e
```

## Docker

Build the production image:

```bash
pnpm docker:build
```

Run the local Docker Compose stack:

```bash
cp .env.example .env
pnpm compose:migrate
pnpm compose:up
```

`docker-compose.yml` includes:

- `web`: production Next.js app.
- `postgres`: local/hackathon PostgreSQL service.
- `migrate`: explicit migration and seed profile.

Migrations and seeds are explicit commands, not hidden app startup side effects.

## Alibaba Deployment

The MVP deployment target is Alibaba Cloud ECS with Docker Compose, RDS PostgreSQL preferred, and Alibaba Cloud OSS for durable artifacts.

Deployment guide:

- [scripts/deploy/README.md](scripts/deploy/README.md)

Minimum deployment flow:

```bash
docker compose --env-file /opt/reelai/.env build web
docker compose --env-file /opt/reelai/.env --profile setup run --rm migrate
docker compose --env-file /opt/reelai/.env up -d web
```

Security group guidance:

- Allow inbound `80` and `443`.
- Use temporary inbound `3000` only for a direct hackathon smoke test.
- Do not expose PostgreSQL publicly.

## Judging Proof

Judging checklist:

- [docs/judging-package.md](docs/judging-package.md)

Fill these before final submission:

- Public deployed app URL: `http://47.84.226.89`
- 1 to 3 minute demo video: post-Phase 8 final submission item
- Alibaba Cloud ECS/Workbench proof screenshot or recording: [apps/web/public/alibaba_deployment_proof.png](apps/web/public/alibaba_deployment_proof.png)
- OSS bucket proof screenshot or recording: [apps/web/public/oss_bucket_proof.png](apps/web/public/oss_bucket_proof.png)
- Source file with visible QwenCloud base URL: [apps/web/lib/qwen/client.ts](apps/web/lib/qwen/client.ts)
- Architecture diagram: [docs/architecture.md](docs/architecture.md)

The demo should show intake, Brand Kit, exactly three concepts, selected storyboard, generation console, narration/final render, artifact durability, and reuse for a second brand.

## Open-Source Repo Hygiene

Included:

- `LICENSE`
- `.env.example`
- `.gitignore`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`
- `docs/architecture.md`
- ADRs in `docs/decisions/`

Ignored:

- `.env` and `.env.*`
- generated media
- local data directories
- browser test artifacts

## Security

Do not commit `.env`, generated private media, API keys, provider URLs containing credentials, screenshots with visible secrets, or private uploaded brand materials. Report vulnerabilities using [SECURITY.md](SECURITY.md).
