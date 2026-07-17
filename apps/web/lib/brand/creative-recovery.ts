import { selectBgmTrack } from "@/lib/bgm/catalog";
import {
  castPlanSchema,
  creativeConceptSchema,
  parseCreativeConceptRegenerationOutput,
  parseCreativeConceptsOutput,
  parseStoryboardOutput,
  shotPromptSchema,
  type CreativeConceptOutput,
  type CreativeConceptsOutput,
  type StoryboardOutput,
} from "@/lib/schemas/agent";

export type BrandReelRecoveryContext = {
  businessName: string;
  projectName: string;
  audience?: string | null;
  offer?: string | null;
  durationSec: number;
  preferredSceneCount?: number | null;
  tone?: string | null;
  lockedStyle?: string | null;
  palette?: unknown;
};

type RecoveryCandidates = {
  original: unknown;
  repaired: unknown;
};

const conceptRoutes = [
  {
    title: "Pattern Break to Purpose",
    hook: "Interrupt the expected category story with one immediate, brand-relevant change.",
    strategy:
      "Open on a recognizable tension or desire already grounded in the offer, then let one visible cause-and-effect action introduce the brand as the purposeful next move.",
    narrativeArc:
      "Begin with a visual pattern interrupt, advance through one concrete change created by the offer, and resolve on a composed brand-value payoff with a clear next step.",
    visualStyle:
      "Editorial realism with decisive blocking, tactile foreground detail, controlled contrast, and a warm-to-confident lighting progression.",
    rationale:
      "This route earns attention quickly while keeping the story legible, evidence-led, and emotionally connected to the audience's reason to care.",
    preview:
      "Vertical 9:16 opening frame at the instant a signature brand artifact enters the foreground, layered editorial composition, controlled directional light, tactile realistic detail, premium color contrast, clean upper-left negative space, no readable text or generated logo.",
  },
  {
    title: "Proof in Motion",
    hook: "Make the value tangible by turning one real process detail into the visual hook.",
    strategy:
      "Build the reel around a concrete artifact, action, or workflow consequence that demonstrates how the offer creates value without relying on unsupported claims or generic lifestyle montage.",
    narrativeArc:
      "Start on an intriguing process detail, reveal the practical change it produces, and finish with the completed outcome framed as an inviting audience action.",
    visualStyle:
      "Precise modern cinematography with macro detail, clean geometry, purposeful camera restraint, and crisp brand-color reflections across practical materials.",
    rationale:
      "Visible proof makes an unfamiliar offer easier to understand, gives every scene an editorial job, and creates a professional reel without inventing performance promises.",
    preview:
      "Vertical 9:16 opening frame focused on one concrete process artifact about to move, refined modern set, crisp geometry, practical surface texture, restrained brand-color reflections, cinematic depth, no readable interface text or generated logo.",
  },
  {
    title: "Signature World Payoff",
    hook: "Turn the brand's visual world into a memorable journey from curiosity to invitation.",
    strategy:
      "Use one recurring material, color, or spatial motif as editorial connective tissue while each scene advances a distinct beat from intrigue through recognition to a confident brand payoff.",
    narrativeArc:
      "Open inside an unexpected branded visual motif, escalate it through a tangible reveal, and land on a calm premium composition that leaves room for the real logo and call to action.",
    visualStyle:
      "Cinematic brand-world imagery with sculpted light, recurring palette accents, elegant depth transitions, and a polished final composition rather than a disconnected montage.",
    rationale:
      "A consistent visual signature builds recall across multiple scenes while the cause-and-effect arc keeps the reel clear, engaging, and production-feasible.",
    preview:
      "Vertical 9:16 opening frame inside a distinctive brand-colored environment where one tactile focal artifact emerges through layered light, cinematic depth, premium material detail, intentional negative space, no readable typography or generated logo.",
  },
] as const;

