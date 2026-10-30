/* Balance Loop — Session 1 · Algorithms are recipes
   The win condition IS the notes' balancing algorithm: the robot only stays up when
   1 Feel the tilt → 2 Work out which way to drive → 3 Spin the wheels under the lean → 4 Go back to step 1
   runs in that order, fast enough. Physics: inverted pendulum on wheels, tuned in a node sim. */
(function () {
  'use strict';
  const { h, clamp } = AC;
  AC.boot({ game: 'balance', week: 1, topic: 'Algorithms are recipes', title: 'Balance Loop', help: () => help() });
  const S = AC.scene({ fov: 45, near: 0.1, far: 300, background: 0x14202e, shadows: true });
  const { scene, camera, renderer } = S;
  AC.lights(scene, { sky: 0xdfe8f5, ground: 0x30343a, hemi: 0.85, sun: 0.9, dir: [-8, 14, 6], shadows: true, shadowSize: 10 });
  AC.labFloor(scene, 80, 1);
  // camera looks from the robot's left side: robot forward (+z) = screen right
  const oc = new AC.OrbitCam(camera, renderer.domElement, { dist: 6.5, min: 3, max: 16, phi: 1.33, theta: -Math.PI / 2, target: new THREE.Vector3(0, 0.9, 0) });
  const bot = AC.makeBot(S);
  const push = new AC.Arrow(scene, 0xff70d8);
  // distance markers every 2 m so motion is visible
  for (let z = -30; z <= 30; z += 2) {
    const s = AC.textSprite(z + ' m', { size: 0.35, color: '#93a7bf', bg: 'rgba(0,0,0,0)' });
    s.position.set(0.9, 0.05, z);
    scene.add(s);
  }

  // ---------------------------------------------------------------- steps of the algorithm (from the notes)
  const STEP = {
    feel: { t: 'Feel the tilt', d: 'Read the tilt sensor' },
    think: { t: 'Work out which way to drive', d: 'Towards the lean' },
    spin: { t: 'Spin the wheels under the lean', d: 'Drive the motors' },
    loop: { t: 'Go back to step 1', d: 'Repeat, forever' },
    away: { t: 'Drive away from the lean', d: 'Opposite way' },
    hello: { t: 'Say hello', d: 'Speak' },
    charge: { t: 'Drive to the charger', d: 'Go forward' },
  };

  // ---------------------------------------------------------------- physics: th'' = (g sin th − A u cos th)/L − c·w
  const P = { th: 0, w: 0, z: 0, v: 0, u: 0, L: 4, A: 12, c: 0.6, fallen: false, fallT: 0, nextPush: 3, pushAmp: 0.3, pushShow: 0, pushDir: 0 };
  const VM = { on: false, prog: [], pc: 0, hz: 100, acc: 0, tilt: null, dir: null, err: '', errAt: -1, ended: false, runT: 0 };
  function reset(o = {}) {
    Object.assign(P, { th: 0.05, w: 0, z: 0, v: 0, u: 0, L: 4, c: 0.6, fallen: false, fallT: 0, nextPush: 3, pushAmp: 0.3, pushShow: 0 }, o);
    Object.assign(VM, { on: false, pc: 0, acc: 0, tilt: null, dir: null, err: '', errAt: -1, ended: false, runT: 0 });
    bot.mood('');
    bot.say('');
  }
  function physics(dt) {
    if (P.fallen) {
      // tip over onto the floor
      const target = Math.sign(P.th || 1) * 1.25;
      P.th += (target - P.th) * Math.min(1, dt * 6);
      P.fallT += dt;
      return;
    }
    const a = (AC.G * Math.sin(P.th) - P.A * P.u * Math.cos(P.th)) / P.L - P.c * P.w;
    P.w += a * dt;
    P.th += P.w * dt;
    P.v += (P.A * P.u * 0.22 - 1.6 * P.v) * dt;
    P.z = clamp(P.z + P.v * dt, -28, 28);
    if (Math.abs(P.th) > 0.78) { P.fallen = true; bot.mood('bad'); AC.audio.boom(); }
  }
  // one program step = one quarter of a loop at VM.hz loops per second
  function vmStep() {
    if (VM.ended) return;
    const op = VM.prog[VM.pc];
    const at = VM.pc;
    const bug = (msg) => { if (!VM.err) { VM.err = msg; VM.errAt = at; } };
    if (op === 'feel') VM.tilt = { th: P.th, w: P.w };
    else if (op === 'think' || op === 'away') {
      if (!VM.tilt) bug('Step ' + (at + 1) + ' tried to work out a direction, but the tilt had not been felt yet. Nothing to think about!');
      else VM.dir = (op === 'away' ? -1 : 1) * clamp(3 * VM.tilt.th + 1.2 * VM.tilt.w, -1, 1);
      if (op === 'away') bug('Step ' + (at + 1) + ' drives AWAY from the lean, so the wheels pull out from under the robot.');
    } else if (op === 'spin') {
      if (VM.dir == null) { P.u = 0; bug('Step ' + (at + 1) + ' spun the wheels with no direction worked out yet, so they did nothing.'); }
      else P.u = VM.dir;
    } else if (op === 'charge') { P.u = 0.6; bug('Step ' + (at + 1) + ' drives to the charger whatever the lean is. That is the wrong recipe for balancing.'); }
    else if (op === 'loop') {
      // back to step 1: every lap starts fresh, like a new cup of tea
      if (at === 0) bug('"Go back to step 1" is step 1, so the robot loops on the spot and never does anything else.');
      VM.pc = 0; VM.tilt = null; VM.dir = null;
      return;
    }
    VM.pc++;
    if (VM.pc >= VM.prog.length) { VM.ended = true; bug('The program ran once and then stopped. Without "Go back to step 1" the robot only balances for a split second.'); }
  }

  // ---------------------------------------------------------------- HUD
  const hud = AC.ui.hud();
  hud.section('Robot').row('tilt', 'Tilt', '--').row('lean', 'Leaning', '--').row('drive', 'Wheels', '--').meter('up');
  hud.section('Loop').row('hz', 'Loops per second', '--').row('laps', 'Laps run', '--');
  hud.formula('f', 'Feel → Think → Spin → Repeat');
  const deg = (r) => AC.fmt(AC.deg(r), 1) + '°';

  // ---------------------------------------------------------------- bottom panel: the program editor
  const panel = h('div', { class: 'code-panel ac-panel' });
  AC.root().appendChild(panel);
  const ed = { slots: [], palette: [], locked: false, runs: 0, speeds: null };
  function editor({ slots, palette, locked = false, speeds = null, note = '' }) {
    ed.slots = slots.slice();
    ed.palette = palette.slice();
    ed.locked = locked;
    ed.speeds = speeds;
    if (!speeds) VM.hz = 100;
    ed.runs = 0;
    ed.note = note;
    draw();
  }
  function draw() {
    panel.innerHTML = '';
    panel.appendChild(h('div', { class: 'lbl' }, h('span', {}, ed.locked ? 'Robot program (locked)' : 'Your program · tap a step to take it out'), h('span', {}, ed.note)));
    const grid = h('div', { class: 'steps' });
    ed.slots.forEach((op, i) => {
      const b = h('button', { type: 'button', class: 'slot' + (op ? ' full' : '') + (VM.errAt === i && VM.err ? ' bad' : ''), 'data-i': i },
        h('b', {}, 'STEP ' + (i + 1)), op ? STEP[op].t : '…empty…');
      b.addEventListener('click', () => {
        if (ed.locked || VM.on || !op) return;
        AC.audio.click();
        ed.slots[i] = null;
        ed.palette.push(op);
        clearErr();
        draw();
      });
      grid.appendChild(b);
    });
    panel.appendChild(grid);
    ed.slotEls = [...grid.children];
    if (ed.palette.length && !ed.locked) {
      panel.appendChild(h('div', { class: 'cards' }, ed.palette.map((op, j) => h('button', {
        type: 'button', 'data-op': op, disabled: VM.on || ed.slots.indexOf(null) < 0,
        onclick: () => {
          const k = ed.slots.indexOf(null);
          if (k < 0 || VM.on) return;
          AC.audio.click();
          ed.slots[k] = op;
          ed.palette.splice(j, 1);
          clearErr();
          draw();
        },
      }, '+ ' + STEP[op].t))));
    }
    const row = h('div', { class: 'btnrow' });
    if (ed.speeds) {
      row.appendChild(h('span', { class: 'mono dim', style: { fontSize: '0.75rem' } }, 'Loops / second:'));
      for (const hz of ed.speeds) {
        row.appendChild(h('button', { type: 'button', class: 'chip' + (VM.hz === hz ? ' run' : ''), 'data-hz': hz, onclick: () => { if (VM.on) return; VM.hz = hz; AC.audio.click(); draw(); } }, String(hz)));
      }
    }
    row.appendChild(h('span', { class: 'grow' }));
    row.appendChild(h('button', { type: 'button', class: 'ac-btn', id: 'runBtn', disabled: VM.on, onclick: run }, VM.on ? 'Running…' : '▶ Run program'));
    panel.appendChild(row);
  }
  function clearErr() { VM.err = ''; VM.errAt = -1; }
  function run() {
    if (VM.on || !MR.current || MR.current.mode !== 'program') return;
    if (ed.slots.some((s) => !s)) { AC.ui.toast('Fill every step first', 'var(--amber)'); AC.audio.bad(); return; }
    const hz = VM.hz;
    reset(MR.current.phys || {});
    VM.hz = hz;
    VM.prog = ed.slots.slice();
    VM.on = true;
    VM.laps = 0;
    ed.runs++;
    AC.audio.ping();
    bot.mood('think');
    draw();
  }
  function stopRun(ok) {
    VM.on = false;
    draw();
    if (!ok) {
      bot.say('Whoa!', 1.5);
      const why = VM.err || (VM.hz < 20 ? 'The steps were right, but ' + VM.hz + ' loops a second is too slow. By the time the robot spins its wheels, it is already falling.' : 'The robot fell. Check the order of the steps.');
      AC.ui.card({ eyebrow: 'Bug found · run ' + ed.runs, title: 'The robot fell over', body: [why, 'Fix the program and run it again. Finding and fixing bugs is part of programming.'], buttons: [{ label: 'Fix it' }] });
    }
  }

  // ---------------------------------------------------------------- missions
  const learnAlgo = { t: 'Algorithm', p: 'A list of clear steps, in the right order, that solves a problem. Like a recipe.', f: 'Feel → Think → Spin → Repeat' };
  const missions = [
    {
      id: 'human', mode: 'human', title: 'Be the Algorithm', objective: 'Keep the robot standing for 15 seconds',
      story: 'Before we write code, YOU are the robot\'s brain. Watch which way it leans, then drive the wheels under the lean. Do it again. And again.',
      learn: [
        { t: 'Feel the tilt', p: 'Watch the robot. Is the top leaning left or right?', f: 'Step 1: feel' },
        { t: 'Drive under it', p: 'Leaning right? Drive right, so the wheels get back under the body.', f: 'Steps 2–3: think, spin' },
        { t: 'Repeat', p: 'One fix is never enough. Keep looping.', f: 'Step 4: go back to 1' },
      ],
      controls: ['<kbd>←</kbd><kbd>→</kbd> drive the wheels', 'or tap ◀ ▶'],
      proved: 'You just ran the balancing algorithm by hand: feel the tilt, work out which way, spin the wheels under the lean, go back to step 1. The real robot does the same four steps hundreds of times every second.',
      tip: 'Drive TOWARDS the lean. If the top leans right, press →. Small taps work better than holding the key down.',
      quiz: AC.QUESTIONS.find((q) => q.id === 'b-order'),
      start(api) { reset({ pushAmp: 0.22, nextPush: 4 }); api.state.up = 0; api.state.sumAbs = 0; editor({ slots: ['feel', 'think', 'spin', 'loop'], palette: [], locked: true, note: 'You are running these steps!' }); },
      update(dt, api) {
        if (P.fallen) { if (P.fallT > 0.8) api.fail('The robot fell after ' + AC.fmt(api.state.up, 1) + ' s.'); return; }
        api.state.up += dt;
        api.state.sumAbs += Math.abs(P.th) * dt;
        api.progress(api.state.up / 15, 'Standing: ' + AC.fmt(api.state.up, 1) + ' / 15 s');
        if (api.state.up >= 15) {
          const avg = AC.deg(api.state.sumAbs / api.state.up);
          api.win(avg < 4 ? 3 : avg < 8 ? 2 : 1, 'Stood for 15 s with an average lean of ' + AC.fmt(avg, 1) + '°.');
        }
      },
    },
    {
      id: 'order', mode: 'program', title: 'Recipe Mix-Up', objective: 'Put the 4 steps in order, then run the program for 6 s',
      story: 'The robot\'s balancing recipe got mixed up, like the tea steps in the warm-up. Put the four steps in the right order. The robot follows them exactly, even wrong ones.',
      learn: [learnAlgo, { t: 'Order matters', p: 'Shoes before socks? Drink before you pour? Change the order and the recipe fails.', f: 'Change the order → the robot falls' }],
      controls: ['Tap a step card to place it', 'Tap a filled step to take it back', '<kbd>Enter</kbd> run'],
      proved: 'The order Feel → Think → Spin → Go back to step 1 is the only order that works. Each step needs the step before it: you cannot work out a direction before you feel the tilt.',
      tip: 'Ask: what does each step need? Thinking needs a tilt reading. Spinning needs a direction. Going back must come last.',
      quiz: AC.QUESTIONS.find((q) => q.id === 'b-why-order'),
      start(api) { reset(); editor({ slots: [null, null, null, null], palette: ['spin', 'loop', 'feel', 'think'] }); },
      update: runUpdate,
    },
    {
      id: 'missing', mode: 'program', title: 'Spot the Missing Step', objective: 'Find the missing step, fix the program, keep the robot up for 6 s',
      story: 'Someone wrote the program in a hurry. Like the toothbrush recipe with no "brush your teeth", one important step is missing. Run it, watch it fall, then fix it.',
      learn: [{ t: 'A missing step is a bug', p: 'Computers never guess what you meant. If a step is not written, it does not happen.', f: 'Missing step = bug' }, learnAlgo],
      controls: ['Tap a step to take it out', 'Tap a card to add it', '<kbd>Enter</kbd> run'],
      proved: '"Work out which way to drive" was missing. Without it, the wheels had no direction to spin. And it had to be TOWARDS the lean: driving away pulls the wheels out from under the robot.',
      tip: 'The robot felt the tilt but never decided which way to go. Take out the last steps, add the missing one after "Feel the tilt", then put them back.',
      quiz: AC.QUESTIONS.find((q) => q.id === 'b-missing'),
      start(api) { reset(); editor({ slots: ['feel', 'spin', 'loop', null], palette: ['away', 'hello', 'think', 'charge'] }); },
      update: runUpdate,
    },
    {
      id: 'speed', mode: 'program', title: 'Hundreds of Times a Second', phys: { L: 0.5, c: 0.3, pushAmp: 1.2, nextPush: 1.5 },
      objective: 'Pick a loop speed that keeps the real-size robot up for 6 s',
      story: 'Now the robot is real size, so it falls much faster. The program is correct, but how often should it run the loop? Start slow, then speed it up.',
      learn: [{ t: 'Loop speed', p: 'A small robot tips over in a fraction of a second. It must feel and fix the tilt again and again, very fast.', f: 'Hundreds of loops every second' }, learnAlgo],
      controls: ['Tap a loop speed', '<kbd>Enter</kbd> run'],
      proved: 'Computers are fast but not clever: they win by repeating simple steps very quickly. Too slow (2–10 loops a second) and the robot falls before it reacts. At 100+ loops a second it barely wobbles.',
      tip: 'Try more loops per second. The real robot runs its balancing loop hundreds of times every second.',
      quiz: AC.QUESTIONS.find((q) => q.id === 'b-fast'),
      start(api) { reset(this.phys); VM.hz = 2; editor({ slots: ['feel', 'think', 'spin', 'loop'], palette: [], locked: true, speeds: [2, 5, 10, 20, 50, 100, 500], note: 'Real-size robot' }); },
      update(dt, api) {
        runUpdate(dt, api, () => api.win(VM.hz >= 100 ? 3 : VM.hz >= 50 ? 2 : 1, 'Balanced at ' + VM.hz + ' loops per second (' + AC.fmt(VM.hz * 4) + ' program steps every second).'));
      },
    },
  ];
  function runUpdate(dt, api, onWin) {
    if (!VM.on) { api.progress(0, ed.runs ? 'Runs: ' + ed.runs : 'Objective'); return; }
    VM.runT += dt;
    api.progress(VM.runT / 6, 'Balancing: ' + AC.fmt(VM.runT, 1) + ' / 6 s');
    if (P.fallen && P.fallT > 0.9) { stopRun(false); return; }
    if (VM.runT >= 6 && !P.fallen) {
      VM.on = false;
      draw();
      bot.mood('ok');
      bot.say('I did it!', 3);
      if (onWin) onWin();
      else api.win(ed.runs <= 1 ? 3 : ed.runs <= 2 ? 2 : 1, 'Balanced for 6 s after ' + ed.runs + (ed.runs === 1 ? ' run.' : ' runs.'));
    }
  }
  const MR = AC.missions({ game: 'balance', week: 1, list: missions });

  // ---------------------------------------------------------------- controls
  const tL = AC.touch.button('◀'), tR = AC.touch.button('▶');
  AC.onKey('Enter', () => { if (!AC.paused) run(); });
  AC.ui.tools([{ label: 'Reset view', onclick: () => Object.assign(oc, { theta: -Math.PI / 2, phi: 1.33, dist: 6.5 }) }]);
  AC.ui.hint('Drag to look around · scroll to zoom');
  function help() {
    AC.ui.card({ eyebrow: AC.UNIT + ' 1', title: 'Balance Loop', body: ['Our robot balances by following an algorithm: 1 Feel the tilt, 2 Work out which way to drive, 3 Spin the wheels under the lean, 4 Go back to step 1.', 'First you run it by hand. Then you program it, debug it, and make it fast.'] });
  }

  // ---------------------------------------------------------------- loop
  let shown = -1;
  S.onFrame((dt) => {
    const m = MR.current;
    if (dt > 0 && m) {
      // sub-step: physics at 1 kHz so even a 500 Hz program loop is exact
      const sub = 0.001;
      for (let t = 0; t < dt; t += sub) {
        const h1 = Math.min(sub, dt - t);
        if (m.mode === 'human' && !MR.done) {
          const key = AC.axis(['ArrowLeft', 'KeyA'], ['ArrowRight', 'KeyD']) + (tR.down ? 1 : 0) - (tL.down ? 1 : 0);
          P.u += (clamp(key, -1, 1) - P.u) * Math.min(1, h1 * 12);
        } else if (VM.on && !P.fallen) {
          VM.acc += h1;
          const sp = 1 / (4 * VM.hz);
          while (VM.acc >= sp) { VM.acc -= sp; if (VM.pc === 0) VM.laps++; vmStep(); }
        } else if (!VM.on && m.mode === 'program' && !P.fallen) {
          // idle: robot rests on its kickstand, upright
          P.th += (0 - P.th) * Math.min(1, h1 * 4); P.w = 0; P.u = 0;
          continue;
        }
        if ((m.mode === 'human' && !MR.done) || VM.on) {
          P.nextPush -= h1;
          if (P.nextPush <= 0 && !P.fallen) {
            P.pushDir = Math.random() < 0.5 ? -1 : 1;
            P.w += P.pushDir * P.pushAmp;
            P.pushShow = 0.7;
            P.nextPush = 3 + Math.random() * 2;
            AC.audio.whoosh && AC.audio.whoosh();
          }
        }
        physics(h1);
      }
    }
    // visuals
    bot.root.position.z = P.z;
    bot.setTilt(P.th);
    bot.roll(P.v * dt);
    oc.target.z += (P.z - oc.target.z) * Math.min(1, dt * 3);
    P.pushShow -= dt;
    if (P.pushShow > 0) push.set(new THREE.Vector3(0, 1.5, P.z - P.pushDir * 1.2), new THREE.Vector3(0, 0, P.pushDir * 0.9), 1);
    else push.set(new THREE.Vector3(0, -5, 0), new THREE.Vector3(0, 0.01, 0), 1);
    // highlight the running step (only visible at slow speeds)
    if (ed.slotEls) {
      const k = VM.on ? (VM.hz <= 10 ? VM.pc : -2) : -1;
      if (k !== shown) {
        ed.slotEls.forEach((el, i) => el.classList.toggle('run', k === -2 || i === k));
        shown = k;
      }
    }
    const lean = Math.abs(AC.deg(P.th)) < 1 ? 'upright' : P.th > 0 ? 'right ▶' : '◀ left';
    hud.set('tilt', deg(P.th), Math.abs(P.th) < 0.14 ? 'cyan' : Math.abs(P.th) < 0.4 ? '' : 'warn');
    hud.set('lean', P.fallen ? 'FALLEN' : lean, P.fallen ? 'warn' : '');
    hud.set('drive', Math.abs(P.u) < 0.05 ? 'still' : (P.u > 0 ? 'right ▶ ' : '◀ left ') + AC.fmt(Math.abs(P.u) * 100) + '%');
    hud.setMeter('up', 1 - Math.min(1, Math.abs(P.th) / 0.78), Math.abs(P.th) < 0.3 ? 'var(--green)' : 'var(--amber)');
    hud.set('hz', m && m.mode === 'human' ? 'you!' : VM.hz + ' /s');
    hud.set('laps', VM.on || VM.laps ? AC.fmt(VM.laps || 0) : '--');
    bot.update(dt, camera);
    MR.update(dt);
    oc.update(dt);
  });
  S.start();
  MR.begin();
})();
