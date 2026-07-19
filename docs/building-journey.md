# Reel AI — Your AI Showrunner for Scroll-Stopping Brand Films

> **Track 2: AI Showrunner**  
> Reel AI turns a website and a few brand assets into a directed, editable, production-ready vertical video—combining Qwen-powered strategy, visual generation, motion, narration, and deterministic post-production in one resilient workflow.

## Inspiration

Creating a polished short-form ad is deceptively difficult. A business may know its product, audience, and message, but turning that knowledge into a compelling reel still requires a strategist, copywriter, art director, storyboard artist, motion designer, voice artist, editor, and a surprising amount of production coordination. For small brands and independent creators, that process is often too slow, too expensive, or fragmented across a dozen disconnected tools.

That gap inspired **Reel AI**: an AI showrunner that does more than generate a clip. It researches the brand, develops a creative point of view, pitches alternatives, plans a coherent visual story, keeps the product and brand grounded, directs each shot, generates the media, and finishes the result as an actual social-ready film.

The project was also inspired by a question: **What would an AI video tool look like if it behaved like a careful production team instead of a slot machine?** The answer became a workflow built around creative choice, continuity, evidence, recoverability, and cost control. Users can hand the production to **Auto mode**, or step in at every meaningful creative checkpoint through modular editing.

## What it does

Reel AI converts a business website, an optional logo, and an optional product image into a finished **9:16 brand film**. It offers three distinct production formats:

- **Brand Reel** creates a story-led 15–30 second social ad. It grounds its strategy in website research and uploaded assets, then builds a reusable Brand Kit containing the brand’s positioning, value propositions, audience, tone, palette, visual motifs, supported claims, policy risks, citations, and locked visual language.
- **Product Showcase** creates a focused 5–15 second realistic or premium-3D product film from one named product and one hero image. Each proposed concept includes a visible motion-feasibility plan—not just a pretty prompt—with one hero action, safe camera behavior, human-presence limits, product-separation rules, and a rationale.
- **Razzmatazz Mode** compresses Product Showcase into a precise five-second commercial bumper: one intact product, one identity-safe hero motion, one surrounding energy effect, no people, no teardown, and a sharp 2–6 word closer. The output is locked to exactly $5 \times 30 = 150$ frames.

From there, Reel AI runs an end-to-end production pipeline:

1. **Research and ground the brand.** It performs bounded multi-page website research, analyzes supplied visual assets, extracts an evidence-backed palette, and separates what the brand says from what the generator is actually allowed to depict.
2. **Pitch exactly three creative directions.** The AI Creative Director produces three differentiated concepts and a real Scene 1 opening frame for each—not throwaway mood-board art. A user can replace one direction without destroying the other two.
3. **Create an editable storyboard.** Every scene receives a narrative purpose, one generation-safe directed shot, exact timing, narration, continuity locks, and a deliberate transition. **Cinematic Boost** can raise the scale, lighting contrast, depth, and reveal design without relaxing product-safety constraints.
4. **Generate continuity-aware media.** Scene 1 reuses the selected concept frame, while later keyframes can reference recent anchors to preserve recurring products, people, lighting, screen direction, and visual-world logic. Wan image-to-video then animates the approved shot from its selected anchor.
5. **Direct the soundtrack.** Qwen TTS creates scene-local narration. Reel AI measures the actual WAV duration, adds natural lead-in and tail room, applies no more than a $1.20\times$ timing correction, and rejects copy that cannot fit cleanly instead of clipping speech. An AI-selected curated music bed is looped, faded, and automatically ducked beneath narration.
6. **Finish the film.** Remotion assembles the clips, narration, music, transition grammar, safe zones, verified logo, optional AI disclosure, final CTA, thumbnail, and H.264 MP4. Early scenes stay text-free; the closing copy enters midway through the final shot so the visuals still have room to breathe.

Two operating styles make the system useful to different creators. **Auto mode** can carry a selected concept through storyboard, anchors, video clips, narration, and final render. **Step-by-step mode** exposes the same pipeline for users who want hands-on control. Because both modes share the same jobs, validators, artifacts, and guardrails, automation never becomes a lower-quality hidden path.

Reel AI also includes granular regeneration, non-destructive take history, downstream dependency invalidation, live provider job status, model and task metadata, downloadable artifacts, and a media library that preserves every completed cut—even after a newer storyboard edit makes an older render stale.

## How we built it

Reel AI is a full-stack **Next.js and TypeScript** application rather than a thin API wrapper. The browser studio talks to server-side route handlers; **Prisma and PostgreSQL** store the complete production graph—projects, sources, Brand Kits, concepts, storyboards, scenes, jobs, takes, artifacts, narration, Auto runs, and final renders.

The multimodal stack uses specialized QwenCloud models for specialized production jobs:

