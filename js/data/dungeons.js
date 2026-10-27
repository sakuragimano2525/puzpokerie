// ============================================================
// ダンジョンデータ定義（ダンジョン設定ツールで出力）
//
//   敵のアイテムドロップは、敵データに drops を書く:
//     drops: [ { item: 'puzzle1', rate: 0.3, count: 1 } ]
//       item  : ITEM_DATA のキー（js/data/items.js）
//       rate  : ドロップ率 0〜1（省略すると 1 = 100%）
//       count : 個数。数字 または [最小, 最大]（省略すると 1）
//   おふだのドロップは、敵データに ofudaDrop を書く（チップ／モンスターのドロップとは別に、独立して抽選。書かなければドロップなし）:
//     ofudaDrop: { enabled: true, item: 'ohuda1', rate: 0.2, count: 1 }
//       item  : 'youbi'（ようびのおふだ）／ 'ohuda1'（けいけんちのおふだ）。ITEM_DATA の kind:'ofuda' のもの
//       rate  : ドロップ率 0〜1 ／ count : 個数。数字 または [最小, 最大]
//   ※ チップは敵の属性と同じ属性のものを設定すること。
//   ※ 敵の先制行動は actions に condition:'battle_start' で入る（複数可。上から順に連続発動）。
//   敵スキル（skills）の追加分:
//     { type:'damage_ratio', basis:'current'|'max', rate:50, survive:true }   割合ダメージ（軽減無視。rate は%）
//     { type:'bind', target:'all', turnMin:2, turnMax:2 }                      全員を2ターンバインド
//     { type:'bind', target:'attr', attr:'fire', turnMin:1, turnMax:3 }        火属性を1〜3ターンバインド
//     { type:'bind', target:'random', countMin:1, countMax:3, turnMin:2, turnMax:2 }  ランダム1〜3体を2ターンバインド
//     { type:'atk_down', target:'attr'|'all', attr:'fire', rate:50, turn:2 }   火属性の攻撃力を2ターン50%ダウン（allなら全員）
//     { type:'time_reduce', seconds:2, turn:2 }                                 操作時間を2秒短縮（2ターン）
//     { type:'rec_down', value:0, turn:2 }                                      回復力ダウン（0=回復できない／0.5=半分）
//     { type:'action_change', interval:1 }                                     行動変化（この後の行動間隔を1ターンにする。change.mp3＋オーラ演出）
//     { type:'skill_seal', turn:2 }                                             スキル使用不可（チーム全員のスキルが2ターン使えない。アイコンは S❌）
//     { type:'no_fall', turn:2 }                                                落ちコンなし（2ターンの間、消しても新しいドロップが降ってこない。消し終わってから補充）
//     { type:'super_gut', rate:50 }                                             超根性（最大HPの50%で必ず耐える。倒せるダメージを受けても50%で止まり、発動すると消滅。ターンは無限。アイコンは tc.png）
//     { type:'roulette', count:3, turn:3, sec:2 }                               ルーレット（盤面のランダムなマスに3個・3ターン。sec秒(2/1/0.5/0.2)で針が1周するたびに、そのマスのドロップが 火→水→木→光→闇→回復→火… と変化）
//     { type:'board_change', pattern:'row'|'col', to:'dark', pos:'random'|'1'〜'6', lines:1 }  横列／縦列を〇ドロップに変化（posは横=上から1〜5・縦=左から1〜6、linesは本数）
//     { type:'attr_guard', attr:'random'|'fire'〜'dark', rate:50, turn:3 }      属性軽減（attr:'random' は火〜闇から1つを発動のたびに抽選）
//     { type:'flee' }                                                           にげる（バトルから逃げて倒した扱い。経験値・エナ・チップ・卵は絶対に落とさない）
//     ※ プレイヤーの エンハンス / 回復力スキル / 操作時間スキル を使うと、同じ種類の敵のダウンは上書きされて消えます。
//     ※ 旧形式 { type:'bind', target:'random', turn:2 } もそのまま動きます。
//   盤面ドロップ条件の行動（orb は fire/water/wood/light/dark/heal/poison）:
//     { condition:'orb_has',  orb:'poison', weight:50, skills:[…] }   盤面に毒ドロップがある場合（行動パターンの一員。ある時だけ候補に入る）
//     { condition:'orb_none', orb:'heal',   skills:[…] }              盤面に回復ドロップがない場合、以下を順に使用（通常の行動より優先。複数あれば上から順）
//     ※ 判定は敵が行動を選ぶ瞬間の盤面。落ちコンなし中は、補充の前（消して詰めただけ）の盤面で判定します（補充で降ってきたドロップは数えない）。
//   モンスタードロップ: monsterDrop: { enabled: true, rate: 0.1, monsterId: 25 }
//     monsterId を省略すると、敵画像（mpXX.png）と同じIDのモンスターが落ちる。
//   ランダムバトル: random: { floors: 3, monsters: { m1:{敵データ}, m2:{...} },
//                     patterns: [ { weight: 30, enemies: ['m1','m2','m2'] }, { weight: 70, enemies: ['m1','m1'] } ] }
//     floors 回ぶん、階層ごとに weight で patterns から抽選して並べ、そのあとに battles（ボス等・固定）が続く。
//   【全属性必須】: requireAllAttr: true   火・水・木・光・闇の5属性が、パーティーに1匹以上いないと入れない（書かなければ制限なし）。ステージ選択でステージ名の上に表示される
//   乱入モンスター: intrusion: { rate: 20, monsters: [ {敵データ}, {敵データ} ] }
//     ダンジョンに入った時に1回だけ rate(%) で抽選。当たると monsters に登録した全員が乱入する。
//     乱入モンスターは、同じサイズ(S/M/L/XL)の「ボス以外」の敵とランダムに入れ替わる（バラバラ／同じバトルはランダム）。
// ============================================================
// ============================================================
// ★ ダンジョンBGM（道中 / ボス）★
//   field : 道中のBGM / boss : ボス戦のBGM（省略すると field と同じ）
//   ボス戦 = 敵に isBoss:true がいるバトル、またはそのダンジョンの最終バトル。
// ============================================================
const DUNGEON_BGM = {
  "1-1": {"field":"b1.mp3","boss":"boss1.mp3"},
  "1-2": {"field":"b1.mp3","boss":"boss1.mp3"},
  "1-boss": {"field":"b1.mp3","boss":"boss2.mp3"},
  "2-1": {"field":"b1.mp3","boss":"boss3.mp3"},
  "2-2": {"field":"b1.mp3","boss":"boss3.mp3"},
  "2-3": {"field":"b1.mp3","boss":"boss3.mp3"},
  "2-4": {"field":"b1.mp3","boss":"boss3.mp3"},
  "2-boss": {"field":"b1.mp3","boss":"boss2.mp3"},
  "3-1": {"field":"b2.mp3","boss":"boss1.mp3"},
  "3-2": {"field":"b2.mp3","boss":"boss3.mp3"},
  "3-3": {"field":"b2.mp3","boss":"boss3.mp3"},
  "3-4": {"field":"b2.mp3","boss":"boss3.mp3"},
  "3-boss": {"field":"b2.mp3","boss":"boss2.mp3"},
  "4-1": {"field":"b3.mp3","boss":"boss3.mp3"},
  "4-2": {"field":"b3.mp3","boss":"boss3.mp3"},
  "4-3": {"field":"b3.mp3","boss":"boss3.mp3"},
  "4-4": {"field":"b3.mp3","boss":"boss3.mp3"},
  "4-boss": {"field":"b3.mp3","boss":"boss2.mp3"},
  "5-1": {"field":"b4.mp3","boss":"boss1.mp3"},
  "5-2": {"field":"b4.mp3","boss":"boss3.mp3"},
  "5-3": {"field":"b4.mp3","boss":"boss3.mp3"},
  "5-4": {"field":"b4.mp3","boss":"boss3.mp3"},
  "5-boss": {"field":"b4.mp3","boss":"boss2.mp3"},
  "6-1": {"field":"b5.mp3","boss":"boss3.mp3"},
  "6-2": {"field":"b5.mp3","boss":"boss3.mp3"},
  "6-3": {"field":"b5.mp3","boss":"boss3.mp3"},
  "6-4": {"field":"b5.mp3","boss":"boss3.mp3"},
  "6-boss": {"field":"b5.mp3","boss":"boss2A.mp3"},
  "keiken-1": {"field":"b1.mp3","boss":"boss1.mp3"},
  "7-1": {"field":"b8.mp3","boss":"boss3.mp3"},
  "7-2": {"field":"b8.mp3","boss":"boss3.mp3"},
  "7-3": {"field":"b8.mp3","boss":"boss3.mp3"},
  "7-4": {"field":"b8.mp3","boss":"boss3.mp3"},
  "7-boss": {"field":"b8.mp3","boss":"boss4.mp3"},
  "8-1": {"field":"b6.mp3","boss":"boss3.mp3"},
  "8-2": {"field":"b6.mp3","boss":"boss3.mp3"},
  "8-3": {"field":"b6.mp3","boss":"boss3.mp3"},
  "8-4": {"field":"b6.mp3","boss":"boss3.mp3"},
  "8-boss": {"field":"b6.mp3","boss":"boss2.mp3"},
  "9-1": {"field":"b7.mp3","boss":"boss1.mp3"},
  "9-2": {"field":"b7.mp3","boss":"boss3.mp3"},
  "9-3": {"field":"b7.mp3","boss":"boss3.mp3"},
  "9-4": {"field":"b7.mp3","boss":"boss3.mp3"},
  "9-boss": {"field":"b7.mp3","boss":"boss2.mp3"},
  "10-1": {"field":"b2.mp3","boss":"boss1.mp3"},
  "10-2": {"field":"b2.mp3","boss":"boss1.mp3"},
  "10-3": {"field":"b2.mp3","boss":"boss5.mp3"},
  "10-4": {"field":"b2.mp3","boss":"boss3.mp3"},
  "10-boss": {"field":"b2.mp3","boss":"boss2.mp3"},
  "11-1": {"field":"b6.mp3","boss":"boss3.mp3"},
  "11-2": {"field":"b6.mp3","boss":"boss3.mp3"},
  "11-3": {"field":"b6.mp3","boss":"boss3.mp3"},
  "11-4": {"field":"b6.mp3","boss":"boss5.mp3"},
  "11-boss": {"field":"b6.mp3","boss":"boss4.mp3"},
  "12-1": {"field":"b7.mp3","boss":"boss3.mp3"},
  "12-2": {"field":"b7.mp3","boss":"boss3.mp3"},
  "12-3": {"field":"b7.mp3","boss":"boss3.mp3"},
  "12-4": {"field":"b7.mp3","boss":"boss3.mp3"},
  "12-boss": {"field":"b7.mp3","boss":"boss4.mp3"},
  "daily_tue-1": {"field":"b3.mp3","boss":"boss3.mp3"},
  "daily_wed-1": {"field":"b2.mp3","boss":"boss3.mp3"},
  "daily_sun-1": {"field":"b7.mp3","boss":"boss3.mp3"},
  "daily_sun-2": {"field":"b7.mp3","boss":"boss3.mp3"},
  "daily_sat-1": {"field":"b7.mp3","boss":"boss3.mp3"},
  "daily_sat-2": {"field":"b7.mp3","boss":"boss3.mp3"},
  "daily_mon-1": {"field":"b4.mp3","boss":"boss3.mp3"},
  "daily_mon-2": {"field":"b4.mp3","boss":"boss3.mp3"},
  "13-1": {"field":"b3.mp3","boss":"boss3.mp3"},
  "13-2": {"field":"b3.mp3","boss":"boss3.mp3"},
  "13-3": {"field":"b3.mp3","boss":"boss5.mp3"},
  "13-4": {"field":"b3.mp3","boss":"boss3.mp3"},
  "13-boss": {"field":"b3.mp3","boss":"boss4.mp3"},
  "14-1": {"field":"b8.mp3","boss":"boss3.mp3"},
  "14-2": {"field":"b8.mp3","boss":"boss3.mp3"},
  "14-3": {"field":"b8.mp3","boss":"boss3.mp3"},
  "14-4": {"field":"b8.mp3","boss":"boss3.mp3"},
  "14-5": {"field":"b8.mp3","boss":"boss3.mp3"},
  "14-boss": {"field":"b9.mp3","boss":"boss6.mp3"},
  "daily_tue-2": {"field":"b3.mp3","boss":"boss3.mp3"},
  "daily_wed-2": {"field":"b2.mp3","boss":"boss3.mp3"},
  "daily_thu-1": {"field":"b1.mp3","boss":"boss3.mp3"},
  "daily_thu-2": {"field":"b1.mp3","boss":"boss3.mp3"},
  "daily_fri-1": {"field":"b5.mp3","boss":"boss3.mp3"},
  "daily_fri-2": {"field":"b5.mp3","boss":"boss3.mp3"},
  "15-boss": {"field":"b9.mp3","boss":"boss_mewtwo.mp3"},
  "keiken-2": {"field":"b1.mp3","boss":"boss1.mp3"}
};

