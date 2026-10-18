const {
  app, BrowserWindow, Tray, Menu, ipcMain, screen, shell, nativeImage, session, safeStorage, powerMonitor,
} = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startWatching, loadWin32 } = require('./watcher');
const { CHARACTERS, ORDER } = require('./sprites');
const { setupUpdater } = require('./update');
const weatherApi = require('./weather');

// Durchsichtige Fenster werden mit manchen Grafiktreibern unsichtbar oder schwarz.
// Ohne Grafikbeschleunigung belastet die App außerdem die GPU gar nicht.
app.disableHardwareAcceleration();
// Weniger Arbeitsspeicher: Chromium-Dienste abschalten, die eine Taskleisten-Figur nie braucht,
// und den JavaScript-Speicher klein halten.
app.commandLine.appendSwitch('disable-features', [
  'SpareRendererForSitePerProcess', 'CalculateNativeWinOcclusion', 'MediaRouter', 'HardwareMediaKeyHandling',
  'Translate', 'AutofillServerCommunication', 'OptimizationHints', 'InterestFeedContentSuggestions',
].join(','));
app.commandLine.appendSwitch('js-flags', '--optimize-for-size --max-old-space-size=96');
app.commandLine.appendSwitch('disable-background-networking');
// Grafik- und Netzwerkdienst im Hauptprozess statt als eigene Prozesse (zwei Prozesse weniger)
app.commandLine.appendSwitch('in-process-gpu');
app.commandLine.appendSwitch('enable-features', 'NetworkServiceInProcess2');

// Früher hieß die App „Desktop Ente“. Deren Datenordner weiter nutzen, damit Einstellungen,
// Tippzähler und Update-Schlüssel (der Schlüssel dazu liegt in „Local State“) erhalten bleiben.
const OLD_DATA = path.join(app.getPath('appData'), 'Desktop Ente');
if (fs.existsSync(OLD_DATA)) app.setPath('userData', OLD_DATA);

// Autostart-Eintrag der alten „Desktop Ente.exe“ auf die neue Datei umstellen
function moveOldAutostart() {
  if (process.platform !== 'win32' || !app.isPackaged) return;
  const old = { name: 'electron.app.Desktop Ente', path: path.join(path.dirname(process.execPath), 'Desktop Ente.exe') };
  if (!app.getLoginItemSettings(old).openAtLogin) return;
  app.setLoginItemSettings({ ...old, openAtLogin: false });
  app.setLoginItemSettings({ openAtLogin: true });
}

// Grundgröße des Figuren-Fensters: Figur unten mittig, darüber Platz für Effekte
const BASE_W = 240;
const BASE_H = 200;
const MIN_SIZE = 0.1;
const MAX_SIZE = 3;
const SIZE_PRESETS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.75, 1, 1.5, 2];
const WEATHER_EVERY = 30 * 60 * 1000;

const DEFAULT_SETTINGS = {
  figur: 'claude',
  groesse: 1, // 0.1 … 3
  homeX: null, // Stammplatz an der Taskleiste (null = unten rechts)
  homeBottom: null, // ohne Schwerkraft: Fußhöhe, an der die Figur stehen bleibt
  schwerkraft: true, // an: fällt immer nach unten; aus: bleibt, wo man sie hinzieht
  imVollbild: false, // auch über Spielen / Videos im Vollbild anzeigen
  aufFenstern: false, // Figur kann auf die Oberkante von Fenstern gesetzt werden
  laufen: false, // läuft ab und zu ein Stück an der Taskleiste entlang
  fensterSpringen: false, // springt ab und zu auf das Fenster, in dem du gerade arbeitest
  pausen: true, // nach 60 Minuten Tippen am Stück an eine Pause erinnern
  zweiteFigur: null, // zweite Figur daneben (Name der Figur) oder aus
  home2X: null, // Stammplatz der zweiten Figur
  launeAn: true, // Laune: Füttern, Streicheln, Spielen machen fröhlich, Ignorieren traurig
  laune: 70, // 0 … 100
  launeZeit: 0, // wann die Laune zuletzt gesunken ist bzw. gespeichert wurde
  abzeichen: {}, // erreichte Tasten-Meilensteine: { 10000: '2026-10-18' }
  spielzeit: { gefuettert: 0, gestreichelt: 0, ball: 0, abgeklatscht: 0, geworfen: 0 },
  spielAbzeichen: {}, // { 'ball:100': '2026-10-18' }
  farbe: 'original', // Farbvariante der Figur
  farbe2: 'original', // Farbvariante der zweiten Figur
  mikrofon: false,
  tastatur: true,
  energiesparen: 0, // 0 aus, 1 leicht, 2 mittel, 3 hart
  nichtStoerenBis: 0,
  extras: {
    weihnachten: true, // Mütze im Dezember
    ostern: true, // Hasenohren und Osterei von Karfreitag bis Ostermontag
    halloween: true, // Kürbis und Fledermäuse vom 24. bis 31. Oktober
    silvester: true, // Partyhut an Silvester und Neujahr
    geburtstag: true, // Partyhut und Konfetti am Geburtstag
    geburtstagDatum: '', // "TT.MM."
    wetter: false,
    ort: null, // { name, lat, lon }
    temperatur: true,
  },
  // Tippzähler: nur die Anzahl der Tastendrücke, nie welche Tasten
  zaehler: { tag: '', heute: 0, gesamt: 0, rekord: 0, rekordTag: '', tage: {} },
};
const SETTINGS_VERSION = 4;
// Einstellungen früherer Versionen, die es nicht mehr gibt
const REMOVED_KEYS = ['taskleisteDurchsichtig', 'lautstaerke', 'shoppingWaechter', 'shopSeiten', 'kaufWoerter', 'starkeKaufWoerter', 'stoebernWoerter', 'verweilSekunden'];

let win = null;  // Haupt-Figur
let win2 = null; // zweite Figur (optional)
const pets = () => [win, win2].filter((w) => w && !w.isDestroyed());
// an beide Figuren schicken
function sendAll(channel, ...args) { for (const w of pets()) w.webContents.send(channel, ...args); }
const isSecond = (wc) => Boolean(win2 && !win2.isDestroyed() && wc === win2.webContents);
const wideWindows = new Set(); // Fenster, die gerade breit sind (Ballspiel)
let ballOn = false;             // Ball liegt gerade draußen
let promptWin = null;
let tray = null;
let settings = null;
let stopWatcher = null;
let updater = null;
let weather = null; // { code, temp, isDay }
let weatherProblem = '';

// ---------- Einstellungen ----------
function settingsPath() {
  return path.join(app.getPath('userData'), 'einstellungen.json');
}

function loadSettings() {
  let saved = {};
  try {
    saved = JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
  } catch { /* erster Start */ }
  settings = {
    ...DEFAULT_SETTINGS,
    ...saved,
    extras: { ...DEFAULT_SETTINGS.extras, ...saved.extras },
    zaehler: { ...DEFAULT_SETTINGS.zaehler, ...saved.zaehler },
    spielzeit: { ...DEFAULT_SETTINGS.spielzeit, ...saved.spielzeit },
  };
  if ((settings.version || 1) < 2) settings.mikrofon = false; // war früher standardmäßig an
  for (const key of REMOVED_KEYS) delete settings[key];
  delete settings.extras.musik; // Musik-Reaktion gibt es nicht mehr
  if (!CHARACTERS[settings.figur]) settings.figur = DEFAULT_SETTINGS.figur; // entfernte Figuren
  settings.zaehler.tage = settings.zaehler.tage || {};
  // früher ein Haken (an/aus), jetzt eine Stufe
  if (typeof settings.energiesparen === 'boolean') settings.energiesparen = settings.energiesparen ? 2 : 0;
  settings.version = SETTINGS_VERSION;
  saveSettings();
}

