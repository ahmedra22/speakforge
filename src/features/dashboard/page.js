import { layout } from '../../components/layout.js';
import { buildLearningSequence } from '../../domain/progression.js';

const safeJson = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

export async function myLearningPage(loader){
  const [levels, books] = await Promise.all([loader.listLevels(), loader.listBooks()]);
  const availableBooks = books.filter(book => book.status === 'available');
  const dashboardBooks = [];
  for (const book of availableBooks) {
    const units = await loader.listUnits(book.id);
    const sequence = buildLearningSequence(book.id, units, { reviewFrequency: book.reviewFrequency ?? 3 });
    const level = levels.find(item => item.id === book.levelId);
    dashboardBooks.push({
      id: book.id,
      routeSlug: book.routeSlug,
      levelId: book.levelId,
      levelLabel: level?.label ?? book.levelId,
      title: book.title ?? level?.label ?? book.id,
      units: units.map(unit => ({ id: unit.id, number: unit.number, title: unit.title })),
      sequence: sequence.map(item => item.kind === 'unit'
        ? { kind: 'unit', id: item.id, title: item.unit.title, number: item.unit.number }
        : { kind: 'review', id: item.id, title: item.title, startUnit: item.startUnit, endUnit: item.endUnit, sourceUnits: item.sourceUnits }),
    });
  }

  const gate = `<section class="learning-auth-gate" data-learning-auth-gate><p class="eyebrow">Your learning dashboard</p><h1>Sign in to see your progress.</h1><p>Your units, reviews, and progress are linked to your Google account so you can continue across devices.</p><form method="get" action="/api/auth/google?next=%2Fmy-learning"><button class="auth-button" type="submit">Continue with Google</button></form></section>`;
  const learning = `<div data-learning-auth-content hidden><div class="page-container my-learning-page" data-my-learning-dashboard><script type="application/json" data-dashboard-context>${safeJson({ books: dashboardBooks })}</script><header class="my-learning-header"><p class="eyebrow">My Learning</p><h1>Your progress, in one place.</h1><p>Continue where you left off, review your progress, and see what comes next.</p></header><section class="dashboard-loading" data-dashboard-loading aria-live="polite"><p class="eyebrow">Loading your progress</p><p>Getting your learning data…</p></section><div data-dashboard-content hidden></div></div></div>`;
  return layout({title:'My Learning',description:'Track your SpeakForge progress, continue learning, and see what comes next.',active:'my-learning',content:`<div data-learning-auth-page>${gate}${learning}</div>`});
}
