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
      windowEdgeAt(x, y, grab = 40) {
        let found = null;
        EnumWindows((hwnd) => {
          if (!IsWindowVisible(hwnd) || IsIconic(hwnd) || cloaked(hwnd)) return 1;
          const pid = [0];
          GetWindowThreadProcessId(hwnd, pid);
          if (pid[0] === process.pid || SKIP_CLASSES.has(text(GetClassNameW, hwnd))) return 1;
          const r = visibleRect(hwnd);
          if (!r || r.right - r.left < 120 || r.bottom - r.top < 60) return 1;
          if (x < r.left || x > r.right) return 1;
          if (y >= r.top - grab && y <= r.top + grab) { found = { hwnd, rect: r }; return 0; }
          if (y > r.top && y < r.bottom) return 0; // verdeckt von diesem Fenster
          return 1;
        }, 0);
        return found;
      },
      // aktuelle Lage eines Fensters; null, wenn es zu, versteckt oder minimiert ist
      rectOf(hwnd) {
        if (!IsWindow(hwnd) || !IsWindowVisible(hwnd) || IsIconic(hwnd) || cloaked(hwnd)) return null;
        return visibleRect(hwnd);
      },
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

function watchKeys(onKey) {
  try {
    const { uIOhook } = require('uiohook-napi');
    uIOhook.on('keydown', () => onKey());
    uIOhook.start();
    return () => uIOhook.stop();
  } catch (err) {
    console.error('Tastatur-Erkennung nicht verfügbar:', err.message);
    return () => {};
  }
}

// onState({ fullscreen, title }) regelmäßig, onKey() bei jedem Tastendruck.
// getInterval() erlaubt seltenere Abfragen im Energiesparmodus.
function startWatching({ onState, onKey, getInterval = () => 1000 }) {
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
  const stopKeys = watchKeys(onKey);
  return () => { clearTimeout(timer); stopKeys(); };
}

module.exports = { startWatching, loadWin32 };