function saveSettings() {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
}

// Der Update-Schlüssel wird mit Windows-Verschlüsselung (DPAPI) dauerhaft gespeichert.
// Er bleibt bei Updates erhalten, weil die Einstellungen außerhalb des Programmordners liegen.
function getToken() {
  if (!settings.updateTokenEnc) return '';
  try {
    return safeStorage.decryptString(Buffer.from(settings.updateTokenEnc, 'base64'));
  } catch {
    return '';
  }
}

function setToken(token) {
  if (!token) delete settings.updateTokenEnc;
  else if (safeStorage.isEncryptionAvailable()) settings.updateTokenEnc = safeStorage.encryptString(token).toString('base64');
  else log('schlüssel nicht gespeichert: keine Verschlüsselung verfügbar');
  saveSettings();
}

// ---------- Log ----------
function logPath() {
  return path.join(app.getPath('userData'), 'ente-log.txt');
}

// Fehler-Log klein halten: über 512 KB bleiben die letzten 256 KB
function trimLog() {
  try {
    const p = logPath();
    const size = fs.statSync(p).size;
    if (size < 512 * 1024) return;
    const fd = fs.openSync(p, 'r');
    const buf = Buffer.alloc(256 * 1024);
    fs.readSync(fd, buf, 0, buf.length, size - buf.length);
    fs.closeSync(fd);
    const text = buf.toString('utf8');
    fs.writeFileSync(p, text.slice(text.indexOf('\n') + 1));
  } catch { /* noch kein Log */ }
}

function log(...parts) {
  try {
    fs.appendFileSync(logPath(), `[${new Date().toISOString()}] ${parts.join(' ')}\n`);
  } catch { /* Log ist nur zur Fehlersuche */ }
}

// ---------- Figuren-Fenster ----------
function workArea() {
  return screen.getPrimaryDisplay().workArea;
}

function petSize() {
  const k = Math.max(1, settings.groesse || 1);
  return { width: Math.round(BASE_W * k), height: Math.round(BASE_H * k) };
}

function createWindow(second = false) {
  const area = workArea();
  const size = petSize();
  const w = new BrowserWindow({
    x: area.x + area.width - size.width,
    y: area.y + area.height - size.height,
    ...size,
    transparent: true,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), spellcheck: false, enableWebSQL: false },
  });
  if (second) win2 = w; else win = w;
  w.setAlwaysOnTop(true, 'screen-saver');
  w.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  w.setIgnoreMouseEvents(true, { forward: true });
  w.loadFile(path.join(__dirname, 'index.html'));
  w.webContents.on('console-message', (e) => {
    if (e.level === 'warning' || e.level === 'error') {
      log('renderer', e.message, `${path.basename(e.sourceId || '')}:${e.lineNumber}`);
    }
  });
  // Absturz-Schutz: stürzt die Figur ab oder hängt sie, wird sie neu geladen
  let crashes = 0;
  w.webContents.on('render-process-gone', (_e, details) => {
    log('renderer weg', details.reason);
    if (details.reason === 'clean-exit' || w.isDestroyed() || ++crashes > 5) return;
    setTimeout(() => { if (!w.isDestroyed()) w.webContents.reload(); }, 1500);
  });
  let hangTimer = null;
  w.webContents.on('unresponsive', () => {
    log('renderer hängt');
    clearTimeout(hangTimer);
    hangTimer = setTimeout(() => {
      if (w.isDestroyed()) return;
      log('renderer neu geladen');
      w.webContents.forcefullyCrashRenderer();
      w.webContents.reload();
    }, 8000);
  });
  w.webContents.on('responsive', () => clearTimeout(hangTimer));
  w.webContents.on('did-finish-load', () => {
    log('geladen', second ? '(zweite Figur)' : '', JSON.stringify(workArea()));
    sendPower();
    if (weather) w.webContents.send('weather', weather);
    w.webContents.send('claude', claudeActive);
  });
  w.on('closed', () => { if (second) win2 = null; });
}

// Bildschirm geändert (Auflösung, Skalierung): Figuren neu starten lassen
function watchDisplays() {
  screen.on('display-metrics-changed', () => pets().forEach((w) => w.reload()));
}

// Zweite Figur an- oder ausschalten
function applySecondPet() {
  const want = settings.zweiteFigur && CHARACTERS[settings.zweiteFigur];
  if (want && !win2) createWindow(true);
  else if (!want && win2) { win2.destroy(); win2 = null; }
}

// Energiesparmodus in Stufen: wie oft abgefragt wird und mit welcher Priorität die App läuft
const ENERGY = [
  { name: 'Aus', info: 'volle Animation', cursorMs: 33, watchMs: 1000, prio: 'PRIORITY_NORMAL' },
  { name: 'Leicht', info: 'flüssig, etwas sparsamer', cursorMs: 60, watchMs: 1500, prio: 'PRIORITY_NORMAL' },
  { name: 'Mittel', info: 'spart deutlich, niedrige Priorität', cursorMs: 120, watchMs: 2500, prio: 'PRIORITY_BELOW_NORMAL' },
  { name: 'Hart', info: 'fast nichts: kaum Animation, Mikrofon aus', cursorMs: 300, watchMs: 4000, prio: 'PRIORITY_LOW' },
];
const energy = () => ENERGY[settings.energiesparen] || ENERGY[0];

function applyEnergyMode() {
  const prio = os.constants.priority[energy().prio];
  for (const m of app.getAppMetrics()) {
    try { os.setPriority(m.pid, prio); } catch { /* Prozess schon beendet */ }
  }
}
setInterval(() => {
  if (!settings || settings.energiesparen < 2 || !win) return;
  win.webContents.session.clearCache().catch(() => {});
  sendAll('command', 'trim');
  applyEnergyMode(); // neu gestartete Hilfsprozesse auch herunterstufen
}, 5 * 60 * 1000);

// Im Akkubetrieb zeichnet die Figur seltener
function sendPower() {
  sendAll('power', powerMonitor.isOnBatteryPower());
}

// Fenstergröße an die Figurengröße anpassen, unten bündig
function fitPetWindow() {
  for (const w of pets()) {
    const b = w.getBounds();
    const size = windowSize(w);
    if (b.width === size.width && b.height === size.height) continue;
    w.setBounds({ x: b.x, y: b.y + b.height - size.height, ...size });
  }
}
// normal so groß wie die Figur; beim Ballspiel ein breiter Streifen über die ganze Breite
function windowSize(w) {
  const size = petSize();
  if (!wideWindows.has(w)) return size;
  return { width: workArea().width, height: size.height + Math.round(340 * Math.max(1, settings.groesse || 1)) };
}

let hiddenForFullscreen = false;
function updateFullscreen(fullscreen) {
  const hide = fullscreen && !settings.imVollbild;
  if (hide === hiddenForFullscreen) return;
  hiddenForFullscreen = hide;
  for (const w of pets()) { if (hide) w.hide(); else w.showInactive(); }
}

