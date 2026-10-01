# SpeakForge Agent Handoff

**Last updated:** 2026-10-01
**Project owner/creator:** Ahmed Ramadan  
**Current phase:** Responsive Device Support is complete on `codex/responsive-device-support`; see the final handoff section for viewport results and browser/platform limits.

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

- Implementation commit: cd2e49 (Implement word tracking and speaking prompts).

- Branch: `feature/word-tracking-speaking`. Extended `src/features/listening/listening-progress.js` in place; all per-unit progress uses the existing `speakforge.listening.v1.<scope>` storage object and preserves listen count/unlock. There is no second persistence system.
- `getVocabularyState(unitId,wordId)`, `recordVocabularyUse(unitId,wordId)`, and `getWordTrackingSummary(unitId,items)` model 0–5 uses; uses are capped at five and `learned`/`mastered` derives only from reaching five. Store subscription refreshes marks, summary, and All/Not Started/In Progress/Mastered filters immediately. Prompt completion uses `getSpeakingState`, `setSpeakingCompleted`, and `getSpeakingSummary` in the same store.
- VocabularyCard extension adds five visual marks, an accessible Add use action, mastered state, and dynamic Word Tracking X/Y. Manual marks are independent from speech, recording, and prompt completion; no automatic or AI word detection exists.
- `src/components/speaking-section.js` renders normalized prompt IDs/text with dynamic count and optional target words only if content supplies them. `src/features/speaking/speaking-section.js` owns completion/recording UI; `recording-session.js` provides injectable browser MediaRecorder/getUserMedia and object-URL lifecycle. Nothing uploads. Recordings last only for the current page session.
- Permission denial, missing MediaRecorder, and missing microphone APIs keep manual completion usable and show a clear message. Recording playback uses a native audio element; delete/restart revokes the object URL.
- Browser automation was attempted; the computer-use runtime exited unexpectedly before initializing a browser. No real microphone/browser UI check is claimed.
- Phase 7 tests cover capped uses, persisted marks, data-driven counters, immediate subscription updates, A2/B1/B1+ prompt source, completion persistence, recording start/stop/playable Blob URL/delete, permission denial, and unsupported API fallback. Run `npm test`, `npm run validate:content`, `npm run build`, and `npm run verify:production` before handoff.
- Next phase: Grammar + Reviews + Full Progress Integration. AI may later propose a genuine-use event, but the learner must confirm it through `recordVocabularyUse`; recording or prompt completion must never increment word uses automatically.
## Phase 8 completion — Grammar, Reviews, and Full Progress Integration (2026-09-30)

### Status and Git

- Phase 8 is complete on `feature/grammar-reviews-progress`.
- Implementation commit: `e66308d` — `Implement grammar reviews and progress`.
- The final handoff documentation is recorded in a follow-up docs commit.
- Phase 9 AI Practice has not started. There are no AI provider calls, accounts, or cloud persistence in Phase 8.

### Files changed

- `public/app.js`: browser progress selectors, progression navigation/locks, last-visited resume, grammar and review clients.
- `scripts/verify-production.js`: smoke assertions for Phase 8 pages and APIs, alongside existing audio/content checks.
- `src/app/render.js`, `src/app/server.js`: review route and sequence, level progress-context, and review data APIs; serve progression modules.
- `src/components/grammar-section.js`, `src/components/review-page.js`: grammar and locked review page markup.
- `src/components/unit-list.js`, `src/features/catalog/pages.js`, `src/content/manifests/catalog.js`: progress-aware unit/review sequence and configurable review frequency.
- `src/domain/progression.js`: sequence construction, review assembly, completion gates, and book/level aggregation.
- `src/features/grammar/grammar-section.js`, `src/features/reviews/review-experience.js`: browser interactions for completion and review activities.
- `src/features/listening/listening-progress.js`: extended the existing versioned progress store; no parallel store was introduced.
- `tests/grammar-reviews-progress.test.js`: focused feature, persistence, aggregation, and cross-book tests.
- `docs/architecture.md`, `docs/agent-handoff.md`: Phase 8 model and delivery notes.

### Grammar, reviews, progression, and persistence

