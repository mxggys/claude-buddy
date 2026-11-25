// Pixel-Figuren für den Desktop-Begleiter. Jede Figur wird aus Formen auf ein Raster gezeichnet
// und liefert dieselben Posen (FRAMES), damit der Renderer alle gleich behandeln kann.
(function (root) {
  // Farben für Zubehör, gelten für alle Figuren
  const SHARED = {
    X: '#3a2b26', // Umriss
    x: '#7d6457', // Umriss oben/links (Lichtseite)
    Y: '#8a3d12', // Umriss Schnabel / Füße
    E: '#1c1416', // Pupille (beweglich, wird vom Renderer gezeichnet)
    e: '#1c1416', // geschlossene / fröhliche Augen (fest)
    H: '#ffffff', // Glanzpunkt
    P: '#ffb3b0', // Bäckchen
    m: '#7a2d1f', // offener Mund
    t: '#e0626b', // Zunge
    k: '#4a4655', // Tastatur
    L: '#d4d8e2', // Tasten
    R: '#ff5b7a', // Herz
    r: '#d93a5c',
    d: '#d8323c', // Weihnachtsmütze
    D: '#a3202b',
    p: '#ff5fa2', // Partyhut
    b: '#4aa3f0', // Partyhut / Regenschirm
    z: '#2f6fbd',
    K: '#17141a', // Sonnenbrille
    s: '#5d6a7a', // Glanz auf der Sonnenbrille
    c: '#9fd0ff', // Regentropfen
    u: '#b8913f', // Pilz
    U: '#efd27c',
    n: '#d9d3c7',
    i: '#f2cf63', // Glühbirne
    I: '#fff4c4',
    j: '#c9c2b5', // Lupe / Sockel
    J: '#6f9c98',
    a: '#f7f3ee', // Hasenohren / Bommel
    g: '#f6a3bd',
    y: '#f08a24', // Kürbis
    Q: '#c45f16',
    V: '#4f8a3a',
    S: '#3d5aa8', // Schlafmütze
    T: '#2b3f80',
    M: '#7bbf4a', // Bambus
    Z: '#4a8a2c',
    C: '#9fd3ff', // Osterei
    // Zigarette: Filter, Papier, Asche, Glut
    1: '#e8a066', 2: '#c47c44', 3: '#f6f5f0', 4: '#cfcfca', 5: '#8a8a90', 6: '#3c3c42', 7: '#ff7a1a', 8: '#ffd04a',
    // Joint: Papier hell/dunkel, Glut und Glutrand, Rauchfaden
    9: '#8b4400', 0: '#663200', '+': '#b84142', '-': '#571f20', '~': '#949494',
    // Kaffeebecher: Becher, Schatten, Kaffee, Dampf
    '=': '#efe6d2', '#': '#cdbf9f', '%': '#3b2414', '&': '#e3cfa8',
    // Haut (Hand von oben), Glas, Capybara
    ':': '#f2c6a0', ';': '#d49a74', '|': '#e4eef4', ',': '#c08a55', '_': '#7f5530',
    // Zigarre: Deckblatt hell/mittel/dunkel, Bauchbinde gold/rot
    '[': '#9a5a32', '(': '#74401f', ')': '#4f2a12', ']': '#d9b23a', '!': '#b02a2a',
    // Pfeife: Mundstück schwarz glänzend, Holzkopf mit Maserung
    '{': '#1d1b20', '}': '#4a4650', '<': '#8a4a22', '>': '#5e2f12', '^': '#b06a38',
    // Vape: Gehäuse dunkel/mittel/Glanz, Mundstück
    '$': '#2b2f3a', '@': '#4c5364', '?': '#9aa3b6', '*': '#15161b',
  };

  const grid = (w, h) => Array.from({ length: h }, () => Array(w).fill('.'));
  const set = (g, pts, ch) => pts.forEach(([x, y]) => { if (g[y] && x >= 0 && x < g[0].length) g[y][x] = ch; });
  const rect = (g, x0, y0, x1, y1, ch) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(g, [[x, y]], typeof ch === 'function' ? ch(x, y) : ch);
  };

  function ellipse(g, cx, cy, rx, ry, paint, angle = 0) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (let y = 0; y < g.length; y++) {
      for (let x = 0; x < g[0].length; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const nx = (dx * cos + dy * sin) / rx;
        const ny = (-dx * sin + dy * cos) / ry;
        if (nx * nx + ny * ny <= 1) {
          const ch = paint(nx, ny, x, y);
          if (ch) g[y][x] = ch;
        }
      }
    }
  }

  // Schattierung mit Licht von links oben: hell / mittel / dunkel (+ optional Glanz)
  const tone = (a, b, c, hi) => (nx, ny, x, y) => {
    const d = nx * 0.45 + ny * 0.9;
    if (hi && d < -0.85) return hi;
    if (d > 0.86) return c;
    if (d > 0.72) return (x + y) % 2 ? c : b;
    if (d > 0.44) return b;
    return a;
  };
  const wingTone = (a, b, c) => (nx, ny) => (ny > 0.55 || nx < -0.8 ? c : ny < -0.45 ? a : b);
  const beakTone = (nx, ny) => (ny < -0.4 && nx < 0.3 ? 'q' : ny > 0.4 ? 'o' : 'O');

  const WARM = new Set(['q', 'O', 'o', 'm', 't', 'F', 'f']);
  function outline(g, warm = WARM) {
    const at = (x, y) => (g[y] && x >= 0 && x < g[0].length ? g[y][x] : '.');
    const out = g.map((row) => row.slice());
    for (let y = 0; y < g.length; y++) {
      for (let x = 0; x < g[0].length; x++) {
        if (g[y][x] !== '.') continue;
        const solid = (c) => c !== '.' && c !== 'X' && c !== 'Y' && c !== 'x';
        const n = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].filter(solid);
        if (!n.length) continue;
        if (n.every((c) => warm.has(c))) { out[y][x] = 'Y'; continue; }
        // nur oben/links an der Figur: hellerer Umriss, wie von der Lichtquelle angestrahlt
        const lit = (solid(at(x + 1, y)) || solid(at(x, y + 1))) && !solid(at(x - 1, y)) && !solid(at(x, y - 1));
        out[y][x] = lit ? 'x' : 'X';
      }
    }
    return out;
  }

  const finish = (g, eyeDy, withOutline = true) => {
    const rows = (withOutline ? outline(g) : g).map((r) => r.join(''));
    rows.eyeDy = eyeDy;
    return rows;
  };

  // Kleine Sprites (Zubehör) mit Umriss
  const small = (rows) => {
    const pad = Array(rows[0].length + 2).fill('.');
    const g = [pad.slice(), ...rows.map((r) => ['.', ...r.split(''), '.']), pad.slice()];
    return outline(g).map((r) => r.join(''));
  };

  // Standard-Posen aus einer Zeichenfunktion
  const POSES = {
    idle: {},
    breathe: { headDy: 1 },
    blink: { eye: 'closed' },
    happy: { eye: 'happy' },
    quack: { beak: 1, wing: 'up' },
    talk: { beak: 2 },
    angry: { eye: 'angry' },
    flap: { wing: 'up', feet: 'step1' },
    sleep: { eye: 'closed', sit: true, feet: 'none', headDy: 1 },
    sleep2: { eye: 'closed', sit: true, feet: 'none', headDy: 2 }, // Atemzug im Schlaf
    tapL: { arms: 'tapL' },
    tapR: { arms: 'tapR' },
    // Leerlauf-Animationen
    sleepy: { eye: 'sleepy' },
    yawn: { eye: 'closed', beak: 2, headDy: -1 },
    stretch: { wing: 'up', headDy: -1, eye: 'happy' },
    preen: { headDy: 2, eye: 'closed', wing: 'up' },
    wave1: { arms: 'wave1', eye: 'happy' },
    wave2: { arms: 'wave2', eye: 'happy' },
    waveL1: { arms: 'waveL1', eye: 'happy' },
    waveL2: { arms: 'waveL2', eye: 'happy' },
    // festgehalten: zappeln
    drag1: { arms: 'danceL', wing: 'up', eye: 'wide', feet: 'step1' },
    drag2: { arms: 'danceR', eye: 'wide', feet: 'step2' },
    // Zeiger ruht auf der Figur: Arme hoch, will hochgehoben werden
    reach: { arms: 'reach', eye: 'happy', headDy: -1 },
    // Reaktionen
    startle: { eye: 'wide', wing: 'up', headDy: -1 },
    dizzy1: { eye: 'dizzy', headDy: 1 },
    dizzy2: { eye: 'dizzy' },
    sad: { eye: 'sleepy', headDy: 2, arms: 'droop' },
    cheer1: { eye: 'happy', wing: 'up', beak: 1, arms: 'cheer' },
    cheer2: { eye: 'happy', headDy: -1, arms: 'cheer' },
    // weitere Leerlauf-Animationen
    step1: { feet: 'step1' },
    step2: { feet: 'step2', headDy: 1 },
    peck: { headDy: 3, beak: 1, eye: 'closed' },
    shake1: { wing: 'up', headDy: -1, eye: 'closed' },
    shake2: { headDy: 1, eye: 'closed' },
    wink: { eye: 'wink' },
    dance1: { arms: 'danceL', eye: 'happy', feet: 'step1' },
    dance2: { arms: 'danceR', eye: 'happy', feet: 'step2' },
    // Rauchen: Hand zum Mund führen, dann mit halb geschlossenen Augen ziehen
    smokeHold: { arms: 'smokeUp', wing: 'up' },
    smokeUp: { arms: 'smokeUp', wing: 'up', eye: 'sleepy' },
    // Kaffee: Becher in der linken Hand, zum Trinken anheben
    coffee: { eye: 'happy', arms: 'cup' },
    // Schattenboxen und Liegestütze
    punchL: { arms: 'waveL2', eye: 'angry' },
    punchR: { arms: 'wave2', eye: 'angry' },
    pushdown: { sit: true, feet: 'none', arms: 'droop', eye: 'angry' },
    sip: { eye: 'happy', arms: 'sip', headDy: -1 },
    // auf dem Bauch rutschen (Pinguin), Bambus kauen (Panda)
    slide: { eye: 'happy', sit: true, feet: 'none', wing: 'up', arms: 'cheer' },
    chew1: { beak: 1 },
    chew2: { eye: 'happy' },
  };
  const framesOf = (draw) => Object.fromEntries(Object.entries(POSES).map(([k, o]) => [k, draw(o)]));

  // ---------------------------------------------------------------------------------------------
  // Mini-Claude (Vorderansicht), Raster 30 x 23
  const CW = 30;
  const CH = 23;
  function miniClaude({ beak = 0, eye = 'open', feet = 'stand', wing = 'down', headDy = 0, sit = false, arms = 'down' }) {
    const g = grid(CW, CH);
    const by = sit ? 1 : 0;
    const breathe = headDy > 0 && !sit ? 1 : 0;
    const lift = headDy < 0 ? 1 : 0; // Strecken / Gähnen: ein Stück größer
    // oben heller Rand, unten Schatten
    const paint = (y1, y0 = -1, x1 = -1) => (x, y) => (y === y0 ? 'h' : y === y1 || x === x1 ? 'w' : 'W');
    // Arme
    let lA = 3 + by + breathe;
    let rA = 3 + by + breathe;
    if (wing === 'up') { lA = 0; rA = 0; }
    if (arms === 'tapL') lA += 2;
    if (arms === 'tapR') rA += 2;
    if (arms === 'wave1') rA = 0;
    if (arms === 'wave2') rA = 1;
    if (arms === 'waveL1') lA = 0;
    if (arms === 'waveL2') lA = 1;
    if (arms === 'reach') { lA = 1; rA = 1; }
    if (arms === 'smokeUp') rA = 1; // rechte Hand am Gesicht
    if (arms === 'sip') lA = 0;     // Becher anheben
    if (arms === 'cheer') { lA = 0; rA = 0; }
    if (arms === 'danceL') { lA = 0; rA += 2; }
    if (arms === 'danceR') { rA = 0; lA += 2; }
    if (arms === 'droop') { lA += 2; rA += 2; }
    rect(g, 0, lA, 4, lA + 9, paint(lA + 9, lA));
    rect(g, 25, rA, 29, rA + 9, paint(rA + 9, rA, 29));
    if (arms === 'wave1') set(g, [[29, rA], [29, rA + 1]], '.'); // Hand kippt beim Winken
    if (arms === 'waveL1') set(g, [[0, lA], [0, lA + 1]], '.');
    // Körper
    const top = 6 + by + breathe - lift;
    rect(g, 5, top, 24, 17, paint(17, top));
    for (let y = rA + 10; y < 17; y++) set(g, [[24, y]], 'w'); // Schattenkante unterhalb des rechten Arms
    // Beine
    const legTop = 18;
    const legLift = (i) => (feet === 'step1' && i % 2 === 0) || (feet === 'step2' && i % 2 === 1) ? 1 : 0;
    if (feet !== 'none') {
      [5, 10, 17, 22].forEach((x, i) => rect(g, x, legTop, x + 2, 22 - legLift(i), paint(22 - legLift(i), -1, x + 2)));
    } else {
      [5, 10, 17, 22].forEach((x) => rect(g, x, legTop, x + 2, 19, paint(19)));
    }
    // Augen
    const ey = 8 + by + breathe - lift;
    [7, 20].forEach((x) => {
      if (eye === 'closed') rect(g, x, ey + 2, x + 2, ey + 2, 'e');
      // Zwinkern: links offen (fest), rechts zu
      else if (eye === 'wink') { if (x === 20) rect(g, x, ey + 2, x + 2, ey + 2, 'e'); else rect(g, x, ey, x + 2, ey + 2, 'e'); }
      else if (eye === 'sleepy') { rect(g, x, ey, x + 2, ey, 'w'); rect(g, x, ey + 1, x + 2, ey + 2, 'e'); }
      else if (eye === 'wide') rect(g, x, ey - 1, x + 2, ey + 2, 'e');
      else if (eye === 'dizzy') set(g, [[x, ey], [x + 2, ey], [x + 1, ey + 1], [x, ey + 2], [x + 2, ey + 2]], 'e');
      else if (eye === 'happy') {
        // fröhlich: Augen zusammengekniffen (flach, mit Glanzpunkt) und rote Bäckchen
        rect(g, x, ey + 1, x + 2, ey + 2, 'e');
        set(g, [[x, ey + 1]], 'H');
        set(g, [[x, ey + 4], [x + 1, ey + 4], [x + 2, ey + 4]], 'P');
      }
      else if (eye === 'angry') rect(g, x, ey + 1, x + 2, ey + 2, 'e');
      else rect(g, x, ey, x + 2, ey + 2, 'E');
    });
    // Mund beim Reden
    if (beak > 0) rect(g, 13, 13 + by - lift, 16, 12 + by - lift + beak, beak > 1 ? (x, y) => (y === 14 + by - lift ? 't' : 'm') : 'm');
    return finish(g, by + breathe - lift, false);
  }
  // Mini-Claude bekommt Tiefe: Licht von links oben (o), Schatten rechts unten (q). So sieht er auch in jeder Farbe
  // nicht mehr einfarbig flach aus (die Farbvarianten verschieben helle und dunkle Töne unterschiedlich).
  function shadeClaude(rows) {
    const at = (x, y) => (rows[y] && rows[y][x]) || '.';
    const out = rows.map((line, y) => [...line].map((ch, x) => {
      if (ch !== 'W') return ch;
      const up = at(x, y - 1), left = at(x - 1, y), down = at(x, y + 1), right = at(x + 1, y);
      if (left === '.' || x === 0) return 'o';                         // Lichtkante links
      if ((up === 'h' || up === '.') && x < 18) return 'o';             // Licht oben links
      if (down === 'w' && right === 'w') return 'q';                    // Schattenecke rechts unten
      if (down === 'w' && (x + y) % 2 === 0 && y > 12) return 'w';      // weicher Übergang zum Schatten unten
      return ch;
    }).join(''));
    for (const k of Object.keys(rows)) if (Number.isNaN(Number(k))) out[k] = rows[k];
    return out;
  }
  const claude = {
    name: 'Mini-Claude',
    variantTweaks: { mitternacht: { h: 234, sMul: 0.75, lMul: 0.62, lAdd: 0.04, shift: 1.6 } },
    palette: { W: '#d9654c', w: '#b54c37', v: '#9c412f', h: '#f09a80', o: '#e8846a', q: '#97402c', E: '#151112', e: '#151112', m: '#3a1712', t: '#e9917f', P: '#f29a86' },
    frames: Object.fromEntries(Object.entries(framesOf(miniClaude)).map(([k, f]) => [k, shadeClaude(f)])),
    eye: { positions: [[7, 8], [20, 8]], pattern: ['HEE', 'EEE', 'EEE'] }, // kleiner Glanzpunkt oben links
    eyeBg: 'W',
    front: true,
    arms: true,
    thinks: true, // denkt mit, wenn ein Claude-Fenster vorne ist
    laptop: true, // tippt auf einem Laptop statt auf der Mini-Tastatur, trinkt Kaffee
    voice: 'blip',
    idleActions: ['wave', 'yawn', 'stretch', 'idea', 'look', 'dance', 'mushroom', 'wink', 'bounce', 'sneeze', 'spin', 'coffee', 'pushups', 'moonwalk', 'breakdance', 'handstand', 'roll', 'boxing', 'selfie', 'phone', 'newspaper', 'fart'],
    typingFrames: ['tapL', 'tapR'],
    anchors: { mouth: [16, 13], hand: [28, 11], keyboard: [8, 16], tap: [15, 17], idea: [13, -7], lens: [26, 4], mushroom: [-9, 16], snore: [17, 11],
      hat: [15, 7], umbrella: [9, -11], glasses: [6, 7], laptop: [4, 11], mug: [-8, 8] },
    width: CW,
    height: CH,
    scale: 3,
    display: 3.75, // auf dem Bildschirm so groß wie die anderen Figuren (~75 px hoch)
  };

  // ---------------------------------------------------------------------------------------------
  // Kleine Viecher (Vorderansicht), Raster 24 x 22. Jede Figur beschreibt nur Körper, Augen,
  // Arme und Füße; Posen, Augenausdrücke und Mund kommen für alle aus derselben Funktion.
  const VW = 24;
  const VH = 22;
  const body = tone('W', 'w', 'v', 'h');

  function critter(cfg) {
    const GW = cfg.w || VW;
    const GH = cfg.h || VH;
    return function draw({ beak = 0, eye = 'open', feet = 'stand', wing = 'down', headDy = 0, sit = false, arms = 'down' }) {
      const g = grid(GW, GH);
      const by = sit ? 1 : 0;
      const breathe = headDy > 0 && !sit ? 1 : 0;
      const lift = headDy < 0 ? 1 : 0;
      const hy = by + breathe - lift; // Kopf/Gesicht wandert beim Atmen, Strecken und Sitzen mit
      // Tippen: manche Viecher watscheln oder wackeln dabei
      const typing = arms === 'tapL' ? 1 : arms === 'tapR' ? 2 : 0;
      const step = feet === 'step1' ? 1 : feet === 'step2' ? 2 : cfg.waddle ? typing : 0;
      const o = { hy, by, sit, step, typing, eye, wiggle: step || typing || wing === 'up' ? 1 : 0 };
      cfg.shape(g, o);

      // Arme / Pfoten: Höhe je nach Pose
      if (cfg.arms) {
        const [lx, rx, ay, aw, ah] = cfg.arms;
        let l = ay + by + breathe;
        let r = l;
        const up = ay - 4;
        if (wing === 'up' || arms === 'cheer') { l = up; r = up; }
        if (arms === 'tapL') l += 2;
        if (arms === 'tapR') r += 2;
        if (arms === 'wave1') r = up;
        if (arms === 'wave2') r = up + 1;
        if (arms === 'waveL1') l = up;
        if (arms === 'waveL2') l = up + 1;
        if (arms === 'reach') { l = up + 1; r = up + 1; }
        if (arms === 'smokeUp') r = up + 1; // rechte Hand am Gesicht
        if (arms === 'sip') l = up + 1;     // Becher anheben
        if (arms === 'danceL') { l = up; r += 1; }
        if (arms === 'danceR') { r = up; l += 1; }
        if (arms === 'droop') { l += 1; r += 1; }
        const key = cfg.armKey || 'W';
        rect(g, lx, l, lx + aw - 1, l + ah - 1, key);
        rect(g, rx, r, rx + aw - 1, r + ah - 1, (x) => (key === 'W' && x === rx + aw - 1 ? 'w' : key));
      }

      // Füße
      if (cfg.feet && feet !== 'none' && !sit) {
        cfg.feet.forEach(([x, w], i) => {
          const up = (step === 1 && i === 0) || (step === 2 && i === 1) ? 1 : 0;
          rect(g, x, GH - 1 - up, x + w - 1, GH - 1 - up, cfg.footKey || 'w');
        });
      }

      // Augen
      const { xs, y, w: ew, h: eh } = cfg.eyes;
      const ey = y + hy;
      const shut = cfg.shutKey || 'e';
      xs.forEach((x, i) => {
        const line = (yy) => rect(g, x, yy, x + ew - 1, yy, shut);
        if (eye === 'closed' || (eye === 'wink' && i === 1)) line(ey + eh - 1);
        else if (eye === 'wink') rect(g, x, ey, x + ew - 1, ey + eh - 1, 'e');
        else if (eye === 'sleepy') rect(g, x, ey + eh - 1, x + ew - 1, ey + eh - 1, shut);
        else if (eye === 'wide') { rect(g, x, ey - 1, x + ew - 1, ey + eh - 1, 'e'); set(g, [[x, ey - 1]], 'H'); }
        else if (eye === 'dizzy') set(g, [[x, ey], [x + ew - 1, ey + eh - 1], [x + ew - 1, ey], [x, ey + eh - 1]], shut);
        else if (eye === 'happy') {
          set(g, [[x, ey + eh - 1], [x + ew - 1, ey + eh - 1]], shut);
          rect(g, x, ey + eh - 2, x + ew - 1, ey + eh - 2, shut);
          if (cfg.cheeks) set(g, [[cfg.cheeks[i], ey + eh + 1]], 'P');
        } else if (eye === 'angry') { rect(g, x, ey + 1, x + ew - 1, ey + eh - 1, 'e'); }
        else rect(g, x, ey, x + ew - 1, ey + eh - 1, 'E');
      });

      // Mund: geschlossen je Figur, beim Reden offen
      const [mx, my] = cfg.mouth;
      if (beak > 0) {
        rect(g, mx, my + hy, mx + 1, my + hy, 'm');
        if (beak > 1) rect(g, mx, my + hy + 1, mx + 1, my + hy + 1, 't');
      } else if (cfg.face) cfg.face(g, o);
      return finish(g, hy, !cfg.noOutline);
    };
  }

  // Sonnenbrille passend zu den Augen
  function glassesFor({ xs, w }) {
    const from = xs[0] - 1;
    const width = xs[1] + w + 1 - from;
    const rows = [Array(width).fill('K'), Array(width).fill('.'), Array(width).fill('.')];
    for (const x of xs) {
      for (let i = x - 1; i <= x + w; i++) { rows[1][i - from] = 'K'; rows[2][i - from] = 'K'; }
      rows[1][x - from] = 's';
      rows[2][x - 1 - from] = '.';
    }
    return rows.map((r) => r.join(''));
  }

  const BOO = [
    '...........XXXXXX...............',
    '.........XXWWWWwwXX.............',
    '........XWWWWWWWwwwX............',
    '.......XWWWWWWWWwwwwX...........',
    '......XWWWWWWWWWWWwwwX..........',
    '.....XWWWWWWWWWWWWwwwX..........',
    '.....XWWWWWWWWWWWWWwwwX.........',
    '.....XWWWWWWWWWWWWWwwwX.........',
    '.....XWWWWWWWWWWWWWwwwX.........',
    '...XXXWWWWWWWWWWWWWwwwX.........',
    '..XWWWWWWWWWWWWXXXXwwwwX........',
    '.XWWWWwWWWWWWWXWWWWXwwwX........',
    'XWWWWwwWWWWWWXWWWWWWwwwX........',
    'XWWWWwwWWWWWWXWWWWWWWwwX........',
    'XWWWwwwWWWWWWXWWWWWWWwwX........',
    'XWWwwwwWWWWWWXXXWWWWWwwX........',
    'XXXXwwwWWwWWWwXwXXWWWWwwX.......',
    '.XwwXwwWWwWWWWXwwXWWWWwwX.......',
    '..XwXwwWWwWWWwwXwXWWwWwwX.......',
    '...XXwwWWwWWWwwXwXWWwwwwX.......',
    '....XwwWWwWWWwwXwXWWwwwwX.......',
    '....XwwWWwWWWwwwwXWWwwwwwX......',
    '....XwwWWwWWWwwwwXWWwwwwwX......',
    '....XwwWWwWWWwwwwwWWwwwwwX......',
    '....XwwWwwWWWwwwwwWWwwwwwwX.....',
    '....XwXXXXXWWwwwwwwWwwwwwwwX....',
    '....XXwwwwXXwwwwwwwWwwwwwwwX....',
    '....XXwwwwXwXwwwwwwwwwwwwwwwX...',
    '.....XXXXvvXXXXXXwwwwwwwwwwwwX..',
    '..........XX.....XXXXXXXXXXXXXX.',
  ];

  // Klein-Version der Dosen für Größen bis 80 %: gleiche Aufteilung, gröbere Pixel, Schrift 3 x 5 (bei 60 % genau 1:1 Pixel)
  const CAN_SMALL = {"orangi": {"original": {"rows": ["..........QQNNNNNM.........", "....KNQQNNNQNNNQNNMMMGC....", "...JJLNNNNNRLJLRNNNNMGCD...", "...KNRRSRNMMMLMMLLKJJGKG...", "..JLQSSSQNNMLLLMMLKKJJLGC..", "..KMQSSSRQNNMMMNMMLKJJLGCB.", ".GJLQSSSQNNMLLLMMLKJJJLGCA.", ".FFFIOOOIIIIIIIIIFFFFFFFAA.", ".F555O55III5II55III55F555A.", ".F5I5O5O5I5I5I5I5I5FFF5FAA.", ".F5I5O55II555I5I5I5F5F55AA.", ".F5I5O5O5I5I5I5I5I5F5F5FAA.", ".F555O5O5I5I5I5I5II55F555A.", ".FFIIOOOIIIIIIIIIIIFFFFFAA.", ".FFIIOOOIIIIIIIIIIIFFFFFAA.", ".GJLQSSSQNNMLLLMMLKJJJLGCA.", ".GJLQSSSQNNMLCCCCCKBBADBCA.", ".GJLQSSSQNNMLCCCCCKBBADBCA.", ".GJLQSSSQNNMLC6C6CKBB66BCA.", ".GJLQSSSQNNMLC6C6CKB6ADBCA.", ".GJLQSSSQNNMLC66CCKBB6DBCA.", ".GJLQSSSQNNMLC6C6CKBBA6BCA.", ".GJLQSSSQNNMLC6C6CKB66DBCA.", ".GJLQSSSQNNMLCCCCCKBBADBCA.", ".GJLQSSSQNNMLC666CKB666BCA.", ".GJLQSSSQNNMLC6C6CKBB6DBCA.", ".GJLQSSSQNNMLC6C6CKBB6DBCA.", ".GJLQSSSQNNMLC6C6CKBB6DBCA.", ".GJLQSSSQNNMLC666CKBB6DBCA.", ".GJLQSSSQNNMLCCCCCKBBADBCA.", ".GJLQSSSQNNMLC66CCKB66DBCA.", ".GJLQSSSQNNMLC6C6CKB6A6BCA.", ".GJLQSSSQNNMLC6C6CKB66DBCA.", ".GJLQSSSQNNMLC6C6CKB6A6BCA.", ".GJLQSSSQNNMLC6C6CKB6A6BCA.", ".GJLQSSSQNNMLCCCCCKBBADBCA.", ".GJLQSSSQNNMLCC66CKB666BCA.", ".GJLQSSSQNNMLC6CCCKB6A6BCA.", ".GJIQSSSQNNMLC6C6CKB6A6BCA.", ".GJLQSSSQNNMLC6C6CKB6A6BCA.", ".GILISSSQNNMLCC66CKB666BCA.", ".GJLQSSSQNNMLCCCCCKBBADBCA.", ".GJIQOSSQNNMLCCCCCKB66DBCA.", ".GJLQSSSQNNMLCCCCCKB6A6BCA.", ".GILISRSQNNMLCCCCCKB6A6BCA.", ".GJLQSSSQNNMLCCCCCKB6A6BCA.", ".GJIQOSOQNNMLCCCCCKB6A6BCA.", ".GJLQSSSQNNMLCCCCCKBBADBCA.", ".GILISRSINNMLCCCCCKBB66BCA.", ".GJLQSSSQNNMLCCCCCKB6ADBCA.", ".GJIQOSOQINMLCCCCCKB6A6BCA.", ".GJLQSSSQNNMLCCCCCKB6A6BCA.", ".GILISRSINIMLCCCCCKBB66BCA.", ".GJLQSSSQNNMLCCCCCKBBADBCA.", ".GJIQOSOQINILCCCCCKBBADBCA.", ".GJLQSSSQNNMLLLMMLKJJJLGCA.", ".GJKQSSSQNMMLKLLLLKJJGKGCA.", ".DGJMSSRNLKJJJJJJJJGGGJDBA.", "...JMSSRNLKJJJJJJJJGGGJD...", "..........................."], "palette": {"A": "#302b26", "B": "#2f3233", "C": "#3a3d3e", "D": "#434446", "F": "#995514", "G": "#626465", "I": "#d9791e", "J": "#7c7e81", "K": "#8c8e90", "L": "#929597", "M": "#9c9fa0", "N": "#aaadae", "O": "#fece70", "Q": "#c0c3c5", "R": "#e0e2de", "S": "#fbfbfc", "5": "#fcfcfa", "6": "#f2f4f4", "X": "#2b2e2d", "x": "#4f5553", "E": "#15161b", "e": "#15161b", "P": "#ffb0a0", "m": "#3a1a10", "t": "#ff8a6a", "H": "#ffffff", "v": "#c0c3c5"}, "mug": ["Q", "J"]}, "blau": {"rows": ["..........OOMMMMML.........", "....KMQOMMMQMMMQMMMLLID....", "...IIKMMMMMQKIKQMMMMLICD...", "...KORRSQMLLLLLLKKKIIIKD...", "..KKOSSSQOMLKKLLLKKKIIKIC..", "..KLQSSSQOOMLLLMMLLKKILIDB.", ".IIKOSSSQOMLKKLLLKKKIIKICB.", ".FFFGNQNGGGGGGGGGFFFFFFFAA.", ".FFG55QN555G55GG55GF5F5FAA.", ".FFG5N5N5GGG5G5G5G5F5F5FAA.", ".FFG55QN55GG55GG55GFF5FFAA.", ".FFG5N5N5GGG5G5G5G5FF5FFAA.", ".FFG55QN555G5G5G5G5FF5FFAA.", ".FFGGNQNJGGGGGGGGGGFFFFFAA.", ".FFGGNQNJGGGGGGGGGGFFFFFAA.", ".IIKOSSSQOMLKKKLLKKKIIKDCB.", ".IIKOSSSQOMLKDCCCCKBBBDBCB.", ".IIKOSSSQOMLKDCCCCKBBBDBCB.", ".IIKOSSSQOMLKD6C6CKBB66BCB.", ".IIKOSSSQOMLKD6C6CKB6BDBCB.", ".IIKOSSSQOMLKD66CCKBB6DBCB.", ".IIKOSSSQOMLKD6C6CKBBB6BCB.", ".IIKOSSSQOMLKD6C6CKB66DBCB.", ".IIKOSSSQOMLKDCCCCKBBBDBCB.", ".IIKOSSSQOMLKD666CKB666BCB.", ".IIKOSSSQOMLKD6C6CKBB6DBCB.", ".IIKOSSSQOMLKD6C6CKBB6DBCB.", ".IIKOSSSQOMLKD6C6CKBB6DBCB.", ".IIKOSSSQOMLKD666CKBB6DBCB.", ".IIKOSSSQOMLKDCCCCKBBBDBCB.", ".IIKOSSSQOMLKD66CCKB66DBCB.", ".IIKOSSSQOMLKD6C6CKB6B6BCB.", ".IIKOSSSQOMLKD6C6CKB66DBCB.", ".IIKOSSSQOMLKD6C6CKB6B6BCB.", ".IIKOSSSQOMLKD6C6CKB6B6BCB.", ".IIKOSSSQOMLKDCCCCKBBBDBCB.", ".IIKOSSSQOMLKDC66CKB666BCB.", ".IIKOSSSQOMLKD6CCCKB6B6BCB.", ".IIGOSSSQOMLKD6C6CKB6B6BCB.", ".IIKOSSSQOMLKD6C6CKB6B6BCB.", ".IGKJSSSQOMLKDC66CKB666BCB.", ".IIKOSSSQOMLKDCCCCKBBBDBCB.", ".IIGONSSQOMLKDCCCCKB66DBCB.", ".IIKOSSSQOMLKDCCCCKB6B6BCB.", ".IGKJSRSQOMLKDCCCCKB6B6BCB.", ".IIKOSSSQOMLKDCCCCKB6B6BCB.", ".IIGONSNQOMLKDCCCCKB6B6BCB.", ".IIKOSSSQOMLKDCCCCKBBBDBCB.", ".IGKJSRSJOMLKDCCCCKBB66BCB.", ".IIKOSSSQOMLKDCCCCKB6BDBCB.", ".IIGONSNQJMLKDCCCCKB6B6BCB.", ".IIKOSSSQOMLKDCCCCKB6B6BCB.", ".IGKJSRSJOJLKDCCCCKBB66BCB.", ".IIKOSSSQOMLKDCCCCKBBBDBCB.", ".IIGONSNQJMJKDCCCCKBBBDBCB.", ".IIKOSSSQOMLKKKLLKKKIIKDCB.", ".IIKOSSSOMMLKKKKKKKIIIKDCB.", ".DIILSSRMKKIIIIIIIIIIIIDBB.", "...ILSSRMKKIIIIIIIIIIIID...", "..........................."], "palette": {"A": "#0d2347", "B": "#2d2f30", "C": "#393c3d", "D": "#414445", "F": "#1f4889", "G": "#265fba", "I": "#717375", "J": "#417ede", "K": "#8f9294", "L": "#9b9ea0", "M": "#a8aaac", "N": "#77b3fa", "O": "#b6b9ba", "Q": "#c7ced2", "R": "#e1e6e6", "S": "#fbfbfc", "5": "#fcfcfa", "6": "#f2f4f4", "X": "#2b2e2d", "x": "#4f5553", "E": "#15161b", "e": "#15161b", "P": "#ffb0a0", "m": "#3a1a10", "t": "#ff8a6a", "H": "#ffffff", "v": "#b6b9ba"}, "mug": ["Q", "I"]}, "gruen": {"rows": ["..........QQOOOOOM.........", "....LOQQOOOQOOOQOOMMMJF....", "...KKLOOOOORLKLROOOOMJDF...", "...LORRSROMMMMMMLLLKKJLJ...", "..KLQSSSQOOMLLMMMLLKKKLJD..", "..LMQSSSRQOOMMMOMMLLKKLJFC.", ".JKLQSSSQOOMLLLMMLLKKKLJDB.", ".GGGINRNIIIIIIIIGGGGGGGGBB.", ".GGGIN5NII555I5I5I555GGGBB.", ".GGGIN5NIII5II555I5GGGGGBB.", ".GGGIN5NIII5II555I55GGGGBB.", ".GGGIN5NIII5II5I5I5GGGGGBB.", ".GGGIN555I555I5I5I555GGGBB.", ".GGGINRNIIIIIIIIIIGGGGGGBB.", ".GGGINRNIIIIIIIIIIGGGGGGBB.", ".JKLQSSSQOOMLLLMMLLKKKLJDB.", ".JKLQSSSQOOMLFFDDDLCCBFCDB.", ".JKLQSSSQOOMLFFDDDLCCBFCDB.", ".JKLQSSSQOOMLF6D6DLCC66CDB.", ".JKLQSSSQOOMLF6D6DLC6BFCDB.", ".JKLQSSSQOOMLF66DDLCC6FCDB.", ".JKLQSSSQOOMLF6D6DLCCB6CDB.", ".JKLQSSSQOOMLF6D6DLC66FCDB.", ".JKLQSSSQOOMLFFDDDLCCBFCDB.", ".JKLQSSSQOOMLF666DLC666CDB.", ".JKLQSSSQOOMLF6D6DLCC6FCDB.", ".JKLQSSSQOOMLF6D6DLCC6FCDB.", ".JKLQSSSQOOMLF6D6DLCC6FCDB.", ".JKLQSSSQOOMLF666DLCC6FCDB.", ".JKLQSSSQOOMLFFDDDLCCBFCDB.", ".JKLQSSSQOOMLF66DDLC66FCDB.", ".JKLQSSSQOOMLF6D6DLC6B6CDB.", ".JKLQSSSQOOMLF6D6DLC66FCDB.", ".JKLQSSSQOOMLF6D6DLC6B6CDB.", ".JKLQSSSQOOMLF6D6DLC6B6CDB.", ".JKLQSSSQOOMLFFDDDLCCBFCDB.", ".JKLQSSSQOOMLFF66DLC666CDB.", ".JKLQSSSQOOMLF6DDDLC6B6CDB.", ".JKIQSSSQOOMLF6D6DLC6B6CDB.", ".JKLQSSSQOOMLF6D6DLC6B6CDB.", ".JILISSSQOOMLFF66DLC666CDB.", ".JKLQSSSQOOMLFFDDDLCCBFCDB.", ".JKIQNSSQOOMLFFDDDLC66FCDB.", ".JKLQSSSQOOMLFFDDDLC6B6CDB.", ".JILISRSQOOMLFFDDDLC6B6CDB.", ".JKLQSSSQOOMLFFDDDLC6B6CDB.", ".JKIQNSNQOOMLFFDDDLC6B6CDB.", ".JKLQSSSQOOMLFFDDDLCCBFCDB.", ".JILISRSNOOMLFFDDDLCC66CDB.", ".JKLQSSSQOOMLFFDDDLC6BFCDB.", ".JKIQNSNQIOMLFFDDDLC6B6CDB.", ".JKLQSSSQOOMLFFDDDLC6B6CDB.", ".JILISRSNOIMLFFDDDLCC66CDB.", ".JKLQSSSQOOMLFFDDDLCCBFCDB.", ".JKIQNSNQIOILFFDDDLCCBFCDB.", ".JKLQSSSQOOMLLLMMLLKKKLJDB.", ".JKLQSSSQOMMLLLLLLLKKJLJDB.", ".JJKMSSROLLKKKKKKKKJJJKFCB.", "...KMSSROLLKKKKKKKKJJJKF...", "..........................."], "palette": {"A": "#000000", "B": "#272e26", "C": "#2f3233", "D": "#393b3d", "F": "#3e4143", "G": "#3c7922", "I": "#53a72f", "J": "#626365", "K": "#7c7e81", "L": "#909395", "M": "#9c9ea0", "N": "#9ceb77", "O": "#aaadae", "Q": "#c0c3c4", "R": "#dee3dd", "S": "#fbfbfc", "5": "#fcfcfa", "6": "#f2f4f4", "X": "#2b2e2d", "x": "#4f5553", "E": "#15161b", "e": "#15161b", "P": "#ffb0a0", "m": "#3a1a10", "t": "#ff8a6a", "H": "#ffffff", "v": "#c0c3c4"}, "mug": ["Q", "K"]}, "lila": {"rows": ["..........QQNNNNNM.........", "....KNQQNNNQNNNQNNMMMGD....", "...JJLNNNNNRLJLRNNNNMGDD...", "...KNRRSRNMMMLMMLLKJJGKG...", "..JLQSSSQNNMLLLMMLKKJJLGD..", "..KMQSSSRQNNMMMNMMLKJJLGDC.", ".GJLQSSSQNNMLLLMMLKJJJLGDB.", ".FFFIOROIIIIIIIIFFFFFFFFAA.", ".FFFI55O55III5II55FF555FAA.", ".FFF5ORO5I5I5I5I5I5F5FFFAA.", ".FFF5O5O55II555I55FF55FFAA.", ".FFF5O5O5I5I5I5I5IFF5FFFAA.", ".FFFI55O5I5I5I5I5IFF555FAA.", ".FFFIOROIIIIIIIIIIFFFFFFAA.", ".FFFIOROIIIIIIIIIIFFFFFFAA.", ".GJLQSSSQNNMLLLMMLKJJJLGDB.", ".GJLQSSSQNNMLDDDDDKCCBDCDB.", ".GJLQSSSQNNMLDDDDDKCCBDCDB.", ".GJLQSSSQNNMLD6D6DKCC66CDB.", ".GJLQSSSQNNMLD6D6DKC6BDCDB.", ".GJLQSSSQNNMLD66DDKCC6DCDB.", ".GJLQSSSQNNMLD6D6DKCCB6CDB.", ".GJLQSSSQNNMLD6D6DKC66DCDB.", ".GJLQSSSQNNMLDDDDDKCCBDCDB.", ".GJLQSSSQNNMLD666DKC666CDB.", ".GJLQSSSQNNMLD6D6DKCC6DCDB.", ".GJLQSSSQNNMLD6D6DKCC6DCDB.", ".GJLQSSSQNNMLD6D6DKCC6DCDB.", ".GJLQSSSQNNMLD666DKCC6DCDB.", ".GJLQSSSQNNMLDDDDDKCCBDCDB.", ".GJLQSSSQNNMLD66DDKC66DCDB.", ".GJLQSSSQNNMLD6D6DKC6B6CDB.", ".GJLQSSSQNNMLD6D6DKC66DCDB.", ".GJLQSSSQNNMLD6D6DKC6B6CDB.", ".GJLQSSSQNNMLD6D6DKC6B6CDB.", ".GJLQSSSQNNMLDDDDDKCCBDCDB.", ".GJLQSSSQNNMLDD66DKC666CDB.", ".GJLQSSSQNNMLD6DDDKC6B6CDB.", ".GJIQSSSQNNMLD6D6DKC6B6CDB.", ".GJLQSSSQNNMLD6D6DKC6B6CDB.", ".GILISSSQNNMLDD66DKC666CDB.", ".GJLQSSSQNNMLDDDDDKCCBDCDB.", ".GJIQOSSQNNMLDDDDDKC66DCDB.", ".GJLQSSSQNNMLDDDDDKC6B6CDB.", ".GILISSSQNNMLDDDDDKC6B6CDB.", ".GJLQSSSQNNMLDDDDDKC6B6CDB.", ".GJIQOSOQNNMLDDDDDKC6B6CDB.", ".GJLQSSSQNNMLDDDDDKCCBDCDB.", ".GILISSSONNMLDDDDDKCC66CDB.", ".GJLQSSSQNNMLDDDDDKC6BDCDB.", ".GJIQOSOQINMLDDDDDKC6B6CDB.", ".GJLQSSSQNNMLDDDDDKC6B6CDB.", ".GILISSSONIMLDDDDDKCC66CDB.", ".GJLQSSSQNNMLDDDDDKCCBDCDB.", ".GJIQOSOQINILDDDDDKCCBDCDB.", ".GJLQSSSQNNMLLLMMLKJJJLGDB.", ".GJKQSSSQNMMLKLLLLKJJGKGDB.", ".GGJMSSRNLKJJJJJJJJGGGJDCB.", "...JMSSRNLKJJJJJJJJGGGJD...", "..........................."], "palette": {"A": "#2a133c", "B": "#2a2b2c", "C": "#2f3233", "D": "#3b3e3f", "F": "#572b7b", "G": "#626365", "I": "#753ba6", "J": "#7c7e81", "K": "#8c8e90", "L": "#929597", "M": "#9c9fa0", "N": "#aaadae", "O": "#c084eb", "Q": "#c0c3c5", "R": "#dfdde1", "S": "#fbfafc", "5": "#fcfcfa", "6": "#f2f4f4", "X": "#2b2e2d", "x": "#4f5553", "E": "#15161b", "e": "#15161b", "P": "#ffb0a0", "m": "#3a1a10", "t": "#ff8a6a", "H": "#ffffff", "v": "#c0c3c5"}, "mug": ["Q", "J"]}, "rosa": {"rows": ["..........OONNNNNM.........", "....KNOONNNONNNONNMMMGD....", "...IILNNNNNRLILRNNNNMGCD...", "...KNRRSRNMMMLMMLLKIIGKG...", "..ILOSSSONNMLLLMMLKKIILGC..", "..KMOSSSRONNMMMMMMLKIILGDB.", ".GILOSSSONNMLLLMMLKIIILGCA.", ".FFJJQRQJJJJJJJJJJJFFFFFCA.", ".FJJJQ55JJ555J55JJ5J5FJFCA.", ".FJJJQ5Q5JJ5JJ5J5J5J5FJFCA.", ".FJJJQ55JJJ5JJ5J5J55FFJFCA.", ".FJJJQ5QJJJ5JJ5J5J5J5FJFCA.", ".FJJJQ5QJJ555J5J5J5J5FJFCA.", ".FJJJQSQJJJJJJJJJJJJFFJFCA.", ".FJJJQSQJJJJJJJJJJJJFFJFCA.", ".GILOSSSONNMLLLMMLKIIILGCA.", ".GILOSSSONNMLDDDCCKBBADBCA.", ".GILOSSSONNMLDDDCCKBBADBCA.", ".GILOSSSONNMLD6D6CKBB66BCA.", ".GILOSSSONNMLD6D6CKB6ADBCA.", ".GILOSSSONNMLD66CCKBB6DBCA.", ".GILOSSSONNMLD6D6CKBBA6BCA.", ".GILOSSSONNMLD6D6CKB66DBCA.", ".GILOSSSONNMLDDDCCKBBADBCA.", ".GILOSSSONNMLD666CKB666BCA.", ".GILOSSSONNMLD6D6CKBB6DBCA.", ".GILOSSSONNMLD6D6CKBB6DBCA.", ".GILOSSSONNMLD6D6CKBB6DBCA.", ".GILOSSSONNMLD666CKBB6DBCA.", ".GILOSSSONNMLDDDCCKBBADBCA.", ".GILOSSSONNMLD66CCKB66DBCA.", ".GILOSSSONNMLD6D6CKB6A6BCA.", ".GILOSSSONNMLD6D6CKB66DBCA.", ".GILOSSSONNMLD6D6CKB6A6BCA.", ".GILOSSSONNMLD6D6CKB6A6BCA.", ".GILOSSSONNMLDDDCCKBBADBCA.", ".GILOSSSONNMLDD66CKB666BCA.", ".GILOSSSONNMLD6DCCKB6A6BCA.", ".GIJOSSSONNMLD6D6CKB6A6BCA.", ".GILOSSSONNMLD6D6CKB6A6BCA.", ".GJLJSSSONNMLDD66CKB666BCA.", ".GILOSSSONNMLDDDCCKBBADBCA.", ".GIJOQSSONNMLDDDCCKB66DBCA.", ".GILOSSSONNMLDDDCCKB6A6BCA.", ".GJLJSSSONNMLDDDCCKB6A6BCA.", ".GILOSSSONNMLDDDCCKB6A6BCA.", ".GIJOQSQONNMLDDDCCKB6A6BCA.", ".GILOSSSONNMLDDDCCKBBADBCA.", ".GJLJSSSQNNMLDDDCCKBB66BCA.", ".GILOSSSONNMLDDDCCKB6ADBCA.", ".GIJOQSQOQNMLDDDCCKB6A6BCA.", ".GILOSSSONNMLDDDCCKB6A6BCA.", ".GJLJSSSQNQMLDDDCCKBB66BCA.", ".GILOSSSONNMLDDDCCKBBADBCA.", ".GIJOQSQOQNQLDDDCCKBBADBCA.", ".GILOSSSONNMLLLMMLKIIILGCA.", ".GIKOSSSONMMLKLLLLKIIIKGCA.", ".GGIMSSRNLKIIIIIIIIGGGIDBA.", "...IMSSRNLKIIIIIIIIGGGID...", "..........................."], "palette": {"A": "#2c292c", "B": "#2f3233", "C": "#3b393c", "D": "#3d4042", "F": "#8b325c", "G": "#616364", "I": "#7c7e80", "J": "#c84884", "K": "#8c8e90", "L": "#929597", "M": "#9c9fa0", "N": "#aaadae", "O": "#c0c3c5", "Q": "#fd8fd0", "R": "#dfe0e1", "S": "#fbfafc", "5": "#fcfcfa", "6": "#f2f4f4", "X": "#2b2e2d", "x": "#4f5553", "E": "#15161b", "e": "#15161b", "P": "#ffb0a0", "m": "#3a1a10", "t": "#ff8a6a", "H": "#ffffff", "v": "#c0c3c5"}, "mug": ["O", "I"]}, "gold": {"rows": ["..........OOOOOOOM.........", "....MOOOOOOOOOOOOOOMMID....", "...IIMOOOOOSMIMSOOOOMIDD...", "...MOSSSSOMMMMMMMMMIIIMD...", "..IMOSSSOOOMMMMMMMMIIIMID..", "..MMOSSSSOOOMMMOOMMMIIMIDC.", ".FILOSSROMMLLLLLLLLLIILFCA.", ".FFGJQRQJJJJJJJJJGGGFFGFBB.", ".FGJJQR55J555J5JJJ55GFGFBB.", ".FGJJQ5QJJ5J5J5JJJ5G5FGFBB.", ".FGJJQ5Q5J5J5J5JJJ5G5FGFBB.", ".FGJJQ5Q5J5J5J5JJJ5G5FGFBB.", ".FGJJQR55J555J555J55GFGFBB.", ".FGJJQRQJJJJJJJJJJJGGFGFBB.", ".FGJJQRQJJJJJJJJJJJGGFGFBB.", ".FGGNRSRNNKKGGGKKGGGFFLFBA.", ".FGGNRSRNNKKGDDDDCGCCCDCBA.", ".FGGNRSRNNKKGDDDDCGCCCDCBA.", ".FGGNRSRNNKKGD6D6CGCC66CBA.", ".FGGNRSRNNKKGD6D6CGC6CDCBA.", ".FGGNRSRNNKKGD66DCGCC6DCBA.", ".FGGNRSRNNKKGD6D6CGCCC6CBA.", ".FGGNRSRNNKKGD6D6CGC66DCBA.", ".FGGNRSRNNKKGDDDDCGCCCDCBA.", ".FGGNRSRNNKKGD666CGC666CBA.", ".FGGNRSRNNKKGD6D6CGCC6DCBA.", ".FGGNRSRNNKKGD6D6CGCC6DCBA.", ".FGGNRSRNNKKGD6D6CGCC6DCBA.", ".FGGNRSRNNKKGD666CGCC6DCBA.", ".FGGNRSRNNKKGDDDDCGCCCDCBA.", ".FGGNRSRNNKKGD66DCGC66DCBA.", ".FGGNRSRNNKKGD6D6CGC6C6CBA.", ".FGGNRSRNNKKGD6D6CGC66DCBA.", ".FGGNRSRNNKKGD6D6CGC6C6CBA.", ".FGGNRSRNNKKGD6D6CGC6C6CBA.", ".FGGNRSRNNKKGDDDDCGCCCDCBA.", ".FGGNRSRNNKKGDD66CGC666CBA.", ".FGGNRSRNNKKGD6DDCGC6C6CBA.", ".FGJNRSRNNKKGD6D6CGC6C6CBA.", ".FGGNRSRNNKKGD6D6CGC6C6CBA.", ".FGGNRSRNNKKGDD66CGC666CBA.", ".FGGNRSRNNKKGDDDDCGCCCDCBA.", ".FGJNQSRNNKKGDDDDCGC66DCBA.", ".FGGNRSRNNKKGDDDDCGC6C6CBA.", ".FGGNRRRNNKKGDDDDCGC6C6CBA.", ".FGGNRSRNNKKGDDDDCGC6C6CBA.", ".FGJNQSQNNKKGDDDDCGC6C6CBA.", ".FGGNRSRNNKKGDDDDCGCCCDCBA.", ".FGGNRRRNNKKGDDDDCGCC66CBA.", ".FGGNRSRNNKKGDDDDCGC6CDCBA.", ".FGJNQSQNNKKGDDDDCGC6C6CBA.", ".FGGNRSRNNKKGDDDDCGC6C6CBA.", ".FGGNRRRNNNKGDDDDCGCC66CBA.", ".FGGNRSRNNKKGDDDDCGCCCDCBA.", ".FGJNQSQNNKNGDDDDCGCCCDCBA.", ".FGGNRSRNNKKGGGKKGGGFFLFBA.", ".FGGNRSRNNKKGGGKKGGGFFLFBA.", ".DIIMSSSOMMIIIIIIIIIIIIDCA.", "...IMSSSOMMIIIIIIIIIIIID...", "..........................."], "palette": {"A": "#2d2514", "B": "#413517", "C": "#303334", "D": "#3d4041", "F": "#705b28", "G": "#967c3c", "I": "#747577", "J": "#bc9223", "K": "#ac8e4a", "L": "#978b70", "M": "#97989b", "N": "#c7a85d", "O": "#aeafb1", "Q": "#f9e373", "R": "#fcf1b3", "S": "#eff0e9", "5": "#fcfcfa", "6": "#f2f4f4", "X": "#2b2e2d", "x": "#4f5553", "E": "#15161b", "e": "#15161b", "P": "#ffb0a0", "m": "#3a1a10", "t": "#ff8a6a", "H": "#ffffff", "v": "#c7a85d"}, "mug": ["O", "I"]}, "mitternacht": {"rows": ["..........RRQQRRQQ.........", "....OQRRRQRRRQRRRQQQQNM....", "...OOQQQQQRSQOQSRQQQQNLM...", "...ORSSSSRQQQQQQQQOOONON...", "..OQRSSSRRQQQQQQQQQOOOQNL..", "..OQRSSSSRRQQQQQQQQOOOQNMK.", ".MNNORSROOONNNNNNNNNNMNMJD.", ".AABDNQNICCBBBBBBBBBAAJCAA.", ".ABBFN555C555C55BB555AJCAA.", ".ABBFNQN5C5CCC5B5B5B5AJCAA.", ".ABBFNQ5IC55CC55BB5B5AJCAA.", ".ABBFN5NIC5CCC5B5B5B5AJCAA.", ".ABBFN555C555C5B5B555AJCAA.", ".ABBFNQNICCCCCCBBBBBBAJCAA.", ".ABBFNQNICCCCCCBBBBBBAJCAA.", ".DIJLOROMLLLLKKKKJJIIFLJBA.", ".DIJLOROMLLLLIIGGFJDCCKGBA.", ".DIJLOROMLLLLIIGGFJDCCKGBA.", ".DIJLOROMLLLLI6G6FJDC66GBA.", ".DIJLOROMLLLLI6G6FJD6CKGBA.", ".DIJLOROMLLLLI66GFJDC6KGBA.", ".DIJLOROMLLLLI6G6FJDCC6GBA.", ".DIJLOROMLLLLI6G6FJD66KGBA.", ".DIJLOROMLLLLIIGGFJDCCKGBA.", ".DIJLOROMLLLLI666FJD666GBA.", ".DIJLOROMLLLLI6G6FJDC6KGBA.", ".DIJLOROMLLLLI6G6FJDC6KGBA.", ".DIJLOROMLLLLI6G6FJDC6KGBA.", ".DIJLOROMLLLLI666FJDC6KGBA.", ".DIJLOROMLLLLIIGGFJDCCKGBA.", ".DIJLOROMLLLLI66GFJD66KGBA.", ".DIJLOROMLLLLI6G6FJD6C6GBA.", ".DIJLOROMLLLLI6G6FJD66KGBA.", ".DIJLOROMLLLLI6G6FJD6C6GBA.", ".DIJLOROMLLLLI6G6FJD6C6GBA.", ".DIJLOROMLLLLIIGGFJDCCKGBA.", ".DIJLOROMLLLLII66FJD666GBA.", ".DIJLOROMLLLLI6GGFJD6C6GBA.", ".DIILOROMLLLLI6G6FJD6C6GBA.", ".DIJLOROMLLLLI6G6FJD6C6GBA.", ".DGJLOROMLLLLII66FJD666GBA.", ".DIJLOROMLLLLIIGGFJDCCKGBA.", ".DIILOROMLLLLIIGGFJD66KGBA.", ".DIJLOROMLLLLIIGGFJD6C6GBA.", ".DGJLOROMLLLLIIGGFJD6C6GBA.", ".DIJLOROMLLLLIIGGFJD6C6GBA.", ".DIILOROMLLLLIIGGFJD6C6GBA.", ".DIJLOROMLLLLIIGGFJDCCKGBA.", ".DGJLOROMLLLLIIGGFJDC66GBA.", ".DIJLOROMLLLLIIGGFJD6CKGBA.", ".DIILOROMKLLLIIGGFJD6C6GBA.", ".DIJLOROMLLLLIIGGFJD6C6GBA.", ".DGJLOROMLKLLIIGGFJDC66GBA.", ".DIJLOROMLLLLIIGGFJDCCKGBA.", ".DIILOROMKLKLIIGGFJDCCKGBA.", ".DIJLOROMLLLLKKKKJJIIFLJBA.", ".GJLMOROMMMMMLLLLLKKJJMJCA.", ".MNOQSSSQQOOOOOOOOONNNOMKF.", "...OQSSSQQOOOOOOOOONNNOM...", "..........................."], "palette": {"A": "#0d0e11", "B": "#141519", "C": "#191b1f", "D": "#1e1f23", "F": "#212326", "G": "#232528", "I": "#25272c", "J": "#2a2c31", "K": "#323337", "L": "#34373d", "M": "#41444a", "N": "#626468", "O": "#7b7e83", "Q": "#9ea0a3", "R": "#b4b6ba", "S": "#e8e9e9", "5": "#fcfcfa", "6": "#f2f4f4", "X": "#2b2e2d", "x": "#4f5553", "E": "#f1f2f6", "e": "#f1f2f6", "P": "#ffb0a0", "m": "#3a1a10", "t": "#ff8a6a", "H": "#c9ccd6", "v": "#34373d"}, "mug": ["R", "O"]}}, "monsti": {"original": {"rows": ["..............IGGII.............", "......GLMKJIGJJJJJJGFFDCDB......", "....BCDFFFFFGLDBBDLGFFFFFBAA....", "...CCDFIKJGFFJJJJJJFFFDCCBBBA...", "...CDKSSSMJGFDCCCCDDCCCCBBCCA...", "..CCFLSSSLIIGFDDDDDDDDCCCBCCAA..", "..CDFMSSSMJIIGDDDFFFDDDCCCDCAA..", ".BCDGMSSSNKJIIFFFGGGFFDCCCDCAAA.", ".CDGILSSSQMLLLLLKKJJIIGFDCCDBAA.", ".CFIJMSSSRONNNNNMMLKKJIGFDDFBBA.", ".CGIKNSSSSQQOOONNMMLKJJIGDDFBBA.", ".CGIKNSSSSQQOOONNMMLKJJIGDDFBBA.", ".CG3KNSSSSQQOOONNMMLKJJIGDDF3BA.", ".CGI33SSSSQQOOON43MLKJJIGD53BBA.", ".CGIK33SSSQQOOON3MMLKJJIG33FBBA.", ".CGIKNSSS3QQOO4443MLKJJI3DDFBBA.", ".CGIKNSS3SQQO344443LKJ553DDFBBA.", ".CGIKN77743QOO44443LK5553DDFBBA.", ".CGIKN77743QO344443LK5553DDFBBA.", ".CGIKN77743QOO44443LK5553DDFBBA.", ".CGIKN7773QQOO44443LK55553DFBBA.", ".CGIKN7773QQOO44443LK55553DFBBA.", ".CGIKN7773QQOO4443MLK55553DFBBA.", ".CGIKN3773QQO34443MLK55553DFBBA.", ".CGIKNS773QQOO4443MLK55553DFBBA.", ".CGIKN7773QQOO4443MLK55553DFBBA.", ".CGIKN7773QQO44443MLK55553DFBBA.", ".CGIKN7773QQO444443LK55553DFBBA.", ".CGIKN7773QQO444443LK55553DFBBA.", ".CGIKN7773QQO444443LK55553DFBBA.", ".CGIKN7773QQO33443MLK55553DFBBA.", ".CGIK37773QQOOO4443LK35553DFBBA.", ".CGIKN773SQQO44443MLKJ5553DFBBA.", ".CGIKN3773QQO33443MLK55553DFBBA.", ".CGIKNS773QQOOO443MLK55553DFBBA.", ".CGIKNS773QQO3443MMLK55553DFBBA.", ".CGIKNS773QQOO443MMLK55553DFBBA.", ".CGIKNS773QQOO443MMLK55553DFBBA.", ".CGIKN7773QQOO443MMLK35553DFBBA.", ".CGIKN7773QQOO4443MLKJ5553DFBBA.", ".CGIKN7773QQOO343MMLKJ553DDFBBA.", ".CGIKN7733QQOOO43MMLKJ5553DFBBA.", ".CGIKN73SSQQOOO43MMLKJ5553DFBBA.", ".CGIKN33SSQQOOO3NMMLKJ3553DFBBA.", ".CGIKNS73SQQOOO3NMMLKJJ553DFBBA.", ".CGIKN33SSQQOOO3NMMLKJJ553DFBBA.", ".CGIKNS3SSQQOOON3MMLKJJ553DFBBA.", ".CGIKNS3SSQQOOONNMMLKJJ33DDFBBA.", ".CGIKNS3SSQQOOONNMMLKJJI3DDFBBA.", ".CGIKNS3SSQQOOONNMMLKJJI3DDFBBA.", ".CGIKNS3SSQQOOONNMMLKJJIG3DFBBA.", ".CGIKNSSSSQQOOONNMMLKJJIGDDFBBA.", ".CGIKNSSSSQQOOONNMMLKJJIGDDFBBA.", ".CGIKNSSSSQQOOONNMMLKJJIGDDFBBA.", ".CGIKNSSSSQQOOONNMMLKJJIGDDFBBA.", ".C1I1N111S11OOO11M111J111D11BBA.", ".C111N1S1S1Q1O1NNMM1KJ1IGD1F1BA.", ".C111N1S1S1Q1OO1NMM1KJ11GD11BBA.", ".C1I1N1S1S1Q1OON1MM1KJ1IGD1F1BA.", ".C1I1N111S1Q1O11NMM1KJ111D1F1BA.", ".CGIKNSSSSQQOOONNMMLKJJIGDDFBBA.", ".CGIKNSSSSQQOOONNMMLKJJIGDDFBBA.", ".CGI222S22QQ222N22MLK22I2D2FBBA.", ".CGI2NSS2S2Q2OON2M2L2JJI2D2FBBA.", ".CGI22SS2S2Q22ON22ML2J2IG2DFBBA.", ".CGI2NSS2S2Q2OON2M2L2J2IG2DFBBA.", ".CGI222S2S2Q222N2M2LK22IG2DFBBA.", ".CGIKNSSSSQQOOONNMMLKJJIGDDFBBA.", ".CGIKNSSSSQQOOONNMMLKJJIGDDFBBA.", ".CGIKNSSSSQQOOONNMMLKJJIGDDFBBA.", ".CGIKNSSSSQQOOONNMMLKJJIGDDFBBA.", ".CGIKNSSSSQQOOONNMMLKJJIGDDFBBA.", ".CDIJMSSSRNNMMMMLLKKJJIGDDDDBAA.", ".ABBCIRSQIDDCCCCCCCCCCBBBBCBAAA.", "...BCIRSQIDDCCCCCCCCCCBBBBCBA...", "................................"], "palette": {"A": "#464645", "B": "#656564", "C": "#848585", "D": "#9d9c9b", "F": "#a5a5a4", "G": "#aba9a7", "I": "#b9b8b5", "J": "#c4c2bf", "K": "#cfcdca", "L": "#d8d6d3", "M": "#e1dfdb", "N": "#eae8e4", "O": "#f0eee9", "Q": "#f3f1ed", "R": "#f9f9f9", "S": "#ffffff", "3": "#4b4f56", "4": "#878e9a", "5": "#6f747f", "7": "#afb7c5", "1": "#464b56", "2": "#8c929e", "X": "#2b2e2d", "x": "#4f5553", "E": "#15161b", "e": "#15161b", "P": "#ffb0a0", "m": "#3a1a10", "t": "#ff8a6a", "H": "#ffffff", "q": "#eae8e4"}, "mug": ["D", "B"]}, "blau": {"rows": ["..............QNNQQ.............", "......NQSQQQNQQQQQQNNNNNNI......", "....INNNNNNNNQNIINQNNNNNNIAA....", "...IINNQQQNNNQQQQQQNNNNNNIIIA...", "...INQSSSSQNNNNNNNNNNIIIIIIIA...", "..INNQSSSQQQNNNNNNNNNNNIIINIAA..", "..INNSSSSSQQQNNNNNNNNNNIIINIAA..", ".IINNSSSSSQQQQNNNNNNNNNNIINIAAA.", ".BCDFKRSRMKKKKKJJJJFFFDCCBCGAAA.", ".BDFJMRSROMLLLLLKKKJJFFDDCCGAAA.", ".BDFJMRSROMMMMMLLKKKJJFFDCCGAAA.", ".BDFJMRSROMMMMMLLKKKJJFFDCCGAAA.", ".BD3JMRSROMMMMMLLKKKJJFFDCCG3AA.", ".BDF33RSROMMMMML43KKJJFFDC53AAA.", ".BDFJ33SROMMMMML3KKKJJFFD33GAAA.", ".BDFJMRSR3MMMM4443KKJJFF3CCGAAA.", ".BDFJMRS3OMMM344443KJJ553CCGAAA.", ".BDFJM77743MMM44443KJ5553CCGAAA.", ".BDFJM77743MM344443KJ5553CCGAAA.", ".BDFJM77743MMM44443KJ5553CCGAAA.", ".BDFJM7773MMMM44443KJ55553CGAAA.", ".BDFJM7773MMMM44443KJ55553CGAAA.", ".BDFJM7773MMMM4443KKJ55553CGAAA.", ".BDFJM3773MMM34443KKJ55553CGAAA.", ".BDFJMR773MMMM4443KKJ55553CGAAA.", ".BDFJM7773MMMM4443KKJ55553CGAAA.", ".BDFJM7773MMM44443KKJ55553CGAAA.", ".BDFJM7773MMM444443KJ55553CGAAA.", ".BDFJM7773MMM444443KJ55553CGAAA.", ".BDFJM7773MMM444443KJ55553CGAAA.", ".BDFJM7773MMM33443KKJ55553CGAAA.", ".BDFJ37773MMMMM4443KJ35553CGAAA.", ".BDFJM773OMMM44443KKJJ5553CGAAA.", ".BDFJM3773MMM33443KKJ55553CGAAA.", ".BDFJMR773MMMMM443KKJ55553CGAAA.", ".BDFJMR773MMM3443KKKJ55553CGAAA.", ".BDFJMR773MMMM443KKKJ55553CGAAA.", ".BDFJMR773MMMM443KKKJ55553CGAAA.", ".BDFJM7773MMMM443KKKJ35553CGAAA.", ".BDFJM7773MMMM4443KKJJ5553CGAAA.", ".BDFJM7773MMMM343KKKJJ553CCGAAA.", ".BDFJM7733MMMMM43KKKJJ5553CGAAA.", ".BDFJM73ROMMMMM43KKKJJ5553CGAAA.", ".BDFJM33ROMMMMM3LKKKJJ3553CGAAA.", ".BDFJMR73OMMMMM3LKKKJJF553CGAAA.", ".BDFJM33ROMMMMM3LKKKJJF553CGAAA.", ".BDFJMR3ROMMMMML3KKKJJF553CGAAA.", ".BDFJMR3ROMMMMMLLKKKJJF33CCGAAA.", ".BDFJMR3ROMMMMMLLKKKJJFF3CCGAAA.", ".BDFJMR3ROMMMMMLLKKKJJFF3CCGAAA.", ".BDFJMR3ROMMMMMLLKKKJJFFD3CGAAA.", ".BDFJMRSROMMMMMLLKKKJJFFDCCGAAA.", ".BDFJMRSROMMMMMLLKKKJJFFDCCGAAA.", ".BDFJMRSROMMMMMLLKKKJJFFDCCGAAA.", ".BDFJMRSROMMMMMLLKKKJJFFDCCGAAA.", ".B1F1M111O11MMM11K111J111C11AAA.", ".B111M1S1O1M1M1LLKK1JJ1FDC1G1AA.", ".B111M1S1O1M1MM1LKK1JJ11DC11AAA.", ".B1F1M1S1O1M1MML1KK1JJ1FDC1G1AA.", ".B1F1M111O1M1M11LKK1JJ111C1G1AA.", ".BDFJMRSROMMMMMLLKKKJJFFDCCGAAA.", ".BDFJMRSROMMMMMLLKKKJJFFDCCGAAA.", ".BDF222S22MM222L22KKJ22F2C2GAAA.", ".BDF2MRS2O2M2MML2K2K2JFF2C2GAAA.", ".BDF22RS2O2M22ML22KK2J2FD2CGAAA.", ".BDF2MRS2O2M2MML2K2K2J2FD2CGAAA.", ".BDF222S2O2M222L2K2KJ22FD2CGAAA.", ".BDFJMRSROMMMMMLLKKKJJFFDCCGAAA.", ".BDFJMRSROMMMMMLLKKKJJFFDCCGAAA.", ".BDFJMRSROMMMMMLLKKKJJFFDCCGAAA.", ".BDFJMRSROMMMMMLLKKKJJFFDCCGAAA.", ".BDFJMRSROMMMMMLLKKKJJFFDCCGAAA.", ".BCFJMRSROMMMLLLKKKJJFFDCCCGAAA.", ".AIIIQSSSQNNIIIIIIIIIIIIIIIIAAA.", "...IIQSSSQNNIIIIIIIIIIIIIIIIA...", "................................"], "palette": {"A": "#1d3852", "B": "#27537d", "C": "#336492", "D": "#30689c", "F": "#3673ac", "G": "#4a749b", "I": "#75777a", "J": "#3a7ebc", "K": "#3f88cb", "L": "#438fd6", "M": "#4795dc", "N": "#9b9da2", "O": "#62b0f5", "Q": "#bdbfc4", "R": "#9ae3fe", "S": "#d4fdfd", "3": "#717479", "4": "#cbd0d9", "5": "#a7abb3", "7": "#fbffff", "1": "#f0f4fa", "2": "#cde1f5", "X": "#2b2e2d", "x": "#4f5553", "E": "#15161b", "e": "#15161b", "P": "#ffb0a0", "m": "#3a1a10", "t": "#ff8a6a", "H": "#ffffff", "q": "#438fd6"}, "mug": ["N", "I"]}, "gruen": {"rows": ["..............SSSSS.............", "......SSSSSSSSSSSSSSSSSRSR......", "....RRSSSSSSSSSQQSSSSSSSSROO....", "...RRSSSSSSSSSSSSSSSSSSRRQQQO...", "...RSSSSSSSSSSRRRRRRRRRRRRRRO...", "..RRSSSSSSSSSSSRSSSSSRRRRRRRQO..", "..RRSSSSSSSSSSSSSSSSSSRRRRRRQO..", ".RRSSSSSSSSSSSSSSSSSSSSRRRSRQOO.", ".BCCDNQSROMIIGGGGFFDDDCCCBMOBAA.", ".BCDGORSRONLKJJJJIIGFFDDCCNOBAA.", ".BCDGORSRONMLLLKJJIGGFDDCCNOBAA.", ".BCDGORSRONMLLLKJJIGGFDDCCNOBAA.", ".BC3GORSRONMLLLKJJIGGFDDCCNO3AA.", ".BCD33RSRONMLLLK43IGGFDDCC53BAA.", ".BCDG33SRONMLLLK3JIGGFDDC33OBAA.", ".BCDGORSR3NMLL4443IGGFDD3CNOBAA.", ".BCDGORS3ONML344443GGF553CNOBAA.", ".BCDGO77743MLL44443GG5553CNOBAA.", ".BCDGO77743ML344443GG5553CNOBAA.", ".BCDGO77743MLL44443GG5553CNOBAA.", ".BCDGO7773NMLL44443GG55553NOBAA.", ".BCDGO7773NMLL44443GG55553NOBAA.", ".BCDGO7773NMLL4443IGG55553NOBAA.", ".BCDGO3773NML34443IGG55553NOBAA.", ".BCDGOR773NMLL4443IGG55553NOBAA.", ".BCDGO7773NMLL4443IGG55553NOBAA.", ".BCDGO7773NML44443IGG55553NOBAA.", ".BCDGO7773NML444443GG55553NOBAA.", ".BCDGO7773NML444443GG55553NOBAA.", ".BCDGO7773NML444443GG55553NOBAA.", ".BCDGO7773NML33443IGG55553NOBAA.", ".BCDG37773NMLLL4443GG35553NOBAA.", ".BCDGO773ONML44443IGGF5553NOBAA.", ".BCDGO3773NML33443IGG55553NOBAA.", ".BCDGOR773NMLLL443IGG55553NOBAA.", ".BCDGOR773NML3443JIGG55553NOBAA.", ".BCDGOR773NMLL443JIGG55553NOBAA.", ".BCDGOR773NMLL443JIGG55553NOBAA.", ".BCDGO7773NMLL443JIGG35553NOBAA.", ".BCDGO7773NMLL4443IGGF5553NOBAA.", ".BCDGO7773NMLL343JIGGF553CNOBAA.", ".BCDGO7733NMLLL43JIGGF5553NOBAA.", ".BCDGO73RONMLLL43JIGGF5553NOBAA.", ".BCDGO33RONMLLL3JJIGGF3553NOBAA.", ".BCDGOR73ONMLLL3JJIGGFD553NOBAA.", ".BCDGO33RONMLLL3JJIGGFD553NOBAA.", ".BCDGOR3RONMLLLK3JIGGFD553NOBAA.", ".BCDGOR3RONMLLLKJJIGGFD33CNOBAA.", ".BCDGOR3RONMLLLKJJIGGFDD3CNOBAA.", ".BCDGOR3RONMLLLKJJIGGFDD3CNOBAA.", ".BCDGOR3RONMLLLKJJIGGFDDC3NOBAA.", ".BCDGORSRONMLLLKJJIGGFDDCCNOBAA.", ".BCDGORSRONMLLLKJJIGGFDDCCNOBAA.", ".BCDGORSRONMLLLKJJIGGFDDCCNOBAA.", ".BCDGORSRONMLLLKJJIGGFDDCCNOBAA.", ".B1D1O111O11LLL11J111F111C11BAA.", ".B111O1S1O1M1L1KJJI1GF1DCC1O1AA.", ".B111O1S1O1M1LL1JJI1GF11CC11BAA.", ".B1D1O1S1O1M1LLK1JI1GF1DCC1O1AA.", ".B1D1O111O1M1L11JJI1GF111C1O1AA.", ".BCDGORSRONMLLLKJJIGGFDDCCNOBAA.", ".BCDGORSRONMLLLKJJIGGFDDCCNOBAA.", ".BCD222S22NM222K22IGG22D2C2OBAA.", ".BCD2ORS2O2M2LLK2J2G2FDD2C2OBAA.", ".BCD22RS2O2M22LK22IG2F2DC2NOBAA.", ".BCD2ORS2O2M2LLK2J2G2F2DC2NOBAA.", ".BCD222S2O2M222K2J2GG22DC2NOBAA.", ".BCDGORSRONMLLLKJJIGGFDDCCNOBAA.", ".BCDGORSRONMLLLKJJIGGFDDCCNOBAA.", ".BCDGORSRONMLLLKJJIGGFDDCCNOBAA.", ".BCDGORSRONMLLLKJJIGGFDDCCNOBAA.", ".BCDGORSRONMLLLKJJIGGFDDCCNOBAA.", ".FMNNORSRQOONNNNNNNNNNNNMMOOCBA.", ".QQRRSSSSSSRRRRRRRRRRRRQQQRQOON.", "...RRSSSSSSRRRRRRRRRRRRQQQRQO...", "................................"], "palette": {"A": "#08090a", "B": "#0d0e0f", "C": "#111214", "D": "#141517", "F": "#151618", "G": "#16171a", "I": "#17181b", "J": "#18191c", "K": "#191a1c", "L": "#191a1d", "M": "#1a1b1d", "N": "#1f2022", "O": "#313234", "Q": "#5c5d60", "R": "#76777b", "S": "#b0b1b5", "3": "#335512", "4": "#6db727", "5": "#5a9620", "7": "#93e545", "1": "#e8eaee", "2": "#7acc2c", "X": "#2b2e2d", "x": "#4f5553", "E": "#f1f2f6", "e": "#f1f2f6", "P": "#ffb0a0", "m": "#3a1a10", "t": "#ff8a6a", "H": "#c9ccd6", "q": "#18191c"}, "mug": ["S", "Q"]}, "lila": {"rows": ["..............QQQQQ.............", "......QSSQQQQQQQQQQQQQQNQN......", "....NNQQQQQQQSQGGQSQQQQQQNBA....", "...NNQQQQQQQQQQQQQQQQQQNNGGGB...", "...NQQSSSSQQQNNNNNNNNNNNNGNNB...", "..NNQSSSSSQQQQQNNQQQQNNNNNNNBB..", "..NNQSSSSSQQQQQQQQQQQQNNNNNNCB..", ".NNQQSSSSSQQQQQQQQQQQQQNNNNNCBA.", ".BDDFKRSROKJJJJJIIIFFFDDDCDGBAA.", ".CDFIMRSROMLLLLLLJJIIFFFDDDGBAA.", ".CDFIMRSROMMMMMLLLJJIIFFDDDGBAA.", ".CDFIMRSROMMMMMLLLJJIIFFDDDGBAA.", ".CD3IMRSROMMMMMLLLJJIIFFDDDG3AA.", ".CDF33RSROMMMMML43JJIIFFDD53BAA.", ".CDFI33SROMMMMML3LJJIIFFD33GBAA.", ".CDFIMRSR3MMMM4443JJIIFF3DDGBAA.", ".CDFIMRS3OMMM344443JII553DDGBAA.", ".CDFIM77743MMM44443JI5553DDGBAA.", ".CDFIM77743MM344443JI5553DDGBAA.", ".CDFIM77743MMM44443JI5553DDGBAA.", ".CDFIM7773MMMM44443JI55553DGBAA.", ".CDFIM7773MMMM44443JI55553DGBAA.", ".CDFIM7773MMMM4443JJI55553DGBAA.", ".CDFIM3773MMM34443JJI55553DGBAA.", ".CDFIMR773MMMM4443JJI55553DGBAA.", ".CDFIM7773MMMM4443JJI55553DGBAA.", ".CDFIM7773MMM44443JJI55553DGBAA.", ".CDFIM7773MMM444443JI55553DGBAA.", ".CDFIM7773MMM444443JI55553DGBAA.", ".CDFIM7773MMM444443JI55553DGBAA.", ".CDFIM7773MMM33443JJI55553DGBAA.", ".CDFI37773MMMMM4443JI35553DGBAA.", ".CDFIM773OMMM44443JJII5553DGBAA.", ".CDFIM3773MMM33443JJI55553DGBAA.", ".CDFIMR773MMMMM443JJI55553DGBAA.", ".CDFIMR773MMM3443LJJI55553DGBAA.", ".CDFIMR773MMMM443LJJI55553DGBAA.", ".CDFIMR773MMMM443LJJI55553DGBAA.", ".CDFIM7773MMMM443LJJI35553DGBAA.", ".CDFIM7773MMMM4443JJII5553DGBAA.", ".CDFIM7773MMMM343LJJII553DDGBAA.", ".CDFIM7733MMMMM43LJJII5553DGBAA.", ".CDFIM73ROMMMMM43LJJII5553DGBAA.", ".CDFIM33ROMMMMM3LLJJII3553DGBAA.", ".CDFIMR73OMMMMM3LLJJIIF553DGBAA.", ".CDFIM33ROMMMMM3LLJJIIF553DGBAA.", ".CDFIMR3ROMMMMML3LJJIIF553DGBAA.", ".CDFIMR3ROMMMMMLLLJJIIF33DDGBAA.", ".CDFIMR3ROMMMMMLLLJJIIFF3DDGBAA.", ".CDFIMR3ROMMMMMLLLJJIIFF3DDGBAA.", ".CDFIMR3ROMMMMMLLLJJIIFFD3DGBAA.", ".CDFIMRSROMMMMMLLLJJIIFFDDDGBAA.", ".CDFIMRSROMMMMMLLLJJIIFFDDDGBAA.", ".CDFIMRSROMMMMMLLLJJIIFFDDDGBAA.", ".CDFIMRSROMMMMMLLLJJIIFFDDDGBAA.", ".C1F1M111O11MMM11L111I111D11BAA.", ".C111M1S1O1M1M1LLLJ1II1FDD1G1AA.", ".C111M1S1O1M1MM1LLJ1II11DD11BAA.", ".C1F1M1S1O1M1MML1LJ1II1FDD1G1AA.", ".C1F1M111O1M1M11LLJ1II111D1G1AA.", ".CDFIMRSROMMMMMLLLJJIIFFDDDGBAA.", ".CDFIMRSROMMMMMLLLJJIIFFDDDGBAA.", ".CDF222S22MM222L22JJI22F2D2GBAA.", ".CDF2MRS2O2M2MML2L2J2IFF2D2GBAA.", ".CDF22RS2O2M22ML22JJ2I2FD2DGBAA.", ".CDF2MRS2O2M2MML2L2J2I2FD2DGBAA.", ".CDF222S2O2M222L2L2JI22FD2DGBAA.", ".CDFIMRSROMMMMMLLLJJIIFFDDDGBAA.", ".CDFIMRSROMMMMMLLLJJIIFFDDDGBAA.", ".CDFIMRSROMMMMMLLLJJIIFFDDDGBAA.", ".CDFIMRSROMMMMMLLLJJIIFFDDDGBAA.", ".CDFIMRSROMMMMMLLLJJIIFFDDDGBAA.", ".CDFIMRSROMMMMKKKKKKIIFFDDDGBAA.", ".CGNNQSSSQQNNNNNNNNNNNNGGGNGBAA.", "...NNQSSSQQNNNNNNNNNNNNGGGNGB...", "................................"], "palette": {"A": "#2a173b", "B": "#3b2451", "C": "#472763", "D": "#58307a", "F": "#62348a", "G": "#674e7e", "I": "#6b3996", "J": "#723ca1", "K": "#7846a3", "L": "#7940aa", "M": "#7f45b1", "N": "#808286", "O": "#9a60cd", "Q": "#a9abb0", "R": "#cf98f5", "S": "#f8d3fb", "3": "#727177", "4": "#cdcbd6", "5": "#a8a7b0", "7": "#fdfbff", "1": "#f4f2fa", "2": "#d6c8ec", "X": "#2b2e2d", "x": "#4f5553", "E": "#15161b", "e": "#15161b", "P": "#ffb0a0", "m": "#3a1a10", "t": "#ff8a6a", "H": "#ffffff", "q": "#7940aa"}, "mug": ["Q", "G"]}, "rosa": {"rows": ["..............KKKKK.............", "......KRRQKKKKKKKKKKKKKFKF......", "....CFKKKKKKKQKCCKQKKKKKKFBB....", "...FFKKKQKKKKKKKKKKKKKKFFCCCB...", "...FKQSSSRKKKFFFFFFFFFFFFCFFB...", "..FFKQSSSRKKKKKFFKKKKFFFFFFFBB..", "..FFKRSSSRKKKKKKKKKKKKFFFFFFBB..", ".FFKKRSSSRQKKKKKKKKKKKKFFFFFBBB.", ".CDGILRSROLLLLLJJJJIIGGDDDDDBBB.", ".CDIJMRSSQNMMMMMLLLJJIIGDDDGCBB.", ".CGIJORSSQONNNNMMLLLJJIGGDDGCBB.", ".CGIJORSSQONNNNMMLLLJJIGGDDGCBB.", ".CG3JORSSQONNNNMMLLLJJIGGDDG3BB.", ".CGI33RSSQONNNNM43LLJJIGGD53CBB.", ".CGIJ33SSQONNNNM3LLLJJIGG33GCBB.", ".CGIJORSS3ONNN4443LLJJIG3DDGCBB.", ".CGIJORS3QONN344443LJJ553DDGCBB.", ".CGIJO77743NNN44443LJ5553DDGCBB.", ".CGIJO77743NN344443LJ5553DDGCBB.", ".CGIJO77743NNN44443LJ5553DDGCBB.", ".CGIJO7773ONNN44443LJ55553DGCBB.", ".CGIJO7773ONNN44443LJ55553DGCBB.", ".CGIJO7773ONNN4443LLJ55553DGCBB.", ".CGIJO3773ONN34443LLJ55553DGCBB.", ".CGIJOR773ONNN4443LLJ55553DGCBB.", ".CGIJO7773ONNN4443LLJ55553DGCBB.", ".CGIJO7773ONN44443LLJ55553DGCBB.", ".CGIJO7773ONN444443LJ55553DGCBB.", ".CGIJO7773ONN444443LJ55553DGCBB.", ".CGIJO7773ONN444443LJ55553DGCBB.", ".CGIJO7773ONN33443LLJ55553DGCBB.", ".CGIJ37773ONNNN4443LJ35553DGCBB.", ".CGIJO773QONN44443LLJJ5553DGCBB.", ".CGIJO3773ONN33443LLJ55553DGCBB.", ".CGIJOR773ONNNN443LLJ55553DGCBB.", ".CGIJOR773ONN3443LLLJ55553DGCBB.", ".CGIJOR773ONNN443LLLJ55553DGCBB.", ".CGIJOR773ONNN443LLLJ55553DGCBB.", ".CGIJO7773ONNN443LLLJ35553DGCBB.", ".CGIJO7773ONNN4443LLJJ5553DGCBB.", ".CGIJO7773ONNN343LLLJJ553DDGCBB.", ".CGIJO7733ONNNN43LLLJJ5553DGCBB.", ".CGIJO73SQONNNN43LLLJJ5553DGCBB.", ".CGIJO33SQONNNN3MLLLJJ3553DGCBB.", ".CGIJOR73QONNNN3MLLLJJI553DGCBB.", ".CGIJO33SQONNNN3MLLLJJI553DGCBB.", ".CGIJOR3SQONNNNM3LLLJJI553DGCBB.", ".CGIJOR3SQONNNNMMLLLJJI33DDGCBB.", ".CGIJOR3SQONNNNMMLLLJJIG3DDGCBB.", ".CGIJOR3SQONNNNMMLLLJJIG3DDGCBB.", ".CGIJOR3SQONNNNMMLLLJJIGG3DGCBB.", ".CGIJORSSQONNNNMMLLLJJIGGDDGCBB.", ".CGIJORSSQONNNNMMLLLJJIGGDDGCBB.", ".CGIJORSSQONNNNMMLLLJJIGGDDGCBB.", ".CGIJORSSQONNNNMMLLLJJIGGDDGCBB.", ".C1I1O111Q11NNN11L111J111D11CBB.", ".C111O1S1Q1N1N1MMLL1JJ1GGD1G1BB.", ".C111O1S1Q1N1NN1MLL1JJ11GD11CBB.", ".C1I1O1S1Q1N1NNM1LL1JJ1GGD1G1BB.", ".C1I1O111Q1N1N11MLL1JJ111D1G1BB.", ".CGIJORSSQONNNNMMLLLJJIGGDDGCBB.", ".CGIJORSSQONNNNMMLLLJJIGGDDGCBB.", ".CGI222S22ON222M22LLJ22G2D2GCBB.", ".CGI2ORS2Q2N2NNM2L2L2JIG2D2GCBB.", ".CGI22RS2Q2N22NM22LL2J2GG2DGCBB.", ".CGI2ORS2Q2N2NNM2L2L2J2GG2DGCBB.", ".CGI222S2Q2N222M2L2LJ22GG2DGCBB.", ".CGIJORSSQONNNNMMLLLJJIGGDDGCBB.", ".CGIJORSSQONNNNMMLLLJJIGGDDGCBB.", ".CGIJORSSQONNNNMMLLLJJIGGDDGCBB.", ".CGIJORSSQONNNNMMLLLJJIGGDDGCBB.", ".CGIJORSSQONNNNMMLLLJJIGGDDGCBB.", ".CDIJORSSQOMMMLLLLLJJIIGDDDGCBB.", ".BCFFKSSSKKFFFFFFFFFFFFCCCFCBBA.", "...FFKSSSKKFFFFFFFFFFFFCCCFCB...", "................................"], "palette": {"A": "#212123", "B": "#4e353e", "C": "#78525f", "D": "#9d687a", "F": "#818387", "G": "#aa7185", "I": "#bd7991", "J": "#cb839c", "K": "#a8aaaf", "L": "#db8da9", "M": "#e795b2", "N": "#ed99b6", "O": "#ec9db9", "Q": "#f9b8d3", "R": "#fbe1f1", "S": "#fff8fd", "3": "#7d7d7e", "4": "#e1e1e2", "5": "#b9b9ba", "7": "#ffffff", "1": "#6e344c", "2": "#faeef4", "X": "#2b2e2d", "x": "#4f5553", "E": "#15161b", "e": "#15161b", "P": "#ffb0a0", "m": "#3a1a10", "t": "#ff8a6a", "H": "#ffffff", "q": "#e795b2"}, "mug": ["K", "C"]}, "gold": {"rows": ["..............OOOOO.............", "......OSSOOOOOOOOOOOOOOIOI......", "....IIOOOOOOOSOIIOSOOOOOOIAA....", "...IIOOOOOOOOOOOOOOOOOOIIIIIB...", "...IOOSSSSOOOOIIIIIIIIIIIIIIB...", "..IIOSSSSSOOOOOIOOOOOIIIIIIIBA..", "..IIOSSSSSOOOOOOOOOOOOIIIIIIBA..", ".IIOOSSSSSOOOOOOOOOOOOOIIIOIBAA.", ".CDFGKRSRNKKKKKJJJJGGGFDDCDFBAA.", ".CDGJNRSRQMLLLLLKKKJJGGFDDDFBBA.", ".CFGJNRSRQMMMMLLLKKKJJGGFDDFBBA.", ".CFGJNRSRQMMMMLLLKKKJJGGFDDFBBA.", ".CF3JNRSRQMMMMLLLKKKJJGGFDDF3BA.", ".CFG33RSRQMMMMLL43KKJJGGFD53BBA.", ".CFGJ33SRQMMMMLL3KKKJJGGF33FBBA.", ".CFGJNRSR3MMMM4443KKJJGG3DDFBBA.", ".CFGJNRS3QMMM344443KJJ553DDFBBA.", ".CFGJN77743MMM44443KJ5553DDFBBA.", ".CFGJN77743MM344443KJ5553DDFBBA.", ".CFGJN77743MMM44443KJ5553DDFBBA.", ".CFGJN7773MMMM44443KJ55553DFBBA.", ".CFGJN7773MMMM44443KJ55553DFBBA.", ".CFGJN7773MMMM4443KKJ55553DFBBA.", ".CFGJN3773MMM34443KKJ55553DFBBA.", ".CFGJNR773MMMM4443KKJ55553DFBBA.", ".CFGJN7773MMMM4443KKJ55553DFBBA.", ".CFGJN7773MMM44443KKJ55553DFBBA.", ".CFGJN7773MMM444443KJ55553DFBBA.", ".CFGJN7773MMM444443KJ55553DFBBA.", ".CFGJN7773MMM444443KJ55553DFBBA.", ".CFGJN7773MMM33443KKJ55553DFBBA.", ".CFGJ37773MMMML4443KJ35553DFBBA.", ".CFGJN773QMMM44443KKJJ5553DFBBA.", ".CFGJN3773MMM33443KKJ55553DFBBA.", ".CFGJNR773MMMML443KKJ55553DFBBA.", ".CFGJNR773MMM3443KKKJ55553DFBBA.", ".CFGJNR773MMMM443KKKJ55553DFBBA.", ".CFGJNR773MMMM443KKKJ55553DFBBA.", ".CFGJN7773MMMM443KKKJ35553DFBBA.", ".CFGJN7773MMMM4443KKJJ5553DFBBA.", ".CFGJN7773MMMM343KKKJJ553DDFBBA.", ".CFGJN7733MMMML43KKKJJ5553DFBBA.", ".CFGJN73RQMMMML43KKKJJ5553DFBBA.", ".CFGJN33RQMMMML3LKKKJJ3553DFBBA.", ".CFGJNR73QMMMML3LKKKJJG553DFBBA.", ".CFGJN33RQMMMML3LKKKJJG553DFBBA.", ".CFGJNR3RQMMMMLL3KKKJJG553DFBBA.", ".CFGJNR3RQMMMMLLLKKKJJG33DDFBBA.", ".CFGJNR3RQMMMMLLLKKKJJGG3DDFBBA.", ".CFGJNR3RQMMMMLLLKKKJJGG3DDFBBA.", ".CFGJNR3RQMMMMLLLKKKJJGGF3DFBBA.", ".CFGJNRSRQMMMMLLLKKKJJGGFDDFBBA.", ".CFGJNRSRQMMMMLLLKKKJJGGFDDFBBA.", ".CFGJNRSRQMMMMLLLKKKJJGGFDDFBBA.", ".CFGJNRSRQMMMMLLLKKKJJGGFDDFBBA.", ".C1G1N111Q11MML11K111J111D11BBA.", ".C111N1S1Q1M1M1LLKK1JJ1GFD1F1BA.", ".C111N1S1Q1M1ML1LKK1JJ11FD11BBA.", ".C1G1N1S1Q1M1MLL1KK1JJ1GFD1F1BA.", ".C1G1N111Q1M1M11LKK1JJ111D1F1BA.", ".CFGJNRSRQMMMMLLLKKKJJGGFDDFBBA.", ".CFGJNRSRQMMMMLLLKKKJJGGFDDFBBA.", ".CFG222S22MM222L22KKJ22G2D2FBBA.", ".CFG2NRS2Q2M2MLL2K2K2JGG2D2FBBA.", ".CFG22RS2Q2M22LL22KK2J2GF2DFBBA.", ".CFG2NRS2Q2M2MLL2K2K2J2GF2DFBBA.", ".CFG222S2Q2M222L2K2KJ22GF2DFBBA.", ".CFGJNRSRQMMMMLLLKKKJJGGFDDFBBA.", ".CFGJNRSRQMMMMLLLKKKJJGGFDDFBBA.", ".CFGJNRSRQMMMMLLLKKKJJGGFDDFBBA.", ".CFGJNRSRQMMMMLLLKKKJJGGFDDFBBA.", ".CFGJNRSRQMMMMLLLKKKJJGGFDDFBBA.", ".CDGJNRSRQNNNNLKKKKJJGGFDDDFBAA.", ".BIIIOSSSOOIIIIIIIIIIIIIIIIIAAA.", "...IIOSSSOOIIIIIIIIIIIIIIIIIA...", "................................"], "palette": {"A": "#3f3418", "B": "#5b4a1d", "C": "#7b6323", "D": "#91752f", "F": "#9b7e35", "G": "#aa8831", "I": "#7b7d80", "J": "#ba9536", "K": "#c9a13a", "L": "#d5ab3d", "M": "#dcb040", "N": "#d6af4b", "O": "#a9abb0", "Q": "#f4cb5c", "R": "#fef494", "S": "#fafad2", "3": "#7e7d78", "4": "#e2e1d8", "5": "#bab9b1", "7": "#ffffff", "1": "#604410", "2": "#fcf2ce", "X": "#2b2e2d", "x": "#4f5553", "E": "#15161b", "e": "#15161b", "P": "#ffb0a0", "m": "#3a1a10", "t": "#ff8a6a", "H": "#ffffff", "q": "#d5ab3d"}, "mug": ["O", "I"]}, "mitternacht": {"rows": ["..............SSSSS.............", "......SSSSSSSSSSSSSSSSRRSQ......", "....QRSSSSSSSSRQQRSSSSSSSQON....", "...RRRSSSSSSSSSSSSSSSSRRRQQQO...", "...RRSSSSSSSSRRRRRRRRRRRQQRRO...", "..RRSSSSSSSSSSRRRRRRRRRRRQRROO..", "..RRSSSSSSSSSSSRRSSSSRRRRRRROO..", ".QRRSSSSSSSSSSSSSSSSSSRRRRRROON.", ".BCCFNQSROMJIIIIGGFFDDDCCBJOBAA.", ".BCDGNRSRONKKKKJJJIGFFDDCCLOBAA.", ".BCFIORSRONMMMMKKJJIGFFDCCLOBAA.", ".BCFIORSRONMMMMKKJJIGFFDCCLOBAA.", ".BC3IORSRONMMMMKKJJIGFFDCCLO3AA.", ".BCF33RSRONMMMMK43JIGFFDCC53BAA.", ".BCFI33SRONMMMMK3JJIGFFDC33OBAA.", ".BCFIORSR3NMMM4443JIGFFD3CLOBAA.", ".BCFIORS3ONMM344443IGF553CLOBAA.", ".BCFIO77743MMM44443IG5553CLOBAA.", ".BCFIO77743MM344443IG5553CLOBAA.", ".BCFIO77743MMM44443IG5553CLOBAA.", ".BCFIO7773NMMM44443IG55553LOBAA.", ".BCFIO7773NMMM44443IG55553LOBAA.", ".BCFIO7773NMMM4443JIG55553LOBAA.", ".BCFIO3773NMM34443JIG55553LOBAA.", ".BCFIOR773NMMM4443JIG55553LOBAA.", ".BCFIO7773NMMM4443JIG55553LOBAA.", ".BCFIO7773NMM44443JIG55553LOBAA.", ".BCFIO7773NMM444443IG55553LOBAA.", ".BCFIO7773NMM444443IG55553LOBAA.", ".BCFIO7773NMM444443IG55553LOBAA.", ".BCFIO7773NMM33443JIG55553LOBAA.", ".BCFI37773NMMMM4443IG35553LOBAA.", ".BCFIO773ONMM44443JIGF5553LOBAA.", ".BCFIO3773NMM33443JIG55553LOBAA.", ".BCFIOR773NMMMM443JIG55553LOBAA.", ".BCFIOR773NMM3443JJIG55553LOBAA.", ".BCFIOR773NMMM443JJIG55553LOBAA.", ".BCFIOR773NMMM443JJIG55553LOBAA.", ".BCFIO7773NMMM443JJIG35553LOBAA.", ".BCFIO7773NMMM4443JIGF5553LOBAA.", ".BCFIO7773NMMM343JJIGF553CLOBAA.", ".BCFIO7733NMMMM43JJIGF5553LOBAA.", ".BCFIO73RONMMMM43JJIGF5553LOBAA.", ".BCFIO33RONMMMM3KJJIGF3553LOBAA.", ".BCFIOR73ONMMMM3KJJIGFF553LOBAA.", ".BCFIO33RONMMMM3KJJIGFF553LOBAA.", ".BCFIOR3RONMMMMK3JJIGFF553LOBAA.", ".BCFIOR3RONMMMMKKJJIGFF33CLOBAA.", ".BCFIOR3RONMMMMKKJJIGFFD3CLOBAA.", ".BCFIOR3RONMMMMKKJJIGFFD3CLOBAA.", ".BCFIOR3RONMMMMKKJJIGFFDC3LOBAA.", ".BCFIORSRONMMMMKKJJIGFFDCCLOBAA.", ".BCFIORSRONMMMMKKJJIGFFDCCLOBAA.", ".BCFIORSRONMMMMKKJJIGFFDCCLOBAA.", ".BCFIORSRONMMMMKKJJIGFFDCCLOBAA.", ".B1F1O111O11MMM11J111F111C11BAA.", ".B111O1S1O1M1M1KKJJ1GF1DCC1O1AA.", ".B111O1S1O1M1MM1KJJ1GF11CC11BAA.", ".B1F1O1S1O1M1MMK1JJ1GF1DCC1O1AA.", ".B1F1O111O1M1M11KJJ1GF111C1O1AA.", ".BCFIORSRONMMMMKKJJIGFFDCCLOBAA.", ".BCFIORSRONMMMMKKJJIGFFDCCLOBAA.", ".BCF222S22NM222K22JIG22D2C2OBAA.", ".BCF2ORS2O2M2MMK2J2I2FFD2C2OBAA.", ".BCF22RS2O2M22MK22JI2F2DC2LOBAA.", ".BCF2ORS2O2M2MMK2J2I2F2DC2LOBAA.", ".BCF222S2O2M222K2J2IG22DC2LOBAA.", ".BCFIORSRONMMMMKKJJIGFFDCCLOBAA.", ".BCFIORSRONMMMMKKJJIGFFDCCLOBAA.", ".BCFIORSRONMMMMKKJJIGFFDCCLOBAA.", ".BCFIORSRONMMMMKKJJIGFFDCCLOBAA.", ".BCFIORSRONMMMMKKJJIGFFDCCLOBAA.", ".DJNNORSRQONNNNNNNNNNNMMJINOCBA.", ".OQQRSSSSSRRRRRRRRRRRRQQQQRQONI.", "...QRSSSSSRRRRRRRRRRRRQQQQRQO...", "................................"], "palette": {"A": "#0b0c0e", "B": "#131316", "C": "#18191d", "D": "#1a1b20", "F": "#1c1d23", "G": "#1e1f25", "I": "#1f2026", "J": "#212228", "K": "#22232a", "L": "#242428", "M": "#23242b", "N": "#292a31", "O": "#3a3a40", "Q": "#67686c", "R": "#7f8186", "S": "#b6b8bd", "3": "#494c52", "4": "#9ea3b0", "5": "#828691", "7": "#c9cfdd", "1": "#d6dae4", "2": "#a0a6b4", "X": "#2b2e2d", "x": "#4f5553", "E": "#f1f2f6", "e": "#f1f2f6", "P": "#ffb0a0", "m": "#3a1a10", "t": "#ff8a6a", "H": "#c9ccd6", "q": "#22232a"}, "mug": ["R", "Q"]}}};
  const CAN_SMALL_META = {"orangi": {"w": 27, "h": 60, "eyes": {"xs": [3, 7], "y": 20, "w": 3, "h": 3}, "mouth": [5, 25], "anchors": {"mouth": [24, 24], "hat": [13, 1], "glasses": [2, 19], "keyboard": [-1, 48], "tap": [13, 50], "idea": [12, -6], "lens": [25, 19], "mushroom": [-9, 52], "snore": [21, 6], "umbrella": [-3, -28], "fizz": [13, 1], "mug": [-11, 30]}}, "monsti": {"w": 32, "h": 76, "eyes": {"xs": [12, 18], "y": 8, "w": 3, "h": 3}, "mouth": [14, 12], "anchors": {"hat": [16, 1], "glasses": [11, 7], "keyboard": [2, 64], "tap": [16, 66], "idea": [15, -6], "lens": [30, 9], "mushroom": [-9, 68], "snore": [26, 5], "umbrella": [0, -28], "fizz": [16, 1], "mug": [-11, 38]}}};
  // Dosen-Sorten statt Einfärben: je Farbe eine echte Sorte (eigenes Bild und eigene Farben)
  const CAN_VARIANTS = {"orangi": {"blau": {"rows": ["..............aZZZa..............", "......YdigdcaaaaaaaaYYVTQVL......", "....MTYaYYYYYcdRRRdcYYYYYYLGC....", "....MOQYYYYYYcdRRRdcYYYYYVJCF....", "...QTaccigcZWWWWWWWVUUROMOLQMG...", "...QUcjjjgcaYVTRRRTTTRQQOMMRMI...", "..ORVcjjjgcaaYVTTUUVUUTQOOMTMIC..", "..QTYdjjjiccaZYVUVWYWVURQOOUOIC..", ".MQUZdjjjidccaZWWYZZZYVTRQOUOJFB.", ".JMOQajjjdZVUTQQQQQQQQOOMMLQMFCB.", ".DKKKNbfbSNNNNNNNNNNNKKKKKKKKDDA.", ".DKKKNbfbSNNNNNNNNNNNKKKKKKKKDDA.", ".D5555bf55555N5555NN5555KK55K55A.", ".D55K55f55NNNN55N55N55K55K55K55A.", ".D5555bf5555NN5555NN5555KKK555DA.", ".D55K55f55NNNN55N5NN55K5KKKK5DDA.", ".D5555bf55555N55N55N55K55KKK5DDA.", ".DKKKNbfbSNNNNNNNNNNNKKKKKKKKDDA.", ".DKKKNbfbSNNNNNNNNNNNKKKKKKKKDDA.", ".DKKKNbfbSNNNNNNNNNNNKKKKKKKKDDA.", ".LOQUcjjjgcaZWUTTTUUUTRQOOMRMICB.", ".LOQUcjjjgcaZWUTTTUUUTRQOOMRMICB.", ".LOQUcjjjgcaZWIIIGGGFFRCCCCFIAAB.", ".LOQUcjjjgcaZWIIIGGGFFRCCCCFIAAB.", ".LOQUcjjjgcaZWI66GG66FRCC66666AB.", ".LOQUcjjjgcaZWI66G66FFRC66CFIAAB.", ".LOQUcjjjgcaZWI6666GFFRC66CFIAAB.", ".LOQUcjjjgcaZWI666GGFFRCC6666AAB.", ".LOQUcjjjgcaZWI6666GFFRCCCCF66AB.", ".LOQUcjjjgcaZWI66G66FFRCCCCF66AB.", ".LOQUcjjjgcaZWI66GG66FRC66666AAB.", ".LOQUcjjjgcaZWIIIGGGFFRCCCCFIAAB.", ".LOQUcjjjgcaZWII6666FFRC666666AB.", ".LOQUcjjjgcaZWI66GG66FRCCC66IAAB.", ".LOQUcjjjgcaZWI66GG66FRCCC66IAAB.", ".LOQUcjjjgcaZWI66GG66FRCCC66IAAB.", ".LOQUcjjjgcaZWI66GG66FRCCC66IAAB.", ".LOQUcjjjgcaZWI66GG66FRCCC66IAAB.", ".LOQUcjjjgcaZWII6666FFRCCC66IAAB.", ".LOQUcjjjgcaZWIIIGGGFFRCCCCFIAAB.", ".LOQUcjjjgcaZWI66GG66FRC66666AAB.", ".LOQUcjjjgcaZWI666G66FRC66CF66AB.", ".LOQUcjjjgcaZWI666666FRC66CF66AB.", ".LOQUcjjjgcaZWI66G666FRC66666AAB.", ".LOQUcjjjgcaZWI66GG66FRC66C66AAB.", ".LOQUcjjjgcaZWI66GG66FRC66CF66AB.", ".LOQUcjjjgcaZWI66GG66FRC66CF66AB.", ".LOQUcjjjgcaZWIIIGGGFFRCCCCFIAAB.", ".LOQUcjjjgcaZWII66666FRCC6666AAB.", ".LOQUcjjjgcaZWI66GGGFFRC66CF66AB.", ".LONUcjjjgcaZWI66GGGFFRC66CF66AB.", ".LOQUcjjjgcaZWI66G666FRC66CF66AB.", ".LKQNcjjjgcaZWI66GG66FRC66CF66AB.", ".LOQUcjjjgcaZWI66GG66FRC66CF66AB.", ".LONUSjjjgcaZWII6666FFRCC6666AAB.", ".LOQUcjjjgcaZWIIIGGGFFRCCCCFIAAB.", ".LKQNcbjjgcaZWIIIGGGFFRC66CF66AB.", ".LOQUcjjjgcaZWIIIGGGFFRC666F66AB.", ".LONUSjfjgcaZWIIIGGGFFRC666666AB.", ".LOQUcjjjgcaZWIIIGGGFFRC66C666AB.", ".LKQNcbjfgcaZWIIIGGGFFRC66CF66AB.", ".LOQUcjjjgcaZWIIIGGGFFRC66CF66AB.", ".LONUSjfjgcaZWIIIGGGFFRC66CF66AB.", ".LOQUcjjjgcaZWIIIGGGFFRCCCCFIAAB.", ".LKQNcbjfgcaZWIIIGGGFFRCC66666AB.", ".LOQUcjjjgcaZWIIIGGGFFRC66CFIAAB.", ".LONUSjfjbcaZWIIIGGGFFRC66CFIAAB.", ".LOQUcjjjgcaZWIIIGGGFFRC66C666AB.", ".LKQNcbjfgSaZWIIIGGGFFRC66CF66AB.", ".LOQUcjjjgcaZWIIIGGGFFRC66CF66AB.", ".LONUSjfjbcSZWIIIGGGFFRCC6666AAB.", ".LOQUcjjjgcaZWIIIGGGFFRCCCCFIAAB.", ".LKQNcbjfgSaSWIIIGGGFFRCCCCFIAAB.", ".LOQUcjjjgcaZWUTTTUUUTRQOOMRMICB.", ".LONUSjfjbcSZWUTTTUUUTRQOOMRMICB.", ".LOQUcjjjgcaZWUTTTUUUTRQOOMRMICB.", ".LKQNcbjfgSaSWUTTTUUUTRQOOMRMICB.", ".LOQUcjjjgcaZWUTTTUUUTRQOOMRMICB.", ".LOQUcjjjgcZYVTRRTTUTTQQOMMRMICB.", ".JLMOZijjcVTRQOOOOOOOOMMMLLOLFBA.", "...MOZijjcVTRQOOOOOOOOMMMLLOLF...", "................................."], "palette": {"A": "#1a1d21", "B": "#292a2a", "C": "#323536", "D": "#12305f", "F": "#3c3f41", "G": "#404446", "I": "#444749", "J": "#515355", "K": "#225097", "L": "#5e6061", "M": "#6e7071", "N": "#2a65c2", "O": "#7a7c7e", "Q": "#878a8b", "R": "#8d9092", "S": "#4c8ce4", "T": "#929597", "U": "#999b9d", "V": "#9fa0a1", "W": "#a0a3a5", "Y": "#a4a6a8", "Z": "#a8acad", "a": "#b1b3b5", "b": "#7bb9fa", "c": "#c1c4c6", "d": "#d5d7d7", "f": "#b2eeff", "g": "#e5e7e8", "i": "#f3f3f2", "j": "#feffff", "5": "#fbfbf9", "6": "#eef0f0", "X": "#2b2e2d", "x": "#4f5553", "E": "#15161b", "e": "#15161b", "P": "#ffb0a0", "m": "#3a1a10", "t": "#ff8a6a", "H": "#ffffff", "v": "#999b9d"}, "mug": ["c", "O"]}, "gruen": {"rows": ["..............baaab..............", "......YfigfcbbbbbbbbYYUSRUL......", "....NSYbYYYYYcfSSSfcYYYYYYLIC....", "....NORYYYYYYcfSSSfcYYYYYULDG....", "...RSbccigcaWWWWWWWUTTSONOLRNI...", "...RTcjjjgcbYUTSSSSTSSRRONNSNI...", "..OSUcjjjgcbbYUTTTUUUTSRRONSNJD..", "..RSYfjjjiccbaYUUUWYWUTSROOTOJD..", ".NRTafjjjifccbaWWYaaaYUTSROTOJDC.", ".LNORbijjfaVTSRRRRRRRROONNLRNGCB.", ".FFKKMZddQMMMMMMMMMKKKKKKFFKKFBA.", ".FFKKMZddQMMMMMMMMMMKKKKKFFKKFBA.", ".FFKK55ddQM5555MM5MMK5K55555KFBA.", ".FFKK55ddQMM55MMM55M55K55FFKKFBA.", ".FFKK55ddQMM55MMM55555K5555KKFBA.", ".FFKK55ddQMM55MMM5M5K5K55FFKKFBA.", ".FFKK55555M5555MM5MMK5K55555KFBA.", ".FFKKMZddQMMMMMMMMMMKKKKKFFKKFBA.", ".FFKKMZddQMMMMMMMMMMKKKKKFFKKFBA.", ".FFKKMZddQMMMMMMMMMMKKKKKFFKKFBA.", ".LORTcjjjgcbaWTSSTTTTSSROONSNJDB.", ".LORTcjjjgcbaWTSSTTTTSSROONSNJDB.", ".LORTcjjjgcbaWJJIIIGGGSDDCCGJAAB.", ".LORTcjjjgcbaWJJIIIGGGSDDCCGJAAB.", ".LORTcjjjgcbaWJ66II66GSDD66666AB.", ".LORTcjjjgcbaWJ66I66GGSD66CGJAAB.", ".LORTcjjjgcbaWJ6666GGGSD66CGJAAB.", ".LORTcjjjgcbaWJ666IGGGSDD6666AAB.", ".LORTcjjjgcbaWJ6666GGGSDDCCG66AB.", ".LORTcjjjgcbaWJ66I66GGSDDCCG66AB.", ".LORTcjjjgcbaWJ66II66GSD66666AAB.", ".LORTcjjjgcbaWJJIIIGGGSDDCCGJAAB.", ".LORTcjjjgcbaWJJ6666GGSD666666AB.", ".LORTcjjjgcbaWJ66II66GSDDC66JAAB.", ".LORTcjjjgcbaWJ66II66GSDDC66JAAB.", ".LORTcjjjgcbaWJ66II66GSDDC66JAAB.", ".LORTcjjjgcbaWJ66II66GSDDC66JAAB.", ".LORTcjjjgcbaWJ66II66GSDDC66JAAB.", ".LORTcjjjgcbaWJJ6666GGSDDC66JAAB.", ".LORTcjjjgcbaWJJIIIGGGSDDCCGJAAB.", ".LORTcjjjgcbaWJ66II66GSD66666AAB.", ".LORTcjjjgcbaWJ666I66GSD66CG66AB.", ".LORTcjjjgcbaWJ666666GSD66CG66AB.", ".LORTcjjjgcbaWJ66I666GSD66666AAB.", ".LORTcjjjgcbaWJ66II66GSD66C66AAB.", ".LORTcjjjgcbaWJ66II66GSD66CG66AB.", ".LORTcjjjgcbaWJ66II66GSD66CG66AB.", ".LORTcjjjgcbaWJJIIIGGGSDDCCGJAAB.", ".LORTcjjjgcbaWJJ66666GSDD6666AAB.", ".LORTcjjjgcbaWJ66IIGGGSD66CG66AB.", ".LOMTcjjjgcbaWJ66IIGGGSD66CG66AB.", ".LORTcjjjgcbaWJ66I666GSD66CG66AB.", ".LKRMcjjjgcbaWJ66II66GSD66CG66AB.", ".LORTcjjjgcbaWJ66II66GSD66CG66AB.", ".LOMTQjjjgcbaWJJ6666GGSDD6666AAB.", ".LORTcjjjgcbaWJJIIIGGGSDDCCGJAAB.", ".LKRMcZjjgcbaWJJIIIGGGSD66CG66AB.", ".LORTcjjjgcbaWJJIIIGGGSD666G66AB.", ".LOMTQjdjgcbaWJJIIIGGGSD666666AB.", ".LORTcjjjgcbaWJJIIIGGGSD66C666AB.", ".LKRMcZjdgcbaWJJIIIGGGSD66CG66AB.", ".LORTcjjjgcbaWJJIIIGGGSD66CG66AB.", ".LOMTQjdjgcbaWJJIIIGGGSD66CG66AB.", ".LORTcjjjgcbaWJJIIIGGGSDDCCGJAAB.", ".LKRMcZjdgcbaWJJIIIGGGSDD66666AB.", ".LORTcjjjgcbaWJJIIIGGGSD66CGJAAB.", ".LOMTQjdjZcbaWJJIIIGGGSD66CGJAAB.", ".LORTcjjjgcbaWJJIIIGGGSD66C666AB.", ".LKRMcZjdgQbaWJJIIIGGGSD66CG66AB.", ".LORTcjjjgcbaWJJIIIGGGSD66CG66AB.", ".LOMTQjdjZcQaWJJIIIGGGSDD6666AAB.", ".LORTcjjjgcbaWJJIIIGGGSDDCCGJAAB.", ".LKRMcZjdgQbQWJJIIIGGGSDDCCGJAAB.", ".LORTcjjjgcbaWTSSTTTTSSROONSNJDB.", ".LOMTQjdjZcQaWTSSTTTTSSROONSNJDB.", ".LORTcjjjgcbaWTSSTTTTSSROONSNJDB.", ".LKRMcZjdgQbQWTSSTTTTSSROONSNJDB.", ".LORTcjjjgcbaWTSSTTTTSSROONSNJDB.", ".LORTcjjjgcaYUTSSSTTTSRRONNSNIDB.", ".JLNOaijjcUSRROOOOOOOOONNLLOLDCA.", "...NOaijjcUSRROOOOOOOOONNLLOLD...", "................................."], "palette": {"A": "#1b1f1c", "B": "#272d26", "C": "#2e3032", "D": "#353839", "F": "#32691a", "G": "#3d4041", "I": "#414547", "J": "#444849", "K": "#468928", "L": "#5e6061", "M": "#54a82c", "N": "#6e6f71", "O": "#7a7b7e", "Q": "#7acb49", "R": "#878a8b", "S": "#8e9193", "T": "#989b9c", "U": "#9d9fa0", "V": "#a1a2a2", "W": "#a0a3a5", "Y": "#a4a6a8", "Z": "#a2ec72", "a": "#a8acad", "b": "#b1b3b5", "c": "#c1c4c6", "d": "#d4ffa7", "f": "#d5d7d8", "g": "#e5e7e8", "i": "#f5f5f4", "j": "#feffff", "5": "#fbfbf9", "6": "#eef0f0", "X": "#2b2e2d", "x": "#4f5553", "E": "#15161b", "e": "#15161b", "P": "#ffb0a0", "m": "#3a1a10", "t": "#ff8a6a", "H": "#ffffff", "v": "#989b9c"}, "mug": ["c", "O"]}, "lila": {"rows": ["..............aZZZa..............", "......YcgfcbaaaaaaaaYYUSQUL......", "....MSYaYYYYYbcRRRcbYYYYYYLFB....", "....MOQYYYYYYbcRRRcbYYYYYUJCD....", "...QSabbgfcZWWWWWWWUTTROMOLQMF...", "...QTbijjfbaYUSRRRSSSRQQOMMRMG...", "..ORUbjjjfbaaYUTSTUUUTSQOOMSMGC..", "..QSYcjjjgbbaZYUUUWYWUTRQOOTOGC..", ".MQTZcjjjgcbbaZYWYZZZYUSRQOTOJDB.", ".JMOQaijicZWTSQQQQQQQQOOMMLQMDBB.", ".IIKKNVddVNNNNNNNNNKKKKKIIIKKCBA.", ".IIKKNVddVNNNNNNNNNNKKKKKIIKKCBA.", ".II5555d5555NNN555NN5555KI55555A.", ".I55KNVd55N55N55N55N55K55I55KCBA.", ".I55K55d5555NN55555N5555KI5555BA.", ".I55K55d55N5NN55N55N55KKKI55KCBA.", ".II5555d55N55N55N55N55KKKI55555A.", ".IIKKNVddVNNNNNNNNNNKKKKKIIKKCBA.", ".IIKKNVddVNNNNNNNNNNKKKKKIIKKCBA.", ".IIKKNVddVNNNNNNNNNNKKKKKIIKKCBA.", ".LOQTbijjfbaZWTSSSTTTSRQOOMRMGCB.", ".LOQTbijjfbaZWTSSSTTTSRQOOMRMGCB.", ".LOQTbijjfbaZWGGGFFFDDRCCCBDGAAB.", ".LOQTbijjfbaZWGGGFFFDDRCCCBDGAAB.", ".LOQTbijjfbaZWG66FF66DRCC66666AB.", ".LOQTbijjfbaZWG66F66DDRC66BDGAAB.", ".LOQTbijjfbaZWG6666FDDRC66BDGAAB.", ".LOQTbijjfbaZWG666FFDDRCC6666AAB.", ".LOQTbijjfbaZWG6666FDDRCCCBD66AB.", ".LOQTbijjfbaZWG66F66DDRCCCBD66AB.", ".LOQTbijjfbaZWG66FF66DRC66666AAB.", ".LOQTbijjfbaZWGGGFFFDDRCCCBDGAAB.", ".LOQTbijjfbaZWGG6666DDRC666666AB.", ".LOQTbijjfbaZWG66FF66DRCCC66GAAB.", ".LOQTbijjfbaZWG66FF66DRCCC66GAAB.", ".LOQTbijjfbaZWG66FF66DRCCC66GAAB.", ".LOQTbijjfbaZWG66FF66DRCCC66GAAB.", ".LOQTbijjfbaZWG66FF66DRCCC66GAAB.", ".LOQTbijjfbaZWGG6666DDRCCC66GAAB.", ".LOQTbijjfbaZWGGGFFFDDRCCCBDGAAB.", ".LOQTbijjfbaZWG66FF66DRC66666AAB.", ".LOQTbijjfbaZWG666F66DRC66BD66AB.", ".LOQTbijjfbaZWG666666DRC66BD66AB.", ".LOQTbijjfbaZWG66F666DRC66666AAB.", ".LOQTbijjfbaZWG66FF66DRC66B66AAB.", ".LOQTbijjfbaZWG66FF66DRC66BD66AB.", ".LOQTbijjfbaZWG66FF66DRC66BD66AB.", ".LOQTbijjfbaZWGGGFFFDDRCCCBDGAAB.", ".LOQTbijjfbaZWGG66666DRCC6666AAB.", ".LOQTbijjfbaZWG66FFFDDRC66BD66AB.", ".LONTbijjfbaZWG66FFFDDRC66BD66AB.", ".LOQTbijjfbaZWG66F666DRC66BD66AB.", ".LKQNbijjfbaZWG66FF66DRC66BD66AB.", ".LOQTbijjfbaZWG66FF66DRC66BD66AB.", ".LONTVijjfbaZWGG6666DDRCC6666AAB.", ".LOQTbijjfbaZWGGGFFFDDRCCCBDGAAB.", ".LKQNbdjjfbaZWGGGFFFDDRC66BD66AB.", ".LOQTbijjfbaZWGGGFFFDDRC666D66AB.", ".LONTVigjfbaZWGGGFFFDDRC666666AB.", ".LOQTbijjfbaZWGGGFFFDDRC66B666AB.", ".LKQNbdjdfbaZWGGGFFFDDRC66BD66AB.", ".LOQTbijjfbaZWGGGFFFDDRC66BD66AB.", ".LONTVigjfbaZWGGGFFFDDRC66BD66AB.", ".LOQTbijjfbaZWGGGFFFDDRCCCBDGAAB.", ".LKQNbdjdfbaZWGGGFFFDDRCC66666AB.", ".LOQTbijjfbaZWGGGFFFDDRC66BDGAAB.", ".LONTVigjdbaZWGGGFFFDDRC66BDGAAB.", ".LOQTbijjfbaZWGGGFFFDDRC66B666AB.", ".LKQNbdjdfVaZWGGGFFFDDRC66BD66AB.", ".LOQTbijjfbaZWGGGFFFDDRC66BD66AB.", ".LONTVigjdbVZWGGGFFFDDRCC6666AAB.", ".LOQTbijjfbaZWGGGFFFDDRCCCBDGAAB.", ".LKQNbdjdfVaVWGGGFFFDDRCCCBDGAAB.", ".LOQTbijjfbaZWTSSSTTTSRQOOMRMGCB.", ".LONTVigjdbVZWTSSSTTTSRQOOMRMGCB.", ".LOQTbijjfbaZWTSSSTTTSRQOOMRMGCB.", ".LKQNbdjdfVaVWTSSSTTTSRQOOMRMGCB.", ".LOQTbijjfbaZWTSSSTTTSRQOOMRMGCB.", ".LOQTbijjfbZYUSRRSSTSSQQOMMRMGCB.", ".JLMOZgjibUSRQOOOOOOOOMMMLLOLDBA.", "...MOZgjibUSRQOOOOOOOOMMMLLOLD...", "................................."], "palette": {"A": "#1c1b20", "B": "#2b2a2e", "C": "#343539", "D": "#3c3f41", "F": "#404446", "G": "#444749", "I": "#4e2571", "J": "#545556", "K": "#62328a", "L": "#5f6162", "M": "#6e7071", "N": "#773ba9", "O": "#7a7c7e", "Q": "#878a8b", "R": "#8d9092", "S": "#929597", "T": "#989b9c", "U": "#9d9fa0", "V": "#a465d4", "W": "#a0a3a4", "Y": "#a4a6a8", "Z": "#a8acad", "a": "#b1b3b5", "b": "#c1c4c6", "c": "#d4d6d6", "d": "#e8abfc", "f": "#e4e6e7", "g": "#f5eff5", "i": "#fdfefe", "j": "#ffffff", "5": "#fbfbf9", "6": "#eef0f0", "X": "#2b2e2d", "x": "#4f5553", "E": "#15161b", "e": "#15161b", "P": "#ffb0a0", "m": "#3a1a10", "t": "#ff8a6a", "H": "#ffffff", "v": "#989b9c"}, "mug": ["b", "O"]}, "rosa": {"rows": ["..............aYYZa..............", "......YcifcbabbaaaaaYYVSQVL......", "....NSYZYYYYYccRRRccYYYYYWLGC....", "....NNQYYYYYYccRRRccYYYYYVKDG....", "...QSaccifcZWWWWWWWVTTRQNQLQLJ...", "...QTbjjjfbaYVSRRRSSSRQQNNNRNJ...", "..NRVcjjjfbaZYVSSTTVTTSQQNNSNJD..", "..QSWcjjjicbaZWVTVWWWVTRQNNTNJD..", ".NQTYfjjjiccbaYWWYYYYYVSRQNTNKFC.", ".KNNRaijjcZVTSQQQQQQQQNNNLLQLGCB.", ".IMMOOdgdUUUUUUUOOOOOOOMMMMMMIIC.", ".IMMOUdgdUUUUUUUUUOOOOOMMMMMMIIC.", ".IMMO5555UU5555UU55O55O55M55MIIC.", ".IMMO55g55UU55UUU55555O5555MMIIC.", ".IMMO5555UUU55UUU55555O555MMMIIC.", ".IMMO55gdUUU55UUU55O55O5555MMIIC.", ".IMMO55gdUU5555UU55O55O55M55MIIC.", ".IMMOUdgdUUUUUUUUUOOOOOMMMMMMIIC.", ".IMMOUdgdUUUUUUUUUOOOOOMMMMMMIIC.", ".IMMOUdgdUUUUUUUUUOOOOOMMMMMMIIC.", ".LNQTcjjjfbaYWTSSSTTTSRQNNNRNJDB.", ".LNQTcjjjfbaYWTSSSTTTSRQNNNRNJDB.", ".LNQTcjjjfbaYWJJJJJGGFRDDCCGJBAB.", ".LNQTcjjjfbaYWJJJJJGGFRDDCCGJBAB.", ".LNQTcjjjfbaYWJ66JJ66FRDD66666AB.", ".LNQTcjjjfbaYWJ66J66GFRD66CGJBAB.", ".LNQTcjjjfbaYWJ6666GGFRD66CGJBAB.", ".LNQTcjjjfbaYWJ666JGGFRDD6666BAB.", ".LNQTcjjjfbaYWJ6666GGFRDDCCG66AB.", ".LNQTcjjjfbaYWJ66J66GFRDDCCG66AB.", ".LNQTcjjjfbaYWJ66JJ66FRD66666BAB.", ".LNQTcjjjfbaYWJJJJJGGFRDDCCGJBAB.", ".LNQTcjjjfbaYWJJ6666GFRD666666AB.", ".LNQTcjjjfbaYWJ66JJ66FRDDC66JBAB.", ".LNQTcjjjfbaYWJ66JJ66FRDDC66JBAB.", ".LNQTcjjjfbaYWJ66JJ66FRDDC66JBAB.", ".LNQTcjjjfbaYWJ66JJ66FRDDC66JBAB.", ".LNQTcjjjfbaYWJ66JJ66FRDDC66JBAB.", ".LNQTcjjjfbaYWJJ6666GFRDDC66JBAB.", ".LNQTcjjjfbaYWJJJJJGGFRDDCCGJBAB.", ".LNQTcjjjfbaYWJ66JJ66FRD66666BAB.", ".LNQTcjjjfbaYWJ666J66FRD66CG66AB.", ".LNQTcjjjfbaYWJ666666FRD66CG66AB.", ".LNQTcjjjfbaYWJ66J666FRD66666BAB.", ".LNQTcjjjfbaYWJ66JJ66FRD66C66BAB.", ".LNQTcjjjfbaYWJ66JJ66FRD66CG66AB.", ".LNQTcjjjfbaYWJ66JJ66FRD66CG66AB.", ".LNQTcjjjfbaYWJJJJJGGFRDDCCGJBAB.", ".LNQTcjjjfbaYWJJ66666FRDD6666BAB.", ".LNQTcjjjfbaYWJ66JJGGFRD66CG66AB.", ".LNOTcjjjfbaYWJ66JJGGFRD66CG66AB.", ".LNQTcjjjfbaYWJ66J666FRD66CG66AB.", ".LOQUcjjjfbaYWJ66JJ66FRD66CG66AB.", ".LNQTcjjjfbaYWJ66JJ66FRD66CG66AB.", ".LNOTUjjjfbaYWJJ6666GFRDD6666BAB.", ".LNQTcjjjfbaYWJJJJJGGFRDDCCGJBAB.", ".LOQUcdjjfbaYWJJJJJGGFRD66CG66AB.", ".LNQTcjjjfbaYWJJJJJGGFRD666G66AB.", ".LNOTUjjjfbaYWJJJJJGGFRD666666AB.", ".LNQTcjjjfbaYWJJJJJGGFRD66C666AB.", ".LOQUcdjgfbaYWJJJJJGGFRD66CG66AB.", ".LNQTcjjjfbaYWJJJJJGGFRD66CG66AB.", ".LNOTUjjjfbaYWJJJJJGGFRD66CG66AB.", ".LNQTcjjjfbaYWJJJJJGGFRDDCCGJBAB.", ".LOQUcdjgfbaYWJJJJJGGFRDD66666AB.", ".LNQTcjjjfbaYWJJJJJGGFRD66CGJBAB.", ".LNOTUjjjdbaYWJJJJJGGFRD66CGJBAB.", ".LNQTcjjjfbaYWJJJJJGGFRD66C666AB.", ".LOQUcdjgfUaYWJJJJJGGFRD66CG66AB.", ".LNQTcjjjfbaYWJJJJJGGFRD66CG66AB.", ".LNOTUjjjdbUYWJJJJJGGFRDD6666BAB.", ".LNQTcjjjfbaYWJJJJJGGFRDDCCGJBAB.", ".LOQUcdjgfUaUWJJJJJGGFRDDCCGJBAB.", ".LNQTcjjjfbaYWTSSSTTTSRQNNNRNJDB.", ".LNOTUjjjdbUYWTSSSTTTSRQNNNRNJDB.", ".LNQTcjjjfbaYWTSSSTTTSRQNNNRNJDB.", ".LOQUcdjgfUaUWTSSSTTTSRQNNNRNJDB.", ".LNQTcjjjfbaYWTSSSTTTSRQNNNRNJDB.", ".LNQTbjjjfbZYVSRRSSTSSRQNNNRNJDB.", ".KLNNYijjcVSRQNNNNNNNNNNLLLNLDCB.", "...NNYijjcVSRQNNNNNNNNNNLLLNLF...", "................................."], "palette": {"A": "#191a1b", "B": "#262727", "C": "#312c31", "D": "#353839", "F": "#3b3e40", "G": "#3e4142", "I": "#672343", "J": "#434648", "K": "#515355", "L": "#626465", "M": "#a03c6a", "N": "#77797b", "O": "#bf4880", "Q": "#87898b", "R": "#8d9092", "S": "#929597", "T": "#999b9d", "U": "#e1599a", "V": "#9fa0a1", "W": "#a0a3a5", "Y": "#a6a9ab", "Z": "#afb0b1", "a": "#b1b4b6", "b": "#bdc0c2", "c": "#c9cccd", "d": "#fea8e3", "f": "#e2e4e5", "g": "#ffd4fe", "i": "#f5f5f4", "j": "#fefeff", "5": "#fbfbf9", "6": "#eef0f0", "X": "#2b2e2d", "x": "#4f5553", "E": "#15161b", "e": "#15161b", "P": "#ffb0a0", "m": "#3a1a10", "t": "#ff8a6a", "H": "#ffffff", "v": "#999b9d"}, "mug": ["c", "N"]}, "gold": {"rows": ["..............cbbbb..............", "......bfjffcbcccccccbbZZVZN......", "....QZbbbbbbbcfVVVfcbbbbbbNIC....", "....QQVbbbbbbcfVVVfcbbbbbZNFG....", "...VZbccjfcbZZZZZZZZZZVVQVNVQI...", "...VZcjjjfcbbZZVVVZZZVVVVQQVQJ...", "..VVZcjjjfccbbZZZZZZZZZVVQQZQJF..", "..VZbfjjjjcccbbZZZbbbZZVVVQZQJF..", ".QVZbfjjjjfccbbbZbbbbbZZVVVZQJFC.", ".KLLOagjgaWTTOOOOOOOOOLLLKKSLDBB.", ".KMMRUdggYUUUUUUURRRRRRMMMMMLDDB.", ".KMMRUdggYUUUUUUUUURRRRMMMMMLDDB.", ".KMMRU5555UU555UU55RRRR5555MLDDB.", ".KMMR55ggYU55U55U55RRRR55M55LDDB.", ".KMMR55g55U55U55U55RRRR55M55LDDB.", ".KMMR55g55U55U55U55RRRR55M55LDDB.", ".KMMRU5555UU555UU55555R5555MLDDB.", ".KMMRUdggYUUUUUUUUURRRRMMMMMLDDB.", ".KMMRUdggYUUUUUUUUURRRRMMMMMLDDB.", ".KMMRUdggYUUUUUUUUURRRRMMMMMLDDB.", ".KLOTagjidYWWTTOOOTTTOOOLLLSLDBB.", ".KLOTagjidYWWTTOOOTTTOOOLLLSLDBB.", ".KLOTagjidYWWTJJJIIIGGOFFCCGJAAB.", ".KLOTagjidYWWTJJJIIIGGOFFCCGJAAB.", ".KLOTagjidYWWTJ66II66GOFF66666AB.", ".KLOTagjidYWWTJ66I66GGOF66CGJAAB.", ".KLOTagjidYWWTJ6666IGGOF66CGJAAB.", ".KLOTagjidYWWTJ666IIGGOFF6666AAB.", ".KLOTagjidYWWTJ6666IGGOFFCCG66AB.", ".KLOTagjidYWWTJ66I66GGOFFCCG66AB.", ".KLOTagjidYWWTJ66II66GOF66666AAB.", ".KLOTagjidYWWTJJJIIIGGOFFCCGJAAB.", ".KLOTagjidYWWTJJ6666GGOF666666AB.", ".KLOTagjidYWWTJ66II66GOFFC66JAAB.", ".KLOTagjidYWWTJ66II66GOFFC66JAAB.", ".KLOTagjidYWWTJ66II66GOFFC66JAAB.", ".KLOTagjidYWWTJ66II66GOFFC66JAAB.", ".KLOTagjidYWWTJ66II66GOFFC66JAAB.", ".KLOTagjidYWWTJJ6666GGOFFC66JAAB.", ".KLOTagjidYWWTJJJIIIGGOFFCCGJAAB.", ".KLOTagjidYWWTJ66II66GOF66666AAB.", ".KLOTagjidYWWTJ666I66GOF66CG66AB.", ".KLOTagjidYWWTJ666666GOF66CG66AB.", ".KLOTagjidYWWTJ66I666GOF66666AAB.", ".KLOTagjidYWWTJ66II66GOF66C66AAB.", ".KLOTagjidYWWTJ66II66GOF66CG66AB.", ".KLOTagjidYWWTJ66II66GOF66CG66AB.", ".KLOTagjidYWWTJJJIIIGGOFFCCGJAAB.", ".KLOTagjidYWWTJJ66666GOFF6666AAB.", ".KLOTagjidYWWTJ66IIIGGOF66CG66AB.", ".KLRTagjidYWWTJ66IIIGGOF66CG66AB.", ".KLOTagjidYWWTJ66I666GOF66CG66AB.", ".KMOUagjidYWWTJ66II66GOF66CG66AB.", ".KLOTagjidYWWTJ66II66GOF66CG66AB.", ".KLRTYgjidYWWTJJ6666GGOFF6666AAB.", ".KLOTagjidYWWTJJJIIIGGOFFCCGJAAB.", ".KMOUadjidYWWTJJJIIIGGOF66CG66AB.", ".KLOTagjidYWWTJJJIIIGGOF666G66AB.", ".KLRTYgiidYWWTJJJIIIGGOF666666AB.", ".KLOTagjidYWWTJJJIIIGGOF66C666AB.", ".KMOUadjgdYWWTJJJIIIGGOF66CG66AB.", ".KLOTagjidYWWTJJJIIIGGOF66CG66AB.", ".KLRTYgiidYWWTJJJIIIGGOF66CG66AB.", ".KLOTagjidYWWTJJJIIIGGOFFCCGJAAB.", ".KMOUadjgdYWWTJJJIIIGGOFF66666AB.", ".KLOTagjidYWWTJJJIIIGGOF66CGJAAB.", ".KLRTYgiidYWWTJJJIIIGGOF66CGJAAB.", ".KLOTagjidYWWTJJJIIIGGOF66C666AB.", ".KMOUadjgdYWWTJJJIIIGGOF66CG66AB.", ".KLOTagjidYWWTJJJIIIGGOF66CG66AB.", ".KLRTYgiidYYWTJJJIIIGGOFF6666AAB.", ".KLOTagjidYWWTJJJIIIGGOFFCCGJAAB.", ".KMOUadjgdYWYTJJJIIIGGOFFCCGJAAB.", ".KLOTagjidYWWTTOOOTTTOOOLLLSLDBB.", ".KLRTYgiidYYWTTOOOTTTOOOLLLSLDBB.", ".KLOTagjidYWWTTOOOTTTOOOLLLSLDBB.", ".KMOUadjgdYWYTTOOOTTTOOOLLLSLDBB.", ".KLOTagjidYWWTTOOOTTTOOOLLLSLDBB.", ".KLOTaijidaWWTTOOOTTTOOOLLLSLDBB.", ".JNQVbjjjcZZVVVQQQVVVQQQNNNVNFCA.", "...QVbjjjcZZVVVQQQVVVQQQNNNVNF...", "................................."], "palette": {"A": "#1b1d1d", "B": "#2f2712", "C": "#2e3032", "D": "#503f14", "F": "#353839", "G": "#3c3f41", "I": "#404446", "J": "#444749", "K": "#675528", "L": "#806b38", "M": "#94741d", "N": "#616264", "O": "#957c41", "Q": "#707173", "R": "#af8921", "S": "#95845c", "T": "#a68b49", "U": "#c79c26", "V": "#84868a", "W": "#b89950", "Y": "#cfae58", "Z": "#9c9d9f", "a": "#cfb370", "b": "#a8aaac", "c": "#bebfc3", "d": "#f0d381", "f": "#dfe0e1", "g": "#fff9b7", "i": "#fffdc7", "j": "#fcfdf4", "5": "#fbfbf9", "6": "#eef0f0", "X": "#2b2e2d", "x": "#4f5553", "E": "#15161b", "e": "#15161b", "P": "#ffb0a0", "m": "#3a1a10", "t": "#ff8a6a", "H": "#ffffff", "v": "#a68b49"}, "mug": ["c", "V"]}, "mitternacht": {"rows": ["..............fdcdd..............", "......cgjigfdfffffffccbaabW......", "....YacdcccccggaaaggccccccWUQ....", "....YZaccccccggaaaggcccccbWTU....", "...aafggjigdcccccccbbbaZYZWaYU...", "...abfjjjifdcbbaaabbbaaaZZYaYV...", "..ZabgjjjiffdcbbbbbbbbaaaZZbZVT..", "..abcgjjjigffdcbbbcccbbaaZZbZVT..", ".YabdgjjjjgfffdcccdddcbbaaZbZVTO.", ".DIKNTYdbWTRRQQQQQQONNLKJIGRTCBA.", ".ABCCJWbaVIDDDDDDDDDCCCCCBBJOAAA.", ".ABCCJWbaVIDDDDDDDDDDCCCCBBJOAAA.", ".ABCC55555I55555D5555CCC555JOAAA.", ".ABCCJWb55I55DDDD55D55C55B55OAAA.", ".ABCCJ555VI5555DD5555CC55B55OAAA.", ".ABCC55baVI55DDDD55D5CC55B55OAAA.", ".ABCC55555I55555D55D55CC555JOAAA.", ".ABCCJWbaVIDDDDDDDDDDCCCCBBJOAAA.", ".ABCCJWbaVIDDDDDDDDDDCCCCBBJOAAA.", ".ABCCJWbaVIDDDDDDDDDDCCCCBBJOAAA.", ".FKNQUZfcWUTSSSSRRRRQQONLKIRUDCB.", ".FKNQUZfcWUTSSSSRRRRQQONLKIRUDCB.", ".FKNQUZfcWUTSSMLLKKJJIOGFFDOTCAB.", ".FKNQUZfcWUTSSMLLKKJJIOGFFDOTCAB.", ".FKNQUZfcWUTSSM66KK66IOGF66666AB.", ".FKNQUZfcWUTSSM66K66JIOG66DOTCAB.", ".FKNQUZfcWUTSSM6666JJIOG66DOTCAB.", ".FKNQUZfcWUTSSM666KJJIOGF6666CAB.", ".FKNQUZfcWUTSSM6666JJIOGFFDO66AB.", ".FKNQUZfcWUTSSM66K66JIOGFFDO66AB.", ".FKNQUZfcWUTSSM66KK66IOG66666CAB.", ".FKNQUZfcWUTSSMLLKKJJIOGFFDOTCAB.", ".FKNQUZfcWUTSSML6666JIOG666666AB.", ".FKNQUZfcWUTSSM66KK66IOGFF66TCAB.", ".FKNQUZfcWUTSSM66KK66IOGFF66TCAB.", ".FKNQUZfcWUTSSM66KK66IOGFF66TCAB.", ".FKNQUZfcWUTSSM66KK66IOGFF66TCAB.", ".FKNQUZfcWUTSSM66KK66IOGFF66TCAB.", ".FKNQUZfcWUTSSML6666JIOGFF66TCAB.", ".FKNQUZfcWUTSSMLLKKJJIOGFFDOTCAB.", ".FKNQUZfcWUTSSM66KK66IOG66666CAB.", ".FKNQUZfcWUTSSM666K66IOG66DO66AB.", ".FKNQUZfcWUTSSM666666IOG66DO66AB.", ".FKNQUZfcWUTSSM66K666IOG66666CAB.", ".FKNQUZfcWUTSSM66KK66IOG66D66CAB.", ".FKNQUZfcWUTSSM66KK66IOG66DO66AB.", ".FKNQUZfcWUTSSM66KK66IOG66DO66AB.", ".FKNQUZfcWUTSSMLLKKJJIOGFFDOTCAB.", ".FKNQUZfcWUTSSML66666IOGF6666CAB.", ".FKNQUZfcWUTSSM66KKJJIOG66DO66AB.", ".FKWQUZfcWUTSSM66KKJJIOG66DO66AB.", ".FKNQUZfcWUTSSM66K666IOG66DO66AB.", ".FWNYUZfcWUTSSM66KK66IOG66DO66AB.", ".FKNQUZfcWUTSSM66KK66IOG66DO66AB.", ".FKWQZZfcWUTSSML6666JIOGF6666CAB.", ".FKNQUZfcWUTSSMLLKKJJIOGFFDOTCAB.", ".FWNYUffcWUTSSMLLKKJJIOG66DO66AB.", ".FKNQUZfcWUTSSMLLKKJJIOG666O66AB.", ".FKWQZZjcWUTSSMLLKKJJIOG666666AB.", ".FKNQUZfcWUTSSMLLKKJJIOG66D666AB.", ".FWNYUffiWUTSSMLLKKJJIOG66DO66AB.", ".FKNQUZfcWUTSSMLLKKJJIOG66DO66AB.", ".FKWQZZjcWUTSSMLLKKJJIOG66DO66AB.", ".FKNQUZfcWUTSSMLLKKJJIOGFFDOTCAB.", ".FWNYUffiWUTSSMLLKKJJIOGF66666AB.", ".FKNQUZfcWUTSSMLLKKJJIOG66DOTCAB.", ".FKWQZZjccUTSSMLLKKJJIOG66DOTCAB.", ".FKNQUZfcWUTSSMLLKKJJIOG66D666AB.", ".FWNYUffiWaTSSMLLKKJJIOG66DO66AB.", ".FKNQUZfcWUTSSMLLKKJJIOG66DO66AB.", ".FKWQZZjccUZSSMLLKKJJIOGF6666CAB.", ".FKNQUZfcWUTSSMLLKKJJIOGFFDOTCAB.", ".FWNYUffiWaTZSMLLKKJJIOGFFDOTCAB.", ".FKNQUZfcWUTSSSSRRRRQQONLKIRUDCB.", ".FKWQZZjccUZSSSSRRRRQQONLKIRUDCB.", ".FKNQUZfcWUTSSSSRRRRQQONLKIRUDCB.", ".FWNYUffiWaTZSSSRRRRQQONLKIRUDCB.", ".FKNQUZfcWUTSSSSRRRRQQONLKIRUDCB.", ".JQRTVafdYVUUUUUUUUTTTSRQONUUFCB.", ".VWYZdjjjfbaaaZZZZZZZZZYYWWZWTNG.", "...YZdjjjfbaaaZZZZZZZZZYYWWZWT...", "................................."], "palette": {"A": "#0c0d0f", "B": "#0f1013", "C": "#131418", "D": "#17191e", "F": "#1c1e21", "G": "#1f2023", "I": "#212326", "J": "#232428", "K": "#24262b", "L": "#26282c", "M": "#27292d", "N": "#282a30", "O": "#2b2d31", "Q": "#2b2e34", "R": "#303339", "S": "#33363d", "T": "#35373d", "U": "#3c3e45", "V": "#46484d", "W": "#5d6066", "Y": "#6b6d6f", "Z": "#76797f", "a": "#888a8f", "b": "#9b9c9e", "c": "#a2a3a7", "d": "#aeafb1", "f": "#b6b8be", "g": "#d3d5d6", "i": "#e5e6e7", "j": "#fafafa", "5": "#fbfbf9", "6": "#eef0f0", "X": "#2b2e2d", "x": "#4f5553", "E": "#f1f2f6", "e": "#f1f2f6", "P": "#ffb0a0", "m": "#3a1a10", "t": "#ff8a6a", "H": "#c9ccd6", "v": "#2b2e34"}, "mug": ["g", "Z"]}}, "monsti": {"blau": {"rows": ["..................cccccc..................", ".........fggfffccccccccccccccZZZc.........", "......NZcccccccccffccccffccccccccDDA......", ".....DNNZccccccccffDDDDffccccccccDAAA.....", ".....ZZZZcffcccccffffffffcccccZZZDDND.....", "....NZcggggggfccZZZNNNZZZZZZNNNNNDNZDD....", "....ZZcgggggfccccZZZZZZZZZZZZZNNNNNZND....", "...NZZcgggggffccccZZZZZZZZZZZZNNNNNZNDA...", "..NZZcfgggggffcccccZZZZccccZZZZNNNNZNDAA..", "..NZZcfgggggfffcccccccccccccZZZZNNNcNDAA..", ".DNZZcfggggggfffcccccccccccccZZZNNZcNDDAA.", ".BFFGIMadggdaSRRRRQQQQOOMKKIGGGFFCCJJBAAA.", ".CFGIMRbdggdbYUUUUUTTSSRRQOMKIIGFFFJJBBAA.", ".CFGKORbdggdbaYYYWWUUTTSRRQOMKIGGFFJJBBAA.", ".CFGKORbdggdbaYYYWWUUTTSRRQOMKIGGFFJJBBAA.", ".CFGKORbdggdbaYYYWWUUTTSRRQOMKIGGFFJJBBAA.", ".CFGKORbdggdbaYYYWWUUTTSRRQOMKIGGFFJJBBAA.", ".CFGKORbdggdbaYYYWWUUTTSRRQOMKIGGFFJJBBAA.", ".CFG3ORbdggdbaYYYWWUUTTSRRQOMKIGGFFJJ3BAA.", ".CFGK3RbdggdbaYYYWWU3T3SRRQOMKIGGFFJ3BBAA.", ".CFGKO33dggdbaYYYWWUUTTSRRQOMKIGGF63JBBAA.", ".CFGKOR33ggdbaYYYWWUU3TSRRQOMKIGG33JJBBAA.", ".CFGKORbdgg3baYYYWWU443SRRQOMKI3GFFJJBBAA.", ".CFGKORbdg3dbaYYYWW44443RRQOMKI3GFFJJBBAA.", ".CFGKORb773dbaYYYW444443RRQOMK563FFJJBBAA.", ".CFGKOR477773aYYYW444443RRQOM55663FJJBBAA.", ".CFGKOR477773aYYY4444443RRQOM35663FJJBBAA.", ".CFGKOR477773aYYY44444443RQOMK66663JJBBAA.", ".CFGKOR47773baYYY4444443RRQOM56663FJJBBAA.", ".CFGKOR4777743YYY44444443RQO5566663JJBBAA.", ".CFGKOR377773aYYY44444443RQO5566663JJBBAA.", ".CFGKORb777743YYY34444443RQO5566663JJBBAA.", ".CFGKOR4777743YYYW4444443RQO5566663JJBBAA.", ".CFGKOR4777733YYYW4444443RQO5566663JJBBAA.", ".CFGKOR47773baYYYW4444443RQO5566663JJBBAA.", ".CFGKOR47773baYYYW4444453RQO5566663JJBBAA.", ".CFGKOR477773aYYYW4444453RQO556663FJJBBAA.", ".CFGKOR47773baYYY4444443RRQO3566663JJBBAA.", ".CFGKOR477773aYYY44444453RQOM566663JJBBAA.", ".CFGKOR37773baYYY34444453RQO556663FJJBBAA.", ".CFGKORb77773aYYYW4444453RQO556663FJJBBAA.", ".CFGKORb77773aYYY34444453RQO556663FJJBBAA.", ".CFGKORb77773aYYYW4444453RQO556663FJJBBAA.", ".CFGKORb77773aYYYW4444453RQO356663FJJBBAA.", ".CFGKORb77773aYYYW3444553RQOM566663JJBBAA.", ".CFGKORb777743YYYWW44453RRQOM566663JJBBAA.", ".CFGKOR477773aYYYW444453RRQOM666663JJBBAA.", ".CFGKOR4777743YYYW444453RRQOM666663JJBBAA.", ".CFGKOR477773aYYYW4444533RQOM666663JJBBAA.", ".CFGKOR477773aYYYW34443SRRQOM666663JJBBAA.", ".CFGKOR477773aYYYWW4443SRRQOM666663JJBBAA.", ".CFGKOR477773aYYYWW4443SRRQOM666663JJBBAA.", ".CFGKOR4777743YYYWW44453RRQO33666633JBBAA.", ".CFGKOR377773aYYYWW34553RRQOMK6663FJJBBAA.", ".CFGKORb77773aYYYWWU4553RRQOM66663FJJBBAA.", ".CFGKOR477773aYYYWWU3553RRQOM66663FJJBBAA.", ".CFGKOR377773aYYYWWUU553RRQOM666663JJBBAA.", ".CFGKORb77773aYYYWWU453SRRQOM666663JJBBAA.", ".CFGKOR477773aYYYWWU453SRRQOM666663JJBBAA.", ".CFGKOR477733aYYYWWU453SRRQOM366663JJBBAA.", ".CFGKOR4773dbaYYYWWU553SRRQOMK6663FJJBBAA.", ".CFGKOR37773baYYYWWU553SRRQOMK66663JJBBAA.", ".CFGKORb3733baYYYWWU53TSRRQOMK36663JJBBAA.", ".CFGKORbd3gdbaYYYWWU53TSRRQOMKI6663JJBBAA.", ".CFGKORb3773baYYYWWU33TSRRQOMK3663FJJBBAA.", ".CFGKORbd73dbaYYYWWUU3TSRRQOMKI363FJJBBAA.", ".CFGKORb373dbaYYYWWUU3TSRRQOMKIG63FJJBBAA.", ".CFGKORbd73dbaYYYWWUUTTSRRQOMKI63FFJJBBAA.", ".CFGKORbd3gdbaYYYWWUU3TSRRQOMKI363FJJBBAA.", ".CFGKORbd3gdbaYYYWWUUTTSRRQOMKIG63FJJBBAA.", ".CFGKORbd3gdbaYYYWWUUTTSRRQOMKIG63FJJBBAA.", ".CFGKORbd3gdbaYYYWWUUTTSRRQOMKIG3FFJJBBAA.", ".CFGKORbd3gdbaYYYWWUUTTSRRQOMKIGG3FJJBBAA.", ".CFGKORbdggdbaYYYWWUUTTSRRQOMKIGGFFJJBBAA.", ".CFGKORbdggdbaYYYWWUUTTSRRQOMKIGGFFJJBBAA.", ".CFGKORbdggdbaYYYWWUUTTSRRQOMKIGGFFJJBBAA.", ".CFGKORbdggdbaYYYWWUUTTSRRQOMKIGGFFJJBBAA.", ".CF1KOR1d111b1YYY1W111111111111111111BBAA.", ".CF11O111ggd111YY11UUTTSR1QO1KIGG1FJJ1BAA.", ".CF1K1R11ggd11Y1Y11UUTTSR1QO1KIGG1FJJ1BAA.", ".CF1K1R11ggd11Y1Y1W111TSR1QO1111G1111BBAA.", ".CF1KOR11ggd11YY11WUUT1SR1QO1KIGG1F1JBBAA.", ".CF1KOR11ggd11YYY1WUUT1SR1QO1KIGG1FJ1BBAA.", ".CF1KOR1d111b1YYY11111TSR1QO111111FJJ1BAA.", ".CFGKORbdggdbaYYYWWUUTTSRRQOMKIGGFFJJBBAA.", ".CFGKORbdggdbaYYYWWUUTTSRRQOMKIGGFFJJBBAA.", ".CFGKORbdggdbaYYYWWUUTTSRRQOMKIGGFFJJBBAA.", ".CFGKORbd222b22YY222U22SRR22M2I2GFFJJBBAA.", ".CFGKORbd2gdb2Y2Y2WUU2T2R2QOM2I2GFFJJBBAA.", ".CFGKORbd22db2Y2Y22UU22SR2Q2MK2GGFFJJBBAA.", ".CFGKORbd2gdb2Y2Y2WUU2T2R2Q2MK2GGFFJJBBAA.", ".CFGKORbd222b2Y2Y222U2T2RR22MK2GGFFJJBBAA.", ".CFGKORbdggdbaYYYWWUUTTSRRQOMKIGGFFJJBBAA.", ".CFGKORbdggdbaYYYWWUUTTSRRQOMKIGGFFJJBBAA.", ".CFGKORbdggdbaYYYWWUUTTSRRQOMKIGGFFJJBBAA.", ".CFGKORbdggdbaYYYWWUUTTSRRQOMKIGGFFJJBBAA.", ".CFGLMVbdggdbaVVVVVVVVRRRQOOLLLGFFFJJBBAA.", ".DDDNNZfgggfcZZZZNNNNNNNNNNNNNNDDDDZDAAAA.", "..DDNNZfgggfcZZZZNNNNNNNNNNNNNNDDDDZDAAA..", "....NNZfgggfcZZZZNNNNNNNNNNNNNNDDDDZDA....", ".....NZfgggfcZZZZNNNNNNNNNNNNNNDDDDZD.....", ".........................................."], "palette": {"A": "#192f44", "B": "#1f4262", "C": "#255077", "D": "#5d5e61", "F": "#2e6190", "G": "#326ba1", "I": "#3572aa", "J": "#47729b", "K": "#3776b0", "L": "#3e76a9", "M": "#397ab7", "N": "#797a7e", "O": "#3b7ebb", "Q": "#3c81c2", "R": "#4087c8", "S": "#408ace", "T": "#428dd3", "U": "#4390d8", "V": "#4c90cf", "W": "#4493dc", "Y": "#4594dd", "Z": "#909296", "a": "#4a99e1", "b": "#60aaef", "c": "#a7a9ae", "d": "#92dcff", "f": "#cccfd4", "g": "#cdfdfe", "3": "#717479", "7": "#fbffff", "4": "#cbd0d9", "5": "#abb0b7", "6": "#90949a", "1": "#ecf0f6", "2": "#c8dcf0", "X": "#2b2e2d", "x": "#4f5553", "E": "#15161b", "e": "#15161b", "P": "#ffb0b8", "m": "#3a1a10", "t": "#ff8a6a", "H": "#ffffff", "q": "#4594dd"}, "mug": ["Z", "D"]}, "gruen": {"rows": ["..................ffffff..................", ".........fggggfffffffffffffffdcdf.........", "......cdfffffffffggffffggffffffffaZY......", ".....abcdffffffffggbaabggffffffffaZWZ.....", ".....ddddffffffffggggggggfffffdddaaba.....", "....cdfgggggggffddcccccccddccbbbbbbdbZ....", "....cdfggggggfffffdddddddddddccbbbbdbZ....", "...cddfggggggfffffddddddffddddccbbbdbZZ...", "..bcdffggggggffffffdddfffffddddccbcdbaZY..", "..cddffgggggggffffffffffffffdddccbcfbaZY..", ".bcdffggggggggfffffffffffffffdddcccfbaZYW.", ".CCDGKSZbfdaWTQONNMMMMLLLKKJIGFDDCDWWCBAA.", ".CDIKLTZbfdaYUSRQQQQQQOOOMMLLKJGFDIWWCBAA.", ".CDIKMTZbfdaYUSSSSSSRQQOONMLLKJGFDIWWCBAA.", ".CDIKMTZbfdaYUSSSSSSRQQOONMLLKJGFDIWWCBAA.", ".CDIKMTZbfdaYUSSSSSSRQQOONMLLKJGFDIWWCBAA.", ".CDIKMTZbfdaYUSSSSSSRQQOONMLLKJGFDIWWCBAA.", ".CDIKMTZbfdaYUSSSSSSRQQOONMLLKJGFDIWWCBAA.", ".CDI3MTZbfdaYUSSSSSSRQQOONMLLKJGFDIWW3BAA.", ".CDIK3TZbfdaYUSSSSSS3Q3OONMLLKJGFDIW3CBAA.", ".CDIKM33bfdaYUSSSSSSRQQOONMLLKJGFD63WCBAA.", ".CDIKMT33fdaYUSSSSSSR3QOONMLLKJGF33WWCBAA.", ".CDIKMTZbfd3YUSSSSSS443OONMLLKJ3FDIWWCBAA.", ".CDIKMTZbf3aYUSSSSS44443ONMLLKJ3FDIWWCBAA.", ".CDIKMTZ773aYUSSSS444443ONMLLK563DIWWCBAA.", ".CDIKMT477773USSSS444443ONMLL55663IWWCBAA.", ".CDIKMT477773USSS4444443ONMLL35663IWWCBAA.", ".CDIKMT477773USSS44444443NMLLK66663WWCBAA.", ".CDIKMT47773YUSSS4444443ONMLL56663IWWCBAA.", ".CDIKMT4777743SSS44444443NML5566663WWCBAA.", ".CDIKMT377773USSS44444443NML5566663WWCBAA.", ".CDIKMTZ777743SSS34444443NML5566663WWCBAA.", ".CDIKMT4777743SSSS4444443NML5566663WWCBAA.", ".CDIKMT4777733SSSS4444443NML5566663WWCBAA.", ".CDIKMT47773YUSSSS4444443NML5566663WWCBAA.", ".CDIKMT47773YUSSSS4444453NML5566663WWCBAA.", ".CDIKMT477773USSSS4444453NML556663IWWCBAA.", ".CDIKMT47773YUSSS4444443ONML3566663WWCBAA.", ".CDIKMT477773USSS44444453NMLL566663WWCBAA.", ".CDIKMT37773YUSSS34444453NML556663IWWCBAA.", ".CDIKMTZ77773USSSS4444453NML556663IWWCBAA.", ".CDIKMTZ77773USSS34444453NML556663IWWCBAA.", ".CDIKMTZ77773USSSS4444453NML556663IWWCBAA.", ".CDIKMTZ77773USSSS4444453NML356663IWWCBAA.", ".CDIKMTZ77773USSSS3444553NMLL566663WWCBAA.", ".CDIKMTZ777743SSSSS44453ONMLL566663WWCBAA.", ".CDIKMT477773USSSS444453ONMLL666663WWCBAA.", ".CDIKMT4777743SSSS444453ONMLL666663WWCBAA.", ".CDIKMT477773USSSS4444533NMLL666663WWCBAA.", ".CDIKMT477773USSSS34443OONMLL666663WWCBAA.", ".CDIKMT477773USSSSS4443OONMLL666663WWCBAA.", ".CDIKMT477773USSSSS4443OONMLL666663WWCBAA.", ".CDIKMT4777743SSSSS44453ONML33666633WCBAA.", ".CDIKMT377773USSSSS34553ONMLLK6663IWWCBAA.", ".CDIKMTZ77773USSSSSS4553ONMLL66663IWWCBAA.", ".CDIKMT477773USSSSSS3553ONMLL66663IWWCBAA.", ".CDIKMT377773USSSSSSR553ONMLL666663WWCBAA.", ".CDIKMTZ77773USSSSSS453OONMLL666663WWCBAA.", ".CDIKMT477773USSSSSS453OONMLL666663WWCBAA.", ".CDIKMT477733USSSSSS453OONMLL366663WWCBAA.", ".CDIKMT4773aYUSSSSSS553OONMLLK6663IWWCBAA.", ".CDIKMT37773YUSSSSSS553OONMLLK66663WWCBAA.", ".CDIKMTZ3733YUSSSSSS53QOONMLLK36663WWCBAA.", ".CDIKMTZb3daYUSSSSSS53QOONMLLKJ6663WWCBAA.", ".CDIKMTZ3773YUSSSSSS33QOONMLLK3663IWWCBAA.", ".CDIKMTZb73aYUSSSSSSR3QOONMLLKJ363IWWCBAA.", ".CDIKMTZ373aYUSSSSSSR3QOONMLLKJG63IWWCBAA.", ".CDIKMTZb73aYUSSSSSSRQQOONMLLKJ63DIWWCBAA.", ".CDIKMTZb3daYUSSSSSSR3QOONMLLKJ363IWWCBAA.", ".CDIKMTZb3daYUSSSSSSRQQOONMLLKJG63IWWCBAA.", ".CDIKMTZb3daYUSSSSSSRQQOONMLLKJG63IWWCBAA.", ".CDIKMTZb3daYUSSSSSSRQQOONMLLKJG3DIWWCBAA.", ".CDIKMTZb3daYUSSSSSSRQQOONMLLKJGF3IWWCBAA.", ".CDIKMTZbfdaYUSSSSSSRQQOONMLLKJGFDIWWCBAA.", ".CDIKMTZbfdaYUSSSSSSRQQOONMLLKJGFDIWWCBAA.", ".CDIKMTZbfdaYUSSSSSSRQQOONMLLKJGFDIWWCBAA.", ".CDIKMTZbfdaYUSSSSSSRQQOONMLLKJGFDIWWCBAA.", ".CD1KMT1b111Y1SSS1S111111111111111111CBAA.", ".CD11M111fda111SS11SRQQOO1ML1KJGF1IWW1BAA.", ".CD1K1T11fda11S1S11SRQQOO1ML1KJGF1IWW1BAA.", ".CD1K1T11fda11S1S1S111QOO1ML1111F1111CBAA.", ".CD1KMT11fda11SS11SSRQ1OO1ML1KJGF1I1WCBAA.", ".CD1KMT11fda11SSS1SSRQ1OO1ML1KJGF1IW1CBAA.", ".CD1KMT1b111Y1SSS11111QOO1ML111111IWW1BAA.", ".CDIKMTZbfdaYUSSSSSSRQQOONMLLKJGFDIWWCBAA.", ".CDIKMTZbfdaYUSSSSSSRQQOONMLLKJGFDIWWCBAA.", ".CDIKMTZbfdaYUSSSSSSRQQOONMLLKJGFDIWWCBAA.", ".CDIKMTZb222Y22SS222R22OON22L2J2FDIWWCBAA.", ".CDIKMTZb2daY2S2S2SSR2Q2O2MLL2J2FDIWWCBAA.", ".CDIKMTZb22aY2S2S22SR22OO2M2LK2GFDIWWCBAA.", ".CDIKMTZb2daY2S2S2SSR2Q2O2M2LK2GFDIWWCBAA.", ".CDIKMTZb222Y2S2S222R2Q2ON22LK2GFDIWWCBAA.", ".CDIKMTZbfdaYUSSSSSSRQQOONMLLKJGFDIWWCBAA.", ".CDIKMTZbfdaYUSSSSSSRQQOONMLLKJGFDIWWCBAA.", ".CDIKMTZbfdaYUSSSSSSRQQOONMLLKJGFDIWWCBAA.", ".CDIKMTZbfdaYUSSSSSSRQQOONMLLKJGFDIWWCBAA.", ".LSTUVWacffbZWVVVVVVVVVVVVVUUUTTTSTZYJCBB.", ".ZabbcdgggggfdddcccbbbbccccbbbbaaaacaZYVU.", "..abbcdgggggfdddcccbbbbccccbbbbaaaacaZYV..", "....bcdgggggfdddcccbbbbccccbbbbaaaacaZ....", ".....cdgggggfdddcccbbbbccccbbbbaaaaca.....", ".........................................."], "palette": {"A": "#070808", "B": "#0a0a0c", "C": "#0e0e10", "D": "#111113", "F": "#121214", "G": "#121315", "I": "#131315", "J": "#131416", "K": "#141517", "L": "#151618", "M": "#16171a", "N": "#17171a", "O": "#17181b", "Q": "#18191c", "R": "#191a1c", "S": "#191a1d", "T": "#1d1e21", "U": "#1f2023", "V": "#252629", "W": "#2e2f31", "Y": "#313235", "Z": "#3d3d40", "a": "#5b5c5f", "b": "#757679", "c": "#818286", "d": "#909295", "f": "#a5a6ab", "g": "#e8eaec", "3": "#335512", "7": "#93e545", "4": "#6db727", "5": "#5c9b21", "6": "#4e821c", "1": "#e2e4e8", "2": "#7acc2c", "X": "#2b2e2d", "x": "#4f5553", "E": "#f1f2f6", "e": "#f1f2f6", "P": "#ffb0b8", "m": "#3a1a10", "t": "#ff8a6a", "H": "#c9ccd6", "q": "#191a1d"}, "mug": ["d", "a"]}, "lila": {"rows": ["..................dbbbbd..................", ".........dgggdddbddddddddbbbbbWWb.........", "......WbbddbbbbbbddbbbbddbbbbbbbbLCB......", ".....WWWbbbbbbbbbddWLLWddbbbbbbbbLBAB.....", ".....bbbbbddbbbbbddddddddbbbbbbWbDDWW.....", "....WbbgggggggdbbbWWWWWWWbbWWWWWWWWbWC....", "....WbdgggggddbbbbbbbbbbbbbbbWWWWWWbWC....", "...WbbdgggggdddbbbbbbbbbbbbbbWWWWWWbWCB...", "..WWbbdgggggddddbbbbbbbbbbbbbbWWWWWbWDBB..", "..WWbbdggggggddddbbbbbbbbbbbbbbWWWWbWDCB..", ".WWbbbdggggggdddddbbbbbbbbbbbbbbWWWbWDCBA.", ".CDFGJMacgfcZROOOOOONNNMMKKJIGGFDDDLLBBAA.", ".CFIJMOafgfcaYUUUUSSSRQQONNMKJIIGFDLLCBAA.", ".CFIKMRafgfcaZYYYVVUUSRRQONNMKJIGFDLLCBAA.", ".CFIKMRafgfcaZYYYVVUUSRRQONNMKJIGFDLLCBAA.", ".CFIKMRafgfcaZYYYVVUUSRRQONNMKJIGFDLLCBAA.", ".CFIKMRafgfcaZYYYVVUUSRRQONNMKJIGFDLLCBAA.", ".CFIKMRafgfcaZYYYVVUUSRRQONNMKJIGFDLLCBAA.", ".CFI3MRafgfcaZYYYVVUUSRRQONNMKJIGFDLL3BAA.", ".CFIK3RafgfcaZYYYVVU3S3RQONNMKJIGFDL3CBAA.", ".CFIKM33fgfcaZYYYVVUUSRRQONNMKJIGF63LCBAA.", ".CFIKMR33gfcaZYYYVVUU3RRQONNMKJIG33LLCBAA.", ".CFIKMRafgf3aZYYYVVU443RQONNMKJ3GFDLLCBAA.", ".CFIKMRafg3caZYYYVV44443QONNMKJ3GFDLLCBAA.", ".CFIKMRa773caZYYYV444443QONNMK563FDLLCBAA.", ".CFIKMR477773ZYYYV444443QONNM55663DLLCBAA.", ".CFIKMR477773ZYYY4444443QONNM35663DLLCBAA.", ".CFIKMR477773ZYYY44444443ONNMK66663LLCBAA.", ".CFIKMR47773aZYYY4444443QONNM56663DLLCBAA.", ".CFIKMR4777743YYY44444443ONN5566663LLCBAA.", ".CFIKMR377773ZYYY44444443ONN5566663LLCBAA.", ".CFIKMRa777743YYY34444443ONN5566663LLCBAA.", ".CFIKMR4777743YYYV4444443ONN5566663LLCBAA.", ".CFIKMR4777733YYYV4444443ONN5566663LLCBAA.", ".CFIKMR47773aZYYYV4444443ONN5566663LLCBAA.", ".CFIKMR47773aZYYYV4444453ONN5566663LLCBAA.", ".CFIKMR477773ZYYYV4444453ONN556663DLLCBAA.", ".CFIKMR47773aZYYY4444443QONN3566663LLCBAA.", ".CFIKMR477773ZYYY44444453ONNM566663LLCBAA.", ".CFIKMR37773aZYYY34444453ONN556663DLLCBAA.", ".CFIKMRa77773ZYYYV4444453ONN556663DLLCBAA.", ".CFIKMRa77773ZYYY34444453ONN556663DLLCBAA.", ".CFIKMRa77773ZYYYV4444453ONN556663DLLCBAA.", ".CFIKMRa77773ZYYYV4444453ONN356663DLLCBAA.", ".CFIKMRa77773ZYYYV3444553ONNM566663LLCBAA.", ".CFIKMRa777743YYYVV44453QONNM566663LLCBAA.", ".CFIKMR477773ZYYYV444453QONNM666663LLCBAA.", ".CFIKMR4777743YYYV444453QONNM666663LLCBAA.", ".CFIKMR477773ZYYYV4444533ONNM666663LLCBAA.", ".CFIKMR477773ZYYYV34443RQONNM666663LLCBAA.", ".CFIKMR477773ZYYYVV4443RQONNM666663LLCBAA.", ".CFIKMR477773ZYYYVV4443RQONNM666663LLCBAA.", ".CFIKMR4777743YYYVV44453QONN33666633LCBAA.", ".CFIKMR377773ZYYYVV34553QONNMK6663DLLCBAA.", ".CFIKMRa77773ZYYYVVU4553QONNM66663DLLCBAA.", ".CFIKMR477773ZYYYVVU3553QONNM66663DLLCBAA.", ".CFIKMR377773ZYYYVVUU553QONNM666663LLCBAA.", ".CFIKMRa77773ZYYYVVU453RQONNM666663LLCBAA.", ".CFIKMR477773ZYYYVVU453RQONNM666663LLCBAA.", ".CFIKMR477733ZYYYVVU453RQONNM366663LLCBAA.", ".CFIKMR4773caZYYYVVU553RQONNMK6663DLLCBAA.", ".CFIKMR37773aZYYYVVU553RQONNMK66663LLCBAA.", ".CFIKMRa3733aZYYYVVU53RRQONNMK36663LLCBAA.", ".CFIKMRaf3fcaZYYYVVU53RRQONNMKJ6663LLCBAA.", ".CFIKMRa3773aZYYYVVU33RRQONNMK3663DLLCBAA.", ".CFIKMRaf73caZYYYVVUU3RRQONNMKJ363DLLCBAA.", ".CFIKMRa373caZYYYVVUU3RRQONNMKJI63DLLCBAA.", ".CFIKMRaf73caZYYYVVUUSRRQONNMKJ63FDLLCBAA.", ".CFIKMRaf3fcaZYYYVVUU3RRQONNMKJ363DLLCBAA.", ".CFIKMRaf3fcaZYYYVVUUSRRQONNMKJI63DLLCBAA.", ".CFIKMRaf3fcaZYYYVVUUSRRQONNMKJI63DLLCBAA.", ".CFIKMRaf3fcaZYYYVVUUSRRQONNMKJI3FDLLCBAA.", ".CFIKMRaf3fcaZYYYVVUUSRRQONNMKJIG3DLLCBAA.", ".CFIKMRafgfcaZYYYVVUUSRRQONNMKJIGFDLLCBAA.", ".CFIKMRafgfcaZYYYVVUUSRRQONNMKJIGFDLLCBAA.", ".CFIKMRafgfcaZYYYVVUUSRRQONNMKJIGFDLLCBAA.", ".CFIKMRafgfcaZYYYVVUUSRRQONNMKJIGFDLLCBAA.", ".CF1KMR1f111a1YYY1V111111111111111111CBAA.", ".CF11M111gfc111YY11UUSRRQ1NN1KJIG1DLL1BAA.", ".CF1K1R11gfc11Y1Y11UUSRRQ1NN1KJIG1DLL1BAA.", ".CF1K1R11gfc11Y1Y1V111RRQ1NN1111G1111CBAA.", ".CF1KMR11gfc11YY11VUUS1RQ1NN1KJIG1D1LCBAA.", ".CF1KMR11gfc11YYY1VUUS1RQ1NN1KJIG1DL1CBAA.", ".CF1KMR1f111a1YYY11111RRQ1NN111111DLL1BAA.", ".CFIKMRafgfcaZYYYVVUUSRRQONNMKJIGFDLLCBAA.", ".CFIKMRafgfcaZYYYVVUUSRRQONNMKJIGFDLLCBAA.", ".CFIKMRafgfcaZYYYVVUUSRRQONNMKJIGFDLLCBAA.", ".CFIKMRaf222a22YY222U22RQO22M2J2GFDLLCBAA.", ".CFIKMRaf2fca2Y2Y2VUU2R2Q2NNM2J2GFDLLCBAA.", ".CFIKMRaf22ca2Y2Y22UU22RQ2N2MK2IGFDLLCBAA.", ".CFIKMRaf2fca2Y2Y2VUU2R2Q2N2MK2IGFDLLCBAA.", ".CFIKMRaf222a2Y2Y222U2R2QO22MK2IGFDLLCBAA.", ".CFIKMRafgfcaZYYYVVUUSRRQONNMKJIGFDLLCBAA.", ".CFIKMRafgfcaZYYYVVUUSRRQONNMKJIGFDLLCBAA.", ".CFIKMRafgfcaZYYYVVUUSRRQONNMKJIGFDLLCBAA.", ".CFIKMRafgfcaZYYYVVUUSRRQONNMKJIGFDLLCBAA.", ".CFIKNTafggcaZZYYUTTTTTTTOONMKJIGDDLLCBAA.", ".CLWWWbdgggddbbbWWWWWWWWWWWWWWWWLLWWLBBAA.", "..LWWWbdgggddbbbWWWWWWWWWWWWWWWWLLWWLBBA..", "....WWbdgggddbbbWWWWWWWWWWWWWWWWLLWWLB....", ".....WbdgggddbbbWWWWWWWWWWWWWWWWLLWWL.....", ".........................................."], "palette": {"A": "#271537", "B": "#341f46", "C": "#41245a", "D": "#512f6f", "F": "#532c76", "G": "#582f7c", "I": "#5e3183", "J": "#613388", "K": "#65358d", "L": "#664880", "M": "#693894", "N": "#6d3a99", "O": "#713c9f", "Q": "#733da3", "R": "#7740a5", "S": "#7940ab", "T": "#7948a4", "U": "#7c42ad", "V": "#7d42b1", "W": "#797b7e", "Y": "#7e43b1", "Z": "#8348b6", "a": "#955ec6", "b": "#9c9fa3", "c": "#bd83ee", "d": "#c1c3c8", "f": "#e1aafc", "g": "#fbd9fd", "3": "#727177", "7": "#fdfbff", "4": "#cdcbd6", "5": "#adabb4", "6": "#919098", "1": "#f0eef6", "2": "#d2c4e8", "X": "#2b2e2d", "x": "#4f5553", "E": "#15161b", "e": "#15161b", "P": "#ffb0b8", "m": "#3a1a10", "t": "#ff8a6a", "H": "#ffffff", "q": "#7e43b1"}, "mug": ["b", "L"]}, "rosa": {"rows": ["..................RRRRRR..................", ".........cggfccRRRRRRRRRRRRRLLFLR.........", "......FLRRRRRRRRRccRRRRccRRRRRRRRCBA......", ".....CFFLRRRRRRRRccFCCFccRRRRRRRRCAAA.....", ".....LLLLRccRRRRRccccccccRRRRRLLLBBFC.....", "....FLRfgfggfcRRLLLFFFFLLLLLFFFFFFFLFB....", "....LLRfggggcRRRRLLLLLLLLLLLLLFFFFFLFB....", "...FLLRfggggccRRRRLLLLLLLLLLLLFFFFFLFBA...", "..FLLRcgggggccRRRRRLLLLRRRRLLLLFFFFLFBAA..", "..FLLRcgggggcccRRRRRLRRRRRRRLLLLFFFRFBAA..", ".FFLLRcgggggfcccRRRRRRRRRRRRRLLLFFFRFBAAA.", ".CDGJKNafggfbTSSSSSQQQOONMMKJJIGDDDIDBBAA.", ".CDJMNSdfggfdaVVVVVVUUTTSQONMMJJGDDKICBAA.", ".CGJMOSdfggfdbaaZZYWVVUUTSQONMKJIGDKICBAA.", ".CGJMOSdfggfdbaaZZYWVVUUTSQONMKJIGDKICBAA.", ".CGJMOSdfggfdbaaZZYWVVUUTSQONMKJIGDKICBAA.", ".CGJMOSdfggfdbaaZZYWVVUUTSQONMKJIGDKICBAA.", ".CGJMOSdfggfdbaaZZYWVVUUTSQONMKJIGDKICBAA.", ".CGJ3OSdfggfdbaaZZYWVVUUTSQONMKJIGDKI3BAA.", ".CGJM3SdfggfdbaaZZYW3V3UTSQONMKJIGDK3CBAA.", ".CGJMO33fggfdbaaZZYWVVUUTSQONMKJIG63ICBAA.", ".CGJMOS33ggfdbaaZZYWV3UUTSQONMKJI33KICBAA.", ".CGJMOSdfgg3dbaaZZYW443UTSQONMK3IGDKICBAA.", ".CGJMOSdfg3fdbaaZZY44443TSQONMK3IGDKICBAA.", ".CGJMOSd773fdbaaZZ444443TSQONM563GDKICBAA.", ".CGJMOS477773baaZZ444443TSQON55663DKICBAA.", ".CGJMOS477773baaZ4444443TSQON35663DKICBAA.", ".CGJMOS477773baaZ44444443SQONM66663KICBAA.", ".CGJMOS47773dbaaZ4444443TSQON56663DKICBAA.", ".CGJMOS4777743aaZ44444443SQO5566663KICBAA.", ".CGJMOS377773baaZ44444443SQO5566663KICBAA.", ".CGJMOSd777743aaZ34444443SQO5566663KICBAA.", ".CGJMOS4777743aaZZ4444443SQO5566663KICBAA.", ".CGJMOS4777733aaZZ4444443SQO5566663KICBAA.", ".CGJMOS47773dbaaZZ4444443SQO5566663KICBAA.", ".CGJMOS47773dbaaZZ4444453SQO5566663KICBAA.", ".CGJMOS477773baaZZ4444453SQO556663DKICBAA.", ".CGJMOS47773dbaaZ4444443TSQO3566663KICBAA.", ".CGJMOS477773baaZ44444453SQON566663KICBAA.", ".CGJMOS37773dbaaZ34444453SQO556663DKICBAA.", ".CGJMOSd77773baaZZ4444453SQO556663DKICBAA.", ".CGJMOSd77773baaZ34444453SQO556663DKICBAA.", ".CGJMOSd77773baaZZ4444453SQO556663DKICBAA.", ".CGJMOSd77773baaZZ4444453SQO356663DKICBAA.", ".CGJMOSd77773baaZZ3444553SQON566663KICBAA.", ".CGJMOSd777743aaZZY44453TSQON566663KICBAA.", ".CGJMOS477773baaZZ444453TSQON666663KICBAA.", ".CGJMOS4777743aaZZ444453TSQON666663KICBAA.", ".CGJMOS477773baaZZ4444533SQON666663KICBAA.", ".CGJMOS477773baaZZ34443UTSQON666663KICBAA.", ".CGJMOS477773baaZZY4443UTSQON666663KICBAA.", ".CGJMOS477773baaZZY4443UTSQON666663KICBAA.", ".CGJMOS4777743aaZZY44453TSQO33666633ICBAA.", ".CGJMOS377773baaZZY34553TSQONM6663DKICBAA.", ".CGJMOSd77773baaZZYW4553TSQON66663DKICBAA.", ".CGJMOS477773baaZZYW3553TSQON66663DKICBAA.", ".CGJMOS377773baaZZYWV553TSQON666663KICBAA.", ".CGJMOSd77773baaZZYW453UTSQON666663KICBAA.", ".CGJMOS477773baaZZYW453UTSQON666663KICBAA.", ".CGJMOS477733baaZZYW453UTSQON366663KICBAA.", ".CGJMOS4773fdbaaZZYW553UTSQONM6663DKICBAA.", ".CGJMOS37773dbaaZZYW553UTSQONM66663KICBAA.", ".CGJMOSd3733dbaaZZYW53UUTSQONM36663KICBAA.", ".CGJMOSdf3gfdbaaZZYW53UUTSQONMK6663KICBAA.", ".CGJMOSd3773dbaaZZYW33UUTSQONM3663DKICBAA.", ".CGJMOSdf73fdbaaZZYWV3UUTSQONMK363DKICBAA.", ".CGJMOSd373fdbaaZZYWV3UUTSQONMKJ63DKICBAA.", ".CGJMOSdf73fdbaaZZYWVVUUTSQONMK63GDKICBAA.", ".CGJMOSdf3gfdbaaZZYWV3UUTSQONMK363DKICBAA.", ".CGJMOSdf3gfdbaaZZYWVVUUTSQONMKJ63DKICBAA.", ".CGJMOSdf3gfdbaaZZYWVVUUTSQONMKJ63DKICBAA.", ".CGJMOSdf3gfdbaaZZYWVVUUTSQONMKJ3GDKICBAA.", ".CGJMOSdf3gfdbaaZZYWVVUUTSQONMKJI3DKICBAA.", ".CGJMOSdfggfdbaaZZYWVVUUTSQONMKJIGDKICBAA.", ".CGJMOSdfggfdbaaZZYWVVUUTSQONMKJIGDKICBAA.", ".CGJMOSdfggfdbaaZZYWVVUUTSQONMKJIGDKICBAA.", ".CGJMOSdfggfdbaaZZYWVVUUTSQONMKJIGDKICBAA.", ".CG1MOS1f111d1aaZ1Y111111111111111111CBAA.", ".CG11O111ggf111aZ11WVVUUT1QO1MKJI1DKI1BAA.", ".CG1M1S11ggf11a1Z11WVVUUT1QO1MKJI1DKI1BAA.", ".CG1M1S11ggf11a1Z1Y111UUT1QO1111I1111CBAA.", ".CG1MOS11ggf11aa11YWVV1UT1QO1MKJI1D1ICBAA.", ".CG1MOS11ggf11aaZ1YWVV1UT1QO1MKJI1DK1CBAA.", ".CG1MOS1f111d1aaZ11111UUT1QO111111DKI1BAA.", ".CGJMOSdfggfdbaaZZYWVVUUTSQONMKJIGDKICBAA.", ".CGJMOSdfggfdbaaZZYWVVUUTSQONMKJIGDKICBAA.", ".CGJMOSdfggfdbaaZZYWVVUUTSQONMKJIGDKICBAA.", ".CGJMOSdf222d22aZ222V22UTS22N2K2IGDKICBAA.", ".CGJMOSdf2gfd2a2Z2YWV2U2T2QON2K2IGDKICBAA.", ".CGJMOSdf22fd2a2Z22WV22UT2Q2NM2JIGDKICBAA.", ".CGJMOSdf2gfd2a2Z2YWV2U2T2Q2NM2JIGDKICBAA.", ".CGJMOSdf222d2a2Z222V2U2TS22NM2JIGDKICBAA.", ".CGJMOSdfggfdbaaZZYWVVUUTSQONMKJIGDKICBAA.", ".CGJMOSdfggfdbaaZZYWVVUUTSQONMKJIGDKICBAA.", ".CGJMOSdfggfdbaaZZYWVVUUTSQONMKJIGDKICBAA.", ".CGJMOSdfggfdbaaZZYWVVUUTSQONMKJIGDKICBAA.", ".CDIKNSdfggfdYVVVUUUTTSSQQONMKJIGDDKICBAA.", ".BCFFFLcgggcRLLLLFFFFFFFFFFFFFFCCCCFCAAAA.", "..CFFFLcgggcRLLLLFFFFFFFFFFFFFFCCCCFCAAA..", "....FFLcgggcRLLLLFFFFFFFFFFFFFFCCCCFCA....", ".....FLcgggcRLLLLFFFFFFFFFFFFFFCCCCFC.....", ".........................................."], "palette": {"A": "#493139", "B": "#5f404a", "C": "#76515f", "D": "#976275", "F": "#797a7e", "G": "#9f667a", "I": "#a36f81", "J": "#b07187", "K": "#b1788c", "L": "#919397", "M": "#be7a92", "N": "#c57f98", "O": "#ca839c", "Q": "#d187a1", "R": "#a7a9ae", "S": "#d78ca6", "T": "#db8da8", "U": "#e191ad", "V": "#e795b2", "W": "#eb97b4", "Y": "#ec98b6", "Z": "#ee99b7", "a": "#ef9ab8", "b": "#f39fbc", "c": "#ccced3", "d": "#fab0cc", "f": "#fee2f6", "g": "#fefeff", "3": "#7d7d7e", "7": "#ffffff", "4": "#e1e1e2", "5": "#bebebf", "6": "#a0a0a1", "1": "#783c54", "2": "#faecf2", "X": "#2b2e2d", "x": "#4f5553", "E": "#15161b", "e": "#15161b", "P": "#ffb0b8", "m": "#3a1a10", "t": "#ff8a6a", "H": "#ffffff", "q": "#ef9ab8"}, "mug": ["L", "C"]}, "gold": {"rows": ["..................ZZZZZZ..................", ".........ZggggZZZZZZZZZZZZZZZNNNZ.........", "......NZZZZZZZZZZggZZZZggZZZZZZZZDDA......", ".....DDNNZZZZZZZZggDDDDggZZZZZZZZDAAA.....", ".....NNZNZZZZZZZZggggggggZZZZZNNNDDDD.....", "....NNZgggggggZZZNNNNNNNNNNNNNNNNDNNDD....", "....NZZggggggZZZZZZNNNNNZZNNNNNNNDNZDD....", "...NNZZggggggZZZZZZZNNZZZZZZNNNNNDNZDDA...", "..NNNZZggggggZZZZZZZZZZZZZZZZNNNNNNZDDAA..", "..NNZZZggggggZZZZZZZZZZZZZZZZZNNNNNZNDAA..", ".DNNZZZgggggggZZZZZZZZZZZZZZZZNNNNNZNDAAA.", ".BCCFILYdffcYQOOOOOOOMMMLKKIIFFCCCCGGBAAA.", ".BCFKLOadffcaVTTTTTSSRRQOOMLKKIFFCCJGBBAA.", ".BCIKMQadffcaWVVVVUUTSSRQOOMLKIIFCCJGBBAA.", ".BCIKMQadffcaWVVVVUUTSSRQOOMLKIIFCCJGBBAA.", ".BCIKMQadffcaWVVVVUUTSSRQOOMLKIIFCCJGBBAA.", ".BCIKMQadffcaWVVVVUUTSSRQOOMLKIIFCCJGBBAA.", ".BCIKMQadffcaWVVVVUUTSSRQOOMLKIIFCCJGBBAA.", ".BCI3MQadffcaWVVVVUUTSSRQOOMLKIIFCCJG3BAA.", ".BCIK3QadffcaWVVVVUU3S3RQOOMLKIIFCCJ3BBAA.", ".BCIKM33dffcaWVVVVUUTSSRQOOMLKIIFC63GBBAA.", ".BCIKMQ33ffcaWVVVVUUT3SRQOOMLKIIF33JGBBAA.", ".BCIKMQadff3aWVVVVUU443RQOOMLKI3FCCJGBBAA.", ".BCIKMQadf3caWVVVVU44443QOOMLKI3FCCJGBBAA.", ".BCIKMQa773caWVVVV444443QOOMLK563CCJGBBAA.", ".BCIKMQ477773WVVVV444443QOOML55663CJGBBAA.", ".BCIKMQ477773WVVV4444443QOOML35663CJGBBAA.", ".BCIKMQ477773WVVV44444443OOMLK66663JGBBAA.", ".BCIKMQ47773aWVVV4444443QOOML56663CJGBBAA.", ".BCIKMQ4777743VVV44444443OOM5566663JGBBAA.", ".BCIKMQ377773WVVV44444443OOM5566663JGBBAA.", ".BCIKMQa777743VVV34444443OOM5566663JGBBAA.", ".BCIKMQ4777743VVVV4444443OOM5566663JGBBAA.", ".BCIKMQ4777733VVVV4444443OOM5566663JGBBAA.", ".BCIKMQ47773aWVVVV4444443OOM5566663JGBBAA.", ".BCIKMQ47773aWVVVV4444453OOM5566663JGBBAA.", ".BCIKMQ477773WVVVV4444453OOM556663CJGBBAA.", ".BCIKMQ47773aWVVV4444443QOOM3566663JGBBAA.", ".BCIKMQ477773WVVV44444453OOML566663JGBBAA.", ".BCIKMQ37773aWVVV34444453OOM556663CJGBBAA.", ".BCIKMQa77773WVVVV4444453OOM556663CJGBBAA.", ".BCIKMQa77773WVVV34444453OOM556663CJGBBAA.", ".BCIKMQa77773WVVVV4444453OOM556663CJGBBAA.", ".BCIKMQa77773WVVVV4444453OOM356663CJGBBAA.", ".BCIKMQa77773WVVVV3444553OOML566663JGBBAA.", ".BCIKMQa777743VVVVU44453QOOML566663JGBBAA.", ".BCIKMQ477773WVVVV444453QOOML666663JGBBAA.", ".BCIKMQ4777743VVVV444453QOOML666663JGBBAA.", ".BCIKMQ477773WVVVV4444533OOML666663JGBBAA.", ".BCIKMQ477773WVVVV34443RQOOML666663JGBBAA.", ".BCIKMQ477773WVVVVU4443RQOOML666663JGBBAA.", ".BCIKMQ477773WVVVVU4443RQOOML666663JGBBAA.", ".BCIKMQ4777743VVVVU44453QOOM33666633GBBAA.", ".BCIKMQ377773WVVVVU34553QOOMLK6663CJGBBAA.", ".BCIKMQa77773WVVVVUU4553QOOML66663CJGBBAA.", ".BCIKMQ477773WVVVVUU3553QOOML66663CJGBBAA.", ".BCIKMQ377773WVVVVUUT553QOOML666663JGBBAA.", ".BCIKMQa77773WVVVVUU453RQOOML666663JGBBAA.", ".BCIKMQ477773WVVVVUU453RQOOML666663JGBBAA.", ".BCIKMQ477733WVVVVUU453RQOOML366663JGBBAA.", ".BCIKMQ4773caWVVVVUU553RQOOMLK6663CJGBBAA.", ".BCIKMQ37773aWVVVVUU553RQOOMLK66663JGBBAA.", ".BCIKMQa3733aWVVVVUU53SRQOOMLK36663JGBBAA.", ".BCIKMQad3fcaWVVVVUU53SRQOOMLKI6663JGBBAA.", ".BCIKMQa3773aWVVVVUU33SRQOOMLK3663CJGBBAA.", ".BCIKMQad73caWVVVVUUT3SRQOOMLKI363CJGBBAA.", ".BCIKMQa373caWVVVVUUT3SRQOOMLKII63CJGBBAA.", ".BCIKMQad73caWVVVVUUTSSRQOOMLKI63CCJGBBAA.", ".BCIKMQad3fcaWVVVVUUT3SRQOOMLKI363CJGBBAA.", ".BCIKMQad3fcaWVVVVUUTSSRQOOMLKII63CJGBBAA.", ".BCIKMQad3fcaWVVVVUUTSSRQOOMLKII63CJGBBAA.", ".BCIKMQad3fcaWVVVVUUTSSRQOOMLKII3CCJGBBAA.", ".BCIKMQad3fcaWVVVVUUTSSRQOOMLKIIF3CJGBBAA.", ".BCIKMQadffcaWVVVVUUTSSRQOOMLKIIFCCJGBBAA.", ".BCIKMQadffcaWVVVVUUTSSRQOOMLKIIFCCJGBBAA.", ".BCIKMQadffcaWVVVVUUTSSRQOOMLKIIFCCJGBBAA.", ".BCIKMQadffcaWVVVVUUTSSRQOOMLKIIFCCJGBBAA.", ".BC1KMQ1d111a1VVV1U111111111111111111BBAA.", ".BC11M111ffc111VV11UTSSRQ1OM1KIIF1CJG1BAA.", ".BC1K1Q11ffc11V1V11UTSSRQ1OM1KIIF1CJG1BAA.", ".BC1K1Q11ffc11V1V1U111SRQ1OM1111F1111BBAA.", ".BC1KMQ11ffc11VV11UUTS1RQ1OM1KIIF1C1GBBAA.", ".BC1KMQ11ffc11VVV1UUTS1RQ1OM1KIIF1CJ1BBAA.", ".BC1KMQ1d111a1VVV11111SRQ1OM111111CJG1BAA.", ".BCIKMQadffcaWVVVVUUTSSRQOOMLKIIFCCJGBBAA.", ".BCIKMQadffcaWVVVVUUTSSRQOOMLKIIFCCJGBBAA.", ".BCIKMQadffcaWVVVVUUTSSRQOOMLKIIFCCJGBBAA.", ".BCIKMQad222a22VV222T22RQO22L2I2FCCJGBBAA.", ".BCIKMQad2fca2V2V2UUT2S2Q2OML2I2FCCJGBBAA.", ".BCIKMQad22ca2V2V22UT22RQ2O2LK2IFCCJGBBAA.", ".BCIKMQad2fca2V2V2UUT2S2Q2O2LK2IFCCJGBBAA.", ".BCIKMQad222a2V2V222T2S2QO22LK2IFCCJGBBAA.", ".BCIKMQadffcaWVVVVUUTSSRQOOMLKIIFCCJGBBAA.", ".BCIKMQadffcaWVVVVUUTSSRQOOMLKIIFCCJGBBAA.", ".BCIKMQadffcaWVVVVUUTSSRQOOMLKIIFCCJGBBAA.", ".BCIKMQadffcaWVVVVUUTSSRQOOMLKIIFCCJGBBAA.", ".BCFKLQbdffcaYYYYSSRQQQQOMMLKKIFFCCJGBAAA.", ".DDDNNZgggggZZNNNNNNNNNNNNNNNDDDDDDNDAAAA.", "..DDNNZgggggZZNNNNNNNNNNNNNNNDDDDDDNDAAA..", "....DNZgggggZZNNNNNNNNNNNNNNNDDDDDDNDA....", ".....NZgggggZZNNNNNNNNNNNNNNNDDDDDDND.....", ".........................................."], "palette": {"A": "#433717", "B": "#68531e", "C": "#8f732a", "D": "#626466", "F": "#9a7b2c", "G": "#957e42", "I": "#a4832f", "J": "#9f8645", "K": "#ae8c32", "L": "#b59134", "M": "#ba9536", "N": "#828487", "O": "#c29c38", "Q": "#c8a13c", "R": "#cda43b", "S": "#d1a83c", "T": "#d5ab3d", "U": "#d8ae3e", "V": "#dbaf3f", "W": "#dfb444", "Y": "#d7b151", "Z": "#a5a8ac", "a": "#edc45a", "b": "#e7c56d", "c": "#ffed7f", "d": "#fff898", "f": "#ffffbb", "g": "#e9eaed", "3": "#7e7d78", "7": "#ffffff", "4": "#e2e1d8", "5": "#bfbeb6", "6": "#a1a099", "1": "#6e5014", "2": "#fcf0c8", "X": "#2b2e2d", "x": "#4f5553", "E": "#15161b", "e": "#15161b", "P": "#ffb0b8", "m": "#3a1a10", "t": "#ff8a6a", "H": "#ffffff", "q": "#dbaf3f"}, "mug": ["Z", "D"]}, "mitternacht": {"rows": ["..................dddddd..................", ".........fgggffdddddddddddddccbbc.........", "......bcdddddddddffdccdffdddddddcaZW......", ".....aabcddddddddffaaaaffddddddddaYVW.....", ".....ccccdffdddddffffffffddddccbcZZaa.....", "....bcdggggggfddccbbbbbbbccbbbbbbabcaZ....", "....bcdgggggfddddccccccccccccbbbbabcaZ....", "...bccdgggggffddddccccccccccccbbbabcaZY...", "..bbccfgggggffddddccccccdcccccbbbbbcbZYW..", "..bccdfgggggfffddddcccdddddccccbbbbcbZYW..", ".abccdfggggggfffddddddddddddccccbbbdbZZWV.", ".CDDFIQZbdcaYUNNMMMMMLLKKJJIGFFDDDDWWCBAA.", ".CDFIKUZbdcaYVSRRRROOONNMLLKJIGFFDFWWCBBA.", ".CDGJLUZbdcaYVSSSSSRRQOONMMLKJIGFDFWWCBBA.", ".CDGJLUZbdcaYVSSSSSRRQOONMMLKJIGFDFWWCBBA.", ".CDGJLUZbdcaYVSSSSSRRQOONMMLKJIGFDFWWCBBA.", ".CDGJLUZbdcaYVSSSSSRRQOONMMLKJIGFDFWWCBBA.", ".CDGJLUZbdcaYVSSSSSRRQOONMMLKJIGFDFWWCBBA.", ".CDG3LUZbdcaYVSSSSSRRQOONMMLKJIGFDFWW3BBA.", ".CDGJ3UZbdcaYVSSSSSR3Q3ONMMLKJIGFDFW3CBBA.", ".CDGJL33bdcaYVSSSSSRRQOONMMLKJIGFD63WCBBA.", ".CDGJLU33dcaYVSSSSSRR3OONMMLKJIGF33WWCBBA.", ".CDGJLUZbdc3YVSSSSSR443ONMMLKJI3FDFWWCBBA.", ".CDGJLUZbd3aYVSSSSS44443NMMLKJI3FDFWWCBBA.", ".CDGJLUZ773aYVSSSS444443NMMLKJ563DFWWCBBA.", ".CDGJLU477773VSSSS444443NMMLK55663FWWCBBA.", ".CDGJLU477773VSSS4444443NMMLK35663FWWCBBA.", ".CDGJLU477773VSSS44444443MMLKJ66663WWCBBA.", ".CDGJLU47773YVSSS4444443NMMLK56663FWWCBBA.", ".CDGJLU4777743SSS44444443MML5566663WWCBBA.", ".CDGJLU377773VSSS44444443MML5566663WWCBBA.", ".CDGJLUZ777743SSS34444443MML5566663WWCBBA.", ".CDGJLU4777743SSSS4444443MML5566663WWCBBA.", ".CDGJLU4777733SSSS4444443MML5566663WWCBBA.", ".CDGJLU47773YVSSSS4444443MML5566663WWCBBA.", ".CDGJLU47773YVSSSS4444453MML5566663WWCBBA.", ".CDGJLU477773VSSSS4444453MML556663FWWCBBA.", ".CDGJLU47773YVSSS4444443NMML3566663WWCBBA.", ".CDGJLU477773VSSS44444453MMLK566663WWCBBA.", ".CDGJLU37773YVSSS34444453MML556663FWWCBBA.", ".CDGJLUZ77773VSSSS4444453MML556663FWWCBBA.", ".CDGJLUZ77773VSSS34444453MML556663FWWCBBA.", ".CDGJLUZ77773VSSSS4444453MML556663FWWCBBA.", ".CDGJLUZ77773VSSSS4444453MML356663FWWCBBA.", ".CDGJLUZ77773VSSSS3444553MMLK566663WWCBBA.", ".CDGJLUZ777743SSSSS44453NMMLK566663WWCBBA.", ".CDGJLU477773VSSSS444453NMMLK666663WWCBBA.", ".CDGJLU4777743SSSS444453NMMLK666663WWCBBA.", ".CDGJLU477773VSSSS4444533MMLK666663WWCBBA.", ".CDGJLU477773VSSSS34443ONMMLK666663WWCBBA.", ".CDGJLU477773VSSSSS4443ONMMLK666663WWCBBA.", ".CDGJLU477773VSSSSS4443ONMMLK666663WWCBBA.", ".CDGJLU4777743SSSSS44453NMML33666633WCBBA.", ".CDGJLU377773VSSSSS34553NMMLKJ6663FWWCBBA.", ".CDGJLUZ77773VSSSSSR4553NMMLK66663FWWCBBA.", ".CDGJLU477773VSSSSSR3553NMMLK66663FWWCBBA.", ".CDGJLU377773VSSSSSRR553NMMLK666663WWCBBA.", ".CDGJLUZ77773VSSSSSR453ONMMLK666663WWCBBA.", ".CDGJLU477773VSSSSSR453ONMMLK666663WWCBBA.", ".CDGJLU477733VSSSSSR453ONMMLK366663WWCBBA.", ".CDGJLU4773aYVSSSSSR553ONMMLKJ6663FWWCBBA.", ".CDGJLU37773YVSSSSSR553ONMMLKJ66663WWCBBA.", ".CDGJLUZ3733YVSSSSSR53OONMMLKJ36663WWCBBA.", ".CDGJLUZb3caYVSSSSSR53OONMMLKJI6663WWCBBA.", ".CDGJLUZ3773YVSSSSSR33OONMMLKJ3663FWWCBBA.", ".CDGJLUZb73aYVSSSSSRR3OONMMLKJI363FWWCBBA.", ".CDGJLUZ373aYVSSSSSRR3OONMMLKJIG63FWWCBBA.", ".CDGJLUZb73aYVSSSSSRRQOONMMLKJI63DFWWCBBA.", ".CDGJLUZb3caYVSSSSSRR3OONMMLKJI363FWWCBBA.", ".CDGJLUZb3caYVSSSSSRRQOONMMLKJIG63FWWCBBA.", ".CDGJLUZb3caYVSSSSSRRQOONMMLKJIG63FWWCBBA.", ".CDGJLUZb3caYVSSSSSRRQOONMMLKJIG3DFWWCBBA.", ".CDGJLUZb3caYVSSSSSRRQOONMMLKJIGF3FWWCBBA.", ".CDGJLUZbdcaYVSSSSSRRQOONMMLKJIGFDFWWCBBA.", ".CDGJLUZbdcaYVSSSSSRRQOONMMLKJIGFDFWWCBBA.", ".CDGJLUZbdcaYVSSSSSRRQOONMMLKJIGFDFWWCBBA.", ".CDGJLUZbdcaYVSSSSSRRQOONMMLKJIGFDFWWCBBA.", ".CD1JLU1b111Y1SSS1S111111111111111111CBBA.", ".CD11L111dca111SS11RRQOON1ML1JIGF1FWW1BBA.", ".CD1J1U11dca11S1S11RRQOON1ML1JIGF1FWW1BBA.", ".CD1J1U11dca11S1S1S111OON1ML1111F1111CBBA.", ".CD1JLU11dca11SS11SRRQ1ON1ML1JIGF1F1WCBBA.", ".CD1JLU11dca11SSS1SRRQ1ON1ML1JIGF1FW1CBBA.", ".CD1JLU1b111Y1SSS11111OON1ML111111FWW1BBA.", ".CDGJLUZbdcaYVSSSSSRRQOONMMLKJIGFDFWWCBBA.", ".CDGJLUZbdcaYVSSSSSRRQOONMMLKJIGFDFWWCBBA.", ".CDGJLUZbdcaYVSSSSSRRQOONMMLKJIGFDFWWCBBA.", ".CDGJLUZb222Y22SS222R22ONM22K2I2FDFWWCBBA.", ".CDGJLUZb2caY2S2S2SRR2O2N2MLK2I2FDFWWCBBA.", ".CDGJLUZb22aY2S2S22RR22ON2M2KJ2GFDFWWCBBA.", ".CDGJLUZb2caY2S2S2SRR2O2N2M2KJ2GFDFWWCBBA.", ".CDGJLUZb222Y2S2S222R2O2NM22KJ2GFDFWWCBBA.", ".CDGJLUZbdcaYVSSSSSRRQOONMMLKJIGFDFWWCBBA.", ".CDGJLUZbdcaYVSSSSSRRQOONMMLKJIGFDFWWCBBA.", ".CDGJLUZbdcaYVSSSSSRRQOONMMLKJIGFDFWWCBBA.", ".CDGJLUZbdcaYVSSSSSRRQOONMMLKJIGFDFWWCBBA.", ".FNTUVWacddbZYWWWWWVVVVVVVVVVUTTOMQYYDCBB.", ".ZaabbcfgggfdcccbbbbbbbbbbbbbaaaaaabaYWTM.", "..aabbcfgggfdcccbbbbbbbbbbbbbaaaaaabaYWT..", "....bbcfgggfdcccbbbbbbbbbbbbbaaaaaabaY....", ".....bcfgggfdcccbbbbbbbbbbbbbaaaaaaba.....", ".........................................."], "palette": {"A": "#0a0a0c", "B": "#0d0d10", "C": "#121316", "D": "#17181c", "F": "#19191e", "G": "#1a1b20", "I": "#1b1c21", "J": "#1c1d22", "K": "#1d1e24", "L": "#1e1f25", "M": "#1f2026", "N": "#202127", "O": "#212228", "Q": "#222329", "R": "#22232a", "S": "#23242b", "T": "#252629", "U": "#26272d", "V": "#292a31", "W": "#343438", "Y": "#3b3c43", "Z": "#46464c", "a": "#65666b", "b": "#7e7f84", "c": "#96989d", "d": "#a8aab0", "f": "#ccced3", "g": "#f9fafb", "3": "#494c52", "7": "#c9cfdd", "4": "#9ea3b0", "5": "#858a94", "6": "#70747d", "1": "#c8ccd6", "2": "#969caa", "X": "#2b2e2d", "x": "#4f5553", "E": "#f1f2f6", "e": "#f1f2f6", "P": "#ffb0b8", "m": "#3a1a10", "t": "#ff8a6a", "H": "#c9ccd6", "q": "#23242b"}, "mug": ["c", "a"]}}};
  const MONSTI = [
    '..................MLJJLM..................',
    '.........QddWTQMLMMMMMMMMJJJGFDDI.........',
    '......DFJMMJJJJJJTTJIIJTTJJJJJJJIBAA......',
    '.....BCDFJJJJJJJJTTBBBBTTJJJJJJJJBAAA.....',
    '.....FFGFJQQLJJJJRRRRRRRRJJJJIFDFAACB.....',
    '....DFLYfbddZVMJGFDDDDDDDFFDDCCCCCCFCA....',
    '....DFMZgggdRMLJJGFFFFFFFFFFFDDDCCCFCA....',
    '...DFGMbgggdSOMLJJGFFFFGGGGFFFDDCCDGCAA...',
    '..DDFIOcgggfTQMMLJIGGGGIJJIGFFFDDCDGCAAA..',
    '..DFFJQdgggfVROMMLJIGIJJJJJIGFFDDDDICAAA..',
    '.CDFGJRdgggfWSQOMMJJJJJJJJJJIGFFDDDJCAAAA.',
    '.CFIKNQWggggZUTTTTTSSSRRQOONLKKIFFDGFBBAA.',
    '.DGLNQScggggdaYYYYWWVVUUTSRQONLKIGFKGCBAA.',
    '.DILORTdgggggcbbaaZZYWVVUTSRQONLKGFKICBAA.',
    '.DILORTdgggggcbbaaZZYWVVUTSRQONLKGFKICBAA.',
    '.DILORTdgggggcbbaaZZYWVVUTSRQONLKGFKICBAA.',
    '.DILORTdgggggcbbaaZZYWVVUTSRQONLKGFKICBAA.',
    '.DILORTdgggggcbbaaZZYWVVUTSRQONLKGFKICBAA.',
    '.DIL3RTdgggggcbbaaZZYWVVUTSRQONLKGFKI3BAA.',
    '.DILO3TdgggggcbbaaZZ3W3VUTSRQONLKGFK3CBAA.',
    '.DILOR33gggggcbbaaZZYWVVUTSRQONLKG63ICBAA.',
    '.DILORT33ggggcbbaaZZY3VVUTSRQONLK33KICBAA.',
    '.DILORTdggg3gcbbaaZZ443VUTSRQON3KGFKICBAA.',
    '.DILORTdgg3ggcbbaaZ44443UTSRQON3KGFKICBAA.',
    '.DILORTd773ggcbbaa444443UTSRQO563GFKICBAA.',
    '.DILORT477773cbbaa444443UTSRQ55663FKICBAA.',
    '.DILORT477773cbba4444443UTSRQ35663FKICBAA.',
    '.DILORT477773cbba44444443TSRQO66663KICBAA.',
    '.DILORT47773gcbba4444443UTSRQ56663FKICBAA.',
    '.DILORT4777743bba44444443TSR5566663KICBAA.',
    '.DILORT377773cbba44444443TSR5566663KICBAA.',
    '.DILORTd777743bba34444443TSR5566663KICBAA.',
    '.DILORT4777743bbaa4444443TSR5566663KICBAA.',
    '.DILORT4777733bbaa4444443TSR5566663KICBAA.',
    '.DILORT47773gcbbaa4444443TSR5566663KICBAA.',
    '.DILORT47773gcbbaa4444453TSR5566663KICBAA.',
    '.DILORT477773cbbaa4444453TSR556663FKICBAA.',
    '.DILORT47773gcbba4444443UTSR3566663KICBAA.',
    '.DILORT477773cbba44444453TSRQ566663KICBAA.',
    '.DILORT37773gcbba34444453TSR556663FKICBAA.',
    '.DILORTd77773cbbaa4444453TSR556663FKICBAA.',
    '.DILORTd77773cbba34444453TSR556663FKICBAA.',
    '.DILORTd77773cbbaa4444453TSR556663FKICBAA.',
    '.DILORTd77773cbbaa4444453TSR356663FKICBAA.',
    '.DILORTd77773cbbaa3444553TSRQ566663KICBAA.',
    '.DILORTd777743bbaaZ44453UTSRQ566663KICBAA.',
    '.DILORT477773cbbaa444453UTSRQ666663KICBAA.',
    '.DILORT4777743bbaa444453UTSRQ666663KICBAA.',
    '.DILORT477773cbbaa4444533TSRQ666663KICBAA.',
    '.DILORT477773cbbaa34443VUTSRQ666663KICBAA.',
    '.DILORT477773cbbaaZ4443VUTSRQ666663KICBAA.',
    '.DILORT477773cbbaaZ4443VUTSRQ666663KICBAA.',
    '.DILORT4777743bbaaZ44453UTSR33666633ICBAA.',
    '.DILORT377773cbbaaZ34553UTSRQO6663FKICBAA.',
    '.DILORTd77773cbbaaZZ4553UTSRQ66663FKICBAA.',
    '.DILORT477773cbbaaZZ3553UTSRQ66663FKICBAA.',
    '.DILORT377773cbbaaZZY553UTSRQ666663KICBAA.',
    '.DILORTd77773cbbaaZZ453VUTSRQ666663KICBAA.',
    '.DILORT477773cbbaaZZ453VUTSRQ666663KICBAA.',
    '.DILORT477733cbbaaZZ453VUTSRQ366663KICBAA.',
    '.DILORT4773ggcbbaaZZ553VUTSRQO6663FKICBAA.',
    '.DILORT37773gcbbaaZZ553VUTSRQO66663KICBAA.',
    '.DILORTd3733gcbbaaZZ53VVUTSRQO36663KICBAA.',
    '.DILORTdg3gggcbbaaZZ53VVUTSRQON6663KICBAA.',
    '.DILORTd3773gcbbaaZZ33VVUTSRQO3663FKICBAA.',
    '.DILORTdg73ggcbbaaZZY3VVUTSRQON363FKICBAA.',
    '.DILORTd373ggcbbaaZZY3VVUTSRQONL63FKICBAA.',
    '.DILORTdg73ggcbbaaZZYWVVUTSRQON63GFKICBAA.',
    '.DILORTdg3gggcbbaaZZY3VVUTSRQON363FKICBAA.',
    '.DILORTdg3gggcbbaaZZYWVVUTSRQONL63FKICBAA.',
    '.DILORTdg3gggcbbaaZZYWVVUTSRQONL63FKICBAA.',
    '.DILORTdg3gggcbbaaZZYWVVUTSRQONL3GFKICBAA.',
    '.DILORTdg3gggcbbaaZZYWVVUTSRQONLK3FKICBAA.',
    '.DILORTdgggggcbbaaZZYWVVUTSRQONLKGFKICBAA.',
    '.DILORTdgggggcbbaaZZYWVVUTSRQONLKGFKICBAA.',
    '.DILORTdgggggcbbaaZZYWVVUTSRQONLKGFKICBAA.',
    '.DILORTdgggggcbbaaZZYWVVUTSRQONLKGFKICBAA.',
    '.DI1ORT1g111g1bba1Z111111111111111111CBAA.',
    '.DI11R111ggg111ba11ZYWVVU1SR1ONLK1FKI1BAA.',
    '.DI1O1T11ggg11b1a11ZYWVVU1SR1ONLK1FKI1BAA.',
    '.DI1O1T11ggg11b1a1Z111VVU1SR1111K1111CBAA.',
    '.DI1ORT11ggg11bb11ZZYW1VU1SR1ONLK1F1ICBAA.',
    '.DI1ORT11ggg11bba1ZZYW1VU1SR1ONLK1FK1CBAA.',
    '.DI1ORT1g111g1bba11111VVU1SR111111FKI1BAA.',
    '.DILORTdgggggcbbaaZZYWVVUTSRQONLKGFKICBAA.',
    '.DILORTdgggggcbbaaZZYWVVUTSRQONLKGFKICBAA.',
    '.DILORTdgggggcbbaaZZYWVVUTSRQONLKGFKICBAA.',
    '.DILORTdg222g22ba222Y22VUT22Q2N2KGFKICBAA.',
    '.DILORTdg2ggg2b2a2ZZY2V2U2SRQ2N2KGFKICBAA.',
    '.DILORTdg22gg2b2a22ZY22VU2S2QO2LKGFKICBAA.',
    '.DILORTdg2ggg2b2a2ZZY2V2U2S2QO2LKGFKICBAA.',
    '.DILORTdg222g2b2a222Y2V2UT22QO2LKGFKICBAA.',
    '.DILORTdgggggcbbaaZZYWVVUTSRQONLKGFKICBAA.',
    '.DILORTdgggggcbbaaZZYWVVUTSRQONLKGFKICBAA.',
    '.DILORTdgggggcbbaaZZYWVVUTSRQONLKGFKICBAA.',
    '.DILORTdgggggcbbaaZZYWVVUTSRQONLKGFKICBAA.',
    '.CFKNOScgggfcYWVVVVUUTTSSRQOONLKIFFKFCBAA.',
    '.ABCCDGSggfUMGFFDDDDCCDDDDDDCCCBBBBDBAAAA.',
    '..BCCDGSggfUMGFFDDDDCCDDDDDDCCCBBBBDBAAA..',
    '....CDGSggfUMGFFDDDDCCDDDDDDCCCBBBBDBA....',
    '.....DGSggfUMGFFDDDDCCDDDDDDCCCBBBBDB.....',
    '..........................................',
  ];

  const FUN_ACTIONS = ['pushups', 'moonwalk', 'breakdance', 'handstand', 'roll', 'boxing', 'selfie', 'phone', 'newspaper', 'fart'];
  const ORANGI = [
    '..............ZYYYZ..............',
    '......YcgfcbZZZZZZZZYVUSQUM......',
    '....NSYZYYYYYbcRRRcbYYYYYVMJF....',
    '....NNRVYYYYYbcRRRcbYYYYYUMGI....',
    '...QSZbbgfbYVVVVVVVUTTRQNQMQMJ...',
    '...RTbijjfbZYUSRRSSSSRRQQNNRNK...',
    '..QRUbijjfbZZYUTSTUUUTSRQNNSNKG..',
    '..QSVcjjjgbbZYVUUUVVVUTSRQNTNKG..',
    '.NRTYcjjjgcbbZYVVVYYYVUSRQQTNKGF.',
    '.MNNRZijicYUTSRQQQRRRQQNNMMRMIFC.',
    '.LLLLOWddWOOOOOOOOOOOOLLLLLLLDDD.',
    '.LLLOOWddWOOOOOOOOOOOOLLLLLLLDDD.',
    '.LL55OW555OOO55OO5OO5OL555L5555D.',
    '.L5LO5W5dW5O5OO5O55O5O5LLLL5LDDD.',
    '.L5LO5W555OO5555O5O55O5L55L555DD.',
    '.L5LO5W5d5OO5OO5O5OO5O5LL5L5LDDD.',
    '.LL55OW5dW5O5OO5O5OO5OL555L5555D.',
    '.LLLOOWddWOOOOOOOOOOOOLLLLLLLDDD.',
    '.LLLOOWddWOOOOOOOOOOOOLLLLLLLDDD.',
    '.LLLOOWddWOOOOOOOOOOOOLLLLLLLDDD.',
    '.MNRTbijjfbZYVTSSSTTTSRRQNNSNKGC.',
    '.MNRTbijjfbZYVTSSSTTTSRRQNNSNKGC.',
    '.MNRTbijjfbZYVKKKJJJIIRGGFFIKCBC.',
    '.MNRTbijjfbZYVKKKJJJIIRGGFFIKCBC.',
    '.MNRTbijjfbZYVK66JJ66IRGG66666BC.',
    '.MNRTbijjfbZYVK66J66IIRG66FIKCBC.',
    '.MNRTbijjfbZYVK6666JIIRG66FIKCBC.',
    '.MNRTbijjfbZYVK666JJIIRGG6666CBC.',
    '.MNRTbijjfbZYVK6666JIIRGGFFI66BC.',
    '.MNRTbijjfbZYVK66J66IIRGGFFI66BC.',
    '.MNRTbijjfbZYVK66JJ66IRG66666CBC.',
    '.MNRTbijjfbZYVKKKJJJIIRGGFFIKCBC.',
    '.MNRTbijjfbZYVKK6666IIRG666666BC.',
    '.MNRTbijjfbZYVK66JJ66IRGGF66KCBC.',
    '.MNRTbijjfbZYVK66JJ66IRGGF66KCBC.',
    '.MNRTbijjfbZYVK66JJ66IRGGF66KCBC.',
    '.MNRTbijjfbZYVK66JJ66IRGGF66KCBC.',
    '.MNRTbijjfbZYVK66JJ66IRGGF66KCBC.',
    '.MNRTbijjfbZYVKK6666IIRGGF66KCBC.',
    '.MNRTbijjfbZYVKKKJJJIIRGGFFIKCBC.',
    '.MNRTbijjfbZYVK66JJ66IRG66666CBC.',
    '.MNRTbijjfbZYVK666J66IRG66FI66BC.',
    '.MNRTbijjfbZYVK666666IRG66FI66BC.',
    '.MNRTbijjfbZYVK66J666IRG66666CBC.',
    '.MNRTbijjfbZYVK66JJ66IRG66F66CBC.',
    '.MNRTbijjfbZYVK66JJ66IRG66FI66BC.',
    '.MNRTbijjfbZYVK66JJ66IRG66FI66BC.',
    '.MNRTbijjfbZYVKKKJJJIIRGGFFIKCBC.',
    '.MNRTbijjfbZYVKK66666IRGG6666CBC.',
    '.MNRTbijjfbZYVK66JJJIIRG66FI66BC.',
    '.MNOTbijjfbZYVK66JJJIIRG66FI66BC.',
    '.MNRTbijjfbZYVK66J666IRG66FI66BC.',
    '.MLRObijjfbZYVK66JJ66IRG66FI66BC.',
    '.MNRTbijjfbZYVK66JJ66IRG66FI66BC.',
    '.MNOTOijjfbZYVKK6666IIRGG6666CBC.',
    '.MNRTbijjfbZYVKKKJJJIIRGGFFIKCBC.',
    '.MLRObajjfbZYVKKKJJJIIRG66FI66BC.',
    '.MNRTbijjfbZYVKKKJJJIIRG666I66BC.',
    '.MNOTOidjfbZYVKKKJJJIIRG666666BC.',
    '.MNRTbijjfbZYVKKKJJJIIRG66F666BC.',
    '.MLRObajdfbZYVKKKJJJIIRG66FI66BC.',
    '.MNRTbijjfbZYVKKKJJJIIRG66FI66BC.',
    '.MNOTOidjfbZYVKKKJJJIIRG66FI66BC.',
    '.MNRTbijjfbZYVKKKJJJIIRGGFFIKCBC.',
    '.MLRObajdfbZYVKKKJJJIIRGG66666BC.',
    '.MNRTbijjfbZYVKKKJJJIIRG66FIKCBC.',
    '.MNOTOidjWbZYVKKKJJJIIRG66FIKCBC.',
    '.MNRTbijjfbZYVKKKJJJIIRG66F666BC.',
    '.MLRObajdfWZYVKKKJJJIIRG66FI66BC.',
    '.MNRTbijjfbZYVKKKJJJIIRG66FI66BC.',
    '.MNOTOidjWbOYVKKKJJJIIRGG6666CBC.',
    '.MNRTbijjfbZYVKKKJJJIIRGGFFIKCBC.',
    '.MLRObajdfWZOVKKKJJJIIRGGFFIKCBC.',
    '.MNRTbijjfbZYVTSSSTTTSRRQNNSNKGC.',
    '.MNOTOidjWbOYVTSSSTTTSRRQNNSNKGC.',
    '.MNRTbijjfbZYVTSSSTTTSRRQNNSNKGC.',
    '.MLRObajdfWZOVTSSSTTTSRRQNNSNKGC.',
    '.MNRTbijjfbZYVTSSSTTTSRRQNNSNKGC.',
    '.MNRTbijifbZYUSSRSSTSSRQNNNRNKGC.',
    '.KMNQYgjibUSRQQNNNQQQNNNMMMQMGFC.',
    '...NQYgjibUSRQQNNNQQQNNNMMMQMG...',
    '.................................',
  ];

  const ROTTI = [
    '..........................',
    '......EEE.................',
    '........E.................',
    '........E..DEE............',
    '........E..FIIE...........',
    '........E.FFIIIE..........',
    '........EDFFIIIE..........',
    '........DFFFIIIIE.........',
    '.......DFFFIIIIIE.........',
    '......DFFFFIIIIIIE........',
    '....DDFFFFFIIIIIIE........',
    '.....EFFFFIIIIIIIIE.......',
    '.....EFFIIIIIIIIFFFDDDDD..',
    '.DDDDDDIIFFFFFIIIIIIEEEED.',
    'DEEEEEEFFIIIIIIIIIIIIENND.',
    'DNNEEEEIIIIIIIIIIIIIIIEND.',
    'DNNNNEIIIIIIIIIIIIIIIIIED.',
    'DMMNEIIIIIIIIIIIIIIIIIIED.',
    'DMMEIIIIIIIIIIIIIINNNIIIE.',
    '.DEFIIIIIIIIINNNIINNIIIIE.',
    '.DEFIIIIIIIIIINNIIIAANNIIE',
    '.EFFIIIIIIINNAAIIIINAAANIE',
    '.EFFIIIIIINAAANIIIIAAANNNE',
    '.EFFIIIIINNNAAAIINIIEEENNE',
    '.EFFFIIINNNEEEIINANIEEENNE',
    '.EFFFFIINNNEEEIIANAEEEMME.',
    '..EFFFFFFMMMEEEFFFEEEEFE..',
    '.EFFFFFFFFFCCCCCACACCFAA..',
    '.EFFFFFIIICCCCCCCACCCCFFA.',
    '.EFFFFIIICCCCCCCHAHCCCCFA.',
    '.EFFFIIICCCACCHCCACCHCCFA.',
    '.EFFFIICCCCCAAAAACAAAAAA..',
    '.EFFFIICCCCAEEACCCCCAEEA..',
    '..EFFFICCCAECCEACCCAECCEA.',
    '..EFFFFCCCACCHCACCCACCHCA.',
    '...EFFFCCCACHCHACCCACHCHA.',
    '....EEECCCCCCCACCCCCCCCA..',
    '.....AEAAAAAAAAAAAAAAAA...',
    '....AEEBBJJJBBJJJJAAA.....',
    '....AEBBJJBBBJJBBBJJJA....',
    '....ABBJJBBBJJBBBJJJBBA...',
    '....ABBJJBBJJBBBJJJBBBBA..',
    '....ABJJBBBJJBBBJJBBBBBA..',
    '....ABJJBBJJBBBJJJBBBBBA..',
    '....ABJJBBJJBBBJJBBBBBBA..',
    '.....AFFBBJJBBBJJBBBBBBA..',
    '.....AFFBBJJBBBJJBBBBBBA..',
    '......AFBBFFBBBFFBBBBBA...',
    '.......AFBFFFBBFFBBBBBA...',
    '........AAFFFBBFFFBBBA....',
    '..........AAFFBBFFFAA.....',
    '............AAAAAAA.......',
  ];

  const CRITTER_ACTIONS = ['wave', 'yawn', 'stretch', 'idea', 'look', 'dance', 'mushroom', 'wink', 'bounce', 'sneeze', 'spin', ...FUN_ACTIONS];
  const critterDefs = {
    kuschel: {
      name: 'Kuschel (Koala)',
      palette: { W: '#a3a7b3', w: '#8a8e99', v: '#70747e', h: '#c7cad3', B: '#f1f1f4', G: '#16161a', X: '#2f3036', x: '#6b6e78', E: '#16161a', e: '#16161a', P: '#f2a7b5', m: '#3a2a30', t: '#f07a8a' },
      display: 3.9, // Anzeige-Maßstab: so hoch wie die anderen Figuren
      cuddly: true, // schläft beim Streicheln ein, am liebsten seitlich an einem Fenster
      eyes: { xs: [8, 14], y: 11, w: 2, h: 2 },
      pattern: ['HE', 'EE'],
      cheeks: [7, 16],
      mouth: [11, 17],
      arms: [5, 17, 16, 2, 3],
      feet: [[8, 3], [13, 3]],
      shape(g, o) {
        ellipse(g, 5, 8 + o.hy, 3.8, 3.8, body);
        ellipse(g, 19, 8 + o.hy, 3.8, 3.8, body);
        ellipse(g, 12, 18.5 + o.by, 5.5, 3.2, body);
        ellipse(g, 12, 12.5 + o.hy, 7.5, 6.2, body);
        ellipse(g, 5, 8 + o.hy, 2, 2, () => 'B');
        ellipse(g, 19, 8 + o.hy, 2, 2, () => 'B');
        ellipse(g, 12, 19 + o.by, 3, 2, () => 'B');
      },
      face(g, o) { ellipse(g, 12, 14.5 + o.hy, 1.7, 2.2, () => 'G'); },
      anchors: { hat: [12, 6], glasses: [7, 10] },
      mug: ['V', 'Z'], // Eukalyptus-grün
    },
    mokka: {
      name: 'Mokka (Kaffeetasse)',
      palette: { W: '#f2ece4', w: '#d6cbbd', v: '#bfb2a2', h: '#ffffff', A: '#6b3e22', a: '#4f2c16', X: '#3a2418', x: '#7a5a48', E: '#1a110b', e: '#1a110b', P: '#f4a0a8', m: '#3a1a10', t: '#f07a6a' },
      display: 5.1, // Anzeige-Maßstab: so hoch wie die anderen Figuren
      colorKeys: ['W', 'w', 'v', 'h', 'X', 'x'], // Farbvarianten: nur die Tasse einfärben, der Kaffee bleibt braun
      steams: true, // dampft, morgens und beim schnellen Tippen kräftiger
      eyes: { xs: [9, 13], y: 13, w: 2, h: 2 },
      pattern: ['HE', 'EE'],
      cheeks: [7, 15],
      mouth: [10, 16],
      shape(g, o) {
        const top = 9 + o.by;
        rect(g, 5, top, 16, 19, (x) => (x >= 15 ? 'w' : x === 5 ? 'h' : 'W'));
        rect(g, 6, 20, 15, 20, 'w');
        rect(g, 17, 11 + o.by, 19, 11 + o.by, 'W');
        rect(g, 19, 11 + o.by, 19, 15 + o.by, 'w');
        rect(g, 17, 15 + o.by, 19, 15 + o.by, 'W');
        rect(g, 6, top, 15, top + 1, (x, y) => (y === top ? 'A' : 'a'));
      },
      face(g, o) { rect(g, 10, 16 + o.hy, 12, 16 + o.hy, 'e'); },
      anchors: { hat: [11, 9], glasses: [8, 12] },
      noCoffee: true, // ist selbst eine Tasse
    },
    orangi: {
      // Kong Strong Orange (schlanke Dose), Pixel 1:1 mit Licht gerendert: dunkle Ränder, Glanzstreifen, Alu-Deckel
      name: 'Orangi (Orangen-Dose)',
      palette: {
        A: '#000000', B: '#191a1b', C: '#262727', D: '#542e09', F: '#2e3032', G: '#353839', I: '#3c3f41',
        J: '#404446', K: '#444749', L: '#a45c16', M: '#626364', N: '#76787a', O: '#da7a1c', Q: '#7f8184',
        R: '#8a8d8f', S: '#929496', T: '#989b9c', U: '#9d9fa0', V: '#a2a4a5', W: '#fdb14e', Y: '#a7aaad',
        Z: '#b1b3b5', a: '#ffcd6a', b: '#c1c4c6', c: '#d6d7d8', d: '#fff395', f: '#e5e7e8', g: '#f3f4f3',
        i: '#fdfefe', j: '#ffffff', '5': '#fbfbf9', '6': '#eef0f0', X: '#2b2e2d', x: '#4f5553', E: '#15161b',
        e: '#15161b', P: '#ffb0a0', m: '#3a1a10', t: '#ff8a6a', H: '#ffffff', v: '#989b9c',
      },
      eyeBg: 'v',
      fizzy: true, // sprudelt beim schnellen Tippen
      w: 33, h: 82, scale: 1, display: 60 / 0.6 / 82, // so groß wie die Klein-Version: kein Sprung zwischen 80 und 90 %
      eyes: { xs: [3, 9], y: 25, w: 5, h: 5 },
      pattern: ['HHEEE', 'HHEEE', 'EEEEE', 'EEEEE', 'EEEEE'],
      mouth: [7, 33],
      shape(g) { ORANGI.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') g[y][x] = ch; })); },
      face(g, o) {
        // wie Mini-Claude: fröhlich = flache Augen mit Glanzpunkt und Bäckchen, müde = halb zu
        [3, 9].forEach((x) => {
          const y = 25 + o.hy;
          if (o.eye === 'happy') { rect(g, x, y, x + 4, y + 2, 'v'); rect(g, x, y + 3, x + 4, y + 4, 'e'); set(g, [[x, y + 3]], 'H'); rect(g, x + 1, y + 6, x + 3, y + 6, 'P'); }
          if (o.eye === 'sleepy') { rect(g, x, y, x + 4, y + 2, 'v'); rect(g, x, y + 3, x + 4, y + 4, 'e'); }
        });
      },
      anchors: {
        mouth: [30, 31], // Zigarette & Co. am rechten Dosenrand, damit die Schrift frei bleibt
        hat: [16, 1], glasses: [2, 24], keyboard: [2, 70], tap: [16, 72], idea: [15, -8], lens: [31, 24],
        mushroom: [-9, 72], snore: [27, 9], umbrella: [0, -28], fizz: [16, 2],
      },
      mug: ['b', 'N'],
    },
    monsti: {
      // weiße Monster-Dose (Ultra White, silbergraue Kralle), 0,5 l. Pixel 1:1 mit Licht gerendert
      name: 'Monsti (Energydose)',
      palette: {
        A: '#4a4948', B: '#626161', C: '#737372', D: '#818182', F: '#959695', G: '#9e9e9c', I: '#a1a09d',
        J: '#a4a6ab', K: '#aaa9a6', L: '#b2b1ae', M: '#b2b4b9', N: '#bab8b5', O: '#c0bfbc', Q: '#c8c6c3',
        R: '#cccbc8', S: '#d4d2cf', T: '#dad8d4', U: '#dedcd7', V: '#e3e2dd', W: '#e9e7e2', Y: '#ebe9e5',
        Z: '#eeece8', a: '#f1efea', b: '#f1f0eb', c: '#f6f4ef', d: '#f8f8f5', f: '#fdfdfe', g: '#fffffe',
        '3': '#4b4f56', '7': '#afb7c5', '4': '#878e9a', '5': '#727882', '6': '#60656e', '1': '#555a66', '2': '#9aa0ac',
        X: '#2b2e2d', x: '#4f5553', E: '#15161b', e: '#15161b', P: '#ffb0b8', m: '#3a1a10', t: '#ff8a6a',
        H: '#ffffff', q: '#f1f0eb',
      },
      eyeBg: 'q',
      fizzy: true, // sprudelt beim schnellen Tippen
      w: 42, h: 102, scale: 1, display: 76 / 0.6 / 102, // so groß wie die Klein-Version
      eyes: { xs: [13, 24], y: 12, w: 5, h: 5 },
      pattern: ['HHEEE', 'HHEEE', 'EEEEE', 'EEEEE', 'EEEEE'],
      mouth: [19, 18],
      shape(g) { MONSTI.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') g[y][x] = ch; })); },
      face(g, o) {
        // wie Mini-Claude: fröhlich = flache Augen mit Glanzpunkt und Bäckchen, müde = halb zu
        [13, 24].forEach((x) => {
          const y = 12 + o.hy;
          if (o.eye === 'happy') { rect(g, x, y, x + 4, y + 2, 'q'); rect(g, x, y + 3, x + 4, y + 4, 'e'); set(g, [[x, y + 3]], 'H'); rect(g, x + 1, y + 6, x + 3, y + 6, 'P'); }
          if (o.eye === 'sleepy') { rect(g, x, y, x + 4, y + 2, 'q'); rect(g, x, y + 3, x + 4, y + 4, 'e'); }
        });
      },
      anchors: {
        hat: [21, 1], glasses: [12, 11], keyboard: [7, 90], tap: [21, 92], idea: [19, -8], lens: [40, 13],
        mushroom: [-9, 92], snore: [35, 8], umbrella: [5, -28], mug: [-11, 54], fizz: [21, 2],
      },
      mug: ['G', 'B'],
    },
  };

  // Dosen-Sorten als versteckte Figuren (z. B. monsti_gruen); die Grundfigur verweist mit variants darauf
  for (const [id, sorts] of Object.entries(CAN_VARIANTS)) {
    const base = critterDefs[id];
    if (!base) continue;
    base.variants = {};
    for (const [farbe, v] of Object.entries(sorts)) {
      const vid = `${id}_${farbe}`;
      critterDefs[vid] = {
        ...base, variants: null, hidden: true, palette: v.palette, mug: v.mug,
        shape(g) { v.rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') g[y][x] = ch; })); },
      };
      base.variants[farbe] = vid;
    }
  }
  // Klein-Versionen als versteckte Figuren (z. B. orangi_klein, monsti_klein_gruen)
  for (const [id, sorts] of Object.entries(CAN_SMALL)) {
    const base = critterDefs[id], meta = CAN_SMALL_META[id];
    if (!base) continue;
    base.small = {};
    for (const [farbe, v] of Object.entries(sorts)) {
      const sid = farbe === 'original' ? `${id}_klein` : `${id}_klein_${farbe}`;
      critterDefs[sid] = {
        ...base, variants: null, small: null, hidden: true, face: undefined,
        palette: v.palette, mug: v.mug, w: meta.w, h: meta.h, scale: 1, display: 1 / 0.6,
        eyes: meta.eyes, pattern: ['HEE', 'EEE', 'EEE'], mouth: meta.mouth, anchors: meta.anchors,
        shape(g) { v.rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') g[y][x] = ch; })); },
      };
      base.small[farbe] = sid;
    }
  }
  const critters = {};
  for (const [id, def] of Object.entries(critterDefs)) {
    const [ex, ey] = [def.eyes.xs, def.eyes.y];
    critters[id] = {
      name: def.name,
      palette: def.palette,
      frames: framesOf(critter(def)),
      eye: { positions: ex.map((x) => [x, ey]), pattern: def.pattern },
      eyeBg: def.eyeBg || 'W',
      front: true,
      arms: Boolean(def.arms),
      float: def.float || false,
      squishy: def.squishy || false,
      jump: def.jump || 1,
      slides: def.slides || false,
      rolls: def.rolls || false,
      record: def.record || false,
      cuddly: def.cuddly || false,
      steams: def.steams || false,
      fizzy: def.fizzy || false,
      mug: def.mug || null,
      variants: def.variants || null,
      small: def.small || null,
      hidden: def.hidden || false,
      colorKeys: def.colorKeys || null,
      variantTweaks: def.variantTweaks || null,
      idleActions: [...CRITTER_ACTIONS, ...(def.extraActions || []), ...(def.noCoffee ? [] : ['coffee'])],
      typingFrames: ['tapL', 'tapR'],
      glasses: glassesFor(def.eyes),
      anchors: {
        keyboard: [5, 16], tap: [12, 17], idea: [10, -8], lens: [20, 4], mushroom: [-9, 15], snore: [17, 8],
        umbrella: [5, -11], mouth: [def.mouth[0] + 2, def.mouth[1]],
        // Zigarette & Co. in der rechten Hand (Figuren mit Armen)
        ...(def.arms ? { hand: [def.arms[1] + def.arms[3] - 1, def.arms[2] + def.arms[4] - 2] } : {}),
        // Kaffeebecher links neben der linken Pfote
        mug: def.arms ? [def.arms[0] - 9, def.arms[2] - 1] : [-9, 11],
        ...def.anchors,
      },
      width: def.w || VW,
      height: def.h || VH,
      scale: def.scale || 3,
      display: def.display || null,
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Zubehör
  const KEYBOARD = small([
    'kkkkkkkkkkkk',
    'kLkLkLkLkLkk',
    'kkLLLLLLLLkk',
    'kkkkkkkkkkkk',
  ]);
  const WING = small(['WW.', 'WWw', '.ww']);
  const HEART = small(['.R.R.', 'RRRRR', 'RRRRr', '.RRr.', '..r..']);
  const STAR = ['.i.', 'iIi', '.i.'];
  // Pilz wie in den Mini-Claude-Screenshots
  const MUSHROOM = small(['.uuu.', 'uUuuu', 'uuuuu', '.nnn.', '.nnn.']);

  // Extras: Weihnachtsmütze, Partyhut, Regenschirm, Sonnenbrille
  const SANTA = small([
    '......WW',
    '.....dWW',
    '...dddd.',
    '..ddddD.',
    '.dddddDD',
    'WWWWWWWW',
  ]);
  const PARTY = small([
    '...ii...',
    '...pp...',
    '..pbbp..',
    '..bppb..',
    '.pbbbbp.',
    '.bppppb.',
    'pbbbbbbp',
  ]);
  const UMBRELLA = small([
    '......k.......',
    '....bbbbbb....',
    '..bbzbbbbzbb..',
    '.bbbzbbbbzbbb.',
    'bbbbzbbbbzbbbb',
    'b.b..b..b..b.b',
    '......k.......',
    '......k.......',
    '......k.......',
    '......k.......',
    '......k.......',
    '....k.k.......',
    '.....k........',
  ]);
  // Sonnenbrille: Ente (ein Glas, Seitenansicht) und Mini-Claude (zwei Gläser)
  const GLASSES_SIDE = ['KKKKK', 'KsKKK', '.KKK.'];
  const GLASSES_FRONT = ['KKKKKKKKKKKKKKKKK', 'KsKKKK.......KsKK', 'KKKKK........KKKK', '.KKK..........KK.'];

  // Ostern, Halloween, nachts beim Schlafen, Wecker, Panda-Snack
  const EARS = small([
    '.aa...aa.',
    '.ag...ga.',
    '.ag...ga.',
    '.ag...ga.',
    '.aa...aa.',
    'aaaaaaaaa',
  ]);
  const PUMPKIN = small([
    '....VV...',
    '..yyVyyy.',
    '.yyQyyQyy',
    'yyQkyykQy',
    'yyQyyyyQy',
    'yyQkkkkQy',
    '.yyyyyyy.',
  ]);
  const NIGHTCAP = small([
    '.......a',
    '......SS',
    '....SSS.',
    '..SSSST.',
    '.SSSSSTT',
    'aaaaaaaa',
  ]);
  const BELL = small(['...k...', '..iii..', '.iIiii.', '.iIiii.', 'iiiiiii', '...k...']);
  const EGG = small(['.CC.', 'CCCC', 'pppp', 'CiCi', '.CC.']);
  // Medaille für Abzeichen (Tasten-Meilensteine)
  const MEDAL = small(['.b.b.', '..z..', '.iii.', 'iIiii', 'iiiii', '.iii.']);
  const STONE = small(['.jj.', 'jJjj', 'jjjj', '.jj.']); // Otter jongliert

  // Tägliches Geschenk und das Zubehör, das darin stecken kann
  const GIFT = small(['.i..i.', '..ii..', 'ddiidd', 'ddiidd', 'DDiiDD', 'DDiiDD']);
  const ACCESSORIES = {
    CROWN: small(['i..i..i', 'ii.i.ii', 'iIiRiIi', 'iiiiiii']),
    WIZARD: small(['....S....', '...SS....', '...SiS...', '..SSSST..', '..SiSSS..', '.SSSSSTT.', 'TTTTTTTTT']),
    TOPHAT: small(['.KKKKK.', '.KKKKK.', '.KsKKK.', '.ddddd.', 'KKKKKKK']),
    HALO: ['.iiiii.', 'i.....i', '.iiiii.'],
    HORNS: small(['d.....d', 'dd...dd', '.D...D.']),
    PIRATE: small(['..KKKKK..', '.KKKaKKK.', 'KKKKKKKKK', '.KK...KK.']),
    COWBOY: small(['...uuu...', '..uuuuu..', '..UUUUU..', 'uuuuuuuuu', '.u.....u.']),
    VIKING: small(['a.......a', 'a..jjj..a', '.jjjjjjj.', 'jJjjjjjJj', 'uuuuuuuuu']),
    PROPELLER: small(['.bbb.ddd.', '....k....', '..bdbdb..', '.bdbdbdb.', 'bdbdbdbdb']),
    CATEARS: small(['k.....k', 'kk...kk', 'kpk.kpk', 'kkkkkkk']),
    STARBAND: small(['..i...i..', '.iIi.iIi.', '..i...i..', 'zzzzzzzzz']),
    NINJA: small(['.........KK', 'KKKKjjKKK.K', 'KKKKjjKKKK.']),
    DRAGON: small(['V.......V', 'VV.....VV', '.VZ...ZV.']),
    UNICORN: small(['..a..', '..p..', '.ap..', '.apa.', 'apapa']),
    WITCH: small(['....KK...', '...KKK...', '...KKs...', '..KKKKK..', '..SSSSS..', 'KKKKKKKKK']),
    MOHAWK: small(['.p.p.p.', 'pbpbpbp', 'bbbbbbb']),
    SAMURAI: small(['...i.i...', '..i...i..', '.jjjjjjj.', 'jJjjjjjJj', 'jjj...jjj']),
    SNAPBACK: small(['..KKKKK....', '.KKKiKKK...', '.KKiKiKK...', 'KKKKKKKKKKK']), // eigenes „Buddy“-Logo
    BUCKETHAT: small(['..VVVVV..', '.VVVVVVV.', '.ZZZZZZZ.', 'VVVVVVVVV']),
    // seltene, goldene Teile
    GOLDCROWN: small(['i.i.i.i', 'iIiIiIi', 'iiRiCii', 'IIIIIII']),
    TIARA: small(['...C...', '..CaC..', '.i.C.i.', 'iiiiiii']),
  };
  // Engelsflügel (hinter der Figur, links; rechts gespiegelt)
  const WING_L = small(['....aa', '..aaan', '.aaann', 'aaannn', '.aannn', '..ann.']);
  const WING_R = WING_L.map((r) => [...r].reverse().join(''));
  // Heldenumhang hinter der Figur (zwei Bilder: ruhig und wehend)
  const CAPE1 = small([
    '....dddddddd....', '...dddddddddd...', '..dddddddddddd..', '..dddddddddddd..', '.dddddddddddddd.',
    '.ddddddddddddDD.', 'dddddddddddddDDD', 'ddddddddddddDDDD', 'dDdDdDdDdDdDdDdD',
  ]);
  const CAPE2 = small([
    '....dddddddd....', '...dddddddddd...', '..dddddddddddd..', '.dddddddddddddd.', 'ddddddddddddddDD',
    'dddddddddddddDDD', 'ddddddddddddDDDD', 'dDdDdDdDdDdDdDdD', 'D..D..D..D..D..D',
  ]);
  // Mund-Zubehör (vom Mund nach rechts)
  // größer und dicker: Filter (y), Papier (a), Glut (R)
  // Joint: schräg nach unten, dünnes Ende im Mund, Glut am dicken Ende
  const JOINT = small([
    '0.........',
    '90........',
    '.990......',
    '..990.....',
    '...9990...',
    '....9990..',
    '.....-++-.',
    '.....-++-.',
    '......--..',
  ]);
  // Zigarette nach Vorlage: dick (3 Pixel), leicht schräg nach unten; gesprenkelter Filter, weißes Papier
  // mit Schatten, grauer Übergang, oranger Glutring und runde, dunkle Asche. Brennt ab: n = übriges Papier
  function cigaretteRows(n) {
    const cols = [];
    cols.push(['1', '2', '1'], ['2', '1', '1'], ['1', '1', '2'], ['1', '2', '1'], ['2', '1', '2']);
    for (let i = 0; i < n; i++) cols.push(['3', '3', '4']);
    cols.push(['4', '5', '5'], ['7', '7', '7'], ['6', '5', '6'], ['.', '6', '.']);
    const h = 3 + Math.floor((cols.length - 1) / 7);
    const g = Array.from({ length: h }, () => Array(cols.length).fill('.'));
    cols.forEach((c, x) => c.forEach((ch, y) => { g[y + Math.floor(x / 7)][x] = ch; }));
    return small(g.map((r) => r.join('')));
  }
  const CIG_STAGES = Array.from({ length: 10 }, (_, n) => cigaretteRows(Math.max(1, n)));
  const cigarette = (n) => CIG_STAGES[Math.max(1, Math.min(9, Math.round(n)))];
  const CIGARETTE = CIG_STAGES[9];
  // Zigarre: Deckblatt mit Glanzkante, gold-rote Bauchbinde, Asche und Glut
  const CIGAR = small([
    '[[[[[[]!][[[[[[[4557',
    '((((((]!](((((((5567',
    '))))))]!])))))))5576',
  ]);
  // Pfeife: schwarzes Mundstück, gebogen, Holzkopf mit glimmendem Tabak
  const PIPE = small([
    '..........>7767>',
    '..........<^<<<>',
    '{{{{{{{{{{<^<<>>',
    '}}}}}}}}}{<^<<>>',
    '..........<<<>>.',
    '...........>>>..',
  ]);
  // Vape: Pod mit dunklem Mundstück, Metall-Gehäuse, Leuchtdiode (b) an der Spitze
  const VAPE = small(['**??????????????', '**@@@@@@@@@@@@@b', '**$$$$$$$$$$$$$b']);
  // weitere Rauchwaren: Zigarillo (Holzspitze), Selbstgedrehte (krumm), Slim (extra dünn), bunte Einweg-Vape
  const CIGARILLO = small(['^^((((((((((457', '^^))))))))))567']);
  const ROLLIE = small([
    '3333.......',
    '43333333...',
    '.4433333457',
    '...44444567',
  ]);
  const SLIM = small(['11333333333333357']);
  const FRUITVAPE = small(['**ggggppppCCCCcb', '**ppppCCCCcccczb']);
  // Grillz: Goldzähne, sichtbar beim Grinsen
  const GRILLZ = ['iIiI'];
  // Begleiter: Mini-Shisha (Kohle, Kopf, Rauchsäule, Glasbauch mit Wasser), Schlauch wird extra gezeichnet
  const SHISHA = small([
    '...777...',
    '..jjjjj..',
    '...jjj...',
    '....j....',
    '....j....',
    '..jjjjjj.',
    '....j....',
    '....j....',
    '..ccccc..',
    '.caccccc.',
    'cazzzzzcc',
    'czzzzzzzc',
    'czzzzzzzc',
    '.czzzzzc.',
    '..ccccc..',
  ]);
  // Mini-Bong: Glasrohr, Kopf seitlich, grünes Wasser
  const BONG = small([
    '..ccc..',
    '..cac..',
    '..cac..',
    '..cac..',
    '..cac..',
    '..cac..',
    '..cac6R',
    '.ccac6.',
    'caaccc.',
    'cVVVVVc',
    'cVVVVVc',
    '.ccccc.',
  ]);
  // kleine Energydose zum Trinken
  const ENERGYCAN = small(['.jjj.', 'jKjjj', 'aaaaa', 'aKaKa', 'aKaKa', 'aaKaa', 'aaaaa', '.jjj.']);
  // Snus-Dose (zu / Deckel offen mit Beuteln)
  const SNUSCAN = small(['........', '.SSSSSS.', 'TTTTTTTT', 'aaaaaaaa', 'aSaaaaSa', 'aaaaaaaa']);
  const SNUSCAN_OPEN = small(['.SSSSSS.', 'T......T', 'aananaaa', 'aaaaaaaa', 'aSaaaaSa', 'aaaaaaaa']);
  // Kippenschachtel (zu / offen mit Filtern)
  const CIGPACK = small(['......', 'aaaaaa', 'dddddd', 'daaaad', 'dddddd', 'dddddd', 'DDDDDD']);
  const CIGPACK_OPEN = small(['.1.1..', 'a1a1aa', 'dddddd', 'daaaad', 'dddddd', 'dddddd', 'DDDDDD']);
  // Sturmfeuerzeug (zu / auf mit Flamme)
  const ZIPPO = small(['......', '......', 'jjjjjj', 'jsjjjj', 'jj4jjj', 'jjjjjj', 'jjjjjj']);
  const ZIPPO_OPEN = small(['jj..8.', 'jj.878', 'jj.j4j', 'jjjjjj', 'jj4jjj', 'jjjjjj', 'jjjjjj']);
  // Joint-Krone (golden): drei kleine Joints auf einem Band
  const JOINTCROWN = small(['.+...+...+.', '.9...9...9.', '.9...9...9.', '.0...0...0.', '99999999999']);

  // Neue Kopf-Teile und Begleiter (Version 1.34)
  const ACCESSORIES2 = {
    CAP: small(['..KKKKKK.....', '.KKKKKKKK....', 'KsKKKKKKKK...', 'KKKKKKKKKKKK.', '......666666.']),
    BANDANA: small(['..dddddddd...', '.ddaddddadd..', 'dddddaddddddd', 'DDDDDDDDDDDdD', '..........d.d']),
    BEANIE: small(['...KKKKK...', '.KKKKKKKKK.', 'KsKKKKKKKKK', 'KKKKKKKKKKK', '6K6K6K6K6K6']),
    CHAINBEANIE: small(['...KKKKK...', '.KKKKKKKKK.', 'KsKKKKKKKKK', 'KKKKKKKKKKK', 'iIiiIiiIiiI']),
    KIPPAH: small(['..SSSSS..', '.SSTSTSS.', 'STSSSSSTS']),
    SKIGOGGLES: small(['...KKKKKKKKK...', 'KKKKypppbbbKKKK', '...KyyppbbbK...', '....KKKKKKK....']),
    SIMPLECROWN: small(['i...i...i', 'ii.iIi.ii', 'iiiiiiiii', 'IIIIIIIII']),
    GOLDHALO: ['.IiiiiiI.', 'i.......i', '.iiiiiii.'],
  };
  const BUBBLETEA = small(['.k....', '.k....', 'cccccc', 'nnnnnn', 'nnnnnn', 'nkknkn', 'kknkkn', '.nnnn.']);
  const MINITEDDY = small(['u...u', 'uuuuu', 'ukuku', 'uuUuu', '.uuu.', 'uu.uu']);
  const BUNNY = small(['.g.g.', '.g.g.', '.ggg.', 'gkgkg', 'ggpgg', '.ggg.', 'gg.gg']);
  const DUMBBELL = small(['K.......K', 'KK66666KK', 'KK66666KK', 'K.......K']);
  const FIREPLACE = small(['DDDDDDDDDDD', 'dDddDddDddD', 'dddDddDdddd', 'ddKKKKKKKdd', 'dDKKKKKKKDd', 'ddKKKKKKKdd', 'dDKKKKKKKDd', 'ddKKKKKKKdd', 'jjjjjjjjjjj']);
  const FRIDGE = small(['aaaaaaa', 'aaaaaja', 'aaaaaja', 'jjjjjjj', 'aaaaaja', 'aaaaaja', 'aaaaaja', 'aaaaaaa', 'j.....j']);
  const FRIDGE_OPEN = small(['aaaaaaa', 'aIIIIIa', 'aIbIiIa', 'jjjjjjj', 'aIIIIIa', 'aIdIIIa', 'aIIIIIa', 'aaaaaaa', 'j.....j']);
  const GOLDBARS = small(['..iiiii..', '.iIiiIii.', 'iiiiiiiii', 'iIiiiIiii', 'IIIIIIIII']);
  const RADIATOR = small(['a.a.a.a.a', 'aaaaaaaaa', 'ajajajaja', 'ajajajaja', 'ajajajaja', 'aaaaaaaaa', 'j.......j']);
  const THERMOS = small(['.SS.', 'jjjj', 'SSSS', 'SaSS', 'SaSS', 'SSSS', 'SSSS', 'jjjj']);
  const BEANBAG = small(['....bbbbbbbbbbbbbb....', '..bbbbbbbbbbbbbbbbbb..', '.bbbbbbbbbbbbbbbbbbbb.', 'bbbbbbbbbbbbbbbbbbbbbb', 'zbbbbbbbbbbbbbbbbbbbbz', 'zzbbbbbbbbbbbbbbbbbbzz', '.zzzzzzzzzzzzzzzzzzzz.']);
  const CHAIR_BACK = small(['uuuuuuuuuuuuuuuuuuuuuuuuuuuu', 'uUUUUUUUUUUUUUUUUUUUUUUUUUUu', 'u..........................u', 'u..........................u', 'u..........................u', 'u..........................u', 'u..........................u', 'u..........................u', 'u..........................u', 'u..........................u', 'u..........................u', 'u..........................u', 'u..........................u', 'u..........................u']);
  const CHAIR_SEAT = small(['uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu', 'UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUU', '.u............................u.', '.u............................u.', '.u............................u.']);
  const BED = small(['aaaaaa......................................', 'naaaana.....................................', 'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS', 'uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu', 'u..........................................u']);
  const BLANKET = small(['SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS', 'SaSSSaSSSaSSSaSSSaSSSaSSSaSSSaSS', 'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS', 'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT']);
  const HAMMOCK = small(['u..................................u', 'u..................................u', 'ub................................bu', 'u.bb............................bb.u', 'u...bbb......................bbb...u', 'u......bbbbbbbbbbbbbbbbbbbbbb......u', 'u..................................u']);
  const GLOBEBASE = small(['..uuuuuuuuuuuuuuuuuuuuuuuuuu..', '.uUUUUUUUUUUUUUUUUUUUUUUUUUUu.', 'uuuuuuuuuuuuuuuuuuuuuuuuuuuuuu']);

  // Mund-Teile (Version 1.36)
  const JOINTXXL = small(['00..........', '9900........', '.99900......', '..999900....', '...9999900..', '....99999-+-', '.....9999-++', '......99-+++', '........-++-']);
  const SHERLOCK = small(['..............<<<<.', '.............<7767<', '.............<^<<<<', '.............<^<<<.', '{{{.........<<<<<..', '}}{{{{.....<<<<....', '...}}{{{{{{<<......']);
  const VAPEXXL = small(['**????????????????', '**@@@@@@@@@@@@@@@b', '**$$$$$$$$$$$$$$$b', '**$$$$$$$$$$$$$$$b', '..$$$$$$$$$$$$$$$.']);
  const GOLDPICK = small(['iIiIii']);
  const CIGARXXL = small(['[[[[[[[[iIi[[[[[[[[[[[4557', '((((((((iIi(((((((((((5567', '((((((((iIi(((((((((((5567', '))))))))iIi)))))))))))5576']);
  const GOLDRINGCIGAR = small(['[[[[[[iIi[[[[[[[4557', '((((((iIi(((((((5567', '))))))iIi)))))))5576']);
  const NOSESPRAY = small(['.a.', '.a.', 'bbb', 'bab', 'bbb', 'bbb']);
  const GOLDJOINT = JOINT.map((r) => r.replace(/9/g, 'i').replace(/0/g, 'I'));
  const DIAMONDCIG = CIG_STAGES[9].map((r, y) => (y === 1 || y === 2 ? [...r].map((c, x) => (c === '3' && x % 3 === y % 3 ? 'C' : c)).join('') : r));

  // Handy, Zeitung, Geldbeutel, Weihnachtsbaum, zwei Dosen als Begleiter (Version 1.38)
  const PHONE = small(['KKKK', 'KbbK', 'KbcK', 'KbbK', 'KKKK']);
  const NEWSPAPER = small(['aaaaaaaaaaaaaa', 'aKKKKKaj5j5j5a', 'aKKKKKaaaaaaaa', 'aj5j5jaj5j5j5a', 'aaaaaaaaaaaaaa', 'aj5j5j5j5j5j5a', 'aaaaaaaaaaaaaa']);
  const WALLET = small(['((((((', '()))))', '(()(((', '((((((']);
  const WALLET_OPEN = small(['.VVVV.', 'VZVVZV', '((((((', '(i)(((', '((((((']);
  const XMASTREE = small(['...i...', '...V...', '..VVV..', '..VdV..', '.VVVVV.', '.VbVVd.', 'VVVVVVV', 'VdVVbVV', '...u...', '..uuu..']);
  const ORANGECAN = small(['...555555...', '.5444554445.', '.5444445456.', '.yyiyyyyyyy.', '.QQayaaaaQa.', '.aaQQQaaQQQ.', '.yyiyyyyyyy.', '.5444445456.', '.5444466666.', '.5444466466.', '.5444466666.', '.544446a4a6.', '.544446a4a6.', '.54444666a6.', '.54444aa6a6.', '.544446a666.', '.5444466666.', '.544446a656.', '.544446a666.', '.y4444666a6.', '.5444445666.', '.544y445666.', '.y4y4y45666.', '.544y445466.', '.y4y4y45456.', '.544y445456.', '.5444445456.', '...666666...']);
  const LIMECAN = small(['...555555...', '.5444554445.', '.5444445456.', '.MMMMMMMMMM.', '.aMaZZaaMMM.', '.aZaZZaZMMM.', '.MMMMMMMMMM.', '.5444445456.', '.5444466666.', '.5444466466.', '.5444466666.', '.544446a4a6.', '.544446a4a6.', '.54444666a6.', '.54444aa6a6.', '.544446a666.', '.5444466666.', '.544446a656.', '.544446a666.', '.M4444666a6.', '.5444445666.', '.544M445666.', '.M4M4M45666.', '.544M445466.', '.M4M4M45456.', '.544M445456.', '.5444445456.', '...666666...']);

  // Schere, Stein, Papier: Handzeichen für die Sprechblase
  const RPS_STEIN = small(['.nnnn.', 'nnnnnn', 'njnjnn', 'nnnnnn', '.nnnn.']);
  const RPS_PAPIER = small(['n.n.n.', 'n.n.n.', 'nnnnnn', 'nnnnnn', 'nnnnnn', '.nnnn.']);
  const RPS_SCHERE = small(['n...n', 'n...n', '.n.n.', '.nnn.', 'nnnnn', '.nnn.']);

  // Drink, Hand, Capybara, schwarze Dose (Version 1.40)
  const DRINK = small(['.II............', 'IJII...........', 'IJ.AAAAAAAAAAA.', '.IA...........B', '.JACCCCCCCCCCCB', '..ACBCGGGGGGCCB', '..AEBEGGGGGGEEB', '..AEBDHHHHHFDEB', '..ADBDHGHHHFEDB', '..ADBDHHHHHFDDB', '..ADBEHHHHHFDDB', '..ADBDFFFFFFDDB', '..AEDDDDEDDDDEB', '..AAAAAAAAAAAAB', '....BBBBBBBBB..', '...............']);
  const CAPY = ['...AAAA.......', '..AEDABA......', '.DEFEEBBAAA...', 'ABFFDDFFDBCDA.', 'ABBFDDFFDEFFDA', 'ABBFFFFFFFFFFA', '.AABDDFFFFFDFA', '...AFDDFFFFFFA', '...ACDFDEEFFBA', '....BBDACBDDA.', '....AAA..AAA..'];
  const BLACKCAN = small(['.AAAAAAAAA..', 'ADAAAAACCCAG', 'AAAAAAAAAAFG', 'AEEEEEEEEEFG', 'AAAAAAAAAAEG', 'ADAHHHHHHHAG', 'ADAHAHHEAAFG', 'ADDHCHHEAAFG', 'ADDHCEHEAAFG', 'ADAHCEHEAHFG', 'ADAHCEHEDHFG', 'ADAHAHBEDHFG', 'ADDHAHDEAAFG', 'ADEAAAHEHAFG', 'AFEAAAAEAEFG', 'AFDFBEAEEEFG', 'AFEEEAAEEEAG', 'AAAGAGGDGGAG', 'AABGAGGAGEAB', 'AFAEDAAAAEAG', 'AAACBAAACEFG', 'AAEEEEEEEEFG', 'ABAEEEEEEAA.', '.ACCCCCCCA..']);

  // eigene Farbtabellen für Teile nach Bildern (gelten nur für dieses Teil)
  // Kühlbox (Begleiter; Dosen setzen sich zum Schlafen hinein), Mini-Dosen für den Dosenturm
  const KUEHLBOX = small(['....BBBBBBBB....', '....B......B....', 'AAAAAAAAAAAAAAAA', 'ACCCCCCCCCCCCCCA', 'DDDDDDDDDDDDDDDD', 'DEEEEEEEEEEEEEED',
    'DEEEEFFFFFFEEEED', 'DEEEEFFFFFFEEEED', 'DEEEEEEEEEEEEEED', 'DEEEEEEEEEEEEEED', 'DDDDDDDDDDDDDDDD']);
  const STACKCAN_O = small(['.AAA.', 'ABBBA', 'CDDDC', 'CDDDC', 'ABBBA', 'ABEBA', 'ABEBA', 'ABBBA', '.AAA.']);
  const STACKCAN_M = small(['.AAA.', 'ABBBA', 'BCBCB', 'BCBCB', 'BCBCB', 'BBCBB', 'BBBBB', 'ABBBA', '.AAA.']);
  const PROP_PALS = {
    KUEHLBOX: { A: '#e9eef2', B: '#7a8590', C: '#ffffff', D: '#1d5fa8', E: '#2f7fd0', F: '#e9f2fa' },
    STACKCAN_O: { A: '#6c7378', B: '#c9cdd1', C: '#c4671a', D: '#ee8a2a', E: '#3c4044' },
    STACKCAN_M: { A: '#8d9198', B: '#f2f0ea', C: '#8a909c' },
    CAPY: { 'A': '#312219', 'B': '#754a2c', 'C': '#97693e', 'D': '#b8824c', 'E': '#ba824b', 'F': '#ba834d' }, BLACKCAN: { 'A': '#010101', 'B': '#0f0f0d', 'C': '#181815', 'D': '#252521', 'E': '#30332a', 'F': '#4d504b', 'G': '#61615d', 'H': '#7d7e7b' }, DRINK: { 'A': '#f4ecec', 'B': '#d6a6a6', 'C': '#3a0c14', 'D': '#7a1018', 'E': '#a3201e', 'F': '#8a2a14', 'G': '#f1ddd6', 'H': '#e8682a', 'I': '#f6a628', 'J': '#c26a10' } };

  // Aschenbecher (Glas), Kippe darin; Feuerzeug zum Anzünden
  const ASHTRAY = small(['4555555554', '5444444445', '.55555555.']);
  const BUTT = ['2113'];
  const LIGHTER = small(['jj.', 'bbb', 'bzb', 'bzb', 'bbb']);
  const TOOTHPICK = small(['nnnnnn']);
  // Begleiter: Kissen hinter ihr, Skateboard unter ihr, Teddy neben ihr
  const PILLOW = small(['.CCCCCCCCCCCCCC.', 'CCCCCCCCCCCCCCCC', 'CCaCCCCCCCCCCaCC', 'CCCCCCCCCCCCCCCC', 'CCCCCCCCCCCCCCCC', '.CCCCCCCCCCCCCC.']);
  const SKATEBOARD = small(['bbbbbbbbbbbbbbbbbbbb', '..KK............KK..']);
  const TEDDY = small(['u...u', 'uuuuu', 'uUkUu', 'uuuuu', '.uuu.', 'uu.uu']);
  const GIFTGOLD = small(['.d..d.', '..dd..', 'iiddii', 'iIddIi', 'IIddII', 'IIddII']);
  // Schnee: Schneemann neben der Figur, kleine Schneehaube auf dem Kopf
  const SNOWMAN = small([
    '...KK...',
    '..KKKK..',
    '.aaaaa..',
    '.akaka..',
    '.aayyy..',
    '..aaa...',
    '.aaaaaa.',
    'aaakaaan',
    'aaaaaaan',
    'aaakaaan',
    '.aaaaan.',
  ]);
  const SNOWCAP = ['.aaaa.', 'aaaaaa'];
  // Snacks zum Füttern
  const APPLE = small(['..V..', '.RRR.', 'RRRRR', 'RRRrR', '.RRr.']);
  const COOKIE = small(['.uuu.', 'uUkUu', 'uUUku', 'ukUUu', '.uuu.']);

  // Laptop (Rückseite des Deckels) vor Mini-Claude beim Tippen, kleiner Laptop neben ihm beim Kaffee
  const LAPTOP = small([
    'KKKKKKKKKKKKKKKKKKKK',
    'KsKKKKKKKKKKKKKKKKKK',
    'KKKKKKKKKaKKKKKKKKKK',
    'KKKKKKKaKaKaKKKKKKKK',
    'KKKKKKKKaaaKKKKKKKKK',
    'KKKKKKKaKaKaKKKKKKKK',
    'KKKKKKKKKaKKKKKKKKKK',
    'KKKKKKKKKKKKKKKKKKKK',
    'jjjjjjjjjjjjjjjjjjjj',
  ]);
  const LAPTOP_MINI = small(['KKKKKKK', 'KsKKKKK', 'KKKaKKK', 'KKaaaKK', 'KKKaKKK', 'KKKKKKK', 'jjjjjjj']);
  // Kaffeebecher: cremefarben, dunkler Kaffee, Henkel rechts
  const MUG = small(['=%%%%=..', '======##', '=====#.#', '=====#.#', '=====###', '.####...']);

  // Essen zum Füttern (Version 1.35)
  const DOENER = small(['..UUUUUU..', '.UuuuuuuU.', 'UV[d[V[dVU', 'Ua(a(a(a(U', 'U[([([([(U', '.UUUUUUUU.']);
  const PIZZA = small(['uuuuuuuuu', 'UiiiiiiiU', '.iidiidi.', '.iiiiiii.', '..idiii..', '..iiii...', '...ii....', '...i.....']);
  const BURGER = small(['..uuuuu..', '.uUuUuUu.', 'uuuuuuuuu', 'VVVVVVVVV', 'iiiiiiiii', ')))))))))', 'uuuuuuuuu', '.uuuuuuu.']);
  const FRIES = small(['.i.i.i.', 'iiiIiii', 'iiIiiIi', 'ddddddd', 'ddaddad', '.ddddd.', '.ddddd.']);
  const TACO = small(['..VdViVd..', '.U((V((iU.', 'UuU(((U(uU', 'UuuuuuuuuU', '.UUUUUUUU.']);
  const PRETZEL = small(['.uuuu.uuuu.', 'uUaUuuUaUUu', 'uU..uUu..Uu', 'uU.uU.Uu.Uu', '.uuU...Uuu.', '..uU...Uu..', '.uu.....uu.']);
  const PASTA = small(['..dIdIdd..', '.IdiIdIdI.', 'iIiIidIiIi', 'jaaaaaaaaj', '.jjjjjjjj.']);
  const DONUT = small(['..ggggg..', '.gbgigdg.', 'ggg...ggg', 'gig...gbg', 'uuggdgguu', '.uuuuuuu.']);
  const ICECREAM = small(['..ggg..', '.gggga.', '.aaaaa.', 'aaaaaaa', 'uUuUuUu', '.UuUuU.', '..uUu..', '...u...']);
  const CROISSANT = small(['...uUUUUu...', '.uUuUuUuUUu.', 'UuU.uUuU.uUU', 'Uu........uU', 'u..........u']);
  const PANCAKES = small(['...ii....', '.UUUUUUU.', 'U((((U(UU', 'uUUUUUUUu', 'uuu(uuuuu', 'UUUUUUUUU', 'jaaaaaaaj']);
  const CHOCOLATE = small([')()()()', '(((((((', ')()()()', 'ddddddd', 'daaaaad', 'ddddddd']);
  const MUFFIN = small(['..))))..', '.)K)))K)', ')))K))))', 'pgpgpgpg', '.pgpgpg.', '.pgpgpg.']);
  const MELON = small(['dddddddddd', 'ddKddKdddd', '.dddKddKd.', '..aaaaaa..', '...VVVV...']);
  const BANANA = small(['u.........', 'ii........', '.ii.....iu', '..iiiiiii.', '...IiiiI..']);
  const POPCORN = small(['.aanaan.', 'anaanaan', 'adadadad', 'adadadad', '.adadad.', '.adadad.']);
  const PEEL = small(['i...i', '.iii.', 'uiiiu']);

  const IDEA = small(['.iii.', 'iIiii', 'iiiii', '.iii.', '.jjj.', '..j..']);
  const LENS = small(['.jjjj.', 'jJJJJj', 'jJJJJj', 'jJJJJj', '.jjjj.', '....jj', '.....j']);

  const WEATHER_ICONS = {
    sun: ['...i...', '.i...i.', '..iii..', 'i.iIi.i', '..iii..', '.i...i.', '...i...'],
    cloud: ['.......', '..LLL..', '.LLLLL.', 'LLLLLLL', '.LLLLL.', '.......', '.......'],
    rain: ['..LLL..', '.LLLLL.', 'LLLLLLL', '.......', '.c.c.c.', 'c.c.c..', '.......'],
    snow: ['..LLL..', '.LLLLL.', 'LLLLLLL', '.......', '.n.n.n.', 'n.n.n..', '.......'],
    storm: ['..LLL..', '.LLLLL.', 'LLLLLLL', '...ii..', '..ii...', '...i...', '..i....'],
  };

  const CHARACTERS = { claude, ...critters };
  const ORDER = ['claude', ...Object.keys(critters).filter((id) => !critters[id].hidden)];

  function character(id) {
    const c = CHARACTERS[id] || CHARACTERS.claude;
    return {
      id: CHARACTERS[id] ? id : 'claude',
      ...c,
      palette: { ...SHARED, ...c.palette },
      ownColors: Object.keys(c.palette), // Farben der Figur selbst (für Farbvarianten)
      propPals: PROP_PALS,
      props: {
        IDEA, LENS, STAR, MUSHROOM, SANTA, PARTY, UMBRELLA, EARS, PUMPKIN, NIGHTCAP, BELL, EGG, APPLE, COOKIE, DOENER, PIZZA, BURGER, FRIES, TACO, PRETZEL, PASTA, DONUT, ICECREAM, CROISSANT, PANCAKES, CHOCOLATE, MUFFIN, MELON, BANANA, POPCORN, PEEL, MEDAL, STONE, GIFT, GIFTGOLD, WING_L, WING_R, CAPE1, CAPE2, BUBBLETEA, MINITEDDY, BUNNY, DUMBBELL, FIREPLACE, FRIDGE, FRIDGE_OPEN, GOLDBARS, RADIATOR, THERMOS, BEANBAG, CHAIR_BACK, CHAIR_SEAT, BED, BLANKET, HAMMOCK, GLOBEBASE, ...ACCESSORIES2, CIGARETTE, JOINT, ASHTRAY, BUTT, LIGHTER, DRINK, CAPY, BLACKCAN, KUEHLBOX, STACKCAN_O, STACKCAN_M, RPS_STEIN, RPS_PAPIER, RPS_SCHERE, PHONE, NEWSPAPER, WALLET, WALLET_OPEN, XMASTREE, ORANGECAN, LIMECAN, JOINTXXL, SHERLOCK, VAPEXXL, GOLDPICK, CIGARXXL, GOLDRINGCIGAR, NOSESPRAY, GOLDJOINT, DIAMONDCIG,
        CIGARILLO, ROLLIE, SLIM, FRUITVAPE, GRILLZ, SHISHA, BONG, ENERGYCAN, SNUSCAN, SNUSCAN_OPEN, CIGPACK, CIGPACK_OPEN, ZIPPO, ZIPPO_OPEN, JOINTCROWN, LAPTOP, LAPTOP_MINI, MUG, CIGAR, PIPE, VAPE, TOOTHPICK, PILLOW, SKATEBOARD, TEDDY, SNOWMAN, SNOWCAP, ...ACCESSORIES,
        GLASSES: c.glasses || (c.front ? GLASSES_FRONT : GLASSES_SIDE),
      },
    };
  }

  // ---------- Farbvarianten (gemeinsam für Figur und Einstellungsfenster) ----------
  const VARIANTS = {
    blau: { h: 212 }, gruen: { h: 128 }, lila: { h: 275 }, rosa: { h: 332 },
    gold: { h: 40, sAdd: 0.25, lAdd: 0.04, shift: 1.4 }, mitternacht: { h: 232, sMul: 0.6, lMul: 0.5, shift: 1.6 },
  };
  const KEEP_COLORS = new Set(['E', 'e', 'H', 'P', 'm', 't', 'k']);
  function hexToHsl(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  }
  function hslToHex(h, s, l) {
    const f = (n) => {
      const k = (n + h / 30) % 12;
      const a = s * Math.min(l, 1 - l);
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }
  function recolor(palette, keys, variant, tweaks) {
    const v = (tweaks && tweaks[variant]) || VARIANTS[variant];
    if (!v) return palette;
    const out = { ...palette };
    const usable = keys.filter((k) => !KEEP_COLORS.has(k) && typeof palette[k] === 'string' && palette[k].length === 7);
    const avgL = usable.reduce((sum, k) => sum + hexToHsl(palette[k])[2], 0) / Math.max(1, usable.length);
    for (const k of usable) {
      let [, s, l] = hexToHsl(palette[k]);
      // Farbton-Verschiebung wie in der Pixel-Kunst: helle Töne wandern etwas zu einer, dunkle zur anderen Seite.
      // Dadurch wirkt eine Farbvariante lebendig statt einfarbig.
      const dh = Math.max(-24, Math.min(24, (l - avgL) * 80)) * (v.shift === undefined ? 1 : v.shift);
      s = Math.min(1, Math.max(s, 0.32) * (v.sMul || 1) + (v.sAdd || 0));
      l = Math.min(0.97, Math.max(0.04, l * (v.lMul || 1) + (v.lAdd || 0)));
      out[k] = hslToHex((v.h + dh + 360) % 360, s, l);
    }
    return out;
  }

  const api = { CHARACTERS, ORDER, SHARED, character, recolor, VARIANTS, cigarette, KEYBOARD, WING, HEART, WEATHER_ICONS };
  if (typeof module !== 'undefined') module.exports = api;
  else root.DuckSprites = api;
})(this);
