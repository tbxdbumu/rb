(function () {
  'use strict';

  function initMC3D() {
    var canvas = document.getElementById('mc-3d-canvas');
    if (!canvas) return;
    if (typeof THREE === 'undefined') {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      s.onload = function () { buildScene(canvas); };
      s.onerror = function () { showFallback(canvas); };
      document.head.appendChild(s);
    } else {
      buildScene(canvas);
    }
  }

  function showFallback(canvas) {
    if (!canvas || !canvas.parentNode) return;
    var fb = document.createElement('div');
    fb.className = 'mc-3d-fallback';
    fb.innerHTML = '<img src="images/steve.png" alt="Minecraft 3D" style="width:100px;height:auto;image-rendering:pixelated">';
    canvas.parentNode.replaceChild(fb, canvas);
  }

  function createSteveSkinCanvas() {

    var c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    var ctx = c.getContext('2d');

    ctx.fillStyle = '#c48a5c';
    ctx.fillRect(0, 0, 64, 64);

    var HAIR = '#442d17';
    var HAIR_LIGHT = '#5c3e21';
    var SKIN = '#c48a5c';
    var SKIN_SHADOW = '#a87248';
    var EYE_WHITE = '#ffffff';
    var EYE_PUPIL = '#2e3a8c';
    var NOSE = '#a3673f';
    var MOUTH = '#6e3823';
    var SHIRT = '#00a3a8';
    var SHIRT_DARK = '#00858a';
    var PANTS = '#293885';
    var PANTS_DARK = '#1f2b68';
    var SHOE = '#4a4a4a';

    ctx.fillStyle = HAIR;
    ctx.fillRect(8, 0, 8, 8);

    ctx.fillStyle = SKIN;
    ctx.fillRect(16, 0, 8, 8);

    ctx.fillStyle = HAIR;
    ctx.fillRect(0, 8, 8, 8);
    ctx.fillStyle = SKIN;
    ctx.fillRect(0, 12, 8, 4);

    ctx.fillStyle = SKIN;
    ctx.fillRect(8, 8, 8, 8);
    ctx.fillStyle = HAIR;
    ctx.fillRect(8, 8, 8, 3);
    ctx.fillRect(8, 11, 1, 1);
    ctx.fillRect(15, 11, 1, 1);

    ctx.fillStyle = EYE_WHITE;
    ctx.fillRect(9, 12, 2, 1);
    ctx.fillRect(13, 12, 2, 1);
    ctx.fillStyle = EYE_PUPIL;
    ctx.fillRect(10, 12, 1, 1);
    ctx.fillRect(13, 12, 1, 1);

    ctx.fillStyle = NOSE;
    ctx.fillRect(11, 13, 2, 1);

    ctx.fillStyle = MOUTH;
    ctx.fillRect(10, 14, 4, 1);

    ctx.fillStyle = HAIR;
    ctx.fillRect(16, 8, 8, 8);
    ctx.fillStyle = SKIN;
    ctx.fillRect(16, 12, 8, 4);

    ctx.fillStyle = HAIR;
    ctx.fillRect(24, 8, 8, 8);

    ctx.fillStyle = SHIRT;
    ctx.fillRect(20, 16, 8, 4);

    ctx.fillStyle = SHIRT;
    ctx.fillRect(28, 16, 8, 4);

    ctx.fillStyle = SHIRT;
    ctx.fillRect(20, 20, 8, 12);

    ctx.fillStyle = SKIN;
    ctx.fillRect(23, 20, 2, 3);

    ctx.fillStyle = SHIRT_DARK;
    ctx.fillRect(32, 20, 8, 12);

    ctx.fillStyle = SHIRT;
    ctx.fillRect(16, 20, 4, 12);
    ctx.fillRect(28, 20, 4, 12);

    ctx.fillStyle = SHIRT;
    ctx.fillRect(44, 16, 4, 4);

    ctx.fillStyle = SHIRT;
    ctx.fillRect(40, 20, 16, 4);
    ctx.fillStyle = SKIN;
    ctx.fillRect(40, 24, 16, 8);
    ctx.fillStyle = SKIN_SHADOW;
    ctx.fillRect(44, 28, 4, 4);

    ctx.fillStyle = SHIRT;
    ctx.fillRect(36, 48, 4, 4);
    ctx.fillRect(32, 52, 16, 4);
    ctx.fillStyle = SKIN;
    ctx.fillRect(32, 56, 16, 8);

    ctx.fillStyle = PANTS;
    ctx.fillRect(0, 16, 16, 12);
    ctx.fillStyle = SHOE;
    ctx.fillRect(0, 28, 16, 4);

    ctx.fillStyle = PANTS_DARK;
    ctx.fillRect(16, 48, 16, 12);
    ctx.fillStyle = SHOE;
    ctx.fillRect(16, 60, 16, 4);

    return c;
  }

  function makeCube(tex, u, v, w, h, d) {

    var geom = new THREE.BoxGeometry(w, h, d);
    var uvs = geom.attributes.uv;

    var cw = 64, ch = 64;

    function setFaceUV(faceIdx, x, y, fw, fh) {
      var u0 = x / cw;
      var v0 = 1 - (y + fh) / ch;
      var u1 = (x + fw) / cw;
      var v1 = 1 - y / ch;

      var base = faceIdx * 4;
      uvs.setXY(base + 0, u0, v1);
      uvs.setXY(base + 1, u1, v1);
      uvs.setXY(base + 2, u0, v0);
      uvs.setXY(base + 3, u1, v0);
    }

    setFaceUV(0, u, v + d, d, h);
    setFaceUV(1, u + d + w, v + d, d, h);
    setFaceUV(2, u + d, v, w, d);
    setFaceUV(3, u + d + w, v, w, d);
    setFaceUV(4, u + d, v + d, w, h);
    setFaceUV(5, u + d * 2 + w, v + d, w, h);

    geom.attributes.uv.needsUpdate = true;

    var mat = new THREE.MeshLambertMaterial({
      map: tex,
      transparent: false,
      alphaTest: 0.5
    });

    return new THREE.Mesh(geom, mat);
  }

  function buildScene(canvas) {
    var width = canvas.clientWidth || 140;
    var height = canvas.clientHeight || 180;

    var scene = new THREE.Scene();

    var camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
    camera.position.set(0, 6, 44);

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    var ambLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambLight);

    var dirLight1 = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight1.position.set(15, 25, 20);
    scene.add(dirLight1);

    var dirLight2 = new THREE.DirectionalLight(0x90b0ff, 0.4);
    dirLight2.position.set(-15, -10, -10);
    scene.add(dirLight2);

    var skinCanvas = createSteveSkinCanvas();
    var skinTexture = new THREE.CanvasTexture(skinCanvas);
    skinTexture.magFilter = THREE.NearestFilter;
    skinTexture.minFilter = THREE.NearestFilter;
    skinTexture.generateMipmaps = false;

    var charGroup = new THREE.Group();
    scene.add(charGroup);

    var headMesh = makeCube(skinTexture, 0, 0, 8, 8, 8);
    headMesh.position.set(0, 4, 0);
    var headGroup = new THREE.Group();
    headGroup.position.set(0, 10, 0);
    headGroup.add(headMesh);
    charGroup.add(headGroup);

    var torsoMesh = makeCube(skinTexture, 16, 16, 8, 12, 4);
    torsoMesh.position.set(0, 4, 0);
    charGroup.add(torsoMesh);

    var rArmMesh = makeCube(skinTexture, 40, 16, 4, 12, 4);
    rArmMesh.position.set(0, -4, 0);
    var rArmGroup = new THREE.Group();
    rArmGroup.position.set(-6, 8, 0);
    rArmGroup.add(rArmMesh);
    charGroup.add(rArmGroup);

    var lArmMesh = makeCube(skinTexture, 32, 48, 4, 12, 4);
    lArmMesh.position.set(0, -4, 0);
    var lArmGroup = new THREE.Group();
    lArmGroup.position.set(6, 8, 0);
    lArmGroup.add(lArmMesh);
    charGroup.add(lArmGroup);

    var rLegMesh = makeCube(skinTexture, 0, 16, 4, 12, 4);
    rLegMesh.position.set(0, -6, 0);
    var rLegGroup = new THREE.Group();
    rLegGroup.position.set(-2, -2, 0);
    rLegGroup.add(rLegMesh);
    charGroup.add(rLegGroup);

    var lLegMesh = makeCube(skinTexture, 16, 48, 4, 12, 4);
    lLegMesh.position.set(0, -6, 0);
    var lLegGroup = new THREE.Group();
    lLegGroup.position.set(2, -2, 0);
    lLegGroup.add(lLegMesh);
    charGroup.add(lLegGroup);

    charGroup.rotation.y = 0.42;
    charGroup.position.y = -2;

    var mouseX = 0, mouseY = 0;
    var targetRotY = 0.42, targetRotX = 0;
    var isHovered = false;

    canvas.addEventListener('mouseenter', function () { isHovered = true; });
    canvas.addEventListener('mouseleave', function () {
      isHovered = false;
      targetRotY = 0.42; targetRotX = 0;
    });

    window.addEventListener('mousemove', function (e) {
      var rect = canvas.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var dx = (e.clientX - cx) / window.innerWidth;
      var dy = (e.clientY - cy) / window.innerHeight;

      if (isHovered) {
        targetRotY = 0.42 + dx * 2.2;
        targetRotX = dy * 0.8;
      } else {
        targetRotY = 0.42 + dx * 0.7;
        targetRotX = dy * 0.3;
      }
    }, { passive: true });

    canvas.addEventListener('click', function () {
      var start = performance.now();
      var initY = charGroup.rotation.y;
      function spin(now) {
        var elapsed = (now - start) / 600;
        if (elapsed < 1) {
          charGroup.rotation.y = initY + Math.PI * 2 * Math.sin((elapsed * Math.PI) / 2);
          requestAnimationFrame(spin);
        } else {
          charGroup.rotation.y = initY + Math.PI * 2;
        }
      }
      requestAnimationFrame(spin);
    });

    var clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      var t = clock.getElapsedTime();

      charGroup.rotation.y += (targetRotY - charGroup.rotation.y) * 0.08;
      charGroup.rotation.x += (targetRotX - charGroup.rotation.x) * 0.08;

      var swing = Math.sin(t * 2.4) * 0.22;
      rArmGroup.rotation.x = swing;
      lArmGroup.rotation.x = -swing;
      rLegGroup.rotation.x = -swing * 0.7;
      lLegGroup.rotation.x = swing * 0.7;

      charGroup.position.y = -2 + Math.sin(t * 1.8) * 0.4;
      headGroup.rotation.y = Math.sin(t * 1.4) * 0.08;

      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', function () {
      var w = canvas.clientWidth || 140;
      var h = canvas.clientHeight || 180;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMC3D);
  } else {
    initMC3D();
  }
})();