- Grammar renders the normalized unit title, explanation, examples, and practice task for A2, B1, and B1+. Grammar completion is explicit and persisted by canonical unit ID.
- A review checkpoint follows each configurable group of three units. Review materials are assembled from those source units’ vocabulary, grammar, first passage paragraphs, and speaking prompts. No review audio or source content is invented.
- A review remains locked until all its source units are complete. Completing a review is stored separately; subsequent sequence items remain gated until that review is complete.
- A unit is complete only after the passage is unlocked by three qualifying listens, every vocabulary item is mastered at five learner-confirmed uses, all speaking prompts are complete, and grammar practice is marked complete when present. Completion unlocks the next sequence item.
- Grammar, unit completion, review completion, prior listening/vocabulary/speaking progress, and last-visited level/book/item share the existing versioned local progress key. Book and level totals are derived from unit state; cross-book aggregation is covered by a test. Audio preferences remain in their separate preference key.

### Verification results

- Focused Phase 8 suite: **8 passed, 0 failed** (`node --test tests/grammar-reviews-progress.test.js`). Coverage includes normalized grammar across A2/B1/B1+, grammar persistence, review source assembly, lock/unlock and completion persistence, sequence gates, unit completion, book/level progress, resume/persistence, and A2/B1 cross-book isolation/aggregation.
- Full suite: **44 passed, 0 failed** (`npm test`). Existing regression tests cover AudioPlayer controls, qualified listen tracking and passage unlock, vocabulary, TTS, Word Tracking, speaking/recording, navigation, and content loading.
- Content validation: **passed**, 34 units across three available books; 45 repeated-vocabulary warnings remain informational.
- Production build: **passed** (`npm run build`).
- Production smoke test: **passed** (`npm run verify:production`); verifies grammar and unit completion UI, locked review route, sequence/review/level progress APIs, existing A2/B1/B1+ content, speech/recording modules, passage API, audio byte ranges, cover, and stylesheet.
- `git diff --check`: **passed** before commit. Git status was checked after commit and is clean.

### Browser verification and limits

- Browser verification was attempted. The computer-use runtime exited before browser initialization with `node_repl kernel exited unexpectedly`, reporting `windows sandbox failed: helper_unknown_error: setup refresh had errors`.
- A2 Unit 1, B1 Unit 1, and B1+ Unit 1 therefore have no visual/browser verification claim. Review unlock and resume behavior were validated through focused tests and production route/API checks, not a browser session.
- The six original product specification files remain placeholders. Current completion thresholds and review frequency are explicit implementation assumptions from the Phase 8 brief. Reviews have no authored audio or independent source dataset.

### Next phase

- Phase 9: AI Practice, only when separately requested. Do not begin it as part of Phase 8 verification.

## Phase 9 — AI Practice + Unit Context + Conversation (2026-09-30)

### Status and Git

- Implementation branch: `feature/ai-practice`.
- Implementation commit: `e7c3dec` — `Implement AI Practice foundation`.
- Phase 8 remains intact; its progress store was extended in place only with AI completion accessors.
- Phase 9 accounts, authentication, memberships, subscriptions, billing, admin tools, and cloud sync were not implemented.

### Architecture and changed files

