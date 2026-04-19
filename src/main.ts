import "./style.css";

const canvas = document.querySelector<HTMLCanvasElement>("#game");

if (!canvas) {
  throw new Error("Canvas element not found");
}

const ctx = canvas.getContext("2d");

if (!ctx) {
  throw new Error("2D context not available");
}

const IS_MOBILE_VIEWPORT = window.matchMedia("(pointer: coarse)").matches;
const WORLD_WIDTH = IS_MOBILE_VIEWPORT ? 400 : 480;
const WORLD_HEIGHT = IS_MOBILE_VIEWPORT ? 225 : 270;
const TAU = Math.PI * 2;
const BOSS1_SHIELD_RADIUS_SCALE = 0.7;
const BOSS1_SHIELD_SPIN_SPEED = 1.7;
const BOSS1_SHIELD_ARC_PORTION = 0.3;
const BOSS1_SHIELD_LINE_WIDTH = 3;
const SKULL_BOSS_PROJECTILE_WINDUP = 0.05;
const MAX_SIMULTANEOUS_ENEMIES = 15;
const NON_BOSS_ENEMY_DAMAGE_TO_PLAYER_SCALE = 0.5;
const LIVE_RELOAD_STATE_KEY = "pixel-bot-brawler:dev-state";
const AudioContextClass = window.AudioContext || (window as typeof window & {
  webkitAudioContext?: typeof AudioContext;
}).webkitAudioContext;

canvas.width = WORLD_WIDTH;
canvas.height = WORLD_HEIGHT;

type Fighter = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: number;
  radius: number;
  speed: number;
  hp: number;
  maxHp: number;
  color: string;
  accent: string;
  isPlayer: boolean;
  reload: number;
  respawn: number;
  flash: number;
  wander: number;
  targetX: number;
  targetY: number;
  score: number;
  archetype: "ranged" | "melee";
  attackCooldown: number;
  spawnX: number;
  spawnY: number;
  critChance: number;
  damageMultiplier: number;
  team: "player" | "enemy" | "ally";
  helperType: "none" | "red" | "green";
  headMark: "none" | "skull";
  shieldCount: number;
  shieldTimer: number;
  rageCharge: number;
  rageTimer: number;
  rageCooldown: number;
  isBoss: boolean;
  bossKind: BossKind;
};

type Bullet = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: number;
  life: number;
  color: string;
  damage: number;
  size: number;
  weapon: WeaponType;
  isCrit: boolean;
  healAmount: number;
};

type Wall = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type WeaponType = "pistol" | "shotgun" | "smg" | "rifle" | "bazooka";

type LightningStrike = {
  x: number;
  timer: number;
  duration: number;
  warning: number;
  active: boolean;
  hitApplied: boolean;
};

type Meteor = {
  x: number;
  y: number;
  timer: number;
  warning: number;
  fallDuration: number;
  active: boolean;
  hitApplied: boolean;
  radius: number;
};

type BurningFloor = {
  x: number;
  y: number;
  radius: number;
  timer: number;
  maxTimer: number;
  damageTick: number;
};

type Medkit = {
  x: number;
  y: number;
};

type StarPickup = {
  x: number;
  y: number;
  color: "blue" | "red";
};

type ShieldPickup = {
  x: number;
  y: number;
};

type Explosion = {
  x: number;
  y: number;
  radius: number;
  timer: number;
  maxTimer: number;
};

type BossKind = "none" | "iron" | "skull";
type BossAttackType = "targeted" | "forward" | "left" | "right";
type RuntimeSnapshot = {
  fighters: Fighter[];
  bullets: Bullet[];
  lightningStrikes: LightningStrike[];
  meteors: Meteor[];
  burningFloors: BurningFloor[];
  medkits: Medkit[];
  stars: StarPickup[];
  shieldPickups: ShieldPickup[];
  explosions: Explosion[];
  nextId: number;
  elapsed: number;
  lightningCooldown: number;
  meteorCooldown: number;
  medkitCooldown: number;
  starCooldown: number;
  shieldPickupCooldown: number;
  selectedWeapon: WeaponType;
  highestUnlockedWeapon: WeaponType;
  isPaused: boolean;
  showRulesMenu: boolean;
  rulesScroll: number;
  mobileFullscreenAttempted: boolean;
  pendingRunReset: boolean;
  devInfiniteHealth: boolean;
  survivalWithoutDeath: number;
  bossFightStarted: boolean;
  bossFightWon: boolean;
  bossIntroTimer: number;
  bossAttackType: BossAttackType | null;
  bossAttackWindup: number;
  bossAttackActive: number;
  bossAttackRecover: number;
  bossAttackIndex: number;
  bossAttackAngle: number;
  bossAttackHitApplied: boolean;
  bossSpinDamageTick: number;
  bossSwordContactTick: number;
  skullBossActionTimer: number;
  skullBossActionIndex: number;
  skullBossBurstShotsLeft: number;
  skullBossBurstWindup: number;
  bossesDefeated: number;
};

const input = {
  up: false,
  down: false,
  left: false,
  right: false,
  moveX: 0,
  moveY: 0,
  shoot: false,
  mouseX: WORLD_WIDTH / 2,
  mouseY: WORLD_HEIGHT / 2
};

const touchControls = {
  enabled: IS_MOBILE_VIEWPORT,
  moveId: -1,
  aimId: -1,
  moveBaseX: 70,
  moveBaseY: WORLD_HEIGHT - 72,
  moveStickX: 70,
  moveStickY: WORLD_HEIGHT - 72,
  aimBaseX: WORLD_WIDTH - 70,
  aimBaseY: WORLD_HEIGHT - 72,
  aimStickX: WORLD_WIDTH - 70,
  aimStickY: WORLD_HEIGHT - 72
};

const walls: Wall[] = [];

const fighters: Fighter[] = [];
const bullets: Bullet[] = [];
let nextId = 1;
let elapsed = 0;
let audioContext: AudioContext | null = null;
let audioEnabled = false;
let lightningCooldown = 2.4;
const lightningStrikes: LightningStrike[] = [];
let meteorCooldown = 5.2;
const meteors: Meteor[] = [];
const burningFloors: BurningFloor[] = [];
let medkitCooldown = 4.5;
const medkits: Medkit[] = [];
let starCooldown = 8;
const stars: StarPickup[] = [];
let shieldPickupCooldown = 18;
const shieldPickups: ShieldPickup[] = [];
const explosions: Explosion[] = [];
const weaponOrder: WeaponType[] = ["pistol", "smg", "shotgun", "rifle", "bazooka"];
let selectedWeapon: WeaponType = "pistol";
let highestUnlockedWeapon: WeaponType = "pistol";
let isPaused = false;
let showRulesMenu = false;
let rulesScroll = 0;
let rulesTouchY: number | null = null;
let mobileFullscreenAttempted = false;
let pendingRunReset = false;
let devInfiniteHealth = false;
let survivalWithoutDeath = 0;
let bossFightStarted = false;
let bossFightWon = false;
let bossIntroTimer = 0;
let bossAttackType: BossAttackType | null = null;
let bossAttackWindup = 0;
let bossAttackActive = 0;
let bossAttackRecover = 0;
let bossAttackIndex = 0;
let bossAttackAngle = 0;
let bossAttackHitApplied = false;
let bossSpinDamageTick = 0;
let bossSwordContactTick = 0;
let skullBossActionTimer = 0;
let skullBossActionIndex = 0;
let skullBossBurstShotsLeft = 0;
let skullBossBurstWindup = 0;
let bossesDefeated = 0;
let liveReloadSaveTimer = 0;

const bossAttackPattern: BossAttackType[] = ["targeted", "targeted", "forward", "left", "right", "left", "left"];

const palette = [
  ["#57d7ff", "#dffaff"],
  ["#ff8a5b", "#ffe0c4"],
  ["#ff5f8c", "#ffd6e4"],
  ["#96e072", "#edffd9"]
];

const devStageSnapshots = [
  { survival: 0, bossesDefeated: 0, boss: "none" as BossKind },
  { survival: 30, bossesDefeated: 0, boss: "none" as BossKind },
  { survival: 59, bossesDefeated: 0, boss: "none" as BossKind },
  { survival: 60, bossesDefeated: 0, boss: "iron" as BossKind },
  { survival: 75, bossesDefeated: 1, boss: "none" as BossKind },
  { survival: 120, bossesDefeated: 1, boss: "skull" as BossKind },
  { survival: 130, bossesDefeated: 2, boss: "none" as BossKind }
];

const rulesLines = [
  "SURVIVE, SCORE, UPGRADE.",
  "WASD TO MOVE, MOUSE TO AIM, CLICK TO SHOOT.",
  "1-5 SWITCH UNLOCKED WEAPONS.",
  "5/10/15/20 KILLS UNLOCK STRONGER GUNS.",
  "MEDKITS HEAL.",
  "BLUE STARS GIVE RANDOM BUFFS.",
  "RED STARS SUMMON HELPERS. MAX 2 HELPERS.",
  "RED HELPERS SHOOT ENEMIES.",
  "GREEN HELPERS FIRE HEALING SHOTS AT YOU.",
  "LIGHTNING WARNS FIRST, THEN STRIKES.",
  "METEORS FALL INTO A 2X2 BLAST ZONE. KEEP MOVING.",
  "AFTER 60s WITHOUT DYING, METEORS LEAVE BURNING GROUND.",
  "AT 60s A SHIELDED BOSS TAKES OVER THE ARENA.",
  "AT 120s THE SKULL LORD ARRIVES WITH MINIONS AND HAZARDS.",
  "PRESS E TO USE A STORED SHIELD CHARGE.",
  "P OR ESC PAUSES AND RESUMES.",
  "CLICK BACK TO RETURN TO THE PAUSE MENU.",
  "USE MOUSE WHEEL TO SCROLL THESE RULES."
];

function createFighter(x: number, y: number, isPlayer: boolean, colorIndex: number): Fighter {
  const [color, accent] = palette[colorIndex % palette.length];
  return {
    id: nextId++,
    x,
    y,
    vx: 0,
    vy: 0,
    dir: 0,
    radius: 7,
    speed: isPlayer ? 66 : 50,
    hp: 100,
    maxHp: 100,
    color,
    accent,
    isPlayer,
    reload: 0,
    respawn: 0,
    flash: 0,
    wander: 0,
    targetX: x,
    targetY: y,
    score: 0,
    archetype: isPlayer ? "ranged" : Math.random() < 0.8 ? "melee" : "ranged",
    attackCooldown: 0,
    spawnX: x,
    spawnY: y,
    critChance: isPlayer ? 0.02 : 0,
    damageMultiplier: 1,
    team: isPlayer ? "player" : "enemy",
    helperType: "none",
    headMark: "none",
    shieldCount: 0,
    shieldTimer: 0,
    rageCharge: isPlayer ? 100 : 0,
    rageTimer: 0,
    rageCooldown: 0,
    isBoss: false,
    bossKind: "none"
  };
}

function getEnemyPressureLevel() {
  return Math.min(6, Math.floor(survivalWithoutDeath / 30) + bossesDefeated * 2);
}

function getWaveEnemyCount() {
  if (bossesDefeated >= 1) {
    return 6;
  }
  if (survivalWithoutDeath >= 90) {
    return 5;
  }
  return 4;
}

function getPhaseLabel() {
  const boss = getBoss();
  if (bossFightStarted && boss) {
    return boss.bossKind === "skull" ? "SKULL PHASE" : "IRON PHASE";
  }
  if (bossesDefeated >= 2) {
    return "FINAL SURGE";
  }
  if (bossesDefeated >= 1) {
    return survivalWithoutDeath >= 120 ? "SKULL OMEN" : "POST-BOSS SURGE";
  }
  if (survivalWithoutDeath >= 60) {
    return "FIREFALL";
  }
  if (survivalWithoutDeath >= 30) {
    return "STORM RISE";
  }
  return "SURVIVAL";
}

function getProgressBarState() {
  const boss = getBoss();
  if (bossFightStarted && boss) {
    return {
      progress: 1,
      label: boss.bossKind === "skull" ? "SKULL ACTIVE" : "IRON ACTIVE",
      fill: boss.bossKind === "skull" ? "#ffd16f" : "#ff8d6b"
    };
  }

  if (bossesDefeated >= 2) {
    return {
      progress: 1,
      label: "BOSS CLEARED",
      fill: "#9be38d"
    };
  }

  if (bossesDefeated >= 1) {
    return {
      progress: Math.min(1, survivalWithoutDeath / 120),
      label: "SKULL INCOMING",
      fill: "#ffcf6b"
    };
  }

  return {
    progress: Math.min(1, survivalWithoutDeath / 60),
    label: "BOSS INCOMING",
    fill: "#7ee0ff"
  };
}

function applyEnemyScaling(enemy: Fighter, waveIndex = 0) {
  const pressure = getEnemyPressureLevel();
  const elite = pressure >= 3 && (waveIndex === getWaveEnemyCount() - 1 || Math.random() < 0.16 + bossesDefeated * 0.06);

  enemy.archetype = pressure >= 2 && Math.random() < 0.4 ? "ranged" : Math.random() < 0.78 ? "melee" : "ranged";
  enemy.radius = elite ? 9 : 7;
  enemy.maxHp = (elite ? 150 : 100) + pressure * (elite ? 22 : 14);
  enemy.hp = enemy.maxHp;
  enemy.speed = (elite ? 56 : 50) + pressure * (elite ? 2.4 : 1.6);
  enemy.damageMultiplier = (elite ? 1.28 : 1) + pressure * 0.08;

  if (elite) {
    enemy.color = "#4f5967";
    enemy.accent = "#ffd39f";
  }
}

function getLightningSettings() {
  const pressure = getEnemyPressureLevel();
  return {
    minCooldown: Math.max(0.95, 1.8 - pressure * 0.12),
    maxCooldown: Math.max(1.45, 4.2 - pressure * 0.26),
    damage: 30 + pressure * 2
  };
}

function getMeteorSettings() {
  const pressure = getEnemyPressureLevel();
  return {
    minCooldown: Math.max(2.1, 4.2 - pressure * 0.22),
    maxCooldown: Math.max(3.2, 7.3 - pressure * 0.28),
    damage: 36 + pressure * 3
  };
}

function spawnRoster() {
  fighters.length = 0;
  bullets.length = 0;
  lightningStrikes.length = 0;
  meteors.length = 0;
  burningFloors.length = 0;
  medkits.length = 0;
  stars.length = 0;
  shieldPickups.length = 0;
  explosions.length = 0;
  lightningCooldown = 2.4;
  meteorCooldown = 5.2;
  medkitCooldown = 4.5;
  starCooldown = 8;
  shieldPickupCooldown = 18;
  selectedWeapon = "pistol";
  highestUnlockedWeapon = "pistol";
  pendingRunReset = false;
  survivalWithoutDeath = 0;
  bossFightStarted = false;
  bossFightWon = false;
  bossIntroTimer = 0;
  bossAttackType = null;
  bossAttackWindup = 0;
  bossAttackActive = 0;
  bossAttackRecover = 0;
  bossAttackIndex = 0;
  bossAttackAngle = 0;
  bossAttackHitApplied = false;
  bossSpinDamageTick = 0;
  bossSwordContactTick = 0;
  skullBossActionTimer = 0;
  skullBossActionIndex = 0;
  skullBossBurstShotsLeft = 0;
  skullBossBurstWindup = 0;
  bossesDefeated = 0;
  const playerSpawn = getRandomSpawnPoint(7);
  fighters.push(createFighter(playerSpawn.x, playerSpawn.y, true, 0));

  spawnEnemyWave();
}

