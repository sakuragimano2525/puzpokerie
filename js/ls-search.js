// ============================================================
// ★ リーダースキル検索（ボックス：編成 / 合成 / 進化 と、モンスター図鑑で共通）★
//
//   ・「リダスキ」ボタン → 下からシートが出る → ボタンをタップして絞り込む
//   ・絞り込み条件は 画面の上に「小さなタグ」で出る（× で1つずつ外せる / 「解除」で全部）
//
//   【しくみ】
//   各モンスターの leaderSkill（effects と desc の両方）を読み取って、「タグ」の集まりにする（analyze）。
//     例) 6コンボ以上で攻撃1.8倍  → eff:atk, cnd:combo, num:combo:6, tgt:all
//         HP25%以下で攻撃2.3倍    → eff:atk, cnd:hpBelow, num:hpb:25, tgt:all
//         十字消しをすると攻撃1.3倍 → eff:atk, cnd:cross, tgt:all
//   シートに並ぶボタンは、いまのモンスターデータから自動で作る（buildSections）。
//   → monsters.js にリーダースキルを足すと、新しい「コンボ数」「HP％」などのボタンも勝手に増える。
//   → モンスターエディターに新しい種類を足したときは、analyze() の cond() に1行足すだけ。
//
//   【絞り込みのルール】 同じ項目の中 = どれか1つに当てはまればOK（または）
//                         別の項目どうし = 全部に当てはまる（かつ）
//   例) 条件「十字消し」「L字消し」を両方ON → 十字 または L字
//       条件「十字消し」＋ 属性「水」をON    → 水属性が強化される十字消し
//
//   使い方（js/game.js / js/zukan.js から）:
//     const ls = LSSearch.mount({ key, host, before, after, candidates: () => [mon,...], onChange: () => 再描画 });
//     ls.match(mon) … 条件に合うか   ls.active() … 絞り込み中か   ls.reset() … 解除
//     ls.attachLabel(card, mon) … 絞り込み中、カードの下に倍率（×2 など）を出す
// ============================================================
(function (global) {
  'use strict';

  const ATTRS = ['fire', 'water', 'wood', 'light', 'dark'];
  const ATTR_JP = { fire: '火', water: '水', wood: '木', light: '光', dark: '闇', heal: '回復', poison: '毒', ojama: 'お邪魔' };
  const ATTR_IMG = { fire: '1.png', water: '2.png', wood: '3.png', light: '4.png', dark: '5.png' };
  const JP2ATTR = { '火': 'fire', '水': 'water', '木': 'wood', '光': 'light', '闇': 'dark', '回復': 'heal', '毒': 'poison', 'お邪魔': 'ojama' };
  const normAttr = a => JP2ATTR[a] || a;
  const TYPE_ORDER = ['バランス', 'こうげき', 'たいりょく', 'かいふく', '神秘'];
  const TYPE_ICON = { 'たいりょく': 'typ1.png', 'こうげき': 'typ2.png', 'かいふく': 'typ3.png', 'バランス': 'typ4.png', '神秘': 'typ5.png' };
  const pct = x => Math.round(Number(x) * 100);
  const fmtN = n => String(Math.round(n * 100) / 100);

  // ── 検索用の文字そろえ（全角半角・ひらがなカタカナの違いを無視） ──
  function norm(s) {
    s = String(s == null ? '' : s);
    try { s = s.normalize('NFKC'); } catch (e) {}
    return s.toLowerCase().replace(/[\u30a1-\u30f6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
  }

  // ============================================================
  // ① リーダースキル → タグ
  // ============================================================
  const CACHE = new WeakMap();

  function analyze(ls) {
    if (!ls || typeof ls !== 'object') return null;
    const hit = CACHE.get(ls);
    if (hit) return hit;

    const T = new Set();
    let maxMult = 0, maxReduce = 0;
    const add = t => { T.add(t); };
    const orb = a => { if (a) add('orb:' + normAttr(a)); };
    const effs = (Array.isArray(ls.effects) ? ls.effects : []).filter(Boolean);
    const desc = String(ls.desc || '');

    // 発動条件のタグ（条件があれば true）。★新しい条件の種類はここに足す★
    function cond(e) {
      const c = e.condition || '';
      const n = Number(e.count) || 0, th = Number(e.threshold) || 0;
      switch (c) {
        case '': case 'type': return false;
        case 'hpFull': add('cnd:hpFull'); break;
        case 'hpAbove': if (th >= 1) add('cnd:hpFull'); else { add('cnd:hpAbove'); add('num:hpa:' + pct(th)); } break;
        case 'hpBelow': add('cnd:hpBelow'); add('num:hpb:' + pct(th)); break;
        case 'combo': add('cnd:combo'); add('num:combo:' + n); break;
        case 'fireCombos': add('cnd:attrCombos'); add('num:acombo:' + n); orb('fire'); break;
        case 'darkCombos': add('cnd:attrCombos'); add('num:acombo:' + n); orb('dark'); break;
        case 'healCombos': add('cnd:attrCombos'); add('num:acombo:' + n); orb('heal'); break;
        case 'attrCombos': add('cnd:attrCombos'); add('num:acombo:' + n); orb(e.attr); break;
        case 'orbConnect': add('cnd:connect'); add('num:connect:' + n); orb(e.attr); if (e.attr2) { orb(e.attr2); add('cnd:dual'); } break;
        case 'waterDarkConnect': add('cnd:connect'); add('num:connect:5'); orb('water'); orb('dark'); add('cnd:dual'); break;
        case 'exactCount': add('cnd:exactCount'); add('num:exact:' + n); orb(e.attr); break;
        case 'exact4': add('cnd:exact4'); break;
        case 'eraseAttr': add('cnd:erase'); orb(e.attr); break;
        case 'eraseAny': add('cnd:erase'); break;
        case 'cross': add('cnd:cross'); orb(e.shapeAttr); break;
        case 'lShapes': add('cnd:lShapes'); orb(e.shapeAttr); break;
        case 'crossL': add('cnd:cross'); add('cnd:lShapes'); break;
        case 'fourColors': add('cnd:colors'); add('num:colors:4'); break;
        case 'colorCount': add('cnd:colors'); add('num:colors:' + (n || 4)); if (e.needHeal) orb('heal'); break;
        case 'colorCountHeal': add('cnd:colors'); add('num:colorsH:' + (n || 5)); break;
        case 'colorRamp': add('cnd:colors'); add(e.healCounts === false ? 'num:colors:' + (n || 3) : 'num:colorsH:' + (n || 3)); break;
        case 'remainingOrbs': add('cnd:remain'); add('num:remain:' + th); break;
        case 'skillUsed': add('cnd:skill'); break;
        case 'poison': add('cnd:poison'); orb('poison'); break;
        default: add('cnd:other'); break;
      }
      return true;
    }

    for (const e of effs) {
      const v = Number(e.value) || 0;
      switch (e.type) {
        case 'atk': case 'hp': case 'rec': case 'allStat': {
          const maxV = Number(e.maxValue) || 0;
          const boost = v > 1 || maxV > 1;
          const conditional = cond(e);
          if (boost) {
            maxMult = Math.max(maxMult, v, maxV);
            if (e.type === 'allStat') { add('eff:all'); add('eff:atk'); add('eff:hp'); add('eff:rec'); }
            else add('eff:' + e.type);
            if (e.condition === 'type') { add('tgt:t:' + e.attr); add('cnd:none'); }
            else if (!conditional) { add('cnd:none'); add(e.attr ? 'tgt:' + normAttr(e.attr) : 'tgt:all'); }
            else add('tgt:all');
          }
          if (e.type === 'atk' && Number(e.recValue) > 1) { add('eff:rec'); maxMult = Math.max(maxMult, Number(e.recValue)); }
          if (Number(e.reduce) > 0) { add('eff:reduce'); maxReduce = Math.max(maxReduce, Number(e.reduce)); }
          if (Number(e.comboAdd) > 0) add('ext:comboAdd');
          if (e.exponential) add('ext:exp');
          break;
        }
        case 'dmgReduction': cond(e); add('eff:reduce'); maxReduce = Math.max(maxReduce, v); break;
        case 'hpRecovery': add('eff:heal'); add('cnd:none'); break;
        case 'noDrop': add('ext:noDrop'); break;
        case 'moveTimeFixed': case 'moveTimeAdd': add('ext:time'); break;
        case 'poisonImmune': add('ext:poisonImm'); break;
        default: add('eff:other'); break;
      }
    }

    // 説明文からも拾う（effects に書かれていない条件があっても見つけられるように）
    if (/十字/.test(desc)) add('cnd:cross');
    if (/L字/.test(desc)) add('cnd:lShapes');
    if (/ドロップをちょうど4個消|ちょうど4個消しで/.test(desc)) add('cnd:exact4');
    if (/消す度に/.test(desc) && !/ちょうど4個消す度に/.test(desc)) add('cnd:erase');
    if (/スキル使用時/.test(desc)) add('cnd:skill');
    if (/HP満タン/.test(desc)) add('cnd:hpFull');
    let m, re;
    re = /HP(\d+)%以下/g;  while ((m = re.exec(desc))) { add('cnd:hpBelow'); add('num:hpb:' + m[1]); }
    re = /HP(\d+)%以上/g;  while ((m = re.exec(desc))) { if (+m[1] >= 100) add('cnd:hpFull'); else { add('cnd:hpAbove'); add('num:hpa:' + m[1]); } }
    re = /(\d+)コンボ以上/g;
    while ((m = re.exec(desc))) {
      if (desc.slice(Math.max(0, m.index - 5), m.index) === 'ドロップの') continue;   // 「闇ドロップの2コンボ以上」は属性コンボ
      add('cnd:combo'); add('num:combo:' + m[1]);
    }
    re = /(\d)色(?:以上)?同時/g; while ((m = re.exec(desc))) { add('cnd:colors'); add('num:colors:' + m[1]); }
    re = /残りドロップ(\d+)個以下/g; while ((m = re.exec(desc))) { add('cnd:remain'); add('num:remain:' + m[1]); }
    if (/落ちコンなし/.test(desc)) add('ext:noDrop');
    if (/操作時間/.test(desc)) add('ext:time');
    if (/毒ダメージを無効/.test(desc)) add('ext:poisonImm');
    if (/コンボ加算/.test(desc)) add('ext:comboAdd');
    if (/(?:消す|消し)度に/.test(desc)) add('ext:exp');
    if (/軽減/.test(desc)) {
      add('eff:reduce');
      re = /(\d+(?:\.\d+)?)%軽減/g; while ((m = re.exec(desc))) maxReduce = Math.max(maxReduce, +m[1] / 100);
    }
    if (/最大HPの\d+%回復/.test(desc)) add('eff:heal');

    if (!['eff:atk', 'eff:hp', 'eff:rec', 'eff:all', 'eff:reduce', 'eff:heal'].some(t => T.has(t))) add('eff:other');

    const info = { tags: T, maxMult, maxReduce, textN: norm((ls.name || '') + ' ' + desc) };
    CACHE.set(ls, info);
    return info;
  }
  const infoOf = mon => (mon && mon.leaderSkill) ? analyze(mon.leaderSkill) : null;

  // ============================================================
  // ② 状態と判定
  // ============================================================
  const groupOf = tag => { const g = tag.split(':')[0]; return g === 'num' ? 'cnd' : g; };
  const newState = () => ({ q: '', on: new Set(), minMult: 0, minReduce: 0 });
  const isActive = st => !!(st.q || st.on.size || st.minMult || st.minReduce);

  function matchInfo(st, info) {
    if (!isActive(st)) return true;
    if (!info) return false;
    if (st.on.size) {
      const need = {};
      st.on.forEach(t => { const g = groupOf(t); (need[g] = need[g] || []).push(t); });
      for (const g in need) if (!need[g].some(t => info.tags.has(t))) return false;
    }
    if (st.minMult && !(info.maxMult >= st.minMult - 1e-9)) return false;
    if (st.minReduce && !(info.maxReduce >= st.minReduce - 1e-9)) return false;
    if (st.q) {
      const toks = norm(st.q).split(/\s+/).filter(Boolean);
      if (!toks.every(t => info.textN.includes(t))) return false;
    }
    return true;
  }

  // ============================================================
  // ③ シートに並べるボタン（データから自動で作る）
  // ============================================================
  let _cat = null, _catSize = -1;
  function catalog() {
    const data = (typeof MONSTER_DATA !== 'undefined') ? MONSTER_DATA : {};
    const size = Object.keys(data).length;
    if (_cat && _catSize === size) return _cat;
    const all = new Set();
    let mults = new Set(), reds = new Set();
    Object.values(data).forEach(m => {
      const i = infoOf(m);
      if (!i) return;
      i.tags.forEach(t => all.add(t));
      if (i.maxMult > 1) mults.add(i.maxMult);
      if (i.maxReduce > 0) reds.add(i.maxReduce);
    });
    const labels = new Map();
    const has = t => all.has(t);
    const nums = prefix => [...all].filter(t => t.startsWith('num:' + prefix + ':')).map(t => Number(t.slice(prefix.length + 5))).filter(n => !isNaN(n)).sort((a, b) => a - b);
    const chip = (id, label, o) => { const c = Object.assign({ id, label, full: label }, o || {}); labels.set(id, c.full); return c; };

    // 数字つきの行：先頭に「すべて」（= 親のタグ）、そのあとに数字
    function numRow(parent, rowLabel, prefix, mk, o) {
      o = o || {};
      const ns = nums(prefix);
      const kids = ns.map(n => { const c = chip('num:' + prefix + ':' + n, mk(n).short, { full: mk(n).full, parent }); return c; });
      return { parent, rowLabel, ns, kids };
    }

    const sections = [];

    // ── 発動条件 ──
    const cndRows = [];
    const basic = [];
    const addBasic = (id, label, full) => { if (has(id)) basic.push(chip(id, label, { full: full || label })); };
    addBasic('cnd:none', '常時発動', '常時発動（条件なし）');
    addBasic('cnd:skill', 'スキル使用時');
    addBasic('cnd:poison', '毒を消すと', '毒を消すと');
    addBasic('cnd:cross', '十字消し');
    addBasic('cnd:lShapes', 'L字消し');
    addBasic('cnd:exact4', 'ちょうど4個消し');
    addBasic('cnd:erase', '消す度に', 'ドロップを消す度に');
    addBasic('cnd:dual', '2属性つなげ', '2属性を同時につなげる');
    const numbered = [];
    // コンボ
    { const r = numRow('cnd:combo', '○コンボ以上 で発動', 'combo', n => ({ short: n + '', full: n + 'コンボ以上' })); if (has('cnd:combo')) numbered.push(r); }
    { const r = numRow('cnd:attrCombos', '属性ドロップの ○コンボ以上', 'acombo', n => ({ short: n + '', full: n + 'コンボ以上(属性)' })); if (has('cnd:attrCombos')) { if (r.ns.length >= 2) numbered.push(r); else basic.push(chip('cnd:attrCombos', '属性コンボ', { full: '属性ドロップのコンボ' })); } }
    // HP
    const hpRows = [];
    {
      const above = nums('hpa'), below = nums('hpb');
      const row1 = [];
      if (has('cnd:hpFull')) row1.push(chip('cnd:hpFull', '満タン', { full: 'HP満タン' }));
      if (has('cnd:hpAbove')) { const p = chip('cnd:hpAbove', 'すべて', { full: 'HP○%以上(すべて)' }); p.kids = above.map(n => 'num:hpa:' + n); row1.push(p); above.forEach(n => row1.push(chip('num:hpa:' + n, n + '%', { full: 'HP' + n + '%以上', parent: 'cnd:hpAbove' }))); }
      if (row1.length) hpRows.push({ rowLabel: 'HP満タン／HP ○%以上 で発動', chips: row1 });
      if (has('cnd:hpBelow')) { const p = chip('cnd:hpBelow', 'すべて', { full: 'HP○%以下(すべて)' }); p.kids = below.map(n => 'num:hpb:' + n); const row2 = [p]; below.forEach(n => row2.push(chip('num:hpb:' + n, n + '%', { full: 'HP' + n + '%以下', parent: 'cnd:hpBelow' }))); hpRows.push({ rowLabel: 'HP ○%以下 で発動', chips: row2 }); }
    }
    { const r = numRow('cnd:connect', '○個以上 つなげて消す', 'connect', n => ({ short: n + '個', full: n + '個以上つなげる' })); if (has('cnd:connect')) numbered.push(r); }
    { const r = numRow('cnd:exactCount', 'ちょうど○個 消す', 'exact', n => ({ short: n + '個', full: 'ちょうど' + n + '個消し' })); if (has('cnd:exactCount')) numbered.push(r); }
    // 色数（回復含むものは別の字で）
    if (has('cnd:colors')) {
      const r = numRow('cnd:colors', '○色以上 同時に消す', 'colors', n => ({ short: n + '色', full: n + '色以上同時' }));
      const rh = nums('colorsH').map(n => chip('num:colorsH:' + n, n + '色+回復', { full: n + '色(回復含む)以上同時', parent: 'cnd:colors' }));
      r.kids = r.kids.concat(rh);
      numbered.push(r);
    }
    { const r = numRow('cnd:remain', '残りドロップ ○個以下', 'remain', n => ({ short: n + '個以下', full: '残りドロップ' + n + '個以下' })); if (has('cnd:remain')) numbered.push(r); }
    // 並べる
    sections.push({ id: 'cnd', title: '発動条件', note: '', basic, hpRows, numbered });

    // 親の「すべて」ボタンの定義（numbered 用）
    const numberedChips = numbered.map(r => {
      const p = chip(r.parent, 'すべて', { full: ({ 'cnd:combo': '○コンボ以上(すべて)', 'cnd:attrCombos': '属性コンボ(すべて)', 'cnd:connect': '○個以上つなげる(すべて)', 'cnd:exactCount': 'ちょうど○個消し(すべて)', 'cnd:colors': '○色同時(すべて)', 'cnd:remain': '残りドロップ(すべて)' })[r.parent] || r.parent });
      p.kids = r.kids.map(k => k.id);
      return { rowLabel: r.rowLabel, chips: [p].concat(r.kids) };
    });
    sections[0].rows = [].concat(hpRows, numberedChips);

    // ── 効果 ──
    const eff = [];
    [['eff:atk', '攻撃'], ['eff:hp', 'HP'], ['eff:rec', '回復力'], ['eff:all', '全パラメータ'], ['eff:reduce', 'ダメージ軽減'], ['eff:heal', 'HP回復'], ['eff:other', 'その他']]
      .forEach(([id, l]) => { if (has(id)) eff.push(chip(id, l, { full: '効果:' + l })); });
    sections.push({ id: 'eff', title: '効果', chips: eff });

    // ── 強化される属性・タイプ ──
    const tgt = [];
    if (has('tgt:all')) tgt.push(chip('tgt:all', '全属性', { full: '全属性を強化' }));
    ATTRS.forEach(a => { if (has('tgt:' + a)) tgt.push(chip('tgt:' + a, ATTR_JP[a], { full: ATTR_JP[a] + '属性を強化', attr: a })); });
    const types = [...all].filter(t => t.startsWith('tgt:t:')).map(t => t.slice(6));
    types.sort((a, b) => { const ia = TYPE_ORDER.indexOf(a), ib = TYPE_ORDER.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
    const tgtTypes = types.map(t => chip('tgt:t:' + t, t, { full: t + 'タイプを強化', icon: TYPE_ICON[t] }));
    sections.push({ id: 'tgt', title: '強化される属性・タイプ', chips: tgt, chips2: tgtTypes });

    // ── ドロップの属性 ──
    const orbs = [];
    ['fire', 'water', 'wood', 'light', 'dark', 'heal', 'poison', 'ojama'].forEach(a => { if (has('orb:' + a)) orbs.push(chip('orb:' + a, ATTR_JP[a], { full: ATTR_JP[a] + 'ドロップが条件', attr: ATTR_IMG[a] ? a : '' })); });
    sections.push({ id: 'orb', title: '条件になるドロップの属性', chips: orbs });

    // ── 倍率 ──
    const mCh = [1.5, 1.8, 2, 2.5, 3, 4].filter(v => [...mults].some(x => x >= v - 1e-9));
    const rCh = [10, 20, 30].filter(v => [...reds].some(x => x >= v / 100 - 1e-9));
    sections.push({ id: 'val', title: '強さ', mults: mCh, reds: rCh });

    // ── 特徴 ──
    const ext = [];
    [['ext:exp', '〜する度に(累乗)'], ['ext:comboAdd', 'コンボ加算'], ['ext:noDrop', '落ちコンなし'], ['ext:time', '操作時間'], ['ext:poisonImm', '毒ダメージ無効']]
      .forEach(([id, l]) => { if (has(id)) ext.push(chip(id, l, { full: l })); });
    sections.push({ id: 'ext', title: 'おまけの特徴', chips: ext });

    _cat = { sections, labels };
    _catSize = size;
    return _cat;
  }

  // ============================================================
  // ④ 画面（ボタン / 絞り込みタグ / シート）
  // ============================================================
  const h = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  // 虫めがね＋リーダーの星（リダスキ検索のアイコン。編成・合成・進化・図鑑ぜんぶこれ）
  const FUNNEL = '<svg class="ic ic-ls" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="7.6"/><path d="M15.6 15.6 21.2 21.2" stroke-width="3.4"/><path d="M10.00 5.70 L11.06 8.54 L14.09 8.67 L11.71 10.56 L12.53 13.48 L10.00 11.80 L7.47 13.48 L8.29 10.56 L5.91 8.67 L8.94 8.54Z" fill="currentColor" stroke-width="1.2"/></svg>';

  function mount(opts) {
    const st = newState();
    const ctl = { state: st, host: opts.host, opts };

    // ボタン
    const btn = h('button', 'te-sort-btn btn btn-sm lss-btn');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'リーダースキルで絞り込む');
    btn.innerHTML = FUNNEL + '<span class="lss-btn-t">リダスキ</span><b class="lss-badge"></b>';
    if (opts.before && opts.before.parentNode) opts.before.parentNode.insertBefore(btn, opts.before);
    btn.addEventListener('click', () => openSheet(ctl));

    // 絞り込み中のタグ
    const bar = h('div', 'lss-summary');
    bar.hidden = true;
    if (opts.after && opts.after.parentNode) opts.after.parentNode.insertBefore(bar, opts.after.nextSibling);

    function refreshUI() {
      const n = st.on.size + (st.minMult ? 1 : 0) + (st.minReduce ? 1 : 0) + (st.q ? 1 : 0);
      btn.classList.toggle('on', n > 0);
      btn.querySelector('.lss-badge').textContent = n > 0 ? String(n) : '';
      bar.hidden = n === 0;
      bar.innerHTML = '';
      if (!n) return;
      const lab = catalog().labels;
      const tag = (text, onX) => {
        const t = h('button', 'lss-tag');
        t.type = 'button';
        t.append(document.createTextNode(text));
        t.append(h('span', 'lss-tag-x', '×'));
        t.addEventListener('click', () => { onX(); refreshUI(); if (opts.onChange) opts.onChange(); });
        bar.appendChild(t);
      };
      if (st.q) tag('「' + st.q + '」', () => { st.q = ''; });
      st.on.forEach(id => tag(lab.get(id) || id, () => st.on.delete(id)));
      if (st.minMult) tag('倍率' + fmtN(st.minMult) + '倍以上', () => { st.minMult = 0; });
      if (st.minReduce) tag('軽減' + pct(st.minReduce) + '%以上', () => { st.minReduce = 0; });
      const clr = h('button', 'lss-clear', '全部解除');
      clr.type = 'button';
      clr.addEventListener('click', () => { ctl.reset(); if (opts.onChange) opts.onChange(); });
      bar.appendChild(clr);
    }

    ctl.refreshUI = refreshUI;
    ctl.active = () => isActive(st);
    ctl.match = mon => matchInfo(st, infoOf(mon));
    ctl.reset = () => { st.q = ''; st.on.clear(); st.minMult = 0; st.minReduce = 0; refreshUI(); };
    ctl.attachLabel = (card, mon) => {
      if (!isActive(st)) return false;
      const i = infoOf(mon);
      if (!i) return false;
      const t = i.maxMult > 1 ? '×' + fmtN(i.maxMult) : (i.maxReduce > 0 ? '軽減' + pct(i.maxReduce) + '%' : '');
      if (!t) return false;
      const el = h('div', 'sort-val', t);
      const n = t.length;
      el.dataset.len = String(n <= 4 ? 4 : n <= 6 ? 6 : n <= 7 ? 7 : n <= 9 ? 9 : 10);
      card.appendChild(el);
      return true;
    };
    refreshUI();
    return ctl;
  }

  function closeSheet(host) { host.querySelectorAll(':scope > .lss-sheet').forEach(s => s.remove()); }

  function openSheet(ctl) {
    const host = ctl.host, st = ctl.state, opts = ctl.opts;
    closeSheet(host);
    const cat = catalog();
    const cands = (opts.candidates() || []).map(mon => infoOf(mon)).filter(Boolean);
    const cnt = {};
    cands.forEach(i => i.tags.forEach(t => { cnt[t] = (cnt[t] || 0) + 1; }));
    const chipEls = [];      // {el, def, kind}

    const sheet = h('div', 'lss-sheet');
    const card = h('div', 'lss-card');
    sheet.appendChild(card);

    // 見出し
    const head = h('div', 'lss-head');
    head.appendChild(h('div', 'lss-title', 'リーダースキル検索'));
    const rst = h('button', 'lss-reset', 'リセット');
    rst.type = 'button';
    head.appendChild(rst);
    card.appendChild(head);

    // キーワード
    const qw = h('div', 'lss-q');
    const qi = h('input');
    qi.type = 'text';
    qi.placeholder = 'キーワード（例: 十字　軽減　つなげ）';
    qi.value = st.q;
    qi.setAttribute('enterkeyhint', 'search');
    qi.autocomplete = 'off';
    const qx = h('button', 'lss-q-x', '×');
    qx.type = 'button';
    qw.append(qi, qx);
    card.appendChild(qw);

    const body = h('div', 'lss-body');
    card.appendChild(body);

    // ボタンを作る
    function mkChip(def, kind) {
      const b = h('button', 'lss-chip');
      b.type = 'button';
      b.dataset.tag = def.id || '';
      if (def.attr && ATTR_IMG[def.attr]) {
        const im = h('img', 'lss-chip-ic'); im.alt = ''; im.draggable = false; im.src = ATTR_IMG[def.attr];
        im.onerror = () => im.remove();
        b.appendChild(im);
      } else if (def.icon) {
        const im = h('img', 'lss-chip-ic'); im.alt = ''; im.draggable = false; im.src = def.icon;
        im.onerror = () => im.remove();
        b.appendChild(im);
      }
      b.appendChild(h('span', 'lss-chip-l', def.label));
      const c = h('small', 'lss-chip-n');
      b.appendChild(c);
      chipEls.push({ el: b, def, kind, cEl: c });
      b.addEventListener('click', () => {
        if (kind === 'mult') st.minMult = st.minMult === def.v ? 0 : def.v;
        else if (kind === 'red') st.minReduce = st.minReduce === def.v ? 0 : def.v;
        else {
          if (st.on.has(def.id)) st.on.delete(def.id);
          else {
            st.on.add(def.id);
            if (def.parent) st.on.delete(def.parent);                 // 数字を選んだら「すべて」は外す
            if (def.kids) def.kids.forEach(k => st.on.delete(k));     // 「すべて」を選んだら数字は外す
          }
        }
        update();
      });
      return b;
    }
    const section = (title) => { const s = h('section', 'lss-sec'); s.appendChild(h('div', 'lss-sec-t', title)); body.appendChild(s); return s; };
    const row = (parent, label, chips, kind) => {
      const r = h('div', 'lss-row');
      if (label) r.appendChild(h('div', 'lss-row-l', label));
      const w = h('div', 'lss-chips');
      chips.forEach(c => w.appendChild(mkChip(c, kind || 'tag')));
      r.appendChild(w);
      parent.appendChild(r);
    };

    cat.sections.forEach(sec => {
      if (sec.id === 'cnd') {
        const s = section('発動条件');
        if (sec.basic.length) row(s, '', sec.basic);
        sec.rows.forEach(r => row(s, r.rowLabel, r.chips));
      } else if (sec.id === 'val') {
        if (!sec.mults.length && !sec.reds.length) return;
        const s = section('強さ（○以上）');
        if (sec.mults.length) row(s, '倍率', sec.mults.map(v => ({ id: 'm' + v, v, label: fmtN(v) + '倍〜' })), 'mult');
        if (sec.reds.length) row(s, 'ダメージ軽減', sec.reds.map(v => ({ id: 'r' + v, v: v / 100, label: v + '%〜' })), 'red');
      } else {
        if (!sec.chips.length && !(sec.chips2 && sec.chips2.length)) return;
        const s = section(sec.title);
        if (sec.chips.length) row(s, sec.id === 'tgt' ? '属性' : '', sec.chips);
        if (sec.chips2 && sec.chips2.length) row(s, 'タイプ', sec.chips2);
      }
    });
    const hint = h('p', 'lss-hint', '同じ項目の中は「どれか」、別の項目どうしは「全部」に当てはまるモンスターが出ます。ボタンの数字は、この画面のモンスターのうち当てはまる体数です。');
    body.appendChild(hint);

    // 下：決定
    const foot = h('div', 'lss-foot');
    const go = h('button', 'btn btn-primary lss-go');
    go.type = 'button';
    foot.appendChild(go);
    card.appendChild(foot);

    function update() {
      const matched = cands.filter(i => matchInfo(st, i)).length;
      chipEls.forEach(({ el, def, kind, cEl }) => {
        let on, n;
        if (kind === 'mult') { on = st.minMult === def.v; n = cands.filter(i => i.maxMult >= def.v - 1e-9).length; }
        else if (kind === 'red') { on = st.minReduce === def.v; n = cands.filter(i => i.maxReduce >= def.v - 1e-9).length; }
        else { on = st.on.has(def.id); n = cnt[def.id] || 0; }
        el.classList.toggle('on', on);
        el.classList.toggle('zero', n === 0 && !on);
        el.setAttribute('aria-pressed', on ? 'true' : 'false');
        cEl.textContent = String(n);
      });
      qx.style.display = st.q ? '' : 'none';
      go.textContent = isActive(st) ? (matched ? `${matched}体を表示` : '該当なし（閉じる）') : '閉じる';
      go.classList.toggle('none', isActive(st) && !matched);
    }
    function close() {
      closeSheet(host);
      ctl.refreshUI();
      if (opts.onChange) opts.onChange();
    }
    qi.addEventListener('input', () => { st.q = qi.value.trim(); update(); });
    qi.addEventListener('keydown', e => { if (e.key === 'Enter') qi.blur(); });
    qx.addEventListener('click', () => { qi.value = ''; st.q = ''; update(); });
    rst.addEventListener('click', () => { st.q = ''; qi.value = ''; st.on.clear(); st.minMult = 0; st.minReduce = 0; update(); });
    go.addEventListener('click', close);
    sheet.addEventListener('click', e => { if (e.target === sheet) close(); });
    host.appendChild(sheet);
    update();
  }

  global.LSSearch = {
    mount,
    // テスト・デバッグ用
    _analyze: analyze, _catalog: catalog, _match: matchInfo, _newState: newState, _infoOf: infoOf
  };
})(window);
