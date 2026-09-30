# SpeakForge Agent Handoff

**Last updated:** 2026-09-30  
**Project owner/creator:** Ahmed Ramadan  
**Current phase:** Phase 7 Word Tracking, Speaking Prompts, and optional local recording implemented on `feature/word-tracking-speaking`. Grammar, reviews, and AI remain out of scope.

## Project overview

SpeakForge is intended to be a scalable, data-driven English-learning platform organized as Level → Book → Content Item (unit, review, and future item types). The repository is the source of truth. Future agents must read this file before work and update it after each major task.

## Current status

- Git initialized on `master`; initial commit `866ea68` records the source resources and foundation. `.gitignore`, npm scripts, Node.js ESM source, tests, and route descriptors are present.
- Architecture recommendation and audit findings are in [architecture.md](architecture.md).
- Responsive navigation/catalog UI and reusable unit pages are implemented. Unit pages now include the real unit-level AudioPlayer. Listen completion, gated passage reading, timing-ready reader, data-driven vocabulary/TTS, persisted Word Tracking, prompt completion, and optional page-local recordings are implemented.
- Supplied specs are placeholders (53 bytes each); they need real product requirements before implementation can confidently enforce them.
- A2 structured JSON is concatenated unit objects; the shared parser now accepts concatenated objects, single objects, and array-wrapped data without source edits.

## Actual resource inventory

- Specs: `platform.md`, `content-schema.md`, `learning-system.md`, `ai-practice.md`, `data-model.md`, `build-instructions.md`; all currently placeholder text.
- Structured: A2 10 units, B1 12, B1+ 12. All share top-level `level`, `unit_number`, `unit_title`, `topic`, `passage`, `vocabulary`, `speaking_prompts`, `grammar_focus`. Normal units have four passage paragraphs; B1+ units 10–11 have five. All inspected units have 15 vocab entries and four prompts. No IDs, reviews, audio links, or timing data.
- PDFs: A2 (38 pages), B1 (44), B1+ (44), B2 (44), Letter size.
- Audio: unit-named MP3s for A2 units 1–10, B1 units 1–12, B1+ units 1–12. No paragraph clips or timing maps identified. Do not invent B1+ 13–24.
- Covers: A2, B1, B1+, B2, B2+, C1 in JFIF/JPEG format, all 1792×2400; flat/nested path conventions differ.
- Reference: B1 page inspected at `https://readtospeakbooks.com/learn/b1-core`; B2 continuation URL was inaccessible. Local reference text files only contain URLs.

## Architecture and technology decisions

See `docs/architecture.md` for the full proposal. No stack is present in the repository. Recommended initial stack is TypeScript, React, Vite, parameterized routing, Zod validation, Vitest, pure domain rules, and repository interfaces for content/progress. These are proposals pending implementation approval/product constraints, not existing facts.

Key boundaries:

- Keep original resources immutable; normalize through adapters and explicit content/audio/cover manifests.
- Model Level, Book, and discriminated ContentItem (`unit`, `review`, future types) with deterministic IDs scoped by book.
- UI depends on content/progress interfaces and domain services, not raw JSON or localStorage.
- Start persistence with versioned local storage behind `ProgressRepository`; later cloud storage should preserve that contract.
- AI context is built from normalized level/book/unit/topic/passage/vocabulary/grammar/prompts. Provider API keys and provider calls must stay server-side. AI is design-only now.
- Use parameterized routes and reusable feature composition; never hard-code A2/B1/B1+ or numbered units in page implementations.

## Learning assumptions observed, not yet product-confirmed

The B1 reference says listen 3–5 times; passage unlocks after three complete listens; shadowing, reading, active vocabulary, speaking prompts, and reviews after each three units form its method. Word tracking describes five successful spoken uses per word. Translate these to pure, configurable learning policies and confirm edge cases (qualifying listen, thresholds, replay/reset, review gating) before implementation. Current source content has no review records or completion rules.

## Multi-agent workflow and file ownership

