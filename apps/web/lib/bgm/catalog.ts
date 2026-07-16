export const BGM_TRACK_IDS = [
  "warm-uplift",
  "clean-momentum",
  "bold-kinetic",
  "cinematic-wonder",
  "calm-organic",
] as const;

export type BgmTrackId = (typeof BGM_TRACK_IDS)[number];
export type BgmTrackSelection = "AUTO" | BgmTrackId;

export type BgmTrack = {
  id: BgmTrackId;
  name: string;
  shortDescription: string;
  bestFor: string;
  assetPath: string;
  color: string;
};

export const BGM_TRACKS: readonly BgmTrack[] = [
  {
    id: "warm-uplift",
    name: "Warm Uplift",
    shortDescription: "Human, optimistic and quietly confident",
    bestFor: "services, testimonials, community, lifestyle",
    assetPath: "/audio/bgm/warm-uplift.mp3",
    color: "from-amber-400/25 to-rose-400/10",
  },
  {
    id: "clean-momentum",
    name: "Clean Momentum",
    shortDescription: "Precise, modern and forward-moving",
    bestFor: "technology, SaaS, explainers, business",
    assetPath: "/audio/bgm/clean-momentum.mp3",
    color: "from-cyan-400/25 to-blue-500/10",
  },
  {
    id: "bold-kinetic",
    name: "Bold Kinetic",
    shortDescription: "Punchy, energetic and launch-ready",
    bestFor: "sports, fashion, events, product launches",
    assetPath: "/audio/bgm/bold-kinetic.mp3",
    color: "from-fuchsia-400/25 to-orange-500/10",
  },
  {
    id: "cinematic-wonder",
    name: "Cinematic Wonder",
    shortDescription: "Expansive, premium and story-led",
    bestFor: "luxury, travel, property, emotional reveals",
    assetPath: "/audio/bgm/cinematic-wonder.mp3",
    color: "from-violet-400/25 to-indigo-500/10",
  },
  {
    id: "calm-organic",
    name: "Calm Organic",
    shortDescription: "Natural, spacious and reassuring",
    bestFor: "wellness, food, beauty, craft, sustainability",
    assetPath: "/audio/bgm/calm-organic.mp3",
    color: "from-emerald-400/25 to-teal-500/10",
  },
] as const;

const TRACK_BY_ID = new Map(BGM_TRACKS.map((track) => [track.id, track]));

const TRACK_SIGNALS: Record<BgmTrackId, RegExp[]> = {
  "warm-uplift": [
    /\b(?:warm|uplift|hope|human|heart|community|family|friendly|optimis|inspir|trust|service|testimonial|joy|bright|positive|reassur)\w*\b/gi,
  ],
  "clean-momentum": [
    /\b(?:clean|modern|tech|digital|software|saas|app|platform|workflow|business|corporate|precis|minimal|innovation|future|productiv|explainer|momentum)\w*\b/gi,
  ],
  "bold-kinetic": [
    /\b(?:bold|kinetic|energy|energetic|fast|sport|fitness|launch|event|fashion|street|power|punch|impact|dynamic|urgent|driving|confident|hype)\w*\b/gi,
  ],
  "cinematic-wonder": [
    /\b(?:cinematic|wonder|epic|luxury|premium|elegant|travel|property|architecture|dramatic|emotional|reveal|story|atmospher|expansive|majestic|hero)\w*\b/gi,
  ],
  "calm-organic": [
    /\b(?:calm|organic|natural|wellness|health|gentle|soft|serene|peace|beauty|skincare|food|coffee|craft|sustain|earth|quiet|relax|healing|acoustic)\w*\b/gi,
  ],
};

export function isBgmTrackId(value: unknown): value is BgmTrackId {
  return typeof value === "string" && TRACK_BY_ID.has(value as BgmTrackId);
}

export function getBgmTrack(id: BgmTrackId) {
  return TRACK_BY_ID.get(id)!;
}

export function selectBgmTrack({
  preferredTrackId,
  creativeText = "",
}: {
  preferredTrackId?: string | null;
  creativeText?: string | null;
} = {}): BgmTrack {
  if (isBgmTrackId(preferredTrackId)) {
    return getBgmTrack(preferredTrackId);
  }

  const scores = BGM_TRACK_IDS.map((id) => {
    const exactIdBonus = creativeText?.toLowerCase().includes(id) ? 100 : 0;
    const signalScore = TRACK_SIGNALS[id].reduce(
      (score, pattern) => score + (creativeText?.match(pattern)?.length ?? 0),
      0,
    );
    return { id, score: exactIdBonus + signalScore };
  });
  scores.sort(
    (a, b) =>
      b.score - a.score ||
      BGM_TRACK_IDS.indexOf(a.id) - BGM_TRACK_IDS.indexOf(b.id),
  );

  return getBgmTrack(scores[0]?.score ? scores[0].id : "warm-uplift");
}
