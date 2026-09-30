# SpeakForge Architecture (Audit Phase)

**Status:** proposed architecture, based on the repository snapshot audited 2026-09-30. This phase documents; it does not build the application.

## Product and scope

SpeakForge is a data-driven English reading/listening/speaking practice product. Its canonical hierarchy is **Level → Book → Content Item**. A content item has a discriminated type such as `unit` or `review`; future types can be added without level-specific screens. The current repository has structured units for A2, B1, and B1+ only. The B1+ data contains units 1–12; do not infer or fabricate 13–24. PDFs and covers also include some future levels, but those assets are not evidence that structured learning content exists.

## Repository facts and gaps

- The project root currently contains `README.md` and `resources/`; there is no app, package manifest, test setup, or existing `docs/` directory.
- All six specification files exist, but each is a 53-byte placeholder (“Replace with the corresponding specification file.”). They cannot be treated as substantive requirements until restored or authored.
- The two files under `resources/reference/` contain only URLs. Both reference pages were inspected and verified on 2026-09-30: <https://readtospeakbooks.com/learn/b1-core> (B1 Core, units 01–12) and <https://readtospeakbooks.com/learn/b2-continuation> (B2 Continuation, units 13–24).
- Preserve `resources/` as source material. Do not rewrite PDFs, JSON, audio, covers, or reference files as part of application normalization.

## Resource audit

### Structured content

All three datasets describe standalone learning units with these top-level keys: `level`, `unit_number`, `unit_title`, `topic`, `passage`, `vocabulary`, `speaking_prompts`, and `grammar_focus`. A passage is an array of paragraph strings: A2 units all have 4; B1 units range 3–5; B1+ units have 4 except units 10 and 11, which have 5. Vocabulary entries contain `word`, `part_of_speech`, `meaning_in_context`, and `example`. `grammar_focus` contains `title`, `explanation`, `examples`, and `practice_task`. The inspected data has 15 vocabulary entries and four speaking prompts per unit; the reference product uses 20 words at B2, so word count must remain data-driven, not fixed.

| Source | Unit count | Level label in data | Format observation |
| --- | ---: | --- | --- |
| `resources/structured/a2/units.a2.json` | 10 | A2 Foundation | Consecutive standalone JSON objects, not one valid JSON array/document. |
| `resources/structured/b1/units.b1.json` | 12 | B1 Core | Must be parsed and validated as delivered; observed multiple top-level units. |
| `resources/structured/b1-plus/units.b1-plus.json` | 12 | B1+ Bridge | 12 units; do not create imagined continuation units. |

No source dataset includes stable IDs, book IDs, review records, audio URLs, passage timing, or per-paragraph audio references. Unit number is only unique within a book; normalized IDs must be generated deterministically from book ID and source number, not written back into source files.

### Audio

There are 10 A2 files (`A2 Unit 1.mp3` through `A2 Unit 10.mp3`), 12 B1 files (`B1 Unit 1.mp3` through `B1 Unit 12.mp3`), and 12 B1+ files (`B1+ Unit 1.mp3` through `B1+ Unit 12.mp3`). These appear to be unit-level recordings, matching the book/unit naming pattern. No paragraph-level clips or timing/word-alignment metadata were found. An inspected B1 Unit 1 file is mono MP3 at 44.1 kHz and approximately 61.75 seconds. Validate every file with media tooling during implementation; do not make passage timestamps or audio-per-paragraph features part of the initial content model.

### Books and covers

PDFs: A2 (38 pages), B1 (44), B1+ (44), and B2 (44), all Letter page size. Covers are JPEG-family JFIF files: `a2.jfif`, `b1.jfif`, nested `b1-plus/b1+.jfif`, `b2/B2.jfif`, `b2-plus/B2+.jfif`, and `c1/C1.jfif`. Thus covers are present for A2, B1, B1+, B2, B2+, and C1. All six inspected cover images are 1792×2400 MJPEG/JFIF. Keep paths explicit in a manifest; do not infer path from slug or force renames.

## Proposed technology and folder boundaries

The repository currently has no technology choices to preserve. Recommended first implementation: **TypeScript + React + Vite**, with a small router (React Router or equivalent), schema validation using Zod, and Vitest for unit/integration checks. Start as a client-side application with a repository interface for persistence. This avoids introducing a server, account system, or AI integration before product requirements are restored. Keep provider keys out of browser code; AI calls later belong behind a server API.

Suggested structure:

