// Крошечный WebAudio-синтезатор для игровых SFX. Без внешних файлов.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambientNodes: { stop: () => void } | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.32;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => undefined);
  return ctx;
}

export function unlockAudio() {
  ac();
}

export function setMuted(m: boolean) {
  muted = m;
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.32, ctx.currentTime, 0.05);
}

export function isMuted() {
  return muted;
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType = "sine",
  vol = 0.5,
  slideTo?: number,
  delay = 0
) {
  const c = ac();
  if (!c || !master || muted) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(dur: number, vol = 0.4, hp = 800, delay = 0) {
  const c = ac();
  if (!c || !master || muted) return;
  const t0 = c.currentTime + delay;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = hp;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

export const sfx = {
  ui() {
    tone(660, 0.07, "triangle", 0.25, 880);
  },
  slash() {
    noise(0.09, 0.3, 2400);
    tone(220, 0.08, "sawtooth", 0.12, 90);
  },
  slashBig() {
    noise(0.16, 0.4, 1400);
    tone(160, 0.16, "sawtooth", 0.2, 60);
  },
  hit() {
    tone(180, 0.07, "square", 0.2, 110);
    noise(0.05, 0.22, 1200);
  },
  crit() {
    tone(880, 0.12, "square", 0.22, 1400);
    noise(0.1, 0.3, 2000);
  },
  hurt() {
    tone(140, 0.22, "sawtooth", 0.32, 60);
    noise(0.14, 0.3, 500);
  },
  dash() {
    noise(0.14, 0.22, 3000);
    tone(500, 0.12, "sine", 0.12, 1200);
  },
  wave() {
    tone(700, 0.2, "sine", 0.22, 240);
    noise(0.12, 0.16, 2600);
  },
  ult() {
    tone(90, 0.7, "sawtooth", 0.3, 40);
    tone(1200, 0.5, "sine", 0.16, 200);
    noise(0.5, 0.3, 700);
  },
  pickup() {
    tone(920, 0.08, "triangle", 0.18, 1300);
  },
  crystal() {
    tone(1180, 0.1, "triangle", 0.2, 1660);
    tone(1660, 0.14, "triangle", 0.14, 2200, 0.05);
  },
  heart() {
    tone(520, 0.12, "sine", 0.22, 780);
    tone(780, 0.16, "sine", 0.18, 1040, 0.07);
  },
  levelup() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, "triangle", 0.22, undefined, i * 0.07));
  },
  join() {
    [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, "triangle", 0.2, undefined, i * 0.09));
  },
  gachaSpin() {
    for (let i = 0; i < 8; i++) tone(300 + i * 130, 0.06, "square", 0.1, undefined, i * 0.05);
  },
  gachaRare() {
    tone(880, 0.3, "triangle", 0.22, 1320);
  },
  gachaEpic() {
    [660, 880, 1100, 1320].forEach((f, i) => tone(f, 0.18, "triangle", 0.22, undefined, i * 0.06));
  },
  gachaLegend() {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.24, "triangle", 0.24, undefined, i * 0.08));
    noise(0.6, 0.16, 3000, 0.2);
  },
  bossRoar() {
    tone(70, 0.9, "sawtooth", 0.4, 40);
    tone(110, 0.8, "square", 0.2, 55, 0.05);
    noise(0.7, 0.3, 300);
  },
  bossDie() {
    tone(200, 1.2, "sawtooth", 0.35, 30);
    noise(1, 0.4, 250);
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.3, "triangle", 0.2, undefined, 0.7 + i * 0.1));
  },
  death() {
    tone(300, 0.9, "sawtooth", 0.3, 40);
    tone(200, 1.2, "sine", 0.2, 30, 0.1);
  },
  victory() {
    [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) =>
      tone(f, 0.24, "triangle", 0.22, undefined, i * 0.13)
    );
  },
  heartbeat() {
    tone(60, 0.12, "sine", 0.5, 40);
    tone(55, 0.1, "sine", 0.4, 38, 0.18);
  },
  truck() {
    noise(0.5, 0.5, 200);
    tone(90, 0.5, "sawtooth", 0.4, 40);
  },
  arrow() {
    tone(1400, 0.08, "triangle", 0.14, 700);
  },
  magic() {
    tone(980, 0.16, "sine", 0.16, 1500);
  },
  heal() {
    tone(620, 0.2, "sine", 0.18, 930);
    tone(930, 0.24, "sine", 0.14, 1240, 0.08);
  },
};

export function startAmbient() {
  const c = ac();
  if (!c || !master || ambientNodes) return;
  const g = c.createGain();
  g.gain.value = 0.028;
  const o1 = c.createOscillator();
  o1.type = "sine";
  o1.frequency.value = 110;
  const o2 = c.createOscillator();
  o2.type = "sine";
  o2.frequency.value = 165.2;
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.11;
  const lfoG = c.createGain();
  lfoG.gain.value = 0.014;
  lfo.connect(lfoG).connect(g.gain);
  o1.connect(g);
  o2.connect(g);
  g.connect(master);
  o1.start();
  o2.start();
  lfo.start();
  ambientNodes = {
    stop() {
      try {
        o1.stop();
        o2.stop();
        lfo.stop();
      } catch {
        /* noop */
      }
    },
  };
}
