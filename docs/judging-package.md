# Judging Package

Use this document as the submission checklist for Reel AI.

## Required Links

Fill these before final Devpost submission:

- Public deployed app URL: `http://47.84.226.89`
- Demo video, 1 to 3 minutes: post-Phase 8 final submission item
- Alibaba Cloud deployment proof screenshot or recording: `apps/web/public/alibaba_deployment_proof.png`
- OSS proof screenshot or recording: `apps/web/public/oss_bucket_proof.png`
- Source file with visible QwenCloud base URL: `apps/web/lib/qwen/client.ts`
- Architecture diagram: `docs/architecture.md`

## Demo Script

1. Open the deployed Reel AI URL.
2. Show the seeded `Demo Launch Reel` project for Northstar Coffee.
3. Point out the Brand Kit, exactly three concepts, selected concept, editable storyboard, generation console, and final render panel.
4. Create a new project for a second brand from the intake form.
5. Add a URL source and upload a tiny logo/image file.
6. Trigger the Brand Kit, concepts, storyboard, keyframe/video, narration, and render steps if real QwenCloud/OSS credentials are configured.
7. Show model names, job statuses, provider task IDs where available, artifact links, final MP4 playback, and download.
8. Show the Alibaba Cloud proof asset and briefly explain ECS + Docker Compose + Postgres + OSS.

## Success Criteria

- The public URL loads the studio, not a local-only recording.
- The app creates a second-brand project without code changes.
- The pipeline shows server-side QwenCloud usage and durable artifacts.
- No secrets appear in the repo, screenshots, logs, or video.
- The README links to setup, deployment, architecture, and proof evidence.

## Phase 7 Evidence Status

Implemented and verified:

- Dockerfile and Docker Compose deployment files exist.
- ECS deployment is live at `http://47.84.226.89`.
- Production env vars are configured on the ECS server, not in git.
- Production app generates real QwenCloud images and stores generated artifacts through the configured artifact pipeline.
- Public URL returned `HTTP/1.1 200 OK` on July 12, 2026.
- Repo contains visible QwenCloud base URL usage in `apps/web/lib/qwen/client.ts`.
- Repo hygiene check found no committed real `.env` file.
- README and deployment runbook document setup, env vars, QwenCloud usage, Alibaba deployment, security notes, and judging proof.

Human-owned evidence completed for Phase 7:

- Alibaba Cloud ECS or Workbench proof screenshot added at `apps/web/public/alibaba_deployment_proof.png`.
- OSS bucket proof screenshot added at `apps/web/public/oss_bucket_proof.png`.
- Deployed end-to-end demo path was manually tested in production and confirmed to persist.
- Second-brand reuse flow was manually tested in production and confirmed to work without code changes.

Post-Phase 8 final submission item:

- Record and link the 1 to 3 minute demo video after final polish is complete.

## Human-Owned Evidence

The repository contains all reproducible deployment files, but these proof assets require human cloud account access:

- Alibaba Cloud ECS console or Workbench screenshot.
- OSS bucket configuration screenshot.
- Public deployed URL.
- Final 1 to 3 minute demo recording after Phase 8 polish.
