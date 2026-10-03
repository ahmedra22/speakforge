import test from "node:test";
import assert from "node:assert/strict";
import { renderUnitCard } from "../src/components/unit-list.js";
import { buildLearningSequence, deriveSequenceProgress } from "../src/domain/progression.js";
import { createListeningProgressStore } from "../src/features/listening/listening-progress.js";

test("unit cards expose Start Unit instead of a locked state", () => {
  const book = { id: "a2-foundation", routeSlug: "a2-foundation" };
  const unit = { id: "u2", number: 2, title: "Second Unit", topic: "Topic", grammarTitle: "Grammar", audioAvailable: true };
  const html = renderUnitCard({ book, unit, index: 1 });
  assert.match(html, /Start Unit/);
  assert.doesNotMatch(html, />LOCKED</);
});

test("units are startable before review checkpoints, while reviews remain gated", () => {
  const units = [1,2,3,4,5,6].map(number => ({
    id: "u" + number,
    number,
    title: "Unit " + number,
    vocabulary: [],
    speakingPrompts: [],
    grammar: null,
  }));
  const store = createListeningProgressStore({ storage: new MapStorage() });
  const sequence = buildLearningSequence("book", units, { reviewFrequency: 3 });
  const state = deriveSequenceProgress(sequence, units, store);
  assert.notEqual(state.sequence.find(item => item.id === "u4").status, "locked");
  assert.equal(state.sequence.find(item => item.kind === "review").status, "locked");
});

class MapStorage {
  constructor(){ this.data = new Map(); }
  getItem(key){ return this.data.get(key) ?? null; }
  setItem(key,value){ this.data.set(key,value); }
}
