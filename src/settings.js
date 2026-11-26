// Einstellungsfenster: zeigt den Zustand aus dem Hauptprozess und schickt jede Änderung sofort zurück
const api = window.buddySettings;
const S = window.DuckSprites;
let state = null;
let page = 'start';
try { page = localStorage.getItem('buddy-settings-page') || 'start'; } catch (e) { /* egal */ }

const SLOT_NAMES = { kopf: 'Kopf', mund: 'Mund', hand: 'Hand', begleiter: 'Begleiter', effekt: 'Effekt' };
const SLOT_HINT = {
  kopf: 'Sitzt auf dem Kopf.',
  mund: 'Ein Klick auf die Figur benutzt es (Zug nehmen, grinsen, spucken …).',
  hand: 'Hält die Figur in der linken Hand. Ab und zu macht sie etwas damit.',
  begleiter: 'Steht neben der Figur oder sie sitzt darauf. Ohne Mund-Teil benutzt ein Klick den Begleiter.',
  effekt: 'Läuft ständig um die Figur herum.',
};
// diese Begleiter haben kein eigenes Bild in der Vorschau (sie passen sich der Figur an)
const SIZED = new Set(['BED', 'CHAIR', 'BEANBAG', 'HAMMOCK', 'SNOWGLOBE']);
const HELD = new Set(['CIGARETTE', 'JOINT', 'CIGAR', 'PIPE', 'VAPE', 'NEONVAPE', 'CIGARILLO', 'ROLLIE', 'SLIM', 'FRUITVAPE', 'JOINTXXL', 'GOLDJOINT', 'GOLDRINGCIGAR', 'CIGARXXL', 'SHERLOCK', 'DIAMONDCIG', 'VAPEXXL', 'NOSESPRAY']);

// ---------- kleine Bausteine ----------
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== false && v !== null && v !== undefined) n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) n.append(kid.nodeType ? kid : String(kid));
  return n;
};
const txt = (title, sub) => el('div', { class: 'txt' }, el('b', {}, title), sub ? el('small', {}, sub) : null);
const card = (title, sub, control) => el('div', { class: 'card' }, txt(title, sub), control);
async function set(key, value) {
  const res = await api.set(key, value);
  if (res && res.state) { state = res.state; render(); }
  return res ? res.error : null;
}
function toggle(on, onChange, label) {
  const btn = el('button', { type: 'button', role: 'switch', 'aria-checked': String(Boolean(on)), 'aria-label': label });
  const word = el('span', {}, on ? 'Ein' : 'Aus');
  const wrap = el('label', { class: 'sw' }, word, btn);
  btn.addEventListener('click', () => {
    const next = btn.getAttribute('aria-checked') !== 'true';
    btn.setAttribute('aria-checked', String(next));
    word.textContent = next ? 'Ein' : 'Aus';
    onChange(next);
  });
  return wrap;
}
const switchCard = (title, sub, on, key) => card(title, sub, toggle(on, (v) => set(key, v), title));
function select(options, value, onChange, label) {
  const s = el('select', { 'aria-label': label, onchange: () => onChange(s.value) });
  for (const [v, l] of options) s.append(el('option', { value: v, selected: v === value }, l));
  return s;
}
function seg(options, value, onChange) {
  const box = el('div', { class: 'seg', role: 'group' });
  for (const [v, l] of options) box.append(el('button', { type: 'button', 'aria-pressed': String(v === value), onclick: () => onChange(v) }, l));
  return box;
}
// Texteingabe mit Speichern-Knopf und Fehlerzeile
function inputCard(title, sub, value, placeholder, key) {
  const input = el('input', { type: 'text', value: value || '', placeholder, 'aria-label': title });
  const err = el('div', { class: 'err', 'aria-live': 'polite' });
  const save = async () => { err.textContent = ''; const e = await set(key, input.value); if (e) err.textContent = e; };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  return el('div', { class: 'card' }, el('div', { class: 'txt' }, el('b', {}, title), sub ? el('small', {}, sub) : null, err),
    el('div', { class: 'row' }, input, el('button', { type: 'button', class: 'btn', onclick: save }, 'Speichern')));
}

