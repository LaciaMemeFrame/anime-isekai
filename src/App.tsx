// Машина состояний: меню → заставка → игра → финал. Прогресс сохраняется в localStorage.

import { useCallback, useEffect, useRef, useState } from "react";
import { Engine, type HudSnapshot, type RunSave, type RunStats } from "./game/engine";
import { BLESSINGS, GACHA_SINGLE, GACHA_TEN, HEROINES, RARITY_META, type BlessingDef, type UpgradeDef } from "./game/data";
import { isMuted, setMuted, sfx, startAmbient, unlockAudio } from "./game/audio";
import { setTrack, setMusicVolume, unlockMusic } from "./game/music";
import { TitleScreen, IntroCinematic } from "./ui/Intro";
import { Hud } from "./ui/Hud";
import { PauseOverlay, LevelUpModal, JoinScene, GachaModal, GameOverOverlay, EndingScreen } from "./ui/Modals";

type Phase = "title" | "intro" | "game" | "ending";
type Overlay =
  | null
  | { kind: "pause" }
  | { kind: "levelup"; choices: UpgradeDef[] }
  | { kind: "join"; id: string }
  | { kind: "gacha"; auto: boolean }
  | { kind: "gameover" };

interface Meta {
  bestLevel: number;
  bestKills: number;
  totalKills: number;
  totalSummons: number;
}

const META_KEY = "rebirth-meta-v2";
const SAVE_KEY = "rebirth-save-v2";

function loadMeta(): Meta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) return { bestLevel: 0, bestKills: 0, totalKills: 0, totalSummons: 0, ...JSON.parse(raw) };
  } catch {
    /* noop */
  }
  return { bestLevel: 0, bestKills: 0, totalKills: 0, totalSummons: 0 };
}

