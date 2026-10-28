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
//
//   game.js の変数は、同じグローバル領域として直接読み書きする（このファイルは game.js のあとに読み込む）
// ============================================================
(function () {
  const MS = {
    kills: [],       // 倒したバトルの記録（累積）：{ i:階層番号, fled:[0/1,…], combo:[…] }
    remote: false,   // 相手の知らせでゲームオーバー／クリアを起こしている最中（知らせの送り返し防止）
    applying: false, // 相手の状態を反映している最中
  };

  const on = () => !!(window.MultiTurn && MultiTurn.online && MultiTurn.active);
  // ダンジョンの準備中（MultiTurn.begin の前）でも、オンラインの部屋に入っていれば true
  const inRoom = () => !!(window.MultiTurn && MultiTurn.online && window.MultiOnline && MultiOnline.room);
  MS.on = on;
  MS.reset = function () { MS.kills = []; MS.remote = false; MS.applying = false; cancelLive(); };

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
      const p = Object.assign({}, def, { hp: 0, _fled: !!(rec && rec.fled && rec.fled[i]), _killCombo: (rec && rec.combo && rec.combo[i]) || 0, _dropChecked: false });
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

  MS.apply = async function (json) {
    const s = typeof json === 'string' ? JSON.parse(json) : json;
    if (!s) return;
    MS.applying = true;
    try {
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
    if (v.type === 'over') {
      if (_gameOverActive) return;
      MS.remote = true;
      try { triggerGameOver(); } finally { MS.remote = false; }
    } else if (v.type === 'clear') {
      if (_clearActive || _gameOverActive) return;
      let k = [];
      try { k = JSON.parse(v.data || '[]'); } catch (e) {}
      busy = true;
      MS.remote = true;
      try {
        await finishFloor(k.find(x => x.i === currentBattleIndex));
        MS.kills = k;
        await finishDungeonClear();
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

  window.MultiShare = MS;
})();