Every agent reads `docs/agent-handoff.md` first, claims an isolated area, avoids simultaneous edits to the same file, and updates this handoff after a major task. Prefer sequential integration and independent file ownership. Do not run overlapping agents against shared router/config/schema files.

| Workstream | Primary ownership | Safe parallel work | Shared/conflict-prone files |
| --- | --- | --- | --- |
| Content engine | `src/content/**`, `src/domain/content-types*` | Adapters, manifests, validators, fixtures can be split by subfolder | canonical types, package/config, root exports |
| UI/catalog/learning pages | `src/features/**`, `src/components/**`, UI styles | Catalog and reader components can proceed against agreed interfaces | router, app shell, global styles, shared types |
| Audio and learning rules | `src/features/audio/**`, `src/domain/learning/**` | Pure rules and player can proceed after shared event contract is fixed | shared progress types, unit composition, progress API |
| Progress/persistence | `src/features/progress/**`, `src/infrastructure/persistence/**` | Local adapter and policy tests after repository contract is approved | domain event schema, storage migrations |
| AI practice (later) | `src/features/ai-practice/**`, server-side `src/infrastructure/ai/**` | Provider adapters only after `UnitContext` and server contract are agreed | secrets/config, shared context schema, API routing |
| QA/integration | `tests/**`, `e2e/**`, docs test matrix | Independent tests can target stable contracts | package scripts, fixtures, config, shared tests |

Conflicts most likely in `package.json`, lockfile, router/app entry, global CSS/theme tokens, shared domain types, repository interfaces, and handoff/architecture docs. Assign one owner or merge these serially. Do not let multiple agents update handoff concurrently; integration owner consolidates findings.

## Git strategy and merge order

Keep `main` as the integration baseline. Use short-lived feature branches such as `feature/content-engine`, `feature/progress`, `feature/audio`, `feature/ui`, `feature/ai-practice`, and `qa/testing`; branch names are examples, not a required long-lived matrix. One owner integrates in this order: shared contracts/config → content engine → learning/progress rules → UI/catalog → audio integration → QA/accessibility → AI/cloud work when separately authorized and specified. Merge only after the branch is rebased/updated on current main and the agreed checks pass. Prefer small PRs, no unrelated formatting, and no direct parallel edits to the same files. Worktrees are useful for parallel checkout isolation when available.

## Testing and merge checks

Do not claim checks passed without running them. Once the app scaffold exists, require content schema and cross-resource validation, unit tests for unlock/listen/progress rules, UI route/build checks, audio asset/path verification, accessibility keyboard/screen-size review, and a production build. Run targeted checks per branch and the full suite after integration. Source resources should be checked for accidental modification in every merge.

## Known issues and next tasks

1. Restore/author the six actual specifications; placeholders do not provide reliable requirements.
2. Inspect exact JSON framing/validity of all three structured files and decide an adapter strategy without changing source files.
3. Verify cover dimensions and audio-file integrity/durations, then create explicit manifests.
4. Resolve learning-policy choices, review content strategy, persistence identity, hosting, and AI data/safety requirements.
5. The navigation phase is complete; the next phase is Unit Player + Audio Foundation, with the current UnitPage intentionally limited to metadata.

## Current task

This phase audited the available resources, inspected the B1 reference UX, recorded the inaccessible B2 reference as unverified, and documented the proposed architecture and multi-agent workflow. Stop here; no application implementation is authorized by this phase.

## Phase 2 delivery (2026-09-30)

### Files created

- `.gitignore`, `package.json`
- `src/domain/content-model.js`
- `src/content/manifests/catalog.js`
- `src/content/normalize/parse-source.js`, `src/content/normalize/normalize-unit.js`
- `src/content/repository/content-loader.js`
- `src/content/validate/validate-content.js`
- `src/app/routes.js`
- `src/components/README.md`, `src/features/README.md`
- `scripts/validate-content.js`
- `tests/content-normalization.test.js`

### Model and loader

