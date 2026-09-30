const SPEEDS = [0.75, 1, 1.25, 1.5];
const REPEATS = [1, 2, 3, 5];

export const formatAudioTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

export function isEditableTarget(target) {
  return Boolean(target?.closest?.('input, textarea, select, [role="textbox"], [contenteditable]:not([contenteditable="false"])'));
}

export function handleAudioShortcut(event, controller) {
  if (isEditableTarget(event.target) || event.target?.closest?.('button, a, summary')) return false;
  if (event.code === 'Space') { event.preventDefault(); controller.toggle(); return true; }
  if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
    event.preventDefault();
    controller.seekBy(event.code === 'ArrowLeft' ? -5 : 5);
    return true;
  }
  return false;
}

export function createAudioController({ audio, preferences, onChange = () => {} }) {
  const initialSpeed = preferences?.getSpeed?.() ?? 1;
  let lastAudibleVolume = audio?.volume > 0 ? audio.volume : 0.8;
  const state = {
    status: audio ? 'loading' : 'error', error: audio ? null : 'Audio unavailable for this unit.',
    currentTime: audio?.currentTime ?? 0,
    duration: Number.isFinite(audio?.duration) ? audio.duration : NaN,
    volume: audio?.volume ?? 1, muted: audio?.muted ?? false,
    playbackRate: SPEEDS.includes(initialSpeed) ? initialSpeed : 1,
    repeatCount: 1, repeatsRemaining: 0, sequenceStarted: false,
  };
  if (audio) audio.playbackRate = state.playbackRate;
  const publish = () => onChange({ ...state });
  const setStatus = (status, error = null) => { state.status = status; state.error = error; publish(); };
  const onMetadata = () => {
    state.duration = Number.isFinite(audio.duration) ? audio.duration : NaN;
    state.currentTime = audio.currentTime || 0;
    if (state.status === 'loading') state.status = 'ready';
    publish();
  };
  const onCanPlay = () => { if (state.status === 'loading') state.status = 'ready'; publish(); };
  const onTime = () => {
    state.currentTime = audio.currentTime || 0;
    if (Number.isFinite(audio.duration)) state.duration = audio.duration;
    publish();
  };
  const onPlay = () => setStatus('playing');
  const onPause = () => { if (!['ended', 'error'].includes(state.status)) setStatus('paused'); };
  const onEnded = async () => {
    if (state.repeatsRemaining > 0) {
      state.repeatsRemaining -= 1;
      try { audio.currentTime = 0; state.currentTime = 0; publish(); await audio.play(); }
      catch { state.sequenceStarted = false; setStatus('error', 'Playback could not restart. Check the audio and try again.'); }
      return;
    }
    state.sequenceStarted = false;
    state.repeatsRemaining = 0;
    setStatus('ended');
  };
  const onError = () => {
    state.sequenceStarted = false;
    setStatus('error', 'Audio unavailable for this unit. The audio file could not be loaded or played.');
  };
  if (audio) {
    audio.addEventListener('loadedmetadata', onMetadata);
    audio.addEventListener('durationchange', onMetadata);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
  }
  async function play() {
    if (!audio || state.status === 'error') return false;
    if (!state.sequenceStarted) { state.repeatsRemaining = state.repeatCount - 1; state.sequenceStarted = true; }
    try { await audio.play(); return true; }
    catch { state.sequenceStarted = false; setStatus('error', 'Playback could not start. Your browser may have blocked audio playback.'); return false; }
  }
  return {
    getState: () => ({ ...state }),
    play,
    pause() { audio?.pause(); },
    async toggle() { if (!audio) return false; if (audio.paused || audio.ended) return play(); audio.pause(); return true; },
    seek(time) {
      if (!audio || !Number.isFinite(time)) return;
      const max = Number.isFinite(audio.duration) ? audio.duration : Math.max(0, time);
      audio.currentTime = Math.min(Math.max(0, time), max); state.currentTime = audio.currentTime; publish();
    },
    seekBy(delta) { this.seek((audio?.currentTime ?? 0) + delta); },
    setSpeed(value) {
      const speed = Number(value);
      if (!audio || !SPEEDS.includes(speed)) return false;
      state.playbackRate = speed; audio.playbackRate = speed;
      try { preferences?.setSpeed?.(speed); } catch {}
      publish(); return true;
    },
    setRepeat(value) { const count = Number(value); if (!REPEATS.includes(count)) return false; state.repeatCount = count; publish(); return true; },
    async repeatFromBeginning() {
      if (!audio) return false;
      try { audio.currentTime = 0; state.currentTime = 0; state.sequenceStarted = false; state.repeatsRemaining = 0; publish(); return await play(); }
      catch { state.sequenceStarted = false; setStatus('error', 'Could not restart this audio.'); return false; }
    },
    setVolume(value) {
      if (!audio) return;
      const volume = Math.max(0, Math.min(1, Number(value)));
      audio.volume = volume; audio.muted = volume === 0;
      if (volume > 0) lastAudibleVolume = volume;
      state.volume = volume; state.muted = audio.muted; publish();
    },
    toggleMute() {
      if (!audio) return;
      if (audio.muted || audio.volume === 0) {
        audio.muted = false; if (audio.volume === 0) audio.volume = lastAudibleVolume;
        state.volume = audio.volume; state.muted = false;
      } else { lastAudibleVolume = audio.volume; audio.muted = true; state.muted = true; }
      publish();
    },
    dispose() {
      if (!audio) return;
      audio.removeEventListener('loadedmetadata', onMetadata); audio.removeEventListener('durationchange', onMetadata);
      audio.removeEventListener('canplay', onCanPlay); audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('play', onPlay); audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded); audio.removeEventListener('error', onError);
    },
  };
}