const fallbackShotPrompts = {
  opening:
    "Immediate intrigue: a signature brand artifact slides into the foreground as a narrow color reflection sweeps across its surface, while a fixed camera holds the layered composition.",
  mechanism:
    "Purposeful momentum: the focal artifact opens to reveal one tangible process detail as surrounding elements settle behind it, while a slow push-in tightens the composition.",
  proof:
    "Visible proof: the completed arrangement rises into a focused pool of brand color as its materials catch one crisp reflection, while a slow pull-back reveals the wider consequence.",
  closer:
    "Decisive finish: the signature artifact turns toward the foreground as a restrained color ripple fades behind it, while a gentle product orbit traces the premium composition with clean upper-left negative space.",
} as const;

const identityKits = [
  {
    anchors: ["oval face", "short wavy hair", "medium build"],
    wardrobe: "tailored charcoal overshirt",
    distinction: "small round glasses with a clearly defined dark frame",
  },
  {
    anchors: ["angular face", "long braided hair", "tall frame"],
    wardrobe: "structured cream jacket",
    distinction: "a pronounced eyebrow arch and an asymmetric jacket collar",
  },
  {
    anchors: ["round face", "closely cropped hair", "broad shoulders"],
    wardrobe: "soft blue collarless shirt",
    distinction: "a neat goatee and a visibly relaxed shoulder line",
  },
  {
    anchors: ["heart-shaped face", "curly bob", "slender build"],
    wardrobe: "rust-colored longline cardigan",
    distinction:
      "light freckles across the cheeks and a long cardigan silhouette",
  },
] as const;

export function recoverBrandReelConcepts(
  candidates: RecoveryCandidates,
  context: BrandReelRecoveryContext,
): CreativeConceptsOutput {
  const repaired = extractConcepts(candidates.repaired);
  const original = extractConcepts(candidates.original);
  const sceneCount = preferredSceneCount(context);
  const duration = clamp(Math.round(context.durationSec), 15, 30);
  const usedTitles = new Set<string>();

  const concepts = conceptRoutes.map((route, index) => {
    const source = {
      ...(asRecord(original[index]) ?? {}),
      ...(asRecord(repaired[index]) ?? {}),
    };
    let title = validText(source.title ?? source.name, route.title, 3, 90);
    if (usedTitles.has(title.toLowerCase())) title = route.title;
    usedTitles.add(title.toLowerCase());

    const concept = {
      title,
      hook: validText(source.hook, route.hook, 8, 220),
      strategy: validText(
        source.strategy ?? source.approach ?? source.concept,
        contextualize(route.strategy, context),
        20,
        420,
      ),
      narrativeArc: validText(
        source.narrativeArc ?? source.narrative_arc ?? source.arc,
        contextualize(route.narrativeArc, context),
        20,
        520,
      ),
      visualStyle: validText(
        source.visualStyle ?? source.visual_style ?? source.style,
        `${route.visualStyle} ${paletteCue(context.palette)}`,
        12,
        320,
      ),
      estimatedScenes: sceneCount,
      estimatedDurationSec: duration,
      previewPrompt: validText(
        source.previewPrompt ?? source.preview_prompt ?? source.imagePrompt,
        `${route.preview} ${paletteCue(context.palette)}`,
        20,
        1200,
      ),
      rationale: validText(
        source.rationale ?? source.why ?? source.why_it_works,
        contextualize(route.rationale, context),
        20,
        520,
      ),
    };

    return creativeConceptSchema.parse(concept);
  });

  return parseCreativeConceptsOutput(
    { concepts },
    "STANDARD",
    duration,
    sceneCount,
  );
}

export function recoverBrandReelConcept(
  candidates: RecoveryCandidates,
  context: BrandReelRecoveryContext,
): { concept: CreativeConceptOutput } {
  const directRepaired = extractSingleConcept(candidates.repaired);
  const directOriginal = extractSingleConcept(candidates.original);
  const recovered = recoverBrandReelConcepts(
    {
      repaired: { concepts: [directRepaired] },
      original: { concepts: [directOriginal] },
    },
    context,
  );

  return parseCreativeConceptRegenerationOutput(
    { concept: recovered.concepts[0] },
    "STANDARD",
    clamp(Math.round(context.durationSec), 15, 30),
    preferredSceneCount(context),
  );
}

