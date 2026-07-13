# Reel AI

Reel AI is an AI showrunner studio for short-form business ads and story-led social videos. It takes a business website and optional brand materials, builds a reusable Brand Kit, pitches three distinct creative concepts, creates an editable storyboard, generates QwenCloud-powered keyframes/video/narration, and exports a vertical 9:16 reel with captions, safe zones, optional BGM, and AI disclosure.

The project is built for the QwenCloud hackathon Track 2, AI Showrunner. The repo is intentionally public-submission friendly: no committed secrets, visible server-side QwenCloud usage, reproducible Docker deployment, and a judging checklist.

## Features

- Next.js App Router studio in `apps/web`.
- Prisma/PostgreSQL project graph with projects, sources, artifacts, jobs, concepts, storyboards, takes, narration, and renders.
- Server-side QwenCloud clients for structured text, vision, image generation, video generation, and TTS.
- URL-first project creation that automatically queues Brand Kit research; project and business names can be inferred from the website.
- Focused two-column landing workspace with optional pipeline guidance and confirmed project deletion, including local/OSS artifact cleanup.
- Focused horizontal project workflow with six navigable stages: Brand, Concepts, Storyboard, Production, Final, and Assets. Stage readiness and completion are visible at a glance, and switching stages preserves in-progress client state.
- Reusable Brand Kit with value props, palette, claims, policy risks, locked style language, and citations.
- Multi-page website evidence collection covering metadata, visible copy, CSS color candidates, logos/social images, and QwenCloud visual analysis.
- Evidence-capability guardrails: website-only projects cannot manufacture product UI, logos, branded uniforms, badges, packaging, or unsupported trust claims.
- Pre-spend concept validation and post-generation visual grounding review; previews that fail review are replaced with an honest local concept card.
- Exactly three creative concepts before full generation spend, with optional note-guided regeneration of one direction without replacing the other two.
- Visual 2 to 4 scene storyboard filmstrip with side-by-side first/last frames, explicit stitch transitions, a product/character/visual-world continuity bible, and a human approval loop.
- Continuity-aware keyframes reuse uploaded visual references when available and chain generated scene endpoints across continuous or match-cut transitions; plot-required intentional changes remain explicit.
- Additive keyframe/video takes with selection instead of destructive regeneration.
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

Application-only updates that do not add a Prisma migration require only a restart of `pnpm dev`; do not run `pnpm db:migrate` or `pnpm db:generate` unless the change includes an update under `prisma/migrations` or `prisma/schema.prisma`. The storyboard continuity-bible update does include a migration, so existing local checkouts must run `pnpm db:migrate` once and then restart `pnpm dev`.

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
- `SENTRY_DSN`: production error monitoring.

## QwenCloud Usage

QwenCloud calls are made only from server-side modules. The judging-visible compatible base URL is in [apps/web/lib/qwen/client.ts](apps/web/lib/qwen/client.ts):

```text
https://dashscope-intl.aliyuncs.com/compatible-mode/v1
```

Model defaults used by the MVP:

- Structured Brand Kit, concepts, storyboard, and policy review: `qwen3.6-plus`.
- Image/keyframe generation: `wan2.7-image-pro`.
- Image-to-video scene generation: `happyhorse-1.1-i2v` or the configured supported i2v model.
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
