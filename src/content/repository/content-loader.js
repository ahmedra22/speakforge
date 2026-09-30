import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { levels as defaultLevels, books as defaultBooks, sourceSets as defaultSourceSets } from '../manifests/catalog.js';
import { extractJsonObjects } from '../normalize/parse-source.js';
import { normalizeUnit } from '../normalize/normalize-unit.js';

const defaultRoot = fileURLToPath(new URL('../../../', import.meta.url));
const resolveFrom = (root, relativePath) => path.join(root, relativePath);
const audioFor = (set, number) => set.audioPathTemplate?.replaceAll('{number}', String(number)) ?? null;

const summaryOf = (source, set) => ({
  kind: 'unit',
  id: `${set.bookId}:unit:${source.unit_number}`,
  bookId: set.bookId,
  levelId: set.levelId,
  number: source.unit_number,
  title: source.unit_title,
  topic: source.topic,
  grammarTitle: source.grammar_focus?.title,
  audioAvailable: Boolean(audioFor(set, source.unit_number)),
});

async function readSources(set, root) {
  return extractJsonObjects(await readFile(resolveFrom(root, set.sourceFile), 'utf8'), set.sourceFile);
}

async function loadUnits(set, root) {
  return (await readSources(set, root)).map((source) => normalizeUnit(source, {
    ...set,
    audio: audioFor(set, source.unit_number),
  }));
}

export function createContentLoader({
  levels = defaultLevels,
  books = defaultBooks,
  sourceSets = defaultSourceSets,
  root = defaultRoot,
} = {}) {
  const unitCache = new Map();
  const summaryCache = new Map();
  const sourceSetFor = (bookId) => sourceSets.find((set) => set.bookId === bookId);
  const summaries = async (bookId) => {
    if (!summaryCache.has(bookId)) {
      const set = sourceSetFor(bookId);
      summaryCache.set(bookId, set ? (await readSources(set, root)).map((source) => summaryOf(source, set)) : []);
    }
    return summaryCache.get(bookId);
  };
  const units = async (bookId) => {
    if (!unitCache.has(bookId)) {
      const set = sourceSetFor(bookId);
      unitCache.set(bookId, set ? loadUnits(set, root) : Promise.resolve([]));
    }
    return unitCache.get(bookId);
  };

  return {
    async listLevels() { return levels.map((level) => ({ ...level })); },
    async getLevel(id) { return levels.find((level) => level.id === id) ?? null; },
    async listBooks({ levelId } = {}) {
      return Promise.all(books.filter((book) => !levelId || book.levelId === levelId).map(async (book) => ({
        ...book,
        unitIds: (await summaries(book.id)).map((unit) => unit.id),
        unitCount: (await summaries(book.id)).length,
      })));
    },
    async getBook(id) { return books.find((book) => book.id === id) ?? null; },
    async listUnitSummaries(bookId) { return (await summaries(bookId)).map((summary) => ({ ...summary })); },
    async listUnits(bookId) { return [...await units(bookId)]; },
    async getUnit(unitId) {
      for (const set of sourceSets) {
        const found = (await units(set.bookId)).find((unit) => unit.id === unitId);
        if (found) return found;
      }
      return null;
    },
    async listVocabulary(unitId) { return (await this.getUnit(unitId))?.vocabulary ?? []; },
    async listReviews() { return []; },
  };
}

export const contentLoader = createContentLoader();