// Mini-Claude merkt, wenn ein Claude-Fenster vorne ist (Desktop-App oder claude.ai im Browser)
let claudeActive = false;
function updateClaude(title) {
  const active = /\bClaude\b/.test(title || '') && !/Claude Buddy|Desktop Ente/.test(title);
  if (active === claudeActive) return;
  claudeActive = active;
  sendAll('claude', active);
}

// ---------- Tippzähler ----------
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmt = (n) => n.toLocaleString('de-DE');
const shortDay = (key, opts = { weekday: 'short', day: 'numeric', month: 'numeric' }) => new Date(key + 'T12:00').toLocaleDateString('de-DE', opts);
let counterDirty = false;

// Meilensteine für Abzeichen (Tastendrücke insgesamt)
const BADGES = [1000, 10000, 50000, 100000, 250000, 500000, 1000000];
function markOldBadges() {
  // was vor dieser Version schon erreicht war, gilt als „früher“ erreicht (ohne Feier)
  for (const m of BADGES) if (settings.zaehler.gesamt >= m && !settings.abzeichen[m]) settings.abzeichen[m] = 'früher';
}
function badgesMenu() {
  const next = BADGES.find((m) => !settings.abzeichen[m]);
  const done = BADGES.filter((m) => settings.abzeichen[m]);
  return [
    ...(done.length ? done.map((m) => ({
      label: `★ ${fmt(m)} Tasten${settings.abzeichen[m] !== 'früher' ? ` (am ${shortDay(settings.abzeichen[m], { day: 'numeric', month: 'numeric', year: '2-digit' })})` : ''}`,
      enabled: false,
    })) : [{ label: 'Noch keins – das erste gibt es bei 1.000 Tasten', enabled: false }]),
    ...(next ? [{ type: 'separator' }, { label: `Nächstes: ${fmt(next)} (noch ${fmt(next - settings.zaehler.gesamt)})`, enabled: false }] : []),
  ];
}

function countKey() {
  const z = settings.zaehler;
  const tag = dayKey();
  if (z.tag !== tag) { z.tag = tag; z.heute = 0; } // neuer Tag
  z.heute++;
  z.gesamt++;
  if (BADGES.includes(z.gesamt) && !settings.abzeichen[z.gesamt]) {
    settings.abzeichen[z.gesamt] = tag;
    sendAll('command', { type: 'badge', count: z.gesamt });
    log('abzeichen', z.gesamt);
    saveSettings();
  }
  z.tage[tag] = z.heute;
  if (z.heute > z.rekord) {
    // alter Rekord eines anderen Tages gerade geknackt: die Figur feiert
    if (z.rekordTag && z.rekordTag !== tag && z.rekord > 0) sendAll('command', 'record');
    z.rekord = z.heute;
    z.rekordTag = tag;
  }
  counterDirty = true;
}

// die letzten 7 Tage, ältere Einträge werden entfernt
function lastWeek() {
  const z = settings.zaehler;
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    days.push({ key, count: z.tage[key] || 0 });
  }
  const keep = new Set(days.map((d) => d.key));
  for (const key of Object.keys(z.tage)) if (!keep.has(key)) delete z.tage[key];
  return days;
}

function counterMenu() {
  const z = settings.zaehler;
  const heute = z.tag === dayKey() ? z.heute : 0;
  return [{ label: `Tippzähler: heute ${fmt(heute)}`, submenu: counterItems() }];
}
function counterItems() {
  const z = settings.zaehler;
  const heute = z.tag === dayKey() ? z.heute : 0;
  const week = lastWeek();
  const weekSum = week.reduce((s, d) => s + d.count, 0);
  const max = Math.max(1, ...week.map((d) => d.count));
  const rekord = z.rekordTag === dayKey() ? 'heute' : z.rekordTag ? shortDay(z.rekordTag) : '';
  return [
    { label: `Heute getippt: ${fmt(heute)}`, click: () => {} },
    {
      label: `Diese Woche: ${fmt(weekSum)}`,
      submenu: week.slice().reverse().map((d) => ({
        label: `${d.key === dayKey() ? 'Heute' : shortDay(d.key)}   ${fmt(d.count)}   ${'▮'.repeat(Math.round((d.count / max) * 10))}`,
        enabled: false,
      })),
    },
    { label: `Gesamt ${fmt(z.gesamt)} · Rekord ${fmt(z.rekord)}${rekord ? ` (${rekord})` : ''}`, enabled: false },
    { label: `Abzeichen (${BADGES.filter((m) => settings.abzeichen[m]).length} von ${BADGES.length})`, submenu: badgesMenu() },
  ];
}

// ---------- Wetter ----------
let weatherTimer = null;
async function refreshWeather() {
  clearTimeout(weatherTimer);
  const { wetter, ort } = settings.extras;
  if (!wetter || !ort) return;
  try {
    weather = await weatherApi.currentWeather(ort);
    weatherProblem = '';
    sendAll('weather', weather);
  } catch (err) {
    weatherProblem = 'Wetter gerade nicht erreichbar';
    log('wetter', err.message);
  }
  buildMenu();
  weatherTimer = setTimeout(refreshWeather, WEATHER_EVERY);
}

let lastWheel = 0;

