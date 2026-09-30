import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { contentLoader } from '../src/content/repository/content-loader.js';
import { renderPath } from '../src/app/render.js';
import { buildUnitContext } from '../src/domain/ai-practice/unit-context.js';
import { escapeHtml } from '../src/app/html.js';

const fixtures = [
  { route: '/learn/a2/unit-01', bookId: 'a2-foundation', unitId: 'a2-foundation:unit:1', audioSrc: '/audio/a2/A2%20Unit%201.mp3', label: 'A2 Foundation' },
  { route: '/learn/b1-core/unit-01', bookId: 'b1-core', unitId: 'b1-core:unit:1', audioSrc: '/audio/b1/B1%20Unit%201.mp3', label: 'B1 Core' },
  { route: '/learn/b1plus-bridge/unit-01', bookId: 'b1-plus-bridge', unitId: 'b1-plus-bridge:unit:1', audioSrc: '/audio/b1-plus/B1%2B%20Unit%201.mp3', label: 'B1+ Bridge' }
];

test('real UnitPage composes all normalized learning features in learning order for A2, B1, and B1+', async () => {
  for (const fixture of fixtures) {
    const unit = await contentLoader.getUnit(fixture.unitId);
    const book = await contentLoader.getBook(fixture.bookId);
    const level = await contentLoader.getLevel(unit.levelId);
    assert.ok(unit?.title && unit?.topic && unit.passage.paragraphs.length);
    assert.ok(unit.vocabulary.length && unit.speakingPrompts.length && unit.grammar?.title && unit.audio?.path);
    const context = buildUnitContext({ level, book, unit });
    assert.equal(context.level.label, fixture.label);
    assert.equal(context.unit.title, unit.title);
    assert.deepEqual(context.unit.passage, unit.passage.paragraphs);
    assert.deepEqual(context.unit.vocabulary.map(word => word.word), unit.vocabulary.map(word => word.word));
    assert.deepEqual(context.unit.speakingPrompts.map(prompt => prompt.text), unit.speakingPrompts.map(prompt => prompt.text));
    assert.deepEqual(context.unit.grammar, unit.grammar);

    const html = await renderPath(fixture.route);
    assert.ok(html.includes(unit.title) && html.includes(unit.topic));
    assert.ok(html.includes(`data-unit-id="${unit.id}"`));
    assert.ok(html.includes(`src="${fixture.audioSrc}"`), `${fixture.route} audio path`);
    for (const marker of ['data-audio-player', 'data-listening-progress', 'data-passage-lock', 'data-passage-host', 'data-vocabulary-section', 'data-speaking-section', 'data-grammar-section', 'data-ai-practice-open', 'data-ai-practice-dialog', 'data-unit-completion', 'data-complete-unit']) {
      assert.ok(html.includes(marker), `${fixture.route} missing ${marker}`);
    }
    assert.equal((html.match(/data-vocabulary-card/g) ?? []).length, unit.vocabulary.length);
    assert.equal((html.match(/data-word-marks/g) ?? []).length, unit.vocabulary.length);
    assert.equal((html.match(/data-speaking-card/g) ?? []).length, unit.speakingPrompts.length);
    for (const item of unit.vocabulary) assert.ok(html.includes(escapeHtml(item.word)), `missing vocabulary ${item.word}`);
    for (const prompt of unit.speakingPrompts) assert.ok(html.includes(escapeHtml(prompt.text)), `missing prompt ${prompt.text}`);
    for (const example of unit.grammar.examples) assert.ok(html.includes(escapeHtml(example)), `missing grammar example ${example}`);
    assert.ok(html.includes(escapeHtml(unit.grammar.explanation)) && html.includes(escapeHtml(unit.grammar.practiceTask)));
    assert.ok(html.includes(`${fixture.label} · ${book.title} · Unit 01`), 'AI Practice has the current level/book/unit context');
    assert.ok(!html.includes(unit.passage.paragraphs[0]), 'passage source text stays absent before the listen gate');

    const order = ['Now Listening', 'data-listening-progress', 'data-passage-lock', 'data-vocabulary-section', 'data-speaking-section', 'data-grammar-section', 'data-ai-practice-open', 'data-unit-completion', 'unit-pager'];
    const positions = order.map(marker => html.indexOf(marker));
    assert.ok(positions.every(position => position >= 0));
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b), `${fixture.route} section order`);
  }
});

test('UnitPage client mounts shared audio, listen, progress, vocabulary, speaking, grammar, and AI controllers', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  for (const marker of ['mountAudioPlayer', 'createListenCompletionTracker', 'createListeningProgressStore', 'mountPassageReader', 'mountVocabularySection', 'mountSpeakingSection', 'mountGrammarSection', 'mountAiPracticePanel', 'syncUnit', 'completeUnit']) assert.ok(app.includes(marker), `client integration missing ${marker}`);
});
