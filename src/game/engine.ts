// Движок 2D-слэшера: цикл, бой, ИИ, волны, боссы, героини, частицы.

import { sfx } from "./audio";
import type { NetLink, NetMsg } from "./net";
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
  st: number;
  stMax: number;
  flask: number;
  flaskMax: number;
  locked: boolean;
  classId: string;
  lostRunes: number;
  netRole: "host" | "guest" | "solo";
  partnerName: string | null;
}

export interface EngineHandlers {
  onLevelUp: (choices: UpgradeDef[]) => void;
  onChapterEnd: (chapter: number) => void;
  onVictory: (stats: RunStats) => void;
  onGameOver: () => void;
  onSave: (save: RunSave) => void;
}

interface Enemy {
  id: number;
  type: EnemyType;
  kind?: "fire" | "ice" | "demon" | "bone" | "frost";
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
  elite?: boolean;
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
  kind: "xp" | "cry" | "heart" | "pile";
  v: number;
  t: number;
}

interface Telegraph {
  x: number;
  y: number;
  r: number;
  t: number;
  max: number;
  dmg: number;
  color: string;
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
  // плавная таймлайн-анимация атаки: 0..1, -1 = покой
  anim: number;
  dur: number;
  ox: number;
  oy: number;
  ax: number;
  ay: number;
  struck: boolean;
  fired: boolean;
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
  stam: number;
  flask: number;
}

