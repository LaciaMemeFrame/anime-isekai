// Титульный экран + заставка (смерть героя) + сцена с богиней.

import { useEffect, useRef, useState } from "react";
import { drawChibi, drawGoddess } from "../game/sprites";
import { CLASSES } from "../game/data";
import { sfx, unlockAudio, isMuted, setMuted } from "../game/audio";
import { unlockMusic } from "../game/music";

// ---------- аниме key-art (сгенерированные фоны) ----------
export const ART = {
  landscape: "https://image.qwenlm.ai/generated-images/31ac0ede-4285-4756-903d-69a61ce49b00/_result.png",
  goddess: "https://image.qwenlm.ai/generated-images/3c2540c4-f68d-4ce8-a59c-ed084de7e10e/_result.png",
  hero: "https://image.qwenlm.ai/generated-images/605232c2-4880-429c-95d4-f564eaffd7a3/_result.png",
};

// ---------- общие SVG-иконки ----------

export function IconBlade({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 20 L18 6 L20 4 L19 8 L7 20 Z" fill={color} />
      <path d="M5 15 L9 19 L7.5 20.5 L3.5 16.5 Z" fill={color} opacity="0.7" />
    </svg>
  );
}
export function IconHeart({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 21 C5 15 2 11.5 2 8 A5 5 0 0 1 12 6 A5 5 0 0 1 22 8 C22 11.5 19 15 12 21 Z" />
    </svg>
  );
}
export function IconStar({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2 L14.9 8.6 L22 9.3 L16.7 14 L18.2 21 L12 17.3 L5.8 21 L7.3 14 L2 9.3 L9.1 8.6 Z" />
    </svg>
  );
}
export function IconGem({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2 L20 9 L12 22 L4 9 Z" />
      <path d="M12 2 L16 9 L12 22 L8 9 Z" fill="#ffffff" opacity="0.35" />
    </svg>
  );
}
export function IconSound({ size = 18, color = "currentColor", off = false }: { size?: number; color?: string; off?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M4 9 H8 L13 4 V20 L8 15 H4 Z" fill={color} stroke="none" />
      {off ? <path d="M16 9 L22 15 M22 9 L16 15" /> : <path d="M16.5 8.5 A5 5 0 0 1 16.5 15.5 M19 6 A9 9 0 0 1 19 18" />}
    </svg>
  );
}
export function IconPause({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}
export function IconWing({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M2 18 C6 6 16 3 22 3 C18 7 17 9 16 12 C13 11 12 12 11 14 C9 13 8 14 7 17 Z" />
    </svg>
  );
}
export function IconEye({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M2 12 C5 6 9 4 12 4 C15 4 19 6 22 12 C19 18 15 20 12 20 C9 20 5 18 2 12 Z" />
      <circle cx="12" cy="12" r="3.4" fill={color} />
    </svg>
  );
}
export function IconFang({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M6 3 C9 5 10 8 9.5 12 L7 21 L4.5 12 C4 8 4.5 5 6 3 Z" />
      <path d="M18 3 C15 5 14 8 14.5 12 L17 21 L19.5 12 C20 8 19.5 5 18 3 Z" />
    </svg>
  );
}
export function IconMoon({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M20 14 A9 9 0 1 1 10 3 A7.5 7.5 0 0 0 20 14 Z" />
    </svg>
  );
}
export function IconFury({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M13 2 L4 14 H10 L9 22 L20 9 H13 Z" />
    </svg>
  );
}
export function IconThorn({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2 L14 8 L20 6 L16 11 L22 14 L15 14 L16 21 L12 16 L8 21 L9 14 L2 14 L8 11 L4 6 L10 8 Z" />
    </svg>
  );
}

export function IconFlask({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M10 2 H14 V8 L19 18 A2.4 2.4 0 0 1 16.8 21.5 H7.2 A2.4 2.4 0 0 1 5 18 L10 8 Z" fill={color} opacity="0.35" />
      <path d="M10 2 H14 V8 L19 18 A2.4 2.4 0 0 1 16.8 21.5 H7.2 A2.4 2.4 0 0 1 5 18 L10 8 Z" stroke={color} strokeWidth="1.8" />
      <path d="M8.2 14 H15.8 L17.6 17.6 A1.4 1.4 0 0 1 16.4 19.6 H7.6 A1.4 1.4 0 0 1 6.4 17.6 Z" fill={color} />
    </svg>
  );
}

export function IconStam({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2 C16 6 19 9.5 19 13.5 A7 7 0 0 1 5 13.5 C5 9.5 8 6 12 2 Z" />
      <path d="M12 7 C14 9.4 15.8 11.4 15.8 13.6 A3.8 3.8 0 0 1 8.2 13.6 C8.2 11.4 10 9.4 12 7 Z" fill="#0b0512" opacity="0.55" />
    </svg>
  );
}

export function IconTelegram({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M21.9 4.6 L18.9 19.2 C18.7 20.2 18.1 20.5 17.2 20 L12.5 16.5 L10.2 18.7 C10 18.9 9.8 19.1 9.3 19.1 L9.7 13.9 L19 5.5 C19.4 5.1 18.9 4.9 18.4 5.3 L6.9 12.5 L2 11 C0.9 10.7 0.9 9.9 2.2 9.4 L20.4 4.4 C21.2 4.1 21.9 4.6 21.9 4.6 Z" />
    </svg>
  );
}

export const UPGRADE_ICONS: Record<string, (p: { size?: number; color?: string }) => React.ReactElement> = {
  blade: IconBlade,
  heart: IconHeart,
  wing: IconWing,
  eye: IconEye,
  fang: IconFang,
  star: IconStar,
  moon: IconMoon,
  fury: IconFury,
  gem: IconGem,
  thorn: IconThorn,
  flask: IconFlask,
  stam: IconStam,
};

// ---------- титульный экран ----------

export function TitleScreen({
  onStart,
  onContinue,
  best,
  hasSave,
  totalKills,
  totalSummons,
}: {
  onStart: () => void;
  onContinue?: () => void;
  best: { level: number; kills: number } | null;
  hasSave: boolean;
  totalKills: number;
  totalSummons: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [muted, setM] = useState(isMuted());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const stars = Array.from({ length: 70 }, (_, i) => ({
      x: ((i * 173) % 1000) / 1000,
      y: ((i * 337) % 1000) / 1000 * 0.5,
      s: 0.5 + ((i * 71) % 100) / 60,
    }));

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const t = now / 1000;
      const W = canvas.width;
      const H = canvas.height;
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#12060b");
      sky.addColorStop(0.55, "#3a0f18");
      sky.addColorStop(1, "#1d0f14");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // луна-око
      const mx = W * 0.72;
      const my = H * 0.3;
      const mg = ctx.createRadialGradient(mx, my, 10, mx, my, H * 0.42);
      mg.addColorStop(0, "rgba(255,90,60,0.5)");
      mg.addColorStop(1, "rgba(255,90,60,0)");
      ctx.fillStyle = mg;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ff5a3c";
      ctx.beginPath();
      ctx.arc(mx, my, H * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1d0f14";
      ctx.beginPath();
      ctx.ellipse(mx, my, H * 0.13, H * 0.02, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255,244,214,0.8)";
      for (const st of stars) {
        ctx.globalAlpha = 0.3 + Math.sin(t * 2 + st.x * 40) * 0.3;
        ctx.fillRect(st.x * W, st.y * H, st.s, st.s);
      }
      ctx.globalAlpha = 1;

      // силуэт цитадели
      ctx.fillStyle = "#0c0408";
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(0, H * 0.62);
      const spikes = 9;
      for (let i = 0; i <= spikes; i++) {
        const x = (i / spikes) * W;
        const hgt = H * (0.1 + ((i * 137) % 100) / 500);
        ctx.lineTo(x - W / spikes / 2, H * 0.62 - hgt);
        ctx.lineTo(x, H * 0.62 - hgt * 0.3);
      }
      ctx.lineTo(W, H * 0.62);
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();

      // глаза владыки в темноте
      const blink = Math.sin(t * 0.7) > -0.85 ? 1 : 0.1;
      ctx.fillStyle = `rgba(255,209,102,${0.9 * blink})`;
      ctx.shadowColor = "#ffd166";
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.ellipse(W * 0.28, H * 0.52, 14, 5, -0.15, 0, Math.PI * 2);
      ctx.ellipse(W * 0.36, H * 0.52, 14, 5, 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // скала + герой
      const hx = W * 0.5;
      const hy = H * 0.78;
      ctx.fillStyle = "#0c0408";
      ctx.beginPath();
      ctx.moveTo(hx - 130, H);
      ctx.lineTo(hx - 60, hy + 26);
      ctx.lineTo(hx + 70, hy + 30);
      ctx.lineTo(hx + 150, H);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.translate(0, Math.sin(t * 1.6) * 2);
      drawChibi(ctx, {
        x: hx, y: hy, scale: 2.4, t, face: -1, moving: false,
        palette: { hair: "#dfe6f2", hairDark: "#9aa8c7", skin: "#ffe3d3", dress: "#232946", accent: "#ffd166", eyes: "#ff2e4d" },
        style: "spiky", weapon: "blade", glow: "#ffd166",
      });
      ctx.restore();

      // угли
      for (let i = 0; i < 26; i++) {
        const px = ((i * 211 + t * 26) % W + W) % W;
        const py = H - (((i * 149 + t * 40) % H + H) % H);
        ctx.fillStyle = `rgba(255,159,67,${0.25 + Math.sin(t * 3 + i) * 0.2})`;
        ctx.beginPath();
        ctx.arc(px, py, 1.6 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }

      // виньетка
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.95);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(5,2,10,0.7)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden select-none">
      {/* аниме key-art фон (Ken Burns) */}
      <div className="anime-bg" style={{ backgroundImage: `url(${ART.landscape})` }} />
      <div className="absolute inset-0 bg-gradient-to-b from-[#07030d]/70 via-[#07030d]/30 to-[#07030d]/85" />
      <div className="stripe-overlay" />
      <div className="speed-lines" />
      <div className="kanji-mark right-4 top-1/2 -translate-y-1/2 text-[11rem]">転生英雄</div>

      {/* парящая богиня справа */}
      <div className="pointer-events-none absolute right-[2%] bottom-0 z-[5] hidden h-[82%] lg:block">
        <img
          src={ART.goddess}
          alt=""
          className="float-slow glow-pulse h-full w-auto object-contain object-bottom drop-shadow-[0_0_40px_rgba(255,209,102,0.35)]"
          style={{ maskImage: "linear-gradient(to top, transparent 0%, black 12%)", WebkitMaskImage: "linear-gradient(to top, transparent 0%, black 12%)" }}
        />
      </div>

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6">
        <div className="anim-rise text-center">
          <div className="font-display mb-3 inline-block -skew-x-12 border border-[#ff9f43]/50 bg-[#3a0f18]/60 px-4 py-1 text-sm tracking-[0.5em] text-[#ff9f43]">
            ИЗ МЕРТВЫХ — К ЛЕГЕНДЕ
          </div>
          <h1 className="anime-title font-display mt-4 text-6xl leading-[1.02] md:text-8xl">
            ПЕРЕРОЖДЕНИЕ
            <br />
            <span className="text-[#ffd166]">ГЕРОЯ</span>
          </h1>
          <div className="mx-auto mt-4 h-1 w-56 -skew-x-12 bg-gradient-to-r from-transparent via-[#ff2e4d] to-transparent" />
          <div className="font-display mt-3 text-lg tracking-[0.35em] text-[#f7ecf2]/90 md:text-xl">
            ✦ КЛИНОК БОГИНИ ✦
          </div>
        </div>

        <div className="anim-rise mt-10 flex flex-col items-center gap-4" style={{ animationDelay: "0.15s" }}>
          {hasSave && (
            <button
              className="skew-btn gold px-16 py-4 text-2xl"
              onClick={() => {
                unlockAudio();
                unlockMusic();
                sfx.ui();
                onContinue?.();
              }}
            >
              Продолжить путь
            </button>
          )}
          <button
            className={`${hasSave ? "skew-btn ghost px-12 py-3 text-lg" : "skew-btn px-16 py-4 text-2xl"}`}
            onClick={() => {
              unlockAudio();
              unlockMusic();
              sfx.ui();
              onStart();
            }}
          >
            {hasSave ? "Новая игра" : "Начать путь"}
          </button>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-[#a98fb8]">
            <span className="hud-chip clip-btn px-3 py-1.5 text-[#ff2e4d]">SOULS-LIKE</span>
            <span className="hud-chip clip-btn px-3 py-1.5 text-[#ff9f43]">2D СЛЭШЕР</span>
            <span className="hud-chip clip-btn px-3 py-1.5 text-[#35f0d0]">RPG-ПРОКАЧКА</span>
            <span className="hud-chip clip-btn px-3 py-1.5 text-[#7cc7ff]">ГАЧА-ПРИЗЫВ</span>
            <span className="hud-chip clip-btn px-3 py-1.5 text-[#ff6b8a]">3 ГЕРОИНИ</span>
          </div>
        </div>

        <div
          className="anim-rise panel-dark clip-panel mt-10 grid grid-cols-2 gap-x-8 gap-y-2 px-8 py-5 text-sm text-[#cbb8d8] md:grid-cols-4"
          style={{ animationDelay: "0.3s" }}
        >
          <div className="flex items-center gap-2"><b className="font-display text-[#ffd166]">WASD</b> движение</div>
          <div className="flex items-center gap-2"><b className="font-display text-[#ffd166]">ЛКМ / J</b> атака (комбо)</div>
          <div className="flex items-center gap-2"><b className="font-display text-[#ffd166]">SPACE</b> рывок</div>
          <div className="flex items-center gap-2"><b className="font-display text-[#ffd166]">Q</b> навык класса</div>
          <div className="flex items-center gap-2"><b className="font-display text-[#ffd166]">E</b> ярость героя</div>
          <div className="flex items-center gap-2"><b className="font-display text-[#ffd166]">F</b> фляга Эстуса</div>
          <div className="flex items-center gap-2"><b className="font-display text-[#ffd166]">TAB / ПКМ</b> захват цели</div>
          <div className="flex items-center gap-2"><b className="font-display text-[#ffd166]">ESC</b> пауза</div>
          <div className="flex items-center gap-2"><b className="font-display text-[#ffd166]">M</b> звук</div>
          <div className="flex items-center gap-2 text-[#a98fb8]">целься мышью</div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-[#a98fb8]">
          {best && (
            <span>
              Лучший забег: <b className="text-[#ffd166]">ур. {best.level}</b> ·{" "}
              <b className="text-[#ff2e4d]">{best.kills}</b> убийств
            </span>
          )}
          {totalKills > 0 && (
            <span>
              Всего истреблено: <b className="text-[#ff9f43]">{totalKills}</b> · призывов:{" "}
              <b className="text-[#7cc7ff]">{totalSummons}</b>
            </span>
          )}
          <a
            href="https://t.me/pixsetup"
            target="_blank"
            rel="noreferrer"
            className="tg-link clip-btn flex items-center gap-2 px-4 py-2"
            onClick={() => sfx.ui()}
          >
            <IconTelegram size={14} /> КАНАЛ РАЗРАБОТЧИКА
          </a>
          <button
            className="btn-ghost clip-btn flex items-center gap-2 px-4 py-2"
            onClick={() => {
              const m = !muted;
              setMuted(m);
              setM(m);
              if (!m) sfx.ui();
            }}
          >
            <IconSound off={muted} /> {muted ? "ЗВУК ВЫКЛ" : "ЗВУК ВКЛ"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- заставка: смерть и богиня ----------

const DIALOG: { who: "Астрея" | "Кай"; text: string }[] = [
  { who: "Астрея", text: "Дитя моё... твой путь в прежнем мире оборвался так внезапно." },
  { who: "Кай", text: "Я... умер? Этот грузовик... А ты кто такая?" },
  { who: "Астрея", text: "Я — Астрея, Богиня Рассвета. Твоя душа сияет ярче тысяч других." },
  { who: "Астрея", text: "Мир Элирия гибнет. Владыка Демонов Зеррис сжигает королевство за королевством." },
  { who: "Астрея", text: "Я верну тебя к жизни — в новом теле, с силой Героя. Спаси этот мир, Кай." },
  { who: "Кай", text: "Вторая жизнь, значит... Хорошо. Умирать бессмысленно я больше не собираюсь." },
  { who: "Астрея", text: "Судьба сведёт тебя с теми, кто станет дороже жизни. А сейчас — выбери мой дар:" },
];

export function IntroCinematic({ onDone }: { onDone: (gift: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tRef = useRef(0);
  const startRef = useRef(performance.now());
  const sfxFlags = useRef({ truck: false, hb1: false, hb2: false, join: false });
  const [goddessOn, setGoddessOn] = useState(false);
  const [line, setLine] = useState(0);
  const [typed, setTyped] = useState("");
  const [choosing, setChoosing] = useState(false);
  const [hoverGift, setHoverGift] = useState<string | null>(null);
  const goddessOnRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const LW = 1280;
    const LH = 720;

    const shards = Array.from({ length: 16 }, (_, i) => ({
      a: (i / 16) * Math.PI * 2 + Math.random() * 0.4,
      d: 60 + Math.random() * 160,
      s: 8 + Math.random() * 18,
      r: Math.random() * Math.PI,
    }));
    const stars = Array.from({ length: 90 }, (_, i) => ({
      x: ((i * 197) % LW),
      y: ((i * 389) % LH),
      s: 0.6 + ((i * 53) % 100) / 70,
    }));
    const buildings = Array.from({ length: 12 }, (_, i) => ({
      x: i * 112 - 20,
      w: 70 + ((i * 61) % 40),
      h: 160 + ((i * 149) % 220),
      win: (i * 31) % 7,
    }));

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const t = (now - startRef.current) / 1000;
      tRef.current = t;
      const scale = Math.max(window.innerWidth / LW, window.innerHeight / LH);
      const W = window.innerWidth;
      const H = window.innerHeight;
      canvas.width = W;
      canvas.height = H;
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(scale, scale);
      ctx.translate(-LW / 2, -LH / 2);

      const IMPACT = 4.05;

      if (t < 5.4) {
        // ---- ночной город ----
        const sky = ctx.createLinearGradient(0, 0, 0, LH);
        sky.addColorStop(0, "#04060e");
        sky.addColorStop(1, "#131c33");
        ctx.fillStyle = sky;
        ctx.fillRect(-40, -40, LW + 80, LH + 80);
        ctx.fillStyle = "rgba(220,230,255,0.85)";
        ctx.beginPath();
        ctx.arc(1050, 110, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#04060e";
        ctx.beginPath();
        ctx.arc(1038, 100, 30, 0, Math.PI * 2);
        ctx.fill();

        for (const b of buildings) {
          ctx.fillStyle = "#0a0f1e";
          ctx.fillRect(b.x, LH - 190 - b.h, b.w, b.h);
          for (let wy = 0; wy < Math.floor(b.h / 34); wy++) {
            for (let wx = 0; wx < 3; wx++) {
              if ((wy * 3 + wx + b.win) % 4 === 0) {
                ctx.fillStyle = "rgba(255,214,120,0.5)";
                ctx.fillRect(b.x + 10 + wx * 20, LH - 176 - b.h + wy * 34, 9, 14);
              }
            }
          }
        }

        // дорога
        ctx.fillStyle = "#0b0d16";
        ctx.fillRect(-40, LH - 190, LW + 80, 200);
        ctx.fillStyle = "rgba(240,240,220,0.25)";
        for (let i = 0; i < 10; i++) ctx.fillRect(i * 140 + 20, LH - 96, 60, 6);

        // дождь
        ctx.strokeStyle = "rgba(150,180,255,0.3)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let i = 0; i < 110; i++) {
          const rx = ((i * 173 + t * 900) % (LW + 100)) - 50;
          const ry = ((i * 311 + t * 1500) % (LH + 60)) - 30;
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx - 10, ry + 26);
        }
        ctx.stroke();

        const heroX = 430;
        const heroY = LH - 120;

        // грузовик
        const truckX = -260 + Math.min(1, Math.max(0, (t - 2.6) / (IMPACT - 2.6))) * (heroX + 120);
        if (t > 2.6) {
          // свет фар
          const cone = ctx.createLinearGradient(truckX, 0, truckX + 500, 0);
          cone.addColorStop(0, "rgba(255,244,200,0.5)");
          cone.addColorStop(1, "rgba(255,244,200,0)");
          ctx.fillStyle = cone;
          ctx.beginPath();
          ctx.moveTo(truckX + 96, LH - 150);
          ctx.lineTo(truckX + 620, LH - 210);
          ctx.lineTo(truckX + 620, LH - 60);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#151a28";
          ctx.fillRect(truckX - 160, LH - 210, 250, 96);
          ctx.fillStyle = "#1f2740";
          ctx.fillRect(truckX - 160, LH - 240, 120, 40);
          ctx.fillStyle = "#ffe9a8";
          ctx.fillRect(truckX + 82, LH - 160, 12, 18);
          ctx.fillRect(truckX + 82, LH - 132, 12, 18);
          ctx.fillStyle = "#0a0c14";
          ctx.beginPath();
          ctx.arc(truckX - 110, LH - 108, 22, 0, Math.PI * 2);
          ctx.arc(truckX + 40, LH - 108, 22, 0, Math.PI * 2);
          ctx.fill();
        }

        // герой
        if (t < IMPACT) {
          const walk = t < 2.8;
          drawChibi(ctx, {
            x: heroX - (walk ? (2.8 - t) * 60 : 0),
            y: heroY,
            scale: 1.7,
            t: t * 1.4,
            face: 1,
            moving: walk,
            palette: { hair: "#4a5068", hairDark: "#33384c", skin: "#ffe3d3", dress: "#3a3f56", accent: "#8a90a8", eyes: "#8a90a8" },
            style: "spiky",
            weapon: "none",
            glow: "#8a90a8",
          });
        }

        if (!sfxFlags.current.truck && t > 3.4) {
          sfxFlags.current.truck = true;
          sfx.truck();
        }

        // ---- удар ----
        if (t >= IMPACT) {
          const it = t - IMPACT;
          const flash = Math.max(0, 1 - it * 2.4);
          const shake = Math.max(0, 10 - it * 14);
          ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
          // осколки
          for (const s of shards) {
            const d = s.d * it * 3;
            ctx.save();
            ctx.translate(heroX + Math.cos(s.a) * d, heroY - 20 + Math.sin(s.a) * d);
            ctx.rotate(s.r + it * 4);
            ctx.fillStyle = it % 0.2 < 0.1 ? "rgba(255,46,77,0.9)" : "rgba(247,236,242,0.9)";
            ctx.fillRect(-s.s / 2, -s.s / 2, s.s, s.s);
            ctx.restore();
          }
          ctx.fillStyle = `rgba(255,255,255,${flash})`;
          ctx.fillRect(-60, -60, LW + 120, LH + 120);
          if (it > 0.55) {
            const ba = Math.min(1, (it - 0.55) * 1.6);
            ctx.fillStyle = `rgba(4,2,8,${ba})`;
            ctx.fillRect(-60, -60, LW + 120, LH + 120);
            if (it > 0.8) {
              // кардиомонитор
              ctx.strokeStyle = "rgba(255,46,77,0.9)";
              ctx.lineWidth = 2.6;
              ctx.beginPath();
              for (let x = 0; x <= LW; x += 6) {
                const decay = Math.max(0, 1 - it * 0.55);
                const beat = Math.sin(x * 0.05 + t * 8) * 26 * decay * (Math.sin(x * 0.011) > 0.5 ? 1 : 0.15);
                const y = LH / 2 + beat;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
              }
              ctx.stroke();
              ctx.font = '26px "Russo One"';
              ctx.textAlign = "center";
              ctx.fillStyle = `rgba(255,120,140,${0.5 + Math.sin(t * 6) * 0.3})`;
              ctx.fillText("СИГНАЛ ЖИЗНИ УТРАЧЕН", LW / 2, LH / 2 + 90);
            }
          }
          if (!sfxFlags.current.hb1 && it > 0.9) {
            sfxFlags.current.hb1 = true;
            sfx.heartbeat();
          }
          if (!sfxFlags.current.hb2 && it > 1.25) {
            sfxFlags.current.hb2 = true;
            sfx.heartbeat();
          }
        }
      } else {
        // ---- пустота и богиня ----
        const vt = t - 5.4;
        const bg = ctx.createRadialGradient(LW / 2, LH / 2, 60, LW / 2, LH / 2, LH);
        bg.addColorStop(0, "#1c0f30");
        bg.addColorStop(1, "#07030d");
        ctx.fillStyle = bg;
        ctx.fillRect(-60, -60, LW + 120, LH + 120);

        for (const st of stars) {
          ctx.fillStyle = `rgba(255,244,214,${0.25 + Math.sin(vt * 2 + st.x) * 0.25})`;
          ctx.fillRect(st.x, st.y, st.s, st.s);
        }

        // душа героя
        const orbY = LH * 0.62 - Math.min(1, vt / 2) * 60;
        const og = ctx.createRadialGradient(LW / 2, orbY, 2, LW / 2, orbY, 34);
        og.addColorStop(0, "rgba(255,255,255,0.95)");
        og.addColorStop(0.5, "rgba(140,220,255,0.5)");
        og.addColorStop(1, "rgba(140,220,255,0)");
        ctx.fillStyle = og;
        ctx.beginPath();
        ctx.arc(LW / 2, orbY, 34, 0, Math.PI * 2);
        ctx.fill();

        // богиня
        if (vt > 1.1) {
          const ga = Math.min(1, (vt - 1.1) * 1.2);
          ctx.globalAlpha = ga;
          drawGoddess(ctx, LW / 2, LH * 0.44, 1.5, t);
          ctx.globalAlpha = 1;
          if (!goddessOnRef.current && ga > 0.85) {
            goddessOnRef.current = true;
            setGoddessOn(true);
            sfx.join();
          }
        }
      }
      ctx.restore();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  // печатная машинка
  useEffect(() => {
    if (!goddessOn || choosing) return;
    const full = DIALOG[line].text;
    setTyped("");
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setTyped(full.slice(0, i));
      if (i >= full.length) clearInterval(iv);
    }, 26);
    return () => clearInterval(iv);
  }, [goddessOn, line, choosing]);

  const skip = () => {
    startRef.current = performance.now() - 6800;
    sfxFlags.current = { truck: true, hb1: true, hb2: true, join: false };
    if (!goddessOnRef.current) {
      goddessOnRef.current = true;
      setGoddessOn(true);
    }
    sfx.ui();
  };

  const nextLine = () => {
    sfx.ui();
    if (line < DIALOG.length - 1) setLine(line + 1);
    else setChoosing(true);
  };

  return (
    <div className="relative h-full w-full overflow-hidden select-none bg-[#07030d]">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="stripe-overlay" />

      <div className="absolute top-5 left-6 z-20 -skew-x-12 border border-[#ff9f43]/40 bg-[#07030d]/70 px-4 py-1.5 font-display text-sm tracking-[0.4em] text-[#ff9f43]">
        ПРОЛОГ · СМЕРТЬ КАЯ
      </div>
      <button onClick={skip} className="btn-ghost clip-btn absolute top-5 right-6 z-20 px-5 py-2 text-sm">
        ПРОПУСТИТЬ ▸▸
      </button>

      {goddessOn && !choosing && (
        <div className="absolute right-0 bottom-0 left-0 z-20 flex justify-center px-4 pb-8">
          <div className="panel-dark clip-panel anim-pop w-full max-w-3xl px-7 py-5">
            <div className="mb-2 flex items-baseline gap-3">
              <span
                className={`font-display text-lg ${DIALOG[line].who === "Астрея" ? "text-[#ffd166]" : "text-[#7cc7ff]"}`}
              >
                {DIALOG[line].who}
              </span>
              <span className="text-xs text-[#a98fb8]">{line + 1}/{DIALOG.length}</span>
            </div>
            <p className={`min-h-[56px] text-lg leading-relaxed text-[#f7ecf2] ${typed.length < DIALOG[line].text.length ? "type-cursor" : ""}`}>
              {typed}
            </p>
            <div className="mt-3 flex justify-end">
              <button onClick={nextLine} className="btn-blade clip-btn px-7 py-2.5 text-sm">
                {line < DIALOG.length - 1 ? "ДАЛЕЕ ▸" : "ВЫБРАТЬ ДАР ✦"}
              </button>
            </div>
          </div>
        </div>
      )}

      {choosing && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center px-4">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${ART.hero})` }} />
          <div className="absolute inset-0 bg-gradient-to-b from-[#07030d]/80 via-[#07030d]/70 to-[#07030d]/90" />
          <div className="stripe-overlay" />
          <div className="anim-pop relative z-10 text-center">
            <div className="font-display text-3xl text-[#ffd166] md:text-4xl anime-title">ВЫБЕРИ СВОЙ ПУТЬ</div>
            <p className="mt-2 max-w-xl text-sm text-[#cbb8d8]">
              С чем ты вступишь в Элирию? Класс определит твою магию и стиль боя.
            </p>
          </div>
          <div className="relative z-10 mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
            {CLASSES.map((g, i) => {
              const Ic = g.icon === "blade" ? IconBlade : g.icon === "star" ? IconStar : IconWing;
              const active = hoverGift === g.id;
              return (
                <button
                  key={g.id}
                  onMouseEnter={() => setHoverGift(g.id)}
                  onMouseLeave={() => setHoverGift(null)}
                  onClick={() => {
                    sfx.gachaLegend();
                    onDone(g.id);
                  }}
                  className={`panel-dark clip-panel anim-rise w-72 cursor-pointer px-6 py-7 text-left transition-all duration-150 ${active ? "-translate-y-2 shadow-[0_0_36px_rgba(255,209,102,0.3)]" : ""}`}
                  style={{ animationDelay: `${i * 0.1}s`, borderColor: active ? g.color : undefined }}
                >
                  <div className="mb-3" style={{ color: active ? g.color : "#ff9f43" }}>
                    <Ic size={40} />
                  </div>
                  <div className="font-display text-[10px] tracking-[0.3em]" style={{ color: g.color }}>{g.title.toUpperCase()}</div>
                  <div className="font-display text-lg text-[#f7ecf2]">{g.name}</div>
                  <div className="mt-1.5 text-sm text-[#a98fb8]">{g.desc}</div>
                  <div className="mt-3 border-t border-white/10 pt-2 text-xs font-semibold" style={{ color: g.color }}>
                    {g.skill}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
