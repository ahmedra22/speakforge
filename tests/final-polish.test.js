import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderPath } from '../src/app/render.js';

test('unit routes expose reusable bilingual method and print controls without leaking locked passage text', async () => {
  const routes = [
    ['/learn/a2/unit-01', 'The morning habit'],
    ['/learn/a2/unit-10', null],
    ['/learn/b1-core/unit-01', 'The tree that bends'],
    ['/learn/b1-core/unit-12', null],
    ['/learn/b1plus-bridge/unit-01', 'The observer within'],
    ['/learn/b1plus-bridge/unit-12', null]
  ];
  for (const [route, title] of routes) {
    const html = await renderPath(route);
    assert.ok(html.includes('data-print-unit'), `${route} should expose Print Unit`);
    assert.ok(html.includes('data-method-language="en"') && html.includes('data-method-language="ar"'), `${route} should expose language switching`);
    for (const step of ['Listen', 'Shadow', 'Read', 'Build Active Vocabulary', 'Speak', 'Review']) assert.ok(html.includes(step), `${route} missing method step ${step}`);
    assert.match(html, /lang="ar" dir="rtl" hidden/);
    if (title) assert.ok(html.includes(title));
    assert.ok(html.includes('data-passage-host'));
    assert.ok(!html.includes('data-passage-host aria-label="Reading passage"><p'), 'locked passage must remain absent from initial HTML');
  }
});

test('print stylesheet keeps locked passage content hidden and removes application navigation', async () => {
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(css, /@media print/);
  assert.match(css, /\.site-header,\.site-footer/);
  assert.match(css, /\.passage-locked:not\(\[hidden\]\)/);
  assert.match(css, /\.unit-player-page \[hidden\]\{display:none!important\}/);
});

test('catalog consistently brands available and planned books without changing content availability', async () => {
  const home = await renderPath('/');
  for (const title of ['Speak Forge A2', 'Speak Forge B1', 'Speak Forge B1+', 'Speak Forge B2', 'Speak Forge B2+']) assert.ok(home.includes(title), `home missing ${title}`);
  for (const [route, title] of [['/learn/a2', 'Speak Forge A2'], ['/learn/b1', 'Speak Forge B1'], ['/learn/b1-plus', 'Speak Forge B1+']]) assert.ok((await renderPath(route)).includes(title));
  for (const route of ['/learn/b2', '/learn/b2-plus', '/learn/c1']) {
    const html = await renderPath(route);
    assert.ok(html.includes('no units available yet'));
  }
});

test('annotated unit list background colors are scoped by level container', async () => {
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.page-container\[data-level-id="a2"\] #units \.unit-section\{background:#dedede\}/);
  assert.match(css, /\.page-container\[data-level-id="b1"\] #units \.book-unit-group\{background:#ededed\}/);
  assert.match(css, /\.page-container\[data-level-id="b1-plus"\] #units \.book-unit-group\{background:#e8e8e8\}/);
});
