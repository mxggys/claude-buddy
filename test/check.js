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

test('Zubehör hochrechnen: Größe auf dem Bildschirm bei allen Figuren gleich', () => {
  const up = (rows, pm) => rows.flatMap((r) => Array(pm).fill([...r].map((ch) => ch.repeat(pm)).join('')));
  for (const id of S.ORDER) {
    const c = S.character(id);
    const pm = c.scale < 1.5 ? Math.max(1, Math.round(3 / c.scale)) : 1;
    const cig = up(c.props.CIGARETTE, pm);
    const screen = cig[0].length * c.scale * pm / pm; // Breite in Bildpunkten bei Größe 100 %
    const ref = S.character('claude').props.CIGARETTE[0].length * S.character('claude').scale;
    assert.ok(Math.abs(cig[0].length * c.scale - ref) <= ref * 0.34, `${id}: Zigarette ${cig[0].length * c.scale}px statt ~${ref}px (${screen})`);
  }
});

test('Jedes Kopf-/Mund-/Begleiter-Teil aus dem Laden existiert als Bild', () => {
  const main = fs.readFileSync(path.join(__dirname, '../src/main.js'), 'utf8');
  const items = [...main.matchAll(/\['([A-Z0-9_]+)', '[^']*', '(kopf|begleiter)'/g)].map((m) => m[1]);
  const props = S.character('claude').props;
  const COMPOSITE = { CHAIR: 'CHAIR_BACK', SNOWGLOBE: 'GLOBEBASE' }; // aus mehreren Teilen gebaut
  const missing = items.filter((k) => !props[k] && !props[COMPOSITE[k]]);
  assert.strictEqual(missing.length, 0, `kein Bild für: ${missing.join(', ')}`);
});

test('Dosen sind maßstabsgetreu: Kong Strong ~80 % der Monster-Höhe', () => {
  const k = S.character('orangi'), m = S.character('monsti');
  const ratio = (k.height * k.scale) / (m.height * m.scale);
  assert.ok(ratio > 0.75 && ratio < 0.85, `Verhältnis ${ratio.toFixed(2)}`);
});

console.log(`${passed} ok, ${failed} fehlgeschlagen`);
process.exit(failed ? 1 : 0);
