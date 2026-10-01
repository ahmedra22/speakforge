import { createServer } from "node:http";
import { createReadStream, readFileSync, promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderPath } from "./render.js";
import { contentLoader } from "../content/repository/content-loader.js";
import { buildLearningSequence, createReview } from "../domain/progression.js";
import { createAiProvider, AiConfigurationError, AiProviderError } from "../infrastructure/ai/provider.js";
import { createAiPracticeSessionService } from "../domain/ai-practice/session.js";

const root = process.env.SPEAKFORGE_ROOT
  ? path.resolve(process.env.SPEAKFORGE_ROOT)
  : fileURLToPath(new URL("../../", import.meta.url));
const publicDir = path.join(root, "public");
const coverDir = path.join(root, "resources", "covers");
const audioDir = path.join(root, "resources", "audio");
const source = (...parts) => path.join(root, "src", ...parts);
const publicModules = new Map([
  ["/audio-player.js", source("features", "audio", "audio-player.js")],
  ["/audio-preferences.js", source("features", "audio", "audio-preferences.js")],
  ["/listening-progress.js", source("features", "listening", "listening-progress.js")],
  ["/listen-completion.js", source("features", "listening", "listen-completion.js")],
  ["/passage-reader.js", source("features", "reading", "passage-reader.js")],
  ["/speech-service.js", source("features", "speech", "speech-service.js")],
  ["/vocabulary-section.js", source("features", "vocabulary", "vocabulary-section.js")],
  ["/speaking-section.js", source("features", "speaking", "speaking-section.js")],
  ["/recording-session.js", source("features", "speaking", "recording-session.js")],
  ["/grammar-section.js", source("features", "grammar", "grammar-section.js")],
  ["/review-experience.js", source("features", "reviews", "review-experience.js")],
  ["/progression.js", source("domain", "progression.js")],
  ["/domain/audio-timing.js", source("domain", "audio-timing.js")],
  ["/ai-practice-panel.js", source("features", "ai-practice", "ai-practice-panel.js")],
]);

function loadLocalEnvironment() {
  try {
    const file = readFileSync(path.resolve(process.cwd(), ".env"), "utf8");
    for (const line of file.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      let value = match[2];
      if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      process.env[match[1]] = value;
    }
  } catch {}
}
function sendJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(payload));
}
function createAiRateLimiter() {
  const buckets = new Map();
  return (key, action) => {
    const now = Date.now(), limits = { sessions: 10, messages: 30, complete: 20 }, bucketKey = `${key}:${action}`;
    let bucket = buckets.get(bucketKey);
    if (!bucket || now - bucket.startedAt >= 60000) bucket = { startedAt: now, count: 0 };
    if (bucket.count >= limits[action]) return false;
    bucket.count++; buckets.set(bucketKey, bucket);
    if (buckets.size > 500) for (const [entry, value] of buckets) if (now - value.startedAt >= 60000) buckets.delete(entry);
    return true;
  };
}
async function readJsonBody(request, limit = 12000) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > limit) throw Object.assign(new Error("Request body is too large."), { status: 413 });
  }
  try { return JSON.parse(body || "{}"); }
  catch { throw Object.assign(new Error("Request body must be valid JSON."), { status: 400 }); }
}
async function sendFile(response, file, type) {
  try {
    const data = await fs.readFile(file);
    response.writeHead(200, { "content-type": type, "content-length": data.length, "cache-control": "public, max-age=3600" });
    response.end(data);
  } catch { response.writeHead(404); response.end("Not found"); }
}
async function sendAudio(request, response, file) {
  let info;
  try { info = await fs.stat(file); } catch { response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); response.end("Audio not found"); return; }
  const range = request.headers.range;
  let start = 0, end = info.size - 1, status = 200;
  if (range) {
    const match = range.match(/^bytes=(\d*)-(\d*)$/);
    if (!match) { response.writeHead(416, { "content-range": `bytes */${info.size}` }); response.end(); return; }
    if (match[1] === "") start = Math.max(info.size - Number(match[2]), 0);
    else { start = Number(match[1]); if (match[2]) end = Number(match[2]); }
    if (start > end || start >= info.size) { response.writeHead(416, { "content-range": `bytes */${info.size}` }); response.end(); return; }
    end = Math.min(end, info.size - 1); status = 206;
  }
  response.writeHead(status, { "content-type": "audio/mpeg", "accept-ranges": "bytes", "content-length": end - start + 1, ...(status === 206 ? { "content-range": `bytes ${start}-${end}/${info.size}` } : {}) });
  if (request.method === "HEAD") { response.end(); return; }
  createReadStream(file, { start, end }).pipe(response);
}
function progressionPayload(book, units) {
  const sequence = buildLearningSequence(book.id, units, { reviewFrequency: book.reviewFrequency ?? 3 });
  return {
    book: { id: book.id, levelId: book.levelId, title: book.title, reviewFrequency: book.reviewFrequency ?? 3, aiPracticeRequired: book.aiPracticeRequired === true },
    units: units.map(unit => ({ id: unit.id, number: unit.number, title: unit.title, vocabulary: unit.vocabulary.map(({ id }) => ({ id })), speakingPrompts: unit.speakingPrompts.map(({ id }) => ({ id })), grammar: unit.grammar ? { practiceTask: unit.grammar.practiceTask || null } : null })),
    sequence: sequence.map(item => item.kind === "unit" ? { kind: "unit", id: item.id, title: item.unit.title, number: item.unit.number } : { kind: "review", id: item.id, title: item.title, startUnit: item.startUnit, endUnit: item.endUnit, sourceUnits: item.sourceUnits }),
  };
}

