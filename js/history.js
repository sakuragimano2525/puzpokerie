// ============================================================
// 履歴（ボーナス →「履歴」）  js/history.js
//   ダンジョンをクリアするたびに、その1回ぶんの記録を残す（最新30件まで。localStorage に保存）。
//     ・クリアしたダンジョン／ドロップ（モンスター・アイテム）／獲得エナ・EXP
//     ・モンスターごとの「与えたダメージ」「回復」（縦グラフ）
//     ・モンスターごとのスキル使用回数
//     ・消したドロップの属性別の数／ターン数／平均・最大コンボ／受けたダメージ
//
//   ■ 軽さ（低スペック端末向け）
//     ・戦闘中の記録は「数字の足し算」だけ（DOM・タイマー・保存は一切しない）。保存はクリア時の1回だけ
//     ・履歴の中身は、履歴画面を開くまで読み込まない
//     ・グラフは画像ライブラリ／canvas を使わず、CSSの棒だけ（アニメは transform のみ。重い端末では止める）
//     ・画面は innerHTML を1回で組み立てる。一覧の画像は遅延読み込み＋画面外の行は描画を省略
//
//   ■ ゲーム側からの呼び出し（js/game.js, js/allattack-fx.js。すべて window.BattleLog の有無を確かめてから）
//     begin(partyUids, box)            … ダンジョンに入った時（編成を控える・集計を 0 に）
//     dmg(slot, raw, actual) / skillDmg(raw, actual) … 敵に与えたダメージ（通常攻撃は枠番号つき／スキルは caster で決まる）
//                                       raw＝敵のHPを超えた分・超根性で止まった分も含む本来のダメージ ／ actual＝実際にHPが減った分
//     caster(slot)                     … スキル発動中だけ、発動したモンスターの枠番号（それ以外は -1）
//     heal(slot, n) / healShare(parts, n) … 回復（スキル・リーダースキル／回復ドロップは回復力の割合で分ける）
//     skill(slot, name)                … スキルを使った回数
//     move(combo, attrCounts)          … 1ターン（コンボが出た操作）ぶん
//     taken(n, isPoison)               … 受けたダメージ
//     finish({coin,exp,mon,items,floors}) … クリアした時（ここで履歴に保存）
// ============================================================
(function () {
  'use strict';

  var KEY = 'puzzdra_history_v1';
  var MAX = 30;       // 残す件数
  var NSLOT = 6;      // パーティの枠（リーダー＋4＋フレンド）
  var BAR_H = 112;    // グラフの棒の最大の高さ(px)

  var ATTRS = ['fire', 'water', 'wood', 'light', 'dark', 'heal', 'poison', 'ojama'];
  var ATTR_LABEL = { fire: '火', water: '水', wood: '木', light: '光', dark: '闇', heal: '回復', poison: '毒', ojama: 'お邪魔' };
  var ATTR_COLOR = { fire: '#ff5500', water: '#33aaff', wood: '#44dd44', light: '#ffdd44', dark: '#aa55dd', heal: '#ff88aa', poison: '#7b3fa0', ojama: '#8a8a8a' };

  var cur = null;    // いま進行中のダンジョンの集計
  var list = null;   // 保存済みの履歴（新しい順）。画面を開く／クリアするまで読まない

  // ------------------------------------------------------------
  // 保存
  // ------------------------------------------------------------
  function load() {
    if (list) return list;
    try { list = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { list = []; }
    if (!Array.isArray(list)) list = [];
    return list;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return; } catch (e) {}
    // 容量いっぱいなど：古いものを減らして、もう一度だけ試す
    try { list.length = Math.min(list.length, 10); localStorage.setItem(KEY, JSON.stringify(list)); } catch (e2) {}
  }

  // ------------------------------------------------------------
  // 記録（戦闘中）
  // ------------------------------------------------------------
  function zeros() { var a = []; for (var i = 0; i < NSLOT; i++) a.push(0); return a; }
  function inRange(s) { return s >= 0 && s < NSLOT; }

  function dungeonNames() {
    var area = '', stage = '';
    try { area = areaNameOf(currentAreaNum) || ''; } catch (e) {}
    try {
      var st = getStageList(currentAreaNum).filter(function (x) { return x.key === currentStageType; })[0];
      stage = st ? st.label : stageShortLabel(currentAreaNum, currentStageType);
    } catch (e) { try { stage = stageShortLabel(currentAreaNum, currentStageType); } catch (e2) {} }
    return [area, stage];
  }

  var BL = {
    begin: function (uids, box) {
      var team = [];
      for (var i = 0; i < NSLOT; i++) {
        var uid = uids ? uids[i] : null, ent = null;
        if (uid !== null && uid !== undefined && box) { for (var j = 0; j < box.length; j++) { if (box[j] && box[j].uid === uid) { ent = box[j]; break; } } }
        if (!ent) { team.push(0); continue; }
        var id = ent._tfFrom !== undefined ? ent._tfFrom : ent.monsterId;   // 変身していても、入った時の姿
        var m = monOf(id);
        team.push(m ? [id, m.name || '', ent._helper ? 1 : 0] : 0);
      }
      var nm = dungeonNames(), multi = 0;
      try { multi = isMultiArea(currentAreaNum) ? 1 : 0; } catch (e) {}
      var sk = []; for (var k = 0; k < NSLOT; k++) sk.push([]);
      cur = { k: (typeof currentDungeonKey !== 'undefined' ? currentDungeonKey : '') || '', a: nm[0], s: nm[1], mu: multi,
        t: team, d: zeros(), da: zeros(), h: zeros(), sk: sk,
        o: { fire: 0, water: 0, wood: 0, light: 0, dark: 0, heal: 0, poison: 0, ojama: 0 },
        tn: 0, cb: 0, mx: 0, tk: 0, ps: 0, cs: -1 };
    },
    // 敵に与えたダメージ（実際に入った分）
    // raw＝HPを超えた分も含む本来のダメージ（グラフ・合計に使う）／ actual＝実際に敵のHPが減った分（省略したら raw と同じ）
    dmg: function (slot, raw, actual) {
      if (!cur || !(raw > 0) || !inRange(slot)) return;
      cur.d[slot] += raw;
      cur.da[slot] += (actual === undefined ? raw : Math.min(actual, raw));
    },
    caster: function (slot) { if (cur) cur.cs = inRange(slot) ? slot : -1; },
    skillDmg: function (raw, actual) { if (cur && cur.cs >= 0) BL.dmg(cur.cs, raw, actual); },
    // 回復（実際に増えたHP）
    heal: function (slot, n) { if (cur && n > 0 && inRange(slot)) cur.h[slot] += n; },
    // 回復ドロップ：回復量を、各モンスターの回復力の割合で分ける（parts = { 枠番号: 回復力 }）
    healShare: function (parts, n) {
      if (!cur || !(n > 0) || !parts) return;
      var tot = 0, k;
      for (k in parts) tot += parts[k];
      if (!(tot > 0)) return;
      var left = n, last = -1;
      for (k in parts) {
        var s = Number(k); if (!inRange(s)) continue;
        var v = Math.floor(n * parts[k] / tot);
        cur.h[s] += v; left -= v; last = s;
      }
      if (last >= 0 && left > 0) cur.h[last] += left;   // 端数は最後の1体へ
    },
    skill: function (slot, name) {
      if (!cur || !inRange(slot)) return;
      name = String(name || 'スキル');
      var a = cur.sk[slot];
      for (var i = 0; i < a.length; i++) { if (a[i][0] === name) { a[i][1]++; return; } }
      a.push([name, 1]);
    },
    // コンボが出た操作＝1ターン
    move: function (combo, counts) {
      if (!cur || !(combo > 0)) return;
      cur.tn++; cur.cb += combo; if (combo > cur.mx) cur.mx = combo;
      if (counts) for (var i = 0; i < ATTRS.length; i++) { var a = ATTRS[i]; if (counts[a] > 0) cur.o[a] += counts[a]; }
    },
    taken: function (n, isPoison) { if (cur && n > 0) { cur.tk += n; if (isPoison) cur.ps += n; } },

    // クリア：履歴に1件ぶん保存する（二重に呼ばれても1回だけ）
    finish: function (info) {
      if (!cur) return;
      var c = cur; cur = null;
      try {
        info = info || {};
        var mons = {}, items = {}, i;
        var ml = info.mon || [], il = info.items || [];
        for (i = 0; i < ml.length; i++) mons[ml[i]] = (mons[ml[i]] || 0) + 1;
        for (i = 0; i < il.length; i++) if (il[i] && il[i].item) items[il[i].item] = (items[il[i].item] || 0) + (il[i].count | 0);
        var dm = [], di = [], k;
        for (k in mons) dm.push([Number(k), mons[k]]);
        for (k in items) di.push([k, items[k]]);
        var rec = { v: 1, ts: Date.now(), k: c.k, a: c.a, s: c.s, mu: c.mu, fl: info.floors | 0,
          tn: c.tn, cb: c.cb, mx: c.mx, tk: c.tk, ps: c.ps,
          t: c.t, d: c.d, da: c.da, h: c.h, sk: c.sk, o: c.o,
          co: info.coin | 0, ex: info.exp | 0, dr: { m: dm, i: di } };
        load();
        list.unshift(rec);
        if (list.length > MAX) list.length = MAX;
        save();
      } catch (e) { console.warn('[history]', e); }
    },
    count: function () { return load().length; }
  };

  // ------------------------------------------------------------
  // 表示の部品
  // ------------------------------------------------------------
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function monOf(id) { return (typeof MONSTER_DATA !== 'undefined' && MONSTER_DATA[id]) || null; }
  function monSrc(id) {
    var m = monOf(id);
    if (!m) return 'm' + id + '.png';
    return typeof monsterImg === 'function' ? monsterImg(m) : (m.img || ('m' + m.id + '.png'));
  }
  function img(src, cls) {
    return '<img class="' + cls + '" src="' + esc(src) + '" alt="" loading="lazy" decoding="async" draggable="false" onerror="this.style.visibility=\'hidden\'">';
  }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function fmtDate(ts) { var d = new Date(ts); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  // 8065000 → 「806万5000」／ 123456789 → 「1億2345万6789」
  function jp(n) {
    n = Math.floor(n || 0);
    if (n < 10000) return String(n);
    var oku = Math.floor(n / 1e8), man = Math.floor((n % 1e8) / 1e4), r = n % 1e4, s = '';
    if (oku) s += oku + '億';
    if (man) s += man + '万';
    if (r) s += r;
    return s;
  }
  // グラフの棒の上：1億以上は「1.23億」に縮める（正確な数字は、グラフの下の内訳に出す）
  function jpBar(n) { n = Math.floor(n || 0); return n >= 1e8 ? (Math.floor(n / 1e6) / 100) + '億' : jp(n); }
  function labelSize(s) { return s.length <= 6 ? '.66rem' : s.length <= 8 ? '.58rem' : '.52rem'; }

  // ------------------------------------------------------------
  // 画面
  // ------------------------------------------------------------
  var ov = null, panel = null, scroller = null;
  var listScroll = 0;

  function host() { return document.body; }   // ホーム中は #game が非表示なので body に置く（ボーナスのメニューと同じ）

  function dropCount(r) {
    var n = 0, i, d = r.dr || {};
    for (i = 0; i < (d.m || []).length; i++) n += d.m[i][1];
    for (i = 0; i < (d.i || []).length; i++) n += d.i[i][1];
    return n;
  }
  function avgCombo(r) { return r.tn > 0 ? r.cb / r.tn : 0; }

  function teamIcons(t, cls) {
    var s = '';
    for (var i = 0; i < (t || []).length; i++) if (t[i]) s += img(monSrc(t[i][0]), cls);
    return s;
  }

  function listHtml() {
    var L = load();
    if (!L.length) return '<div class="hs-empty">まだ履歴がありません。<br>ダンジョンをクリアすると、ここに記録されます。</div>';
    var out = '';
    for (var i = 0; i < L.length; i++) {
      var r = L[i];
      out += '<button type="button" class="hs-row" data-i="' + i + '">' +
        '<div class="hs-r1"><b>' + esc(r.s || r.k || 'ダンジョン') + '</b>' + (r.mu ? '<em>マルチ</em>' : '') + '<span>' + fmtDate(r.ts) + '</span></div>' +
        (r.a ? '<div class="hs-r2">' + esc(r.a) + '</div>' : '') +
        '<div class="hs-team">' + teamIcons(r.t, 'hs-mi') + '</div>' +
        '<div class="hs-r3"><span>' + r.tn + 'ターン</span><span>平均 ' + avgCombo(r).toFixed(1) + ' コンボ</span><span>ドロップ ' + dropCount(r) + '</span></div>' +
        '</button>';
    }
    return out;
  }

  // 縦グラフ（モンスターごと）。vals＝枠ごとの数値
  function chartHtml(vals, team, title, actual) {
    var max = 0, total = 0, i;
    for (i = 0; i < NSLOT; i++) { if (team[i]) { var v0 = vals[i] || 0; total += v0; if (v0 > max) max = v0; } }
    var cols = '', rows = '';
    for (i = 0; i < NSLOT; i++) {
      if (!team[i]) continue;
      var v = vals[i] || 0, m = monOf(team[i][0]);
      var h = v > 0 ? Math.max(4, Math.round(v / max * BAR_H)) : 2;
      var lab = jpBar(v);
      cols += '<div class="hs-col"><div class="hs-colbar">' +
        '<div class="hs-val" style="font-size:' + labelSize(lab) + '">' + lab + '</div>' +
        '<div class="hs-bar ' + (m ? m.attr : '') + (v > 0 ? '' : ' zero') + '" style="height:' + h + 'px"></div></div>' +
        img(monSrc(team[i][0]), 'hs-ci') + '</div>';
      rows += '<div class="hs-lg">' + img(monSrc(team[i][0]), 'hs-mi s') +
        '<span class="hs-lg-n">' + esc(team[i][1] || (m && m.name) || '') + (team[i][2] ? '<i>助っ人</i>' : '') + '</span>' +
        '<b>' + jp(v) + '</b><small>' + (total > 0 ? Math.round(v / total * 100) : 0) + '%</small></div>';
    }
    var note = '';
    if (actual) {   // 敵のHPを超えた分も含めた合計のうち、実際にHPが減った分／超過分
      var act = 0; for (i = 0; i < NSLOT; i++) if (team[i]) act += actual[i] || 0;
      act = Math.min(act, total);
      note = '<div class="hs-note">敵のHPに入った分 <b>' + jp(act) + '</b>　HP超過・超根性で止まった分 <b>' + jp(total - act) + '</b></div>';
    }
    return '<section class="hs-sec"><h3><span>' + title + '</span><span class="hs-tot">合計 <b>' + jp(total) + '</b></span></h3>' + note +
      '<div class="hs-chart">' + cols + '</div><div class="hs-legend">' + rows + '</div></section>';
  }

  function skillsHtml(r) {
    var rows = '', total = 0, i, j;
    for (i = 0; i < NSLOT; i++) {
      if (!r.t[i]) continue;
      var a = (r.sk && r.sk[i]) || [], inner = '';
      for (j = 0; j < a.length; j++) { total += a[j][1]; inner += '<div class="hs-sk-l"><span>' + esc(a[j][0]) + '</span><b>×' + a[j][1] + '</b></div>'; }
      if (!a.length) inner = '<div class="hs-sk-l mute"><span>使用なし</span></div>';
      rows += '<div class="hs-sk">' + img(monSrc(r.t[i][0]), 'hs-mi') + '<div class="hs-sk-b">' + inner + '</div></div>';
    }
    return '<section class="hs-sec"><h3><span>スキル使用</span><span class="hs-tot">合計 <b>' + total + '</b> 回</span></h3>' + rows + '</section>';
  }

  function orbsHtml(r) {
    var o = r.o || {}, total = 0, bar = '', chips = '', i;
    for (i = 0; i < ATTRS.length; i++) total += o[ATTRS[i]] || 0;
    for (i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i], n = o[a] || 0;
      var always = i < 6;   // 火水木光闇回復は 0 でも出す。毒・お邪魔は消した時だけ
      if (n > 0) bar += '<i style="flex:' + n + ';background:' + ATTR_COLOR[a] + '"></i>';
      if (always || n > 0) chips += '<div class="hs-oc"><i style="background:' + ATTR_COLOR[a] + '"></i><span>' + ATTR_LABEL[a] + '</span><b>' + n.toLocaleString() + '</b></div>';
    }
    return '<section class="hs-sec"><h3><span>消したドロップ</span><span class="hs-tot">合計 <b>' + total.toLocaleString() + '</b> 個</span></h3>' +
      (total > 0 ? '<div class="hs-orbbar">' + bar + '</div>' : '') + '<div class="hs-orbs">' + chips + '</div></section>';
  }

  function statsHtml(r) {
    function tile(k, v, sub) { return '<div class="hs-st"><div class="k">' + k + '</div><div class="v">' + v + '</div>' + (sub ? '<div class="s">' + sub + '</div>' : '') + '</div>'; }
    return '<section class="hs-sec"><h3><span>せんせき</span></h3><div class="hs-stats">' +
      tile('かかったターン', r.tn + '<small>ターン</small>') +
      tile('平均コンボ', avgCombo(r).toFixed(2)) +
      tile('最大コンボ', (r.mx || 0) + '<small>コンボ</small>') +
      tile('総コンボ', (r.cb || 0).toLocaleString()) +
      tile('受けたダメージ', jp(r.tk), r.ps > 0 ? 'うち毒 ' + jp(r.ps) : '') +
      tile('バトル数', (r.fl || 0) + '<small>階層</small>') +
      '</div></section>';
  }

  function dropsHtml(r) {
    var d = r.dr || {}, items = '', i;
    for (i = 0; i < (d.m || []).length; i++) {
      var m = monOf(d.m[i][0]);
      items += '<div class="hs-dr">' + img(monSrc(d.m[i][0]), 'hs-dri') + (d.m[i][1] > 1 ? '<b>×' + d.m[i][1] + '</b>' : '') + '<span>' + esc(m ? m.name : 'ID' + d.m[i][0]) + '</span></div>';
    }
    for (i = 0; i < (d.i || []).length; i++) {
      var def = (typeof ITEM_DATA !== 'undefined') && ITEM_DATA[d.i[i][0]];
      items += '<div class="hs-dr item">' + img(def ? def.img : (d.i[i][0] + '.png'), 'hs-dri') + '<b>×' + d.i[i][1] + '</b><span>' + esc(def ? def.name : d.i[i][0]) + '</span></div>';
    }
    return '<section class="hs-sec"><h3><span>ドロップ</span><span class="hs-tot">獲得エナ <b>' + (r.co || 0).toLocaleString() + '</b>　EXP <b>' + (r.ex || 0).toLocaleString() + '</b></span></h3>' +
      (items ? '<div class="hs-drops">' + items + '</div>' : '<div class="hs-none">ドロップなし</div>') + '</section>';
  }

  function detailHtml(r) {
    return '<div class="hs-dhead"><div class="hs-dname">' + esc(r.s || r.k || 'ダンジョン') + (r.mu ? '<em>マルチ</em>' : '') + '</div>' +
      '<div class="hs-dsub">' + (r.a ? esc(r.a) + '　' : '') + fmtDate(r.ts) + '</div>' +
      '<div class="hs-team c">' + teamIcons(r.t, 'hs-mi') + '</div></div>' +
      dropsHtml(r) +
      chartHtml(r.d || [], r.t, '与えたダメージ', r.da) +
      chartHtml(r.h || [], r.t, '回復') +
      skillsHtml(r) +
      orbsHtml(r) +
      statsHtml(r);
  }

  // ------------------------------------------------------------
  // 開く・閉じる・切り替え
  // ------------------------------------------------------------
  function frame(title, body, footBtn) {
    return '<div class="hs-title">' + title + '</div>' +
      '<div class="hs-scroll" id="hs-scroll">' + body + '</div>' + footBtn;
  }
  function showList() {
    var n = load().length;
    panel.innerHTML = frame('履歴 <small>' + n + ' / ' + MAX + '</small>', listHtml(),
      '<button type="button" class="hs-foot" id="hs-close">もどる</button>');
    scroller = panel.querySelector('#hs-scroll');
    if (scroller) scroller.scrollTop = listScroll;
  }
  function showDetail(i) {
    var r = load()[i];
    if (!r) return;
    if (scroller) listScroll = scroller.scrollTop;
    panel.innerHTML = frame('クリアの記録', detailHtml(r),
      '<button type="button" class="hs-foot" id="hs-back">一覧へ</button>');
    scroller = panel.querySelector('#hs-scroll');
    if (scroller) scroller.scrollTop = 0;
  }
  function close() {
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    ov = panel = scroller = null;
  }
  function open() {
    close();
    listScroll = 0;
    ov = document.createElement('div');
    ov.className = 'hs-back';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-label', '履歴');
    panel = document.createElement('div');
    panel.className = 'hs-box';
    try { if (window.FxPerf && FxPerf.q && FxPerf.q() < 1) panel.className += ' hs-lite'; } catch (e) {}   // 重い端末ではグラフのアニメを止める
    ov.appendChild(panel);
    ov.addEventListener('click', function (e) {
      var t = e.target;
      if (t === ov) { close(); return; }
      var el = t.closest ? t.closest('[data-i],#hs-close,#hs-back') : null;
      if (!el) return;
      if (el.id === 'hs-close') close();
      else if (el.id === 'hs-back') showList();
      else showDetail(Number(el.getAttribute('data-i')));
    });
    showList();
    host().appendChild(ov);
  }

  BL.open = open;
  BL.close = close;
  window.BattleLog = BL;
})();