// ---------- Beobachten ----------
function startWatchers() {
  // Zähler: Menü alle 3 s auffrischen, alle 30 s speichern (nicht bei jedem Tastendruck)
  setInterval(() => { if (counterDirty) buildMenu(); }, 3000);
  setInterval(() => { if (counterDirty) { counterDirty = false; saveSettings(); } }, 30000);

  stopWatcher = startWatching({
    getInterval: () => energy().watchMs,
    onKey: (kind) => {
      countKey();
      if (settings.tastatur || kind !== 'key') sendAll('key', kind, Boolean(settings.tastatur));
    },
    onMouse: (ev) => {
      if (!win || hiddenForFullscreen) return;
      const a = workArea();
      if (ev.type === 'click') {
        // Klicks auf die Figur selbst zählen nicht
        const p = screen.screenToDipPoint({ x: ev.x, y: ev.y });
        if (pets().some((w) => { const b = w.getBounds(); return p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + b.height; })) return;
        sendAll('input', { type: 'click', x: p.x - a.x, y: p.y - a.y });
      } else if (ev.type === 'wheel' && Date.now() - lastWheel > 150) {
        lastWheel = Date.now();
        sendAll('input', { type: 'wheel', dir: ev.dir });
      }
    },
    onState: ({ fullscreen, title }) => {
      if (!win) return;
      updateFullscreen(fullscreen);
      updateClaude(title);
      // „Nicht stören“ ist abgelaufen
      if (settings.nichtStoerenBis && Date.now() > settings.nichtStoerenBis) {
        settings.nichtStoerenBis = 0;
        saveSettings();
        sendSettings();
        buildMenu();
      }
    },
  });

  // Mauszeiger verfolgen, damit die Figur hinschauen kann (im Energiesparmodus seltener)
  let lastPos = '';
  let lastRaise = 0;
  let lastWinPoll = 0;
  let lastFocus = '';
  let lastRect = '';
  const win32 = loadWin32();
  const pollCursor = () => {
    if (win && !win.isDestroyed() && !hiddenForFullscreen) {
      const p = screen.getCursorScreenPoint();
      // Zeiger über der Figur: Fenster wieder ganz nach vorne holen. Die Taskleiste (auch mit
      // TranslucentTB) schiebt sich sonst nach einem Klick über die Figur, und die lässt sich
      // erst wieder anfassen, wenn die Taskleiste den Fokus verliert.
      for (const w of pets()) {
        const b = w.getBounds();
        const over = p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + b.height;
        if (over && Date.now() - lastRaise > 400) {
          lastRaise = Date.now();
          w.setAlwaysOnTop(true, 'screen-saver');
          w.moveTop();
        }
      }
      const a = workArea();
      const pos = { x: p.x - a.x, y: p.y - a.y };
      // Fenster wird verschoben oder vergrößert: Position an die Figur schicken (nicht im Modus Hart)
      // nur wenn sich der Zeiger bewegt (Fenster werden mit der Maus verschoben) – spart Rechenzeit
      const cursorMoved = pos.x + ',' + pos.y !== lastPos;
      if (win32 && cursorMoved && settings.energiesparen < 3 && Date.now() - lastWinPoll >= 100) {
        lastWinPoll = Date.now();
        const fg = win32.foreground();
        if (fg && !/Claude Buddy/.test(fg.title) && !IGNORED_WINDOW_CLASSES.has(fg.cls) && !fg.maximized) {
          const key = `${fg.hwnd}:${fg.x},${fg.y},${fg.width},${fg.height}`;
          if (lastRect && key !== lastRect && lastRect.split(':')[0] === String(fg.hwnd)) {
            const r = screen.screenToDipRect(null, { x: fg.x, y: fg.y, width: fg.width, height: fg.height });
            sendAll('window', { x: r.x - a.x, y: r.y - a.y, width: r.width, height: r.height });
          }
          if (lastFocus && lastFocus !== fg.hwnd) {
            // zu einem anderen Programm gewechselt: kurz hinschauen
            const r = screen.screenToDipRect(null, { x: fg.x, y: fg.y, width: fg.width, height: fg.height });
            sendAll('input', { type: 'focus', x: r.x - a.x + r.width / 2, y: r.y - a.y + Math.min(r.height / 2, 200) });
          }
          lastFocus = fg.hwnd;
          lastRect = key;
        } else lastRect = '';
      }
      const key = pos.x + ',' + pos.y;
      if (key !== lastPos) sendAll('cursor', pos);
      lastPos = key;
    }
    setTimeout(pollCursor, energy().cursorMs);
  };
  pollCursor();
}

// ---------- Auf Fenster setzen ----------
let perch = null; // { hwnd, key }
let perchTimer = null;
function perchRect(r) {
  const a = workArea();
  const d = screen.screenToDipRect(null, { x: r.left, y: r.top, width: r.right - r.left, height: r.bottom - r.top });
  return { left: d.x - a.x, top: d.y - a.y, width: d.width, height: d.height };
}
function startPerchWatch() {
  clearTimeout(perchTimer);
  const tick = () => {
    if (!perch || !win || win.isDestroyed()) return;
    const win32 = loadWin32();
    let r = win32 ? win32.rectOf(perch.hwnd) : { gone: 'keine Windows-Funktionen' };
    if (r.gone === 'geschlossen' && perch.address) {
      // Zeiger erneut über die Adresse holen, bevor die Figur runterfällt
      const again = win32.findByAddress(perch.address);
      if (again) { perch.hwnd = again; r = win32.rectOf(again); }
    }
    const off = !(settings.aufFenstern || settings.fensterSpringen);
    if (r.gone || off) {
      // Fenster zu oder minimiert: Figur fällt runter
      log('fenster', 'runtergefallen:', off ? 'ausgeschaltet' : r.gone);
      perch = null;
      win.webContents.send('perch', null);
      return;
    }
    const key = `${r.left},${r.top},${r.right},${r.bottom}`;
    if (key !== perch.key) { perch.key = key; win.webContents.send('perch', perchRect(r)); }
    perchTimer = setTimeout(tick, settings.energiesparen >= 3 ? 250 : 40); // flüssig mitfahren
  };
  tick();
}

// Desktop, Taskleiste und Startmenü sind keine Fenster, die man verschiebt
const IGNORED_WINDOW_CLASSES = new Set(['Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd', 'Windows.UI.Core.CoreWindow', 'XamlExplorerHostIslandWindow']);

// Die Figur bekommt nur, was sie braucht (der Update-Schlüssel bleibt im Hauptprozess)
const petSettings = () => ({
  schwerkraft: settings.schwerkraft,
  mikrofon: settings.mikrofon,
  groesse: settings.groesse,
  energiesparen: settings.energiesparen,
  nichtStoerenBis: settings.nichtStoerenBis,
  aufFenstern: settings.aufFenstern,
  laufen: settings.laufen,
  fensterSpringen: settings.fensterSpringen,
  pausen: settings.pausen,
  launeAn: settings.launeAn,
  laune: settings.laune,
  zweiteFigur: Boolean(settings.zweiteFigur),
  extras: { ...settings.extras, ort: undefined },
});

function sendSettings() {
  sendAll('settings', petSettings());
}

// ---------- Spielzeit: was mit der Figur gemacht wurde, mit eigenen Abzeichen ----------
const PLAY_STATS = {
  gefuettert: { label: 'Gefüttert', steps: [10, 50, 100, 500] },
  gestreichelt: { label: 'Gestreichelt', steps: [10, 50, 200, 1000] },
  ball: { label: 'Ballkontakte', steps: [25, 100, 500, 2000] },
  abgeklatscht: { label: 'Abgeklatscht', steps: [10, 50, 200] },
  geworfen: { label: 'Geworfen', steps: [10, 50, 200] },
};
let statSaveTimer = null;
function countStat(key) {
  const stat = PLAY_STATS[key];
  if (!stat) return;
  const n = (settings.spielzeit[key] || 0) + 1;
  settings.spielzeit[key] = n;
  if (stat.steps.includes(n) && !settings.spielAbzeichen[`${key}:${n}`]) {
    settings.spielAbzeichen[`${key}:${n}`] = dayKey();
    sendAll('command', { type: 'badge' });
    log('spiel-abzeichen', key, n);
    saveSettings();
  }
  clearTimeout(statSaveTimer);
  statSaveTimer = setTimeout(() => { saveSettings(); buildMenu(); }, 3000);
}
function playMenu() {
  const items = Object.entries(PLAY_STATS).map(([key, stat]) => {
    const n = settings.spielzeit[key] || 0;
    const stars = stat.steps.filter((s) => settings.spielAbzeichen[`${key}:${s}`]).length;
    const next = stat.steps.find((s) => !settings.spielAbzeichen[`${key}:${s}`]);
    return {
      label: `${stat.label}: ${fmt(n)}   ${'★'.repeat(stars)}${'☆'.repeat(stat.steps.length - stars)}${next ? `   (nächstes bei ${fmt(next)})` : ''}`,
      enabled: false,
    };
  });
  return items;
}

// ---------- Farbvarianten ----------
const COLORS = [
  ['original', 'Original'], ['blau', 'Blau'], ['gruen', 'Grün'], ['lila', 'Lila'],
  ['rosa', 'Rosa'], ['gold', 'Gold'], ['mitternacht', 'Mitternacht'],
];
function setColor(key, second) {
  settings[second ? 'farbe2' : 'farbe'] = key;
  saveSettings();
  const w = second ? win2 : win;
  if (w && !w.isDestroyed()) w.reload();
  buildMenu();
}
const colorMenu = (second) => COLORS.map(([key, label]) => ({
  label, type: 'radio', checked: settings[second ? 'farbe2' : 'farbe'] === key, click: () => setColor(key, second),
}));

