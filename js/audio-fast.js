// ============================================================
// 音のクイックロード（効果音・BGM）
//   ★ game.js の後に読み込む（BATTLE_SE / UI_SE / DUNGEON_BGM を使うため）
//
//   【効果音】起動直後から裏でファイルを読み込み、すぐ鳴らせる形（AudioBuffer）に変換しておく。
//     → iPhone(Safari) は <audio> の事前読み込みが効かず、初回は「読み込み→変換」が鳴らす瞬間に走って遅れるため。
//     ・鳴らし方（音量・速度・同時に鳴る数・設定画面の音量）は今までと同じ
//     ・準備前／音の長さを使う演出（cutin）は、今までの再生方法のまま（見た目・タイミングは変わらない）
//   【BGM】menu.mp3 と、開いたエリアのBGMだけ先にメモリへ読み込んでおく。
//     ・ダンジョン選択画面を開いた瞬間に、そのダンジョンの道中BGM・ボスBGMを最優先で読み込む（回線も優先）
//     ・メモリの上限に達したら、使っていない古い曲から手放す（新しい曲が置けなくならない）
//     ・読み込み失敗は1回やり直し、しばらくしたら再挑戦。バトルが始まるたびにボスBGMの読み込み状況を確認
//     ・読み込めたら <audio> を先に待機させ、鳴らす瞬間にそのまま使う
//
//   読み込みに失敗しても、何も起きず今までの再生方法に戻るだけ。
// ============================================================
(function () {
  'use strict';
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || typeof fetch !== 'function') return;

  const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const LOW_END = IS_IOS || (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  const held = () => { try { return !!(window.AssetHold && AssetHold.active()); } catch (e) { return false; } };   // ダンジョンに入る前後は裏の読み込みを止める（preload.js の合図）
  const SE_MAX_BYTES  = 450 * 1024;                          // これより大きい音（長いジングル等）は変換せず、今まで通りに鳴らす（メモリ節約）
  const BGM_BUDGET    = (IS_IOS ? 40 : 120) * 1024 * 1024;   // BGMをメモリに置く合計の上限
  const NO_FAST_SE    = { cutin: 1, skillwin: 1 };           // <audio> の長さで表示時間を決めている音（cutin.js／敵スキルのウインドウ）
  const KEEP_FILES   = ['skillwin.mp3', 'cutin.mp3'];        // 上の2つ：メモリ(blob)に置いて、いつでもすぐ鳴らせる状態にしておく
  const PRIO_SE       = ['damage','damageh','down','bind','dna','orblock','bshield','combok','kei','barrier','ikari','healk','darkness','change','pahu','roo','poison','kieru','chip'];   // 敵スキル・敵の行動で鳴る音：先に読み込む
  const SE_MAX_BYTES_PRIO = 1200 * 1024;                     // 敵スキル系は少し大きくても変換する（変換できないと遅い方法で鳴るため）

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
  const prioQueue = [];       // 敵スキル系：ダンジョンに入る前後でも止めずに読み込む
  const PRIO_FILES = new Set();
  let running = 0;
  const CONC = LOW_END ? 2 : 3;

  function decode(ab) {
    return new Promise((res, rej) => {
      try { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); } catch (e) { rej(e); }
    });
  }
  function loadSE(file, retried) {
    return fetch(file)
      .then(r => { if (!r.ok) throw new Error('http'); return r.arrayBuffer(); })
      .then(ab => {
        if (ab.byteLength > (PRIO_FILES.has(file) ? SE_MAX_BYTES_PRIO : SE_MAX_BYTES)) {
          skipped.add(file);
          prefetchBGM(file, false);   // 変換しない大きな音も、メモリ(blob)に置いておく → <audio> で鳴らす時もすぐ鳴る
          return;
        }
        return decode(ab).then(buf => { buffers.set(file, buf); });
      })
      .catch(() => {
        if (!retried) return new Promise(r => setTimeout(r, 1500)).then(() => loadSE(file, true));
        skipped.add(file);
      });
  }
  let _pumpTimer = null;
  function pump() {
    while (running < CONC && (prioQueue.length || (queue.length && !held()))) {
      const f = prioQueue.length ? prioQueue.shift() : queue.shift(); running++;
      loadSE(f).then(() => { running--; if (LOW_END) setTimeout(pump, 30); else pump(); });   // 軽量モードは1つずつ間をあける
    }
    if (queue.length && !prioQueue.length && held() && !_pumpTimer) _pumpTimer = setTimeout(() => { _pumpTimer = null; pump(); }, 400);   // ダンジョンに入る前後：少し待ってから再開
  }
  function enqueueSE(file, prio) {
    if (!file || !/\.(mp3|wav|ogg|m4a)$/i.test(file)) return;
    if (prio) PRIO_FILES.add(file);
    if (queued.has(file)) {                               // すでに順番待ちなら、急ぎの列へ移す
      if (prio) { const i = queue.indexOf(file); if (i >= 0) { queue.splice(i, 1); prioQueue.push(file); pump(); } }
      return;
    }
    queued.add(file); (prio ? prioQueue : queue).push(file); pump();
  }

  // ---- BGM：メモリ(blob)に置く ------------------------------------------------------
  //   ・「急ぎ(urgent)」＝いま入ろうとしているダンジョンの道中BGM・ボスBGM。回線を優先して読み込む
  //   ・メモリの上限を超えたら、使っていない古い曲から手放す（以前は上限に達すると新しい曲が一切置けなかった）
  //   ・読み込めた曲は <audio> を1つ先に作って待機させ、鳴らす瞬間にそのまま使う（初回の再生開始が速い）
  const blobs = new Map();     // file -> { url, size, t }
  const bgmPending = new Map();
  const failedAt = new Map();  // file -> 失敗した時刻（しばらくしたらまた挑戦する）
  let bgmBytes = 0;
  const bgmQueue = [];
  let bgmRunning = 0, bgmUrgentRunning = 0, _bgmTimer = null;
  const BGM_CONC = LOW_END ? 1 : 2;      // 急ぎでない読み込みの同時数
  const BGM_URGENT_CONC = 2;             // 急ぎ（道中＋ボス）は軽量モードでも2本同時
  const ALWAYS = ['menu.mp3'].concat(KEEP_FILES);
  const wanted = new Set(ALWAYS);        // いま必要な曲・音（メモリから手放さない）
  const warmEls = new Map();             // file -> 待機中の <audio>（最大3つ）
  const nowPlayingBGM = () => { try { return (typeof dungeonBGMFile !== 'undefined' && dungeonBGMFile) || null; } catch (e) { return null; } };

  function dropWarm(file) {
    const a = warmEls.get(file); if (!a) return;
    warmEls.delete(file);
    try { a.removeAttribute('src'); a.load(); } catch (e) {}
  }
  function warm(file) {
    if (warmEls.has(file) || warmEls.size >= 5 || file === nowPlayingBGM()) return;
    const b = blobs.get(file); if (!b) return;
    try { const a = new NativeAudio(b.url); a.preload = 'auto'; a.load(); warmEls.set(file, a); } catch (e) {}
  }
  function setWanted(files) {
    wanted.clear(); ALWAYS.forEach(f => wanted.add(f));
    files.forEach(f => { if (f) wanted.add(f); });
    Array.from(warmEls.keys()).forEach(f => { if (!wanted.has(f)) dropWarm(f); });
    KEEP_FILES.forEach(f => { if (blobs.has(f)) warm(f); });
    files.forEach(f => { if (f && blobs.has(f)) warm(f); });
  }
  // 上限に収まるよう、必要でない古い曲から手放す。収まらなければ false
  function makeRoom(size, keepFile) {
    if (bgmBytes + size <= BGM_BUDGET) return true;
    const playing = nowPlayingBGM();
    const olds = Array.from(blobs.entries())
      .filter(e => e[0] !== keepFile && e[0] !== playing && !wanted.has(e[0]))
      .sort((x, y) => x[1].t - y[1].t);
    for (const e of olds) {
      if (bgmBytes + size <= BGM_BUDGET) break;
      blobs.delete(e[0]); bgmBytes -= e[1].size; dropWarm(e[0]);
      try { URL.revokeObjectURL(e[1].url); } catch (err) {}
    }
    return bgmBytes + size <= BGM_BUDGET;
  }
  function fetchBGM(file, urgent, retried) {
    return fetch(file, urgent ? { priority: 'high' } : undefined)
      .then(r => { if (!r.ok) throw new Error('http'); return r.blob(); })
      .then(b => {
        if (!makeRoom(b.size, file)) return;   // どうしても入らない：置かない（今まで通り普通に再生される）
        bgmBytes += b.size;
        blobs.set(file, { url: URL.createObjectURL(b), size: b.size, t: Date.now() });
        if (wanted.has(file)) warm(file);
      })
      .catch(() => {
        if (!retried) return new Promise(r => setTimeout(r, 1200)).then(() => fetchBGM(file, urgent, true));
        failedAt.set(file, Date.now());       // 一時的な通信エラーで永久に諦めない：しばらくしたらまた挑戦できる
      });
  }
  function bgmPump() {
    while (bgmQueue.length) {
      let idx = bgmQueue.findIndex(q => q.urgent);
      if (idx >= 0) {
        if (bgmUrgentRunning >= BGM_URGENT_CONC) return;
      } else {
        if (held()) { if (!_bgmTimer) _bgmTimer = setTimeout(() => { _bgmTimer = null; bgmPump(); }, 500); return; }   // ダンジョンに入る前後は待つ
        if (bgmUrgentRunning > 0 || bgmRunning >= BGM_CONC) return;                                                   // 急ぎが動いている間は回線を譲る
        idx = 0;
      }
      const item = bgmQueue.splice(idx, 1)[0];
      bgmRunning++; if (item.urgent) bgmUrgentRunning++;
      fetchBGM(item.file, item.urgent).then(() => {
        bgmRunning--; if (item.urgent) bgmUrgentRunning--;
        bgmPending.delete(item.file); bgmPump();
      });
    }
  }
  function prefetchBGM(file, urgent) {
    if (!file) return;
    if (blobs.has(file)) { blobs.get(file).t = Date.now(); return; }
    const f = failedAt.get(file);
    if (f && Date.now() - f < 15000) return;
    if (bgmPending.has(file)) {                        // すでに順番待ち：急ぎなら前に出す（読み込み中ならそのまま待つ）
      if (urgent) { const q = bgmQueue.find(x => x.file === file); if (q) { q.urgent = true; bgmQueue.splice(bgmQueue.indexOf(q), 1); bgmQueue.unshift(q); bgmPump(); } }
      return;
    }
    if (!urgent && bgmBytes >= BGM_BUDGET) return;     // 急ぎでないものは、上限いっぱいなら先読みしない（急ぎは古い曲を手放して入れる）
    if (failedAt.has(file)) failedAt.delete(file);
    bgmPending.set(file, true);
    const item = { file, urgent: !!urgent };
    if (urgent) bgmQueue.unshift(item); else bgmQueue.push(item);
    bgmPump();
  }
  // new Audio('xxx.mp3') のとき、待機中の <audio> → メモリに置いてあるもの の順で使う（すぐ鳴る）
  const NativeAudio = window.Audio;
  function FastAudio(src) {
    if (typeof src === 'string') {
      const w = warmEls.get(src);
      if (w) { warmEls.delete(src); if (KEEP_FILES.indexOf(src) >= 0) setTimeout(() => warm(src), 0); return w; }   // 敵スキルの音などは、使ったらすぐ次の分を待機させる
      const b = blobs.get(src);
      if (b) { b.t = Date.now(); if (KEEP_FILES.indexOf(src) >= 0) setTimeout(() => warm(src), 0); return new NativeAudio(b.url); }
    }
    return src === undefined ? new NativeAudio() : new NativeAudio(src);
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

  // 敵スキルウインドウ用：AudioBufferで鳴らし、鳴り終わったら onEnd を呼ぶ。鳴らせなければ false（呼び出し側が従来の方法に戻る）
  function playTimed(file, vol, onEnd) {
    const buf = buffers.get(file);
    if (!buf) return false;
    if (ctx.state !== 'running') { try { ctx.resume().catch(() => {}); } catch (e) {} }   // iPhoneで眠っていたら起こす（起きるまで少し待つ）
    if (ctx.state !== 'running') return false;
    try {
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = buf; g.gain.value = Math.max(0, Math.min(1, vol * seMult()));
      src.connect(g); g.connect(ctx.destination);
      src.onended = () => { try { g.disconnect(); } catch (e) {} if (onEnd) onEnd(); };
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
  prefetchBGM('menu.mp3', true);
  KEEP_FILES.forEach(f => prefetchBGM(f, true));   // 敵スキルのウインドウ音(skillwin.mp3)・必殺技の音(cutin.mp3)
  ['skillwin.mp3', 'tap.mp3', 'modo.mp3', 'combo.mp3', 'drop.mp3', 'swipe.mp3'].forEach(f => enqueueSE(f, true));   // skillwin：iPhoneでは <audio> が自動再生制限で鳴らないので、AudioBufferで鳴らす   // 画面を触ってすぐ使う音は最優先
  // 敵のスキル・行動で鳴る効果音を、他の効果音より先に
  try { PRIO_SE.forEach(k => { if (BATTLE_SE[k] && !NO_FAST_SE[k]) enqueueSE(BATTLE_SE[k].file, true); }); } catch (e) {}
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
  // そのダンジョンの道中BGM・ボスBGMを最優先で（挑戦するまでの間に読み終える）
  function bgmOfDungeon(key) {
    const c = DUNGEON_BGM[key];
    if (c) return { field: c.field || c.boss, boss: c.boss || c.field };
    const d = DUNGEON_DATA[key], f = (d && d.bgm) || 'dungeon1.mp3';
    return { field: f, boss: f };
  }
  function prepareDungeonBGM(key) {
    try {
      const o = bgmOfDungeon(key);
      setWanted([o.field, o.boss]);
      prefetchBGM(o.field, true); prefetchBGM(o.boss, true);
    } catch (e) {}
  }
  wrap('openDungeonEntry', function (areaNum, stageType) { prepareDungeonBGM((areaNum || 1) + '-' + (stageType || '1')); return false; });
  // 念のための保険：選択画面を通らずに始まった場合・読み込みに失敗していた場合でも、ここで改めて急ぎにする
  wrap('startGameFromHome', function () {
    try { prepareDungeonBGM(currentAreaNum + '-' + (currentStageType === 'boss' ? 'boss' : currentStageType)); } catch (e) {}
    return false;
  });
  // バトルが始まるたびに、ボスBGMがまだ読み込み中なら最優先に引き上げる（置いてあれば何もしない＝軽い）
  wrap('playBattleBgm', function () {
    try { if (currentDungeonKey) prepareDungeonBGM(currentDungeonKey); } catch (e) {}
    return false;
  });

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

  // preload.js 用：BGMかどうか（BGMは上の仕組みで読み込むので、preload.js 側では二重に読み込まない）
  const bgmFileSet = new Set(['menu.mp3']);
  try { for (const k in DUNGEON_BGM) { const c = DUNGEON_BGM[k]; if (c) { if (c.field) bgmFileSet.add(c.field); if (c.boss) bgmFileSet.add(c.boss); } } } catch (e) {}
  window.AudioFast = { ctx, buffers, blobs, playTimed, prefetchBGM, prefetchAreaBGM, isBGM: f => bgmFileSet.has(f) };
})();