function spawnEnemyWave() {
  const enemyPaletteOrder = [1, 2, 3, 1, 2, 3];
  const waveCount = getWaveEnemyCount();
  const activeEnemies = fighters.filter((fighter) => fighter.team === "enemy" && fighter.respawn <= 0).length;
  const availableSlots = Math.max(0, MAX_SIMULTANEOUS_ENEMIES - activeEnemies);
  const spawnCount = Math.min(waveCount, availableSlots);
  const reservedSpawns = fighters
    .filter((fighter) => fighter.respawn <= 0)
    .map((fighter) => ({ x: fighter.x, y: fighter.y, radius: fighter.radius }));

  for (let index = 0; index < spawnCount; index += 1) {
    const colorIndex = enemyPaletteOrder[index % enemyPaletteOrder.length];
    const enemy = createFighter(0, 0, false, colorIndex);
    applyEnemyScaling(enemy, index);
    const botSpawn = getRandomSpawnPoint(enemy.radius, undefined, reservedSpawns);
    enemy.x = botSpawn.x;
    enemy.y = botSpawn.y;
    enemy.spawnX = botSpawn.x;
    enemy.spawnY = botSpawn.y;
    reservedSpawns.push({ x: botSpawn.x, y: botSpawn.y, radius: enemy.radius });
    fighters.push(enemy);
  }
}

function getBoss() {
  return fighters.find((fighter) => fighter.isBoss && fighter.respawn <= 0) ?? null;
}

function getBossArenaRadius() {
  return Math.min(WORLD_WIDTH, WORLD_HEIGHT) * 0.42;
}

function clearAmbientHazards() {
  bullets.length = 0;
  lightningStrikes.length = 0;
  meteors.length = 0;
  burningFloors.length = 0;
  medkits.length = 0;
  stars.length = 0;
  shieldPickups.length = 0;
  explosions.length = 0;
}

function playerHasInfiniteHealth(target: Fighter) {
  return devInfiniteHealth && target.team === "player";
}

function ensureEnemyWavePresent() {
  const activeEnemies = fighters.some((fighter) => fighter.team === "enemy" && fighter.respawn <= 0);
  if (!activeEnemies && !bossFightStarted) {
    spawnEnemyWave();
  }
}

function applyDevStage(stageIndex: number) {
  const snapshot = devStageSnapshots[clamp(stageIndex, 0, devStageSnapshots.length - 1)];
  const player = fighters.find((fighter) => fighter.team === "player") ?? null;

  clearAmbientHazards();
  despawnEnemies();
  survivalWithoutDeath = snapshot.survival;
  bossesDefeated = snapshot.bossesDefeated;
  bossFightStarted = false;
  bossFightWon = false;
  bossIntroTimer = 0;
  bossAttackType = null;
  bossAttackWindup = 0;
  bossAttackActive = 0;
  bossAttackRecover = 0;
  bossAttackIndex = 0;
  bossAttackAngle = 0;
  bossAttackHitApplied = false;
  bossSpinDamageTick = 0;
  bossSwordContactTick = 0;
  skullBossActionTimer = 0;
  skullBossActionIndex = 0;
  pendingRunReset = false;

  for (let i = fighters.length - 1; i >= 0; i -= 1) {
    if (fighters[i].team === "ally") {
      fighters.splice(i, 1);
    }
  }

  if (player) {
    player.respawn = 0;
    player.hp = player.maxHp;
    player.shieldTimer = 0;
    player.rageTimer = 0;
    player.rageCooldown = 0;
    player.rageCharge = 100;
    player.x = WORLD_WIDTH / 2;
    player.y = WORLD_HEIGHT / 2 + 58;
    player.vx = 0;
    player.vy = 0;
  }

  if (snapshot.boss === "iron" || snapshot.boss === "skull") {
    startBossFight(snapshot.boss);
  } else {
    ensureEnemyWavePresent();
  }
}

function getCurrentDevStageIndex() {
  const boss = getBoss();
  if (bossFightStarted && boss?.bossKind === "skull") {
    return 5;
  }
  if (bossFightStarted && boss?.bossKind === "iron") {
    return 3;
  }
  if (bossesDefeated >= 2) {
    return 6;
  }
  if (bossesDefeated >= 1) {
    return 4;
  }
  if (survivalWithoutDeath >= 59) {
    return 2;
  }
  if (survivalWithoutDeath >= 30) {
    return 1;
  }
  return 0;
}

function stepDevStage(direction: -1 | 1) {
  const nextStage = clamp(getCurrentDevStageIndex() + direction, 0, devStageSnapshots.length - 1);
  applyDevStage(nextStage);
}

function configureIronBoss(boss: Fighter) {
  boss.isBoss = true;
  boss.bossKind = "iron";
  boss.team = "enemy";
  boss.archetype = "melee";
  boss.radius = 18;
  boss.speed = 0;
  boss.hp = 3750;
  boss.maxHp = 3750;
  boss.color = "#6d7686";
  boss.accent = "#cfd7df";
  boss.dir = -Math.PI / 2;
  boss.flash = 0;
  boss.attackCooldown = 0;
}

function configureSkullBoss(boss: Fighter) {
  boss.isBoss = true;
  boss.bossKind = "skull";
  boss.team = "enemy";
  boss.archetype = "ranged";
  boss.radius = 20;
  boss.speed = 0;
  boss.hp = 2200;
  boss.maxHp = 2200;
  boss.color = "#5b5d68";
  boss.accent = "#ece6d8";
  boss.headMark = "skull";
  boss.dir = -Math.PI / 2;
  boss.flash = 0;
  boss.attackCooldown = 0;
}

function startBossFight(kind: BossKind) {
  if (bossFightStarted || bossFightWon) {
    return;
  }

  despawnEnemies();
  clearAmbientHazards();

  const player = fighters.find((fighter) => fighter.team === "player" && fighter.respawn <= 0) ?? null;
  if (player) {
    player.x = WORLD_WIDTH / 2;
    player.y = WORLD_HEIGHT / 2 + 58;
    player.vx = 0;
    player.vy = 0;
  }

  const boss = createFighter(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, false, 1);
  if (kind === "skull") {
    configureSkullBoss(boss);
  } else {
    configureIronBoss(boss);
  }
  fighters.push(boss);

  bossFightStarted = true;
  bossIntroTimer = kind === "iron" ? 5.5 : 0;
  bossAttackType = null;
  bossAttackWindup = 0;
  bossAttackActive = 0;
  bossAttackRecover = 0;
  bossAttackIndex = 0;
  bossAttackAngle = boss.dir;
  bossAttackHitApplied = false;
  bossSpinDamageTick = kind === "iron" ? 0.28 : 0;
  bossSwordContactTick = kind === "iron" ? 0.18 : 0;
  skullBossActionTimer = kind === "skull" ? 1.25 : 0;
  skullBossActionIndex = 0;
  skullBossBurstShotsLeft = 0;
  skullBossBurstWindup = 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function intersectsWall(x: number, y: number, radius: number) {
  return walls.some((wall) => {
    const nearestX = clamp(x, wall.x, wall.x + wall.w);
    const nearestY = clamp(y, wall.y, wall.y + wall.h);
    const dx = x - nearestX;
    const dy = y - nearestY;
    return dx * dx + dy * dy < radius * radius;
  });
}

function canMoveTo(x: number, y: number, radius: number) {
  if (bossFightStarted) {
    const arenaRadius = getBossArenaRadius();
    const dx = x - WORLD_WIDTH / 2;
    const dy = y - WORLD_HEIGHT / 2;
    if (Math.hypot(dx, dy) > arenaRadius - radius) {
      return false;
    }
  }

  return (
    x - radius > 8 &&
    x + radius < WORLD_WIDTH - 8 &&
    y - radius > 8 &&
    y + radius < WORLD_HEIGHT - 8 &&
    !intersectsWall(x, y, radius)
  );
}

function isSpawnPointFree(x: number, y: number, radius: number, ignoreId?: number) {
  return !fighters.some((fighter) => {
    if (fighter.id === ignoreId || fighter.respawn > 0) {
      return false;
    }
    return Math.hypot(fighter.x - x, fighter.y - y) < fighter.radius + radius + 10;
  });
}

function isReservedSpawnFree(
  x: number,
  y: number,
  radius: number,
  reservedPoints: Array<{ x: number; y: number; radius: number }>
) {
  return !reservedPoints.some((point) => Math.hypot(point.x - x, point.y - y) < point.radius + radius + 10);
}

function getRandomSpawnPoint(
  radius: number,
  ignoreId?: number,
  reservedPoints: Array<{ x: number; y: number; radius: number }> = []
) {
  const margin = 18 + radius;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const x = margin + Math.random() * (WORLD_WIDTH - margin * 2);
    const y = margin + Math.random() * (WORLD_HEIGHT - margin * 2);

    if (
      canMoveTo(x, y, radius) &&
      isSpawnPointFree(x, y, radius, ignoreId) &&
      isReservedSpawnFree(x, y, radius, reservedPoints)
    ) {
      return { x, y };
    }
  }

  for (let y = margin; y <= WORLD_HEIGHT - margin; y += 20) {
    for (let x = margin; x <= WORLD_WIDTH - margin; x += 20) {
      if (
        canMoveTo(x, y, radius) &&
        isSpawnPointFree(x, y, radius, ignoreId) &&
        isReservedSpawnFree(x, y, radius, reservedPoints)
      ) {
        return { x, y };
      }
    }
  }

  return {
    x: WORLD_WIDTH / 2,
    y: WORLD_HEIGHT / 2
  };
}

function respawn(fighter: Fighter) {
  if (!fighter.isPlayer) {
    applyEnemyScaling(fighter);
  }
  const hasReservedSpawn = fighter.team === "enemy" && (fighter.spawnX !== 0 || fighter.spawnY !== 0);
  const point = hasReservedSpawn
    ? { x: fighter.spawnX, y: fighter.spawnY }
    : getRandomSpawnPoint(fighter.radius, fighter.id);
  fighter.spawnX = point.x;
  fighter.spawnY = point.y;
  fighter.x = point.x;
  fighter.y = point.y;
  fighter.vx = 0;
  fighter.vy = 0;
  if (fighter.team === "player") {
    fighter.maxHp = 100;
    fighter.critChance = 0.02;
    fighter.damageMultiplier = 1;
    fighter.score = 0;
    fighter.shieldCount = 0;
    fighter.shieldTimer = 0;
    fighter.rageCharge = 100;
    fighter.rageTimer = 0;
    fighter.rageCooldown = 0;
    selectedWeapon = "pistol";
    highestUnlockedWeapon = "pistol";
    spawnEnemyWave();
  }
  fighter.hp = fighter.maxHp;
  fighter.respawn = 0;
  fighter.attackCooldown = 0;
}

function lineBlocked(aX: number, aY: number, bX: number, bY: number) {
  const steps = 14;
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = aX + (bX - aX) * t;
    const y = aY + (bY - aY) * t;
    if (intersectsWall(x, y, 2)) {
      return true;
    }
  }
  return false;
}

function ensureAudio() {
  if (!AudioContextClass || audioEnabled) {
    return;
  }

  audioContext = new AudioContextClass();
  audioEnabled = true;
}