// ---------- Neue Datei auf dem Desktop: die Figur schaut neugierig ----------
function watchDesktop() {
  let dir;
  try { dir = app.getPath('desktop'); } catch { return; }
  let timer = null;
  try {
    fs.watch(dir, (type, name) => {
      if (type !== 'rename' || !name || name.startsWith('~$') || /\.(tmp|crdownload|part)$/i.test(name) || name === 'desktop.ini') return;
      const file = path.join(dir, name);
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          const st = fs.statSync(file);
          if (Date.now() - Math.max(st.birthtimeMs || 0, st.mtimeMs) > 15000) return; // nur wirklich neue Dateien
          sendAll('command', { type: 'desktop' });
        } catch { /* gelöscht statt neu */ }
      }, 800);
    });
  } catch (err) { log('desktop', err.message); }
}

// ---------- Laune ----------
const moodWord = (v) => (v >= 80 ? 'überglücklich' : v >= 60 ? 'fröhlich' : v >= 40 ? 'okay' : v >= 20 ? 'traurig' : 'sehr traurig');
let moodSaveTimer = null;
function changeMood(delta) {
  if (!settings.launeAn) return;
  const before = Math.round(settings.laune);
  settings.laune = Math.min(100, Math.max(0, settings.laune + delta));
  if (delta > 0) settings.launeZeit = Date.now();
  if (Math.round(settings.laune) === before) return;
  sendSettings();
  clearTimeout(moodSaveTimer);
  moodSaveTimer = setTimeout(() => { saveSettings(); buildMenu(); }, 2000);
}
// ohne Beachtung sinkt die Laune langsam: 3 Punkte pro halber Stunde (auch während die App aus war, höchstens 30)
function decayMood() {
  if (!settings.launeAn) return;
  const since = Date.now() - (settings.launeZeit || Date.now());
  const steps = Math.min(10, Math.floor(since / (30 * 60 * 1000)));
  if (steps < 1) return;
  settings.launeZeit = Date.now();
  changeMood(-3 * steps);
}

function setSize(size) {
  settings.groesse = Math.round(Math.min(MAX_SIZE, Math.max(MIN_SIZE, size)) * 100) / 100;
  saveSettings();
  fitPetWindow();
  sendSettings();
  buildMenu();
}

function setFigur(id) {
  if (!CHARACTERS[id] || id === settings.figur) return;
  settings.figur = id;
  saveSettings();
  win.reload();
  buildMenu();
}

function setSecondPet(id) {
  const before = settings.zweiteFigur;
  settings.zweiteFigur = id && CHARACTERS[id] ? id : null;
  saveSettings();
  if (win2 && before && settings.zweiteFigur && before !== settings.zweiteFigur) win2.reload();
  applySecondPet();
  sendSettings();
  buildMenu();
}

// ---------- Downloads: fertige Datei im Download-Ordner → Figur freut sich ----------
function watchDownloads() {
  let dir;
  try { dir = app.getPath('downloads'); } catch { return; }
  const pending = /\.(crdownload|part|partial|tmp|download|opdownload)$/i;
  let timer = null;
  try {
    fs.watch(dir, (_type, name) => {
      if (!name || pending.test(name) || name.startsWith('.')) return;
      const file = path.join(dir, name);
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          const st = fs.statSync(file);
          if (!st.isFile() || st.size === 0 || Date.now() - st.mtimeMs > 15000) return;
          sendAll('command', { type: 'download' });
        } catch { /* Datei schon wieder weg */ }
      }, 1500);
    });
  } catch (err) { log('downloads', err.message); }
}

function setExtra(key, value) {
  settings.extras[key] = value;
  saveSettings();
  sendSettings();
  if (key === 'wetter') refreshWeather();
  buildMenu();
}

function setDnd(minutes) {
  settings.nichtStoerenBis = minutes ? Date.now() + minutes * 60000 : 0;
  saveSettings();
  sendSettings();
  buildMenu();
}

// ---------- Kleines Eingabefeld (eigene Größe, Schlüssel, Geburtstag, Ort) ----------
function askText(opts) {
  return new Promise((resolve) => {
    if (promptWin) promptWin.destroy();
    const a = workArea();
    promptWin = new BrowserWindow({
      width: 340, height: 170,
      x: a.x + a.width - 348, y: a.y + a.height - 178,
      frame: false, transparent: true, resizable: false, skipTaskbar: true, alwaysOnTop: true,
      backgroundColor: '#00000000', show: false,
      webPreferences: { preload: path.join(__dirname, 'preload-prompt.js'), spellcheck: false },
    });
    let answered = false;
    const done = (value) => {
      if (answered) return;
      answered = true;
      ipcMain.removeListener('prompt:answer', onAnswer);
      if (promptWin) { promptWin.destroy(); promptWin = null; }
      resolve(value);
    };
    const onAnswer = (e, value) => { if (promptWin && e.sender === promptWin.webContents) done(value); };
    ipcMain.on('prompt:answer', onAnswer);
    promptWin.on('blur', () => done(null));
    promptWin.loadFile(path.join(__dirname, 'prompt.html'));
    promptWin.webContents.once('did-finish-load', () => {
      promptWin.webContents.send('prompt:ask', opts);
      promptWin.show();
      promptWin.focus();
    });
  });
}

async function askSize() {
  const value = await askText({
    label: 'Eigene Größe in Prozent',
    hint: `Von ${MIN_SIZE * 100} bis ${MAX_SIZE * 100}. Tipp: Strg + Mausrad auf der Figur.`,
    value: String(Math.round(settings.groesse * 100)),
  });
  const pct = parseFloat(String(value || '').replace(',', '.').replace('%', ''));
  if (Number.isFinite(pct)) setSize(pct / 100);
}

async function askToken() {
  const value = await askText({
    label: 'Update-Schlüssel (GitHub)',
    hint: 'Beginnt mit github_pat_. Wird verschlüsselt gespeichert und bleibt auch nach Updates.',
    value: getToken(),
    password: true,
  });
  if (value === null) return;
  setToken(value.trim());
  buildMenu();
  updater.check();
}

async function askBirthday() {
  const value = await askText({
    label: 'Dein Geburtstag',
    hint: 'Tag und Monat, zum Beispiel 17.03. Dann gibt es Partyhut und Konfetti.',
    value: settings.extras.geburtstagDatum,
  });
  if (value === null) return;
  const m = String(value).trim().match(/^(\d{1,2})\.(\d{1,2})\.?$/);
  if (!m || +m[1] < 1 || +m[1] > 31 || +m[2] < 1 || +m[2] > 12) return;
  settings.extras.geburtstag = true;
  setExtra('geburtstagDatum', `${m[1].padStart(2, '0')}.${m[2].padStart(2, '0')}.`);
}

async function askPlace() {
  const value = await askText({
    label: 'Dein Ort für das Wetter',
    hint: 'Stadt oder Ort, zum Beispiel Berlin. Das Wetter kommt von Open-Meteo.',
    value: settings.extras.ort ? settings.extras.ort.name.split(',')[0] : '',
  });
  if (!value || !value.trim()) return;
  try {
    const place = await weatherApi.findPlace(value.trim());
    if (!place) { weatherProblem = `„${value.trim()}“ nicht gefunden`; buildMenu(); return; }
    settings.extras.ort = place;
    settings.extras.wetter = true;
    saveSettings();
    sendSettings();
    refreshWeather();
  } catch (err) {
    weatherProblem = 'Wetter gerade nicht erreichbar';
    log('wetter', err.message);
    buildMenu();
  }
}

