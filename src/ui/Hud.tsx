// Боевой HUD: здоровье, опыт, глава, босс, навыки, отряд, комбо.

import { useEffect, useState } from "react";
import type { HudSnapshot } from "../game/engine";
import { IconBlade, IconWing, IconMoon, IconFury, IconGem, IconPause, IconSound, IconHeart } from "./Intro";

export function Hud({
  snap,
  muted,
  onSummon,
  onPause,
  onToggleMute,
}: {
  snap: HudSnapshot | null;
  muted: boolean;
  onSummon: () => void;
  onPause: () => void;
  onToggleMute: () => void;
}) {
  const [showHints, setShowHints] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowHints(false), 9000);
    return () => clearTimeout(t);
  }, []);

  if (!snap) return null;
  const hpF = Math.max(0, snap.hp / snap.maxHp);
  const xpF = Math.min(1, snap.xp / snap.xpNeed);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none">
      {/* ===== верх слева: герой ===== */}
      <div className="absolute top-4 left-4 flex items-center gap-3">
        <div className="hud-chip clip-panel flex h-16 w-16 items-center justify-center overflow-hidden">
          <div className="relative h-full w-full bg-[#232946]">
            <div className="absolute top-2 left-1/2 h-8 w-8 -translate-x-1/2 rounded-full bg-[#ffe3d3]" />
            <div className="absolute top-1 left-1/2 h-5 w-9 -translate-x-1/2 rounded-t-full bg-[#dfe6f2]" style={{ clipPath: "polygon(0 100%,10% 20%,25% 70%,40% 0,55% 60%,70% 10%,85% 65%,100% 100%)" }} />
            <div className="absolute top-5 left-1/2 flex -translate-x-1/2 gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff2e4d]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff2e4d]" />
            </div>
          </div>
        </div>
        <div className="w-56 md:w-64">
          <div className="mb-1 flex items-end justify-between">
            <span className="font-display text-sm text-[#f7ecf2]">КАЙ · ГЕРОЙ</span>
            <span className="font-display rounded-sm bg-[#ff2e4d] px-2 py-0.5 text-xs text-white shadow-[0_0_12px_rgba(255,46,77,0.6)]">
              УР. {snap.level}
            </span>
          </div>
          <div className="bar-shell clip-btn relative h-4 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 transition-[width] duration-200"
              style={{
                width: `${hpF * 100}%`,
                background: "linear-gradient(90deg,#8f0f28,#ff2e4d 60%,#ff6b8a)",
                boxShadow: "0 0 12px rgba(255,46,77,0.7)",
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/90" style={{ textShadow: "0 1px 2px #000" }}>
              {snap.hp} / {snap.maxHp}
            </div>
          </div>
          <div className="bar-shell clip-btn relative mt-1.5 h-2.5 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 transition-[width] duration-200"
              style={{ width: `${xpF * 100}%`, background: "linear-gradient(90deg,#0e7d6c,#35f0d0)", boxShadow: "0 0 10px rgba(53,240,208,0.6)" }}
            />
          </div>
          <div className="mt-0.5 text-right text-[10px] font-semibold text-[#a98fb8]">
            ОПЫТ {snap.xp}/{snap.xpNeed}
          </div>
        </div>
      </div>

      {/* ===== верх центр: глава / босс ===== */}
      <div className="absolute top-4 left-1/2 w-[min(560px,60vw)] -translate-x-1/2 text-center">
        {snap.boss ? (
          <div>
            <div className="font-display mb-1 text-sm tracking-widest text-[#ff2e4d]" style={{ textShadow: "0 0 12px rgba(255,46,77,0.8)" }}>
              ☠ {snap.boss.name} ☠
            </div>
            <div className="bar-shell clip-btn relative h-5 overflow-hidden border-[#ff2e4d]/60">
              <div
                className="absolute inset-y-0 left-0 transition-[width] duration-200"
                style={{
                  width: `${(snap.boss.hp / snap.boss.maxHp) * 100}%`,
                  background: "linear-gradient(90deg,#5c0a1c,#ff2e4d 55%,#ff9f43)",
                  boxShadow: "0 0 16px rgba(255,46,77,0.8)",
                }}
              />
            </div>
          </div>
        ) : (
          <div>
            <div className="font-display text-sm tracking-[0.25em] text-[#ffd166]">{snap.chapterName}</div>
            <div className="mt-1.5 flex items-center justify-center gap-1.5">
              {Array.from({ length: snap.wavesTotal + 1 }, (_, i) => (
                <span
                  key={i}
                  className={`h-2 w-6 skew-x-[-16deg] ${
                    i < snap.wave
                      ? "bg-[#ff2e4d] shadow-[0_0_8px_rgba(255,46,77,0.7)]"
                      : i === snap.wave
                        ? "bg-[#ffd166] shadow-[0_0_8px_rgba(255,209,102,0.8)] anim-pulse-gold"
                        : "bg-white/15"
                  }`}
                />
              ))}
            </div>
            <div className="mt-0.5 text-[10px] font-bold tracking-widest text-[#a98fb8]">
              ВОЛНА {Math.min(snap.wave, snap.wavesTotal)}/{snap.wavesTotal} · ДАЛЬШЕ — БОСС
            </div>
          </div>
        )}
      </div>

      {/* ===== верх справа: ресурсы и кнопки ===== */}
      <div className="pointer-events-auto absolute top-4 right-4 flex items-center gap-2">
        <div className="hud-chip clip-btn flex items-center gap-2 px-3 py-2">
          <IconGem size={16} color="#7cc7ff" />
          <span className="font-display text-sm text-[#7cc7ff]">{snap.crystals}</span>
        </div>
        <div className="hud-chip clip-btn hidden items-center gap-2 px-3 py-2 sm:flex">
          <IconBlade size={15} color="#ff9f43" />
          <span className="font-display text-sm text-[#ff9f43]">{snap.kills}</span>
        </div>
        <button onClick={onSummon} className="btn-blade clip-btn flex items-center gap-2 px-4 py-2 text-sm" title="Гача-призыв (кристаллы)">
          <IconGem size={15} color="#fff" /> ПРИЗЫВ
        </button>
        <button onClick={onPause} className="btn-ghost clip-btn flex h-9 w-9 items-center justify-center">
          <IconPause size={15} />
        </button>
        <button onClick={onToggleMute} className="btn-ghost clip-btn flex h-9 w-9 items-center justify-center">
          <IconSound size={15} off={muted} />
        </button>
      </div>

      {/* ===== низ слева: отряд ===== */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-2">
        <div className="font-display text-[10px] tracking-[0.3em] text-[#a98fb8]">ОТРЯД ГЕРОЯ</div>
        {snap.party.length === 0 && (
          <div className="hud-chip clip-btn px-3 py-2 text-xs text-[#a98fb8]">Ты пока один... спасай девушек!</div>
        )}
        {snap.party.map((h) => (
          <div key={h.id} className="hud-chip clip-btn flex items-center gap-2.5 px-2.5 py-1.5">
            <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-sm" style={{ background: h.color }}>
              <span className="absolute top-1.5 left-1/2 h-5 w-5 -translate-x-1/2 rounded-full bg-[#ffe9dc]" />
              <span className="absolute top-3 left-1/2 flex -translate-x-1/2 gap-1">
                <i className="h-1 w-1 rounded-full bg-[#1c1024]" style={{ fontStyle: "normal" }} />
                <i className="h-1 w-1 rounded-full bg-[#1c1024]" style={{ fontStyle: "normal" }} />
              </span>
            </span>
            <span className="font-display text-xs" style={{ color: h.color }}>{h.name}</span>
            <IconHeart size={11} color="#ff6b8a" />
          </div>
        ))}
      </div>

      {/* ===== низ справа: навыки ===== */}
      <div className="absolute right-4 bottom-4 flex items-end gap-2.5">
        <SkillBox label="ЛКМ" name="Клинок" ready iconColor="#f7ecf2">
          <IconBlade size={20} color="#f7ecf2" />
        </SkillBox>
        <SkillBox label="SPACE" name="Рывок" cd={snap.dashCd} max={snap.dashMax} iconColor="#ffd166">
          <IconWing size={20} color="#ffd166" />
        </SkillBox>
        <SkillBox label="Q" name="Волна" cd={snap.waveCd} max={snap.waveMax} iconColor="#35f0d0">
          <IconMoon size={20} color="#35f0d0" />
        </SkillBox>
        <SkillBox label="E" name="Ярость" ult={snap.ult} iconColor={snap.ult >= 100 ? "#ffd166" : "#a98fb8"}>
          <IconFury size={20} color={snap.ult >= 100 ? "#ffd166" : "#a98fb8"} />
        </SkillBox>
      </div>

      {/* ===== комбо ===== */}
      {snap.combo > 1 && (
        <div key={snap.combo} className="anim-combo absolute top-1/3 right-[8%] text-right">
          <div className="font-display text-5xl text-[#ffd166]" style={{ textShadow: "0 0 18px rgba(255,159,67,0.9), 0 3px 0 #5c0a1c" }}>
            ×{snap.combo}
          </div>
          <div className="font-display text-xs tracking-[0.4em] text-[#ff9f43]">КОМБО</div>
        </div>
      )}

      {/* ===== подсказки ===== */}
      {showHints && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 transition-opacity duration-1000" style={{ opacity: showHints ? 0.9 : 0 }}>
          <div className="hud-chip clip-btn px-5 py-2 text-xs text-[#cbb8d8]">
            <b className="font-display text-[#ffd166]">WASD</b> бег · <b className="font-display text-[#ffd166]">ЛКМ</b> комбо-удары ·{" "}
            <b className="font-display text-[#ffd166]">SPACE</b> рывок (неуязвимость) · <b className="font-display text-[#ffd166]">Q</b> волна ·{" "}
            <b className="font-display text-[#ffd166]">E</b> ярость
          </div>
        </div>
      )}
    </div>
  );
}