function playTone(
  type: OscillatorType,
  frequency: number,
  duration: number,
  volume: number,
  slideTo?: number
) {
  if (!audioContext || audioContext.state !== "running") {
    return;
  }

  const start = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (slideTo !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
  }

  gainNode.gain.setValueAtTime(0.0001, start);
  gainNode.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

function playShootSound(isPlayer: boolean) {
  playTone("square", isPlayer ? 700 : 430, isPlayer ? 0.08 : 0.06, isPlayer ? 0.035 : 0.018, isPlayer ? 420 : 280);
}

function playHitSound(isMelee: boolean) {
  playTone(isMelee ? "triangle" : "sawtooth", isMelee ? 180 : 240, 0.07, isMelee ? 0.035 : 0.025, isMelee ? 120 : 170);
}

function playDefeatSound() {
  playTone("triangle", 220, 0.18, 0.04, 90);
}

function playLightningSound() {
  playTone("sawtooth", 820, 0.12, 0.05, 220);
  playTone("triangle", 180, 0.18, 0.03, 90);
}

function playMeteorSound() {
  playTone("sawtooth", 210, 0.16, 0.05, 120);
  playTone("triangle", 110, 0.22, 0.04, 70);
}

function playPickupSound() {
  playTone("triangle", 480, 0.08, 0.03, 740);
}

function playStarSound() {
  playTone("sine", 620, 0.1, 0.03, 880);
  playTone("triangle", 880, 0.12, 0.025, 1180);
}

function playHelperSound(color: "red" | "green") {
  if (color === "red") {
    playTone("square", 520, 0.11, 0.03, 280);
  } else {
    playTone("sine", 540, 0.12, 0.03, 760);
  }
}

function playShieldSound() {
  playTone("triangle", 320, 0.14, 0.035, 640);
}

function getPlayerWeapon(score: number): WeaponType {
  if (score >= 20) return "bazooka";
  if (score >= 15) return "rifle";
  if (score >= 10) return "shotgun";
  if (score >= 5) return "smg";
  return "pistol";
}

function createBullet(
  fighter: Fighter,
  direction: number,
  speed: number,
  life: number,
  damage: number,
  size: number,
  weapon: WeaponType
) {
  const isCrit = fighter.isPlayer && Math.random() < fighter.critChance;
  bullets.push({
    x: fighter.x + Math.cos(direction) * 8,
    y: fighter.y + Math.sin(direction) * 8,
    vx: Math.cos(direction) * speed,
    vy: Math.sin(direction) * speed,
    ownerId: fighter.id,
    life,
    color: fighter.accent,
    damage: (isCrit ? damage * 2 : damage) * fighter.damageMultiplier,
    size,
    weapon,
    isCrit,
    healAmount: 0
  });
}

function getUnlockedWeapons(score: number) {
  return weaponOrder.filter((weapon) => {
    if (weapon === "pistol") return true;
    if (weapon === "smg") return score >= 5;
    if (weapon === "shotgun") return score >= 10;
    if (weapon === "rifle") return score >= 15;
    return score >= 20;
  });
}

function getActivePlayerWeapon(player: Fighter) {
  const unlocked = getUnlockedWeapons(player.score);
  const newestUnlocked = unlocked[unlocked.length - 1];

  if (weaponOrder.indexOf(newestUnlocked) > weaponOrder.indexOf(highestUnlockedWeapon)) {
    selectedWeapon = newestUnlocked;
    highestUnlockedWeapon = newestUnlocked;
  } else if (!unlocked.includes(selectedWeapon)) {
    selectedWeapon = newestUnlocked;
    highestUnlockedWeapon = newestUnlocked;
  }

  return selectedWeapon;
}

function createHelper(type: "red" | "green", player: Fighter) {
  const activeHelpers = fighters.filter((fighter) => fighter.team === "ally" && fighter.respawn <= 0);
  if (activeHelpers.length >= 2) {
    return;
  }

  const helper = createFighter(player.x + 12, player.y + 12, false, type === "red" ? 2 : 3);
  helper.team = "ally";
  helper.helperType = type;
  helper.archetype = "ranged";
  helper.hp = type === "green" ? 750 : 1000;
  helper.maxHp = type === "green" ? 750 : 1000;
  helper.speed = type === "red" ? 56 : 60;
  helper.damageMultiplier = 1;
  helper.critChance = 0;
  fighters.push(helper);
  playHelperSound(type);
}

function activateShield(player: Fighter) {
  if (player.shieldCount <= 0 || player.shieldTimer > 0) {
    return;
  }

  player.shieldCount -= 1;
  player.shieldTimer = 10;
  playShieldSound();
}

function activateRage(player: Fighter) {
  if (player.rageCharge < 100 || player.rageTimer > 0 || player.rageCooldown > 0) {
    return;
  }

  player.rageCharge = 0;
  player.rageTimer = 10;
  player.rageCooldown = 45;
  playTone("sawtooth", 420, 0.2, 0.04, 820);
}

function shoot(fighter: Fighter) {
  if (fighter.reload > 0 || fighter.respawn > 0) {
    return;
  }

  if (fighter.isPlayer) {
    const weapon = getActivePlayerWeapon(fighter);
    const rageReloadFactor = fighter.rageTimer > 0 ? 0.45 : 1;
    const rageSpeedFactor = fighter.rageTimer > 0 ? 2 : 1;
    const playerSpeedFactor = 1.5;

    if (weapon === "pistol") {
      fighter.reload = 0.2 * rageReloadFactor;
      createBullet(fighter, fighter.dir, 176 * playerSpeedFactor * rageSpeedFactor, 10, 24, 3, weapon);
    } else if (weapon === "shotgun") {
      fighter.reload = 0.28 * rageReloadFactor;
      createBullet(fighter, fighter.dir - 0.24, 152 * playerSpeedFactor * rageSpeedFactor, 10, 20, 3, weapon);
      createBullet(fighter, fighter.dir - 0.12, 158 * playerSpeedFactor * rageSpeedFactor, 10, 20, 3, weapon);
      createBullet(fighter, fighter.dir, 164 * playerSpeedFactor * rageSpeedFactor, 10, 20, 3, weapon);
      createBullet(fighter, fighter.dir + 0.12, 158 * playerSpeedFactor * rageSpeedFactor, 10, 20, 3, weapon);
      createBullet(fighter, fighter.dir + 0.24, 152 * playerSpeedFactor * rageSpeedFactor, 10, 20, 3, weapon);
    } else if (weapon === "smg") {
      fighter.reload = 0.06 * rageReloadFactor;
      createBullet(
        fighter,
        fighter.dir + (Math.random() - 0.5) * 0.12,
        188 * playerSpeedFactor * rageSpeedFactor,
        10,
        14,
        2,
        weapon
      );
    } else if (weapon === "rifle") {
      fighter.reload = 0.08 * rageReloadFactor;
      createBullet(fighter, fighter.dir, 240 * playerSpeedFactor * rageSpeedFactor, 10, 34, 3, weapon);
    } else {
      fighter.reload = 0.275 * rageReloadFactor;
      createBullet(fighter, fighter.dir, 132 * playerSpeedFactor * rageSpeedFactor, 10, 160, 5, weapon);
    }
  } else {
    fighter.reload = 0.34;
    createBullet(fighter, fighter.dir, 132, 1.1, 24, 3, "pistol");
  }

  playShootSound(fighter.isPlayer);
}

function chooseBotTarget(bot: Fighter) {
  const targets = fighters.filter(
    (fighter) => (fighter.team === "player" || fighter.team === "ally") && fighter.respawn <= 0
  );

  if (targets.length === 0) {
    return null;
  }

  return targets
    .map((fighter) => ({
      fighter,
      distance: Math.hypot(fighter.x - bot.x, fighter.y - bot.y) || 1,
      score: 0
    }))
    .sort((a, b) => a.distance - b.distance)[0];
}

function chooseHelperTarget(helper: Fighter) {
  const enemies = fighters.filter((fighter) => fighter.team === "enemy" && fighter.respawn <= 0);
  if (enemies.length === 0) {
    return null;
  }

  return enemies
    .map((fighter) => ({
      fighter,
      distance: Math.hypot(fighter.x - helper.x, fighter.y - helper.y) || 1
    }))
    .sort((a, b) => a.distance - b.distance)[0];
}

function updatePlayer(player: Fighter, dt: number) {
  const moveX = clamp(Number(input.right) - Number(input.left) + input.moveX, -1, 1);
  const moveY = clamp(Number(input.down) - Number(input.up) + input.moveY, -1, 1);
  const len = Math.hypot(moveX, moveY) || 1;
  player.vx = (moveX / len) * player.speed;
  player.vy = (moveY / len) * player.speed;
  player.dir = Math.atan2(input.mouseY - player.y, input.mouseX - player.x);

  if (input.shoot) {
    shoot(player);
  }

  moveFighter(player, dt);
}

function updateBot(bot: Fighter, dt: number) {
  const visibleEnemy = chooseBotTarget(bot);

  if (!visibleEnemy) {
    return;
  }

  const enemy = visibleEnemy.fighter;
  const dx = enemy.x - bot.x;
  const dy = enemy.y - bot.y;
  const dist = visibleEnemy.distance;
  bot.dir = Math.atan2(dy, dx);

  if (bot.wander <= 0) {
    bot.wander = 0.8 + Math.random() * 1.4;
    if (bot.archetype === "melee") {
      bot.targetX = enemy.x;
      bot.targetY = enemy.y;
    } else {
      const orbit = dist < 70 ? -1 : 1;
      bot.targetX = enemy.x - (dx / dist) * 54 + (-dy / dist) * 22 * orbit;
      bot.targetY = enemy.y - (dy / dist) * 54 + (dx / dist) * 22 * orbit;
    }
  } else {
    bot.wander -= dt;
  }

  const moveDX = bot.targetX - bot.x;
  const moveDY = bot.targetY - bot.y;
  const moveLen = Math.hypot(moveDX, moveDY) || 1;
  bot.vx = (moveDX / moveLen) * bot.speed;
  bot.vy = (moveDY / moveLen) * bot.speed;

  if (bot.archetype === "melee") {
    if (dist < bot.radius + enemy.radius + 6 && bot.attackCooldown <= 0) {
      bot.attackCooldown = 0.65;
      const baseDamage = enemy.team === "player" ? 10 * NON_BOSS_ENEMY_DAMAGE_TO_PLAYER_SCALE : 10;
      const damage = playerHasInfiniteHealth(enemy) ? 0 : enemy.rageTimer > 0 ? 0 : enemy.shieldTimer > 0 ? 0 : baseDamage;
      enemy.hp -= damage;
      enemy.flash = 0.16;
      bot.flash = 0.08;
      playHitSound(true);
      if (enemy.rageTimer > 0) {
        applyKnockback(bot, enemy.x, enemy.y, 22);
      } else if (enemy.shieldTimer > 0) {
        applyKnockback(bot, enemy.x, enemy.y, 16);
      }

      if (enemy.hp <= 0) {
        defeatFighter(enemy, bot);
      }
    }
  } else if (dist < 118 && !lineBlocked(bot.x, bot.y, enemy.x, enemy.y)) {
    shoot(bot);
  }

  moveFighter(bot, dt);
}

function updateHelper(helper: Fighter, dt: number) {
  const player = fighters.find((fighter) => fighter.team === "player" && fighter.respawn <= 0);
  if (!player) {
    return;
  }

  if (helper.helperType === "green") {
    helper.dir = Math.atan2(player.y - helper.y, player.x - helper.x);
    helper.targetX = player.x - Math.cos(elapsed * 2 + helper.id) * 18;
    helper.targetY = player.y - Math.sin(elapsed * 2 + helper.id) * 18;

    const moveDX = helper.targetX - helper.x;
    const moveDY = helper.targetY - helper.y;
    const moveLen = Math.hypot(moveDX, moveDY) || 1;
    helper.vx = (moveDX / moveLen) * helper.speed;
    helper.vy = (moveDY / moveLen) * helper.speed;

    if (helper.reload <= 0 && Math.hypot(player.x - helper.x, player.y - helper.y) < 80) {
      helper.reload = 0.8;
      player.hp = Math.min(player.maxHp, player.hp + 10);
      player.flash = 0.08;
      bullets.push({
        x: helper.x,
        y: helper.y,
        vx: Math.cos(helper.dir) * 120,
        vy: Math.sin(helper.dir) * 120,
        ownerId: helper.id,
        life: 1,
        color: "#7dff9d",
        damage: 0,
        size: 3,
        weapon: "pistol",
        isCrit: false,
        healAmount: 5
      });
      playShootSound(false);
    }

    moveFighter(helper, dt);
    return;
  }

  const target = chooseHelperTarget(helper);
  if (!target) {
    return;
  }

  const enemy = target.fighter;
  const dx = enemy.x - helper.x;
  const dy = enemy.y - helper.y;
  const dist = target.distance;
  helper.dir = Math.atan2(dy, dx);

  if (helper.wander <= 0) {
    helper.wander = 0.7 + Math.random() * 1.1;
    const orbit = dist < 80 ? -1 : 1;
    helper.targetX = enemy.x - (dx / dist) * 62 + (-dy / dist) * 16 * orbit;
    helper.targetY = enemy.y - (dy / dist) * 62 + (dx / dist) * 16 * orbit;
  } else {
    helper.wander -= dt;
  }

  const moveDX = helper.targetX - helper.x;
  const moveDY = helper.targetY - helper.y;
  const moveLen = Math.hypot(moveDX, moveDY) || 1;
  helper.vx = (moveDX / moveLen) * helper.speed;
  helper.vy = (moveDY / moveLen) * helper.speed;

  if (dist < 140 && helper.reload <= 0) {
    helper.reload = 0.55;
    bullets.push({
      x: helper.x + Math.cos(helper.dir) * 8,
      y: helper.y + Math.sin(helper.dir) * 8,
      vx: Math.cos(helper.dir) * 118,
      vy: Math.sin(helper.dir) * 118,
      ownerId: helper.id,
      life: 1.3,
      color: "#ff7a7a",
      damage: 18,
      size: 3,
      weapon: "pistol",
      isCrit: false,
      healAmount: 0
    });
    playShootSound(false);
  }

  moveFighter(helper, dt);
}

function getBossTargets() {
  return fighters.filter(
    (fighter) => (fighter.team === "player" || fighter.team === "ally") && fighter.respawn <= 0
  );
}

function angleDifference(a: number, b: number) {
  let diff = a - b;
  while (diff > Math.PI) diff -= TAU;
  while (diff < -Math.PI) diff += TAU;
  return Math.abs(diff);
}

function distanceToSegment(
  pointX: number,
  pointY: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number
) {
  const segX = endX - startX;
  const segY = endY - startY;
  const segLengthSq = segX * segX + segY * segY || 1;
  const t = clamp(((pointX - startX) * segX + (pointY - startY) * segY) / segLengthSq, 0, 1);
  const nearestX = startX + segX * t;
  const nearestY = startY + segY * t;
  return Math.hypot(pointX - nearestX, pointY - nearestY);
}

function bossShieldActive() {
  const boss = getBoss();
  return bossFightStarted && bossIntroTimer > 0 && boss?.bossKind === "iron";
}

function getBoss1ShieldRadius(boss: Fighter) {
  return (boss.radius + 12) * BOSS1_SHIELD_RADIUS_SCALE;
}

function getBoss1ShieldArcLength() {
  return TAU * BOSS1_SHIELD_ARC_PORTION;
}

function getBoss1ShieldSpin() {
  return elapsed * BOSS1_SHIELD_SPIN_SPEED;
}

function bulletHitsBoss1Shield(bullet: Bullet, boss: Fighter) {
  if (boss.bossKind !== "iron" || !bossShieldActive()) {
    return false;
  }

  const dx = bullet.x - boss.x;
  const dy = bullet.y - boss.y;
  const distanceFromBoss = Math.hypot(dx, dy);
  const shieldRadius = getBoss1ShieldRadius(boss);
  const shieldHalfThickness = BOSS1_SHIELD_LINE_WIDTH * 0.5 + 0.5;

  if (Math.abs(distanceFromBoss - shieldRadius) > shieldHalfThickness + bullet.size) {
    return false;
  }

  const shieldArcLength = getBoss1ShieldArcLength();
  const shieldCenterAngle = getBoss1ShieldSpin() + shieldArcLength * 0.5;
  const bulletAngle = Math.atan2(dy, dx);
  return angleDifference(bulletAngle, shieldCenterAngle) <= shieldArcLength * 0.5;
}

function queueBossAttack(boss: Fighter, player: Fighter | null) {
  bossAttackType = bossAttackPattern[bossAttackIndex % bossAttackPattern.length];
  bossAttackWindup = bossAttackType === "forward" ? 0.95 : bossAttackType === "targeted" ? 0.8 : 1.05;
  bossAttackActive = 0.22;
  bossAttackRecover = 0.35;
  bossAttackHitApplied = false;

  if (bossAttackType === "targeted" && player) {
    bossAttackAngle = Math.atan2(player.y - boss.y, player.x - boss.x);
  } else if (bossAttackType === "forward") {
    bossAttackAngle = player ? Math.atan2(player.y - boss.y, player.x - boss.x) : boss.dir;
  } else {
    bossAttackAngle = boss.dir;
  }

  boss.dir = bossAttackAngle;
}

function applyBossAttack(boss: Fighter) {
  const targets = getBossTargets();

  for (const target of targets) {
    let hit = false;

    if (bossAttackType === "targeted" || bossAttackType === "forward") {
      const dx = target.x - boss.x;
      const dy = target.y - boss.y;
      const dist = Math.hypot(dx, dy);
      const angleToTarget = Math.atan2(dy, dx);
      const maxDistance = bossAttackType === "forward" ? 104 : 80;
      const arc = bossAttackType === "forward" ? 0.42 : 0.52;
      hit = dist <= maxDistance && angleDifference(angleToTarget, bossAttackAngle) <= arc;
    } else if (bossAttackType === "left") {
      hit = target.x <= WORLD_WIDTH / 2;
    } else if (bossAttackType === "right") {
      hit = target.x >= WORLD_WIDTH / 2;
    }

    if (!hit) {
      continue;
    }

    damageHazardTarget(target, bossAttackType === "forward" ? 26 : bossAttackType === "targeted" ? 30 : 24, boss.x, boss.y, 20);
  }
}

function damageTargetsTouchingBossSword(boss: Fighter, damage: number, knockback: number) {
  const swordLength = getBossArenaRadius() - 4;
  const swordStartX = boss.x + Math.cos(boss.dir) * (boss.radius - 2);
  const swordStartY = boss.y + Math.sin(boss.dir) * (boss.radius - 2);
  const swordEndX = boss.x + Math.cos(boss.dir) * swordLength;
  const swordEndY = boss.y + Math.sin(boss.dir) * swordLength;

  for (const target of getBossTargets()) {
    const distanceFromBlade = distanceToSegment(
      target.x,
      target.y,
      swordStartX,
      swordStartY,
      swordEndX,
      swordEndY
    );

    if (distanceFromBlade <= target.radius + 4) {
      damageHazardTarget(target, damage, boss.x, boss.y, knockback);
    }
  }
}

function spawnSkullBossProjectile(boss: Fighter) {
  const edgeAngle = Math.random() * TAU;
  const edgeRadius = getBossArenaRadius() - 6;
  const edgeX = WORLD_WIDTH / 2 + Math.cos(edgeAngle) * edgeRadius;
  const edgeY = WORLD_HEIGHT / 2 + Math.sin(edgeAngle) * edgeRadius;
  const angle = Math.atan2(edgeY - boss.y, edgeX - boss.x);
  const arenaRadius = getBossArenaRadius() - 6;
  const speed = 72;
  bullets.push({
    x: boss.x + Math.cos(angle) * (boss.radius + 6),
    y: boss.y + Math.sin(angle) * (boss.radius + 6),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    ownerId: boss.id,
    life: arenaRadius / speed + 0.35,
    color: "#f0e7d4",
    damage: 28,
    size: 6,
    weapon: "pistol",
    isCrit: false,
    healAmount: 0
  });
  playShootSound(false);
}

function spawnSkullMinions(count: number) {
  const activeEnemies = fighters.filter((fighter) => fighter.team === "enemy" && fighter.respawn <= 0).length;
  const availableSlots = Math.max(0, MAX_SIMULTANEOUS_ENEMIES - activeEnemies);
  const spawnCount = Math.min(count, availableSlots);
  const reservedSpawns = fighters
    .filter((fighter) => fighter.respawn <= 0)
    .map((fighter) => ({ x: fighter.x, y: fighter.y, radius: fighter.radius }));

  for (let index = 0; index < spawnCount; index += 1) {
    const minion = createFighter(0, 0, false, 1 + (index % 3));
    minion.team = "enemy";
    minion.archetype = "melee";
    minion.headMark = "skull";
    minion.radius = 8;
    minion.speed = 60;
    minion.maxHp = 135;
    minion.hp = 135;
    minion.damageMultiplier = 1.15;
    minion.color = "#4c4e57";
    minion.accent = "#d8d1c2";
    const spawn = getRandomSpawnPoint(minion.radius, undefined, reservedSpawns);
    minion.x = spawn.x;
    minion.y = spawn.y;
    minion.spawnX = spawn.x;
    minion.spawnY = spawn.y;
    reservedSpawns.push({ x: spawn.x, y: spawn.y, radius: minion.radius });
    fighters.push(minion);
  }
}

function spawnBossLightningAt(x: number) {
  lightningStrikes.push({
    x,
    timer: 0.65,
    duration: 0.22,
    warning: 0.65,
    active: false,
    hitApplied: false
  });
}

function spawnBossMeteorAt(x: number, y: number) {
  meteors.push({
    x,
    y,
    timer: 0.85,
    warning: 0.85,
    fallDuration: 0.34,
    active: false,
    hitApplied: false,
    radius: 16
  });
}

function summonSkullBossHazards() {
  for (let index = 0; index < 3; index += 1) {
    const strikePoint = getRandomSpawnPoint(14);
    spawnBossLightningAt(strikePoint.x);
  }

  for (let index = 0; index < 3; index += 1) {
    const meteorPoint = getRandomSpawnPoint(16);
    spawnBossMeteorAt(meteorPoint.x, meteorPoint.y);
  }
}

function updateSkullBoss(boss: Fighter, dt: number) {
  boss.vx = 0;
  boss.vy = 0;
  const player = fighters.find((fighter) => fighter.team === "player" && fighter.respawn <= 0) ?? null;
  if (player) {
    boss.dir = Math.atan2(player.y - boss.y, player.x - boss.x);
  }

  if (skullBossBurstShotsLeft > 0) {
    skullBossBurstWindup = Math.max(0, skullBossBurstWindup - dt);
    while (skullBossBurstShotsLeft > 0 && skullBossBurstWindup <= 0) {
      spawnSkullBossProjectile(boss);
      skullBossBurstShotsLeft -= 1;
      if (skullBossBurstShotsLeft > 0) {
        skullBossBurstWindup += SKULL_BOSS_PROJECTILE_WINDUP;
      }
    }

    if (skullBossBurstShotsLeft > 0) {
      return;
    }

    skullBossActionTimer = 1.1;
  }

  skullBossActionTimer = Math.max(0, skullBossActionTimer - dt);
  if (skullBossActionTimer > 0) {
    return;
  }

  const action = skullBossActionIndex % 3;
  if (action === 0) {
    skullBossBurstShotsLeft = 20;
    skullBossBurstWindup = SKULL_BOSS_PROJECTILE_WINDUP;
    skullBossActionTimer = 0;
  } else if (action === 1) {
    spawnSkullMinions(5);
    skullBossActionTimer = 3;
  } else {
    summonSkullBossHazards();
    skullBossActionTimer = 3.6;
  }

  skullBossActionIndex += 1;
}

function updateBoss(boss: Fighter, dt: number) {
  if (boss.bossKind === "skull") {
    updateSkullBoss(boss, dt);
    return;
  }

  boss.vx = 0;
  boss.vy = 0;
  const player = fighters.find((fighter) => fighter.team === "player" && fighter.respawn <= 0) ?? null;
  if (player && bossIntroTimer <= 0 && bossAttackType !== "targeted") {
    boss.dir = Math.atan2(player.y - boss.y, player.x - boss.x);
  }

  if (bossIntroTimer > 0) {
    bossIntroTimer = Math.max(0, bossIntroTimer - dt);
    boss.dir += dt * BOSS1_SHIELD_SPIN_SPEED;
    bossSpinDamageTick -= dt;

    if (bossSpinDamageTick <= 0) {
      damageTargetsTouchingBossSword(boss, 12, 0);
      bossSpinDamageTick = 0.28;
    }

    if (bossIntroTimer <= 0) {
      queueBossAttack(boss, player);
    }
    return;
  }

  if (!bossAttackType) {
    queueBossAttack(boss, player);
    return;
  }

  if (bossAttackWindup > 0) {
    bossAttackWindup = Math.max(0, bossAttackWindup - dt);
    boss.dir = bossAttackType === "left" ? Math.PI : bossAttackType === "right" ? 0 : bossAttackAngle;
    return;
  }

  if (bossAttackActive > 0) {
    bossAttackActive = Math.max(0, bossAttackActive - dt);
    if (!bossAttackHitApplied) {
      applyBossAttack(boss);
      bossAttackHitApplied = true;
    }
    return;
  }

  bossAttackRecover = Math.max(0, bossAttackRecover - dt);
  if (bossAttackRecover <= 0) {
    bossAttackIndex = (bossAttackIndex + 1) % bossAttackPattern.length;
    queueBossAttack(boss, player);
  }
}

function reflectBulletOffBoss(bullet: Bullet, boss: Fighter) {
  const player = fighters.find((fighter) => fighter.team === "player" && fighter.respawn <= 0)
    ?? getBossTargets()[0]
    ?? null;

  if (!player) {
    bullet.life = 0;
    return;
  }

  const angle = Math.atan2(player.y - boss.y, player.x - boss.x);
  const speed = Math.hypot(bullet.vx, bullet.vy) || 150;
  bullet.ownerId = boss.id;
  bullet.vx = Math.cos(angle) * speed;
  bullet.vy = Math.sin(angle) * speed;
  bullet.x = boss.x + Math.cos(angle) * (boss.radius + 6);
  bullet.y = boss.y + Math.sin(angle) * (boss.radius + 6);
  bullet.life = Math.max(1, bullet.life);
  bullet.color = "#d8e5f0";
  bullet.isCrit = false;
  bullet.healAmount = 0;
  playHitSound(false);
}

function moveFighter(fighter: Fighter, dt: number) {
  const nextX = fighter.x + fighter.vx * dt;
  const nextY = fighter.y + fighter.vy * dt;

  if (canMoveTo(nextX, fighter.y, fighter.radius)) {
    fighter.x = nextX;
  }
  if (canMoveTo(fighter.x, nextY, fighter.radius)) {
    fighter.y = nextY;
  }
}

function applyKnockback(target: Fighter, sourceX: number, sourceY: number, strength: number) {
  if (target.isBoss) {
    return;
  }

  const dx = target.x - sourceX;
  const dy = target.y - sourceY;
  const length = Math.hypot(dx, dy) || 1;
  const knockX = (dx / length) * strength;
  const knockY = (dy / length) * strength;
  const nextX = target.x + knockX;
  const nextY = target.y + knockY;

  if (canMoveTo(nextX, target.y, target.radius)) {
    target.x = nextX;
  }
  if (canMoveTo(target.x, nextY, target.radius)) {
    target.y = nextY;
  }
}

function despawnEnemies() {
  const enemyIds = new Set(
    fighters.filter((fighter) => fighter.team === "enemy").map((fighter) => fighter.id)
  );

  for (let i = fighters.length - 1; i >= 0; i -= 1) {
    if (fighters[i].team === "enemy") {
      fighters.splice(i, 1);
    }
  }

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    if (enemyIds.has(bullets[i].ownerId)) {
      bullets.splice(i, 1);
    }
  }
}

