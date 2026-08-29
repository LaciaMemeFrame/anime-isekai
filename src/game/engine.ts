// Движок 2D-слэшера: цикл, бой, ИИ, волны, боссы, героини, частицы.

import { sfx } from "./audio";
import {
  CHAPTERS,
  HEROINES,
  ENEMY_BASE,
  UPGRADES,
  BLESSINGS,
  type ChapterDef,
  type EnemyType,
  type HeroineDef,
  type UpgradeDef,
} from "./data";
import { drawChibi, drawDemon } from "./sprites";

export interface RunStats {
  time: number;
  kills: number;
  level: number;
  crystals: number;
}

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  xp: number;
  xpNeed: number;
  level: number;
  crystals: number;
  kills: number;
  combo: number;
  chapter: number;
  chapterName: string;
  wave: number;
  wavesTotal: number;
  boss: { name: string; hp: number; maxHp: number } | null;
  dashCd: number;
  dashMax: number;
  waveCd: number;
  waveMax: number;
  ult: number;
  party: { id: string; name: string; color: string }[];
  mode: "battle" | "world";
  zone: string;
  hint: string;
}

export interface EngineHandlers {
  onLevelUp: (choices: UpgradeDef[]) => void;
  onChapterEnd: (chapter: number) => void;
  onVictory: (stats: RunStats) => void;
  onGameOver: () => void;
}

interface Enemy {
  id: number;
  type: EnemyType;
  kind?: "fire" | "ice" | "demon";
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  r: number;
  speed: number;
  dmg: number;
  face: 1 | -1;
  t: number;
  flash: number;
  touchCd: number;
  state: string;
  stateT: number;
  shootCd: number;
  enraged: boolean;
  xp: number;
  cry: [number, number];
}

interface Proj {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  from: "foe" | "ally";
  life: number;
  color: string;
  kind: "orb" | "shard" | "arrow" | "bolt" | "crescent";
  pierce: number;
  hits: Set<number>;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  glow: boolean;
  grav: number;
}

interface Floater {
  x: number;
  y: number;
  life: number;
  max: number;
  text: string;
  color: string;
  size: number;
}

interface Pickup {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: "xp" | "cry" | "heart";
  v: number;
  t: number;
}

interface Arc {
  x: number;
  y: number;
  ang: number;
  spread: number;
  r: number;
  life: number;
  max: number;
  color: string;
  width: number;
}

interface HeroineUnit {
  def: HeroineDef;
  x: number;
  y: number;
  t: number;
  atkT: number;
  lunge: number;
  tx: number;
  ty: number;
}

interface Bonuses {
  atkP: number;
  hp: number;
  spdP: number;
  critP: number;
  vamp: number;
  xpP: number;
  cryP: number;
  dashP: number;
  ultP: number;
  thorn: boolean;
}

