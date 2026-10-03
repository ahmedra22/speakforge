import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createListeningProgressStore } from '../src/features/listening/listening-progress.js';
import { createProgressSync, createSupabaseAuth, mergeProgress, progressToRows, rowsToProgress } from '../src/features/progress/progress-sync.js';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key), data };
}
function fakeAuth({ rows = [], failRead = false, failWrite = false } = {}) {
  const calls = [];
  let session = null;
  return {
    configured: true, calls,
    getSession: () => session,
    async restore() { session = { access_token: 'access', refresh_token: 'refresh', user: { id: 'learner-1', email: 'learner@example.com' } }; return session; },
    async api(path, options = {}) {
      calls.push({ path, options });
      if (options.method === 'POST') return { ok: !failWrite, async json() { return {}; } };
      return { ok: !failRead, async json() { return rows; } };
    },
    async signInWithGoogle() {}, async signOut() { session = null; },
  };
}
const completedRow = (unitId, state) => ({ unit_id: unitId, listens_count: state.listensCompleted ?? 0, passage_unlocked: state.passageUnlocked ?? false, completed: state.completed ?? false, vocabulary_progress: state.vocabulary ?? {}, speaking_progress: state.speaking ?? {}, grammar_completed: state.grammar?.completed ?? false, ai_practice_completed: state.aiPractice?.completed ?? false, review_completed: state.review?.completed ?? false, state });

test('unauthenticated progress remains local and the 3-listen reading unlock is unchanged', () => {
  const storage = memoryStorage(), store = createListeningProgressStore({ storage });
  store.recordCompletedListen('a2:unit:1');
  assert.equal(store.get('a2:unit:1').passageUnlocked, false);
  store.recordCompletedListen('a2:unit:1');
  assert.equal(store.get('a2:unit:1').passageUnlocked, false);
  store.recordCompletedListen('a2:unit:1');
  assert.equal(store.get('a2:unit:1').passageUnlocked, true);
  assert.equal(createListeningProgressStore({ storage }).get('a2:unit:1').listensCompleted, 3);
});

test('merge keeps valid monotonic listens, unlocks, vocabulary uses, speaking, grammar, reviews, and completion', () => {
  const merged = mergeProgress({ u: { listensCompleted: 2, vocabulary: { word: { uses: 2 } }, speaking: { p: { completed: false } }, grammar: { completed: false } } }, { u: { listensCompleted: 1, passageUnlocked: true, vocabulary: { word: { uses: 9 } }, speaking: { p: { completed: true } }, grammar: { completed: true }, review: { completed: true }, completed: true } });
  assert.equal(merged.u.listensCompleted, 2);
  assert.equal(merged.u.passageUnlocked, true);
  assert.equal(merged.u.vocabulary.word.uses, 5);
  assert.equal(merged.u.speaking.p.completed, true);
  assert.equal(merged.u.grammar.completed, true);
  assert.equal(merged.u.review.completed, true);
  assert.equal(merged.u.completed, true);
});

test('invalid or negative progress is clamped instead of propagating', () => {
  const merged = mergeProgress({ u: { listensCompleted: -1, vocabulary: { w: { uses: 100 } } } }, { u: { listensCompleted: 1.2, vocabulary: { x: { uses: -2 } } } });
  assert.equal(merged.u.listensCompleted, 0);
  assert.equal(merged.u.vocabulary.w.uses, 5);
  assert.equal(merged.u.vocabulary.x.uses, 0);
});

