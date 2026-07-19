# Contributing

Thanks for helping improve Reel AI. This is a preliminary hackathon project, so contributions should stay focused, easy to review, and compatible with the existing architecture.

## Before You Start

- Search existing issues and pull requests to avoid duplicate work.
- Open an issue before a large feature, provider change, schema redesign, or architectural rewrite.
- Small bug fixes, tests, and documentation corrections can go directly to a pull request.
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md), and report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## Setup

Follow the [README local setup](README.md#local-setup). In summary:

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d postgres
pnpm db:migrate
pnpm dev
```

For the bundled PostgreSQL container, set `DATABASE_URL=postgresql://reelai:reelai@localhost:5432/reelai` in `.env`. A real `DASHSCOPE_API_KEY` is needed only when manually testing model-backed generation. Leave OSS placeholders in place for local artifact storage.

Create a branch from the latest `main` rather than working directly on `main`.

## Change Guidelines

- Keep each pull request limited to one feature or fix.
- Follow the existing TypeScript, React, Next.js, Prisma, and Tailwind patterns.
- Add or update tests when behavior changes. Bug fixes should include a regression test when practical.
- Preserve server-only handling for Model Studio, OSS, and database credentials.
- Do not log or commit API keys, AccessKeys, signed URLs, private prompts, uploaded content, generated customer media, `.env` files, or local data.
- Update documentation when setup, environment variables, deployment, behavior, or architecture changes.
- Include screenshots or a short recording for visible UI changes, with private information removed.

### Database Changes

When changing `prisma/schema.prisma`:

1. Create a named development migration with `pnpm prisma migrate dev --name short_description`.
2. Review the generated SQL and protect existing data.
3. Commit the schema and new `prisma/migrations/.../migration.sql` together.
4. Do not edit a migration that has already been merged; add a new migration instead.

## Checks

Run the fast checks before opening a pull request:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Check formatting for the files you changed, for example `pnpm exec prettier --check README.md`. Pass every changed file path to that command.

Also run `pnpm build` for routing, server/client boundary, or production dependency changes. Run `pnpm e2e` for browser flows when Chrome and a disposable test database are available. The E2E suite creates and removes projects prefixed `[ReelAI E2E]`; do not point it at data you cannot replace.

If a check cannot be run, say which check and why in the pull request.

## Pull Requests and Issues

A pull request should explain the problem, the solution, user-visible effects, relevant tests, and any migration or environment changes. Keep formatting-only churn separate from functional changes.

Bug reports should include the affected commit, reproduction steps, expected behavior, actual behavior, environment details, and sanitized logs. Feature requests should describe the user problem and note any effect on model cost, storage, privacy, or deployment.
