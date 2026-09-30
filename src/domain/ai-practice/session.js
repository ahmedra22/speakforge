import { randomUUID } from "node:crypto";
import { buildUnitContext, createAiPracticeInstruction } from "./unit-context.js";
import { AiConfigurationError, AiProviderError } from "../../infrastructure/ai/provider.js";

const MAX_SESSIONS = 100;
const SESSION_TTL = 3 * 60 * 60 * 1000;
const MAX_MESSAGES = 80;
const MAX_MESSAGE_LENGTH = 4000;
const MIN_VOCAB_CONFIDENCE = 0.8;
const tokenPattern = value => new Set(String(value).toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);

function sanitizeProviderResult(raw, context, learnerMessage = "", lastAssistant = "") {
  if (!raw || typeof raw !== "object" || typeof raw.reply !== "string" || !raw.reply.trim()) throw new AiProviderError("AI Practice returned an unreadable response.");
  const vocab = new Map(context.unit.vocabulary.map(item => [item.id, item]));
  const learnerTokens = tokenPattern(learnerMessage);
  const normalizedLearner = learnerMessage.trim().toLocaleLowerCase();
  const normalizedPriorAssistant = String(lastAssistant).trim().toLocaleLowerCase();
  const vocabularyUsage = Array.isArray(raw.vocabularyUsage) ? raw.vocabularyUsage.flatMap(item => {
    const target = vocab.get(item?.wordId), confidence = Number(item?.confidence), reason = typeof item?.reason === "string" ? item.reason.slice(0, 300) : "";
    if (!target || !reason || !Number.isFinite(confidence) || confidence < MIN_VOCAB_CONFIDENCE) return [];
    const targetTokens = [...tokenPattern(target.word)];
    if (!targetTokens.length || !targetTokens.every(word => learnerTokens.has(word))) return [];
    if (normalizedPriorAssistant && normalizedPriorAssistant === normalizedLearner && learnerMessage.trim().length > 12) return [];
    return [{ type: "vocabulary_usage", wordId: target.id, word: target.word, reason, requiresConfirmation: true }];
  }).filter((item, index, all) => all.findIndex(other => other.wordId === item.wordId) === index) : [];
  const grammarCorrection = raw.correction && ["youSaid", "better", "why"].every(key => typeof raw.correction[key] === "string" && raw.correction[key].trim())
    ? { youSaid: raw.correction.youSaid.slice(0, 500), better: raw.correction.better.slice(0, 500), why: raw.correction.why.slice(0, 300), grammarFocus: context.unit.grammar?.title ?? null }
    : null;
  const speech = raw.speechRequest;
  const speechRequest = vocab.has(speech?.wordId) && ["word", "meaning", "example"].includes(speech?.field) ? { wordId: speech.wordId, field: speech.field } : null;
  const promptCount = context.unit.speakingPrompts.length;
  const promptIndex = Number.isInteger(raw.promptIndex) ? Math.min(promptCount, Math.max(0, raw.promptIndex)) : 0;
  return { reply: raw.reply.trim().slice(0, 3000), vocabularyUsage, correction: grammarCorrection, speechRequest, promptIndex };
}

