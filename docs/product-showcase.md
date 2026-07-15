# Product Showcase

Updated: July 15, 2026

Product Showcase is a first-class output mode for short, product-led films. It reuses Reel AI's Brand Kit, three-concept selection, editable storyboard, Auto mode, step-by-step mode, scene generation, narration, and Remotion export. The difference is a stricter input and motion contract designed around product identity.

## Experience

1. Choose **Product showcase** during project creation.
2. Add one to three products. Each needs a name and at least one PNG, JPG, or WebP image; details and a product-page URL are optional.
3. Choose realistic or premium 3D and a 5, 10, or 15 second target.
4. Reel AI stores and links the images before Brand Kit research begins. Product-page URLs are researched as evidence when available.
5. The Creative Director pitches exactly three product-first concepts. The user selects one, then continues in Auto mode or the unchanged step-by-step workflow.
6. The storyboard uses a feasible one to three scenes totaling the exact requested duration. Five seconds resolves to one scene, 15 seconds requires at least two, and 10 seconds can use one or two. Final output remains vertical 9:16 with scene-timed voiceover, one final closer/CTA overlay, purposeful Remotion transitions, and the verified brand lockup. Product Showcase does not add source-clip audio or BGM.

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
- One hero product and one primary action per shot.
- Multiple products appear sequentially or in a static collection composition. They do not assemble, collide, cross paths, or transform together.
- Separation/reassembly is limited to a few large, visually grounded layers or components moving on one axis before settling. The AI must not invent internal parts.
- Motion is category-native rather than a universal spin: food/drink can use verified garnish, condensation, steam, pouring, crumbs, or temperature contrast; beauty can use a controlled droplet, texture ribbon, cap reveal, or light sweep; fashion can use fabric response, one silhouette turn, or one step; rigid goods/electronics favor precision rotation, parallax, surface light, or a functional reveal; home/craft objects favor material detail and a simple use-result.
- Stable product-safe devices include a brief partial orbit, turntable, light sweep, package reveal, ingredient layering, controlled fabric motion, and one simple model/use-context action. One grounded supporting material behavior may accompany the hero action, such as a brief ice-cream rotation while verified toppings fall in one clean arc.
- Avoid melting, spawning, tiny-part explosions, hand manipulation of fine detail, rapid turns, complex occlusion, and simultaneous camera/object choreography.
- Wearables may use one model with a simple pose, step, turn, or fabric movement. No outfit morph or unreferenced redesign.
- App/website products require supplied interface evidence for generated screens. Otherwise the concept shows the real-world outcome or reserves the screen for controlled compositing.
- Every scene stores the transition into it. Match cuts stay clean; fades serve gentle continuity; slides and wipes need directional or packaging geometry; iris and clock wipes are reserved for centered circular forms or deliberately theatrical hero reveals. A clean cut remains the default when an effect would compete with the product.
- **Cinematic Boost** is a persisted concept-stage preference. When enabled, both concept and storyboard agents materially heighten scale, lighting contrast, foreground depth, reveal timing, and physically credible motion without relaxing product-reference or single-shot constraints.
- Source video requests omit driving audio (and force `audio: false` on compatible legacy Wan models). Remotion also mutes every source clip. Product Showcase disables BGM at storyboard save and final-render boundaries, leaving scene narration as the only audio layer.
- Earlier scene captions are editorial labels only. Remotion composites only the final scene's concise closer or CTA.

Uploaded product images are prioritized ahead of logos, reference ads, and general uploads when generating concept previews and scene anchors. Realistic mode uses commercial photography language; 3D mode uses physically based materials and studio lighting without changing product geometry.

Structured storyboard output is repaired conservatively before it can enter Auto mode. Reel AI converts substantive multi-sentence prose into one safe shot direction, collapses conflicting camera language to one supported behavior, retains the focal product action, and reconciles scene timing plus voiceover length to the project's exact target. Creative-interest vocabulary and camera variety still guide generation, but they do not reject an otherwise safe product shot and trigger repeated paid rerolls. Manual approval, anchor generation, clip generation, and Remotion export all use the same timing validator, so an invalid edit is explained in the storyboard rather than failing later in production.

During an active showcase run, the studio becomes a focused Auto production room. Manual generation/editing panels are hidden and the corresponding APIs reject stale manual requests. The complete editor returns if the run pauses for review or after the final reel is ready; no concept regeneration or replacement project is required to benefit from these safeguards.

## Data and API contract

- `Project.outputMode`: `STANDARD | PRODUCT_SHOWCASE`.
- `Project.cinematicBoost`: persists balanced versus heightened creative direction.
- `Scene.transitionStyle`: `CUT | FADE | SLIDE | WIPE | IRIS | CLOCK_WIPE`.
- `ProjectProduct`: name, details, website URL, and stable order.
- `BrandSource.productId`: associates a `PRODUCT_IMAGE` or product-page source with its product.
- `POST /api/projects` accepts `outputMode` and `products[]` with an intake-only `imageCount` used for validation.
- `POST /api/projects/:id/sources` accepts multipart `productId` for product images and enforces type, size, ownership, and the three-image limit.
- Background Brand Kit start validates that every saved product has an uploaded image before queueing model work.

## Local update

The current implementation includes a Prisma migration and the official `@remotion/transitions` package. After pulling it into another checkout, run `pnpm install`. In this workspace the dependency is already installed. Stop the current dev process, then run:

```bash
pnpm db:migrate
pnpm dev
```

`pnpm dev` regenerates Prisma Client through the existing web pre-step. `pnpm db:generate` is only needed if an already-open editor still shows stale Prisma types. No seed is required. Existing projects keep their media and default to balanced creative intensity plus clean cuts until a storyboard is regenerated or edited.