function clearRunStateOnPlayerDeath() {
  despawnEnemies();
  bullets.length = 0;
  lightningStrikes.length = 0;
  meteors.length = 0;
  burningFloors.length = 0;
  medkits.length = 0;
  stars.length = 0;
  shieldPickups.length = 0;
  explosions.length = 0;
  survivalWithoutDeath = 0;
  bossFightStarted = false;
  bossFightWon = false;
  bossIntroTimer = 0;
  bossAttackType = null;
  bossAttackWindup = 0;
  bossAttackActive = 0;
  bossAttackRecover = 0;
  bossAttackIndex = 0;
  bossAttackAngle = 0;
  bossAttackHitApplied = false;
  bossSpinDamageTick = 0;
  bossSwordContactTick = 0;
  skullBossActionTimer = 0;
  skullBossActionIndex = 0;
  skullBossBurstShotsLeft = 0;
  skullBossBurstWindup = 0;
  bossesDefeated = 0;

  for (let i = fighters.length - 1; i >= 0; i -= 1) {
    if (fighters[i].team === "ally") {
      fighters.splice(i, 1);
    }
  }
}

function defeatFighter(target: Fighter, owner?: Fighter | null) {
  if (target.team === "ally") {
    const index = fighters.findIndex((fighter) => fighter.id === target.id);
    if (index >= 0) {
      fighters.splice(index, 1);
    }
    playDefeatSound();
    return;
  }

  if (target.isBoss) {
    const defeatedBossKind = target.bossKind;
    const bossDeathX = target.x;
    const bossDeathY = target.y;
    const index = fighters.findIndex((fighter) => fighter.id === target.id);
    if (index >= 0) {
      fighters.splice(index, 1);
    }
    bossFightStarted = false;
    bossFightWon = false;
    bossIntroTimer = 0;
    bossAttackType = null;
    bossAttackWindup = 0;
    bossAttackActive = 0;
    bossAttackRecover = 0;
    bossAttackHitApplied = false;
    bossSwordContactTick = 0;
    skullBossActionTimer = 0;
    skullBossActionIndex = 0;
    skullBossBurstShotsLeft = 0;
    skullBossBurstWindup = 0;
    bossesDefeated += 1;
    clearAmbientHazards();
    if (defeatedBossKind !== "skull") {
      spawnEnemyWave();
    }
    spawnBossBlueStars(bossDeathX, bossDeathY);
    if (owner) {
      owner.score += defeatedBossKind === "skull" ? 14 : 10;
    }
    playDefeatSound();
    return;
  }

  target.respawn = 2.2;
  target.hp = 0;
  if (target.team === "player") {
    clearRunStateOnPlayerDeath();
    pendingRunReset = true;
  } else {
    const point = getRandomSpawnPoint(target.radius, target.id);
    target.spawnX = point.x;
    target.spawnY = point.y;
  }
  if (owner) {
    owner.score += 1;
  }
  playDefeatSound();
}

function addExplosion(x: number, y: number, radius: number) {
  explosions.push({
    x,
    y,
    radius,
    timer: 0.22,
    maxTimer: 0.22
  });
}

function canHitTarget(owner: Fighter | null, target: Fighter) {
  if (!owner) {
    return false;
  }

  if (owner.team === "player") {
    return target.team === "enemy";
  }

  if (owner.team === "enemy") {
    return target.team === "player" || target.team === "ally";
  }

  if (owner.helperType === "green") {
    return false;
  }

  return target.team === "enemy";
}

function applyProjectileDamage(
  target: Fighter,
  damage: number,
  sourceX: number,
  sourceY: number,
  knockback: number,
  owner: Fighter | null
) {
  const scaledDamage =
    target.team === "player" && owner?.team === "enemy" && !owner.isBoss
      ? damage * NON_BOSS_ENEMY_DAMAGE_TO_PLAYER_SCALE
      : damage;
  const appliedDamage = playerHasInfiniteHealth(target)
    ? 0
    : target.rageTimer > 0
      ? 0
      : target.shieldTimer > 0
        ? 0
        : scaledDamage;

  target.hp -= appliedDamage;
  target.flash = 0.18;
  if (knockback > 0) {
    applyKnockback(target, sourceX, sourceY, knockback);
  }

  if (target.hp <= 0) {
    defeatFighter(target, owner);
  }
}

function explodeBazooka(bullet: Bullet) {
  const owner = fighters.find((fighter) => fighter.id === bullet.ownerId) ?? null;
  addExplosion(bullet.x, bullet.y, 30);
  playHitSound(false);

  for (const fighter of fighters) {
    if (fighter.respawn > 0 || fighter.id === bullet.ownerId) {
      continue;
    }
    if (!canHitTarget(owner, fighter)) {
      continue;
    }

    const distance = Math.hypot(fighter.x - bullet.x, fighter.y - bullet.y);
    if (distance > 30) {
      continue;
    }

    const falloff = 1 - distance / 30;
    const damage = Math.max(40, Math.round(bullet.damage * falloff));
    applyProjectileDamage(fighter, damage, bullet.x, bullet.y, 14 * falloff, owner);
  }
}

function updateBullets(dt: number) {
  for (const bullet of bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    if (bullet.healAmount > 0) {
      const healerTarget = fighters.find((fighter) => {
        const owner = fighters.find((candidate) => candidate.id === bullet.ownerId);
        if (!owner) {
          return false;
        }
        return (
          fighter.team === "player" &&
          fighter.respawn <= 0 &&
          Math.hypot(fighter.x - bullet.x, fighter.y - bullet.y) < fighter.radius + bullet.size + 1
        );
      });

      if (healerTarget) {
        healerTarget.hp = Math.min(healerTarget.maxHp, healerTarget.hp + bullet.healAmount);
        healerTarget.flash = 0.08;
        bullet.life = 0;
        playPickupSound();
        continue;
      }
    }

    const boss = getBoss();
    const owner = fighters.find((candidate) => candidate.id === bullet.ownerId) ?? null;
    if (
      boss &&
      owner &&
      owner.team !== "enemy" &&
      bulletHitsBoss1Shield(bullet, boss)
    ) {
      reflectBulletOffBoss(bullet, boss);
      continue;
    }

    if (bullet.weapon === "bazooka") {
      const splashTarget = fighters
        .filter((fighter) => {
          if (fighter.id === bullet.ownerId || fighter.respawn > 0) {
            return false;
          }
          if (!canHitTarget(owner ?? null, fighter)) {
            return false;
          }
          return Math.hypot(fighter.x - bullet.x, fighter.y - bullet.y) < 22;
        })
        .sort(
          (a, b) =>
            Math.hypot(a.x - bullet.x, a.y - bullet.y) - Math.hypot(b.x - bullet.x, b.y - bullet.y)
        )[0];

      if (splashTarget) {
        explodeBazooka(bullet);
        bullet.life = 0;
        continue;
      }
    }

    if (
      bullet.x < 0 ||
      bullet.x > WORLD_WIDTH ||
      bullet.y < 0 ||
      bullet.y > WORLD_HEIGHT ||
      intersectsWall(bullet.x, bullet.y, 2)
    ) {
      if (bullet.weapon === "bazooka") {
        explodeBazooka(bullet);
      }
      bullet.life = 0;
      continue;
    }

    const target = fighters
      .filter((fighter) => {
        if (fighter.id === bullet.ownerId || fighter.respawn > 0) {
          return false;
        }
        if (!canHitTarget(owner ?? null, fighter)) {
          return false;
        }
        return Math.hypot(fighter.x - bullet.x, fighter.y - bullet.y) < fighter.radius + bullet.size;
      })
      .sort(
        (a, b) =>
          Math.hypot(a.x - bullet.x, a.y - bullet.y) - Math.hypot(b.x - bullet.x, b.y - bullet.y)
      )[0];

    if (!target) {
      continue;
    }

    if (bullet.weapon === "bazooka") {
      explodeBazooka(bullet);
      bullet.life = 0;
      continue;
    }

    const directHitKnockback = target.rageTimer > 0 && target.team === "player" ? 0 : bullet.isCrit ? 8 : 0;
    applyProjectileDamage(target, bullet.damage, bullet.x, bullet.y, directHitKnockback, owner);
    bullet.life = 0;
    playHitSound(false);

    if (target.rageTimer > 0 && target.team === "player") {
      if (owner && owner.team === "enemy" && owner.respawn <= 0) {
        owner.hp -= bullet.damage;
        owner.flash = 0.18;
        applyKnockback(owner, target.x, target.y, 18);
        if (owner.hp <= 0) {
          defeatFighter(owner, target);
        }
      }
      continue;
    }

    if (target.hp <= 0) {
      continue;
    }
  }

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    if (bullets[i].life <= 0) {
      bullets.splice(i, 1);
    }
  }
}

