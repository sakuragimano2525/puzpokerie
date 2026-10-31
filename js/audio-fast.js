// ============================================================
// 音のクイックロード（効果音・BGM）
//   ★ game.js の後に読み込む（BATTLE_SE / UI_SE / DUNGEON_BGM を使うため）
//
//   【効果音】起動直後から裏でファイルを読み込み、すぐ鳴らせる形（AudioBuffer）に変換しておく。
//     → iPhone(Safari) は <audio> の事前読み込みが効かず、初回は「読み込み→変換」が鳴らす瞬間に走って遅れるため。
//     ・鳴らし方（音量・速度・同時に鳴る数・設定画面の音量）は今までと同じ
//     ・準備前／音の長さを使う演出（cutin）は、今までの再生方法のまま（見た目・タイミングは変わらない）
//   【BGM】menu.mp3 と、開いたエリアのBGMだけ先にメモリへ読み込んでおく（上限あり。超えたら今まで通り）
//
//   読み込みに失敗しても、何も起きず今までの再生方法に戻るだけ。
// ============================================================
(function () {
  'use strict';
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || typeof fetch !== 'function') return;

  const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const SE_MAX_BYTES  = 450 * 1024;                          // これより大きい音（長いジングル等）は変換せず、今まで通りに鳴らす（メモリ節約）
  const BGM_BUDGET    = (IS_IOS ? 40 : 120) * 1024 * 1024;   // BGMをメモリに置く合計の上限
  const NO_FAST_SE    = { cutin: 1 };                        // cutin.js が <audio> の長さで表示時間を決めている音

  let ctx = null;
  try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { return; } }
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}   // iPhoneのマナーモードでも鳴るように

  // ---- 最初のタッチでオーディオを起こす（iOS の自動再生制限）--------------------------
  function unlock() {
    if (ctx.state === 'running') return;
    try {
      const p = ctx.resume(); if (p && p.catch) p.catch(() => {});
      const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
      s.buffer = b; s.connect(ctx.destination); s.start(0);
    } catch (e) {}
  }
  ['touchend', 'pointerup', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, unlock, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && ctx.state !== 'running') { try { ctx.resume().catch(() => {}); } catch (e) {} } });

  // ---- 効果音：読み込み → AudioBuffer ---------------------------------------------
  const buffers = new Map();   // file -> AudioBuffer
  const skipped = new Set();   // 大きすぎ・失敗（今まで通りに鳴らす）
  const queued  = new Set();
  const queue   = [];
  let running = 0;
  const CONC = 3;

  function decode(ab) {
    return new Promise((res, rej) => {
      try { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); } catch (e) { rej(e); }
    });
  }
  function loadSE(file, retried) {
    return fetch(file)
      .then(r => { if (!r.ok) throw new Error('http'); return r.arrayBuffer(); })
      .then(ab => {
        if (ab.byteLength > SE_MAX_BYTES) { skipped.add(file); return; }
        return decode(ab).then(buf => { buffers.set(file, buf); });
      })
      .catch(() => {
        if (!retried) return new Promise(r => setTimeout(r, 1500)).then(() => loadSE(file, true));
        skipped.add(file);
      });
  }
  function pump() {
    while (running < CONC && queue.length) {
      const f = queue.shift(); running++;
      loadSE(f).then(() => { running--; pump(); });
    }
  }
  function enqueueSE(file) {
    if (!file || queued.has(file) || !/\.(mp3|wav|ogg|m4a)$/i.test(file)) return;
    queued.add(file); queue.push(file); pump();
  }

  // ---- BGM：メモリ(blob)に置く ------------------------------------------------------
  const blobs = new Map();     // file -> { url, size }
  const bgmPending = new Map();
  let bgmBytes = 0;
  function prefetchBGM(file) {
    if (!file || blobs.has(file) || bgmPending.has(file) || skipped.has('bgm:' + file)) return;
    if (bgmBytes >= BGM_BUDGET) return;
    const p = fetch(file)
      .then(r => { if (!r.ok) throw new Error('http'); return r.blob(); })
      .then(b => {
        if (bgmBytes + b.size > BGM_BUDGET) return;   // 上限超え：置かない（今まで通り普通に再生される）
        bgmBytes += b.size;
        blobs.set(file, { url: URL.createObjectURL(b), size: b.size });
      })
      .catch(() => { skipped.add('bgm:' + file); })
      .then(() => { bgmPending.delete(file); });
    bgmPending.set(file, p);
  }
  // new Audio('xxx.mp3') のとき、メモリに置いてあるものがあればそれを使う（すぐ鳴る）
  const NativeAudio = window.Audio;
  function FastAudio(src) {
    const b = (typeof src === 'string') ? blobs.get(src) : null;
    return b ? new NativeAudio(b.url) : (src === undefined ? new NativeAudio() : new NativeAudio(src));
  }
  FastAudio.prototype = NativeAudio.prototype;
  window.Audio = FastAudio;

  // ---- 再生 -------------------------------------------------------------------
  const active = new Map();   // key -> Set<source>
  function seMult() { try { return (window.GameSettings ? GameSettings.get().se : 50) / 50; } catch (e) { return 1; } }
  function playBuf(key, file, vol, rate, maxVoices, exclusive) {
    const buf = buffers.get(file);
    if (!buf || ctx.state !== 'running') return false;
    try {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      if (rate && rate !== 1) src.playbackRate.value = rate;   // 速度を変えると音の高さも変わる（今までと同じ）
      const g = ctx.createGain();
      g.gain.value = Math.max(0, Math.min(1, vol));
      src.connect(g); g.connect(ctx.destination);
      let set = active.get(key); if (!set) { set = new Set(); active.set(key, set); }
      if (exclusive) { set.forEach(s => { try { s.stop(); } catch (e) {} }); set.clear(); }
      else if (maxVoices && set.size >= maxVoices) {          // 今までの「プール」と同じ：多すぎるときは古い音から切る
        const old = set.values().next().value;
        if (old) { try { old.stop(); } catch (e) {} set.delete(old); }
      }
      set.add(src);
      src.onended = () => { set.delete(src); try { g.disconnect(); } catch (e) {} };
      src.start(0);
      return true;
    } catch (e) { return false; }
  }

  // ---- 既存の再生関数を包む（準備できていれば速い方、まだなら今まで通り）------------------
  function wrap(name, fn) {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () {
      try { if (fn.apply(this, arguments) === true) return; } catch (e) {}
      return orig.apply(this, arguments);
    };
  }

  wrap('playSE', function (name, rate) {
    const def = BATTLE_SE[name];
    if (!def || NO_FAST_SE[name]) return false;
    return playBuf('se:' + name, def.file, def.vol * seMult(), rate || 1, def.pool, false);
  });
  wrap('playUiSE', function (name) {
    const se = UI_SE[name];
    if (!se || !buffers.has(se.file) || ctx.state !== 'running') return false;
    const now = performance.now();
    if (now - se.last < 60) return true;      // 二重発火防止（今までと同じ）
    se.last = now;
    return playBuf('ui:' + name, se.file, 0.7 * seMult(), 1, 4, false);
  });
  wrap('playComboSound', function (comboCount) {
    const rate = Math.min(2.0, 1.0 + (comboCount - 1) * 0.035);
    return playBuf('combo', 'combo.mp3', seMult(), rate, 1, true);
  });
  wrap('playDropSound', function () {
    return playBuf('drop', 'drop.mp3', seMult(), 1, 1, true);
  });
  wrap('playSwipeSound', function () {
    return playBuf('swipe', 'swipe.mp3', 0.6 * seMult(), 1, 1, true);
  });
  // ゲームオーバー音・クリア音を「止める」処理にも対応
  (function () {
    const orig = window._stopSEByName;
    if (typeof orig !== 'function') return;
    window._stopSEByName = function (name) {
      try { const set = active.get('se:' + name); if (set) { set.forEach(s => { try { s.stop(); } catch (e) {} }); set.clear(); } } catch (e) {}
      return orig.apply(this, arguments);
    };
  })();

  // ---- 開始 ---------------------------------------------------------------------
  // 1) 画面に最初に出る音を先に
  prefetchBGM('menu.mp3');
  ['tap.mp3', 'modo.mp3', 'combo.mp3', 'drop.mp3', 'swipe.mp3'].forEach(enqueueSE);
  // 2) バトル効果音（定義の順）
  try { for (const k in BATTLE_SE) if (!NO_FAST_SE[k]) enqueueSE(BATTLE_SE[k].file); } catch (e) {}
  try { for (const k in UI_SE) enqueueSE(UI_SE[k].file); } catch (e) {}

  // 3) エリアを開いたとき、そのエリアのBGM（道中・ボス）を先にメモリへ
  function prefetchAreaBGM(area) {
    try {
      const pre = String(area) + '-';
      for (const key in DUNGEON_BGM) {
        if (key.indexOf(pre) !== 0) continue;
        const c = DUNGEON_BGM[key]; if (!c) continue;
        prefetchBGM(c.field); prefetchBGM(c.boss);
      }
    } catch (e) {}
  }
  wrap('openStageSelect', function (areaNum) { prefetchAreaBGM(areaNum); return false; });

  // 4) ひまな時間に、いちばん進んだエリアのBGMも（ホームにいる間に済ませる）
  try {
    const idle = window.requestIdleCallback ? (f) => requestIdleCallback(f, { timeout: 4000 }) : (f) => setTimeout(f, 1500);
    idle(() => {
      try {
        let a = 1;
        for (let k = 1; k <= (TOTAL_STAGES || 1); k++) if (typeof isAreaUnlocked === 'function' && isAreaUnlocked(k)) a = k;
        prefetchAreaBGM(a);
      } catch (e) {}
    });
  } catch (e) {}

  window.AudioFast = { ctx, buffers, blobs, prefetchBGM, prefetchAreaBGM };
})();
