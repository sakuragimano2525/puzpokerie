// ============================================================
// ボーナス（ホーム右下のボタン）
//   押すと「竜石」「ガチャ」「フレンド」の3択。
//   ・竜石 … 竜石の所持数に応じた報酬ショップ（下の RYU_REWARDS）。竜石は消費せず、数が届いたら「もらう」で1回だけ受け取れる
//   ・ガチャ … 今までのガチャ画面（openGacha）
//   ・フレンド … マイカード・助っ人設定・フレンド募集（js/friends.js）
// ============================================================
(function () {
  'use strict';

  // ★ 竜石の報酬（need＝必要な竜石の数 ／ item＝アイテムID（ITEM_DATA のキー）か monster＝モンスターID ／ n＝個数）
  //   ※ 並べ替え・追加・変更はここを書き換えるだけ
  var RYU_REWARDS = [
    { need: 3,  item: 'ohuda1',   n: 1 },   // けいけんちのおふだ ×1
    { need: 6,  monster: 4005 },
    { need: 9,  monster: 4006 },
    { need: 12, monster: 4007 },
    { need: 15, item: 'youbi',    n: 3 },   // ようびのおふだ ×3
    { need: 18, item: 'ohuda1',   n: 3 },   // けいけんちのおふだ ×3
    { need: 21, monster: 4008 },
    { need: 24, monster: 4009 },
    { need: 27, monster: 4010 }
  ];
  var CLAIM_KEY = 'puzzdra_ryuseki_claimed';   // 受け取りずみの need の一覧（localStorage）

  var menu = null, info = null;
  var claimed = new Set();
  try { JSON.parse(localStorage.getItem(CLAIM_KEY) || '[]').forEach(function (k) { claimed.add(Number(k)); }); } catch (e) {}
  function saveClaimed() { try { localStorage.setItem(CLAIM_KEY, JSON.stringify(Array.from(claimed))); } catch (e) {} }

  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function host() { return document.body; }   // ※ホーム中は #game が非表示なので、body に直接置く
  function close(m) { if (m && m.parentNode) m.parentNode.removeChild(m); }
  function closeAll() { close(menu); close(info); menu = info = null; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function ryusekiCount() { try { return window.Ryuseki ? Ryuseki.count() : 0; } catch (e) { return 0; } }
  function ryusekiTotal() { try { return window.Ryuseki ? Ryuseki.total() : 0; } catch (e) { return 0; } }
  function ryuImg() { return (window.Ryuseki && Ryuseki.imgSrc) || 'rst.png'; }

  // 報酬の表示（名前・画像・個数）
  function describe(r) {
    if (r.monster) {
      var m = (typeof MONSTER_DATA !== 'undefined') && MONSTER_DATA[r.monster];
      var src = m ? (typeof monsterImg === 'function' ? monsterImg(m) : (m.img || ('m' + m.id + '.png'))) : ('m' + r.monster + '.png');
      return { name: m ? m.name : ('ID' + r.monster), img: src, qty: '', kind: 'mon' };
    }
    var d = (typeof ITEM_DATA !== 'undefined') && ITEM_DATA[r.item];
    return { name: d ? d.name : r.item, img: d ? d.img : (r.item + '.png'), qty: '×' + (r.n || 1), kind: 'item' };
  }

  function claimable(r) { return !claimed.has(r.need) && ryusekiCount() >= r.need; }
  function anyClaimable() { return RYU_REWARDS.some(claimable); }

  // 実際に渡す
  function grant(r) {
    if (r.monster) {
      if (typeof MONSTER_DATA === 'undefined' || !MONSTER_DATA[r.monster]) return false;
      box.push({ uid: nextUid++, monsterId: r.monster, level: 1, exp: 0, sp: 0, memory: 0, plusHp: 0, plusAtk: 0, plusRec: 0 });
    } else {
      if (typeof ITEM_DATA === 'undefined' || !ITEM_DATA[r.item]) return false;
      itemInventory[r.item] = (itemInventory[r.item] || 0) + (r.n || 1);
    }
    return true;
  }
  function claim(r) {
    if (!claimable(r)) return;
    try {
      if (!grant(r)) { toast('受け取れませんでした'); return; }
      claimed.add(r.need); saveClaimed();
      try { saveGame(); } catch (e) {}
      try { if (typeof playSE === 'function') playSE('chip'); } catch (e) {}
      var d = describe(r);
      toast(d.name + (d.qty ? ' ' + d.qty : '') + ' をもらいました！');
    } catch (e) { console.warn('[ryuseki reward]', e); toast('受け取れませんでした'); return; }
    openRyuseki();   // 表示を更新
    refreshBadge();
  }

  function toast(msg) {
    if (typeof homeToast === 'function') { try { homeToast(msg, 2000); } catch (e) {} }
    var t = el('<div class="bn-toast">' + esc(msg) + '</div>');
    host().appendChild(t);
    setTimeout(function () { close(t); }, 2000);
  }

  // ホームのボタン・メニューの赤丸（もらえる報酬があるとき）
  function refreshBadge() {
    try {
      var b = document.querySelector('#btn-gacha .hh-badge');
      if (b) b.style.display = anyClaimable() ? 'block' : 'none';
      var d = menu && menu.querySelector('.bn-dot');
      if (d) d.style.display = anyClaimable() ? 'block' : 'none';
    } catch (e) {}
  }

  // ボーナスボタンの真上に、竜石・ガチャ・フレンド の3つのボタンを出す（画面の外やボタン以外をタップすると閉じる）
  function openMenu() {
    closeAll();
    menu = el(
      '<div class="bn-pop-back" role="dialog" aria-label="ボーナス">' +
        '<div class="bn-pop">' +
          '<button type="button" class="bn-btn ryu" id="bn-ryu"><img src="' + ryuImg() + '" alt="" onerror="this.style.visibility=\'hidden\'"><span>竜石</span><b>×' + ryusekiCount() + '</b><i class="bn-dot"></i></button>' +
          '<button type="button" class="bn-btn gacha" id="bn-gacha"><svg class="ic"><use href="#i-gacha"/></svg><span>ガチャ</span></button>' +
          '<button type="button" class="bn-btn friend" id="bn-friend"><svg class="ic"><use href="#i-team"/></svg><span>フレンド</span></button>' +
        '</div>' +
      '</div>');
    menu.addEventListener('click', function (e) { if (e.target === menu) closeAll(); });
    menu.querySelector('#bn-ryu').addEventListener('click', function () { close(menu); menu = null; openRyuseki(); });
    menu.querySelector('#bn-gacha').addEventListener('click', function () {
      closeAll();
      if (typeof openGacha === 'function') openGacha();
      else if (window.GachaScreen) GachaScreen.open();
    });
    menu.querySelector('#bn-friend').addEventListener('click', function () {
      closeAll();
      if (window.Friends) Friends.open();
      else toast('フレンドは準備中です');
    });
    host().appendChild(menu);
    placePop();
    refreshBadge();
  }
  function placePop() {
    try {
      var pop = menu.querySelector('.bn-pop'), btn = document.getElementById('btn-gacha');
      if (!pop || !btn) return;
      var r = btn.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
      var w = Math.max(r.width, 150);
      pop.style.width = w + 'px';
      var left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), vw - w - 8);   // ボタンの真上（画面からはみ出さないように）
      pop.style.left = left + 'px';
      pop.style.bottom = Math.max(8, vh - r.top + 10) + 'px';
    } catch (e) {}
  }
  window.addEventListener('resize', function () { if (menu) placePop(); });

  // モンスターの画像を長押し → ボックスと同じ詳細画面で Lv1 のステータス・スキルを見る（js/game.js の previewMonsterDetail。ガチャのラインナップと同じ）
  var LP_MS = 350, LP_MOVE = 10;
  function bindLongPress(cell, id, ids) {
    var timer = null, sx = 0, sy = 0;
    function cancel() { if (timer) { clearTimeout(timer); timer = null; } }
    cell.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      cancel(); sx = e.clientX; sy = e.clientY;
      timer = setTimeout(function () {
        timer = null;
        try { if (navigator.vibrate) navigator.vibrate(18); } catch (err) {}
        if (typeof previewMonsterDetail === 'function') previewMonsterDetail(ids, id);
      }, LP_MS);
    });
    cell.addEventListener('pointermove', function (e) { if (timer && (Math.abs(e.clientX - sx) > LP_MOVE || Math.abs(e.clientY - sy) > LP_MOVE)) cancel(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { cell.addEventListener(t, cancel); });
    cell.addEventListener('contextmenu', function (e) { e.preventDefault(); });   // 長押しで出る「画像を保存」などのメニューを出さない
    cell.addEventListener('dragstart', function (e) { e.preventDefault(); });
  }

  // 竜石ショップ
  function openRyuseki() {
    close(info);
    var n = ryusekiCount(), t = ryusekiTotal();
    var rows = RYU_REWARDS.map(function (r, i) {
      var d = describe(r), done = claimed.has(r.need), ok = claimable(r);
      var btn = done ? '<button type="button" class="bn-get done" disabled>もらった</button>'
              : ok   ? '<button type="button" class="bn-get" data-i="' + i + '">もらう</button>'
                     : '<button type="button" class="bn-get lock" disabled>もらう</button>';
      return '<div class="bn-item' + (done ? ' done' : '') + '">' +
          '<div class="bn-ico ' + d.kind + '"' + (r.monster ? ' data-mid="' + r.monster + '"' : '') + '><img src="' + esc(d.img) + '" alt="" onerror="this.style.visibility=\'hidden\'"></div>' +
          '<div class="bn-info"><div class="bn-name">' + esc(d.name) + (d.qty ? ' <em>' + d.qty + '</em>' : '') + '</div>' +
            '<div class="bn-need"><img src="' + ryuImg() + '" alt="" onerror="this.style.display=\'none\'">竜石×' + r.need + '</div></div>' +
          btn +
        '</div>';
    }).join('');
    info = el(
      '<div class="bn-back" role="dialog" aria-label="竜石">' +
        '<div class="bn-box wide">' +
          '<div class="bn-title">竜石</div>' +
          '<div class="bn-count"><img src="' + ryuImg() + '" alt="" onerror="this.style.visibility=\'hidden\'"><b>×' + n + '</b><small>/ ' + t + '</small></div>' +
          '<div class="bn-list">' + rows + '</div>' +
          '<button type="button" class="bn-close" id="bn-ryu-close">もどる</button>' +
        '</div>' +
      '</div>');
    info.addEventListener('click', function (e) { if (e.target === info) { close(info); info = null; } });
    info.querySelector('#bn-ryu-close').addEventListener('click', function () { close(info); info = null; refreshBadge(); });
    var mids = RYU_REWARDS.filter(function (r) { return r.monster; }).map(function (r) { return r.monster; });
    info.querySelectorAll('.bn-ico[data-mid]').forEach(function (c) { bindLongPress(c, Number(c.getAttribute('data-mid')), mids); });
    info.querySelectorAll('.bn-get[data-i]').forEach(function (b) {
      b.addEventListener('click', function () { claim(RYU_REWARDS[Number(b.getAttribute('data-i'))]); });
    });
    host().appendChild(info);
  }

  window.BonusMenu = { open: openMenu, refreshBadge: refreshBadge };
  setInterval(refreshBadge, 2000);
  setTimeout(refreshBadge, 800);
})();
