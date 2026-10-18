/* global DuckSprites */
const { KEYBOARD, WING, HEART } = DuckSprites;
const bridge = window.duckApp || null; // fehlt, wenn die Seite im Browser getestet wird
// In der App ist das Fenster nur so groß wie die Figur und wandert mit ihr mit.
// Gerechnet wird in Bildschirm-Koordinaten (Arbeitsbereich), gezeichnet relativ zum Fenster.
const AREA = bridge && bridge.area;
const FOLLOW = Boolean(AREA);

const GRAVITY = 2200;
const TYPING_HOLD = 1200;               // so lange tippt die Figur nach dem letzten Tastendruck weiter
// Müde und Schlaf nur nach längerer Pause (abends/nachts etwas früher)
const TIRED_AFTER = { day: 6 * 60 * 1000, late: 4 * 60 * 1000 };
const SLEEP_AFTER = { day: 12 * 60 * 1000, late: 7 * 60 * 1000 };
const MIN_SIZE = 0.1;
const MAX_SIZE = 3;
// Abstand zum unteren Rand (z. B. für eine Fake-Taskleiste in der Vorschau)
const GROUND_OFFSET = (window.duckConfig && window.duckConfig.groundOffset) || 0;

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

// Einstellungen aus der App (oder der Vorschau-Seite)
const CONFIG = (bridge && bridge.config) || window.duckConfig || {};
let SIZE = CONFIG.size || 1;
let onBattery = false;
// Schwerkraft aus: die Figur bleibt dort, wo sie abgesetzt wurde (gemerkt wird die Fußhöhe)
let gravity = CONFIG.schwerkraft !== false;
let restBottom = !gravity && typeof CONFIG.homeBottom === 'number' ? CONFIG.homeBottom : null;
// Energiesparmodus: 0 aus, 1 leicht, 2 mittel, 3 hart (alte Einstellung true = mittel)
const energyLevel = (v) => (v === true ? 2 : Number(v) || 0);
let energy = energyLevel(CONFIG.energiesparen);
const hardSave = () => energy >= 3;
let dndUntil = 0;                 // „Nicht stören“: schläft und reagiert auf nichts
let claudeActive = false;         // Claude-Fenster ist vorne: Mini-Claude denkt mit
let weather = null;               // { code, temp, isDay } von Open-Meteo
let extras = CONFIG.extras || {};
let previewExtrasUntil = 0;       // „Extras kurz zeigen“ im Menü
let sitOnWindows = Boolean(CONFIG.aufFenstern); // „Auf Fenster setzen“ ist an
let perch = null;                 // Fenster, an dem die Figur sitzt/hängt: { side, left, top, width, height, dy }
let walking = Boolean(CONFIG.laufen);         // „Läuft herum“
let windowJumps = Boolean(CONFIG.fensterSpringen); // „Springt auf das aktive Fenster“
let jumpTarget = null;            // Fenster, auf das sie gerade springt
let homeX = null;                 // Stammplatz an der Taskleiste (x)

// Aktuelle Figur und davon abhängige Werte
let CHAR, PALETTE, FRAMES, EYE, ANCHORS, WIDTH, HEIGHT, SCALE, DW, DH;
function applyCharacter(id) {
  CHAR = DuckSprites.character(id);
  ({ palette: PALETTE, frames: FRAMES, eye: EYE, anchors: ANCHORS, width: WIDTH, height: HEIGHT } = CHAR);
  applySize(SIZE);
}
function applySize(size) {
  SIZE = Math.min(MAX_SIZE, Math.max(MIN_SIZE, size));
  SCALE = CHAR.scale * SIZE;
  DW = WIDTH * SCALE;
  DH = HEIGHT * SCALE;
}
applyCharacter(CONFIG.figur);

// Die Figur wird erst in Original-Pixeln auf diese Leinwand gemalt und dann skaliert.
// Ränder lassen Platz für Zubehör, das über die Figur hinausragt (Tastatur, Glühbirne).
const PAD = 12;
const sprite = document.createElement('canvas');
const sctx = sprite.getContext('2d');

const duck = {
  x: 200, y: 0, vy: 0, dir: -1,
  state: 'idle', until: 0, action: null, actionUntil: 0, lookUntil: 0,
  onGround: false, dragging: false, dragDX: 0, dragDY: 0, downAt: null,
  frameT: 0, blinkUntil: 0, nextBlink: 0, beakUntil: 0, happyUntil: 0,
  lastKeyAt: -Infinity, wingDown: false,
  squash: { sx: 1, sy: 1, start: 0, ms: 0 }, // Stauchen/Strecken bei Sprung, Landung, Drehung
  vx: 0, thrown: false, sliding: false, bounces: 0, // geworfen / rutscht / hüpft mehrmals
  rollStart: -Infinity, fadeUntil: 0,              // Panda kugelt, Geist wird durchsichtig
  lookTarget: null,                                 // schaut zu einem Fenster statt zum Zeiger
  pressedKey: null, pressedUntil: 0,          // gerade gedrückte Taste auf der Mini-Tastatur
};

// Geist: beim Erschrecken und beim Verblassen halb durchsichtig
function figureAlpha(t) {
  if (duck.fadeUntil > t) return 0.35;
  if (duck.action === 'vanish' && acting(t)) {
    const k = (duck.actionUntil - t) / ACTIONS.vanish.ms; // 1 → 0
    return 0.15 + 0.85 * Math.abs(k * 2 - 1);
  }
  return 1;
}

// Schwebende Figuren (Geist) wippen sanft auf und ab
function floatLift(t) {
  if (!CHAR.float || duck.dragging) return 0;
  const bob = hardSave() ? 0 : Math.sin(t / 650);
  return Math.round((2 + bob * 1.5) * SCALE);
}

// Figur kurz stauchen oder strecken; federt von selbst zurück
function squash(sx, sy, ms) {
  duck.squash = { sx, sy, start: now(), ms };
}
function squashNow(t) {
  const q = duck.squash;
  const k = Math.max(0, 1 - (t - q.start) / q.ms);
  if (!k) return { sx: 1, sy: 1 };
  const e = k * k; // weich auslaufen
  return { sx: 1 + (q.sx - 1) * e, sy: 1 + (q.sy - 1) * e };
}

// Tasten-Positionen auf der Mini-Tastatur (für das Aufleuchten beim Tippen)
const KEY_CELLS = [];
KEYBOARD.forEach((line, r) => [...line].forEach((ch, c) => { if (ch === 'L') KEY_CELLS.push([c, r]); }));

const cursor = { x: -1, y: -1 };
let lastActivity = performance.now();
let hoverSince = 0; // seit wann der Zeiger ruhig auf der Figur liegt
let fallStartY = null; // für „tief gefallen → schwindelig“
let lastAttention = performance.now(); // zuletzt gestreichelt oder angeklickt
const keyTimes = [];
const clickTimes = [];
let focusMs = 0;          // wie lange schon konzentriert getippt wird
let startleCooldown = 0;
const pet = { amount: 0 };
const particles = [];
const mic = { on: false, stream: null, analyser: null, data: null, level: 0 };

let W = 0, H = 0;
const view = { x: 0, y: 0 }; // linke obere Ecke des Fensters im Arbeitsbereich
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  W = FOLLOW ? AREA.width : canvas.width;
  H = FOLLOW ? AREA.height : canvas.height;
}
window.addEventListener('resize', resize);
resize();
duck.y = groundY();
// Stammplatz: unten rechts, oder wo du die Figur zuletzt hingesetzt hast
const defaultX = () => W - DW - 24;
duck.x = typeof CONFIG.homeX === 'number' ? Math.min(Math.max(CONFIG.homeX, 0), W - DW) : defaultX();
homeX = duck.x;
function saveHome(bottom) {
  homeX = Math.round(duck.x);
  if (bridge) bridge.setHome(homeX, bottom);
}

// echter Boden (Taskleiste) und der Platz, auf dem die Figur gerade steht
function bottomY() { return H - DH - GROUND_OFFSET; }
function groundY() {
  if (perch) return perch.side === 'top' ? Math.max(0, perch.top - DH) : perchAnchorY(perch) + perch.dy;
  if (!gravity && restBottom !== null) return Math.min(bottomY(), Math.max(0, restBottom - DH));
  return bottomY();
}
const rand = (a, b) => a + Math.random() * (b - a);
const now = () => performance.now();
const isTyping = (t) => t - duck.lastKeyAt < TYPING_HOLD;
const isFlipped = () => !CHAR.front && duck.dir < 0;

// Müdigkeit hängt an der Pause, nicht an der Uhrzeit. Abends/nachts kommt sie nur etwas früher.
function hour() {
  const forced = window.duckConfig && window.duckConfig.hour;
  return typeof forced === 'number' ? forced : new Date().getHours();
}
const late = () => hour() >= 21 || hour() < 6;
const dnd = () => Date.now() < dndUntil;
function mood() {
  if (dnd()) return 'sleep';
  const quiet = now() - lastActivity;
  const key = late() ? 'late' : 'day';
  if (quiet > SLEEP_AFTER[key]) return 'sleep';
  if (quiet > TIRED_AFTER[key]) return 'tired';
  return 'awake';
}
let greetedDay = '';
function wake() {
  if (dnd()) return;
  const t = now();
  const away = t - lastActivity;
  lastActivity = t;
  const busy = duck.action && ACTIONS[duck.action].priority && acting(t);
  if (duck.action === 'nap') duck.action = null;
  const today = new Date().toDateString();
  if (duck.state === 'sleep') {
    // aufwachen: erst mal strecken, morgens danach winken
    duck.state = 'idle';
    duck.until = t + 2500;
    if (!busy) startAction('stretch', t);
    if (hour() >= 5 && hour() < 11 && greetedDay !== today) {
      greetedDay = today;
      setTimeout(() => { if (!dnd()) { startAction(CHAR.front ? 'wave' : 'hop', now()); sparkle(4); } }, 1350);
    }
  } else if (away > 10 * 60 * 1000 && !busy) {
    // nach einer längeren Pause: willkommen zurück
    startAction(CHAR.front ? 'wave' : 'hop', t);
    for (let i = 0; i < 2; i++) spawn('heart', duck.x + rand(0, DW), duck.y + rand(0, DH * 0.3));
  }
}
function sparkle(n) { for (let i = 0; i < n; i++) spawn('star', duck.x + rand(0, DW), duck.y + rand(0, DH * 0.4)); }

