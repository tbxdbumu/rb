(function () {
'use strict';
var canvas = document.getElementById('bg3d');
if (!canvas || !window.THREE) { if (canvas) canvas.style.display = 'none'; return; }
var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

var STEVE_URLS = [
  'https://media.githubusercontent.com/media/MdeMalo/Modelos_aframe/main/minecraft_steve_rigged.glb'
];

var renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) { canvas.style.display = 'none'; return; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
else if ('outputEncoding' in renderer && THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
function srgb(tex) {
  if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  else if ('encoding' in tex && THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
  return tex;
}

var scene = new THREE.Scene();
scene.background = new THREE.Color(0x060606);
scene.fog = new THREE.FogExp2(0x060606, 0.016);

var camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 1.2, 12);

scene.add(new THREE.HemisphereLight(0xbfafff, 0x0a0a12, 1.0));
var key = new THREE.DirectionalLight(0xffffff, 1.35); key.position.set(6, 10, 6); scene.add(key);
var rim = new THREE.DirectionalLight(0x8b5cf6, 0.9); rim.position.set(-7, 4, -20); scene.add(rim);
var warm = new THREE.PointLight(0xffb02e, 1.1, 60); warm.position.set(0, 4, -30); scene.add(warm);

function setLive(txt, ok) {
  var el = document.getElementById('live-dot');
  if (el) { el.textContent = txt; el.classList.toggle('off', !ok); }
}
function pts(n, fn, size, op) {
  var g = new THREE.BufferGeometry();
  var pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  var c = new THREE.Color();
  for (var i = 0; i < n; i++) {
    var p = fn(i, c);
    pos[i*3] = p[0]; pos[i*3+1] = p[1]; pos[i*3+2] = p[2];
    col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: size, vertexColors: true, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
}

var dust = pts(700, function (i, c) {
  c.set(i % 3 ? 0x8b5cf6 : 0xffffff).multiplyScalar(0.35 + Math.random() * 0.5);
  return [(Math.random()-0.5)*70, (Math.random()-0.5)*36, 14 - Math.random()*90];
}, 0.13, 0.8);
scene.add(dust);

var island = new THREE.Group();
island.position.set(0, 0, -30);
var ground = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 6.2, 1.6, 9),
  new THREE.MeshStandardMaterial({ color: 0x1c2b1c, roughness: 1, flatShading: true }));
ground.position.y = -2.2; island.add(ground);
var grass = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 0.5, 9),
  new THREE.MeshStandardMaterial({ color: 0x2f9e44, roughness: 1, flatShading: true }));
grass.position.y = -1.2; island.add(grass);
for (var fi = 0; fi < 7; fi++) {
  var fs = 0.6 + Math.random() * 0.9;
  var fc = [0x2f9e44, 0x8a5a2b, 0x46e6ff][fi % 3];
  var fb = new THREE.Mesh(new THREE.BoxGeometry(fs, fs, fs),
    new THREE.MeshStandardMaterial({ color: fc, emissive: fc, emissiveIntensity: 0.12, roughness: 0.9 }));
  var fa = fi * 0.9;
  fb.position.set(Math.cos(fa) * (4.5 + Math.random()*2), -0.4 + Math.random()*2.4, Math.sin(fa) * (4.5 + Math.random()*2));
  fb.rotation.y = Math.random();
  fb.userData = { y0: fb.position.y, ph: Math.random() * 6.28, sp: 0.3 + Math.random() * 0.7 };
  island.add(fb);
}
scene.add(island);
var floaters = island.children.filter(function (o) { return o.userData && o.userData.y0 !== undefined; });

var steve = new THREE.Group();
steve.position.set(0, -0.9, 0);
island.add(steve);
var steveGLB = false, steveModel = null, fbRefs = null;

function faceTexture() {
  var cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
  var x = cv.getContext('2d');
  x.fillStyle = '#c68e5f'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#5a3a22'; x.fillRect(0, 0, 64, 12);
  x.fillStyle = '#ffffff'; x.fillRect(10, 26, 14, 10); x.fillRect(40, 26, 14, 10);
  x.fillStyle = '#4a3aff'; x.fillRect(14, 28, 7, 7); x.fillRect(44, 28, 7, 7);
  x.fillStyle = '#7a4a2a'; x.fillRect(24, 46, 16, 4);
  var t = srgb(new THREE.CanvasTexture(cv)); t.magFilter = THREE.NearestFilter; return t;
}
function buildFallbackSteve() {
  var g = new THREE.Group();
  var skin = new THREE.MeshStandardMaterial({ color: 0xc68e5f, roughness: 0.8 });
  var shirt = new THREE.MeshStandardMaterial({ color: 0x27c8c8, roughness: 0.8 });
  var pants = new THREE.MeshStandardMaterial({ color: 0x3b5bd6, roughness: 0.85 });
  var head = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.95),
    new THREE.MeshStandardMaterial({ map: faceTexture(), roughness: 0.8 }));
  head.position.y = 2.55;
  var torso = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.3, 0.65), shirt);
  torso.position.y = 1.45;
  function limb(w, h, mat, x, y) {
    var pv = new THREE.Group(); pv.position.set(x, y, 0);
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat); m.position.y = -h / 2; pv.add(m);
    g.add(pv); return pv;
  }
  fbRefs = {
    armL: limb(0.42, 1.25, shirt, -0.82, 2.0),
    armR: limb(0.42, 1.25, shirt, 0.82, 2.0),
    legL: limb(0.5, 1.2, pants, -0.3, 0.85),
    legR: limb(0.5, 1.2, pants, 0.3, 0.85)
  };
  g.add(head, torso);
  return g;
}