const DUNGEON_DATA = {
  "1-1": {
    "bgImg": "dungeon1.png",
    "bgm": "b1.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "キャタピー",
            "img": "mp10.png",
            "attr": "wood",
            "hp": 500,
            "atk": 50,
            "def": 50,
            "turnInterval": 2,
            "size": "S",
            "exp": 5,
            "coin": 5,
            "drops": [],
            "actions": [
              {
                "name": "",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              }
            ],
            "monsterDrop": {
              "enabled": false
            }
          }
        ]
      },
      {
        "enemies": [
          {
            "name": "ビードル",
            "img": "mp13.png",
            "attr": "wood",
            "hp": 500,
            "atk": 30,
            "def": 50,
            "turnInterval": 1,
            "size": "S",
            "exp": 5,
            "coin": 5,
            "drops": [],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              }
            ],
            "monsterDrop": {
              "enabled": false
            }
          }
        ]
      },
      {
        "enemies": [
          {
            "name": "フシギダネ",
            "img": "mp1.png",
            "attr": "wood",
            "hp": 1000,
            "atk": 70,
            "def": 0,
            "isBoss": true,
            "turnInterval": 2,
            "size": "M",
            "exp": 10,
            "coin": 5,
            "drops": [],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 60,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "つるのムチ",
                "condition": "normal",
                "weight": 40,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "wood",
                    "count": 5
                  }
                ]
              }
            ],
            "monsterDrop": {
              "enabled": false
            }
          }
        ]
      }
    ]
  },
  "1-2": {
    "bgImg": "dungeon1.png",
    "bgm": "b1.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ポッポ",
            "img": "mp16.png",
            "attr": "light",
            "hp": 600,
            "atk": 50,
            "def": 0,
            "turnInterval": 2,
            "size": "S",
            "exp": 10,
            "coin": 5,
            "drops": [],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "みだれひっかき",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage",
                    "value": 22,
                    "repeat": 4
                  }
                ]
              }
            ],
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            }
          }
        ]
      },
      {
        "enemies": [
          {
            "name": "オニスズメ",
            "img": "mp21.png",
            "attr": "fire",
            "hp": 650,
            "atk": 28,
            "def": 30,
            "turnInterval": 1,
            "size": "S",
            "exp": 10,
            "coin": 5,
            "drops": [],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              }
            ],
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            }
          }
        ]
      },
      {
        "enemies": [
          {
            "name": "アーボ",
            "img": "mp23.png",
            "attr": "dark",
            "hp": 750,
            "atk": 33,
            "def": 0,
            "turnInterval": 1,
            "size": "S",
            "exp": 10,
            "coin": 5,
            "drops": [],
            "actions": [
              {
                "name": "スモッグ",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "dark",
                    "count": 3
                  }
                ]
              }
            ],
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "isBoss": true
          }
        ]
      }
    ]
  },
  "1-boss": {
    "bgImg": "dungeon1.png",
    "bgm": "b1.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "キャタピー",
            "img": "mp10.png",
            "attr": "wood",
            "hp": 600,
            "atk": 60,
            "def": 200,
            "turnInterval": 2,
            "size": "S",
            "exp": 10,
            "coin": 5,
            "drops": [
              {
                "item": "puzzle3",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              }
            ],
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            }
          }
        ]
      },
      {
        "enemies": [
          {
            "name": "ビードル",
            "img": "mp13.png",
            "attr": "wood",
            "hp": 1200,
            "atk": 172,
            "def": 50,
            "turnInterval": 2,
            "size": "S",
            "exp": 10,
            "coin": 5,
            "drops": [
              {
                "item": "puzzle3",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              }
            ],
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            }
          }
        ]
      },
      {
        "enemies": [
          {
            "name": "ピカチュウ",
            "img": "mp25.png",
            "attr": "light",
            "hp": 2500,
            "atk": 60,
            "def": 0,
            "turnInterval": 2,
            "size": "M",
            "exp": 25,
            "coin": 10,
            "drops": [
              {
                "item": "puzzle4",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "でんきショック",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "light",
                    "count": 5
                  }
                ],
                "hpBelow": 50
              }
            ],
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "isBoss": true
          }
        ]
      }
    ]
  },
  "2-1": {
    "bgImg": "dungeon2.png",
    "bgm": "b1.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ナゾノクサ",
            "img": "mp43.png",
            "attr": "wood",
            "hp": 2000,
            "atk": 190,
            "def": 100,
            "turnInterval": 3,
            "size": "M",
            "exp": 5,
            "coin": 10,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle3",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 70,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 30,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "combo_absorb",
                    "turn": 1,
                    "combo": 4
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "キャタピー",
          "img": "mp10.png",
          "attr": "wood",
          "hp": 800,
          "atk": 77,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.1
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.1,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "パラス",
          "img": "mp46.png",
          "attr": "wood",
          "hp": 1008,
          "atk": 102,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "ビードル",
          "img": "mp13.png",
          "attr": "wood",
          "hp": 880,
          "atk": 65,
          "def": 100,
          "turnInterval": 1,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m1"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m2",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m3",
            "m1"
          ]
        }
      ]
    }
  },
  "2-2": {
    "bgImg": "dungeon2.png",
    "bgm": "b1.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "オニスズメ",
            "img": "mp21.png",
            "attr": "fire",
            "hp": 1600,
            "atk": 80,
            "def": 200,
            "turnInterval": 1,
            "size": "M",
            "exp": 5,
            "coin": 10,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle1",
                "rate": 0.1,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 70,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "かぜおこし",
                "condition": "normal",
                "weight": 30,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.1
                  },
                  {
                    "type": "board_change",
                    "pattern": "5color_heal"
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "キャタピー",
          "img": "mp10.png",
          "attr": "wood",
          "hp": 800,
          "atk": 77,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.1
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.1,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "パラス",
          "img": "mp46.png",
          "attr": "wood",
          "hp": 1108,
          "atk": 102,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "ビードル",
          "img": "mp13.png",
          "attr": "wood",
          "hp": 880,
          "atk": 65,
          "def": 100,
          "turnInterval": 1,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "ナゾノクサ",
          "img": "mp43.png",
          "attr": "wood",
          "hp": 1400,
          "atk": 200,
          "def": 80,
          "turnInterval": 3,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "マジカルリーフ",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "combo_absorb",
                  "turn": 1,
                  "combo": 4
                }
              ]
            }
          ],
          "isBoss": false
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m1"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m2",
            "m2",
            "m4"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m1"
          ]
        }
      ]
    }
  },
  "2-3": {
    "bgImg": "dungeon2.png",
    "bgm": "b1.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ピカチュウ",
            "img": "mp25.png",
            "attr": "light",
            "hp": 1100,
            "atk": 60,
            "def": 80,
            "turnInterval": 2,
            "size": "M",
            "exp": 5,
            "coin": 5,
            "drops": [
              {
                "item": "puzzle4",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "でんきショック",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "light",
                    "count": 5
                  }
                ],
                "hpBelow": 50
              }
            ],
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "isBoss": true
          },
          {
            "name": "ピカチュウ",
            "img": "mp25.png",
            "attr": "light",
            "hp": 1100,
            "atk": 77,
            "def": 80,
            "turnInterval": 2,
            "size": "M",
            "exp": 5,
            "coin": 5,
            "drops": [
              {
                "item": "puzzle4",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              }
            ],
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "キャタピー",
          "img": "mp10.png",
          "attr": "wood",
          "hp": 800,
          "atk": 77,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.1
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.1,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "パラス",
          "img": "mp46.png",
          "attr": "wood",
          "hp": 1108,
          "atk": 102,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "ビードル",
          "img": "mp13.png",
          "attr": "wood",
          "hp": 880,
          "atk": 65,
          "def": 100,
          "turnInterval": 1,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "ナゾノクサ",
          "img": "mp43.png",
          "attr": "wood",
          "hp": 1400,
          "atk": 200,
          "def": 80,
          "turnInterval": 3,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "マジカルリーフ",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "combo_absorb",
                  "turn": 1,
                  "combo": 4
                }
              ]
            }
          ],
          "isBoss": false
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m1"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m2",
            "m2",
            "m4"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m1"
          ]
        }
      ]
    }
  },
  "2-4": {
    "bgImg": "dungeon2.png",
    "bgm": "b1.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "マダツボミ",
            "img": "mp69.png",
            "attr": "wood",
            "hp": 3500,
            "atk": 50,
            "def": 100,
            "turnInterval": 2,
            "size": "M",
            "exp": 10,
            "coin": 5,
            "drops": [
              {
                "item": "puzzle3",
                "rate": 0.1,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "つるのムチ",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "damage",
                    "value": 99,
                    "repeat": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "random_to",
                    "to": "wood"
                  }
                ]
              }
            ],
            "monsterDrop": {
              "enabled": true,
              "rate": 0.1
            },
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "キャタピー",
          "img": "mp10.png",
          "attr": "wood",
          "hp": 800,
          "atk": 77,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.1
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.1,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "パラス",
          "img": "mp46.png",
          "attr": "wood",
          "hp": 1108,
          "atk": 102,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "ビードル",
          "img": "mp13.png",
          "attr": "wood",
          "hp": 880,
          "atk": 65,
          "def": 100,
          "turnInterval": 1,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "ナゾノクサ",
          "img": "mp43.png",
          "attr": "wood",
          "hp": 1400,
          "atk": 200,
          "def": 80,
          "turnInterval": 3,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "マジカルリーフ",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "combo_absorb",
                  "turn": 1,
                  "combo": 4
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m5": {
          "name": "ポッポ",
          "img": "mp16.png",
          "attr": "light",
          "hp": 700,
          "atk": 50,
          "def": 90,
          "turnInterval": 2,
          "size": "S",
          "exp": 10,
          "coin": 5,
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          }
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m1"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m2",
            "m2",
            "m4"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m5",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m5"
          ]
        }
      ]
    }
  },
  "2-boss": {
    "bgImg": "dungeon2.png",
    "bgm": "b1.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ストライク",
            "img": "mp123.png",
            "attr": "wood",
            "hp": 10000,
            "atk": 100,
            "def": 250,
            "turnInterval": 2,
            "size": "XL",
            "exp": 150,
            "coin": 5,
            "drops": [
              {
                "item": "puzzle32",
                "rate": 0.1,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 70,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "カマできる",
                "condition": "normal",
                "weight": 30,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "attack_buff",
                    "rate": 1.25,
                    "turn": 2
                  }
                ]
              },
              {
                "name": "れんぞくぎり",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "damage",
                    "value": 41,
                    "repeat": 4
                  }
                ]
              }
            ],
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "キャタピー",
          "img": "mp10.png",
          "attr": "wood",
          "hp": 800,
          "atk": 77,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.1
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.1,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "パラス",
          "img": "mp46.png",
          "attr": "wood",
          "hp": 1108,
          "atk": 102,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "ビードル",
          "img": "mp13.png",
          "attr": "wood",
          "hp": 880,
          "atk": 65,
          "def": 100,
          "turnInterval": 1,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "ナゾノクサ",
          "img": "mp43.png",
          "attr": "wood",
          "hp": 1400,
          "atk": 200,
          "def": 80,
          "turnInterval": 3,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "マジカルリーフ",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "combo_absorb",
                  "turn": 1,
                  "combo": 4
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m5": {
          "name": "ポッポ",
          "img": "mp16.png",
          "attr": "light",
          "hp": 700,
          "atk": 50,
          "def": 90,
          "turnInterval": 2,
          "size": "S",
          "exp": 10,
          "coin": 5,
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          }
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m1"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m2",
            "m2",
            "m4"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m5",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m5"
          ]
        }
      ]
    }
  },
  "3-1": {
    "bgImg": "dungeon3.png",
    "bgm": "b2.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "クラブ",
            "img": "mp98.png",
            "attr": "water",
            "hp": 4144,
            "atk": 41,
            "def": 6,
            "turnInterval": 1,
            "size": "M",
            "exp": 5,
            "coin": 10,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle2",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 70,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "クラブハンマー",
                "condition": "normal",
                "weight": 30,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "time_reduce",
                    "seconds": 2,
                    "turn": 1
                  }
                ]
              },
              {
                "name": "アクアジェット",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.2
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "コラッタ",
          "img": "mp19.png",
          "attr": "light",
          "hp": 722,
          "atk": 79,
          "def": 18,
          "turnInterval": 2,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.1
          },
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "ヤドン",
          "img": "mp79.png",
          "attr": "water",
          "hp": 1001,
          "atk": 102,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "コダック",
          "img": "mp54.png",
          "attr": "water",
          "hp": 780,
          "atk": 51,
          "def": 60,
          "turnInterval": 1,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m1"
          ]
        }
      ]
    }
  },
  "3-2": {
    "bgImg": "dungeon3.png",
    "bgm": "b2.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "トサキント",
            "img": "mp118.png",
            "attr": "water",
            "hp": 4944,
            "atk": 51,
            "def": 6,
            "turnInterval": 1,
            "size": "S",
            "exp": 5,
            "coin": 10,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle2",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 70,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "マリンドロップ",
                "condition": "normal",
                "weight": 30,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.3
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "water",
                    "count": 4
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "コラッタ",
          "img": "mp19.png",
          "attr": "light",
          "hp": 722,
          "atk": 79,
          "def": 18,
          "turnInterval": 2,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.1
          },
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "ヤドン",
          "img": "mp79.png",
          "attr": "water",
          "hp": 1001,
          "atk": 102,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "コダック",
          "img": "mp54.png",
          "attr": "water",
          "hp": 780,
          "atk": 51,
          "def": 60,
          "turnInterval": 1,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "クラブ",
          "img": "mp98.png",
          "attr": "water",
          "hp": 844,
          "atk": 39,
          "def": 46,
          "turnInterval": 1,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "クラブハンマー",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "time_reduce",
                  "seconds": 2,
                  "turn": 1
                }
              ]
            }
          ],
          "isBoss": false
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m4"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m4",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m2",
            "m4"
          ]
        }
      ]
    }
  },
  "3-3": {
    "bgImg": "dungeon3.png",
    "bgm": "b2.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "トサキント",
            "img": "mp118.png",
            "attr": "water",
            "hp": 944,
            "atk": 31,
            "def": 6,
            "turnInterval": 1,
            "size": "S",
            "exp": 5,
            "coin": 10,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle2",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 70,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "マリンドロップ",
                "condition": "normal",
                "weight": 30,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.3
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "water",
                    "count": 4
                  }
                ]
              }
            ],
            "isBoss": true
          },
          {
            "name": "ヒトデマン",
            "img": "mp120.png",
            "attr": "water",
            "hp": 3500,
            "atk": 78,
            "def": 100,
            "turnInterval": 2,
            "size": "M",
            "exp": 5,
            "coin": 10,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle2",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 70,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "ねんりき",
                "condition": "normal",
                "weight": 30,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.3
                  },
                  {
                    "type": "combo_absorb",
                    "turn": 1,
                    "combo": 5
                  }
                ]
              },
              {
                "name": "あやしいひかり",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "bind",
                    "target": "random",
                    "countMin": 1,
                    "countMax": 2,
                    "turnMin": 2,
                    "turnMax": 3
                  }
                ]
              }
            ],
            "isBoss": true
          },
          {
            "name": "トサキント",
            "img": "mp118.png",
            "attr": "water",
            "hp": 944,
            "atk": 31,
            "def": 6,
            "turnInterval": 1,
            "size": "S",
            "exp": 5,
            "coin": 10,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle2",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 70,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "マリンドロップ",
                "condition": "normal",
                "weight": 30,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.3
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "water",
                    "count": 4
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "コラッタ",
          "img": "mp19.png",
          "attr": "light",
          "hp": 722,
          "atk": 79,
          "def": 18,
          "turnInterval": 2,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.1
          },
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "ヤドン",
          "img": "mp79.png",
          "attr": "water",
          "hp": 1001,
          "atk": 102,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "コダック",
          "img": "mp54.png",
          "attr": "water",
          "hp": 780,
          "atk": 51,
          "def": 60,
          "turnInterval": 1,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "クラブ",
          "img": "mp98.png",
          "attr": "water",
          "hp": 844,
          "atk": 39,
          "def": 46,
          "turnInterval": 1,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "クラブハンマー",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "time_reduce",
                  "seconds": 2,
                  "turn": 1
                }
              ]
            }
          ],
          "isBoss": false
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m4"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m4",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m2",
            "m4"
          ]
        }
      ]
    }
  },
  "3-4": {
    "bgImg": "dungeon3.png",
    "bgm": "b2.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "シェルダー",
            "img": "mp90.png",
            "attr": "water",
            "hp": 3500,
            "atk": 78,
            "def": 350,
            "turnInterval": 2,
            "size": "M",
            "exp": 5,
            "coin": 10,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle2",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 70,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "とげキャノン",
                "condition": "normal",
                "weight": 30,
                "once": false,
                "skills": [
                  {
                    "type": "damage",
                    "value": 46,
                    "repeat": 4
                  }
                ]
              },
              {
                "name": "からではさむ",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "damage_ratio",
                    "basis": "current",
                    "rate": 33
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "コラッタ",
          "img": "mp19.png",
          "attr": "light",
          "hp": 722,
          "atk": 79,
          "def": 18,
          "turnInterval": 2,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.1
          },
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "ヤドン",
          "img": "mp79.png",
          "attr": "water",
          "hp": 1001,
          "atk": 102,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "コダック",
          "img": "mp54.png",
          "attr": "water",
          "hp": 780,
          "atk": 51,
          "def": 60,
          "turnInterval": 1,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "クラブ",
          "img": "mp98.png",
          "attr": "water",
          "hp": 844,
          "atk": 39,
          "def": 46,
          "turnInterval": 1,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "クラブハンマー",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "time_reduce",
                  "seconds": 2,
                  "turn": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m5": {
          "name": "トサキント",
          "img": "mp118.png",
          "attr": "water",
          "hp": 944,
          "atk": 31,
          "def": 6,
          "turnInterval": 1,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "マリンドロップ",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.3
                },
                {
                  "type": "board_change",
                  "pattern": "spawn",
                  "to": "water",
                  "count": 4
                }
              ]
            }
          ],
          "isBoss": false
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m5",
            "m4",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m4",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m2",
            "m4"
          ]
        }
      ]
    }
  },
  "3-boss": {
    "bgImg": "dungeon3.png",
    "bgm": "b2.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ラプラス",
            "img": "mp131.png",
            "attr": "water",
            "hp": 20000,
            "atk": 269,
            "def": 100,
            "turnInterval": 2,
            "size": "XL",
            "exp": 250,
            "coin": 20,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle22",
                "rate": 0.1,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "オーロラビーム",
                "condition": "normal",
                "weight": 30,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "atk_down",
                    "target": "all",
                    "rate": 25,
                    "turn": 2
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "うたう",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "bind",
                    "target": "attr",
                    "attr": "wood",
                    "turnMin": 2,
                    "turnMax": 2
                  }
                ]
              },
              {
                "name": "のしかかり",
                "condition": "normal",
                "weight": 30,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "convert",
                    "from": "wood",
                    "to": "fire"
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "アクアブレイク",
                "condition": "normal",
                "weight": 40,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.2
                  }
                ],
                "hpBelow": 50
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "ヒトデマン",
          "img": "mp120.png",
          "attr": "water",
          "hp": 922,
          "atk": 78,
          "def": 38,
          "turnInterval": 2,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "ねんりき",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.3
                },
                {
                  "type": "combo_absorb",
                  "turn": 1,
                  "combo": 5
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "ヤドン",
          "img": "mp79.png",
          "attr": "water",
          "hp": 1001,
          "atk": 102,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "コダック",
          "img": "mp54.png",
          "attr": "water",
          "hp": 780,
          "atk": 51,
          "def": 60,
          "turnInterval": 1,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "クラブ",
          "img": "mp98.png",
          "attr": "water",
          "hp": 844,
          "atk": 39,
          "def": 46,
          "turnInterval": 1,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "クラブハンマー",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "time_reduce",
                  "seconds": 2,
                  "turn": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m5": {
          "name": "トサキント",
          "img": "mp118.png",
          "attr": "water",
          "hp": 944,
          "atk": 31,
          "def": 6,
          "turnInterval": 1,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "マリンドロップ",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.3
                },
                {
                  "type": "board_change",
                  "pattern": "spawn",
                  "to": "water",
                  "count": 4
                }
              ]
            }
          ],
          "isBoss": false
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m5",
            "m4",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m4",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m2",
            "m4",
            "m2"
          ]
        }
      ]
    }
  },
  "4-1": {
    "bgImg": "dungeon4.png",
    "bgm": "b3.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ポニータ",
            "img": "mp77.png",
            "attr": "fire",
            "hp": 6000,
            "atk": 69,
            "def": 250,
            "turnInterval": 1,
            "size": "M",
            "exp": 10,
            "coin": 15,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_1",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "いかり",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "attack_buff",
                    "rate": 2,
                    "turn": -1
                  }
                ]
              },
              {
                "name": "でんこうせっか",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.2
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "オニスズメ",
          "img": "mp21.png",
          "attr": "fire",
          "hp": 922,
          "atk": 82,
          "def": 48,
          "turnInterval": 2,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "ロコン",
          "img": "mp37.png",
          "attr": "fire",
          "hp": 1001,
          "atk": 62,
          "def": 90,
          "turnInterval": 1,
          "size": "S",
          "exp": 8,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "マンキー",
          "img": "mp56.png",
          "attr": "fire",
          "hp": 980,
          "atk": 72,
          "def": 60,
          "turnInterval": 1,
          "size": "S",
          "exp": 8,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "グロウパンチ",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "attack_buff",
                  "rate": 1.3,
                  "turn": 2
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m1"
          ]
        }
      ]
    }
  },
  "4-2": {
    "bgImg": "dungeon4.png",
    "bgm": "b3.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ガーディ",
            "img": "mp58.png",
            "attr": "fire",
            "hp": 7100,
            "atk": 76,
            "def": 40,
            "turnInterval": 1,
            "size": "M",
            "exp": 10,
            "coin": 15,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_1",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "かみなりのキバ",
                "condition": "normal",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.3
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "light",
                    "count": 5
                  }
                ],
                "hpBelow": 50,
                "weight": 50
              },
              {
                "name": "かみつく",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.2
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "オニスズメ",
          "img": "mp21.png",
          "attr": "fire",
          "hp": 922,
          "atk": 82,
          "def": 48,
          "turnInterval": 2,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "ロコン",
          "img": "mp37.png",
          "attr": "fire",
          "hp": 1001,
          "atk": 62,
          "def": 90,
          "turnInterval": 1,
          "size": "S",
          "exp": 8,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "マンキー",
          "img": "mp56.png",
          "attr": "fire",
          "hp": 980,
          "atk": 72,
          "def": 60,
          "turnInterval": 1,
          "size": "S",
          "exp": 8,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "グロウパンチ",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "attack_buff",
                  "rate": 1.3,
                  "turn": 2
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "ポニータ",
          "img": "mp77.png",
          "attr": "fire",
          "hp": 800,
          "atk": 69,
          "def": 200,
          "turnInterval": 1,
          "size": "M",
          "exp": 8,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "いかり",
              "condition": "hp<=50%",
              "once": true,
              "skills": [
                {
                  "type": "attack_buff",
                  "rate": 2,
                  "turn": -1
                }
              ]
            }
          ],
          "isBoss": false
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m4"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m2",
            "m4",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m4"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m1"
          ]
        }
      ]
    }
  },
  "4-3": {
    "bgImg": "dungeon4.png",
    "bgm": "b3.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ワンリキー",
            "img": "mp66.png",
            "attr": "fire",
            "hp": 3500,
            "atk": 56,
            "def": 60,
            "turnInterval": 1,
            "size": "M",
            "exp": 10,
            "coin": 15,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_1",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "グロウパンチ",
                "condition": "normal",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "attack_buff",
                    "rate": 1.5,
                    "turn": 2
                  }
                ],
                "hpBelow": 50,
                "weight": 50
              }
            ],
            "isBoss": true
          },
          {
            "name": "ワンリキー",
            "img": "mp66.png",
            "attr": "fire",
            "hp": 3500,
            "atk": 56,
            "def": 60,
            "turnInterval": 1,
            "size": "M",
            "exp": 10,
            "coin": 15,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_1",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "グロウパンチ",
                "condition": "normal",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "attack_buff",
                    "rate": 1.5,
                    "turn": 2
                  }
                ],
                "hpBelow": 50,
                "weight": 50
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "オニスズメ",
          "img": "mp21.png",
          "attr": "fire",
          "hp": 922,
          "atk": 82,
          "def": 48,
          "turnInterval": 2,
          "size": "S",
          "exp": 5,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "ロコン",
          "img": "mp37.png",
          "attr": "fire",
          "hp": 1001,
          "atk": 62,
          "def": 90,
          "turnInterval": 1,
          "size": "S",
          "exp": 8,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "マンキー",
          "img": "mp56.png",
          "attr": "fire",
          "hp": 980,
          "atk": 72,
          "def": 60,
          "turnInterval": 1,
          "size": "S",
          "exp": 8,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "グロウパンチ",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "attack_buff",
                  "rate": 1.3,
                  "turn": 2
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "ポニータ",
          "img": "mp77.png",
          "attr": "fire",
          "hp": 800,
          "atk": 69,
          "def": 200,
          "turnInterval": 1,
          "size": "M",
          "exp": 8,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "いかり",
              "condition": "hp<=50%",
              "once": true,
              "skills": [
                {
                  "type": "attack_buff",
                  "rate": 2,
                  "turn": -1
                }
              ]
            }
          ],
          "isBoss": false
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m4"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m2",
            "m4",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m4"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m1"
          ]
        }
      ]
    }
  },
  "4-4": {
    "bgImg": "dungeon4.png",
    "bgm": "b3.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ロコン",
            "img": "mp37.png",
            "attr": "fire",
            "hp": 2000,
            "atk": 62,
            "def": 50,
            "turnInterval": 1,
            "size": "S",
            "exp": 25,
            "coin": 15,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle1",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              }
            ],
            "isBoss": true
          },
          {
            "name": "マンキー",
            "img": "mp56.png",
            "attr": "fire",
            "hp": 2980,
            "atk": 72,
            "def": 0,
            "turnInterval": 1,
            "size": "M",
            "exp": 20,
            "coin": 15,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_1",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 70,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "グロウパンチ",
                "condition": "normal",
                "weight": 30,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "attack_buff",
                    "rate": 1.3,
                    "turn": 2
                  }
                ]
              }
            ],
            "isBoss": true
          },
          {
            "name": "ロコン",
            "img": "mp37.png",
            "attr": "fire",
            "hp": 2000,
            "atk": 62,
            "def": 50,
            "turnInterval": 1,
            "size": "S",
            "exp": 25,
            "coin": 15,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle1",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "ガーディ",
          "img": "mp58.png",
          "attr": "fire",
          "hp": 1001,
          "atk": 76,
          "def": 20,
          "turnInterval": 1,
          "size": "S",
          "exp": 20,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "ほのおのキバ",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.3
                },
                {
                  "type": "board_change",
                  "pattern": "spawn",
                  "to": "fire",
                  "count": 3
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "ロコン",
          "img": "mp37.png",
          "attr": "fire",
          "hp": 1001,
          "atk": 62,
          "def": 90,
          "turnInterval": 1,
          "size": "S",
          "exp": 8,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "マンキー",
          "img": "mp56.png",
          "attr": "fire",
          "hp": 980,
          "atk": 72,
          "def": 60,
          "turnInterval": 1,
          "size": "S",
          "exp": 8,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "グロウパンチ",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "attack_buff",
                  "rate": 1.3,
                  "turn": 2
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "ポニータ",
          "img": "mp77.png",
          "attr": "fire",
          "hp": 800,
          "atk": 69,
          "def": 200,
          "turnInterval": 1,
          "size": "M",
          "exp": 8,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "いかり",
              "condition": "hp<=50%",
              "once": true,
              "skills": [
                {
                  "type": "attack_buff",
                  "rate": 2,
                  "turn": -1
                }
              ]
            }
          ],
          "isBoss": false
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m4"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m2",
            "m4",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m4"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m1"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 10,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 11,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1500,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "4-boss": {
    "bgImg": "dungeon4.png",
    "bgm": "b3.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ケンタロス",
            "img": "mp128.png",
            "attr": "fire",
            "hp": 30000,
            "atk": 142,
            "def": 200,
            "turnInterval": 1,
            "size": "XL",
            "exp": 350,
            "coin": 25,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle12",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "⚠️すてみタックル",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "damage_ratio",
                    "basis": "current",
                    "rate": 75,
                    "survive": true
                  }
                ]
              },
              {
                "name": "いかく",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "rec_down",
                    "value": 0.75,
                    "turn": 3
                  }
                ]
              },
              {
                "name": "とっしん",
                "condition": "normal",
                "weight": 50,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.2
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "タックル",
                "condition": "normal",
                "weight": 50,
                "once": false,
                "skills": [
                  {
                    "type": "board_change",
                    "pattern": "5color_heal"
                  },
                  {
                    "type": "damage_mult",
                    "value": 1.4
                  }
                ],
                "hpBelow": 50
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "ガーディ",
          "img": "mp58.png",
          "attr": "fire",
          "hp": 1001,
          "atk": 76,
          "def": 20,
          "turnInterval": 1,
          "size": "S",
          "exp": 20,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "ほのおのキバ",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.3
                },
                {
                  "type": "board_change",
                  "pattern": "spawn",
                  "to": "fire",
                  "count": 3
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "ロコン",
          "img": "mp37.png",
          "attr": "fire",
          "hp": 1001,
          "atk": 62,
          "def": 90,
          "turnInterval": 1,
          "size": "S",
          "exp": 8,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "マンキー",
          "img": "mp56.png",
          "attr": "fire",
          "hp": 980,
          "atk": 72,
          "def": 60,
          "turnInterval": 1,
          "size": "S",
          "exp": 8,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "グロウパンチ",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "attack_buff",
                  "rate": 1.3,
                  "turn": 2
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "ポニータ",
          "img": "mp77.png",
          "attr": "fire",
          "hp": 800,
          "atk": 69,
          "def": 200,
          "turnInterval": 1,
          "size": "M",
          "exp": 8,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "いかり",
              "condition": "hp<=50%",
              "once": true,
              "skills": [
                {
                  "type": "attack_buff",
                  "rate": 2,
                  "turn": -1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m5": {
          "name": "ワンリキー",
          "img": "mp66.png",
          "attr": "fire",
          "hp": 1001,
          "atk": 56,
          "def": 20,
          "turnInterval": 1,
          "size": "S",
          "exp": 10,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "グロウパンチ",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "attack_buff",
                  "rate": 1.5,
                  "turn": 2
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m4"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m2",
            "m4",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m4"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m5",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m5",
            "m1",
            "m5"
          ]
        }
      ]
    }
  },
  "5-1": {
    "bgImg": "dungeon5.png",
    "bgm": "b4.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ベトベター",
            "img": "mp88.png",
            "attr": "dark",
            "hp": 5000,
            "atk": 312,
            "def": 300,
            "turnInterval": 3,
            "size": "M",
            "exp": 80,
            "coin": 30,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_5",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "ふしょく",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "poison",
                    "count": 10
                  }
                ]
              },
              {
                "name": "ベノムトラップ",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 2
                  },
                  {
                    "type": "board_change",
                    "pattern": "convert",
                    "from": "heal",
                    "to": "poison"
                  }
                ],
                "hpBelow": 30
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "アーボ",
          "img": "mp23.png",
          "attr": "dark",
          "hp": 1001,
          "atk": 73,
          "def": 70,
          "turnInterval": 1,
          "size": "S",
          "exp": 42,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "どくどくのキバ",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "board_change",
                  "pattern": "spawn",
                  "to": "poison",
                  "count": 3
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "ドガース",
          "img": "mp109.png",
          "attr": "dark",
          "hp": 1001,
          "atk": 131,
          "def": 120,
          "turnInterval": 2,
          "size": "S",
          "exp": 38,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 40,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "どくガス",
              "condition": "normal",
              "weight": 60,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "board_change",
                  "pattern": "spawn",
                  "to": "poison",
                  "count": 4
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "コンパン",
          "img": "mp48.png",
          "attr": "dark",
          "hp": 980,
          "atk": 43,
          "def": 100,
          "turnInterval": 1,
          "size": "S",
          "exp": 8,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "ライフダウン",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage",
                  "value": 44,
                  "repeat": 1
                },
                {
                  "type": "rec_down",
                  "value": 0.5,
                  "turn": 2
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m3"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 10,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1500,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "5-2": {
    "bgImg": "dungeon5.png",
    "bgm": "b4.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "スリープ",
            "img": "mp96.png",
            "attr": "dark",
            "hp": 5800,
            "atk": 212,
            "def": 200,
            "turnInterval": 2,
            "size": "M",
            "exp": 100,
            "coin": 20,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle5",
                "rate": 0.1,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "さいみんはどう",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "bind",
                    "target": "random",
                    "countMin": 2,
                    "countMax": 3,
                    "turnMin": 2,
                    "turnMax": 4
                  }
                ]
              },
              {
                "name": "ねんりき",
                "condition": "normal",
                "weight": 50,
                "once": false,
                "skills": [
                  {
                    "type": "combo_absorb",
                    "turn": 1,
                    "combo": 5
                  },
                  {
                    "type": "damage_mult",
                    "value": 1.4
                  }
                ],
                "hpBelow": 50
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "アーボ",
          "img": "mp23.png",
          "attr": "dark",
          "hp": 1001,
          "atk": 73,
          "def": 70,
          "turnInterval": 1,
          "size": "S",
          "exp": 42,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "どくどくのキバ",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "board_change",
                  "pattern": "spawn",
                  "to": "poison",
                  "count": 3
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "ドガース",
          "img": "mp109.png",
          "attr": "dark",
          "hp": 1001,
          "atk": 131,
          "def": 120,
          "turnInterval": 2,
          "size": "S",
          "exp": 38,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 40,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "どくガス",
              "condition": "normal",
              "weight": 60,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "board_change",
                  "pattern": "spawn",
                  "to": "poison",
                  "count": 4
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "コンパン",
          "img": "mp48.png",
          "attr": "dark",
          "hp": 980,
          "atk": 43,
          "def": 100,
          "turnInterval": 1,
          "size": "S",
          "exp": 8,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "ライフダウン",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage",
                  "value": 44,
                  "repeat": 1
                },
                {
                  "type": "rec_down",
                  "value": 0.5,
                  "turn": 2
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "ベトベター",
          "img": "mp88.png",
          "attr": "dark",
          "hp": 1200,
          "atk": 167,
          "def": 30,
          "turnInterval": 3,
          "size": "M",
          "exp": 60,
          "coin": 30,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "ベノムトラップ",
              "condition": "normal",
              "weight": 100,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 2
                },
                {
                  "type": "board_change",
                  "pattern": "convert",
                  "from": "heal",
                  "to": "poison"
                }
              ],
              "hpBelow": 30
            }
          ],
          "isBoss": false
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m1",
            "m4"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1500,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "5-3": {
    "bgImg": "dungeon5.png",
    "bgm": "b4.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ゴース",
            "img": "mp92.png",
            "attr": "dark",
            "hp": 2000,
            "atk": 123,
            "def": 800,
            "turnInterval": 1,
            "size": "S",
            "exp": 60,
            "coin": 10,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_5",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "おどろかす",
                "condition": "normal",
                "once": false,
                "skills": [
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "poison",
                    "count": 2
                  },
                  {
                    "type": "damage_mult",
                    "value": 1.1
                  }
                ],
                "hpBelow": 51
              }
            ],
            "isBoss": true
          },
          {
            "name": "ゴース",
            "img": "mp92.png",
            "attr": "dark",
            "hp": 2000,
            "atk": 123,
            "def": 800,
            "turnInterval": 1,
            "size": "S",
            "exp": 60,
            "coin": 10,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_5",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "おどろかす",
                "condition": "normal",
                "once": false,
                "skills": [
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "poison",
                    "count": 2
                  },
                  {
                    "type": "damage_mult",
                    "value": 1.1
                  }
                ],
                "hpBelow": 51
              }
            ],
            "isBoss": true
          },
          {
            "name": "ゴース",
            "img": "mp92.png",
            "attr": "dark",
            "hp": 2000,
            "atk": 123,
            "def": 800,
            "turnInterval": 1,
            "size": "S",
            "exp": 60,
            "coin": 10,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_5",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "おどろかす",
                "condition": "normal",
                "once": false,
                "skills": [
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "poison",
                    "count": 2
                  },
                  {
                    "type": "damage_mult",
                    "value": 1.1
                  }
                ],
                "hpBelow": 51
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "アーボ",
          "img": "mp23.png",
          "attr": "dark",
          "hp": 1001,
          "atk": 73,
          "def": 70,
          "turnInterval": 1,
          "size": "S",
          "exp": 42,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "どくどくのキバ",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "board_change",
                  "pattern": "spawn",
                  "to": "poison",
                  "count": 3
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "ドガース",
          "img": "mp109.png",
          "attr": "dark",
          "hp": 1001,
          "atk": 131,
          "def": 120,
          "turnInterval": 2,
          "size": "S",
          "exp": 38,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 40,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "どくガス",
              "condition": "normal",
              "weight": 60,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "board_change",
                  "pattern": "spawn",
                  "to": "poison",
                  "count": 4
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "コンパン",
          "img": "mp48.png",
          "attr": "dark",
          "hp": 980,
          "atk": 43,
          "def": 100,
          "turnInterval": 1,
          "size": "S",
          "exp": 18,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "ライフダウン",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage",
                  "value": 44,
                  "repeat": 1
                },
                {
                  "type": "rec_down",
                  "value": 0.5,
                  "turn": 2
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "ベトベター",
          "img": "mp88.png",
          "attr": "dark",
          "hp": 1200,
          "atk": 167,
          "def": 30,
          "turnInterval": 3,
          "size": "M",
          "exp": 60,
          "coin": 30,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "ベノムトラップ",
              "condition": "normal",
              "weight": 100,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 2
                },
                {
                  "type": "board_change",
                  "pattern": "convert",
                  "from": "heal",
                  "to": "poison"
                }
              ],
              "hpBelow": 30
            }
          ],
          "isBoss": false
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m1",
            "m4"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1500,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "5-4": {
    "bgImg": "dungeon5.png",
    "bgm": "b4.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ゴースト",
            "img": "mp93.png",
            "attr": "dark",
            "hp": 8500,
            "atk": 126,
            "def": 0,
            "turnInterval": 1,
            "size": "M",
            "exp": 120,
            "coin": 20,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle52",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "したでなめる",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "bind",
                    "target": "attr",
                    "turnMin": 2,
                    "turnMax": 2,
                    "attr": "light"
                  }
                ]
              },
              {
                "name": "おどろかす",
                "condition": "normal",
                "weight": 50,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.2
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "poison",
                    "count": 2
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "うらめしや",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "blind"
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "ゴース",
          "img": "mp92.png",
          "attr": "dark",
          "hp": 800,
          "atk": 83,
          "def": 280,
          "turnInterval": 1,
          "size": "S",
          "exp": 30,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "おどろかす",
              "condition": "normal",
              "once": false,
              "skills": [
                {
                  "type": "board_change",
                  "pattern": "spawn",
                  "to": "poison",
                  "count": 2
                }
              ],
              "hpBelow": 51
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "ドガース",
          "img": "mp109.png",
          "attr": "dark",
          "hp": 1001,
          "atk": 131,
          "def": 120,
          "turnInterval": 2,
          "size": "S",
          "exp": 38,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 40,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "どくガス",
              "condition": "normal",
              "weight": 60,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "board_change",
                  "pattern": "spawn",
                  "to": "poison",
                  "count": 4
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "コンパン",
          "img": "mp48.png",
          "attr": "dark",
          "hp": 980,
          "atk": 43,
          "def": 100,
          "turnInterval": 1,
          "size": "S",
          "exp": 18,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "ライフダウン",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage",
                  "value": 44,
                  "repeat": 1
                },
                {
                  "type": "rec_down",
                  "value": 0.5,
                  "turn": 2
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "ベトベター",
          "img": "mp88.png",
          "attr": "dark",
          "hp": 1200,
          "atk": 167,
          "def": 30,
          "turnInterval": 3,
          "size": "M",
          "exp": 60,
          "coin": 30,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "ベノムトラップ",
              "condition": "normal",
              "weight": 100,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 2
                },
                {
                  "type": "board_change",
                  "pattern": "convert",
                  "from": "heal",
                  "to": "poison"
                }
              ],
              "hpBelow": 30
            }
          ],
          "isBoss": false
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m1",
            "m4"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1500,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "5-boss": {
    "bgImg": "dungeon5.png",
    "bgm": "b4.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ガルーラ",
            "img": "mp115.png",
            "attr": "light",
            "hp": 45000,
            "atk": 233,
            "def": 100,
            "turnInterval": 1,
            "size": "XL",
            "exp": 500,
            "coin": 30,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle42",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "ほのおのパンチ",
                "condition": "normal",
                "weight": 33,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "fire",
                    "count": 4
                  }
                ]
              },
              {
                "name": "かみなりパンチ",
                "condition": "normal",
                "weight": 33,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "bind",
                    "target": "random",
                    "countMin": 1,
                    "countMax": 1,
                    "turnMin": 2,
                    "turnMax": 2
                  }
                ]
              },
              {
                "name": "れいとうパンチ",
                "condition": "normal",
                "weight": 34,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "time_reduce",
                    "seconds": 1,
                    "turn": 1
                  }
                ]
              },
              {
                "name": "グロウパンチ",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "attack_buff",
                    "rate": 1.2,
                    "turn": 5
                  }
                ]
              },
              {
                "name": "⚠️つるぎのまい",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "attack_buff",
                    "rate": 1.5,
                    "turn": -1
                  }
                ]
              }
            ],
            "isBoss": true,
            "ofudaDrop": {
              "enabled": true,
              "item": "ohuda1",
              "rate": 0.05,
              "count": 1
            }
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "ゴース",
          "img": "mp92.png",
          "attr": "dark",
          "hp": 800,
          "atk": 83,
          "def": 280,
          "turnInterval": 1,
          "size": "S",
          "exp": 30,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "おどろかす",
              "condition": "normal",
              "once": false,
              "skills": [
                {
                  "type": "board_change",
                  "pattern": "spawn",
                  "to": "poison",
                  "count": 2
                }
              ],
              "hpBelow": 51
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "ニドラン♀",
          "img": "mp29.png",
          "attr": "dark",
          "hp": 1001,
          "atk": 221,
          "def": 130,
          "turnInterval": 2,
          "size": "S",
          "exp": 98,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "かみつく",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.3
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "スリープ",
          "img": "mp96.png",
          "attr": "dark",
          "hp": 1100,
          "atk": 176,
          "def": 100,
          "turnInterval": 2,
          "size": "S",
          "exp": 25,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "ねんりき",
              "condition": "normal",
              "weight": 50,
              "once": false,
              "skills": [
                {
                  "type": "combo_absorb",
                  "turn": 1,
                  "combo": 4
                },
                {
                  "type": "damage_mult",
                  "value": 1.3
                }
              ],
              "hpBelow": 50
            }
          ],
          "isBoss": false
        },
        "m4": {
          "name": "ベトベター",
          "img": "mp88.png",
          "attr": "dark",
          "hp": 1200,
          "atk": 167,
          "def": 30,
          "turnInterval": 3,
          "size": "M",
          "exp": 60,
          "coin": 30,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "ベノムトラップ",
              "condition": "normal",
              "weight": 100,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 2
                },
                {
                  "type": "board_change",
                  "pattern": "convert",
                  "from": "heal",
                  "to": "poison"
                }
              ],
              "hpBelow": 30
            }
          ],
          "isBoss": false
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m1",
            "m4",
            "m1"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1500,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "6-1": {
    "bgImg": "dungeon6.png",
    "bgm": "b5.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "イワーク",
            "img": "mp95.png",
            "attr": "light",
            "hp": 5000,
            "atk": 1062,
            "def": 600,
            "turnInterval": 3,
            "size": "L",
            "exp": 100,
            "coin": 20,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle4",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "アイアンテール",
                "condition": "normal",
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "dmg_reduce",
                    "rate": 25,
                    "turn": 3
                  }
                ],
                "hpBelow": 50,
                "weight": 60
              },
              {
                "name": "ふりはらう",
                "condition": "normal",
                "weight": 40,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.2
                  },
                  {
                    "type": "attr_guard",
                    "attr": "dark",
                    "rate": 50,
                    "turn": 3
                  }
                ],
                "hpBelow": 50
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "イシツブテ",
          "img": "mp74.png",
          "attr": "light",
          "hp": 650,
          "atk": 163,
          "def": 450,
          "turnInterval": 2,
          "size": "S",
          "exp": 61,
          "coin": 16,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "いわおとし",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.3
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "サンド",
          "img": "mp27.png",
          "attr": "light",
          "hp": 1401,
          "atk": 82,
          "def": 39,
          "turnInterval": 1,
          "size": "S",
          "exp": 43,
          "coin": 9,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "ニャース",
          "img": "mp52.png",
          "attr": "light",
          "hp": 1280,
          "atk": 62,
          "def": 100,
          "turnInterval": 1,
          "size": "S",
          "exp": 35,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "みだれひっかき",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage",
                  "value": 63,
                  "repeat": 3
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m3",
            "m1"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1500,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "6-2": {
    "bgImg": "dungeon6.png",
    "bgm": "b5.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "カラカラ",
            "img": "mp104.png",
            "attr": "light",
            "hp": 20000,
            "atk": 383,
            "def": 0,
            "turnInterval": 1,
            "size": "M",
            "exp": 150,
            "coin": 30,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_4",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "ホネこんぼう",
                "condition": "normal",
                "once": false,
                "skills": [
                  {
                    "type": "dmg_reduce",
                    "rate": 25,
                    "turn": 1
                  },
                  {
                    "type": "damage_mult",
                    "value": 1.3
                  }
                ],
                "hpBelow": 50,
                "weight": 100
              },
              {
                "name": "ホネブーメラン",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "board_change",
                    "pattern": "convert",
                    "from": "dark",
                    "to": "light"
                  },
                  {
                    "type": "damage_mult",
                    "value": 1.3
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "イシツブテ",
          "img": "mp74.png",
          "attr": "light",
          "hp": 750,
          "atk": 223,
          "def": 450,
          "turnInterval": 2,
          "size": "S",
          "exp": 61,
          "coin": 16,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "いわおとし",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.3
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "サンド",
          "img": "mp27.png",
          "attr": "light",
          "hp": 1601,
          "atk": 102,
          "def": 39,
          "turnInterval": 1,
          "size": "S",
          "exp": 43,
          "coin": 9,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "ニャース",
          "img": "mp52.png",
          "attr": "light",
          "hp": 1280,
          "atk": 82,
          "def": 200,
          "turnInterval": 1,
          "size": "S",
          "exp": 35,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "みだれひっかき",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage",
                  "value": 63,
                  "repeat": 3
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m3",
            "m1"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 2000,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "6-3": {
    "bgImg": "dungeon6.png",
    "bgm": "b5.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ドードー",
            "img": "mp84.png",
            "attr": "light",
            "hp": 8000,
            "atk": 322,
            "def": 200,
            "turnInterval": 1,
            "size": "S",
            "exp": 200,
            "coin": 20,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle4",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 33,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "れんぞくこうげき",
                "condition": "normal",
                "weight": 33,
                "skills": [
                  {
                    "type": "damage",
                    "value": 60,
                    "repeat": 3
                  }
                ]
              },
              {
                "name": "ガードキック",
                "condition": "normal",
                "weight": 34,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "attr_guard",
                    "attr": "fire",
                    "rate": 25,
                    "turn": 1
                  },
                  {
                    "type": "attr_guard",
                    "attr": "water",
                    "rate": 25,
                    "turn": 1
                  },
                  {
                    "type": "attr_guard",
                    "attr": "wood",
                    "rate": 25,
                    "turn": 1
                  }
                ]
              }
            ],
            "isBoss": true
          },
          {
            "name": "ドードー",
            "img": "mp84.png",
            "attr": "light",
            "hp": 8000,
            "atk": 322,
            "def": 200,
            "turnInterval": 1,
            "size": "S",
            "exp": 200,
            "coin": 20,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle4",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 33,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "れんぞくこうげき",
                "condition": "normal",
                "weight": 33,
                "skills": [
                  {
                    "type": "damage",
                    "value": 60,
                    "repeat": 3
                  }
                ]
              },
              {
                "name": "ガードキック",
                "condition": "normal",
                "weight": 34,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "attr_guard",
                    "attr": "fire",
                    "rate": 25,
                    "turn": 1
                  },
                  {
                    "type": "attr_guard",
                    "attr": "water",
                    "rate": 25,
                    "turn": 1
                  },
                  {
                    "type": "attr_guard",
                    "attr": "wood",
                    "rate": 25,
                    "turn": 1
                  }
                ]
              }
            ],
            "isBoss": true
          },
          {
            "name": "ドードー",
            "img": "mp84.png",
            "attr": "light",
            "hp": 8000,
            "atk": 322,
            "def": 200,
            "turnInterval": 1,
            "size": "S",
            "exp": 200,
            "coin": 20,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle4",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 33,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "れんぞくこうげき",
                "condition": "normal",
                "weight": 33,
                "skills": [
                  {
                    "type": "damage",
                    "value": 60,
                    "repeat": 3
                  }
                ]
              },
              {
                "name": "ガードキック",
                "condition": "normal",
                "weight": 34,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "attr_guard",
                    "attr": "fire",
                    "rate": 25,
                    "turn": 1
                  },
                  {
                    "type": "attr_guard",
                    "attr": "water",
                    "rate": 25,
                    "turn": 1
                  },
                  {
                    "type": "attr_guard",
                    "attr": "wood",
                    "rate": 25,
                    "turn": 1
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "イシツブテ",
          "img": "mp74.png",
          "attr": "light",
          "hp": 750,
          "atk": 223,
          "def": 450,
          "turnInterval": 2,
          "size": "S",
          "exp": 61,
          "coin": 16,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "いわおとし",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.3
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "サンド",
          "img": "mp27.png",
          "attr": "light",
          "hp": 1601,
          "atk": 102,
          "def": 39,
          "turnInterval": 1,
          "size": "S",
          "exp": 43,
          "coin": 9,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "ニャース",
          "img": "mp52.png",
          "attr": "light",
          "hp": 1280,
          "atk": 82,
          "def": 200,
          "turnInterval": 1,
          "size": "S",
          "exp": 35,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "みだれひっかき",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage",
                  "value": 63,
                  "repeat": 3
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "カラカラ",
          "img": "mp104.png",
          "attr": "light",
          "hp": 1700,
          "atk": 112,
          "def": 55,
          "turnInterval": 1,
          "size": "S",
          "exp": 50,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "ホネブーメラン",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "board_change",
                  "pattern": "convert",
                  "from": "dark",
                  "to": "light"
                },
                {
                  "type": "damage_mult",
                  "value": 1.4
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1",
            "m4"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m2",
            "m4",
            "m1",
            "m4"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m2",
            "m4",
            "m1"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 2000,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "6-4": {
    "bgImg": "dungeon6.png",
    "bgm": "b5.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "サイホーン",
            "img": "mp111.png",
            "attr": "light",
            "hp": 25000,
            "atk": 403,
            "def": 600,
            "turnInterval": 2,
            "size": "L",
            "exp": 200,
            "coin": 20,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_4",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "あばれる",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "action_change",
                    "interval": 1
                  }
                ]
              },
              {
                "name": "つのでつく",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.2
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "じならし",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "5color_heal"
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "イシツブテ",
          "img": "mp74.png",
          "attr": "light",
          "hp": 750,
          "atk": 223,
          "def": 450,
          "turnInterval": 2,
          "size": "S",
          "exp": 61,
          "coin": 16,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "いわおとし",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.3
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "サンド",
          "img": "mp27.png",
          "attr": "light",
          "hp": 1601,
          "atk": 102,
          "def": 39,
          "turnInterval": 1,
          "size": "S",
          "exp": 43,
          "coin": 9,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "ドードー",
          "img": "mp84.png",
          "attr": "light",
          "hp": 1580,
          "atk": 103,
          "def": 0,
          "turnInterval": 1,
          "size": "S",
          "exp": 38,
          "coin": 8,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "カラカラ",
          "img": "mp104.png",
          "attr": "light",
          "hp": 1700,
          "atk": 112,
          "def": 55,
          "turnInterval": 1,
          "size": "S",
          "exp": 50,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "ホネブーメラン",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "board_change",
                  "pattern": "convert",
                  "from": "dark",
                  "to": "light"
                },
                {
                  "type": "damage_mult",
                  "value": 1.4
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1",
            "m4"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m2",
            "m4",
            "m1",
            "m4"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m3",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m2",
            "m4",
            "m1"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 2000,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "6-boss": {
    "bgImg": "dungeon6.png",
    "bgm": "b5.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "プテラ",
            "img": "mp142.png",
            "attr": "dark",
            "hp": 60000,
            "atk": 803,
            "def": 100,
            "turnInterval": 1,
            "size": "XL",
            "exp": 1000,
            "coin": 0,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle52",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "かっくう",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "atk_down",
                    "target": "attr",
                    "attr": "light",
                    "rate": 25,
                    "turn": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "かみつく",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_ratio",
                    "basis": "max",
                    "rate": 20
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "げんしのさだめ",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "attr_guard",
                    "attr": "dark",
                    "rate": 50,
                    "turn": -1
                  },
                  {
                    "type": "combo_absorb",
                    "turn": 99,
                    "combo": 3
                  }
                ]
              },
              {
                "name": "⚠️げんしのちから",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.5
                  },
                  {
                    "type": "status_shield",
                    "turn": 99
                  },
                  {
                    "type": "dmg_reduce",
                    "rate": 50,
                    "turn": 1
                  }
                ]
              },
              {
                "name": "ランドクラッシュ",
                "condition": "normal",
                "weight": 50,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.3
                  },
                  {
                    "type": "board_change",
                    "pattern": "5color_heal"
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "がんせきふうじ",
                "condition": "normal",
                "weight": 50,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.1
                  },
                  {
                    "type": "time_reduce",
                    "seconds": 1,
                    "turn": 1
                  }
                ],
                "hpBelow": 50
              }
            ],
            "isBoss": true,
            "ofudaDrop": {
              "enabled": true,
              "item": "ohuda1",
              "rate": 0.05,
              "count": 1
            }
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "イシツブテ",
          "img": "mp74.png",
          "attr": "light",
          "hp": 750,
          "atk": 323,
          "def": 450,
          "turnInterval": 2,
          "size": "S",
          "exp": 61,
          "coin": 16,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "いわおとし",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.3
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "サンド",
          "img": "mp27.png",
          "attr": "light",
          "hp": 1601,
          "atk": 202,
          "def": 39,
          "turnInterval": 1,
          "size": "S",
          "exp": 43,
          "coin": 9,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "ドードー",
          "img": "mp84.png",
          "attr": "light",
          "hp": 1580,
          "atk": 203,
          "def": 0,
          "turnInterval": 1,
          "size": "S",
          "exp": 38,
          "coin": 8,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "カラカラ",
          "img": "mp104.png",
          "attr": "light",
          "hp": 1700,
          "atk": 212,
          "def": 55,
          "turnInterval": 1,
          "size": "S",
          "exp": 50,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "ホネブーメラン",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "board_change",
                  "pattern": "convert",
                  "from": "dark",
                  "to": "light"
                },
                {
                  "type": "damage_mult",
                  "value": 1.4
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1",
            "m4"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m2",
            "m4",
            "m1",
            "m4"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m3",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m2",
            "m4",
            "m1"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 5,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 2000,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "keiken-1": {
    "bgImg": "dungeon1.png",
    "bgm": "b1.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "キャタピー",
            "img": "mp10.png",
            "attr": "wood",
            "hp": 800,
            "atk": 500,
            "def": 2000,
            "turnInterval": 2,
            "size": "S",
            "exp": 50,
            "coin": 0,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        "enemies": [
          {
            "name": "ビードル",
            "img": "mp13.png",
            "attr": "wood",
            "hp": 5000,
            "atk": 300,
            "def": 0,
            "turnInterval": 1,
            "size": "S",
            "exp": 250,
            "coin": 0,
            "drops": [],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              }
            ],
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            }
          }
        ]
      },
      {
        "enemies": [
          {
            "name": "ラッキー",
            "img": "mp113.png",
            "attr": "light",
            "hp": 10,
            "atk": 1,
            "def": 6000,
            "isBoss": true,
            "turnInterval": 2,
            "size": "XL",
            "exp": 10000,
            "coin": 0,
            "drops": [],
            "actions": [
              {
                "name": "にげる",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "flee"
                  }
                ]
              }
            ],
            "monsterDrop": {
              "enabled": true,
              "rate": 0.75
            }
          }
        ]
      }
    ],
    "intrusion": {
      "rate": 50,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 3000,
          "coin": 0,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.5
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "7-1": {
    "bgImg": "dungeon7.png",
    "bgm": "b8.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ゴースト",
            "img": "mp93.png",
            "attr": "dark",
            "hp": 22500,
            "atk": 326,
            "def": 250,
            "turnInterval": 1,
            "size": "M",
            "exp": 99,
            "coin": 10,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle52",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "したでなめる",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "bind",
                    "target": "attr",
                    "turnMin": 2,
                    "turnMax": 2,
                    "attr": "light"
                  }
                ]
              },
              {
                "name": "おどろかす",
                "condition": "normal",
                "weight": 50,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.2
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "poison",
                    "count": 2
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "うらめしや",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "blind"
                  }
                ]
              }
            ],
            "isBoss": true
          },
          {
            "name": "イワーク",
            "img": "mp95.png",
            "attr": "light",
            "hp": 15000,
            "atk": 1000,
            "def": 750,
            "turnInterval": 3,
            "size": "M",
            "exp": 99,
            "coin": 10,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle42",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "アイアンテール",
                "condition": "normal",
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "dmg_reduce",
                    "rate": 25,
                    "turn": 3
                  }
                ],
                "hpBelow": 50,
                "weight": 60
              },
              {
                "name": "ふりはらう",
                "condition": "normal",
                "weight": 40,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.2
                  },
                  {
                    "type": "attr_guard",
                    "attr": "dark",
                    "rate": 50,
                    "turn": 3
                  }
                ],
                "hpBelow": 50
              }
            ],
            "isBoss": true
          },
          {
            "name": "ゴースト",
            "img": "mp93.png",
            "attr": "dark",
            "hp": 25000,
            "atk": 286,
            "def": 250,
            "turnInterval": 1,
            "size": "M",
            "exp": 99,
            "coin": 10,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle52",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "したでなめる",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "bind",
                    "target": "attr",
                    "turnMin": 2,
                    "turnMax": 2,
                    "attr": "light"
                  }
                ]
              },
              {
                "name": "おどろかす",
                "condition": "normal",
                "weight": 50,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.2
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "poison",
                    "count": 2
                  }
                ],
                "hpBelow": 50
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "イシツブテ",
          "img": "mp74.png",
          "attr": "light",
          "hp": 650,
          "atk": 433,
          "def": 550,
          "turnInterval": 2,
          "size": "S",
          "exp": 96,
          "coin": 16,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "いわおとし",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.3
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "ズバット",
          "img": "mp41.png",
          "attr": "dark",
          "hp": 1830,
          "atk": 222,
          "def": 20,
          "turnInterval": 1,
          "size": "S",
          "exp": 186,
          "coin": 14,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "ワンリキー",
          "img": "mp66.png",
          "attr": "fire",
          "hp": 1801,
          "atk": 205,
          "def": 20,
          "turnInterval": 1,
          "size": "S",
          "exp": 88,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "グロウパンチ",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "attack_buff",
                  "rate": 1.5,
                  "turn": 2
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m4": {
          "name": "パラス",
          "img": "mp46.png",
          "attr": "wood",
          "hp": 1601,
          "atk": 677,
          "def": 339,
          "turnInterval": 3,
          "size": "S",
          "exp": 143,
          "coin": 7,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m5": {
          "name": "ニョロモ",
          "img": "mp60.png",
          "attr": "water",
          "hp": 1401,
          "atk": 175,
          "def": 199,
          "turnInterval": 1,
          "size": "S",
          "exp": 30,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "あわ",
              "condition": "normal",
              "weight": 100,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.3
                },
                {
                  "type": "board_change",
                  "pattern": "convert",
                  "from": "wood",
                  "to": "water"
                }
              ],
              "hpBelow": 50
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m4"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m5",
            "m2",
            "m2",
            "m3"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1500,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "7-2": {
    "bgImg": "dungeon7.png",
    "bgm": "b8.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "リザード",
            "img": "mp5.png",
            "attr": "fire",
            "hp": 45000,
            "atk": 255,
            "def": 0,
            "turnInterval": 1,
            "size": "L",
            "exp": 250,
            "coin": 25,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05,
              "monsterId": 4
            },
            "drops": [
              {
                "item": "puzzle12",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "ほのおのパンチ",
                "condition": "normal",
                "weight": 45,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "random_to",
                    "to": "fire"
                  }
                ]
              },
              {
                "name": "ほのおのツメ",
                "condition": "normal",
                "weight": 55,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.4
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "fire",
                    "count": 5
                  }
                ]
              },
              {
                "name": "ほのおのパンチ",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "attack_buff",
                    "rate": 2,
                    "turn": 1
                  }
                ],
                "hpBelow": 51
              },
              {
                "name": "ドロップチェンジ・火",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "board_change",
                    "pattern": "convert",
                    "from": "water",
                    "to": "fire"
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "イシツブテ",
          "img": "mp74.png",
          "attr": "light",
          "hp": 650,
          "atk": 433,
          "def": 550,
          "turnInterval": 2,
          "size": "S",
          "exp": 96,
          "coin": 16,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "いわおとし",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.3
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "ズバット",
          "img": "mp41.png",
          "attr": "dark",
          "hp": 1930,
          "atk": 222,
          "def": 20,
          "turnInterval": 1,
          "size": "S",
          "exp": 186,
          "coin": 14,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "ワンリキー",
          "img": "mp66.png",
          "attr": "fire",
          "hp": 1801,
          "atk": 205,
          "def": 20,
          "turnInterval": 1,
          "size": "S",
          "exp": 88,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "グロウパンチ",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "attack_buff",
                  "rate": 1.5,
                  "turn": 2
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m4": {
          "name": "パラス",
          "img": "mp46.png",
          "attr": "wood",
          "hp": 1601,
          "atk": 677,
          "def": 339,
          "turnInterval": 3,
          "size": "S",
          "exp": 143,
          "coin": 7,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m5": {
          "name": "ニョロモ",
          "img": "mp60.png",
          "attr": "water",
          "hp": 1601,
          "atk": 175,
          "def": 199,
          "turnInterval": 1,
          "size": "S",
          "exp": 30,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "あわ",
              "condition": "normal",
              "weight": 100,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.3
                },
                {
                  "type": "board_change",
                  "pattern": "convert",
                  "from": "wood",
                  "to": "water"
                }
              ],
              "hpBelow": 50
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m4"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m5",
            "m2",
            "m2",
            "m3"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1500,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "7-3": {
    "bgImg": "dungeon7.png",
    "bgm": "b8.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "カメール",
            "img": "mp8.png",
            "attr": "water",
            "hp": 45000,
            "atk": 612,
            "def": 50,
            "turnInterval": 2,
            "size": "L",
            "exp": 300,
            "coin": 15,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05,
              "monsterId": 7
            },
            "drops": [
              {
                "item": "puzzle22",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "マリンドロップ",
                "condition": "normal",
                "weight": 45,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "random_to",
                    "to": "water"
                  }
                ]
              },
              {
                "name": "みずてっぽう",
                "condition": "normal",
                "weight": 55,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.4
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "water",
                    "count": 5
                  }
                ]
              },
              {
                "name": "アクアブレイク",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "attack_buff",
                    "rate": 2,
                    "turn": 2
                  }
                ],
                "hpBelow": 51
              },
              {
                "name": "ドロップチェンジ・水",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "board_change",
                    "pattern": "convert",
                    "from": "wood",
                    "to": "water"
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "ドードー",
          "img": "mp84.png",
          "attr": "light",
          "hp": 1650,
          "atk": 433,
          "def": 200,
          "turnInterval": 2,
          "size": "S",
          "exp": 96,
          "coin": 16,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "いわおとし",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.3
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "ズバット",
          "img": "mp41.png",
          "attr": "dark",
          "hp": 1930,
          "atk": 222,
          "def": 20,
          "turnInterval": 1,
          "size": "S",
          "exp": 186,
          "coin": 14,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "ワンリキー",
          "img": "mp66.png",
          "attr": "fire",
          "hp": 1801,
          "atk": 205,
          "def": 20,
          "turnInterval": 1,
          "size": "S",
          "exp": 88,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "グロウパンチ",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "attack_buff",
                  "rate": 1.5,
                  "turn": 2
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m4": {
          "name": "ナゾノクサ",
          "img": "mp43.png",
          "attr": "wood",
          "hp": 1601,
          "atk": 677,
          "def": 339,
          "turnInterval": 3,
          "size": "S",
          "exp": 143,
          "coin": 7,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m5": {
          "name": "ニョロモ",
          "img": "mp60.png",
          "attr": "water",
          "hp": 1601,
          "atk": 175,
          "def": 199,
          "turnInterval": 1,
          "size": "S",
          "exp": 30,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "あわ",
              "condition": "normal",
              "weight": 100,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.3
                },
                {
                  "type": "board_change",
                  "pattern": "convert",
                  "from": "wood",
                  "to": "water"
                }
              ],
              "hpBelow": 50
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m4"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m5",
            "m2",
            "m2",
            "m3"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1500,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "7-4": {
    "bgImg": "dungeon7.png",
    "bgm": "b8.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "フシギソウ",
            "img": "mp2.png",
            "attr": "wood",
            "hp": 47500,
            "atk": 513,
            "def": 0,
            "turnInterval": 2,
            "size": "L",
            "exp": 300,
            "coin": 15,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05,
              "monsterId": 1
            },
            "drops": [
              {
                "item": "puzzle32",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "ポイズンリーフ",
                "condition": "normal",
                "weight": 45,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "poison",
                    "count": 5
                  }
                ]
              },
              {
                "name": "マジカルリーフ",
                "condition": "normal",
                "weight": 55,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.4
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "wood",
                    "count": 7
                  }
                ]
              },
              {
                "name": "はっぱカッター",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "attack_buff",
                    "rate": 2,
                    "turn": 2
                  }
                ],
                "hpBelow": 51
              },
              {
                "name": "ドロップチェンジ・木",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "board_change",
                    "pattern": "convert",
                    "from": "fire",
                    "to": "wood"
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "ドードー",
          "img": "mp84.png",
          "attr": "light",
          "hp": 1650,
          "atk": 433,
          "def": 200,
          "turnInterval": 2,
          "size": "S",
          "exp": 96,
          "coin": 16,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "いわおとし",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.3
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "ズバット",
          "img": "mp41.png",
          "attr": "dark",
          "hp": 1930,
          "atk": 222,
          "def": 20,
          "turnInterval": 1,
          "size": "S",
          "exp": 186,
          "coin": 14,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "マンキー",
          "img": "mp56.png",
          "attr": "fire",
          "hp": 1801,
          "atk": 205,
          "def": 20,
          "turnInterval": 1,
          "size": "S",
          "exp": 88,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "グロウパンチ",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "attack_buff",
                  "rate": 1.5,
                  "turn": 2
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m4": {
          "name": "ナゾノクサ",
          "img": "mp43.png",
          "attr": "wood",
          "hp": 1601,
          "atk": 677,
          "def": 339,
          "turnInterval": 3,
          "size": "S",
          "exp": 143,
          "coin": 7,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m5": {
          "name": "コダック",
          "img": "mp54.png",
          "attr": "water",
          "hp": 1601,
          "atk": 175,
          "def": 199,
          "turnInterval": 1,
          "size": "S",
          "exp": 30,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "あわ",
              "condition": "normal",
              "weight": 100,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.4
                },
                {
                  "type": "board_change",
                  "pattern": "convert",
                  "from": "wood",
                  "to": "water"
                }
              ],
              "hpBelow": 50
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m4"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m5",
            "m2",
            "m2",
            "m3"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 3500,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "7-boss": {
    "bgImg": "dungeon7.png",
    "bgm": "b8.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "カイリュー",
            "img": "mp149.png",
            "attr": "light",
            "hp": 70000,
            "atk": 830,
            "def": 100,
            "turnInterval": 1,
            "size": "XL",
            "exp": 1500,
            "coin": 30,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05,
              "monsterId": 147
            },
            "drops": [
              {
                "item": "spuzzle_42",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "エアスラッシュ",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "atk_down",
                    "target": "attr",
                    "attr": "dark",
                    "rate": 25,
                    "turn": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "ドラゴンクロー",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.2
                  },
                  {
                    "type": "combo_absorb",
                    "turn": 1,
                    "combo": 3
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "マルチスケイル",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "status_shield",
                    "turn": 99
                  },
                  {
                    "type": "dmg_reduce",
                    "rate": 50,
                    "turn": 1
                  },
                  {
                    "type": "super_gut",
                    "rate": 50
                  }
                ]
              },
              {
                "name": "⚠️りゅうのまい",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "attack_buff",
                    "rate": 1.2,
                    "turn": -1
                  },
                  {
                    "type": "combo_absorb",
                    "turn": 1,
                    "combo": 5
                  }
                ]
              },
              {
                "name": "りゅうのはどう",
                "condition": "normal",
                "weight": 50,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "random_to",
                    "to": "water"
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "しんそく",
                "condition": "normal",
                "weight": 50,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.1
                  },
                  {
                    "type": "time_reduce",
                    "seconds": 1,
                    "turn": 1
                  }
                ],
                "hpBelow": 50
              }
            ],
            "isBoss": true,
            "ofudaDrop": {
              "enabled": true,
              "item": "ohuda1",
              "rate": 0.1,
              "count": 1
            }
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "ドードー",
          "img": "mp84.png",
          "attr": "light",
          "hp": 1650,
          "atk": 433,
          "def": 200,
          "turnInterval": 2,
          "size": "S",
          "exp": 96,
          "coin": 16,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "いわおとし",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.3
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "ズバット",
          "img": "mp41.png",
          "attr": "dark",
          "hp": 1930,
          "atk": 222,
          "def": 20,
          "turnInterval": 1,
          "size": "S",
          "exp": 186,
          "coin": 14,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "マンキー",
          "img": "mp56.png",
          "attr": "fire",
          "hp": 1801,
          "atk": 205,
          "def": 20,
          "turnInterval": 1,
          "size": "S",
          "exp": 88,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "グロウパンチ",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "attack_buff",
                  "rate": 1.5,
                  "turn": 2
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m4": {
          "name": "ナゾノクサ",
          "img": "mp43.png",
          "attr": "wood",
          "hp": 1601,
          "atk": 677,
          "def": 339,
          "turnInterval": 3,
          "size": "S",
          "exp": 143,
          "coin": 7,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m5": {
          "name": "コダック",
          "img": "mp54.png",
          "attr": "water",
          "hp": 1601,
          "atk": 175,
          "def": 199,
          "turnInterval": 1,
          "size": "S",
          "exp": 30,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "あわ",
              "condition": "normal",
              "weight": 100,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.4
                },
                {
                  "type": "board_change",
                  "pattern": "convert",
                  "from": "wood",
                  "to": "water"
                }
              ],
              "hpBelow": 50
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m3",
            "m5",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m5",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m5",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m4",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m5",
            "m2",
            "m2",
            "m3"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1500,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "8-1": {
    "bgImg": "dungeon8.png",
    "bgm": "b6.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ベロリンガ",
            "img": "mp108.png",
            "attr": "fire",
            "hp": 50000,
            "atk": 613,
            "def": 0,
            "turnInterval": 2,
            "size": "L",
            "exp": 300,
            "coin": 15,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_12",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "したでなめる",
                "condition": "normal",
                "weight": 45,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "dark",
                    "count": 5
                  }
                ]
              },
              {
                "name": "レロレロレロ",
                "condition": "normal",
                "weight": 55,
                "skills": [
                  {
                    "type": "damage",
                    "value": 453,
                    "repeat": 3
                  },
                  {
                    "type": "time_reduce",
                    "seconds": 1,
                    "turn": 1
                  }
                ]
              },
              {
                "name": "したなめ〜ん",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "bind",
                    "target": "random",
                    "countMin": 2,
                    "countMax": 4,
                    "turnMin": 1,
                    "turnMax": 2
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "イシツブテ",
          "img": "mp74.png",
          "attr": "light",
          "hp": 650,
          "atk": 433,
          "def": 550,
          "turnInterval": 2,
          "size": "S",
          "exp": 96,
          "coin": 16,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "いわおとし",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.3
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "ロコン",
          "img": "mp37.png",
          "attr": "fire",
          "hp": 2130,
          "atk": 222,
          "def": 20,
          "turnInterval": 1,
          "size": "S",
          "exp": 256,
          "coin": 14,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "ディグダ",
          "img": "mp50.png",
          "attr": "light",
          "hp": 1801,
          "atk": 225,
          "def": 60,
          "turnInterval": 1,
          "size": "S",
          "exp": 200,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "あなをほる",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "attack_buff",
                  "rate": 1.5,
                  "turn": 2
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m4": {
          "name": "サンド",
          "img": "mp27.png",
          "attr": "light",
          "hp": 1601,
          "atk": 777,
          "def": 439,
          "turnInterval": 3,
          "size": "S",
          "exp": 243,
          "coin": 7,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m5": {
          "name": "ガーディ",
          "img": "mp58.png",
          "attr": "fire",
          "hp": 2001,
          "atk": 175,
          "def": 199,
          "turnInterval": 1,
          "size": "S",
          "exp": 30,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m4"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m5",
            "m2",
            "m2",
            "m3"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1500,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "8-2": {
    "bgImg": "dungeon8.png",
    "bgm": "b6.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "サワムラー",
            "img": "mp106.png",
            "attr": "fire",
            "hp": 50000,
            "atk": 883,
            "def": 0,
            "turnInterval": 2,
            "size": "L",
            "exp": 500,
            "coin": 10,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_12",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "まわしげり",
                "condition": "normal",
                "weight": 45,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "fire",
                    "count": 3
                  }
                ]
              },
              {
                "name": "にどげり",
                "condition": "normal",
                "weight": 55,
                "skills": [
                  {
                    "type": "damage",
                    "value": 532,
                    "repeat": 2
                  }
                ]
              },
              {
                "name": "ローキック",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "damage_ratio",
                    "basis": "max",
                    "rate": 33
                  }
                ]
              },
              {
                "name": "かまえ",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "action_change",
                    "interval": 1
                  },
                  {
                    "type": "attr_guard",
                    "attr": "fire",
                    "rate": 25,
                    "turn": 3
                  },
                  {
                    "type": "attr_guard",
                    "attr": "water",
                    "rate": 25,
                    "turn": 3
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "イシツブテ",
          "img": "mp74.png",
          "attr": "light",
          "hp": 650,
          "atk": 433,
          "def": 550,
          "turnInterval": 2,
          "size": "S",
          "exp": 96,
          "coin": 16,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "いわおとし",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.3
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "ロコン",
          "img": "mp37.png",
          "attr": "fire",
          "hp": 2130,
          "atk": 222,
          "def": 20,
          "turnInterval": 1,
          "size": "S",
          "exp": 256,
          "coin": 14,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "ディグダ",
          "img": "mp50.png",
          "attr": "light",
          "hp": 1801,
          "atk": 225,
          "def": 60,
          "turnInterval": 1,
          "size": "S",
          "exp": 200,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "あなをほる",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "attack_buff",
                  "rate": 1.5,
                  "turn": 2
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m4": {
          "name": "サンド",
          "img": "mp27.png",
          "attr": "light",
          "hp": 1601,
          "atk": 777,
          "def": 439,
          "turnInterval": 3,
          "size": "S",
          "exp": 243,
          "coin": 7,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m5": {
          "name": "ガーディ",
          "img": "mp58.png",
          "attr": "fire",
          "hp": 2001,
          "atk": 175,
          "def": 199,
          "turnInterval": 1,
          "size": "S",
          "exp": 30,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m4"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m5",
            "m2",
            "m2",
            "m3"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1500,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "8-3": {
    "bgImg": "dungeon8.png",
    "bgm": "b6.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "エビワラー",
            "img": "mp107.png",
            "attr": "fire",
            "hp": 50000,
            "atk": 523,
            "def": 500,
            "turnInterval": 1,
            "size": "L",
            "exp": 750,
            "coin": 10,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_12",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "ストレート",
                "condition": "normal",
                "weight": 45,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.3
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "fire",
                    "count": 5
                  }
                ]
              },
              {
                "name": "ジャブ",
                "condition": "normal",
                "weight": 55,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "convert",
                    "from": "water",
                    "to": "wood"
                  }
                ]
              },
              {
                "name": "マッハパンチ",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "いかり",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "attack_buff",
                    "rate": 1.2,
                    "turn": -1
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "イシツブテ",
          "img": "mp74.png",
          "attr": "light",
          "hp": 650,
          "atk": 433,
          "def": 550,
          "turnInterval": 2,
          "size": "S",
          "exp": 96,
          "coin": 16,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "いわおとし",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.3
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "ロコン",
          "img": "mp37.png",
          "attr": "fire",
          "hp": 2130,
          "atk": 222,
          "def": 20,
          "turnInterval": 1,
          "size": "S",
          "exp": 256,
          "coin": 14,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "ディグダ",
          "img": "mp50.png",
          "attr": "light",
          "hp": 1801,
          "atk": 225,
          "def": 60,
          "turnInterval": 1,
          "size": "S",
          "exp": 200,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "あなをほる",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "attack_buff",
                  "rate": 1.5,
                  "turn": 2
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m4": {
          "name": "サンド",
          "img": "mp27.png",
          "attr": "light",
          "hp": 1601,
          "atk": 777,
          "def": 439,
          "turnInterval": 3,
          "size": "S",
          "exp": 243,
          "coin": 7,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m5": {
          "name": "ガーディ",
          "img": "mp58.png",
          "attr": "fire",
          "hp": 2001,
          "atk": 175,
          "def": 199,
          "turnInterval": 1,
          "size": "S",
          "exp": 30,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m4"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m5",
            "m2",
            "m2",
            "m3"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1500,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "8-4": {
    "bgImg": "dungeon8.png",
    "bgm": "b6.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ベロリンガ",
            "img": "mp108.png",
            "attr": "fire",
            "hp": 25000,
            "atk": 613,
            "def": 0,
            "turnInterval": 2,
            "size": "L",
            "exp": 300,
            "coin": 5,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_12",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "したでなめる",
                "condition": "normal",
                "weight": 45,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "dark",
                    "count": 3
                  }
                ]
              },
              {
                "name": "レロレロレロ",
                "condition": "normal",
                "weight": 55,
                "skills": [
                  {
                    "type": "damage",
                    "value": 453,
                    "repeat": 2
                  },
                  {
                    "type": "time_reduce",
                    "seconds": 1,
                    "turn": 1
                  }
                ]
              },
              {
                "name": "したなめ〜ん",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "bind",
                    "target": "random",
                    "countMin": 2,
                    "countMax": 4,
                    "turnMin": 1,
                    "turnMax": 2
                  }
                ]
              }
            ],
            "isBoss": true
          },
          {
            "name": "ベロリンガ",
            "img": "mp108.png",
            "attr": "fire",
            "hp": 25000,
            "atk": 613,
            "def": 0,
            "turnInterval": 2,
            "size": "L",
            "exp": 300,
            "coin": 5,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_12",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "したでなめる",
                "condition": "normal",
                "weight": 45,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "dark",
                    "count": 3
                  }
                ]
              },
              {
                "name": "レロレロレロ",
                "condition": "normal",
                "weight": 55,
                "skills": [
                  {
                    "type": "damage",
                    "value": 453,
                    "repeat": 2
                  },
                  {
                    "type": "time_reduce",
                    "seconds": 1,
                    "turn": 1
                  }
                ]
              },
              {
                "name": "したなめ〜ん",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "bind",
                    "target": "random",
                    "countMin": 2,
                    "countMax": 4,
                    "turnMin": 1,
                    "turnMax": 2
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "イシツブテ",
          "img": "mp74.png",
          "attr": "light",
          "hp": 750,
          "atk": 433,
          "def": 550,
          "turnInterval": 2,
          "size": "S",
          "exp": 96,
          "coin": 16,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "いわおとし",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.3
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "ロコン",
          "img": "mp37.png",
          "attr": "fire",
          "hp": 2330,
          "atk": 222,
          "def": 20,
          "turnInterval": 1,
          "size": "S",
          "exp": 256,
          "coin": 14,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "ディグダ",
          "img": "mp50.png",
          "attr": "light",
          "hp": 1801,
          "atk": 225,
          "def": 160,
          "turnInterval": 1,
          "size": "S",
          "exp": 200,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "あなをほる",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "attack_buff",
                  "rate": 1.5,
                  "turn": 2
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m4": {
          "name": "サンド",
          "img": "mp27.png",
          "attr": "light",
          "hp": 1601,
          "atk": 777,
          "def": 539,
          "turnInterval": 3,
          "size": "S",
          "exp": 243,
          "coin": 7,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m5": {
          "name": "ガーディ",
          "img": "mp58.png",
          "attr": "fire",
          "hp": 2001,
          "atk": 195,
          "def": 259,
          "turnInterval": 1,
          "size": "S",
          "exp": 90,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m4"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m5",
            "m2",
            "m2",
            "m3"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 10,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1500,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "8-boss": {
    "bgImg": "dungeon8.png",
    "bgm": "b6.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ディグダ",
            "img": "mp50.png",
            "attr": "light",
            "hp": 1801,
            "atk": 225,
            "def": 160,
            "turnInterval": 1,
            "size": "S",
            "exp": 1800,
            "coin": 12,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_4",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "あなをほる",
                "condition": "normal",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "attack_buff",
                    "rate": 1.5,
                    "turn": 2
                  }
                ],
                "hpBelow": 50,
                "weight": 50
              }
            ],
            "isBoss": false,
            "ofudaDrop": {
              "enabled": true,
              "item": "ohuda1",
              "rate": 0.1,
              "count": 1
            }
          },
          {
            "name": "ロコン",
            "img": "mp37.png",
            "attr": "fire",
            "hp": 2330,
            "atk": 222,
            "def": 20,
            "turnInterval": 1,
            "size": "S",
            "exp": 256,
            "coin": 14,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_1",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              }
            ]
          },
          {
            "name": "ディグダ",
            "img": "mp50.png",
            "attr": "light",
            "hp": 1801,
            "atk": 225,
            "def": 160,
            "turnInterval": 1,
            "size": "S",
            "exp": 200,
            "coin": 12,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_4",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "あなをほる",
                "condition": "normal",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "attack_buff",
                    "rate": 1.5,
                    "turn": 2
                  }
                ],
                "hpBelow": 50,
                "weight": 50
              }
            ],
            "isBoss": false
          }
        ]
      },
      {
        "enemies": [
          {
            "name": "マンキー",
            "img": "mp56.png",
            "attr": "fire",
            "hp": 1801,
            "atk": 205,
            "def": 20,
            "turnInterval": 1,
            "size": "S",
            "exp": 88,
            "coin": 12,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle1",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "グロウパンチ",
                "condition": "normal",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "attack_buff",
                    "rate": 1.5,
                    "turn": 2
                  }
                ],
                "hpBelow": 50,
                "weight": 50
              }
            ],
            "isBoss": false
          },
          {
            "name": "マンキー",
            "img": "mp56.png",
            "attr": "fire",
            "hp": 1801,
            "atk": 205,
            "def": 20,
            "turnInterval": 1,
            "size": "S",
            "exp": 88,
            "coin": 12,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle1",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "グロウパンチ",
                "condition": "normal",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "attack_buff",
                    "rate": 1.5,
                    "turn": 2
                  }
                ],
                "hpBelow": 50,
                "weight": 50
              }
            ],
            "isBoss": false
          },
          {
            "name": "マンキー",
            "img": "mp56.png",
            "attr": "fire",
            "hp": 1801,
            "atk": 205,
            "def": 20,
            "turnInterval": 1,
            "size": "S",
            "exp": 88,
            "coin": 12,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle1",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "グロウパンチ",
                "condition": "normal",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "attack_buff",
                    "rate": 1.5,
                    "turn": 2
                  }
                ],
                "hpBelow": 50,
                "weight": 50
              }
            ],
            "isBoss": false
          }
        ]
      },
      {
        "enemies": [
          {
            "name": "イシツブテ",
            "img": "mp74.png",
            "attr": "light",
            "hp": 750,
            "atk": 433,
            "def": 550,
            "turnInterval": 2,
            "size": "S",
            "exp": 96,
            "coin": 16,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_4",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "いわおとし",
                "condition": "normal",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.3
                  }
                ],
                "hpBelow": 50,
                "weight": 50
              }
            ],
            "isBoss": false
          },
          {
            "name": "ポニータ",
            "img": "mp77.png",
            "attr": "fire",
            "hp": 1800,
            "atk": 269,
            "def": 200,
            "turnInterval": 1,
            "size": "M",
            "exp": 80,
            "coin": 10,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_1",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "いかり",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "attack_buff",
                    "rate": 2,
                    "turn": -1
                  }
                ]
              }
            ],
            "isBoss": false
          },
          {
            "name": "ポニータ",
            "img": "mp77.png",
            "attr": "fire",
            "hp": 1800,
            "atk": 269,
            "def": 200,
            "turnInterval": 1,
            "size": "M",
            "exp": 80,
            "coin": 10,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_1",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "いかり",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "attack_buff",
                    "rate": 2,
                    "turn": -1
                  }
                ]
              }
            ],
            "isBoss": false
          }
        ]
      },
      {
        "enemies": [
          {
            "name": "ベロリンガ",
            "img": "mp108.png",
            "attr": "fire",
            "hp": 20000,
            "atk": 613,
            "def": 0,
            "turnInterval": 2,
            "size": "M",
            "exp": 300,
            "coin": 5,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_12",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "したでなめる",
                "condition": "normal",
                "weight": 45,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "dark",
                    "count": 3
                  }
                ]
              },
              {
                "name": "レロレロレロ",
                "condition": "normal",
                "weight": 55,
                "skills": [
                  {
                    "type": "damage",
                    "value": 453,
                    "repeat": 2
                  },
                  {
                    "type": "time_reduce",
                    "seconds": 1,
                    "turn": 1
                  }
                ]
              },
              {
                "name": "したなめ〜ん",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "bind",
                    "target": "random",
                    "countMin": 2,
                    "countMax": 4,
                    "turnMin": 1,
                    "turnMax": 2
                  }
                ]
              }
            ],
            "isBoss": false
          }
        ]
      },
      {
        "enemies": [
          {
            "name": "サワムラー",
            "img": "mp106.png",
            "attr": "fire",
            "hp": 30000,
            "atk": 783,
            "def": 0,
            "turnInterval": 2,
            "size": "L",
            "exp": 0,
            "coin": 10,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_12",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "まわしげり",
                "condition": "normal",
                "weight": 45,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "fire",
                    "count": 3
                  }
                ]
              },
              {
                "name": "にどげり",
                "condition": "normal",
                "weight": 55,
                "skills": [
                  {
                    "type": "damage",
                    "value": 532,
                    "repeat": 2
                  }
                ]
              },
              {
                "name": "⚠️かまえ",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "attr_guard",
                    "attr": "fire",
                    "rate": 25,
                    "turn": 3
                  },
                  {
                    "type": "attr_guard",
                    "attr": "water",
                    "rate": 25,
                    "turn": 3
                  },
                  {
                    "type": "attr_guard",
                    "attr": "light",
                    "rate": 25,
                    "turn": 3
                  }
                ]
              }
            ],
            "isBoss": true
          },
          {
            "name": "エビワラー",
            "img": "mp107.png",
            "attr": "fire",
            "hp": 45000,
            "atk": 420,
            "def": 500,
            "turnInterval": 1,
            "size": "L",
            "exp": 1000,
            "coin": 30,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle12",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "ストレート",
                "condition": "normal",
                "weight": 45,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.3
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "fire",
                    "count": 5
                  }
                ]
              },
              {
                "name": "ジャブ",
                "condition": "normal",
                "weight": 55,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "convert",
                    "from": "water",
                    "to": "wood"
                  }
                ]
              },
              {
                "name": "マッハパンチ",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "⚠️いかり",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "attack_buff",
                    "rate": 1.2,
                    "turn": -1
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1500,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "9-1": {
    "bgImg": "dungeon9.png",
    "bgm": "b7.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "コイキング",
            "img": "mp129.png",
            "attr": "water",
            "hp": 60000,
            "atk": 613,
            "def": 0,
            "turnInterval": 1,
            "size": "S",
            "exp": 500,
            "coin": 15,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.1
            },
            "drops": [
              {
                "item": "puzzle22",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "はねる",
                "condition": "battle_start",
                "once": true,
                "skills": []
              },
              {
                "name": "はねる",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "water",
                    "count": 1
                  }
                ]
              },
              {
                "name": "はねる",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "water",
                    "count": 2
                  }
                ]
              },
              {
                "name": "はねる",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "time_reduce",
                    "seconds": 1,
                    "turn": 1
                  }
                ]
              },
              {
                "name": "⚠️はかいこうせん",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_ratio",
                    "basis": "max",
                    "rate": 100
                  }
                ]
              }
            ],
            "isBoss": true,
            "actionMode": "sequence"
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "コダック",
          "img": "mp54.png",
          "attr": "water",
          "hp": 2150,
          "atk": 512,
          "def": 250,
          "turnInterval": 2,
          "size": "S",
          "exp": 106,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "ズバット",
          "img": "mp41.png",
          "attr": "dark",
          "hp": 2450,
          "atk": 299,
          "def": 50,
          "turnInterval": 1,
          "size": "S",
          "exp": 196,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 80,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "あやしいひかり",
              "condition": "normal",
              "weight": 20,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "blind"
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "ニョロモ",
          "img": "mp60.png",
          "attr": "water",
          "hp": 2201,
          "atk": 235,
          "def": 160,
          "turnInterval": 1,
          "size": "S",
          "exp": 200,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "みずあそび",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "attr_guard",
                  "attr": "fire",
                  "rate": 99,
                  "turn": 1
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m4": {
          "name": "メノクラゲ",
          "img": "mp72.png",
          "attr": "water",
          "hp": 1801,
          "atk": 977,
          "def": 539,
          "turnInterval": 3,
          "size": "S",
          "exp": 243,
          "coin": 7,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m5": {
          "name": "トサキント",
          "img": "mp118.png",
          "attr": "water",
          "hp": 2000,
          "atk": 225,
          "def": 300,
          "turnInterval": 1,
          "size": "S",
          "exp": 110,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m4"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m5",
            "m2",
            "m2",
            "m3"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1500,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "9-2": {
    "bgImg": "dungeon9.png",
    "bgm": "b7.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ドククラゲ",
            "img": "mp73.png",
            "attr": "water",
            "hp": 40000,
            "atk": 1060,
            "def": 500,
            "turnInterval": 2,
            "size": "L",
            "exp": 300,
            "coin": 10,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05,
              "monsterId": 72
            },
            "drops": [
              {
                "item": "spuzzle_22",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "スモッグ",
                "condition": "normal",
                "weight": 60,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "poison",
                    "count": 3
                  }
                ]
              },
              {
                "name": "ふしょくのキリ",
                "condition": "normal",
                "weight": 40,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "random_to",
                    "to": "poison"
                  }
                ]
              },
              {
                "name": "めんえき",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "attr_guard",
                    "attr": "wood",
                    "rate": 50,
                    "turn": -1
                  },
                  {
                    "type": "board_change",
                    "pattern": "convert",
                    "from": "water",
                    "to": "poison"
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "コダック",
          "img": "mp54.png",
          "attr": "water",
          "hp": 2150,
          "atk": 512,
          "def": 250,
          "turnInterval": 2,
          "size": "S",
          "exp": 106,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "ズバット",
          "img": "mp41.png",
          "attr": "dark",
          "hp": 2450,
          "atk": 299,
          "def": 50,
          "turnInterval": 1,
          "size": "S",
          "exp": 196,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 80,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "あやしいひかり",
              "condition": "normal",
              "weight": 20,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "blind"
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "ニョロモ",
          "img": "mp60.png",
          "attr": "water",
          "hp": 2201,
          "atk": 235,
          "def": 160,
          "turnInterval": 1,
          "size": "S",
          "exp": 200,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "みずあそび",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "attr_guard",
                  "attr": "fire",
                  "rate": 99,
                  "turn": 1
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m4": {
          "name": "メノクラゲ",
          "img": "mp72.png",
          "attr": "water",
          "hp": 1801,
          "atk": 977,
          "def": 539,
          "turnInterval": 3,
          "size": "S",
          "exp": 243,
          "coin": 7,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m5": {
          "name": "トサキント",
          "img": "mp118.png",
          "attr": "water",
          "hp": 2000,
          "atk": 225,
          "def": 300,
          "turnInterval": 1,
          "size": "S",
          "exp": 110,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m4"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m5",
            "m2",
            "m2",
            "m3"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1500,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "9-3": {
    "bgImg": "dungeon9.png",
    "bgm": "b7.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ヤドン",
            "img": "mp79.png",
            "attr": "water",
            "hp": 8001,
            "atk": 402,
            "def": 0,
            "turnInterval": 2,
            "size": "S",
            "exp": 5,
            "coin": 10,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle2",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              }
            ]
          },
          {
            "name": "ヤドラン",
            "img": "mp80.png",
            "attr": "water",
            "hp": 35000,
            "atk": 2200,
            "def": 450,
            "turnInterval": 3,
            "size": "L",
            "exp": 500,
            "coin": 0,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05,
              "monsterId": 79
            },
            "drops": [
              {
                "item": "puzzle22",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              }
            ],
            "isBoss": true
          },
          {
            "name": "ヤドン",
            "img": "mp79.png",
            "attr": "water",
            "hp": 7801,
            "atk": 402,
            "def": 200,
            "turnInterval": 2,
            "size": "S",
            "exp": 5,
            "coin": 10,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle2",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              }
            ]
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "コダック",
          "img": "mp54.png",
          "attr": "water",
          "hp": 2150,
          "atk": 512,
          "def": 250,
          "turnInterval": 2,
          "size": "S",
          "exp": 106,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "ズバット",
          "img": "mp41.png",
          "attr": "dark",
          "hp": 2450,
          "atk": 299,
          "def": 50,
          "turnInterval": 1,
          "size": "S",
          "exp": 196,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 80,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "あやしいひかり",
              "condition": "normal",
              "weight": 20,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "blind"
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "ニョロモ",
          "img": "mp60.png",
          "attr": "water",
          "hp": 2201,
          "atk": 235,
          "def": 160,
          "turnInterval": 1,
          "size": "S",
          "exp": 200,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "みずあそび",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "attr_guard",
                  "attr": "fire",
                  "rate": 99,
                  "turn": 1
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m4": {
          "name": "メノクラゲ",
          "img": "mp72.png",
          "attr": "water",
          "hp": 1801,
          "atk": 977,
          "def": 539,
          "turnInterval": 3,
          "size": "S",
          "exp": 243,
          "coin": 7,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m5": {
          "name": "トサキント",
          "img": "mp118.png",
          "attr": "water",
          "hp": 2000,
          "atk": 225,
          "def": 300,
          "turnInterval": 1,
          "size": "S",
          "exp": 110,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m6": {
          "name": "コイキング",
          "img": "mp129.png",
          "attr": "water",
          "hp": 3000,
          "atk": 1,
          "def": 0,
          "turnInterval": 1,
          "size": "S",
          "exp": 130,
          "coin": 0,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "はねる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "time_reduce",
                  "seconds": 1,
                  "turn": 1
                }
              ]
            },
            {
              "name": "はねる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "time_reduce",
                  "seconds": 1,
                  "turn": 1
                }
              ]
            },
            {
              "name": "はねる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "time_reduce",
                  "seconds": 1,
                  "turn": 1
                }
              ]
            },
            {
              "name": "⚠️はかいこうせん",
              "condition": "normal",
              "weight": 100,
              "once": false,
              "skills": [
                {
                  "type": "damage_ratio",
                  "basis": "max",
                  "rate": 100
                }
              ]
            }
          ],
          "actionMode": "sequence"
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m5",
            "m6"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m4"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m5",
            "m6",
            "m6",
            "m3"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1500,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "9-4": {
    "bgImg": "dungeon9.png",
    "bgm": "b7.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "スターミー",
            "img": "mp121.png",
            "attr": "water",
            "hp": 60000,
            "atk": 1360,
            "def": 0,
            "turnInterval": 2,
            "size": "L",
            "exp": 500,
            "coin": 10,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05,
              "monsterId": 120
            },
            "drops": [
              {
                "item": "puzzle22",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "サイコショック",
                "condition": "normal",
                "weight": 60,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "atk_down",
                    "target": "attr",
                    "attr": "water",
                    "rate": 25,
                    "turn": 1
                  },
                  {
                    "type": "atk_down",
                    "target": "attr",
                    "attr": "light",
                    "rate": 25,
                    "turn": 1
                  }
                ]
              },
              {
                "name": "ねんりき",
                "condition": "normal",
                "weight": 40,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.1
                  },
                  {
                    "type": "combo_absorb",
                    "turn": 1,
                    "combo": 5
                  }
                ]
              },
              {
                "name": "サイコキネシス",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "damage_ratio",
                    "basis": "current",
                    "rate": 50
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "コダック",
          "img": "mp54.png",
          "attr": "water",
          "hp": 2150,
          "atk": 512,
          "def": 250,
          "turnInterval": 2,
          "size": "S",
          "exp": 106,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "ズバット",
          "img": "mp41.png",
          "attr": "dark",
          "hp": 2450,
          "atk": 299,
          "def": 50,
          "turnInterval": 1,
          "size": "S",
          "exp": 196,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 80,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "あやしいひかり",
              "condition": "normal",
              "weight": 20,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "blind"
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "ニョロモ",
          "img": "mp60.png",
          "attr": "water",
          "hp": 2201,
          "atk": 235,
          "def": 160,
          "turnInterval": 1,
          "size": "S",
          "exp": 200,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "みずあそび",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "attr_guard",
                  "attr": "fire",
                  "rate": 99,
                  "turn": 1
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m4": {
          "name": "メノクラゲ",
          "img": "mp72.png",
          "attr": "water",
          "hp": 1801,
          "atk": 977,
          "def": 539,
          "turnInterval": 3,
          "size": "S",
          "exp": 243,
          "coin": 7,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m5": {
          "name": "トサキント",
          "img": "mp118.png",
          "attr": "water",
          "hp": 2000,
          "atk": 225,
          "def": 300,
          "turnInterval": 1,
          "size": "S",
          "exp": 110,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m6": {
          "name": "コイキング",
          "img": "mp129.png",
          "attr": "water",
          "hp": 3000,
          "atk": 1,
          "def": 0,
          "turnInterval": 1,
          "size": "S",
          "exp": 130,
          "coin": 0,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "はねる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "time_reduce",
                  "seconds": 1,
                  "turn": 1
                }
              ]
            },
            {
              "name": "はねる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "time_reduce",
                  "seconds": 1,
                  "turn": 1
                }
              ]
            },
            {
              "name": "はねる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "time_reduce",
                  "seconds": 1,
                  "turn": 1
                }
              ]
            },
            {
              "name": "⚠️はかいこうせん",
              "condition": "normal",
              "weight": 100,
              "once": false,
              "skills": [
                {
                  "type": "damage_ratio",
                  "basis": "max",
                  "rate": 100
                }
              ]
            }
          ],
          "actionMode": "sequence"
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m5",
            "m6"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m4"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m5",
            "m6",
            "m6",
            "m3"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1500,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "9-boss": {
    "bgImg": "dungeon9.png",
    "bgm": "b7.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ギャラドス",
            "img": "mp130.png",
            "attr": "water",
            "hp": 80000,
            "atk": 910,
            "def": 0,
            "turnInterval": 1,
            "size": "XL",
            "exp": 2000,
            "coin": 30,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05,
              "monsterId": 129
            },
            "drops": [
              {
                "item": "spuzzle_22",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "たいかいのいあつ",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "atk_down",
                    "target": "attr",
                    "attr": "water",
                    "rate": 99,
                    "turn": 99
                  }
                ]
              },
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ],
                "hpAbove": 76
              },
              {
                "name": "うずしお",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "water",
                    "count": 6
                  },
                  {
                    "type": "attack_buff",
                    "rate": 1.2,
                    "turn": 1
                  }
                ],
                "hpBelow": 75
              },
              {
                "name": "⚠️あばれる",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage",
                    "value": 880,
                    "repeat": 4
                  }
                ],
                "hpBelow": 40
              },
              {
                "name": "⚠️はかいこうせん",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "damage_ratio",
                    "basis": "max",
                    "rate": 100
                  }
                ],
                "hpBelow": 3
              }
            ],
            "isBoss": true,
            "ofudaDrop": {
              "enabled": true,
              "item": "ohuda1",
              "rate": 0.1,
              "count": 1
            }
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "コダック",
          "img": "mp54.png",
          "attr": "water",
          "hp": 2350,
          "atk": 612,
          "def": 250,
          "turnInterval": 2,
          "size": "S",
          "exp": 106,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "ズバット",
          "img": "mp41.png",
          "attr": "dark",
          "hp": 2750,
          "atk": 329,
          "def": 50,
          "turnInterval": 1,
          "size": "S",
          "exp": 196,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 80,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "あやしいひかり",
              "condition": "normal",
              "weight": 20,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "blind"
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "ニョロモ",
          "img": "mp60.png",
          "attr": "water",
          "hp": 2201,
          "atk": 285,
          "def": 360,
          "turnInterval": 1,
          "size": "S",
          "exp": 200,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 50,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "みずあそび",
              "condition": "normal",
              "once": true,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "attr_guard",
                  "attr": "fire",
                  "rate": 99,
                  "turn": 1
                }
              ],
              "hpBelow": 50,
              "weight": 50
            }
          ],
          "isBoss": false
        },
        "m4": {
          "name": "メノクラゲ",
          "img": "mp72.png",
          "attr": "water",
          "hp": 2001,
          "atk": 1277,
          "def": 539,
          "turnInterval": 3,
          "size": "S",
          "exp": 243,
          "coin": 7,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m5": {
          "name": "トサキント",
          "img": "mp118.png",
          "attr": "water",
          "hp": 2200,
          "atk": 255,
          "def": 300,
          "turnInterval": 1,
          "size": "S",
          "exp": 110,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m6": {
          "name": "コイキング",
          "img": "mp129.png",
          "attr": "water",
          "hp": 3500,
          "atk": 1,
          "def": 0,
          "turnInterval": 1,
          "size": "S",
          "exp": 130,
          "coin": 0,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "はねる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "time_reduce",
                  "seconds": 1,
                  "turn": 1
                }
              ]
            },
            {
              "name": "はねる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "time_reduce",
                  "seconds": 1,
                  "turn": 1
                }
              ]
            },
            {
              "name": "はねる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "time_reduce",
                  "seconds": 1,
                  "turn": 1
                }
              ]
            },
            {
              "name": "⚠️はかいこうせん",
              "condition": "normal",
              "weight": 100,
              "once": false,
              "skills": [
                {
                  "type": "damage_ratio",
                  "basis": "max",
                  "rate": 100
                }
              ]
            },
            {
              "name": "はねる",
              "condition": "battle_start",
              "once": true,
              "skills": [
                {
                  "type": "board_change",
                  "pattern": "spawn",
                  "to": "water",
                  "count": 3
                }
              ]
            }
          ],
          "actionMode": "sequence"
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m5",
            "m6"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m4"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m5",
            "m6",
            "m6",
            "m3"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1500,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "10-1": {
    "bgImg": "dungeon10.png",
    "bgm": "b2.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ウツドン",
            "img": "mp70.png",
            "attr": "wood",
            "hp": 50000,
            "atk": 1600,
            "def": 600,
            "turnInterval": 2,
            "size": "M",
            "exp": 300,
            "coin": 10,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05,
              "monsterId": 69
            },
            "drops": [
              {
                "item": "puzzle32",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "ポイズンリーフ",
                "condition": "normal",
                "weight": 60,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "convert",
                    "to": "poison",
                    "from": "dark"
                  }
                ]
              },
              {
                "name": "すいとる",
                "condition": "normal",
                "weight": 40,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "heal_self",
                    "rate": 0.2
                  }
                ]
              },
              {
                "name": "めんえき",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "attr_guard",
                    "attr": "dark",
                    "rate": 50,
                    "turn": -1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "poison",
                    "count": 3
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "トランセル",
          "img": "mp11.png",
          "attr": "wood",
          "hp": 2150,
          "atk": 612,
          "def": 400,
          "turnInterval": 2,
          "size": "S",
          "exp": 120,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 10
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "パラス",
          "img": "mp46.png",
          "attr": "wood",
          "hp": 2650,
          "atk": 311,
          "def": 50,
          "turnInterval": 1,
          "size": "S",
          "exp": 200,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "マダツボミ",
          "img": "mp69.png",
          "attr": "wood",
          "hp": 2200,
          "atk": 245,
          "def": 230,
          "turnInterval": 1,
          "size": "S",
          "exp": 200,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m4": {
          "name": "ビードル",
          "img": "mp13.png",
          "attr": "wood",
          "hp": 2900,
          "atk": 999,
          "def": 0,
          "turnInterval": 3,
          "size": "S",
          "exp": 220,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m5": {
          "name": "コンパン",
          "img": "mp48.png",
          "attr": "dark",
          "hp": 2500,
          "atk": 333,
          "def": 100,
          "turnInterval": 1,
          "size": "S",
          "exp": 95,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "ライフダウン",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage",
                  "value": 222,
                  "repeat": 3
                },
                {
                  "type": "rec_down",
                  "value": 0.5,
                  "turn": 2
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m4"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m5",
            "m2",
            "m2",
            "m3"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1500,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "10-2": {
    "bgImg": "dungeon10.png",
    "bgm": "b2.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "パラセクト",
            "img": "mp47.png",
            "attr": "wood",
            "hp": 60000,
            "atk": 895,
            "def": 300,
            "turnInterval": 1,
            "size": "M",
            "exp": 500,
            "coin": 10,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05,
              "monsterId": 46
            },
            "drops": [
              {
                "item": "puzzle32",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "ねむりごな",
                "condition": "normal",
                "weight": 60,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "skill_seal",
                    "turn": 1
                  }
                ]
              },
              {
                "name": "リーフブレード",
                "condition": "normal",
                "weight": 40,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.2
                  },
                  {
                    "type": "board_change",
                    "pattern": "convert",
                    "from": "fire",
                    "to": "wood"
                  }
                ]
              },
              {
                "name": "ほうし",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "no_fall",
                    "turn": 99
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "トランセル",
          "img": "mp11.png",
          "attr": "wood",
          "hp": 2150,
          "atk": 612,
          "def": 400,
          "turnInterval": 2,
          "size": "S",
          "exp": 120,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 10
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "パラス",
          "img": "mp46.png",
          "attr": "wood",
          "hp": 2650,
          "atk": 311,
          "def": 50,
          "turnInterval": 1,
          "size": "S",
          "exp": 200,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "マダツボミ",
          "img": "mp69.png",
          "attr": "wood",
          "hp": 2200,
          "atk": 245,
          "def": 230,
          "turnInterval": 1,
          "size": "S",
          "exp": 200,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m4": {
          "name": "ビードル",
          "img": "mp13.png",
          "attr": "wood",
          "hp": 2900,
          "atk": 999,
          "def": 0,
          "turnInterval": 3,
          "size": "S",
          "exp": 220,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m5": {
          "name": "コンパン",
          "img": "mp48.png",
          "attr": "dark",
          "hp": 2500,
          "atk": 333,
          "def": 100,
          "turnInterval": 1,
          "size": "S",
          "exp": 95,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "ライフダウン",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage",
                  "value": 222,
                  "repeat": 3
                },
                {
                  "type": "rec_down",
                  "value": 0.5,
                  "turn": 2
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m4"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m5",
            "m2",
            "m2",
            "m3"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1500,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "10-3": {
    "bgImg": "dungeon10.png",
    "bgm": "b2.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "メタモン",
            "img": "mp132.png",
            "attr": "dark",
            "hp": 999999,
            "atk": 1,
            "def": 0,
            "turnInterval": 1,
            "size": "S",
            "exp": 1000,
            "coin": 10,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle52",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "ぼくとあそぼうもん！",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "no_fall",
                    "turn": 99
                  },
                  {
                    "type": "skill_seal",
                    "turn": 99
                  },
                  {
                    "type": "bind",
                    "target": "all",
                    "turnMin": 5,
                    "turnMax": 5
                  }
                ]
              },
              {
                "name": "ブッブー！",
                "condition": "orb_has",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage",
                    "value": 999999,
                    "repeat": 10
                  }
                ],
                "orb": "fire"
              },
              {
                "name": "つぎだよ！",
                "condition": "orb_none",
                "skills": [
                  {
                    "type": "board_change",
                    "pattern": "5color_heal"
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "fire",
                    "count": 5
                  }
                ],
                "orb": "fire"
              },
              {
                "name": "むむっ！やるな？",
                "condition": "orb_none",
                "skills": [
                  {
                    "type": "board_change",
                    "pattern": "5color_heal"
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "fire",
                    "count": 7
                  }
                ],
                "orb": "fire"
              },
              {
                "name": "すごいね！これならどうだ！",
                "condition": "orb_none",
                "skills": [
                  {
                    "type": "board_change",
                    "pattern": "5color_heal"
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "fire",
                    "count": 9
                  }
                ],
                "orb": "fire"
              },
              {
                "name": "これがラストだよ！",
                "condition": "orb_none",
                "skills": [
                  {
                    "type": "board_change",
                    "pattern": "5color_heal"
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "fire",
                    "count": 6
                  },
                  {
                    "type": "time_reduce",
                    "seconds": 2,
                    "turn": 1
                  }
                ],
                "orb": "fire"
              },
              {
                "name": "すごかったよ！またあそぼうね！",
                "condition": "orb_none",
                "skills": [
                  {
                    "type": "vanish"
                  }
                ],
                "orb": "fire"
              },
              {
                "name": "いくよ？",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "board_change",
                    "pattern": "5color_heal",
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "fire",
                    "count": 3,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ]
              },
              {
                "name": "火ドロップをぜんぶけしてね？",
                "condition": "battle_start",
                "once": true,
                "skills": []
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "トランセル",
          "img": "mp11.png",
          "attr": "wood",
          "hp": 2350,
          "atk": 612,
          "def": 400,
          "turnInterval": 2,
          "size": "S",
          "exp": 120,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 10
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "パラス",
          "img": "mp46.png",
          "attr": "wood",
          "hp": 2850,
          "atk": 311,
          "def": 50,
          "turnInterval": 1,
          "size": "S",
          "exp": 200,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "マダツボミ",
          "img": "mp69.png",
          "attr": "wood",
          "hp": 2200,
          "atk": 245,
          "def": 330,
          "turnInterval": 1,
          "size": "S",
          "exp": 200,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m4": {
          "name": "ビードル",
          "img": "mp13.png",
          "attr": "wood",
          "hp": 3200,
          "atk": 999,
          "def": 0,
          "turnInterval": 3,
          "size": "S",
          "exp": 220,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m5": {
          "name": "コンパン",
          "img": "mp48.png",
          "attr": "dark",
          "hp": 2500,
          "atk": 433,
          "def": 100,
          "turnInterval": 1,
          "size": "S",
          "exp": 95,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "ライフダウン",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage",
                  "value": 222,
                  "repeat": 3
                },
                {
                  "type": "rec_down",
                  "value": 0.5,
                  "turn": 2
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m4"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m5",
            "m2",
            "m2",
            "m3"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1500,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "10-4": {
    "bgImg": "dungeon10.png",
    "bgm": "b2.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "モンジャラ",
            "img": "mp114.png",
            "attr": "wood",
            "hp": 15000,
            "atk": 1700,
            "def": 2000,
            "turnInterval": 2,
            "size": "L",
            "exp": 250,
            "coin": 20,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_32",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "つるのムチ",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "wood",
                    "count": 5,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ],
                "hpAbove": 75
              },
              {
                "name": "パワーウィップ",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "combo_absorb",
                    "turn": 1,
                    "combo": 5
                  }
                ],
                "hpBelow": 74
              },
              {
                "name": "もじゃもじゃ",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "attr_guard",
                    "attr": "fire",
                    "rate": 25,
                    "turn": 5
                  }
                ]
              },
              {
                "name": "いかり",
                "condition": "hp<=25%",
                "once": true,
                "skills": [
                  {
                    "type": "action_change",
                    "interval": 1
                  },
                  {
                    "type": "attack_buff",
                    "rate": 1.2,
                    "turn": -1
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "トランセル",
          "img": "mp11.png",
          "attr": "wood",
          "hp": 2350,
          "atk": 612,
          "def": 400,
          "turnInterval": 2,
          "size": "S",
          "exp": 120,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 10
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "パラス",
          "img": "mp46.png",
          "attr": "wood",
          "hp": 2850,
          "atk": 311,
          "def": 50,
          "turnInterval": 1,
          "size": "S",
          "exp": 200,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "マダツボミ",
          "img": "mp69.png",
          "attr": "wood",
          "hp": 2200,
          "atk": 245,
          "def": 330,
          "turnInterval": 1,
          "size": "S",
          "exp": 200,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m4": {
          "name": "コクーン",
          "img": "mp14.png",
          "attr": "wood",
          "hp": 3300,
          "atk": 999,
          "def": 0,
          "turnInterval": 3,
          "size": "S",
          "exp": 230,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m5": {
          "name": "コンパン",
          "img": "mp48.png",
          "attr": "dark",
          "hp": 2500,
          "atk": 433,
          "def": 100,
          "turnInterval": 1,
          "size": "S",
          "exp": 95,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "ライフダウン",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage",
                  "value": 222,
                  "repeat": 3
                },
                {
                  "type": "rec_down",
                  "value": 0.5,
                  "turn": 2
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m4"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m5",
            "m2",
            "m2",
            "m3"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 10,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1750,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "10-boss": {
    "bgImg": "dungeon10.png",
    "bgm": "b2.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "カイロス",
            "img": "mp127.png",
            "attr": "wood",
            "hp": 70000,
            "atk": 960,
            "def": 600,
            "turnInterval": 1,
            "size": "XL",
            "exp": 2250,
            "coin": 30,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_32",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "wood",
                    "count": 5,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ],
                "hpAbove": 85
              },
              {
                "name": "はさむ",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "random_to",
                    "to": "water",
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ],
                "hpBelow": 84
              },
              {
                "name": "シザークロス",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "rec_down",
                    "value": 0.75,
                    "turn": 1
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "れんぞくこうげき",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage",
                    "value": 350,
                    "repeat": 3
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "むしのさざめき",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "time_reduce",
                    "seconds": 1,
                    "turn": 10
                  }
                ]
              },
              {
                "name": "⚠️いかり",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "action_change",
                    "interval": 1
                  }
                ]
              },
              {
                "name": "ハサミギロチン",
                "condition": "hp<=5%",
                "once": true,
                "skills": [
                  {
                    "type": "damage",
                    "value": 999999,
                    "repeat": 1
                  }
                ]
              }
            ],
            "isBoss": true,
            "ofudaDrop": {
              "enabled": true,
              "item": "ohuda1",
              "rate": 0.1,
              "count": 1
            }
          }
        ]
      }
    ],
    "random": {
      "floors": 6,
      "monsters": {
        "m1": {
          "name": "トランセル",
          "img": "mp11.png",
          "attr": "wood",
          "hp": 2350,
          "atk": 612,
          "def": 400,
          "turnInterval": 2,
          "size": "S",
          "exp": 120,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 10
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m2": {
          "name": "タマタマ",
          "img": "mp102.png",
          "attr": "wood",
          "hp": 2850,
          "atk": 411,
          "def": 50,
          "turnInterval": 1,
          "size": "S",
          "exp": 200,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m3": {
          "name": "マダツボミ",
          "img": "mp69.png",
          "attr": "wood",
          "hp": 2200,
          "atk": 245,
          "def": 330,
          "turnInterval": 1,
          "size": "S",
          "exp": 200,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m4": {
          "name": "コクーン",
          "img": "mp14.png",
          "attr": "wood",
          "hp": 3300,
          "atk": 999,
          "def": 0,
          "turnInterval": 3,
          "size": "S",
          "exp": 230,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m5": {
          "name": "コンパン",
          "img": "mp48.png",
          "attr": "dark",
          "hp": 2500,
          "atk": 433,
          "def": 100,
          "turnInterval": 1,
          "size": "S",
          "exp": 95,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "ライフダウン",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage",
                  "value": 222,
                  "repeat": 3
                },
                {
                  "type": "rec_down",
                  "value": 0.5,
                  "turn": 2
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m5"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m5",
            "m4"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m5",
            "m2",
            "m2",
            "m3",
            "m1"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1750,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "11-1": {
    "bgImg": "dungeon11.png",
    "bgm": "b6.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "レアコイル",
            "img": "mp82.png",
            "attr": "light",
            "hp": 85000,
            "atk": 810,
            "def": 0,
            "turnInterval": 1,
            "size": "L",
            "exp": 450,
            "coin": 10,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05,
              "monsterId": 81
            },
            "drops": [
              {
                "item": "puzzle42",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ],
                "hpAbove": 75
              },
              {
                "name": "でんじは",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "bind",
                    "target": "random",
                    "countMin": 1,
                    "countMax": 1,
                    "turnMin": 1,
                    "turnMax": 2
                  }
                ],
                "hpBelow": 74
              },
              {
                "name": "10まんボルト",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.3
                  },
                  {
                    "type": "board_change",
                    "pattern": "convert",
                    "from": "dark",
                    "to": "light",
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ],
                "hpBelow": 40
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "コイル",
          "img": "mp81.png",
          "attr": "light",
          "hp": 3000,
          "atk": 421,
          "def": 280,
          "turnInterval": 1,
          "size": "S",
          "exp": 178,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "ビリリダマ",
          "img": "mp100.png",
          "attr": "light",
          "hp": 3800,
          "atk": 362,
          "def": 0,
          "turnInterval": 1,
          "size": "S",
          "exp": 220,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m3": {
          "name": "ピカチュウ",
          "img": "mp25.png",
          "attr": "light",
          "hp": 3300,
          "atk": 732,
          "def": 150,
          "turnInterval": 2,
          "size": "S",
          "exp": 200,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "アイアンテール",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "dmg_reduce",
                  "rate": 50,
                  "turn": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1",
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m1",
            "m1",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 15,
          "enemies": [
            "m3",
            "m3"
          ]
        },
        {
          "weight": 15,
          "enemies": [
            "m1",
            "m1",
            "m2"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1750,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "11-2": {
    "bgImg": "dungeon11.png",
    "bgm": "b6.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ライチュウ",
            "img": "mp26.png",
            "attr": "light",
            "hp": 80000,
            "atk": 829,
            "def": 50,
            "turnInterval": 1,
            "size": "L",
            "exp": 400,
            "coin": 30,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05,
              "monsterId": 25
            },
            "drops": [
              {
                "item": "puzzle42",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ],
                "hpAbove": 75
              },
              {
                "name": "かいでんぱ",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "roulette",
                    "count": 2,
                    "turn": 1,
                    "sec": 1
                  }
                ],
                "hpBelow": 74
              },
              {
                "name": "ピッカリだま",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.1
                  },
                  {
                    "type": "blind"
                  }
                ],
                "hpBelow": 40
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "コイル",
          "img": "mp81.png",
          "attr": "light",
          "hp": 3000,
          "atk": 441,
          "def": 280,
          "turnInterval": 1,
          "size": "S",
          "exp": 178,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "ビリリダマ",
          "img": "mp100.png",
          "attr": "light",
          "hp": 3800,
          "atk": 382,
          "def": 0,
          "turnInterval": 1,
          "size": "S",
          "exp": 220,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m3": {
          "name": "ピカチュウ",
          "img": "mp25.png",
          "attr": "light",
          "hp": 3300,
          "atk": 762,
          "def": 150,
          "turnInterval": 2,
          "size": "S",
          "exp": 200,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "アイアンテール",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "dmg_reduce",
                  "rate": 50,
                  "turn": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1",
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m1",
            "m1",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 15,
          "enemies": [
            "m3",
            "m3"
          ]
        },
        {
          "weight": 15,
          "enemies": [
            "m1",
            "m1",
            "m2"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1750,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "11-3": {
    "bgImg": "dungeon11.png",
    "bgm": "b6.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "マルマイン",
            "img": "mp101.png",
            "attr": "light",
            "hp": 80000,
            "atk": 800,
            "def": 0,
            "turnInterval": 1,
            "size": "L",
            "exp": 600,
            "coin": 20,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05,
              "monsterId": 100
            },
            "drops": [
              {
                "item": "puzzle42",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ],
                "hpAbove": 75
              },
              {
                "name": "かいでんぱ",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "roulette",
                    "count": 4,
                    "turn": 1,
                    "sec": 1
                  }
                ],
                "hpBelow": 74
              },
              {
                "name": "エレキタックル",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.1
                  },
                  {
                    "type": "time_reduce",
                    "seconds": 1,
                    "turn": 1
                  }
                ],
                "hpBelow": 74
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "コイル",
          "img": "mp81.png",
          "attr": "light",
          "hp": 3000,
          "atk": 441,
          "def": 280,
          "turnInterval": 1,
          "size": "S",
          "exp": 178,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "ビリリダマ",
          "img": "mp100.png",
          "attr": "light",
          "hp": 3800,
          "atk": 382,
          "def": 0,
          "turnInterval": 1,
          "size": "S",
          "exp": 220,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m3": {
          "name": "ピカチュウ",
          "img": "mp25.png",
          "attr": "light",
          "hp": 3300,
          "atk": 762,
          "def": 150,
          "turnInterval": 2,
          "size": "S",
          "exp": 200,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "アイアンテール",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "dmg_reduce",
                  "rate": 50,
                  "turn": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1",
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m1",
            "m1",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 15,
          "enemies": [
            "m3",
            "m3"
          ]
        },
        {
          "weight": 15,
          "enemies": [
            "m1",
            "m1",
            "m2"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1750,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "11-4": {
    "bgImg": "dungeon11.png",
    "bgm": "b6.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "エレブー",
            "img": "mp125.png",
            "attr": "light",
            "hp": 90000,
            "atk": 500,
            "def": 250,
            "turnInterval": 1,
            "size": "L",
            "exp": 1000,
            "coin": 0,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_42",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "5...",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": []
              },
              {
                "name": "4...",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "light",
                    "count": 5,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ]
              },
              {
                "name": "3...",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "no_fall",
                    "turn": 1
                  }
                ]
              },
              {
                "name": "2...",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "combo_absorb",
                    "turn": 1,
                    "combo": 5
                  }
                ]
              },
              {
                "name": "1...",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "attack_buff",
                    "rate": 99,
                    "turn": -1
                  }
                ]
              },
              {
                "name": "ファイアァァァーーー!!!",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage",
                    "value": 99999,
                    "repeat": 15
                  }
                ]
              }
            ],
            "isBoss": true,
            "actionMode": "sequence"
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "コイル",
          "img": "mp81.png",
          "attr": "light",
          "hp": 3000,
          "atk": 441,
          "def": 280,
          "turnInterval": 1,
          "size": "S",
          "exp": 178,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "ビリリダマ",
          "img": "mp100.png",
          "attr": "light",
          "hp": 3800,
          "atk": 382,
          "def": 0,
          "turnInterval": 1,
          "size": "S",
          "exp": 220,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m3": {
          "name": "ピカチュウ",
          "img": "mp25.png",
          "attr": "light",
          "hp": 3300,
          "atk": 762,
          "def": 150,
          "turnInterval": 2,
          "size": "S",
          "exp": 200,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "アイアンテール",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "dmg_reduce",
                  "rate": 50,
                  "turn": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1",
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m1",
            "m1",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 15,
          "enemies": [
            "m3",
            "m3"
          ]
        },
        {
          "weight": 15,
          "enemies": [
            "m1",
            "m1",
            "m2"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 1750,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "11-boss": {
    "bgImg": "dungeon11.png",
    "bgm": "b6.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "サンダー",
            "img": "mp145.png",
            "attr": "light",
            "hp": 80000,
            "atk": 1920,
            "def": 200,
            "turnInterval": 1,
            "size": "XL",
            "exp": 3500,
            "coin": 25,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle43",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "プレッシャー",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "skill_seal",
                    "turn": 3
                  }
                ]
              },
              {
                "name": "かぜまとい",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "attr_guard",
                    "attr": "dark",
                    "rate": 75,
                    "turn": 5
                  }
                ]
              },
              {
                "name": "エアスラッシュ",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "attr_guard",
                    "attr": "wood",
                    "rate": 50,
                    "turn": 1
                  }
                ]
              },
              {
                "name": "ショートボルト",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.1
                  },
                  {
                    "type": "roulette",
                    "count": 2,
                    "turn": 3,
                    "sec": 1
                  }
                ]
              },
              {
                "name": "パラボラチャージ",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.1
                  },
                  {
                    "type": "heal_self",
                    "rate": 0.05
                  }
                ]
              },
              {
                "name": "ボルトフロート",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.2
                  },
                  {
                    "type": "combo_absorb",
                    "turn": 1,
                    "combo": 5
                  }
                ]
              },
              {
                "name": "ゆうだち",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.2
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "water",
                    "count": 10,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  },
                  {
                    "type": "attr_guard",
                    "attr": "water",
                    "rate": 50,
                    "turn": 1
                  }
                ]
              },
              {
                "name": "⚠️ぼうふう",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_ratio",
                    "basis": "max",
                    "rate": 50
                  },
                  {
                    "type": "board_change",
                    "pattern": "5color_heal",
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ]
              }
            ],
            "isBoss": true,
            "actionMode": "sequence",
            "ofudaDrop": {
              "enabled": true,
              "item": "ohuda1",
              "rate": 0.1,
              "count": 1
            }
          }
        ]
      }
    ],
    "random": {
      "floors": 6,
      "monsters": {
        "m1": {
          "name": "コイル",
          "img": "mp81.png",
          "attr": "light",
          "hp": 3300,
          "atk": 441,
          "def": 280,
          "turnInterval": 1,
          "size": "S",
          "exp": 178,
          "coin": 12,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "ビリリダマ",
          "img": "mp100.png",
          "attr": "light",
          "hp": 3800,
          "atk": 382,
          "def": 100,
          "turnInterval": 1,
          "size": "S",
          "exp": 220,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m3": {
          "name": "ピカチュウ",
          "img": "mp25.png",
          "attr": "light",
          "hp": 3500,
          "atk": 782,
          "def": 150,
          "turnInterval": 2,
          "size": "S",
          "exp": 200,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "アイアンテール",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "dmg_reduce",
                  "rate": 50,
                  "turn": 1
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "ポリゴン",
          "img": "mp137.png",
          "attr": "fire",
          "hp": 4200,
          "atk": 1100,
          "def": 100,
          "turnInterval": 2,
          "size": "M",
          "exp": 500,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle12",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1",
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m1",
            "m1",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m4"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 5000,
          "turnInterval": 2,
          "size": "S",
          "exp": 2000,
          "coin": 75,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "12-1": {
    "bgImg": "dungeon12.png",
    "bgm": "b7.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ピクシー",
            "img": "mp36.png",
            "attr": "dark",
            "hp": 50000,
            "atk": 2680,
            "def": 500,
            "turnInterval": 2,
            "size": "M",
            "exp": 500,
            "coin": 20,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05,
              "monsterId": 35
            },
            "drops": [
              {
                "item": "spuzzle_52",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ],
                "hpAbove": 75
              },
              {
                "name": "ムーンフォース",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.2
                  },
                  {
                    "type": "board_change",
                    "pattern": "multi",
                    "to": "water",
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": true,
                    "orb_dark": true,
                    "orb_heal": true,
                    "orb_poison": ""
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "せんせいじゅつ",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.1
                  }
                ]
              },
              {
                "name": "てっぺき",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "dmg_reduce",
                    "rate": 75,
                    "turn": 2
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "ピッピ",
          "img": "mp35.png",
          "attr": "dark",
          "hp": 3300,
          "atk": 451,
          "def": 380,
          "turnInterval": 1,
          "size": "S",
          "exp": 200,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "プリン",
          "img": "mp39.png",
          "attr": "dark",
          "hp": 3900,
          "atk": 400,
          "def": 100,
          "turnInterval": 1,
          "size": "S",
          "exp": 230,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m3": {
          "name": "スリープ",
          "img": "mp96.png",
          "attr": "dark",
          "hp": 3750,
          "atk": 982,
          "def": 150,
          "turnInterval": 2,
          "size": "S",
          "exp": 220,
          "coin": 22,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "さいみんじゅつ",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "bind",
                  "target": "random",
                  "countMin": 1,
                  "countMax": 1,
                  "turnMin": 3,
                  "turnMax": 3
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "ユンゲラー",
          "img": "mp64.png",
          "attr": "dark",
          "hp": 4000,
          "atk": 950,
          "def": 120,
          "turnInterval": 2,
          "size": "M",
          "exp": 300,
          "coin": 30,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 63
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "パイロキネシス",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.1
                },
                {
                  "type": "board_change",
                  "pattern": "random_to",
                  "to": "fire",
                  "orb_fire": "",
                  "orb_water": "",
                  "orb_wood": "",
                  "orb_light": "",
                  "orb_dark": "",
                  "orb_heal": "",
                  "orb_poison": ""
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m1",
            "m1",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m4"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 6000,
          "turnInterval": 2,
          "size": "S",
          "exp": 3000,
          "coin": 75,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "12-2": {
    "bgImg": "dungeon12.png",
    "bgm": "b7.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "プクリン",
            "img": "mp40.png",
            "attr": "dark",
            "hp": 70000,
            "atk": 1400,
            "def": 1000,
            "turnInterval": 1,
            "size": "M",
            "exp": 550,
            "coin": 25,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05,
              "monsterId": 39
            },
            "drops": [
              {
                "item": "puzzle52",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ],
                "hpAbove": 75
              },
              {
                "name": "バインドフォース",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.2
                  },
                  {
                    "type": "bind",
                    "target": "random",
                    "countMin": 1,
                    "countMax": 3,
                    "turnMin": 1,
                    "turnMax": 2
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "くらやみのうた",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "blind"
                  }
                ]
              }
            ],
            "isBoss": true,
            "actionMode": "alternate"
          },
          {
            "name": "ピッピ",
            "img": "mp35.png",
            "attr": "dark",
            "hp": 1050,
            "atk": 400,
            "def": 6500,
            "turnInterval": 1,
            "size": "S",
            "exp": 250,
            "coin": 10,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle5",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "ステータスバリア",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "status_shield",
                    "turn": 99
                  }
                ]
              },
              {
                "name": "ゆびをふる",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "roulette",
                    "count": 5,
                    "turn": 5,
                    "sec": 2
                  },
                  {
                    "type": "flee"
                  }
                ]
              }
            ],
            "actionMode": "sequence"
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "ピッピ",
          "img": "mp35.png",
          "attr": "dark",
          "hp": 3300,
          "atk": 451,
          "def": 380,
          "turnInterval": 1,
          "size": "S",
          "exp": 200,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "プリン",
          "img": "mp39.png",
          "attr": "dark",
          "hp": 3900,
          "atk": 400,
          "def": 100,
          "turnInterval": 1,
          "size": "S",
          "exp": 230,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m3": {
          "name": "スリープ",
          "img": "mp96.png",
          "attr": "dark",
          "hp": 3750,
          "atk": 982,
          "def": 150,
          "turnInterval": 2,
          "size": "S",
          "exp": 220,
          "coin": 22,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "さいみんじゅつ",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "bind",
                  "target": "random",
                  "countMin": 1,
                  "countMax": 1,
                  "turnMin": 3,
                  "turnMax": 3
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "ユンゲラー",
          "img": "mp64.png",
          "attr": "dark",
          "hp": 5000,
          "atk": 1250,
          "def": 120,
          "turnInterval": 2,
          "size": "M",
          "exp": 300,
          "coin": 30,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 63
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "パイロキネシス",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.1
                },
                {
                  "type": "board_change",
                  "pattern": "random_to",
                  "to": "fire",
                  "orb_fire": "",
                  "orb_water": "",
                  "orb_wood": "",
                  "orb_light": "",
                  "orb_dark": "",
                  "orb_heal": "",
                  "orb_poison": ""
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m1",
            "m1",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m4"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 6000,
          "turnInterval": 2,
          "size": "S",
          "exp": 3000,
          "coin": 75,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "12-3": {
    "bgImg": "dungeon12.png",
    "bgm": "b7.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "バリヤード",
            "img": "mp122.png",
            "attr": "dark",
            "hp": 80000,
            "atk": 1450,
            "def": 100,
            "turnInterval": 1,
            "size": "L",
            "exp": 750,
            "coin": 25,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_52",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 30,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "ドロップチェンジ・闇",
                "condition": "normal",
                "weight": 40,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "convert",
                    "from": "light",
                    "to": "dark",
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "『闇ドロップを残すな』",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "no_fall",
                    "turn": 99
                  }
                ]
              },
              {
                "name": "ステータスバリア",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "status_shield",
                    "turn": -99
                  }
                ]
              },
              {
                "name": "ハーフグラビティ",
                "condition": "normal",
                "weight": 30,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "damage_ratio",
                    "basis": "current",
                    "rate": 50
                  }
                ]
              },
              {
                "name": "ダークチェイサー",
                "condition": "orb_has",
                "weight": 1000000,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.5
                  }
                ],
                "orb": "dark"
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "ピッピ",
          "img": "mp35.png",
          "attr": "dark",
          "hp": 3300,
          "atk": 551,
          "def": 380,
          "turnInterval": 1,
          "size": "S",
          "exp": 200,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "プリン",
          "img": "mp39.png",
          "attr": "dark",
          "hp": 3900,
          "atk": 500,
          "def": 100,
          "turnInterval": 1,
          "size": "S",
          "exp": 230,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m3": {
          "name": "スリープ",
          "img": "mp96.png",
          "attr": "dark",
          "hp": 3750,
          "atk": 1082,
          "def": 150,
          "turnInterval": 2,
          "size": "S",
          "exp": 220,
          "coin": 22,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "さいみんじゅつ",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "bind",
                  "target": "random",
                  "countMin": 1,
                  "countMax": 1,
                  "turnMin": 3,
                  "turnMax": 3
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "ユンゲラー",
          "img": "mp64.png",
          "attr": "dark",
          "hp": 5000,
          "atk": 1250,
          "def": 120,
          "turnInterval": 2,
          "size": "M",
          "exp": 300,
          "coin": 30,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 63
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "パイロキネシス",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.1
                },
                {
                  "type": "board_change",
                  "pattern": "random_to",
                  "to": "fire",
                  "orb_fire": "",
                  "orb_water": "",
                  "orb_wood": "",
                  "orb_light": "",
                  "orb_dark": "",
                  "orb_heal": "",
                  "orb_poison": ""
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m1",
            "m1",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m4"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 6000,
          "turnInterval": 2,
          "size": "S",
          "exp": 3000,
          "coin": 75,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "12-4": {
    "bgImg": "dungeon12.png",
    "bgm": "b7.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "マタドガス",
            "img": "mp110.png",
            "attr": "dark",
            "hp": 90000,
            "atk": 1100,
            "def": 1000,
            "turnInterval": 1,
            "size": "L",
            "exp": 600,
            "coin": 25,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05,
              "monsterId": 109
            },
            "drops": [
              {
                "item": "puzzle52",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "どくのキリ",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.2
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "poison",
                    "count": 6,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ]
              }
            ],
            "isBoss": true,
            "actionMode": "alternate"
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "ピッピ",
          "img": "mp35.png",
          "attr": "dark",
          "hp": 3300,
          "atk": 551,
          "def": 380,
          "turnInterval": 1,
          "size": "S",
          "exp": 200,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "プリン",
          "img": "mp39.png",
          "attr": "dark",
          "hp": 3900,
          "atk": 500,
          "def": 100,
          "turnInterval": 1,
          "size": "S",
          "exp": 230,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m3": {
          "name": "スリープ",
          "img": "mp96.png",
          "attr": "dark",
          "hp": 3750,
          "atk": 1082,
          "def": 150,
          "turnInterval": 2,
          "size": "S",
          "exp": 220,
          "coin": 22,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "さいみんじゅつ",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "bind",
                  "target": "random",
                  "countMin": 1,
                  "countMax": 1,
                  "turnMin": 3,
                  "turnMax": 3
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "ユンゲラー",
          "img": "mp64.png",
          "attr": "dark",
          "hp": 5000,
          "atk": 1250,
          "def": 120,
          "turnInterval": 2,
          "size": "M",
          "exp": 300,
          "coin": 30,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 63
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "パイロキネシス",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.1
                },
                {
                  "type": "board_change",
                  "pattern": "random_to",
                  "to": "fire",
                  "orb_fire": "",
                  "orb_water": "",
                  "orb_wood": "",
                  "orb_light": "",
                  "orb_dark": "",
                  "orb_heal": "",
                  "orb_poison": ""
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m1",
            "m1",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m4"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 6000,
          "turnInterval": 2,
          "size": "S",
          "exp": 3000,
          "coin": 75,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "12-boss": {
    "bgImg": "dungeon12.png",
    "bgm": "b7.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "フリーザー",
            "img": "mp144.png",
            "attr": "water",
            "hp": 150000,
            "atk": 1211,
            "def": 0,
            "turnInterval": 1,
            "size": "XL",
            "exp": 5000,
            "coin": 20,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle23",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "こごえるかぜ",
                "condition": "normal",
                "weight": 33,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "water",
                    "count": 6,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  },
                  {
                    "type": "atk_down",
                    "target": "attr",
                    "attr": "water",
                    "rate": 50,
                    "turn": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "氷鳥の威圧",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "attr_guard",
                    "attr": "wood",
                    "rate": 50,
                    "turn": -1
                  },
                  {
                    "type": "status_shield",
                    "turn": 99
                  }
                ]
              },
              {
                "name": "先制攻撃",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "roulette",
                    "count": 1,
                    "turn": 99,
                    "sec": 1
                  }
                ]
              },
              {
                "name": "はばたき",
                "condition": "normal",
                "weight": 33,
                "once": false,
                "skills": [
                  {
                    "type": "damage",
                    "value": 308,
                    "repeat": 6
                  },
                  {
                    "type": "board_change",
                    "pattern": "convert",
                    "from": "water",
                    "to": "fire",
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "ワイルドフリーズ",
                "condition": "normal",
                "weight": 34,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "skill_seal",
                    "turn": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "⚠️でんせつのひしょう",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "attr_guard",
                    "attr": "water",
                    "rate": 75,
                    "turn": -1
                  },
                  {
                    "type": "roulette",
                    "count": 5,
                    "turn": 3,
                    "sec": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "water",
                    "count": 7,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ]
              },
              {
                "name": "アイスウイング",
                "condition": "normal",
                "weight": 50,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.2
                  },
                  {
                    "type": "time_reduce",
                    "seconds": 1,
                    "turn": 1
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "フロストプリズン",
                "condition": "normal",
                "weight": 50,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "bind",
                    "target": "random",
                    "countMin": 1,
                    "countMax": 1,
                    "turnMin": 2,
                    "turnMax": 2
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "⚠️いてつきの足音",
                "condition": "hp<=10%",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "attack_buff",
                    "rate": 2,
                    "turn": -1
                  },
                  {
                    "type": "heal_self",
                    "rate": 0.25
                  },
                  {
                    "type": "board_change",
                    "pattern": "random_to",
                    "to": "water",
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ]
              }
            ],
            "isBoss": true,
            "ofudaDrop": {
              "enabled": true,
              "item": "ohuda1",
              "rate": 0.1,
              "count": 1
            }
          }
        ]
      }
    ],
    "random": {
      "floors": 6,
      "monsters": {
        "m1": {
          "name": "ピッピ",
          "img": "mp35.png",
          "attr": "dark",
          "hp": 3300,
          "atk": 551,
          "def": 380,
          "turnInterval": 1,
          "size": "S",
          "exp": 200,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "プリン",
          "img": "mp39.png",
          "attr": "dark",
          "hp": 3900,
          "atk": 500,
          "def": 100,
          "turnInterval": 1,
          "size": "S",
          "exp": 230,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        },
        "m3": {
          "name": "ズバット",
          "img": "mp41.png",
          "attr": "dark",
          "hp": 4000,
          "atk": 512,
          "def": 100,
          "turnInterval": 1,
          "size": "S",
          "exp": 220,
          "coin": 22,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "さいみんじゅつ",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "bind",
                  "target": "random",
                  "countMin": 1,
                  "countMax": 1,
                  "turnMin": 1,
                  "turnMax": 1
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "ユンゲラー",
          "img": "mp64.png",
          "attr": "dark",
          "hp": 5000,
          "atk": 1250,
          "def": 120,
          "turnInterval": 2,
          "size": "M",
          "exp": 300,
          "coin": 30,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 63
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "パイロキネシス",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1.1
                },
                {
                  "type": "board_change",
                  "pattern": "random_to",
                  "to": "fire",
                  "orb_fire": "",
                  "orb_water": "",
                  "orb_wood": "",
                  "orb_light": "",
                  "orb_dark": "",
                  "orb_heal": "",
                  "orb_poison": ""
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1",
            "m3",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m1",
            "m1",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m4",
            "m4"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 10,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 6000,
          "turnInterval": 2,
          "size": "S",
          "exp": 5000,
          "coin": 50,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.3
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "daily_tue-1": {
    "bgImg": "dungeon13.png",
    "bgm": "b3.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ポリゴン",
            "img": "mp137.png",
            "attr": "fire",
            "hp": 40000,
            "atk": 930,
            "def": 1000,
            "turnInterval": 2,
            "size": "XL",
            "exp": 50,
            "coin": 50,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.1
            },
            "drops": [
              {
                "item": "puzzle12",
                "rate": 0.1,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "ロコン",
          "img": "mp37.png",
          "attr": "fire",
          "hp": 2450,
          "atk": 860,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 100,
          "coin": 5,
          "monsterDrop": {
            "enabled": false,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle1",
              "rate": 0.1,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "ポニータ",
          "img": "mp77.png",
          "attr": "fire",
          "hp": 3000,
          "atk": 433,
          "def": 100,
          "turnInterval": 1,
          "size": "S",
          "exp": 121,
          "coin": 9,
          "monsterDrop": {
            "enabled": false,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_1",
              "rate": 0.1,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 40,
          "enemies": [
            "m1",
            "m1",
            "m1",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 45,
          "enemies": [
            "m1",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 5,
          "enemies": [
            "m2",
            "m2",
            "m2",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 40,
          "enemies": [
            "m1",
            "m1",
            "m1",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 45,
          "enemies": [
            "m1",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 5,
          "enemies": [
            "m2",
            "m2",
            "m2",
            "m2",
            "m1"
          ]
        }
      ]
    }
  },
  "daily_wed-1": {
    "bgImg": "dungeon9.png",
    "bgm": "b2.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ルージュラ",
            "img": "mp124.png",
            "attr": "water",
            "hp": 40000,
            "atk": 950,
            "def": 1000,
            "turnInterval": 2,
            "size": "XL",
            "exp": 250,
            "coin": 50,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.1
            },
            "drops": [
              {
                "item": "puzzle22",
                "rate": 0.1,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "コダック",
          "img": "mp54.png",
          "attr": "water",
          "hp": 2450,
          "atk": 860,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 100,
          "coin": 5,
          "monsterDrop": {
            "enabled": false,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.1,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "ヤドン",
          "img": "mp79.png",
          "attr": "water",
          "hp": 3000,
          "atk": 433,
          "def": 100,
          "turnInterval": 1,
          "size": "S",
          "exp": 121,
          "coin": 9,
          "monsterDrop": {
            "enabled": false,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_2",
              "rate": 0.1,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 5,
          "enemies": [
            "m2",
            "m2",
            "m2",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 40,
          "enemies": [
            "m1",
            "m1",
            "m1",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 30,
          "enemies": [
            "m1",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 5,
          "enemies": [
            "m1",
            "m1",
            "m1",
            "m1",
            "m2"
          ]
        }
      ]
    }
  },
  "daily_sun-1": {
    "bgImg": "daily_sun.png",
    "bgm": "b7.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "イーブイ",
            "img": "mp133.png",
            "attr": "light",
            "hp": 50000,
            "atk": 800,
            "def": 0,
            "turnInterval": 2,
            "size": "XL",
            "exp": 50,
            "coin": 250,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 6,
      "monsters": {
        "m1": {
          "name": "イーブイ",
          "img": "mp133.png",
          "attr": "light",
          "hp": 3232,
          "atk": 490,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 50,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1"
          ]
        },
        {
          "weight": 40,
          "enemies": [
            "m1",
            "m1",
            "m1"
          ]
        },
        {
          "weight": 45,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 5,
          "enemies": [
            "m1",
            "m1",
            "m1",
            "m1"
          ]
        }
      ]
    }
  },
  "daily_sun-2": {
    "bgImg": "daily_sun.png",
    "bgm": "b7.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "イーブイ",
            "img": "mp133.png",
            "attr": "light",
            "hp": 170000,
            "atk": 1842,
            "def": 1000,
            "turnInterval": 1,
            "size": "XL",
            "exp": 50,
            "coin": 1250,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 80,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "ステップ",
                "condition": "normal",
                "weight": 20,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.1
                  },
                  {
                    "type": "combo_absorb",
                    "turn": 1,
                    "combo": 6
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 6,
      "monsters": {
        "m1": {
          "name": "イーブイ",
          "img": "mp133.png",
          "attr": "light",
          "hp": 45124,
          "atk": 2900,
          "def": 800,
          "turnInterval": 2,
          "size": "S",
          "exp": 100,
          "coin": 35,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1"
          ]
        },
        {
          "weight": 40,
          "enemies": [
            "m1",
            "m1",
            "m1"
          ]
        },
        {
          "weight": 45,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 5,
          "enemies": [
            "m1",
            "m1",
            "m1",
            "m1"
          ]
        }
      ]
    }
  },
  "daily_sat-1": {
    "bgImg": "daily_sun.png",
    "bgm": "b7.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "イーブイ",
            "img": "mp133.png",
            "attr": "light",
            "hp": 50000,
            "atk": 800,
            "def": 0,
            "turnInterval": 2,
            "size": "XL",
            "exp": 50,
            "coin": 500,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 6,
      "monsters": {
        "m1": {
          "name": "イーブイ",
          "img": "mp133.png",
          "attr": "light",
          "hp": 3232,
          "atk": 490,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 50,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1"
          ]
        },
        {
          "weight": 40,
          "enemies": [
            "m1",
            "m1",
            "m1"
          ]
        },
        {
          "weight": 45,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 5,
          "enemies": [
            "m1",
            "m1",
            "m1",
            "m1"
          ]
        }
      ]
    }
  },
  "daily_sat-2": {
    "bgImg": "daily_sun.png",
    "bgm": "b7.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "イーブイ",
            "img": "mp133.png",
            "attr": "light",
            "hp": 170000,
            "atk": 1842,
            "def": 1000,
            "turnInterval": 1,
            "size": "XL",
            "exp": 50,
            "coin": 1250,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 80,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "ステップ",
                "condition": "normal",
                "weight": 20,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.1
                  },
                  {
                    "type": "combo_absorb",
                    "turn": 1,
                    "combo": 6
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 6,
      "monsters": {
        "m1": {
          "name": "イーブイ",
          "img": "mp133.png",
          "attr": "light",
          "hp": 45124,
          "atk": 2900,
          "def": 800,
          "turnInterval": 2,
          "size": "S",
          "exp": 100,
          "coin": 35,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1"
          ]
        },
        {
          "weight": 40,
          "enemies": [
            "m1",
            "m1",
            "m1"
          ]
        },
        {
          "weight": 45,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 5,
          "enemies": [
            "m1",
            "m1",
            "m1",
            "m1"
          ]
        }
      ]
    }
  },
  "daily_mon-1": {
    "bgImg": "dungeon5.png",
    "bgm": "b4.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "アーボック",
            "img": "mp24.png",
            "attr": "dark",
            "hp": 40000,
            "atk": 730,
            "def": 1000,
            "turnInterval": 2,
            "size": "XL",
            "exp": 50,
            "coin": 50,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05,
              "monsterId": 23
            },
            "drops": [
              {
                "item": "puzzle52",
                "rate": 0.1,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 60,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "どくどくのキバ",
                "condition": "normal",
                "weight": 40,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "poison",
                    "count": 5,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "ニドラン♀",
          "img": "mp29.png",
          "attr": "dark",
          "hp": 2450,
          "atk": 860,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 100,
          "coin": 5,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "ニドラン♂",
          "img": "mp32.png",
          "attr": "dark",
          "hp": 3000,
          "atk": 433,
          "def": 100,
          "turnInterval": 1,
          "size": "S",
          "exp": 121,
          "coin": 9,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 40,
          "enemies": [
            "m1",
            "m1",
            "m1",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 45,
          "enemies": [
            "m1",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 5,
          "enemies": [
            "m2",
            "m2",
            "m2",
            "m2",
            "m1"
          ]
        }
      ]
    }
  },
  "daily_mon-2": {
    "bgImg": "dungeon5.png",
    "bgm": "b4.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ゲンガー",
            "img": "mp94.png",
            "attr": "dark",
            "hp": 150000,
            "atk": 4012,
            "def": 1500,
            "turnInterval": 2,
            "size": "XL",
            "exp": 100,
            "coin": 50,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05,
              "monsterId": 93
            },
            "drops": [
              {
                "item": "puzzle53",
                "rate": 0.25,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 60,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "くらやみのひかり",
                "condition": "normal",
                "weight": 40,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.1
                  },
                  {
                    "type": "blind"
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "ニドリーナ",
          "img": "mp30.png",
          "attr": "dark",
          "hp": 46550,
          "atk": 3005,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 200,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 29
          },
          "drops": [
            {
              "item": "puzzle52",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 70,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "かみつく",
              "condition": "normal",
              "weight": 30,
              "once": false,
              "skills": [
                {
                  "type": "damage_ratio",
                  "basis": "current",
                  "rate": 30
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "ニドリーノ",
          "img": "mp33.png",
          "attr": "dark",
          "hp": 35000,
          "atk": 1432,
          "def": 2000,
          "turnInterval": 1,
          "size": "S",
          "exp": 220,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 32
          },
          "drops": [
            {
              "item": "spuzzle_52",
              "rate": 0.1,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 40,
          "enemies": [
            "m1",
            "m1",
            "m1",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 45,
          "enemies": [
            "m1",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 5,
          "enemies": [
            "m2",
            "m2",
            "m2",
            "m2",
            "m1"
          ]
        }
      ]
    }
  },
  "13-1": {
    "bgImg": "dungeon13-1.png",
    "bgm": "b3.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ニドキング",
            "img": "mp34.png",
            "attr": "dark",
            "hp": 100000,
            "atk": 1600,
            "def": 800,
            "turnInterval": 1,
            "size": "XL",
            "exp": 1250,
            "coin": 20,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05,
              "monsterId": 32
            },
            "drops": [
              {
                "item": "puzzle52",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 30,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "ドロップチェンジ・木",
                "condition": "normal",
                "weight": 40,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "convert",
                    "from": "light",
                    "to": "water",
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "『木ドロップを残すな』",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "no_fall",
                    "turn": 99
                  }
                ]
              },
              {
                "name": "ステータスバリア",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "status_shield",
                    "turn": 99
                  }
                ]
              },
              {
                "name": "サードグラビティ",
                "condition": "normal",
                "weight": 30,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "damage_ratio",
                    "basis": "max",
                    "rate": 30
                  }
                ]
              },
              {
                "name": "ウッドチェイサー",
                "condition": "orb_has",
                "weight": 10000000,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.8
                  }
                ],
                "orb": "wood"
              }
            ],
            "isBoss": true,
            "ofudaDrop": {
              "enabled": true,
              "item": "ohuda1",
              "rate": 0.01,
              "count": 1
            }
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "ゴローン",
          "img": "mp75.png",
          "attr": "light",
          "hp": 7000,
          "atk": 2100,
          "def": 400,
          "turnInterval": 2,
          "size": "M",
          "exp": 300,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 74
          },
          "drops": [
            {
              "item": "puzzle42",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "ofudaDrop": {
            "enabled": true,
            "item": "ohuda1",
            "rate": 0.01,
            "count": 1
          }
        },
        "m2": {
          "name": "ギャロップ",
          "img": "mp78.png",
          "attr": "fire",
          "hp": 8200,
          "atk": 900,
          "def": 100,
          "turnInterval": 1,
          "size": "M",
          "exp": 250,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 77
          },
          "drops": [
            {
              "item": "puzzle12",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false,
          "ofudaDrop": {
            "enabled": true,
            "item": "ohuda1",
            "rate": 0.01,
            "count": 1
          }
        },
        "m3": {
          "name": "ガーディ",
          "img": "mp58.png",
          "attr": "fire",
          "hp": 3750,
          "atk": 721,
          "def": 1000,
          "turnInterval": 1,
          "size": "S",
          "exp": 250,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "いかく",
              "condition": "battle_start",
              "once": true,
              "skills": [
                {
                  "type": "atk_down",
                  "target": "all",
                  "rate": 25,
                  "turn": 1
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "ゴーリキー",
          "img": "mp67.png",
          "attr": "fire",
          "hp": 5500,
          "atk": 2800,
          "def": 100,
          "turnInterval": 2,
          "size": "M",
          "exp": 300,
          "coin": 30,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 66
          },
          "drops": [
            {
              "item": "spuzzle_12",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m4",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m4"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 7000,
          "turnInterval": 2,
          "size": "S",
          "exp": 5000,
          "coin": 100,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "13-2": {
    "bgImg": "dungeon13-1.png",
    "bgm": "b3.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ブーバー",
            "img": "mp126.png",
            "attr": "fire",
            "hp": 100000,
            "atk": 1500,
            "def": 1400,
            "turnInterval": 1,
            "size": "XL",
            "exp": 1500,
            "coin": 20,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_12",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "ひのこ",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "fire",
                    "count": 3,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ]
              },
              {
                "name": "なぶりやき",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "attack_buff",
                    "rate": 1.2,
                    "turn": 1
                  }
                ]
              },
              {
                "name": "なぶりやき",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "attack_buff",
                    "rate": 1.4,
                    "turn": 1
                  }
                ]
              },
              {
                "name": "なぶりやき",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "attack_buff",
                    "rate": 1.6,
                    "turn": 1
                  }
                ]
              },
              {
                "name": "なぶりやき",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "attack_buff",
                    "rate": 1.8,
                    "turn": 1
                  }
                ]
              },
              {
                "name": "⚠️やきこがす",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "multi",
                    "to": "water",
                    "orb_fire": true,
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ]
              }
            ],
            "isBoss": true,
            "ofudaDrop": {
              "enabled": true,
              "item": "ohuda1",
              "rate": 0.01,
              "count": 1
            },
            "actionMode": "sequence"
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "イワーク",
          "img": "mp95.png",
          "attr": "light",
          "hp": 7000,
          "atk": 2100,
          "def": 400,
          "turnInterval": 2,
          "size": "M",
          "exp": 300,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "ofudaDrop": {
            "enabled": true,
            "item": "ohuda1",
            "rate": 0.01,
            "count": 1
          }
        },
        "m2": {
          "name": "オコリザル",
          "img": "mp57.png",
          "attr": "fire",
          "hp": 8200,
          "atk": 960,
          "def": 100,
          "turnInterval": 1,
          "size": "M",
          "exp": 250,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 37
          },
          "drops": [
            {
              "item": "puzzle12",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false,
          "ofudaDrop": {
            "enabled": true,
            "item": "ohuda1",
            "rate": 0.01,
            "count": 1
          }
        },
        "m3": {
          "name": "ガーディ",
          "img": "mp58.png",
          "attr": "fire",
          "hp": 3750,
          "atk": 721,
          "def": 1000,
          "turnInterval": 1,
          "size": "S",
          "exp": 250,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            },
            {
              "name": "いかく",
              "condition": "battle_start",
              "once": true,
              "skills": [
                {
                  "type": "atk_down",
                  "target": "all",
                  "rate": 25,
                  "turn": 1
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "ゴーリキー",
          "img": "mp67.png",
          "attr": "fire",
          "hp": 5500,
          "atk": 2800,
          "def": 100,
          "turnInterval": 2,
          "size": "M",
          "exp": 300,
          "coin": 30,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 66
          },
          "drops": [
            {
              "item": "spuzzle_12",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m4",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m4"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 7000,
          "turnInterval": 2,
          "size": "S",
          "exp": 5000,
          "coin": 100,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "13-3": {
    "bgImg": "dungeon13-1.png",
    "bgm": "b3.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "カビゴン",
            "img": "mp143.png",
            "attr": "wood",
            "hp": 75000,
            "atk": 7200,
            "def": 3000,
            "turnInterval": 3,
            "size": "XL",
            "exp": 2000,
            "coin": 0,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle33",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "のしかかり",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "damage_ratio",
                    "basis": "current",
                    "rate": 50
                  }
                ]
              },
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "⚠️たおれこむ",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.2
                  }
                ],
                "hpBelow": 50
              }
            ],
            "isBoss": true,
            "ofudaDrop": {
              "enabled": true,
              "item": "ohuda1",
              "rate": 0.01,
              "count": 1
            }
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "オニドリル",
          "img": "mp22.png",
          "attr": "fire",
          "hp": 7500,
          "atk": 1100,
          "def": 400,
          "turnInterval": 1,
          "size": "M",
          "exp": 300,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 21
          },
          "drops": [
            {
              "item": "spuzzle_12",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "ofudaDrop": {
            "enabled": true,
            "item": "ohuda1",
            "rate": 0.01,
            "count": 1
          }
        },
        "m2": {
          "name": "モンジャラ",
          "img": "mp114.png",
          "attr": "wood",
          "hp": 8200,
          "atk": 2060,
          "def": 500,
          "turnInterval": 1,
          "size": "M",
          "exp": 250,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false,
          "ofudaDrop": {
            "enabled": true,
            "item": "ohuda1",
            "rate": 0.01,
            "count": 1
          }
        },
        "m3": {
          "name": "カラカラ",
          "img": "mp104.png",
          "attr": "light",
          "hp": 4000,
          "atk": 820,
          "def": 1000,
          "turnInterval": 1,
          "size": "S",
          "exp": 250,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "ニョロゾ",
          "img": "mp61.png",
          "attr": "water",
          "hp": 5500,
          "atk": 2900,
          "def": 200,
          "turnInterval": 2,
          "size": "M",
          "exp": 300,
          "coin": 30,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 60
          },
          "drops": [
            {
              "item": "puzzle22",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m4",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m4"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 7000,
          "turnInterval": 2,
          "size": "S",
          "exp": 5000,
          "coin": 100,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "13-4": {
    "bgImg": "dungeon13.png",
    "bgm": "b3.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ブースター",
            "img": "mp136.png",
            "attr": "fire",
            "hp": 100000,
            "atk": 4800,
            "def": 1500,
            "turnInterval": 2,
            "size": "XL",
            "exp": 1500,
            "coin": 50,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05,
              "monsterId": 133
            },
            "drops": [
              {
                "item": "puzzle12",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "エレメントバリア・光闇",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "attr_guard",
                    "attr": "dark",
                    "rate": 75,
                    "turn": -1
                  },
                  {
                    "type": "attr_guard",
                    "attr": "light",
                    "rate": 75,
                    "turn": -1
                  }
                ]
              },
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "先制攻撃",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "ドロップチェンジ・光",
                "condition": "normal",
                "weight": 50,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "random_to",
                    "to": "light",
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "とっしん",
                "condition": "normal",
                "weight": 50,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.2
                  }
                ],
                "hpBelow": 50
              }
            ],
            "isBoss": true,
            "ofudaDrop": {
              "enabled": true,
              "item": "ohuda1",
              "rate": 0.01,
              "count": 1
            }
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "ブーバー",
          "img": "mp126.png",
          "attr": "fire",
          "hp": 8000,
          "atk": 1600,
          "def": 400,
          "turnInterval": 1,
          "size": "M",
          "exp": 300,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "なぶりやき",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "attack_buff",
                  "rate": 1.2,
                  "turn": 1
                }
              ]
            }
          ],
          "ofudaDrop": {
            "enabled": true,
            "item": "ohuda1",
            "rate": 0.01,
            "count": 1
          }
        },
        "m2": {
          "name": "キュウコン",
          "img": "mp38.png",
          "attr": "fire",
          "hp": 8500,
          "atk": 1860,
          "def": 500,
          "turnInterval": 1,
          "size": "M",
          "exp": 250,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 37
          },
          "drops": [
            {
              "item": "puzzle12",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false,
          "ofudaDrop": {
            "enabled": true,
            "item": "ohuda1",
            "rate": 0.01,
            "count": 1
          }
        },
        "m3": {
          "name": "ヒトカゲ",
          "img": "mp4.png",
          "attr": "fire",
          "hp": 9500,
          "atk": 840,
          "def": 0,
          "turnInterval": 1,
          "size": "S",
          "exp": 250,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ],
              "hpAbove": 51
            },
            {
              "name": "はじけるほのお",
              "condition": "normal",
              "weight": 100,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "board_change",
                  "pattern": "spawn",
                  "to": "fire",
                  "count": 3,
                  "orb_fire": "",
                  "orb_water": "",
                  "orb_wood": "",
                  "orb_light": "",
                  "orb_dark": "",
                  "orb_heal": "",
                  "orb_poison": ""
                },
                {
                  "type": "rec_down",
                  "value": 0.5,
                  "turn": 1
                }
              ],
              "hpBelow": 50
            }
          ]
        },
        "m4": {
          "name": "ギャロップ",
          "img": "mp78.png",
          "attr": "fire",
          "hp": 8200,
          "atk": 1600,
          "def": 100,
          "turnInterval": 1,
          "size": "M",
          "exp": 250,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 77
          },
          "drops": [
            {
              "item": "puzzle12",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false,
          "ofudaDrop": {
            "enabled": true,
            "item": "ohuda1",
            "rate": 0.01,
            "count": 1
          }
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m4",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m4"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 7000,
          "turnInterval": 2,
          "size": "S",
          "exp": 5000,
          "coin": 100,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "13-boss": {
    "bgImg": "dungeon13.png",
    "bgm": "b3.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ファイヤー",
            "img": "mp146.png",
            "attr": "fire",
            "hp": 150000,
            "atk": 3850,
            "def": 1000,
            "turnInterval": 1,
            "size": "XL",
            "exp": 7500,
            "coin": 50,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle13",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "ほのおのつばさ",
                "condition": "normal",
                "weight": 33,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "fire",
                    "count": 4,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "フレアフロート",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "attr_guard",
                    "attr": "fire",
                    "rate": 99,
                    "turn": -1
                  },
                  {
                    "type": "status_shield",
                    "turn": 99
                  }
                ]
              },
              {
                "name": "れんぞくこうげき",
                "condition": "normal",
                "weight": 33,
                "once": false,
                "skills": [
                  {
                    "type": "damage",
                    "value": 1150,
                    "repeat": 3
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "こうおんガス",
                "condition": "normal",
                "weight": 34,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "poison",
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": "",
                    "count": 4
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "⚠️れっかのまい",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "multi",
                    "to": "water",
                    "orb_fire": true,
                    "orb_water": "",
                    "orb_wood": true,
                    "orb_light": true,
                    "orb_dark": false,
                    "orb_heal": true,
                    "orb_poison": ""
                  },
                  {
                    "type": "dmg_reduce",
                    "rate": 20,
                    "turn": -1
                  },
                  {
                    "type": "attack_buff",
                    "rate": 1.5,
                    "turn": 1
                  }
                ]
              },
              {
                "name": "ヒートブラスト",
                "condition": "normal",
                "weight": 50,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "convert",
                    "from": "water",
                    "to": "fire",
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "ほのおのうず",
                "condition": "normal",
                "weight": 50,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "roulette",
                    "count": 5,
                    "turn": 1,
                    "sec": 2
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "⚠️イビルバーン",
                "condition": "hp<=5%",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 99
                  }
                ]
              }
            ],
            "isBoss": true,
            "ofudaDrop": {
              "enabled": true,
              "item": "ohuda1",
              "rate": 0.1,
              "count": 1
            }
          }
        ]
      }
    ],
    "random": {
      "floors": 6,
      "monsters": {
        "m1": {
          "name": "ブーバー",
          "img": "mp126.png",
          "attr": "fire",
          "hp": 8000,
          "atk": 1600,
          "def": 400,
          "turnInterval": 1,
          "size": "M",
          "exp": 300,
          "coin": 10,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "なぶりやき",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "attack_buff",
                  "rate": 1.2,
                  "turn": 1
                }
              ]
            }
          ],
          "ofudaDrop": {
            "enabled": true,
            "item": "ohuda1",
            "rate": 0.01,
            "count": 1
          }
        },
        "m2": {
          "name": "キュウコン",
          "img": "mp38.png",
          "attr": "fire",
          "hp": 8500,
          "atk": 1860,
          "def": 500,
          "turnInterval": 1,
          "size": "M",
          "exp": 250,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 37
          },
          "drops": [
            {
              "item": "puzzle12",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false,
          "ofudaDrop": {
            "enabled": true,
            "item": "ohuda1",
            "rate": 0.01,
            "count": 1
          }
        },
        "m3": {
          "name": "ヒトカゲ",
          "img": "mp4.png",
          "attr": "fire",
          "hp": 9500,
          "atk": 840,
          "def": 0,
          "turnInterval": 1,
          "size": "S",
          "exp": 250,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ],
              "hpAbove": 51
            },
            {
              "name": "はじけるほのお",
              "condition": "normal",
              "weight": 100,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "board_change",
                  "pattern": "spawn",
                  "to": "fire",
                  "count": 3,
                  "orb_fire": "",
                  "orb_water": "",
                  "orb_wood": "",
                  "orb_light": "",
                  "orb_dark": "",
                  "orb_heal": "",
                  "orb_poison": ""
                },
                {
                  "type": "rec_down",
                  "value": 0.5,
                  "turn": 1
                }
              ],
              "hpBelow": 50
            }
          ]
        },
        "m4": {
          "name": "ギャロップ",
          "img": "mp78.png",
          "attr": "fire",
          "hp": 8200,
          "atk": 1600,
          "def": 100,
          "turnInterval": 1,
          "size": "M",
          "exp": 250,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 77
          },
          "drops": [
            {
              "item": "puzzle12",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false,
          "ofudaDrop": {
            "enabled": true,
            "item": "ohuda1",
            "rate": 0.01,
            "count": 1
          }
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m4",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m4"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 10,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 7000,
          "turnInterval": 2,
          "size": "S",
          "exp": 7500,
          "coin": 100,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "14-1": {
    "bgImg": "dungeon7.png",
    "bgm": "b8.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "リザードン",
            "img": "mp6.png",
            "attr": "fire",
            "hp": 170000,
            "atk": 5000,
            "def": 0,
            "turnInterval": 2,
            "size": "XL",
            "exp": 3000,
            "coin": 20,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05,
              "monsterId": 4
            },
            "drops": [
              {
                "item": "puzzle13",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "かえんほうしゃ",
                "condition": "normal",
                "weight": 50,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.3
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "fire",
                    "count": 10,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ],
                "hpBelow": 50
              }
            ],
            "isBoss": true,
            "ofudaDrop": {
              "enabled": true,
              "item": "ohuda1",
              "rate": 0.01,
              "count": 1
            }
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "ウインディ",
          "img": "mp59.png",
          "attr": "fire",
          "hp": 8000,
          "atk": 1650,
          "def": 400,
          "turnInterval": 1,
          "size": "M",
          "exp": 500,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 58
          },
          "drops": [
            {
              "item": "puzzle12",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "ofudaDrop": {
            "enabled": true,
            "item": "ohuda1",
            "rate": 0.01,
            "count": 1
          }
        },
        "m2": {
          "name": "キュウコン",
          "img": "mp38.png",
          "attr": "fire",
          "hp": 8500,
          "atk": 1860,
          "def": 500,
          "turnInterval": 1,
          "size": "M",
          "exp": 250,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 37
          },
          "drops": [
            {
              "item": "puzzle12",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false,
          "ofudaDrop": {
            "enabled": true,
            "item": "ohuda1",
            "rate": 0.01,
            "count": 1
          }
        },
        "m3": {
          "name": "マンキー",
          "img": "mp56.png",
          "attr": "fire",
          "hp": 8500,
          "atk": 880,
          "def": 0,
          "turnInterval": 1,
          "size": "S",
          "exp": 250,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle1",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "ギャロップ",
          "img": "mp78.png",
          "attr": "fire",
          "hp": 8200,
          "atk": 1600,
          "def": 100,
          "turnInterval": 1,
          "size": "M",
          "exp": 250,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 77
          },
          "drops": [
            {
              "item": "puzzle12",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false,
          "ofudaDrop": {
            "enabled": true,
            "item": "ohuda1",
            "rate": 0.01,
            "count": 1
          }
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m4",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m4"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 7000,
          "turnInterval": 2,
          "size": "S",
          "exp": 10000,
          "coin": 100,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "14-2": {
    "bgImg": "dungeon7.png",
    "bgm": "b8.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "オムスター",
            "img": "mp139.png",
            "attr": "water",
            "hp": 5000,
            "atk": 5500,
            "def": 15000,
            "turnInterval": 3,
            "size": "L",
            "exp": 3000,
            "coin": 25,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05,
              "monsterId": 138
            },
            "drops": [
              {
                "item": "puzzle23",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "ハイドロポンプ",
                "condition": "normal",
                "weight": 50,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.2
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "water",
                    "count": 10,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ],
                "hpBelow": 50
              }
            ],
            "isBoss": true
          },
          {
            "name": "カブトプス",
            "img": "mp141.png",
            "attr": "water",
            "hp": 80000,
            "atk": 1800,
            "def": 2000,
            "turnInterval": 1,
            "size": "L",
            "exp": 2500,
            "coin": 25,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05,
              "monsterId": 140
            },
            "drops": [
              {
                "item": "puzzle23",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 30,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "ドロップチェンジ・水",
                "condition": "normal",
                "weight": 40,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "random_to",
                    "to": "water",
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "先生攻撃",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "damage_ratio",
                    "basis": "current",
                    "rate": 25
                  }
                ]
              },
              {
                "name": "つじぎり",
                "condition": "normal",
                "weight": 30,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "blind"
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "ルージュラ",
          "img": "mp124.png",
          "attr": "water",
          "hp": 8000,
          "atk": 1400,
          "def": 300,
          "turnInterval": 1,
          "size": "M",
          "exp": 500,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle22",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "あくまのキッス",
              "condition": "normal",
              "weight": 100,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                },
                {
                  "type": "time_reduce",
                  "seconds": 1,
                  "turn": 1
                }
              ]
            }
          ],
          "ofudaDrop": {
            "enabled": true,
            "item": "ohuda1",
            "rate": 0.01,
            "count": 1
          }
        },
        "m2": {
          "name": "ジュゴン",
          "img": "mp87.png",
          "attr": "water",
          "hp": 8700,
          "atk": 1760,
          "def": 500,
          "turnInterval": 1,
          "size": "M",
          "exp": 250,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 86
          },
          "drops": [
            {
              "item": "puzzle22",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false,
          "ofudaDrop": {
            "enabled": true,
            "item": "ohuda1",
            "rate": 0.01,
            "count": 1
          }
        },
        "m3": {
          "name": "ゼニガメ",
          "img": "mp7.png",
          "attr": "water",
          "hp": 8000,
          "atk": 800,
          "def": 300,
          "turnInterval": 1,
          "size": "S",
          "exp": 250,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle2",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "シードラ",
          "img": "mp117.png",
          "attr": "water",
          "hp": 8200,
          "atk": 1600,
          "def": 100,
          "turnInterval": 1,
          "size": "M",
          "exp": 250,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 116
          },
          "drops": [
            {
              "item": "spuzzle_22",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false,
          "ofudaDrop": {
            "enabled": true,
            "item": "ohuda1",
            "rate": 0.01,
            "count": 1
          }
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m4",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m4"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 7000,
          "turnInterval": 2,
          "size": "S",
          "exp": 10000,
          "coin": 100,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "14-3": {
    "bgImg": "dungeon7.png",
    "bgm": "b8.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "スピアー",
            "img": "mp15.png",
            "attr": "wood",
            "hp": 70000,
            "atk": 3000,
            "def": 2000,
            "turnInterval": 1,
            "size": "XL",
            "exp": 2000,
            "coin": 30,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05,
              "monsterId": 13
            },
            "drops": [
              {
                "item": "puzzle33",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "ためる",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "attack_buff",
                    "rate": 1.3,
                    "turn": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "poison",
                    "count": 6,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ]
              },
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "どくづき",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.1
                  },
                  {
                    "type": "board_change",
                    "pattern": "random_to",
                    "to": "poison",
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ]
              },
              {
                "name": "メガホーン",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.5
                  }
                ]
              }
            ],
            "isBoss": true,
            "ofudaDrop": {
              "enabled": true,
              "item": "ohuda1",
              "rate": 0.01,
              "count": 1
            },
            "actionMode": "alternate"
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "ナッシー",
          "img": "mp103.png",
          "attr": "wood",
          "hp": 8000,
          "atk": 1650,
          "def": 400,
          "turnInterval": 1,
          "size": "M",
          "exp": 500,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 102
          },
          "drops": [
            {
              "item": "puzzle32",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "ofudaDrop": {
            "enabled": true,
            "item": "ohuda1",
            "rate": 0.01,
            "count": 1
          }
        },
        "m2": {
          "name": "ラフレシア",
          "img": "mp45.png",
          "attr": "wood",
          "hp": 8500,
          "atk": 1860,
          "def": 500,
          "turnInterval": 1,
          "size": "M",
          "exp": 250,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 43
          },
          "drops": [
            {
              "item": "puzzle32",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false,
          "ofudaDrop": {
            "enabled": true,
            "item": "ohuda1",
            "rate": 0.01,
            "count": 1
          }
        },
        "m3": {
          "name": "フシギダネ",
          "img": "mp1.png",
          "attr": "wood",
          "hp": 8500,
          "atk": 1750,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 250,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "バタフリー",
          "img": "mp12.png",
          "attr": "wood",
          "hp": 8200,
          "atk": 1600,
          "def": 100,
          "turnInterval": 1,
          "size": "M",
          "exp": 250,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 10
          },
          "drops": [
            {
              "item": "spuzzle_32",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false,
          "ofudaDrop": {
            "enabled": true,
            "item": "ohuda1",
            "rate": 0.01,
            "count": 1
          }
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m4",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m4"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 7000,
          "turnInterval": 2,
          "size": "S",
          "exp": 10000,
          "coin": 100,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "14-4": {
    "bgImg": "dungeon7.png",
    "bgm": "b8.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ピジョット",
            "img": "mp18.png",
            "attr": "light",
            "hp": 100000,
            "atk": 1750,
            "def": 750,
            "turnInterval": 1,
            "size": "XL",
            "exp": 2250,
            "coin": 30,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05,
              "monsterId": 16
            },
            "drops": [
              {
                "item": "puzzle43",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "light",
                    "count": 3,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ],
                "hpAbove": 85
              },
              {
                "name": "たつまき",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.2
                  },
                  {
                    "type": "board_change",
                    "pattern": "5color_heal",
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ],
                "hpBelow": 84
              },
              {
                "name": "エアーカッター",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_ratio",
                    "basis": "max",
                    "rate": 40
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "スピードスター",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "combo_absorb",
                    "turn": 1,
                    "combo": 5
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "おいかぜ",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "time_reduce",
                    "seconds": 1,
                    "turn": 10
                  }
                ]
              },
              {
                "name": "⚠️いかり",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "attack_buff",
                    "rate": 2.2,
                    "turn": -1
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "レアコイル",
          "img": "mp82.png",
          "attr": "light",
          "hp": 8000,
          "atk": 1650,
          "def": 400,
          "turnInterval": 1,
          "size": "M",
          "exp": 500,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 81
          },
          "drops": [
            {
              "item": "puzzle42",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "ofudaDrop": {
            "enabled": true,
            "item": "ohuda1",
            "rate": 0.01,
            "count": 1
          }
        },
        "m2": {
          "name": "ラッタ",
          "img": "mp20.png",
          "attr": "light",
          "hp": 8500,
          "atk": 1900,
          "def": 500,
          "turnInterval": 1,
          "size": "M",
          "exp": 250,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 19
          },
          "drops": [
            {
              "item": "puzzle42",
              "rate": 0.1,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false,
          "ofudaDrop": {
            "enabled": true,
            "item": "ohuda1",
            "rate": 0.01,
            "count": 1
          }
        },
        "m3": {
          "name": "カモネギ",
          "img": "mp83.png",
          "attr": "light",
          "hp": 8600,
          "atk": 1700,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 250,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "ドードリオ",
          "img": "mp85.png",
          "attr": "light",
          "hp": 8200,
          "atk": 1850,
          "def": 100,
          "turnInterval": 1,
          "size": "M",
          "exp": 250,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 84
          },
          "drops": [
            {
              "item": "spuzzle_42",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m4",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m4"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 7000,
          "turnInterval": 2,
          "size": "S",
          "exp": 10000,
          "coin": 100,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "14-5": {
    "bgImg": "dungeon7.png",
    "bgm": "b8.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "メタモン",
            "img": "mp132.png",
            "attr": "dark",
            "hp": 999999,
            "atk": 1,
            "def": 0,
            "turnInterval": 1,
            "size": "S",
            "exp": 5000,
            "coin": 50,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "spuzzle_52",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "久しぶりもん！",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "no_fall",
                    "turn": 99
                  },
                  {
                    "type": "skill_seal",
                    "turn": 99
                  },
                  {
                    "type": "bind",
                    "target": "all",
                    "turnMin": 5,
                    "turnMax": 5
                  }
                ]
              },
              {
                "name": "ブッブー！",
                "condition": "orb_has",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage",
                    "value": 999999,
                    "repeat": 12
                  }
                ],
                "orb": "fire"
              },
              {
                "name": "つぎだよ！",
                "condition": "orb_none",
                "skills": [
                  {
                    "type": "board_change",
                    "pattern": "5color_heal"
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "fire",
                    "count": 6
                  }
                ],
                "orb": "fire"
              },
              {
                "name": "むむっ！やるな？",
                "condition": "orb_none",
                "skills": [
                  {
                    "type": "board_change",
                    "pattern": "5color_heal"
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "fire",
                    "count": 7
                  },
                  {
                    "type": "roulette",
                    "count": 1,
                    "turn": 1,
                    "sec": 1
                  }
                ],
                "orb": "fire"
              },
              {
                "name": "すごいね！これならどうだ！",
                "condition": "orb_none",
                "skills": [
                  {
                    "type": "board_change",
                    "pattern": "5color_heal"
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "fire",
                    "count": 10
                  }
                ],
                "orb": "fire"
              },
              {
                "name": "これがラストだよ！",
                "condition": "orb_none",
                "skills": [
                  {
                    "type": "board_change",
                    "pattern": "multi",
                    "to": "water",
                    "orb_fire": true,
                    "orb_water": true,
                    "orb_wood": true,
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  },
                  {
                    "type": "blind"
                  }
                ],
                "orb": "fire"
              },
              {
                "name": "すごかったよ！またあそぼうね！",
                "condition": "orb_none",
                "skills": [
                  {
                    "type": "vanish"
                  }
                ],
                "orb": "fire"
              },
              {
                "name": "また遊ぼうもん！",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "board_change",
                    "pattern": "5color_heal",
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "fire",
                    "count": 3,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ]
              },
              {
                "name": "火ドロップをぜんぶけしてね？",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "time_reduce",
                    "seconds": 1,
                    "turn": 99
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "モルフォン",
          "img": "mp49.png",
          "attr": "dark",
          "hp": 8200,
          "atk": 1650,
          "def": 400,
          "turnInterval": 1,
          "size": "M",
          "exp": 500,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 48
          },
          "drops": [
            {
              "item": "puzzle52",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "once": false,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "ofudaDrop": {
            "enabled": true,
            "item": "ohuda1",
            "rate": 0.01,
            "count": 1
          }
        },
        "m2": {
          "name": "プクリン",
          "img": "mp40.png",
          "attr": "dark",
          "hp": 8500,
          "atk": 3900,
          "def": 500,
          "turnInterval": 2,
          "size": "M",
          "exp": 250,
          "coin": 20,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 39
          },
          "drops": [
            {
              "item": "puzzle52",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false,
          "ofudaDrop": {
            "enabled": true,
            "item": "ohuda1",
            "rate": 0.01,
            "count": 1
          }
        },
        "m3": {
          "name": "ゴース",
          "img": "mp92.png",
          "attr": "dark",
          "hp": 8600,
          "atk": 1300,
          "def": 100,
          "turnInterval": 1,
          "size": "S",
          "exp": 250,
          "coin": 15,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle5",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m4": {
          "name": "ベトベトン",
          "img": "mp89.png",
          "attr": "dark",
          "hp": 8200,
          "atk": 4200,
          "def": 300,
          "turnInterval": 3,
          "size": "M",
          "exp": 300,
          "coin": 25,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.05,
            "monsterId": 88
          },
          "drops": [
            {
              "item": "spuzzle_52",
              "rate": 0.05,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ],
          "isBoss": false
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m3",
            "m4",
            "m3"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m1",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 20,
          "enemies": [
            "m3",
            "m4"
          ]
        }
      ]
    },
    "intrusion": {
      "rate": 3,
      "monsters": [
        {
          "name": "ラッキー",
          "img": "mp113.png",
          "attr": "light",
          "hp": 10,
          "atk": 1,
          "def": 7000,
          "turnInterval": 2,
          "size": "S",
          "exp": 10000,
          "coin": 100,
          "monsterDrop": {
            "enabled": true,
            "rate": 0.2
          },
          "drops": [],
          "actions": [
            {
              "name": "にげる",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "flee"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "14-boss": {
    "bgImg": "dungeon7.png",
    "bgm": "b9.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ケンタロス",
            "img": "mp128.png",
            "attr": "fire",
            "hp": 70000,
            "atk": 2020,
            "def": 400,
            "turnInterval": 1,
            "size": "XL",
            "exp": 0,
            "coin": 0,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle12",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "⚠️すてみタックル",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "damage_ratio",
                    "basis": "current",
                    "rate": 75
                  }
                ]
              },
              {
                "name": "いかく",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "rec_down",
                    "value": 0.75,
                    "turn": 3
                  }
                ]
              },
              {
                "name": "とっしん",
                "condition": "normal",
                "weight": 50,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.2
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "タックル",
                "condition": "normal",
                "weight": 50,
                "once": false,
                "skills": [
                  {
                    "type": "board_change",
                    "pattern": "5color_heal"
                  },
                  {
                    "type": "damage_mult",
                    "value": 1.4
                  }
                ],
                "hpBelow": 50
              }
            ],
            "isBoss": false
          }
        ]
      },
      {
        "enemies": [
          {
            "name": "ラプラス",
            "img": "mp131.png",
            "attr": "water",
            "hp": 90000,
            "atk": 3269,
            "def": 100,
            "turnInterval": 2,
            "size": "XL",
            "exp": 0,
            "coin": 0,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle22",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "オーロラビーム",
                "condition": "normal",
                "weight": 30,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "atk_down",
                    "target": "all",
                    "rate": 25,
                    "turn": 2
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "うたう",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "bind",
                    "target": "attr",
                    "attr": "wood",
                    "turnMin": 2,
                    "turnMax": 2
                  }
                ]
              },
              {
                "name": "のしかかり",
                "condition": "normal",
                "weight": 30,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "convert",
                    "from": "wood",
                    "to": "fire"
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "アクアブレイク",
                "condition": "normal",
                "weight": 40,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.2
                  }
                ],
                "hpBelow": 50
              }
            ],
            "isBoss": false
          }
        ]
      },
      {
        "enemies": [
          {
            "name": "ストライク",
            "img": "mp123.png",
            "attr": "wood",
            "hp": 100000,
            "atk": 3000,
            "def": 250,
            "turnInterval": 2,
            "size": "XL",
            "exp": 0,
            "coin": 0,
            "drops": [
              {
                "item": "puzzle32",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 70,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              },
              {
                "name": "カマできる",
                "condition": "normal",
                "weight": 30,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "attack_buff",
                    "rate": 1.3,
                    "turn": 2
                  }
                ]
              },
              {
                "name": "⚠️れんぞくぎり",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "damage",
                    "value": 1111,
                    "repeat": 4
                  }
                ]
              }
            ],
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "isBoss": false
          }
        ]
      },
      {
        "enemies": [
          {
            "name": "ガルーラ",
            "img": "mp115.png",
            "attr": "light",
            "hp": 75000,
            "atk": 2233,
            "def": 1500,
            "turnInterval": 1,
            "size": "XL",
            "exp": 0,
            "coin": 0,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle42",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "ほのおのパンチ",
                "condition": "normal",
                "weight": 33,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "fire",
                    "count": 4
                  }
                ]
              },
              {
                "name": "かみなりパンチ",
                "condition": "normal",
                "weight": 33,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "bind",
                    "target": "random",
                    "countMin": 1,
                    "countMax": 1,
                    "turnMin": 2,
                    "turnMax": 2
                  }
                ]
              },
              {
                "name": "れいとうパンチ",
                "condition": "normal",
                "weight": 34,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "time_reduce",
                    "seconds": 1,
                    "turn": 1
                  }
                ]
              },
              {
                "name": "グロウパンチ",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "attack_buff",
                    "rate": 1.2,
                    "turn": 5
                  }
                ]
              },
              {
                "name": "⚠️つるぎのまい",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "attack_buff",
                    "rate": 1.5,
                    "turn": -1
                  }
                ]
              }
            ],
            "isBoss": false
          }
        ]
      },
      {
        "enemies": [
          {
            "name": "プテラ",
            "img": "mp142.png",
            "attr": "dark",
            "hp": 120000,
            "atk": 2103,
            "def": 100,
            "turnInterval": 1,
            "size": "XL",
            "exp": 0,
            "coin": 0,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [
              {
                "item": "puzzle52",
                "rate": 0.05,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "かっくう",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "atk_down",
                    "target": "attr",
                    "attr": "light",
                    "rate": 25,
                    "turn": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "かみつく",
                "condition": "normal",
                "weight": 50,
                "skills": [
                  {
                    "type": "damage_ratio",
                    "basis": "max",
                    "rate": 20
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "げんしのさだめ",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "attr_guard",
                    "attr": "dark",
                    "rate": 50,
                    "turn": -1
                  },
                  {
                    "type": "combo_absorb",
                    "turn": 99,
                    "combo": 3
                  }
                ]
              },
              {
                "name": "⚠️げんしのちから",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.5
                  },
                  {
                    "type": "status_shield",
                    "turn": 99
                  },
                  {
                    "type": "dmg_reduce",
                    "rate": 50,
                    "turn": 1
                  }
                ]
              },
              {
                "name": "ランドクラッシュ",
                "condition": "normal",
                "weight": 50,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.3
                  },
                  {
                    "type": "board_change",
                    "pattern": "5color_heal"
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "がんせきふうじ",
                "condition": "normal",
                "weight": 50,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.1
                  },
                  {
                    "type": "time_reduce",
                    "seconds": 1,
                    "turn": 1
                  }
                ],
                "hpBelow": 50
              }
            ],
            "isBoss": false
          }
        ]
      },
      {
        "enemies": [
          {
            "name": "ミュウ",
            "img": "mp151.png",
            "attr": "dark",
            "hp": 250000,
            "atk": 2500,
            "def": 1500,
            "turnInterval": 1,
            "size": "XL",
            "exp": 7999,
            "coin": 39,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [],
            "actions": [
              {
                "name": "ステータスバリア",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "status_shield",
                    "turn": 99
                  }
                ]
              },
              {
                "name": "ふしぎなしっぽ",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "combo_absorb",
                    "turn": 99,
                    "combo": 4
                  }
                ]
              },
              {
                "name": "ゲノムシールド",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "attr_guard",
                    "attr": "light",
                    "rate": 50,
                    "turn": -1
                  }
                ]
              },
              {
                "name": "フレイムゲノム",
                "condition": "normal",
                "weight": 20,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "row",
                    "to": "fire",
                    "pos": "1",
                    "lines": 1,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  },
                  {
                    "type": "rec_down",
                    "value": 0.75,
                    "turn": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "ウォーターゲノム",
                "condition": "normal",
                "weight": 20,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "row",
                    "to": "water",
                    "pos": "2",
                    "lines": 1,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  },
                  {
                    "type": "time_reduce",
                    "seconds": 1,
                    "turn": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "ウッドゲノム",
                "condition": "normal",
                "weight": 20,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "row",
                    "to": "wood",
                    "pos": "3",
                    "lines": 1,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  },
                  {
                    "type": "no_fall",
                    "turn": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "シャインゲノム",
                "condition": "normal",
                "weight": 20,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "row",
                    "to": "light",
                    "pos": "4",
                    "lines": 1,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  },
                  {
                    "type": "roulette",
                    "count": 2,
                    "turn": 1,
                    "sec": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "ダークゲノム",
                "condition": "normal",
                "weight": 20,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "row",
                    "to": "dark",
                    "pos": "5",
                    "lines": 1,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  },
                  {
                    "type": "blind"
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "⚠️クロスフュージョン",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "skill_seal",
                    "turn": 1
                  },
                  {
                    "type": "attack_buff",
                    "rate": 1.2,
                    "turn": -1
                  },
                  {
                    "type": "heal_self",
                    "rate": 0.1
                  }
                ]
              },
              {
                "name": "フレイムエナジー",
                "condition": "normal",
                "weight": 20,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "col",
                    "to": "fire",
                    "pos": "1",
                    "lines": 1,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  },
                  {
                    "type": "rec_down",
                    "value": 0.75,
                    "turn": 1
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "アクアエナジー",
                "condition": "normal",
                "weight": 20,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "col",
                    "to": "water",
                    "pos": "2",
                    "lines": 1,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  },
                  {
                    "type": "time_reduce",
                    "seconds": 1,
                    "turn": 1
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "ウインドエナジー",
                "condition": "normal",
                "weight": 20,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "col",
                    "to": "wood",
                    "pos": "3",
                    "lines": 1,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  },
                  {
                    "type": "atk_down",
                    "target": "all",
                    "rate": 25,
                    "turn": 1
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "ライトニングエナジー",
                "condition": "normal",
                "weight": 20,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "col",
                    "to": "light",
                    "pos": "4",
                    "lines": 1,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  },
                  {
                    "type": "bind",
                    "target": "random",
                    "countMin": 2,
                    "countMax": 3,
                    "turnMin": 1,
                    "turnMax": 2
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "ブラインドエナジー",
                "condition": "normal",
                "weight": 20,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "col",
                    "to": "dark",
                    "pos": "5",
                    "lines": 1,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  },
                  {
                    "type": "blind"
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "⚠️いでんしのかっせい",
                "condition": "hp<=5%",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "attack_buff",
                    "rate": 10,
                    "turn": -1
                  },
                  {
                    "type": "heal_self",
                    "rate": 0.25
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "requireAllAttr": true
  },
  "daily_tue-2": {
    "bgImg": "dungeon13.png",
    "bgm": "b3.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ポリゴン",
            "img": "mp137.png",
            "attr": "fire",
            "hp": 130000,
            "atk": 4900,
            "def": 1000,
            "turnInterval": 2,
            "size": "XL",
            "exp": 250,
            "coin": 50,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.1
            },
            "drops": [
              {
                "item": "puzzle13",
                "rate": 0.25,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "キュウコン",
          "img": "mp38.png",
          "attr": "fire",
          "hp": 46550,
          "atk": 3005,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 300,
          "coin": 10,
          "monsterDrop": {
            "enabled": false,
            "rate": 0.05,
            "monsterId": 33
          },
          "drops": [
            {
              "item": "puzzle12",
              "rate": 0.1,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "ギャロップ",
          "img": "mp78.png",
          "attr": "fire",
          "hp": 35000,
          "atk": 1432,
          "def": 2000,
          "turnInterval": 1,
          "size": "S",
          "exp": 220,
          "coin": 10,
          "monsterDrop": {
            "enabled": false,
            "rate": 0.05,
            "monsterId": 32
          },
          "drops": [
            {
              "item": "spuzzle_12",
              "rate": 0.1,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 40,
          "enemies": [
            "m1",
            "m1",
            "m1",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 45,
          "enemies": [
            "m1",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 5,
          "enemies": [
            "m2",
            "m2",
            "m2",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 40,
          "enemies": [
            "m1",
            "m1",
            "m1",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 45,
          "enemies": [
            "m1",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 5,
          "enemies": [
            "m2",
            "m2",
            "m2",
            "m2",
            "m1"
          ]
        }
      ]
    }
  },
  "daily_wed-2": {
    "bgImg": "dungeon9.png",
    "bgm": "b2.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ルージュラ",
            "img": "mp124.png",
            "attr": "water",
            "hp": 140000,
            "atk": 4950,
            "def": 900,
            "turnInterval": 2,
            "size": "XL",
            "exp": 250,
            "coin": 50,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.1
            },
            "drops": [
              {
                "item": "puzzle23",
                "rate": 0.25,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "ゴルダック",
          "img": "mp55.png",
          "attr": "water",
          "hp": 46550,
          "atk": 3005,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 300,
          "coin": 10,
          "monsterDrop": {
            "enabled": false,
            "rate": 0.05,
            "monsterId": 33
          },
          "drops": [
            {
              "item": "puzzle22",
              "rate": 0.1,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "ヤドラン",
          "img": "mp80.png",
          "attr": "water",
          "hp": 35000,
          "atk": 1432,
          "def": 2000,
          "turnInterval": 1,
          "size": "S",
          "exp": 220,
          "coin": 10,
          "monsterDrop": {
            "enabled": false,
            "rate": 0.05,
            "monsterId": 32
          },
          "drops": [
            {
              "item": "spuzzle_22",
              "rate": 0.1,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 40,
          "enemies": [
            "m1",
            "m1",
            "m1",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 45,
          "enemies": [
            "m1",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 5,
          "enemies": [
            "m2",
            "m2",
            "m2",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 40,
          "enemies": [
            "m1",
            "m1",
            "m1",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 45,
          "enemies": [
            "m1",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 5,
          "enemies": [
            "m2",
            "m2",
            "m2",
            "m2",
            "m1"
          ]
        }
      ]
    }
  },
  "daily_thu-1": {
    "bgImg": "dungeon2.png",
    "bgm": "b1.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "カビゴン",
            "img": "mp143.png",
            "attr": "wood",
            "hp": 65000,
            "atk": 2000,
            "def": 0,
            "turnInterval": 3,
            "size": "XL",
            "exp": 250,
            "coin": 50,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.1
            },
            "drops": [
              {
                "item": "puzzle32",
                "rate": 0.1,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "トランセル",
          "img": "mp11.png",
          "attr": "wood",
          "hp": 2450,
          "atk": 860,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 100,
          "coin": 5,
          "monsterDrop": {
            "enabled": false,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle3",
              "rate": 0.1,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "コクーン",
          "img": "mp14.png",
          "attr": "wood",
          "hp": 3000,
          "atk": 433,
          "def": 100,
          "turnInterval": 1,
          "size": "S",
          "exp": 121,
          "coin": 9,
          "monsterDrop": {
            "enabled": false,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_3",
              "rate": 0.1,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 5,
          "enemies": [
            "m2",
            "m2",
            "m2",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 40,
          "enemies": [
            "m1",
            "m1",
            "m1",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 30,
          "enemies": [
            "m1",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 5,
          "enemies": [
            "m1",
            "m1",
            "m1",
            "m1",
            "m2"
          ]
        }
      ]
    }
  },
  "daily_thu-2": {
    "bgImg": "dungeon2.png",
    "bgm": "b1.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "カビゴン",
            "img": "mp143.png",
            "attr": "wood",
            "hp": 220000,
            "atk": 9430,
            "def": 0,
            "turnInterval": 5,
            "size": "XL",
            "exp": 250,
            "coin": 50,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.1
            },
            "drops": [
              {
                "item": "puzzle33",
                "rate": 0.25,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "⚠️たおれこむ",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "バタフリー",
          "img": "mp12.png",
          "attr": "wood",
          "hp": 46550,
          "atk": 3005,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 300,
          "coin": 10,
          "monsterDrop": {
            "enabled": false,
            "rate": 0.05,
            "monsterId": 33
          },
          "drops": [
            {
              "item": "puzzle32",
              "rate": 0.1,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "スピアー",
          "img": "mp15.png",
          "attr": "wood",
          "hp": 30000,
          "atk": 1932,
          "def": 2000,
          "turnInterval": 1,
          "size": "S",
          "exp": 220,
          "coin": 10,
          "monsterDrop": {
            "enabled": false,
            "rate": 0.05,
            "monsterId": 32
          },
          "drops": [
            {
              "item": "spuzzle_32",
              "rate": 0.1,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 40,
          "enemies": [
            "m1",
            "m1",
            "m1",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 45,
          "enemies": [
            "m1",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 5,
          "enemies": [
            "m2",
            "m2",
            "m2",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 40,
          "enemies": [
            "m1",
            "m1",
            "m1",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 45,
          "enemies": [
            "m1",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 5,
          "enemies": [
            "m2",
            "m2",
            "m2",
            "m2",
            "m1"
          ]
        }
      ]
    }
  },
  "daily_fri-1": {
    "bgImg": "dungeon6.png",
    "bgm": "b5.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "カモネギ",
            "img": "mp83.png",
            "attr": "light",
            "hp": 65000,
            "atk": 2000,
            "def": 0,
            "turnInterval": 3,
            "size": "XL",
            "exp": 250,
            "coin": 50,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.1
            },
            "drops": [
              {
                "item": "puzzle42",
                "rate": 0.1,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "サンド",
          "img": "mp27.png",
          "attr": "light",
          "hp": 2450,
          "atk": 860,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 100,
          "coin": 5,
          "monsterDrop": {
            "enabled": false,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "puzzle4",
              "rate": 0.1,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "ピカチュウ",
          "img": "mp25.png",
          "attr": "light",
          "hp": 3000,
          "atk": 433,
          "def": 100,
          "turnInterval": 1,
          "size": "S",
          "exp": 121,
          "coin": 9,
          "monsterDrop": {
            "enabled": false,
            "rate": 0.05
          },
          "drops": [
            {
              "item": "spuzzle_4",
              "rate": 0.1,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 5,
          "enemies": [
            "m2",
            "m2",
            "m2",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 40,
          "enemies": [
            "m1",
            "m1",
            "m1",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 30,
          "enemies": [
            "m1",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 5,
          "enemies": [
            "m1",
            "m1",
            "m1",
            "m1",
            "m2"
          ]
        }
      ]
    }
  },
  "daily_fri-2": {
    "bgImg": "dungeon6.png",
    "bgm": "b5.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "カモネギ",
            "img": "mp83.png",
            "attr": "light",
            "hp": 140000,
            "atk": 4950,
            "def": 900,
            "turnInterval": 2,
            "size": "XL",
            "exp": 250,
            "coin": 50,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.1
            },
            "drops": [
              {
                "item": "puzzle43",
                "rate": 0.25,
                "count": 1
              }
            ],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ],
    "random": {
      "floors": 4,
      "monsters": {
        "m1": {
          "name": "サンドパン",
          "img": "mp28.png",
          "attr": "light",
          "hp": 46550,
          "atk": 3005,
          "def": 0,
          "turnInterval": 2,
          "size": "S",
          "exp": 300,
          "coin": 10,
          "monsterDrop": {
            "enabled": false,
            "rate": 0.05,
            "monsterId": 33
          },
          "drops": [
            {
              "item": "puzzle42",
              "rate": 0.1,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        },
        "m2": {
          "name": "ライチュウ",
          "img": "mp26.png",
          "attr": "light",
          "hp": 35000,
          "atk": 1432,
          "def": 2000,
          "turnInterval": 1,
          "size": "S",
          "exp": 220,
          "coin": 10,
          "monsterDrop": {
            "enabled": false,
            "rate": 0.05,
            "monsterId": 32
          },
          "drops": [
            {
              "item": "spuzzle_42",
              "rate": 0.1,
              "count": 1
            }
          ],
          "actions": [
            {
              "name": "通常攻撃",
              "condition": "normal",
              "weight": 100,
              "skills": [
                {
                  "type": "damage_mult",
                  "value": 1
                }
              ]
            }
          ]
        }
      },
      "patterns": [
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 40,
          "enemies": [
            "m1",
            "m1",
            "m1",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 45,
          "enemies": [
            "m1",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 5,
          "enemies": [
            "m2",
            "m2",
            "m2",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 10,
          "enemies": [
            "m1",
            "m2",
            "m1"
          ]
        },
        {
          "weight": 40,
          "enemies": [
            "m1",
            "m1",
            "m1",
            "m2",
            "m2"
          ]
        },
        {
          "weight": 45,
          "enemies": [
            "m1",
            "m1",
            "m2"
          ]
        },
        {
          "weight": 5,
          "enemies": [
            "m2",
            "m2",
            "m2",
            "m2",
            "m1"
          ]
        }
      ]
    }
  },
  "15-boss": {
    "bgImg": "dungeon15.png",
    "bgm": "b9.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "ファイヤー",
            "img": "mp146.png",
            "attr": "fire",
            "hp": 100000,
            "atk": 3850,
            "def": 1000,
            "turnInterval": 1,
            "size": "XL",
            "exp": 0,
            "coin": 0,
            "monsterDrop": {
              "enabled": false,
              "rate": 1
            },
            "drops": [],
            "actions": [
              {
                "name": "ほのおのつばさ",
                "condition": "normal",
                "weight": 33,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "fire",
                    "count": 4,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "れんぞくこうげき",
                "condition": "normal",
                "weight": 33,
                "once": false,
                "skills": [
                  {
                    "type": "damage",
                    "value": 1150,
                    "repeat": 3
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "こうおんガス",
                "condition": "normal",
                "weight": 34,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "poison",
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": "",
                    "count": 4
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "⚠️れっかのまい",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "multi",
                    "to": "water",
                    "orb_fire": true,
                    "orb_water": "",
                    "orb_wood": true,
                    "orb_light": true,
                    "orb_dark": false,
                    "orb_heal": true,
                    "orb_poison": ""
                  },
                  {
                    "type": "dmg_reduce",
                    "rate": 20,
                    "turn": -1
                  },
                  {
                    "type": "attack_buff",
                    "rate": 1.5,
                    "turn": 1
                  }
                ]
              },
              {
                "name": "ヒートブラスト",
                "condition": "normal",
                "weight": 50,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "convert",
                    "from": "water",
                    "to": "fire",
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "ほのおのうず",
                "condition": "normal",
                "weight": 50,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "roulette",
                    "count": 5,
                    "turn": 1,
                    "sec": 2
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "⚠️イビルバーン",
                "condition": "hp<=5%",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 99
                  }
                ]
              }
            ],
            "isBoss": false
          }
        ]
      },
      {
        "enemies": [
          {
            "name": "フリーザー",
            "img": "mp144.png",
            "attr": "water",
            "hp": 150000,
            "atk": 2011,
            "def": 0,
            "turnInterval": 1,
            "size": "XL",
            "exp": 0,
            "coin": 0,
            "monsterDrop": {
              "enabled": false,
              "rate": 0.05
            },
            "drops": [],
            "actions": [
              {
                "name": "こごえるかぜ",
                "condition": "normal",
                "weight": 33,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "water",
                    "count": 6,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  },
                  {
                    "type": "atk_down",
                    "target": "attr",
                    "attr": "water",
                    "rate": 50,
                    "turn": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "氷鳥の威圧",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "attr_guard",
                    "attr": "dark",
                    "rate": 50,
                    "turn": -1
                  },
                  {
                    "type": "status_shield",
                    "turn": 99
                  }
                ]
              },
              {
                "name": "先制攻撃",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "roulette",
                    "count": 1,
                    "turn": 99,
                    "sec": 1
                  }
                ]
              },
              {
                "name": "はばたき",
                "condition": "normal",
                "weight": 33,
                "once": false,
                "skills": [
                  {
                    "type": "damage",
                    "value": 328,
                    "repeat": 6
                  },
                  {
                    "type": "board_change",
                    "pattern": "convert",
                    "from": "water",
                    "to": "fire",
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "ワイルドフリーズ",
                "condition": "normal",
                "weight": 34,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "skill_seal",
                    "turn": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "⚠️でんせつのひしょう",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "roulette",
                    "count": 5,
                    "turn": 3,
                    "sec": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "water",
                    "count": 7,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ]
              },
              {
                "name": "アイスウイング",
                "condition": "normal",
                "weight": 50,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.2
                  },
                  {
                    "type": "time_reduce",
                    "seconds": 1,
                    "turn": 1
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "フロストプリズン",
                "condition": "normal",
                "weight": 50,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "bind",
                    "target": "random",
                    "countMin": 1,
                    "countMax": 1,
                    "turnMin": 2,
                    "turnMax": 2
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "⚠️いてつきの足音",
                "condition": "hp<=10%",
                "once": true,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "attack_buff",
                    "rate": 2,
                    "turn": -1
                  },
                  {
                    "type": "heal_self",
                    "rate": 0.25
                  },
                  {
                    "type": "board_change",
                    "pattern": "random_to",
                    "to": "water",
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ]
              }
            ],
            "isBoss": false
          }
        ]
      },
      {
        "enemies": [
          {
            "name": "サンダー",
            "img": "mp145.png",
            "attr": "light",
            "hp": 80000,
            "atk": 1920,
            "def": 1000,
            "turnInterval": 1,
            "size": "XL",
            "exp": 0,
            "coin": 0,
            "monsterDrop": {
              "enabled": false,
              "rate": 0.05
            },
            "drops": [],
            "actions": [
              {
                "name": "プレッシャー",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "skill_seal",
                    "turn": 3
                  }
                ]
              },
              {
                "name": "かぜまとい",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "attr_guard",
                    "attr": "water",
                    "rate": 50,
                    "turn": -1
                  }
                ]
              },
              {
                "name": "エアスラッシュ",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "attr_guard",
                    "attr": "wood",
                    "rate": 50,
                    "turn": 1
                  }
                ]
              },
              {
                "name": "ショートボルト",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.1
                  },
                  {
                    "type": "roulette",
                    "count": 2,
                    "turn": 3,
                    "sec": 1
                  }
                ]
              },
              {
                "name": "パラボラチャージ",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.1
                  },
                  {
                    "type": "heal_self",
                    "rate": 0.05
                  }
                ]
              },
              {
                "name": "ボルトフロート",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.2
                  },
                  {
                    "type": "combo_absorb",
                    "turn": 1,
                    "combo": 5
                  }
                ]
              },
              {
                "name": "ゆうだち",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1.3
                  },
                  {
                    "type": "board_change",
                    "pattern": "spawn",
                    "to": "water",
                    "count": 10,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  },
                  {
                    "type": "attr_guard",
                    "attr": "water",
                    "rate": 50,
                    "turn": 1
                  }
                ]
              },
              {
                "name": "⚠️ぼうふう",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "damage_ratio",
                    "basis": "max",
                    "rate": 50
                  },
                  {
                    "type": "board_change",
                    "pattern": "5color_heal",
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  }
                ]
              }
            ],
            "isBoss": false,
            "actionMode": "sequence"
          }
        ]
      },
      {
        "enemies": [
          {
            "name": "ミュウツー",
            "img": "mp150.png",
            "attr": "dark",
            "hp": 300000,
            "atk": 2800,
            "def": 500,
            "turnInterval": 1,
            "size": "XL",
            "exp": 9999,
            "coin": 99,
            "monsterDrop": {
              "enabled": true,
              "rate": 0.05
            },
            "drops": [],
            "actions": [
              {
                "name": "ステータスバリア",
                "condition": "battle_start",
                "once": true,
                "skills": [
                  {
                    "type": "super_gut",
                    "rate": 50
                  },
                  {
                    "type": "status_shield",
                    "turn": 99
                  },
                  {
                    "type": "attr_guard",
                    "attr": "light",
                    "rate": 25,
                    "turn": -1
                  }
                ]
              },
              {
                "name": "フレイムゲノム",
                "condition": "normal",
                "weight": 20,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "row",
                    "to": "fire",
                    "pos": "1",
                    "lines": 1,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  },
                  {
                    "type": "rec_down",
                    "value": 0.75,
                    "turn": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "ウォーターゲノム",
                "condition": "normal",
                "weight": 20,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "row",
                    "to": "water",
                    "pos": "2",
                    "lines": 1,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  },
                  {
                    "type": "time_reduce",
                    "seconds": 1,
                    "turn": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "ウッドゲノム",
                "condition": "normal",
                "weight": 20,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "row",
                    "to": "wood",
                    "pos": "3",
                    "lines": 1,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  },
                  {
                    "type": "no_fall",
                    "turn": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "シャインゲノム",
                "condition": "normal",
                "weight": 20,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "row",
                    "to": "light",
                    "pos": "4",
                    "lines": 1,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  },
                  {
                    "type": "roulette",
                    "count": 2,
                    "turn": 1,
                    "sec": 1
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "ダークゲノム",
                "condition": "normal",
                "weight": 20,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "row",
                    "to": "dark",
                    "pos": "5",
                    "lines": 1,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  },
                  {
                    "type": "blind"
                  }
                ],
                "hpAbove": 51
              },
              {
                "name": "⚠️さいきょうのいでんし",
                "condition": "hp<=50%",
                "once": true,
                "skills": [
                  {
                    "type": "attack_buff",
                    "rate": 1.1,
                    "turn": -1
                  },
                  {
                    "type": "combo_absorb",
                    "turn": 99,
                    "combo": 5
                  }
                ]
              },
              {
                "name": "フレイムパワー",
                "condition": "normal",
                "weight": 20,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "col",
                    "to": "fire",
                    "pos": "1",
                    "lines": 1,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  },
                  {
                    "type": "rec_down",
                    "value": 0.75,
                    "turn": 1
                  },
                  {
                    "type": "attr_guard",
                    "attr": "fire",
                    "rate": 25,
                    "turn": 1
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "アクアパワー",
                "condition": "normal",
                "weight": 20,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "col",
                    "to": "water",
                    "pos": "2",
                    "lines": 1,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  },
                  {
                    "type": "time_reduce",
                    "seconds": 1,
                    "turn": 1
                  },
                  {
                    "type": "attr_guard",
                    "attr": "water",
                    "rate": 25,
                    "turn": 1
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "ウインドエナジー",
                "condition": "normal",
                "weight": 20,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "col",
                    "to": "wood",
                    "pos": "3",
                    "lines": 1,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  },
                  {
                    "type": "atk_down",
                    "target": "all",
                    "rate": 25,
                    "turn": 1
                  },
                  {
                    "type": "attr_guard",
                    "attr": "wood",
                    "rate": 25,
                    "turn": 1
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "ライトニングエナジー",
                "condition": "normal",
                "weight": 20,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "col",
                    "to": "light",
                    "pos": "4",
                    "lines": 1,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  },
                  {
                    "type": "bind",
                    "target": "random",
                    "countMin": 2,
                    "countMax": 3,
                    "turnMin": 1,
                    "turnMax": 2
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "ブラインドエナジー",
                "condition": "normal",
                "weight": 20,
                "once": false,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  },
                  {
                    "type": "board_change",
                    "pattern": "col",
                    "to": "dark",
                    "pos": "5",
                    "lines": 1,
                    "orb_fire": "",
                    "orb_water": "",
                    "orb_wood": "",
                    "orb_light": "",
                    "orb_dark": "",
                    "orb_heal": "",
                    "orb_poison": ""
                  },
                  {
                    "type": "blind"
                  },
                  {
                    "type": "attr_guard",
                    "attr": "dark",
                    "rate": 25,
                    "turn": 1
                  }
                ],
                "hpBelow": 50
              },
              {
                "name": "⚠️いでんしのかっせい",
                "condition": "hp<=5%",
                "once": true,
                "skills": [
                  {
                    "type": "attack_buff",
                    "rate": 10,
                    "turn": -1
                  },
                  {
                    "type": "heal_self",
                    "rate": 0.25
                  }
                ]
              }
            ],
            "isBoss": true
          }
        ]
      }
    ]
  },
  "keiken-2": {
    "bgImg": "dungeon1.png",
    "bgm": "b1.mp3",
    "battles": [
      {
        "enemies": [
          {
            "name": "バタフリー",
            "img": "mp12.png",
            "attr": "wood",
            "hp": 66550,
            "atk": 7200,
            "def": 3000,
            "turnInterval": 2,
            "size": "S",
            "exp": 5000,
            "coin": 0,
            "monsterDrop": {
              "enabled": false,
              "rate": 0.05,
              "monsterId": 33
            },
            "drops": [],
            "actions": [
              {
                "name": "通常攻撃",
                "condition": "normal",
                "weight": 100,
                "skills": [
                  {
                    "type": "damage_mult",
                    "value": 1
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        "enemies": [
          {
            "name": "ラッキー",
            "img": "mp113.png",
            "attr": "light",
            "hp": 12,
            "atk": 1,
            "def": 25000,
            "isBoss": false,
            "turnInterval": 2,
            "size": "S",
            "exp": 10000,
            "coin": 0,
            "drops": [],
            "actions": [
              {
                "name": "にげる",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "flee"
                  }
                ]
              }
            ],
            "monsterDrop": {
              "enabled": true,
              "rate": 0.75
            }
          }
        ]
      },
      {
        "enemies": [
          {
            "name": "ラッキー",
            "img": "mp113.png",
            "attr": "light",
            "hp": 100,
            "atk": 1,
            "def": 35000,
            "isBoss": true,
            "turnInterval": 2,
            "size": "XL",
            "exp": 10000,
            "coin": 0,
            "drops": [],
            "actions": [
              {
                "name": "にげる",
                "condition": "normal",
                "weight": 100,
                "once": false,
                "skills": [
                  {
                    "type": "flee"
                  }
                ]
              }
            ],
            "monsterDrop": {
              "enabled": true,
              "rate": 0.75
            }
          }
        ]
      }
    ]
  }
};
