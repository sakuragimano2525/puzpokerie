// ============================================================
// ★ フレンド（マイカード・助っ人・フレンド募集） ★   js/friends.js ／ css/friends.css
//
//   ホームの「ボーナス」→「フレンド」から開く。
//
//   ■ マイカード … 名前・好きな属性(1.png〜5.png)・好きなモンスター(図鑑ゲット済みから。mp{id}.png で大きく表示)・コメント
//        ＋ 自動で入る分：現在のメインエリア・図鑑数・チーム1のパーティー・助っ人
//   ■ 助っ人設定 … ボックスのモンスターを1匹、助っ人にする。
//        ★そのときのLv・プラス値のまま固定（あとでボックスのLvが上がっても、助っ人は変わらない）。設定しなおすと上書き
//   ■ フレンド … 「フレンドを募集」でランダムにマッチした相手と、マイカードを交換（相手のカードが見られる／助っ人が使える）
//   ■ 助っ人を使う … 出撃準備の「落ちるチップ/アイテム」の下に「助っ人一覧」が出る。選ぶと、フレンド枠(6枠目)がその助っ人になる
//        ・フレンド1人につき助っ人は1匹だけ（同じ人から2匹目は使えない）／相手が助っ人を変えたら、次の更新で上書き
//        ・助っ人は借りもの：経験値は入らない／図鑑・セーブにも入らない
//   ■ 自動更新 … マルチでランダムマッチした相手が、すでにフレンドなら、お互いのカード（助っ人も）を最新にする
//
//   ◆ 通信：js/multi-online.js の「マッチング＋部屋」の仕組みをそのまま使う（新しいDBの場所は増やしていない）
//        フレンド募集 … 待ち行列キー 'friend_recruit' でマッチ → 部屋の card/{seat} にカードを置いて交換 → 退出
//        マルチ自動更新 … マルチの部屋に入ったときに card/{seat} へ自分のカードを置く（相手の分は onCard で受け取る）
//   ◆ 保存：localStorage 'puzzdra_friends_v1'（自分のID・マイカード・助っ人・フレンド一覧）
//        ※ブラウザのデータを消すと、自分のID・フレンドも消えます（ゲームのセーブと同じ）
//
//   ◆ 設定（下の定数）
//        AUTO_ADD_MULTI_PARTNERS … true にすると、マルチで会った人（まだフレンドでない人）もその場でフレンドに追加する
//
//   ◆ game.js とのつなぎ目（助っ人は「仮のモンスター」として一時的に box に入る）
//        Friends.onRenderEntry() … 出撃準備を描くとき（助っ人を box に入れる／「助っ人一覧」を描く）
//        Friends.syncParty()     … ダンジョンに入るとき（フレンド枠＝partyUids[5] を助っ人に）
//        Friends.eject()/release() … 助っ人を外す（編成を触るとき／出撃準備を出たとき）。ホームに戻ったら自動でも外す
// ============================================================
(function (global) {
  'use strict';

  // ── 設定 ───────────────────────────────────────────────────
  const KEY = 'puzzdra_friends_v1';
  const MAX_FRIENDS = 50;                 // フレンドの上限
  const NAME_MAX = 10;                    // 名前の最大文字数
  const COMMENT_MAX = 30;                 // コメントの最大文字数
  const AUTO_ADD_MULTI_PARTNERS = false;  // マルチで会った人を、その場でフレンドに追加するか
  const RECRUIT_QUEUE = 'friend_recruit'; // フレンド募集の待ち行列キー（mt_queue/{キー}）
  const EXCHANGE_TIMEOUT_MS = 15000;      // マッチ後、相手のカードが届くまで待つ時間
  const ATTRS = ['fire', 'water', 'wood', 'light', 'dark'];
  const ATTR_NO = { fire: 1, water: 2, wood: 3, light: 4, dark: 5 };   // 属性アイコン 1.png〜5.png
  const ATTR_JP = { fire: '火', water: '水', wood: '木', light: '光', dark: '闇' };

  // ── 小さな道具 ─────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v, d) => { v = Number(v); return Number.isFinite(v) ? v : (d || 0); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const isMon = id => typeof MONSTER_DATA !== 'undefined' && !!MONSTER_DATA[id];
  const monImg = mon => (typeof monsterImg === 'function') ? monsterImg(mon) : (mon.img || ('m' + mon.id + '.png'));
  const bigImg = mon => monImg(mon).replace(/(m)(\d+\.png)$/, '$1p$2');   // m1.png → mp1.png（sm1.png → smp1.png）
  const maxLvOf = mon => (typeof getMonsterMaxLevel === 'function') ? getMonsterMaxLevel(mon) : 99;
  const clip = (s, max) => Array.from(String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, max).join('');
  const tap = () => { try { if (typeof playTapSound === 'function') playTapSound(); } catch (e) {} };
  const modo = () => { try { if (typeof playModoSound === 'function') playModoSound(); } catch (e) {} };
  const isShown = id => { const e = $(id); return !!e && getComputedStyle(e).display !== 'none'; };
  const fmtDate = ts => { const d = new Date(ts || 0); return isNaN(d) || !ts ? '' : (d.getMonth() + 1) + '/' + d.getDate(); };
  const IC = {
    pen: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
    shield: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/><path d="m9 12 2.2 2.2L15.5 10"/></svg>',
    team: '<svg class="ic"><use href="#i-team"/></svg>',
    chev: '<svg class="ic fr-chev"><use href="#i-chev"/></svg>',
    down: '<svg class="ic"><use href="#i-down"/></svg>',
  };
  // 画像：読み込めなければ隠す（img-retry.js が裏でやり直す）。大きい mp 画像は、無ければ m 画像にして、それも無ければ隠す
  const HIDE_ERR = "this.style.visibility='hidden'";
  const FB_ERR = "if(!this.dataset.t&&this.dataset.fb){this.dataset.t=1;this.src=this.dataset.fb}else{this.style.visibility='hidden'}";
  const imgTag = (src, cls, alt) => `<img class="${cls}" src="${esc(src)}" alt="${esc(alt || '')}" draggable="false" onerror="${HIDE_ERR}">`;
  const bigImgTag = (mon, cls) => `<img class="${cls}" src="${esc(bigImg(mon))}" data-fb="${esc(monImg(mon))}" alt="${esc(mon.name)}" draggable="false" onerror="${FB_ERR}">`;

  // ── 保存データ ─────────────────────────────────────────────
  //   S = { v, pid（自分のID）, me:{name,attr,fav,comment}, helper:{m,lv,sp,mem,ph,pa,pr,ts}|null, friends:[カード＋added/updated] }
  let S = null;
  function newPid() {
    let s = '';
    const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 10; i++) s += abc[Math.floor(Math.random() * abc.length)];
    return s;
  }
  function load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    const s = { v: 1, pid: '', me: { name: '', attr: '', fav: 0, comment: '' }, helper: null, friends: [] };
    if (d && typeof d === 'object') {
      if (typeof d.pid === 'string' && /^[A-Za-z0-9_-]{6,40}$/.test(d.pid)) s.pid = d.pid;
      if (d.me && typeof d.me === 'object') s.me = { name: clip(d.me.name, NAME_MAX), attr: ATTRS.includes(d.me.attr) ? d.me.attr : '', fav: Math.floor(num(d.me.fav)), comment: clip(d.me.comment, COMMENT_MAX) };
      s.helper = unpackHelper(d.helper && packHelper(d.helper));
      if (s.helper && d.helper) s.helper.ts = num(d.helper.ts);
      if (Array.isArray(d.friends)) d.friends.forEach(f => {
        const c = normCard(f);
        if (!c || c.pid === s.pid || s.friends.some(x => x.pid === c.pid)) return;
        c.added = num(f.added, Date.now()); c.updated = num(f.updated, c.added);
        s.friends.push(c);
      });
    }
    if (!s.pid) s.pid = newPid();
    return s;
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        v: 1, pid: S.pid, me: S.me, helper: S.helper,
        friends: S.friends.map(f => Object.assign(packCard(f), { added: f.added, updated: f.updated }))
      }));
    } catch (e) {}
  }

  // ── カード（やりとりする形） ───────────────────────────────
  //   通信・保存用の形 T：{ v, pid, name, attr, fav, comment, area, areaName, areaClear, zukan, zukanTotal, team:"ID:Lv,…(6枠)", helper:"ID:Lv:sp:mem:ph:pa:pr", ts }
  //   中で使う形 C   ：team は [{m,lv}|null ×6]、helper は {m,lv,sp,mem,ph,pa,pr}|null（相手から来たものは、必ず normCard を通して中身を確かめる）
  function packHelper(h) { return h ? [h.m, h.lv, h.sp | 0, h.mem | 0, h.ph | 0, h.pa | 0, h.pr | 0].join(':') : ''; }
  function unpackHelper(str) {
    if (!str || typeof str !== 'string') return null;
    const a = str.split(':').map(Number);
    const m = Math.floor(a[0]);
    if (!isMon(m)) return null;
    const plus = v => clamp(Math.floor(num(v)), 0, 999);
    return { m, lv: clamp(Math.floor(num(a[1], 1)) || 1, 1, maxLvOf(MONSTER_DATA[m])), sp: plus(a[2]), mem: plus(a[3]), ph: plus(a[4]), pa: plus(a[5]), pr: plus(a[6]), ts: 0 };
  }
  function packTeam(arr) { return arr.map(t => t ? t.m + ':' + t.lv : '').join(','); }
  function parseTeam(str) {
    const parts = String(str || '').split(',');
    const out = [];
    for (let i = 0; i < 6; i++) {
      const p = (parts[i] || '').split(':');
      const m = Math.floor(num(p[0]));
      out.push(isMon(m) ? { m, lv: clamp(Math.floor(num(p[1], 1)) || 1, 1, maxLvOf(MONSTER_DATA[m])) } : null);
    }
    return out;
  }
  function normCard(t) {
    if (!t || typeof t !== 'object') return null;
    const pid = String(t.pid || '');
    if (!/^[A-Za-z0-9_-]{6,40}$/.test(pid)) return null;
    const fav = Math.floor(num(t.fav));
    return {
      pid,
      name: clip(t.name, NAME_MAX) || 'ななしさん',
      attr: ATTRS.includes(t.attr) ? t.attr : 'fire',
      fav: isMon(fav) ? fav : 0,
      comment: clip(t.comment, COMMENT_MAX),
      area: clamp(Math.floor(num(t.area, 1)) || 1, 1, 999),
      areaName: clip(t.areaName, 16),
      areaClear: t.areaClear === true || Number(t.areaClear) === 1,
      zukan: clamp(Math.floor(num(t.zukan)), 0, 99999),
      zukanTotal: clamp(Math.floor(num(t.zukanTotal)), 0, 99999),
      team: parseTeam(t.team),
      helper: unpackHelper(t.helper),
      ts: num(t.ts)
    };
  }
  function packCard(c) {
    return { v: 1, pid: c.pid, name: c.name, attr: c.attr, fav: c.fav | 0, comment: c.comment || '', area: c.area | 0, areaName: c.areaName || '',
      areaClear: c.areaClear ? 1 : 0, zukan: c.zukan | 0, zukanTotal: c.zukanTotal | 0, team: packTeam(c.team), helper: packHelper(c.helper), ts: c.ts || Date.now() };
  }
  const parseJson = s => { try { return JSON.parse(s); } catch (e) { return null; } };

  // ── 自分のカードを、いまのゲームの状態から作る ─────────────
  const entryOfUid = uid => (uid === null || uid === undefined) ? null : (box.find(b => b.uid === uid && !b._helper) || null);
  const realId = e => e ? Number(e._tfFrom !== undefined ? e._tfFrom : e.monsterId) : 0;
  function team1Uids() { return (typeof currentTeamNo !== 'undefined' && currentTeamNo === 0) ? currentTeam : teams[0]; }   // チーム1（編成中なら、編成中の中身）
  function leaderEntry() { return entryOfUid(team1Uids()[0]); }
  function mainArea() {   // 現在のメインエリア（開放ずみの最先端）
    try {
      const max = (typeof TOTAL_STAGES === 'number') ? TOTAL_STAGES : 10;
      let n = 1;
      for (let k = 1; k <= max; k++) if (isAreaUnlocked(k) && !isAreaHidden(k)) n = k;
      return { n, name: AREA_NAMES[n] || ('エリア' + n), clear: !!isAreaBossCleared(n) };
    } catch (e) { return { n: 1, name: '', clear: false }; }
  }
  function zukanCounts() {
    try { if (global.Zukan && Zukan.syncOwned) Zukan.syncOwned(); if (global.Zukan && Zukan.counts) { const c = Zukan.counts(); return { owned: c.owned, total: c.total }; } } catch (e) {}
    return { owned: new Set(box.filter(b => !b._helper).map(realId)).size, total: Object.keys(MONSTER_DATA).length };
  }
  const isOwnedMon = id => !!(global.Zukan && Zukan.isOwned && Zukan.isOwned(id)) || box.some(b => !b._helper && realId(b) === id);
  function ensureMe() {   // 空のところは、はじめの値で埋める（名前は ななしさん＋3けた／属性・好きなモンスターは、チーム1のリーダー）
    const me = S.me;
    const le = leaderEntry(), lm = le && MONSTER_DATA[realId(le)];
    if (!me.name) { let h = 0; for (const ch of S.pid) h = (h * 31 + ch.charCodeAt(0)) % 900; me.name = 'ななしさん' + (100 + h); }
    if (!ATTRS.includes(me.attr)) me.attr = (lm && ATTRS.includes(lm.attr)) ? lm.attr : 'fire';
    if (!(me.fav > 0 && isMon(me.fav) && isOwnedMon(me.fav))) {
      const first = box.find(b => !b._helper && isMon(realId(b)));
      me.fav = lm ? lm.id : (first ? realId(first) : 0);
    }
    if (typeof me.comment !== 'string') me.comment = '';
  }
  function myCard() {
    ensureMe();
    const a = mainArea(), z = zukanCounts();
    const team = team1Uids().slice(0, 6).map(uid => { const e = entryOfUid(uid); return e && isMon(realId(e)) ? { m: realId(e), lv: e.level } : null; });
    while (team.length < 6) team.push(null);
    return { pid: S.pid, name: S.me.name, attr: S.me.attr, fav: S.me.fav, comment: S.me.comment, area: a.n, areaName: a.name, areaClear: a.clear,
      zukan: z.owned, zukanTotal: z.total, team, helper: S.helper ? Object.assign({}, S.helper) : null, ts: Date.now() };
  }

  // ── フレンドの出し入れ ─────────────────────────────────────
  const findFriend = pid => S.friends.find(f => f.pid === pid) || null;
  // 追加 or 更新（助っ人も上書き）。戻り値 { rec, isNew, helperChanged } ／ 自分自身・満員で追加できないときは null
  function upsertFriend(c) {
    if (!c || c.pid === S.pid) return null;
    const now = Date.now();
    let rec = findFriend(c.pid);
    if (rec) {
      const before = packHelper(rec.helper);
      Object.assign(rec, c, { added: rec.added, updated: now });
      save();
      return { rec, isNew: false, helperChanged: before !== packHelper(rec.helper) };
    }
    if (S.friends.length >= MAX_FRIENDS) return null;
    rec = Object.assign({}, c, { added: now, updated: now });
    S.friends.unshift(rec);
    save();
    return { rec, isNew: true, helperChanged: true };
  }
  function removeFriend(pid) {
    S.friends = S.friends.filter(f => f.pid !== pid);
    if (sel === pid) { sel = null; eject(); }
    save();
  }

  // ── 助っ人を使う（game.js とのつなぎ目） ───────────────────
  //   sel      … 使うことにした助っ人（フレンドの pid）
  //   injected … いま、助っ人の仮のモンスターが box に入っている（フレンド枠＝partyUids[5] が助っ人になっている）
  let sel = null, injected = false;
  const helperFriend = () => { if (!sel) return null; const f = findFriend(sel); return (f && f.helper) ? f : null; };
  function helperEntryOf(f) {
    const h = f.helper;
    return { uid: HELPER_UID, monsterId: h.m, level: h.lv, exp: (typeof EXP_CUMULATIVE !== 'undefined' && EXP_CUMULATIVE[h.lv - 1]) || 0,
      sp: h.sp, memory: h.mem, plusHp: h.ph, plusAtk: h.pa, plusRec: h.pr, _helper: true, _helperPid: f.pid, _helperName: f.name };
  }
  function dropHelperFromBox() { for (let i = box.length - 1; i >= 0; i--) if (box[i] && box[i]._helper) box.splice(i, 1); }
  function eject() {
    dropHelperFromBox();
    if (partyUids[5] === HELPER_UID) partyUids[5] = (currentTeam[5] !== undefined) ? currentTeam[5] : null;   // フレンド枠は、本当の自分の編成に戻す
    if (injected) { injected = false; try { _hpCache.key = ''; } catch (e) {} }
  }
  function inject() {
    dropHelperFromBox();
    const f = helperFriend();
    if (!f) { sel = null; if (partyUids[5] === HELPER_UID) partyUids[5] = (currentTeam[5] !== undefined) ? currentTeam[5] : null; injected = false; return false; }
    box.push(helperEntryOf(f));
    partyUids[5] = HELPER_UID;
    injected = true;
    try { _hpCache.key = ''; } catch (e) {}
    return true;
  }
  function release() { sel = null; eject(); renderEntryList(); }
  function pickHelper(pid) {   // 出撃準備の助っ人一覧：タップで選ぶ／もう一度タップで外す
    sel = (sel === pid) ? null : pid;
    tap();
    if (typeof renderDungeonEntry === 'function') renderDungeonEntry(); else renderEntryList();
  }
  // 助っ人を使っているのに、ホーム・ステージ選択に戻ったら自動で外す（クリア／ゲームオーバー／リタイアの戻り先がいくつもあるので、見張りで確実に）
  setInterval(() => {
    if (!sel && !injected) return;
    if (isShown('dungeon-entry') || isShown('game') || isShown('team-edit')) return;
    sel = null; eject();
  }, 700);

  // ── 出撃準備の「助っ人一覧」 ───────────────────────────────
  function entrySection() {
    let sec = $('de-helper-section');
    if (sec) return sec;
    const body = $('de-body');
    if (!body) return null;
    sec = document.createElement('div');
    sec.id = 'de-helper-section';
    const info = $('de-info-section');
    if (info && info.parentNode === body) body.insertBefore(sec, info.nextSibling);   // 「落ちるチップ/アイテム」のすぐ下
    else body.appendChild(sec);
    sec.addEventListener('click', e => {
      const c = e.target.closest('.fh-card');
      if (c && sec.contains(c)) pickHelper(c.dataset.pid);
    });
    onLongPress(sec, '.fh-card', c => showHelperDetail(c.dataset.pid));
    return sec;
  }
  function renderEntryList() {
    const sec = entrySection();
    if (!sec) return;
    const list = S.friends.filter(f => f.helper).sort((a, b) => b.updated - a.updated);
    let inner;
    if (!list.length) {
      inner = `<div class="fh-empty">${S.friends.length ? '助っ人を設定しているフレンドがいません' : 'まだフレンドがいません'}<small>ホームの「ボーナス」→「フレンド」で、フレンドを募集しよう</small></div>`;
    } else {
      inner = '<div class="fh-grid">' + list.map(f => {
        const mon = MONSTER_DATA[f.helper.m], on = sel === f.pid;
        return `<button type="button" class="fh-card${on ? ' on' : ''}" data-pid="${esc(f.pid)}" data-attr="${esc(mon.attr)}" aria-pressed="${on}" aria-label="${esc(f.name)}の助っ人 ${esc(mon.name)}">` +
          `<span class="fh-img">${imgTag(monImg(mon), 'fh-mon', mon.name)}<i class="fh-lv">Lv.${f.helper.lv}</i>${on ? '<i class="fh-use">使用中</i>' : ''}</span>` +
          `<span class="fh-name">${esc(f.name)}</span></button>`;
      }).join('') + '</div>';
    }
    sec.innerHTML = `<div class="de-info-block helper"><div class="de-info-head"><span class="de-info-label">助っ人一覧</span><span class="fh-sub">タップで選ぶ ／ 長押しで詳細</span></div>${inner}</div>`;
  }
  function showHelperDetail(pid) {
    const f = findFriend(pid);
    if (f && f.helper && typeof previewEntryDetail === 'function') previewEntryDetail(helperEntryOf(f), '助っ人の詳細');
  }
  function focusList() {
    const sec = $('de-helper-section');
    if (!sec) return;
    try { sec.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { sec.scrollIntoView(); }
    sec.classList.remove('flash'); void sec.offsetWidth; sec.classList.add('flash');
  }

  // 長押し（イベントを root で受けて、selector に当てはまる要素だけ）。長押ししたあとのタップ（click）は無かったことにする
  function onLongPress(root, selector, cb, ms) {
    let timer = null, sx = 0, sy = 0, fired = false;
    const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
    root.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const t = e.target.closest && e.target.closest(selector);
      if (!t || !root.contains(t)) return;
      fired = false; cancel(); sx = e.clientX; sy = e.clientY;
      timer = setTimeout(() => { timer = null; fired = true; try { if (navigator.vibrate) navigator.vibrate(18); } catch (err) {} cb(t); }, ms || 380);
    });
    root.addEventListener('pointermove', e => { if (timer && (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10)) cancel(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => root.addEventListener(n, cancel));
    root.addEventListener('click', e => { if (fired) { fired = false; e.stopPropagation(); e.preventDefault(); } }, true);
    root.addEventListener('contextmenu', e => { if (e.target.closest && e.target.closest(selector)) e.preventDefault(); });
  }

  // ── カードの見た目 ─────────────────────────────────────────
  function monCell(t, cls) {   // チームのモンスター1マス（タップでステータス）
    if (!t) return '<span class="frc-mon empty"></span>';
    const mon = MONSTER_DATA[t.m];
    return `<button type="button" class="frc-mon ${cls || ''}" data-act="mon" data-m="${t.m}" data-lv="${t.lv}" data-attr="${esc(mon.attr)}" aria-label="${esc(mon.name)} Lv${t.lv}">${imgTag(monImg(mon), 'frc-mon-img', mon.name)}<i>Lv.${t.lv}</i></button>`;
  }
  function cardHTML(c) {
    const fav = c.fav && MONSTER_DATA[c.fav];
    const pid = String(c.pid || '').toUpperCase();
    const h = c.helper, hm = h && MONSTER_DATA[h.m];
    const st = hm ? calcMonsterStats({ monsterId: h.m, level: h.lv }) : null;
    return `<div class="frc" data-attr="${esc(c.attr)}">` +
      `<div class="frc-head"><span class="frc-attr"><img src="${ATTR_NO[c.attr]}.png" alt="${esc(ATTR_JP[c.attr])}" draggable="false" onerror="${HIDE_ERR}"></span>` +
        `<span class="frc-name">${esc(c.name)}</span><span class="frc-id">ID ${esc(pid.slice(0, 4))}-${esc(pid.slice(4, 8))}</span></div>` +
      `<div class="frc-stage">${fav ? bigImgTag(fav, 'frc-fav') + `<span class="frc-fav-name">${esc(fav.name)}</span>` : '<span class="frc-fav-none">？</span>'}</div>` +
      `<div class="frc-info">` +
        `<div class="frc-row"><span class="k">現在地</span><span class="v">エリア${c.area}${c.areaName ? ' ' + esc(c.areaName) : ''}<em class="${c.areaClear ? 'clear' : ''}">${c.areaClear ? 'クリア済み' : '挑戦中'}</em></span></div>` +
        `<div class="frc-row"><span class="k">図鑑</span><span class="v"><b>${c.zukan}</b> / ${c.zukanTotal}</span></div>` +
        `<div class="frc-row cm"><span class="k">コメント</span><span class="v">${c.comment ? esc(c.comment) : '<span class="none">（なし）</span>'}</span></div>` +
      `</div>` +
      `<div class="frc-sec">チーム1</div>` +
      `<div class="frc-team">${c.team.map(t => monCell(t)).join('')}</div>` +
      `<div class="frc-sec">助っ人</div>` +
      (hm ? `<div class="frc-helper">${monCell({ m: h.m, lv: h.lv }, 'big')}<div class="frc-hinfo"><b>${esc(hm.name)}</b>` +
              `<small>HP ${st.hp.toLocaleString()} ／ 攻撃 ${st.atk.toLocaleString()} ／ 回復 ${st.rec.toLocaleString()}</small>` +
              `<small>スキル：${esc((hm.skill && hm.skill.name) || 'なし')}</small>` +
              `<small>リーダースキル：${esc((hm.leaderSkill && hm.leaderSkill.name) || 'なし')}</small></div></div>`
          : '<div class="frc-nohelper">助っ人は設定されていません</div>') +
    `</div>`;
  }

  // ── ダイアログ・お知らせ ───────────────────────────────────
  function confirmBox(o) {
    const m = document.createElement('div');
    m.className = 'fr-modal';
    m.innerHTML = `<div class="fr-dialog" role="dialog" aria-modal="true"><div class="fr-dtitle">${esc(o.title || '')}</div><p class="fr-dmsg">${esc(o.msg || '').replace(/\n/g, '<br>')}</p>` +
      `<div class="fr-dbtns"><button type="button" class="btn" data-x="no">${esc(o.no || 'やめる')}</button><button type="button" class="btn ${o.danger ? 'btn-danger' : 'btn-primary'}" data-x="ok">${esc(o.ok || 'OK')}</button></div></div>`;
    m.addEventListener('click', e => {
      const x = e.target.closest('[data-x]');
      if (e.target === m || (x && x.dataset.x === 'no')) { modo(); m.remove(); }
      else if (x && x.dataset.x === 'ok') { m.remove(); if (o.onOk) o.onOk(); }
    });
    document.body.appendChild(m);
  }
  let toastTimer = null;
  function toast(msg) {
    const t = $('fr-toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }
  function notify(msg) {   // 画面に合わせて知らせる（出撃準備／ホーム／フレンド画面）
    try {
      if (isShown('friend-screen')) toast(msg);
      else if (isShown('dungeon-entry') && typeof deToast === 'function') deToast(msg, 2800);
      else if (typeof homeToast === 'function') homeToast(msg, 2800);
    } catch (e) {}
  }

  // ── フレンド画面 ───────────────────────────────────────────
  //   view: home（マイカード）／ edit ／ pickFav ／ helper ／ pickHelper ／ list ／ detail
  let built = false, view = 'home', body = null, actions = null;
  let draft = null, curPid = null;
  const favFilter = new Set(), helpFilter = new Set();
  let helpSort = null;
  const PARENT = { edit: 'home', pickFav: 'edit', helper: 'home', pickHelper: 'helper', list: 'home', detail: 'list' };
  const TITLE = { home: 'フレンド', edit: 'マイカード編集', pickFav: '好きなモンスター', helper: '助っ人設定', pickHelper: '助っ人にするモンスター', list: 'フレンド', detail: 'フレンドのカード' };

  function build() {
    if (built) return;
    built = true;
    const el = document.createElement('div');
    el.id = 'friend-screen';
    el.className = 'ui-screen';
    el.innerHTML = '<div id="fr-header" class="bar"><span id="fr-title" class="title-mark">フレンド</span></div>' +
      '<div id="fr-body"></div>' +
      '<div id="fr-dock" class="dock"><button id="fr-back" class="btn-back" type="button" aria-label="戻る"><svg class="ic"><use href="#i-back"/></svg></button><div id="fr-actions"></div></div>' +
      '<div id="fr-toast"></div>';
    document.body.appendChild(el);
    body = $('fr-body'); actions = $('fr-actions');
    $('fr-back').addEventListener('click', () => { modo(); back(); });
    el.addEventListener('click', onClick);
    el.addEventListener('input', onInput);
    onLongPress(body, '.fr-cell[data-uid]', c => {   // 助っ人にするモンスターを長押し → いまのステータス（見るだけ）
      const e = box.find(b => String(b.uid) === c.dataset.uid && !b._helper);
      if (e && typeof previewEntryDetail === 'function') previewEntryDetail(e, 'モンスター詳細');
    });
    if (typeof BoxSort !== 'undefined') helpSort = BoxSort.makeState('fr', BoxSort.MODES.map(m => m.id).filter(id => id !== 'exp'), false);
  }
  function open() {
    build();
    ensureMe();
    view = 'home'; draft = null;
    render();
    $('friend-screen').style.display = 'flex';
  }
  function close() { const el = $('friend-screen'); if (el) el.style.display = 'none'; }
  function go(v, keepScroll) { view = v; render(keepScroll); }
  function back() { if (view === 'home') close(); else go(PARENT[view] || 'home'); }
  function render(keepScroll) {
    if (!built) return;
    $('fr-title').textContent = TITLE[view] || 'フレンド';
    actions.innerHTML = '';
    const top = body.scrollTop;
    ({ home: renderHome, edit: renderEdit, pickFav: renderPickFav, helper: renderHelper, pickHelper: renderPickHelper, list: renderList, detail: renderDetail }[view] || renderHome)();
    body.scrollTop = keepScroll ? top : 0;
  }
  const actBtn = (label, act, cls) => `<button type="button" class="btn ${cls || 'btn-primary'} btn-cta fr-act" data-act="${act}">${label}</button>`;

  // ホーム：マイカード＋3つのメニュー
  function renderHome() {
    const c = myCard(), h = S.helper, hm = h && MONSTER_DATA[h.m];
    body.innerHTML = `<div class="fr-cardwrap">${cardHTML(c)}</div>` +
      `<div class="fr-menu">` +
        `<button type="button" class="fr-menu-btn edit" data-act="go" data-to="edit"><span class="fr-mi">${IC.pen}</span><span class="fr-mt"><b>マイカードを編集</b><small>名前・好きな属性・好きなモンスター・コメント</small></span>${IC.chev}</button>` +
        `<button type="button" class="fr-menu-btn helper" data-act="go" data-to="helper"><span class="fr-mi">${IC.shield}</span><span class="fr-mt"><b>助っ人を設定</b><small>${hm ? esc(hm.name) + ' Lv.' + h.lv : 'まだ設定していません'}</small></span>${IC.chev}</button>` +
        `<button type="button" class="fr-menu-btn friend" data-act="go" data-to="list"><span class="fr-mi">${IC.team}</span><span class="fr-mt"><b>フレンド</b><small>${S.friends.length} / ${MAX_FRIENDS}人 ・ 募集してカードを交換</small></span>${IC.chev}</button>` +
      `</div>`;
  }

  // マイカードの編集
  function draftCard() { return Object.assign(myCard(), { name: draft.name || 'ななしさん', attr: draft.attr, fav: draft.fav, comment: draft.comment }); }
  function renderEdit() {
    ensureMe();
    if (!draft) draft = { name: S.me.name, attr: S.me.attr, fav: S.me.fav, comment: S.me.comment };
    const fav = draft.fav && MONSTER_DATA[draft.fav];
    body.innerHTML = `<div class="fr-cardwrap" id="fr-edit-preview">${cardHTML(draftCard())}</div>` +
      `<div class="fr-form">` +
        `<label class="fr-field"><span class="fr-lb">名前<small>（${NAME_MAX}文字まで）</small></span><input id="fr-in-name" type="text" maxlength="${NAME_MAX}" value="${esc(draft.name)}" autocomplete="off"></label>` +
        `<div class="fr-field"><span class="fr-lb">好きな属性</span><div class="fr-attrs">` +
          ATTRS.map(a => `<button type="button" class="fr-attr-btn${draft.attr === a ? ' on' : ''}" data-act="attr" data-a="${a}" data-attr="${a}" aria-label="${ATTR_JP[a]}" aria-pressed="${draft.attr === a}"><img src="${ATTR_NO[a]}.png" alt="${ATTR_JP[a]}" draggable="false" onerror="${HIDE_ERR}"></button>`).join('') +
        `</div></div>` +
        `<div class="fr-field"><span class="fr-lb">好きなモンスター<small>（図鑑にゲットずみから）</small></span>` +
          `<button type="button" class="fr-favbtn" data-act="go" data-to="pickFav">${fav ? imgTag(monImg(fav), 'fr-favic', fav.name) + `<b>${esc(fav.name)}</b>` : '<b>えらぶ</b>'}<span class="fr-favgo">変える${IC.chev}</span></button></div>` +
        `<label class="fr-field"><span class="fr-lb">コメント<small>（${COMMENT_MAX}文字まで）</small></span><input id="fr-in-comment" type="text" maxlength="${COMMENT_MAX}" value="${esc(draft.comment)}" placeholder="ひとこと" autocomplete="off"></label>` +
        `<p class="fr-note">現在地・図鑑数・チーム1・助っ人は、自動でカードに入ります。</p>` +
      `</div>`;
    actions.innerHTML = actBtn('保存する', 'save');
  }
  function onInput(e) {
    if (view !== 'edit' || !draft) return;
    if (e.target.id === 'fr-in-name') draft.name = clip(e.target.value, NAME_MAX);
    else if (e.target.id === 'fr-in-comment') draft.comment = clip(e.target.value, COMMENT_MAX);
    else return;
    const p = $('fr-edit-preview');
    if (p) p.innerHTML = cardHTML(draftCard());
  }

  // 好きなモンスターをえらぶ（図鑑にゲットずみのモンスター）
  function attrFilterRow(set, act) {
    return `<div class="fr-filter">${ATTRS.map(a => `<button type="button" class="fr-fbtn${set.has(a) ? ' on' : ''}" data-act="${act}" data-a="${a}" aria-label="${ATTR_JP[a]}" aria-pressed="${set.has(a)}"><img src="${ATTR_NO[a]}.png" alt="${ATTR_JP[a]}" draggable="false" onerror="${HIDE_ERR}"></button>`).join('')}</div>`;
  }
  function renderPickFav() {
    try { if (global.Zukan && Zukan.syncOwned) Zukan.syncOwned(); } catch (e) {}
    const ids = (global.Zukan && Zukan.ownedIds) ? Zukan.ownedIds() : [];
    const list = ids.filter(id => { const m = MONSTER_DATA[id]; return m && (!favFilter.size || favFilter.has(m.attr) || (m.sub && favFilter.has(m.sub))); });
    body.innerHTML = `<div class="fr-tools">${attrFilterRow(favFilter, 'ffav')}<span class="fr-count">ゲットずみ <b>${list.length}</b>体</span></div>` +
      (list.length ? `<div class="fr-grid">${list.map(id => {
        const m = MONSTER_DATA[id];
        return `<button type="button" class="fr-cell${draft && draft.fav === id ? ' on' : ''}" data-act="fav" data-id="${id}" data-attr="${esc(m.attr)}" aria-label="${esc(m.name)}">${`<img class="fr-cell-img" loading="lazy" decoding="async" src="${esc(monImg(m))}" alt="${esc(m.name)}" draggable="false" onerror="${HIDE_ERR}">`}<i class="no">${String(id).padStart(3, '0')}</i></button>`;
      }).join('')}</div>` : '<div class="fr-empty">該当するモンスターがいません</div>');
    actions.innerHTML = '<span class="fr-hint">タップで決める</span>';
  }

  // 助っ人の設定
  function renderHelper() {
    const h = S.helper, hm = h && MONSTER_DATA[h.m];
    let cur;
    if (hm) {
      const st = calcMonsterStats({ monsterId: h.m, level: h.lv });
      cur = `<div class="fr-hcard" data-attr="${esc(hm.attr)}"><button type="button" class="frc-mon big" data-act="mon" data-m="${h.m}" data-lv="${h.lv}" data-attr="${esc(hm.attr)}" aria-label="${esc(hm.name)}">${imgTag(monImg(hm), 'frc-mon-img', hm.name)}<i>Lv.${h.lv}</i></button>` +
        `<div class="frc-hinfo"><b>${esc(hm.name)}</b><small>HP ${st.hp.toLocaleString()} ／ 攻撃 ${st.atk.toLocaleString()} ／ 回復 ${st.rec.toLocaleString()}</small>` +
        `<small>スキル：${esc((hm.skill && hm.skill.name) || 'なし')}</small><small>リーダースキル：${esc((hm.leaderSkill && hm.leaderSkill.name) || 'なし')}</small>` +
        `<small class="when">${h.ts ? fmtDate(h.ts) + ' に設定' : ''}</small></div></div>`;
    } else {
      cur = '<div class="fr-empty">助っ人はまだ設定されていません</div>';
    }
    body.innerHTML = `<div class="fr-sec-title">いまの助っ人</div>${cur}` +
      `<div class="fr-notebox"><b>助っ人のルール</b><ul>` +
        `<li>フレンドがダンジョンに入るとき、あなたの助っ人を「フレンド」として使えます。</li>` +
        `<li>Lv・プラス値は<b>設定したときのまま</b>です。ボックスのモンスターを育てても、助っ人は変わりません（変えたいときは、設定しなおします）。</li>` +
        `<li>フレンドの助っ人は1人につき1匹。設定しなおすと、次の更新（フレンド募集・マルチでのマッチ）で相手の助っ人が上書きされます。</li>` +
      `</ul></div>`;
    actions.innerHTML = actBtn(hm ? '助っ人を変える' : '助っ人を選ぶ', 'hpickgo') + (hm ? '<button type="button" class="btn fr-act-sub" data-act="hclear">やめる</button>' : '');
  }
  function renderPickHelper(keepScroll) {
    const ctx = { monsters: MONSTER_DATA, stats: calcMonsterStats };
    const filtered = box.filter(e => { if (e._helper) return false; const m = MONSTER_DATA[e.monsterId]; return !!m && BoxSort.attrMatchRank(m, helpFilter) >= 0; });
    const sorted = BoxSort.groupByAttrMatch(BoxSort.sort(filtered, helpSort, ctx), helpFilter, MONSTER_DATA);
    body.innerHTML = `<div class="fr-tools">${attrFilterRow(helpFilter, 'fhelp')}<button type="button" class="btn btn-sm fr-sortbtn" data-act="hsort"><span>${esc(BoxSort.buttonLabel(helpSort))}</span>${IC.down}</button></div>` +
      (sorted.length ? `<div class="fr-grid" id="fr-help-grid">${sorted.map(e => {
        const m = MONSTER_DATA[e.monsterId];
        return `<button type="button" class="fr-cell" data-act="hpick" data-uid="${e.uid}" data-attr="${esc(m.attr)}" aria-label="${esc(m.name)} Lv${e.level}">` +
          `<img class="fr-cell-img" loading="lazy" decoding="async" src="${esc(monImg(m))}" alt="${esc(m.name)}" draggable="false" onerror="${HIDE_ERR}"><i class="lv">Lv.${e.level}</i></button>`;
      }).join('')}</div>` : '<div class="fr-empty">該当するモンスターがいません</div>');
    const grid = $('fr-help-grid');
    if (grid) {
      let anyVal = false;
      grid.querySelectorAll('.fr-cell').forEach(cell => {
        const e = box.find(b => String(b.uid) === cell.dataset.uid);
        if (e && BoxSort.attachValue(cell, helpSort.mode, e, ctx)) anyVal = true;   // HP順などのとき数値を出す
      });
      grid.classList.toggle('has-val', anyVal);
    }
    actions.innerHTML = '<span class="fr-hint">タップで決める ／ 長押しでステータス</span>';
    if (keepScroll === true) { /* render() 側でスクロール位置を戻す */ }
  }
  function setHelperFromBox(uid) {
    const e = box.find(b => String(b.uid) === String(uid) && !b._helper);
    if (!e || !isMon(realId(e))) return false;
    const m = realId(e);
    S.helper = { m, lv: clamp(Math.floor(num(e.level, 1)) || 1, 1, maxLvOf(MONSTER_DATA[m])), sp: e.sp | 0, mem: e.memory | 0, ph: e.plusHp | 0, pa: e.plusAtk | 0, pr: e.plusRec | 0, ts: Date.now() };
    save();
    return true;
  }

  // フレンド一覧
  function renderList() {
    const rows = S.friends.slice().sort((a, b) => b.updated - a.updated);
    body.innerHTML = `<div class="fr-sec-title">フレンド <small>${S.friends.length} / ${MAX_FRIENDS}人</small></div>` +
      (rows.length ? `<div class="fr-rows">${rows.map(f => {
        const fm = f.fav && MONSTER_DATA[f.fav], hm = f.helper && MONSTER_DATA[f.helper.m];
        return `<button type="button" class="fr-row" data-act="friend" data-pid="${esc(f.pid)}" data-attr="${esc(f.attr)}">` +
          `<span class="fr-row-ic">${fm ? imgTag(monImg(fm), 'fr-row-img', fm.name) : ''}</span>` +
          `<span class="fr-row-main"><b><img class="fr-row-attr" src="${ATTR_NO[f.attr]}.png" alt="" draggable="false" onerror="${HIDE_ERR}">${esc(f.name)}</b>` +
            `<small>エリア${f.area} ・ 図鑑 ${f.zukan}</small><small class="cm">${f.comment ? esc(f.comment) : '&nbsp;'}</small></span>` +
          `<span class="fr-row-help">${hm ? `<span class="fr-row-hic" data-attr="${esc(hm.attr)}">${imgTag(monImg(hm), 'fr-row-img', hm.name)}</span><i>Lv.${f.helper.lv}</i>` : '<span class="fr-row-nh">助っ人<br>なし</span>'}</span>` +
          `</button>`;
      }).join('')}</div>` : `<div class="fr-empty">まだフレンドがいません<small>下の「フレンドを募集」で、ランダムにマッチした相手とマイカードを交換しよう！<br>マッチした相手の助っ人を、ダンジョンで使えるようになります。</small></div>`);
    actions.innerHTML = actBtn('フレンドを募集', 'recruit');
  }
  function renderDetail() {
    const f = findFriend(curPid);
    if (!f) { go('list'); return; }
    body.innerHTML = `<div class="fr-cardwrap">${cardHTML(f)}</div><p class="fr-note center">最後に更新：${fmtDate(f.updated)}　${f.pid === sel ? '（いま助っ人として使用中）' : ''}</p>`;
    actions.innerHTML = '<button type="button" class="btn btn-danger fr-act-sub wide" data-act="unfriend">フレンドをやめる</button>';
  }

  function onClick(e) {
    const t = e.target.closest && e.target.closest('[data-act]');
    const scr = $('friend-screen');
    if (!t || !scr || !scr.contains(t)) return;
    const d = t.dataset;
    switch (d.act) {
      case 'go':
        tap();
        if (d.to === 'edit') draft = null;   // 編集は、いまの値からやりなおし
        go(d.to);
        break;
      case 'attr': tap(); if (draft) { draft.attr = d.a; renderEdit(); body.scrollTop = body.scrollTop; } break;
      case 'save': {
        if (!draft) break;
        S.me.name = clip(draft.name, NAME_MAX) || 'ななしさん';
        S.me.attr = ATTRS.includes(draft.attr) ? draft.attr : 'fire';
        S.me.fav = isMon(draft.fav) ? draft.fav : S.me.fav;
        S.me.comment = clip(draft.comment, COMMENT_MAX);
        save(); draft = null; tap(); go('home'); toast('マイカードを保存しました');
        break;
      }
      case 'ffav': tap(); favFilter.has(d.a) ? favFilter.delete(d.a) : favFilter.add(d.a); render(true); break;
      case 'fav': tap(); if (draft) draft.fav = Number(d.id); go('edit'); break;
      case 'fhelp': tap(); helpFilter.has(d.a) ? helpFilter.delete(d.a) : helpFilter.add(d.a); render(true); break;
      case 'hsort': tap(); BoxSort.openSheet(scr, helpSort, () => render(false)); break;
      case 'hpickgo': tap(); go('pickHelper'); break;
      case 'hpick': {
        tap();
        const en = box.find(b => String(b.uid) === d.uid && !b._helper), mon = en && MONSTER_DATA[en.monsterId];
        if (!en || !mon) break;
        confirmBox({ title: '助っ人にする', msg: `「${mon.name}」Lv.${en.level} を助っ人にしますか？\nLv・プラス値は、いまの状態のまま固定されます。\n（いまの助っ人は入れ替わります）`, ok: '設定する',
          onOk: () => { if (setHelperFromBox(d.uid)) { tap(); go('helper'); toast('助っ人を設定しました'); } } });
        break;
      }
      case 'hclear':
        tap();
        confirmBox({ title: '助っ人をやめる', msg: '助っ人の設定を外します。\nフレンドは、次の更新から助っ人を借りられなくなります。', ok: 'やめる', danger: true,
          onOk: () => { S.helper = null; save(); renderHelper(); toast('助っ人をやめました'); } });
        break;
      case 'recruit': tap(); recruit(); break;
      case 'friend': tap(); curPid = d.pid; go('detail'); break;
      case 'unfriend': {
        tap();
        const f = findFriend(curPid);
        if (!f) break;
        confirmBox({ title: 'フレンドをやめる', msg: `「${f.name}」さんをフレンドから外しますか？\n（助っ人も使えなくなります）`, ok: '外す', danger: true,
          onOk: () => { removeFriend(f.pid); go('list'); toast('フレンドから外しました'); } });
        break;
      }
      case 'mon': {   // カードのモンスター → そのLvのステータス（見るだけ）
        tap();
        if (typeof previewEntryDetail === 'function' && isMon(Number(d.m))) previewEntryDetail({ monsterId: Number(d.m), level: Number(d.lv) }, 'モンスター詳細');
        break;
      }
    }
  }

  // ── フレンド募集（ランダムマッチ → カード交換） ─────────────
  let recruiting = null;
  function recruitOverlay() {
    const ov = document.createElement('div');
    ov.className = 'fr-modal fr-recruit';
    ov.innerHTML = '<div class="fr-rcard"><div class="fr-rsub">フレンド募集</div><div class="fr-rtitle">マイカードを交換</div><div class="fr-spin"></div>' +
      '<div class="fr-rmsg">フレンドをさがしています…</div><div class="fr-rtime"></div><div class="fr-rbtns"><button type="button" class="btn" data-x="cancel">キャンセル</button></div></div>';
    document.body.appendChild(ov);
    const q = s => ov.querySelector(s);
    return {
      el: ov,
      set(o) { if (o.msg != null) q('.fr-rmsg').textContent = o.msg; if (o.time != null) q('.fr-rtime').textContent = o.time; if (o.spin != null) q('.fr-spin').style.display = o.spin ? '' : 'none'; if (o.btn != null) q('[data-x="cancel"]').textContent = o.btn; },
      onCancel(fn) { q('[data-x="cancel"]').addEventListener('click', fn); },
      hide() { ov.remove(); }
    };
  }
  function recruit() {
    if (recruiting) return;
    if (S.friends.length >= MAX_FRIENDS) { toast('フレンドがいっぱいです（' + MAX_FRIENDS + '人）。フレンドを整理してね'); return; }
    const MO = global.MultiOnline;
    const ov = recruitOverlay();
    const run = { dead: false, tick: null, timer: null, leaveTimer: null, got: false, oppGot: false, myStr: JSON.stringify(packCard(myCard())) };
    recruiting = run;
    const t0 = Date.now();
    run.tick = setInterval(() => ov.set({ time: Math.floor((Date.now() - t0) / 1000) + ' 秒' }), 500);
    const finish = () => {   // 後かたづけ（部屋から退出）
      clearInterval(run.tick); clearTimeout(run.timer); clearTimeout(run.leaveTimer);
      if (recruiting === run) recruiting = null;
      try { if (MO) MO.leave(); } catch (e) {}
      if (view === 'list' || view === 'home') render(true);
    };
    const fail = (msg, sub) => {
      if (run.dead) return;
      run.dead = true;
      clearInterval(run.tick); clearTimeout(run.timer);
      ov.set({ spin: false, msg, time: sub || '', btn: '閉じる' });
      run.failed = true;
      try { if (MO) MO.leave(); } catch (e) {}
      if (recruiting === run) recruiting = null;
    };
    ov.onCancel(() => {
      if (run.failed) { ov.hide(); return; }
      if (run.dead) return;
      run.dead = true;
      try { if (MO) MO.cancelMatch(); } catch (e) {}
      ov.hide(); finish();
    });
    const onCard = v => {
      if (run.dead || !v) return;
      if (v.got) run.oppGot = true;
      if (v.c && !run.got) {
        const c = normCard(parseJson(v.c));
        if (!c) { fail('あいてのカードを読み込めませんでした'); return; }
        run.got = true;
        clearTimeout(run.timer);
        MO.sendCard(run.myStr, true);                      // 「受け取ったよ」の合図つきで、こちらのカードも置きなおす
        run.dead = true; clearInterval(run.tick);
        ov.hide();
        if (c.pid === S.pid) { confirmBox({ title: 'フレンド募集', msg: '自分自身とマッチしました。\nもういちど募集してね。', ok: 'OK', no: '閉じる' }); finish(); return; }
        const r = upsertFriend(c);
        if (!r) { confirmBox({ title: 'フレンド募集', msg: 'フレンドがいっぱいで追加できませんでした。\nフレンドを整理してね。', ok: 'OK', no: '閉じる' }); finish(); return; }
        showRecruitResult(c, r);
        refreshEntrySoon(c.pid, r);
        run.leaveTimer = setTimeout(finish, 6000);          // 相手も受け取るまで少し待ってから退出
      }
      if (run.got && run.oppGot) { clearTimeout(run.leaveTimer); run.leaveTimer = setTimeout(finish, 600); }
    };
    (async () => {
      try {
        if (!MO || !MO.available()) throw new Error('offline');
        const r = await MO.findMatch(RECRUIT_QUEUE);
        if (run.dead) { MO.enterRoom(r.room, r.seat, {}); MO.leave(); return; }   // マッチした瞬間にキャンセルされたとき：部屋だけ片づける
        ov.set({ spin: true, msg: 'マッチしました！ カードを交換中…', time: '' });
        MO.enterRoom(r.room, r.seat, { onCard });
        MO.sendCard(run.myStr, false);
        run.timer = setTimeout(() => { if (!run.got && !run.dead) fail('あいてからカードが届きませんでした', 'もういちど募集してね'); }, EXCHANGE_TIMEOUT_MS);
      } catch (e) {
        if (run.dead || (e && e.message === 'cancel')) return;
        fail('つうしんできませんでした', 'ネット接続を確認してね');
      }
    })();
  }
  function showRecruitResult(c, r) {
    const m = document.createElement('div');
    m.className = 'fr-modal fr-result';
    const title = r.isNew ? 'フレンドになりました！' : 'すでにフレンドです（最新に更新しました）';
    const hm = c.helper && MONSTER_DATA[c.helper.m];
    m.innerHTML = `<div class="fr-resbox"><div class="fr-restitle">${esc(title)}</div><div class="fr-resbody">${cardHTML(c)}</div>` +
      `<p class="fr-resnote">${hm ? `${esc(c.name)}さんの助っ人「${esc(hm.name)}」を、ダンジョンの出撃準備で使えます` : `${esc(c.name)}さんは、まだ助っ人を設定していません`}</p>` +
      `<button type="button" class="btn btn-primary btn-cta" data-x="ok">OK</button></div>`;
    m.addEventListener('click', e => {
      const mb = e.target.closest('[data-act="mon"]');
      if (mb) { tap(); if (typeof previewEntryDetail === 'function') previewEntryDetail({ monsterId: Number(mb.dataset.m), level: Number(mb.dataset.lv) }, 'モンスター詳細'); return; }
      if (e.target === m || e.target.closest('[data-x="ok"]')) { modo(); m.remove(); }
    });
    document.body.appendChild(m);
  }

  // ── マルチ：ランダムマッチした相手のカードを、最新に更新 ────
  //   すでにフレンドの人だけ更新する（AUTO_ADD_MULTI_PARTNERS が true なら、まだの人も追加）
  function refreshEntrySoon(pid, r) {
    renderEntryList();
    if (r && sel === pid && r.helperChanged && isShown('dungeon-entry') && typeof renderDungeonEntry === 'function') renderDungeonEntry();   // 使おうとしていた助っ人が変わっていたら、編成にも反映
  }
  function onMultiRoomEntered() {
    try { if (global.MultiOnline) MultiOnline.sendCard(JSON.stringify(packCard(myCard())), false); } catch (e) {}
  }
  function onMultiCard(v) {
    if (!v || !v.c || !S) return;
    const c = normCard(parseJson(v.c));
    if (!c || c.pid === S.pid) return;
    const known = findFriend(c.pid);
    if (!known && !AUTO_ADD_MULTI_PARTNERS) return;
    if (known && c.ts && c.ts <= known.ts) return;   // もう反映ずみ（同じカードが2回届いたとき）
    const r = upsertFriend(c);
    if (!r) return;
    notify(r.isNew ? `「${c.name}」さんとフレンドになりました` : (r.helperChanged ? `フレンド「${c.name}」さんの助っ人が新しくなりました` : `フレンド「${c.name}」さんのカードを更新しました`));
    refreshEntrySoon(c.pid, r);
  }

  // ── 起動 ───────────────────────────────────────────────────
  S = load();
  save();
  global.Friends = {
    open, close,
    // game.js から
    injected: () => injected,
    team: base => { const t = base.slice(); if (injected) t[5] = HELPER_UID; return t; },
    syncParty: () => { inject(); },
    onRenderEntry: () => { inject(); renderEntryList(); },
    eject, release, focusList,
    onMultiRoomEntered, onMultiCard,
    // テスト・デバッグ用
    _state: () => S, _pickHelper: pickHelper, _select: pid => { sel = pid; }, _upsert: (t) => upsertFriend(normCard(t)), _pack: packCard, _myCard: myCard, _setHelperFromBox: setHelperFromBox,
    _recruit: recruit
  };
})(window);