// ---------- Animationen ----------
const ACTIONS = {
  yawn: { frames: ['yawn'], ms: 1400 },
  stretch: { frames: ['stretch', 'stretch', 'idle'], step: 500, ms: 1300 },
  preen: { frames: ['preen', 'idle'], step: 350, ms: 1600 },
  wave: { frames: ['wave1', 'wave2'], step: 220, ms: 1800 },
  waveL: { frames: ['waveL1', 'waveL2'], step: 220, ms: 1800 },
  look: { ms: 2000 },
  idea: { ms: 2200 },
  hop: { ms: 400 },
  sad: { frames: ['sad'], ms: 3500 },
  peck: { frames: ['peck', 'idle', 'peck', 'idle'], step: 260, ms: 1600 },
  shake: { frames: ['shake1', 'shake2'], step: 90, ms: 720 },
  waddle: { frames: ['step1', 'step2'], step: 230, ms: 1840 },
  wink: { frames: ['wink'], ms: 480 },
  dance: { frames: ['dance1', 'dance2'], step: 260, ms: 3100 },
  mushroom: { frames: ['idle', 'idle', 'happy', 'happy'], step: 750, ms: 3000 },
  bounce: { frames: ['happy'], ms: 1300 },                 // zwei, drei kleine Freudenhüpfer
  bamboo: { frames: ['chew1', 'chew2'], step: 230, ms: 3600 }, // Panda kaut Bambus
  melt: { frames: ['happy'], ms: 1900 },                   // Schleim zerfließt und ploppt zurück
  vanish: { frames: ['idle'], ms: 3000 },                  // Geist verblasst kurz
  binky: { frames: ['cheer1', 'cheer2'], step: 160, ms: 900 }, // Hase: Freudensprung
  nap: { frames: ['sleep', 'sleep2'], step: 1300, ms: 15000 }, // Mittagsschläfchen
  sneeze: { frames: ['sleepy', 'yawn', 'startle', 'idle'], step: 330, ms: 1400 }, // Hatschi!
  spin: { frames: ['happy'], ms: 900 },                    // einmal im Kreis drehen
  // Reaktionen haben Vorrang vor allem anderen
  startle: { frames: ['startle'], ms: 900, priority: true },
  dizzy: { frames: ['dizzy1', 'dizzy2'], step: 200, ms: 2400, priority: true },
  cheer: { frames: ['cheer1', 'cheer2'], step: 250, ms: 2200, priority: true },
  alarm: { frames: ['cheer1', 'cheer2'], step: 200, ms: 30000, priority: true }, // Wecker / Timer
};
const DUCK_ACTIONS = ['yawn', 'stretch', 'preen', 'look', 'idea', 'hop', 'peck', 'shake', 'waddle', 'mushroom', 'bounce', 'sneeze', 'spin'];

function actionFrame(t) {
  const a = ACTIONS[duck.action];
  if (!a.frames) return FRAMES.idle;
  return FRAMES[a.frames[Math.floor(t / (a.step || 400)) % a.frames.length]];
}
const acting = (t) => duck.action && duck.actionUntil > t;

// Feste Rangfolge: in jedem Moment entscheidet genau eine Sache, was die Figur zeigt.
// So vermischt sich nichts (z. B. Mikrofon-Mund, während man sie festhält).
function currentFrame(t) {
  // 1. festgehalten: zappeln
  // festgehalten: zappeln, außer über einem Fensterrand (dann ruhig: hier kann man loslassen)
  if (duck.dragging) {
    if (edgeUnder) return edgeUnder === 'top' ? FRAMES.happy : FRAMES.reach;
    return Math.floor(t / 140) % 2 ? FRAMES.drag1 : FRAMES.drag2;
  }
  if (duck.sliding) return FRAMES.slide;
  if (hanging()) return FRAMES.reach; // hält sich seitlich oder unten am Fenster fest
  // 2. Reaktionen (erschrecken, schwindelig, jubeln)
  if (acting(t) && ACTIONS[duck.action].priority) return actionFrame(t);
  // 3. in der Luft (Hüpfer, Sprung, Fall)
  if (!duck.onGround) return duck.beakUntil > t ? FRAMES.quack : FRAMES.flap;
  if (duck.beakUntil > t) return FRAMES.quack;
  // 4. Schlaf
  if (duck.state === 'sleep') return Math.floor(t / 1300) % 2 ? FRAMES.sleep2 : FRAMES.sleep;
  // 5. Mittippen
  if (isTyping(t) && CHAR.typingFrames) return FRAMES[CHAR.typingFrames[duck.wingDown ? 1 : 0]];
  // 6. Mikrofon-Mund
  const talk = micMouth();
  if (talk === 1) return FRAMES.quack;
  if (talk === 2) return FRAMES.talk;
  // 6b. läuft gerade
  if (duck.walkTo !== null && duck.walkTo !== undefined) return Math.floor(t / 200) % 2 ? FRAMES.step1 : FRAMES.step2;
  // 7. gestreichelt / Zeiger ruht auf ihr
  if (duck.happyUntil > t) return FRAMES.happy;
  if (hoverSince && t - hoverSince > 800) return CHAR.front ? FRAMES.reach : FRAMES.happy;
  // 9. Leerlauf-Animationen
  if (acting(t) && ACTIONS[duck.action].frames) return actionFrame(t);
  if (duck.blinkUntil > t) return FRAMES.blink;
  // ruhiges Atmen im Stand, abends mit müden Augen
  const base = mood() === 'tired' ? FRAMES.sleepy : FRAMES.idle;
  return Math.floor(duck.frameT / 0.9) % 2 ? FRAMES.breathe : base;
}

// Pupillen-Versatz Richtung Mauszeiger (-1..1 in x und y)
function lookOffset(t, flip) {
  if (isTyping(t)) return { dx: CHAR.front ? 0 : 1, dy: 1 }; // schaut auf die Tastatur
  if (hardSave()) return { dx: 0, dy: 0 };                    // Hart: Augen folgen nicht
  if (duck.action === 'look' && acting(t)) return { dx: Math.floor(t / 500) % 2 ? 1 : -1, dy: 0 };
  if (duck.action === 'mushroom' && acting(t)) return { dx: 1, dy: 1 }; // guckt auf den Pilz
  const target = duck.lookTarget && duck.lookTarget.until > t ? duck.lookTarget : cursor;
  if (target.x < 0) return { dx: 0, dy: 0 };
  const [col, row] = EYE.positions[0];
  const ex = duck.x + (CHAR.front ? WIDTH / 2 : flip ? WIDTH - 1 - col : col) * SCALE;
  const ey = duck.y + row * SCALE;
  const vx = (target.x - ex) * (flip ? -1 : 1);
  const vy = target.y - ey;
  return {
    dx: vx > 30 ? 1 : vx < -30 ? -1 : 0,
    dy: vy < -50 ? -1 : vy > 50 ? 1 : 0,
  };
}

// ---------- Zeichnen ----------
// Malt ein Pixel-Raster auf die Figuren-Leinwand (col/row in Raster-Pixeln), gespiegelt wenn nötig.
function paint(rows, col, row, flip, map = null) {
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      let ch = rows[r][c];
      if (map && map[ch]) ch = map[ch];
      const color = PALETTE[ch];
      if (!color) continue;
      const sc = col + c;
      sctx.fillStyle = color;
      sctx.fillRect(PAD + (flip ? WIDTH - 1 - sc : sc), PAD + row + r, 1, 1);
    }
  }
}

function paintFigure(t) {
  sprite.width = WIDTH + PAD * 2;
  sprite.height = HEIGHT + PAD * 2;
  const flip = isFlipped();
  const frame = currentFrame(t);
  const movingEye = frame.some((row) => row.includes('E'));
  paint(frame, 0, 0, flip, movingEye ? { E: CHAR.eyeBg } : null);
  if (movingEye) {
    const { dx, dy } = lookOffset(t, flip);
    for (const [col, row] of EYE.positions) paint(EYE.pattern, col + dx, row + (frame.eyeDy || 0) + dy, flip);
  }
  if (isTyping(t)) {
    paint(KEYBOARD, ...ANCHORS.keyboard, flip);
    if (duck.pressedKey && duck.pressedUntil > t) {
      const [kc, kr] = duck.pressedKey;
      paint(['I'], ANCHORS.keyboard[0] + kc, ANCHORS.keyboard[1] + kr, flip);
    }
    if (ANCHORS.wingUp) paint(WING, ...(duck.wingDown ? ANCHORS.wingDown : ANCHORS.wingUp), flip);
  }
  if (duck.action === 'look' && acting(t) && ANCHORS.lens) paint(CHAR.props.LENS, ...ANCHORS.lens, flip);
  if (duck.action === 'idea' && acting(t) && ANCHORS.idea) {
    // erst flackert die Glühbirne, dann geht sie an
    const since = t - (duck.actionUntil - ACTIONS.idea.ms);
    const lit = since > 700 || Math.floor(since / 120) % 2;
    paint(CHAR.props.IDEA, ANCHORS.idea[0], ANCHORS.idea[1] + Math.round(Math.sin(t / 250)), flip, lit ? null : { i: 'j', I: 'j' });
  }
  if (duck.action === 'mushroom' && acting(t) && ANCHORS.mushroom) paint(CHAR.props.MUSHROOM, ...ANCHORS.mushroom, flip);

  // Extras: Sonnenbrille, Mütze/Partyhut, Regenschirm
  const offY = frame.eyeDy || 0;
  if (sunny() && movingEye) paint(CHAR.props.GLASSES, ANCHORS.glasses[0], ANCHORS.glasses[1] + offY, flip);
  const hat = activeHat(t);
  if (hat) {
    // Hüte sind verschieden hoch: an Mitte und Unterkante ausrichten
    const rows = CHAR.props[hat];
    paint(rows, ANCHORS.hat[0] - Math.floor(rows[0].length / 2), ANCHORS.hat[1] - rows.length + 1 + offY, flip);
  }
  if (rainy()) paint(CHAR.props.UMBRELLA, ...ANCHORS.umbrella, flip);
  // Wecker: Glocke über dem Kopf, wackelt beim Klingeln
  if (duck.action === 'alarm' && acting(t)) {
    const [bx, by] = ANCHORS.idea;
    paint(CHAR.props.BELL, bx + (Math.floor(t / 90) % 2 ? 1 : -1), by + 2, flip);
  }
  if (duck.action === 'bamboo' && acting(t) && ANCHORS.bamboo) paint(CHAR.props.BAMBOO, ...ANCHORS.bamboo, flip);
  if ((extras.ostern !== false && isEaster()) || previewPhase(t) === 'easter') paint(CHAR.props.EGG, -7, HEIGHT - 6, flip);
}

