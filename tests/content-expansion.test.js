import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { levels, books, sourceSets } from '../src/content/manifests/catalog.js';
import { createContentLoader } from '../src/content/repository/content-loader.js';
import { validateContent } from '../src/content/validate/validate-content.js';
import { renderPath } from '../src/app/render.js';
import { buildLearningSequence, deriveBookProgress, deriveLevelProgress } from '../src/domain/progression.js';
import { createListeningProgressStore } from '../src/features/listening/listening-progress.js';

const unitSource = (level, audioPath) => ({
  level,
  paragraph_audio: [audioPath],
  audio_timing: { version: 1, granularity: 'word', segments: [{ id: 'fixture-word', text: 'Minimal', start: 0, end: 0.5, paragraphIndex: 0 }] },
  unit_number: 1,
  unit_title: 'Temporary sample',
  topic: 'Fixture',
  passage: ['Minimal temporary sample passage.'],
  vocabulary: [{ word: 'fixtureword', part_of_speech: 'noun', meaning_in_context: 'A temporary test term.', example: 'The fixtureword is only test data.' }],
  speaking_prompts: ['Describe this temporary fixture.'],
  grammar_focus: { title: 'Simple sample', explanation: 'Temporary explanatory text.', examples: ['This is a fixture.'], practice_task: 'Complete the temporary task.' },
});

const sourceSet = (levelId, bookId, pathPart) => ({
  levelId,
  bookId,
  sourceFile: `resources/structured/${pathPart}/units.json`,
  audioPathTemplate: `resources/audio/${pathPart}/Future book unit {number}.mp3`,
});

