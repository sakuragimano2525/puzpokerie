// ============================================================
// ★ エリア設定（新しいエリアを足すときは、ここに1ブロック足すだけ） ★
//
//   キー = エリア番号
//     name : エリア名（ホームのマップ・ステージ選択に表示）
//     bg   : エリア背景画像（マップの帯・ステージ選択・出撃確認の上部）。省略すると dungeon{番号}.png
//     hue  : 背景画像がないときのグラデーション色相（0〜360）
//     hidden: true にすると「隠しエリア」。前のエリアのボスをクリアするまで、マップに一切表示されない（未開放の鍵マークも出ない）
//     color: エリアの大きな数字(1,2,3…)の色（省略可）。'赤' '青' '緑' '黄' '紫' '白' '黒'
//            （red blue green yellow purple white black や '#ff8800' などでもOK）
//
//   ◆ステージは js/data/dungeons.js のキーから自動で並びます（このファイルに書く必要なし）
//       "2-1" "2-2" "2-3" … 数字の順 / "2-boss" … 必ず最後（ボス）
//   ◆前のエリアの「-boss」をクリアすると、次のエリアが開放されます（進行はブラウザに保存）
//
//   ★新エリア追加の手順
//     1) このファイルに  3: { name:'炎の山道', bg:'dungeon3.png', hue:18 }  を足す
//     2) ダンジョン設定ツールで 3-1 〜 3-4 と 3-boss を作り、dungeons.js を差し替える
//     3) 背景画像 dungeon3.png をゲームのフォルダに置く
// ============================================================
const AREA_DATA = {
  1: { name: 'ハジマリ草原', bg: 'dungeon1.png', hue: 120, color: '白' },
  2: { name: 'コダマの森',   bg: 'dungeon2.png', hue: 150, color: '緑' },
  3: { name: 'ミズチビーチ', bg: 'dungeon3.png', hue: 50,  color: '青' },
  4: { name: 'メラメラ山道', bg: 'dungeon4.png', hue: 50,  color: '赤' },
  5: { name: '腐敗した森',   bg: 'dungeon5.png', hue: 150, color: '紫' },
  6: { name: 'ステラ砂漠',   bg: 'dungeon6.png', hue: 150, color: '黄' },
  7: { name: '竜の塔',       bg: 'dungeon7.png', hue: 150, color: '黒' },
  8: { name: 'ノノア遺跡',       bg: 'dungeon8.png', hue: 150, color: '赤' },
  9: { name: 'ユキノ海底洞窟',       bg: 'dungeon9.png', hue: 150, color: '青' },
  10: { name: 'レティア樹海',       bg: 'dungeon10.png', hue: 150, color: '緑' },
  11: { name: '無人発電所',       bg: 'dungeon11.png', hue: 150, color: '黄' },
  12: { name: '夜和洞窟',       bg: 'dungeon12.png', hue: 150, color: '紫' },
  13: { name: 'モモエ火山',       bg: 'dungeon13.png', hue: 150, color: '赤' },
  14: { name: 'ポケモンタワー',       bg: 'dungeon7.png', hue: 150, color: '白' },
  15: { name: 'ハナダの洞窟',       bg: 'dungeon15-1.png', hue: 150, color: '黒', hidden: true },   // 隠しエリア：前のエリア(14)のボスをクリアするまで、マップに存在すら出ない
};