export interface RunSave {
  v: number;
  classId: string;
  level: number;
  xp: number;
  xpNeed: number;
  hp: number;
  maxHp: number;
  atk: number;
  crit: number;
  speed: number;
  dashMax: number;
  waveMax: number;
  crystals: number;
  flaskMax: number;
  stMax: number;
  bonuses: Bonuses;
  worldIdx: number;
  heroineIds: string[];
  kills: number;
  runTime: number;
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
    st: 100,
    stMax: 100,
    stWait: 0,
    flask: 3,
    flaskMax: 3,
    deadNet: 0,
  };

  private classId = "blade";
  private autoT = 0;
  private lockId: number | null = null;
  private lostRunes = 0;
  private heartbeatT = 0;
  private telegraphs: Telegraph[] = [];
  private runePileAt: { x: number; y: number } | null = null;

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
    stam: 0,
    flask: 0,
  };

  private enemies: Enemy[] = [];
  private projs: Proj[] = [];
  private parts: Particle[] = [];
  private floats: Floater[] = [];
  private picks: Pickup[] = [];
  private arcs: Arc[] = [];
  private heroines: HeroineUnit[] = [];

  // ---- сетевой мультиплеер (WebRTC, хост авторитарен) ----
  private net: NetLink | null = null;
  private netRole: "host" | "guest" | "solo" = "solo";
  private mirror = false;
  private netKeys = new Set<string>();
  private netAim = 0;
  private partnerCfg = { classId: "blade", name: "Напарник" };
  private snapT = 0;
  private inputT = 0;
  private pressedBuf: string[] = [];
  private prevMouseDown = false;
  private prevKeys = new Set<string>();
  private p2: {
    x: number; y: number; face: 1 | -1; t: number;
    hp: number; maxHp: number; attackT: number; comboCd: number;
    dashT: number; dashCd: number; dashDx: number; dashDy: number;
    inv: number; deadT: number; moving: boolean; flask: number;
  } | null = null;

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
  private wObjs: { kind: "portal" | "spring" | "shrine" | "chest" | "hearth"; x: number; y: number; used: boolean }[] = [];
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
      if (e.code === "Tab") {
        e.preventDefault();
        this.toggleLock();
      }
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
      if (e.button === 2) this.toggleLock();
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

  start(classId: string) {
    this.classId = classId;
    this.blessingId = classId;
    this.p2 = null;
    const p = this.player;
    p.hp = 100;
    p.maxHp = 100;
    p.atk = 14;
    p.crit = 0.12;
    p.speed = 258;
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
    p.stMax = 100;
    p.st = 100;
    p.flaskMax = 3;
    p.flask = 3;
    this.bonuses = { atkP: 0, hp: 0, spdP: 0, critP: 0, vamp: 0, xpP: 0, cryP: 0, dashP: 0, ultP: 0, thorn: false, stam: 0, flask: 0 };
    if (classId === "blade") {
      this.bonuses.atkP += 25;
      this.bonuses.stam += 25;
    }
    if (classId === "frost") {
      this.bonuses.hp += 40;
      p.maxHp = 140;
      p.hp = 140;
    }
    if (classId === "arrow") {
      p.crystals = 80;
      this.bonuses.dashP += 30;
    }
    p.stMax += this.bonuses.stam;
    p.st = p.stMax;
    this.heroines = [];
    this.kills = 0;
    this.runTime = 0;
    this.dead = false;
    this.victoryDone = false;
    this.frozen = false;
    this.paused = false;
    this.combo = 0;
    this.lockId = null;
    this.lostRunes = 0;
    this.telegraphs = [];
    this.runePileAt = null;
    this.autoT = 1.4;
    this.startWorld(0);
  }

  serialize(): RunSave {
    const p = this.player;
    return {
      v: 1,
      classId: this.classId,
      level: p.level,
      xp: p.xp,
      xpNeed: p.xpNeed,
      hp: p.hp,
      maxHp: p.maxHp,
      atk: p.atk,
      crit: p.crit,
      speed: p.speed,
      dashMax: p.dashMax,
      waveMax: p.waveMax,
      crystals: p.crystals,
      flaskMax: p.flaskMax,
      stMax: p.stMax,
      bonuses: { ...this.bonuses },
      worldIdx: this.mode === "world" ? this.worldIdx : this.chapterIdx + 1,
      heroineIds: this.heroines.map((h) => h.def.id),
      kills: this.kills,
      runTime: this.runTime,
    };
  }

  loadSave(s: RunSave) {
    const p = this.player;
    this.classId = s.classId;
    p.level = s.level;
    p.xp = s.xp;
    p.xpNeed = s.xpNeed;
    p.maxHp = s.maxHp;
    p.hp = Math.min(s.hp, s.maxHp);
    p.atk = s.atk;
    p.crit = s.crit;
    p.speed = s.speed;
    p.dashMax = s.dashMax;
    p.waveMax = s.waveMax;
    p.crystals = s.crystals;
    p.flaskMax = s.flaskMax;
    p.flask = s.flaskMax;
    p.stMax = s.stMax;
    p.st = s.stMax;
    this.bonuses = { ...s.bonuses };
    this.heroines = [];
    for (const id of s.heroineIds) this.addHeroine(id);
    this.kills = s.kills;
    this.runTime = s.runTime;
    this.dead = false;
    this.victoryDone = false;
    this.frozen = false;
    this.lockId = null;
    this.lostRunes = 0;
    this.telegraphs = [];
    this.runePileAt = null;
    this.startWorld(Math.min(s.worldIdx, CHAPTERS.length - 1));
  }

  setPaused(b: boolean) {
    this.paused = b;
  }

  private toggleLock() {
    if (this.dead || this.paused || this.frozen) return;
    if (this.lockId !== null) {
      this.lockId = null;
      return;
    }
    const t = this.nearestEnemy(this.player.x, this.player.y, 560);
    if (t) {
      this.lockId = t.id;
      sfx.ui();
    }
  }

  private lockedEnemy(): Enemy | null {
    if (this.lockId === null) return null;
    const e = this.enemies.find((x) => x.id === this.lockId && x.hp > 0);
    if (!e) {
      this.lockId = null;
      return null;
    }
    if (Math.hypot(e.x - this.player.x, e.y - this.player.y) > 820) {
      this.lockId = null;
      return null;
    }
    return e;
  }

  private spendSt(cost: number): boolean {
    const p = this.player;
    if (p.st < cost) {
      if (p.stWait <= -0.4) {
        p.stWait = -0.4;
        this.floats.push({ x: p.x, y: p.y - 40, life: 0.5, max: 0.5, text: "НЕТ СИЛ", color: "#9aa8c7", size: 12 });
      }
      return false;
    }
    p.st -= cost;
    p.stWait = 0.7;
    return true;
  }

  private addTelegraph(x: number, y: number, r: number, delay: number, dmg: number, color: string) {
    this.telegraphs.push({ x, y, r, t: 0, max: delay, dmg, color });
  }

  private updateTelegraphs(dt: number) {
    const p = this.player;
    for (const tg of this.telegraphs) {
      tg.t += dt;
      if (tg.t >= tg.max) {
        tg.t = tg.max + 1;
        this.arcs.push({ x: tg.x, y: tg.y, ang: 0, spread: Math.PI * 2, r: tg.r, life: 0.3, max: 0.3, color: tg.color, width: 6 });
        this.burst(tg.x, tg.y, tg.color, 12, true);
        this.shake = Math.max(this.shake, 6);
        sfx.wave();
        if (Math.hypot(p.x - tg.x, p.y - tg.y) < tg.r + p.r * 0.5) this.playerHurt(tg.dmg);
        if (this.p2 && this.p2.deadT <= 0 && Math.hypot(this.p2.x - tg.x, this.p2.y - tg.y) < tg.r) this.hurtP2(tg.dmg * 0.8);
        for (const h of this.heroines) {
          if (Math.hypot(h.x - tg.x, h.y - tg.y) < tg.r) this.burst(h.x, h.y - 10, "#ff6b8a", 6, true);
        }
      }
    }
    this.telegraphs = this.telegraphs.filter((tg) => tg.t <= tg.max);
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
    else if (s.key === "flask") {
      this.bonuses.flask += s.val;
      this.player.flaskMax += s.val;
      this.player.flask += s.val;
    } else if (s.key === "stamP") {
      this.bonuses.stam += s.val;
      this.player.stMax += s.val;
    } else this.bonuses[s.key] += s.val;
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
      case "flask":
        this.bonuses.flask += 1;
        p.flaskMax += 1;
        p.flask += 1;
        break;
      case "stam":
        this.bonuses.stam += 25;
        p.stMax += 25;
        break;
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
      st: Math.round(p.st),
      stMax: p.stMax,
      flask: p.flask,
      flaskMax: p.flaskMax,
      locked: this.lockId !== null,
      classId: this.classId,
      lostRunes: this.lostRunes,
      netRole: this.netRole,
      partnerName: this.p2 ? this.partnerCfg.name : null,
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
    if (i === 3 && !this.heroines.some((h) => h.def.id === "yuki")) this.addHeroine("yuki");
    if (i === 4 && !this.heroines.some((h) => h.def.id === "lira")) this.addHeroine("lira");

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
    this.mapW = 3400 + this.worldIdx * 640;
    this.mapH = 1900 + this.worldIdx * 280;
    this.telegraphs = [];
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
    if (i === 3 && !this.heroines.some((h) => h.def.id === "yuki")) this.addHeroine("yuki");
    if (i === 4 && !this.heroines.some((h) => h.def.id === "lira")) this.addHeroine("lira");

    const rnd = mulberry(4242 + this.worldIdx * 911);
    this.wObjs = [];
    this.wObjs.push({ kind: "portal", x: this.mapW - 190, y: Math.min(Math.max(this.mapH / 2 + (rnd() - 0.5) * 500, 220), this.mapH - 220), used: false });
    // souls: очаг — точка сохранения и отдыха
    this.wObjs.push({ kind: "hearth", x: 560 + rnd() * (this.mapW - 1600), y: 260 + rnd() * (this.mapH - 520), used: false });
    this.wObjs.push({ kind: "spring", x: 520 + rnd() * (this.mapW - 1300), y: 220 + rnd() * (this.mapH - 440), used: false });
    this.wObjs.push({ kind: "shrine", x: 760 + rnd() * (this.mapW - 1500), y: 220 + rnd() * (this.mapH - 440), used: false });
    for (let k = 0; k < 4; k++) {
      this.wObjs.push({ kind: "chest", x: 420 + rnd() * (this.mapW - 900), y: 180 + rnd() * (this.mapH - 360), used: false });
    }
    for (let k = 0; k < 20; k++) {
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
    for (let k = 0; k < 130; k++) {
      this.wDeco.push({ x: rnd() * this.mapW, y: rnd() * this.mapH, k: Math.floor(rnd() * 4), s: 0.6 + rnd() });
    }
    // город: кварталы домов с факелами (со 2-й зоны)
    if (this.worldIdx >= 1) {
      const blocks = 3 + this.worldIdx;
      for (let b = 0; b < blocks; b++) {
        const bx = 700 + rnd() * (this.mapW - 1700);
        const by = 320 + rnd() * (this.mapH - 700);
        const houses = 3 + Math.floor(rnd() * 3);
        for (let hgi = 0; hgi < houses; hgi++) {
          this.wDeco.push({ x: bx + (rnd() - 0.5) * 360, y: by + (rnd() - 0.5) * 260, k: 4, s: 0.8 + rnd() * 0.9 });
        }
        for (let tgi = 0; tgi < 3; tgi++) {
          this.wDeco.push({ x: bx + (rnd() - 0.5) * 420, y: by + (rnd() - 0.5) * 300, k: 5, s: 1 });
        }
      }
    }
    this.worldSpawnT = 2.5;
    this.banner = { text: "ОТКРЫТЫЙ МИР", sub: `${ch.name} — очаг сохранит прогресс, врата ждут`, t: 3 };
    this.flashWhite = 0.7;
    sfx.join();
  }

  private makeEnemy(
    type: Exclude<EnemyType, "boss">,
    x: number,
    y: number,
    mul: number,
    spdMul: number,
    dmgMul: number,
    eliteChance: number
  ): Enemy {
    const base = ENEMY_BASE[type];
    const e: Enemy = {
      id: this.nextId++, type, x, y, vx: 0, vy: 0,
      hp: base.hp * mul, maxHp: base.hp * mul,
      r: base.r, speed: base.speed * spdMul, dmg: base.dmg * dmgMul,
      face: 1, t: Math.random() * 10, flash: 0, touchCd: 0,
      state: "idle", stateT: 0, shootCd: 1 + Math.random(),
      enraged: false, xp: base.xp, cry: base.cry,
    };
    // souls: элитный демон — крупнее, живучее, больнее, щедрее на руны
    if (Math.random() < eliteChance) {
      e.elite = true;
      e.hp = e.maxHp = base.hp * mul * 2.4;
      e.dmg = base.dmg * dmgMul * 1.5;
      e.r += 5;
      e.xp = Math.round(base.xp * 2);
      e.cry = [base.cry[0] * 2, base.cry[1] * 2 + 2];
    }
    return e;
  }

  private spawnEnemyAt(type: Exclude<EnemyType, "boss">, x: number, y: number, tier: number) {
    this.enemies.push(this.makeEnemy(type, x, y, 1 + tier * 0.5, 1 + tier * 0.08, 1 + tier * 0.35, 0.1 + tier * 0.06));
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
      if (this.enemies.length < 6) {
        const types: Exclude<EnemyType, "boss">[] = ["imp", "imp", "wraith", "spitter", "hound", "cultist"];
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
            : near.kind === "hearth"
              ? "E — отдохнуть у очага (сохранение)"
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
      if (near.kind === "hearth") {
        this.interactCd = 1.2;
        const p2 = this.player;
        p2.flask = p2.flaskMax;
        p2.hp = p2.maxHp;
        p2.st = p2.stMax;
        this.enemies = [];
        this.worldSpawnT = 3;
        this.burst(near.x, near.y - 20, "#ffd166", 30, true);
        this.floats.push({ x: p2.x, y: p2.y - 40, life: 1.2, max: 1.2, text: "ПРОГРЕСС СОХРАНЁН", color: "#ffd166", size: 17 });
        this.banner = { text: "ОЧАГ", sub: "Фляги полны · демоны вернутся · прогресс сохранён", t: 2.4 };
        sfx.levelup();
        this.handlers.onSave(this.serialize());
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
      anim: -1,
      dur: 0.6,
      ox: this.player.x,
      oy: this.player.y,
      ax: this.player.x,
      ay: this.player.y,
      struck: false,
      fired: false,
      tx: this.player.x,
      ty: this.player.y,
    });
  }

  // ---------- обновление ----------

  private update(dt: number) {
    // гость не симулирует мир — только доводит состояние до снапшота и шлёт инпуты
    if (this.mirror) {
      if (!this.paused) this.updateMirror(dt);
      this.sendInputs(dt);
      return;
    }
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

    // souls: стамина
    p.stWait = Math.max(-1, p.stWait - dt);
    if (p.stWait <= 0) p.st = Math.min(p.stMax, p.st + 42 * dt);

    // souls: фляга Эстуса (F)
    if (this.keys.has("KeyF") && p.flask > 0 && p.hp < p.maxHp) {
      this.keys.delete("KeyF");
      p.flask--;
      const heal = p.maxHp * 0.45;
      p.hp = Math.min(p.maxHp, p.hp + heal);
      this.floats.push({ x: p.x, y: p.y - 38, life: 1, max: 1, text: `+${Math.round(heal)} ФЛЯГА`, color: "#ffd166", size: 16 });
      this.burst(p.x, p.y - 12, "#ffd166", 16, true);
      sfx.heal();
    }

    // souls: поддержка захвата цели
    this.lockedEnemy();

    // класс Маг Мороза: автоматические ледяные снаряды
    if (this.classId === "frost") {
      this.autoT -= dt;
      if (this.autoT <= 0) {
        this.autoT = 2.1;
        const target = this.lockedEnemy() ?? this.nearestEnemy(p.x, p.y, 460);
        if (target) {
          const a = Math.atan2(target.y - p.y, target.x - p.x);
          this.projs.push({
            x: p.x + Math.cos(a) * 20, y: p.y - 14 + Math.sin(a) * 20,
            vx: Math.cos(a) * 480, vy: Math.sin(a) * 480,
            r: 8, dmg: this.effAtk() * 0.55, from: "ally", life: 1.1,
            color: "#9fd8ff", kind: "bolt", pierce: 1, hits: new Set(),
          });
          sfx.magic();
        }
      }
    }

    // souls: пульс сердца при низком HP
    if (p.hp < p.maxHp * 0.3) {
      this.heartbeatT -= dt;
      if (this.heartbeatT <= 0) {
        this.heartbeatT = 0.9;
        sfx.heartbeat();
      }
    }

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
    if ((this.keys.has("Space") || this.keys.has("ShiftLeft")) && p.dashCd <= 0 && p.dashT <= 0 && this.spendSt(24)) {
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

    // классовый навык (Q / K)
    p.waveCd = Math.max(0, p.waveCd - dt);
    if ((this.keys.has("KeyQ") || this.keys.has("KeyK")) && p.waveCd <= 0 && p.ultT <= 0 && this.spendSt(28)) {
      p.waveCd = p.waveMax;
      if (this.classId === "frost") {
        // Кольцо Мороза: ледяной взрыв вокруг героя
        this.arcs.push({ x: p.x, y: p.y - 6, ang: 0, spread: Math.PI * 2, r: 165, life: 0.3, max: 0.3, color: "#9fd8ff", width: 8 });
        for (const e of this.enemies) {
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          if (d < 175 + e.r) {
            const a = Math.atan2(e.y - p.y, e.x - p.x);
            this.hurtEnemy(e, this.effAtk() * 1.7, Math.random() < this.effCrit(), Math.cos(a) * 300, Math.sin(a) * 300);
            e.speed *= 0.6; // обморожение
            setTimeout(() => { if (e.hp > 0) e.speed /= 0.6; }, 1400);
          }
        }
        this.burst(p.x, p.y - 8, "#9fd8ff", 22, true);
        this.shake = Math.max(this.shake, 7);
        sfx.wave();
      } else if (this.classId === "arrow") {
        // Веер Стрел
        const base = Math.atan2(this.my - p.y, this.mx - p.x);
        for (let i = -1; i <= 1; i++) {
          const a = base + i * 0.24;
          this.projs.push({
            x: p.x + Math.cos(a) * 22, y: p.y - 10 + Math.sin(a) * 22,
            vx: Math.cos(a) * 640, vy: Math.sin(a) * 640,
            r: 9, dmg: this.effAtk() * 1.15, from: "ally", life: 0.9,
            color: "#35f0d0", kind: "arrow", pierce: 2, hits: new Set(),
          });
        }
        sfx.arrow();
        sfx.wave();
      } else {
        const a = Math.atan2(this.my - p.y, this.mx - p.x);
        this.projs.push({
          x: p.x + Math.cos(a) * 26, y: p.y - 8 + Math.sin(a) * 26,
          vx: Math.cos(a) * 540, vy: Math.sin(a) * 540,
          r: 24, dmg: this.effAtk() * 2.1, from: "ally", life: 0.85,
          color: "#35f0d0", kind: "crescent", pierce: 999, hits: new Set(),
        });
        sfx.wave();
      }
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
    if (this.netRole === "host" && this.p2) this.updatePartner(dt);
    if (this.mode === "battle") this.updateWaves(dt);
    else this.updateWorld(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateTelegraphs(dt);

    // хост периодически рассылает снапшоты гостю
    if (this.netRole === "host" && this.p2 && this.net) {
      this.snapT += dt;
      if (this.snapT >= 0.05) {
        this.snapT = 0;
        this.sendSnap();
      }
    }
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
      } else if (ch.ambient === "snow") {
        this.parts.push({ x, y: this.camY - 8, vx: -20 - Math.random() * 24, vy: 40 + Math.random() * 26, life: 5, max: 5, size: 1.6 + Math.random() * 2.2, color: "rgba(220,240,255,0.65)", glow: false, grav: 4 });
      } else {
        this.parts.push({ x, y: this.camY - 8, vx: -10 - Math.random() * 16, vy: 34 + Math.random() * 20, life: 5, max: 5, size: 2.5 + Math.random() * 2, color: "rgba(140,220,120,0.5)", glow: false, grav: 8 });
      }
    }
  }

  private doAttack() {
    const p = this.player;
    if (!this.spendSt(12)) {
      p.comboCd = 0.25;
      return;
    }
    const idx = p.comboIdx;
    p.comboIdx = (p.comboIdx + 1) % 3;
    const mul = [1, 1, 1.75][idx];
    const radius = [80, 80, 104][idx];
    const spread = [1.7, 1.7, 2.3][idx];
    p.comboCd = idx === 2 ? 0.42 : 0.3;
    p.attackT = 0;
    const lock = this.lockedEnemy();
    const aimX = lock ? lock.x : this.mx;
    const aimY = lock ? lock.y - 8 : this.my;
    const a = Math.atan2(aimY - (p.y - 8), aimX - p.x);
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
    // souls: рыцарь-демон блокирует щитом удары спереди
    if (e.type === "knight") {
      const fromRight = kx <= 0; // атака прилетела справа от врага?
      const attackerX = e.x - kx;
      const frontal = (attackerX >= e.x && e.face === 1) || (attackerX < e.x && e.face === -1);
      void fromRight;
      if (frontal && Math.random() < 0.6) {
        dmg *= 0.3;
        this.floats.push({ x: e.x, y: e.y - e.r - 14, life: 0.5, max: 0.5, text: "БЛОК!", color: "#c9a0ff", size: 13 });
        this.burst(e.x + e.face * 14, e.y - 8, "#c9a0ff", 5, true);
        kx *= 0.2;
        ky *= 0.2;
      }
    }
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

  private hurtHeroinesNear(x: number, y: number, r: number) {
    for (const h of this.heroines) {
      if (Math.hypot(h.x - x, h.y - y) < r) this.burst(h.x, h.y - 10, "#ff6b8a", 6, true);
    }
  }

  private killEnemy(e: Enemy) {
    this.kills++;
    const p = this.player;
    p.ult = Math.min(100, p.ult + 5 * this.ultMul());
    this.burst(e.x, e.y - 6, "#ff5a3c", 12, true);
    // souls: души павших слетаются к герою
    for (let i = 0; i < 3; i++) {
      this.parts.push({
        x: e.x, y: e.y - 10,
        vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 60,
        life: 0.7, max: 0.7, size: 3, color: "rgba(255,246,216,0.9)", glow: true, grav: -140,
      });
    }
    if (this.lockId === e.id) this.lockId = null;
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
    this.addCrystals(60 + this.chapterIdx * 20);
    this.hitstop = 0.55; // souls: медленное время в момент гибели босса
    sfx.bossDie();
    this.frozen = true;
    const idx = this.chapterIdx;
    setTimeout(() => {
      if (this.destroyed || this.dead) return;
      if (idx >= CHAPTERS.length - 1) {
        if (!this.victoryDone) {
          this.victoryDone = true;
          this.broadcastEnd("victory");
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
    this.lockId = null;
    // souls: руны рассыпаются на месте гибели
    const lost = Math.floor(p.crystals * 0.6);
    if (lost > 0) {
      p.crystals -= lost;
      this.lostRunes = lost;
      this.runePileAt = { x: p.x, y: p.y };
      this.picks.push({ x: p.x, y: p.y - 6, vx: 0, vy: 0, kind: "pile", v: lost, t: 0 });
    } else {
      this.lostRunes = 0;
    }
    this.burst(p.x, p.y - 10, "#f7ecf2", 34, true);
    this.burst(p.x, p.y - 10, "#ff2e4d", 16, true);
    this.flashRed = 0.7;
    sfx.death();
    setTimeout(() => {
      if (!this.destroyed && this.dead) {
        this.broadcastEnd("over");
        this.handlers.onGameOver();
      }
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
    const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
    const easeIn = (x: number) => x * x * x;
    this.heroines.forEach((h, i) => {
      h.t += dt;
      h.atkT -= dt;
      const slot = slots[i % 3];
      const sx = p.x + slot[0];
      const sy = p.y + slot[1];

      // ---- активная анимация атаки по таймлайну ----
      if (h.anim >= 0) {
        h.anim = Math.min(1, h.anim + dt / h.dur);
        const a = h.anim;
        const w = h.def.weapon;
        if (w === "blade") {
          // 0→0.16 замах (чуть назад), 0.16→0.42 рывок к цели, 0.42→1 возврат
          if (a < 0.16) {
            const k = easeIn(a / 0.16);
            const bx = h.ox - (h.ax - h.ox) * 0.12;
            const by = h.oy - (h.ay - h.oy) * 0.12;
            h.x = h.ox + (bx - h.ox) * k;
            h.y = h.oy + (by - h.oy) * k;
          } else if (a < 0.42) {
            const k = easeOut((a - 0.16) / 0.26);
            const bx = h.ox - (h.ax - h.ox) * 0.12;
            const by = h.oy - (h.ay - h.oy) * 0.12;
            h.x = bx + (h.ax - bx) * k;
            h.y = by + (h.ay - by) * k;
            // послесвечение-шлейф
            this.parts.push({ x: h.x, y: h.y - 10, vx: 0, vy: 0, life: 0.22, max: 0.22, size: 7, color: `${h.def.glow}66`, glow: true, grav: 0 });
            if (!h.struck && k > 0.75) {
              h.struck = true;
              const ang = Math.atan2(h.ay - h.y, h.ax - h.x);
              this.arcs.push({ x: h.ax, y: h.ay - 6, ang, spread: 2.1, r: 66, life: 0.2, max: 0.2, color: h.def.glow, width: 4.5 });
              const tgt = this.nearestEnemy(h.ax, h.ay, 70);
              if (tgt) {
                this.hurtEnemy(tgt, this.effAtk() * 1.1, false, Math.cos(ang) * 130, Math.sin(ang) * 130);
                this.burst(h.ax, h.ay - 8, h.def.glow, 8, true);
              }
              sfx.slash();
              this.hitstop = Math.max(this.hitstop, 0.02);
            }
          } else {
            const k = easeOut((a - 0.42) / 0.58);
            h.x = h.ax + (sx - h.ax) * k;
            h.y = h.ay + (sy - h.ay) * k;
          }
        } else if (w === "bow") {
          // лёгкий отшаг назад, натяжение, выстрел на 0.34, возврат
          if (a < 0.34) {
            const k = Math.sin((a / 0.34) * Math.PI);
            h.x = h.ox - (h.ax - h.ox) * 0.08 * k;
            h.y = h.oy - (h.ay - h.oy) * 0.08 * k;
            if (!h.fired && a >= 0.3) {
              h.fired = true;
              const ang = Math.atan2(h.ay - h.y, h.ax - h.x);
              this.projs.push({
                x: h.x, y: h.y - 12, vx: Math.cos(ang) * 620, vy: Math.sin(ang) * 620,
                r: 8, dmg: this.effAtk() * 0.75, from: "ally", life: 0.9,
                color: h.def.glow, kind: "arrow", pierce: 3, hits: new Set(),
              });
              sfx.arrow();
            }
          } else {
            const k = easeOut((a - 0.34) / 0.66);
            h.x = h.x + (sx - h.x) * k * 0.2;
            h.y = h.y + (sy - h.y) * k * 0.2;
          }
        } else {
          // посох: парит вверх, вспышка на 0.38, опускается
          const lift = Math.sin(a * Math.PI);
          h.x = h.ox + (sx - h.ox) * a;
          h.y = h.oy - 26 * lift + (sy - h.oy) * a * 0.4;
          if (!h.fired && a >= 0.38) {
            h.fired = true;
            this.doStaffAction(h);
          }
        }
        if (a >= 1) h.anim = -1;
        return;
      }

      const k = Math.min(1, dt * 5);
      h.x += (sx - h.x) * k;
      h.y += (sy - h.y) * k;
      if (h.atkT > 0) return;

      // ---- запуск атаки ----
      const w = h.def.weapon;
      const startAnim = (tx: number, ty: number, dur: number) => {
        h.anim = 0;
        h.dur = dur;
        h.ox = h.x;
        h.oy = h.y;
        h.ax = tx;
        h.ay = ty;
        h.struck = false;
        h.fired = false;
      };
      if (w === "blade") {
        const target = this.nearestEnemy(h.x, h.y, 260);
        if (!target) return;
        h.atkT = 1.15;
        const reach = Math.max(24, Math.hypot(target.x - h.x, target.y - h.y) - target.r - 8);
        const ang = Math.atan2(target.y - h.y, target.x - h.x);
        startAnim(h.x + Math.cos(ang) * reach, h.y + Math.sin(ang) * reach, 0.62);
      } else if (w === "bow") {
        const target = this.nearestEnemy(h.x, h.y, 440);
        if (!target) return;
        h.atkT = 1.35;
        startAnim(target.x, target.y, 0.7);
      } else {
        h.atkT = 2.4;
        startAnim(sx, sy, 0.95);
      }
    });
  }

  private doStaffAction(h: HeroineUnit) {
    const p = this.player;
    this.arcs.push({ x: h.x, y: h.y - 14, ang: 0, spread: Math.PI * 2, r: 44, life: 0.3, max: 0.3, color: h.def.glow, width: 3 });
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

  // ---------- сетевой напарник (хост авторитарен) ----------

  attachNet(net: NetLink, role: "host" | "guest", buffered: NetMsg[]) {
    this.net = net;
    this.netRole = role;
    if (role === "guest") this.mirror = true;
    for (const m of buffered) this.netReceive(m);
    net.send({ t: "cfg", classId: this.classId, name: role === "host" ? "Хост" : "Гость" });
  }

  netReceivePublic(msg: NetMsg) {
    this.netReceive(msg);
  }

  // сетевой режим: конец главы без локальных оверлеев (синхронно для обоих)
  silentChapterEnd(chapter: number) {
    const q = chapter === 0 ? ["aria"] : chapter === 2 ? ["yuki"] : chapter === 3 ? ["lira"] : [];
    for (const id of q) this.addHeroine(id);
    this.addCrystals(q.length > 0 ? 40 : 60);
    this.net?.send({ t: "chap", chapter });
    this.nextChapter();
  }

  private broadcastEnd(kind: "victory" | "over") {
    if (this.netRole !== "host") return;
    this.net?.send({ t: "end", kind, stats: kind === "victory" ? this.getStats() : null });
  }

  private netReceive(msg: NetMsg) {
    if (this.netRole === "host") {
      if (msg.t === "cfg") {
        this.partnerCfg = { classId: msg.classId || "blade", name: msg.name || "Гость" };
        if (!this.p2) {
          this.p2 = {
            x: this.player.x + 60, y: this.player.y + 30, face: -1, t: 0,
            hp: 110, maxHp: 110, attackT: -1, comboCd: 0, dashT: 0, dashCd: 0,
            dashDx: 0, dashDy: 0, inv: 0, deadT: 0, moving: false, flask: 3,
          };
          const q = this.p2;
          this.banner = { text: "НАПАРНИК В БОЮ", sub: `${this.partnerCfg.name} присоединился!`, t: 2.2 };
          this.burst(q.x, q.y - 10, "#7cc7ff", 26, true);
          sfx.join();
        }
      } else if (msg.t === "in") {
        this.netKeys = new Set<string>(msg.k || []);
        if (typeof msg.aim === "number") this.netAim = msg.aim;
        for (const pr of msg.p || []) this.partnerPress(pr);
      }
    } else if (msg.t === "s") {
      this.applySnap(msg);
    } else if (msg.t === "cfg") {
      this.partnerCfg = { classId: msg.classId || "blade", name: msg.name || "Хост" };
    } else if (msg.t === "chap") {
      // хост перешёл дальше — гость тоже получает героинь и следует за миром
      const q = msg.chapter === 0 ? ["aria"] : msg.chapter === 2 ? ["yuki"] : msg.chapter === 3 ? ["lira"] : [];
      for (const id of q) this.addHeroine(id);
    } else if (msg.t === "end") {
      if (msg.kind === "victory") this.handlers.onVictory(msg.stats);
      else this.handlers.onGameOver();
    }
  }

  private partnerPress(code: string) {
    const q = this.p2;
    if (!q || q.deadT > 0 || this.paused || this.frozen || this.dead) return;
    const a = this.netAim;
    if (code === "ATK" && q.comboCd <= 0 && q.attackT >= 0.4) {
      q.comboCd = 0.4;
      q.attackT = 0;
      if (Math.cos(a) !== 0) q.face = Math.cos(a) >= 0 ? 1 : -1;
      this.arcs.push({ x: q.x + Math.cos(a) * 30, y: q.y - 6, ang: a, spread: 1.6, r: 56, life: 0.16, max: 0.16, color: "#7cc7ff", width: 4 });
      sfx.slash();
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        const d = Math.hypot(e.x - q.x, e.y - q.y);
        if (d < 88 + e.r) {
          const ea = Math.atan2(e.y - q.y, e.x - q.x);
          let diff = Math.abs(ea - a);
          if (diff > Math.PI) diff = Math.PI * 2 - diff;
          if (diff < 1.25) this.hurtEnemy(e, this.effAtk() * 0.95, false, Math.cos(ea) * 130, Math.sin(ea) * 130);
        }
      }
    } else if (code === "DASH" && q.dashCd <= 0 && q.dashT <= 0) {
      q.dashT = 0.16;
      q.dashCd = 1.1;
      q.dashDx = Math.cos(a);
      q.dashDy = Math.sin(a);
      sfx.dash();
    } else if (code === "SKILL" && q.comboCd <= 0) {
      q.comboCd = 0.5;
      const cls = this.partnerCfg.classId;
      if (cls === "frost") {
        this.arcs.push({ x: q.x, y: q.y - 6, ang: 0, spread: Math.PI * 2, r: 130, life: 0.28, max: 0.28, color: "#9fd8ff", width: 6 });
        for (const e of this.enemies) {
          if (e.hp > 0 && Math.hypot(e.x - q.x, e.y - q.y) < 140 + e.r) {
            const ea = Math.atan2(e.y - q.y, e.x - q.x);
            this.hurtEnemy(e, this.effAtk() * 1.3, false, Math.cos(ea) * 260, Math.sin(ea) * 260);
          }
        }
        this.burst(q.x, q.y - 8, "#9fd8ff", 14, true);
        sfx.wave();
      } else if (cls === "arrow") {
        for (let i = -1; i <= 1; i++) {
          const aa = a + i * 0.24;
          this.projs.push({
            x: q.x + Math.cos(aa) * 22, y: q.y - 10 + Math.sin(aa) * 22,
            vx: Math.cos(aa) * 640, vy: Math.sin(aa) * 640,
            r: 9, dmg: this.effAtk() * 1.0, from: "ally", life: 0.9,
            color: "#35f0d0", kind: "arrow", pierce: 2, hits: new Set(),
          });
        }
        sfx.arrow();
      } else {
        this.projs.push({
          x: q.x + Math.cos(a) * 26, y: q.y - 8 + Math.sin(a) * 26,
          vx: Math.cos(a) * 540, vy: Math.sin(a) * 540,
          r: 22, dmg: this.effAtk() * 1.8, from: "ally", life: 0.8,
          color: "#7cc7ff", kind: "crescent", pierce: 999, hits: new Set(),
        });
        sfx.wave();
      }
    } else if (code === "FLASK" && q.flask > 0 && q.hp < q.maxHp) {
      q.flask--;
      const heal = q.maxHp * 0.45;
      q.hp = Math.min(q.maxHp, q.hp + heal);
      this.burst(q.x, q.y - 12, "#ffd166", 10, true);
      sfx.heart();
    }
  }

  private updatePartner(dt: number) {
    const q = this.p2!;
    const p = this.player;
    q.t += dt;
    q.comboCd -= dt;
    q.attackT = Math.min(1, q.attackT + dt / 0.3);
    q.dashCd = Math.max(0, q.dashCd - dt);
    q.inv = Math.max(0, q.inv - dt);

    // мёртв — ждём возрождения рядом с напарником
    if (q.deadT > 0) {
      q.deadT -= dt;
      if (q.deadT <= 0) {
        q.hp = q.maxHp;
        q.x = p.x + 40;
        q.y = p.y + 40;
        q.inv = 1.5;
        this.burst(q.x, q.y - 10, "#7cc7ff", 20, true);
        sfx.join();
      }
      return;
    }

    // движение по сетевым клавишам гостя
    const k = this.netKeys;
    let dx = 0;
    let dy = 0;
    if (k.has("KeyA") || k.has("ArrowLeft")) dx -= 1;
    if (k.has("KeyD") || k.has("ArrowRight")) dx += 1;
    if (k.has("KeyW") || k.has("ArrowUp")) dy -= 1;
    if (k.has("KeyS") || k.has("ArrowDown")) dy += 1;
    const len = Math.hypot(dx, dy);
    q.moving = len > 0;
    if (len > 0) {
      dx /= len;
      dy /= len;
      if (dx !== 0) q.face = dx > 0 ? 1 : -1;
    }
    if (q.dashT > 0) {
      q.dashT -= dt;
      q.x += q.dashDx * 560 * dt;
      q.y += q.dashDy * 560 * dt;
      this.parts.push({ x: q.x, y: q.y - 10, vx: 0, vy: 0, life: 0.2, max: 0.2, size: 6, color: "rgba(124,199,255,0.5)", glow: true, grav: 0 });
    } else {
      q.x += dx * 240 * dt;
      q.y += dy * 240 * dt;
    }
    const topB = this.mode === "world" ? 44 : 96;
    q.x = Math.min(Math.max(q.x, 26), this.vW - 26);
    q.y = Math.min(Math.max(q.y, topB), this.vH - 30);
  }

  private hurtP2(dmg: number) {
    const q = this.p2!;
    if (q.inv > 0 || q.dashT > 0 || q.deadT > 0) return;
    q.hp -= dmg;
    q.inv = 0.8;
    this.burst(q.x, q.y - 10, "#7cc7ff", 6, true);
    sfx.hit();
    if (q.hp <= 0) {
      q.hp = 0;
      q.deadT = 5;
      this.burst(q.x, q.y - 10, "#7cc7ff", 24, true);
      this.floats.push({ x: q.x, y: q.y - 40, life: 1, max: 1, text: `${this.partnerCfg.name} ПАЛ — 5с`, color: "#7cc7ff", size: 15 });
      sfx.hurt();
    }
  }

  // ---------- сетевые снапшоты (хост → гость) ----------

  private sendSnap() {
    const p = this.player;
    const q = this.p2;
    this.net?.send({
      t: "s",
      paused: this.paused,
      mode: this.mode,
      ch: this.chapterIdx,
      wv: this.waveIdx,
      wt: CHAPTERS[this.chapterIdx].waves.length,
      zone: CHAPTERS[this.mode === "world" ? this.worldIdx : this.chapterIdx].name,
      p: [p.x, p.y, p.face, p.hp, p.maxHp, p.attackT, p.dashT, p.inv > 0 ? 1 : 0, p.ultT > 0 ? 1 : 0, p.moving ? 1 : 0, p.ult, p.level],
      g: q ? [q.x, q.y, q.face, q.hp, q.maxHp, q.attackT, q.dashT, q.inv > 0 ? 1 : 0, 0, q.moving ? 1 : 0, q.deadT] : null,
      en: this.enemies.map((e) => [e.id, e.type === "boss" ? "boss" : e.type, e.kind ?? "", e.x, e.y, e.hp, e.maxHp, e.r, e.face, e.enraged ? 1 : 0, e.elite ? 1 : 0, e.state, e.stateT]),
      pr: this.projs.map((r) => [r.x, r.y, r.vx, r.vy, r.r, r.color, r.kind, r.from === "foe" ? 1 : 0, r.life]),
      pk: this.picks.map((r) => [r.x, r.y, r.kind, r.v]),
      fl: this.floats.slice(-24).map((f) => [f.x, f.y, f.text, f.color, f.life, f.max, f.size]),
      ar: this.arcs.slice(-10).map((r) => [r.x, r.y, r.ang, r.spread, r.r, r.life, r.max, r.color, r.width]),
      tg: this.telegraphs.map((r) => [r.x, r.y, r.r, r.t, r.max, r.color]),
      bn: this.banner.t > 0 ? [this.banner.text, this.banner.sub, this.banner.t] : null,
      kills: this.kills,
      runes: this.lostRunes,
      cry: p.crystals,
      xp: p.xp,
      xpN: p.xpNeed,
      st: p.st,
      stM: p.stMax,
      fl2: p.flask,
      flM: p.flaskMax,
      cam: [this.mapW, this.mapH],
    });
  }

  private applySnap(s: NetMsg) {
    const p = this.player;
    const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
    // гость управляет «g» (свой герой), напарник — «p» (хост)
    if (s.g) {
      p.x = lerp(p.x, s.g[0], 0.45);
      p.y = lerp(p.y, s.g[1], 0.45);
      p.face = s.g[2];
      p.hp = s.g[3];
      p.maxHp = s.g[4];
      p.attackT = s.g[5];
      p.dashT = s.g[6];
      p.inv = s.g[7] ? 0.4 : 0;
      p.moving = !!s.g[9];
      p.deadNet = s.g[10];
    }
    if (!this.p2 && s.p) {
      this.p2 = {
        x: s.p[0], y: s.p[1], face: s.p[2], t: 0, hp: s.p[3], maxHp: s.p[4],
        attackT: -1, comboCd: 0, dashT: 0, dashCd: 0, dashDx: 0, dashDy: 0,
        inv: 0, deadT: 0, moving: false, flask: 2,
      };
    } else if (this.p2 && s.p) {
      const q = this.p2;
      q.x = lerp(q.x, s.p[0], 0.45);
      q.y = lerp(q.y, s.p[1], 0.45);
      q.face = s.p[2];
      q.hp = s.p[3];
      q.maxHp = s.p[4];
      q.attackT = s.p[5];
      q.dashT = s.p[6];
      q.moving = !!s.p[9];
    }
    p.ult = s.p ? s.p[10] : p.ult;
    p.level = s.p ? s.p[11] : p.level;
    p.crystals = s.cry;
    p.xp = s.xp;
    p.xpNeed = s.xpN;
    p.st = s.st;
    p.stMax = s.stM;
    p.flask = s.fl2;
    p.flaskMax = s.flM;
    this.lostRunes = s.runes;
    this.kills = s.kills;
    this.mode = s.mode;
    this.chapterIdx = s.ch;
    this.waveIdx = s.wv;
    this.mapW = s.cam[0];
    this.mapH = s.cam[1];
    if (s.bn) this.banner = { text: s.bn[0], sub: s.bn[1], t: s.bn[2] };
    else if (this.banner.t > 0) this.banner.t = Math.min(this.banner.t, 0.2);
    // враги: сохраняем объекты по id для плавности
    const seen = new Set<number>();
    for (const e of s.en) {
      const id = e[0];
      seen.add(id);
      let en = this.enemies.find((x) => x.id === id);
      if (!en) {
        en = this.makeEnemy(e[1] === "boss" ? "imp" : e[1], e[3], e[4], 1, 1, 1, 0);
        en.id = id;
        if (e[1] === "boss") {
          en.type = "boss";
          en.kind = e[2];
          en.r = 40;
          this.boss = en;
        }
        this.enemies.push(en);
      }
      en.x += (e[3] - en.x) * 0.5;
      en.y += (e[4] - en.y) * 0.5;
      en.hp = e[5];
      en.maxHp = e[6];
      en.r = e[1] === "boss" ? 40 : e[7];
      en.face = e[8];
      en.enraged = !!e[9];
      en.elite = !!e[10];
      en.state = e[11];
      en.stateT = e[12];
      en.flash = Math.max(0, en.flash - 0.02);
    }
    this.enemies = this.enemies.filter((e) => seen.has(e.id));
    if (this.boss && !seen.has(this.boss.id)) this.boss = null;
    // снаряды/дроп/эффекты — заменяем целиком (движутся локально между снапшотами)
    this.projs = s.pr.map((r: number[]) => ({
      x: r[0], y: r[1], vx: r[2], vy: r[3], r: r[4], dmg: 0,
      from: r[7] ? ("foe" as const) : ("ally" as const), life: r[8],
      color: r[5], kind: r[6], pierce: 1, hits: new Set<number>(),
    }));
    this.picks = s.pk.map((r: (number | string)[]) => ({
      x: r[0] as number, y: r[1] as number, vx: 0, vy: 0,
      kind: r[2] as Pickup["kind"], v: r[3] as number, t: 0,
    }));
    for (const f of s.fl) {
      if (!this.floats.some((x) => x.text === f[2] && Math.abs(x.x - f[0]) < 4 && Math.abs(x.y - f[1]) < 4)) {
        this.floats.push({ x: f[0], y: f[1], text: f[2], color: f[3], life: f[4], max: f[5], size: f[6] });
      }
    }
    this.arcs = s.ar.map((r: number[]) => ({
      x: r[0], y: r[1], ang: r[2], spread: r[3], r: r[4], life: r[5], max: r[6], color: r[7], width: r[8],
    }));
    this.telegraphs = s.tg.map((r: (number | string)[]) => ({
      x: r[0] as number, y: r[1] as number, r: r[2] as number, t: r[3] as number, max: r[4] as number, color: r[5] as string, dmg: 0,
    }));
  }

  // гость: локальная симуляция выключена — только плавное доведение до снапшота
  private updateMirror(dt: number) {
    const p = this.player;
    p.t += dt;
    this.runTime += dt;
    this.vW = this.mapW;
    this.vH = this.mapH;
    // снаряды extrapolate по скорости
    for (const pr of this.projs) {
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;
    }
    this.projs = this.projs.filter((pr) => pr.life > 0);
    // таймеры визуальных эффектов
    for (const a of this.arcs) a.life -= dt;
    this.arcs = this.arcs.filter((a) => a.life > 0);
    for (const f of this.floats) {
      f.life -= dt;
      f.y -= 26 * dt;
    }
    this.floats = this.floats.filter((f) => f.life > 0);
    for (const pk of this.picks) pk.t += dt;
    if (this.p2) this.p2.t += dt;
    if (this.banner.t > 0) this.banner.t -= dt;
    // камера за своим героем
    const cx = Math.min(Math.max(p.x - this.W / 2, 0), Math.max(0, this.mapW - this.W));
    const cy = Math.min(Math.max(p.y - this.H / 2, 0), Math.max(0, this.mapH - this.H));
    const k = Math.min(1, dt * 9);
    this.camX += (cx - this.camX) * k;
    this.camY += (cy - this.camY) * k;
    this.mx = this.mouse.x + this.camX;
    this.my = this.mouse.y + this.camY;
    // ambient-частицы
    this.ambientT -= dt;
    if (this.ambientT <= 0 && this.parts.length < 130) {
      this.ambientT = 0.16;
      const ch = CHAPTERS[Math.min(this.chapterIdx, CHAPTERS.length - 1)];
      const x = this.camX + Math.random() * this.W;
      if (ch.ambient === "ember") this.parts.push({ x, y: this.camY + this.H + 8, vx: 0, vy: -36, life: 4, max: 4, size: 2.4, color: "rgba(255,140,60,0.7)", glow: true, grav: 0 });
      else if (ch.ambient === "snow") this.parts.push({ x, y: this.camY - 8, vx: -22, vy: 44, life: 5, max: 5, size: 2, color: "rgba(220,240,255,0.6)", glow: false, grav: 4 });
      else this.parts.push({ x, y: this.camY - 8, vx: -12, vy: 32, life: 5, max: 5, size: 2, color: "rgba(160,200,150,0.4)", glow: false, grav: 6 });
    }
    for (const pt of this.parts) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += pt.grav * dt;
    }
    this.parts = this.parts.filter((pt) => pt.life > 0);
    this.shake = Math.max(0, this.shake - dt * 26);
    this.flashRed = Math.max(0, this.flashRed - dt * 2);
    this.flashWhite = Math.max(0, this.flashWhite - dt * 2);
  }

  // гость: отправка ввода хосту
  private sendInputs(dt: number) {
    if (!this.net) return;
    this.inputT += dt;
    const p = this.player;
    const aim = Math.atan2(this.my - (p.y - 8), this.mx - p.x);

    // события-нажатия (атака, рывок, навык, фляга)
    if (this.mouse.down && !this.prevMouseDown) this.pressedBuf.push("ATK");
    this.prevMouseDown = this.mouse.down;
    if (this.keys.has("Space") && !this.prevKeys.has("Space")) this.pressedBuf.push("DASH");
    if ((this.keys.has("KeyQ") || this.keys.has("KeyK")) && !this.prevKeys.has("KeyQ") && !this.prevKeys.has("KeyK"))
      this.pressedBuf.push("SKILL");
    if (this.keys.has("KeyF") && !this.prevKeys.has("KeyF")) this.pressedBuf.push("FLASK");

    if (this.inputT >= 0.05) {
      this.inputT = 0;
      this.net.send({
        t: "in",
        k: [...this.keys],
        p: this.pressedBuf,
        aim,
      });
      this.pressedBuf = [];
      this.prevKeys = new Set(this.keys);
    }
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
    const mul = (1 + ch * 0.5) * (1 + Math.max(0, this.waveIdx) * 0.05);
    const pos = this.edgePos();
    this.enemies.push(this.makeEnemy(type, pos.x, pos.y, mul, 1 + ch * 0.08, 1 + ch * 0.35, 0.12 + ch * 0.07));
  }

  private spawnBoss() {
    const ch = CHAPTERS[this.chapterIdx];
    const b = ch.boss;
    this.boss = {
      id: this.nextId++,
      type: "boss",
      kind: b.kind,
      x: this.W / 2, y: 170, vx: 0, vy: 0,
      hp: b.hp, maxHp: b.hp, r: 40, speed: 82 + this.chapterIdx * 5, dmg: 26 + this.chapterIdx * 7,
      face: 1, t: 0, flash: 0, touchCd: 0,
      state: "enter", stateT: 1.4, shootCd: 2,
      enraged: false, xp: 100, cry: [50, 75],
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
      } else if (e.type === "hound") {
        // souls-гончая: кружит, затем рывок с телеграфом
        e.stateT -= dt;
        if (e.state === "lunge") {
          mx = e.vx;
          my = e.vy;
          if (e.stateT <= 0) {
            e.state = "circle";
            e.stateT = 1.4 + Math.random();
            e.vx = 0;
            e.vy = 0;
          }
        } else if (e.state === "windup") {
          e.flash = 0.06;
          if (e.stateT <= 0) {
            e.state = "lunge";
            e.stateT = 0.3;
            e.vx = nx * 620;
            e.vy = ny * 620;
            sfx.dash();
          }
        } else {
          const side = e.id % 2 === 0 ? 1 : -1;
          mx = (nx * 0.4 + -ny * side * 0.9) * e.speed;
          my = (ny * 0.4 + nx * side * 0.9) * e.speed;
          if (e.stateT <= 0 && dist < 240) {
            e.state = "windup";
            e.stateT = 0.34;
          }
        }
      } else if (e.type === "cultist") {
        // культ-маг: держит дистанцию, стреляет проклятыми сгустками, телепортируется
        if (dist > 360) {
          mx = nx * e.speed;
          my = ny * e.speed;
        } else if (dist < 230) {
          mx = -nx * e.speed;
          my = -ny * e.speed;
        }
        e.shootCd -= dt;
        if (e.shootCd <= 0 && dist < 560) {
          e.shootCd = 2.6;
          const a = Math.atan2(dyp, dxp);
          this.projs.push({
            x: e.x, y: e.y - 14, vx: Math.cos(a) * 290, vy: Math.sin(a) * 290,
            r: 8, dmg: e.dmg, from: "foe", life: 3,
            color: "#c46bff", kind: "orb", pierce: 1, hits: new Set(),
          });
          sfx.magic();
          if (Math.random() < 0.35) {
            this.burst(e.x, e.y - 8, "#c46bff", 10, true);
            const a2 = Math.random() * Math.PI * 2;
            e.x = Math.min(Math.max(e.x + Math.cos(a2) * 170, 40), this.vW - 40);
            e.y = Math.min(Math.max(e.y + Math.sin(a2) * 170, this.mode === "world" ? 70 : 110), this.vH - 40);
            this.burst(e.x, e.y - 8, "#c46bff", 10, true);
          }
        }
      } else if (e.type === "knight") {
        // бронированный демон-рыцарь: медленный, щит спереди
        mx = nx * e.speed;
        my = ny * e.speed;
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
      // урон второму игроку
      if (this.p2 && this.p2.deadT <= 0) {
        const d2 = Math.hypot(e.x - this.p2.x, e.y - this.p2.y);
        if (d2 < e.r + 16 && e.touchCd <= 0.45) this.hurtP2(e.dmg * 0.8);
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

    if (e.kind === "bone" && !e.enraged && hpFrac < 0.5) {
      e.enraged = true;
      e.speed *= 1.3;
      this.banner = { text: "НЕКРОМАНТИЯ", sub: "Каэл взывает к мёртвым!", t: 1.6 };
      sfx.bossRoar();
    }
    if (e.kind === "frost" && !e.enraged && hpFrac < 0.5) {
      e.enraged = true;
      e.speed *= 1.35;
      this.banner = { text: "МЕТЕЛЬ", sub: "Неэра обрушивает стужу!", t: 1.6 };
      sfx.bossRoar();
    }

    if (e.state === "move") {
      e.vx = nx * e.speed;
      e.vy = ny * e.speed;
      if (e.stateT <= 0) {
        const roll = Math.random();
        if (e.kind === "fire") e.state = roll < 0.55 ? "windup_radial" : "windup_charge";
        else if (e.kind === "ice") e.state = roll < 0.5 ? "windup_fan" : "summon";
        else if (e.kind === "bone") e.state = roll < 0.4 ? "windup_radial" : roll < 0.7 ? "windup_ring" : "summon";
        else if (e.kind === "frost") e.state = roll < 0.35 ? "windup_fan" : roll < 0.65 ? "windup_ring" : roll < 0.85 ? "windup_charge" : "summon";
        else e.state = roll < 0.34 ? "windup_radial" : roll < 0.58 ? "windup_charge" : roll < 0.8 ? "windup_ring" : "summon";
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
          const n = e.kind === "frost" && e.enraged ? 4 : 2;
          for (let i = -n; i <= n; i++) {
            const a = base + i * 0.2;
            this.projs.push({
              x: e.x, y: e.y - 10, vx: Math.cos(a) * 330, vy: Math.sin(a) * 330,
              r: 8, dmg: e.dmg * 0.7, from: "foe", life: 2.6,
              color: e.kind === "frost" ? "#9fd8ff" : "#bfe6ff", kind: "shard", pierce: 1, hits: new Set(),
            });
          }
          sfx.magic();
          e.state = "move";
          e.stateT = 1.4;
        } else if (e.state === "windup_ring") {
          // souls-телеграф: расширяющееся кольцо смерти на позиции героя
          const color = e.kind === "frost" ? "#9fd8ff" : "#c9a0ff";
          this.addTelegraph(p.x, p.y, 120 + (e.enraged ? 30 : 0), 0.95, e.dmg * 1.15, color);
          if (e.enraged) {
            this.addTelegraph(p.x + (Math.random() - 0.5) * 200, p.y + (Math.random() - 0.5) * 160, 90, 1.25, e.dmg, color);
          }
          sfx.bossRoar();
          e.state = "move";
          e.stateT = e.enraged ? 1 : 1.7;
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
        const n = e.kind === "ice" || e.kind === "frost" ? 3 : e.enraged ? 5 : 4;
        const pool: Exclude<EnemyType, "boss">[] =
          e.kind === "bone" ? ["cultist", "wraith", "imp"] :
          e.kind === "frost" ? ["wraith", "hound"] :
          e.kind === "ice" ? ["wraith"] : ["imp"];
        for (let i = 0; i < n; i++) {
          this.spawnEnemy(pool[Math.floor(Math.random() * pool.length)]);
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
        } else if (this.p2 && this.p2.deadT <= 0 && Math.hypot(pr.x - this.p2.x, pr.y - (this.p2.y - 6)) < pr.r + 16) {
          this.hurtP2(pr.dmg * 0.8);
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
          this.floats.push({ x: p.x, y: p.y - 34, life: 0.8, max: 0.8, text: `+${pk.v} РУН`, color: "#7cc7ff", size: 13 });
          sfx.crystal();
        } else if (pk.kind === "pile") {
          p.crystals += pk.v;
          this.lostRunes = 0;
          this.runePileAt = null;
          this.floats.push({ x: p.x, y: p.y - 38, life: 1.1, max: 1.1, text: `ВОЗВРАЩЕНО ${pk.v} РУН`, color: "#ffd166", size: 16 });
          this.burst(p.x, p.y - 10, "#ffd166", 18, true);
          sfx.levelup();
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

    // параллакс-горы (экранные координаты, медленнее камеры)
    if (world) this.drawParallax(ch, now);

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

    // souls-телеграфы зон смерти
    for (const tg of this.telegraphs) {
      const f = Math.min(1, tg.t / tg.max);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = `${tg.color}22`;
      ctx.beginPath();
      ctx.arc(tg.x, tg.y, tg.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = tg.color;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(tg.x, tg.y, tg.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // сжимающееся кольцо-таймер
      ctx.lineWidth = 4;
      ctx.globalCompositeOperation = "lighter";
      ctx.beginPath();
      ctx.arc(tg.x, tg.y, tg.r * (1 - f), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }

    // герои и враги (сортировка по y)
    type Drawable = { y: number; draw: () => void };
    const drawables: Drawable[] = [];
    for (const e of this.enemies) {
      drawables.push({
        y: e.y,
        draw: () => {
          // элитная аура
          if (e.elite) {
            const pulse = 0.5 + Math.sin(e.t * 6) * 0.2;
            const g = ctx.createRadialGradient(e.x, e.y - 6, 4, e.x, e.y - 6, e.r + 22);
            g.addColorStop(0, `rgba(255,209,102,${0.35 * pulse})`);
            g.addColorStop(1, "rgba(255,209,102,0)");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(e.x, e.y - 6, e.r + 22, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = `rgba(255,209,102,${0.6 * pulse})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(e.x, e.y - 6, e.r + 8 + Math.sin(e.t * 5) * 2, 0, Math.PI * 2);
            ctx.stroke();
          }
          drawDemon(ctx, {
            x: e.x, y: e.y, type: e.type === "boss" ? (e.kind ?? "demon") : e.type,
            t: e.t, face: e.face, flash: e.flash, hp: e.hp, maxHp: e.maxHp,
            boss: e.type === "boss", enraged: e.enraged, elite: e.elite, scale: e.type === "brute" ? 1.25 : e.elite ? 1.3 : 1,
          });
        },
      });
    }
    for (const h of this.heroines) {
      drawables.push({
        y: h.y,
        draw: () => {
          const def = h.def;
          let pose = -1;
          if (h.anim >= 0) {
            const a = h.anim;
            pose = a < 0.16 ? -0.4 * (a / 0.16) : Math.min(1, (a - 0.16) / 0.3);
            if (a > 0.6) pose = 1 - (a - 0.6) / 0.4;
          }
          drawChibi(ctx, {
            x: h.x, y: h.y, scale: 0.95, t: h.t,
            face: h.ax >= h.x ? 1 : -1, moving: h.anim < 0,
            attack: pose,
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

    // второй игрок (кооп)
    if (this.p2 && this.p2.deadT <= 0) {
      const q = this.p2;
      drawables.push({
        y: q.y,
        draw: () => {
          ctx.save();
          if (q.inv > 0 && Math.floor(q.t * 18) % 2 === 0) ctx.globalAlpha = 0.45;
          drawChibi(ctx, {
            x: q.x, y: q.y, scale: 1.0, t: q.t, face: q.face, moving: q.moving,
            attack: q.attackT < 1 ? q.attackT : -1, invuln: q.inv > 0,
            palette: { hair: "#7cc7ff", hairDark: "#3a7ab8", skin: "#ffe3d3", dress: "#1d4a8f", accent: "#bfe6ff", eyes: "#4dc9ff" },
            style: "spiky", weapon: "blade", glow: "#7cc7ff",
          });
          ctx.restore();
          // полоса HP и метка P2
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.fillRect(q.x - 18, q.y - 46, 36, 5);
          ctx.fillStyle = "#7cc7ff";
          ctx.fillRect(q.x - 18, q.y - 46, 36 * Math.max(0, q.hp / q.maxHp), 5);
          ctx.font = '9px "Russo One"';
          ctx.textAlign = "center";
          ctx.fillStyle = "#7cc7ff";
          ctx.fillText("P2", q.x, q.y - 50);
        },
      });
    }

    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    // тёплый свет вокруг героя
    this.drawPlayerLight();

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

    // souls: ретикл захвата цели
    const lockT = this.lockedEnemy();
    if (lockT) {
      const lr = lockT.r + 12 + Math.sin(now * 8) * 2;
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = 2.4;
      ctx.globalAlpha = 0.95;
      for (let i = 0; i < 4; i++) {
        const a0 = (i / 4) * Math.PI * 2 + now * 1.4;
        ctx.beginPath();
        ctx.arc(lockT.x, lockT.y - 6, lr, a0, a0 + 0.7);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // возврат в экранные координаты
    ctx.restore();

    // манга-спидлайны при рывке/ульте
    this.drawSpeedLines();

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

    // souls: letterbox при появлении босса
    if (this.banner.t > 0 && this.banner.text === "БОСС") {
      const bt = Math.min(1, this.banner.t * 1.6);
      ctx.fillStyle = `rgba(0,0,0,${0.85 * bt})`;
      const bh = 64 * bt;
      ctx.fillRect(0, 0, this.W, bh);
      ctx.fillRect(0, this.H - bh, this.W, bh);
    }

    // souls: пульсирующая виньетка при низком HP
    const hpF2 = this.player.hp / this.player.maxHp;
    if (hpF2 < 0.3 && !this.dead) {
      const pulse = 0.22 + Math.sin(now * 5) * 0.1;
      const dg = ctx.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.28, this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.66);
      dg.addColorStop(0, "rgba(120,0,20,0)");
      dg.addColorStop(1, `rgba(140,0,26,${pulse})`);
      ctx.fillStyle = dg;
      ctx.fillRect(0, 0, this.W, this.H);
    }

    // миникарта (в мире)
    if (world) this.drawMinimap();

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

  // ---------- параллакс-горы ----------

  private drawParallax(ch: ChapterDef, now: number) {
    const ctx = this.ctx;
    // дальний слой (медленный)
    const layers = [
      { f: 0.18, yBase: 0.34, amp: 0.1, color: "rgba(20,10,28,0.55)", seed: 3 },
      { f: 0.35, yBase: 0.44, amp: 0.14, color: "rgba(30,14,38,0.6)", seed: 7 },
    ];
    for (const L of layers) {
      const off = -this.camX * L.f;
      ctx.fillStyle = L.color;
      ctx.beginPath();
      ctx.moveTo(-40, this.H);
      const step = 90;
      for (let x = -step; x <= this.W + step; x += step) {
        const wx = x - (off % step);
        const n = Math.sin((wx + this.camX * L.f) * 0.008 + L.seed) + Math.sin((wx + this.camX * L.f) * 0.021 + L.seed * 2);
        const y = this.H * L.yBase + n * this.H * L.amp;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(this.W + 40, this.H);
      ctx.closePath();
      ctx.fill();
    }
    // туман
    const fogY = this.H * 0.55 + Math.sin(now * 0.4) * 8;
    const fg = ctx.createLinearGradient(0, fogY - 40, 0, fogY + 90);
    fg.addColorStop(0, "rgba(120,90,140,0)");
    fg.addColorStop(0.5, "rgba(120,90,140,0.12)");
    fg.addColorStop(1, "rgba(120,90,140,0)");
    ctx.fillStyle = fg;
    ctx.fillRect(0, fogY - 40, this.W, 130);
  }

  // ---------- свет вокруг героя ----------

  private drawPlayerLight() {
    const ctx = this.ctx;
    const p = this.player;
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(p.x, p.y - 10, 6, p.x, p.y - 10, 90);
    g.addColorStop(0, "rgba(255,220,150,0.16)");
    g.addColorStop(1, "rgba(255,220,150,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 10, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  // ---------- спидлайны при рывке/ульте ----------

  private drawSpeedLines() {
    const ctx = this.ctx;
    const p = this.player;
    if (p.dashT <= 0 && p.ultT <= 0) return;
    ctx.save();
    ctx.translate(p.x - this.camX, p.y - this.camY);
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = p.ultT > 0 ? "rgba(255,209,102,0.3)" : "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
      const r0 = 60 + Math.random() * 60;
      const r1 = r0 + 90 + Math.random() * 120;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
  }

  // ---------- миникарта ----------

  private drawMinimap() {
    const ctx = this.ctx;
    const mw = 176;
    const mh = Math.round((mw * this.mapH) / this.mapW);
    const mx0 = this.W - mw - 16;
    const my0 = 64;
    const sx = mw / this.mapW;
    const sy = mh / this.mapH;
    ctx.save();
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = "rgba(8,4,14,0.82)";
    ctx.fillRect(mx0 - 3, my0 - 3, mw + 6, mh + 6);
    ctx.strokeStyle = "rgba(255,209,102,0.55)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mx0 - 3, my0 - 3, mw + 6, mh + 6);
    // видимая область
    ctx.strokeStyle = "rgba(247,236,242,0.25)";
    ctx.strokeRect(mx0 + this.camX * sx, my0 + this.camY * sy, this.W * sx, this.H * sy);
    const dot = (x: number, y: number, c: string, r: number) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(mx0 + x * sx, my0 + y * sy, r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const o of this.wObjs) {
      const c = o.kind === "portal" ? "#ffd166" : o.kind === "hearth" ? "#ff9f43" : o.kind === "spring" ? "#7bffce" : o.kind === "shrine" ? "#c46bff" : "#8a5a2e";
      dot(o.x, o.y, c, o.kind === "portal" || o.kind === "hearth" ? 3.4 : 2.4);
    }
    for (const e of this.enemies) dot(e.x, e.y, e.type === "boss" ? "#ff2e4d" : "rgba(255,90,60,0.8)", e.type === "boss" ? 4 : 2);
    for (const h of this.heroines) dot(h.x, h.y, "#ff6b8a", 2.4);
    dot(this.player.x, this.player.y, "#f7ecf2", 3.2);
    ctx.font = '9px "Russo One"';
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,209,102,0.8)";
    ctx.fillText(CHAPTERS[this.worldIdx].name, mx0 + mw, my0 - 8);
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
      if (d.k === 4) {
        // дом: силуэт с крышей и тёплыми окнами
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.scale(d.s, d.s);
        ctx.fillStyle = "rgba(16,10,20,0.92)";
        ctx.fillRect(-34, -46, 68, 52);
        ctx.beginPath();
        ctx.moveTo(-40, -46);
        ctx.lineTo(0, -74);
        ctx.lineTo(40, -46);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255,159,67,0.5)";
        ctx.fillRect(-22, -34, 9, 11);
        ctx.fillRect(12, -34, 9, 11);
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.fillRect(-6, -24, 12, 30);
        ctx.restore();
        continue;
      }
      if (d.k === 5) {
        // факел
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.fillStyle = "rgba(30,20,14,0.95)";
        ctx.fillRect(-2, -26, 4, 26);
        const fl = 0.6 + Math.sin(now * 9 + d.x) * 0.25;
        const g = ctx.createRadialGradient(0, -30, 1, 0, -30, 20);
        g.addColorStop(0, "rgba(255,220,120,0.9)");
        g.addColorStop(0.5, `rgba(255,140,50,${0.5 * fl})`);
        g.addColorStop(1, "rgba(255,120,40,0)");
        ctx.fillStyle = g;
        ctx.fillRect(-22, -52, 44, 44);
        ctx.fillStyle = "#ffd166";
        ctx.beginPath();
        ctx.ellipse(0, -30, 3.4, 5 + fl * 2.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
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
    } else if (o.kind === "hearth") {
      // souls-очаг: костёр из мечей
      const g = ctx.createRadialGradient(0, -14, 2, 0, -14, 70);
      g.addColorStop(0, "rgba(255,209,102,0.5)");
      g.addColorStop(1, "rgba(255,120,40,0)");
      ctx.fillStyle = g;
      ctx.fillRect(-80, -90, 160, 160);
      ctx.fillStyle = "rgba(40,24,16,0.95)";
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate((i / 5) * Math.PI * 2 + 0.3);
        ctx.fillRect(-2, -4, 26, 5);
        ctx.restore();
      }
      ctx.fillStyle = "rgba(70,70,80,0.9)";
      ctx.beginPath();
      ctx.ellipse(0, 2, 17, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // меч в центре
      ctx.strokeStyle = "#cfd6e6";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -34);
      ctx.lineTo(0, 0);
      ctx.moveTo(-6, -26);
      ctx.lineTo(6, -26);
      ctx.stroke();
      // пламя
      for (let i = 0; i < 3; i++) {
        const fh = 16 + Math.sin(now * 11 + i * 2.1) * 5;
        const fx = (i - 1) * 6;
        ctx.fillStyle = i === 1 ? "rgba(255,230,140,0.95)" : "rgba(255,140,50,0.85)";
        ctx.beginPath();
        ctx.moveTo(fx - 5, 0);
        ctx.quadraticCurveTo(fx - 6, -fh * 0.5, fx, -fh);
        ctx.quadraticCurveTo(fx + 6, -fh * 0.5, fx + 5, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.font = '11px "Russo One"';
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillText("ОЧАГ", 1, -46);
      ctx.fillStyle = "#ffd166";
      ctx.fillText("ОЧАГ", 0, -47);
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
    if (pk.kind === "pile") {
      // souls: куча потерянных рун
      const g = ctx.createRadialGradient(0, -6, 2, 0, -6, 26);
      g.addColorStop(0, "rgba(255,209,102,0.8)");
      g.addColorStop(1, "rgba(255,209,102,0)");
      ctx.fillStyle = g;
      ctx.fillRect(-28, -34, 56, 56);
      ctx.fillStyle = "#ffd166";
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + pk.t * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 7, -6 + Math.sin(a) * 4, 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#fff6d8";
      ctx.beginPath();
      ctx.arc(0, -6, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
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