export function recoverBrandReelStoryboard(
  candidates: RecoveryCandidates,
  context: BrandReelRecoveryContext,
): StoryboardOutput {
  const repaired = extractStoryboard(candidates.repaired);
  const original = extractStoryboard(candidates.original);
  const source = { ...original, ...repaired };
  const repairedScenes = extractScenes(repaired);
  const originalScenes = extractScenes(original);
  const sceneCount = preferredSceneCount(
    context,
    repairedScenes.length || originalScenes.length,
  );
  const durations = distributeDuration(context.durationSec, sceneCount);
  const selectedRepairedScenes = selectEvenly(repairedScenes, sceneCount);
  const selectedOriginalScenes = selectEvenly(originalScenes, sceneCount);
  const rawScenes = Array.from(
    { length: sceneCount },
    (_, index) =>
      selectedRepairedScenes[index] ?? selectedOriginalScenes[index],
  );
  const sceneText = rawScenes.map((scene) => JSON.stringify(scene)).join(" ");
  const sourceContinuity = {
    ...(asRecord(original.continuityBible ?? original.continuity_bible) ?? {}),
    ...(asRecord(repaired.continuityBible ?? repaired.continuity_bible) ?? {}),
  };
  const cast = recoverCastPlan(
    sourceContinuity.cast ??
      sourceContinuity.castPlan ??
      sourceContinuity.cast_plan,
    sceneText,
  );
  const track = selectBgmTrack({
    preferredTrackId: stringValue(
      asRecord(repaired.bgm ?? repaired.music)?.preset ??
        asRecord(original.bgm ?? original.music)?.preset,
    ),
    creativeText: `${context.tone ?? ""} ${context.lockedStyle ?? ""} ${context.offer ?? ""}`,
  });

  const scenes = Array.from({ length: sceneCount }, (_, index) => {
    const raw = asRecord(rawScenes[index]) ?? {};
    const durationSec = durations[index]!;
    const captionFallback = fallbackCaption(index, sceneCount);
    const voiceoverFallback = fallbackVoiceover(index, sceneCount, context);
    const rawVoiceover = validText(
      raw.voiceoverText ?? raw.voiceover ?? raw.narration,
      voiceoverFallback,
      1,
      600,
    );
    const rawShot = stringValue(
      raw.shotPrompt ?? raw.shot_prompt ?? raw.motionPrompt ?? raw.motion,
    );

    return {
      index: index + 1,
      durationSec,
      captionText: validText(
        raw.captionText ?? raw.caption ?? raw.onScreenText,
        captionFallback,
        1,
        140,
      ),
      voiceoverText: fitWords(rawVoiceover, Math.floor(durationSec * 2.5)),
      shotPrompt:
        rawShot && shotPromptSchema.safeParse(rawShot).success
          ? rawShot
          : fallbackShotPrompt(index, sceneCount),
      continuityNotes: validText(
        raw.continuityNotes ?? raw.continuity_notes ?? raw.continuity,
        continuityNote(index, cast.mode),
        6,
        700,
      ),
      continuityMode: "CONTINUOUS" as const,
      transitionStyle: "CUT" as const,
    };
  });

  const voiceoverScript = scenes.map((scene) => scene.voiceoverText).join(" ");
  const sourceBgm = {
    ...(asRecord(original.bgm ?? original.music) ?? {}),
    ...(asRecord(repaired.bgm ?? repaired.music) ?? {}),
  };
  const explicitMusicOff = sourceBgm?.enabled === false;
  const storyboard = {
    title: validText(
      source.title,
      `${context.businessName} brand story`,
      3,
      100,
    ),
    script: validText(
      source.script ?? source.voiceoverScript,
      voiceoverScript,
      20,
      2400,
    ),
    bgm: explicitMusicOff
      ? {
          enabled: false,
          preset: "none",
          prompt: "Voiceover only; no background music.",
        }
      : {
          enabled: true,
          preset: track.id,
          prompt: `A polished ${track.shortDescription.toLowerCase()} instrumental bed that supports the editorial arc without competing with narration.`,
        },
    continuityBible: {
      product: validText(
        sourceContinuity.product ?? sourceContinuity.productContinuity,
        "Keep every recurring offer artifact, product, material, color, and proportion visually stable across the complete reel.",
        6,
        700,
      ),
      characters:
        cast.mode === "NO_PEOPLE"
          ? "No people appear; keep the story focused on the offer's tangible artifacts, environments, and visible outcomes."
          : validText(
              sourceContinuity.characters ??
                sourceContinuity.characterContinuity,
              "Keep every listed cast member's face geometry, hair, build, age band, wardrobe, and distinguishing feature stable across scenes.",
              20,
              500,
            ),
      cast,
      visualWorld: validText(
        sourceContinuity.visualWorld ?? sourceContinuity.visual_world,
        `Preserve the established lighting direction, lens language, tactile realism, and restrained brand palette across the reel. ${paletteCue(context.palette)}`,
        6,
        700,
      ),
    },
    scenes,
  };

  return parseStoryboardOutput(
    storyboard,
    "STANDARD",
    clamp(Math.round(context.durationSec), 15, 30),
    sceneCount,
  );
}

