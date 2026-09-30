# SpeakForge Agent Handoff

**Last updated:** 2026-09-30  
**Project owner/creator:** Ahmed Ramadan  
**Current phase:** Phase 3 levels, books, and unit navigation complete; the learning player, full audio player, and AI remain out of scope.

## Project overview

SpeakForge is intended to be a scalable, data-driven English-learning platform organized as Level → Book → Content Item (unit, review, and future item types). The repository is the source of truth. Future agents must read this file before work and update it after each major task.

## Current status

- Git initialized on `master`; initial commit `866ea68` records the source resources and foundation. `.gitignore`, npm scripts, Node.js ESM source, tests, and route descriptors are present.
- Architecture recommendation and audit findings are in [architecture.md](architecture.md).
- Responsive navigation/catalog UI and a metadata-only UnitPage placeholder now use the Phase 2 content loader. There is still no learning player, full audio player, AI practice, or progress persistence abstraction.
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

