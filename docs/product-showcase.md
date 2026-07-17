# Product Showcase

Updated: July 17, 2026

Product Showcase is a first-class output mode for short, product-led films. It reuses Reel AI's Brand Kit, three-concept selection, editable storyboard, Auto mode, step-by-step mode, scene generation, narration, and Remotion export. The difference is a stricter input and motion contract designed around product identity. Its optional Razzmatazz mini mode compresses that same pipeline into a fixed 5-second commercial bumper.

## Experience

1. Choose **Product showcase** during project creation.
2. Add exactly one product name and one PNG, JPG, or WebP hero image. A logo, product details, and one project website are optional.
3. Choose realistic or premium 3D and a 5, 10, or 15 second target. Or enable **Razzmatazz mode** to lock the project to one 5-second scene.
4. Reel AI stores and links the logo/product image before Brand Kit research begins. The one project website is researched as evidence when available, and an uploaded logo's analyzed dominant color leads the Working palette.
5. The Creative Director pitches exactly three product-first concepts. Each concept card shows its actual Scene 1 opening frame, generated in product-reference edit mode and reviewed against the uploaded hero image. The user can edit/regenerate one direction without replacing the other two, then continues in Auto mode or step-by-step mode.
6. The storyboard reuses the selected concept frame as Scene 1's selected anchor and generates images only for Scene 2 onward. It uses a feasible one to three scenes totaling the exact requested duration. The editorial defaults are one scene at 5 seconds, two scenes at 10 seconds, and three scenes at 15 seconds. An explicit scene/shot/clip count in the project creative direction or a concept-regeneration adjustment overrides that default when the requested count can still satisfy the provider's 5–10 second clip contract. Five seconds remains a strict single-clip format. Final output remains vertical 9:16 with scene-timed voiceover, default-on curated BGM, one final closer/CTA overlay, purposeful Remotion transitions where multiple scenes exist, and the verified brand lockup. Generated source-clip audio remains excluded.

### Razzmatazz mini format

- Exactly one 5-second scene and one final clip. Scene count and timeline duration are locked in the manual editor as well as Auto mode.
- Every concept and directed shot must explicitly contain the Razzmatazz triad: visible intact-product motion (for example a brief spin, partial turn, pivot, rise, or forward glide), one animated surrounding light/particle/reflection/color/shadow effect, and framing that names the product as centered, the sole focus, or the hero. Static bokeh, soft focus, condensation, or passive illumination alone does not pass validation.
- The intact product is the only subject. `humanPresence` must be `NO_PERSON` and `separationTreatment` must be `AVOID`, even for food or modular products that could otherwise qualify for controlled separation.
- Motion begins on frame one and uses one identity-safe hero action: a brief precision turn/spin, scale-forward move, or fast-feeling push-in. The camera and product cannot perform competing rotations.
- One restrained environmental effect may surround the product—light streaks, particles, reflections, color bloom, shadow pulses, or atmosphere—but cannot alter, occlude, duplicate, open, or break apart the product.
- The shot settles into a clean hero hold. A source-safe 2–6 word tagline/CTA is composited at the midpoint, while narration is capped at 7 words and the verified logo stays visible.
- Wan and Remotion both use the exact 5-second duration, producing a 150-frame export at 30 fps.

## Input policy

- Exactly one product and one product image.
- One optional PNG, JPG, or WebP logo and one optional project website URL may accompany it.
- Product images are capped at 10 MB and must be PNG, JPG, or WebP.
- Favor one sharp, unobstructed hero view with clear geometry and lighting; it becomes the product identity source of truth.
- Website context supplements the uploaded image; it does not override visible product identity or authorize unsupported claims.

The single-image contract is deliberate for this streamlined release. It keeps subject identity unambiguous across concept previews, anchors, and image-to-video generation, reducing drift, occlusion, and accidental product blending.

## Creative and motion contract

