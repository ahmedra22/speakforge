import { fileURLToPath } from 'node:url';

// Resolve runtime files from this repository root before importing modules that
// derive resource paths from their own location.
process.env.SPEAKFORGE_ROOT = fileURLToPath(new URL('./', import.meta.url));

const { createAppServer } = await import('./src/app/server.js');
const server = createAppServer();

server.listen(Number(process.env.PORT ?? 3000));