- Uses stable IDs scoped to book and unit number; vocabulary and prompt IDs use within-unit position, with vocabulary word slug included for readability.
- Preserves passage paragraphs, source vocabulary wording/fields, source prompt wording, grammar fields, source level label, and source filename.
- Audio references are explicit `.mp3` paths matched by level folder and unit number. No paragraph audio or timing is represented.
- Catalog marks A2, B1, B1+ as available (10/12/12 units) and B2, B2+, C1 as planned. B2's supplied PDF and covers are mapped; B2+/C1 have cover mappings only. Planned books return no units. Reviews API returns an empty list because no review content is supplied.
- Loader API: `listLevels`, `getLevel`, `listBooks`, `getBook`, `listUnits`, `getUnit`, `listVocabulary`, and `listReviews`.
- Normalizer accepts a single object, root array, or concatenated root objects and leaves the resource files untouched.

### Validation and commands

- `npm run validate:content` validates source framing/schema, expected unit totals, unique unit numbers/IDs, grammar, passage/vocabulary/prompts, audio mappings, and catalog asset references. Repeated vocabulary words produce warnings, not failures.
- `npm test` uses Node's built-in test runner. Three tests cover parser variants, A2/B1/B1+ unit 1, unit totals, planned content, and absent reviews.
- Last run: 3 tests passed, 0 failed. Content validation passed for 34 units and 3 books with 45 repeated-vocabulary warnings.
- Node.js v24.14.0 and npm 11.11.0 are installed. No third-party packages were added. This phase creates route descriptors only; no UI framework or visual pages.

### Git and source status

- `git init` completed. Git reports the directory owner differs from the sandbox identity; use a per-command `safe.directory` setting for Git operations rather than changing global config.
- The configured Git author was used for initial commit `866ea68` (`Set up SpeakForge content engine foundation`). Git operations require a per-command `safe.directory` setting because the sandbox identity differs from the workspace owner.
- `resources/structured/*.json`, PDFs, MP3s, covers, and reference materials were not edited.

### Known issues and next phase

- The six product specification files remain placeholders and are not used as requirements.
- The original B1 and B1+ source framing was handled by the same tolerant parser; any future source format should be covered by fixtures.
- Next phase: agree final product constraints, then build the catalog/level/book UI on the stable loader and route contracts. Keep unit page, audio-player experience, AI Practice, and cloud persistence in their later phases.


## Phase 3 delivery (2026-09-30)

### Routes and navigation

- `/` home catalog, `/about`, `/learn/:levelId` level overview, `/learn/:bookRouteSlug` selected-book overview, and `/learn/:bookRouteSlug/unit-:unitNumber` reusable unit placeholder. Legacy short `/:levelId` routes are also accepted.
- Available level/book destinations: `/learn/a2`, `/learn/b1-core`, `/learn/b1plus-bridge`. Unit 1 examples: `/learn/a2/unit-01`, `/learn/b1-core/unit-01`, `/learn/b1plus-bridge/unit-01`.
- Planned level routes display their mapped cover and an upcoming state with no unit list. Route slugs live in the catalog manifest; canonical unit IDs remain internal loader keys.

### Components and data flow

- Reusable shell in `src/components/layout.js`; shared `level-switcher.js`, `book-card.js`, and `unit-list.js` components; catalog/home/level/unit renderers in `src/features/catalog/pages.js`.
- `src/app/render.js` resolves paths and calls the existing `contentLoader`; `src/app/server.js` serves rendered HTML, styles, script, and mapped cover images. `scripts/serve.js` starts the server.
- Catalog level/book metadata comes from the Phase 2 manifest and loader. `listUnitSummaries(bookId)` returns only card fields for overview pages. `getUnit(canonicalId)` fetches full normalized detail only for a selected unit route. No second content loader was added.
- `src/app/routes.js` centralizes route shapes and URL helpers. `src/content/manifests/catalog.js` adds stable route slugs.
- Responsive styling is in `public/styles.css`; the mobile navigation toggle is in `public/app.js`. Pages use semantic headings, ordered unit lists, breadcrumb navigation, keyboard-visible focus, a skip link, labelled navigation, and descriptive cover text.
- Unit metadata and cover/audio availability come from normalized data/mappings. Unit status accepts AVAILABLE, LOCKED, COMPLETED, and CURRENT when supplied; since Phase 2 has no progress abstraction, this UI currently displays AVAILABLE for every unit. It does not invent completion or lock state.
- Short descriptions summarize the actual unit count and topics. No unit content is hard-coded in presentation components.

