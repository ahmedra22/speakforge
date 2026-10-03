export const DEFAULT_REVIEW_FREQUENCY = 3;

export function buildLearningSequence(bookId, units, { reviewFrequency = DEFAULT_REVIEW_FREQUENCY } = {}) {
  const frequency = Number.isInteger(reviewFrequency) && reviewFrequency > 0 ? reviewFrequency : DEFAULT_REVIEW_FREQUENCY;
  const ordered = [...units].sort((a, b) => a.number - b.number);
  const items = [];
  for (let index = 0; index < ordered.length; index += 1) {
    items.push({ kind: 'unit', id: ordered[index].id, unit: ordered[index] });
    if ((index + 1) % frequency === 0) {
      const sourceUnits = ordered.slice(index + 1 - frequency, index + 1);
      items.push(createReview(bookId, sourceUnits, { number: items.filter(item => item.kind === 'review').length + 1 }));
    }
  }
  return items;
}

export function createReview(bookId, sourceUnits, { number = 1 } = {}) {
  const sources = [...sourceUnits].sort((a, b) => a.number - b.number);
  if (!sources.length) return null;
  const first = sources[0], last = sources.at(-1);
  return {
    kind: 'review', id: `${bookId}:review:${first.number}-${last.number}`, bookId, number,
    title: `Review · Units ${first.number}–${last.number}`, startUnit: first.number, endUnit: last.number,
    sourceUnits: sources.map(unit => ({ id: unit.id, number: unit.number, title: unit.title })),
    vocabulary: sources.flatMap(unit => unit.vocabulary.map(item => ({ ...item, sourceUnitId: unit.id, sourceUnitNumber: unit.number }))),
    grammar: sources.filter(unit => unit.grammar).map(unit => ({ unitId: unit.id, unitNumber: unit.number, title: unit.grammar.title, explanation: unit.grammar.explanation, examples: [...unit.grammar.examples], practiceTask: unit.grammar.practiceTask })),
    passageExcerpts: sources.flatMap(unit => unit.passage.paragraphs.slice(0, 1).map(text => ({ unitId: unit.id, unitNumber: unit.number, title: unit.title, text }))),
    speakingPrompts: sources.flatMap(unit => unit.speakingPrompts.map(prompt => ({ ...prompt, unitId: unit.id, unitNumber: unit.number }))),
  };
}

export function getReviewHref(book, review) { return `/learn/${book.routeSlug}/review-${String(review.startUnit).padStart(2, '0')}-${String(review.endUnit).padStart(2, '0')}`; }
export function isReviewUnlocked(review, progressStore) { return review.sourceUnits.every(source => Boolean(progressStore?.get?.(source.id)?.completed)); }

function isItemComplete(item, store) {
  return item.kind === 'unit' ? Boolean(store?.get?.(item.id)?.completed) : Boolean(store?.getReviewState?.(item.id, isReviewUnlocked(item, store))?.completed);
}
function hasActivity(item, store) {
  if (item.kind === 'review') return false;
  const unit = item.unit, state = store?.get?.(unit.id);
  if (state?.listensCompleted || state?.passageUnlocked) return true;
  if (unit.vocabulary?.some(word => store?.getVocabularyState?.(unit.id, word.id)?.uses > 0)) return true;
  if (unit.speakingPrompts?.some(prompt => store?.getSpeakingState?.(unit.id, prompt.id)?.completed)) return true;
  return Boolean(store?.getGrammarState?.(unit.id)?.completed);
}

export function deriveUnitCompletion(unit, progressStore, { requireAiPractice = false } = {}) {
  const listening = progressStore?.get?.(unit.id) ?? { passageUnlocked: false };
  const mastered = progressStore?.getWordTrackingSummary?.(unit.id, unit.vocabulary ?? []) ?? { mastered: 0, total: (unit.vocabulary ?? []).length };
  const speaking = progressStore?.getSpeakingSummary?.(unit.id, unit.speakingPrompts ?? []) ?? { completed: 0, total: (unit.speakingPrompts ?? []).length };
  const grammarCompleted = !unit.grammar || !unit.grammar.practiceTask || Boolean(progressStore?.getGrammarState?.(unit.id)?.completed);
  const aiPracticeCompleted = !requireAiPractice || Boolean(progressStore?.getAiPracticeState?.(unit.id)?.completed);
  const conditions = { passageUnlocked: Boolean(listening.passageUnlocked), vocabularyMastered: mastered.mastered === mastered.total, speakingCompleted: speaking.completed === speaking.total, grammarCompleted, aiPracticeCompleted };
  return { completed: Object.values(conditions).every(Boolean), conditions, masteredVocabulary: mastered.mastered, totalVocabulary: mastered.total, completedSpeaking: speaking.completed, totalSpeaking: speaking.total };
}

export function getItemStatus(item, { sequence, progressStore, lastVisitedId = null, index = 0 } = {}) {
  if (isItemComplete(item, progressStore)) return 'completed';
  if (item.kind === 'review') {
    const previousComplete = sequence.slice(0, index).every(previous => isItemComplete(previous, progressStore));
    if (!previousComplete || !isReviewUnlocked(item, progressStore)) return 'locked';
  }
  if (hasActivity(item, progressStore)) return 'in-progress';
  return lastVisitedId === item.id || index === 0 ? 'current' : 'available';
}

export function deriveSequenceProgress(sequence, units, progressStore, { lastVisitedId = null } = {}) {
  const byId = new Map(units.map(unit => [unit.id, unit]));
  const normalizedSequence = sequence.map(item => item.kind === 'unit' ? { ...item, unit: byId.get(item.id) ?? item.unit } : item);
  const items = normalizedSequence.map((item, index) => ({ ...item, status: getItemStatus(item, { sequence: normalizedSequence, progressStore, lastVisitedId, index }) }));
  const completedUnits = units.filter(unit => Boolean(progressStore?.get?.(unit.id)?.completed)).length;
  return { sequence: items, completedUnits, totalUnits: units.length, percent: units.length ? Math.round(completedUnits / units.length * 100) : 0, unlockedReviews: items.filter(item => item.kind === 'review' && item.status !== 'locked').length, nextItem: items.find(item => item.status !== 'completed') ?? null };
}

export function deriveBookProgress(bookId, units, progressStore, options = {}) {
  const sequence = buildLearningSequence(bookId, units, options);
  return deriveSequenceProgress(sequence, units, progressStore, options);
}
export function getNextLearningItem(sequence, progressStore) { return sequence.find((item, index) => getItemStatus(item, { sequence, progressStore, index }) !== 'completed') ?? null; }
export function getUnlockedItems(sequence, progressStore) { return sequence.filter((item, index) => getItemStatus(item, { sequence, progressStore, index }) !== 'locked'); }
export function deriveLevelProgress(booksProgress) {
  const completedUnits = booksProgress.reduce((sum, book) => sum + book.completedUnits, 0), totalUnits = booksProgress.reduce((sum, book) => sum + book.totalUnits, 0);
  return { completedUnits, totalUnits, percent: totalUnits ? Math.round(completedUnits / totalUnits * 100) : 0, books: booksProgress };
}
export function completeUnit(unit, progressStore, sequence, options = {}) {
  const completion = deriveUnitCompletion(unit, progressStore, options);
  const index = sequence.findIndex(item => item.id === unit.id);
  const status = index < 0 ? 'locked' : getItemStatus(sequence[index], { sequence, progressStore, ...options, index });
  if (!completion.completed || status === 'locked') return { completed: false, completion, status };
  progressStore.setUnitCompleted(unit.id, true);
  return { completed: true, completion, status: 'completed' };
}
