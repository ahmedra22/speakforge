import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPath } from '../src/app/render.js';
import { createAppServer } from '../src/app/server.js';

test('home presents available and planned catalog data', async () => {
  const html = await renderPath('/');
  for (const value of ['A2 Foundation', 'B1 Core', 'B1+ Bridge', 'Coming soon', 'Ahmed Ramadan']) assert.ok(html.includes(value), `home missing ${value}`);
});

test('one level renderer resolves A2, B1, B1+, and planned levels', async () => {
  for (const [url, title] of [['/learn/a2', 'Read to Speak A2'], ['/learn/b1-core', 'Read to Speak B1'], ['/learn/b1plus-bridge', 'Read to Speak B1+']]) {
    const html = await renderPath(url);
    assert.ok(html.includes(title));
    assert.ok(html.includes('Explore the units'));
    assert.ok(html.includes('unit-01'));
    assert.ok(html.includes('/assets/'));
  }
  const future = await renderPath('/learn/b2-plus');
  assert.ok(future.includes('Coming soon'));
  assert.ok(future.includes('no units available yet'));
});

test('shared unit route displays each selected unit and rejects unknown units', async () => {
  for (const [url, title] of [['/learn/a2/unit-01', 'The morning habit'], ['/learn/b1-core/unit-01', 'The tree that bends'], ['/learn/b1plus-bridge/unit-01', 'The observer within']]) {
    const html = await renderPath(url);
    assert.ok(html.includes(title));
    assert.ok(html.includes('Now Listening'));assert.ok(html.includes('Unit audio'));assert.ok(html.includes('/audio/'));
    assert.ok(html.includes('Back to'));
  }
  assert.ok((await renderPath('/learn/a2/unit-99')).includes('Page not found'));
});

test('HTTP server serves route, stylesheet, and mapped cover', async (t) => {
  const server = createAppServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const home = await fetch(origin);
  assert.equal(home.status, 200);
  assert.ok((await home.text()).includes('SpeakForge'));
  const css = await fetch(`${origin}/styles.css`);
  assert.equal(css.status, 200);
  assert.match(css.headers.get('content-type'), /text\/css/);
  const cover = await fetch(`${origin}/assets/a2.jfif`);
  assert.equal(cover.status, 200);
  assert.match(cover.headers.get('content-type'), /image\/jpeg/);
});