function loadSave(): RunSave | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as RunSave;
      if (s && s.v === 1 && typeof s.level === "number") return s;
    }
  } catch {
    /* noop */
  }
  return null;
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("title");
  const [gift, setGift] = useState("blade");
  const [runId, setRunId] = useState(0);
  const [meta, setMeta] = useState<Meta>(loadMeta);
  const [endingStats, setEndingStats] = useState<RunStats | null>(null);
  const [summons, setSummons] = useState(0);
  const [muted, setMutedState] = useState(isMuted());
  const [resumeSave, setResumeSave] = useState<RunSave | null>(null);
  const [coOp, setCoOp] = useState(false);

  const saveMeta = useCallback((patch: Partial<Meta>) => {
    setMeta((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(META_KEY, JSON.stringify(next));
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

  const toggleMute = useCallback(() => {
    const m = !isMuted();
    setMuted(m);
    setMusicVolume(m ? 0 : 0.16);
    setMutedState(m);
    if (!m) sfx.ui();
  }, []);

  const clearRunSave = useCallback(() => {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* noop */
    }
  }, []);

  // Музыка по фазе (кроме игры — там решает движок: мир/бой/босс)
  useEffect(() => {
    if (phase === "title") setTrack("title");
    else if (phase === "intro") setTrack("goddess");
    else if (phase === "ending") setTrack("ending");
  }, [phase]);

  if (phase === "title") {
    return (
      <div className="h-screen w-screen">
        <TitleScreen
          best={meta.bestLevel > 0 ? { level: meta.bestLevel, kills: meta.bestKills } : null}
          hasSave={loadSave() !== null}
          totalKills={meta.totalKills}
          totalSummons={meta.totalSummons}
          onStart={(co) => {
            startAmbient();
            clearRunSave();
            setResumeSave(null);
            setCoOp(!!co);
            setRunId((r) => r + 1);
            setSummons(0);
            setPhase("intro");
          }}
          onContinue={() => {
            const s = loadSave();
            if (!s) return;
            startAmbient();
            setGift(s.classId);
            setResumeSave(s);
            setRunId((r) => r + 1);
            setSummons(0);
            setPhase("game");
          }}
        />
      </div>
    );
  }

  if (phase === "intro") {
    return (
      <div className="h-screen w-screen">
        <IntroCinematic
          onDone={(g) => {
            setGift(g);
            setPhase("game");
          }}
        />
      </div>
    );
  }

  if (phase === "ending" && endingStats) {
    return (
      <div className="h-screen w-screen">
        <EndingScreen
          stats={endingStats}
          summons={summons}
          onAgain={() => {
            clearRunSave();
            setResumeSave(null);
            setRunId((r) => r + 1);
            setSummons(0);
            setEndingStats(null);
            setPhase("intro");
          }}
          onMenu={() => {
            setEndingStats(null);
            setPhase("title");
          }}
        />
      </div>
    );
  }

  return (
    <GameView
      key={runId}
      gift={gift}
      resumeSave={resumeSave}
      coOp={coOp}
      muted={muted}
      onToggleMute={toggleMute}
      onSummoned={(n: number) => {
        setSummons((s) => s + n);
        saveMeta({ totalSummons: meta.totalSummons + n });
      }}
      onVictory={(stats) => {
        clearRunSave();
        saveMeta({
          bestLevel: Math.max(meta.bestLevel, stats.level),
          bestKills: stats.kills > meta.bestKills && stats.level >= meta.bestLevel ? stats.kills : meta.bestKills,
          totalKills: meta.totalKills + stats.kills,
        });
        setEndingStats(stats);
        setPhase("ending");
      }}
      onDefeat={(level, kills) => {
        saveMeta({
          bestLevel: Math.max(meta.bestLevel, level),
          bestKills: kills > meta.bestKills && level >= meta.bestLevel ? kills : meta.bestKills,
          totalKills: meta.totalKills + kills,
        });
      }}
      onRunSaved={(save) => {
        try {
          localStorage.setItem(SAVE_KEY, JSON.stringify(save));
        } catch {
          /* noop */
        }
      }}
      onRunInvalidated={clearRunSave}
    />
  );
}

// ======================= игровой экран =======================

function GameView({
  gift,
  resumeSave,
  coOp,
  muted,
  onToggleMute,
  onSummoned,
  onVictory,
  onDefeat,
  onRunSaved,
  onRunInvalidated,
}: {
  gift: string;
  resumeSave: RunSave | null;
  coOp: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onSummoned: (n: number) => void;
  onVictory: (s: RunStats) => void;
  onDefeat: (level: number, kills: number) => void;
  onRunSaved: (save: RunSave) => void;
  onRunInvalidated: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [snap, setSnap] = useState<HudSnapshot | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [joinQueue, setJoinQueue] = useState<string[]>([]);
  const overlayRef = useRef<Overlay>(null);
  overlayRef.current = overlay;
  const queueRef = useRef<string[]>([]);
  queueRef.current = joinQueue;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const engine = new Engine(canvas, {
      onLevelUp: (choices) => setOverlay({ kind: "levelup", choices }),
      onChapterEnd: (chapter) => {
        // героини присоединяются: Ария — после главы I, Юки — после III, Лира — после IV
        const q = chapter === 0 ? ["aria"] : chapter === 2 ? ["yuki"] : chapter === 3 ? ["lira"] : [];
        engine.addCrystals(q.length > 0 ? 40 : 60);
        if (q.length > 0) {
          setJoinQueue(q);
          setOverlay({ kind: "join", id: q[0] });
        } else {
          engine.setPaused(true);
          setOverlay({ kind: "gacha", auto: true });
        }
      },
      onVictory: (stats) => {
        onRunInvalidated();
        onVictory(stats);
      },
      onGameOver: () => {
        onDefeat(engine.getStats().level, engine.getStats().kills);
        setOverlay({ kind: "gameover" });
      },
      onSave: (save) => onRunSaved(save),
    });
    engineRef.current = engine;
    if (resumeSave) engine.loadSave(resumeSave);
    else engine.start(gift, coOp);
    unlockAudio();
    unlockMusic();
    startAmbient();

    const iv = setInterval(() => setSnap(engine.snapshot()), 100);
    return () => {
      clearInterval(iv);
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Музыка внутри игры: босс → бой → мир
  const bossAlive = !!snap?.boss;
  const gameMode = snap?.mode;
  useEffect(() => {
    if (bossAlive) setTrack("boss");
    else if (gameMode === "battle") setTrack("battle");
    else if (gameMode === "world") setTrack("world");
  }, [bossAlive, gameMode]);

  // ESC — пауза, M — звук
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ov = overlayRef.current;
      if (e.code === "Escape") {
        if (ov === null) {
          engineRef.current?.setPaused(true);
          setOverlay({ kind: "pause" });
          sfx.ui();
        } else if (ov.kind === "pause") {
          engineRef.current?.setPaused(false);
          setOverlay(null);
          sfx.ui();
        }
      }
      if (e.code === "KeyM") onToggleMute();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onToggleMute]);

  const resume = () => {
    engineRef.current?.setPaused(false);
    setOverlay(null);
  };

  const doPull = (count: number): BlessingDef[] | null => {
    const engine = engineRef.current;
    if (!engine) return null;
    const cost = count === 1 ? GACHA_SINGLE : GACHA_TEN;
    if (!engine.spendCrystals(cost)) return null;
    const res: BlessingDef[] = [];
    for (let i = 0; i < count; i++) {
      const r = Math.random() * 100;
      let rarity: BlessingDef["rarity"] =
        r < RARITY_META.legend.w ? "legend" : r < RARITY_META.legend.w + RARITY_META.epic.w ? "epic" : "rare";
      if (count === 10 && i === 9 && rarity === "rare" && !res.some((b) => b.rarity !== "rare")) rarity = "epic";
      const pool = BLESSINGS.filter((b) => b.rarity === rarity);
      res.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    onSummoned(count);
    setSnap(engine.snapshot());
    return res;
  };

  // стабильный колбэк: модалка гачи не должна зависеть от ре-рендеров
  const applyBlessing = useCallback((b: BlessingDef) => {
    engineRef.current?.applyBlessing(b.id);
  }, []);

  const onJoinDone = () => {
    const rest = queueRef.current.slice(1);
    if (rest.length > 0) {
      setJoinQueue(rest);
      setOverlay({ kind: "join", id: rest[0] });
    } else {
      setJoinQueue([]);
      setOverlay({ kind: "gacha", auto: true });
    }
  };

  const closeGacha = () => {
    const engine = engineRef.current;
    const wasAuto = (overlayRef.current as Overlay)?.kind === "gacha" && (overlayRef.current as { auto?: boolean }).auto;
    setOverlay(null);
    if (engine) {
      if (wasAuto) engine.nextChapter();
      engine.setPaused(false);
    }
  };

  const heroinesById = (id: string) => HEROINES.find((h) => h.id === id)!;

  return (
    <div className="relative h-screen w-screen cursor-crosshair overflow-hidden bg-[#0b0512]">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <Hud
        snap={snap}
        muted={muted}
        onSummon={() => {
          if (overlayRef.current === null) {
            engineRef.current?.setPaused(true);
            setOverlay({ kind: "gacha", auto: false });
            sfx.ui();
          }
        }}
        onPause={() => {
          if (overlayRef.current === null) {
            engineRef.current?.setPaused(true);
            setOverlay({ kind: "pause" });
            sfx.ui();
          }
        }}
        onToggleMute={onToggleMute}
      />

      {overlay?.kind === "pause" && (
        <PauseOverlay
          stats={engineRef.current?.getStats() ?? { time: 0, kills: 0, level: 1, crystals: 0 }}
          onResume={resume}
          onRestart={() => {
            onRunInvalidated();
            engineRef.current?.start(gift);
            setOverlay(null);
          }}
          onMenu={() => window.location.reload()}
        />
      )}

      {overlay?.kind === "levelup" && (
        <LevelUpModal
          level={snap?.level ?? 1}
          choices={overlay.choices}
          onPick={(id) => {
            engineRef.current?.applyUpgrade(id);
            setOverlay(null);
          }}
        />
      )}

      {overlay?.kind === "join" && <JoinScene key={overlay.id} def={heroinesById(overlay.id)} onDone={onJoinDone} />}

      {overlay?.kind === "gacha" && (
        <GachaModal
          crystals={snap?.crystals ?? 0}
          onPull={doPull}
          onApply={applyBlessing}
          onClose={closeGacha}
        />
      )}

      {overlay?.kind === "gameover" && (
        <GameOverOverlay
          stats={engineRef.current?.getStats() ?? { time: 0, kills: 0, level: 1, crystals: 0 }}
          crystals={snap?.crystals ?? 0}
          lostRunes={snap?.lostRunes ?? 0}
          onRevive={() => {
            engineRef.current?.revive();
            setOverlay(null);
          }}
          onRestart={() => {
            onRunInvalidated();
            engineRef.current?.start(gift);
            setOverlay(null);
          }}
          onMenu={() => window.location.reload()}
        />
      )}
    </div>
  );
}
