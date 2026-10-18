// Durchsichtige Taskleiste über dieselbe Windows-Funktion, die auch TranslucentTB nutzt
// (SetWindowCompositionAttribute). Nichts wird in den Explorer eingeschleust.
// Windows setzt die Taskleiste z. B. beim Öffnen des Startmenüs zurück, deshalb wird der
// Zustand regelmäßig neu gesetzt. Beim Ausschalten oder Beenden zeichnet Windows sie wieder normal.

const WCA_ACCENT_POLICY = 19;
const ACCENT_ENABLE_TRANSPARENTGRADIENT = 2;
const WM_DWMCOMPOSITIONCHANGED = 0x031e;

function loadApi() {
  if (process.platform !== 'win32') return null;
  try {
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');
    const AccentPolicy = koffi.struct('ACCENT_POLICY', {
      AccentState: 'int', AccentFlags: 'int', GradientColor: 'uint32', AnimationId: 'int',
    });
    const CompositionData = koffi.struct('WINDOWCOMPOSITIONATTRIBDATA', {
      Attrib: 'int', pvData: 'void *', cbData: 'size_t',
    });
    const SetWindowCompositionAttribute = user32.func('bool __stdcall SetWindowCompositionAttribute(void* hwnd, WINDOWCOMPOSITIONATTRIBDATA* data)');
    const FindWindowExW = user32.func('void* __stdcall FindWindowExW(void* parent, void* after, str16 cls, str16 title)');
    const PostMessageW = user32.func('bool __stdcall PostMessageW(void* hwnd, uint32 msg, uintptr wParam, intptr lParam)');

    // Farbe 0 = komplett durchsichtig (ABGR, Alpha 0)
    const policy = koffi.alloc(AccentPolicy, 1);
    koffi.encode(policy, AccentPolicy, { AccentState: ACCENT_ENABLE_TRANSPARENTGRADIENT, AccentFlags: 2, GradientColor: 0, AnimationId: 0 });
    const data = { Attrib: WCA_ACCENT_POLICY, pvData: policy, cbData: koffi.sizeof(AccentPolicy) };

    // Haupt-Taskleiste und die auf weiteren Bildschirmen
    const taskbars = () => {
      const list = [];
      const main = FindWindowExW(null, null, 'Shell_TrayWnd', null);
      if (main) list.push(main);
      let next = null;
      for (let i = 0; i < 8; i++) {
        next = FindWindowExW(null, next, 'Shell_SecondaryTrayWnd', null);
        if (!next) break;
        list.push(next);
      }
      return list;
    };
    return {
      apply() { for (const hwnd of taskbars()) SetWindowCompositionAttribute(hwnd, data); },
      // Explorer zeichnet die Taskleiste wieder mit dem normalen Windows-Aussehen
      restore() { for (const hwnd of taskbars()) PostMessageW(hwnd, WM_DWMCOMPOSITIONCHANGED, 1, 0); },
    };
  } catch (err) {
    console.error('Durchsichtige Taskleiste nicht verfügbar:', err.message);
    return null;
  }
}

function createTaskbar({ log = () => {}, getInterval = () => 250 }) {
  let api;
  let timer = null;
  const tick = () => {
    try { api.apply(); } catch (err) { log('taskleiste', err.message); }
    timer = setTimeout(tick, getInterval());
  };
  return {
    set(on) {
      if (on && !timer) {
        if (api === undefined) api = loadApi();
        if (!api) return false;
        tick();
      } else if (!on && timer) {
        clearTimeout(timer);
        timer = null;
        try { api.restore(); } catch (err) { log('taskleiste', err.message); }
      }
      return true;
    },
  };
}

module.exports = { createTaskbar };
