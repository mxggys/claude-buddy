// Beobachtet, was am PC passiert – ohne PowerShell-Skripte (die schlagen bei Virenscannern an):
// - ob gerade ein Spiel / Video im Vollbild läuft (shell32.dll)
// - Titel des Fensters im Vordergrund, damit Mini-Claude merkt, wenn Claude offen ist (user32.dll)
// - Tastendrücke über uiohook (nur DASS getippt wird, nicht welche Taste)
// - Lage des Fensters im Vordergrund, damit die Figur auf verschobene Fenster reagiert (user32.dll)
// - Fensterkanten, auf die man die Figur setzen kann („Auf Fenster setzen“, user32 + dwmapi)

let cached;
function loadWin32() {
  if (cached !== undefined) return cached; // koffi-Typen dürfen nur einmal angelegt werden
  cached = createWin32();
  return cached;
}

function createWin32() {
  if (process.platform !== 'win32') return null;
  try {
    const koffi = require('koffi');
    const shell32 = koffi.load('shell32.dll');
    const user32 = koffi.load('user32.dll');
    const SHQueryUserNotificationState = shell32.func('int __stdcall SHQueryUserNotificationState(_Out_ int* state)');
    const GetForegroundWindow = user32.func('void* __stdcall GetForegroundWindow()');
    const GetWindowTextW = user32.func('int __stdcall GetWindowTextW(void* hWnd, _Out_ uint16_t* text, int max)');
    koffi.struct('RECT', { left: 'long', top: 'long', right: 'long', bottom: 'long' });
    const GetWindowRect = user32.func('int __stdcall GetWindowRect(void* hWnd, _Out_ RECT* rect)');
    const GetClassNameW = user32.func('int __stdcall GetClassNameW(void* hWnd, _Out_ uint16_t* text, int max)');
    const IsZoomed = user32.func('int __stdcall IsZoomed(void* hWnd)');
    const IsWindow = user32.func('int __stdcall IsWindow(void* hWnd)');
    const IsWindowVisible = user32.func('int __stdcall IsWindowVisible(void* hWnd)');
    const IsIconic = user32.func('int __stdcall IsIconic(void* hWnd)');
    const GetWindowLongPtrW = user32.func('intptr __stdcall GetWindowLongPtrW(void* hWnd, int index)');
    const GW_OWNER = 4;
    const GetWindow = user32.func('void* __stdcall GetWindow(void* hWnd, uint32 cmd)');
    // Erweiterte Fensterstile: Werkzeug-/Overlay-Fenster, durch die man hindurchklickt
    const WS_EX_TRANSPARENT = 0x20;
    const WS_EX_TOOLWINDOW = 0x80;
    const WS_EX_NOACTIVATE = 0x8000000;
    const WS_EX_TOPMOST = 0x8;
    const GetSystemMetrics = user32.func('int __stdcall GetSystemMetrics(int index)');
    // Overlays (Grafiktreiber, Game Bar, Aufnahme-Tools) liegen unsichtbar über dem ganzen Bildschirm
    const coversScreen = (r) => r.right - r.left >= GetSystemMetrics(0) && r.bottom - r.top >= GetSystemMetrics(1);
    const GetWindowThreadProcessId = user32.func('uint32 __stdcall GetWindowThreadProcessId(void* hWnd, _Out_ uint32* pid)');
    const EnumWindowsProc = koffi.proto('int __stdcall EnumWindowsProc(void* hWnd, intptr lParam)');
    const EnumWindows = user32.func('int __stdcall EnumWindows(EnumWindowsProc* cb, intptr lParam)');
    let DwmGetWindowAttribute = null;
    try {
      const dwmapi = koffi.load('dwmapi.dll');
      DwmGetWindowAttribute = dwmapi.func('long __stdcall DwmGetWindowAttribute(void* hWnd, uint32 attr, void* value, uint32 size)');
    } catch { /* ohne DWM: GetWindowRect reicht */ }
    // Sichtbarer Rahmen ohne den unsichtbaren Rand zum Größeziehen (Windows 10/11)
    const visibleRect = (hwnd) => {
      if (DwmGetWindowAttribute) {
        const buf = Buffer.alloc(16);
        if (DwmGetWindowAttribute(hwnd, 9, buf, 16) === 0) {
          return { left: buf.readInt32LE(0), top: buf.readInt32LE(4), right: buf.readInt32LE(8), bottom: buf.readInt32LE(12) };
        }
      }
      const r = {};
      return GetWindowRect(hwnd, r) ? r : null;
    };
    // versteckte Store-Apps zählen nicht als sichtbar
    const cloaked = (hwnd) => {
      if (!DwmGetWindowAttribute) return false;
      const buf = Buffer.alloc(4);
      return DwmGetWindowAttribute(hwnd, 14, buf, 4) === 0 && buf.readInt32LE(0) !== 0;
    };
    const SKIP_CLASSES = new Set(['Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd', 'Windows.UI.Core.CoreWindow', 'XamlExplorerHostIslandWindow']);
    const text = (fn, hwnd) => {
      const buf = new Uint16Array(256);
      const len = fn(hwnd, buf, buf.length);
      return Buffer.from(buf.buffer, 0, len * 2).toString('utf16le');
    };
    return {
      // 2 = Vollbild-App, 3 = Direct3D-Vollbild (Spiele), 4 = Präsentationsmodus
      fullscreen() {
        const state = [0];
        if (SHQueryUserNotificationState(state) !== 0) return false;
        return state[0] === 2 || state[0] === 3 || state[0] === 4;
      },
      title() {
        const hwnd = GetForegroundWindow();
        return hwnd ? text(GetWindowTextW, hwnd) : '';
      },
      // Fenster, auf dessen Oberkante (x, y) liegt (physische Pixel). Geht die Fenster von vorne
      // nach hinten durch; liegt der Punkt vorher mitten in einem anderen Fenster, ist die Kante verdeckt.
      // above/below: wie weit über bzw. unter der Oberkante losgelassen werden darf (Titelleiste, Tabs).
      // Zählt nur „echte“ App-Fenster: sichtbar, mit Titel, kein Overlay/Werkzeugfenster.
      // Gibt zusätzlich die ersten geprüften Fenster zurück (für das Fehler-Log).
      windowEdgeAt(x, y, above = 40, below = 40) {
        let found = null;
        const seen = [];
        EnumWindows((hwnd) => {
          if (!IsWindowVisible(hwnd) || IsIconic(hwnd) || cloaked(hwnd)) return 1;
          const pid = [0];
          GetWindowThreadProcessId(hwnd, pid);
          const cls = text(GetClassNameW, hwnd);
          if (pid[0] === process.pid || SKIP_CLASSES.has(cls)) return 1;
          const ex = Number(GetWindowLongPtrW(hwnd, -20));
          if (ex & (WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE)) return 1;
          const title = text(GetWindowTextW, hwnd);
          if (!title || GetWindow(hwnd, GW_OWNER)) return 1; // Overlays und Popups haben meist keinen Titel
          const r = visibleRect(hwnd);
          if (!r || r.right - r.left < 120 || r.bottom - r.top < 60) return 1;
          if (seen.length < 6) seen.push(`${cls} "${title.slice(0, 30)}" ${r.left},${r.top} ${r.right - r.left}x${r.bottom - r.top}`);
          if (x < r.left || x > r.right) return 1;
          if (y >= r.top - above && y <= r.top + below) { found = { hwnd, rect: r }; return 0; }
          if (y > r.top && y < r.bottom) return 0; // verdeckt von diesem Fenster
          return 1;
        }, 0);
        if (found) found.seen = seen;
        return found || { seen };
      },
      // Rahmen eines Fensters, an dem die Figur (box, physische Pixel) losgelassen wurde:
      // Oberkante (auch auf den Ecken), linke/rechte Kante oder Unterkante. Fenster werden von vorne
      // nach hinten geprüft; liegt die Figur mitten in einem Fenster, gibt es keine Kante.
      edgeNear(box, k = 1) {
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        const foot = box.y + box.height;
        const side = 40 * k;
        let found = null;
        const seen = [];
        EnumWindows((hwnd) => {
          if (!IsWindowVisible(hwnd) || IsIconic(hwnd) || cloaked(hwnd)) return 1;
          const pid = [0];
          GetWindowThreadProcessId(hwnd, pid);
          const cls = text(GetClassNameW, hwnd);
          if (pid[0] === process.pid || SKIP_CLASSES.has(cls)) return 1;
          const ex = Number(GetWindowLongPtrW(hwnd, -20));
          if (ex & (WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_TOPMOST)) return 1;
          const title = text(GetWindowTextW, hwnd);
          if (!title || GetWindow(hwnd, GW_OWNER)) return 1;
          const r = visibleRect(hwnd);
          if (!r || r.right - r.left < 120 || r.bottom - r.top < 60) return 1;
          if (coversScreen(r) && !IsZoomed(hwnd)) return 1;
          if (seen.length < 6) seen.push(`${cls} "${title.slice(0, 30)}" ${r.left},${r.top} ${r.right - r.left}x${r.bottom - r.top}`);
          const overX = cx >= r.left - box.width * 0.4 && cx <= r.right + box.width * 0.4;
          const overY = cy >= r.top && cy <= r.bottom;
          // Ränder, die am Bildschirmrand liegen (z. B. maximierte Fenster), zählen nicht:
          // sonst würde die Figur an der Taskleiste unten am Browser hängen statt normal zu stehen
          const maxed = Boolean(IsZoomed(hwnd));
          const vx = GetSystemMetrics(76), vy = GetSystemMetrics(77);
          const vw = GetSystemMetrics(78), vh = GetSystemMetrics(79);
          const room = 12 * k;
          const canLeft = !maxed && r.left > vx + room;
          const canRight = !maxed && r.right < vx + vw - room;
          const canBottom = !maxed && r.bottom < vy + vh - room - box.height * 0.5;
          let edge = null;
          if (overX && foot >= r.top - 50 * k && foot <= r.top + 110 * k) edge = 'top';
          else if (canLeft && overY && Math.abs(cx - r.left) <= side + box.width / 2) edge = 'left';
          else if (canRight && overY && Math.abs(cx - r.right) <= side + box.width / 2) edge = 'right';
          else if (canBottom && cx >= r.left && cx <= r.right && Math.abs(box.y - r.bottom) <= side + box.height * 0.3) edge = 'bottom';
          if (edge) { found = { hwnd, rect: r, side: edge }; return 0; }
          if (cx > r.left && cx < r.right && cy > r.top && cy < r.bottom) return 0; // mitten im Fenster
          return 1;
        }, 0);
        if (found) found.seen = seen;
        return found || { seen };
      },
      // aktuelle Lage eines Fensters; null, wenn es zu, versteckt oder minimiert ist
      rectOf(hwnd) {
        if (!IsWindow(hwnd)) return { gone: 'geschlossen' };
        if (!IsWindowVisible(hwnd)) return { gone: 'unsichtbar' };
        if (IsIconic(hwnd)) return { gone: 'minimiert' };
        if (cloaked(hwnd)) return { gone: 'versteckt' };
        return visibleRect(hwnd) || { gone: 'keine Lage' };
      },
      // dasselbe Fenster über seine Adresse wiederfinden (falls der gemerkte Zeiger nicht mehr taugt)
      findByAddress(address) {
        let found = null;
        EnumWindows((hwnd) => {
          if (String(koffi.address(hwnd)) === address) { found = hwnd; return 0; }
          return 1;
        }, 0);
        return found;
      },
      address: (hwnd) => String(koffi.address(hwnd)),
      // Vordergrund-Fenster mit Lage in physischen Pixeln
      foreground() {
        const hwnd = GetForegroundWindow();
        if (!hwnd) return null;
        const r = {};
        if (!GetWindowRect(hwnd, r)) return null;
        return {
          hwnd: String(koffi.address(hwnd)),
          title: text(GetWindowTextW, hwnd),
          cls: text(GetClassNameW, hwnd),
          maximized: Boolean(IsZoomed(hwnd)),
          x: r.left, y: r.top, width: r.right - r.left, height: r.bottom - r.top,
        };
      },
    };
  } catch (err) {
    console.error('Windows-Funktionen nicht verfügbar:', err.message);
    return null;
  }
}

