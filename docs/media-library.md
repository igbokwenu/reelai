# Media Library

The Media Library is the delivery-focused view of Reel AI's persisted render history. It is available at `/library` from the studio home, every project sidebar, and the completed Final panel.

## Inclusion rules

An item appears only when all of the following are true:

- the render has a non-null `artifactId`;
- that artifact exists in the same project and has type `FINAL_RENDER`.

Queued, running, and genuinely failed renders have no final artifact and are therefore excluded. When a storyboard changes, the existing invalidation flow marks an older completed render record stale but deliberately retains its `artifactId` and finished MP4. The library keeps that generated output and labels it as a **Previous version**, while a render whose status remains `COMPLETE` is labeled as current. Scene video takes, concept previews, anchors, source uploads, narration, documents, and thumbnails are excluded as standalone items. A thumbnail is used only when the eligible render's own `settings.thumbnailArtifactId` resolves to a `THUMBNAIL` artifact; the UI does not borrow a thumbnail from another cut.

Because the library reads the existing `Render` and `Artifact` graph, all qualifying historical finals appear automatically. There is no copy, backfill, migration, or additional storage cost.

## Organization and labels

- Outputs are grouped by their originating project.
- Projects are labeled as **Brand reel** (`STANDARD`) or **Product showcase** (`PRODUCT_SHOWCASE`).
- Each group is sorted newest first. The newest eligible render is **Latest final**; older outputs receive stable display labels based on their order in the saved render history.
- Project name, business name, visual style, requested duration, actual render duration, format, resolution, and completion date remain visible around the playback surface.

The library supports project/brand search and output-mode filters. Selecting a card opens a focused, keyboard-dismissable video viewer with download and project-return actions. Downloads and playback use the existing same-origin, byte-range-aware artifact endpoint.

## Generation safety

The library is read-only. It does not create or mutate jobs, renders, artifacts, storyboards, takes, or `AutoGenerationRun` records. Auto mode and step-by-step mode continue to create final exports through the existing Remotion render path; a completed export becomes visible on the next server refresh.

Deleting a project still removes its render records and stored artifacts through the existing confirmed project deletion flow, so its library group disappears with it.

## Local development

This feature adds no Prisma fields, migrations, packages, or environment variables. After pulling it locally:

```bash
# Stop the existing dev process, then:
pnpm dev
```

Do not run `pnpm db:migrate`, `pnpm db:generate`, `pnpm db:seed`, or `pnpm install` specifically for this feature.
