// ============================================================
// 画像・音声の自動先読み（クイックロード）
//   データ(monsters.js / dungeons.js / items.js)と効果音の定義から、
//   使う画像・音声のファイル名を自動で集めて先に読み込みます。
//   → 画像やモンスターを追加してデータに書くだけで、自動で先読みされます。
//   （このファイルは game.js の後に読み込む）
// ============================================================
(function () {
  const IMG_RE = /\.(png|jpe?g|webp|gif|svg)$/i;
  const AUD_RE = /\.(mp3|wav|ogg|m4a)$/i;
  const imgSet = new Set();   // 先読み対象の画像URL
  const audSet = new Set();   // 先読み対象の音声URL
  const keep = [];            // GC されないよう保持

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
  function safe(fn) { try { return fn(); } catch (e) { return undefined; } }

  function collect() {
    // モンスター：一覧用 m{id}.png と、詳細用 mp{id}.png（m1→mp1 / sm1→smp1）
    const mons = safe(() => MONSTER_DATA) || {};
    for (const k in mons) {
      const m = mons[k]; if (!m) continue;
      const img = m.img || `m${m.id != null ? m.id : k}.png`;
      add(img);
      add(img.replace(/(m)(\d+\.png)$/, '$1p$2'));
      walk(m, 0);
    }
    walk(safe(() => ITEM_DATA), 0);
    walk(safe(() => DUNGEON_DATA), 0);
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

  // 失敗してもすぐ諦めず、少し待って最大3回やり直す（一瞬の通信エラーで画像が欠けるのを防ぐ）
  function loadImage(url, tryN) {
    tryN = tryN || 0;
    return new Promise(resolve => {
      const im = new Image();
      im.onload = () => { (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(resolve); };
      im.onerror = () => {
        if (tryN >= 3) { resolve(); return; }          // 無いファイルは最終的に無視
        setTimeout(() => {
          loadImage(url, tryN + 1).then(resolve);   // 同じURLでやり直す（成功すれば本番の表示用にキャッシュされる）
        }, 400 * (tryN + 1));
      };
      im.decoding = 'async';
      im.src = url;
      keep.push(im);                     // デコード済み画像を保持
    });
  }

  // 効果音は再生時に初めて作るので、先に pool を作って待機させる（初回から即鳴る）
  function warmSE() {
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

  const idle = window.requestIdleCallback
    ? (f) => requestIdleCallback(f, { timeout: 1500 })
    : (f) => setTimeout(f, 60);

  async function run() {
    collect();
    // 1) 画面に出るものを先に：エリア背景・属性アイコンなど（先頭に出したいものを前へ）
    const imgs = Array.from(imgSet);
    const priority = imgs.filter(u => /^(dungeon|\d|gift|j\d)/.test(u));
    const rest = imgs.filter(u => !priority.includes(u));
    await Promise.all(priority.map(loadImage));
    // 2) 効果音を待機状態に
    warmSE();
    // 3) 残りの画像は少しずつ（通信・描画を邪魔しない）
    const BATCH = 6;
    for (let i = 0; i < rest.length; i += BATCH) {
      await new Promise(r => idle(r));
      await Promise.all(rest.slice(i, i + BATCH).map(loadImage));
    }
    // 4) BGMなど残りの音声
    for (const u of audSet) { await new Promise(r => idle(r)); warmAudio(u); }
  }

  // 他の場所から追加したいとき用：preloadAsset('new.png')
  window.preloadAsset = function (url) {
    if (IMG_RE.test(url)) loadImage(url); else if (AUD_RE.test(url)) warmAudio(url);
  };

  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run);
})();
