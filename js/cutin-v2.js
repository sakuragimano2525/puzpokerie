// ============================================================
// ★ 新カットイン（モンスターID 5000 以降のスキル・変身）★
//
//   パズドラ本家のコラボ演出のような見た目：
//     ① 黒い宇宙（星・月）の上に、白い太線で縁どった横長の帯がバッと開く
//     ② 帯の中で、キャラの「シルエット」が属性色でドンと出る（背景は絵の具が飛び散ったような色のしぶき）
//     ③ ピカッと光って、本来のイラストに切り替わる
//     ④ 巨大なスキル名（白＋黒フチ＋属性色の縁）が右から叩きつけられる
//
//   ・属性ごとに色が変わります（PAL）。火＝橙＋青のしぶき / 水＝水色＋橙 / 木＝緑＋赤紫 / 光＝金＋青紫 / 闇＝紫＋青緑
//   ・スキル名が長くても入りきるように、①文字を縮める ②7文字を超えたら自動で2行にする
//     ③それでも足りない時は横長に潰す、の順で必ず帯の中に収めます。
//   ・軽量化：しぶき・文字・シルエットは最初に canvas へ1回だけ描き、あとは位置・透明度・大きさだけを動かします
//     （iPhone で落ちないよう、動いているものに filter や clip-path は使いません）。
//
//   ※ js/cutin.js から呼ばれます（ID5000以降のとき）。単体では何もしません。
//       CutInV2.run({ host, W, DH, T, theme, name, info, face, IOS, shake }, onDone) → 途中で止める関数
// ============================================================
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const FONT = "'Hiragino Kaku Gothic ProN','Hiragino Sans','Yu Gothic','Noto Sans JP','Noto Sans CJK JP','Zen Maru Gothic',sans-serif";

  // ── 調整用の数字 ──────────────────────────────
  const OUT_MS     = 260;    // 帯が閉じる時間
  const FACE_HEAD  = 0.40;   // 縦長キャラ：頭の高さ（帯の高さに対する割合）
  const FACE_X     = 0.31;   // 縦長キャラ：顔を置く横位置（画面幅に対する割合）
  const FACE_Y     = 0.44;   // 縦長キャラ：顔を置く縦位置（帯の高さに対する割合）
  const NAME_ONE_MAX = 0.27; // スキル名（1行）の最大の大きさ（帯の高さに対する割合）
  const NAME_ONE_MIN = 0.20; // これより小さくなるなら2行にする
  const NAME_TWO_MAX = 0.25; // スキル名（2行）の最大の大きさ
  const NAME_TWO_MIN = 0.15; // これより小さくなるなら横長に潰して収める
  const NAME_AREA_W  = 0.94; // スキル名が使える横幅（画面幅に対する割合）

  // 属性ごとの色。sil＝シルエット（明→暗）/ back＝背景のしぶき / back2＝帯の奥の色 / dot＝飛び散る粒 / glow＝白線の光 / moon＝月
  const PAL = {
    fire:  { sil: ['#ffe27a', '#ff9a12', '#ff5a00'], back: '#1d56e0', back2: '#10328f', dot: '#ffae1a', glow: '#ff9a3d', moon: '#b8401c' },
    water: { sil: ['#c6f4ff', '#38c4ff', '#1a78ff'], back: '#ff6a22', back2: '#8a2c0c', dot: '#58d4ff', glow: '#58c8ff', moon: '#2263b8' },
    wood:  { sil: ['#e2ffa0', '#4fe04a', '#12a038'], back: '#d4307f', back2: '#6c1048', dot: '#8aff72', glow: '#86ff7e', moon: '#2f8f3a' },
    light: { sil: ['#fffbd0', '#ffd21a', '#ff9f00'], back: '#4a5cff', back2: '#1b2090', dot: '#fff27a', glow: '#fff27a', moon: '#c9a21c' },
    dark:  { sil: ['#efc8ff', '#b45cff', '#7424d6'], back: '#10c8b4', back2: '#064f4a', dot: '#d896ff', glow: '#cc84ff', moon: '#6a2ab8' }
  };

  // 色を白（k>0）／黒（k<0）へ寄せる
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16), c = [n >> 16 & 255, n >> 8 & 255, n & 255];
    const t = k >= 0 ? 255 : 0, a = Math.abs(k);
    return 'rgb(' + c.map(v => Math.round(v + (t - v) * a)).join(',') + ')';
  }

  function mkCanvas(w, h, dpr) {
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(w * dpr)); cv.height = Math.max(1, Math.ceil(h * dpr));
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const g = cv.getContext('2d');
    if (g) g.scale(dpr, dpr);
    return { cv, g };
  }

  // ── 絵の具のしぶき：丸い本体＋放射状のトゲ＋飛び散る粒 ──
  function splat(g, x, y, r, col, spikes) {
    g.fillStyle = col;
    g.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = rnd(0, TAU), d = rnd(0, r * .45), rr = r * rnd(.45, .8);
      const cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d;
      g.moveTo(cx + rr, cy); g.arc(cx, cy, rr, 0, TAU);
    }
    g.fill();
    for (let i = 0; i < spikes; i++) {
      const a = rnd(0, TAU), ca = Math.cos(a), sa = Math.sin(a);
      const len = r * rnd(1.0, 2.3), w = r * rnd(.05, .17);
      const bx = x + ca * r * .5, by = y + sa * r * .5;
      g.beginPath();
      g.moveTo(bx - sa * w, by + ca * w);
      g.lineTo(x + ca * len, y + sa * len);
      g.lineTo(bx + sa * w, by - ca * w);
      g.closePath(); g.fill();
      if (Math.random() < .75) {
        const k = rnd(1.05, 1.45);
        g.beginPath(); g.arc(x + ca * len * k, y + sa * len * k, w * rnd(.5, 1.5), 0, TAU); g.fill();
      }
    }
  }

  // 帯の中のしぶき（背景）。大きなしぶき＋ハイライト＋粒＋白い筆の線
  function paintBack(W, H, pal, dpr) {
    const { cv, g } = mkCanvas(W, H, dpr);
    if (!g) return cv;
    splat(g, W * .60, H * .52, H * .32, pal.back, 22);
    splat(g, W * .94, H * .20, H * .20, pal.back, 12);
    splat(g, W * .28, H * .90, H * .16, shade(pal.back, -.15), 10);
    splat(g, W * .06, H * .22, H * .12, shade(pal.back, -.35), 8);
    g.globalAlpha = .55; splat(g, W * .57, H * .46, H * .19, shade(pal.back, .38), 16); g.globalAlpha = 1;
    splat(g, W * .78, H * .74, H * .10, pal.dot, 12);
    g.fillStyle = pal.dot;
    for (let i = 0; i < 38; i++) {
      const a = rnd(0, TAU), d = H * rnd(.25, 1.25), r = H * rnd(.006, .03);
      g.beginPath(); g.arc(W * .58 + Math.cos(a) * d * 1.3, H * .5 + Math.sin(a) * d * .55, r, 0, TAU); g.fill();
    }
    g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const x = rnd(0, W), y = rnd(H * .1, H * .9);
      g.lineWidth = rnd(1, 3.2);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + W * rnd(.12, .34), y - H * rnd(.02, .1)); g.stroke();
    }
    return cv;
  }

  // 全面に流れるスピード線（横長の canvas をゆっくり横へ動かす）
  function paintStreaks(W, H, dpr) {
    const { cv, g } = mkCanvas(W * 1.4, H, dpr);
    if (!g) return cv;
    g.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const x = rnd(0, W * 1.4), y = rnd(0, H), len = W * rnd(.08, .3);
      g.strokeStyle = 'rgba(255,255,255,' + rnd(.06, .22).toFixed(2) + ')';
      g.lineWidth = rnd(1, 3);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y - len * .12); g.stroke();
    }
    return cv;
  }

  // 帯の上下の白い太線（筆でなぞったようなギザつき＋ぼんやりした光）。止まった SVG
  function buildBars(W, H, pal) {
    const NS = 'http://www.w3.org/2000/svg';
    const bt = Math.max(6, Math.round(H * .04));
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'cv2-bars');
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.style.overflow = 'visible';
    svg.setAttribute('aria-hidden', 'true');
    const bar = (top, grow, fill, alpha) => {
      const pts = [], n = Math.max(24, Math.round(W / 14));
      const edge = (y0, dir, jag) => {   // dir: +1 内側へ
        const a = [];
        for (let i = 0; i <= n; i++) a.push([(i / n) * (W + 12) - 6, y0 + dir * (i % 2 ? rnd(.2, 1) : rnd(0, .35)) * jag]);
        return a;
      };
      const outerY = top ? -grow : H + grow, innerBase = top ? bt * .9 + grow * .4 : H - bt * .9 - grow * .4;
      const outer = edge(outerY, top ? 1 : -1, bt * .12);
      const inner = edge(innerBase, top ? 1 : -1, bt * .5);
      pts.push(...outer, ...inner.reverse());
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', 'M' + pts.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L') + 'Z');
      p.setAttribute('fill', fill); p.setAttribute('opacity', alpha);
      svg.appendChild(p);
    };
    [true, false].forEach(top => {
      bar(top, bt * 2.6, shade(pal.glow, .7), .05);   // 外側のぼんやりした光
      bar(top, bt * 1.1, shade(pal.glow, .75), .15);
      bar(top, 0, '#fff', 1);              // 白い本体
    });
    return svg;
  }

  // ── 絵（シルエット）──
  function paintSilhouette(im, w, h, pal, dpr) {
    const maxSide = 1100;
    let k = dpr;
    if (Math.max(w, h) * k > maxSide) k = maxSide / Math.max(w, h);
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
    const g = cv.getContext('2d');
    if (!g) return cv;
    try {
      g.drawImage(im, 0, 0, cv.width, cv.height);
      g.globalCompositeOperation = 'source-in';
      const gr = g.createLinearGradient(0, 0, cv.width * .35, cv.height);
      gr.addColorStop(0, pal.sil[0]); gr.addColorStop(.45, pal.sil[1]); gr.addColorStop(1, pal.sil[2]);
      g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height);
      // 絵の具のムラ（シルエットの内側だけに、明るい／暗いしぶきをのせる）
      g.globalCompositeOperation = 'source-atop';
      g.save(); g.scale(cv.width / 100, cv.height / 100);
      g.globalAlpha = .35;
      for (let i = 0; i < 7; i++) splat(g, rnd(10, 90), rnd(5, 95), rnd(4, 11), i % 2 ? pal.sil[0] : pal.sil[2], 8);
      g.restore();
    } catch (e) { /* 読めなければ空のまま */ }
    return cv;
  }

  // ── スキル名：長くても帯に収める（縮小 → 2行 → 横に潰す）──
  const NO_HEAD = /^[ーッャュョァィゥェォっゃゅょぁぃぅぇぉ゛゜、。，．」』）!！?？…・]/;
  function planName(name, W, H) {
    const meas = document.createElement('canvas').getContext('2d');
    const U = 100;
    meas.font = '900 ' + U + 'px ' + FONT;
    const GAP = .04;
    const unit = s => {   // 文字サイズ1あたりの横幅
      let w = 0; const a = Array.from(s);
      a.forEach((c, i) => { w += meas.measureText(c).width / U + (i ? GAP : 0); });
      return w;
    };
    const chars = Array.from(name);
    const areaW = W * NAME_AREA_W, EXTRA = .42;   // 文字のフチ・傾きぶんの余白（文字サイズ比）
    const one = { lines: [name], units: [unit(name)] };
    let fs1 = Math.min(NAME_ONE_MAX * H, areaW / (one.units[0] + EXTRA));
    if (fs1 >= NAME_ONE_MIN * H || chars.length < 3) return { lines: one.lines, units: one.units, fs: fs1, sx: 1 };

    // 2行：真ん中あたりで、行頭にしてはいけない文字を避けつつ、いちばん幅のそろう所で割る
    let best = null;
    const mid = chars.length / 2;
    for (let i = 1; i < chars.length; i++) {
      if (NO_HEAD.test(chars[i])) continue;
      const a = chars.slice(0, i).join(''), b = chars.slice(i).join('');
      const ua = unit(a), ub = unit(b);
      let score = Math.max(ua, ub) + Math.abs(i - mid) * .02;
      if (/[ 　・、]/.test(chars[i - 1])) score -= .35;   // 区切りの記号のあとなら優先
      if (!best || score < best.score) best = { score, lines: [a.replace(/[ 　]+$/, ''), b.replace(/^[ 　]+/, '')], units: [ua, ub] };
    }
    if (!best) return { lines: one.lines, units: one.units, fs: Math.max(fs1, 8), sx: 1 };
    const uMax = Math.max(best.units[0], best.units[1]);
    let fs2 = Math.min(NAME_TWO_MAX * H, areaW / (uMax + EXTRA)), sx = 1;
    if (fs2 < NAME_TWO_MIN * H) {   // それでも足りない：文字サイズは下げ止めて、横に潰す
      fs2 = NAME_TWO_MIN * H;
      sx = clamp(areaW / (fs2 * (uMax + EXTRA)), .45, 1);
    }
    return { lines: best.lines, units: best.units, fs: fs2, sx };
  }

  // 1行ぶんの文字を canvas に描く（黒いかげ・黒フチ・属性色の縁・白い文字）
  function paintLine(line, unitW, fs, sx, pal, dpr) {
    const pad = fs * .28;
    const w = unitW * fs * sx + pad * 2 + fs * .2, h = fs * 1.3;
    const { cv, g } = mkCanvas(w, h, dpr);
    if (!g) return { cv, w, h };
    g.font = '900 ' + fs + 'px ' + FONT;
    g.textBaseline = 'middle'; g.textAlign = 'left'; g.lineJoin = 'round'; g.miterLimit = 2;
    g.translate(pad, h * .5);
    g.transform(sx, 0, -.19, 1, 0, 0);   // 右に傾ける
    const chars = Array.from(line);
    const xs = []; let x = 0;
    chars.forEach(c => { xs.push(x); x += g.measureText(c).width + fs * .04; });
    const each = fn => chars.forEach((c, i) => { if (c.trim()) fn(c, xs[i]); });
    g.lineWidth = fs * .26; g.strokeStyle = 'rgba(0,0,0,.55)';
    each((c, px) => g.strokeText(c, px + fs * .035, fs * .06));          // かげ
    g.lineWidth = fs * .22; g.strokeStyle = '#000';
    each((c, px) => g.strokeText(c, px, 0));                              // 黒フチ
    g.lineWidth = fs * .09; g.strokeStyle = pal.sil[1];
    each((c, px) => g.strokeText(c, px, 0));                              // 属性色の縁
    const gr = g.createLinearGradient(0, -fs * .5, 0, fs * .5);
    gr.addColorStop(0, '#fff'); gr.addColorStop(.55, '#fff'); gr.addColorStop(1, pal.sil[0]);
    g.fillStyle = gr;
    each((c, px) => g.fillText(c, px, 0));                                // 白い文字
    return { cv, w, h };
  }

  // 絵の置き場所（帯の中での位置と大きさ）
  function layoutArt(info, face, W, H) {
    const nw = info.nw, nh = info.nh;
    if (face) {   // 縦長：顔をアップ
      const sc = (FACE_HEAD * H) / face.headH, fw = nw * sc, fh = nh * sc;
      return { left: W * FACE_X - face.fx * fw, top: H * FACE_Y - face.fy * fh, w: fw, h: fh, ox: face.fx * 100, oy: face.fy * 100 };
    }
    const bw = info.bw || nw, bh = info.bh || nh, bx0 = info.bx0 || 0, by0 = info.by0 || 0;
    const sc = Math.min(1.15 * H / bh, .60 * W / bw), fw = nw * sc, fh = nh * sc, vis = bh * sc;
    const top = vis >= H * .98 ? H * .04 - by0 * sc : (H - vis) * .5 - by0 * sc;
    return { left: W * .33 - (bx0 + bw / 2) * sc, top, w: fw, h: fh, ox: (bx0 + bw / 2) / nw * 100, oy: (by0 + bh * .3) / nh * 100 };
  }

  function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

  function run(o, onDone) {
    const host = o.host, W = o.W, DH = o.DH, T = o.T, IOS = !!o.IOS;
    const pal = PAL[o.theme] || PAL.fire;
    const H = Math.round(Math.min(W * .46, DH * .78));
    const stageTop = Math.max(4, Math.round(DH * .46 - H / 2));
    const dpr = Math.min(IOS ? 2 : 2.5, Math.max(1, window.devicePixelRatio || 1));
    const f = ms => clamp(ms / T, 0, 1);
    const R = clamp(T * .34, 520, 760);   // シルエット → イラストに切り替わる時刻

    const root = el('div', 'cv2-root');
    // 暗転＋星＋月
    const dim = el('div', 'cv2-dim');
    const stars = el('div', 'cv2-stars');
    const SN = IOS ? 12 : 26;
    for (let i = 0; i < SN; i++) {
      const s = document.createElement('i'), z = rnd(1, 3);
      s.style.cssText = 'left:' + rnd(0, 100) + '%;top:' + rnd(0, 100) + '%;width:' + z + 'px;height:' + z + 'px;';
      stars.appendChild(s);
      if (s.animate) s.animate([{ opacity: .15 }, { opacity: 1 }, { opacity: .15 }], { duration: rnd(500, 1300), delay: rnd(0, 600), iterations: Infinity });
    }
    const moonR = Math.round(H * .2);
    const moon = el('div', 'cv2-moon');
    moon.style.cssText = 'left:' + Math.round(W * .02) + 'px;top:' + Math.max(6, Math.round(stageTop - moonR * 1.35)) + 'px;width:' + moonR + 'px;height:' + moonR + 'px;' +
      'background:radial-gradient(circle at 35% 35%,' + shade(pal.moon, .35) + ',' + pal.moon + ' 55%,' + shade(pal.moon, -.65) + ');box-shadow:0 0 ' + Math.round(moonR * .5) + 'px ' + pal.moon + ';';
    root.append(dim, stars, moon);

    // 帯
    const stage = el('div', 'cv2-stage');
    stage.style.cssText = 'top:' + stageTop + 'px;height:' + H + 'px;';
    const clip = el('div', 'cv2-clip');
    stage.appendChild(clip);

    const bg = el('div', 'cv2-bg');
    let starCss = [];
    for (let i = 0; i < 22; i++) starCss.push('radial-gradient(' + (Math.random() < .3 ? 2 : 1) + 'px ' + (Math.random() < .3 ? 2 : 1) + 'px at ' + rnd(0, 100).toFixed(1) + '% ' + rnd(0, 100).toFixed(1) + '%,rgba(255,255,255,.85),transparent)');
    starCss.push('radial-gradient(ellipse 75% 130% at 42% 50%,' + pal.back2 + ' 0%,#040a22 58%,#01030c 100%)');
    bg.style.background = starCss.join(',');
    clip.appendChild(bg);

    const back = paintBack(W, H, pal, dpr); back.className = 'cv2-layer cv2-back';
    const streaks = paintStreaks(W, H, dpr); streaks.className = 'cv2-layer cv2-streaks';
    clip.append(back, streaks);

    // 絵（置き場所は wrap。中にリム光・イラスト・シルエットを重ねる）
    const info = o.info, L = layoutArt(info, o.face, W, H);
    const wrap = el('div', 'cv2-art');
    wrap.style.cssText = 'left:' + L.left + 'px;top:' + L.top + 'px;width:' + L.w + 'px;height:' + L.h + 'px;transform-origin:' + L.ox + '% ' + L.oy + '%;';
    const sil = paintSilhouette(info.im, L.w, L.h, pal, dpr);
    sil.className = 'cv2-sil';
    const rim = document.createElement('canvas');
    rim.width = sil.width; rim.height = sil.height;
    try { rim.getContext('2d').drawImage(sil, 0, 0); } catch (e) {}
    rim.className = 'cv2-rim';
    rim.style.transformOrigin = L.ox + '% ' + L.oy + '%';
    const mon = el('img', 'cv2-mon');
    mon.alt = ''; mon.draggable = false; mon.src = info.url;
    wrap.append(rim, mon, sil);
    clip.appendChild(wrap);

    // 光の粒（下から舞い上がる）
    const embers = [];
    const EN = IOS ? 8 : 16;
    for (let i = 0; i < EN; i++) {
      const e = el('i', 'cv2-ember'), z = rnd(3, 8);
      e.style.cssText = 'left:' + rnd(2, 98) + '%;top:' + H * rnd(.5, .95) + 'px;width:' + z + 'px;height:' + z + 'px;opacity:0;' +
        'background:radial-gradient(circle,#fff 0%,' + pal.dot + ' 55%,transparent 100%);box-shadow:0 0 8px ' + pal.dot + ';';
      clip.appendChild(e); embers.push(e);
    }

    const flash = el('div', 'cv2-flash');
    const glint = el('div', 'cv2-glint');
    glint.style.width = Math.round(W * .22) + 'px';
    glint.style.background = 'linear-gradient(90deg,transparent 0%,rgba(255,255,255,.95) 46%,' + pal.glow + ' 56%,transparent 100%)';
    clip.append(flash, glint);

    // スキル名
    const plan = planName(o.name, W, H);
    const nameBox = el('div', 'cv2-name');
    const lineH = plan.fs * 1.02;
    const blockH = plan.lines.length * lineH;
    const blockBottom = H - Math.max(6, Math.round(H * .045)) - H * .02;
    const blockTop = Math.max(H * .12, blockBottom - blockH - plan.fs * .1);
    const lineEls = [];
    plan.lines.forEach((ln, i) => {
      const p = paintLine(ln, plan.units[i], plan.fs, plan.sx, pal, dpr);
      const w = el('div', 'cv2-line');
      w.style.cssText = 'right:' + Math.round(W * .02) + 'px;top:' + Math.round(blockTop + i * lineH - (p.h - plan.fs) / 2) + 'px;width:' + p.w + 'px;height:' + p.h + 'px;transform-origin:100% 50%;';
      p.cv.className = 'cv2-line-cv';
      // 勢いの残像（同じ絵を2枚、後ろに）
      const ghosts = [0, 1].map(() => {
        const gc = document.createElement('canvas');
        gc.width = p.cv.width; gc.height = p.cv.height;
        gc.style.cssText = 'position:absolute;left:0;top:0;width:' + p.w + 'px;height:' + p.h + 'px;opacity:0;';
        try { gc.getContext('2d').drawImage(p.cv, 0, 0); } catch (e) {}
        return gc;
      });
      w.append(ghosts[0], ghosts[1], p.cv);
      nameBox.appendChild(w);
      lineEls.push({ w, ghosts });
    });
    clip.appendChild(nameBox);

    const bars = buildBars(W, H, pal);
    stage.appendChild(bars);
    root.appendChild(stage);
    host.appendChild(root);

    // ── 動き ──
    let done = false, timer = 0;
    const finish = () => {
      if (done) return; done = true;
      clearTimeout(timer);
      root.remove();
      try { onDone && onDone(); } catch (e) {}
    };
    timer = setTimeout(finish, T);
    if (!root.animate) return finish;   // 古い環境：アニメ無しで時間だけ待つ

    const A = (e, kf, opt) => { try { return e.animate(kf, Object.assign({ fill: 'both' }, opt)); } catch (er) { return null; } };
    const fOut = f(T - OUT_MS);

    A(dim,   [{ opacity: 0 }, { opacity: 1, offset: f(160) }, { opacity: 1, offset: fOut }, { opacity: 0 }], { duration: T });
    A(stars, [{ opacity: 0 }, { opacity: 1, offset: f(200) }, { opacity: 1, offset: fOut }, { opacity: 0 }], { duration: T });
    A(moon,  [{ opacity: 0 }, { opacity: .9, offset: f(260) }, { opacity: .9, offset: fOut }, { opacity: 0 }], { duration: T });

    // 帯：細い線からバッと開く → 止まる → すっと閉じる
    A(stage, [
      { transform: 'scaleY(.04)', opacity: 1, offset: 0, easing: 'cubic-bezier(.1,.85,.25,1)' },
      { transform: 'scaleY(1.05)', offset: f(170), easing: 'ease-out' },
      { transform: 'scaleY(1)', offset: f(240) },
      { transform: 'scaleY(1)', opacity: 1, offset: fOut, easing: 'cubic-bezier(.6,0,.9,.5)' },
      { transform: 'scaleY(.03)', opacity: 0 }
    ], { duration: T });

    // しぶき：ドンと広がる → ゆっくり膨らみ続ける
    A(back, [
      { opacity: 0, transform: 'scale(.5) rotate(-6deg)' },
      { opacity: 1, transform: 'scale(1) rotate(0deg)', offset: f(340), easing: 'cubic-bezier(.1,.8,.2,1)' },
      { opacity: 1, transform: 'scale(1.07) rotate(1.5deg)' }
    ], { duration: T, easing: 'cubic-bezier(.1,.8,.2,1)' });
    A(streaks, [{ transform: 'translateX(0)' }, { transform: 'translateX(' + (-W * .3) + 'px)' }], { duration: T, easing: 'linear' });

    // キャラ：右から大きく寄って、ゆっくり引く（シルエットもイラストも同じ動き）
    A(wrap, [
      { transform: 'translateX(8%) scale(1.22)' },
      { transform: 'translateX(1%) scale(1.05)', offset: f(R), easing: 'cubic-bezier(.1,.7,.3,1)' },
      { transform: 'translateX(-1.2%) scale(1)' }
    ], { duration: T, easing: 'cubic-bezier(.1,.7,.3,1)' });
    A(sil, [{ opacity: 0 }, { opacity: 1, offset: f(90) }, { opacity: 1, offset: f(R - 20) }, { opacity: 0, offset: f(R + 150) }, { opacity: 0 }], { duration: T });
    A(mon, [{ opacity: 0 }, { opacity: 0, offset: f(R - 30) }, { opacity: 1, offset: f(R + 60) }, { opacity: 1 }], { duration: T });
    // 絵のまわりに属性色のふち（シルエットを少し大きくして後ろに）
    A(rim, [{ opacity: 0, transform: 'scale(1)' }, { opacity: 0, offset: f(R) }, { opacity: .9, transform: 'scale(1.03)', offset: f(R + 260) }, { opacity: .75, transform: 'scale(1.03)' }], { duration: T });

    // 切り替わりの閃光と、斬撃のような光
    A(flash, [{ opacity: 0 }, { opacity: 0, offset: f(R - 50) }, { opacity: .95, offset: f(R) }, { opacity: 0, offset: f(R + 260) }, { opacity: 0 }], { duration: T });
    let gl = 0;
    [0, 80].forEach(d => {
      const an = A(glint, [
        { opacity: 0, transform: 'translateX(' + (-W * .3) + 'px) skewX(-24deg)' },
        { opacity: 1, offset: .15 },
        { opacity: 0, transform: 'translateX(' + W * 1.15 + 'px) skewX(-24deg)' }
      ], { duration: 420, delay: R - 40 + d });
      if (an) { gl++; an.onfinish = () => { if (--gl <= 0) glint.remove(); }; }
    });

    // 光の粒
    embers.forEach(e => {
      const dx = rnd(-30, 60), dy = -rnd(H * .4, H * .9), dur = rnd(700, 1400);
      const an = A(e, [
        { opacity: 0, transform: 'translate(0,0) scale(.6)' },
        { opacity: 1, offset: .2 },
        { opacity: 0, transform: 'translate(' + dx + 'px,' + dy + 'px) scale(1.1)' }
      ], { duration: dur, delay: rnd(R * .6, T * .55), iterations: 2 });
      if (an) an.onfinish = () => e.remove();
    });

    // スキル名：右から叩きつけられる（残像つき）。2行目は少し遅れて
    const NAME_AT = R + 80, SLAM = 300;
    lineEls.forEach((ln, i) => {
      const dly = NAME_AT + i * 70;
      A(ln.w, [
        { opacity: 0, transform: 'translateX(' + W * .42 + 'px) scale(2.1,1.5)' },
        { opacity: 1, transform: 'translateX(-1.5%) scale(.96)', offset: .62 },
        { opacity: 1, transform: 'translateX(0) scale(1)' }
      ], { duration: SLAM, delay: dly, easing: 'cubic-bezier(.2,.8,.3,1)' });
      ln.ghosts.forEach((gc, k) => {
        A(gc, [
          { opacity: .5, transform: 'translateX(' + (W * (.14 + k * .1)) + 'px)' },
          { opacity: 0, transform: 'translateX(0)' }
        ], { duration: SLAM, delay: dly + 20 + k * 30, easing: 'ease-out' });
      });
    });
    // 叩きつけた瞬間に画面を揺らす
    const shake = typeof o.shake === 'function' ? o.shake : null;
    if (shake) setTimeout(() => { if (!done) { try { shake(10); } catch (e) {} } }, NAME_AT + SLAM * .6);

    return finish;
  }

  window.CutInV2 = { run, PAL, planName };
})();
