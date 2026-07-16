export const showcaseCameraBehaviors = [
  "FIXED",
  "SLOW_PUSH_IN",
  "SLOW_PULL_BACK",
  "GENTLE_ORBIT",
] as const;

export const showcaseHumanPresence = ["NO_PERSON", "ONE_PERSON"] as const;

export const showcaseSeparationTreatments = [
  "AVOID",
  "FOOD_LAYER_SEPARATION",
  "VISIBLE_COMPONENT_SEPARATION",
] as const;

export type ShowcaseMotionPlan = {
  heroAction: string;
  supportingMotion: string;
  cameraBehavior: (typeof showcaseCameraBehaviors)[number];
  humanPresence: (typeof showcaseHumanPresence)[number];
  separationTreatment: (typeof showcaseSeparationTreatments)[number];
  safetyRationale: string;
};

type ProductDescriptor = {
  name: string;
  details?: string | null;
};

type ConceptWithMotion = {
  title?: string;
  hook?: string;
  strategy?: string;
  narrativeArc?: string;
  visualStyle?: string;
  previewPrompt?: string;
  motionPlan?: ShowcaseMotionPlan;
};

type StoryboardWithMotion = {
  continuityBible?: {
    characters?: string;
    cast?: { mode?: string; members?: unknown[] };
  };
  scenes: Array<{
    index?: number;
    shotPrompt: string;
    continuityNotes?: string;
  }>;
};

const foodPattern =
  /\b(?:burger|sandwich|taco|wrap|pizza|cake|pastry|dessert|cookie|biscuit|bread|donut|doughnut|ice[ -]?cream|food|meal|snack|ingredient|cheese|lettuce|tomato|patty|bun|cream|filling|layered)\b/i;
const electronicPattern =
  /\b(?:electronic|electronics|phone|smartphone|laptop|tablet|computer|keyboard|headphone|earbud|speaker|camera|watch|smartwatch|device|gadget|charger|battery|circuit|sensor|screen|display|monitor)\b/i;
const fabricPattern =
  /\b(?:fabric|textile|garment|clothing|apparel|dress|shirt|jacket|trouser|pants|skirt|scarf|shoe|sneaker|bag|leather|denim|cotton|silk|wool|woven|knit)\b/i;
const visibleModularPattern =
  /\b(?:modular|stackable|detachable|removable|interlocking|large visible (?:parts|pieces|components)|outer shell|packaging layers)\b/i;
const riskyTeardownPattern =
  /\b(?:tear[ -]?down|tears? (?:apart|down)|exploded view|explodes? (?:apart|into)|disassembl(?:e|es|ed|y)|dismantl(?:e|es|ed)|deconstruct(?:s|ed|ion)?|internal (?:parts|components|layers)|circuit board|stitches? (?:split|unravel)|seams? (?:split|open)|unravels?|dozens of (?:parts|pieces)|floating (?:parts|components)|separates? into (?:parts|components|pieces))\b/i;
const anySeparationPattern =
  /\b(?:separat(?:e|es|ed|ion)|reassembl(?:e|es|ed|y)|layers? (?:rise|lift|float|separate)|components? (?:rise|lift|float|separate))\b/i;
const multiplePeoplePattern =
  /\b(?:two|three|several|multiple) (?:people|persons|humans|models|customers|users|shoppers|hands)|\b(?:couple|crowd|group of people|friends|family|team|models)\b/i;
const overloadedScreenPattern =
  /\b(?:rapid(?:ly)? (?:scroll|swipe|tap|type|screen|interface)|multiple (?:screens|windows|apps|panels|notifications)|cascading notifications|dashboard (?:animates|transforms|changes)|interface (?:morphs|transforms|cycles)|screen (?:cycles|flashes|fills with)|scrolls?[^.]{0,48}(?:tap|swipe|type)|(?:tap|swipe|type)[^.]{0,48}scrolls?)\b/i;

export function buildShowcaseMotionGuardrailBrief(
  products: ProductDescriptor[],
) {
  const profile = classifyProductMotion(products);
  const separationRule =
    profile === "LAYERED_FOOD"
      ? "A restrained ingredient-layer separation is eligible only when every layer is visible or verified: move a few large layers on one axis, hold their order and proportions, then settle once. It is one optional route, not the default for all three concepts."
      : profile === "VISIBLE_MODULAR_GOOD"
        ? "A restrained visible-component separation is eligible only for large, externally visible, reference-backed modular pieces: move them on one axis and settle once. Never expose or invent internal construction."
        : "Set separationTreatment to AVOID. Do not pitch teardown, exploded views, disassembly, floating parts, internal reveals, or reassembly for this product.";

  return `PRODUCT SHOWCASE MOTION DECISION
- Inferred execution profile: ${profile} (use the verified intake and uploaded images as the final authority).
- Prefer premium low-complexity motion that still has a visible payoff: slow product rotation, a gentle partial orbit, slow push-in or pull-back, controlled zoom-like framing, parallax, light sweep, package/cap reveal, one material response, or one simple use-result.
- Every shot has exactly one hero action. At most one low-amplitude supporting material behavior may run behind it; never stack camera, product, hands, particles, and screen activity into competing actions.
- If a person appears anywhere in the concept, use exactly one person total and let only that person interact with the product. No couples, crowds, extra hands, background people, handoffs, or a second model.
- Screens get one readable state or one simple interaction. No rapid scrolling, typing plus tapping, notification cascades, multi-panel animation, or interface morphing.
- ${separationRule}
- Use teardown/separation only when the category and visible reference geometry make it clearly safer than a rotation, light, texture, or use-context treatment. When uncertain, choose AVOID.`;
}

