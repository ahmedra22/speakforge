declare const process: {
  cwd(): string;
  env: Record<string, string | undefined>;
};

// Vercel runs this function with the project bundle as its working directory.
// Set the root before importing modules that derive resource paths at startup.
process.env.SPEAKFORGE_ROOT = process.cwd();

const { createAppServer } = await import("../src/app/server.js");
const appServer = createAppServer();

export function handler(request, response) {
  // Forward the original Node request/response objects so methods, headers,
  // request bodies, streaming, byte ranges, and HEAD semantics stay intact.
  appServer.emit("request", request, response);
}

export default handler;
