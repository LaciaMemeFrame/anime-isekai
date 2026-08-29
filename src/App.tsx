// Машина состояний: меню → заставка → игра → финал.

import { useCallback, useEffect, useRef, useState } from "react";
import { Engine, type HudSnapshot, type RunStats } from "./game/engine";
import { BLESSINGS, GACHA_SINGLE, GACHA_TEN, HEROINES, RARITY_META, type BlessingDef, type UpgradeDef } from "./game/data";
import { isMuted, setMuted, sfx, startAmbient, unlockAudio } from "./game/audio";
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

function loadBest(): { level: number; kills: number } | null {
  try {
    const raw = localStorage.getItem("hero-rebirth-best");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("title");
  const [gift, setGift] = useState("blade");
  const [runId, setRunId] = useState(0);
  const [best, setBest] = useState(loadBest);
  const [endingStats, setEndingStats] = useState<RunStats | null>(null);
  const [summons, setSummons] = useState(0);
  const [muted, setMutedState] = useState(isMuted());

  const saveBest = useCallback((level: number, kills: number) => {
    setBest((prev) => {
      const next = !prev || level > prev.level ? { level, kills } : prev;
      try {
        localStorage.setItem("hero-rebirth-best", JSON.stringify(next));
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

  const toggleMute = useCallback(() => {
    const m = !isMuted();
    setMuted(m);
    setMutedState(m);
    if (!m) sfx.ui();
  }, []);

  if (phase === "title") {
    return (
      <div className="h-screen w-screen">
        <TitleScreen
          best={best}
          onStart={() => {
            startAmbient();
            setRunId((r) => r + 1);
            setSummons(0);
            setPhase("intro");
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
            setRunId((r) => r + 1);
            setSummons(0);
            setEndingStats(null);
            setPhase("game");
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
      muted={muted}
      onToggleMute={toggleMute}
      onSummoned={(n: number) => setSummons((s) => s + n)}
      onVictory={(stats) => {
        saveBest(stats.level, stats.kills);
        setEndingStats(stats);
        setPhase("ending");
      }}
      onDefeat={saveBest}
    />
  );
}

// ======================= игровой экран =======================

function GameView({
  gift,
  muted,
  onToggleMute,
  onSummoned,
  onVictory,
  onDefeat,
}: {
  gift: string;
  muted: boolean;
  onToggleMute: () => void;
  onSummoned: (n: number) => void;
  onVictory: (s: RunStats) => void;
  onDefeat: (level: number, kills: number) => void;
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
        const q = chapter === 0 ? ["aria"] : ["yuki", "lira"];
        engine.addCrystals(chapter === 0 ? 40 : 60);
        setJoinQueue(q);
        setOverlay({ kind: "join", id: q[0] });
      },
      onVictory: (stats) => onVictory(stats),
      onGameOver: () => {
        onDefeat(engine.getStats().level, engine.getStats().kills);
        setOverlay({ kind: "gameover" });
      },
    });
    engineRef.current = engine;
    engine.start(gift);
    unlockAudio();
    startAmbient();

    const iv = setInterval(() => setSnap(engine.snapshot()), 100);
    return () => {
      clearInterval(iv);
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // стабильная ссылка: иначе эффект раскрытия карт в гаче сбрасывается каждые 100 мс
  const applyBlessing = useCallback((b: BlessingDef) => {
    engineRef.current?.applyBlessing(b.id);
  }, []);

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
    setOverlay(null);
    if (engine) {
      if ((overlayRef.current as Overlay)?.kind === "gacha" && (overlayRef.current as { auto?: boolean }).auto) {
        engine.nextChapter();
      }
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
          onRevive={() => {
            engineRef.current?.revive();
            setOverlay(null);
          }}
          onRestart={() => {
            engineRef.current?.start(gift);
            setOverlay(null);
          }}
          onMenu={() => window.location.reload()}
        />
      )}
    </div>
  );
}
