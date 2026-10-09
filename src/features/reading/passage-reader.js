import { flattenTimingSegments, getActiveTimingSegment, validateAudioTiming } from '../../domain/audio-timing.js';

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};

// Fallback alignment for passages that do not yet have a word-level timing map.
// Real timing maps always take precedence; estimates distribute words over the audio
// duration, allowing click-to-seek and follow-along until precise alignment is added.
export function createEstimatedWordTiming(paragraphs, duration) {
  if (!Array.isArray(paragraphs) || !Number.isFinite(duration) || duration <= 0) return [];
  const tokens = [];
  paragraphs.forEach((paragraph, paragraphIndex) => {
    for (const text of String(paragraph).match(/\S+/g) ?? []) {
      const punctuationPause = /[.!?][”"'’)]?$/.test(text) ? 0.75 : /[,;:]$/.test(text) ? 0.35 : 0;
      const weight = Math.max(1, text.replace(/[^\p{L}\p{N}'’-]/gu, '').length) + punctuationPause;
      tokens.push({ id: `estimated-word-${tokens.length}`, text, paragraphIndex, weight });
    }
  });
  const totalWeight = tokens.reduce((sum, token) => sum + token.weight, 0);
  if (!totalWeight) return [];
  let elapsedWeight = 0;
  return tokens.map(token => {
    const start = duration * elapsedWeight / totalWeight;
    elapsedWeight += token.weight;
    const end = duration * elapsedWeight / totalWeight;
    return { ...token, start, end };
  });
}

export function mountPassageReader(root, { unit, audio, controller } = {}) {
  if (!root || !unit?.passage?.paragraphs) return null;
  root.replaceChildren();

  const header = el('div', 'passage-reader-heading');
  header.append(
    el('p', 'eyebrow', `Unit ${String(unit.number).padStart(2, '0')} · ${unit.title}`),
    el('h2', '', unit.passage.title ?? 'Reading passage')
  );
  root.append(header);

  const timing = unit.audioTiming;
  const check = validateAudioTiming(timing, {
    duration: audio?.duration,
    paragraphCount: unit.passage.paragraphs.length,
  });
  const hasExactTiming = Boolean(check.valid);
  const words = hasExactTiming
    ? flattenTimingSegments(timing)
    : createEstimatedWordTiming(unit.passage.paragraphs, audio?.duration);

  const toggle = el('button', 'button button-secondary', 'Follow Along on');
  toggle.type = 'button';
  toggle.setAttribute('aria-pressed', 'true');
  root.append(toggle);

  if (!hasExactTiming) {
    const note = el('p', 'reading-audio-note', 'Word highlighting and tap-to-play use estimated timing for this passage.');
    root.append(note);
  }

  const content = el('div', 'passage-content');
  root.append(content);
  unit.passage.paragraphs.forEach((paragraph, index) => {
    const p = el('p', 'passage-paragraph');
    const parts = words.filter(word => word.paragraphIndex === index);
    if (parts.length) {
      for (const word of parts) {
        const span = el('span', 'timed-word', word.text);
        span.dataset.timingId = word.id;
        span.tabIndex = 0;
        span.setAttribute('role', 'button');
        span.setAttribute('aria-label', `Play from ${word.text.replace(/[.,!?;:]$/, '')}`);
        const seekAndPlay = () => {
          controller?.seek(word.start);
          controller?.play();
        };
        span.addEventListener('click', seekAndPlay);
        span.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            seekAndPlay();
          }
        });
        p.append(span, document.createTextNode(' '));
      }
    } else {
      p.textContent = paragraph;
    }
    content.append(p);
  });

  let enabled = true;
  const update = () => {
    if (!enabled || !audio || !words.length) return;
    const active = getActiveTimingSegment({ version: 1, granularity: 'word', segments: words }, audio.currentTime);
    content.querySelectorAll('.timed-word.is-current').forEach(node => node.classList.remove('is-current'));
    if (active) content.querySelector(`[data-timing-id="${CSS.escape(active.id)}"]`)?.classList.add('is-current');
  };
  toggle.addEventListener('click', () => {
    enabled = !enabled;
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.textContent = enabled ? 'Follow Along on' : 'Follow Along off';
    if (!enabled) content.querySelectorAll('.timed-word.is-current').forEach(node => node.classList.remove('is-current'));
    else update();
  });
  audio?.addEventListener('timeupdate', update);
  audio?.addEventListener('seeked', update);
  update();

  return {
    destroy() {
      audio?.removeEventListener('timeupdate', update);
      audio?.removeEventListener('seeked', update);
    },
  };
}
