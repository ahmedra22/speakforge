const REQUIRED_LISTENS = 3;
const WORD_TARGET = 5;
const validCount = value => Number.isInteger(value) && value >= 0;

export function createListeningProgressStore({ storage = globalThis.localStorage, scope = 'guest', requiredListens = REQUIRED_LISTENS, targetUses = WORD_TARGET } = {}) {
  const key = `speakforge.listening.v1.${scope}`;
  const listeners = new Set();
  const all = () => {
    try {
      const parsed = JSON.parse(storage?.getItem(key) ?? '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch { return {}; }
  };
  const persist = records => { try { storage?.setItem(key, JSON.stringify(records)); } catch {} };
  const notify = event => { for (const listener of listeners) { try { listener(event); } catch {} } };
  const defaults = () => ({ listensCompleted: 0, passageUnlocked: false });
  const get = unitId => {
    const saved = all()[unitId];
    const listensCompleted = validCount(saved?.listensCompleted) ? saved.listensCompleted : 0;
    return { unitId, listensCompleted, requiredListens, passageUnlocked: Boolean(saved?.passageUnlocked) || listensCompleted >= requiredListens, completed: Boolean(saved?.completed) };
  };
  const write = (unitId, patch, event) => {
    const records = all();
    records[unitId] = { ...(records[unitId] ?? {}), ...patch };
    persist(records);
    notify({ unitId, ...event });
    return records[unitId];
  };
  const put = (unitId, state) => { write(unitId, { listensCompleted: state.listensCompleted, passageUnlocked: state.passageUnlocked }, { type: 'listening' }); return get(unitId); };
  const wordState = (unitId, wordId) => {
    const saved = all()[unitId]?.vocabulary?.[wordId];
    const uses = Math.min(targetUses, validCount(saved?.uses) ? saved.uses : 0), learned = uses >= targetUses;
    return { unitId, wordId, uses, targetUses, learned, status: learned ? 'mastered' : uses ? 'in-progress' : 'not-started' };
  };
  const speakingState = (unitId, promptId) => ({ unitId, promptId, completed: Boolean(all()[unitId]?.speaking?.[promptId]?.completed) });
  const grammarState = unitId => ({ unitId, completed: Boolean(all()[unitId]?.grammar?.completed) });
  const aiPracticeState = unitId => ({ unitId, completed: Boolean(all()[unitId]?.aiPractice?.completed) });
  const reviewState = (reviewId, unlocked = false) => ({ reviewId, unlocked: Boolean(unlocked), completed: Boolean(all()[reviewId]?.review?.completed) });
  return {
    get,
    recordCompletedListen(unitId) { const previous = get(unitId); return put(unitId, { listensCompleted: previous.listensCompleted + 1, passageUnlocked: previous.passageUnlocked || previous.listensCompleted + 1 >= requiredListens }); },
    set(unitId, state) { const previous = get(unitId), count = validCount(state?.listensCompleted) ? state.listensCompleted : previous.listensCompleted; return put(unitId, { listensCompleted: count, passageUnlocked: previous.passageUnlocked || Boolean(state?.passageUnlocked) || count >= requiredListens }); },
    getVocabularyState: wordState,
    getUnitProgress(unitId) { const record = all()[unitId] ?? {}; return { ...get(unitId), vocabulary: record.vocabulary ?? {}, speaking: record.speaking ?? {}, grammar: record.grammar ?? { completed: false }, aiPractice: record.aiPractice ?? {} }; },
    setUnitCompleted(unitId, completed = true) { write(unitId, { completed: Boolean(completed) }, { type: 'unit-completion' }); return get(unitId); },
    getGrammarState: grammarState,
    setGrammarCompleted(unitId, completed = true) { write(unitId, { grammar: { completed: Boolean(completed) } }, { type: 'grammar' }); return grammarState(unitId); },
    getAiPracticeState: aiPracticeState,
    setAiPracticeCompleted(unitId, completed = true) { write(unitId, { aiPractice: { completed: Boolean(completed) } }, { type: 'ai-practice' }); return aiPracticeState(unitId); },
    getReviewState: reviewState,
    setReviewCompleted(reviewId, completed = true, unlocked = false) { if (completed && !unlocked) return reviewState(reviewId, false); write(reviewId, { review: { completed: Boolean(completed) } }, { type: 'review' }); return reviewState(reviewId, unlocked); },
    getLastVisited() { return all().__meta?.lastVisited ?? null; },
    setLastVisited(location) { const records = all(); records.__meta = { ...(records.__meta ?? {}), lastVisited: { levelId: location.levelId, bookId: location.bookId, itemId: location.itemId, itemType: location.itemType, href: location.href, title: location.title, visitedAt: location.visitedAt ?? Date.now() } }; persist(records); notify({ unitId: '__meta', type: 'resume' }); return records.__meta.lastVisited; },
    recordVocabularyUse(unitId, wordId) { const current = wordState(unitId, wordId); if (current.learned) return { ...current, changed: false }; const uses = Math.min(targetUses, current.uses + 1), learned = uses >= targetUses; write(unitId, { vocabulary: { ...(all()[unitId]?.vocabulary ?? {}), [wordId]: { uses, targetUses, learned } } }, { type: 'vocabulary', wordId }); return { ...wordState(unitId, wordId), changed: true }; },
    getWordTrackingSummary(unitId, items) { const total = items.length, mastered = items.reduce((count, item) => count + (wordState(unitId, item.id).learned ? 1 : 0), 0); return { mastered, total }; },
    getSpeakingState: speakingState,
    setSpeakingCompleted(unitId, promptId, completed = true) { const existing = all()[unitId]?.speaking ?? {}; write(unitId, { speaking: { ...existing, [promptId]: { completed: Boolean(completed) } } }, { type: 'speaking', promptId }); return speakingState(unitId, promptId); },
    getSpeakingSummary(unitId, prompts) { const total = prompts.length, completed = prompts.reduce((count, prompt) => count + (speakingState(unitId, prompt.id).completed ? 1 : 0), 0); return { completed, total }; },
    exportData() { return all(); },
    replaceData(snapshot) { if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return false; persist(snapshot); notify({ type: 'hydrate' }); return true; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    requiredListens, targetUses,
    clear(unitId) { const records = all(); delete records[unitId]; persist(records); notify({ unitId, type: 'clear' }); return defaults(); },
  };
}
