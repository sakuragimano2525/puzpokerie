// ============================================================
// ★ 竜石（りゅうせき）＋ 宝箱バトル ★
//
//   ・10-1 以降の全ステージ（10-1〜、BOSSステージも含む）に、竜石が確定で1つある。
//   ・ボスの1つ前のフロアに「宝箱バトル」が追加される。宝箱を開けると竜石が手に入る。
//   ・宝箱バトル：HPバーなし。真ん中に宝箱と「あと3」。ターンが0になると宝箱は消滅（失敗）。
//     ミッションが2つ（左上・右上）。条件はランダム：
//        ○属性をタテに5つで並べろ ／ ○属性を6つ繋げて消せ（1つの塊で6個以上） ／ 5〜8コンボ以上しろ ／ 合計19〜23コンボしろ
//   ・1度そのステージで竜石を取ったら二度と手に入らない（宝箱バトルも出なくなる）。
//   ・ステージ選択の▶の左に竜石の画像（取得済み＝カラー／未取得＝灰色）。
//
//   game.js から呼ばれるもの：
//     Ryuseki.isEligible(key) / has(key) / insertChest(key, battles)
//     Ryuseki.load(enemy)      … 宝箱バトルの開始（loadBattle から）
//     Ryuseki.active()         … いま宝箱バトル中か
//     Ryuseki.beginMove() / noteGroup(color, cells, rows) / endMove(totalCombo, attrCounts) … 1回の操作ごと
//     Ryuseki.iconHtml(key)    … ステージ選択に出す竜石アイコン
// ============================================================
(function () {
  'use strict';

  var IMG = 'rst.png';                 // 竜石の画像
  var CHEST_IMG = null;                // 宝箱の画像（いまは仮で「〇」。画像ができたらここにファイル名を入れる）

  // 宝箱のイラスト（SVG）。青×銀の宝箱を斜め前から見た絵。
  //   .rc-in（開いたとき見える中の光）／.rc-body（本体）／.rc-lock（鍵穴プレート）／.rc-lid（ふた）／.rc-beam（光の筋）が別パーツで、
  //   開くときに css/ryuseki.css の .rc-wrap.opening 〜 で動く。色や形を変えたいときは、この中の fill / path を直す。
  var CHEST_SVG = `<svg class="rc-svg" viewBox="0 0 200 170" overflow="visible" aria-hidden="true">
    <defs>
    <linearGradient id="rcSilverF" gradientUnits="userSpaceOnUse" x1="29.4" y1="63.6" x2="127.4" y2="151"><stop offset="0" stop-color="#e2e9f1"/><stop offset="0.4" stop-color="#b3bfcc"/><stop offset="1" stop-color="#75818f"/></linearGradient>
    <linearGradient id="rcSilverR" gradientUnits="userSpaceOnUse" x1="127.4" y1="63.6" x2="181.7" y2="148.8"><stop offset="0" stop-color="#98a4b3"/><stop offset="1" stop-color="#505b6c"/></linearGradient>
    <linearGradient id="rcSilverL" gradientUnits="userSpaceOnUse" x1="24.1" y1="4" x2="130.6" y2="82.8"><stop offset="0" stop-color="#f8fbfe"/><stop offset="0.5" stop-color="#dbe3ec"/><stop offset="1" stop-color="#98a4b3"/></linearGradient>
    <linearGradient id="rcCap" gradientUnits="userSpaceOnUse" x1="111.4" y1="36" x2="183.8" y2="36"><stop offset="0" stop-color="#f6f9fc"/><stop offset="0.35" stop-color="#d6dde6"/><stop offset="1" stop-color="#8892a1"/></linearGradient>
    <linearGradient id="rcPanelF" gradientUnits="userSpaceOnUse" x1="11.3" y1="76.4" x2="11.3" y2="136.1"><stop offset="0" stop-color="#0b3fd0"/><stop offset="0.55" stop-color="#1f7bf2"/><stop offset="1" stop-color="#37d3ff"/></linearGradient>
    <linearGradient id="rcPanelR" gradientUnits="userSpaceOnUse" x1="139.1" y1="72.2" x2="168.9" y2="133.9"><stop offset="0" stop-color="#0a2aa6"/><stop offset="1" stop-color="#050c4a"/></linearGradient>
    <linearGradient id="rcLidB1" gradientUnits="userSpaceOnUse" x1="37.9" y1="-27.9" x2="62.4" y2="-27.9"><stop offset="0" stop-color="#0a2a9a"/><stop offset="0.3" stop-color="#1b62ee"/><stop offset="1" stop-color="#58b4ff"/></linearGradient>
    <linearGradient id="rcLidB2" gradientUnits="userSpaceOnUse" x1="83.7" y1="-27.9" x2="139.1" y2="-27.9"><stop offset="0" stop-color="#2bd0ff"/><stop offset="0.45" stop-color="#1c8cf6"/><stop offset="1" stop-color="#0f47c8"/></linearGradient>
    <linearGradient id="rcDeep" gradientUnits="userSpaceOnUse" x1="139.1" y1="17.8" x2="177.5" y2="65.8"><stop offset="0" stop-color="#0d1a8a"/><stop offset="1" stop-color="#050a38"/></linearGradient>
    <linearGradient id="rcPlate" gradientUnits="userSpaceOnUse" x1="63.5" y1="88.1" x2="98.6" y2="121.1"><stop offset="0" stop-color="#f1f4f8"/><stop offset="0.55" stop-color="#b5bfcb"/><stop offset="1" stop-color="#7f8b9a"/></linearGradient>
    <linearGradient id="rcBeam" gradientUnits="userSpaceOnUse" x1="11.3" y1="65.8" x2="11.3" y2="-83.3"><stop offset="0" stop-color="#fff3b0" stop-opacity="0.95"/><stop offset="1" stop-color="#ffd24a" stop-opacity="0"/></linearGradient>
    <radialGradient id="rcGlow" gradientUnits="userSpaceOnUse" cx="102.9" cy="63.6" r="63.9"><stop offset="0" stop-color="#fff6c2"/><stop offset="0.55" stop-color="#ffc83a"/><stop offset="1" stop-color="#b86a00"/></radialGradient>
    <radialGradient id="rcFloorSh" gradientUnits="userSpaceOnUse" cx="117.8" cy="139.3" r="100.1"><stop offset="0" stop-color="#000" stop-opacity=".72"/><stop offset="0.6" stop-color="#000" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <clipPath id="rcLidClip">
    <path d="M 24.5 57.7 C 15.6 48.7 14.3 29.1 23.7 17.2 C 32.2 7.8 49.7 3.6 68.8 4 C 96.5 5.3 122.1 9.5 158.3 8.3 C 169.4 6.6 180.9 9.5 183 21.5 C 184.3 36 181.7 53 172.8 64.1 L 127.4 81.7 Z"/>
    </clipPath></defs>
    <g class="rc-floor">
    <ellipse cx="122.1" cy="139.3" rx="95.8" ry="13.6" fill="url(#rcFloorSh)"/></g>
    <g class="rc-in">
    <path d="M 29.4 64.1 L 127.4 83.9 L 172.6 64.1 L 74.6 44.3 Z" fill="url(#rcGlow)" stroke="#aeb8c4" stroke-width="1.7" stroke-linejoin="round"/></g>
    <g class="rc-body">
    <path d="M 127.4 83.9 L 172.6 64.1 L 180 121.1 L 127.4 149.5 Z" fill="url(#rcSilverR)" stroke="#3e4757" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M 138.7 88.8 L 169.4 74.7 L 170.6 118.6 L 138.7 132.2 Z" fill="url(#rcPanelR)" stroke="#06103a" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M 142.1 130.1 L 142.1 95.6 C 142.1 87.1 149.8 82.8 158.3 83.2 C 163.8 83.7 165.5 87.1 165.5 92.6 L 165.5 121.1 L 160 123.7 L 160 94.3 C 160 91.3 158.3 89.6 155.3 89.6 C 150.2 89.6 147.6 92.6 147.6 96.9 L 147.6 128 Z" fill="url(#rcSilverF)" stroke="#2f3848" stroke-width="0.7" stroke-linejoin="round"/>
    <path d="M 29.4 64.1 L 127.4 83.9 L 127.4 149.5 L 29.4 120.1 Z" fill="url(#rcSilverF)" stroke="#3e4757" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M 45 76.4 L 114 88.8 L 114 136.5 L 45 111.6 Z" fill="url(#rcPanelF)" stroke="#07124e" stroke-width="1.7" stroke-linejoin="round"/>
    <path d="M 45 76.4 L 49.2 77.3 L 49.2 113.5 L 45 111.6 Z" fill="#071560" opacity=".75"/>
    <path d="M 114.8 89.6 L 125.9 91.8 L 125.9 148 L 114.8 142.4 Z" fill="#fff" opacity=".35"/>
    <path d="M 34.7 118.4 L 39.4 119.9" stroke="#fff" stroke-opacity=".85" stroke-width="1.1" stroke-linecap="round" fill="none"/>
    <path d="M 43.5 121.1 L 48.2 122.6" stroke="#fff" stroke-opacity=".85" stroke-width="1.1" stroke-linecap="round" fill="none"/>
    <path d="M 52.2 123.7 L 56.9 125.2" stroke="#fff" stroke-opacity=".85" stroke-width="1.1" stroke-linecap="round" fill="none"/>
    <path d="M 60.9 126.4 L 65.6 127.9" stroke="#fff" stroke-opacity=".85" stroke-width="1.1" stroke-linecap="round" fill="none"/>
    <path d="M 69.7 129.1 L 74.4 130.6" stroke="#fff" stroke-opacity=".85" stroke-width="1.1" stroke-linecap="round" fill="none"/>
    <path d="M 78.4 131.8 L 83.1 133.3" stroke="#fff" stroke-opacity=".85" stroke-width="1.1" stroke-linecap="round" fill="none"/>
    <path d="M 87.1 134.5 L 91.8 136" stroke="#fff" stroke-opacity=".85" stroke-width="1.1" stroke-linecap="round" fill="none"/>
    <path d="M 95.9 137.2 L 100.6 138.7" stroke="#fff" stroke-opacity=".85" stroke-width="1.1" stroke-linecap="round" fill="none"/>
    <path d="M 104.6 139.9 L 109.3 141.3" stroke="#fff" stroke-opacity=".85" stroke-width="1.1" stroke-linecap="round" fill="none"/>
    <path d="M 113.3 142.5 L 118 144" stroke="#fff" stroke-opacity=".85" stroke-width="1.1" stroke-linecap="round" fill="none"/>
    <path d="M 122.1 145.2 L 126.8 146.7" stroke="#fff" stroke-opacity=".85" stroke-width="1.1" stroke-linecap="round" fill="none"/>
    <path d="M 36.9 67.5 L 42.4 68.8" stroke="#fff" stroke-opacity=".9" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    <path d="M 45.9 69.4 L 51.4 70.7" stroke="#fff" stroke-opacity=".9" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    <path d="M 54.9 71.4 L 60.4 72.6" stroke="#fff" stroke-opacity=".9" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    <path d="M 63.9 73.3 L 69.4 74.6" stroke="#fff" stroke-opacity=".9" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    <path d="M 72.8 75.2 L 78.4 76.5" stroke="#fff" stroke-opacity=".9" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    <path d="M 81.8 77.2 L 87.4 78.5" stroke="#fff" stroke-opacity=".9" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    <path d="M 90.8 79.1 L 96.4 80.4" stroke="#fff" stroke-opacity=".9" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    <path d="M 99.8 81.1 L 105.4 82.3" stroke="#fff" stroke-opacity=".9" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    <path d="M 108.8 83 L 114.4 84.3" stroke="#fff" stroke-opacity=".9" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    <path d="M 117.8 84.9 L 123.4 86.2" stroke="#fff" stroke-opacity=".9" stroke-width="1.3" stroke-linecap="round" fill="none"/></g>
    <g class="rc-lock">
    <path d="M 62.9 94.3 L 67.5 89.6 C 75.6 87.1 88.4 87.5 96.1 91.8 C 100.3 99.8 99.9 110.1 93.5 116 C 86.3 121.1 73.5 120.3 67.1 114.3 C 62.4 109.6 61.2 101.1 62.9 94.3 Z" fill="#040c4a" opacity=".55" transform="translate(1.7 1.7)"/>
    <path d="M 62.9 94.3 L 67.5 89.6 C 75.6 87.1 88.4 87.5 96.1 91.8 C 100.3 99.8 99.9 110.1 93.5 116 C 86.3 121.1 73.5 120.3 67.1 114.3 C 62.4 109.6 61.2 101.1 62.9 94.3 Z" fill="url(#rcPlate)" stroke="#47516a" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M 68.8 92.6 C 75.2 90.1 86.3 90.1 94 93.9" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.3" stroke-linecap="round"/>
    <circle cx="79" cy="99" r="3.2" fill="#0b1030"/>
    <path d="M 76.5 99.8 L 81.6 99.8 L 83.1 110.9 L 75 110.9 Z" fill="#0b1030"/></g>
    <g class="rc-lid">
    <g clip-path="url(#rcLidClip)">
    <path d="M 24.5 57.7 C 15.6 48.7 14.3 29.1 23.7 17.2 C 32.2 7.8 49.7 3.6 68.8 4 C 96.5 5.3 122.1 9.5 158.3 8.3 C 169.4 6.6 180.9 9.5 183 21.5 C 184.3 36 181.7 53 172.8 64.1 L 127.4 81.7 Z" fill="url(#rcSilverL)"/>
    <path d="M 15.6 65.8 L 15.6 14.7 L 31.8 14.7 C 30.1 29.6 30.9 44.5 36.4 61.5 Z" fill="#6f7a8a" opacity=".35"/>
    <path d="M 38.6 55.1 C 36 40.2 37.7 22.3 50.5 11.2 C 57.3 6.6 68.8 4.9 82.9 6.1 C 73.5 12.9 65.4 22.7 63.3 35.1 L 62 44.5 C 60.7 51.3 57.3 56 52.2 57.7 Z" fill="url(#rcLidB1)" stroke="#0a1a6a" stroke-width="1.3" stroke-linejoin="round"/>
    <path d="M 43.3 36 C 42.4 27.9 45.4 21.5 51.8 16.4" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.7" stroke-linecap="round"/>
    <path d="M 84.2 56.4 C 82.5 42.3 88 30 100.8 21.5 C 111.8 15.5 126.3 12.9 140 11.7 C 130.6 17.6 119.1 27.9 114.4 43.6 C 111.8 51.3 110.1 57.7 109.3 63.2 Z" fill="url(#rcLidB2)" stroke="#0a1a6a" stroke-width="1.3" stroke-linejoin="round"/>
    <path d="M 90.1 42.3 C 93.1 32.1 102.9 24 114.8 19.3" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.7" stroke-linecap="round"/>
    <path d="M 127.4 81.7 L 127.4 65.8 C 128 53 131 38.1 137.4 26.6 C 144.7 14.7 154.4 8.7 161.3 7.8 C 173.2 5.7 183 10.4 183 21.5 C 184.3 36 181.7 53 172.8 64.1 Z" fill="url(#rcCap)" stroke="#3e4757" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M 137.4 65.8 C 136.6 51.3 137.8 36.8 144.7 27 C 151 19.8 161.7 17.6 169.8 19.8 C 176.2 22.3 177.5 32.1 177 42.8 C 176.4 53 174.7 59.8 172.8 64.9 Z" fill="url(#rcDeep)" stroke="#272f42" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M 144.7 67 L 144.7 53.8 C 144.7 40.6 151 35.1 158.7 35.1 C 166.4 35.1 172.3 40.6 172.3 53.8 L 172.3 65.8 Z" fill="#7f8a99" stroke="#262e40" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M 147.6 66.2 L 147.6 54.3 C 147.6 43.6 152.3 38.5 158.7 38.5 C 165.1 38.5 169.8 43.6 169.8 54.3 L 169.8 65.3 Z" fill="#a9b3c0"/>
    <path d="M 149.3 65.3 L 149.3 54.7 C 149.3 45.7 153.2 41.5 158.7 41.5 C 164.2 41.5 168.1 45.7 168.1 54.7 L 168.1 64.9 Z" fill="#050a2c" stroke="#232b3e" stroke-width="0.9"/>
    <circle cx="158.7" cy="53.8" r="4.3" fill="#0b1030" stroke="#8a95a4" stroke-width="1.5"/>
    <path d="M 149.8 43.6 C 151.9 40.6 155.3 39.4 158.7 39.4" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.1" stroke-linecap="round"/>
    <path d="M 23.7 56.4 L 127.4 80.3 L 127.4 86.6 L 29.2 65.3 Z" fill="#98a3b1" stroke="#3e4757" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M 37.3 58.1 L 42.8 59.4" stroke="#fff" stroke-opacity=".95" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    <path d="M 46.1 60.3 L 51.6 61.6" stroke="#fff" stroke-opacity=".95" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    <path d="M 54.9 62.5 L 60.4 63.7" stroke="#fff" stroke-opacity=".95" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    <path d="M 63.7 64.6 L 69.2 65.9" stroke="#fff" stroke-opacity=".95" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    <path d="M 72.5 66.8 L 78.1 68.1" stroke="#fff" stroke-opacity=".95" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    <path d="M 81.3 69 L 86.9 70.3" stroke="#fff" stroke-opacity=".95" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    <path d="M 90.1 71.2 L 95.7 72.4" stroke="#fff" stroke-opacity=".95" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    <path d="M 98.9 73.3 L 104.5 74.6" stroke="#fff" stroke-opacity=".95" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    <path d="M 107.7 75.5 L 113.3 76.8" stroke="#fff" stroke-opacity=".95" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    <path d="M 116.5 77.7 L 122.1 79" stroke="#fff" stroke-opacity=".95" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    <path d="M 131.9 82 L 136.6 80.3" stroke="#fff" stroke-opacity=".8" stroke-width="1.1" stroke-linecap="round" fill="none"/>
    <path d="M 142.4 77.6 L 147.1 75.9" stroke="#fff" stroke-opacity=".8" stroke-width="1.1" stroke-linecap="round" fill="none"/>
    <path d="M 152.9 73.2 L 157.6 71.5" stroke="#fff" stroke-opacity=".8" stroke-width="1.1" stroke-linecap="round" fill="none"/>
    <path d="M 163.4 68.8 L 168.1 67" stroke="#fff" stroke-opacity=".8" stroke-width="1.1" stroke-linecap="round" fill="none"/></g>
    <path d="M 24.5 57.7 C 15.6 48.7 14.3 29.1 23.7 17.2 C 32.2 7.8 49.7 3.6 68.8 4 C 96.5 5.3 122.1 9.5 158.3 8.3 C 169.4 6.6 180.9 9.5 183 21.5 C 184.3 36 181.7 53 172.8 64.1 L 127.4 81.7 Z" fill="none" stroke="#3e4757" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M 26.2 25.3 C 29.2 15.9 43.3 8.7 66.7 7.4" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="2.1" stroke-linecap="round"/></g>
    <g class="rc-beam">
    <path d="M 36.9 65.8 L 164.7 65.8 L 209.4 -91.8 L -7.9 -91.8 Z" fill="url(#rcBeam)"/></g></svg>
  `;

  var STORE_KEY = 'puzzdra_ryuseki';   // 取得済みのダンジョン一覧（localStorage）
  var START_AREA = 10;                 // この番号のエリアから竜石がある
  var START_TURNS = 3;                 // 宝箱の「あと」
  var MISSION_COUNT = 2;               // ミッションの数
  var NEED_ALL = true;                 // true：2つとも達成で開く ／ false：どれか1つ達成で開く
  var ATTRS = ['fire', 'water', 'wood', 'light', 'dark'];     // 火〜闇
  var ATTR_IMG = { fire: '1.png', water: '2.png', wood: '3.png', light: '4.png', dark: '5.png' };
  var ATTR_JP = { fire: '火', water: '水', wood: '木', light: '光', dark: '闇' };

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ── 取得済みの記録 ──────────────────────────────────────
  var owned = new Set();
  try {
    JSON.parse(localStorage.getItem(STORE_KEY) || '[]').forEach(function (k) { owned.add(String(k)); });
  } catch (e) {}
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(Array.from(owned))); } catch (e) {}
  }
  function has(key) { return owned.has(String(key)); }
  function obtain(key) {
    if (!key || owned.has(String(key))) return false;
    owned.add(String(key));
    save();
    return true;
  }

  // 竜石があるダンジョンか（通常エリアの 10-1〜。イベント／日替わり／マルチ／経験値パークなどは対象外）
  function isEligible(key) {
    var m = /^(\d+)-(.+)$/.exec(String(key || ''));
    return !!m && Number(m[1]) >= START_AREA;
  }

  // ── バトル列に宝箱バトルを差し込む（ボスの1つ前） ───────
  function insertChest(key, battles) {
    if (!isEligible(key) || has(key) || !Array.isArray(battles) || !battles.length) return battles;
    var chest = {
      chest: true,
      enemies: [{ name: '宝箱', isChest: true, attr: 'dark', hp: 1, atk: 0, def: 0, size: 'M', turnInterval: 999, exp: 0, coin: 0, drops: [], actions: [] }]
    };
    var out = battles.slice();
    out.splice(out.length - 1, 0, chest);
    return out;
  }

  // ── ミッション ──────────────────────────────────────────
  //   type: 'vert5'（○属性をタテに5つ）／'simul6'（○属性を同時に6つ）／'combo'（Nコンボ以上）／'total'（合計Nコンボ）
  function makeMissions() {
    var types = ['vert5', 'simul6', 'combo', 'total'];
    var out = [];
    while (out.length < MISSION_COUNT && types.length) {
      var t = types.splice(Math.floor(Math.random() * types.length), 1)[0];
      var m = { type: t, done: false };
      if (t === 'vert5') m.attr = pick(ATTRS);
      else if (t === 'simul6') { m.attr = pick(ATTRS); m.n = 6; }
      else if (t === 'combo') m.n = rint(5, 8);
      else if (t === 'total') { m.n = rint(19, 23); m.sum = 0; }
      out.push(m);
    }
    return out;
  }
  function attrIcon(a) { return '<img class="rc-attr" src="' + ATTR_IMG[a] + '" alt="' + ATTR_JP[a] + '" draggable="false">'; }
  function missionHtml(m) {
    if (m.type === 'vert5') return attrIcon(m.attr) + 'を<b>タテに5つ</b>で並べろ';
    if (m.type === 'simul6') return attrIcon(m.attr) + 'を<b>同時に6つ繋げて</b>消せ';
    if (m.type === 'combo') return '<b>' + m.n + 'コンボ以上</b>しろ';
    return '<b>合計' + m.n + 'コンボ</b>しろ';
  }

  // ── 状態 ───────────────────────────────────────────────
  var st = null;   // { key, enemy, missions, turns, vert:{attr:true}, resolved }

  function active() { return !!(st && !st.resolved); }

  function area() { return document.getElementById('enemy-area'); }

  function render() {
    var el = area();
    if (!el || !st) return;
    el.innerHTML = '';
    el.classList.remove('has-xl');
    var wrap = document.createElement('div');
    wrap.className = 'rc-wrap';
    var cards = st.missions.map(function (m, i) {
      return '<div class="rc-mission ' + (i === 0 ? 'left' : 'right') + (m.done ? ' done' : '') + '" data-i="' + i + '">' +
        '<span class="rc-mtext">' + missionHtml(m) + '</span>' +
        (m.type === 'total' ? '<span class="rc-prog">' + Math.min(m.sum, m.n) + ' / ' + m.n + '</span>' : '') +
        '<span class="rc-check">✓</span></div>';
    }).join('');
    wrap.innerHTML =
      cards +
      '<div class="rc-center">' +
        '<div class="rc-chest">' + (CHEST_IMG ? '<img src="' + CHEST_IMG + '" alt="宝箱" draggable="false">' : CHEST_SVG) + '</div>' +
        '<div class="rc-tagunit"><div class="enemy-top-left"><div class="enemy-turn-pad"><span class="turn-label">あと</span><span class="enemy-turn-counter rc-counter"></span></div></div></div>' +
      '</div>';
    el.appendChild(wrap);
    st.wrap = wrap;
    setCounter();
  }

  function setCounter() {
    if (!st || !st.wrap) return;
    var c = st.wrap.querySelector('.rc-counter');
    if (!c) return;
    if (typeof setEnemyTurnCount === 'function') setEnemyTurnCount(c, st.turns);
    else c.textContent = st.turns;
    c.classList.toggle('red', st.turns === 1);
  }

  function refreshMissions() {
    if (!st || !st.wrap) return;
    st.missions.forEach(function (m, i) {
      var card = st.wrap.querySelector('.rc-mission[data-i="' + i + '"]');
      if (!card) return;
      var was = card.classList.contains('done');
      card.classList.toggle('done', !!m.done);
      var p = card.querySelector('.rc-prog');
      if (p) p.textContent = Math.min(m.sum, m.n) + ' / ' + m.n;
      if (m.done && !was) { card.classList.add('just'); setTimeout(function () { card.classList.remove('just'); }, 900); }
    });
  }

  // ── 宝箱バトルの開始 ────────────────────────────────────
  //   enemy … game.js が enemyList に入れた宝箱の敵データ（ダメージを受けない・行動しない）
  function load(enemy, key) {
    enemy._chest = true;
    enemy._dropChecked = true;
    enemy.hp = enemy.maxHp = 1e12;   // 倒せない（ミッション結果で自分で消える）
    st = { key: key, enemy: enemy, missions: makeMissions(), turns: START_TURNS, vert: {}, conn: {}, resolved: false, wrap: null };
    render();
    var c = st.wrap.querySelector('.rc-chest');
    if (c && c.animate) c.animate([{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: .6 }, { transform: 'scale(1)', opacity: 1 }], { duration: 520, easing: 'ease-out' });
  }

  // ── 1回の操作（消す→コンボ）の記録 ──────────────────────
  function beginMove() { if (st) { st.vert = {}; st.conn = {}; } }

  // 消えた塊のうち、1列まるごと（タテ5つ）がそろっていたら、その属性を記録
  function noteGroup(color, cells, rows) {
    if (!active() || !cells) return;
    st.conn[color] = Math.max(st.conn[color] || 0, cells.length);   // その属性の、いちばん大きくつながった塊の個数
    var perCol = {};
    cells.forEach(function (q) { perCol[q.c] = (perCol[q.c] || 0) + 1; });
    for (var c in perCol) if (perCol[c] >= (rows || 5)) { st.vert[color] = true; break; }
  }

  function judge(totalCombo, attrCounts) {
    st.missions.forEach(function (m) {
      if (m.type === 'total') { m.sum += totalCombo; if (m.sum >= m.n) m.done = true; return; }
      if (m.done) return;
      if (m.type === 'vert5') { if (st.vert[m.attr]) m.done = true; }
      else if (m.type === 'simul6') { if ((st.conn[m.attr] || 0) >= m.n) m.done = true; }   // 1つの塊で6個以上つなげて消す
      else if (m.type === 'combo') { if (totalCombo >= m.n) m.done = true; }
    });
  }
  function cleared() {
    return NEED_ALL ? st.missions.every(function (m) { return m.done; }) : st.missions.some(function (m) { return m.done; });
  }

  // 1回の操作が終わったとき（game.js の _evaluateInner から）。宝箱が開く／消えるなら演出を待ってから戻る
  async function endMove(totalCombo, attrCounts) {
    if (!active()) return;
    judge(totalCombo || 0, attrCounts || {});
    st.turns = Math.max(0, st.turns - 1);
    refreshMissions();
    setCounter();
    await sleep(450);
    if (cleared()) { await openChest(); return; }
    if (st.turns <= 0) { await vanishChest(); return; }
  }

  function finish() {
    st.resolved = true;
    st.enemy.hp = 0;           // 宝箱バトル終了 → game.js が次のフロア（ボス）へ進める
    st.enemy._fled = true;     // 経験値・エナ・ドロップなし
  }

  // 光のつぶ（開いた瞬間に飛び散る）
  function burst(center) {
    for (var i = 0; i < 14; i++) {
      var a = (-90 + (Math.random() - .5) * 150) * Math.PI / 180, d = 16 + Math.random() * 22;
      var sp = document.createElement('i');
      sp.className = 'rc-spark';
      sp.style.setProperty('--dx', (Math.cos(a) * d).toFixed(1) + 'cqw');
      sp.style.setProperty('--dy', (Math.sin(a) * d).toFixed(1) + 'cqw');
      sp.style.animationDelay = (Math.random() * .25).toFixed(2) + 's';
      center.appendChild(sp);
    }
  }

  // 成功：ミッションクリア → 宝箱がガタガタ → かぎが外れてふたが開く → 光があふれて竜石が飛び出す
  async function openChest() {
    var key = st.key;
    obtain(key);
    var wrap = st.wrap, center = wrap.querySelector('.rc-center');
    try { playSE('dropc'); } catch (e) {}
    wrap.classList.add('shaking');
    await sleep(600);
    wrap.classList.remove('shaking');
    wrap.classList.add('opening');
    burst(center);
    var gem = document.createElement('img');
    gem.className = 'rc-gem'; gem.src = IMG; gem.alt = '竜石'; gem.draggable = false;
    center.appendChild(gem);
    await sleep(900);
    var t = document.createElement('div');
    t.className = 'rc-get-text';
    t.textContent = '竜石ゲット！';
    center.appendChild(t);
    try { playSE('levelup'); } catch (e) {}
    await sleep(1700);
    wrap.classList.add('leaving');
    await sleep(350);
    finish();
    if (area()) area().innerHTML = '';
  }

  // 失敗：宝箱が消滅
  async function vanishChest() {
    try { playSE('kieru'); } catch (e) {}
    var wrap = st.wrap;
    wrap.classList.add('failing');
    var t = document.createElement('div');
    t.className = 'rc-fail';
    t.textContent = '宝箱が消えてしまった…';
    wrap.appendChild(t);
    await sleep(1400);
    finish();
    if (area()) area().innerHTML = '';
  }

  // 宝箱バトルを抜けた（ホームへ戻る・次のダンジョンへ）ときの後始末
  function reset() { st = null; }

  // ── ステージ選択の竜石アイコン（▶の左） ──────────────────
  function iconHtml(key) {
    if (!isEligible(key)) return '';
    return '<img class="ss-ryu' + (has(key) ? '' : ' gray') + '" src="' + IMG + '" alt="竜石" draggable="false">';
  }


  // ── 所持数（ボーナス画面で表示）──────────────────────────
  //   count() … 取得済みの竜石の数 ／ total() … 手に入る竜石の総数（dungeons.js の 10-1〜 の全ステージ）
  //   list()  … [{ key:'10-1', got:true }, …]（エリア・ステージ順）
  function list() {
    var keys = [];
    try { keys = Object.keys(DUNGEON_DATA).filter(isEligible); } catch (e) {}
    owned.forEach(function (k) { if (keys.indexOf(k) < 0 && isEligible(k)) keys.push(k); });   // データから消えたステージの分も数える
    var ord = function (k) { var m = /^(\d+)-(.+)$/.exec(k), st = m[2]; return [Number(m[1]), /^\d+$/.test(st) ? Number(st) : (st === 'boss' ? 1e9 : 1e6)]; };
    keys.sort(function (a, b) { var x = ord(a), y = ord(b); return x[0] - y[0] || x[1] - y[1]; });
    return keys.map(function (k) { return { key: k, got: owned.has(k) }; });
  }
  function count() { return list().filter(function (r) { return r.got; }).length; }
  function total() { return list().length; }

  window.Ryuseki = {
    count: count, total: total, list: list, imgSrc: IMG,
    isEligible: isEligible, has: has, insertChest: insertChest,
    load: load, active: active, reset: reset,
    beginMove: beginMove, noteGroup: noteGroup, endMove: endMove,
    iconHtml: iconHtml
  };
})();
