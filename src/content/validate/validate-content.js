import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { books, expectedUnitCounts, levels, sourceSets } from '../manifests/catalog.js';
import { extractJsonObjects } from '../normalize/parse-source.js';
import { normalizeUnit } from '../normalize/normalize-unit.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const full = (relativePath) => path.join(root, relativePath);
const errors = [];
const warnings = [];
const unitIds = new Set();
const vocabOwners = new Map();
const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);
const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
async function exists(relativePath) {
  try { await access(full(relativePath)); return true; } catch { return false; }
}

for (const level of levels) {
  for (const bookId of level.bookIds) {
    if (!books.some((book) => book.id === bookId && book.levelId === level.id)) fail(`Level ${level.id}: unknown book ${bookId}`);
  }
  if (level.cover && !(await exists(level.cover.path))) fail(`Level ${level.id}: missing cover ${level.cover.path}`);
}
for (const book of books) {
  for (const asset of [book.cover, book.sourcePdf].filter(Boolean)) {
    if (!(await exists(asset.path))) fail(`Book ${book.id}: missing asset ${asset.path}`);
  }
}

for (const set of sourceSets) {
  let sources;
  try {
    sources = extractJsonObjects(await readFile(full(set.sourceFile), 'utf8'), set.sourceFile);
  } catch (error) {
    fail(error.message);
    continue;
  }
  const expected = expectedUnitCounts[set.levelId];
  if (sources.length !== expected) fail(`${set.sourceFile}: expected ${expected} units, found ${sources.length}`);
  const numbers = new Set();
  for (const [index, source] of sources.entries()) {
    const where = `${set.sourceFile} object ${index + 1}`;
    if (!hasText(source.level)) fail(`${where}: missing level metadata`);
    if (!Number.isInteger(source.unit_number) || source.unit_number < 1) fail(`${where}: unit_number must be a positive integer`);
    if (numbers.has(source.unit_number)) fail(`${where}: duplicate unit number ${source.unit_number}`);
    numbers.add(source.unit_number);
    for (const key of ['unit_title', 'topic']) if (!hasText(source[key])) fail(`${where}: missing ${key}`);
    if (!Array.isArray(source.passage) || !source.passage.length || source.passage.some((text) => !hasText(text))) fail(`${where}: invalid passage paragraphs`);
    if (!Array.isArray(source.vocabulary) || !source.vocabulary.length) fail(`${where}: vocabulary is empty`);
    else for (const [vocabIndex, item] of source.vocabulary.entries()) {
      for (const key of ['word', 'part_of_speech', 'meaning_in_context', 'example']) {
        if (!hasText(item?.[key])) fail(`${where}: vocabulary ${vocabIndex + 1} missing ${key}`);
      }
      if (hasText(item?.word)) {
        const key = item.word.toLowerCase();
        const owner = `${set.bookId} unit ${source.unit_number}`;
        if (vocabOwners.has(key) && vocabOwners.get(key) !== owner) warn(`Repeated vocabulary “${item.word}” in ${vocabOwners.get(key)} and ${owner}`);
        else vocabOwners.set(key, owner);
      }
    }
    if (!Array.isArray(source.speaking_prompts) || !source.speaking_prompts.length || source.speaking_prompts.some((text) => !hasText(text))) fail(`${where}: invalid speaking prompts`);
    if (!source.grammar_focus) fail(`${where}: grammar_focus is missing`);
    else {
      for (const key of ['title', 'explanation', 'practice_task']) if (!hasText(source.grammar_focus[key])) fail(`${where}: grammar missing ${key}`);
      if (!Array.isArray(source.grammar_focus.examples) || source.grammar_focus.examples.some((text) => !hasText(text))) fail(`${where}: invalid grammar examples`);
    }
    const audioPath = `${set.audioDirectory}/${set.audioPrefix} Unit ${source.unit_number}.mp3`;
    const unit = normalizeUnit(source, { ...set, audio: audioPath });
    if (unitIds.has(unit.id)) fail(`${where}: duplicate ID ${unit.id}`);
    unitIds.add(unit.id);
    if (!(await exists(unit.audio.path))) fail(`${where}: missing audio ${unit.audio.path}`);
  }
}

for (const message of warnings) console.warn(`WARNING ${message}`);
for (const message of errors) console.error(`ERROR ${message}`);
if (errors.length) {
  console.error(`Content validation failed: ${errors.length} error(s), ${warnings.length} warning(s).`);
  process.exitCode = 1;
} else console.log(`Content validation passed: ${unitIds.size} units across ${sourceSets.length} books; ${warnings.length} warning(s).`);