- `src/domain/ai-practice/unit-context.js`: builds a structured context from the normalized server-resolved Level, Book, and Unit. It includes the complete passage, all vocabulary fields, speaking prompts, and grammar focus/examples/task. It also builds the private conversation instruction and identifies the current prompt.
- `src/domain/ai-practice/session.js`: owns server-memory sessions (UUID, unit ID, start time, structured messages, prompt progress, suggestions, completion state), a three-hour expiry, a 100-session cap, message bounds, ordered prompt progress, and response validation.
- `src/infrastructure/ai/provider.js`: provider interface (`generateResponse`) and the current OpenAI-compatible Chat Completions adapter. Credentials and provider requests stay on the server. Other adapters can implement the same interface.
- `src/app/server.js`: resolves unit IDs through the existing content loader and owns POST `/api/ai-practice/sessions`, POST `/api/ai-practice/messages`, POST `/api/ai-practice/complete`, and GET `/api/ai-practice/sessions/:id`. Browser context/transcripts are not accepted as authoritative course content. The API checks JSON requests, bounds payloads, limits requests per IP, cancels provider work on disconnect, and returns useful configuration/provider errors.
- `src/components/ai-practice-panel.js`, `src/features/ai-practice/ai-practice-panel.js`: unit entry point, accessible dialog, session resume, conversation, corrections, learner-confirmed vocabulary marks, voice controls, and completion action.
- `src/features/catalog/pages.js`, `public/app.js`, `public/styles.css`: compose the AI panel into the current UnitPage, connect the existing SpeechService and ListeningProgressStore, and provide a desktop drawer/mobile full-screen layout. `books[].aiPracticeRequired` controls the optional unit-completion gate and is false for current books.
- `src/features/listening/listening-progress.js`: preserves the existing Phase 8 store and adds only `getAiPracticeState` and `setAiPracticeCompleted` for the already-present `aiPractice` record.
- `src/domain/progression.js`: allows the existing completion calculation to accept `requireAiPractice`; it remains optional unless configured for a book.
- `.env.example`: documents `AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, and `AI_TIMEOUT_MS`; `.env` remains ignored by Git.
- `tests/ai-practice.test.js`: cross-level context, provider/session/API, safety, completion, and UI contract checks.
- `scripts/verify-production.js`: production checks for the AI panel assets, unit entry, validated session endpoint, and honest unconfigured state.

### Context, conversation, and learning behavior

- UnitContext is constructed only after `contentLoader.getUnit(unitId)` resolves the chosen unit and its level/book. It carries the normalized content rather than client-provided content.
- The model instruction limits course-content facts to that context, tells the provider to adapt to the selected level, follow speaking prompts one at a time, keep answers concise, support vocabulary-only quizzes, and offer occasional grammar-focused feedback. The server clamps prompt progress so a response cannot skip multiple prompts.
- The provider returns validated structured data: reply, candidate vocabulary usage, optional correction, optional read-aloud request, and prompt progress. Unknown vocabulary IDs, low-confidence suggestions, absent target words, and verbatim copied assistant prompts are suppressed.
- Suggestions never write progress automatically. “Add 1 Word Tracking mark” calls the existing learner action only after confirmation; the existing five-use cap and mastered-state behavior remain in force. “Not now” dismisses the suggestion for the current browser session.
- Grammar feedback is displayed as You said / Better / Why and associates with the current unit grammar. Read-word/meaning/example requests use the existing `SpeechService`. AI response speech has explicit Speak and Stop controls. Browser speech recognition is optional; the learner reviews the transcript before sending it.
- AI Practice completion requires explicit learner action after all four prompts have been progressed. It persists through the existing progress store. It affects unit completion only when `aiPracticeRequired` is true for that book; current books keep it optional.
- Session messages persist in server memory during the current process, and the browser keeps the session ID in `sessionStorage`. Sessions expire after three hours and are lost on server restart; this phase does not add durable or cross-device storage.

### Environment and provider setup

- Copy `.env.example` to `.env` for local development and fill server-only values, or inject them through the server environment. Process environment values take precedence over `.env`; the server reads `.env` from its working directory.
- The current adapter expects an OpenAI-compatible `/chat/completions` endpoint. `AI_API_KEY` and `AI_MODEL` are required. Invalid or absent configuration leaves the rest of SpeakForge usable and displays “AI Practice is not configured yet.” No scripted response is presented as AI output.
- No real provider credentials were configured in this workspace. Provider behavior is covered with injected test adapters; a live provider request and billing behavior were not verified.

### Verification

- Focused Phase 9 tests: **13 passed, 0 failed** (`node --test tests/ai-practice.test.js`). They cover actual A2/B1/B1+ context, all context fields, server-side resolution, provider contract, missing/invalid configuration, malformed output, session history, prompt progression, structured suggestions/corrections/read requests, copied-prompt filtering, learner confirmation, progress gating, rate limiting, and UI/responsive/accessibility contracts.
- Full suite: **57 passed, 0 failed** (`npm test`), including existing audio, listen unlock, vocabulary/TTS, Word Tracking, speaking/recording, Phase 8 progression, navigation, and content tests.
- `npm run validate:content`: passed for 34 units in three books; the 45 repeated-vocabulary warnings are informational and pre-existing.
- `npm run build`: passed.
- `npm run verify:production`: passed, including Phase 8 routes, Phase 9 unit entry/session API, unknown-unit rejection, untrusted browser context rejection, unconfigured-provider response, and existing content/audio routes.
- `git diff --check`: passed before commit.

### Browser verification and limitations

- Browser automation was attempted but its runtime exited before initializing: `node_repl kernel exited unexpectedly` with `windows sandbox failed: helper_unknown_error: setup refresh had errors`.
- A2 Unit 1, B1 Unit 1, and B1+ Unit 1 have no visual/mobile browser verification claim. The AI interaction and voice controls have not been tested in a live browser.
- No live AI provider was configured, so actual model output, provider-specific behavior, and external network latency remain unverified. Tests use controlled providers and the production smoke test deliberately uses the unconfigured-provider path.
- Current server-side rate limits are in-memory per IP: 10 session starts, 30 messages, and 20 completions per minute. They reset with the process and are not a substitute for account-level quotas; authentication and cloud features remain out of scope.
- The Phase 9 code is isolated behind the provider interface and existing content/progress/speech boundaries; no new runtime dependencies were added.

### Next phase

- Final Product Polish + Responsive QA + Accessibility + Performance + Production Readiness.

## Phase 10 — Final Product Polish + QA + Production Readiness (2026-09-30)

### Status and Git

- Final status: **READY WITH KNOWN LIMITATIONS**. Automated checks pass, but visual/browser QA, Lighthouse scoring, and live provider behavior could not be verified in this environment.
- Branch: `feature/final-polish`.
- Implementation commit: `97f26fa` — `Polish UI and production readiness`.
- The final QA record and documentation updates are committed separately after this implementation commit.
- No authentication, billing, subscriptions, admin, cloud sync, new course content, or fabricated timing data were added.

### Polish and files changed

- `src/components/method-section.js`: added the requested reusable six-step Method explanation in English and Arabic. The language buttons expose their pressed state; Arabic content has `lang="ar"` and `dir="rtl"`.
- `src/features/catalog/pages.js`, `public/app.js`: added the Print Unit action and Method language switching on shared unit pages.
- `public/styles.css`: added Method presentation and unit print rules; print hides global navigation, footer, playback controls, practice UI, and progress actions while retaining unit title, vocabulary, speaking prompts, grammar, and any passage already loaded after its existing unlock. Before unlock, only the lock message can print; passage text remains absent.
- `public/styles.css`: improved the focus ring and low-contrast small labels identified during a contrast spot check. The focus color measures 5.35:1 against paper and 4.14:1 against forest; muted text is 4.72:1 and the unit-number accent is 5.75:1 against paper. These are targeted color checks, not a complete WCAG audit.
- `tests/final-polish.test.js`: exercises Print Unit and Method rendering on A2 Unit 1 and 10, B1 Unit 1 and 12, and B1+ Unit 1 and 12; verifies Arabic RTL metadata and confirms initial unit HTML contains no locked passage text. It also checks print CSS rules.
- `README.md`: documents runtime setup, routes, actual content availability, progress, AI configuration, verification commands, and known limitations.
- `docs/architecture.md`: replaced the stale proposed architecture snapshot with the implemented application boundaries and current data/progress/provider model.
- No runtime dependencies were added. Source materials under `resources/` were not modified.

### Regression and content integrity

- Existing shared routes render reusable unit pages. Route tests cover A2, B1, B1+, planned future levels, unknown units, and HTTP assets. New cross-level checks include the first and last available units in all three books. Actual availability remains A2 = 10, B1 = 12, B1+ = 12.
- B2, B2+, and C1 remain planned states with no units. No B1+ 13–24 units were introduced.
- Passage text still arrives only from the passage endpoint after the existing three-listen unlock. No timing map was fabricated.
- Audio playback, speed, repeat, seeking, qualified listen tracking, vocabulary TTS/Play All cancellation, five-use Word Tracking, speaking/optional recording, grammar/reviews/progress, resume, and AI server-side context/provider behavior are included in the passing regression suite. Print rules hide the course-player UI only in print media; the underlying controls and progression logic are unchanged.
- Security review: `.env` is ignored and not tracked; `.env.example` has blank credential/model values. AI credentials and provider calls remain server-side. No live key was present in source or the example file.

### Verification results

- `npm test`: **59 passed, 0 failed**. This includes the existing audio, listen-unlock, content, vocabulary/TTS, speaking/recording, progression, review, persistence, navigation, and AI Practice checks, plus two final-polish checks.
- `npm run validate:content`: **passed**, 34 units across three books; 45 repeated-vocabulary warnings remain informational.
- `npm run build`: **passed**.
- `npm run verify:production`: **passed** for Phase 8 progress/review routes, Phase 9 unconfigured AI endpoint behavior, and current content/audio routes.
- `git diff --check`: **passed** before commit.
- Future-level, first-unit, last-unit, and reusable-page behavior is checked with route/render and content tests. A real desktop/tablet/mobile/wide-desktop visual walkthrough was not possible.

### Accessibility, browser, and service limitations

- Static semantic and feature tests verify the main landmark, navigation, labeled audio controls, dialog focus behavior, statuses, button names, RTL metadata, and selected keyboard interactions. Audio keyboard shortcuts are tested. A full screen-reader/keyboard walkthrough was not completed.
- Lighthouse is unavailable: no `lighthouse` executable or package was present. No Lighthouse score is claimed; the target of 90+ was not measured.
- Browser automation was attempted but the runtime exited before initializing: `node_repl kernel exited unexpectedly` with `windows sandbox failed: helper_unknown_error: setup refresh had errors`. Therefore mobile, tablet, desktop, wide desktop, actual print preview, and manual A2/B1/B1+ UI verification are **not completed**.
- No AI provider credentials are configured. Server-side configuration handling and controlled provider tests pass, but live model responses and provider-specific behavior were not verified.
- Server-side AI sessions and rate limits remain process-memory only; progress remains local to the browser. Follow Along is unavailable where source timing is absent.

### Run locally

- From the repository root, run `npm start` (Node.js 20+). Default URL: `http://localhost:4173`.
- Production files are built to `dist/` with `npm run build`; run `npm start` from `dist/` to serve that copy at the same default URL.

