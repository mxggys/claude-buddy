// Schnelle Prüfungen ohne Electron: Figuren, Farben, Sorten, Zubehör.  Start: npm test
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const S = require('../src/sprites.js');

let failed = 0, passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.error(`✗ ${name}\n  ${e.message}`); }
}
const COLORS = ['blau', 'gruen', 'lila', 'rosa', 'gold', 'mitternacht'];
const ids = Object.keys(S.CHARACTERS);

test('Figurenliste enthält genau die sichtbaren Figuren', () => {
  assert.deepStrictEqual(S.ORDER, ['claude', 'kuschel', 'mokka', 'orangi', 'monsti']);
});

for (const id of ids) {
  const c = S.character(id);
  test(`${id}: alle Posen passen ins Raster`, () => {
    for (const [pose, rows] of Object.entries(c.frames)) {
      assert.ok(rows.length <= c.height + 1, `${pose}: ${rows.length} Zeilen > Höhe ${c.height}`);
      for (const r of rows) assert.ok(r.length <= c.width, `${pose}: Zeile ${r.length} breiter als ${c.width}`);
    }
  });
  test(`${id}: jede benutzte Farbe ist definiert`, () => {
    const missing = new Set();
    for (const rows of Object.values(c.frames)) for (const r of rows) for (const ch of r) if (ch !== '.' && ch !== ' ' && !c.palette[ch]) missing.add(ch);
    assert.strictEqual(missing.size, 0, `fehlt: ${[...missing].join(' ')}`);
  });
  test(`${id}: Augen liegen im Bild`, () => {
    for (const [x, y] of c.eye.positions) assert.ok(x >= 0 && y >= 0 && x + c.eye.pattern[0].length <= c.width && y + c.eye.pattern.length <= c.height, `Auge bei ${x},${y}`);
  });
}

test('Dosen haben für jede Farbe eine eigene Sorte', () => {
  for (const id of ['orangi', 'monsti']) {
    const c = S.character(id);
    assert.ok(c.variants, `${id} ohne Sorten`);
    for (const col of COLORS) {
      const vid = c.variants[col];
      assert.ok(vid && S.CHARACTERS[vid], `${id}: Sorte ${col} fehlt`);
      const v = S.character(vid);
      assert.strictEqual(v.width, c.width); assert.strictEqual(v.height, c.height);
      assert.ok(v.hidden, `${vid} sollte versteckt sein`);
    }
  }
});