function loadGLB(urls, done) {
  if (!window.THREE || !THREE.GLTFLoader) { done(new Error('no loader')); return; }
  var loader;
  try { loader = new THREE.GLTFLoader(); } catch (e) { done(e); return; }
  var i = 0;
  function next() {
    if (i >= urls.length) { done(new Error('all failed')); return; }
    var settled = false;
    var to = setTimeout(function () { if (!settled) { settled = true; next(); } }, 25000);
    try {
      loader.load(urls[i++], function (g) { if (!settled) { settled = true; clearTimeout(to); done(null, g); } },
        undefined, function () { if (!settled) { settled = true; clearTimeout(to); next(); } });
    } catch (e) { if (!settled) { settled = true; clearTimeout(to); next(); } }
  }
  next();
}
loadGLB(STEVE_URLS, function (err, gltf) {
  if (err || !gltf) {
    steve.add(buildFallbackSteve());
    setLive('3D ● BASIC', false);
    return;
  }
  try {
    steveModel = gltf.scene;
    var bb = new THREE.Box3().setFromObject(steveModel);
    var size = bb.getSize(new THREE.Vector3());
    if (size.y > 0.001) steveModel.scale.setScalar(3.4 / size.y);
    bb.setFromObject(steveModel);
    steveModel.position.y -= bb.min.y;
    steveModel.rotation.y = -0.2;
    steve.add(steveModel);
    steveGLB = true;
    setLive('3D ● LIVE', true);
  } catch (e) {
    steve.add(buildFallbackSteve());
    setLive('3D ● BASIC', false);
  }
});

function discordTexture() {
  var cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
  var x = cv.getContext('2d');
  function roundRect(r) {
    x.beginPath();
    x.moveTo(56 + r, 56);
    x.arcTo(456, 56, 456, 456, r);
    x.arcTo(456, 456, 56, 456, r);
    x.arcTo(56, 456, 56, 56, r);
    x.arcTo(56, 56, 456, 56, r);
    x.closePath();
  }
  x.fillStyle = '#5865F2';
  roundRect(120); x.fill();
  x.fillStyle = '#ffffff';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '400px "Font Awesome 6 Brands", "FontAwesome", sans-serif';
  x.fillText('', 256, 276);

  try {
    var w = x.measureText('').width;
    if (!w || w < 10) throw 0;
  } catch (e) {
    x.beginPath(); x.arc(196, 240, 34, 0, 7); x.arc(316, 240, 34, 0, 7); x.fill();
    x.strokeStyle = '#ffffff'; x.lineWidth = 26; x.lineCap = 'round';
    x.beginPath(); x.arc(256, 250, 110, 0.6, Math.PI - 0.6); x.stroke();
  }
  return srgb(new THREE.CanvasTexture(cv));
}
var badgeTex = discordTexture();
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(function () {
    try {
      var fresh = discordTexture();
      badgeTex.image = fresh.image;
      badgeTex.needsUpdate = true;
    } catch (e) {}
  });
}
var badgeSide = new THREE.MeshStandardMaterial({ color: 0x2b32a0, roughness: 0.4, metalness: 0.3 });
var badgeFace = new THREE.MeshStandardMaterial({ map: badgeTex, emissive: 0xffffff, emissiveMap: badgeTex, emissiveIntensity: 0.55, roughness: 0.35 });
var badge = new THREE.Mesh(new THREE.BoxGeometry(4.4, 4.4, 0.7),
  [badgeSide, badgeSide, badgeSide, badgeSide, badgeFace, badgeFace]);
