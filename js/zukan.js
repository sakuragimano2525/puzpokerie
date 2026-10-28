// ============================================================
// ★ モンスター図鑑 ★
//
//   ホームの図鑑ボタン（本のアイコン）から開く。
//
//   ・MONSTER_DATA にいるモンスターを、ID順に 横6匹 で並べる（縦はいくらでも。モンスターを追加すると自動で増える）
//   ・表示は3種類
//       ゲット済み   … m{id}.png をそのまま表示（いちどでも手に入れたら登録。合成で消えても残る）
//       見たことあり … ダンジョンで出会っただけ。m{id}.png を灰色で表示
//       まだ見ていない … ？ マーク（絵は読み込まない）
//   ・ゲット済み／見たことあり を長押しすると、Lv1 と 最大Lv（ふつうは Lv99）のステータスが見られる
//       画面の真ん中に出て、左右のボタン（スワイプ・矢印キーも可）で、いまの並び順のまま前後のモンスターへ移れる
//   ・モンスターを長押し → ステータス（スキル・リーダースキル・入手場所）
//   ・並び替えは編成画面などと同じ（js/box-sort.js）。いちばん上は 図鑑番号順（最初はこれ）
//       HP・こうげき・かいふく は、最大Lvのときの数値で並ぶ。
//       図鑑番号順以外では、まだ見ていないモンスターはいちばん最後にまとまる（並びから正体が分からないように）。
//
//   記録は localStorage の 'puzzdra_zukan_v1' に保存（seen = 出会った/持った番号, owned = ゲットした番号）。
//   ・出会いの記録 … game.js の loadBattle() が Zukan.noteEnemies() を呼ぶ（敵の画像 mp{id}.png の番号 = 図鑑の番号）
//   ・ゲットの記録 … game.js の saveGame() が Zukan.syncOwned() を呼ぶ（BOX に入った時点で必ず saveGame が走る）
//   ・図鑑をリセットしたいときは、localStorage の 'puzzdra_zukan_v1' を消す（次の起動でBOXとクリア済みダンジョンから作り直し）
// ============================================================
(function (global) {
  'use strict';

  const KEY = 'puzzdra_zukan_v1';
  const LONGPRESS_MS = 250;      // 長押しと判定する時間
  const MOVE_CANCEL_PX = 10;     // これ以上指が動いたらスクロールとみなして長押しをやめる
  const $ = id => document.getElementById(id);

  // ── 記録 ───────────────────────────────────────────────────
  const seen = new Set();    // 出会った or 持った（owned も含む）
  const owned = new Set();   // いちどでも手に入れた
  let hadSaved = false;

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (d && typeof d === 'object') {
        hadSaved = true;
        (Array.isArray(d.seen) ? d.seen : []).forEach(n => { n = Number(n); if (n > 0) seen.add(n); });
        (Array.isArray(d.owned) ? d.owned : []).forEach(n => { n = Number(n); if (n > 0) { owned.add(n); seen.add(n); } });
      }
    } catch (e) {}
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ v: 1, seen: [...seen], owned: [...owned] })); } catch (e) {}
  }
  const known = id => !!(typeof MONSTER_DATA !== 'undefined' && MONSTER_DATA[id]);
  // 0 = まだ見ていない / 1 = 見たことあり（灰色）/ 2 = ゲット済み
  const statusOf = id => owned.has(id) ? 2 : seen.has(id) ? 1 : 0;

  // 敵に出会った（図鑑の番号 = 敵画像 mp{id}.png の番号）
  function noteSeenId(id) {
    id = Number(id);
    if (!(id > 0) || !known(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  }
  function noteEnemy(e) {
    const m = e && typeof e.img === 'string' ? e.img.match(/mp(\d+)\.png$/) : null;
    return m ? noteSeenId(m[1]) : false;
  }
  function noteEnemies(list) {
    let changed = false;
    (list || []).forEach(e => { if (noteEnemy(e)) changed = true; });
    if (changed) save();
  }

  // BOX にいるモンスターを「ゲット済み」に登録（スキルで変身中の見た目ではなく、元のモンスターで数える）
  function syncOwned() {
    if (typeof box === 'undefined' || !Array.isArray(box)) return false;
    let changed = false;
    for (const b of box) {
      if (!b) continue;
      const id = Number(b._tfFrom !== undefined ? b._tfFrom : b.monsterId);
      if (!known(id)) continue;
      if (!owned.has(id)) { owned.add(id); changed = true; }
      if (!seen.has(id)) { seen.add(id); changed = true; }
    }
    if (changed) save();
    return changed;
  }

  // はじめて図鑑を作るときだけ：すでにクリアしたダンジョンの敵は「見たことあり」にしておく
  //   （出撃準備の「出現モンスター」が出るのと同じ条件。固定バトル + ランダムバトルの敵）
  function seedFromClearedDungeons() {
    try {
      if (typeof clearedDungeons === 'undefined' || typeof DUNGEON_DATA === 'undefined') return;
      clearedDungeons.forEach(k => {
        const d = DUNGEON_DATA[k];
        if (!d) return;
        (d.battles || []).forEach(b => (b.enemies || []).forEach(noteEnemy));
        if (d.random && d.random.monsters) Object.values(d.random.monsters).forEach(noteEnemy);
      });
    } catch (e) {}
  }

  // ── 並び ───────────────────────────────────────────────────
  //   BoxSort の「入手順」を、図鑑では「ID順」として使う（図鑑用のカードは uid = モンスターID）
  const ALLOWED = ['acq', 'attr', 'name', 'hp', 'atk', 'rec', 'type', 'rarity', 'skill', 'leader'];
  const sortState = BoxSort.makeState('zukan', ALLOWED, false, {
    labels: { acq: '図鑑番号順' },
    note: 'HP・こうげき・かいふくは、最大Lvのときの数値で並びます。図鑑番号順以外では、まだ見ていないモンスターは最後にまとまります。'
  });
  const sortCtx = { monsters: null, stats: e => calcMonsterStats(e) };

  function allIds() {
    return Object.keys(MONSTER_DATA).map(Number).filter(id => id > 0 && MONSTER_DATA[id]).sort((a, b) => a - b);
  }
  const maxLvOf = mon => (typeof getMonsterMaxLevel === 'function') ? getMonsterMaxLevel(mon) : 99;
  // 図鑑用の仮のBOXデータ（最大Lvのモンスター1体 = 図鑑の1マス）
  const entryOf = id => ({ uid: id, monsterId: id, level: maxLvOf(MONSTER_DATA[id]) });

  // リーダースキル検索（js/ls-search.js）。まだ見ていないモンスターの情報が検索で分からないよう、
  //   絞り込み中は「ゲット済み／見たことあり」だけが対象（？のマスは出さない）
  let lsFilter = null;
  const lsOn = () => !!(lsFilter && lsFilter.active());
  // 属性検索（火・水・木・光・闇）。複数えらぶと「どれか」に合うモンスターを出す
  const attrSel = new Set();
  const attrOn = () => attrSel.size > 0;
  const filterOn = () => lsOn() || attrOn();   // どちらかで絞り込み中

  function orderedEntries() {
    sortCtx.monsters = MONSTER_DATA;
    const entries = allIds().map(entryOf);
    if (filterOn()) {
      const hit = entries.filter(e => statusOf(e.monsterId) > 0
        && (!attrOn() || attrSel.has(MONSTER_DATA[e.monsterId].attr))
        && (!lsOn() || lsFilter.match(MONSTER_DATA[e.monsterId])));
      return BoxSort.sort(hit, sortState, sortCtx);
    }
    if (sortState.mode === 'acq') return BoxSort.sort(entries, sortState, sortCtx);   // ID順（向きを逆にすると大きい番号から）
    const shown = entries.filter(e => statusOf(e.monsterId) > 0);
    const hidden = entries.filter(e => statusOf(e.monsterId) === 0);
    return BoxSort.sort(shown, sortState, sortCtx).concat(hidden);
  }

  // ── 一覧 ───────────────────────────────────────────────────
  function buildCard(entry) {
    const mon = MONSTER_DATA[entry.monsterId];
    const st = statusOf(mon.id);
    const card = document.createElement('div');
    card.className = 'zk-card ' + (st === 2 ? 'owned' : st === 1 ? 'seen' : 'unknown');
    card.dataset.id = String(mon.id);

    if (st === 0) {
      card.setAttribute('aria-label', `No.${mon.id} まだ見ていない`);
      const q = document.createElement('div');
      q.className = 'zk-q';
      q.textContent = '？';
      card.appendChild(q);
    } else {
      card.dataset.attr = mon.attr;
      card.setAttribute('aria-label', `No.${mon.id} ${mon.name}${st === 2 ? '' : '（まだゲットしていない）'}`);
      const img = document.createElement('img');
      img.className = 'zk-img';
      img.alt = mon.name;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.draggable = false;
      // 画像がまだ無いモンスターは、名前を書いた札で代わりにする。
      // （js/img-retry.js が失敗した画像を最大3回やり直すので、あとから読めたら札をやめて画像に戻す）
      img.onerror = () => {
        img.style.display = 'none';
        card.classList.add('noimg');
        if (!card.querySelector('.zk-name')) {
          const nm = document.createElement('div');
          nm.className = 'zk-name';
          nm.textContent = mon.name;
          card.insertBefore(nm, card.firstChild);
        }
      };
      img.onload = () => {
        img.style.display = '';
        card.classList.remove('noimg');
        const nm = card.querySelector('.zk-name');
        if (nm) nm.remove();
      };
      img.src = (typeof monsterImg === 'function') ? monsterImg(mon) : `m${mon.id}.png`;
      card.appendChild(img);
    }

    const no = document.createElement('div');
    no.className = 'zk-no';
    no.textContent = `No.${mon.id}`;
    card.appendChild(no);
    return card;
  }

  function render() {
    const grid = $('zukan-grid');
    if (!grid) return;
    const frag = document.createDocumentFragment();
    let anyVal = false;
    const list = orderedEntries();
    list.forEach(entry => {
      const card = buildCard(entry);
      if (statusOf(entry.monsterId) > 0 && (BoxSort.attachValue(card, sortState.mode, entry, sortCtx)   // HP順などは数値も出す
          || (lsOn() && lsFilter.attachLabel(card, MONSTER_DATA[entry.monsterId])))) anyVal = true;     // リダスキ検索中は倍率を出す
      frag.appendChild(card);
    });
    grid.innerHTML = '';
    grid.appendChild(frag);
    grid.classList.toggle('has-val', anyVal);
    let empty = $('zukan-empty');
    if (!empty) { empty = document.createElement('p'); empty.id = 'zukan-empty'; empty.className = 'zk-empty'; empty.textContent = '条件に合うモンスターがいません'; grid.parentNode.appendChild(empty); }
    empty.style.display = filterOn() && !list.length ? 'block' : 'none';

    const ids = allIds();
    const nOwned = ids.filter(id => owned.has(id)).length;
    const nSeen = ids.filter(id => seen.has(id)).length;
    $('zukan-count').innerHTML = filterOn()
      ? `該当 <b>${list.length}</b>体`
      : `ゲット <b>${nOwned}</b> / ${ids.length}　発見 <b>${nSeen}</b>`;
    $('zukan-sort-label').textContent = BoxSort.buttonLabel(sortState);
  }

  // ── 長押しでステータス ─────────────────────────────────────────
  let lp = null;
  function cancelLongPress() {
    if (!lp) return;
    clearTimeout(lp.timer);
    if (lp.card) lp.card.classList.remove('pressing');
    lp = null;
  }
  function bindLongPress() {
    const grid = $('zukan-grid');
    grid.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const card = e.target.closest('.zk-card.owned, .zk-card.seen');   // ？のマスは長押ししても何も起きない
      if (!card) return;
      cancelLongPress();
      const id = Number(card.dataset.id);
      card.classList.add('pressing');
      lp = { card, x: e.clientX, y: e.clientY, timer: setTimeout(() => {
        const c = lp && lp.card;
        if (c) c.classList.remove('pressing');
        lp = null;
        try { if (navigator.vibrate) navigator.vibrate(18); } catch (err) {}
        openInfo(id);
      }, LONGPRESS_MS) };
    });
    grid.addEventListener('pointermove', e => {
      if (lp && (Math.abs(e.clientX - lp.x) > MOVE_CANCEL_PX || Math.abs(e.clientY - lp.y) > MOVE_CANCEL_PX)) cancelLongPress();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => grid.addEventListener(t, cancelLongPress));
    $('zukan-box').addEventListener('scroll', cancelLongPress, { passive: true });
    grid.addEventListener('contextmenu', e => e.preventDefault());   // 長押しで出る「画像を保存」などのメニューを出さない
    grid.addEventListener('dragstart', e => e.preventDefault());
  }

  // ── ステータスのポップアップ ───────────────────────────────────
  const ATTR_IMG = { fire: '1', water: '2', wood: '3', light: '4', dark: '5' };
  const ATTR_JP = { fire: '火', water: '水', wood: '木', light: '光', dark: '闇' };
  const TYPE_ICON = { 'たいりょく': 'typ1', 'こうげき': 'typ2', 'かいふく': 'typ3', '回復': 'typ3', 'バランス': 'typ4' };
  let infoOpenedAt = 0;

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  const icon = name => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('class', 'ic');
    const u = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    u.setAttribute('href', '#' + name);
    s.appendChild(u);
    return s;
  };
  const fmt = n => (Number(n) || 0).toLocaleString('en-US');

  function typeNode(mon) {
    const wrap = el('span', 'zk-type');
    wrap.title = mon.type || '';
    const asText = () => { wrap.textContent = ''; wrap.classList.add('as-text'); wrap.textContent = mon.type || ''; };
    const f = TYPE_ICON[mon.type];
    if (f) {
      const im = el('img', 'zk-type-icon');
      im.alt = mon.type;
      im.onerror = asText;
      im.src = f + '.png';
      wrap.appendChild(im);
    } else if (mon.type) asText();
    return wrap;
  }

  // HP・攻撃・回復のアイコン画像（sta1.png = HP / sta2.png = 攻撃 / sta3.png = 回復）
  const STAT_IMG = { hp: 'sta1.png', atk: 'sta2.png', rec: 'sta3.png' };
  function statRow(cls, label, a, b) {
    const row = el('div', 'zk-stat-row ' + cls);
    const lb = el('span', 'zk-stat-label');
    const si = el('img', 'stat-ic');
    si.alt = '';
    si.draggable = false;
    si.src = STAT_IMG[cls];
    lb.appendChild(si);
    lb.appendChild(document.createTextNode(label));
    row.appendChild(lb);
    row.appendChild(el('span', 'zk-stat-val', fmt(a)));
    row.appendChild(el('span', 'zk-stat-val', fmt(b)));
    return row;
  }

  function fillInfo(id) {
    const mon = MONSTER_DATA[id];
    const card = $('zukan-info-card');
    card.innerHTML = '';
    card.dataset.attr = mon.attr;
    const body = el('div', 'zk-info-body');   // ここだけスクロール（下の「とじる」行は固定）
    card.appendChild(body);
    const st = statusOf(id);
    const maxLv = maxLvOf(mon);
    const lo = calcMonsterStats({ monsterId: id, level: 1 });
    const hi = calcMonsterStats({ monsterId: id, level: maxLv });

    // 上：絵 + 番号・レア度・名前
    const top = el('div', 'zk-info-top');
    const pic = el('div', 'zk-info-pic' + (st === 1 ? ' gray' : ''));
    const im = el('img');
    im.alt = mon.name;
    im.onerror = () => {   // 画像がまだ無いときは名前で代わりにする（あとから読めたら画像に戻す）
      im.style.display = 'none';
      if (!pic.querySelector('.zk-info-noimg')) pic.appendChild(el('span', 'zk-info-noimg', mon.name));
    };
    im.onload = () => {
      im.style.display = '';
      const nm = pic.querySelector('.zk-info-noimg');
      if (nm) nm.remove();
    };
    im.src = (typeof monsterImg === 'function') ? monsterImg(mon) : `m${mon.id}.png`;
    pic.appendChild(im);
    top.appendChild(pic);

    const meta = el('div', 'zk-info-meta');
    const line1 = el('div', 'zk-info-line1');
    line1.appendChild(el('span', 'zk-info-no', `No.${mon.id}`));
    line1.appendChild(el('span', 'zk-info-stars', '★'.repeat(Math.max(0, Number(mon.rarity) || 0))));
    meta.appendChild(line1);
    const nameRow = el('div', 'zk-info-namerow');
    if (ATTR_IMG[mon.attr]) {
      const ai = el('img', 'zk-info-attr');
      ai.alt = ATTR_JP[mon.attr] || mon.attr;
      ai.onerror = () => { ai.style.display = 'none'; };
      ai.onload = () => { ai.style.display = ''; };
      ai.src = ATTR_IMG[mon.attr] + '.png';
      nameRow.appendChild(ai);
    }
    nameRow.appendChild(el('span', 'zk-info-name', mon.name));
    nameRow.appendChild(typeNode(mon));
    meta.appendChild(nameRow);
    meta.appendChild(el('span', 'zk-info-state ' + (st === 2 ? 'got' : 'not'), st === 2 ? 'ゲット済み' : 'まだゲットしていない'));
    top.appendChild(meta);
    body.appendChild(top);

    // ステータス：Lv1 と 最大Lv
    const stats = el('div', 'zk-stats');
    const head = el('div', 'zk-stat-head');
    head.appendChild(el('span'));
    head.appendChild(el('b', null, 'Lv1'));
    const hiHead = el('b', null, `Lv${maxLv}`);
    if (maxLv !== 99) hiHead.appendChild(el('small', null, '最大'));
    head.appendChild(hiHead);
    stats.appendChild(head);
    stats.appendChild(statRow('hp', 'HP', lo.hp, hi.hp));
    stats.appendChild(statRow('atk', '攻撃力', lo.atk, hi.atk));
    stats.appendChild(statRow('rec', '回復力', lo.rec, hi.rec));
    body.appendChild(stats);

    // スキル
    const sk = mon.skill;
    if (sk) {
      const sec = el('div', 'zk-sec');
      const h = el('div', 'zk-sec-head');
      h.appendChild(el('span', 'zk-sec-label', `スキル：${sk.name || ''}`));
      const sp = (typeof getRequiredSp === 'function') ? getRequiredSp({}, mon) : (sk.sp || 1);
      h.appendChild(el('span', 'zk-sec-chip', `必要SP ${sp}`));
      sec.appendChild(h);
      { const p = el('p', 'zk-sec-desc'); setSkillText(p, sk.desc || ''); sec.appendChild(p); }
      body.appendChild(sec);
    }
    const ls = mon.leaderSkill;
    if (ls) {
      const sec = el('div', 'zk-sec ls');
      const h = el('div', 'zk-sec-head');
      h.appendChild(el('span', 'zk-sec-label', 'リーダースキル'));
      h.appendChild(el('span', 'zk-sec-ls-name', ls.name || ''));
      sec.appendChild(h);
      { const p = el('p', 'zk-sec-desc'); setSkillText(p, ls.desc || ''); sec.appendChild(p); }
      body.appendChild(sec);
    }
    // 入手場所（リーダースキルの下）：進化のチップの入手場所と同じ決まり。
    //   まだ開放していないエリア／ステージ、ドロップが決まっていない場所は出さない（js/game.js の getMonsterSpots）
    {
      let spots = null;
      try { if (typeof getMonsterSpots === 'function') spots = getMonsterSpots(id); } catch (e) { spots = null; }
      if (spots) {
        const sec = el('div', 'zk-sec spots');
        const h = el('div', 'zk-sec-head');
        h.appendChild(el('span', 'zk-sec-label', '入手場所'));
        sec.appendChild(h);
        const rows = [];
        spots.main.forEach(sp => rows.push({ sp, cls: '' }));
        (spots.events || []).forEach(sp => rows.push({ sp, cls: '' }));
        spots.daily.forEach(sp => rows.push({ sp, cls: sp.tag ? ' off' : '' }));
        if (rows.length) {
          const list = el('div', 'zk-spot-list');
          rows.forEach(r => {
            const row = el('div', 'zk-spot' + r.cls);
            row.appendChild(el('span', 'zk-spot-name', r.sp.label));
            if (r.sp.tag) row.appendChild(el('span', 'zk-spot-tag', r.sp.tag));
            list.appendChild(row);
          });
          sec.appendChild(list);
        } else {
          sec.appendChild(el('p', 'zk-sec-desc zk-spot-none', 'いまのところ入手できる場所がありません'));
        }
        body.appendChild(sec);
      }
    }

    // 下の行： ◀ まえ ・ とじる ・ つぎ ▶
    const foot = el('div', 'zk-info-foot');
    const many = infoList.length > 1;
    const navBtn = (dir, label, path) => {
      const b = el('button', 'zk-nav');
      b.type = 'button';
      b.setAttribute('aria-label', label);
      b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
      b.addEventListener('click', () => stepInfo(dir));
      return b;
    };
    foot.appendChild(many ? navBtn(-1, 'まえのモンスター', 'M15 4 7 12l8 8') : el('span'));
    const close = el('button', 'btn btn-primary zk-info-close', 'とじる');
    close.type = 'button';
    close.id = 'zukan-info-close';
    close.addEventListener('click', closeInfo);
    foot.appendChild(close);
    foot.appendChild(many ? navBtn(1, 'つぎのモンスター', 'M9 4l8 8-8 8') : el('span'));
    card.appendChild(foot);
    card.scrollTop = 0;
    body.scrollTop = 0;
  }

  // 左右ボタンで行ける順番 = いま一覧に並んでいる順（並び替え後もそのまま）。？のモンスターは飛ばす
  let infoList = [];
  let infoPos = 0;

  function showInfoAt(pos) {
    infoPos = pos;
    fillInfo(infoList[pos]);
  }
  function stepInfo(dir) {
    if (infoList.length < 2 || !$('zukan-info').classList.contains('show')) return;
    const n = infoList.length;
    showInfoAt((infoPos + dir + n) % n);   // 端までいったら反対側へ
  }
  function openInfo(id) {
    if (!known(id) || statusOf(id) === 0) return;
    infoList = orderedEntries().map(e => e.monsterId).filter(m => statusOf(m) > 0);
    const pos = infoList.indexOf(id);
    if (pos < 0) return;
    showInfoAt(pos);
    infoOpenedAt = Date.now();
    $('zukan-info').classList.add('show');
  }
  function closeInfo() { $('zukan-info').classList.remove('show'); }

  // ── 画面の開閉 ──────────────────────────────────────────────
  function open() {
    syncOwned();
    cancelLongPress();
    closeInfo();
    if (lsFilter) lsFilter.reset();
    attrSel.clear();
    document.querySelectorAll('.zk-attr-btn').forEach(b => b.classList.remove('active'));
    $('zukan-box').scrollTop = 0;
    render();
    $('zukan-screen').style.display = 'flex';
    if (typeof startMenuBGM === 'function') startMenuBGM();
  }
  function close() {
    closeInfo();
    cancelLongPress();
    $('zukan-screen').style.display = 'none';
  }

  function init() {
    load();
    if (!hadSaved) {   // はじめて：いま持っているモンスターと、クリア済みダンジョンの敵から作る
      syncOwned();
      seedFromClearedDungeons();
      save();
    } else {
      syncOwned();
    }
    if (!$('zukan-screen')) return;
    $('zukan-open-btn').addEventListener('click', open);
    $('zukan-back').addEventListener('click', close);
    lsFilter = LSSearch.mount({
      key: 'zukan', host: $('zukan-screen'),
      before: $('zukan-sort-btn'), after: $('zukan-hint'),
      candidates: () => allIds().filter(id => statusOf(id) > 0).map(id => MONSTER_DATA[id]),   // 見たことあるモンスターだけ
      onChange: () => { $('zukan-box').scrollTop = 0; render(); }
    });
    document.querySelectorAll('.zk-attr-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const a = btn.dataset.attr;
        if (attrSel.has(a)) { attrSel.delete(a); btn.classList.remove('active'); }
        else { attrSel.add(a); btn.classList.add('active'); }
        $('zukan-box').scrollTop = 0;
        render();
      });
    });
    $('zukan-sort-btn').addEventListener('click', () => {
      BoxSort.openSheet($('zukan-screen'), sortState, () => {
        $('zukan-box').scrollTop = 0;
        render();
      });
    });
    const info = $('zukan-info');
    info.addEventListener('click', e => {
      // 長押しした指を離したときの click で、開いた直後に閉じてしまわないようにする
      if (e.target === info && Date.now() - infoOpenedAt > 450) closeInfo();
    });
    // カードを横にスワイプしても前後に移れる
    let sw = null;
    const card = $('zukan-info-card');
    card.addEventListener('touchstart', e => {
      const t = e.touches[0];
      sw = e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
    }, { passive: true });
    card.addEventListener('touchend', e => {
      if (!sw) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - sw.x, dy = t.clientY - sw.y;
      sw = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.8) stepInfo(dx < 0 ? 1 : -1);
    }, { passive: true });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeInfo();
      else if (e.key === 'ArrowLeft') stepInfo(-1);
      else if (e.key === 'ArrowRight') stepInfo(1);
    });
    bindLongPress();
  }

  global.Zukan = {
    noteEnemies, syncOwned, open, close, render,
    isOwned: (id) => owned.has(Number(id)),   // 図鑑に登録（ゲット）済みか（進化パズルのスキップ判定に使う）
    // テスト・デバッグ用
    _state: () => ({ seen: [...seen], owned: [...owned] }),
    _statusOf: statusOf, _openInfo: openInfo
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
