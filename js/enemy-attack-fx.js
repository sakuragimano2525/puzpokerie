// ============================================================
// ★ 敵の攻撃演出（火＝炎 / 水＝水 / 木＝風 / 光＝いなずま / 闇＝闇のはじけ）★
//
//   これまでの「色つきの玉」を、属性ごとの本物っぽい攻撃に置き換えます。
//     火：燃え盛る火球（白い核→黄→橙→赤）＋ 尾を引く炎 ＋ 火花 → 着弾で爆炎・衝撃波・黒煙・火の粉
//     水：うねる水塊＋ 尾を引く水の帯 ＋ しぶき → 着弾で王冠状に飛び散る水しぶき・波紋・霧・残る水滴
//     木：風の渦（らせんの風の筋）＋ 舞う葉 ＋ 風の線 → 着弾で風の刃・衝撃リング・舞い散る葉
//     光：いなずまをまとった光の玉（ぱちぱち放電する尾）→ 着弾で落雷・枝分かれ・地面を走る放電・きらめき
//     闇：むらさきの縁の黒い球（黒い煙の尾）→ 着弾で闇がはじけ、黒煙・闇の爪あと・むらさきの衝撃波
//
//   ■ 演出の長さは変えません
//       ・弾が飛ぶ時間は game.js の showEnemyProjectile の duration（通常280ms／先制360ms）のまま。
//       ・当たったあとの残り（水滴・煙・葉）は「放ったまま」にして、待ちません。次の攻撃にすぐ進みます。
//
//   ■ 調整したいとき（ここの数字）
//       QUALITY … 演出の粒の量（1＝標準。重いなら 0.7 など）
//       SCALE   … 演出の大きさ（1＝標準。大きくしたいなら 1.2 など）
//
//   ※ game.js の後に読み込む。公開しているのは window.EnemyAttackFx だけ：
//       has(属性)                       … この属性の専用演出があるか（火・水・木・光・闇）
//       shoot({attr,x0,y0,x1,y1,ms,hits,hitIdx,big})  … 弾を飛ばす（着弾の演出まで含む）
//       charge(attr, x, y, r)           … 攻撃前の「ため」（敵の周りの小さな演出）
//       tint(attr)                      … 被弾フラッシュの色
//     このファイルが読み込めなくても game.js は従来の玉で動きます。
// ============================================================
(function () {
  'use strict';

  const QUALITY = 1;     // 粒の量
  const SCALE   = 1;     // 演出の大きさ

  const TAU = Math.PI * 2;
  const rnd   = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp  = (a, b, t) => a + (b - a) * t;
  const pick  = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const ease  = { out2: (u) => 1 - (1 - u) * (1 - u), out3: (u) => 1 - Math.pow(1 - u, 3), in2: (u) => u * u };
  // 立ち上がり a→b、維持 →c、減衰 →d の 0〜1 の包絡線
  const env = (t, a, b, c, d) => t <= a ? 0 : t < b ? (t - a) / (b - a) : t <= c ? 1 : t < d ? 1 - (t - c) / (d - c) : 0;

  const ATTRS = { fire: 1, water: 1, wood: 1, light: 1, dark: 1 };
  const TINT  = { fire: 'rgba(255,110,20,.26)', water: 'rgba(40,140,255,.24)', wood: 'rgba(90,230,120,.22)', light: 'rgba(255,230,90,.24)', dark: 'rgba(130,50,210,.28)' };

  // ------------------------------------------------------------
  // エンジン：1枚の透明キャンバスを全部の演出で共有（多段攻撃で重なっても軽い）
  // ------------------------------------------------------------
  const E = { cv: null, g: null, W: 0, H: 0, px: 1, scale: 1, fe: 16, n: 0, running: false, last: 0, P: [], FX: [] };
  const MAXP = 640;   // 同時に出す粒の上限（多段攻撃でも重くならないように）

  function ensureCanvas() {
    if (!E.cv) {
      const c = document.createElement('canvas');
      c.id = 'enemy-fx-canvas';
      c.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:155;pointer-events:none;display:none;';
      document.body.appendChild(c);
      E.cv = c; E.g = c.getContext('2d');
    }
    const w = window.innerWidth, h = window.innerHeight;
    const px = Math.min(window.devicePixelRatio || 1, 1.5) * E.scale;
    if (E.W !== w || E.H !== h || E.px !== px) {
      E.W = w; E.H = h; E.px = px;
      E.cv.width = Math.max(1, Math.round(w * px)); E.cv.height = Math.max(1, Math.round(h * px));
      E.cv.style.width = w + 'px'; E.cv.style.height = h + 'px';   // 描く座標＝画面の座標（getBoundingClientRect と同じ）
    }
  }

  // 描画ループを（止まっていれば）動かし始める
  function kick() {
    ensureCanvas();
    if (E.running) return;
    E.scale = Math.min(1, E.scale * 1.25);
    ensureCanvas();
    E.running = true; E.last = performance.now(); E.cv.style.display = 'block';
    requestAnimationFrame(loop);
  }
  function addFx(fx) {
    fx.t0 = performance.now();
    E.FX.push(fx);
    kick();
  }
  function emit(p) { if (E.P.length < MAXP) E.P.push(p); return p; }
  // 粒が少ないほど軽いので、いま出ている粒の量に応じて新しく出す量を絞る
  function load() { return E.P.length > 420 ? .45 : E.P.length > 260 ? .7 : 1; }

  function loop(now) {
    ensureCanvas();
    const g = E.g, raw = now - E.last, dt = Math.min(.05, Math.max(0, raw / 1000));
    if (raw > 0 && raw < 500) E.fe = E.fe * .85 + raw * .15;
    E.last = now;
    g.setTransform(E.px, 0, 0, E.px, 0, 0);
    g.clearRect(0, 0, E.W, E.H);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;

    // ① 弾そのもの・着弾の閃光（効果ごとの draw）
    for (let i = 0; i < E.FX.length; i++) {
      const fx = E.FX[i], t = Math.max(0, now - fx.t0);
      if (t > fx.dur) { E.FX.splice(i--, 1); continue; }
      g.save();
      try { fx.draw(g, t, dt); } catch (e) { console.error('enemy attack fx', e); fx.dur = 0; }
      g.restore();
    }
    // ② 粒（炎・煙・しぶき・葉…）
    drawParticles(g, dt);

    // 動きが重い端末では解像度を自動で落とす（見た目はほぼ変わらず、動きは止まらない）
    if (++E.n % 6 === 0 && E.fe > 34 && E.scale > .5) E.scale = Math.max(.5, E.scale * .8);
    if (E.FX.length || E.P.length) requestAnimationFrame(loop);
    else { E.running = false; E.cv.style.display = 'none'; }
  }

  // ------------------------------------------------------------
  // スプライト（柔らかい光の粒を事前に描いておく）
  // ------------------------------------------------------------
  const SPR = {};
  function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
  // 小さな円を寄せ集めて輪郭を不規則にした「もこもこ」
  function puff(size, rgb, a, seed, n, dmax, rmin, rr) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'), r = rng(seed);
    for (let i = 0, N = n || 9; i < N; i++) {
      const ang = r() * TAU, d = r() * size * (dmax || .13), R = size * ((rmin || .2) + r() * (rr || .16));
      const x = size / 2 + Math.cos(ang) * d, y = size / 2 + Math.sin(ang) * d;
      const gr = g.createRadialGradient(x, y, 0, x, y, R);
      gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(.5, `rgba(${rgb},${a * .5})`); gr.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, size, size);
    }
    return c;
  }
  // まんまるの柔らかい光（閃光・ぼかし用）
  function glow(size, rgb, a) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'), h = size / 2;
    const gr = g.createRadialGradient(h, h, 0, h, h, h);
    gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(.35, `rgba(${rgb},${a * .55})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    return c;
  }
  function leafSprite(c1, c2) {
    const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'); g.translate(S / 2, S / 2);
    g.beginPath(); g.moveTo(-S * .44, 0);
    g.bezierCurveTo(-S * .3, -S * .62, S * .2, -S * .6, S * .46, 0);
    g.bezierCurveTo(S * .2, S * .56, -S * .3, S * .56, -S * .44, 0); g.closePath();
    const gr = g.createLinearGradient(0, -S * .45, 0, S * .45); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr; g.fill();
    g.lineWidth = 1.6; g.strokeStyle = 'rgba(12,64,22,.65)'; g.stroke();
    g.strokeStyle = 'rgba(240,255,210,.8)'; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(-S * .42, 0); g.lineTo(S * .4, 0); g.stroke();
    g.lineWidth = 1.1; g.strokeStyle = 'rgba(240,255,210,.5)';
    for (const x of [-.2, 0, .2]) for (const s of [-1, 1]) { g.beginPath(); g.moveTo(S * x, 0); g.lineTo(S * (x + .13), s * S * .18); g.stroke(); }
    return c;
  }
  function sprites() {
    if (SPR.ok) return SPR;
    // 炎の色の段階：白 → 黄 → 橙 → 赤橙 → 赤 → 暗赤（形は全段で共通。色だけ変わる）
    const FC = [[255, 255, 238, .92], [255, 238, 140, .92], [255, 186, 52, .9], [255, 112, 22, .88], [222, 48, 10, .84], [140, 18, 6, .8]];
    SPR.fire = Array.from({ length: 10 }, (_, k) => {
      const f = k / 9 * 5, i = Math.min(4, Math.floor(f)), t = f - i, a = FC[i], b = FC[i + 1];
      const m = a.map((v, j) => v + (b[j] - v) * t);
      return [0, 1].map((v) => puff(96, `${m[0] | 0},${m[1] | 0},${m[2] | 0}`, m[3], 7 + v * 3));
    });
    SPR.smoke = [0, 1].map((i) => puff(96, '34,22,18', .9, 301 + i * 7, 14, .2, .1, .16));
    SPR.mist  = [0, 1].map((i) => puff(96, '226,244,255', .8, 401 + i * 7, 10));
    SPR.wind  = [0, 1].map((i) => puff(96, '226,255,226', .8, 501 + i * 7, 10));
    SPR.gWhite  = glow(128, '255,252,235', 1);
    SPR.gOrange = glow(128, '255,138,30', 1);
    SPR.gCyan   = glow(128, '110,200,255', 1);
    SPR.gGreen  = glow(128, '150,255,160', 1);
    SPR.gYellow = glow(128, '255,226,90', 1);
    SPR.gViolet = glow(128, '172,90,255', 1);
    SPR.dark    = [0, 1].map((i) => puff(96, '20,4,38', .95, 601 + i * 7, 14, .2, .1, .16));
    SPR.violet  = [0, 1].map((i) => puff(96, '170,96,250', .85, 701 + i * 7, 10));
    SPR.leaf = [leafSprite('#d3f996', '#2f9a3a'), leafSprite('#a9e86f', '#1f7a2c'), leafSprite('#e6ffb8', '#48b24c')];
    SPR.ok = true;
    return SPR;
  }

  // ------------------------------------------------------------
  // 粒：kind ごとに更新と描画を決める
  //   puff … 柔らかい塊（炎・煙・霧・風のもや）  spark … 火花・火の粉  drop … 水滴
  //   leaf … 葉  ring … 波紋・衝撃リング  streak … 風の線  slash … 風の刃  arc … 渦の弧  flash … 閃光
  // ------------------------------------------------------------
  function drawParticles(g, dt) {
    const S = sprites(), P = E.P;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      p.age += dt;
      if (p.age >= p.life) { P[i] = P[P.length - 1]; P.pop(); i--; continue; }
      const u = p.age / p.life;                       // 0〜1
      // 動き
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      if (p.gy) p.vy += p.gy * dt;
      if (p.sway) p.vx += Math.sin(p.age * p.swayF + p.ph) * p.sway * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      switch (p.kind) {
        case 'puff': {
          const s = lerp(p.s0, p.s1, ease.out2(u));
          const a = p.a * (p.fadeIn ? Math.min(1, u / p.fadeIn) : 1) * Math.pow(1 - u, p.fadePow || 1);
          const spr = p.ramp ? S.fire[clamp(Math.round(lerp(p.r0 || 0, p.r1 == null ? 9 : p.r1, u)), 0, 9)][p.v] : p.spr[p.v];
          g.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
          g.globalAlpha = clamp(a, 0, 1);
          const h = s * (p.st || 1);
          if (p.rot) { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.drawImage(spr, -s / 2, -h / 2, s, h); g.restore(); }
          else g.drawImage(spr, p.x - s / 2, p.y - h / 2, s, h);
          break;
        }
        case 'flash': {
          const s = lerp(p.s0, p.s1, ease.out3(u));
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = clamp(p.a * (1 - u) * (1 - u), 0, 1);
          g.drawImage(p.spr, p.x - s / 2, p.y - s / 2, s, s);
          break;
        }
        case 'spark': {
          const sp = Math.hypot(p.vx, p.vy) || 1, L = p.len * (1 - u * .6);
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = clamp(1 - u * u, 0, 1);
          g.lineCap = 'round';
          g.strokeStyle = p.c; g.lineWidth = p.w * (1 - u * .5);
          g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx / sp * L, p.y - p.vy / sp * L); g.stroke();
          if (p.core) { g.strokeStyle = '#fff'; g.lineWidth = p.w * .45; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx / sp * L * .6, p.y - p.vy / sp * L * .6); g.stroke(); }
          break;
        }
        case 'drop': {
          // しずくの形（進む向きにとがった涙形）＋ ハイライト
          const sp = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / sp, uy = p.vy / sp;
          const r = p.r * (u > .75 ? 1 - (u - .75) / .25 * .6 : 1);
          const tail = r * (1.2 + Math.min(2.4, sp / 260));
          const a = p.a * (u > .6 ? 1 - (u - .6) / .4 : 1);
          g.globalCompositeOperation = 'source-over';
          g.globalAlpha = clamp(a, 0, 1);
          g.beginPath();
          g.moveTo(p.x - ux * tail, p.y - uy * tail);
          g.lineTo(p.x + uy * r, p.y - ux * r);
          g.arc(p.x, p.y, r, Math.atan2(-ux, uy), Math.atan2(ux, -uy), false);
          g.closePath();
          const gr = g.createRadialGradient(p.x - r * .35, p.y - r * .4, 0, p.x, p.y, r * 1.1);
          gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.35, 'rgba(160,220,255,.9)'); gr.addColorStop(1, 'rgba(30,110,225,.85)');
          g.fillStyle = gr; g.fill();
          g.globalAlpha = clamp(a * .9, 0, 1);
          g.fillStyle = '#fff'; g.beginPath(); g.arc(p.x - r * .35, p.y - r * .38, Math.max(.7, r * .26), 0, TAU); g.fill();
          break;
        }
        case 'leaf': {
          p.rot += p.vr * dt;
          const a = u > .65 ? 1 - (u - .65) / .35 : 1;
          const s = p.s * (.7 + .3 * Math.abs(Math.cos(p.rot * .7)));   // ひらひら裏返る
          g.globalCompositeOperation = 'source-over';
          g.globalAlpha = clamp(a, 0, 1);
          g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
          g.scale(1, .55 + .45 * Math.cos(p.age * p.flip + p.ph));
          g.drawImage(S.leaf[p.v], -s / 2, -s / 2, s, s); g.restore();
          break;
        }
        case 'ring': {
          const r = lerp(p.r0, p.r1, ease.out3(u));
          g.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
          g.globalAlpha = clamp(p.a * (1 - u) * (1 - u * .4), 0, 1);
          g.strokeStyle = p.c; g.lineWidth = Math.max(.6, p.w * (1 - u * .7));
          g.beginPath(); g.ellipse(p.x, p.y, r, r * p.ky, p.rot || 0, 0, TAU); g.stroke();
          break;
        }
        case 'streak': {
          // 風の線：根元から先へ伸びて、すっと消える
          const e = ease.out2(Math.min(1, u * 1.6)), L = p.len * e, st = p.len * Math.max(0, (u - .35) / .65) * .9;
          const dx = Math.cos(p.ang), dy = Math.sin(p.ang);
          const ax = p.x + dx * st, ay = p.y + dy * st, bx = p.x + dx * L, by = p.y + dy * L;
          g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
          const a = clamp(p.a * (1 - u), 0, 1);
          g.globalAlpha = a * .45; g.strokeStyle = p.c; g.lineWidth = p.w * 2.6;
          g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
          g.globalAlpha = a; g.strokeStyle = p.c2 || '#f4fff0'; g.lineWidth = p.w;
          g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
          break;
        }
        case 'slash': {
          // 風の刃：両端がとがった三日月が、さっと走る
          const e = ease.out3(Math.min(1, u * 3.2)), a = clamp(p.a * (u < .25 ? 1 : 1 - (u - .25) / .75), 0, 1);
          const len = p.len * (.55 + .45 * e), th = p.th * (u < .3 ? 1 : 1 - (u - .3) / .7 * .6);
          const dx = Math.cos(p.ang), dy = Math.sin(p.ang), nx = -dy, ny = dx, N = 14;
          const cxm = p.x + dx * (e - 1) * p.len * .25, cym = p.y + dy * (e - 1) * p.len * .25;
          g.globalCompositeOperation = 'lighter';
          for (let pass = 0; pass < 2; pass++) {
            const k = pass ? .45 : 1;
            g.beginPath();
            for (let i = 0; i <= N; i++) {
              const t = i / N - .5, w = Math.sin((t + .5) * Math.PI) * th * k, bend = -(1 - 4 * t * t) * p.bend;
              const x = cxm + dx * t * len + nx * (bend + w * .5), y = cym + dy * t * len + ny * (bend + w * .5);
              if (i) g.lineTo(x, y); else g.moveTo(x, y);
            }
            for (let i = N; i >= 0; i--) {
              const t = i / N - .5, w = Math.sin((t + .5) * Math.PI) * th * k, bend = -(1 - 4 * t * t) * p.bend;
              g.lineTo(cxm + dx * t * len + nx * (bend - w * .5), cym + dy * t * len + ny * (bend - w * .5));
            }
            g.closePath();
            g.globalAlpha = a * (pass ? .95 : .5);
            g.fillStyle = pass ? (p.c2 || '#f6fff2') : p.c; g.fill();
          }
          break;
        }
        case 'bolt': {
          // いなずま：ギザギザの線。ちかちか明滅して、すっと消える
          const fl = Math.sin(p.age * 70 + p.ph) > -.25 ? 1 : .4, a = clamp(p.a * fl * (1 - u * u), 0, 1);
          g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
          strokePts(g, p.pts, p.w * 5, p.c, a * .3);
          strokePts(g, p.pts, p.w * 2.2, p.c, a * .6);
          strokePts(g, p.pts, p.w, p.c2 || '#ffffff', a);
          break;
        }
        case 'star': {
          // 4つの角のきらめき
          const s = p.s * Math.sin(Math.min(1, u * 1.15) * Math.PI) , a = clamp(p.a * (1 - u * .5), 0, 1);
          if (s <= 0.5) break;
          g.globalCompositeOperation = 'lighter'; g.globalAlpha = a;
          g.save(); g.translate(p.x, p.y); g.rotate(p.rot + p.age * p.vr);
          g.fillStyle = p.c;
          g.beginPath(); g.moveTo(0, -s); g.quadraticCurveTo(0, 0, s * .22, 0); g.quadraticCurveTo(0, 0, 0, s); g.quadraticCurveTo(0, 0, -s * .22, 0); g.quadraticCurveTo(0, 0, 0, -s);
          g.moveTo(-s, 0); g.quadraticCurveTo(0, 0, 0, s * .22); g.quadraticCurveTo(0, 0, s, 0); g.quadraticCurveTo(0, 0, 0, -s * .22); g.quadraticCurveTo(0, 0, -s, 0);
          g.fill(); g.restore();
          break;
        }
        case 'arc': {
          // 渦の弧：回りながら広がって消える
          const r = lerp(p.r0, p.r1, ease.out2(u)), a0 = p.a0 + p.spin * p.age;
          g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
          g.globalAlpha = clamp(p.a * (1 - u), 0, 1);
          g.strokeStyle = p.c; g.lineWidth = Math.max(.8, p.w * (1 - u * .6));
          g.beginPath(); g.ellipse(p.x, p.y, r, r * p.ky, 0, a0, a0 + p.sweep); g.stroke();
          break;
        }
      }
    }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  }

  // いなずまの線（両端は動かさず、間をギザギザに折る）
  function jagLine(x0, y0, x1, y1, jag, seg, r) {
    const pts = [[x0, y0]], dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    for (let i = 1; i < seg; i++) {
      const k = i / seg, off = (r() - .5) * 2 * jag * (.35 + .65 * Math.sin(k * Math.PI));
      pts.push([x0 + dx * k + nx * off, y0 + dy * k + ny * off]);
    }
    pts.push([x1, y1]);
    return pts;
  }
  function strokePts(g, pts, w, c, a) {
    g.globalAlpha = clamp(a, 0, 1); g.strokeStyle = c; g.lineWidth = Math.max(.6, w);
    g.beginPath(); for (let i = 0; i < pts.length; i++) i ? g.lineTo(pts[i][0], pts[i][1]) : g.moveTo(pts[i][0], pts[i][1]); g.stroke();
  }

  // 粒の出し方（共通）
  const base = (kind, o) => Object.assign({ kind, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: .5, ph: Math.random() * TAU }, o);
  function flame(x, y, vx, vy, life, s0, s1, a, o) { return emit(base('puff', Object.assign({ x, y, vx, vy, life, s0, s1, a, ramp: true, add: true, v: Math.random() < .5 ? 0 : 1, st: 1.25, rot: 0, fadePow: .7 }, o))); }
  function smoke(x, y, vx, vy, life, s0, s1, a) { return emit(base('puff', { x, y, vx, vy, life, s0, s1, a, spr: SPR.smoke, v: Math.random() < .5 ? 0 : 1, add: false, drag: 1.2, fadeIn: .18, fadePow: 1.1 })); }
  function spark(x, y, ang, sp, life, c, o) { return emit(base('spark', Object.assign({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life, c, w: rnd(1.6, 3), len: rnd(10, 22), gy: 520, drag: .9, core: true }, o))); }
  function drop(x, y, ang, sp, life, r, o) { return emit(base('drop', Object.assign({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life, r, a: 1, gy: 1150, drag: .5 }, o))); }
  function leaf(x, y, ang, sp, life, s, o) { return emit(base('leaf', Object.assign({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life, s, v: Math.floor(Math.random() * 3), rot: rnd(0, TAU), vr: rnd(-9, 9), flip: rnd(8, 15), drag: 1.6, gy: 60, sway: 150, swayF: rnd(7, 12) }, o))); }
  const flashAt = (x, y, spr, s0, s1, a, life) => emit(base('flash', { x, y, spr, s0, s1, a, life }));

  // ------------------------------------------------------------
  // 弾の通り道（game.js の従来の弧と同じ。始点→少し上を通る→終点）
  // ------------------------------------------------------------
  function makePath(x0, y0, x1, y1) {
    const mx = x0 * .4 + x1 * .6, my = Math.min(y0, y1) - 30;
    const pt = (u) => { const m = 1 - u; return [m * m * x0 + 2 * m * u * mx + u * u * x1, m * m * y0 + 2 * m * u * my + u * u * y1]; };
    const dir = (u) => { const m = 1 - u; const dx = 2 * m * (mx - x0) + 2 * u * (x1 - mx), dy = 2 * m * (my - y0) + 2 * u * (y1 - my); return Math.atan2(dy, dx); };
    return { pt, dir };
  }
  // 連撃のときは、重なって白飛びしないように1発ごとの閃光・光の輪を弱める（1発だけなら 1）
  const fadeOf = (q) => clamp(.35 + q * .75, .4, 1);
  // 画面の大きさに合わせた基準スケール（スマホ幅390pxで1）
  const unit = (big) => clamp(Math.min(window.innerWidth, 560) / 390, .8, 1.35) * SCALE * (big ? 1.25 : 1);

  // ============================================================
  // 火：燃え盛る火球
  // ============================================================
  function shootFire(o) {
    const S = sprites(), u0 = unit(o.big), path = makePath(o.x0, o.y0, o.x1, o.y1), q = o.q;
    let acc = 0, accS = 0, accM = 0;
    const fa = fadeOf(q);
    const R = 21 * u0;                                         // 火球の半径
    let boomed = false;
    return {
      dur: o.ms + 1100,
      draw(g, t, dt) {
        const f = Math.min(1, t / o.ms);
        if (t < o.ms) {
          const [x, y] = path.pt(f), ang = path.dir(f);
          const bx = -Math.cos(ang), by = -Math.sin(ang);
          const grow = .55 + .45 * Math.min(1, f * 3);          // 出始めは小さく
          // 尾を引く炎：進行方向の後ろへ流れ、上へゆらめきながら赤く暗く
          acc += dt * 190 * q * load();
          while (acc >= 1) {
            acc -= 1;
            flame(x + rnd(-R * .35, R * .35) + bx * rnd(0, R), y + rnd(-R * .35, R * .35) + by * rnd(0, R), bx * rnd(40, 150) + rnd(-26, 26), by * rnd(40, 150) - rnd(30, 100),
              rnd(.18, .36), R * rnd(2.1, 3) * grow, R * rnd(.6, 1.2), rnd(.5, .85), { st: 1.3, rot: 0, r0: 2, r1: 9 });
          }
          // 火花
          accS += dt * 70 * q * load();
          while (accS >= 1) { accS -= 1; spark(x, y, Math.atan2(by, bx) + rnd(-1.1, 1.1), rnd(120, 360), rnd(.28, .6), pick(['#ffe27a', '#ffb347', '#ff7a2a']), { gy: 420 }); }
          // 黒い煙の筋（うっすら）
          accM += dt * 22 * q * load();
          while (accM >= 1) { accM -= 1; smoke(x + bx * R * .8, y + by * R * .8, bx * 30 + rnd(-14, 14), -rnd(16, 46), rnd(.35, .6), R * .9, R * 2.1, .22); }

          // 火球の本体（毎フレーム、ちらつかせる）
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = .55 * fa; const gs = R * 5.2 * grow; g.drawImage(S.gOrange, x - gs / 2, y - gs / 2, gs, gs);
          // 外側ほど赤く大きく、内側ほど白く小さく（S.fire は 0＝白 … 9＝暗赤）
          const body = [[8, 2.1, .8], [6, 1.75, .9], [4, 1.4, .95], [2, 1.05, .95], [0, .7, 1]];
          for (const [idx, sz, al] of body) {
            for (let j = 0; j < 2; j++) {
              const jx = rnd(-R * .3, R * .3), jy = rnd(-R * .34, R * .2) - R * .1;
              g.globalAlpha = al * .85;
              const sz2 = R * sz * 2.4 * grow;
              g.drawImage(S.fire[idx][j], x + jx - sz2 / 2, y + jy - sz2 / 2, sz2, sz2);
            }
          }
          g.globalAlpha = .8 * fa; const cs = R * 1.6 * grow; g.drawImage(S.gWhite, x - cs / 2, y - cs / 2, cs, cs);   // 白い核
        } else if (!boomed) {
          boomed = true;
          explodeFire(o.x1, o.y1, u0, q);
        }
      }
    };
  }
  function explodeFire(x, y, u0, q) {
    const S = sprites(), ql = q * load(), fa = fadeOf(q);
    flashAt(x, y, S.gWhite, 50 * u0, 200 * u0, .7 * fa, .22);
    flashAt(x, y, S.gOrange, 110 * u0, 420 * u0, .85 * fa, .45);
    // 火の玉が広がる
    const n = Math.round(15 * ql);
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU), sp = rnd(40, 240) * u0;
      flame(x + Math.cos(a) * rnd(0, 12) * u0, y + Math.sin(a) * rnd(0, 8) * u0, Math.cos(a) * sp, Math.sin(a) * sp * .72 - rnd(30, 90) * u0,
        rnd(.32, .62), 34 * u0 * rnd(.8, 1.2), 100 * u0 * rnd(.8, 1.3), rnd(.7, 1), { drag: 3.2, st: 1.15, r0: 1, r1: 9 });
    }
    // 上へ立ちのぼる炎
    for (let i = 0; i < Math.round(8 * ql); i++)
      flame(x + rnd(-46, 46) * u0, y + rnd(-6, 10) * u0, rnd(-24, 24), -rnd(90, 190) * u0, rnd(.4, .72), 26 * u0 * rnd(.8, 1.3), 56 * u0, rnd(.55, .85), { st: 1.7, drag: 1.2, r0: 3, r1: 9 });
    // 衝撃波
    emit(base('ring', { x, y, r0: 10 * u0, r1: 120 * u0, ky: .5, c: '#ffb050', w: 7 * u0, a: .95 * fa, life: .3, add: true }));
    emit(base('ring', { x, y, r0: 6 * u0, r1: 78 * u0, ky: .5, c: '#fff0b0', w: 3.5 * u0, a: .9 * fa, life: .24, add: true }));
    // 火花（重力で落ちる）
    for (let i = 0; i < Math.round(22 * ql); i++) spark(x, y, rnd(0, TAU), rnd(140, 460) * u0, rnd(.4, .9), pick(['#fff0a0', '#ffd24a', '#ff9a2a', '#ff6a1a']), { gy: 640, len: rnd(12, 26) });
    // 火の粉（ゆっくり舞い上がる）
    for (let i = 0; i < Math.round(9 * ql); i++) spark(x + rnd(-40, 40) * u0, y + rnd(-6, 8) * u0, -Math.PI / 2 + rnd(-.8, .8), rnd(40, 140), rnd(.7, 1.1), '#ff9a3a', { gy: -50, len: 5, w: 2.6, core: false, drag: .6 });
    // 黒煙（のこる）
    for (let i = 0; i < Math.round(5 * ql); i++)
      smoke(x + rnd(-36, 36) * u0, y + rnd(-10, 12) * u0, rnd(-16, 16), -rnd(30, 70) * u0, rnd(.65, .95), 36 * u0, 100 * u0 * rnd(.8, 1.2), .34);
  }

  // ============================================================
  // 水：うねる水塊
  // ============================================================
  function shootWater(o) {
    const S = sprites(), u0 = unit(o.big), path = makePath(o.x0, o.y0, o.x1, o.y1), q = o.q;
    let acc = 0, splashed = false;
    const fa = fadeOf(q);
    const R = 19 * u0;
    return {
      dur: o.ms + 1250,
      draw(g, t, dt) {
        const f = Math.min(1, t / o.ms);
        if (t < o.ms) {
          const [x, y] = path.pt(f), ang = path.dir(f);
          const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
          const grow = .6 + .4 * Math.min(1, f * 3);
          // 尾を引く水の帯：通り道を少しさかのぼって、細く透きとおらせる
          const N = 10, span = .34;
          const L = [], Rr = [];
          for (let i = 0; i <= N; i++) {
            const k = i / N, uu = Math.max(0, f - k * span * Math.min(1, f * 3));
            const [px, py] = path.pt(uu), wob = Math.sin(t * .03 + k * 7) * R * .22 * k;
            const w = R * 1.0 * grow * (1 - k) * (1 - k * .2);
            L.push([px + nx * (w + wob), py + ny * (w + wob)]); Rr.push([px - nx * (w - wob), py - ny * (w - wob)]);
          }
          g.globalCompositeOperation = 'source-over';
          g.beginPath(); L.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); for (let i = N; i >= 0; i--) g.lineTo(Rr[i][0], Rr[i][1]); g.closePath();
          const tg = g.createLinearGradient(x, y, L[N][0], L[N][1]);
          tg.addColorStop(0, 'rgba(120,200,255,.85)'); tg.addColorStop(.6, 'rgba(70,160,255,.45)'); tg.addColorStop(1, 'rgba(60,140,255,0)');
          g.globalAlpha = 1; g.fillStyle = tg; g.fill();
          // 水の帯のハイライト（白い細いすじ）
          g.globalAlpha = .6; g.strokeStyle = '#eaf8ff'; g.lineWidth = Math.max(1, R * .12); g.lineCap = 'round';
          g.beginPath(); for (let i = 0; i <= N * .7; i++) { const p = L[i]; const m = [(p[0] * 3 + Rr[i][0]) / 4, (p[1] * 3 + Rr[i][1]) / 4]; i ? g.lineTo(m[0], m[1]) : g.moveTo(m[0], m[1]); } g.stroke();

          // 水滴がちぎれて後ろへ飛ぶ
          acc += dt * 100 * q * load();
          while (acc >= 1) {
            acc -= 1;
            drop(x + rnd(-R * .5, R * .5), y + rnd(-R * .5, R * .5), Math.atan2(-dy, -dx) + rnd(-1.2, 1.2), rnd(40, 200), rnd(.5, .95), rnd(1.8, 4.2) * u0, { gy: 1000 });
          }

          // 水塊の本体（進行方向に伸びたしずく型・ゆらゆら揺れる）
          g.save(); g.translate(x, y); g.rotate(ang);
          const wob2 = Math.sin(t * .045), rx = R * 1.3 * grow * (1 + wob2 * .08), ry = R * 1.08 * grow * (1 - wob2 * .1);
          g.globalCompositeOperation = 'lighter'; g.globalAlpha = .45 * fa;
          const gs = R * 5 * grow; g.drawImage(S.gCyan, -gs / 2, -gs / 2, gs, gs);
          g.globalCompositeOperation = 'source-over'; g.globalAlpha = .96;
          g.beginPath();
          g.moveTo(-rx * 1.25, 0);
          g.bezierCurveTo(-rx * .5, -ry * 1.05, rx * .7, -ry * 1.1, rx, 0);
          g.bezierCurveTo(rx * .7, ry * 1.1, -rx * .5, ry * 1.05, -rx * 1.25, 0); g.closePath();
          const bg = g.createRadialGradient(rx * .25, -ry * .45, 0, 0, 0, rx * 1.3);
          bg.addColorStop(0, '#e9f8ff'); bg.addColorStop(.3, '#79c8ff'); bg.addColorStop(.7, '#2b86ee'); bg.addColorStop(1, '#0b49b4');
          g.fillStyle = bg; g.fill();
          g.lineWidth = 1.6 * u0; g.strokeStyle = 'rgba(210,240,255,.85)'; g.stroke();
          // 下側の濃い影・上側の反射
          g.globalAlpha = .5; g.fillStyle = '#0a3c9a'; g.beginPath(); g.ellipse(-rx * .05, ry * .5, rx * .72, ry * .36, 0, 0, TAU); g.fill();
          g.globalAlpha = .95; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(rx * .1, -ry * .46, rx * .36, ry * .17, -.18, 0, TAU); g.fill();
          g.beginPath(); g.arc(rx * .55, -ry * .12, ry * .12, 0, TAU); g.fill();
          g.restore();
        } else if (!splashed) {
          splashed = true;
          splashWater(o.x1, o.y1, u0, q, o.x1 - o.x0, o.y1 - o.y0);
        }
      }
    };
  }
  function splashWater(x, y, u0, q, vx, vy) {
    const S = sprites(), ql = q * load(), fa = fadeOf(q);
    flashAt(x, y, S.gWhite, 60 * u0, 220 * u0, .8 * fa, .2);
    flashAt(x, y, S.gCyan, 90 * u0, 340 * u0, .85 * fa, .34);
    // 水しぶきの王冠：上と横へ勢いよく
    const n = Math.round(30 * ql);
    for (let i = 0; i < n; i++) {
      const up = i < n * .72;
      const a = up ? -Math.PI / 2 + rnd(-1.15, 1.15) : (Math.random() < .5 ? rnd(-.35, .25) : Math.PI + rnd(-.25, .35));
      drop(x + rnd(-26, 26) * u0, y + rnd(-4, 6) * u0, a, rnd(130, 460) * u0, rnd(.55, 1.05), rnd(2.6, 7.2) * u0, { gy: 1250 });
    }
    // 水の膜がぱしゃっと平たく広がる／しぶきの筋
    emit(base('puff', { x, y, vx: 0, vy: -8, life: .3, s0: 40 * u0, s1: 210 * u0, a: .75 * fa, spr: S.mist, v: 0, add: true, st: .4, fadeIn: .1 }));
    for (let i = 0; i < Math.round(12 * ql); i++) {
      const a = -Math.PI / 2 + rnd(-1.35, 1.35);
      emit(base('streak', { x: x + Math.cos(a) * 10 * u0, y: y + Math.sin(a) * 6 * u0, ang: a, len: rnd(40, 96) * u0, w: rnd(1.4, 2.4) * u0, c: '#8fd4ff', a: .85, life: rnd(.16, .28) }));
    }
    // 大きな水の束（太く短い）
    for (let i = 0; i < Math.round(5 * ql); i++) drop(x + rnd(-14, 14) * u0, y, -Math.PI / 2 + rnd(-.7, .7), rnd(200, 340) * u0, rnd(.5, .75), rnd(6, 9) * u0, { gy: 1300 });
    // 波紋
    emit(base('ring', { x, y, r0: 8 * u0, r1: 112 * u0, ky: .38, c: '#d6f4ff', w: 5 * u0, a: .95 * fa, life: .42, add: false }));
    emit(base('ring', { x, y, r0: 4 * u0, r1: 74 * u0, ky: .38, c: '#8fd4ff', w: 3.4 * u0, a: .85 * fa, life: .34, add: false }));
    emit(base('ring', { x, y, r0: 6 * u0, r1: 150 * u0, ky: .38, c: '#ffffff', w: 2 * u0, a: .5 * fa, life: .55, add: true }));
    // 水しぶきの霧
    for (let i = 0; i < Math.round(6 * ql); i++)
      emit(base('puff', { x: x + rnd(-30, 30) * u0, y: y + rnd(-8, 8) * u0, vx: rnd(-50, 50), vy: -rnd(20, 70), life: rnd(.45, .75), s0: 30 * u0, s1: 90 * u0, a: .55, spr: S.mist, v: Math.random() < .5 ? 0 : 1, add: false, drag: 2, fadeIn: .15 }));
    // あとに残る水滴（ゆっくり落ちていく）
    for (let i = 0; i < Math.round(9 * ql); i++)
      drop(x + rnd(-50, 50) * u0, y + rnd(-26, 6) * u0, Math.PI / 2 + rnd(-.6, .6), rnd(8, 60), rnd(.9, 1.2), rnd(1.4, 3) * u0, { gy: 500, drag: 1.5 });
  }

  // ============================================================
  // 木＝風：らせんの風の渦
  // ============================================================
  function shootWind(o) {
    const S = sprites(), u0 = unit(o.big), path = makePath(o.x0, o.y0, o.x1, o.y1), q = o.q;
    let accL = 0, accD = 0, accP = 0, blasted = false;
    const fa = fadeOf(q);
    const R = 17 * u0;
    return {
      dur: o.ms + 1100,
      draw(g, t, dt) {
        const f = Math.min(1, t / o.ms);
        if (t < o.ms) {
          const [x, y] = path.pt(f), ang = path.dir(f);
          const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
          const grow = .55 + .45 * Math.min(1, f * 3);
          // 薄い緑の風のもや（弾の周り）
          g.globalCompositeOperation = 'lighter'; g.globalAlpha = .55 * fa;
          const gs = R * 5.6 * grow; g.drawImage(S.gGreen, x - gs / 2, y - gs / 2, gs, gs);
          // らせんの風：先がとがった帯が、進行方向の後ろへ向かって広がりながらくるくる回る（手前は太く明るく、奥は細く淡く）
          const spanBase = .38 * Math.min(1, f * 3) + .02, spin = t * .026, STR = 5, NN = 16;
          g.lineCap = 'round'; g.lineJoin = 'round';
          for (let s = 0; s < STR; s++) {
            const ph0 = spin * (1 + (s % 2) * .14) + s * (TAU / STR), sp = spanBase * (.62 + (s % 3) * .2);
            const pts = [];
            for (let i = 0; i <= NN; i++) {
              const k = i / NN, uu = Math.max(0, f - k * sp);
              const [px, py] = path.pt(uu), rad = R * (.5 + k * 1.9) * grow, ph = ph0 - k * 5;
              pts.push([px + nx * Math.sin(ph) * rad + dx * Math.cos(ph) * R * .2, py + ny * Math.sin(ph) * rad + dy * Math.cos(ph) * R * .2, Math.cos(ph), k]);
            }
            // 帯（先端＝太く／後端＝細く）
            const Lp = [], Rp = [];
            for (let i = 0; i <= NN; i++) {
              const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(NN, i + 1)], tx = p1[0] - p0[0], ty = p1[1] - p0[1], tl = Math.hypot(tx, ty) || 1;
              const w = R * .62 * Math.pow(1 - pts[i][3], 1.1) * (.55 + .45 * (pts[i][2] + 1) / 2) * grow;
              Lp.push([pts[i][0] - ty / tl * w, pts[i][1] + tx / tl * w]); Rp.push([pts[i][0] + ty / tl * w, pts[i][1] - tx / tl * w]);
            }
            g.beginPath(); Lp.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); for (let i = NN; i >= 0; i--) g.lineTo(Rp[i][0], Rp[i][1]); g.closePath();
            const gr = g.createLinearGradient(pts[0][0], pts[0][1], pts[NN][0], pts[NN][1]);
            gr.addColorStop(0, 'rgba(226,255,226,.95)'); gr.addColorStop(.5, 'rgba(120,235,140,.5)'); gr.addColorStop(1, 'rgba(90,220,120,0)');
            g.globalAlpha = clamp(f * 4, 0, 1) * .85; g.fillStyle = gr; g.fill();
            g.globalAlpha = clamp(f * 4, 0, 1) * .55; g.strokeStyle = '#f2fff0'; g.lineWidth = 1.3 * u0;
            g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
          }
          // 中心の渦（小さな楕円の輪がぐるぐる）
          for (let s = 0; s < 3; s++) {
            g.save(); g.translate(x, y); g.rotate(ang + s * .55);
            g.globalAlpha = .85; g.strokeStyle = s === 1 ? '#ffffff' : '#a6f5a8'; g.lineWidth = (2.8 - s * .5) * u0;
            const rr = R * (1.05 - s * .22) * grow, a0 = spin * (2 + s) + s * 2;
            g.beginPath(); g.ellipse(0, 0, rr * 1.25, rr * .62, 0, a0, a0 + Math.PI * 1.15); g.stroke(); g.restore();
          }
          g.globalAlpha = .9 * fa; const cs = R * 1.8 * grow; g.drawImage(S.gWhite, x - cs / 2, y - cs / 2, cs, cs);
          // 空気のかたまり（ふわっとした白緑のもやが後ろへ流れる：風の体積感）
          accP += dt * 80 * q * load();
          while (accP >= 1) {
            accP -= 1;
            emit(base('puff', { x: x + rnd(-R, R) * .7, y: y + rnd(-R, R) * .7, vx: -dx * rnd(30, 110) + rnd(-20, 20), vy: -dy * rnd(30, 110) + rnd(-20, 20), life: rnd(.2, .36), s0: R * 1.8, s1: R * 4, a: .2, spr: S.wind, v: Math.random() < .5 ? 0 : 1, add: true, drag: 2.4 }));
          }

          // 後ろへ流れる風の線
          accL += dt * 60 * q * load();
          while (accL >= 1) {
            accL -= 1;
            const off = rnd(-1.4, 1.4) * R;
            emit(base('streak', { x: x + nx * off, y: y + ny * off, ang: Math.atan2(-dy, -dx) + rnd(-.08, .08), len: rnd(26, 70) * u0, w: rnd(1.1, 1.9) * u0, c: '#9af0a8', a: .85, life: rnd(.16, .28) }));
          }
          // 巻き込まれた葉・ほこり
          accD += dt * 50 * q * load();
          while (accD >= 1) {
            accD -= 1;
            if (Math.random() < .6) leaf(x + rnd(-R, R), y + rnd(-R, R), Math.atan2(-dy, -dx) + rnd(-1.3, 1.3), rnd(60, 190), rnd(.4, .7), rnd(14, 23) * u0);
            else emit(base('puff', { x: x + rnd(-R, R), y: y + rnd(-R, R), vx: -dx * rnd(40, 130) + rnd(-30, 30), vy: -dy * rnd(40, 130) + rnd(-30, 30), life: rnd(.2, .34), s0: R * .8, s1: R * 2.1, a: .38, spr: S.wind, v: Math.random() < .5 ? 0 : 1, add: true, drag: 3 }));
          }
        } else if (!blasted) {
          blasted = true;
          blastWind(o.x1, o.y1, u0, q, Math.atan2(o.y1 - o.y0, o.x1 - o.x0));
        }
      }
    };
  }
  function blastWind(x, y, u0, q, dir) {
    const S = sprites(), ql = q * load(), fa = fadeOf(q);
    flashAt(x, y, S.gWhite, 50 * u0, 190 * u0, .45 * fa, .18);
    flashAt(x, y, S.gGreen, 100 * u0, 360 * u0, .6 * fa, .34);
    // 風の刃：2本が交差して走り、少し遅れて短い1本（斜め × と横の一閃）
    const slashes = [{ ang: .62, ox: -8, oy: -6, len: 150, bend: 12, d: 0 }, { ang: -.66, ox: 8, oy: -4, len: 165, bend: -12, d: 45 }, { ang: .04, ox: 0, oy: 3, len: 120, bend: 8, d: 90 }];
    const only = q < .6 ? (Math.random() < .5 ? 0 : 1) : -1;   // 連撃のときは刃を1本だけ（重なって白く潰れないように）
    slashes.forEach((sl, i) => {
      if (only >= 0 ? i !== only : (i === 2 && ql < .6)) return;
      setTimeout(() => {
        emit(base('slash', { x: x + sl.ox * u0, y: y + sl.oy * u0, ang: sl.ang, len: sl.len * u0, th: 24 * u0, bend: sl.bend * u0, c: '#74e48a', a: .95 * fa, life: .34 }));
      }, sl.d);
    });
    // 衝撃リングと、渦がほどけていく弧
    emit(base('ring', { x, y, r0: 10 * u0, r1: 118 * u0, ky: .46, c: '#b4ffb8', w: 6 * u0, a: .95 * fa, life: .34, add: true }));
    emit(base('ring', { x, y, r0: 6 * u0, r1: 76 * u0, ky: .46, c: '#ffffff', w: 3 * u0, a: .85 * fa, life: .26, add: true }));
    for (let i = 0; i < 3; i++)
      emit(base('arc', { x, y, r0: (14 + i * 10) * u0, r1: (68 + i * 22) * u0, ky: .5, a0: rnd(0, TAU), spin: (i % 2 ? -1 : 1) * rnd(9, 14), sweep: Math.PI * rnd(.9, 1.4), c: i === 1 ? '#f3fff0' : '#8aeb9a', w: (4.4 - i) * u0, a: .9, life: rnd(.3, .46) }));
    // 放射状に走る風の線
    const N = Math.round(14 * ql);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU + rnd(-.12, .12);
      emit(base('streak', { x: x + Math.cos(a) * 14 * u0, y: y + Math.sin(a) * 9 * u0, ang: a, len: rnd(44, 100) * u0, w: rnd(1.2, 2.2) * u0, c: '#9af0a8', a: .9, life: rnd(.2, .34) }));
    }
    // 舞い散る葉（のこる）
    for (let i = 0; i < Math.round(10 * ql); i++) leaf(x + rnd(-18, 18) * u0, y + rnd(-8, 8) * u0, rnd(0, TAU), rnd(100, 320) * u0, rnd(.7, 1.15), rnd(14, 24) * u0, { gy: 90 });
    // 風のもや
    for (let i = 0; i < Math.round(5 * ql); i++)
      emit(base('puff', { x: x + rnd(-30, 30) * u0, y: y + rnd(-8, 8) * u0, vx: rnd(-90, 90), vy: rnd(-50, 10), life: rnd(.3, .5), s0: 30 * u0, s1: 96 * u0, a: .4, spr: S.wind, v: Math.random() < .5 ? 0 : 1, add: true, drag: 3 }));
  }

  // ============================================================
  // 光：いなずまの玉 → 落雷
  // ============================================================
  function shootLight(o) {
    const S = sprites(), u0 = unit(o.big), path = makePath(o.x0, o.y0, o.x1, o.y1), q = o.q, fa = fadeOf(q);
    const R = 15 * u0;
    let accS = 0, blasted = false;
    return {
      dur: o.ms + 950,
      draw(g, t, dt) {
        const f = Math.min(1, t / o.ms);
        if (t < o.ms) {
          const [x, y] = path.pt(f), ang = path.dir(f), nx = -Math.sin(ang), ny = Math.cos(ang);
          const grow = .6 + .4 * Math.min(1, f * 3);
          const r = rng(Math.floor(t / 42) * 977 + 13);          // 約24コマ/秒でちかちか形が変わる
          g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
          g.globalAlpha = .6 * fa; const gs = R * 6 * grow; g.drawImage(S.gYellow, x - gs / 2, y - gs / 2, gs, gs);
          // 後ろへのびるいなずまの尾（2本）
          const N = 9, span = .3 * Math.min(1, f * 3) + .01;
          for (let b = 0; b < 2; b++) {
            const pts = [];
            for (let i = 0; i <= N; i++) {
              const k = i / N, uu = Math.max(0, f - k * span), [px, py] = path.pt(uu), j = i ? (r() - .5) * 2 * R * (.5 + k * 1.2) * grow : 0;
              pts.push([px + nx * j, py + ny * j]);
            }
            strokePts(g, pts, 7 * u0 * (b ? .6 : 1), '#ffd84a', .35 * fa);
            strokePts(g, pts, 3 * u0 * (b ? .6 : 1), '#fff3a0', .75);
            strokePts(g, pts, 1.3 * u0, '#ffffff', 1);
          }
          // 玉のまわりでぱちぱちはじける放電
          for (let a = 0; a < 6; a++) {
            const aa = r() * TAU, len = R * (1.3 + r() * 1.9) * grow, cx = Math.cos(aa), cy = Math.sin(aa);
            const pts = jagLine(x + cx * R * .4, y + cy * R * .4, x + cx * len, y + cy * len, R * .5, 4, r);
            strokePts(g, pts, 3.4 * u0, '#ffd84a', .35 * fa); strokePts(g, pts, 1.3 * u0, '#ffffff', .95);
          }
          // 核
          g.globalAlpha = 1; const cs = R * 2.4 * grow; g.drawImage(S.gWhite, x - cs / 2, y - cs / 2, cs, cs);
          g.globalAlpha = .9 * fa; const ys = R * 3.4 * grow; g.drawImage(S.gYellow, x - ys / 2, y - ys / 2, ys, ys);
          // 火花
          accS += dt * 60 * q * load();
          while (accS >= 1) { accS -= 1; spark(x, y, Math.atan2(-Math.sin(ang), -Math.cos(ang)) + rnd(-1.4, 1.4), rnd(120, 380), rnd(.18, .38), pick(['#fff7b0', '#ffe14a', '#ffffff']), { gy: 200, len: rnd(8, 16) }); }
        } else if (!blasted) {
          blasted = true;
          strikeLight(o.x1, o.y1, u0, q);
        }
      }
    };
  }
  function strikeLight(x, y, u0, q) {
    const S = sprites(), ql = q * load(), fa = fadeOf(q);
    flashAt(x, y, S.gWhite, 80 * u0, 300 * u0, .85 * fa, .2);
    flashAt(x, y, S.gYellow, 110 * u0, 430 * u0, .8 * fa, .36);
    // 落雷：上から一直線に落ちて、ちかちか3回光る
    const barrage = q < .6;                                  // 連撃のときは雷を細く・短く・少なく（画面が雷で埋まらないように）
    const top = Math.max(-20, y - (barrage ? 300 : 430) * u0), seed = Math.floor(Math.random() * 1e6), bw = barrage ? .65 : 1;
    for (let k = 0; k < (barrage ? 1 : 3); k++) {
      setTimeout(() => {
        const r = rng(seed + k * 131), sx = x + rnd(-34, 34) * u0, main = jagLine(sx, top, x, y, 40 * u0, 11, r);
        emit(base('bolt', { pts: main, w: (4.4 - k * .6) * u0 * bw, c: '#ffd84a', c2: '#ffffff', a: barrage ? .85 : 1, life: .2 + k * .03 }));
        for (let b = 0; b < (barrage ? 1 : 3); b++) {                       // 枝分かれ
          const m = main[2 + Math.floor(r() * 7)], dir = (r() < .5 ? -1 : 1);
          emit(base('bolt', { pts: jagLine(m[0], m[1], m[0] + dir * (50 + r() * 70) * u0, m[1] + (40 + r() * 70) * u0, 14 * u0, 5, r), w: 2.2 * u0 * bw, c: '#ffd84a', c2: '#ffffff', a: .95, life: .16 }));
        }
        // 地面を走る放電
        for (let b = 0; b < (barrage ? 1 : 5); b++) {
          const a = b % 2 ? Math.PI + rnd(-.5, .5) : rnd(-.5, .5), len = rnd(50, 120) * u0;
          emit(base('bolt', { pts: jagLine(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len * .45, 16 * u0, 6, r), w: 2.2 * u0, c: '#ffd84a', c2: '#ffffff', a: .95, life: .18 }));
        }
      }, k * 55);
    }
    emit(base('ring', { x, y, r0: 10 * u0, r1: 118 * u0, ky: .46, c: '#ffe45e', w: 6 * u0, a: .95 * fa, life: .32, add: true }));
    emit(base('ring', { x, y, r0: 6 * u0, r1: 76 * u0, ky: .46, c: '#ffffff', w: 3 * u0, a: .9 * fa, life: .24, add: true }));
    for (let i = 0; i < Math.round(20 * ql); i++) spark(x, y, rnd(0, TAU), rnd(160, 480) * u0, rnd(.3, .7), pick(['#fff7b0', '#ffe14a', '#ffffff']), { gy: 420, len: rnd(10, 22) });
    for (let i = 0; i < Math.round(5 * ql); i++) emit(base('star', { x: x + rnd(-50, 50) * u0, y: y + rnd(-34, 12) * u0, s: rnd(12, 26) * u0, c: '#fff6b8', a: 1, rot: rnd(0, 1.5), vr: rnd(-3, 3), life: rnd(.3, .55) }));
    // 焦げた煙（うっすら残る）
    for (let i = 0; i < Math.round(3 * ql); i++) smoke(x + rnd(-24, 24) * u0, y + rnd(-6, 8) * u0, rnd(-14, 14), -rnd(24, 54) * u0, rnd(.5, .8), 28 * u0, 70 * u0, .22);
  }

  // ============================================================
  // 闇：黒い球 → 闇のはじけ
  // ============================================================
  function shootDark(o) {
    const S = sprites(), u0 = unit(o.big), path = makePath(o.x0, o.y0, o.x1, o.y1), q = o.q, fa = fadeOf(q);
    const R = 21 * u0;
    let accM = 0, accS = 0, blasted = false;
    return {
      dur: o.ms + 1000,
      draw(g, t, dt) {
        const f = Math.min(1, t / o.ms);
        if (t < o.ms) {
          const [x, y] = path.pt(f), ang = path.dir(f), dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx, bx = -dx, by = -dy;
          const grow = .6 + .4 * Math.min(1, f * 3);
          // 後ろへ流れる濃い黒煙（ときどきむらさきの火が混じる）
          accM += dt * 90 * q * load();
          while (accM >= 1) {
            accM -= 1;
            const px = x + bx * R * .8 + rnd(-R, R) * .6, py = y + by * R * .8 + rnd(-R, R) * .6, vx = bx * rnd(30, 120) + rnd(-26, 26), vy = by * rnd(30, 120) + rnd(-26, 26);
            emit(base('puff', { x: px, y: py, vx, vy, life: rnd(.24, .44), s0: R * 1.7, s1: R * 3.6, a: .9, spr: S.dark, v: Math.random() < .5 ? 0 : 1, add: false, drag: 2, fadeIn: .1 }));
            if (Math.random() < .45) emit(base('puff', { x: px + rnd(-6, 6), y: py + rnd(-6, 6), vx: vx * 1.2, vy: vy * 1.2, life: rnd(.14, .26), s0: R * .9, s1: R * 1.8, a: .3, spr: S.violet, v: Math.random() < .5 ? 0 : 1, add: true, drag: 2 }));
          }
          // むらさきのオーラ
          g.globalCompositeOperation = 'lighter'; g.globalAlpha = .6 * fa;
          const gs = R * 5.6 * grow; g.drawImage(S.gViolet, x - gs / 2, y - gs / 2, gs, gs);
          // うずまく闇の帯：黒い帯が後ろへ向かって広がりながら回る（縁はむらさきに光る）
          const spanBase = .36 * Math.min(1, f * 3) + .02, spin = t * .024, STR = 4, NN = 14;
          g.lineCap = 'round'; g.lineJoin = 'round';
          for (let st = 0; st < STR; st++) {
            const ph0 = spin * (1 + (st % 2) * .14) + st * (TAU / STR), sp = spanBase * (.65 + (st % 3) * .18), pts = [];
            for (let i = 0; i <= NN; i++) {
              const k = i / NN, uu = Math.max(0, f - k * sp), [px, py] = path.pt(uu), rad = R * (.6 + k * 1.7) * grow, ph = ph0 - k * 5;
              pts.push([px + nx * Math.sin(ph) * rad + dx * Math.cos(ph) * R * .2, py + ny * Math.sin(ph) * rad + dy * Math.cos(ph) * R * .2, k]);
            }
            const Lp = [], Rp = [];
            for (let i = 0; i <= NN; i++) {
              const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(NN, i + 1)], tx = p1[0] - p0[0], ty = p1[1] - p0[1], tl = Math.hypot(tx, ty) || 1;
              const w = R * .7 * Math.pow(1 - pts[i][2], 1.05) * grow;
              Lp.push([pts[i][0] - ty / tl * w, pts[i][1] + tx / tl * w]); Rp.push([pts[i][0] + ty / tl * w, pts[i][1] - tx / tl * w]);
            }
            g.globalCompositeOperation = 'source-over';
            g.beginPath(); Lp.forEach((pp, i) => i ? g.lineTo(pp[0], pp[1]) : g.moveTo(pp[0], pp[1])); for (let i = NN; i >= 0; i--) g.lineTo(Rp[i][0], Rp[i][1]); g.closePath();
            const gr = g.createLinearGradient(pts[0][0], pts[0][1], pts[NN][0], pts[NN][1]);
            gr.addColorStop(0, 'rgba(8,0,20,.95)'); gr.addColorStop(.55, 'rgba(40,10,80,.6)'); gr.addColorStop(1, 'rgba(70,20,130,0)');
            g.globalAlpha = clamp(f * 4, 0, 1); g.fillStyle = gr; g.fill();
            g.globalCompositeOperation = 'lighter'; g.globalAlpha = clamp(f * 4, 0, 1) * .6; g.strokeStyle = '#b070ff'; g.lineWidth = 1.5 * u0;
            g.beginPath(); pts.forEach((pp, i) => i ? g.lineTo(pp[0], pp[1]) : g.moveTo(pp[0], pp[1])); g.stroke();
          }
          // 球の本体：まっ黒な球＋むらさきの縁（ゆらぐ）
          const rr = R * 1.1 * grow * (1 + Math.sin(t * .04) * .05);
          g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
          const bg = g.createRadialGradient(x, y, 0, x, y, rr * 1.2);
          bg.addColorStop(0, '#000'); bg.addColorStop(.66, '#0a0016'); bg.addColorStop(.9, '#34106a'); bg.addColorStop(1, 'rgba(70,20,130,0)');
          g.fillStyle = bg; g.beginPath(); g.arc(x, y, rr * 1.2, 0, TAU); g.fill();
          g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
          g.globalAlpha = .4 * fa; g.strokeStyle = '#a45cff'; g.lineWidth = 7 * u0; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.stroke();
          g.globalAlpha = .9; g.strokeStyle = '#cf9cff'; g.lineWidth = 2 * u0; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.stroke();
          // 球の表面でゆれるむらさきの光（渦）
          for (let a = 0; a < 2; a++) {
            const a0 = t * (.012 + a * .005) + a * 2.6, rad = rr * (.72 - a * .2);
            g.globalAlpha = .7; g.strokeStyle = a ? '#e7d0ff' : '#8f48e6'; g.lineWidth = (2.2 - a * .5) * u0;
            g.beginPath(); g.ellipse(x, y, rad, rad * .6, ang + a, a0, a0 + Math.PI * .9); g.stroke();
          }
          // 火花（むらさき・マゼンタ）
          accS += dt * 46 * q * load();
          while (accS >= 1) { accS -= 1; spark(x, y, Math.atan2(by, bx) + rnd(-1.3, 1.3), rnd(80, 300), rnd(.25, .5), pick(['#c58cff', '#ff7de8', '#8a4cff']), { gy: -40, len: rnd(8, 16), w: 2.2 }); }
        } else if (!blasted) {
          blasted = true;
          burstDark(o.x1, o.y1, u0, q);
        }
      }
    };
  }
  function burstDark(x, y, u0, q) {
    const S = sprites(), ql = q * load(), fa = fadeOf(q);
    flashAt(x, y, S.gViolet, 100 * u0, 400 * u0, .9 * fa, .4);
    flashAt(x, y, S.gWhite, 40 * u0, 150 * u0, .5 * fa, .14);
    // 黒い煙がぶわっと広がる（むらさきの下地つき）
    for (let i = 0; i < Math.round(11 * ql); i++) {
      const a = rnd(0, TAU), sp = rnd(50, 230) * u0, vx = Math.cos(a) * sp, vy = Math.sin(a) * sp * .72 - rnd(10, 60) * u0, px = x + Math.cos(a) * rnd(0, 10) * u0, py = y + Math.sin(a) * rnd(0, 8) * u0;
      emit(base('puff', { x: px, y: py, vx, vy, life: rnd(.4, .72), s0: 30 * u0, s1: 110 * u0 * rnd(.8, 1.2), a: .8, spr: S.dark, v: Math.random() < .5 ? 0 : 1, add: false, drag: 3, fadeIn: .1 }));
      emit(base('puff', { x: px, y: py, vx: vx * .9, vy: vy * .9, life: rnd(.3, .5), s0: 26 * u0, s1: 90 * u0, a: .55, spr: S.violet, v: Math.random() < .5 ? 0 : 1, add: true, drag: 3 }));
    }
    // 闇の爪あと（斜めに2本）
    [{ ang: .62, ox: -8, oy: -6, len: 150, bend: 12, d: 0 }, { ang: -.66, ox: 8, oy: -4, len: 165, bend: -12, d: 50 }].forEach((sl, i) => {
      if (q < .6 && i) return;
      setTimeout(() => emit(base('slash', { x: x + sl.ox * u0, y: y + sl.oy * u0, ang: sl.ang, len: sl.len * u0, th: 20 * u0, bend: sl.bend * u0, c: '#8a3df0', c2: '#f0dcff', a: .95 * fa, life: .34 })), sl.d);
    });
    // 衝撃波（黒い輪＋むらさきの輪）
    emit(base('ring', { x, y, r0: 10 * u0, r1: 118 * u0, ky: .46, c: '#1a0630', w: 9 * u0, a: .9 * fa, life: .36, add: false }));
    emit(base('ring', { x, y, r0: 10 * u0, r1: 124 * u0, ky: .46, c: '#b878ff', w: 4.5 * u0, a: .95 * fa, life: .32, add: true }));
    emit(base('ring', { x, y, r0: 6 * u0, r1: 78 * u0, ky: .46, c: '#f0dcff', w: 2.5 * u0, a: .85 * fa, life: .24, add: true }));
    // 四方へのびる闇のすじ
    const N = Math.round(12 * ql);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU + rnd(-.12, .12);
      emit(base('streak', { x: x + Math.cos(a) * 14 * u0, y: y + Math.sin(a) * 9 * u0, ang: a, len: rnd(46, 104) * u0, w: rnd(1.3, 2.3) * u0, c: '#a45cff', c2: '#f0dcff', a: .9, life: rnd(.22, .36) }));
    }
    for (let i = 0; i < Math.round(14 * ql); i++) spark(x, y, rnd(0, TAU), rnd(120, 400) * u0, rnd(.4, .8), pick(['#c58cff', '#ff7de8', '#8a4cff', '#e8c8ff']), { gy: 120, len: rnd(10, 20), w: 2.4 });
    // 立ちのぼる黒い煙（のこる）
    for (let i = 0; i < Math.round(4 * ql); i++) emit(base('puff', { x: x + rnd(-34, 34) * u0, y: y + rnd(-10, 12) * u0, vx: rnd(-16, 16), vy: -rnd(30, 70) * u0, life: rnd(.7, 1), s0: 34 * u0, s1: 96 * u0, a: .5, spr: S.dark, v: Math.random() < .5 ? 0 : 1, add: false, drag: 1.2, fadeIn: .15 }));
  }

  // ============================================================
  // 攻撃前の「ため」：敵のまわりに小さく（時間は game.js の待ちの中に収まる）
  // ============================================================
  function chargeFx(attr, x, y, r) {
    if (!ATTRS[attr]) return;
    const S = sprites(), u0 = clamp(Math.min(window.innerWidth, 560) / 390, .8, 1.35) * SCALE, ql = load() * QUALITY;
    const rad = clamp(r || 60, 40, 150);
    ensureCanvas();
    const n = Math.round(11 * ql);
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU), d = rnd(.85, 1.35) * rad, sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d * .8, life = rnd(.18, .26);
      const vx = (x - sx) / life, vy = (y - sy) / life;
      if (attr === 'fire') flame(sx, sy, vx * .85, vy * .85 - 30, life, 22 * u0, 9 * u0, .8, { st: 1.1, drag: 0, r0: 2, r1: 7 });
      else if (attr === 'water') drop(sx, sy, Math.atan2(vy, vx), Math.hypot(vx, vy) * .85, life, rnd(2, 3.6) * u0, { gy: 0, drag: 0 });
      else if (attr === 'light') spark(sx, sy, Math.atan2(vy, vx), Math.hypot(vx, vy) * .85, life, pick(['#fff7b0', '#ffe14a', '#ffffff']), { gy: 0, drag: 0, len: rnd(10, 18) });
      else if (attr === 'dark') spark(sx, sy, Math.atan2(vy, vx), Math.hypot(vx, vy) * .85, life, pick(['#c58cff', '#ff7de8', '#8a4cff']), { gy: 0, drag: 0, len: rnd(10, 18), w: 2.6 });
      else leaf(sx, sy, Math.atan2(vy, vx) + 1.1, Math.hypot(vx, vy) * .85, life + .04, rnd(10, 16) * u0, { gy: 0, drag: 0, sway: 0, vr: rnd(-16, 16) });
    }
    const spr = attr === 'fire' ? S.gOrange : attr === 'water' ? S.gCyan : attr === 'light' ? S.gYellow : attr === 'dark' ? S.gViolet : S.gGreen;
    flashAt(x, y, spr, rad * .9, rad * 2.1, .5, .26);
    if (attr === 'wood') emit(base('arc', { x, y, r0: rad * 1.1, r1: rad * .5, ky: .55, a0: rnd(0, TAU), spin: 14, sweep: Math.PI * 1.2, c: '#9af0a8', w: 3 * u0, a: .8, life: .24 }));
    if (attr === 'light') { const r = rng((Math.random() * 1e6) | 0); for (let i = 0; i < 3; i++) { const a = rnd(0, TAU); emit(base('bolt', { pts: jagLine(x + Math.cos(a) * rad * 1.1, y + Math.sin(a) * rad * .9, x + Math.cos(a) * rad * .3, y + Math.sin(a) * rad * .25, 12 * u0, 5, r), w: 2 * u0, c: '#ffd84a', c2: '#fff', a: .9, life: .2 })); } }
    if (attr === 'dark') emit(base('ring', { x, y, r0: rad * 1.25, r1: rad * .5, ky: .55, c: '#b878ff', w: 3.2 * u0, a: .8, life: .24, add: true }));
    if (attr === 'water') emit(base('ring', { x, y, r0: rad * 1.2, r1: rad * .55, ky: .5, c: '#aee4ff', w: 3 * u0, a: .8, life: .24, add: false }));
    kick();   // 粒だけでも描画ループを動かす
  }

  // 最初の攻撃でカクつかないよう、読み込みのあと少し待ってから粒の絵を先に作っておく
  setTimeout(() => { try { sprites(); } catch (e) { /* 失敗しても、最初の攻撃のときに作る */ } }, 600);

  // ------------------------------------------------------------
  // 公開
  // ------------------------------------------------------------
  window.EnemyAttackFx = {
    has(attr) { return !!ATTRS[attr]; },
    tint(attr) { return TINT[attr] || null; },
    charge(attr, x, y, r) { try { chargeFx(attr, x, y, r); } catch (e) { console.error(e); } },
    // o: { attr, x0,y0, x1,y1, ms, hits, big }
    shoot(o) {
      if (!ATTRS[o.attr]) return false;
      try {
        sprites();
        const hits = o.hits || 1;
        // 多段攻撃のときは1発あたりの粒を減らす（全体の量は同じくらいに）
        o.q = clamp((hits <= 2 ? 1 : hits <= 5 ? .8 : hits <= 12 ? .55 : .38) * QUALITY, .25, 1.2);
        const make = { fire: shootFire, water: shootWater, wood: shootWind, light: shootLight, dark: shootDark }[o.attr];
        addFx(make(o));
        return true;
      } catch (e) { console.error('EnemyAttackFx.shoot', e); return false; }
    }
  };
})();