// Fenster so verschieben, dass die Figur unten mittig drin steht
function updateView() {
  if (!FOLLOW) return;
  const vw = canvas.width;
  const vh = canvas.height;
  const x = Math.round(Math.min(Math.max(duck.x + DW / 2 - vw / 2, 0), W - vw));
  const y = Math.round(Math.min(Math.max(duck.y + DH - vh, 0), H - vh));
  if (x === view.x && y === view.y) return;
  view.x = x;
  view.y = y;
  bridge.moveWindow(x, y);
}

function draw(t) {
  updateView();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(1, 0, 0, 1, -view.x, -view.y);
  drawShadow();
  paintFigure(t);
  // groß: harte Pixel; sehr klein: weich verkleinern, damit nichts verschwindet
  ctx.imageSmoothingEnabled = SCALE < 1;
  // Stauchen/Strecken mit Fußpunkt unten in der Mitte
  let { sx, sy } = squashNow(t);
  if (duck.sliding) { sx *= 1.18; sy *= 0.82; } // flach auf dem Bauch
  const w = sprite.width * SCALE * sx;
  const h = sprite.height * SCALE * sy;
  const footX = duck.x + DW / 2;
  const footY = duck.y + DH - floatLift(t);
  ctx.globalAlpha = figureAlpha(t);
  const roll = t - duck.rollStart;
  if (roll >= 0 && roll < 900) {
    // einmal um sich selbst kugeln (Drehpunkt in der Mitte der Figur)
    ctx.save();
    ctx.translate(footX, footY - DH / 2);
    ctx.rotate((roll / 900) * Math.PI * 2);
    ctx.drawImage(sprite, Math.round(-w / 2), Math.round(DH / 2 - (HEIGHT + PAD) * SCALE * sy), Math.round(w), Math.round(h));
    ctx.restore();
  } else {
    ctx.drawImage(sprite, Math.round(footX - w / 2), Math.round(footY - (HEIGHT + PAD) * SCALE * sy), Math.round(w), Math.round(h));
  }
  ctx.globalAlpha = 1;
  if (duck.state === 'sleep' || (duck.action === 'nap' && acting(t))) { drawZzz(t); drawSnore(t); }
  if (claudeActive && CHAR.thinks && duck.state !== 'sleep' && !isTyping(t)) drawThinking(t);
  drawTemperature();
  if (duck.action === 'dizzy' && acting(t)) drawDizzyStars(t);
  drawParticles();
}

// Schnarchblase am Schnabel / Mund: wächst langsam und platzt
function drawSnore(t) {
  if (!ANCHORS.snore) return;
  const phase = (t % 3200) / 3200;
  if (phase > 0.85) return; // geplatzt
  const [col, row] = ANCHORS.snore;
  const sx = isFlipped() ? WIDTH - 1 - col : col;
  const x = duck.x + sx * SCALE + (isFlipped() ? -1 : 1) * SCALE * 2;
  const y = duck.y + row * SCALE;
  const r = Math.max(1.5, SCALE * (0.6 + phase * 2.4));
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = '#e8f4ff';
  ctx.strokeStyle = '#9fc6e8';
  ctx.lineWidth = Math.max(1, SCALE * 0.35);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(x - r * 0.45), Math.round(y - r * 0.45), Math.max(1, Math.round(r * 0.3)), Math.max(1, Math.round(r * 0.3)));
  ctx.globalAlpha = 1;
}


// weicher Schatten am Boden, wird kleiner, je höher die Figur ist
function drawShadow() {
  if (hanging()) return; // hängt am Fenster: kein Boden darunter
  const lift = Math.max(0, groundY() - duck.y);
  const k = Math.max(0.35, 1 - lift / 400);
  ctx.fillStyle = `rgba(20, 10, 15, ${0.22 * k})`;
  ctx.beginPath();
  ctx.ellipse(duck.x + DW * (CHAR.front ? 0.5 : 0.42), groundY() + DH - SCALE, DW * 0.36 * k, Math.max(1, SCALE * 1.6 * k), 0, 0, Math.PI * 2);
  ctx.fill();
}

// Effekt-Größe wächst mit der Figur, bleibt aber lesbar
const fxPx = () => Math.max(1, Math.round(2 * Math.min(1.5, SIZE)));

function drawSmall(rows, x, y, px) {
  rows.forEach((line, r) => [...line].forEach((k, c) => {
    const color = PALETTE[k];
    if (!color) return;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x + c * px), Math.round(y + r * px), px, px);
  }));
}

function drawZzz(t) {
  const size = Math.max(7, Math.round(13 * Math.min(1.5, SIZE)));
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#2b2622';
  ctx.lineWidth = Math.max(2, size / 4);
  ctx.font = `bold ${size}px "Segoe UI", sans-serif`;
  const phase = (t / 1000) % 3;
  for (let i = 0; i < 3; i++) {
    if (phase < i) continue;
    const zx = duck.x + DW * 0.72 + i * size * 0.7;
    const zy = duck.y - 2 - i * size * 0.85;
    ctx.strokeText('z', zx, zy);
    ctx.fillText('z', zx, zy);
  }
}

// drei Sterne kreisen um den Kopf
function drawDizzyStars(t) {
  const cx = duck.x + DW * (CHAR.front ? 0.5 : 0.6);
  const cy = duck.y + DH * 0.08;
  for (let i = 0; i < 3; i++) {
    const a = t / 220 + (i * Math.PI * 2) / 3;
    drawSmall(CHAR.props.STAR, cx + Math.cos(a) * DW * 0.3, cy + Math.sin(a) * 5 * SIZE, fxPx());
  }
}

