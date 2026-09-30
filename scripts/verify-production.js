import assert from 'node:assert/strict';
import { createAppServer } from '../dist/src/app/server.js';
import { contentLoader } from '../dist/src/content/repository/content-loader.js';
import { createAiPracticeSessionService } from '../dist/src/domain/ai-practice/session.js';
import { createAiProvider } from '../dist/src/infrastructure/ai/provider.js';

const aiPracticeService = createAiPracticeSessionService({ contentLoader, provider: createAiProvider({ env: {} }) });
const server = createAppServer({ aiPracticeService });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
async function verifyBrowserModuleGraph(base) {
  const pending = ['/app.js'];
  const visited = new Set();
  while (pending.length) {
    const route = pending.pop();
    if (visited.has(route)) continue;
    visited.add(route);
    const response = await fetch(base + route);
    assert.equal(response.status, 200, `browser module ${route}`);
    const source = await response.text();
    for (const match of source.matchAll(/\bfrom\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']/g)) {
      const specifier = match[1] ?? match[2];
      if (/^(?:https?:|data:)/.test(specifier)) continue;
      pending.push(new URL(specifier, `${base}${route}`).pathname);
    }
  }
  return visited;
}
try {
  const base = `http://127.0.0.1:${server.address().port}`;
  const browserModules = await verifyBrowserModuleGraph(base);
  assert.ok(browserModules.has('/domain/audio-timing.js'), 'passage reader timing dependency is served');
  const routes = [
    '/', '/learn/a2', '/learn/b1-core', '/learn/b1plus-bridge', '/learn/b2-plus',
    '/learn/a2/unit-01', '/learn/b1-core/unit-01', '/learn/b1plus-bridge/unit-01', '/learn/a2/review-01-03'
  ];
  for (const route of routes) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, `${route} status`);
    assert.match(response.headers.get('content-type'), /text\/html/);
  }
  for (const route of ['/audio-player.js', '/listen-completion.js', '/listening-progress.js', '/passage-reader.js', '/speech-service.js', '/vocabulary-section.js', '/speaking-section.js', '/recording-session.js', '/grammar-section.js', '/review-experience.js', '/progression.js', '/domain/audio-timing.js', '/ai-practice-panel.js']) assert.equal((await fetch(base + route)).status, 200, `${route} module`);

  const unitRoutes = [
    { route: '/learn/a2/unit-01', id: 'a2-foundation:unit:1', label: 'A2 Foundation', src: '/audio/a2/A2%20Unit%201.mp3', audioPath: '/audio/a2/A2%20Unit%201.mp3' },
    { route: '/learn/b1-core/unit-01', id: 'b1-core:unit:1', label: 'B1 Core', src: '/audio/b1/B1%20Unit%201.mp3', audioPath: '/audio/b1/B1%20Unit%201.mp3' },
    { route: '/learn/b1plus-bridge/unit-01', id: 'b1-plus-bridge:unit:1', label: 'B1+ Bridge', src: '/audio/b1-plus/B1%2B%20Unit%201.mp3', audioPath: '/audio/b1-plus/B1%2B%20Unit%201.mp3' },
  ];
  for (const item of unitRoutes) {
    const unit = await contentLoader.getUnit(item.id);
    assert.ok(unit?.title && unit.topic && unit.passage.paragraphs.length && unit.vocabulary.length && unit.speakingPrompts.length && unit.grammar && unit.audio, `${item.id} normalized data`);
    const response = await fetch(base + item.route);
    const html = await response.text();
    for (const marker of ['data-audio-player', 'data-listening-progress', 'data-passage-lock', 'data-passage-host', 'data-vocabulary-section', 'data-speaking-section', 'data-grammar-section', 'data-ai-practice-open', 'data-ai-practice-dialog', 'data-unit-completion', 'data-complete-unit']) assert.ok(html.includes(marker), `${item.route} missing ${marker}`);
    assert.ok(html.includes(`src="${item.src}"`), `${item.route} audio src`);
    assert.ok(html.includes(unit.title) && html.includes(unit.topic));
    assert.ok(html.includes(`${item.label} · ${unit.bookId === 'a2-foundation' ? 'Speak Forge A2' : unit.bookId === 'b1-core' ? 'Speak Forge B1' : 'Speak Forge B1+'} · Unit 01`));
    assert.equal((html.match(/data-vocabulary-card/g) ?? []).length, unit.vocabulary.length, `${item.route} vocabulary count`);
    assert.equal((html.match(/data-speaking-card/g) ?? []).length, unit.speakingPrompts.length, `${item.route} prompt count`);
    assert.ok(!html.includes(unit.passage.paragraphs[0]), `${item.route} must not expose locked passage`);
    assert.ok(html.indexOf('data-listening-progress') < html.indexOf('data-passage-lock'));
    assert.ok(html.indexOf('data-passage-lock') < html.indexOf('data-vocabulary-section'));
    assert.ok(html.indexOf('data-vocabulary-section') < html.indexOf('data-speaking-section'));
    assert.ok(html.indexOf('data-speaking-section') < html.indexOf('data-grammar-section'));
    assert.ok(html.indexOf('data-grammar-section') < html.indexOf('data-ai-practice-open'));
    assert.ok(html.indexOf('data-ai-practice-open') < html.indexOf('data-unit-completion'));

    const audio = await fetch(base + item.audioPath);
    assert.equal(audio.status, 200, `${item.audioPath} GET`);
    assert.match(audio.headers.get('content-type'), /^audio\/mpeg/);
    assert.equal(audio.headers.get('accept-ranges'), 'bytes');
    const body = await audio.arrayBuffer();
    assert.ok(body.byteLength > 1024);
    assert.equal(Number(audio.headers.get('content-length')), body.byteLength);
    const ranged = await fetch(base + item.audioPath, { headers: { Range: 'bytes=0-1023' } });
    assert.equal(ranged.status, 206, `${item.audioPath} Range`);
    assert.match(ranged.headers.get('content-range'), /^bytes 0-1023\//);
    assert.equal(ranged.headers.get('content-length'), '1024');
    assert.equal((await ranged.arrayBuffer()).byteLength, 1024);
  }

  const reviewHtml = await (await fetch(base + '/learn/a2/review-01-03')).text();
  assert.match(reviewHtml, /Review locked/);
  assert.match(reviewHtml, /data-review-host hidden/);
  assert.doesNotMatch(reviewHtml, /Vocabulary recap/);
  const sequence = await (await fetch(base + '/api/books/a2-foundation/learning-sequence')).json();
  assert.equal(sequence.sequence[3].kind, 'review');
  assert.equal(sequence.sequence[3].startUnit, 1);
  const review = await (await fetch(base + '/api/reviews/a2-foundation/1/3')).json();
  assert.equal(review.sourceUnits.length, 3);
  assert.equal(review.passageExcerpts.length, 3);
  const levelContext = await (await fetch(base + '/api/levels/b1/progress-context')).json();
  assert.equal(levelContext.books[0].units.length, 12);
  const invalidAiSession = await fetch(base + '/api/ai-practice/sessions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ unitId: 'not-a-unit' }) });
  assert.equal(invalidAiSession.status, 404);
  const aiSessionResponse = await fetch(base + '/api/ai-practice/sessions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ unitId: 'b1-plus-bridge:unit:1', context: { passage: ['untrusted'] } }) });
  assert.equal(aiSessionResponse.status, 201);
  const aiSession = await aiSessionResponse.json();
  assert.equal(aiSession.status, 'not_configured');
  assert.equal(aiSession.unitId, 'b1-plus-bridge:unit:1');
  assert.equal(JSON.stringify(aiSession).includes('untrusted'), false);
  const aiMessageResponse = await fetch(base + '/api/ai-practice/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: aiSession.id, message: 'hello' }) });
  assert.equal(aiMessageResponse.status, 503);
  assert.equal((await fetch(base + '/assets/b1-plus/b1+.jfif')).status, 200);
  const passageResponse = await fetch(base + '/api/units/a2-foundation%3Aunit%3A1/passage');
  assert.equal(passageResponse.status, 200);
  const passage = await passageResponse.json();
  assert.equal(passage.passage.paragraphs.length, 4);
  assert.equal(passage.audioTiming, null);
  assert.equal((await fetch(base + '/styles.css')).status, 200);
  console.log('Production integration smoke passed: complete A2/B1/B1+ UnitPages, learning order and locked passage, mapped MP3 GET/HEAD/ranges, reviews/progress, and graceful unconfigured AI state.');
} finally {
  await new Promise(resolve => server.close(resolve));
}
