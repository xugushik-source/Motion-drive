/**
 * A short engine "rev" built from oscillators (no audio file, no licence question).
 * Two throttle blips: idle → rev → dip → full rev → fade, about 2.6 s.
 */
export function buildRev(ctx: BaseAudioContext, out: AudioNode, t = 0) {
  const T = (s: number) => t + s;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, T(0));
  master.gain.exponentialRampToValueAtTime(0.5, T(0.15));
  master.gain.setValueAtTime(0.5, T(1.7));
  master.gain.exponentialRampToValueAtTime(0.0001, T(2.7));

  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++)
    curve[i] = Math.tanh((i / (curve.length - 1)) * 2 * 2.2 - 2.2);
  shaper.curve = curve;

  const low = ctx.createBiquadFilter();
  low.type = "lowpass";
  low.Q.value = 3;
  low.frequency.setValueAtTime(240, T(0));
  low.frequency.exponentialRampToValueAtTime(1500, T(0.6));
  low.frequency.exponentialRampToValueAtTime(500, T(0.85));
  low.frequency.exponentialRampToValueAtTime(2600, T(1.65));
  low.frequency.exponentialRampToValueAtTime(420, T(2.6));

  const high = ctx.createBiquadFilter();
  high.type = "highpass";
  high.frequency.value = 38;

  // cylinder "burble": amplitude flutter that speeds up with the revs
  const flutter = ctx.createGain();
  flutter.gain.value = 0.78;
  const lfo = ctx.createOscillator();
  lfo.frequency.setValueAtTime(13, T(0));
  lfo.frequency.exponentialRampToValueAtTime(34, T(0.6));
  lfo.frequency.exponentialRampToValueAtTime(18, T(0.85));
  lfo.frequency.exponentialRampToValueAtTime(46, T(1.65));
  lfo.frequency.exponentialRampToValueAtTime(15, T(2.6));
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.22;
  lfo.connect(lfoDepth).connect(flutter.gain);

  const comp = ctx.createDynamicsCompressor();
  low.connect(flutter);
  flutter.connect(shaper);
  shaper.connect(high);
  high.connect(comp);
  comp.connect(master);
  master.connect(out);

  const voices: [OscillatorType, number, number][] = [
    ["sawtooth", 1, 0.34],
    ["sawtooth", 1.012, 0.3],
    ["square", 0.5, 0.3],
  ];
  const pitch: [number, number][] = [
    [0, 46],
    [0.12, 54],
    [0.6, 150],
    [0.85, 82],
    [1.65, 235],
    [2.6, 66],
  ];
  const oscs = voices.map(([type, ratio, gain]) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(pitch[0][1] * ratio, T(0));
    for (const [s, f] of pitch.slice(1))
      o.frequency.exponentialRampToValueAtTime(f * ratio, T(s));
    const g = ctx.createGain();
    g.gain.value = gain;
    o.connect(g).connect(low);
    return o;
  });
  for (const o of [...oscs, lfo]) {
    o.start(T(0));
    o.stop(T(2.8));
  }
}

/** Must be called from a click or tap, otherwise browsers keep audio silent. */
export async function playRev() {
  const AC: typeof AudioContext | undefined =
    window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  const ctx = new AC();
  await ctx.resume();
  buildRev(ctx, ctx.destination, ctx.currentTime + 0.02);
  setTimeout(() => ctx.close().catch(() => {}), 3500);
}
