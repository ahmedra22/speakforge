import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { handler } from '../api/index.ts';

test('Vercel adapter forwards application routes and preserves audio range and HEAD responses', async (t) => {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;

  const home = await fetch(origin);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /SpeakForge/);

  const sequence = await fetch(`${origin}/api/books/a2-foundation/learning-sequence`);
  assert.equal(sequence.status, 200);
  assert.equal((await sequence.json()).sequence[0].kind, 'unit');

  const audioPath = '/audio/a2/A2%20Unit%201.mp3';
  const range = await fetch(`${origin}${audioPath}`, { headers: { Range: 'bytes=0-1023' } });
  assert.equal(range.status, 206);
  assert.equal(range.headers.get('content-range')?.split(' ')[0], 'bytes');
  assert.equal(range.headers.get('content-length'), '1024');
  assert.equal((await range.arrayBuffer()).byteLength, 1024);

  const head = await fetch(`${origin}${audioPath}`, { method: 'HEAD', headers: { Range: 'bytes=0-1023' } });
  assert.equal(head.status, 206);
  assert.equal(head.headers.get('content-length'), '1024');
  assert.equal((await head.arrayBuffer()).byteLength, 0);
});
