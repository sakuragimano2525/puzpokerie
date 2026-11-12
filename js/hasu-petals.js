// ============================================================
// 蓮ノ空ステージの桜の花びら
//   ★ game.js の後に読み込む（currentDungeonKey を見るため）
//
//   ・ダンジョンのキーが hasu-〇（hasu-1 / hasu-2 / hasu-boss …）で、バトル画面が出ているあいだだけ
//     桜の花びらが画面全体にふんわり舞う（盤面の上にも落ちる）
//   ・タップやドラッグのじゃまはしない（pointer-events:none）。ドラッグ中のオーブや文字・HPバーなどのUIは花びらより手前
//   ・ダンジョンが終わってホームへ戻る／別のダンジョンへ行くと、花びらはゆっくり消える
//
//   【本物の花びらっぽく見せている工夫】
//     ・先端が少し割れた桜の形。表と裏で色が少し違う（くるっと回ると色が変わる）
//     ・ひらひら舞う動き：左右にゆれながら落ち、ゆれる向きにあわせて傾く
//     ・回転しながら落ちる（横から見ると細く見える）。平らな向きだとゆっくり、細い向きだと少し速く落ちる
//     ・奥の花びらは小さく・ゆっくり・うすく、手前は大きく・少し速く（奥行き）
//     ・ときどき吹く風（ゆるやかに強弱がつく）
//
//   【軽さの工夫】
//     ・花びらの絵は最初に1回だけ作って使いまわす（毎コマ描き直さない）
//     ・canvas は1枚、花びらは十数枚だけ。ぼかし(blur/shadow)は使わない
//     ・解像度は最大1.5倍まで。120Hz の画面でも描くのは最大60コマ/秒
//     ・バトル画面が出ていないとき／タブが裏のときは完全に止まる
//     ・動きがカクつく端末では、自動で枚数を減らす
//
//   【変えたいとき】下の CFG の数字を変えるだけ
//   【ブラウザのコンソールで確認したいとき】
//     HasuPetals.force(true)   … どのダンジョンでも花びらを出す（バトル画面が出ているとき）
//     HasuPetals.force(false)  … 花びらを出さない
//     HasuPetals.force(null)   … もとの自動判定に戻す
//     HasuPetals.stats()       … いまの枚数・1コマの計算時間(ms)などを見る
// ============================================================
(function () {
  'use strict';

  const CFG = {
    keyPattern: /^hasu-/,   // 花びらを出すダンジョンのキー（hasu-1 / hasu-2 / hasu-boss …）
    count: 16,              // 花びらの枚数の目安（スマホ縦画面で約16枚。画面が広いと少し増える。0〜 で調整）
    fall: 1.0,              // 落ちる速さ（大きいほど速い）
    wind: 1.0,              // 風の強さ（0 で無風）
    size: 1.0,              // 花びらの大きさ
    opacity: 1.0,           // 全体の濃さ（1 が標準）
    z: 3,                   // 重なり順。盤面・敵・パーティの上、スキル表示・ステータスバー・ドラッグ中のオーブの下
  };

  const MIN_N = 7, MAX_N = 26;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ── 花びらの絵（最初に1回だけ作って使いまわす） ──
  const TINTS = [
    { base: [238, 140, 172], mid: [255, 192, 212], tip: [255, 238, 244] },   // ふつうの桜色
    { base: [242, 162, 188], mid: [255, 208, 224], tip: [255, 246, 249] },   // うすい桜色
    { base: [230, 124, 162], mid: [250, 176, 200], tip: [255, 230, 238] },   // こい桜色
  ];
  const SS = 1.25, SPR_W = 40, SPR_H = 48;   // 絵の大きさ（花びら1枚は 約21×29 の座標を SS 倍したもの）
  const sprites = [];                        // sprites[色*2 + (裏なら1)]

  function petalPath(g) {   // 先端が少し割れた桜の花びら（上が先端・下が付け根）
    g.beginPath();
    g.moveTo(0, 14);
    g.bezierCurveTo(-3.5, 10, -11, 3, -10.5, -6.5);
    g.bezierCurveTo(-10, -12, -5.5, -15, -2.4, -13.6);
    g.quadraticCurveTo(0, -10.4, 2.4, -13.6);
    g.bezierCurveTo(5.5, -15, 10, -12, 10.5, -6.5);
    g.bezierCurveTo(11, 3, 3.5, 10, 0, 14);
    g.closePath();
  }
  function rgb(a, k) { return 'rgb(' + (a[0] - k) + ',' + (a[1] - k) + ',' + (a[2] - k) + ')'; }

  function makeSprite(t, back) {
    const c = document.createElement('canvas');
    c.width = SPR_W; c.height = SPR_H;
    const g = c.getContext('2d');
    g.translate(SPR_W / 2, SPR_H / 2);
    g.scale(SS, SS);
    const k = back ? 12 : 0;                         // 裏は少し濃い色
    const grad = g.createLinearGradient(0, 14, 0, -14);
    grad.addColorStop(0, rgb(t.base, k));
    grad.addColorStop(0.5, rgb(t.mid, k));
    grad.addColorStop(1, rgb(t.tip, k));
    petalPath(g); g.fillStyle = grad; g.fill();
    g.save();
    petalPath(g); g.clip();
    const rg = g.createRadialGradient(0, 12, 0, 0, 12, 9);   // 付け根のほんのり濃いところ
    rg.addColorStop(0, 'rgba(222,86,132,' + (back ? 0.55 : 0.42) + ')');
    rg.addColorStop(1, 'rgba(222,86,132,0)');
    g.fillStyle = rg; g.fillRect(-14, -16, 28, 32);
    const lg = g.createLinearGradient(0, -15, 0, -4);        // 先端のうすい光（薄い花びらの透け感）
    lg.addColorStop(0, 'rgba(255,255,255,0.55)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg; g.fillRect(-14, -16, 28, 14);
    g.restore();
    g.beginPath(); g.moveTo(0, 12); g.quadraticCurveTo(0.8, 1, 0, -9.5);   // 中心の筋
    g.lineWidth = 0.7; g.strokeStyle = 'rgba(208,84,128,' + (back ? 0.36 : 0.24) + ')'; g.stroke();
    petalPath(g); g.lineWidth = 0.7; g.strokeStyle = 'rgba(255,255,255,0.5)'; g.stroke();   // ふちのうす白
    return c;
  }
  function buildSprites() {
    if (sprites.length) return;
    for (let i = 0; i < TINTS.length; i++) for (let b = 0; b < 2; b++) sprites.push(makeSprite(TINTS[i], b === 1));
  }

  // ── 状態 ──
  let game = null, cv = null, ctx = null;
  let W = 0, H = 0, dpr = 1, sizeK = 1, speedK = 1;
  let baseN = CFG.count, cap = MAX_N;       // baseN＝画面の広さから決めた枚数 / cap＝重い端末で下げる上限
  const petals = [];
  let want = false, forced = null, raf = 0;
  let alphaMul = 0, time = 0, lastDraw = 0;
  let ivSum = 0, ivN = 0, msSum = 0, lastMs = 0, goodN = 0;

  function spawn(p, initial) {
    const z = Math.random();                              // 0＝奥 / 1＝手前
    p.z = z;
    p.len = (11.5 + 13.5 * z) * (0.9 + 0.2 * Math.random()) * sizeK * CFG.size;   // 花びらの長さ(CSS px)
    p.vy = (44 + 40 * z) * (0.85 + 0.3 * Math.random());  // 落ちる速さ(px/秒)
    p.amp = (14 + 26 * Math.random()) * (0.6 + 0.6 * z) * sizeK;   // 左右にゆれる幅(px)
    p.w = 0.9 + 1.1 * Math.random();                      // ゆれの速さ(rad/秒)
    p.phase = Math.random() * TAU;
    p.rot = Math.random() * TAU;
    p.rotV = (Math.random() - 0.5) * 0.7;                 // ゆっくり回る
    p.tum = Math.random() * TAU;
    p.tumV = (1.2 + 2.0 * Math.random()) * (Math.random() < 0.5 ? -1 : 1);   // くるくる裏返る
    p.tint = (Math.random() * TINTS.length) | 0;
    p.a = 0.6 + 0.35 * z;
    if (initial) { p.x = Math.random() * W; p.y = Math.random() * H; }
    else { p.x = -0.15 * W + Math.random() * 1.2 * W; p.y = -(p.len * 2 + Math.random() * H * 0.25); }
    return p;
  }
  function newPetal(initial) {
    return spawn({ z: 0, len: 0, vy: 0, amp: 0, w: 0, phase: 0, rot: 0, rotV: 0, tum: 0, tumV: 0, tint: 0, a: 0, x: 0, y: 0 }, initial);
  }
  function fitCount() {
    const n = clamp(Math.min(baseN, cap), MIN_N, MAX_N);
    while (petals.length < n) petals.push(newPetal(true));
    while (petals.length > n) petals.pop();
  }

  // ── 土台（canvas）を作る ──
  function ensure() {
    game = document.getElementById('game');
    if (!game) return false;
    if (cv && cv.parentNode === game) return true;
    buildSprites();
    cv = document.createElement('canvas');
    cv.id = 'hasu-petal-canvas';
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;display:none;z-index:' + CFG.z;
    game.appendChild(cv);
    ctx = cv.getContext('2d');
    W = H = 0;
    if (window.ResizeObserver) { try { new ResizeObserver(() => { if (want || alphaMul > 0) resize(); }).observe(game); } catch (e) {} }
    return true;
  }
  function resize() {
    if (!game || !cv) return false;
    const w = game.clientWidth, h = game.clientHeight;
    if (!w || !h) return false;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const cw = Math.round(w * dpr), ch = Math.round(h * dpr);
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    W = w; H = h;
    sizeK = clamp(Math.min(w, h) / 390, 0.9, 1.4);
    speedK = clamp(h / 800, 0.6, 1.4);
    baseN = Math.round(w * h / 20000 * CFG.count / 16);
    fitCount();
    return true;
  }
  function respawnAll() {
    petals.length = 0;
    fitCount();
  }

  // ── 1コマ ──
  function tick(now) {
    raf = 0;
    if (document.hidden) return;                    // 戻ってきたら visibilitychange で再開
    const iv = now - lastDraw;
    if (iv < 14) { raf = requestAnimationFrame(tick); return; }   // 120Hz の画面では間引いて 60コマ/秒まで
    const t0 = performance.now();
    lastDraw = now;
    const dt = Math.min(0.05, iv / 1000);           // タブ復帰直後などの大きな飛びを防ぐ
    time += dt;

    if (!W && !resize()) { raf = requestAnimationFrame(tick); return; }

    // 全体の濃さ（出るときはふんわり出て、消えるときはゆっくり消える）
    if (want) alphaMul = Math.min(1, alphaMul + dt / 1.6);
    else alphaMul = Math.max(0, alphaMul - dt / 1.0);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);

    if (alphaMul > 0) {
      // ときどき吹く風（ゆるやかに強弱がつく）
      const gust = CFG.wind * sizeK * (14 + 12 * Math.sin(time * 0.37) + 8 * Math.sin(time * 0.91 + 1.3));
      const fall = CFG.fall * speedK;
      const gA = CFG.opacity * alphaMul;
      for (let i = 0; i < petals.length; i++) {
        const p = petals[i];
        p.phase += p.w * dt;
        p.tum += p.tumV * dt;
        p.rot += p.rotV * dt;
        const sx = Math.cos(p.tum);                  // 1＝正面 / 0＝真横 / -1＝裏面
        const flat = Math.abs(sx);
        p.x += (gust * (0.6 + 0.6 * p.z) + p.amp * p.w * Math.cos(p.phase)) * dt;
        p.y += p.vy * fall * (1.12 - 0.3 * flat) * dt;   // 平らな向きだとゆっくり落ちる
        if (p.y > H + p.len * 2 || p.x < -p.len * 3 - 30 || p.x > W + p.len * 3 + 30) { spawn(p, false); continue; }

        const rot = p.rot + 0.55 * Math.sin(p.phase);    // ゆれる向きにあわせて傾く
        const cr = Math.cos(rot), sr = Math.sin(rot);
        const f = (p.len / 29) * dpr / SS;               // 絵 → canvas の倍率
        const xs = Math.max(0.16, flat) * f, ys = (0.86 + 0.14 * flat) * f;
        ctx.setTransform(cr * xs, sr * xs, -sr * ys, cr * ys, p.x * dpr, p.y * dpr);
        ctx.globalAlpha = p.a * gA * (0.72 + 0.28 * flat);
        ctx.drawImage(sprites[p.tint * 2 + (sx < 0 ? 1 : 0)], -SPR_W / 2, -SPR_H / 2);
      }
      ctx.globalAlpha = 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    // 重い端末では枚数を減らす（60コマぶんの平均で判断）。しばらく快調が続いたら少しずつ元に戻す
    const ms = performance.now() - t0;
    ivSum += iv; msSum += ms; ivN++;
    if (ivN >= 60) {
      const ivAvg = ivSum / ivN;
      lastMs = msSum / ivN;
      if (ivAvg > 26 || lastMs > 3.5) {
        goodN = 0;
        if (petals.length > MIN_N) { cap = Math.max(MIN_N, petals.length - 3); fitCount(); }
      } else if (ivAvg < 19 && lastMs < 2) {
        if (++goodN >= 15 && cap < baseN) { cap = Math.min(MAX_N, cap + 2); goodN = 0; fitCount(); }   // 約15秒ずっと快調なら +2枚
      } else goodN = 0;
      ivSum = 0; msSum = 0; ivN = 0;
    }

    if (want || alphaMul > 0) raf = requestAnimationFrame(tick);
    else { cv.style.display = 'none'; }               // すっかり消えたら止める
  }
  function schedule() {
    if (raf || document.hidden) return;
    lastDraw = performance.now(); ivSum = 0; msSum = 0; ivN = 0;
    raf = requestAnimationFrame(tick);
  }

  // ── いま花びらを出すべきか（250ms ごとに見る） ──
  function isActive() {
    const g = document.getElementById('game');
    if (!g || !g.style.display || g.style.display === 'none') return false;   // バトル画面が出ていない
    if (forced !== null) return !!forced;
    try {
      if (typeof currentDungeonKey === 'undefined' || currentDungeonKey == null) return false;
      return CFG.keyPattern.test(String(currentDungeonKey));
    } catch (e) { return false; }
  }
  function poll() {
    const on = isActive();
    if (on) {
      if (!ensure()) return;
      if (!want) {
        want = true;
        if (alphaMul <= 0) { cv.style.display = 'block'; resize(); respawnAll(); }
      }
      if (!W) resize();
      schedule();
    } else if (want) {
      want = false;                                   // ゆっくり消える（tick が alphaMul=0 で止める）
      if (alphaMul > 0) schedule();
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && (want || alphaMul > 0)) schedule();
  });
  window.addEventListener('resize', () => { if (want || alphaMul > 0) resize(); });
  setInterval(poll, 250);

  window.HasuPetals = {
    cfg: CFG,
    force(v) { forced = (v === null || v === undefined) ? null : !!v; poll(); },
    stats() {
      return { petals: petals.length, base: baseN, cap: cap, ms: +lastMs.toFixed(2), canvas: cv ? cv.width + '×' + cv.height : '-', running: !!raf, alpha: +alphaMul.toFixed(2) };
    },
  };
})();
