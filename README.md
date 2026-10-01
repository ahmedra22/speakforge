# SpeakForge

SpeakForge is a data-driven English learning app organized as **Level → Book → Unit**, with listening, reading, vocabulary, speaking, grammar, reviews, local progress, and optional AI practice.

## Run locally

Requires Node.js 20 or newer. The project has no third-party runtime dependencies.

```sh
npm start
```

Open [http://localhost:4173](http://localhost:4173). To choose a different port, set `PORT` before starting the server.

## Routes

- `/` — catalog home
- `/learn/a2`, `/learn/b1-core`, `/learn/b1plus-bridge` — available books and unit lists
- `/learn/:book/unit-01` — reusable unit experience; valid unit numbers depend on that book's content
- `/learn/:book/review-01-03` — source-derived review checkpoints when unlocked
- `/learn/b2`, `/learn/b2-plus`, `/learn/c1` — planned states where mapped catalog resources exist; these contain no units
- `/about` — project information

The supplied structured content contains Speak Forge A2 (10 units), Speak Forge B1 (12), and Speak Forge B1+ (12). Catalog display names do not rename the original PDFs. B2, B2+, and C1 do not have structured units here. No B1+ units 13–24, review source material, or passage timing maps are invented.

## Content and progress

Original learning materials in `resources/` are the source of truth. The content loader normalizes the supplied JSON and resolves explicit book, cover, and audio manifests. Passage text is fetched only after three qualifying listens; missing timing data keeps Follow Along synchronization unavailable. Unit, review, resume, and Word Tracking progress use versioned browser-local storage. Audio preferences use their own local preference store. Progress does not sync between devices.

## AI Practice configuration

AI is optional and requires a server-side OpenAI-compatible Chat Completions endpoint. Copy `.env.example` to `.env`, then set `AI_API_KEY` and `AI_MODEL` (and `AI_BASE_URL` if using another compatible endpoint). Never put provider credentials in browser code. Without configuration, the app reports that AI Practice is unavailable and the rest of the course remains usable. AI sessions are held in server memory and expire after three hours or a server restart.

## Checks

```sh
npm test
npm run validate:content
npm run build
npm run verify:production
```

The content validator currently reports repeated vocabulary as informational warnings. `npm run verify:production` builds the production directory and checks the served routes/assets and AI's unconfigured state.

## Known verification limits

The in-app computer-use runtime failed to initialize. A separate headless Edge production session visually checked phone (375px), tablet (768px), and desktop (1366px) layouts, plus 50 Home/level/book/unit/review page checks across widths from 320px to 1920px. Responsive emulation passed with no horizontal overflow, clipped unit titles, or resume-card overlap; mobile navigation and full-screen AI Practice were exercised. These checks do not represent physical Android/iOS devices or Safari/Firefox. Screen-reader/full keyboard walkthroughs, print preview, microphone recording, audible TTS, iOS safe-area hardware behavior, and Lighthouse scoring were not completed. No AI provider credentials were configured, so live model responses were not tested. See `docs/agent-handoff.md` for the latest exact QA results and limitations.

## How to Add a New Book

A book is registered through data and assets; the catalog, level/book pages, unit list, unit route, generic UnitPage, review sequence, and progress aggregation are shared.

1. **Add metadata** in src/content/manifests/catalog.js:
   - Add one books entry with a stable id, routeSlug, levelId, display title, status: 'available', cover, and optional reviewFrequency / aiPracticeRequired.
   - Add its ID to the owning level's bookIds. Multiple books can share a level.
   - For a new level, add one levels entry with id, label, order, status, bookIds, and cover. No page or route source change is needed.
   - Add one sourceSets entry with bookId, levelId, sourceFile, and audioPathTemplate. The template must include {number} (for example, resources/audio/new-book/Unit {number}.mp3).

2. **Add structured content** under resources/structured/<book-id>/. Use the supplied unit JSON fields: level, positive unit_number, unit_title, topic, non-empty passage paragraphs, vocabulary entries (word, part_of_speech, meaning_in_context, example), speaking_prompts, and grammar_focus (title, explanation, examples, practice_task). Reviews are assembled from units according to the book's reviewFrequency; no book-specific review page is needed.

3. **Add audio** at the paths produced by the source set's audioPathTemplate. The template is resolved for each unit number and the validator checks every mapped file. Optional paragraph_audio is an array of one existing audio path per passage paragraph. Optional inline audio_timing follows the versioned timing map validated by src/domain/audio-timing.js; these fields are retained in normalized unit data.

4. **Add the cover** under resources/covers/<book-id>/ and point both the book's cover.path and, when appropriate, its level's cover.path at the file. Use mediaType: 'image/jpeg' for JPEG/JFIF files or the correct media type for the asset.

5. **Normalize and validate.** Normalization runs through the shared parser and normalizeUnit when the app loads content; no generated per-book source code is required. Run:
   ```sh
   npm run validate:content
   npm test
   ```
   The validator follows the central registry and checks catalog relationships, unique IDs/slugs, required unit fields, unit numbers, cover/source/audio references, optional paragraph audio, and optional timing metadata.

6. **Run and build.** Use npm start and open http://localhost:4173 to review the catalog and book/unit routes. Run npm run build, then npm run verify:production before deployment. The build copies the registered resources and application into dist/; deploy that production output using the project's deployment environment.

Keep book and unit IDs stable after learners have saved progress: browser-local progress is keyed by those IDs. For parallel content work, give each contributor a unique book ID and separate structured/audio/cover directories; one integration owner should merge the shared catalog registration. Content contributors should not edit React/page components for an ordinary book addition.

**Current boundary:** unit and review items are implemented. Novel-length content is a future content-item type and is not registered or rendered as a product feature yet; it should use a shared content-item abstraction and route/rendering extension rather than a novel-specific book page. No novel content is included.

## Vercel deployment

Vercel detects the root server.ts entry and captures the Node HTTP server when it calls listen(). This entry imports and reuses createAppServer() from src/app/server.js; the existing HTTP router remains the single source of truth for rendered pages, APIs, browser modules, covers, and byte-range MP3s.

vercel.json selects the Other framework preset, keeps npm run build, explicitly clears any Output Directory override, and lists files that the server reads through runtime filesystem paths: src/**, public/**, resources/structured/**, resources/covers/**, and resources/audio/**. dist/ remains the output of the existing local build script, but is not configured as Vercel's static site root. PDFs, tests, and development files are not included by this runtime asset list.

The required source/public/structured/cover/audio files occupy 58,849,818 bytes (about 56.1 MiB) uncompressed. The largest individual MP3 is 1,512,529 bytes, and there are no third-party runtime dependencies. This data payload is below Vercel's standard 250 MB uncompressed Node Function bundle limit; the final Vercel-traced package size still needs confirmation in a real Vercel build. No Vercel CLI is installed in the inspected environment, so vercel dev was not available for this change.

server.ts sets SPEAKFORGE_ROOT from its own entry location before dynamically importing the app modules. src/app/server.js and the content loader honor that explicit root; without it, they retain their existing module-relative defaults. npm start continues using scripts/serve.js unchanged. package.json selects Node 24.x, which matches Vercel's current supported default and the local Node 24 runtime used for verification.

Vercel environment variables, including AI provider credentials, belong in project settings and remain server-side. With no credentials, the existing graceful AI-not-configured response remains. AI practice sessions are in memory, so separate server instances or cold starts can lose session continuity; durable/shared session storage is future deployment work. Browser progress remains local to each learner's browser.
