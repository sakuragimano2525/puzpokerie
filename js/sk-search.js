// ============================================================
// ★ スキル（アクティブスキル）検索 ★
//   リーダースキル検索（js/ls-search.js）と同じしくみで、モンスターの「スキル」を絞り込む。
//   画面にボタンは増やさない。リダスキ検索のシートの中に「リダスキ / スキル」のタブができて、
//   「スキル」タブを開くと、ここで作ったボタンが並ぶ（ボタンが増えて1列が2列になったりしないように）。
//
//   【しくみ】
//   各モンスターの skill（effects と desc と condition）を読み取って、「タグ」の集まりにする（analyze）。
//     例) 敵全体に1,000の固定ダメージ＋最上段の横1列を木に変化
//           → e:dmgFix, dt:all, e:line, ln:row, mk:wood, u:none
//         盤面に闇ドロップが5個以上あるときだけ使える
//           → u:any, u:orbCount, uo:dark, un.oc:5
//   シートに並ぶボタンは、いまのモンスターデータから自動で作る（catalog）。
//   → monsters.js にスキルを足すと、新しい「必要SP」「条件の数字」などのボタンも勝手に増える。
//   → モンスターエディターに新しい効果の種類を足したときは、analyze() の switch に1つ足すだけ。
//
//   【タグの名前】 「グループ:中身」。グループ（: の前）がボタンの「項目」になる。
//     u=使用条件 uo/ub=条件になるドロップの色 un.○=条件の数字
//     e=効果の種類 dt=敵への対象 da=攻撃の属性
//     mk=作られるドロップの色 cvf=変換元の色 ln=列の向き sh=生成する形 lk/ul=ロック／解除する色 fb=落ちやすくなる色
//     bt=攻撃力アップの対象
//   数字で絞るもの（強さ・ターン数・必要SPなど）は METRIC に書いてある（「○以上」で絞る。必要SPだけは「ちょうど○」）。
//
//   【絞り込みのルール】 別の項目どうし = 全部に当てはまる（かつ）
//                         同じ項目の中 = どれか1つ（または）。ただし
//                           「効果の種類」と「作られるドロップの色」は、シートの「すべて／どれか」ボタンで切りかえられる
//   例) 効果「固定ダメージ」「ロック」を両方ON（すべて） → ダメージもロックもできるスキル
//       変換元「水」＋ 作られる色「回復」               → 水ドロップを回復ドロップに変えるスキル
//
//   使い方（js/ls-search.js から）:
//     const st = SKSearch.newState();
//     SKSearch.match(st, SKSearch.infoOf(mon))   … 条件に合うか
//     SKSearch.buildView(body, st, infos, onChange) … 「スキル」タブの中身を作る（{ update() } を返す）
// ============================================================
(function (global) {
  'use strict';

  const EPS = 1e-9;
  const ATTR_ORDER = ['fire', 'water', 'wood', 'light', 'dark', 'heal', 'poison', 'ojama'];
  const ATTR_JP = { fire: '火', water: '水', wood: '木', light: '光', dark: '闇', heal: '回復', poison: '毒', ojama: 'お邪魔', none: '無' };
  const JP2ATTR = { '火': 'fire', '水': 'water', '木': 'wood', '光': 'light', '闇': 'dark', '回復': 'heal', '毒': 'poison', 'お邪魔': 'ojama' };
  // ドロップの絵（js/skill-text.js の ORB_IMG と同じ）。無いときは文字だけになる
  const ORB_IMG = { fire: '1.png', water: '2.png', wood: '3.png', light: '4.png', dark: '5.png', heal: '6.png', poison: '8.png', ojama: 'ojama.png' };
  const TYPE_ORDER = ['バランス', 'こうげき', 'たいりょく', 'かいふく', '神秘'];
  const TYPE_ICON = { 'たいりょく': 'typ1.png', 'こうげき': 'typ2.png', 'かいふく': 'typ3.png', 'バランス': 'typ4.png', '神秘': 'typ5.png' };
  const normAttr = a => JP2ATTR[a] || a;
  const pct = x => Math.round(Number(x) * 100);
  const fmtN = n => String(Math.round(n * 100) / 100);
  const comma = n => Number(n).toLocaleString('ja-JP');
  const clamp01 = x => Math.min(1, Math.max(0, x));

  // ── 検索用の文字そろえ（全角半角・ひらがなカタカナの違いを無視） ──
  function norm(s) {
    s = String(s == null ? '' : s);
    try { s = s.normalize('NFKC'); } catch (e) {}
    return s.toLowerCase().replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
  }

  // ============================================================
  // 数字で絞る項目（「○以上」「○以下」）
  //   steps … ボタンにする数字の候補。データにその数字以上のスキルがあるものだけボタンになる
  //   dir   … 'eq' なら「ちょうど○」（必要SPだけ）。ほかは「○以上」
  //   chip  … ボタンの文字 ／ full … 画面の上に出る小さなタグの文字 ／ head … 一覧のカードの下に出す文字
  // ============================================================
  const METRIC = {
    sp:       { dir: 'eq', chip: v => 'SP' + v, full: v => '必要SP ' + v },   // 必要SPだけは「ちょうどその数」で絞る
    atkMult:  { steps: [3, 5, 7, 10, 15, 20, 50], chip: v => fmtN(v) + '倍〜', full: v => '攻撃力×' + fmtN(v) + '倍以上', head: v => '×' + fmtN(v) },
    fixed:    { steps: [1000, 5000, 10000, 20000], chip: v => comma(v) + '〜', full: v => '固定ダメージ' + comma(v) + '以上', head: v => comma(v) },
    delay:    { steps: [1, 2, 3], chip: v => v + 'ターン〜', full: v => '行動を' + v + 'ターン以上遅らせる' },
    defDown:  { steps: [0.5, 0.75, 1], chip: v => pct(v) + '%〜', full: v => '防御' + pct(v) + '%ダウン以上' },
    buffMult: { steps: [1.2, 1.5, 2, 3], chip: v => fmtN(v) + '倍〜', full: v => '攻撃力アップ' + fmtN(v) + '倍以上', head: v => '×' + fmtN(v) },
    reduce:   { steps: [0.1, 0.25, 0.5, 0.75, 1], chip: v => pct(v) + '%〜', full: v => 'ダメージ軽減' + pct(v) + '%以上', head: v => pct(v) + '%' },
    recMult:  { steps: [1.5, 2, 3], chip: v => fmtN(v) + '倍〜', full: v => '回復力' + fmtN(v) + '倍以上' },
    heal:     { steps: [0.25, 0.5, 1], chip: v => v >= 1 ? '全回復' : pct(v) + '%〜', full: v => v >= 1 ? 'HP全回復' : 'HP回復' + pct(v) + '%以上', head: v => pct(v) + '%' },
    moveSec:  { steps: [1, 2, 3], chip: v => '+' + v + '秒〜', full: v => '操作時間+' + v + '秒以上' },
    moveMult: { steps: [1.5, 2], chip: v => fmtN(v) + '倍〜', full: v => '操作時間' + fmtN(v) + '倍以上' },
    stop:     { steps: [5, 8, 10], chip: v => v + '秒〜', full: v => '時間停止' + v + '秒以上' },
    turns:    { steps: [2, 3, 5, 8], chip: v => v + 'ターン〜', full: v => v + 'ターン以上続く' },
    lineN:    { steps: [2, 3], chip: v => v + '列〜', full: v => v + '列以上を変える' },
    genN:     { steps: [3, 4, 6, 9], chip: v => v + '個〜', full: v => 'ランダム生成 合計' + v + '個以上' }
  };

  // ============================================================
  // ① スキル → タグ
  // ============================================================
  const CACHE = new WeakMap();

  // ドロップの色を配列にする（orbChangeMulti / orbLock などの orb_fire: true… と orbs: [...] の両方に対応）
  function orbKinds(e) {
    if (Array.isArray(e.orbs)) return e.orbs.map(normAttr).filter(k => ATTR_ORDER.includes(k));
    return ATTR_ORDER.filter(k => e['orb_' + k]);
  }

  function analyze(sk) {
    if (!sk || typeof sk !== 'object') return null;
    const hit = CACHE.get(sk);
    if (hit) return hit;

    const T = new Set();
    const N = {};            // 数字（いちばん大きいもの）
    const pairs = [];        // 色の変換 [変換元, 変換先]（orbConvert 1つにつき1組）
    let genSum = 0, lineSum = 0;
    const add = t => { T.add(t); };
    const mx = (k, v) => { v = Number(v); if (isFinite(v) && (N[k] === undefined || v > N[k])) N[k] = v; };
    const effs = (Array.isArray(sk.effects) ? sk.effects : []).filter(Boolean);
    const desc = String(sk.desc || '');
    const turnsOf = e => Math.max(1, Math.floor(Number(e.turns) || 1));
    const sideOf = e => add(e.target === 'single' ? 'dt:single' : 'dt:all');
    const attrOf = a => normAttr(a || 'fire');   // 色の指定がないときはゲームと同じく火

    // ── 使用条件（skill.condition。種類は js/skill-text.js の冒頭を参照）──
    const c = sk.condition;
    if (c && c.type) {
      const v = Math.max(0, Math.floor(Number(c.value) || 0));
      add('u:any');
      switch (c.type) {
        case 'orbCount':     add('u:orbCount'); add('uo:' + attrOf(c.attr)); add('un.oc:' + (v || 1)); break;
        case 'hpBelow':      add('u:hpBelow'); add('un.hp:' + (v || 1)); break;
        case 'battleBefore': add('u:battleBefore'); add('un.bb:' + (v || 1)); break;
        case 'battleAfter':  add('u:battleAfter'); add('un.ba:' + (v || 1)); break;
        case 'orbBoost':     add('u:orbBoost'); add('ub:' + attrOf(c.attr)); break;
        default:             add('u:other'); break;
      }
    } else add('u:none');

    // ── 必要SP ──
    const sp = Number(sk.sp);
    if (isFinite(sp) && sp >= 1) mx('sp', Math.floor(sp));

    // ── 効果 ──　★新しい効果の種類はここに足す★
    for (const e of effs) {
      const v = Number(e.value);
      switch (e.type) {
        // ダメージ
        case 'damageAll': case 'damageSingle':
          add('e:dmgFix'); add((e.type === 'damageSingle' || e.target === 'single') ? 'dt:single' : 'dt:all'); mx('fixed', v); break;
        case 'damageSelfAtkMult': case 'damageAttrAtkMult': case 'damagePartyAtkMult': {
          add('e:dmgAtk'); sideOf(e);
          const a = normAttr(e.attr);
          add('da:' + (['fire', 'water', 'wood', 'light', 'dark'].includes(a) ? a : 'none'));   // 属性の指定なし・毒などは「無属性」
          mx('atkMult', v); break;
        }
        case 'damageHalfHp': add('e:dmgHalf'); break;
        case 'allAttackBuff': add('e:allAtk'); mx('turns', turnsOf(e)); break;
        // 強化・回復
        case 'atkBuff':
          if (v > 1) {
            add('e:atkUp');
            add(e.monType ? 'bt:' + e.monType : (e.attr ? 'bt:' + normAttr(e.attr) : 'bt:all'));
            mx('buffMult', v); mx('turns', turnsOf(e));
          } else if (v < 1) add('e:atkDown');   // 「攻撃が激減」など（デメリット）
          break;
        case 'selfAtkBuff':
          if (v > 1) { add('e:atkUp'); add('bt:self'); mx('buffMult', v); mx('turns', turnsOf(e)); }
          else if (v < 1) add('e:atkDown');
          break;
        case 'dmgReductionBuff': add('e:reduce'); mx('reduce', clamp01(v > 1 ? v / 100 : v)); mx('turns', turnsOf(e)); break;
        case 'recMult':
          if (v > 1) { add('e:recUp'); mx('recMult', v); mx('turns', turnsOf(e)); }
          else if (v < 1) add('e:recDown');
          break;
        case 'heal': add('e:heal'); mx('heal', clamp01(v)); break;
        case 'bindRecover': add('e:bind'); break;
        case 'moveTimeBuff': {
          const mult = (e.mult !== undefined && e.mult !== '' && Number(e.mult) >= 0) ? Number(e.mult) : 1;
          const sec = Number(e.seconds) || 0;
          if (mult > 1 || sec > 0) { add('e:time'); mx('moveSec', Math.max(0, sec)); mx('moveMult', mult); mx('turns', turnsOf(e)); }
          if (mult < 1 || sec < 0) add('e:timeDown');
          break;
        }
        case 'timeStop': add('e:stop'); mx('stop', Number(e.seconds) > 0 ? Number(e.seconds) : 5); break;   // 秒数の指定がなければ5秒（ゲームと同じ）
        case 'skillChargeOthers': add('e:sp'); break;
        // 敵への妨害
        case 'enemyDelay': add('e:delay'); sideOf(e); mx('delay', turnsOf(e)); break;
        case 'defenseDown': add('e:defDown'); sideOf(e); mx('defDown', clamp01(v > 1 ? v / 100 : v)); mx('turns', turnsOf(e)); break;
        // ドロップを変える
        case 'orbConvert': {
          const f = normAttr(e.from), t = normAttr(e.to);
          add('e:conv'); add('cvf:' + f); add('mk:' + t); pairs.push([f, t]); break;
        }
        case 'orbChangeLine': case 'orbChangeRow': {
          add('e:line'); add('ln:' + (e.type === 'orbChangeRow' ? 'row' : (e.dir === 'col' ? 'col' : 'row')));
          add('mk:' + attrOf(e.attr));
          lineSum += e.type === 'orbChangeRow' ? 1 : Math.max(1, Math.floor(Number(e.count) || 1)); break;
        }
        case 'orbChangeCross':     add('e:shape'); add('sh:cross'); add('mk:' + attrOf(e.attr)); break;
        case 'orbChangeReverseL':  add('e:shape'); add('sh:l'); add('mk:' + attrOf(e.attr)); break;
        case 'orbChangeRandom': {
          const n = Math.max(1, Math.floor(Number(e.count) || 1));
          if (n >= 30) add('e:all'); else { add('e:rand'); genSum += n; }   // 30個以上＝盤面ぜんぶ
          add('mk:' + attrOf(e.attr)); break;
        }
        case 'orbChangeAllRandom': add('e:all'); (Array.isArray(e.attrs) ? e.attrs : []).forEach(a => add('mk:' + normAttr(a))); break;
        case 'orbChangeMulti': {
          add('e:all'); const ks = orbKinds(e); (ks.length ? ks : ['fire']).forEach(k => add('mk:' + k)); break;
        }
        case 'orbChange5ColorHeal': add('e:all'); ['fire', 'water', 'wood', 'light', 'dark', 'heal'].forEach(k => add('mk:' + k)); break;
        case 'orbLock': case 'orbUnlock': {
          const g = e.type === 'orbLock' ? 'lk' : 'ul';
          add(e.type === 'orbLock' ? 'e:lock' : 'e:unlock');
          // ゲーム（lockSkillKinds）と同じ読み方：target が all なら全ドロップ。色の指定が空なら attrs は火、それ以外は全ドロップ
          let ks = e.target === 'all' ? null : orbKinds(e);
          if (ks && !ks.length) ks = e.target === 'attrs' ? ['fire'] : null;
          if (!ks) add(g + ':all'); else ks.forEach(k => add(g + ':' + k));
          break;
        }
        case 'orbSpawnBoost': add('e:fall'); add('fb:' + attrOf(e.attr)); mx('turns', turnsOf(e)); break;
        case 'orbSpawnBoost2': add('e:fall'); add('fb:' + attrOf(e.attr)); add('fb:' + attrOf(e.attr2)); mx('turns', turnsOf(e)); break;
        case 'noFallBuff': add('e:noFall'); mx('turns', turnsOf(e)); break;
        case 'roulette': add('e:roulette'); mx('turns', turnsOf(e)); break;
        // 自分
        case 'selfDamage': add('e:selfDmg'); break;
        case 'attrChange': add('e:attrCh'); mx('turns', turnsOf(e)); break;
        case 'transformRandom': add('e:trans'); break;
        case 'note': break;   // 演出だけ（ゲームには影響しない）
        default: add('e:other'); break;
      }
    }
    if (genSum) mx('genN', genSum);
    if (lineSum) mx('lineN', lineSum);

    // ── 説明文からも拾う（ロック／解除の色。効果は「全ドロップ」でも、説明に色が書いてあるものがある）──
    if (/ロックを解除/.test(desc)) {
      const re = /((?:火|水|木|光|闇|回復|毒|お邪魔)(?:[・と、](?:火|水|木|光|闇|回復|毒|お邪魔))*)(?:ドロップ)?の?ロックを解除/g;
      let m;
      while ((m = re.exec(desc))) (m[1].match(/火|水|木|光|闇|回復|毒|お邪魔/g) || []).forEach(a => add('ul:' + JP2ATTR[a]));
    }

    // 効果が何も拾えなかった（演出だけ／未対応）ときは「その他」
    if (![...T].some(t => t.startsWith('e:'))) add('e:other');

    const info = { tags: T, num: N, pairs, textN: norm((sk.name || '') + ' ' + desc) };
    CACHE.set(sk, info);
    return info;
  }
  const infoOf = mon => (mon && mon.skill) ? analyze(mon.skill) : null;

  // ============================================================
  // ② 状態と判定
  // ============================================================
  const groupOf = tag => tag.slice(0, tag.lastIndexOf(':'));
  // 「すべて／どれか」を切りかえられる項目（ここに入っている項目は、はじめは「すべて」）
  const AND_DEFAULT = ['e'];
  const newState = () => ({ q: '', on: new Set(), num: new Map(), and: new Set(AND_DEFAULT) });
  const count = st => st.on.size + st.num.size + (st.q ? 1 : 0);
  const isActive = st => count(st) > 0;
  function reset(st) { st.q = ''; st.on.clear(); st.num.clear(); st.and = new Set(AND_DEFAULT); }

  const passMetric = (k, v, info) => {
    const x = info.num[k];
    if (x === undefined) return false;
    return METRIC[k].dir === 'eq' ? Math.abs(x - v) < EPS : x >= v - EPS;
  };

  function match(st, info) {
    if (!isActive(st)) return true;
    if (!info) return false;
    if (st.on.size) {
      const need = {};
      st.on.forEach(t => { const g = groupOf(t); (need[g] = need[g] || []).push(t); });
      // 「変換元」を選んだときは、色の変換1つ1つについて「元の色→できる色」で判定する
      const byPair = !!need.cvf;
      for (const g in need) {
        if (byPair && (g === 'cvf' || g === 'mk')) continue;
        const ok = st.and.has(g) ? need[g].every(t => info.tags.has(t)) : need[g].some(t => info.tags.has(t));
        if (!ok) return false;
      }
      if (byPair) {
        const from = need.cvf.map(t => t.slice(4)), to = (need.mk || []).map(t => t.slice(3));
        const ps = info.pairs.filter(p => from.includes(p[0]) && (!to.length || to.includes(p[1])));
        if (!ps.length) return false;
        if (to.length && st.and.has('mk') && !to.every(t => ps.some(p => p[1] === t))) return false;
      }
    }
    for (const [k, v] of st.num) if (!passMetric(k, v, info)) return false;
    if (st.q) {
      const toks = norm(st.q).split(/\s+/).filter(Boolean);
      if (!toks.every(t => info.textN.includes(t))) return false;
    }
    return true;
  }

  // 一覧のカードの下に出す文字（絞り込み中だけ）。強さで絞っていればその数字、そうでなければ必要SP
  function headLabel(st, info) {
    if (!info) return '';
    for (const [k, v] of st.num) {
      const f = METRIC[k].head;
      if (f && info.num[k] !== undefined && k !== 'sp') return f(info.num[k]);
    }
    return info.num.sp ? 'SP' + info.num.sp : '';
  }

  // ============================================================
  // ③ シートに並べるボタン（データから自動で作る）
  // ============================================================
  let _cat = null, _catSize = -1;
  function catalog() {
    const data = (typeof MONSTER_DATA !== 'undefined') ? MONSTER_DATA : {};
    const size = Object.keys(data).length;
    if (_cat && _catSize === size) return _cat;

    const all = new Set(), maxN = {}, spVals = new Set();
    Object.values(data).forEach(m => {
      const i = infoOf(m);
      if (!i) return;
      i.tags.forEach(t => all.add(t));
      for (const k in i.num) if (maxN[k] === undefined || i.num[k] > maxN[k]) maxN[k] = i.num[k];
      if (i.num.sp) spVals.add(i.num.sp);
    });

    const labels = new Map();      // ボタンID → 画面の上の小さなタグに出す文字
    const secOf = new Map();       // ボタンID → セクションID（見出しに「選んだ数」を出すため）
    const metricSec = {};          // 数字の項目 → セクションID
    let curSec = '';
    const has = t => all.has(t);
    const chip = (id, label, o) => { const c = Object.assign({ id, label, full: label }, o || {}); labels.set(id, c.full); secOf.set(id, curSec); return c; };
    const T = (id, label, full, o) => has(id) ? chip(id, label, Object.assign({ full: full || label }, o || {})) : null;
    const nums = g => [...all].filter(t => t.startsWith(g + ':')).map(t => Number(t.slice(g.length + 1))).filter(n => !isNaN(n)).sort((a, b) => a - b);
    const numChips = (g, label, full) => nums(g).map(n => chip(g + ':' + n, label(n), { full: full(n) }));
    const orbChips = (g, full, list) => (list || ATTR_ORDER).filter(a => has(g + ':' + a)).map(a => chip(g + ':' + a, ATTR_JP[a], { full: full(ATTR_JP[a]), orb: a }));
    const metricChips = k => {
      const spec = METRIC[k];
      let steps;
      if (k === 'sp') steps = [...spVals].sort((a, b) => a - b);   // データにある必要SPを、ぜんぶボタンにする
      else steps = (maxN[k] === undefined) ? [] : spec.steps.filter(v => maxN[k] >= v - EPS);
      return steps.map(v => { metricSec[k] = curSec; return chip('m:' + k + ':' + v, spec.chip(v), { full: spec.full(v), metric: k, v }); });
    };
    const row = (label, chips, o) => Object.assign({ label, chips: (chips || []).filter(Boolean) }, o || {});
    const sections = [];
    const section = (id, title, build) => {
      curSec = id;
      const rows = build().filter(r => r.chips.length || r.modeOnly);
      if (rows.some(r => r.chips.length)) sections.push({ id, title, rows });
    };

    // ── 効果の種類 ──
    section('eff', '効果の種類', () => [
      row('複数えらんだとき', [], { mode: 'e', modeOnly: true }),
      row('ダメージ', [T('e:dmgFix', '固定ダメージ'), T('e:dmgAtk', '攻撃力×倍の攻撃', '攻撃力×倍の攻撃'), T('e:dmgHalf', '敵のHP半減')]),
      row('ドロップを変える', [T('e:conv', '色を変換', 'ドロップを別の色に変換'), T('e:line', '列を変える', '列をまるごと変える'), T('e:shape', '十字・L字で生成'), T('e:rand', 'ランダム生成'), T('e:all', '全ドロップ変化', '全ドロップを変化')]),
      row('ドロップのしかけ', [T('e:lock', 'ロック'), T('e:unlock', 'ロック解除'), T('e:fall', '落ちやすくする', 'ドロップが落ちやすくなる'), T('e:noFall', '落ちコンなし'), T('e:roulette', 'ルーレット')]),
      row('味方を強くする', [T('e:atkUp', '攻撃力アップ'), T('e:reduce', 'ダメージ軽減'), T('e:recUp', '回復力アップ'), T('e:heal', 'HP回復'), T('e:bind', 'バインド回復'), T('e:allAtk', '全体攻撃'), T('e:time', '操作時間アップ'), T('e:stop', '時間停止'), T('e:sp', 'SPを増やす')]),
      row('敵を弱らせる', [T('e:delay', '行動を遅らせる'), T('e:defDown', '防御ダウン', '敵の防御ダウン')]),
      row('そのほか', [T('e:attrCh', '属性が変わる', '自分の属性が変わる'), T('e:trans', 'へんしん'), T('e:other', 'その他')]),
      row('デメリット', [T('e:selfDmg', 'HPが減る', 'デメリット:HPが減る'), T('e:atkDown', '攻撃ダウン', 'デメリット:攻撃ダウン'), T('e:recDown', '回復力ダウン', 'デメリット:回復力ダウン'), T('e:timeDown', '操作時間ダウン', 'デメリット:操作時間ダウン')])
    ]);

    // ── 使用条件・必要SP ──
    section('use', '使用条件・必要SP', () => [
      row('必要SP', metricChips('sp')),
      row('', [T('u:none', '条件なし', '使用条件なし'), T('u:any', '条件つき', '使用条件つき')]),
      row('条件の種類', [T('u:orbCount', '盤面のドロップ数', '盤面のドロップ数が条件'), T('u:hpBelow', 'HP○%以下', 'HPが少ないと使える'), T('u:battleBefore', 'バトル○以前', 'バトル○以前だけ使える'), T('u:battleAfter', 'バトル○以降', 'バトル○以降だけ使える'), T('u:orbBoost', 'ドロップ目覚め中', 'ドロップ目覚め中だけ使える'), T('u:other', 'その他')]),
      row('盤面にドロップが ○個以上', numChips('un.oc', n => n + '個', n => '盤面に' + n + '個以上')),
      row('その色', orbChips('uo', a => '盤面の' + a + 'ドロップ')),
      row('HP ○%以下', numChips('un.hp', n => n + '%', n => 'HP' + n + '%以下')),
      row('バトル ○以前', numChips('un.bb', n => String(n), n => 'バトル' + n + '以前')),
      row('バトル ○以降', numChips('un.ba', n => String(n), n => 'バトル' + n + '以降')),
      row('目覚め中のドロップ', orbChips('ub', a => a + 'ドロップの目覚め中'))
    ]);

    // ── 敵への効果 ──
    section('foe', '敵への効果', () => [
      row('対象', [T('dt:all', '敵全体'), T('dt:single', '敵単体')]),
      row('攻撃の属性', orbChips('da', a => a + '属性の攻撃', ['fire', 'water', 'wood', 'light', 'dark', 'none'])),
      row('攻撃力の倍率 ○倍以上', metricChips('atkMult')),
      row('固定ダメージ ○以上', metricChips('fixed')),
      row('行動を遅らせる ○ターン以上', metricChips('delay')),
      row('防御ダウン ○%以上', metricChips('defDown'))
    ]);

    // ── ドロップ操作 ──
    section('orb', 'ドロップ操作', () => [
      row('作られるドロップの色', orbChips('mk', a => a + 'ドロップを作る'), { mode: 'mk' }),
      row('変換する前の色（色を変えるスキル）', orbChips('cvf', a => a + 'ドロップを変換')),
      row('生成する形', [T('sh:cross', '十字', '十字の形に生成'), T('sh:l', 'L字', 'L字の形に生成')]),
      row('変える列', [T('ln:row', '横列', '横の列を変える'), T('ln:col', '縦列', '縦の列を変える')].concat(metricChips('lineN'))),
      row('ランダム生成の合計', metricChips('genN')),
      row('ロックするドロップ', [T('lk:all', '全ドロップ', '全ドロップをロック')].concat(orbChips('lk', a => a + 'をロック'))),
      row('ロックを解除するドロップ', [T('ul:all', '全ドロップ', '全ドロップのロックを解除')].concat(orbChips('ul', a => a + 'のロックを解除'))),
      row('落ちやすくなる色', orbChips('fb', a => a + 'が落ちやすい'))
    ]);

    // ── 味方の強化・回復 ──
    const types = [...all].filter(t => t.startsWith('bt:')).map(t => t.slice(3)).filter(t => t !== 'all' && t !== 'self' && !ATTR_ORDER.includes(t));
    types.sort((a, b) => { const ia = TYPE_ORDER.indexOf(a), ib = TYPE_ORDER.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
    section('buff', '味方の強化・回復', () => [
      row('攻撃力アップの対象', [T('bt:all', '全属性', '全属性の攻撃力アップ')].concat(orbChips('bt', a => a + 'の攻撃力アップ', ['fire', 'water', 'wood', 'light', 'dark']), [T('bt:self', '自分だけ', '自分の攻撃力アップ')])),
      row('', types.map(t => chip('bt:' + t, t, { full: t + 'タイプの攻撃力アップ', icon: TYPE_ICON[t] }))),
      row('攻撃力アップの倍率 ○倍以上', metricChips('buffMult')),
      row('ダメージ軽減 ○%以上', metricChips('reduce')),
      row('回復力アップ ○倍以上', metricChips('recMult')),
      row('HP回復 ○%以上', metricChips('heal')),
      row('操作時間', metricChips('moveSec').concat(metricChips('moveMult'))),
      row('時間停止 ○秒以上', metricChips('stop')),
      row('効果が続くターン数 ○以上', metricChips('turns'))
    ]);

    _cat = { sections, labels, secOf, metricSec };
    _catSize = size;
    return _cat;
  }

  // ============================================================
  // ④ 画面（「スキル」タブの中身）
  // ============================================================
  const h = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const OPEN = new Set(['eff']);   // 開いているセクション（シートを閉じても、次に開いたとき同じ）

  // 画面の上に出る小さなタグ（× で1つずつ外せる）
  function tagList(st) {
    const lab = catalog().labels;
    const out = [];
    if (st.q) out.push({ text: '「' + st.q + '」', remove: () => { st.q = ''; } });
    st.on.forEach(id => out.push({ text: lab.get(id) || id, remove: () => { st.on.delete(id); } }));
    st.num.forEach((v, k) => out.push({ text: METRIC[k] ? METRIC[k].full(v) : k + v, remove: () => { st.num.delete(k); } }));
    return out;
  }

  // body に「スキル」タブのボタンを並べる。infos = この画面のモンスターのスキル情報（ボタンの数字を出す用）
  function buildView(body, st, infos, onChange) {
    const cat = catalog();
    const cnt = {};
    infos.forEach(i => i.tags.forEach(t => { cnt[t] = (cnt[t] || 0) + 1; }));
    const chipEls = [], secEls = [], modeEls = [];

    function mkChip(def) {
      const b = h('button', 'lss-chip');
      b.type = 'button';
      const src = (def.orb && ORB_IMG[def.orb]) || def.icon;
      if (src) { const im = h('img', 'lss-chip-ic'); im.alt = ''; im.draggable = false; im.src = src; im.onerror = () => im.remove(); b.appendChild(im); }
      b.appendChild(h('span', 'lss-chip-l', def.label));
      const c = h('small', 'lss-chip-n');
      b.appendChild(c);
      def.n = def.metric ? infos.filter(i => passMetric(def.metric, def.v, i)).length : (cnt[def.id] || 0);
      chipEls.push({ el: b, def, cEl: c });
      b.addEventListener('click', () => {
        if (def.metric) { if (st.num.get(def.metric) === def.v) st.num.delete(def.metric); else st.num.set(def.metric, def.v); }
        else if (st.on.has(def.id)) st.on.delete(def.id); else st.on.add(def.id);
        update(); onChange();
      });
      return b;
    }

    function mkMode(grp) {
      const w = h('span', 'lss-mode');
      w.setAttribute('role', 'group');
      const mk = (and, text) => {
        const b = h('button', 'lss-mode-b', text);
        b.type = 'button';
        b.addEventListener('click', () => { if (and) st.and.add(grp); else st.and.delete(grp); update(); onChange(); });
        w.appendChild(b);
        return b;
      };
      modeEls.push({ grp, bAnd: mk(true, 'すべて'), bOr: mk(false, 'どれか') });
      return w;
    }

    cat.sections.forEach(sec => {
      const s = h('section', 'lss-sec sk-sec');
      const t = h('button', 'lss-sec-t sk-sec-t');
      t.type = 'button';
      t.appendChild(h('span', 'sk-sec-tt', sec.title));
      const nb = h('b', 'sk-sec-n');
      t.appendChild(nb);
      t.appendChild(h('i', 'sk-sec-ch'));
      const bd = h('div', 'sk-sec-body');
      sec.rows.forEach(r => {
        const rw = h('div', 'lss-row');
        if (r.label || r.mode) {
          const hd = h('div', 'lss-row-h');
          if (r.label) hd.appendChild(h('div', 'lss-row-l', r.label));
          if (r.mode) hd.appendChild(mkMode(r.mode));
          rw.appendChild(hd);
        }
        if (r.chips.length) { const w = h('div', 'lss-chips'); r.chips.forEach(c => w.appendChild(mkChip(c))); rw.appendChild(w); }
        bd.appendChild(rw);
      });
      secEls.push({ sec, s, t, nb });
      const setOpen = on => { s.classList.toggle('open', on); t.setAttribute('aria-expanded', on ? 'true' : 'false'); };
      t.addEventListener('click', () => { const on = !s.classList.contains('open'); if (on) OPEN.add(sec.id); else OPEN.delete(sec.id); setOpen(on); });
      s.append(t, bd);
      body.appendChild(s);
      secEls[secEls.length - 1].setOpen = setOpen;
    });
    // 選んであるものがあるセクションは、はじめから開いておく
    const activeIn = id => [...st.on].some(x => cat.secOf.get(x) === id) || [...st.num.keys()].some(k => cat.metricSec[k] === id);
    secEls.forEach(x => x.setOpen(OPEN.has(x.sec.id) || activeIn(x.sec.id)));

    body.appendChild(h('p', 'lss-hint', '別の項目どうしは「全部」に当てはまるスキルが出ます。「効果の種類」と「作られるドロップの色」は、「すべて／どれか」で切りかえられます。ボタンの数字は、この画面のモンスターのうち当てはまる体数です。'));

    function update() {
      chipEls.forEach(({ el, def, cEl }) => {
        const on = def.metric ? st.num.get(def.metric) === def.v : st.on.has(def.id);
        el.classList.toggle('on', on);
        el.classList.toggle('zero', def.n === 0 && !on);
        el.setAttribute('aria-pressed', on ? 'true' : 'false');
        cEl.textContent = String(def.n);
      });
      secEls.forEach(({ sec, nb }) => {
        const n = [...st.on].filter(x => cat.secOf.get(x) === sec.id).length + [...st.num.keys()].filter(k => cat.metricSec[k] === sec.id).length;
        nb.textContent = n ? String(n) : '';
      });
      modeEls.forEach(({ grp, bAnd, bOr }) => {
        const and = st.and.has(grp);
        bAnd.classList.toggle('on', and); bOr.classList.toggle('on', !and);
        bAnd.setAttribute('aria-pressed', and ? 'true' : 'false'); bOr.setAttribute('aria-pressed', and ? 'false' : 'true');
      });
    }
    update();
    return { update };
  }

  global.SKSearch = {
    newState, isActive, count, reset, match, infoOf, headLabel, tagList, buildView,
    placeholder: 'キーワード（例: ロック　全体　回復）',
    // テスト・デバッグ用
    _analyze: analyze, _catalog: catalog, _METRIC: METRIC
  };
})(window);
