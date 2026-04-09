import "./style.css";

const canvas = document.querySelector<HTMLCanvasElement>("#game");

if (!canvas) {
  throw new Error("Canvas element not found");
}

const ctx = canvas.getContext("2d");

if (!ctx) {
  throw new Error("2D context not available");
}

const WORLD_WIDTH = 480;
const WORLD_HEIGHT = 270;
const TAU = Math.PI * 2;
const AudioContextClass = window.AudioContext || (window as typeof window & {
  webkitAudioContext?: typeof AudioContext;
}).webkitAudioContext;

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

type Medkit = {
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

const input = {
  up: false,
  down: false,
  left: false,
  right: false,
  shoot: false,
  mouseX: WORLD_WIDTH / 2,
  mouseY: WORLD_HEIGHT / 2
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
let medkitCooldown = 4.5;
const medkits: Medkit[] = [];
const explosions: Explosion[] = [];
const weaponOrder: WeaponType[] = ["pistol", "shotgun", "smg", "rifle", "bazooka"];
let selectedWeapon: WeaponType = "pistol";
const spawnPoints = [
  { x: 42, y: 38 },
  { x: 120, y: 92 },
  { x: 438, y: 42 },
  { x: 438, y: 228 },
  { x: 42, y: 228 },
  { x: 250, y: 220 }
];

const palette = [
  ["#57d7ff", "#dffaff"],
  ["#ff8a5b", "#ffe0c4"],
  ["#ff5f8c", "#ffd6e4"],
  ["#96e072", "#edffd9"]
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
    spawnY: y
  };
}

function spawnRoster() {
  fighters.length = 0;
  bullets.length = 0;
  fighters.push(createFighter(spawnPoints[0].x, spawnPoints[0].y, true, 0));
  fighters.push(createFighter(spawnPoints[1].x, spawnPoints[1].y, false, 1));
  fighters.push(createFighter(spawnPoints[2].x, spawnPoints[2].y, false, 2));
  fighters.push(createFighter(spawnPoints[3].x, spawnPoints[3].y, false, 3));
  fighters.push(createFighter(spawnPoints[4].x, spawnPoints[4].y, false, 1));
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
  return (
    x - radius > 8 &&
    x + radius < WORLD_WIDTH - 8 &&
    y - radius > 8 &&
    y + radius < WORLD_HEIGHT - 8 &&
    !intersectsWall(x, y, radius)
  );
}

function respawn(fighter: Fighter) {
  const safePoints = spawnPoints.filter((point) => canMoveTo(point.x, point.y, fighter.radius));
  const pool = safePoints.length > 0 ? safePoints : spawnPoints;
  const point = pool[Math.floor(Math.random() * pool.length)];
  fighter.spawnX = point.x;
  fighter.spawnY = point.y;
  fighter.x = point.x;
  fighter.y = point.y;
  fighter.vx = 0;
  fighter.vy = 0;
  fighter.hp = fighter.maxHp;
  fighter.respawn = 0;
  fighter.attackCooldown = 0;
  if (!fighter.isPlayer) {
    fighter.archetype = Math.random() < 0.8 ? "melee" : "ranged";
  }
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

function playPickupSound() {
  playTone("triangle", 480, 0.08, 0.03, 740);
}

function getPlayerWeapon(score: number): WeaponType {
  if (score >= 20) return "bazooka";
  if (score >= 15) return "rifle";
  if (score >= 10) return "smg";
  if (score >= 5) return "shotgun";
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
  bullets.push({
    x: fighter.x + Math.cos(direction) * 8,
    y: fighter.y + Math.sin(direction) * 8,
    vx: Math.cos(direction) * speed,
    vy: Math.sin(direction) * speed,
    ownerId: fighter.id,
    life,
    color: fighter.accent,
    damage,
    size,
    weapon
  });
}

function getUnlockedWeapons(score: number) {
  return weaponOrder.filter((weapon) => {
    if (weapon === "pistol") return true;
    if (weapon === "shotgun") return score >= 5;
    if (weapon === "smg") return score >= 10;
    if (weapon === "rifle") return score >= 15;
    return score >= 20;
  });
}

function getActivePlayerWeapon(player: Fighter) {
  const unlocked = getUnlockedWeapons(player.score);
  if (!unlocked.includes(selectedWeapon)) {
    selectedWeapon = unlocked[unlocked.length - 1];
  }
  return selectedWeapon;
}

function shoot(fighter: Fighter) {
  if (fighter.reload > 0 || fighter.respawn > 0) {
    return;
  }

  if (fighter.isPlayer) {
    const weapon = getActivePlayerWeapon(fighter);

    if (weapon === "pistol") {
      fighter.reload = 0.1;
      createBullet(fighter, fighter.dir, 176, 10, 24, 3, weapon);
    } else if (weapon === "shotgun") {
      fighter.reload = 0.42;
      createBullet(fighter, fighter.dir - 0.2, 156, 10, 16, 3, weapon);
      createBullet(fighter, fighter.dir - 0.07, 162, 10, 16, 3, weapon);
      createBullet(fighter, fighter.dir + 0.07, 162, 10, 16, 3, weapon);
      createBullet(fighter, fighter.dir + 0.2, 156, 10, 16, 3, weapon);
    } else if (weapon === "smg") {
      fighter.reload = 0.06;
      createBullet(fighter, fighter.dir + (Math.random() - 0.5) * 0.12, 188, 10, 14, 2, weapon);
    } else if (weapon === "rifle") {
      fighter.reload = 0.16;
      createBullet(fighter, fighter.dir, 240, 10, 34, 3, weapon);
    } else {
      fighter.reload = 0.55;
      createBullet(fighter, fighter.dir, 132, 10, 58, 5, weapon);
    }
  } else {
    fighter.reload = 0.34;
    createBullet(fighter, fighter.dir, 132, 1.1, 24, 3, "pistol");
  }

  playShootSound(fighter.isPlayer);
}

function chooseBotTarget(bot: Fighter) {
  const player = fighters.find((fighter) => fighter.isPlayer && fighter.respawn <= 0);

  if (!player) {
    return null;
  }

  return {
    fighter: player,
    distance: Math.hypot(player.x - bot.x, player.y - bot.y) || 1,
    score: 0
  };
}

function updatePlayer(player: Fighter, dt: number) {
  const moveX = Number(input.right) - Number(input.left);
  const moveY = Number(input.down) - Number(input.up);
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
      enemy.hp -= 32;
      enemy.flash = 0.16;
      bot.flash = 0.08;
      playHitSound(true);

      if (enemy.hp <= 0) {
        enemy.respawn = 2.2;
        enemy.hp = 0;
        bot.score += 1;
        playDefeatSound();
      }
    }
  } else if (dist < 118 && !lineBlocked(bot.x, bot.y, enemy.x, enemy.y)) {
    shoot(bot);
  }

  moveFighter(bot, dt);
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

function defeatFighter(target: Fighter, owner?: Fighter | null) {
  target.respawn = 2.2;
  target.hp = 0;
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

function explodeBazooka(bullet: Bullet) {
  const owner = fighters.find((fighter) => fighter.id === bullet.ownerId) ?? null;
  addExplosion(bullet.x, bullet.y, 30);
  playHitSound(false);

  for (const fighter of fighters) {
    if (fighter.respawn > 0 || fighter.id === bullet.ownerId) {
      continue;
    }
    if (owner && owner.isPlayer === fighter.isPlayer) {
      continue;
    }

    const distance = Math.hypot(fighter.x - bullet.x, fighter.y - bullet.y);
    if (distance > 30) {
      continue;
    }

    const falloff = 1 - distance / 30;
    const damage = Math.max(18, Math.round(bullet.damage * falloff));
    fighter.hp -= damage;
    fighter.flash = 0.18;

    if (fighter.hp <= 0) {
      defeatFighter(fighter, owner);
    }
  }
}

function updateBullets(dt: number) {
  for (const bullet of bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    if (bullet.weapon === "bazooka") {
      const splashTarget = fighters.find((fighter) => {
        if (fighter.id === bullet.ownerId || fighter.respawn > 0) {
          return false;
        }
        const owner = fighters.find((candidate) => candidate.id === bullet.ownerId);
        if (!owner || owner.isPlayer === fighter.isPlayer) {
          return false;
        }
        return Math.hypot(fighter.x - bullet.x, fighter.y - bullet.y) < 22;
      });

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

    const target = fighters.find((fighter) => {
      if (fighter.id === bullet.ownerId || fighter.respawn > 0) {
        return false;
      }
      const owner = fighters.find((candidate) => candidate.id === bullet.ownerId);
      if (!owner) {
        return false;
      }
      if (owner.isPlayer === fighter.isPlayer) {
        return false;
      }
      return Math.hypot(fighter.x - bullet.x, fighter.y - bullet.y) < fighter.radius + bullet.size;
    });

    if (!target) {
      continue;
    }

    if (bullet.weapon === "bazooka") {
      explodeBazooka(bullet);
      bullet.life = 0;
      continue;
    }

    target.hp -= bullet.damage;
    target.flash = 0.14;
    bullet.life = 0;
    playHitSound(false);

    const owner = fighters.find((fighter) => fighter.id === bullet.ownerId);
    if (target.hp <= 0) {
      defeatFighter(target, owner);
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
  if (medkits.length >= 3) {
    return;
  }

  medkits.push({
    x: 24 + Math.random() * (WORLD_WIDTH - 48),
    y: 24 + Math.random() * (WORLD_HEIGHT - 48)
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

function updateLightning(dt: number) {
  lightningCooldown -= dt;
  if (lightningCooldown <= 0) {
    spawnLightningStrike();
    lightningCooldown = 1.8 + Math.random() * 2.4;
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
        player.hp -= 30;
        player.flash = 0.22;
        playHitSound(false);

        if (player.hp <= 0) {
          player.hp = 0;
          player.respawn = 2.2;
          playDefeatSound();
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

function update(dt: number) {
  elapsed += dt;

  for (const fighter of fighters) {
    fighter.reload = Math.max(0, fighter.reload - dt);
    fighter.flash = Math.max(0, fighter.flash - dt);
    fighter.attackCooldown = Math.max(0, fighter.attackCooldown - dt);

    if (fighter.respawn > 0) {
      fighter.respawn -= dt;
      if (fighter.respawn <= 0) {
        respawn(fighter);
      }
      continue;
    }

    if (fighter.isPlayer) {
      updatePlayer(fighter, dt);
    } else {
      updateBot(fighter, dt);
    }
  }

  updateBullets(dt);
  updateExplosions(dt);
  updateLightning(dt);
  updateMedkits(dt);
}

function drawArena() {
  ctx.fillStyle = "#203840";
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  for (let y = 0; y < WORLD_HEIGHT; y += 16) {
    for (let x = 0; x < WORLD_WIDTH; x += 16) {
      ctx.fillStyle = (x + y) % 32 === 0 ? "#2d4d53" : "#345b5f";
      ctx.fillRect(x, y, 16, 16);
    }
  }

  ctx.fillStyle = "#4f774d";
  for (let i = 0; i < 34; i += 1) {
    const x = (i * 43) % WORLD_WIDTH;
    const y = (i * 29) % WORLD_HEIGHT;
    ctx.fillRect(x, y, 5, 5);
    ctx.fillRect(x + 2, y + 3, 6, 4);
  }

  for (const wall of walls) {
    ctx.fillStyle = "#9e6a3f";
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.fillStyle = "#c99459";
    ctx.fillRect(wall.x, wall.y, wall.w, 4);
    ctx.fillStyle = "#734929";
    ctx.fillRect(wall.x, wall.y + wall.h - 3, wall.w, 3);
  }
}

function drawFighter(fighter: Fighter) {
  if (fighter.respawn > 0) {
    return;
  }

  const body = fighter.flash > 0 ? "#ffffff" : fighter.color;
  const weaponReach = fighter.archetype === "melee" ? 4 : 6;
  const handX = fighter.x + Math.cos(fighter.dir) * weaponReach;
  const handY = fighter.y + Math.sin(fighter.dir) * weaponReach;

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

  ctx.fillStyle = "#1d2431";
  ctx.fillRect(fighter.x - 4, fighter.y - 2, 3, 3);
  ctx.fillRect(fighter.x + 1, fighter.y - 2, 3, 3);

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

function drawMedkits() {
  for (const medkit of medkits) {
    ctx.fillStyle = "#f4ead0";
    ctx.fillRect(medkit.x - 5, medkit.y - 5, 10, 10);
    ctx.fillStyle = "#ff5a5a";
    ctx.fillRect(medkit.x - 2, medkit.y - 5, 4, 10);
    ctx.fillRect(medkit.x - 5, medkit.y - 2, 10, 4);
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
    ctx.fillStyle = bullet.color;
    ctx.fillRect(
      bullet.x - bullet.size / 2,
      bullet.y - bullet.size / 2,
      bullet.size,
      bullet.size
    );
  }
}

function drawHud() {
  const player = fighters.find((fighter) => fighter.isPlayer);
  if (!player) {
    return;
  }

  const unlockedWeapons = getUnlockedWeapons(player.score);

  ctx.fillStyle = "rgba(14, 16, 24, 0.72)";
  ctx.fillRect(8, 8, 96, 34);

  ctx.fillStyle = "#f5e7c8";
  ctx.font = "bold 8px monospace";
  ctx.fillText(`HP ${Math.ceil(player.hp)}`, 14, 18);
  ctx.fillText(`Score ${player.score}`, 14, 28);
  ctx.fillText(getActivePlayerWeapon(player).toUpperCase(), 14, 38);

  const barY = WORLD_HEIGHT - 22;
  const startX = 14;
  const width = 84;
  const gap = 6;
  ctx.font = "bold 7px monospace";

  weaponOrder.forEach((weapon, index) => {
    const x = startX + index * (width + gap);
    const unlocked = unlockedWeapons.includes(weapon);
    const selected = weapon === getActivePlayerWeapon(player);

    ctx.fillStyle = selected ? "rgba(255, 186, 83, 0.92)" : unlocked ? "rgba(18, 24, 38, 0.86)" : "rgba(18, 24, 38, 0.42)";
    ctx.fillRect(x, barY, width, 14);
    ctx.strokeStyle = selected ? "#fff0b8" : unlocked ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, barY + 0.5, width - 1, 13);

    ctx.fillStyle = selected ? "#3e2410" : unlocked ? "#f5e7c8" : "rgba(245, 231, 200, 0.4)";
    const threshold = weapon === "pistol" ? 0 : weapon === "shotgun" ? 5 : weapon === "smg" ? 10 : weapon === "rifle" ? 15 : 20;
    ctx.fillText(`${index + 1}.${weapon.toUpperCase()} ${threshold}`, x + 5, barY + 9);
  });

  if (player.respawn > 0) {
    ctx.fillStyle = "rgba(18, 10, 20, 0.8)";
    ctx.fillRect(WORLD_WIDTH / 2 - 76, WORLD_HEIGHT / 2 - 17, 152, 34);
    ctx.fillStyle = "#fff1da";
    ctx.font = "bold 10px monospace";
    ctx.fillText(`RESPAWN ${player.respawn.toFixed(1)}s`, WORLD_WIDTH / 2 - 58, WORLD_HEIGHT / 2 + 3);
  }
}

function render() {
  drawArena();
  drawSpawnWarnings();
  drawMedkits();
  drawBullets();
  drawExplosions();
  drawLightning();
  fighters.forEach(drawFighter);
  drawHud();
}

let previous = performance.now();

function frame(now: number) {
  const dt = Math.min(0.033, (now - previous) / 1000);
  previous = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

function updateMousePosition(event: MouseEvent) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = WORLD_WIDTH / rect.width;
  const scaleY = WORLD_HEIGHT / rect.height;
  input.mouseX = (event.clientX - rect.left) * scaleX;
  input.mouseY = (event.clientY - rect.top) * scaleY;
}

function setMovementKey(code: string, isPressed: boolean) {
  if (code === "KeyW" || code === "ArrowUp") input.up = isPressed;
  if (code === "KeyS" || code === "ArrowDown") input.down = isPressed;
  if (code === "KeyA" || code === "ArrowLeft") input.left = isPressed;
  if (code === "KeyD" || code === "ArrowRight") input.right = isPressed;
}

function trySelectWeapon(slot: number) {
  const player = fighters.find((fighter) => fighter.isPlayer);
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

window.addEventListener("keydown", (event) => {
  if (event.repeat) {
    return;
  }

  setMovementKey(event.code, true);
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

canvas.addEventListener("mousemove", updateMousePosition);
canvas.addEventListener("mousedown", () => {
  ensureAudio();
  audioContext?.resume();
  input.shoot = true;
});
window.addEventListener("keydown", () => {
  ensureAudio();
  audioContext?.resume();
}, { once: true });
window.addEventListener("mouseup", () => {
  input.shoot = false;
});

spawnRoster();
render();
requestAnimationFrame(frame);
