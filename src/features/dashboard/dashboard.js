import {deriveSequenceProgress} from '/progression.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

const unitHref = (book, number) => `/learn/${book.routeSlug}/unit-${String(number).padStart(2, '0')}`;
const reviewHref = (book, item) => `/learn/${book.routeSlug}/review-${String(item.startUnit).padStart(2, '0')}-${String(item.endUnit).padStart(2, '0')}`;
const itemHref = (book, item) => item?.kind === 'review' ? reviewHref(book, item) : unitHref(book, item?.number);
const itemLabel = item => item?.kind === 'review' ? item.title : item?.title ? `Unit ${String(item.number).padStart(2, '0')} · ${item.title}` : 'Continue learning';

function renderOverall({completed,total}) {
  const percent = total ? Math.round(completed / total * 100) : 0;
  return `<section class="dashboard-overview"><div><p class="eyebrow">Overall progress</p><h2>${percent}% complete</h2><p>${completed} of ${total} units completed.</p></div><div class="dashboard-progress" role="progressbar" aria-label="Overall unit completion" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${completed}"><span style="width:${percent}%"></span></div></section>`;
}

function renderContinue(book, item, label) {
  if (!book || !item) return '';
  return `<section class="dashboard-continue"><div><p class="eyebrow">Continue Learning</p><h2>${escapeHtml(label)}</h2><p>${escapeHtml(item.kind === 'review' ? 'Review checkpoint' : book.title)}</p></div><a class="button button-primary" data-learning-entry href="${escapeHtml(itemHref(book, item))}">Continue</a></section>`;
}

function renderBook(book, result) {
  const percent = result.percent;
  const next = result.nextItem;
  const nextLabel = next ? itemLabel(next) : 'All units complete';
  const nextHref = next ? itemHref(book, next) : null;
  return `<article class="dashboard-book-card"><div class="dashboard-book-top"><div><p class="eyebrow">${escapeHtml(book.levelLabel)}</p><h3>${escapeHtml(book.title)}</h3></div><strong>${percent}%</strong></div><p class="dashboard-book-count">${result.completedUnits}/${result.totalUnits} units completed</p><div class="dashboard-progress small" role="progressbar" aria-label="${escapeHtml(book.title)} progress" aria-valuemin="0" aria-valuemax="${result.totalUnits}" aria-valuenow="${result.completedUnits}"><span style="width:${percent}%"></span></div>${nextHref ? `<a class="dashboard-next" data-learning-entry href="${escapeHtml(nextHref)}">Next: ${escapeHtml(nextLabel)} <span aria-hidden="true">→</span></a>` : '<p class="dashboard-complete">Book complete</p>'}</article>`;
}

function renderDashboard(root, data, progressStore) {
  const saved = progressStore.getLastVisited();
  const results = data.books.map(book => ({book, result: deriveSequenceProgress(book.sequence, book.units, progressStore, {lastVisitedId:saved?.itemId})}));
  const completed = results.reduce((sum, item) => sum + item.result.completedUnits, 0);
  const total = results.reduce((sum, item) => sum + item.result.totalUnits, 0);
  const savedBook = saved ? results.find(({book}) => book.id === saved.bookId) : null;
  const savedItem = savedBook?.result.sequence.find(item => item.id === saved.itemId && item.status !== 'locked') ?? null;
  const fallback = results.find(({result}) => result.nextItem)?.result.nextItem ? results.find(({result}) => result.nextItem) : null;
  const continueBook = savedItem ? savedBook.book : fallback?.book;
  const continueItem = savedItem ?? fallback?.result.nextItem ?? null;
  root.querySelector('[data-dashboard-loading]')?.remove();
  const content = root.querySelector('[data-dashboard-content]');
  if (!content) return;
  content.innerHTML = `${renderOverall({completed,total})}${renderContinue(continueBook, continueItem, continueItem ? itemLabel(continueItem) : 'Start your first unit')}${results.length ? `<section class="dashboard-section"><div class="section-heading"><div><p class="eyebrow">Your books</p><h2>Learning progress</h2></div><p class="muted">See what is complete and what comes next.</p></div><div class="dashboard-book-grid">${results.map(({book,result}) => renderBook(book,result)).join('')}</div></section>` : '<section class="dashboard-empty"><h2>No available books yet.</h2><p>New learning content will appear here as it becomes available.</p></section>'}`;
  content.hidden=false;
}

export async function mountDashboard(root,{progressStore}){
  try{
    const response=await fetch('/api/my-learning/context');
    if(!response.ok) throw new Error('Could not load learning context.');
    const data=await response.json();
    renderDashboard(root,data,progressStore);
  }catch{
    root.querySelector('[data-dashboard-loading]')?.replaceChildren(Object.assign(document.createElement('p'),{textContent:'Your learning dashboard could not load. Refresh to try again.'}));
  }
}
