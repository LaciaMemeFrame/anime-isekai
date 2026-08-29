// Игровой контент: главы, героини, апгрейды, гача.

export type EnemyType = "imp" | "spitter" | "brute" | "wraith" | "boss";
export type MinionType = Exclude<EnemyType, "boss">;

export interface ChapterDef {
  name: string;
  sub: string;
  waves: { list: { type: MinionType; n: number }[] }[];
  boss: { name: string; title: string; hp: number; kind: "fire" | "ice" | "demon" };
  floor: [string, string];
  sky: [string, string];
  accent: string;
  ambient: "leaf" | "ash" | "ember";
}

export const CHAPTERS: ChapterDef[] = [
  {
    name: "ЛЕС ЗАБВЕНИЯ",
    sub: "Глава I · Тени пробуждаются",
    waves: [
      { list: [{ type: "imp", n: 5 }] },
      { list: [{ type: "imp", n: 6 }, { type: "wraith", n: 2 }] },
      { list: [{ type: "wraith", n: 5 }, { type: "imp", n: 4 }] },
      { list: [{ type: "imp", n: 8 }, { type: "spitter", n: 2 }] },
      { list: [{ type: "wraith", n: 6 }, { type: "spitter", n: 3 }, { type: "imp", n: 4 }] },
    ],
    boss: { name: "АЗАР", title: "Генерал Пламени", hp: 750, kind: "fire" },
    floor: ["#12230f", "#1c3a17"],
    sky: ["#07130a", "#123018"],
    accent: "#7dff6a",
    ambient: "leaf",
  },
  {
    name: "ПЕПЕЛЬНЫЙ ГОРОД",
    sub: "Глава II · Руины надежды",
    waves: [
      { list: [{ type: "imp", n: 6 }, { type: "spitter", n: 2 }] },
      { list: [{ type: "brute", n: 2 }, { type: "imp", n: 6 }] },
      { list: [{ type: "wraith", n: 6 }, { type: "spitter", n: 4 }] },
      { list: [{ type: "brute", n: 3 }, { type: "wraith", n: 5 }] },
      { list: [{ type: "imp", n: 8 }, { type: "brute", n: 3 }, { type: "spitter", n: 3 }] },
      { list: [{ type: "wraith", n: 8 }, { type: "brute", n: 3 }, { type: "spitter", n: 3 }] },
    ],
    boss: { name: "ВЕЛЬМИРА", title: "Ледяная Королева", hp: 1400, kind: "ice" },
    floor: ["#191521", "#262031"],
    sky: ["#0c0913", "#241a33"],
    accent: "#7cc7ff",
    ambient: "ash",
  },
  {
    name: "ЦИТАДЕЛЬ ВЛАДЫКИ",
    sub: "Глава III · Трон из костей",
    waves: [
      { list: [{ type: "brute", n: 3 }, { type: "imp", n: 6 }] },
      { list: [{ type: "wraith", n: 8 }, { type: "spitter", n: 4 }] },
      { list: [{ type: "brute", n: 4 }, { type: "wraith", n: 6 }] },
      { list: [{ type: "imp", n: 10 }, { type: "spitter", n: 5 }] },
      { list: [{ type: "brute", n: 5 }, { type: "wraith", n: 6 }, { type: "imp", n: 6 }] },
      { list: [{ type: "wraith", n: 10 }, { type: "brute", n: 4 }, { type: "spitter", n: 5 }] },
      { list: [{ type: "brute", n: 6 }, { type: "imp", n: 10 }, { type: "spitter", n: 5 }] },
    ],
    boss: { name: "ЗЕРРИС", title: "Владыка Демонов", hp: 2400, kind: "demon" },
    floor: ["#1d0f14", "#31141c"],
    sky: ["#12060b", "#3a0f18"],
    accent: "#ff5a3c",
    ambient: "ember",
  },
];

export interface HeroineDef {
  id: string;
  name: string;
  title: string;
  hair: string;
  hairDark: string;
  eyes: string;
  dress: string;
  accent: string;
  skin: string;
  style: "long" | "twintail" | "bob";
  weapon: "blade" | "bow" | "staff";
  glow: string;
  joinLine: string[];
  loveLine: string;
}