function updateExplosions(dt: number) {
  for (const explosion of explosions) {
    explosion.timer -= dt;
  }

  for (let i = explosions.length - 1; i >= 0; i -= 1) {
    if (explosions[i].timer <= 0) {
      explosions.splice(i, 1);
    }
  }
}

function spawnMedkit() {
  if (medkits.length >= 1) {
    return;
  }

  medkits.push({
    x: 24 + Math.random() * (WORLD_WIDTH - 48),
    y: 24 + Math.random() * (WORLD_HEIGHT - 48)
  });
}

function spawnStar() {
  if (stars.length >= 1) {
    return;
  }

  stars.push({
    x: 28 + Math.random() * (WORLD_WIDTH - 56),
    y: 28 + Math.random() * (WORLD_HEIGHT - 56),
    color: Math.random() < 0.5 ? "blue" : "red"
  });
}

function spawnBossBlueStars(centerX: number, centerY: number) {
  for (let index = 0; index < 3; index += 1) {
    const angle = (index / 3) * TAU + Math.random() * 0.35;
    const distance = 10 + Math.random() * 10;
    const x = Math.max(28, Math.min(WORLD_WIDTH - 28, centerX + Math.cos(angle) * distance));
    const y = Math.max(28, Math.min(WORLD_HEIGHT - 28, centerY + Math.sin(angle) * distance));
    stars.push({
      x,
      y,
      color: "blue"
    });
  }
}

function spawnShieldPickup() {
  if (shieldPickups.length >= 1) {
    return;
  }

  shieldPickups.push({
    x: 28 + Math.random() * (WORLD_WIDTH - 56),
    y: 28 + Math.random() * (WORLD_HEIGHT - 56)
  });
}

function updateMedkits(dt: number) {
  medkitCooldown -= dt;
  if (medkitCooldown <= 0) {
    spawnMedkit();
    medkitCooldown = 5 + Math.random() * 4;
  }

  const player = fighters.find((fighter) => fighter.isPlayer && fighter.respawn <= 0);
  if (!player) {
    return;
  }

  for (let i = medkits.length - 1; i >= 0; i -= 1) {
    const medkit = medkits[i];
    if (Math.hypot(player.x - medkit.x, player.y - medkit.y) < player.radius + 7) {
      player.hp = Math.min(player.maxHp, player.hp + 32);
      medkits.splice(i, 1);
      playPickupSound();
    }
  }
}

function updateShieldPickups(dt: number) {
  shieldPickupCooldown -= dt;
  if (shieldPickupCooldown <= 0) {
    spawnShieldPickup();
    shieldPickupCooldown = 18 + Math.random() * 10;
  }

  const player = fighters.find((fighter) => fighter.team === "player" && fighter.respawn <= 0);
  if (!player) {
    return;
  }

  for (let i = shieldPickups.length - 1; i >= 0; i -= 1) {
    const shieldPickup = shieldPickups[i];
    if (Math.hypot(player.x - shieldPickup.x, player.y - shieldPickup.y) < player.radius + 7) {
      player.shieldCount += 1;
      shieldPickups.splice(i, 1);
      playShieldSound();
    }
  }
}

function updateStars(dt: number) {
  starCooldown -= dt;
  if (starCooldown <= 0) {
    spawnStar();
    starCooldown = 10 + Math.random() * 6;
  }

  const player = fighters.find((fighter) => fighter.isPlayer && fighter.respawn <= 0);
  if (!player) {
    return;
  }

  for (let i = stars.length - 1; i >= 0; i -= 1) {
    const star = stars[i];
    if (Math.hypot(player.x - star.x, player.y - star.y) < player.radius + 8) {
      if (star.color === "blue") {
        const roll = Math.random();
        if (roll < 0.25) {
          player.critChance += 0.01;
        } else if (roll < 0.5) {
          player.damageMultiplier *= 1.2;
        } else if (roll < 0.75) {
          const previousMaxHp = player.maxHp;
          player.maxHp = Math.round(player.maxHp * 1.2);
          player.hp = Math.min(player.maxHp, player.hp + (player.maxHp - previousMaxHp));
        }
      } else {
        createHelper(Math.random() < 0.5 ? "red" : "green", player);
      }

      stars.splice(i, 1);
      playStarSound();
    }
  }
}

function spawnLightningStrike() {
  lightningStrikes.push({
    x: 28 + Math.random() * (WORLD_WIDTH - 56),
    timer: 0.65,
    duration: 0.22,
    warning: 0.65,
    active: false,
    hitApplied: false
  });
}

function updateLightning(dt: number, allowAutoSpawn = true) {
  const lightningSettings = getLightningSettings();
  lightningCooldown -= dt;
  if (allowAutoSpawn && lightningCooldown <= 0) {
    spawnLightningStrike();
    lightningCooldown =
      lightningSettings.minCooldown + Math.random() * (lightningSettings.maxCooldown - lightningSettings.minCooldown);
  } else if (!allowAutoSpawn && lightningCooldown < 0) {
    lightningCooldown = 0;
  }

  const player = fighters.find((fighter) => fighter.isPlayer && fighter.respawn <= 0);

  for (const strike of lightningStrikes) {
    strike.timer -= dt;

    if (!strike.active && strike.timer <= 0) {
      strike.active = true;
      strike.timer = strike.duration;
      playLightningSound();
    }

    if (strike.active && !strike.hitApplied && player) {
      const distanceFromLine = Math.abs(player.x - strike.x);
      if (distanceFromLine < 14) {
        if (!playerHasInfiniteHealth(player)) {
          player.hp -= lightningSettings.damage;
          if (player.rageTimer > 0) {
            player.hp += lightningSettings.damage;
            player.hp -= Math.round(lightningSettings.damage * 0.8);
          }
          player.flash = 0.22;
          playHitSound(false);

          if (player.hp <= 0) {
            player.hp = 0;
            player.respawn = 2.2;
            clearRunStateOnPlayerDeath();
            pendingRunReset = true;
            playDefeatSound();
          }
        }
      }
      strike.hitApplied = true;
    }
  }

  for (let i = lightningStrikes.length - 1; i >= 0; i -= 1) {
    if (lightningStrikes[i].active && lightningStrikes[i].timer <= 0) {
      lightningStrikes.splice(i, 1);
    }
  }
}

function spawnMeteor() {
  meteors.push({
    x: 32 + Math.random() * (WORLD_WIDTH - 64),
    y: 32 + Math.random() * (WORLD_HEIGHT - 64),
    timer: 0.85,
    warning: 0.85,
    fallDuration: 0.34,
    active: false,
    hitApplied: false,
    radius: 16
  });
}

function spawnBurningFloor(x: number, y: number, radius: number) {
  burningFloors.push({
    x,
    y,
    radius,
    timer: 5,
    maxTimer: 5,
    damageTick: 0.45
  });
}

function damageHazardTarget(target: Fighter, damage: number, sourceX: number, sourceY: number, knockback: number) {
  if (playerHasInfiniteHealth(target)) {
    target.hp = target.maxHp;
    return;
  }
  const appliedDamage = target.rageTimer > 0 ? Math.max(0, Math.round(damage * 0.28)) : target.shieldTimer > 0 ? 0 : damage;
  target.hp -= appliedDamage;
  target.flash = 0.2;
  if (knockback > 0) {
    applyKnockback(target, sourceX, sourceY, knockback);
  }
  playHitSound(false);

  if (target.hp <= 0) {
    defeatFighter(target, null);
  }
}

function updateBurningFloors(dt: number) {
  const hazardTargets = fighters.filter(
    (fighter) => (fighter.team === "player" || fighter.team === "ally") && fighter.respawn <= 0
  );

  for (const floor of burningFloors) {
    floor.timer -= dt;
    floor.damageTick -= dt;

    if (hazardTargets.length === 0) {
      continue;
    }

    const insideFire = hazardTargets.filter(
      (target) => Math.abs(target.x - floor.x) <= floor.radius && Math.abs(target.y - floor.y) <= floor.radius
    );
    if (insideFire.length > 0 && floor.damageTick <= 0) {
      for (const target of insideFire) {
        damageHazardTarget(target, 8, floor.x, floor.y, 0);
      }
      floor.damageTick = 0.45;
    }
  }

  for (let i = burningFloors.length - 1; i >= 0; i -= 1) {
    if (burningFloors[i].timer <= 0) {
      burningFloors.splice(i, 1);
    }
  }
}

function updateMeteors(dt: number, allowAutoSpawn = true) {
  const meteorSettings = getMeteorSettings();
  meteorCooldown -= dt;
  if (allowAutoSpawn && meteorCooldown <= 0) {
    spawnMeteor();
    meteorCooldown =
      meteorSettings.minCooldown + Math.random() * (meteorSettings.maxCooldown - meteorSettings.minCooldown);
  } else if (!allowAutoSpawn && meteorCooldown < 0) {
    meteorCooldown = 0;
  }

  const hazardTargets = fighters.filter(
    (fighter) => (fighter.team === "player" || fighter.team === "ally") && fighter.respawn <= 0
  );

  for (const meteor of meteors) {
    meteor.timer -= dt;

    if (!meteor.active && meteor.timer <= 0) {
      meteor.active = true;
      meteor.timer = meteor.fallDuration;
    }

    if (meteor.active && !meteor.hitApplied && meteor.timer <= 0) {
      addExplosion(meteor.x, meteor.y, meteor.radius);
      playMeteorSound();

      for (const target of hazardTargets) {
        const insideBlast = Math.abs(target.x - meteor.x) <= meteor.radius && Math.abs(target.y - meteor.y) <= meteor.radius;
        if (insideBlast) {
          damageHazardTarget(target, meteorSettings.damage, meteor.x, meteor.y, 16);
        }
      }

      if (survivalWithoutDeath >= 60) {
        spawnBurningFloor(meteor.x, meteor.y, meteor.radius);
      }

      meteor.hitApplied = true;
    }
  }

  for (let i = meteors.length - 1; i >= 0; i -= 1) {
    if (meteors[i].active && meteors[i].hitApplied) {
      meteors.splice(i, 1);
    }
  }
}

function update(dt: number) {
  elapsed += dt;
  let shouldResetRoster = false;
  const player = fighters.find((fighter) => fighter.team === "player" && fighter.respawn <= 0);

  if (player) {
    survivalWithoutDeath += dt;
  }

  if (player && !bossFightStarted && !bossFightWon) {
    if (bossesDefeated === 0 && survivalWithoutDeath >= 60) {
      startBossFight("iron");
    } else if (bossesDefeated === 1 && survivalWithoutDeath >= 120) {
      startBossFight("skull");
    }
  }

  for (const fighter of fighters) {
    fighter.reload = Math.max(0, fighter.reload - dt);
    fighter.flash = Math.max(0, fighter.flash - dt);
    fighter.attackCooldown = Math.max(0, fighter.attackCooldown - dt);
    fighter.shieldTimer = Math.max(0, fighter.shieldTimer - dt);
    fighter.rageTimer = Math.max(0, fighter.rageTimer - dt);
    if (fighter.rageTimer <= 0) {
      fighter.rageCooldown = Math.max(0, fighter.rageCooldown - dt);
    }
    if (fighter.team === "player" && fighter.rageTimer <= 0 && fighter.rageCooldown <= 0) {
      fighter.rageCharge = Math.min(100, fighter.rageCharge + dt * 8);
    }
    if (playerHasInfiniteHealth(fighter) && fighter.respawn <= 0) {
      fighter.hp = fighter.maxHp;
    }

    if (fighter.respawn > 0) {
      fighter.respawn -= dt;
      if (fighter.respawn <= 0) {
        if (fighter.team === "player" && pendingRunReset) {
          shouldResetRoster = true;
        } else {
          respawn(fighter);
        }
      }
      continue;
    }

    if (fighter.team === "player") {
      updatePlayer(fighter, dt);
    } else if (fighter.team === "ally") {
      updateHelper(fighter, dt);
    } else if (fighter.isBoss) {
      updateBoss(fighter, dt);
    } else {
      updateBot(fighter, dt);
    }
  }

  updateBullets(dt);
  updateExplosions(dt);
  const activeBoss = getBoss();
  if (!bossFightStarted) {
    updateLightning(dt);
    updateMeteors(dt);
    updateBurningFloors(dt);
    updateMedkits(dt);
    updateShieldPickups(dt);
    updateStars(dt);
  } else if (activeBoss?.bossKind === "skull") {
    updateLightning(dt, false);
    updateMeteors(dt, false);
    updateBurningFloors(dt);
  }

  if (shouldResetRoster) {
    spawnRoster();
  }

  liveReloadSaveTimer -= dt;
  if (liveReloadSaveTimer <= 0) {
    saveRuntimeSnapshot();
    liveReloadSaveTimer = 0.25;
  }
}

