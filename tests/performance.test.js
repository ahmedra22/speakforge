import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('sitewide performance safeguards stay enabled', async () => {
  const [server, app, layout, card] = await Promise.all([
    readFile('src/app/server.js', 'utf8'),
    readFile('public/app.js', 'utf8'),
    readFile('src/components/layout.js', 'utf8'),
    readFile('src/components/book-card.js', 'utf8'),
  ]);

  assert.match(server, /public, max-age=31536000, immutable/);
  assert.match(server, /public, max-age=86400, stale-while-revalidate=604800/);
  assert.match(server, /public, max-age=2592000, stale-while-revalidate=31536000/);
  assert.match(server, /public, s-maxage=60, stale-while-revalidate=300/);

  assert.doesNotMatch(app, /from ['"]\/audio-player\.js['"]/);
  assert.doesNotMatch(app, /from ['"]\/vocabulary-section\.js['"]/);
  assert.match(app, /import\('\/audio-player\.js'\)/);
  assert.match(app, /import\('\/dashboard\.js'\)/);

  assert.match(layout, /styles\.css\?v=20261005/);
  assert.match(layout, /app\.js\?v=20261005/);
  assert.match(card, /decoding="async"/);
  assert.match(card, /width="1792" height="2400"/);
  assert.match(card, /fetchpriority="low"/);
});