// ---------- Partikel (Herzen, Sterne, Tipp-Funken, Staub, Ausrufezeichen) ----------
function spawn(type, x, y) {
  // Hart: nur Effekte, die etwas bedeuten (Herzen, Ausrufezeichen, Sterne bei Jubel/Schwindel)
  if (hardSave() && !['heart', 'bang', 'star'].includes(type)) return;
  const vy = { heart: rand(-70, -45), star: rand(-110, -60), bang: -40, confetti: rand(-90, -30), note: -45 }[type] ?? rand(-130, -70);
  const color = ['#ff5fa2', '#4aa3f0', '#f2cf63', '#6fdc8c', '#ff8a3d'][Math.floor(Math.random() * 5)];
  particles.push({ type, x, y, vx: type === 'bang' ? 0 : rand(-35, 35), vy, life: 1, color, alt: Math.random() < 0.4 });
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.type === 'tap') p.vy += 400 * dt;
    if (p.type === 'star') p.vy += 120 * dt;
    if (p.type === 'confetti') { p.vy = Math.min(p.vy + 160 * dt, 70); p.vx *= 0.98; }
    // Regen/Schnee verschwindet am Boden
    if ((p.type === 'rain' || p.type === 'snow') && p.y > groundY() + DH) p.life = 0;
    if (p.type === 'dust') { p.vy *= 0.9; p.vx *= 0.94; }
    if (p.type === 'food') {
      p.vy += 300 * dt;
      p.life = 1;
      if (p.y >= mouthPoint().y - 4) { p.life = 0; eat(); }
    }
    p.life -= dt * ({ heart: 0.8, dust: 1.6, star: 0.9, bang: 1.1, confetti: 0.35, note: 0.7, rain: 0.3, snow: 0.2, bat: 0.33 }[p.type] || 2.2);
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  const px = fxPx();
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5));
    if (p.type === 'heart') {
      // kurz aufploppen: erst größer, dann normal
      const pop = p.life > 0.85 ? 1 + (p.life - 0.85) * 4 : 1;
      drawSmall(HEART, p.x, p.y, Math.max(1, Math.round(px * pop)));
    }
    else if (p.type === 'star') drawSmall(CHAR.props.STAR, p.x, p.y, px);
    else if (p.type === 'bang') {
      ctx.font = `bold ${Math.max(9, Math.round(18 * Math.min(1.5, SIZE)))}px "Segoe UI", sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = '#d4471c';
      ctx.strokeText('!', p.x, p.y);
      ctx.fillText('!', p.x, p.y);
    } else if (p.type === 'confetti') {
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), px + 1, Math.max(1, Math.round(px * (Math.sin(p.life * 30) > 0 ? 2 : 1))));
    } else if (p.type === 'food') {
      const rows = CHAR.props[p.food];
      drawSmall(rows, p.x - (rows[0].length * px) / 2, p.y - rows.length * px, px);
    } else if (p.type === 'bat') {
      const wings = Math.floor(p.life * 40) % 2 ? ['k...k', 'kkkkk', '.kkk.'] : ['.....', 'kkkkk', 'k.k.k'];
      drawSmall(wings, p.x, p.y + Math.sin(p.life * 25) * 3, px);
    } else if (p.type === 'rain') {
      ctx.fillStyle = 'rgba(159, 208, 255, .8)';
      ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.max(1, Math.round(px / 2)), px * 3);
    } else if (p.type === 'snow') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(p.x), Math.round(p.y), px, px);
    } else if (p.type === 'dust') {
      const size = Math.round((2 + (1 - p.life) * 4) * Math.min(1, SIZE + 0.3));
      ctx.fillStyle = '#e9dcc6';
      ctx.fillRect(Math.round(p.x), Math.round(p.y), size, size);
    } else {
      ctx.fillStyle = '#ffe28a';
      ctx.fillRect(Math.round(p.x), Math.round(p.y), px + 1, px + 1);
    }
  }
  ctx.globalAlpha = 1;
}

// ---------- Mini-Claude denkt mit (Claude-Fenster ist vorne) ----------
function drawThinking(t) {
  const px = fxPx();
  const cx = duck.x + DW / 2;
  const y = duck.y - px * 5;
  for (let i = 0; i < 3; i++) {
    const on = Math.floor(t / 280) % 3 === i;
    ctx.fillStyle = on ? '#ffffff' : 'rgba(255, 255, 255, .45)';
    const lift = on ? px : 0;
    ctx.fillRect(Math.round(cx + (i - 1) * px * 3 - px), Math.round(y - lift), px * 2, px * 2);
  }
}

// ---------- Extras: Jahreszeiten, Geburtstag ----------
function todayParts() {
  const d = new Date();
  return { day: d.getDate(), month: d.getMonth() + 1 };
}
function isBirthday() {
  if (!extras.geburtstag || !extras.geburtstagDatum) return false;
  const { day, month } = todayParts();
  const [bd, bm] = extras.geburtstagDatum.split('.').map(Number);
  return bd === day && bm === month;
}
const isNewYear = () => { const { day, month } = todayParts(); return (month === 12 && day === 31) || (month === 1 && day === 1); };
// Ostersonntag (anonymer gregorianischer Algorithmus); Hasenohren von Karfreitag bis Ostermontag
function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 12);
}
function isEaster() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diff = Math.round((today - easterSunday(today.getFullYear())) / 86400000);
  return diff >= -2 && diff <= 1;
}
const isHalloween = () => { const { day, month } = todayParts(); return month === 10 && day >= 24; };
// „Extras kurz zeigen“: nacheinander Mütze, Partyhut, Ostern, Halloween, Regen, Sonne (je 3 s)
const PREVIEW_PHASES = ['santa', 'party', 'easter', 'halloween', 'rain', 'sun'];
const PREVIEW_MS = PREVIEW_PHASES.length * 3000;
function previewPhase(t) {
  if (previewExtrasUntil <= t) return null;
  return PREVIEW_PHASES[Math.min(PREVIEW_PHASES.length - 1, Math.floor((t - (previewExtrasUntil - PREVIEW_MS)) / 3000))];
}
function activeHat(t) {
  const phase = previewPhase(t);
  if (phase === 'santa') return 'SANTA';
  if (phase === 'party') return 'PARTY';
  if (phase === 'easter') return 'EARS';
  if (phase === 'halloween') return 'PUMPKIN';
  if (phase) return null;
  if (extras.silvester && isNewYear()) return 'PARTY';
  if (isBirthday()) return 'PARTY';
  if (extras.weihnachten && todayParts().month === 12) return 'SANTA';
  if (extras.ostern !== false && isEaster()) return 'EARS';
  if (extras.halloween !== false && isHalloween()) return 'PUMPKIN';
  if (duck.state === 'sleep' && late()) return 'NIGHTCAP'; // nachts mit Schlafmütze
  return null;
}
let nextConfetti = 0;
// Halloween-Abend: ab und zu flattert eine Fledermaus vorbei
let nextBat = 0;
function updateHalloween(t) {
  const on = previewPhase(t) === 'halloween' || (extras.halloween !== false && isHalloween() && hour() >= 17);
  if (!on || t < nextBat || dnd() || hardSave()) return;
  nextBat = t + (previewPhase(t) ? 900 : rand(20000, 45000));
  const fromLeft = Math.random() < 0.5;
  particles.push({ type: 'bat', x: duck.x + (fromLeft ? -DW : DW * 2), y: duck.y - rand(10, 40) * Math.max(0.6, SIZE),
    vx: (fromLeft ? 1 : -1) * rand(70, 110), vy: rand(-12, 6), life: 1 });
}
function updateExtras(t) {
  updateHalloween(t);
  const party = previewPhase(t) === 'party' || isBirthday() || (extras.silvester && isNewYear());
  if (!party || t < nextConfetti || dnd()) return;
  nextConfetti = t + (previewPhase(t) ? 1200 : rand(15000, 30000));
  for (let i = 0; i < 14; i++) spawn('confetti', duck.x + rand(-DW * 0.3, DW * 1.3), duck.y - rand(10, 40) * Math.max(0.5, SIZE));
}

// ---------- Wetter (Open-Meteo, vom Hauptprozess geholt) ----------
const wCode = () => (weather && extras.wetter ? weather.code : -1);
const rainy = () => { const c = wCode(); return (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95 || previewPhase(now()) === 'rain'; };
const snowy = () => { const c = wCode(); return (c >= 71 && c <= 77) || c === 85 || c === 86; };
const sunny = () => (weather && extras.wetter && weather.isDay && wCode() <= 1 && weather.temp >= 22) || previewPhase(now()) === 'sun';
const weatherFalling = () => rainy() || snowy();
let dropAcc = 0;
function updateWeather(dt, t) {
  if (!weatherFalling() || hardSave() || (duck.state === 'sleep' && energy >= 2)) return;
  dropAcc += dt * (energy >= 2 ? 6 : snowy() ? 10 : 22);
  while (dropAcc >= 1) {
    dropAcc--;
    const x = duck.x + rand(-DW * 0.8, DW * 1.8);
    particles.push(snowy()
      ? { type: 'snow', x, y: duck.y - rand(30, 70) * Math.max(0.6, SIZE), vx: rand(-12, 12), vy: rand(25, 45), life: 1 }
      : { type: 'rain', x, y: duck.y - rand(30, 70) * Math.max(0.6, SIZE), vx: -20, vy: rand(260, 340), life: 1 });
  }
  // Gewitter: ab und zu erschrecken
  if (wCode() >= 95 && duck.state !== 'sleep' && Math.random() < dt / 45) react('startle', t);
  // Frost: ab und zu schütteln
  if (weather && extras.wetter && weather.temp <= 0 && duck.state === 'idle' && !acting(t) && Math.random() < dt / 20) startAction('shake', t);
}

// kleine Pixel-Temperatur links neben der Figur
const DIGITS = {
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'], 3: ['111', '001', '111', '001', '111'],
  4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'],
  8: ['111', '101', '111', '101', '111'], 9: ['111', '101', '111', '001', '111'],
  '-': ['000', '000', '111', '000', '000'], '°': ['11', '11', '00', '00', '00'],
};
function weatherIcon(code) {
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 51) return 'rain';
  if (code >= 2) return 'cloud';
  return 'sun';
}
function drawTemperature() {
  if (!weather || !extras.wetter || !extras.temperatur) return;
  const text = `${Math.round(weather.temp)}°`;
  const px = Math.max(2, Math.round(2 * Math.min(1.5, SIZE + 0.25)));
  const icon = DuckSprites.WEATHER_ICONS[weatherIcon(weather.code)];
  const glyphs = [...text].map((ch) => DIGITS[ch]).filter(Boolean);
  const textW = glyphs.reduce((sum, g) => sum + (g[0].length + 1) * px, -px);
  const iconW = 7 * Math.max(1, px - 1);
  const pad = px * 2;
  const w = pad + iconW + px * 2 + textW + pad;
  const h = Math.max(7 * Math.max(1, px - 1), 5 * px) + pad * 2;
  // links neben der Figur, auf halber Höhe (rechts, wenn links kein Platz ist)
  let x = duck.x - w - px * 3;
  if (x < view.x + 2) x = duck.x + DW + px * 3;
  x = Math.round(x);
  const y = Math.round(duck.y + DH * 0.45 - h / 2);
  ctx.fillStyle = 'rgba(24, 20, 26, .72)';
  ctx.fillRect(x + px, y, w - px * 2, h);
  ctx.fillRect(x, y + px, w, h - px * 2);
  drawSmall(icon, x + pad, y + (h - 7 * Math.max(1, px - 1)) / 2, Math.max(1, px - 1));
  let cx = x + pad + iconW + px * 2;
  const ty = y + (h - 5 * px) / 2;
  for (const g of glyphs) {
    g.forEach((line, r) => [...line].forEach((bit, c) => {
      if (bit !== '1') return;
      ctx.fillStyle = '#fffaf0';
      ctx.fillRect(Math.round(cx + c * px), Math.round(ty + r * px), px, px);
    }));
    cx += (g[0].length + 1) * px;
  }
}

// ---------- Mikrofon → Mund ----------
async function setMic(on) {
  if (on === mic.on) return;
  mic.on = on;
  if (!on) {
    if (mic.stream) mic.stream.getTracks().forEach((tr) => tr.stop());
    mic.stream = mic.analyser = null;
    mic.level = 0;
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    if (!mic.on) return stream.getTracks().forEach((tr) => tr.stop());
    const ac = new AudioContext();
    const analyser = ac.createAnalyser();
    analyser.fftSize = 1024;
    ac.createMediaStreamSource(stream).connect(analyser); // nur messen, nicht abspielen
    Object.assign(mic, { stream, analyser, data: new Float32Array(analyser.fftSize) });
  } catch (err) {
    mic.on = false;
    console.warn('Kein Mikrofon:', err.message);
  }
}

function updateMic() {
  if (!mic.analyser) return;
  mic.analyser.getFloatTimeDomainData(mic.data);
  let sum = 0;
  for (const v of mic.data) sum += v * v;
  const rms = Math.sqrt(sum / mic.data.length);
  mic.level = Math.max(rms, mic.level * 0.85); // schnell auf, langsam zu
}

// 0 = zu, 1 = halb offen, 2 = weit offen
function micMouth() {
  if (duck.dragging || !duck.onGround || duck.state === 'sleep' || dnd()) return 0;
  if (mic.level > 0.06) return 2;
  if (mic.level > 0.02) return 1;
  return 0;
}

// ---------- Tastatur → Figur tippt mit ----------
function onKey() {
  if (dnd()) return;
  const t = now();
  const wasTyping = isTyping(t);
  duck.lastKeyAt = t;
  duck.wingDown = !duck.wingDown;
  duck.pressedKey = KEY_CELLS[Math.floor(Math.random() * KEY_CELLS.length)];
  duck.pressedUntil = t + 110;
  if (CHAR.squishy && !hardSave()) squash(1.06, 0.94, 120); // wabbelt bei jedem Tastendruck
  kick();
  if (!wasTyping && !(duck.action && ACTIONS[duck.action].priority)) duck.action = null;
  wake();
  // sehr schnelles Tippen erschreckt die Figur
  keyTimes.push(t);
  while (keyTimes.length && keyTimes[0] < t - 1000) keyTimes.shift();
  if (keyTimes.length >= 8 && t > startleCooldown) {
    startleCooldown = t + 20000;
    react('startle', t);
  }
  const [tc, tr] = ANCHORS.tap;
  const kx = duck.x + (isFlipped() ? WIDTH - 1 - tc : tc) * SCALE;
  if (Math.random() < 0.5) spawn('tap', kx, duck.y + tr * SCALE);
}

// ---------- Verhalten (die Figur bleibt an ihrem Platz) ----------
function startAction(name, t) {
  duck.action = name;
  duck.actionUntil = t + ACTIONS[name].ms;
  if (name === 'look' && !CHAR.front) duck.lookUntil = t + ACTIONS.look.ms;
  if (name === 'hop') { duck.onGround = false; duck.vy = -320; squash(0.9, 1.12, 160); }
  if (name === 'bounce') { duck.bounces = 2; duck.onGround = false; duck.vy = -240; squash(0.9, 1.1, 140); }
  if (name === 'binky') { duck.onGround = false; duck.vy = -560; squash(0.85, 1.18, 180); sparkle(3); }
  if (name === 'melt') squash(1.45, 0.5, ACTIONS.melt.ms);
  if (name === 'spin') duck.rollStart = t;
  if (name === 'sneeze') {
    setTimeout(() => {
      if (duck.action !== 'sneeze') return;
      const m = mouthPoint();
      for (let i = 0; i < 7; i++) particles.push({ type: 'dust', x: m.x, y: m.y, vx: rand(-90, 90), vy: rand(-60, 10), life: 1 });
      if (duck.onGround && !hanging()) { duck.onGround = false; duck.vy = -180; }
      squash(1.2, 0.85, 160);
      kick();
    }, 700);
  }
  if (name === 'alarm') { duck.state = 'idle'; duck.until = t + ACTIONS.alarm.ms; }
}

// Reaktion mit Effekten starten
function react(name, t) {
  startAction(name, t);
  const headX = duck.x + DW * (CHAR.front ? 0.5 : 0.62);
  if (name === 'startle') {
    duck.onGround = false;
    duck.vy = -300;
    squash(0.88, 1.15, 180);
    spawn('bang', headX, duck.y - 4);
  }
  if (name === 'cheer') {
    duck.onGround = false;
    duck.vy = -380;
    squash(0.88, 1.15, 180);
    for (let i = 0; i < 8; i++) spawn('star', duck.x + rand(0, DW), duck.y + rand(0, DH * 0.4));
  }
}

function pickState(t) {
  const m = mood();
  if (m === 'sleep') {
    duck.state = 'sleep';
    if (!(duck.action && ACTIONS[duck.action].priority)) duck.action = null; // Bambus & Co. weglegen
    duck.until = t + rand(20000, 40000);
    return;
  }
  duck.state = 'idle';
  duck.until = t + rand(3000, 7000);
  if (hanging()) return; // hält sich fest: keine Hüpfer oder Tänze
  const list = CHAR.idleActions || DUCK_ACTIONS;
  const r = Math.random();
  // Mini-Claude denkt mit, wenn Claude offen ist
  if (claudeActive && CHAR.thinks && r < 0.25) startAction(Math.random() < 0.5 ? 'idea' : 'look', t);
  // lange nicht beachtet: wird traurig
  else if (m === 'awake' && t - lastAttention > 45 * 60 * 1000 && r < 0.35) startAction('sad', t);
  else if (m === 'tired' && r < 0.45) startAction('yawn', t);
  // mittags ab und zu ein Nickerchen, wenn gerade nicht getippt wird
  else if (hour() >= 12 && hour() < 14 && t - duck.lastKeyAt > 3 * 60 * 1000 && r < 0.12) startAction('nap', t);
  // abends öfter gähnen
  else if (hour() >= 18 && hour() < 21 && r < 0.18) startAction('yawn', t);
  else if (!hardSave() && maybeJumpToWindow(t, r)) { /* springt aufs Fenster */ }
  else if (!hardSave() && maybeWalk(t, r)) { /* läuft los */ }
  else if (r < 0.5 && !hardSave()) startAction(list[Math.floor(Math.random() * list.length)], t);
}

function faceCursor(t) {
  if (cursor.x < 0) return;
  // beim Umschauen kurz in die andere Richtung drehen
  if (duck.lookUntil > t) {
    turnTo(Math.floor((duck.lookUntil - t) / 600) % 2 ? 1 : -1);
    return;
  }
  const d = cursor.x - (duck.x + DW / 2);
  if (Math.abs(d) > 30) turnTo(d > 0 ? 1 : -1);
}

// beim Umdrehen kurz schmal werden, das wirkt wie eine Drehung
function turnTo(dir) {
  if (dir === duck.dir) return;
  duck.dir = dir;
  if (!CHAR.front) squash(0.7, 1.03, 110);
}

function update(dt, t) {
  duck.frameT += dt;
  updateMic();
  updateParticles(dt);
  pet.amount = Math.max(0, pet.amount - 500 * dt);
  if (t > duck.nextBlink) {
    duck.blinkUntil = t + (mood() === 'tired' ? 360 : 140);
    // ab und zu zweimal kurz hintereinander blinzeln
    duck.nextBlink = Math.random() < 0.2 ? t + 300 : t + rand(2500, 6000);
  }

  if (duck.dragging) return;

  checkPerchEdge();
  updateWalk(dt, t);
  if (duck.sliding) { updateSlide(dt, t); return; }

  if (!duck.onGround) {
    duck.vy += GRAVITY * dt;
    duck.y += duck.vy * dt * Math.max(0.4, SIZE);
    // Sprung aufs Fenster: auf der Oberkante landen, sobald es abwärts geht
    if (jumpTarget && duck.vy > 0 && duck.y >= jumpTarget.top - DH) {
      perch = { ...jumpTarget, side: 'top', dy: 0 };
      jumpTarget = null;
      duck.y = groundY();
      duck.vy = 0;
      duck.vx = 0;
      duck.onGround = true;
      squash(1.18, 0.86, 150);
      return;
    }
    // geworfen: seitlich weiterfliegen, an den Bildschirmrändern abprallen
    if (duck.vx) {
      duck.x += duck.vx * dt;
      if (duck.x < 0 || duck.x > W - DW) {
        duck.x = Math.min(Math.max(duck.x, 0), W - DW);
        duck.vx *= -0.55;
        squash(0.8, 1.1, 120);
      }
      if (duck.y < 0) { duck.y = 0; duck.vy = Math.abs(duck.vy) * 0.3; }
    }
    if (duck.y >= groundY()) {
      // aus großer Höhe gefallen: kurz schwindelig
      const fell = fallStartY !== null ? groundY() - fallStartY : 0;
      fallStartY = null;
      duck.y = groundY();
      // Pinguin: landet auf dem Bauch und rutscht weiter
      if (CHAR.slides && (fell > 30 || (duck.thrown && Math.abs(duck.vx) > 60)) && !dnd()) {
        if (Math.abs(duck.vx) < 120) duck.vx = (duck.x + DW / 2 < W / 2 ? 1 : -1) * rand(160, 240);
        duck.vy = 0; duck.onGround = true; duck.sliding = true;
        squash(1.25, 0.75, 160);
        return;
      }
      // Schleim: prallt nach einem Wurf noch einmal ab
      if (CHAR.squishy && duck.vy > 600 && duck.bounces === 0 && duck.thrown) {
        duck.bounces = -1;
        duck.vy = -duck.vy * 0.42;
        squash(1.5, 0.55, 220);
        return;
      }
      if (fell > Math.max(110, DH * 1.5) && !dnd()) { duck.vy = 0; duck.vx = 0; duck.onGround = true; settle(); react('dizzy', t); return; }
      // Landung: je schneller, desto stärker plattgedrückt
      const hit = Math.min(1, duck.vy / 1400);
      const soft = CHAR.squishy ? 1.8 : 1; // Schleim wird beim Landen richtig platt
      if (duck.vy > 150) squash(1 + 0.22 * hit * soft, 1 - 0.2 * hit * soft, (120 + 120 * hit) * soft);
      if (duck.vy > 300 && !hardSave()) {
        for (let i = 0; i < 6; i++) {
          const side = i % 2 ? 1 : -1;
          particles.push({ type: 'dust', x: duck.x + DW / 2, y: groundY() + DH - 4,
            vx: side * rand(30, 90) * Math.max(0.4, SIZE), vy: rand(-25, -5), life: 1 });
        }
      }
      duck.vy = 0;
      duck.onGround = true;
      duck.vx = 0;
      // Freudenhüpfer: noch einmal
      if (duck.bounces > 0) { duck.bounces--; duck.onGround = false; duck.vy = -200; squash(0.9, 1.1, 120); }
      else { duck.bounces = 0; settle(); }
    }
    return;
  }
  duck.y = groundY();

  // 10 Minuten konzentriert getippt: Jubel
  if (isTyping(t)) focusMs += dt * 1000;
  else if (t - duck.lastKeyAt > 2 * 60 * 1000) focusMs = 0;
  if (focusMs >= 10 * 60 * 1000) { focusMs = 0; react('cheer', t); }
  // Mini-Claude tanzt kurz, wenn du 3 Minuten am Stück tippst
  if (CHAR.front && focusMs >= 3 * 60 * 1000 && !duck.danced) { duck.danced = true; startAction('dance', t); }
  if (focusMs === 0) duck.danced = false;

  updateWeather(dt, t);
  updateExtras(t);

  if (isTyping(t) || micMouth() > 0) return; // beim Tippen / Reden keine Extras

  // im Schlaf dreht sich die Ente ab und zu um
  if (duck.state === 'sleep' && !CHAR.front && Math.random() < dt / 25) turnTo(-duck.dir);

  // lange Pause oder „Nicht stören“: einschlafen
  if (duck.state === 'idle' && mood() === 'sleep') duck.until = 0;
  if (t > duck.until) pickState(t);
  if (duck.state === 'idle' && !dnd() && (duck.walkTo === null || duck.walkTo === undefined)) faceCursor(t);
}

// ---------- Herumlaufen ----------
const walkSpeed = () => 42 * Math.max(0.5, SIZE);
// Bereich, in dem gelaufen wird: auf einem Fenster dessen Oberkante, sonst der ganze Bildschirm
function walkBounds() {
  if (perch) return [Math.max(0, perch.left - DW * 0.4), Math.min(W - DW, perch.left + perch.width - DW * 0.6)];
  return [0, W - DW];
}
function maybeWalk(t, r) {
  if (!walking || hanging() || duck.state !== 'idle' || !duck.onGround || mood() !== 'awake') return false;
  const [lo, hi] = walkBounds();
  if (hi - lo < 10) return false;
  let to;
  // weg vom Stammplatz: meistens zurücklaufen
  if (!perch && homeX !== null && Math.abs(duck.x - homeX) > 12 && r < 0.7) to = homeX;
  else if (r < 0.32) to = duck.x + (Math.random() < 0.5 ? -1 : 1) * rand(60, 220) * Math.max(0.6, SIZE);
  else return false;
  duck.walkTo = Math.min(Math.max(to, lo), hi);
  duck.action = null;
  return true;
}
function updateWalk(dt, t) {
  if (duck.walkTo === null || duck.walkTo === undefined) return;
  if (!walking || duck.state === 'sleep' || duck.dragging || !duck.onGround) { duck.walkTo = null; return; }
  if (isTyping(t) || micMouth() > 0 || (acting(t) && ACTIONS[duck.action].priority)) return; // kurz stehen bleiben
  const d = duck.walkTo - duck.x;
  turnTo(d > 0 ? 1 : -1);
  const step = walkSpeed() * dt;
  if (Math.abs(d) <= step) {
    duck.x = duck.walkTo;
    duck.walkTo = null;
    duck.until = t + rand(3000, 8000); // erst mal umschauen, dann evtl. zurück
  } else duck.x += Math.sign(d) * step;
}

// ---------- Auf das aktive Fenster springen ----------
let nextWindowJump = 0;
function maybeJumpToWindow(t, r) {
  if (!windowJumps || !bridge || duck.state !== 'idle' || !duck.onGround || mood() !== 'awake') return false;
  // sitzt schon auf einem Fenster: nach einer Weile wieder runter nach Hause
  if (perch) {
    if (t > nextWindowJump && r < 0.25) { jumpHome(t); return true; }
    return false;
  }
  if (t < nextWindowJump || r > 0.06) return false;
  const rect = bridge.perchForeground();
  if (!rect) return false;
  nextWindowJump = t + rand(90, 240) * 1000; // so lange bleibt sie mindestens oben
  const x = Math.min(Math.max(duck.x, rect.left + 8), rect.left + rect.width - DW - 8);
  jumpTarget = rect;
  launchTo(x, rect.top - DH);
  return true;
}
function jumpHome(t) {
  perch = null;
  if (bridge) bridge.releasePerch();
  nextWindowJump = t + rand(120, 300) * 1000;
  launchTo(homeX !== null ? homeX : duck.x, bottomY());
}
// Sprung auf einer Wurfparabel genau zu (x, y); oben 40 px Luft
function launchTo(x, y) {
  const k = Math.max(0.4, SIZE); // y-Bewegung wird mit der Größe skaliert (siehe update)
  const g = GRAVITY * k;
  const peak = Math.min(duck.y, y) - 40 * Math.max(0.6, SIZE);
  const up = Math.sqrt(2 * g * Math.max(1, duck.y - peak));
  const down = Math.sqrt(2 * Math.max(1, y - peak) / g);
  const time = up / g + down;
  duck.vy = -up / k;
  duck.vx = (x - duck.x) / time;
  duck.onGround = false;
  duck.walkTo = null;
  fallStartY = null;
  squash(0.85, 1.18, 180);
}

// Rutschen auf dem Bauch: wenig Reibung, Staub, an Rändern abprallen
function updateSlide(dt, t) {
  duck.x += duck.vx * dt;
  duck.vx *= Math.exp(-1.4 * dt);
  if (!perch && (duck.x < 0 || duck.x > W - DW)) { duck.x = Math.min(Math.max(duck.x, 0), W - DW); duck.vx *= -0.6; }
  if (perch && offEdge()) { duck.sliding = false; checkPerchEdge(); return; }
  if (Math.random() < dt * 12 && !hardSave()) {
    particles.push({ type: 'dust', x: duck.x + (duck.vx > 0 ? 0 : DW), y: groundY() + DH - 4,
      vx: -Math.sign(duck.vx) * rand(20, 50), vy: rand(-15, -5), life: 1 });
  }
  if (Math.abs(duck.vx) < 25) {
    duck.sliding = false;
    duck.vx = 0;
    startAction('stretch', t); // wieder aufstehen
    settle();
  }
}

// Nach Wurf oder Rutschpartie zur Ruhe gekommen: hier ist der neue Stammplatz
function settle() {
  if (!duck.thrown && !CHAR.slides) return;
  if (perch) { duck.thrown = false; return; } // auf einem Fenster: Stammplatz bleibt
  duck.thrown = false;
  if (!gravity) restBottom = Math.round(Math.min(duck.y, bottomY()) + DH);
  saveHome(gravity ? null : restBottom);
}

// ---------- Bildrate: nur so oft zeichnen wie nötig (spart Akku) ----------
let lastCursorMove = 0;
function targetFps(t) {
  const busy = duck.dragging || duck.sliding || (duck.walkTo !== null && duck.walkTo !== undefined) || !duck.onGround || particles.some((p) => p.type !== 'rain' && p.type !== 'snow') || isTyping(t) || acting(t)
    || micMouth() > 0 || duck.happyUntil > t || duck.beakUntil > t || t - duck.squash.start < duck.squash.ms
    || (hoverSince && t - hoverSince < 1200);
  // Bilder pro Sekunde je Stufe: [Bewegung, Zeiger bewegt, Ruhe, Schlaf]
  const LEVELS = { 1: [30, 20, 10, 5], 2: [20, 12, 6, 3], 3: [10, 4, 2, 1] };
  if (energy) {
    const [moving, pointer, rest, sleep] = LEVELS[energy];
    if (busy) return moving;
    if (t - lastCursorMove < 400) return pointer;
    return duck.state === 'sleep' ? sleep : rest;
  }
  if (busy) return onBattery ? 30 : 60;
  if (t - lastCursorMove < 400) return 30;  // Augen folgen dem Zeiger
  if (duck.state === 'sleep') return 8;
  if (weatherFalling()) return 20;           // Regen/Schnee
  return 15;                                 // ruhig sitzen, atmen, blinzeln
}

let last = now();
// Es gibt immer genau einen geplanten nächsten Schritt: entweder ein Bild (raf) oder eine Wartezeit (wait).
let next = null;
function schedule(fps) {
  if (fps >= 60) next = { kind: 'raf', id: requestAnimationFrame(loop) };
  else {
    next = {
      kind: 'wait',
      id: setTimeout(() => { next = { kind: 'raf', id: requestAnimationFrame(loop) }; }, 1000 / fps),
    };
  }
}
function loop(t) {
  next = null;
  const dt = Math.min((t - last) / 1000, 0.15);
  last = t;
  update(dt, t);
  draw(t);
  schedule(targetFps(t));
}
// Bei Eingaben sofort weiterzeichnen statt auf den nächsten langsamen Takt zu warten
function kick() {
  if (!next || next.kind !== 'wait') return; // schon ein Bild geplant
  if (hardSave()) return; // Hart: nicht extra aufwecken, der nächste Takt kommt sowieso
  clearTimeout(next.id);
  next = { kind: 'raf', id: requestAnimationFrame(loop) };
}
schedule(60);

// Begrüßung beim Start: Mini-Claude winkt, die Ente streckt sich und hüpft
setTimeout(() => {
  const t = now();
  if (dnd()) return;
  if (isBirthday()) { react('cheer', t); nextConfetti = 0; return; }
  if (CHAR.front) startAction('wave', t);
  else { startAction('stretch', t); setTimeout(() => startAction('hop', now()), 1300); }
}, 900);

// Wecker / Timer: klingelt und hüpft (höchstens 30 s), bis man auf die Figur klickt
let ringing = false;
let ringTimer = null;
function stopRing() {
  ringing = false;
  clearInterval(ringTimer);
  if (duck.action === 'alarm') duck.action = null;
}
function ring() {
  const t = now();
  lastActivity = t;
  ringing = true;
  startAction('alarm', t);
  clearInterval(ringTimer);
  ringTimer = setInterval(() => {
    const n = now();
    if (duck.action !== 'alarm' || !acting(n)) { stopRing(); return; }
    if (duck.onGround && !duck.dragging) { duck.onGround = false; duck.vy = -260; squash(0.9, 1.1, 120); }
    spawn('bang', duck.x + DW * 0.5, duck.y - 6);
    kick();
  }, 650);
  kick();
}

// ---------- Füttern ----------
// Ein Snack fällt von oben in den Mund, dann wird gekaut, gekrümelt und sich gefreut.
const FAVORITE_FOOD = { frosti: 'FISH', hopsi: 'CARROT', pando: 'BAMBOO' };
function mouthPoint() {
  if (CHAR.front) return { x: duck.x + DW / 2, y: duck.y + DH * 0.55 };
  return { x: duck.x + DW * (isFlipped() ? 0.18 : 0.82), y: duck.y + DH * 0.38 };
}
function feed() {
  const t = now();
  wake();
  if (duck.state === 'sleep') { duck.state = 'idle'; duck.until = t + 4000; }
  duck.walkTo = null;
  const food = FAVORITE_FOOD[CHAR.id] || (Math.random() < 0.5 ? 'APPLE' : 'COOKIE');
  const m = mouthPoint();
  particles.push({ type: 'food', food, x: m.x, y: m.y - 70 * Math.max(0.6, SIZE), vx: 0, vy: 40, life: 1, target: m.y });
  duck.happyUntil = t + 900; // freut sich schon
  kick();
}
function eat() {
  const t = now();
  ACTIONS.eat = ACTIONS.eat || { frames: ['chew1', 'chew2'], step: 180, ms: 2400 };
  startAction('eat', t);
  duck.until = t + 4000;
  const m = mouthPoint();
  for (let i = 0; i < 6; i++) particles.push({ type: 'dust', x: m.x, y: m.y, vx: rand(-40, 40), vy: rand(-40, 10), life: 1 });
  setTimeout(() => {
    duck.happyUntil = now() + 1500;
    for (let i = 0; i < 3; i++) spawn('heart', duck.x + rand(0, DW), duck.y + rand(0, DH * 0.3));
    lastAttention = now();
    kick();
  }, ACTIONS.eat.ms);
}

// neuer Tipp-Rekord: Jubel mit Konfetti (Axolotl feiert doppelt)
function celebrateRecord() {
  if (dnd()) return;
  react('cheer', now());
  const n = CHAR.record ? 36 : 16;
  for (let i = 0; i < n; i++) spawn('confetti', duck.x + rand(-DW * 0.4, DW * 1.4), duck.y - rand(10, 50) * Math.max(0.5, SIZE));
  if (CHAR.record) setTimeout(() => startAction('dance', now()), ACTIONS.cheer.ms);
  kick();
}

// Ein Fenster wird nah an der Figur verschoben: hinschauen, bei Berührung erschrecken
let windowStartle = 0;
function onWindowMove(r) {
  if (dnd() || duck.dragging) return;
  const t = now();
  const dx = Math.max(r.x - (duck.x + DW), duck.x - (r.x + r.width), 0);
  const dy = Math.max(r.y - (duck.y + DH), duck.y - (r.y + r.height), 0);
  const dist = Math.hypot(dx, dy);
  if (dist > 160 * Math.max(0.6, SIZE)) return;
  // auf den nächsten Punkt des Fensters schauen
  const tx = Math.min(Math.max(duck.x + DW / 2, r.x), r.x + r.width);
  const ty = Math.min(Math.max(duck.y + DH / 2, r.y), r.y + r.height);
  duck.lookTarget = { x: tx, y: ty, until: t + 1500 };
  if (dist === 0 && t > windowStartle) {
    // Fenster schiebt sich über die Figur: aufwachen und erschrecken
    windowStartle = t + 6000;
    wake();
    react('startle', t);
  }
  kick();
}

// Einstellungen aus dem Menü übernehmen
function applyAppSettings(s) {
  energy = energyLevel(s.energiesparen);
  const g = s.schwerkraft !== false;
  if (g !== gravity) {
    gravity = g;
    if (gravity) { restBottom = null; duck.onGround = false; } // fällt wieder runter
    else restBottom = Math.round(duck.y + DH);                  // bleibt, wo sie gerade ist
  }
  extras = s.extras || {};
  sitOnWindows = Boolean(s.aufFenstern);
  walking = Boolean(s.laufen);
  windowJumps = Boolean(s.fensterSpringen);
  if (!sitOnWindows && !windowJumps && perch) { perch = null; duck.onGround = false; fallStartY = duck.y; }
  // Hart: Mikrofon-Auswertung aus (kostet die meiste Rechenzeit)
  if (hardSave()) setMic(false);
  const wasDnd = dnd();
  dndUntil = s.nichtStoerenBis || 0;
  if (dnd()) { duck.state = 'sleep'; duck.until = now() + 1e9; duck.action = null; }
  else if (wasDnd) { lastActivity = now(); duck.until = 0; wake(); }
}

// ---------- Maus ----------
// Trefferfläche: nie kleiner als 14 px, damit man auch eine winzige Figur noch greifen kann
function overDuck(x, y) {
  const grow = Math.max(0, (14 - Math.min(DW, DH)) / 2);
  return x >= duck.x - grow && x <= duck.x + DW + grow && y >= duck.y - grow && y <= duck.y + DH + grow;
}
let passThrough = true;
function setPassThrough(v) {
  if (v === passThrough) return;
  passThrough = v;
  if (bridge) bridge.setIgnoreMouse(v);
}

// gestreichelt oder angeklickt: Traurigkeit ist sofort vorbei
function cheerUp() {
  if (duck.action === 'sad') {
    duck.action = null;
    for (let i = 0; i < 3; i++) spawn('heart', duck.x + rand(0, DW), duck.y + rand(0, DH * 0.3));
  }
  lastAttention = now();
}

// Zeiger zwei Mal um die Figur kreisen lassen: ihr wird vom Hinterherschauen schwindelig
const circle = { angle: null, sum: 0, at: 0, cooldown: 0 };
function trackCircle(x, y) {
  const t = now();
  const cx = duck.x + DW / 2;
  const cy = duck.y + DH / 2;
  const d = Math.hypot(x - cx, y - cy);
  if (d < Math.max(DW, DH) * 0.6 || d > 220 || t - circle.at > 700 || duck.dragging || dnd()) {
    circle.angle = null; circle.sum = 0; circle.at = t; return;
  }
  const a = Math.atan2(y - cy, x - cx);
  if (circle.angle !== null) {
    let da = a - circle.angle;
    if (da > Math.PI) da -= Math.PI * 2;
    if (da < -Math.PI) da += Math.PI * 2;
    circle.sum += da;
  }
  circle.angle = a;
  circle.at = t;
  if (Math.abs(circle.sum) > Math.PI * 4 && t > circle.cooldown) {
    circle.sum = 0;
    circle.cooldown = t + 15000;
    wake();
    react('dizzy', t);
  }
}

function moveCursor(x, y) {
  trackCircle(x, y);
  // Streicheln: Maus über der Figur hin und her bewegen
  if (!duck.dragging && !dnd() && overDuck(x, y) && cursor.x >= 0) {
    pet.amount += Math.abs(x - cursor.x) + Math.abs(y - cursor.y);
    if (pet.amount > 600) {
      pet.amount = 0;
      duck.happyUntil = now() + 1200;
      cheerUp();
      wake();
      for (let i = 0; i < 2; i++) spawn('heart', duck.x + rand(0, DW), duck.y + rand(0, DH * 0.3));
    }
  }
  // Zeiger ruht auf der Figur (nur wenn er still steht und nichts anderes los ist)
  const still = Math.abs(x - cursor.x) + Math.abs(y - cursor.y) <= 2;
  if (overDuck(x, y) && !duck.dragging && !dnd()) {
    if (!hoverSince || !still) hoverSince = still ? (hoverSince || now()) : now();
  } else hoverSince = 0;
  if (Math.abs(x - cursor.x) + Math.abs(y - cursor.y) > 2 && !dnd()) {
    lastActivity = now();
    lastCursorMove = lastActivity;
    kick();
  }
  cursor.x = x;
  cursor.y = y;
}

// Mausposition im Arbeitsbereich (das App-Fenster bewegt sich, darum Bildschirm-Koordinaten)
const mouseX = (e) => (FOLLOW ? e.screenX - AREA.x : e.clientX);
const mouseY = (e) => (FOLLOW ? e.screenY - AREA.y : e.clientY);

window.addEventListener('mousemove', (e) => {
  const x = mouseX(e);
  const y = mouseY(e);
  if (!bridge) moveCursor(x, y);
  if (duck.dragging) {
    duck.x = x - duck.dragDX;
    duck.y = Math.min(y - duck.dragDY, bottomY());
    dragTrail.push({ x, y, t: now() });
    while (dragTrail.length > 6) dragTrail.shift();
    probeEdge();
    if (Math.abs(x - duck.downAt.x) + Math.abs(y - duck.downAt.y) > 6) duck.downAt.moved = true;
    return;
  }
  setPassThrough(!overDuck(x, y));
});

const dragTrail = []; // letzte Mauspositionen beim Ziehen (für den Wurf)
// Beim Ziehen regelmäßig nachsehen, ob die Figur gerade an einem Fensterrand ist
let edgeUnder = null;
let probing = false;
let lastProbe = 0;
function probeEdge() {
  if (!sitOnWindows || !bridge || probing || now() - lastProbe < 90) return;
  probing = true;
  lastProbe = now();
  bridge.probePerch({ x: duck.x, y: duck.y, width: DW, height: DH }).then((side) => {
    probing = false;
    const was = edgeUnder;
    edgeUnder = duck.dragging ? side : null;
    if (edgeUnder && !was) squash(1.1, 0.92, 120); // kleines „Hier!“
    kick();
  }, () => { probing = false; });
}
window.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  const x = mouseX(e);
  const y = mouseY(e);
  if (!overDuck(x, y)) return;
  duck.dragging = true;
  duck.onGround = false;
  duck.dragDX = x - duck.x;
  duck.dragDY = y - duck.y;
  duck.downAt = { x, y, moved: false };
  duck.action = null;
  duck.sliding = false;
  duck.vx = 0;
  dragTrail.length = 0;
  if (perch) { perch = null; if (bridge) bridge.releasePerch(); }
  duck.walkTo = null;
  jumpTarget = null;
  edgeUnder = null;
  wake();
  kick();
});

// Klick: kleiner Hüpfer; Ziehen: neuer Stammplatz
window.addEventListener('mouseup', (e) => {
  if (e.button !== 0 || !duck.dragging) return;
  duck.dragging = false;
  edgeUnder = null;
  duck.until = now() + rand(1500, 3000);
  if (!duck.downAt.moved) {
    const t = now();
    if (dnd()) { duck.vy = 0; return; }
    cheerUp();
    // Wecker klingelt: Klick macht ihn aus
    if (ringing) {
      stopRing(); duck.vy = 0; duck.onGround = true; duck.happyUntil = t + 1500;
      for (let i = 0; i < 3; i++) spawn('heart', duck.x + rand(0, DW), duck.y + rand(0, DH * 0.3));
      return;
    }
    // Geist erschrickt und wird kurz durchsichtig
    if (CHAR.float) { duck.fadeUntil = t + 1300; react('startle', t); return; }
    // ganz oft hintereinander geklickt: schwindelig
    clickTimes.push(t);
    while (clickTimes.length && clickTimes[0] < t - 2500) clickTimes.shift();
    if (clickTimes.length >= 5) {
      clickTimes.length = 0;
      duck.vy = 0;
      if (CHAR.rolls) duck.rollStart = t; // Panda kugelt sich erst einmal
      react('dizzy', t);
      return;
    }
    // Abklatschen: Zeiger ruht auf ihr (sie reckt die Arme), dann Klick
    if (hoverSince && t - hoverSince > 800 && !hanging()) {
      hoverSince = 0;
      react('cheer', t);
      for (let i = 0; i < 4; i++) spawn('heart', duck.x + rand(0, DW), duck.y + rand(0, DH * 0.3));
      return;
    }
    // Figuren mit Armen: Klick auf einen Arm → winkt mit genau diesem Arm
    if (CHAR.front && CHAR.arms) {
      const local = (duck.downAt.x - duck.x) / SCALE;
      if (local < WIDTH * 0.18 || local > WIDTH * 0.82) {
        duck.vy = 0;
        duck.onGround = true;
        startAction(local < WIDTH / 2 ? 'waveL' : 'wave', t);
        return;
      }
    }
    duck.beakUntil = t + 220;
    duck.vy = -420;
    squash(0.88, 1.14, 160);
    duck.happyUntil = t + 600;
  } else {
    fallStartY = duck.y; // merken, wie hoch sie losgelassen wurde
    duck.vy = 0;
    duck.x = Math.min(Math.max(duck.x, 0), W - DW);
    // auf einer Fensterkante losgelassen: dort sitzen bleiben (hat Vorrang vor dem Werfen)
    if (sitOnWindows && bridge) {
      const edge = bridge.findPerch({ x: duck.x, y: duck.y, width: DW, height: DH });
      if (edge) {
        attachPerch(edge.rect, edge.side);
        return; // Stammplatz an der Taskleiste bleibt, wie er war
      }
    }
    // Schwung mitnehmen: schnell losgelassen = geworfen
    const first = dragTrail[0];
    const lastP = dragTrail[dragTrail.length - 1];
    const span = first && lastP ? (lastP.t - first.t) / 1000 : 0;
    if (gravity && span > 0.01 && now() - lastP.t < 80) {
      const vx = (lastP.x - first.x) / span;
      const vy = (lastP.y - first.y) / span;
      if (Math.abs(vx) > 250 || vy < -350) {
        duck.vx = Math.max(-1800, Math.min(1800, vx));
        duck.vy = Math.max(-1400, Math.min(0, vy));
        duck.thrown = true;
        duck.bounces = 0;
        lastAttention = now();
        return;
      }
    }
    if (!gravity) restBottom = Math.round(Math.min(duck.y, bottomY()) + DH);
    saveHome(gravity ? null : restBottom);
  }
});

// Fehlersuche „Auf Fenster setzen“: ins Fehler-Log der App schreiben
const flog = (text) => { if (bridge && bridge.log) bridge.log(text); };

// Bezugspunkt je Kante: rechts hängt sie am rechten Rand, unten am unteren Rand
const perchAnchorX = (p) => (p.side === 'right' ? p.left + p.width : p.left);
const perchAnchorY = (p) => (p.side === 'bottom' ? p.top + p.height : p.top);
const hanging = () => Boolean(perch && perch.side !== 'top');
// oben: Mitte der Figur darf ein Stück über die Ecke hinausragen
const offEdge = () => {
  const cx = duck.x + DW / 2;
  return cx < perch.left - DW * 0.2 || cx > perch.left + perch.width + DW * 0.2;
};
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
function attachPerch(rect, side) {
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;
  let y = duck.y;
  if (side === 'top') { duck.x = clamp(duck.x, rect.left - DW * 0.6, right - DW * 0.4); y = rect.top - DH; }
  if (side === 'bottom') { duck.x = clamp(duck.x, rect.left - DW * 0.3, right - DW * 0.7); y = bottom - DH * 0.15; }
  if (side === 'left' || side === 'right') {
    duck.x = side === 'left' ? rect.left - DW * 0.75 : right - DW * 0.25;
    y = clamp(duck.y, rect.top - DH * 0.3, bottom - DH * 0.7);
    if (!CHAR.front) turnTo(side === 'left' ? 1 : -1); // zum Fenster schauen
  }
  perch = { ...rect, side, dy: 0 };
  perch.dy = y - perchAnchorY(perch);
  flog(`sitzt ${side} bei ${Math.round(duck.x)},${Math.round(y)} Fenster ${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)}`);
  duck.y = y;
  Object.assign(duck, { onGround: true, vx: 0, vy: 0, walkTo: null });
  fallStartY = null;
  squash(1.15, 0.88, 140);
}

// Das Fenster unter der Figur hat sich bewegt (oder ist weg)
function onPerch(rect) {
  if (jumpTarget) { jumpTarget = rect; return; } // Fenster bewegt sich während des Sprungs
  if (!perch) return;
  if (!rect) {
    // Fenster geschlossen oder minimiert: runterfallen
    flog('Fenster weg: fällt runter');
    perch = null;
    duck.onGround = false;
    duck.vy = -120;
    fallStartY = duck.y;
    react('startle', now());
    return;
  }
  if (duck.dragging) return;
  const next = { ...rect, side: perch.side, dy: perch.dy };
  duck.x += perchAnchorX(next) - perchAnchorX(perch); // mitfahren (auch beim Größerziehen)
  perch = next;
  if (duck.onGround) duck.y = groundY();
  kick();
}
// über die Kante hinaus gerutscht oder geschoben: runterfallen
function checkPerchEdge() {
  if (!perch || duck.dragging || hanging()) return;
  if (offEdge()) {
    flog(`über die Kante: Mitte ${Math.round(duck.x + DW / 2)}, Fenster ${Math.round(perch.left)}–${Math.round(perch.left + perch.width)}`);
    perch = null;
    if (bridge) bridge.releasePerch();
    duck.onGround = false;
    fallStartY = duck.y;
  }
}

// Doppelklick → großer Sprung
window.addEventListener('dblclick', (e) => {
  if (!overDuck(mouseX(e), mouseY(e))) return;
  wake();
  hoverSince = 0;
  duck.onGround = false;
  duck.vy = -820 * (CHAR.jump || 1); // Hase springt höher
  squash(0.82, 1.2, 200);
});

// Rechtsklick auf die Figur: dasselbe Menü wie unten rechts in der Taskleiste
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (bridge && overDuck(mouseX(e), mouseY(e))) bridge.openMenu();
});

// Strg + Mausrad auf der Figur: Größe stufenlos ändern
let lastSpin = 0;
window.addEventListener('wheel', (e) => {
  if (!overDuck(mouseX(e), mouseY(e))) return;
  // ohne Strg: am Mausrad drehen = Figur dreht sich einmal im Kreis
  if (!e.ctrlKey) {
    const t = now();
    if (t - lastSpin > 900 && !dnd() && !duck.dragging) { lastSpin = t; wake(); duck.rollStart = t; duck.happyUntil = t + 900; kick(); }
    return;
  }
  e.preventDefault();
  const step = SIZE < 0.5 ? 0.02 : 0.05;
  setSize(Math.round((SIZE + (e.deltaY < 0 ? step : -step)) * 100) / 100);
  if (bridge) bridge.saveSize(SIZE);
}, { passive: false });

// Größe ändern, die Figur bleibt unten an ihrem Platz
function setSize(size) {
  const centerX = duck.x + DW / 2;
  applySize(size);
  duck.x = Math.min(Math.max(centerX - DW / 2, 0), W - DW);
  duck.y = groundY();
}

if (bridge) {
  bridge.onKey(onKey);
  bridge.onPower((battery) => { onBattery = battery; });
  bridge.onWeather((w) => { weather = w; kick(); });
  bridge.onClaude((active) => { claudeActive = active; kick(); });
  bridge.onCursor(({ x, y }) => moveCursor(x, y));
  bridge.onSettings((s) => {
    setMic(s.mikrofon && energyLevel(s.energiesparen) < 3);
    if (typeof s.groesse === 'number' && Math.abs(s.groesse - SIZE) > 0.001) setSize(s.groesse);
    applyAppSettings(s);
    kick();
  });
  bridge.getSettings().then((s) => { setMic(s.mikrofon && energyLevel(s.energiesparen) < 3); applyAppSettings(s); });
  bridge.onWindow(onWindowMove);
  bridge.onPerch(onPerch);
  bridge.onCommand((cmd) => {
    if (cmd && cmd.type === 'alarm') ring();
    if (cmd && cmd.type === 'feed') feed();
    if (cmd === 'record') celebrateRecord();
    if (cmd === 'sleep') { duck.state = 'sleep'; duck.until = now() + 60000; lastActivity = -Infinity; }
    if (cmd === 'preview-extras') { previewExtrasUntil = now() + PREVIEW_MS; nextConfetti = 0; kick(); }
    if (cmd === 'reset') {
      restBottom = null;
      Object.assign(duck, { x: defaultX(), y: bottomY() - 150, vy: 0, onGround: false, dragging: false, state: 'idle' });
      saveHome(null);
      wake();
    }
  });
} else {
  // Browser-Testmodus: Tippen = Figur tippt mit, M = Mikrofon an/aus
  window.addEventListener('keydown', (e) => {
    const testKeys = !(window.duckConfig && window.duckConfig.testKeys === false);
    if (testKeys && e.key.toLowerCase() === 'm') setMic(!mic.on);
    else onKey();
  });
  window.__duck = {
    duck, mic, cursor, onKey, moveCursor, startAction, react, setSize,
    setCharacter(id) {
      const bottom = duck.y + DH;
      applyCharacter(id);
      duck.y = bottom - DH;
      duck.x = Math.min(duck.x, W - DW);
    },
    setHour(h) { window.duckConfig.hour = h; },
    ring, celebrateRecord, onWindowMove, feed,
    setWalking(on) { walking = on; }, maybeWalk, launchTo,
    jumpOnto(rect) { jumpTarget = rect; launchTo(Math.min(Math.max(duck.x, rect.left + 8), rect.left + rect.width - DW - 8), rect.top - DH); }, jumpHome,
    sitOn(rect, side = 'top') { attachPerch(rect, side); }, onPerch,
    get perch() { return perch; },
    setIdle(minutes) { lastActivity = now() - minutes * 60 * 1000; duck.until = 0; if (!minutes) wake(); kick(); },
    setWeather(w) { weather = w; extras = { ...extras, wetter: true, temperatur: true }; },
    setExtras(e) { extras = { ...extras, ...e }; },
    previewExtras() { previewExtrasUntil = now() + PREVIEW_MS; nextConfetti = 0; },
    setClaudeActive(a) { claudeActive = a; },
    setGravity(on) { applyAppSettings({ schwerkraft: on, energiesparen: energy, extras, nichtStoerenBis: dndUntil }); },
    setEnergy(level) { applyAppSettings({ schwerkraft: gravity, energiesparen: level, extras, nichtStoerenBis: dndUntil }); },
    setDnd(minutes) { dndUntil = minutes ? Date.now() + minutes * 60000 : 0; if (minutes) { duck.state = 'sleep'; duck.until = now() + 1e9; } else { duck.until = 0; wake(); } },
  };
}