// ---------- Erinnerungen: Timer und Wecker ----------
// Bei Ablauf klingelt die Figur (Glocke, hüpft) und Windows zeigt eine Meldung am Taskleisten-Symbol.
const timers = []; // { id, at, label, handle }
let timerSeq = 0;
const clock = (ms) => new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const minutesText = (m) => (m === 1 ? '1 Minute' : `${fmt(m)} Minuten`);

function addTimer(at, label) {
  const id = ++timerSeq;
  // setTimeout kann höchstens ca. 24 Tage; Wecker liegen immer innerhalb von 24 Stunden
  const handle = setTimeout(() => fireTimer(id), Math.max(0, at - Date.now()));
  timers.push({ id, at, label, handle });
  timers.sort((a, b) => a.at - b.at);
  buildMenu();
}
function cancelTimer(id) {
  const i = timers.findIndex((tm) => tm.id === id);
  if (i < 0) return;
  clearTimeout(timers[i].handle);
  timers.splice(i, 1);
  buildMenu();
}
function fireTimer(id) {
  const tm = timers.find((x) => x.id === id);
  if (!tm) return;
  timers.splice(timers.indexOf(tm), 1);
  if (win) win.webContents.send('command', { type: 'alarm' });
  if (win2) win2.webContents.send('command', { type: 'alarm' });
  if (tray && process.platform === 'win32') tray.displayBalloon({ title: 'Claude Buddy', content: tm.label, iconType: 'info' });
  log('erinnerung', tm.label);
  buildMenu();
}
async function askMinutes() {
  const value = await askText({ label: 'Erinnerung in Minuten', hint: 'Zum Beispiel 25 für eine Lern- oder Arbeitsrunde.', value: '25' });
  const m = parseFloat(String(value || '').replace(',', '.'));
  if (Number.isFinite(m) && m > 0 && m <= 24 * 60) addTimer(Date.now() + m * 60000, `${minutesText(Math.round(m * 10) / 10)} sind um`);
}
async function askAlarm() {
  const value = await askText({ label: 'Wecker stellen (Uhrzeit)', hint: 'Zum Beispiel 7:30 oder 14 – klingelt beim nächsten Mal, wenn es so spät ist.', value: '' });
  const match = String(value || '').trim().match(/^(\d{1,2})(?:[:.](\d{2}))?$/);
  if (!match) return;
  const h = Number(match[1]);
  const m = Number(match[2] || 0);
  if (h > 23 || m > 59) return;
  const at = new Date();
  at.setHours(h, m, 0, 0);
  if (at <= new Date()) at.setDate(at.getDate() + 1);
  addTimer(at.getTime(), `Wecker: ${clock(at.getTime())}`);
}
function timerMenu() {
  return [
    ...[5, 10, 15, 30, 60].map((m) => ({ label: `In ${minutesText(m)}`, click: () => addTimer(Date.now() + m * 60000, `${minutesText(m)} sind um`) })),
    { label: 'Eigene Minuten …', click: askMinutes },
    { label: 'Wecker stellen …', click: askAlarm },
    ...(timers.length ? [
      { type: 'separator' },
      ...timers.map((tm) => ({ label: `${tm.label.replace(' sind um', '')} – klingelt um ${clock(tm.at)} (abbrechen)`, click: () => cancelTimer(tm.id) })),
    ] : []),
    { type: 'separator' },
    { label: 'Klingeln kurz zeigen', click: () => win && win.webContents.send('command', { type: 'alarm' }) },
  ];
}

// ---------- Menü am Taskleisten-Symbol (Links- und Rechtsklick, auch Rechtsklick auf die Figur) ----------
let updateStatus = { text: 'Noch nicht geprüft', ready: false, token: null };

function tokenWarning() {
  const t = updateStatus.token || {};
  if (t.problem === 'expired') return 'Update-Schlüssel abgelaufen – neu eingeben …';
  if (t.problem === 'noaccess') return 'Update-Schlüssel ohne Zugriff – neu eingeben …';
  if (t.problem === 'soon' && t.expiresAt) {
    return `Update-Schlüssel läuft am ${new Date(t.expiresAt).toLocaleDateString('de-DE')} ab – erneuern …`;
  }
  return null;
}

function extrasMenu() {
  const e = settings.extras;
  const check = (label, key) => ({ label, type: 'checkbox', checked: Boolean(e[key]), click: (item) => setExtra(key, item.checked) });
  let weatherLine = e.ort ? e.ort.name : 'Kein Ort eingetragen';
  if (weather && e.wetter && e.ort) weatherLine = `${e.ort.name.split(',')[0]}: ${Math.round(weather.temp)} °C, ${weatherApi.describe(weather.code)}`;
  if (weatherProblem) weatherLine = weatherProblem;
  return [
    check('Weihnachtsmütze im Dezember', 'weihnachten'),
    check('Partyhut an Silvester und Neujahr', 'silvester'),
    check('Hasenohren und Osterei an Ostern', 'ostern'),
    check('Kürbis und Fledermäuse an Halloween', 'halloween'),
    check('Geburtstag: Partyhut und Konfetti', 'geburtstag'),
    { label: e.geburtstagDatum ? `Geburtstag ändern … (${e.geburtstagDatum})` : 'Geburtstag eintragen …', click: askBirthday },
    { type: 'separator' },
    check('Wetter (Schirm, Sonnenbrille, Regen, Schnee)', 'wetter'),
    { label: weatherLine, enabled: false },
    { label: e.ort ? 'Ort ändern …' : 'Ort eintragen …', click: askPlace },
    check('Wetter-Schild neben der Figur', 'temperatur'),
    { type: 'separator' },
    { label: 'Extras kurz zeigen', click: () => sendAll('command', 'preview-extras') },
  ];
}

