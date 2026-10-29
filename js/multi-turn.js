// ============================================================
// マルチ：交代制ターン管理（テスト用・ローカル）
//   全員が「同じ盤面」を順番に操作する。
//     Aがパズル → ▶相手のターン → 同じ盤面でBがパズル → ▶相手のターン → A …
//   オンライン時は、ターンが終わるたびに「共有する状態」（盤面・敵のHP/階層・バフ/デバフ）を
//   相手へ渡す（js/multi-share.js）。パーティ・HP・SP・バインドは各自のまま。
//   ひとりで交代プレイ（通信なし）は、1台の端末でそのまま同じ盤面を交代する。
//
//   ■ game.js から呼ぶ口（isMultiArea(currentAreaNum) の時だけ）
//       MultiTurn.begin()     … ダンジョン開始時。A から始める＆HUD表示
//       MultiTurn.announce()  … 最初の「Aのターン」バナー（await）
//       MultiTurn.endTurn()   … プレイヤー1人分のパズルが終わった時。次の人へ交代（await）
//       MultiTurn.end()       … マルチ終了（HUD消す）
//
//   ■ 将来オンライン化する時の差し込み口
//       MultiTurn.transport.send(state) … 交代のたびに呼ばれる（今は何もしない）
//       MultiTurn.receive(state)        … 通信で受け取った状態を反映する
//       MultiTurn.localId               … null=1台で全員が操作 / 数字=自分の番号（自分の番だけ操作可）
// ============================================================
(function () {
  const NAMES = ['A', 'B', 'C', 'D'];
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const MT = {
    active: false,
    dead: [false, false, false, false],   // ゲームオーバーになって観戦中の人（オンライン：のこりの人だけでダンジョンを続ける）
    count: 2,          // 参加人数（2〜4）
    current: 0,        // 今パズルしている人
    round: 1,          // 何周目か
    online: false,     // true = オンライン対戦中（MultiOnline の部屋とつながっている）
    ready: true,       // オンライン：自分の開始演出が終わって、相手の状態を受け取れる状態か
    _queued: null,     // ready 前に届いた相手の状態（あとでまとめて反映）
    _receiving: false,
    localId: null,     // null = ローカル交代テスト
    transport: { send(_state) { /* 通信はまだ無し */ } },
  };

  const $ = id => document.getElementById(id);
  const gameEl = () => $('game');

  function state() { return { count: MT.count, current: MT.current, round: MT.round, dead: MT.dead.slice() }; }
  MT.state = state;
  MT.name = i => NAMES[i] || String(i + 1);
  MT.isMyTurn = () => MT.localId === null || (MT.localId === MT.current && !MT.dead[MT.localId]);
  MT.isDead = i => !!MT.dead[i];
  MT.aliveCount = () => { let n = 0; for (let i = 0; i < MT.count; i++) if (!MT.dead[i]) n++; return n; };

  // ---------- HUD ----------
  function ensureHud() {
    let hud = $('mt-hud');
    if (hud) return hud;
    hud = document.createElement('div');
    hud.id = 'mt-hud';
    hud.innerHTML = '<div id="mt-players"></div><button id="mt-count" type="button" aria-label="人数を切り替え"></button><button id="mt-spec-leave" type="button">ホームへ</button>';
    gameEl().appendChild(hud);
    $('mt-count').addEventListener('click', () => {
      if (!MT.active || MT.busyBanner || MT.online) return;   // オンライン中は2人固定
      MT.count = MT.count >= 4 ? 2 : MT.count + 1;
      if (MT.current >= MT.count) MT.current = 0;
      renderHud();
    });
    $('mt-spec-leave').addEventListener('click', () => {   // 観戦中：いつでも抜けてホームへ戻れる（クリア報酬はなし）
      if (typeof _gameOverGoHome === 'function') _gameOverGoHome();
    });
    return hud;
  }

  function renderHud() {
    const hud = ensureHud();
    hud.style.display = MT.active ? 'flex' : 'none';
    const g = gameEl();
    for (let i = 0; i < 4; i++) g.classList.toggle('mt-p' + i, MT.active && i === MT.current);
    g.classList.toggle('mt-on', MT.active);
    g.classList.toggle('mt-wait', !!(MT.active && MT.online && !MT.isMyTurn()));   // オンライン：自分の番ではない間は盤面を暗くする（敵の攻撃中と同じ暗さ）
    if (!MT.active) return;
    const box = $('mt-players');
    box.innerHTML = '';
    for (let i = 0; i < MT.count; i++) {
      const p = document.createElement('div');
      const me = MT.online && i === MT.localId;
      p.className = 'mt-pl p' + i + (MT.dead[i] ? ' dead' : (i === MT.current ? ' on' : ''));
      p.innerHTML = '<span class="mt-av">' + MT.name(i) + '</span>' + (MT.dead[i]
        ? '<span class="mt-tag x">' + (me ? '観戦中' : '脱落') + '</span>'
        : (i === MT.current ? '<span class="mt-tag">' + (me ? 'あなた' : 'パズル中') + '</span>' : '<span class="mt-tag w">' + (me ? 'あなた' : 'まち') + '</span>'));
      box.appendChild(p);
    }
    $('mt-count').textContent = MT.count + '人';
    $('mt-count').style.display = MT.online ? 'none' : '';
  }

  // ---------- ターン切替バナー ----------
  async function banner(sub, main, idx) {
    MT.busyBanner = true;
    let el = $('mt-banner');
    if (!el) { el = document.createElement('div'); el.id = 'mt-banner'; gameEl().appendChild(el); }
    el.className = 'p' + idx;
    el.innerHTML = '<div class="mt-b-sub">' + sub + '</div><div class="mt-b-main">' + main + '</div>';
    void el.offsetWidth;
    el.classList.add('show');
    await sleep(1100);
    el.classList.remove('show');
    await sleep(250);
    MT.busyBanner = false;
  }

  // ---------- 公開API ----------
  MT.banner = banner;   // game.js からお知らせ表示に使う
  MT.begin = function () {
    MT.active = true;
    if (MT.online) MT.count = 2;
    MT.current = 0;
    MT.round = 1;
    MT.dead = [false, false, false, false];
    MT.ready = !MT.online;       // オンラインは、開始演出が終わるまで相手の状態を受け取らずに待たせる
    MT._queued = null; MT._receiving = false;
    if (window.MultiShare) MultiShare.reset();
    renderHud();
  };

  // 開始演出が終わった：A（先攻）は最初の盤面・敵の状態を相手へ渡す／待たされていた相手の状態を反映する
  MT.markReady = async function () {
    if (!MT.active || !MT.online) return;
    MT.ready = true;
    if (window.MultiShare) {
      MultiShare.publishParty();                      // 自分のパーティーを相手に見せる
      MultiShare.setView(!MT.isMyTurn(), false);      // 相手のターンで始まるなら、最初から相手のパーティーを表示
    }
    if (MT.isMyTurn() && window.MultiOnline) MultiOnline.clearFx();
    if (MT.isMyTurn() && window.MultiShare && !MT._queued) {
      MT.transport.send(Object.assign(state(), { kind: 'sync', snap: MultiShare.snapshot() }));
    }
    if (MT._queued) { const q = MT._queued; MT._queued = null; await MT.receive(q); }
  };

  MT.announce = async function () {
    if (!MT.active) return;
    await banner('PLAYER ' + MT.name(MT.current), MT.name(MT.current) + ' のターン', MT.current);
  };

  MT.endTurn = async function () {
    if (!MT.active) return;
    let next = (MT.current + 1) % MT.count;
    for (let k = 0; k < MT.count && MT.dead[next]; k++) next = (next + 1) % MT.count;   // 脱落した人のターンはとばす
    const solo = next === MT.current;   // のこりが自分ひとり：自分のターンがそのまま続く
    if (next <= MT.current) MT.round++;
    MT.current = next;
    renderHud();
    if (MT.online && window.MultiShare) MultiShare.publishParty();   // いまのHP・SP・バインドを相手の画面用に
    MT.transport.send(Object.assign(state(), { kind: 'turn', snap: (MT.online && window.MultiShare) ? MultiShare.snapshot() : null }));   // 観戦中のあいてにも、毎ターン盤面を送る
    if (solo && MT.online) return;   // ひとりで続けている間は、ターン切替バナーを出さない
    if (MT.online && window.MultiShare) MultiShare.setView(!MT.isMyTurn());   // 自分のパーティーが左へ、右から相手のパーティーが入ってくる
    if (MT.online) await banner(MT.isMyTurn() ? '▶ あなたのターン' : '▶ 相手のターン', MT.name(MT.current) + ' のパズル', MT.current);
    else await banner('▶ 相手のターン', MT.name(MT.current) + ' のパズル', MT.current);
  };

  // 自分がゲームオーバーになった（のこりの人はいる）：最後の盤面・敵の状態と「脱落」を渡して、次の人へターンを移す
  MT.sendDead = function () {
    if (!MT.active || !MT.online || MT.localId === null) return;
    const me = MT.localId;
    MT.dead[me] = true;
    if (window.MultiOnline) MultiOnline.setDead(true);
    let next = (me + 1) % MT.count;
    for (let k = 0; k < MT.count && MT.dead[next]; k++) next = (next + 1) % MT.count;
    if (next <= MT.current) MT.round++;
    MT.current = next;
    renderHud();
    if (window.MultiShare) MultiShare.publishParty();
    MT.transport.send(Object.assign(state(), { kind: 'dead', snap: window.MultiShare ? MultiShare.snapshot() : null }));
  };
  // あいてが脱落したと知らされた
  MT.markDead = function (i) {
    if (i === null || i === undefined || MT.dead[i]) return;
    MT.dead[i] = true;
    renderHud();
  };

  // 通信で「相手のターンが終わった」と受け取ったとき（オンライン）
  //   まず相手の状態（盤面・敵・バフ/デバフ）を自分の画面へ反映してから、自分のターンにする
  MT.receive = async function (s) {
    if (!s) return;
    if (!MT.active || !MT.ready || MT._receiving) { MT._queued = s; return; }   // 準備中／反映中に届いたものは、あとで（最新だけ）
    MT._receiving = true;
    try {
      if (window.MultiShare) { try { await MultiShare.drainFx(); } catch (e) {} }   // 相手の操作の流れを、最後まで再生してから確定
      if (s.snap && window.MultiShare) {
        try { await MultiShare.apply(s.snap); } catch (e) { console.error('[multi-share] apply', e); }
      }
      if (!MT.active) return;
      MT.count = s.count; MT.current = s.current; MT.round = s.round;
      if (Array.isArray(s.dead)) s.dead.forEach((d, i) => { if (d) MT.dead[i] = true; });
      renderHud();
      const slide = window.MultiShare ? MultiShare.setView(!MT.isMyTurn(), s.kind !== 'sync') : null;   // 相手のパーティーが左へ、右から自分のパーティーが入ってくる
      if (s.kind !== 'sync' && MT.isMyTurn()) {
        if (window.MultiOnline) MultiOnline.clearFx();   // 自分のターンの始め：前の流れを消す
        if (s.kind === 'dead') await banner('⚠ ' + MT.name(1 - MT.localId) + ' が脱落…ひとりで続行', 'あなたのターン', MT.current);
        else if (!(MT.aliveCount() <= 1)) await banner('▶ あなたのターン', MT.name(MT.current) + ' のパズル', MT.current);
        if (slide) { try { await slide; } catch (e) {} }
        if (MT.onMyTurn) MT.onMyTurn();   // game.js 側で盤面のロックを解く
      }
    } finally {
      MT._receiving = false;
    }
    if (MT._queued) { const q = MT._queued; MT._queued = null; await MT.receive(q); }
  };

  MT.end = function () {
    MT.active = false;
    MT.dead = [false, false, false, false];
    if (MT.online) {
      MT.online = false; MT.localId = null; MT.ready = true; MT._queued = null;
      MT.transport = { send(_s) {} };
      if (window.MultiOnline) MultiOnline.leave();
    }
    if (window.MultiShare) MultiShare.reset();
    renderHud();
  };

  MT.renderHud = renderHud;
  window.MultiTurn = MT;
})();