function drawArena() {
  const skyGradient = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  skyGradient.addColorStop(0, "#6b3d24");
  skyGradient.addColorStop(0.5, "#8d5630");
  skyGradient.addColorStop(1, "#4a2818");
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const craters = [
    { x: 56, y: 48, r: 18 },
    { x: 136, y: 150, r: 24 },
    { x: 248, y: 74, r: 15 },
    { x: 332, y: 168, r: 22 },
    { x: 410, y: 56, r: 16 },
    { x: 390, y: 214, r: 26 }
  ];

  for (const crater of craters) {
    ctx.fillStyle = "rgba(116, 58, 29, 0.32)";
    ctx.beginPath();
    ctx.arc(crater.x, crater.y, crater.r, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 198, 136, 0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(crater.x - 2, crater.y - 2, crater.r - 4, 0, TAU);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 220, 170, 0.08)";
    ctx.beginPath();
    ctx.arc(crater.x - crater.r * 0.25, crater.y - crater.r * 0.28, crater.r * 0.35, 0, TAU);
    ctx.fill();
  }

  for (let band = 0; band < 4; band += 1) {
    const y = 22 + band * 58;
    ctx.fillStyle = "rgba(255, 176, 98, 0.06)";
    ctx.fillRect(0, y, WORLD_WIDTH, 10);
  }

  for (const wall of walls) {
    ctx.fillStyle = "#8f5a34";
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.fillStyle = "#d79a5b";
    ctx.fillRect(wall.x, wall.y, wall.w, 4);
    ctx.fillStyle = "#60361d";
    ctx.fillRect(wall.x, wall.y + wall.h - 3, wall.w, 3);
  }

  if (bossFightStarted) {
    const arenaRadius = getBossArenaRadius();

    ctx.save();
    ctx.fillStyle = "rgba(8, 10, 16, 0.72)";
    ctx.beginPath();
    ctx.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.arc(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, arenaRadius, 0, TAU, true);
    ctx.fill("evenodd");

    ctx.strokeStyle = "rgba(255, 198, 128, 0.6)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, arenaRadius, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

function drawSkullMark(centerX: number, centerY: number, scale: number) {
  ctx.fillStyle = "#efe6d7";
  ctx.beginPath();
  ctx.arc(centerX, centerY, scale, 0, TAU);
  ctx.fill();

  ctx.fillStyle = "#1f2026";
  ctx.fillRect(centerX - scale * 0.65, centerY - scale * 0.35, scale * 0.45, scale * 0.45);
  ctx.fillRect(centerX + scale * 0.2, centerY - scale * 0.35, scale * 0.45, scale * 0.45);
  ctx.fillRect(centerX - scale * 0.15, centerY, scale * 0.3, scale * 0.35);

  ctx.fillStyle = "#d8cfbe";
  ctx.fillRect(centerX - scale * 0.62, centerY + scale * 0.45, scale * 1.24, scale * 0.42);
  ctx.fillStyle = "#2a2b31";
  ctx.fillRect(centerX - scale * 0.42, centerY + scale * 0.48, scale * 0.18, scale * 0.34);
  ctx.fillRect(centerX - scale * 0.1, centerY + scale * 0.48, scale * 0.18, scale * 0.34);
  ctx.fillRect(centerX + scale * 0.22, centerY + scale * 0.48, scale * 0.18, scale * 0.34);
}

function drawFighter(fighter: Fighter) {
  if (fighter.respawn > 0) {
    return;
  }

  if (fighter.isBoss) {
    if (fighter.bossKind === "skull") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
      ctx.beginPath();
      ctx.ellipse(fighter.x, fighter.y + 10, fighter.radius + 10, fighter.radius - 1, 0, 0, TAU);
      ctx.fill();

      ctx.fillStyle = fighter.flash > 0 ? "#ffffff" : "#595c68";
      ctx.beginPath();
      ctx.arc(fighter.x, fighter.y, fighter.radius, 0, TAU);
      ctx.fill();

      ctx.fillStyle = "#474954";
      ctx.beginPath();
      ctx.arc(fighter.x, fighter.y + 4, fighter.radius - 3, 0, TAU);
      ctx.fill();

      drawSkullMark(fighter.x, fighter.y - 4, 7);

      ctx.fillStyle = "#ffe7b3";
      ctx.fillRect(fighter.x - 32, fighter.y - 32, 64, 5);
      ctx.fillStyle = "#ff7676";
      ctx.fillRect(fighter.x - 32, fighter.y - 32, 64 * (fighter.hp / fighter.maxHp), 5);
      return;
    }

    const swordAngle =
      bossIntroTimer > 0
        ? fighter.dir
        : bossAttackType === "left"
          ? Math.PI
          : bossAttackType === "right"
            ? 0
            : bossAttackAngle || fighter.dir;
    const swordReach = fighter.isBoss ? getBossArenaRadius() - 4 : 24;
    const swordX = fighter.x + Math.cos(swordAngle) * swordReach;
    const swordY = fighter.y + Math.sin(swordAngle) * swordReach;

    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.beginPath();
    ctx.ellipse(fighter.x, fighter.y + 9, fighter.radius + 8, fighter.radius - 2, 0, 0, TAU);
    ctx.fill();

    if (bossShieldActive()) {
      const shieldRadius = getBoss1ShieldRadius(fighter);
      const shieldSpin = getBoss1ShieldSpin();
      const shieldArcLength = getBoss1ShieldArcLength();
      const shieldAlpha = 0.65 + Math.sin(elapsed * 10) * 0.18;
      ctx.strokeStyle = `rgba(180, 215, 255, ${shieldAlpha})`;
      ctx.lineWidth = BOSS1_SHIELD_LINE_WIDTH;
      ctx.beginPath();
      ctx.arc(fighter.x, fighter.y, shieldRadius, shieldSpin, shieldSpin + shieldArcLength);
      ctx.stroke();
    }

    ctx.strokeStyle = "#d9dde4";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(fighter.x, fighter.y);
    ctx.lineTo(swordX, swordY);
    ctx.stroke();

    ctx.strokeStyle = "#5c4434";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(fighter.x, fighter.y);
    ctx.lineTo(fighter.x + Math.cos(swordAngle) * 8, fighter.y + Math.sin(swordAngle) * 8);
    ctx.stroke();

    ctx.fillStyle = fighter.flash > 0 ? "#ffffff" : "#7f8795";
    ctx.beginPath();
    ctx.arc(fighter.x, fighter.y, fighter.radius, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "#9ca5b3";
    ctx.beginPath();
    ctx.arc(fighter.x, fighter.y - 4, fighter.radius - 2, Math.PI, TAU);
    ctx.fill();
    ctx.fillRect(fighter.x - 8, fighter.y - 3, 16, 5);

    ctx.fillStyle = "#242a34";
    ctx.fillRect(fighter.x - 5, fighter.y - 2, 3, 3);
    ctx.fillRect(fighter.x + 2, fighter.y - 2, 3, 3);

    ctx.fillStyle = "#ffe7b3";
    ctx.fillRect(fighter.x - 28, fighter.y - 30, 56, 5);
    ctx.fillStyle = "#ff7676";
    ctx.fillRect(fighter.x - 28, fighter.y - 30, 56 * (fighter.hp / fighter.maxHp), 5);
    return;
  }

  const body = fighter.flash > 0 ? "#ffffff" : fighter.color;
  const weaponReach = fighter.archetype === "melee" ? 4 : 6;
  const handX = fighter.x + Math.cos(fighter.dir) * weaponReach;
  const handY = fighter.y + Math.sin(fighter.dir) * weaponReach;

  if (fighter.rageTimer > 0) {
    const rainbow = ["#ff6464", "#ffb84d", "#fff36d", "#66f28a", "#68d5ff", "#ae7bff"];
    const colorIndex = Math.floor(elapsed * 12) % rainbow.length;
    ctx.strokeStyle = rainbow[colorIndex];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(fighter.x, fighter.y, fighter.radius + 6, 0, TAU);
    ctx.stroke();
  }

  if (fighter.shieldTimer > 0) {
    ctx.strokeStyle = "rgba(95, 193, 255, 0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(fighter.x, fighter.y, fighter.radius + 4, 0, TAU);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  ctx.beginPath();
  ctx.ellipse(fighter.x, fighter.y + 5, fighter.radius + 2, fighter.radius - 1, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = fighter.accent;
  if (fighter.archetype === "melee") {
    ctx.fillRect(handX - 1, handY - 4, 3, 8);
    ctx.fillRect(handX - 4, handY - 1, 8, 3);
  } else {
    ctx.fillRect(handX - 2, handY - 2, 4, 4);
  }

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(fighter.x, fighter.y, fighter.radius, 0, TAU);
  ctx.fill();

  if (fighter.helperType === "red") {
    ctx.fillStyle = "#ff3b3b";
  } else if (fighter.helperType === "green") {
    ctx.fillStyle = "#43d86b";
  } else {
    ctx.fillStyle = fighter.isPlayer ? "#ffffff" : "#1d2431";
  }
  ctx.fillRect(fighter.x - 4, fighter.y - 2, 3, 3);
  ctx.fillRect(fighter.x + 1, fighter.y - 2, 3, 3);

  if (fighter.headMark === "skull") {
    drawSkullMark(fighter.x, fighter.y - fighter.radius - 2, 3);
  }

  ctx.fillStyle = "#ffe7b3";
  const barWidth = 16;
  ctx.fillRect(fighter.x - barWidth / 2, fighter.y - 13, barWidth, 3);
  ctx.fillStyle = "#6ee67a";
  ctx.fillRect(
    fighter.x - barWidth / 2,
    fighter.y - 13,
    barWidth * (fighter.hp / fighter.maxHp),
    3
  );
}

function drawSpawnWarnings() {
  for (const fighter of fighters) {
    if (fighter.isPlayer || fighter.respawn <= 0) {
      continue;
    }

    const pulse = 0.6 + Math.sin(elapsed * 12) * 0.4;
    const size = 7 + pulse * 3;

    ctx.save();
    ctx.translate(fighter.spawnX, fighter.spawnY);
    ctx.strokeStyle = `rgba(255, 60, 60, ${0.55 + pulse * 0.35})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-size, -size);
    ctx.lineTo(size, size);
    ctx.moveTo(size, -size);
    ctx.lineTo(-size, size);
    ctx.stroke();
    ctx.restore();
  }
}

function drawLightning() {
  for (const strike of lightningStrikes) {
    if (!strike.active) {
      const pulse = 0.35 + Math.sin(elapsed * 16) * 0.2;
      ctx.strokeStyle = `rgba(255, 90, 90, ${0.55 + pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(strike.x, 0);
      ctx.lineTo(strike.x, WORLD_HEIGHT);
      ctx.stroke();
      continue;
    }

    ctx.strokeStyle = "rgba(255, 246, 176, 0.95)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(strike.x, 0);
    for (let y = 0; y <= WORLD_HEIGHT; y += 24) {
      const offset = (Math.random() - 0.5) * 14;
      ctx.lineTo(strike.x + offset, y);
    }
    ctx.stroke();

    ctx.strokeStyle = "rgba(152, 227, 255, 0.65)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(strike.x, 0);
    ctx.lineTo(strike.x, WORLD_HEIGHT);
    ctx.stroke();
  }
}

function drawMeteors() {
  for (const meteor of meteors) {
    const pulse = 0.55 + Math.sin(elapsed * 10) * 0.18;
    const zoneSize = meteor.radius * 2;

    ctx.strokeStyle = `rgba(255, 120, 72, ${meteor.active ? 0.4 : 0.75 + pulse * 0.2})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(meteor.x - meteor.radius, meteor.y - meteor.radius, zoneSize, zoneSize);

    ctx.fillStyle = `rgba(255, 92, 54, ${meteor.active ? 0.2 : 0.12 + pulse * 0.12})`;
    ctx.fillRect(meteor.x - meteor.radius, meteor.y - meteor.radius, zoneSize, zoneSize);

    if (!meteor.active) {
      continue;
    }

    const fallProgress = 1 - meteor.timer / meteor.fallDuration;
    const skyOffset = (1 - fallProgress) * 58;
    const meteorRadius = 4 + fallProgress * 6;
    const meteorX = meteor.x;
    const meteorY = meteor.y - skyOffset;

    ctx.strokeStyle = "rgba(255, 244, 190, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(meteorX - 10, meteorY - 10);
    ctx.lineTo(meteorX - 2, meteorY - 2);
    ctx.stroke();

    ctx.fillStyle = "#ffb15e";
    ctx.beginPath();
    ctx.arc(meteorX, meteorY, meteorRadius, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "#fff0bf";
    ctx.beginPath();
    ctx.arc(meteorX - 2, meteorY - 2, Math.max(2, meteorRadius * 0.35), 0, TAU);
    ctx.fill();
  }
}

function drawBossTelegraphs() {
  const boss = getBoss();
  if (!boss || boss.bossKind !== "iron") {
    return;
  }

  if (bossShieldActive()) {
    ctx.strokeStyle = "rgba(255, 224, 164, 0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, 84, 0, TAU);
    ctx.stroke();
    return;
  }

  if (!bossAttackType || bossAttackWindup <= 0) {
    return;
  }

  const alpha = 0.18 + (1 - bossAttackWindup / (bossAttackType === "forward" ? 0.95 : bossAttackType === "targeted" ? 0.8 : 1.05)) * 0.24;
  ctx.fillStyle = `rgba(255, 92, 92, ${alpha})`;

  if (bossAttackType === "left") {
    ctx.fillRect(0, 0, WORLD_WIDTH / 2, WORLD_HEIGHT);
    return;
  }

  if (bossAttackType === "right") {
    ctx.fillRect(WORLD_WIDTH / 2, 0, WORLD_WIDTH / 2, WORLD_HEIGHT);
    return;
  }

  const attackRange = bossAttackType === "forward" ? 104 : 80;
  const arc = bossAttackType === "forward" ? 0.42 : 0.52;
  ctx.beginPath();
  ctx.moveTo(boss.x, boss.y);
  ctx.arc(boss.x, boss.y, attackRange, bossAttackAngle - arc, bossAttackAngle + arc);
  ctx.closePath();
  ctx.fill();
}

function drawBossHud() {
  const boss = getBoss();
  if (!boss) {
    return;
  }

  ctx.fillStyle = "rgba(12, 14, 20, 0.78)";
  ctx.fillRect(WORLD_WIDTH / 2 - 112, 8, 224, 18);
  ctx.fillStyle = "#ffd4d4";
  ctx.font = "bold 9px monospace";
  ctx.fillText(boss.bossKind === "skull" ? "SKULL LORD" : "IRON HELMET", WORLD_WIDTH / 2 - 28, 16);
  ctx.fillStyle = "#633333";
  ctx.fillRect(WORLD_WIDTH / 2 - 100, 18, 200, 6);
  ctx.fillStyle = "#ff6e6e";
  ctx.fillRect(WORLD_WIDTH / 2 - 100, 18, 200 * (boss.hp / boss.maxHp), 6);
}

function drawBurningFloors() {
  for (const floor of burningFloors) {
    const progress = floor.timer / floor.maxTimer;
    const zoneSize = floor.radius * 2;
    const flicker = 0.7 + Math.sin(elapsed * 18 + floor.x * 0.1) * 0.18;

    ctx.fillStyle = `rgba(255, 110, 36, ${0.24 + flicker * 0.16 * progress})`;
    ctx.fillRect(floor.x - floor.radius, floor.y - floor.radius, zoneSize, zoneSize);

    ctx.strokeStyle = `rgba(255, 214, 120, ${0.4 + progress * 0.35})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(floor.x - floor.radius, floor.y - floor.radius, zoneSize, zoneSize);

    for (let i = 0; i < 4; i += 1) {
      const flameX = floor.x - floor.radius + 5 + i * 8;
      const flameY = floor.y + floor.radius - 4 - ((i + Math.floor(elapsed * 10)) % 2) * 5;
      ctx.fillStyle = `rgba(255, 188, 92, ${0.45 + progress * 0.35})`;
      ctx.fillRect(flameX, flameY - 5, 4, 5);
      ctx.fillStyle = `rgba(255, 82, 34, ${0.4 + progress * 0.3})`;
      ctx.fillRect(flameX + 1, flameY - 8, 2, 3);
    }
  }
}

function drawMedkits() {
  for (const medkit of medkits) {
    ctx.fillStyle = "#f4ead0";
    ctx.fillRect(medkit.x - 5, medkit.y - 5, 10, 10);
    ctx.fillStyle = "#ff5a5a";
    ctx.fillRect(medkit.x - 2, medkit.y - 5, 4, 10);
    ctx.fillRect(medkit.x - 5, medkit.y - 2, 10, 4);
  }
}

function drawShieldPickups() {
  for (const shieldPickup of shieldPickups) {
    ctx.strokeStyle = "#9ad3ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(shieldPickup.x, shieldPickup.y, 6, 0, TAU);
    ctx.stroke();

    ctx.strokeStyle = "#dff6ff";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(shieldPickup.x, shieldPickup.y, 3, 0, TAU);
    ctx.stroke();
  }
}

function drawStars() {
  for (const star of stars) {
    ctx.fillStyle = star.color === "blue" ? "#5fc1ff" : "#ff6b6b";
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const angle = -Math.PI / 2 + i * (Math.PI / 5);
      const radius = i % 2 === 0 ? 8 : 4;
      const px = star.x + Math.cos(angle) * radius;
      const py = star.y + Math.sin(angle) * radius;
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#dff5ff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawExplosions() {
  for (const explosion of explosions) {
    const progress = explosion.timer / explosion.maxTimer;
    const radius = explosion.radius * (1 - progress * 0.55);

    ctx.fillStyle = `rgba(255, 164, 64, ${0.35 + progress * 0.3})`;
    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, radius, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 245, 186, ${0.5 + progress * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, radius * 0.6, 0, TAU);
    ctx.stroke();
  }
}

function drawBullets() {
  for (const bullet of bullets) {
    ctx.fillStyle = bullet.isCrit ? "#fff17a" : bullet.color;
    ctx.fillRect(
      bullet.x - bullet.size / 2,
      bullet.y - bullet.size / 2,
      bullet.size,
      bullet.size
    );
  }
}

function getMobileWeaponButtonRect(index: number) {
  const width = 86;
  const height = 14;
  const gap = 4;
  const totalWidth = weaponOrder.length * width + (weaponOrder.length - 1) * gap;
  const startX = Math.round((WORLD_WIDTH - totalWidth) / 2);
  const y = WORLD_HEIGHT - 38;

  return {
    x: startX + index * (width + gap),
    y,
    width,
    height
  };
}

function getMobileRageButtonRect() {
  return {
    x: WORLD_WIDTH - 70,
    y: 30,
    width: 58,
    height: 18
  };
}

async function toggleFullscreen() {
  const fullscreenTarget = canvas as HTMLCanvasElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  const fullscreenDocument = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
  };

  if (document.fullscreenElement) {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
    } else {
      await fullscreenDocument.webkitExitFullscreen?.();
    }
    return;
  }

  if (canvas.requestFullscreen) {
    await canvas.requestFullscreen();
  } else {
    await fullscreenTarget.webkitRequestFullscreen?.();
  }
}

function tryEnterMobileFullscreen() {
  if (!touchControls.enabled || mobileFullscreenAttempted || document.fullscreenElement) {
    return;
  }

  mobileFullscreenAttempted = true;
  void toggleFullscreen().catch(() => {
    mobileFullscreenAttempted = false;
  });
}

function drawHud() {
  const player = fighters.find((fighter) => fighter.team === "player");
  if (!player) {
    return;
  }

  const unlockedWeapons = getUnlockedWeapons(player.score);
  const minutes = Math.floor(survivalWithoutDeath / 60);
  const seconds = Math.floor(survivalWithoutDeath % 60);
  const progressBar = getProgressBarState();
  const progressX = 8;
  const progressY = 4;
  const progressWidth = WORLD_WIDTH - 16;
  const progressHeight = 10;

  ctx.fillStyle = "rgba(10, 12, 18, 0.88)";
  ctx.fillRect(progressX, progressY, progressWidth, progressHeight);
  ctx.fillStyle = progressBar.fill;
  ctx.fillRect(progressX + 1, progressY + 1, (progressWidth - 2) * progressBar.progress, progressHeight - 2);
  ctx.strokeStyle = "rgba(255, 240, 204, 0.26)";
  ctx.lineWidth = 1;
  ctx.strokeRect(progressX + 0.5, progressY + 0.5, progressWidth - 1, progressHeight - 1);

  const milestone15 = progressX + progressWidth * 0.25;
  const milestone30 = progressX + progressWidth * 0.5;
  const milestone45 = progressX + progressWidth * 0.75;
  const milestone60 = progressX + progressWidth;

  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.beginPath();
  ctx.moveTo(milestone15, progressY + 1);
  ctx.lineTo(milestone15, progressY + progressHeight - 1);
  ctx.moveTo(milestone30, progressY + 1);
  ctx.lineTo(milestone30, progressY + progressHeight - 1);
  ctx.moveTo(milestone45, progressY + 1);
  ctx.lineTo(milestone45, progressY + progressHeight - 1);
  ctx.stroke();

  ctx.fillStyle = "#fff1da";
  ctx.font = "bold 7px monospace";
  ctx.fillText(progressBar.label, progressX + 5, progressY + 8);
  ctx.fillText("15", milestone15 - 5, progressY + 18);
  ctx.fillText("30", milestone30 - 5, progressY + 18);
  ctx.fillText("45", milestone45 - 5, progressY + 18);
  ctx.fillText("60", milestone60 - 5, progressY + 18);

  ctx.fillStyle = "rgba(14, 16, 24, 0.72)";
  ctx.fillRect(8, 24, 126, 106);

  ctx.fillStyle = "#f5e7c8";
  ctx.font = "bold 8px monospace";
  ctx.fillText(`HP ${Math.ceil(player.hp)}`, 14, 34);
  ctx.fillText(`Score ${player.score}`, 14, 44);
  ctx.fillText(getActivePlayerWeapon(player).toUpperCase(), 14, 54);
  ctx.fillText(`CRIT ${Math.round(player.critChance * 100)}%`, 14, 64);
  ctx.fillText(`DMG x${player.damageMultiplier.toFixed(1)}`, 14, 74);
  ctx.fillText(`SHLD ${player.shieldCount}`, 14, 84);
  ctx.fillText(`RAGE ${Math.round(player.rageCharge)}%`, 14, 94);
  ctx.fillText(`TIME ${minutes}:${seconds.toString().padStart(2, "0")}`, 14, 104);
  ctx.fillText(getPhaseLabel(), 14, 114);

  if (player.shieldTimer > 0) {
    ctx.fillStyle = "rgba(95, 193, 255, 0.3)";
    ctx.fillRect(142, 24, 70, 12);
    ctx.fillStyle = "#dff6ff";
    ctx.fillText(`SHIELD ${player.shieldTimer.toFixed(1)}s`, 146, 34);
  }

  const rageRect = touchControls.enabled ? getMobileRageButtonRect() : { x: 142, y: 40, width: 70, height: 12 };
  ctx.fillStyle = "rgba(255, 110, 90, 0.22)";
  ctx.fillRect(rageRect.x, rageRect.y, rageRect.width, rageRect.height);
  ctx.fillStyle = "rgba(255, 110, 90, 0.82)";
  ctx.fillRect(
    rageRect.x,
    rageRect.y,
    rageRect.width * (player.rageTimer > 0 ? player.rageTimer / 10 : player.rageCharge / 100),
    rageRect.height
  );
  ctx.fillStyle = "#fff1da";
  if (touchControls.enabled) {
    ctx.font = "bold 7px monospace";
    ctx.fillText(
      player.rageTimer > 0 ? `RAGE ${player.rageTimer.toFixed(1)}`
      : player.rageCooldown > 0 ? `CD ${player.rageCooldown.toFixed(1)}`
      : "RAGE",
      rageRect.x + 6,
      rageRect.y + 7
    );
  } else {
    ctx.fillText(
      player.rageTimer > 0
        ? `RAGE ${player.rageTimer.toFixed(1)}s`
        : player.rageCooldown > 0
          ? `CD ${player.rageCooldown.toFixed(1)}s`
          : "SPACE RAGE",
      146,
      50
    );
  }

  const barY = touchControls.enabled ? WORLD_HEIGHT - 38 : WORLD_HEIGHT - 22;
  const startX = touchControls.enabled ? 0 : 14;
  const width = touchControls.enabled ? 86 : 84;
  const gap = touchControls.enabled ? 4 : 6;
  ctx.font = "bold 7px monospace";

  weaponOrder.forEach((weapon, index) => {
    const rect = touchControls.enabled
      ? getMobileWeaponButtonRect(index)
      : { x: startX + index * (width + gap), y: barY, width, height: 14 };
    const x = rect.x;
    const unlocked = unlockedWeapons.includes(weapon);
    const selected = weapon === getActivePlayerWeapon(player);

    ctx.fillStyle = selected ? "rgba(255, 186, 83, 0.92)" : unlocked ? "rgba(18, 24, 38, 0.86)" : "rgba(18, 24, 38, 0.42)";
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.strokeStyle = selected ? "#fff0b8" : unlocked ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1);

    ctx.fillStyle = selected ? "#3e2410" : unlocked ? "#f5e7c8" : "rgba(245, 231, 200, 0.4)";
    const threshold = weapon === "pistol" ? 0 : weapon === "smg" ? 5 : weapon === "shotgun" ? 10 : weapon === "rifle" ? 15 : 20;
    ctx.fillText(`${index + 1}.${weapon.toUpperCase()} ${threshold}`, x + 5, rect.y + 9);
  });

  if (player.respawn > 0) {
    ctx.fillStyle = "rgba(18, 10, 20, 0.8)";
    ctx.fillRect(WORLD_WIDTH / 2 - 76, WORLD_HEIGHT / 2 - 17, 152, 34);
    ctx.fillStyle = "#fff1da";
    ctx.font = "bold 10px monospace";
    ctx.fillText(`RESPAWN ${player.respawn.toFixed(1)}s`, WORLD_WIDTH / 2 - 58, WORLD_HEIGHT / 2 + 3);
  }
}

function drawPauseOverlay() {
  if (!isPaused) {
    return;
  }

  ctx.fillStyle = "rgba(10, 12, 18, 0.55)";
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  if (showRulesMenu) {
    const panelX = WORLD_WIDTH / 2 - 150;
    const panelY = WORLD_HEIGHT / 2 - 74;
    const panelW = 300;
    const panelH = 148;
    const contentTop = WORLD_HEIGHT / 2 - 38;
    const visibleHeight = 90;
    const lineHeight = 14;
    const maxScroll = Math.max(0, rulesLines.length * lineHeight - visibleHeight);

    ctx.fillStyle = "rgba(18, 24, 38, 0.95)";
    ctx.fillRect(panelX, panelY, panelW, panelH);

    ctx.strokeStyle = "rgba(95, 193, 255, 0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.fillStyle = "#fff1da";
    ctx.font = "bold 15px Arial";
    ctx.fillText("RULES", WORLD_WIDTH / 2 - 20, WORLD_HEIGHT / 2 - 55);
    ctx.font = "9px Arial";

    ctx.save();
    ctx.beginPath();
    ctx.rect(WORLD_WIDTH / 2 - 140, contentTop - 8, 268, visibleHeight);
    ctx.clip();
    rulesLines.forEach((line, index) => {
      ctx.fillText(line, WORLD_WIDTH / 2 - 138, contentTop + index * lineHeight - rulesScroll);
    });
    ctx.restore();

    if (maxScroll > 0) {
      const trackX = WORLD_WIDTH / 2 + 132;
      const trackY = contentTop - 8;
      const trackH = visibleHeight;
      const thumbH = Math.max(18, (visibleHeight / (rulesLines.length * lineHeight)) * trackH);
      const thumbY = trackY + (rulesScroll / maxScroll) * (trackH - thumbH);

      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(trackX, trackY, 6, trackH);
      ctx.fillStyle = "rgba(95, 193, 255, 0.8)";
      ctx.fillRect(trackX, thumbY, 6, thumbH);
    }

    ctx.fillStyle = "rgba(255, 186, 83, 0.92)";
    ctx.fillRect(WORLD_WIDTH / 2 - 46, WORLD_HEIGHT / 2 + 52, 92, 14);
    ctx.fillStyle = "#3e2410";
    ctx.font = "bold 11px Arial";
    ctx.fillText("BACK", WORLD_WIDTH / 2 - 12, WORLD_HEIGHT / 2 + 61);
    return;
  }

  ctx.fillStyle = "rgba(18, 24, 38, 0.92)";
  ctx.fillRect(WORLD_WIDTH / 2 - 78, WORLD_HEIGHT / 2 - 34, 156, 68);

  ctx.strokeStyle = "rgba(255, 240, 184, 0.4)";
  ctx.lineWidth = 2;
  ctx.strokeRect(WORLD_WIDTH / 2 - 78, WORLD_HEIGHT / 2 - 34, 156, 68);

  ctx.fillStyle = "#fff1da";
  ctx.font = "bold 14px monospace";
  ctx.fillText("PAUSED", WORLD_WIDTH / 2 - 27, WORLD_HEIGHT / 2 - 12);
  ctx.font = "bold 8px monospace";
  ctx.fillText("PRESS P OR ESC", WORLD_WIDTH / 2 - 43, WORLD_HEIGHT / 2 + 6);

  ctx.fillStyle = "rgba(95, 193, 255, 0.92)";
  ctx.fillRect(WORLD_WIDTH / 2 - 34, WORLD_HEIGHT / 2 + 14, 68, 14);
  ctx.fillStyle = "#102234";
  ctx.fillText("RULES", WORLD_WIDTH / 2 - 15, WORLD_HEIGHT / 2 + 23);
}

function drawTouchControls() {
  if (!touchControls.enabled) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = 0.85;

  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(touchControls.moveBaseX, touchControls.moveBaseY, 24, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(touchControls.aimBaseX, touchControls.aimBaseY, 24, 0, TAU);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
  ctx.beginPath();
  ctx.arc(touchControls.moveBaseX, touchControls.moveBaseY, 11, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(touchControls.aimBaseX, touchControls.aimBaseY, 11, 0, TAU);
  ctx.fill();

  ctx.fillStyle = "rgba(95, 193, 255, 0.35)";
  ctx.beginPath();
  ctx.arc(touchControls.moveStickX, touchControls.moveStickY, 9, 0, TAU);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 120, 120, 0.35)";
  ctx.beginPath();
  ctx.arc(touchControls.aimStickX, touchControls.aimStickY, 9, 0, TAU);
  ctx.fill();

  ctx.restore();
}

function render() {
  drawArena();
  drawSpawnWarnings();
  drawMedkits();
  drawShieldPickups();
  drawStars();
  drawBullets();
  drawExplosions();
  drawLightning();
  drawMeteors();
  drawBurningFloors();
  drawBossTelegraphs();
  fighters.forEach(drawFighter);
  drawHud();
  drawBossHud();
  drawTouchControls();
  drawPauseOverlay();
}

let previous = performance.now();

function frame(now: number) {
  const dt = Math.min(0.033, (now - previous) / 1000);
  previous = now;
  if (!isPaused) {
    update(dt);
  }
  render();
  requestAnimationFrame(frame);
}

function getCanvasPoint(clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = WORLD_WIDTH / rect.width;
  const scaleY = WORLD_HEIGHT / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

function updateMousePosition(event: MouseEvent) {
  const point = getCanvasPoint(event.clientX, event.clientY);
  input.mouseX = point.x;
  input.mouseY = point.y;
}

function isInsideRect(x: number, y: number, rectX: number, rectY: number, width: number, height: number) {
  return x >= rectX && x <= rectX + width && y >= rectY && y <= rectY + height;
}

function setMovementKey(code: string, isPressed: boolean) {
  if (code === "KeyW" || code === "ArrowUp") input.up = isPressed;
  if (code === "KeyS" || code === "ArrowDown") input.down = isPressed;
  if (code === "KeyA" || code === "ArrowLeft") input.left = isPressed;
  if (code === "KeyD" || code === "ArrowRight") input.right = isPressed;
}

function resetMovementInputState() {
  input.up = false;
  input.down = false;
  input.left = false;
  input.right = false;
  input.moveX = 0;
  input.moveY = 0;
  resetTouchMovement();
}

function trySelectWeapon(slot: number) {
  const player = fighters.find((fighter) => fighter.team === "player");
  if (!player) {
    return;
  }

  const weapon = weaponOrder[slot];
  if (!weapon) {
    return;
  }

  if (getUnlockedWeapons(player.score).includes(weapon)) {
    selectedWeapon = weapon;
  }
}

function togglePause() {
  isPaused = !isPaused;
  if (isPaused) {
    input.shoot = false;
  } else {
    showRulesMenu = false;
    rulesScroll = 0;
  }
}

function updateTouchMovement(clientX: number, clientY: number) {
  const point = getCanvasPoint(clientX, clientY);
  const dx = point.x - touchControls.moveBaseX;
  const dy = point.y - touchControls.moveBaseY;
  const maxDistance = 24;
  const distance = Math.hypot(dx, dy);
  const limited = distance > maxDistance ? maxDistance / distance : 1;

  touchControls.moveStickX = touchControls.moveBaseX + dx * limited;
  touchControls.moveStickY = touchControls.moveBaseY + dy * limited;
  input.moveX = clamp(dx / maxDistance, -1, 1);
  input.moveY = clamp(dy / maxDistance, -1, 1);
}

function updateTouchAim(clientX: number, clientY: number) {
  const point = getCanvasPoint(clientX, clientY);
  const dx = point.x - touchControls.aimBaseX;
  const dy = point.y - touchControls.aimBaseY;
  const maxDistance = 24;
  const distance = Math.hypot(dx, dy);
  const limited = distance > maxDistance ? maxDistance / distance : 1;

  touchControls.aimStickX = touchControls.aimBaseX + dx * limited;
  touchControls.aimStickY = touchControls.aimBaseY + dy * limited;

  if (distance > 3) {
    const aimX = dx / distance;
    const aimY = dy / distance;
    const player = fighters.find((fighter) => fighter.team === "player" && fighter.respawn <= 0);

    if (player) {
      input.mouseX = player.x + aimX * 48;
      input.mouseY = player.y + aimY * 48;
    } else {
      input.mouseX = point.x;
      input.mouseY = point.y;
    }

    input.shoot = true;
  } else {
    input.shoot = false;
  }
}

function resetTouchMovement() {
  input.moveX = 0;
  input.moveY = 0;
  touchControls.moveId = -1;
  touchControls.moveBaseX = 70;
  touchControls.moveBaseY = WORLD_HEIGHT - 72;
  touchControls.moveStickX = touchControls.moveBaseX;
  touchControls.moveStickY = touchControls.moveBaseY;
}

function resetTouchAim() {
  input.shoot = false;
  touchControls.aimId = -1;
  touchControls.aimBaseX = WORLD_WIDTH - 70;
  touchControls.aimBaseY = WORLD_HEIGHT - 72;
  touchControls.aimStickX = touchControls.aimBaseX;
  touchControls.aimStickY = touchControls.aimBaseY;
}

function handleTouchPress(clientX: number, clientY: number) {
  const point = getCanvasPoint(clientX, clientY);

  if (isPaused) {
    rulesTouchY = point.y;
    input.mouseX = point.x;
    input.mouseY = point.y;
    if (
      showRulesMenu &&
      isInsideRect(point.x, point.y, WORLD_WIDTH / 2 - 46, WORLD_HEIGHT / 2 + 52, 92, 14)
    ) {
      showRulesMenu = false;
    } else if (
      !showRulesMenu &&
      isInsideRect(point.x, point.y, WORLD_WIDTH / 2 - 34, WORLD_HEIGHT / 2 + 14, 68, 14)
    ) {
      showRulesMenu = true;
    }
    return true;
  }

  if (touchControls.enabled) {
    const rageRect = getMobileRageButtonRect();
    if (isInsideRect(point.x, point.y, rageRect.x, rageRect.y, rageRect.width, rageRect.height)) {
      const player = fighters.find((fighter) => fighter.team === "player" && fighter.respawn <= 0);
      if (player) {
        activateRage(player);
      }
      return true;
    }

    for (let index = 0; index < weaponOrder.length; index += 1) {
      const rect = getMobileWeaponButtonRect(index);
      if (isInsideRect(point.x, point.y, rect.x, rect.y, rect.width, rect.height)) {
        trySelectWeapon(index);
        return true;
      }
    }
  }

  return false;
}

window.addEventListener("keydown", (event) => {
  if (event.repeat) {
    return;
  }

  if (event.code === "BracketLeft") {
    stepDevStage(-1);
    event.preventDefault();
    return;
  }

  if (event.code === "BracketRight") {
    stepDevStage(1);
    event.preventDefault();
    return;
  }

  if (event.code === "Backslash") {
    devInfiniteHealth = !devInfiniteHealth;
    const player = fighters.find((fighter) => fighter.team === "player" && fighter.respawn <= 0);
    if (devInfiniteHealth && player) {
      player.hp = player.maxHp;
    }
    event.preventDefault();
    return;
  }

  if (event.code === "KeyP" || event.code === "Escape") {
    togglePause();
    event.preventDefault();
    return;
  }

  setMovementKey(event.code, true);
  if (event.code === "KeyE") {
    const player = fighters.find((fighter) => fighter.team === "player" && fighter.respawn <= 0);
    if (player && !isPaused) {
      activateShield(player);
    }
  }
  if (event.code === "Space") {
    const player = fighters.find((fighter) => fighter.team === "player" && fighter.respawn <= 0);
    if (player && !isPaused) {
      activateRage(player);
    }
    event.preventDefault();
  }
  if (event.code === "Digit1") trySelectWeapon(0);
  if (event.code === "Digit2") trySelectWeapon(1);
  if (event.code === "Digit3") trySelectWeapon(2);
  if (event.code === "Digit4") trySelectWeapon(3);
  if (event.code === "Digit5") trySelectWeapon(4);

  if (event.code.startsWith("Arrow") || event.code.startsWith("Key")) {
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  setMovementKey(event.code, false);

  if (event.code.startsWith("Arrow") || event.code.startsWith("Key")) {
    event.preventDefault();
  }
});
window.addEventListener("blur", () => {
  resetMovementInputState();
  input.shoot = false;
});

canvas.addEventListener("wheel", (event) => {
  if (!isPaused || !showRulesMenu) {
    return;
  }

  const lineHeight = 14;
  const visibleHeight = 90;
  const maxScroll = Math.max(0, rulesLines.length * lineHeight - visibleHeight);
  rulesScroll = Math.max(0, Math.min(maxScroll, rulesScroll + Math.sign(event.deltaY) * 6));
  event.preventDefault();
}, { passive: false });

canvas.addEventListener("mousemove", updateMousePosition);
canvas.addEventListener("mousedown", (event) => {
  ensureAudio();
  audioContext?.resume();

  updateMousePosition(event);

  if (isPaused) {
    if (
      showRulesMenu &&
      isInsideRect(input.mouseX, input.mouseY, WORLD_WIDTH / 2 - 46, WORLD_HEIGHT / 2 + 52, 92, 14)
    ) {
      showRulesMenu = false;
    } else if (
      !showRulesMenu &&
      isInsideRect(input.mouseX, input.mouseY, WORLD_WIDTH / 2 - 34, WORLD_HEIGHT / 2 + 14, 68, 14)
    ) {
      showRulesMenu = true;
    }
    return;
  }

  input.shoot = true;
});
canvas.addEventListener("touchstart", (event) => {
  ensureAudio();
  audioContext?.resume();
  touchControls.enabled = true;

  let consumedAnyTouch = false;

  for (const touch of event.changedTouches) {
    const point = getCanvasPoint(touch.clientX, touch.clientY);
    const consumed = handleTouchPress(touch.clientX, touch.clientY);
    consumedAnyTouch = consumedAnyTouch || consumed;

    if (isPaused || consumed) {
      continue;
    }

    if (touchControls.moveId === -1 && point.x <= WORLD_WIDTH / 2) {
      touchControls.moveId = touch.identifier;
      touchControls.moveBaseX = point.x;
      touchControls.moveBaseY = point.y;
      touchControls.moveStickX = point.x;
      touchControls.moveStickY = point.y;
      input.moveX = 0;
      input.moveY = 0;
    } else if (touchControls.aimId === -1 && point.x > WORLD_WIDTH / 2) {
      touchControls.aimId = touch.identifier;
      touchControls.aimBaseX = point.x;
      touchControls.aimBaseY = point.y;
      touchControls.aimStickX = point.x;
      touchControls.aimStickY = point.y;
      updateTouchAim(touch.clientX, touch.clientY);
    }
  }

  if (!consumedAnyTouch) {
    tryEnterMobileFullscreen();
  }

  event.preventDefault();
}, { passive: false });
canvas.addEventListener("touchmove", (event) => {
  touchControls.enabled = true;

  if (isPaused && showRulesMenu) {
    const touch = event.changedTouches[0];
    if (touch) {
      const point = getCanvasPoint(touch.clientX, touch.clientY);
      if (rulesTouchY !== null) {
        const lineHeight = 14;
        const visibleHeight = 90;
        const maxScroll = Math.max(0, rulesLines.length * lineHeight - visibleHeight);
        rulesScroll = clamp(rulesScroll - (point.y - rulesTouchY), 0, maxScroll);
      }
      rulesTouchY = point.y;
    }
    event.preventDefault();
    return;
  }

  for (const touch of event.changedTouches) {
    if (touch.identifier === touchControls.moveId) {
      updateTouchMovement(touch.clientX, touch.clientY);
    }
    if (touch.identifier === touchControls.aimId) {
      updateTouchAim(touch.clientX, touch.clientY);
    }
  }

  event.preventDefault();
}, { passive: false });

function releaseTouch(identifier: number) {
  rulesTouchY = null;
  if (identifier === touchControls.moveId) {
    resetTouchMovement();
  }
  if (identifier === touchControls.aimId) {
    resetTouchAim();
  }
}

function saveRuntimeSnapshot() {
  const snapshot: RuntimeSnapshot = {
    fighters: structuredClone(fighters),
    bullets: structuredClone(bullets),
    lightningStrikes: structuredClone(lightningStrikes),
    meteors: structuredClone(meteors),
    burningFloors: structuredClone(burningFloors),
    medkits: structuredClone(medkits),
    stars: structuredClone(stars),
    shieldPickups: structuredClone(shieldPickups),
    explosions: structuredClone(explosions),
    nextId,
    elapsed,
    lightningCooldown,
    meteorCooldown,
    medkitCooldown,
    starCooldown,
    shieldPickupCooldown,
    selectedWeapon,
    highestUnlockedWeapon,
    isPaused,
    showRulesMenu,
    rulesScroll,
    mobileFullscreenAttempted,
    pendingRunReset,
    devInfiniteHealth,
    survivalWithoutDeath,
    bossFightStarted,
    bossFightWon,
    bossIntroTimer,
    bossAttackType,
    bossAttackWindup,
    bossAttackActive,
    bossAttackRecover,
    bossAttackIndex,
    bossAttackAngle,
    bossAttackHitApplied,
    bossSpinDamageTick,
    bossSwordContactTick,
    skullBossActionTimer,
    skullBossActionIndex,
    skullBossBurstShotsLeft,
    skullBossBurstWindup,
    bossesDefeated
  };

  sessionStorage.setItem(LIVE_RELOAD_STATE_KEY, JSON.stringify(snapshot));
}

function restoreRuntimeSnapshot() {
  const raw = sessionStorage.getItem(LIVE_RELOAD_STATE_KEY);
  if (!raw) {
    return false;
  }

  try {
    const snapshot = JSON.parse(raw) as RuntimeSnapshot;
    if (!Array.isArray(snapshot.fighters) || !Array.isArray(snapshot.bullets)) {
      return false;
    }

    fighters.length = 0;
    fighters.push(...snapshot.fighters);
    bullets.length = 0;
    bullets.push(...snapshot.bullets);
    lightningStrikes.length = 0;
    lightningStrikes.push(...snapshot.lightningStrikes);
    meteors.length = 0;
    meteors.push(...snapshot.meteors);
    burningFloors.length = 0;
    burningFloors.push(...snapshot.burningFloors);
    medkits.length = 0;
    medkits.push(...snapshot.medkits);
    stars.length = 0;
    stars.push(...snapshot.stars);
    shieldPickups.length = 0;
    shieldPickups.push(...snapshot.shieldPickups);
    explosions.length = 0;
    explosions.push(...snapshot.explosions);

    nextId = snapshot.nextId;
    elapsed = snapshot.elapsed;
    lightningCooldown = snapshot.lightningCooldown;
    meteorCooldown = snapshot.meteorCooldown;
    medkitCooldown = snapshot.medkitCooldown;
    starCooldown = snapshot.starCooldown;
    shieldPickupCooldown = snapshot.shieldPickupCooldown;
    selectedWeapon = snapshot.selectedWeapon;
    highestUnlockedWeapon = snapshot.highestUnlockedWeapon;
    isPaused = snapshot.isPaused;
    showRulesMenu = snapshot.showRulesMenu;
    rulesScroll = snapshot.rulesScroll;
    mobileFullscreenAttempted = snapshot.mobileFullscreenAttempted;
    pendingRunReset = snapshot.pendingRunReset;
    devInfiniteHealth = snapshot.devInfiniteHealth;
    survivalWithoutDeath = snapshot.survivalWithoutDeath;
    bossFightStarted = snapshot.bossFightStarted;
    bossFightWon = snapshot.bossFightWon;
    bossIntroTimer = snapshot.bossIntroTimer;
    bossAttackType = snapshot.bossAttackType;
    bossAttackWindup = snapshot.bossAttackWindup;
    bossAttackActive = snapshot.bossAttackActive;
    bossAttackRecover = snapshot.bossAttackRecover;
    bossAttackIndex = snapshot.bossAttackIndex;
    bossAttackAngle = snapshot.bossAttackAngle;
    bossAttackHitApplied = snapshot.bossAttackHitApplied;
    bossSpinDamageTick = snapshot.bossSpinDamageTick;
    bossSwordContactTick = snapshot.bossSwordContactTick;
    skullBossActionTimer = snapshot.skullBossActionTimer;
    skullBossActionIndex = snapshot.skullBossActionIndex;
    skullBossBurstShotsLeft = snapshot.skullBossBurstShotsLeft;
    skullBossBurstWindup = snapshot.skullBossBurstWindup;
    bossesDefeated = snapshot.bossesDefeated;
    return true;
  } catch {
    return false;
  }
}

canvas.addEventListener("touchend", (event) => {
  for (const touch of event.changedTouches) {
    releaseTouch(touch.identifier);
  }
  event.preventDefault();
}, { passive: false });
canvas.addEventListener("touchcancel", (event) => {
  for (const touch of event.changedTouches) {
    releaseTouch(touch.identifier);
  }
  event.preventDefault();
}, { passive: false });
window.addEventListener("keydown", () => {
  ensureAudio();
  audioContext?.resume();
}, { once: true });
window.addEventListener("mouseup", () => {
  input.shoot = false;
});

window.addEventListener("beforeunload", () => {
  saveRuntimeSnapshot();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    resetMovementInputState();
    input.shoot = false;
    saveRuntimeSnapshot();
  }
});

if (!restoreRuntimeSnapshot()) {
  spawnRoster();
}
render();
requestAnimationFrame(frame);
