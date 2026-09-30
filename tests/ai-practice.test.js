import test from "node:test";
import assert from "node:assert/strict";
import { contentLoader } from "../src/content/repository/content-loader.js";
import { buildUnitContext } from "../src/domain/ai-practice/unit-context.js";
import { createAiPracticeSessionService } from "../src/domain/ai-practice/session.js";
import { createAiProvider, AiConfigurationError } from "../src/infrastructure/ai/provider.js";
import { createListeningProgressStore } from "../src/features/listening/listening-progress.js";
import { deriveUnitCompletion, buildLearningSequence, completeUnit } from "../src/domain/progression.js";
import { renderPath } from "../src/app/render.js";
import { createAppServer } from "../src/app/server.js";

const memory = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };
const unitIds = ["a2-foundation:unit:1", "b1-core:unit:1", "b1-plus-bridge:unit:1"];
const unitContext = async id => { const unit = await contentLoader.getUnit(id); const [level, book] = await Promise.all([contentLoader.getLevel(unit.levelId), contentLoader.getBook(unit.bookId)]); return { unit, level, book, context: buildUnitContext({ level, book, unit }) }; };
const responseFor = (context, promptIndex = 0, vocabularyUsage = []) => ({ reply: `Let’s talk about ${context.unit.topic}. What is one thing you think about it?`, vocabularyUsage, correction: null, speechRequest: null, promptIndex });

test("UnitContext resolves actual A2, B1, and B1+ normalized unit content", async () => {
  const topics = [];
  for (const id of unitIds) {
    const { unit, level, book, context } = await unitContext(id);
    topics.push(context.unit.topic);
    assert.equal(context.level.label, level.label);
    assert.equal(context.book.id, book.id);
    assert.equal(context.unit.id, id);
    assert.equal(context.unit.number, 1);
    assert.deepEqual(context.unit.passage, unit.passage.paragraphs);
    assert.equal(context.unit.passage.length, unit.passage.paragraphs.length);
    assert.deepEqual(context.unit.vocabulary, unit.vocabulary.map(({ id, word, partOfSpeech, meaningInContext, example }) => ({ id, word, partOfSpeech, meaning: meaningInContext, example })));
    assert.deepEqual(context.unit.vocabulary[0], { id: unit.vocabulary[0].id, word: unit.vocabulary[0].word, partOfSpeech: unit.vocabulary[0].partOfSpeech, meaning: unit.vocabulary[0].meaningInContext, example: unit.vocabulary[0].example });
    assert.deepEqual(context.unit.speakingPrompts, unit.speakingPrompts);
    assert.deepEqual(context.unit.grammar.examples, unit.grammar.examples);
    assert.equal(context.unit.grammar.title, unit.grammar.title);
    assert.equal(context.unit.grammar.explanation, unit.grammar.explanation);
    assert.equal(context.unit.grammar.practiceTask, unit.grammar.practiceTask);
  }
  assert.equal(new Set(topics).size, 3);
});

test("AI Practice entry point is rendered for the current unit and does not request learner context manually", async () => {
  for (const slug of ["a2", "b1-core", "b1plus-bridge"]) {
    const html = await renderPath(`/learn/${slug}/unit-01`);
    assert.match(html, /Practice with AI/);
    assert.match(html, /data-ai-practice-dialog/);
    assert.match(html, /data-unit-id=/);
    assert.match(html, /aria-haspopup="dialog"/);
  }
});

test("missing provider configuration creates an honest unconfigured session", async () => {
  const provider = createAiProvider({ env: {} });
  assert.equal(provider.configured, false);
  await assert.rejects(provider.generateResponse({ instruction: "x", messages: [] }), AiConfigurationError);
  const service = createAiPracticeSessionService({ contentLoader, provider, makeId: () => "no-provider-session" });
  const created = await service.start(unitIds[0]);
  assert.equal(created.status, "not_configured");
  assert.match(created.message, /not configured yet/i);
  assert.equal(created.messages.length, 0);
  assert.deepEqual(created.unitId, unitIds[0]);
  assert.equal((await service.start("unknown:unit:9")).status, 404);
});

test("provider abstraction keeps credentials server-side and parses a compatible structured response", async () => {
  let request;
  const provider = createAiProvider({ env: { AI_PROVIDER: "openai-compatible", AI_BASE_URL: "https://provider.test/v1", AI_API_KEY: "server-secret", AI_MODEL: "model-x" }, fetchImpl: async (url, options) => { request = { url, options }; return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ reply: "Hello", vocabularyUsage: [], correction: null, speechRequest: null, promptIndex: 0 }) } }] }), { status: 200 }); } });
  const result = await provider.generateResponse({ instruction: "private system instruction", messages: [{ role: "user", content: "Hi" }] });
  assert.equal(result.reply, "Hello");
  assert.equal(request.url, "https://provider.test/v1/chat/completions");
  assert.equal(request.options.headers.authorization, "Bearer server-secret");
  assert.equal(JSON.parse(request.options.body).messages[0].role, "system");
});