### Files changed/created in Phase 3

- Updated `README.md`, `package.json`, `src/content/repository/content-loader.js`, `src/content/manifests/catalog.js`, and `src/app/routes.js`.
- Added `src/app/html.js`, `src/app/render.js`, `src/app/server.js`.
- Added reusable components under `src/components/`: `layout.js`, `book-card.js`, `level-switcher.js`, `unit-list.js`.
- Added pages at `src/features/catalog/pages.js`, responsive assets at `public/styles.css` and `public/app.js`.
- Added `scripts/serve.js`, `scripts/build.js`, `scripts/verify-production.js`, and `tests/navigation.test.js`.

### Commands and verification

- `npm start`: local server at `http://localhost:4173`.
- `npm run build`: copies the server, public assets, content modules, and source resources into `dist/`.
- `npm run verify:production`: HTTP smoke check for home, all populated level/book routes, planned B2+, unit routes, a cover, and stylesheet from the production output. Run after build.
- `npm test`: 7 tests passed, 0 failed (normalization plus navigation, future states, placeholder routes, and HTTP assets).
- `npm run validate:content`: passed for 34 units, with 45 repeated-vocabulary warnings.
- `npm run build`: succeeded; production smoke check passed.

### Git and next phase

- Working branch: `feature/levels-books-navigation`. Navigation implementation commit: `ecd974e` (`Build levels books and unit navigation`).
- The next requested phase is **Unit Player + Audio Foundation**. Keep the current UnitPage as a metadata-only placeholder until that phase; add actual progress state only after a progress abstraction is established.


## Phase 4 delivery (2026-09-30)

### Branch and feature files

- Branch: `feature/unit-player-audio`.
- Updated `src/features/catalog/pages.js` to expand the shared UnitPage with Now Listening, unit metadata, instructions, and the player.
- Updated `src/app/server.js` to serve only requested cover/audio assets. Audio responses support HTTP byte ranges so native seeking can request partial content.
- Updated `public/app.js` to mount the player and mobile navigation. Added responsive audio control styles to `public/styles.css`.
- Added reusable markup in `src/components/audio-player.js`.
- Added player state/control behavior in `src/features/audio/audio-player.js` and the injectable speed store in `src/features/audio/audio-preferences.js`.
- Added `tests/audio-player.test.js`; extended `tests/navigation.test.js`; updated `scripts/verify-production.js` to check built audio ranges.

### Public player interface and state

- `renderAudioPlayer({ audio, label })` produces the reusable player UI from a normalized `AudioAsset`; a missing asset renders “Audio unavailable for this unit.” without an audio element.
- `mountAudioPlayer(root, { preferences, onStatus })` binds the markup controls and keyboard listener, returning `{ controller, destroy }`.
- `createAudioController({ audio, preferences, onChange })` exposes `getState`, `play`, `pause`, `toggle`, `seek`, `seekBy`, `setSpeed`, `setRepeat`, `repeatFromBeginning`, `setVolume`, `toggleMute`, and `dispose`.
- State names: `loading`, `ready`, `playing`, `paused`, `ended`, `error`. Duration and current time come only from the native audio element metadata/events.
- Repeat count is a total number of plays (1, 2, 3, or 5). On `ended`, the controller restarts until the selected total is reached; it does not record learning listens.
- Speed writes directly to native `audio.playbackRate` without resetting `currentTime`. `createAudioPreferences` stores validated speed values in a versioned, scoped preference key and accepts an injected storage backend for future account-specific persistence.
- Space toggles play/pause; arrow keys seek by 5 seconds. Editable targets, range inputs, buttons, and links retain their normal keyboard behavior.
- Only the selected UnitPage includes an audio source. The server supports `Range` requests and returns `audio/mpeg`; no course-wide audio preload, paragraph audio, or timing data was added.

