// ============================================================
// ★ 攻撃エフェクトの軽量化（見た目はそのまま）★
//
//   これまで「飛ぶ軌跡」「着弾の爆発」「属性ごとの粒」は、粒1個ごとに DOM 要素（光る影つき）を
//   作っていたため、低スペック端末では要素数・レイヤー数が増えて重くなっていました。
//   ここでは、その粒だけを「透明なCanvas 1枚」にまとめて描きます。
//   形・色・光り方・動き・時間は、元の CSS アニメーションと同じ値を使っています。
//
//   ■ 自動調整（FxPerf）
//     端末が重いとき（フレーム間隔が長いとき）だけ、粒の数を自動で減らします。
//     速い端末では今までと同じ数のままです。全体攻撃（allattack-fx.js）も同じ判定を使います。
//
//   ■ 使い方（game.js 側から呼ばれます）
//       FxLite.burst(x, y, attr, strength)   … 着弾時のエネルギー爆発（spawnEnergyBurst）
//       FxLite.trail(attr, x, y, ang)        … 弾が飛ぶ間の軌跡（spawnAttrTrail）
//       FxLite.impact(attr, x, y, k)         … 着弾エフェクトの粒の部分（spawnAttrImpact）
//     どれも「成功したら true」を返します。false のときは game.js が従来の方法で描きます。
//     ※ このファイルを index.html から外すと、完全に従来の動きに戻ります。
// ============================================================
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // ------------------------------------------------------------
  // 端末の重さ（フレーム間隔の移動平均）。重いときだけ粒を減らす
  // ------------------------------------------------------------
  const P = { fe: 16 };
  window.FxPerf = {
    report(ms) { if (ms > 0 && ms < 500) P.fe = P.fe * .85 + ms * .15; },
    // 粒の数にかける倍率（1＝そのまま）
    q() { const f = P.fe; return f > 42 ? .5 : f > 32 ? .7 : f > 25 ? .85 : 1; },
    frameMs() { return P.fe; }
  };

  // ------------------------------------------------------------
  // イージング（CSS の cubic-bezier と同じ）
  // ------------------------------------------------------------
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = (t) => ((ax * t + bx) * t + cx) * t;
    const Y = (t) => ((ay * t + by) * t + cy) * t;
    const dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 6; i++) {
        const e = X(t) - x;
        if (Math.abs(e) < 1e-4) break;
        const d = dX(t);
        if (Math.abs(d) < 1e-6) break;
        t -= e / d;
      }
      if (t < 0 || t > 1) {           // ニュートン法が外れたときは二分法
        let lo = 0, hi = 1; t = x;
        for (let i = 0; i < 14; i++) { if (X(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; }
      }
      return Y(t);
    };
  }
  const EASE = {
    linear: (u) => u,
    out: bezier(0, 0, .58, 1),          // ease-out
    inout: bezier(.42, 0, .58, 1),      // ease-in-out
    inn: bezier(.42, 0, 1, 1),          // ease-in
    burst: bezier(.12, .7, .2, 1),      // 爆発の粒
    drop: bezier(.3, 0, .9, .6)         // 水の軌跡
  };

  // ------------------------------------------------------------
  // スプライト（粒の絵）。最初に1回だけ描いて使い回す（2倍の解像度で描いて、縮小して表示）
  // ------------------------------------------------------------
  const SPR = new Map();
  function sprite(key, lw, lh, draw) {
    let s = SPR.get(key);
    if (s) return s;
    const R = 2, c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(lw * R)); c.height = Math.max(1, Math.ceil(lh * R));
    const g = c.getContext('2d');
    g.scale(R, R);
    draw(g, lw, lh);
    s = { c, lw, lh };
    SPR.set(key, s);
    return s;
  }
  // 光る丸（CSS の「background + box-shadow:0 0 Bpx」と同じ）。blurs は影の大きさ（複数なら重ねる）
  function glowDot(fill, glow, s, blurs) {
    const maxB = Math.max.apply(null, blurs), pad = Math.ceil(maxB * 1.1) + 2, D = s + pad * 2;
    return sprite('g|' + fill + '|' + glow + '|' + s + '|' + blurs.join(','), D, D, (g) => {
      g.fillStyle = fill; g.shadowColor = glow;
      for (const b of blurs) {
        g.shadowBlur = b * 2;                 // shadowBlur は拡大の影響を受けないので、2倍で描いた分も2倍にする
        g.beginPath(); g.arc(D / 2, D / 2, s / 2, 0, TAU); g.fill();
      }
    });
  }
  // 丸みのある粒（炎・しずく・闇）。top＝上側の丸みの割合（CSS の border-radius の縦％）、gx/gy＝グラデーションの中心
  function blob(key, w, h, top, gx, gy, stops) {
    return sprite(key, w, h, (g) => {
      const cx = gx * w, cy = gy * h, R = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));   // farthest-corner
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R);
      for (const st of stops) gr.addColorStop(st[0], st[1]);
      const my = h * top;
      g.beginPath();
      g.ellipse(w / 2, my, w / 2, my, 0, Math.PI, TAU);
      g.ellipse(w / 2, my, w / 2, h - my, 0, 0, Math.PI);
      g.closePath();
      g.fillStyle = gr; g.fill();
    });
  }
  // 葉っぱ（border-radius:0 100% 0 100%、135度の緑のグラデーション、緑の光）
  function leaf(w) {
    const h = w * .55, pad = 10;
    return sprite('leaf|' + w, w + pad * 2, h + pad * 2, (g) => {
      g.translate(pad, pad);
      const L = (w + h) * Math.SQRT1_2 / 2, mx = w / 2, my = h / 2, d = Math.SQRT1_2;
      const gr = g.createLinearGradient(mx - d * L, my - d * L, mx + d * L, my + d * L);
      gr.addColorStop(0, '#b8ff90'); gr.addColorStop(1, '#2fa83a');
      g.fillStyle = gr; g.shadowColor = '#5ee35e'; g.shadowBlur = 12;
      g.beginPath();
      g.moveTo(0, 0);
      g.ellipse(0, h, w, h, 0, -Math.PI / 2, 0);
      g.ellipse(w, 0, w, h, 0, Math.PI / 2, Math.PI);
      g.closePath(); g.fill();
    });
  }
  const streak = () => sprite('streak', 30, 2, (g) => {          // 木の軌跡の白い風の筋
    const gr = g.createLinearGradient(30, 0, 0, 0);
    gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(120,255,120,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 30, 2);
  });
  const dropSpr = () => blob('drop', 20, 20, .6, .35, .3, [[0, '#fff'], [.6, '#6cc4ff'], [1, '#1f7ae0']]);
  const evenW = (w) => Math.max(10, Math.min(18, Math.round(w / 2) * 2));

  // ------------------------------------------------------------
  // Canvas（画面いっぱいの透明な1枚。粒があるときだけ表示）
  // ------------------------------------------------------------
  const C = { cv: null, g: null, W: 0, H: 0, px: 1, scale: 1, list: [], run: false, last: 0, n: 0, dirty: null };

  function ensure() {
    if (!C.cv) {
      const c = document.createElement('canvas');
      c.id = 'fxlite-canvas';
      c.style.cssText = 'position:fixed;left:0;top:0;z-index:210;pointer-events:none;display:none;';
      document.body.appendChild(c);
      C.cv = c; C.g = c.getContext('2d');
    }
    const w = window.innerWidth, h = window.innerHeight, px = Math.min(window.devicePixelRatio || 1, 1.5) * C.scale;
    if (C.W !== w || C.H !== h || C.px !== px) {
      C.W = w; C.H = h; C.px = px;
      C.cv.width = Math.max(1, Math.round(w * px)); C.cv.height = Math.max(1, Math.round(h * px));
      C.cv.style.width = w + 'px'; C.cv.style.height = h + 'px';
      C.dirty = null;
    }
  }
  function kick() {
    if (C.run) return;
    ensure();
    P.fe = P.fe * .85 + 16 * .15;                                       // 前回の重さを少しずつ忘れる（毎回ずっと軽量のままにならないように）
    if (P.fe < 22 && C.scale < 1) C.scale = Math.min(1, C.scale * 1.15);
    C.run = true; C.n = 0; C.last = performance.now();
    C.cv.style.display = 'block';
    requestAnimationFrame(loop);
  }
  // 粒を1つ追加。kf＝キーフレーム [{o:0〜1, x, y, s(横の拡大), v(縦の拡大。省略で s と同じ), a(不透明度), r(回転rad)}]
  function add(spr, kf, dur, delay, ease, pvx, pvy) {
    if (C.list.length > 500) return;
    C.list.push({
      spr, kf, dur, t0: performance.now() + (delay || 0), ease: ease || EASE.linear,
      pvx: pvx == null ? .5 : pvx, pvy: pvy == null ? .5 : pvy
    });
    kick();
  }

  function loop(now) {
    const raw = now - C.last; C.last = now;
    window.FxPerf.report(raw);
    const g = C.g, px = C.px;
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (C.dirty) {                                                     // 前のフレームで描いた範囲だけ消す
      const d = C.dirty;
      g.clearRect(Math.floor(d[0] * px) - 2, Math.floor(d[1] * px) - 2, Math.ceil((d[2] - d[0]) * px) + 4, Math.ceil((d[3] - d[1]) * px) + 4);
    }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const L = C.list; let j = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i], u = (now - p.t0) / p.dur;
      if (u >= 1) continue;                                            // 終わった粒は捨てる
      L[j++] = p;
      if (u < 0) continue;                                             // まだ始まっていない
      const kf = p.kf;
      let k = 0;
      while (k < kf.length - 2 && u > kf[k + 1].o) k++;
      const A = kf[k], B = kf[k + 1];
      const l = p.ease((u - A.o) / (B.o - A.o));
      const a = A.a + (B.a - A.a) * l;
      if (a <= .003) continue;
      const s = A.s + (B.s - A.s) * l;
      const v = (A.v == null ? A.s : A.v) + ((B.v == null ? B.s : B.v) - (A.v == null ? A.s : A.v)) * l;
      const dw = p.spr.lw * s, dh = p.spr.lh * v;
      if (dw < .5 || dh < .5) continue;
      const x = A.x + (B.x - A.x) * l, y = A.y + (B.y - A.y) * l;
      const r = (A.r || 0) + ((B.r || 0) - (A.r || 0)) * l;
      const co = Math.cos(r) * px, si = Math.sin(r) * px;
      g.globalAlpha = a > 1 ? 1 : a;
      g.setTransform(co, si, -si, co, x * px, y * px);
      g.drawImage(p.spr.c, -dw * p.pvx, -dh * p.pvy, dw, dh);
      const e = Math.hypot(dw, dh);
      if (x - e < x0) x0 = x - e; if (y - e < y0) y0 = y - e;
      if (x + e > x1) x1 = x + e; if (y + e > y1) y1 = y + e;
    }
    L.length = j;
    C.dirty = x1 > x0 ? [Math.max(0, x0), Math.max(0, y0), Math.min(C.W, x1), Math.min(C.H, y1)] : null;
    // とても重いときは、Canvas の解像度も下げる（見た目はほぼ変わらず、動きが止まらない）
    if (++C.n % 6 === 0 && P.fe > 34 && C.scale > .55) { C.scale = Math.max(.55, C.scale * .85); ensure(); }
    if (L.length) requestAnimationFrame(loop);
    else { C.run = false; C.dirty = null; C.cv.style.display = 'none'; }
  }

  // ------------------------------------------------------------
  // ① 着弾のエネルギー爆発（spawnEnergyBurst と同じ形・動き）
  // ------------------------------------------------------------
  function burst(x, y, attr, strength) {
    try {
      if (strength == null) strength = 1;
      const color = typeof fxColor === 'function' ? fxColor(attr) : '#ffffff';
      const count = Math.max(5, Math.round((12 + strength * 12) * window.FxPerf.q()));
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * TAU, dist = (28 + Math.random() * 70) * strength;
        const size = 3 + Math.random() * 8 * strength;
        const qs = Math.max(2, Math.round(size / 2) * 2), k = size / qs;
        add(glowDot(color, color, qs, [8 + qs * 2]),
          [{ o: 0, x, y, s: k, a: 1 }, { o: 1, x: x + Math.cos(ang) * dist, y: y + Math.sin(ang) * dist, s: 0, a: 0 }],
          330 + Math.random() * 260, 0, EASE.burst);
      }
      return true;
    } catch (e) { console.error('FxLite.burst', e); return false; }
  }

  // ------------------------------------------------------------
  // ② 弾が飛んでいる間の軌跡（spawnAttrTrail と同じ形・動き）
  // ------------------------------------------------------------
  const FLAME_COLS = ['#ff9a00', '#ff5a00', '#ffd23a'];
  function trail(attr, x, y, ang) {
    try {
      const bx = -Math.cos(ang), by = -Math.sin(ang), q = window.FxPerf.q();
      if (attr !== 'fire' && attr !== 'water' && attr !== 'wood' && attr !== 'light' && attr !== 'dark') return false;
      if (q < 1 && Math.random() > q) return true;                   // 重い端末では間引く
      if (attr === 'fire') {
        for (let i = 0; i < 2; i++) {
          const s = rnd(10, 22), c = pick(FLAME_COLS), k = s / 24;
          const spr = blob('ft|' + c, 24, 31.2, .65, .5, .7, [[0, c], [.75, 'rgba(255,60,0,0)']]);
          const px = x + rnd(-8, 8), py = y + rnd(-8, 8);
          add(spr, [{ o: 0, x: px, y: py, s: k, a: .95 }, { o: 1, x: px + bx * 20, y: py + by * 20 - 28, s: k * .2, a: 0 }], 420, 0, EASE.out);
        }
      } else if (attr === 'water') {
        const spr = dropSpr();
        for (let i = 0; i < 2; i++) {
          const k = rnd(5, 11) / 20, px = x + rnd(-8, 8), py = y + rnd(-8, 8);
          add(spr, [{ o: 0, x: px, y: py, s: k, a: 1 }, { o: 1, x: px + bx * 26 + rnd(-14, 14), y: py + by * 26 + 34, s: k, a: 0 }], 520, 0, EASE.drop);
        }
      } else if (attr === 'wood') {
        if (Math.random() < .6) {
          const s = rnd(9, 15), qw = evenW(s), k = s / qw, px = x + rnd(-10, 10), py = y + rnd(-10, 10);
          add(leaf(qw), [{ o: 0, x: px, y: py, s: k, a: 1, r: 0 },
            { o: 1, x: px + bx * 30 + rnd(-12, 12), y: py + by * 30 + rnd(-12, 12), s: k, a: 0, r: rnd(-360, 360) * Math.PI / 180 }], 560, 0, EASE.out);
        }
        // 白い風の筋（右端を軸に、進行方向へ向けて少し伸びる）
        const ox = x + rnd(-6, 6) + 15, oy = y + rnd(-14, 14);
        add(streak(), [{ o: 0, x: ox, y: oy, s: 1, v: 1, a: .9, r: ang }, { o: 1, x: ox, y: oy, s: 1.6, v: 1, a: 0, r: ang }], 300, 0, EASE.linear, 1, .5);
      } else if (attr === 'light') {
        const s = rnd(3, 6), qs = s < 5 ? 4 : 6, k = s / qs, px = x + rnd(-12, 12) + s / 2, py = y + rnd(-12, 12) + s / 2;
        add(glowDot('#fff', '#ffe14a', qs, [10, 20]),
          [{ o: 0, x: px, y: py, s: k, a: 1 }, { o: 1, x: px + rnd(-14, 14), y: py + rnd(-14, 14), s: 0, a: 0 }], 300, 0, EASE.linear);
      } else if (attr === 'dark') {
        const k = rnd(14, 26) / 24, px = x + rnd(-6, 6), py = y + rnd(-6, 6);
        const spr = blob('dt', 24, 24, .5, .5, .5, [[0, 'rgba(40,0,70,.85)'], [.75, 'rgba(120,40,190,0)']]);
        add(spr, [{ o: 0, x: px, y: py, s: k * .6, a: .9 }, { o: 1, x: px + bx * 14, y: py + by * 14, s: k * 2, a: 0 }], 480, 0, EASE.linear);
      }
      return true;
    } catch (e) { console.error('FxLite.trail', e); return false; }
  }

  // ------------------------------------------------------------
  // ③ 着弾エフェクトの「粒」の部分（輪・光の柱・渦などの大きな絵は、game.js 側の DOM のまま）
  // ------------------------------------------------------------
  function impact(attr, x, y, k) {
    try {
      const q = window.FxPerf.q();
      const N = (n) => Math.max(4, Math.round(n * q));
      if (attr === 'fire') {                                          // 上へ立ち上る炎
        const spr = blob('fi', 24, 40.8, .7, .5, .75, [[0, '#ffe27a'], [.55, '#ff6a00'], [.9, 'rgba(255,40,0,0)']]);
        for (let i = 0, n = N(12); i < n; i++) {
          const kk = rnd(14, 28) / 24, dx = rnd(-70, 70) * k;
          add(spr, [{ o: 0, x, y, s: kk * .5, a: 1 }, { o: 1, x: x + dx, y: y - rnd(60, 140) * k, s: kk * 1.1, a: 0 }], rnd(500, 800), 0, EASE.out);
        }
      } else if (attr === 'water') {                                  // 水しぶき（上に跳ねて落ちる）
        const spr = dropSpr();
        for (let i = 0, n = N(16); i < n; i++) {
          const kk = rnd(6, 14) / 20, dx = rnd(-90, 90) * k, up = rnd(50, 120) * k;
          add(spr, [{ o: 0, x, y, s: kk, a: 1 }, { o: .45, x: x + dx * .6, y: y - up, s: kk, a: 1 },
            { o: 1, x: x + dx, y: y + rnd(10, 50), s: kk, a: 0 }], rnd(600, 850), 0, EASE.inout);
        }
      } else if (attr === 'wood') {                                   // 舞い散る葉
        for (let i = 0, n = N(14); i < n; i++) {
          const s = rnd(10, 18), qw = evenW(s), kk = s / qw, ang = Math.random() * TAU, dist = rnd(50, 130) * k;
          add(leaf(qw), [{ o: 0, x, y, s: kk, a: 1, r: 0 },
            { o: 1, x: x + Math.cos(ang) * dist, y: y + Math.sin(ang) * dist, s: kk, a: 0, r: rnd(-540, 540) * Math.PI / 180 }], rnd(550, 850), 0, EASE.out);
        }
      } else if (attr === 'light') {                                  // 光の火花
        const spr = glowDot('#fff', '#ffe14a', 4, [10]);
        for (let i = 0, n = N(10); i < n; i++) {
          const ang = Math.random() * TAU, dist = rnd(40, 110) * k;
          add(spr, [{ o: 0, x: x + 2, y: y + 2, s: 1, a: 1 }, { o: 1, x: x + 2 + Math.cos(ang) * dist, y: y + 2 + Math.sin(ang) * dist, s: 1, a: 0 }], rnd(300, 550), 0, EASE.out);
        }
      } else if (attr === 'dark') {                                   // 中心へ吸い込まれる闇
        const spr = blob('dw', 24, 24, .5, .5, .5, [[0, '#2a0050'], [.75, 'rgba(130,50,200,0)']]);
        for (let i = 0, n = N(12); i < n; i++) {
          const ang = Math.random() * TAU, dist = rnd(60, 120) * k, kk = rnd(8, 18) / 24;
          add(spr, [{ o: 0, x: x + Math.cos(ang) * dist, y: y + Math.sin(ang) * dist, s: kk * 1.4, a: .9 }, { o: 1, x, y, s: kk * .2, a: 0 }], rnd(450, 700), 0, EASE.inn);
        }
      } else return false;
      return true;
    } catch (e) { console.error('FxLite.impact', e); return false; }
  }

  // ------------------------------------------------------------
  // 初回の攻撃でカクつかないよう、よく使うスプライトを暇なときに先に作っておく
  // ------------------------------------------------------------
  function prewarm() {
    const cols = ['#ff5a36', '#33baff', '#59d765', '#ffe36b', '#b06cff', '#ff90ba', '#ffffff'];
    const jobs = [];
    cols.forEach((c) => { for (let s = 2; s <= 20; s += 2) jobs.push(() => glowDot(c, c, s, [8 + s * 2])); });
    jobs.push(dropSpr, streak, () => glowDot('#fff', '#ffe14a', 4, [10, 20]), () => glowDot('#fff', '#ffe14a', 6, [10, 20]), () => glowDot('#fff', '#ffe14a', 4, [10]));
    for (let w = 10; w <= 18; w += 2) jobs.push(() => leaf(w));
    jobs.push(() => blob('fi', 24, 40.8, .7, .5, .75, [[0, '#ffe27a'], [.55, '#ff6a00'], [.9, 'rgba(255,40,0,0)']]));
    jobs.push(() => blob('dt', 24, 24, .5, .5, .5, [[0, 'rgba(40,0,70,.85)'], [.75, 'rgba(120,40,190,0)']]));
    jobs.push(() => blob('dw', 24, 24, .5, .5, .5, [[0, '#2a0050'], [.75, 'rgba(130,50,200,0)']]));
    FLAME_COLS.forEach((c) => jobs.push(() => blob('ft|' + c, 24, 31.2, .65, .5, .7, [[0, c], [.75, 'rgba(255,60,0,0)']])));
    const idle = window.requestIdleCallback ? (f) => window.requestIdleCallback(f, { timeout: 2000 }) : (f) => setTimeout(f, 80);
    function step() {                                               // 一度に少しずつ（8個ずつ）作る
      try { for (let n = 0; n < 8 && jobs.length; n++) jobs.shift()(); } catch (e) { jobs.length = 0; }
      if (jobs.length) idle(step);
    }
    idle(step);
  }
  setTimeout(() => { try { prewarm(); } catch (e) {} }, 1200);

  window.FxLite = { burst, trail, impact, ready: true };
})();
