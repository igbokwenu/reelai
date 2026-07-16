# Product Showcase

Updated: July 16, 2026

Product Showcase is a first-class output mode for short, product-led films. It reuses Reel AI's Brand Kit, three-concept selection, editable storyboard, Auto mode, step-by-step mode, scene generation, narration, and Remotion export. The difference is a stricter input and motion contract designed around product identity.

## Experience

1. Choose **Product showcase** during project creation.
2. Add one to three products. Each needs a name and at least one PNG, JPG, or WebP image; details and a product-page URL are optional.
3. Choose realistic or premium 3D and a 5, 10, or 15 second target.
4. Reel AI stores and links the images before Brand Kit research begins. Product-page URLs are researched as evidence when available.
5. The Creative Director pitches exactly three product-first concepts. The user selects one, then continues in Auto mode or the unchanged step-by-step workflow.
6. The storyboard uses a feasible one to three scenes totaling the exact requested duration. Five seconds is a strict single-clip format: one continuous hero shot begins with an immediate product hook, performs one bold category-native action, and carries the concise narrated CTA, final caption, and verified logo in that same shot—there is no separate intro, transition, or end card. The logo is present from the opening; the first 2.5 seconds keep the product film unobstructed by closure copy, then the closer enters smoothly for the second half. Fifteen seconds requires at least two scenes, and 10 seconds can use one or two. Final output remains vertical 9:16 with scene-timed voiceover, default-on curated BGM, one final closer/CTA overlay, purposeful Remotion transitions where multiple scenes exist, and the verified brand lockup. Generated source-clip audio remains excluded.

## Input policy

- Maximum three products and three product images total.
- Every listed product requires at least one image. With one product, the user may provide up to three useful angles. With three products, each receives one image.
- Product images are capped at 10 MB and must be PNG, JPG, or WebP.
- The first product is the hero product. Extra products are a collection, not permission to overload a shot.
- Favor sharp, unobstructed product views with consistent lighting. Extra images should add a useful angle or visible detail rather than near-duplicates.
- Website context supplements the uploaded image; it does not override visible product identity or authorize unsupported claims.

The three-image total is deliberate. Current reference-aware image generation can use a small ordered reference set effectively, while the image-to-video stage animates one approved opening anchor. More simultaneous subjects and transformations increase identity drift, occlusion, and morphing risk without improving a 5–15 second ad.

## Creative and motion contract

- Exactly three distinct directions, such as a tactile/material reveal, cinematic hero motion, or an elegant use-context/model presentation when suitable.
- Every concept persists a structured motion treatment: one hero action, optional low-amplitude supporting motion, one supported camera behavior, `NO_PERSON` or `ONE_PERSON`, an evidence-based separation decision, and a plain-language feasibility rationale. The concept cards expose this plan before selection rather than hiding it in provider prompts.
- One hero product and one primary action per shot.
- A Product Showcase may contain no people or one person total. When a person appears, that same single person is the only human in the complete concept/storyboard and the only person who interacts with the product. Couples, crowds, background people, handoffs, second models, and detached extra hands are not allowed.
- Multiple products appear sequentially or in a static collection composition. They do not assemble, collide, cross paths, or transform together.
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

Structured creative output is repaired conservatively before it can enter Auto mode. Product Showcase motion-plan aliases such as `NO_PEOPLE`, `SINGLE_PERSON`, `NO_TEARDOWN`, and `slow zoom in` are canonicalized to the strict stored vocabulary. When a provider repair corrects one field but accidentally blanks an already substantive concept field, Reel AI retains the original title, hook, style, and other non-empty values instead of replacing the concept with an empty shell. Storyboard repair converts substantive multi-sentence prose into one safe shot direction, collapses conflicting camera language to one supported behavior, retains the focal product action, and reconciles scene timing plus voiceover length to the project's exact target. If a provider over-segments a five-second showcase, Reel AI produces one continuous hero clip from the opening product visual and final narrated CTA instead of pausing production. A missing caption or narration can recover from its paired copy, omitted continuity notes receive a safe product-identity lock, and a clearly product-only scene receives an explicit no-people cast plan. It still refuses to invent a missing shot direction, product fact, or ambiguous human identity. If the provider omits the redundant top-level script, it is derived from the validated scene narration. Missing, disabled, or contradictory Product Showcase music metadata is normalized to a valid default-on curated bed; users retain the explicit opt-out at final render. Creative-interest vocabulary and camera variety still guide generation, but they do not reject an otherwise safe product shot and trigger repeated paid rerolls. Manual approval, anchor generation, clip generation, and Remotion export all use the same timing validator, so an invalid edit is explained in the storyboard rather than failing later in production.

Motion feasibility has the same end-to-end boundary. Deterministic checks review the structured concept, run after storyboard generation, drive one bounded storyboard repair when needed, reject unsafe manual edits, and run again before keyframe or video jobs are created. This keeps Auto mode and step-by-step mode aligned and prevents a legacy or edited storyboard from bypassing the one-person, screen-complexity, or category-aware teardown rules.

During an active showcase run, the studio becomes a focused Auto production room. Manual generation/editing panels are hidden and the corresponding APIs reject stale manual requests. The complete editor returns if the run pauses for review or after the final reel is ready. Newly generated concepts use the safeguards immediately; a legacy Product Showcase concept without `showcaseMotionPlan` must be regenerated once before selection or production, without replacing the project or its uploaded assets.

## Data and API contract

- `Project.outputMode`: `STANDARD | PRODUCT_SHOWCASE`.
- `Project.cinematicBoost`: persists balanced versus heightened creative direction.
- `CreativeConcept.showcaseMotionPlan`: optional JSON for standard reels and required for newly generated Product Showcase concepts; stores the structured motion treatment shown in the concept UI and passed downstream.
- `Scene.transitionStyle`: `CUT | FADE | SLIDE | WIPE | IRIS | CLOCK_WIPE`.
- `ProjectProduct`: name, details, website URL, and stable order.
- `BrandSource.productId`: associates a `PRODUCT_IMAGE` or product-page source with its product.
- `POST /api/projects` accepts `outputMode` and `products[]` with an intake-only `imageCount` used for validation.
- `POST /api/projects/:id/sources` accepts multipart `productId` for product images and enforces type, size, ownership, and the three-image limit.
- Background Brand Kit start validates that every saved product has an uploaded image before queueing model work.

## Local update

The current implementation includes Prisma migrations for Product Showcase intake, scene transitions, and the concept motion plan, plus the official `@remotion/transitions` package. After pulling it into another checkout, run `pnpm install` only if dependencies are not already installed. Stop the current dev process, then run:

```bash
pnpm db:migrate
pnpm dev
```

`pnpm dev` regenerates Prisma Client through the existing web pre-step. `pnpm db:generate` is only needed if an already-open editor still shows stale Prisma types. No seed is required. Existing projects keep their media and default to balanced creative intensity plus clean cuts until a storyboard is regenerated or edited.

The new `CreativeConcept.showcaseMotionPlan` field requires `pnpm db:migrate` once. Existing concepts remain valid database records, but existing Product Showcase concepts without a motion plan must be regenerated before they can be selected. No seed is required.

The midpoint closer reveal and its premium visual treatment are also application-only. They use the existing Remotion render path for both Auto and step-by-step mode, require only a `pnpm dev` restart, and do not require a migration, seed, Prisma regeneration, or dependency install.
