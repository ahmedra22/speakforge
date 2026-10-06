import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('homepage has Google site identity metadata and structured data',()=>{
  const source=readFileSync(new URL('../src/components/layout.js',import.meta.url),'utf8');
  assert.match(source,/@type':'WebSite/);
  assert.match(source,/name:'SpeakForge'/);
  assert.match(source,/alternateName:['Speak Forge','speakforge']/);
  assert.match(source,/og:site_name/);
  assert.match(source,/SpeakForge — Learn English with confidence/);
});

test('server exposes robots.txt and sitemap.xml',()=>{
  const source=readFileSync(new URL('../src/app/server.js',import.meta.url),'utf8');
  assert.match(source,/url.pathname === "/robots.txt"/);
  assert.match(source,/url.pathname === "/sitemap.xml"/);
  assert.match(source,/Sitemap:.*sitemap.xml/);
  assert.match(source,//api//);
  assert.match(source,//my-learning/);
});
