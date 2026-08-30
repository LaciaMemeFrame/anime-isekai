// Процедурный музыкальный движок (WebAudio). Без внешних файлов.
// Каждая сцена получает свою тему: титул, мир, бой, босс, богиня, финал.

let ctx: AudioContext | null = null;
let musicMaster: GainNode | null = null;
let unlocked = false;
let volume = 0.16;
let schedulerId: ReturnType<typeof setInterval> | null = null;
let currentTrack: string | null = null;
let nextNoteTime = 0;
let stepIndex = 0;

function f(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      musicMaster = ctx.createGain();
      musicMaster.gain.value = volume;
      musicMaster.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  return ctx;
}

// ---------- инструменты ----------

function pad(midi: number, time: number, dur: number, vol: number) {
  const c = ac();
  if (!c || !musicMaster) return;
  const g = c.createGain();
  const flt = c.createBiquadFilter();
  flt.type = "lowpass";
  flt.frequency.value = 1400;
  flt.Q.value = 0.6;
  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(vol, time + Math.min(0.5, dur * 0.3));
  g.gain.linearRampToValueAtTime(0.0001, time + dur);
  for (const det of [-7, 0, 7]) {
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = f(midi);
    o.detune.value = det;
    o.connect(flt);
    o.start(time);
    o.stop(time + dur + 0.1);
  }
  flt.connect(g).connect(musicMaster);
}

function pluck(midi: number, time: number, vol: number, type: OscillatorType = "triangle") {
  const c = ac();
  if (!c || !musicMaster) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = f(midi);
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.32);
  o.connect(g).connect(musicMaster);
  o.start(time);
  o.stop(time + 0.4);
}

function lead(midi: number, time: number, dur: number, vol: number) {
  const c = ac();
  if (!c || !musicMaster) return;
  const o = c.createOscillator();
  const o2 = c.createOscillator();
  const g = c.createGain();
  o.type = "square";
  o2.type = "sawtooth";
  o.frequency.value = f(midi);
  o2.frequency.value = f(midi);
  o2.detune.value = 9;
  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(vol, time + 0.02);
  g.gain.linearRampToValueAtTime(vol * 0.6, time + dur * 0.7);
  g.gain.linearRampToValueAtTime(0.0001, time + dur);
  o.connect(g);
  o2.connect(g);
  g.connect(musicMaster);
  o.start(time);
  o2.start(time);
  o.stop(time + dur + 0.05);
  o2.stop(time + dur + 0.05);
}

function bass(midi: number, time: number, dur: number, vol: number) {
  const c = ac();
  if (!c || !musicMaster) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "triangle";
  o.frequency.value = f(midi);
  g.gain.setValueAtTime(vol, time);
  g.gain.linearRampToValueAtTime(vol * 0.4, time + dur);
  g.gain.linearRampToValueAtTime(0.0001, time + dur + 0.05);
  o.connect(g).connect(musicMaster);
  o.start(time);
  o.stop(time + dur + 0.1);
}

function kick(time: number, vol: number) {
  const c = ac();
  if (!c || !musicMaster) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(150, time);
  o.frequency.exponentialRampToValueAtTime(40, time + 0.12);
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
  o.connect(g).connect(musicMaster);
  o.start(time);
  o.stop(time + 0.2);
}

function snare(time: number, vol: number) {
  const c = ac();
  if (!c || !musicMaster) return;
  const len = Math.floor(c.sampleRate * 0.14);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const flt = c.createBiquadFilter();
  flt.type = "bandpass";
  flt.frequency.value = 1800;
  flt.Q.value = 0.8;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(flt).connect(g).connect(musicMaster);
  src.start(time);
}

function hat(time: number, vol: number) {
  const c = ac();
  if (!c || !musicMaster) return;
  const len = Math.floor(c.sampleRate * 0.04);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const flt = c.createBiquadFilter();
  flt.type = "highpass";
  flt.frequency.value = 7000;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(flt).connect(g).connect(musicMaster);
  src.start(time);
}

// ---------- темы ----------

interface TrackDef {
  bpm: number;
  chords: number[][]; // аккорды (midi), один на такт
  melody: (number | null)[]; // мелодия на 16-х, циклически
  arp: boolean;
  drums: "none" | "light" | "battle" | "boss";
  padVol: number;
  melodyVol: number;
  bassVol: number;
}