| Production role | Model | How Reel AI uses it |
| --- | --- | --- |
| Brand strategist, scriptwriter, creative director, storyboard planner, and structured repair | `qwen3.6-plus` | Evidence-grounded analysis and schema-validated creative JSON |
| Visual reviewer | `qwen3.6-plus` multimodal vision | Logo/product analysis and post-generation grounding review |
| Concept previews and scene anchors | `wan2.7-image-pro` | Reference-aware 9:16 opening frames and continuity anchors |
| Scene motion | `wan2.7-i2v` | First-frame image-to-video with the approved shot sentence and dedicated negative prompt |
| Narration | `qwen3-tts-flash` | Scene-timed speech synthesis stored as durable audio artifacts |

The AI layer is intentionally modular. Text, vision, image, video, upload, retry, structured-repair, and TTS concerns live behind separate server modules. Model responses must pass Zod schemas and deterministic production rules before they can trigger expensive downstream work. Near-valid structured output is normalized conservatively; incomplete output receives a bounded model repair; and Brand Reel planning has a final deterministic creative-rescue layer that preserves usable decisions instead of throwing away an entire generation.

Auto mode is a persisted production state machine, not a long-running browser promise. A PostgreSQL-backed `AutoGenerationRun` advances through **Storyboard → Scene Anchors → Video Clips → Narration → Remotion Render**. Each phase verifies its prerequisites and durable outputs, uses a short database lease to prevent competing workers, and can resume after a refresh or server restart. Provider task IDs are retained, exponential retries are bounded, and a partial video failure regenerates only the missing scenes. Manual mutation endpoints return a conflict while Auto mode owns the run, preventing stale browser tabs from corrupting the production graph.

For post-production, Remotion provides deterministic editing that a generative model should not be asked to improvise: exact duration, transitions, overlays, narration placement, soundtrack mixing, logo lockup, thumbnail generation, and 1080×1920 delivery. Before Chromium renders, Reel AI downloads each video, audio, music, and logo asset once, retries transient failures, validates file signatures, and serves the verified media through a loopback-only byte-range server. This prevents frame extraction from repeatedly proxying remote OSS media through the busy Next.js process.

The production deployment runs on **Alibaba Cloud ECS** using Docker Compose, with the Next.js app, PostgreSQL, Chromium, and FFmpeg packaged into a reproducible container stack. A dedicated **RAM user** supplies server-side OSS access credentials, while environment variables and secrets remain on the ECS host and out of source control. **Alibaba Cloud OSS** stores uploads, generated images, video clips, narration, thumbnails, and final renders, replacing short-lived provider URLs with durable project artifacts. Local development uses the same storage interface with a filesystem fallback.

## Challenges we ran into

### Making ambitious video generation fit a very small credit budget

Video generation is the most expensive and least forgiving stage of the pipeline. Working within free-tier allowances and roughly **$40 of additional credits** forced us to treat every generation as a production decision. A naive retry loop could consume the entire budget without producing a coherent reel.

We designed the spend profile around reuse and selective recovery:

$$
C_{\text{run}} \approx C_{\text{planning}} + 3C_{\text{preview}} + \sum_{i \in M_a} C_{\text{anchor},i} + \sum_{j \in M_v} C_{\text{video},j} + C_{\text{TTS}},
$$

where $M_a$ and $M_v$ contain only the **missing or invalid** anchors and clips. Reel AI reduces those sets by validating before spend, reusing the winning concept image as Scene 1, retaining successful provider task IDs, retrying only failed scenes, capping creative rerolls, and preserving every valid artifact. Razzmatazz also became a creative constraint with practical value: a five-second film can still feel premium while remaining testable inside a limited budget.

### Keeping generated products and stories coherent

Beautiful single images are much easier than coherent multi-shot advertising. Product geometry can drift, extra people can appear, screens can mutate, narration can overrun a scene, and an innocent prompt rewrite can turn one clear action into impossible choreography.

We addressed this with a continuity bible, recent-anchor references, one-action shot grammar, explicit product-motion plans, category-aware teardown rules, evidence-capability checks, negative prompts, visual grounding review, exact timing validation, and the decision to disable provider prompt expansion for approved video shots. The system does not merely ask the model to “be consistent”; it carries continuity as structured state and rechecks it at each production boundary.

### Learning Alibaba Cloud from scratch

This was our first time deploying on Alibaba Cloud. Provisioning ECS, configuring security groups and Docker, creating and scoping a RAM user, signing OSS requests, setting bucket and region configuration, managing server-only environment variables, and persisting generated artifacts took substantial iteration. The payoff was learning how to move from a local creative prototype to a real cloud-hosted production system with durable media and visible deployment proof.

### Making long-running AI work reliable in a web application