### Final state

- Phase 10 polish is committed on `feature/final-polish`.
- Automated tests, content validation, production build, and production smoke checks pass.
- The product is **READY WITH KNOWN LIMITATIONS**, not declared fully production ready, until browser/device/print and Lighthouse checks can run and live AI behavior is verified with a configured provider.
- This is the final planned implementation phase. No additional product phase was started.

### Browser annotation follow-up (2026-09-30)

- Follow-up implementation commit: `ae2b4b8` — `Apply catalog browser annotations`.
- Updated catalog display names to Speak Forge A2, B1, B1+, B2, and B2+. C1 retains its existing planned label. The mapped source PDF paths and original resource files are unchanged.
- Applied the annotated backgrounds at their owning level scopes: A2 `.unit-section` uses `#dedede`; B1 `.book-unit-group` uses `#ededed`; B1+ `.book-unit-group` uses `#e8e8e8`. The rules are not limited to the 887 px screenshot viewport.
- Added regression assertions for all three level-scoped colors, renamed available/planned book cards, and future-level availability.
- Final follow-up verification: `npm test` **61 passed, 0 failed**; `npm run validate:content` passed for 34 units with 45 informational warnings; `npm run build` passed; `npm run verify:production` passed; `git diff --check` passed.
- Browser runtime was retried after reset but exited before connecting to the open local page (`trusted Node process exited unexpectedly; kernel reset`). The code was verified through route rendering, CSS-scope regression tests, and the production smoke check; no visual browser result is claimed.
## Integration repair — complete end-to-end UnitPage (2026-09-30)

