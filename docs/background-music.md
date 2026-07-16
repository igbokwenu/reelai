# Curated background music

Updated: July 16, 2026

Reel AI uses a small, curated soundtrack catalog for dependable final renders. The creative agent selects a track while writing the storyboard, Auto mode carries that choice into Remotion, and the Final step lets a user preview the AI match, override it, or turn music off before rendering. Product Showcase defaults BGM on for its first Auto final so users experience the complete audio mix immediately.

## Capability fact-check

Qwen's current audio models cover speech synthesis, speech recognition, and speech-to-speech; they are not dedicated music generators. Alibaba Cloud Model Studio now separately lists `fun-music-v1` for prompt- or lyric-based music generation. It is not a Qwen model, and its current official documentation marks it limited-preview and available only in China (Beijing). That makes it a possible future opt-in integration, but not a reliable default for the international Reel AI pipeline.

Official references:

- [Alibaba Cloud Model Studio supported models](https://www.alibabacloud.com/help/en/model-studio/models)
- [Fun-Music generation](https://www.alibabacloud.com/help/en/model-studio/fun-music)
- [Qwen non-real-time speech synthesis](https://www.alibabacloud.com/help/en/model-studio/non-realtime-tts-user-guide)

## Runtime behavior

1. Standard-reel storyboard generation returns one exact catalog id in `bgm.preset` and Reel AI persists it as `Storyboard.bgmTrackId`.
2. Existing storyboards have a null track id. They remain compatible: a deterministic mood matcher reads the saved title, script, and BGM direction and chooses the closest catalog track, falling back to **Warm Uplift** when there is no useful signal.
3. Auto mode honors `Storyboard.bgmEnabled` and the selected track. Step-by-step mode initializes the Final switch from that same storyboard preference.
4. **AI match** uses the storyboard choice. A user can preview all five assets and make a render-only manual override in the Final step.
5. At render time the chosen public MP3 is hashed and copied into the normal project artifact store. Replacing a public file therefore creates a fresh artifact on the next render while unchanged tracks are reused.
6. Remotion loops short beds, fades music at both reel edges, keeps source-video audio muted, and automatically ducks the bed under scene narration.
7. Product Showcase keeps generated source-clip audio muted but defaults the independent curated BGM layer on. An explicit Final-step toggle-off is honored for voiceover-only re-renders.
8. The Final tab restores the latest render's current-policy BGM toggle and manual selection. Legacy Product Showcase renders used the former `VOICEOVER_ONLY` policy, so they intentionally open on the new default-on AI Match instead of restoring the obsolete forced-off state.

## Asset contract

Replace these files in `apps/web/public/audio/bgm` without renaming them:

| File                   | Track            | Broad coverage                                |
| ---------------------- | ---------------- | --------------------------------------------- |
| `warm-uplift.mp3`      | Warm Uplift      | services, testimonials, community, lifestyle  |
| `clean-momentum.mp3`   | Clean Momentum   | technology, SaaS, explainers, business        |
| `bold-kinetic.mp3`     | Bold Kinetic     | sports, fashion, events, product launches     |
| `cinematic-wonder.mp3` | Cinematic Wonder | luxury, travel, property, emotional reveals   |
| `calm-organic.mp3`     | Calm Organic     | wellness, food, beauty, craft, sustainability |

The committed files are valid eight-second, 96 kbps synthetic MP3 placeholders, not production music. Export replacements as MP3, preferably stereo at 44.1 or 48 kHz and 160–256 kbps. A 30–60 second bed is still lightweight and reduces the chance that a reel reaches an MP3 loop boundary. Master all five to a similar perceived loudness (about -14 LUFS integrated, no higher than -1 dBTP) and leave the vocal midrange uncluttered. Keep proof that the generated or licensed tracks permit commercial use.

## Generation prompts

These prompts are intentionally instrumental and voiceover-friendly. If the music tool has separate controls, choose **instrumental**, disable lyrics/vocals, request a seamless loop, and export MP3.

### `warm-uplift.mp3`

> Create a premium 60-second seamless-loop instrumental bed for a warm, optimistic brand film. 96 BPM, gentle acoustic guitar pulse, soft felt piano, restrained hand percussion, subtle rounded bass, small lift every eight bars. Human and confident, never sentimental or cheesy. No vocals, no spoken words, no lead melody competing with narration, no abrupt ending. Balanced commercial mix, restrained 1–4 kHz range, -14 LUFS integrated, -1 dB true peak.

### `clean-momentum.mp3`

> Create a premium 60-second seamless-loop instrumental bed for a modern technology or business explainer. 112 BPM, precise muted synth plucks, clean marimba-like accents, soft electronic kick, crisp understated percussion, warm sub bass, controlled forward pulse. Smart, minimal and optimistic, not generic corporate stock music. No vocals, no spoken words, no harsh lead synth, no dramatic drops. Leave space for narration, -14 LUFS integrated, -1 dB true peak.

### `bold-kinetic.mp3`

> Create a premium 60-second seamless-loop instrumental bed for a high-energy product launch, sports, fashion or event reel. 126 BPM, punchy modern drums, tight bass groove, short percussive synth stabs, tasteful claps, clear edit points every four bars. Bold and kinetic without sounding aggressive or like a trailer. No vocals, chants or spoken words, no giant risers, no dominant lead melody. Voiceover-friendly midrange, -14 LUFS integrated, -1 dB true peak.

### `cinematic-wonder.mp3`

> Create a premium 60-second seamless-loop instrumental bed for a cinematic luxury, travel, property or emotional brand story. 82 BPM, felt piano fragments, warm low strings, airy pads, soft mallet shimmer, restrained organic percussion, gradual sense of wonder with a graceful eight-bar lift. Elegant and expansive, not ominous and not bombastic. No vocals, choir, trailer booms or abrupt climax. Preserve narration clarity, -14 LUFS integrated, -1 dB true peak.

### `calm-organic.mp3`

> Create a premium 60-second seamless-loop instrumental bed for wellness, food, beauty, craft or sustainable brands. 78 BPM, nylon-string guitar or soft kalimba texture, brushed organic percussion, warm upright-style bass, airy natural ambience, gentle repeating motif. Calm, tactile and reassuring without becoming sleepy. No vocals, spoken words, birdsong, watermarks or busy lead melody. Leave generous room for voiceover, -14 LUFS integrated, -1 dB true peak.

## Local upgrade and testing

The original curated catalog adds nullable `Storyboard.bgmTrackId`. If that migration is not yet applied, stop `pnpm dev`, run `pnpm db:migrate`, then restart with `pnpm dev`. No package install or seed is required. `pnpm dev` regenerates Prisma Client automatically; run `pnpm db:generate` only if an already-open editor still shows the old Prisma type.

Expanding BGM to Product Showcase adds no schema or dependency change. When the curated catalog migration is already applied, only restart `pnpm dev`; do not run `pnpm db:migrate`, `pnpm install`, or `pnpm db:seed` for this update.

An existing completed project is the fastest test and does not need scene regeneration:

1. Open an existing Product Showcase and go to **Final**.
2. Confirm **Include background music** starts enabled, **AI match** names a track, and its preview plays.
3. Preview a manual alternative, render once, and listen for music under silent portions and reduced music under narration.
4. Switch back to **AI match**, render again, and confirm the new final appears in the media library.
5. Temporarily replace one MP3 with another valid MP3 using the same filename, render again, and confirm the replacement is heard; the content hash prevents stale artifact reuse.
6. Toggle music off and render again; confirm the second output is voiceover-only while source-clip audio stays muted in both versions.

Use a new project only to verify fresh AI selection end to end: generate a Product Showcase in Auto mode and confirm its storyboard receives `bgmEnabled = true`, a non-null curated track id, and a first final render containing mood-matched music. Auto and manual rendering share the same catalog resolver and Remotion mixer.
