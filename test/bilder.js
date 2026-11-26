// Bildvergleich: malt alle Figuren in allen Farben und Größen (mit Zubehör) und vergleicht mit den gespeicherten Bildern.
//   npm run test:bilder            vergleichen
//   npm run test:bilder -- --neu   Vergleichsbilder neu speichern (nach gewollten Änderungen)
// Braucht Playwright mit Chromium (läuft lokal, nicht im Release-Build).
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log('Playwright fehlt – Bildvergleich übersprungen (npm i -D playwright).'); process.exit(0); }
const S = require('../src/sprites.js');
const DIR = path.join(__dirname, 'bilder');
const REF = path.join(DIR, 'soll');
const OUT = path.join(DIR, 'ist');
const UPDATE = process.argv.includes('--neu');
const COLORS = ['original', 'blau', 'gruen', 'lila', 'rosa', 'gold', 'mitternacht'];
const cases = [];
for (const id of S.ORDER) {
  for (const c of COLORS) cases.push({ name: `${id}-${c}-100`, id, color: c, size: 1 });
  for (const z of [0.6, 0.7, 0.9, 1.3]) cases.push({ name: `${id}-original-${z * 100}`, id, color: 'original', size: z });
  cases.push({ name: `${id}-zubehoer-100`, id, color: 'original', size: 1, code: "__duck.setHat('PARTY'); __duck.setMouth('CIGARETTE'); __duck.setBuddy('CAPY')" });
  cases.push({ name: `${id}-zubehoer-70`, id, color: 'original', size: 0.7, code: "__duck.setHat('SPIEGELBRILLE'); __duck.setBuddy('KUEHLBOX'); __duck.setEffect('FROST')" });
}
for (const id of ['orangi', 'monsti']) for (const c of COLORS) cases.push({ name: `${id}-${c}-70`, id, color: c, size: 0.7 });

(async () => {
  fs.mkdirSync(REF, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const errs = [];
  let bad = 0;
  for (const cs of cases) {
    // für jedes Bild frisch laden: keine Reste (Partikel, Timer) vom vorigen Bild
    const p = await b.newPage({ viewport: { width: 320, height: 260 } });
    p.on('pageerror', (e) => errs.push(`${cs.name}: ${e.message}`));
    await p.clock.install({ time: new Date('2026-06-15T14:00:00') }); // feste Uhrzeit: kein Feierabend, kein Feiertag
    await p.goto('file://' + path.join(DIR, 'seite.html'));
    await p.clock.runFor(300);
    await p.evaluate(({ id, color, size, code }) => {
      window.__seed = 12345;
      __duck.setCharacter(id); __duck.setColor(color); __duck.setSize(size);
      __duck.setMouth(null); __duck.setHat(null); __duck.setBuddy(null); __duck.setEffect(null); __duck.say('', 0);
      __duck.setWeather({ code: 0, rainNow: false, temp: 15, storm: false }); __duck.setExtras({ wetter: false, temperatur: false });
      __duck.canFx.drops.length = 0; __duck.stack.keys = 0;
      const d = __duck.duck; d.x = 110; d.y = innerHeight - 20 - d.y * 0 - 0; d.action = null; d.state = 'idle'; d.until = performance.now() + 1e7; d.flipUntil = 0; d.dragging = false;
      __duck.setMood(70); __duck.setIdle(0); d.state = 'idle'; d.action = null; d.blinkUntil = 0; d.nextBlink = performance.now() + 1e7; d.until = performance.now() + 1e7;
      if (code) eval(code);
      window.__seed = 777;
    }, cs);
    await p.clock.runFor(400);
    const file = path.join(UPDATE ? REF : OUT, `${cs.name}.png`);
    await p.screenshot({ path: file });
    if (UPDATE) { await p.close(); continue; }
    const ref = path.join(REF, `${cs.name}.png`);
    if (!fs.existsSync(ref)) { console.log(`? ${cs.name}: kein Vergleichsbild (npm run test:bilder -- --neu)`); bad++; await p.close(); continue; }
    const diff = await p.evaluate(async ([a, c]) => {
      const load = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
      const [ia, ib] = await Promise.all([load(a), load(c)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return 1;
      const cv = document.createElement('canvas'); cv.width = ia.width; cv.height = ia.height; const x = cv.getContext('2d');
      x.drawImage(ia, 0, 0); const da = x.getImageData(0, 0, cv.width, cv.height).data;
      x.clearRect(0, 0, cv.width, cv.height); x.drawImage(ib, 0, 0); const db = x.getImageData(0, 0, cv.width, cv.height).data;
      let n = 0; for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 40) n++;
      return n / (da.length / 4);
    }, ['data:image/png;base64,' + fs.readFileSync(ref).toString('base64'), 'data:image/png;base64,' + fs.readFileSync(file).toString('base64')]);
    if (diff > 0.002) { bad++; console.log(`✗ ${cs.name}: ${(diff * 100).toFixed(2)} % der Pixel anders`); }
    await p.close();
  }
  await b.close();
  if (errs.length) { console.log('Fehler auf der Seite:', errs.slice(0, 3).join(' | ')); bad++; }
  console.log(UPDATE ? `${cases.length} Vergleichsbilder gespeichert` : `${cases.length - bad} von ${cases.length} Bildern gleich`);
  process.exit(bad && !UPDATE ? 1 : 0);
})();