- Exactly three distinct directions, such as a tactile/material reveal, cinematic hero motion, or an elegant use-context/model presentation when suitable.
- Every concept persists a structured motion treatment: one hero action, optional low-amplitude supporting motion, one supported camera behavior, `NO_PERSON` or `ONE_PERSON`, an evidence-based separation decision, and a plain-language feasibility rationale. The concept cards expose this plan before selection rather than hiding it in provider prompts.
- One hero product and one primary action per shot.
- A Product Showcase may contain no people or one person total. When a person appears, that same single person is the only human in the complete concept/storyboard and the only person who interacts with the product. Couples, crowds, background people, handoffs, second models, and detached extra hands are not allowed.
- Separation/reassembly is opt-in, not a default visual recipe. Verified layered foods may separate a few large visible ingredient layers on one axis before settling. A non-food product qualifies only when its intake explicitly establishes a few large, externally visible modular pieces. Electronics, screens, fabrics, garments, and uncertain products use `AVOID`; the AI must not expose internals, create exploded views, disassemble electronics, or unravel fabric.
- Motion is category-native rather than a universal spin: food/drink can use verified garnish, condensation, steam, pouring, crumbs, or temperature contrast; beauty can use a controlled droplet, texture ribbon, cap reveal, or light sweep; fashion can use fabric response, one silhouette turn, or one step; rigid goods/electronics favor precision rotation, parallax, surface light, or a functional reveal; home/craft objects favor material detail and a simple use-result.
- Stable product-safe devices include a brief partial orbit, turntable, light sweep, package reveal, ingredient layering, controlled fabric motion, and one simple model/use-context action. One grounded supporting material behavior may accompany the hero action, such as a brief ice-cream rotation while verified toppings fall in one clean arc.
- Avoid melting, spawning, tiny-part explosions, hand manipulation of fine detail, rapid turns, complex occlusion, and simultaneous camera/object choreography.
- Wearables may use one model with a simple pose, step, turn, or fabric movement. No outfit morph or unreferenced redesign.
- App/website products require supplied interface evidence for generated screens. Otherwise the concept shows the real-world outcome or reserves the screen for controlled compositing.
- Even with supplied interface evidence, a generated screen gets one readable state or one simple interaction. Rapid scrolling, typing plus tapping, notification cascades, animated multi-panel dashboards, and interface morphing are rejected as overloaded choreography.
- Every scene stores the transition into it. Match cuts stay clean; fades serve gentle continuity; slides and wipes need directional or packaging geometry; iris and clock wipes are reserved for centered circular forms or deliberately theatrical hero reveals. A clean cut remains the default when an effect would compete with the product.
- **Cinematic Boost** is a persisted concept-stage preference. When enabled, both concept and storyboard agents materially heighten scale, lighting contrast, foreground depth, reveal timing, and physically credible motion without relaxing product-reference or single-shot constraints.
- Source video requests omit driving audio (and force `audio: false` on compatible legacy Wan models), and Remotion mutes every source clip. Scene narration and curated BGM are independent post-production layers. The storyboard agent selects a track and enables it for the first Auto final; the Final tab then supports AI Match, manual selection, or a voiceover-only re-render.
- Earlier scene captions are editorial labels only. Remotion composites only the final scene's concise closer or CTA, revealing it at that scene's midpoint with a restrained glass-and-pearl treatment so the opening half remains product-first.
- Uploaded logos use Remotion's render-blocking image component. Each render frame waits for the complete image download and browser decode, with bounded retries and the same 120-second media timeout, before the logo can be composited. A slow or unavailable logo therefore delays or fails the render instead of producing partially decoded scanlines in the exported reel.

Uploaded product images are prioritized ahead of logos, reference ads, and general uploads when generating concept previews and scene anchors. Realistic mode uses commercial photography language; 3D mode uses physically based materials and studio lighting without changing product geometry.

Local development uses the same grounding contract. When an artifact is stored under `.data/artifacts` and has no public URL, Reel AI uploads its bytes to QwenCloud's temporary OSS and supplies the required managed-resource header. It never falls back to text-only product generation merely because `PUBLIC_APP_URL` is unavailable. A concept whose product reference cannot be resolved receives a non-production fallback and cannot be selected until that one concept is regenerated successfully.

Concept opening-frame edits are generated sequentially to avoid a three-request capacity spike. Transient QwenCloud image and download failures use bounded retries, and a failed product-identity review receives one corrective generation pass. If all recovery attempts are exhausted, Reel AI retains the durable non-production fallback and records whether the failure occurred during reference preparation, generation, review, or download; the fallback still cannot be selected as a product-locked Scene 1 frame.

Structured creative output is repaired conservatively before it can enter Auto mode. Product Showcase motion-plan aliases such as `NO_PEOPLE`, `SINGLE_PERSON`, `NO_TEARDOWN`, and `slow zoom in` are canonicalized to the strict stored vocabulary. When a provider repair corrects one field but accidentally blanks an already substantive concept field, Reel AI retains the original title, hook, style, and other non-empty values instead of replacing the concept with an empty shell. Storyboard repair converts substantive multi-sentence prose into one safe shot direction, collapses conflicting camera language to one supported behavior, retains the focal product action, and reconciles scene timing plus voiceover length to the project's exact target. If a provider over-segments a five-second showcase, Reel AI produces one continuous hero clip from the opening product visual and final narrated CTA instead of pausing production. A missing caption or narration can recover from its paired copy, omitted continuity notes receive a safe product-identity lock, and a clearly product-only scene receives an explicit no-people cast plan. It still refuses to invent a missing shot direction, product fact, or ambiguous human identity. If the provider omits the redundant top-level script, it is derived from the validated scene narration. Missing, disabled, or contradictory Product Showcase music metadata is normalized to a valid default-on curated bed; users retain the explicit opt-out at final render. Creative-interest vocabulary and camera variety still guide generation, but they do not reject an otherwise safe product shot and trigger repeated paid rerolls. Manual approval, anchor generation, clip generation, and Remotion export all use the same timing validator, so an invalid edit is explained in the storyboard rather than failing later in production.

