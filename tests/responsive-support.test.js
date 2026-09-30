import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('responsive layout adapts catalog, course controls, touch targets, and AI Practice to small screens', async () => {
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');

  assert.match(css, /@media\(max-width:900px\)\{\.book-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:740px\)\{\.vocabulary-grid\{grid-template-columns:1fr\}/);
  assert.match(css, /@media\(max-width:740px\)\{[^}]*\}\.speaking-grid\{grid-template-columns:1fr\}/);
  assert.match(css, /@media\(max-width:650px\)\{\.hero-orbit\{display:none\}/);
  assert.match(css, /\.unit-main strong\{white-space:normal;text-overflow:clip;overflow:visible;overflow-wrap:anywhere\}/);
  assert.match(css, /\.resume-panel:not\(\[hidden\]\)\{display:grid;grid-template-columns:minmax\(0,1fr\) max-content/);
  assert.match(css, /\.passage-reader:empty\{display:none\}/);
  assert.match(css, /\.nav-toggle\{min-width:44px;min-height:44px\}/);
  assert.match(css, /\.level-pill\{display:inline-flex;align-items:center;min-height:44px\}/);
  assert.match(css, /@media\(max-width:430px\)\{\.audio-options\{grid-template-columns:1fr\}/);
  assert.match(css, /\.audio-range\{min-height:44px\}/);
  assert.match(css, /\.ai-practice-dialog\{max-width:none;margin:0;padding:0;border:0;width:100vw;height:100vh;height:100dvh\}/);
  assert.match(app, /toggle\.setAttribute\('aria-expanded',String\(!open\)\);nav\?\.classList\.toggle\('is-open',!open\)/);
});