### Status and root causes

- Integration repair is complete on `feature/integration-repair`. The shared UnitPage now composes the existing course features in learning order; no parallel feature systems or course content were added.
- The browser application’s static import graph contained a missing runtime route. `public/app.js` imports `passage-reader.js`, which imports `../../domain/audio-timing.js`; from its browser URL that resolves to `/domain/audio-timing.js`. The production server did not map that URL. The browser rejected the module graph, so the app bootstrap stopped before mounting any client controllers. That made the audio player stay at “Loading audio…” and left progress, passage unlock, vocabulary, speaking, grammar, and AI controllers uninitialized.
- Audio paths also need each asset filename encoded as a URL segment: spaces and the plus sign in the B1+ filename must reach the mapped MP3 correctly.

### Files changed and integration

- `src/app/server.js`: map `/domain/audio-timing.js` to the existing timing domain module.
- `src/components/audio-player.js`: URL-encode each audio path segment while preserving directory separators.
- `src/features/catalog/pages.js`: make the existing UnitPage composition explicit and ordered as header/player, listen progress and passage lock, vocabulary/Word Tracking, speaking, grammar, Method, AI Practice, completion, and navigation. All feature data comes from the normalized unit.
- `tests/unit-page-integration.test.js`: verify complete normalized A2, B1, and B1+ content, audio URLs, locked passage absence, rendered vocabulary/Word Tracking/prompts/grammar/AI context, composition order, and client controller mounts.
- `scripts/verify-production.js`: expand production integration coverage across A2/B1/B1+ unit pages and MP3 GET/HEAD/range responses; recursively check every static browser module imported by `/app.js`, including the audio-timing dependency; retain review/progress and graceful unconfigured AI checks.
- `README.md`, `docs/architecture.md`, and this handoff: update runtime and verification documentation.

