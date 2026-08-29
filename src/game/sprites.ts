// Процедурная отрисовка всех персонажей (без внешних ассетов).

export interface ChibiPalette {
  hair: string;
  hairDark: string;
  skin: string;
  dress: string;
  accent: string;
  eyes: string;
}

export interface ChibiOpts {
  x: number;
  y: number;
  scale?: number;
  t?: number;
  face?: 1 | -1;
  moving?: boolean;
  attack?: number; // 0..1 — прогресс взмаха, <0 — нет
  invuln?: boolean;
  ult?: boolean;
  palette: ChibiPalette;
  style: "spiky" | "long" | "twintail" | "bob";
  weapon: "blade" | "bow" | "staff" | "none";
  glow: string;
}

export function drawChibi(ctx: CanvasRenderingContext2D, o: ChibiOpts) {
  const s = o.scale ?? 1;
  const t = o.t ?? 0;
  const p = o.palette;
  const bob = o.moving ? Math.sin(t * 13) * 2.2 * s : Math.sin(t * 3.2) * 1.1 * s;
  const face = o.face ?? 1;

  ctx.save();
  ctx.translate(o.x, o.y);
  if (o.invuln && Math.floor(t * 18) % 2 === 0) ctx.globalAlpha = 0.4;

  // тень
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.beginPath();
  ctx.ellipse(0, 15 * s, 15 * s, 5.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  if (o.ult) {
    const g = ctx.createRadialGradient(0, -6 * s, 4, 0, -6 * s, 34 * s);
    g.addColorStop(0, "rgba(255,209,102,0.5)");
    g.addColorStop(1, "rgba(255,209,102,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -6 * s, 34 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.scale(face, 1);

  // ---- волосы сзади (длинные / хвосты)
  if (o.style === "long") {
    ctx.fillStyle = p.hairDark;
    ctx.beginPath();
    ctx.moveTo(-11 * s, -20 * s);
    ctx.quadraticCurveTo(-16 * s, 6 * s, -8 * s + Math.sin(t * 4) * 1.5 * s, 18 * s);
    ctx.lineTo(8 * s + Math.sin(t * 4 + 1) * 1.5 * s, 18 * s);
    ctx.quadraticCurveTo(16 * s, 6 * s, 11 * s, -20 * s);
    ctx.closePath();
    ctx.fill();
  } else if (o.style === "twintail") {
    ctx.fillStyle = p.hairDark;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * 10 * s, -18 * s);
      ctx.quadraticCurveTo(dir * 19 * s, -2 * s, dir * (13 * s + Math.sin(t * 5 + dir) * 2 * s), 16 * s);
      ctx.quadraticCurveTo(dir * 8 * s, 10 * s, dir * 7 * s, -16 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = p.accent;
      ctx.beginPath();
      ctx.arc(dir * 11 * s, -16 * s, 2.6 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.hairDark;
    }
  }

  // ---- тело
  const bodyY = -2 * s + bob * 0.4;
  const bg = ctx.createLinearGradient(0, bodyY - 8 * s, 0, bodyY + 14 * s);
  bg.addColorStop(0, p.dress);
  bg.addColorStop(1, shade(p.dress, -30));
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(-9 * s, bodyY - 4 * s);
  ctx.quadraticCurveTo(-11 * s, bodyY + 12 * s, -6 * s, bodyY + 13 * s);
  ctx.lineTo(6 * s, bodyY + 13 * s);
  ctx.quadraticCurveTo(11 * s, bodyY + 12 * s, 9 * s, bodyY - 4 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p.accent;
  ctx.fillRect(-9 * s, bodyY + 2 * s, 18 * s, 2.4 * s);
  // ножки
  ctx.fillStyle = shade(p.dress, -45);
  ctx.beginPath();
  ctx.ellipse(-4 * s, bodyY + 14 * s, 3 * s, 2.2 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(4 * s, bodyY + 14 * s, 3 * s, 2.2 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // ---- оружие (в правой руке)
  const atk = o.attack !== undefined && o.attack >= 0 ? o.attack : -1;
  const swing = atk >= 0 ? -1.4 + atk * 2.6 : -0.5 + Math.sin(t * 3) * 0.08;
  ctx.save();
  ctx.translate(10 * s, bodyY + 1 * s);
  ctx.rotate(swing);
  if (o.weapon === "blade") {
    ctx.strokeStyle = "#cfd6e6";
    ctx.lineWidth = 2.6 * s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(20 * s, -6 * s);
    ctx.stroke();
    ctx.strokeStyle = o.glow;
    ctx.globalAlpha = (ctx.globalAlpha || 1) * 0.55;
    ctx.lineWidth = 4.4 * s;
    ctx.beginPath();
    ctx.moveTo(2 * s, 0);
    ctx.lineTo(21 * s, -6 * s);
    ctx.stroke();
    ctx.globalAlpha = o.invuln && Math.floor(t * 18) % 2 === 0 ? 0.4 : 1;
    ctx.fillStyle = p.accent;
    ctx.fillRect(-1.4 * s, -2 * s, 3 * s, 4 * s);
  } else if (o.weapon === "bow") {
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.arc(6 * s, 0, 10 * s, -1.1, 1.1);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.moveTo(6 * s + 10 * s * Math.cos(-1.1), 10 * s * Math.sin(-1.1));
    ctx.lineTo(6 * s + 10 * s * Math.cos(1.1), 10 * s * Math.sin(1.1));
    ctx.stroke();
  } else if (o.weapon === "staff") {
    ctx.strokeStyle = "#8a5a3c";
    ctx.lineWidth = 2.4 * s;
    ctx.beginPath();
    ctx.moveTo(0, 4 * s);
    ctx.lineTo(4 * s, -16 * s);
    ctx.stroke();
    const og = ctx.createRadialGradient(4 * s, -18 * s, 0.5, 4 * s, -18 * s, 5 * s);
    og.addColorStop(0, "#ffffff");
    og.addColorStop(0.5, o.glow);
    og.addColorStop(1, "rgba(53,240,208,0)");
    ctx.fillStyle = og;
    ctx.beginPath();
    ctx.arc(4 * s, -18 * s, 5 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // ---- голова
  const hy = -16 * s + bob;
  // затылок
  ctx.fillStyle = p.hairDark;
  ctx.beginPath();
  ctx.arc(0, hy, 11.5 * s, 0, Math.PI * 2);
  ctx.fill();
  // лицо
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.ellipse(1 * s, hy + 1.5 * s, 9.2 * s, 9.6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // глаза
  for (const ex of [2.2, 8]) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(ex * s, hy + 2.5 * s, 2.6 * s, 3.1 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.eyes;
    ctx.beginPath();
    ctx.ellipse(ex * s + 0.5 * s, hy + 3 * s, 1.7 * s, 2.2 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#101018";
    ctx.beginPath();
    ctx.arc(ex * s + 0.7 * s, hy + 3.2 * s, 1 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(ex * s + 0.1 * s, hy + 1.9 * s, 0.8 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  // румянец у девушек
  if (o.style !== "spiky") {
    ctx.fillStyle = "rgba(255,110,130,0.35)";
    ctx.beginPath();
    ctx.ellipse(0.5 * s, hy + 6 * s, 2 * s, 1 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(9.5 * s, hy + 6 * s, 2 * s, 1 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // рот
  ctx.strokeStyle = "#8c4a52";
  ctx.lineWidth = 0.9 * s;
  ctx.beginPath();
  ctx.arc(5 * s, hy + 6.5 * s, 1.6 * s, 0.2, Math.PI - 0.6);
  ctx.stroke();

  // ---- чёлка
  ctx.fillStyle = p.hair;
  if (o.style === "spiky") {
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      const bx = Math.cos(a) * 11.5 * s;
      const by = hy + Math.sin(a) * 11.5 * s;
      const tx = Math.cos(a) * (17 + (i % 2) * 4) * s;
      const ty = hy + Math.sin(a) * (17 + (i % 2) * 4) * s;
      if (i === 0) ctx.moveTo(bx, by);
      ctx.lineTo(tx, ty);
      const na = Math.PI + ((i + 1) / 6) * Math.PI;
      ctx.lineTo(Math.cos(na) * 11.5 * s, hy + Math.sin(na) * 11.5 * s);
    }
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, hy - 2 * s, 11.5 * s, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
  } else if (o.style === "bob") {
    ctx.beginPath();
    ctx.arc(0, hy - 1 * s, 12 * s, Math.PI * 0.95, Math.PI * 2.02);
    ctx.quadraticCurveTo(13 * s, hy + 8 * s, 9 * s, hy + 10 * s);
    ctx.quadraticCurveTo(6 * s, hy + 2 * s, 0, hy - 4 * s);
    ctx.quadraticCurveTo(-4 * s, hy + 3 * s, -9.5 * s, hy + 9 * s);
    ctx.quadraticCurveTo(-13 * s, hy + 6 * s, -12 * s, hy - 1 * s);
    ctx.closePath();
    ctx.fill();
  } else {
    // long / twintail — косая чёлка
    ctx.beginPath();
    ctx.arc(0, hy - 2 * s, 11.8 * s, Math.PI, 0);
    ctx.quadraticCurveTo(12 * s, hy + 4 * s, 8 * s, hy + 6 * s);
    ctx.quadraticCurveTo(4 * s, hy - 1 * s, 1 * s, hy + 4 * s);
    ctx.quadraticCurveTo(-3 * s, hy - 2 * s, -7 * s, hy + 6 * s);
    ctx.quadraticCurveTo(-12 * s, hy + 4 * s, -11.8 * s, hy - 2 * s);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

// ======================= демоны =======================

const DEMON_COLORS: Record<string, { body: [string, string]; eye: string; horn: string }> = {
  imp: { body: ["#c22747", "#5c0a1c"], eye: "#ffe14d", horn: "#3d0713" },
  spitter: { body: ["#4fae43", "#1d4a1c"], eye: "#ff9f43", horn: "#12300f" },
  brute: { body: ["#8a6f5a", "#3d2f24"], eye: "#ff5a3c", horn: "#241a12" },
  wraith: { body: ["#7a4df0", "#2a1555"], eye: "#35f0d0", horn: "#1a0c38" },
  fire: { body: ["#ff9f43", "#8f2410"], eye: "#ffe14d", horn: "#4a0d05" },
  ice: { body: ["#9fd8ff", "#1d4a8f"], eye: "#e8f7ff", horn: "#0e2a55" },
  demon: { body: ["#ff2e4d", "#38060f"], eye: "#ffd166", horn: "#1c030a" },
  hound: { body: ["#8f8f9e", "#2c2434"], eye: "#ff5a3c", horn: "#1a1420" },
  cultist: { body: ["#6a4fa0", "#241540"], eye: "#c46bff", horn: "#120a24" },
  knight: { body: ["#5a6478", "#1c202c"], eye: "#ff2e4d", horn: "#10131c" },
  bone: { body: ["#e8e0d0", "#4a3f55"], eye: "#c9a0ff", horn: "#2c2438" },
  frost: { body: ["#cfeaff", "#2a5a8f"], eye: "#9fd8ff", horn: "#123050" },
};

export function drawDemon(
  ctx: CanvasRenderingContext2D,
  o: {
    x: number;
    y: number;
    type: string;
    scale?: number;
    t?: number;
    face?: 1 | -1;
    flash?: number;
    hp: number;
    maxHp: number;
    boss?: boolean;
    enraged?: boolean;
  }
) {
  const s = (o.scale ?? 1) * (o.boss ? 2.7 : 1);
  const t = o.t ?? 0;
  const c = DEMON_COLORS[o.type] ?? DEMON_COLORS.imp;
  const wraith = o.type === "wraith";
  const hop = Math.sin(t * (wraith ? 9 : 5)) * 2 * s;

  ctx.save();
  ctx.translate(o.x, o.y);
  if (wraith) ctx.globalAlpha = 0.82;

  // тень
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 13 * s, 13 * s, 4.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  if (o.enraged) {
    const g = ctx.createRadialGradient(0, -4 * s, 2, 0, -4 * s, 26 * s);
    g.addColorStop(0, "rgba(255,46,77,0.4)");
    g.addColorStop(1, "rgba(255,46,77,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -4 * s, 26 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.scale(o.face ?? 1, 1);

  // хвост-дым у призрака
  if (wraith) {
    ctx.fillStyle = c.body[1];
    ctx.beginPath();
    ctx.moveTo(-8 * s, -2 * s);
    ctx.quadraticCurveTo(-16 * s, 4 * s + Math.sin(t * 7) * 3 * s, -20 * s, 10 * s);
    ctx.quadraticCurveTo(-8 * s, 10 * s, -2 * s, 6 * s);
    ctx.closePath();
    ctx.fill();
  }

  // тело
  const bg = ctx.createRadialGradient(-3 * s, -8 * s + hop, 2, 0, -4 * s + hop, 16 * s);
  bg.addColorStop(0, c.body[0]);
  bg.addColorStop(1, c.body[1]);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.ellipse(0, -4 * s + hop, 12 * s, 13 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // рога
  ctx.fillStyle = c.horn;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 5 * s, -13 * s + hop);
    ctx.quadraticCurveTo(dir * 11 * s, -19 * s + hop, dir * (o.boss ? 15 : 9) * s, -22 * s + hop);
    ctx.quadraticCurveTo(dir * 8 * s, -15 * s + hop, dir * 2.5 * s, -13 * s + hop);
    ctx.closePath();
    ctx.fill();
  }

  // броня громилы
  if (o.type === "brute") {
    ctx.fillStyle = "#241a12";
    ctx.beginPath();
    ctx.ellipse(-9 * s, -8 * s + hop, 4.5 * s, 6 * s, -0.4, 0, Math.PI * 2);
    ctx.ellipse(9 * s, -8 * s + hop, 4.5 * s, 6 * s, 0.4, 0, Math.PI * 2);
    ctx.fill();
    // дубина
    ctx.save();
    ctx.translate(11 * s, -2 * s + hop);
    ctx.rotate(0.7 + Math.sin(t * 3) * 0.1);
    ctx.fillStyle = "#4a382a";
    ctx.fillRect(-1.5 * s, -16 * s, 3 * s, 16 * s);
    ctx.fillStyle = "#241a12";
    ctx.beginPath();
    ctx.arc(0, -16 * s, 5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // гончая: морда, уши, клыки
  if (o.type === "hound") {
    ctx.fillStyle = c.body[1];
    ctx.beginPath();
    ctx.moveTo(4 * s, -14 * s + hop);
    ctx.lineTo(10 * s, -21 * s + hop);
    ctx.lineTo(11 * s, -12 * s + hop);
    ctx.closePath();
    ctx.moveTo(-4 * s, -14 * s + hop);
    ctx.lineTo(-10 * s, -21 * s + hop);
    ctx.lineTo(-11 * s, -12 * s + hop);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#1a0508";
    ctx.beginPath();
    ctx.ellipse(6 * s, -2 * s + hop, 6 * s, 3.6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f7ecf2";
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(6 * s + dir * 3 * s, -1 * s + hop);
      ctx.lineTo(6 * s + dir * 3 * s + 1.2 * s, 2.4 * s + hop);
      ctx.lineTo(6 * s + dir * 3 * s + 2.4 * s, -1 * s + hop);
      ctx.closePath();
      ctx.fill();
    }
  }

  // культист: капюшон и посох с черепом
  if (o.type === "cultist") {
    ctx.fillStyle = c.body[1];
    ctx.beginPath();
    ctx.moveTo(-11 * s, -8 * s + hop);
    ctx.quadraticCurveTo(0, -26 * s + hop, 11 * s, -8 * s + hop);
    ctx.lineTo(7 * s, -10 * s + hop);
    ctx.quadraticCurveTo(0, -20 * s + hop, -7 * s, -10 * s + hop);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.translate(-13 * s, -2 * s + hop);
    ctx.rotate(-0.15 + Math.sin(t * 3.4) * 0.08);
    ctx.strokeStyle = "#3d2f24";
    ctx.lineWidth = 2.4 * s;
    ctx.beginPath();
    ctx.moveTo(0, 12 * s);
    ctx.lineTo(0, -14 * s);
    ctx.stroke();
    ctx.fillStyle = "#e8e0d0";
    ctx.beginPath();
    ctx.arc(0, -17 * s, 4 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c46bff";
    ctx.beginPath();
    ctx.arc(-1.4 * s, -17.5 * s, 1 * s, 0, Math.PI * 2);
    ctx.arc(1.4 * s, -17.5 * s, 1 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // демон-рыцарь: шлем с рогами и щит
  if (o.type === "knight") {
    ctx.fillStyle = "#2c3242";
    ctx.beginPath();
    ctx.moveTo(-9 * s, -10 * s + hop);
    ctx.quadraticCurveTo(0, -22 * s + hop, 9 * s, -10 * s + hop);
    ctx.lineTo(9 * s, -4 * s + hop);
    ctx.lineTo(-9 * s, -4 * s + hop);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff2e4d";
    ctx.fillRect(-6 * s, -9 * s + hop, 12 * s, 1.8 * s);
    // щит спереди
    ctx.save();
    ctx.translate(12 * s, -4 * s + hop);
    ctx.fillStyle = "#3d4356";
    ctx.beginPath();
    ctx.moveTo(-4 * s, -10 * s);
    ctx.lineTo(4 * s, -10 * s);
    ctx.lineTo(5 * s, 4 * s);
    ctx.lineTo(0, 9 * s);
    ctx.lineTo(-5 * s, 4 * s);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#ff2e4d";
    ctx.lineWidth = 1.4 * s;
    ctx.beginPath();
    ctx.moveTo(0, -7 * s);
    ctx.lineTo(0, 5 * s);
    ctx.moveTo(-3 * s, -3 * s);
    ctx.lineTo(3 * s, -3 * s);
    ctx.stroke();
    ctx.restore();
  }

  // пасть плевателя
  if (o.type === "spitter") {
    ctx.fillStyle = "#0d1f0c";
    ctx.beginPath();
    ctx.ellipse(0, 1 * s + hop, 7 * s, 4.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d8f0c8";
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 2.6 * s, -1.5 * s + hop);
      ctx.lineTo(i * 2.6 * s + 1.2 * s, -1.5 * s + hop);
      ctx.lineTo(i * 2.6 * s + 0.6 * s, 1 * s + hop);
      ctx.closePath();
      ctx.fill();
    }
  }

  // глаза
  const eyeY = -8 * s + hop;
  for (const dir of [-1, 1]) {
    const ex = dir * 4.5 * s;
    ctx.fillStyle = c.eye;
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, 2.6 * s, 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a0508";
    ctx.beginPath();
    ctx.ellipse(ex + dir * 0.8 * s, eyeY + 0.5 * s, 1.1 * s, 1.6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // свечение глаз
  ctx.globalCompositeOperation = "lighter";
  const eg = ctx.createRadialGradient(0, eyeY, 1, 0, eyeY, 10 * s);
  eg.addColorStop(0, hexA(c.eye, 0.35));
  eg.addColorStop(1, hexA(c.eye, 0));
  ctx.fillStyle = eg;
  ctx.beginPath();
  ctx.arc(0, eyeY, 10 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // корона владыки
  if (o.boss && o.type === "demon") {
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const bx = (-8 + i * 4) * s;
      ctx.moveTo(bx, -20 * s + hop);
      ctx.lineTo(bx + 1.6 * s, -26 * s + hop);
      ctx.lineTo(bx + 3.2 * s, -20 * s + hop);
    }
    ctx.closePath();
    ctx.fill();
  }

  // первосвященник костей: нимб из рёбер и посох
  if (o.boss && o.type === "bone") {
    ctx.strokeStyle = "rgba(201,160,255,0.85)";
    ctx.lineWidth = 1.6 * s;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + t * 0.8;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 13 * s, -18 * s + hop + Math.sin(a) * 5 * s, 2.6 * s, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = "#c9a0ff";
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    ctx.ellipse(0, -18 * s + hop, 16 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // королева стужи: ледяная корона и морозная дымка
  if (o.boss && o.type === "frost") {
    ctx.fillStyle = "#cfeaff";
    for (let i = 0; i < 5; i++) {
      const bx = (-8 + i * 4) * s;
      ctx.beginPath();
      ctx.moveTo(bx, -20 * s + hop);
      ctx.lineTo(bx + 1.6 * s, -28 * s + hop);
      ctx.lineTo(bx + 3.2 * s, -20 * s + hop);
      ctx.closePath();
      ctx.fill();
    }
    const fg = ctx.createRadialGradient(0, -4 * s, 4, 0, -4 * s, 24 * s);
    fg.addColorStop(0, "rgba(159,216,255,0)");
    fg.addColorStop(1, `rgba(159,216,255,${0.22 + Math.sin(t * 3) * 0.08})`);
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(0, -4 * s, 24 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // вспышка урона
  if (o.flash && o.flash > 0) {
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, o.flash * 6)})`;
    ctx.beginPath();
    ctx.ellipse(0, -4 * s + hop, 12 * s, 13 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  // полоска HP
  if (!o.boss && o.hp < o.maxHp) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(-11 * s, -24 * s, 22 * s, 3 * s);
    ctx.fillStyle = "#ff2e4d";
    ctx.fillRect(-11 * s, -24 * s, 22 * s * Math.max(0, o.hp / o.maxHp), 3 * s);
  }

  ctx.restore();
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 0xff},${n & 0xff},${a})`;
}

// ======================= портреты для сцен =======================

export interface PortraitPalette {
  hair: string;
  hairDark: string;
  eyes: string;
  skin: string;
  dress: string;
  accent: string;
  style: "long" | "twintail" | "bob" | "goddess" | "hero";
}

export function drawPortrait(ctx: CanvasRenderingContext2D, w: number, h: number, p: PortraitPalette) {
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h * 0.56;
  const R = Math.min(w, h) * 0.34;

  // фоновое свечение
  const bg = ctx.createRadialGradient(cx, cy - R * 0.4, R * 0.2, cx, cy - R * 0.4, R * 2.2);
  bg.addColorStop(0, hexA(p.accent, 0.35));
  bg.addColorStop(1, hexA(p.accent, 0));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // задние волосы
  ctx.fillStyle = p.hairDark;
  ctx.beginPath();
  if (p.style === "twintail") {
    ctx.ellipse(cx - R * 1.05, cy + R * 0.5, R * 0.42, R * 1.25, 0.12, 0, Math.PI * 2);
    ctx.ellipse(cx + R * 1.05, cy + R * 0.5, R * 0.42, R * 1.25, -0.12, 0, Math.PI * 2);
    ctx.ellipse(cx, cy - R * 0.1, R * 1.02, R * 1.08, 0, 0, Math.PI * 2);
  } else if (p.style === "hero") {
    ctx.ellipse(cx, cy - R * 0.15, R * 1.02, R * 1.0, 0, 0, Math.PI * 2);
  } else {
    ctx.moveTo(cx - R * 1.05, cy - R * 0.4);
    ctx.quadraticCurveTo(cx - R * 1.5, cy + R * 1.4, cx - R * 0.8, cy + R * 1.7);
    ctx.lineTo(cx + R * 0.8, cy + R * 1.7);
    ctx.quadraticCurveTo(cx + R * 1.5, cy + R * 1.4, cx + R * 1.05, cy - R * 0.4);
    ctx.quadraticCurveTo(cx, cy - R * 1.5, cx - R * 1.05, cy - R * 0.4);
    ctx.closePath();
  }
  ctx.fill();

  // шея и плечи
  ctx.fillStyle = p.skin;
  ctx.fillRect(cx - R * 0.16, cy + R * 0.72, R * 0.32, R * 0.4);
  ctx.fillStyle = p.dress;
  ctx.beginPath();
  ctx.moveTo(cx - R * 0.85, cy + R * 1.7);
  ctx.quadraticCurveTo(cx - R * 0.7, cy + R * 1.0, cx, cy + R * 0.95);
  ctx.quadraticCurveTo(cx + R * 0.7, cy + R * 1.0, cx + R * 0.85, cy + R * 1.7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p.accent;
  ctx.beginPath();
  ctx.arc(cx, cy + R * 1.12, R * 0.1, 0, Math.PI * 2);
  ctx.fill();

  // лицо
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.ellipse(cx, cy, R * 0.82, R * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();
  // подбородок острее
  ctx.beginPath();
  ctx.moveTo(cx - R * 0.62, cy + R * 0.28);
  ctx.quadraticCurveTo(cx, cy + R * 1.06, cx + R * 0.62, cy + R * 0.28);
  ctx.quadraticCurveTo(cx, cy + R * 0.86, cx - R * 0.62, cy + R * 0.28);
  ctx.fill();

  // глаза
  for (const dir of [-1, 1]) {
    const ex = cx + dir * R * 0.36;
    const ey = cy + R * 0.05;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(ex, ey, R * 0.21, R * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    const ig = ctx.createRadialGradient(ex, ey - R * 0.06, R * 0.02, ex, ey, R * 0.2);
    ig.addColorStop(0, "#ffffff");
    ig.addColorStop(0.25, p.eyes);
    ig.addColorStop(1, shade(p.eyes.startsWith("#") ? p.eyes : "#4dc9ff", -70));
    ctx.fillStyle = ig;
    ctx.beginPath();
    ctx.ellipse(ex, ey + R * 0.02, R * 0.15, R * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0c0c16";
    ctx.beginPath();
    ctx.ellipse(ex, ey + R * 0.05, R * 0.07, R * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(ex - R * 0.05, ey - R * 0.07, R * 0.05, 0, Math.PI * 2);
    ctx.arc(ex + R * 0.06, ey + R * 0.06, R * 0.025, 0, Math.PI * 2);
    ctx.fill();
    // ресницы
    ctx.strokeStyle = "#1c1024";
    ctx.lineWidth = R * 0.045;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(ex, ey - R * 0.02, R * 0.21, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }

  // нос и рот
  ctx.strokeStyle = "rgba(140,74,82,0.6)";
  ctx.lineWidth = R * 0.025;
  ctx.beginPath();
  ctx.moveTo(cx, cy + R * 0.3);
  ctx.lineTo(cx + R * 0.03, cy + R * 0.36);
  ctx.stroke();
  ctx.strokeStyle = "#c2556b";
  ctx.lineWidth = R * 0.04;
  ctx.beginPath();
  ctx.arc(cx, cy + R * 0.52, R * 0.12, 0.35, Math.PI - 0.35);
  ctx.stroke();

  // румянец
  ctx.fillStyle = "rgba(255,110,130,0.3)";
  ctx.beginPath();
  ctx.ellipse(cx - R * 0.52, cy + R * 0.34, R * 0.14, R * 0.06, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + R * 0.52, cy + R * 0.34, R * 0.14, R * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();

  // чёлка
  ctx.fillStyle = p.hair;
  ctx.beginPath();
  if (p.style === "hero") {
    ctx.moveTo(cx - R * 0.9, cy - R * 0.3);
    const spikes = 8;
    for (let i = 0; i <= spikes; i++) {
      const a = Math.PI + (i / spikes) * Math.PI;
      const rx = R * (1.0 + (i % 2) * 0.28);
      ctx.lineTo(cx + Math.cos(a) * rx * 0.95, cy - R * 0.25 + Math.sin(a) * rx * 0.9);
      const na = Math.PI + ((i + 0.5) / spikes) * Math.PI;
      ctx.lineTo(cx + Math.cos(na) * R * 0.9, cy - R * 0.25 + Math.sin(na) * R * 0.86);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.moveTo(cx - R * 0.9, cy - R * 0.2);
    ctx.quadraticCurveTo(cx - R * 1.0, cy - R * 1.1, cx, cy - R * 1.05);
    ctx.quadraticCurveTo(cx + R * 1.0, cy - R * 1.1, cx + R * 0.9, cy - R * 0.2);
    ctx.quadraticCurveTo(cx + R * 0.62, cy + R * 0.1, cx + R * 0.4, cy - R * 0.35);
    ctx.quadraticCurveTo(cx + R * 0.15, cy + R * 0.05, cx, cy - R * 0.4);
    ctx.quadraticCurveTo(cx - R * 0.2, cy + R * 0.1, cx - R * 0.42, cy - R * 0.3);
    ctx.quadraticCurveTo(cx - R * 0.65, cy + R * 0.12, cx - R * 0.9, cy - R * 0.2);
    ctx.closePath();
    ctx.fill();
  }

  // аксессуары
  if (p.style === "twintail") {
    ctx.fillStyle = p.accent;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + dir * R * 0.95, cy - R * 0.55, R * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (p.style === "goddess") {
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = R * 0.05;
    ctx.beginPath();
    ctx.ellipse(cx, cy - R * 1.25, R * 0.75, R * 0.2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.moveTo(cx, cy - R * 1.75);
    ctx.lineTo(cx + R * 0.08, cy - R * 1.55);
    ctx.lineTo(cx, cy - R * 1.42);
    ctx.lineTo(cx - R * 0.08, cy - R * 1.55);
    ctx.closePath();
    ctx.fill();
  } else if (p.style === "bob") {
    ctx.fillStyle = p.accent;
    star(ctx, cx + R * 0.62, cy - R * 0.78, R * 0.14, 5);
  } else if (p.style === "long") {
    ctx.fillStyle = p.accent;
    ctx.fillRect(cx - R * 0.9, cy - R * 0.95, R * 1.8, R * 0.12);
  }
}

export function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, n = 5) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

// ======================= богиня (полная фигура) =======================

export function drawGoddess(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 1.4) * 6 * s);

  // аура
  const g = ctx.createRadialGradient(0, -60 * s, 10, 0, -60 * s, 190 * s);
  g.addColorStop(0, "rgba(255,244,214,0.5)");
  g.addColorStop(0.5, "rgba(255,209,102,0.16)");
  g.addColorStop(1, "rgba(255,209,102,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, -60 * s, 190 * s, 0, Math.PI * 2);
  ctx.fill();

  // кольца
  ctx.strokeStyle = "rgba(255,209,102,0.5)";
  ctx.lineWidth = 2 * s;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(0, -60 * s, (90 + i * 26) * s, (24 + i * 7) * s, Math.sin(t * 0.5 + i) * 0.3, 0, Math.PI * 2);
    ctx.stroke();
  }

  // волосы сзади
  const hg = ctx.createLinearGradient(0, -140 * s, 0, 60 * s);
  hg.addColorStop(0, "#fff6d8");
  hg.addColorStop(1, "#ffd166");
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.moveTo(-30 * s, -120 * s);
  ctx.quadraticCurveTo(-70 * s, -20 * s, -52 * s + Math.sin(t * 2) * 6 * s, 70 * s);
  ctx.quadraticCurveTo(-20 * s, 90 * s, 0, 78 * s);
  ctx.quadraticCurveTo(20 * s, 90 * s, 52 * s + Math.sin(t * 2 + 2) * 6 * s, 70 * s);
  ctx.quadraticCurveTo(70 * s, -20 * s, 30 * s, -120 * s);
  ctx.quadraticCurveTo(0, -150 * s, -30 * s, -120 * s);
  ctx.fill();

  // платье
  const dg = ctx.createLinearGradient(0, -80 * s, 0, 80 * s);
  dg.addColorStop(0, "#ffffff");
  dg.addColorStop(1, "#ffe9b8");
  ctx.fillStyle = dg;
  ctx.beginPath();
  ctx.moveTo(-16 * s, -70 * s);
  ctx.quadraticCurveTo(-40 * s, 30 * s, -34 * s + Math.sin(t * 2.4) * 4 * s, 74 * s);
  ctx.quadraticCurveTo(0, 86 * s, 34 * s + Math.sin(t * 2.4 + 1) * 4 * s, 74 * s);
  ctx.quadraticCurveTo(40 * s, 30 * s, 16 * s, -70 * s);
  ctx.closePath();
  ctx.fill();
  // пояс
  ctx.fillStyle = "#ffd166";
  ctx.fillRect(-17 * s, -42 * s, 34 * s, 6 * s);

  // руки
  ctx.strokeStyle = "#ffe3d3";
  ctx.lineWidth = 7 * s;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-14 * s, -58 * s);
  ctx.quadraticCurveTo(-34 * s, -40 * s, -30 * s, -16 * s);
  ctx.moveTo(14 * s, -58 * s);
  ctx.quadraticCurveTo(34 * s, -40 * s, 30 * s, -16 * s);
  ctx.stroke();

  // голова
  ctx.fillStyle = "#ffe9dc";
  ctx.beginPath();
  ctx.ellipse(0, -102 * s, 17 * s, 19 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // глаза (закрытые, умиротворённые)
  ctx.strokeStyle = "#b98a4a";
  ctx.lineWidth = 1.6 * s;
  ctx.beginPath();
  ctx.arc(-6.5 * s, -102 * s, 3.4 * s, 0.3, Math.PI - 0.3);
  ctx.arc(6.5 * s, -102 * s, 3.4 * s, 0.3, Math.PI - 0.3);
  ctx.stroke();
  ctx.strokeStyle = "#c2556b";
  ctx.lineWidth = 1.8 * s;
  ctx.beginPath();
  ctx.arc(0, -94 * s, 4 * s, 0.4, Math.PI - 0.4);
  ctx.stroke();

  // чёлка
  ctx.fillStyle = "#fff6d8";
  ctx.beginPath();
  ctx.moveTo(-17 * s, -108 * s);
  ctx.quadraticCurveTo(-20 * s, -128 * s, 0, -126 * s);
  ctx.quadraticCurveTo(20 * s, -128 * s, 17 * s, -108 * s);
  ctx.quadraticCurveTo(10 * s, -114 * s, 4 * s, -104 * s);
  ctx.quadraticCurveTo(0, -112 * s, -4 * s, -104 * s);
  ctx.quadraticCurveTo(-10 * s, -114 * s, -17 * s, -108 * s);
  ctx.fill();

  // нимб
  ctx.strokeStyle = "rgba(255,209,102,0.9)";
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.ellipse(0, -138 * s, 24 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.stroke();

  // искры
  for (let i = 0; i < 8; i++) {
    const a = t * 0.8 + (i / 8) * Math.PI * 2;
    const rr = (110 + Math.sin(t * 2 + i) * 14) * s;
    ctx.fillStyle = `rgba(255,244,214,${0.5 + Math.sin(t * 3 + i) * 0.3})`;
    star(ctx, Math.cos(a) * rr, -60 * s + Math.sin(a) * rr * 0.5, 3 * s, 4);
  }

  ctx.restore();
}