```text
src/
  app/                 # router, app shell, route composition
  domain/              # content/progress types and learning rules; UI independent
  content/
    source/             # read-only import boundary for resources (or build input)
    normalize/          # source adapters into canonical model
    manifests/          # level/book/audio/cover mappings
    validate/           # schemas and cross-resource checks
    repository/         # content lookup API
  features/
    catalog/            # level and book browsing
    learning/           # unit/review composition
    audio/              # player and listen events
    vocabulary/         # word tracking
    speaking/           # prompts and completion
    progress/            # progress views and persistence adapter
    ai-practice/         # later provider-neutral interface and UI
  components/            # shared presentational components
  infrastructure/
    persistence/        # local adapter now; cloud adapter later
    ai/                  # server-side provider implementations later
  styles/
resources/               # immutable supplied source assets
docs/
  architecture.md
  agent-handoff.md
```

The exact framework is a recommendation, not a discovered project decision. Revisit if a deployment target or existing conventions are introduced.

## Canonical content model

Use explicit IDs and discriminated item types. Keep source-specific names inside adapters.

```ts
type Level = { id: string; label: string; order: number; bookIds: string[] };
type Book = { id: string; levelId: string; title: string; cover?: AssetRef; sourcePdf?: AssetRef; itemIds: string[] };
type ContentItem = Unit | Review;
type Unit = {
  kind: "unit"; id: string; bookId: string; sequence: number;
  title: string; topic: string; passage: { paragraphs: string[] };
  vocabulary: VocabularyItem[]; speakingPrompts: string[]; grammar: GrammarFocus;
  audio?: AudioAssetRef;
};
type Review = {
  kind: "review"; id: string; bookId: string; sequence: number;
  title: string; includedItemIds: string[]; // add authored review activities only when source requirements exist
};
```

Treat the supplied JSON as source, normalize snake_case to this application model, and validate during the build/CI. Keep data loading behind `ContentRepository` operations such as `listLevels`, `getBook`, and `getContentItem`. Asset maps should explicitly associate a book/unit ID with a relative asset path and metadata. Missing assets are valid optional values unless a product rule later makes them required. Validation should report malformed JSON, duplicate IDs/sequences, invalid references, missing expected unit audio, invalid schema, and orphaned assets. Do not “repair” source files silently; normalize through adapters and document any data correction separately.

## Routes and UI composition

Use parameterized routes, not per-level or per-unit implementations:

```text
/levels
/levels/:levelId
/books/:bookId
/books/:bookId/items/:itemId
/books/:bookId/reviews/:itemId
```

The item route resolves a typed content item and renders the appropriate feature. Unknown types and missing IDs get explicit not-found states. Catalog, book overview, unit reader, and review can share shell/navigation and cards. Unit composition should be assembled from reusable passage, audio, vocabulary, grammar, and speaking features. Responsive behavior should preserve access to audio controls, reading, and progress on narrow screens; measure the reference behavior later with manual browser review.

## Learning and progress boundaries

Keep pure learning rules in `domain/`, with UI emitting events and rendering derived state:

- Sequential unlock: configurable policy over ordered items. Store completion by item ID; review gates must be explicit policy/data, not inferred solely from every third number.
- Listening: record completed listens, not play-button presses. A listen qualifies only when the playback reaches its completion threshold; the threshold and reset behavior need a product decision. The B1 reference describes unlock after three complete listens and recommends 3–5 total.
- Passage visibility: derive from listen state and policy; do not mutate content.
- Vocabulary tracking: per-user/per-book/unit/word counts or mastered state; reference method describes five successful spoken uses per target word.
- Speaking and grammar progress: separate completion events, because current source only supplies prompts/practice task and has no scoring contract.
- AI completion: later activity event with provider/model metadata and a safe summary, not raw secret-bearing request state.

Define a `ProgressRepository` interface (read/write progress by learner and content IDs). Start with a versioned local-storage adapter and migration functions. Components depend on the interface or a domain service, never directly on `localStorage`. A later authenticated adapter can target Supabase/PostgreSQL without UI rewrites. No account identity or cross-device merge policy is established yet.

## AI Practice boundary (design only)

Construct a validated `UnitContext` from normalized content: level, book, unit, topic, passage, vocabulary, grammar, and speaking prompts. Expose a provider-neutral server contract (for example `PracticeProvider.generateTurn(context, learnerInput, history)`) and normalize provider responses into app-owned types. OpenAI, Gemini, Claude, or another provider is an implementation choice behind that interface. API keys and provider calls stay server-side. Add consent, retention, safety, cost/limits, and failure behavior requirements before shipping. This phase does not implement AI practice.