// ============================================================
// ★ イベントステージ設定（新しいイベントを足すときは、ここに1ブロック足すだけ） ★
//
//   ホーム右上のボタンで「イベントステージ一覧」に切り替わります。
//   EVENT_UNLOCK_AREA のエリアのボスをクリアすると、ボタンが使えるようになります。
//
//   キー = イベントID（半角英数字。「-」は使わない）。メインのエリア番号の代わりに使います。
//     name       : イベント名（一覧とステージ選択に表示）
//     desc       : 一覧に出る短い説明（省略可）
//     bg         : ステージ選択・出撃準備の背景画像（省略するとステージの bgImg か dungeon1.png）
//     hue        : 背景画像がないときのグラデーション色相（0〜360）
//     stageNames : ステージ名を変えたいとき（省略可）  例 { 1:'はじめの広場', boss:'主の間' }
//     stageLevels: ステージ名の下に小さく出す文字（省略可）  例 { 1:'初級', 2:'中級', boss:'超級' }
//     entryItem  : 入るときに消費するアイテム（ITEM_DATA のキー。省略すると何も消費しない）  例 'ohuda1'
//     entryCost  : entryItem を何個消費するか（省略すると 1）
//     hidden     : true にすると、イベント一覧には出さない（日替わりダンジョン用。下の DAILY_DUNGEON から開く）
//     weekday    : 日替わりダンジョン用。この曜日（0=日 1=月 … 6=土）のダンジョンとして扱う
//
//   ◆ステージは js/data/dungeons.js のキー「イベントID-番号」から自動で並びます（メインと同じ）
//       "keiken-1" "keiken-2" … 数字の順 / "keiken-boss" … 必ず最後
//   ◆前のステージをクリアすると次のステージが開放されます。イベントは何度でも遊べて、次のエリアは開放されません。
//
//   ★新イベント追加の手順
//     1) このファイルに  event2: { name:'おカネパーク', desc:'エナがたくさん！', hue:45 }  を足す
//     2) ダンジョン設定ツールで  event2-1 〜 event2-3 などを作り、dungeons.js を差し替える
//     3) （任意）背景画像を bg に指定してゲームのフォルダに置く
// ============================================================
const EVENT_UNLOCK_AREA = 6;   // このエリアのボスをクリアするとイベントステージが開放される
const EVENT_AREA_DATA = {
  keiken: { name: 'けいけんパーク', desc: 'モンスターを育てよう！', bg: 'dungeon1.png', hue: 200, entryItem: 'ohuda1', entryCost: 1 },

  // ── 日替わりダンジョン（月〜日の7つ。今日の曜日のものだけが、イベント一覧の「日替わりダンジョン」から遊べる） ──
  //   ダンジョンのキーは「イベントID-番号」。  例  daily_mon-1（月曜のステージ1） / daily_mon-boss
  //   bg = その曜日のバナー画像（ゲームのフォルダ直下に置く。無いときは hue の色のグラデーション）
  //   ステージを増やしたいときは、ダンジョン設定ツールで daily_mon-2 などを作るだけ（番号の順に並びます）
  daily_mon: { name: '月曜ダンジョン',   desc: '月曜日のダンジョン', bg: 'dungeon5.png', hue: 265, hidden: true, weekday: 1, entryItem: 'youbi', entryCost: 1, stageNames: { 1: '月の森-1',2: '月の森-2' } , stageLevels: { 1: '中級', 2: '上級' }},
  daily_tue: { name: '火曜ダンジョン',   desc: '火曜日のダンジョン', bg: 'dungeon13.png', hue: 8,   hidden: true, weekday: 2, entryItem: 'youbi', entryCost: 1, stageNames: { 1: '火の火山-1',2: '火の火山-2' } , stageLevels: { 1: '中級', 2: '上級' }},
  daily_wed: { name: '水曜ダンジョン',   desc: '水曜日のダンジョン', bg: 'dungeon9.png', hue: 210, hidden: true, weekday: 3, entryItem: 'youbi', entryCost: 1, stageNames: { 1: '水の洞窟-1',2: '水の洞窟-2' } , stageLevels: { 1: '中級', 2: '上級' }},
  daily_thu: { name: '木曜ダンジョン',     desc: '木曜日のダンジョン', bg: 'daily_thu.png', hue: 130, hidden: true, weekday: 4, entryItem: 'youbi', entryCost: 1, stageNames: { 1: '木の密林-1',2: '木の密林-2' } , stageLevels: { 1: '中級', 2: '上級' }},
  daily_fri: { name: '金曜ダンジョン',   desc: '金曜日のダンジョン', bg: 'daily_fri.png', hue: 45,  hidden: true, weekday: 5, entryItem: 'youbi', entryCost: 1, stageNames: { 1: '金の砂漠-1',2: '金の砂漠-2' } , stageLevels: { 1: '中級', 2: '上級' }},
  daily_sat: { name: 'エナスポットの森',   desc: '土曜日のダンジョン', bg: 'daily_sat.png', hue: 25,  hidden: true, weekday: 6, entryItem: 'youbi', entryCost: 1, stageNames: { 1: 'エナがいっぱい！', 2: 'エナがいっぱい！' }, stageLevels: { 1: '初級', 2: '中級' } },
  daily_sun: { name: 'エナスポットの森',     desc: '日曜日のダンジョン', bg: 'daily_sat.png', hue: 52,  hidden: true, weekday: 0, entryItem: 'youbi', entryCost: 1, stageNames: { 1: 'エナがいっぱい！', 2: 'エナがいっぱい！' }, stageLevels: { 1: '中級', 2: '上級' } },
};

// ============================================================
// ★ 日替わりダンジョン ★
//   イベント一覧の一番上に「日替わりダンジョン」が出て、今日の曜日のダンジョンだけに挑戦できる。
//   ・バナー画像・ダンジョンの中身は、曜日ごとに変わる（日付が変わる 0:00 で切り替わる）
//   ・挑戦するたびに、item（ようびのおふだ）を cost 枚つかう（足りないと入れない）
//   ・今いくつ持っているかは、日替わりダンジョンのカードに表示される
//
//   days: 曜日（0=日 1=月 2=火 3=水 4=木 5=金 6=土）→ 上の EVENT_AREA_DATA のイベントID
//   ★ ダンジョンの中身は、ダンジョン設定ツールで「daily_mon-1」のように作って dungeons.js を差し替える
//   ★ 動作テスト: URL の末尾に ?dow=3 を付けて開くと、水曜日として動く（0〜6）。外すと今日の曜日に戻る
// ============================================================
const DAILY_DUNGEON = {
  name: '日替わりダンジョン',
  item: 'youbi',     // 挑戦に使うアイテム（ようびのおふだ）。各曜日の entryItem が優先される
  cost: 1,
  days: { 0: 'daily_sun', 1: 'daily_mon', 2: 'daily_tue', 3: 'daily_wed', 4: 'daily_thu', 5: 'daily_fri', 6: 'daily_sat' }
};
