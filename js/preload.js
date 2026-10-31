// ============================================================
// 画像・音声の自動先読み（クイックロード）【軽量化版】
//   データ(monsters.js / dungeons.js / items.js)と効果音の定義から、
//   使う画像・音声のファイル名を自動で集めて先に読み込みます。
//   → 画像やモンスターを追加してデータに書くだけで、自動で先読みされます。
//   （このファイルは game.js の後に読み込む）
//
//   ★ 軽量化のポイント（見た目・演出は変わりません）
//     1) 「ダンジョン選択画面を開いた瞬間」に、そのダンジョンで使う画像だけを最優先で読み込む
//        → 「挑戦する」を押す頃には、背景・敵・自分のパーティーの画像がそろっている
//     2) ダンジョンに入る前後は、裏の一括先読みを一時停止（回線・CPUの取り合いをなくす）
//     3) iPhone・低スペック端末（LOW_END）では、全画像のデコード保持／全BGMの一括読み込み／
//        重い効果音プールの先作りをやめて、少しずつ・必要な分だけ読み込む
//     4) 全ダンジョンデータの走査は一気にやらず、ひまな時間に少しずつ分けて行う
// ============================================================
(function () {
  const IMG_RE = /\.(png|jpe?g|webp|gif|svg)$/i;
  const AUD_RE = /\.(mp3|wav|ogg|m4a)$/i;
  const imgSet = new Set();   // 先読み対象の画像URL（裏の先読み用）
  const audSet = new Set();   // 先読み対象の音声URL
  const keep = [];            // GC されないよう保持（高性能端末の裏先読み分）
  const loaded = new Set();   // 読み込み成功済みの画像URL
  let dungeonKeep = [];       // 直近に開いたダンジョンの画像だけ保持（次を開いたら入れ替え＝メモリは増えない）

  function safe(fn) { try { return fn(); } catch (e) { return undefined; } }

  // iPhone / iPad(Safari)・メモリ少なめ・コア数少なめ・データ節約モードの端末は「軽量モード」
  const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const conn = navigator.connection || {};
  const LOW_END = IS_IOS || (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
                  (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || !!conn.saveData;
  const BG_CONC = LOW_END ? 2 : 6;      // 裏の先読みの同時読み込み数
  const BOOST_CONC = LOW_END ? 4 : 8;   // ダンジョン用の最優先読み込みの同時数

  // ---- 「いまは裏の先読みを止めて」の合図（audio-fast.js も見る）-------------------------
  let holdUntil = 0;
  function hold(ms) { holdUntil = Math.max(holdUntil, Date.now() + ms); }
  function holding() { return Date.now() < holdUntil; }
  function waitHold() {
    return new Promise(res => { (function t() { if (!holding()) res(); else setTimeout(t, 250); })(); });
  }
  window.AssetHold = { hold, active: holding };

  function add(v) {
    if (typeof v !== 'string' || !v || v.length > 200) return;
    if (IMG_RE.test(v)) imgSet.add(v);
    else if (AUD_RE.test(v)) audSet.add(v);
  }
  // データ内の文字列を再帰的に走査（ファイル名らしきものを全部拾う）
  function walk(o, depth) {
    if (o == null || depth > 12) return;
    if (typeof o === 'string') { add(o); return; }
    if (Array.isArray(o)) { for (const x of o) walk(x, depth + 1); return; }
    if (typeof o === 'object') for (const k in o) walk(o[k], depth + 1);
  }

  const idle = window.requestIdleCallback
    ? (f) => requestIdleCallback(f, { timeout: 1500 })
    : (f) => setTimeout(f, 60);
  const nextIdle = () => new Promise(r => idle(r));

  // ---- 画像1枚の読み込み ----------------------------------------------------------------
  //   opts.light : デコードも保持もしない（キャッシュに載せるだけ）
  //   opts.high  : 優先度を上げる
  //   opts.hold  : デコードして配列に保持する（ダンジョン用）
  //   失敗してもすぐ諦めず、少し待ってやり直す（一瞬の通信エラーで画像が欠けるのを防ぐ）
  function loadImage(url, tryN, opts) {
    tryN = tryN || 0; opts = opts || {};
    const maxTry = LOW_END && !opts.high ? 1 : 3;     // 無いファイルを何度も取りに行かない（軽量モードの裏先読み）
    return new Promise(resolve => {
      const im = new Image();
      im.onload = () => {
        loaded.add(url);
        if (opts.light) { im.onload = im.onerror = null; resolve(); return; }
        (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(resolve);
      };
      im.onerror = () => {
        if (tryN >= maxTry) { resolve(); return; }       // 無いファイルは最終的に無視
        setTimeout(() => { loadImage(url, tryN + 1, opts).then(resolve); }, 400 * (tryN + 1));
      };
      im.decoding = 'async';
      if (opts.high && 'fetchPriority' in im) im.fetchPriority = 'high';
      im.src = url;
      if (opts.hold) dungeonKeep.push(im);
      else if (!opts.light) keep.push(im);               // デコード済み画像を保持（高性能端末のみ）
    });
  }
  // 配列を同時 n 件ずつ読む
  async function loadPool(urls, n, opts) {
    let i = 0;
    const worker = async () => { while (i < urls.length) { const u = urls[i++]; await loadImage(u, 0, opts); } };
    await Promise.all(Array.from({ length: Math.min(n, urls.length) }, worker));
  }

  // ---- ダンジョン1つ分の画像を最優先で読む（選択画面を開いたとき） --------------------------
  function dungeonImages(areaNum, stageType) {
    const key = areaNum + '-' + stageType;
    const d = safe(() => DUNGEON_DATA[key]);
    const list = [];
    const push = v => { if (typeof v === 'string' && IMG_RE.test(v) && !list.includes(v)) list.push(v); };
    // 1) 背景
    push((d && d.bgImg) || safe(() => areaBgImage(areaNum)));
    // 2) 自分のパーティー（出撃したらすぐ画面に出る）
    safe(() => {
      const uids = (typeof partyUids !== 'undefined' && partyUids) || [];
      uids.forEach(uid => {
        if (uid === null || uid === undefined) return;
        const e = box.find(b => b.uid === uid);
        const m = e && MONSTER_DATA[e.monsterId];
        if (m) push(monsterImg(m));
      });
    });
    // 3) 最初のバトルの敵 → 残りのバトルの敵（ランダム階層のときは候補すべて）
    if (d) {
      const enemyImgs = arr => (arr || []).forEach(e => e && push(e.img));
      const battles = d.battles || [];
      if (battles[0]) enemyImgs(battles[0].enemies);
      if (d.random && d.random.monsters) for (const k in d.random.monsters) push(d.random.monsters[k] && d.random.monsters[k].img);
      battles.slice(1).forEach(b => enemyImgs(b && b.enemies));
      if (d.intrusion && d.intrusion.monsters) enemyImgs(d.intrusion.monsters);
    }
    // 4) ラスボスの専用背景など
    safe(() => {
      const st = BOSS_CLOUD_STAGES[key];
      if (st) { push(typeof st === 'object' ? st.bg : st); if (typeof st === 'object') push(st.via); }
    });
    return list;
  }
  let _boostGen = 0;
  async function boostDungeon(areaNum, stageType) {
    const gen = ++_boostGen;
    const urls = dungeonImages(areaNum, stageType).filter(u => !loaded.has(u));
    if (!urls.length) return;
    dungeonKeep = [];                                   // 前に開いたダンジョンの分を手放す
    // 先頭（背景・パーティー・最初の敵）はすぐ、残りはその後に
    await loadPool(urls.slice(0, 8), BOOST_CONC, { high: true, hold: true });
    if (gen !== _boostGen) return;
    await loadPool(urls.slice(8), Math.max(2, BOOST_CONC >> 1), { hold: true });
  }

  // ---- 裏の一括先読み用：集める（重いので分割） ------------------------------------------
  function collectLight() {
    // モンスター：一覧用 m{id}.png と、詳細用 mp{id}.png（m1→mp1 / sm1→smp1）
    const mons = safe(() => MONSTER_DATA) || {};
    const owned = new Set(safe(() => box.map(b => b.monsterId)) || []);
    const first = [], other = [];
    for (const k in mons) {
      const m = mons[k]; if (!m) continue;
      const img = m.img || `m${m.id != null ? m.id : k}.png`;
      const mp = img.replace(/(m)(\d+\.png)$/, '$1p$2');
      (owned.has(m.id != null ? m.id : Number(k)) ? first : other).push(img, mp);
    }
    first.forEach(add);                                  // 持っているモンスターを先に
    other.forEach(add);
    walk(safe(() => ITEM_DATA), 0);
    walk(safe(() => DUNGEON_BGM), 0);
    // エリア背景（dungeon{n}.png）
    const total = safe(() => TOTAL_STAGES) || 10;
    for (let n = 1; n <= total; n++) add(safe(() => areaBgImage(n)));
    // イベントステージの背景
    for (const id in (safe(() => EVENT_INFO) || {})) add(safe(() => areaBgImage(id)));
    // 効果音・UI音・共通BGM
    const bse = safe(() => BATTLE_SE) || {};
    for (const k in bse) add(bse[k] && bse[k].file);
    const use = safe(() => UI_SE) || {};
    for (const k in use) add(use[k] && use[k].file);
    ['menu.mp3', 'combo.mp3', 'drop.mp3', 'chip.mp3', 'swipe.mp3', 'skillwin.wav'].forEach(add);
    // よく使う共通の画像（属性アイコン・バフアイコン・ギフト等）
    add('status.png');
    ['sta1','sta2','sta3'].forEach(n => add(n + '.png'));          // ステータスアイコン
    add('itembox.png'); add('hcoin.png'); add('ojama.png');   // お邪魔ドロップ
    Array.from(document.images).forEach(im => add(im.getAttribute('src')));   // index.html に直接書かれた画像も先読み
    ['1','2','3','4','5'].forEach(n => { add(n + '.png'); add('gift' + n + '.png'); add('gift' + n + 's.png'); });
    ['j1','j2','j3','j4','j5','j6','j8'].forEach(n => add(n + '.png'));
  }
  // 全ダンジョンの敵・ドロップ画像：一気に走査せず、ひまな時間に少しずつ
  async function collectDungeonsChunked() {
    const data = safe(() => DUNGEON_DATA) || {};
    const keys = Object.keys(data);
    const STEP = LOW_END ? 4 : 12;
    for (let i = 0; i < keys.length; i += STEP) {
      await nextIdle();
      if (holding()) await waitHold();
      for (let j = i; j < Math.min(keys.length, i + STEP); j++) walk(data[keys[j]], 0);
    }
  }

  // ---- 効果音の先作り ---------------------------------------------------------------------
  // 効果音は再生時に初めて作るので、先に pool を作って待機させる（初回から即鳴る）
  //   audio-fast.js が使える端末では、そちらの方式で鳴るので、重い pool の先作りは省く
  function warmSE() {
    if (LOW_END && window.AudioFast) return;
    safe(() => {
      for (const name in BATTLE_SE) {
        const def = BATTLE_SE[name];
        if (_seState[name]) continue;
        const st = _seState[name] = { pool: [], idx: 0 };
        for (let i = 0; i < def.pool; i++) {
          const a = new Audio(def.file); a.preload = 'auto'; a.volume = def.vol; st.pool.push(a);
        }
      }
    });
    safe(() => {
      for (const name in UI_SE) {
        const se = UI_SE[name];
        if (se.pool.length) continue;
        for (let i = 0; i < 4; i++) {
          const a = new Audio(se.file); a.preload = 'auto'; a.volume = 0.7; se.pool.push(a);
        }
      }
    });
  }
  function warmAudio(url) {
    const a = new Audio(); a.preload = 'auto'; a.src = url; keep.push(a);
  }

  async function run() {
    await nextIdle();
    collectLight();
    // 1) 画面に出るものを先に：エリア背景・属性アイコンなど（先頭に出したいものを前へ）
    const first = Array.from(imgSet);
    const priority = first.filter(u => /^(dungeon|\d|gift|j\d)/.test(u));
    await loadPool(priority, BG_CONC, { light: LOW_END });
    // 2) 効果音を待機状態に
    warmSE();
    // 3) 全ダンジョンのデータを、ひまな時間に少しずつ走査
    await collectDungeonsChunked();
    // 4) 残りの画像は少しずつ（通信・描画を邪魔しない。ダンジョンに入る前後は止まる）
    const rest = Array.from(imgSet).filter(u => !priority.includes(u) && !loaded.has(u));
    const BATCH = LOW_END ? 2 : 6;
    for (let i = 0; i < rest.length; i += BATCH) {
      await nextIdle();
      if (holding()) await waitHold();
      await loadPool(rest.slice(i, i + BATCH), BG_CONC, { light: LOW_END });
    }
    // 5) BGMなど残りの音声（軽量モードは全BGMを一括で読み込むとメモリを圧迫するので、再生するときに読み込む）
    //   BGM は audio-fast.js が「必要な曲だけ・優先して」読み込むので、ここでは二重に読み込まない（回線とメモリを節約）
    if (!LOW_END) for (const u of audSet) {
      if (window.AudioFast && AudioFast.isBGM && AudioFast.isBGM(u)) continue;
      await nextIdle(); if (holding()) await waitHold(); warmAudio(u);
    }
  }

  // ---- ゲーム側の関数に「合図」だけ足す（中身は今まで通り呼ぶ） ---------------------------------
  function wrapGlobal(name, before) {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () {
      try { before.apply(this, arguments); } catch (e) {}
      return orig.apply(this, arguments);
    };
  }
  // ダンジョン選択画面を開いたら：裏の先読みを止めて、そのダンジョンの画像を最優先で
  wrapGlobal('openDungeonEntry', function (areaNum, stageType) {
    hold(20000);
    boostDungeon(areaNum || 1, stageType || '1');
  });
  // 「挑戦する」→ 入場〜START表示のあいだも、裏の先読みは止めておく
  wrapGlobal('startGameFromHome', function () { hold(9000); });

  // 他の場所から追加したいとき用：preloadAsset('new.png')
  window.preloadAsset = function (url) {
    if (IMG_RE.test(url)) loadImage(url, 0, { light: LOW_END }); else if (AUD_RE.test(url)) warmAudio(url);
  };

  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run);
})();
