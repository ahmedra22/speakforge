import { escapeHtml } from '../app/html.js';

function audioUrl(audioPath) {
  const relativePath = audioPath.replace(/^resources\/audio\//, '');
  return `/audio/${relativePath.split('/').map(encodeURIComponent).join('/')}`;
}

export function renderAudioPlayer({ audio, label = 'Unit Audio' }) {
  if (!audio?.path) return `<div class="audio-unavailable" role="status">Audio unavailable for this unit.</div>`;
  const src = audioUrl(audio.path);
  return `<section class="audio-player" data-audio-player aria-label="${escapeHtml(label)}">
    <div class="audio-player-heading"><div><p class="eyebrow">Unit audio</p><h2>${escapeHtml(label)}</h2></div><span class="audio-state-dot" aria-hidden="true"></span></div>
    <audio preload="metadata" playsinline src="${escapeHtml(src)}"></audio>
    <p class="audio-live-status" data-audio-status role="status" aria-live="polite">Loading audio…</p>
    <div class="audio-controls">
      <div class="timeline-row"><button class="audio-button play-button" data-action="play" type="button" aria-label="Play unit audio">Play</button><span class="audio-time" data-current-time>0:00</span><input class="audio-range seek-range" data-action="seek" aria-label="Seek in unit audio" type="range" min="0" max="0" step="0.1" value="0" disabled><span class="audio-time" data-duration>--:--</span></div>
      <div class="audio-options"><div class="volume-control"><button class="audio-button text-button" data-action="mute" type="button" aria-label="Mute audio">Mute</button><input class="audio-range volume-range" data-action="volume" aria-label="Audio volume" type="range" min="0" max="1" step="0.05" value="1"></div>
        <div class="control-group" aria-label="Playback speed"><span class="control-label">Speed</span><div class="segmented-control">${[0.75, 1, 1.25, 1.5].map(speed => `<button class="segment-button" data-speed="${speed}" type="button" aria-pressed="${speed === 1}" aria-label="Playback speed ${speed} times">${speed}×</button>`).join('')}</div></div>
        <div class="control-group" aria-label="Repeat count"><span class="control-label">Repeat</span><div class="segmented-control">${[1, 2, 3, 5].map(count => `<button class="segment-button" data-repeat="${count}" type="button" aria-pressed="${count === 1}" aria-label="Repeat audio ${count} ${count === 1 ? 'time' : 'times'}">${count}×</button>`).join('')}</div></div>
        <button class="audio-button restart-button" data-action="restart" type="button">Repeat from the beginning</button>
      </div>
    </div>
    <p class="audio-shortcut-hint">Keyboard: Space to play or pause · ← / → to seek 5 seconds</p>
  </section>`;
}