test('local progress hydrates with remote progress and uploads reconciled records by user and unit', async () => {
  const storage = memoryStorage(), store = createListeningProgressStore({ storage });
  store.recordCompletedListen('a2:unit:1'); store.recordVocabularyUse('a2:unit:1', 'hello');
  const auth = fakeAuth({ rows: [completedRow('a2:unit:1', { listensCompleted: 2, vocabulary: { hello: { uses: 4 }, remote: { uses: 1 } } }), completedRow('b1:unit:1', { completed: true })] });
  const states = [], sync = createProgressSync({ store, auth, storage, onState: state => states.push(state) });
  await sync.start();
  assert.equal(store.get('a2:unit:1').listensCompleted, 2);
  assert.equal(store.getVocabularyState('a2:unit:1', 'hello').uses, 4);
  assert.equal(store.getVocabularyState('a2:unit:1', 'remote').uses, 1);
  assert.equal(store.get('b1:unit:1').completed, true);
  assert.equal(auth.calls.filter(call => call.options.method === 'POST').length, 1);
  const payload = JSON.parse(auth.calls.find(call => call.options.method === 'POST').options.body);
  assert.equal(new Set(payload.map(row => `${row.user_id}:${row.unit_id}`)).size, payload.length);
  assert.ok(states.some(state => state.status === 'signed-in'));
});

test('two-device restoration hydrates remote state into a clean local cache', async () => {
  const storage = memoryStorage(), store = createListeningProgressStore({ storage });
  const auth = fakeAuth({ rows: [completedRow('b1:unit:1', { listensCompleted: 3, passageUnlocked: true, vocabulary: { word: { uses: 5 } }, speaking: { prompt: { completed: true } } })] });
  const sync = createProgressSync({ store, auth, storage }); await sync.start();
  assert.equal(store.get('b1:unit:1').passageUnlocked, true);
  assert.equal(store.getVocabularyState('b1:unit:1', 'word').learned, true);
  assert.equal(store.getSpeakingState('b1:unit:1', 'prompt').completed, true);
});

test('offline restore keeps local progress and reports a recoverable status', async () => {
  const storage = memoryStorage(), store = createListeningProgressStore({ storage });
  store.setUnitCompleted('a2:unit:1');
  const auth = fakeAuth({ failRead: true }), states = [];
  const sync = createProgressSync({ store, auth, storage, onState: state => states.push(state) }); await sync.start();
  assert.equal(store.get('a2:unit:1').completed, true);
  assert.ok(states.some(state => state.status === 'offline'));
});

test('progress mutations persist locally immediately and enqueue an idempotent composite-key upsert', async () => {
  const storage = memoryStorage(), store = createListeningProgressStore({ storage }), auth = fakeAuth();
  const sync = createProgressSync({ store, auth, storage }); await sync.start();
  store.recordCompletedListen('a2:unit:1');
  assert.equal(store.get('a2:unit:1').listensCompleted, 1);
  await sync.syncNow();
  const write = auth.calls.find(call => call.options.method === 'POST');
  assert.match(write.path, /on_conflict=user_id%2Cunit_id/);
  assert.match(write.options.headers.Prefer, /resolution=merge-duplicates/);
  assert.equal(JSON.parse(write.options.body)[0].listens_count, 1);
});

test('failed cloud writes retain local state and a later sync retries', async () => {
  const storage = memoryStorage(), store = createListeningProgressStore({ storage }), auth = fakeAuth({ failWrite: true }), states = [];
  const sync = createProgressSync({ store, auth, storage, onState: state => states.push(state) }); await sync.start();
  store.recordCompletedListen('a2:unit:1'); await sync.syncNow();
  assert.equal(store.get('a2:unit:1').listensCompleted, 1);
  assert.ok(states.some(state => state.status === 'offline'));
  await sync.syncNow();
  assert.ok(auth.calls.filter(call => call.options.method === 'POST').length >= 2);
});

test('auth loading does not replace or wipe the visible local snapshot', async () => {
  const storage = memoryStorage(), store = createListeningProgressStore({ storage });
  store.recordCompletedListen('a2:unit:1');
  let release;
  const auth = { ...fakeAuth(), async restore() { await new Promise(resolve => { release = resolve; }); return null; } };
  const sync = createProgressSync({ store, auth, storage });
  const starting = sync.start();
  assert.equal(store.get('a2:unit:1').listensCompleted, 1);
  release(); await starting;
  assert.equal(store.get('a2:unit:1').listensCompleted, 1);
});

