// ============================================================
// ★ リーダースキル発動の演出（js/ls-fx.js）★
//
//   リーダー／フレンドのスキルの条件を満たして消したドロップに、条件ごとの演出を出します。
//   （これまでは「形に沿って薄く光る四角」だけの仮演出でした）
//
//     十字消し        … 刀で「十字」に斬る。斬り口が開いて光の十字架が立つ        （kind: 'cross'）
//     L字消し         … 縦に斬り下ろして角で折れ、横へ振り抜く。紫電が走る        （kind: 'L'）
//     4つ消し         … 消えた場所だけに、日本刀の「一閃」（袈裟斬り）。広がらない  （kind: 'four'）
//     5つ以上つなげる … 属性色の魔法陣（星形）が開いて炸裂。個数が多いほど大きい  （kind: 'connect'）
//     〇コンボ以上    … 集中線と衝撃波と火の粉の爆発（コンボが多いほど派手）      （kind: 'combo'）
//     〇色以上        … 消した色の光が虹のプリズムになって広がる                  （kind: 'prism'）
//
//   ■ 軽く動くための作り（iPhone で落ちないように）
//       ・描くのは盤面まわりだけの canvas 1枚（使い終わったら片付ける）。DOM の部品は増やさない
//       ・ぼかしフィルター／shadowBlur は使わない。光は「グラデーション＋重ね描き」で出す
//       ・iPhone は火花などの数を減らす／同時に動かす演出の数にも上限
//       ・OSの「動きを減らす」がオンなら、画面ゆれ・暗転・フラッシュ無しの軽い演出にする
//
//   ■ 使い方（game.js の lsShapeFx から呼ばれます）
//       LSFX.play(kind, cells, geo, opt)
//         kind  : 上の kind
//         cells : [{ r, c }]  消えたドロップのマス
//         geo   : { x0, y0, px, py, size, rows, cols }
//                 x0,y0 … 左上マス(0,0)の中心の画面座標 / px,py … 1マスぶんの横・縦の間隔 / size … ドロップの大きさ
//         opt   : { color:'#rrggbb', n:個数, power:1〜, light:true/false, colors:['#...', …]（prism） }
//       LSFX.clear()  … 再生中の演出を全部止めて片付ける
//
//   ■ 調整したいとき（ここの数字）
//       SHAKE_CROSS / SHAKE_L / SHAKE_FOUR … 斬った瞬間の画面ゆれ（px）。0 でゆれなし
//       DIM_CROSS / DIM_L … 斬る瞬間に盤面を暗くする濃さ（0〜1）。0 で暗転なし
//
//   不要になったら：このファイルと index.html の1行、game.js の lsShapeFx 内の LSFX 部分を消せば
//   以前の「形に光る」演出に戻ります（LSFX が無い時は自動でそちらを使います）。
// ============================================================
(function () {
  'use strict';

  const SHAKE_CROSS = 5, SHAKE_L = 4, SHAKE_FOUR = 0;   // 画面ゆれ（px）
  const DIM_CROSS = 0.40, DIM_L = 0.34;                  // 斬る瞬間の暗転

  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent || '') ||
              (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1);
  const DPR_MAX = IOS ? 1.5 : 2;        // canvas の細かさの上限
  const MAX_LIVE = IOS ? 2 : 5;         // 同時に動かす演出の数
  const DENS = IOS ? 0.55 : 1;          // 火花・破片の数の倍率

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
  const easeOut2 = t => 1 - Math.pow(1 - clamp01(t), 2);
  const easeIn = t => { t = clamp01(t); return t * t * t; };
  const seg = (t, a, b) => clamp01((t - a) / (b - a));     // 時間 t が [a,b] の間でどこまで進んだか（0〜1）
  const rnd = (a, b) => a + Math.random() * (b - a);

  // 毎フレーム同じ揺らぎにならないよう、時間で決まる乱数（稲妻のギザギザ用）
  function rng(seed) {
    let a = (seed | 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── 色 ──
  const WHITE = [255, 255, 255];
  function parseHex(h) {
    h = String(h || '#ffffff').replace('#', '');
    if (h.length === 3) h = h.split('').map(x => x + x).join('');
    const n = parseInt(h, 16);
    return isNaN(n) ? WHITE : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + clamp01(a).toFixed(3) + ')';
  const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  // ============================================================
  // canvas の管理（盤面＋まわり1マスぶんだけ。再生が終わったら片付ける）
  // ============================================================
  let cv = null, g = null, dpr = 1, raf = 0;
  const box = { L: 0, T: 0, W: 0, H: 0, gx: 0, gy: 0, gw: 0, gh: 0 };   // gx〜gh … 盤面そのものの範囲
  const live = [];

  function setupCanvas(geo) {
    const sz = geo.size;
    const m = Math.round(sz * 1.6);
    const gx = geo.x0 - sz / 2, gy = geo.y0 - sz / 2;
    const gw = (geo.cols - 1) * geo.px + sz, gh = (geo.rows - 1) * geo.py + sz;
    const L = Math.floor(gx - m), T = Math.floor(gy - m);
    const W = Math.ceil(gw + m * 2), H = Math.ceil(gh + m * 2);
    if (!(W > 0 && H > 0) || W > 4000 || H > 4000) return false;
    if (!cv) {
      cv = document.createElement('canvas');
      cv.style.cssText = 'position:fixed;pointer-events:none;z-index:245;';
      document.body.appendChild(cv);
      g = cv.getContext('2d');
      box.W = 0;
    }
    if (L !== box.L || T !== box.T || W !== box.W || H !== box.H) {
      dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
      box.L = L; box.T = T; box.W = W; box.H = H;
      cv.style.left = L + 'px'; cv.style.top = T + 'px';
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    }
    box.gx = gx; box.gy = gy; box.gw = gw; box.gh = gh;
    return !!g;
  }
  function release() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (cv) { cv.width = cv.height = 0; if (cv.parentNode) cv.parentNode.removeChild(cv); }
    cv = null; g = null; box.W = 0;
  }
  function clear() { live.length = 0; release(); }

  function shake(p) {
    const kf = [
      { transform: 'translate(0,0)' }, { transform: 'translate(' + (-p) + 'px,' + (p * 0.4) + 'px)' },
      { transform: 'translate(' + (p * 0.9) + 'px,' + (-p * 0.3) + 'px)' }, { transform: 'translate(' + (-p * 0.5) + 'px,' + (p * 0.2) + 'px)' },
      { transform: 'translate(0,0)' }
    ];
    [document.getElementById('game'), cv].forEach(el => { if (el && el.animate) { try { el.animate(kf, { duration: 230, easing: 'ease-out' }); } catch (e) {} } });
  }

  function frame(now) {
    raf = 0;
    if (!cv || !g) { live.length = 0; return; }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    g.setTransform(dpr, 0, 0, dpr, -box.L * dpr, -box.T * dpr);
    for (let i = live.length - 1; i >= 0; i--) {
      const fx = live[i];
      const t = Math.max(0, now - fx.t0);
      if (t >= fx.dur) { live.splice(i, 1); continue; }
      if (fx.shake && !fx.shook && t >= fx.shake.at) { fx.shook = true; shake(fx.shake.power); }
      g.save();
      try { fx.draw(g, t); } catch (e) { live.splice(i, 1); }
      g.restore();
    }
    if (live.length) raf = requestAnimationFrame(frame);
    else release();
  }

  // ============================================================
  // 描画の部品（どれも「足し合わせ（lighter）」で光らせる）
  // ============================================================
  const cellXY = (geo, r, c) => [geo.x0 + c * geo.px, geo.y0 + r * geo.py];
  function centroid(cells, geo) {
    let x = 0, y = 0;
    cells.forEach(q => { const p = cellXY(geo, q.r, q.c); x += p[0]; y += p[1]; });
    return [x / cells.length, y / cells.length];
  }

  // やわらかい光の玉
  function glow(g, x, y, r, col, a) {
    if (a <= 0.004 || r <= 0.5) return;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(WHITE, a));
    gr.addColorStop(0.22, rgba(mixc(col, WHITE, 0.35), a * 0.85));
    gr.addColorStop(0.6, rgba(col, a * 0.35));
    gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  // 4方向に光が伸びる星（レンズフレア）
  function flare(g, x, y, len, wid, rot, col, a) {
    if (a <= 0.004 || len <= 1) return;
    g.save(); g.translate(x, y); g.rotate(rot);
    const dia = (l, w, c, al) => {
      g.fillStyle = rgba(c, al);
      g.beginPath(); g.moveTo(-l, 0); g.lineTo(0, -w); g.lineTo(l, 0); g.lineTo(0, w); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(0, -l); g.lineTo(w, 0); g.lineTo(0, l); g.lineTo(-w, 0); g.closePath(); g.fill();
    };
    dia(len, wid * 1.6, col, a * 0.55);
    dia(len * 0.62, wid, mixc(col, WHITE, 0.6), a * 0.85);
    dia(len * 0.3, wid * 0.7, WHITE, a);
    g.restore();
  }
  // 光る輪（太い順に重ねる）
  function ring(g, x, y, r, w, col, a, white) {
    if (a <= 0.004 || r <= 0.5) return;
    g.beginPath(); g.arc(x, y, r, 0, TAU);
    g.strokeStyle = rgba(col, a * 0.22); g.lineWidth = w * 3; g.stroke();
    g.strokeStyle = rgba(mixc(col, WHITE, 0.4), a * 0.6); g.lineWidth = w * 1.5; g.stroke();
    if (white !== false) { g.strokeStyle = rgba(WHITE, a * 0.95); g.lineWidth = w * 0.6; g.stroke(); }
  }
  // 光る線
  function line(g, x0, y0, x1, y1, w, col, a) {
    if (a <= 0.004) return;
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1);
    g.strokeStyle = rgba(col, a * 0.22); g.lineWidth = w * 4; g.stroke();
    g.strokeStyle = rgba(mixc(col, WHITE, 0.45), a * 0.6); g.lineWidth = w * 2; g.stroke();
    g.strokeStyle = rgba(WHITE, a); g.lineWidth = w * 0.8; g.stroke();
  }
  // 折れ線の光（稲妻・L字の斬り口用）
  function polyline(g, pts, w, col, a) {
    if (a <= 0.004 || pts.length < 2) return;
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.strokeStyle = rgba(col, a * 0.22); g.lineWidth = w * 4; g.stroke();
    g.strokeStyle = rgba(mixc(col, WHITE, 0.45), a * 0.6); g.lineWidth = w * 2; g.stroke();
    g.strokeStyle = rgba(WHITE, a); g.lineWidth = w * 0.8; g.stroke();
  }
  // 刃の軌跡：尾から頭にかけて太くなり、先端でスッととがる（s0〜s1 は線分上の位置 0〜1）
  function blade(g, x0, y0, x1, y1, s0, s1, w, col, a) {
    if (s1 - s0 < 0.004 || a <= 0.004) return;
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    const wk = Math.min(1, ((s1 - s0) * len) / (w * 14));   // 短いうちは細く
    const N = 12;
    const poly = (k, c, al) => {
      g.beginPath();
      for (let i = 0; i <= N; i++) {
        const u = i / N, s = lerp(s0, s1, u), hw = w * k * wk * 1.8 * Math.pow(u, 1.4) * (1 - Math.pow(u, 6));
        const px = x0 + dx * s + nx * hw, py = y0 + dy * s + ny * hw;
        if (i) g.lineTo(px, py); else g.moveTo(px, py);
      }
      for (let i = N; i >= 0; i--) {
        const u = i / N, s = lerp(s0, s1, u), hw = w * k * wk * 1.8 * Math.pow(u, 1.4) * (1 - Math.pow(u, 6));
        g.lineTo(x0 + dx * s - nx * hw, y0 + dy * s - ny * hw);
      }
      g.closePath(); g.fillStyle = rgba(c, al); g.fill();
    };
    poly(2.4, col, a * 0.3);
    poly(1.45, mixc(col, WHITE, 0.5), a * 0.6);
    poly(0.7, WHITE, a);
  }
  // 細長いひし形の光の柱（両端がとがる）
  function lens(g, x0, y0, x1, y1, hw, col, a) {
    if (a <= 0.004 || hw <= 0.5) return;
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const draw = (k, c, al) => {
      g.beginPath();
      g.moveTo(x0, y0); g.lineTo(mx + nx * hw * k, my + ny * hw * k); g.lineTo(x1, y1); g.lineTo(mx - nx * hw * k, my - ny * hw * k);
      g.closePath(); g.fillStyle = rgba(c, al); g.fill();
    };
    draw(1, col, a * 0.28);
    draw(0.55, mixc(col, WHITE, 0.5), a * 0.5);
    draw(0.2, WHITE, a * 0.9);
  }
  // 火花（短い筋が飛んで消える）
  function drawSparks(g, sp, t, col) {
    g.lineCap = 'round';
    const c1 = mixc(col, WHITE, 0.55);
    for (let i = 0; i < sp.length; i++) {
      const s = sp[i], u = (t - s.te) / s.life;
      if (u <= 0 || u >= 1) continue;
      const e = easeOut(u), e0 = easeOut(Math.max(0, u - 0.12));
      const x = s.x + s.vx * e, y = s.y + s.vy * e + (s.gr || 0) * u * u;
      const x0 = s.x + s.vx * e0, y0 = s.y + s.vy * e0 + (s.gr || 0) * Math.max(0, u - 0.12) * Math.max(0, u - 0.12);
      g.strokeStyle = rgba(c1, (1 - u) * 0.95); g.lineWidth = s.w * (1 - u * 0.5);
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x, y); g.stroke();
    }
  }
  function sparkBurst(cx, cy, n, te0, te1, dMin, dMax, life0, life1, spreadAng, baseAng) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = spreadAng === undefined ? rnd(0, TAU) : baseAng + rnd(-spreadAng, spreadAng) + (Math.random() < 0.5 ? 0 : Math.PI);
      const d = rnd(dMin, dMax);
      out.push({ te: rnd(te0, te1), x: cx, y: cy, vx: Math.cos(a) * d, vy: Math.sin(a) * d, life: rnd(life0, life1), w: rnd(1.4, 2.6), gr: rnd(6, 22) });
    }
    return out;
  }
  // 暗転・フラッシュは盤面の範囲だけ
  function dimBoard(g, a) { if (a > 0.004) { g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(3,5,16,' + a.toFixed(3) + ')'; g.fillRect(box.gx, box.gy, box.gw, box.gh); g.globalCompositeOperation = 'lighter'; } }
  // 画面全体がパッと光る代わりに、中心からやわらかく広がる光（四角い縁が出ないように放射状）
  function bloom(g, x, y, a, col) {
    if (a <= 0.004) return;
    const r = Math.hypot(box.gw, box.gh) * 0.62;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(col || WHITE, a)); gr.addColorStop(0.45, rgba(col || WHITE, a * 0.35)); gr.addColorStop(1, rgba(col || WHITE, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }

  // 刀：切っ先が (hx,hy)、進行方向 (ux,uy) の反対側に刀身・鍔・柄が伸びる
  function katana(g, hx, hy, ux, uy, sz, a) {
    if (a <= 0.01) return;
    const nx = -uy, ny = ux, bl = sz * 1.25, bw = sz * 0.07;
    g.save();
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = clamp01(a);
    // 刀身（反りをつけて、切っ先へ向かって細く）
    const P = (s, w) => {
      const bow = Math.sin(Math.PI * s) * sz * 0.04, half = bw * Math.min(1, s / 0.14 + 0.06);
      return [hx - ux * bl * s + nx * (bow + half * w), hy - uy * bl * s + ny * (bow + half * w)];
    };
    const mid = [P(0.55, 1), P(0.55, -1)];
    const gr = g.createLinearGradient(mid[0][0], mid[0][1], mid[1][0], mid[1][1]);   // 刃(明るい)→棟(暗い)
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, '#d8ecff'); gr.addColorStop(0.7, '#8196b0'); gr.addColorStop(1, '#3b4658');
    g.beginPath();
    for (let i = 0; i <= 10; i++) { const q = P(i / 10, 1); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }
    for (let i = 10; i >= 0; i--) { const q = P(i / 10, -1); g.lineTo(q[0], q[1]); }
    g.closePath(); g.fillStyle = gr; g.fill();
    g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.beginPath();   // 刃のきらめき
    for (let i = 0; i <= 10; i++) { const q = P(i / 10, 0.85); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }
    g.stroke();
    // 鍔と柄
    const tb = P(1, 0), ang = Math.atan2(uy, ux);
    g.translate(tb[0], tb[1]); g.rotate(ang);
    g.fillStyle = '#e9c55e'; g.fillRect(-sz * 0.05, -sz * 0.085, sz * 0.05, sz * 0.17);                 // 鍔
    g.fillStyle = '#d8aa38'; g.fillRect(-sz * 0.05, -sz * 0.085, sz * 0.012, sz * 0.17);
    const hl = sz * 0.5, hw = sz * 0.034;
    g.fillStyle = '#1b1a26'; g.fillRect(-sz * 0.05 - hl, -hw, hl, hw * 2);                              // 柄
    g.strokeStyle = 'rgba(210,175,95,0.85)'; g.lineWidth = 1; g.beginPath();                            // 柄巻きのひし形
    for (let k = 0; k < 5; k++) { const x0 = -sz * 0.05 - (k + 0.5) * hl / 5; g.moveTo(x0 - hl / 10, -hw); g.lineTo(x0 + hl / 10, hw); g.moveTo(x0 + hl / 10, -hw); g.lineTo(x0 - hl / 10, hw); }
    g.stroke();
    g.fillStyle = '#e9c55e'; g.fillRect(-sz * 0.05 - hl - sz * 0.03, -hw * 1.25, sz * 0.03, hw * 2.5);   // 柄頭
    g.restore();
    // 刀身のまわりの光
    const tip = [hx, hy], back = P(0.8, 0);
    g.save(); g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round'; g.beginPath(); g.moveTo(tip[0], tip[1]); g.lineTo(back[0], back[1]);
    g.strokeStyle = 'rgba(190,225,255,' + (0.35 * a).toFixed(3) + ')'; g.lineWidth = sz * 0.2; g.stroke();
    g.restore();
  }
  // 斬撃（切り口の線＋刃の軌跡＋切っ先の閃き＋刀）
  //   S = { x0,y0,x1,y1, ts:斬り始め, d:斬る時間, tHit:切り口が開く時刻 }
  function drawSlash(g, t, S, col, sz) {
    const head = easeOut2(seg(t, S.ts, S.ts + S.d));
    if (head <= 0) return;
    const hx = lerp(S.x0, S.x1, head), hy = lerp(S.y0, S.y1, head);
    const fade = 1 - easeIn(seg(t, S.tHit + 40, S.tHit + 620));
    const open = easeOut(seg(t, S.tHit - 10, S.tHit + 340));
    if (fade > 0.004) {
      line(g, S.x0, S.y0, hx, hy, lerp(2.4, 1.0, open), col, fade);                // 切り口
      if (open > 0.02 && head >= 0.999) {                                           // 切り口が左右へ開いていく
        const dx = S.x1 - S.x0, dy = S.y1 - S.y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, off = open * sz * 0.17;
        g.lineWidth = 1.4; g.strokeStyle = rgba(mixc(col, WHITE, 0.5), fade * 0.5 * (1 - open * 0.5));
        g.beginPath();
        g.moveTo(S.x0 + nx * off, S.y0 + ny * off); g.lineTo(S.x1 + nx * off, S.y1 + ny * off);
        g.moveTo(S.x0 - nx * off, S.y0 - ny * off); g.lineTo(S.x1 - nx * off, S.y1 - ny * off);
        g.stroke();
      }
    }
    const tail = Math.min(head, easeIn(seg(t, S.ts + S.d * 0.3, S.ts + S.d + 120)));   // 刃の軌跡
    blade(g, S.x0, S.y0, S.x1, S.y1, tail, head, sz * 0.17, col, 1);
    const fa = 1 - seg(t, S.ts + S.d, S.ts + S.d + 70);                                 // 切っ先の閃き
    if (fa > 0.01) flare(g, hx, hy, sz * 0.2 + sz * 0.7 * fa, sz * 0.085, 0, col, fa);
    if (S.katana) {                                                                      // 刀そのもの（振り抜いて、止まって、消える）
      const ka = 1 - seg(t, S.ts + S.d + 20, S.ts + S.d + 110);
      if (ka > 0.01) { const dx = S.x1 - S.x0, dy = S.y1 - S.y0, L = Math.hypot(dx, dy) || 1; katana(g, hx, hy, dx / L, dy / L, sz, ka); }
    }
  }
  // 斬撃の火花（線上から、線に垂直な向きへ）
  function slashSparks(S, n) {
    const dx = S.x1 - S.x0, dy = S.y1 - S.y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, out = [];
    for (let i = 0; i < n; i++) {
      const te = S.ts + Math.random() * S.d, p = easeOut2((te - S.ts) / S.d);
      const side = Math.random() < 0.5 ? -1 : 1, v = rnd(24, 70), al = rnd(-0.35, 0.35) * v;
      out.push({ te: te, x: lerp(S.x0, S.x1, p), y: lerp(S.y0, S.y1, p), vx: nx * side * v + (dx / L) * al, vy: ny * side * v + (dy / L) * al, life: rnd(280, 520), w: rnd(1.4, 2.6), gr: rnd(8, 26) });
    }
    return out;
  }

  // ============================================================
  // ① 十字消し：刀で十字に斬る
  // ============================================================
  function buildCross(cells, geo, o) {
    const col = parseHex(o.color || '#ffd700'), sz = geo.size;
    const set = new Set(cells.map(q => q.r + ',' + q.c)), has = (r, c) => set.has(r + ',' + c);
    const cc = cells.find(q => has(q.r - 1, q.c) && has(q.r + 1, q.c) && has(q.r, q.c - 1) && has(q.r, q.c + 1)) || cells[0];
    const cxy = cellXY(geo, cc.r, cc.c), cx = cxy[0], cy = cxy[1];
    const aV = geo.py + sz * 0.9, aH = geo.px + sz * 0.9;
    const tI = 255;   // 十字が完成して切り口が開く時刻
    const SV = { x0: cx, y0: cy - aV, x1: cx, y1: cy + aV, ts: 70, d: 125, tHit: tI, katana: !o.light };    // 縦：上→下
    const SH = { x0: cx - aH, y0: cy, x1: cx + aH, y1: cy, ts: 195, d: 125, tHit: tI, katana: !o.light };   // 横：左→右
    const light = !!o.light, dens = Math.round(16 * DENS);
    const sparks = slashSparks(SV, dens).concat(slashSparks(SH, dens)).concat(sparkBurst(cx, cy, Math.round(16 * DENS), tI, tI + 60, 40, 120, 380, 640));
    return {
      dur: 940, shake: light ? null : { at: tI, power: SHAKE_CROSS },
      draw(g, t) {
        if (!light) dimBoard(g, DIM_CROSS * easeOut(seg(t, 0, 110)) * (1 - easeIn(seg(t, 430, 820))));
        g.globalCompositeOperation = 'lighter';
        // 斬られたあとに立つ、光の十字架
        if (t > tI - 20) {
          const a = easeOut(seg(t, tI - 20, tI + 60)) * (1 - easeIn(seg(t, tI + 100, tI + 640)));
          const hw = sz * (0.16 + 0.3 * easeOut(seg(t, tI, tI + 260)));
          lens(g, SV.x0, SV.y0, SV.x1, SV.y1, hw, col, a);
          lens(g, SH.x0, SH.y0, SH.x1, SH.y1, hw, col, a);
        }
        drawSlash(g, t, SV, col, sz);
        drawSlash(g, t, SH, col, sz);
        if (t >= tI - 10) {   // 交点の衝撃
          const u = seg(t, tI, tI + 480), a0 = easeOut(seg(t, tI - 10, tI + 30));
          if (!light) bloom(g, cx, cy, 0.5 * (1 - seg(t, tI, tI + 150)), mixc(col, WHITE, 0.6));
          glow(g, cx, cy, sz * (0.6 + 1.3 * easeOut(u)), col, (1 - u) * a0 * 0.8);
          ring(g, cx, cy, sz * (0.3 + 1.5 * easeOut(u)), 4 * (1 - u) + 1, col, 1 - u);
          const u2 = seg(t, tI + 70, tI + 520);
          if (u2 > 0) ring(g, cx, cy, sz * (0.2 + 2.3 * easeOut(u2)), 2.5 * (1 - u2) + 0.8, col, (1 - u2) * 0.8);
          const fl = Math.sin(Math.PI * Math.min(1, u * 1.5)) * (1 - u * 0.4);
          flare(g, cx, cy, sz * 1.25 * fl, sz * 0.055, 0, col, 0.9 - u * 0.5);
          flare(g, cx, cy, sz * 0.8 * fl, sz * 0.04, Math.PI / 4, col, 0.8 - u * 0.5);
        }
        drawSparks(g, sparks, t, col);
      }
    };
  }

  // ============================================================
  // ② L字消し：縦に斬り下ろし、角で折れて、横へ振り抜く（紫電つき）
  // ============================================================
  function buildL(cells, geo, o) {
    const col = parseHex(o.color || '#d9a6ff'), sz = geo.size;
    const set = new Set(cells.map(q => q.r + ',' + q.c)), has = (r, c) => set.has(r + ',' + c);
    let corner = null, dirs = null;
    for (const q of cells) {
      const ds = [[-1, 0], [1, 0], [0, -1], [0, 1]].filter(d => has(q.r + d[0], q.c + d[1]) && has(q.r + 2 * d[0], q.c + 2 * d[1]));
      if (ds.length === 2 && ds[0][0] * ds[1][0] + ds[0][1] * ds[1][1] === 0) { corner = q; dirs = ds; break; }
    }
    if (!corner) return buildConnect(cells, geo, o);   // 万一L字でなければ魔法陣にする
    const vd = dirs[0][0] !== 0 ? dirs[0] : dirs[1], hd = dirs[0][0] !== 0 ? dirs[1] : dirs[0];   // 縦の腕／横の腕
    const pc = cellXY(geo, corner.r, corner.c), ext = sz * 0.85;
    const P0 = [pc[0] + vd[1] * (2 * geo.px + ext), pc[1] + vd[0] * (2 * geo.py + ext)];   // 縦の腕の先
    const P1 = pc;                                                                           // 角
    const P2 = [pc[0] + hd[1] * (2 * geo.px + ext), pc[1] + hd[0] * (2 * geo.py + ext)];   // 横の腕の先
    const tC = 190, tE = 305;
    const S1 = { x0: P0[0], y0: P0[1], x1: P1[0], y1: P1[1], ts: 60, d: 130, tHit: tC + 20, katana: !o.light };
    const S2 = { x0: P1[0], y0: P1[1], x1: P2[0], y1: P2[1], ts: 175, d: 130, tHit: tC + 20, katana: !o.light };
    const L1 = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]), L2 = Math.hypot(P2[0] - P1[0], P2[1] - P1[1]), LT = L1 + L2;
    const at = s => s <= L1 ? [lerp(P0[0], P1[0], s / L1), lerp(P0[1], P1[1], s / L1)] : [lerp(P1[0], P2[0], (s - L1) / L2), lerp(P1[1], P2[1], (s - L1) / L2)];
    const light = !!o.light, dens = Math.round(14 * DENS);
    const sparks = slashSparks(S1, dens).concat(slashSparks(S2, dens)).concat(sparkBurst(P1[0], P1[1], Math.round(14 * DENS), tC, tC + 50, 40, 110, 360, 600));
    // 稲妻（L字の斬り口に沿って、ギザギザが走る）
    function bolt(rand, amp, step) {
      const pts = [], N = Math.max(4, Math.round(LT / step));
      for (let i = 0; i <= N; i++) {
        const p = at(LT * i / N), e = (i === 0 || i === N) ? 0 : (rand() - 0.5) * 2 * amp;
        pts.push([p[0] + e, p[1] + (rand() - 0.5) * 2 * amp * (i === 0 || i === N ? 0 : 1)]);
      }
      return pts;
    }
    return {
      dur: 900, shake: light ? null : { at: tC, power: SHAKE_L },
      draw(g, t) {
        if (!light) dimBoard(g, DIM_L * easeOut(seg(t, 0, 110)) * (1 - easeIn(seg(t, 420, 800))));
        g.globalCompositeOperation = 'lighter';
        // L字の光の帯（斬ったあとに残る）
        if (t > tC) {
          const a = easeOut(seg(t, tC, tC + 70)) * (1 - easeIn(seg(t, tC + 130, tC + 600)));
          const w = sz * 0.06 * (1 + 0.6 * easeOut(seg(t, tC, tC + 260)));
          polyline(g, [P0, P1, P2], w, col, a * 0.85);
          // 光が帯の上をスッと流れる
          const fs = easeOut2(seg(t, tC + 20, tC + 420)) * LT, fp = at(fs);
          glow(g, fp[0], fp[1], sz * 0.6, col, 0.8 * (1 - seg(t, tC + 300, tC + 460)) * a);
          // 紫電
          if (!light) {
            const r = rng(Math.floor(t / 48) * 977 + 13), ba = a * 0.9;
            polyline(g, bolt(r, sz * 0.2, sz * 0.22), 1.1, mixc(col, [150, 220, 255], 0.5), ba);
            if (t < tC + 380) polyline(g, bolt(r, sz * 0.14, sz * 0.18), 0.8, col, ba * 0.7);
          }
        }
        drawSlash(g, t, S1, col, sz);
        drawSlash(g, t, S2, col, sz);
        if (t >= tC - 10) {   // 角の衝撃
          const u = seg(t, tC, tC + 460);
          if (!light) bloom(g, P1[0], P1[1], 0.42 * (1 - seg(t, tC, tC + 140)), mixc(col, WHITE, 0.6));
          glow(g, P1[0], P1[1], sz * (0.5 + 1.2 * easeOut(u)), col, (1 - u) * easeOut(seg(t, tC - 10, tC + 30)));
          ring(g, P1[0], P1[1], sz * (0.25 + 1.5 * easeOut(u)), 3.5 * (1 - u) + 1, col, 1 - u);
          const fl = Math.sin(Math.PI * Math.min(1, u * 1.5)) * (1 - u * 0.4);
          flare(g, P1[0], P1[1], sz * 1.4 * fl, sz * 0.07, Math.PI / 4, col, 1 - u * 0.5);
        }
        if (t >= tE) {        // 振り抜いた先の閃き
          const u = seg(t, tE, tE + 340);
          glow(g, P2[0], P2[1], sz * (0.3 + 0.7 * easeOut(u)), col, (1 - u) * 0.9);
          ring(g, P2[0], P2[1], sz * (0.2 + 0.9 * easeOut(u)), 2.5 * (1 - u) + 0.8, col, 1 - u, false);
        }
        drawSparks(g, sparks, t, col);
      }
    };
  }

  // ============================================================
  // ③ 4つ消し：消えた場所だけに、日本刀の「一閃」（袈裟斬り）
  //   盤面全体には広げず、消した4つのドロップの上だけを、刀が1本スッと斬り抜ける。
  //   斬り口が白く光って小さく開き、切っ先と中心に閃き、火花が少し散って消える。
  // ============================================================
  function buildFour(cells, geo, o) {
    const col = parseHex(o.color || '#7fe9ff'), sz = geo.size, light = !!o.light;
    const cxy = centroid(cells, geo), cx = cxy[0], cy = cxy[1];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    cells.forEach(q => { const p = cellXY(geo, q.r, q.c); minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
    const w = maxX - minX, h = maxY - minY;
    // 斬る向き：左上から右下へ斬り下ろす。横に並んでいれば浅く、縦に並んでいれば深く、塊なら45度
    const ang = (w > h * 1.4 ? 26 : h > w * 1.4 ? 64 : 45) * Math.PI / 180, ux = Math.cos(ang), uy = Math.sin(ang);
    // 長さ：4つのドロップがちょうど収まる分＋少しだけ（はみ出しすぎない）
    let half = 0; cells.forEach(q => { const p = cellXY(geo, q.r, q.c); half = Math.max(half, Math.abs((p[0] - cx) * ux + (p[1] - cy) * uy)); });
    half += sz * 0.7;
    const S = { x0: cx - ux * half, y0: cy - uy * half, x1: cx + ux * half, y1: cy + uy * half, ts: 40, d: 115, tHit: 155, katana: !light };
    const tMid = S.ts + S.d * 0.3;   // 刃が中心を通る頃
    const sparks = slashSparks(S, Math.round(14 * DENS)).concat(sparkBurst(cx, cy, Math.round(6 * DENS), tMid, tMid + 40, 25, 70, 280, 460));
    return {
      dur: 660, shake: (light || !SHAKE_FOUR) ? null : { at: S.tHit, power: SHAKE_FOUR },
      draw(g, t) {
        g.globalCompositeOperation = 'lighter';
        // 斬られたあとに一瞬のこる、細い光の筋（斬り抜けた余韻）
        if (t > S.ts + S.d * 0.5) {
          const a = easeOut(seg(t, S.ts + S.d * 0.5, S.tHit)) * (1 - easeIn(seg(t, S.tHit + 40, S.tHit + 420)));
          lens(g, S.x0, S.y0, S.x1, S.y1, sz * 0.11, col, a * 0.85);
        }
        drawSlash(g, t, S, col, sz);
        // 中心の閃き（刃が通った場所が、キラッと光る）
        if (t >= tMid) {
          const u = seg(t, tMid, tMid + 380);
          glow(g, cx, cy, sz * (0.5 + 0.55 * easeOut(u)), col, (1 - u) * 0.8 * easeOut(seg(t, tMid, tMid + 30)));
          const fl = Math.sin(Math.PI * Math.min(1, u * 1.4)) * (1 - u * 0.3);
          flare(g, cx, cy, sz * 0.95 * fl, sz * 0.05, ang, col, (1 - u * 0.6));
        }
        drawSparks(g, sparks, t, col);
      }
    };
  }

  // ============================================================
  // ④ 5つ以上つなげる：属性色の魔法陣（星形）が開いて炸裂
  // ============================================================
  function buildConnect(cells, geo, o) {
    const col = parseHex(o.color || '#ffffff'), sz = geo.size, n = o.n || cells.length, light = !!o.light;
    const cxy = centroid(cells, geo), cx = cxy[0], cy = cxy[1];
    const R = clamp(sz * (0.85 + 0.1 * n), sz * 1.4, sz * 2.1);
    const pts = n >= 8 ? 8 : n >= 7 ? 7 : n >= 6 ? 6 : 5, k = pts === 5 ? 2 : pts === 6 ? 2 : 3;
    const gcd = (a, b) => b ? gcd(b, a % b) : a, gg = gcd(pts, k), edges = [];
    for (let s = 0; s < gg; s++) { let v = s; for (let i = 0; i < pts / gg; i++) { edges.push([v, (v + k) % pts]); v = (v + k) % pts; } }
    const tB = 330, rays = [];
    for (let i = 0; i < pts * 2; i++) rays.push({ a: i * Math.PI / pts, len: (i % 2 ? 1.1 : 1.5) * (0.92 + Math.random() * 0.16) });
    const sparks = sparkBurst(cx, cy, Math.round((14 + n * 2) * DENS), tB, tB + 70, R * 0.5, R * 1.2, 380, 680);
    return {
      dur: 960,
      draw(g, t) {
        g.globalCompositeOperation = 'lighter';
        const outA = 1 - easeIn(seg(t, 520, 950)), sc = 1 + 0.18 * easeOut(seg(t, 520, 950));
        const rot = -Math.PI / 2 + t * 0.0013;
        if (outA > 0.004) {
          const r1 = R * sc, r2 = R * 0.82 * sc, sw = easeOut(seg(t, 0, 230)) * TAU;
          // 魔法陣の輪（ぐるっと描かれていく）
          [r1, r2].forEach((r, i) => {
            g.beginPath(); g.arc(cx, cy, r, rot, rot + sw);
            g.strokeStyle = rgba(col, outA * 0.25); g.lineWidth = i ? 5 : 8; g.stroke();
            g.strokeStyle = rgba(mixc(col, WHITE, 0.4), outA * 0.7); g.lineWidth = i ? 1.6 : 2.6; g.stroke();
            g.strokeStyle = rgba(WHITE, outA * 0.9); g.lineWidth = i ? 0.7 : 1.1; g.stroke();
          });
          // 目盛り
          g.strokeStyle = rgba(mixc(col, WHITE, 0.5), outA * 0.8); g.lineWidth = 1.3; g.lineCap = 'round';
          const NT = 24; g.beginPath();
          for (let i = 0; i < NT; i++) {
            if (i / NT * TAU > sw) break;
            const a = rot + i * TAU / NT, rr0 = r1 * 0.9, rr1 = r1 * (i % 3 ? 0.96 : 1.04);
            g.moveTo(cx + Math.cos(a) * rr0, cy + Math.sin(a) * rr0); g.lineTo(cx + Math.cos(a) * rr1, cy + Math.sin(a) * rr1);
          }
          g.stroke();
          // 星形（辺が1本ずつ描かれていく）
          const E = edges.length, prog = seg(t, 90, 330) * E, rs = R * 0.82 * sc;
          const vx = i => cx + Math.cos(rot + i * TAU / pts) * rs, vy = i => cy + Math.sin(rot + i * TAU / pts) * rs;
          for (let j = 0; j < E; j++) {
            const p = clamp01(prog - j); if (p <= 0) continue;
            const a = edges[j][0], b = edges[j][1];
            line(g, vx(a), vy(a), lerp(vx(a), vx(b), p), lerp(vy(a), vy(b), p), 1.5, col, outA);
          }
          // 完成した星の内側がじわっと光る
          const fa = easeOut(seg(t, 250, 380)) * outA;
          if (fa > 0.01) glow(g, cx, cy, rs * 0.95, col, 0.4 * fa);
        }
        if (t >= tB - 10) {   // 炸裂
          const u = seg(t, tB, tB + 520), a0 = easeOut(seg(t, tB - 10, tB + 30));
          if (!light) bloom(g, cx, cy, 0.4 * (1 - seg(t, tB, tB + 140)), mixc(col, WHITE, 0.5));
          glow(g, cx, cy, R * (0.8 + 1.1 * easeOut(u)), col, (1 - u) * a0);
          ring(g, cx, cy, R * (0.4 + 1.1 * easeOut(u)), 4.5 * (1 - u) + 1, col, 1 - u);
          const u2 = seg(t, tB + 80, tB + 580);
          if (u2 > 0) ring(g, cx, cy, R * (0.3 + 1.45 * easeOut(u2)), 2.5 * (1 - u2) + 0.8, col, (1 - u2) * 0.8);
          // 放射状の光線
          for (let i = 0; i < rays.length; i++) {
            const ry = rays[i], a = rot * 0.6 + ry.a, ux = Math.cos(a), uy = Math.sin(a), r0 = R * 0.35, r1 = R * ry.len;
            const hd = easeOut(seg(t, tB, tB + 190)), tl = easeIn(seg(t, tB + 40, tB + 440));
            blade(g, cx + ux * r0, cy + uy * r0, cx + ux * r1, cy + uy * r1, Math.min(hd, tl), hd, sz * 0.07, col, 0.85);
          }
          const fl = Math.sin(Math.PI * Math.min(1, u * 1.5)) * (1 - u * 0.4);
          flare(g, cx, cy, R * 1.1 * fl, sz * 0.08, 0, col, 1 - u * 0.5);
        }
        drawSparks(g, sparks, t, col);
      }
    };
  }

  // ============================================================
  // ⑤ 〇コンボ以上：集中線と衝撃波と火の粉の爆発
  // ============================================================
  function buildCombo(cells, geo, o) {
    const col = parseHex(o.color || '#ffb347'), sz = geo.size, light = !!o.light;
    const pw = clamp(o.power || 1, 0.8, 1.8) * (light ? 0.7 : 1);
    const cxy = centroid(cells, geo), cx = cxy[0], cy = cxy[1], R = sz * 0.95 * pw;
    const M = light ? 6 : Math.round(15 * (0.8 + pw * 0.3)), rays = [];
    for (let i = 0; i < M; i++) rays.push({ a: rnd(0, TAU), te: rnd(0, 70), len: R * rnd(1.0, 1.8), w: sz * rnd(0.028, 0.055) });
    const embers = [];
    for (let i = 0, N = light ? 0 : Math.round(14 * DENS * pw); i < N; i++) {
      const a = rnd(0, TAU), d = R * rnd(0.6, 2.0);
      embers.push({ te: rnd(40, 200), x: cx + Math.cos(a) * R * 0.3, y: cy + Math.sin(a) * R * 0.3, vx: Math.cos(a) * d, vy: Math.sin(a) * d, rise: rnd(18, 50), life: rnd(420, 680), r: rnd(1.6, 3.4) });
    }
    const sparks = light ? [] : sparkBurst(cx, cy, Math.round(10 * DENS * pw), 20, 90, R * 0.6, R * 1.6, 300, 520);
    const hot = mixc(col, [255, 240, 200], 0.55);
    return {
      dur: light ? 520 : 800,
      draw(g, t) {
        g.globalCompositeOperation = 'lighter';
        const u = seg(t, 0, light ? 340 : 460);
        glow(g, cx, cy, R * (0.7 + 1.0 * easeOut(u)), col, (1 - u) * 0.95 * easeOut(seg(t, 0, 40)));
        ring(g, cx, cy, R * (0.3 + 1.4 * easeOut(u)), 3.6 * (1 - u) + 0.8, col, 1 - u);
        if (!light) {
          const u2 = seg(t, 100, 560);
          if (u2 > 0) ring(g, cx, cy, R * (0.3 + 1.9 * easeOut(u2)), 2.4 * (1 - u2) + 0.7, col, (1 - u2) * 0.75);
        }
        // 集中線
        for (let i = 0; i < rays.length; i++) {
          const ry = rays[i], ux = Math.cos(ry.a), uy = Math.sin(ry.a), r0 = R * 0.28;
          const hd = easeOut(seg(t, ry.te, ry.te + 210)), tl = easeIn(seg(t, ry.te + 50, ry.te + (light ? 330 : 430)));
          blade(g, cx + ux * r0, cy + uy * r0, cx + ux * ry.len, cy + uy * ry.len, Math.min(hd, tl), hd, ry.w, col, 0.9);
        }
        if (!light) {
          const fl = Math.sin(Math.PI * Math.min(1, u * 1.6)) * (1 - u * 0.4);
          flare(g, cx, cy, R * 1.0 * fl, sz * 0.07, Math.PI / 4, col, 0.9 * (1 - u * 0.5));
        }
        // 火の粉（ふわっと上へ）
        for (let i = 0; i < embers.length; i++) {
          const e = embers[i], v = (t - e.te) / e.life;
          if (v <= 0 || v >= 1) continue;
          const k = easeOut(v), x = e.x + e.vx * k, y = e.y + e.vy * k - e.rise * v;
          glow(g, x, y, e.r * (3.2 - v * 1.6), hot, (1 - v) * (0.7 + 0.3 * Math.sin(t * 0.05 + i)));
        }
        drawSparks(g, sparks, t, col);
      }
    };
  }

  // ============================================================
  // ⑥ 〇色以上：消した色の光が虹のプリズムになって広がる
  // ============================================================
  function buildPrism(cells, geo, o) {
    const sz = geo.size, light = !!o.light;
    let cols = (o.colors || []).map(parseHex);
    if (cols.length < 3) cols = ['#ff5a00', '#2fa4ff', '#5ee35e', '#ffe14a', '#9a4be0'].map(parseHex);
    const n = cols.length;
    const cxy = centroid(cells, geo), cx = cxy[0], cy = cxy[1];
    const gw = (geo.cols - 1) * geo.px + sz, gh = (geo.rows - 1) * geo.py + sz;
    const RM = Math.hypot(gw, gh) * 0.55;
    const shards = [];
    for (let i = 0, N = Math.round(20 * DENS); i < N; i++) {
      shards.push({ a: rnd(0, TAU), d: sz * rnd(1.5, 3.8), te: rnd(60, 220), life: rnd(620, 940), s: rnd(3, 6.5), c: cols[i % n], rs: rnd(-0.012, 0.012), r0: rnd(0, TAU) });
    }
    return {
      dur: 1150,
      draw(g, t) {
        g.globalCompositeOperation = 'lighter';
        const spin = easeOut(seg(t, 0, 1000)) * 0.9, bA = 1 - easeIn(seg(t, 430, 1060));
        if (!light) bloom(g, cx, cy, 0.55 * (1 - seg(t, 0, 130)), WHITE);
        // 色ごとの光線（扇のように回りながら広がる）
        const Lb = RM * easeOut(seg(t, 30, 340));
        if (Lb > 2 && bA > 0.004) {
          for (let i = 0; i < n; i++) {
            const a = -Math.PI / 2 + i * TAU / n + spin, half = lerp(0.1, 0.07, seg(t, 100, 700)), c = cols[i];
            g.save(); g.translate(cx, cy); g.rotate(a);
            const gr = g.createLinearGradient(0, 0, Lb, 0);
            gr.addColorStop(0, rgba(WHITE, 0.95 * bA)); gr.addColorStop(0.14, rgba(mixc(c, WHITE, 0.25), 0.9 * bA));
            gr.addColorStop(0.55, rgba(c, 0.38 * bA)); gr.addColorStop(1, rgba(c, 0));
            g.fillStyle = gr;
            g.beginPath(); g.moveTo(0, 0); g.lineTo(Lb, -Lb * Math.tan(half)); g.lineTo(Lb, Lb * Math.tan(half)); g.closePath(); g.fill();
            g.beginPath(); g.moveTo(0, 0); g.lineTo(Lb, -Lb * Math.tan(half * 0.28)); g.lineTo(Lb, Lb * Math.tan(half * 0.28)); g.closePath(); g.fill();
            g.restore();
          }
        }
        // 虹色の波紋
        for (let i = 0; i < n; i++) {
          const u = seg(t, 70 + i * 45, 800 + i * 45); if (u <= 0 || u >= 1) continue;
          ring(g, cx, cy, easeOut(u) * RM * 0.85 - i * 4, 3.4 * (1 - u) + 0.8, cols[i], (1 - u) * 0.9, false);
        }
        // 中心のプリズム（六角形の宝石）
        const pop = easeOut(seg(t, 0, 170)) * (1 - easeIn(seg(t, 380, 680)));
        if (pop > 0.01) {
          const r = sz * 0.44 * pop, rt = t * 0.004;
          glow(g, cx, cy, r * 3.2, mixc(cols[0], WHITE, 0.5), 0.8 * pop);
          for (let k = 0; k < 6; k++) {
            const a0 = rt + k * TAU / 6, a1 = rt + (k + 1) * TAU / 6;
            g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r); g.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r); g.closePath();
            g.fillStyle = rgba(cols[k % n], 0.85 * pop); g.fill();
          }
          g.beginPath();
          for (let k = 0; k < 6; k++) { const a = rt + k * TAU / 6; if (k) g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); else g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
          g.closePath(); g.strokeStyle = rgba(WHITE, 0.9 * pop); g.lineWidth = 1.6; g.stroke();
          flare(g, cx, cy, sz * 1.1 * pop, sz * 0.06, rt, WHITE, 0.9 * pop);
        }
        // 色の破片
        for (let i = 0; i < shards.length; i++) {
          const s = shards[i], v = (t - s.te) / s.life; if (v <= 0 || v >= 1) continue;
          const k = easeOut(v), x = cx + Math.cos(s.a) * s.d * k, y = cy + Math.sin(s.a) * s.d * k, a = (1 - v) * 0.95;
          g.save(); g.translate(x, y); g.rotate(s.r0 + s.rs * t);
          g.beginPath(); g.moveTo(0, -s.s * 1.5); g.lineTo(s.s * 0.8, 0); g.lineTo(0, s.s * 1.5); g.lineTo(-s.s * 0.8, 0); g.closePath();
          g.fillStyle = rgba(s.c, a); g.fill();
          g.fillStyle = rgba(WHITE, a * 0.8); g.beginPath(); g.arc(0, 0, s.s * 0.35, 0, TAU); g.fill();
          g.restore();
        }
      }
    };
  }

  const BUILD = { cross: buildCross, L: buildL, four: buildFour, connect: buildConnect, combo: buildCombo, prism: buildPrism };

  function play(kind, cells, geo, opt) {
    try {
      if (document.hidden) return false;
      if (!cells || !cells.length || !geo || !(geo.size > 0)) return false;
      const b = BUILD[kind]; if (!b) return false;
      opt = Object.assign({}, opt || {});
      try { if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) opt.light = true; } catch (e) {}
      const fx = b(cells, geo, opt);
      if (!fx || !setupCanvas(geo)) return false;
      fx.t0 = performance.now();
      live.push(fx);
      while (live.length > MAX_LIVE) live.shift();
      if (!raf) raf = requestAnimationFrame(frame);
      return true;
    } catch (e) { return false; }
  }

  window.LSFX = { play: play, clear: clear, kinds: Object.keys(BUILD) };
})();