The existing `public/app.js` controllers continue to connect `AudioPlayer`, the three-listen tracker, progress storage, passage reader, vocabulary/TTS and Word Tracking, speaking/recording, grammar, reviews/progression, and AI Practice. No duplicate controller or storage system was introduced.

### Verification results

- `npm test`: **63 passed, 0 failed**.
- `npm run validate:content`: **passed**, 34 units across three books; 45 repeated-vocabulary warnings remain informational.
- `npm run build`: **passed**.
- `npm run verify:production`: **passed**. It checks the full browser import graph, page composition, normalized content, review/progress endpoints, graceful unconfigured AI, and real A2/B1/B1+ MP3 GET, HEAD, and byte-range delivery.
- Production HTTP checks: homepage and A2/B1/B1+ Unit 1 pages returned 200; the three MP3s returned `audio/mpeg`, content lengths, and byte ranges; `/domain/audio-timing.js` returned 200 without exposing a filesystem path.
- Headless Edge production-browser check: A2, B1, and B1+ Unit 1 loaded their real audio metadata and displayed durations of **0:40**, **1:02**, and **1:19**. All eight learning sections were visible with nonzero layout height; A2 showed 15 real vocabulary cards, four real speaking prompts, normalized grammar, the locked passage, and no passage text in the DOM before unlock. Play/pause, speed, repeat, and mute responded. AI Practice opened with the selected A2 unit context and the expected unconfigured-provider notice. No failed requests or console errors remained on the clean reload.
- Three complete A2 listens at the supported 1.5× playback rate were then played through the page controls in an isolated temporary browser profile. The tracker showed three listens, removed the lock, fetched the source passage, and rendered its six paragraphs. This verifies the end-to-end listen-to-passage integration.
- The in-app computer-use runtime itself still exits during initialization. Direct headless Edge/CDP was available and used for the browser checks above. Microphone permissions/recording, audible browser TTS/Play All, mobile/tablet layout, screen-reader walkthrough, print preview, and a configured live AI provider were not verified in this session; existing automated feature tests cover the supported controller behavior where applicable.
- The initial pre-fix local preview process could serve stale built output; the production output was rebuilt and the verified server was started from the fresh `dist/` directory. Restart the server after rebuilding so it serves the new module map.

### Git and remaining limitations

- Branch: `feature/integration-repair`.
- Implementation commit: `4dfba60` — `Integrate learning features and fix runtime assets`.
- Documentation commit: records the implementation commit hash and these QA results.
- Progress remains browser-local; AI sessions remain in server memory. Follow Along remains unavailable for units without source timing. These are existing product limits, not blockers in this repair.
- No new phase or feature work was started.
## Responsive Device Support — complete (2026-10-01)

### Findings and changes

