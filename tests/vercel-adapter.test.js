import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { handler } from "../api/index.ts";

test("Vercel adapter restores the original pathname carried in the rewrite query", async (t) => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;

  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = previousKey;
  });

  const origin = `http://127.0.0.1:${server.address().port}`;

  const home = await fetch(`${origin}/api?path=%2F`);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /SpeakForge/);

  const config = await fetch(`${origin}/api?path=%2Fapi%2Fconfig`);
  assert.equal(config.status, 200);
  assert.deepEqual(await config.json(), {
    supabaseUrl: "",
    supabaseAnonKey: "",
  });

  const sequence = await fetch(`${origin}/api?path=%2Fapi%2Fbooks%2Fa2-foundation%2Flearning-sequence`);
  assert.equal(sequence.status, 200);
  assert.equal((await sequence.json()).sequence[0].kind, "unit");

  const nested = await fetch(`${origin}/api?path=%2Flearn%2Fa2%2Funit-1`);
  assert.equal(nested.status, 200);
  assert.match(await nested.text(), /Unit 1/);

  const audioPath = "/api?path=%2Faudio%2Fa2%2FA2%2520Unit%25201.mp3";
  const range = await fetch(`${origin}${audioPath}`, { headers: { Range: "bytes=0-1023" } });
  assert.equal(range.status, 206);
  assert.equal(range.headers.get("content-length"), "1024");
  assert.equal((await range.arrayBuffer()).byteLength, 1024);

  const head = await fetch(`${origin}${audioPath}`, { method: "HEAD", headers: { Range: "bytes=0-1023" } });
  assert.equal(head.status, 206);
  assert.equal(head.headers.get("content-length"), "1024");
  assert.equal((await head.arrayBuffer()).byteLength, 0);
});

test("Vercel rewrite carries original path in a query parameter", async () => {
  const content = await readFile(new URL("../vercel.json", import.meta.url), "utf8");
  const config = JSON.parse(content);
  assert.deepEqual(config.rewrites, [{ source: "/(.*)", destination: "/api?path=/$1" }]);
});
