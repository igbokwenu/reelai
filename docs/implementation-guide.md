# Reel AI Implementation Guide

Updated: July 5, 2026

This is the build contract for Reel AI. When implementation agents need to choose between options, follow this guide first, then `docs/reel-ai-blueprint.md`, then the QwenCloud docs in `docs/qwencloud-reference-links.md`.

## Product Being Built

Reel AI is a short-form AI showrunner for business ads and story-led social videos. The app takes a business website and optional brand materials, builds a reusable Brand Kit, pitches three distinct creative concepts, lets the user select and edit a storyboard, generates continuity-aware keyframes and video scenes with QwenCloud, adds narration/captions/optional BGM, and exports a vertical reel.

## Non-Negotiable MVP

Build only this before stretch work:

- One deployed Next.js full-stack app.
- Public open-source repo with `LICENSE`, `.env.example`, `.gitignore`, setup docs, and architecture docs.
- No committed secrets. `.env` must stay ignored.
- QwenCloud client code visibly includes `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`.
- User can create a project from a website URL plus optional uploads.
- App generates a Brand Kit.
- App generates exactly three creative concepts with one preview frame each.
- User selects one concept.
- App generates and displays an editable storyboard.
- App generates keyframes for 2 to 4 scenes.
- App generates 2 to 4 image-to-video clips for a reliable 15 to 30 second reel.
- App generates narration with Qwen TTS.
- App renders one 9:16 MP4 with captions, safe zones, optional AI disclosure, optional uploaded/sample BGM, and thumbnail.
- App shows live job status, model names, task IDs, artifacts, and estimated cost/time.
- App is deployed on Alibaba Cloud and has proof screenshot/recording.

Do not build these until the MVP above works:

- Lip sync.
- Ad-platform publishing.
- Multi-user billing.
- Complex collaboration.
- Full generated music.
- Full multi-format export.
- Guaranteed 60-second render.
- Spokesperson mode.

## Final Tech Stack

Use these choices. Do not swap frameworks without an explicit decision note in `docs/decisions/`.

### App

- Framework: Next.js App Router.
- Language: TypeScript.
- Package manager: `pnpm`.
- Runtime target: Node.js 20.
- Styling: Tailwind CSS.
- UI primitives: shadcn/ui on top of Radix UI.
- Icons: lucide-react.
- Forms: React Hook Form + Zod.
- Server validation: Zod.
- Data fetching/client cache: TanStack Query.
- Local editor state: Zustand.
- Motion: Framer Motion, only for meaningful state transitions.
- Composition/export: Remotion.
- Database: PostgreSQL.
- ORM: Prisma.
- Job orchestration: Postgres-backed `GenerationJob` table for MVP.
- Object storage: Alibaba Cloud OSS.
- Deployment: Alibaba Cloud ECS + Docker Compose for MVP.
- Tests: Vitest for unit tests; Playwright for smoke/e2e tests.
- Formatting/linting: Prettier + ESLint.

### AI

- Text/structured planning: QwenCloud `qwen3.6-plus`.
- Final heavy reasoning pass only when needed: `qwen3.7-max`.
- Vision/brand material understanding: QwenCloud vision models; verify current model IDs before implementation freeze.
- Preview/keyframe image generation: `wan2.7-image-pro` by default; use `wan2.7-image` for faster drafts if available.
- Video generation: default to image-to-video with `happyhorse-1.1-i2v` or the latest supported Wan i2v model verified by CLI/docs.
- TTS: `qwen3-tts-flash` for MVP; `qwen3-tts-instruct-flash` if tone control is needed.
- Do not hardcode exact pricing. Store estimates as nullable metadata and label them estimates.

## Repository Layout

Create this structure:

```text
.
├── apps/
│   └── web/
│       ├── app/
│       │   ├── (studio)/
│       │   │   ├── page.tsx
│       │   │   └── projects/[projectId]/page.tsx
│       │   ├── api/
│       │   │   ├── projects/route.ts
│       │   │   ├── projects/[projectId]/sources/route.ts
│       │   │   ├── projects/[projectId]/brand-kit/route.ts
│       │   │   ├── projects/[projectId]/concepts/route.ts
│       │   │   ├── projects/[projectId]/storyboard/route.ts
│       │   │   ├── projects/[projectId]/keyframes/route.ts
│       │   │   ├── projects/[projectId]/videos/route.ts
│       │   │   ├── projects/[projectId]/render/route.ts
│       │   │   ├── jobs/[jobId]/route.ts
│       │   │   └── artifacts/[artifactId]/route.ts
│       │   ├── layout.tsx
│       │   └── globals.css
│       ├── components/
│       │   ├── studio/
│       │   ├── storyboard/
│       │   ├── generation/
│       │   ├── media/
│       │   └── ui/
│       ├── lib/
│       │   ├── env.ts
│       │   ├── prisma.ts
│       │   ├── qwen/
│       │   ├── oss/
│       │   ├── jobs/
│       │   ├── agents/
│       │   ├── schemas/
│       │   └── security/
│       └── remotion/
│           ├── ReelComposition.tsx
│           └── render.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── docs/
│   ├── implementation-guide.md
│   ├── reel-ai-blueprint.md
│   ├── qwencloud-reference-links.md
│   ├── architecture.md
│   └── decisions/
├── scripts/
│   ├── smoke-qwen.ts
│   ├── render-demo.ts
│   └── deploy/
├── docker-compose.yml
├── Dockerfile
├── README.md
├── LICENSE
├── .env.example
└── .gitignore
```

## Environment Contract

Use `apps/web/lib/env.ts` to validate all required env vars at startup with Zod.

Required:

```text
DASHSCOPE_API_KEY
QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
DATABASE_URL
OSS_REGION
OSS_BUCKET
OSS_ACCESS_KEY_ID
OSS_ACCESS_KEY_SECRET
PUBLIC_APP_URL
```

Optional:

```text
REDIS_URL
QWEN_VIDEO_BASE_URL
QWEN_IMAGE_BASE_URL
QWEN_TTS_BASE_URL
SENTRY_DSN
```

Rules:

- Never read `.env` contents in logs, docs, UI, or error responses.
- Never commit `.env` or `.env.*`.
- `.env.example` must use placeholders only.
- Server routes may use `DASHSCOPE_API_KEY`; client components must never receive it.

## Database Schema

Use Prisma. Implement these models first. Add fields only when needed by a shipped workflow.