export function createAiPracticeSessionService({ contentLoader, provider, now = () => Date.now(), makeId = randomUUID } = {}) {
  const sessions = new Map();
  const purge = () => { for (const [id, session] of sessions) if (now() - session.updatedAt > SESSION_TTL) sessions.delete(id); while (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value); };
  const serialize = session => ({ id: session.id, unitId: session.unitId, startedAt: session.startedAt, messages: session.messages, currentPromptIndex: session.currentPromptIndex, suggestions: session.suggestions, completionEligible: session.completionEligible, completed: session.completed, configured: Boolean(provider?.configured), status: provider?.configured ? "ready" : "not_configured" });
  const get = id => { const session = sessions.get(id); if (!session || now() - session.updatedAt > SESSION_TTL) { sessions.delete(id); return null; } return session; };
  async function generate(session, messages, learnerMessage, signal) {
    const instruction = createAiPracticeInstruction({ ...session.context, session: { currentPromptIndex: session.currentPromptIndex } });
    const raw = await provider.generateResponse({ instruction, messages, signal });
    const result = sanitizeProviderResult(raw, session.context, learnerMessage, session.messages.at(-1)?.content ?? "");
    session.currentPromptIndex = Math.max(session.currentPromptIndex, Math.min(session.currentPromptIndex + (learnerMessage ? 1 : 0), result.promptIndex));
    session.suggestions = result.vocabularyUsage;
    session.messages.push({ role: "assistant", content: result.reply, timestamp: new Date(now()).toISOString() });
    session.updatedAt = now();
    session.completionEligible = session.currentPromptIndex >= session.context.unit.speakingPrompts.length;
    return { ...serialize(session), response: result.reply, vocabularyUsage: result.vocabularyUsage, correction: result.correction, speechRequest: result.speechRequest };
  }
  return {
    configured: Boolean(provider?.configured),
    async start(unitId, { signal } = {}) {
      if (typeof unitId !== "string" || unitId.length > 160) return { error: "invalid_unit", message: "Choose a valid unit to start AI Practice.", status: 400 };
      const unit = await contentLoader.getUnit(unitId);
      if (!unit) return { error: "unknown_unit", message: "That learning unit could not be found.", status: 404 };
      const [level, book] = await Promise.all([contentLoader.getLevel(unit.levelId), contentLoader.getBook(unit.bookId)]);
      if (!level || !book || book.status !== "available") return { error: "unknown_unit", message: "That learning unit could not be found.", status: 404 };
      purge();
      const session = { id: makeId(), unitId, context: buildUnitContext({ level, book, unit }), startedAt: new Date(now()).toISOString(), updatedAt: now(), messages: [], currentPromptIndex: 0, suggestions: [], completionEligible: false, completed: false, busy: false };
      sessions.set(session.id, session);
      if (!provider?.configured) return { ...serialize(session), status: "not_configured", message: "AI Practice is not configured yet." };
      try {
        const kickoff = { role: "user", content: "Begin naturally with speaking prompt 1. Ask one concise question and do not mention that this is an instruction." };
        const generated = await generate(session, [kickoff], "", signal);
        return { ...generated, status: "ready" };
      } catch (error) { sessions.delete(session.id); throw error; }
    },
    async send(id, text, { signal } = {}) {
      const session = get(id);
      if (!session) return { error: "session_not_found", message: "This practice session expired. Start a new session.", status: 404 };
      if (session.busy) return { error: "request_in_progress", message: "A reply is already being prepared.", status: 409 };
      if (typeof text !== "string" || !text.trim() || text.length > MAX_MESSAGE_LENGTH) return { error: "invalid_message", message: "Enter a message up to 4,000 characters.", status: 400 };
      if (!provider?.configured) return { error: "not_configured", message: "AI Practice is not configured yet.", status: 503 };
      if (session.messages.filter(item => item.role === "user").length >= MAX_MESSAGES / 2) return { error: "session_limit", message: "This session reached its message limit. Start a new session to continue.", status: 429 };
      session.busy = true;
      const learner = { role: "user", content: text.trim(), timestamp: new Date(now()).toISOString() };
      try {
        const previous = session.messages.map(({ role, content }) => ({ role, content }));
        const generated = await generate(session, [...previous, learner], learner.content, signal);
        session.messages.splice(session.messages.length - 1, 0, learner);
        return generated;
      } finally { session.busy = false; }
    },
    get(id) { const session = get(id); return session ? serialize(session) : null; },
    complete(id) { const session = get(id); if (!session) return { error: "session_not_found", message: "This practice session expired.", status: 404 }; if (!session.completionEligible) return { error: "prompts_incomplete", message: "Continue the unit conversation before completing AI Practice.", status: 409 }; session.completed = true; session.updatedAt = now(); return serialize(session); },
  };
}