function buildMenu() {
  if (!tray) return;
  const pct = (v) => `${Math.round(v * 100)} %`;
  const isPreset = SIZE_PRESETS.some((v) => Math.abs(v - settings.groesse) < 0.001);
  const toggle = (label, key) => ({
    label, type: 'checkbox', checked: Boolean(settings[key]),
    click: (item) => { settings[key] = item.checked; saveSettings(); sendSettings(); buildMenu(); },
  });
  const dnd = settings.nichtStoerenBis > Date.now();
  const warning = tokenWarning();

  const name = CHARACTERS[settings.figur] ? CHARACTERS[settings.figur].name : 'Claude Buddy';
  const until = (ms) => new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  // Aufgeräumt: oben das, was man oft braucht, darunter Aussehen / Verhalten / System in Untermenüs
  tray.setContextMenu(Menu.buildFromTemplate([
    ...(warning ? [{ label: `⚠ ${warning}`, click: askToken }, { type: 'separator' }] : []),
    { label: settings.launeAn ? `${name} · ${moodWord(settings.laune)} (${Math.round(settings.laune)} %)` : name, enabled: false },
    { type: 'separator' },
    { label: 'Füttern', click: () => sendAll('command', { type: 'feed' }) },
    { label: ballOn ? 'Ball wegräumen' : 'Ball zum Spielen', click: () => win && win.webContents.send('command', { type: 'ball' }) },
    {
      label: timers.length ? `Erinnerung (nächste um ${clock(timers[0].at)})` : 'Erinnerung / Wecker',
      submenu: timerMenu(),
    },
    {
      label: dnd ? `Nicht stören bis ${until(settings.nichtStoerenBis)} – aufheben` : 'Nicht stören (1 Stunde)',
      click: () => setDnd(dnd ? 0 : 60),
    },
    { type: 'separator' },
    ...counterMenu(),
    { label: 'Spielzeit', submenu: playMenu() },
    { type: 'separator' },
    {
      label: 'Aussehen',
      submenu: [
        {
          label: `Figur: ${name}`,
          submenu: ORDER.map((id) => ({
            label: CHARACTERS[id].name, type: 'radio', checked: settings.figur === id, click: () => setFigur(id),
          })),
        },
        {
          label: settings.zweiteFigur ? `Zweite Figur: ${CHARACTERS[settings.zweiteFigur].name}` : 'Zweite Figur: aus',
          submenu: [
            { label: 'Aus', type: 'radio', checked: !settings.zweiteFigur, click: () => setSecondPet(null) },
            { type: 'separator' },
            ...ORDER.map((id) => ({ label: CHARACTERS[id].name, type: 'radio', checked: settings.zweiteFigur === id, click: () => setSecondPet(id) })),
          ],
        },
        { label: `Farbe: ${COLORS.find(([k]) => k === settings.farbe)?.[1] || 'Original'}`, submenu: colorMenu(false) },
        ...(settings.zweiteFigur ? [{ label: `Farbe der zweiten Figur: ${COLORS.find(([k]) => k === settings.farbe2)?.[1] || 'Original'}`, submenu: colorMenu(true) }] : []),
        {
          label: `Größe: ${pct(settings.groesse)}`,
          submenu: [
            ...SIZE_PRESETS.map((v) => ({
              label: pct(v), type: 'radio', checked: Math.abs(v - settings.groesse) < 0.001, click: () => setSize(v),
            })),
            { type: 'separator' },
            { label: isPreset ? 'Eigene Größe …' : `Eigene Größe … (${pct(settings.groesse)})`, click: askSize },
            { label: 'Tipp: Strg + Mausrad auf der Figur', enabled: false },
          ],
        },
        { label: 'Feiertage und Wetter', submenu: extrasMenu() },
      ],
    },
    {
      label: 'Verhalten',
      submenu: [
        toggle('Läuft herum', 'laufen'),
        toggle('Schwerkraft (fällt nach unten)', 'schwerkraft'),
        { type: 'separator' },
        toggle('Auf Fenster setzen (an den Rand ziehen)', 'aufFenstern'),
        toggle('Springt auf das aktive Fenster', 'fensterSpringen'),
        { type: 'separator' },
        toggle('Tippt mit, wenn ich tippe', 'tastatur'),
        toggle(settings.energiesparen === 3 ? 'Mund bewegt sich mit Mikrofon (im Modus Hart aus)' : 'Mund bewegt sich mit Mikrofon', 'mikrofon'),
        { type: 'separator' },
        toggle('Pausen-Erinnerung (nach 60 Min. Tippen)', 'pausen'),
        toggle('Laune (Füttern, Streicheln, Spielen)', 'launeAn'),
      ],
    },
    {
      label: 'System',
      submenu: [
        {
          label: `Energiesparmodus: ${energy().name}`,
          submenu: ENERGY.map((level, i) => ({
            label: `${level.name} – ${level.info}`, type: 'radio', checked: settings.energiesparen === i,
            click: () => { settings.energiesparen = i; saveSettings(); sendSettings(); applyEnergyMode(); buildMenu(); },
          })),
        },
        toggle('Im Vollbild anzeigen (Spiele, Videos)', 'imVollbild'), // greift bei der nächsten Abfrage
        {
          label: 'Mit Windows starten', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
          click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
        },
        { type: 'separator' },
        { label: 'Figur zurückholen (Doppelklick aufs Symbol)', click: resetPet },
        { label: 'Fehler-Log öffnen', click: () => { log('log geöffnet'); shell.openPath(logPath()); } },
      ],
    },
    {
      label: updateStatus.ready ? 'Updates – neue Version bereit' : 'Updates',
      submenu: [
        { label: updateStatus.text, enabled: false },
        { label: 'Neu starten und installieren', visible: updateStatus.ready, click: () => updater.installNow() },
        { label: 'Jetzt nach Updates suchen', click: () => updater.check() },
        { label: getToken() ? 'Update-Schlüssel ändern …' : 'Update-Schlüssel eingeben …', click: askToken },
      ],
    },
    { type: 'separator' },
    { label: `Beenden (Version ${app.getVersion()})`, click: () => app.quit() },
  ]));
}

function resetPet() {
  for (const w of pets()) { w.showInactive(); w.webContents.send('command', 'reset'); }
}

function openMenu() {
  if (!tray) return;
  buildMenu(); // frische Zahlen im Tippzähler
  tray.popUpContextMenu(undefined, screen.getCursorScreenPoint());
}

function buildTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'icon.png')).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('Claude Buddy');
  // Linksklick: Menü (kurz warten, ob es ein Doppelklick wird). Doppelklick: Figur zurückholen.
  let clickTimer = null;
  tray.on('click', () => {
    clearTimeout(clickTimer);
    clickTimer = setTimeout(openMenu, 250);
  });
  tray.on('double-click', () => {
    clearTimeout(clickTimer);
    resetPet();
  });
  buildMenu();
}

