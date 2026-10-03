import test from "node:test";
import assert from "node:assert/strict";
import { createAppServer } from "../src/app/server.js";
import { unitPage, reviewPage } from "../src/features/catalog/pages.js";
import { renderUnitCard } from "../src/components/unit-list.js";

test("unit and review pages render a sign-in gate before learning content", () => {
  const book = { id: "a2-foundation", routeSlug: "a2-foundation", levelId: "a2", title: "A2 — Foundation", reviewFrequency: 3, aiPracticeRequired: false };
  const level = { id: "a2", label: "A2", status: "available", cover: { path: "a2.jpg" } };
  const unit = { id: "a2-foundation:unit:1", number: 1, title: "A first unit", topic: "A topic", passage: "A passage", audio: null, vocabulary: [], speakingPrompts: [], grammar: null };
  const unitHtml = unitPage({ level, book, unit, units: [unit] });
  assert.match(unitHtml, /data-learning-auth-page/);
  assert.match(unitHtml, /data-learning-auth-gate/);
  assert.match(unitHtml, /data-learning-auth-content hidden/);
  assert.match(unitHtml, /api\/auth\/google\?next=/);
  const reviewHtml = reviewPage({ book, review: { id: "review-1-3", title: "Review", startUnit: 1, endUnit: 3, sourceUnits: [] } });
  assert.match(reviewHtml, /data-learning-auth-gate/);
  assert.match(reviewHtml, /data-learning-auth-content hidden/);
});

test("learning unit links are marked for authentication interception", () => {
  const book = { id: "a2-foundation", routeSlug: "a2-foundation" };
  const unit = { id: "u1", number: 1, title: "Unit", topic: "Topic", grammarTitle: "Grammar", audioAvailable: true };
  assert.match(renderUnitCard({ book, unit, index: 0 }), /data-learning-entry/);
});

test("Google auth endpoint accepts a safe intended learning destination", async (t) => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_ANON_KEY = "public-anon-key";
  const server = createAppServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    if (previousUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previousKey;
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${origin}/api/auth/google?next=${encodeURIComponent("/learn/a2-foundation/unit-01")}`, { redirect: "manual" });
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get("location"));
  assert.equal(location.searchParams.get("provider"), "google");
  assert.equal(location.searchParams.get("redirect_to"), `${origin}/learn/a2-foundation/unit-01`);
  assert.equal(location.searchParams.get("apikey"), "public-anon-key");
});

test("Google auth endpoint ignores unsafe external destinations", async (t) => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_ANON_KEY = "public-anon-key";
  const server = createAppServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    if (previousUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) process.env.SUPABASE_ANON_KEY = previousKey;
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${origin}/api/auth/google?next=${encodeURIComponent("https://evil.example/")}`, { redirect: "manual" });
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get("location"));
  assert.equal(location.searchParams.get("redirect_to"), `${origin}/`);
});