function recoverCastPlan(value: unknown, sceneText: string) {
  const parsed = castPlanSchema.safeParse(value);
  const explicitlyNoPeople = /\bno (?:people|person|humans?|cast)\b/i.test(
    sceneText,
  );
  const peopleVisible =
    !explicitlyNoPeople &&
    /\b(?:person|people|woman|man|founder|customer|guest|staff|worker|creator|expert|hands?|face|wardrobe)\b/i.test(
      sceneText,
    );

  if (parsed.success && (parsed.data.mode !== "NO_PEOPLE" || !peopleVisible)) {
    return parsed.data;
  }

  const record = asRecord(value);
  const rawMembers = Array.isArray(record?.members)
    ? record.members.slice(0, 4)
    : [];
  const memberCount =
    rawMembers.length > 0 ? rawMembers.length : peopleVisible ? 1 : 0;
  if (memberCount === 0) return { mode: "NO_PEOPLE" as const, members: [] };

  const usedRoles = new Set<string>();
  const members = Array.from({ length: memberCount }, (_, index) => {
    const raw = asRecord(rawMembers[index]) ?? {};
    const kit = identityKits[index]!;
    let role = validText(
      raw.role ?? raw.label,
      index === 0 ? "Lead customer" : `Supporting person ${index + 1}`,
      2,
      40,
    );
    if (usedRoles.has(role.toLowerCase()))
      role = `Supporting person ${index + 1}`;
    usedRoles.add(role.toLowerCase());
    const rawAnchor = Array.isArray(raw.appearanceAnchors)
      ? stringValue(raw.appearanceAnchors[0])
      : undefined;

    return {
      role,
      recurrence:
        raw.recurrence === "SCENE_ONLY"
          ? ("SCENE_ONLY" as const)
          : ("RECURRING" as const),
      ageBand: validText(raw.ageBand ?? raw.age, "adult", 2, 32),
      referenceBasis:
        raw.referenceBasis === "REFERENCE_BACKED"
          ? ("REFERENCE_BACKED" as const)
          : ("FICTIONAL_CAST" as const),
      appearanceAnchors: [
        ...kit.anchors,
        ...(rawAnchor ? [validText(rawAnchor, kit.anchors[0], 2, 48)] : []),
      ].slice(0, 5),
      complexionOrHeritageAnchor:
        typeof raw.complexionOrHeritageAnchor === "string" &&
        raw.complexionOrHeritageAnchor.trim().length >= 2
          ? raw.complexionOrHeritageAnchor.trim().slice(0, 72)
          : null,
      wardrobeAnchor: validText(
        raw.wardrobeAnchor ?? raw.wardrobe,
        kit.wardrobe,
        3,
        80,
      ),
      distinguishingFeature: validText(
        raw.distinguishingFeature,
        kit.distinction,
        8,
        140,
      ),
    };
  });

  return castPlanSchema.parse({
    mode: members.length === 1 ? "SINGLE_PERSON" : "MULTI_PERSON",
    members,
  });
}

function extractConcepts(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (!record) return [];
  for (const key of [
    "concepts",
    "creativeConcepts",
    "creative_concepts",
    "directions",
    "options",
  ]) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return extractConcepts(record.result ?? record.output ?? record.data);
}

function extractSingleConcept(value: unknown) {
  const record = asRecord(value);
  return record?.concept ?? extractConcepts(value)[0] ?? value;
}