test('logout returns to the preserved guest snapshot and retains the signed-in cache', async () => {
  const storage = memoryStorage(), store = createListeningProgressStore({ storage });
  store.recordCompletedListen('guest:unit:1');
  const auth = fakeAuth(), sync = createProgressSync({ store, auth, storage }); await sync.start();
  store.setUnitCompleted('account:unit:1');
  await sync.signOut();
  assert.equal(sync.getUserId(), null);
  assert.equal(store.get('guest:unit:1').listensCompleted, 1);
  assert.equal(store.get('account:unit:1').completed, false);
  assert.ok(storage.getItem('speakforge.progress.account.learner-1'));
});

test('a later account does not inherit a previously claimed account cache', async () => {
  const storage = memoryStorage(), store = createListeningProgressStore({ storage });
  store.recordCompletedListen('guest:unit:1');
  const auth = fakeAuth(), sync = createProgressSync({ store, auth, storage }); await sync.start();
  store.setUnitCompleted('account-a:unit:1'); await sync.signOut();
  auth.restore = async () => ({ access_token: 'other', user: { id: 'learner-2', email: 'other@example.com' } });
  const otherAccountSync = createProgressSync({ store, auth, storage });
  await otherAccountSync.start();
  assert.equal(store.get('account-a:unit:1').completed, false);
  assert.equal(store.get('guest:unit:1').listensCompleted, 0);
});

test('database row codec preserves all state fields and one user-unit row key', () => {
  const snapshot = { u: { listensCompleted: 3, passageUnlocked: true, vocabulary: { w: { uses: 5 } }, speaking: { p: { completed: true } }, grammar: { completed: true }, aiPractice: { completed: true }, completed: true }, __meta: { lastVisited: { href: '/learn/a2/unit-01', visitedAt: 10 } } };
  const rows = progressToRows('user', snapshot);
  assert.equal(new Set(rows.map(row => `${row.user_id}:${row.unit_id}`)).size, rows.length);
  const roundTrip = rowsToProgress(rows);
  assert.equal(roundTrip.u.listensCompleted, 3);
  assert.equal(roundTrip.u.vocabulary.w.uses, 5);
  assert.equal(roundTrip.u.speaking.p.completed, true);
  assert.equal(roundTrip.u.grammar.completed, true);
  assert.equal(roundTrip.u.aiPractice.completed, true);
  assert.equal(roundTrip.__meta.lastVisited.href, '/learn/a2/unit-01');
});

test('auth never exposes a service-role key and uses Google OAuth with the app return route', async () => {
  const storage = memoryStorage(), locationRef = { origin: 'https://speakforge.example', pathname: '/learn/a2', search: '?x=1', assign(url) { this.assigned = url; } };
  const auth = createSupabaseAuth({ url: 'https://project.supabase.co', anonKey: 'public-anon-key', storage, locationRef, fetchImpl: async () => ({ ok: false }) });
  assert.equal(auth.configured, true);
  await auth.signInWithGoogle();
  assert.match(locationRef.assigned, /provider=google/);
  assert.match(decodeURIComponent(locationRef.assigned), /redirect_to=https:\/\/speakforge.example\/learn\/a2\?x=1/);
  assert.doesNotMatch(locationRef.assigned, /service_role/i);
});

test('auth restores access and refresh tokens from local storage and supports sign out', async () => {
  const storage = memoryStorage({ 'speakforge.supabase.session': JSON.stringify({ access_token: 'token', refresh_token: 'refresh', expires_at: Math.floor(Date.now() / 1000) + 3600 }) });
  const calls = [], auth = createSupabaseAuth({ url: 'https://project.supabase.co', anonKey: 'public', storage, fetchImpl: async (url, options) => { calls.push({ url, options }); return { ok: true, async json() { return { id: 'learner' }; } }; } });
  const session = await auth.restore();
  assert.equal(session.user.id, 'learner');
  await auth.signOut();
  assert.equal(auth.getSession(), null);
  assert.ok(calls.some(call => call.url.endsWith('/auth/v1/user')));
});