export function findShowcaseConceptViolations(
  concepts: ConceptWithMotion[],
  products: ProductDescriptor[],
) {
  const profile = classifyProductMotion(products);
  const violations: string[] = [];

  for (const [index, concept] of concepts.entries()) {
    const label = `Concept ${index + 1}${concept.title ? ` (${concept.title})` : ""}`;
    const plan = concept.motionPlan;
    const copy = positiveExecutionCopy(
      [
        concept.hook,
        concept.narrativeArc,
        concept.visualStyle,
        concept.previewPrompt,
        plan?.heroAction,
        plan?.supportingMotion,
      ]
        .filter(Boolean)
        .join(" "),
    );

    if (!plan) {
      violations.push(`${label} is missing its Product Showcase motion plan.`);
      continue;
    }
    if (multiplePeoplePattern.test(copy)) {
      violations.push(`${label} introduces more than one person.`);
    }
    if (overloadedScreenPattern.test(copy)) {
      violations.push(`${label} overloads a generated screen interaction.`);
    }
    validateSeparationDecision(label, copy, plan, profile, violations);
  }

  return violations;
}

export function findShowcaseStoryboardViolations(
  storyboard: StoryboardWithMotion,
  products: ProductDescriptor[],
) {
  const profile = classifyProductMotion(products);
  const violations: string[] = [];
  const cast = storyboard.continuityBible?.cast;

  if (
    cast?.mode === "MULTI_PERSON" ||
    (Array.isArray(cast?.members) && cast.members.length > 1)
  ) {
    violations.push(
      "Product Showcase allows no people or one person total; the cast plan contains multiple people.",
    );
  }

  const fullCharacterPlan = positiveExecutionCopy(
    storyboard.continuityBible?.characters ?? "",
  );
  if (multiplePeoplePattern.test(fullCharacterPlan)) {
    violations.push(
      "Product Showcase character continuity describes multiple people.",
    );
  }

  for (const [index, scene] of storyboard.scenes.entries()) {
    const label = `Scene ${scene.index ?? index + 1}`;
    const copy = positiveExecutionCopy(
      `${scene.shotPrompt} ${scene.continuityNotes ?? ""}`,
    );
    if (multiplePeoplePattern.test(copy)) {
      violations.push(`${label} introduces more than one person.`);
    }
    if (overloadedScreenPattern.test(copy)) {
      violations.push(
        `${label} asks the video model for too much screen activity.`,
      );
    }
    if (riskyTeardownPattern.test(copy)) {
      violations.push(
        `${label} uses a high-risk teardown or internal-parts effect.`,
      );
    } else if (
      anySeparationPattern.test(copy) &&
      profile !== "LAYERED_FOOD" &&
      profile !== "VISIBLE_MODULAR_GOOD"
    ) {
      violations.push(
        `${label} separates a product whose category is not safe for visible-layer motion.`,
      );
    }
  }

  return [...new Set(violations)];
}

export function findShowcaseShotViolations(
  shots: Array<{ index: number; shotPrompt: string; continuityNotes?: string }>,
  characterContinuity: string,
  products: ProductDescriptor[],
) {
  return findShowcaseStoryboardViolations(
    {
      continuityBible: {
        characters: characterContinuity,
      },
      scenes: shots,
    },
    products,
  );
}

function validateSeparationDecision(
  label: string,
  copy: string,
  plan: ShowcaseMotionPlan,
  profile: ReturnType<typeof classifyProductMotion>,
  violations: string[],
) {
  if (riskyTeardownPattern.test(copy)) {
    violations.push(
      `${label} uses a high-risk teardown or internal-parts effect.`,
    );
  }
  if (
    plan.separationTreatment === "FOOD_LAYER_SEPARATION" &&
    profile !== "LAYERED_FOOD"
  ) {
    violations.push(
      `${label} assigns food-layer separation to a non-food product.`,
    );
  }
  if (
    plan.separationTreatment === "VISIBLE_COMPONENT_SEPARATION" &&
    profile !== "VISIBLE_MODULAR_GOOD"
  ) {
    violations.push(
      `${label} separates components without verified large modular geometry.`,
    );
  }
  if (plan.separationTreatment === "AVOID" && anySeparationPattern.test(copy)) {
    violations.push(
      `${label} describes separation even though its motion plan says to avoid it.`,
    );
  }
}

function classifyProductMotion(products: ProductDescriptor[]) {
  const hero = products[0];
  const text = hero ? `${hero.name} ${hero.details ?? ""}` : "";
  if (electronicPattern.test(text)) return "ELECTRONIC_OR_SCREEN" as const;
  if (fabricPattern.test(text)) return "FABRIC_OR_WEARABLE" as const;
  if (foodPattern.test(text)) return "LAYERED_FOOD" as const;
  if (visibleModularPattern.test(text)) return "VISIBLE_MODULAR_GOOD" as const;
  return "GENERAL_PRODUCT" as const;
}

function positiveExecutionCopy(value: string) {
  return value.replace(
    /\b(?:avoid(?:s|ed|ing)?|without|never|no|not|rather than|instead of|does not|do not|must not|cannot)\b[^.;!?]{0,120}[.;!?]?/gi,
    " ",
  );
}