```prisma
model Project {
  id              String   @id @default(cuid())
  name            String
  businessName    String
  websiteUrl      String?
  targetAudience  String?
  offer           String?
  videoLengthSec  Int      @default(30)
  style           VideoStyle
  status          ProjectStatus @default(DRAFT)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  brandKit        BrandKit?
  sources         BrandSource[]
  concepts        CreativeConcept[]
  storyboard      Storyboard?
  jobs            GenerationJob[]
  artifacts       Artifact[]
  renders         Render[]
}

model BrandKit {
  id              String   @id @default(cuid())
  projectId       String   @unique
  summary         String
  valueProps      Json
  audience        String?
  tone            String
  palette         Json
  visualMotifs    Json
  claims          Json
  policyRisks     Json
  sourceCitations Json
  lockedStyle     String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

model BrandSource {
  id          String @id @default(cuid())
  projectId   String
  type        SourceType
  url         String?
  artifactId  String?
  extractedText String?
  metadata    Json?
  createdAt   DateTime @default(now())

  project     Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

model CreativeConcept {
  id                String @id @default(cuid())
  projectId          String
  title              String
  hook               String
  strategy           String
  narrativeArc       String
  visualStyle        String
  estimatedScenes    Int
  estimatedDuration  Int
  previewPrompt      String
  previewArtifactId  String?
  selected           Boolean @default(false)
  rationale          String
  createdAt          DateTime @default(now())

  project            Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

model Storyboard {
  id          String @id @default(cuid())
  projectId   String @unique
  conceptId   String
  title       String
  script      String
  bgmPrompt   String?
  bgmEnabled  Boolean @default(true)
  status      StoryboardStatus @default(DRAFT)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  project     Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  scenes      Scene[]
}

model Scene {
  id                  String @id @default(cuid())
  storyboardId         String
  index               Int
  durationSec          Int
  captionText          String
  voiceoverText        String
  startFramePrompt     String
  endFramePrompt       String
  videoMotionPrompt    String
  lockedStyleLanguage  String
  safeZonePreset       SafeZonePreset @default(TIKTOK_REELS)
  status              SceneStatus @default(DRAFT)
  selectedKeyframeTakeId String?
  selectedVideoTakeId    String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  storyboard          Storyboard @relation(fields: [storyboardId], references: [id], onDelete: Cascade)
  takes               Take[]
}

model Take {
  id          String @id @default(cuid())
  sceneId     String
  kind        TakeKind
  attempt     Int
  prompt      String
  artifactId  String?
  status      TakeStatus @default(QUEUED)
  selected    Boolean @default(false)
  notes       String?
  createdAt   DateTime @default(now())

  scene       Scene @relation(fields: [sceneId], references: [id], onDelete: Cascade)
}

model GenerationJob {
  id          String @id @default(cuid())
  projectId   String
  type        JobType
  status      JobStatus @default(QUEUED)
  model       String?
  providerTaskId String?
  input       Json
  output      Json?
  error       String?
  startedAt   DateTime?
  completedAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  project     Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

model Artifact {
  id          String @id @default(cuid())
  projectId   String
  type        ArtifactType
  ossKey      String
  publicUrl   String?
  mimeType    String
  width       Int?
  height      Int?
  durationSec Float?
  metadata    Json?
  createdAt   DateTime @default(now())

  project     Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

model Render {
  id          String @id @default(cuid())
  projectId   String
  artifactId  String?
  status      RenderStatus @default(QUEUED)
  format      String @default("9:16")
  settings    Json
  createdAt   DateTime @default(now())
  completedAt DateTime?

  project     Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

Enums:

```prisma
enum VideoStyle { REALISTIC THREE_D_ANIMATION }
enum ProjectStatus { DRAFT RESEARCHING CONCEPTING STORYBOARDING GENERATING RENDERING COMPLETE FAILED }
enum SourceType { WEBSITE UPLOAD LOGO PRODUCT_IMAGE DOCUMENT REFERENCE_AD }
enum StoryboardStatus { DRAFT APPROVED GENERATING COMPLETE }
enum SceneStatus { DRAFT APPROVED GENERATING COMPLETE FAILED }
enum SafeZonePreset { TIKTOK_REELS YOUTUBE_SHORTS NONE }
enum TakeKind { KEYFRAME_START KEYFRAME_END VIDEO }
enum TakeStatus { QUEUED RUNNING COMPLETE FAILED }
enum JobType { BRAND_KIT CONCEPTS KEYFRAME VIDEO TTS RENDER POLICY_REVIEW }
enum JobStatus { QUEUED RUNNING WAITING_PROVIDER COMPLETE FAILED CANCELLED }
enum ArtifactType { IMAGE VIDEO AUDIO DOCUMENT THUMBNAIL FINAL_RENDER }
enum RenderStatus { QUEUED RUNNING COMPLETE FAILED }
```

## API Contract

All route handlers must:

- Validate request bodies with Zod.
- Return JSON only.
- Never return stack traces or secrets.
- Persist a `GenerationJob` for any QwenCloud or render operation that can take more than 3 seconds.
- Return `{ jobId }` for async work.

Required endpoints:

| Endpoint                                                    | Method  | Purpose                                                 | Sync/async                                    |
| ----------------------------------------------------------- | ------- | ------------------------------------------------------- | --------------------------------------------- |
| `/api/projects`                                             | `POST`  | Create project                                          | sync                                          |
| `/api/projects/[projectId]`                                 | `GET`   | Fetch full project graph                                | sync                                          |
| `/api/projects/[projectId]/sources`                         | `POST`  | Upload/register sources                                 | sync for metadata, async extraction if needed |
| `/api/projects/[projectId]/brand-kit`                       | `POST`  | Generate Brand Kit                                      | async                                         |
| `/api/projects/[projectId]/concepts`                        | `POST`  | Generate three concepts and preview frames              | async                                         |
| `/api/projects/[projectId]/concepts/[conceptId]/regenerate` | `POST`  | Regenerate one concept with an optional adjustment note | async                                         |
| `/api/projects/[projectId]/concepts/[conceptId]/select`     | `POST`  | Select concept                                          | sync                                          |
| `/api/projects/[projectId]/storyboard`                      | `POST`  | Generate storyboard from selected concept               | async                                         |
| `/api/storyboards/[storyboardId]`                           | `PATCH` | Edit storyboard/scenes                                  | sync                                          |
| `/api/projects/[projectId]/keyframes`                       | `POST`  | Generate scene keyframes                                | async                                         |
| `/api/projects/[projectId]/videos`                          | `POST`  | Generate scene videos                                   | async                                         |
| `/api/projects/[projectId]/tts`                             | `POST`  | Generate narration                                      | async                                         |
| `/api/projects/[projectId]/render`                          | `POST`  | Render final MP4                                        | async                                         |
| `/api/jobs/[jobId]`                                         | `GET`   | Poll job status                                         | sync                                          |
| `/api/artifacts/[artifactId]`                               | `GET`   | Resolve artifact metadata/download URL                  | sync                                          |

Use typed response helpers in `apps/web/lib/http/responses.ts`.

## QwenCloud Client Contract

Create `apps/web/lib/qwen/client.ts`.

It must export:

```ts
export const QWEN_BASE_URL =
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";