test('migration enforces row ownership and composite user-unit uniqueness', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261003000000_create_progress.sql', import.meta.url), 'utf8');
  assert.match(sql, /primary key \(user_id, unit_id\)/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /for select to authenticated\s+using\s*\(\(select auth\.uid\(\)\) = user_id\)/i);
  assert.match(sql, /for insert to authenticated\s+with check\s*\(\(select auth\.uid\(\)\) = user_id\)/i);
  assert.match(sql, /for update to authenticated\s+using\s*\(\(select auth\.uid\(\)\) = user_id\)/i);
  assert.match(sql, /grant select, insert, update on table public\.progress to authenticated/i);
  assert.doesNotMatch(sql, /grant .* to anon/i);
});




test('progress entered during remote hydration is merged and queued instead of overwritten', async () => {
  const storage = memoryStorage(), store = createListeningProgressStore({ storage }), auth = fakeAuth();
  let release;
  auth.api = async (path, options = {}) => {
    auth.calls.push({ path, options });
    if (options.method === 'POST') return { ok: true };
    await new Promise(resolve => { release = resolve; });
    return { ok: true, async json() { return []; } };
  };
  const sync = createProgressSync({ store, auth, storage });
  const started = sync.start();
  await new Promise(resolve => setImmediate(resolve));
  store.recordCompletedListen('a2:unit:1');
  release();
  await started;
  assert.equal(store.get('a2:unit:1').listensCompleted, 1);
  await sync.syncNow();
  assert.ok(auth.calls.some(call => call.options.method === 'POST' && call.options.body.includes('a2:unit:1')));
});
test('server exposes only frontend-safe Supabase configuration and auth UI is present in shared HTML', async () => {
  const { createAppServer } = await import('../src/app/server.js');
  const { layout } = await import('../src/components/layout.js');
  const previousUrl = process.env.SUPABASE_URL, previousKey = process.env.SUPABASE_ANON_KEY, previousService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'public-anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'must-not-leak';
  const server = createAppServer();
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/config`);
    const config = await response.json();
    assert.deepEqual(config, { supabaseUrl: 'https://project.supabase.co', supabaseAnonKey: 'public-anon' });
    assert.doesNotMatch(JSON.stringify(config), /must-not-leak|service_role/i);
    const html = layout({ title: 'Test', description: 'Test', content: '' });
    assert.match(html, /data-auth-button/);
    assert.match(html, /data-auth-status/);
  } finally {
    await new Promise(resolve => server.close(resolve));
    if (previousUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previousKey;
    if (previousService === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previousService;
  }
});
test('OAuth callback failures and expired sessions become explicit auth errors', async () => {
  const callback = createSupabaseAuth({ url: 'https://project.supabase.co', anonKey: 'public', storage: memoryStorage(), locationRef: { hash: '#error=access_denied&error_description=cancelled', pathname: '/', search: '', origin: 'https://speakforge.example' }, fetchImpl: async () => ({ ok: false }) });
  await assert.rejects(callback.restore(), /Google sign-in was cancelled/);
  const expiredStorage = memoryStorage({ 'speakforge.supabase.session': JSON.stringify({ access_token: 'old', refresh_token: 'old-refresh', expires_at: 1 }) });
  const expired = createSupabaseAuth({ url: 'https://project.supabase.co', anonKey: 'public', storage: expiredStorage, fetchImpl: async () => ({ ok: false }) });
  await assert.rejects(expired.restore(), /session expired/);
  assert.equal(expiredStorage.getItem('speakforge.supabase.session'), null);
});
