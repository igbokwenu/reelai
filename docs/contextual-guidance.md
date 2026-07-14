# Contextual Action Guidance

Reel AI uses a shared guidance tooltip for consequential actions: controls that create or delete project data, start AI work, replace generated output, select a creative result, save edits, move between workflow stages, or export a file.

The guidance is intentionally outcome-focused. It tells the user what will happen after the action, including replacement or downstream effects when those details matter. Cancel and close controls do not need guidance when their visible label or accessible name is already unambiguous.

## Interaction behavior

- Mouse users see guidance after a short 420 ms dwell, which prevents visual noise while the pointer moves across the interface.
- Keyboard users see the same guidance as soon as the action receives focus and can dismiss it with `Escape`.
- Disabled actions remain hoverable through the tooltip wrapper, so their purpose is still discoverable before they become available.
- Tooltip placement automatically flips between the top and bottom and stays within the viewport.
- Screen readers receive the guidance through `aria-describedby` without changing the control's accessible name.
- Motion is disabled when the user has enabled reduced-motion preferences.

## Adding guidance to an action

The shared `Button` accepts `tooltip`, `tooltipSide`, and, when its wrapper needs layout sizing, `tooltipClassName`.

```tsx
<Button
  onClick={startRender}
  tooltip="Combines selected clips, captions, narration, disclosure, and optional music into the final 9:16 MP4."
  tooltipSide="bottom"
>
  Render Reel
</Button>
```

Use `GuideTooltip` directly for a semantic control that is not built with the shared `Button`, such as a workflow tab.

Guidance copy should:

1. Start with the outcome in present tense: “Creates…”, “Saves…”, “Opens…”, or “Replaces…”.
2. Use one or two short sentences and familiar product language.
3. State destructive, replacement, cost-bearing generation, or downstream invalidation effects plainly.
4. Avoid repeating only the visible button label; add information that helps the user decide whether to act.

## Local development

The guidance layer is an application-only UI change with no new package or database dependency. No Prisma migration, generation, install, or seed command is required. Next.js hot reload should apply it during `pnpm dev`; if the running process does not pick up the new files, restart `pnpm dev` once.