// ---------- Start ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', openMenu);
  app.whenReady().then(() => {
    loadSettings();
    trimLog();
    markOldBadges();
    decayMood();
    setInterval(decayMood, 10 * 60 * 1000);
    moveOldAutostart();
    // Mikrofon nur für die eigene Figur freigeben (nur messen, nie speichern)
    session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'media'));
    session.defaultSession.setPermissionCheckHandler((_wc, perm) => perm === 'media');
    createWindow();
    applySecondPet();
    watchDisplays();
    watchDownloads();
    watchDesktop();
    buildTray();
    startWatchers();
    win.webContents.once('did-finish-load', applyEnergyMode);
    refreshWeather();
    powerMonitor.on('on-battery', sendPower);
    powerMonitor.on('on-ac', sendPower);
    updater = setupUpdater({
      getToken,
      log,
      onStatus: (st) => { updateStatus = st; buildMenu(); },
    });
    log('start', `version ${app.getVersion()}`, `electron ${process.versions.electron}`, process.platform, require('os').release());

    // Selbsttest: DUCK_SELFTEST=<datei.png> speichert nach 3 s ein Bild des Fensters und beendet
    if (process.env.DUCK_SELFTEST) {
      setTimeout(async () => {
        const img = await win.webContents.capturePage();
        fs.writeFileSync(process.env.DUCK_SELFTEST, img.toPNG());
        if (win2) {
          fs.writeFileSync(process.env.DUCK_SELFTEST.replace(/\.png$/, '-2.png'), (await win2.webContents.capturePage()).toPNG());
          log('selbsttest zweite Figur', JSON.stringify(win2.getBounds()));
        }
        const mb = app.getAppMetrics().reduce((sum, m) => sum + m.memory.workingSetSize, 0) / 1024;
        log('selbsttest', JSON.stringify(win.getBounds()), `speicher ${mb.toFixed(0)} MB`, `prozesse ${app.getAppMetrics().length}`);
        app.quit();
      }, 3000);
    }
  });

  ipcMain.handle('get-settings', () => petSettings());
  ipcMain.on('get-area', (e) => { e.returnValue = workArea(); });
  ipcMain.on('get-config', (e) => {
    const second = isSecond(e.sender);
    e.returnValue = settings
      ? {
        figur: second ? settings.zweiteFigur : settings.figur,
        homeX: second ? settings.home2X : settings.homeX,
        homeBottom: second ? null : settings.homeBottom,
        farbe: second ? settings.farbe2 : settings.farbe,
        schwerkraft: settings.schwerkraft,
        size: settings.groesse, energiesparen: settings.energiesparen, extras: petSettings().extras,
        second,
      }
      : {};
  });
  // zwei Figuren: Position und Zustand an die jeweils andere weitergeben
  ipcMain.on('pet-state', (e, state) => {
    const other = isSecond(e.sender) ? win : win2;
    if (other && !other.isDestroyed()) other.webContents.send('friend', state);
  });
  ipcMain.on('stat', (_e, key) => countStat(String(key)));
  ipcMain.on('ball-state', (_e, on) => { ballOn = Boolean(on); buildMenu(); });
  ipcMain.on('mood', (_e, delta) => { if (typeof delta === 'number' && Number.isFinite(delta)) changeMood(Math.max(-20, Math.min(20, delta))); });
  // Ballspiel: Fenster wird zum breiten Streifen, danach wieder klein
  ipcMain.on('wide', (e, on) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (!w) return;
    if (on) wideWindows.add(w); else wideWindows.delete(w);
    const a = workArea();
    const size = windowSize(w);
    const b = w.getBounds();
    w.setBounds(on ? { x: a.x, y: a.y + a.height - size.height, ...size } : { x: b.x + Math.round((b.width - size.width) / 2), y: b.y + b.height - size.height, ...size });
  });
  // „Auf Fenster setzen“: Kante suchen, dann regelmäßig nachsehen, wo das Fenster ist
  // box: Figur im Arbeitsbereich (DIP) → Fensterrand in der Nähe (physische Pixel)
  const findEdge = (box) => {
    const win32 = loadWin32();
    if (!win32 || !box) return { seen: ['Windows-Funktionen nicht geladen'] };
    const a = workArea();
    const dip = { x: Math.round(box.x + a.x), y: Math.round(box.y + a.y), width: Math.round(box.width), height: Math.round(box.height) };
    const p = screen.dipToScreenRect(null, dip);
    const k = screen.getDisplayNearestPoint({ x: dip.x, y: dip.y }).scaleFactor;
    try {
      return { ...win32.edgeNear(p, k), at: p };
    } catch (err) {
      return { seen: [`Fehler: ${err.message}`], at: p };
    }
  };
  // beim Ziehen: nur nachsehen, ob gerade ein Rand unter der Figur ist (sie hört dann auf zu zappeln)
  ipcMain.handle('perch-probe', (_e, box) => {
    if (!settings.aufFenstern) return null;
    const hit = findEdge(box);
    return hit.hwnd ? hit.side : null;
  });
  // Wichtig: Bei sendSync zählt nur die erste Zuweisung an e.returnValue (sie geht sofort raus).
  // Darum wird das Ergebnis erst fertig berechnet und dann genau einmal zurückgegeben.
  const answer = (e, what, fn) => {
    let value = null;
    try { value = fn(); } catch (err) { log('fenster fehler', what, err.message); }
    e.returnValue = value === undefined ? null : value;
  };
  ipcMain.on('perch-find', (e, box) => answer(e, 'setzen', () => {
    if (!settings.aufFenstern) return null;
    const hit = findEdge(box);
    if (!hit.hwnd) {
      const at = hit.at ? `${hit.at.x},${hit.at.y} ${hit.at.width}x${hit.at.height}` : '?';
      log('fenster', `kein Rahmen bei ${at}`, hit.seen.join(' | ') || 'keine passenden Fenster gefunden');
      return null;
    }
    log('fenster', `${hit.side}:`, hit.seen[hit.seen.length - 1] || '');
    perch = { hwnd: hit.hwnd, address: loadWin32().address(hit.hwnd), key: '' };
    const result = { side: hit.side, rect: perchRect(hit.rect) };
    startPerchWatch();
    return result;
  }));
  ipcMain.on('renderer-log', (_e, text) => log('figur', String(text).slice(0, 300)));
  ipcMain.on('perch-release', () => { perch = null; });
  // „Springt auf das aktive Fenster“: Oberkante des Vordergrund-Fensters, wenn sie frei sichtbar ist
  ipcMain.on('perch-foreground', (e) => answer(e, 'springen', () => {
    const win32 = loadWin32();
    if (!win32 || !settings.fensterSpringen) return null;
    const fg = win32.foreground();
    if (!fg || fg.maximized || /Claude Buddy/.test(fg.title) || IGNORED_WINDOW_CLASSES.has(fg.cls)) return null;
    const a = workArea();
    const pa = screen.dipToScreenPoint({ x: a.x, y: a.y });
    // Mitte der Oberkante muss frei sein (nicht von einem anderen Fenster verdeckt)
    const hit = win32.windowEdgeAt(Math.round(fg.x + fg.width / 2), fg.y + 4, 8, 8);
    if (!hit.hwnd || win32.address(hit.hwnd) !== fg.hwnd) return null;
    if (hit.rect.top < pa.y + 20) return null; // Kante zu weit oben: kein Platz zum Sitzen
    perch = { hwnd: hit.hwnd, address: win32.address(hit.hwnd), key: '' };
    const result = perchRect(hit.rect);
    startPerchWatch();
    log('fenster', 'springt auf', fg.cls, `"${fg.title.slice(0, 30)}"`);
    return result;
  }));

  ipcMain.on('set-home', (e, x, bottom) => {
    if (typeof x !== 'number' || !Number.isFinite(x)) return;
    if (isSecond(e.sender)) { settings.home2X = x; saveSettings(); return; }
    settings.homeX = x;
    settings.homeBottom = typeof bottom === 'number' && Number.isFinite(bottom) ? bottom : null;
    saveSettings();
  });
  // Strg + Mausrad: Größe kommt von der Figur, kurz sammeln und dann speichern
  let sizeTimer = null;
  ipcMain.on('save-size', (_e, size) => {
    if (typeof size !== 'number' || !Number.isFinite(size)) return;
    settings.groesse = Math.round(Math.min(MAX_SIZE, Math.max(MIN_SIZE, size)) * 100) / 100;
    fitPetWindow();
    clearTimeout(sizeTimer);
    sizeTimer = setTimeout(() => { saveSettings(); buildMenu(); }, 400);
  });
  ipcMain.on('open-menu', openMenu);
  ipcMain.on('move-window', (e, x, y) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (!w) return;
    const a = workArea();
    w.setBounds({ x: Math.round(a.x + x), y: Math.round(a.y + y), ...windowSize(w) });
  });
  ipcMain.on('ignore-mouse', (e, ignore) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (w) w.setIgnoreMouseEvents(ignore, { forward: true });
  });

  process.on('uncaughtException', (err) => log('main fehler', err.stack || err.message));
  app.on('before-quit', () => {
    if (stopWatcher) stopWatcher();
    if (settings) saveSettings(); // Tippzähler sichern
  });
  app.on('window-all-closed', () => app.quit());
}
