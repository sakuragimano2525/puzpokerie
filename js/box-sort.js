// ============================================================
// ★ ボックスの並び替え（編成 / 合成 / 進化 で共通）★
//
//   ・並び替えの種類と、並べ替えの計算
//   ・「HP順」などのとき、カードの下に出す数値ラベルの文字
//   ・並び替えを選ぶシート（ボトムシート）
//
//   スキル順 / リダスキ順の並びは、monster-editor.html の
//   「登録済みスキルから選んで使い回す」「登録済みのリーダースキルから選ぶ」一覧と同じ並びです
//   （skillSortKey / leaderSortKey をそのまま移したもの）。
//   monster-editor.html 側の並びを変えたら、ここも同じに直してください。
// ============================================================
(function (global) {
  'use strict';

  const STORAGE_KEY = 'puzzdra_sort_v1';

  // ── 並び替えの種類 ─────────────────────────────────────────
  //   def : 最初の向き（1 = 小さい順 / あいうえお順、-1 = 大きい順）
  //   val : true なら、並べている間カードの下に数値/文字を出す
  const MODES = [
    { id: 'acq',    label: '入手順',       def:  1 },
    { id: 'id',     label: '図鑑番号順',   def:  1, val: true },   // 図鑑番号（モンスターID）順。同じモンスターは入手順
    { id: 'level',  label: 'レベル順',     def: -1 },
    { id: 'attr',   label: '属性順',       def:  1 },
    { id: 'name',   label: '名前順',       def:  1 },
    { id: 'hp',     label: 'HP順',         def: -1, val: true },
    { id: 'atk',    label: 'こうげき順',   def: -1, val: true },
    { id: 'rec',    label: 'かいふく順',   def: -1, val: true },
    { id: 'type',   label: 'タイプ順',     def:  1, val: true },
    { id: 'rarity', label: 'レア度順',     def: -1, val: true },
    { id: 'skill',  label: 'スキル順',     def:  1 },
    { id: 'leader', label: 'リダスキ順',   def:  1 },
    { id: 'exp',    label: '合計経験値順', def: -1, val: true, short: '経験値順' }   // 合成画面だけ（short = 狭いボタンに出す名前）
  ];
  const MODE_BY_ID = {};
  MODES.forEach(m => { MODE_BY_ID[m.id] = m; });

  // ── monster-editor.html と同じ並びのキー ─────────────────────
  const SORT_ATTR = ['fire', 'water', 'wood', 'light', 'dark', 'heal', 'poison', 'ojama'];
  const attrRankOf = a => {
    const i = SORT_ATTR.indexOf(({ '回復': 'heal', '火': 'fire', '水': 'water', '木': 'wood', '光': 'light', '闇': 'dark', '毒': 'poison', 'お邪魔': 'ojama' })[a] || a);
    return i < 0 ? 99 : i;
  };
  // リーダースキル：①火のソウル→火炎のソウル→水のソウル…（属性別の攻撃倍率）②タイプ・全属性の攻撃 ③HP(オーラ) ④回復力(ルーン) ⑤条件付き攻撃 ⑥その他
  const LS_COND_ORDER = ['hpAbove', 'hpBelow', 'hpFull', 'combo', 'attrCombos', 'orbConnect', 'exactCount', 'connectEach', 'exact4', 'eraseAttr', 'eraseAny', 'colorCount', 'colorCountHeal', 'colorRamp', 'cross', 'lShapes', 'poison', 'remainingOrbs', 'skillUsed'];
  function leaderSortKey(ls) {
    ls = ls || {};
    const effs = (ls.effects || []);
    const e = effs.find(x => x && ['atk', 'hp', 'rec'].includes(x.type)) || effs[0] || {};
    const _sa = e.attr || e.shapeAttr;
    const val = Number(e.value) || 0, cnt = Number(e.count !== undefined && e.count !== null ? e.count : e.threshold) || 0;
    let cat;
    if (e.type === 'atk' && !e.condition) { cat = e.attr ? 0 : 2; }
    else if (e.type === 'atk' && e.condition === 'type') { cat = 1; }
    else if (e.type === 'hp') { cat = (e.condition === 'type') ? 4 : (e.attr ? 3 : 5); }
    else if (e.type === 'rec') { cat = (e.condition === 'type') ? 7 : (e.attr ? 6 : 8); }
    else if (e.type === 'atk') { const i = LS_COND_ORDER.indexOf(e.condition); cat = 10 + (i < 0 ? LS_COND_ORDER.length : i); }
    else { cat = 50; }
    return [cat, effs.length > 1 ? 1 : 0, attrRankOf(_sa), cnt, val, String(ls.name || '')];
  }
  // スキル：ダメージ系→属性変換系→回復→バフ…の順に、属性（火水木光闇回復）→名前
  const SK_TYPE_ORDER = ['damageAll', 'damageSingle', 'damageSelfAtkMult', 'selfDamage', 'orbChangeLine', 'orbChangeRow', 'orbChangeCross', 'orbChangeReverseL', 'orbChangeRandom', 'orbChangeMulti', 'orbChange5ColorHeal', 'orbConvert', 'orbUnlock', 'orbLock', 'heal', 'atkBuff', 'allAttackBuff', 'dmgReductionBuff', 'enemyDelay', 'defenseDown', 'timeStop'];
  function skillSortKey(sk) {
    sk = sk || {};
    const e = (sk.effects || [])[0] || {};
    const i = SK_TYPE_ORDER.indexOf(e.type);
    const attr = e.attr || ((sk.effects || []).find(x => x && x.attr) || {}).attr;
    return [i < 0 ? SK_TYPE_ORDER.length : i, attrRankOf(attr), String(sk.name || '')];
  }
  function cmpKey(a, b) {
    for (let i = 0; i < a.length; i++) {
      if (typeof a[i] === 'string') { const c = a[i].localeCompare(b[i], 'ja'); if (c) return c; }
      else if (a[i] !== b[i]) return a[i] - b[i];
    }
    return 0;
  }

  // タイプの並び（monster-editor.html の DEFAULT_TYPES と同じ。ないタイプは最後）
  const TYPE_ORDER = ['バランス', 'こうげき', 'たいりょく', 'かいふく', 'バード', 'マター', '悪魔', '神秘'];
  const typeRank = t => { const i = TYPE_ORDER.indexOf(t); return i < 0 ? TYPE_ORDER.length : i; };

  // 同じモンスターのスキル・リーダースキルのキーは何度も作らない
  const _skCache = new Map(), _lsCache = new Map();
  function cachedKey(cache, mon, fn, field) {
    const k = mon.id;
    let v = cache.get(k);
    if (!v) { v = fn(mon[field]); cache.set(k, v); }
    return v;
  }

  // ── 並べ替え ───────────────────────────────────────────────
  //   ctx = {
  //     monsters : MONSTER_DATA
  //     stats    : entry => {hp, atk, rec}      （省略時は calcMonsterStats）
  //     expOf    : entry => 数値                （合計経験値順のときだけ必要）
  //     teamUids : [uid...]                     （渡すと、そのモンスターを先頭グループにする）
  //   }
  function statsOf(ctx, entry) {
    const f = ctx.stats || global.calcMonsterStats;
    return f ? f(entry) : { hp: 0, atk: 0, rec: 0 };
  }
  function keyOf(id, e, mon, ctx) {
    switch (id) {
      case 'id':     return [Number(mon.id) || Number(e.monsterId) || 0];
      case 'level':  return [e.level];
      case 'attr':   return [attrRankOf(mon.attr)];
      case 'name':   return [String(mon.name || '')];
      case 'hp':     return [statsOf(ctx, e).hp];
      case 'atk':    return [statsOf(ctx, e).atk];
      case 'rec':    return [statsOf(ctx, e).rec];
      case 'type':   return [typeRank(mon.type), String(mon.type || '')];
      case 'rarity': return [Number(mon.rarity) || 0];
      case 'skill':  return cachedKey(_skCache, mon, skillSortKey, 'skill');
      case 'leader': return cachedKey(_lsCache, mon, leaderSortKey, 'leaderSkill');
      case 'exp':    return [ctx.expOf ? ctx.expOf(e) : 0];
      default:       return [e.uid];   // 入手順
    }
  }
  // 種類・レア度・スキル・リダスキは同点が多いので、同点は 属性 → モンスター番号 → uid の順
  const GROUPED = { type: 1, rarity: 1, skill: 1, leader: 1 };

  function sortList(list, state, ctx) {
    ctx = ctx || {};
    const monsters = ctx.monsters || global.MONSTER_DATA || {};
    const mode = MODE_BY_ID[state.mode] || MODE_BY_ID.acq;
    const mul = mode.def * (state.rev ? -1 : 1);
    const team = new Set((ctx.teamUids || []).filter(u => u !== null && u !== undefined));
    const rows = [];
    list.forEach(e => {
      const mon = monsters[e.monsterId];
      if (!mon) return;
      rows.push({ e, mon, team: team.has(e.uid), k: keyOf(mode.id, e, mon, ctx) });
    });
    rows.sort((a, b) => {
      if (a.team !== b.team) return a.team ? -1 : 1;   // チームのモンスターが先頭（向きを逆にしても先頭）
      const c = cmpKey(a.k, b.k) * mul;
      if (c) return c;
      if (GROUPED[mode.id]) {
        const d = (attrRankOf(a.mon.attr) - attrRankOf(b.mon.attr)) || (a.e.monsterId - b.e.monsterId);
        if (d) return d;
      }
      return a.e.uid - b.e.uid;
    });
    return rows.map(r => r.e);
  }

  // ── カードの下に出す数値 ───────────────────────────────────────
  const fmtNum = n => (Number(n) || 0).toLocaleString('en-US');
  // 出さない並びのときは null
  function valueText(id, entry, ctx) {
    ctx = ctx || {};
    const monsters = ctx.monsters || global.MONSTER_DATA || {};
    const mon = monsters[entry.monsterId];
    if (!mon) return null;
    switch (id) {
      case 'hp': case 'atk': case 'rec': return fmtNum(statsOf(ctx, entry)[id]);
      case 'type':   return mon.type || '---';
      case 'rarity': return '★' + (Number(mon.rarity) || 0);
      case 'id':     return 'No.' + (Number(mon.id) || Number(entry.monsterId) || 0);
      case 'exp':    return '+' + fmtNum(ctx.expOf ? ctx.expOf(entry) : 0);
    }
    return null;
  }
  // 長さに応じて文字を小さくする（6桁・7桁が並んでも枠から出ない）。CSS の .sort-val[data-len] と対応
  function lenBucket(text) {
    const n = String(text).length;
    return n <= 4 ? 4 : n <= 6 ? 6 : n <= 7 ? 7 : n <= 9 ? 9 : 10;
  }
  // カードに数値ラベルを付ける。付けたら true
  function attachValue(card, id, entry, ctx) {
    const t = valueText(id, entry, ctx);
    if (t === null) return false;
    const el = document.createElement('div');
    el.className = 'sort-val';
    el.dataset.len = String(lenBucket(t));
    el.textContent = t;
    card.appendChild(el);
    return true;
  }
  function hasValue(id) { return !!(MODE_BY_ID[id] && MODE_BY_ID[id].val); }

  // ── 状態（種類 + 向き）。画面ごとに持って、端末に覚えさせる ───────────
  function loadAll() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  //   opts（省略可）: { labels: { acq: 'ID順' }（項目の表示名を画面ごとに差し替え）, note: '並び替えシートの下に出す一文' }
  //   ※ モンスター図鑑（js/zukan.js）が「入手順」を「ID順」として使うために追加
  function makeState(key, allowed, teamFirst, opts) {
    const s = { mode: 'acq', rev: false, key, allowed: allowed || MODES.map(m => m.id), teamFirst: !!teamFirst,
                labels: (opts && opts.labels) || null, note: (opts && opts.note) || '' };
    const saved = loadAll()[key];
    if (saved && s.allowed.includes(saved.mode)) { s.mode = saved.mode; s.rev = !!saved.rev; }
    return s;
  }
  function saveState(state) {
    try {
      const all = loadAll();
      all[state.key] = { mode: state.mode, rev: !!state.rev };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch (e) {}
  }
  // 実際に並ぶ向き（1 = 小さい順 / -1 = 大きい順）
  const effDir = state => (MODE_BY_ID[state.mode] || MODE_BY_ID.acq).def * (state.rev ? -1 : 1);
  // 同じ種類をもう一度選んだら向きを逆にする
  function pick(state, id) {
    if (state.mode === id) state.rev = !state.rev;
    else { state.mode = id; state.rev = false; }
    saveState(state);
  }
  // ボタンに出す文字（向きを逆にしているときだけ矢印）
  function labelOf(state, m) { return (state.labels && state.labels[m.id]) || m.label; }
  function buttonLabel(state) {
    const m = MODE_BY_ID[state.mode] || MODE_BY_ID.acq;
    return ((state.labels && state.labels[m.id]) || m.short || m.label) + (state.rev ? (effDir(state) < 0 ? '↓' : '↑') : '');
  }

  // ── 並び替えシート ──────────────────────────────────────────
  //   host  : シートを重ねる画面の要素（.ui-screen）
  //   onPick: 選んだあとに呼ばれる（state は更新済み）
  function openSheet(host, state, onPick) {
    closeSheet(host);
    const sheet = document.createElement('div');
    sheet.className = 'sort-sheet';
    const card = document.createElement('div');
    card.className = 'sort-card';
    const title = document.createElement('div');
    title.className = 'sort-title';
    title.textContent = '並び替え';
    card.appendChild(title);
    const grid = document.createElement('div');
    grid.className = 'sort-grid';
    MODES.filter(m => state.allowed.includes(m.id)).forEach(m => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sort-chip';
      b.dataset.mode = m.id;
      const active = state.mode === m.id;
      if (active) b.classList.add('active');
      const lb = document.createElement('span');
      lb.className = 'sort-chip-label';
      lb.textContent = labelOf(state, m);
      b.appendChild(lb);
      if (active) {
        const ar = document.createElement('span');
        ar.className = 'sort-chip-dir';
        ar.textContent = effDir(state) < 0 ? '▼' : '▲';
        b.appendChild(ar);
      }
      b.addEventListener('click', () => {
        pick(state, m.id);
        closeSheet(host);
        if (onPick) onPick(m.id);
      });
      grid.appendChild(b);
    });
    card.appendChild(grid);
    const hint = document.createElement('p');
    hint.className = 'sort-hint';
    hint.textContent = '同じ項目をもう一度タップすると、並ぶ向きが逆になります（▼ 大きい順 / ▲ 小さい順）。'
      + (state.teamFirst ? '編成中のモンスターは、どの並びでも先頭です。' : '')
      + (state.note ? state.note : '');
    card.appendChild(hint);
    sheet.appendChild(card);
    sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(host); });
    host.appendChild(sheet);
  }
  function closeSheet(host) {
    host.querySelectorAll(':scope > .sort-sheet').forEach(s => s.remove());
  }

  global.BoxSort = {
    MODES, MODE_BY_ID,
    makeState, saveState, pick, effDir, buttonLabel,
    sort: sortList, valueText, attachValue, hasValue,
    openSheet, closeSheet,
    // テスト用
    _skillSortKey: skillSortKey, _leaderSortKey: leaderSortKey, _cmpKey: cmpKey
  };
})(window);
