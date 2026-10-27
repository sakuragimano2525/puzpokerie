// ============================================================
// ★ モンスターデータ ★
//   モンスターエディターで生成しました。
//   maxLevel を書くとそのモンスターの最大Lvになります（省略時はレアリティ別: ★1=25 / ★2=50 / ★3=75 / ★4以上=99）。
//   画像は m{id}.png が自動で使われる（img を書いた古いデータはそのまま有効）。
// ============================================================
const MONSTER_DATA = {
  1: {
    id: 1,
    name: 'フシギダネ',
    rarity: 3,
    attr: 'wood',
    type: 'かいふく',
    maxLevel: 25,
    baseExp: 100,
    stats: { hp: { min: 151, max: 852 }, atk: { min: 102, max: 300 }, rec: { min: 29, max: 58 } },
    skill: {
      name: 'このは',
      sp: 3,
      desc: '敵全体に1,000の固定ダメージ。\n最上段の横1列を木ドロップに変化。',
      effects: [ { type: 'damageAll', value: 1000 }, { type: 'orbChangeLine', dir: 'row', index: 0, count: 1, attr: 'wood' } ]
    },
    leaderSkill: { name: '木のソウル', desc: '木属性の攻撃1.2倍。', effects: [ { type: 'atk', attr: 'wood', value: 1.2 } ] },
    evolutions: [ { to: 2, materials: [ { item: 'puzzle32', count: 2 }, { item: 'spuzzle_3', count: 3 } ] } ]
  },
  2: {
    id: 2,
    name: 'フシギソウ',
    rarity: 4,
    attr: 'wood',
    type: 'かいふく',
    maxLevel: 75,
    baseExp: 100,
    stats: { hp: { min: 251, max: 752 }, atk: { min: 122, max: 280 }, rec: { min: 39, max: 88 } },
    skill: {
      name: 'このは',
      sp: 3,
      desc: '敵全体に1,000の固定ダメージ。\n最上段の横1列を木ドロップに変化。',
      effects: [ { type: 'damageAll', value: 1000 }, { type: 'orbChangeLine', dir: 'row', index: 0, count: 1, attr: 'wood' } ]
    },
    leaderSkill: { name: '木霊のソウル', desc: '木属性の攻撃1.5倍。', effects: [ { type: 'atk', attr: 'wood', value: 1.5 } ] },
    evolutions: [ { to: 3, materials: [ { item: 'puzzle33', count: 1 }, { item: 'spuzzle_32', count: 3 } ] } ]
  },
  3: {
    id: 3,
    name: 'フシギバナ',
    rarity: 4,
    attr: 'wood',
    type: 'かいふく',
    maxLevel: 99,
    baseExp: 1000,
    stats: { hp: { min: 440, max: 2950 }, atk: { min: 170, max: 1160 }, rec: { min: 175, max: 500 } },
    skill: {
      name: 'リーフストーム',
      sp: 6,
      desc: '敵全体に5,000の固定ダメージ。\n最上段横2列を木ドロップに変化。',
      effects: [
        { type: 'damageAll', value: 5000 },
        { type: 'orbChangeLine', dir: 'row', index: 0, count: 1, attr: 'wood' },
        { type: 'orbChangeLine', dir: 'row', index: 1, count: 1, attr: 'wood' }
      ]
    },
    leaderSkill: { name: '新緑のソウル', desc: '木属性の攻撃1.8倍。', effects: [ { type: 'atk', attr: 'wood', value: 1.8 } ] }
  },
  4: {
    id: 4,
    name: 'ヒトカゲ',
    rarity: 3,
    attr: 'fire',
    type: 'こうげき',
    baseExp: 100,
    stats: { hp: { min: 151, max: 852 }, atk: { min: 152, max: 380 }, rec: { min: 19, max: 38 } },
    skill: {
      name: 'ひのこ',
      sp: 3,
      desc: '敵全体に1,000の固定ダメージ。\n最上段の横1列を火ドロップに変化。',
      effects: [ { type: 'damageAll', value: 1000 }, { type: 'orbChangeLine', dir: 'row', index: 0, count: 1, attr: 'fire' } ]
    },
    leaderSkill: { name: '火のソウル', desc: '火属性の攻撃1.2倍。', effects: [ { type: 'atk', attr: 'fire', value: 1.2 } ] },
    evolutions: [ { to: 5, materials: [ { item: 'puzzle12', count: 2 }, { item: 'spuzzle_12', count: 2 } ] } ]
  },
  5: {
    id: 5,
    name: 'リザード',
    rarity: 4,
    attr: 'fire',
    type: 'こうげき',
    maxLevel: 75,
    baseExp: 100,
    stats: { hp: { min: 351, max: 852 }, atk: { min: 152, max: 380 }, rec: { min: 19, max: 38 } },
    skill: {
      name: 'ひのこ',
      sp: 3,
      desc: '敵全体に1,000の固定ダメージ。\n最上段の横1列を火ドロップに変化。',
      effects: [ { type: 'damageAll', value: 1000 }, { type: 'orbChangeLine', dir: 'row', index: 0, count: 1, attr: 'fire' } ]
    },
    leaderSkill: { name: '火炎のソウル', desc: '火属性の攻撃1.5倍。', effects: [ { type: 'atk', attr: 'fire', value: 1.5 } ] },
    evolutions: [ { to: 6, materials: [ { item: 'puzzle13', count: 1 }, { item: 'spuzzle_12', count: 3 } ] } ]
  },
  6: {
    id: 6,
    name: 'リザードン',
    rarity: 4,
    attr: 'fire',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 2500,
    stats: { hp: { min: 480, max: 3200 }, atk: { min: 300, max: 1990 }, rec: { min: 53, max: 150 } },
    skill: {
      name: 'かえんほうしゃ',
      sp: 6,
      desc: '敵全体に5,000の固定ダメージ。\n最上段横2列を火ドロップに変化。',
      effects: [
        { type: 'damageAll', value: 5000 },
        { type: 'orbChangeLine', dir: 'row', index: 0, count: 1, attr: 'fire' },
        { type: 'orbChangeLine', dir: 'row', index: 1, count: 1, attr: 'fire' }
      ]
    },
    leaderSkill: { name: '業火のソウル', desc: '火属性の攻撃1.8倍。', effects: [ { type: 'atk', attr: 'fire', value: 1.8 } ] }
  },
  7: {
    id: 7,
    name: 'ゼニガメ',
    rarity: 3,
    attr: 'water',
    type: 'バランス',
    baseExp: 100,
    stats: { hp: { min: 154, max: 876 }, atk: { min: 151, max: 365 }, rec: { min: 18, max: 75 } },
    skill: {
      name: 'みずてっぽう',
      sp: 3,
      desc: '敵全体に1,000の固定ダメージ。\n最上段の横1列を水ドロップに変化。',
      effects: [ { type: 'damageAll', value: 1000 }, { type: 'orbChangeLine', dir: 'row', index: 0, count: 1, attr: 'water' } ]
    },
    leaderSkill: { name: '水のソウル', desc: '水属性の攻撃1.2倍。', effects: [ { type: 'atk', attr: 'water', value: 1.2 } ] },
    evolutions: [ { to: 8, materials: [ { item: 'puzzle22', count: 2 }, { item: 'spuzzle_2', count: 3 } ] } ]
  },
  8: {
    id: 8,
    name: 'カメール',
    rarity: 4,
    attr: 'water',
    type: 'バランス',
    maxLevel: 75,
    baseExp: 100,
    stats: { hp: { min: 250, max: 750 }, atk: { min: 150, max: 300 }, rec: { min: 20, max: 40 } },
    skill: {
      name: 'みずてっぽう',
      sp: 3,
      desc: '敵全体に1,000の固定ダメージ。\n最上段の横1列を水ドロップに変化。',
      effects: [ { type: 'damageAll', value: 1000 }, { type: 'orbChangeLine', dir: 'row', index: 0, count: 1, attr: 'water' } ]
    },
    leaderSkill: { name: '水流のソウル', desc: '水属性の攻撃1.5倍。', effects: [ { type: 'atk', attr: 'water', value: 1.5 } ] },
    evolutions: [ { to: 9, materials: [ { item: 'puzzle23', count: 1 }, { item: 'spuzzle_22', count: 3 } ] } ]
  },
  9: {
    id: 9,
    name: 'カメックス',
    rarity: 4,
    attr: 'water',
    type: 'バランス',
    maxLevel: 99,
    baseExp: 1000,
    stats: { hp: { min: 470, max: 3130 }, atk: { min: 230, max: 1530 }, rec: { min: 68, max: 195 } },
    skill: {
      name: 'ハイドロポンプ',
      sp: 6,
      desc: '敵全体に5,000の固定ダメージ。\n最上段横2列を水ドロップに変化。',
      effects: [
        { type: 'damageAll', value: 5000 },
        { type: 'orbChangeLine', dir: 'row', index: 0, count: 1, attr: 'water' },
        { type: 'orbChangeLine', dir: 'row', index: 1, count: 1, attr: 'water' }
      ]
    },
    leaderSkill: { name: '大滝のソウル', desc: '水属性の攻撃1.8倍。', effects: [ { type: 'atk', attr: 'water', value: 1.8 } ] }
  },
  10: {
    id: 10,
    name: 'キャタピー',
    rarity: 1,
    attr: 'wood',
    type: 'かいふく',
    maxLevel: 1,
    baseExp: 100,
    stats: { hp: { min: 46, max: 271 }, atk: { min: 105, max: 207 }, rec: { min: 25, max: 109 } },
    skill: { name: 'いやしのひかり', sp: 2, desc: 'HPを最大HPの20%回復。', effects: [ { type: 'heal', value: 0.2 } ] },
    leaderSkill: { name: 'いやし', desc: 'ドロップを消すと最大HPの20%回復。', effects: [ { type: 'hpRecovery', value: 0.2 } ] },
    evolutions: [ { to: 11, materials: [ { item: 'puzzle3', count: 1 } ] } ]
  },
  11: {
    id: 11,
    name: 'トランセル',
    rarity: 2,
    attr: 'wood',
    type: 'たいりょく',
    baseExp: 100,
    stats: { hp: { min: 299, max: 599 }, atk: { min: 75, max: 100 }, rec: { min: 35, max: 5 } },
    skill: {
      name: 'かたくなる',
      sp: 3,
      desc: '1ターンの間、ダメージを25%軽減。',
      effects: [ { type: 'dmgReductionBuff', turns: 1, value: 0.25 } ]
    },
    leaderSkill: {
      name: 'たいりょくのオーラ・中',
      desc: 'たいりょくタイプのHP1.7倍。',
      effects: [ { type: 'hp', condition: 'type', attr: 'たいりょく', value: 1.7 } ]
    },
    evolutions: [ { to: 12, materials: [ { item: 'puzzle32', count: 2 }, { item: 'spuzzle_32', count: 3 } ] } ]
  },
  12: {
    id: 12,
    name: 'バタフリー',
    rarity: 3,
    attr: 'wood',
    type: 'かいふく',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 350, max: 2700 }, atk: { min: 190, max: 1100 }, rec: { min: 140, max: 400 } },
    skill: { name: 'ハートエンハンス', sp: 3, desc: '1ターンの間、回復力が1.5倍。', effects: [ { type: 'recMult', turns: 1, value: 1.5 } ] },
    leaderSkill: { name: '木のルーン・大', desc: '木属性の回復力2倍。', effects: [ { type: 'rec', attr: 'wood', value: 2 } ] }
  },
  13: {
    id: 13,
    name: 'ビードル',
    rarity: 1,
    attr: 'wood',
    type: 'こうげき',
    baseExp: 100,
    stats: { hp: { min: 50, max: 350 }, atk: { min: 130, max: 350 }, rec: { min: 0, max: 0 } },
    skill: {
      name: 'とつげき',
      sp: 1,
      desc: '敵単体に攻撃力×3倍の木属性攻撃。',
      effects: [ { type: 'damageSelfAtkMult', target: 'single', value: 3, attr: 'wood' } ]
    },
    leaderSkill: {
      name: 'フォースパワー',
      desc: 'ドロップをちょうど4個消す度に攻撃1.1倍。',
      effects: [ { type: 'atk', condition: 'exact4', value: 1.1, exponential: true } ]
    },
    evolutions: [ { to: 14, materials: [ { item: 'puzzle3', count: 3 } ] } ]
  },
  14: {
    id: 14,
    name: 'コクーン',
    rarity: 2,
    attr: 'wood',
    type: 'たいりょく',
    baseExp: 100,
    stats: { hp: { min: 599, max: 999 }, atk: { min: 5, max: 50 }, rec: { min: 0, max: 5 } },
    skill: {
      name: 'かたくなる',
      sp: 3,
      desc: '1ターンの間、ダメージを25%軽減。',
      effects: [ { type: 'dmgReductionBuff', turns: 1, value: 0.25 } ]
    },
    leaderSkill: {
      name: 'フォースシールド',
      desc: 'ドロップをちょうど4個消す度に攻撃1.1倍、受けるダメージ3%軽減。',
      effects: [ { type: 'atk', condition: 'exact4', value: 1.1, exponential: true, reduce: 0.03 } ]
    },
    evolutions: [ { to: 15, materials: [ { item: 'puzzle33', count: 1 }, { item: 'spuzzle_3', count: 2 } ] } ]
  },
  15: {
    id: 15,
    name: 'スピアー',
    rarity: 3,
    attr: 'wood',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 3000,
    stats: { hp: { min: 410, max: 2750 }, atk: { min: 290, max: 1900 }, rec: { min: 28, max: 80 } },
    skill: {
      name: 'ドロップリフレッシュ',
      sp: 3,
      desc: 'ドロップをリフレッシュする',
      effects: [
        { type: 'orbChangeRandom', attr: 'fire', count: 3 },
        { type: 'orbChangeRandom', attr: 'water', count: 3 },
        { type: 'orbChangeRandom', attr: 'wood', count: 3 },
        { type: 'orbChangeRandom', attr: 'light', count: 3 },
        { type: 'orbChangeRandom', attr: 'dark', count: 3 },
        { type: 'orbChangeRandom', attr: 'heal', count: 3 }
      ]
    },
    leaderSkill: {
      name: 'ジェットスピア',
      desc: '【操作時間3秒固定】ドロップをちょうど4個消す度に攻撃1.2倍、受けるダメージ4%軽減。',
      effects: [
        { type: 'atk', condition: 'exact4', value: 1.2, exponential: true, reduce: 0.04 },
        { type: 'moveTimeFixed', value: 3000 }
      ]
    }
  },
  16: {
    id: 16,
    name: 'ポッポ',
    img: 'm16.png',
    rarity: 1,
    attr: 'light',
    type: 'バランス',
    baseExp: 100,
    stats: { hp: { min: 90, max: 285 }, atk: { min: 100, max: 210 }, rec: { min: 10, max: 30 } },
    skill: {
      name: 'かぜおこし',
      sp: 2,
      desc: '敵全体に攻撃力×5倍の木属性攻撃。',
      effects: [ { type: 'damageSelfAtkMult', value: 5, attr: 'wood' } ]
    },
    leaderSkill: {
      name: 'げんきいっぱい',
      desc: 'HP満タン時、攻撃1.3倍。',
      effects: [ { type: 'atk', condition: 'hpAbove', threshold: 1, value: 1.3 } ]
    },
    evolutions: [ { to: 17, materials: [ { item: 'puzzle4', count: 4 } ] } ]
  },
  17: {
    id: 17,
    name: 'ピジョン',
    rarity: 2,
    attr: 'light',
    type: 'バランス',
    baseExp: 100,
    stats: { hp: { min: 250, max: 750 }, atk: { min: 150, max: 300 }, rec: { min: 20, max: 40 } },
    skill: {
      name: 'かまいたち',
      sp: 3,
      desc: '敵全体に攻撃力×7倍の木属性攻撃。',
      effects: [ { type: 'damageSelfAtkMult', value: 7, attr: 'wood' } ]
    },
    leaderSkill: {
      name: 'ヘルスパワー',
      desc: 'HP満タン時、攻撃1.7倍。',
      effects: [ { type: 'atk', condition: 'hpAbove', threshold: 1, value: 1.7 } ]
    },
    evolutions: [ { to: 18, materials: [ { item: 'puzzle42', count: 3 } ] } ]
  },
  18: {
    id: 18,
    name: 'ピジョット',
    rarity: 3,
    attr: 'light',
    type: 'バランス',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 490, max: 3250 }, atk: { min: 220, max: 1480 }, rec: { min: 46, max: 220 } },
    skill: {
      name: 'たつまき',
      sp: 3,
      desc: '敵全体に攻撃力×8倍の木属性攻撃。\n1ターンの間、敵全体に攻撃。',
      effects: [ { type: 'damageSelfAtkMult', value: 8, attr: 'wood' }, { type: 'allAttackBuff', turns: 1 } ]
    },
    leaderSkill: {
      name: 'スーパーヘルスパワー',
      desc: 'HP満タン時、攻撃2倍、受けるダメージ5%軽減。',
      effects: [ { type: 'atk', condition: 'hpAbove', threshold: 1, value: 2, reduce: 0.05 } ]
    }
  },
  19: {
    id: 19,
    name: 'コラッタ',
    rarity: 1,
    attr: 'light',
    type: 'バランス',
    baseExp: 100,
    stats: { hp: { min: 242, max: 320 }, atk: { min: 118, max: 149 }, rec: { min: 3, max: 50 } },
    skill: { name: 'エコーボイス', sp: 2, desc: '1ターンの間、敵全体に攻撃。', effects: [ { type: 'allAttackBuff', turns: 1 } ] },
    leaderSkill: {
      name: 'フォース・カインド',
      desc: '4コンボ以上で攻撃1.2倍。',
      effects: [ { type: 'atk', condition: 'combo', count: 4, value: 1.2 } ]
    },
    evolutions: [ { to: 20, materials: [ { item: 'puzzle4', count: 4 } ] } ]
  },
  20: {
    id: 20,
    name: 'ラッタ',
    rarity: 2,
    attr: 'light',
    type: 'バランス',
    maxLevel: 99,
    baseExp: 300,
    stats: { hp: { min: 530, max: 3500 }, atk: { min: 210, max: 1420 }, rec: { min: 77, max: 230 } },
    skill: { name: 'ひっさつまえば', sp: 3, desc: '左上に光を逆L字型に生成。', effects: [ { type: 'orbChangeReverseL', attr: 'light' } ] },
    leaderSkill: {
      name: 'シックスセンス',
      desc: '6コンボ以上で攻撃1.8倍。',
      effects: [ { type: 'atk', condition: 'combo', count: 6, value: 1.8 } ]
    }
  },
  21: {
    id: 21,
    name: 'オニスズメ',
    rarity: 1,
    attr: 'fire',
    type: 'こうげき',
    baseExp: 100,
    stats: { hp: { min: 80, max: 280 }, atk: { min: 110, max: 240 }, rec: { min: 5, max: 20 } },
    skill: {
      name: 'つつく',
      sp: 2,
      desc: '敵単体に攻撃力×7倍の火属性攻撃。',
      effects: [ { type: 'damageSelfAtkMult', value: 7, attr: 'fire', target: 'single' } ]
    },
    leaderSkill: { name: 'クロスクラップ', desc: '十字消しをすると攻撃1.3倍。', effects: [ { type: 'atk', condition: 'cross', value: 1.3 } ] },
    evolutions: [ { to: 22, materials: [ { item: 'spuzzle_12', count: 3 } ] } ]
  },
  22: {
    id: 22,
    name: 'オニドリル',
    rarity: 3,
    attr: 'fire',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 100,
    stats: { hp: { min: 440, max: 2930 }, atk: { min: 290, max: 1900 }, rec: { min: 31, max: 90 } },
    skill: {
      name: 'ねっぷう',
      sp: 4,
      desc: '敵全体に攻撃力×7倍の火属性攻撃。\n敵全体の行動を1ターン遅らせる。',
      effects: [
        { type: 'damageSelfAtkMult', target: 'all', value: 7, attr: 'fire' },
        { type: 'enemyDelay', target: 'all', turns: 1 }
      ]
    },
    leaderSkill: {
      name: 'クロスアセント',
      desc: '十字消しする度に攻撃1.3倍。',
      effects: [ { type: 'atk', condition: 'cross', value: 1.3, exponential: true } ]
    }
  },
  23: {
    id: 23,
    name: 'アーボ',
    rarity: 1,
    attr: 'dark',
    type: 'こうげき',
    baseExp: 100,
    stats: { hp: { min: 290, max: 406 }, atk: { min: 96, max: 233 }, rec: { min: 5, max: 15 } },
    skill: {
      name: 'どくどく',
      sp: 2,
      desc: '毒ドロップをランダムで3つ生成。',
      effects: [ { type: 'orbChangeRandom', attr: 'poison', count: 3, message: '☠️ 毒ドロップ生成！' } ]
    },
    leaderSkill: { name: 'どくくらい', desc: '毒ドロップを消すと攻撃1.5倍。', effects: [ { type: 'atk', condition: 'poison', value: 1.5 } ] },
    evolutions: [ { to: 24, materials: [ { item: 'puzzle5', count: 5 } ] } ]
  },
  24: {
    id: 24,
    name: 'アーボック',
    rarity: 3,
    attr: 'dark',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 100,
    stats: { hp: { min: 430, max: 2900 }, atk: { min: 290, max: 1960 }, rec: { min: 42, max: 90 } },
    skill: {
      name: 'どくどく+',
      sp: 2,
      desc: '毒ドロップをランダムで4つ生成。',
      effects: [ { type: 'orbChangeRandom', attr: 'poison', count: 4, message: '☠️ 毒ドロップ生成！' } ]
    },
    leaderSkill: {
      name: 'ポイズンチェイサー',
      desc: '毒をちょうど4個消すと攻撃2.1倍。',
      effects: [ { type: 'atk', condition: 'exactCount', attr: 'poison', count: 4, value: 2.1 } ]
    }
  },
  25: {
    id: 25,
    name: 'ピカチュウ',
    rarity: 3,
    attr: 'light',
    type: 'バランス',
    baseExp: 100,
    stats: { hp: { min: 198, max: 320 }, atk: { min: 231, max: 331 }, rec: { min: 32, max: 32 } },
    skill: {
      name: 'ドロップチェンジ・光',
      sp: 3,
      desc: '闇ドロップを光ドロップに変化。',
      effects: [ { type: 'orbConvert', from: 'dark', to: 'light' } ]
    },
    leaderSkill: {
      name: 'ぴかぴか',
      desc: '光を5個以上つなげて消すと攻撃1.5倍。',
      effects: [ { type: 'atk', condition: 'orbConnect', attr: 'light', count: 5, value: 1.5 } ]
    },
    evolutions: [ { to: 26, materials: [ { item: 'puzzle42', count: 2 }, { item: 'spuzzle_42', count: 2 } ] } ]
  },
  26: {
    id: 26,
    name: 'ライチュウ',
    img: 'm26.png',
    rarity: 4,
    attr: 'light',
    type: 'バランス',
    maxLevel: 99,
    baseExp: 100,
    stats: { hp: { min: 520, max: 3450 }, atk: { min: 250, max: 1650 }, rec: { min: 88, max: 250 } },
    skill: {
      name: 'ドロップチェンジ・光',
      sp: 3,
      desc: '闇ドロップを光ドロップに変化。',
      effects: [ { type: 'orbConvert', from: 'dark', to: 'light' } ]
    },
    leaderSkill: {
      name: 'ライトニング',
      desc: '光を6個以上つなげて消すと攻撃2倍。',
      effects: [ { type: 'atk', condition: 'orbConnect', attr: 'light', count: 6, value: 2 } ]
    }
  },
  27: {
    id: 27,
    name: 'サンド',
    rarity: 1,
    attr: 'light',
    type: 'たいりょく',
    baseExp: 100,
    stats: { hp: { min: 178, max: 881 }, atk: { min: 146, max: 309 }, rec: { min: 8, max: 30 } },
    skill: {
      name: 'チェンジハート・光',
      sp: 3,
      desc: '闇ドロップを回復ドロップに変化。',
      effects: [ { type: 'orbConvert', from: 'dark', to: 'heal' } ]
    },
    leaderSkill: { name: '光のオーラ', desc: '光属性のHP1.2倍。', effects: [ { type: 'hp', attr: 'light', value: 1.2 } ] },
    evolutions: [ { to: 28, materials: [ { item: 'puzzle42', count: 2 }, { item: 'puzzle4', count: 2 } ] } ]
  },
  28: {
    id: 28,
    name: 'サンドパン',
    rarity: 3,
    attr: 'light',
    type: 'バランス',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 590, max: 3900 }, atk: { min: 220, max: 1480 }, rec: { min: 81, max: 230 } },
    skill: {
      name: 'ダブルチェンジハート・光',
      sp: 5,
      desc: '闇と毒ドロップを回復ドロップに変化。',
      effects: [ { type: 'orbConvert', from: 'dark', to: 'heal' }, { type: 'orbConvert', from: 'poison', to: 'heal' } ]
    },
    leaderSkill: { name: '光のオーラ・中', desc: '光属性のHP1.5倍。', effects: [ { type: 'hp', attr: 'light', value: 1.5 } ] }
  },
  29: {
    id: 29,
    name: 'ニドラン♀',
    rarity: 1,
    attr: 'dark',
    type: 'たいりょく',
    maxLevel: 99,
    baseExp: 300,
    stats: { hp: { min: 470, max: 1120 }, atk: { min: 140, max: 500 }, rec: { min: 18, max: 50 } },
    skill: {
      name: 'スリードロップ・水闇改',
      sp: 6,
      desc: '水と闇ドロップをランダムで6つずつ生成。',
      effects: [ { type: 'orbChangeRandom', attr: 'water', count: 6 }, { type: 'orbChangeRandom', attr: 'dark', count: 6 } ]
    },
    leaderSkill: {
      name: 'ダークフォース',
      desc: '闇をちょうど4個消すと攻撃1.3倍。',
      effects: [ { type: 'atk', condition: 'exactCount', attr: 'dark', count: 4, value: 1.3 } ]
    },
    evolutions: [ { to: 30, materials: [ { item: 'puzzle5', count: 3 } ] } ]
  },
  30: {
    id: 30,
    name: 'ニドリーナ',
    rarity: 2,
    attr: 'dark',
    type: 'たいりょく',
    maxLevel: 99,
    baseExp: 300,
    stats: { hp: { min: 570, max: 2790 }, atk: { min: 150, max: 1000 }, rec: { min: 25, max: 70 } },
    skill: {
      name: 'スリードロップ・水闇改',
      sp: 6,
      desc: '水と闇ドロップをランダムで6つずつ生成。',
      effects: [ { type: 'orbChangeRandom', attr: 'water', count: 6 }, { type: 'orbChangeRandom', attr: 'dark', count: 6 } ]
    },
    leaderSkill: {
      name: 'ダークフォース',
      desc: '闇をちょうど4個消すと攻撃1.3倍。',
      effects: [ { type: 'atk', condition: 'exactCount', attr: 'dark', count: 4, value: 1.3 } ]
    },
    evolutions: [ { to: 31, materials: [ { item: 'puzzle53', count: 1 }, { item: 'puzzle2', count: 2 } ] } ]
  },
  31: {
    id: 31,
    name: 'ニドクイン',
    rarity: 3,
    attr: 'dark',
    type: 'たいりょく',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 690, max: 4630 }, atk: { min: 200, max: 1400 }, rec: { min: 37, max: 105 } },
    skill: {
      name: 'スリードロップ・水闇改',
      sp: 6,
      desc: '水と闇ドロップをランダムで6つずつ生成。',
      effects: [ { type: 'orbChangeRandom', attr: 'water', count: 6 }, { type: 'orbChangeRandom', attr: 'dark', count: 6 } ]
    },
    leaderSkill: {
      name: 'ダブルシールド・水闇',
      desc: '水と闇ドロップを同時に4個以上つなげて消すと受けるダメージ30%軽減。',
      effects: [ { type: 'atk', condition: 'orbConnect', attr: 'water', count: 4, value: 1, attr2: 'dark', reduce: 0.3 } ]
    }
  },
  32: {
    id: 32,
    name: 'ニドラン♂',
    rarity: 1,
    attr: 'dark',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 300,
    stats: { hp: { min: 270, max: 800 }, atk: { min: 200, max: 830 }, rec: { min: 11, max: 30 } },
    skill: {
      name: 'スリードロップ・水闇',
      sp: 3,
      desc: '水と闇ドロップをランダムで3つずつ生成。',
      effects: [ { type: 'orbChangeRandom', attr: 'water', count: 3 }, { type: 'orbChangeRandom', attr: 'dark', count: 3 } ]
    },
    leaderSkill: {
      name: 'ファイブステップ',
      desc: '5コンボ以上で攻撃1.3倍。',
      effects: [ { type: 'atk', condition: 'combo', count: 5, value: 1.3 } ]
    },
    evolutions: [ { to: 33, materials: [ { item: 'puzzle5', count: 3 } ] } ]
  },
  33: {
    id: 33,
    name: 'ニドリーノ',
    rarity: 2,
    attr: 'dark',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 300,
    stats: { hp: { min: 330, max: 1600 }, atk: { min: 240, max: 1600 }, rec: { min: 14, max: 40 } },
    skill: {
      name: 'スリードロップ・水闇',
      sp: 3,
      desc: '水と闇ドロップをランダムで3つずつ生成。',
      effects: [ { type: 'orbChangeRandom', attr: 'water', count: 3 }, { type: 'orbChangeRandom', attr: 'dark', count: 3 } ]
    },
    leaderSkill: {
      name: 'ファイブステップ',
      desc: '5コンボ以上で攻撃1.3倍。',
      effects: [ { type: 'atk', condition: 'combo', count: 5, value: 1.3 } ]
    },
    evolutions: [ { to: 34, materials: [ { item: 'puzzle53', count: 1 }, { item: 'spuzzle_5', count: 3 } ] } ]
  },
  34: {
    id: 34,
    name: 'ニドキング',
    rarity: 3,
    attr: 'dark',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 420, max: 2750 }, atk: { min: 320, max: 1900 }, rec: { min: 19, max: 80 } },
    skill: {
      name: 'スリードロップ・水闇',
      sp: 3,
      desc: '水と闇ドロップをランダムで3つずつ生成。',
      effects: [ { type: 'orbChangeRandom', attr: 'water', count: 3 }, { type: 'orbChangeRandom', attr: 'dark', count: 3 } ]
    },
    leaderSkill: {
      name: 'ダブルフォース・水闇',
      desc: '水と闇ドロップを同時に4個以上つなげて消すと攻撃2倍。',
      effects: [ { type: 'atk', condition: 'orbConnect', attr: 'water', count: 4, value: 2, attr2: 'dark' } ]
    }
  },
  35: {
    id: 35,
    name: 'ピッピ',
    rarity: 1,
    attr: 'dark',
    type: 'かいふく',
    baseExp: 100,
    stats: { hp: { min: 180, max: 400 }, atk: { min: 60, max: 240 }, rec: { min: 25, max: 100 } },
    skill: { name: 'キュアー', sp: 2, desc: 'バインドを2ターン回復。', effects: [ { type: 'bindRecover', turns: 2 } ] },
    leaderSkill: {
      name: 'かいふくのオーラ',
      desc: 'かいふくタイプのHP1.2倍。',
      effects: [ { type: 'hp', condition: 'type', attr: 'かいふく', value: 1.2 } ]
    },
    evolutions: [ { to: 36, materials: [ { item: 'spuzzle_52', count: 3 } ] } ]
  },
  36: {
    id: 36,
    name: 'ピクシー',
    rarity: 3,
    attr: 'dark',
    type: 'かいふく',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 480, max: 3200 }, atk: { min: 170, max: 1130 }, rec: { min: 245, max: 700 } },
    skill: { name: 'スーパーキュアー', sp: 3, desc: 'バインドを5ターン回復。', effects: [ { type: 'bindRecover', turns: 5 } ] },
    leaderSkill: {
      name: 'かいふくのオーラ・中',
      desc: 'かいふくタイプのHP1.7倍。',
      effects: [ { type: 'hp', condition: 'type', attr: 'かいふく', value: 1.7 } ]
    }
  },
  37: {
    id: 37,
    name: 'ロコン',
    rarity: 1,
    attr: 'fire',
    type: 'かいふく',
    baseExp: 100,
    stats: { hp: { min: 189, max: 426 }, atk: { min: 66, max: 123 }, rec: { min: 45, max: 82 } },
    skill: {
      name: 'ドロップチェンジ・火',
      sp: 3,
      desc: '木ドロップを火ドロップに変化。',
      effects: [ { type: 'orbConvert', from: 'wood', to: 'fire' } ]
    },
    leaderSkill: { name: '火のオーラ', desc: '火属性のHP1.2倍。', effects: [ { type: 'hp', attr: 'fire', value: 1.2 } ] },
    evolutions: [ { to: 38, materials: [ { item: 'puzzle12', count: 3 } ] } ]
  },
  38: {
    id: 38,
    name: 'キュウコン',
    rarity: 3,
    attr: 'fire',
    type: 'かいふく',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 410, max: 2740 }, atk: { min: 170, max: 1140 }, rec: { min: 175, max: 500 } },
    skill: {
      name: 'ダブルチェンジハート・火',
      sp: 5,
      desc: '水と木ドロップを回復ドロップに変化。',
      effects: [ { type: 'orbConvert', from: 'water', to: 'heal' }, { type: 'orbConvert', from: 'wood', to: 'heal' } ]
    },
    leaderSkill: { name: '火のオーラ・中', desc: '火属性のHP1.5倍。', effects: [ { type: 'hp', attr: 'fire', value: 1.5 } ] }
  },
  39: {
    id: 39,
    name: 'プリン',
    rarity: 1,
    attr: 'dark',
    type: 'たいりょく',
    baseExp: 100,
    stats: { hp: { min: 280, max: 600 }, atk: { min: 60, max: 240 }, rec: { min: 25, max: 40 } },
    skill: { name: 'キュアー', sp: 2, desc: 'バインドを2ターン回復。', effects: [ { type: 'bindRecover', turns: 2 } ] },
    leaderSkill: { name: '闇のオーラ', desc: '闇属性のHP1.2倍。', effects: [ { type: 'hp', attr: 'dark', value: 1.2 } ] },
    evolutions: [ { to: 40, materials: [ { item: 'puzzle54', count: 3 } ] } ]
  },
  40: {
    id: 40,
    name: 'プクリン',
    rarity: 3,
    attr: 'dark',
    type: 'たいりょく',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 730, max: 4850 }, atk: { min: 170, max: 1100 }, rec: { min: 91, max: 260 } },
    skill: { name: 'スーパーキュアー', sp: 3, desc: 'バインドを5ターン回復。', effects: [ { type: 'bindRecover', turns: 5 } ] },
    leaderSkill: { name: '闇のオーラ・中', desc: '闇属性のHP1.5倍。', effects: [ { type: 'hp', attr: 'dark', value: 1.5 } ] }
  },
  41: {
    id: 41,
    name: 'ズバット',
    rarity: 1,
    attr: 'dark',
    type: 'こうげき',
    baseExp: 150,
    stats: { hp: { min: 296, max: 666 }, atk: { min: 164, max: 344 }, rec: { min: 3, max: 20 } },
    skill: {
      name: 'かっくう',
      sp: 3,
      desc: '1ターンの間、操作時間が3秒延長。',
      effects: [ { type: 'moveTimeBuff', turns: 1, seconds: 3, mult: 1 } ]
    },
    leaderSkill: {
      name: 'シックスセンス・小',
      desc: '6コンボ以上で攻撃1.5倍。',
      effects: [ { type: 'atk', condition: 'combo', count: 6, value: 1.5 } ]
    },
    evolutions: [ { to: 42, materials: [ { item: 'puzzle52', count: 2 }, { item: 'puzzle5', count: 3 } ] } ]
  },
  42: {
    id: 42,
    name: 'ゴルバット',
    rarity: 3,
    attr: 'dark',
    type: 'こうげき',
    maxLevel: 75,
    baseExp: 300,
    stats: { hp: { min: 500, max: 2800 }, atk: { min: 390, max: 2570 }, rec: { min: 5, max: 0 } },
    skill: {
      name: 'かっくう',
      sp: 3,
      desc: '1ターンの間、操作時間が3秒延長。',
      effects: [ { type: 'moveTimeBuff', turns: 1, seconds: 3, mult: 1 } ]
    },
    leaderSkill: {
      name: 'シックスセンス',
      desc: '6コンボ以上で攻撃1.8倍。',
      effects: [ { type: 'atk', condition: 'combo', count: 6, value: 1.8 } ]
    }
  },
  43: {
    id: 43,
    name: 'ナゾノクサ',
    rarity: 1,
    attr: 'wood',
    type: 'かいふく',
    baseExp: 100,
    stats: { hp: { min: 89, max: 426 }, atk: { min: 66, max: 123 }, rec: { min: 15, max: 42 } },
    skill: {
      name: 'ドロップチェンジ・木',
      sp: 3,
      desc: '水ドロップを木ドロップに変化。',
      effects: [ { type: 'orbConvert', from: 'water', to: 'wood' } ]
    },
    leaderSkill: { name: '木のオーラ', desc: '木属性のHP1.2倍。', effects: [ { type: 'hp', attr: 'wood', value: 1.2 } ] },
    evolutions: [ { to: 44, materials: [ { item: 'puzzle32', count: 2 } ] } ]
  },
  44: {
    id: 44,
    name: 'クサイハナ',
    rarity: 2,
    attr: 'wood',
    type: 'かいふく',
    baseExp: 100,
    stats: { hp: { min: 300, max: 750 }, atk: { min: 100, max: 200 }, rec: { min: 20, max: 60 } },
    skill: {
      name: 'ドロップチェンジ・木',
      sp: 3,
      desc: '水ドロップを木ドロップに変化。',
      effects: [ { type: 'orbConvert', from: 'water', to: 'wood' } ]
    },
    leaderSkill: { name: '木のオーラ・中', desc: '木属性のHP1.5倍。', effects: [ { type: 'hp', attr: 'wood', value: 1.5 } ] },
    evolutions: [ { to: 45, materials: [ { item: 'puzzle33', count: 1 }, { item: 'spuzzle_3', count: 4 } ] } ]
  },
  45: {
    id: 45,
    name: 'ラフレシア',
    rarity: 3,
    attr: 'wood',
    type: 'かいふく',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 420, max: 2900 }, atk: { min: 220, max: 1260 }, rec: { min: 158, max: 450 } },
    skill: { name: 'こうごうせい', sp: 3, desc: 'HPを最大HPの35%回復。', effects: [ { type: 'heal', value: 0.35 } ] },
    leaderSkill: { name: '木のオーラ・大', desc: '木属性のHP1.7倍。', effects: [ { type: 'hp', attr: 'wood', value: 1.7 } ] }
  },
  46: {
    id: 46,
    name: 'パラス',
    rarity: 1,
    attr: 'wood',
    type: 'バランス',
    baseExp: 50,
    stats: { hp: { min: 98, max: 426 }, atk: { min: 136, max: 420 }, rec: { min: 15, max: 35 } },
    skill: {
      name: 'キノコのほうし',
      sp: 6,
      desc: '敵単体の行動を2ターン遅らせる。',
      effects: [ { type: 'enemyDelay', target: 'single', turns: 2 } ]
    },
    leaderSkill: {
      name: 'ウッドフォース',
      desc: '木をちょうど4個消すと攻撃1.3倍。',
      effects: [ { type: 'atk', condition: 'exactCount', attr: 'wood', count: 4, value: 1.3 } ]
    },
    evolutions: [ { to: 47, materials: [ { item: 'puzzle32', count: 3 } ] } ]
  },
  47: {
    id: 47,
    name: 'パラセクト',
    rarity: 3,
    attr: 'wood',
    type: 'バランス',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 550, max: 3650 }, atk: { min: 230, max: 1620 }, rec: { min: 133, max: 240 } },
    skill: {
      name: 'キノコのほうし+',
      sp: 6,
      desc: '敵単体の行動を3ターン遅らせる。',
      effects: [ { type: 'enemyDelay', target: 'single', turns: 3 } ]
    },
    leaderSkill: { name: '木のルーン・中', desc: '木属性の回復力1.7倍。', effects: [ { type: 'rec', attr: 'wood', value: 1.7 } ] }
  },
  48: {
    id: 48,
    name: 'コンパン',
    rarity: 1,
    attr: 'dark',
    type: 'バランス',
    baseExp: 150,
    stats: { hp: { min: 306, max: 466 }, atk: { min: 156, max: 253 }, rec: { min: 25, max: 50 } },
    skill: {
      name: 'チェンジハート・木',
      sp: 3,
      desc: '水ドロップを回復ドロップに変化。',
      effects: [ { type: 'orbConvert', from: 'water', to: 'heal' } ]
    },
    leaderSkill: {
      name: 'どくぼうそう',
      desc: '【落ちコンなし】毒を6個以上つなげて消すと攻撃1.8倍。',
      effects: [
        { type: 'noDrop', value: true },
        { type: 'atk', condition: 'orbConnect', attr: 'poison', count: 6, value: 1.8 }
      ]
    },
    evolutions: [ { to: 49, materials: [ { item: 'puzzle32', count: 1 }, { item: 'spuzzle_3', count: 4 } ] } ]
  },
  49: {
    id: 49,
    name: 'モルフォン',
    rarity: 3,
    attr: 'dark',
    type: 'バランス',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 560, max: 3700 }, atk: { min: 210, max: 1420 }, rec: { min: 151, max: 430 } },
    skill: {
      name: 'ダブルチェンジハート・木',
      sp: 5,
      desc: '火と水ドロップを回復ドロップに変化。',
      effects: [ { type: 'orbConvert', from: 'water', to: 'heal' }, { type: 'orbConvert', from: 'fire', to: 'heal' } ]
    },
    leaderSkill: {
      name: 'ポイズンカラミティ',
      desc: '【落ちコンなし】毒を6個以上つなげて消すと攻撃2倍、受けるダメージ20%軽減。',
      effects: [
        { type: 'noDrop', value: true },
        { type: 'atk', condition: 'orbConnect', attr: 'poison', count: 6, value: 2, reduce: 0.2 }
      ]
    }
  },
  50: {
    id: 50,
    name: 'ディグダ',
    rarity: 1,
    attr: 'light',
    type: 'こうげき',
    baseExp: 100,
    stats: { hp: { min: 90, max: 206 }, atk: { min: 296, max: 404 }, rec: { min: 4, max: 10 } },
    skill: {
      name: 'あなをほる',
      sp: 3,
      desc: '最下段横1列を光ドロップに変化。',
      effects: [ { type: 'orbChangeLine', dir: 'row', index: 4, count: 1, attr: 'light' } ]
    },
    leaderSkill: { name: '光のソウル', desc: '光属性の攻撃1.2倍。', effects: [ { type: 'atk', attr: 'light', value: 1.2 } ] },
    evolutions: [ { to: 51, materials: [ { item: 'puzzle12', count: 2 }, { item: 'spuzzle_4', count: 3 } ] } ]
  },
  51: {
    id: 51,
    name: 'ダグトリオ',
    rarity: 3,
    attr: 'light',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 380, max: 2450 }, atk: { min: 300, max: 2050 }, rec: { min: 14, max: 80 } },
    skill: {
      name: 'じしん',
      sp: 6,
      desc: '最下段横2列を光ドロップに変化。',
      effects: [ { type: 'orbChangeRow', row: 3, attr: 'light' }, { type: 'orbChangeRow', row: 4, attr: 'light' } ]
    },
    leaderSkill: { name: '閃光のソウル', desc: '光属性の攻撃1.5倍。', effects: [ { type: 'atk', attr: 'light', value: 1.5 } ] }
  },
  52: {
    id: 52,
    name: 'ニャース',
    rarity: 1,
    attr: 'light',
    type: 'バランス',
    baseExp: 100,
    stats: { hp: { min: 200, max: 450 }, atk: { min: 100, max: 250 }, rec: { min: 15, max: 55 } },
    skill: {
      name: 'シャインエンハンス',
      sp: 2,
      desc: '1ターンの間、光属性の攻撃が1.2倍。',
      effects: [ { type: 'atkBuff', attr: 'light', value: 1.2, turns: 1 } ]
    },
    leaderSkill: {
      name: 'シャインフォース',
      desc: '光をちょうど4個消すと攻撃1.3倍。',
      effects: [ { type: 'atk', condition: 'exactCount', attr: 'light', count: 4, value: 1.3 } ]
    },
    evolutions: [ { to: 53, materials: [ { item: 'spuzzle_4', count: 5 } ] } ]
  },
  53: {
    id: 53,
    name: 'ペルシアン',
    rarity: 3,
    attr: 'light',
    type: 'バランス',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 400, max: 2680 }, atk: { min: 200, max: 1420 }, rec: { min: 42, max: 200 } },
    skill: {
      name: 'シャインエンハンス・中',
      sp: 4,
      desc: '1ターンの間、光属性の攻撃が1.5倍。',
      effects: [ { type: 'atkBuff', attr: 'light', value: 1.5, turns: 1 } ]
    },
    leaderSkill: {
      name: 'ハイシャインフォース',
      desc: '光をちょうど4個消すと攻撃1.8倍、受けるダメージ3%軽減。',
      effects: [ { type: 'atk', condition: 'exactCount', attr: 'light', count: 4, value: 1.8, reduce: 0.03 } ]
    }
  },
  54: {
    id: 54,
    name: 'コダック',
    rarity: 1,
    attr: 'water',
    type: 'たいりょく',
    baseExp: 50,
    stats: { hp: { min: 178, max: 881 }, atk: { min: 146, max: 309 }, rec: { min: 8, max: 30 } },
    skill: {
      name: 'ドわすれ',
      sp: 4,
      desc: '1ターンの間、ダメージを50%軽減。',
      effects: [ { type: 'dmgReductionBuff', turns: 1, value: 0.5 } ]
    },
    leaderSkill: { name: '水のオーラ', desc: '水属性のHP1.2倍。', effects: [ { type: 'hp', attr: 'water', value: 1.2 } ] },
    evolutions: [ { to: 55, materials: [ { item: 'puzzle22', count: 2 }, { item: 'spuzzle_2', count: 2 } ] } ]
  },
  55: {
    id: 55,
    name: 'ゴルダック',
    rarity: 3,
    attr: 'water',
    type: 'たいりょく',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 630, max: 4210 }, atk: { min: 210, max: 1550 }, rec: { min: 35, max: 80 } },
    skill: {
      name: 'ドわすれ',
      sp: 4,
      desc: '1ターンの間、ダメージを50%軽減。',
      effects: [ { type: 'dmgReductionBuff', turns: 1, value: 0.5 } ]
    },
    leaderSkill: { name: '水のルーン・中', desc: '水属性の回復力1.7倍。', effects: [ { type: 'rec', attr: 'water', value: 1.7 } ] }
  },
  56: {
    id: 56,
    name: 'マンキー',
    rarity: 1,
    attr: 'fire',
    type: 'こうげき',
    baseExp: 100,
    stats: { hp: { min: 120, max: 326 }, atk: { min: 154, max: 480 }, rec: { min: 20, max: 30 } },
    skill: {
      name: 'ファイアエンハンス',
      sp: 2,
      desc: '1ターンの間、火属性の攻撃が1.2倍。',
      effects: [ { type: 'atkBuff', attr: 'fire', value: 1.2, turns: 1 } ]
    },
    leaderSkill: {
      name: 'カウンター',
      desc: 'HP50%以下で攻撃1.5倍。',
      effects: [ { type: 'atk', condition: 'hpBelow', threshold: 0.5, value: 1.5 } ]
    },
    evolutions: [ { to: 57, materials: [ { item: 'puzzle12', count: 2 }, { item: 'spuzzle_1', count: 3 } ] } ]
  },
  57: {
    id: 57,
    name: 'オコリザル',
    rarity: 3,
    attr: 'fire',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 275, max: 3000 }, atk: { min: 300, max: 1900 }, rec: { min: 35, max: 100 } },
    skill: {
      name: 'ファイアエンハンス・中',
      sp: 4,
      desc: '1ターンの間、火属性の攻撃が1.5倍。',
      effects: [ { type: 'atkBuff', attr: 'fire', value: 1.5, turns: 1 } ]
    },
    leaderSkill: {
      name: 'げきど',
      desc: 'HP25%以下で攻撃2.3倍。',
      effects: [ { type: 'atk', condition: 'hpBelow', threshold: 0.25, value: 2.3 } ]
    }
  },
  58: {
    id: 58,
    name: 'ガーディ',
    rarity: 1,
    attr: 'fire',
    type: 'バランス',
    baseExp: 100,
    stats: { hp: { min: 88, max: 386 }, atk: { min: 165, max: 420 }, rec: { min: 15, max: 35 } },
    skill: { name: 'いかく', sp: 4, desc: '敵全体の行動を1ターン遅らせる。', effects: [ { type: 'enemyDelay', target: 'all', turns: 1 } ] },
    leaderSkill: {
      name: 'ファイアフォース',
      desc: '火をちょうど4個消すと攻撃1.3倍。',
      effects: [ { type: 'atk', condition: 'exactCount', attr: 'fire', count: 4, value: 1.3 } ]
    },
    evolutions: [ { to: 59, materials: [ { item: 'puzzle13', count: 1 }, { item: 'spuzzle_1', count: 3 } ] } ]
  },
  59: {
    id: 59,
    name: 'ウインディ',
    rarity: 4,
    attr: 'fire',
    type: 'バランス',
    maxLevel: 99,
    baseExp: 1000,
    stats: { hp: { min: 520, max: 3470 }, atk: { min: 290, max: 1650 }, rec: { min: 53, max: 160 } },
    skill: { name: 'いかく+', sp: 6, desc: '敵全体の行動を2ターン遅らせる。', effects: [ { type: 'enemyDelay', target: 'all', turns: 2 } ] },
    leaderSkill: {
      name: 'ハイファイアフォース',
      desc: '火をちょうど4個消すと攻撃1.8倍、受けるダメージ3%軽減。',
      effects: [ { type: 'atk', condition: 'exactCount', attr: 'fire', count: 4, value: 1.8, reduce: 0.03 } ]
    }
  },
  60: {
    id: 60,
    name: 'ニョロモ',
    rarity: 1,
    attr: 'water',
    type: 'たいりょく',
    baseExp: 50,
    stats: { hp: { min: 188, max: 900 }, atk: { min: 126, max: 241 }, rec: { min: 18, max: 39 } },
    skill: {
      name: 'チェンジハート・水',
      sp: 3,
      desc: '火ドロップを回復ドロップに変化。',
      effects: [ { type: 'orbConvert', from: 'fire', to: 'heal' } ]
    },
    leaderSkill: {
      name: 'たいりょくのソウル・小',
      desc: 'たいりょくタイプの攻撃1.2倍。',
      effects: [ { type: 'atk', condition: 'type', attr: 'たいりょく', value: 1.2 } ]
    },
    evolutions: [ { to: 61, materials: [ { item: 'puzzle2', count: 5 } ] } ]
  },
  61: {
    id: 61,
    name: 'ニョロゾ',
    rarity: 2,
    attr: 'water',
    type: 'たいりょく',
    baseExp: 500,
    stats: { hp: { min: 400, max: 2000 }, atk: { min: 175, max: 1750 }, rec: { min: 17, max: 47 } },
    skill: {
      name: 'チェンジハート・水',
      sp: 3,
      desc: '火ドロップを回復ドロップに変化。',
      effects: [ { type: 'orbConvert', from: 'fire', to: 'heal' } ]
    },
    leaderSkill: {
      name: 'たいりょくのソウル',
      desc: 'たいりょくタイプの攻撃1.5倍。',
      effects: [ { type: 'atk', condition: 'type', attr: 'たいりょく', value: 1.5 } ]
    },
    evolutions: [ { to: 62, materials: [ { item: 'puzzle23', count: 1 }, { item: 'puzzle2', count: 2 } ] } ]
  },
  62: {
    id: 62,
    name: 'ニョロボン',
    rarity: 3,
    attr: 'water',
    type: 'たいりょく',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 690, max: 4620 }, atk: { min: 210, max: 1400 }, rec: { min: 40, max: 105 } },
    skill: {
      name: 'ガードブレイク',
      sp: 2,
      desc: '2ターンの間、敵全体の防御力を50%ダウン。',
      effects: [ { type: 'defenseDown', target: 'all', value: 0.5, turns: 2, message: '💥 防御力ダウン！' } ]
    },
    leaderSkill: {
      name: 'たいりょくのソウル・大',
      desc: 'たいりょくタイプの攻撃1.8倍。',
      effects: [ { type: 'atk', condition: 'type', attr: 'たいりょく', value: 1.8 } ]
    }
  },
  63: {
    id: 63,
    name: 'ケーシィ',
    rarity: 1,
    attr: 'dark',
    type: 'バランス',
    baseExp: 100,
    stats: { hp: { min: 103, max: 320 }, atk: { min: 148, max: 228 }, rec: { min: 20, max: 44 } },
    skill: { name: 'ザ・ワールド', sp: 4, desc: '5秒間、時を止める。', effects: [ { type: 'timeStop', seconds: 5 } ] },
    leaderSkill: { name: '闇のソウル', desc: '闇属性の攻撃1.2倍。', effects: [ { type: 'atk', attr: 'dark', value: 1.2 } ] },
    evolutions: [ { to: 64, materials: [ { item: 'puzzle5', count: 3 }, { item: 'spuzzle_52', count: 2 } ] } ]
  },
  64: {
    id: 64,
    name: 'ユンゲラー',
    rarity: 2,
    attr: 'dark',
    type: 'こうげき',
    baseExp: 300,
    stats: { hp: { min: 200, max: 300 }, atk: { min: 200, max: 600 }, rec: { min: 10, max: 50 } },
    skill: { name: 'ザ・ワールド', sp: 4, desc: '5秒間、時を止める。', effects: [ { type: 'timeStop', seconds: 5 } ] },
    leaderSkill: { name: '暗闇のソウル', desc: '闇属性の攻撃1.5倍。', effects: [ { type: 'atk', attr: 'dark', value: 1.5 } ] },
    evolutions: [ { to: 65, materials: [ { item: 'puzzle53', count: 2 } ] } ]
  },
  65: {
    id: 65,
    name: 'フーディン',
    rarity: 4,
    attr: 'dark',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 750,
    stats: { hp: { min: 400, max: 2450 }, atk: { min: 310, max: 2080 }, rec: { min: 53, max: 80 } },
    skill: { name: 'チェンジ・ザ・ワールド', sp: 5, desc: '9秒間、時を止める。', effects: [ { type: 'timeStop', seconds: 9 } ] },
    leaderSkill: { name: '暗夜のソウル', desc: '闇属性の攻撃1.8倍。', effects: [ { type: 'atk', attr: 'dark', value: 1.8 } ] }
  },
  66: {
    id: 66,
    name: 'ワンリキー',
    rarity: 1,
    attr: 'fire',
    type: 'こうげき',
    baseExp: 100,
    stats: { hp: { min: 220, max: 450 }, atk: { min: 194, max: 450 }, rec: { min: 0, max: 0 } },
    skill: {
      name: 'ガードクラッシュ',
      sp: 2,
      desc: '1ターンの間、敵全体の防御力を75%ダウン。',
      effects: [ { type: 'defenseDown', target: 'all', value: 0.75, turns: 1, message: '💥 防御力ダウン！' } ]
    },
    leaderSkill: { name: 'パワーパンチ', desc: 'HP満タン時、攻撃1.5倍。', effects: [ { type: 'atk', condition: 'hpFull', value: 1.5 } ] },
    evolutions: [ { to: 67, materials: [ { item: 'spuzzle_1', count: 5 } ] } ]
  },
  67: {
    id: 67,
    name: 'ゴーリキー',
    rarity: 2,
    attr: 'fire',
    type: 'こうげき',
    baseExp: 300,
    stats: { hp: { min: 250, max: 550 }, atk: { min: 250, max: 550 }, rec: { min: 0, max: 0 } },
    skill: {
      name: 'ガードクラッシュ',
      sp: 2,
      desc: '1ターンの間、敵全体の防御力を75%ダウン。',
      effects: [ { type: 'defenseDown', target: 'all', value: 0.75, turns: 1, message: '💥 防御力ダウン！' } ]
    },
    leaderSkill: { name: 'ハイパーパンチ', desc: 'HP満タン時、攻撃1.7倍。', effects: [ { type: 'atk', condition: 'hpFull', value: 1.7 } ] },
    evolutions: [ { to: 68, materials: [ { item: 'puzzle12', count: 2 }, { item: 'spuzzle_12', count: 2 } ] } ]
  },
  68: {
    id: 68,
    name: 'カイリキー',
    rarity: 4,
    attr: 'fire',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 450, max: 2800 }, atk: { min: 390, max: 2570 }, rec: { min: 15, max: 0 } },
    skill: {
      name: 'シールドクラッシュ',
      sp: 3,
      desc: '3ターンの間、敵全体の防御力を75%ダウン。',
      effects: [ { type: 'defenseDown', target: 'all', value: 0.75, turns: 3, message: '💥 防御力ダウン！' } ]
    },
    leaderSkill: {
      name: 'メガトンパンチ',
      desc: 'HP満タン時、攻撃1.8倍。\n7コンボ以上で攻撃1.25倍。',
      effects: [ { type: 'atk', condition: 'hpFull', value: 1.8 }, { type: 'atk', condition: 'combo', count: 7, value: 1.25 } ]
    }
  },
  69: {
    id: 69,
    name: 'マダツボミ',
    rarity: 1,
    attr: 'wood',
    type: 'バランス',
    baseExp: 50,
    stats: { hp: { min: 196, max: 350 }, atk: { min: 136, max: 160 }, rec: { min: 0, max: 42 } },
    skill: {
      name: 'メガドレイン',
      sp: 4,
      desc: '水ドロップを回復ドロップに変化。\nHPを最大HPの25%回復。',
      effects: [ { type: 'orbConvert', from: 'water', to: 'heal' }, { type: 'heal', value: 0.25 } ]
    },
    leaderSkill: { name: 'いやし', desc: 'ドロップを消すと最大HPの20%回復。', effects: [ { type: 'hpRecovery', value: 0.2 } ] },
    evolutions: [ { to: 70, materials: [ { item: 'puzzle32', count: 2 }, { item: 'spuzzle_3', count: 2 } ] } ]
  },
  70: {
    id: 70,
    name: 'ウツドン',
    rarity: 2,
    attr: 'wood',
    type: 'バランス',
    baseExp: 500,
    stats: { hp: { min: 420, max: 1700 }, atk: { min: 220, max: 1900 }, rec: { min: 10, max: 50 } },
    skill: {
      name: 'メガドレイン',
      sp: 4,
      desc: '水ドロップを回復ドロップに変化。\nHPを最大HPの25%回復。',
      effects: [ { type: 'orbConvert', from: 'water', to: 'heal' }, { type: 'heal', value: 0.25 } ]
    },
    leaderSkill: {
      name: 'せいちょう',
      desc: '木を5個以上つなげて消すと攻撃1.5倍。',
      effects: [ { type: 'atk', condition: 'orbConnect', attr: 'wood', count: 5, value: 1.5 } ]
    },
    evolutions: [ { to: 71, materials: [ { item: 'puzzle33', count: 1 }, { item: 'spuzzle_3', count: 3 } ] } ]
  },
  71: {
    id: 71,
    name: 'ウツボット',
    rarity: 3,
    attr: 'wood',
    type: 'バランス',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 470, max: 3160 }, atk: { min: 280, max: 1840 }, rec: { min: 46, max: 130 } },
    skill: {
      name: 'メガドレイン',
      sp: 4,
      desc: '水ドロップを回復ドロップに変化。\nHPを最大HPの25%回復。',
      effects: [ { type: 'orbConvert', from: 'water', to: 'heal' }, { type: 'heal', value: 0.25 } ]
    },
    leaderSkill: {
      name: 'ソーラーパワー',
      desc: '木を6個以上つなげて消すと攻撃2倍。',
      effects: [ { type: 'atk', condition: 'orbConnect', attr: 'wood', count: 6, value: 2 } ]
    }
  },
  72: {
    id: 72,
    name: 'メノクラゲ',
    rarity: 1,
    attr: 'water',
    type: 'たいりょく',
    baseExp: 50,
    stats: { hp: { min: 198, max: 910 }, atk: { min: 126, max: 241 }, rec: { min: 8, max: 19 } },
    skill: { name: 'スモッグ', sp: 2, desc: '木ドロップを毒ドロップに変化。', effects: [ { type: 'orbConvert', from: 'wood', to: 'poison' } ] },
    leaderSkill: { name: 'どくくらい', desc: '毒ドロップを消すと攻撃1.5倍。', effects: [ { type: 'atk', condition: 'poison', value: 1.5 } ] },
    evolutions: [ { to: 73, materials: [ { item: 'puzzle22', count: 2 }, { item: 'puzzle52', count: 1 } ] } ]
  },
  73: {
    id: 73,
    name: 'ドククラゲ',
    rarity: 3,
    attr: 'water',
    type: 'たいりょく',
    maxLevel: 99,
    baseExp: 750,
    stats: { hp: { min: 640, max: 4250 }, atk: { min: 170, max: 1150 }, rec: { min: 133, max: 380 } },
    skill: {
      name: 'ポイズンロック',
      sp: 2,
      desc: 'HPが最大HPの25%減る。\n左上に毒を逆L字型に生成。',
      effects: [ { type: 'selfDamage', mode: 'percent', value: 0.25 }, { type: 'orbChangeReverseL', attr: 'poison' } ]
    },
    leaderSkill: {
      name: 'アシッドコンボ',
      desc: '毒ドロップを消すと攻撃1.5倍。\nHP50%以下で受けるダメージ20%軽減。',
      effects: [
        { type: 'atk', condition: 'poison', value: 1.5 },
        { type: 'atk', condition: 'hpBelow', threshold: 0.5, value: 1, reduce: 0.2 }
      ]
    }
  },
  74: {
    id: 74,
    name: 'イシツブテ',
    rarity: 1,
    attr: 'light',
    type: 'たいりょく',
    baseExp: 100,
    stats: { hp: { min: 300, max: 900 }, atk: { min: 80, max: 160 }, rec: { min: 5, max: 30 } },
    skill: {
      name: 'かたくなる',
      sp: 3,
      desc: '1ターンの間、ダメージを25%軽減。',
      effects: [ { type: 'dmgReductionBuff', turns: 1, value: 0.25 } ]
    },
    leaderSkill: {
      name: 'シールド',
      desc: 'HP満タン時、受けるダメージ25%軽減。',
      effects: [ { type: 'atk', condition: 'hpFull', value: 1, reduce: 0.25 } ]
    },
    evolutions: [ { to: 75, materials: [ { item: 'puzzle4', count: 2 }, { item: 'spuzzle_4', count: 3 } ] } ]
  },
  75: {
    id: 75,
    name: 'ゴローン',
    rarity: 2,
    attr: 'light',
    type: 'たいりょく',
    maxLevel: 99,
    baseExp: 300,
    stats: { hp: { min: 360, max: 2420 }, atk: { min: 180, max: 1220 }, rec: { min: 14, max: 40 } },
    skill: {
      name: 'かたくなる',
      sp: 3,
      desc: '1ターンの間、ダメージを25%軽減。',
      effects: [ { type: 'dmgReductionBuff', turns: 1, value: 0.25 } ]
    },
    leaderSkill: {
      name: 'シールド',
      desc: 'HP満タン時、受けるダメージ25%軽減。',
      effects: [ { type: 'atk', condition: 'hpFull', value: 1, reduce: 0.25 } ]
    },
    evolutions: [ { to: 76, materials: [ { item: 'puzzle42', count: 4 } ] } ]
  },
  76: {
    id: 76,
    name: 'ゴローニャ',
    rarity: 3,
    attr: 'light',
    type: 'たいりょく',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 630, max: 4210 }, atk: { min: 250, max: 1550 }, rec: { min: 28, max: 80 } },
    skill: {
      name: 'てっぺき',
      sp: 4,
      desc: '1ターンの間、ダメージを50%軽減。',
      effects: [ { type: 'dmgReductionBuff', turns: 1, value: 0.5 } ]
    },
    leaderSkill: {
      name: 'ハイシールド',
      desc: 'HP満タン時、受けるダメージ35%軽減。',
      effects: [ { type: 'atk', condition: 'hpFull', value: 1, reduce: 0.35 } ]
    }
  },
  77: {
    id: 77,
    name: 'ポニータ',
    rarity: 1,
    attr: 'fire',
    type: 'こうげき',
    baseExp: 100,
    stats: { hp: { min: 173, max: 605 }, atk: { min: 180, max: 445 }, rec: { min: 27, max: 30 } },
    skill: {
      name: 'かえんぐるま',
      sp: 3,
      desc: '最下段の横1列を火ドロップに変化。',
      effects: [ { type: 'orbChangeLine', dir: 'row', index: 4, count: 1, attr: 'fire' } ]
    },
    leaderSkill: { name: '火のルーン', desc: '火属性の回復力1.3倍。', effects: [ { type: 'rec', attr: 'fire', value: 1.3 } ] },
    evolutions: [ { to: 78, materials: [ { item: 'puzzle1', count: 5 } ] } ]
  },
  78: {
    id: 78,
    name: 'ギャロップ',
    rarity: 3,
    attr: 'fire',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 450, max: 3000 }, atk: { min: 290, max: 1900 }, rec: { min: 39, max: 100 } },
    skill: {
      name: 'れんごく',
      sp: 6,
      desc: '最下段横2列を火ドロップに変化。',
      effects: [
        { type: 'orbChangeLine', dir: 'row', index: 3, count: 1, attr: 'fire' },
        { type: 'orbChangeLine', dir: 'row', index: 4, count: 1, attr: 'fire' }
      ]
    },
    leaderSkill: { name: '火のルーン・中', desc: '火属性の回復力1.7倍。', effects: [ { type: 'rec', attr: 'fire', value: 1.7 } ] }
  },
  79: {
    id: 79,
    name: 'ヤドン',
    rarity: 1,
    attr: 'water',
    type: 'バランス',
    baseExp: 50,
    stats: { hp: { min: 359, max: 759 }, atk: { min: 91, max: 191 }, rec: { min: 15, max: 45 } },
    skill: { name: 'なまける', sp: 3, desc: 'HPを最大HPの35%回復。', effects: [ { type: 'heal', value: 0.35 } ] },
    leaderSkill: { name: '水のルーン', desc: '水属性の回復力1.3倍。', effects: [ { type: 'rec', attr: 'water', value: 1.3 } ] },
    evolutions: [ { to: 80, materials: [ { item: 'puzzle22', count: 3 }, { item: 'spuzzle_2', count: 2 } ] } ]
  },
  80: {
    id: 80,
    name: 'ヤドラン',
    rarity: 4,
    attr: 'water',
    type: 'バランス',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 640, max: 4250 }, atk: { min: 200, max: 1330 }, rec: { min: 168, max: 280 } },
    skill: { name: 'なまけてやすむ', sp: 5, desc: 'HPを最大HPの60%回復。', effects: [ { type: 'heal', value: 0.6 } ] },
    leaderSkill: {
      name: '水のアミュレット',
      desc: '水属性の全パラメータが1.2倍。',
      effects: [
        { type: 'hp', attr: 'water', value: 1.2 },
        { type: 'atk', attr: 'water', value: 1.2 },
        { type: 'rec', attr: 'water', value: 1.2 }
      ]
    }
  },
  81: {
    id: 81,
    name: 'コイル',
    rarity: 1,
    attr: 'light',
    type: 'こうげき',
    baseExp: 50,
    stats: { hp: { min: 158, max: 681 }, atk: { min: 184, max: 329 }, rec: { min: 8, max: 20 } },
    skill: {
      name: 'ソニックブーム',
      sp: 3,
      desc: '1ターンの間、高速ルーレットを2つ生成。',
      effects: [ { type: 'roulette', turns: 1, count: 2, sec: '0.5' } ]
    },
    leaderSkill: {
      name: 'こうげきのソウル・小',
      desc: 'こうげきタイプの攻撃1.2倍。',
      effects: [ { type: 'atk', condition: 'type', attr: 'こうげき', value: 1.2 } ]
    },
    evolutions: [ { to: 82, materials: [ { item: 'puzzle43', count: 2 } ] } ]
  },
  82: {
    id: 82,
    name: 'レアコイル',
    rarity: 3,
    attr: 'light',
    type: 'こうげき',
    maxLevel: 75,
    baseExp: 500,
    stats: { hp: { min: 300, max: 1800 }, atk: { min: 100, max: 1740 }, rec: { min: 0, max: 0 } },
    skill: {
      name: 'ソニックブーム+',
      sp: 3,
      desc: '1ターンの間、高速ルーレットを3つ生成。',
      effects: [ { type: 'roulette', turns: 1, count: 3, sec: '0.5' } ]
    },
    leaderSkill: {
      name: 'トリプルバイツ',
      desc: '【落ちコンなし】3コンボ以上で攻撃1.2倍。\n9コンボ以上で攻撃1.6倍、受けるダメージ3%軽減。',
      effects: [
        { type: 'atk', condition: 'combo', count: 3, value: 1.2 },
        { type: 'atk', condition: 'combo', count: 9, value: 1.6, reduce: 0.03 },
        { type: 'noDrop', value: true }
      ]
    }
  },
  83: {
    id: 83,
    name: 'カモネギ',
    rarity: 2,
    attr: 'light',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 300,
    stats: { hp: { min: 290, max: 2930 }, atk: { min: 290, max: 1920 }, rec: { min: 16, max: 90 } },
    skill: {
      name: 'シャインクロス',
      sp: 3,
      desc: '光ドロップを十字の形に生成。',
      effects: [ { type: 'orbChangeCross', row: 2, col: 2, attr: 'light' } ]
    },
    leaderSkill: {
      name: 'トライテクニカル',
      desc: '十字/L字消しすると攻撃1.3倍。\nちょうど4個消しで攻撃1.3倍。',
      effects: [
        { type: 'atk', condition: 'cross', value: 1.35 },
        { type: 'atk', condition: 'lShapes', value: 1.35 },
        { type: 'atk', condition: 'exact4', value: 1.35 }
      ]
    }
  },
  84: {
    id: 84,
    name: 'ドードー',
    rarity: 1,
    attr: 'light',
    type: 'バランス',
    baseExp: 100,
    stats: { hp: { min: 500, max: 1500 }, atk: { min: 200, max: 600 }, rec: { min: 50, max: 150 } },
    skill: {
      name: 'ドロップチェンジ・光',
      sp: 3,
      desc: '闇ドロップを光ドロップに変化。',
      effects: [ { type: 'orbConvert', from: 'dark', to: 'light' } ]
    },
    leaderSkill: {
      name: 'ファイブステップ',
      desc: '5コンボ以上で攻撃1.3倍。',
      effects: [ { type: 'atk', condition: 'combo', count: 5, value: 1.3 } ]
    },
    evolutions: [ { to: 85, materials: [ { item: 'puzzle4', count: 2 }, { item: 'spuzzle_4', count: 3 } ] } ]
  },
  85: {
    id: 85,
    name: 'ドードリオ',
    rarity: 3,
    attr: 'light',
    type: 'バランス',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 380, max: 2510 }, atk: { min: 290, max: 1910 }, rec: { min: 40, max: 115 } },
    skill: { name: 'トリプルヘッド', sp: 3, desc: '3ターンの間、敵全体に攻撃。', effects: [ { type: 'allAttackBuff', turns: 3 } ] },
    leaderSkill: {
      name: 'ハイファイブステップ',
      desc: '【操作時間2秒固定】5コンボ以上で攻撃2倍、受けるダメージ20%軽減。',
      effects: [ { type: 'atk', condition: 'combo', count: 5, value: 2, reduce: 0.2 }, { type: 'moveTimeFixed', value: 2000 } ]
    }
  },
  86: {
    id: 86,
    name: 'パウワウ',
    rarity: 2,
    attr: 'water',
    type: 'バランス',
    baseExp: 100,
    stats: { hp: { min: 154, max: 876 }, atk: { min: 151, max: 365 }, rec: { min: 18, max: 75 } },
    skill: {
      name: 'ウォーターエンハンス',
      sp: 2,
      desc: '1ターンの間、水属性の攻撃が1.2倍。',
      effects: [ { type: 'atkBuff', attr: 'water', value: 1.2, turns: 1 } ]
    },
    leaderSkill: {
      name: 'アクアフォース',
      desc: '水をちょうど4個消すと攻撃1.3倍。',
      effects: [ { type: 'atk', condition: 'exactCount', attr: 'water', count: 4, value: 1.3 } ]
    },
    evolutions: [ { to: 87, materials: [ { item: 'puzzle23', count: 1 }, { item: 'spuzzle_2', count: 2 } ] } ]
  },
  87: {
    id: 87,
    name: 'ジュゴン',
    rarity: 3,
    attr: 'water',
    type: 'バランス',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 520, max: 3470 }, atk: { min: 200, max: 1600 }, rec: { min: 63, max: 180 } },
    skill: {
      name: 'ウォーターエンハンス・中',
      sp: 4,
      desc: '1ターンの間、水属性の攻撃が1.5倍。',
      effects: [ { type: 'atkBuff', attr: 'water', value: 1.5, turns: 1 } ]
    },
    leaderSkill: {
      name: 'ハイアクアフォース',
      desc: '水をちょうど4個消すと攻撃1.8倍、受けるダメージ3%軽減。',
      effects: [ { type: 'atk', condition: 'exactCount', attr: 'water', count: 4, value: 1.8, reduce: 0.03 } ]
    }
  },
  88: {
    id: 88,
    name: 'ベトベター',
    rarity: 1,
    attr: 'dark',
    type: 'たいりょく',
    baseExp: 100,
    stats: { hp: { min: 266, max: 466 }, atk: { min: 96, max: 233 }, rec: { min: 5, max: 0 } },
    skill: {
      name: 'どくのきり',
      sp: 3,
      desc: '毒ドロップをランダムで6つ生成。',
      effects: [ { type: 'orbChangeRandom', attr: 'poison', count: 6, message: '☠️ 毒ドロップ生成！' } ]
    },
    leaderSkill: {
      name: 'めんえきどく',
      desc: '毒ドロップを消すと受けるダメージ30%軽減。',
      effects: [ { type: 'atk', condition: 'poison', value: 1, reduce: 0.3 } ]
    },
    evolutions: [ { to: 89, materials: [ { item: 'puzzle52', count: 3 } ] } ]
  },
  89: {
    id: 89,
    name: 'ベトベトン',
    rarity: 3,
    attr: 'dark',
    type: 'たいりょく',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 780, max: 4500 }, atk: { min: 230, max: 1620 }, rec: { min: 0, max: 0 } },
    skill: {
      name: 'どくのきり',
      sp: 3,
      desc: '毒ドロップをランダムで6つ生成。',
      effects: [ { type: 'orbChangeRandom', attr: 'poison', count: 6, message: '☠️ 毒ドロップ生成！' } ]
    },
    leaderSkill: {
      name: 'めんえきどく+',
      desc: '毒ドロップを消すと受けるダメージ40%軽減。',
      effects: [ { type: 'atk', condition: 'poison', value: 1, reduce: 0.4 } ]
    }
  },
  90: {
    id: 90,
    name: 'シェルダー',
    rarity: 1,
    attr: 'water',
    type: 'こうげき',
    baseExp: 100,
    stats: { hp: { min: 227, max: 805 }, atk: { min: 80, max: 345 }, rec: { min: 27, max: 30 } },
    skill: {
      name: 'とげキャノン',
      sp: 3,
      desc: '敵全体に攻撃力×7倍の水属性攻撃。',
      effects: [ { type: 'damageSelfAtkMult', target: 'all', value: 7, attr: 'water' } ]
    },
    leaderSkill: {
      name: 'シールド',
      desc: 'HP満タン時、受けるダメージ25%軽減。',
      effects: [ { type: 'atk', condition: 'hpFull', value: 1, reduce: 0.25 } ]
    },
    evolutions: [ { to: 91, materials: [ { item: 'puzzle2', count: 3 }, { item: 'spuzzle_22', count: 2 } ] } ]
  },
  91: {
    id: 91,
    name: 'パルシェン',
    rarity: 3,
    attr: 'water',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 680, max: 2680 }, atk: { min: 300, max: 2000 }, rec: { min: 12, max: 35 } },
    skill: {
      name: 'つららおとし',
      sp: 3,
      desc: '最左の縦1列を水ドロップに変化。',
      effects: [ { type: 'orbChangeLine', dir: 'col', index: 0, count: 1, attr: 'water' } ]
    },
    leaderSkill: {
      name: 'スーパーハーフアップ',
      desc: 'HP50%以上で攻撃1.7倍、受けるダメージ3%軽減。',
      effects: [ { type: 'atk', condition: 'hpAbove', threshold: 0.5, value: 1.7, reduce: 0.03 } ]
    }
  },
  92: {
    id: 92,
    name: 'ゴース',
    rarity: 1,
    attr: 'dark',
    type: 'こうげき',
    baseExp: 150,
    stats: { hp: { min: 171, max: 471 }, atk: { min: 252, max: 572 }, rec: { min: 0, max: 0 } },
    skill: {
      name: 'ドロップチェンジ・闇',
      sp: 3,
      desc: '光ドロップを闇ドロップに変化。',
      effects: [ { type: 'orbConvert', from: 'light', to: 'dark' } ]
    },
    leaderSkill: {
      name: 'ダークコンボ',
      desc: '闇ドロップの2コンボ以上で攻撃1.7倍。',
      effects: [ { type: 'atk', condition: 'attrCombos', attr: 'dark', count: 2, value: 1.7 } ]
    },
    evolutions: [ { to: 93, materials: [ { item: 'puzzle5', count: 6 } ] } ]
  },
  93: {
    id: 93,
    name: 'ゴースト',
    rarity: 3,
    attr: 'dark',
    type: 'こうげき',
    baseExp: 500,
    stats: { hp: { min: 565, max: 1275 }, atk: { min: 455, max: 755 }, rec: { min: 0, max: 0 } },
    skill: {
      name: 'ドロップチェンジ・闇',
      sp: 3,
      desc: '光ドロップを闇ドロップに変化。',
      effects: [ { type: 'orbConvert', from: 'light', to: 'dark' } ]
    },
    leaderSkill: {
      name: 'ダークコンボ',
      desc: '闇ドロップの2コンボ以上で攻撃1.7倍。',
      effects: [ { type: 'atk', condition: 'attrCombos', attr: 'dark', count: 2, value: 1.7 } ]
    },
    evolutions: [ { to: 94, materials: [ { item: 'puzzle53', count: 1 }, { item: 'puzzle5', count: 2 } ] } ]
  },
  94: {
    id: 94,
    name: 'ゲンガー',
    rarity: 4,
    attr: 'dark',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 1000,
    stats: { hp: { min: 330, max: 2800 }, atk: { min: 390, max: 2570 }, rec: { min: 0, max: 0 } },
    skill: {
      name: 'ドロップチェンジ・闇',
      sp: 3,
      desc: '光ドロップを闇ドロップに変化。',
      effects: [ { type: 'orbConvert', from: 'light', to: 'dark' } ]
    },
    leaderSkill: {
      name: 'ダークコンボ・大',
      desc: '闇ドロップの2コンボ以上で攻撃2倍。',
      effects: [ { type: 'atk', condition: 'attrCombos', attr: 'dark', count: 2, value: 2 } ]
    }
  },
  95: {
    id: 95,
    name: 'イワーク',
    rarity: 2,
    attr: 'light',
    type: 'たいりょく',
    baseExp: 100,
    stats: { hp: { min: 404, max: 1076 }, atk: { min: 75, max: 165 }, rec: { min: 5, max: 25 } },
    skill: {
      name: 'てっぺき',
      sp: 4,
      desc: '1ターンの間、ダメージを50%軽減。',
      effects: [ { type: 'dmgReductionBuff', turns: 1, value: 0.5 } ]
    },
    leaderSkill: {
      name: 'ハーフアップ',
      desc: 'HP50%以上で攻撃1.3倍。',
      effects: [ { type: 'atk', condition: 'hpAbove', threshold: 0.5, value: 1.3 } ]
    }
  },
  96: {
    id: 96,
    name: 'スリープ',
    rarity: 1,
    attr: 'dark',
    type: 'かいふく',
    baseExp: 100,
    stats: { hp: { min: 103, max: 320 }, atk: { min: 128, max: 198 }, rec: { min: 44, max: 74 } },
    skill: {
      name: 'チェンジハート・闇',
      sp: 3,
      desc: '光ドロップを回復ドロップに変化。',
      effects: [ { type: 'orbConvert', from: 'light', to: 'heal' } ]
    },
    leaderSkill: { name: '闇のルーン', desc: '闇属性の回復力1.3倍。', effects: [ { type: 'rec', attr: 'dark', value: 1.3 } ] },
    evolutions: [ { to: 97, materials: [ { item: 'puzzle5', count: 2 }, { item: 'spuzzle_52', count: 3 } ] } ]
  },
  97: {
    id: 97,
    name: 'スリーパー',
    rarity: 3,
    attr: 'dark',
    type: 'かいふく',
    maxLevel: 99,
    baseExp: 1000,
    stats: { hp: { min: 460, max: 3100 }, atk: { min: 190, max: 1450 }, rec: { min: 245, max: 550 } },
    skill: {
      name: 'ダブルチェンジハート・闇',
      sp: 5,
      desc: '光と毒ドロップを回復ドロップに変化。',
      effects: [ { type: 'orbConvert', from: 'light', to: 'heal' }, { type: 'orbConvert', from: 'poison', to: 'heal' } ]
    },
    leaderSkill: { name: '闇のルーン・中', desc: '闇属性の回復力1.7倍。', effects: [ { type: 'rec', attr: 'dark', value: 1.7 } ] }
  },
  98: {
    id: 98,
    name: 'クラブ',
    rarity: 1,
    attr: 'water',
    type: 'こうげき',
    baseExp: 50,
    stats: { hp: { min: 97, max: 307 }, atk: { min: 211, max: 591 }, rec: { min: 0, max: 15 } },
    skill: {
      name: 'クラブハンマー',
      sp: 2,
      desc: '敵単体に攻撃力×10倍の水属性攻撃。',
      effects: [ { type: 'damageSelfAtkMult', value: 10, attr: 'water', target: 'single' } ]
    },
    leaderSkill: {
      name: 'カウンター',
      desc: 'HP50%以下で攻撃1.5倍。',
      effects: [ { type: 'atk', condition: 'hpBelow', threshold: 0.5, value: 1.5 } ]
    },
    evolutions: [ { to: 99, materials: [ { item: 'spuzzle_1', count: 4 }, { item: 'puzzle2', count: 2 } ] } ]
  },
  99: {
    id: 99,
    name: 'キングラー',
    rarity: 3,
    attr: 'water',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 390, max: 2600 }, atk: { min: 310, max: 2050 }, rec: { min: 18, max: 50 } },
    skill: {
      name: 'アタックエンハンス・中',
      sp: 4,
      desc: '1ターンの間、こうげきタイプの攻撃が1.5倍。',
      effects: [ { type: 'atkBuff', value: 1.5, turns: 1, monType: 'こうげき' } ]
    },
    leaderSkill: {
      name: 'ハイカウンター',
      desc: 'HP50%以下で攻撃2倍、受けるダメージ3%軽減。',
      effects: [ { type: 'atk', condition: 'hpBelow', threshold: 0.5, value: 2, reduce: 0.03 } ]
    }
  },
  100: {
    id: 100,
    name: 'ビリリダマ',
    rarity: 1,
    attr: 'light',
    type: 'こうげき',
    baseExp: 150,
    stats: { hp: { min: 100, max: 350 }, atk: { min: 255, max: 380 }, rec: { min: 10, max: 22 } },
    skill: {
      name: 'せいでんき',
      sp: 2,
      desc: '1ターンの間、操作時間が1秒延長。',
      effects: [ { type: 'moveTimeBuff', turns: 1, seconds: 1, mult: 1 } ]
    },
    leaderSkill: {
      name: 'ライトコンボ',
      desc: '光ドロップの2コンボ以上で攻撃1.7倍。',
      effects: [ { type: 'atk', condition: 'attrCombos', attr: 'light', count: 2, value: 1.7 } ]
    },
    evolutions: [ { to: 101, materials: [ { item: 'spuzzle_12', count: 2 }, { item: 'spuzzle_42', count: 3 } ] } ]
  },
  101: {
    id: 101,
    name: 'マルマイン',
    rarity: 3,
    attr: 'light',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 410, max: 2750 }, atk: { min: 270, max: 1900 }, rec: { min: 21, max: 60 } },
    skill: {
      name: 'だいばくはつ',
      sp: 2,
      desc: 'HPが1になる。\n光ドロップをランダムで6つ生成。',
      effects: [ { type: 'selfDamage', mode: 'toOne', value: 0.5 }, { type: 'orbChangeRandom', attr: 'light', count: 6 } ]
    },
    leaderSkill: {
      name: 'ライトコンボ・大',
      desc: '光ドロップの2コンボ以上で攻撃2倍。',
      effects: [ { type: 'atk', condition: 'attrCombos', attr: 'light', count: 2, value: 2 } ]
    }
  },
  102: {
    id: 102,
    name: 'タマタマ',
    rarity: 1,
    attr: 'wood',
    type: 'バランス',
    maxLevel: 99,
    baseExp: 300,
    stats: { hp: { min: 380, max: 1010 }, atk: { min: 180, max: 1180 }, rec: { min: 30, max: 85 } },
    skill: {
      name: 'ウッドエンハンス',
      sp: 2,
      desc: '1ターンの間、木属性の攻撃が1.2倍。',
      effects: [ { type: 'atkBuff', attr: 'wood', value: 1.2, turns: 1 } ]
    },
    leaderSkill: {
      name: 'ウッドコンボ',
      desc: '木ドロップの2コンボ以上で攻撃1.7倍。',
      effects: [ { type: 'atk', condition: 'attrCombos', attr: 'wood', count: 2, value: 1.7 } ]
    },
    evolutions: [ { to: 103, materials: [ { item: 'puzzle33', count: 1 }, { item: 'spuzzle_3', count: 4 } ] } ]
  },
  103: {
    id: 103,
    name: 'ナッシー',
    rarity: 3,
    attr: 'wood',
    type: 'バランス',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 540, max: 3650 }, atk: { min: 320, max: 1620 }, rec: { min: 42, max: 240 } },
    skill: {
      name: 'ウッドエンハンス・中',
      sp: 4,
      desc: '1ターンの間、木属性の攻撃が1.5倍。',
      effects: [ { type: 'atkBuff', attr: 'wood', value: 1.5, turns: 1 } ]
    },
    leaderSkill: {
      name: 'ウッドコンボ・大',
      desc: '木ドロップの2コンボ以上で攻撃2倍。',
      effects: [ { type: 'atk', condition: 'attrCombos', attr: 'wood', count: 2, value: 2 } ]
    }
  },
  104: {
    id: 104,
    name: 'カラカラ',
    rarity: 1,
    attr: 'light',
    type: 'かいふく',
    baseExp: 100,
    stats: { hp: { min: 80, max: 406 }, atk: { min: 66, max: 123 }, rec: { min: 20, max: 52 } },
    skill: {
      name: 'ホネブーメラン',
      sp: 2,
      desc: '敵全体に攻撃力×5倍の光属性攻撃。',
      effects: [ { type: 'damageSelfAtkMult', value: 5, attr: 'light' } ]
    },
    leaderSkill: {
      name: 'かいふくのソウル・小',
      desc: 'かいふくタイプの攻撃1.2倍。',
      effects: [ { type: 'atk', condition: 'type', attr: 'かいふく', value: 1.2 } ]
    },
    evolutions: [ { to: 105, materials: [ { item: 'puzzle42', count: 2 }, { item: 'spuzzle_4', count: 4 } ] } ]
  },
  105: {
    id: 105,
    name: 'ガラガラ',
    rarity: 3,
    attr: 'light',
    type: 'かいふく',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 350, max: 2340 }, atk: { min: 170, max: 1430 }, rec: { min: 140, max: 400 } },
    skill: {
      name: 'ホネブーメラン+',
      sp: 4,
      desc: '敵全体に攻撃力×7倍の光属性攻撃。\n最上段の横1列を光ドロップに変化。',
      effects: [
        { type: 'damageSelfAtkMult', target: 'all', value: 7, attr: 'light' },
        { type: 'orbChangeLine', dir: 'row', index: 0, count: 1, attr: 'light' }
      ]
    },
    leaderSkill: {
      name: 'かいふくのソウル・大',
      desc: 'かいふくタイプの攻撃1.8倍。',
      effects: [ { type: 'atk', condition: 'type', attr: 'かいふく', value: 1.8 } ]
    }
  },
  106: {
    id: 106,
    name: 'サワムラー',
    rarity: 3,
    attr: 'fire',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 380,
    stats: { hp: { min: 410, max: 2750 }, atk: { min: 300, max: 1900 }, rec: { min: 28, max: 60 } },
    skill: {
      name: 'ファイアクロス',
      sp: 3,
      desc: '火ドロップを十字の形に生成。',
      effects: [ { type: 'orbChangeCross', row: 2, col: 2, attr: 'fire' } ]
    },
    leaderSkill: {
      name: 'ブレイズキック',
      desc: '火を6個以上つなげて消すと攻撃2倍。',
      effects: [ { type: 'atk', condition: 'orbConnect', attr: 'fire', count: 6, value: 2 } ]
    }
  },
  107: {
    id: 107,
    name: 'エビワラー',
    rarity: 3,
    attr: 'fire',
    type: 'たいりょく',
    maxLevel: 99,
    baseExp: 380,
    stats: { hp: { min: 590, max: 3900 }, atk: { min: 230, max: 1670 }, rec: { min: 46, max: 130 } },
    skill: {
      name: 'ストレート',
      sp: 4,
      desc: '敵単体に攻撃力×7倍の火属性攻撃。\n最左の縦1列を火ドロップに変化。',
      effects: [
        { type: 'damageSelfAtkMult', target: 'single', value: 7, attr: 'fire' },
        { type: 'orbChangeLine', dir: 'col', index: 0, count: 1, attr: 'fire' }
      ]
    },
    leaderSkill: {
      name: 'ワンツーパンチ',
      desc: '火ドロップの2コンボ以上で攻撃2倍。',
      effects: [ { type: 'atk', condition: 'attrCombos', attr: 'fire', count: 2, value: 2 } ]
    }
  },
  108: {
    id: 108,
    name: 'ベロリンガ',
    rarity: 2,
    attr: 'fire',
    type: 'たいりょく',
    baseExp: 250,
    stats: { hp: { min: 427, max: 1500 }, atk: { min: 225, max: 550 }, rec: { min: 8, max: 78 } },
    skill: { name: 'ベロでひきこむ', sp: 6, desc: '敵全体の行動を2ターン遅らせる。', effects: [ { type: 'enemyDelay', target: 'all', turns: 2 } ] },
    leaderSkill: { name: '火のオーラ・中', desc: '火属性のHP1.5倍。', effects: [ { type: 'hp', attr: 'fire', value: 1.5 } ] }
  },
  109: {
    id: 109,
    name: 'ドガース',
    rarity: 1,
    attr: 'dark',
    type: 'こうげき',
    baseExp: 100,
    stats: { hp: { min: 206, max: 366 }, atk: { min: 206, max: 333 }, rec: { min: 5, max: 0 } },
    skill: {
      name: 'ダークエンハンス',
      sp: 2,
      desc: '1ターンの間、闇属性の攻撃が1.2倍。',
      effects: [ { type: 'atkBuff', attr: 'dark', value: 1.2, turns: 1 } ]
    },
    leaderSkill: {
      name: 'どくのシールド',
      desc: '毒ダメージを無効化。\n毒ドロップを消すと攻撃1.1倍。',
      effects: [ { type: 'poisonImmune', value: true }, { type: 'atk', condition: 'poison', value: 1.1 } ]
    },
    evolutions: [ { to: 110, materials: [ { item: 'puzzle52', count: 2 }, { item: 'spuzzle_5', count: 3 } ] } ]
  },
  110: {
    id: 110,
    name: 'マタドガス',
    rarity: 3,
    attr: 'dark',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 750,
    stats: { hp: { min: 470, max: 3150 }, atk: { min: 260, max: 1750 }, rec: { min: 53, max: 150 } },
    skill: {
      name: 'ダークエンハンス・中',
      sp: 4,
      desc: '1ターンの間、闇属性の攻撃が1.5倍。',
      effects: [ { type: 'atkBuff', attr: 'dark', value: 1.5, turns: 1 } ]
    },
    leaderSkill: {
      name: 'もうどくのシールド',
      desc: '毒ダメージを無効化。\n毒ドロップを消すと攻撃1.5倍。',
      effects: [ { type: 'poisonImmune', value: true }, { type: 'atk', condition: 'poison', value: 1.5 } ]
    }
  },
  111: {
    id: 111,
    name: 'サイホーン',
    rarity: 2,
    attr: 'light',
    type: 'こうげき',
    baseExp: 100,
    stats: { hp: { min: 154, max: 876 }, atk: { min: 251, max: 465 }, rec: { min: 8, max: 25 } },
    skill: {
      name: 'つのでつく',
      sp: 2,
      desc: '敵単体に2,000の固定ダメージ。',
      effects: [ { type: 'damageAll', target: 'single', value: 2000 } ]
    },
    leaderSkill: {
      name: 'フォースパワー',
      desc: 'ドロップをちょうど4個消す度に攻撃1.1倍。',
      effects: [ { type: 'atk', condition: 'exact4', value: 1.1, exponential: true } ]
    },
    evolutions: [ { to: 112, materials: [ { item: 'puzzle42', count: 3 }, { item: 'puzzle4', count: 2 } ] } ]
  },
  112: {
    id: 112,
    name: 'サイドン',
    rarity: 3,
    attr: 'light',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 510, max: 3400 }, atk: { min: 390, max: 2370 }, rec: { min: 12, max: 0 } },
    skill: {
      name: 'つのドリル',
      sp: 5,
      desc: '敵単体に20,000の固定ダメージ。',
      effects: [ { type: 'damageAll', target: 'single', value: 20000 } ]
    },
    leaderSkill: {
      name: 'フォースシールド',
      desc: 'ドロップをちょうど4個消す度に攻撃1.1倍、受けるダメージ3%軽減。',
      effects: [ { type: 'atk', condition: 'exact4', value: 1.1, exponential: true, reduce: 0.03 } ]
    }
  },
  113: {
    id: 113,
    name: 'ラッキー',
    rarity: 3,
    attr: 'light',
    type: 'たいりょく',
    maxLevel: 99,
    baseExp: 5000,
    stats: { hp: { min: 600, max: 6000 }, atk: { min: 1, max: 100 }, rec: { min: 5, max: 50 } },
    skill: { name: 'タマゴうみ', sp: 5, desc: 'HPを最大HPの70%回復。', effects: [ { type: 'heal', value: 0.7 } ] },
    leaderSkill: {
      name: 'サファリセブン',
      desc: '【操作時間3秒固定】7コンボ以上で攻撃1.8倍。',
      effects: [ { type: 'moveTimeFixed', value: 3000 }, { type: 'atk', condition: 'combo', count: 7, value: 1.8 } ]
    }
  },
  114: {
    id: 114,
    name: 'モンジャラ',
    rarity: 2,
    attr: 'wood',
    type: 'たいりょく',
    baseExp: 250,
    stats: { hp: { min: 450, max: 1750 }, atk: { min: 250, max: 750 }, rec: { min: 10, max: 100 } },
    skill: {
      name: 'チェンジハート・木',
      sp: 3,
      desc: '水ドロップを回復ドロップに変化。',
      effects: [ { type: 'orbConvert', from: 'water', to: 'heal' } ]
    },
    leaderSkill: {
      name: 'ソーラーパワー',
      desc: '木を6個以上つなげて消すと攻撃2倍。',
      effects: [ { type: 'atk', condition: 'orbConnect', attr: 'wood', count: 6, value: 2 } ]
    }
  },
  115: {
    id: 115,
    name: 'ガルーラ',
    rarity: 3,
    attr: 'light',
    type: 'かいふく',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 530, max: 3500 }, atk: { min: 220, max: 1420 }, rec: { min: 182, max: 230 } },
    skill: {
      name: 'リフレッシュ・ファイブ',
      sp: 3,
      desc: '5属性ドロップをランダムで2つずつ生成。',
      effects: [
        { type: 'orbChangeRandom', attr: 'fire', count: 2 },
        { type: 'orbChangeRandom', attr: 'water', count: 2 },
        { type: 'orbChangeRandom', attr: 'wood', count: 2 },
        { type: 'orbChangeRandom', attr: 'light', count: 2 },
        { type: 'orbChangeRandom', attr: 'dark', count: 2 }
      ]
    },
    leaderSkill: {
      name: 'かがやくひとみ',
      desc: '5色同時に消すと攻撃1.8倍。',
      effects: [ { type: 'atk', condition: 'colorCount', count: 5, value: 1.8 } ]
    }
  },
  116: {
    id: 116,
    name: 'タッツー',
    rarity: 1,
    attr: 'water',
    type: 'たいりょく',
    baseExp: 100,
    stats: { hp: { min: 298, max: 598 }, atk: { min: 96, max: 196 }, rec: { min: 26, max: 36 } },
    skill: {
      name: 'みずてっぽう',
      sp: 3,
      desc: '敵全体に1,000の固定ダメージ。\n最上段の横1列を水ドロップに変化。',
      effects: [ { type: 'damageAll', value: 1000 }, { type: 'orbChangeLine', dir: 'row', index: 0, count: 1, attr: 'water' } ]
    },
    leaderSkill: { name: '水のオーラ', desc: '水属性のHP1.2倍。', effects: [ { type: 'hp', attr: 'water', value: 1.2 } ] },
    evolutions: [ { to: 117, materials: [ { item: 'puzzle22', count: 3 }, { item: 'spuzzle_2', count: 2 } ] } ]
  },
  117: {
    id: 117,
    name: 'シードラ',
    rarity: 2,
    attr: 'water',
    type: 'たいりょく',
    maxLevel: 75,
    baseExp: 500,
    stats: { hp: { min: 466, max: 2666 }, atk: { min: 100, max: 1100 }, rec: { min: 24, max: 74 } },
    skill: {
      name: 'てっぽうみず',
      sp: 3,
      desc: '敵全体に5,000の固定ダメージ。\n最上段の横1列を水ドロップに変化。',
      effects: [ { type: 'damageAll', value: 5000 }, { type: 'orbChangeLine', dir: 'row', index: 0, count: 1, attr: 'water' } ]
    },
    leaderSkill: { name: '水のオーラ・中', desc: '水属性のHP1.5倍。', effects: [ { type: 'hp', attr: 'water', value: 1.5 } ] }
  },
  118: {
    id: 118,
    name: 'トサキント',
    rarity: 1,
    attr: 'water',
    type: 'かいふく',
    baseExp: 100,
    stats: { hp: { min: 266, max: 566 }, atk: { min: 153, max: 213 }, rec: { min: 51, max: 81 } },
    skill: {
      name: 'チェンジハート・水',
      sp: 3,
      desc: '火ドロップを回復ドロップに変化。',
      effects: [ { type: 'orbConvert', from: 'fire', to: 'heal' } ]
    },
    leaderSkill: {
      name: 'かいふくのルーン',
      desc: '回復タイプの回復力1.3倍。',
      effects: [ { type: 'rec', condition: 'type', attr: '回復', value: 1.3 } ]
    },
    evolutions: [ { to: 119, materials: [ { item: 'puzzle42', count: 2 }, { item: 'puzzle22', count: 2 } ] } ]
  },
  119: {
    id: 119,
    name: 'アズマオウ',
    rarity: 3,
    attr: 'water',
    type: 'かいふく',
    maxLevel: 99,
    baseExp: 1000,
    stats: { hp: { min: 470, max: 3100 }, atk: { min: 220, max: 1450 }, rec: { min: 196, max: 550 } },
    skill: {
      name: 'ダブルチェンジハート・水',
      sp: 5,
      desc: '火と木ドロップを回復ドロップに変化。',
      effects: [ { type: 'orbConvert', from: 'wood', to: 'heal' }, { type: 'orbConvert', from: 'fire', to: 'heal' } ]
    },
    leaderSkill: {
      name: 'かいふくのルーン・中',
      desc: '回復タイプの回復力1.7倍。',
      effects: [ { type: 'rec', condition: 'type', attr: '回復', value: 1.7 } ]
    }
  },
  120: {
    id: 120,
    name: 'ヒトデマン',
    rarity: 1,
    attr: 'water',
    type: 'バランス',
    baseExp: 100,
    stats: { hp: { min: 344, max: 644 }, atk: { min: 182, max: 262 }, rec: { min: 34, max: 64 } },
    skill: {
      name: 'ガードブレイク',
      sp: 2,
      desc: '2ターンの間、敵全体の防御力を50%ダウン。',
      effects: [ { type: 'defenseDown', target: 'all', value: 0.5, turns: 2, message: '💥 防御力ダウン！' } ]
    },
    leaderSkill: {
      name: 'ほしのひとみ',
      desc: '4色以上同時に消すと攻撃1.3倍。',
      effects: [ { type: 'atk', condition: 'colorCount', value: 1.3, count: 4 } ]
    },
    evolutions: [
      {
        to: 121,
        materials: [ { item: 'puzzle1', count: 3 }, { item: 'puzzle2', count: 3 }, { item: 'puzzle3', count: 3 } ]
      }
    ]
  },
  121: {
    id: 121,
    name: 'スターミー',
    rarity: 4,
    attr: 'water',
    type: 'バランス',
    maxLevel: 99,
    baseExp: 750,
    stats: { hp: { min: 510, max: 3400 }, atk: { min: 230, max: 1560 }, rec: { min: 100, max: 200 } },
    skill: {
      name: 'なぞのちから',
      sp: 4,
      desc: '1ターンの間、全属性の攻撃が1.5倍。\n1ターンの間、操作時間が2秒短縮。',
      effects: [ { type: 'atkBuff', value: 1.5, turns: 1 }, { type: 'moveTimeBuff', turns: 1, seconds: -2, mult: 1 } ]
    },
    leaderSkill: {
      name: 'ほしぼしのひとみ',
      desc: '【落ちコンなし】4色以上同時に消すと攻撃1.4倍。\n残りドロップ5個以下で攻撃1.4倍。',
      effects: [
        { type: 'atk', condition: 'colorCount', value: 1.4, count: 4 },
        { type: 'atk', condition: 'remainingOrbs', threshold: 5, value: 1.4 },
        { type: 'noDrop', value: true }
      ]
    }
  },
  122: {
    id: 122,
    name: 'バリヤード',
    rarity: 3,
    attr: 'dark',
    type: 'バランス',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 490, max: 3250 }, atk: { min: 200, max: 1480 }, rec: { min: 189, max: 220 } },
    skill: {
      name: 'バリアー',
      sp: 6,
      desc: '3ターンの間、ダメージを25%軽減。',
      effects: [ { type: 'dmgReductionBuff', turns: 3, value: 0.25 } ]
    },
    leaderSkill: {
      name: '闇のアミュレット',
      desc: '闇属性の全パラメータが1.2倍。',
      effects: [
        { type: 'hp', attr: 'dark', value: 1.2 },
        { type: 'atk', attr: 'dark', value: 1.2 },
        { type: 'rec', attr: 'dark', value: 1.2 }
      ]
    }
  },
  123: {
    id: 123,
    name: 'ストライク',
    rarity: 3,
    attr: 'wood',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 200,
    stats: { hp: { min: 354, max: 3032 }, atk: { min: 271, max: 1838 }, rec: { min: 25, max: 120 } },
    skill: {
      name: 'シザークロス',
      sp: 3,
      desc: '木ドロップを十字の形に生成。',
      effects: [ { type: 'orbChangeCross', row: 3, col: 3, attr: 'wood' } ]
    },
    leaderSkill: { name: 'クロスカット', desc: '十字消しをすると攻撃1.5倍。', effects: [ { type: 'atk', condition: 'cross', value: 1.5 } ] }
  },
  124: {
    id: 124,
    name: 'ルージュラ',
    rarity: 3,
    attr: 'water',
    type: 'かいふく',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 440, max: 3200 }, atk: { min: 210, max: 1400 }, rec: { min: 238, max: 450 } },
    skill: { name: 'ハートエンハンス', sp: 3, desc: '1ターンの間、回復力が1.5倍。', effects: [ { type: 'recMult', turns: 1, value: 1.5 } ] },
    leaderSkill: {
      name: 'かいふくのソウル',
      desc: 'かいふくタイプの攻撃1.5倍。',
      effects: [ { type: 'atk', condition: 'type', attr: 'かいふく', value: 1.5 } ]
    }
  },
  125: {
    id: 125,
    name: 'エレブー',
    rarity: 2,
    attr: 'light',
    type: 'バランス',
    baseExp: 500,
    stats: { hp: { min: 310, max: 2200 }, atk: { min: 300, max: 1200 }, rec: { min: 40, max: 140 } },
    skill: {
      name: 'ルーレット・ワン',
      sp: 3,
      desc: '2ターンの間、ルーレットを1つ生成。',
      effects: [ { type: 'roulette', turns: 2, count: 1, sec: '1' } ]
    },
    leaderSkill: {
      name: 'こうげきのソウル',
      desc: 'こうげきタイプの攻撃1.5倍。',
      effects: [ { type: 'atk', condition: 'type', attr: 'こうげき', value: 1.5 } ]
    }
  },
  126: {
    id: 126,
    name: 'ブーバー',
    rarity: 3,
    attr: 'fire',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 350, max: 2320 }, atk: { min: 310, max: 2080 }, rec: { min: 23, max: 75 } },
    skill: {
      name: 'かえんほうしゃ',
      sp: 6,
      desc: '敵全体に5,000の固定ダメージ。\n最上段横2列を火ドロップに変化。',
      effects: [
        { type: 'damageAll', value: 5000 },
        { type: 'orbChangeLine', dir: 'row', index: 0, count: 1, attr: 'fire' },
        { type: 'orbChangeLine', dir: 'row', index: 1, count: 1, attr: 'fire' }
      ]
    },
    leaderSkill: { name: '火のアミュレット', desc: '火属性の全パラメータが1.2倍。', effects: [ { type: 'allStat', attr: 'fire', value: 1.2 } ] }
  },
  127: {
    id: 127,
    name: 'カイロス',
    rarity: 3,
    attr: 'wood',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 440, max: 2900 }, atk: { min: 300, max: 1960 }, rec: { min: 31, max: 90 } },
    skill: {
      name: 'つのでつく',
      sp: 3,
      desc: '最左の縦1列を木ドロップに変化。',
      effects: [ { type: 'orbChangeLine', dir: 'col', index: 0, count: 1, attr: 'wood' } ]
    },
    leaderSkill: { name: 'クロスカット', desc: '十字消しをすると攻撃1.5倍。', effects: [ { type: 'atk', condition: 'cross', value: 1.5 } ] }
  },
  128: {
    id: 128,
    name: 'ケンタロス',
    rarity: 3,
    attr: 'fire',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 200,
    stats: { hp: { min: 490, max: 3250 }, atk: { min: 280, max: 1850 }, rec: { min: 11, max: 30 } },
    skill: {
      name: 'とっしん',
      sp: 3,
      desc: '敵単体に攻撃力×10倍の火属性攻撃。',
      effects: [ { type: 'damageSelfAtkMult', value: 10, attr: 'fire', target: 'single' } ]
    },
    leaderSkill: { name: '火炎のソウル', desc: '火属性の攻撃1.5倍。', effects: [ { type: 'atk', attr: 'fire', value: 1.5 } ] }
  },
  129: {
    id: 129,
    name: 'コイキング',
    rarity: 1,
    attr: 'water',
    type: 'バランス',
    baseExp: 50,
    stats: { hp: { min: 50, max: 100 }, atk: { min: 5, max: 25 }, rec: { min: 0, max: 5 } },
    skill: { name: 'はねる', sp: 1, desc: '敵単体に3の固定ダメージ。', effects: [ { type: 'damageAll', target: 'single', value: 3 } ] },
    leaderSkill: { name: 'せいめいりょく', desc: '全属性のHP1.1倍。', effects: [ { type: 'hp', value: 1.1 } ] },
    evolutions: [ { to: 130, materials: [ { item: 'puzzle23', count: 2 } ] } ]
  },
  130: {
    id: 130,
    name: 'ギャラドス',
    rarity: 4,
    attr: 'water',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 1000,
    stats: { hp: { min: 510, max: 3400 }, atk: { min: 300, max: 2370 }, rec: { min: 28, max: 0 } },
    skill: {
      name: 'たきのぼり',
      sp: 5,
      desc: '滝の形に水ドロップを生成する。',
      effects: [
        { type: 'orbChangeLine', dir: 'col', index: 0, count: 1, attr: 'water' },
        { type: 'orbChangeLine', dir: 'col', index: 0, count: 2, attr: 'water' }
      ]
    },
    leaderSkill: {
      name: 'だいこうずい',
      desc: '水を8個以上つなげて消すと攻撃2倍、1コンボ加算。',
      effects: [ { type: 'atk', condition: 'orbConnect', attr: 'water', count: 8, value: 2, comboAdd: 1 } ]
    }
  },
  131: {
    id: 131,
    name: 'ラプラス',
    rarity: 3,
    attr: 'water',
    type: 'たいりょく',
    maxLevel: 99,
    baseExp: 200,
    stats: { hp: { min: 710, max: 4750 }, atk: { min: 170, max: 1150 }, rec: { min: 151, max: 230 } },
    skill: {
      name: 'なみのり',
      sp: 6,
      desc: '最下段横2列を水ドロップに変化。',
      effects: [
        { type: 'orbChangeLine', dir: 'row', index: 3, count: 1, attr: 'water' },
        { type: 'orbChangeLine', dir: 'row', index: 4, count: 1, attr: 'water' }
      ]
    },
    leaderSkill: { name: '水のオーラ・中', desc: '水属性のHP1.5倍。', effects: [ { type: 'hp', attr: 'water', value: 1.5 } ] }
  },
  132: {
    id: 132,
    name: 'メタモン',
    rarity: 3,
    attr: 'dark',
    type: 'バランス',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 50, max: 50 }, atk: { min: 5, max: 25 }, rec: { min: 0, max: 5 } },
    skill: {
      name: 'へんしん',
      sp: 4,
      desc: 'ランダムでほかのモンスターにへんしんする。',
      effects: [
        {
          type: 'transformRandom',
          ids: [
            3,
            6,
            9,
            12,
            15,
            18,
            22,
            24,
            26,
            28,
            31,
            34,
            38,
            36,
            40,
            42,
            45,
            47,
            49,
            51,
            53,
            55,
            57,
            59,
            62,
            65,
            68,
            71,
            73,
            76,
            78,
            80,
            82,
            83,
            85,
            87,
            89,
            91,
            94,
            97,
            95,
            97,
            99,
            101,
            103,
            105,
            106,
            107,
            108,
            110,
            112,
            113,
            114,
            115
          ]
        }
      ]
    },
    leaderSkill: { name: 'かわりもの', desc: 'スキルで『へんしん』を使用できる', effects: [] }
  },
  133: {
    id: 133,
    name: 'イーブイ',
    rarity: 3,
    attr: 'light',
    type: 'バランス',
    maxLevel: 50,
    baseExp: 100,
    stats: { hp: { min: 200, max: 2000 }, atk: { min: 100, max: 1200 }, rec: { min: 20, max: 80 } },
    skill: { name: 'キュアー', sp: 2, desc: 'バインドを2ターン回復。', effects: [ { type: 'bindRecover', turns: 2 } ] },
    leaderSkill: { name: '光のルーン', desc: '光属性の回復力1.3倍。', effects: [ { type: 'rec', attr: 'light', value: 1.3 } ] },
    evolutions: [
      { to: 134, materials: [ { item: 'puzzle23', count: 1 }, { item: 'spuzzle_4', count: 4 } ] },
      { to: 135, materials: [ { item: 'puzzle43', count: 1 }, { item: 'spuzzle_4', count: 4 } ] },
      { to: 136, materials: [ { item: 'puzzle13', count: 2 } ] }
    ]
  },
  134: {
    id: 134,
    name: 'シャワーズ',
    rarity: 4,
    attr: 'water',
    type: 'バランス',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 650, max: 3900 }, atk: { min: 200, max: 1480 }, rec: { min: 150, max: 230 } },
    skill: {
      name: 'ドロップチェンジ・水',
      sp: 3,
      desc: '火ドロップを水ドロップに変化。',
      effects: [ { type: 'orbConvert', from: 'fire', to: 'water' } ]
    },
    leaderSkill: {
      name: 'じきゅうりょく',
      desc: 'HP50%以下で受けるダメージ25%軽減。',
      effects: [ { type: 'atk', condition: 'hpBelow', threshold: 0.5, value: 1, reduce: 0.25 } ]
    }
  },
  135: {
    id: 135,
    name: 'サンダース',
    rarity: 4,
    attr: 'light',
    type: 'バランス',
    maxLevel: 99,
    baseExp: 1500,
    stats: { hp: { min: 500, max: 3000 }, atk: { min: 300, max: 1600 }, rec: { min: 100, max: 300 } },
    skill: {
      name: 'でんきショック',
      sp: 3,
      desc: '最左の縦1列を光ドロップに変化。',
      effects: [ { type: 'orbChangeLine', dir: 'col', index: 0, count: 1, attr: 'light' } ]
    },
    leaderSkill: {
      name: 'ライトストレート',
      desc: '光をちょうど5個消すと攻撃1.5倍。\nスキル使用時、攻撃1.3倍、受けるダメージ3%軽減。',
      effects: [
        { type: 'atk', condition: 'exactCount', attr: 'light', count: 5, value: 1.5 },
        { type: 'atk', condition: 'skillUsed', value: 1.3, reduce: 0.03 }
      ]
    }
  },
  136: {
    id: 136,
    name: 'ブースター',
    rarity: 4,
    attr: 'fire',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 2500,
    stats: { hp: { min: 600, max: 3400 }, atk: { min: 400, max: 2370 }, rec: { min: 0, max: 0 } },
    skill: {
      name: 'ガードクラッシュ',
      sp: 2,
      desc: '1ターンの間、敵全体の防御力を75%ダウン。',
      effects: [ { type: 'defenseDown', target: 'all', value: 0.75, turns: 1, message: '💥 防御力ダウン！' } ]
    },
    leaderSkill: {
      name: 'セブンフォース',
      desc: '【落ちコンなし】7コンボ以上で攻撃2倍、受けるダメージ15%軽減。',
      effects: [ { type: 'atk', condition: 'combo', count: 7, value: 2, reduce: 0.15 }, { type: 'noDrop', value: true } ]
    }
  },
  137: {
    id: 137,
    name: 'ポリゴン',
    rarity: 2,
    attr: 'fire',
    type: 'バランス',
    maxLevel: 99,
    baseExp: 300,
    stats: { hp: { min: 400, max: 2680 }, atk: { min: 230, max: 1560 }, rec: { min: 49, max: 140 } },
    skill: { name: 'フューチャー', sp: 7, desc: '12秒間、時を止める。', effects: [ { type: 'timeStop', seconds: 12 } ] },
    leaderSkill: {
      name: 'L・CPU',
      desc: 'L字消しする度に攻撃1.2倍。',
      effects: [ { type: 'atk', condition: 'lShapes', value: 1.25, exponential: true } ]
    }
  },
  138: {
    id: 138,
    name: 'オムナイト',
    rarity: 2,
    attr: 'water',
    type: 'たいりょく',
    maxLevel: 99,
    baseExp: 300,
    stats: { hp: { min: 330, max: 2170 }, atk: { min: 200, max: 1340 }, rec: { min: 25, max: 70 } },
    skill: {
      name: 'ドわすれ',
      sp: 4,
      desc: '1ターンの間、ダメージを50%軽減。',
      effects: [ { type: 'dmgReductionBuff', turns: 1, value: 0.5 } ]
    },
    leaderSkill: {
      name: 'たいりょくのアミュレット',
      desc: 'たいりょくタイプの全パラメータが1.2倍。',
      effects: [ { type: 'allStat', condition: 'type', attr: 'たいりょく', value: 1.2 } ]
    },
    evolutions: [ { to: 139, materials: [ { item: 'puzzle22', count: 2 }, { item: 'puzzle32', count: 2 } ] } ]
  },
  139: {
    id: 139,
    name: 'オムスター',
    rarity: 3,
    attr: 'water',
    type: 'たいりょく',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 570, max: 3790 }, atk: { min: 240, max: 1630 }, rec: { min: 31, max: 90 } },
    skill: {
      name: 'ドわすれ',
      sp: 4,
      desc: '1ターンの間、ダメージを50%軽減。',
      effects: [ { type: 'dmgReductionBuff', turns: 1, value: 0.5 } ]
    },
    leaderSkill: {
      name: 'たいりょくのアミュレット',
      desc: 'たいりょくタイプの全パラメータが1.2倍。',
      effects: [ { type: 'allStat', condition: 'type', attr: 'たいりょく', value: 1.2 } ]
    }
  },
  140: {
    id: 140,
    name: 'カブト',
    rarity: 2,
    attr: 'water',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 300,
    stats: { hp: { min: 270, max: 1800 }, atk: { min: 260, max: 1740 }, rec: { min: 12, max: 20 } },
    skill: {
      name: 'ルーレット・ワンS',
      sp: 3,
      desc: '2ターンの間、高速ルーレットを1つ生成。',
      effects: [ { type: 'roulette', turns: 2, count: 1, sec: '0.5' } ]
    },
    leaderSkill: { name: 'スキルパワーアップ', desc: 'スキル使用時、攻撃1.5倍。', effects: [ { type: 'atk', condition: 'skillUsed', value: 1.5 } ] },
    evolutions: [ { to: 141, materials: [ { item: 'spuzzle_22', count: 2 }, { item: 'spuzzle_52', count: 2 } ] } ]
  },
  141: {
    id: 141,
    name: 'カブトプス',
    rarity: 3,
    attr: 'water',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 500,
    stats: { hp: { min: 330, max: 2410 }, atk: { min: 350, max: 2490 }, rec: { min: 19, max: 75 } },
    skill: {
      name: 'ルーレット・ワンS',
      sp: 3,
      desc: '2ターンの間、高速ルーレットを1つ生成。',
      effects: [ { type: 'roulette', turns: 2, count: 1, sec: '0.5' } ]
    },
    leaderSkill: { name: 'スキルパワーアップ+', desc: 'スキル使用時、攻撃1.8倍。', effects: [ { type: 'atk', condition: 'skillUsed', value: 1.8 } ] }
  },
  142: {
    id: 142,
    name: 'プテラ',
    rarity: 4,
    attr: 'dark',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 250,
    stats: { hp: { min: 460, max: 3050 }, atk: { min: 290, max: 1950 }, rec: { min: 21, max: 60 } },
    skill: {
      name: 'げんしのほうこう',
      sp: 6,
      desc: '敵全体に攻撃力×20倍の木属性攻撃。',
      effects: [ { type: 'damageSelfAtkMult', value: 20, attr: 'wood' } ]
    },
    leaderSkill: {
      name: 'ジェラシックパワー',
      desc: '【落ちコンなし】残りドロップ4個以下で攻撃2倍。',
      effects: [ { type: 'noDrop', value: true }, { type: 'atk', condition: 'remainingOrbs', threshold: 4, value: 2 } ]
    }
  },
  143: {
    id: 143,
    name: 'カビゴン',
    rarity: 4,
    attr: 'wood',
    type: 'たいりょく',
    maxLevel: 99,
    baseExp: 1000,
    stats: { hp: { min: 780, max: 5200 }, atk: { min: 220, max: 1180 }, rec: { min: 0, max: 10 } },
    skill: { name: 'キュアー', sp: 2, desc: 'バインドを2ターン回復。', effects: [ { type: 'bindRecover', turns: 2 } ] },
    leaderSkill: {
      name: 'じきゅうりょく',
      desc: 'HP50%以下で受けるダメージ25%軽減。',
      effects: [ { type: 'atk', condition: 'hpBelow', threshold: 0.5, value: 1, reduce: 0.25 } ]
    }
  },
  144: {
    id: 144,
    name: 'フリーザー',
    rarity: 5,
    attr: 'water',
    type: 'たいりょく',
    maxLevel: 99,
    baseExp: 2000,
    stats: { hp: { min: 470, max: 3030 }, atk: { min: 300, max: 1200 }, rec: { min: 63, max: 400 } },
    skill: {
      name: 'ふぶき',
      sp: 5,
      desc: '水ドロップを雪の結晶の形に2つ生成。',
      effects: [
        { type: 'orbChangeCross', row: 1, col: 1, attr: 'water' },
        { type: 'orbChangeCross', row: 3, col: 4, attr: 'water' }
      ]
    },
    leaderSkill: {
      name: 'アイスウインドコンボ',
      desc: '水属性の十字消しをすると攻撃1.4倍、受けるダメージ8%軽減。\nL字消しをすると攻撃1.4倍、受けるダメージ8%軽減。',
      effects: [
        { type: 'atk', condition: 'cross', shapeAttr: 'water', value: 1.4, reduce: 0.08 },
        { type: 'atk', condition: 'lShapes', value: 1.4, reduce: 0.08 }
      ]
    }
  },
  145: {
    id: 145,
    name: 'サンダー',
    rarity: 5,
    attr: 'light',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 2000,
    stats: { hp: { min: 470, max: 3150 }, atk: { min: 300, max: 1980 }, rec: { min: 63, max: 180 } },
    skill: {
      name: 'かみなり',
      sp: 5,
      desc: '光ドロップを雷の形に生成する。',
      effects: [
        { type: 'orbChangeLine', dir: 'col', index: 2, count: 1, attr: 'light' },
        { type: 'orbChangeCross', row: 4, col: 2, attr: 'light' }
      ]
    },
    leaderSkill: {
      name: 'ルーンライトコンボ',
      desc: '光属性の回復力1.25倍。\n光ドロップの2コンボ以上で攻撃1.5倍。',
      effects: [
        { type: 'rec', attr: 'light', value: 1.25 },
        { type: 'atk', condition: 'attrCombos', attr: 'light', count: 2, value: 1.5 }
      ]
    }
  },
  146: {
    id: 146,
    name: 'ファイヤー',
    rarity: 5,
    attr: 'fire',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 2500,
    stats: { hp: { min: 450, max: 2410 }, atk: { min: 370, max: 2490 }, rec: { min: 23, max: 75 } },
    skill: {
      name: 'だいもんじ',
      sp: 6,
      desc: '火ドロップを交差する形に生成。',
      effects: [
        { type: 'orbChangeLine', dir: 'row', index: 2, count: 1, attr: 'fire' },
        { type: 'orbChangeLine', dir: 'col', index: 2, count: 1, attr: 'fire' }
      ]
    },
    leaderSkill: {
      name: 'れっかのまい',
      desc: '火ドロップの2コンボ以上で攻撃1.5倍。\n5色同時に消すと攻撃1.5倍。',
      effects: [
        { type: 'atk', condition: 'attrCombos', attr: 'fire', count: 2, value: 1.5 },
        { type: 'atk', condition: 'colorCount', count: 5, value: 1.5 }
      ]
    }
  },
  147: {
    id: 147,
    name: 'ミニリュウ',
    rarity: 2,
    attr: 'water',
    type: 'バランス',
    baseExp: 100,
    stats: { hp: { min: 50, max: 250 }, atk: { min: 50, max: 250 }, rec: { min: 5, max: 50 } },
    skill: {
      name: 'りゅうのいかり',
      sp: 6,
      desc: '敵全体に1,000の固定ダメージ。\n最上段の横2列を水と闇ドロップに変化。',
      effects: [
        { type: 'damageAll', value: 1000 },
        { type: 'orbChangeLine', dir: 'row', index: 0, count: 1, attr: 'water' },
        { type: 'orbChangeLine', dir: 'row', index: 1, count: 1, attr: 'dark' }
      ]
    },
    leaderSkill: { name: '水のルーン', desc: '水属性の回復力1.3倍。', effects: [ { type: 'rec', attr: 'water', value: 1.3 } ] },
    evolutions: [
      {
        to: 148,
        materials: [
          { item: 'puzzle1', count: 3 },
          { item: 'puzzle2', count: 3 },
          { item: 'puzzle3', count: 3 },
          { item: 'puzzle4', count: 3 },
          { item: 'puzzle5', count: 3 }
        ]
      }
    ]
  },
  148: {
    id: 148,
    name: 'ハクリュー',
    rarity: 3,
    attr: 'water',
    type: 'バランス',
    baseExp: 200,
    stats: { hp: { min: 100, max: 500 }, atk: { min: 100, max: 500 }, rec: { min: 20, max: 100 } },
    skill: {
      name: 'りゅうのいかり',
      sp: 6,
      desc: '敵全体に1,000の固定ダメージ。\n最上段の横2列を水と闇ドロップに変化。',
      effects: [
        { type: 'damageAll', value: 1000 },
        { type: 'orbChangeLine', dir: 'row', index: 0, count: 1, attr: 'water' },
        { type: 'orbChangeLine', dir: 'row', index: 1, count: 1, attr: 'dark' }
      ]
    },
    leaderSkill: { name: '水のルーン・中', desc: '水属性の回復力1.7倍。', effects: [ { type: 'rec', attr: 'water', value: 1.7 } ] },
    evolutions: [
      {
        to: 149,
        materials: [ { item: 'puzzle43', count: 1 }, { item: 'puzzle23', count: 1 }, { item: 'puzzle53', count: 1 } ]
      }
    ]
  },
  149: {
    id: 149,
    name: 'カイリュー',
    rarity: 5,
    attr: 'light',
    type: 'バランス',
    maxLevel: 99,
    baseExp: 3000,
    stats: { hp: { min: 660, max: 4400 }, atk: { min: 260, max: 1700 }, rec: { min: 119, max: 340 } },
    skill: {
      name: 'りゅうのはどう',
      sp: 7,
      desc: '1ターンの間、バランスタイプの攻撃が1.5倍。\n最上段の横2列を水と闇ドロップに変化。',
      effects: [
        { type: 'atkBuff', monType: 'バランス', value: 1.5, turns: 1 },
        { type: 'orbChangeLine', dir: 'row', index: 0, count: 1, attr: 'water' },
        { type: 'orbChangeLine', dir: 'row', index: 1, count: 1, attr: 'dark' }
      ]
    },
    leaderSkill: {
      name: '光のアミュレット',
      desc: '光属性の全パラメータが1.2倍。',
      effects: [
        { type: 'hp', attr: 'light', value: 1.2 },
        { type: 'atk', attr: 'light', value: 1.2 },
        { type: 'rec', attr: 'light', value: 1.2 }
      ]
    }
  },
  150: {
    id: 150,
    name: 'ミュウツー',
    rarity: 5,
    attr: 'dark',
    type: 'こうげき',
    maxLevel: 99,
    baseExp: 2500,
    stats: { hp: { min: 330, max: 3250 }, atk: { min: 220, max: 2200 }, rec: { min: 25, max: 0 } },
    skill: { name: 'チェンジ・ザ・ワールド', sp: 5, desc: '9秒間、時を止める。', effects: [ { type: 'timeStop', seconds: 9 } ] },
    leaderSkill: {
      name: 'はかいのいでんし',
      desc: 'HP10%以下で攻撃2.5倍。',
      effects: [ { type: 'atk', condition: 'hpBelow', threshold: 0.1, value: 2.5 } ]
    }
  },
  151: {
    id: 151,
    name: 'ミュウ',
    rarity: 5,
    attr: 'dark',
    type: 'バランス',
    maxLevel: 99,
    baseExp: 5000,
    stats: { hp: { min: 1500, max: 3000 }, atk: { min: 750, max: 1500 }, rec: { min: 50, max: 250 } },
    skill: { name: 'オールエンハンス', sp: 4, desc: '1ターンの間、全属性の攻撃が1.2倍。', effects: [ { type: 'atkBuff', value: 1.2, turns: 1 } ] },
    leaderSkill: {
      name: 'バランスのアミュレット',
      desc: 'バランスタイプの全パラメータが1.2倍。',
      effects: [ { type: 'allStat', condition: 'type', attr: 'バランス', value: 1.2 } ]
    }
  }
};

Object.values(MONSTER_DATA).forEach(m => { if (m.baseExp === undefined) m.baseExp = 100; });
