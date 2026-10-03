const MAX_LISTENS = 1_000_000;
const integer = (value, max = MAX_LISTENS) => Number.isInteger(value) && value >= 0 ? Math.min(value, max) : 0;
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const completedMap = (left, right) => Object.fromEntries([...new Set([...Object.keys(object(left)), ...Object.keys(object(right))])].map(key => [key, { completed: Boolean(object(left)[key]?.completed || object(right)[key]?.completed) }]));

export function mergeProgress(local = {}, remote = {}) {
  const result = {};
  for (const unitId of new Set([...Object.keys(object(local)), ...Object.keys(object(remote))])) {
    if (unitId === '__meta') continue;
    const a = object(local[unitId]), b = object(remote[unitId]);
    const vocabulary = {};
    for (const wordId of new Set([...Object.keys(object(a.vocabulary)), ...Object.keys(object(b.vocabulary))])) {
      const uses = Math.min(5, Math.max(integer(object(a.vocabulary)[wordId]?.uses, 5), integer(object(b.vocabulary)[wordId]?.uses, 5)));
      vocabulary[wordId] = { uses, targetUses: 5, learned: uses >= 5 };
    }
    const speaking = completedMap(a.speaking, b.speaking);
    const listensCompleted = Math.max(integer(a.listensCompleted), integer(b.listensCompleted));
    result[unitId] = {
      listensCompleted,
      passageUnlocked: Boolean(a.passageUnlocked || b.passageUnlocked || listensCompleted >= 3),
      completed: Boolean(a.completed || b.completed),
      vocabulary,
      speaking,
      grammar: { completed: Boolean(a.grammar?.completed || b.grammar?.completed) },
      aiPractice: { completed: Boolean(a.aiPractice?.completed || b.aiPractice?.completed) },
      review: { completed: Boolean(a.review?.completed || b.review?.completed) },
    };
  }
  const aVisit = object(local).__meta?.lastVisited, bVisit = object(remote).__meta?.lastVisited;
  const visit = [aVisit, bVisit].filter(Boolean).sort((a, b) => (Number(b.visitedAt) || 0) - (Number(a.visitedAt) || 0))[0];
  if (visit) result.__meta = { lastVisited: visit };
  return result;
}

export function rowsToProgress(rows = []) {
  const result = {};
  for (const row of rows) {
    if (!row?.unit_id) continue;
    if (row.unit_id === '__meta') { if (row.state?.lastVisited) result.__meta = { lastVisited: row.state.lastVisited }; continue; }
    const state = object(row.state);
    result[row.unit_id] = {
      ...state,
      listensCompleted: Math.max(integer(state.listensCompleted), integer(row.listens_count)),
      passageUnlocked: Boolean(state.passageUnlocked || row.passage_unlocked),
      completed: Boolean(state.completed || row.completed),
      vocabulary: { ...object(state.vocabulary), ...object(row.vocabulary_progress) },
      speaking: { ...object(state.speaking), ...object(row.speaking_progress) },
      grammar: { completed: Boolean(state.grammar?.completed || row.grammar_completed) },
      aiPractice: { completed: Boolean(state.aiPractice?.completed || row.ai_practice_completed) },
      review: { completed: Boolean(state.review?.completed || row.review_completed) },
    };
  }
  return result;
}

export function progressToRows(userId, snapshot, now = new Date().toISOString()) {
  return Object.entries(object(snapshot)).map(([unitId, raw]) => {
    const state = object(raw);
    return {
      user_id: userId,
      unit_id: unitId,
      listens_count: integer(state.listensCompleted),
      passage_unlocked: Boolean(state.passageUnlocked || integer(state.listensCompleted) >= 3),
      completed: Boolean(state.completed),
      vocabulary_progress: object(state.vocabulary),
      speaking_progress: object(state.speaking),
      grammar_completed: Boolean(state.grammar?.completed),
      ai_practice_completed: Boolean(state.aiPractice?.completed),
      review_completed: Boolean(state.review?.completed),
      state: unitId === '__meta' ? { lastVisited: state.lastVisited } : state,
      updated_at: now,
    };
  });
}

