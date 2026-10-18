// Beobachtet, was am PC passiert – ohne PowerShell-Skripte (die schlagen bei Virenscannern an):
// - ob gerade ein Spiel / Video im Vollbild läuft (shell32.dll)
// - Titel des Fensters im Vordergrund, damit Mini-Claude merkt, wenn Claude offen ist (user32.dll)
// - Tastendrücke über uiohook (nur DASS getippt wird, nicht welche Taste)
// - Lage des Fensters im Vordergrund, damit die Figur auf verschobene Fenster reagiert (user32.dll)

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