// ---------- Figuren zeichnen ----------
function drawFigure(canvas, id, equip, px) {
  if (!S) return;
  let C = S.character(id);
  // Dosen: die gewählte Farbe ist eine eigene Sorte
  // wie in der App: unter 90 % die Klein-Version der Dose, sonst je Farbe die passende Sorte
  const klein = C.small && state.groesse < 0.85 ? (C.small[state.farbe] || C.small.original) : null;
  const sorte = klein || (C.variants && C.variants[state.farbe]);
  if (sorte) C = S.character(sorte);
  // Anzeige-Maßstab wie in der App: alle Figuren ähnlich groß, Zubehör überall gleich groß
  const target = C.display || C.scale;
  const pm = target < 1.5 ? Math.max(1, Math.round(3 / target)) : 1;
  const up = (rows) => (pm === 1 || !Array.isArray(rows) || typeof rows[0] !== 'string') ? rows
    : rows.flatMap((r) => Array(pm).fill([...r].map((ch) => ch.repeat(pm)).join('')));
  const P = {};
  for (const [k, rows] of Object.entries(C.props)) P[k] = k === 'GLASSES' ? rows : up(rows);
  // Farbe wie in der App (Dosen haben dafür eigene Sorten)
  const PAL = (!sorte && !C.variants && S.recolor) ? S.recolor(C.palette, C.colorKeys || C.ownColors || [], state.farbe, C.variantTweaks) : C.palette;
  const W = C.width, H = C.height, A = C.anchors;
  const MUG = A.mug ? [A.mug[0] < 0 ? A.mug[0] * pm : A.mug[0], A.mug[1]] : [-9 * pm, 11];
  const PROPPAL = pm > 1 && S.SHARED ? { ...S.SHARED, E: PAL.E, e: PAL.e, H: PAL.H, P: PAL.P, m: PAL.m, t: PAL.t } : PAL;
  const OX = 12 * pm, OY = 10 * pm, GW = W + 24 * pm, GH = H + 13 * pm;
  // erst 1 Zelle = 1 Bildpunkt malen, dann auf die Kachelgröße bringen
  const work = document.createElement('canvas');
  work.width = GW; work.height = GH;
  const cx = work.getContext('2d');
  const k = px * target / 3; // Mini-Claude (scale 3) behält seine Größe, alle anderen im selben Verhältnis wie in der App
  canvas.width = Math.round(GW * k); canvas.height = Math.round(GH * k);
  const palOf = new Map(Object.entries(C.propPals || {}).map(([n, p]) => [P[n], p]));
  const paintWith = (base) => (rows, col, row, map) => { const rowsPal = palOf.get(rows); return rows && rows.forEach((line, r) => {
    for (let c = 0; c < line.length; c++) {
      let ch = line[c];
      if (map && map[ch]) ch = map[ch];
      const color = (C.propPals && rowsPal && rowsPal[ch] && ch !== 'X' && ch !== 'x') ? rowsPal[ch] : base[ch];
      if (!color) continue;
      cx.fillStyle = color;
      cx.fillRect(OX + col + c, OY + row + r, 1, 1);
    }
  }); };
  const paintFig = paintWith(PAL);
  const paint = paintWith(PROPPAL);
  const finish = () => {
    const out = canvas.getContext('2d');
    out.imageSmoothingEnabled = k < 1;
    out.imageSmoothingQuality = 'high';
    out.clearRect(0, 0, canvas.width, canvas.height);
    out.drawImage(work, 0, 0, canvas.width, canvas.height);
    // Anzeigegröße aus der Bildgröße ableiten (statt fester Breite), damit Figuren im richtigen Verhältnis stehen
    const box = canvas.closest('.hero, .preview');
    const cssK = box ? (box.classList.contains('hero') ? 0.5 : 1) : null;
    if (cssK) { canvas.style.width = `${Math.round(canvas.width * cssK)}px`; canvas.style.height = 'auto'; }
  };
  const e = equip || {};
  const frame = e.mund === 'GRILLZ' ? C.frames.happy : C.frames.idle;
  paintFig(frame, 0, 0, e.effekt === 'GOLDOUTLINE' ? { X: 'i', x: 'I' } : null);
  if (frame.some((r) => r.includes('E'))) for (const [c, r] of C.eye.positions) paintFig(C.eye.pattern, c, r);
  if (e.kopf === 'SPIEGELBRILLE') {
    // Spiegel-Sonnenbrille über den Augen (wie in der App)
    const ew = C.eye.pattern[0].length, eh = C.eye.pattern.length, xs = C.eye.positions.map(([x]) => x), y0 = C.eye.positions[0][1] - 1;
    const put = (x, y, col) => { cx.fillStyle = col; cx.fillRect(OX + x, OY + y, 1, 1); };
    for (let x = Math.min(...xs) - 1; x <= Math.max(...xs) + ew; x++) put(x, y0, '#14161c');
    for (const ex of xs) for (let y = y0 + 1; y <= y0 + eh + 1; y++) for (let x = ex - 1; x <= ex + ew; x++) {
      const edge = x === ex - 1 || x === ex + ew || y === y0 + eh + 1;
      put(x, y, edge ? '#14161c' : (x - ex + y - y0 === 2 ? '#f4fbff' : (y - y0) / (eh + 1) < 0.45 ? '#41609a' : '#253352'));
    }
  }
  if (e.kopf && P[e.kopf]) { const rows = P[e.kopf]; paint(rows, A.hat[0] - Math.floor(rows[0].length / 2), A.hat[1] - rows.length + 1 - (e.kopf === 'GOLDHALO' ? 3 : 0)); }
  if (e.mund === 'GRILLZ') paint(P.GRILLZ, A.mouth[0] - 3, A.mouth[1]);
  else if (e.mund === 'CHEW') { paint(['hh', 'WW', 'ww'], A.mouth[0] + 2, A.mouth[1] - 2); paint(['('], A.mouth[0], A.mouth[1]); }
  else if (e.mund && HELD.has(e.mund)) { const pos = A.hand || A.mouth; paint(P[e.mund === 'NEONVAPE' ? 'VAPE' : e.mund], pos[0], pos[1] - 1); }
  else if (e.mund === 'TOOTHPICK' || e.mund === 'GOLDPICK') paint(P[e.mund], A.mouth[0], A.mouth[1] - 1);
  else if (e.mund === 'HOSE') { paint(['jj'], A.mouth[0], A.mouth[1] - 1); for (let i = 0; i <= 20; i++) { const k = i / 20; paint(['k'], Math.round(A.mouth[0] + 2 + (W + 4 - A.mouth[0] - 2) * k), Math.round(A.mouth[1] - 1 + (H - A.mouth[1]) * k + Math.sin(k * Math.PI) * 4), null); } }
  if (e.hand === 'WALLET') { const mug = MUG; paint(P.WALLET, mug[0] + 2, mug[1] + 3); }
  if (e.hand === 'DRINK') { const mug = MUG; paint(P.DRINK, mug[0] + 1, mug[1] + 1); }
  if (e.begleiter && P[e.begleiter] && !SIZED.has(e.begleiter)) {
    const rows = P[e.begleiter === 'ZIPPO' ? 'ZIPPO_OPEN' : e.begleiter];
    paint(rows, W + 1, H - rows.length + 1);
  }
  finish();
}
// ein einzelnes Teil als kleines Bild (für die Kacheln)
function drawItem(canvas, key, slot) {
  const fig = state.figur;
  const equip = { [slot]: key };
  drawFigure(canvas, fig, slot === 'effekt' ? { effekt: key } : equip, 2);
}

