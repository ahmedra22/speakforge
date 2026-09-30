const speeds = [0.75, 1, 1.25, 1.5];
export function createAudioPreferences({ storage = globalThis.localStorage, scope = 'guest' } = {}) {
  const key = `speakforge.audio.v1.${scope}.speed`;
  return {
    getSpeed() { try { const speed = Number(storage?.getItem(key)); return speeds.includes(speed) ? speed : 1; } catch { return 1; } },
    setSpeed(value) { const speed = Number(value); if (!speeds.includes(speed)) return false; try { storage?.setItem(key, String(speed)); } catch {} return true; },
  };
}
