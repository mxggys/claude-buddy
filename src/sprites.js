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
  };
  const framesOf = (draw) => Object.fromEntries(Object.entries(POSES).map(([k, o]) => [k, draw(o)]));

  // ---------------------------------------------------------------------------------------------
  // Enten (Seitenansicht, blicken nach rechts), Raster 26 x 23
  const DW = 26;
  const DH = 23;

  function sideDuck(look) {
    const L = {
      head: [15, 6.3, 4.9, 4.6], body: [10.7, 15.3, 7.9, 4.75], neck: [14.2, 11.5, 3.3, 3.3],
      tail: true, feet: true, beak: [20.6, 7.6, 2.8, 1.25], cheek: true, sitDrop: 2, ...look.shape,
    };
    const body = tone('W', 'w', 'v', 'h');
    return function draw({ beak = 0, eye = 'open', feet = 'stand', wing = 'down', headDy = 0, sit = false }) {
      const g = grid(DW, DH);
      const by = sit || !L.feet ? L.sitDrop : 0;
      const hy = headDy + by;
      if (L.tail) {
        ellipse(g, 4, 12.3 + by, 2.4, 1.8, look.tailPaint || body, -0.5);
        ellipse(g, 5.3, 13.8 + by, 2.6, 2, look.tailPaint || body);
      }
      ellipse(g, L.body[0], L.body[1] + by, L.body[2], L.body[3], look.bodyPaint || body);
      ellipse(g, L.neck[0], L.neck[1] + hy * 0.5 + by * 0.5, L.neck[2], L.neck[3], look.neckPaint || body);
      if (look.chest) look.chest(g, by, hy);
      ellipse(g, L.head[0], L.head[1] + hy, L.head[2], L.head[3], look.headPaint || body);
      if (look.headExtra) look.headExtra(g, hy);
      const wp = look.wingPaint || wingTone('W', 'w', 'v');
      if (wing === 'up') ellipse(g, 8.4, 12.4 + by, 5, 2.6, wp, -0.55);
      else ellipse(g, 9.1, 14.7 + by, 4.9, 2.8, wp, 0.08);
      if (look.wingExtra) look.wingExtra(g, by, wing);

      // Schnabel
      const [bx, bcy, brx, bry] = L.beak;
      ellipse(g, bx, bcy + hy, brx, bry, beakTone);
      for (let i = 0; i < beak; i++) {
        rect(g, Math.round(bx - brx + 0.6), Math.round(bcy + bry) + hy + i, Math.round(bx + brx - 1.2), Math.round(bcy + bry) + hy + i, i ? 't' : 'm');
      }
      ellipse(g, bx - 0.5, bcy + bry + 0.3 + hy + beak, brx * 0.85, bry * 0.7, () => 'o');

      // Auge (Pupille wird vom Renderer gezeichnet, hier nur Platzhalter E)
      const ex = look.eye ? look.eye[0] : 16;
      const ey = (look.eye ? look.eye[1] : 4) + hy;
      if (L.cheek) set(g, [[ex - 1, ey + 4], [ex, ey + 4]], 'P');
      if (eye === 'closed' || eye === 'wink') set(g, [[ex - 1, ey + 1], [ex, ey + 1], [ex + 1, ey + 1], [ex + 2, ey]], 'X');
      else if (eye === 'sleepy') { set(g, [[ex - 1, ey], [ex, ey], [ex + 1, ey], [ex + 2, ey]], 'X'); set(g, [[ex, ey + 1], [ex + 1, ey + 1]], 'e'); }
      else if (eye === 'wide') { rect(g, ex, ey - 1, ex + 1, ey + 1, 'e'); set(g, [[ex, ey - 1]], 'H'); }
      else if (eye === 'dizzy') set(g, [[ex - 1, ey - 1], [ex + 1, ey - 1], [ex, ey], [ex - 1, ey + 1], [ex + 1, ey + 1]], 'e');
      else if (eye === 'happy') set(g, [[ex - 1, ey + 1], [ex, ey], [ex + 1, ey], [ex + 2, ey + 1]], 'X');
      else {
        rect(g, ex, ey, ex + 1, ey + 1, 'E');
        if (eye === 'angry') set(g, [[ex - 2, ey - 2], [ex - 1, ey - 2], [ex, ey - 1], [ex + 1, ey - 1], [ex + 2, ey - 1]], 'X');
      }

      // Beine
      if (L.feet && feet !== 'none') {
        const foot = (lx, fx, lift = 0) => {
          set(g, [[lx, 19 - lift], [lx, 20 - lift]], 'f');
          rect(g, fx, 21 - lift, fx + 2, 21 - lift, 'F');
        };
        if (feet === 'stand') { foot(8, 7); foot(13, 12); }
        if (feet === 'step1') { foot(7, 5); foot(13, 13, 1); }
        if (feet === 'step2') { foot(9, 8, 1); foot(12, 10); }
      }
      return finish(g, hy);
    };
  }

  const duckAnchors = {
    keyboard: [15, 17], wingUp: [18, 12], wingDown: [19, 15], tap: [21, 17],
    idea: [13, -7],
    mushroom: [23, 15],
    snore: [23, 9],
    hat: [15, 3],        // Mütze / Partyhut: Mitte und Unterkante auf dem Kopf
    umbrella: [3, -10],  // Schirm über der Ente
    glasses: [15, 3],    // Sonnenbrille über dem Auge
  };
  const duckEye = { positions: [[16, 4]], pattern: ['HE', 'EE'] };
  const DUCK_BEAK = { O: '#ffb53d', o: '#e8841c', q: '#fff1a8', F: '#ffb53d', f: '#e8841c' };

  const ducks = {
    'ente-klassik': {
      name: 'Klassik',
      palette: { W: '#fffbf2', w: '#ede3cd', v: '#d2c1a0', h: '#ffffff', P: '#ffb0a8', ...DUCK_BEAK },
      draw: sideDuck({
        // kleine Haartolle auf dem Kopf
        headExtra(g, hy) { set(g, [[14, 1 + hy], [15, 1 + hy], [15, 0 + hy]], 'W'); },
        // Federlinien am Flügel
        wingExtra(g, by, wing) {
          if (wing !== 'up') set(g, [[6, 16 + by], [7, 16 + by], [9, 17 + by], [10, 17 + by]], 'v');
        },
      }),
    },
  };
  for (const d of Object.values(ducks)) {
    Object.assign(d, { frames: framesOf(d.draw), eye: duckEye, anchors: duckAnchors, width: DW, height: DH, scale: 3 });
    d.eyeBg = d.eyeBg || 'W';
  }

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
    voice: 'blip',
    idleActions: ['wave', 'yawn', 'stretch', 'idea', 'look', 'dance', 'mushroom', 'wink'],
    typingFrames: ['tapL', 'tapR'],
    anchors: { keyboard: [8, 16], tap: [15, 17], idea: [13, -7], lens: [26, 4], mushroom: [-9, 16], snore: [17, 11],
      hat: [15, 7], umbrella: [9, -11], glasses: [6, 7] },
    width: CW,
    height: CH,
    scale: 3,
  };

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

  const IDEA = small(['.iii.', 'iIiii', 'iiiii', '.iii.', '.jjj.', '..j..']);
  const LENS = small(['.jjjj.', 'jJJJJj', 'jJJJJj', 'jJJJJj', '.jjjj.', '....jj', '.....j']);

  const WEATHER_ICONS = {
    sun: ['...i...', '.i...i.', '..iii..', 'i.iIi.i', '..iii..', '.i...i.', '...i...'],
    cloud: ['.......', '..LLL..', '.LLLLL.', 'LLLLLLL', '.LLLLL.', '.......', '.......'],
    rain: ['..LLL..', '.LLLLL.', 'LLLLLLL', '.......', '.c.c.c.', 'c.c.c..', '.......'],
    snow: ['..LLL..', '.LLLLL.', 'LLLLLLL', '.......', '.n.n.n.', 'n.n.n..', '.......'],
    storm: ['..LLL..', '.LLLLL.', 'LLLLLLL', '...ii..', '..ii...', '...i...', '..i....'],
  };

  const CHARACTERS = { ...ducks, claude };
  const ORDER = ['ente-klassik', 'claude'];

  function character(id) {
    const c = CHARACTERS[id] || CHARACTERS['ente-klassik'];
    return {
      id: CHARACTERS[id] ? id : 'ente-klassik',
      ...c,
      palette: { ...SHARED, ...c.palette },
      props: {
        IDEA, LENS, STAR, MUSHROOM, SANTA, PARTY, UMBRELLA,
        GLASSES: c.front ? GLASSES_FRONT : GLASSES_SIDE,
      },
    };
  }

  const api = { CHARACTERS, ORDER, character, KEYBOARD, WING, HEART, WEATHER_ICONS };
  if (typeof module !== 'undefined') module.exports = api;
  else root.DuckSprites = api;
})(this);
