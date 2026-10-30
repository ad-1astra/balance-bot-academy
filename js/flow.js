/* Flowchart Factory — Session 2 · Flowcharts
   The notes' flowchart "When should our robot charge?" is laid out as a 3D track and the robot runs it.
   It only works when the shapes mean the right thing (oval / rectangle / diamond) and the arrows say what comes next. */
(function () {
  'use strict';
  const { h } = AC;
  AC.boot({ game: 'flow', week: 2, topic: 'Flowcharts', title: 'Flowchart Factory', help: () => help() });
  const S = AC.scene({ fov: 45, near: 0.1, far: 300, background: 0x14202e, shadows: true });
  const { scene, camera, renderer } = S;
  AC.lights(scene, { sky: 0xdfe8f5, ground: 0x30343a, hemi: 0.9, sun: 0.8, dir: [-6, 18, 10], shadows: true, shadowSize: 14 });
  AC.labFloor(scene, 80, 2, '#1d2631');
  const oc = new AC.OrbitCam(camera, renderer.domElement, { dist: 18, min: 6, max: 34, phi: 0.45, theta: 0.0, target: new THREE.Vector3(2.6, 0, -2.4) });
  if (camera.aspect < 1) Object.assign(oc, { dist: 34, phi: 0.3, target: new THREE.Vector3(3.6, 0, 1.5) });
  const bot = AC.makeBot(S);
  bot.root.scale.setScalar(0.6);

  // ---------------------------------------------------------------- the flowchart from the notes
  const NODES = {
    start: { label: 'Start', shape: 'oval', at: [0, -6.2] },
    check: { label: 'Check the battery', shape: 'rect', at: [0, -3.6] },
    low: { label: 'Battery low?', shape: 'diamond', at: [0, -0.6] },
    charge: { label: 'Drive to the charger', shape: 'rect', at: [4.6, -0.6] },
    end: { label: 'End', shape: 'oval', at: [4.6, 3.2] },
    keep: { label: 'Keep balancing', shape: 'rect', at: [0, 3.2] },
  };
  const ORDER = ['start', 'check', 'low', 'charge', 'keep', 'end'];
  const SHAPES = { oval: 'Oval', rect: 'Rectangle', diamond: 'Diamond' };
  const SHAPE_MEANS = { oval: 'Start / End', rect: 'Do a step', diamond: 'Yes or no?' };
  const COLORS = { oval: 0x4be38a, rect: 0x3fd0f0, diamond: 0xffb547, none: 0x5a6878 };
  const CHARGER = [8.2, -0.6];
  const CORRECT = { start: 'check', check: 'low', 'low.yes': 'charge', 'low.no': 'keep', charge: 'end', keep: 'end' };

  // ---------------------------------------------------------------- 3D pads, labels, arrows
  function shapeGeo(kind) {
    const s = new THREE.Shape();
    if (kind === 'oval') s.absellipse(0, 0, 1.55, 0.72, 0, Math.PI * 2, false, 0);
    else if (kind === 'diamond') { s.moveTo(0, 1.05); s.lineTo(1.5, 0); s.lineTo(0, -1.05); s.lineTo(-1.5, 0); s.closePath(); }
    else if (kind === 'rect') { s.moveTo(-1.6, -0.7); s.lineTo(1.6, -0.7); s.lineTo(1.6, 0.7); s.lineTo(-1.6, 0.7); s.closePath(); }
    else { const r = 0.25, w = 1.0, hh = 0.7; s.moveTo(-w + r, -hh); s.lineTo(w - r, -hh); s.quadraticCurveTo(w, -hh, w, -hh + r); s.lineTo(w, hh - r); s.quadraticCurveTo(w, hh, w - r, hh); s.lineTo(-w + r, hh); s.quadraticCurveTo(-w, hh, -w, hh - r); s.lineTo(-w, -hh + r); s.quadraticCurveTo(-w, -hh, -w + r, -hh); }
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: false, curveSegments: 32 });
    g.rotateX(-Math.PI / 2);
    return g;
  }
  const GEO = { oval: shapeGeo('oval'), rect: shapeGeo('rect'), diamond: shapeGeo('diamond'), none: shapeGeo('none') };
  const pads = {};
  for (const id of ORDER) {
    const n = NODES[id];
    const mesh = new THREE.Mesh(GEO.none, AC.mat(COLORS.none, { roughness: 0.6 }));
    mesh.position.set(n.at[0], 0.02, n.at[1]);
    mesh.receiveShadow = true;
    scene.add(mesh);
    const lbl = AC.textSprite(n.label, { size: 0.42, color: '#ffffff' });
    lbl.position.set(n.at[0], 0.9, n.at[1] - 0.2);
    scene.add(lbl);
    pads[id] = mesh;
  }
  // charger station
  const chg = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 1.4), AC.mat(0x4be38a, { emissive: 0x1d6a3a }));
  chg.position.set(CHARGER[0], 0.03, CHARGER[1]);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.1, 0.3), AC.mat(0x2b3542));
  tower.position.set(CHARGER[0] + 0.6, 0.55, CHARGER[1] - 0.6);
  tower.castShadow = true;
  const chgLbl = AC.textSprite('⚡ CHARGER', { size: 0.42, color: '#4be38a' });
  chgLbl.position.set(CHARGER[0], 1.5, CHARGER[1]);
  scene.add(chg, tower, chgLbl);

  const arrowGroup = new THREE.Group();
  scene.add(arrowGroup);
  const arrowM = AC.mat(0xe9f0f7, { emissive: 0x333a44 }), yesM = AC.mat(0x4be38a, { emissive: 0x1d5a30 }), noM = AC.mat(0xff70d8, { emissive: 0x5a1d4a });
  function edgePoint(id, toward) {
    // point on the pad's rim, roughly, in the direction of another pad
    const a = NODES[id].at, d = new THREE.Vector2(toward[0] - a[0], toward[1] - a[1]).normalize();
    const rx = 1.55, rz = 0.95;
    const k = 1 / Math.sqrt((d.x * d.x) / (rx * rx) + (d.y * d.y) / (rz * rz));
    return new THREE.Vector3(a[0] + d.x * k, 0.2, a[1] + d.y * k);
  }
  function drawArrows(links) {
    while (arrowGroup.children.length) arrowGroup.remove(arrowGroup.children[0]);
    for (const [k, to] of Object.entries(links)) {
      if (!to) continue;
      const from = k.split('.')[0], branch = k.split('.')[1];
      if (from === to) continue;
      let p0 = edgePoint(from, NODES[to].at), p1 = edgePoint(to, NODES[from].at);
      // arrows that go back up the chart run along the left side
      const back = NODES[to].at[1] < NODES[from].at[1] - 0.1 && from !== 'low';
      const pts = back ? [p0, new THREE.Vector3(-2.6, 0.2, p0.z), new THREE.Vector3(-2.6, 0.2, NODES[to].at[1]), edgePoint(to, [-5, NODES[to].at[1]])] : [p0, p1];
      if (back) pts[0] = edgePoint(from, [-5, NODES[from].at[1]]);
      const m = branch === 'yes' ? yesM : branch === 'no' ? noM : arrowM;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], len = a.distanceTo(b);
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, len), m);
        seg.position.copy(a).add(b).multiplyScalar(0.5);
        seg.lookAt(b);
        arrowGroup.add(seg);
      }
      const a = pts[pts.length - 2], b = pts[pts.length - 1];
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 12), m);
      head.position.copy(b);
      head.lookAt(b.clone().add(b.clone().sub(a)));
      head.rotateX(Math.PI / 2);
      arrowGroup.add(head);
      if (branch) {
        const t = AC.textSprite(branch === 'yes' ? 'Yes' : 'No', { size: 0.4, color: branch === 'yes' ? '#4be38a' : '#ff70d8' });
        t.position.copy(pts[0]).lerp(pts[1], 0.45);
        t.position.y = 0.6;
        arrowGroup.add(t);
      }
    }
  }

  // ---------------------------------------------------------------- state
  const F = { shapes: {}, links: {}, threshold: 20, runs: 0, running: false, edit: 'shape' };
  function paintPads() {
    for (const id of ORDER) {
      const s = F.shapes[id] || 'none';
      pads[id].geometry = GEO[s];
      pads[id].material.color.setHex(COLORS[s]);
    }
    drawArrows(F.links);
  }

  // ---------------------------------------------------------------- panel
  const panel = h('div', { class: 'code-panel side ac-panel' });
  AC.root().appendChild(panel);
  const nodeOpts = (self) => [h('option', { value: '' }, '— no arrow —')].concat(ORDER.filter((i) => i !== self).map((i) => h('option', { value: i }, NODES[i].label)));
  function select(key, self) {
    const s = h('select', { 'data-link': key, disabled: F.running, 'aria-label': 'Arrow from ' + key });
    nodeOpts(self).forEach((o) => s.appendChild(o));
    s.value = F.links[key] || '';
    s.addEventListener('change', () => { F.links[key] = s.value || null; AC.audio.click(); paintPads(); });
    return s;
  }
  function draw(badId) {
    panel.innerHTML = '';
    const M = MR.current;
    panel.appendChild(h('div', { class: 'lbl' }, h('span', {}, M.panelTitle), h('span', {}, 'Runs: ' + F.runs)));
    const rows = h('div', { class: 'flowrows' });
    for (const id of M.rows) {
      const row = h('div', { class: 'flowrow' + (badId === id ? ' bad' : '') }, h('span', {}, NODES[id] ? NODES[id].label : ''));
      if (F.edit === 'shape') {
        const seg = h('div', { class: 'seg' });
        for (const s of Object.keys(SHAPES)) {
          seg.appendChild(h('button', { type: 'button', class: F.shapes[id] === s ? 'on' : '', 'data-node': id, 'data-shape': s, disabled: F.running, onclick: () => { F.shapes[id] = s; AC.audio.click(); paintPads(); draw(); } }, SHAPES[s], h('small', { class: 'dim' }, ' · ' + SHAPE_MEANS[s])));
        }
        row.appendChild(seg);
      } else if (id === 'low' && F.edit === 'links') {
        row.appendChild(h('div', { class: 'seg' }, h('span', { class: 'mono', style: { color: 'var(--green)' } }, 'Yes →'), select('low.yes', 'low'), h('span', { class: 'mono', style: { color: 'var(--magenta)' } }, 'No →'), select('low.no', 'low')));
      } else if (id === 'threshold') {
        const s = h('select', { 'data-threshold': '1', disabled: F.running, 'aria-label': 'Battery low means below' });
        for (const v of [5, 20, 50]) s.appendChild(h('option', { value: v }, 'below ' + v + '%'));
        s.value = String(F.threshold);
        s.addEventListener('change', () => { F.threshold = +s.value; AC.audio.click(); });
        row.firstChild.textContent = '"Battery low?" means';
        row.appendChild(s);
      } else row.appendChild(h('div', { class: 'seg' }, h('span', { class: 'mono dim' }, 'next →'), select(id, id)));
      rows.appendChild(row);
    }
    panel.appendChild(rows);
    panel.appendChild(h('div', { class: 'btnrow' }, h('span', { class: 'dim', style: { fontSize: '0.8rem' } }, M.panelNote || ''), h('span', { class: 'grow' }),
      h('button', { type: 'button', class: 'ac-btn', id: 'runBtn', disabled: F.running, onclick: run }, F.running ? 'Running…' : '▶ Run the flowchart')));
  }

  // ---------------------------------------------------------------- the robot runs the flowchart
  const anim = { q: [] };
  const wait = (secs, fn) => anim.q.push({ t: 0, dur: secs, fn });
  const moveTo = (x, z, secs = 0.5) => anim.q.push({ t: 0, dur: secs, move: true, x, z });
  function tickAnim(dt) {
    const a = anim.q[0];
    if (!a) return;
    if (a.t === 0 && a.move) { a.from = bot.root.position.clone(); a.yaw = Math.atan2(a.x - a.from.x, a.z - a.from.z); }
    a.t += dt;
    const k = Math.min(1, a.t / a.dur);
    if (a.move) {
      if (a.from.distanceTo(new THREE.Vector3(a.x, 0, a.z)) > 0.05) bot.root.rotation.y = a.yaw;
      bot.root.position.lerpVectors(a.from, new THREE.Vector3(a.x, 0, a.z), k * k * (3 - 2 * k));
      bot.setTilt(Math.sin(k * Math.PI) * 0.12);
      bot.roll(dt * 2.5);
    } else if (a.wobble) bot.setTilt(Math.sin(a.t * 9) * 0.06);
    if (k >= 1) { anim.q.shift(); a.fn && a.fn(); }
  }
  const SIM = { bat: 52, reading: null, steps: 0, test: 0, visited: null };
  function run() {
    if (F.running || AC.paused || MR.done) return;
    F.running = true;
    F.runs++;
    draw();
    AC.audio.ping();
    MR.current.runTests(0);
  }
  function startTest(bat) {
    SIM.bat = bat; SIM.reading = null; SIM.steps = 0; SIM.laps = 0; SIM.visited = new Set();
    bot.battery(bat / 100);
    bot.mood('');
    bot.root.position.set(NODES.start.at[0], 0, NODES.start.at[1] - 1.4);
    visit('start');
  }
  function bug(id, msg) {
    anim.q = [];
    F.running = false;
    bot.mood('bad');
    AC.audio.bad();
    draw(id);
    AC.ui.card({ eyebrow: 'Bug · run ' + F.runs, title: 'The flowchart broke', body: [msg, 'Fix it and run again.'] });
  }
  // walk to a node, check its shape, do it, follow its arrow
  function visit(id) {
    const n = NODES[id], M = MR.current;
    SIM.visited.add(id);
    if (++SIM.steps > 40 && !M.realtime) return bug(id, 'The robot went round and round and never reached End. Check where your arrows point.');
    moveTo(n.at[0], n.at[1] + 0.2, 0.55);
    wait(0.05, () => {
      if (F.shapes[id] !== n.shape) {
        const why = { oval: '"' + n.label + '" is where the algorithm ' + (id === 'start' ? 'begins' : 'ends') + ', so it needs an oval.', rect: '"' + n.label + '" is one step to do, so it needs a rectangle.', diamond: '"' + n.label + '" is a yes-or-no question with two answers, so it needs a diamond.' };
        return bug(id, why[n.shape]);
      }
      const next = (k) => {
        const to = F.links[k];
        if (!to) return bug(id, 'The robot reached "' + n.label + '", but no arrow shows what comes next.');
        visit(to);
      };
      if (id === 'start') { bot.say('Start!', 0.8); wait(0.35, () => next('start')); }
      else if (id === 'check') { SIM.reading = SIM.bat; bot.mood('think'); bot.say('Battery: ' + Math.round(SIM.bat) + '%', 1); wait(0.5, () => { bot.mood(''); next('check'); }); }
      else if (id === 'low') {
        if (SIM.reading == null) return bug(id, 'The robot asked "Battery low?" before it checked the battery. Order matters: check first, then decide.');
        const yes = SIM.reading < F.threshold;
        bot.say(yes ? 'Yes, low!' : 'No, fine', 0.8);
        wait(0.4, () => next(yes ? 'low.yes' : 'low.no'));
      } else if (id === 'keep') {
        SIM.laps++;
        bot.say('Balancing…', 0.9);
        anim.q.push({ t: 0, dur: M.realtime ? 0.8 : 0.5, wobble: true, fn: () => {
          if (M.realtime) {
            SIM.bat -= 8;
            bot.battery(SIM.bat / 100);
            if (SIM.bat <= 0) return dead('Keep balancing');
          }
          next('keep');
        } });
      } else if (id === 'charge') {
        bot.say('To the charger!', 1);
        moveTo(CHARGER[0], CHARGER[1], 0.9);
        wait(0.05, () => {
          if (M.realtime) { SIM.bat -= 10; bot.battery(SIM.bat / 100); if (SIM.bat <= 0) return dead('Drive to the charger'); }
          bot.say('⚡ Charging', 1.2);
          bot.mood('ok');
          anim.q.push({ t: 0, dur: 0.8, fn: () => { SIM.bat = 100; bot.battery(1); next('charge'); } });
        });
      } else if (id === 'end') {
        wait(0.3, () => M.check(SIM));
      }
    });
  }
  function dead(where) {
    bot.setTilt(1.2);
    bug(where === 'Keep balancing' ? 'keep' : 'charge', 'The battery ran flat during "' + where + '" and the robot fell over. ' + (F.links.keep === 'end' ? 'After "Keep balancing" the program ENDED, so the robot never checked the battery again.' : F.links.keep === 'low' ? 'It went back to "Battery low?" without checking the battery again, so it kept using an old reading.' : 'It decided too late: "low" must leave enough charge to reach the charger.'));
  }
  // after End: report the test, run the next one or win
  function testDone(ok, msg, nextTest) {
    if (!ok) return bug(null, msg);
    AC.ui.toast(msg);
    if (nextTest != null) wait(0.6, () => MR.current.runTests(nextTest));
    else {
      F.running = false;
      draw();
      bot.mood('ok');
      MR.api.win(F.runs <= 1 ? 3 : F.runs <= 3 ? 2 : 1, MR.current.winMsg + ' Runs: ' + F.runs + '.');
    }
  }
  const twoTests = {
    runTests(i) {
      if (i === 0) { AC.ui.toast('Test 1: battery 15%', 'var(--cyan)'); startTest(15); }
      else { AC.ui.toast('Test 2: battery 80%', 'var(--cyan)'); startTest(80); }
      SIM.test = i;
    },
    check(sim) {
      if (sim.test === 0) testDone(sim.visited.has('charge') && !sim.visited.has('keep'), sim.visited.has('charge') ? 'Test 1 passed: low battery → charger ✓' : 'Test 1 failed: the battery was 15% (low), but the robot never drove to the charger. Check the Yes arrow.', 1);
      else testDone(sim.visited.has('keep') && !sim.visited.has('charge'), sim.visited.has('keep') && !sim.visited.has('charge') ? 'Test 2 passed: battery fine → keep balancing ✓' : 'Test 2 failed: the battery was 80% (not low), but the robot did not keep balancing. Check the No arrow.');
    },
  };

  // ---------------------------------------------------------------- missions
  const learnShapes = { t: 'Flowchart shapes', p: 'Oval = Start / End. Rectangle = one step to do. Diamond = a yes-or-no question. Arrow = what comes next.', f: '⬭  ▭  ◇  →' };
  const missions = [
    Object.assign({
      id: 'shapes', title: 'Shape Sorter', objective: 'Give every box the right shape, then run both tests',
      story: 'The robot\'s charging flowchart lost its shapes! A flowchart is an algorithm drawn as a picture, and each shape means something. Fix them, then the robot runs it.',
      learn: [learnShapes, { t: 'The question', p: '"Battery low?" has two answers, Yes and No, so it needs two arrows out.', f: '◇ → Yes / No' }],
      controls: ['Pick a shape for each box', 'Then ▶ Run (<kbd>Enter</kbd>)'],
      proved: 'Ovals start and end, rectangles do, diamonds ask. Anyone can now read the robot\'s algorithm just by looking at the shapes.',
      tip: 'Is it where things begin or end? Oval. Is it something to do? Rectangle. Does it ask a question with Yes or No? Diamond.',
      quiz: AC.QUESTIONS.find((q) => q.id === 'f-diamond'),
      panelTitle: 'Choose a shape for every box', rows: ORDER, edit: 'shape', winMsg: 'Every shape is right and both tests passed.',
      setup() { F.shapes = {}; F.links = Object.assign({}, CORRECT); },
    }, twoTests),
    Object.assign({
      id: 'arrows', title: 'Draw the Arrows', objective: 'Connect the boxes so both battery tests pass',
      story: 'The shapes are back, but the arrows are gone. Arrows show what comes next. Wire up the flowchart so a low battery sends the robot to charge, and a good battery lets it keep balancing.',
      learn: [learnShapes, { t: 'Order still matters', p: 'You must check the battery before you can ask if it is low.', f: 'Check → Decide → Do' }],
      controls: ['Choose where each arrow goes', 'Then ▶ Run (<kbd>Enter</kbd>)'],
      proved: 'Follow the arrows with your finger: Start → Check the battery → Battery low? Yes → Drive to the charger → End. No → Keep balancing. The diamond splits the path in two.',
      tip: 'Start with Start. What should the robot do first? Then what? The diamond needs both a Yes arrow and a No arrow.',
      quiz: AC.QUESTIONS.find((q) => q.id === 'f-notlow'),
      panelTitle: 'Where does each arrow go?', rows: ['start', 'check', 'low', 'charge', 'keep'], edit: 'links', winMsg: 'Both tests passed with your arrows.',
      setup() { F.shapes = Object.fromEntries(ORDER.map((i) => [i, NODES[i].shape])); F.links = {}; },
    }, twoTests),
    {
      id: 'loop', title: 'Keep Checking', realtime: true, objective: 'Make the robot keep balancing, then reach the charger before the battery dies',
      story: 'A real robot balances all day. Every lap of "Keep balancing" uses 8% battery and the drive to the charger uses 10%. Where should the arrow go after "Keep balancing"? And when is the battery "low"?',
      learn: [{ t: 'Repeat the check', p: 'An algorithm that only checks once can miss the battery running out later.', f: 'Keep balancing → Check the battery' }, learnShapes],
      controls: ['Choose the arrow and the "low" level', 'Then ▶ Run (<kbd>Enter</kbd>)'],
      proved: 'Going back to "Check the battery" turns the flowchart into a loop: the robot keeps checking, and the diamond decides the moment it must charge. Next week: loops and decisions!',
      tip: 'If the arrow goes to End, the robot stops checking. If "low" is too low, there is not enough charge left for the trip to the charger.',
      quiz: AC.QUESTIONS.find((q) => q.id === 'f-loop'),
      panelTitle: 'Finish the robot\'s day', rows: ['keep', 'threshold'], edit: 'links', panelNote: 'Start: 52% battery', winMsg: 'The robot kept balancing and reached the charger with charge to spare.',
      setup() { F.shapes = Object.fromEntries(ORDER.map((i) => [i, NODES[i].shape])); F.links = Object.assign({}, CORRECT, { keep: 'end' }); F.threshold = 5; },
      runTests() { SIM.test = 0; startTest(52); },
      check(sim) {
        if (!sim.visited.has('charge')) {
          // program ended without charging: the battery still runs down
          bot.say('…', 1);
          anim.q.push({ t: 0, dur: 1.4, wobble: true, fn: () => { SIM.bat = 0; bot.battery(0); dead('Keep balancing'); } });
        } else if (sim.laps < 3) bug('keep', 'The robot went to charge after only ' + sim.laps + (sim.laps === 1 ? ' lap' : ' laps') + ' of balancing, with plenty of battery left. It should keep balancing until the battery really is low.');
        else testDone(true, 'The robot balanced for ' + sim.laps + ' laps, then charged before the battery died ✓');
      },
    },
  ];
  missions.forEach((m) => {
    m.start = function () {
      F.runs = 0; F.running = false; F.threshold = 20; F.edit = m.edit;
      anim.q = [];
      m.setup();
      paintPads();
      bot.root.position.set(NODES.start.at[0], 0, NODES.start.at[1] - 1.4);
      bot.root.rotation.y = 0;
      bot.setTilt(0);
      bot.battery(1);
      bot.mood('');
      draw();
    };
    m.update = function (dt, api) { api.progress(F.running ? 0.5 : 0, F.runs ? 'Runs: ' + F.runs : 'Objective'); };
  });
  const MR = AC.missions({ game: 'flow', week: 2, list: missions });

  // ---------------------------------------------------------------- HUD + loop
  const hud = AC.ui.hud();
  hud.section('Robot').row('bat', 'Battery', '--').meter('batm').row('read', 'Last reading', '--').row('at', 'Now at', '--');
  hud.section('Shapes').row('s1', '⬭ Oval', 'Start / End').row('s2', '▭ Rectangle', 'Do a step').row('s3', '◇ Diamond', 'Yes or no?');
  AC.onKey('Enter', () => { if (!AC.paused) run(); });
  AC.ui.tools([{ label: 'Reset view', onclick: () => Object.assign(oc, { theta: 0, phi: 0.45, dist: 18 }) }]);
  AC.ui.hint('Drag to look around · scroll to zoom');
  function help() {
    AC.ui.card({ eyebrow: AC.UNIT + ' 2', title: 'Flowchart Factory', body: ['A flowchart is an algorithm drawn as a picture. Oval = start or end, rectangle = a step, diamond = a yes/no question, arrows = what comes next.', 'Build the robot\'s "When should I charge?" flowchart and watch the robot follow it.'] });
  }
  S.onFrame((dt) => {
    if (dt > 0) tickAnim(dt);
    hud.set('bat', Math.max(0, Math.round(SIM.bat)) + '%', SIM.bat < 20 ? 'warn' : '');
    hud.setMeter('batm', SIM.bat / 100, SIM.bat < 20 ? 'var(--red)' : SIM.bat < 50 ? 'var(--amber)' : 'var(--green)');
    hud.set('read', SIM.reading == null ? 'none yet' : Math.round(SIM.reading) + '%');
    const near = ORDER.find((i) => bot.root.position.distanceTo(new THREE.Vector3(NODES[i].at[0], 0, NODES[i].at[1] + 0.2)) < 0.3);
    hud.set('at', near ? NODES[near].label : '…');
    bot.update(dt, camera);
    MR.update(dt);
    oc.update(dt);
  });
  S.start();
  MR.begin();
})();