Image and video APIs are asynchronous, provider URLs expire, media downloads fail transiently, and a browser refresh should not restart expensive work. We had to design for failure as a normal state. PostgreSQL-backed jobs, durable artifact records, leases, idempotent phase verification, bounded backoff, partial-scene recovery, local render staging, and clear manual resume paths turned an unpredictable media pipeline into something a user can trust.

## Accomplishments that we're proud of

- **We built a production workflow, not a prompt demo.** Reel AI spans brand research, creative direction, storyboarding, image generation, video generation, voice, editing, storage, history, and export in one coherent product.
- **Creative autonomy and human control coexist.** Auto mode can finish a reel end to end, while every major decision remains inspectable and the exact same pipeline supports modular editing and regeneration.
- **The product is meaningfully original.** Brand Reel, Product Showcase, Razzmatazz, Cinematic Boost, three-way pitching, product motion plans, evidence-capability guardrails, Take Compare, and the continuity-first production graph are Reel AI’s own product mechanics—not renamed sample code.
- **We made failures economical.** Successful scenes survive partial failures, selected opening frames are reused, retries are bounded, and edits invalidate only the dependencies that truly changed.
- **We treated post-production as engineering.** Exact frame counts, scene-timed narration, transition-overlap compensation, byte-range media staging, soundtrack ducking, verified-logo compositing, thumbnail generation, and deterministic MP4 export turn generated fragments into a finished film.
- **We deployed the complete system on Alibaba Cloud.** The public studio runs on ECS, uses server-side QwenCloud APIs, persists production state in PostgreSQL, and stores durable generated artifacts in OSS—with deployment and bucket proof included in the repository.
- **We designed for reuse beyond one demo brand.** A new business can enter its own website and assets and receive a new Brand Kit, concepts, storyboard, and film without code changes.

## What we learned

We had already used Qwen text models extensively—from Qwen 3.6 and 3.6 Plus through Qwen 3.7 and 3.7 Max—and especially valued their web-search capabilities. What surprised us was the breadth of the wider QwenCloud creative stack. Discovering and working with dedicated image, vision, image-to-video, and speech models changed our view of Qwen from “a strong language model” into a multimodal production platform.

We learned that the best results do not come from asking one model to do everything. Strong AI products assign each model a bounded role, preserve state between roles, and place deterministic software around the probabilistic core. Qwen is excellent at developing a creative direction; Zod and domain validators make that direction safe to execute; Wan turns a grounded frame into motion; Qwen TTS gives it a voice; and Remotion guarantees that the final timeline is exactly what the user approved.

We also learned that constraints can improve creativity. One product, one hero action, one reliable camera behavior, and one short closer may sound restrictive, but those limits produced cleaner and more intentional advertisements. Likewise, the credit constraint encouraged an architecture that is more efficient, resumable, and production-ready than an unlimited retry loop would have been.

Finally, we learned the operational side of Alibaba Cloud: how ECS, Docker Compose, RAM permissions, OSS signing and storage, server-side secrets, and a persistent database fit together. Shipping publicly made security, reproducibility, documentation, and recovery just as important as model quality.

## What's next for Reel AI

The next step is to turn Reel AI from a powerful single-user studio into a scalable creative production platform:

- Move orchestration from the in-process MVP worker to a dedicated durable queue/worker architecture, with Alibaba Cloud RDS for PostgreSQL and Tair for Redis where scale requires it.
- Add multi-format exports so one approved production graph can produce 9:16 reels, 1:1 posts, 16:9 ads, cutdowns, thumbnails, and platform-safe variants without regenerating the core creative.
- Introduce an optional reference-based spokesperson mode with identity-safe continuity across scenes.
- Expand the Brand Kit into a versioned brand memory that learns from approved concepts, rejected directions, preferred takes, and campaign performance.
- Add collaborative review links, comments, approvals, and role-based workspaces for agencies and client teams.
- Build transparent budget controls that forecast spend before production, compare creative routes, and let users choose quality, speed, or cost targets.
- Explore Alibaba Model Studio’s music-generation options when international availability and licensing make them suitable, while keeping Reel AI’s current curated soundtrack path dependable.
- Add publishing and performance feedback so Reel AI can learn which hooks, visual devices, and calls to action work best for each brand—closing the loop from **brand brief to finished reel to measurable result**.

## Built with

QwenCloud, Qwen 3.6 Plus, Wan 2.7 Image Pro, Wan 2.7 I2V, Qwen TTS, Alibaba Cloud, ECS, OSS, RAM, Next.js, TypeScript, React, Tailwind CSS, Prisma, PostgreSQL, Remotion, Docker, Docker Compose, Zod, Vitest, Playwright, AI Agents, Computer Vision, Video Generation, Text-to-Speech
