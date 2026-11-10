/* =========================================================
   立人闯关 · MVP
   纯原生 JS，无依赖，离线可跑
   ========================================================= */
(() => {
  'use strict';

  const D = window.CLASS_DATA || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const stage = $('#stage');
  const wipeEl = $('#wipe');
  const screens = $$('.screen');
  const dotsEl = $('#dots');

  /* ---------------- 舞台缩放 ---------------- */
  function fitStage() {
    const s = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  window.addEventListener('resize', fitStage);
  fitStage();

  /* ---------------- 伪随机 ---------------- */
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------- 1-bit 像素文字 ---------------- */
  const textCache = new Map();

  function pixelText(text, opt = {}) {
    const {
      size = 20, scale = 4, color = '#efe9d9',
      weight = 700, spacing = 0, threshold = 96,
      family = '"Microsoft YaHei", "PingFang SC", sans-serif'
    } = opt;
    const key = [text, size, scale, color, weight, spacing, threshold, family].join('|');
    function scaleUp(src) {
      const c = document.createElement('canvas');
      c.width = src.width * scale;
      c.height = src.height * scale;
      const cg = c.getContext('2d');
      cg.imageSmoothingEnabled = false;
      cg.drawImage(src, 0, 0, c.width, c.height);
      c.style.width = c.width + 'px';
      c.style.height = c.height + 'px';
      c.style.display = 'block';
      return c;
    }

    const hit = textCache.get(key);
    if (hit) return scaleUp(hit);

    const off = document.createElement('canvas');
    let g = off.getContext('2d');
    const font = `${weight} ${size}px ${family}`;
    g.font = font;
    if ('letterSpacing' in g) g.letterSpacing = spacing + 'px';

    const w = Math.max(1, Math.ceil(g.measureText(text).width) + 2);
    const h = Math.ceil(size * 1.4);
    off.width = w; off.height = h;

    g = off.getContext('2d');
    g.font = font;
    if ('letterSpacing' in g) g.letterSpacing = spacing + 'px';
    g.textBaseline = 'middle';
    g.fillStyle = '#fff';
    g.fillText(text, 1, h / 2 + Math.round(size * 0.04));

    // 二值化：只留纯色像素，去掉抗锯齿灰边
    const img = g.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > threshold) { d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = 255; }
      else { d[i + 3] = 0; }
    }
    g.putImageData(img, 0, 0);

    // 上色
    const tint = document.createElement('canvas');
    tint.width = w; tint.height = h;
    const tg = tint.getContext('2d');
    tg.drawImage(off, 0, 0);
    tg.globalCompositeOperation = 'source-in';
    tg.fillStyle = color;
    tg.fillRect(0, 0, w, h);

    textCache.set(key, tint);
    return scaleUp(tint);
  }

  function setPixelText(el, text, opt) {
    if (!el) return;
    el.innerHTML = '';
    el.appendChild(pixelText(text, opt));
  }

  /* ---------------- 徽章位图 ---------------- */
  const CREST = [
    '..1111111111..',
    '.1..........1.',
    '.1.22222222.1.',
    '.1.22222222.1.',
    '.1.22233222.1.',
    '.1.22333322.1.',
    '.1.22333322.1.',
    '.1.22233222.1.',
    '.1.22222222.1.',
    '.1.22222222.1.',
    '..1.222222.1..',
    '...1.2222.1...',
    '....1.22.1....',
    '.....1..1.....',
    '......11......',
    '..............'
  ];

  function drawCrest(canvas, unit = 7) {
    const w = 14, h = 16;
    canvas.width = w * unit;
    canvas.height = h * unit;
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    const pal = { 1: '#f2c14e', 2: '#0d1630', 3: '#7fc8c9' };
    CREST.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === '.') return;
        g.fillStyle = pal[ch];
        g.fillRect(x * unit, y * unit, unit, unit);
      });
    });
    canvas.style.width = (w * unit) + 'px';
    canvas.style.height = (h * unit) + 'px';
    canvas.style.imageRendering = 'pixelated';
  }

  /* ---------------- 星空 ---------------- */
  const starsCanvas = $('#stars');
  const starsCtx = starsCanvas.getContext('2d');
  const stars = Array.from({ length: 120 }, () => ({
    x: Math.random() * 1600,
    y: Math.random() * 620,
    s: Math.random() < 0.85 ? 2 : 4,
    p: Math.random() * Math.PI * 2,
    v: 0.4 + Math.random() * 1.4
  }));

  function drawStars(t) {
    const g = starsCtx;
    g.clearRect(0, 0, 1600, 900);
    const sky = g.createLinearGradient(0, 0, 0, 900);
    sky.addColorStop(0, '#05070f');
    sky.addColorStop(0.55, '#0b1026');
    sky.addColorStop(1, '#141a33');
    g.fillStyle = sky;
    g.fillRect(0, 0, 1600, 900);

    for (const st of stars) {
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.001 * st.v + st.p));
      g.globalAlpha = a;
      g.fillStyle = st.s === 2 ? '#efe9d9' : '#7fc8c9';
      g.fillRect(st.x, st.y, st.s, st.s);
    }
    g.globalAlpha = 1;
  }

  /* ---------------- 关卡世界 ---------------- */
  const worldCanvas = $('#world');
  const wg = worldCanvas.getContext('2d');
  const U = 4;
  let layers = null;

  const COL = {
    far: '#182246',
    mid: '#0d1529',
    near: '#070b18',
    ground: '#0a0714',
    groundTop: '#141026',
    path: '#1a142e',
    gold: '#f2c14e',
    cyan: '#7fc8c9'
  };

  function makeMountains() {
    const c = document.createElement('canvas');
    c.width = 1600; c.height = 260;
    const g = c.getContext('2d');
    g.fillStyle = COL.far;
    g.beginPath();
    g.moveTo(0, 260);
    for (let x = 0; x <= 1600; x += 8) {
      const k = (Math.PI * 2 * x) / 1600;
      const h = 118
        + 58 * Math.sin(k * 3)
        + 26 * Math.sin(k * 7 + 1.1)
        + 12 * Math.sin(k * 13 + 2.3);
      g.lineTo(x, 260 - h);
    }
    g.lineTo(1600, 260);
    g.closePath();
    g.fill();
    return c;
  }

  function makeBuildings() {
    const period = 800;
    const c = document.createElement('canvas');
    c.width = period; c.height = 300;
    const g = c.getContext('2d');
    const rnd = mulberry32(20261110);
    let x = -30;
    while (x < period) {
      const w = 46 + Math.floor(rnd() * 52);
      const h = 78 + Math.floor(rnd() * 150);
      const top = 300 - h;
      g.fillStyle = COL.mid;
      g.fillRect(x, top, w, h);
      // 楼顶小结构
      if (rnd() > 0.6) {
        g.fillRect(x + w * 0.35, top - 12, 10, 12);
        g.fillStyle = COL.gold;
        g.globalAlpha = 0.5;
        g.fillRect(x + w * 0.35 + 3, top - 12, 4, 4);
        g.globalAlpha = 1;
      }
      // 窗户
      g.fillStyle = COL.gold;
      for (let wy = top + 14; wy < 292; wy += 18) {
        for (let wx = x + 9; wx < x + w - 9; wx += 15) {
          if (rnd() > 0.42) {
            g.globalAlpha = 0.25 + rnd() * 0.55;
            g.fillRect(wx, wy, 6, 7);
          }
        }
      }
      g.globalAlpha = 1;
      x += w + 8 + Math.floor(rnd() * 14);
    }
    return c;
  }

  function makeTrees() {
    const period = 800;
    const c = document.createElement('canvas');
    c.width = period; c.height = 120;
    const g = c.getContext('2d');
    const rnd = mulberry32(9911);
    g.fillStyle = COL.near;
    for (let x = 10; x < period; x += 38 + rnd() * 34) {
      const h = 34 + rnd() * 62;
      const w = 16 + rnd() * 16;
      g.beginPath();
      g.moveTo(x, 120);
      g.lineTo(x + w / 2, 120 - h);
      g.lineTo(x + w, 120);
      g.closePath();
      g.fill();
    }
    return c;
  }

  function buildLayers() {
    layers = {
      mtn: makeMountains(),
      bld: makeBuildings(),
      tre: makeTrees()
    };
  }

  const SPRITE = [
    ['..HHHH..', '.HHHHHH.', '.HSSSSH.', '.SSSSSS.', '.SE..ES.', '..SSSS..',
      '..BBBB..', '.BBBBBB.', '.BBBBBB.', '..B..B..', '..L..L..', '.LL..LL.'],
    ['..HHHH..', '.HHHHHH.', '.HSSSSH.', '.SSSSSS.', '.SE..ES.', '..SSSS..',
      '..BBBB..', '.BBBBBB.', '.BBBBBB.', '..B..B..', '.L..L...', 'LL..LL..']
  ];
  const SPRITE_PAL = { H: '#1b1430', S: '#f0c090', E: '#101426', B: '#7fc8c9', L: '#2a3350' };

  function drawSprite(g, frame, x, y, cell) {
    const map = SPRITE[frame % SPRITE.length];
    map.forEach((row, ry) => {
      [...row].forEach((ch, rx) => {
        if (ch === '.') return;
        g.fillStyle = SPRITE_PAL[ch] || '#fff';
        g.fillRect(x + rx * cell, y + ry * cell, cell, cell);
      });
    });
    // 鞋子高光
    g.fillStyle = COL.gold;
    g.fillRect(x + 2 * cell, y + 11 * cell, cell, cell);
    g.fillRect(x + 6 * cell, y + 11 * cell, cell, cell);
  }

  let worldX = 0, lastT = 0, coinT = 0;

  function drawWorld(t) {
    if (!layers) buildLayers();
    const dt = Math.min(50, t - lastT) || 16;
    lastT = t;
    worldX += dt * 0.032;
    coinT = t;

    const g = wg;

    // 天空
    const sky = g.createLinearGradient(0, 0, 0, 760);
    sky.addColorStop(0, '#070b1c');
    sky.addColorStop(0.45, '#131b39');
    sky.addColorStop(0.78, '#24365c');
    sky.addColorStop(1, '#3a5578');
    g.fillStyle = sky;
    g.fillRect(0, 0, 1600, 900);

    // 星
    g.fillStyle = '#efe9d9';
    for (let i = 0; i < 70; i++) {
      const sx = (i * 197 + 37) % 1600;
      const sy = (i * 89) % 420;
      const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.0012 + i));
      g.globalAlpha = a;
      g.fillRect(sx, sy, 2, 2);
    }
    g.globalAlpha = 1;

    // 像素云
    const clouds = [
      { y: 120, bx: 120, sc: 1.0, sp: 0.030, a: 0.05 },
      { y: 208, bx: 640, sc: 1.5, sp: 0.019, a: 0.042 },
      { y: 300, bx: 1180, sc: 0.8, sp: 0.046, a: 0.035 },
      { y: 372, bx: 320, sc: 1.2, sp: 0.024, a: 0.028 }
    ];
    clouds.forEach(c => {
      const w = 160 * c.sc;
      const x = ((c.bx - worldX * c.sp) % 1900 + 1900) % 1900 - 160;
      g.fillStyle = `rgba(200, 214, 240, ${c.a})`;
      g.fillRect(x, c.y, w, 16 * c.sc);
      g.fillRect(x + 24 * c.sc, c.y - 14 * c.sc, w * 0.55, 16 * c.sc);
      g.fillRect(x + w * 0.6, c.y - 8 * c.sc, w * 0.3, 14 * c.sc);
    });

    // 地平线微光
    const glow = g.createLinearGradient(0, 560, 0, 660);
    glow.addColorStop(0, 'rgba(127,200,201,0)');
    glow.addColorStop(1, 'rgba(127,200,201,0.10)');
    g.fillStyle = glow;
    g.fillRect(0, 560, 1600, 100);

    // 月亮（像素圆）
    g.fillStyle = '#e8e3cc';
    const mx = 1290, my = 148, mr = 46;
    g.beginPath();
    g.arc(mx, my, mr, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#cfc9af';
    g.fillRect(mx - 22, my - 14, 18, 14);
    g.fillRect(mx + 6, my + 8, 14, 12);
    g.fillRect(mx - 6, my + 20, 10, 8);

    // 山
    const offM = -(worldX * 0.1) % 1600;
    g.drawImage(layers.mtn, offM, 470);
    g.drawImage(layers.mtn, offM + 1600, 470);

    // 楼
    const offB = -(worldX * 0.34) % 800;
    g.drawImage(layers.bld, offB, 560);
    g.drawImage(layers.bld, offB + 800, 560);
    g.drawImage(layers.bld, offB + 1600, 560);

    // 树
    const offT = -(worldX * 0.66) % 800;
    g.drawImage(layers.tre, offT, 690);
    g.drawImage(layers.tre, offT + 800, 690);
    g.drawImage(layers.tre, offT + 1600, 690);

    // 地面
    g.fillStyle = COL.ground;
    g.fillRect(0, 800, 1600, 100);
    g.fillStyle = COL.groundTop;
    g.fillRect(0, 800, 1600, 10);

    // 地砖
    g.fillStyle = 'rgba(127,200,201,0.10)';
    const offG = -(worldX) % 64;
    for (let x = offG - 64; x < 1600; x += 64) {
      g.fillRect(x, 812, 30, 3);
    }

    // 路面
    g.fillStyle = COL.path;
    g.fillRect(0, 786, 1600, 16);
    g.fillStyle = 'rgba(242,193,78,0.35)';
    const offR = -(worldX * 1.05) % 180;
    for (let x = offR - 180; x < 1600; x += 180) {
      g.fillRect(x, 792, 54, 4);
    }

    // 金币
    const coins = [1250, 1350, 1450, 1550];
    coins.forEach((cx, i) => {
      const bob = Math.sin(t * 0.003 + i * 1.1) * 9;
      const y = 650 + bob;
      g.fillStyle = 'rgba(242,193,78,0.10)';
      g.fillRect(cx - 20, y - 26, 40, 52);
      g.fillStyle = COL.gold;
      g.fillRect(cx - 9, y - 15, 18, 30);
      g.fillStyle = '#fff3c4';
      g.fillRect(cx - 4, y - 15, 5, 30);
      g.fillStyle = 'rgba(120,80,0,0.25)';
      g.fillRect(cx + 4, y - 15, 3, 30);
    });

    // 尘土
    for (let i = 0; i < 4; i++) {
      const ph = ((t * 0.0006 + i * 0.27) % 1);
      const dx = 1090 - ph * 120;
      const dy = 792 - ph * 26;
      g.globalAlpha = (1 - ph) * 0.45;
      g.fillStyle = '#8f8aa8';
      g.fillRect(dx, dy, 8 - i, 8 - i);
    }
    g.globalAlpha = 1;

    // 角色
    const bob = Math.sin(t * 0.012) * 3;
    const frame = Math.floor(t / 130) % 2;
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(1096, 792, 62, 9);
    drawSprite(g, frame, 1086, 692 + bob, 9);

    // 前景草丛
    g.fillStyle = '#04030a';
    const goff = -(worldX * 1.25) % 160;
    for (let x = goff - 160; x < 1600; x += 160) {
      const seed = Math.abs(Math.round(x / 160));
      const hh = 14 + (seed * 37 % 26);
      g.fillRect(x, 900 - hh, 16, hh);
      g.fillRect(x + 22, 900 - hh - 10, 10, hh + 10);
      g.fillRect(x + 40, 900 - hh + 6, 22, hh - 6);
      g.fillRect(x + 70, 900 - hh - 4, 8, hh + 4);
      g.fillRect(x + 84, 900 - hh + 10, 30, hh - 10);
    }
  }

  /* ---------------- 路由 ---------------- */
  let current = -1;
  let busy = false;

  function buildDots() {
    screens.forEach((_, i) => {
      const b = document.createElement('button');
      b.addEventListener('click', () => go(i));
      dotsEl.appendChild(b);
    });
  }

  function syncDots() {
    $$('#dots button').forEach((b, i) => b.classList.toggle('on', i === current));
  }

  function applyScreen(n) {
    screens.forEach((s, i) => s.classList.toggle('active', i === n));
    current = n;
    syncDots();
    onEnter(n);
  }

  function go(n, instant = false) {
    n = clamp(n, 0, screens.length - 1);
    if (busy || n === current) return;
    if (instant) { applyScreen(n); return; }
    busy = true;
    const cells = [...wipeEl.children];
    cells.forEach((c, i) => {
      const col = i % 16, row = (i / 16) | 0;
      c.style.transitionDelay = (col * 20 + row * 6) + 'ms';
      c.style.transform = 'scale(1)';
    });
    setTimeout(() => {
      applyScreen(n);
      cells.forEach((c, i) => {
        const col = i % 16, row = (i / 16) | 0;
        c.style.transitionDelay = (60 + col * 20 + row * 6) + 'ms';
        c.style.transform = 'scale(0)';
      });
      setTimeout(() => { busy = false; }, 520);
    }, 430);
  }

  function onEnter(n) {
    if (n === 1) {
      const rate = Math.round((D.avgRate || 0) * 1000) / 10;
      const fill = $('#xpFill');
      fill.style.width = '0%';
      setTimeout(() => { fill.style.width = rate + '%'; }, 260);
      $('#xpNum').textContent = `出勤率 ${rate}%`;
      $('#coinEvents').textContent = String(D.events || 0).padStart(2, '0');
      $('#coinGroups').textContent = String(D.groups || 0).padStart(2, '0');
      const card = $('#levelCard');
      card.classList.remove('show');
      setTimeout(() => card.classList.add('show'), 300);
    }
    if (n === 2) {
      $$('.badge').forEach((b, i) => {
        b.style.opacity = '0';
        b.style.transform = 'translateY(14px)';
        setTimeout(() => {
          b.style.transition = 'opacity .4s, transform .4s';
          b.style.opacity = b.classList.contains('locked') ? '0.4' : '1';
          b.style.transform = 'translateY(0)';
        }, 80 + i * 70);
      });
    }
  }

  /* ---------------- 初始化各屏 ---------------- */
  function initBoot() {
    drawCrest($('#crest'), 7);
    setPixelText($('#bootTitle'), '立人十五班', {
      size: 21, scale: 4, color: '#efe9d9', spacing: 6, weight: 700
    });
    $('#metaMembers').textContent = 'MEMBERS ' + String(D.members || 0).padStart(2, '0');
    $('#metaEvents').textContent = 'EVENTS ' + String(D.events || 0).padStart(2, '0');
  }

  function initLevel() {
    const act = (D.activities && D.activities[0]) || {};
    $('#cardTag').textContent = act.tag || 'WORLD 1-1';
    $('#cardTitle').textContent = act.name || '破译电波';
    $('#cardSub').textContent = act.sub || '七秩风华 · 立人新程';
    $('#cardQuote').textContent = '「我们在一道道电波里，重新认得成电的七秩。」';
    $('#cardStats').innerHTML = [
      ['40', 'MINUTES'],
      ['05', 'GROUPS'],
      ['26', 'MORSE LETTERS']
    ].map(([n, l]) => `<div class="card-stat"><b>${n}</b><span>${l}</span></div>`).join('');
  }

  /* -------- 图标（16×16 位图绘制后放大） -------- */
  function iconCanvas(type, color = '#f2c14e') {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const g = c.getContext('2d');
    g.fillStyle = color;
    const r = (x, y, w, h) => g.fillRect(x, y, w, h);
    switch (type) {
      case 'check':
        r(3, 8, 3, 3); r(5, 10, 3, 3); r(7, 8, 3, 3); r(9, 6, 3, 3); r(11, 4, 3, 3);
        break;
      case 'star':
        r(7, 1, 2, 4); r(6, 5, 4, 2); r(4, 7, 8, 2);
        r(5, 9, 2, 2); r(9, 9, 2, 2); r(4, 11, 2, 3); r(10, 11, 2, 3);
        break;
      case 'users':
        r(2, 4, 4, 4); r(10, 4, 4, 4); r(6, 3, 4, 4);
        r(1, 10, 6, 4); r(9, 10, 6, 4); r(5, 9, 6, 5);
        break;
      case 'wave':
        r(1, 7, 2, 2); r(3, 5, 2, 6); r(5, 3, 2, 10); r(7, 5, 2, 6);
        r(9, 3, 2, 10); r(11, 5, 2, 6); r(13, 7, 2, 2);
        break;
      case 'calendar':
        r(1, 3, 14, 2); r(1, 5, 14, 10);
        g.fillStyle = '#0b1026';
        r(2, 7, 3, 3); r(6, 7, 3, 3); r(10, 7, 3, 3);
        r(2, 11, 3, 3); r(6, 11, 3, 3);
        break;
      case 'pen':
        r(3, 10, 3, 3); r(5, 7, 3, 3); r(7, 4, 3, 3); r(9, 1, 3, 3);
        r(2, 13, 4, 2);
        break;
      default:
        r(4, 4, 8, 8);
    }
    const out = document.createElement('canvas');
    out.width = 64; out.height = 64;
    const og = out.getContext('2d');
    og.imageSmoothingEnabled = false;
    og.drawImage(c, 0, 0, 64, 64);
    out.style.width = '56px';
    out.style.height = '56px';
    out.style.imageRendering = 'pixelated';
    return out;
  }

  const ACHIEVEMENTS = [
    { icon: 'check', name: '全员到齐', desc: '11 次考勤，一次不落', state: 'UNLOCKED', unlocked: true },
    { icon: 'star', name: '优秀四席', desc: '量化考核评为「优秀」', state: 'UNLOCKED', unlocked: true },
    { icon: 'users', name: '五路并进', desc: '五个小组，各司其职', state: 'UNLOCKED', unlocked: true },
    { icon: 'wave', name: '电波破译者', desc: '七秩风华 · 立人新程', state: 'UNLOCKED', unlocked: true },
    { icon: 'calendar', name: '十二连击', desc: '一年十二次活动全勤', state: 'UNLOCKED', unlocked: true },
    { icon: 'pen', name: '一个都不能少', desc: '答辩当天，全员签名', state: 'LOCKED', unlocked: false }
  ];

  function initAchv() {
    setPixelText($('#achvTitle'), '成就墙', { size: 28, scale: 3, color: '#efe9d9', spacing: 10 });
    $('#achvTotal').textContent = ACHIEVEMENTS.length;
    const grid = $('#achvGrid');
    grid.innerHTML = '';
    ACHIEVEMENTS.forEach(a => {
      const el = document.createElement('div');
      el.className = 'badge ' + (a.unlocked ? 'unlocked' : 'locked');
      el.innerHTML = `
        <div class="badge-icon"></div>
        <div class="badge-body">
          <div class="badge-name">${a.unlocked ? a.name : '???'}</div>
          <div class="badge-desc">${a.desc}</div>
        </div>
        <div class="badge-state">${a.state}</div>`;
      el.querySelector('.badge-icon').appendChild(iconCanvas(a.icon, a.unlocked ? '#f2c14e' : '#6b7592'));
      grid.appendChild(el);
    });
    $('#achvCount').textContent = ACHIEVEMENTS.filter(a => a.unlocked).length;

    buildRoster();
  }

  /* -------- 像素头像 -------- */
  function avatarCanvas(seed) {
    const rnd = mulberry32(hashStr(seed));
    const skins = ['#f2c9a0', '#e8b98a', '#d9a373', '#f7d9b6', '#c98f66'];
    const hairs = ['#1b1430', '#2a1b3d', '#3a2a1a', '#4a1f2a', '#1f2a3a', '#5a3b22'];
    const shirts = ['#7fc8c9', '#f2c14e', '#e05a4f', '#7ec96f', '#9b8cff', '#4aa3e0', '#d98cb3'];
    const bgs = ['#111a33', '#141d2e', '#171427', '#0f1b2b'];

    const c = document.createElement('canvas');
    c.width = 12; c.height = 12;
    const g = c.getContext('2d');
    const hair = hairs[(rnd() * hairs.length) | 0];
    const skin = skins[(rnd() * skins.length) | 0];
    const shirt = shirts[(rnd() * shirts.length) | 0];
    const bg = bgs[(rnd() * bgs.length) | 0];
    const style = (rnd() * 3) | 0;

    g.fillStyle = bg;
    g.fillRect(0, 0, 12, 12);

    // 头发
    g.fillStyle = hair;
    g.fillRect(2, 1, 8, 2);
    g.fillRect(1, 2, 10, 1);
    if (style === 0) { g.fillRect(1, 3, 2, 4); g.fillRect(9, 3, 2, 4); }
    if (style === 1) { g.fillRect(1, 2, 1, 5); g.fillRect(10, 2, 1, 5); }
    if (style === 2) { g.fillRect(0, 2, 12, 1); g.fillRect(0, 3, 1, 3); g.fillRect(11, 3, 1, 3); }

    // 脸
    g.fillStyle = skin;
    g.fillRect(2, 3, 8, 6);

    // 眼
    g.fillStyle = '#101426';
    g.fillRect(3, 5, 2, 1);
    g.fillRect(7, 5, 2, 1);

    // 嘴
    g.fillStyle = 'rgba(120,60,50,0.75)';
    g.fillRect(5, 7, 2, 1);

    // 衣服
    g.fillStyle = shirt;
    g.fillRect(1, 9, 10, 3);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(1, 11, 10, 1);

    return c;
  }

  const PEOPLE = (() => {
    const list = (D.people || []).map(p => ({
      name: p.name, rate: p.rate, grade: p.grade, score: p.score
    }));
    (D.extraMembers || []).forEach(n => list.push({ name: n, rate: null, grade: '—', score: null }));
    return list;
  })();

  function buildRoster() {
    const wrap = $('#roster');
    wrap.innerHTML = '';
    PEOPLE.forEach(p => {
      const d = document.createElement('div');
      d.className = 'avatar';
      const cv = avatarCanvas(p.name);
      d.appendChild(cv);
      const rate = p.rate == null ? '暂无记录' : `出勤 ${(p.rate * 100).toFixed(0)}%`;
      const grade = p.rate == null ? '' : ` · ${p.grade}`;
      const tip = document.createElement('div');
      tip.className = 'tip';
      tip.innerHTML = `<b>${p.name}</b> ${rate}${grade}`;
      d.appendChild(tip);
      wrap.appendChild(d);
    });
  }

  function initClear() {
    setPixelText($('#clearTitle'), 'GAME CLEAR', {
      size: 22, scale: 4, color: '#f2c14e', spacing: 6, weight: 700
    });
    $('#clearStats').innerHTML = [
      [D.members || 0, '成员 MEMBERS'],
      [D.events || 0, '活动 EVENTS'],
      [D.groups || 0, '小组 GROUPS'],
      [Math.round((D.avgRate || 0) * 100) + '%', '平均出勤 RATE']
    ].map(([n, l]) => `<div class="clear-stat"><b>${n}</b><span>${l}</span></div>`).join('');
  }

  /* ---------------- 签名墙 ---------------- */
  const pad = $('#sigpad');
  const pctx = pad.getContext('2d');
  let strokes = [];
  let drawing = false;
  let curStroke = null;
  let replaying = false;

  function clearPad(hint = true) {
    pctx.clearRect(0, 0, pad.width, pad.height);
    // 淡格线
    pctx.strokeStyle = 'rgba(239,233,217,0.06)';
    pctx.lineWidth = 2;
    for (let x = 100; x < pad.width; x += 100) {
      pctx.beginPath(); pctx.moveTo(x, 0); pctx.lineTo(x, pad.height); pctx.stroke();
    }
    for (let y = 100; y < pad.height; y += 100) {
      pctx.beginPath(); pctx.moveTo(0, y); pctx.lineTo(pad.width, y); pctx.stroke();
    }
    if (hint) {
      pctx.save();
      pctx.fillStyle = 'rgba(239,233,217,0.16)';
      pctx.font = '600 46px "Microsoft YaHei", sans-serif';
      pctx.textAlign = 'center';
      pctx.textBaseline = 'middle';
      pctx.fillText('在 这 里 签 名', pad.width / 2, pad.height / 2);
      pctx.restore();
    }
  }

  function padPos(e) {
    const r = pad.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width * pad.width,
      y: (e.clientY - r.top) / r.height * pad.height
    };
  }

  function drawStroke(st, upTo = Infinity) {
    if (!st.pts.length) return;
    pctx.strokeStyle = '#f2c14e';
    pctx.lineWidth = 7;
    pctx.lineCap = 'round';
    pctx.lineJoin = 'round';
    pctx.beginPath();
    const n = Math.min(upTo, st.pts.length);
    pctx.moveTo(st.pts[0].x, st.pts[0].y);
    for (let i = 1; i < n; i++) pctx.lineTo(st.pts[i].x, st.pts[i].y);
    if (n === 1) pctx.lineTo(st.pts[0].x + 0.1, st.pts[0].y + 0.1);
    pctx.stroke();
  }

  pad.addEventListener('pointerdown', e => {
    if (replaying) return;
    try { pad.setPointerCapture(e.pointerId); } catch (_) { /* 合成事件可能不支持 */ }
    drawing = true;
    curStroke = { pts: [padPos(e)] };
    strokes.push(curStroke);
    clearPad(false);
    strokes.forEach(s => drawStroke(s));
  });

  pad.addEventListener('pointermove', e => {
    if (!drawing || replaying) return;
    const p = padPos(e);
    const last = curStroke.pts[curStroke.pts.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) < 2.5) return;
    curStroke.pts.push(p);
    drawStroke(curStroke, curStroke.pts.length);
  });

  const endStroke = () => { drawing = false; curStroke = null; };
  pad.addEventListener('pointerup', endStroke);
  pad.addEventListener('pointercancel', endStroke);
  pad.addEventListener('pointerleave', endStroke);

  $('#btnClear').addEventListener('click', () => {
    if (replaying) return;
    strokes = [];
    clearPad();
  });

  $('#btnReplay').addEventListener('click', () => {
    if (replaying || !strokes.length) return;
    replaying = true;
    clearPad(false);
    const total = strokes.reduce((a, s) => a + s.pts.length, 0);
    const dur = clamp(total * 12, 900, 4200);
    const start = performance.now();

    const step = now => {
      const p = clamp((now - start) / dur, 0, 1);
      const quota = Math.floor(p * total);
      clearPad(false);
      let acc = 0;
      for (const s of strokes) {
        if (acc >= quota) break;
        const take = Math.min(s.pts.length, quota - acc);
        drawStroke(s, take);
        acc += s.pts.length;
      }
      if (p < 1) requestAnimationFrame(step);
      else { replaying = false; strokes.forEach(s => drawStroke(s)); }
    };
    requestAnimationFrame(step);
  });

  $('#btnSave').addEventListener('click', () => {
    const out = document.createElement('canvas');
    out.width = pad.width; out.height = pad.height;
    const g = out.getContext('2d');
    g.fillStyle = '#05070f';
    g.fillRect(0, 0, out.width, out.height);
    g.drawImage(pad, 0, 0);
    g.fillStyle = '#f2c14e';
    g.font = '600 34px "Microsoft YaHei", sans-serif';
    g.textAlign = 'right';
    g.fillText('立人十五班 · 2026', out.width - 40, out.height - 30);
    const a = document.createElement('a');
    a.download = '立人十五班_签名墙.png';
    a.href = out.toDataURL('image/png');
    a.click();
  });

  /* ---------------- 键盘 / 自动 ---------------- */
  let autoTimer = null;

  function toggleAuto() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
      $('.hint').innerHTML = '<b>←</b> <b>→</b> 切换 &nbsp;·&nbsp; <b>空格</b> 自动演示';
      return;
    }
    $('.hint').innerHTML = '<b>AUTO</b> 自动演示中 &nbsp;·&nbsp; <b>空格</b> 停止';
    autoTimer = setInterval(() => {
      const next = (current + 1) % screens.length;
      go(next);
    }, 7000);
  }

  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
      e.preventDefault();
      if (e.key === ' ') toggleAuto();
      else go(current + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      go(current - 1);
    } else if (e.key === 'Home') {
      go(0);
    }
  });

  /* ---------------- 启动 ---------------- */
  function boot() {
    for (let i = 0; i < 144; i++) wipeEl.appendChild(document.createElement('i'));
    buildDots();
    initBoot();
    initLevel();
    initAchv();
    initClear();
    clearPad();
    applyScreen(0);
    syncDots();

    const loop = t => {
      if (current === 0) drawStars(t);
      if (current === 1) drawWorld(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    // 点击空白处前进
    stage.addEventListener('click', e => {
      if (e.target.closest('button, .avatar, #sigpad, .dots')) return;
      if (current === 0) go(1);
    });

    // 手机左右滑动翻屏
    let tsX = 0, tsY = 0, tsTarget = null;
    stage.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      tsX = e.touches[0].clientX;
      tsY = e.touches[0].clientY;
      tsTarget = e.target;
    }, { passive: true });

    stage.addEventListener('touchend', e => {
      if (!tsTarget || tsTarget.closest('#sigpad, button, .avatar, .dots')) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - tsX;
      const dy = t.clientY - tsY;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        go(current + (dx < 0 ? 1 : -1));
      }
    }, { passive: true });
  }

  boot();
})();