### Verification

- `npm test`: 17 tests passed, 0 failed. Coverage includes markup/control labels, play/pause, ready state, all speed values and no-restart behavior, 1×/2×/3×/5× repeat totals, repeat from beginning, seeking bounds, volume/mute, keyboard editing protections, missing/load/play errors, and real mapped A2/B1/B1+ Unit 1 MP3 files over HTTP range requests.
- `npm run validate:content`: passed for 34 units, with 45 repeated-vocabulary warnings.
- `npm run build` and `npm run verify:production`: passed; built routes, cover, stylesheet, audio modules, and partial audio delivery were checked.
- Responsive CSS includes tablet (900px), mobile (700px), and narrow mobile (380px) layouts with 42–46px control targets. Automated breakpoint/style assertions passed. Manual visual device/browser inspection could not be performed because the available browser automation runtime failed to initialize in this workspace.

### Limits and next phase

- The audio controller is tested with a deterministic mock audio element and the HTTP layer is tested with real MP3 files. Playback itself still depends on the learner’s browser and device.
- No completed-listen counting, passage unlocking, Follow Along, or progress recording was introduced.
- Next phase: **3-Listen Completion + Passage Unlock + Follow Along Architecture**. Keep learning completion events outside the reusable AudioPlayer and build them as a separate domain feature.
- Phase 4 implementation commit: `dd3bbb8` (`Add reusable unit audio player`).


## Phase 5 listening and passage foundation

- `src/features/audio/audio-player.js` remains the sole media controller. It emits a generic playback event hook; it does not own learning policy. `src/features/listening/listen-completion.js` qualifies natural end events using near-complete continuous playback coverage (99.5%), preventing direct/forward seeks from counting. Rewind intervals merge with prior coverage; each repeat loop yields one eligible event.
- `src/features/listening/listening-progress.js` provides a versioned injectable storage boundary (`get`, `recordCompletedListen`, `set`, `clear`). State is per canonical unit ID and stores count plus monotonic unlock; UI has no direct localStorage writes.
- Unit HTML contains only lock/progress UI. Passage JSON is fetched from `/api/units/:id/passage` after the persisted state is unlocked. The API returns normalized passage paragraphs and an optional timing map. This is a presentation gate for the requested learning flow, not an authorization boundary.
- `src/domain/audio-timing.js` validates paragraph/sentence/phrase/word hierarchies, their bounds, order, and paragraph membership. `src/features/reading/passage-reader.js` consumes optional real timing and uses the native audio time; without timing, it offers reading alongside the ordinary unit player and clearly reports that sync is unavailable.
- Local timing investigation: Whisper `small` on A2 Unit 1 returned a transcript matching the source text and word timestamps. Word time estimates were not independently reviewed for alignment precision, so no timing map was promoted into course content; Follow Along remains unavailable for all current units. Do not treat the experiment as proof of precise alignment.
- `npm test` (21 tests), `npm run validate:content` (34 units; 45 existing repeated-vocabulary warnings), `npm run build`, and `npm run verify:production` passed. Browser automation could not be completed in this environment; no visual/manual browser check is claimed.
- Feature boundaries: audio emits playback events; listening qualifies and persists completion; the catalog page hosts progress/lock composition; the reader handles passage display and optional synchronization. Later vocabulary, Word Tracking, speaking, and grammar features can consume unit content independently.
## Phase 6 vocabulary and browser speech

