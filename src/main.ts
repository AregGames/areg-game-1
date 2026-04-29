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
const BOSS1_SPIN_DURATION = 5.5;
const BOSS1_SPIN_DAMAGE_INTERVAL = 0.28;
const BOSS1_SWORD_CONTACT_INTERVAL = 0.18;
const SKULL_BOSS_PROJECTILE_WINDUP = 0.05;
const MAX_SIMULTANEOUS_ENEMIES = 15;
const NON_BOSS_ENEMY_DAMAGE_TO_PLAYER_SCALE = 0.5;
const SHOP_ITEM_COST_SWORDS = 20;
const SHOP_ITEM_COST_REGEN = 20;
const SHOP_ITEM_COST_ATTACK_SPEED = 30;
const SHOP_ITEM_COST_PIERCE = 15;
const SHOP_ITEM_COST_SHOCKWAVE = 20;
const SHOCKWAVE_INTERVAL = 3;
const PLAYER_ATTACK_SPEED_MULTIPLIER = 1.25;
const ORBITAL_SWORD_SPAWN_INTERVAL = 10;
const ORBITAL_SWORD_DURATION = 3.5;
const ORBITAL_SWORD_COUNT = 3;
const ORBITAL_SWORD_RADIUS = 22;
const ORBITAL_SWORD_SPIN_SPEED = 5.4;
const ORBITAL_SWORD_DAMAGE = 30;
const ORBITAL_SWORD_DAMAGE_TICK = 0.25;
const REGEN_AMOUNT_PER_SECOND = 3;
const AUDIO_MASTER_GAIN = 0.42;
const SHOP_DENY_SOUND_COOLDOWN = 0.3;
const KNOCKBACK_VELOCITY_SCALE = 10;
const KNOCKBACK_DECAY = 16;
const SHOP_READY_BUTTON_WIDTH = 78;
const SHOP_READY_BUTTON_HEIGHT = 16;
const DEBUG_SHOP_POINTS_BONUS = 10;
const COOP_REVIVE_TOUCH_DURATION = 1.2;
const COOP_REVIVE_TOUCH_RADIUS_BONUS = 8;
const LIVE_RELOAD_STATE_KEY = "pixel-bot-brawler:dev-state";
const AudioContextClass = window.AudioContext || (window as typeof window & {
  webkitAudioContext?: typeof AudioContext;
}).webkitAudioContext;
type DetectedQrCode = { rawValue?: string };
type QrDetectorInstance = {
  detect: (source: ImageBitmapSource) => Promise<DetectedQrCode[]>;
};
type WindowWithQrDetector = typeof window & {
  BarcodeDetector?: new (options?: { formats?: string[] }) => QrDetectorInstance;
};
const BarcodeDetectorClass = (window as WindowWithQrDetector).BarcodeDetector;

if (IS_MOBILE_VIEWPORT) {
  document.addEventListener(
    "touchmove",
    (event) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    },
    { passive: false }
  );

  for (const eventName of ["gesturestart", "gesturechange", "gestureend"]) {
    document.addEventListener(eventName, (event) => {
      event.preventDefault();
    });
  }
}

canvas.width = WORLD_WIDTH;
canvas.height = WORLD_HEIGHT;

type Fighter = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  knockbackVx: number;
  knockbackVy: number;
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
  controller: "local" | "remote" | "none";
  playerSlot: 0 | 1 | null;
  selectedWeapon: WeaponType;
  highestUnlockedWeapon: WeaponType;
  downed: boolean;
  reviveProgress: number;
};

type Bullet = {
  id: number;
  shotId: number;
  sourceInputSeq: number | null;
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
  trailLength?: number;
  piercedTargetIds?: string;
  laserResolved?: boolean;
  canPierce?: boolean;
};

type Wall = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type WeaponType = "pistol" | "shotgun" | "smg" | "laser" | "bazooka";

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

type ShopItem = {
  x: number;
  y: number;
  itemType: "swords" | "regen" | "attackSpeed" | "pierce" | "shockwave";
  cost: number;
};

type OrbitingSword = {
  angleOffset: number;
  timer: number;
  damageTick: number;
};

type BossKind = "none" | "iron" | "skull";
type BossAttackType = "targeted" | "forward" | "left" | "right";
type ControlState = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  moveX: number;
  moveY: number;
  shoot: boolean;
  mouseX: number;
  mouseY: number;
};
type ControlCommandState = {
  weaponSlot: number | null;
  shieldPressed: boolean;
  ragePressed: boolean;
};
type MultiplayerRole = "solo" | "host" | "guest";
type NetworkStatus =
  | "offline"
  | "preparing"
  | "waiting-for-peer"
  | "joining"
  | "connecting"
  | "connected"
  | "error";
type MenuScreen =
  | "home"
  | "friend"
  | "host"
  | "join"
  | "guest-share"
  | "relay-answer"
  | "rules";
type ScannerMode = "invite" | "reply" | null;
type NetworkPacket =
  | {
      type: "input";
      payload: ControlState & ControlCommandState & {
        seq: number;
      };
    }
  | {
      type: "snapshot";
      payload: NetworkSnapshot;
    }
  | {
      type: "shot";
      payload: {
        shooterId: number;
        shooterPlayerSlot: 0 | 1 | null;
        sourceInputSeq: number | null;
        bullets: Bullet[];
      };
    };
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
  shopItems: ShopItem[];
  shopPhaseActive: boolean;
  swordUpgradeLevel: number;
  regenUpgradeLevel: number;
  attackSpeedUpgradeLevel: number;
  fourthShotPierceUnlocked?: boolean;
  fourthShotPierceCounter?: number;
  shockwaveUnlocked?: boolean;
  shockwaveTimer?: number;
  hasSwordUpgrade?: boolean;
  hasRegenUpgrade?: boolean;
  hasAttackSpeedUpgrade?: boolean;
  swordSpawnTimer: number;
  regenTickTimer: number;
  orbitingSwords: OrbitingSword[];
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
type NetworkSnapshot = {
  fighters: Fighter[];
  bullets: Bullet[];
  lightningStrikes: LightningStrike[];
  meteors: Meteor[];
  burningFloors: BurningFloor[];
  medkits: Medkit[];
  stars: StarPickup[];
  shieldPickups: ShieldPickup[];
  explosions: Explosion[];
  shopItems: ShopItem[];
  orbitingSwords: OrbitingSword[];
  shopPhaseActive: boolean;
  swordUpgradeLevel: number;
  regenUpgradeLevel: number;
  attackSpeedUpgradeLevel: number;
  fourthShotPierceUnlocked: boolean;
  fourthShotPierceCounter: number;
  shockwaveUnlocked: boolean;
  shockwaveTimer: number;
  elapsed: number;
  survivalWithoutDeath: number;
  bossFightStarted: boolean;
  bossFightWon: boolean;
  bossIntroTimer: number;
  bossAttackType: BossAttackType | null;
  bossAttackWindup: number;
  bossAttackAngle: number;
  bossesDefeated: number;
  serverTick: number;
  lastProcessedGuestInputSeq: number;
};
type BufferedNetworkSnapshot = {
  snapshot: NetworkSnapshot;
};
type GuestPendingInput = {
  seq: number;
  dt: number;
  controls: ControlState;
  commands: ControlCommandState;
};

function createControlState(): ControlState {
  return {
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
}

function createControlCommandState(): ControlCommandState {
  return {
    weaponSlot: null,
    shieldPressed: false,
    ragePressed: false
  };
}

function cloneControlState(state: ControlState): ControlState {
  return {
    up: state.up,
    down: state.down,
    left: state.left,
    right: state.right,
    moveX: state.moveX,
    moveY: state.moveY,
    shoot: state.shoot,
    mouseX: state.mouseX,
    mouseY: state.mouseY
  };
}

function cloneControlCommandState(state: ControlCommandState): ControlCommandState {
  return {
    weaponSlot: state.weaponSlot,
    shieldPressed: state.shieldPressed,
    ragePressed: state.ragePressed
  };
}

const input = createControlState();
const remoteInput = createControlState();
const remoteCommands = createControlCommandState();
const outgoingGuestCommands = createControlCommandState();

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
let audioMasterGain: GainNode | null = null;
let audioCompressor: DynamicsCompressorNode | null = null;
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
const shopItems: ShopItem[] = [];
let shopPhaseActive = false;
let swordUpgradeLevel = 0;
let regenUpgradeLevel = 0;
let attackSpeedUpgradeLevel = 0;
let fourthShotPierceUnlocked = false;
let fourthShotPierceCounter = 0;
let shockwaveUnlocked = false;
let shockwaveTimer = SHOCKWAVE_INTERVAL;
let swordSpawnTimer = ORBITAL_SWORD_SPAWN_INTERVAL;
let regenTickTimer = 1;
const orbitingSwords: OrbitingSword[] = [];
const weaponOrder: WeaponType[] = ["pistol", "smg", "shotgun", "laser", "bazooka"];
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
let shopDenySoundCooldown = 0;
let multiplayerRole: MultiplayerRole = "solo";
let networkStatus: NetworkStatus = "offline";
let networkMessage = "Solo run";
let peerConnection: RTCPeerConnection | null = null;
let dataChannel: RTCDataChannel | null = null;
let lastGuestInputSentAt = 0;
let localInputSequence = 0;
let lastProcessedRemoteInputSequence = 0;
let snapshotBroadcastTimer = 0;
let simulationTick = 0;
let hostSimulationAccumulator = 0;
let guestInputAccumulator = 0;
let guestSnapshotBuffer: BufferedNetworkSnapshot[] = [];
let guestEstimatedServerTick = 0;
let guestPendingInputs: GuestPendingInput[] = [];
let guestPredictedPlayer: Fighter | null = null;
let guestPredictedBullets: Bullet[] = [];
let guestAuthoritativeShotBullets: Bullet[] = [];
let gameStarted = false;
let menuOpen = true;
let menuScreen: MenuScreen = "home";
let pendingSessionId = "";
let pendingShareLink = "";
let pendingReturnLink = "";
let qrImageUrl = "";
let linkInputValue = "";
let answerInputValue = "";
let answerRelayChannel: BroadcastChannel | null = null;
let connectionTimeoutId: number | null = null;
let hostSetupVersion = 0;
let guestSetupVersion = 0;
let scannerMode: ScannerMode = null;
let scannerError = "";
let scannerBusy = false;
let scannerAnimationFrameId = 0;
let scannerStream: MediaStream | null = null;
let scannerVideo: HTMLVideoElement | null = null;
const SNAPSHOT_SEND_INTERVAL = 1 / 20;
const SIMULATION_TICK_RATE = 60;
const SIMULATION_DT = 1 / SIMULATION_TICK_RATE;
const MAX_FRAME_DT = 0.1;
const GUEST_INPUT_SEND_INTERVAL = SIMULATION_DT;
const GUEST_SNAPSHOT_INTERPOLATION_DELAY_TICKS = Math.max(4, Math.ceil(SNAPSHOT_SEND_INTERVAL / SIMULATION_DT));
const MAX_GUEST_SNAPSHOT_BUFFER_SIZE = 6;
const ANSWER_RELAY_KEY_PREFIX = "pixel-bot-brawler:p2p-answer:";
const rtcConfiguration: RTCConfiguration = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302"
      ]
    }
  ]
};

const bossAttackPattern: BossAttackType[] = ["targeted", "targeted", "forward", "left", "right", "left", "left"];

const palette = [
  ["#57d7ff", "#dffaff"],
  ["#ff8a5b", "#ffe0c4"],
  ["#ff5f8c", "#ffd6e4"],
  ["#96e072", "#edffd9"]
];

