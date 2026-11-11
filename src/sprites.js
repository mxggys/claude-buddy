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
  const claude = {
    name: 'Mini-Claude',
    palette: { W: '#d9654c', w: '#b9503a', v: '#9c412f', h: '#e8836b', E: '#151112', e: '#151112', m: '#3a1712', t: '#e9917f', P: '#f29a86' },
    frames: framesOf(miniClaude),
    eye: { positions: [[7, 8], [20, 8]], pattern: ['HEE', 'EEE', 'EEE'] }, // kleiner Glanzpunkt oben links
    eyeBg: 'W',
    front: true,
    arms: true,
    thinks: true, // denkt mit, wenn ein Claude-Fenster vorne ist
    laptop: true, // tippt auf einem Laptop statt auf der Mini-Tastatur, trinkt Kaffee
    voice: 'blip',
    idleActions: ['wave', 'yawn', 'stretch', 'idea', 'look', 'dance', 'mushroom', 'wink', 'bounce', 'sneeze', 'spin', 'coffee'],
    typingFrames: ['tapL', 'tapR'],
    anchors: { mouth: [16, 13], hand: [28, 11], keyboard: [8, 16], tap: [15, 17], idea: [13, -7], lens: [26, 4], mushroom: [-9, 16], snore: [17, 11],
      hat: [15, 7], umbrella: [9, -11], glasses: [6, 7], laptop: [4, 11], mug: [-8, 8] },
    width: CW,
    height: CH,
    scale: 3,
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
      const o = { hy, by, sit, step, typing, wiggle: step || typing || wing === 'up' ? 1 : 0 };
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

  const CRITTER_ACTIONS = ['wave', 'yawn', 'stretch', 'idea', 'look', 'dance', 'mushroom', 'wink', 'bounce', 'sneeze', 'spin'];
  const critterDefs = {
    boo: {
      // nach Vorlage: Bettlaken-Geist, Kopf oben links, linker Arm angehoben, rechter Arm angelegt,
      // Saum läuft nach rechts unten aus. Fertig gezeichnet (mit Umriss), daher größeres Raster.
      name: 'Boo (Geist)',
      palette: { W: '#f4f6ff', w: '#cfd3ea', v: '#a9aed0', h: '#ffffff', X: '#4a4a52', x: '#7a7a86', E: '#141418', e: '#141418', P: '#ffb3c8', m: '#2a2a30', t: '#ff8fa8' },
      float: true, // schwebt über dem Boden
      extraActions: ['vanish'],
      w: 32, h: 31, scale: 2.25, noOutline: true,
      eyes: { xs: [7, 12], y: 7, w: 2, h: 3 },
      pattern: ['HE', 'EE', 'EE'],
      cheeks: [6, 14],
      mouth: [9, 12],
      shape(g, o) {
        BOO.forEach((row, y) => [...row].forEach((ch, x) => {
          if (ch === '.') return;
          // Saum weht beim Schweben leicht
          const dx = y >= 27 && o.step === 1 ? 1 : 0;
          set(g, [[x + dx, y + 1 + o.hy]], ch);
        }));
      },
      face(g, o) { set(g, [[9, 12 + o.hy], [10, 12 + o.hy]], 'm'); },
      mug: ['K', 's'],
      anchors: {
        hat: [14, 2], glasses: [6, 6], keyboard: [6, 19], tap: [13, 22], idea: [12, -8], lens: [24, 4],
        mushroom: [-9, 24], snore: [22, 5], umbrella: [6, -12], mouth: [11, 12],
      },
    },
    frosti: {
      name: 'Frosti (Pinguin)',
      palette: { W: '#3a4360', w: '#2c344c', v: '#20263a', h: '#525e82', B: '#f7f8fb', N: '#dfe3ec', X: '#0f131d', x: '#3a4360', E: '#10131c', e: '#10131c', O: '#ffa733', o: '#e07d12', F: '#ffa733', m: '#5a1d10', t: '#ff7d6b', P: '#ffb0b8' },
      eyeBg: 'B',
      waddle: true, // watschelt beim Tippen
      slides: true, // rutscht nach dem Absetzen auf dem Bauch weiter
      eyes: { xs: [9, 13], y: 8, w: 2, h: 2 },
      pattern: ['HE', 'EE'],
      cheeks: [8, 15],
      mouth: [11, 11],
      arms: [4, 18, 11, 2, 6],
      feet: [[8, 3], [13, 3]],
      footKey: 'F',
      shape(g, o) {
        ellipse(g, 12, 13.5 + o.by, 7, 8 - o.by, body);
        ellipse(g, 12, 15.5 + o.by, 5, 5.6 - o.by, (nx, ny) => (nx + ny > 0.9 ? 'N' : 'B'));
        ellipse(g, 12, 9.5 + o.hy, 5, 3.2, () => 'B');
      },
      face(g, o) { rect(g, 11, 11 + o.hy, 12, 11 + o.hy, 'O'); set(g, [[11, 12 + o.hy]], 'o'); },
      mug: ['b', 'z'],
      anchors: { hat: [12, 6], glasses: [8, 7] },
    },
    axo: {
      name: 'Axo (Axolotl)',
      palette: { W: '#f7a8c4', w: '#e98bb0', v: '#d06e96', h: '#ffd0e0', B: '#fde2ec', G: '#e0477e', X: '#7a2c4a', x: '#b25a7e', E: '#2a1220', e: '#2a1220', m: '#5a1530', t: '#ff6f8f', P: '#ff7aa8' },
      eyes: { xs: [8, 14], y: 10, w: 2, h: 2 },
      pattern: ['HE', 'EE'],
      cheeks: [7, 16],
      mouth: [11, 13],
      arms: [5, 17, 16, 2, 2],
      feet: [[8, 2], [14, 2]],
      shape(g, o) {
        ellipse(g, 12, 17.5 + o.by, 6, 3.6, body);
        ellipse(g, 12, 18 + o.by, 3.5, 2.4, () => 'B');
        ellipse(g, 12, 11 + o.hy, 7.5, 5.5, body);
        // Kiemen wackeln beim Tippen und bei Bewegung
        const t = o.wiggle;
        for (const [x, y, side] of [[3, 7, -1], [2, 10, -1], [3, 13, -1], [19, 7, 1], [20, 10, 1], [19, 13, 1]]) {
          rect(g, x, y + o.hy, x + 1, y + o.hy, 'G');
          set(g, [[x + (side < 0 ? -1 : 2), y + o.hy - (t && y !== 10 ? 1 : 0)]], 'G');
        }
      },
      face(g, o) { set(g, [[11, 13 + o.hy], [12, 13 + o.hy], [10, 12 + o.hy], [13, 12 + o.hy]], 'e'); },
      mug: ['g', 'p'],
      anchors: { hat: [12, 6], glasses: [7, 9] },
      record: true, // freut sich besonders über einen Tipp-Rekord
    },
    hopsi: {
      name: 'Hopsi (Hase)',
      palette: { W: '#f3efe8', w: '#e2dace', v: '#cbbfae', h: '#ffffff', B: '#fff8f0', A: '#f39bb4', X: '#5b5048', x: '#9a8d82', E: '#1d1714', e: '#1d1714', m: '#5a2a24', t: '#f07a8a', P: '#ffa8b8' },
      jump: 1.35, // springt beim Doppelklick höher
      extraActions: ['binky', 'binky'],
      eyes: { xs: [8, 14], y: 12, w: 2, h: 2 },
      pattern: ['HE', 'EE'],
      cheeks: [7, 16],
      mouth: [11, 15],
      arms: [5, 17, 15, 2, 3],
      feet: [[8, 3], [13, 3]],
      footKey: 'B',
      shape(g, o) {
        // Ohren: im Schlaf und bei Müdigkeit klappt eins um
        const flop = o.sit;
        rect(g, 8, 2 + o.hy, 9, 9 + o.hy, (x, y) => (x === 9 && y > 3 + o.hy && y < 8 + o.hy ? 'A' : 'W'));
        if (flop) rect(g, 14, 9 + o.hy, 19, 10 + o.hy, (x, y) => (y === 9 + o.hy && x > 14 && x < 19 ? 'A' : 'w'));
        else rect(g, 14, 2 + o.hy, 15, 9 + o.hy, (x, y) => (x === 14 && y > 3 + o.hy && y < 8 + o.hy ? 'A' : 'w'));
        ellipse(g, 12, 15 + o.by, 7.5, 6 - o.by * 0.5, body);
        ellipse(g, 12, 17.5 + o.by, 4, 3, () => 'B');
      },
      face(g, o) {
        set(g, [[12, 14 + o.hy]], 'A');
        set(g, [[11, 15 + o.hy], [13, 15 + o.hy]], 'e');
      },
      mug: ['y', 'Q'],
      anchors: { hat: [12, 10], glasses: [7, 11] },
    },
    pando: {
      name: 'Pando (Panda)',
      palette: { W: '#f5f5f7', w: '#e3e3ea', v: '#cbcbd5', h: '#ffffff', G: '#25252d', X: '#121217', x: '#4a4a55', E: '#ffffff', e: '#ffffff', H: '#25252d', m: '#25252d', t: '#ff7d8a', P: '#ffb3c0' },
      eyeBg: 'G',
      shutKey: 'e',
      rolls: true, // kugelt sich bei Klick-Spam
      extraActions: ['bamboo', 'bamboo'],
      eyes: { xs: [8, 15], y: 10, w: 1, h: 2 },
      pattern: ['E', 'E'],
      cheeks: [6, 18],
      mouth: [11, 15],
      arms: [3, 19, 13, 2, 4],
      armKey: 'G',
      feet: [[6, 4], [14, 4]],
      footKey: 'G',
      shape(g, o) {
        ellipse(g, 6, 6.5 + o.hy, 2.6, 2.6, () => 'G');
        ellipse(g, 18, 6.5 + o.hy, 2.6, 2.6, () => 'G');
        ellipse(g, 12, 13.5 + o.by * 0.5, 8.5, 7.5 - o.by * 0.5, body);
        ellipse(g, 8.5, 10.5 + o.hy, 2.2, 2.6, () => 'G');
        ellipse(g, 15.5, 10.5 + o.hy, 2.2, 2.6, () => 'G');
        rect(g, 6, 19, 9, 20, 'G');
        rect(g, 14, 19, 17, 20, 'G');
      },
      face(g, o) { rect(g, 11, 14 + o.hy, 12, 14 + o.hy, 'G'); set(g, [[11, 15 + o.hy], [12, 15 + o.hy]], 'G'); },
      mug: ['M', 'Z'],
      anchors: { hat: [12, 6], glasses: [7, 9], bamboo: [17, 10] },
    },
    kuschel: {
      name: 'Kuschel (Koala)',
      palette: { W: '#a3a7b3', w: '#8a8e99', v: '#70747e', h: '#c7cad3', B: '#f1f1f4', G: '#16161a', X: '#2f3036', x: '#6b6e78', E: '#16161a', e: '#16161a', P: '#f2a7b5', m: '#3a2a30', t: '#f07a8a' },
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
    monsti: {
      // kleine Energydose mit Gesicht: silbern-weiß, Lasche oben, eigener Blitz statt Markenlogo
      name: 'Monsti (Energydose)',
      palette: {
        W: '#eef0f5', w: '#cfd3dc', v: '#a4a9b6', h: '#ffffff', N: '#b9bec9', B: '#4b505c', G: '#7d8391',
        X: '#25272e', x: '#5d616c', E: '#121318', e: '#121318', P: '#ffb0b8', m: '#2a1a1e', t: '#ff7d8a',
      },
      fizzy: true, // sprudelt beim schnellen Tippen
      eyes: { xs: [8, 14], y: 7, w: 2, h: 2 },
      pattern: ['HE', 'EE'],
      cheeks: [7, 16],
      mouth: [11, 10],
      arms: [3, 19, 10, 2, 3],
      feet: [[8, 2], [14, 2]],
      shape(g, o) {
        const b = o.by;
        // nach Vorlage: grauer Deckelrand, heller Deckel mit dunkler Trinköffnung
        rect(g, 7, 0 + b, 16, 0 + b, 'v');
        rect(g, 6, 1 + b, 17, 1 + b, (x) => (x === 6 || x === 17 ? 'v' : 'N'));
        set(g, [[10, 1 + b], [11, 1 + b], [12, 1 + b], [13, 1 + b]], 'B');
        rect(g, 6, 2 + b, 17, 2 + b, 'v');
        // Dose: gebürstetes Metall mit feinen Sprenkeln, links Schatten, rechts heller Glanz
        const speck = (x, y) => ((x * 7 + y * 13) % 19 === 0 ? 'w' : 'W');
        rect(g, 5, 3 + b, 18, 19, (x, y) => (x === 5 ? 'v' : x === 6 ? 'w' : x === 18 ? 'w' : x === 17 ? 'h' : speck(x, y)));
        // feine Schrift oben angedeutet
        rect(g, 9, 4 + b, 14, 4 + b, (x) => (x % 2 ? 'G' : 'w'));
        // Boden
        rect(g, 6, 20, 17, 20, 'v');
        // eigenes Zeichen: grauer Blitz mit hellem Rand
        const bolt = [[13, 12], [14, 12], [12, 13], [13, 13], [11, 14], [12, 14], [11, 15], [12, 15], [13, 15], [14, 15], [13, 16], [14, 16], [12, 17], [13, 17], [11, 18], [12, 18]];
        set(g, bolt.map(([x, y]) => [x, y + b]), 'B');
        set(g, [[15, 12], [14, 13], [13, 14], [15, 15], [15, 16], [14, 17], [13, 18]].map(([x, y]) => [x, y + b]), 'G');
        // Schriftzug unten angedeutet
        rect(g, 8, 19, 15, 19, (x) => (x % 2 ? 'G' : 'w'));
      },
      face(g, o) { set(g, [[11, 10 + o.hy], [12, 10 + o.hy]], 'm'); },
      anchors: { hat: [12, 1], glasses: [7, 6] },
      mug: ['N', 'v'],
    },
  };

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
  const BAMBOO = small(['..ZM', '.MZ.', '.M..', '.Z..', '.M..', '.M..']);
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
  const FISH = small(['.ccc.z', 'ckcccz', '.ccc.z']);
  const CARROT = small(['..VV', '.yV.', 'yyy.', 'yy..', 'y...']);

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
  const ORDER = ['claude', ...Object.keys(critters)];

  function character(id) {
    const c = CHARACTERS[id] || CHARACTERS.claude;
    return {
      id: CHARACTERS[id] ? id : 'claude',
      ...c,
      palette: { ...SHARED, ...c.palette },
      ownColors: Object.keys(c.palette), // Farben der Figur selbst (für Farbvarianten)
      props: {
        IDEA, LENS, STAR, MUSHROOM, SANTA, PARTY, UMBRELLA, EARS, PUMPKIN, NIGHTCAP, BELL, BAMBOO, EGG, APPLE, COOKIE, FISH, CARROT, MEDAL, STONE, GIFT, GIFTGOLD, WING_L, WING_R, CAPE1, CAPE2, CIGARETTE, JOINT, ASHTRAY, BUTT, LIGHTER, LAPTOP, LAPTOP_MINI, MUG, CIGAR, PIPE, VAPE, TOOTHPICK, PILLOW, SKATEBOARD, TEDDY, SNOWMAN, SNOWCAP, ...ACCESSORIES,
        GLASSES: c.glasses || (c.front ? GLASSES_FRONT : GLASSES_SIDE),
      },
    };
  }

  const api = { CHARACTERS, ORDER, character, cigarette, KEYBOARD, WING, HEART, WEATHER_ICONS };
  if (typeof module !== 'undefined') module.exports = api;
  else root.DuckSprites = api;
})(this);