export function mountAudioPlayer(root, { preferences, onStatus = () => {} } = {}) {
  const audio = root.querySelector('audio');
  if (!audio) return null;
  const controls = {
    play: root.querySelector('[data-action="play"]'), status: root.querySelector('[data-audio-status]'),
    seek: root.querySelector('[data-action="seek"]'), current: root.querySelector('[data-current-time]'),
    duration: root.querySelector('[data-duration]'), volume: root.querySelector('[data-action="volume"]'),
    mute: root.querySelector('[data-action="mute"]'), speed: [...root.querySelectorAll('[data-speed]')],
    repeat: [...root.querySelectorAll('[data-repeat]')],
  };
  const render = (state) => {
    controls.status.textContent = ({ loading: 'Loading audio…', ready: 'Ready to play', playing: 'Playing', paused: 'Paused', ended: 'Playback ended', error: state.error ?? 'Audio unavailable for this unit.' })[state.status];
    controls.status.dataset.state = state.status;
    controls.play.textContent = state.status === 'playing' ? 'Pause' : 'Play';
    controls.play.setAttribute('aria-label', state.status === 'playing' ? 'Pause unit audio' : 'Play unit audio');
    controls.seek.max = Number.isFinite(state.duration) ? String(state.duration) : '0';
    controls.seek.value = String(state.currentTime);
    controls.seek.disabled = !Number.isFinite(state.duration) || state.status === 'error';
    controls.current.textContent = formatAudioTime(state.currentTime);
    controls.duration.textContent = formatAudioTime(state.duration);
    controls.volume.value = String(state.volume);
    controls.mute.textContent = state.muted ? 'Unmute' : 'Mute';
    controls.mute.setAttribute('aria-label', state.muted ? 'Unmute audio' : 'Mute audio');
    for (const button of controls.speed) button.setAttribute('aria-pressed', String(Number(button.dataset.speed) === state.playbackRate));
    for (const button of controls.repeat) button.setAttribute('aria-pressed', String(Number(button.dataset.repeat) === state.repeatCount));
    onStatus(state);
  };
  const controller = createAudioController({ audio, preferences, onChange: render });
  const shortcuts = (event) => handleAudioShortcut(event, controller);
  document.addEventListener('keydown', shortcuts);
  controls.play.addEventListener('click', () => controller.toggle());
  controls.seek.addEventListener('input', () => controller.seek(Number(controls.seek.value)));
  controls.volume.addEventListener('input', () => controller.setVolume(Number(controls.volume.value)));
  controls.mute.addEventListener('click', () => controller.toggleMute());
  for (const button of controls.speed) button.addEventListener('click', () => controller.setSpeed(button.dataset.speed));
  for (const button of controls.repeat) button.addEventListener('click', () => controller.setRepeat(button.dataset.repeat));
  root.querySelector('[data-action="restart"]')?.addEventListener('click', () => controller.repeatFromBeginning());
  if (audio.readyState >= 1) render({ ...controller.getState(), duration: Number.isFinite(audio.duration) ? audio.duration : NaN, status: 'ready' });
  else render(controller.getState());
  return { controller, destroy() { document.removeEventListener('keydown', shortcuts); controller.dispose(); } };
}

