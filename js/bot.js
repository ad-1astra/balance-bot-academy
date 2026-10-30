/* The two-wheel self-balancing robot, shared by every game.
   root sits on the floor (yaw = rotation.y, forward = +z); tilt leans about the axle (+ = leaning forward). */
(function () {
  'use strict';
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.55, metalness: 0.15 }, o));
  AC.makeBot = function (S, o = {}) {
    const R = 0.32;
    const root = new THREE.Group();
    const axle = new THREE.Group();
    axle.position.y = R;
    root.add(axle);
    const tilt = new THREE.Group();
    axle.add(tilt);
    const cast = (m) => { m.castShadow = true; return m; };
    const add = (m, x, y, z) => { m.position.set(x, y, z); tilt.add(m); return m; };
    // body, stripe, IMU tilt sensor (step 1: feel the tilt), battery pack, head, eyes, antenna
    add(cast(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.9, 0.34), mat(o.color || 0xe8eef5))), 0, 0.5, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.08, 0.36), mat(0x3fd0f0, { emissive: 0x0d4a5a })), 0, 0.78, 0);
    const imu = add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.04), mat(0x222a33, { emissive: 0xffb547, emissiveIntensity: 0.6 })), 0, 0.42, 0.18);
    add(cast(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.12), mat(0x2b3542))), 0, 0.5, -0.23);
    const fill = add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.02), mat(0x4be38a, { emissive: 0x2a8a50 })), 0, 0.5, -0.295);
    const head = add(cast(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.42, 0.42), mat(o.color || 0xe8eef5))), 0, 1.18, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.3, 0.02), mat(0x0a1420, { roughness: 0.2 })), 0, 1.18, 0.215);
    const eyeMat = mat(0x3fd0f0, { emissive: 0x3fd0f0, emissiveIntensity: 0.9 });
    for (const x of [-0.13, 0.13]) add(new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), eyeMat), x, 1.2, 0.23).scale.z = 0.4;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25), mat(0x93a7bf)), 0.2, 1.5, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), mat(0xff5a4f, { emissive: 0xff5a4f, emissiveIntensity: 0.7 })), 0.2, 1.64, 0);
    const wheels = [];
    for (const x of [-0.42, 0.42]) {
      const w = new THREE.Group();
      w.position.x = x;
      const tyre = cast(new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.14, 28), mat(0x1c2026, { roughness: 0.9 })));
      tyre.rotation.z = Math.PI / 2;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.15, 6), mat(0xffb547));
      hub.rotation.z = Math.PI / 2;
      w.add(tyre, hub, new THREE.Mesh(new THREE.BoxGeometry(0.152, 0.5, 0.05), mat(0x93a7bf)));
      axle.add(w);
      wheels.push(w);
    }
    S.scene.add(root);
    const bubble = AC.h('div', { class: 'say', style: { display: 'none' } });
    S.host.parentNode.appendChild(bubble);
    let sayT = 0;
    const v = new THREE.Vector3();
    const bot = {
      root, tilt, wheels, R, imu,
      setTilt(a) { tilt.rotation.x = a; },
      // dist = metres rolled forward; turn = radians of on-the-spot spin (wheels counter-rotate)
      roll(dist, turn = 0) {
        wheels[0].rotation.x += dist / R + turn * 1.3;
        wheels[1].rotation.x += dist / R - turn * 1.3;
      },
      battery(frac) {
        const f = Math.max(0.02, AC.clamp(frac, 0, 1));
        fill.scale.y = f;
        fill.position.y = 0.3 + 0.2 * f;
        const c = frac > 0.5 ? [0x4be38a, 0x2a8a50] : frac > 0.2 ? [0xffb547, 0x8a5a10] : [0xff5a4f, 0x8a1a10];
        fill.material.color.setHex(c[0]);
        fill.material.emissive.setHex(c[1]);
      },
      mood(m) {
        const c = m === 'bad' ? 0xff5a4f : m === 'ok' ? 0x4be38a : m === 'think' ? 0xffb547 : 0x3fd0f0;
        eyeMat.color.setHex(c);
        eyeMat.emissive.setHex(c);
      },
      say(text, secs = 2) { bubble.textContent = text || ''; bubble.style.display = text ? '' : 'none'; sayT = secs; },
      update(dt, camera) {
        if (sayT > 0) { sayT -= dt; if (sayT <= 0) bubble.style.display = 'none'; }
        if (bubble.style.display === 'none') return;
        head.updateMatrixWorld();
        v.setFromMatrixPosition(head.matrixWorld);
        v.y += 0.4;
        v.project(camera);
        const el = S.renderer.domElement;
        bubble.style.left = ((v.x + 1) / 2) * el.clientWidth + 'px';
        bubble.style.top = ((1 - v.y) / 2) * el.clientHeight + 'px';
      },
    };
    bot.battery(1);
    return bot;
  };

  // tiled lab floor shared by the games
  AC.labFloor = function (scene, size = 60, tile = 1, color = '#26303d') {
    const tex = AC.canvasTex(128, 128, (g) => {
      g.fillStyle = color;
      g.fillRect(0, 0, 128, 128);
      g.strokeStyle = 'rgba(80,110,140,0.45)';
      g.lineWidth = 3;
      g.strokeRect(0, 0, 128, 128);
    }, [size / tile, size / tile]);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    return floor;
  };

  // short page header for every game: robot scripts + shared CSS are loaded by the html
  AC.mat = mat;
})();