Motion feasibility has the same end-to-end boundary. Deterministic checks review the structured concept, run after storyboard generation, drive one bounded storyboard repair when needed, reject unsafe manual edits, and run again before keyframe or video jobs are created. This keeps Auto mode and step-by-step mode aligned and prevents a legacy or edited storyboard from bypassing the one-person, screen-complexity, or category-aware teardown rules.

During an active showcase run, the studio becomes a focused Auto production room. Manual generation/editing panels are hidden and the corresponding APIs reject stale manual requests. The complete editor returns if the run pauses for review or after the final reel is ready. Newly generated concepts use the safeguards immediately; a legacy Product Showcase concept without `showcaseMotionPlan` must be regenerated once before selection or production, without replacing the project or its uploaded assets.

## Data and API contract

- `Project.outputMode`: `STANDARD | PRODUCT_SHOWCASE`.
- `Project.razzmatazzMode`: persisted boolean; valid only with `PRODUCT_SHOWCASE` and a fixed `videoLengthSec = 5`.
- `Project.cinematicBoost`: persists balanced versus heightened creative direction.
- `CreativeConcept.showcaseMotionPlan`: optional JSON for standard reels and required for newly generated Product Showcase concepts; stores the structured motion treatment shown in the concept UI and passed downstream.
- `Scene.transitionStyle`: `CUT | FADE | SLIDE | WIPE | IRIS | CLOCK_WIPE`.
- `ProjectProduct`: the showcase's single product name, details, optional inherited website context, and stable order.
- `BrandSource.productId`: associates the one `PRODUCT_IMAGE` source with its product.
- `POST /api/projects` accepts `outputMode` and `products[]` with an intake-only `imageCount` used for validation.
- `POST /api/projects/:id/sources` accepts multipart `productId` for the product image and enforces type, size, ownership, and the one-logo/one-product-image limits.
- URL registration permits one URL-bearing source per project.
- Background Brand Kit start validates exactly one saved product and one linked product image before queueing model work.

Razzmatazz checks run at concept validation, storyboard validation and repair, manual storyboard save, production preflight, and final timing validation. Auto and step-by-step therefore cannot diverge or bypass the intact-product contract.

Concept and storyboard compliance is an internal generation concern, not a user correction step. Reel AI first asks the creative model for a focused replacement when a candidate misses the Razzmatazz contract. If the replacement still misses a required phrase or introduces unsafe motion, a deterministic identity-safe repair normalizes people/separation settings, product motion, surrounding energy, hero framing, and the opening prompt before the result is saved. Generation-job metadata records whether model or deterministic recovery was used, while raw self-authored validation details stay out of the user-facing workflow.

## Local update

The current implementation includes Prisma migrations for Product Showcase intake, scene transitions, and the concept motion plan, plus the official `@remotion/transitions` package. After pulling it into another checkout, run `pnpm install` only if dependencies are not already installed. Stop the current dev process, then run:

```bash
pnpm db:migrate
pnpm dev
```

`pnpm dev` regenerates Prisma Client through the existing web pre-step. `pnpm db:generate` is only needed if an already-open editor still shows stale Prisma types. No seed is required. Existing projects keep their media and default to balanced creative intensity plus clean cuts until a storyboard is regenerated or edited.

The new `CreativeConcept.showcaseMotionPlan` field requires `pnpm db:migrate` once. Existing concepts remain valid database records, but existing Product Showcase concepts without a motion plan must be regenerated before they can be selected. No seed is required.

The midpoint closer reveal and its premium visual treatment are also application-only. They use the existing Remotion render path for both Auto and step-by-step mode, require only a `pnpm dev` restart, and do not require a migration, seed, Prisma regeneration, or dependency install.

The July 17 streamlined intake and source-slot update is application-only. Restart `pnpm dev`; no database migration, Prisma generation, package install, or seed is required. Legacy projects with multiple saved products or sources remain readable so their existing work is preserved, while all new project/source writes use the single-slot contract.

The granular generation and opening-frame reuse update is also application-only. Restart `pnpm dev`; do not run `pnpm db:migrate`, `pnpm db:seed`, or `pnpm install`. Existing projects remain readable. Regenerate a concept once to opt it into product-locked Scene 1 reuse; legacy storyboards continue to generate Scene 1 normally until they are regenerated from an updated concept.

The opening-frame reliability and duration-aware scene-default update is application-only. Restart `pnpm dev`; do not run `pnpm db:migrate`, `pnpm db:generate`, `pnpm db:seed`, or `pnpm install`. Existing concepts and storyboards remain readable. Regenerate concepts to apply the new 5s/10s/15s defaults to an existing project.

Razzmatazz mode adds `Project.razzmatazzMode` in migration `20260717170000_razzmatazz_mode`. Migration `20260717183000_razzmatazz_five_seconds` moves any existing Razzmatazz project from the former duration to the current fixed 5-second contract. Stop the development server, run `pnpm db:migrate`, and restart `pnpm dev`. No install or seed is required. You can test with an existing Razzmatazz project after migrating by regenerating its concepts and storyboard; create a new Product Showcase only when you want to verify the intake toggle itself. Existing non-Razzmatazz Product Showcase projects remain unchanged and are the recommended regression path for normal Auto and step-by-step flows.
