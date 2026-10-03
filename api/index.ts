declare const process: {
  cwd(): string;
  env: Record<string, string | undefined>;
};

// Vercel runs this function with the project bundle as its working directory.
// Set the root before importing modules that derive resource paths at startup.
process.env.SPEAKFORGE_ROOT = process.cwd();

const { createAppServer } = await import("../src/app/server.js");
const appServer = createAppServer();

function restoreOriginalPath(request) {
  const incoming = request.url ?? "/";
  if (incoming === "/api") {
    request.url = "/";
    return;
  }
  if (incoming.startsWith("/api?")) {
    request.url = "/?" + incoming.slice("/api?".length);
    return;
  }
  if (incoming.startsWith("/api/")) {
    request.url = incoming.slice("/api".length);
  }
}

export function handler(request, response) {
  // Vercel rewrites all public routes through /api/index.ts. The rewrite
  // preserves the original path under /api, so restore it before forwarding
  // to the existing application server.
  restoreOriginalPath(request);
  appServer.emit("request", request, response);
}

export default handler;
