// Оверлеи: пауза, уровень, присоединение героинь, гача, поражение, финал.

import { useEffect, useRef, useState } from "react";
import { drawPortrait, drawChibi } from "../game/sprites";
import { BLESSINGS, RARITY_META, GACHA_SINGLE, GACHA_TEN, HEROINES, type BlessingDef, type HeroineDef, type UpgradeDef } from "../game/data";
import type { RunStats } from "../game/engine";
import { sfx } from "../game/audio";
import { NetLink, type NetMsg, type NetRole } from "../game/net";
import { UPGRADE_ICONS, IconGem, IconHeart, IconBlade, IconTelegram } from "./Intro";

// ---------- холст-портрет ----------

export function PortraitCanvas({ def, w = 300, h = 360, className }: { def: HeroineDef; w?: number; h?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    drawPortrait(ctx, w, h, {
      hair: def.hair,
      hairDark: def.hairDark,
      eyes: def.eyes,
      skin: def.skin,
      dress: def.dress,
      accent: def.accent,
      style: def.style,
    });
  }, [def, w, h]);
  return <canvas ref={ref} width={w} height={h} className={className} />;
}

function Backdrop({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]">
      {children}
    </div>
  );
}

// ---------- пауза ----------

export function PauseOverlay({
  onResume,
  onRestart,
  onMenu,
  onLeaveNet,
  netMode,
  stats,
}: {
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
  onLeaveNet?: () => void;
  netMode?: boolean;
  stats: RunStats;
}) {
  return (
    <Backdrop>
      <div className="panel-dark clip-panel anim-pop w-full max-w-lg px-9 py-8">
        <div className="font-display text-3xl text-[#ffd166]">ПАУЗА</div>
        <div className="mt-1 text-sm text-[#a98fb8]">
          Время {Math.floor(stats.time / 60)}:{String(Math.floor(stats.time % 60)).padStart(2, "0")} · Уровень {stats.level} · Убийств {stats.kills}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-[#cbb8d8]">
          <div><b className="font-display text-[#ffd166]">WASD</b> — движение</div>
          <div><b className="font-display text-[#ffd166]">ЛКМ / J</b> — атака (стамина)</div>
          <div><b className="font-display text-[#ffd166]">SPACE</b> — рывок</div>
          <div><b className="font-display text-[#ffd166]">Q / K</b> — навык класса</div>
          <div><b className="font-display text-[#ffd166]">E / L</b> — ярость · <b className="font-display text-[#ffd166]">F</b> — фляга</div>
          <div><b className="font-display text-[#ffd166]">TAB / ПКМ</b> — захват цели</div>
        </div>
        <a href="https://t.me/pixsetup" target="_blank" rel="noreferrer" className="tg-link clip-btn mt-5 flex items-center gap-2 px-4 py-2 text-xs">
          <IconTelegram size={13} /> @pixsetup — канал разработчика
        </a>
        <div className="mt-7 flex flex-col gap-3">
          <button onClick={onResume} className="btn-blade clip-btn px-6 py-3">ПРОДОЛЖИТЬ БОЙ</button>
          {netMode ? (
            <button onClick={onLeaveNet} className="btn-ghost clip-btn flex-1 px-4 py-2.5 text-sm text-[#ff9db0]">
              ПОКИНУТЬ КОМНАТУ
            </button>
          ) : (
            <div className="flex gap-3">
              <button onClick={onRestart} className="btn-ghost clip-btn flex-1 px-4 py-2.5 text-sm">ЗАНОВО</button>
              <button onClick={onMenu} className="btn-ghost clip-btn flex-1 px-4 py-2.5 text-sm">В МЕНЮ</button>
            </div>
          )}
        </div>
      </div>
    </Backdrop>
  );
}

// ---------- выбор апгрейда ----------

export function LevelUpModal({ level, choices, onPick }: { level: number; choices: UpgradeDef[]; onPick: (id: string) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <Backdrop>
      <div className="text-center">
        <div className="anim-pop font-display text-4xl text-[#ffd166]" style={{ textShadow: "0 0 24px rgba(255,209,102,0.7)" }}>
          УРОВЕНЬ {level}!
        </div>
        <div className="mt-2 mb-6 text-sm tracking-widest text-[#cbb8d8]">ВЫБЕРИ УСИЛЕНИЕ ГЕРОЯ</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {choices.map((u, i) => {
            const Ic = UPGRADE_ICONS[u.icon] ?? IconBlade;
            return (
              <button
                key={u.id}
                onMouseEnter={() => setHover(u.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onPick(u.id)}
                className={`panel-dark clip-panel anim-rise w-56 cursor-pointer px-6 py-7 text-center transition-all duration-150 ${
                  hover === u.id ? "-translate-y-2 shadow-[0_0_30px_rgba(53,240,208,0.3)]" : ""
                }`}
                style={{ animationDelay: `${i * 0.08}s`, borderColor: hover === u.id ? "#35f0d0" : undefined }}
              >
                <div className={hover === u.id ? "text-[#35f0d0]" : "text-[#ff9f43]"}>
                  <Ic size={36} />
                </div>
                <div className="font-display mt-3 text-base text-[#f7ecf2]">{u.name}</div>
                <div className="mt-1.5 text-sm text-[#a98fb8]">{u.desc}</div>
              </button>
            );
          })}
        </div>
      </div>
    </Backdrop>
  );
}

// ---------- сцена с героиней ----------

export function JoinScene({ def, onDone }: { def: HeroineDef; onDone: () => void }) {
  const [line, setLine] = useState(0);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const full = def.joinLine[line];
    setTyped("");
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setTyped(full.slice(0, i));
      if (i >= full.length) clearInterval(iv);
    }, 24);
    return () => clearInterval(iv);
  }, [def, line]);

  const last = line >= def.joinLine.length - 1;

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center overflow-hidden bg-black/70 p-4">
      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 30% 50%, ${def.glow}22, transparent 60%)` }} />
      <div className="panel-dark clip-panel anim-pop relative flex w-full max-w-4xl flex-col items-center gap-6 px-8 py-8 md:flex-row">
        <div className="relative shrink-0">
          <div className="anim-float">
            <PortraitCanvas def={def} w={280} h={330} />
          </div>
          <div className="absolute -bottom-2 left-1/2 h-3 w-40 -translate-x-1/2 rounded-full bg-black/50 blur-sm" />
        </div>
        <div className="flex-1 text-center md:text-left">
          <div className="font-display text-[11px] tracking-[0.4em]" style={{ color: def.accent }}>
            СПАСЕНА · ВСТУПАЕТ В ОТРЯД
          </div>
          <div className="font-display mt-1 text-4xl" style={{ color: def.hair, textShadow: `0 0 24px ${def.glow}` }}>
            {def.name}
          </div>
          <div className="font-display text-sm tracking-widest text-[#cbb8d8]">{def.title}</div>

          <div className="mt-5 min-h-[110px] border-l-2 pl-4" style={{ borderColor: def.glow }}>
            <p className={`text-lg leading-relaxed text-[#f7ecf2] ${typed.length < def.joinLine[line].length ? "type-cursor" : ""}`}>
              {typed}
            </p>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 md:justify-start">
            {def.joinLine.map((_, i) => (
              <span key={i} className={`h-1.5 w-6 skew-x-[-16deg] ${i <= line ? "" : "bg-white/15"}`} style={i <= line ? { background: def.glow } : undefined} />
            ))}
          </div>

          <div className="mt-6 flex justify-center gap-3 md:justify-start">
            {!last ? (
              <button
                onClick={() => {
                  sfx.ui();
                  setLine(line + 1);
                }}
                className="btn-ghost clip-btn px-7 py-2.5 text-sm"
              >
                ДАЛЕЕ ▸
              </button>
            ) : (
              <button
                onClick={() => {
                  sfx.join();
                  onDone();
                }}
                className="btn-blade clip-btn px-8 py-3"
              >
                В БОЙ, ВМЕСТЕ! ✦
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- гача ----------

export function GachaModal({
  crystals,
  onPull,
  onApply,
  onClose,
}: {
  crystals: number;
  onPull: (count: number) => BlessingDef[] | null;
  onApply: (b: BlessingDef) => void;
  onClose: () => void;
}) {
  const [results, setResults] = useState<BlessingDef[] | null>(null);
  const [revealed, setRevealed] = useState(0);
  // держим колбэк в ref: таймер раскрытия не должен зависеть от ре-рендеров родителя
  const applyRef = useRef(onApply);
  applyRef.current = onApply;

  useEffect(() => {
    if (!results || revealed >= results.length) return;
    const iv = setTimeout(() => {
      const b = results[revealed];
      if (b.rarity === "legend") sfx.gachaLegend();
      else if (b.rarity === "epic") sfx.gachaEpic();
      else sfx.gachaRare();
      applyRef.current(b);
      setRevealed(revealed + 1);
    }, 320);
    return () => clearTimeout(iv);
  }, [results, revealed]);

  const pull = (n: number) => {
    const res = onPull(n);
    if (res) {
      sfx.gachaSpin();
      setResults(res);
      setRevealed(0);
    }
  };

  return (
    <Backdrop>
      <div className="panel-dark clip-panel anim-pop w-full max-w-4xl px-8 py-7">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-2xl shimmer-text">НЕБЕСНЫЙ ПРИЗЫВ</div>
            <div className="mt-1 text-xs text-[#a98fb8]">Благословения богини усиливают героя навсегда (в рамках забега)</div>
          </div>
          <div className="hud-chip clip-btn flex items-center gap-2 px-4 py-2">
            <IconGem size={18} color="#7cc7ff" />
            <span className="font-display text-lg text-[#7cc7ff]">{crystals}</span>
          </div>
        </div>

        {!results ? (
          <div className="mt-8 flex flex-col items-center gap-6">
            <div className="relative flex h-40 w-40 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-[#ffd166]/40 anim-pulse-gold" style={{ borderRadius: "50%" }} />
              <div className="absolute inset-3 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,209,102,0.35), rgba(196,107,255,0.15) 60%, transparent)", borderRadius: "50%" }} />
              <IconGem size={64} color="#ffd166" />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={() => pull(1)}
                disabled={crystals < GACHA_SINGLE}
                className="btn-blade clip-btn px-8 py-3 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ПРИЗЫВ ×1 — {GACHA_SINGLE} <IconGem size={13} color="#fff" />
              </button>
              <button
                onClick={() => pull(10)}
                disabled={crystals < GACHA_TEN}
                className="btn-blade clip-btn px-8 py-3 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ПРИЗЫВ ×10 — {GACHA_TEN} <IconGem size={13} color="#fff" />
              </button>
            </div>
            <div className="text-xs text-[#a98fb8]">×10 гарантирует минимум одну ЭПИЧЕСКУЮ награду</div>
            <button onClick={onClose} className="btn-ghost clip-btn px-6 py-2 text-sm">ЗАКРЫТЬ</button>
          </div>
        ) : (
          <div className="mt-6">
            <div className={`grid justify-center gap-3 ${results.length > 1 ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-1"}`}>
              {results.map((b, i) => {
                const meta = RARITY_META[b.rarity];
                const shown = i < revealed;
                return (
                  <div
                    key={i}
                    className={`relative flex h-36 w-full flex-col items-center justify-center overflow-hidden px-2 text-center ${results.length === 1 ? "h-44 w-56" : ""}`}
                    style={{
                      background: shown
                        ? `linear-gradient(160deg, ${meta.color}26, rgba(10,5,18,0.9))`
                        : "linear-gradient(160deg, rgba(40,20,60,0.9), rgba(10,5,18,0.95))",
                      border: `1px solid ${shown ? meta.color : "rgba(255,255,255,0.15)"}`,
                      boxShadow: shown ? `0 0 24px ${meta.glow}` : "none",
                      clipPath: "polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%)",
                      transform: shown ? undefined : "rotateY(0deg)",
                    }}
                  >
                    {shown ? (
                      <div className="anim-card">
                        <div className="flex justify-center" style={{ color: meta.color }}>
                          <IconGem size={results.length === 1 ? 40 : 26} />
                        </div>
                        <div className="mt-1 font-display text-[10px] tracking-widest" style={{ color: meta.color }}>
                          {meta.name}
                        </div>
                        <div className="mt-1 text-xs leading-tight font-bold text-[#f7ecf2]">{b.name}</div>
                        <div className="mt-1 text-[10px] text-[#cbb8d8]">{b.desc}</div>
                      </div>
                    ) : (
                      <div className="font-display text-2xl text-white/25">✦</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-6 flex justify-center gap-4">
              {revealed >= results.length && (
                <>
                  <button onClick={() => setResults(null)} className="btn-blade clip-btn px-8 py-3">ЕЩЁ ПРИЗЫВ</button>
                  <button onClick={onClose} className="btn-ghost clip-btn px-8 py-3">ЗАБРАТЬ</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Backdrop>
  );
}

// ---------- поражение ----------

export function GameOverOverlay({
  stats,
  crystals,
  lostRunes,
  onRevive,
  onRestart,
  onMenu,
}: {
  stats: RunStats;
  crystals: number;
  lostRunes: number;
  onRevive: () => void;
  onRestart: () => void;
  onMenu: () => void;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex flex-col items-center justify-center bg-black px-4">
      <div className="souls-death font-display text-center text-6xl tracking-[0.24em] text-[#d8d0c0] md:text-8xl" style={{ textShadow: "0 0 40px rgba(255,46,77,0.35)" }}>
        ТЫ УМЕР
      </div>
      <div className="mt-4 text-center text-sm text-[#8f867a]">
        {lostRunes > 0
          ? `${lostRunes} рун осталось на месте гибели — воскресни и вернись за ними`
          : "Тьма сомкнулась... но клятва сильнее смерти"}
      </div>
      <div
        className={`mt-10 flex flex-col items-center gap-3 transition-opacity duration-700 ${ready ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <div className="mb-1 text-xs text-[#a98fb8]">
          Уровень {stats.level} · Убийств {stats.kills} · Время {Math.floor(stats.time / 60)}:{String(Math.floor(stats.time % 60)).padStart(2, "0")}
        </div>
        <button
          onClick={onRevive}
          disabled={crystals < 40}
          className="btn-blade clip-btn flex items-center justify-center gap-2 px-10 py-3.5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ВОЗРОДИТЬСЯ У МЕСТА ГИБЕЛИ — 40 <IconGem size={14} color="#fff" />
        </button>
        <div className="flex gap-3">
          <button onClick={onRestart} className="btn-ghost clip-btn px-6 py-2.5 text-sm">НАЧАТЬ ЗАНОВО</button>
          <button onClick={onMenu} className="btn-ghost clip-btn px-6 py-2.5 text-sm">В МЕНЮ</button>
        </div>
      </div>
    </div>
  );
}

// ---------- финал ----------

export function EndingScreen({
  stats,
  summons,
  onAgain,
  onMenu,
}: {
  stats: RunStats;
  summons: number;
  onAgain: () => void;
  onMenu: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const petals = Array.from({ length: 46 }, (_, i) => ({
      x: Math.random() * 2000,
      y: Math.random() * 1200,
      s: 3 + Math.random() * 5,
      sp: 30 + Math.random() * 50,
      ph: i,
    }));
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const t = now / 1000;
      const W = (canvas.width = window.innerWidth);
      const H = (canvas.height = window.innerHeight);
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#3a1030");
      sky.addColorStop(0.45, "#c2445e");
      sky.addColorStop(0.75, "#ff9f43");
      sky.addColorStop(1, "#ffd166");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      // солнце
      const sg = ctx.createRadialGradient(W / 2, H * 0.62, 10, W / 2, H * 0.62, H * 0.34);
      sg.addColorStop(0, "rgba(255,246,216,0.95)");
      sg.addColorStop(1, "rgba(255,246,216,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, W, H);
      // холмы
      ctx.fillStyle = "rgba(58,16,48,0.85)";
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.quadraticCurveTo(W * 0.25, H * 0.72, W * 0.5, H * 0.8);
      ctx.quadraticCurveTo(W * 0.75, H * 0.88, W, H * 0.74);
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
      // группа: герой и три героини
      const gy = H * 0.72;
      const cx = W / 2;
      const gap = Math.min(120, W / 7);
      drawChibi(ctx, { x: cx - gap * 1.5, y: gy, scale: 2.1, t, face: 1, moving: false, palette: { hair: "#ff4d6d", hairDark: "#c22747", skin: "#ffe3d3", dress: "#a4133c", accent: "#ffd166", eyes: "#ffc94d" }, style: "long", weapon: "blade", glow: "#ff2e4d" });
      drawChibi(ctx, { x: cx - gap * 0.5, y: gy + 10, scale: 2.1, t: t + 1, face: 1, moving: false, palette: { hair: "#bfe6ff", hairDark: "#7cc7ff", skin: "#fff0e8", dress: "#1d5c8f", accent: "#bfe6ff", eyes: "#4dc9ff" }, style: "twintail", weapon: "bow", glow: "#7cc7ff" });
      drawChibi(ctx, { x: cx + gap * 0.5, y: gy + 10, scale: 2.1, t: t + 2, face: -1, moving: false, palette: { hair: "#ffd166", hairDark: "#e0a83c", skin: "#ffe9dc", dress: "#5a2e8f", accent: "#35f0d0", eyes: "#7bffce" }, style: "bob", weapon: "staff", glow: "#35f0d0" });
      drawChibi(ctx, { x: cx + gap * 1.5, y: gy, scale: 2.3, t: t + 3, face: -1, moving: false, palette: { hair: "#dfe6f2", hairDark: "#9aa8c7", skin: "#ffe3d3", dress: "#232946", accent: "#ffd166", eyes: "#ff2e4d" }, style: "spiky", weapon: "blade", glow: "#ffd166" });
      // сердечки
      for (let i = 0; i < 6; i++) {
        const hx = cx + Math.sin(t * 0.8 + i * 1.9) * gap * 1.8;
        const hy = gy - 90 - ((t * 26 + i * 47) % 130);
        ctx.fillStyle = `rgba(255,107,138,${0.8 - (((t * 26 + i * 47) % 130) / 130) * 0.8})`;
        ctx.beginPath();
        const hs = 6 + (i % 3) * 2;
        ctx.moveTo(hx, hy + hs * 0.4);
        ctx.bezierCurveTo(hx - hs, hy - hs * 0.5, hx - hs * 0.5, hy - hs * 1.2, hx, hy - hs * 0.4);
        ctx.bezierCurveTo(hx + hs * 0.5, hy - hs * 1.2, hx + hs, hy - hs * 0.5, hx, hy + hs * 0.4);
        ctx.fill();
      }
      // лепестки
      for (const p of petals) {
        const px = (p.x + Math.sin(t + p.ph) * 30 - t * p.sp * 0.4) % W;
        const py = (p.y + t * p.sp) % H;
        ctx.fillStyle = "rgba(255,190,210,0.75)";
        ctx.beginPath();
        ctx.ellipse((px + W) % W, py, p.s, p.s * 0.55, t + p.ph, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(draw);
    sfx.victory();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden select-none">
      <canvas ref={ref} className="absolute inset-0" />
      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full flex-col items-center justify-center px-6 py-10">
          <div className="anim-pop text-center">
            <div className="font-display text-sm tracking-[0.5em] text-white/85">ВЛАДЫКА ДЕМОНОВ ПОВЕРЖЕН</div>
            <h2 className="font-display title-glow mt-2 text-5xl md:text-7xl">СВАДЬБА ГЕРОЯ</h2>
          </div>

          <div className="anim-rise panel-dark clip-panel mt-8 max-w-2xl px-8 py-6 text-center" style={{ animationDelay: "0.2s" }}>
            <p className="text-lg leading-relaxed text-[#f7ecf2]">
              Зеррис пал от твоего клинка, Кай. Элирия встречает рассвет — первый за десять лет войны.
              А рядом — те, кто прошёл с тобой путь от Леса Забвения до трона из костей...
            </p>
            <div className="mt-5 grid gap-3 text-left md:grid-cols-3">
              {HEROINES.map((h) => (
                <div key={h.id} className="clip-btn px-4 py-3" style={{ background: `${h.glow}14`, border: `1px solid ${h.glow}55` }}>
                  <div className="flex items-center gap-2">
                    <IconHeart size={14} color="#ff6b8a" />
                    <span className="font-display text-sm" style={{ color: h.hair }}>{h.name} · твоя жена</span>
                  </div>
                  <div className="mt-1.5 text-xs text-[#cbb8d8] italic">«{h.loveLine}»</div>
                </div>
              ))}
            </div>
          </div>

          <div className="anim-rise mt-6 grid grid-cols-2 gap-3 text-center md:grid-cols-4" style={{ animationDelay: "0.35s" }}>
            {[
              ["ВРЕМЯ", `${Math.floor(stats.time / 60)}:${String(Math.floor(stats.time % 60)).padStart(2, "0")}`],
              ["УРОВЕНЬ", String(stats.level)],
              ["УБИЙСТВ", String(stats.kills)],
              ["ПРИЗЫВОВ", String(summons)],
            ].map(([k, v]) => (
              <div key={k} className="hud-chip clip-panel px-6 py-3">
                <div className="font-display text-2xl text-[#ffd166]">{v}</div>
                <div className="text-[10px] tracking-[0.3em] text-[#a98fb8]">{k}</div>
              </div>
            ))}
          </div>

          <div className="anim-rise mt-7 flex gap-4" style={{ animationDelay: "0.5s" }}>
            <button onClick={onAgain} className="btn-blade clip-btn px-10 py-3.5 text-lg">НОВАЯ ЛЕГЕНДА</button>
            <button onClick={onMenu} className="btn-ghost clip-btn px-8 py-3.5">В МЕНЮ</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- сетевой мультиплеер ----------

export function NetworkModal({
  onClose,
  onReady,
}: {
  onClose: () => void;
  onReady: (link: NetLink, role: NetRole) => void;
}) {
  const [mode, setMode] = useState<"pick" | "host" | "join">("pick");
  const [roomCode, setRoomCode] = useState("");
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const linkRef = useRef<NetLink | null>(null);
  const readyRef = useRef(false);

  const cleanup = () => {
    if (linkRef.current && !readyRef.current) linkRef.current.close();
    linkRef.current = null;
  };

  const close = () => {
    cleanup();
    onClose();
  };

  const startHost = () => {
    sfx.ui();
    setError("");
    setMode("host");
    setRoomCode("");
    setStatus("Создаём комнату...");
    const link = new NetLink("host", {
      onRoomReady: (code) => {
        setRoomCode(code);
        setStatus("Ждём напарника — передай ему код:");
      },
      onConnected: () => {
        if (readyRef.current) return;
        readyRef.current = true;
        sfx.join();
        onReady(link, "host");
      },
      onClose: (reason) => {
        if (!readyRef.current) {
          setStatus("");
          setError(reason || "Соединение закрыто");
          setMode("pick");
        }
      },
      onError: (text) => {
        setError(text);
        setStatus("");
        setMode("pick");
      },
      onData: () => undefined,
    });
    linkRef.current = link;
    link.host();
  };

  const startJoin = () => {
    const code = input.trim().toUpperCase();
    if (code.length < 4) {
      setError("Введи код комнаты из 4 символов");
      return;
    }
    sfx.ui();
    setError("");
    setMode("join");
    setStatus("Подключаемся к комнате " + code + "...");
    const link = new NetLink("guest", {
      onConnected: () => {
        if (readyRef.current) return;
        readyRef.current = true;
        sfx.join();
        onReady(link, "guest");
      },
      onClose: (reason) => {
        if (!readyRef.current) {
          setStatus("");
          setError(reason || "Не удалось подключиться");
          setMode("pick");
        }
      },
      onError: (text) => {
        setError(text);
        setStatus("");
        setMode("pick");
      },
      onData: () => undefined,
    });
    linkRef.current = link;
    link.join(code);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      sfx.crystal();
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]">
      <div className="panel-dark clip-panel anim-pop relative w-full max-w-xl overflow-hidden px-8 py-8">
        <div className="stripe-overlay" style={{ opacity: 0.4 }} />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-display text-[10px] tracking-[0.45em] text-[#7cc7ff]">WEBRTC · P2P</div>
              <div className="font-display mt-1 text-3xl text-[#f7ecf2]">СЕТЕВАЯ ИГРА</div>
            </div>
            <button onClick={close} className="btn-ghost clip-btn flex h-9 w-9 items-center justify-center text-lg">✕</button>
          </div>

          {error && (
            <div className="anim-rise mt-4 border border-[#ff2e4d]/50 bg-[#3a0f18]/60 px-4 py-2.5 text-sm text-[#ff9db0]">
              ⚠ {error}
            </div>
          )}

          {mode === "pick" && (
            <div className="mt-6 flex flex-col gap-4">
              <button onClick={startHost} className="skew-btn group flex items-center justify-between px-8 py-5 text-left">
                <span>
                  <span className="font-display block text-xl">СОЗДАТЬ КОМНАТУ</span>
                  <span className="mt-0.5 block text-xs font-semibold opacity-80">ты — хост: мир, волны и боссы считаются у тебя</span>
                </span>
                <span className="text-2xl transition-transform group-hover:translate-x-1">▸</span>
              </button>
              <button onClick={() => { sfx.ui(); setError(""); setMode("join"); }} className="skew-btn ghost group flex items-center justify-between px-8 py-5 text-left">
                <span>
                  <span className="font-display block text-xl">ПОДКЛЮЧИТЬСЯ ПО КОДУ</span>
                  <span className="mt-0.5 block text-xs font-semibold opacity-80">введи код друга и вступай в его мир</span>
                </span>
                <span className="text-2xl transition-transform group-hover:translate-x-1">▸</span>
              </button>
              <p className="mt-1 text-center text-xs leading-relaxed text-[#a98fb8]">
                Соединение устанавливается напрямую между браузерами (WebRTC) — сервер игры не нужен.
                <br />
                Работает в современном браузере; обоим игрокам нужен интернет.
              </p>
            </div>
          )}

          {mode === "host" && (
            <div className="mt-6 text-center">
              <div className="text-sm font-semibold text-[#cbb8d8]">{status}</div>
              {roomCode && (
                <>
                  <div className="anim-rise mt-4 inline-flex items-center gap-4 border border-[#ffd166]/60 bg-[#241a08]/70 px-8 py-4">
                    <span className="font-display text-5xl tracking-[0.4em] text-[#ffd166]" style={{ textShadow: "0 0 24px rgba(255,209,102,0.6)" }}>
                      {roomCode}
                    </span>
                    <button onClick={copyCode} className="btn-ghost clip-btn px-4 py-2.5 text-xs">
                      {copied ? "СКОПИРОВАНО ✓" : "КОПИРОВАТЬ"}
                    </button>
                  </div>
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-[#7cc7ff]">
                    <span className="net-dot" /> Напарник появится здесь автоматически...
                  </div>
                </>
              )}
              <button onClick={() => { sfx.ui(); cleanup(); setError(""); setMode("pick"); }} className="btn-ghost clip-btn mt-6 px-8 py-2.5 text-sm">
                ОТМЕНА
              </button>
            </div>
          )}

          {mode === "join" && (
            <div className="mt-6 text-center">
              {status ? (
                <>
                  <div className="text-sm font-semibold text-[#cbb8d8]">{status}</div>
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-[#7cc7ff]">
                    <span className="net-dot" /> Устанавливаем связь...
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm font-semibold text-[#cbb8d8]">Введи код комнаты друга:</div>
                  <input
                    autoFocus
                    value={input}
                    maxLength={6}
                    onChange={(e) => setInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && startJoin()}
                    placeholder="XXXX"
                    className="font-display mt-4 w-48 border border-[#7cc7ff]/50 bg-[#081420]/80 px-4 py-3 text-center text-3xl tracking-[0.5em] text-[#bfe6ff] outline-none placeholder:text-[#3a5a7a] focus:border-[#7cc7ff] focus:shadow-[0_0_20px_rgba(124,199,255,0.35)]"
                  />
                  <div className="mt-5 flex justify-center gap-3">
                    <button onClick={startJoin} className="skew-btn px-10 py-3">ПОДКЛЮЧИТЬСЯ</button>
                    <button onClick={() => { sfx.ui(); setError(""); setMode("pick"); }} className="btn-ghost clip-btn px-8 py-3 text-sm">
                      НАЗАД
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function NetLostOverlay({ reason, onLeave }: { reason: string; onLeave: () => void }) {
  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="panel-dark clip-panel anim-pop w-full max-w-md border-[#ff2e4d]/50 px-9 py-8 text-center">
        <div className="font-display text-3xl text-[#ff2e4d]" style={{ textShadow: "0 0 26px rgba(255,46,77,0.6)" }}>
          СВЯЗЬ ПОТЕРЯНА
        </div>
        <p className="mt-3 text-sm text-[#cbb8d8]">{reason}</p>
        <p className="mt-1.5 text-xs text-[#a98fb8]">Прогресс забега хоста сохранён у него на экране.</p>
        <button onClick={onLeave} className="btn-blade clip-btn mt-6 px-10 py-3">В ГЛАВНОЕ МЕНЮ</button>
      </div>
    </div>
  );
}
