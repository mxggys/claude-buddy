// Beobachtet, was am PC passiert – ohne PowerShell-Skripte (die schlagen bei Virenscannern an):
// - ob gerade ein Spiel / Video im Vollbild läuft (shell32.dll)
// - Titel des Fensters im Vordergrund, damit Mini-Claude merkt, wenn Claude offen ist (user32.dll)
// - Tastendrücke über uiohook (nur DASS getippt wird, nicht welche Taste)

function loadWin32() {
  if (process.platform !== 'win32') return null;
  try {
    const koffi = require('koffi');
    const shell32 = koffi.load('shell32.dll');
    const user32 = koffi.load('user32.dll');
    const SHQueryUserNotificationState = shell32.func('int __stdcall SHQueryUserNotificationState(_Out_ int* state)');
    const GetForegroundWindow = user32.func('void* __stdcall GetForegroundWindow()');
    const GetWindowTextW = user32.func('int __stdcall GetWindowTextW(void* hWnd, _Out_ uint16_t* text, int max)');
    return {
      // 2 = Vollbild-App, 3 = Direct3D-Vollbild (Spiele), 4 = Präsentationsmodus
      fullscreen() {
        const state = [0];
        if (SHQueryUserNotificationState(state) !== 0) return false;
        return state[0] === 2 || state[0] === 3 || state[0] === 4;
      },
      title() {
        const hwnd = GetForegroundWindow();
        if (!hwnd) return '';
        const buf = new Uint16Array(256);
        const len = GetWindowTextW(hwnd, buf, buf.length);
        return Buffer.from(buf.buffer, 0, len * 2).toString('utf16le');
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

module.exports = { startWatching };