// Von den Tasten wird nur unterschieden: Enter, Löschen (Rücktaste/Entf) oder irgendeine andere.
// Welche Buchstaben getippt werden, erfährt die App nie.
const ENTER = new Set([28, 3612]);
const DELETE = new Set([14, 3667]);
function watchKeys(onKey, onMouse) {
  try {
    const { uIOhook } = require('uiohook-napi');
    uIOhook.on('keydown', (e) => onKey(ENTER.has(e.keycode) ? 'enter' : DELETE.has(e.keycode) ? 'delete' : 'key'));
    if (onMouse) {
      // Klicks und Mausrad irgendwo auf dem Bildschirm (nur Position bzw. Richtung)
      uIOhook.on('mousedown', (e) => onMouse({ type: 'click', x: e.x, y: e.y }));
      uIOhook.on('wheel', (e) => onMouse({ type: 'wheel', dir: Math.sign(e.rotation || 0) }));
    }
    uIOhook.start();
    return () => uIOhook.stop();
  } catch (err) {
    console.error('Tastatur-Erkennung nicht verfügbar:', err.message);
    return () => {};
  }
}

// onState({ fullscreen, title }) regelmäßig, onKey() bei jedem Tastendruck.
// getInterval() erlaubt seltenere Abfragen im Energiesparmodus.
function startWatching({ onState, onKey, onMouse, getInterval = () => 1000 }) {
  const win = loadWin32();
  let timer = null;
  const tick = () => {
    try {
      onState(win ? { fullscreen: win.fullscreen(), title: win.title() } : { fullscreen: false, title: '' });
    } catch (err) {
      console.error('Fenster-Abfrage:', err.message);
    }
    timer = setTimeout(tick, getInterval());
  };
  tick();
  const stopKeys = watchKeys(onKey, onMouse);
  return () => { clearTimeout(timer); stopKeys(); };
}

module.exports = { startWatching, loadWin32 };
