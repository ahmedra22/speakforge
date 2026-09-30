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

The in-app computer-use runtime failed to initialize. A separate headless Edge session against the production build verified A2, B1, and B1+ Unit 1 audio metadata and controls, visible learning sections, and the A2 three-listen passage unlock. Mobile/tablet layout, screen-reader and full keyboard walkthroughs, print preview, microphone recording, audible browser TTS, and Lighthouse scoring were not completed. No AI provider credentials were configured, so live model responses were not tested. See `docs/agent-handoff.md` for the latest exact QA results and limitations.