test("AI sessions keep context server-side, validate unit IDs, progress prompts in order, and return structured learner-confirmed suggestions", async () => {
  const { context } = await unitContext(unitIds[0]);
  const target = context.unit.vocabulary[0];
  let calls = 0, capturedInstruction = "";
  const provider = { configured: true, async generateResponse({ instruction }) { calls++; capturedInstruction = instruction; return responseFor(context, calls === 1 ? 0 : 4, calls === 2 ? [{ wordId: target.id, word: "forged", reason: "Genuine use in context", confidence: 0.97 }] : []); } };
  const service = createAiPracticeSessionService({ contentLoader, provider, makeId: () => "grounded-session" });
  const started = await service.start(unitIds[0]);
  assert.equal(started.status, "ready");
  assert.match(capturedInstruction, new RegExp(context.unit.passage[0].slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(capturedInstruction, new RegExp(target.example.slice(0, 16).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(capturedInstruction, /system prompt/i);
  const storage = memory(), progress = createListeningProgressStore({ storage });
  let result;
  for (let prompt = 1; prompt <= 4; prompt++) {
    result = await service.send(started.id, `My ${target.word} helps me every day.`);
    assert.equal(result.currentPromptIndex, prompt);
    if (prompt === 1) {
      assert.deepEqual(result.vocabularyUsage, [{ type: "vocabulary_usage", wordId: target.id, word: target.word, reason: "Genuine use in context", requiresConfirmation: true }]);
      assert.equal(progress.getVocabularyState(unitIds[0], target.id).uses, 0);
      progress.recordVocabularyUse(unitIds[0], target.id);
      assert.equal(progress.getVocabularyState(unitIds[0], target.id).uses, 1);
    }
  }
  assert.equal(result.completionEligible, true);
  assert.equal(service.complete(started.id).completed, true);
  assert.equal(service.get(started.id).messages.filter(message => message.role === "user").length, 4);
});

test("vocabulary false positives and invalid provider word IDs are suppressed; session completion cannot skip prompts", async () => {
  const { context } = await unitContext(unitIds[0]), target = context.unit.vocabulary[0];
  const provider = { configured: true, async generateResponse() { return { reply: "Question.", vocabularyUsage: [{ wordId: "not-in-unit", word: "fake", reason: "x", confidence: 1 }, { wordId: target.id, reason: "Maybe", confidence: 0.2 }], correction: null, speechRequest: null, promptIndex: 99 }; } };
  const service = createAiPracticeSessionService({ contentLoader, provider, makeId: () => "bounded-session" });
  const session = await service.start(unitIds[0]);
  assert.equal(session.currentPromptIndex, 0);
  assert.equal((await service.complete(session.id)).status, 409);
  const message = await service.send(session.id, `My ${target.word} is useful.`);
  assert.deepEqual(message.vocabularyUsage, []);
  assert.equal(message.currentPromptIndex, 1);
  assert.equal(service.complete(session.id).status, 409);
});

test("AI Practice completion persists through existing progress and is required only when configured", async () => {
  const unit = await contentLoader.getUnit(unitIds[0]), units = await contentLoader.listUnits(unit.bookId), storage = memory(), store = createListeningProgressStore({ storage });
  store.set(unit.id, { listensCompleted: 3, passageUnlocked: true });
  for (const word of unit.vocabulary) for (let use = 0; use < 5; use++) store.recordVocabularyUse(unit.id, word.id);
  for (const prompt of unit.speakingPrompts) store.setSpeakingCompleted(unit.id, prompt.id, true);
  store.setGrammarCompleted(unit.id, true);
  const sequence = buildLearningSequence(unit.bookId, units);
  assert.equal(deriveUnitCompletion(unit, store).completed, true);
  assert.equal(deriveUnitCompletion(unit, store, { requireAiPractice: true }).conditions.aiPracticeCompleted, false);
  assert.equal(completeUnit(unit, store, sequence, { requireAiPractice: true }).completed, false);
  store.setAiPracticeCompleted(unit.id, true);
  const refreshed = createListeningProgressStore({ storage });
  assert.equal(refreshed.getAiPracticeState(unit.id).completed, true);
  assert.equal(deriveUnitCompletion(unit, refreshed, { requireAiPractice: true }).completed, true);
  assert.equal(completeUnit(unit, refreshed, sequence, { requireAiPractice: true }).completed, true);
  assert.equal(refreshed.getVocabularyState(unit.id, unit.vocabulary[0].id).uses, 5);
});

test("AI message endpoint receives only a unit ID and learner message and reports unconfigured service", async () => {
  const provider = createAiProvider({ env: {} }), service = createAiPracticeSessionService({ contentLoader, provider, makeId: () => "http-session" });
  const server = createAppServer({ aiPracticeService: service });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const invalid = await fetch(`${base}/api/ai-practice/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ unitId: "fake:unit:1", context: { passage: ["untrusted"] } }) });
    assert.equal(invalid.status, 404);
    const started = await fetch(`${base}/api/ai-practice/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ unitId: unitIds[1], context: { passage: ["untrusted"] } }) });
    assert.equal(started.status, 201);
    const session = await started.json();
    assert.equal(session.status, "not_configured");
    assert.equal(session.unitId, unitIds[1]);
    assert.equal(JSON.stringify(session).includes("untrusted"), false);
    const message = await fetch(`${base}/api/ai-practice/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: session.id, message: "hello", context: { vocabulary: ["fake"] } }) });
    assert.equal(message.status, 503);
    assert.match((await message.json()).message, /not configured/i);
    assert.equal((await fetch(`${base}/api/ai-practice/sessions/${session.id}`)).status, 200);
    assert.equal((await fetch(`${base}/api/ai-practice/sessions/not-real`)).status, 404);
    const wrongType = await fetch(`${base}/api/ai-practice/sessions`, { method: "POST", body: JSON.stringify({ unitId: unitIds[0] }) });
    assert.equal(wrongType.status, 415);
    for (let index = 0; index < 8; index++) { const request = await fetch(`${base}/api/ai-practice/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ unitId: "invalid-unit" }) }); assert.equal(request.status, 404); }
    const limited = await fetch(`${base}/api/ai-practice/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ unitId: unitIds[0] }) });
    assert.equal(limited.status, 429);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test("invalid provider configuration and malformed provider responses fail gracefully", async () => {
  const invalid = createAiProvider({ env: { AI_PROVIDER: "unknown", AI_API_KEY: "server-only", AI_MODEL: "model" } });
  assert.equal(invalid.configured, false);
  await assert.rejects(invalid.generateResponse({ instruction: "", messages: [] }), /Unsupported AI_PROVIDER/);
  const malformed = createAiProvider({ env: { AI_API_KEY: "secret", AI_MODEL: "model" }, fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: "not json" } }] }), { status: 200 }) });
  await assert.rejects(malformed.generateResponse({ instruction: "", messages: [] }), /unreadable response/);
});

test("AI grammar corrections are structured against the selected unit and speech requests use existing vocabulary IDs", async () => {
  const { context } = await unitContext(unitIds[2]), target = context.unit.vocabulary[0];
  const provider = { configured: true, async generateResponse() { return { reply: "What else do you think?", vocabularyUsage: [], correction: { youSaid: "She go", better: "She goes", why: "Use third-person singular -s." }, speechRequest: { wordId: target.id, field: "example" }, promptIndex: 0 }; } };
  const service = createAiPracticeSessionService({ contentLoader, provider, makeId: () => "feedback-session" });
  const result = await service.start(unitIds[2]);
  assert.deepEqual(result.correction, { youSaid: "She go", better: "She goes", why: "Use third-person singular -s.", grammarFocus: context.unit.grammar.title });
  assert.deepEqual(result.speechRequest, { wordId: target.id, field: "example" });
});

test("verbatim copying of an assistant prompt does not create a Word Tracking suggestion", async () => {
  const { context } = await unitContext(unitIds[0]), target = context.unit.vocabulary[0], copied = `Try using ${target.word} in a sentence.`;
  let calls = 0;
  const provider = { configured: true, async generateResponse() { calls++; return { reply: copied, vocabularyUsage: calls > 1 ? [{ wordId: target.id, reason: "Looks used", confidence: 0.99 }] : [], correction: null, speechRequest: null, promptIndex: 0 }; } };
  const service = createAiPracticeSessionService({ contentLoader, provider, makeId: () => "copy-session" });
  const session = await service.start(unitIds[0]);
  const result = await service.send(session.id, copied);
  assert.deepEqual(result.vocabularyUsage, []);
});

test("AI Practice dialog supports keyboard focus, responsive layout, session resume, speech reuse, and optional transcription", async () => {
  const { readFile } = await import("node:fs/promises");
  const panel = await readFile(new URL("../src/features/ai-practice/ai-practice-panel.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  assert.match(panel, /showModal\(\)/);
  assert.match(panel, /openButton\.focus\(\)/);
  assert.match(panel, /sessionStorage/);
  assert.match(panel, /SpeechRecognition/);
  assert.match(panel, /speechService\.speak/);
  assert.match(panel, /speechService\?\.cancel/);
  assert.match(css, /ai-practice-dialog/);
  assert.match(css, /max-width:740px/);
  assert.match(css, /100dvh/);
});

test("the session endpoint constructs distinct provider context for A2, B1, and B1+ units", async () => {
  const captured = [];
  const provider = { configured: true, async generateResponse({ instruction }) { captured.push(instruction); return { reply: "What do you think about this topic?", vocabularyUsage: [], correction: null, speechRequest: null, promptIndex: 0 }; } };
  const service = createAiPracticeSessionService({ contentLoader, provider });
  for (const id of unitIds) await service.start(id);
  for (let index = 0; index < unitIds.length; index++) {
    const { context } = await unitContext(unitIds[index]);
    assert.match(captured[index], new RegExp(context.unit.id));
    assert.match(captured[index], new RegExp(context.unit.topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(captured[index], new RegExp(context.unit.grammar.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