// ---------- Seiten ----------
const ICON = {
  feed: '<path d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 3-3 6s1 3 3 3v9"/>',
  ball: '<circle cx="12" cy="12" r="8"/><path d="M4.5 9.5c5 1 10 1 15 0M4.5 14.5c5-1 10-1 15 0"/>',
  dnd: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
};
const icon = (name) => { const sv = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); sv.setAttribute('viewBox', '0 0 24 24'); sv.setAttribute('fill', 'none'); sv.setAttribute('stroke', 'currentColor'); sv.setAttribute('stroke-width', '1.6'); sv.setAttribute('aria-hidden', 'true'); sv.innerHTML = ICON[name]; return sv; };
const quick = (name, title, sub, onclick, on) => el('button', { type: 'button', class: on ? 'qbtn on' : 'qbtn', onclick, 'aria-pressed': on === undefined ? null : String(Boolean(on)) }, icon(name), el('div', {}, el('b', {}, title), sub ? el('small', {}, sub) : null));
function actionInput(placeholder, label, key, btn) {
  const input = el('input', { type: 'text', placeholder, 'aria-label': label });
  const err = el('div', { class: 'err', 'aria-live': 'polite' });
  const go = async () => { err.textContent = ''; const e = await set(key, input.value); if (e) err.textContent = e; else input.value = ''; };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  return el('div', {}, el('div', { class: 'row' }, input, el('button', { type: 'button', class: 'btn', onclick: go }, btn)), err);
}

