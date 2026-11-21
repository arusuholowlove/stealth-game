// All sound is synthesised with WebAudio — no audio files, no network. Footsteps tell
// you where a guard is: the closer the guard, the louder the step.
export function createAudio() {
  let context = null;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return context;
    }
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      context = new AudioContextClass();
    } catch {
      context = null;
    }
    return context;
  }

  function blip(frequency, duration, type, volume) {
    const ctx = ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  function thud(volume) {
    const ctx = ensure();
    if (!ctx) return;
    const length = Math.floor(ctx.sampleRate * 0.07);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
  }

  return {
    unlock() {
      ensure();
    },
    stepPlayer(running) {
      thud(running ? 0.1 : 0.05);
    },
    stepGuard(distance) {
      const volume = Math.max(0, 0.22 * (1 - distance / 340));
      if (volume > 0.02) thud(volume);
    },
    spotted() {
      blip(620, 0.12, 'square', 0.08);
      setTimeout(() => blip(460, 0.18, 'square', 0.08), 110);
    },
    pickup() {
      blip(880, 0.09, 'sine', 0.1);
      setTimeout(() => blip(1320, 0.12, 'sine', 0.08), 80);
    },
    caught() {
      blip(220, 0.3, 'sawtooth', 0.1);
      setTimeout(() => blip(150, 0.4, 'sawtooth', 0.1), 180);
    },
    clear() {
      [523, 659, 784, 1047].forEach((freq, i) => {
        setTimeout(() => blip(freq, 0.22, 'sine', 0.09), i * 120);
      });
    },
  };
}