export const HEROINES: HeroineDef[] = [
  {
    id: "aria",
    name: "АРИЯ",
    title: "Алая Рыцарша",
    hair: "#ff4d6d",
    hairDark: "#c22747",
    eyes: "#ffc94d",
    dress: "#a4133c",
    accent: "#ffd166",
    skin: "#ffe3d3",
    style: "long",
    weapon: "blade",
    glow: "#ff2e4d",
    joinLine: [
      "Ты... правда победил Азара? Десять лет его огонь сжигал мой орден.",
      "Я — Ария, последняя из Алых Рыцарей. Мой меч и моё сердце — твои, Герой.",
      "Веди меня. Я буду твоим клинком — и твоей стеной.",
    ],
    loveLine: "Рядом с тобой мой меч наконец обрёл смысл.",
  },
  {
    id: "yuki",
    name: "ЮКИ",
    title: "Снежная Лучница",
    hair: "#bfe6ff",
    hairDark: "#7cc7ff",
    eyes: "#4dc9ff",
    dress: "#1d5c8f",
    accent: "#bfe6ff",
    skin: "#fff0e8",
    style: "twintail",
    weapon: "bow",
    glow: "#7cc7ff",
    joinLine: [
      "Холодно... Я думала, Вельмира заморозит моё сердце навечно.",
      "Ты согрел его одним ударом, Герой. Я Юки — стрелок Северного Клана.",
      "Моя стрела больше не промахнётся. Ведь мне есть кого защищать.",
    ],
    loveLine: "Ты — моё тепло посреди вечной зимы.",
  },
  {
    id: "lira",
    name: "ЛИРА",
    title: "Звёздная Чародейка",
    hair: "#ffd166",
    hairDark: "#e0a83c",
    eyes: "#7bffce",
    dress: "#5a2e8f",
    accent: "#35f0d0",
    skin: "#ffe9dc",
    style: "bob",
    weapon: "staff",
    glow: "#35f0d0",
    joinLine: [
      "Не может быть... пророчество сбылось! Звёзды вели тебя через смерть!",
      "Я Лира, хранительница небесной магии. Владыка держал меня в клетке из тьмы.",
      "Богиня Астрея услышала меня: теперь моя магия исцелит твой путь.",
    ],
    loveLine: "Каждая звезда этого неба теперь напоминает тебя.",
  },
];

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  icon: "blade" | "heart" | "wing" | "eye" | "fang" | "star" | "moon" | "fury" | "gem" | "thorn";
}

export const UPGRADES: UpgradeDef[] = [
  { id: "blade", name: "Клинок Воли", desc: "Атака +25%", icon: "blade" },
  { id: "heart", name: "Сердце Стража", desc: "Макс. HP +40, лечение 40", icon: "heart" },
  { id: "wing", name: "Крылья Ветра", desc: "Скорость +12%", icon: "wing" },
  { id: "eye", name: "Око Ястреба", desc: "Шанс крита +8%", icon: "eye" },
  { id: "fang", name: "Клык Вампира", desc: "Вампиризм +4%", icon: "fang" },
  { id: "moon", name: "Лунный Шаг", desc: "Перезарядка рывка −25%", icon: "moon" },
  { id: "star", name: "Звёздный Взмах", desc: "Перезарядка Волны −30%", icon: "star" },
  { id: "fury", name: "Ярость Титана", desc: "Ульта заряжается +40% быстрее", icon: "fury" },
  { id: "gem", name: "Руна Богатства", desc: "Кристаллы выпадают +50%", icon: "gem" },
  { id: "thorn", name: "Шипы Кары", desc: "Волна оставляет взрыв, урон +10%", icon: "thorn" },
];

export type Rarity = "rare" | "epic" | "legend";

export interface BlessingDef {
  id: string;
  name: string;
  rarity: Rarity;
  desc: string;
  stat: { key: "atkP" | "hp" | "spdP" | "critP" | "vamp" | "xpP" | "cryP" | "dashP" | "ultP"; val: number };
}

