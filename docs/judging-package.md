# Judging Package

Use this document as the submission checklist for Reel AI.

## Required Links

Fill these before final Devpost submission:

- Public deployed app URL: `TBD`
- Demo video, 1 to 3 minutes: `TBD`
- Alibaba Cloud deployment proof screenshot or recording: `TBD`
- OSS proof screenshot or recording: `TBD`
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

## Human-Owned Evidence

The repository contains all reproducible deployment files, but these proof assets require human cloud account access:

- Alibaba Cloud ECS console or Workbench screenshot.
- OSS bucket configuration screenshot.
- Public deployed URL.
- Final 1 to 3 minute demo recording.
