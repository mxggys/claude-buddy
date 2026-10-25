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
    // auf dem Bauch rutschen (Pinguin), Bambus kauen (Panda)
    slide: { eye: 'happy', sit: true, feet: 'none', wing: 'up', arms: 'cheer' },
    chew1: { beak: 1 },
    chew2: { eye: 'happy' },
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
    arms: true,
    thinks: true, // denkt mit, wenn ein Claude-Fenster vorne ist
    voice: 'blip',
    idleActions: ['wave', 'yawn', 'stretch', 'idea', 'look', 'dance', 'mushroom', 'wink', 'bounce', 'sneeze', 'spin'],
    typingFrames: ['tapL', 'tapR'],
    anchors: { keyboard: [8, 16], tap: [15, 17], idea: [13, -7], lens: [26, 4], mushroom: [-9, 16], snore: [17, 11],
      hat: [15, 7], umbrella: [9, -11], glasses: [6, 7] },
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
    return function draw({ beak = 0, eye = 'open', feet = 'stand', wing = 'down', headDy = 0, sit = false, arms = 'down' }) {
      const g = grid(VW, VH);
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
          rect(g, x, VH - 1 - up, x + w - 1, VH - 1 - up, cfg.footKey || 'w');
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
      return finish(g, hy);
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

  const CRITTER_ACTIONS = ['wave', 'yawn', 'stretch', 'idea', 'look', 'dance', 'mushroom', 'wink', 'bounce', 'sneeze', 'spin'];
  const critterDefs = {
    boo: {
      name: 'Boo (Geist)',
      palette: { W: '#f4f6ff', w: '#dfe3fa', v: '#c3c9ee', h: '#ffffff', X: '#3a3f66', x: '#7a80b4', E: '#1c1d2e', e: '#1c1d2e', P: '#ffb3c8', m: '#3a2a40', t: '#ff8fa8' },
      float: true, // schwebt über dem Boden
      extraActions: ['vanish'],
      eyes: { xs: [8, 14], y: 8, w: 2, h: 3 },
      pattern: ['HE', 'EE', 'EE'],
      cheeks: [7, 16],
      mouth: [11, 13],
      arms: [3, 19, 11, 2, 3],
      shape(g, o) {
        ellipse(g, 12, 9.5 + o.hy, 7, 7, body);
        rect(g, 5, 9 + o.hy, 18, 17, (x) => (x >= 17 ? 'w' : x === 5 ? 'h' : 'W'));
        for (let x = 5; x < 19; x++) if ((x + o.step) % 4 < 2) set(g, [[x, 18]], x >= 17 ? 'w' : 'W');
      },
      face(g, o) { set(g, [[11, 13 + o.hy], [12, 13 + o.hy]], 'm'); },
      anchors: { hat: [12, 4], glasses: [7, 7] },
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
      anchors: { hat: [12, 6], glasses: [8, 7] },
    },
    glibber: {
      name: 'Glibber (Schleim)',
      palette: { W: '#5ab4ff', w: '#3a96e8', v: '#2a74c4', h: '#a8dbff', X: '#15386a', x: '#3a6aa8', E: '#0d1b33', e: '#0d1b33', m: '#0d1b33', t: '#ff7d9a', P: '#ff9ec7' },
      squishy: true, // wabbelt beim Tippen, stärker plattgedrückt beim Landen, prallt ab
      extraActions: ['melt'],
      eyes: { xs: [8, 14], y: 13, w: 2, h: 3 },
      pattern: ['HE', 'EE', 'EE'],
      cheeks: [7, 16],
      mouth: [11, 17],
      shape(g, o) {
        const sq = o.typing ? 1 : 0;
        ellipse(g, 12, 16.5 + sq * 0.5, 9.5 + sq, 5.5 - sq * 0.5, body);
        ellipse(g, 12, 12 + o.hy + sq, 5.5, 4 - sq * 0.5, body);
        set(g, [[12, 7 + o.hy + sq]], 'W');
        set(g, [[8, 11 + o.hy + sq], [7, 12 + o.hy + sq]], 'h');
      },
      face(g) { rect(g, 11, 17, 12, 17, 'm'); },
      anchors: { hat: [12, 8], glasses: [7, 12] },
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
    },
    flitz: {
      name: 'Flitz (Otter)',
      palette: { W: '#8a5a36', w: '#73492a', v: '#5c3920', h: '#a8774f', B: '#e8cfae', G: '#140c06', X: '#2b1a0e', x: '#5a3a22', E: '#140c06', e: '#140c06', P: '#f2a39a', m: '#3a1a10', t: '#f07a6a' },
      record: true, // klatscht bei einem neuen Tipp-Rekord
      extraActions: ['juggle', 'juggle'],
      eyes: { xs: [8, 14], y: 10, w: 2, h: 2 },
      pattern: ['HE', 'EE'],
      cheeks: [7, 16],
      mouth: [11, 14],
      arms: [6, 16, 15, 2, 3],
      feet: [[8, 2], [14, 2]],
      shape(g, o) {
        ellipse(g, 6, 7 + o.hy, 1.8, 1.8, body);
        ellipse(g, 18, 7 + o.hy, 1.8, 1.8, body);
        ellipse(g, 12, 17.5 + o.by, 6, 4, body);
        ellipse(g, 12, 11 + o.hy, 7, 5.5, body);
        ellipse(g, 12, 13 + o.hy, 4, 2.5, () => 'B');
        ellipse(g, 12, 18 + o.by, 3.5, 2.5, () => 'B');
      },
      face(g, o) { rect(g, 11, 12 + o.hy, 12, 12 + o.hy, 'G'); set(g, [[11, 14 + o.hy], [12, 14 + o.hy]], 'G'); },
      anchors: { hat: [12, 6], glasses: [7, 9], stone: [11, 3] },
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
      idleActions: [...CRITTER_ACTIONS, ...(def.extraActions || [])],
      typingFrames: ['tapL', 'tapR'],
      glasses: glassesFor(def.eyes),
      anchors: {
        keyboard: [5, 16], tap: [12, 17], idea: [10, -8], lens: [20, 4], mushroom: [-9, 15], snore: [17, 8],
        umbrella: [5, -11], ...def.anchors,
      },
      width: VW,
      height: VH,
      scale: 3,
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
    BOW: small(['pp.pp', 'ppapp', 'pp.pp']),
    FLOWER: small(['.p.p.', 'ppipp', '.p.p.', '..V..']),
    CAP: small(['..bbbbb...', '.bbbbbbb..', 'bbbbbbbbzz']),
    BEANIE: small(['...a...', '..ddd..', '.ddddd.', 'ddddddd', 'DDDDDDD']),
    TOPHAT: small(['.KKKKK.', '.KKKKK.', '.KsKKK.', '.ddddd.', 'KKKKKKK']),
    HALO: ['.iiiii.', 'i.....i', '.iiiii.'],
    HORNS: small(['d.....d', 'dd...dd', '.D...D.']),
    PIRATE: small(['..KKKKK..', '.KKKaKKK.', 'KKKKKKKKK', '.KK...KK.']),
    CHEF: small(['.aaa.aaa.', 'aaaaaaaaa', '.aaaaaaa.', '..nnnnn..', '..aaaaa..']),
    COWBOY: small(['...uuu...', '..uuuuu..', '..UUUUU..', 'uuuuuuuuu', '.u.....u.']),
    VIKING: small(['a.......a', 'a..jjj..a', '.jjjjjjj.', 'jJjjjjjJj', 'uuuuuuuuu']),
    PROPELLER: small(['.bbb.ddd.', '....k....', '..bdbdb..', '.bdbdbdb.', 'bdbdbdbdb']),
    CATEARS: small(['k.....k', 'kk...kk', 'kpk.kpk', 'kkkkkkk']),
    ANTENNA: small(['i.....i', 'k.....k', '.k...k.', '..kkk..']),
    STARBAND: small(['..i...i..', '.iIi.iIi.', '..i...i..', 'zzzzzzzzz']),
    // seltene, goldene Teile
    GOLDCROWN: small(['i.i.i.i', 'iIiIiIi', 'iiRiCii', 'IIIIIII']),
    TIARA: small(['...C...', '..CaC..', '.i.C.i.', 'iiiiiii']),
  };
  // Engelsflügel (hinter der Figur, links; rechts gespiegelt)
  const WING_L = small(['....aa', '..aaan', '.aaann', 'aaannn', '.aannn', '..ann.']);
  const WING_R = WING_L.map((r) => [...r].reverse().join(''));
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

  const IDEA = small(['.iii.', 'iIiii', 'iiiii', '.iii.', '.jjj.', '..j..']);
  const LENS = small(['.jjjj.', 'jJJJJj', 'jJJJJj', 'jJJJJj', '.jjjj.', '....jj', '.....j']);

  const WEATHER_ICONS = {
    sun: ['...i...', '.i...i.', '..iii..', 'i.iIi.i', '..iii..', '.i...i.', '...i...'],
    cloud: ['.......', '..LLL..', '.LLLLL.', 'LLLLLLL', '.LLLLL.', '.......', '.......'],
    rain: ['..LLL..', '.LLLLL.', 'LLLLLLL', '.......', '.c.c.c.', 'c.c.c..', '.......'],
    snow: ['..LLL..', '.LLLLL.', 'LLLLLLL', '.......', '.n.n.n.', 'n.n.n..', '.......'],
    storm: ['..LLL..', '.LLLLL.', 'LLLLLLL', '...ii..', '..ii...', '...i...', '..i....'],
  };

  const CHARACTERS = { ...ducks, claude, ...critters };
  const ORDER = ['ente-klassik', 'claude', ...Object.keys(critters)];

  function character(id) {
    const c = CHARACTERS[id] || CHARACTERS['ente-klassik'];
    return {
      id: CHARACTERS[id] ? id : 'ente-klassik',
      ...c,
      palette: { ...SHARED, ...c.palette },
      ownColors: Object.keys(c.palette), // Farben der Figur selbst (für Farbvarianten)
      props: {
        IDEA, LENS, STAR, MUSHROOM, SANTA, PARTY, UMBRELLA, EARS, PUMPKIN, NIGHTCAP, BELL, BAMBOO, EGG, APPLE, COOKIE, FISH, CARROT, MEDAL, STONE, GIFT, GIFTGOLD, WING_L, WING_R, SNOWMAN, SNOWCAP, ...ACCESSORIES,
        GLASSES: c.glasses || (c.front ? GLASSES_FRONT : GLASSES_SIDE),
      },
    };
  }

  const api = { CHARACTERS, ORDER, character, KEYBOARD, WING, HEART, WEATHER_ICONS };
  if (typeof module !== 'undefined') module.exports = api;
  else root.DuckSprites = api;
})(this);