const TRACKS: Record<string, TrackDef> = {
  // Титул: мистический ля-минор, медленно
  title: {
    bpm: 72,
    chords: [
      [57, 60, 64, 67], // Am7
      [53, 57, 60, 64], // Fmaj7
      [55, 59, 62, 65], // G
      [52, 55, 59, 64], // Em7
    ],
    melody: [69, null, null, 72, null, 71, null, null, 69, null, 67, null, 64, null, null, null],
    arp: true,
    drums: "none",
    padVol: 0.05,
    melodyVol: 0.05,
    bassVol: 0.06,
  },
  // Мир: спокойный пентатонический, до-мажор
  world: {
    bpm: 84,
    chords: [
      [60, 64, 67, 72], // C
      [57, 60, 64, 69], // Am
      [62, 65, 69, 74], // Dm
      [55, 59, 62, 67], // G
    ],
    melody: [72, null, 74, null, 76, null, 74, null, 72, null, 69, null, 67, null, null, null],
    arp: true,
    drums: "light",
    padVol: 0.045,
    melodyVol: 0.045,
    bassVol: 0.055,
  },
  // Бой: драйвовый ми-минор
  battle: {
    bpm: 148,
    chords: [
      [52, 55, 59], // Em
      [50, 53, 57], // C
      [55, 59, 62], // G
      [57, 60, 64], // Am -> D
    ],
    melody: [64, null, 64, 67, null, 64, null, 62, 64, null, 67, null, 71, null, 69, 67],
    arp: true,
    drums: "battle",
    padVol: 0.03,
    melodyVol: 0.05,
    bassVol: 0.08,
  },
  // Босс: агрессивный, хроматика, быстро
  boss: {
    bpm: 168,
    chords: [
      [50, 53, 57], // C
      [49, 53, 56], // C#dim
      [52, 55, 59], // Em
      [46, 50, 53], // A#dim
    ],
    melody: [62, 62, null, 65, 62, null, 61, null, 62, 62, null, 65, 67, null, 65, 62],
    arp: true,
    drums: "boss",
    padVol: 0.035,
    melodyVol: 0.055,
    bassVol: 0.09,
  },
  // Богиня: воздушный, эфириал
  goddess: {
    bpm: 66,
    chords: [
      [60, 64, 67, 71], // Cmaj7
      [57, 60, 64, 69], // Am9
      [65, 69, 72, 76], // Fmaj7
      [62, 65, 69, 74], // Dm7
    ],
    melody: [76, null, null, 79, null, null, 76, null, 74, null, null, 72, null, null, null, null],
    arp: true,
    drums: "none",
    padVol: 0.055,
    melodyVol: 0.04,
    bassVol: 0.04,
  },
  // Финал: торжественный
  ending: {
    bpm: 96,
    chords: [
      [60, 64, 67, 72], // C
      [55, 59, 62, 67], // G
      [57, 60, 64, 69], // Am
      [53, 57, 60, 65], // F
    ],
    melody: [72, null, 74, 76, null, 79, null, 76, 74, null, 72, null, 74, null, null, null],
    arp: true,
    drums: "light",
    padVol: 0.05,
    melodyVol: 0.05,
    bassVol: 0.06,
  },
};

function scheduleStep(track: TrackDef, step: number, time: number) {
  const stepsPerBar = 16;
  const bar = Math.floor(step / stepsPerBar) % track.chords.length;
  const chord = track.chords[bar];
  const inBar = step % stepsPerBar;
  const root = chord[0];

  // Pad — в начале такта
  if (inBar === 0) {
    const dur = (60 / track.bpm) * 4;
    for (const m of chord) pad(m, time, dur * 0.95, track.padVol);
  }

  // Бас
  if (inBar === 0 || inBar === 8) bass(root - 12, time, 0.22, track.bassVol);
  else if (inBar === 4 || inBar === 12) bass(root - 12 + 7, time, 0.16, track.bassVol * 0.8);

  // Арпеджио — каждая 8-я
  if (track.arp && inBar % 2 === 0) {
    const tone = chord[(inBar / 2) % chord.length];
    pluck(tone + 12, time, track.melodyVol * 0.55);
  }

  // Мелодия
  const mNote = track.melody[step % track.melody.length];
  if (mNote !== null) lead(mNote, time, 0.24, track.melodyVol);

  // Ударные
  if (track.drums === "battle") {
    if (inBar === 0 || inBar === 8) kick(time, 0.5);
    if (inBar === 4 || inBar === 12) snare(time, 0.22);
    if (inBar % 2 === 0) hat(time, 0.06);
  } else if (track.drums === "boss") {
    if (inBar % 4 === 0) kick(time, 0.55);
    if (inBar === 4 || inBar === 12) snare(time, 0.26);
    hat(time, 0.05);
  } else if (track.drums === "light") {
    if (inBar === 0) kick(time, 0.3);
    if (inBar === 8) hat(time, 0.05);
  }
}

function scheduler() {
  const c = ac();
  if (!c) return;
  const track = currentTrack ? TRACKS[currentTrack] : null;
  if (!track) return;
  const secondsPerStep = 60 / track.bpm / 4; // 16-е
  while (nextNoteTime < c.currentTime + 0.3) {
    scheduleStep(track, stepIndex, nextNoteTime);
    nextNoteTime += secondsPerStep;
    stepIndex++;
  }
}

export function unlockMusic() {
  const c = ac();
  if (c && c.state === "suspended") c.resume().catch(() => undefined);
  // Если музыка уже разблокирована и играет — НЕ перезапускаем (иначе темы
  // наслаиваются при повторных вызовах unlockMusic с кнопок).
  if (unlocked) return;
  unlocked = true;
  // если тема была выбрана до разблокировки — запускаем её сейчас
  const pending = currentTrack;
  currentTrack = null;
  if (pending) setTrack(pending);
}

export function setTrack(name: string | null) {
  if (!unlocked) {
    currentTrack = name;
    return;
  }
  if (name === currentTrack) return;
  currentTrack = name;
  stepIndex = 0;
  const c = ac();
  if (c) nextNoteTime = c.currentTime + 0.1;
  if (schedulerId) {
    clearInterval(schedulerId);
    schedulerId = null;
  }
  if (name) {
    schedulerId = setInterval(scheduler, 40);
  }
}

export function setMusicVolume(v: number) {
  volume = v;
  if (musicMaster && ctx) {
    musicMaster.gain.setTargetAtTime(v, ctx.currentTime, 0.1);
  }
}

export function stopMusic() {
  setTrack(null);
}
