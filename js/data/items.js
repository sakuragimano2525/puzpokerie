// ============================================================
// ★ アイテムデータ（進化素材など） ★
//   キー = アイテムID（画像ファイル名と同じ）。img は index.html からの相対パス。
//   画像は items/ フォルダに置く。
//   attr = チップの属性（X=1火 2水 3木 4光 5闇）。敵のドロップ設定との整合チェックに使う。
// ============================================================
const ITEM_DATA = {

  // puzzleX（X=1〜5: 火・水・木・光・闇）
  puzzle1: { id: 'puzzle1', name: '火のチップ', attr: 'fire', img: 'items/puzzle1.png' },
  puzzle2: { id: 'puzzle2', name: '水のチップ', attr: 'water', img: 'items/puzzle2.png' },
  puzzle3: { id: 'puzzle3', name: '木のチップ', attr: 'wood', img: 'items/puzzle3.png' },
  puzzle4: { id: 'puzzle4', name: '光のチップ', attr: 'light', img: 'items/puzzle4.png' },
  puzzle5: { id: 'puzzle5', name: '闇のチップ', attr: 'dark', img: 'items/puzzle5.png' },

  // puzzleXY  Y=2（X=1〜5）
  puzzle12: { id: 'puzzle12', name: '火炎のチップ', attr: 'fire', img: 'items/puzzle12.png' },
  puzzle22: { id: 'puzzle22', name: '水流のチップ', attr: 'water', img: 'items/puzzle22.png' },
  puzzle32: { id: 'puzzle32', name: '木霊のチップ', attr: 'wood', img: 'items/puzzle32.png' },
  puzzle42: { id: 'puzzle42', name: '閃光のチップ', attr: 'light', img: 'items/puzzle42.png' },
  puzzle52: { id: 'puzzle52', name: '暗闇のチップ', attr: 'dark', img: 'items/puzzle52.png' },

  // puzzleXY  Y=3（X=1〜5）
  puzzle13: { id: 'puzzle13', name: '業火のチップ', attr: 'fire', img: 'items/puzzle13.png' },
  puzzle23: { id: 'puzzle23', name: '大滝のチップ', attr: 'water', img: 'items/puzzle23.png' },
  puzzle33: { id: 'puzzle33', name: '新緑のチップ', attr: 'wood', img: 'items/puzzle33.png' },
  puzzle43: { id: 'puzzle43', name: '日光のチップ', attr: 'light', img: 'items/puzzle43.png' },
  puzzle53: { id: 'puzzle53', name: '闇夜のチップ', attr: 'dark', img: 'items/puzzle53.png' },

  // puzzleXY  Y=4（X=1〜5）
  puzzle14: { id: 'puzzle14', name: '煉獄のチップ', attr: 'fire', img: 'items/puzzle14.png' },
  puzzle24: { id: 'puzzle24', name: '海のチップ', attr: 'water', img: 'items/puzzle24.png' },
  puzzle34: { id: 'puzzle34', name: '樹海のチップ', attr: 'wood', img: 'items/puzzle34.png' },
  puzzle44: { id: 'puzzle44', name: '月光のチップ', attr: 'light', img: 'items/puzzle44.png' },
  puzzle54: { id: 'puzzle54', name: '常闇のチップ', attr: 'dark', img: 'items/puzzle54.png' },

  // puzzleXY  Y=5（X=1〜5）
  puzzle15: { id: 'puzzle15', name: '火山のチップ', attr: 'fire', img: 'items/puzzle15.png' },
  puzzle25: { id: 'puzzle25', name: '大海のチップ', attr: 'water', img: 'items/puzzle25.png' },
  puzzle35: { id: 'puzzle35', name: '木霊のチップ', attr: 'wood', img: 'items/puzzle35.png' },
  puzzle45: { id: 'puzzle45', name: '極光のチップ', attr: 'light', img: 'items/puzzle45.png' },
  puzzle55: { id: 'puzzle55', name: '死神のチップ', attr: 'dark', img: 'items/puzzle55.png' },

  // spuzzle_X（赤・青・緑・黄・紫）
  spuzzle_1: { id: 'spuzzle_1', name: '赤のチップ', attr: 'fire', img: 'items/spuzzle_1.png' },
  spuzzle_2: { id: 'spuzzle_2', name: '青のチップ', attr: 'water', img: 'items/spuzzle_2.png' },
  spuzzle_3: { id: 'spuzzle_3', name: '緑のチップ', attr: 'wood', img: 'items/spuzzle_3.png' },
  spuzzle_4: { id: 'spuzzle_4', name: '黄のチップ', attr: 'light', img: 'items/spuzzle_4.png' },
  spuzzle_5: { id: 'spuzzle_5', name: '紫のチップ', attr: 'dark', img: 'items/spuzzle_5.png' },

  // spuzzle_X2（ルビー・サファイア・エメラルド・トパーズ・アメジスト）
  spuzzle_12: { id: 'spuzzle_12', name: 'ルビーのチップ', attr: 'fire', img: 'items/spuzzle_12.png' },
  spuzzle_22: { id: 'spuzzle_22', name: 'サファイアのチップ', attr: 'water', img: 'items/spuzzle_22.png' },
  spuzzle_32: { id: 'spuzzle_32', name: 'エメラルドのチップ', attr: 'wood', img: 'items/spuzzle_32.png' },
  spuzzle_42: { id: 'spuzzle_42', name: 'トパーズのチップ', attr: 'light', img: 'items/spuzzle_42.png' },
  spuzzle_52: { id: 'spuzzle_52', name: 'アメジストのチップ', attr: 'dark', img: 'items/spuzzle_52.png' },

  // spuzzle_X3（紅・葵・翡翠・金色・茈）
  spuzzle_13: { id: 'spuzzle_13', name: '紅のチップ', attr: 'fire', img: 'items/spuzzle_13.png' },
  spuzzle_23: { id: 'spuzzle_23', name: '葵のチップ', attr: 'water', img: 'items/spuzzle_23.png' },
  spuzzle_33: { id: 'spuzzle_33', name: '翡翠のチップ', attr: 'wood', img: 'items/spuzzle_33.png' },
  spuzzle_43: { id: 'spuzzle_43', name: '金色のチップ', attr: 'light', img: 'items/spuzzle_43.png' },
  spuzzle_53: { id: 'spuzzle_53', name: '茈のチップ', attr: 'dark', img: 'items/spuzzle_53.png' },

  // ── おふだ（イベントダンジョンに入るときに消費するチケット。画像はゲームのフォルダ直下に置く） ──
  //   youbi  : ようびのおふだ    … 日替わりダンジョンに挑戦するとき 1枚使う。ログインボーナス（24時間ごと）で1枚もらえる
  //   ohuda1 : けいけんちのおふだ … けいけんパークに入るとき 1枚使う
  //   ※ どのイベントでどのおふだを何枚使うかは areas.js（EVENT_AREA_DATA の entryItem / entryCost）で決める
  //   ※ モンスターからのドロップは、ダンジョン設定ツールの「おふだドロップ」（敵データの ofudaDrop）で設定
  youbi:  { id: 'youbi',  name: 'ようびのおふだ',     img: 'youbi.png',  kind: 'ofuda', desc: '日替わりダンジョンに挑戦するときに1枚つかう' },
  ohuda1: { id: 'ohuda1', name: 'けいけんちのおふだ', img: 'ohuda1.png', kind: 'ofuda', desc: 'けいけんパークに入るときに1枚つかう' }
};

// ゲーム開始時の所持数（いまは何も持たずに開始。持たせたいときは { puzzle1: 5 } のように書く）
//   ※ すでにセーブがある場合も、セーブに書かれていないアイテムはここの数で始まる
const INITIAL_ITEMS = {};   // はじめは何も持っていない（以前の「火のチップ・赤のチップ・けいけんちのおふだ」の初期所持は削除）

// ============================================================
// ★ ログインボーナス ★
//   前回もらってから intervalHours 時間（24時間）たったあとにゲームを開くと、item を count 個もらえる。
//   （ちょうど24時間ごと。0時で切り替わる方式ではありません）
//   ※ 日数がたまってもまとめては貰えません（1回につき count 個）
// ============================================================
const LOGIN_BONUS = {
  item: 'youbi',        // ITEM_DATA のキー（ようびのおふだ = youbi.png）
  count: 1,
  intervalHours: 24,
  comboNeed: 8,    // 1周期（上のログインボーナスと同じリセット）に1回、このコンボ数以上で…
  comboCount: 1    // …ホームに戻ったとき、おふだがこの枚数もらえる
};