- Branch: `feature/vocabulary-tts`. The normalized Unit’s `vocabulary` list is rendered in `src/components/vocabulary/vocabulary-section.js`, composed into `src/features/catalog/pages.js`. Counts are derived from data; source word, part of speech, meaning, and example are escaped and displayed without rewriting. Same component handles A2, B1, and B1+.
- `VocabularyCard` is a semantic `<article>` keyed by normalized item ID, renders all source fields and independent Word/Meaning/Example/Play All controls. `mountVocabularySection(root,{speechService,progress})` accepts an optional future progress provider; without it, only All shows records and other filters give a neutral Word Tracking-unavailable empty state. No mastery/progress records are invented.
- `src/features/speech/speech-service.js` provides a shared coordinator (`speak`, `playAll`, `cancel`, `setRate`, `setVoice`, `getEnglishVoices`, `subscribe`). It uses browser speech synthesis, forces `en-US`, prefers available English voices, falls back to browser voice selection, constrains TTS rates to 0.8×/1×/1.2×, and cancels any active utterance before a new request. Play All awaits end of each utterance before starting the next.
- Speech state is broadcast globally (`speaking-word`, `speaking-meaning`, `speaking-example`, `playing-all`, `cancelled`, `error`, `idle`) and reflected on the active card; speech service is separate from recorded course audio and its speed preferences. Unsupported speech disables speech buttons and leaves source vocabulary readable.
- Browser automation was attempted but the computer-use runtime exited unexpectedly before surface initialization. No visual, audible, or device-level browser verification is claimed.
- Checks: `npm test` (28 tests), `npm run validate:content` (34 units, 45 existing repeated-vocabulary warnings), `npm run build`, and `npm run verify:production` all passed. Production smoke checks confirm A2/B1/B1+ unit pages render normalized vocabulary and TTS modules are served.
- Next phase: Word Tracking + Speaking Prompts + Optional Recording. Word Tracking should supply a real `progress.get(vocabularyItemId)` status interface; do not infer mastery from speech playback.
## Phase 7 Word Tracking and Speaking

- Branch: `feature/word-tracking-speaking`. Extended `src/features/listening/listening-progress.js` in place; all per-unit progress uses the existing `speakforge.listening.v1.<scope>` storage object and preserves listen count/unlock. There is no second persistence system.
- `getVocabularyState(unitId,wordId)`, `recordVocabularyUse(unitId,wordId)`, and `getWordTrackingSummary(unitId,items)` model 0–5 uses; uses are capped at five and `learned`/`mastered` derives only from reaching five. Store subscription refreshes marks, summary, and All/Not Started/In Progress/Mastered filters immediately. Prompt completion uses `getSpeakingState`, `setSpeakingCompleted`, and `getSpeakingSummary` in the same store.
- VocabularyCard extension adds five visual marks, an accessible Add use action, mastered state, and dynamic Word Tracking X/Y. Manual marks are independent from speech, recording, and prompt completion; no automatic or AI word detection exists.
- `src/components/speaking-section.js` renders normalized prompt IDs/text with dynamic count and optional target words only if content supplies them. `src/features/speaking/speaking-section.js` owns completion/recording UI; `recording-session.js` provides injectable browser MediaRecorder/getUserMedia and object-URL lifecycle. Nothing uploads. Recordings last only for the current page session.
- Permission denial, missing MediaRecorder, and missing microphone APIs keep manual completion usable and show a clear message. Recording playback uses a native audio element; delete/restart revokes the object URL.
- Browser automation was attempted; the computer-use runtime exited unexpectedly before initializing a browser. No real microphone/browser UI check is claimed.
- Phase 7 tests cover capped uses, persisted marks, data-driven counters, immediate subscription updates, A2/B1/B1+ prompt source, completion persistence, recording start/stop/playable Blob URL/delete, permission denial, and unsupported API fallback. Run `npm test`, `npm run validate:content`, `npm run build`, and `npm run verify:production` before handoff.
- Next phase: Grammar + Reviews + Full Progress Integration. AI may later propose a genuine-use event, but the learner must confirm it through `recordVocabularyUse`; recording or prompt completion must never increment word uses automatically.