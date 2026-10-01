# SpeakForge Architecture

**Status:** implemented JavaScript ESM application; final product polish and QA are tracked in `docs/agent-handoff.md`.

## Product structure and routes

The app uses a server-rendered, data-driven hierarchy: **Level → Book → Unit or Review**. Shared route rendering is in `src/app/render.js` and `src/features/catalog/pages.js`; the HTTP server and JSON/content APIs are in `src/app/server.js`.

- `/` — available and planned catalog
- `/learn/:level-or-book` — level or book overview and unit sequence
- `/learn/:book/unit-:number` — normalized unit page
- `/learn/:book/review-:start-:end` — review assembled from source units
- `/about` — project information

The manifests map A2 Foundation (10 units), B1 Core (12), and B1+ Bridge (12). B2, B2+, and C1 are planned catalog states, not available courses. The app does not infer units from PDFs/covers and does not create B1+ units 13–24.

## Content pipeline and asset handling

Raw files under `resources/` remain unchanged and are the source of truth. `src/content/normalize/` parses and normalizes the supplied source format; `src/content/repository/content-loader.js` exposes levels, books, unit summaries, and full units; `src/content/manifests/catalog.js` maps course and asset availability. `npm run validate:content` checks normalized content and mapped audio/covers. Repeated vocabulary is informational and currently yields 45 warnings.

Unit lists use summaries. A selected unit loads its normalized detail. Passage text is not included in initial unit HTML: after three legitimate completed listens, the client requests `/api/units/:id/passage`. Timing is optional and absent for current material; no timestamps are fabricated.

## Learning features and progress

The reusable UnitPage composes the AudioPlayer, passage reader, vocabulary/TTS, Word Tracking, speaking prompts and optional local recording, grammar, bilingual Method, AI Practice, and completion state. Review material is assembled from its actual source units.

`src/domain/progression.js` derives sequence locks, completion, reviews, and book/level aggregates. The existing versioned `ListeningProgressStore` persists listening, passage unlock, vocabulary uses (maximum five), speaking and grammar completion, review and unit completion, AI Practice completion, and last-visited resume state in browser-local storage. Audio preferences use a separate scoped store. Progress and recordings do not sync to an account or another device.

A unit completes only when its configured activity requirements are met and the unit is available in sequence. AI Practice is an optional completion requirement; current books leave it optional. A review unlocks when all its source units are complete and gates the following item until completion.

## AI Practice boundary

The browser starts a practice session with a unit ID and sends learner messages with a session ID. The server resolves the unit through the content loader and builds the unit context; client-provided course text is not trusted. `src/domain/ai-practice/` owns context and session rules. `src/infrastructure/ai/provider.js` defines the provider adapter; the current adapter targets OpenAI-compatible Chat Completions. Configuration and API credentials are server-only. Structured word suggestions require learner confirmation before they update existing Word Tracking.

The adapter uses `AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, and `AI_TIMEOUT_MS`, documented in `.env.example`. Missing configuration leaves course features available and clearly reports that AI is not configured. Sessions are held in server memory with a three-hour expiry and are lost on server restart.

## UI, accessibility, and production

Shared HTML components live in `src/components/`; browser controllers live under `src/features/` and are mounted by `public/app.js`. `public/styles.css` contains responsive layouts, focus styling, reduced-motion handling, the dialog treatment, and unit print rules. The bilingual Method switches between English and Arabic, with Arabic marked RTL. Printing is limited to the selected unit content; locked passage text is absent until the listen gate unlocks it.

The same server-rendered pages and feature controllers serve all device sizes. Responsive rules in `public/styles.css` adapt catalog grids, audio controls, touch targets, and the AI Practice panel without a separate mobile app. Browser modules are served through an explicit route map in `src/app/server.js`; keep nested imports in that map, and use the production smoke check to traverse the static import graph from `/app.js`. The app uses Node.js built-ins and has no third-party runtime dependencies. `npm run build` copies the server, source, public assets, and resources to `dist/`; running `npm start` from that directory serves the production copy at `http://localhost:4173` by default. `npm run verify:production` exercises production routes and assets.

## Verification and limits

Run `npm test`, `npm run validate:content`, `npm run build`, and `npm run verify:production`. The final polish handoff records exact results. Browser visual QA and Lighthouse results must only be reported when those tools run successfully. No live AI provider response is claimed unless real server configuration is available and used.

## Vercel Function deployment

Vercel routes the application through the native Node Function at `api/index.ts`. The adapter establishes `SPEAKFORGE_ROOT` before dynamically importing `createAppServer()` and forwards the original `IncomingMessage` and `ServerResponse` into that server. Application routing and response behavior remain centralized in `src/app/server.js`, including audio byte ranges and HEAD requests. The existing root `server.ts` remains available, and local `npm start` is unchanged.

`vercel.json` matches the `api/index.ts` function, uses a single string glob `{resources/**,src/**,public/**}` for runtime files, and rewrites `/(.*)` to `/api`. These included paths cover structured content, audio, covers, source modules loaded by the server, and public assets. No framework conversion or separate application router is involved.

Verify the bundle with `npx vercel@latest build` and inspect `.vercel/output/functions/api/index.func/.vc-config.json` and verify its `filePathMap` includes structured content, audio, and covers. The regular local production checks remain `npm run build` and `npm run verify:production`. AI provider configuration stays server-side; missing credentials retain the existing `ai_not_configured` response. AI sessions remain process-local and learner progress remains browser-local.
