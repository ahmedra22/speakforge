import test from "node:test";
import assert from "node:assert/strict";
import { myLearningPage } from "../src/features/dashboard/page.js";
import { renderPath } from "../src/app/render.js";

test("My Learning page renders an authentication gate", () => {
  const html = myLearningPage();
  assert.match(html, /data-learning-auth-page/);
  assert.match(html, /data-learning-auth-gate/);
  assert.match(html, /data-learning-auth-content hidden/);
  assert.match(html, /My Learning/);
  assert.match(html, /api\/auth\/google\?next=%2Fmy-learning/);
});

test("My Learning route is available", async () => {
  const html = await renderPath("/my-learning");
  assert.match(html, /Your progress, in one place\./);
  assert.match(html, /data-my-learning-dashboard/);
});
