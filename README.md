# Reel AI

Reel AI is an AI showrunner studio for short-form business ads and story-led social videos. The MVP turns a business website and brand materials into a Brand Kit, three creative directions, an editable storyboard, QwenCloud-generated assets, narration, and a vertical reel export.

## Features

- Next.js App Router studio in `apps/web`.
- TypeScript, Tailwind CSS, ESLint, Prettier, Vitest, and pnpm workspaces.
- shadcn/ui-compatible component setup using Radix primitives.
- Prisma/PostgreSQL foundation for project data.
- Server-side environment validation with Zod.
- Architecture docs with a Mermaid system diagram.

## Architecture

See [docs/architecture.md](docs/architecture.md) for the target MVP architecture, runtime components, data flow, and Alibaba Cloud deployment topology.

## Local Setup

1. Install Node.js 20 or newer and pnpm.
2. Copy `.env.example` to `.env` and replace placeholders with local development values.
3. Install dependencies:

```bash
pnpm install
```

4. Start the studio:

```bash
pnpm dev
```

5. Open `http://localhost:3000`.

## Environment Variables

Required values are documented in `.env.example`:

- `DASHSCOPE_API_KEY`
- `QWEN_BASE_URL`
- `DATABASE_URL`
- `OSS_REGION`
- `OSS_BUCKET`
- `OSS_ACCESS_KEY_ID`
- `OSS_ACCESS_KEY_SECRET`
- `PUBLIC_APP_URL`

Optional values include Redis, split Qwen media endpoints, and Sentry DSN.

## QwenCloud Setup

Phase 1 does not execute QwenCloud API calls. Later phases will use `DASHSCOPE_API_KEY` only from server-side code and will keep the QwenCloud compatible base URL visible in source for judging proof.

## Development Commands

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Alibaba Deployment

The MVP deployment target is Alibaba Cloud ECS with Docker Compose, PostgreSQL/RDS, and Alibaba Cloud OSS for artifacts. Deployment scripts and proof assets are added in later phases.

## Judging Proof

Before submission, this section should link to:

- Public deployed app URL.
- Alibaba Cloud console or Workbench proof screenshot.
- Demo video.
- QwenCloud usage source files.

## Security

Do not commit `.env`, generated media, API keys, provider URLs containing credentials, or private uploaded brand materials. Report vulnerabilities using the instructions in [SECURITY.md](SECURITY.md).
