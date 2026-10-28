// ============================================================
// マルチ：オンライン（自動マッチング＋部屋）  Firebase Realtime Database 使用
//
//   流れ
//     1. findMatch(stageKey)   … ステージごとの待ち行列に入り、2人そろったら部屋を作る（自動マッチング）
//     2. enterRoom(room, seat) … 部屋に入る。あいての状態(編成中/準備OK)を onOpponent で受け取る
//     3. setReady(true, team)  … 「決定」。2人とも ready になったら onBothReady が両方の端末で1回だけ呼ばれる
//     4. sendTurn(state)       … ダンジョン中、交代のたびに送る（onTurn で受け取る）。
//                                 state.snap に「共有する状態（盤面・敵・バフ/デバフ）」のJSON文字列を入れる（js/multi-share.js）
//     4b. sendEvent(type,data) … クリア／ゲームオーバーなどの知らせ（onEvent で受け取る）
//     4c. sendLive(obj)        … 相手が指を動かしている最中の盤面（onLive で受け取る。見せるだけ）
//     5. leave()               … 退出（相手には「退出」が伝わる）
//
//   DB の形
//     mt_queue/{ステージ}            … 待機中の1人 { id, ts }   ※transactionで取り合い
//     mt_match/{待機者id}            … 待機者への通知 { room, seat }
//     mt_rooms/{room}/players/{0,1}  … { id, present, ready, team }
//     mt_rooms/{room}/turn           … { n, by, count, current, round, kind, snap }
//     mt_rooms/{room}/ev             … { n, by, type, data }          （クリア / ゲームオーバー）
//     mt_rooms/{room}/live           … { by, cur, round, g }          （操作中の盤面のミラー）
//
//   seat 0 = 先に待っていた人（A / 先攻）、seat 1 = あとから来た人（B）
// ============================================================
(function () {
  const STALE_MS = 45000;      // 待機の目印がこれより古ければ「いない」とみなす
  const HEARTBEAT_MS = 15000;  // 待機中は定期的に目印を更新する

  const MO = {
    room: null, seat: null, ready: false,
    _id: null, _db: null, _cancel: null, _room: null,
  };

  // タブごとに別のID（同じ端末で2タブ開いて試せるように sessionStorage）
  function myId() {
    if (MO._id) return MO._id;
    let v = null;
    try { v = sessionStorage.getItem('mo_id'); } catch (e) {}
    if (!v) {
      v = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      try { sessionStorage.setItem('mo_id', v); } catch (e) {}
    }
    return (MO._id = v);
  }
  MO.myId = myId;

  function getDb() {
    if (MO._db) return MO._db;
    try {
      if (typeof firebase === 'undefined' || typeof FIREBASE_CONFIG === 'undefined') return null;
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      MO._db = firebase.database();
    } catch (e) { return null; }
    return MO._db;
  }
  MO.available = () => !!getDb();

  // ---------- 1. 自動マッチング ----------
  //   resolve({ room, seat }) / reject(Error('cancel' | 'offline' | その他))
  MO.findMatch = function (stageKey) {
    return new Promise((resolve, reject) => {
      const db = getDb();
      if (!db) { reject(new Error('offline')); return; }
      const id = myId();
      const qRef = db.ref('mt_queue/' + stageKey);
      const mRef = db.ref('mt_match/' + id);
      let finished = false, hb = null;

      const stop = () => { clearInterval(hb); try { mRef.off(); } catch (e) {} MO._cancel = null; };
      const fail = (err) => { if (finished) return; finished = true; stop(); reject(err); };
      const succeed = (r) => { if (finished) return; finished = true; stop(); resolve(r); };

      MO._cancel = () => {
        if (finished) return;
        finished = true; stop();
        qRef.transaction(c => (c && c.id === id) ? null : c).catch(() => {});
        try { qRef.onDisconnect().cancel(); } catch (e) {}
        mRef.remove().catch(() => {});
        reject(new Error('cancel'));
      };

      // 前回の通知が残っていたら消してから始める
      mRef.remove().then(() => {
        if (finished) return;
        // 先に来ていた人から「部屋ができたよ」と知らされたとき（待機側）
        mRef.on('value', s => {
          const v = s.val();
          if (!v || finished) return;
          try { qRef.onDisconnect().cancel(); } catch (e) {}
          mRef.remove().catch(() => {});
          succeed({ room: v.room, seat: v.seat });
        }, err => fail(err));

        let opp = null;
        return qRef.transaction(cur => {
          opp = null;
          const now = Date.now();
          if (cur && cur.id && cur.id !== id && now - (cur.ts || 0) < STALE_MS) { opp = cur.id; return null; }   // 待っている人がいた → つかまえる
          return { id, ts: now };                                                                                // いなければ自分が待つ
        }).then(res => {
          if (finished) return;
          if (opp && res.committed) {
            // つかまえた：部屋を作って、待っていた人に知らせる（待っていた人が seat 0）
            const room = opp + '_' + id + '_' + Date.now().toString(36);
            return db.ref('mt_rooms/' + room).set({
              stage: stageKey, created: Date.now(),
              players: { 0: { id: opp, present: false, ready: false }, 1: { id, present: false, ready: false } },
            }).then(() => db.ref('mt_match/' + opp).set({ room, seat: 0 }))
              .then(() => succeed({ room, seat: 1 }));
          }
          if (res.committed) {
            // 自分が待機中。落ちたら行列から消える／定期的に「まだいるよ」を更新
            try { qRef.onDisconnect().remove(); } catch (e) {}
            hb = setInterval(() => {
              qRef.transaction(c => (c && c.id === id) ? { id, ts: Date.now() } : c).catch(() => {});
            }, HEARTBEAT_MS);
            return;
          }
          // 同時に別の人に取られた → もう一度
          MO._cancel = null; stop(); finished = true;
          MO.findMatch(stageKey).then(resolve, reject);
        });
      }).catch(err => fail(err));
    });
  };
  MO.cancelMatch = () => { if (MO._cancel) MO._cancel(); };

  // ---------- 2. 部屋 ----------
  //   handlers: { onOpponent(p|null), onBothReady(), onTurn(state), onClosed() }
  MO.enterRoom = function (room, seat, handlers) {
    const db = getDb();
    MO.leave(true);
    MO.room = room; MO.seat = seat; MO.ready = false;
    const rRef = db.ref('mt_rooms/' + room);
    const mine = rRef.child('players/' + seat);
    const oppRef = rRef.child('players/' + (1 - seat));
    const turnRef = rRef.child('turn');
    const evRef = rRef.child('ev');
    const liveRef = rRef.child('live');
    const ctx = { rRef, mine, oppRef, turnRef, evRef, liveRef, started: false, lastTurn: 0, lastEv: 0, handlers: handlers || {}, opp: null };
    MO._room = ctx;

    mine.update({ id: myId(), present: true, ready: false, team: '' });
    try { mine.child('present').onDisconnect().set(false); mine.child('ready').onDisconnect().set(false); } catch (e) {}

    const evalStart = () => {
      if (ctx.started || !MO.ready || !ctx.opp || !ctx.opp.present || !ctx.opp.ready) return;
      ctx.started = true;
      if (ctx.handlers.onBothReady) ctx.handlers.onBothReady();
    };
    ctx.evalStart = evalStart;

    oppRef.on('value', s => {
      ctx.opp = s.val();
      if (ctx.handlers.onOpponent) ctx.handlers.onOpponent(ctx.opp);
      evalStart();
    });
    turnRef.on('value', s => {
      const v = s.val();
      if (!v || v.by === MO.seat || !(v.n > ctx.lastTurn)) return;
      ctx.lastTurn = v.n;
      if (ctx.handlers.onTurn) ctx.handlers.onTurn(v);
    });
    evRef.on('value', s => {
      const v = s.val();
      if (!v || v.by === MO.seat || !(v.n > ctx.lastEv)) return;
      ctx.lastEv = v.n;
      if (ctx.handlers.onEvent) ctx.handlers.onEvent(v);
    });
    liveRef.on('value', s => {
      const v = s.val();
      if (!v || v.by === MO.seat) return;
      if (ctx.handlers.onLive) ctx.handlers.onLive(v);
    });
  };

  // ---------- 3. 決定（準備OK / 取り消し） ----------
  MO.setReady = function (ready, teamStr) {
    const c = MO._room;
    if (!c) return;
    if (c.started) return;   // もう始まっている
    MO.ready = !!ready;
    c.mine.update({ ready: !!ready, team: teamStr || '' });
    c.evalStart();
  };

  // ---------- 4. ターン交代の送信 ----------
  let turnN = 0;
  MO.sendTurn = function (state) {
    const c = MO._room;
    if (!c || !state) return;
    turnN = Math.max(turnN, c.lastTurn) + 1;
    c.lastTurn = turnN;
    c.turnRef.set({ n: turnN, by: MO.seat, count: state.count, current: state.current, round: state.round, kind: state.kind || 'turn', snap: state.snap || null });
  };

  // ---------- 4b. できごと（クリア / ゲームオーバー）の送信 ----------
  let evN = 0;
  MO.sendEvent = function (type, data) {
    const c = MO._room;
    if (!c) return;
    evN = Math.max(evN, c.lastEv) + 1;
    c.lastEv = evN;
    c.evRef.set({ n: evN, by: MO.seat, type, data: data || null });
  };

  // ---------- 4c. 操作中の盤面（見せるだけ。保存しなくてよいので軽く） ----------
  MO.sendLive = function (obj) {
    const c = MO._room;
    if (!c || !obj) return;
    c.liveRef.set({ by: MO.seat, cur: obj.cur, round: obj.round, g: obj.g });
  };

  // ---------- 5. 退出 ----------
  MO.leave = function (silent) {
    const c = MO._room;
    if (!c) { MO.room = null; MO.seat = null; MO.ready = false; return; }
    MO._room = null;
    try { c.oppRef.off(); c.turnRef.off(); c.evRef.off(); c.liveRef.off(); } catch (e) {}
    try { c.mine.child('present').onDisconnect().cancel(); c.mine.child('ready').onDisconnect().cancel(); } catch (e) {}
    c.mine.update({ present: false, ready: false }).catch(() => {});
    // 2人とも抜けたら部屋ごと消す
    c.oppRef.once('value').then(s => {
      const o = s.val();
      if (!o || !o.present) c.rRef.remove().catch(() => {});
    }).catch(() => {});
    MO.room = null; MO.seat = null; MO.ready = false;
  };

  window.MultiOnline = MO;
})();
