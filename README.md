# SpeakForge

A data-driven English learning platform built around levels, books, and short learning units.

## Run locally

Requires Node.js 20 or newer; there are no third-party runtime dependencies.

```sh
npm start
```

Open `http://localhost:4173`.

## Content and checks

- `npm run validate:content` validates the supplied source data and mapped assets.
- `npm test` runs normalization, route, and HTTP integration tests.
- `npm run build` creates a production-ready `dist/` directory.
- `npm run verify:production` smoke-tests the built pages and assets after building.

Raw learning materials are in `resources/` and remain the source of truth. The application normalizes them through the content loader. Available books are A2 Foundation, B1 Core, and B1+ Bridge. B2, B2+, and C1 are shown as planned where mapped resources exist; no course units are implied for them.