export function createSupabaseAuth({ url, anonKey, storage = globalThis.localStorage, fetchImpl = globalThis.fetch, locationRef = globalThis.location, sessionKey = 'speakforge.supabase.session' }) {
  let session = null;
  const listeners = new Set();
  const emit = (event = 'INITIAL_SESSION') => { for (const listener of listeners) { try { listener(event, session); } catch {} } };
  const save = value => { session = value; try { value ? storage?.setItem(sessionKey, JSON.stringify(value)) : storage?.removeItem(sessionKey); } catch {} emit('SIGNED_IN'); };
  const configured = Boolean(url && anonKey);
  const request = (path, options = {}) => fetchImpl(`${url.replace(/\/$/, '')}/auth/v1/${path}`, { ...options, headers: { apikey: anonKey, 'content-type': 'application/json', ...(options.headers ?? {}) } });
  const readStored = () => { try { const value = JSON.parse(storage?.getItem(sessionKey) ?? 'null'); return value && typeof value.access_token === 'string' ? value : null; } catch { return null; } };
  async function restore() {
    if (!configured) return null;
    const hash = new URLSearchParams(locationRef?.hash?.replace(/^#/, '') ?? '');
    const accessToken = hash.get('access_token'), refreshToken = hash.get('refresh_token');
    if (hash.has('error') || hash.has('error_description') || hash.has('error_code')) {
      try { history.replaceState(null, '', locationRef.pathname + locationRef.search); } catch {}
      throw new Error('Google sign-in was cancelled or could not be completed.');
    }
    if (accessToken && refreshToken) {
      const expiresIn = Number(hash.get('expires_in')) || 3600;
      save({ access_token: accessToken, refresh_token: refreshToken, expires_at: Math.floor(Date.now() / 1000) + expiresIn });
      try { history.replaceState(null, '', `${locationRef.pathname}${locationRef.search}`); } catch {}
    } else session = readStored();
    if (!session) { emit(); return null; }
    if (Number(session.expires_at) && session.expires_at < Math.floor(Date.now() / 1000) + 60) {
      try {
        const response = await request('token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: session.refresh_token }) });
        if (!response.ok) throw new Error('Your sign-in session expired. Please sign in again.');
        const refreshed = await response.json();
        save({ ...refreshed, expires_at: Math.floor(Date.now() / 1000) + (Number(refreshed.expires_in) || 3600) });
      } catch { save(null); throw new Error('Your sign-in session expired. Please sign in again.'); }
    }
    try {
      const response = await request('user', { headers: { authorization: `Bearer ${session.access_token}` } });
      if (!response.ok) throw new Error('Could not restore sign-in session.');
      session = { ...session, user: await response.json() }; save(session); return session;
    } catch { save(null); throw new Error('Could not restore your sign-in session. Please sign in again.'); }
  }
  return {
    configured,
    getSession: () => session,
    onAuthStateChange(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    restore,
    async signInWithGoogle() {
      if (!configured) throw new Error('Cloud progress is not configured yet.');
      const redirectTo = `${locationRef.origin}${locationRef.pathname}${locationRef.search}`;
      const params = new URLSearchParams({ provider: 'google', redirect_to: redirectTo, apikey: anonKey, response_type: 'token' });
      locationRef.assign(`${url.replace(/\/$/, '')}/auth/v1/authorize?${params}`);
    },
    async signOut() {
      const current = session;
      if (current) { try { await request('logout', { method: 'POST', headers: { authorization: `Bearer ${current.access_token}` } }); } catch {} }
      save(null);
    },
    async api(path, options = {}) {
      if (!session?.access_token) throw new Error('Authentication is required.');
      return fetchImpl(`${url.replace(/\/$/, '')}/rest/v1/${path}`, { ...options, headers: { apikey: anonKey, authorization: `Bearer ${session.access_token}`, 'content-type': 'application/json', ...(options.headers ?? {}) } });
    },
  };
}

export function createProgressSync({ store, auth, storage = globalThis.localStorage, onState = () => {}, retryDelay = 300, setTimer = setTimeout, clearTimer = clearTimeout }) {
  const guestKey = 'speakforge.progress.guest-cache';
  const claimKey = 'speakforge.progress.claimed-user';
  const cacheKey = userId => `speakforge.progress.account.${userId}`;
  let activeUserId = null, started = false, hydrating = false, timer = null, retryTimer = null, writeChain = Promise.resolve();
  const dirty = new Set();
  const changedDuringHydrate = new Set();
  const safeRead = key => { try { return JSON.parse(storage?.getItem(key) ?? 'null'); } catch { return null; } };
  const safeWrite = (key, value) => { try { storage?.setItem(key, JSON.stringify(value)); } catch {} };
  const notify = (status, message = '') => { try { onState({ status, message, user: auth.getSession()?.user ?? null }); } catch {} };
  const queue = unitId => {
    if (!activeUserId || !unitId) return;
    if (hydrating) { changedDuringHydrate.add(unitId); return; }
    dirty.add(unitId);
    if (timer) clearTimer(timer);
    timer = setTimer(() => { timer = null; void flush(); }, retryDelay);
  };
  const flush = async () => {
    if (!activeUserId || !dirty.size) return;
    const userId = activeUserId;
    const snapshot = store.exportData();
    const ids = [...dirty]; dirty.clear();
    const selected = Object.fromEntries(ids.filter(id => Object.hasOwn(snapshot, id)).map(id => [id, snapshot[id]]));
    const body = progressToRows(userId, selected);
    writeChain = writeChain.catch(() => {}).then(async () => {
      if (!body.length || activeUserId !== userId) return;
      const response = await auth.api('progress?on_conflict=user_id%2Cunit_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error('Cloud save is temporarily unavailable. Your progress is saved on this device.');
    });
    try { await writeChain; safeWrite(cacheKey(userId), snapshot); notify('signed-in'); }
    catch (error) { for (const id of ids) dirty.add(id); notify('offline', error.message); }
  };
  const switchToGuest = () => {
    if (activeUserId) safeWrite(cacheKey(activeUserId), store.exportData());
    activeUserId = null;
    const guest = safeRead(guestKey);
    if (guest) store.replaceData(guest);
  };
  const onSession = async (session, force = false) => {
    const userId = session?.user?.id;
    if (!userId) { switchToGuest(); notify('signed-out'); return; }
    if (activeUserId === userId && !force) return;
    if (activeUserId) safeWrite(cacheKey(activeUserId), store.exportData());
    const current = store.exportData();
    if (!safeRead(guestKey) && !activeUserId) safeWrite(guestKey, current);
    const claimed = safeRead(claimKey);
    let local = safeRead(cacheKey(userId));
    if (!local && (!claimed || claimed === userId)) local = current;
    if (!local) local = {};
    store.replaceData(local);
    activeUserId = userId;
    if (!claimed) safeWrite(claimKey, userId);
    hydrating = true;
    notify('syncing');
    try {
      const response = await auth.api('progress?select=unit_id,listens_count,passage_unlocked,completed,vocabulary_progress,speaking_progress,grammar_completed,ai_practice_completed,review_completed,state');
      if (!response.ok) throw new Error('Cloud progress could not be loaded. Local progress is still available.');
      const remoteRows = await response.json();
      const latestLocal = mergeProgress(local, store.exportData());
      const merged = mergeProgress(latestLocal, rowsToProgress(remoteRows));
      store.replaceData(merged);
      safeWrite(cacheKey(userId), merged);
      safeWrite(claimKey, claimed || userId);
      const allRows = progressToRows(userId, merged);
      if (allRows.length) {
        const uploaded = await auth.api('progress?on_conflict=user_id%2Cunit_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(allRows) });
        if (!uploaded.ok) throw new Error('Cloud progress could not be saved yet. Local progress is still available.');
      }
      if (retryTimer) clearTimer(retryTimer);
      retryTimer = null;
      notify('signed-in');
    } catch (error) {
      store.replaceData(mergeProgress(local, store.exportData()));
      safeWrite(cacheKey(userId), store.exportData());
      notify('offline', error.message);
      if (typeof window !== 'undefined' && !retryTimer) retryTimer = setTimer(() => { retryTimer = null; void onSession(auth.getSession(), true); }, 15000);
    } finally {
      hydrating = false;
      for (const id of changedDuringHydrate) queue(id);
      changedDuringHydrate.clear();
    }
  };
  return {
    async start() {
      if (started) return;
      started = true;
      if (!auth.configured) { notify('unconfigured'); return; }
      notify('loading');
      store.subscribe(event => { if (event?.unitId) queue(event.unitId); });
      try { await onSession(await auth.restore()); }
      catch (error) { notify('error', error.message); }
      if (globalThis.addEventListener) globalThis.addEventListener('online', () => void flush());
    },
    async signIn() { return auth.signInWithGoogle(); },
    async signOut() { await auth.signOut(); await onSession(null); },
    async syncNow() { await flush(); },
    getUserId: () => activeUserId,
    getStatus: () => activeUserId ? 'signed-in' : auth.configured ? 'signed-out' : 'unconfigured',
  };
}