const HERO_PALETTE = {
  hair: "#dfe6f2",
  hairDark: "#9aa8c7",
  skin: "#ffe3d3",
  dress: "#232946",
  accent: "#ffd166",
  eyes: "#ff2e4d",
};

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Engine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private handlers: EngineHandlers;
  private raf = 0;
  private last = 0;
  private destroyed = false;

  private W = 960;
  private H = 640;

  paused = false;
  private frozen = false;
  private dead = false;
  private victoryDone = false;

  private keys = new Set<string>();
  private mouse = { x: 480, y: 320, down: false };

  private player = {
    x: 480,
    y: 420,
    r: 15,
    hp: 100,
    maxHp: 100,
    speed: 258,
    atk: 14,
    crit: 0.12,
    dashMax: 1.15,
    dashCd: 0,
    dashT: 0,
    dashDx: 1,
    dashDy: 0,
    inv: 0,
    face: 1 as 1 | -1,
    moving: false,
    comboIdx: 0,
    comboCd: 0,
    attackT: -1,
    waveMax: 3.4,
    waveCd: 0,
    ult: 0,
    ultT: 0,
    ultTick: 0,
    xp: 0,
    level: 1,
    xpNeed: 46,
    crystals: 0,
    t: 0,
  };

  private bonuses: Bonuses = {
    atkP: 0,
    hp: 0,
    spdP: 0,
    critP: 0,
    vamp: 0,
    xpP: 0,
    cryP: 0,
    dashP: 0,
    ultP: 0,
    thorn: false,
  };

  private enemies: Enemy[] = [];
  private projs: Proj[] = [];
  private parts: Particle[] = [];
  private floats: Floater[] = [];
  private picks: Pickup[] = [];
  private arcs: Arc[] = [];
  private heroines: HeroineUnit[] = [];

  private chapterIdx = 0;
  private waveIdx = -1;
  private spawnQueue: Exclude<EnemyType, "boss">[] = [];
  private spawnT = 0;
  private betweenT = 2;
  private boss: Enemy | null = null;
  private nextId = 1;

  private banner = { text: "", sub: "", t: 0 };
  private shake = 0;
  private hitstop = 0;
  private flashRed = 0;
  private flashWhite = 0;
  private combo = 0;
  private comboT = 0;
  private runTime = 0;
  private kills = 0;
  private ambientT = 0;
  private deco: { x: number; y: number; k: number; s: number }[] = [];
  private blessingId = "blade";

  // ---- открытый мир ----
  private mode: "battle" | "world" = "battle";
  private worldIdx = 0;
  private mapW = 960;
  private mapH = 640;
  private camX = 0;
  private camY = 0;
  private vW = 960;
  private vH = 640;
  private mx = 480;
  private my = 320;
  private wObjs: { kind: "portal" | "spring" | "shrine" | "chest"; x: number; y: number; used: boolean }[] = [];
  private wDeco: { x: number; y: number; k: number; s: number }[] = [];
  private hint = "";
  private interactCd = 0;
  private worldSpawnT = 2.5;
  private springSndT = 0;

  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onMouseMove: (e: MouseEvent) => void;
  private onMouseDown: (e: MouseEvent) => void;
  private onMouseUp: () => void;
  private onResize: () => void;
  private onCtx: (e: Event) => void;

  constructor(canvas: HTMLCanvasElement, handlers: EngineHandlers) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.handlers = handlers;
    if (document.fonts && document.fonts.load) document.fonts.load('16px "Russo One"').catch(() => undefined);

    this.onResize = () => this.resize();
    this.onKeyDown = (e) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
    };
    this.onKeyUp = (e) => this.keys.delete(e.code);
    this.onMouseMove = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    };
    this.onMouseDown = (e) => {
      if (e.button === 0) this.mouse.down = true;
    };
    this.onMouseUp = () => (this.mouse.down = false);
    this.onCtx = (e) => e.preventDefault();

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("resize", this.onResize);
    canvas.addEventListener("mousemove", this.onMouseMove);
    canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    canvas.addEventListener("contextmenu", this.onCtx);

    this.resize();
    this.last = performance.now();
    const tick = (now: number) => {
      if (this.destroyed) return;
      this.raf = requestAnimationFrame(tick);
      let dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (this.hitstop > 0) {
        this.hitstop -= dt;
        dt *= 0.12;
      }
      if (!this.paused && !this.frozen) this.update(dt);
      this.render(now / 1000);
    };
    this.raf = requestAnimationFrame(tick);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("resize", this.onResize);
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.canvas.removeEventListener("contextmenu", this.onCtx);
  }

  private resize() {
    this.W = Math.max(640, window.innerWidth);
    this.H = Math.max(480, window.innerHeight);
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    if (this.mode !== "world") {
      this.player.x = Math.min(Math.max(this.player.x, 30), this.W - 30);
      this.player.y = Math.min(Math.max(this.player.y, 100), this.H - 40);
    }
  }

  // ============================ public API ============================

  start(blessing: string) {
    this.blessingId = blessing;
    const p = this.player;
    p.hp = 100;
    p.maxHp = 100;
    p.atk = 14;
    p.crit = 0.12;
    p.dashMax = 1.15;
    p.waveMax = 3.4;
    p.level = 1;
    p.xp = 0;
    p.xpNeed = 46;
    p.crystals = 20;
    p.ult = 0;
    p.dashCd = 0;
    p.waveCd = 0;
    p.ultT = 0;
    p.inv = 1.5;
    this.bonuses = { atkP: 0, hp: 0, spdP: 0, critP: 0, vamp: 0, xpP: 0, cryP: 0, dashP: 0, ultP: 0, thorn: false };
    if (blessing === "blade") this.bonuses.atkP += 25;
    if (blessing === "heart") {
      this.bonuses.hp += 60;
      p.maxHp = 160;
      p.hp = 160;
    }
    if (blessing === "star") {
      p.crystals = 80;
      this.bonuses.cryP += 15;
    }
    this.heroines = [];
    this.kills = 0;
    this.runTime = 0;
    this.dead = false;
    this.victoryDone = false;
    this.frozen = false;
    this.paused = false;
    this.combo = 0;
    this.startWorld(0);
  }

  setPaused(b: boolean) {
    this.paused = b;
  }

  spendCrystals(n: number): boolean {
    if (this.player.crystals < n) return false;
    this.player.crystals -= n;
    return true;
  }

  addCrystals(n: number) {
    this.player.crystals += n;
  }

  applyBlessing(id: string) {
    const b = BLESSINGS.find((x) => x.id === id);
    if (!b) return;
    const s = b.stat;
    if (s.key === "hp") {
      this.bonuses.hp += s.val;
      this.player.maxHp += s.val;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + s.val);
    } else if (s.key === "dashP") this.bonuses.dashP += s.val;
    else if (s.key === "ultP") this.bonuses.ultP += s.val;
    else this.bonuses[s.key] += s.val;
    sfx.crystal();
  }

  applyUpgrade(id: string) {
    const p = this.player;
    switch (id) {
      case "blade": this.bonuses.atkP += 25; break;
      case "heart":
        this.bonuses.hp += 40;
        p.maxHp += 40;
        p.hp = Math.min(p.maxHp, p.hp + 40);
        break;
      case "wing": this.bonuses.spdP += 12; break;
      case "eye": this.bonuses.critP += 8; break;
      case "fang": this.bonuses.vamp += 4; break;
      case "moon": this.bonuses.dashP = 1 - (1 - this.bonuses.dashP / 100) * 0.75 + 0; this.bonuses.dashP = Math.round(this.bonuses.dashP * 100); break;
      case "star": this.player.waveMax *= 0.7; break;
      case "fury": this.bonuses.ultP += 40; break;
      case "gem": this.bonuses.cryP += 50; break;
      case "thorn": this.bonuses.thorn = true; this.bonuses.atkP += 10; break;
    }
    sfx.ui();
    this.frozen = false;
    if (this.player.xp >= this.player.xpNeed) this.triggerLevelUp();
  }

  revive() {
    const p = this.player;
    p.crystals -= 40;
    p.hp = p.maxHp;
    p.inv = 3;
    this.dead = false;
    this.frozen = false;
    this.flashWhite = 0.8;
    this.projs = this.projs.filter((pr) => pr.from === "ally");
    for (const e of this.enemies) {
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      e.vx += Math.cos(a) * 500;
      e.vy += Math.sin(a) * 500;
    }
    this.burst(p.x, p.y, "#ffd166", 40, true);
    sfx.levelup();
  }

  nextChapter() {
    this.startWorld(this.chapterIdx + 1);
  }

  getStats(): RunStats {
    return { time: this.runTime, kills: this.kills, level: this.player.level, crystals: this.player.crystals };
  }

  snapshot(): HudSnapshot {
    const p = this.player;
    const ch = CHAPTERS[this.mode === "world" ? this.worldIdx : this.chapterIdx];
    return {
      mode: this.mode,
      zone: ch.name,
      hint: this.hint,
      hp: p.hp <= 0 ? 0 : Math.max(1, Math.round(p.hp)),
      maxHp: Math.round(p.maxHp),
      xp: Math.round(p.xp),
      xpNeed: p.xpNeed,
      level: p.level,
      crystals: p.crystals,
      kills: this.kills,
      combo: this.combo,
      chapter: this.chapterIdx,
      chapterName: ch.name,
      wave: Math.max(0, this.waveIdx + 1),
      wavesTotal: ch.waves.length,
      boss: this.boss
        ? { name: `${ch.boss.title} ${ch.boss.name}`, hp: Math.max(0, this.boss.hp), maxHp: this.boss.maxHp }
        : null,
      dashCd: Math.max(0, p.dashCd),
      dashMax: this.effDashMax(),
      waveCd: Math.max(0, p.waveCd),
      waveMax: p.waveMax,
      ult: Math.min(100, p.ult),
      party: this.heroines.map((h) => ({ id: h.def.id, name: h.def.name, color: h.def.hair })),
    };
  }

  // ============================ internals ============================

  private effAtk() {
    return this.player.atk * (1 + this.bonuses.atkP / 100);
  }
  private effSpeed() {
    return this.player.speed * (1 + this.bonuses.spdP / 100);
  }
  private effCrit() {
    return Math.min(0.85, this.player.crit + this.bonuses.critP / 100);
  }
  private effDashMax() {
    return Math.max(0.35, this.player.dashMax * (1 - this.bonuses.dashP / 100));
  }
  private ultMul() {
    return 1 + this.bonuses.ultP / 100;
  }

  private startChapter(i: number) {
    this.mode = "battle";
    this.frozen = false;
    this.hitstop = 0;
    this.hint = "";
    this.camX = 0;
    this.camY = 0;
    this.chapterIdx = Math.min(i, CHAPTERS.length - 1);
    const ch = CHAPTERS[this.chapterIdx];
    const p = this.player;
    this.enemies = [];
    this.projs = [];
    this.picks = [];
    this.arcs = [];
    this.floats = [];
    this.boss = null;
    this.waveIdx = -1;
    this.spawnQueue = [];
    this.betweenT = 2.4;
    this.banner = { text: ch.name, sub: ch.sub, t: 2.6 };
    this.flashWhite = 0.7;
    p.x = this.W / 2;
    p.y = this.H * 0.62;
    p.inv = 2;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.45);
    p.dashCd = 0;
    p.waveCd = 0;

    if (i === 1 && !this.heroines.some((h) => h.def.id === "aria")) this.addHeroine("aria");
    if (i === 2) {
      if (!this.heroines.some((h) => h.def.id === "yuki")) this.addHeroine("yuki");
      if (!this.heroines.some((h) => h.def.id === "lira")) this.addHeroine("lira");
    }

    const rnd = mulberry(1234 + i * 777);
    this.deco = [];
    for (let k = 0; k < 16; k++) {
      this.deco.push({ x: rnd() * this.W, y: 90 + rnd() * (this.H - 130), k: Math.floor(rnd() * 3), s: 0.7 + rnd() * 0.8 });
    }
    sfx.ui();
  }

  // ---------- открытый мир ----------

  private startWorld(i: number) {
    this.mode = "world";
    this.worldIdx = Math.min(i, CHAPTERS.length - 1);
    const ch = CHAPTERS[this.worldIdx];
    this.mapW = 2800 + this.worldIdx * 520;
    this.mapH = 1500 + this.worldIdx * 220;
    this.enemies = [];
    this.projs = [];
    this.picks = [];
    this.arcs = [];
    this.floats = [];
    this.boss = null;
    this.waveIdx = -1;
    this.spawnQueue = [];
    this.frozen = false;
    this.hitstop = 0;
    this.hint = "";

    const p = this.player;
    p.x = 170;
    p.y = this.mapH / 2;
    p.inv = 2;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.35);
    p.dashCd = 0;
    p.waveCd = 0;
    this.camX = 0;
    this.camY = Math.min(Math.max(p.y - this.H / 2, 0), Math.max(0, this.mapH - this.H));

    // героини, спасённые к этому моменту, путешествуют вместе с героем
    if (i === 1 && !this.heroines.some((h) => h.def.id === "aria")) this.addHeroine("aria");
    if (i === 2) {
      if (!this.heroines.some((h) => h.def.id === "yuki")) this.addHeroine("yuki");
      if (!this.heroines.some((h) => h.def.id === "lira")) this.addHeroine("lira");
    }

    const rnd = mulberry(4242 + this.worldIdx * 911);
    this.wObjs = [];
    this.wObjs.push({ kind: "portal", x: this.mapW - 190, y: Math.min(Math.max(this.mapH / 2 + (rnd() - 0.5) * 500, 220), this.mapH - 220), used: false });
    this.wObjs.push({ kind: "spring", x: 520 + rnd() * (this.mapW - 1300), y: 220 + rnd() * (this.mapH - 440), used: false });
    this.wObjs.push({ kind: "shrine", x: 760 + rnd() * (this.mapW - 1500), y: 220 + rnd() * (this.mapH - 440), used: false });
    for (let k = 0; k < 3; k++) {
      this.wObjs.push({ kind: "chest", x: 420 + rnd() * (this.mapW - 900), y: 180 + rnd() * (this.mapH - 360), used: false });
    }
    for (let k = 0; k < 14; k++) {
      const isHeart = rnd() < 0.18;
      this.picks.push({
        x: 320 + rnd() * (this.mapW - 560),
        y: 160 + rnd() * (this.mapH - 320),
        vx: 0, vy: 0,
        kind: isHeart ? "heart" : "cry",
        v: isHeart ? 0 : 2 + Math.floor(rnd() * 4),
        t: rnd() * 5,
      });
    }
    this.wDeco = [];
    for (let k = 0; k < 90; k++) {
      this.wDeco.push({ x: rnd() * this.mapW, y: rnd() * this.mapH, k: Math.floor(rnd() * 4), s: 0.6 + rnd() });
    }
    this.worldSpawnT = 2.5;
    this.banner = { text: "ОТКРЫТЫЙ МИР", sub: `${ch.name} — исследуй, собирай кристаллы, найди врата`, t: 3 };
    this.flashWhite = 0.7;
    sfx.join();
  }

  private spawnEnemyAt(type: Exclude<EnemyType, "boss">, x: number, y: number, tier: number) {
    const base = ENEMY_BASE[type];
    const mul = 1 + tier * 0.5;
    this.enemies.push({
      id: this.nextId++,
      type,
      x, y, vx: 0, vy: 0,
      hp: base.hp * mul, maxHp: base.hp * mul,
      r: base.r, speed: base.speed * (1 + tier * 0.08), dmg: base.dmg * (1 + tier * 0.35),
      face: 1, t: Math.random() * 10, flash: 0, touchCd: 0,
      state: "idle", stateT: 0, shootCd: 1 + Math.random(),
      enraged: false, xp: base.xp, cry: base.cry,
    });
  }

  private updateWorld(dt: number) {
    const p = this.player;
    // камера следует за героем
    const tcx = this.mapW > this.W ? Math.min(Math.max(p.x - this.W / 2, 0), this.mapW - this.W) : (this.mapW - this.W) / 2;
    const tcy = this.mapH > this.H ? Math.min(Math.max(p.y - this.H / 2, 0), this.mapH - this.H) : (this.mapH - this.H) / 2;
    this.camX += (tcx - this.camX) * Math.min(1, dt * 6);
    this.camY += (tcy - this.camY) * Math.min(1, dt * 6);
    this.interactCd = Math.max(0, this.interactCd - dt);
    this.springSndT = Math.max(0, this.springSndT - dt);

    // бродячие демоны
    this.worldSpawnT -= dt;
    if (this.worldSpawnT <= 0) {
      this.worldSpawnT = 2.6;
      if (this.enemies.length < 5) {
        const types: Exclude<EnemyType, "boss">[] = ["imp", "imp", "wraith", "spitter"];
        const a = Math.random() * Math.PI * 2;
        const d = 520 + Math.random() * 340;
        const x = Math.min(Math.max(p.x + Math.cos(a) * d, 60), this.mapW - 60);
        const y = Math.min(Math.max(p.y + Math.sin(a) * d, 90), this.mapH - 60);
        this.spawnEnemyAt(types[Math.floor(Math.random() * types.length)], x, y, this.worldIdx);
        this.burst(x, y - 10, "#c46bff", 8, true);
        sfx.magic();
      }
    }

    // источник исцеления
    for (const o of this.wObjs) {
      if (o.kind === "spring" && Math.hypot(o.x - p.x, o.y - p.y) < 58) {
        if (p.hp < p.maxHp) {
          p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.3 * dt);
          if (Math.random() < dt * 9) {
            this.parts.push({
              x: o.x + (Math.random() - 0.5) * 76, y: o.y + (Math.random() - 0.5) * 34,
              vx: 0, vy: -42 - Math.random() * 34, life: 0.8, max: 0.8,
              size: 3, color: "rgba(124,255,207,0.85)", glow: true, grav: 0,
            });
          }
          if (this.springSndT <= 0) {
            this.springSndT = 0.55;
            sfx.heal();
          }
        }
      }
    }

    // взаимодействие
    let near: (typeof this.wObjs)[number] | null = null;
    let nd = 74;
    for (const o of this.wObjs) {
      if (o.used && o.kind !== "portal" && o.kind !== "spring") continue;
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      if (d < nd) {
        nd = d;
        near = o;
      }
    }
    this.hint = near
      ? near.kind === "portal"
        ? "E — войти во врата"
        : near.kind === "shrine"
          ? "E — принять благословение"
          : near.kind === "chest"
            ? "E — открыть сундук"
            : "Источник исцеления — встань в воду"
      : "Исследуй мир · найди золотые врата";

    if (near && this.interactCd <= 0 && (this.keys.has("KeyE") || this.keys.has("KeyL"))) {
      if (near.kind === "portal") {
        this.interactCd = 1;
        this.flashWhite = 0.95;
        sfx.ult();
        this.startChapter(this.worldIdx);
        return;
      }
      if (near.kind === "shrine") {
        near.used = true;
        this.interactCd = 0.6;
        const b = BLESSINGS[Math.floor(Math.random() * BLESSINGS.length)];
        this.applyBlessing(b.id);
        this.banner = { text: "БЛАГОСЛОВЕНИЕ", sub: `${b.name} · ${b.desc}`, t: 2.6 };
        this.burst(near.x, near.y - 30, "#ffd166", 26, true);
        sfx.gachaEpic();
      } else if (near.kind === "chest") {
        near.used = true;
        this.interactCd = 0.6;
        const v = 12 + Math.floor(Math.random() * 16);
        this.addCrystals(v);
        this.floats.push({ x: p.x, y: p.y - 36, life: 0.9, max: 0.9, text: `+${v} КРИСТАЛЛ`, color: "#7cc7ff", size: 14 });
        if (Math.random() < 0.5) this.picks.push({ x: near.x, y: near.y - 12, vx: 0, vy: -70, kind: "heart", v: 0, t: 0 });
        this.burst(near.x, near.y - 14, "#7cc7ff", 18, true);
        sfx.crystal();
      }
    }
  }

  private addHeroine(id: string) {
    const def = HEROINES.find((h) => h.id === id);
    if (!def) return;
    this.heroines.push({
      def,
      x: this.player.x,
      y: this.player.y,
      t: Math.random() * 10,
      atkT: 1 + Math.random(),
      lunge: 0,
      tx: this.player.x,
      ty: this.player.y,
    });
  }

  // ---------- обновление ----------

  private update(dt: number) {
    if (this.dead) return;
    const p = this.player;
    if (p.hp <= 0) {
      p.hp = 0;
      this.playerDie();
      return;
    }
    if (this.mode === "world") {
      this.vW = this.mapW;
      this.vH = this.mapH;
    } else {
      this.vW = this.W;
      this.vH = this.H;
    }
    this.mx = this.mouse.x + this.camX;
    this.my = this.mouse.y + this.camY;
    this.runTime += dt;
    p.t += dt;

    // ввод
    let dx = 0;
    let dy = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) dy -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) dy += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) dx -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) dx += 1;
    const len = Math.hypot(dx, dy);
    p.moving = len > 0;
    if (len > 0) {
      dx /= len;
      dy /= len;
      if (dx !== 0) p.face = dx > 0 ? 1 : -1;
    }

    // рывок
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.inv = Math.max(0, p.inv - dt);
    if ((this.keys.has("Space") || this.keys.has("ShiftLeft")) && p.dashCd <= 0 && p.dashT <= 0) {
      p.dashT = 0.16;
      p.dashCd = this.effDashMax();
      p.dashDx = len > 0 ? dx : Math.cos(Math.atan2(this.my - p.y, this.mx - p.x));
      p.dashDy = len > 0 ? dy : Math.sin(Math.atan2(this.my - p.y, this.mx - p.x));
      sfx.dash();
    }
    if (p.dashT > 0) {
      p.dashT -= dt;
      p.x += p.dashDx * 860 * dt;
      p.y += p.dashDy * 860 * dt;
      this.parts.push({
        x: p.x, y: p.y - 12, vx: -p.dashDx * 40, vy: -p.dashDy * 40,
        life: 0.25, max: 0.25, size: 12, color: "rgba(255,209,102,0.4)", glow: true, grav: 0,
      });
    } else {
      p.x += dx * this.effSpeed() * dt;
      p.y += dy * this.effSpeed() * dt;
    }
    const topB = this.mode === "world" ? 44 : 96;
    p.x = Math.min(Math.max(p.x, 26), this.vW - 26);
    p.y = Math.min(Math.max(p.y, topB), this.vH - 30);

    // атака
    p.comboCd = Math.max(0, p.comboCd - dt);
    if (p.attackT >= 0) {
      p.attackT += dt / 0.22;
      if (p.attackT > 1) p.attackT = -1;
    }
    if ((this.mouse.down || this.keys.has("KeyJ") || this.keys.has("KeyZ")) && p.comboCd <= 0 && p.ultT <= 0) {
      this.doAttack();
    }

    // волна (Q / K)
    p.waveCd = Math.max(0, p.waveCd - dt);
    if ((this.keys.has("KeyQ") || this.keys.has("KeyK")) && p.waveCd <= 0 && p.ultT <= 0) {
      p.waveCd = p.waveMax;
      const a = Math.atan2(this.my - p.y, this.mx - p.x);
      this.projs.push({
        x: p.x + Math.cos(a) * 26, y: p.y - 8 + Math.sin(a) * 26,
        vx: Math.cos(a) * 540, vy: Math.sin(a) * 540,
        r: 24, dmg: this.effAtk() * 2.1, from: "ally", life: 0.85,
        color: "#35f0d0", kind: "crescent", pierce: 999, hits: new Set(),
      });
      sfx.wave();
    }

    // ульта (E / L)
    if ((this.keys.has("KeyE") || this.keys.has("KeyL")) && p.ult >= 100 && p.ultT <= 0) {
      p.ultT = 2.2;
      p.ult = 0;
      p.ultTick = 0;
      this.flashWhite = 0.5;
      this.shake = 14;
      sfx.ult();
    }
    if (p.ultT > 0) {
      p.ultT -= dt;
      p.ultTick -= dt;
      if (p.ultTick <= 0) {
        p.ultTick = 0.16;
        this.arcs.push({
          x: p.x, y: p.y - 8, ang: Math.random() * Math.PI * 2, spread: Math.PI * 2,
          r: 130, life: 0.28, max: 0.28, color: "#ffd166", width: 7,
        });
        const dmg = this.effAtk() * 1.5;
        for (const e of this.enemies) {
          if (Math.hypot(e.x - p.x, e.y - p.y) < 150 + e.r) this.hurtEnemy(e, dmg, false, 0, 0, true);
        }
        this.burst(p.x, p.y - 10, "#ffd166", 6, true);
      }
    }

    // комбо-счётчик
    if (this.combo > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }

    this.updateHeroines(dt);
    if (this.mode === "battle") this.updateWaves(dt);
    else this.updateWorld(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);

    // частицы / тексты / дуги
    for (const pt of this.parts) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += pt.grav * dt;
    }
    this.parts = this.parts.filter((pt) => pt.life > 0);
    for (const f of this.floats) {
      f.life -= dt;
      f.y -= 42 * dt;
    }
    this.floats = this.floats.filter((f) => f.life > 0);
    for (const a of this.arcs) a.life -= dt;
    this.arcs = this.arcs.filter((a) => a.life > 0);

    this.shake = Math.max(0, this.shake - dt * 34);
    this.flashRed = Math.max(0, this.flashRed - dt * 1.6);
    this.flashWhite = Math.max(0, this.flashWhite - dt * 1.8);
    if (this.banner.t > 0) this.banner.t -= dt;

    // ambient
    this.ambientT -= dt;
    if (this.ambientT <= 0 && this.parts.length < 150) {
      this.ambientT = 0.14;
      const ch = CHAPTERS[this.mode === "world" ? this.worldIdx : this.chapterIdx];
      const x = this.camX + Math.random() * this.W;
      if (ch.ambient === "ember") {
        this.parts.push({ x, y: this.camY + this.H + 8, vx: (Math.random() - 0.5) * 24, vy: -30 - Math.random() * 40, life: 4, max: 4, size: 2 + Math.random() * 2.5, color: "rgba(255,140,60,0.7)", glow: true, grav: 0 });
      } else if (ch.ambient === "ash") {
        this.parts.push({ x, y: this.camY - 8, vx: 14 + Math.random() * 18, vy: 26 + Math.random() * 22, life: 6, max: 6, size: 1.5 + Math.random() * 2, color: "rgba(200,200,210,0.4)", glow: false, grav: 0 });
      } else {
        this.parts.push({ x, y: this.camY - 8, vx: -10 - Math.random() * 16, vy: 34 + Math.random() * 20, life: 5, max: 5, size: 2.5 + Math.random() * 2, color: "rgba(140,220,120,0.5)", glow: false, grav: 8 });
      }
    }
  }

  private doAttack() {
    const p = this.player;
    const idx = p.comboIdx;
    p.comboIdx = (p.comboIdx + 1) % 3;
    const mul = [1, 1, 1.75][idx];
    const radius = [80, 80, 104][idx];
    const spread = [1.7, 1.7, 2.3][idx];
    p.comboCd = idx === 2 ? 0.42 : 0.3;
    p.attackT = 0;
    const a = Math.atan2(this.my - (p.y - 8), this.mx - p.x);
    if (Math.cos(a) !== 0) p.face = Math.cos(a) >= 0 ? 1 : -1;
    this.arcs.push({
      x: p.x, y: p.y - 8, ang: a, spread, r: radius,
      life: 0.16, max: 0.16, color: idx === 2 ? "#ffd166" : "#f7ecf2", width: idx === 2 ? 6 : 4,
    });
    idx === 2 ? sfx.slashBig() : sfx.slash();

    let hits = 0;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - (p.y - 8));
      if (d > radius + e.r) continue;
      const ea = Math.atan2(e.y - (p.y - 8), e.x - p.x);
      let diff = Math.abs(ea - a);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff > spread / 2) continue;
      hits++;
      const crit = Math.random() < this.effCrit();
      const kx = Math.cos(ea) * 260 * (idx === 2 ? 1.6 : 1);
      const ky = Math.sin(ea) * 260 * (idx === 2 ? 1.6 : 1);
      this.hurtEnemy(e, this.effAtk() * mul * (crit ? 2 : 1), crit, kx, ky);
    }
    if (hits > 0) {
      this.hitstop = Math.max(this.hitstop, 0.035 + (idx === 2 ? 0.03 : 0));
      this.combo += hits;
      this.comboT = 2.5;
      p.ult = Math.min(100, p.ult + hits * 2.4 * this.ultMul());
      if (this.bonuses.vamp > 0) {
        p.hp = Math.min(p.maxHp, p.hp + hits * this.bonuses.vamp * 0.4);
      }
    }
  }

  private hurtEnemy(e: Enemy, dmg: number, crit: boolean, kx: number, ky: number, silent = false) {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    e.flash = 0.12;
    e.vx += kx;
    e.vy += ky;
    this.floats.push({
      x: e.x + (Math.random() - 0.5) * 18,
      y: e.y - e.r - 8,
      life: 0.7, max: 0.7,
      text: String(Math.round(dmg)),
      color: crit ? "#ffd166" : "#f7ecf2",
      size: crit ? 22 : 15,
    });
    this.burst(e.x, e.y - 6, crit ? "#ffd166" : "#ff2e4d", crit ? 8 : 4, true);
    if (crit && !silent) sfx.crit();
    else if (!silent) sfx.hit();
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy) {
    this.kills++;
    const p = this.player;
    p.ult = Math.min(100, p.ult + 5 * this.ultMul());
    this.burst(e.x, e.y - 6, "#ff5a3c", 12, true);
    this.hitstop = Math.max(this.hitstop, 0.045);

    // дроп
    const cryMul = 1 + this.bonuses.cryP / 100;
    this.picks.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 60, vy: -40, kind: "xp", v: e.xp, t: 0 });
    const [c1, c2] = e.cry;
    const cv = Math.round((c1 + Math.random() * (c2 - c1)) * cryMul);
    if (cv > 0) this.picks.push({ x: e.x + 8, y: e.y, vx: (Math.random() - 0.5) * 70, vy: -50, kind: "cry", v: cv, t: 0 });
    if (Math.random() < 0.055) this.picks.push({ x: e.x - 8, y: e.y, vx: (Math.random() - 0.5) * 60, vy: -46, kind: "heart", v: 0, t: 0 });

    if (e.type === "boss") this.bossDied(e);
  }

  private bossDied(e: Enemy) {
    this.boss = null;
    this.shake = 18;
    this.flashWhite = 0.9;
    this.burst(e.x, e.y - 20, "#ffd166", 50, true);
    this.burst(e.x, e.y - 20, "#ff2e4d", 40, true);
    this.addCrystals(60);
    sfx.bossDie();
    this.frozen = true;
    const idx = this.chapterIdx;
    setTimeout(() => {
      if (this.destroyed || this.dead) return;
      if (idx >= CHAPTERS.length - 1) {
        if (!this.victoryDone) {
          this.victoryDone = true;
          this.handlers.onVictory(this.getStats());
        }
      } else {
        this.handlers.onChapterEnd(idx);
      }
    }, 1400);
  }

  private playerHurt(dmg: number) {
    const p = this.player;
    if (p.inv > 0 || p.dashT > 0 || p.ultT > 0 || this.dead) return;
    p.hp -= dmg;
    p.inv = 0.85;
    this.flashRed = 0.5;
    this.shake = Math.max(this.shake, 9);
    this.combo = 0;
    sfx.hurt();
    this.burst(p.x, p.y - 10, "#ff2e4d", 8, true);
    if (p.hp < 1) {
      p.hp = 0;
      this.playerDie();
    }
  }

  private playerDie() {
    if (this.dead) return;
    const p = this.player;
    this.dead = true;
    this.combo = 0;
    this.burst(p.x, p.y - 10, "#f7ecf2", 34, true);
    this.burst(p.x, p.y - 10, "#ff2e4d", 16, true);
    this.flashRed = 0.7;
    sfx.death();
    setTimeout(() => {
      if (!this.destroyed && this.dead) this.handlers.onGameOver();
    }, 1100);
  }

  private gainXp(v: number) {
    const p = this.player;
    p.xp += v * (1 + this.bonuses.xpP / 100);
    if (p.xp >= p.xpNeed) this.triggerLevelUp();
  }

  private triggerLevelUp() {
    const p = this.player;
    while (p.xp >= p.xpNeed) {
      p.xp -= p.xpNeed;
      p.level++;
      p.xpNeed = Math.round(46 * Math.pow(p.level, 1.28));
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.3);
    }
    this.burst(p.x, p.y - 12, "#ffd166", 24, true);
    sfx.levelup();
    this.frozen = true;
    const pool = [...UPGRADES];
    const choices: UpgradeDef[] = [];
    while (choices.length < 3 && pool.length > 0) {
      choices.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    this.handlers.onLevelUp(choices);
  }

  // ---------- героини ----------

  private updateHeroines(dt: number) {
    const p = this.player;
    const slots = [
      [-52, 34],
      [52, 34],
      [0, 60],
    ];
    this.heroines.forEach((h, i) => {
      h.t += dt;
      h.atkT -= dt;
      h.lunge = Math.max(0, h.lunge - dt * 4);
      const slot = slots[i % 3];
      const tx = p.x + slot[0];
      const ty = p.y + slot[1];
      h.x += (tx - h.x) * Math.min(1, dt * 5);
      h.y += (ty - h.y) * Math.min(1, dt * 5);
      if (h.atkT > 0) return;

      const w = h.def.weapon;
      if (w === "blade") {
        const target = this.nearestEnemy(h.x, h.y, 260);
        if (!target) return;
        h.atkT = 1.15;
        h.tx = target.x;
        h.ty = target.y;
        h.lunge = 1;
        const a = Math.atan2(target.y - h.y, target.x - h.x);
        this.arcs.push({ x: target.x, y: target.y - 6, ang: a, spread: 1.9, r: 62, life: 0.16, max: 0.16, color: h.def.glow, width: 4 });
        this.hurtEnemy(target, this.effAtk() * 1.1, false, Math.cos(a) * 120, Math.sin(a) * 120);
        sfx.slash();
      } else if (w === "bow") {
        const target = this.nearestEnemy(h.x, h.y, 440);
        if (!target) return;
        h.atkT = 1.35;
        h.lunge = 1;
        const a = Math.atan2(target.y - h.y, target.x - h.x);
        this.projs.push({
          x: h.x, y: h.y - 12, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620,
          r: 8, dmg: this.effAtk() * 0.75, from: "ally", life: 0.9,
          color: h.def.glow, kind: "arrow", pierce: 3, hits: new Set(),
        });
        sfx.arrow();
      } else {
        h.atkT = 2.4;
        h.lunge = 1;
        if (p.hp < p.maxHp * 0.78) {
          const heal = p.maxHp * 0.085;
          p.hp = Math.min(p.maxHp, p.hp + heal);
          this.floats.push({ x: p.x, y: p.y - 30, life: 0.8, max: 0.8, text: `+${Math.round(heal)}`, color: "#7bffce", size: 17 });
          this.burst(p.x, p.y - 14, "#7bffce", 10, true);
          sfx.heal();
        } else {
          const target = this.nearestEnemy(h.x, h.y, 380);
          if (target) {
            const a = Math.atan2(target.y - h.y, target.x - h.x);
            this.projs.push({
              x: h.x, y: h.y - 14, vx: Math.cos(a) * 460, vy: Math.sin(a) * 460,
              r: 9, dmg: this.effAtk() * 0.6, from: "ally", life: 1,
              color: "#35f0d0", kind: "bolt", pierce: 1, hits: new Set(),
            });
            sfx.magic();
          }
        }
      }
    });
  }

  private nearestEnemy(x: number, y: number, maxDist: number): Enemy | null {
    let best: Enemy | null = null;
    let bd = maxDist;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  // ---------- волны ----------

  private updateWaves(dt: number) {
    const ch = CHAPTERS[this.chapterIdx];
    if (this.boss) return;
    if (this.spawnQueue.length > 0) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = 0.42;
        const type = this.spawnQueue.shift()!;
        this.spawnEnemy(type);
      }
      return;
    }
    if (this.enemies.length > 0) return;
    this.betweenT -= dt;
    if (this.betweenT > 0) return;
    this.waveIdx++;
    if (this.waveIdx >= ch.waves.length) {
      this.spawnBoss();
      return;
    }
    const wave = ch.waves[this.waveIdx];
    const q: Exclude<EnemyType, "boss">[] = [];
    for (const g of wave.list) for (let i = 0; i < g.n; i++) q.push(g.type);
    for (let i = q.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q[i], q[j]] = [q[j], q[i]];
    }
    this.spawnQueue = q;
    this.spawnT = 0.2;
    this.betweenT = 2.6;
    this.banner = { text: `ВОЛНА ${this.waveIdx + 1}/${ch.waves.length}`, sub: "Истреби демонов!", t: 1.6 };
    sfx.ui();
  }

  private edgePos(): { x: number; y: number } {
    const m = 50;
    const side = Math.floor(Math.random() * 4);
    if (side === 0) return { x: m + Math.random() * (this.W - m * 2), y: 110 };
    if (side === 1) return { x: m + Math.random() * (this.W - m * 2), y: this.H - m };
    if (side === 2) return { x: m, y: 120 + Math.random() * (this.H - 180) };
    return { x: this.W - m, y: 120 + Math.random() * (this.H - 180) };
  }

  private spawnEnemy(type: Exclude<EnemyType, "boss">) {
    const ch = this.chapterIdx;
    const base = ENEMY_BASE[type];
    const mul = (1 + ch * 0.5) * (1 + Math.max(0, this.waveIdx) * 0.05);
    const pos = this.edgePos();
    this.enemies.push({
      id: this.nextId++,
      type,
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      hp: base.hp * mul, maxHp: base.hp * mul,
      r: base.r, speed: base.speed * (1 + ch * 0.08), dmg: base.dmg * (1 + ch * 0.35),
      face: 1, t: Math.random() * 10, flash: 0, touchCd: 0,
      state: "idle", stateT: 0, shootCd: 1 + Math.random(),
      enraged: false, xp: base.xp, cry: base.cry,
    });
  }

  private spawnBoss() {
    const ch = CHAPTERS[this.chapterIdx];
    const b = ch.boss;
    this.boss = {
      id: this.nextId++,
      type: "boss",
      kind: b.kind,
      x: this.W / 2, y: 170, vx: 0, vy: 0,
      hp: b.hp, maxHp: b.hp, r: 40, speed: 70, dmg: 22 + this.chapterIdx * 6,
      face: 1, t: 0, flash: 0, touchCd: 0,
      state: "enter", stateT: 1.4, shootCd: 2,
      enraged: false, xp: 80, cry: [40, 60],
    };
    this.enemies.push(this.boss);
    this.banner = { text: "БОСС", sub: `${b.title} · ${b.name}`, t: 2.4 };
    this.shake = 12;
    sfx.bossRoar();
  }

  // ---------- враги ----------

  private updateEnemies(dt: number) {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.t += dt;
      e.flash = Math.max(0, e.flash - dt);
      e.touchCd = Math.max(0, e.touchCd - dt);

      const dxp = p.x - e.x;
      const dyp = p.y - e.y;
      const dist = Math.hypot(dxp, dyp) || 1;
      const nx = dxp / dist;
      const ny = dyp / dist;
      e.face = dxp >= 0 ? 1 : -1;

      let mx = 0;
      let my = 0;

      if (e.type === "boss") {
        this.updateBoss(e, dt, nx, ny, dist);
        mx = e.vx;
        my = e.vy;
      } else if (e.type === "imp") {
        mx = nx * e.speed;
        my = ny * e.speed;
      } else if (e.type === "wraith") {
        const wob = Math.sin(e.t * 6) * 0.9;
        mx = (nx + -ny * wob) * e.speed;
        my = (ny + nx * wob) * e.speed;
      } else if (e.type === "brute") {
        mx = nx * e.speed;
        my = ny * e.speed;
      } else if (e.type === "spitter") {
        if (dist > 300) {
          mx = nx * e.speed;
          my = ny * e.speed;
        } else if (dist < 200) {
          mx = -nx * e.speed;
          my = -ny * e.speed;
        } else {
          mx = -ny * e.speed * 0.6;
          my = nx * e.speed * 0.6;
        }
        e.shootCd -= dt;
        if (e.shootCd <= 0 && dist < 520) {
          e.shootCd = 2.3;
          const a = Math.atan2(dyp, dxp);
          this.projs.push({
            x: e.x, y: e.y - 6, vx: Math.cos(a) * 250, vy: Math.sin(a) * 250,
            r: 7, dmg: e.dmg * 0.8, from: "foe", life: 3,
            color: e.type === "spitter" ? "#7dff6a" : "#ff9f43", kind: "orb", pierce: 1, hits: new Set(),
          });
        }
      }

      // отталкивание врагов друг от друга
      if (this.enemies.length < 50) {
        for (const o of this.enemies) {
          if (o === e || o.hp <= 0) continue;
          const dx = e.x - o.x;
          const dy = e.y - o.y;
          const d = Math.hypot(dx, dy);
          const min = e.r + o.r;
          if (d > 0 && d < min) {
            const push = ((min - d) / min) * 90 * dt;
            e.x += (dx / d) * push;
            e.y += (dy / d) * push;
          }
        }
      }

      e.vx *= Math.pow(0.0001, dt);
      e.vy *= Math.pow(0.0001, dt);
      e.x += (mx + e.vx) * dt;
      e.y += (my + e.vy) * dt;
      e.x = Math.min(Math.max(e.x, 20), this.vW - 20);
      e.y = Math.min(Math.max(e.y, this.mode === "world" ? 60 : 100), this.vH - 20);

      // контактный урон
      if (dist < e.r + p.r + 4 && e.touchCd <= 0 && e.state !== "windup") {
        e.touchCd = 0.9;
        this.playerHurt(e.dmg);
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    if (this.mode === "world") {
      // слишком далеко убежавшие бродячие демоны растворяются
      this.enemies = this.enemies.filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < 2000);
    }
  }

  private updateBoss(e: Enemy, dt: number, nx: number, ny: number, dist: number) {
    const p = this.player;
    e.stateT -= dt;
    e.shootCd -= dt;
    const hpFrac = e.hp / e.maxHp;

    if (e.kind === "demon" && !e.enraged && hpFrac < 0.33) {
      e.enraged = true;
      e.speed *= 1.5;
      this.banner = { text: "ЯРОСТЬ ВЛАДЫКИ", sub: "Он на пределе!", t: 1.6 };
      sfx.bossRoar();
    }

    if (e.state === "enter") {
      if (e.stateT <= 0) e.state = "move";
      e.vx = 0;
      e.vy = 0;
      return;
    }

    if (e.state === "move") {
      e.vx = nx * e.speed;
      e.vy = ny * e.speed;
      if (e.stateT <= 0) {
        const roll = Math.random();
        if (e.kind === "fire") e.state = roll < 0.55 ? "windup_radial" : "windup_charge";
        else if (e.kind === "ice") e.state = roll < 0.5 ? "windup_fan" : "summon";
        else e.state = roll < 0.4 ? "windup_radial" : roll < 0.7 ? "windup_charge" : "summon";
        e.stateT = e.state === "summon" ? 0.4 : 0.55;
      }
      return;
    }

    if (e.state.startsWith("windup")) {
      e.vx = 0;
      e.vy = 0;
      e.flash = 0.08;
      if (e.stateT <= 0) {
        if (e.state === "windup_radial") {
          const n = e.kind === "demon" && e.enraged ? 20 : 12;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
            this.projs.push({
              x: e.x, y: e.y - 10, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240,
              r: 8, dmg: e.dmg * 0.75, from: "foe", life: 3.4,
              color: e.kind === "ice" ? "#7cc7ff" : "#ff9f43", kind: "orb", pierce: 1, hits: new Set(),
            });
          }
          sfx.wave();
          e.state = "move";
          e.stateT = e.enraged ? 1 : 1.6;
        } else if (e.state === "windup_charge") {
          e.state = "charge";
          e.stateT = 0.5;
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          e.vx = Math.cos(a) * 760;
          e.vy = Math.sin(a) * 760;
          sfx.dash();
        } else if (e.state === "windup_fan") {
          const base = Math.atan2(p.y - e.y, p.x - e.x);
          for (let i = -2; i <= 2; i++) {
            const a = base + i * 0.22;
            this.projs.push({
              x: e.x, y: e.y - 10, vx: Math.cos(a) * 330, vy: Math.sin(a) * 330,
              r: 8, dmg: e.dmg * 0.7, from: "foe", life: 2.6,
              color: "#bfe6ff", kind: "shard", pierce: 1, hits: new Set(),
            });
          }
          sfx.magic();
          e.state = "move";
          e.stateT = 1.4;
        }
      }
      return;
    }

    if (e.state === "charge") {
      if (e.stateT <= 0) {
        e.vx = 0;
        e.vy = 0;
        e.state = "move";
        e.stateT = e.enraged ? 1 : 1.7;
      }
      return;
    }

    if (e.state === "summon") {
      if (e.stateT <= 0) {
        const n = e.kind === "ice" ? 3 : 4;
        for (let i = 0; i < n; i++) {
          this.spawnEnemy(e.kind === "ice" ? "wraith" : "imp");
        }
        this.burst(e.x, e.y - 10, "#c46bff", 16, true);
        sfx.magic();
        e.state = "move";
        e.stateT = 2.2;
      }
      return;
    }

    // периодическая стрельба владыки
    if (e.kind === "demon" && e.shootCd <= 0 && dist < 640) {
      e.shootCd = e.enraged ? 1.4 : 2.2;
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      for (let i = -1; i <= 1; i++) {
        this.projs.push({
          x: e.x, y: e.y - 14, vx: Math.cos(a + i * 0.16) * 300, vy: Math.sin(a + i * 0.16) * 300,
          r: 9, dmg: e.dmg * 0.6, from: "foe", life: 2.8,
          color: "#ff2e4d", kind: "orb", pierce: 1, hits: new Set(),
        });
      }
    }
    e.vx = nx * e.speed * 0.6;
    e.vy = ny * e.speed * 0.6;
  }

  // ---------- снаряды ----------

  private updateProjectiles(dt: number) {
    const p = this.player;
    for (const pr of this.projs) {
      pr.life -= dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if (pr.x < -60 || pr.x > this.vW + 60 || pr.y < -60 || pr.y > this.vH + 60) pr.life = 0;

      if (pr.from === "foe") {
        if (Math.hypot(pr.x - p.x, pr.y - (p.y - 6)) < pr.r + p.r) {
          this.playerHurt(pr.dmg);
          pr.life = 0;
        }
      } else {
        for (const e of this.enemies) {
          if (e.hp <= 0 || pr.hits.has(e.id)) continue;
          if (Math.hypot(pr.x - e.x, pr.y - (e.y - 6)) < pr.r + e.r) {
            pr.hits.add(e.id);
            const a = Math.atan2(pr.vy, pr.vx);
            this.hurtEnemy(e, pr.dmg, Math.random() < this.effCrit(), Math.cos(a) * 140, Math.sin(a) * 140);
            if (pr.kind === "crescent" && this.bonuses.thorn) {
              for (const o of this.enemies) {
                if (o !== e && o.hp > 0 && Math.hypot(o.x - e.x, o.y - e.y) < 100) {
                  this.hurtEnemy(o, pr.dmg * 0.5, false, 0, 0, true);
                }
              }
              this.burst(e.x, e.y - 6, "#35f0d0", 10, true);
            }
            pr.pierce--;
            if (pr.pierce <= 0) {
              pr.life = 0;
              break;
            }
          }
        }
      }
    }
    this.projs = this.projs.filter((pr) => pr.life > 0);
  }

  // ---------- дроп ----------

  private updatePickups(dt: number) {
    const p = this.player;
    for (const pk of this.picks) {
      pk.t += dt;
      pk.vy += 300 * dt;
      if (pk.vy > 0) pk.vy *= Math.pow(0.001, dt);
      pk.x += pk.vx * dt;
      pk.y += pk.vy * dt;
      pk.x = Math.min(Math.max(pk.x, 20), this.vW - 20);
      pk.y = Math.min(Math.max(pk.y, this.mode === "world" ? 60 : 100), this.vH - 24);
      const d = Math.hypot(pk.x - p.x, pk.y - p.y);
      if (d < 130) {
        const a = Math.atan2(p.y - pk.y, p.x - pk.x);
        pk.vx += Math.cos(a) * 900 * dt;
        pk.vy += Math.sin(a) * 900 * dt;
      }
      if (d < 26) {
        pk.t = -99;
        if (pk.kind === "xp") {
          this.gainXp(pk.v);
          sfx.pickup();
        } else if (pk.kind === "cry") {
          p.crystals += pk.v;
          this.floats.push({ x: p.x, y: p.y - 34, life: 0.8, max: 0.8, text: `+${pk.v} КРИСТАЛЛ`, color: "#7cc7ff", size: 13 });
          sfx.crystal();
        } else {
          p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.16);
          this.floats.push({ x: p.x, y: p.y - 34, life: 0.8, max: 0.8, text: "+HP", color: "#ff6b8a", size: 15 });
          sfx.heart();
        }
      }
    }
    this.picks = this.picks.filter((pk) => pk.t > -50);
  }

  private burst(x: number, y: number, color: string, n: number, glow: boolean) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 220;
      this.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life: 0.3 + Math.random() * 0.4, max: 0.7,
        size: 2 + Math.random() * 4, color, glow, grav: 260,
      });
    }
  }

  // ============================ отрисовка ============================

  private render(now: number) {
    const ctx = this.ctx;
    const world = this.mode === "world";
    const ch = CHAPTERS[world ? this.worldIdx : this.chapterIdx];
    ctx.save();
    ctx.clearRect(0, 0, this.W, this.H);
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }

    // фон (экранные координаты)
    if (world) {
      const sky = ctx.createLinearGradient(0, 0, 0, this.H);
      sky.addColorStop(0, ch.sky[0]);
      sky.addColorStop(0.4, ch.sky[1]);
      sky.addColorStop(1, ch.floor[1]);
      ctx.fillStyle = sky;
      ctx.fillRect(-20, -20, this.W + 40, this.H + 40);
      const fl = ctx.createLinearGradient(0, 0, 0, this.H);
      fl.addColorStop(0, ch.floor[0]);
      fl.addColorStop(1, ch.floor[1]);
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = fl;
      ctx.fillRect(-20, this.H * 0.22, this.W + 40, this.H);
      ctx.globalAlpha = 1;
    } else {
      const sky = ctx.createLinearGradient(0, 0, 0, this.H);
      sky.addColorStop(0, ch.sky[0]);
      sky.addColorStop(1, ch.sky[1]);
      ctx.fillStyle = sky;
      ctx.fillRect(-20, -20, this.W + 40, this.H + 40);
      const floor = ctx.createLinearGradient(0, this.H * 0.2, 0, this.H);
      floor.addColorStop(0, ch.floor[0]);
      floor.addColorStop(1, ch.floor[1]);
      ctx.fillStyle = floor;
      ctx.fillRect(-20, this.H * 0.18, this.W + 40, this.H);
    }

    // мировые координаты (в бою камера = 0)
    ctx.save();
    ctx.translate(-this.camX, -this.camY);

    if (world) {
      this.drawWorldGround(ch, now);
    } else {
      // декорации
      for (const d of this.deco) this.drawDeco(d, ch.accent, now);
      // светящаяся рамка арены
      ctx.strokeStyle = `rgba(255,209,102,0.12)`;
      ctx.lineWidth = 2;
      ctx.strokeRect(14, 92, this.W - 28, this.H - 112);
    }

    // дроп
    for (const pk of this.picks) this.drawPickup(pk);

    // герои и враги (сортировка по y)
    type Drawable = { y: number; draw: () => void };
    const drawables: Drawable[] = [];
    for (const e of this.enemies) {
      drawables.push({
        y: e.y,
        draw: () =>
          drawDemon(ctx, {
            x: e.x, y: e.y, type: e.type === "boss" ? (e.kind ?? "demon") : e.type,
            t: e.t, face: e.face, flash: e.flash, hp: e.hp, maxHp: e.maxHp,
            boss: e.type === "boss", enraged: e.enraged, scale: e.type === "brute" ? 1.25 : 1,
          }),
      });
    }
    for (const h of this.heroines) {
      drawables.push({
        y: h.y,
        draw: () => {
          const def = h.def;
          const lungeX = h.lunge > 0 ? (h.tx - h.x) * h.lunge * 0.5 : 0;
          const lungeY = h.lunge > 0 ? (h.ty - h.y) * h.lunge * 0.5 : 0;
          drawChibi(ctx, {
            x: h.x + lungeX, y: h.y + lungeY, scale: 0.95, t: h.t,
            face: h.tx >= h.x ? 1 : -1, moving: true,
            attack: h.lunge > 0 ? 1 - h.lunge : -1,
            palette: { hair: def.hair, hairDark: def.hairDark, skin: def.skin, dress: def.dress, accent: def.accent, eyes: def.eyes },
            style: def.style, weapon: def.weapon, glow: def.glow,
          });
        },
      });
    }
    if (!this.dead) {
      const p = this.player;
      drawables.push({
        y: p.y,
        draw: () =>
          drawChibi(ctx, {
            x: p.x, y: p.y, scale: 1.08, t: p.t, face: p.face, moving: p.moving,
            attack: p.attackT, invuln: p.inv > 0, ult: p.ultT > 0,
            palette: HERO_PALETTE, style: "spiky", weapon: "blade", glow: "#ffd166",
          }),
      });
    }
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    // снаряды
    for (const pr of this.projs) this.drawProj(pr);

    // дуги взмахов
    ctx.globalCompositeOperation = "lighter";
    for (const a of this.arcs) {
      const f = a.life / a.max;
      ctx.strokeStyle = a.color;
      ctx.globalAlpha = f * 0.9;
      ctx.lineWidth = a.width * (0.6 + f);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r * (1.15 - f * 0.15), a.ang - a.spread / 2, a.ang + a.spread / 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // частицы
    for (const pt of this.parts) {
      const f = Math.max(0, pt.life / pt.max);
      ctx.globalAlpha = f;
      if (pt.glow) ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * (0.5 + f * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.globalAlpha = 1;

    // всплывающий урон
    for (const f of this.floats) {
      const a = Math.max(0, f.life / f.max);
      ctx.globalAlpha = a;
      ctx.font = `${f.size}px "Russo One"`;
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillText(f.text, f.x + 2, f.y + 2);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // возврат в экранные координаты
    ctx.restore();

    // стрелка к вратам в открытом мире
    if (world && !this.dead) {
      const portal = this.wObjs.find((o) => o.kind === "portal");
      if (portal) {
        const sx = portal.x - this.camX;
        const sy = portal.y - this.camY - 30;
        const m = 78;
        if (sx < m || sx > this.W - m || sy < m + 46 || sy > this.H - m) {
          const cx = this.W / 2;
          const cy = this.H / 2;
          const ang = Math.atan2(sy - cy, sx - cx);
          const rx = Math.min(Math.max(sx, m), this.W - m);
          const ry = Math.min(Math.max(sy, m + 46), this.H - m);
          const pulse = 1 + Math.sin(now * 5) * 0.15;
          ctx.save();
          ctx.translate(rx, ry);
          ctx.rotate(ang);
          ctx.scale(pulse, pulse);
          ctx.fillStyle = "#ffd166";
          ctx.shadowColor = "#ffd166";
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.moveTo(15, 0);
          ctx.lineTo(-8, -9);
          ctx.lineTo(-4, 0);
          ctx.lineTo(-8, 9);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          const dist = Math.round(Math.hypot(portal.x - this.player.x, portal.y - this.player.y) / 10);
          ctx.font = '11px "Russo One"';
          ctx.textAlign = "center";
          ctx.fillStyle = "rgba(0,0,0,0.65)";
          ctx.fillText(`ВРАТА · ${dist} м`, rx + 1, ry + 27);
          ctx.fillStyle = "#ffd166";
          ctx.fillText(`ВРАТА · ${dist} м`, rx, ry + 26);
        }
      }
    }

    // баннер главы/волны
    if (this.banner.t > 0) {
      const bt = this.banner.t;
      const alpha = Math.min(1, bt * 2) * Math.min(1, (2.8 - bt) * 3 + 0.4);
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.textAlign = "center";
      ctx.font = '54px "Russo One"';
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillText(this.banner.text, this.W / 2 + 3, this.H * 0.34 + 3);
      ctx.fillStyle = this.banner.text === "БОСС" ? "#ff2e4d" : "#ffd166";
      ctx.fillText(this.banner.text, this.W / 2, this.H * 0.34);
      ctx.font = '20px "Russo One"';
      ctx.fillStyle = "#f7ecf2";
      ctx.fillText(this.banner.sub, this.W / 2, this.H * 0.34 + 34);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // виньетка
    const vg = ctx.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.36, this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.72);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(5,2,10,0.55)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.W, this.H);

    // ульта-свечение
    if (this.player.ultT > 0) {
      ctx.fillStyle = `rgba(255,209,102,${0.08 + Math.sin(now * 20) * 0.03})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }
    if (this.flashRed > 0) {
      ctx.fillStyle = `rgba(255,46,77,${this.flashRed * 0.35})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }
    if (this.flashWhite > 0) {
      ctx.fillStyle = `rgba(255,246,216,${this.flashWhite})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }
    if (this.dead) {
      ctx.fillStyle = "rgba(60,4,16,0.45)";
      ctx.fillRect(0, 0, this.W, this.H);
    }
  }

  private drawDeco(d: { x: number; y: number; k: number; s: number }, accent: string, now: number) {
    const ctx = this.ctx;
    const ci = this.chapterIdx;
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.scale(d.s, d.s);
    ctx.globalAlpha = 0.5;
    if (ci === 0) {
      // деревья
      ctx.fillStyle = "rgba(8,20,10,0.9)";
      ctx.beginPath();
      ctx.arc(0, -30, 26, 0, Math.PI * 2);
      ctx.arc(-16, -12, 18, 0, Math.PI * 2);
      ctx.arc(16, -12, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-4, -8, 8, 22);
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.25 + Math.sin(now * 2 + d.x) * 0.1;
      ctx.beginPath();
      ctx.arc(-8, -34, 3, 0, Math.PI * 2);
      ctx.arc(10, -26, 2.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (ci === 1) {
      // руины
      ctx.fillStyle = "rgba(30,26,40,0.95)";
      ctx.fillRect(-20, -44, 14, 58);
      ctx.fillRect(6, -30, 14, 44);
      ctx.beginPath();
      ctx.moveTo(-26, -44);
      ctx.lineTo(-13, -58);
      ctx.lineTo(0, -44);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,159,67,0.4)";
      ctx.fillRect(-16, -20, 4, 6);
      ctx.fillRect(10, -12, 4, 6);
    } else {
      // колонны цитадели
      ctx.fillStyle = "rgba(40,12,20,0.95)";
      ctx.fillRect(-9, -56, 18, 70);
      ctx.fillStyle = "rgba(255,46,77,0.5)";
      ctx.fillRect(-9, -56, 18, 5);
      ctx.globalAlpha = 0.3 + Math.sin(now * 3 + d.y) * 0.15;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(0, -62, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------- отрисовка открытого мира ----------

  private drawWorldGround(ch: ChapterDef, now: number) {
    const ctx = this.ctx;
    // границы карты
    ctx.strokeStyle = "rgba(255,209,102,0.28)";
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 40, this.mapW - 16, this.mapH - 48);
    ctx.strokeStyle = `${ch.accent}30`;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(22, 54, this.mapW - 44, this.mapH - 76);

    const x0 = this.camX - 90;
    const x1 = this.camX + this.W + 90;
    const y0 = this.camY - 90;
    const y1 = this.camY + this.H + 90;
    for (const d of this.wDeco) {
      if (d.x < x0 || d.x > x1 || d.y < y0 || d.y > y1) continue;
      if (d.k === 3) {
        this.drawDeco(d, ch.accent, now);
        continue;
      }
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.scale(d.s, d.s);
      ctx.globalAlpha = 0.42;
      if (d.k === 0) {
        ctx.strokeStyle =
          this.worldIdx === 0 ? "rgba(140,220,120,0.85)" : this.worldIdx === 1 ? "rgba(255,159,67,0.55)" : "rgba(255,90,120,0.45)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-4, 4);
        ctx.lineTo(-5, -5);
        ctx.moveTo(0, 4);
        ctx.lineTo(0, -7);
        ctx.moveTo(4, 4);
        ctx.lineTo(6, -4);
        ctx.stroke();
      } else if (d.k === 1) {
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath();
        ctx.arc(0, 0, 1.6, 0, Math.PI * 2);
        ctx.arc(6, 3, 1.1, 0, Math.PI * 2);
        ctx.arc(-5, 2, 1.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "rgba(18,12,24,0.75)";
        ctx.beginPath();
        ctx.ellipse(0, 0, 9, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.beginPath();
        ctx.ellipse(-2, -2, 5, 2.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    for (const o of this.wObjs) {
      if (o.x < x0 || o.x > x1 || o.y < y0 || o.y > y1) continue;
      this.drawWorldObj(o, now);
    }
  }

  private drawWorldObj(o: { kind: string; x: number; y: number; used: boolean }, now: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(o.x, o.y);
    if (o.kind === "portal") {
      const pulse = 1 + Math.sin(now * 3) * 0.06;
      const g = ctx.createRadialGradient(0, -34, 4, 0, -34, 96 * pulse);
      g.addColorStop(0, "rgba(255,246,216,0.5)");
      g.addColorStop(1, "rgba(255,209,102,0)");
      ctx.fillStyle = g;
      ctx.fillRect(-110, -140, 220, 210);
      ctx.fillStyle = "rgba(28,15,32,0.95)";
      ctx.fillRect(-46, -80, 12, 88);
      ctx.fillRect(34, -80, 12, 88);
      ctx.fillRect(-54, -88, 108, 12);
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(-54, -88, 108, 4);
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = i === 0 ? "#ffd166" : i === 1 ? "#ff9f43" : "#fff6d8";
        ctx.lineWidth = 3.5 - i;
        ctx.beginPath();
        ctx.ellipse(0, -36, (30 - i * 8) * pulse, (40 - i * 10) * pulse, now * (0.8 + i * 0.3), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.font = '13px "Russo One"';
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillText("ВРАТА", 1, -103);
      ctx.fillStyle = "#ffd166";
      ctx.fillText("ВРАТА", 0, -104);
    } else if (o.kind === "spring") {
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 62);
      g.addColorStop(0, "rgba(124,255,207,0.65)");
      g.addColorStop(0.6, "rgba(53,240,208,0.28)");
      g.addColorStop(1, "rgba(53,240,208,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, 62, 31, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(180,255,235,0.85)";
      ctx.beginPath();
      ctx.ellipse(0, 0, 42, 19, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.4 + Math.sin(now * 4) * 0.2})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(0, 0, 30 + Math.sin(now * 2.2) * 4, 13, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(40,32,50,0.9)";
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * 52, Math.sin(a) * 26, 7, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (o.kind === "shrine") {
      const used = o.used;
      const g = ctx.createRadialGradient(0, -44, 2, 0, -44, 64);
      g.addColorStop(0, used ? "rgba(150,150,170,0.22)" : "rgba(255,209,102,0.5)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(-70, -116, 140, 150);
      ctx.fillStyle = "rgba(35,25,45,0.95)";
      ctx.fillRect(-10, -34, 20, 40);
      ctx.fillRect(-16, 2, 32, 8);
      ctx.save();
      ctx.translate(0, -54 + Math.sin(now * 2.4) * 4);
      ctx.rotate(now * 0.9);
      ctx.fillStyle = used ? "rgba(140,140,160,0.7)" : "#ffd166";
      if (!used) {
        ctx.shadowColor = "#ffd166";
        ctx.shadowBlur = 14;
      }
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(8, 0);
      ctx.lineTo(0, 12);
      ctx.lineTo(-8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      const used = o.used;
      ctx.fillStyle = used ? "rgba(70,50,40,0.8)" : "#8a5a2e";
      ctx.fillRect(-16, -14, 32, 20);
      ctx.fillStyle = used ? "rgba(90,66,50,0.8)" : "#a9713a";
      if (used) {
        ctx.save();
        ctx.translate(-16, -14);
        ctx.rotate(-0.7);
        ctx.fillRect(0, -8, 32, 9);
        ctx.restore();
      } else {
        ctx.fillRect(-16, -20, 32, 8);
      }
      ctx.fillStyle = used ? "rgba(120,110,90,0.8)" : "#ffd166";
      ctx.fillRect(-3, -12, 6, 7);
      if (!used) {
        ctx.fillStyle = `rgba(255,209,102,${0.25 + Math.sin(now * 5) * 0.15})`;
        ctx.fillRect(-16, -20, 32, 2);
      }
    }
    ctx.restore();
  }

  private drawPickup(pk: Pickup) {
    const ctx = this.ctx;
    const pulse = 1 + Math.sin(pk.t * 6) * 0.15;
    ctx.save();
    ctx.translate(pk.x, pk.y);
    ctx.scale(pulse, pulse);
    if (pk.kind === "xp") {
      ctx.fillStyle = "#7dff6a";
      ctx.shadowColor = "#7dff6a";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(5, 0);
      ctx.lineTo(0, 6);
      ctx.lineTo(-5, 0);
      ctx.closePath();
      ctx.fill();
    } else if (pk.kind === "cry") {
      ctx.fillStyle = "#7cc7ff";
      ctx.shadowColor = "#7cc7ff";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(6, -2);
      ctx.lineTo(3.6, 7);
      ctx.lineTo(-3.6, 7);
      ctx.lineTo(-6, -2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(2.6, -1.6);
      ctx.lineTo(0, 1);
      ctx.lineTo(-2.6, -1.6);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = "#ff6b8a";
      ctx.shadowColor = "#ff2e4d";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, 3);
      ctx.bezierCurveTo(-8, -3, -5, -9, 0, -4);
      ctx.bezierCurveTo(5, -9, 8, -3, 0, 3);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawProj(pr: Proj) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(pr.x, pr.y);
    if (pr.kind === "crescent") {
      const a = Math.atan2(pr.vy, pr.vx);
      ctx.rotate(a);
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = pr.color;
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(0, 0, 22, -1.2, 1.2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, 22, -0.9, 0.9);
      ctx.stroke();
    } else if (pr.kind === "arrow") {
      const a = Math.atan2(pr.vy, pr.vx);
      ctx.rotate(a);
      ctx.strokeStyle = pr.color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(10, 0);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(6, -4);
      ctx.lineTo(6, 4);
      ctx.closePath();
      ctx.fill();
    } else {
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, pr.r + 6);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.4, pr.color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, pr.r + 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