badge.position.set(6.8, 1.6, -52);
scene.add(badge);
var badgeHalo = new THREE.Mesh(new THREE.PlaneGeometry(9, 9),
  new THREE.MeshBasicMaterial({ color: 0x5865F2, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
badgeHalo.position.copy(badge.position); badgeHalo.position.z -= 0.6;
scene.add(badgeHalo);

var progressBar = document.getElementById('progress-bar');
var fxCA = document.getElementById('fx-ca');
function scrollP() {
  var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  return Math.min(1, Math.max(0, window.scrollY / max));
}
function zoneProg(id, span) {
  var el = document.getElementById(id);
  if (!el) return 0;
  var r = el.getBoundingClientRect();
  var vh = window.innerHeight || 800;
  var center = r.top + r.height / 2;
  var d = Math.abs(vh / 2 - center) / (vh * (span || 0.75));
  return Math.min(1, Math.max(0, 1 - d));
}

var camWay = [
  { z: 12,  y: 1.2, bg: new THREE.Color(0x060606) },
  { z: -8,  y: 1.0, bg: new THREE.Color(0x0a0812) },
  { z: -24, y: 0.8, bg: new THREE.Color(0x0c0a18) },
  { z: -38, y: 1.0, bg: new THREE.Color(0x0a0a20) },
  { z: -44, y: 1.2, bg: new THREE.Color(0x060606) }
];
function lerp(a, b, k) { return a + (b - a) * k; }
function journey(p) {
  var seg = Math.min(camWay.length - 2, Math.floor(p * (camWay.length - 1)));
  var k = p * (camWay.length - 1) - seg;
  k = Math.min(1, Math.max(0, k));
  k = k * k * (3 - 2 * k);
  var A = camWay[seg], B = camWay[seg + 1];
  camera.position.z = lerp(A.z, B.z, k);
  camera.position.y = lerp(A.y, B.y, k);
  camera.position.x = Math.sin(p * Math.PI * 2) * 0.5;

  var bp = zoneProg('botcore', 0.9);
  var lookX = lerp(0, 3.4, bp);
  var lookY = lerp(0.6, 1.2, bp);
  var lookZ = lerp(-30, -46, bp);
  camera.lookAt(lookX, lookY, lookZ);
  scene.background.lerpColors(A.bg, B.bg, k);
  scene.fog.color.copy(scene.background);
}

var clock = new THREE.Clock();
var walkPhase = 0, lastY = window.scrollY, vel = 0, firstFrame = true;

function animate() {
  requestAnimationFrame(animate);
  var dt = Math.min(0.05, clock.getDelta());
  var time = clock.elapsedTime;
  var p = scrollP();
  var spd = reduce ? 0.3 : 1;

  var y = window.scrollY;
  var dy = y - lastY;
  vel = vel * 0.9 + Math.abs(dy) * 0.1;
  lastY = y;

  var ap = zoneProg('arena', 0.85);

  var bp = zoneProg('botcore', 0.9);

  if (fxCA) fxCA.style.opacity = Math.min(1, vel / 46).toFixed(2);
  journey(p);

  walkPhase += (dt * (0.25 + ap * 2.4) + Math.abs(dy) * 0.012) * spd;
  var w = Math.sin(walkPhase * 4.2);

  steve.position.y = -0.9 + Math.abs(Math.sin(walkPhase * 2.1)) * 0.3 * (0.25 + ap);
  steve.rotation.y = p * Math.PI * 2 + Math.sin(walkPhase * 0.7) * 0.08;
  if (steveModel) {
    steveModel.rotation.y = -0.2;
    steveModel.position.y = Math.abs(Math.sin(walkPhase * 2.1)) * 0.1 * (0.25 + ap);
  }
  if (fbRefs) {
    fbRefs.armR.rotation.x = -0.15 + w * 0.2;
    fbRefs.armL.rotation.x = w * (0.3 + ap * 0.5);
    fbRefs.legL.rotation.x = w * (0.3 + ap * 0.6);
    fbRefs.legR.rotation.x = -w * (0.3 + ap * 0.6);
  }
  for (var fi = 0; fi < floaters.length; fi++) {
    var f = floaters[fi];
    f.rotation.y += dt * f.userData.sp * spd;
    f.position.y = f.userData.y0 + Math.sin(time * 0.9 + f.userData.ph) * 0.5;
  }

  badge.rotation.y = p * Math.PI * 20 + time * 0.25 * spd;
  badge.rotation.x = Math.sin(time * 0.6) * 0.12;
  badge.position.y = 1.6 + Math.sin(time * 1.1) * 0.45;
  badgeHalo.position.y = badge.position.y;
  badgeHalo.material.opacity = 0.14 + bp * 0.25 + Math.sin(time * 2) * 0.04;
  var bs = 1 + bp * 0.12;
  badge.scale.set(bs, bs, 1);

  dust.rotation.y += dt * 0.008;
  warm.intensity = 1.0 + Math.sin(time * 1.4) * 0.15;

  if (progressBar) progressBar.style.width = (p * 100).toFixed(1) + '%';

  renderer.render(scene, camera);
  if (firstFrame) { firstFrame = false; window.__rb3d_ok = true; if (!steveGLB && !fbRefs) setLive('3D ● …', false); }
}
animate();

window.addEventListener('resize', function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
})();
