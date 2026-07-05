# ADR 0001: Core Stack For Hackathon MVP

Date: July 5, 2026

## Status

Accepted

## Context

Reel AI needs a usable UI, secure server-side QwenCloud calls, uploads, database access, background-like job orchestration, media composition, and Alibaba Cloud deployment. The hackathon timeline favors a smaller number of moving parts.

## Decision

Use:

- Next.js App Router with TypeScript for UI and API routes.
- PostgreSQL with Prisma for durable data and job state.
- Alibaba Cloud OSS for artifacts.
- QwenCloud for text, vision, image, video, and TTS.
- Remotion for final video composition.
- ECS + Docker Compose for MVP deployment.
- Postgres-backed jobs instead of Redis/Tair for MVP.

## Consequences

Benefits:

- One deployable full-stack app for the hackathon.
- Fewer services to configure.
- Server-side API keys stay out of the browser.
- Job state is inspectable in the database.
- ECS proof is easy to capture for judges.

Tradeoffs:

- Postgres jobs are not ideal for high-volume production queues.
- ECS requires more manual server setup than a fully managed platform.
- Remotion rendering inside the app container may need separation later.

## Future Revisit

After the hackathon, revisit:

- Dedicated worker service.
- Tair/Redis queue.
- Function Compute or Container Service deployment.
- Multi-format render pipeline.