const devStageSnapshots = [
  { survival: 0, bossesDefeated: 0, boss: "none" as BossKind, shopPhase: false },
  { survival: 30, bossesDefeated: 0, boss: "none" as BossKind, shopPhase: false },
  { survival: 59, bossesDefeated: 0, boss: "none" as BossKind, shopPhase: false },
  { survival: 60, bossesDefeated: 0, boss: "iron" as BossKind, shopPhase: false },
  { survival: 61, bossesDefeated: 1, boss: "none" as BossKind, shopPhase: true },
  { survival: 75, bossesDefeated: 1, boss: "none" as BossKind, shopPhase: false },
  { survival: 120, bossesDefeated: 1, boss: "skull" as BossKind, shopPhase: false },
  { survival: 121, bossesDefeated: 2, boss: "none" as BossKind, shopPhase: true },
  { survival: 130, bossesDefeated: 2, boss: "none" as BossKind, shopPhase: false }
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

const menuOverlay = document.createElement("section");
menuOverlay.className = "menu-overlay";
document.body.append(menuOverlay);

function updateQrImage(link: string) {
  qrImageUrl = link
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(link)}`
    : "";
}

function getShortSessionLabel(sessionId: string) {
  return sessionId ? sessionId.slice(0, 6).toUpperCase() : "------";
}

function getScannerMarkup(mode: ScannerMode) {
  if (scannerMode !== mode) {
    return "";
  }

  return `
    <div class="menu-scanner">
      <video id="menu-scanner-video" class="menu-scanner-video" autoplay playsinline muted></video>
      <div class="menu-status">${scannerError || "Point the camera at the QR code."}</div>
      <div class="menu-actions">
        <button type="button" data-action="stop-scan" class="ghost">Stop Scanning</button>
      </div>
    </div>
  `;
}

function renderMenu() {
  menuOverlay.hidden = !menuOpen;
  menuOverlay.style.display = menuOpen ? "grid" : "none";

  const qrMarkup = qrImageUrl
    ? `<img class="menu-qr" src="${qrImageUrl}" alt="QR code for multiplayer link" referrerpolicy="no-referrer">`
    : "";

  if (menuScreen === "home") {
    menuOverlay.innerHTML = `
      <div class="menu-panel">
        <p class="menu-kicker">Pixel Bot Brawler</p>
        <h1>Choose a mode</h1>
        <p class="menu-copy">Fight solo or open a friend room with a shareable link.</p>
        <div class="menu-actions">
          ${gameStarted ? '<button type="button" data-action="resume-game">Resume</button>' : ""}
          <button type="button" data-action="new-game">New Game</button>
          <button type="button" data-action="show-rules">Rules</button>
          <button type="button" data-action="play-friend">Play with Friend</button>
        </div>
      </div>
    `;
    return;
  }

  if (menuScreen === "rules") {
    menuOverlay.innerHTML = `
      <div class="menu-panel">
        <p class="menu-kicker">Game Rules</p>
        <h1>How it works</h1>
        <div class="menu-rules">
          ${rulesLines.map((line) => `<p class="menu-rule-line">${line}</p>`).join("")}
        </div>
        <div class="menu-actions">
          <button type="button" data-action="back-home" class="ghost">Back</button>
        </div>
      </div>
    `;
    return;
  }

  if (menuScreen === "friend") {
    menuOverlay.innerHTML = `
      <div class="menu-panel">
        <p class="menu-kicker">Play with Friend</p>
        <h1>Host or join</h1>
        <p class="menu-copy">Create a room and share the invite, or open a link your friend sent you.</p>
        <div class="menu-status">${networkMessage}</div>
        <div class="menu-actions">
          <button type="button" data-action="create-room">Create Game</button>
          <button type="button" data-action="show-join">Join Game</button>
          <button type="button" data-action="back-home" class="ghost">Back</button>
        </div>
      </div>
    `;
    return;
  }

  if (menuScreen === "join") {
    menuOverlay.innerHTML = `
      <div class="menu-panel">
        <p class="menu-kicker">Join Game</p>
        <h1>Open your friend's invite</h1>
        <p class="menu-copy">Scan the invite QR or paste the link here. If you opened the page from a shared link, this can happen automatically.</p>
        <label class="menu-label" for="menu-link-input">Invite Link</label>
        <textarea id="menu-link-input" class="menu-textarea" spellcheck="false" placeholder="https://...">${linkInputValue}</textarea>
        <div class="menu-status">${networkMessage}</div>
        <div class="menu-actions">
          <button type="button" data-action="join-link">Join</button>
          <button type="button" data-action="scan-invite" ${scannerBusy ? "disabled" : ""}>Scan Invite QR</button>
          <button type="button" data-action="back-friend" class="ghost">Back</button>
        </div>
        ${getScannerMarkup("invite")}
      </div>
    `;
    return;
  }

  if (menuScreen === "host") {
    menuOverlay.innerHTML = `
      <div class="menu-panel">
        <p class="menu-kicker">Create Game</p>
        <h1>Share this invite</h1>
        <p class="menu-copy">Send the link or let your friend scan the QR. Then scan their reply QR here, or paste the reply link if the camera is awkward.</p>
        <p class="menu-copy">Room ${getShortSessionLabel(pendingSessionId)}</p>
        <label class="menu-label" for="menu-share-link">Invite Link</label>
        <textarea id="menu-share-link" class="menu-textarea menu-textarea-copy" readonly data-copy-value="${pendingShareLink}" placeholder="Generating invite link...">${pendingShareLink}</textarea>
        <div class="menu-qr-wrap">${qrMarkup}</div>
        <label class="menu-label" for="menu-answer-input">Guest Reply Link</label>
        <textarea id="menu-answer-input" class="menu-textarea" spellcheck="false" placeholder="Scan the guest reply QR or paste the reply link here.">${answerInputValue}</textarea>
        <div class="menu-status">${networkMessage}</div>
        <div class="menu-actions">
          <button type="button" data-action="connect-reply">Connect Reply</button>
          <button type="button" data-action="scan-reply" ${scannerBusy ? "disabled" : ""}>Scan Guest Reply</button>
          <button type="button" data-action="cancel-room" class="ghost">Cancel</button>
        </div>
        ${getScannerMarkup("reply")}
      </div>
    `;
    return;
  }

  if (menuScreen === "guest-share") {
    menuOverlay.innerHTML = `
      <div class="menu-panel">
        <p class="menu-kicker">Almost There</p>
        <h1>Send this back to the host</h1>
        <p class="menu-copy">Let the host scan this QR, or send them the short reply link so they can paste it into the host screen.</p>
        <p class="menu-copy">Room ${getShortSessionLabel(pendingSessionId)}</p>
        <label class="menu-label" for="menu-return-link">Return Link</label>
        <textarea id="menu-return-link" class="menu-textarea menu-textarea-copy" readonly data-copy-value="${pendingReturnLink}" placeholder="Generating reply link...">${pendingReturnLink}</textarea>
        <div class="menu-qr-wrap">${qrMarkup}</div>
        <div class="menu-status">${networkMessage}</div>
        <div class="menu-actions">
          <button type="button" data-action="share-link">Share Return Link</button>
        </div>
      </div>
    `;
    return;
  }

  menuOverlay.innerHTML = `
    <div class="menu-panel">
      <p class="menu-kicker">Link Hand-Off</p>
      <h1>Answer received</h1>
      <p class="menu-copy">${networkMessage}</p>
      <div class="menu-actions">
        <button type="button" data-action="home-from-relay">Back to Menu</button>
      </div>
    </div>
  `;
}

function createFighter(x: number, y: number, isPlayer: boolean, colorIndex: number): Fighter {
  const [color, accent] = palette[colorIndex % palette.length];
  return {
    id: nextId++,
    x,
    y,
    vx: 0,
    vy: 0,
    knockbackVx: 0,
    knockbackVy: 0,
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
    bossKind: "none",
    controller: isPlayer ? "local" : "none",
    playerSlot: isPlayer ? 0 : null,
    selectedWeapon: "pistol",
    highestUnlockedWeapon: "pistol",
    downed: false,
    reviveProgress: 0
  };
}

function isFighterActive(fighter: Fighter) {
  return fighter.respawn <= 0 && !fighter.downed;
}

function isHumanFighterActive(fighter: Fighter) {
  return fighter.isPlayer && isFighterActive(fighter);
}

function getHumanFighters() {
  return fighters.filter((fighter) => fighter.isPlayer);
}

function getActiveHumanFighters() {
  return fighters.filter(isHumanFighterActive);
}

function getDownedHumanFighters() {
  return fighters.filter((fighter) => fighter.isPlayer && fighter.downed);
}

function getPrimaryPlayer() {
  return fighters.find((fighter) => fighter.isPlayer && fighter.playerSlot === 0) ?? getHumanFighters()[0] ?? null;
}

function getRemotePlayer() {
  return fighters.find((fighter) => fighter.isPlayer && fighter.playerSlot === 1) ?? null;
}

function getControlledPlayer() {
  const targetSlot = multiplayerRole === "guest" ? 1 : 0;
  return fighters.find((fighter) => fighter.isPlayer && fighter.playerSlot === targetSlot) ?? getPrimaryPlayer();
}

function getNearestActiveHuman(x: number, y: number) {
  const targets = getActiveHumanFighters();
  if (targets.length <= 0) {
    return null;
  }

  return targets
    .slice()
    .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
}

function ensureRemotePlayerPresent() {
  if (multiplayerRole !== "host" || getRemotePlayer()) {
    return;
  }

  const point = getRandomSpawnPoint(7);
  const remotePlayer = createFighter(point.x, point.y, true, 2);
  remotePlayer.team = "ally";
  remotePlayer.controller = "remote";
  remotePlayer.playerSlot = 1;
  remotePlayer.color = "#ff7a95";
  remotePlayer.accent = "#ffe1ea";
  fighters.push(remotePlayer);
}

function removeRemotePlayer() {
  const remotePlayer = getRemotePlayer();
  if (!remotePlayer) {
    return;
  }

  const index = fighters.findIndex((fighter) => fighter.id === remotePlayer.id);
  if (index >= 0) {
    fighters.splice(index, 1);
  }
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
  orbitingSwords.length = 0;
  shopItems.length = 0;
  shopPhaseActive = false;
  swordUpgradeLevel = 0;
  regenUpgradeLevel = 0;
  attackSpeedUpgradeLevel = 0;
  fourthShotPierceUnlocked = false;
  fourthShotPierceCounter = 0;
  shockwaveUnlocked = false;
  shockwaveTimer = SHOCKWAVE_INTERVAL;
  swordSpawnTimer = ORBITAL_SWORD_SPAWN_INTERVAL;
  regenTickTimer = 1;
  shopDenySoundCooldown = 0;
  lightningCooldown = 2.4;
  meteorCooldown = 5.2;
  medkitCooldown = 4.5;
  starCooldown = 8;
  shieldPickupCooldown = 18;
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
  const player = createFighter(playerSpawn.x, playerSpawn.y, true, 0);
  player.controller = multiplayerRole === "guest" ? "none" : "local";
  player.playerSlot = 0;
  fighters.push(player);

  if (multiplayerRole === "host") {
    ensureRemotePlayerPresent();
  }

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
  return devInfiniteHealth && target.isPlayer;
}

function ensureEnemyWavePresent() {
  const activeEnemies = fighters.some((fighter) => fighter.team === "enemy" && fighter.respawn <= 0);
  if (!activeEnemies && !bossFightStarted && !shopPhaseActive) {
    spawnEnemyWave();
  }
}

function applyDevStage(stageIndex: number) {
  const snapshot = devStageSnapshots[clamp(stageIndex, 0, devStageSnapshots.length - 1)];
  const player = getPrimaryPlayer();

  clearAmbientHazards();
  despawnEnemies();
  if (swordUpgradeLevel <= 0) {
    orbitingSwords.length = 0;
  }
  shopItems.length = 0;
  shopPhaseActive = false;
  if (swordUpgradeLevel > 0) {
    swordSpawnTimer = Math.min(swordSpawnTimer, 0.05);
  }
  shopDenySoundCooldown = 0;
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
    player.downed = false;
    player.reviveProgress = 0;
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
  } else if (snapshot.shopPhase) {
    spawnShopItems();
  } else {
    ensureEnemyWavePresent();
  }
}

function getCurrentDevStageIndex() {
  const boss = getBoss();
  if (shopPhaseActive && bossesDefeated >= 2) {
    return 7;
  }
  if (bossFightStarted && boss?.bossKind === "skull") {
    return 6;
  }
  if (shopPhaseActive && bossesDefeated >= 1) {
    return 4;
  }
  if (bossFightStarted && boss?.bossKind === "iron") {
    return 3;
  }
  if (bossesDefeated >= 2) {
    return 8;
  }
  if (bossesDefeated >= 1) {
    return 5;
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

function startIronBossSpin(boss: Fighter) {
  bossIntroTimer = BOSS1_SPIN_DURATION;
  bossAttackType = null;
  bossAttackWindup = 0;
  bossAttackActive = 0;
  bossAttackRecover = 0;
  bossAttackIndex = 0;
  bossAttackAngle = boss.dir;
  bossAttackHitApplied = false;
  bossSpinDamageTick = BOSS1_SPIN_DAMAGE_INTERVAL;
  bossSwordContactTick = BOSS1_SWORD_CONTACT_INTERVAL;
}

function placeFighterAt(fighter: Fighter, x: number, y: number) {
  fighter.x = x;
  fighter.y = y;
  fighter.spawnX = x;
  fighter.spawnY = y;
  fighter.targetX = x;
  fighter.targetY = y;
  fighter.vx = 0;
  fighter.vy = 0;
  fighter.knockbackVx = 0;
  fighter.knockbackVy = 0;
  fighter.wander = 0;
}

function moveAlliesToBossArena(activeHumans: Fighter[]) {
  if (activeHumans.length <= 0) {
    return;
  }

  const helpers = fighters.filter((fighter) => fighter.team === "ally" && fighter.respawn <= 0);
  const helperOffsets = [
    { x: -24, y: 18 },
    { x: 24, y: 18 },
    { x: -36, y: 2 },
    { x: 36, y: 2 }
  ];

  for (let index = 0; index < helpers.length; index += 1) {
    const anchor = activeHumans[index % activeHumans.length];
    const offset = helperOffsets[index % helperOffsets.length];
    placeFighterAt(helpers[index], anchor.x + offset.x, anchor.y + offset.y);
  }
}

function startBossFight(kind: BossKind) {
  if (bossFightStarted || bossFightWon) {
    return;
  }

  despawnEnemies();
  clearAmbientHazards();

  const activeHumans = getActiveHumanFighters();
  for (const player of activeHumans) {
    placeFighterAt(player, WORLD_WIDTH / 2 + (player.playerSlot === 1 ? 20 : -20), WORLD_HEIGHT / 2 + 58);
  }
  moveAlliesToBossArena(activeHumans);

  const boss = createFighter(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, false, 1);
  if (kind === "skull") {
    configureSkullBoss(boss);
  } else {
    configureIronBoss(boss);
  }
  fighters.push(boss);

  bossFightStarted = true;
  bossIntroTimer = 0;
  bossAttackType = null;
  bossAttackWindup = 0;
  bossAttackActive = 0;
  bossAttackRecover = 0;
  bossAttackIndex = 0;
  bossAttackAngle = boss.dir;
  bossAttackHitApplied = false;
  bossSpinDamageTick = 0;
  bossSwordContactTick = 0;
  skullBossActionTimer = kind === "skull" ? 1.25 : 0;
  skullBossActionIndex = 0;
  skullBossBurstShotsLeft = 0;
  skullBossBurstWindup = 0;

  if (kind === "iron") {
    startIronBossSpin(boss);
  }
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
  fighter.knockbackVx = 0;
  fighter.knockbackVy = 0;
  if (fighter.isPlayer) {
    fighter.downed = false;
    fighter.reviveProgress = 0;
    fighter.maxHp = 100;
    fighter.critChance = 0.02;
    fighter.damageMultiplier = 1;
    fighter.score = 0;
    fighter.shieldCount = 0;
    fighter.shieldTimer = 0;
    fighter.rageCharge = 100;
    fighter.rageTimer = 0;
    fighter.rageCooldown = 0;
    fighter.selectedWeapon = "pistol";
    fighter.highestUnlockedWeapon = "pistol";
    if (fighter.playerSlot === 0) {
      spawnEnemyWave();
    }
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
  audioMasterGain = audioContext.createGain();
  audioMasterGain.gain.setValueAtTime(AUDIO_MASTER_GAIN, audioContext.currentTime);

  audioCompressor = audioContext.createDynamicsCompressor();
  audioCompressor.threshold.setValueAtTime(-22, audioContext.currentTime);
  audioCompressor.knee.setValueAtTime(18, audioContext.currentTime);
  audioCompressor.ratio.setValueAtTime(6, audioContext.currentTime);
  audioCompressor.attack.setValueAtTime(0.003, audioContext.currentTime);
  audioCompressor.release.setValueAtTime(0.18, audioContext.currentTime);

  audioMasterGain.connect(audioCompressor);
  audioCompressor.connect(audioContext.destination);
  audioEnabled = true;
}

function jitterFrequency(frequency: number, spread = 0.02) {
  return Math.max(30, frequency * (1 + (Math.random() * 2 - 1) * spread));
}

function connectToAudioOutput(node: AudioNode) {
  if (!audioContext) {
    return;
  }
  if (audioMasterGain) {
    node.connect(audioMasterGain);
    return;
  }
  node.connect(audioContext.destination);
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
  oscillator.frequency.setValueAtTime(jitterFrequency(frequency), start);
  if (slideTo !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(jitterFrequency(slideTo, 0.01), start + duration);
  }

  const attack = Math.min(0.012, duration * 0.4);
  gainNode.gain.setValueAtTime(0.0001, start);
  gainNode.gain.exponentialRampToValueAtTime(volume, start + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(gainNode);
  connectToAudioOutput(gainNode);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

function playNoiseBurst(duration: number, volume: number, filterType: BiquadFilterType, cutoff: number) {
  if (!audioContext || audioContext.state !== "running") {
    return;
  }

  const bufferSize = Math.max(64, Math.floor(audioContext.sampleRate * duration));
  const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const channel = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    channel[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }

  const start = audioContext.currentTime;
  const source = audioContext.createBufferSource();
  source.buffer = noiseBuffer;
  const filter = audioContext.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(cutoff, start);
  const gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(0.0001, start);
  gainNode.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.01, duration * 0.3));
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  source.connect(filter);
  filter.connect(gainNode);
  connectToAudioOutput(gainNode);
  source.start(start);
  source.stop(start + duration);
}

function playShootSound(isPlayer: boolean) {
  if (isPlayer) {
    playTone("square", 700, 0.075, 0.032, 430);
    playTone("triangle", 1040, 0.028, 0.009, 690);
  } else {
    playTone("square", 430, 0.06, 0.016, 280);
  }
}

function playHitSound(isMelee: boolean) {
  playTone(isMelee ? "triangle" : "sawtooth", isMelee ? 180 : 240, 0.07, isMelee ? 0.03 : 0.024, isMelee ? 120 : 170);
  playNoiseBurst(0.045, isMelee ? 0.011 : 0.008, "highpass", isMelee ? 620 : 900);
}

function playDefeatSound() {
  playTone("triangle", 250, 0.1, 0.035, 140);
  playTone("sawtooth", 180, 0.16, 0.028, 80);
}

function playLightningSound() {
  playTone("sawtooth", 920, 0.12, 0.04, 260);
  playTone("triangle", 240, 0.16, 0.024, 100);
  playNoiseBurst(0.12, 0.018, "highpass", 1100);
}

function playMeteorSound() {
  playTone("sawtooth", 190, 0.16, 0.038, 110);
  playTone("triangle", 98, 0.23, 0.028, 64);
  playNoiseBurst(0.2, 0.02, "lowpass", 260);
}

function playPickupSound() {
  playTone("triangle", 480, 0.08, 0.024, 740);
  playTone("sine", 740, 0.07, 0.016, 980);
}

function playStarSound() {
  playTone("sine", 620, 0.09, 0.022, 910);
  playTone("triangle", 910, 0.11, 0.018, 1280);
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

function playShopOpenSound() {
  playTone("triangle", 310, 0.1, 0.03, 520);
  playTone("sine", 520, 0.12, 0.02, 760);
}

function playShopBuySound() {
  playTone("sine", 560, 0.07, 0.02, 900);
  playTone("triangle", 900, 0.09, 0.018, 1220);
}

function playShopDeniedSound() {
  playTone("square", 200, 0.06, 0.014, 150);
  playTone("sawtooth", 170, 0.06, 0.01, 130);
}

function getPlayerWeapon(score: number): WeaponType {
  if (score >= 20) return "bazooka";
  if (score >= 15) return "laser";
  if (score >= 10) return "shotgun";
  if (score >= 5) return "smg";
  return "pistol";
}

function deterministicRandom(seed: number, salt: number) {
  let value = (seed ^ salt) >>> 0;
  value = Math.imul(value ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35) >>> 0;
  value ^= value >>> 16;
  return value / 0xffffffff;
}

function getShotSpreadOffset(sourceInputSeq: number | null, projectileIndex: number, amount: number) {
  if (sourceInputSeq === null) {
    return (Math.random() - 0.5) * amount;
  }

  return (deterministicRandom(sourceInputSeq, 31 + projectileIndex) - 0.5) * amount;
}

function rollBulletCrit(fighter: Fighter, sourceInputSeq: number | null, projectileIndex: number) {
  if (!fighter.isPlayer) {
    return false;
  }

  const roll = sourceInputSeq === null
    ? Math.random()
    : deterministicRandom(sourceInputSeq, 101 + projectileIndex);
  return roll < fighter.critChance;
}

function createBulletInArray(
  target: Bullet[],
  fighter: Fighter,
  direction: number,
  speed: number,
  life: number,
  damage: number,
  size: number,
  weapon: WeaponType,
  shotId: number,
  sourceInputSeq: number | null,
  projectileIndex: number
) {
  const isCrit = rollBulletCrit(fighter, sourceInputSeq, projectileIndex);
  const bullet = {
    id: nextId++,
    shotId,
    sourceInputSeq,
    x: fighter.x + Math.cos(direction) * 8,
    y: fighter.y + Math.sin(direction) * 8,
    vx: Math.cos(direction) * speed,
    vy: Math.sin(direction) * speed,
    ownerId: fighter.id,
    life,
    color: weapon === "laser" ? "#66f6ff" : fighter.accent,
    damage: (isCrit ? damage * 2 : damage) * fighter.damageMultiplier,
    size,
    weapon,
    isCrit,
    healAmount: 0,
    trailLength: weapon === "laser" ? 0 : undefined,
    piercedTargetIds: weapon === "laser" ? "" : undefined,
    laserResolved: weapon === "laser" ? false : undefined
  };
  target.push(bullet);
  return bullet;
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
  createBulletInArray(bullets, fighter, direction, speed, life, damage, size, weapon, nextId++, null, 0);
}

function getUnlockedWeapons(score: number) {
  return weaponOrder.filter((weapon) => {
    if (weapon === "pistol") return true;
    if (weapon === "smg") return score >= 5;
    if (weapon === "shotgun") return score >= 10;
    if (weapon === "laser") return score >= 15;
    return score >= 20;
  });
}

function traceProjectilePath(startX: number, startY: number, endX: number, endY: number, radius: number) {
  const distance = Math.hypot(endX - startX, endY - startY);
  const steps = Math.max(1, Math.ceil(distance / 2));
  let lastX = startX;
  let lastY = startY;

  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const x = startX + (endX - startX) * t;
    const y = startY + (endY - startY) * t;
    if (x < 0 || x > WORLD_WIDTH || y < 0 || y > WORLD_HEIGHT || intersectsWall(x, y, radius)) {
      return { x: lastX, y: lastY, hitObstacle: true };
    }
    lastX = x;
    lastY = y;
  }

  return { x: endX, y: endY, hitObstacle: false };
}

function hasPiercedTarget(bullet: Bullet, targetId: number) {
  return bullet.piercedTargetIds?.includes(`|${targetId}|`) ?? false;
}

function markPiercedTarget(bullet: Bullet, targetId: number) {
  bullet.piercedTargetIds = `${bullet.piercedTargetIds ?? ""}|${targetId}|`;
}

function resolveLaserBeam(bullet: Bullet, dt: number) {
  if (bullet.laserResolved) {
    return {
      previousX: bullet.x,
      previousY: bullet.y,
      hitObstacle: false
    };
  }

  const previousX = bullet.x;
  const previousY = bullet.y;
  const tracedPath = traceProjectilePath(
    previousX,
    previousY,
    bullet.x + bullet.vx * dt,
    bullet.y + bullet.vy * dt,
    Math.max(2, bullet.size)
  );

  bullet.x = tracedPath.x;
  bullet.y = tracedPath.y;
  bullet.trailLength = Math.max(32, Math.hypot(bullet.x - previousX, bullet.y - previousY));
  bullet.laserResolved = true;

  return {
    previousX,
    previousY,
    hitObstacle: tracedPath.hitObstacle
  };
}

function getActivePlayerWeapon(player: Fighter) {
  const unlocked = getUnlockedWeapons(player.score);
  const newestUnlocked = unlocked[unlocked.length - 1];

  if (weaponOrder.indexOf(newestUnlocked) > weaponOrder.indexOf(player.highestUnlockedWeapon)) {
    player.selectedWeapon = newestUnlocked;
    player.highestUnlockedWeapon = newestUnlocked;
  } else if (!unlocked.includes(player.selectedWeapon)) {
    player.selectedWeapon = newestUnlocked;
    player.highestUnlockedWeapon = newestUnlocked;
  }

  return player.selectedWeapon;
}

function createHelper(type: "red" | "green", player: Fighter) {
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

function applyControlCommands(player: Fighter, commands: ControlCommandState) {
  if (commands.weaponSlot !== null) {
    trySelectWeapon(commands.weaponSlot, player);
  }
  if (commands.shieldPressed) {
    activateShield(player);
  }
  if (commands.ragePressed) {
    activateRage(player);
  }
}

function clearControlCommands(commands: ControlCommandState) {
  commands.weaponSlot = null;
  commands.shieldPressed = false;
  commands.ragePressed = false;
}

function sendAuthoritativeShotEvent(
  fighter: Fighter,
  sourceInputSeq: number | null,
  createdBullets: Bullet[]
) {
  if (multiplayerRole !== "host" || !fighter.isPlayer || createdBullets.length <= 0) {
    return;
  }

  sendPacket({
    type: "shot",
    payload: {
      shooterId: fighter.id,
      shooterPlayerSlot: fighter.playerSlot,
      sourceInputSeq,
      bullets: createdBullets.map((bullet) => ({ ...bullet }))
    }
  });
}

function shoot(
  fighter: Fighter,
  bulletTarget: Bullet[] = bullets,
  playSoundEffect = true,
  sourceInputSeq: number | null = null
) {
  if (fighter.reload > 0 || fighter.respawn > 0) {
    return [];
  }

  const shotId = nextId++;
  const createdBullets: Bullet[] = [];

  if (fighter.isPlayer) {
    const weapon = getActivePlayerWeapon(fighter);
    const rageReloadFactor = fighter.rageTimer > 0 ? 0.45 : 1;
    const rageSpeedFactor = fighter.rageTimer > 0 ? 2 : 1;
    const playerSpeedFactor = 1.5;
    const attackSpeedFactor = Math.pow(PLAYER_ATTACK_SPEED_MULTIPLIER, attackSpeedUpgradeLevel);
    const isFourthShotPierce =
      fourthShotPierceUnlocked &&
      weapon !== "laser" &&
      weapon !== "bazooka" &&
      (fourthShotPierceCounter + 1) % 4 === 0;
    fourthShotPierceCounter += 1;

    if (weapon === "pistol") {
      fighter.reload = (0.2 * rageReloadFactor) / attackSpeedFactor;
      createdBullets.push(
        createBulletInArray(
          bulletTarget,
          fighter,
          fighter.dir,
          176 * playerSpeedFactor * rageSpeedFactor,
          10,
          24,
          3,
          weapon,
          shotId,
          sourceInputSeq,
          0
        )
      );
    } else if (weapon === "shotgun") {
      fighter.reload = (0.28 * rageReloadFactor) / attackSpeedFactor;
      createdBullets.push(
        createBulletInArray(bulletTarget, fighter, fighter.dir - 0.24, 152 * playerSpeedFactor * rageSpeedFactor, 10, 20, 3, weapon, shotId, sourceInputSeq, 0),
        createBulletInArray(bulletTarget, fighter, fighter.dir - 0.12, 158 * playerSpeedFactor * rageSpeedFactor, 10, 20, 3, weapon, shotId, sourceInputSeq, 1),
        createBulletInArray(bulletTarget, fighter, fighter.dir, 164 * playerSpeedFactor * rageSpeedFactor, 10, 20, 3, weapon, shotId, sourceInputSeq, 2),
        createBulletInArray(bulletTarget, fighter, fighter.dir + 0.12, 158 * playerSpeedFactor * rageSpeedFactor, 10, 20, 3, weapon, shotId, sourceInputSeq, 3),
        createBulletInArray(bulletTarget, fighter, fighter.dir + 0.24, 152 * playerSpeedFactor * rageSpeedFactor, 10, 20, 3, weapon, shotId, sourceInputSeq, 4)
      );
    } else if (weapon === "smg") {
      fighter.reload = (0.06 * rageReloadFactor) / attackSpeedFactor;
      createdBullets.push(
        createBulletInArray(
          bulletTarget,
          fighter,
          fighter.dir + getShotSpreadOffset(sourceInputSeq, 0, 0.12),
          188 * playerSpeedFactor * rageSpeedFactor,
          10,
          14,
          2,
          weapon,
          shotId,
          sourceInputSeq,
          0
        )
      );
    } else if (weapon === "laser") {
      fighter.reload = (0.12 * rageReloadFactor) / attackSpeedFactor;
      createdBullets.push(
        createBulletInArray(
          bulletTarget,
          fighter,
          fighter.dir,
          60000 * rageSpeedFactor,
          0.035,
          34,
          4,
          weapon,
          shotId,
          sourceInputSeq,
          0
        )
      );
    } else {
      fighter.reload = (0.275 * rageReloadFactor) / attackSpeedFactor;
      createdBullets.push(
        createBulletInArray(bulletTarget, fighter, fighter.dir, 132 * playerSpeedFactor * rageSpeedFactor, 10, 160, 5, weapon, shotId, sourceInputSeq, 0)
      );
    }

    if (isFourthShotPierce) {
      for (const bullet of createdBullets) {
        bullet.canPierce = true;
        bullet.color = "#a6f8ff";
        bullet.piercedTargetIds = "";
      }
    }
  } else {
    fighter.reload = 0.34;
    createdBullets.push(
      createBulletInArray(bulletTarget, fighter, fighter.dir, 132, 1.1, 24, 3, "pistol", shotId, sourceInputSeq, 0)
    );
  }

  if (playSoundEffect) {
    playShootSound(fighter.isPlayer);
  }

  sendAuthoritativeShotEvent(fighter, sourceInputSeq, createdBullets);
  return createdBullets;
}

function chooseBotTarget(bot: Fighter) {
  const targets = fighters.filter(
    (fighter) => (fighter.team === "player" || fighter.team === "ally") && isFighterActive(fighter)
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
  const enemies = fighters.filter((fighter) => fighter.team === "enemy" && isFighterActive(fighter));
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

function getControlStateForFighter(fighter: Fighter) {
  return fighter.controller === "remote" ? remoteInput : input;
}

function consumeQueuedCommands(fighter: Fighter) {
  if (fighter.controller !== "remote") {
    return;
  }

  applyControlCommands(fighter, remoteCommands);
  clearControlCommands(remoteCommands);
}

function updateHumanFighterWithControls(
  player: Fighter,
  controls: ControlState,
  dt: number,
  commands?: ControlCommandState,
  bulletTarget: Bullet[] = bullets,
  playShotSound = true,
  sourceInputSeq: number | null = null
) {
  const moveX = clamp(Number(controls.right) - Number(controls.left) + controls.moveX, -1, 1);
  const moveY = clamp(Number(controls.down) - Number(controls.up) + controls.moveY, -1, 1);
  const len = Math.hypot(moveX, moveY) || 1;
  player.vx = (moveX / len) * player.speed;
  player.vy = (moveY / len) * player.speed;
  player.dir = Math.atan2(controls.mouseY - player.y, controls.mouseX - player.x);

  if (commands) {
    applyControlCommands(player, commands);
  }

  if (controls.shoot) {
    shoot(player, bulletTarget, playShotSound, sourceInputSeq);
  }

  moveFighter(player, dt);
}

function updateHumanFighter(player: Fighter, dt: number) {
  const controls = getControlStateForFighter(player);
  const commands = player.controller === "remote" ? remoteCommands : undefined;
  const sourceInputSeq = player.controller === "remote" ? lastProcessedRemoteInputSequence : null;
  updateHumanFighterWithControls(player, controls, dt, commands, bullets, true, sourceInputSeq);
  if (player.controller === "remote") {
    clearControlCommands(remoteCommands);
  }
}

function resetGuestPredictionState() {
  guestEstimatedServerTick = 0;
  guestPendingInputs = [];
  guestPredictedPlayer = null;
  guestPredictedBullets = [];
  guestAuthoritativeShotBullets = [];
  lastGuestInputSentAt = 0;
  localInputSequence = 0;
  guestInputAccumulator = 0;
}

function getLatestBufferedGuestSnapshot() {
  return guestSnapshotBuffer[guestSnapshotBuffer.length - 1]?.snapshot ?? null;
}

function advancePredictedPlayerTimers(player: Fighter, dt: number) {
  player.reload = Math.max(0, player.reload - dt);
  player.flash = Math.max(0, player.flash - dt);
  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.shieldTimer = Math.max(0, player.shieldTimer - dt);
  player.rageTimer = Math.max(0, player.rageTimer - dt);
  if (player.rageTimer <= 0) {
    player.rageCooldown = Math.max(0, player.rageCooldown - dt);
  }
  if (!player.downed && player.rageTimer <= 0 && player.rageCooldown <= 0) {
    player.rageCharge = Math.min(100, player.rageCharge + dt * 8);
  }

  if (player.respawn > 0) {
    player.respawn = Math.max(0, player.respawn - dt);
  }
}

function updateVisualOnlyBullets(target: Bullet[], dt: number) {
  for (const bullet of target) {
    if (bullet.weapon === "laser") {
      resolveLaserBeam(bullet, dt);
    } else {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
    }
    bullet.life -= dt;
    if (
      bullet.x < 0 ||
      bullet.x > WORLD_WIDTH ||
      bullet.y < 0 ||
      bullet.y > WORLD_HEIGHT ||
      intersectsWall(bullet.x, bullet.y, 2)
    ) {
      bullet.life = 0;
    }
  }

  for (let index = target.length - 1; index >= 0; index -= 1) {
    if (target[index].life <= 0) {
      target.splice(index, 1);
    }
  }
}

function pruneGuestAuthoritativeShotBullets(snapshot: NetworkSnapshot | null) {
  const snapshotBulletIds = new Set(snapshot?.bullets.map((bullet) => bullet.id) ?? []);
  guestAuthoritativeShotBullets = guestAuthoritativeShotBullets.filter((bullet) => !snapshotBulletIds.has(bullet.id) && bullet.life > 0);
}

function applyAuthoritativeShotEvent(payload: Extract<NetworkPacket, { type: "shot" }>["payload"]) {
  if (multiplayerRole !== "guest") {
    return;
  }

  if (payload.shooterPlayerSlot === 1 && payload.sourceInputSeq !== null) {
    guestPredictedBullets = guestPredictedBullets.filter((bullet) => bullet.sourceInputSeq !== payload.sourceInputSeq);
  }

  const snapshot = getLatestBufferedGuestSnapshot();
  const snapshotBulletIds = new Set(snapshot?.bullets.map((bullet) => bullet.id) ?? []);
  const existingOverlayIds = new Set(guestAuthoritativeShotBullets.map((bullet) => bullet.id));

  for (const bullet of payload.bullets) {
    if (snapshotBulletIds.has(bullet.id) || existingOverlayIds.has(bullet.id)) {
      continue;
    }
    guestAuthoritativeShotBullets.push({ ...bullet });
  }
}

function applyGuestPrediction() {
  if (multiplayerRole !== "guest") {
    return;
  }

  const latestSnapshot = getLatestBufferedGuestSnapshot();
  if (!latestSnapshot) {
    guestPredictedPlayer = null;
    guestPredictedBullets = [];
    return;
  }

  const authoritativePlayer = latestSnapshot.fighters.find((fighter) => fighter.isPlayer && fighter.playerSlot === 1);
  if (!authoritativePlayer) {
    guestPredictedPlayer = null;
    guestPredictedBullets = [];
    return;
  }

  guestPendingInputs = guestPendingInputs.filter((entry) => entry.seq > latestSnapshot.lastProcessedGuestInputSeq);
  guestPredictedPlayer = {
    ...authoritativePlayer,
    controller: "local"
  };
  guestPredictedBullets = [];
  pruneGuestAuthoritativeShotBullets(latestSnapshot);

  for (const entry of guestPendingInputs) {
    advancePredictedPlayerTimers(guestPredictedPlayer, entry.dt);
    if (guestPredictedPlayer.respawn <= 0 && !guestPredictedPlayer.downed) {
      updateHumanFighterWithControls(
        guestPredictedPlayer,
        entry.controls,
        entry.dt,
        entry.commands,
        guestPredictedBullets,
        false,
        entry.seq
      );
    } else {
      guestPredictedPlayer.vx = 0;
      guestPredictedPlayer.vy = 0;
    }
    updateVisualOnlyBullets(guestPredictedBullets, entry.dt);
  }

  const renderedLocalPlayer = getRemotePlayer();
  if (renderedLocalPlayer) {
    Object.assign(renderedLocalPlayer, guestPredictedPlayer);
  }
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
      const baseDamage = enemy.isPlayer ? 10 * NON_BOSS_ENEMY_DAMAGE_TO_PLAYER_SCALE : 10;
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
  const player = getNearestActiveHuman(helper.x, helper.y);
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
      const shotId = nextId++;
      bullets.push({
        id: nextId++,
        shotId,
        sourceInputSeq: null,
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
    const shotId = nextId++;
    bullets.push({
      id: nextId++,
      shotId,
      sourceInputSeq: null,
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

function getIronBossSwordAngle(boss: Fighter) {
  return bossIntroTimer > 0
    ? boss.dir
    : bossAttackType === "left"
      ? Math.PI
      : bossAttackType === "right"
        ? 0
        : bossAttackAngle || boss.dir;
}

function getBoss1ShieldStartAngle(boss: Fighter) {
  const shieldArcLength = getBoss1ShieldArcLength();
  const shieldCenterAngle = getIronBossSwordAngle(boss) + Math.PI;
  return shieldCenterAngle - shieldArcLength * 0.5;
}

function projectileHitsBoss1Shield(x: number, y: number, size: number, boss: Fighter) {
  if (boss.bossKind !== "iron" || !bossShieldActive()) {
    return false;
  }

  const dx = x - boss.x;
  const dy = y - boss.y;
  const distanceFromBoss = Math.hypot(dx, dy);
  const shieldRadius = getBoss1ShieldRadius(boss);
  const shieldHalfThickness = BOSS1_SHIELD_LINE_WIDTH * 0.5 + 0.5;

  if (Math.abs(distanceFromBoss - shieldRadius) > shieldHalfThickness + size) {
    return false;
  }

  const shieldArcLength = getBoss1ShieldArcLength();
  const shieldCenterAngle = getBoss1ShieldStartAngle(boss) + shieldArcLength * 0.5;
  const bulletAngle = Math.atan2(dy, dx);
  return angleDifference(bulletAngle, shieldCenterAngle) <= shieldArcLength * 0.5;
}

function bulletHitsBoss1Shield(bullet: Bullet, boss: Fighter) {
  return projectileHitsBoss1Shield(bullet.x, bullet.y, bullet.size, boss);
}

function findShieldCollisionOnPath(startX: number, startY: number, endX: number, endY: number, bullet: Bullet, boss: Fighter) {
  const distance = Math.hypot(endX - startX, endY - startY);
  const steps = Math.max(1, Math.ceil(distance / 2));

  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const x = startX + (endX - startX) * t;
    const y = startY + (endY - startY) * t;
    if (projectileHitsBoss1Shield(x, y, bullet.size, boss)) {
      return { x, y };
    }
  }

  return null;
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
  const shotId = nextId++;
  bullets.push({
    id: nextId++,
    shotId,
    sourceInputSeq: null,
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
  const player = getNearestActiveHuman(boss.x, boss.y);
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
  const player = getNearestActiveHuman(boss.x, boss.y);
  if (player && bossIntroTimer <= 0 && bossAttackType !== "targeted") {
    boss.dir = Math.atan2(player.y - boss.y, player.x - boss.x);
  }

  if (bossIntroTimer > 0) {
    bossIntroTimer = Math.max(0, bossIntroTimer - dt);
    boss.dir += dt * BOSS1_SHIELD_SPIN_SPEED;
    bossSpinDamageTick -= dt;

    if (bossSpinDamageTick <= 0) {
      damageTargetsTouchingBossSword(boss, 12, 0);
      bossSpinDamageTick = BOSS1_SPIN_DAMAGE_INTERVAL;
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
    bossAttackIndex += 1;
    if (bossAttackIndex >= bossAttackPattern.length) {
      startIronBossSpin(boss);
      return;
    }

    queueBossAttack(boss, player);
  }
}

function reflectBulletOffBoss(bullet: Bullet, boss: Fighter, originalOwner: Fighter | null) {
  const player = originalOwner?.team === "ally" && isFighterActive(originalOwner)
    ? originalOwner
    : getNearestActiveHuman(boss.x, boss.y)
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
  bullet.life = bullet.weapon === "laser" ? 0.035 : Math.max(1, bullet.life);
  bullet.color = "#d8e5f0";
  bullet.isCrit = false;
  bullet.healAmount = 0;
  bullet.trailLength = 0;
  bullet.piercedTargetIds = "";
  bullet.laserResolved = false;
  playHitSound(false);
}

function moveFighter(fighter: Fighter, dt: number) {
  const totalVx = fighter.vx + fighter.knockbackVx;
  const totalVy = fighter.vy + fighter.knockbackVy;
  const nextX = fighter.x + totalVx * dt;
  const nextY = fighter.y + totalVy * dt;

  if (canMoveTo(nextX, fighter.y, fighter.radius)) {
    fighter.x = nextX;
  } else {
    fighter.knockbackVx = 0;
  }
  if (canMoveTo(fighter.x, nextY, fighter.radius)) {
    fighter.y = nextY;
  } else {
    fighter.knockbackVy = 0;
  }
}

function applyKnockback(target: Fighter, sourceX: number, sourceY: number, strength: number) {
  if (target.isBoss) {
    return;
  }

  const dx = target.x - sourceX;
  const dy = target.y - sourceY;
  const length = Math.hypot(dx, dy) || 1;
  target.knockbackVx += (dx / length) * strength * KNOCKBACK_VELOCITY_SCALE;
  target.knockbackVy += (dy / length) * strength * KNOCKBACK_VELOCITY_SCALE;
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
  orbitingSwords.length = 0;
  shopItems.length = 0;
  shopPhaseActive = false;
  swordUpgradeLevel = 0;
  regenUpgradeLevel = 0;
  attackSpeedUpgradeLevel = 0;
  fourthShotPierceUnlocked = false;
  fourthShotPierceCounter = 0;
  shockwaveUnlocked = false;
  shockwaveTimer = SHOCKWAVE_INTERVAL;
  swordSpawnTimer = ORBITAL_SWORD_SPAWN_INTERVAL;
  regenTickTimer = 1;
  shopDenySoundCooldown = 0;
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

function shouldEndRunAfterPlayerDeath(target: Fighter) {
  return !fighters.some((fighter) => fighter.isPlayer && fighter.id !== target.id && isHumanFighterActive(fighter));
}

function beginFullRunReset() {
  for (const fighter of fighters) {
    if (!fighter.isPlayer) {
      continue;
    }

    fighter.hp = 0;
    fighter.vx = 0;
    fighter.vy = 0;
    fighter.knockbackVx = 0;
    fighter.knockbackVy = 0;
    fighter.reload = 0;
    fighter.attackCooldown = 0;
    fighter.shieldTimer = 0;
    fighter.rageTimer = 0;
    fighter.flash = 0.18;
    fighter.downed = false;
    fighter.reviveProgress = 0;
    fighter.respawn = 2.2;
  }

  clearRunStateOnPlayerDeath();
  pendingRunReset = true;
}

function downPlayer(target: Fighter) {
  target.hp = 0;
  target.vx = 0;
  target.vy = 0;
  target.knockbackVx = 0;
  target.knockbackVy = 0;
  target.reload = 0;
  target.attackCooldown = 0;
  target.shieldTimer = 0;
  target.rageTimer = 0;
  target.flash = 0.18;
  target.reviveProgress = 0;

  if (shouldEndRunAfterPlayerDeath(target)) {
    beginFullRunReset();
    return;
  }

  target.downed = true;
  target.respawn = 0;
}

function revivePlayer(target: Fighter) {
  target.downed = false;
  target.reviveProgress = 0;
  target.respawn = 0;
  target.hp = Math.max(35, Math.round(target.maxHp * 0.5));
  target.flash = 0.18;
  target.shieldTimer = 1.2;
  target.rageTimer = 0;
  target.rageCooldown = Math.max(target.rageCooldown, 0.6);
  playPickupSound();
}

function spawnShopItems() {
  shopItems.length = 0;
  const topRowY = WORLD_HEIGHT / 2 - 18;
  const bottomRowY = WORLD_HEIGHT / 2 + 18;
  const candidates: Array<ShopItem> = [
    {
      x: WORLD_WIDTH * 0.18,
      y: topRowY,
      itemType: "swords",
      cost: SHOP_ITEM_COST_SWORDS
    },
    {
      x: WORLD_WIDTH * 0.5,
      y: topRowY,
      itemType: "regen",
      cost: SHOP_ITEM_COST_REGEN
    },
    {
      x: WORLD_WIDTH * 0.82,
      y: topRowY,
      itemType: "attackSpeed",
      cost: SHOP_ITEM_COST_ATTACK_SPEED
    },
    {
      x: WORLD_WIDTH * 0.32,
      y: bottomRowY,
      itemType: "shockwave",
      cost: SHOP_ITEM_COST_SHOCKWAVE
    },
    {
      x: WORLD_WIDTH * 0.68,
      y: bottomRowY,
      itemType: "pierce",
      cost: SHOP_ITEM_COST_PIERCE
    }
  ];

  for (const item of candidates) {
    if (item.itemType === "pierce" && fourthShotPierceUnlocked) {
      continue;
    }
    if (item.itemType === "shockwave" && shockwaveUnlocked) {
      continue;
    }
    shopItems.push({
      ...item,
      x: clamp(item.x, 18, WORLD_WIDTH - 18),
      y: clamp(item.y, 18, WORLD_HEIGHT - 18)
    });
  }

  shopPhaseActive = shopItems.length > 0;
  if (shopItems.length > 0) {
    playShopOpenSound();
  }
}

function getShopReadyButtonRect() {
  return {
    x: WORLD_WIDTH / 2 - SHOP_READY_BUTTON_WIDTH / 2,
    y: touchControls.enabled ? WORLD_HEIGHT - 62 : WORLD_HEIGHT - 42,
    width: SHOP_READY_BUTTON_WIDTH,
    height: SHOP_READY_BUTTON_HEIGHT
  };
}

function endShopPhase() {
  if (!shopPhaseActive) {
    return;
  }
  shopPhaseActive = false;
  shopItems.length = 0;
  ensureEnemyWavePresent();
  playPickupSound();
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
    despawnEnemies();
    clearAmbientHazards();
    spawnShopItems();
    spawnBossBlueStars(bossDeathX, bossDeathY);
    if (owner) {
      owner.score += defeatedBossKind === "skull" ? 14 : 10;
    }
    playDefeatSound();
    return;
  }

  if (target.isPlayer) {
    downPlayer(target);
  } else {
    target.respawn = 2.2;
    target.hp = 0;
    target.downed = false;
    target.reviveProgress = 0;
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
  if (!isFighterActive(target)) {
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

function isCoopDamagePenaltyActive() {
  return multiplayerRole !== "solo" && getHumanFighters().length > 1;
}

function applyProjectileDamage(
  target: Fighter,
  damage: number,
  sourceX: number,
  sourceY: number,
  knockback: number,
  owner: Fighter | null
) {
  const coopScaledDamage =
    owner?.isPlayer && isCoopDamagePenaltyActive()
      ? damage * 0.5
      : damage;
  const scaledDamage =
    target.isPlayer && owner?.team === "enemy" && !owner.isBoss
      ? coopScaledDamage * NON_BOSS_ENEMY_DAMAGE_TO_PLAYER_SCALE
      : coopScaledDamage;
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
    let previousX = bullet.x;
    let previousY = bullet.y;
    let hitObstacle = false;

    if (bullet.weapon === "laser") {
      const laserStep = resolveLaserBeam(bullet, dt);
      previousX = laserStep.previousX;
      previousY = laserStep.previousY;
      hitObstacle = laserStep.hitObstacle;
    } else {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
    }
    bullet.life -= dt;

    if (bullet.healAmount > 0) {
      const healerTarget = fighters.find((fighter) => {
        const owner = fighters.find((candidate) => candidate.id === bullet.ownerId);
        if (!owner) {
          return false;
        }
        return (
          fighter.isPlayer &&
          isFighterActive(fighter) &&
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
    const shieldCollision = boss && owner && owner.team !== "enemy"
      ? bullet.weapon === "laser"
        ? findShieldCollisionOnPath(previousX, previousY, bullet.x, bullet.y, bullet, boss)
        : bulletHitsBoss1Shield(bullet, boss)
          ? { x: bullet.x, y: bullet.y }
          : null
      : null;
    if (
      boss &&
      owner &&
      shieldCollision
    ) {
      bullet.x = shieldCollision.x;
      bullet.y = shieldCollision.y;
      reflectBulletOffBoss(bullet, boss, owner);
      continue;
    }

    if (bullet.weapon === "bazooka") {
      const splashTarget = fighters
        .filter((fighter) => {
          if (fighter.id === bullet.ownerId || !isFighterActive(fighter)) {
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
      (bullet.weapon !== "laser" && hitObstacle) ||
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

    if (bullet.weapon === "laser") {
      const piercedTargets = fighters
        .filter((fighter) => {
          if (fighter.id === bullet.ownerId || !isFighterActive(fighter) || hasPiercedTarget(bullet, fighter.id)) {
            return false;
          }
          if (!canHitTarget(owner ?? null, fighter)) {
            return false;
          }
          return distanceToSegment(fighter.x, fighter.y, previousX, previousY, bullet.x, bullet.y) < fighter.radius + bullet.size;
        })
        .sort(
          (a, b) =>
            Math.hypot(a.x - previousX, a.y - previousY) - Math.hypot(b.x - previousX, b.y - previousY)
        );

      let laserConnected = false;
      for (const target of piercedTargets) {
        markPiercedTarget(bullet, target.id);
        const directHitKnockback = target.rageTimer > 0 && target.isPlayer ? 0 : bullet.isCrit ? 8 : 0;
        applyProjectileDamage(target, bullet.damage, bullet.x, bullet.y, directHitKnockback, owner);
        laserConnected = true;

        if (target.rageTimer > 0 && target.isPlayer) {
          if (owner && owner.team === "enemy" && isFighterActive(owner)) {
            owner.hp -= bullet.damage;
            owner.flash = 0.18;
            applyKnockback(owner, target.x, target.y, 18);
            if (owner.hp <= 0) {
              defeatFighter(owner, target);
            }
          }
        }
      }

      if (laserConnected) {
        playHitSound(false);
      }
      continue;
    }

    const target = fighters
      .filter((fighter) => {
        if (fighter.id === bullet.ownerId || !isFighterActive(fighter) || hasPiercedTarget(bullet, fighter.id)) {
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

    const directHitKnockback = target.rageTimer > 0 && target.isPlayer ? 0 : bullet.isCrit ? 8 : 0;
    applyProjectileDamage(target, bullet.damage, bullet.x, bullet.y, directHitKnockback, owner);
    playHitSound(false);

    if (target.rageTimer > 0 && target.isPlayer) {
      if (bullet.canPierce) {
        markPiercedTarget(bullet, target.id);
      }
      if (owner && owner.team === "enemy" && isFighterActive(owner)) {
        owner.hp -= bullet.damage;
        owner.flash = 0.18;
        applyKnockback(owner, target.x, target.y, 18);
        if (owner.hp <= 0) {
          defeatFighter(owner, target);
        }
      }
      if (!bullet.canPierce) {
        bullet.life = 0;
      }
      continue;
    }

    if (bullet.canPierce) {
      markPiercedTarget(bullet, target.id);
      continue;
    }

    bullet.life = 0;

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

function triggerPlayerShockwave(player: Fighter) {
  const shockwaveRadius = 38;
  const knockbackStrength = 15;
  addExplosion(player.x, player.y, shockwaveRadius);

  for (const enemy of fighters) {
    if (enemy.team !== "enemy" || !isFighterActive(enemy)) {
      continue;
    }
    if (Math.hypot(enemy.x - player.x, enemy.y - player.y) > shockwaveRadius + enemy.radius) {
      continue;
    }
    enemy.flash = Math.max(enemy.flash, 0.12);
    applyKnockback(enemy, player.x, player.y, knockbackStrength);
  }

  playMeteorSound();
}

function tryBuyShopItemByTouch(player: Fighter, item: ShopItem) {
  if (item.itemType === "swords") {
    if (player.score < item.cost) {
      return false;
    }
    swordUpgradeLevel += 1;
    swordSpawnTimer = 0;
    player.score -= item.cost;
    playShopBuySound();
    return true;
  }

  if (item.itemType === "regen") {
    if (player.score < item.cost) {
      return false;
    }
    regenUpgradeLevel += 1;
    regenTickTimer = 1;
    player.score -= item.cost;
    playShopBuySound();
    return true;
  }

  if (item.itemType === "pierce") {
    if (player.score < item.cost || fourthShotPierceUnlocked) {
      return false;
    }
    fourthShotPierceUnlocked = true;
    fourthShotPierceCounter = 0;
    player.score -= item.cost;
    playShopBuySound();
    return true;
  }

  if (item.itemType === "shockwave") {
    if (player.score < item.cost || shockwaveUnlocked) {
      return false;
    }
    shockwaveUnlocked = true;
    shockwaveTimer = 0;
    player.score -= item.cost;
    playShopBuySound();
    return true;
  }

  if (player.score < item.cost) {
    return false;
  }
  attackSpeedUpgradeLevel += 1;
  player.score -= item.cost;
  playShopBuySound();
  return true;
}

function updateShopItems(player: Fighter) {
  for (let index = shopItems.length - 1; index >= 0; index -= 1) {
    const item = shopItems[index];
    if (Math.hypot(player.x - item.x, player.y - item.y) > player.radius + 9) {
      continue;
    }
    const bought = tryBuyShopItemByTouch(player, item);
    if (bought) {
      shopItems.splice(index, 1);
    } else if (shopDenySoundCooldown <= 0) {
      playShopDeniedSound();
      shopDenySoundCooldown = SHOP_DENY_SOUND_COOLDOWN;
    }
  }

}

function updateCoopRevives(dt: number) {
  const activeHumans = getActiveHumanFighters();
  const downedHumans = getDownedHumanFighters();

  if (activeHumans.length <= 0 && downedHumans.length > 0) {
    if (!pendingRunReset) {
      beginFullRunReset();
    }
    return;
  }

  if (activeHumans.length <= 0 || downedHumans.length <= 0) {
    for (const fighter of downedHumans) {
      fighter.reviveProgress = Math.max(0, fighter.reviveProgress - dt * 1.5);
    }
    return;
  }

  for (const downedFighter of downedHumans) {
    const reviver = activeHumans.find(
      (fighter) =>
        fighter.id !== downedFighter.id &&
        Math.hypot(fighter.x - downedFighter.x, fighter.y - downedFighter.y) <
          fighter.radius + downedFighter.radius + COOP_REVIVE_TOUCH_RADIUS_BONUS
    );

    if (!reviver) {
      downedFighter.reviveProgress = Math.max(0, downedFighter.reviveProgress - dt * 1.5);
      continue;
    }

    downedFighter.reviveProgress = Math.min(COOP_REVIVE_TOUCH_DURATION, downedFighter.reviveProgress + dt);
    if (downedFighter.reviveProgress >= COOP_REVIVE_TOUCH_DURATION) {
      revivePlayer(downedFighter);
    }
  }
}

function spawnOrbitingSwordWave() {
  const swordCount = Math.max(1, ORBITAL_SWORD_COUNT * swordUpgradeLevel);
  orbitingSwords.length = 0;
  for (let index = 0; index < swordCount; index += 1) {
    orbitingSwords.push({
      angleOffset: (index / swordCount) * TAU,
      timer: ORBITAL_SWORD_DURATION,
      damageTick: 0
    });
  }
}

function updateShopUpgrades(dt: number) {
  const player = getPrimaryPlayer();
  if (!player) {
    return;
  }

  shopDenySoundCooldown = Math.max(0, shopDenySoundCooldown - dt);

  if (shopPhaseActive && shopItems.length > 0) {
    updateShopItems(player);
  }

  if (regenUpgradeLevel > 0) {
    regenTickTimer -= dt;
    if (regenTickTimer <= 0) {
      const regenTicks = Math.floor(Math.abs(regenTickTimer) + 1);
      player.hp = Math.min(player.maxHp, player.hp + REGEN_AMOUNT_PER_SECOND * regenUpgradeLevel * regenTicks);
      regenTickTimer += regenTicks;
    }
  }

  if (shockwaveUnlocked && isFighterActive(player)) {
    shockwaveTimer -= dt;
    while (shockwaveTimer <= 0) {
      triggerPlayerShockwave(player);
      shockwaveTimer += SHOCKWAVE_INTERVAL;
    }
  }

  if (swordUpgradeLevel <= 0) {
    return;
  }

  swordSpawnTimer -= dt;
  if (swordSpawnTimer <= 0) {
    spawnOrbitingSwordWave();
    swordSpawnTimer = ORBITAL_SWORD_SPAWN_INTERVAL;
  }

  let slicedEnemy = false;
  for (const sword of orbitingSwords) {
    sword.timer -= dt;
    sword.damageTick -= dt;
    if (sword.damageTick > 0) {
      continue;
    }

    const angle = elapsed * ORBITAL_SWORD_SPIN_SPEED + sword.angleOffset;
    const swordX = player.x + Math.cos(angle) * ORBITAL_SWORD_RADIUS;
    const swordY = player.y + Math.sin(angle) * ORBITAL_SWORD_RADIUS;
    for (const enemy of fighters) {
      if (enemy.team !== "enemy" || !isFighterActive(enemy)) {
        continue;
      }
      if (Math.hypot(enemy.x - swordX, enemy.y - swordY) > enemy.radius + 6) {
        continue;
      }
      applyProjectileDamage(enemy, ORBITAL_SWORD_DAMAGE, player.x, player.y, 6, player);
      slicedEnemy = true;
    }

    sword.damageTick = ORBITAL_SWORD_DAMAGE_TICK;
  }

  if (slicedEnemy) {
    playTone("triangle", 420, 0.035, 0.008, 560);
  }

  for (let index = orbitingSwords.length - 1; index >= 0; index -= 1) {
    if (orbitingSwords[index].timer <= 0) {
      orbitingSwords.splice(index, 1);
    }
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

  const humanPlayers = getActiveHumanFighters();
  if (humanPlayers.length <= 0) {
    return;
  }

  for (let i = medkits.length - 1; i >= 0; i -= 1) {
    const medkit = medkits[i];
    const player = humanPlayers.find(
      (fighter) => Math.hypot(fighter.x - medkit.x, fighter.y - medkit.y) < fighter.radius + 7
    );
    if (player) {
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

  const humanPlayers = getActiveHumanFighters();
  if (humanPlayers.length <= 0) {
    return;
  }

  for (let i = shieldPickups.length - 1; i >= 0; i -= 1) {
    const shieldPickup = shieldPickups[i];
    const player = humanPlayers.find(
      (fighter) => Math.hypot(fighter.x - shieldPickup.x, fighter.y - shieldPickup.y) < fighter.radius + 7
    );
    if (player) {
      player.shieldCount += 1;
      shieldPickups.splice(i, 1);
      playShieldSound();
    }
  }
}

function updateStars(dt: number, allowAutoSpawn = true) {
  if (allowAutoSpawn) {
    starCooldown -= dt;
    if (starCooldown <= 0) {
      spawnStar();
      starCooldown = 10 + Math.random() * 6;
    }
  }

  const humanPlayers = getActiveHumanFighters();
  if (humanPlayers.length <= 0) {
    return;
  }

  for (let i = stars.length - 1; i >= 0; i -= 1) {
    const star = stars[i];
    const player = humanPlayers.find(
      (fighter) => Math.hypot(fighter.x - star.x, fighter.y - star.y) < fighter.radius + 8
    );
    if (player) {
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
  playTone("sine", 980, 0.04, 0.01, 760);
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

  for (const strike of lightningStrikes) {
    strike.timer -= dt;

    if (!strike.active && strike.timer <= 0) {
      strike.active = true;
      strike.timer = strike.duration;
      playLightningSound();
    }

    if (strike.active && !strike.hitApplied) {
      for (const player of getActiveHumanFighters()) {
        const distanceFromLine = Math.abs(player.x - strike.x);
        if (distanceFromLine >= 14 || playerHasInfiniteHealth(player)) {
          continue;
        }

        player.hp -= lightningSettings.damage;
        if (player.rageTimer > 0) {
          player.hp += lightningSettings.damage;
          player.hp -= Math.round(lightningSettings.damage * 0.8);
        }
        player.flash = 0.22;
        playHitSound(false);

        if (player.hp <= 0) {
          downPlayer(player);
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

function spawnMeteor() {
  playTone("triangle", 170, 0.05, 0.012, 130);
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
    (fighter) => (fighter.team === "player" || fighter.team === "ally") && isFighterActive(fighter)
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
    (fighter) => (fighter.team === "player" || fighter.team === "ally") && isFighterActive(fighter)
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
  const shopActive = shopPhaseActive;
  const player = getPrimaryPlayer();
  const activeHumans = getActiveHumanFighters();

  if (activeHumans.length > 0 && !shopActive) {
    survivalWithoutDeath += dt;
  }

  if (activeHumans.length > 0 && !shopActive && !bossFightStarted && !bossFightWon) {
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
    fighter.knockbackVx *= Math.max(0, 1 - dt * KNOCKBACK_DECAY);
    fighter.knockbackVy *= Math.max(0, 1 - dt * KNOCKBACK_DECAY);
    if (Math.abs(fighter.knockbackVx) < 1) {
      fighter.knockbackVx = 0;
    }
    if (Math.abs(fighter.knockbackVy) < 1) {
      fighter.knockbackVy = 0;
    }
    fighter.rageTimer = Math.max(0, fighter.rageTimer - dt);
    if (fighter.rageTimer <= 0) {
      fighter.rageCooldown = Math.max(0, fighter.rageCooldown - dt);
    }
    if (fighter.isPlayer && !fighter.downed && fighter.rageTimer <= 0 && fighter.rageCooldown <= 0) {
      fighter.rageCharge = Math.min(100, fighter.rageCharge + dt * 8);
    }
    if (playerHasInfiniteHealth(fighter) && isFighterActive(fighter)) {
      fighter.hp = fighter.maxHp;
    }

    if (fighter.respawn > 0) {
      fighter.respawn -= dt;
      if (fighter.respawn <= 0) {
        if (fighter.isPlayer && pendingRunReset) {
          if (fighter.playerSlot === 0) {
            shouldResetRoster = true;
          } else {
            fighter.respawn = 0;
          }
        } else {
          respawn(fighter);
        }
      }
      continue;
    }

    if (fighter.downed) {
      fighter.vx = 0;
      fighter.vy = 0;
      continue;
    }

    if (fighter.isPlayer) {
      updateHumanFighter(fighter, dt);
    } else if (fighter.team === "ally") {
      updateHelper(fighter, dt);
    } else if (fighter.isBoss) {
      updateBoss(fighter, dt);
    } else {
      updateBot(fighter, dt);
    }
  }

  updateCoopRevives(dt);
  updateBullets(dt);
  updateExplosions(dt);
  updateShopUpgrades(dt);
  const activeBoss = getBoss();
  if (!bossFightStarted) {
    updateLightning(dt, !shopActive);
    updateMeteors(dt, !shopActive);
    updateBurningFloors(dt);
    if (!shopActive) {
      updateMedkits(dt);
      updateShieldPickups(dt);
    }
    updateStars(dt, !shopActive);
  } else if (activeBoss?.bossKind === "skull") {
    updateLightning(dt, false);
    updateMeteors(dt, false);
    updateBurningFloors(dt);
  }

  if (shouldResetRoster) {
    spawnRoster();
  }

  maybeBroadcastSnapshot(dt);

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
  if (fighter.respawn > 0 && !fighter.downed) {
    return;
  }

  if (fighter.downed) {
    const reviveRatio = fighter.reviveProgress / COOP_REVIVE_TOUCH_DURATION;

    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    ctx.beginPath();
    ctx.ellipse(fighter.x, fighter.y + 5, fighter.radius + 4, fighter.radius - 1, 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "rgba(70, 76, 92, 0.95)";
    ctx.beginPath();
    ctx.arc(fighter.x, fighter.y, fighter.radius, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 236, 176, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(fighter.x, fighter.y, fighter.radius + 5, -Math.PI / 2, -Math.PI / 2 + TAU * reviveRatio);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(fighter.x - 4, fighter.y - 1, 8, 2);
    ctx.fillRect(fighter.x - 1, fighter.y - 4, 2, 8);
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

    const swordAngle = getIronBossSwordAngle(fighter);
    const swordReach = fighter.isBoss ? getBossArenaRadius() - 4 : 24;
    const swordX = fighter.x + Math.cos(swordAngle) * swordReach;
    const swordY = fighter.y + Math.sin(swordAngle) * swordReach;

    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.beginPath();
    ctx.ellipse(fighter.x, fighter.y + 9, fighter.radius + 8, fighter.radius - 2, 0, 0, TAU);
    ctx.fill();

    if (bossShieldActive()) {
      const shieldRadius = getBoss1ShieldRadius(fighter);
      const shieldStartAngle = getBoss1ShieldStartAngle(fighter);
      const shieldArcLength = getBoss1ShieldArcLength();
      const shieldAlpha = 0.65 + Math.sin(elapsed * 10) * 0.18;
      ctx.strokeStyle = `rgba(180, 215, 255, ${shieldAlpha})`;
      ctx.lineWidth = BOSS1_SHIELD_LINE_WIDTH;
      ctx.beginPath();
      ctx.arc(fighter.x, fighter.y, shieldRadius, shieldStartAngle, shieldStartAngle + shieldArcLength);
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

function drawShop() {
  if (!shopPhaseActive || shopItems.length === 0) {
    return;
  }

  for (const item of shopItems) {
    const label = item.itemType === "swords"
      ? "SWORD"
      : item.itemType === "regen"
        ? "REGEN"
        : item.itemType === "attackSpeed"
          ? "ATK"
          : item.itemType === "shockwave"
            ? "WAVE"
            : "PIER4";
    ctx.fillStyle = "rgba(18, 24, 38, 0.92)";
    ctx.fillRect(item.x - 12, item.y - 8, 24, 16);
    ctx.strokeStyle = "#f7d88a";
    ctx.lineWidth = 2;
    ctx.strokeRect(item.x - 12, item.y - 8, 24, 16);
    ctx.fillStyle = "#ffe9ad";
    ctx.font = "bold 7px monospace";
    ctx.fillText(label, item.x - 10, item.y - 12);
    ctx.fillText(`${item.cost}K`, item.x - 9, item.y + 2.5);
  }
}

function drawShopReadyButton() {
  if (!shopPhaseActive) {
    return;
  }

  const rect = getShopReadyButtonRect();
  ctx.fillStyle = "rgba(95, 193, 255, 0.92)";
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeStyle = "#dff6ff";
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1);
  ctx.fillStyle = "#102234";
  ctx.font = "bold 9px monospace";
  ctx.fillText("READY", rect.x + rect.width / 2 - 13, rect.y + 11);
}

function drawOrbitingSwords() {
  const player = getPrimaryPlayer();
  if (!player || orbitingSwords.length <= 0) {
    return;
  }

  for (const sword of orbitingSwords) {
    const angle = elapsed * ORBITAL_SWORD_SPIN_SPEED + sword.angleOffset;
    const swordX = player.x + Math.cos(angle) * ORBITAL_SWORD_RADIUS;
    const swordY = player.y + Math.sin(angle) * ORBITAL_SWORD_RADIUS;
    const tipX = swordX + Math.cos(angle) * 8;
    const tipY = swordY + Math.sin(angle) * 8;
    const tailX = swordX - Math.cos(angle) * 4;
    const tailY = swordY - Math.sin(angle) * 4;

    ctx.strokeStyle = "#f0f4ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    ctx.strokeStyle = "#a9b4c7";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(swordX, swordY);
    ctx.lineTo(tailX, tailY);
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
  const unresolvedLocalShotSeqs = new Set(
    guestPredictedBullets
      .map((bullet) => bullet.sourceInputSeq)
      .filter((sourceInputSeq): sourceInputSeq is number => sourceInputSeq !== null)
  );

  function drawBullet(bullet: Bullet) {
    const color = bullet.isCrit ? "#fff17a" : bullet.color;
    if (bullet.weapon === "laser") {
      const speed = Math.hypot(bullet.vx, bullet.vy) || 1;
      const dirX = bullet.vx / speed;
      const dirY = bullet.vy / speed;
      const trailLength = bullet.trailLength ?? 160;
      const tailX = bullet.x - dirX * trailLength;
      const tailY = bullet.y - dirY * trailLength;

      ctx.strokeStyle = "rgba(102, 246, 255, 0.16)";
      ctx.lineWidth = bullet.size * 3.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();

      ctx.strokeStyle = color;
      ctx.lineWidth = bullet.size * 1.45;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
      ctx.lineWidth = Math.max(1.5, bullet.size * 0.42);
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();

      ctx.fillStyle = "rgba(102, 246, 255, 0.28)";
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.size * 1.05, 0, TAU);
      ctx.fill();

      ctx.fillStyle = "#d6ffff";
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.size * 0.5, 0, TAU);
      ctx.fill();
      return;
    }

    ctx.fillStyle = color;
    ctx.fillRect(
      bullet.x - bullet.size / 2,
      bullet.y - bullet.size / 2,
      bullet.size,
      bullet.size
    );
  }

  for (const bullet of bullets) {
    if (bullet.sourceInputSeq !== null && unresolvedLocalShotSeqs.has(bullet.sourceInputSeq)) {
      continue;
    }
    drawBullet(bullet);
  }

  for (const bullet of guestAuthoritativeShotBullets) {
    drawBullet(bullet);
  }

  for (const bullet of guestPredictedBullets) {
    drawBullet(bullet);
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
  const player = getControlledPlayer();
  if (!player) {
    return;
  }

  const unlockedWeapons = getUnlockedWeapons(player.score);
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
  ctx.font = 'bold 8px "Courier New", monospace';
  ctx.fillText(progressBar.label, progressX + 5, progressY + 8);
  ctx.fillText("15", milestone15 - 5, progressY + 18);
  ctx.fillText("30", milestone30 - 5, progressY + 18);
  ctx.fillText("45", milestone45 - 5, progressY + 18);
  ctx.fillText("60", milestone60 - 5, progressY + 18);

  const attackSpeedFactor = Math.pow(PLAYER_ATTACK_SPEED_MULTIPLIER, attackSpeedUpgradeLevel);
  const hudX = 8;
  const hudY = 24;
  const hudLineStep = 9;
  const hudPadX = 4;
  const hudPadTop = 3;
  const hudPadBottom = 4;
  const hudTextX = hudX + hudPadX;
  const hudLines = [
    `HP ${Math.round((player.hp / player.maxHp) * 100)}%`,
    `Score ${player.score}`,
    `Crit ${Math.round(player.critChance * 100)}%`,
    `Damage X${player.damageMultiplier.toFixed(1)}`,
    `Shields ${player.shieldCount}`
  ];
  if (swordUpgradeLevel > 0) {
    hudLines.push(`Sword Orbit Lv ${swordUpgradeLevel}`);
  }
  if (regenUpgradeLevel > 0) {
    hudLines.push(`Regen +${REGEN_AMOUNT_PER_SECOND * regenUpgradeLevel} HP/s`);
  }
  if (attackSpeedUpgradeLevel > 0) {
    hudLines.push(`Attack Speed x${attackSpeedFactor.toFixed(2)}`);
  }
  if (fourthShotPierceUnlocked) {
    const shotsUntilPierce = 4 - (fourthShotPierceCounter % 4);
    hudLines.push(`4th Shot Pierce IN ${shotsUntilPierce}`);
  }
  if (shockwaveUnlocked) {
    hudLines.push(`Shockwave ${Math.max(0, shockwaveTimer).toFixed(1)}s`);
  }

  ctx.font = 'bold 8px "Courier New", monospace';
  const longestLineWidth = hudLines.reduce((maxWidth, line) => Math.max(maxWidth, ctx.measureText(line).width), 0);
  const hudWidth = Math.ceil(longestLineWidth + hudPadX * 2);
  const hudHeight = Math.ceil(hudPadTop + hudPadBottom + hudLines.length * hudLineStep);

  ctx.fillStyle = "rgba(14, 16, 24, 0.72)";
  ctx.fillRect(hudX, hudY, hudWidth, hudHeight);
  ctx.fillStyle = "#f5e7c8";
  let lineY = hudY + hudPadTop + 6;
  for (const line of hudLines) {
    ctx.fillText(line, hudTextX, lineY);
    lineY += hudLineStep;
  }

  const rageRect = touchControls.enabled
    ? getMobileRageButtonRect()
    : { x: hudX + hudWidth + 6, y: hudY, width: 70, height: 12 };
  const shieldRect = touchControls.enabled
    ? { x: 142, y: 24, width: 70, height: 12 }
    : { x: rageRect.x, y: rageRect.y + rageRect.height + 4, width: 78, height: 12 };
  if (player.shieldTimer > 0) {
    ctx.fillStyle = "rgba(95, 193, 255, 0.3)";
    ctx.fillRect(shieldRect.x, shieldRect.y, shieldRect.width, shieldRect.height);
    ctx.fillStyle = "#dff6ff";
    ctx.fillText(`SHIELD ${player.shieldTimer.toFixed(1)}s`, shieldRect.x + 4, shieldRect.y + 10);
  }

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
    ctx.font = "bold 7px monospace";
    ctx.fillText(
      player.rageTimer > 0
        ? `RAGE ${player.rageTimer.toFixed(1)}s`
        : player.rageCooldown > 0
          ? `CD ${player.rageCooldown.toFixed(1)}s`
          : "SPACE RAGE",
      rageRect.x + 4,
      rageRect.y + 9
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
    const threshold = weapon === "pistol" ? 0 : weapon === "smg" ? 5 : weapon === "shotgun" ? 10 : weapon === "laser" ? 15 : 20;
    ctx.fillText(`${index + 1}.${weapon.toUpperCase()} ${threshold}`, x + 5, rect.y + 9);
  });

  if (player.respawn > 0) {
    ctx.fillStyle = "rgba(18, 10, 20, 0.8)";
    ctx.fillRect(WORLD_WIDTH / 2 - 76, WORLD_HEIGHT / 2 - 17, 152, 34);
    ctx.fillStyle = "#fff1da";
    ctx.font = "bold 10px monospace";
    ctx.fillText(`RESPAWN ${player.respawn.toFixed(1)}s`, WORLD_WIDTH / 2 - 58, WORLD_HEIGHT / 2 + 3);
  }

  if (player.downed) {
    ctx.fillStyle = "rgba(18, 10, 20, 0.8)";
    ctx.fillRect(WORLD_WIDTH / 2 - 84, WORLD_HEIGHT / 2 - 17, 168, 34);
    ctx.fillStyle = "#fff1da";
    ctx.font = "bold 10px monospace";
    ctx.fillText("WAIT FOR REVIVE", WORLD_WIDTH / 2 - 48, WORLD_HEIGHT / 2 - 2);
    ctx.font = "bold 8px monospace";
    ctx.fillText(
      `${Math.round((player.reviveProgress / COOP_REVIVE_TOUCH_DURATION) * 100)}%`,
      WORLD_WIDTH / 2 - 12,
      WORLD_HEIGHT / 2 + 10
    );
  }

  if (shopPhaseActive && isFighterActive(player)) {
    ctx.fillStyle = "rgba(12, 16, 22, 0.8)";
    ctx.fillRect(WORLD_WIDTH - 156, 58, 148, 14);
    ctx.fillStyle = "#ffe8b2";
    ctx.font = "bold 7px monospace";
    ctx.fillText("TOUCH ITEMS OR PRESS READY", WORLD_WIDTH - 151, 67);
  }
}

function drawPauseOverlay() {
  if (!isPaused) {
    return;
  }
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
  drawShop();
  drawBullets();
  drawExplosions();
  drawLightning();
  drawMeteors();
  drawBurningFloors();
  drawBossTelegraphs();
  fighters.forEach(drawFighter);
  drawOrbitingSwords();
  drawHud();
  drawBossHud();
  drawTouchControls();
  drawShopReadyButton();
  drawPauseOverlay();
}

function setNetworkBanner(status: NetworkStatus, message: string) {
  networkStatus = status;
  networkMessage = message;
  menuOverlay.dataset.state = status;
  renderMenu();
}

function setMenuScreen(screen: MenuScreen) {
  menuScreen = screen;
  menuOpen = true;
  if (scannerMode) {
    void stopScanner(false);
  }
  renderMenu();
}

function clearShareArtifacts() {
  pendingShareLink = "";
  pendingReturnLink = "";
  linkInputValue = "";
  answerInputValue = "";
  updateQrImage("");
}

function openMenu(screen: MenuScreen = "home") {
  menuOpen = true;
  if (gameStarted) {
    isPaused = true;
    input.shoot = false;
  }
  menuScreen = screen;
  if (scannerMode) {
    void stopScanner(false);
  }
  renderMenu();
}

function closeMenu() {
  menuOpen = false;
  if (scannerMode) {
    void stopScanner(false);
  }
  if (gameStarted) {
    isPaused = false;
  }
  renderMenu();
}

function toggleGameMenu() {
  if (!gameStarted) {
    openMenu("home");
    return;
  }

  if (menuOpen) {
    closeMenu();
  } else {
    openMenu("home");
  }
}

function resetToMenuHome() {
  gameStarted = false;
  menuOpen = true;
  clearShareArtifacts();
  setMenuScreen("home");
  setNetworkBanner("offline", "Solo run");
}

function startSoloGame() {
  disconnectMultiplayer(false);
  gameStarted = true;
  isPaused = false;
  hostSimulationAccumulator = 0;
  guestInputAccumulator = 0;
  spawnRoster();
  closeMenu();
}

function startConnectedGame() {
  gameStarted = true;
  isPaused = false;
  hostSimulationAccumulator = 0;
  guestInputAccumulator = 0;
  closeMenu();
}

function createSessionId() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

function base64UrlEncodeBinary(binary: string) {
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecodeBinary(text: string) {
  const padding = text.length % 4 === 0 ? "" : "=".repeat(4 - (text.length % 4));
  return atob(text.replace(/-/g, "+").replace(/_/g, "/") + padding);
}

function bytesToBinary(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return binary;
}

function binaryToBytes(binary: string) {
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function base64UrlEncodeText(text: string) {
  return base64UrlEncodeBinary(bytesToBinary(new TextEncoder().encode(text)));
}

function base64UrlDecodeText(text: string) {
  return new TextDecoder().decode(binaryToBytes(base64UrlDecodeBinary(text)));
}

const sdpCompressionTable = [
  "candidate:",
  "typ host",
  "typ srflx",
  "typ relay",
  " generation 0",
  " network-id ",
  " network-cost ",
  " udp ",
  " tcptype active",
  "a=candidate:",
  "a=ice-ufrag:",
  "a=ice-pwd:",
  "a=fingerprint:sha-256 ",
  "a=setup:actpass",
  "a=setup:active",
  "a=mid:0",
  "a=sctp-port:5000",
  "a=max-message-size:262144",
  "a=sendrecv",
  "a=group:BUNDLE 0",
  "a=extmap-allow-mixed",
  "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
  "c=IN IP4 0.0.0.0",
  "s=-",
  "t=0 0"
] as const;

function compactSdp(sdp: string) {
  let compacted = sdp.replace(/\r\n/g, "\n");
  sdpCompressionTable.forEach((entry, index) => {
    compacted = compacted.split(entry).join(`~${index.toString(36)}~`);
  });
  return compacted;
}

function expandSdp(compacted: string) {
  let expanded = compacted;
  sdpCompressionTable.forEach((entry, index) => {
    expanded = expanded.split(`~${index.toString(36)}~`).join(entry);
  });
  return expanded.replace(/\n/g, "\r\n");
}

async function encodeSignal(signal: RTCSessionDescriptionInit) {
  const packed = JSON.stringify({
    t: signal.type,
    s: compactSdp(signal.sdp ?? "")
  });
  return `c.${base64UrlEncodeText(packed)}`;
}

async function decodeSignal(encoded: string) {
  const [codec, payload] = encoded.includes(".") ? encoded.split(".", 2) : ["p", encoded];
  if (codec === "c") {
    const parsed = JSON.parse(base64UrlDecodeText(payload)) as { t: RTCSdpType; s: string };
    return {
      type: parsed.t,
      sdp: expandSdp(parsed.s)
    } as RTCSessionDescriptionInit;
  }

  if (codec === "p") {
    return JSON.parse(base64UrlDecodeText(payload)) as RTCSessionDescriptionInit;
  }

  if (codec !== "z") {
    throw new Error("Unsupported invite format");
  }

  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser cannot read compressed invites");
  }

  const stream = new DecompressionStream("gzip");
  const writer = stream.writable.getWriter();
  await writer.write(binaryToBytes(base64UrlDecodeBinary(payload)));
  await writer.close();
  const json = await new Response(stream.readable).text();
  return JSON.parse(json) as RTCSessionDescriptionInit;
}

async function buildSignalLink(kind: "offer" | "answer", sessionId: string, signal: RTCSessionDescriptionInit) {
  const encodedSignal = await encodeSignal(signal);
  const url = new URL(window.location.href);
  url.hash = new URLSearchParams({
    p: kind === "offer" ? "o" : "a",
    s: sessionId,
    d: encodedSignal
  }).toString();
  return url.toString();
}

async function shareOrCopyLink(link: string, title: string) {
  if (!link) {
    return;
  }

  if (navigator.share) {
    try {
      await navigator.share({
        title,
        text: title,
        url: link
      });
      return;
    } catch {
      // Fall through to clipboard copy if share was cancelled or unavailable.
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(link);
    setNetworkBanner(networkStatus, "Link copied to clipboard");
  }
}

function relayAnswerToExistingHost(sessionId: string, signal: string) {
  const payload = JSON.stringify({ sessionId, signal, sentAt: Date.now() });
  try {
    localStorage.setItem(`${ANSWER_RELAY_KEY_PREFIX}${sessionId}`, payload);
  } catch {
    // Ignore storage failures and rely on manual fallback messaging.
  }

  try {
    answerRelayChannel?.postMessage({ sessionId, signal });
  } catch {
    // Ignore broadcast failures and rely on storage polling.
  }
}

function consumeStoredAnswer(sessionId: string) {
  const key = `${ANSWER_RELAY_KEY_PREFIX}${sessionId}`;
  const raw = localStorage.getItem(key);
  if (!raw) {
    return;
  }

  try {
    const payload = JSON.parse(raw) as { sessionId: string; signal: string };
    handleRelayMessage(payload.sessionId, payload.signal);
    localStorage.removeItem(key);
  } catch {
    localStorage.removeItem(key);
    setNetworkBanner("error", "Failed to read saved answer");
  }
}

async function stopScanner(renderAfter = true) {
  scannerMode = null;
  scannerError = "";
  scannerBusy = false;
  if (scannerAnimationFrameId) {
    cancelAnimationFrame(scannerAnimationFrameId);
    scannerAnimationFrameId = 0;
  }
  scannerVideo?.pause();
  scannerVideo = null;
  scannerStream?.getTracks().forEach((track) => track.stop());
  scannerStream = null;
  if (renderAfter) {
    renderMenu();
  }
}

async function processScannedCode(rawValue: string, mode: Exclude<ScannerMode, null>) {
  if (mode === "invite") {
    linkInputValue = rawValue;
    await handleInviteLink(rawValue);
    return;
  }

  answerInputValue = rawValue;
  await handleAnswerLink(rawValue);
}

async function tickScanner(detector: QrDetectorInstance, mode: Exclude<ScannerMode, null>) {
  if (!scannerVideo || scannerMode !== mode) {
    return;
  }

  try {
    const matches = await detector.detect(scannerVideo);
    const match = matches.find((candidate) => candidate.rawValue);
    if (match?.rawValue) {
      await stopScanner(false);
      await processScannedCode(match.rawValue, mode);
      renderMenu();
      return;
    }
  } catch {
    scannerError = "Camera is active, but QR detection is not available in this browser.";
    await stopScanner();
    return;
  }

  scannerAnimationFrameId = requestAnimationFrame(() => {
    void tickScanner(detector, mode);
  });
}

async function startScanner(mode: Exclude<ScannerMode, null>) {
  if (!navigator.mediaDevices?.getUserMedia) {
    const message = window.isSecureContext
      ? "Camera scanning is not available in this browser. Paste the link instead."
      : "Camera scanning needs HTTPS (or localhost). On phone, open the game over HTTPS and use the text field for now.";
    scannerError = message;
    setNetworkBanner("error", message);
    return;
  }

  if (!BarcodeDetectorClass) {
    const message = "QR scanning is not supported in this browser. Paste the link instead.";
    scannerError = message;
    setNetworkBanner("error", message);
    return;
  }

  await stopScanner(false);
  scannerMode = mode;
  scannerBusy = true;
  scannerError = "";
  renderMenu();

  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: {
          ideal: "environment"
        }
      }
    });
    scannerVideo = menuOverlay.querySelector<HTMLVideoElement>("#menu-scanner-video");
    if (!scannerVideo) {
      throw new Error("Scanner preview failed to initialize");
    }

    scannerVideo.srcObject = scannerStream;
    await scannerVideo.play();
    const detector = new BarcodeDetectorClass({
      formats: ["qr_code"]
    });
    setNetworkBanner("waiting-for-peer", "Camera ready. Point it at the QR code.");
    void tickScanner(detector, mode);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start the camera. Paste the link instead.";
    await stopScanner(false);
    scannerError = message;
    setNetworkBanner("error", message);
  }
}

function clearConnectionTimeout() {
  if (connectionTimeoutId !== null) {
    window.clearTimeout(connectionTimeoutId);
    connectionTimeoutId = null;
  }
}

function scheduleConnectionTimeout(role: MultiplayerRole) {
  clearConnectionTimeout();
  connectionTimeoutId = window.setTimeout(() => {
    if (dataChannel?.readyState === "open") {
      return;
    }

    setNetworkBanner(
      "error",
      role === "host"
        ? "Still connecting. Keep the guest page open. If this is over the internet, direct no-server P2P may be blocked by NAT/firewalls."
        : "Still connecting. Keep this page open while the host accepts the return link."
    );
  }, 12000);
}

function clearOutgoingGuestCommands() {
  clearControlCommands(outgoingGuestCommands);
}

function resetRemoteControlState() {
  Object.assign(remoteInput, createControlState());
  clearControlCommands(remoteCommands);
  lastProcessedRemoteInputSequence = 0;
}

function sendPacket(packet: NetworkPacket) {
  if (!dataChannel || dataChannel.readyState !== "open") {
    return;
  }

  dataChannel.send(JSON.stringify(packet));
}

function handleNetworkPacket(raw: string) {
  try {
    const packet = JSON.parse(raw) as NetworkPacket;
    if (packet.type === "input" && multiplayerRole === "host") {
      Object.assign(remoteInput, packet.payload);
      remoteCommands.weaponSlot = packet.payload.weaponSlot;
      remoteCommands.shieldPressed = packet.payload.shieldPressed;
      remoteCommands.ragePressed = packet.payload.ragePressed;
      lastProcessedRemoteInputSequence = Math.max(lastProcessedRemoteInputSequence, packet.payload.seq);
      return;
    }

    if (packet.type === "snapshot" && multiplayerRole === "guest") {
      queueGuestSnapshot(packet.payload);
      return;
    }

    if (packet.type === "shot" && multiplayerRole === "guest") {
      applyAuthoritativeShotEvent(packet.payload);
    }
  } catch {
    setNetworkBanner("error", "Received invalid network packet");
  }
}

function attachDataChannel(channel: RTCDataChannel) {
  dataChannel = channel;
  dataChannel.onopen = () => {
    clearConnectionTimeout();
    if (multiplayerRole === "host") {
      ensureRemotePlayerPresent();
      setNetworkBanner("connected", "Host connected to guest");
      if (!gameStarted) {
        spawnRoster();
      }
      startConnectedGame();
    } else if (multiplayerRole === "guest") {
      setNetworkBanner("connected", "Guest connected to host");
      startConnectedGame();
    }
  };
  dataChannel.onclose = () => {
    clearConnectionTimeout();
    if (multiplayerRole === "host") {
      removeRemotePlayer();
      resetRemoteControlState();
      gameStarted = false;
      multiplayerRole = "solo";
      setMenuScreen("home");
      setNetworkBanner("offline", "Peer disconnected");
    } else if (multiplayerRole === "guest") {
      gameStarted = false;
      multiplayerRole = "solo";
      resetRemoteControlState();
      setMenuScreen("home");
      setNetworkBanner("offline", "Connection closed");
    } else {
      setNetworkBanner("offline", "Solo run");
    }
  };
  dataChannel.onmessage = (event) => {
    handleNetworkPacket(String(event.data));
  };
}

function attachPeerConnection(connection: RTCPeerConnection) {
  peerConnection = connection;
  peerConnection.ondatachannel = (event) => {
    attachDataChannel(event.channel);
  };
  peerConnection.onconnectionstatechange = () => {
    const state = peerConnection?.connectionState;
    if (state === "failed") {
      clearConnectionTimeout();
      setNetworkBanner("error", "Peer connection failed");
    } else if (state === "connecting") {
      setNetworkBanner("connecting", multiplayerRole === "host" ? "Host connecting..." : "Guest connecting...");
      scheduleConnectionTimeout(multiplayerRole);
    } else if (state === "disconnected") {
      clearConnectionTimeout();
      setNetworkBanner("error", "Peer disconnected during setup");
    } else if (state === "connected") {
      clearConnectionTimeout();
    }
  };
  peerConnection.oniceconnectionstatechange = () => {
    const state = peerConnection?.iceConnectionState;
    if (state === "checking") {
      setNetworkBanner("connecting", multiplayerRole === "host" ? "Host connecting..." : "Guest connecting...");
      scheduleConnectionTimeout(multiplayerRole);
    } else if (state === "failed") {
      clearConnectionTimeout();
      setNetworkBanner(
        "error",
        "Direct peer connection failed. This no-server mode needs compatible NAT/firewall conditions or the same LAN."
      );
    }
  };
}

async function waitForIceCompletion(connection: RTCPeerConnection, timeoutMs = 2500) {
  if (connection.iceGatheringState === "complete") {
    return;
  }

  await new Promise<void>((resolve) => {
    const timeoutId = window.setTimeout(() => {
      connection.removeEventListener("icegatheringstatechange", onGatheringStateChange);
      resolve();
    }, timeoutMs);

    const onGatheringStateChange = () => {
      if (connection.iceGatheringState === "complete") {
        window.clearTimeout(timeoutId);
        connection.removeEventListener("icegatheringstatechange", onGatheringStateChange);
        resolve();
      }
    };
    connection.addEventListener("icegatheringstatechange", onGatheringStateChange);
  });
}

function closeNetworkConnection() {
  clearConnectionTimeout();
  resetGuestSnapshotInterpolation();
  dataChannel?.close();
  dataChannel = null;
  peerConnection?.close();
  peerConnection = null;
}

async function startHostingSession() {
  if (typeof RTCPeerConnection === "undefined") {
    throw new Error("This browser does not support WebRTC hosting");
  }

  const setupVersion = ++hostSetupVersion;
  closeNetworkConnection();
  resetRemoteControlState();
  removeRemotePlayer();
  multiplayerRole = "host";
  const sessionId = createSessionId();
  pendingSessionId = sessionId;
  gameStarted = false;
  clearShareArtifacts();
  setMenuScreen("host");
  setNetworkBanner("preparing", "Preparing host offer...");

  const connection = new RTCPeerConnection(rtcConfiguration);
  attachPeerConnection(connection);
  attachDataChannel(connection.createDataChannel("pixel-bot-brawler", {
    ordered: true
  }));
  const offer = await connection.createOffer();
  await connection.setLocalDescription(offer);
  await waitForIceCompletion(connection);
  if (setupVersion !== hostSetupVersion || multiplayerRole !== "host" || pendingSessionId !== sessionId) {
    connection.close();
    return;
  }
  if (!connection.localDescription) {
    throw new Error("Host offer not available");
  }
  const shareLink = await buildSignalLink("offer", sessionId, connection.localDescription);
  if (setupVersion !== hostSetupVersion || multiplayerRole !== "host" || pendingSessionId !== sessionId) {
    connection.close();
    return;
  }
  pendingShareLink = shareLink;
  updateQrImage(pendingShareLink);
  setNetworkBanner(
    "waiting-for-peer",
    connection.iceGatheringState === "complete"
      ? "Waiting for your friend to open the invite"
      : "Invite ready. If connection fails, wait a moment and create a fresh invite."
  );
  consumeStoredAnswer(sessionId);
}

async function joinSessionFromOffer(encodedSignal: string, sessionId: string) {
  const setupVersion = ++guestSetupVersion;
  closeNetworkConnection();
  resetRemoteControlState();
  multiplayerRole = "guest";
  pendingSessionId = sessionId;
  gameStarted = false;
  clearShareArtifacts();
  setNetworkBanner("joining", "Joining host offer...");

  const connection = new RTCPeerConnection(rtcConfiguration);
  attachPeerConnection(connection);
  const offer = await decodeSignal(encodedSignal);
  if (setupVersion !== guestSetupVersion || multiplayerRole !== "guest" || pendingSessionId !== sessionId) {
    connection.close();
    return;
  }
  await connection.setRemoteDescription(offer);
  const answer = await connection.createAnswer();
  await connection.setLocalDescription(answer);
  await waitForIceCompletion(connection);
  if (setupVersion !== guestSetupVersion || multiplayerRole !== "guest" || pendingSessionId !== sessionId) {
    connection.close();
    return;
  }
  if (!connection.localDescription) {
    throw new Error("Guest answer not available");
  }
  const returnLink = await buildSignalLink("answer", sessionId, connection.localDescription);
  if (setupVersion !== guestSetupVersion || multiplayerRole !== "guest" || pendingSessionId !== sessionId) {
    connection.close();
    return;
  }
  pendingReturnLink = returnLink;
  updateQrImage(pendingReturnLink);
  setMenuScreen("guest-share");
  setNetworkBanner(
    "waiting-for-peer",
    connection.iceGatheringState === "complete"
      ? "Share the return link back to the host"
      : "Reply ready. If connection fails, wait a moment and rescan the invite."
  );
  scheduleConnectionTimeout("guest");
}

async function applyGuestAnswer(encodedSignal: string) {
  if (!peerConnection || multiplayerRole !== "host") {
    throw new Error("Create a host offer first");
  }

  const answer = await decodeSignal(encodedSignal);
  await peerConnection.setRemoteDescription(answer);
  setNetworkBanner("connecting", "Waiting for data channel. Keep the guest page open.");
  scheduleConnectionTimeout("host");
  localStorage.removeItem(`${ANSWER_RELAY_KEY_PREFIX}${pendingSessionId}`);
}

function disconnectMultiplayer(showMenu = true) {
  hostSetupVersion += 1;
  guestSetupVersion += 1;
  closeNetworkConnection();
  resetRemoteControlState();
  clearOutgoingGuestCommands();
  resetGuestPredictionState();
  hostSimulationAccumulator = 0;
  simulationTick = 0;
  removeRemotePlayer();
  multiplayerRole = "solo";
  pendingSessionId = "";
  clearShareArtifacts();
  gameStarted = false;
  menuOpen = showMenu;
  isPaused = false;

  if (showMenu) {
    setMenuScreen("home");
  }
  setNetworkBanner("offline", "Solo run");
}

function maybeBroadcastSnapshot(dt: number) {
  if (multiplayerRole !== "host" || !dataChannel || dataChannel.readyState !== "open") {
    return;
  }

  snapshotBroadcastTimer -= dt;
  if (snapshotBroadcastTimer > 0) {
    return;
  }

  snapshotBroadcastTimer = SNAPSHOT_SEND_INTERVAL;
  sendPacket({
    type: "snapshot",
    payload: createNetworkSnapshot()
  });
}

function maybeSendGuestInput() {
  if (multiplayerRole !== "guest" || !dataChannel || dataChannel.readyState !== "open") {
    return;
  }

  localInputSequence += 1;
  const commands = cloneControlCommandState(outgoingGuestCommands);
  const controls = cloneControlState(input);
  guestPendingInputs.push({
    seq: localInputSequence,
    dt: GUEST_INPUT_SEND_INTERVAL,
    controls,
    commands
  });
  sendPacket({
    type: "input",
    payload: {
      ...controls,
      ...commands,
      seq: localInputSequence
    }
  });
  clearOutgoingGuestCommands();
}

async function handleInviteLink(rawLink: string) {
  let parsed: URL;
  try {
    parsed = new URL(rawLink.trim(), window.location.href);
  } catch {
    throw new Error("That link does not look valid");
  }

  const params = new URLSearchParams(parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash);
  const type = params.get("p") ?? params.get("p2p");
  const signal = params.get("d") ?? params.get("signal");
  const sessionId = params.get("s") ?? params.get("session");

  if (!signal || !sessionId || (type !== "o" && type !== "offer")) {
    throw new Error("Invite link is missing offer data");
  }

  await joinSessionFromOffer(signal, sessionId);
}

async function handleAnswerLink(rawLink: string) {
  let parsed: URL;
  try {
    parsed = new URL(rawLink.trim(), window.location.href);
  } catch {
    throw new Error("That reply link does not look valid");
  }

  const params = new URLSearchParams(parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash);
  const type = params.get("p") ?? params.get("p2p");
  const signal = params.get("d") ?? params.get("signal");
  const sessionId = params.get("s") ?? params.get("session");

  if (!signal || !sessionId || (type !== "a" && type !== "answer")) {
    throw new Error("Reply link is missing answer data");
  }

  if (pendingSessionId && sessionId !== pendingSessionId) {
    throw new Error(
      `This reply is for room ${getShortSessionLabel(sessionId)}, but this host screen is room ${getShortSessionLabel(pendingSessionId)}`
    );
  }

  await applyGuestAnswer(signal);
}

function handleRelayMessage(sessionId: string, signal: string) {
  if (multiplayerRole !== "host" || sessionId !== pendingSessionId) {
    return;
  }

  void applyGuestAnswer(signal).catch((error: unknown) => {
    setNetworkBanner("error", error instanceof Error ? error.message : "Failed to apply answer");
  });
}

function processIncomingRoute() {
  const params = new URLSearchParams(window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "");
  const type = params.get("p") ?? params.get("p2p");
  const signal = params.get("d") ?? params.get("signal");
  const sessionId = params.get("s") ?? params.get("session");

  if (!type || !signal || !sessionId) {
    return;
  }

  if (type === "o" || type === "offer") {
    linkInputValue = window.location.href;
    setMenuScreen("join");
    void handleInviteLink(window.location.href).catch((error: unknown) => {
      setNetworkBanner("error", error instanceof Error ? error.message : "Failed to join from invite");
    });
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    return;
  }

  if (type === "a" || type === "answer") {
    relayAnswerToExistingHost(sessionId, signal);
    setMenuScreen("relay-answer");
    setNetworkBanner("waiting-for-peer", "If the host room is open on this device, the answer was sent to it automatically.");
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }
}

menuOverlay.addEventListener("click", (event) => {
  const copyField = (event.target as HTMLElement).closest<HTMLTextAreaElement>("textarea[data-copy-value]");
  if (copyField) {
    const value = copyField.dataset.copyValue ?? copyField.value;
    if (value && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(value).then(() => {
        setNetworkBanner(networkStatus, "Link copied to clipboard");
      });
    }
    return;
  }

  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  if (action === "new-game") {
    startSoloGame();
    return;
  }

  if (action === "resume-game") {
    closeMenu();
    return;
  }

  if (action === "play-friend") {
    setMenuScreen("friend");
    return;
  }

  if (action === "show-rules") {
    setMenuScreen("rules");
    return;
  }

  if (action === "back-home" || action === "home-from-relay") {
    resetToMenuHome();
    return;
  }

  if (action === "back-friend") {
    setMenuScreen("friend");
    return;
  }

  if (action === "create-room") {
    setMenuScreen("host");
    void startHostingSession().catch((error: unknown) => {
      setMenuScreen("host");
      setNetworkBanner("error", error instanceof Error ? error.message : "Failed to create game");
    });
    return;
  }

  if (action === "show-join") {
    setMenuScreen("join");
    return;
  }

  if (action === "join-link") {
    const field = menuOverlay.querySelector<HTMLTextAreaElement>("#menu-link-input");
    linkInputValue = field?.value ?? "";
    void handleInviteLink(linkInputValue).catch((error: unknown) => {
      setNetworkBanner("error", error instanceof Error ? error.message : "Failed to join game");
    });
    return;
  }

  if (action === "scan-invite") {
    void startScanner("invite");
    return;
  }

  if (action === "scan-reply") {
    void startScanner("reply");
    return;
  }

  if (action === "stop-scan") {
    void stopScanner();
    return;
  }

  if (action === "connect-reply") {
    const field = menuOverlay.querySelector<HTMLTextAreaElement>("#menu-answer-input");
    answerInputValue = field?.value ?? "";
    void handleAnswerLink(answerInputValue).catch((error: unknown) => {
      setNetworkBanner("error", error instanceof Error ? error.message : "Failed to apply guest reply");
    });
    return;
  }

  if (action === "share-link") {
    const link = menuScreen === "guest-share" ? pendingReturnLink : pendingShareLink;
    const label = menuScreen === "guest-share" ? "Pixel Bot Brawler return link" : "Pixel Bot Brawler invite";
    void shareOrCopyLink(link, label);
    return;
  }

  if (action === "copy-link") {
    const link = menuScreen === "guest-share" ? pendingReturnLink : pendingShareLink;
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(link).then(() => {
        setNetworkBanner(networkStatus, "Link copied to clipboard");
      });
    }
    return;
  }

  if (action === "cancel-room") {
    disconnectMultiplayer();
  }
});

menuOverlay.addEventListener("pointerdown", (event) => {
  const copyField = (event.target as HTMLElement).closest<HTMLTextAreaElement>("textarea[data-copy-value]");
  if (!copyField) {
    return;
  }

  event.preventDefault();
  copyField.blur();
});

window.addEventListener("storage", (event) => {
  if (!event.key?.startsWith(ANSWER_RELAY_KEY_PREFIX) || !event.newValue) {
    return;
  }

  try {
    const payload = JSON.parse(event.newValue) as { sessionId: string; signal: string };
    handleRelayMessage(payload.sessionId, payload.signal);
  } catch {
    setNetworkBanner("error", "Failed to read answer hand-off");
  }
});

if ("BroadcastChannel" in window) {
  answerRelayChannel = new BroadcastChannel("pixel-bot-brawler-answer-relay");
  answerRelayChannel.addEventListener("message", (event: MessageEvent<{ sessionId: string; signal: string }>) => {
    handleRelayMessage(event.data.sessionId, event.data.signal);
  });
}

renderMenu();
processIncomingRoute();

let previous = performance.now();

function frame(now: number) {
  const frameDt = Math.min(MAX_FRAME_DT, (now - previous) / 1000);
  previous = now;

  if (gameStarted && !isPaused) {
    if (multiplayerRole !== "guest") {
      hostSimulationAccumulator += frameDt;
      while (hostSimulationAccumulator >= SIMULATION_DT) {
        hostSimulationAccumulator -= SIMULATION_DT;
        simulationTick += 1;
        update(SIMULATION_DT);
      }
    } else {
      guestInputAccumulator += frameDt;
      while (guestInputAccumulator >= GUEST_INPUT_SEND_INTERVAL) {
        guestInputAccumulator -= GUEST_INPUT_SEND_INTERVAL;
        maybeSendGuestInput();
      }
      advanceGuestSnapshotInterpolation(frameDt);
      applyGuestPrediction();
      updateVisualOnlyBullets(guestAuthoritativeShotBullets, frameDt);
    }
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

function isTextEntryTarget(target: EventTarget | null) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
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

function trySelectWeapon(slot: number, player = getControlledPlayer()) {
  if (!player) {
    return;
  }

  const weapon = weaponOrder[slot];
  if (!weapon) {
    return;
  }

  if (getUnlockedWeapons(player.score).includes(weapon)) {
    player.selectedWeapon = weapon;
  }
}

function queueGuestWeaponSelection(slot: number) {
  outgoingGuestCommands.weaponSlot = slot;
}

function queueGuestShield() {
  outgoingGuestCommands.shieldPressed = true;
}

function queueGuestRage() {
  outgoingGuestCommands.ragePressed = true;
}

function togglePause() {
  toggleGameMenu();
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
    const player = getControlledPlayer();

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
    return true;
  }

  if (shopPhaseActive) {
    const readyRect = getShopReadyButtonRect();
    if (
      multiplayerRole !== "guest" &&
      isInsideRect(point.x, point.y, readyRect.x, readyRect.y, readyRect.width, readyRect.height)
    ) {
      endShopPhase();
      return true;
    }
  }

  if (touchControls.enabled) {
    const rageRect = getMobileRageButtonRect();
    if (isInsideRect(point.x, point.y, rageRect.x, rageRect.y, rageRect.width, rageRect.height)) {
      const player = getControlledPlayer();
      if (player && multiplayerRole !== "guest") {
        activateRage(player);
      } else if (multiplayerRole === "guest") {
        queueGuestRage();
      }
      return true;
    }

    for (let index = 0; index < weaponOrder.length; index += 1) {
      const rect = getMobileWeaponButtonRect(index);
      if (isInsideRect(point.x, point.y, rect.x, rect.y, rect.width, rect.height)) {
        if (multiplayerRole === "guest") {
          queueGuestWeaponSelection(index);
        } else {
          trySelectWeapon(index);
        }
        return true;
      }
    }
  }

  return false;
}

window.addEventListener("keydown", (event) => {
  if (isTextEntryTarget(event.target)) {
    return;
  }

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
    const player = getPrimaryPlayer();
    if (devInfiniteHealth && player) {
      player.hp = player.maxHp;
    }
    event.preventDefault();
    return;
  }

  if (event.key === "+" || event.code === "NumpadAdd") {
    const player = getPrimaryPlayer();
    if (player) {
      player.score += DEBUG_SHOP_POINTS_BONUS;
      playPickupSound();
    }
    event.preventDefault();
    return;
  }

  if (event.code === "KeyP" || event.code === "Escape") {
    toggleGameMenu();
    event.preventDefault();
    return;
  }

  setMovementKey(event.code, true);
  if (event.code === "KeyE") {
    const player = getControlledPlayer();
    if (multiplayerRole === "guest") {
      queueGuestShield();
    } else if (player && !isPaused) {
      activateShield(player);
    }
  }
  if (event.code === "Space") {
    const player = getControlledPlayer();
    if (multiplayerRole === "guest") {
      queueGuestRage();
    } else if (player && !isPaused) {
      activateRage(player);
    }
    event.preventDefault();
  }
  if (event.code === "Digit0" || event.code === "Numpad0") {
    const player = getControlledPlayer();
    if (multiplayerRole !== "guest" && player && !isPaused) {
      createHelper("red", player);
    }
    event.preventDefault();
    return;
  }
  if (event.code === "Digit9" || event.code === "Numpad9") {
    const player = getControlledPlayer();
    if (multiplayerRole !== "guest" && player && !isPaused) {
      createHelper("green", player);
    }
    event.preventDefault();
    return;
  }
  if (event.code === "Digit1") multiplayerRole === "guest" ? queueGuestWeaponSelection(0) : trySelectWeapon(0);
  if (event.code === "Digit2") multiplayerRole === "guest" ? queueGuestWeaponSelection(1) : trySelectWeapon(1);
  if (event.code === "Digit3") multiplayerRole === "guest" ? queueGuestWeaponSelection(2) : trySelectWeapon(2);
  if (event.code === "Digit4") multiplayerRole === "guest" ? queueGuestWeaponSelection(3) : trySelectWeapon(3);
  if (event.code === "Digit5") multiplayerRole === "guest" ? queueGuestWeaponSelection(4) : trySelectWeapon(4);

  if (event.code.startsWith("Arrow") || event.code.startsWith("Key")) {
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  if (isTextEntryTarget(event.target)) {
    return;
  }

  setMovementKey(event.code, false);

  if (event.code.startsWith("Arrow") || event.code.startsWith("Key")) {
    event.preventDefault();
  }
});
window.addEventListener("blur", () => {
  resetMovementInputState();
  input.shoot = false;
});

canvas.addEventListener("mousemove", updateMousePosition);
canvas.addEventListener("mousedown", (event) => {
  ensureAudio();
  audioContext?.resume();

  updateMousePosition(event);

  if (isPaused) {
    return;
  }

  if (shopPhaseActive) {
    const readyRect = getShopReadyButtonRect();
    if (
      multiplayerRole !== "guest" &&
      isInsideRect(input.mouseX, input.mouseY, readyRect.x, readyRect.y, readyRect.width, readyRect.height)
    ) {
      endShopPhase();
      return;
    }
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

function createRuntimeSnapshot(): RuntimeSnapshot {
  return {
    fighters: structuredClone(fighters),
    bullets: structuredClone(bullets),
    lightningStrikes: structuredClone(lightningStrikes),
    meteors: structuredClone(meteors),
    burningFloors: structuredClone(burningFloors),
    medkits: structuredClone(medkits),
    stars: structuredClone(stars),
    shieldPickups: structuredClone(shieldPickups),
    explosions: structuredClone(explosions),
    shopItems: structuredClone(shopItems),
    shopPhaseActive,
    swordUpgradeLevel,
    regenUpgradeLevel,
    attackSpeedUpgradeLevel,
    fourthShotPierceUnlocked,
    fourthShotPierceCounter,
    shockwaveUnlocked,
    shockwaveTimer,
    swordSpawnTimer,
    regenTickTimer,
    orbitingSwords: structuredClone(orbitingSwords),
    nextId,
    elapsed,
    lightningCooldown,
    meteorCooldown,
    medkitCooldown,
    starCooldown,
    shieldPickupCooldown,
    selectedWeapon: getPrimaryPlayer()?.selectedWeapon ?? "pistol",
    highestUnlockedWeapon: getPrimaryPlayer()?.highestUnlockedWeapon ?? "pistol",
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
}

function cloneObjectArray<T extends object>(items: T[]) {
  return items.map((item) => ({ ...item }));
}

function blendNumber(from: number, to: number, alpha: number) {
  return from + (to - from) * alpha;
}

function blendAngle(from: number, to: number, alpha: number) {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * alpha;
}

function syncObjectArray<T extends object>(target: T[], source: T[]) {
  for (let index = 0; index < source.length; index += 1) {
    const sourceItem = source[index];
    if (index < target.length) {
      Object.assign(target[index], sourceItem);
    } else {
      target.push({ ...sourceItem });
    }
  }
  target.length = source.length;
}

function syncBlendedObjectArray<T extends object>(
  target: T[],
  fromItems: T[],
  toItems: T[],
  alpha: number,
  blendItem: (fromItem: T | undefined, toItem: T, blendAlpha: number) => T
) {
  for (let index = 0; index < toItems.length; index += 1) {
    const blendedItem = blendItem(fromItems[index], toItems[index], alpha);
    if (index < target.length) {
      Object.assign(target[index], blendedItem);
    } else {
      target.push(blendedItem);
    }
  }
  target.length = toItems.length;
}

function getNetworkFighterController(fighter: Fighter) {
  return fighter.playerSlot === 1 && multiplayerRole === "guest"
    ? "local"
    : fighter.playerSlot === 1
      ? "remote"
      : fighter.controller ?? "local";
}

function syncNetworkFighterArray(target: Fighter[], source: Fighter[]) {
  for (let index = 0; index < source.length; index += 1) {
    const fighter = source[index];
    const normalizedFighter = {
      ...fighter,
      controller: getNetworkFighterController(fighter),
      downed: fighter.downed ?? false,
      reviveProgress: fighter.reviveProgress ?? 0,
      knockbackVx: fighter.knockbackVx ?? 0,
      knockbackVy: fighter.knockbackVy ?? 0
    };
    if (index < target.length) {
      Object.assign(target[index], normalizedFighter);
    } else {
      target.push(normalizedFighter);
    }
  }
  target.length = source.length;
}

function blendFighter(fromFighter: Fighter | undefined, toFighter: Fighter, alpha: number) {
  if (!fromFighter) {
    return {
      ...toFighter,
      controller: getNetworkFighterController(toFighter),
      downed: toFighter.downed ?? false,
      reviveProgress: toFighter.reviveProgress ?? 0,
      knockbackVx: toFighter.knockbackVx ?? 0,
      knockbackVy: toFighter.knockbackVy ?? 0
    };
  }

  return {
    ...toFighter,
    x: blendNumber(fromFighter.x, toFighter.x, alpha),
    y: blendNumber(fromFighter.y, toFighter.y, alpha),
    dir: blendAngle(fromFighter.dir, toFighter.dir, alpha),
    hp: blendNumber(fromFighter.hp, toFighter.hp, alpha),
    respawn: blendNumber(fromFighter.respawn, toFighter.respawn, alpha),
    flash: blendNumber(fromFighter.flash, toFighter.flash, alpha),
    shieldTimer: blendNumber(fromFighter.shieldTimer, toFighter.shieldTimer, alpha),
    rageCharge: blendNumber(fromFighter.rageCharge, toFighter.rageCharge, alpha),
    rageTimer: blendNumber(fromFighter.rageTimer, toFighter.rageTimer, alpha),
    rageCooldown: blendNumber(fromFighter.rageCooldown, toFighter.rageCooldown, alpha),
    knockbackVx: blendNumber(fromFighter.knockbackVx ?? 0, toFighter.knockbackVx ?? 0, alpha),
    knockbackVy: blendNumber(fromFighter.knockbackVy ?? 0, toFighter.knockbackVy ?? 0, alpha),
    controller: getNetworkFighterController(toFighter),
    downed: toFighter.downed ?? false,
    reviveProgress: blendNumber(fromFighter.reviveProgress ?? 0, toFighter.reviveProgress ?? 0, alpha)
  };
}

function blendBullet(fromBullet: Bullet | undefined, toBullet: Bullet, alpha: number) {
  if (!fromBullet) {
    return { ...toBullet };
  }

  return {
    ...toBullet,
    x: blendNumber(fromBullet.x, toBullet.x, alpha),
    y: blendNumber(fromBullet.y, toBullet.y, alpha),
    size: blendNumber(fromBullet.size, toBullet.size, alpha)
  };
}

function blendLightningStrike(
  fromStrike: LightningStrike | undefined,
  toStrike: LightningStrike,
  alpha: number
) {
  if (!fromStrike) {
    return { ...toStrike };
  }

  return {
    ...toStrike,
    x: blendNumber(fromStrike.x, toStrike.x, alpha),
    timer: blendNumber(fromStrike.timer, toStrike.timer, alpha),
    duration: blendNumber(fromStrike.duration, toStrike.duration, alpha),
    warning: blendNumber(fromStrike.warning, toStrike.warning, alpha)
  };
}

function blendMeteor(fromMeteor: Meteor | undefined, toMeteor: Meteor, alpha: number) {
  if (!fromMeteor) {
    return { ...toMeteor };
  }

  return {
    ...toMeteor,
    x: blendNumber(fromMeteor.x, toMeteor.x, alpha),
    y: blendNumber(fromMeteor.y, toMeteor.y, alpha),
    timer: blendNumber(fromMeteor.timer, toMeteor.timer, alpha),
    warning: blendNumber(fromMeteor.warning, toMeteor.warning, alpha),
    fallDuration: blendNumber(fromMeteor.fallDuration, toMeteor.fallDuration, alpha),
    radius: blendNumber(fromMeteor.radius, toMeteor.radius, alpha)
  };
}

function blendBurningFloor(fromFloor: BurningFloor | undefined, toFloor: BurningFloor, alpha: number) {
  if (!fromFloor) {
    return { ...toFloor };
  }

  return {
    ...toFloor,
    x: blendNumber(fromFloor.x, toFloor.x, alpha),
    y: blendNumber(fromFloor.y, toFloor.y, alpha),
    radius: blendNumber(fromFloor.radius, toFloor.radius, alpha),
    timer: blendNumber(fromFloor.timer, toFloor.timer, alpha),
    maxTimer: blendNumber(fromFloor.maxTimer, toFloor.maxTimer, alpha),
    damageTick: blendNumber(fromFloor.damageTick, toFloor.damageTick, alpha)
  };
}

function blendExplosion(fromExplosion: Explosion | undefined, toExplosion: Explosion, alpha: number) {
  if (!fromExplosion) {
    return { ...toExplosion };
  }

  return {
    ...toExplosion,
    x: blendNumber(fromExplosion.x, toExplosion.x, alpha),
    y: blendNumber(fromExplosion.y, toExplosion.y, alpha),
    radius: blendNumber(fromExplosion.radius, toExplosion.radius, alpha),
    timer: blendNumber(fromExplosion.timer, toExplosion.timer, alpha),
    maxTimer: blendNumber(fromExplosion.maxTimer, toExplosion.maxTimer, alpha)
  };
}

function createNetworkSnapshot(): NetworkSnapshot {
  return {
    fighters: cloneObjectArray(fighters),
    bullets: cloneObjectArray(bullets),
    lightningStrikes: cloneObjectArray(lightningStrikes),
    meteors: cloneObjectArray(meteors),
    burningFloors: cloneObjectArray(burningFloors),
    medkits: cloneObjectArray(medkits),
    stars: cloneObjectArray(stars),
    shieldPickups: cloneObjectArray(shieldPickups),
    explosions: cloneObjectArray(explosions),
    shopItems: cloneObjectArray(shopItems),
    orbitingSwords: cloneObjectArray(orbitingSwords),
    shopPhaseActive,
    swordUpgradeLevel,
    regenUpgradeLevel,
    attackSpeedUpgradeLevel,
    fourthShotPierceUnlocked,
    fourthShotPierceCounter,
    shockwaveUnlocked,
    shockwaveTimer,
    elapsed,
    survivalWithoutDeath,
    bossFightStarted,
    bossFightWon,
    bossIntroTimer,
    bossAttackType,
    bossAttackWindup,
    bossAttackAngle,
    bossesDefeated,
    serverTick: simulationTick,
    lastProcessedGuestInputSeq: lastProcessedRemoteInputSequence
  };
}

function saveRuntimeSnapshot() {
  if (multiplayerRole !== "solo" || !gameStarted) {
    return;
  }

  const snapshot = createRuntimeSnapshot();
  sessionStorage.setItem(LIVE_RELOAD_STATE_KEY, JSON.stringify(snapshot));
}

function applyRuntimeSnapshot(snapshot: RuntimeSnapshot) {
  fighters.length = 0;
  fighters.push(
    ...snapshot.fighters.map((fighter) => ({
      ...fighter,
      controller:
        fighter.playerSlot === 1 && multiplayerRole === "guest"
          ? "local"
          : fighter.playerSlot === 1
            ? "remote"
            : fighter.controller ?? "local",
      downed: fighter.downed ?? false,
      reviveProgress: fighter.reviveProgress ?? 0,
      knockbackVx: fighter.knockbackVx ?? 0,
      knockbackVy: fighter.knockbackVy ?? 0,
      selectedWeapon: fighter.selectedWeapon ?? (fighter.playerSlot === 0 ? snapshot.selectedWeapon : "pistol"),
      highestUnlockedWeapon: fighter.highestUnlockedWeapon ?? (fighter.playerSlot === 0 ? snapshot.highestUnlockedWeapon : "pistol")
    }))
  );
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
  shopItems.length = 0;
  shopItems.push(...(snapshot.shopItems ?? []));
  shopPhaseActive = snapshot.shopPhaseActive ?? shopItems.length > 0;
  swordUpgradeLevel = snapshot.swordUpgradeLevel ?? (snapshot.hasSwordUpgrade ? 1 : 0);
  regenUpgradeLevel = snapshot.regenUpgradeLevel ?? (snapshot.hasRegenUpgrade ? 1 : 0);
  attackSpeedUpgradeLevel = snapshot.attackSpeedUpgradeLevel ?? (snapshot.hasAttackSpeedUpgrade ? 1 : 0);
  fourthShotPierceUnlocked = snapshot.fourthShotPierceUnlocked ?? false;
  fourthShotPierceCounter = snapshot.fourthShotPierceCounter ?? 0;
  shockwaveUnlocked = snapshot.shockwaveUnlocked ?? false;
  shockwaveTimer = snapshot.shockwaveTimer ?? SHOCKWAVE_INTERVAL;
  swordSpawnTimer = snapshot.swordSpawnTimer ?? ORBITAL_SWORD_SPAWN_INTERVAL;
  regenTickTimer = snapshot.regenTickTimer ?? 1;
  orbitingSwords.length = 0;
  orbitingSwords.push(...(snapshot.orbitingSwords ?? []));

  nextId = snapshot.nextId;
  elapsed = snapshot.elapsed;
  lightningCooldown = snapshot.lightningCooldown;
  meteorCooldown = snapshot.meteorCooldown;
  medkitCooldown = snapshot.medkitCooldown;
  starCooldown = snapshot.starCooldown;
  shieldPickupCooldown = snapshot.shieldPickupCooldown;
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
}

function applyNetworkSnapshot(snapshot: NetworkSnapshot) {
  syncNetworkFighterArray(fighters, snapshot.fighters);
  syncObjectArray(bullets, snapshot.bullets);
  syncObjectArray(lightningStrikes, snapshot.lightningStrikes);
  syncObjectArray(meteors, snapshot.meteors);
  syncObjectArray(burningFloors, snapshot.burningFloors);
  syncObjectArray(medkits, snapshot.medkits);
  syncObjectArray(stars, snapshot.stars);
  syncObjectArray(shieldPickups, snapshot.shieldPickups);
  syncObjectArray(explosions, snapshot.explosions);
  syncObjectArray(shopItems, snapshot.shopItems);
  syncObjectArray(orbitingSwords, snapshot.orbitingSwords);
  shopPhaseActive = snapshot.shopPhaseActive;
  swordUpgradeLevel = snapshot.swordUpgradeLevel;
  regenUpgradeLevel = snapshot.regenUpgradeLevel;
  attackSpeedUpgradeLevel = snapshot.attackSpeedUpgradeLevel;
  fourthShotPierceUnlocked = snapshot.fourthShotPierceUnlocked;
  fourthShotPierceCounter = snapshot.fourthShotPierceCounter;
  shockwaveUnlocked = snapshot.shockwaveUnlocked;
  shockwaveTimer = snapshot.shockwaveTimer;
  elapsed = snapshot.elapsed;
  survivalWithoutDeath = snapshot.survivalWithoutDeath;
  bossFightStarted = snapshot.bossFightStarted;
  bossFightWon = snapshot.bossFightWon;
  bossIntroTimer = snapshot.bossIntroTimer;
  bossAttackType = snapshot.bossAttackType;
  bossAttackWindup = snapshot.bossAttackWindup;
  bossAttackAngle = snapshot.bossAttackAngle;
  bossesDefeated = snapshot.bossesDefeated;
}

function applyInterpolatedNetworkSnapshot(fromSnapshot: NetworkSnapshot, toSnapshot: NetworkSnapshot, alpha: number) {
  const previousFightersById = new Map(fromSnapshot.fighters.map((fighter) => [fighter.id, fighter]));
  for (let index = 0; index < toSnapshot.fighters.length; index += 1) {
    const fighter = toSnapshot.fighters[index];
    const blendedFighter = blendFighter(previousFightersById.get(fighter.id), fighter, alpha);
    if (index < fighters.length) {
      Object.assign(fighters[index], blendedFighter);
    } else {
      fighters.push(blendedFighter);
    }
  }
  fighters.length = toSnapshot.fighters.length;

  syncBlendedObjectArray(bullets, fromSnapshot.bullets, toSnapshot.bullets, alpha, blendBullet);
  syncBlendedObjectArray(
    lightningStrikes,
    fromSnapshot.lightningStrikes,
    toSnapshot.lightningStrikes,
    alpha,
    blendLightningStrike
  );
  syncBlendedObjectArray(meteors, fromSnapshot.meteors, toSnapshot.meteors, alpha, blendMeteor);
  syncBlendedObjectArray(
    burningFloors,
    fromSnapshot.burningFloors,
    toSnapshot.burningFloors,
    alpha,
    blendBurningFloor
  );
  syncObjectArray(medkits, toSnapshot.medkits);
  syncObjectArray(stars, toSnapshot.stars);
  syncObjectArray(shieldPickups, toSnapshot.shieldPickups);
  syncBlendedObjectArray(explosions, fromSnapshot.explosions, toSnapshot.explosions, alpha, blendExplosion);
  syncObjectArray(shopItems, toSnapshot.shopItems);
  syncObjectArray(orbitingSwords, toSnapshot.orbitingSwords);

  shopPhaseActive = toSnapshot.shopPhaseActive;
  swordUpgradeLevel = toSnapshot.swordUpgradeLevel;
  regenUpgradeLevel = toSnapshot.regenUpgradeLevel;
  attackSpeedUpgradeLevel = toSnapshot.attackSpeedUpgradeLevel;
  fourthShotPierceUnlocked = toSnapshot.fourthShotPierceUnlocked;
  fourthShotPierceCounter = toSnapshot.fourthShotPierceCounter;
  shockwaveUnlocked = toSnapshot.shockwaveUnlocked;
  shockwaveTimer = blendNumber(fromSnapshot.shockwaveTimer, toSnapshot.shockwaveTimer, alpha);
  elapsed = blendNumber(fromSnapshot.elapsed, toSnapshot.elapsed, alpha);
  survivalWithoutDeath = blendNumber(fromSnapshot.survivalWithoutDeath, toSnapshot.survivalWithoutDeath, alpha);
  bossFightStarted = toSnapshot.bossFightStarted;
  bossFightWon = toSnapshot.bossFightWon;
  bossIntroTimer = blendNumber(fromSnapshot.bossIntroTimer, toSnapshot.bossIntroTimer, alpha);
  bossAttackType = toSnapshot.bossAttackType;
  bossAttackWindup = blendNumber(fromSnapshot.bossAttackWindup, toSnapshot.bossAttackWindup, alpha);
  bossAttackAngle = blendAngle(fromSnapshot.bossAttackAngle, toSnapshot.bossAttackAngle, alpha);
  bossesDefeated = toSnapshot.bossesDefeated;
}

function resetGuestSnapshotInterpolation() {
  guestSnapshotBuffer = [];
  resetGuestPredictionState();
}

function queueGuestSnapshot(snapshot: NetworkSnapshot) {
  if (!gameStarted) {
    resetGuestSnapshotInterpolation();
  }

  if (guestSnapshotBuffer.length === 0) {
    guestEstimatedServerTick = snapshot.serverTick;
  } else {
    guestEstimatedServerTick = Math.max(guestEstimatedServerTick, snapshot.serverTick);
  }

  const latestBufferedSnapshot = guestSnapshotBuffer[guestSnapshotBuffer.length - 1];
  if (latestBufferedSnapshot && snapshot.serverTick <= latestBufferedSnapshot.snapshot.serverTick) {
    return;
  }

  guestSnapshotBuffer.push({
    snapshot
  });

  if (guestSnapshotBuffer.length > MAX_GUEST_SNAPSHOT_BUFFER_SIZE) {
    guestSnapshotBuffer.splice(0, guestSnapshotBuffer.length - MAX_GUEST_SNAPSHOT_BUFFER_SIZE);
  }

  if (guestSnapshotBuffer.length === 1) {
    applyNetworkSnapshot(snapshot);
  }
}

function advanceGuestSnapshotInterpolation(frameDt: number) {
  if (multiplayerRole !== "guest" || guestSnapshotBuffer.length === 0) {
    return;
  }

  guestEstimatedServerTick += frameDt * SIMULATION_TICK_RATE;

  if (guestSnapshotBuffer.length === 1) {
    applyNetworkSnapshot(guestSnapshotBuffer[0].snapshot);
    return;
  }

  const latestSnapshot = guestSnapshotBuffer[guestSnapshotBuffer.length - 1].snapshot;
  guestEstimatedServerTick = Math.max(guestEstimatedServerTick, latestSnapshot.serverTick);
  const renderTick = guestEstimatedServerTick - GUEST_SNAPSHOT_INTERPOLATION_DELAY_TICKS;

  while (guestSnapshotBuffer.length >= 3 && guestSnapshotBuffer[1].snapshot.serverTick <= renderTick) {
    guestSnapshotBuffer.shift();
  }

  const fromEntry = guestSnapshotBuffer[0];
  const toEntry = guestSnapshotBuffer[1];
  const interval = Math.max(1, toEntry.snapshot.serverTick - fromEntry.snapshot.serverTick);
  const alpha = clamp((renderTick - fromEntry.snapshot.serverTick) / interval, 0, 1);
  applyInterpolatedNetworkSnapshot(fromEntry.snapshot, toEntry.snapshot, alpha);
}

function restoreRuntimeSnapshot() {
  const raw = sessionStorage.getItem(LIVE_RELOAD_STATE_KEY);
  if (!raw || multiplayerRole === "guest") {
    return false;
  }

  try {
    const snapshot = JSON.parse(raw) as RuntimeSnapshot;
    if (!Array.isArray(snapshot.fighters) || !Array.isArray(snapshot.bullets)) {
      return false;
    }

    applyRuntimeSnapshot(snapshot);
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

render();
requestAnimationFrame(frame);