function SkillBox({
  label,
  name,
  children,
  cd = 0,
  max = 1,
  ult,
  ready,
  iconColor,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
  cd?: number;
  max?: number;
  ult?: number;
  ready?: boolean;
  iconColor: string;
}) {
  const frac = ult !== undefined ? ult / 100 : max > 0 ? 1 - Math.min(1, cd / max) : 1;
  const isReady = ready || frac >= 1;
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`hud-chip clip-panel relative h-14 w-14 overflow-hidden ${isReady && ult !== undefined ? "anim-pulse-gold" : ""}`}
        style={isReady ? { borderColor: iconColor } : undefined}
      >
        <div
          className="absolute inset-0"
          style={{
            background: `conic-gradient(${iconColor}44 ${frac * 360}deg, rgba(0,0,0,0.6) 0deg)`,
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
        {!isReady && ult === undefined && (
          <div className="font-display absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-white">
            {cd.toFixed(1)}
          </div>
        )}
        {ult !== undefined && (
          <div className="absolute right-0 bottom-0 left-0 h-1.5 bg-black/60">
            <div className="h-full" style={{ width: `${ult}%`, background: "#ffd166", boxShadow: "0 0 8px rgba(255,209,102,0.9)" }} />
          </div>
        )}
      </div>
      <span className="font-display text-[9px] tracking-widest text-[#a98fb8]">
        {label} · {name.toUpperCase()}
      </span>
    </div>
  );
}