## Reference UX observations

The accessible B1 page presents level selection, a book/core-continuation choice, a numbered unit track with periodic review cards, then a selected unit with listening instructions, playback speed/repeat controls, a passage gated by three completed listens, vocabulary with word tracking, four speaking prompts, grammar, and a method explanation. Its method order is Listen → Shadow → Read → active vocabulary → Speak, with review after every three units. These are observations from the reference and must be translated into original SpeakForge branding, UI, and code; do not copy their assets or implementation. The B2 URL could not be inspected in this audit.

## Implementation sequence

1. Restore/author the actual product specs and decide unresolved learning rules.
2. Establish TypeScript app shell, route skeleton, domain IDs/types, and content repository contract.
3. Build source adapters, asset manifests, schema/cross-file validation, and report source-format anomalies. Keep raw resources untouched.
4. Implement progress interface/local adapter and pure unlock/listen/vocabulary rules.
5. Build responsive catalog, book, unit, and review UI against normalized fixtures/data.
6. Add audio integration and verify playback/completion behavior against actual files.
7. Add QA/accessibility/performance checks and merge gate.
8. Design and implement server-side AI practice only after requirements, safety, and deployment are decided.
9. Add cloud persistence/authentication when product requirements justify it.

## Risks and unresolved decisions

- The supplied specification files are placeholders, so key requirements in the brief are not present in the repository.
- A2 JSON is not one valid JSON document; confirm exact parser behavior and repair strategy before app ingestion. Audit exact syntax of B1 and B1+ in the content-engine phase too.
- No stable source IDs or explicit reviews exist in structured data. Do not invent review content; represent review items only when requirements/content are supplied.
- Asset path conventions are inconsistent (flat and nested covers); map explicitly.
- Audio timing/segmentation metadata is absent; only unit playback is justified.
- B2 has PDF/cover assets but no structured JSON/audio directory in the audited tree. B2+ and C1 have covers only. Do not present these as available courses.
- The reference B2 page was not verifiable, and reference files are URL stubs.
- Persistence identity, listen qualification, completion semantics, reset behavior, accessibility targets, hosting, and AI data policy remain product decisions.

## Phase 2 implementation note

The content engine is implemented in JavaScript ESM using Node.js built-ins, with no runtime dependencies. Source JSON is parsed and normalized at load time; manifests map only observed assets. `npm run validate:content` validates source and mappings, and `npm test` exercises the normalizer. Route descriptors are present, but no frontend framework or UI was added in this phase. Git was initialized; see `docs/agent-handoff.md` for status and ownership boundaries.

## Phase 4 audio boundary

The reusable player is split between `src/components/audio-player.js` (markup), `src/features/audio/audio-player.js` (native media state and controls), and `src/features/audio/audio-preferences.js` (scoped, injectable playback-speed persistence). Unit detail loads its normalized audio reference and passes it to the component. The HTTP server serves one requested MP3 with byte-range support. Audio state covers loading, ready, playing, paused, ended, and error; it does not count legitimate listens or couple to progress. Future listen completion and Follow Along must consume a separate event boundary without making the player unit-specific.

## Phase 5 listening, unlock, and timing boundary

The existing AudioPlayer remains independent from completion policy and exposes generic playback events through `onPlaybackEvent`. A domain tracker grants one completion only after natural end, start near zero, and at least 99.5% continuous naturally observed coverage. Seeking forward leaves a coverage gap; replayed audio can fill a legitimate gap. Repeat mode emits a separate ended event for each loop.

A versioned `ListeningProgressStore` accepts an injectable storage adapter and keys records by canonical unit ID. It persists listen count and monotonic passage unlock. The browser implementation uses localStorage behind this interface. Passage text is omitted from initial HTML and requested from the normalized content endpoint only after unlock. The endpoint is a product-flow gate, not a security boundary.

`AudioTiming` version 1 supports nested paragraph, sentence, phrase, and word segments with IDs, text, times, and paragraph membership. The validator checks ordering and bounds. The reader consumes supplied timing against the native unit audio; absent timing uses ordinary reading plus unit playback, without guessed timestamp interpolation. Local Whisper experimentation on A2 Unit 1 produced a matching transcript and word estimates, but no estimates were independently reviewed, so no sidecar is shipped and no unit advertises synchronization.