export const BLESSINGS: BlessingDef[] = [
  { id: "b1", name: "Осколок Рассвета", rarity: "rare", desc: "Атака +6%", stat: { key: "atkP", val: 6 } },
  { id: "b2", name: "Капля Жизни", rarity: "rare", desc: "Макс. HP +18", stat: { key: "hp", val: 18 } },
  { id: "b3", name: "Пёрышко Зефира", rarity: "rare", desc: "Скорость +4%", stat: { key: "spdP", val: 4 } },
  { id: "b4", name: "Точный Фокус", rarity: "rare", desc: "Крит +3%", stat: { key: "critP", val: 3 } },
  { id: "b5", name: "Малая Жажда", rarity: "rare", desc: "Вампиризм +1.5%", stat: { key: "vamp", val: 1.5 } },
  { id: "b6", name: "Умный Амулет", rarity: "rare", desc: "Опыт +10%", stat: { key: "xpP", val: 10 } },
  { id: "b7", name: "Кошелёк Торговца", rarity: "rare", desc: "Кристаллы +12%", stat: { key: "cryP", val: 12 } },
  { id: "e1", name: "Клинок Богини", rarity: "epic", desc: "Атака +15%", stat: { key: "atkP", val: 15 } },
  { id: "e2", name: "Слеза Астреи", rarity: "epic", desc: "Макс. HP +45", stat: { key: "hp", val: 45 } },
  { id: "e3", name: "Сапоги Гермеса", rarity: "epic", desc: "Скорость +9%", stat: { key: "spdP", val: 9 } },
  { id: "e4", name: "Печать Дракона", rarity: "epic", desc: "Крит +7%", stat: { key: "critP", val: 7 } },
  { id: "e5", name: "Чаша Феникса", rarity: "epic", desc: "Вампиризм +3.5%", stat: { key: "vamp", val: 3.5 } },
  { id: "e6", name: "Корона Мудреца", rarity: "epic", desc: "Опыт +22%", stat: { key: "xpP", val: 22 } },
  { id: "e7", name: "Прыжок Тени", rarity: "epic", desc: "Рывок −20% кд", stat: { key: "dashP", val: 20 } },
  { id: "l1", name: "НЕБЕСНЫЙ МЕЧ", rarity: "legend", desc: "Атака +30%, крит +8%", stat: { key: "atkP", val: 30 } },
  { id: "l2", name: "СЕРДЦЕ ВАЛЬКИРИИ", rarity: "legend", desc: "Макс. HP +90", stat: { key: "hp", val: 90 } },
  { id: "l3", name: "КРЫЛЬЯ АРХАНГЕЛА", rarity: "legend", desc: "Ульта +60% быстрее", stat: { key: "ultP", val: 60 } },
];

export const RARITY_META: Record<Rarity, { name: string; color: string; glow: string; w: number }> = {
  rare: { name: "РЕДКАЯ", color: "#7cc7ff", glow: "rgba(124,199,255,0.5)", w: 62 },
  epic: { name: "ЭПИЧЕСКАЯ", color: "#c46bff", glow: "rgba(196,107,255,0.55)", w: 30 },
  legend: { name: "ЛЕГЕНДАРНАЯ", color: "#ffd166", glow: "rgba(255,209,102,0.6)", w: 8 },
};

export const GACHA_SINGLE = 25;
export const GACHA_TEN = 225;

export interface GoddessGift {
  id: string;
  name: string;
  desc: string;
  icon: "blade" | "heart" | "star";
}

export const GODDESS_GIFTS: GoddessGift[] = [
  { id: "blade", name: "Клинок Воли", desc: "+25% к атаке с самого начала", icon: "blade" },
  { id: "heart", name: "Сердце Стража", desc: "+60 к макс. здоровью", icon: "heart" },
  { id: "star", name: "Звезда Удачи", desc: "+60 кристаллов и +15% к добыче", icon: "star" },
];

export const ENEMY_BASE: Record<
  Exclude<EnemyType, "boss">,
  { hp: number; speed: number; dmg: number; r: number; xp: number; cry: [number, number] }
> = {
  imp: { hp: 26, speed: 96, dmg: 8, r: 15, xp: 6, cry: [0, 2] },
  spitter: { hp: 34, speed: 70, dmg: 7, r: 16, xp: 9, cry: [1, 2] },
  brute: { hp: 120, speed: 46, dmg: 16, r: 24, xp: 18, cry: [2, 4] },
  wraith: { hp: 20, speed: 148, dmg: 6, r: 13, xp: 7, cry: [0, 2] },
};