test('Zubehör hochrechnen: Größe auf dem Bildschirm bei allen Figuren gleich (±20 %)', () => {
  const pxOf = (c) => {
    const target = c.display || c.scale;
    if (c.scale < 1.5) return Math.max(1, Math.round(3 / target)) * target;
    let best = Infinity, px = 0;
    for (let f = 1; f <= Math.floor(target); f++) { const sc = target / f, pm = Math.max(1, Math.round(3 / sc)); if (Math.abs(pm * sc - 3) < best - 1e-9) { best = Math.abs(pm * sc - 3); px = pm * sc; } }
    return px;
  };
  for (const id of S.ORDER) { const px = pxOf(S.character(id)); assert.ok(px > 2.4 && px < 3.6, `${id}: Zubehör-Pixel ${px.toFixed(2)} Bildpunkte`); }
});
test('Jedes Kopf-/Mund-/Begleiter-Teil aus dem Laden existiert als Bild', () => {
  const main = fs.readFileSync(path.join(__dirname, '../src/main.js'), 'utf8');
  const items = [...main.matchAll(/\['([A-Z0-9_]+)', '[^']*', '(kopf|begleiter)'/g)].map((m) => m[1]);
  const props = S.character('claude').props;
  const COMPOSITE = { CHAIR: 'CHAIR_BACK', SNOWGLOBE: 'GLOBEBASE', SPIEGELBRILLE: 'GLASSES' }; // aus mehreren Teilen gebaut / gezeichnet
  const missing = items.filter((k) => !props[k] && !props[COMPOSITE[k]]);
  assert.strictEqual(missing.length, 0, `kein Bild für: ${missing.join(', ')}`);
});

test('Dosen sind maßstabsgetreu: Kong Strong ~80 % der Monster-Höhe', () => {
  const k = S.character('orangi'), m = S.character('monsti');
  const ratio = (k.height * k.scale) / (m.height * m.scale);
  assert.ok(ratio > 0.75 && ratio < 0.85, `Verhältnis ${ratio.toFixed(2)}`);
});

test('Größe nur in 10er-Schritten', () => {
  const main = fs.readFileSync(path.join(__dirname, '../src/main.js'), 'utf8');
  assert.ok(/const snapSize = \(v\) => Math\.min\(MAX_SIZE, Math\.max\(MIN_SIZE, Math\.round\(v \* 10\) \/ 10\)\)/.test(main), 'snapSize nicht in 10er-Schritten');
});
test('Figuren ähnlich hoch (Tiere/Claude 70–90 px, Dosen bis 105 px bei 100 %)', () => {
  for (const id of S.ORDER) {
    const c = S.character(id);
    let top = Infinity, bot = -1;
    c.frames.idle.forEach((row, y) => { if ([...row].some((ch) => ch !== '.')) { top = Math.min(top, y); bot = Math.max(bot, y); } });
    const h = (bot - top + 1) * (c.display || c.scale);
    assert.ok(h >= 70 && h <= (c.variants ? 105 : 90), `${id}: ${h.toFixed(0)} px`);
  }
});
test('Neue Teile haben Bilder: Kühlbox, Mini-Dosen', () => {
  const P = S.character('claude').props;
  for (const k of ['KUEHLBOX', 'STACKCAN_O', 'STACKCAN_M']) assert.ok(P[k], k);
});
test('Mini-Claude hat Licht und Schatten (nicht einfarbig)', () => {
  const idle = S.character('claude').frames.idle.join('');
  for (const k of ['o', 'q', 'W', 'w']) assert.ok(idle.includes(k), `Ton ${k} fehlt`);
});

test('Dosen wachsen ohne Sprung: 80 % klein < 90 % groß, Abstand höchstens 15 %', () => {
  for (const id of ['orangi', 'monsti']) {
    const big = S.character(id), small = S.character(big.small.original);
    const h80 = small.height * small.display * 0.8, h90 = big.height * (big.display || big.scale) * 0.9;
    assert.ok(h90 >= h80 && h90 / h80 < 1.15, `${id}: 80 % = ${h80.toFixed(0)} px, 90 % = ${h90.toFixed(0)} px`);
  }
});
test('Klein-Versionen der Dosen: jede Farbe, Schrift 1:1 bei 70 %', () => {
  for (const id of ['orangi', 'monsti']) {
    const c = S.character(id);
    for (const col of ['original', ...COLORS]) {
      const sid = c.small && c.small[col];
      assert.ok(sid && S.CHARACTERS[sid], `${id}: Klein-Version ${col} fehlt`);
      const k = S.character(sid);
      assert.ok(Math.abs(k.display * 0.7 - 1) < 0.01, `${sid}: bei 70 % nicht 1:1`);
      assert.ok(k.hidden, `${sid} sollte versteckt sein`);
    }
  }
});

test('Quelltext: alle Dateien gültig, aufgerufene Funktionen in main.js vorhanden', () => {
  const { execFileSync } = require('child_process');
  for (const f of ['main.js', 'renderer.js', 'sprites.js', 'settings.js']) execFileSync(process.execPath, ['--check', path.join(__dirname, '../src', f)]);
  const main = fs.readFileSync(path.join(__dirname, '../src/main.js'), 'utf8');
  const defined = new Set([...main.matchAll(/function\s+([A-Za-z_]\w*)\s*\(/g)].map((m) => m[1]));
  for (const name of ['settingsState', 'pushSettingsState', 'setSize', 'buildMenu', 'loadSettings', 'snapSize'].filter((n) => n !== 'snapSize')) assert.ok(defined.has(name), `${name} fehlt`);
  assert.ok(/const snapSize =/.test(main), 'snapSize fehlt');
});

console.log(`${passed} ok, ${failed} fehlgeschlagen`);
process.exit(failed ? 1 : 0);