test('temporary future books and a future level use generic catalog, routes, UnitPage, progress, and validation', async () => {
  const root = process.cwd();
  const fixturePrefix = `.fixture-content-expansion-${Date.now()}-${process.pid}`;
  const futureBook = {
    id: 'fixture-b1-book',
    routeSlug: 'fixture-b1-book',
    levelId: 'b1',
    title: 'Temporary Future Book',
    status: 'available',
    reviewFrequency: 1,
    cover: { path: `resources/covers/${fixturePrefix}/b1/cover.jpg`, mediaType: 'image/jpeg' },
  };
  const futureLevel = { id: 'fixture-c1', label: 'Temporary C1', order: 99, status: 'available', bookIds: ['fixture-c1-book'] };
  const futureLevelBook = {
    id: 'fixture-c1-book',
    routeSlug: 'fixture-c1-book',
    levelId: futureLevel.id,
    title: 'Temporary Future Level Book',
    status: 'available',
    reviewFrequency: 1,
    cover: { path: `resources/covers/${fixturePrefix}/c1/cover.jpg`, mediaType: 'image/jpeg' },
  };
  const b1FixtureLevel = { ...levels.find((item) => item.id === 'b1'), bookIds: [futureBook.id], cover: futureBook.cover };
  const levelsForFixture = [futureLevel];
  const booksForFixture = [futureBook, futureLevelBook];
  const setsForFixture = [
    sourceSet('b1', futureBook.id, `${fixturePrefix}/b1`),
    sourceSet(futureLevel.id, futureLevelBook.id, `${fixturePrefix}/c1`),
  ];
  let b1Added = false;

  try {
    for (const set of setsForFixture) {
      await mkdir(path.dirname(path.join(root, set.sourceFile)), { recursive: true });
      await mkdir(path.dirname(path.join(root, set.audioPathTemplate.replace('{number}', '1'))), { recursive: true });
      const book = booksForFixture.find((item) => item.id === set.bookId);
      await mkdir(path.dirname(path.join(root, book.cover.path)), { recursive: true });
      const levelLabel = levels.concat(levelsForFixture).find((item) => item.id === set.levelId).label;
      const mappedAudio = set.audioPathTemplate.replace('{number}', '1');
      await writeFile(path.join(root, set.sourceFile), JSON.stringify(unitSource(levelLabel, mappedAudio)));
      await writeFile(path.join(root, set.audioPathTemplate.replace('{number}', '1')), Buffer.from('temporary audio fixture'));
      await writeFile(path.join(root, book.cover.path), Buffer.from('temporary cover fixture'));
    }
    const b1 = levels.find((item) => item.id === 'b1');
    b1.bookIds.push(futureBook.id);
    b1Added = true;
    levels.push(...levelsForFixture);
    books.push(...booksForFixture);
    sourceSets.push(...setsForFixture);

    const loader = createContentLoader({ levels: [...levels], books: [...books], sourceSets: [...sourceSets], root });
    const validationLevels = [b1FixtureLevel, futureLevel];
    const valid = await validateContent({ root, levels: validationLevels, books: booksForFixture, sourceSets: setsForFixture });
    assert.deepEqual(valid.errors, [], valid.errors.join('\n'));

    const home = await renderPath('/', loader);
    assert.match(home, /Temporary Future Book/);
    assert.match(home, /Temporary Future Level Book/);
    const sharedLevel = await renderPath('/learn/b1', loader);
    assert.match(sharedLevel, /Books in this level/);
    assert.match(sharedLevel, /Temporary Future Book/);
    const newLevelPage = await renderPath('/learn/fixture-c1', loader);
    assert.match(newLevelPage, /Temporary Future Level Book/);
    for (const book of booksForFixture) {
      const bookPage = await renderPath(`/learn/${book.routeSlug}`, loader);
      assert.match(bookPage, new RegExp(book.title));
      assert.match(bookPage, /Explore the units/);
      assert.match(bookPage, /unit-01/);
      const unitPage = await renderPath(`/learn/${book.routeSlug}/unit-01`, loader);
      assert.match(unitPage, new RegExp(book.title));
      assert.match(unitPage, /Temporary sample/);
      assert.match(unitPage, /Fixture/);
      assert.match(unitPage, /Future%20book%20unit%201.mp3/);
      const normalized = await loader.getUnit(`${book.id}:unit:1`);
      assert.equal(normalized.passage.paragraphAudio[0].path, setsForFixture.find((set) => set.bookId === book.id).audioPathTemplate.replace('{number}', '1'));
      assert.equal(normalized.audioTiming.granularity, 'word');

      const units = await loader.listUnits(book.id);
      const sequence = buildLearningSequence(book.id, units, { reviewFrequency: book.reviewFrequency });
      const progressStore = createListeningProgressStore({ storage: new MapStorage(), scope: book.id });
      progressStore.setUnitCompleted(units[0].id, true);
      const bookProgress = deriveBookProgress(book.id, units, progressStore, { reviewFrequency: book.reviewFrequency });
      assert.equal(bookProgress.completedUnits, 1);
      assert.equal(bookProgress.totalUnits, 1);
      assert.equal(sequence[0].kind, 'unit');
      assert.equal(deriveLevelProgress([bookProgress]).percent, 100);
    }

    // The reusable validator must catch failures in content, media, references, relationships, and unit metadata.
    const sourceFile = path.join(root, setsForFixture[0].sourceFile);
    const audioFile = path.join(root, setsForFixture[0].audioPathTemplate.replace('{number}', '1'));
    const originalSource = unitSource('B1 Core', setsForFixture[0].audioPathTemplate.replace('{number}', '1'));
    const validate = () => validateContent({ root, levels: validationLevels, books: booksForFixture, sourceSets: setsForFixture });
    await writeFile(sourceFile, '{ malformed');
    assert.ok((await validate()).errors.some((message) => /parse|JSON|Unexpected/i.test(message)));
    await writeFile(sourceFile, JSON.stringify({ ...originalSource, unit_title: '' }));
    assert.ok((await validate()).errors.some((message) => /missing unit_title/.test(message)));
    await writeFile(sourceFile, JSON.stringify({ ...originalSource, unit_number: 0 }));
    assert.ok((await validate()).errors.some((message) => /unit_number must be a positive integer/.test(message)));
    await writeFile(sourceFile, JSON.stringify({ ...originalSource, audio_timing: { version: 1, granularity: 'word', segments: [] } }));
    assert.ok((await validate()).errors.some((message) => /invalid audio_timing/.test(message)));
    await writeFile(sourceFile, JSON.stringify(originalSource));
    await rm(audioFile);
    assert.ok((await validate()).errors.some((message) => /missing audio/.test(message)));
    await writeFile(audioFile, Buffer.from('temporary audio fixture'));
    const originalCover = booksForFixture[0].cover;
    booksForFixture[0].cover = { path: 'resources/covers/missing/cover.jpg', mediaType: 'image/jpeg' };
    assert.ok((await validate()).errors.some((message) => /broken asset reference/.test(message)));
    booksForFixture[0].cover = originalCover;
    booksForFixture[0].levelId = 'missing-level';
    assert.ok((await validate()).errors.some((message) => /unknown level/.test(message)));
    booksForFixture[0].levelId = 'b1';
    const originalSetLevel = setsForFixture[0].levelId;
    setsForFixture[0].levelId = 'fixture-c1';
    assert.ok((await validate()).errors.some((message) => /does not match its book/.test(message)));
    setsForFixture[0].levelId = originalSetLevel;
  } finally {
    if (b1Added) levels.find((item) => item.id === 'b1').bookIds = levels.find((item) => item.id === 'b1').bookIds.filter((id) => id !== futureBook.id);
    levels.splice(levels.length - levelsForFixture.length, levelsForFixture.length);
    books.splice(books.length - booksForFixture.length, booksForFixture.length);
    sourceSets.splice(sourceSets.length - setsForFixture.length, setsForFixture.length);
    for (const resourceType of ['structured', 'audio', 'covers']) {
      await rm(path.join(root, 'resources', resourceType, fixturePrefix), { recursive: true, force: true });
    }
  }
});

class MapStorage {
  data = new Map();
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, value); }
}