- The same server-rendered routes, components, content, and browser controllers are used at all sizes; no device-specific site or codebase was created.
- The initial viewport scan found three layout defects: two-column audio options overflowed the viewport at 390px; long unit titles were ellipsized on small phones; and the resume title/button could overlap at narrow widths. An empty passage host also left a blank card before the passage unlocked.
- `public/styles.css` now stacks audio options through 430px, lets unit titles wrap below 650px, and switches the resume card to one column through 430px. The empty passage host stays hidden until the existing reader inserts unlocked content. The decorative home orbit is hidden on narrow phones to avoid clipping its labels.
- Touch sizing was improved for the mobile menu, level pills, book/level actions, breadcrumb and unit navigation links, and audio sliders. Existing audio, vocabulary, Word Tracking, speaking, grammar, review, progress, and AI controls remain present.
- AI Practice uses the full viewport on phones. At 768px and desktop it remains the existing right-side panel (620px in the checked widths), with the same conversation behavior and responsive page behind it.
- Added `tests/responsive-support.test.js` to protect the key breakpoint, title wrapping, resume card, empty passage, navigation, touch-target, and AI panel rules.

### Verification

- `npm test`: **64 passed, 0 failed**.
- `npm run validate:content`: **passed**, 34 units across three books; 45 repeated-vocabulary warnings remain informational.
- `npm run build`: **passed**.
- `npm run verify:production`: **passed**.
- Production viewport checks used headless Edge emulation at **320, 375, 390, 414, 768, 820, 1024, 1366, 1440, and 1920px**, across five pages: Home, B1 level, B1 book, A2 Unit 1, and the A2 Units 1–3 review. All **50 page/viewport checks** ended with no horizontal overflow, out-of-viewport UI, clipped unit title, or resume-card overlap.
- Visually inspected production screenshots at 375px phone, 768px tablet, and 1366px desktop. Checked the mobile home/level/unit/vocabulary/AI layouts and tablet book page. The mobile navigation opened and its Levels link navigated correctly. The AI panel measured 375×844px on the phone; audio seek was 44px high, and Word Tracking/TTS buttons were 46px high. Tablet and desktop AI side panels fit within the viewport.
- The production preview is running from the rebuilt `dist/` at `http://localhost:4173`.

### Platform limits and Git

- Browser checks used Windows Edge with emulated viewport sizes. They are not tests on physical Android/iOS devices, Safari, or Firefox. The in-app computer-use runtime still fails during setup, so screenshots were inspected from the separate headless Edge production session.
- Microphone recording, audible TTS on physical speakers, device-specific keyboard/screen-reader behavior, and native safe-area behavior on iOS hardware were not tested here. Existing automated feature tests verify recording/TTS controller behavior and graceful unsupported-API fallbacks.
- Branch: `codex/responsive-device-support`.
- Implementation commit: `c1d1e1c` — `Improve responsive device layouts`.
- No new product phase or feature set was started.

## Content expansion readiness — 2026-10-01

### Result

The same generic catalog, level renderer, book renderer, unit list, unit route, UnitPage, review sequencing, and progress model support additional books through registry/content/media data. A book can be attached to an existing level or a new level; the level/book relationship supports multiple books per level. No A2/B1/B1+ or book-number-specific page components were found. Existing A2/B1/B1+ names in smoke tests and unit tests identify known product fixtures; runtime page selection is driven by the catalog and route slugs.

### Architecture changes

- src/content/manifests/catalog.js: audio path templates now live on each source-set descriptor instead of being reconstructed from a level-specific prefix. Removed the separate expected-count map; unit totals derive from each source file.
- src/content/repository/content-loader.js: createContentLoader accepts an injected catalog and root for isolated content validation and fixture work; production defaults still use the central catalog. Book and unit discovery remains registry-driven.
- src/content/normalize/normalize-unit.js: optional paragraph-audio references and inline timing metadata pass through the generic normalized unit model.
- src/content/validate/validate-content.js and scripts/validate-content.js: validation is reusable against any catalog/root and checks level/book/source-set relationships, unique IDs/slugs, required unit fields, unit metadata, mapped audio, book/level cover and PDF references, optional paragraph-audio paths, and optional timing maps. Available books require one source set; planned books do not.
- tests/content-expansion.test.js: creates minimal temporary files for an extra book at B1 and a book on a new C1 level, checks generic catalog/book/level/unit rendering and progress, checks optional media metadata, exercises validation failures, then removes all temporary fixture folders and registry entries.

### New book workflow

See README.md — How to Add a New Book for the operator sequence: register level/book/source-set metadata in src/content/manifests/catalog.js; add structured content under resources/structured/<book-id>/; place audio at the declared template paths and covers under resources/covers/<book-id>/; rely on shared parsing/normalization; run content validation and tests; run locally, build, and smoke-check production output.