export function createAppServer({ aiPracticeService } = {}) {
  loadLocalEnvironment();
  aiPracticeService ??= createAiPracticeSessionService({ contentLoader, provider: createAiProvider() });
  const allowAiRequest = createAiRateLimiter();
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      const isAiRoute = url.pathname.startsWith("/api/ai-practice/");
      if (request.method === "POST" && isAiRoute) {
        if (!request.headers["content-type"]?.toLowerCase().includes("application/json")) return sendJson(response, 415, { error: "json_required", message: "AI Practice requests must use JSON." });
        const action = url.pathname.endsWith("/sessions") ? "sessions" : url.pathname.endsWith("/complete") ? "complete" : "messages";
        if (!allowAiRequest(request.socket.remoteAddress ?? "unknown", action)) return sendJson(response, 429, { error: "rate_limited", message: "Too many AI Practice requests. Please wait a minute and try again." });
        const aborter = new AbortController();
        request.on("aborted", () => aborter.abort());
        response.on("close", () => { if (!response.writableEnded) aborter.abort(); });
        const body = await readJsonBody(request);
        let result;
        if (url.pathname === "/api/ai-practice/sessions") result = await aiPracticeService.start(body.unitId, { signal: aborter.signal });
        else if (url.pathname === "/api/ai-practice/messages") result = await aiPracticeService.send(body.sessionId, body.message, { signal: aborter.signal });
        else if (url.pathname === "/api/ai-practice/complete") result = aiPracticeService.complete(body.sessionId);
        else return sendJson(response, 404, { error: "not_found", message: "AI Practice endpoint not found." });
        const statusCode = Number.isInteger(result.status) ? result.status : (url.pathname.endsWith("/sessions") ? 201 : 200);
        return sendJson(response, statusCode, result);
      }
      if (request.method === "GET" && url.pathname.startsWith("/api/ai-practice/sessions/")) {
        const id = decodeURIComponent(url.pathname.slice("/api/ai-practice/sessions/".length));
        const session = aiPracticeService.get(id);
        return session ? sendJson(response, 200, session) : sendJson(response, 404, { error: "session_not_found", message: "This practice session expired. Start a new session." });
      }
      if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405, { allow: isAiRoute ? "GET, POST" : "GET, HEAD" }); response.end(); return; }
      if (url.pathname === "/styles.css") return sendFile(response, path.join(publicDir, "styles.css"), "text/css; charset=utf-8");
      if (url.pathname === "/app.js") return sendFile(response, path.join(publicDir, "app.js"), "text/javascript; charset=utf-8");
      if (publicModules.has(url.pathname)) return sendFile(response, publicModules.get(url.pathname), "text/javascript; charset=utf-8");
      if (url.pathname.startsWith("/api/units/") && url.pathname.endsWith("/passage")) {
        const id = decodeURIComponent(url.pathname.slice("/api/units/".length, -"/passage".length)), unit = await contentLoader.getUnit(id);
        return unit ? sendJson(response, 200, { id: unit.id, number: unit.number, title: unit.title, passage: unit.passage, audioTiming: unit.audioTiming ?? null }) : sendJson(response, 404, { error: "unit_not_found" });
      }
      if (url.pathname.startsWith("/api/books/") && url.pathname.endsWith("/learning-sequence")) {
        const bookId = decodeURIComponent(url.pathname.slice("/api/books/".length, -"/learning-sequence".length)), book = await contentLoader.getBook(bookId);
        if (!book || book.status !== "available") return sendJson(response, 404, { error: "book_not_found" });
        return sendJson(response, 200, progressionPayload(book, await contentLoader.listUnits(bookId)));
      }
      if (url.pathname.startsWith("/api/levels/") && url.pathname.endsWith("/progress-context")) {
        const levelId = decodeURIComponent(url.pathname.slice("/api/levels/".length, -"/progress-context".length)), level = await contentLoader.getLevel(levelId);
        if (!level || level.status !== "available") return sendJson(response, 404, { error: "level_not_found" });
        const books = (await contentLoader.listBooks({ levelId })).filter(book => book.status === "available"), results = [];
        for (const book of books) results.push(progressionPayload(book, await contentLoader.listUnits(book.id)));
        return sendJson(response, 200, { books: results });
      }
      const reviewApi = url.pathname.match(/^\/api\/reviews\/([^/]+)\/(\d+)\/(\d+)$/);
      if (reviewApi) {
        const book = await contentLoader.getBook(decodeURIComponent(reviewApi[1]));
        if (!book || book.status !== "available") return sendJson(response, 404, { error: "book_not_found" });
        const units = await contentLoader.listUnits(book.id), first = Number(reviewApi[2]), last = Number(reviewApi[3]), sources = units.filter(unit => unit.number >= first && unit.number <= last);
        if (sources.length !== last - first + 1 || sources.length !== (book.reviewFrequency ?? 3)) return sendJson(response, 404, { error: "review_not_found" });
        return sendJson(response, 200, createReview(book.id, sources));
      }
      if (url.pathname.startsWith("/assets/")) {
        const rel = decodeURIComponent(url.pathname.slice("/assets/".length)), file = path.resolve(coverDir, rel);
        if (!file.startsWith(coverDir + path.sep)) { response.writeHead(400); response.end("Bad path"); return; }
        return sendFile(response, file, "image/jpeg");
      }
      if (url.pathname.startsWith("/audio/")) {
        const rel = decodeURIComponent(url.pathname.slice("/audio/".length)), file = path.resolve(audioDir, rel);
        if (!file.startsWith(audioDir + path.sep)) { response.writeHead(400); response.end("Bad path"); return; }
        return sendAudio(request, response, file);
      }
      const html = await renderPath(decodeURIComponent(url.pathname));
      response.writeHead(html.includes("Page not found") ? 404 : 200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
      response.end(request.method === "HEAD" ? "" : html);
    } catch (error) {
      if (response.headersSent) { response.destroy(); return; }
      if (error instanceof AiProviderError) return sendJson(response, error.status, { error: "ai_provider_error", message: error.message });
      if (error instanceof AiConfigurationError) return sendJson(response, 503, { error: "ai_not_configured", message: error.message });
      if (error.status) return sendJson(response, error.status, { error: "invalid_request", message: error.message });
      console.error("SpeakForge request failed:", error?.message ?? "unknown error");
      return sendJson(response, 500, { error: "server_error", message: "SpeakForge could not complete that request." });
    }
  });
}
