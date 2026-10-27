// ============================================================
// ★ 進化の演出（本家ふう）★
//   パズル完成 →「おや…！？ ○○の ようすが…！」（evon.mp3 / まだ進化しない）
//   → 「次へ」→ 進化前の mp{id}.png が出て、evolution.mp3 と一緒に約10秒の進化演出
//   → 10秒目で進化を実行し、進化後の mp{id}.png に切り替わる（executeEvolution は game.js）
//
//   ★ 演出の時間は evolution.mp3 の再生位置（audio.currentTime）で動かしているので、音とずれません。
//     （音が鳴らせない場合だけ、時計で代わりに動かします）
//   ★ evolution.mp3 の音の流れ：
//       0〜3秒 しずか → 3.5秒〜 もりあがる → 5.25秒 ドン！ → 6〜9.5秒 さらに高まる
//       → 約10秒〜10.3秒 クライマックス（進化！）→ 11.8秒ごろまで余韻
//   ★ 画像は mp{id}.png（無ければ通常の m{id}.png）を使う
// ============================================================
(function () {
  const $ = (id) => document.getElementById(id);
  const scene = $('evo-scene');
  if (!scene) return;

  const AUDIO_SRC  = 'evolution.mp3';   // 進化演出の音（10秒目あたりがクライマックス）
  const MSG_SE_SRC = 'evon.mp3';        // 「ようすが…」のときの音（ファイルが無ければ鳴らさない）
  const MSG_SE_DELAY = 900;             // ★ evon.mp3 を鳴らすまでの待ち時間（ミリ秒）。BGMのフェードアウトと被らないように遅らせる。もっと遅くしたいときは数字を大きく

  // 時間割（evolution.mp3 の秒数）
  const T_MORPH = 3.0;     // 進化前↔進化後のシルエットが入れ替わり始める
  const T_HIT   = 5.25;    // 音の「ドン！」
  const T_EVO   = 10.0;    // ★ 進化を実行する時刻（10秒目）
  const T_PEAK  = 10.28;   // 音のピーク
  const T_FADE  = 11.4;    // この時刻から演出画面を消して「進化！」画面へ
  const T_END   = 12.1;

  const stage = $('es-stage'), rays = $('es-rays'), aura = $('es-aura'), flashEl = $('es-flash');
  const cv = $('es-fx'), ctx = cv.getContext('2d');
  const msgText = $('es-msg-text'), nextBtn = $('es-next'), msgBox = $('es-msg');
  const wFrom = $('es-from'), wTo = $('es-to');
  const im = { fc: $('es-from-c'), fw: $('es-from-w'), tc: $('es-to-c'), tw: $('es-to-w') };

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const rand = (a, b) => a + Math.random() * (b - a);

  let S = null;            // 演出中の状態
  let prepared = null;     // 先読み済み（パズル中に準備しておく）

  // ---------- 先読み（画像と音） ----------
  function prepare(fromMon, toMon) {
    const pick = (mon) => window.evoLoadFirst([`mp${mon.id}.png`, (typeof monsterImg === 'function' ? monsterImg(mon) : '')], mon);
    const p = { fromId: fromMon.id, toId: toMon.id, audio: null, imgs: Promise.all([pick(fromMon), pick(toMon)]) };
    try { p.audio = new Audio(AUDIO_SRC); p.audio.preload = 'auto'; p.audio.load(); } catch (e) {}
    prepared = p;
    return p;
  }
  window.prepareEvoScene = prepare;

  // ---------- 開始：○○の ようすが… ----------
  window.startEvoScene = function (fromMon, toMon) {
    if (S) return;
    const p = (prepared && prepared.fromId === fromMon.id && prepared.toId === toMon.id) ? prepared : prepare(fromMon, toMon);
    S = {
      fromMon, toMon, audio: p.audio, phase: 'msg', canNext: false,
      evolved: false, ended: false, t0wall: 0, useWall: false, playing: false,
      lastT: 0, parts: [], rings: [], acc: 0, fired: {}, raf: 0, timers: [], typing: null, bgmWas: false, cx: 0, cy: 0
    };
    // 見た目を初期状態に
    scene.style.opacity = '1';
    scene.style.display = 'flex';
    scene.classList.add('msg');
    wFrom.style.cssText = 'opacity:1'; wTo.style.cssText = 'opacity:0';
    im.fc.style.opacity = '1'; im.fw.style.opacity = '0'; im.tc.style.opacity = '0'; im.tw.style.opacity = '1';
    rays.style.opacity = '0'; aura.style.opacity = '0'; flashEl.style.opacity = '0';
    nextBtn.classList.remove('show');
    msgText.textContent = '';
    sizeCanvas();
    ctx.clearRect(0, 0, cv.width, cv.height);

    // ホームBGMを下げる（終わったら戻す）
    try { if (typeof isMenuPlaying !== 'undefined' && isMenuPlaying) { S.bgmWas = true; _menuFadeTo(0, 350); } } catch (e) {}

    const my = S;
    p.imgs.then(([a, b]) => {
      if (S !== my) return;
      im.fc.src = a.url; im.fw.src = a.url; im.tc.src = b.url; im.tw.src = b.url;
      beginMessage();
    });
  };

  function beginMessage() {
    const my = S;
    // 「ようすが…」の音（まだ進化しない）
    my.timers.push(setTimeout(() => {
      if (S !== my) return;
      try { const se = new Audio(MSG_SE_SRC); se.volume = 0.9; const pr = se.play(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) {}
    }, MSG_SE_DELAY));
    const text = `おや…！？\n${S.fromMon.name}の ようすが…！`;
    let i = 0;
    S.typing = setInterval(() => {
      if (S !== my) { clearInterval(my.typing); return; }
      i++; msgText.textContent = text.slice(0, i);
      if (i >= text.length) finishTyping();
    }, 75);
    function finishTyping() {
      if (!my.typing) return;
      clearInterval(my.typing); my.typing = null;
      msgText.textContent = text;
      my.canNext = true;
      nextBtn.classList.add('show');
    }
    my.skipTyping = () => { if (my.typing) { i = text.length; finishTyping(); } };
  }
  msgBox.addEventListener('click', (e) => { if (S && S.phase === 'msg' && S.skipTyping && e.target !== nextBtn) S.skipTyping(); });

  // ---------- 「次へ」→ 進化演出スタート ----------
  nextBtn.addEventListener('click', () => {
    if (!S || S.phase !== 'msg' || !S.canNext) return;
    run();
  });

  function sizeCanvas() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(window.innerWidth * dpr);
    cv.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function run() {
    const my = S;
    my.phase = 'run';
    scene.classList.remove('msg');
    sizeCanvas();
    const r = stage.getBoundingClientRect();
    my.cx = r.left + r.width / 2; my.cy = r.top + r.height / 2; my.R = r.width / 2;

    // ---- 音を鳴らす（鳴らせないときは時計で代用） ----
    const a = my.audio;
    const useWall = () => { if (!my.useWall) { my.useWall = true; my.t0wall = performance.now(); } };
    if (a) {
      a.addEventListener('playing', () => { my.playing = true; });
      a.addEventListener('error', useWall);
      try { a.currentTime = 0; const pr = a.play(); if (pr && pr.catch) pr.catch(useWall); } catch (e) { useWall(); }
    } else useWall();
    // 2.5秒たっても音が始まらないときは、時計で動かす
    my.timers.push(setTimeout(() => { if (S === my && !my.playing && !my.useWall) useWall(); }, 2500));
    // 万一 rAF が止まっても進化だけは必ず行う（タブが裏に行った等）
    my.timers.push(setTimeout(() => { if (S === my) { evolveNow(); } }, (T_EVO + 4) * 1000));
    my.timers.push(setTimeout(() => { if (S === my) { end(); } }, (T_END + 6) * 1000));

    const tick = () => {
      if (S !== my) return;
      const t = my.useWall ? (performance.now() - my.t0wall) / 1000 : (my.playing ? my.audio.currentTime : 0);
      frame(t);
      if (S === my) my.raf = requestAnimationFrame(tick);
    };
    my.raf = requestAnimationFrame(tick);
  }

  // ---------- 10秒目：進化を実行 ----------
  function evolveNow() {
    if (!S || S.evolved) return;
    S.evolved = true;
    try {
      const res = $('evo-result');
      if (res) res.classList.add('quick');
      if (typeof executeEvolution === 'function') executeEvolution();   // 素材消費・Lv1・進化後モンスターに差し替え
    } catch (e) { console.error('evolve error', e); }
  }

  // ---------- 1フレーム ----------
  function frame(t) {
    const dt = clamp(t - S.lastT, 0, 0.1); S.lastT = Math.max(S.lastT, t);

    // 進化の瞬間
    if (t >= T_EVO && !S.evolved) {
      evolveNow();
      burst(); addRing(T_EVO, 1.1, S.R * 3.2);
    }
    if (t >= T_PEAK && !S.fired.peak) { S.fired.peak = 1; addRing(T_PEAK, 1.0, S.R * 4.2); burst(40); }
    if (t >= T_HIT && !S.fired.hit) { S.fired.hit = 1; addRing(T_HIT, 0.9, S.R * 2.4); burst(26); }

    // --- 進化前(from)：色 → 白いシルエット ---
    const w = smooth((t - 0.3) / 1.4);
    // --- 進化前 ↔ 進化後 の入れ替わり（だんだん速く） ---
    let mix = 0;
    if (t >= T_MORPH && t < T_EVO) {
      const u = t - T_MORPH, D = T_EVO - T_MORPH, f0 = 1.2, f1 = 7.5;
      const phi = f0 * u + (f1 - f0) * D / 2.5 * Math.pow(u / D, 2.5);          // 入れ替わった回数（周期）
      mix = smooth((0.5 - 0.5 * Math.cos(2 * Math.PI * phi)) * 1.5 - 0.25);
    }
    const evolvedPhase = t >= T_EVO;
    const e = smooth((t - T_EVO) / 0.9);                                         // 進化後：白 → 色

    // 大きさ：ゆらゆら＋だんだん大きく／進化後はポンと弾む
    const pulse = 1 + 0.045 * Math.sin(t * 2 * Math.PI * 1.3);
    const grow = 0.10 * smooth((t - 4) / 6);
    let sc = pulse + grow;
    if (evolvedPhase) sc = 1.0 + 0.22 * (1 - smooth((t - T_EVO) / 0.5)) + 0.02 * Math.sin((t - T_EVO) * 3);
    const jit = (t > T_HIT && t < T_EVO) ? 2.2 * smooth((t - T_HIT) / 4.5) : 0;   // 高まるにつれて小刻みに震える
    const tr = `translate(${rand(-jit, jit).toFixed(1)}px, ${rand(-jit, jit).toFixed(1)}px) scale(${sc.toFixed(3)})`;
    // 光（まわりのぼかし）
    const g = evolvedPhase ? 6 + 24 * (1 - smooth((t - T_EVO) / 1.4)) : 4 + 26 * smooth((t - 1.5) / 8.5);
    const glow = `drop-shadow(0 0 ${g.toFixed(1)}px rgba(255,255,255,0.92))`;

    if (!evolvedPhase) {
      wFrom.style.opacity = (1 - mix).toFixed(3);
      wTo.style.opacity = mix.toFixed(3);
      im.fc.style.opacity = (1 - w).toFixed(3);
      im.fw.style.opacity = w.toFixed(3);
      im.tc.style.opacity = '0'; im.tw.style.opacity = '1';
    } else {
      wFrom.style.opacity = '0';
      wTo.style.opacity = '1';
      im.tc.style.opacity = '1';
      im.tw.style.opacity = (1 - e).toFixed(3);
    }
    wFrom.style.transform = tr; wTo.style.transform = tr;
    wFrom.style.filter = glow; wTo.style.filter = glow;

    // 放射状の光・オーラ
    const fadeOut = 1 - smooth((t - 10.2) / 1.5);
    rays.style.opacity = (0.75 * smooth((t - 1.0) / 4) * fadeOut).toFixed(3);
    rays.style.transform = `rotate(${(t * 12 + (t > 5 ? Math.pow(t - 5, 2) * 6 : 0)).toFixed(1)}deg)`;
    aura.style.opacity = (0.85 * smooth((t - 0.5) / 9.1) * (1 - smooth((t - 10.3) / 1.5))).toFixed(3);

    // 画面の白いフラッシュ
    let f = 0;
    if (t >= T_HIT && t < T_HIT + 0.35) f = 0.6 * (1 - (t - T_HIT) / 0.35);
    if (t >= 9.3 && t < T_EVO) f = Math.max(f, smooth((t - 9.3) / 0.7));
    if (t >= T_EVO && t < T_EVO + 0.9) f = 1 - smooth((t - T_EVO) / 0.9);
    if (t >= T_PEAK && t < T_PEAK + 0.3) f = Math.max(f, 0.45 * (1 - (t - T_PEAK) / 0.3));
    flashEl.style.opacity = f.toFixed(3);

    drawFx(t, dt);

    // 演出画面をフェードアウト → 下の「進化！」画面へ
    if (t >= T_FADE) scene.style.opacity = (1 - smooth((t - T_FADE) / (T_END - T_FADE))).toFixed(3);
    if (t >= T_END) end();
  }

  // ---------- きらきら（キャンバス） ----------
  const COLS = ['255,255,255', '255,242,170', '175,222,255'];
  function addRing(t0, dur, maxR) { S.rings.push({ t0, dur, maxR }); }
  function burst(n = 90) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(150, 520);
      S.parts.push({ k: 'out', x: S.cx, y: S.cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0, life: rand(0.9, 1.8), size: rand(2, 4.5), col: COLS[(Math.random() * 3) | 0] });
    }
  }
  function drawFx(t, dt) {
    const W = window.innerWidth, H = window.innerHeight;
    // 生まれる
    let rate = 0;
    if (t > 1.5 && t < 9.8) rate = 10 + 90 * Math.pow((t - 1.5) / 8.3, 1.5);   // まわりから中心へ集まる光
    S.acc += rate * dt;
    while (S.acc >= 1) {
      S.acc -= 1;
      S.parts.push({ k: 'in', a: rand(0, Math.PI * 2), r0: rand(S.R * 1.4, Math.max(W, H) * 0.5), age: 0, life: rand(0.7, 1.2), size: rand(1.5, 3.6), col: COLS[(Math.random() * 3) | 0] });
    }
    if (t > T_EVO && t < 11.6 && Math.random() < dt * 40) {   // 進化後：きらきらが降る
      S.parts.push({ k: 'fall', x: rand(0, W), y: -10, vx: rand(-20, 20), vy: rand(60, 150), age: 0, life: rand(1.6, 2.6), size: rand(2, 4), col: COLS[(Math.random() * 3) | 0] });
    }

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    // 衝撃波のわっか
    S.rings = S.rings.filter(r => t - r.t0 < r.dur);
    for (const r of S.rings) {
      const k = clamp((t - r.t0) / r.dur);
      if (k <= 0) continue;
      ctx.beginPath();
      ctx.arc(S.cx, S.cy, r.maxR * (1 - Math.pow(1 - k, 2)), 0, Math.PI * 2);
      ctx.lineWidth = 2 + 12 * (1 - k);
      ctx.strokeStyle = `rgba(255,255,255,${(0.85 * (1 - k)).toFixed(3)})`;
      ctx.stroke();
    }
    // つぶ
    const alive = [];
    for (const p of S.parts) {
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) continue;
      let x, y, a;
      if (p.k === 'in') {
        const d = p.r0 * Math.pow(1 - k, 1.5);
        x = S.cx + Math.cos(p.a) * d; y = S.cy + Math.sin(p.a) * d;
        a = k < 0.2 ? k / 0.2 : 1;
      } else if (p.k === 'out') {
        p.vx *= 1 - 1.6 * dt; p.vy *= 1 - 1.6 * dt; p.vy += 60 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; x = p.x; y = p.y; a = 1 - k;
      } else {
        p.x += p.vx * dt; p.y += p.vy * dt; x = p.x; y = p.y;
        a = (0.55 + 0.45 * Math.sin(p.age * 14)) * (1 - k);
      }
      ctx.fillStyle = `rgba(${p.col},${(a * 0.3).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x, y, p.size * 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(${p.col},${a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x, y, p.size, 0, Math.PI * 2); ctx.fill();
      alive.push(p);
    }
    S.parts = alive;
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------- おわり ----------
  function end() {
    if (!S || S.ended) return;
    const my = S;
    my.ended = true;
    if (!my.evolved) evolveNow();
    cancelAnimationFrame(my.raf);
    my.timers.forEach(clearTimeout);
    if (my.typing) clearInterval(my.typing);
    scene.style.display = 'none';
    scene.style.opacity = '';
    scene.classList.remove('msg');
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    wFrom.style.cssText = ''; wTo.style.cssText = '';
    // evolution.mp3 は最後まで鳴らす（余韻はほぼ無音）。ホームBGMをゆっくり戻す
    if (my.bgmWas) { try { fadeInMenuBGM(); } catch (e) {} }
    S = null; prepared = null;
  }
})();
