/* Path Coder — Session 1 · Program a friend (then a robot)
   Only the four commands from the notes: FORWARD, TURN LEFT, TURN RIGHT, STOP.
   The robot follows the program exactly, nothing more. Bumps are bugs; par = fewest commands (BFS). */
(function () {
  'use strict';
  const { h } = AC;
  AC.boot({ game: 'path', week: 1, topic: 'Program a friend', title: 'Path Coder', help: () => help() });
  const S = AC.scene({ fov: 45, near: 0.1, far: 300, background: 0x14202e, shadows: true });
  const { scene, camera, renderer } = S;
  AC.lights(scene, { sky: 0xdfe8f5, ground: 0x30343a, hemi: 0.85, sun: 0.9, dir: [-6, 16, 8], shadows: true, shadowSize: 14 });
  AC.labFloor(scene, 80, 2, '#1d2631');
  const oc = new AC.OrbitCam(camera, renderer.domElement, { dist: 12, min: 5, max: 30, phi: 0.75, theta: 0.0, target: new THREE.Vector3(0, 0, 0) });
  const bot = AC.makeBot(S);
  bot.root.scale.setScalar(0.85);
  const CS = 1.6;

  // ---------------------------------------------------------------- commands (from the notes)
  const CMD = {
    F: { i: '↑', t: 'FORWARD', d: 'one step ahead' },
    L: { i: '↶', t: 'TURN LEFT', d: 'a quarter turn' },
    R: { i: '↷', t: 'TURN RIGHT', d: 'a quarter turn' },
    X: { i: '■', t: 'STOP', d: 'the end' },
  };
  const CYCLE = { F: 'L', L: 'R', R: 'X', X: 'F' };
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W (row grows south)
  const yawOf = (d) => Math.PI - (d * Math.PI) / 2;

  // ---------------------------------------------------------------- levels: # chair · S start · C charger
  const LEVELS = {
    l1: { map: ['...C', '.#..', 'S..#'], dir: 0 },
    l2: { map: ['#..C.', '..#..', '.#..#', 'S....'], dir: 0 },
    l3: { map: ['S....', '####.', 'C....'], dir: 1, pre: 'FFFFLFFRFFFRF' },
    l4: { map: ['S.#..', '..#.#', '#....', '.##..', '....C'], dir: 2, battery: true },
    l5: { map: ['S..#...', '##.#.#.', '...#.#.', '.###.#.', '.....#.', '####.#.', 'C......'], dir: 1 },
  };
  function parse(lv) {
    const g = { W: lv.map[0].length, H: lv.map.length, cells: lv.map.map((r) => r.split('')), dir: lv.dir };
    g.cells.forEach((r, y) => r.forEach((c, x) => { if (c === 'S') g.start = [x, y]; if (c === 'C') g.goal = [x, y]; }));
    g.free = (x, y) => x >= 0 && y >= 0 && x < g.W && y < g.H && g.cells[y][x] !== '#';
    // par: fewest commands (BFS over position + facing), plus the STOP
    const key = (x, y, d) => x + ',' + y + ',' + d;
    const seen = new Map([[key(...g.start, g.dir), 0]]);
    const q = [[...g.start, g.dir]];
    g.par = Infinity;
    while (q.length) {
      const [x, y, d] = q.shift();
      const n = seen.get(key(x, y, d));
      if (x === g.goal[0] && y === g.goal[1]) { g.par = n + 1; break; }
      const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
      for (const s of [g.free(nx, ny) ? [nx, ny, d] : null, [x, y, (d + 3) % 4], [x, y, (d + 1) % 4]]) {
        if (s && !seen.has(key(...s))) { seen.set(key(...s), n + 1); q.push(s); }
      }
    }
    return g;
  }

  // ---------------------------------------------------------------- 3D room
  const roomGroup = new THREE.Group();
  scene.add(roomGroup);
  const M = (c, o) => AC.mat(c, o);
  function chair() {
    const c = new THREE.Group();
    const wood = M(0xc9a36b), dark = M(0x6b4f33);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.9), wood);
    seat.position.y = 0.55;
    c.add(seat);
    for (const [x, z] of [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.08), dark);
      l.position.set(x, 0.275, z);
      c.add(l);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.08), wood);
    back.position.set(0, 0.95, -0.41);
    c.add(back);
    c.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    return c;
  }
  let G = null;
  const wpos = (x, y) => new THREE.Vector3((x - (G.W - 1) / 2) * CS, 0, (y - (G.H - 1) / 2) * CS);
  function buildRoom(g) {
    G = g;
    while (roomGroup.children.length) roomGroup.remove(roomGroup.children[0]);
    const tileM = M(0x3a4a5c, { roughness: 0.9 }), tapeM = M(0xffb547, { emissive: 0x3a2400 });
    g.cells.forEach((r, y) => r.forEach((c, x) => {
      const p = wpos(x, y);
      const t = new THREE.Mesh(new THREE.BoxGeometry(CS - 0.08, 0.04, CS - 0.08), tileM);
      t.position.set(p.x, 0.02, p.z);
      t.receiveShadow = true;
      roomGroup.add(t);
      if (c === '#') { const ch = chair(); ch.position.copy(p); ch.rotation.y = ((x * 7 + y * 3) % 4) * 0.4; roomGroup.add(ch); }
      if (c === 'C') {
        const pad = new THREE.Mesh(new THREE.BoxGeometry(CS - 0.3, 0.06, CS - 0.3), M(0x4be38a, { emissive: 0x1d6a3a }));
        pad.position.set(p.x, 0.05, p.z);
        const tower = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.1, 0.3), M(0x2b3542));
        tower.position.set(p.x + CS * 0.36, 0.55, p.z - CS * 0.36);
        tower.castShadow = true;
        const bolt = AC.textSprite('⚡ CHARGER', { size: 0.5, color: '#4be38a' });
        bolt.position.set(p.x, 1.6, p.z);
        roomGroup.add(pad, tower, bolt);
      }
      if (c === 'S') {
        const s = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.58, 32), tapeM);
        s.rotation.x = -Math.PI / 2;
        s.position.set(p.x, 0.05, p.z);
        roomGroup.add(s);
      }
    }));
    // portrait phones: pull back and lift the maze above the program panel
    const tall = camera.aspect < 1;
    oc.target.set(0, 0, tall ? g.H * CS * 0.42 : 0);
    oc.dist = (Math.max(g.W, g.H) * CS * 1.45 + 3) * (tall ? 1.9 : 1);
    oc.phi = tall ? 0.45 : 0.75;
  }

  // ---------------------------------------------------------------- robot state + animation
  const R = { x: 0, y: 0, d: 0, yaw: 0, bat: 0, cap: 0, busy: null, queue: [] };
  function placeBot() {
    R.x = G.start[0]; R.y = G.start[1]; R.d = G.dir; R.yaw = yawOf(R.d); R.bat = R.cap;
    R.busy = null;
    const p = wpos(R.x, R.y);
    bot.root.position.copy(p);
    bot.root.rotation.y = R.yaw;
    bot.setTilt(0);
    bot.mood('');
    bot.battery(R.cap ? 1 : 1);
  }
  // start one command's animation; returns false if it is a bug (bump / flat battery)
  function exec(op, onDone) {
    const from = bot.root.position.clone();
    if (op !== 'X' && R.cap) {
      if (R.bat <= 0) { onDone('flat'); return; }
      R.bat--;
      bot.battery(R.bat / R.cap);
    }
    if (op === 'F') {
      const nx = R.x + DIRS[R.d][0], ny = R.y + DIRS[R.d][1];
      const ok = G.free(nx, ny);
      const to = wpos(nx, ny);
      R.busy = { t: 0, dur: ok ? 0.45 : 0.5, kind: ok ? 'move' : 'bump', from, to, done: () => { if (ok) { R.x = nx; R.y = ny; } onDone(ok ? null : 'bump'); } };
      AC.audio.click();
    } else if (op === 'L' || op === 'R') {
      R.d = (R.d + (op === 'L' ? 3 : 1)) % 4;
      const y0 = R.yaw, y1 = R.yaw + (op === 'L' ? 1 : -1) * Math.PI / 2;
      R.yaw = y1;
      R.busy = { t: 0, dur: 0.32, kind: 'turn', y0, y1, done: () => onDone(null) };
      AC.audio.click();
    } else {
      R.busy = { t: 0, dur: 0.2, kind: 'stop', done: () => onDone(null) };
    }
  }
  function animate(dt) {
    const b = R.busy;
    if (!b) return;
    b.t += dt;
    const k = Math.min(1, b.t / b.dur), e = k * k * (3 - 2 * k);
    if (b.kind === 'move') {
      bot.root.position.lerpVectors(b.from, b.to, e);
      bot.setTilt(Math.sin(k * Math.PI) * 0.14);
      bot.roll((CS / b.dur) * dt * (Math.sin(k * Math.PI) * 1.5));
    } else if (b.kind === 'bump') {
      const out = Math.sin(Math.min(1, k * 1.6) * Math.PI) * 0.42;
      bot.root.position.lerpVectors(b.from, b.to, out / CS);
      bot.setTilt(-Math.sin(k * Math.PI) * 0.3);
    } else if (b.kind === 'turn') {
      bot.root.rotation.y = b.y0 + (b.y1 - b.y0) * e;
      bot.roll(0, (b.y1 - b.y0) * dt / b.dur);
    }
    if (k >= 1) { R.busy = null; b.done(); }
  }

  // ---------------------------------------------------------------- program editor
  const panel = h('div', { class: 'code-panel ac-panel' });
  AC.root().appendChild(panel);
  const E = { prog: [], mode: 'plan', runs: 0, pc: -1, bad: -1, running: false, ended: false };
  function draw() {
    panel.innerHTML = '';
    const remote = E.mode === 'remote';
    panel.appendChild(h('div', { class: 'lbl' }, h('span', {}, remote ? 'Remote: every button press becomes code' : 'Program · write the whole path, then run · tap a command to change it'), h('span', {}, E.prog.length + ' commands · par ' + G.par)));
    const prog = h('div', { class: 'prog', id: 'prog', 'data-empty': remote ? 'Press a button to drive…' : 'Add commands below…' });
    E.prog.forEach((op, i) => {
      prog.appendChild(h('button', { type: 'button', class: 'chip' + (i === E.pc ? ' run' : '') + (i === E.bad ? ' bad' : ''), title: CMD[op].t, onclick: () => {
        if (remote || E.running) return;
        E.prog[i] = CYCLE[op];
        AC.audio.click();
        edited();
      } }, h('span', { class: 'i' }, CMD[op].i), h('small', {}, String(i + 1))));
    });
    panel.appendChild(prog);
    const row = h('div', { class: 'btnrow' });
    for (const op of ['F', 'L', 'R', 'X']) row.appendChild(h('button', { type: 'button', class: 'ac-btn ghost small', 'data-cmd': op, disabled: E.running, onclick: () => press(op) }, CMD[op].i + ' ' + CMD[op].t));
    row.appendChild(h('span', { class: 'grow' }));
    if (!remote) {
      row.appendChild(h('button', { type: 'button', class: 'ac-btn ghost small', disabled: E.running, title: 'Delete last (Backspace)', onclick: undo }, '⌫'));
      row.appendChild(h('button', { type: 'button', class: 'ac-btn ghost small', disabled: E.running, onclick: () => { E.prog = []; edited(); } }, 'Clear'));
      row.appendChild(h('button', { type: 'button', class: 'ac-btn', id: 'runBtn', disabled: E.running, onclick: run }, E.running ? 'Running…' : '▶ Run'));
    }
    panel.appendChild(row);
  }
  function edited() { E.bad = -1; E.pc = -1; if (!R.busy) placeBot(); draw(); }
  function undo() { if (E.running || E.mode === 'remote') return; E.prog.pop(); edited(); }
  function press(op) {
    if (AC.paused || E.running || MR.done || !MR.current) return;
    if (E.mode !== 'remote') { if (E.prog.length < 40) { E.prog.push(op); AC.audio.click(); edited(); } return; }
    if (R.busy || E.ended) return;
    E.prog.push(op);
    E.pc = E.prog.length - 1;
    draw();
    exec(op, (bug) => {
      if (bug === 'bump') { AC.audio.bad(); AC.ui.toast('Bump! In a real program that is a bug.', 'var(--amber)'); }
      if (op === 'X') finish();
    });
  }
  function run() {
    if (E.running || E.mode === 'remote' || !E.prog.length || AC.paused) return;
    placeBot();
    E.running = true;
    E.runs++;
    E.pc = 0;
    E.bad = -1;
    draw();
    step();
  }
  function step() {
    if (!E.running) return;
    if (E.pc >= E.prog.length) return bug(E.prog.length - 1, onGoal() ? 'The robot reached the charger, but the program has no STOP. Every program needs an end: add ■ STOP.' : 'The program ran out of commands before the robot reached the charger, and there was no STOP.');
    const op = E.prog[E.pc];
    draw();
    exec(op, (b) => {
      if (b === 'bump') return bug(E.pc, 'Command ' + (E.pc + 1) + ' (' + CMD[op].t + ') walked the robot into a chair or a wall. Find the wrong step, fix it, try again!');
      if (b === 'flat') return bug(E.pc, 'The battery went flat at command ' + (E.pc + 1) + '. Plan a shorter route: fewer turns, fewer steps.');
      if (op === 'X') { E.running = false; return finish(); }
      E.pc++;
      step();
    });
  }
  const onGoal = () => R.x === G.goal[0] && R.y === G.goal[1];
  function bug(i, msg) {
    E.running = false;
    E.bad = i;
    E.pc = -1;
    bot.mood('bad');
    AC.audio.bad();
    draw();
    AC.ui.card({ eyebrow: 'Bug · run ' + E.runs, title: 'That\'s a bug!', body: [msg] });
  }
  function finish() {
    E.ended = true;
    if (!onGoal()) {
      if (E.mode === 'remote') { E.ended = false; AC.ui.toast('STOP ends the program. Drive onto the charger first!', 'var(--amber)'); return; }
      return bug(E.prog.length - 1, 'The robot stopped, but not on the charger. The program does exactly what you wrote, even if it is wrong.');
    }
    bot.mood('ok');
    bot.say('Charging! ⚡', 3);
    E.pc = -1;
    draw();
    MR.current.done(MR.api);
  }

  // ---------------------------------------------------------------- missions
  const learnCmds = { t: 'Four commands', p: 'FORWARD one step · TURN LEFT / RIGHT a quarter turn on the spot · STOP ends the program.', f: '↑  ↶  ↷  ■' };
  const byCount = (api, n) => api.win(n <= G.par ? 3 : n <= G.par + 2 ? 2 : 1, n + ' commands. Par is ' + G.par + '.' + (n <= G.par ? ' Perfect path!' : ''));
  const byRuns = (api) => api.win(E.runs <= 1 ? 3 : E.runs <= 3 ? 2 : 1, 'Reached the charger on run ' + E.runs + ' with ' + E.prog.length + ' commands.');
  const missions = [
    {
      id: 'remote', level: 'l1', mode: 'remote', title: 'Drive with the Remote', objective: 'Drive to the charger, then press STOP',
      story: 'Mission 1 from the notes: drive the robot with the remote. Watch the code strip: every button you press becomes a line of code!',
      learn: [learnCmds, { t: 'Instruction', p: 'One step, like "move forward". A list of them, in order, is an algorithm.', f: 'Instruction → Algorithm → Program' }],
      controls: ['<kbd>↑</kbd> forward', '<kbd>←</kbd><kbd>→</kbd> turn', '<kbd>Space</kbd> stop'],
      proved: 'Your button presses were saved as a program. Read it back: it is an algorithm, a list of clear steps in order that gets the robot to the charger.',
      tip: 'Turning does not move the robot, it only changes which way it faces. Count the squares.',
      quiz: AC.QUESTIONS.find((q) => q.id === 'p-instr'),
      done: (api) => byCount(api, E.prog.length),
    },
    {
      id: 'plan', level: 'l2', mode: 'plan', title: 'Plan, then Run', objective: 'Write the whole path first, then press Run',
      story: 'Mission 2: this time the robot does not move while you write. Plan the whole path, the way the programmer writes the arrows on paper before the friend walks.',
      learn: [learnCmds, { t: 'Be clear, be exact', p: 'Computers never guess what you meant. They follow the steps, even wrong ones.', f: 'Plan → write → run → fix' }],
      controls: ['<kbd>↑</kbd><kbd>←</kbd><kbd>→</kbd><kbd>Space</kbd> add a command', '<kbd>Backspace</kbd> delete', '<kbd>Enter</kbd> run'],
      proved: 'You wrote the whole algorithm before the robot moved, and it followed it exactly. That is programming: plan first, then the computer runs every step in order.',
      tip: 'Trace the path with your finger first. Say each command out loud as you add it, then end with STOP.',
      quiz: AC.QUESTIONS.find((q) => q.id === 'p-exact'),
      done: byRuns,
    },
    {
      id: 'bugs', level: 'l3', mode: 'plan', title: 'Hunt Down 3 Bugs', objective: 'This program has 3 bugs. Find and fix them all',
      story: 'Mission 4: a teammate wrote this program, but the robot keeps bumping into chairs. Run it, see where it goes wrong, tap the wrong command to change it, and run again.',
      learn: [{ t: 'Bug', p: 'A mistake in a program. Bumped into a chair? Find the wrong step, fix it, try again!', f: 'Run → spot → fix → run' }, learnCmds],
      controls: ['Tap a command to change it', '<kbd>Enter</kbd> run'],
      proved: 'Debugging is normal: run, spot the step that went wrong, fix only that step, and run again. Three bugs: a left that should be right, a turn that should be forward, and a missing STOP at the end.',
      tip: 'The red command is where it went wrong. Tap it to cycle ↑ ↶ ↷ ■ until it is the right one.',
      quiz: AC.QUESTIONS.find((q) => q.id === 'p-bug'),
      done: (api) => api.win(E.runs <= 4 ? 3 : E.runs <= 6 ? 2 : 1, 'All 3 bugs fixed in ' + E.runs + (E.runs === 1 ? ' run.' : ' runs.')),
    },
    {
      id: 'battery', level: 'l4', mode: 'plan', battery: true, title: 'Plan a Battery Run', objective: 'Reach the charger before the battery goes flat',
      story: 'Mission 5: the battery is nearly empty. Every FORWARD and every TURN uses one charge. Plan the shortest route, or the robot stops halfway.',
      learn: [{ t: 'Fewest commands', p: 'Turns cost energy too. Fewer turns can beat a shorter-looking path.', f: 'battery = 1 per move or turn' }, learnCmds],
      controls: ['<kbd>↑</kbd><kbd>←</kbd><kbd>→</kbd><kbd>Space</kbd> add', '<kbd>Enter</kbd> run'],
      proved: 'A good algorithm is not just correct, it is efficient. You found a route that fits in the battery: every extra command costs energy and time.',
      tip: 'Count the charges: each ↑ ↶ ↷ uses one. Look for a route with fewer turns.',
      done: (api) => byCount(api, E.prog.length),
    },
    {
      id: 'boss', level: 'l5', mode: 'plan', title: 'Boss Maze: Beat the Par', objective: 'Reach the charger in as few commands as you can',
      story: 'The boss maze! Get the robot to the charger. Matching par (the fewest possible commands) earns 3 stars for the class leaderboard.',
      learn: [{ t: 'Par', p: 'The fewest commands that can solve the maze, STOP included.', f: 'commands ≤ par → ★★★' }, learnCmds],
      controls: ['<kbd>↑</kbd><kbd>←</kbd><kbd>→</kbd><kbd>Space</kbd> add', '<kbd>Enter</kbd> run'],
      proved: 'Two algorithms can both solve a problem, but one can be shorter. Engineers look for the simplest steps that still work.',
      tip: 'Several routes work. Try one, then look for a shortcut with fewer turns.',
      done: (api) => { AC.setBest('path:boss', -E.prog.length); byCount(api, E.prog.length); },
    },
  ];
  missions.forEach((m) => {
    m.start = function () {
      const lv = LEVELS[m.level];
      buildRoom(parse(lv));
      R.cap = m.battery ? G.par : 0; // par includes STOP, which costs no charge: one spare charge
      E.mode = m.mode;
      E.prog = lv.pre ? lv.pre.split('') : [];
      E.runs = 0; E.pc = -1; E.bad = -1; E.running = false; E.ended = false;
      placeBot();
      draw();
    };
    m.update = function (dt, api) {
      api.progress(E.mode === 'remote' ? (onGoal() ? 0.9 : 0) : E.running ? E.pc / Math.max(1, E.prog.length) : 0, E.runs ? 'Runs: ' + E.runs : 'Objective');
    };
  });
  const MR = AC.missions({ game: 'path', week: 1, list: missions });

  // ---------------------------------------------------------------- controls + HUD
  const hud = AC.ui.hud();
  hud.section('Program').row('n', 'Commands', '--').row('par', 'Par', '--').row('runs', 'Runs', '--');
  hud.section('Robot').row('face', 'Facing', '--').row('bat', 'Battery', '--').meter('batm');
  hud.formula('f', 'Algorithm = clear steps, right order');
  AC.onKey('ArrowUp', () => press('F'));
  AC.onKey('KeyW', () => press('F'));
  AC.onKey('ArrowLeft', () => press('L'));
  AC.onKey('KeyA', () => press('L'));
  AC.onKey('ArrowRight', () => press('R'));
  AC.onKey('KeyD', () => press('R'));
  AC.onKey('Space', () => press('X'));
  AC.onKey('Enter', () => { if (!AC.paused) run(); });
  AC.onKey('Backspace', () => { if (!AC.paused) undo(); });
  AC.ui.tools([{ label: 'Reset view', onclick: () => Object.assign(oc, { theta: 0, phi: 0.75 }) }, { label: 'Top view', onclick: () => Object.assign(oc, { theta: 0, phi: 0.12 }) }]);
  AC.ui.hint('Drag to look around · scroll to zoom');
  function help() {
    AC.ui.card({ eyebrow: AC.UNIT + ' 1', title: 'Path Coder', body: ['Program a Friend, robot edition. Only four commands: FORWARD, TURN LEFT, TURN RIGHT, STOP.', 'Write the whole path before the robot moves. Bumped into a chair? That is a bug: find the wrong step, fix it, try again!'] });
  }
  const FACE = ['north ↑', 'east →', 'south ↓', 'west ←'];
  S.onFrame((dt) => {
    animate(dt);
    if (G) {
      hud.set('n', String(E.prog.length), E.prog.length <= G.par ? 'cyan' : '');
      hud.set('par', String(G.par));
      hud.set('runs', E.mode === 'remote' ? 'live' : String(E.runs));
      hud.set('face', FACE[R.d]);
      hud.set('bat', R.cap ? R.bat + ' / ' + R.cap + ' charges' : 'full', R.cap && R.bat <= 2 ? 'warn' : '');
      hud.setMeter('batm', R.cap ? R.bat / R.cap : 1, R.cap && R.bat <= 2 ? 'var(--red)' : 'var(--green)');
    }
    bot.update(dt, camera);
    MR.update(dt);
    oc.update(dt);
  });
  S.start();
  MR.begin();
})();
