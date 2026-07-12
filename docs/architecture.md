# Reel AI Architecture

Updated: July 12, 2026

This document describes the target MVP architecture. The implementation source of truth is `docs/implementation-guide.md`.

## System Diagram

```mermaid
flowchart TB
  User["User / Judge"] --> Web["Next.js Studio UI"]
  Web --> Api["Next.js API Routes"]

  Api --> Db["PostgreSQL + Prisma"]
  Api --> Oss["Alibaba Cloud OSS"]
  Api --> Jobs["Postgres GenerationJob Table"]

  Api --> QwenText["QwenCloud Text / Structured Output"]
  Api --> QwenVision["QwenCloud Vision"]
  Api --> QwenImage["QwenCloud Image Generation"]
  Api --> QwenVideo["QwenCloud Video Generation"]
  Api --> QwenTts["QwenCloud TTS"]

  Jobs --> Worker["Job Runner / API-triggered Worker Loop"]
  Worker --> QwenText
  Worker --> QwenVision
  Worker --> QwenImage
  Worker --> QwenVideo
  Worker --> QwenTts
  Worker --> Oss
  Worker --> Remotion["Remotion Renderer"]
  Remotion --> Oss

  Oss --> Web
  Db --> Web
```

## Runtime Components

- `apps/web`: Next.js App Router application containing the studio UI and route handlers.
- `apps/web/lib/qwen`: server-only QwenCloud clients.
- `apps/web/lib/agents`: orchestration for Brand Kit, concepts, storyboard, policy review, and production steps.
- `apps/web/lib/jobs`: Postgres-backed job creation, claiming, polling, and status updates.
- `apps/web/lib/oss`: Alibaba Cloud OSS upload/download helpers.
- `apps/web/remotion`: MP4 composition and export.
- `prisma`: schema, migrations, seed data.

## Main Data Flow

1. User supplies a company website and, optionally, a short creative direction. Advanced project fields remain available but are not required for the primary flow.
2. The API persists the project and website source, infers placeholder identity from the hostname when needed, creates a queued `BRAND_KIT` job, and returns immediately. Next.js `after()` starts the job after the response so navigation is not held open by model latency.
3. Brand research follows a small set of same-origin product/about links and collects metadata, visible copy, CSS/HTML color candidates, and likely logo/social-image URLs. Uploaded assets are stored in OSS as `Artifact` rows.
4. QwenCloud vision analyzes accessible website and uploaded visuals; structured generation combines that evidence with text sources and saves the reusable `BrandKit`.
5. Concept job calls QwenCloud text for three concepts and image generation for preview frames.
6. User selects a concept.
7. Storyboard job creates editable scenes with prompts, captions, narration text, and continuity notes.
8. Keyframe job generates start/end scene images and stores them in OSS.
9. Video job submits i2v tasks and polls QwenCloud until clips are complete.
10. TTS job generates narration audio.
11. Render job uses Remotion to produce the final 9:16 MP4 and thumbnail.
12. Final artifacts are stored in OSS and displayed in the studio.

## Project and Brand Kit boundary

Project setup and initial Brand Kit generation are one user action, but remain separate domain operations. The project is the durable workspace; Brand Kit generation is a retryable, versionable job. This preserves fast navigation, failure isolation, regeneration, source uploads, and future queue/worker migration. A failed research run never rolls back or loses the project.

Trade-offs:

- Automatic generation spends model tokens on every URL-first project. The API retains `generateBrandKit: false` for programmatic or advanced creation paths.
- Hostname-derived names are temporary context, not asserted brand facts; researched content supplies the actual Brand Kit evidence.
- Lightweight crawling is intentionally bounded to the homepage and up to three relevant same-origin pages. JavaScript-only or bot-protected sites may still need uploaded brand assets.
- `after()` is suitable for the current MVP deployment. Production scale should move job execution to a durable worker/queue so work survives process restarts and supports retries/backoff.

## Deployment Topology

MVP deployment uses Alibaba Cloud ECS + Docker Compose:

- `web` container: Next.js app, API routes, lightweight worker loop, and Remotion renderer.
- PostgreSQL: RDS preferred; Docker Compose Postgres allowed for hackathon-only proof.
- OSS: persistent storage for uploads, generated images, clips, audio, thumbnails, and final render.

Function Compute is a later deployment option. ECS is the MVP default because video polling and media rendering are easier to debug.

## Security Boundaries

- QwenCloud and OSS credentials are server-side only.
- `.env` is ignored and must not be committed.
- Client components receive artifact IDs/URLs and job statuses, never API keys.
- Logs must include model/task/status metadata but must not include secrets.
- Provider URLs that expire are copied into OSS before being treated as durable artifacts.
- Website crawling is bounded by page count, response timeout, content type, and response size. Production hardening should also add DNS/IP allow-list checks to prevent SSRF and a robots/terms policy appropriate to the deployment.

## MVP Scalability Limits

- Jobs are stored in Postgres, not Redis.
- Polling is app-driven and suitable for hackathon/demo scale.
- Long-running high-volume rendering is not supported in MVP.
- Generated 60-second reels are stretch; the reliable target is 15 to 30 seconds.
