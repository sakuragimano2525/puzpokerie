// ============================================================
// ★ 全体攻撃（ドロップ5個以上／全体攻撃バフ）★ 作り直し版
//
//   ■ 演出の速さ・待ち時間（ここの数字を変えると調整できます）
//       FX_SPEED … 演出の再生速度（1＝従来／小さいほどゆっくり。0.6なら約1.7倍の長さ）
//       HIT_MS   … 弾が届いてから、敵にダメージが入るまで
//       ※ 弾が飛ぶ時間(ATK_FLY_MS)と、当たってから次の攻撃までの間(ATK_GAP_MS)は
//         単体攻撃と共通で、game.js の先頭付近にあります（ここでは変えません）。
//       NUM_MS   … ダメージ数字が画面に残る時間
//     演出の後半は次の攻撃と少し重なって流れます。
//
//   ■ 演出（本家のように、柔らかい光の粒を大量に重ねた質感）
//       火＝巨大な爆炎＋渦を巻く赤い炎の帯＋火花＋黒煙
//       水＝地面から突き出す半透明の巨大な氷の板＋水しぶき＋白い霧
//       木＝地面から立ち上る風の渦＋大きな葉＋白い風の帯
//       光＝光の柱＋雷（DOM演出）
//       闇＝中心へ吸い込み → 黒紫の煙＋色とりどりのネオンの光線＋地面から昇る闇の炎
//       ※ 火・水・木・闇は Canvas（1枚を共有）、光だけ DOM。
//
//   ※ game.js の後に読み込む。公開しているのは allAttackAnimation(slotIndex, damage, attr) だけ。
//     game.js 側の既存関数（enemyList / getAttrMulti / getEnemyDef / tryDrop / updateEnemyUI /
//     showDamageNumber / spawnEnergyBurst / spawnCastRing / battleShake / playAttrHitSE）を使います。
// ============================================================
(function () {
  'use strict';

  const FX_SPEED = 0.8;   // 演出の再生速度（1＝従来。小さいほどゆっくり）
  const HIT_MS  = 150;    // 弾が届いてから、ダメージが入るまで（演出の閃光が見えてから当たる）
  const NUM_MS  = 1500;   // ダメージ数字が残る時間

  const rnd   = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick  = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const COL   = { fire:'#ff6a00', water:'#5cc8ff', wood:'#6ee66e', light:'#ffe45a', dark:'#a35cf0' };

  let active = 0;      // 再生中の全体攻撃演出の数（多いときは粒の数を減らして軽くする）
  let lastShake = 0;

  // ------------------------------------------------------------
  // 共通：DOM ヘルパー
  // ------------------------------------------------------------
  function mk(parent, css, html) {
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;' + css;
    if (html) d.innerHTML = html;
    parent.appendChild(d);
    return d;
  }
  function an(el, kf, opt) {
    return el.animate ? el.animate(kf, Object.assign({ fill: 'both' }, opt)) : null;
  }
  function makeLayer(life) {
    const L = document.createElement('div');
    L.className = 'aa-fx-layer';
    L.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:150;pointer-events:none;';
    document.body.appendChild(L);
    setTimeout(() => L.remove(), life / FX_SPEED);
    return L;
  }

  // ------------------------------------------------------------
  // 共通：地面まわりの小さな演出
  // ------------------------------------------------------------
  // 地面を走る衝撃リング（つぶれた楕円）
  function groundRing(L, cx, gy, w, color, delay, dur, thick) {
    const rh = w * .26;
    const r = mk(L, `left:${cx - w / 2}px;top:${gy - rh / 2}px;width:${w}px;height:${rh}px;border-radius:50%;border:${thick || 3}px solid ${color};box-shadow:0 0 14px ${color},inset 0 0 12px ${color};`);
    an(r, [{ transform: 'scale(.15)', opacity: 0 }, { transform: 'scale(.55)', opacity: 1, offset: .2 }, { transform: 'scale(1.3)', opacity: 0 }],
      { duration: dur || 520, delay, easing: 'ease-out' });
  }
  // 敵エリア全体を一瞬染める（「全体」であることが分かるように）
  function flashArea(L, A, bg, delay, dur, peak) {
    const f = mk(L, `left:${A.l - 30}px;top:${A.top - 50}px;width:${A.w + 60}px;height:${A.gy - A.top + 80}px;background:${bg};`);
    an(f, [{ opacity: 0 }, { opacity: peak, offset: .22 }, { opacity: 0 }], { duration: dur, delay });
  }
  // きらめき（4方向の星）
  function glint(L, x, y, s, color, delay, dur) {
    const e = mk(L, `left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s}px;`,
      `<svg viewBox="-1 -1 2 2" width="100%" height="100%" style="display:block;overflow:visible"><path d="M0-1L.2-.2L1 0L.2 .2L0 1L-.2 .2L-1 0L-.2-.2Z" fill="${color}"/></svg>`);
    an(e, [{ transform: 'scale(0) rotate(0)', opacity: 0 }, { transform: 'scale(1.15) rotate(45deg)', opacity: 1, offset: .4 }, { transform: 'scale(0) rotate(90deg)', opacity: 0 }],
      { duration: dur || 300, delay });
  }
  // 上へ昇る光の粒（火の粉・魔力の粒など）
  function risers(L, cx, gy, w, n, css, rise, delay, dur) {
    for (let i = 0; i < n; i++) {
      const s = rnd(3, 8), x = cx + rnd(-.5, .5) * w;
      const p = mk(L, `left:${x - s / 2}px;top:${gy - s / 2}px;width:${s}px;height:${s}px;border-radius:50%;${css}`);
      const up = rnd(.45, 1) * rise;
      an(p, [{ transform: 'translate(0,0) scale(1)', opacity: 0 },
             { transform: `translate(${rnd(-12, 12)}px,${-up * .5}px) scale(1)`, opacity: 1, offset: .3 },
             { transform: `translate(${rnd(-26, 26)}px,${-up}px) scale(.2)`, opacity: 0 }],
        { duration: rnd(480, 760), delay: delay + rnd(0, 220), easing: 'ease-out' });
    }
  }

  // ------------------------------------------------------------
  // 敵の位置を集める（足元＝敵画像の下端が「地面」）
  // ------------------------------------------------------------
  function collectTargets() {
    const units = document.querySelectorAll('#enemy-area .enemy-unit');
    const out = [];
    for (let i = 0; i < enemyList.length; i++) {
      const e = enemyList[i], u = units[i];
      if (!e || e.hp <= 0 || !u) continue;
      const r = (u.querySelector('.enemy-img-wrap') || u).getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      out.push({ i, cx: r.left + r.width / 2, w: r.width, h: r.height, top: r.top, gy: r.bottom - Math.min(10, r.height * .06) });
    }
    return out;
  }
  function areaOf(T) {
    const l = Math.min(...T.map(t => t.cx - t.w / 2)), r = Math.max(...T.map(t => t.cx + t.w / 2));
    return { l, r, w: r - l, top: Math.min(...T.map(t => t.top)), gy: Math.max(...T.map(t => t.gy)) };
  }

  // ============================================================
  // 光：光の柱が立ち昇り、雷が落ちる
  // ============================================================
  function boltSVG(w, h) {
    let pts = `${w / 2},0`;
    const seg = 9;
    for (let j = 1; j <= seg; j++) pts += ` ${j === seg ? w / 2 + rnd(-6, 6) : w / 2 + rnd(-w * .32, w * .32)},${h * j / seg}`;
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="display:block;overflow:visible;filter:drop-shadow(0 0 6px #ffe45a) drop-shadow(0 0 16px #ffc400)">
<polyline points="${pts}" fill="none" stroke="#ffd84a" stroke-width="8" stroke-linejoin="round" opacity=".55"/>
<polyline points="${pts}" fill="none" stroke="#fffde0" stroke-width="3.5" stroke-linejoin="round"/></svg>`;
  }
  function fxLight(L, T, A, q) {
    const cascade = (x) => ((x - A.l) / Math.max(1, A.w)) * 70;
    flashArea(L, A, 'radial-gradient(ellipse farthest-side at 50% 60%,rgba(255,255,255,.95),rgba(255,240,140,.45) 55%,rgba(255,230,100,0) 100%)', 60, 420, .85);
    T.forEach(t => {
      const top = t.top - 55, H = t.gy - top, d0 = cascade(t.cx);
      // 雷（一瞬で落ちる）
      const bw = clamp(t.w * .55, 50, 120);
      const b = mk(L, `left:${t.cx - bw / 2}px;top:${top}px;width:${bw}px;height:${H}px;`, boltSVG(bw, H));
      an(b, [{ opacity: 0 }, { opacity: 1, offset: .08 }, { opacity: .25, offset: .3 }, { opacity: 1, offset: .46 }, { opacity: .3, offset: .7 }, { opacity: 0 }], { duration: 380, delay: d0 });
      // 光の柱
      const pw = clamp(t.w * .55, 30, 110);
      const bc = mk(L, `left:${t.cx - pw / 2}px;top:${top}px;width:${pw}px;height:${H}px;background:linear-gradient(to right,rgba(255,235,120,0),rgba(255,250,200,.95) 30%,#fff 50%,rgba(255,250,200,.95) 70%,rgba(255,235,120,0));box-shadow:0 0 26px #ffe45a;-webkit-mask-image:linear-gradient(to bottom,transparent,#000 28%);mask-image:linear-gradient(to bottom,transparent,#000 28%);transform-origin:50% 100%;`);
      an(bc, [{ transform: 'scaleX(.1)', opacity: 0 }, { transform: 'scaleX(1)', opacity: 1, offset: .22 }, { transform: 'scaleX(1.15)', opacity: .9, offset: .55 }, { transform: 'scaleX(1.7)', opacity: 0 }], { duration: 620, delay: d0 + 40, easing: 'ease-out' });
      // 足元のまぶしい光
      const gl = mk(L, `left:${t.cx - t.w * .7}px;top:${t.gy - t.w * .2}px;width:${t.w * 1.4}px;height:${t.w * .4}px;border-radius:50%;background:radial-gradient(ellipse,#fff 0%,rgba(255,240,130,.85) 35%,rgba(255,225,80,0) 72%);`);
      an(gl, [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1)', offset: .2 }, { opacity: 0, transform: 'scale(1.3)' }], { duration: 620, delay: d0 });
      groundRing(L, t.cx, t.gy, t.w * 1.6, 'rgba(255,240,150,.95)', d0 + 30, 520);
      risers(L, t.cx, t.gy, t.w, Math.round(10 * q), 'background:#fff;box-shadow:0 0 10px #ffe45a,0 0 20px #ffe45a;', H * .9, d0 + 60);
      for (let i = 0, n = Math.round(6 * q); i < n; i++)
        glint(L, t.cx + rnd(-.45, .45) * t.w, t.gy - (H - 50) * rnd(.1, .85), rnd(16, 30), '#fffbd0', d0 + rnd(80, 400), 300);
    });
    return 1100;
  }

  // ============================================================
  // Canvas エフェクト（火・水・木・闇）
  //   本家のように、加算合成の柔らかい粒を大量に重ねて「爆炎・霧・渦」の質感を出す。
  //   1枚の透明キャンバスを全エフェクトで共有（重なって再生しても軽い）。
  // ============================================================
  const TAU = Math.PI * 2;
  const ADD = 'lighter', NORM = 'source-over';
  const ease = {
    out2: (u) => 1 - (1 - u) * (1 - u),
    out3: (u) => 1 - Math.pow(1 - u, 3),
    back: (u) => { const c1 = 1.8, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); }
  };
  // 立ち上がり a→b、維持 →c、減衰 →d の0〜1の包絡線
  const env = (t, a, b, c, d) => t <= a ? 0 : t < b ? (t - a) / (b - a) : t <= c ? 1 : t < d ? 1 - (t - c) / (d - c) : 0;

  const E = { cv: null, g: null, ox: 0, oy: 0, W: 0, H: 0, px: 0, fx: [], running: false, last: 0, scale: 1, fe: 16, n: 0 };   // scale：動きが重いときに解像度を落とす倍率 / fe：フレーム間隔(ms)の移動平均

  function ensureCanvas() {
    if (!E.cv) {
      const c = document.createElement('canvas');
      c.id = 'aa-canvas';
      c.style.cssText = 'position:fixed;left:0;top:0;z-index:150;pointer-events:none;display:none;';
      document.body.appendChild(c);
      E.cv = c; E.g = c.getContext('2d');
    }
    // キャンバスは戦闘画面（ダンジョン枠）だけに敷く：描く面積が減って軽く、盤面やパーティ欄にはみ出さない
    const d = document.getElementById('dungeon'), dr = d ? d.getBoundingClientRect() : null;
    const ok = dr && dr.width > 100 && dr.height > 100;
    const ox = ok ? dr.left : 0, oy = ok ? dr.top : 0, w = ok ? dr.width : window.innerWidth, h = ok ? dr.height : window.innerHeight;
    const px = Math.min(window.devicePixelRatio || 1, 1.5) * E.scale;
    if (E.W !== w || E.H !== h || E.px !== px || E.ox !== ox || E.oy !== oy) {
      E.ox = ox; E.oy = oy; E.W = w; E.H = h; E.px = px;
      E.cv.width = Math.round(w * px); E.cv.height = Math.round(h * px);
      E.cv.style.cssText = `position:fixed;left:${ox}px;top:${oy}px;width:${w}px;height:${h}px;z-index:150;pointer-events:none;display:${E.running ? 'block' : 'none'};`;
    }
  }
  function engineAdd(fx) {
    ensureCanvas();
    fx.t0 = performance.now();
    E.fx.push(fx);
    if (!E.running) {
      E.scale = Math.min(1, E.scale * 1.25);
      ensureCanvas();
      E.running = true; E.last = fx.t0; E.cv.style.display = 'block';
      requestAnimationFrame(engineLoop);
    }
  }
  function engineLoop(now) {
    ensureCanvas();
    const g = E.g, raw = now - E.last, dt = Math.min(.05, Math.max(0, raw / 1000));
    if (raw > 0 && raw < 500) E.fe = E.fe * .85 + raw * .15;
    E.last = now;
    g.setTransform(E.px, 0, 0, E.px, -E.ox * E.px, -E.oy * E.px);   // 演出側は画面座標のまま描ける
    g.clearRect(E.ox, E.oy, E.W, E.H);
    for (let i = 0; i < E.fx.length; i++) {
      const fx = E.fx[i], t = Math.max(0, now - fx.t0) * FX_SPEED;   // FX_SPEED でスロー再生（演出は経過時間 t だけで描かれる）
      if (t > fx.dur) { E.fx.splice(i--, 1); continue; }
      g.save();
      try { fx.draw(g, t, dt); } catch (e) { console.error('allAttack canvas fx', e); fx.dur = 0; }
      g.restore();
    }
    // 動きが重い端末（フレーム間隔が長い）では解像度を自動で落とす。演出の見た目はほぼ変わらず、動きが止まらない
    if (++E.n % 6 === 0 && E.fe > 34 && E.scale > .5) E.scale = Math.max(.5, E.scale * .8);
    if (E.fx.length) requestAnimationFrame(engineLoop);
    else { E.running = false; E.cv.style.display = 'none'; }
  }

  // ---------- 粒（スプライト）：小さな円を寄せ集めて輪郭を不規則にした「もこもこ」 ----------
  const SPR = {};
  function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
  function puff(size, rgb, a, seed, n, dmax, rmin, rr) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'), r = rng(seed);
    for (let i = 0, N = n || 11; i < N; i++) {
      const ang = r() * TAU, d = r() * size * (dmax || .14), R = size * ((rmin || .18) + r() * (rr || .16));
      const x = size / 2 + Math.cos(ang) * d, y = size / 2 + Math.sin(ang) * d;
      const gr = g.createRadialGradient(x, y, 0, x, y, R);
      gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(.5, `rgba(${rgb},${a * .5})`); gr.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, size, size);
    }
    return c;
  }
  function leafSprite(c1, c2) {
    const S = 96, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'); g.translate(S / 2, S / 2);
    g.beginPath(); g.moveTo(-S * .44, 0);
    g.bezierCurveTo(-S * .3, -S * .62, S * .2, -S * .6, S * .46, 0);
    g.bezierCurveTo(S * .2, S * .56, -S * .3, S * .56, -S * .44, 0); g.closePath();
    const gr = g.createLinearGradient(0, -S * .45, 0, S * .45); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr; g.fill();
    g.lineWidth = 2.2; g.strokeStyle = 'rgba(15,70,25,.6)'; g.stroke();
    g.strokeStyle = 'rgba(240,255,210,.75)'; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(-S * .42, 0); g.lineTo(S * .4, 0); g.stroke();
    g.lineWidth = 1.6; g.strokeStyle = 'rgba(240,255,210,.5)';
    for (const x of [-.22, -.02, .18]) for (const s of [-1, 1]) { g.beginPath(); g.moveTo(S * x, 0); g.lineTo(S * (x + .14), s * S * .2); g.stroke(); }
    return c;
  }
  function sprites() {
    if (SPR.ok) return SPR;
    const set = (rgb, a, seed, n, dmax, rmin, rr) => [0, 1, 2].map((i) => puff(128, rgb, a, seed + i * 13, n, dmax, rmin, rr));
    // 炎の色の段階：白 → 黄 → 橙 → 赤橙 → 赤 → 暗赤
    const FC = [[255, 255, 238, .9], [255, 238, 140, .9], [255, 186, 52, .88], [255, 112, 22, .86], [222, 48, 10, .82], [150, 20, 6, .78]];
    SPR.fire = Array.from({ length: 12 }, (_, k) => {          // 白→黄→橙→赤→暗赤 を12段に。形は全段で共通（色が変わるだけ）
      const f = k / 11 * 5, i = Math.min(4, Math.floor(f)), t = f - i, a = FC[i], b = FC[i + 1];
      const m = a.map((v, j) => v + (b[j] - v) * t);
      return set(`${m[0] | 0},${m[1] | 0},${m[2] | 0}`, m[3], 11);
    });
    SPR.smoke   = set('30,13,8', .92, 201, 22, .2, .1, .16);
    SPR.mist    = set('232,246,255', .8, 211);
    SPR.cyan    = set('105,212,255', .92, 221);
    SPR.green   = set('150,250,165', .85, 231);
    SPR.dark    = set('24,5,46', .96, 241, 26, .22, .09, .15);
    SPR.violet  = set('150,72,238', .88, 251);
    SPR.magenta = set('255,84,222', .86, 261);
    SPR.leaf    = [leafSprite('#cdf78e', '#2f9a3a'), leafSprite('#a6e46c', '#1f7a2c'), leafSprite('#e4ffb4', '#48b24c')];
    SPR.ok = true;
    return SPR;
  }

  // ---------- 描画ヘルパー ----------
  function drawSpr(g, spr, x, y, size, alpha, rot, st) {
    if (alpha <= .004 || size <= 1) return;
    g.globalAlpha = alpha > 1 ? 1 : alpha;
    const h = size * (st || 1);                      // st：縦の伸び率
    if (rot) { g.save(); g.translate(x, y); g.rotate(rot); g.drawImage(spr, -size / 2, -h / 2, size, h); g.restore(); }
    else g.drawImage(spr, x - size / 2, y - h / 2, size, h);
  }
  // 色の段階 p（0〜5）に最も近い1枚を描く
  function drawRamp(g, ramp, p, v, x, y, size, alpha, rot, st) {
    const i = Math.min(ramp.length - 1, Math.max(0, Math.round(p / 5 * (ramp.length - 1))));
    drawSpr(g, ramp[i][v], x, y, size, alpha, rot, st);
  }
  function radialFill(g, cx, cy, r, stops, f) {
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    stops.forEach(([o, c]) => gr.addColorStop(o, c));
    g.fillStyle = gr; g.fillRect(f.l, f.t, f.w, f.h);
  }
  // 両端が細くとがった三日月状のリボン（楕円の弧に沿う）。風・炎のうねりに使う
  function ribbon(g, cx, cy, rx, ry, a0, sweep, thick, stops, alpha) {
    if (alpha <= .004) return;
    const N = 20, k = ry / rx;
    g.beginPath();
    for (let i = 0; i <= N; i++) {
      const u = i / N, a = a0 + sweep * u, w = Math.sin(Math.PI * u) * thick * .5;
      const x = cx + Math.cos(a) * (rx + w), y = cy + Math.sin(a) * (ry + w * k);
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    for (let i = N; i >= 0; i--) {
      const u = i / N, a = a0 + sweep * u, w = Math.sin(Math.PI * u) * thick * .5;
      g.lineTo(cx + Math.cos(a) * (rx - w), cy + Math.sin(a) * (ry - w * k));
    }
    g.closePath();
    const gr = g.createLinearGradient(cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry, cx + Math.cos(a0 + sweep) * rx, cy + Math.sin(a0 + sweep) * ry);
    stops.forEach(([o, c]) => gr.addColorStop(o, c));
    g.fillStyle = gr; g.globalAlpha = Math.min(1, alpha); g.fill();
  }
  // 4方向のきらめき
  function star4(g, x, y, s, alpha, rot) {
    if (alpha <= .004) return;
    g.save(); g.translate(x, y); g.rotate(rot || 0); g.globalAlpha = Math.min(1, alpha);
    g.beginPath();
    g.moveTo(0, -s); g.lineTo(s * .16, -s * .16); g.lineTo(s, 0); g.lineTo(s * .16, s * .16);
    g.lineTo(0, s); g.lineTo(-s * .16, s * .16); g.lineTo(-s, 0); g.lineTo(-s * .16, -s * .16); g.closePath();
    g.fillStyle = '#fff'; g.fill(); g.restore();
  }

  // 演出の範囲：敵エリア（足元＝地面）と、画面いっぱいに染める用のダンジョン全体
  function regionOf(A) {
    const d = document.getElementById('dungeon'), dr = d ? d.getBoundingClientRect() : null;
    const ok = dr && dr.width > 100 && dr.height > 100;
    const full = ok ? { l: dr.left, t: dr.top, w: dr.width, h: dr.height }
                    : { l: A.l - 20, t: A.top - 80, w: A.w + 40, h: A.gy - A.top + 100 };
    const gy = A.gy, eh = Math.max(60, A.gy - A.top);
    const h = clamp(eh * 1.9, 240, Math.max(260, gy - full.t));
    return { full, l: full.l, w: full.w, gy, top: gy - h, h, eh, cx: (A.l + A.r) / 2, cy: gy - eh * .5, A };
  }

  // ============================================================
  // 火：巨大な爆炎（黄白い核 → 橙 → 赤 → 黒煙）＋ 渦を巻く赤い炎の帯＋火花
  // ============================================================
  function fireFx(Z, q) {
    const SP = sprites(), S = Z.w, D = 1100, qa = .65 + .35 * q;
    const cx = Z.cx + rnd(-.05, .05) * S, cy = Z.cy - Z.eh * .32;
    const sx = S * .5, sy = Math.max(Z.full.h * .3, Z.h * .62);
    const fire = [], smoke = [], arcs = [], sparks = [];
    for (let i = 0, n = Math.round(54 * q); i < n; i++) {
      const a = rnd(0, TAU), r = Math.sqrt(Math.random());
      fire.push({ ox: Math.cos(a) * r * sx, oy: Math.sin(a) * r * sy * .85 - sy * .08, r,
        delay: rnd(0, 180), life: rnd(560, 900), s0: S * rnd(.15, .26), s1: S * rnd(.34, .56),
        rot: rnd(0, TAU), vr: rnd(-1.4, 1.4), v: i % 3, rise: rnd(20, 90) });
    }
    // 外側で細かくうねる炎の舌（輪郭に細部を足す）
    for (let i = 0, n = Math.round(32 * q); i < n; i++) {
      const a = rnd(0, TAU), r = rnd(.45, 1.1);
      fire.push({ ox: Math.cos(a) * r * sx, oy: Math.sin(a) * r * sy * .8 - sy * .1, r: Math.min(1, r),
        delay: rnd(40, 320), life: rnd(320, 560), s0: S * rnd(.06, .1), s1: S * rnd(.1, .2),
        rot: rnd(-.3, .3), vr: rnd(-.25, .25), v: i % 3, rise: rnd(80, 240), st: 1.9 });
    }
    for (let i = 0, n = Math.round(20 * q); i < n; i++) {
      const a = rnd(0, TAU), r = rnd(.55, 1.1);
      smoke.push({ ox: Math.cos(a) * r * sx, oy: Math.sin(a) * r * sy * .8 - sy * .15,
        delay: rnd(150, 450), life: rnd(600, 800), s0: S * rnd(.26, .4), s1: S * rnd(.46, .7),
        rot: rnd(0, TAU), vr: rnd(-.8, .8), v: i % 3, rise: rnd(60, 200) });
    }
    for (let i = 0, n = Math.round(5 * q + .5); i < n; i++) {
      arcs.push({ rx: S * rnd(.2, .48), a0: rnd(0, TAU), sweep: rnd(1.7, 3.0), thick: S * rnd(.07, .14),
        w: rnd(8, 13) * (i % 2 ? -1 : 1), delay: rnd(0, 140), life: rnd(520, 720), ox: rnd(-.05, .05) * S, oy: rnd(-.06, .04) * Z.h });
    }
    for (let i = 0, n = Math.round(46 * q); i < n; i++) {
      sparks.push({ ang: rnd(0, TAU), spd: rnd(300, 1150), delay: rnd(0, 220), life: rnd(380, 820), size: rnd(1.6, 3.8),
        ox: rnd(-.1, .1) * S, oy: rnd(-.08, .08) * Z.h });
    }
    const redArc = [[0, 'rgba(255,50,20,0)'], [.3, 'rgba(235,30,15,.95)'], [.7, 'rgba(255,120,40,.9)'], [1, 'rgba(255,210,110,0)']];
    return { dur: D, draw(g, t) {
      const f = Z.full;
      // ① 周辺を焦がす暗い赤のビネット（中心の明るさを際立たせる）
      g.globalCompositeOperation = NORM;
      const va = env(t, 0, 130, 520, 1000) * .6 * qa;
      if (va > .01) { g.globalAlpha = va; radialFill(g, cx, cy, S * .8, [[0, 'rgba(60,5,0,0)'], [.45, 'rgba(60,5,0,0)'], [1, 'rgba(40,2,0,1)']], f); }
      // ② 黒煙
      for (const p of smoke) {
        const lt = t - p.delay; if (lt < 0 || lt > p.life) continue;
        const u = lt / p.life, m = ease.out3(Math.min(1, u * 1.3));
        drawSpr(g, SP.smoke[p.v], cx + p.ox * m * 1.1, cy + p.oy * m - p.rise * u, p.s0 + (p.s1 - p.s0) * u,
          Math.min(1, u / .2) * (1 - u) * .62 * qa, p.rot + p.vr * lt / 1000);
      }
      // ③ 爆炎（加算合成）：古い粒ほど赤く・外側ほど赤く
      g.globalCompositeOperation = ADD;
      for (const p of fire) {
        const lt = t - p.delay; if (lt < 0 || lt > p.life) continue;
        const u = lt / p.life, m = ease.out3(Math.min(1, u * 1.5));
        const lvl = clamp(u * 4.4 + p.r * 1.3 - .2, 0, 4.98);
        drawRamp(g, SP.fire, lvl, p.v, cx + p.ox * m, cy + p.oy * m - p.rise * u, p.s0 + (p.s1 - p.s0) * ease.out2(u),
          Math.min(1, u / .12) * Math.pow(1 - u, 1.15) * .66 * qa, p.rot + p.vr * lt / 1000, p.st);
      }
      // ④ 渦を巻く赤い炎の帯
      g.globalCompositeOperation = NORM;
      for (const p of arcs) {
        const lt = t - p.delay; if (lt < 0 || lt > p.life) continue;
        const u = lt / p.life, e = Math.min(1, u / .15) * Math.pow(1 - u, .8) * qa;
        const rx = p.rx * (.55 + .6 * ease.out2(u)), a = p.a0 + p.w * lt / 1000, x = cx + p.ox, y = cy + p.oy;
        ribbon(g, x, y, rx, rx * .7, a, p.sweep, p.thick * 1.8, redArc, e * .3);
        ribbon(g, x, y, rx, rx * .7, a, p.sweep, p.thick * (.8 + .4 * u), redArc, e * .7);
      }
      // ⑤ 火花（進行方向に伸びる光の筋）
      g.globalCompositeOperation = ADD; g.lineCap = 'round';
      for (const p of sparks) {
        const lt = (t - p.delay) / 1000; if (lt < 0 || lt * 1000 > p.life) continue;
        const k = (1 - Math.exp(-3 * lt)) / 3, k0 = (1 - Math.exp(-3 * Math.max(0, lt - .035))) / 3;
        const vx = Math.cos(p.ang) * p.spd, vy = Math.sin(p.ang) * p.spd * .75, gr = 650;
        const x1 = cx + p.ox + vx * k, y1 = cy + p.oy + vy * k + .5 * gr * lt * lt;
        const lt0 = Math.max(0, lt - .035), x0 = cx + p.ox + vx * k0, y0 = cy + p.oy + vy * k0 + .5 * gr * lt0 * lt0;
        g.globalAlpha = (1 - lt * 1000 / p.life) * qa; g.strokeStyle = '#ffd36a'; g.lineWidth = p.size;
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      }
      // ⑥ 閃光と、全体を染める熱気
      const fl = env(t, 0, 50, 90, 330);
      if (fl > .01) { g.globalAlpha = fl * .95 * qa; radialFill(g, cx, cy, S * .85, [[0, 'rgba(255,252,215,1)'], [.25, 'rgba(255,215,110,.8)'], [.6, 'rgba(255,120,30,.35)'], [1, 'rgba(255,80,0,0)']], f); }
      const ww = env(t, 0, 120, 350, 800);
      if (ww > .01) { g.globalAlpha = ww * .22 * qa; g.fillStyle = 'rgb(255,130,20)'; g.fillRect(f.l, f.t, f.w, f.h); }
    } };
  }

  // ============================================================
  // 水：地面から巨大な半透明の氷の板が扇状に突き出し、水しぶきと白い霧が舞う
  // ============================================================
  function waterFx(Z, q) {
    const SP = sprites(), S = Z.w, A = Z.A, D = 1200, qa = .65 + .35 * q;
    const gy = Z.gy + 4, cx0 = Z.cx, spread = clamp(A.w * 1.2, S * .62, S * 1.0);
    const n = q >= .9 ? 13 : q >= .6 ? 9 : 6;
    const shards = [], frags = [], glints = [], drops = [], blobs = [], mists = [];
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? .5 : (i + rnd(-.25, .25)) / (n - 1), off = clamp((u - .5) * 2, -1, 1);
      const h = Z.h * rnd(.62, .98) * (1 - .36 * Math.abs(off)), w = clamp(S * rnd(.09, .165), 28, 84);
      const s = { bx: cx0 + off * spread * .5 + rnd(-.02, .02) * S, h, w, th: off * rnd(.34, .54) + rnd(-.09, .09),
        tip: rnd(-.22, .22), sh: rnd(.42, .58), delay: Math.abs(off) * 70 + rnd(0, 60), life: rnd(700, 820) };
      shards.push(s);
      // 砕けて飛ぶ破片（砕ける瞬間に出る）
      const ts = s.delay + s.life - 240;
      for (let k = 0, m = Math.round(7 * q); k < m; k++) {
        const lx = rnd(-.35, .35) * w, ly = -h * rnd(.15, .9), c = Math.cos(s.th), sn = Math.sin(s.th);
        frags.push({ x: s.bx + lx * c - ly * sn, y: gy + lx * sn + ly * c, vx: rnd(-240, 240) + off * 120, vy: rnd(-300, -30),
          rot: rnd(0, TAU), vr: rnd(-9, 9), size: rnd(9, 20), ts, life: rnd(380, 520) });
      }
      for (let k = 0; k < 1; k++) glints.push({ x: s.bx + rnd(-.3, .3) * w + Math.sin(s.th) * h * (.35 + k * .3), y: gy - h * (.35 + k * .3) * Math.cos(s.th), s: rnd(10, 22), ts: s.delay + 120 + k * 110 + rnd(0, 80) });
    }
    for (let i = 0, m = Math.round(58 * q); i < m; i++) {
      const x0 = cx0 + rnd(-.5, .5) * spread;
      drops.push({ x0, y0: gy - rnd(0, 14), vx: (x0 - cx0) / spread * rnd(40, 240) + rnd(-70, 70), vy: -rnd(300, 800), size: rnd(2.6, 7.5), ts: rnd(0, 340) });
    }
    for (let i = 0, m = Math.round(14 * q); i < m; i++) {
      const x0 = cx0 + rnd(-.5, .5) * spread;
      blobs.push({ x0, y0: gy - rnd(0, 26), vx: (x0 - cx0) / spread * rnd(80, 260) + rnd(-60, 60), vy: -rnd(200, 620), size: rnd(34, 92), ts: rnd(0, 300), life: rnd(420, 620), v: i % 3, rot: rnd(0, TAU) });
    }
    for (let i = 0, m = Math.round(12 * q); i < m; i++) {
      mists.push({ x: cx0 + rnd(-.55, .55) * spread, y: gy - rnd(0, 46), size: rnd(150, 290), ts: rnd(60, 420), life: rnd(620, 820), rise: rnd(50, 140), dx: rnd(-40, 40), v: i % 3 });
    }
    shards.sort((a, b) => b.h - a.h);   // 背の高い（奥の）板から描く
    const body = [[0, 'rgba(36,118,236,.74)'], [.5, 'rgba(92,182,255,.62)'], [1, 'rgba(208,242,255,.5)']];
    return { dur: D, draw(g, t) {
      const f = Z.full;
      // ① 全体の青み＋氷の裏から差す冷たい光
      g.globalCompositeOperation = NORM;
      const tn = env(t, 0, 120, 450, 900) * .55 * qa;
      if (tn > .01) { g.globalAlpha = tn; radialFill(g, cx0, gy, S * .9, [[0, 'rgba(40,140,255,.6)'], [.6, 'rgba(30,110,230,.25)'], [1, 'rgba(30,100,220,0)']], f); }
      g.globalCompositeOperation = ADD;
      const bl = env(t, 0, 160, 420, 800) * .75 * qa;
      if (bl > .01) { g.globalAlpha = bl; radialFill(g, cx0, gy - Z.h * .4, S * .55, [[0, 'rgba(190,235,255,.85)'], [.5, 'rgba(90,185,255,.4)'], [1, 'rgba(60,150,255,0)']], f); }
      // ② 氷の板
      for (const s of shards) {
        const lt = t - s.delay; if (lt < 0 || lt > s.life) continue;
        const grow = Math.max(.001, ease.back(Math.min(1, lt / 190)));
        const fade = lt > s.life - 240 ? 1 - (lt - (s.life - 240)) / 240 : 1;
        const H = s.h * grow, W = s.w * (.65 + .35 * Math.min(1, grow)), tp = s.tip * W, sy = -H * s.sh, sy2 = -H * (s.sh + .08);
        g.save(); g.translate(s.bx, gy); g.rotate(s.th);
        g.globalCompositeOperation = NORM;
        g.beginPath(); g.moveTo(-W / 2, 0); g.lineTo(-W * .58, sy); g.lineTo(tp, -H); g.lineTo(W * .52, sy2); g.lineTo(W / 2, 0); g.closePath();
        const gr = g.createLinearGradient(0, 0, 0, -H); body.forEach(([o, c]) => gr.addColorStop(o, c));
        g.globalAlpha = fade * .7; g.fillStyle = gr; g.fill();
        // 右の面を暗く、左の縁にハイライト
        g.beginPath(); g.moveTo(W * .06, 0); g.lineTo(tp, -H); g.lineTo(W * .52, sy2); g.lineTo(W / 2, 0); g.closePath();
        g.globalAlpha = fade * .3; g.fillStyle = 'rgb(14,70,200)'; g.fill();
        g.beginPath(); g.moveTo(-W / 2, 0); g.lineTo(-W * .58, sy); g.lineTo(-W * .42, sy * .96); g.lineTo(-W * .34, 0); g.closePath();
        g.globalAlpha = fade * .38; g.fillStyle = '#fff'; g.fill();
        // 輪郭と稜線
        g.globalAlpha = fade * .9; g.strokeStyle = 'rgba(232,249,255,.95)'; g.lineWidth = 1.6; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(-W / 2, 0); g.lineTo(-W * .58, sy); g.lineTo(tp, -H); g.lineTo(W * .52, sy2); g.lineTo(W / 2, 0); g.stroke();
        g.globalAlpha = fade * .5; g.lineWidth = 1; g.beginPath(); g.moveTo(W * .06, 0); g.lineTo(tp, -H); g.stroke();
        g.globalCompositeOperation = ADD; g.globalAlpha = fade * .22; g.strokeStyle = 'rgb(150,222,255)'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(-W / 2, 0); g.lineTo(-W * .58, sy); g.lineTo(tp, -H); g.lineTo(W * .52, sy2); g.lineTo(W / 2, 0); g.stroke();
        g.restore();
      }
      // ③ 砕ける破片
      g.globalCompositeOperation = NORM;
      for (const p of frags) {
        const lt = t - p.ts; if (lt < 0 || lt > p.life) continue;
        const s = lt / 1000, u = lt / p.life;
        g.save(); g.translate(p.x + p.vx * s, p.y + p.vy * s + 900 * s * s * .5); g.rotate(p.rot + p.vr * s);
        g.globalAlpha = (1 - u) * .9;
        g.beginPath(); g.moveTo(0, -p.size * .6); g.lineTo(p.size * .5, p.size * .5); g.lineTo(-p.size * .5, p.size * .4); g.closePath();
        g.fillStyle = 'rgba(160,220,255,.85)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1; g.stroke();
        g.restore();
      }
      // ④ 水しぶきの塊と飛沫
      for (const p of blobs) {
        const lt = t - p.ts; if (lt < 0 || lt > p.life) continue;
        const s = lt / 1000, u = lt / p.life;
        drawSpr(g, SP.cyan[p.v], p.x0 + p.vx * s, p.y0 + p.vy * s + 700 * s * s, p.size * (.6 + .6 * u), (1 - u) * .75 * qa, p.rot);
      }
      for (const p of drops) {
        const lt = t - p.ts; if (lt < 0) continue;
        const s = lt / 1000, x = p.x0 + p.vx * s, y = p.y0 + p.vy * s + 750 * s * s;
        if (y > gy + 24 || lt > 900) continue;
        const vx = p.vx, vy = p.vy + 1500 * s, sp = Math.hypot(vx, vy);
        g.save(); g.translate(x, y); g.rotate(Math.atan2(vy, vx));
        g.globalAlpha = Math.min(1, (1 - lt / 900) * 1.2) * qa;
        g.beginPath(); g.ellipse(0, 0, p.size * (1.1 + sp / 700), p.size * .62, 0, 0, TAU); g.fillStyle = '#7fdcff'; g.fill();
        g.globalAlpha *= .9; g.beginPath(); g.ellipse(-p.size * .3, -p.size * .15, p.size * .5, p.size * .22, 0, 0, TAU); g.fillStyle = '#fff'; g.fill();
        g.restore();
      }
      // ⑤ きらめき・地面の波紋
      g.globalCompositeOperation = ADD;
      for (const p of glints) { const lt = t - p.ts; if (lt >= 0 && lt < 300) { const u = lt / 300; star4(g, p.x, p.y, p.s * Math.sin(Math.PI * u), 1, u * 1.2); } }
      g.lineWidth = 3;
      for (let k = 0; k < 3; k++) {
        const lt = t - k * 90; if (lt < 0 || lt > 540) continue;
        const u = lt / 540, rx = spread * (.15 + .55 * ease.out3(u));
        g.globalAlpha = (1 - u) * .5 * qa; g.strokeStyle = k ? 'rgb(120,205,255)' : 'rgb(215,245,255)'; g.lineWidth = 1.2 + 2.2 * (1 - u);
        g.beginPath(); g.ellipse(cx0, gy, rx, rx * .2, 0, 0, TAU); g.stroke();
      }
      // ⑥ 手前に広がる白い霧
      g.globalCompositeOperation = NORM;
      for (const p of mists) {
        const lt = t - p.ts; if (lt < 0 || lt > p.life) continue;
        const u = lt / p.life;
        drawSpr(g, SP.mist[p.v], p.x + p.dx * u, p.y - p.rise * u, p.size * (.7 + .5 * u), Math.min(1, u / .25) * (1 - u) * .45 * qa, 0);
      }
    } };
  }

  // ============================================================
  // 木：地面から立ち上る風の渦。大きな葉が舞い上がり、白い風の帯が走る
  // ============================================================
  function woodFx(Z, q) {
    const SP = sprites(), S = Z.w, D = 1150, qa = .65 + .35 * q;
    const cx = Z.cx + rnd(-.03, .03) * S, gy = Z.gy + 2, Th = Z.h * 1.0, R0 = S * .1, Rm = S * .46;
    const ribs = [], leaves = [], rings = [], lines = [], mists = [];
    for (let i = 0, n = Math.round(16 * q); i < n; i++) {
      const hf = rnd(.04, .95), rx = (R0 + (Rm - R0) * Math.pow(hf, .9)) * rnd(.85, 1.1);
      ribs.push({ hf, rx, a0: rnd(0, TAU), sweep: rnd(1.6, 3.1), thick: S * rnd(.035, .075) * (.6 + hf * .8), w: rnd(11, 17),
        delay: hf * 120 + rnd(0, 60), life: rnd(520, 720) });
    }
    for (let i = 0, n = Math.round(30 * q); i < n; i++) {
      leaves.push({ hf0: rnd(0, .25), life: rnd(640, 920), delay: rnd(0, 230), ph0: rnd(0, TAU), om: rnd(5.5, 9.5) * (Math.random() < .88 ? 1 : -1),
        rs: rnd(.55, 1.15), sz: S * rnd(.085, .19), v: i % 3, f0: rnd(0, TAU), fs: rnd(4, 9), r0: rnd(0, TAU), rsp: rnd(-6, 6) });
    }
    for (let i = 0; i < 4; i++) rings.push({ rx: S * (.14 + i * .09), w: (i % 2 ? -1 : 1) * rnd(12, 17), a0: rnd(0, TAU), delay: i * 40, life: 700 });
    for (let i = 0, n = Math.round(18 * q); i < n; i++) {
      const dir = Math.random() < .5 ? -1 : 1;
      lines.push({ x: cx + rnd(-.1, .1) * S, y: rnd(Z.top + Z.h * .1, gy - 6), len: S * rnd(.25, .6), dir, spd: rnd(1.6, 2.6) * S, delay: rnd(60, 360), life: rnd(240, 360), wd: rnd(1.2, 3) });
    }
    for (let i = 0, n = Math.round(14 * q); i < n; i++) {
      mists.push({ x: cx + rnd(-.5, .5) * S * .8, y: gy - rnd(0, Th * .5), size: rnd(130, 250), ts: rnd(60, 420), life: rnd(620, 820), rise: rnd(40, 130), dx: rnd(-50, 50), v: i % 3 });
    }
    const wind = [[0, 'rgba(190,255,230,0)'], [.3, 'rgba(235,255,248,1)'], [.7, 'rgba(140,245,180,.9)'], [1, 'rgba(90,220,140,0)']];
    return { dur: D, draw(g, t) {
      const f = Z.full;
      // ① 緑の色味＋渦の中心の光
      g.globalCompositeOperation = NORM;
      const gw = env(t, 0, 150, 520, 950) * .5 * qa;
      if (gw > .01) { g.globalAlpha = gw; radialFill(g, cx, gy - Th * .35, S * .9, [[0, 'rgba(60,190,95,.6)'], [.6, 'rgba(40,150,70,.3)'], [1, 'rgba(30,120,60,0)']], f); }
      g.globalCompositeOperation = ADD;
      const core = env(t, 0, 200, 480, 850) * qa;
      if (core > .01) {
        g.globalAlpha = core * .9; radialFill(g, cx, gy - Th * .35, S * .5, [[0, 'rgba(225,255,235,.9)'], [.45, 'rgba(100,230,150,.45)'], [1, 'rgba(60,200,120,0)']], f);
        // 中心の上昇気流（縦に細長い光の柱）
        g.save(); g.translate(cx, gy - Th * .5); g.scale(.34, 1);
        const cg = g.createRadialGradient(0, 0, 0, 0, 0, Th * .62);
        cg.addColorStop(0, 'rgba(235,255,245,.8)'); cg.addColorStop(.5, 'rgba(120,240,170,.35)'); cg.addColorStop(1, 'rgba(80,220,140,0)');
        g.globalAlpha = core * .85; g.fillStyle = cg; g.beginPath(); g.arc(0, 0, Th * .62, 0, TAU); g.fill(); g.restore();
      }
      // ② 風の帯（竜巻を形づくる）
      for (const p of ribs) {
        const lt = t - p.delay; if (lt < 0 || lt > p.life) continue;
        const u = lt / p.life, e = Math.min(1, u / .15) * Math.pow(1 - u, .7) * qa;
        const rx = p.rx * (.6 + .5 * ease.out2(u)), a = p.a0 + p.w * lt / 1000, y = gy - p.hf * Th;
        ribbon(g, cx, y, rx, rx * .26, a, p.sweep, p.thick * 2, wind, e * .3);
        ribbon(g, cx, y, rx, rx * .26, a, p.sweep, p.thick, wind, e);
      }
      // ③ 足元の渦
      for (const p of rings) {
        const lt = t - p.delay; if (lt < 0 || lt > p.life) continue;
        const u = lt / p.life, e = Math.min(1, u / .12) * (1 - u) * qa;
        ribbon(g, cx, gy, p.rx * (.8 + .5 * u), p.rx * (.8 + .5 * u) * .2, p.a0 + p.w * lt / 1000, 2.6, S * .03, wind, e * .9);
      }
      // ④ 葉（螺旋を描いて昇り、最後に外へ弾け飛ぶ）
      g.globalCompositeOperation = NORM;
      for (const p of leaves) {
        const lt = t - p.delay; if (lt < 0 || lt > p.life) continue;
        const u = lt / p.life, hf = p.hf0 + (1.02 - p.hf0) * ease.out2(u * .95);
        const R = (R0 + (Rm - R0) * hf) * p.rs * (1 + 1.3 * Math.pow(Math.max(0, (u - .62) / .38), 2));
        const ph = p.ph0 + p.om * lt / 1000, depth = Math.sin(ph);
        const x = cx + Math.cos(ph) * R, y = gy - hf * Th + depth * R * .26;
        const size = p.sz * (.85 + .3 * depth) * (.8 + .4 * hf);
        const al = Math.min(1, u / .1) * (u > .8 ? (1 - u) / .2 : 1) * (.7 + .3 * (depth * .5 + .5)) * qa;
        const flip = Math.cos(p.f0 + p.fs * lt / 1000), fs = (flip < 0 ? -1 : 1) * Math.max(.28, Math.abs(flip));
        if (al <= .004) continue;
        g.save(); g.translate(x, y); g.rotate(p.r0 + p.rsp * lt / 1000); g.scale(1, fs); g.globalAlpha = Math.min(1, al);
        g.drawImage(SP.leaf[p.v], -size / 2, -size / 2, size, size); g.restore();
      }
      // ⑤ 風の筋（左右へ走る白い線）
      g.globalCompositeOperation = ADD; g.lineCap = 'round';
      for (const p of lines) {
        const lt = t - p.delay; if (lt < 0 || lt > p.life) continue;
        const u = lt / p.life, head = p.x + p.dir * p.spd * (lt / 1000), tail = head - p.dir * p.len * (1 - u * .4), y = p.y - u * 14;
        const gr = g.createLinearGradient(tail, y, head, y); gr.addColorStop(0, 'rgba(230,255,240,0)'); gr.addColorStop(1, 'rgba(235,255,245,.95)');
        g.globalAlpha = (1 - u * .6) * qa; g.strokeStyle = gr; g.lineWidth = p.wd; g.beginPath(); g.moveTo(tail, y); g.lineTo(head, y); g.stroke();
      }
      // ⑥ 緑の霧
      g.globalCompositeOperation = NORM;
      for (const p of mists) {
        const lt = t - p.ts; if (lt < 0 || lt > p.life) continue;
        const u = lt / p.life;
        drawSpr(g, SP.green[p.v], p.x + p.dx * u, p.y - p.rise * u, p.size * (.7 + .5 * u), Math.min(1, u / .25) * (1 - u) * .38 * qa, 0);
      }
      // ⑦ 衝撃リング
      if (t < 360) {
        const u = t / 360;
        g.globalCompositeOperation = ADD; g.globalAlpha = (1 - u) * .45 * qa; g.strokeStyle = 'rgb(190,255,200)'; g.lineWidth = 1.5 + 3 * (1 - u);
        g.beginPath(); g.ellipse(cx, gy, S * (.06 + .55 * ease.out3(u)), S * (.06 + .55 * ease.out3(u)) * .2, 0, 0, TAU); g.stroke();
      }
    } };
  }

  // ============================================================
  // 闇：中心へ吸い込まれたあと、黒紫の煙と色とりどりのネオンの光線が弾ける
  // ============================================================
  function darkFx(Z, q) {
    const SP = sprites(), S = Z.w, A = Z.A, D = 1200, qa = .65 + .35 * q, BURST = 110;
    const cx = Z.cx + rnd(-.04, .04) * S, cy = Z.cy - Z.eh * .15, gy = Z.gy + 2, spread = clamp(A.w * 1.1, S * .6, S);
    const smoke = [], streaks = [], wisps = [], motes = [], pull = [];
    for (let i = 0, n = Math.round(20 * q); i < n; i++) {
      const a = rnd(0, TAU), r = Math.sqrt(Math.random());
      smoke.push({ ox: Math.cos(a) * r * S * .5, oy: Math.sin(a) * r * Math.max(Z.h * .46, Z.eh * .8) - Z.h * .08, delay: BURST + rnd(0, 130), life: rnd(700, 1000),
        s0: S * rnd(.3, .42), s1: S * rnd(.5, .7), om: rnd(.7, 1.6) * (i % 2 ? -1 : 1), v: i % 3, rot: rnd(0, TAU) });
    }
    const palette = ['255,70,220', '255,70,220', '255,70,220', '175,92,255', '175,92,255', '175,92,255', '255,150,230', '255,150,230', '255,228,90', '150,255,80', '255,255,255', '255,150,60'];
    for (let i = 0, n = Math.round(36 * q); i < n; i++) {
      const horiz = Math.random() < .72, ang = horiz ? (Math.random() < .5 ? 0 : Math.PI) + rnd(-.5, .5) - (Math.random() < .5 ? .12 : 0) : rnd(0, TAU);
      streaks.push({ ang, r0: S * rnd(0, .06), r1: S * rnd(.7, 1.15), len: S * rnd(.35, .95), delay: BURST + rnd(0, 150), life: rnd(280, 440),
        wd: rnd(1.5, 4.5), col: palette[i % palette.length], ox: rnd(-.2, .2) * S, oy: rnd(-.16, .1) * Z.h });
    }
    for (let i = 0, n = Math.round(22 * q); i < n; i++) {
      wisps.push({ x: cx + rnd(-.5, .5) * spread, ts: BURST + rnd(0, 330), life: rnd(520, 820), size: S * rnd(.14, .3), rise: rnd(.5, 1.1) * Z.h, dx: rnd(-40, 40), v: i % 3, k: i % 2 });
    }
    for (let i = 0, n = Math.round(30 * q); i < n; i++) {
      motes.push({ ang: rnd(0, TAU), spd: rnd(250, 900), delay: BURST + rnd(0, 200), life: rnd(400, 800), size: rnd(1.6, 3.6), col: i % 2 ? '255,130,235' : '190,130,255' });
    }
    for (let i = 0, n = Math.round(22 * q); i < n; i++) pull.push({ ang: rnd(0, TAU), r: S * rnd(.25, .5), len: S * rnd(.08, .18), delay: rnd(0, 30) });
    return { dur: D, draw(g, t) {
      const f = Z.full;
      // ① 闇に沈む（周辺ほど暗く）
      g.globalCompositeOperation = NORM;
      const vg = env(t, 0, 140, 720, 1100) * qa;
      if (vg > .01) {
        g.globalAlpha = vg * .72; radialFill(g, cx, cy, S * .85, [[0, 'rgba(18,0,36,.15)'], [.5, 'rgba(18,0,36,.45)'], [1, 'rgba(10,0,26,1)']], f);
      }
      // ② 吸い込み（収束する線と、中心の黒い球）
      if (t < BURST + 40) {
        const u = clamp(t / BURST, 0, 1);
        g.globalCompositeOperation = ADD; g.lineCap = 'round';
        for (const p of pull) {
          const lt = t - p.delay; if (lt < 0) continue;
          const k = clamp(lt / BURST, 0, 1), r = p.r * (1 - ease.out2(k)) + 6, r2 = r + p.len * (1 - k);
          g.globalAlpha = (1 - k * .4) * .9 * qa; g.strokeStyle = 'rgb(190,120,255)'; g.lineWidth = 2;
          g.beginPath(); g.moveTo(cx + Math.cos(p.ang) * r, cy + Math.sin(p.ang) * r * .7); g.lineTo(cx + Math.cos(p.ang) * r2, cy + Math.sin(p.ang) * r2 * .7); g.stroke();
        }
        g.globalCompositeOperation = NORM; g.globalAlpha = .95 * qa;
        const orb = S * (.12 * (1 - u) + .05), gr = g.createRadialGradient(cx, cy, 0, cx, cy, orb * 1.6);
        gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(.55, 'rgba(14,0,30,.95)'); gr.addColorStop(.8, 'rgba(150,70,235,.7)'); gr.addColorStop(1, 'rgba(150,70,235,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, orb * 1.6, 0, TAU); g.fill();
      }
      // ③ 煙の背後に残る紫の光（黒い雲の輪郭を浮かび上がらせる）
      const bk = env(t, BURST, BURST + 150, BURST + 450, BURST + 850) * .7 * qa;
      if (bk > .01) { g.globalCompositeOperation = ADD; g.globalAlpha = bk; radialFill(g, cx, cy, S * .7, [[0, 'rgba(210,110,255,.7)'], [.5, 'rgba(150,60,230,.35)'], [1, 'rgba(110,40,200,0)']], f); }
      // 黒紫の煙（渦を巻きながら膨らむ）＋縁の紫の光
      for (const p of smoke) {
        const lt = t - p.delay; if (lt < 0 || lt > p.life) continue;
        const u = lt / p.life, m = ease.out3(Math.min(1, u * 1.4)), ang = p.om * lt / 1000;
        const ox = p.ox * m, oy = p.oy * m, c = Math.cos(ang), s = Math.sin(ang);
        const x = cx + ox * c - oy * s * .8, y = cy + ox * s * .6 + oy * c - u * 40, size = p.s0 + (p.s1 - p.s0) * u, al = Math.min(1, u / .18) * Math.pow(1 - u, .9);
        g.globalCompositeOperation = ADD; drawSpr(g, SP.violet[p.v], x, y, size * 1.15, al * .1 * qa, p.rot);
        g.globalCompositeOperation = NORM; drawSpr(g, SP.dark[p.v], x, y, size, al * .78 * qa, p.rot + ang);
      }
      // ④ 地面から立ち昇る紫の闇の炎
      for (const p of wisps) {
        const lt = t - p.ts; if (lt < 0 || lt > p.life) continue;
        const u = lt / p.life, x = p.x + p.dx * u, y = gy - p.rise * ease.out2(u), al = Math.min(1, u / .2) * (1 - u);
        g.globalCompositeOperation = NORM; drawSpr(g, SP.dark[p.v], x, y, p.size * (1 + .5 * u), al * .6 * qa, 0, 1.5);
        g.globalCompositeOperation = ADD; drawSpr(g, (p.k ? SP.magenta : SP.violet)[p.v], x, y, p.size * .7 * (1 + .3 * u), al * .13 * qa, 0, 1.7);
      }
      // ⑤ ネオンの光線（色とりどりの筋が外へ走る）
      g.globalCompositeOperation = ADD; g.lineCap = 'round';
      for (const p of streaks) {
        const lt = t - p.delay; if (lt < 0 || lt > p.life) continue;
        const u = lt / p.life, head = p.r0 + (p.r1 - p.r0) * ease.out2(u), tail = Math.max(0, head - p.len * (1 - u * .5));
        const c = Math.cos(p.ang), s = Math.sin(p.ang), x0 = cx + p.ox + c * tail, y0 = cy + p.oy + s * tail * .8, x1 = cx + p.ox + c * head, y1 = cy + p.oy + s * head * .8;
        const gr = g.createLinearGradient(x0, y0, x1, y1);
        gr.addColorStop(0, `rgba(${p.col},0)`); gr.addColorStop(.85, `rgba(${p.col},.95)`); gr.addColorStop(1, 'rgba(255,255,255,1)');
        const al = (u < .75 ? 1 : 1 - (u - .75) / .25) * qa;
        g.globalAlpha = al * .22; g.strokeStyle = gr; g.lineWidth = p.wd * 2.6; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
        g.globalAlpha = al; g.lineWidth = p.wd; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      }
      // ⑥ 魔力の粒
      for (const p of motes) {
        const lt = (t - p.delay) / 1000; if (lt < 0 || lt * 1000 > p.life) continue;
        const k = (1 - Math.exp(-3 * lt)) / 3, k0 = (1 - Math.exp(-3 * Math.max(0, lt - .03))) / 3, vx = Math.cos(p.ang) * p.spd, vy = Math.sin(p.ang) * p.spd * .7;
        g.globalAlpha = (1 - lt * 1000 / p.life) * qa; g.strokeStyle = `rgb(${p.col})`; g.lineWidth = p.size;
        g.beginPath(); g.moveTo(cx + vx * k0, cy + vy * k0); g.lineTo(cx + vx * k, cy + vy * k); g.stroke();
      }
      // ⑦ 破裂の閃光とリング
      const fl = env(t, BURST - 20, BURST + 20, BURST + 40, BURST + 300);
      if (fl > .01) { g.globalAlpha = fl * .8 * qa; radialFill(g, cx, cy, S * .75, [[0, 'rgba(255,225,255,.95)'], [.3, 'rgba(210,110,255,.6)'], [.7, 'rgba(120,40,200,.2)'], [1, 'rgba(100,30,190,0)']], f); }
      if (t > BURST - 10 && t < BURST + 420) {
        const u = (t - BURST + 10) / 430;
        g.globalAlpha = (1 - u) * .5 * qa; g.strokeStyle = 'rgb(225,150,255)'; g.lineWidth = 1.5 + 4 * (1 - u);
        g.beginPath(); g.ellipse(cx, cy, S * (.05 + .7 * ease.out3(u)), S * (.05 + .7 * ease.out3(u)) * .6, 0, 0, TAU); g.stroke();
      }
    } };
  }

  setTimeout(() => { try { sprites(); } catch (e) { /* 初回描画時に作られる */ } }, 800);   // 初回の演出でカクつかないよう先に用意

  const FX_DOM = { light: fxLight };                                      // 光：従来どおりDOM演出
  const FX_CV  = { fire: fireFx, water: waterFx, wood: woodFx, dark: darkFx };   // 火・水・木・闇：Canvas演出
  const SHAKE  = { fire: 12, water: 8, wood: 7, light: 8, dark: 10 };    // 画面の揺れの強さ

  // ------------------------------------------------------------
  // ダメージ処理（1体ぶん）。計算は従来の単体攻撃と同じ。
  // ------------------------------------------------------------
  function hitEnemy(idx, damage, attr, withSE, q, slotIndex) {
    const enemy = enemyList[idx];
    const unit = document.querySelectorAll('#enemy-area .enemy-unit')[idx];
    if (!enemy || enemy.hp <= 0 || !unit) return;
    const wrap = unit.querySelector('.enemy-img-wrap') || unit;
    const r = wrap.getBoundingClientRect();
    const ex = r.left + r.width / 2, ey = r.top + r.height / 2;

    if (withSE) playAttrHitSE(attr);
    const mult = getAttrMulti(attr, enemy.attr);
    let dmg = Math.max(1, Math.floor(damage * mult * enemyAttrGuardMult(enemy, attr)) - getEnemyDef(enemy));   // 属性軽減   // 最低ダメージ1（単体攻撃と同じ）
    const absorbed = !!(enemy._comboAbsorb && enemy._comboAbsorb.turns > 0 &&
      attackPhaseCombo > 0 && attackPhaseCombo <= enemy._comboAbsorb.max);
    if (absorbed) enemy.hp = Math.min(enemy.maxHp, enemy.hp + dmg);   // コンボ吸収：ダメージの代わりにHP回復
    else { dmg = enemyTakeDamage(enemy, dmg); if (window.DamageTotal) DamageTotal.add(idx, dmg); }   // 超根性対応（実際に与えたダメージ）／HPバー上の合計ダメージ

    // 被弾：のけぞり＋属性色のフラッシュ
    if (unit.animate) unit.animate([
      { transform: 'translate(0,0) scale(1)' }, { transform: 'translate(-5px,2px) scale(1.06)' },
      { transform: 'translate(7px,-2px) scale(.98)' }, { transform: 'translate(0,0) scale(1)' }
    ], { duration: 230, easing: 'ease-out' });
    const img = unit.querySelector('.enemy-img-wrap img');
    if (img && img.animate) img.animate([
      { filter: 'brightness(1)' },
      { filter: `brightness(2.1) saturate(.7) drop-shadow(0 0 10px ${COL[attr] || '#fff'})`, offset: .22 },
      { filter: 'brightness(1)' }
    ], { duration: 320 });

    const jx = rnd(-14, 14);   // 連続で当たっても数字が完全に重ならないように（縦のずらしは showDamageNumber 側）
    if (absorbed) {
      const ab = document.createElement('div');
      ab.style.cssText = `position:fixed;left:${ex + jx}px;top:${ey - 10}px;transform:translate(-50%,-50%);font-size:1.25rem;font-weight:900;color:#7dff9a;text-shadow:0 0 8px #000,0 2px 0 #000;pointer-events:none;z-index:230;white-space:nowrap;animation:dmgPop ${NUM_MS}ms ease-out forwards;`;
      ab.textContent = `吸収! +${dmg.toLocaleString()}`;
      document.body.appendChild(ab);
      setTimeout(() => ab.remove(), NUM_MS + 100);
    } else showDamageNumber(ex + jx, ey - 10, dmg, attr, mult > 1, slotIndex);

    spawnEnergyBurst(ex, ey, attr, (mult > 1 ? 1.45 : 1) * (q < .7 ? .6 : 1));
    if (enemy.hp <= 0) tryDrop(enemy);
  }

  // ------------------------------------------------------------
  // 公開：全体攻撃 1回ぶん。NEXT_MS 後に resolve（演出の終わりは待たない）
  // ------------------------------------------------------------
  window.allAttackAnimation = function allAttackAnimation(slotIndex, damage, attr) {
    return new Promise((resolve) => {
      const targets = collectTargets();
      if (!targets.length) { resolve(); return; }

      // 攻撃するモンスター：ぴょんと跳ねて、属性色のリング
      const slot = document.querySelectorAll('#party-grid .party-slot')[slotIndex];
      if (slot) {
        const sr = slot.getBoundingClientRect();
        spawnCastRing(sr.left + sr.width / 2, sr.top + sr.height / 2, attr, 1.2);
        if (slot.animate) slot.animate([
          { transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-9px) scale(1.11)' },
          { transform: 'translateY(2px) scale(.97)' }, { transform: 'translateY(0) scale(1)' }
        ], { duration: 300, easing: 'cubic-bezier(.18,.82,.28,1)' });
      }

      // 単体攻撃と同じく、まず弾を敵のほうへ飛ばす（行き先は敵全体の中心）
      const A0 = areaOf(targets);
      const sr0 = slot ? slot.getBoundingClientRect() : null;
      const sx = sr0 ? sr0.left + sr0.width / 2 : A0.l + A0.w / 2, sy = sr0 ? sr0.top + sr0.height / 2 : A0.gy;
      const ex = A0.l + A0.w / 2, ey = (A0.top + A0.gy) / 2;
      flyAttrProjectile(sx, sy, ex, ey, attr, ATK_FLY_MS).then(() => {
        // 着弾：ここから全体攻撃の演出が始まり、HIT_MS 後に全員へダメージ
        const tg = collectTargets();
        if (!tg.length) { resolve(); return; }
        // 演出（裏で流れ続ける）。重なっているときほど粒を減らして軽くする
        const q = active >= 4 ? .45 : active >= 2 ? .7 : 1;
        const domFx = FX_DOM[attr], cvFx = FX_CV[attr];
        if (domFx) {                       // 光：DOM演出
          const L = makeLayer(1400);
          try { domFx(L, tg, areaOf(tg), q); } catch (e) { console.error('allAttack fx', e); }
          // 光の演出（Web Animations）もスロー再生にする。delay も一緒に伸びるので順序はそのまま
          try { L.getAnimations({ subtree: true }).forEach(a => { a.playbackRate = FX_SPEED; }); } catch (e) { /* 古いブラウザでは等速 */ }
        } else if (cvFx) {                 // 火・水・木・闇：Canvas演出
          try { engineAdd(cvFx(regionOf(areaOf(tg)), q)); } catch (e) { console.error('allAttack fx', e); }
        }
        if (domFx || cvFx) {
          active++;
          setTimeout(() => { active = Math.max(0, active - 1); }, 1300);
        }

        // 全員に同時ダメージ（SEは1回だけ）
        setTimeout(() => {
          let first = true;
          for (let i = 0; i < enemyList.length; i++) {
            if (enemyList[i] && enemyList[i].hp > 0) { hitEnemy(i, damage, attr, first, q, slotIndex); first = false; }
          }
          updateEnemyUI();
          const now = performance.now();
          if (now - lastShake > 220) { lastShake = now; battleShake(Math.round((SHAKE[attr] || 8) * (q < .7 ? .65 : 1))); }
        }, HIT_MS);

        setTimeout(resolve, ATK_GAP_MS);   // 単体攻撃と同じ間隔で次の攻撃へ
      });
    });
  };
  window.allAttackAnimation.debug = () => ({ frameMs: +E.fe.toFixed(1), scale: +E.scale.toFixed(2), playing: E.fx.length });   // 動作確認用
})();
