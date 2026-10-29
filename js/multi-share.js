// ============================================================
// マルチ：2人で「1つの戦場」を共有する（オンライン）
//
//   ■ 共有するもの（2人で1つ）
//       ・盤面（ドロップ／暗闇／ルーレット）
//       ・敵（階層・HP・行動カウント・敵のバフ／デバフ・ドロップ済みか など）
//       ・プレイヤー側の効果（ダメージ軽減・攻撃アップ・操作時間・回復力・全体攻撃 などのバフ、
//         敵からのデバフ：攻撃力ダウン／回復力ダウン／操作時間ダウン／スキル使用不可／落ちコンなし）
//   ■ 別々のもの
//       ・パーティ、HP、SP／メモリ、バインド（モンスター個別のため）、リーダースキルの効果、
//         もらえる経験値・エナ・ドロップ（それぞれが自分の分を受け取る）
//
//   ■ しくみ（ターン制なので「操作する人の状態を、次の人へ渡す」だけ）
//       ターンが終わる → snapshot() で共有状態をJSONにして相手へ送る（multi-turn.js の endTurn）
//       相手の画面 → apply() で自分の画面へ反映してから「あなたのターン」
//     階層が進んでいたら、相手の画面でも同じ階層へ移動する（倒した敵の経験値・ドロップは自分の分を受け取る）
//     クリア／ゲームオーバーは「できごと」として即座に相手へ知らせる
//     指を動かしている最中の盤面も、見せるだけのミラー（live）で相手の画面へ流す
//
//   ■ 乱数をそろえるもの：最初の盤面と、ランダム階層／乱入の抽選（部屋IDをシードにして両者同じ結果）
//                         ＋ 敵のドロップ抽選（階層・敵ごとにシード → クリア報酬は2人とも同じ内容）
//
//   ■ ひとりがゲームオーバーになったとき
//       のこりの人がいれば、全滅にはならない。脱落した人は「観戦」（盤面を見るだけ・クリア報酬なし）、
//       のこりの人は自分のターンだけでダンジョンを続ける（観戦中の人にも毎ターン盤面を送る）。
//       最後のひとりもゲームオーバーになったら、観戦中の人もいっしょにゲームオーバー画面へ。
//       クリアしたら、観戦していた人には「報酬なし」のCLEAR画面が出る。
//
//   game.js の変数は、同じグローバル領域として直接読み書きする（このファイルは game.js のあとに読み込む）
// ============================================================
(function () {
  const MS = {
    kills: [],       // 倒したバトルの記録（累積）：{ i:階層番号, fled:[0/1,…], combo:[…] }
    remote: false,   // 相手の知らせでゲームオーバー／クリアを起こしている最中（知らせの送り返し防止）
    applying: false, // 相手の状態を反映している最中
    spectating: false, // 自分がゲームオーバーになって観戦中（報酬は受け取らない）
  };

  const on = () => !!(window.MultiTurn && MultiTurn.online && MultiTurn.active);
  // ダンジョンの準備中（MultiTurn.begin の前）でも、オンラインの部屋に入っていれば true
  const inRoom = () => !!(window.MultiTurn && MultiTurn.online && window.MultiOnline && MultiOnline.room);
  MS.on = on;
  MS.reset = function () {
    MS.kills = []; MS.remote = false; MS.applying = false; MS.spectating = false; cancelLive();
    MS.rp = null; MS.remoteView = false;
    const g = document.getElementById('game'); if (g) g.classList.remove('mt-spectate', 'mt-remote');
  };

  // ---------- 乱数をそろえる ----------
  function hash(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mulberry(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // オンライン中だけ、fn の中の Math.random を「部屋ID＋tag」のシード乱数にする。それ以外は fn をそのまま実行
  MS.withSeed = function (tag, fn) {
    if (!inRoom()) return fn();
    const orig = Math.random;
    Math.random = mulberry(hash(MultiOnline.room + ':' + tag));
    try { return fn(); } finally { Math.random = orig; }
  };
  // 敵ごとのドロップ抽選のシード名（階層＋何体目か）。2人の端末で同じ結果になる。オンラインでなければ null
  MS.dropKey = function (enemy) {
    if (!inRoom() || !enemy) return null;
    if (enemy._dropKey) return enemy._dropKey;
    const i = enemyList.indexOf(enemy);
    return i >= 0 ? 'drop:' + currentBattleIndex + ':' + i : null;
  };
  // 最初の盤面（両者同じ）。オンラインでなければ null（呼び出し側が普通に作る）
  MS.initialGrid = function () {
    if (!inRoom()) return null;
    return MS.withSeed('grid', () => Array.from({ length: ROWS }, () => Array.from({ length: COLS }, rand)));
  };
  // 自分が「先制攻撃・バトル開始時の行動」をしなくてよいか（相手の番の間は、相手の端末が実行して結果を渡してくる）
  MS.skipStartActions = function () { return on() && !MultiTurn.isMyTurn(); };

  // ---------- 共有する状態：書き出し ----------
  const ENEMY_KEYS = ['hp', 'maxHp', 'atk', 'turnProgress', 'turnInterval', '_baseTurnInterval', '_baseAtk', '_atkBuffTurns',
    'healUsed', 'preemptiveDone', '_hpCondUsed', '_orbNoneSeq', '_actSeq', '_delayed', '_fled', '_killCombo',
    '_comboAbsorb', '_statusShield', '_dmgReduce', '_attrGuards', '_superGut', 'defDown'];
  const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const gridStr = () => grid.map(r => r.map(v => v || '').join(',')).join('|');

  function getBuffs() {
    return {
      dr: [buffDamageReduction, buffDamageReductionValue, buffDamageReductionTurns],
      rm: [buffRecMult, buffRecMultValue, buffRecMultTurns],
      mt: [buffMoveTime, buffMoveTimeMult, buffMoveTimeSec, buffMoveTimeTurns],
      aa: [buffAllAttack, buffAllAttackTurns],
      ab: clone(atkBuffs),
      ms: [buffMoveTimeShort, buffMoveTimeShortTurns],
      ad: clone(enemyAtkDowns),
      rd: clone(enemyRecDown), md: clone(enemyMoveDown), ss: clone(enemySkillSeal), nf: clone(enemyNoFall),
    };
  }
  function setBuffs(b) {
    if (!b) return;
    [buffDamageReduction, buffDamageReductionValue, buffDamageReductionTurns] = b.dr;
    [buffRecMult, buffRecMultValue, buffRecMultTurns] = b.rm;
    [buffMoveTime, buffMoveTimeMult, buffMoveTimeSec, buffMoveTimeTurns] = b.mt;
    [buffAllAttack, buffAllAttackTurns] = b.aa;
    atkBuffs = b.ab || [];
    [buffMoveTimeShort, buffMoveTimeShortTurns] = b.ms;
    enemyAtkDowns = b.ad || [];
    enemyRecDown = b.rd || null; enemyMoveDown = b.md || null; enemySkillSeal = b.ss || null; enemyNoFall = b.nf || null;
  }

  MS.snapshot = function () {
    cancelLive();
    return JSON.stringify({
      bi: currentBattleIndex,
      g: gridStr(),
      bl: blindCells.map(r => r.map(b => (b ? 1 : 0)).join('')).join('|'),
      rl: roulettes.map(o => ({ r: o.r, c: o.c, turns: o.turns, period: o.period, t: o.t })),
      en: enemyList.map(e => { const o = {}; for (const k of ENEMY_KEYS) if (e[k] !== undefined) o[k] = clone(e[k]); return o; }),
      bf: getBuffs(),
      k: MS.kills,
    });
  };

  // 階層をクリアした：倒した敵の記録を残す（game.js の handleBattleEnd から）。相手の端末が、同じ報酬判定をするのに使う
  MS.recordKill = function () {
    if (!on()) return;
    if (MS.kills.some(k => k.i === currentBattleIndex)) return;
    MS.kills.push({ i: currentBattleIndex, fled: enemyList.map(e => (e._fled ? 1 : 0)), combo: enemyList.map(e => e._killCombo || 0) });
  };

  // ---------- 共有する状態：反映 ----------
  function setGridFromStr(str) {
    const rows = String(str).split('|');
    if (rows.length !== ROWS) return false;
    const cells = rows.map(r => r.split(','));
    if (cells.some(r => r.length !== COLS)) return false;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = cells[r][c] || null;
      grid[r][c] = t;
      const el = orbEls[r] && orbEls[r][c];
      if (el) { el.className = 'orb' + (t ? ' ' + t : ''); el.style.transform = ''; }
    }
    return true;
  }
  function applyBlind(str) {
    const rows = String(str || '').split('|');
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      blindCells[r][c] = !!(rows[r] && rows[r][c] === '1');
      setBlindEl(r, c);
    }
  }
  function restoreRoulettes(list) {
    clearRoulettes();
    const L = rouletteLayer(), B = rouletteBackLayer();
    if (!L || !B || !list || !list.length) return;
    for (const d of list) {
      const el = document.createElement('div');
      el.className = 'rl';
      el.style.gridRow = String(d.r + 1); el.style.gridColumn = String(d.c + 1);
      el.innerHTML = '<i class="rl-sweep"></i><i class="rl-ring"></i><b class="rl-turn"></b>';
      L.appendChild(el);
      const elB = document.createElement('div');
      elB.className = 'rlb';
      elB.style.gridRow = String(d.r + 1); elB.style.gridColumn = String(d.c + 1);
      elB.innerHTML = '<i class="rl-sweep-b"></i>';
      B.appendChild(elB);
      const o = { r: d.r, c: d.c, turns: d.turns, period: d.period, t: d.t, el, elB };
      el.querySelector('.rl-turn').textContent = o.turns;
      roulettes.push(o);
      renderRoulette(o);
    }
    startRouletteLoop();
  }

  // 倒れた敵のドロップ抽選（自分の分）。相手の端末で倒した敵も、自分の運でドロップする
  function remoteDefeat(e, silent) {
    if (e._dropChecked) return;
    if (MS.spectating) {   // 観戦中：倒れる演出だけ見せて、ドロップ・エナは受け取らない
      e._dropChecked = true;
      if (!silent && !e._fled) _defeatPending.push(startEnemyVanish(e));
      return;
    }
    const prev = attackPhaseCombo;
    attackPhaseCombo = e._killCombo || 0;   // 10コンボ以上で倒したときのチップ確定も、倒した人のコンボ数で判定
    try { tryDrop(e, !!silent); } finally { attackPhaseCombo = prev; }
  }

  function applyEnemies(arr) {
    for (let i = 0; i < enemyList.length && i < arr.length; i++) {
      const e = enemyList[i], o = arr[i];
      const wasAlive = e.hp > 0;
      for (const k of ENEMY_KEYS) {
        if (o[k] !== undefined) e[k] = o[k];
        else if (k[0] === '_' || k === 'defDown') delete e[k];
      }
      e._due = false; e._acting = false;
      if (wasAlive && e.hp <= 0) remoteDefeat(e);
    }
  }

  // いまの階層の「倒した記録」を、自分の側にも反映（残っている敵を倒した扱いにして、経験値・ドロップを受け取る）
  async function finishFloor(rec) {
    if (rec) enemyList.forEach((e, i) => {
      if (e._dropChecked && e.hp <= 0) return;   // 倒した時点で処理済み
      e.hp = 0;
      e._fled = !!(rec.fled && rec.fled[i]);
      e._killCombo = (rec.combo && rec.combo[i]) || 0;
      remoteDefeat(e);
    });
    try { updateEnemyUI(); } catch (e) {}
    for (const e of enemyList) if (e.hp <= 0 && !e._fled) totalExp += (e.exp || 0);
    while (_defeatPending.length) { const list = _defeatPending; _defeatPending = []; await Promise.all(list); }
  }
  // 相手の操作中に何階層も進んだとき、途中の階層ぶんの報酬は演出なしで受け取る
  function silentFloor(idx, rec) {
    const b = currentDungeonBattles[idx];
    if (!b || !b.enemies) return;
    b.enemies.forEach((def, i) => {
      const p = Object.assign({}, def, { _dropKey: 'drop:' + idx + ':' + i, hp: 0, _fled: !!(rec && rec.fled && rec.fled[i]), _killCombo: (rec && rec.combo && rec.combo[i]) || 0, _dropChecked: false });
      if (!p._fled) totalExp += (def.exp || 0);
      remoteDefeat(p, true);
    });
  }

  // 相手が階層を進めた：自分の画面でも次の階層へ（handleBattleEnd の移動部分と同じ流れ）
  async function advanceTo(s) {
    const from = currentBattleIndex, to = s.bi;
    const recOf = i => (s.k || []).find(k => k.i === i);
    await finishFloor(recOf(from));
    for (let j = from + 1; j < to; j++) silentFloor(j, recOf(j));
    currentBattleIndex = to;
    const area = document.getElementById('enemy-area');
    if (area) area.innerHTML = '';
    const nextIsBoss = isBossBattleIndex(to);
    if (nextIsBoss) stopDungeonBGM();
    await showBattleBanner(to + 1, currentDungeonBattles.length, nextIsBoss, (nextIsBoss && window.BossCloud && BossCloud.bannerOf) ? BossCloud.bannerOf(currentDungeonKey) : null);
    if (nextIsBoss && window.BossCloud && BossCloud.has(currentDungeonKey)) await BossCloud.play(currentDungeonKey, to);
    if (!(nextIsBoss && hasBossIntro())) playBattleBgm(to);
    await loadBattle(currentDungeonBattles[to], false);   // 先制攻撃などは相手の端末で済んでいる（結果は enemies/盤面/バフに入っている）
    await playEnemyAppear();
  }

  // 反映は1つずつ順番に（相手の操作の流れの途中の階層移動と、ターン終わりの反映が重ならないように）
  let applyLock = Promise.resolve();
  function locked(fn) { const p = applyLock.then(fn, fn); applyLock = p.catch(() => {}); return p; }
  MS.apply = function (json) { return locked(() => doApply(json)); };
  async function doApply(json) {
    const s = typeof json === 'string' ? JSON.parse(json) : json;
    if (!s) return;
    MS.applying = true;
    try {
      try { clearComboChips(); rdmg.forEach(el => { if (el) { el.textContent = ''; el.classList.remove('show', 'pop', 'boosting'); } }); } catch (e) {}
      if (s.bi > currentBattleIndex) await advanceTo(s);
      if (Array.isArray(s.en)) applyEnemies(s.en);
      if (s.g) setGridFromStr(s.g);
      applyBlind(s.bl);
      restoreRoulettes(s.rl);
      setBuffs(s.bf);
      MS.kills = Array.isArray(s.k) ? s.k : MS.kills;
      lockedEnemy = null;
      try { updateEnemyUI(); } catch (e) {}
      try { updateEnemyTurnBadge(); } catch (e) {}
      currentMoveMs = calcCurrentMoveMs();
      try { renderParty(); } catch (e) {}
      try { renderBuffIcons(); } catch (e) {}
      try { updatePlayerHP(); } catch (e) {}
    } finally {
      MS.applying = false;
    }
  }

  // 全員ゲームオーバー（観戦中の人も、いっしょにゲームオーバー画面へ）
  function allDead() {
    if (_gameOverActive) return;
    MS.endSpectate();
    MS.remote = true;
    try { triggerGameOver(); } finally { MS.remote = false; }
  }

  // ---------- 脱落（ゲームオーバーになったが、のこりの人がいる） ----------
  //   自分が脱落できる（のこりの人がいる）なら true：観戦に回って、最後の状態を渡す。false なら普通のゲームオーバー
  MS.tryDie = function () {
    if (!on() || MS.remote || MS.spectating) return false;
    if (MultiTurn.localId === null || !window.MultiOnline) return false;
    const o = MultiOnline.opponent();
    if (!o || !o.present || o.dead) return false;   // あいてがもういない／すでに脱落 → 全滅
    MS.beginSpectate();
    MultiTurn.sendDead();   // 最後の盤面・敵の状態を渡して、あいてのターンにする
    return true;
  };
  MS.beginSpectate = function () {
    MS.spectating = true;
    busy = true;
    try { stopTimer(); } catch (e) {}
    timerStarted = false;
    try { if (dragEl) { dragEl.style.transform = ''; dragEl.classList.remove('dragging'); dragEl = null; } } catch (e) {}
    dragging = false;
    const g = document.getElementById('game');
    if (g) g.classList.add('game-over', 'mt-spectate');   // 盤面・パーティ・Menuの操作を止める（見るだけ）
    const lbl = document.getElementById('combo-label');
    if (lbl) lbl.textContent = '';
    stopGameOverSE(); playGameOverSE();
    if (window.MultiTurn) { MultiTurn.renderHud(); if (MultiTurn.banner) MultiTurn.banner('GAME OVER', '観戦モード', 1); }
    MS.setView(true);   // 観戦中は、のこりの人のパーティーを見る
  };
  MS.endSpectate = function () {
    MS.spectating = false;
    const g = document.getElementById('game'); if (g) g.classList.remove('mt-spectate');
    if (window.MultiTurn) MultiTurn.renderHud();
  };
  // あいての状態が変わった（players/{seat}/dead）。game.js の onOpponent から呼ぶ
  MS.onPartnerState = function (o) {
    if (!on() || !o || !o.dead || MultiTurn.localId === null) return;
    if (MS.spectating) { allDead(); return; }   // 自分も脱落済み → 2人とも倒れた
    MultiTurn.markDead(1 - MultiTurn.localId);
  };

  // ---------- できごと：クリア／ゲームオーバー ----------
  MS.sendClear = function () {
    if (!on() || MS.remote || !window.MultiOnline) return;
    MultiOnline.sendEvent('clear', JSON.stringify(MS.kills));
  };
  MS.sendOver = function () {
    if (!on() || MS.remote || !window.MultiOnline) return;
    MultiOnline.sendEvent('over', null);
  };
  MS.onEvent = async function (v) {
    if (!on() || !v) return;
    if (v.type === 'over') {   // のこっていた最後のひとりが倒れた
      if (_gameOverActive) return;
      allDead();
    } else if (v.type === 'clear') {
      if (_clearActive || _gameOverActive) return;
      let k = [];
      try { k = JSON.parse(v.data || '[]'); } catch (e) {}
      busy = true;
      MS.remote = true;
      try {
        await finishFloor(k.find(x => x.i === currentBattleIndex));
        MS.kills = k;
        if (MS.spectating) await playSpectatorClear();   // 観戦していた人：報酬なしのCLEAR画面
        else await finishDungeonClear();
      } finally { MS.remote = false; }
    }
  };

  // ---------- 操作中の盤面のミラー（見せるだけ） ----------
  let liveT = 0, liveTimer = null;
  function cancelLive() { if (liveTimer) { clearTimeout(liveTimer); liveTimer = null; } }
  MS.live = function (flush) {
    if (!on() || !window.MultiOnline || MultiTurn.localId === null || !MultiTurn.isMyTurn() || !grid.length) return;
    const send = () => {
      liveTimer = null; liveT = performance.now();
      if (!on() || !MultiTurn.isMyTurn()) return;
      MultiOnline.sendLive({ cur: MultiTurn.current, round: MultiTurn.round, g: gridStr() });
    };
    cancelLive();
    const wait = 140 - (performance.now() - liveT);
    if (flush || wait <= 0) send(); else liveTimer = setTimeout(send, wait);
  };
  MS.onLive = function (v) {
    if (!on() || !v || MultiTurn.isMyTurn() || MS.applying || MultiTurn._receiving) return;
    if (v.cur !== MultiTurn.current || v.round !== MultiTurn.round) return;   // 前のターンの古い盤面は無視
    if (typeof v.g === 'string') setGridFromStr(v.g);
  };


  // ============================================================
  //  相手のパーティー表示＋操作中のリアルタイム再生
  //    ・ターンが替わると、自分のパーティーが左へ消え、右から相手のパーティー（HP・SP・バインド）が入ってくる
  //    ・相手の操作中は、ドロップ操作（live）に加えて、コンボ・ダメージ・攻撃・敵のHP・敵の行動・HPの増減を順番に再生する
  //    ※ 本物の状態は、ターン終わりのスナップショットで必ず上書きされる（ここは見せるだけ）
  // ============================================================
  MS.rp = null;            // 相手のパーティー情報 { s:[[monsterId, 必要SP]|0 …6], hp, mx, sp, mem, bd:[[枠, 残りT]…], ls:[LS1, LS2], seal }
  MS.remoteView = false;   // いま画面に出ているのは「相手のパーティー」
  let rdmg = [];           // 相手パーティーの各スロットのダメージ数字の要素
  let viewChain = Promise.resolve();
  const asArr = v => (v == null ? [] : Array.isArray(v) ? v : Object.keys(v).map(k => v[k]));
  const $id = id => document.getElementById(id);

  // 自分のパーティー情報（相手に見せる分）
  MS.myParty = function () {
    const s = [], bd = [];
    for (let i = 0; i < 6; i++) {
      const uid = i < partyUids.length ? partyUids[i] : null;
      let o = 0;
      if (uid !== null) {
        const e = box.find(b => b.uid === uid), m = e && MONSTER_DATA[e.monsterId];
        if (m) {
          o = [e.monsterId, getRequiredSp(e, m)];
          if (bindTimers[uid] && bindTimers[uid] > 0) bd.push([i, bindTimers[uid]]);
        }
      }
      s.push(o);
    }
    const ls = [0, 5].map(idx => {
      const uid = partyUids.length > idx ? partyUids[idx] : null;
      const e = uid !== null && box.find(b => b.uid === uid), m = e && MONSTER_DATA[e.monsterId];
      return (m && m.leaderSkill && m.leaderSkill.desc) || '（なし）';
    });
    return { s, hp: Math.round(playerCurrentHP), mx: Math.round(playerMaxHP), sp: partySp, mem: partyMemory, bd, ls, seal: isSkillSealed() ? 1 : 0 };
  };
  MS.publishParty = function () {
    if (!on() || !window.MultiOnline) return;
    try { MultiOnline.sendParty(MS.myParty()); } catch (e) {}
  };
  MS.onParty = function (v) {
    if (!v) return;
    v.s = asArr(v.s).map(x => (x ? asArr(x) : 0));
    v.bd = asArr(v.bd).map(asArr);
    v.ls = asArr(v.ls);
    MS.rp = v;
    if (MS.remoteView) MS.paintRemote();
  };

  // ---- 相手パーティーの描画（本物の #party-grid / HPバー / SPゲージにそのまま描く＝見た目は自分のと同じ） ----
  function paintRemoteParty() {
    const p = MS.rp, grid = $id('party-grid');
    if (!p || !grid) return;
    grid.innerHTML = '';
    rdmg = [];
    const colors = { fire: '#ff5555', water: '#55aaff', wood: '#55ff55', light: '#ffdd44', dark: '#cc77ff', heal: '#ff88aa' };
    const bound = {};
    (p.bd || []).forEach(b => { bound[b[0]] = b[1]; });
    for (let i = 0; i < 6; i++) {
      const slot = document.createElement('div');
      slot.className = 'party-slot';
      const d = p.s && p.s[i];
      const mon = d && MONSTER_DATA[d[0]];
      if (mon) {
        const img = document.createElement('img');
        img.src = monsterImg(mon); img.alt = mon.name; img.draggable = false;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:0';
        img.onerror = function () { this.style.display = 'none'; };
        slot.appendChild(img);
        const isBound = bound[i] > 0;
        if (p.sp >= (d[1] || 1) && !p.seal) {
          const ready = document.createElement('div');
          ready.className = 'skill-ready';
          ready.innerHTML = '<i class="sr-frame"></i><i class="sr-shine"></i>';
          slot.appendChild(ready);
          if (!isBound) { img.classList.add('sk-lift'); ready.classList.add('sk-lift'); } else { ready.style.opacity = '0.3'; }
        }
        if (isBound) {
          slot.classList.add('bound');
          const ov = document.createElement('div'); ov.className = 'bind-overlay'; slot.appendChild(ov);
          const lb = document.createElement('div'); lb.className = 'bind-turn-label'; lb.textContent = 'バインド ' + bound[i] + 'T'; slot.appendChild(lb);
        }
        const dm = document.createElement('div');
        dm.className = 'monster-damage';
        dm.style.color = colors[mon.attr] || '#fff';
        slot.appendChild(dm);
        rdmg.push(dm);
      } else rdmg.push(null);
      grid.appendChild(slot);
    }
  }
  function paintRemoteHp() {
    const p = MS.rp;
    if (!p) return;
    const mx = Math.max(0, p.mx || 0), hp = Math.max(0, Math.min(mx, p.hp || 0));
    const pct = mx > 0 ? hp / mx * 100 : 0;
    const bar = $id('player-hp-bar'), ghost = $id('hp-ghost'), label = $id('hp-label'), wrap = $id('bars-wrap');
    if (bar) bar.style.width = pct + '%';
    if (ghost) ghost.style.width = pct + '%';
    if (label) label.textContent = hp.toLocaleString() + ' / ' + mx.toLocaleString();
    if (wrap) { wrap.classList.toggle('hp-low', pct <= 25); }
  }
  function paintRemoteSp() {
    const p = MS.rp, bar = $id('sp-common-bar'), cnt = $id('sp-common-count');
    if (!p || !bar) return;
    bar.innerHTML = '';
    const sp = p.sp || 0;
    for (let i = 0; i < SP_CAP; i++) {
      const seg = document.createElement('div');
      seg.className = 'sp-common-seg';
      if (i < sp) { seg.classList.add('filled'); if (sp >= SP_CAP) seg.classList.add('ready'); }
      bar.appendChild(seg);
    }
    if (cnt) cnt.textContent = sp + ' / ' + SP_CAP;
  }
  function paintRemoteLs() {
    const p = MS.rp;
    if (!p) return;
    [0, 1].forEach(i => { try { setLeaderSkillText(i, (p.ls && p.ls[i]) || '（なし）'); } catch (e) {} });
  }
  MS.paintRemoteParty = paintRemoteParty; MS.paintRemoteHp = paintRemoteHp; MS.paintRemoteSp = paintRemoteSp; MS.paintRemoteLs = paintRemoteLs;
  MS.paintRemote = function () { paintRemoteParty(); paintRemoteHp(); paintRemoteSp(); paintRemoteLs(); };

  // ---- 自分⇄相手の切り替え：いまのパーティーが左へ消えて、右から次のパーティーが入ってくる ----
  const VIEW_IDS = ['party-grid', 'sp-common-wrap', 'hp-row'];
  async function doSetView(remote, animate) {
    if (MS.remoteView === remote) { if (remote) MS.paintRemote(); return; }
    const g = $id('game'), pa = $id('party-area');
    const els = VIEW_IDS.map($id).filter(Boolean);
    const play = (keys, opts) => Promise.all(els.map(el => (el.animate ? el.animate(keys, opts).finished.catch(() => {}) : Promise.resolve())));
    if (animate) await play([{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(-70%)', opacity: 0 }], { duration: 200, easing: 'ease-in', fill: 'forwards' });
    MS.remoteView = remote;
    if (g) g.classList.toggle('mt-remote', remote);
    if (pa && window.MultiTurn) pa.setAttribute('data-who', MultiTurn.name(1 - (MultiTurn.localId === null ? 0 : MultiTurn.localId)) + ' のパーティー');
    if (remote) MS.paintRemote();
    else { try { renderParty(); updateLeaderSkill2(); } catch (e) {} }
    if (animate) {
      els.forEach(el => { try { el.getAnimations().forEach(a => a.cancel()); } catch (e) {} });
      await play([{ transform: 'translateX(70%)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 240, easing: 'ease-out' });
    }
  }
  // remote=true：相手のパーティーを見せる／false：自分のに戻す
  MS.setView = function (remote, animate) {
    if (!on()) return Promise.resolve();
    viewChain = viewChain.then(() => doSetView(!!remote, animate !== false)).catch(() => {});
    return viewChain;
  };

  // ---- 自分の操作中の出来事を、相手へ順番に流す（自分のターンのときだけ） ----
  MS.fx = function (t, d) {
    if (!on() || MS.remote || MS.spectating || MS.applying || !window.MultiOnline) return;
    if (MultiTurn.localId === null || !MultiTurn.isMyTurn()) return;
    try { MultiOnline.sendFx({ tk: MultiTurn.current + ':' + MultiTurn.round, t, d: d === undefined ? null : d }); } catch (e) {}
  };
  MS.fxGrid = function () { MS.fx('g', gridStr()); };

  // ---- 相手の出来事を、届いた順に再生する ----
  let fxChain = Promise.resolve();
  MS.onFx = function (v) {
    if (!on() || !v) return;
    fxChain = fxChain.then(() => handleFx(v)).catch(e => console.error('[multi-share] fx', e));
  };
  // ターン終わりのスナップショットを反映する前に、流れてきた分を再生し終える（最大9秒）
  MS.drainFx = function () { return Promise.race([fxChain, new Promise(r => setTimeout(r, 9000))]); };
  function handleFx(v) {
    if (MS.applying) return;
    if (v.tk !== MultiTurn.current + ':' + MultiTurn.round) return;   // 前のターンの遅れて届いた分は捨てる
    if (MultiTurn.isMyTurn()) return;
    const fn = FX[v.t];
    return fn ? fn(v.d) : undefined;   // 階層移動など時間のかかるものは、終わるまで次を待つ
  }

  function cellEl(r, c) { return orbEls[r] && orbEls[r][c]; }
  // 盤面を反映する。落ちコンは、操作した人の画面の drop()（game.js）と同じ動きにする：
  //   消えたあとの空きマスの分だけ、残ったドロップは「元の位置から」下へ詰まり、新しいドロップは上から降ってくる
  //   （以前は変わったマスをぜんぶ上から出し直していたので、瞬間移動に見えた）
  let vanishing = new Set();   // cb で消えはじめたマス（まだ grid には残っている分）："r,c"
  function applyGridAnimated(str) {
    const rows = String(str || '').split('|').map(s => s.split(',').map(v => v || null));
    const cellH = $id('grid').getBoundingClientRect().height / ROWS;
    let maxFall = 0;
    for (let c = 0; c < COLS; c++) {
      // 落ちる前の列（消えたマスは空き）
      const existing = [];
      for (let r = 0; r < ROWS; r++) {
        if (grid[r][c] !== null && !vanishing.has(r + ',' + c)) existing.push({ type: grid[r][c], origR: r, blind: !!(blindCells[r] && blindCells[r][c]) });
      }
      const fillCount = ROWS - existing.length;
      let nulls = 0;
      for (let r = 0; r < ROWS; r++) if (!(rows[r] && rows[r][c])) nulls++;
      const consistent = nulls === 0 || nulls === fillCount;   // 補充あり／補充なし（落ちコンなし）のどちらかに合うときだけ、詰め方を再現
      for (let destR = 0; destR < ROWS; destR++) {
        const t = (rows[destR] && rows[destR][c]) || null;
        const el = cellEl(destR, c);
        const old = grid[destR][c];
        grid[destR][c] = t;
        let blind = false, startRows = 0;
        if (consistent && destR >= fillCount) { const ex = existing[destR - fillCount]; blind = ex.blind; startRows = destR - ex.origR; }
        else if (consistent) startRows = destR + 1;                         // 新しいドロップ：盤面の上から
        else startRows = (t !== old) ? 1.6 : 0;                             // ずれていたときの保険
        if (blindCells[destR]) { blindCells[destR][c] = blind; try { setBlindEl(destR, c); } catch (_) {} }
        if (!el) continue;
        if (!t) { el.style.transition = 'none'; el.style.transform = ''; el.className = 'orb vanish'; continue; }
        if (startRows <= 0) { el.style.transition = ''; el.style.transform = ''; el.className = 'orb ' + t; continue; }
        if (startRows > maxFall) maxFall = startRows;
        el.style.transition = 'none'; el.style.transform = 'translateY(-' + (cellH * startRows) + 'px)'; el.className = 'orb ' + t;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          el.style.transition = '';
          el.classList.add('drop-fast');
          el.style.setProperty('--fall-delay', (c * 0.008) + 's');
          el.style.transform = '';
        }));
      }
    }
    vanishing = new Set();
    setTimeout(() => { for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const e = cellEl(r, c); if (e) e.classList.remove('drop-fast'); } }, 140 + maxFall * 22 + COLS * 6 + 120);
  }
  // 敵のHPを、相手の画面と同じ値にする（減った分は着弾の演出つき。倒れたらドロップも）
  function hitEnemies(hps, cb, attr, slot) {
    const units = document.querySelectorAll('#enemy-area .enemy-unit');
    asArr(hps).forEach((hp, i) => {
      const e = enemyList[i];
      if (!e) return;
      const prev = e.hp;
      if (prev === hp) return;
      if (hp < prev) {
        const unit = units[i];
        if (unit) {
          const r = unit.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
          if (attr) { try { playAttrHitSE(attr); spawnEnergyBurst(x, y, attr, 1); spawnAttrImpact(attr, x, y, false); } catch (_) {} }
          try { showDamageNumber(x, y - 10, prev - hp, attr || undefined, false, slot == null ? null : slot); } catch (_) {}
          if (unit.animate) unit.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-5px,2px) scale(1.05)' }, { transform: 'translate(7px,-2px)' }, { transform: 'translate(0,0)' }], { duration: 230, easing: 'ease-out' });
        }
      }
      e.hp = hp;
      if (prev > 0 && hp <= 0) { e._killCombo = cb || 0; remoteDefeat(e); }
    });
    try { updateEnemyUI(); } catch (_) {}
  }
  const FX = {
    // コンボ：消える塊を光らせて消す＋コンボ表示
    cb(d) {
      const cells = asArr(d.k).map(a => ({ r: a[0], c: a[1] }));
      if (!d.add) {
        cells.forEach(({ r, c }) => { vanishing.add(r + ',' + c); try { revealBlind(r, c); } catch (_) {} const el = cellEl(r, c); if (el) el.className = 'orb ' + d.c + ' glow'; });
        setTimeout(() => cells.forEach(({ r, c }) => { const el = cellEl(r, c); if (el && el.className.indexOf('glow') >= 0) el.className = 'orb ' + d.c + ' vanish'; }), 220);
        setTimeout(() => cells.forEach(({ r, c }) => { const el = cellEl(r, c); if (el && el.className.indexOf('vanish') >= 0) grid[r][c] = null; }), 360);
      }
      try { playComboSound(d.n); } catch (_) {}
      try { addComboChip(d.n, cells, 1); } catch (_) {}
    },
    g(str) { applyGridAnimated(str); },
    // 各モンスターの攻撃力が積み上がる数字
    pd(a) {
      asArr(a).forEach((v, i) => { const el = rdmg[i]; if (el && v > 0) { el.textContent = Number(v).toLocaleString(); el.classList.add('show'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); } });
    },
    // 最終ダメージ（溜めて光る）
    fd(a) {
      const slots = document.querySelectorAll('#party-grid .party-slot');
      asArr(a).forEach((v, i) => {
        if (!(v > 0)) return;
        if (slots[i]) slots[i].classList.add('charging');
        const el = rdmg[i];
        if (el) { el.textContent = Number(v).toLocaleString(); el.classList.add('show'); el.classList.remove('pop', 'boosting'); void el.offsetWidth; el.classList.add('boosting'); }
      });
      setTimeout(() => { slots.forEach(s => s.classList.remove('charging')); rdmg.forEach(el => el && el.classList.remove('boosting')); }, 900);
    },
    // 攻撃開始：相手のモンスターから敵へ弾が飛ぶ
    at0(d) {
      const slot = document.querySelectorAll('#party-grid .party-slot')[d.s];
      const units = document.querySelectorAll('#enemy-area .enemy-unit');
      let ei = d.e;
      if (ei < 0 || !enemyList[ei] || enemyList[ei].hp <= 0) ei = enemyList.findIndex(e => e.hp > 0);
      const unit = units[ei];
      if (!slot || !unit) return;
      const sr = slot.getBoundingClientRect(), er = unit.getBoundingClientRect();
      const sx = sr.left + sr.width / 2, sy = sr.top + sr.height / 2;
      try { spawnCastRing(sx, sy, d.a, 1); } catch (_) {}
      if (slot.animate) slot.animate([{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-9px) scale(1.11)' }, { transform: 'translateY(0) scale(1)' }], { duration: 360, easing: 'ease-out' });
      try { flyAttrProjectile(sx, sy, er.left + er.width / 2, er.top + er.height / 2, d.a, ATK_FLY_MS); } catch (_) {}
    },
    // 着弾：敵のHPが減る
    at1(d) { hitEnemies(d.hp, d.cb, d.a, d.s); },
    // スキルなどで敵のHPが変わった
    en(d) { hitEnemies(d.hp, 0, null, null); },
    // 敵の行動：スキルウインドウ／カットイン・ため・弾・着弾（フラッシュ・揺れ）を、自分の画面と同じ演出で再生する
    //   （攻撃の効果そのものは適用しない：ダメージ数字は eh、HPは hp / ターン終わりの本物で）
    ea(d) {
      const e = enemyList[d.i];
      if (!e) return;
      const synth = d.r ? { skills: [{ type: 'damage_ratio' }] } : { skills: d.h > 0 ? [{ type: 'damage', repeat: d.h }] : [] };
      window._mtReplayN = (window._mtReplayN || 0) + 1;
      window._mtReplayNoWin = !d.w;
      let p;
      try { p = showEnemyAttackEffect(e, String(d.n || ''), synth, !!d.p, !!d.w); } catch (_) { p = null; }
      window._mtReplayNoWin = false;
      const done = () => { window._mtReplayN = Math.max(0, (window._mtReplayN || 1) - 1); };
      if (p && p.then) p.then(done, done); else done();
    },
    // 敵から受けた1ヒット分の数字（相手のパーティー側）＋HPバーを少しずつ減らす
    eh(d) {
      const bars = $id('bars-wrap');
      if (bars) {
        const r = bars.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        const pop = document.createElement('div');
        const hi = d.hi || 0;
        pop.style.cssText = d.au
          ? 'position:fixed;left:' + x + 'px;top:' + (y - 36) + 'px;transform:translate(-50%,-50%);font-size:1.7rem;font-weight:900;color:#fff;text-shadow:0 0 8px #f55,0 0 18px #f55,0 2px 0 rgba(0,0,0,.85);pointer-events:none;z-index:240;white-space:nowrap;animation:enemyDmgPop 1.3s ease-out forwards;'
          : 'position:fixed;left:' + (x + (hi % 2 === 0 ? -20 : 20)) + 'px;top:' + (y - 40 - (hi % 6) * 28) + 'px;transform:translate(-50%,-50%);font-size:1.05rem;font-weight:900;color:#ff4444;text-shadow:0 0 8px rgba(0,0,0,.9),0 1px 0 rgba(0,0,0,.8);pointer-events:none;z-index:200;white-space:nowrap;animation:enemyDmgPop 1.0s ease-out forwards;';
        pop.textContent = '-' + Number(d.d || 0).toLocaleString();
        document.body.appendChild(pop);
        setTimeout(() => pop.remove(), d.au ? 1400 : 1100);
      }
      if (MS.rp) { MS.rp.hp = Math.max(0, (MS.rp.hp || 0) - (d.d || 0)); paintRemoteHp(); }   // 本当のHPは、直後の hp で合わせる
    },
    // 次の階層へ：バナー・敵の登場を、相手の画面でも同時に（終わるまで次の流れを待つ）
    nf(d) {
      return locked(async () => {
        if (!(d.bi > currentBattleIndex)) return;
        MS.applying = true;
        try { await advanceTo({ bi: d.bi, k: asArr(d.k) }); } finally { MS.applying = false; }
      });
    },
    // 次の階層の敵の状態（先制攻撃の結果など）・盤面・バフを、相手の画面へそろえる
    ss(snap) { return MS.apply(snap); },
    // 相手のHP
    hp(d) {
      if (!MS.rp) return;
      const prev = MS.rp.hp;
      MS.rp.hp = d.hp; MS.rp.mx = d.mx;
      paintRemoteHp();
      const tr = $id('hp-track');
      if (d.hp < prev && tr && tr.animate) tr.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(2) saturate(1.6)' }, { filter: 'brightness(1)' }], { duration: 300 });
    },
    // 相手のSP
    sp(d) { if (!MS.rp) return; MS.rp.sp = d.sp; MS.rp.mem = d.mem; paintRemoteSp(); },
    // スキル発動
    sk(d) { try { showSkillMessage('✨ ' + (d.n || 'スキル発動！'), 1400); playSkillSound(); } catch (_) {} },
  };

  window.MultiShare = MS;
})();