function extractStoryboard(value: unknown): Record<string, unknown> {
  const record = asRecord(value) ?? {};
  return (
    asRecord(record.storyboard) ??
    asRecord(record.result) ??
    asRecord(record.output) ??
    record
  );
}

function extractScenes(record: Record<string, unknown>) {
  const value =
    record.scenes ??
    record.storyboardScenes ??
    record.storyboard_scenes ??
    record.timeline;
  return Array.isArray(value) ? value.slice(0, 4) : [];
}

function selectEvenly(values: unknown[], count: number) {
  if (values.length <= count) return values;
  if (count === 1) return [values[0]];
  return Array.from(
    { length: count },
    (_, index) =>
      values[Math.round((index * (values.length - 1)) / (count - 1))],
  );
}

function preferredSceneCount(context: BrandReelRecoveryContext, supplied = 0) {
  if (context.preferredSceneCount != null) {
    return clamp(Math.round(context.preferredSceneCount), 2, 4);
  }
  if (supplied >= 2 && supplied <= 4) return supplied;
  return context.durationSec > 24 ? 4 : 3;
}

function distributeDuration(target: number, count: number) {
  const safeTarget = clamp(Math.round(target), count * 5, count * 10);
  const base = Math.floor(safeTarget / count);
  let remainder = safeTarget - base * count;
  return Array.from({ length: count }, () => {
    const duration = base + (remainder > 0 ? 1 : 0);
    remainder -= remainder > 0 ? 1 : 0;
    return duration;
  });
}

function fallbackCaption(index: number, count: number) {
  if (index === 0) return "See what changes";
  if (index === count - 1) return "Take the next step";
  return index === 1 ? "Proof you can see" : "Built with purpose";
}

function fallbackShotPrompt(index: number, count: number) {
  if (index === 0) return fallbackShotPrompts.opening;
  if (index === count - 1) return fallbackShotPrompts.closer;
  return index === 1
    ? fallbackShotPrompts.mechanism
    : fallbackShotPrompts.proof;
}

function fallbackVoiceover(
  index: number,
  count: number,
  context: BrandReelRecoveryContext,
) {
  const brand = context.businessName.trim() || "This brand";
  if (index === 0)
    return `${brand} begins with the detail that changes what comes next.`;
  if (index === count - 1)
    return `Discover ${brand}, then take the next step with confidence.`;
  return index === 1
    ? "See one clear idea take shape through a tangible, purposeful action."
    : "Every considered detail moves the story toward a more confident outcome.";
}

function continuityNote(index: number, castMode: string) {
  const identity =
    castMode === "NO_PEOPLE"
      ? "the focal artifact's materials and proportions"
      : "every listed cast identity, wardrobe anchor, and screen position";
  return index === 0
    ? `Establish ${identity}; lock the brand palette, directional light, focal scale, and clean upper-left safe area.`
    : `Inherit ${identity} from the prior scene; preserve screen direction, palette, lighting direction, focal scale, and spatial depth.`;
}

function fitWords(value: string, budget: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length <= budget) return value;
  return `${words
    .slice(0, Math.max(1, budget))
    .join(" ")
    .replace(/[,:;.!?]+$/, "")}.`;
}

function contextualize(value: string, context: BrandReelRecoveryContext) {
  const offer = context.offer?.trim();
  const audience = context.audience?.trim();
  const suffix = [
    offer ? `The verified offer is ${offer}.` : "",
    audience ? `The intended audience is ${audience}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `${value} ${suffix}`.trim();
}

function paletteCue(value: unknown) {
  const serialized = Array.isArray(value)
    ? value
        .filter((item) => typeof item === "string")
        .slice(0, 4)
        .join(", ")
    : typeof value === "string"
      ? value
      : "";
  return serialized
    ? `Palette accents: ${serialized}.`
    : "Use the locked brand palette as restrained accents.";
}

function validText(value: unknown, fallback: string, min: number, max: number) {
  const candidate = stringValue(value)?.replace(/\s+/g, " ").trim() ?? "";
  const selected = candidate.length >= min ? candidate : fallback;
  return selected.slice(0, max);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
