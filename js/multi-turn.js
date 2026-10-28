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

  function state() { return { count: MT.count, current: MT.current, round: MT.round }; }
  MT.state = state;
  MT.name = i => NAMES[i] || String(i + 1);
  MT.isMyTurn = () => MT.localId === null || MT.localId === MT.current;

  // ---------- HUD ----------
  function ensureHud() {
    let hud = $('mt-hud');
    if (hud) return hud;
    hud = document.createElement('div');
    hud.id = 'mt-hud';
    hud.innerHTML = '<div id="mt-players"></div><button id="mt-count" type="button" aria-label="人数を切り替え"></button>';
    gameEl().appendChild(hud);
    $('mt-count').addEventListener('click', () => {
      if (!MT.active || MT.busyBanner || MT.online) return;   // オンライン中は2人固定
      MT.count = MT.count >= 4 ? 2 : MT.count + 1;
      if (MT.current >= MT.count) MT.current = 0;
      renderHud();
    });
    return hud;
  }

  function renderHud() {
    const hud = ensureHud();
    hud.style.display = MT.active ? 'flex' : 'none';
    const g = gameEl();
    for (let i = 0; i < 4; i++) g.classList.toggle('mt-p' + i, MT.active && i === MT.current);
    g.classList.toggle('mt-on', MT.active);
    if (!MT.active) return;
    const box = $('mt-players');
    box.innerHTML = '';
    for (let i = 0; i < MT.count; i++) {
      const p = document.createElement('div');
      p.className = 'mt-pl p' + i + (i === MT.current ? ' on' : '');
      p.innerHTML = '<span class="mt-av">' + MT.name(i) + '</span>' + (i === MT.current ? '<span class="mt-tag">' + (MT.online && i === MT.localId ? 'あなた' : 'パズル中') + '</span>' : '<span class="mt-tag w">' + (MT.online && i === MT.localId ? 'あなた' : 'まち') + '</span>');
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
    MT.ready = !MT.online;       // オンラインは、開始演出が終わるまで相手の状態を受け取らずに待たせる
    MT._queued = null; MT._receiving = false;
    if (window.MultiShare) MultiShare.reset();
    renderHud();
  };

  // 開始演出が終わった：A（先攻）は最初の盤面・敵の状態を相手へ渡す／待たされていた相手の状態を反映する
  MT.markReady = async function () {
    if (!MT.active || !MT.online) return;
    MT.ready = true;
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
    const next = (MT.current + 1) % MT.count;
    if (next === 0) MT.round++;
    MT.current = next;
    renderHud();
    MT.transport.send(Object.assign(state(), { kind: 'turn', snap: (MT.online && window.MultiShare) ? MultiShare.snapshot() : null }));
    if (MT.online) await banner(MT.isMyTurn() ? '▶ あなたのターン' : '▶ 相手のターン', MT.name(MT.current) + ' のパズル', MT.current);
    else await banner('▶ 相手のターン', MT.name(MT.current) + ' のパズル', MT.current);
  };

  // 通信で「相手のターンが終わった」と受け取ったとき（オンライン）
  //   まず相手の状態（盤面・敵・バフ/デバフ）を自分の画面へ反映してから、自分のターンにする
  MT.receive = async function (s) {
    if (!s) return;
    if (!MT.active || !MT.ready || MT._receiving) { MT._queued = s; return; }   // 準備中／反映中に届いたものは、あとで（最新だけ）
    MT._receiving = true;
    try {
      if (s.snap && window.MultiShare) {
        try { await MultiShare.apply(s.snap); } catch (e) { console.error('[multi-share] apply', e); }
      }
      if (!MT.active) return;
      MT.count = s.count; MT.current = s.current; MT.round = s.round;
      renderHud();
      if (s.kind !== 'sync' && MT.isMyTurn()) {
        await banner('▶ あなたのターン', MT.name(MT.current) + ' のパズル', MT.current);
        if (MT.onMyTurn) MT.onMyTurn();   // game.js 側で盤面のロックを解く
      }
    } finally {
      MT._receiving = false;
    }
    if (MT._queued) { const q = MT._queued; MT._queued = null; await MT.receive(q); }
  };

  MT.end = function () {
    MT.active = false;
    if (MT.online) {
      MT.online = false; MT.localId = null; MT.ready = true; MT._queued = null;
      MT.transport = { send(_s) {} };
      if (window.MultiOnline) MultiOnline.leave();
    }
    if (window.MultiShare) MultiShare.reset();
    renderHud();
  };

  window.MultiTurn = MT;
})();
