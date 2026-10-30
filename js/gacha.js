// ============================================================
// ガチャ画面（ホームの「ガチャ」ボタンから開く）
//   index.html の #gacha-screen ／ css/gacha.css ／ js/data/gacha.js（設定）とセット
//
//   しくみ
//     ・「まわす」… ガチャコイン（GACHA_DATA.coin）を cost 枚つかい、lineup の中から同じ確率で1匹えらぶ
//                   → BOX に入れて保存 → つまみが回り、カプセル（灰・青・赤・金のどれか）が取り出し口に落ちる
//                   → 外にころがり出て画面中央へ → タップで開く → 結果を表示
//     ・「ラインナップ」… 出るモンスターの一覧を表示
//     ・コインが足りないときは何も消費せず「ガチャコインが足りません」
//
//   外から使うもの
//     GachaScreen.open() / close() / isOpen()
//     GachaScreen.setTitle('名前')   左上のガチャ名を変える（ふだんは GACHA_DATA.title）
//     GachaScreen.refresh()          コインの数などを表示し直す
// ============================================================
(function () {
  'use strict';
  var screen = document.getElementById('gacha-screen');
  if (!screen) return;
  var $ = function (id) { return document.getElementById(id); };

  var cfg = (typeof GACHA_DATA !== 'undefined' && GACHA_DATA) || { title: 'ガチャ', coin: 'fcoin', cost: 1, lineup: [] };
  var COIN = cfg.coin || 'fcoin';
  var COST = Math.max(1, Math.floor(Number(cfg.cost)) || 1);
  var SPIN_MS = 900;          // 「まわす」の動きの長さ（css/gacha.css の 0.9s と合わせる）
  var busy = false;
  var toastTimer = null;
  var seq = null, runId = 0;   // カプセル演出の進行状況（runId が変わったら古い演出は止まる）

  // ── 設定の読み取り ───────────────────────────
  function lineup() {   // monsters.js に無いIDは除く
    return (cfg.lineup || []).filter(function (id) { return typeof MONSTER_DATA !== 'undefined' && MONSTER_DATA[id]; });
  }
  // 実際に抽選に入るモンスター：cfg.requires の条件（図鑑に登録済み）を満たしているものだけ（隠し条件）
  function drawable() {
    try { if (window.Zukan && Zukan.syncOwned) Zukan.syncOwned(); } catch (e) {}
    var req = cfg.requires || {};
    return lineup().filter(function (id) {
      var need = req[id];
      if (!need || !need.length) return true;
      return need.every(function (n) { return !!(window.Zukan && Zukan.isOwned(n)); });
    });
  }
  function coinCount() { return typeof getItemCount === 'function' ? getItemCount(COIN) : 0; }
  function coinName() { return (typeof ITEM_DATA !== 'undefined' && ITEM_DATA[COIN] && ITEM_DATA[COIN].name) || 'ガチャコイン'; }
  function coinImg() { return (typeof ITEM_DATA !== 'undefined' && ITEM_DATA[COIN] && ITEM_DATA[COIN].img) || 'fcoin.png'; }
  function stars(n) { var s = ''; for (var i = 0; i < n; i++) s += '★'; return s; }

  // ── 表示の更新 ────────────────────────────────
  function refresh() {
    var n = coinCount();
    var numEl = $('gacha-coin-num'), chip = $('gacha-coin'), cost = $('gacha-spin-cost');
    if (numEl) numEl.textContent = '×' + n.toLocaleString();
    if (chip) chip.classList.toggle('empty', n < COST);
    if (cost) cost.classList.toggle('short', n < COST);
    var ct = $('gacha-cost-txt'); if (ct) ct.textContent = coinName() + ' ×' + COST;
    ['gacha-coin-img', 'gacha-cost-img'].forEach(function (id) { var im = $(id); if (im) { var src = coinImg(); if (im.getAttribute('src') !== src) im.setAttribute('src', src); } });
  }

  function toast(msg, ms) {
    var el = $('gacha-toast'); if (!el) return;
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, ms || 1600);
  }

  // モンスター1体ぶんの四角いタイル（属性色の下地＋画像）
  function monTile(mon, cls) {
    var d = document.createElement('div');
    d.className = cls; d.dataset.attr = mon.attr || 'water';
    var img = document.createElement('img');
    img.alt = mon.name; img.src = (typeof monsterImg === 'function') ? monsterImg(mon) : ('m' + mon.id + '.png');
    img.onerror = function () { img.style.visibility = 'hidden'; };
    d.appendChild(img);
    return d;
  }

  // ── ラインナップ ─────────────────────────────
  function openLineup() {
    var grid = $('gacha-lineup-grid'); if (!grid) return;
    grid.innerHTML = '';
    var ids = lineup();
    ids.forEach(function (id) {
      var mon = MONSTER_DATA[id];
      var cell = document.createElement('div'); cell.className = 'gs-lu-item';
      var tile = monTile(mon, 'gs-mon'); tile.dataset.q = '？';
      var st = document.createElement('span'); st.className = 'gs-lu-stars'; st.textContent = stars(mon.rarity || 1);
      var nm = document.createElement('span'); nm.className = 'gs-lu-name'; nm.textContent = mon.name;
      cell.appendChild(tile); cell.appendChild(st); cell.appendChild(nm);
      grid.appendChild(cell);
    });
    var sub = $('gacha-lineup-sub');
    if (sub) sub.textContent = ids.length ? ('この ' + ids.length + ' 体のどれか1匹が出ます（' + coinName() + ' ×' + COST + '）') : 'ラインナップは準備中です';
    $('gacha-lineup').hidden = false;
  }
  function closeLineup() { var m = $('gacha-lineup'); if (m) m.hidden = true; }

  // ── 結果 ─────────────────────────────────────
  function showResult(monsterId, isNew) {
    var mon = MONSTER_DATA[monsterId];
    var tile = $('gacha-res-tile'), img = $('gacha-res-img');
    tile.dataset.attr = mon.attr || 'water';
    img.style.visibility = ''; img.alt = mon.name;
    img.src = (typeof monsterImg === 'function') ? monsterImg(mon) : ('m' + mon.id + '.png');
    $('gacha-res-new').hidden = !isNew;
    $('gacha-res-stars').textContent = stars(mon.rarity || 1);
    $('gacha-res-name').textContent = mon.name;
    $('gacha-result').querySelector('.gs-card').classList.toggle('rare', (mon.rarity || 0) >= 4);
    $('gacha-result').hidden = false;
    try { if (typeof playSE === 'function') playSE('chip'); } catch (e) {}
  }
  function closeResult() { var m = $('gacha-result'); if (m) m.hidden = true; }

  // ── 画面の開閉 ───────────────────────────────
  function isOpen() { return screen.style.display === 'flex'; }
  function open() {
    busy = false;
    resetFx();
    closeLineup(); closeResult();
    var t = $('gacha-toast'); if (t) t.classList.remove('show');
    var ttl = $('gacha-title'); if (ttl && cfg.title) ttl.textContent = cfg.title;
    refresh();
    screen.style.display = 'flex';
  }
  function close() {
    clearTimeout(toastTimer);
    resetFx();
    busy = false;
    closeLineup(); closeResult();
    screen.style.display = 'none';
  }


  // ── カプセル演出 ─────────────────────────────
  //   1. つまみが回ってマシンがゆれる（css の .spinning）
  //   2. カプセルが取り出し口の上から落ちて、中でポンとはずむ（マシンの SVG の中）
  //   3. 手前にころがり出て、地面ではずんで、画面中央へ（#gacha-stage の上）
  //   4. ゆれながら「タップ！」待ち（4秒でじどうで開く） → パカッと割れて光 → 結果
  //   途中で画面をタップすると、タップ待ちまで飛ばせます
  var DEFAULT_CAPS = [
    { id: 'gray', color: '#8e98aa', weight: 1 }, { id: 'blue', color: '#2b86ff', weight: 1 },
    { id: 'red',  color: '#ff5a3d', weight: 1 }, { id: 'gold', color: '#ffb400', weight: 1 }
  ];
  var RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var machine = screen.querySelector('.gs-machine');
  var stage = $('gacha-stage'), obj = $('gacha-obj'), capSvg = $('gacha-capsvg'), tapEl = $('gacha-tap'), fxEl = $('gacha-fx');
  var drop = $('gm-drop'), dropCap = $('gm-drop-cap'), peek = $('gm-peek');
  var FX_OK = !RM && !!(machine && stage && obj && capSvg && tapEl && fxEl && drop && dropCap && machine.getScreenCTM && Element.prototype.animate);

  var OUT_X = 163, OUT_REST_Y = 252, GROUND_Y = 300;   // マシンSVGの中の座標（取り出し口のまんなか／地面）
  var E = 120;                                         // .gc-obj の箱の大きさ（css と同じ）
  var CAP_D = E * 34 / 48;                             // scale 1 のときのカプセルの直径(px)

  function pickCapsule() {
    var list = (cfg.capsules && cfg.capsules.length) ? cfg.capsules : DEFAULT_CAPS;
    var total = 0;
    list.forEach(function (c) { total += Math.max(0, c.weight == null ? 1 : Number(c.weight) || 0); });
    if (total <= 0) return list[0];
    var r = Math.random() * total;
    for (var i = 0; i < list.length; i++) {
      r -= Math.max(0, list[i].weight == null ? 1 : Number(list[i].weight) || 0);
      if (r < 0) return list[i];
    }
    return list[list.length - 1];
  }
  function se(name, rate) { try { if (typeof playSE === 'function') playSE(name, rate); } catch (e) {} }

  // マシンSVGの座標 → 演出ステージの座標（k = SVGの1が何pxか）
  function toStage(x, y) {
    var m = machine.getScreenCTM(), pt = machine.createSVGPoint();
    pt.x = x; pt.y = y;
    var p = pt.matrixTransform(m), r = screen.getBoundingClientRect(), sc = (r.width / screen.offsetWidth) || 1;
    return { x: (p.x - r.left) / sc, y: (p.y - r.top) / sc, k: Math.sqrt(m.a * m.a + m.b * m.b) / sc };
  }
  // カプセルの箱の transform：中心が (x,y)、大きさ s 倍、rot 度、つぶれ sx/sy
  function tf(x, y, s, rot, sx, sy) {
    return 'translate(' + (x - E / 2) + 'px,' + (y - E / 2) + 'px) scale(' + (s * (sx || 1)) + ',' + (s * (sy || 1)) + ') rotate(' + (rot || 0) + 'deg)';
  }

  // 演出のあとかたづけ（開くとき・閉じるとき・演出が終わったとき）
  function resetFx() {
    runId++;
    if (seq) {
      clearTimeout(seq.timer);
      seq.anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
      seq = null;
    }
    if (stage) { stage.hidden = true; stage.style.pointerEvents = ''; }
    if (obj) { obj.classList.remove('wait'); obj.style.opacity = ''; obj.style.transform = ''; }
    if (tapEl) { tapEl.classList.remove('show'); tapEl.style.opacity = ''; }
    if (fxEl) fxEl.innerHTML = '';
    if (drop) { drop.style.display = 'none'; drop.style.transform = ''; }
    if (peek) peek.style.display = '';
    screen.classList.remove('spinning');
  }

  // カプセル1回ぶんの演出。結果を出すタイミングで onResult() を呼ぶ
  async function runSequence(cap, onResult) {
    var my = ++runId;
    var st = seq = { anims: [], cur: null, timer: null, wake: null, skipped: false, ready: false, openNow: null };
    var alive = function () { return my === runId; };
    var color = cap.color, gold = cap.id === 'gold';

    // skipped のときは、時間をかけずに最後の状態にする
    function anim(el, frames, opts) {
      var o = { fill: 'forwards' };
      for (var k in opts) o[k] = opts[k];
      if (st.skipped) { o.duration = 0; o.delay = 0; }
      var a = el.animate(frames, o);
      st.anims.push(a); st.cur = a;
      return a.finished.then(function () {}, function () {});
    }
    function fx(el, frames, opts) {   // 光やつぶ（飛ばせない）
      var a = el.animate(frames, opts);
      st.anims.push(a);
      return a.finished.then(function () {}, function () {});
    }
    function wait(ms) {
      return new Promise(function (res) {
        if (st.skipped) return res();
        st.wake = res; st.timer = setTimeout(res, ms);
      });
    }
    st.skip = function () {
      st.skipped = true; clearTimeout(st.timer);
      st.anims.forEach(function (a) { try { a.finish(); } catch (e) {} });
      if (st.wake) st.wake();
    };

    // ── 1. つまみが回る ──
    screen.classList.add('spinning');
    peek.style.display = 'none';
    stage.hidden = false; stage.style.pointerEvents = '';
    obj.style.opacity = '0'; tapEl.style.opacity = '0'; fxEl.innerHTML = '';
    capSvg.style.color = color; obj.style.color = color; dropCap.style.color = color;
    await wait(650); if (!alive()) return;

    // ── 2. 取り出し口の上から落ちて、中ではずむ ──
    drop.style.transform = 'translate(' + OUT_X + 'px,203px) rotate(-25deg)';
    drop.style.display = '';
    await anim(drop, [
      { transform: 'translate(' + OUT_X + 'px,203px) rotate(-25deg)', easing: 'cubic-bezier(.5,0,1,.7)' },
      { transform: 'translate(' + OUT_X + 'px,' + OUT_REST_Y + 'px) rotate(8deg)', offset: 0.55, easing: 'ease-out' },
      { transform: 'translate(' + OUT_X + 'px,240px) rotate(-3deg)', offset: 0.76, easing: 'ease-in' },
      { transform: 'translate(' + OUT_X + 'px,' + OUT_REST_Y + 'px) rotate(0deg)' }
    ], { duration: 520 });
    if (!alive()) return;
    se('pahu');
    screen.classList.remove('spinning');
    await wait(140); if (!alive()) return;

    // ── 3. 外にころがり出て、地面ではずんで、画面中央へ ──
    var W = screen.offsetWidth, H = screen.offsetHeight;
    var o = toStage(OUT_X, OUT_REST_Y), g = toStage(OUT_X, GROUND_Y);
    var u = o.k * 34;                         // 取り出し口にいるときのカプセルの直径(px)
    var s0 = 48 * o.k / E;                    // そのときの scale（マシンのカプセルとぴったり同じ大きさ）
    var sg = s0 * 1.55, rg = sg * CAP_D / 2;  // 地面にいるときの scale と半径
    var gx = o.x - u * 0.7;                   // 少し中央がわにころがる
    var D = Math.max(120, Math.min(190, Math.min(W, H) * 0.42));
    var sc = D / CAP_D, cx = W / 2, cy = H * 0.45;
    var gy = g.y - rg;                        // 地面にいるときの中心のy
    obj.style.transform = tf(o.x, o.y, s0, 0);
    obj.style.opacity = '1';
    drop.style.display = 'none';
    anim(stage.querySelector('.gc-dim'), [{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: 'ease-out' });
    setTimeout(function () { if (alive() && !st.skipped) se('pahu', 0.85); }, 300);
    setTimeout(function () { if (alive() && !st.skipped) se('pahu', 1.05); }, 780);
    await anim(obj, [
      { offset: 0,    transform: tf(o.x, o.y, s0, 0),                       easing: 'cubic-bezier(.5,0,.9,.6)' },
      { offset: 0.30, transform: tf(gx + u * 0.15, gy, sg, 150),            easing: 'linear' },
      { offset: 0.34, transform: tf(gx + u * 0.2, gy + rg * 0.22, sg, 170, 1.22, 0.78), easing: 'ease-out' },
      { offset: 0.58, transform: tf(gx - u * 0.25, gy - u * 1.15, sg, 300), easing: 'ease-in' },
      { offset: 0.74, transform: tf(gx - u * 0.45, gy, sg, 400),            easing: 'linear' },
      { offset: 0.78, transform: tf(gx - u * 0.47, gy + rg * 0.12, sg, 410, 1.12, 0.88), easing: 'ease-out' },
      { offset: 0.90, transform: tf(gx - u * 0.6, gy - u * 0.38, sg, 440),  easing: 'ease-in' },
      { offset: 1,    transform: tf(gx - u * 0.7, gy, sg, 450) }
    ], { duration: 1000 });
    if (!alive()) return;
    await wait(160); if (!alive()) return;
    await anim(obj, [
      { offset: 0,   transform: tf(gx - u * 0.7, gy, sg, 450),                easing: 'cubic-bezier(.2,.8,.3,1)' },
      { offset: 0.7, transform: tf(cx, cy - D * 0.06, sc * 1.1, 372),         easing: 'ease-in-out' },
      { offset: 1,   transform: tf(cx, cy, sc, 360) }
    ], { duration: 560 });
    if (!alive()) return;

    // ── 4. ゆれながらタップ待ち ──
    st.skipped = false; st.ready = true;
    tapEl.style.left = cx + 'px'; tapEl.style.top = '0px';
    tapEl.style.transform = 'translate(-50%, ' + (cy + D / 2 + 22) + 'px)';
    tapEl.style.opacity = ''; tapEl.classList.add('show');
    obj.classList.add('wait');
    await new Promise(function (res) { st.openNow = res; st.timer = setTimeout(res, 4200); });
    clearTimeout(st.timer);
    if (!alive()) return;
    st.ready = false;
    stage.style.pointerEvents = 'none';    // ここからは結果のOKボタンを押せるように

    // ── 5. パカッと開く ──
    obj.classList.remove('wait'); tapEl.classList.remove('show'); tapEl.style.opacity = '0';
    await anim(capSvg, [{ transform: 'scale(1)' }, { transform: 'scale(1.18) rotate(-4deg)' }], { duration: 150, easing: 'ease-out' });
    if (!alive()) return;
    se('dropc');
    var top = capSvg.querySelector('.gc-top'), bot = capSvg.querySelector('.gc-bot');
    fx(top, [{ transform: 'translate(0px,0px) rotate(0deg)', opacity: 1 }, { transform: 'translate(-9px,-20px) rotate(-40deg)', opacity: 0 }], { duration: 440, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
    fx(bot, [{ transform: 'translate(0px,0px) rotate(0deg)', opacity: 1 }, { transform: 'translate(7px,18px) rotate(26deg)', opacity: 0 }], { duration: 440, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
    fx(obj.querySelector('.gc-aura'), [{ opacity: 0.6 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
    fx(stage.querySelector('.gc-dim'), [{ opacity: 1 }, { opacity: 0 }], { duration: 420, delay: 120, easing: 'ease-in', fill: 'forwards' });
    burst(fx, cx, cy, D, color, gold);
    await new Promise(function (res) { setTimeout(res, 170); });
    if (!alive()) return;
    onResult();                              // 結果のカードが出る
    await new Promise(function (res) { setTimeout(res, 650); });
    if (alive()) resetFx();
  }

  // 開いた瞬間の光・輪・ひかりのつぶ
  function burst(fx, cx, cy, D, color, gold) {
    function add(cls, w) {
      var d = document.createElement('i'); d.className = cls;
      d.style.left = cx + 'px'; d.style.top = cy + 'px';
      if (w) { d.style.width = w + 'px'; d.style.height = w + 'px'; d.style.margin = (-w / 2) + 'px 0 0 ' + (-w / 2) + 'px'; }
      fxEl.appendChild(d); return d;
    }
    var f = add('gc-flash');
    fx(f, [{ transform: 'scale(0.4)', opacity: 1 }, { transform: 'scale(' + (D / 90 * (gold ? 3.6 : 2.8)) + ')', opacity: 0 }], { duration: gold ? 620 : 480, easing: 'ease-out', fill: 'forwards' });
    for (var r = 0; r < (gold ? 2 : 1); r++) {
      var ring = add('gc-ring'); ring.style.color = r ? '#fff' : color;
      fx(ring, [{ transform: 'scale(0.5)', opacity: 0.95 }, { transform: 'scale(' + (D / 90 * (2.6 + r * 0.9)) + ')', opacity: 0 }], { duration: 560 + r * 120, delay: r * 90, easing: 'ease-out', fill: 'forwards' });
    }
    var n = gold ? 24 : 12, cols = gold ? [color, '#fff', '#ffd43b', '#fff7d6'] : [color, '#fff', color];
    for (var i = 0; i < n; i++) {
      var star = gold ? (i % 2 === 0) : (i % 3 === 0);
      var sz = (star ? 12 : 7) + Math.random() * (gold ? 10 : 6);
      var p = add('gc-p' + (star ? ' star' : ''), sz);
      p.style.background = cols[i % cols.length];
      var ang = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      var dist = D * (gold ? 1.0 : 0.8) * (0.75 + Math.random() * 0.7);
      fx(p, [
        { transform: 'translate(0px,0px) scale(1) rotate(0deg)', opacity: 1 },
        { transform: 'translate(' + Math.cos(ang) * dist + 'px,' + Math.sin(ang) * dist + 'px) scale(0.2) rotate(' + (Math.random() * 360) + 'deg)', opacity: 0 }
      ], { duration: 520 + Math.random() * 280, easing: 'cubic-bezier(.15,.7,.3,1)', fill: 'forwards' });
    }
  }

  if (stage) stage.addEventListener('click', function () {
    if (!seq) return;
    if (seq.ready) { if (seq.openNow) seq.openNow(); }
    else if (seq.skip) seq.skip();
  });

  // ── まわす ───────────────────────────────────
  function onSpin() {
    if (busy) return;
    var pool = drawable();
    if (!pool.length) { toast('ラインナップが空です'); return; }
    if (coinCount() < COST) {
      toast(coinName() + 'が足りません');
      var chip = $('gacha-coin'); if (chip) { chip.classList.remove('bump'); void chip.offsetWidth; chip.classList.add('bump'); }
      return;
    }
    // 抽選・コイン消費・BOXへの追加は、演出の前に確定して保存（途中で閉じても結果は残る）
    var id = pool[Math.floor(Math.random() * pool.length)];
    if (typeof consumeItem !== 'function' || !consumeItem(COIN, COST)) { toast(coinName() + 'が足りません'); refresh(); return; }
    var got = (typeof grantMonsterToBox === 'function') ? grantMonsterToBox(id) : null;
    if (!got) { toast('エラー：モンスターを追加できませんでした'); refresh(); return; }
    busy = true;
    refresh();
    function finish() { busy = false; showResult(id, got.isNew); }
    if (!FX_OK) {   // 動きを減らす設定などのとき：これまで通り、ゆらしてすぐ結果
      screen.classList.add('spinning');
      setTimeout(function () { screen.classList.remove('spinning'); finish(); }, SPIN_MS);
      return;
    }
    // カプセルの色は演出だけ（出るモンスターとは関係なし）。何かあってもガチャ自体は止めない
    runSequence(pickCapsule(), finish).catch(function () { resetFx(); if (busy) finish(); });
  }

  // ── ボタン ───────────────────────────────────
  var b;
  if ((b = $('gacha-spin-btn'))) b.addEventListener('click', onSpin);
  if ((b = $('gacha-lineup-btn'))) b.addEventListener('click', function () { if (!busy) openLineup(); });
  if ((b = $('gacha-back'))) b.addEventListener('click', function () { if (!busy) close(); });
  if ((b = $('gacha-lineup-close'))) b.addEventListener('click', closeLineup);
  if ((b = $('gacha-res-ok'))) b.addEventListener('click', closeResult);
  // 暗い背景をタップしても閉じる（カードの中をタップしたときは閉じない）
  [['gacha-lineup', closeLineup], ['gacha-result', closeResult]].forEach(function (p) {
    var m = $(p[0]); if (m) m.addEventListener('click', function (e) { if (e.target === m) p[1](); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !isOpen()) return;
    if (!$('gacha-result').hidden) closeResult();
    else if (!$('gacha-lineup').hidden) closeLineup();
    else if (!busy) close();
  });

  window.GachaScreen = {
    open: open, close: close, isOpen: isOpen, refresh: refresh,
    setTitle: function (t) { var el = $('gacha-title'); if (el) el.textContent = t; }
  };
})();
