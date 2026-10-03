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
  const incoming = new URL(request.url ?? "/", "http://vercel.internal");
  const routedPath = incoming.searchParams.get("path");
  if (routedPath === null) return;

  incoming.searchParams.delete("path");
  const query = incoming.searchParams.toString();
  request.url = routedPath + (query ? `?${query}` : "");
}

export function handler(request, response) {
  // Vercel rewrites every public request to /api and carries the original
  // pathname in the "path" query parameter. Restore it before forwarding
  // to the existing application server.
  restoreOriginalPath(request);
  appServer.emit("request", request, response);
}

export default handler;