const PAGES = {
  start() {
    const fig = state.figures.find((f) => f.id === state.figur);
    const prev = el('canvas', { role: 'img', 'aria-label': 'Deine Figur' });
    drawFigure(prev, state.figur, state.slots, 4);
    const timers = state.timers.map((tm) => card(tm.label, `klingelt um ${tm.at}`, el('button', { type: 'button', class: 'btn', onclick: () => set('timerCancel', tm.id) }, 'Abbrechen')));
    return [
      el('h1', {}, 'Start'),
      (state.neu && state.neu.length) ? el('div', { class: 'card col' },
        txt(`Neu in Version ${state.version}`, null),
        el('ul', { class: 'muted', style: 'margin:4px 0 8px 18px;padding:0' }, ...state.neu.map((n) => el('li', {}, n))),
        el('button', { type: 'button', class: 'btn', onclick: () => set('gesehenVersion', true) }, 'Gelesen')) : null,
      el('div', { class: 'card hero' }, prev, el('div', {}, el('b', {}, state.name || (fig ? fig.name.replace(/ \(.*\)$/, '') : 'Claude Desktop Buddy')), el('span', { class: 'muted' }, state.mood ? `Laune: ${state.mood}` : 'Laune ist aus'))),
      el('h2', {}, 'Schnell'),
      el('div', { class: 'quick' },
        quick('feed', 'Füttern', 'Ein Snack, je Figur ihr Lieblingsessen.', () => api.action('feed')),
        quick('ball', state.ballOn ? 'Ball wegräumen' : 'Ball zum Spielen', state.ballOn ? 'Der Ball liegt gerade draußen.' : 'Kicken, werfen, jonglieren.', () => api.action('ball'), state.ballOn),
        quick('dnd', state.dndUntil ? 'Nicht stören aufheben' : 'Nicht stören', state.dndUntil ? `Ruhig bis ${state.dndUntil}.` : 'Eine Stunde Ruhe.', () => api.action('dnd'), Boolean(state.dndUntil))),
      el('h2', {}, 'Spielen'),
      el('div', { class: 'group' },
        el('div', { class: 'card col' },
          txt('Schere, Stein, Papier', `Du ${state.schnick.du} · ${state.name || 'Buddy'} ${state.schnick.buddy} · Unentschieden ${state.schnick.gleich}`),
          el('div', { class: 'chips' }, ...[['schere', 'Schere'], ['stein', 'Stein'], ['papier', 'Papier']].map(([k, l]) => el('button', { type: 'button', class: 'btn', onclick: () => set('rps', k) }, l))),
          state.schnickLast ? el('div', { class: 'muted' }, state.schnickLast) : null),
        card('Korbwerfen', 'Ball in den Korb werfen: ziehen und loslassen. Die Figur wirft auch mit.', el('button', { type: 'button', class: 'btn', onclick: () => api.action('hoop') }, state.ballOn ? 'Beenden' : 'Starten'))),
      el('h2', {}, 'Erinnerung und Wecker'),
      el('div', { class: 'group' },
        el('div', { class: 'card col' }, txt('Erinnern in', 'Die Figur klingelt, wenn die Zeit um ist.'),
          el('div', { class: 'chips' }, ...[5, 10, 15, 30, 60].map((m) => el('button', { type: 'button', class: 'btn', onclick: () => set('timer', m) }, `${m} Min.`))),
          actionInput('Eigene Minuten, z. B. 25', 'Eigene Minuten', 'timer', 'Starten')),
        el('div', { class: 'card col' }, txt('Wecker', 'Uhrzeit, zum Beispiel 7:30. Klingelt beim nächsten Mal.'), actionInput('7:30', 'Weckzeit', 'alarm', 'Stellen')),
        ...timers,
        card('Klingeln kurz zeigen', null, el('button', { type: 'button', class: 'btn', onclick: () => api.action('ring') }, 'Zeigen'))),
    ];
  },
  figur() {
    const figs = el('div', { class: 'tiles' });
    for (const f of state.figures) {
      const c = el('canvas', { 'aria-hidden': 'true' });
      drawFigure(c, f.id, null, 2);
      figs.append(el('button', { type: 'button', class: 'tile', 'aria-pressed': String(state.figur === f.id), onclick: () => set('figur', f.id) }, c, el('small', {}, f.name)));
    }
    const size = el('input', { type: 'range', min: '10', max: '300', step: '10', value: String(Math.round(state.groesse * 100)), 'aria-label': 'Größe in 10er-Schritten' });
    const sizeLabel = el('span', { class: 'muted' }, `${Math.round(state.groesse * 100)} %`);
    size.addEventListener('input', () => { sizeLabel.textContent = `${size.value} %`; });
    size.addEventListener('change', () => set('groesse', Number(size.value) / 100));
    const colors = state.colors.map((c) => [c.key, c.label]);
    return [
      el('h1', {}, 'Figur'),
      el('div', { class: 'card col' }, txt('Welche Figur', 'Wechselt sofort.'), figs),
      el('h2', {}, 'Name und Aussehen'),
      el('div', { class: 'group' },
        inputCard('Name', 'Leer lassen für den normalen Namen.', state.name, 'z. B. Krümel', 'name'),
        card('Größe', 'Tipp: Strg + Mausrad auf der Figur', el('div', { class: 'row' }, size, sizeLabel)),
        card('Farbe', null, select(colors, state.farbe, (v) => set('farbe', v), 'Farbe'))),
      el('h2', {}, 'Zweite Figur'),
      el('div', { class: 'group' },
        card('Zweite Figur daneben', 'Die beiden spielen miteinander.', select([['', 'Aus'], ...state.figures.map((f) => [f.id, f.name])], state.zweiteFigur || '', (v) => set('zweiteFigur', v || null), 'Zweite Figur')),
        ...(state.zweiteFigur ? [
          inputCard('Name der zweiten Figur', null, state.name2, 'z. B. Bröckchen', 'name2'),
          card('Farbe der zweiten Figur', null, select(colors, state.farbe2, (v) => set('farbe2', v), 'Farbe der zweiten Figur')),
        ] : [])),
    ];
  },
  aussehen() {
    const prev = el('canvas', { role: 'img', 'aria-label': 'Vorschau der Figur mit Zubehör' });
    drawFigure(prev, state.figur, state.slots, 6);
    const owned = state.items.filter((i) => i.owned).length;
    const out = [el('h1', {}, 'Zubehör'), el('div', { class: 'card col' }, el('div', { class: 'preview' }, prev),
      el('small', { class: 'muted' }, `${owned} von ${state.items.length} gesammelt · neue Teile gibt es im täglichen Geschenk (✦ = selten, goldenes Päckchen)`))];
    for (const slot of Object.keys(SLOT_NAMES)) {
      const all = state.items.filter((i) => i.slot === slot);
      const mine = all.filter((i) => i.owned);
      const tiles = el('div', { class: 'tiles' },
        el('button', { type: 'button', class: 'tile none', 'aria-pressed': String(!state.slots[slot]), onclick: () => set(`slot:${slot}`, null) }, el('small', {}, 'Nichts')));
      for (const it of mine) {
        const c = el('canvas', { 'aria-hidden': 'true' });
        drawItem(c, it.key, slot);
        tiles.append(el('button', { type: 'button', class: 'tile', 'aria-pressed': String(state.slots[slot] === it.key), onclick: () => set(`slot:${slot}`, it.key) }, c, el('small', {}, it.name)));
      }
      out.push(el('h2', {}, `${SLOT_NAMES[slot]} · ${mine.length} von ${all.length}`));
      out.push(el('div', { class: 'card col' }, el('small', { class: 'muted' }, SLOT_HINT[slot]), tiles));
    }
    return out;
  },
  verhalten() {
    const t = state.toggles;
    return [
      el('h1', {}, 'Verhalten'),
      el('div', { class: 'group' },
        switchCard('Läuft herum', 'Läuft ab und zu ein Stück an der Taskleiste entlang.', t.laufen, 'laufen'),
        switchCard('Fangen spielen', 'Rennt deinem Mauszeiger hinterher und jubelt, wenn sie ihn erwischt.', t.fangen, 'fangen'),
        switchCard('Schwerkraft', 'An: fällt nach unten. Aus: bleibt, wo du sie hinziehst.', t.schwerkraft, 'schwerkraft'),
        switchCard('Auf Fenster setzen', 'An den oberen Rand eines Fensters ziehen und loslassen.', t.aufFenstern, 'aufFenstern'),
        switchCard('Springt aufs aktive Fenster', 'Springt ab und zu auf das Fenster, in dem du arbeitest.', t.fensterSpringen, 'fensterSpringen')),
      el('h2', {}, 'Mitmachen'),
      el('div', { class: 'group' },
        switchCard('Tippt mit', 'Tippt auf der Mini-Tastatur, wenn du tippst.', t.tastatur, 'tastatur'),
        switchCard('Mund bewegt sich mit Mikrofon', state.energiesparen === 3 ? 'Im Energiesparmodus Hart aus.' : 'Spricht mit, wenn du redest.', t.mikrofon, 'mikrofon'),
        switchCard('Pausen-Erinnerung', 'Nach 60 Minuten Tippen am Stück.', t.pausen, 'pausen'),
        switchCard('Laune', 'Füttern, Streicheln und Spielen machen fröhlich, Ignorieren traurig.', t.launeAn, 'launeAn')),
    ];
  },
  rauchen() {
    const r = state.rauchen;
    return [
      el('h1', {}, 'Rauchen'),
      el('div', { class: 'group' },
        card('Raucht von selbst', 'Aus: nur noch per Klick auf die Figur.', toggle(r.selbst !== false, (v) => set('rauchen:selbst', v), 'Raucht von selbst')),
        card('Wie oft', 'Gilt auch für Shisha, Bong, Snus und Getränke.', seg([['selten', 'Selten'], ['normal', 'Normal'], ['oft', 'Oft']], r.oft || 'normal', (v) => set('rauchen:oft', v))),
        card('Zigarette brennt ab', 'Wird kürzer, ausgedrückt und neu angezündet.', toggle(r.abbrennen !== false, (v) => set('rauchen:abbrennen', v), 'Zigarette brennt ab')),
        card('Joint & Bong', 'Danach rote Augen und Heißhunger.', toggle(r.effekt !== false, (v) => set('rauchen:effekt', v), 'Joint und Bong'))),
    ];
  },
  extras() {
    const e = state.extras;
    const ex = (title, sub, key) => card(title, sub, toggle(e[key], (v) => set(`extra:${key}`, v), title));
    return [
      el('h1', {}, 'Feiertage & Wetter'),
      el('div', { class: 'group' },
        ex('Weihnachtsmütze im Dezember', null, 'weihnachten'),
        ex('Partyhut an Silvester und Neujahr', null, 'silvester'),
        ex('Hasenohren und Osterei an Ostern', null, 'ostern'),
        ex('Kürbis und Fledermäuse an Halloween', null, 'halloween'),
        ex('Schnee im Winter', 'Dezember bis Februar, mit Schneemann.', 'winterschnee'),
        ex('Geburtstag feiern', 'Partyhut und Konfetti.', 'geburtstag'),
        inputCard('Geburtstag', 'Tag und Monat, zum Beispiel 17.03.', e.geburtstagDatum, 'TT.MM.', 'geburtstagDatum'),
        card('Extras kurz zeigen', 'Alle Feiertags-Sachen einmal ansehen.', el('button', { type: 'button', class: 'btn', onclick: () => api.action('preview-extras') }, 'Zeigen'))),
      el('h2', {}, 'Wetter'),
      el('div', { class: 'group' },
        ex('Wetter anzeigen', state.weather || 'Schirm bei Regen, Sonnenbrille bei Sonne, Schnee.', 'wetter'),
        inputCard('Ort', 'Stadt oder Ort. Das Wetter kommt von Open-Meteo.', e.ort ? e.ort.split(',')[0] : '', 'z. B. Berlin', 'ort'),
        ex('Wetter-Schild neben der Figur', 'Mit Temperatur und Regenrisiko.', 'temperatur')),
    ];
  },
  statistik() {
    const st = state.stats;
    const box = (n, label) => el('div', { class: 'card' }, el('b', {}, n), el('small', { class: 'muted' }, label));
    const fmt = (n) => Number(n || 0).toLocaleString('de-DE');
    return [
      el('h1', {}, 'Statistik'),
      el('div', { class: 'stats' }, box(fmt(st.heute), 'Tasten heute'), box(fmt(st.gesamt), 'Tasten gesamt'), box(fmt(st.rekord), 'Rekord an einem Tag'), box(st.zeit, 'Zusammen verbracht')),
      el('h2', {}, 'Spielzeit'),
      el('div', { class: 'stats' }, ...st.spiel.map((s) => box(fmt(s.n), s.label))),
      el('div', { class: 'group', style: 'margin-top:12px' }, card('Wochenrückblick', 'Die letzten 7 Tage als Meldung.', el('button', { type: 'button', class: 'btn', onclick: () => api.action('recap') }, 'Zeigen'))),
    ];
  },
  system() {
    return [
      el('h1', {}, 'System & Updates'),
      ...(state.warning ? [el('div', { class: 'card warn' }, txt(state.warning), el('button', { type: 'button', class: 'btn primary', onclick: () => api.action('token') }, 'Beheben'))] : []),
      el('div', { class: 'group' },
        card(`Claude Desktop Buddy ${state.version}`, state.update,
          el('div', { class: 'row' },
            state.updateReady ? el('button', { type: 'button', class: 'btn primary', onclick: () => api.action('update-install') }, 'Neu starten und installieren') : null,
            el('button', { type: 'button', class: 'btn', onclick: () => api.action('update-check') }, 'Nach Updates suchen'))),
        card('Update-Schlüssel', state.hasToken ? 'Ist gespeichert.' : 'Fehlt noch.', el('button', { type: 'button', class: 'btn', onclick: () => api.action('token') }, state.hasToken ? 'Ändern' : 'Eingeben'))),
      el('h2', {}, 'Leistung'),
      el('div', { class: 'group' },
        card('Energiesparmodus', 'Weniger Animation, weniger Akku.', select(state.energy.map((l, i) => [String(i), l]), String(state.energiesparen), (v) => set('energiesparen', Number(v)), 'Energiesparmodus')),
        switchCard('Im Vollbild anzeigen', 'Auch über Spielen und Videos.', state.toggles.imVollbild, 'imVollbild'),
        card('Mit Windows starten', null, toggle(state.autostart, (v) => set('autostart', v), 'Mit Windows starten'))),
      el('h2', {}, 'Hilfe'),
      el('div', { class: 'group' },
        card('Figur zurückholen', 'Auch per Doppelklick aufs Symbol in der Taskleiste.', el('button', { type: 'button', class: 'btn', onclick: () => api.action('reset') }, 'Zurückholen')),
        card('Fehler-Log', null, el('button', { type: 'button', class: 'btn', onclick: () => api.action('log') }, 'Öffnen'))),
    ];
  },
};