Parallel content work should use unique IDs and per-book resource directories. Contributors can prepare content, audio mappings, and cover metadata without modifying unrelated UI. Since the registry is a shared file, an integration owner merges each descriptor/level registration to avoid competing registry edits. Keep identifiers stable after progress has been saved.

### Verification

- Temporary future-book/future-level fixture: pending final rerun.
- Full test suite: pending final rerun.
- Content validation: pending final rerun.
- Production build: pending final rerun.
- Production smoke test: pending final rerun.
- Regression coverage: existing tests cover audio, listen tracking and passage unlock, vocabulary/TTS, Word Tracking, speaking, navigation, and content loading; full results will be recorded after rerun.

### Scope limits

No real course content or novel content was added. Current concrete content item types are units and generated reviews. Novel-length material will need a generic content-item/route extension when specified; this task does not claim that a novel reader already exists. No existing learning feature was intentionally redesigned.
## Vercel Deployment Adapter — 2026-10-01

### Changes

- Branch: feature/vercel-deployment.
- Added root server.ts, the Node server entry Vercel detects. It sets SPEAKFORGE_ROOT from its entry location, dynamically imports the existing createAppServer(), and starts the captured HTTP server on the platform-provided port.
- Added vercel.json using the Other framework preset, npm run build, outputDirectory: null, and explicit includeFiles for src/**, public/**, resources/structured/**, resources/covers/**, and resources/audio/**. Vercel is not configured to serve dist/ as static output.
- src/app/server.js and src/content/repository/content-loader.js honor SPEAKFORGE_ROOT and retain module-relative fallbacks. scripts/serve.js and npm start remain unchanged.
- package.json selects Node 24.x; verification used local Node 24.14.1.
- Corrected scripts/validate-content.js to report available content sources and total catalog books accurately.

### Runtime files and size

Explicit runtime asset payload: 58,849,818 bytes (about 56.1 MiB) uncompressed: source 146,701 bytes, public 47,732, structured content 181,012, covers 19,368,775, and MP3s 39,105,598. The largest MP3 is 1,512,529 bytes. There are no third-party runtime dependencies. This selected payload is below the standard 250 MB uncompressed Node Function bundle limit. Vercel's final traced package size was not measured because the Vercel CLI is not installed. PDFs (5,465,798 bytes), tests, dist, and development-only paths are not explicitly included.

### Verification results

- npm test: passed, 65 tests, 0 failures.
- npm run validate:content: passed, 34 units in 3 available content sources (6 catalog books total); 45 repeated-vocabulary warnings remain informational.
- npm run build: passed; production files were written to dist/.
- npm run verify:production: passed. It verified complete A2/B1/B1+ unit pages, browser module routes, audio GET/HEAD/range delivery, reviews/progress, passage API, covers, and graceful unconfigured AI state.
- Vercel entry local HTTP check (node server.ts): passed from both the repository and a different working directory. Home, A2 Unit 1, and B1 level returned 200; B1+ audio returned 206 for a 1,024-byte range; learning-sequence API returned 13 sequence items; passage API returned 4 paragraphs; cover returned 200; MP3 range request returned 206 with bytes 0-1023/640128 and 1,024 bytes; AI Practice reported not_configured.
- Local npm start smoke: passed. Home and B1+ Unit 1 returned 200.
- vercel dev: not run; no Vercel executable was found on PATH.
- No Vercel deployment or deployed browser check was performed.

### Runtime behavior and limitations

- The Vercel-detected server entry and local scripts/serve.js both reuse createAppServer(). HTML, /api/ routes, /assets/ covers, /audio/ MP3s, browser modules, and byte ranges remain in the existing server.
- Runtime data files are explicitly included; Vercel project configuration does not name dist as an output directory. The build still produces dist for local production verification.
- AI credentials remain server-side Vercel environment variables. Without them the existing unconfigured response remains.
- AI sessions are held in a process-local Map and can be lost across cold starts or separate server instances. Browser progress remains browser-local.
- The actual Vercel-generated bundle size, Vercel CLI behavior, and deployed request handling still require confirmation in a Vercel build/deployment.

### Git

- Branch: feature/vercel-deployment.
- Implementation commit: pending initial commit.
- Handoff commit: pending.
- Clean working tree: pending final check.
