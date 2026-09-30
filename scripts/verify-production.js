import assert from "node:assert/strict";
import { createAppServer } from "../dist/src/app/server.js";
import { contentLoader } from "../dist/src/content/repository/content-loader.js";
import { createAiPracticeSessionService } from "../dist/src/domain/ai-practice/session.js";
import { createAiProvider } from "../dist/src/infrastructure/ai/provider.js";

const aiPracticeService = createAiPracticeSessionService({ contentLoader, provider: createAiProvider({ env: {} }) });
const server = createAppServer({ aiPracticeService });
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const route of ["/", "/learn/a2", "/learn/b1-core", "/learn/b1plus-bridge", "/learn/b2-plus", "/learn/a2/unit-01", "/learn/b1-core/unit-01", "/learn/b1plus-bridge/unit-01", "/learn/a2/review-01-03"]) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, `${route} status`);
    assert.match(response.headers.get("content-type"), /text\/html/);
  }
  for (const route of ["/speech-service.js", "/vocabulary-section.js", "/speaking-section.js", "/recording-session.js", "/grammar-section.js", "/review-experience.js", "/progression.js", "/ai-practice-panel.js"]) assert.equal((await fetch(base + route)).status, 200);
  for (const route of ["/learn/a2/unit-01", "/learn/b1-core/unit-01", "/learn/b1plus-bridge/unit-01"]) {
    const html = await (await fetch(base + route)).text();
    assert.match(html, /Vocabulary/);
    assert.match(html, /15 vocabulary items/);
    assert.match(html, /Play all vocabulary audio/);
    assert.match(html, /Speaking/);
    assert.match(html, /Mark prompt 1 complete/);
    assert.match(html, /Grammar Focus/);
    assert.match(html, /Mark grammar practice complete/);
    assert.match(html, /Complete Unit/);
    assert.match(html, /Practice with AI/);
    assert.match(html, /data-ai-practice-dialog/);
  }
  const reviewHtml = await (await fetch(base + "/learn/a2/review-01-03")).text();
  assert.match(reviewHtml, /Review locked/);
  assert.match(reviewHtml, /data-review-host hidden/);
  assert.doesNotMatch(reviewHtml, /Vocabulary recap/);
  const sequence = await (await fetch(base + "/api/books/a2-foundation/learning-sequence")).json();
  assert.equal(sequence.sequence[3].kind, "review");
  assert.equal(sequence.sequence[3].startUnit, 1);
  const review = await (await fetch(base + "/api/reviews/a2-foundation/1/3")).json();
  assert.equal(review.sourceUnits.length, 3);
  assert.equal(review.passageExcerpts.length, 3);
  const levelContext = await (await fetch(base + "/api/levels/b1/progress-context")).json();
  assert.equal(levelContext.books[0].units.length, 12);
  const invalidAiSession = await fetch(base + "/api/ai-practice/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ unitId: "not-a-unit" }) });
  assert.equal(invalidAiSession.status, 404);
  const aiSessionResponse = await fetch(base + "/api/ai-practice/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ unitId: "b1-plus-bridge:unit:1", context: { passage: ["untrusted"] } }) });
  assert.equal(aiSessionResponse.status, 201);
  const aiSession = await aiSessionResponse.json();
  assert.equal(aiSession.status, "not_configured");
  assert.equal(aiSession.unitId, "b1-plus-bridge:unit:1");
  assert.equal(JSON.stringify(aiSession).includes("untrusted"), false);
  const aiMessageResponse = await fetch(base + "/api/ai-practice/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: aiSession.id, message: "hello" }) });
  assert.equal(aiMessageResponse.status, 503);
  const image = await fetch(base + "/assets/b1-plus/b1+.jfif");
  assert.equal(image.status, 200);
  const audio = await fetch(base + "/audio/a2/A2%20Unit%201.mp3", { headers: { Range: "bytes=0-3" } });
  assert.equal(audio.status, 206);
  assert.equal(audio.headers.get("content-type"), "audio/mpeg");
  const api = await fetch(base + "/api/units/a2-foundation%3Aunit%3A1/passage");
  assert.equal(api.status, 200);
  const passage = await api.json();
  assert.equal(passage.passage.paragraphs.length, 4);
  assert.equal(passage.audioTiming, null);
  const player = await fetch(base + "/listen-completion.js");
  assert.equal(player.status, 200);
  const css = await fetch(base + "/styles.css");
  assert.equal(css.status, 200);
  console.log("Production smoke check passed: Phase 8 progress/reviews, Phase 9 unit practice entry and session API, graceful unconfigured provider state, and existing content/audio routes.");
} finally {
  await new Promise(resolve => server.close(resolve));
}