function render() {
  if (!state) return;
  document.querySelectorAll('nav [data-page]').forEach((b) => {
    if (b.dataset.page === page) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  const fig = state.figures.find((f) => f.id === state.figur);
  document.getElementById('meName').textContent = state.name || (fig ? fig.name.replace(/ \(.*\)$/, '') : 'Claude Desktop Buddy');
  document.getElementById('meVer').textContent = `Version ${state.version}`;
  drawFigure(document.getElementById('meFig'), state.figur, state.slots, 1);
  const main = document.getElementById('main');
  const scroll = main.scrollTop;
  main.replaceChildren(...PAGES[page]());
  main.scrollTop = scroll;
}
document.querySelectorAll('nav [data-page]').forEach((b) => b.addEventListener('click', () => {
  page = b.dataset.page;
  try { localStorage.setItem('buddy-settings-page', page); } catch (e) { /* egal */ }
  document.getElementById('main').scrollTop = 0;
  render();
}));
api.onState((s) => {
  state = s;
  // Eingaben nicht beim Tippen überschreiben
  if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.type === 'text') return;
  render();
});
api.onGoto((p) => { if (PAGES[p]) { page = p; document.getElementById('main').scrollTop = 0; render(); } });
document.querySelector('[data-quit]').addEventListener('click', () => api.action('quit'));
api.get().then((s) => { state = s; if (!PAGES[page]) page = 'start'; render(); });
