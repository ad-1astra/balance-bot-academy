/* First Program — Session 2 · Scratch (juniors) and Python (seniors)
   Both run the steps from top to bottom. The robot only does the right thing when the lines are in the right order. */
(function () {
  'use strict';
  const { h } = AC;
  AC.boot({ game: 'code', week: 2, topic: 'Your first program', title: 'First Program', help: () => help() });
  const S = AC.scene({ fov: 45, near: 0.1, far: 300, background: 0x14202e, shadows: true });
  const { scene, camera, renderer } = S;
  AC.lights(scene, { sky: 0xdfe8f5, ground: 0x30343a, hemi: 0.9, sun: 0.85, dir: [-6, 16, 10], shadows: true, shadowSize: 10 });
  AC.labFloor(scene, 80, 1.6, '#1d2631');
  const oc = new AC.OrbitCam(camera, renderer.domElement, { dist: 9, min: 4, max: 24, phi: 0.72, theta: 0.0, target: new THREE.Vector3(0.8, 0, 0.8) });
  const bot = AC.makeBot(S);
  bot.root.scale.setScalar(0.8);
  const T = 1.6; // one floor tile = 50 Scratch steps
  const marks = new THREE.Group();
  scene.add(marks);
  const tl = AC.textSprite('1 tile = 50 steps', { size: 0.32, color: '#93a7bf', bg: 'rgba(0,0,0,0)' });
  tl.position.set(-1.2, 0.05, -0.9);
  scene.add(tl);

  // ---------------------------------------------------------------- blocks and lines
  const BLK = {
    flag: { c: 'ev', t: 'when ⚑ clicked' },
    hello: { c: 'lo', t: 'say Hello! I am a robot. for 2 seconds', say: 'Hello! I am a robot.' },
    did: { c: 'lo', t: 'say I did it! for 2 seconds', say: 'I did it!' },
    move: { c: 'mo', t: 'move 50 steps' },
    turn: { c: 'mo', t: 'turn ↻ 90 degrees' },
    // Python (Mission 3 from the notes, verbatim)
    p1: { c: 'py', t: 'print("Hello! I am a balancing robot.")' },
    p2: { c: 'py', t: 'name = input("What should we call our robot? ")' },
    p3: { c: 'py', t: 'print("Nice to meet you,", name)' },
    p4: { c: 'py', t: 'print("Step 1: sense")' },
    p5: { c: 'py', t: 'print("Step 2: think")' },
    p6: { c: 'py', t: 'print("Step 3: act")' },
    // Python: the balancing algorithm as code
    q1: { c: 'py', t: 'print("Robot online")' },
    q2: { c: 'py', t: 'tilt = read_tilt()' },
    q3: { c: 'py', t: 'direction = which_way(tilt)' },
    q4: { c: 'py', t: 'spin_wheels(direction)' },
    q5: { c: 'py', t: 'print("Balanced!")' },
  };
  const PAL = { mo: '#3a6fd0', lo: '#7350c8', ev: '#b07a00' };

  // ---------------------------------------------------------------- robot pose on the tile grid
  const B = { x: 0, z: 0, d: 1, yaw: Math.PI / 2, q: [], tiltTarget: 0 };
  const DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  function home(lean = 0) {
    B.x = 0; B.z = 0; B.d = 1; B.yaw = Math.PI / 2; B.q = []; B.tiltTarget = lean;
    bot.root.position.set(0, 0, 0);
    bot.root.rotation.y = B.yaw;
    bot.setTilt(lean);
    bot.mood('');
    bot.say('');
  }
  const act = (dur, fn, tick) => B.q.push({ t: 0, dur, fn, tick });
  function tickAct(dt) {
    const a = B.q[0];
    if (!a) return;
    if (a.t === 0 && a.init) a.init();
    a.t += dt;
    const k = Math.min(1, a.t / a.dur);
    a.tick && a.tick(k, dt);
    if (k >= 1) { B.q.shift(); a.fn && a.fn(); }
  }
  function doMove(next) {
    const fx = B.x, fz = B.z;
    B.x += DIR[B.d][0]; B.z += DIR[B.d][1];
    const tx = B.x, tz = B.z;
    act(0.7, next, (k, dt) => {
      const e = k * k * (3 - 2 * k);
      bot.root.position.set((fx + (tx - fx) * e) * T, 0, (fz + (tz - fz) * e) * T);
      bot.setTilt(Math.sin(k * Math.PI) * 0.15);
      bot.roll(dt * 3);
    });
  }
  function doTurn(next) {
    B.d = (B.d + 1) % 4;
    const y0 = B.yaw;
    B.yaw -= Math.PI / 2;
    act(0.45, next, (k, dt) => { bot.root.rotation.y = y0 - (Math.PI / 2) * k * k * (3 - 2 * k); bot.roll(0, -dt * 3); });
  }

  // ---------------------------------------------------------------- floor markers
  function ring(x, z, color) {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 32), AC.mat(color, { emissive: color, emissiveIntensity: 0.4, side: THREE.DoubleSide }));
    r.rotation.x = -Math.PI / 2;
    r.position.set(x * T, 0.03, z * T);
    marks.add(r);
    return r;
  }
  function pathLine(pts) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = new THREE.Vector3(pts[i][0] * T, 0.03, pts[i][1] * T), b = new THREE.Vector3(pts[i + 1][0] * T, 0.03, pts[i + 1][1] * T);
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, a.distanceTo(b)), AC.mat(0xff70d8, { emissive: 0x6a1d5a }));
      seg.position.copy(a).add(b).multiplyScalar(0.5);
      seg.lookAt(b);
      marks.add(seg);
    }
  }
  function clearMarks() { while (marks.children.length) marks.remove(marks.children[0]); }

  // ---------------------------------------------------------------- editor
  const panel = h('div', { class: 'code-panel ac-panel' });
  AC.root().appendChild(panel);
  const E = { list: [], palette: [], canDelete: false, runs: 0, running: false, pc: -1, bad: -1, out: [], py: false, max: 16 };
  const con = h('div', { class: 'console', id: 'console', 'aria-live': 'polite' });
  function draw() {
    panel.innerHTML = '';
    const M = MR.current;
    panel.appendChild(h('div', { class: 'lbl' }, h('span', {}, M.panelTitle), h('span', {}, E.list.length + (E.py ? ' lines' : ' blocks') + ' · runs ' + E.runs)));
    const list = h('div', { class: 'blocks', id: 'blocks' });
    E.list.forEach((id, i) => {
      const b = BLK[id];
      const ctl = h('div', { class: 'ctl' },
        h('button', { type: 'button', title: 'Move up', 'aria-label': 'Move up', 'data-up': i, disabled: E.running || i === 0, onclick: () => swap(i, i - 1) }, '▲'),
        h('button', { type: 'button', title: 'Move down', 'aria-label': 'Move down', 'data-down': i, disabled: E.running || i === E.list.length - 1, onclick: () => swap(i, i + 1) }, '▼'),
        E.canDelete && id !== 'flag' ? h('button', { type: 'button', title: 'Remove', 'aria-label': 'Remove', disabled: E.running, onclick: () => { E.list.splice(i, 1); edited(); } }, '✕') : null);
      list.appendChild(h('div', { class: 'blk ' + b.c + (i === E.pc ? ' run' : '') + (i === E.bad ? ' bad' : '') }, h('span', {}, (E.py ? String(i + 1).padStart(2, ' ') + '  ' : '') + b.t), ctl));
    });
    panel.appendChild(list);
    if (E.palette.length) {
      panel.appendChild(h('div', { class: 'palette' }, h('span', { class: 'mono dim', style: { fontSize: '0.72rem', alignSelf: 'center' } }, 'Add:'),
        E.palette.map((id) => h('button', { type: 'button', 'data-add': id, disabled: E.running || E.list.length >= E.max, style: { background: PAL[BLK[id].c] }, onclick: () => { E.list.push(id); AC.audio.click(); edited(); } }, BLK[id].t))));
    }
    if (E.py) panel.appendChild(con);
    panel.appendChild(h('div', { class: 'btnrow' }, h('span', { class: 'dim', style: { fontSize: '0.8rem' } }, E.py ? 'Python runs the lines in order, top to bottom' : 'Scratch runs the blocks from top to bottom'), h('span', { class: 'grow' }),
      h('button', { type: 'button', class: 'ac-btn', id: 'runBtn', disabled: E.running, style: E.py ? null : { background: 'var(--green)' }, onclick: run }, E.running ? 'Running…' : E.py ? '▶ Run cell' : '⚑ Green flag')));
  }
  function swap(i, j) { if (E.running) return; [E.list[i], E.list[j]] = [E.list[j], E.list[i]]; AC.audio.click(); edited(); }
  function edited() { E.bad = -1; E.pc = -1; draw(); }
  function print(text, cls) { con.appendChild(h('div', { class: cls || '' }, text)); con.scrollTop = con.scrollHeight; }
  function run() {
    if (E.running || AC.paused || MR.done || !MR.current) return;
    E.running = true; E.runs++; E.pc = -1; E.bad = -1; E.out = [];
    con.innerHTML = '';
    MR.current.reset();
    draw();
    AC.audio.ping();
    if (E.py) print('>>> running your cell', 'ok');
    exec(0);
  }
  function stop(ok, msg, badLine) {
    E.running = false;
    E.pc = -1;
    E.bad = badLine == null ? -1 : badLine;
    draw();
    if (ok) { bot.mood('ok'); MR.current.win(MR.api); return; }
    bot.mood('bad');
    AC.audio.bad();
    AC.ui.card({ eyebrow: 'Run ' + E.runs, title: msg[0], body: msg.slice(1).concat(['Change the order and run it again.']) });
  }
  // run line i, then the next one (top to bottom)
  function exec(i) {
    const M = MR.current;
    if (i >= E.list.length) return M.judge();
    E.pc = i;
    draw();
    const id = E.list[i], next = () => exec(i + 1);
    if (!E.py) {
      if (i === 0 && id !== 'flag') return stop(false, ['Nothing happened!', 'A Scratch program starts with the yellow "when ⚑ clicked" block on top. Without it, clicking the green flag does nothing.'], 0);
      E.out.push(id);
      if (id === 'flag') return act(0.2, next);
      if (BLK[id].say) { bot.say(BLK[id].say, 2); return act(2, next); }
      if (id === 'move') { M.onMove && M.onMove(); return doMove(() => { M.onMove && M.onMove(); next(); }); }
      if (id === 'turn') return doTurn(next);
    }
    M.py(id, i, next);
  }
  // Python: a tiny interpreter for exactly these lines, with real Python errors
  const VARS = {};
  function nameError(v, i) {
    print('Traceback (most recent call last):\n  File "<cell>", line ' + (i + 1) + '\nNameError: name \'' + v + '\' is not defined', 'err');
    stop(false, ['NameError: name \'' + v + '\' is not defined', 'Line ' + (i + 1) + ' used the variable "' + v + '" before any line gave it a value. Python runs top to bottom, so the line that makes "' + v + '" must come first.'], i);
  }
  function say(text, i, next) { print(text); E.out.push(text); bot.say(text, 1.2); act(0.7, next); }

  // ---------------------------------------------------------------- missions
  const learnTop = { t: 'Top to bottom', p: 'Scratch and Python both run the steps in order, like a recipe.', f: 'Algorithm → Program' };
  const missions = [
    {
      id: 'flag', title: 'Green Flag', panelTitle: 'Scratch · put the blocks in order (▲ ▼)', objective: 'Order the blocks so the robot says hello, walks the pink path, then says "I did it!"',
      story: 'This is the juniors\' first Scratch program from the notes, but the blocks got shuffled. Put them back so the robot follows the pink path to the star.',
      learn: [{ t: 'Events (yellow)', p: '"when ⚑ clicked" starts the program. It always goes on top.', f: 'start the program' }, { t: 'Motion (blue) · Looks (purple)', p: 'Motion moves and turns. Looks makes the sprite talk.', f: 'move · turn · say' }, learnTop],
      controls: ['▲ ▼ move a block', '⚑ Green flag (<kbd>Enter</kbd>) runs it'],
      proved: 'when ⚑ clicked → say Hello → move 50 → turn 90 → move 50 → say I did it! The same blocks in a different order make a different program: change the order and the robot goes somewhere else.',
      tip: 'Start with the yellow block on top. Hello comes first, "I did it!" comes last, and the robot must move BEFORE it turns.',
      quiz: AC.QUESTIONS.find((q) => q.id === 'c-flag'),
      setup() { E.py = false; E.canDelete = false; E.palette = []; E.list = ['move', 'did', 'turn', 'flag', 'hello', 'move']; pathLine([[0, 0], [1, 0], [1, 1]]); this.star = ring(1, 1, 0xffb547); const s = AC.textSprite('★', { size: 0.7, color: '#ffb547', bg: 'rgba(0,0,0,0)' }); s.position.set(T, 0.8, T); marks.add(s); },
      reset() { home(); },
      judge() {
        const want = 'flag hello move turn move did';
        const got = E.out.join(' ');
        if (got === want) return stop(true);
        const on = B.x === 1 && B.z === 1;
        stop(false, [on ? 'Reached the star, but…' : 'The robot went the wrong way', on ? 'The robot should say "Hello" first and "I did it!" at the very end.' : 'It ended ' + (B.x === 1 && B.z === 1 ? 'on' : 'off') + ' the star. Order changes everything: move, then turn, then move.']);
      },
      win(api) { api.win(E.runs <= 1 ? 3 : E.runs <= 3 ? 2 : 1, 'Program correct on run ' + E.runs + '.'); },
    },
    {
      id: 'square', title: 'Walk a Square', panelTitle: 'Scratch · build the program', objective: 'Make the robot walk a square and come back to the start',
      story: 'The challenge from the notes: make your robot walk a square! Visit all four corners and finish where you started.',
      learn: [{ t: 'A square', p: 'Four equal sides, four quarter turns. Each side here is 50 steps (one tile).', f: 'move 50 · turn 90 (× 4)' }, learnTop],
      controls: ['Tap a block to add it', '▲ ▼ ✕ to edit', '⚑ Green flag (<kbd>Enter</kbd>)'],
      proved: 'A square is the same two blocks four times: move 50, turn 90. Spotted the pattern? Next week, a "repeat" block will do that for you.',
      tip: 'move 50, turn ↻ 90, then do it again. You need 4 moves to get back to the start.',
      setup() { E.py = false; E.canDelete = true; E.palette = ['move', 'turn', 'hello', 'did']; E.list = ['flag']; this.rings = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([x, z]) => ({ x, z, r: ring(x, z, 0xff70d8), hit: false })); },
      reset() { home(); this.rings.forEach((c) => { c.hit = false; c.r.material.color.setHex(0xff70d8); c.r.material.emissive.setHex(0xff70d8); }); },
      onMove() { for (const c of this.rings) if (c.x === B.x && c.z === B.z && !c.hit) { c.hit = true; c.r.material.color.setHex(0x4be38a); c.r.material.emissive.setHex(0x4be38a); AC.audio.ping(); } },
      judge() {
        const all = this.rings.every((c) => c.hit), back = B.x === 0 && B.z === 0;
        if (all && back) return stop(true);
        stop(false, [all ? 'Not back home yet' : 'Missed a corner', 'Corners visited: ' + this.rings.filter((c) => c.hit).length + ' of 4. ' + (back ? '' : 'The robot must finish on the start ring.')]);
      },
      win(api) { const n = E.list.length; api.win(n <= 8 ? 3 : n <= 10 ? 2 : 1, 'Square done with ' + n + ' blocks (best is 8: the flag + 4 moves + 3 turns).'); },
    },
    {
      id: 'python', title: 'Hello, Python', panelTitle: 'Python · put the lines in order', objective: 'Order the 6 lines so the program runs top to bottom with no errors',
      story: 'Seniors\' Mission 3 from the notes: your first Python program. The lines are shuffled. Python runs them from top to bottom, so the order decides what happens.',
      learn: [{ t: 'print( )', p: 'Shows words on the screen.', f: 'print("Hello")' }, { t: 'input( ) and name', p: 'input( ) asks a question and waits. name is a variable: a box that keeps the answer.', f: 'name = input("…")' }, learnTop],
      controls: ['▲ ▼ move a line', '▶ Run cell (<kbd>Shift</kbd>+<kbd>Enter</kbd>)', 'Type the robot\'s name when asked'],
      proved: 'Python runs the lines in order, like a recipe. The variable name must get its value from input( ) before print( ) can use it, and the robot must sense before it thinks, and think before it acts.',
      tip: 'Hello first. Then ask for the name. Only then can you say "Nice to meet you". Sense → think → act.',
      quiz: AC.QUESTIONS.find((q) => q.id === 'c-print'),
      setup() { E.py = true; E.canDelete = false; E.palette = []; E.list = ['p3', 'p4', 'p1', 'p6', 'p2', 'p5']; },
      reset() { home(); for (const k in VARS) delete VARS[k]; },
      py(id, i, next) {
        if (id === 'p1') return say('Hello! I am a balancing robot.', i, next);
        if (id === 'p4') { bot.mood('think'); return say('Step 1: sense', i, next); }
        if (id === 'p5') return say('Step 2: think', i, next);
        if (id === 'p6') { bot.roll(0.5); return say('Step 3: act', i, next); }
        if (id === 'p3') { if (!('name' in VARS)) return nameError('name', i); return say('Nice to meet you, ' + VARS.name, i, next); }
        if (id === 'p2') {
          const inp = h('input', { type: 'text', 'aria-label': 'Robot name', maxlength: '20' });
          const line = h('div', {}, 'What should we call our robot? ', inp);
          con.appendChild(line);
          bot.say('What should we call me?', 30);
          setTimeout(() => inp.focus(), 30);
          inp.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key !== 'Enter' || !inp.value.trim()) return;
            VARS.name = inp.value.trim().slice(0, 20);
            line.textContent = 'What should we call our robot? ' + VARS.name;
            E.out.push('?');
            bot.say('', 0);
            next();
          });
        }
      },
      judge() {
        const want = ['Hello! I am a balancing robot.', '?', 'Nice to meet you, ' + VARS.name, 'Step 1: sense', 'Step 2: think', 'Step 3: act'];
        if (E.out.join('|') === want.join('|')) { print('>>> done, no errors', 'ok'); return stop(true); }
        const steps = E.out.filter((s) => s.startsWith('Step')).join(' → ');
        stop(false, ['It ran, but in the wrong order', steps !== 'Step 1: sense → Step 2: think → Step 3: act' ? 'The robot did: ' + steps + '. A robot must sense, then think, then act.' : 'The robot should say hello first, then ask for its name, then greet you.']);
      },
      win(api) { api.win(E.runs <= 2 ? 3 : E.runs <= 4 ? 2 : 1, 'Your robot is called ' + VARS.name + '. Program correct on run ' + E.runs + '.'); },
    },
    {
      id: 'balance', title: 'Sense, Think, Act', panelTitle: 'Python · the balancing algorithm as code', objective: 'Order the lines so the leaning robot balances itself',
      story: 'The robot is leaning and about to fall! These five lines are its balancing algorithm in Python: feel the tilt, work out which way, spin the wheels. Get the order right before it tips over.',
      learn: [{ t: 'Same algorithm, now code', p: 'Feel the tilt → work out which way to drive → spin the wheels under the lean.', f: 'tilt → direction → spin' }, { t: 'Variables', p: 'tilt and direction are boxes. A line can only use a box after another line has filled it.', f: 'make it, then use it' }],
      controls: ['▲ ▼ move a line', '▶ Run cell (<kbd>Shift</kbd>+<kbd>Enter</kbd>)'],
      proved: 'You turned the Week 2 algorithm into a program: read_tilt() feels, which_way() thinks, spin_wheels() acts. Each line needs the variable made by the line above it, so there is only one order that works.',
      tip: 'Which line makes tilt? That one goes first (after "Robot online"). Which line needs direction? It must come after the line that makes direction.',
      quiz: AC.QUESTIONS.find((q) => q.id === 'c-var'),
      setup() { E.py = true; E.canDelete = false; E.palette = []; E.list = ['q4', 'q5', 'q2', 'q1', 'q3']; },
      reset() { home(0.32); for (const k in VARS) delete VARS[k]; },
      py(id, i, next) {
        if (id === 'q1') return say('Robot online', i, next);
        if (id === 'q5') return say('Balanced!', i, next);
        if (id === 'q2') { VARS.tilt = 18; bot.mood('think'); bot.say('tilt = 18° forward', 1); return act(0.7, next); }
        if (id === 'q3') { if (!('tilt' in VARS)) return nameError('tilt', i); VARS.direction = 'forward'; bot.say('direction = "forward"', 1); return act(0.7, next); }
        if (id === 'q4') {
          if (!('direction' in VARS)) return nameError('direction', i);
          VARS.spun = true;
          bot.mood('ok');
          return act(1, next, (k, dt) => { bot.setTilt(0.32 * (1 - k)); bot.root.position.z += dt * 0.6 * (1 - k); bot.roll(dt * 2 * (1 - k)); });
        }
      },
      judge() {
        const ok = E.out.join('|') === 'Robot online|Balanced!' && VARS.spun && E.list.indexOf('q5') > E.list.indexOf('q4') && E.list[0] === 'q1';
        if (ok) { print('>>> done, no errors', 'ok'); return stop(true); }
        stop(false, ['Not quite', E.list.indexOf('q5') < E.list.indexOf('q4') ? 'The robot printed "Balanced!" before it spun its wheels. That is not true yet! Order matters.' : '"Robot online" should be the very first thing the robot says.']);
      },
      win(api) { api.win(E.runs <= 2 ? 3 : E.runs <= 4 ? 2 : 1, 'Balanced on run ' + E.runs + '.'); },
    },
  ];
  missions.forEach((m) => {
    m.start = function () {
      clearMarks();
      E.runs = 0; E.running = false; E.pc = -1; E.bad = -1;
      con.innerHTML = '';
      B.q = [];
      m.setup();
      m.reset();
      draw();
    };
    m.update = function (dt, api) { api.progress(E.running ? (E.pc + 1) / Math.max(1, E.list.length) : 0, E.runs ? 'Runs: ' + E.runs : 'Objective'); };
  });
  const MR = AC.missions({ game: 'code', week: 2, list: missions });

  // ---------------------------------------------------------------- HUD + loop
  const hud = AC.ui.hud();
  hud.section('Program').row('lang', 'Language', '--').row('line', 'Running', '--').row('runs', 'Runs', '--');
  hud.section('Robot').row('pos', 'Position', '--').row('face', 'Facing', '--');
  hud.formula('f', 'Same idea, different language');
  AC.onKey('Enter', () => { if (!AC.paused && document.activeElement.tagName !== 'INPUT') run(); });
  AC.ui.tools([{ label: 'Reset view', onclick: () => Object.assign(oc, { theta: 0, phi: 0.72, dist: 9 }) }]);
  AC.ui.hint('Drag to look around · scroll to zoom');
  function help() {
    AC.ui.card({ eyebrow: AC.UNIT + ' 2', title: 'First Program', body: ['Turn an algorithm into code a computer can run. Juniors: Scratch blocks. Seniors: Python lines.', 'Same idea, different language: both run the steps from top to bottom.'] });
  }
  const FACE = ['up', 'right', 'down', 'left'];
  S.onFrame((dt) => {
    if (dt > 0) tickAct(dt);
    hud.set('lang', E.py ? 'Python' : 'Scratch');
    hud.set('line', E.running && E.pc >= 0 ? (E.py ? 'line ' : 'block ') + (E.pc + 1) : '--');
    hud.set('runs', String(E.runs));
    hud.set('pos', AC.fmt(B.x * 50) + ', ' + AC.fmt(B.z * 50) + ' steps');
    hud.set('face', FACE[B.d]);
    bot.update(dt, camera);
    MR.update(dt);
    oc.update(dt);
  });
  S.start();
  MR.begin();
})();