export async function generateStructuredText<T>(
  input: StructuredTextInput<T>,
): Promise<T>;
export async function analyzeBrandAssets(
  input: VisionAnalysisInput,
): Promise<VisionAnalysisResult>;
export async function generateImage(
  input: ImageGenerationInput,
): Promise<ImageGenerationResult>;
export async function submitVideoTask(
  input: VideoGenerationInput,
): Promise<VideoTaskSubmission>;
export async function pollVideoTask(taskId: string): Promise<VideoTaskStatus>;
export async function generateTts(input: TtsInput): Promise<TtsResult>;
```

Rules:

- QwenCloud calls happen server-side only.
- The client must accept an injected `requestId` for logs.
- Log model, operation, elapsed time, provider task id, and sanitized errors.
- Do not log prompts containing uploaded private content unless `NODE_ENV !== "production"` and the log is explicitly redacted.
- For structured JSON, always use Zod schemas and validate the model output before saving.
- For async video tasks, save the provider `task_id` to `GenerationJob.providerTaskId`.

## Agent Output Schemas

Create schemas in `apps/web/lib/schemas/agent.ts`.

### Brand Kit Schema

```ts
export const BrandKitSchema = z.object({
  summary: z.string(),
  valueProps: z.array(z.string()).min(1).max(6),
  targetAudience: z.string(),
  tone: z.string(),
  palette: z.array(z.object({ hex: z.string(), label: z.string() })).max(8),
  visualMotifs: z.array(z.string()).max(10),
  claims: z.array(
    z.object({
      claim: z.string(),
      evidence: z.string().nullable(),
      source: z.string().nullable(),
      risk: z.enum(["low", "medium", "high"]),
    }),
  ),
  policyRisks: z.array(
    z.object({
      category: z.string(),
      reason: z.string(),
      severity: z.enum(["info", "warning", "blocker"]),
    }),
  ),
  lockedStyleLanguage: z.string(),
  sourceCitations: z.array(
    z.object({ label: z.string(), url: z.string().nullable() }),
  ),
});
```

### Creative Concepts Schema

Exactly three concepts:

```ts
export const CreativeConceptsSchema = z.object({
  concepts: z
    .array(
      z.object({
        title: z.string(),
        hook: z.string(),
        strategy: z.string(),
        narrativeArc: z.string(),
        visualStyle: z.string(),
        estimatedScenes: z.number().int().min(2).max(4),
        estimatedDurationSec: z.number().int().min(15).max(30),
        previewPrompt: z.string(),
        rationale: z.string(),
      }),
    )
    .length(3),
});
```

### Storyboard Schema

```ts
export const StoryboardSchema = z.object({
  title: z.string(),
  script: z.string(),
  bgm: z.object({
    enabled: z.boolean(),
    preset: z.string(),
    prompt: z.string(),
  }),
  scenes: z
    .array(
      z.object({
        index: z.number().int(),
        durationSec: z.number().int().min(4).max(15),
        captionText: z.string(),
        voiceoverText: z.string().max(600),
        startFramePrompt: z.string(),
        endFramePrompt: z.string(),
        videoMotionPrompt: z.string(),
        continuityNotes: z.string(),
      }),
    )
    .min(2)
    .max(4),
});
```

## Job State Machine

Use this state flow for all long-running operations:

```text
QUEUED -> RUNNING -> WAITING_PROVIDER -> RUNNING -> COMPLETE
QUEUED -> RUNNING -> FAILED
WAITING_PROVIDER -> FAILED
QUEUED/RUNNING/WAITING_PROVIDER -> CANCELLED
```

Implementation:

- `createJob(type, projectId, input)` inserts `QUEUED`.
- `runJob(jobId)` claims the job by setting `RUNNING`.
- For Qwen async tasks, set `WAITING_PROVIDER` with `providerTaskId`.
- Poll provider tasks from an API-triggered worker loop for MVP.
- Claim each polling pass before contacting the provider. A failed scene must not stop healthy sibling tasks from polling, and transient provider/download errors must remain `WAITING_PROVIDER` until the bounded processing window expires.
- Preflight every selected start/end frame before submitting any video task. Preserve the currently selected keyframe pair or clip until a full replacement succeeds.
- Expose a scene-level video retry for missing or failed clips. The retry creates a new take for only that scene and must not resubmit completed sibling scenes.
- Store all generated files as `Artifact` rows after upload/download to OSS.
- UI polls `/api/jobs/[jobId]` every 2 seconds until terminal.

Do not block an HTTP request waiting for multiple video scenes to finish.

## Frontend Information Architecture

Build one studio page first: `apps/web/app/(studio)/projects/[projectId]/page.tsx`.

Layout:

- Left rail: projects, current project status, render button.
- Top bar: project name, style, duration target, live cost/time estimate.
- Main panel tabs:
  - `Brand Kit`
  - `Concepts`
  - `Storyboard`
  - `Generation`
  - `Final Render`
- Right inspector:
  - Selected concept details.
  - Selected scene editor.
  - Take comparison.
  - Audio/BGM/export settings.

Required components:

```text
ProjectIntakeForm
SourceUploader
BrandKitPanel
ConceptTable
ConceptCard
StoryboardTimeline
SceneInspector
TakeCompare
GenerationConsole
ArtifactPreview
WaveformPreview
RenderSettingsPanel
FinalVideoPlayer
```

UI rules:

- No marketing landing page for MVP; the app opens into the studio.
- Do not use generic placeholder thumbnails after real artifacts exist.
- Buttons that trigger spend-heavy generation must show confirmation text and estimated scene count.
- Show model IDs and provider task IDs in a collapsible “Run details” panel.
- All failed jobs must show a retry button and sanitized error.
- Use icons from `lucide-react`.

## Styling Contract

Use a focused production-studio visual language.

Tailwind theme:

- Background: near-black charcoal, not blue-slate dominant.
- Surface: dark neutral with subtle borders.
- Accent: electric lime or signal green for active generation states.
- Secondary accent: warm amber for warnings/cost.
- Error: red.
- Text: high-contrast off-white and muted gray.

Typography:

- Body/control font: Inter or system sans.
- Display/accent font: one distinctive font for hooks and scene titles. If external font setup slows work, use system sans but keep size/weight hierarchy strong.

Motion:

- Use Framer Motion only for status transitions, concept reveal, timeline updates, and render completion reveal.
- Avoid decorative motion that does not communicate state.

Layout constraints:

- Desktop-first for hackathon demo.
- Must remain usable at 1280px width.
- Basic responsive behavior for tablet/mobile, but full mobile editing is not MVP.

## Media Pipeline

Artifact flow:

```text
Upload/source -> OSS -> QwenCloud input URL -> QwenCloud output URL -> download/server stream -> OSS -> Artifact row -> UI preview/render
```

Rules:

- Store generated assets in OSS, not only provider expiring URLs.
- Keep provider URL in artifact metadata for traceability.
- Use 9:16 vertical output for MVP.
- Safe zones must keep captions away from TikTok/Reels UI areas.
- AI disclosure overlay is optional but enabled by default for final exports.
- Final render filename format: `reelai-{projectId}-{timestamp}.mp4`.

Remotion composition inputs:

```ts
type ReelCompositionInput = {
  scenes: Array<{
    videoUrl: string;
    captionText: string;
    startTimeSec: number;
    durationSec: number;
  }>;
  narrationUrl?: string;
  bgmUrl?: string;
  brandWatermark?: { text?: string; logoUrl?: string };
  aiDisclosureEnabled: boolean;
  safeZonePreset: "TIKTOK_REELS" | "YOUTUBE_SHORTS" | "NONE";
};
```

## Deployment Contract

Use ECS + Docker Compose for MVP.

Docker services:

- `web`: Next.js app.
- `postgres`: only for hackathon/self-contained demo if RDS is not configured.

Production-like Alibaba setup:

- ECS instance runs Docker Compose.
- OSS bucket stores artifacts.
- RDS PostgreSQL preferred if setup time allows.
- Environment variables are configured on the server, not committed.
- Security group allows inbound `80` and `443`; restrict database ports.
- Capture Alibaba Cloud console/Workbench screenshot for submission proof.

Required deployment files:

```text
Dockerfile
docker-compose.yml
scripts/deploy/README.md
```

Dockerfile requirements:

- Use Node 20.
- Install dependencies with `pnpm`.
- Generate Prisma client during build.
- Run migrations/seed as documented commands, not hidden side effects.
- Start with `pnpm --filter web start` or equivalent.

## Open-Source Repo Standards

Before the repo is public:

- `LICENSE` exists. Use MIT unless there is a reason not to.
- `README.md` includes:
  - Product summary.
  - Feature list.
  - Architecture diagram link.
  - Local setup.
  - Environment variables.
  - QwenCloud setup.
  - Alibaba deployment guide.
  - Judging proof section.
  - Security note about secrets.
- `.env` is not tracked and is ignored.
- `.env.example` exists with placeholders.
- `CONTRIBUTING.md` exists with setup and issue/PR expectations.
- `CODE_OF_CONDUCT.md` exists.
- `SECURITY.md` tells users how to report secret leaks or vulnerabilities.
- `docs/architecture.md` exists.
- `docs/decisions/` contains ADRs for major choices.
- No generated videos/images are committed unless intentionally tiny demo fixtures.

## Initial Build Order For AI Agents

Follow this order exactly:

1. Scaffold Next.js monorepo with pnpm, TypeScript, Tailwind, ESLint, Prettier.
2. Add open-source repo files: README, LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY.
3. Add Prisma schema, migrations, and seed demo project.
4. Add env validation and QwenCloud client wrappers with mocked mode.
5. Build studio shell and project intake.
6. Build Brand Kit generation.
7. Build three-concept generation and preview frames.
8. Build storyboard generation and editor.
9. Build keyframe generation and artifact storage.
10. Build video scene generation and job polling.
11. Build TTS generation.
12. Build Remotion final render.
13. Add smoke tests and Playwright demo path.
14. Add Dockerfile and Docker Compose.
15. Deploy to Alibaba Cloud ECS.
16. Capture proof and record demo.

At every step, keep the app runnable. Do not merge a phase that breaks the previous phase.

## Phased Implementation Plan

Use these phases as the project tracker. A phase is complete only when every checkbox in its exit checklist is done. Do not begin stretch work until Phase 6 is complete.

### Phase 1: Foundation And Open-Source Repo

Goal: create a clean, secure, runnable project foundation that is safe to make public.

Build:

- Next.js App Router app in `apps/web`.
- pnpm workspace.
- TypeScript, Tailwind, ESLint, Prettier.
- shadcn/ui/Radix setup.
- Prisma/Postgres setup.
- Env validation in `apps/web/lib/env.ts`.
- Open-source repo files.
- Basic studio shell route.

Exit checklist:

- [ ] `pnpm install` works from repo root.
- [ ] `pnpm lint` passes.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test` runs with at least one placeholder/unit test.
- [ ] `.env` is ignored and not tracked.
- [ ] `.env.example` contains only placeholders.
- [ ] `README.md`, `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `SECURITY.md` exist.
- [ ] `docs/architecture.md` renders a Mermaid architecture diagram.
- [ ] App starts locally and shows the studio shell.

### Phase 2: Data Model, Project Intake, And Artifact Storage

Goal: make the app persist real projects, accept sources, and store durable artifacts.

Build:

- Prisma schema from this guide.
- Initial migration and seed script.
- `ProjectIntakeForm`.
- `SourceUploader`.
- Project detail page.
- Alibaba OSS helper in `apps/web/lib/oss`.
- Artifact creation and metadata retrieval.
- Project graph API.

Exit checklist:

- [ ] Database migration applies cleanly.
- [ ] Seed script creates one demo project.
- [ ] User can create a project from the UI.
- [ ] User can add website URL/business metadata.
- [ ] User can upload at least one image/logo/document source.
- [ ] Uploaded source is stored in OSS or local dev-compatible storage with the same interface.
- [ ] `Artifact` and `BrandSource` rows are created.
- [ ] Project page reloads from persisted database state.
- [ ] Playwright smoke test creates or opens a project page.

### Phase 3: QwenCloud Client And Brand Kit Agent

Goal: prove secure server-side QwenCloud integration and generate a useful Brand Kit.

Build:

- `apps/web/lib/qwen/client.ts` with visible QwenCloud base URL.
- Server-only QwenCloud structured text wrapper.
- Vision/asset analysis wrapper or adapter.
- Brand Kit prompt and Zod schema validation.
- `POST /api/projects/[projectId]/brand-kit`.
- `GenerationJob` creation and polling for Brand Kit.
- `BrandKitPanel`.

Exit checklist:

- [ ] QwenCloud API key is read only server-side.
- [ ] QwenCloud base URL is visible in source code.
- [ ] Brand Kit generation creates a `GenerationJob`.
- [ ] Job status transitions are persisted.
- [ ] Brand Kit output validates with Zod before saving.
- [ ] UI displays summary, value props, tone, palette, claims, policy risks, and citations.
- [ ] Sanitized errors appear in UI when generation fails.
- [ ] No prompts, API keys, or uploaded private content are logged in production mode.

### Phase 4: Creative Concepts And Storyboard Editor

Goal: deliver the signature showrunner mechanic and human approval loop.

Build:

- Creative Director agent that returns exactly three concepts.
- Preview frame generation for each concept.
- `ConceptTable` and `ConceptCard`.
- Note-guided regeneration of one concept that retains the other two and includes them in the prompt as anti-duplication context.
- Concept selection endpoint.
- Storyboard agent using selected concept and Brand Kit.
- Editable `StoryboardTimeline`.
- `SceneInspector`.
- Storyboard update endpoint.
- Claim/policy review pass for storyboard text.

Exit checklist:

- [ ] User can generate exactly three concepts from a Brand Kit.
- [ ] Each concept has title, hook, strategy, narrative arc, preview prompt, rationale, and preview frame.
- [ ] User can regenerate one concept, optionally describe the adjustment in 500 characters or less, and retain the other two concepts.
- [ ] Regenerating a selected concept preserves its identity and selection but returns its storyboard and scenes to draft review.
- [ ] User can select exactly one concept.
- [ ] Storyboard generation requires a selected concept.
- [ ] Missing logo, product, or interface references automatically reframe unsupported execution instead of sending the user to Assets.
- [ ] Grounding validation distinguishes negative constraints such as “no logo” from affirmative visual requests.
- [ ] Auto-recovery is bounded, revalidated before persistence, and visible to the user in the storyboard editor.
- [ ] Storyboard contains 2 to 4 scenes for MVP.
- [ ] Each scene has duration, caption, voiceover text, start/end frame prompts, motion prompt, and continuity notes.
- [ ] The storyboard has explicit product, character, and visual-world continuity locks.
- [ ] The filmstrip shows every first/last frame brief (and generated image when available) in final stitch order.
- [ ] Every inter-scene handoff is marked continuous, match-cut, or intentional change.
- [ ] User can edit scene caption, voiceover, prompts, duration, and BGM settings.
- [ ] Storyboard edits persist after refresh.
- [ ] Policy/claims warnings are visible before generation.

### Phase 5: Keyframes, Video Generation, And Take Compare

Goal: generate durable scene assets and make regeneration additive instead of destructive.

Build:

- Keyframe generation endpoint.
- Image generation wrapper for preview/start/end frames.
- `Take` creation for keyframes.
- `TakeCompare` for keyframe takes.
- Video generation endpoint using i2v.
- Async video task submission and polling.
- `GenerationConsole`.
- Artifact previews for images and videos.

Exit checklist:

- [ ] User can generate start/end keyframes for approved scenes.
- [ ] Keyframe outputs are copied to OSS and saved as `Artifact` rows.
- [ ] Regenerating a keyframe creates a new `Take`; it does not overwrite the previous take.
- [ ] Production presents one recommended story flow with each scene's opening and closing frame visible together; the user is not required to select among parallel keyframe takes.
- [ ] The recommended opening and closing frame IDs are persisted independently, and both are supplied to Wan 2.7 video generation.
- [ ] The newest successful frame pair and video clip are selected automatically while prior attempts remain available as history.
- [ ] User can submit 2 to 4 scenes for i2v generation.
- [ ] Video provider task IDs are stored on jobs.
- [ ] Video polling survives page refresh.
- [ ] Completed video clips are copied to OSS and shown in the UI.
- [ ] Failed scene generation can be retried.
- [ ] Generation console shows model, status, task ID, and artifact links.

### Phase 6: Narration, Composition, And Final Export

Goal: turn generated clips into one complete, reusable reel.

Build:

- TTS endpoint and narration job.
- Audio artifact storage.
- Waveform preview.
- Remotion composition.
- Captions with TikTok/Reels safe zones.
- Optional AI-content disclosure overlay.
- Optional uploaded/sample BGM mix.
- Final render endpoint.
- `FinalVideoPlayer` and download link.

Exit checklist:

- [ ] Narration is generated from scene voiceover text.
- [ ] TTS chunks respect model text limits.
- [ ] Narration audio is stored as an `Artifact`.
- [ ] UI shows narration status and waveform/metadata.
- [ ] Final render combines selected scene videos in order.
- [ ] Captions are visible and safe-zone-aware.
- [ ] AI disclosure can be toggled and defaults on for export.
- [ ] Optional BGM can be disabled or included.
- [ ] Final MP4 is stored in OSS as `FINAL_RENDER`.
- [ ] User can play and download the final reel.
- [ ] Manual demo path works end to end for a 15 to 30 second reel.

### Phase 7: Deployment, Documentation, And Judging Package

Goal: make Reel AI live, reusable, and submission-ready.

Build:

- Dockerfile.
- `docker-compose.yml`.
- `scripts/deploy/README.md`.
- ECS deployment.
- Production environment setup.
- README completion.
- Architecture and proof screenshots.
- Public demo project seed or fixture.
- Playwright deployed smoke test.

Exit checklist:

- [ ] Docker image builds successfully.
- [ ] App runs with Docker Compose locally.
- [ ] Database migration process is documented.
- [ ] Alibaba Cloud ECS deployment is live.
- [ ] OSS bucket is configured for generated artifacts.
- [ ] Public deployed URL opens the app.
- [ ] End-to-end demo succeeds on deployed app.
- [ ] Alibaba Cloud proof screenshot/recording is captured.
- [ ] README includes setup, env vars, QwenCloud usage, deployment, and judging proof.
- [ ] Repo contains visible QwenCloud API usage and no committed secrets.
- [ ] Project can be reused for a second brand without code changes.

Post-Phase 8 final submission item:

- [ ] 1 to 3 minute demo video is recorded after final polish is complete.

### Phase 8: Post-MVP Polish And Reusability

Goal: improve the open-source product after the judged MVP is stable.

Build only after Phase 7:

- Shareable review links.
- Spokesperson mode with reference-to-video.
- Style analysis from reference ads.
- Multi-format export: 9:16, 1:1, 16:9.
- Tair/Redis queue if concurrent usage needs it.
- Separate render/worker service if media rendering blocks the web app.
- Better observability and analytics.

Exit checklist:

- [ ] Each new feature has an ADR or implementation note.
- [ ] New feature can be disabled by config or feature flag.
- [ ] Existing end-to-end demo still passes.
- [ ] Public docs explain the feature and limitations.
- [ ] Deployment remains reproducible.

## Acceptance Tests

Minimum automated checks:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm e2e`

Minimum manual demo:

1. Create project with a business name and website URL.
2. Generate Brand Kit.
3. Generate three concepts.
4. Select one concept.
5. Generate storyboard.
6. Edit one scene caption.
7. Generate keyframes.
8. Generate video clips.
9. Generate narration.
10. Render final MP4.
11. Download/play final MP4.
12. Show Alibaba Cloud deployment proof.

## Decision Log

Current fixed decisions:

- Next.js instead of Vite SPA because Reel AI needs server routes, secure QwenCloud calls, uploads, jobs, DB access, and one deployable hackathon unit.
- ECS + Docker Compose instead of Function Compute first because long-running media work and debugging are simpler.
- Postgres job table instead of Redis queue first because it reduces infrastructure and is sufficient for hackathon scale.
- Remotion instead of raw FFmpeg filter graphs because captions, safe zones, audio composition, and templates are easier to version.
- Narrative voiceover instead of lip sync because lip sync is outside MVP scope.

If a builder changes any of these, add an ADR under `docs/decisions/`.
