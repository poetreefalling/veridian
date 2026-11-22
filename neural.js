/* Viridian — scroll-driven neural network scene.
   Needs THREE (three@0.149.0 classic build) loaded first.
   Markup contract: .v-site > .v-scroller > (.v-stage > canvas.v-canvas + .v-stop × N) + .v-track */
(function () {
  'use strict';

  var SPACING = 420;          // world units between stops
  var STEP_SCREENS = 1.5;     // scroll distance per stop, in stage heights

  function mulberry(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function smooth(a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
  function smoother(t) { t = clamp01(t); return t * t * t * (t * (t * 6 - 15) + 10); }

  function init(root) {
    var scroller = root.querySelector('.v-scroller');
    var stage = root.querySelector('.v-stage');
    var canvas = root.querySelector('.v-canvas');
    var track = root.querySelector('.v-track');
    var stops = Array.prototype.slice.call(root.querySelectorAll('.v-stop'));
    var dots = Array.prototype.slice.call(root.querySelectorAll('.v-dots button'));
    var header = root.querySelector('.v-brand');   // the nav stays visible; only the brand fades in after the landing screen
    var N = stops.length;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var step = 1, tTarget = 0, tSmooth = 0;

    function layout() {
      var H = stage.clientHeight || 1;
      var keep = tTarget;
      step = H * STEP_SCREENS;
      track.style.height = Math.round((N - 1) * step) + 'px';
      if (keep > 0) scroller.scrollTop = keep * step;   // stay at the same stop when the window changes size
    }
    function goTo(i) {
      scroller.scrollTo({ top: i * step + 1, behavior: reduce ? 'auto' : 'smooth' });
    }
    dots.forEach(function (d, i) { d.addEventListener('click', function () { goTo(i); }); });
    Array.prototype.forEach.call(root.querySelectorAll('[data-goto]'), function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        var v = el.getAttribute('data-goto');
        goTo(v === 'last' ? N - 1 : +v);
      });
    });
    scroller.addEventListener('scroll', function () { tTarget = scroller.scrollTop / step; }, { passive: true });

    /* ---------- sign-up form ---------- */
    var form = root.querySelector('.v-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!form.checkValidity()) { form.reportValidity(); return; }
        var panel = form.closest('.v-panel');
        var btn = form.querySelector('button[type="submit"]');
        var err = form.querySelector('.v-form-error');
        function finish() {
          if (panel) panel.classList.add('is-done');
          var done = panel && panel.querySelector('.v-form-done');
          if (done) { done.setAttribute('tabindex', '-1'); done.focus(); }
        }
        // The form's action attribute is the endpoint that emails the enquiry.
        // With no action set, the form only shows the confirmation (demo mode).
        var url = form.getAttribute('action');
        var key = form.elements.access_key;
        if (!url || (key && !key.value)) { finish(); return; }   // no endpoint or no key yet: demo mode
        if (form.botcheck && form.botcheck.checked) { finish(); return; }   // bots tick the hidden box
        var label = btn.textContent;
        btn.disabled = true; btn.textContent = 'Sending';
        if (err) err.hidden = true;
        fetch(url, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
          .then(function (r) { if (!r.ok) throw new Error('send failed'); finish(); })
          .catch(function () {
            btn.disabled = false; btn.textContent = label;
            if (err) err.hidden = false;
          });
      });
    }

    /* ---------- overlay (works with or without WebGL) ---------- */
    var lastActive = -1;
    function updateOverlay() {
      for (var i = 0; i < N; i++) {
        var d = tSmooth - i;
        var o = 1 - smooth(0.14, 0.36, Math.abs(d));
        if (i === N - 1 && d > 0) o = 1;
        var el = stops[i];
        el.style.opacity = o.toFixed(3);
        el.style.transform = 'translate3d(0,' + (-d * 60).toFixed(1) + 'px,0)';
        var show = o > 0.02;
        if (show !== (el.dataset.on === '1')) {
          el.dataset.on = show ? '1' : '0';
          el.style.visibility = show ? 'visible' : 'hidden';
          if (show) el.removeAttribute('inert'); else el.setAttribute('inert', '');
        }
      }
      var active = Math.max(0, Math.min(N - 1, Math.round(tSmooth)));
      if (active !== lastActive) {
        lastActive = active;
        dots.forEach(function (b, i) {
          if (i === active) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
        });
      }
      if (header) header.style.opacity = smooth(0.3, 0.6, tSmooth).toFixed(3);
    }

    layout();
    function fromHash() {
      if (location.hash === '#find-out-more') { scroller.scrollTop = (N - 1) * step + 1; tTarget = tSmooth = N - 1; }
    }
    fromHash();
    window.addEventListener('hashchange', fromHash);
    updateOverlay();

    var THREE = window.THREE, renderer = null;
    try {
      if (!THREE) throw new Error('three.js missing');
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch (err) {
      root.classList.add('v-nogl');
      (function plain() { tSmooth += (tTarget - tSmooth) * 0.12; updateOverlay(); requestAnimationFrame(plain); })();
      window.addEventListener('resize', layout);
      return;
    }

    var rnd = mulberry(20261123);
    var R = function (a, b) { return a + (b - a) * rnd(); };
    var V3 = THREE.Vector3;
    function randDir() {
      var u = R(-1, 1), a = R(0, Math.PI * 2), s = Math.sqrt(1 - u * u);
      return new V3(s * Math.cos(a), s * Math.sin(a), u);
    }

    renderer.setClearColor(0x020716, 1);
    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.0021);
    var camera = new THREE.PerspectiveCamera(62, 1, 1, 2200);

    /* ---------- soft round texture for glows, dust and pulses ---------- */
    function glowTexture(inner) {
      var c = document.createElement('canvas'); c.width = c.height = 128;
      var g = c.getContext('2d');
      var grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(inner, 'rgba(255,255,255,0.55)');
      grad.addColorStop(0.55, 'rgba(255,255,255,0.12)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
      var t = new THREE.CanvasTexture(c); return t;
    }
    var texGlow = glowTexture(0.16), texSoft = glowTexture(0.4);

    /* ---------- where everything sits ---------- */
    var endZ = -(N - 1) * SPACING;
    var chipPos = new V3(-36, 2, endZ - 96);
    var neurons = [];

    function corridorClear(p) {
      // keep the camera's path and the view of the chip free of cell bodies
      var r = Math.sqrt(p.x * p.x + p.y * p.y);
      if (r < 46) return false;
      if (p.distanceTo(chipPos) < 82) return false;
      if (p.z < endZ + 30 && p.z > chipPos.z - 20 && r < 120) return false;
      // leave the right-hand side open behind the sign-up panel
      if (p.z < endZ + 80 && p.z > chipPos.z - 220 && p.x > -4 && r < 260) return false;
      return true;
    }
    var zNear = 60, zFar = endZ - 520, count = 96, guard = 0;
    while (neurons.length < count && guard++ < 4000) {
      var ang = R(0, Math.PI * 2), rad = 50 + Math.pow(rnd(), 0.85) * 240;
      var p = new V3(Math.cos(ang) * rad, Math.sin(ang) * rad * 0.8, R(zFar, zNear));
      if (!corridorClear(p)) continue;
      var ok = true;
      for (var k = 0; k < neurons.length; k++) if (neurons[k].p.distanceTo(p) < 62) { ok = false; break; }
      if (ok) neurons.push({ p: p, r: R(4.5, 8.5), links: [], chip: false });
    }
    // six cells that wire into the chip
    var chipCells = [];
    for (var c = 0; c < 6; c++) {
      var a = Math.PI * (0.42 + (c / 5) * 1.16);
      var cp = new V3(chipPos.x + Math.cos(a) * R(74, 104), chipPos.y + Math.sin(a) * R(52, 78), chipPos.z - R(8, 70));
      var cell = { p: cp, r: R(5, 7.5), links: [], chip: true };
      neurons.push(cell); chipCells.push(cell);
    }

    /* ---------- tissue: somas, dendrites and axons merged into one mesh ---------- */
    var parts = [];
    var tmp = new V3();
    function addTube(curve, segs, r0, r1, glow) {
      var g = new THREE.TubeGeometry(curve, segs, 1, 5, false);
      var pos = g.attributes.position, ring = 6;
      for (var i = 0; i <= segs; i++) {
        var t = i / segs, P = curve.getPointAt(t), r = r0 + (r1 - r0) * t;
        for (var j = 0; j < ring; j++) {
          var idx = i * ring + j;
          tmp.fromBufferAttribute(pos, idx).sub(P).multiplyScalar(r).add(P);
          pos.setXYZ(idx, tmp.x, tmp.y, tmp.z);
        }
      }
      parts.push({ g: g, glow: glow });
    }
    function addSoma(n) {
      var g = new THREE.SphereGeometry(n.r, 18, 12);
      var pos = g.attributes.position, a = R(0, 6), b = R(0, 6);
      for (var i = 0; i < pos.count; i++) {
        tmp.fromBufferAttribute(pos, i);
        var d = tmp.clone().normalize();
        var s = 1 + 0.2 * Math.sin(d.x * 3 + a) * Math.sin(d.y * 4 + b) + 0.12 * Math.sin(d.z * 5 + a + b);
        pos.setXYZ(i, n.p.x + tmp.x * s, n.p.y + tmp.y * s, n.p.z + tmp.z * s);
      }
      g.computeVertexNormals();
      parts.push({ g: g, glow: 1.25 });
    }
    function branch(from, dir, len, r0, depth) {
      var pts = [from.clone()], p = from.clone(), d = dir.clone(), seg = len / 4;
      for (var i = 0; i < 4; i++) {
        d.add(randDir().multiplyScalar(0.55)).normalize();
        p = p.clone().addScaledVector(d, seg * R(0.8, 1.2));
        pts.push(p);
      }
      addTube(new THREE.CatmullRomCurve3(pts), 12, r0, r0 * 0.14, R(0.65, 1.1));
      if (depth > 0) {
        var kids = rnd() < 0.6 ? 2 : 1;
        for (var k = 0; k < kids; k++) {
          var at = pts[rnd() < 0.5 ? 2 : 3];
          branch(at, d.clone().add(randDir().multiplyScalar(0.9)).normalize(), len * R(0.45, 0.7), r0 * 0.5, depth - 1);
        }
      }
    }
    neurons.forEach(function (n) {
      addSoma(n);
      var arms = Math.round(R(4, 6));
      for (var i = 0; i < arms; i++) {
        var d = randDir();
        if (n.chip && d.x > 0.2) d.x = -d.x;
        branch(n.p.clone().addScaledVector(d, n.r * 0.7), d, n.chip ? R(40, 80) : R(60, 150), n.r * 0.36, 1);
      }
    });

    // axons — the routes the light travels
    var linked = {};
    function link(a, b) {
      var A = neurons[a], B = neurons[b], key = a < b ? a + '-' + b : b + '-' + a;
      if (linked[key]) return; linked[key] = 1;
      var dist = A.p.distanceTo(B.p);
      var mid = A.p.clone().lerp(B.p, 0.5).add(randDir().multiplyScalar(dist * 0.16));
      var q1 = A.p.clone().lerp(mid, 0.5).add(randDir().multiplyScalar(dist * 0.06));
      var q2 = mid.clone().lerp(B.p, 0.5).add(randDir().multiplyScalar(dist * 0.06));
      var curve = new THREE.CatmullRomCurve3([A.p.clone(), q1, mid, q2, B.p.clone()]);
      addTube(curve, 18, 0.75, 0.75, 0.95);
      A.links.push({ curve: curve, to: b, fwd: true, len: dist });
      B.links.push({ curve: curve, to: a, fwd: false, len: dist });
    }
    neurons.forEach(function (n, i) {
      var near = [];
      neurons.forEach(function (m, j) { if (j !== i) { var d = n.p.distanceTo(m.p); if (d < 270) near.push([d, j]); } });
      near.sort(function (x, y) { return x[0] - y[0]; });
      for (var k = 0; k < Math.min(3, near.length); k++) link(i, near[k][1]);
    });

    /* ---------- the chip ---------- */
    var chip = new THREE.Group();
    chip.position.copy(chipPos);
    chip.rotation.set(0.95, 0.42, -0.12);
    var S = 34, TH = 3.2;
    var bodyMat = new THREE.MeshBasicMaterial({ color: 0x061a40, fog: false });
    var body = new THREE.Mesh(new THREE.BoxGeometry(S, TH, S), bodyMat);
    chip.add(body);
    var faceCanvas = document.createElement('canvas'); faceCanvas.width = faceCanvas.height = 512;
    function drawFace(g, markImg) {
      g.fillStyle = '#04122e'; g.fillRect(0, 0, 512, 512);
      g.strokeStyle = 'rgba(0,240,255,0.55)'; g.lineWidth = 3;
      g.strokeRect(14, 14, 484, 484);
      // traces from the die out to the pads
      g.lineWidth = 2.5; g.lineCap = 'round'; g.lineJoin = 'round';
      for (var side = 0; side < 4; side++) {
        g.save(); g.translate(256, 256); g.rotate(side * Math.PI / 2); g.translate(-256, -256);
        for (var i = 0; i < 10; i++) {
          var x = 60 + i * 43.5, inner = 178 + Math.abs(i - 4.5) * 2;
          var tx = 256 + (i - 4.5) * 17;
          g.strokeStyle = i % 3 === 0 ? 'rgba(0,240,255,0.9)' : 'rgba(96,170,255,0.6)';
          g.beginPath(); g.moveTo(x, 22); g.lineTo(x, 70 + (i % 2) * 22); g.lineTo(tx, 140); g.lineTo(tx, inner); g.stroke();
          g.fillStyle = 'rgba(191,234,255,0.95)'; g.fillRect(x - 7, 18, 14, 14);
        }
        g.restore();
      }
      // die
      g.fillStyle = '#020716'; g.fillRect(146, 146, 220, 220);
      g.strokeStyle = 'rgba(0,240,255,0.9)'; g.lineWidth = 3; g.strokeRect(147.5, 147.5, 217, 217);
      g.strokeStyle = 'rgba(96,170,255,0.45)'; g.lineWidth = 1.5; g.strokeRect(157.5, 157.5, 197, 197);
      if (markImg) {
        // the Viridian V, drawn from the supplied logo file
        var mw = 172, mh = mw * markImg.naturalHeight / markImg.naturalWidth;
        g.drawImage(markImg, 256 - mw / 2, 256 - mh / 2, mw, mh);
      } else {
        g.strokeStyle = 'rgba(0,240,255,0.9)'; g.lineWidth = 2;
        for (var r = 0; r < 4; r++) for (var q = 0; q < 4; q++) g.strokeRect(202 + q * 28, 202 + r * 28, 24, 24);
      }
    }
    drawFace(faceCanvas.getContext('2d'), null);
    var faceTex = new THREE.CanvasTexture(faceCanvas);
    (function loadMark() {
      var src = root.querySelector('.v-brand img');
      if (!src || location.protocol === 'file:') return;   // a page opened straight from disk cannot use images in WebGL
      var img = new Image();
      img.onload = function () {
        var g = faceCanvas.getContext('2d');
        g.clearRect(0, 0, 512, 512); drawFace(g, img); faceTex.needsUpdate = true;
      };
      img.src = src.currentSrc || src.src;
    })();
    faceTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    var faceMat = new THREE.MeshBasicMaterial({ map: faceTex, fog: false });
    var face = new THREE.Mesh(new THREE.PlaneGeometry(S, S), faceMat);
    face.rotation.x = -Math.PI / 2; face.position.y = TH / 2 + 0.02; chip.add(face);
    var edgeMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.9, fog: false });
    chip.add(new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), edgeMat));
    var pinMat = new THREE.MeshBasicMaterial({ color: 0xbfeaff, fog: false });
    var pinGeo = new THREE.BoxGeometry(1.5, 0.9, 4.2), pinLocal = [];
    for (var sd = 0; sd < 4; sd++) for (var pi = 0; pi < 10; pi++) {
      var pin = new THREE.Mesh(pinGeo, pinMat), off = (pi - 4.5) * 3, out = S / 2 + 1.6;
      if (sd === 0) pin.position.set(off, -0.6, out);
      if (sd === 1) pin.position.set(off, -0.6, -out);
      if (sd === 2) { pin.position.set(out, -0.6, off); pin.rotation.y = Math.PI / 2; }
      if (sd === 3) { pin.position.set(-out, -0.6, off); pin.rotation.y = Math.PI / 2; }
      chip.add(pin); pinLocal.push(pin.position.clone());
    }
    var haloMat = new THREE.SpriteMaterial({ map: texSoft, color: 0x00f0ff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false });
    var halo = new THREE.Sprite(haloMat); halo.scale.set(150, 150, 1); halo.position.copy(chipPos); halo.renderOrder = -1;
    scene.add(halo);
    var coreMat = new THREE.SpriteMaterial({ map: texGlow, color: 0x9ff6ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false });
    var core = new THREE.Sprite(coreMat); core.scale.set(26, 26, 1); core.position.set(0, TH / 2 + 1, 0); chip.add(core);
    scene.add(chip);
    chip.updateMatrixWorld(true);

    // wire the six cells into the nearest free pins
    var usedPins = {}, chipLinks = [];
    chipCells.forEach(function (cell) {
      var best = -1, bd = 1e9;
      pinLocal.forEach(function (lp, i) {
        if (usedPins[i]) return;
        var w = chip.localToWorld(lp.clone()), d = w.distanceTo(cell.p);
        if (d < bd) { bd = d; best = i; }
      });
      usedPins[best] = 1;
      var end = chip.localToWorld(pinLocal[best].clone());
      var outward = end.clone().sub(chipPos).normalize();
      var m1 = end.clone().addScaledVector(outward, 14);
      var m2 = cell.p.clone().lerp(m1, 0.45).add(randDir().multiplyScalar(9));
      var curve = new THREE.CatmullRomCurve3([cell.p.clone(), m2, m1, end]);
      addTube(curve, 18, 1.1, 0.5, 1.5);
      chipLinks.push({ curve: curve, to: -1, fwd: true, len: bd });
    });

    // merge
    var vCount = 0, iCount = 0;
    parts.forEach(function (pt) { vCount += pt.g.attributes.position.count; iCount += pt.g.index ? pt.g.index.count : pt.g.attributes.position.count; });
    var mPos = new Float32Array(vCount * 3), mNor = new Float32Array(vCount * 3), mGlow = new Float32Array(vCount), mIdx = new Uint32Array(iCount);
    var vo = 0, io = 0;
    parts.forEach(function (pt) {
      var g = pt.g, n = g.attributes.position.count;
      mPos.set(g.attributes.position.array, vo * 3);
      mNor.set(g.attributes.normal.array, vo * 3);
      for (var i = 0; i < n; i++) mGlow[vo + i] = pt.glow;
      if (g.index) { var ia = g.index.array; for (var j = 0; j < ia.length; j++) mIdx[io + j] = ia[j] + vo; io += ia.length; }
      else { for (var q = 0; q < n; q++) mIdx[io + q] = vo + q; io += n; }
      vo += n; g.dispose();
    });
    parts = null;
    var tissueGeo = new THREE.BufferGeometry();
    tissueGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
    tissueGeo.setAttribute('normal', new THREE.BufferAttribute(mNor, 3));
    tissueGeo.setAttribute('aGlow', new THREE.BufferAttribute(mGlow, 1));
    tissueGeo.setIndex(new THREE.BufferAttribute(mIdx, 1));
    var tissueMat = new THREE.ShaderMaterial({
      uniforms: {
        uCore: { value: new THREE.Color(0x0a3f9e) },
        uRim: { value: new THREE.Color(0x9fe8ff) },
        uDensity: { value: 0.0021 },
        uBeat: { value: 0 }
      },
      vertexShader: [
        'attribute float aGlow; varying vec3 vN; varying vec3 vV; varying float vDepth; varying float vGlow;',
        'void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        ' vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vDepth = -mv.z; vGlow = aGlow;',
        ' gl_Position = projectionMatrix * mv; }'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uCore; uniform vec3 uRim; uniform float uDensity; uniform float uBeat;',
        'varying vec3 vN; varying vec3 vV; varying float vDepth; varying float vGlow;',
        'void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));',
        ' float rim = pow(f, 1.7);',
        ' vec3 col = mix(uCore, uRim, rim) * (0.16 + 1.15 * rim) * vGlow * (1.0 + uBeat * 0.35);',
        ' float fog = exp(-uDensity * uDensity * vDepth * vDepth);',
        ' float near = smoothstep(8.0, 95.0, vDepth);',
        ' gl_FragColor = vec4(col * fog * near, 1.0); }'
      ].join('\n'),
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
    });
    var tissue = new THREE.Mesh(tissueGeo, tissueMat);
    tissue.frustumCulled = false;
    scene.add(tissue);

    /* ---------- soma glows ---------- */
    var CYAN = new THREE.Color(0x00f0ff), ICE = new THREE.Color(0xbfeaff), SPARK = new THREE.Color(0xffa040), ROYAL = new THREE.Color(0x0a5fe6);
    neurons.forEach(function (n) {
      var m = new THREE.SpriteMaterial({ map: texGlow, color: CYAN.clone(), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
      var s = new THREE.Sprite(m); s.position.copy(n.p); s.scale.setScalar(n.r * 7);
      scene.add(s); n.sprite = s; n.flash = 0; n.warm = false;
    });

    /* ---------- atmosphere: bokeh haze and drifting dust ---------- */
    for (var h = 0; h < 30; h++) {
      var hm = new THREE.SpriteMaterial({ map: texSoft, color: (h % 4 === 0 ? CYAN : ROYAL).clone(), transparent: true, opacity: R(0.05, 0.13), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
      var hs = new THREE.Sprite(hm); var ha = R(0, 6.28), hr = R(120, 380);
      hs.position.set(Math.cos(ha) * hr, Math.sin(ha) * hr * 0.7, R(zFar, zNear)); hs.scale.setScalar(R(220, 480));
      scene.add(hs);
    }
    function dust(n, size, color, opacity) {
      var arr = new Float32Array(n * 3);
      for (var i = 0; i < n; i++) { var a = R(0, 6.28), r = R(8, 330); arr[i * 3] = Math.cos(a) * r; arr[i * 3 + 1] = Math.sin(a) * r * 0.8; arr[i * 3 + 2] = R(zFar, zNear + 80); }
      var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      var m = new THREE.PointsMaterial({ map: texGlow, size: size, color: color, transparent: true, opacity: opacity, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
      var pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts); return pts;
    }
    var dustA = dust(1400, 2.4, 0x8fdcff, 0.7), dustB = dust(220, 5.5, 0xffa040, 0.55), dustC = dust(260, 9, 0x2f7dff, 0.35);

    /* ---------- pulses of light ---------- */
    var TRAIL = 4, POOL = 56, pulses = [];
    for (var pIdx = 0; pIdx < POOL; pIdx++) {
      var sprites = [];
      for (var tr = 0; tr < TRAIL; tr++) {
        var pm = new THREE.SpriteMaterial({ map: texGlow, color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
        var ps = new THREE.Sprite(pm); ps.visible = false; scene.add(ps); sprites.push(ps);
      }
      pulses.push({ on: false, sprites: sprites });
    }
    function fire(linkObj, hops, warm, speed) {
      for (var i = 0; i < POOL; i++) {
        var p = pulses[i];
        if (p.on) continue;
        p.on = true; p.link = linkObj; p.t = 0; p.hops = hops; p.warm = warm;
        p.dur = Math.max(0.5, linkObj.len / (speed || 150));
        var col = warm ? SPARK : (rnd() < 0.3 ? ICE : CYAN);
        p.sprites.forEach(function (s, k) { s.material.color.copy(col); s.visible = true; s.scale.setScalar((warm ? 20 : 16) * (1 - k * 0.2)); });
        return;
      }
    }
    function fireFrom(index, hops, warm, except) {
      var n = neurons[index]; n.flash = 1; n.warm = warm;
      n.links.forEach(function (l) { if (l.to !== except && (hops > 3 || rnd() < 0.7)) fire(l, hops, warm); });
    }
    var chipBeat = 0, nextBurst = 0.6, nextChip = 0.5, chipTurn = 0;
    function burst(camZ) {
      var pool = [];
      neurons.forEach(function (n, i) { if (!n.chip && n.p.z < camZ - 50 && n.p.z > camZ - 620) pool.push(i); });
      if (!pool.length) return;
      var starts = rnd() < 0.4 ? 2 : 1;
      for (var s = 0; s < starts; s++) fireFrom(pool[(rnd() * pool.length) | 0], 4, rnd() < 0.22, -2);
    }
    var pt = new V3();
    function updatePulses(dt) {
      for (var i = 0; i < POOL; i++) {
        var p = pulses[i]; if (!p.on) continue;
        p.t += dt / p.dur;
        var done = p.t >= 1;
        for (var k = 0; k < TRAIL; k++) {
          var tt = clamp01(p.t - k * 0.035), u = p.link.fwd ? tt : 1 - tt;
          p.link.curve.getPoint(u, pt);
          var s = p.sprites[k]; s.position.copy(pt);
          s.material.opacity = done ? 0 : Math.sin(Math.PI * clamp01(p.t)) * (1 - k * 0.22) + 0.15;
          if (done) s.visible = false;
        }
        if (done) {
          p.on = false;
          if (p.link.to === -1) { chipBeat = 1; }
          else if (p.hops > 0) fireFrom(p.link.to, p.hops - 1, p.warm, -2);
          else { neurons[p.link.to].flash = Math.max(neurons[p.link.to].flash, 0.6); neurons[p.link.to].warm = p.warm; }
        }
      }
    }

    /* ---------- sizing ---------- */
    var narrow = false;
    function resize() {
      var w = stage.clientWidth || 1, hgt = stage.clientHeight || 1;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setSize(w, hgt, false);
      camera.aspect = w / hgt; camera.updateProjectionMatrix();
      narrow = w / hgt < 0.95 || w <= 760;
      layout();
      tTarget = scroller.scrollTop / step;
    }
    window.addEventListener('resize', resize);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
    resize();

    var mouse = { x: 0, y: 0, sx: 0, sy: 0 };
    root.addEventListener('pointermove', function (e) {
      var r = stage.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouse.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    });

    /* ---------- frame loop ---------- */
    var clock = new THREE.Clock(), time = 0, look = new V3();
    function frame() {
      requestAnimationFrame(frame);
      var dt = Math.min(clock.getDelta(), 0.05); time += dt;
      tSmooth += (tTarget - tSmooth) * Math.min(1, dt * (reduce ? 20 : 4.2));
      var t = Math.max(0, Math.min(N - 1, tSmooth));
      var i = Math.floor(t), f = t - i;
      var z = -(i + smoother((f - 0.16) / 0.68)) * SPACING;

      var settle = smooth(N - 1.6, N - 1, t);              // 1 when parked at the chip
      var sway = reduce ? 0 : 1 - settle;
      mouse.sx += (mouse.x - mouse.sx) * 0.05; mouse.sy += (mouse.y - mouse.sy) * 0.05;
      var drift = reduce ? 0 : 1;
      var cx = Math.sin(t * 1.9) * 9 * sway + Math.sin(time * 0.21) * 2.2 * drift + mouse.sx * 5;
      var cy = Math.cos(t * 1.4) * 6 * sway + Math.cos(time * 0.17) * 1.6 * drift - mouse.sy * 3.5;
      // on narrow screens the form sits low, so lift the view to put the chip up top
      var shiftX = narrow ? chipPos.x * settle : 0, shiftY = narrow ? -22 * settle : 0;
      camera.position.set(cx + shiftX, cy + shiftY, z + 8);
      look.set(cx * 0.4 + shiftX, cy * 0.4 + shiftY * 0.2 + (narrow ? -6 * settle : 0), z - 120);
      camera.lookAt(look);
      camera.rotation.z += Math.sin(t * 1.1) * 0.06 * sway;

      // bursts ripple through the network ahead of the viewer
      nextBurst -= dt;
      if (nextBurst <= 0) { burst(z); nextBurst = (reduce ? 5 : 2.2) + rnd() * 1.6; }
      // the chip takes a steady inbound signal
      nextChip -= dt;
      if (nextChip <= 0 && t > N - 2.2) {
        fire(chipLinks[chipTurn % chipLinks.length], 0, chipTurn % 3 === 2, 70);
        chipCells[chipTurn % chipCells.length].flash = 1;
        chipTurn++; nextChip = 0.85;
      }
      updatePulses(dt);

      for (var n = 0; n < neurons.length; n++) {
        var nu = neurons[n]; if (nu.flash <= 0.001 && nu.sprite.material.opacity === 0.22) continue;
        nu.flash = Math.max(0, nu.flash - dt * 1.5);
        var e = nu.flash * nu.flash;
        nu.sprite.material.opacity = 0.22 + e * 0.78;
        nu.sprite.scale.setScalar(nu.r * (7 + e * 11));
        nu.sprite.material.color.copy(nu.warm && e > 0.02 ? SPARK : CYAN);
        if (nu.flash === 0) nu.sprite.material.opacity = 0.22;
      }

      // chip heartbeat: a slow breath plus a kick each time a signal lands
      chipBeat = Math.max(0, chipBeat - dt * 2.2);
      var breath = 0.5 + 0.5 * Math.sin(time * 2.1);
      var beat = Math.min(1, breath * 0.45 + chipBeat * chipBeat);
      haloMat.opacity = 0.22 + beat * 0.5; halo.scale.setScalar(130 + beat * 60);
      coreMat.opacity = 0.12 + beat * 0.3; core.scale.setScalar(22 + beat * 20);
      edgeMat.opacity = 0.5 + beat * 0.5;
      faceMat.color.setScalar(0.72 + beat * 0.28);
      chip.position.y = chipPos.y + (reduce ? 0 : Math.sin(time * 0.8) * 0.5);
      tissueMat.uniforms.uBeat.value = 0.5 + 0.5 * Math.sin(time * 0.9);

      if (!reduce) { dustA.rotation.z = time * 0.006; dustB.rotation.z = -time * 0.009; dustC.rotation.z = time * 0.004; }

      updateOverlay();
      renderer.render(scene, camera);
    }
    frame();
    root.classList.add('v-ready');
  }

  function boot() {
    Array.prototype.forEach.call(document.querySelectorAll('.v-site'), init);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
