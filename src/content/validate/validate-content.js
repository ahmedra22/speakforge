import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { books as defaultBooks, levels as defaultLevels, sourceSets as defaultSourceSets } from '../manifests/catalog.js';
import { extractJsonObjects } from '../normalize/parse-source.js';
import { normalizeUnit } from '../normalize/normalize-unit.js';
import { validateAudioTiming } from '../../domain/audio-timing.js';

const defaultRoot = fileURLToPath(new URL('../../../', import.meta.url));
const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
const audioFor = (set, number) => set.audioPathTemplate?.replaceAll('{number}', String(number)) ?? null;

export async function validateContent({
  root = defaultRoot,
  levels = defaultLevels,
  books = defaultBooks,
  sourceSets = defaultSourceSets,
} = {}) {
  const errors = [];
  const warnings = [];
  const unitIds = new Set();
  const vocabOwners = new Map();
  const fail = (message) => errors.push(message);
  const warn = (message) => warnings.push(message);
  const full = (relativePath) => path.resolve(root, relativePath);
  const safeRelative = (relativePath) => hasText(relativePath) && !path.isAbsolute(relativePath)
    && !path.relative(root, full(relativePath)).startsWith('..');
  const exists = async (relativePath) => {
    if (!safeRelative(relativePath)) return false;
    try { await access(full(relativePath)); return true; } catch { return false; }
  };
  const unique = (items, key, label) => {
    const seen = new Set();
    for (const item of items) {
      const value = item?.[key];
      if (!hasText(value)) fail(`${label}: missing ${key}`);
      else if (seen.has(value)) fail(`${label}: duplicate ${key} ${value}`);
      else seen.add(value);
    }
  };

  unique(levels, 'id', 'Levels');
  unique(books, 'id', 'Books');
  unique(books, 'routeSlug', 'Books');
  const levelById = new Map(levels.map((level) => [level.id, level]));
  const bookById = new Map(books.map((book) => [book.id, book]));

  for (const level of levels) {
    if (!hasText(level.label)) fail(`Level ${level.id}: missing label`);
    if (!Array.isArray(level.bookIds)) fail(`Level ${level.id}: bookIds must be an array`);
    else for (const bookId of level.bookIds) {
      const book = bookById.get(bookId);
      if (!book || book.levelId !== level.id) fail(`Level ${level.id}: unknown or mismatched book ${bookId}`);
    }
    if (level.cover && !(await exists(level.cover.path))) fail(`Level ${level.id}: missing or broken cover reference ${level.cover.path}`);
  }

  for (const book of books) {
    const level = levelById.get(book.levelId);
    if (!level) fail(`Book ${book.id}: unknown level ${book.levelId}`);
    else if (!level.bookIds?.includes(book.id)) fail(`Book ${book.id}: missing from level ${level.id} bookIds`);
    if (!hasText(book.title) && book.status === 'available') fail(`Book ${book.id}: missing title`);
    if (!['available', 'planned'].includes(book.status)) fail(`Book ${book.id}: invalid status`);
    if (book.status === 'available' && !book.cover?.path) fail(`Book ${book.id}: missing required cover reference`);
    for (const asset of [book.cover, book.sourcePdf].filter(Boolean)) {
      if (!(await exists(asset.path))) fail(`Book ${book.id}: missing or broken asset reference ${asset.path}`);
    }
    if (book.reviewFrequency !== undefined && (!Number.isInteger(book.reviewFrequency) || book.reviewFrequency < 1)) {
      fail(`Book ${book.id}: invalid reviewFrequency`);
    }
  }

  unique(sourceSets, 'bookId', 'Content source sets');
  for (const book of books.filter((item) => item.status === 'available')) {
    if (!sourceSets.some((set) => set.bookId === book.id)) fail(`Book ${book.id}: available book has no content source set`);
  }

  for (const set of sourceSets) {
    const book = bookById.get(set.bookId);
    if (!book || book.status !== 'available') fail(`Content source set ${set.bookId}: book is missing or not available`);
    if (!levelById.has(set.levelId)) fail(`Content source set ${set.bookId}: unknown level ${set.levelId}`);
    if (book && book.levelId !== set.levelId) fail(`Content source set ${set.bookId}: level does not match its book`);
    if (!hasText(set.sourceFile)) {
      fail(`Content source set ${set.bookId}: missing sourceFile`);
      continue;
    }
    if (!hasText(set.audioPathTemplate) || !set.audioPathTemplate.includes('{number}')) {
      fail(`Content source set ${set.bookId}: audioPathTemplate must include {number}`);
    }
    let sources;
    try {
      if (!(await exists(set.sourceFile))) throw new Error(`Missing content source ${set.sourceFile}`);
      sources = extractJsonObjects(await readFile(full(set.sourceFile), 'utf8'), set.sourceFile);
    } catch (error) {
      fail(error.message);
      continue;
    }
    if (!sources.length) fail(`${set.sourceFile}: contains no units`);
    const numbers = new Set();
    for (const [index, source] of sources.entries()) {
      const where = `${set.sourceFile} object ${index + 1}`;
      if (!hasText(source.level)) fail(`${where}: missing level metadata`);
      if (!Number.isInteger(source.unit_number) || source.unit_number < 1) fail(`${where}: unit_number must be a positive integer`);
      if (numbers.has(source.unit_number)) fail(`${where}: duplicate unit number ${source.unit_number}`);
      numbers.add(source.unit_number);
      for (const key of ['unit_title', 'topic']) if (!hasText(source[key])) fail(`${where}: missing ${key}`);
      if (!Array.isArray(source.passage) || !source.passage.length || source.passage.some((text) => !hasText(text))) fail(`${where}: invalid passage paragraphs`);      if (source.paragraph_audio !== undefined) {
        if (!Array.isArray(source.paragraph_audio) || !Array.isArray(source.passage) || source.paragraph_audio.length !== source.passage.length) fail(`${where}: paragraph_audio must map one audio path per passage paragraph`);
        else for (const [paragraphIndex, paragraphAudioPath] of source.paragraph_audio.entries()) if (!hasText(paragraphAudioPath) || !(await exists(paragraphAudioPath))) fail(`${where}: paragraph ${paragraphIndex + 1} audio reference is missing or broken`);
      }
      if (source.audio_timing !== undefined) {
        const timing = validateAudioTiming(source.audio_timing, { paragraphCount: source.passage?.length });
        if (!timing.valid) for (const issue of timing.errors) fail(`${where}: invalid audio_timing: ${issue}`);
      }
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
      const audioPath = audioFor(set, source.unit_number);
      if (audioPath && !(await exists(audioPath))) fail(`${where}: missing audio ${audioPath}`);
      const unit = normalizeUnit(source, { ...set, audio: audioPath });
      if (unitIds.has(unit.id)) fail(`${where}: duplicate ID ${unit.id}`);
      unitIds.add(unit.id);
    }
  }
  return { errors, warnings, unitCount: unitIds.size, sourceSetCount: sourceSets.length, catalogBookCount: books.length };
}



