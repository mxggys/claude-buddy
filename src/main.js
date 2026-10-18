const {
  app, BrowserWindow, Tray, Menu, ipcMain, screen, shell, nativeImage, session, safeStorage, powerMonitor,
} = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startWatching } = require('./watcher');
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
  mikrofon: false,
  tastatur: true,
  energiesparen: 0, // 0 aus, 1 leicht, 2 mittel, 3 hart
  nichtStoerenBis: 0,
  extras: {
    weihnachten: true, // Mütze im Dezember
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

let win = null;
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

function createWindow() {
  const area = workArea();
  const size = petSize();
  win = new BrowserWindow({
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
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.on('console-message', (e) => {
    if (e.level === 'warning' || e.level === 'error') {
      log('renderer', e.message, `${path.basename(e.sourceId || '')}:${e.lineNumber}`);
    }
  });
  win.webContents.on('render-process-gone', (_e, details) => log('renderer weg', details.reason));
  win.webContents.on('did-finish-load', () => {
    log('geladen', JSON.stringify(workArea()));
    sendPower();
    if (weather) win.webContents.send('weather', weather);
    win.webContents.send('claude', claudeActive);
  });

  // Bildschirm geändert (Auflösung, Skalierung): Figur neu starten lassen
  screen.on('display-metrics-changed', () => win.reload());
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
  win.webContents.send('command', 'trim');
  applyEnergyMode(); // neu gestartete Hilfsprozesse auch herunterstufen
}, 5 * 60 * 1000);

// Im Akkubetrieb zeichnet die Figur seltener
function sendPower() {
  if (win) win.webContents.send('power', powerMonitor.isOnBatteryPower());
}

// Fenstergröße an die Figurengröße anpassen, unten bündig
function fitPetWindow() {
  const b = win.getBounds();
  const size = petSize();
  if (b.width === size.width && b.height === size.height) return;
  win.setBounds({ x: b.x, y: b.y + b.height - size.height, ...size });
}

let hiddenForFullscreen = false;
function updateFullscreen(fullscreen) {
  const hide = fullscreen && !settings.imVollbild;
  if (hide === hiddenForFullscreen) return;
  hiddenForFullscreen = hide;
  if (hide) win.hide();
  else win.showInactive();
}

// Mini-Claude merkt, wenn ein Claude-Fenster vorne ist (Desktop-App oder claude.ai im Browser)
let claudeActive = false;
function updateClaude(title) {
  const active = /\bClaude\b/.test(title || '') && !/Claude Buddy|Desktop Ente/.test(title);
  if (active === claudeActive) return;
  claudeActive = active;
  if (win) win.webContents.send('claude', active);
}

// ---------- Tippzähler ----------
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmt = (n) => n.toLocaleString('de-DE');
const shortDay = (key, opts = { weekday: 'short', day: 'numeric', month: 'numeric' }) => new Date(key + 'T12:00').toLocaleDateString('de-DE', opts);
let counterDirty = false;

function countKey() {
  const z = settings.zaehler;
  const tag = dayKey();
  if (z.tag !== tag) { z.tag = tag; z.heute = 0; } // neuer Tag
  z.heute++;
  z.gesamt++;
  z.tage[tag] = z.heute;
  if (z.heute > z.rekord) { z.rekord = z.heute; z.rekordTag = tag; }
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
    if (win) win.webContents.send('weather', weather);
  } catch (err) {
    weatherProblem = 'Wetter gerade nicht erreichbar';
    log('wetter', err.message);
  }
  buildMenu();
  weatherTimer = setTimeout(refreshWeather, WEATHER_EVERY);
}

// ---------- Beobachten ----------
function startWatchers() {
  // Zähler: Menü alle 3 s auffrischen, alle 30 s speichern (nicht bei jedem Tastendruck)
  setInterval(() => { if (counterDirty) buildMenu(); }, 3000);
  setInterval(() => { if (counterDirty) { counterDirty = false; saveSettings(); } }, 30000);

  stopWatcher = startWatching({
    getInterval: () => energy().watchMs,
    onKey: () => {
      countKey();
      if (settings.tastatur && win) win.webContents.send('key');
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
  const pollCursor = () => {
    if (win && !hiddenForFullscreen) {
      const p = screen.getCursorScreenPoint();
      // Zeiger über der Figur: Fenster wieder ganz nach vorne holen. Die Taskleiste (auch mit
      // TranslucentTB) schiebt sich sonst nach einem Klick über die Figur, und die lässt sich
      // erst wieder anfassen, wenn die Taskleiste den Fokus verliert.
      const b = win.getBounds();
      const over = p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + b.height;
      if (over && Date.now() - lastRaise > 400) {
        lastRaise = Date.now();
        win.setAlwaysOnTop(true, 'screen-saver');
        win.moveTop();
      }
      const a = workArea();
      const pos = { x: p.x - a.x, y: p.y - a.y };
      const key = pos.x + ',' + pos.y;
      if (key !== lastPos) win.webContents.send('cursor', pos);
      lastPos = key;
    }
    setTimeout(pollCursor, energy().cursorMs);
  };
  pollCursor();
}

// Die Figur bekommt nur, was sie braucht (der Update-Schlüssel bleibt im Hauptprozess)
const petSettings = () => ({
  schwerkraft: settings.schwerkraft,
  mikrofon: settings.mikrofon,
  groesse: settings.groesse,
  energiesparen: settings.energiesparen,
  nichtStoerenBis: settings.nichtStoerenBis,
  extras: { ...settings.extras, ort: undefined },
});

function sendSettings() {
  if (win) win.webContents.send('settings', petSettings());
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
    check('Geburtstag: Partyhut und Konfetti', 'geburtstag'),
    { label: e.geburtstagDatum ? `Geburtstag ändern … (${e.geburtstagDatum})` : 'Geburtstag eintragen …', click: askBirthday },
    { type: 'separator' },
    check('Wetter (Schirm, Sonnenbrille, Regen, Schnee)', 'wetter'),
    { label: weatherLine, enabled: false },
    { label: e.ort ? 'Ort ändern …' : 'Ort eintragen …', click: askPlace },
    check('Wetter-Schild neben der Figur', 'temperatur'),
    { type: 'separator' },
    { label: 'Extras kurz zeigen', click: () => win.webContents.send('command', 'preview-extras') },
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

  tray.setContextMenu(Menu.buildFromTemplate([
    ...(warning ? [{ label: `⚠ ${warning}`, click: askToken }, { type: 'separator' }] : []),
    ...counterMenu(),
    { type: 'separator' },
    {
      label: 'Figur',
      submenu: ORDER.map((id) => ({
        label: CHARACTERS[id].name, type: 'radio', checked: settings.figur === id, click: () => setFigur(id),
      })),
    },
    {
      label: `Größe (${pct(settings.groesse)})`,
      submenu: [
        ...SIZE_PRESETS.map((v) => ({
          label: pct(v), type: 'radio', checked: Math.abs(v - settings.groesse) < 0.001, click: () => setSize(v),
        })),
        { type: 'separator' },
        { label: isPreset ? 'Eigene Größe …' : `Eigene Größe … (${pct(settings.groesse)})`, click: askSize },
        { label: 'Tipp: Strg + Mausrad auf der Figur', enabled: false },
      ],
    },
    { label: 'Extras', submenu: extrasMenu() },
    { label: 'Zurückholen (Doppelklick aufs Symbol)', click: resetPet },
    {
      label: dnd
        ? `Nicht stören bis ${new Date(settings.nichtStoerenBis).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} – aufheben`
        : 'Nicht stören (1 Stunde)',
      click: () => setDnd(dnd ? 0 : 60),
    },
    { type: 'separator' },
    toggle('Schwerkraft (fällt nach unten)', 'schwerkraft'),
    toggle('Tippt mit, wenn ich tippe', 'tastatur'),
    toggle(settings.energiesparen === 3 ? 'Mund bewegt sich mit Mikrofon (im Modus Hart aus)' : 'Mund bewegt sich mit Mikrofon', 'mikrofon'),
    toggle('Im Vollbild anzeigen (Spiele, Videos)', 'imVollbild'), // greift bei der nächsten Abfrage
    {
      label: `Energiesparmodus (${energy().name})`,
      submenu: ENERGY.map((level, i) => ({
        label: `${level.name} – ${level.info}`, type: 'radio', checked: settings.energiesparen === i,
        click: () => { settings.energiesparen = i; saveSettings(); sendSettings(); applyEnergyMode(); buildMenu(); },
      })),
    },
    {
      label: 'Mit Windows starten', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { type: 'separator' },
    {
      label: updateStatus.ready ? 'Updates – neue Version bereit' : 'Updates',
      submenu: [
        { label: updateStatus.text, enabled: false },
        { label: 'Neu starten und installieren', visible: updateStatus.ready, click: () => updater.installNow() },
        { label: 'Jetzt nach Updates suchen', click: () => updater.check() },
        { label: getToken() ? 'Update-Schlüssel ändern …' : 'Update-Schlüssel eingeben …', click: askToken },
      ],
    },
    { label: 'Fehler-Log öffnen', click: () => { log('log geöffnet'); shell.openPath(logPath()); } },
    { label: `Beenden (Version ${app.getVersion()})`, click: () => app.quit() },
  ]));
}

function resetPet() {
  win.showInactive();
  win.webContents.send('command', 'reset');
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
    moveOldAutostart();
    // Mikrofon nur für die eigene Figur freigeben (nur messen, nie speichern)
    session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'media'));
    session.defaultSession.setPermissionCheckHandler((_wc, perm) => perm === 'media');
    createWindow();
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
        const mb = app.getAppMetrics().reduce((sum, m) => sum + m.memory.workingSetSize, 0) / 1024;
        log('selbsttest', JSON.stringify(win.getBounds()), `speicher ${mb.toFixed(0)} MB`, `prozesse ${app.getAppMetrics().length}`);
        app.quit();
      }, 3000);
    }
  });

  ipcMain.handle('get-settings', () => petSettings());
  ipcMain.on('get-area', (e) => { e.returnValue = workArea(); });
  ipcMain.on('get-config', (e) => {
    e.returnValue = settings
      ? {
        figur: settings.figur, homeX: settings.homeX, homeBottom: settings.homeBottom, schwerkraft: settings.schwerkraft,
        size: settings.groesse, energiesparen: settings.energiesparen, extras: petSettings().extras,
      }
      : {};
  });
  ipcMain.on('set-home', (_e, x, bottom) => {
    if (typeof x !== 'number' || !Number.isFinite(x)) return;
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
  ipcMain.on('move-window', (_e, x, y) => {
    if (!win) return;
    const a = workArea();
    win.setBounds({ x: Math.round(a.x + x), y: Math.round(a.y + y), ...petSize() });
  });
  ipcMain.on('ignore-mouse', (_e, ignore) => {
    if (win) win.setIgnoreMouseEvents(ignore, { forward: true });
  });

  process.on('uncaughtException', (err) => log('main fehler', err.stack || err.message));
  app.on('before-quit', () => {
    if (stopWatcher) stopWatcher();
    if (settings) saveSettings(); // Tippzähler sichern
  });
  app.on('window-all-closed', () => app.quit());
}
