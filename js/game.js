// ============================================================
// リーダースキル「全パラメータ○倍」(allStat) を HP/攻撃/回復 の3効果に展開（起動時に1回）
//   { type:'allStat', value:1.5 }                          → 全属性の全パラメータ1.5倍
//   { type:'allStat', attr:'light', value:1.2 }            → 光属性の全パラメータ1.2倍
//   { type:'allStat', condition:'type', attr:'回復', value:1.5 } → 回復タイプの全パラメータ1.5倍
// ============================================================
(function expandAllStatLeader() {
  try {
    if (typeof MONSTER_DATA === 'undefined') return;
    for (const m of Object.values(MONSTER_DATA)) {
      const effs = m && m.leaderSkill && m.leaderSkill.effects;
      if (!Array.isArray(effs) || !effs.some(e => e && e.type === 'allStat')) continue;
      const out = [];
      for (const e of effs) {
        if (e && e.type === 'allStat') {
          for (const t of ['hp', 'atk', 'rec']) {
            const x = { type: t, value: e.value };
            if (e.condition) x.condition = e.condition;
            if (e.attr !== undefined && e.attr !== '') x.attr = e.attr;
            out.push(x);
          }
        } else out.push(e);
      }
      m.leaderSkill.effects = out;
    }
  } catch (err) { console.error('allStat expand error', err); }
})();

// ============================================================
// BGM管理 (menu.mp3)
// ============================================================
let menuAudio = null;
let isMenuPlaying = false;
const MENU_BGM_VOL = 0.5;          // 通常の音量
const MENU_BGM_VOL_RESULT = 0.15;  // リザルト画面中の音量（小さめ）
const MENU_BGM_FADE_MS = 1800;     // リザルトを閉じた時のフェードイン時間
let _menuFadeTimer = null;

function _cancelMenuFade() { if (_menuFadeTimer) { cancelAnimationFrame(_menuFadeTimer); _menuFadeTimer = null; } }
function _menuFadeTo(target, ms) {
  _cancelMenuFade();
  if (!menuAudio) return;
  const from = menuAudio.volume, t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    try { menuAudio.volume = Math.max(0, Math.min(1, from + (target - from) * k)); } catch (e) {}
    _menuFadeTimer = k < 1 ? requestAnimationFrame(step) : null;
  };
  _menuFadeTimer = requestAnimationFrame(step);
}

function startMenuBGM(vol) {
  const v = (typeof vol === 'number') ? vol : MENU_BGM_VOL;
  if (isMenuPlaying) { if (typeof vol === 'number') { _cancelMenuFade(); if (menuAudio) menuAudio.volume = v; } return; }
  try {
    if (!menuAudio) {
      menuAudio = new Audio('menu.mp3');
      menuAudio.loop = true;
    }
    _cancelMenuFade();
    menuAudio.volume = v;
    isMenuPlaying = true;
    const pr = menuAudio.play();
    if (pr && pr.catch) pr.catch(() => { isMenuPlaying = false; }); // 自動再生ブロック時は未再生扱いに戻す
  } catch(e) { isMenuPlaying = false; }
}
// リザルト画面中：menu.mp3 を小さめの音量で流す
function startResultMenuBGM() { startMenuBGM(MENU_BGM_VOL_RESULT); }
// リザルトを閉じた時：今の音量から通常音量へフェードイン（未再生なら無音から開始）
function fadeInMenuBGM() {
  if (!isMenuPlaying) startMenuBGM(0);
  _menuFadeTo(MENU_BGM_VOL, MENU_BGM_FADE_MS);
}

// 画面のどこかを最初にタップした時点でホームBGMを再生する（自動再生制限対策）
// ホーム画面表示中のみ。ダンジョン中はダンジョンBGMを優先する。
function _unlockMenuBGM() {
  const rs = document.getElementById('result-screen');
  if (rs && rs.style.display === 'flex') { startResultMenuBGM(); return; }   // リザルト画面中は小さめの音量で流す
  const home = document.getElementById('home');
  if (home && getComputedStyle(home).display !== 'none') startMenuBGM();
  if (isMenuPlaying && menuAudio && !menuAudio.paused) {
    ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(ev => document.removeEventListener(ev, _unlockMenuBGM, true));
  }
}
['pointerdown', 'touchstart', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, _unlockMenuBGM, true));

function stopMenuBGM() {
  _cancelMenuFade();
  if (menuAudio) {
    menuAudio.pause();
    menuAudio.currentTime = 0;
  }
  isMenuPlaying = false;
}

// ============================================================
// 音声関連 (combo, drop, skill)
// ============================================================
let comboAudio = null;
let dropAudio = null;
let skillAudio = null;

function playComboSound(comboCount) {
  try {
    if (!comboAudio) {
      comboAudio = new Audio('combo.mp3');
      comboAudio.preservesPitch = false;
    }
    comboAudio.currentTime = 0;
    const rate = Math.min(2.0, 1.0 + (comboCount - 1) * 0.035);
    comboAudio.playbackRate = rate;
    comboAudio.play().catch(e => {});
  } catch(e) {}
}

function playDropSound() {
  try {
    if (!dropAudio) {
      dropAudio = new Audio('drop.mp3');
    }
    dropAudio.currentTime = 0;
    dropAudio.play().catch(e => {});
  } catch(e) {}
}

function playSkillSound() {
  playSE('skillgo');   // スキル発動音 (skillgo.mp3)
}

// ============================================================
// バトル効果音（同時に重なっても途切れないようプール再生）
// ============================================================
const BATTLE_SE = {
  skills:      { file: 'skills.mp3',      pool: 2, vol: 0.8 },  // スキルが使えるようになった
  skillgo:     { file: 'skillgo.mp3',     pool: 2, vol: 0.8 },  // スキル発動
  fire:        { file: 'fire.mp3',        pool: 4, vol: 0.7 },  // 属性攻撃ヒット
  water:       { file: 'water.mp3',       pool: 4, vol: 0.7 },
  grass:       { file: 'grass.mp3',       pool: 4, vol: 0.7 },
  shiny:       { file: 'shiny.mp3',       pool: 4, vol: 0.7 },
  dark:        { file: 'dark.mp3',        pool: 4, vol: 0.7 },
  heal:        { file: 'heal.mp3',        pool: 2, vol: 0.8 },  // 回復ドロップで回復
  attackup:    { file: 'aup.mp3',         pool: 2, vol: 0.8 },  // 攻撃力アップ(倍率計算で上がる時)
  skillk:      { file: 'skillk.mp3',      pool: 2, vol: 0.8 },  // ○倍攻撃スキルで敵にダメージ
  pahu:        { file: 'tedrop.mp3',        pool: 3, vol: 0.8 },  // 敵からドロップ生成
  roo:         { file: 'roo.mp3',         pool: 3, vol: 0.9 },  // ルーレット生成（敵・味方どちらのスキルでも）
  dropc:       { file: 'dropc.mp3',       pool: 2, vol: 0.8 },  // スキルでドロップ生成・変換
  damage:      { file: 'damage.mp3',      pool: 4, vol: 0.8 },  // 敵から被ダメージ
  damageh:     { file: 'damageh.mp3',     pool: 4, vol: 0.8 },  // 攻撃力ダウン（敵スキル）
  down:        { file: 'down.mp3',        pool: 2, vol: 0.9 },  // 妨害を受けた時：攻撃力ダウン・回復力ダウン・操作時間短縮（敵スキル）
  sdamage:     { file: 'sdamage.mp3',     pool: 4, vol: 0.8 },  // 軽減しながら被ダメージ
  kei:         { file: 'kei.mp3',         pool: 3, vol: 0.9 },  // リーダースキルのダメージ軽減が発動
  bshield:     { file: 'bshield.mp3',     pool: 3, vol: 0.9 },  // 軽減・吸収：敵のダメージ軽減／属性軽減／コンボ吸収、プレイヤーのダメージ軽減スキル
  bind:        { file: 'bind.mp3',        pool: 2, vol: 0.9 },  // バインドされた時（スキル使用不可もこの音）
  dna:         { file: 'dna.mp3',         pool: 2, vol: 0.9 },  // 敵の「落ちコンなし」妨害を受けた時
  lock:        { file: 'drop.mp3',        pool: 2, vol: 0.8 },  // ロックオン
  chip:        { file: 'chip.mp3',        pool: 3, vol: 0.8 },  // 敵からエッグ／チップ
  skilldamage: { file: 'skilldamage.mp3', pool: 2, vol: 0.8 },  // スキルで敵にダメージ
  combok:      { file: 'bshield.mp3',     pool: 1, vol: 0.9 },  // 敵 コンボ吸収（bshield.mp3）
  barrier:     { file: 'barrier.mp3',     pool: 1, vol: 0.9 },  // 敵 状態異常無効
  ikari:       { file: 'ikari.mp3',       pool: 1, vol: 0.9 },  // 敵 攻撃アップ
  healk:       { file: 'healk.mp3',       pool: 1, vol: 0.9 },  // 敵 HP回復
  skillwin:    { file: 'skillwin.wav',    pool: 1, vol: 0.9 },  // 敵スキルウインドウ表示
  cutin:       { file: 'cutin.mp3',       pool: 1, vol: 1.0 },  // 敵の必殺技（⚠️付き）のカットイン
  bossk:       { file: 'bossk.mp3',       pool: 1, vol: 0.9 },  // BOSS表示
  mewtwo:      { file: 'mewtwo.mp3',      pool: 1, vol: 1.0 },  // ミュウツーが完全に出てきたとき（ラスボス登場）
  bc:          { file: 'bc.mp3',          pool: 1, vol: 0.9 },  // Battle n/m 表示
  clear:       { file: 'clear.mp3',       pool: 1, vol: 0.9 },  // クリア
  gameover:    { file: 'gameover.mp3',    pool: 1, vol: 0.9 },  // ゲームオーバー
  levelup:     { file: 'levelup.mp3',     pool: 2, vol: 0.9 },  // レベルアップ
  kieru:       { file: 'kieru.mp3',       pool: 3, vol: 0.8 },  // 敵が消える
  darkness:    { file: 'darkness.mp3',    pool: 1, vol: 0.9 },  // 敵 暗闇（盤面のドロップが見えなくなる）
  poison:      { file: 'poison.mp3',      pool: 1, vol: 0.9 },  // 毒ダメージを受けた時
  change:      { file: 'change.mp3',      pool: 1, vol: 0.9 },  // 敵 行動変化
  tsstart:     { file: 'start.mp3',       pool: 1, vol: 0.9 },  // 時を止める：開始音
  tstick:      { file: 'time.mp3',        pool: 3, vol: 1.0 }   // 時を止める：時計の「カチッ」（速度を変えて カチ／コチ）
};
const _seState = {};
function playSE(name, rate) {
  try {
    const def = BATTLE_SE[name];
    if (!def) return;
    let st = _seState[name];
    if (!st) {
      st = _seState[name] = { pool: [], idx: 0 };
      for (let i = 0; i < def.pool; i++) {
        const a = new Audio(def.file);
        a.preload = 'auto';
        a.volume = def.vol;
        st.pool.push(a);
      }
    }
    const a = st.pool[st.idx];
    st.idx = (st.idx + 1) % st.pool.length;
    a.currentTime = 0;
    a.preservesPitch = false; a.mozPreservesPitch = false; a.webkitPreservesPitch = false;   // 速度を変えると音の高さも変わる
    a.playbackRate = rate || 1;
    a.play().catch(() => {});
  } catch (e) {}
}
const ATTR_HIT_SE = { fire: 'fire', water: 'water', wood: 'grass', light: 'shiny', dark: 'dark' };
function playAttrHitSE(attr) { const n = ATTR_HIT_SE[attr]; if (n) playSE(n); }
function playGameOverSE() { playSE('gameover'); }
// ゲームオーバー音を確実に止める（ホームに戻ったら絶対に鳴らさない）
function _stopSEByName(name) {
  try {
    const st = _seState[name];
    if (st) st.pool.forEach(a => { try { a.pause(); a.currentTime = 0; } catch (e) {} });
  } catch (e) {}
}
function stopGameOverSE() { _stopSEByName('gameover'); }
function stopClearSE() { _stopSEByName('clear'); }   // クリア音（ホームに戻ったら絶対に止める）

// ============================================================
// ゲームオーバー演出（パズドラ風）
//  1) gameover.mp3 を鳴らしながらドロップが崩れ落ちる
//  2) 盤面に「GAMEOVER」の文字が出る
//  3) タップすると盤面に「ホームへ」ボタンが出る → 押すとホームへ戻る
// ============================================================
let _gameOverActive = false;
function triggerGameOver() {
  if (_gameOverActive || (window.MultiShare && MultiShare.spectating)) return;
  // マルチ：のこりの人がいるなら全滅ではない → 自分は観戦に回り、あいてがひとりで続ける
  if (window.MultiShare && MultiShare.tryDie()) return;
  _gameOverActive = true;
  if (window.MultiShare) MultiShare.sendOver();   // マルチ：相手の画面もゲームオーバー（2人で1つの戦場）
  busy = true;
  try { stopTimer(); } catch (e) {}
  timerStarted = false;
  try { if (dragEl) { dragEl.style.transform = ''; dragEl.classList.remove('dragging'); dragEl = null; } } catch (e) {}
  dragging = false;
  const gameEl = document.getElementById('game');
  if (gameEl) gameEl.classList.add('game-over');   // パーティ・Menuの操作を止める
  const lbl = document.getElementById('combo-label');
  if (lbl) lbl.textContent = '';
  stopDungeonBGM();      // BGMを止めてゲームオーバー音だけにする
  stopGameOverSE();
  playGameOverSE();

  const wrap = document.getElementById('grid-wrap');
  if (!wrap) { _gameOverGoHome(); return; }
  wrap.classList.add('go-collapsing');
  // 盤面操作を完全に遮る・タップを受けるオーバーレイ
  const ov = document.createElement('div');
  ov.id = 'gameover-overlay';
  ov.innerHTML = '<div id="gameover-text">' + gameOverLogoSVG() + '</div>' +
                 '<button id="gameover-home-btn" class="btn btn-primary btn-cta" type="button">ホームへ</button>';
  wrap.appendChild(ov);
  const txt = ov.querySelector('#gameover-text');
  const btn = ov.querySelector('#gameover-home-btn');
  const swallow = (e) => { e.stopPropagation(); };
  ['touchstart', 'touchmove', 'mousedown'].forEach(ev => ov.addEventListener(ev, swallow, { passive: true }));

  // ── ドロップが崩れ落ちる（下の段から、少しずつずれて） ──
  const orbs = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const el = orbEls[r] && orbEls[r][c];
    if (el) orbs.push({ el, r, c });
  }
  const fallDist = wrap.getBoundingClientRect().height + 80;
  let maxEnd = 0;
  orbs.forEach(({ el, r }) => {
    el.style.transition = 'none';
    const delay = (ROWS - 1 - r) * 85 + Math.random() * 140;
    const dur = 520 + Math.random() * 240;
    maxEnd = Math.max(maxEnd, delay + dur);
    const rot = (Math.random() - 0.5) * 70;
    const dx = (Math.random() - 0.5) * 24;
    const hide = () => { el.style.visibility = 'hidden'; };
    if (!el.animate) { setTimeout(hide, delay + dur); return; }
    const anim = el.animate([
      { transform: 'translate(0,0) rotate(0deg)', opacity: 1, offset: 0 },
      { transform: `translate(${dx * 0.3}px,-6px) rotate(${rot * 0.2}deg)`, opacity: 1, offset: 0.12 },
      { transform: `translate(${dx}px,${fallDist}px) rotate(${rot}deg)`, opacity: 0.2, offset: 1 }
    ], { duration: dur, delay, easing: 'cubic-bezier(.5,0,.9,.55)', fill: 'both' });
    anim.onfinish = hide;
  });

  // ── 文字 → タップ待ち → ホームボタン ──
  let ready = false, btnShown = false;
  setTimeout(() => {
    txt.classList.add('show');
    setTimeout(() => { ready = true; }, 650);
  }, Math.max(500, maxEnd - 250));

  ov.addEventListener('click', (e) => {
    if (e.target === btn) return;      // ボタン自体は下のハンドラ
    if (!ready || btnShown) return;
    btnShown = true;
    btn.classList.add('show');
  });
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!btnShown) return;
    _gameOverGoHome();
  });
}

// 本家風の「GAMEOVER」ロゴ（細身で太い角ばった文字。Vは U のように底が平ら）
function gameOverLogoSVG() {
  // 各文字：[幅, 中心線パス]（高さ100・線幅20 → 見た目は幅W×高さ100）
  const G = [
    [60, 'M50 10H10V90H50V52H30'],            // G
    [60, 'M9 90L18 10H42L51 90M12 60H48'],  // A
    [70, 'M10 90V10L35 52L60 10V90'],         // M
    [60, 'M50 10H10V90H50M10 50H44'],         // E
    [60, 'M10 10H50V90H10Z'],                 // O
    [60, 'M10 10V90H50V10'],                  // V（Uの形）
    [60, 'M50 10H10V90H50M10 50H44'],         // E
    [60, 'M10 90V10H50V50H10M28 50L50 90']    // R
  ];
  const GAP = 8;
  let x = 0, paths = '';
  G.forEach(([w, d]) => { paths += `<path transform="translate(${x} 0)" d="${d}"/>`; x += w + GAP; });
  const total = x - GAP;
  const pad = 22;
  return `<svg viewBox="${-pad} ${-pad} ${total + pad * 2} ${100 + pad * 2}" xmlns="http://www.w3.org/2000/svg" aria-label="GAMEOVER">` +
    `<defs><linearGradient id="goRed" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100">` +
    `<stop offset="0" stop-color="#ff5b4d"/><stop offset="1" stop-color="#e82f2f"/></linearGradient></defs>` +
    `<g fill="none" stroke="#120000" stroke-width="46" stroke-linejoin="round" stroke-linecap="round" transform="translate(0 4)">${paths}</g>` +
    `<g fill="none" stroke="#120000" stroke-width="46" stroke-linejoin="round" stroke-linecap="round">${paths}</g>` +
    `<g fill="none" stroke="url(#goRed)" stroke-width="20" stroke-linejoin="miter" stroke-miterlimit="3" stroke-linecap="butt">${paths}</g>` +
    `</svg>`;
}

function _gameOverGoHome() {
  restoreTransforms();   // 負けたら変身は必ず解ける
  stopGameOverSE();                    // ★ホームへ戻る時にゲームオーバー音を必ず止める
  const ov = document.getElementById('gameover-overlay');
  if (ov) ov.remove();
  const wrap = document.getElementById('grid-wrap');
  if (wrap) wrap.classList.remove('go-collapsing');
  resetClearState();   // マルチ：観戦中のCLEAR画面（報酬なし）を片づける
  const gameEl = document.getElementById('game');
  if (gameEl) { gameEl.classList.remove('game-over', 'mt-spectate'); gameEl.style.display = 'none'; }
  document.getElementById('home').style.display = 'flex';
  stopDungeonBGM();
  startMenuBGM();
  stopGameOverSE();
  _gameOverActive = false;
  busy = false;
  if (window.MultiTurn) MultiTurn.end();   // マルチ：部屋から退出
  setTimeout(() => { try { scrollHomeToFrontier(); } catch (e) {} }, 50);
}
// 念のための保険：どの経路でもホーム画面が表示されたらゲームオーバー音を止める
(function () {
  const home = document.getElementById('home');
  if (!home || !window.MutationObserver) return;
  new MutationObserver(() => {
    if (home.style.display && home.style.display !== 'none') { stopGameOverSE(); stopClearSE(); restoreTransforms(); }
  }).observe(home, { attributes: true, attributeFilter: ['style', 'class'] });
})();

// ============================================================
// UI効果音 (tap.mp3 = 通常タップ / modo.mp3 = 戻る・閉じる)
// ============================================================
const UI_SE = {
  tap:  { file: 'tap.mp3',  pool: [], idx: 0, last: 0 },
  modo: { file: 'modo.mp3', pool: [], idx: 0, last: 0 }
};
function playUiSE(name) {
  try {
    const se = UI_SE[name];
    const now = performance.now();
    if (now - se.last < 60) return;          // 二重発火防止
    se.last = now;
    if (se.pool.length === 0) {
      for (let i = 0; i < 4; i++) {          // 連打でも途切れないよう複数用意
        const a = new Audio(se.file);
        a.preload = 'auto';
        a.volume = 0.7;
        se.pool.push(a);
      }
    }
    const a = se.pool[se.idx];
    se.idx = (se.idx + 1) % se.pool.length;
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch (e) {}
}
function playTapSound()  { playUiSE('tap'); }
function playModoSound() { playUiSE('modo'); }

// 戻る・閉じる系のボタン
const UI_BACK_SELECTOR = '#de-back-btn, #ss-back-btn, #md-back-btn, #te-back, #iku-back, #evo-list-back, #pz-back-btn, #zukan-back, #zukan-info-close, #mail-close-btn, #md2-back-btn, #res-close-btn, #sp-no, #menu-btn, #quit-no, #menu-drops-back, #cs-close, #cj-no, #menu-retire-no, .te-back-btn, #gameover-home-btn';
// 「進む」操作（画面遷移・決定・挑戦など）だけ tap.mp3
const UI_FORWARD_SELECTOR = '#start, #btn-team, #btn-grow, #btn-evo, #zukan-open-btn, #mail-open-btn, #bag-open-btn, .area-go, .ss-stage-btn, .de-mon-card, #de-challenge-btn, #md-levelup-btn, #md-evolve-btn, #iku-gassho-btn, #iku-result-ok, #sp-yes, #quit-yes, #md2-receive-btn, .mail-item, #lb-ok-btn, .evo-mat-detail, #cj-yes, .cs-spot.go';
document.addEventListener('click', (e) => {
  const t = e.target;
  if (!(t instanceof Element)) return;
  if (t.closest('#grid')) return;
  if (t.closest(UI_BACK_SELECTOR) || t.id === 'skill-confirm') playModoSound();
  else if (t.closest(UI_FORWARD_SELECTOR)) playTapSound();
}, true);

// ------------------------------------------------------------
// スワイプ音 (swipe.mp3)：スクロール開始で鳴る → 止まってまたスワイプすると再び鳴る
// ------------------------------------------------------------
const swipeSE = { audio: null, scrolling: false, idleTimer: null, touching: false, wheelUntil: 0 };
function playSwipeSound() {
  try {
    if (!swipeSE.audio) { swipeSE.audio = new Audio('swipe.mp3'); swipeSE.audio.preload = 'auto'; swipeSE.audio.volume = 0.6; }
    swipeSE.audio.currentTime = 0;
    swipeSE.audio.play().catch(() => {});
  } catch (e) {}
}
function swipeReset() { swipeSE.scrolling = false; clearTimeout(swipeSE.idleTimer); }
document.addEventListener('touchstart', () => { swipeSE.touching = true; swipeReset(); }, { capture: true, passive: true });
['touchend', 'touchcancel'].forEach(ev => document.addEventListener(ev, () => { swipeSE.touching = false; }, { capture: true, passive: true }));
document.addEventListener('mousedown', () => { swipeSE.touching = true; swipeReset(); }, true);
document.addEventListener('mouseup', () => { swipeSE.touching = false; }, true);
document.addEventListener('wheel', () => { swipeSE.wheelUntil = performance.now() + 300; if (!swipeSE.idleTimer) swipeReset(); }, { capture: true, passive: true });
// scroll は bubble しないので capture で全スクロール領域を拾う
document.addEventListener('scroll', (e) => {
  const t = e.target;
  if (t instanceof Element && t.closest('#grid')) return;
  if (!swipeSE.scrolling) {
    swipeSE.scrolling = true;
    // 指で触っている/ホイール操作中のみ（プログラムによる自動スクロールでは鳴らさない）
    if (swipeSE.touching || performance.now() < swipeSE.wheelUntil) playSwipeSound();
  }
  clearTimeout(swipeSE.idleTimer);
  swipeSE.idleTimer = setTimeout(() => { swipeSE.scrolling = false; }, 120);
}, true);

// ============================================================
// ★ リーダースキル効果適用関数（条件判定順序を整理） ★
// ============================================================
// 色数条件（○色以上同時に消すと）の判定。1色＝そのドロップを3個以上消した色。
//   fourColors / colorCount : 火水木光闇の色数（回復は数えない）。needHeal なら回復も消していること（5色＋回復など）
//   colorCountHeal          : 回復も1色に数える（6＝5色＋回復）
//   colorRamp               : 色数が増えるほど倍率アップ（最低色数で value、最大の色数で maxValue。間は段階的）
// 戻り値 { ok, mult }（mult は colorRamp のときだけ倍率）
function colorCondResult(eff, context) {
  const oc = (context && context.orbCounts) || {};
  const n5 = ['fire','water','wood','light','dark'].filter(a => (oc[a] || 0) >= 3).length;
  const heal = (oc.heal || 0) >= 3;
  const cond = eff.condition;
  const need = Math.max(1, Math.floor(eff.count) || (cond === 'fourColors' ? 4 : (cond === 'colorRamp' ? 3 : 1)));
  if (cond === 'fourColors' || cond === 'colorCount') {
    return { ok: n5 >= need && (!eff.needHeal || heal), mult: null };
  }
  if (cond === 'colorCountHeal') {
    return { ok: n5 + (heal ? 1 : 0) >= need, mult: null };
  }
  if (cond === 'colorRamp') {
    const withHeal = eff.healCounts !== false;
    const n = n5 + (withHeal && heal ? 1 : 0);
    const max = withHeal ? 6 : 5;
    if (n < need) return { ok: false, mult: null };
    const lo = eff.value || 1, hi = (eff.maxValue > 0 ? eff.maxValue : lo);
    const t = max > need ? Math.min(1, (n - need) / (max - need)) : 1;
    return { ok: true, mult: lo + (hi - lo) * t };
  }
  return { ok: false, mult: null };
}
// リーダー／フレンドのスキルに、指定タイプの効果があるか（毒ダメージ無効などの常時効果用）
function leaderHasEffect(type) {
  return [0, 5].some(idx => {
    if (partyUids.length <= idx || partyUids[idx] === null) return false;
    const e = box.find(b => b.uid === partyUids[idx]);
    const m = e && MONSTER_DATA[e.monsterId];
    return !!(m && m.leaderSkill && m.leaderSkill.effects && m.leaderSkill.effects.some(x => x.type === type));
  });
}
function applyLeaderEffects(effects, context) {
  let result = { hpMultiplier: 1.0, atkMultiplier: 1.0, dmgReduction: null, moveTimeFixed: null, comboAdd: 0, hpRecovery: 0, noDrop: false };
  if (!effects || !effects.length) return result;

  for (const eff of effects) {
    switch (eff.type) {
      case 'hp': {
        let applyHp = false;
        if (eff.condition === 'type') {
          if (context.monsterType === eff.attr) applyHp = true;
        } else if (!eff.attr || eff.attr === context.attr) {
          applyHp = true;
        }
        if (applyHp) result.hpMultiplier *= eff.value;
        break;
      }
      case 'moveTimeFixed':
        result.moveTimeFixed = eff.value;
        break;
      case 'noDrop':
        result.noDrop = true;
        break;
      case 'hpRecovery':
        result.hpRecovery = eff.value;
        break;
      case 'comboAdd': {
        let applyCombo = false;
        if (eff.condition === 'waterDarkConnect') {
          if (context.hasWaterConnect5 && context.hasDarkConnect5) applyCombo = true;
        }
        if (applyCombo) result.comboAdd = eff.value;
        break;
      }
      case 'atk': {
        // 条件を最優先で判定。attr は「条件なしの属性限定」として最後に評価。
        let apply = false;
        let rampMult = null;   // colorRamp のときの、色数に応じた倍率
        const cond = eff.condition;
        if (cond === 'type') {
          // 特定タイプ限定の攻撃倍率（例: 回復タイプの攻撃力2倍）
          if (context.monsterType === eff.attr) apply = true;
        } else if (cond === 'orbConnect') {
          if (eff.attr2) {
            // 2属性同時つなげ：eff.attr と eff.attr2 がそれぞれ count 個以上つながったグループが両方ある
            const mc = context.maxConnect || {};
            if ((mc[eff.attr] || 0) >= eff.count && (mc[eff.attr2] || 0) >= eff.count) apply = true;
          } else if (((context.maxConnect || {})[eff.attr] || 0) >= eff.count) apply = true;   // 1つにつながった塊の最大個数で判定
        } else if (cond === 'fourColors' || cond === 'colorCount' || cond === 'colorCountHeal' || cond === 'colorRamp') {
          const cr = colorCondResult(eff, context);
          if (cr.ok) { apply = true; rampMult = cr.mult; }
        } else if (cond === 'hpAbove') {
          if ((context.hpRatio || 0) >= eff.threshold) apply = true;
        } else if (cond === 'hpBelow') {
          { const _lo = context.hpRatioLow !== undefined ? context.hpRatioLow : context.hpRatio;
            if (_lo !== undefined && _lo <= eff.threshold) apply = true; }
        } else if (cond === 'skillUsed') {
          if (context.skillUsed) apply = true;
        } else if (cond === 'darkCombos') {
          if (context.darkCombos >= eff.count) apply = true;
        } else if (cond === 'exactCount') {
          if (context.exactAttrCounts && context.exactAttrCounts[eff.attr] && context.exactAttrCounts[eff.attr][eff.count]) apply = true;
        } else if (cond === 'waterDarkConnect') {
          if (context.hasWaterConnect5 && context.hasDarkConnect5) apply = true;
        } else if (cond === 'healCombos') {
          if (context.healCombos >= eff.count) apply = true;
        } else if (cond === 'remainingOrbs') {
          if (context.remainingOrbs !== undefined && context.remainingOrbs <= eff.threshold) apply = true;
        } else if (cond === 'cross') {
          // shapeAttr 指定あり＝その属性のドロップで作った十字だけ数える
          if (eff.shapeAttr ? ((context.crossAttrs || {})[eff.shapeAttr] || 0) > 0 : (context.crossCount || 0) > 0) apply = true;
        } else if (cond === 'combo') {
          if (context.comboCount >= eff.count) apply = true;
        } else if (cond === 'exact4') {
          if (context.exact4Count > 0) apply = true;
        } else if (cond === 'poison') {
          if ((context.poisonCount || 0) >= 3) apply = true;
        } else if (cond === 'fireCombos') {
          if ((context.fireCombos || 0) >= eff.count) apply = true;
        } else if (cond === 'attrCombos') {
          // 任意属性の同時コンボ数（例: 光の2コンボ以上）
          if (((context.attrCombos || {})[eff.attr] || 0) >= eff.count) apply = true;
        } else if (cond === 'hpFull') {
          if (context.hpRatio !== undefined && context.hpRatio >= 0.999) apply = true;
        } else if (cond === 'lShapes') {
          if (eff.shapeAttr ? ((context.lAttrs || {})[eff.shapeAttr] || 0) > 0 : (context.lShapes || 0) > 0) apply = true;
        } else {
          // 条件なし
          if (eff.attr) {
            if (eff.attr === context.attr) apply = true;
          } else {
            apply = true;
          }
        }

        if (apply) {
          // 攻撃倍率が未設定(0)で、軽減・コンボ加算だけ設定された効果は、攻撃倍率1倍として扱う
          const av = (rampMult !== null) ? rampMult : (eff.value > 0) ? eff.value : ((eff.reduce > 0 || eff.comboAdd > 0) ? 1 : eff.value);
          let expCount = 1;
          if (eff.exponential) {
            if (cond === 'lShapes') expCount = (eff.shapeAttr ? (context.lAttrs || {})[eff.shapeAttr] : context.lShapes) || 1;
            else if (cond === 'cross') expCount = (eff.shapeAttr ? (context.crossAttrs || {})[eff.shapeAttr] : context.crossCount) || 1;
            else if (cond === 'exact4') expCount = context.exact4Count || 1;
            result.atkMultiplier *= Math.pow(av, expCount);
          } else {
            result.atkMultiplier *= av;
          }
          // 同じ効果に「ダメージ軽減」も設定されていれば、条件達成時に軽減も有効
          if (eff.reduce > 0) {
            if (result.dmgReduction === null) result.dmgReduction = [];
            for (let k = 0; k < expCount; k++) result.dmgReduction.push(eff.reduce);   // 累乗系は条件を満たす度に重ねがけ
          }
        }
        break;
      }
      case 'dmgReduction': {
        if (result.dmgReduction === null) result.dmgReduction = [];
        const attrOk = !eff.attr || eff.attr === context.enemyAttr;
        let condOk = true;
        if (eff.condition === 'hpAbove') {
          condOk = (context.hpRatio !== undefined ? context.hpRatio : 1.0) >= eff.threshold;
        } else if (eff.condition === 'hpBelow') {
          condOk = (context.hpRatio !== undefined ? context.hpRatio : 1.0) <= eff.threshold;
        } else if (eff.condition === 'fourColors' || eff.condition === 'colorCount' || eff.condition === 'colorCountHeal' || eff.condition === 'colorRamp') {
          condOk = colorCondResult(eff, context).ok;
        } else if (eff.condition === 'remainingOrbs') {
          condOk = (context.remainingOrbs !== undefined && context.remainingOrbs <= eff.threshold);
        } else if (eff.condition === 'cross') {
          condOk = (context.crossCount || 0) > 0;
        }
        if (attrOk && condOk) {
          // 累乗系は条件を満たす度に重ねがけ（5%×2回 → 1-0.95²=9.75%）
          const n = eff.exponential ? Math.max(1, context.crossCount || 1) : 1;
          for (let k = 0; k < n; k++) result.dmgReduction.push(eff.value);
        }
        break;
      }
    }
  }
  return result;
}

// ============================================================
// ★ 敵行動エンジン ★
// ============================================================
// ============================================================
// ★ 敵スキル用ヘルパー（バインド細かい指定／割合ダメージ／攻撃力ダウン） ★
// ============================================================
const ATTR_NAME_JP = { fire:'火', water:'水', wood:'木', light:'光', dark:'闇' };
function rollIntRange(a, b) {
  a = Math.max(1, Math.floor(Number(a) || 1));
  b = Math.max(a, Math.floor(Number(b) || a));
  return a + Math.floor(Math.random() * (b - a + 1));
}
// バインドの対象とターン数を決める（毎回ここで抽選。演出側と効果側で共通）
//   target:'all'    … 全員
//   target:'attr'   … 指定した属性（attr）のモンスター全員
//   target:'random' … ランダムで countMin〜countMax 体（同じ数なら ぴったり〇体）
//   ターンは turnMin〜turnMax（同じ数なら ぴったり〇ターン）。旧形式 turn: N もそのまま使える
function pickBindTargets(sk) {
  const tMin = (sk.turnMin !== undefined) ? sk.turnMin : (sk.turn !== undefined ? sk.turn : 1);
  const tMax = (sk.turnMax !== undefined) ? sk.turnMax : tMin;
  let list = partyUids.map((u, i) => ({ u, i })).filter(t => t.u !== null);
  if (sk.target === 'attr') {
    list = list.filter(t => {
      const entry = box.find(b => b.uid === t.u);
      const mon = entry && MONSTER_DATA[entry.monsterId];
      return mon && mon.attr === sk.attr;
    });
  } else if (sk.target !== 'all') {
    const cMin = (sk.countMin !== undefined) ? sk.countMin : 1;
    const cMax = (sk.countMax !== undefined) ? sk.countMax : cMin;
    const n = Math.min(list.length, rollIntRange(cMin, cMax));
    list = list.slice().sort(() => Math.random() - 0.5).slice(0, n).sort((a, b) => a.i - b.i);
  }
  return list.map(t => ({ ...t, turns: rollIntRange(tMin, tMax) }));
}
// 割合ダメージの量（現在HP基準 or 最大HP基準）
//   hpNow … 「現在HP基準」のときの基準HP（省略=今のHP）。行動の最初のHPを渡すと、同じ行動内の他のダメージに左右されない
function calcRatioDamage(sk, hpNow) {
  if (hpNow === undefined) hpNow = playerCurrentHP;
  const rate = Math.max(0, Math.min(100, Number(sk.rate) || 0)) / 100;
  const base = (sk.basis === 'max') ? playerMaxHP : hpNow;
  let amt = Math.floor(base * rate);
  if (sk.survive) amt = Math.min(amt, Math.max(0, hpNow - 1));   // HP1で耐える
  return Math.max(0, Math.min(amt, hpNow));
}
// 割合ダメージを含む行動は、その行動で減るHPの合計が「割合ダメージの量」を超えないようにする
//   （例：攻撃力ダメージ ＋ 最大HP50% を同じ行動に入れても、合計は最大HP50%まで）
let _actionLossCap = null;   // { hp0: 行動開始時のHP, cap: 減らせる上限 }
function actionRatioCap(skills, hp0) {
  const rs = (skills || []).filter(sk => sk.type === 'damage_ratio');
  if (!rs.length) return null;
  return rs.reduce((sum, sk) => sum + calcRatioDamage(sk, hp0), 0);
}
// 割合ダメージは本家のグラビティと同じく、ダメージ軽減を無視して直接HPを減らす
function applyPlayerRatioDamage(sk) {
  let amt = calcRatioDamage(sk, _actionLossCap ? _actionLossCap.hp0 : undefined);
  if (_actionLossCap) {
    const taken = _actionLossCap.hp0 - playerCurrentHP;            // この行動でもう減った分
    amt = Math.min(amt, Math.max(0, _actionLossCap.cap - taken));
  }
  amt = Math.max(0, Math.min(amt, playerCurrentHP));
  if (amt <= 0) return 0;
  playerCurrentHP = Math.max(0, playerCurrentHP - amt);
  updatePlayerHP(-amt);
  return amt;
}
// 敵の攻撃力ダウンによる、指定属性モンスターの攻撃力倍率（1.0 = ダウンなし）
function enemyAtkDownMult(attr) {
  let m = 1;
  for (const d of enemyAtkDowns) if (d.turns > 0 && (d.attr === 'all' || d.attr === attr)) m *= (1 - d.rate);
  return Math.max(0, m);
}
// プレイヤーのエンハンス（攻撃力アップ）で、敵の攻撃力ダウンを上書き（解除）する
//   全属性エンハンス → ダウンを全部解除 / 〇属性エンハンス → その属性のダウンを解除
//   （「全属性ダウン」は、その属性だけ外れて他の4属性のダウンとして残る）
function overrideAtkDownByEnhance(attr) {
  if (!enemyAtkDowns.length) return;
  const ALL = ['fire', 'water', 'wood', 'light', 'dark'];
  if (!attr) { enemyAtkDowns = []; return; }
  const next = [];
  for (const d of enemyAtkDowns) {
    if (d.attr === attr) continue;
    if (d.attr === 'all') { ALL.filter(a => a !== attr).forEach(a => next.push({ attr: a, rate: d.rate, turns: d.turns })); continue; }
    next.push(d);
  }
  enemyAtkDowns = next;
}
function addEnemyAtkDown(attr, rate, turns) {
  const ex = enemyAtkDowns.find(d => d.attr === attr);
  if (ex) { ex.rate = Math.max(ex.rate, rate); ex.turns = Math.max(ex.turns, turns); }   // 同じ対象は強い方・長い方に更新
  else enemyAtkDowns.push({ attr, rate, turns });
}

// 属性軽減の属性。attr:'random' のときは火〜闇から1つを抽選（演出と効果で同じ属性になるよう、発動が終わるまで _rolled に保持）
function guardAttrOf(sk) {
  const ATTRS = ['fire', 'water', 'wood', 'light', 'dark'];
  if (sk.attr === 'random') {
    if (!sk._rolled) sk._rolled = ATTRS[Math.floor(Math.random() * ATTRS.length)];
    return sk._rolled;
  }
  return ATTRS.includes(sk.attr) ? sk.attr : 'dark';
}
function buildEnemyActionFn(skills, enemyRef) {
  return function(e) {
    const _hp0 = playerCurrentHP;
    const _cap = actionRatioCap(skills, _hp0);
    _actionLossCap = (_cap === null) ? null : { hp0: _hp0, cap: _cap };
    try {
    for (const sk of skills) {
      if (sk._fxApplied) { sk._fxApplied = false; continue; }   // 演出側で個別に適用済み（コンボ吸収・状態異常無効・攻撃アップ・回復）
      switch (sk.type) {
        case 'damage': {
          const repeat = sk.repeat || 1;
          const total = sk.value * repeat;
          applyPlayerDamage(total, e);
          break;
        }
        case 'damage_mult': {
          const val = Math.floor((e.atk || 0) * (sk.value || 1));
          applyPlayerDamage(val, e);
          break;
        }
        case 'bind': {
          // 全員 / 指定属性 / ランダム〇〜〇体 を、〇〜〇ターンバインド
          for (const t of pickBindTargets(sk)) bindTimers[t.u] = (bindTimers[t.u] || 0) + t.turns;
          updatePlayerHP();
          break;
        }
        case 'damage_ratio': {
          applyPlayerRatioDamage(sk);
          break;
        }
        case 'flee': {
          // 〈にげる〉：バトルから逃げる。倒した扱い（HP0）になるが、経験値・エナ・チップ・モンスターエッグは絶対に落とさない
          if (e._fled) break;
          e._fled = true;
          e._dropChecked = true;                       // ドロップ抽選（エナ・チップ・卵）を通さない
          e.exp = 0; e.coin = 0; e.drops = [];         // 念のため報酬データも空にする
          e.monsterDrop = { enabled: false, rate: 0 };
          e.hp = 0;                                    // 倒した判定（バトル終了判定・次のバトルへ進む）
          showSkillMessage(`${e.name || '敵'}は にげだした！`, 1200);
          updateEnemyUI();                             // ゆっくり消滅
          break;
        }
        case 'vanish': {
          // 〈消滅〉：敵が自分から消える。にげると違い、倒された時と同じようにエナ・経験値・チップ・モンスターを普通に落とす。
          // セリフはこの行動の「行動名」（青いスキルウインドウに出る）
          if (e._fled || e.hp <= 0) break;
          e.hp = 0;                                    // 倒した判定（バトル終了判定・次のバトルへ進む）
          tryDrop(e);                                  // エナ・チップ・モンスターのドロップ抽選
          updateEnemyUI();                             // 消滅演出
          break;
        }
        case 'atk_down': {
          const rate = Math.max(0, Math.min(100, Number(sk.rate) || 0)) / 100;
          const turns = Math.max(1, Math.floor(Number(sk.turn) || 1));
          addEnemyAtkDown(sk.target === 'all' ? 'all' : (sk.attr || 'fire'), rate, turns);
          playSE('down');   // 攻撃力ダウンを受けた時の効果音（down.mp3）
          renderBuffIcons();
          break;
        }
        case 'time_reduce': {
          // 操作時間を〇秒短縮（〇ターン）。プレイヤーの操作時間スキルを使うと上書きされて消える
          const secs = Math.max(0, Number(sk.seconds) || 1);
          const t = Math.max(1, Math.floor(Number(sk.turn) || 1));
          if (moveTimeFixed) { renderBuffIcons(); break; }   // 操作時間固定中は短縮が効かない
          if (!enemyMoveDown || secs >= enemyMoveDown.seconds) enemyMoveDown = { seconds: secs, turns: t };
          else enemyMoveDown.turns = Math.max(enemyMoveDown.turns, t);
          currentMoveMs = calcCurrentMoveMs();
          playSE('down');   // 操作時間短縮を受けた時の効果音（down.mp3）
          renderBuffIcons();
          break;
        }
        case 'rec_down': {
          // 回復力を〇倍（0なら回復できない）に〇ターン。プレイヤーの回復力スキルを使うと上書きされて消える
          const v = Math.max(0, Number(sk.value) >= 0 ? Number(sk.value) : 0);
          const t = Math.max(1, Math.floor(Number(sk.turn) || 1));
          enemyRecDown = { value: v, turns: t };
          playSE('down');   // 回復力ダウンを受けた時の効果音（down.mp3）
          renderBuffIcons();
          break;
        }
        case 'skill_seal': {
          // 〇ターンの間、スキル使用不可（チーム全員）。重ねがけは長い方に更新
          const t = Math.max(1, Math.floor(Number(sk.turn) || 1));
          enemySkillSeal = { turns: Math.max(t, enemySkillSeal ? enemySkillSeal.turns : 0) };
          playSE('bind');   // スキル使用不可：バインドと同じ効果音
          renderParty();
          renderBuffIcons();
          break;
        }
        case 'no_fall': {
          // 〇ターンの間、落ちコンなし（消しても上から新しいドロップが降ってこない）。重ねがけは長い方に更新
          const t = Math.max(1, Math.floor(Number(sk.turn) || 1));
          enemyNoFall = { turns: Math.max(t, enemyNoFall ? enemyNoFall.turns : 0) };
          playSE('dna');    // 落ちコンなし：dna.mp3
          renderBuffIcons();
          break;
        }
        case 'board_change': {
          playSE('pahu');   // 敵からドロップ生成・変換された時の効果音（tedrop.mp3）
          if (sk.pattern === '5color_heal' || sk.pattern === 'multi') {
            // 盤面全体を指定した色だけにランダム変換。選んだ各色は必ず3個以上になる（各色3個ずつ先に確保 → 残りはランダム）
            const ALL = ['fire','water','wood','light','dark','heal','poison','ojama'];
            let kinds = sk.pattern === '5color_heal'
              ? ['fire','water','wood','light','dark','heal']
              : (Array.isArray(sk.orbs) ? sk.orbs.filter(k => ALL.includes(k)) : ALL.filter(k => sk['orb_' + k]));
            if (kinds.length === 0) kinds = ['fire'];   // 未選択の保険
            const cells = [];
            for (let r=0; r<ROWS; r++) for (let c=0; c<COLS; c++) cells.push([r, c]);
            cells.sort(() => Math.random() - 0.5);
            const minEach = Math.min(3, Math.floor(cells.length / kinds.length));
            let i = 0;
            const place = (t) => { const [r, c] = cells[i++]; grid[r][c] = t; revealBlind(r, c); if (orbEls[r] && orbEls[r][c]) orbEls[r][c].className = 'orb ' + t; };
            for (const k of kinds) for (let n = 0; n < minEach; n++) place(k);
            while (i < cells.length) place(kinds[Math.floor(Math.random() * kinds.length)]);
          } else {
            const ORB_KINDS = ['fire','water','wood','light','dark','heal','poison','ojama'];   // 変換先・生成には毒・お邪魔も指定できる
            const ORB_SRC = ['fire','water','wood','light','dark','heal'];   // random_to の変換元（毒は対象外）
            const paint = (r, c, t) => {
              grid[r][c] = t; revealBlind(r, c);
              if (orbEls[r] && orbEls[r][c]) orbEls[r][c].className = 'orb ' + t;
            };
            const to = ORB_KINDS.includes(sk.to) ? sk.to : 'dark';
            if (sk.pattern === 'convert') {
              // 〇ドロップを〇ドロップに変化（from → to を盤面全体で）
              for (let r=0; r<ROWS; r++) for (let c=0; c<COLS; c++) if (grid[r][c] === sk.from) paint(r, c, to);
            } else if (sk.pattern === 'spawn') {
              // 盤面に〇ドロップを〇個生成（すでに to の場所以外からランダムに選ぶ）
              const cells = [];
              for (let r=0; r<ROWS; r++) for (let c=0; c<COLS; c++) if (grid[r][c] !== to) cells.push([r, c]);
              cells.sort(() => Math.random() - 0.5);
              const n = Math.max(0, Math.min(cells.length, Math.floor(sk.count || 0)));
              for (let i = 0; i < n; i++) paint(cells[i][0], cells[i][1], to);
            } else if (sk.pattern === 'row' || sk.pattern === 'col') {
              // 横1列／縦1列（lines 本）を〇ドロップに変化。pos='random' ならランダムな列、数字ならその位置から連続
              const isRow = sk.pattern === 'row', max = isRow ? ROWS : COLS;
              const n = Math.max(1, Math.min(max, Math.floor(Number(sk.lines) || 1)));
              let idx = [];
              const pos = Math.floor(Number(sk.pos));
              if (sk.pos !== 'random' && Number.isFinite(pos) && pos >= 1) {
                const st = Math.min(pos - 1, max - n);
                for (let i = 0; i < n; i++) idx.push(st + i);
              } else {
                const all = Array.from({ length: max }, (_, i) => i).sort(() => Math.random() - 0.5);
                idx = all.slice(0, n);
              }
              for (const k of idx) {
                if (isRow) for (let c = 0; c < COLS; c++) paint(k, c, to);
                else for (let r = 0; r < ROWS; r++) paint(r, k, to);
              }
            } else if (sk.pattern === 'random_to') {
              // ランダムな1色（盤面にある、to以外の色）を〇ドロップに変換
              const present = ORB_SRC.filter(k => k !== to && grid.some(row => row.includes(k)));
              if (present.length > 0) {
                const from = present[Math.floor(Math.random() * present.length)];
                for (let r=0; r<ROWS; r++) for (let c=0; c<COLS; c++) if (grid[r][c] === from) paint(r, c, to);
              }
            }
          }
          break;
        }
        case 'dark_board': {
          playSE('pahu');   // 敵からドロップ生成音（tedrop.mp3）
          for (let r=0; r<ROWS; r++) for (let c=0; c<COLS; c++) {
            grid[r][c] = 'dark'; revealBlind(r, c);
            if (orbEls[r] && orbEls[r][c]) orbEls[r][c].className = 'orb dark';
          }
          break;
        }
        case 'roulette': {
          // ルーレット：ランダムなマスに count 個、turn ターンの間。sec 秒で1周するたびにドロップが 火→水→木→光→闇→回復… と変化
          spawnRoulettes(Number(sk.count) || 1, Number(sk.turn) || 1, Number(sk.sec) || 2);
          break;
        }
        case 'blind': {
          // 暗闇：盤面のドロップが全部見えなくなる。動かしたドロップだけ見えるようになる
          blindBoard();
          break;
        }
        case 'attack_buff': {
          const rate = sk.rate || 1;
          const turn = sk.turn || 1;
          if (!e._baseAtk) e._baseAtk = e.atk;
          e.atk = Math.floor((e._baseAtk || e.atk) * rate);
          e._atkBuffTurns = (turn === -1) ? -1 : turn;   // -1 = ずっと続く（ターン表示なし）
          break;
        }
        case 'action_change': {
          // 行動変化：この後の行動間隔（ターン数）を変える。カウントも新しい間隔から数え直す
          const n = Math.max(1, Math.floor(Number(sk.interval) || 1));
          e.turnInterval = n;
          e._baseTurnInterval = n;       // 威嚇などで伸びたあと「元に戻す」先も新しい間隔にする
          e.turnProgress = 0;
          updateEnemyTurnBadge();
          updateEnemyUI();
          break;
        }
        case 'heal_self': {
          const rate = sk.rate || 0.1;
          const healAmt = Math.floor(e.maxHp * rate);
          e.hp = Math.min(e.maxHp, e.hp + healAmt);
          updateEnemyUI();
          break;
        }
        case 'combo_absorb': {
          // ○ターンの間、プレイヤーが max コンボ以下だと、与えるはずのダメージを吸収して敵が回復する
          e._comboAbsorb = { turns: Math.max(1, sk.turn || 1), max: Math.max(1, sk.combo || 5) };
          updateEnemyUI();
          break;
        }
        case 'dmg_reduce': {
          // ダメージ軽減：〇ターンの間、プレイヤーから受けるダメージを〇%軽減（turn=-1 なら無期限）
          const rate = Math.max(0, Math.min(100, Number(sk.rate) || 0)) / 100;
          const turns = (Number(sk.turn) === -1) ? -1 : Math.max(1, Math.floor(Number(sk.turn) || 1));
          e._dmgReduce = { rate, turns };                // 重ねがけは上書き
          updateEnemyUI();
          break;
        }
        case 'super_gut': {
          // 超根性：倒せるダメージを受けても、最大HPの〇%で必ず耐える（ターンは無限。発動すると消滅）
          const pct = Math.max(1, Math.min(100, Number(sk.rate) || 50));
          e._superGut = { rate: pct };                   // 重ねがけは上書き
          updateEnemyUI();
          break;
        }
        case 'attr_guard': {
          // 属性軽減：指定した属性の攻撃から受けるダメージを〇%軽減（turn=-1 なら無期限）
          const ATTRS = ['fire', 'water', 'wood', 'light', 'dark'];
          const a = guardAttrOf(sk);
          delete sk._rolled;                             // ランダムは次の発動でまた抽選
          const rate = Math.max(0, Math.min(100, Number(sk.rate) || 0)) / 100;
          const turns = (Number(sk.turn) === -1) ? -1 : Math.max(1, Math.floor(Number(sk.turn) || 1));
          if (!e._attrGuards) e._attrGuards = {};
          e._attrGuards[a] = { rate, turns };            // 同じ属性は上書き
          updateEnemyUI();
          break;
        }
        case 'status_shield': {
          // ○ターンの間、プレイヤーからの状態異常（防御ダウン・威嚇＝行動遅延）を無効化。いま掛かっているものも消す
          e._statusShield = Math.max(1, sk.turn || 1);
          delete e.defDown;                                   // 個別の防御ダウン
          if (e._baseTurnInterval) e.turnInterval = e._baseTurnInterval;   // 威嚇で伸びた行動間隔を元に戻す
          e._delayed = false;                                              // 行動遅延アイコンも消す
          updateEnemyTurnBadge();
          updateEnemyUI();
          break;
        }
      }
    }
    } finally { _actionLossCap = null; }
  };
}

// 1ヒットあたりの生ダメージ（表示用）
function getRawPerHitDmg(enemy, action) {
  if (!action || !action.skills) return enemy.atk || 0;
  let total = 0, hits = 0;
  for (const sk of action.skills) {
    if (sk.type === 'damage') {
      total += (sk.value || 0) * (sk.repeat || 1);
      hits += (sk.repeat || 1);
    } else if (sk.type === 'damage_mult') {
      total += Math.floor((enemy.atk || 0) * (sk.value || 1));
      hits += 1;
    } else if (sk.type === 'damage_ratio') {
      total += calcRatioDamage(sk);
      hits += 1;
    }
  }
  const _cap = actionRatioCap(action.skills, playerCurrentHP);
  // 割合ダメージを含む行動は「覇気の一撃」1回にまとめて見せる（hitCount は 1）。
  // 合計は割合分ぴったり（例：5000HPの50% = 2500を1回で表示。攻撃力ダメージ入りでも 1250×2 に割らない）
  if (_cap !== null) return _cap;
  return hits > 0 ? Math.floor(total / hits) : (enemy.atk || 0);
}

// ============================================================
// ★ プレイヤーへのダメージ適用（軽減計算を一元化） ★
// ============================================================
function applyPlayerDamage(rawDmg, enemy) {
  if (rawDmg <= 0) return 0;

  let reduction = 1.0;
  // 1) バフによる軽減
  if (buffDamageReduction && buffDamageReductionValue > 0) {
    reduction *= (1.0 - buffDamageReductionValue);
  }
  // 2) LSによる軽減
  const lsEffects = [];
  [0, 5].forEach(idx => {
    if (partyUids.length > idx && partyUids[idx] !== null) {
      const e = box.find(b => b.uid === partyUids[idx]);
      if (e) {
        const m = MONSTER_DATA[e.monsterId];
        if (m && m.leaderSkill && m.leaderSkill.effects) {
          lsEffects.push(...m.leaderSkill.effects);
        }
      }
    }
  });
  if (lsEffects.length > 0) {
    const ctx = defenseCtx(enemy);
    const res = applyLeaderEffects(lsEffects, ctx);
    if (res.dmgReduction && res.dmgReduction.length > 0) {
      let lsKeep = 1;
      for (const r of res.dmgReduction) { reduction *= (1.0 - r); lsKeep *= (1.0 - r); }
      if (lastTurnCtx) { lsGuardRate = 1 - lsKeep; setLsGuardBadge(lsGuardRate, false); }
    }
  }

  let finalDmg = Math.max(0, Math.floor(rawDmg * reduction));
  if (_actionLossCap) {   // 割合ダメージを含む行動：合計が割合分を超えないようにする
    const taken = _actionLossCap.hp0 - playerCurrentHP;
    finalDmg = Math.min(finalDmg, Math.max(0, _actionLossCap.cap - taken));
  }
  playerCurrentHP = Math.max(0, playerCurrentHP - finalDmg);
  updatePlayerHP(-finalDmg);
  return finalDmg;
}

// img（例: 'mp8.png'）からMONSTER_DATAのモンスターIDを逆引きし、属性を取得する。
// ダンジョン側のattr指定を上書きすることで、モンスターデータと必ず一致させる。
function getMonsterAttrFromImg(img) {
  const m = (img || '').match(/mp(\d+)\.png/);
  if (!m) return null;
  const mon = MONSTER_DATA[parseInt(m[1])];
  return mon ? mon.attr : null;
}

function compileEnemyActions(enemyDef) {
  const compiled = { ...enemyDef };
  // ★ 敵の属性はMONSTER_DATAと必ず連動させる ★
  // ダンジョンデータ側にattrが書かれていても、対応するモンスターが
  // MONSTER_DATAに存在する場合はそちらの属性を優先する。
  const linkedAttr = getMonsterAttrFromImg(enemyDef.img);
  if (linkedAttr) compiled.attr = linkedAttr;
  const rawActions = enemyDef.actions || [];
  const runtimeActions = [];

  for (const action of rawActions) {
    if (action.fn) {
      runtimeActions.push({ ...action });
      continue;
    }
    if (!action.skills) {
      runtimeActions.push({ ...action });
      continue;
    }
    const skills = action.skills;
    const cond = action.condition || 'normal';

    if (cond === 'battle_start') {
      // 先制は複数OK：actions に並んでいる順に「先制1 → 先制2 → …」と連続で発動する
      const bs = {
        name: action.name || '先制',
        once: action.once !== false,
        skills,
        fn: buildEnemyActionFn(skills, compiled)
      };
      (compiled._battleStartActions ||= []).push(bs);
      if (!compiled._battleStartAction) compiled._battleStartAction = bs;
      continue;
    }
    if (cond === 'normal') {
      runtimeActions.push({
        name: action.name || '攻撃',
        weight: action.weight || 30,
        hpAbove: action.hpAbove,   // HPがこの%以上のときだけ選ばれる（省略=制限なし）
        hpBelow: action.hpBelow,   // HPがこの%以下のときだけ選ばれる（省略=制限なし）
        skills,
        fn: buildEnemyActionFn(skills, compiled)
      });
      continue;
    }
    // 盤面に〇ドロップがある場合：行動パターンの一員。盤面にそのドロップがあるときだけ選ばれる（重みで抽選）
    if (cond === 'orb_has') {
      runtimeActions.push({
        name: action.name || '攻撃',
        weight: action.weight || 30,
        hpAbove: action.hpAbove,
        hpBelow: action.hpBelow,
        needOrb: action.orb || 'fire',
        skills,
        fn: buildEnemyActionFn(skills, compiled)
      });
      continue;
    }
    // 盤面に〇ドロップがない場合、以下を順に使用：条件を満たすあいだ、通常の行動より優先して上から順に使う
    if (cond === 'orb_none') {
      compiled._orbNoneActions = compiled._orbNoneActions || [];
      compiled._orbNoneActions.push({
        name: action.name || '特殊',
        orb: action.orb || 'fire',
        skills,
        fn: buildEnemyActionFn(skills, compiled)
      });
      continue;
    }
    const hpMatch = cond.match(/^hp<=(\d+)%$/);
    if (hpMatch) {
      const threshold = parseInt(hpMatch[1]) / 100;
      compiled._hpConditions = compiled._hpConditions || [];
      compiled._hpConditions.push({
        name: action.name || '特殊',
        threshold,
        once: action.once !== false,
        used: false,
        skills,
        fn: buildEnemyActionFn(skills, compiled)
      });
      continue;
    }
    runtimeActions.push({
      name: action.name || '攻撃',
      weight: action.weight || 30,
      skills,
      fn: buildEnemyActionFn(skills, compiled)
    });
  }

  if (runtimeActions.length === 0) {
    runtimeActions.push({
      name: '通常攻撃',
      weight: 100,
      fn: (e) => applyPlayerDamage(e.atk || 0, e)
    });
  }
  compiled.actions = runtimeActions;
  return compiled;
}

// ============================================================
// 属性相性
// ============================================================
const ATTR_STRONG = { fire:'wood', water:'fire', wood:'water', light:'dark', dark:'light' };
function getAttrMulti(attackAttr, defAttr) {
  if (ATTR_STRONG[attackAttr] === defAttr) return 1.5;
  if (ATTR_STRONG[defAttr] === attackAttr) return 0.5;
  return 1.0;
}

const ATTR_HP_GRAD = {
  fire:  'linear-gradient(90deg,#e05a2b,#ff7043)',
  water: 'linear-gradient(90deg,#1565c0,#42a5f5)',
  wood:  'linear-gradient(90deg,#2e7d32,#66bb6a)',
  light: 'linear-gradient(90deg,#c8a020,#ffe566)',
  dark:  'linear-gradient(90deg,#4a148c,#ab47bc)',
};

// ============================================================
// ダンジョン進行状態
// ============================================================
let currentDungeonBattles = [];
let currentBattleIndex    = 0;
let dungeonBGMAudio       = null;
let enemyTurnProgress     = 0;
let enemyList            = [];
let bindTimers           = {};
let enemyRecDown          = null;  // 敵の回復力ダウン：{ value:倍率, turns }
let enemyMoveDown         = null;  // 敵の操作時間ダウン：{ seconds, turns }
let enemySkillSeal        = null;  // 敵の「スキル使用不可」：{ turns }（チーム全員のスキルが使えない）
let enemyNoFall           = null;  // 敵の「落ちコンなし」：{ turns }（消しても新しいドロップが降ってこない。リーダースキルの落ちコンなしと同じ動き）

// アイコン（画像ファイル不要のSVG）：S❌＝スキル使用不可 ／ 落ちコンなし＝ドロップの落下に禁止マーク
const ICON_SKILL_SEAL_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#6a7cf0'/><stop offset='1' stop-color='#1d2878'/></linearGradient></defs>" +
  "<rect x='4' y='4' width='56' height='56' rx='13' fill='url(#g)' stroke='#d6ddff' stroke-width='3'/>" +
  "<text x='32' y='47' font-family='Arial Black,Arial,sans-serif' font-weight='900' font-size='42' text-anchor='middle' fill='#fff'>S</text>" +
  "<path d='M13 13L51 51M51 13L13 51' stroke='#3a0000' stroke-width='12' stroke-linecap='round'/>" +
  "<path d='M13 13L51 51M51 13L13 51' stroke='#ff2f2f' stroke-width='7.5' stroke-linecap='round'/></svg>");
const ICON_NO_FALL_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#3aa0c8'/><stop offset='1' stop-color='#14455f'/></linearGradient>" +
  "<radialGradient id='o' cx='.35' cy='.3' r='.8'><stop offset='0' stop-color='#fff'/><stop offset='.45' stop-color='#ffd84a'/><stop offset='1' stop-color='#d98a00'/></radialGradient></defs>" +
  "<rect x='4' y='4' width='56' height='56' rx='13' fill='url(#g)' stroke='#cfeeff' stroke-width='3'/>" +
  "<circle cx='32' cy='17' r='8.5' fill='url(#o)' stroke='#fff' stroke-width='1.5'/>" +
  "<path d='M32 29V47M23 39L32 49L41 39' fill='none' stroke='#fff' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'/>" +
  "<circle cx='32' cy='32' r='24' fill='none' stroke='#3a0000' stroke-width='10'/><circle cx='32' cy='32' r='24' fill='none' stroke='#ff2f2f' stroke-width='6'/>" +
  "<path d='M15 49L49 15' stroke='#3a0000' stroke-width='10' stroke-linecap='round'/><path d='M15 49L49 15' stroke='#ff2f2f' stroke-width='6' stroke-linecap='round'/></svg>");
// 実際に使う画像：スキル使用不可＝shs.png ／ 落ちコンなし＝otc.png（読み込めなかった時だけ、上のSVGに切り替える）
// 超根性アイコン（tc.png が無い時だけ使う代わりの絵）
const ICON_SUPER_GUT_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#ffd84a'/><stop offset='1' stop-color='#c25a00'/></linearGradient></defs>" +
  "<rect x='4' y='4' width='56' height='56' rx='13' fill='url(#g)' stroke='#fff3c4' stroke-width='3'/>" +
  "<path d='M32 9 L51 16 L51 33 C51 44 42 52 32 56 C22 52 13 44 13 33 L13 16 Z' fill='#fff' stroke='#5a2a00' stroke-width='3' stroke-linejoin='round'/>" +
  "<text x='32' y='42' font-family='Arial Black,Arial,sans-serif' font-weight='900' font-size='28' text-anchor='middle' fill='#c25a00'>根</text></svg>");
let ICON_SKILL_SEAL = 'shs.png';
let ICON_NO_FALL = 'otc.png';
(function () {
  const probe = (file, onFail) => { const im = new Image(); im.onerror = onFail; im.src = file; };
  probe('shs.png', () => { ICON_SKILL_SEAL = ICON_SKILL_SEAL_SVG; });
  probe('otc.png', () => { ICON_NO_FALL = ICON_NO_FALL_SVG; });
})();
// 盤面に〇ドロップが（いま）あるか。敵が行動を選ぶ“その瞬間”の盤面を見る（落ちコンなしで消えた直後でも、実際の盤面で判定）
//   落ちコンなし中（敵のギミック／リーダースキル）は、補充の直前に盤面を控えておき（enemyJudgeBoard）、
//   敵の行動はその「消して詰めただけの盤面」で判定する。補充で降ってきたドロップは数えない（消し切れば「ない」になる）
let enemyJudgeBoard = null;
function boardHasOrb(type) {
  const g = enemyJudgeBoard || grid;
  for (let r = 0; r < g.length; r++) for (let c = 0; c < (g[r] ? g[r].length : 0); c++) if (g[r][c] === type) return true;
  return false;
}
function isSkillSealed() { return !!(enemySkillSeal && enemySkillSeal.turns > 0); }
let enemyAtkDowns        = [];   // 敵の「攻撃力ダウン」：{ attr:'fire'|…|'all', rate:0〜1, turns }
let buffMoveTimeShort    = false;
let buffMoveTimeShortTurns = 0;
let totalCoin            = 0;
let totalExp             = 0;
let droppedMonsters      = [];
let droppedItems         = [];   // { item: ITEM_DATAのキー, count: 個数 }
// 敵を倒した攻撃が N コンボ以上なら、その敵のチップ(drops)のドロップが確定する
const CHIP_GUARANTEE_COMBO = 10;
// プレイヤーの攻撃フェーズ中だけ、そのターンのコンボ数が入る（スキルなどで倒したときは0）
let attackPhaseCombo = 0;
let battleExpQueue       = 0;
let battleCoinQueue      = 0;

const DUNGEON_BGM_VOL = 0.6;   // ダンジョン中（道中・ボス）のBGM音量（0〜1。以前は0.5）
let dungeonBGMFile = null;
let currentDungeonKey = null;
// このバトルがボス戦か（isBoss の敵がいる／最終バトル／データ無しのBOSSステージ）
function isBossBattleIndex(idx) {
  if (!currentDungeonBattles || !currentDungeonBattles.length) return currentStageType === 'boss';
  const b = currentDungeonBattles[idx];
  return idx >= currentDungeonBattles.length - 1 || !!(b && b.enemies && b.enemies.some(e => e.isBoss));
}
// 道中BGM / ボスBGM を選んで流す（同じ曲が既に流れていれば途切れさせない）
// このダンジョンのボスに「登場演出つき」（サンダー／フリーザー／ファイヤー。js/boss-cloud.js の BOSS_INTRO_STAGES）か
//   → ボスBGMは登場演出の中（姿があらわれる瞬間）で流す。それまでは無音
function hasBossIntro() {
  return !!(window.BossCloud && BossCloud.introOf && BossCloud.introOf(currentDungeonKey));
}
function playBattleBgm(idx, asField) {
  const key = currentDungeonKey;
  const cfg = (typeof DUNGEON_BGM !== 'undefined') ? DUNGEON_BGM[key] : null;
  const boss = !asField && isBossBattleIndex(idx);
  let file;
  if (cfg) file = (boss && cfg.boss) ? cfg.boss : (cfg.field || cfg.boss);
  else { const d = DUNGEON_DATA[key]; file = (d && d.bgm) || 'dungeon1.mp3'; }
  if (dungeonBGMAudio && dungeonBGMFile === file && !dungeonBGMAudio.paused) return;
  startDungeonBGM(file);
}
function startDungeonBGM(file) {
  stopDungeonBGM();
  dungeonBGMFile = file;
  try {
    dungeonBGMAudio = new Audio(file);
    dungeonBGMAudio.loop = true;
    dungeonBGMAudio.volume = DUNGEON_BGM_VOL;   // 道中・ボスBGMの音量
    dungeonBGMAudio.play().catch(()=>{});
  } catch(e) {}
}
let _bgmGen = 0;   // stopDungeonBGM のたびに増える。登場演出の「あとでボスBGM」予約が、途中で抜けたときに鳴らないための目印
function stopDungeonBGM() {
  _bgmGen++;
  if (dungeonBGMAudio) { dungeonBGMAudio.pause(); dungeonBGMAudio.currentTime = 0; dungeonBGMAudio = null; }
  dungeonBGMFile = null;
}

// ── バトル n/m の白い菱形バナー。ボス戦は Battle n/n → フリップして BOSS ＋ 赤い菱形の縁 ──
async function showBattleBanner(now, max, isBoss, bannerKind) {
  const last = !!isBoss && bannerKind === 'last';   // ラスボス版：紫の波動 ＋ LAST BOSS 表記
  const ov = document.getElementById('dungeon-anim-overlay');
  ov.innerHTML = `
    <div class="bn-wrap${last ? ' bn-last-wrap' : ''}">
      <div class="bn-ring fixed"></div>
      <div class="bn-ring r1"></div><div class="bn-ring r2"></div><div class="bn-ring r3"></div>
      <div class="bn-flip">
        <div class="bn-side bn-front">
          <div class="bn-shape"></div>
          <div class="bn-text">
            <div class="bn-battle-label">Battle</div>
            <div class="bn-count"><span class="bn-now">${now}</span><span class="bn-slash"></span><span class="bn-max">${max}</span></div>
          </div>
        </div>
        <div class="bn-side bn-back">
          <div class="bn-shape"><div class="bn-deco"></div></div>
          <div class="bn-text">${last ? '<div class="bn-boss-text bn-last"><span class="bn-last-sub">LAST</span><span class="bn-last-main">BOSS</span></div>' : '<div class="bn-boss-text">BOSS</div>'}</div>
        </div>
      </div>
      <div class="bn-flash"></div>
    </div>`;
  ov.className = 'bn-mode' + (isBoss ? ' bn-boss' : '') + (last ? ' bn-lastboss' : '');
  ov.style.display = 'flex';
  playSE('bc');   // Battle 表示の効果音
  const wrap  = ov.querySelector('.bn-wrap');
  const flip  = ov.querySelector('.bn-flip');
  const flash = ov.querySelector('.bn-flash');
  if (isBoss) {
    await sleep(550);                        // Battle n/n を見せてから
    flip.classList.add('bn-do-flip');        // くるっと回って BOSS へ
    playSE('bossk');
    await sleep(250);
    flash.classList.add('go');
    wrap.classList.add('bn-boss-on');        // 赤い菱形が広がる
    await sleep(last ? 1500 : 1100);       // BOSS を見せる時間（LAST BOSS は少し長め）
  } else {
    await sleep(1200);
  }
  ov.classList.add('bn-out');
  wrap.classList.add('bn-leave');
  await sleep(400);
  ov.style.display = 'none';
  ov.className = '';
  ov.innerHTML = '';
}

async function showDungeonAnim(type, customText = null) {
  const ov = document.getElementById('dungeon-anim-overlay');
  let text, cls, duration;
  if (type === 'battle_next') {
    text = customText || 'BATTLE';
    cls = 'battle-next-text';
    duration = 2000;
  } else if (customText) {
    text = customText;
    cls = 'battle-text';
    duration = 2000;
  } else {
    text = type === 'start' ? 'START' : 'CLEAR';
    cls = type === 'start' ? 'start-text' : 'clear-text';
    duration = type === 'start' ? 2200 : 2500;
  }
  ov.innerHTML = `<div class="dng-anim-text ${cls}">${text}</div>`;
  ov.style.display = 'flex';
  await sleep(duration);
  ov.style.display = 'none';
  ov.innerHTML = '';
}

// ── ロックオン：タップした敵を優先して狙う（倒れたら自動で次の敵へ） ──
let lockedEnemy = null;
function getTargetIdx() {
  if (lockedEnemy && lockedEnemy.hp > 0) {
    const i = enemyList.indexOf(lockedEnemy);
    if (i >= 0) return i;
  }
  lockedEnemy = null;
  return enemyList.findIndex(e => e.hp > 0);
}
function updateLockMarks() {
  const units = document.querySelectorAll('#enemy-area .enemy-unit');
  units.forEach((u, i) => {
    const on = lockedEnemy && enemyList[i] === lockedEnemy && lockedEnemy.hp > 0;
    u.classList.toggle('locked', !!on);
    let m = u.querySelector('.lock-mark');
    if (on && !m) {
      m = document.createElement('div');
      m.className = 'lock-mark';
      m.innerHTML = '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="13" fill="none" stroke="#ff2a2a" stroke-width="3"/><path d="M20 2v10M20 28v10M2 20h10M28 20h10" stroke="#ff2a2a" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="20" r="2.5" fill="#ff2a2a"/></svg>';
      const w = u.querySelector('.enemy-img-wrap');
      (w || u).appendChild(m);
    } else if (!on && m) m.remove();
  });
}
function toggleLockEnemy(i) {
  const e = enemyList[i];
  if (!e || e.hp <= 0) return;
  lockedEnemy = (lockedEnemy === e) ? null : e;
  if (lockedEnemy) playSE('lock');   // ロックオン音（drop.mp3）
  updateLockMarks();
}

async function loadBattle(battleData, autoStart = true) {
  _defeatPending = [];
  lockedEnemy = null;
  enemyDefeatedHandled = false;
  battleExpQueue = 0;
  battleCoinQueue = 0;
  if (window.Zukan) { try { Zukan.noteEnemies(battleData.enemies); } catch (err) {} }   // 図鑑：出会ったモンスターを記録（js/zukan.js）
  enemyList = battleData.enemies.map(e => {
    const compiled = compileEnemyActions(e);
    const base = {
      ...compiled,
      maxHp: e.hp,
      hp: e.hp,
      turnProgress: 0,
      alive: true,
      healUsed: false,
      preemptiveDone: false,
      _hpCondUsed: {},
      _dropChecked: false,
      exp: e.exp || 0,
      coin: e.coin || 0
    };
    if (!base.turnInterval) base.turnInterval = 2;
    base._baseTurnInterval = base.turnInterval;
    return base;
  });
  buffMoveTimeShort = false;
  renderEnemyUI(true);   // 敵は透明で配置 → 登場演出で半透明から現れる
  updateEnemyUI();
  updateEnemyTurnBadge();

  // 最初のバトル(autoStart=false)は START 表示が終わってから登場させる（呼び出し側）
  if (autoStart) { await playEnemyAppear(); await runBattleStartActions(); }
}

// 先制攻撃・バトル開始時の行動（最初のバトルは START 表示が終わってから呼ぶ）
async function runBattleStartActions() {
  // マルチ(オンライン)：相手の番の間は、先制攻撃などを相手の端末が実行する（結果は盤面・敵・バフとして次の同期で届く）
  if (window.MultiShare && MultiShare.skipStartActions()) { enemyList.forEach(e => { e.preemptiveDone = true; }); return; }
  // 先制攻撃・バトル開始時の行動中は操作不可
  const prevBusy = busy;
  busy = true;
  setEnemyActing(true);
  try {
    for (const enemy of enemyList) {
      if (enemy._battleStartActions && enemy._battleStartActions.length && !enemy.preemptiveDone) {
        enemy.preemptiveDone = true;
        // 先制も、敵がスキルを使うときと同じ青いスキルウインドウ＋効果演出（showEnemyAttackEffect）で見せる
        // 複数ある場合は上から順に連続で（先制1 → 先制2 …）。それぞれ別のスキルウインドウ・効果を出す
        for (let i = 0; i < enemy._battleStartActions.length; i++) {
          const bs = enemy._battleStartActions[i];
          if (i > 0) await sleep(250);
          await showEnemyAttackEffect(enemy, bs.name, bs, true);
          bs.fn(enemy);
          updatePlayerHP();
          if (playerCurrentHP <= 0) { triggerGameOver(); return; }
        }
        continue;
      }
      if (enemy.preemptive && !enemy.preemptiveDone) {
        enemy.preemptiveDone = true;
        await showEnemyAttackEffect(enemy, enemy.preemptive.name || '先制攻撃', enemy.preemptive, true);
        if (enemy.preemptive.fn) enemy.preemptive.fn(enemy);
        updatePlayerHP();
        if (playerCurrentHP <= 0) { triggerGameOver(); return; }
      }
    }
  } finally {
    setEnemyActing(false);
    busy = prevBusy;
  }
  // 先制の「にげる」で敵が全員いなくなった場合は、そのまま次のバトルへ
  if (enemyList.length && enemyList.every(e => e.hp <= 0) && !_battleEndRunning) {
    enemyDefeatedHandled = true;
    await sleep(600);
    await handleBattleEnd();
  }
}

// 通常攻撃・普通の連続攻撃（ダメージだけの行動）は技名ウインドウを出さない
function isPlainEnemyAttack(name, action) {
  if (action && action.skills && action.skills.some(sk => sk.type === 'flee' || sk.type === 'vanish')) return false;   // にげる は必ず技名ウインドウを出す
  // 名前が空 ／「通常攻撃」「連続攻撃」「攻撃」（名前未設定の既定値）だけが“ふつうの攻撃”。
  // 固定ダメージだけの行動でも、「⚠️あばれる」のように名前を付けた技は技名ウインドウを出す。
  const n = name ? String(name).trim() : '';
  return !n || n === '通常攻撃' || n === '連続攻撃' || n === '攻撃';
}
function getPopupElement(enemy) {
  const units = document.querySelectorAll('#enemy-area .enemy-unit');
  const idx = enemyList.indexOf(enemy);
  if (idx === -1 || idx >= units.length) return null;
  return units[idx].querySelector('.enemy-action-popup');
}

// 「あと〇」の〇と数字：SVGで描いて、数字を〇の中心に固定（フォントや端末で位置がズレない）
//   あと2以上：白い〇 ／ あと1：赤い〇＋白い光が周回
//   あと0（行動のカウントが尽きた）：
//     ・攻撃中   … 赤く燃える〇＋光の爆ぜ（ドクドク脈打つ）
//     ・攻撃待機 … 琥珀色の点線の〇がゆっくり回り、右上に砂時計（自分の番を待っている）
function setEnemyTurnCount(counter, n) {
  let t = counter.querySelector('text');
  if (!t) {
    counter.innerHTML =
      '<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<g class="tc-burst">' +
          '<circle class="tc-wave" cx="20" cy="20" r="16"/>' +
          '<path class="tc-rays" d="M20 -3V3M20 37V43M-3 20H3M37 20H43M3.8 3.8l3.6 3.6M32.6 32.6l3.6 3.6M36.2 3.8l-3.6 3.6M7.4 32.6l-3.6 3.6"/>' +
        '</g>' +
        '<circle class="tc-outline" cx="20" cy="20" r="16"/>' +
        '<circle class="tc-ring" cx="20" cy="20" r="16"/>' +
        '<g class="tc-dash"><circle cx="20" cy="20" r="16" pathLength="100"/></g>' +
        '<g class="tc-spark"><circle cx="20" cy="20" r="16" pathLength="100"/></g>' +
        '<text x="20" y="27.8" text-anchor="middle" transform="matrix(1 0 -0.14 1 2.8 0)"></text>' +
        '<g class="tc-wait" transform="translate(34 5.5)"><g class="tc-wait-in">' +
          '<circle r="8" class="tc-wait-bg"/>' +
          '<path class="tc-wait-glass" d="M-3.4 -4.6H3.4M-3.4 4.6H3.4M-2.8 -4.6C-2.8 -1.4 -.5 -.7 0 0C-.5 .7 -2.8 1.4 -2.8 4.6M2.8 -4.6C2.8 -1.4 .5 -.7 0 0C.5 .7 2.8 1.4 2.8 4.6"/>' +
          '<path class="tc-wait-sand" d="M-1.9 4.2C-1.2 2.6 -.5 2 0 1.6C.5 2 1.2 2.6 1.9 4.2Z"/>' +
        '</g></g>' +
      '</svg>';
    t = counter.querySelector('text');
  }
  t.textContent = n;
}

// 敵の「あと〇」バッジを最新の状態にする。
//   enemy._due    … カウントが尽きて今ターン行動する（表示は「あと0」）。攻撃が終わるまで0のまま
//   enemy._acting … その中で、いま実際に攻撃している敵（それ以外の _due は「攻撃待機」）
function updateEnemyTurnBadge() {
  const units = document.querySelectorAll('#enemy-area .enemy-unit');
  for (let i = 0; i < units.length && i < enemyList.length; i++) {
    const enemy = enemyList[i];
    if (!enemy || enemy.hp <= 0) {
      const pad = units[i].querySelector('.enemy-turn-pad');
      if (pad) pad.classList.add('dead');
      continue;
    }
    const counter = units[i].querySelector('.enemy-turn-counter');
    if (!counter) continue;
    const pad = units[i].querySelector('.enemy-turn-pad');
    const due = !!enemy._due;
    const remaining = due ? 0 : Math.max(1, enemy.turnInterval - enemy.turnProgress);
    setEnemyTurnCount(counter, remaining);
    counter.classList.toggle('red', remaining === 1);
    counter.classList.toggle('zero', due);
    counter.classList.toggle('acting', due && !!enemy._acting);
    counter.classList.toggle('waiting', due && !enemy._acting);
    if (pad) {
      pad.classList.toggle('zero', due);
      pad.classList.toggle('acting', due && !!enemy._acting);
      pad.classList.toggle('waiting', due && !enemy._acting);
    }
    units[i].classList.toggle('turn-acting', due && !!enemy._acting);
  }
}

// ── 敵の登場演出：半透明からふわっと現れる（パズドラ風）。複数体は少しずつずらして登場 ──
const ENEMY_APPEAR_MS = 700;
function playEnemyAppear() {
  const imgs = [...document.querySelectorAll('#enemy-area .enemy-unit .enemy-img-wrap img')];
  if (!imgs.length) {
    if (hasBossIntro() && isBossBattleIndex(currentBattleIndex)) playBattleBgm(currentBattleIndex);   // 演出できない時も、ボスBGMは流す
    return Promise.resolve();
  }
  // ラスボス専用の登場演出（js/boss-cloud.js の entrance）。一番大きい敵＝ボスにだけ使う
  const special = (window.BossCloud && BossCloud.entranceOf && isBossBattleIndex(currentBattleIndex)) ? BossCloud.entranceOf(currentDungeonKey) : null;
  let bossImg = null;
  if (special) {
    let best = -1;
    imgs.forEach(im => { const r = im.getBoundingClientRect(), ar = r.width * r.height; if (ar > best) { best = ar; bossImg = im; } });
    try { special.fx(bossImg); } catch (e) {}
    // 登場演出つきのボス（bgmAt あり）：姿があらわれる瞬間にボスBGMを流す。演出の途中で抜けたら鳴らさない
    if (special.bgmAt != null) {
      const gen = _bgmGen;
      setTimeout(() => { if (gen === _bgmGen) playBattleBgm(currentBattleIndex); }, special.bgmAt);
    }
  }
  const STAGGER = 130;
  const isSp = img => !!special && img === bossImg;
  const msOf = img => isSp(img) ? special.ms : ENEMY_APPEAR_MS;
  const total = Math.max(...imgs.map((img, i) => i * STAGGER + msOf(img)));
  imgs.forEach((img, i) => {
    const ms = msOf(img);
    const lag = ms - ENEMY_APPEAR_MS;   // 専用演出のときは、HPバーなども姿が現れる頃に出す
    if (isSp(img) && special.se) setTimeout(() => playSE(special.se), i * STAGGER + ms);   // 完全に出てきたら効果音
    // HPバー・属性アイコン・「あと〇」・状態アイコンも、敵画像と同じタイミングで半透明から登場させる
    const unit = img.closest('.enemy-unit');
    const extras = unit ? [...unit.querySelectorAll('.enemy-hp-row, .enemy-top-left')] : [];
    const clearExtras = () => extras.forEach(el => { el.style.opacity = ''; });
    extras.forEach(el => {
      if (!el.animate) return;
      const a = el.animate([
        { opacity: 0 },
        { opacity: .45, offset: .45 },
        { opacity: 1 }
      ], { duration: ENEMY_APPEAR_MS, delay: i * STAGGER + lag, easing: 'ease-out', fill: 'both' });
      const f = () => { clearExtras(); try { a.cancel(); } catch (e) {} };
      a.onfinish = f;
      setTimeout(f, i * STAGGER + ms + 200);
    });
    const clear = () => { img.style.opacity = ''; clearExtras(); };
    if (!img.animate) { setTimeout(clear, i * STAGGER); return; }
    const frames = isSp(img) ? special.frames : [
      { opacity: 0,   filter: 'brightness(2.4) saturate(.3)', transform: 'scale(1.06)' },
      { opacity: .45, filter: 'brightness(1.8) saturate(.6)', transform: 'scale(1.03)', offset: .45 },
      { opacity: 1,   filter: 'brightness(1) saturate(1)',    transform: 'scale(1)' }
    ];
    const anim = img.animate(frames, { duration: ms, delay: i * STAGGER, easing: isSp(img) ? (special.easing || 'linear') : 'ease-out', fill: 'both' });
    const fin = () => { clear(); try { anim.cancel(); } catch (e) {} };
    anim.onfinish = fin;
    setTimeout(fin, i * STAGGER + ms + 200);
  });
  return new Promise(r => setTimeout(r, total + 80));
}

// ── 敵画像の自動フィット：縦長の画像（人型など）をL/XLで置いても、画像もHPバーも敵エリアから見切れないようにする ──
//   画像の幅はサイズ(S/M/L/XL)で決まるため、縦長だと高さが伸びて溢れる。
//   → 「敵エリアの高さ − HPバー等の高さ」を画像の最大の高さにする（超える時だけ縮む。縦横比はそのまま）。
function fitEnemyImages() {
  const dg = document.getElementById('dungeon'), area = document.getElementById('enemy-area');
  if (!dg || !area) return;
  const units = [...area.querySelectorAll('.enemy-unit')];
  if (!units.length || !dg.clientHeight) return;   // まだ表示されていない時は、表示された時(ResizeObserver)にやり直す
  const imgOf = u => u.querySelector('.enemy-img-wrap img');
  units.forEach(u => { const im = imgOf(u); if (im) im.style.maxHeight = ''; });   // いったん制限なしに戻して測り直す
  const cs = getComputedStyle(dg), acs = getComputedStyle(area);
  const avail = dg.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0) - (parseFloat(acs.marginTop) || 0) - 2;
  // 折り返して複数段になる時（XL＋小さい敵など）は、各段の元の高さに比例して高さを分け合う
  const rowsArr = [];
  units.forEach((u, i) => {
    const prev = units[i - 1];
    if (!prev || u.offsetTop >= prev.offsetTop + prev.offsetHeight - 2) rowsArr.push([]);
    rowsArr[rowsArr.length - 1].push(u);
  });
  const rowH = rowsArr.map(r => Math.max(...r.map(u => u.offsetHeight)));
  const totalH = rowH.reduce((a, b) => a + b, 0) || 1;
  rowsArr.forEach((row, ri) => {
    const rowAvail = rowsArr.length === 1 ? avail : avail * rowH[ri] / totalH;
    for (const u of row) {
      const im = imgOf(u), wrap = u.querySelector('.enemy-img-wrap');
      if (!im || !wrap) continue;
      const extra = u.offsetHeight - wrap.offsetHeight;   // 画像以外（HPバーなど）の高さ
      im.style.maxHeight = Math.max(48, Math.floor(rowAvail - extra)) + 'px';   // 幅は枠のまま、画像だけ縦に収まる大きさで中央に表示（object-fit:contain）
    }
  });
}
(function () {
  const dg = document.getElementById('dungeon');
  if (dg && window.ResizeObserver) new ResizeObserver(() => fitEnemyImages()).observe(dg);   // 画面サイズ変更・戦闘画面の表示時にも自動で合わせ直す
  window.addEventListener('resize', fitEnemyImages);
})();

function renderEnemyUI(hideForAppear = false) {
  const area = document.getElementById('enemy-area');
  area.innerHTML = '';
  area.classList.toggle('has-xl', enemyList.some(e => e && e.size === 'XL'));
  for (let i = 0; i < enemyList.length; i++) {
    const enemy = enemyList[i];
    const unit = document.createElement('div');
    const size = enemy.size || 'S';
    unit.className = `enemy-unit size-${size}`;
    unit.dataset.enemyIndex = i;
    unit.addEventListener('click', () => toggleLockEnemy(i));

    const popup = document.createElement('div');
    popup.className = 'enemy-action-popup';
    unit.appendChild(popup);

    const hpRow = document.createElement('div');
    hpRow.className = 'enemy-hp-row';

    // パズドラZ風：画像左上に「あと N」＋その下に状態アイコン
    const turnPad = document.createElement('div');
    turnPad.className = 'enemy-turn-pad';
    turnPad.innerHTML = '<span class="turn-label">あと</span>';
    const counter = document.createElement('span');
    counter.className = 'enemy-turn-counter';
    setEnemyTurnCount(counter, enemy.turnInterval || 2);
    turnPad.appendChild(counter);
    const statusIcons = document.createElement('div');
    statusIcons.className = 'enemy-status-icons';

    // HPバーの左：その敵の属性アイコン（1.png=火 2=水 3=木 4=光 5=闇）
    const orb = document.createElement('img');
    orb.className = 'enemy-attr-orb';
    orb.src = `${ATTR_TO_IMG[enemy.attr] || '5'}.png`;   // 1.png〜（属性アイコン）
    orb.alt = enemy.attr || '';
    orb.onerror = function(){ this.style.display='none'; };
    hpRow.appendChild(orb);

    // HPバー：外枠(wrap) ＞ 溝(well) ＞ [ゲージ本体]
    const barWrap = document.createElement('div');
    barWrap.className = 'enemy-hp-bar-wrap';
    const barWell = document.createElement('div');
    barWell.className = 'ehp-well';
    const barFill = document.createElement('div');
    barFill.className = 'enemy-hp-bar-fill';
    barFill.id = `enemy-hp-bar-${i}`;
    barFill.dataset.attr = ATTR_HP_GRAD[enemy.attr] ? enemy.attr : 'dark';   // 色はCSS（battle-plus.css）が属性ごとに決める
    barFill.style.width = '100%';
    barWell.appendChild(barFill);
    barWrap.appendChild(barWell);
    hpRow.appendChild(barWrap);
    enemy._hpRatioShown = 100;

    const imgWrap = document.createElement('div');
    imgWrap.className = 'enemy-img-wrap';
    const img = document.createElement('img');
    img.src = enemy.img || '';
    img.alt = enemy.name || '敵';
    img.onerror = function(){ this.style.display='none'; };
    img.addEventListener('load', fitEnemyImages);   // 画像が読み込まれたら高さを測り直す
    if (hideForAppear) img.style.opacity = '0';   // 登場演出（playEnemyAppear）まで見えないようにしておく
    imgWrap.appendChild(img);
    const topLeft = document.createElement('div');      // 「あと〇」と状態アイコンを縦に並べる（重ならない）
    topLeft.className = 'enemy-top-left';
    topLeft.appendChild(turnPad);
    topLeft.appendChild(statusIcons);
    if (hideForAppear) { hpRow.style.opacity = '0'; topLeft.style.opacity = '0'; }   // HPバー・あと〇も登場演出まで隠す
    imgWrap.appendChild(topLeft);
    unit.appendChild(imgWrap);
    unit.appendChild(hpRow);   // パズドラ風：HPバーとカウントはモンスターの下

    area.appendChild(unit);
  }
  fitEnemyImages();
}

// コンボ吸収アイコン（パズドラZ風）：奥にドロップのかけら → 中央にピンクの数字（吸収するコンボ数）→ 手前に白い星
function comboAbsorbIconSVG(n) {
  const txt = String(n);
  const w = txt.length >= 2 ? 26 : 15;           // 数字の幅
  const x0 = (40 - w) / 2;
  const orb = (cx, cy, r, c1, c2) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c1}" stroke="#241033" stroke-width="1.6"/>` +
    `<circle cx="${cx - r*0.3}" cy="${cy - r*0.35}" r="${r*0.35}" fill="${c2}" opacity=".9"/>`;
  const star = (x, y, r) => { const a = r * 0.22;
    return `<path transform="translate(${x} ${y})" d="M0 ${-r} Q${a} ${-a} ${r} 0 Q${a} ${a} 0 ${r} Q${-a} ${a} ${-r} 0 Q${-a} ${-a} 0 ${-r}Z" fill="#fff" stroke="#4a2a66" stroke-width="1" stroke-linejoin="round" paint-order="stroke fill"/>`; };
  return `<svg viewBox="${x0-6} 0 ${w+12} 34" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
    <g>${orb(x0+w*0.48, 7, 4.6, '#35c24a', '#b9ffb0')}${orb(x0+1.5, 17, 4.2, '#1fa7a0', '#a4fff0')}
       ${orb(x0+w-1, 8, 4, '#2fb560', '#b0ffc0')}${orb(x0+w*0.55, 28, 4.6, '#17727e', '#7fe0e8')}
       ${orb(x0+w-1.5, 25, 3.6, '#7a2a8a', '#e0a0f0')}</g>
    <text x="20" y="25" text-anchor="middle" textLength="${w}" lengthAdjust="spacingAndGlyphs"
      font-family="'Arial Black','Impact','Hiragino Sans',sans-serif" font-weight="900" font-size="25"
      fill="#ff74d4" stroke="#2a0f35" stroke-width="3.2" stroke-linejoin="round" paint-order="stroke fill">${txt}</text>
    <text x="20" y="25" text-anchor="middle" textLength="${w}" lengthAdjust="spacingAndGlyphs"
      font-family="'Arial Black','Impact','Hiragino Sans',sans-serif" font-weight="900" font-size="25" fill="#ff74d4">${txt}</text>
    ${star(x0+0.5, 27, 6.5)}${star(x0+w*0.42, 31, 6)}${star(x0+w-1, 27, 6.5)}${star(x0+w-2, 11, 4.2)}
  </svg>`;
}

function updateEnemyUI() {
  for (let i = 0; i < enemyList.length; i++) {
    const enemy = enemyList[i];
    const bar = document.getElementById(`enemy-hp-bar-${i}`);
    if (bar) {
      const ratio = enemy.hp <= 0 ? 0 : Math.max(0, (enemy.hp / enemy.maxHp) * 100);
      bar.style.width = ratio + '%';
      bar.dataset.attr = ATTR_HP_GRAD[enemy.attr] ? enemy.attr : 'dark';
      const row = bar.closest('.enemy-hp-row');
      if (row) {
        const prev = enemy._hpRatioShown == null ? 100 : enemy._hpRatioShown;
        if (ratio < prev - 0.01 && row.animate) {   // ダメージを受けた瞬間：枠がピカッと光る
          row.animate(
            [{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.75)) brightness(1)' },
             { filter: 'drop-shadow(0 0 7px rgba(255,255,255,.95)) brightness(1.7)', offset: .22 },
             { filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.75)) brightness(1)' }],
            { duration: 380, easing: 'ease-out' });
        }
        enemy._hpRatioShown = ratio;
      }
    }
    const units = document.querySelectorAll('#enemy-area .enemy-unit');
    if (i < units.length) {
      const st = units[i].querySelector('.enemy-status-icons');
      if (st) {
        const icons = [];
        if (enemy.hp > 0 && enemy._comboAbsorb && enemy._comboAbsorb.turns > 0)
          icons.push({ combo:enemy._comboAbsorb.max, turns:enemy._comboAbsorb.turns, title:`${enemy._comboAbsorb.max}コンボ以下吸収`, name:'コンボ吸収', text:`${enemy._comboAbsorb.max}コンボ以下の攻撃は、ダメージの代わりに敵のHPが回復してしまう` });
        if (enemy.hp > 0 && !(enemy._statusShield > 0)) {   // 防御ダウン（break.png）：個別 or 全体
          const t = (enemy.defDown && enemy.defDown.turns > 0) ? enemy.defDown.turns : 0;
          if (t > 0) icons.push({ img:'items/break.png', turns:t, title:'防御ダウン', brk:true, name:'防御ダウン', text:`敵の防御力が${Math.round(enemy.defDown.value * 100)}%下がっている` });
        }
        if (enemy.hp > 0 && enemy._statusShield > 0)
          icons.push({ img:'items/barrier.png', turns:enemy._statusShield, title:'状態異常無効', name:'状態異常無効', text:'防御ダウンなどの状態異常を受けない' });
        if (enemy.hp > 0 && enemy._delayed && !(enemy._statusShield > 0))   // 行動遅延中（次に行動すると消える）
          icons.push({ img:'items/tien.png', turns:0, title:'行動遅延', tien:true, name:'行動遅延', text:'行動が遅れている。次に行動するまで、再び遅らせることはできない' });
        if (enemy.hp > 0 && enemy._baseAtk && enemy.atk > enemy._baseAtk && (enemy._atkBuffTurns > 0 || enemy._atkBuffTurns === -1))
          icons.push({ img:'items/ikari.png', turns:(enemy._atkBuffTurns > 0 ? enemy._atkBuffTurns : 0), title:'攻撃アップ', ikari:true, name:'攻撃アップ', text:(enemy._atkBuffTurns > 0 ? '敵の攻撃力が上がっている' : '敵の攻撃力が上がっている（ずっと続く）') });
        if (enemy.hp > 0 && enemy._dmgReduce && (enemy._dmgReduce.turns > 0 || enemy._dmgReduce.turns === -1)) {   // ダメージ軽減（盾アイコン・右にターン数）
          const pct = Math.round(enemy._dmgReduce.rate * 100), t = enemy._dmgReduce.turns;
          icons.push({ svg:dmgReduceIconSVG(pct), svgKey:'dr' + pct, turns:(t > 0 ? t : 0), title:`ダメージ軽減${pct}%`, name:`ダメージ軽減（${pct}%）`,
            text:`プレイヤーから受けるダメージを${pct}%軽減している${t > 0 ? '' : '（ずっと続く）'}` });
        }
        if (enemy.hp > 0 && enemy._attrGuards) {   // 属性軽減（sh1.png=火〜sh5.png=闇）。無期限はターン数を出さない
          const GN = { fire:['火',1], water:['水',2], wood:['木',3], light:['光',4], dark:['闇',5] };
          for (const a of Object.keys(GN)) {
            const g = enemy._attrGuards[a];
            if (!g || !(g.turns > 0 || g.turns === -1)) continue;
            const n = GN[a][1];
            icons.push({ img:`items/sh${n}.png`, alts:[`sh${n}.png`, `Sh${n}.png`], turns:(g.turns > 0 ? g.turns : 0), title:`${GN[a][0]}属性軽減`, guard:true,
              name:`${GN[a][0]}属性軽減`, text:`${GN[a][0]}属性の攻撃から受けるダメージを${Math.round(g.rate * 100)}%軽減している${g.turns > 0 ? '' : '（ずっと続く）'}` });
          }
        }
        if (enemy.hp > 0 && enemy._superGut && enemy._superGut.keepHp == null) {   // 超根性（tc.png）。発動したらアイコンは消える。：ターンは常に無限＝ターン数は出さない
          const pct = Math.round(enemy._superGut.rate);
          icons.push({ img:'tc.png', alts:[ICON_SUPER_GUT_SVG], turns:0, title:`超根性${pct}%`, sgut:true,
            name:`超根性（${pct}%）`, text:`倒せるダメージを受けても、HP${pct}%で必ず耐える（1回だけ。発動すると消える）` });
        }
        icons.sort((a, b) => (b.sgut ? 1 : 0) - (a.sgut ? 1 : 0));   // 超根性は必ず1番上（他の状態異常は元の順のまま、その下）
        const key = icons.map(o => (o.img||o.emoji||o.svgKey||('c'+o.combo))+'_'+o.turns).join('|');
        if (st.dataset.key !== key) {
          st.dataset.key = key;
          st.innerHTML = '';
          for (const o of icons) {
            const d = document.createElement('div');
            d.className = 'st-icon'; d.title = o.title;
            d.addEventListener('click', (ev) => { ev.stopPropagation(); showEffectPopup({ svg: o.svg || (o.combo ? comboAbsorbIconSVG(o.combo) : ''), icon: ((d.querySelector('img') || {}).src || o.img), name: o.name || o.title, text: o.text, turns: o.turns }); });
            if (o.combo) {
              d.classList.add('combo');
              d.innerHTML = comboAbsorbIconSVG(o.combo);
            } else if (o.svg) {
              d.classList.add('dmgcut');
              d.innerHTML = o.svg;
            } else if (o.img) {
              const im = document.createElement('img');
              im.src = o.img; im.alt = o.title;
              im.onerror = function(){
                if (o.alts && o.alts.length) { this.src = o.alts.shift(); return; }   // items/ → 直下 → 大文字の順に探す
                if (o.ikari && !this._retried) { this._retried = true; this.src = 'ikari.png'; return; }   // items/ に無ければ直下も探す
                if (o.tien && !this._retried) { this._retried = true; this.src = 'tien.png'; return; }
                this.remove(); d.classList.add(o.brk ? 'fallback-break' : (o.ikari ? 'fallback-ikari' : 'fallback'));   // 画像が無い時の代替表示
              };
              d.appendChild(im);
            } else { d.classList.add('emoji'); d.textContent = o.emoji; }
            if (o.turns > 0) {
              const t = document.createElement('span');
              t.className = 'st-turn'; t.textContent = o.turns;
              d.appendChild(t);
            }
            st.appendChild(d);
          }
        }
      }
      const img = units[i].querySelector('.enemy-img-wrap img');
      if (enemy.hp <= 0) startEnemyVanish(enemy);        // ゆっくり消滅（img の非表示は演出の最後）
      else if (img) img.style.display = 'block';
    }
  }
  if (lockedEnemy && lockedEnemy.hp <= 0) lockedEnemy = null;
  updateLockMarks();
  const allDead = enemyList.every(e => e.hp <= 0);
  if (allDead && !enemyDefeatedHandled) {
    enemyDefeatedHandled = true;
  }
}

// ============================================================
// ★ 敵ドロップ処理 ★
// ============================================================
// ── 敵が倒れた時：ゆっくり消滅 → そのあとチップ／卵が出る ──
const ENEMY_VANISH_MS = 1300;
let _defeatPending = [];   // 演出中のPromise（次バトルへ進む前に待つ）
// 画像を消しても枠の高さは保つ（ドロップ品を「モンスターのいた位置」に出すため）
function hideEnemyImgKeepSpace(img) {
  const w = img.parentNode;
  if (w && w.offsetHeight) w.style.height = w.offsetHeight + 'px';
  img.style.display = 'none';
}
function startEnemyVanish(enemy) {
  if (enemy._vanishPromise) return enemy._vanishPromise;
  const idx = enemyList.indexOf(enemy);
  const units = document.querySelectorAll('#enemy-area .enemy-unit');
  const unit = idx >= 0 && idx < units.length ? units[idx] : null;
  const img = unit ? unit.querySelector('.enemy-img-wrap img') : null;
  playSE('kieru');
  const p = new Promise(resolve => {
    if (!img || !img.animate) { if (img) hideEnemyImgKeepSpace(img); setTimeout(resolve, ENEMY_VANISH_MS); return; }
    // 白く光りながら少しずつ透けて消える（パズドラ風）
    const anim = img.animate([
      { opacity: 1,   filter: 'brightness(1) saturate(1)',        transform: 'scale(1)' },
      { opacity: .95, filter: 'brightness(2.6) saturate(.4)',     transform: 'scale(1.02)', offset: .25 },
      { opacity: .55, filter: 'brightness(3.2) saturate(0)',      transform: 'scale(1.05)', offset: .65 },
      { opacity: 0,   filter: 'brightness(4) saturate(0) blur(2px)', transform: 'scale(1.08)' }
    ], { duration: ENEMY_VANISH_MS, easing: 'ease-in', fill: 'forwards' });
    let done = false;
    const fin = () => { if (done) return; done = true; hideEnemyImgKeepSpace(img); resolve(); };
    anim.onfinish = fin;
    setTimeout(fin, ENEMY_VANISH_MS + 200);
  });
  enemy._vanishPromise = p;
  _defeatPending.push(p);
  return p;
}

function rollDropCount(count) {
  if (Array.isArray(count)) {
    const lo = count[0], hi = count[1] === undefined ? count[0] : count[1];
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  }
  return count || 1;
}

function tryDrop(enemy, silent = false) {
  // マルチ(オンライン)：ドロップ抽選を「部屋ID＋階層＋何体目か」のシード乱数にして、2人とも同じ報酬になるようにする
  const key = window.MultiShare ? MultiShare.dropKey(enemy) : null;
  if (!key) return _tryDropImpl(enemy, silent);
  return MultiShare.withSeed(key, () => _tryDropImpl(enemy, silent));
}
function _tryDropImpl(enemy, silent = false) {   // silent=true：演出なし（マルチで、相手が倒した階層の報酬だけ受け取る時）
  if (enemy._killCombo === undefined) enemy._killCombo = attackPhaseCombo;   // マルチ：倒した時のコンボ数を控える（相手の端末で10コンボ確定ドロップを判定するため）
  if (enemy._fled) { enemy._dropChecked = true; return; }   // にげた敵は何も落とさない
  if (enemy._dropChecked) return;
  enemy._dropChecked = true;
  // コインは倒した時点で確定ドロップ → 左上の表示に即反映
  addCoin(enemy.coin || 0);
  const vanish = silent ? Promise.resolve() : startEnemyVanish(enemy);
  let dropped = false;
  const dropImgs = [];   // この敵が落とした物の表示用画像（モンスター=ギフト / アイテム=チップ画像）

  // 1体の敵から落ちるのは「チップ1個」か「その敵のモンスター」のどちらか1つだけ。
  // ① チップ（敵データの drops を上から順に抽選し、最初に当たった1つだけ。個数は常に1）
  const chipGuaranteed = attackPhaseCombo >= CHIP_GUARANTEE_COMBO;   // 10コンボ以上で倒した
  for (const d of (enemy.drops || [])) {
    if (!ITEM_DATA[d.item]) continue;
    const r = d.rate === undefined ? 1 : d.rate;
    if (!chipGuaranteed && Math.random() > r) continue;
    droppedItems.push({ item: d.item, count: 1 });
    dropped = true;
    dropImgs.push({ src: ITEM_DATA[d.item].img });
    break;
  }

  // ② チップが出なかったときだけ、モンスターのドロップを抽選
  if (!dropped) {
    const monsterDrop = enemy.monsterDrop || {};
    let rate = monsterDrop.rate;
    if (rate === undefined) {
      rate = enemy.name === 'mp11' ? 0.30 : 0.10; // 既存ダンジョンとの互換用の初期値
    }
    if (monsterDrop.enabled !== false && Math.random() <= rate) {
      // monsterDrop.monsterId があればそのモンスター、なければ敵画像（mpXX.png）と同じIDのモンスター
      let monId = parseInt(monsterDrop.monsterId);
      if (!monId) {
        const idMatch = (enemy.img || '').match(/mp(\d+)\.png/);
        monId = idMatch ? parseInt(idMatch[1]) : 0;
      }
      if (monId && MONSTER_DATA[monId]) { droppedMonsters.push(monId); dropped = true; 
        // ギフト画像は落ちたモンスターの属性に連動（火=gift1 水=2 木=3 光=4 闇=5）
        const mAttr = Array.isArray(MONSTER_DATA[monId].attr) ? MONSTER_DATA[monId].attr[0] : MONSTER_DATA[monId].attr;
        const giftNo = parseInt(ATTR_TO_IMG[mAttr]) <= 5 ? ATTR_TO_IMG[mAttr] : ((droppedMonsters.length + droppedItems.length) % 5 + 1);
        // ★4以上のモンスターが落ちたら giftXs.png（＋虹の光）。giftXs.png が無ければ通常の giftX.png
        const rare = (Number(MONSTER_DATA[monId].rarity) || 0) >= 4;
        dropImgs.push({ src: rare ? `gift${giftNo}s.png` : `gift${giftNo}.png`, fallback: `gift${giftNo}.png`, rare });
      }
    }
  }

  // ③ おふだ（敵データの ofudaDrop。チップ／モンスターとは別に、独立して抽選。初期設定はOFF）
  //    ofudaDrop: { enabled:true, item:'ohuda1', rate:0.2, count:1 }   count は数字 または [最小, 最大]
  const fuda = enemy.ofudaDrop;
  if (fuda && fuda.enabled && ITEM_DATA[fuda.item]) {
    const fr = fuda.rate === undefined ? 1 : Number(fuda.rate);
    if (Math.random() < fr) {
      const cnt = Math.max(1, Math.floor(Number(rollDropCount(fuda.count))) || 1);
      droppedItems.push({ item: fuda.item, count: cnt });
      dropped = true;
      dropImgs.push({ src: ITEM_DATA[fuda.item].img });
    }
  }

  if (!dropped) return;
  updateDropCount();
  if (silent) return;
  // 消滅し終わってからチップ／卵を出す
  const reveal = vanish.then(() => {
    playSE('chip');   // チップ／卵が落ちた音（chip.mp3）
    const idx = enemyList.indexOf(enemy);
    const units = document.querySelectorAll('#enemy-area .enemy-unit');
    if (idx < 0 || idx >= units.length) return;
    const unit = units[idx];
    const row = document.createElement('div');
    row.className = 'enemy-gift-row';
    let anyRare = false;
    dropImgs.forEach(di => {
      const gift = document.createElement('img');
      gift.src = di.src;
      gift.className = 'enemy-gift';
      gift.onerror = function(){
        if (di.fallback && this.src.indexOf(di.fallback) < 0) { this.src = di.fallback; return; }   // giftXs.png が無い時は通常画像
        this.style.display = 'none';
      };
      if (di.rare) {
        // レア（★4以上）：虹色の光が回って、画像の後ろから放たれる
        anyRare = true;
        const wrap = document.createElement('div');
        wrap.className = 'enemy-gift enemy-gift-rare';
        const glow = document.createElement('div'); glow.className = 'rare-rainbow';
        gift.className = 'rare-gift-img';
        wrap.appendChild(glow); wrap.appendChild(gift);
        row.appendChild(wrap);
      } else row.appendChild(gift);
    });

    const dropWrap = unit.querySelector('.enemy-img-wrap') || unit;   // モンスターがいた場所に出す
    dropWrap.appendChild(row);
    // 出現演出を見せる。レア（★4以上）は虹の演出（約1.2秒）が終わってから、さらに1秒おいて次へ進む
    return new Promise(r => setTimeout(r, anyRare ? RARE_DROP_WAIT_MS : 600));
  });
  _defeatPending.push(reveal);
}

// 所持コイン（ホーム左上に表示。localStorage に保存）
const PLAYER_COIN_KEY = 'puzzdra_player_coin';
let playerCoin = 0;
try { playerCoin = Math.max(0, parseInt(localStorage.getItem(PLAYER_COIN_KEY), 10) || 0); } catch (e) {}
function updateHomeCoin() {
  const el = document.getElementById('hh-coin-num');
  if (el) {
    const t = playerCoin.toLocaleString();
    el.textContent = t;
    el.dataset.len = String(t.length);   // 桁数に応じて文字サイズを変える（CSS側）
  }
}
function addPlayerCoin(n) {
  playerCoin = Math.max(0, playerCoin + n);
  try { localStorage.setItem(PLAYER_COIN_KEY, String(playerCoin)); } catch (e) {}
  updateHomeCoin();
}
updateHomeCoin();

function updateCoinDisplay() {
  const el = document.getElementById('coin-count');
  if (el) el.textContent = totalCoin.toLocaleString();
}
function addCoin(n) {
  totalCoin += n;
  updateCoinDisplay();
}

function updateDropCount() {
  const el = document.getElementById('drop-count');
  if (el) el.textContent = String(droppedMonsters.length + droppedItems.length);
}

// ── バトル演出ユーティリティ ──────────────────────────────
// 画像素材を増やさず、属性色・粒子・揺れを重ねて攻撃の手応えを作る。
const FX_COLORS = { fire:'#ff5a36', water:'#33baff', wood:'#59d765', light:'#ffe36b', dark:'#b06cff', heal:'#ff90ba' };
function fxColor(attr) { return FX_COLORS[attr] || '#ffffff'; }
function battleShake(power = 8) {
  const gameEl = document.getElementById('game');
  if (!gameEl || !gameEl.animate) return;
  gameEl.animate([
    { transform:'translate(0,0)' }, { transform:`translate(${-power}px,${power * .35}px)` },
    { transform:`translate(${power}px,${-power * .25}px)` }, { transform:'translate(0,0)' }
  ], { duration: 190, easing:'ease-out' });
}
function spawnEnergyBurst(x, y, attr, strength = 1) {
  const color = fxColor(attr), layer = document.createElement('div');
  layer.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:0;height:0;z-index:220;pointer-events:none;`;
  document.body.appendChild(layer);
  const count = Math.round(12 + strength * 12);
  for (let i=0; i<count; i++) {
    const p = document.createElement('i'), ang = Math.random()*Math.PI*2, dist = (28+Math.random()*70)*strength;
    const size = 3 + Math.random()*8*strength;
    p.style.cssText = `position:absolute;left:0;top:0;width:${size}px;height:${size}px;border-radius:50%;background:${color};box-shadow:0 0 ${8+size*2}px ${color};`;
    layer.appendChild(p);
    p.animate([
      { transform:'translate(-50%,-50%) scale(1)', opacity:1 },
      { transform:`translate(calc(-50% + ${Math.cos(ang)*dist}px),calc(-50% + ${Math.sin(ang)*dist}px)) scale(0)`, opacity:0 }
    ], { duration:330+Math.random()*260, easing:'cubic-bezier(.12,.7,.2,1)', fill:'forwards' });
  }
  setTimeout(()=>layer.remove(), 700);
}
function spawnCastRing(x, y, attr, scale = 1) {
  const ring = document.createElement('div'), color = fxColor(attr);
  ring.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${38*scale}px;height:${38*scale}px;border:2px solid ${color};border-radius:50%;box-shadow:0 0 18px ${color},inset 0 0 14px ${color};z-index:180;pointer-events:none;transform:translate(-50%,-50%) scale(.2);`;
  document.body.appendChild(ring);
  ring.animate([{transform:'translate(-50%,-50%) scale(.2)',opacity:0},{transform:'translate(-50%,-50%) scale(1.9)',opacity:1},{transform:'translate(-50%,-50%) scale(2.5)',opacity:0}],{duration:420,easing:'ease-out',fill:'forwards'});
  setTimeout(()=>ring.remove(),500);
}
// ダメージ数字：読めるように長く残す（DMG_NUM_MS）。同じ場所に続けて出るときは縦にずらして重ならないようにする
const DMG_NUM_MS = 1500;
// ★ 味方の攻撃テンポ（単体攻撃・全体攻撃で共通。ここを変えると全部いっしょに変わります）
const ATK_FLY_MS = 300;   // 攻撃が相手に飛んでいく時間（従来560ms）
const ATK_GAP_MS = 120;   // 当たってから次のモンスターが攻撃するまでの間（従来450ms）
const _recentDmgNums = [];
function showDamageNumber(x, y, value, attr, critical = false, slotIndex = null) {
  // 通常はこちら（js/damage-number.js：太い数字・属性色・弱点は特大）。critical = 弱点属性で当たったとき
  if (window.DamageNumber) { window.DamageNumber.show(x, y, value, attr, critical, slotIndex); return; }
  // ↓ damage-number.js が読み込めなかったときの予備（従来の表示）
  const nowT = performance.now();
  while (_recentDmgNums.length && nowT - _recentDmgNums[0].t > 750) _recentDmgNums.shift();
  let stack = 0;
  for (const r of _recentDmgNums) if (Math.abs(r.x - x) < 60 && Math.abs(r.y - y) < 70) stack++;
  _recentDmgNums.push({ x, y, t: nowT });
  y -= Math.min(stack, 4) * 30;
  const n = document.createElement('div'), color = fxColor(attr);
  n.style.cssText = `position:fixed;left:${x}px;top:${y}px;z-index:230;pointer-events:none;transform:translate(-50%,-50%);font-family:Impact,"Arial Black",sans-serif;font-size:${critical?'1.8':'1.35'}rem;letter-spacing:.04em;color:#fff;text-shadow:0 2px 0 #111,0 0 7px ${color},0 0 16px ${color};`;
  n.textContent = Math.max(0, Math.floor(value)).toLocaleString();
  document.body.appendChild(n);
  // ぽんと出る → 少し上がって止まる（ここで読める）→ ゆっくり消える
  n.animate([{transform:'translate(-50%,-15%) scale(.35)',opacity:0},{transform:'translate(-50%,-90%) scale(1.3)',opacity:1,offset:.12},{transform:'translate(-50%,-115%) scale(1)',opacity:1,offset:.3},{transform:'translate(-50%,-135%) scale(1)',opacity:1,offset:.78},{transform:'translate(-50%,-170%) scale(.85)',opacity:0}],{duration:DMG_NUM_MS,easing:'ease-out',fill:'forwards'});
  setTimeout(()=>n.remove(),DMG_NUM_MS+100);
}
// ── 敵スキルウインドウ（パズドラ風）：青い帯＋技名。表示中はそのモンスターが点滅、効果音が終わるまで待つ ──
function showEnemySkillWindow(enemy, name) {
  return new Promise(resolve => {
    const dungeon = document.getElementById('dungeon') || document.body;
    const idx = enemyList.indexOf(enemy);
    const units = document.querySelectorAll('#enemy-area .enemy-unit');
    const wrap = idx >= 0 && idx < units.length ? units[idx].querySelector('.enemy-img-wrap') : null;
    const win = document.createElement('div');
    win.className = 'enemy-skill-window';
    win.textContent = name;
    { const n = [...String(name)].length;   // 長い技名は文字を小さくして2行まで全文表示
      if (n > 26) win.classList.add('len-xl'); else if (n > 18) win.classList.add('len-l'); else if (n > 11) win.classList.add('len-m'); }
    dungeon.appendChild(win);
    const blink = (wrap && wrap.animate)
      ? wrap.animate([{ opacity:1 }, { opacity:1, offset:.45 }, { opacity:.12, offset:.5 }, { opacity:.12, offset:.95 }, { opacity:1 }],
                     { duration:300, iterations:Infinity })
      : null;
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      if (blink) blink.cancel();
      win.remove();
      resolve();
    };
    // 効果音の長さ分だけ待つ（読み込み失敗時は1.4秒で再開）
    try {
      const a = new Audio('skillwin.wav');
      a.volume = 0.9;
      a.addEventListener('ended', finish);
      a.addEventListener('error', () => setTimeout(finish, 1400));
      a.play().catch(() => setTimeout(finish, 1400));
    } catch (e) { setTimeout(finish, 1400); }
    setTimeout(finish, 4000);   // 保険
  });
}


// ============================================================
// ★ 敵の自己強化・回復スキルの演出（1つずつ順番。演出の途中で効果が付く） ★
// ============================================================
function _fxLayer(enemy) {
  const idx = enemyList.indexOf(enemy);
  const units = document.querySelectorAll('#enemy-area .enemy-unit');
  const wrap = idx >= 0 && idx < units.length ? units[idx].querySelector('.enemy-img-wrap') : null;
  if (!wrap) return null;
  const r = wrap.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;z-index:230;pointer-events:none;overflow:visible;`;
  document.body.appendChild(layer);
  return { layer, w: r.width, h: r.height, cx: r.width / 2, cy: r.height / 2 };
}
const _FX_ORB_COLORS = ['#ff5a36', '#33baff', '#59d765', '#ffe36b', '#b06cff', '#ff90ba'];

// 効果を先に適用して「新しく出来るアイコン」を隠し、その位置を返す（演出はそこへ向かう／そこで出現する）
function _prepareNewIcon(enemy, apply, title, layerEl) {
  apply();
  const idx = enemyList.indexOf(enemy);
  const units = document.querySelectorAll('#enemy-area .enemy-unit');
  const el = idx >= 0 && idx < units.length ? units[idx].querySelector(`.enemy-status-icons .st-icon[title="${title}"]`) : null;
  if (!el) return null;
  el.style.opacity = '0';
  const r = el.getBoundingClientRect(), lr = layerEl.getBoundingClientRect();
  return { el, x: r.left + r.width / 2 - lr.left, y: r.top + r.height / 2 - lr.top, size: Math.max(r.width, r.height) };
}
function _revealIcon(tg, layer) {          // アイコンがポンと現れる
  if (!tg) return;
  tg.el.style.opacity = '';
  if (tg.el.animate) tg.el.animate([{ transform:'scale(2.4)', opacity:0 }, { transform:'scale(.85)', opacity:1, offset:.55 }, { transform:'scale(1)', opacity:1 }], { duration: 320, easing:'ease-out' });
  const ring = document.createElement('div');
  const d = tg.size * 1.8;
  ring.style.cssText = `position:absolute;left:${tg.x - d/2}px;top:${tg.y - d/2}px;width:${d}px;height:${d}px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 10px #fff;`;
  layer.appendChild(ring);
  ring.animate([{ transform:'scale(.3)', opacity:1 }, { transform:'scale(1.5)', opacity:0 }], { duration: 360, easing:'ease-out' });
}

// コンボ吸収：コンボ吸収アイコンの位置にドロップが集まり、そこでアイコンが増える（約1秒）
async function fxComboAbsorb(enemy, sk, apply) {
  playSE('combok');
  const f = _fxLayer(enemy);
  if (!f) { apply(); await sleep(1000); return; }
  const tg = _prepareNewIcon(enemy, apply, `${Math.max(1, sk.combo || 5)}コンボ以下吸収`, f.layer);
  const tx = tg ? tg.x : f.cx, ty = tg ? tg.y : f.cy;
  const R = Math.max(50, f.w * 0.55);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.random() * 0.4, d = R * (0.7 + Math.random() * 0.6);
    const sz = Math.max(10, Math.min(18, f.w * 0.11)), c = _FX_ORB_COLORS[i % _FX_ORB_COLORS.length];
    const o = document.createElement('i');
    o.style.cssText = `position:absolute;left:${tx}px;top:${ty}px;width:${sz}px;height:${sz}px;margin:${-sz/2}px 0 0 ${-sz/2}px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff 0 12%,${c} 40%,#241033 100%);box-shadow:0 0 8px ${c};`;
    f.layer.appendChild(o);
    o.animate([
      { transform:`translate(${Math.cos(a)*d}px,${Math.sin(a)*d}px) scale(.6)`, opacity:0 },
      { opacity:1, offset:.2 },
      { transform:'translate(0,0) scale(1)', opacity:1, offset:.8 },
      { transform:'translate(0,0) scale(.2)', opacity:0 }
    ], { duration: 700, delay: i * 16, easing:'cubic-bezier(.4,0,.6,1)', fill:'both' });
  }
  await sleep(760);
  _revealIcon(tg, f.layer);                        // ここでアイコンが増える
  await sleep(300);
  f.layer.remove();
}

// ダメージ軽減／属性軽減：bshield.mp3 を鳴らし、軽減アイコンがポンと増える
function _guardIconTitle(sk) {
  if (sk.type === 'super_gut') return `超根性${Math.round(Math.max(1, Math.min(100, Number(sk.rate) || 50)))}%`;
  if (sk.type === 'attr_guard') {
    const N = { fire:'火', water:'水', wood:'木', light:'光', dark:'闇' };
    return `${N[guardAttrOf(sk)] || '闇'}属性軽減`;
  }
  return `ダメージ軽減${Math.round(Math.max(0, Math.min(100, Number(sk.rate) || 0)))}%`;
}
async function fxGuard(enemy, sk, apply) {
  playSE('bshield');
  const f = _fxLayer(enemy);
  if (!f) { apply(); await sleep(800); return; }
  const tg = _prepareNewIcon(enemy, apply, _guardIconTitle(sk), f.layer);
  await sleep(500);
  _revealIcon(tg, f.layer);
  await sleep(300);
  f.layer.remove();
}

// 超根性：軽減と同じ「盾」の演出で、超根性アイコン（tc.png）がポンと現れる
async function fxSuperGut(enemy, sk, apply) { return fxGuard(enemy, sk, apply); }

// 状態異常無効：魔法陣が展開 → 六角形のエネルギーシールドが中心から波のように張られ、状態異常の弾をはじく
//   → 光がアイコンへ飛んで、状態異常無効アイコンが増える（約1.95秒）
let _shieldSeq = 0;
async function fxStatusShield(enemy, sk, apply) {
  playSE('barrier');
  const f = _fxLayer(enemy);
  if (!f) { apply(); await sleep(2000); return; }
  const tg = _prepareNewIcon(enemy, apply, '状態異常無効', f.layer);
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const d = Math.max(f.w, f.h) * 1.2, R = d / 2, cx = f.cx, cy = f.cy;
  const SH = '#d8f8ff', GL = 'rgba(100,210,255,.95)';
  const place = (el, size) => { el.style.position = 'absolute'; el.style.left = (cx - size / 2) + 'px'; el.style.top = (cy - size / 2) + 'px'; el.style.width = size + 'px'; el.style.height = size + 'px'; };

  // ① 魔法陣がくるっと展開（外へ広がって消える）
  const rd = d * 1.18, rr = rd / 2;
  const rune = mk('svg', { viewBox: `0 0 ${rd} ${rd}` });
  place(rune, rd);
  rune.style.overflow = 'visible'; rune.style.opacity = '0'; rune.style.filter = `drop-shadow(0 0 5px ${GL})`;
  const rs = { fill: 'none', stroke: SH, 'stroke-width': 2 };
  mk('circle', { ...rs, cx: rr, cy: rr, r: rr - 2 }, rune);
  mk('circle', { ...rs, cx: rr, cy: rr, r: rr * .86, 'stroke-width': 1.2, 'stroke-dasharray': '4 7' }, rune);
  const tri = a0 => [0, 1, 2].map(i => { const a = (a0 + i * 120) * Math.PI / 180; return `${rr + Math.cos(a) * rr * .8},${rr + Math.sin(a) * rr * .8}`; }).join(' ');
  mk('polygon', { ...rs, points: tri(-90), 'stroke-width': 1.5 }, rune);
  mk('polygon', { ...rs, points: tri(90), 'stroke-width': 1.5 }, rune);
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2, r1 = rr - 2, r2 = rr - (i % 2 ? 8 : 14);
    mk('line', { x1: rr + Math.cos(a) * r1, y1: rr + Math.sin(a) * r1, x2: rr + Math.cos(a) * r2, y2: rr + Math.sin(a) * r2, stroke: SH, 'stroke-width': 1.5 }, rune);
  }
  f.layer.appendChild(rune);
  rune.animate([
    { opacity: 0,  transform: 'scale(.3) rotate(-120deg)' },
    { opacity: 1,  transform: 'scale(1) rotate(0deg)', offset: .35 },
    { opacity: .9, transform: 'scale(1.02) rotate(60deg)', offset: .7 },
    { opacity: 0,  transform: 'scale(1.35) rotate(120deg)' }
  ], { duration: 1100, easing: 'linear', fill: 'both' });

  // ② シールド本体：うすい膜 ＋ 六角形のセル ＋ ふちの輪 ＋ 走る光
  const bar = document.createElement('div');
  place(bar, d);
  bar.style.opacity = '0';
  const dome = document.createElement('div');
  dome.style.cssText = 'position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,rgba(120,210,255,.03) 48%,rgba(120,210,255,.26) 80%,rgba(215,250,255,.72) 100%);' +
    'box-shadow:0 0 22px rgba(100,210,255,.75),inset 0 0 26px rgba(150,230,255,.55);';
  bar.appendChild(dome);
  const svg = mk('svg', { viewBox: `0 0 ${d} ${d}` }, bar);
  svg.style.cssText = `position:absolute;inset:0;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 0 4px ${GL});`;
  const cid = 'shc' + (++_shieldSeq);
  mk('circle', { cx: R, cy: R, r: R }, mk('clipPath', { id: cid }, mk('defs', {}, svg)));
  const grp = mk('g', { 'clip-path': `url(#${cid})` }, svg);
  const hr = Math.max(8, d / 11), hw = hr * 1.5, hh = Math.sqrt(3) * hr, N = Math.ceil(R / hw) + 2;
  const cells = [];
  for (let col = -N; col <= N; col++) {
    for (let row = -N; row <= N; row++) {
      const x = R + col * hw, y = R + row * hh + (col & 1 ? hh / 2 : 0);
      const dist = Math.hypot(x - R, y - R);
      if (dist > R + hr) continue;
      const pts = [0, 1, 2, 3, 4, 5].map(k => { const a = k * Math.PI / 3; return `${(x + Math.cos(a) * hr * .93).toFixed(1)},${(y + Math.sin(a) * hr * .93).toFixed(1)}`; }).join(' ');
      const c = mk('polygon', { points: pts, fill: 'rgba(110,210,255,.12)', stroke: 'rgba(210,248,255,.85)', 'stroke-width': 1.3 }, grp);
      c.style.opacity = '0';
      c.animate([   // 中心から外へ、白く光りながら波のように張られる
        { opacity: 0, fill: 'rgba(255,255,255,.9)' },
        { opacity: 1, fill: 'rgba(190,240,255,.5)', offset: .3 },
        { opacity: .65, fill: 'rgba(110,210,255,.12)' }
      ], { duration: 650, delay: 150 + (dist / R) * 450, easing: 'ease-out', fill: 'forwards' });
      cells.push(c);
    }
  }
  for (let i = 0; i < 8; i++) {   // 張り終わったあと、ところどころがきらっと光る
    const c = cells[Math.floor(Math.random() * cells.length)];
    if (c) c.animate([{ opacity: .65 }, { opacity: 1, fill: 'rgba(200,245,255,.55)' }, { opacity: .65 }], { duration: 350, delay: 800 + Math.random() * 500 });
  }
  const C = 2 * Math.PI * (R - 1.5);   // ふちの輪が、ぐるっと描かれる
  const rim = mk('circle', { cx: R, cy: R, r: R - 1.5, fill: 'none', stroke: SH, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-dasharray': C, 'stroke-dashoffset': C, transform: `rotate(-90 ${R} ${R})` }, svg);
  rim.animate([{ strokeDashoffset: C }, { strokeDashoffset: 0 }], { duration: 550, delay: 150, easing: 'ease-in-out', fill: 'forwards' });
  const clip = document.createElement('div');   // 光がシールドの上をさっと走る
  clip.style.cssText = 'position:absolute;inset:0;border-radius:50%;overflow:hidden;';
  const band = document.createElement('div');
  band.style.cssText = 'position:absolute;top:-20%;bottom:-20%;left:-45%;width:38%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.85),transparent);opacity:0;';
  clip.appendChild(band); bar.appendChild(clip);
  band.animate([
    { transform: 'translateX(0) skewX(-18deg)', opacity: 0 },
    { opacity: 1, offset: .25 },
    { transform: `translateX(${d * 1.6}px) skewX(-18deg)`, opacity: 0 }
  ], { duration: 650, delay: 450, easing: 'ease-in-out', fill: 'both' });
  f.layer.appendChild(bar);
  bar.animate([   // 張られた瞬間にぐっと膨らみ、脈打ち、最後に光って消える
    { opacity: 0, transform: 'scale(.85)' },
    { opacity: 1, transform: 'scale(1.06)', offset: .10 },
    { transform: 'scale(1)', offset: .20 },
    { transform: 'scale(1.03)', offset: .36 },
    { transform: 'scale(1)', offset: .46 },
    { transform: 'scale(1.025)', offset: .60 },
    { opacity: 1, transform: 'scale(1)', offset: .72 },
    { opacity: 0, transform: 'scale(1.1)' }
  ], { duration: 1850, delay: 100, easing: 'linear', fill: 'both' });

  // ③ （状態異常のドロップ状の弾がシールドに入り込む演出は削除）

  // ④ シールドの力が、状態異常無効アイコンへ飛び込む
  await sleep(1050);
  if (tg) {
    for (let i = 0; i < 3; i++) {
      const o = document.createElement('i'), sz = 12 - i * 2;
      o.style.cssText = `position:absolute;left:${cx}px;top:${cy}px;width:${sz}px;height:${sz}px;margin:${-sz / 2}px 0 0 ${-sz / 2}px;border-radius:50%;` +
        `background:radial-gradient(circle,#fff 0 30%,#7fe0ff 70%,rgba(127,224,255,0));box-shadow:0 0 12px #7fe0ff;opacity:0;`;
      f.layer.appendChild(o);
      o.animate([
        { transform: 'translate(0,0) scale(1.4)', opacity: 0 },
        { opacity: 1, offset: .15 },
        { transform: `translate(${tg.x - cx}px,${tg.y - cy}px) scale(.7)`, opacity: 1 }
      ], { duration: 330, delay: i * 50, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' });
    }
  }
  await sleep(380);
  _revealIcon(tg, f.layer);                        // シールドが張られたところでアイコンが増える
  await sleep(520);
  f.layer.remove();
}

// 攻撃アップ：赤いオーラ → 攻撃アップアイコン(ikari.png)が増える（約1秒）
async function fxAttackUp(enemy, sk, apply) {
  playSE('ikari');
  const f = _fxLayer(enemy);
  if (!f) { apply(); await sleep(1000); return; }
  const tg = _prepareNewIcon(enemy, apply, '攻撃アップ', f.layer);
  const aura = document.createElement('div');
  aura.style.cssText = `position:absolute;left:${-f.w*.15}px;top:${-f.h*.15}px;width:${f.w*1.3}px;height:${f.h*1.3}px;border-radius:50%;background:radial-gradient(circle,rgba(255,40,20,.0) 30%,rgba(255,40,20,.55) 62%,rgba(255,0,0,0) 80%);mix-blend-mode:screen;filter:blur(3px);`;
  f.layer.appendChild(aura);
  aura.animate([{ opacity:0, transform:'scale(.7)' }, { opacity:1, transform:'scale(1.05)', offset:.3 }, { opacity:.7, transform:'scale(.98)', offset:.55 }, { opacity:1, transform:'scale(1.08)', offset:.8 }, { opacity:0, transform:'scale(1.2)' }], { duration: 1000, easing:'ease-out' });
  for (let i = 0; i < 14; i++) {      // 立ちのぼる赤い火の粉
    const p = document.createElement('i'), x = Math.random() * f.w, sz = 3 + Math.random() * 6;
    p.style.cssText = `position:absolute;left:${x}px;top:${f.h * (0.6 + Math.random()*.4)}px;width:${sz}px;height:${sz*1.6}px;border-radius:50%;background:#ff5030;box-shadow:0 0 8px #f20;`;
    f.layer.appendChild(p);
    p.animate([{ transform:'translateY(0)', opacity:0 }, { opacity:1, offset:.2 }, { transform:`translateY(${-f.h*(.5+Math.random()*.5)}px)`, opacity:0 }], { duration: 650 + Math.random()*300, delay: Math.random()*250, fill:'both' });
  }
  await sleep(550);
  _revealIcon(tg, f.layer);                        // 攻撃アップのアイコン（ターン付き）が増える
  await sleep(450);
  f.layer.remove();
}

// 行動変化：change.mp3 と同時に、紫と金のオーラをまとう（約1.4秒）。途中で行動間隔が切り替わる
async function fxActionChange(enemy, sk, apply) {
  playSE('change');
  const f = _fxLayer(enemy);
  if (!f) { apply(); await sleep(1400); return; }
  const aura = document.createElement('div');
  aura.style.cssText = `position:absolute;left:${-f.w*.2}px;top:${-f.h*.2}px;width:${f.w*1.4}px;height:${f.h*1.4}px;border-radius:50%;background:radial-gradient(circle,rgba(190,90,255,0) 28%,rgba(190,90,255,.6) 58%,rgba(255,220,90,.35) 72%,rgba(255,200,60,0) 84%);mix-blend-mode:screen;filter:blur(3px);`;
  f.layer.appendChild(aura);
  aura.animate([{ opacity:0, transform:'scale(.6)' }, { opacity:1, transform:'scale(1.05)', offset:.25 }, { opacity:.75, transform:'scale(.97)', offset:.5 }, { opacity:1, transform:'scale(1.1)', offset:.78 }, { opacity:0, transform:'scale(1.25)' }], { duration: 1400, easing:'ease-out', fill:'forwards' });
  const ring = document.createElement('div');
  const d = Math.max(f.w, f.h) * 0.9;
  ring.style.cssText = `position:absolute;left:${f.cx - d/2}px;top:${f.cy - d/2}px;width:${d}px;height:${d}px;border-radius:50%;border:3px solid #ffe27a;box-shadow:0 0 14px #c06bff,inset 0 0 14px #c06bff;`;
  f.layer.appendChild(ring);
  ring.animate([{ transform:'scale(.5)', opacity:0 }, { opacity:1, offset:.2 }, { transform:'scale(1.6)', opacity:0 }], { duration: 1000, delay: 250, easing:'ease-out', fill:'both' });
  for (let i = 0; i < 16; i++) {      // 立ちのぼる紫と金の光の粉
    const q = document.createElement('i'), x = Math.random() * f.w, sz = 3 + Math.random() * 6, col = i % 2 ? '#d58cff' : '#ffe27a';
    q.style.cssText = `position:absolute;left:${x}px;top:${f.h * (0.55 + Math.random()*.45)}px;width:${sz}px;height:${sz*1.6}px;border-radius:50%;background:${col};box-shadow:0 0 8px ${col};`;
    f.layer.appendChild(q);
    q.animate([{ transform:'translateY(0)', opacity:0 }, { opacity:1, offset:.2 }, { transform:`translateY(${-f.h*(.5+Math.random()*.5)}px)`, opacity:0 }], { duration: 700 + Math.random()*350, delay: Math.random()*350, fill:'both' });
  }
  await sleep(600);
  apply();                                         // オーラが最大になったところで行動間隔が切り替わる
  await sleep(800);
  f.layer.remove();
}

// HP回復：癒しの緑の光（約1秒）
async function fxHeal(enemy, sk, apply) {
  playSE('healk');
  const f = _fxLayer(enemy);
  if (!f) { apply(); await sleep(1000); return; }
  const g = document.createElement('div');
  g.style.cssText = `position:absolute;inset:-12%;border-radius:50%;background:radial-gradient(circle,rgba(120,255,150,.75),rgba(80,230,120,.3) 55%,rgba(80,230,120,0) 75%);mix-blend-mode:screen;`;
  f.layer.appendChild(g);
  g.animate([{ opacity:0, transform:'scale(.7)' }, { opacity:1, transform:'scale(1)', offset:.35 }, { opacity:.8, transform:'scale(1.05)', offset:.7 }, { opacity:0, transform:'scale(1.15)' }], { duration: 1000, easing:'ease-out' });
  for (let i = 0; i < 16; i++) {      // 立ちのぼる緑の光
    const p = document.createElement('i'), x = f.w * (.1 + Math.random() * .8), sz = 3 + Math.random() * 6;
    p.style.cssText = `position:absolute;left:${x}px;top:${f.h * (0.55 + Math.random()*.4)}px;width:${sz}px;height:${sz}px;border-radius:50%;background:#c8ffd0;box-shadow:0 0 10px #4f8,0 0 4px #fff;`;
    f.layer.appendChild(p);
    p.animate([{ transform:'translateY(0) scale(.5)', opacity:0 }, { opacity:1, offset:.25 }, { transform:`translateY(${-f.h*(.4+Math.random()*.5)}px) scale(1)`, opacity:0 }], { duration: 700 + Math.random()*250, delay: Math.random()*250, fill:'both' });
  }
  await sleep(300);
  apply();                                        // HPバーが回復していく
  await sleep(700);
  f.layer.remove();
}

// 暗闇：盤面に黒い霧が広がり、ドロップが見えなくなる（約1.2秒）
async function fxBlind(enemy, sk, apply) {
  playSE('darkness');
  const g = document.getElementById('grid');
  if (!g) { apply(); await sleep(1200); return; }
  const rc = g.getBoundingClientRect();
  const mist = document.createElement('div');
  mist.style.cssText = `position:fixed;left:${rc.left - 6}px;top:${rc.top - 6}px;width:${rc.width + 12}px;height:${rc.height + 12}px;z-index:145;pointer-events:none;border-radius:10px;overflow:hidden;background:radial-gradient(ellipse at 50% 50%,rgba(40,10,60,.92),rgba(5,0,12,.97) 70%);`;
  for (let i = 0; i < 9; i++) {
    const w = document.createElement('i');
    const sz = rc.width * (.35 + Math.random() * .3);
    w.style.cssText = `position:absolute;left:${Math.random() * rc.width - sz / 2}px;top:${Math.random() * rc.height - sz / 2}px;width:${sz}px;height:${sz}px;border-radius:50%;background:radial-gradient(circle,rgba(150,70,210,.55),rgba(150,70,210,0) 70%);filter:blur(6px);`;
    mist.appendChild(w);
    w.animate([{ transform:'translate(0,0) scale(.8)' }, { transform:`translate(${(Math.random() - .5) * 90}px,${(Math.random() - .5) * 60}px) scale(1.3)` }], { duration: 1100, easing:'ease-in-out', fill:'forwards' });
  }
  document.body.appendChild(mist);
  mist.animate([{ opacity:0 }, { opacity:1, offset:.35 }, { opacity:1, offset:.6 }, { opacity:0 }], { duration: 1150, easing:'ease-out', fill:'forwards' });
  await sleep(450);
  apply();                                         // 霧が濃くなったところで盤面が暗闇になる
  await sleep(750);
  mist.remove();
}

// ルーレット：盤面に枠が現れる（枠のポンッという出現アニメは CSS 側）
async function fxRoulette(enemy, sk, apply) {
  apply();
  await sleep(800);
}

// バインド：敵から紫のバインド弾が飛んでいき、当たったモンスターが拘束される（当たった瞬間に効果音 bind.mp3）
async function fxBind(enemy, sk, apply) {
  const targets = pickBindTargets(sk);            // 対象とターン数は抽選済み（全員／属性指定／ランダム〇〜〇体）
  sk._fxApplied = true;                           // 効果はこの演出の中で適用する（行動処理側ではスキップ）
  if (!targets.length) return;

  const units = document.querySelectorAll('#enemy-area .enemy-unit');
  const eIdx = enemyList.indexOf(enemy);
  const wrap = units[eIdx] && units[eIdx].querySelector('.enemy-img-wrap');
  const er = wrap ? wrap.getBoundingClientRect() : { left: window.innerWidth / 2 - 20, top: 90, width: 40, height: 40 };
  const sx = er.left + er.width / 2, sy = er.top + er.height / 2;
  const slotsNow = document.querySelectorAll('#party-grid .party-slot');
  const FLY = 430;
  let sePlayed = false;

  const mkOrb = (size, a) => {
    const d = document.createElement('div');
    d.style.cssText = `position:fixed;left:${sx - size / 2}px;top:${sy - size / 2}px;width:${size}px;height:${size}px;border-radius:50%;z-index:150;pointer-events:none;opacity:0;`
      + `background:radial-gradient(circle,rgba(255,255,255,${a}) 0%,rgba(205,150,255,${a * .9}) 38%,rgba(110,40,200,0) 74%);box-shadow:0 0 ${size * .6}px rgba(170,90,255,.85);`;
    document.body.appendChild(d);
    return d;
  };

  const impact = (t) => {
    bindTimers[t.u] = (bindTimers[t.u] || 0) + t.turns;   // ここでバインド成立
    updatePlayerHP();   // バインドされたモンスターのHP分だけ最大HPが減る
    if (!sePlayed) { sePlayed = true; playSE('bind'); }
    renderParty();
    renderBuffIcons();
    const slot = document.querySelectorAll('#party-grid .party-slot')[t.i];
    if (!slot) return;
    if (slot.animate) slot.animate([
      { transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' },
      { transform: 'translateX(-3px)' }, { transform: 'translateX(2px)' }, { transform: 'translateX(0)' }
    ], { duration: 300, easing: 'ease-out' });
    const flash = document.createElement('div');
    flash.style.cssText = 'position:absolute;inset:0;z-index:30;pointer-events:none;border-radius:4px;background:radial-gradient(circle,rgba(255,255,255,.95),rgba(160,200,255,.7) 55%,rgba(120,80,255,.2));';
    slot.appendChild(flash);
    if (flash.animate) flash.animate([{ opacity: 1 }, { opacity: .85, offset: .25 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' }).onfinish = () => flash.remove();
    else setTimeout(() => flash.remove(), 420);
  };

  const flights = targets.map((t, k) => new Promise(resolve => {
    const s = slotsNow[t.i];
    if (!s || !document.body.animate) { impact(t); resolve(); return; }
    const r = s.getBoundingClientRect();
    const dx = r.left + r.width / 2 - sx, dy = r.top + r.height / 2 - sy;
    const delay = k * 90;
    const path = (sc0, sc1, o) => [
      { transform: `translate(0,0) scale(${sc0})`, opacity: 0 },
      { transform: `translate(${dx * .08}px,${dy * .08}px) scale(${sc0})`, opacity: o, offset: .08 },
      { transform: `translate(${dx}px,${dy}px) scale(${sc1})`, opacity: o }
    ];
    // 尾（バインドの鎖のように連なる光）
    for (let j = 1; j <= 5; j++) {
      const tail = mkOrb(16 - j * 2, .8);
      tail.animate(path(.7, .5, Math.max(.15, .75 - j * .12)), { duration: FLY, delay: delay + j * 32, easing: 'cubic-bezier(.45,0,.85,.6)', fill: 'both' }).onfinish = () => tail.remove();
    }
    const orb = mkOrb(30, 1);
    const anim = orb.animate(path(.6, 1.05, 1), { duration: FLY, delay, easing: 'cubic-bezier(.45,0,.85,.6)', fill: 'forwards' });
    anim.onfinish = () => { orb.remove(); impact(t); setTimeout(resolve, 380); };
  }));

  await Promise.all(flights);
  await sleep(150);
}

// スキル使用不可：全員のモンスターに「S❌」の札がドンと押される
async function fxSkillSeal(enemy, sk, apply) {
  apply();   // 効果音（bind.mp3）と封印の適用
  const slotsNow = document.querySelectorAll('#party-grid .party-slot');
  slotsNow.forEach((slot, i) => {
    if (!slot || partyUids[i] === null || partyUids[i] === undefined || !slot.animate) return;
    const f = document.createElement('div');
    f.style.cssText = `position:absolute;left:50%;top:50%;width:70%;max-width:56px;aspect-ratio:1/1;z-index:31;pointer-events:none;filter:drop-shadow(0 2px 6px rgba(0,0,0,.8));transform:translate(-50%,-50%);background:url("${ICON_SKILL_SEAL}") center/contain no-repeat;`;
    slot.appendChild(f);
    f.animate([
      { opacity: 0, transform: 'translate(-50%,-50%) scale(2.4)' },
      { opacity: 1, offset: .28, transform: 'translate(-50%,-50%) scale(1)' },
      { opacity: 1, offset: .75, transform: 'translate(-50%,-50%) scale(1)' },
      { opacity: 0, transform: 'translate(-50%,-50%) scale(.9)' }
    ], { duration: 800, easing: 'ease-out' }).onfinish = () => f.remove();
  });
  await sleep(850);
}

// 落ちコンなし：盤面にドロップ落下禁止のマークが出る
async function fxNoFall(enemy, sk, apply) {
  apply();   // 効果音（dna.mp3）と適用
  const gridEl = document.getElementById('grid');
  if (!gridEl || !gridEl.animate) { await sleep(400); return; }
  const r = gridEl.getBoundingClientRect();
  const f = document.createElement('div');
  f.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;z-index:150;pointer-events:none;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle,rgba(20,70,110,.55),rgba(10,20,50,.15) 75%);`;
  const im = document.createElement('img');
  im.src = ICON_NO_FALL; im.alt = '';
  im.style.cssText = `width:${Math.min(r.width, r.height) * .42}px;filter:drop-shadow(0 3px 10px rgba(0,0,0,.85));`;
  f.appendChild(im);
  document.body.appendChild(f);
  f.animate([
    { opacity: 0, transform: 'scale(1.5)' }, { opacity: 1, offset: .25, transform: 'scale(1)' },
    { opacity: 1, offset: .75, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.95)' }
  ], { duration: 900, easing: 'ease-out' }).onfinish = () => f.remove();
  await sleep(950);
}

// 攻撃力ダウン：対象属性のモンスターに暗い青の「▼」が走り、攻撃力が下がる
async function fxAtkDown(enemy, sk, apply) {
  apply();   // 効果音（down.mp3）は apply の中（atk_down の適用時）で鳴る
  const attr = sk.target === 'all' ? 'all' : (sk.attr || 'fire');
  const slotsNow = document.querySelectorAll('#party-grid .party-slot');
  partyUids.forEach((u, i) => {
    if (u === null) return;
    const entry = box.find(b => b.uid === u);
    const mon = entry && MONSTER_DATA[entry.monsterId];
    if (!mon || (attr !== 'all' && mon.attr !== attr)) return;
    const slot = slotsNow[i];
    if (!slot || !slot.animate) return;
    const f = document.createElement('div');
    f.textContent = '▼';
    f.style.cssText = 'position:absolute;inset:0;z-index:30;pointer-events:none;display:flex;align-items:center;justify-content:center;font-size:1.6rem;font-weight:900;color:#9cc4ff;text-shadow:0 0 8px #1d4ed8;background:radial-gradient(circle,rgba(40,80,200,.55),rgba(10,20,60,.15) 70%);border-radius:4px;';
    slot.appendChild(f);
    f.animate([{ opacity: 0, transform: 'translateY(-14px)' }, { opacity: 1, offset: .3, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(10px)' }], { duration: 700, easing: 'ease-out' }).onfinish = () => f.remove();
  });
  await sleep(750);
}

async function playEnemySelfSkillFx(enemy, action, actionName) {
  let sks = (action && action.skills) ? action.skills : [];
  if (!sks.length && actionName === 'キュアー') sks = [{ type:'heal_self', _noApply:true }];   // 半分以下で使う回復（効果は呼び出し側で適用）
  const table = { combo_absorb: fxComboAbsorb, status_shield: fxStatusShield, dmg_reduce: fxGuard, attr_guard: fxGuard, super_gut: fxSuperGut, attack_buff: fxAttackUp, heal_self: fxHeal, action_change: fxActionChange, blind: fxBlind, bind: fxBind, atk_down: fxAtkDown, skill_seal: fxSkillSeal, no_fall: fxNoFall, roulette: fxRoulette };
  for (const sk of sks) {
    const fx = table[sk.type];
    if (!fx) continue;
    const apply = () => { if (sk._noApply) return; buildEnemyActionFn([sk], enemy)(enemy); sk._fxApplied = true; updateEnemyUI(); };
    await fx(enemy, sk, apply);
    await sleep(200);                              // 次のスキルへ（個別に順番に）
  }
}

async function showEnemyAttackEffect(enemy, actionName, selectedAction, isPreemptive = false, forceWindow = false) {
  const units = document.querySelectorAll('#enemy-area .enemy-unit');
  const eIdx = enemyList.indexOf(enemy);
  const enemyUnit = eIdx >= 0 && eIdx < units.length ? units[eIdx] : null;
  // ダメージ技が無い行動（先制のシールド・バインド等）は弾も被ダメージ演出も出さない
  // 割合ダメージを含む行動は、ほかのダメージ技が混ざっていても「覇気の一撃」を1回だけ（以前は damage_mult + damage_ratio で2発に割れていた）
  const hasRatio = !!(selectedAction && selectedAction.skills && selectedAction.skills.some(sk => sk.type === 'damage_ratio'));
  const hitCount = hasRatio ? 1 : (selectedAction && selectedAction.skills
    ? selectedAction.skills.reduce((s, sk) => s + ((sk.type === 'damage' || sk.type === 'damage_mult') ? (sk.repeat || 1) : 0), 0)
    : 1);
  const _noWin = !!(window._mtReplayNoWin);   // マルチ：相手の画面で再生するとき、相手の画面と同じ「ウインドウあり／なし」に合わせる
  window._mtReplayNoWin = false;
  const _hasWin = !_noWin && (isPreemptive || forceWindow || !isPlainEnemyAttack(actionName, selectedAction));
  // マルチ：敵の行動を相手の画面へ（スキルウインドウ・弾・着弾を、相手の画面でも同時に再生する）
  if (window.MultiShare) MultiShare.fx('ea', { i: eIdx, n: String(actionName || ''), w: (isPreemptive || forceWindow || !isPlainEnemyAttack(actionName, selectedAction)) ? 1 : 0, h: hitCount, r: hasRatio ? 1 : 0, p: isPreemptive ? 1 : 0 });

  // 通常攻撃以外（と先制）：パズドラ風の青いスキルウインドウを出し、効果音が終わるまで敵の行動を止める（モンスターは点滅）
  // 先制は専用の表示を持たず、敵がスキルを使うときと同じ青ウインドウ＋同じ効果演出に統一
  if (_hasWin) {
    if (window.EnemyCutIn && window.EnemyCutIn.isCutin(actionName, selectedAction)) {
      // ⚠️付きの必殺技：青いスキルウインドウの代わりに、属性色のカットイン（js/cutin.js・効果音 cutin.mp3）
      await window.EnemyCutIn.show(enemy, actionName);
    } else {
      await showEnemySkillWindow(enemy, (actionName && String(actionName).trim()) || (forceWindow ? '攻撃' : '先制攻撃'));
    }
    await sleep(120);
  }
  await playEnemySelfSkillFx(enemy, selectedAction, actionName);   // 自己強化・回復の演出（1つずつ順番に）

  // 割合ダメージ：そのモンスターの属性色のオーラ（覇気）をまとって、1回だけ放つ
  if (hasRatio) {
    await playEnemyAuraStrike(enemy, eIdx, selectedAction, isPreemptive);
    await sleep(300);
    return;
  }

  if (enemyUnit) {
    const imgWrap = enemyUnit.querySelector('.enemy-img-wrap');
    if (imgWrap) {
      const r = imgWrap.getBoundingClientRect();
      spawnCastRing(r.left + r.width/2, r.top + r.height/2, enemy.attr, 1);
      // 火・水・木：攻撃前の「ため」（js/enemy-attack-fx.js）。待ち時間は増やさない（下の230msの中に収まる）
      if (window.EnemyAttackFx && window.EnemyAttackFx.has(enemy.attr)) window.EnemyAttackFx.charge(enemy.attr, r.left + r.width/2, r.top + r.height/2, Math.min(r.width, r.height) / 2);
      imgWrap.animate([
        { transform:'scale(1) translateX(0)' }, { transform:'scale(1.16) translateX(-8px)' },
        { transform:'scale(1.23) translateX(10px)' }, { transform:'scale(1) translateX(0)' }
      ], { duration:300, easing:'cubic-bezier(.2,.75,.2,1)' });
      await sleep(230);
    }
  }

  if (hitCount <= 5) {
    // 少ない連続攻撃：1発ずつ順番に飛ばす（待ち時間は一定。以前は 120ms×回数 で増えていくバグがあった）
    for (let hit = 0; hit < hitCount; hit++) {
      if (hit > 0) await sleep(100);
      await showEnemyProjectile(enemy, eIdx, hit, hitCount, selectedAction);
    }
  } else {
    // 多段攻撃（例：れんぞくぎり41回）：全体が約2.5秒に収まるよう、弾を間隔をあけて連射する
    const gap = Math.min(100, 2400 / hitCount);
    const shots = [];
    for (let hit = 0; hit < hitCount; hit++) {
      shots.push(showEnemyProjectile(enemy, eIdx, hit, hitCount, selectedAction));
      await sleep(gap);
    }
    await Promise.all(shots);
  }

  await sleep(300);
}

async function showEnemyProjectile(enemy, eIdx, hitIdx, totalHits, selectedAction, isPreemptive = false) {
  return new Promise(resolve => {
    const units = document.querySelectorAll('#enemy-area .enemy-unit');
    const enemyUnit = eIdx >= 0 && eIdx < units.length ? units[eIdx] : null;
    const barsWrap = document.getElementById('bars-wrap');
    if (!enemyUnit || !barsWrap) { resolve(); return; }

    const enemyRect = enemyUnit.getBoundingClientRect();
    const targetRect = barsWrap.getBoundingClientRect();
    const startX = enemyRect.left + enemyRect.width / 2;
    const startY = enemyRect.top + enemyRect.height / 2;
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;

    // 火＝炎の攻撃 / 水＝水の攻撃 / 木＝風の攻撃（js/enemy-attack-fx.js）。
    // 弾が飛ぶ時間（通常280ms／先制360ms）と、当たって次へ進むタイミングは従来の玉と同じ。
    // 当たったあとの水滴・煙・葉は放ったままにして待たない。読み込めない／失敗したときは、下の従来の玉を出す。
    if (window.EnemyAttackFx && window.EnemyAttackFx.has(enemy.attr)) {
      const fxMs = isPreemptive ? 360 : 280;
      if (window.EnemyAttackFx.shoot({ attr: enemy.attr, x0: startX, y0: startY, x1: endX, y1: endY, ms: fxMs, hits: totalHits, hitIdx, big: isPreemptive })) {
        setTimeout(() => {
          showEnemyHitEffect(endX, endY, enemy, hitIdx, totalHits, selectedAction, isPreemptive, false, true);
          resolve();
        }, fxMs);
        return;
      }
    }

    const attrColors = { fire:'#ff5500', water:'#33aaff', wood:'#44dd44', light:'#ffdd44', dark:'#aa55dd' };
    const color = attrColors[enemy.attr] || '#ff4040';

    const proj = document.createElement('div');
    const projSize = isPreemptive ? 38 : 27;
    proj.style.cssText = `position:fixed;left:${startX}px;top:${startY}px;width:${projSize}px;height:${projSize}px;border-radius:50%;background:radial-gradient(circle at 32% 28%,#fff 0%,${color} 30%,rgba(8,8,18,.2) 75%);box-shadow:0 0 16px #fff,0 0 34px ${color},0 0 70px ${color};z-index:150;pointer-events:none;transform:translate(-50%,-50%) scale(.35);`;
    const core = document.createElement('i');
    core.style.cssText = `position:absolute;inset:-70%;border:2px solid ${color};border-radius:50%;opacity:.7;animation:fxSpin .35s linear infinite;`;
    proj.appendChild(core);
    document.body.appendChild(proj);

    const duration = isPreemptive ? 360 : 280;
    const midX = (startX * 0.4 + endX * 0.6);
    const midY = Math.min(startY, endY) - 30;
    let startTime = null;

    function step(now) {
      if (!startTime) startTime = now;
      const t = Math.min((now - startTime) / duration, 1);
      const mt = 1 - t;
      const cx = mt*mt*startX + 2*mt*t*midX + t*t*endX;
      const cy = mt*mt*startY + 2*mt*t*midY + t*t*endY;
      const sc = 0.5 + t * 0.8;
      proj.style.left = cx + 'px';
      proj.style.top = cy + 'px';
      proj.style.transform = `translate(-50%,-50%) scale(${sc})`;
      if (Math.random() > .42) {
        const trail = document.createElement('i');
        trail.style.cssText = `position:absolute;left:50%;top:50%;width:6px;height:6px;border-radius:50%;background:${color};box-shadow:0 0 9px ${color};transform:translate(-50%,-50%);`;
        proj.appendChild(trail);
        trail.animate([{transform:'translate(-50%,-50%) scale(1)',opacity:.9},{transform:'translate(-50%,-50%) scale(3.2)',opacity:0}],{duration:200,fill:'forwards'});
        setTimeout(()=>trail.remove(),230);
      }
      if (t < 1) requestAnimationFrame(step);
      else {
        proj.remove();
        showEnemyHitEffect(endX, endY, enemy, hitIdx, totalHits, selectedAction, isPreemptive);
        resolve();
      }
    }
    requestAnimationFrame(step);
    setTimeout(() => { if (proj.parentNode) { proj.remove(); resolve(); } }, duration + 200);
  });
}

// auraFx = true：割合ダメージの「覇気の一撃」。フラッシュは敵の属性色、揺れ・火花・数字を大きくする
// fxHandled = true：火・水・木の専用演出（js/enemy-attack-fx.js）が着弾の爆炎・しぶき・風を描いているので、従来の丸い粒は出さない（フラッシュだけ属性色に）
function showEnemyHitEffect(x, y, enemy, hitIdx, totalHits, selectedAction, isPreemptive = false, auraFx = false, fxHandled = false) {
  const th = auraTheme(enemy.attr);
  const hitTint = (fxHandled && window.EnemyAttackFx && window.EnemyAttackFx.tint(enemy.attr)) || 'rgba(200,0,0,0.22)';
  const flash = document.createElement('div');
  flash.style.cssText = auraFx
    ? `position:fixed;inset:0;background:radial-gradient(circle at ${x}px ${y}px,${auraRgba(th.core, .9)} 0%,${auraRgba(th.glow, .6)} 22%,${auraRgba(th.main, .38)} 55%,${auraRgba(th.dark, .3)} 100%);z-index:140;pointer-events:none;animation:enemyHitFlash 0.55s ease-out forwards;`
    : `position:fixed;inset:0;background:${hitTint};z-index:140;pointer-events:none;animation:enemyHitFlash 0.25s ease-out forwards;`;
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), auraFx ? 650 : 350);
  if (!fxHandled) spawnEnergyBurst(x, y, enemy.attr, auraFx ? 2.2 : (isPreemptive ? 1.5 : 1));
  battleShake(auraFx ? 18 : (isPreemptive ? 13 : 7));
  if (auraFx) setTimeout(() => battleShake(11), 130);
  const bars = document.getElementById('bars-wrap');
  if (bars && bars.animate) bars.animate([{filter:'brightness(1)'},{filter:'brightness(2.3) saturate(1.8)'},{filter:'brightness(1)'}],{duration:260,easing:'ease-out'});
  if (window._mtReplayN > 0) { playSE('damage'); return; }   // マルチ：相手の画面での再生。被ダメ数字とHPは、相手から届く値（eh / hp）で出す

  // 表示用の軽減後ダメージを計算（実際のHP減算は applyPlayerDamage 側で実施）
  const rawPerHit = getRawPerHitDmg(enemy, selectedAction);
  let reduction = 1.0;
  if (buffDamageReduction && buffDamageReductionValue > 0) reduction *= (1.0 - buffDamageReductionValue);
  const lsEffects = [];
  [0, 5].forEach(idx => {
    if (partyUids.length > idx && partyUids[idx] !== null) {
      const e = box.find(b => b.uid === partyUids[idx]);
      if (e) { const m = MONSTER_DATA[e.monsterId]; if (m && m.leaderSkill && m.leaderSkill.effects) lsEffects.push(...m.leaderSkill.effects); }
    }
  });
  if (lsEffects.length > 0) {
    const lsRes = applyLeaderEffects(lsEffects, defenseCtx(enemy));
    if (lsRes.dmgReduction && lsRes.dmgReduction.length > 0) {
      for (const r of lsRes.dmgReduction) reduction *= (1.0 - r);
    }
  }
  // 割合ダメージを含む行動は軽減を受けない（合計が割合分ぴったりになるので、表示もそのまま）
  const _sks = (selectedAction && selectedAction.skills) || [];
  if (_sks.some(sk => sk.type === 'damage_ratio')) reduction = 1.0;
  const finalHitDmg = Math.floor(rawPerHit * reduction);
  // 実際にダメージを与える行動のときだけ鳴らす（軽減中は sdamage）
  const dealsDamage = !selectedAction || !selectedAction.skills ||
    selectedAction.skills.some(sk => sk.type === 'damage' || sk.type === 'damage_mult' || sk.type === 'damage_ratio');
  if (dealsDamage) playSE(reduction < 1 ? 'sdamage' : 'damage');

  const pop = document.createElement('div');
  const offsetY = -40 - (hitIdx % 6) * 28;   // 多段でも数字が画面外へ積み上がらないように
  const offsetX = (hitIdx % 2 === 0 ? -20 : 20);
  pop.style.cssText = auraFx
    ? `position:fixed;left:${x}px;top:${y - 36}px;transform:translate(-50%,-50%);font-size:1.7rem;font-weight:900;color:#fff;text-shadow:0 0 6px ${th.main},0 0 14px ${th.main},0 0 26px ${th.glow},0 2px 0 rgba(0,0,0,0.85);pointer-events:none;z-index:240;white-space:nowrap;animation:enemyDmgPop 1.3s ease-out forwards;`
    : `position:fixed;left:${x + offsetX}px;top:${y + offsetY}px;transform:translate(-50%,-50%);font-size:1.05rem;font-weight:900;color:#ff4444;text-shadow:0 0 8px rgba(0,0,0,0.9),0 1px 0 rgba(0,0,0,0.8);pointer-events:none;z-index:200;white-space:nowrap;animation:enemyDmgPop 1.0s ease-out forwards;`;
  pop.textContent = `-${finalHitDmg.toLocaleString()}`;   // ダメージは常に「-」表記
  if (dealsDamage && window.MultiShare) MultiShare.fx('eh', { d: finalHitDmg, hi: hitIdx, au: auraFx ? 1 : 0 });   // マルチ：被ダメ数字を相手の画面へ
  document.body.appendChild(pop);
  setTimeout(() => pop.remove(), auraFx ? 1400 : 1100);
}

// ============================================================
// ★ 割合ダメージ：属性オーラ（覇気）の一撃 ★
//   割合ダメージの技は、その敵の属性の色のオーラをまとい → オーラの波が敵から広がってプレイヤーを襲い → 1回だけ当たる。
//   玉や弾は飛ばさない。全体の長さは通常攻撃（弾が飛ぶ攻撃）と同じくらい。
//   火＝赤い炎の覇気 / 水＝青 / 木＝緑 / 光＝金 / 闇＝紫。ダメージは割合分ぴったりを1回で表示。
//   ■ 調整したいとき：AURA_CHARGE_MS（まとう時間）／ AURA_FLY_MS（放って届くまで）
// ============================================================
const AURA_CHARGE_MS = 220;   // 覇気をまとう時間（通常攻撃の「ため」とほぼ同じ）
const AURA_FLY_MS = 240;      // 覇気の波が敵からプレイヤーに届くまで（通常攻撃の弾が飛ぶ時間とほぼ同じ）
// main＝濃い色 / glow＝光る色 / core＝いちばん明るい芯 / dark＝縁の暗い色
const ENEMY_AURA_THEMES = {
  fire:  { main:'#ff3d14', glow:'#ff9a3c', core:'#ffeccb', dark:'#7a0c00' },
  water: { main:'#2a8cff', glow:'#6fd4ff', core:'#e6f8ff', dark:'#06307a' },
  wood:  { main:'#2fbf4a', glow:'#8cff7a', core:'#efffdc', dark:'#0a4a1a' },
  light: { main:'#ffc414', glow:'#fff27a', core:'#fffde8', dark:'#8a5a00' },
  dark:  { main:'#9b3cff', glow:'#d08cff', core:'#f8eaff', dark:'#2a0a4d' },
  none:  { main:'#ff3040', glow:'#ff8a90', core:'#fff0f0', dark:'#5a0010' }
};
function auraTheme(attr) { return ENEMY_AURA_THEMES[attr] || ENEMY_AURA_THEMES.none; }
function auraRgba(hex, a) {
  const n = parseInt(String(hex).slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

async function playEnemyAuraStrike(enemy, eIdx, selectedAction, isPreemptive = false) {
  const units = document.querySelectorAll('#enemy-area .enemy-unit');
  const enemyUnit = eIdx >= 0 && eIdx < units.length ? units[eIdx] : null;
  const imgWrap = enemyUnit ? enemyUnit.querySelector('.enemy-img-wrap') : null;
  const barsWrap = document.getElementById('bars-wrap');
  if (!enemyUnit || !imgWrap || !barsWrap || !imgWrap.animate) {
    // 演出が出せないときの保険：弾を1発だけ（ダメージ表示も1回）
    await showEnemyProjectile(enemy, eIdx, 0, 1, selectedAction, isPreemptive);
    return;
  }

  const th = auraTheme(enemy.attr);
  const r = imgWrap.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const R = Math.max(90, Math.min(Math.max(r.width, r.height), 340));   // 敵の大きさ（大きすぎる敵でも演出が画面を埋めないように）
  const tr = barsWrap.getBoundingClientRect();
  const endX = tr.left + tr.width / 2, endY = tr.top + tr.height / 2;
  const gEl = document.getElementById('game');
  const gr = gEl ? gEl.getBoundingClientRect() : { left: 0, width: window.innerWidth };
  const boost = isPreemptive ? 1.2 : 1;

  // 画面のまわりを少し暗くして、オーラを際立たせる
  const dim = document.createElement('div');
  dim.style.cssText = `position:fixed;inset:0;z-index:120;pointer-events:none;background:radial-gradient(circle at ${cx}px ${cy}px,rgba(0,0,0,0) ${Math.round(R * .8)}px,rgba(0,0,0,.36) ${Math.round(R * 2.8)}px);`;
  document.body.appendChild(dim);
  // 敵のまわりのオーラ層（中心が敵の中心）
  const layer = document.createElement('div');
  layer.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;width:0;height:0;z-index:230;pointer-events:none;`;
  document.body.appendChild(layer);
  // 放った覇気の波の層（画面全体の座標で動く）
  const flyLayer = document.createElement('div');
  flyLayer.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:231;pointer-events:none;';
  document.body.appendChild(flyLayer);

  let crackleTimer = null;
  const cleanup = () => {
    if (crackleTimer) { clearInterval(crackleTimer); crackleTimer = null; }
    dim.remove(); layer.remove(); flyLayer.remove();
  };

  try {
    dim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: AURA_CHARGE_MS, easing: 'ease-out', fill: 'forwards' });

    // ── ① 覇気をまとう（ぶわっと立ちのぼる）──
    const bd = R * 1.9;
    const body = document.createElement('div');
    body.style.cssText = `position:absolute;left:${-bd / 2}px;top:${-bd / 2}px;width:${bd}px;height:${bd}px;border-radius:50%;background:radial-gradient(circle,${auraRgba(th.core, 0)} 16%,${auraRgba(th.glow, .55)} 38%,${auraRgba(th.main, .7)} 56%,${auraRgba(th.main, 0)} 74%);mix-blend-mode:screen;filter:blur(3px);`;
    layer.appendChild(body);
    body.animate([
      { opacity: 0, transform: 'scale(.4)' },
      { opacity: 1, transform: 'scale(1)', offset: .55 },
      { opacity: 1, transform: 'scale(1.25)' }
    ], { duration: AURA_CHARGE_MS, easing: 'ease-out', fill: 'forwards' });
    const hot = document.createElement('div');
    const hd = R * 1.05;
    hot.style.cssText = `position:absolute;left:${-hd / 2}px;top:${-hd / 2}px;width:${hd}px;height:${hd}px;border-radius:50%;background:radial-gradient(circle,${auraRgba(th.core, .85)} 0%,${auraRgba(th.glow, .55)} 45%,${auraRgba(th.glow, 0)} 72%);mix-blend-mode:screen;`;
    layer.appendChild(hot);
    hot.animate([{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1.3)' }], { duration: AURA_CHARGE_MS, easing: 'ease-in', fill: 'forwards' });

    // 立ちのぼる覇気の炎
    const wispN = Math.round(24 * boost);
    for (let i = 0; i < wispN; i++) {
      const w = document.createElement('i');
      const ww = (7 + Math.random() * 14) * (R / 160 + .4);
      const hh = (45 + Math.random() * 80) * (R / 160 + .4);
      const px = (Math.random() - .5) * R * 1.05;
      const py = R * (.05 + Math.random() * .4);
      w.style.cssText = `position:absolute;left:${px - ww / 2}px;top:${py - hh / 2}px;width:${ww}px;height:${hh}px;border-radius:50% 50% 45% 45% / 62% 62% 38% 38%;background:linear-gradient(to top,${auraRgba(th.main, 0)} 0%,${auraRgba(th.main, .95)} 28%,${auraRgba(th.glow, .95)} 62%,${auraRgba(th.core, .6)} 86%,${auraRgba(th.core, 0)} 100%);mix-blend-mode:screen;filter:blur(1.2px);`;
      layer.appendChild(w);
      const rise = -R * (.5 + Math.random() * .7);
      const sway = (Math.random() - .5) * R * .25;
      w.animate([
        { transform: 'translate(0,0) scaleY(.5)', opacity: 0 },
        { transform: `translate(${sway * .4}px,${rise * .4}px) scaleY(1)`, opacity: 1, offset: .3 },
        { transform: `translate(${sway}px,${rise}px) scaleY(1.4)`, opacity: 0 }
      ], { duration: 240 + Math.random() * 150, delay: Math.random() * 90, easing: 'ease-out', fill: 'both' });
    }

    // バチバチ走る覇気の稲妻
    const sd = R * 2.4;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', sd); svg.setAttribute('height', sd);
    svg.setAttribute('viewBox', `${-sd / 2} ${-sd / 2} ${sd} ${sd}`);
    svg.style.cssText = `position:absolute;left:${-sd / 2}px;top:${-sd / 2}px;overflow:visible;mix-blend-mode:screen;filter:drop-shadow(0 0 4px ${th.main}) drop-shadow(0 0 11px ${th.glow});`;
    layer.appendChild(svg);
    const crackle = () => {
      let html = '';
      for (let i = 0; i < 7; i++) {
        let ang = Math.random() * Math.PI * 2;
        let rad = R * (.16 + Math.random() * .14);
        const pts = [`${(Math.cos(ang) * rad).toFixed(1)},${(Math.sin(ang) * rad).toFixed(1)}`];
        const segs = 4 + Math.floor(Math.random() * 4);
        for (let s = 0; s < segs; s++) {
          rad += R * (.09 + Math.random() * .1);
          ang += (Math.random() - .5) * .6;
          pts.push(`${(Math.cos(ang) * rad).toFixed(1)},${(Math.sin(ang) * rad).toFixed(1)}`);
        }
        html += `<polyline points="${pts.join(' ')}" fill="none" stroke="${th.core}" stroke-width="${(1.4 + Math.random() * 2.2).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" opacity="${(.55 + Math.random() * .45).toFixed(2)}"/>`;
      }
      svg.innerHTML = html;
    };
    crackle();
    crackleTimer = setInterval(crackle, 55);

    spawnCastRing(cx, cy, enemy.attr, R / 38 * .9);   // 広がる衝撃の輪

    // 敵本体：属性色に光りながら、ぶるっと震える
    imgWrap.animate([
      { transform: 'scale(1) translateX(0)', filter: 'brightness(1)' },
      { transform: 'scale(1.05) translateX(-5px)', filter: `brightness(1.4) drop-shadow(0 0 12px ${th.glow})`, offset: .3 },
      { transform: 'scale(1.08) translateX(5px)', filter: `brightness(1.6) drop-shadow(0 0 18px ${th.glow})`, offset: .6 },
      { transform: 'scale(1.14) translateX(0)', filter: `brightness(1.85) drop-shadow(0 0 26px ${th.core})` }
    ], { duration: AURA_CHARGE_MS, easing: 'ease-in-out' });

    await sleep(AURA_CHARGE_MS);

    // ── ② 覇気を放つ：オーラそのものが、敵から扇状に広がってプレイヤーへ襲いかかる（玉は飛ばさない）──
    const attrSe = ATTR_HIT_SE[enemy.attr];
    if (attrSe) playSE(attrSe);
    layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out', fill: 'forwards' });
    imgWrap.animate([
      { transform: 'scale(1.14) translateX(0)', filter: `brightness(1.85) drop-shadow(0 0 26px ${th.core})` },
      { transform: 'scale(.95) translateX(0)', filter: 'brightness(1.2)', offset: .4 },
      { transform: 'scale(1) translateX(0)', filter: 'brightness(1)' }
    ], { duration: 240, easing: 'ease-out' });

    // 覇気の波：敵の足もとから画面いっぱいに広がる、ギザギザの炎の縁をもつ扇形のオーラ
    const bw = gr.width, bh = Math.max(120, (endY - cy) + 80);
    const ox = cx - gr.left, half = R * .34;
    const edge = [[ox - half, 0], [ox + half, 0], [bw + 12, bh * .6]];
    const n = 16;
    for (let i = 0; i <= n; i++) {   // 先端（プレイヤー側）のギザギザ
      const x = bw + 12 - (bw + 24) * i / n;
      edge.push([x, i % 2 ? bh - bh * (.07 + Math.random() * .1) : bh]);
    }
    edge.push([-12, bh * .6]);
    const wave = document.createElement('div');
    wave.style.cssText = `position:absolute;left:${gr.left}px;top:${cy}px;width:${bw}px;height:${bh}px;transform-origin:${ox}px 0;clip-path:polygon(${edge.map(p => `${p[0].toFixed(1)}px ${p[1].toFixed(1)}px`).join(',')});background:linear-gradient(to bottom,${auraRgba(th.main, 0)} 0%,${auraRgba(th.main, .6)} 24%,${auraRgba(th.glow, .88)} 68%,${auraRgba(th.core, .98)} 100%);mix-blend-mode:screen;filter:blur(2px);`;
    flyLayer.appendChild(wave);
    const waveMs = AURA_FLY_MS + 130, reach = AURA_FLY_MS / waveMs;   // reach＝先端がHPバーに届く位置（0〜1）
    wave.animate([
      { transform: 'scaleY(.04)', opacity: 0, easing: 'ease-in' },
      { transform: 'scaleY(.35)', opacity: 1, offset: reach * .5 },
      { transform: 'scaleY(1)', opacity: 1, offset: reach },
      { transform: 'scaleY(1.05)', opacity: 0 }
    ], { duration: waveMs, easing: 'linear', fill: 'both' });

    // 波に乗って、敵からプレイヤーへ向かって流れる覇気の筋（炎のすじ）
    const streakN = Math.round(22 * boost);
    for (let i = 0; i < streakN; i++) {
      const sx = cx + (Math.random() - .5) * R * .5, sy = cy + (Math.random() - .3) * R * .3;
      const tx = gr.left + bw * (.04 + Math.random() * .92), ty = endY + (Math.random() - .5) * 50;
      const dx = tx - sx, dy = ty - sy, ang = Math.atan2(-dx, dy);
      const sw = (9 + Math.random() * 16) * boost, sh = 70 + Math.random() * 90;
      const s = document.createElement('i');
      s.style.cssText = `position:absolute;left:${sx}px;top:${sy}px;width:${sw}px;height:${sh}px;border-radius:50%;background:linear-gradient(to bottom,${auraRgba(th.main, 0)},${auraRgba(th.main, .9)} 25%,${auraRgba(th.glow, .98)} 70%,${auraRgba(th.core, .95)});mix-blend-mode:screen;filter:blur(1.5px);`;
      flyLayer.appendChild(s);
      s.animate([
        { transform: `translate(0px,0px) translate(-50%,-50%) rotate(${ang}rad)`, opacity: 0 },
        { opacity: 1, offset: .25 },
        { transform: `translate(${dx}px,${dy}px) translate(-50%,-50%) rotate(${ang}rad)`, opacity: .9, offset: .9 },
        { transform: `translate(${dx}px,${dy}px) translate(-50%,-50%) rotate(${ang}rad)`, opacity: 0 }
      ], { duration: AURA_FLY_MS + 90, delay: Math.random() * 60, easing: 'ease-in', fill: 'both' });
    }

    // ── ③ 先端がHPバーに届いた瞬間：属性色のフラッシュとオーラの柱（1回だけ）──
    await sleep(Math.round(AURA_FLY_MS * .82));
    showEnemyHitEffect(endX, endY, enemy, 0, 1, selectedAction, isPreemptive, true);
    spawnAuraImpact(endX, endY, th, tr, enemy.attr);
    dim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-out', fill: 'forwards' });
    await sleep(Math.round(AURA_FLY_MS * .18) + 90);
  } finally {
    cleanup();
  }
}

// 覇気が当たった場所：オーラの柱が立ちのぼり、光の輪が広がる
function spawnAuraImpact(x, y, th, barsRect, attr) {
  const L = document.createElement('div');
  L.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:0;height:0;z-index:225;pointer-events:none;`;
  document.body.appendChild(L);
  // 光の円盤
  for (let i = 0; i < 2; i++) {
    const d = Math.max(barsRect.width * .9, 220);
    const disc = document.createElement('div');
    disc.style.cssText = `position:absolute;left:${-d / 2}px;top:${-d / 2}px;width:${d}px;height:${d}px;border-radius:50%;background:radial-gradient(circle,${auraRgba(th.core, .95)} 0%,${auraRgba(th.glow, .7)} 30%,${auraRgba(th.main, .45)} 55%,${auraRgba(th.main, 0)} 72%);mix-blend-mode:screen;`;
    L.appendChild(disc);
    disc.animate([{ transform: 'scale(.2)', opacity: 1 }, { transform: 'scale(1.5)', opacity: .8, offset: .45 }, { transform: 'scale(2.3)', opacity: 0 }], { duration: 560, delay: i * 110, easing: 'ease-out', fill: 'both' });
  }
  // オーラの柱（HPバーの足もとから立ちのぼる）
  const pw = Math.max(barsRect.width * .55, 120), ph = Math.min(Math.max(window.innerHeight * .42, 220), 420);
  const pillar = document.createElement('div');
  pillar.style.cssText = `position:absolute;left:${-pw / 2}px;top:${-ph + 28}px;width:${pw}px;height:${ph}px;transform-origin:50% 100%;background:linear-gradient(to top,${auraRgba(th.main, .9)} 0%,${auraRgba(th.glow, .8)} 38%,${auraRgba(th.glow, .38)} 72%,${auraRgba(th.main, 0)} 100%);clip-path:polygon(0 100%,12% 60%,6% 30%,28% 8%,38% 38%,50% 0,62% 38%,72% 8%,94% 30%,88% 60%,100% 100%);mix-blend-mode:screen;filter:blur(2px);`;
  L.appendChild(pillar);
  pillar.animate([{ transform: 'scaleY(.05)', opacity: 0 }, { transform: 'scaleY(1)', opacity: 1, offset: .3 }, { transform: 'scaleY(1.15)', opacity: .9, offset: .65 }, { transform: 'scaleY(1.3)', opacity: 0 }], { duration: 640, easing: 'ease-out', fill: 'both' });
  // 衝撃の輪
  spawnCastRing(x, y, attr, 2.4);
  setTimeout(() => spawnCastRing(x, y, attr, 3.4), 120);
  // 舞い上がる覇気の粒
  for (let i = 0; i < 26; i++) {
    const p = document.createElement('i');
    const s = 4 + Math.random() * 8;
    const px = (Math.random() - .5) * pw * .9;
    p.style.cssText = `position:absolute;left:${px}px;top:10px;width:${s}px;height:${s * 1.7}px;border-radius:50%;background:${i % 2 ? th.glow : th.core};box-shadow:0 0 9px ${th.main};`;
    L.appendChild(p);
    p.animate([{ transform: 'translateY(0)', opacity: 0 }, { opacity: 1, offset: .2 }, { transform: `translateY(${-ph * (.35 + Math.random() * .6)}px)`, opacity: 0 }], { duration: 520 + Math.random() * 380, delay: Math.random() * 160, easing: 'ease-out', fill: 'both' });
  }
  setTimeout(() => L.remove(), 1200);
}

// 行動遅延の解除：次に行動した時にアイコンを消し、遅れた分の行動間隔も元に戻す
function clearEnemyDelay(enemy) {
  if (!enemy._delayed) return;
  enemy._delayed = false;
  if (enemy._baseTurnInterval) enemy.turnInterval = enemy._baseTurnInterval;
  updateEnemyUI();
}

// カウントが0になった敵がいる時、「あと0」を見せてから攻撃に入るまでの間（ミリ秒）
const ENEMY_ZERO_PAUSE_MS = 520;

// 敵のターン処理（パズドラZと同じ流れ）
//   ① 全員のカウントを1つ進める。0になった敵は「あと0」で止まる（複数いれば全員が0になる）
//   ② 0になった敵が左から順に攻撃する。自分の番が来るまでは「0のまま攻撃待機」、攻撃が終わったらカウントが元に戻る
async function processEnemyTurns() {
  // ① カウントを進める
  for (const enemy of enemyList) {
    enemy._acting = false;
    if (enemy.hp <= 0) { enemy._due = false; continue; }
    enemy.turnProgress++;
    enemy._due = enemy.turnProgress >= enemy.turnInterval;
  }
  updateEnemyTurnBadge();
  if (enemyList.some(e => e.hp > 0 && e._due)) await sleep(ENEMY_ZERO_PAUSE_MS);   // 「あと0」を見せる

  // ② 順番に行動
  for (const enemy of enemyList) {
    if (enemy.hp <= 0) continue;
    let gameOver = false;
    try {
      gameOver = await runOneEnemyTurn(enemy);
    } finally {
      enemy._acting = false;
      enemy._due = false;
      updateEnemyTurnBadge();   // 攻撃が終わったら、カウントを元の数字に戻す
    }
    if (gameOver) return;
  }
}

// 1体分の行動。プレイヤーのHPが尽きたら true を返す
async function runOneEnemyTurn(enemy) {
  if (enemy._superGut && enemy._superGut.keepHp != null) {   // 発動済みの超根性は、割り込みのカットインより前に必ず消す
    if (!enemy._superGut._fxDone) { try { superGutBurst(enemy); } catch (e) {} }   // 演出が出ていなかったら、ここで出す
    delete enemy._superGut;
  }
  purgeSuperGutIcons();                                  // 発動済みの tc.png が画面に残っていたら外す
  { const w = _sgFxUntil - performance.now(); if (w > 0) await sleep(w); }   // 超根性の演出が終わってから、割り込みのカットインへ
  if (enemy._hpConditions) {
    const hpRatio = enemy.hp / enemy.maxHp;
    for (const cond of enemy._hpConditions) {
      const key = cond.name;
      if (hpRatio <= cond.threshold && (!cond.once || !enemy._hpCondUsed[key])) {
        if (cond.once) enemy._hpCondUsed[key] = true;
        enemy._acting = true; updateEnemyTurnBadge();
        await showEnemyAttackEffect(enemy, cond.name, cond, false, true);   // HP条件の割り込み行動は、ダメージ技だけでも必ずスキルウインドウを出す
        cond.fn(enemy);
        updatePlayerHP();
        updateEnemyUI();
        if (playerCurrentHP <= 0) { triggerGameOver(); return true; }
        enemy.turnProgress = 0;
        enemy._due = false;
        clearEnemyDelay(enemy);
        break;
      }
    }
    if (enemy.turnProgress === 0) return false;
  }

  if (enemy.turnProgress < enemy.turnInterval) return false;

  // ── 通常の行動（カウントが0になった敵） ──
  enemy._due = true;       // 攻撃が終わるまで「あと0」のまま
  enemy._acting = true;    // 自分の番：待機 → 攻撃中の表示に切り替える
  enemy.turnProgress = 0;
  clearEnemyDelay(enemy);  // 行動したので遅延アイコンを消す（行動間隔も元に戻す）
  updateEnemyTurnBadge();

  if (!enemy.healUsed && enemy.specialHeal && enemy.hp / enemy.maxHp <= 0.5) {
    enemy.healUsed = true;
    await showEnemyAttackEffect(enemy, 'キュアー', null);
    if (enemy.specialHeal.fn) enemy.specialHeal.fn(enemy);
    updateEnemyUI();
    return false;
  }

  const actions = enemy.actions || [{ name: '通常攻撃', weight: 100, fn: (e) => applyPlayerDamage(e.atk || 0, e) }];
  let selected = null;
  // ★ 盤面に〇ドロップがない場合、以下を順に使用（いまの盤面で判定。条件を満たすものがあれば通常の行動より優先） ★
  const noneList = (enemy._orbNoneActions || []).filter(a => !boardHasOrb(a.orb));
  if (noneList.length) {
    const n = enemy._orbNoneSeq || 0; enemy._orbNoneSeq = n + 1;
    selected = noneList[n % noneList.length];
  }
  if (!selected) {
    // HP条件（hpAbove / hpBelow）と「盤面に〇ドロップがある場合（needOrb）」で、いま選べる行動だけに絞る。
    // 全部外れたらHP条件だけ無視 → それでも無ければ盤面条件のない行動 → 最後は通常攻撃
    const hpPct = enemy.hp / Math.max(1, enemy.maxHp) * 100;
    const orbOk = a => a.needOrb == null || boardHasOrb(a.needOrb);
    const hpOk = a => (a.hpAbove == null || hpPct >= a.hpAbove) && (a.hpBelow == null || hpPct <= a.hpBelow);
    let usable = actions.filter(a => hpOk(a) && orbOk(a));
    if (usable.length === 0) usable = actions.filter(orbOk);
    if (usable.length === 0) usable = actions.filter(a => a.needOrb == null);
    if (usable.length === 0) usable = [{ name: '通常攻撃', weight: 100, fn: (e) => applyPlayerDamage(e.atk || 0, e) }];
    selected = usable[0];
    const mode = enemy.actionMode || 'random';
    if (mode === 'sequence' && usable.length > 1) {
      // 順番：上から順に 1→2→3→1→2→3…
      const n = enemy._actSeq || 0; enemy._actSeq = n + 1;
      selected = usable[n % usable.length];
    } else if (mode === 'alternate' && usable.length > 1) {
      // 交互：1番目の行動と、残りの行動を交互に（1→2→1→3→1→2…）
      const n = enemy._actSeq || 0; enemy._actSeq = n + 1;
      const rest = usable.slice(1);
      selected = (n % 2 === 0) ? usable[0] : rest[Math.floor(n / 2) % rest.length];
    } else if (usable.length > 1) {
      const totalWeight = usable.reduce((s, a) => s + (a.weight || 10), 0);
      let rnd = Math.random() * totalWeight;
      for (const action of usable) {
        rnd -= (action.weight || 10);
        if (rnd <= 0) { selected = action; break; }
      }
    }
  }

  await showEnemyAttackEffect(enemy, selected.name, selected);

  if (selected.fn) selected.fn(enemy);
  updatePlayerHP();
  updateEnemyUI();
  if (playerCurrentHP <= 0) { triggerGameOver(); return true; }
  return false;
}

// ── 敵の行動中は盤面・スキル・メニューなどの操作を受け付けない ──
let enemyActingCount = 0;
function isEnemyActing() { return enemyActingCount > 0; }
function setEnemyActing(on) {
  enemyActingCount = Math.max(0, enemyActingCount + (on ? 1 : -1));
  const g = document.getElementById('game');
  if (g) g.classList.toggle('enemy-acting', enemyActingCount > 0);
}

async function doEnemyAttack() {
  setEnemyActing(true);
  try { await processEnemyTurns(); }
  finally { setEnemyActing(false); }
}

// ============================================================
// ★ BOX & パーティ管理 ★
// ============================================================
// モンスター画像のパス（MONSTER_DATA の img があればそれを優先。進化後: sm1.png など）
function monsterImg(mon) {
  if (!mon) return '';
  return mon.img || `m${mon.id}.png`;
}

let box = [];
let nextUid = 1;

// ============================================================
// ★ セーブデータ（localStorage）★
//   BOX（モンスター）・所持チップ・メールの受け取り状況を保存する。
//   パーティー / 所持エナ / クリア状況は、それぞれ別キーで従来どおり保存。
//   データを消してやり直したいときは、ブラウザのサイトデータ（localStorage）を削除する。
// ============================================================
const SAVE_KEY = 'puzzdra_save_v1';
let _saved = null;
try { _saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { _saved = null; }
if (!_saved || !Array.isArray(_saved.box)) _saved = null;
// ログインボーナスを最後に受け取った時刻（ミリ秒）。0 = まだ一度も受け取っていない
let loginBonusAt = (_saved && Number.isFinite(Number(_saved.loginBonusAt))) ? Math.max(0, Number(_saved.loginBonusAt)) : 0;
// 8コンボボーナス（ログインボーナスと同じ周期）：period = そのときの loginBonusAt。reached = 8コンボ以上したか。claimed = もう受け取ったか
let combo8Bonus = (_saved && _saved.combo8Bonus && typeof _saved.combo8Bonus === 'object')
  ? { period: Number(_saved.combo8Bonus.period) || 0, reached: !!_saved.combo8Bonus.reached, claimed: !!_saved.combo8Bonus.claimed }
  : { period: 0, reached: false, claimed: false };

// ★ はじめて遊ぶとき（セーブがないとき）のBOX ★
//   ID1・4・7 のモンスターを1体ずつ。（以前あった「No.1〜151を3体ずつ」「ID4をLv75に」のデバッグ用の自動追加は削除しました）
//   セーブがある場合は、セーブの中身をそのまま使います。
const _seededIds = new Set(_saved && Array.isArray(_saved.seeded) ? _saved.seeded.map(Number) : []);
if (_saved) {
  const num = (v, d = 0) => { v = Number(v); return Number.isFinite(v) ? v : d; };
  for (const e of _saved.box) {
    if (!e || !MONSTER_DATA[e.monsterId]) continue;   // データから消えたモンスターは読み込まない
    box.push(Object.assign({}, e, {
      uid: num(e.uid), monsterId: num(e.monsterId), level: Math.max(1, num(e.level, 1)), exp: num(e.exp),
      sp: num(e.sp), memory: num(e.memory), plusHp: num(e.plusHp), plusAtk: num(e.plusAtk), plusRec: num(e.plusRec)
    }));
  }
  nextUid = Math.max(num(_saved.nextUid, 1), box.reduce((m, e) => Math.max(m, e.uid < 1e9 ? e.uid : 0), 0) + 1);
}
if (!_saved) {
  [1, 4, 7].forEach(mid => {
    if (!MONSTER_DATA[mid]) return;
    box.push({ uid: nextUid++, monsterId: mid, level: 1, exp: 0, sp: 0, memory: 0, plusHp: 0, plusAtk: 0, plusRec: 0 });
  });
}

// 保存（中身が変わったときだけ書き込む）。getItemCount 等より前に呼ばれても安全なよう、参照は実行時に行う
let _lastSaveJson = null;
function saveGame() {
  if (window.Zukan) { try { Zukan.syncOwned(); } catch (err) {} }   // 図鑑：BOXに入ったモンスターを「ゲット済み」に登録（js/zukan.js）
  try {
    const mail = {};
    if (typeof MAIL_DATA !== 'undefined') MAIL_DATA.forEach(m => { mail[m.id] = { received: !!m.received, unread: !!m.unread }; });
    const json = JSON.stringify({
      v: 1, box: box.map(b => (b && b._tfFrom !== undefined) ? { ...b, monsterId: b._tfFrom, _tfFrom: undefined } : b), nextUid, seeded: [..._seededIds],
      items: (typeof itemInventory !== 'undefined') ? itemInventory : {},
      loginBonusAt, combo8Bonus,
      mail
    });
    if (json === _lastSaveJson) return;
    localStorage.setItem(SAVE_KEY, json);
    _lastSaveJson = json;
  } catch (e) {}
}
// 保存し忘れ防止：定期保存＋画面を閉じる/切り替えるときに保存
setInterval(saveGame, 3000);
window.addEventListener('pagehide', saveGame);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveGame(); });

// ============================================================
// パーティー 1〜10（localStorage に保存）
//   teams[n] = そのパーティーの6枠（uid or null）
//   currentTeam / partyUids は「今選んでいるパーティー」の中身
// ============================================================
const TEAM_COUNT = 10;
const TEAMS_STORAGE_KEY = 'pdlike_teams_v1';
let teams = Array.from({ length: TEAM_COUNT }, () => [null, null, null, null, null, null]);
teams[0] = [1, 2, 3, null, null, null];   // はじめてのパーティー（BOXの1番目〜3番目 = ID1・4・7）
let currentTeamNo = 0;
try {
  const raw = localStorage.getItem(TEAMS_STORAGE_KEY);
  if (raw) {
    const d = JSON.parse(raw);
    if (d && Array.isArray(d.teams)) {
      for (let n = 0; n < TEAM_COUNT; n++) {
        const t = d.teams[n];
        if (!Array.isArray(t)) continue;
        teams[n] = Array.from({ length: 6 }, (_, i) => {
          const u = t[i];
          return (u !== null && u !== undefined && box.some(b => b.uid === u)) ? u : null;   // 存在しないuidは空き枠に
        });
      }
      const no = parseInt(d.current, 10);
      if (no >= 0 && no < TEAM_COUNT) currentTeamNo = no;
    }
  }
} catch (e) {}
let currentTeam = teams[currentTeamNo].slice();
let selectedSlotIndex = 0;
let partyUids = teams[currentTeamNo].slice();

// 今のパーティーを teams に反映して保存
function persistTeams() {
  teams[currentTeamNo] = currentTeam.slice();
  try { localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify({ current: currentTeamNo, teams })); } catch (e) {}
}
// 合成などで消えたモンスターを全パーティーから外す
function purgeUidsFromTeams(uids) {
  teams = teams.map(t => t.map(u => uids.includes(u) ? null : u));
  currentTeam = currentTeam.map(u => uids.includes(u) ? null : u);
  for (let i = 0; i < partyUids.length; i++) if (uids.includes(partyUids[i])) partyUids[i] = null;
  persistTeams();
}
function updateTeamNavLabels() {
  document.querySelectorAll('.team-nav .tn-no').forEach(el => { el.textContent = currentTeamNo + 1; });
}
// dir: 1=次(1→2) / -1=前(1→10)。画面が開いていればその場で描き直す
function switchTeam(dir) {
  persistTeams();
  currentTeamNo = ((currentTeamNo + dir) % TEAM_COUNT + TEAM_COUNT) % TEAM_COUNT;
  currentTeam = teams[currentTeamNo].slice();
  partyUids = teams[currentTeamNo].slice();
  selectedSlotIndex = 0;
  persistTeams();
  _hpCache.key = '';
  updateTeamNavLabels();
  const cls = dir > 0 ? 'team-slide-next' : 'team-slide-prev';
  const animate = (el) => { if (!el) return; el.classList.remove('team-slide-next', 'team-slide-prev'); void el.offsetWidth; el.classList.add(cls); };
  if (document.getElementById('team-edit').style.display === 'flex') {
    renderTeamEdit();
    animate(document.getElementById('te-party-scroll'));
  } else if (document.getElementById('dungeon-entry').style.display === 'flex') {
    renderDungeonEntry();
    animate(document.getElementById('de-monster-row-wrap'));
  }
  playTapSound();
}

// 左右スワイプ（少しの動きでは切り替えない: 横70px以上 かつ 縦の1.8倍以上横に動いたときだけ）
//   右へスライド → 次のパーティー(2) / 左へスライド → 前のパーティー(10)
const TEAM_SWIPE_MIN_PX = 70;
let _teamSwipedAt = -10000;
function attachTeamSwipe(el, ignoreStart) {
  let sx = 0, sy = 0, active = false;
  const down = (x, y, target) => { active = !(ignoreStart && ignoreStart(target)); sx = x; sy = y; };
  const up = (x, y) => {
    if (!active) return;
    active = false;
    const dx = x - sx, dy = y - sy;
    if (Math.abs(dx) < TEAM_SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.8) return;
    _teamSwipedAt = performance.now();
    switchTeam(dx > 0 ? 1 : -1);
  };
  let lastTouch = -10000;
  el.addEventListener('touchstart', e => { lastTouch = performance.now(); const t = e.touches[0]; down(t.clientX, t.clientY, e.target); }, { passive: true });
  el.addEventListener('touchend', e => { lastTouch = performance.now(); const t = e.changedTouches[0]; up(t.clientX, t.clientY); }, { passive: true });
  el.addEventListener('touchcancel', () => { active = false; }, { passive: true });
  el.addEventListener('mousedown', e => {
    if (e.button !== 0 || performance.now() - lastTouch < 800) return;
    down(e.clientX, e.clientY, e.target);
    const mu = ev => { window.removeEventListener('mouseup', mu); up(ev.clientX, ev.clientY); };
    window.addEventListener('mouseup', mu);
  });
  // スワイプ直後に飛んでくるクリックは無視（スワイプでタップ操作が誤爆しないように）
  el.addEventListener('click', e => { if (performance.now() - _teamSwipedAt < 400 && !(e.target.closest && e.target.closest('.tn-btn'))) { e.stopPropagation(); e.preventDefault(); } }, true);
}

// ============================================================
// バフ管理
// ============================================================
// ── プレイヤー側バフ（スキル効果ごとに個別管理）──
// ダメージ軽減: ○ターンの間、受けるダメージを value(0〜1) 軽減
let buffDamageReduction = false;
let buffDamageReductionValue = 0;
let buffDamageReductionTurns = 0;
// 回復力倍率: ○ターンの間、回復力が ○倍（0倍＝回復できない）
let buffRecMult = false;
let buffRecMultValue = 1;
let buffRecMultTurns = 0;
// 操作時間: ○ターンの間、操作時間を ○倍 にして ○秒 増減（短縮も可）
let buffMoveTime = false;
let buffMoveTimeMult = 1;
let buffMoveTimeSec = 0;
let buffMoveTimeTurns = 0;
// 全体攻撃: ○ターンの間、全員の通常攻撃が敵全体に当たる
let buffAllAttack = false;
let buffAllAttackTurns = 0;

function resetPlayerBuffs() {
  buffDamageReduction = false; buffDamageReductionValue = 0; buffDamageReductionTurns = 0;
  buffRecMult = false; buffRecMultValue = 1; buffRecMultTurns = 0;
  buffMoveTime = false; buffMoveTimeMult = 1; buffMoveTimeSec = 0; buffMoveTimeTurns = 0;
  buffAllAttack = false; buffAllAttackTurns = 0;
  atkBuffs = [];
  buffMoveTimeShort = false; buffMoveTimeShortTurns = 0;
  enemyAtkDowns = [];
  enemyRecDown = null; enemyMoveDown = null; enemySkillSeal = null; enemyNoFall = null;
  clearRoulettes();
}
// プレイヤーの1ターン（敵の攻撃まで）が終わるごとに残りターンを減らす
function tickPlayerBuffs() {
  if (buffDamageReduction && --buffDamageReductionTurns <= 0) { buffDamageReduction = false; buffDamageReductionTurns = 0; buffDamageReductionValue = 0; }
  if (buffRecMult && --buffRecMultTurns <= 0) { buffRecMult = false; buffRecMultTurns = 0; buffRecMultValue = 1; }
  if (buffMoveTime && --buffMoveTimeTurns <= 0) { buffMoveTime = false; buffMoveTimeTurns = 0; buffMoveTimeMult = 1; buffMoveTimeSec = 0; }
  if (buffAllAttack && --buffAllAttackTurns <= 0) { buffAllAttack = false; buffAllAttackTurns = 0; }
  atkBuffs.forEach(b => b.turns--);
  atkBuffs = atkBuffs.filter(b => b.turns > 0);
  buffMoveTimeShort = false; buffMoveTimeShortTurns = 0;   // 敵の操作時間ダウンは従来どおり1ターンで解除
  // 敵の防御ダウン：ターン終了ごとに残りターンを減らし、切れたら元の防御力に戻す
  for (const e of enemyList) if (e.defDown && --e.defDown.turns <= 0) delete e.defDown;
  if (typeof updateEnemyUI === 'function') updateEnemyUI();
  renderBuffIcons();
}
// 現在の操作時間(ms)。固定→バフ(倍率→秒数)→敵の短縮 の順に反映。最短1秒
function calcCurrentMoveMs() {
  // リーダースキルの「操作時間固定」は最優先。敵の短縮・味方のバフどちらも受けない
  if (moveTimeFixed) return moveTimeFixed;
  const bm = leaderBaseMoveMs();
  let ms = bm;
  if (buffMoveTime) ms = Math.max(1000, Math.floor(bm * buffMoveTimeMult + buffMoveTimeSec * 1000));
  if (buffMoveTimeShort) ms = Math.max(1000, ms - 1000);
  if (enemyMoveDown) ms = Math.max(1000, ms - Math.floor(enemyMoveDown.seconds * 1000));
  return ms;
}
// 個別設定の攻撃バフ: { attr:属性|null, monType:タイプ|null, value:倍率, turns:残りターン }
let atkBuffs = [];
function atkBuffLabel(b) {
  const names = { fire:'火', water:'水', wood:'木', light:'光', dark:'闇', heal:'回復', poison:'毒' };
  const who = b.monType ? `${b.monType}タイプ` : (b.attr ? `${names[b.attr] || b.attr}属性` : '全属性');
  return `${b.turns}ターン ${who}攻撃×${b.value}`;
}
// 敵の属性軽減：その属性の攻撃を受けた時のダメージ倍率（1.0 = 軽減なし）
function enemyAttrGuardMult(enemy, attr) {
  let m = 1;
  const g = enemy && enemy._attrGuards && enemy._attrGuards[attr];
  if (g && (g.turns > 0 || g.turns === -1)) m *= Math.max(0, 1 - g.rate);
  const r = enemy && enemy._dmgReduce;                    // ダメージ軽減（全属性）
  if (r && (r.turns > 0 || r.turns === -1)) m *= Math.max(0, 1 - r.rate);
  return m;
}
// ダメージ軽減の盾アイコン（数字＝軽減%）。本家風の銀の盾
function dmgReduceIconSVG(pct) {
  const txt = String(pct);
  const fs = txt.length >= 3 ? 15 : 20;
  return `<svg viewBox="0 0 40 40" width="40" height="40" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
    <defs><linearGradient id="dr-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f4f4"/><stop offset=".55" stop-color="#b4b4b4"/><stop offset="1" stop-color="#6c6c78"/></linearGradient></defs>
    <path d="M20 2 L36 7 L36 21 C36 30 29 36 20 39 C11 36 4 30 4 21 L4 7 Z" fill="url(#dr-g)" stroke="#1d1d3c" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M20 6 L32 9.6 L32 21 C32 28 26.5 33 20 35.4 C13.5 33 8 28 8 21 L8 9.6 Z" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.2"/>
    <text x="20" y="25.5" text-anchor="middle" font-family="'Arial Black','Impact','Hiragino Sans',sans-serif" font-weight="900" font-size="${fs}"
      fill="#fff" stroke="#14142e" stroke-width="3.2" stroke-linejoin="round" paint-order="stroke fill">${txt}</text>
  </svg>`;
}
// 敵の実効防御力（防御ダウンを反映）
function getEnemyDef(enemy) {
  let def = enemy.def || 0;
  if (enemy._statusShield > 0) return Math.max(0, def);   // 状態異常無効中は防御ダウンが効かない
  if (enemy.defDown && enemy.defDown.turns > 0) def = Math.floor(def * (1 - enemy.defDown.value));
  return Math.max(0, def);
}
// ★超根性★ 敵にダメージを与える共通処理（4か所の攻撃処理すべてがここを通る）
//   倒せるダメージ（HPが0以下）を受けても、最大HPの〇%で必ず止まる。発動後もそのターンの攻撃中は止まり続け、ターン終了で消滅。
//   例：最大HP10万・超根性50%に100万ダメージ → HPは5万で止まる（表示ダメージは5万）
//   ※ すでにHPが〇%以下のときは発動しない（そのまま倒れる／超根性は残る）
//   戻り値：実際に与えたダメージ
function enemyTakeDamage(enemy, dmg) {
  const before = enemy.hp;
  enemy.hp = Math.max(0, before - dmg);
  const sg = enemy._superGut;
  if (sg && before > 0) {
    if (sg.keepHp != null) {
      // すでに発動済み：そのターン中は、何度当たっても超根性のHPで止まる（ターン終了時に消滅）
      enemy.hp = Math.min(before, sg.keepHp);
    } else {
      // 倒せるダメージだけでなく、「HPが〇%を下回るダメージ」もここで止める（以前は倒せる時だけ止まり、〇%超→〇%未満(生き残る)→次の1発で倒れて貫通していた）
      const keep = Math.max(1, Math.ceil(enemy.maxHp * sg.rate / 100));
      if (before > keep && enemy.hp < keep) {
        enemy.hp = keep;
        sg.keepHp = keep;                              // 発動：このターンの攻撃が終わるまで保持
        try { playSE('bshield'); } catch (e) {}
        try { showSuperGutPopup(enemy); } catch (e) {}
        superGutBurst(enemy);                          // 黄色い波動を纏ってアイコンが消える
        purgeSuperGutIcons(enemy);                     // 念のため：本物のtc.pngを確実に外す（再描画待ちにしない）
      }
    }
  }
  return before - enemy.hp;
}
// 発動済み（keepHp あり）の超根性アイコン（tc.png）を、画面から確実に取り除く。enemy 省略で全員
//   ・DOMに残っているアイコンを直接外し、アイコン列のキャッシュも捨てて、次の updateEnemyUI で必ず描き直す
function purgeSuperGutIcons(enemy) {
  try {
    const units = document.querySelectorAll('#enemy-area .enemy-unit');
    enemyList.forEach((e, i) => {
      if (enemy && e !== enemy) return;
      if (e._superGut && e._superGut.keepHp == null) return;   // まだ発動していない超根性は残す
      const u = units[i]; if (!u) return;
      u.querySelectorAll('.enemy-status-icons .st-icon[title^="超根性"]').forEach(el => el.remove());
      const st = u.querySelector('.enemy-status-icons'); if (st) delete st.dataset.key;
    });
  } catch (err) {}
  updateEnemyUI();
}
let _sgFxUntil = 0;   // 超根性の発動演出が終わる時刻（これが過ぎるまで、敵の割り込み／カットインは始めない）
// 攻撃フェーズ（ターン）の終了時：発動済みの超根性を消す
function clearFiredSuperGut() {
  let ch = false;
  for (const e of enemyList) if (e._superGut && e._superGut.keepHp != null) { delete e._superGut; ch = true; }
  if (ch) purgeSuperGutIcons();
}
const RARE_DROP_WAIT_MS = 1200 + 1000;   // 虹の演出 1.2秒 ＋ 1秒
function showSuperGutPopup(enemy) {
  try {
    const i = enemyList.indexOf(enemy);
    const unit = document.querySelectorAll('#enemy-area .enemy-unit')[i];
    if (!unit) return;
    const r = unit.getBoundingClientRect();
    const d = document.createElement('div');
    d.textContent = '超根性!';
    d.style.cssText = `position:fixed;left:${r.left + r.width / 2}px;top:${r.top + r.height * 0.28}px;transform:translate(-50%,-50%);font-size:1.5rem;font-weight:900;color:#ffe45e;-webkit-text-stroke:1px #7a3b00;text-shadow:0 0 10px #ff9a00,0 2px 0 #000;pointer-events:none;z-index:231;white-space:nowrap;animation:dmgPop ${DMG_NUM_MS}ms ease-out forwards;`;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), DMG_NUM_MS + 100);
  } catch (e) {}
}
// ★超根性 発動演出★ アイコンが黄色い波動を纏って膨らみながら消え、敵からも黄色い波動が広がる
function superGutBurst(enemy) {
  _sgFxUntil = Math.max(_sgFxUntil, performance.now() + 950);   // 演出（最大0.9秒）が見えきるまで、敵のカットインを待たせる
  try {
    const i = enemyList.indexOf(enemy);
    const unit = document.querySelectorAll('#enemy-area .enemy-unit')[i];
    if (!unit) { updateEnemyUI(); return; }
    const Y = '#ffe45e', O = '#ff9a00';
    const add = el => { document.body.appendChild(el); return el; };
    const ring = (x, y, size, delay, dur, w) => {
      const r = add(document.createElement('i'));
      r.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;border-radius:50%;` +
        `border:${w}px solid ${Y};box-shadow:0 0 14px ${O},inset 0 0 14px ${O};pointer-events:none;z-index:230;opacity:0;`;
      r.animate([{ transform: 'scale(.25)', opacity: 0 }, { opacity: .95, offset: .2 }, { transform: 'scale(1.5)', opacity: 0 }],
        { duration: dur, delay, easing: 'ease-out', fill: 'both' }).onfinish = () => r.remove();
    };
    // ① アイコン：いまのアイコンを複製して、黄色い波動を纏わせて消す（本物のアイコンは消す）
    const ic = unit.querySelector('.enemy-status-icons .st-icon[title^="超根性"]');
    if (ic) {
      const r = ic.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const cl = add(ic.cloneNode(true));
      cl.style.cssText += `;position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;margin:0;pointer-events:none;z-index:231;`;
      cl.querySelectorAll('img,svg').forEach(el => { el.style.width = '100%'; el.style.height = '100%'; el.style.objectFit = 'contain'; });
      ic.remove();                                   // 本物のアイコンは、この瞬間にすぐ外す
      cl.animate([
        { transform: 'scale(1)', opacity: 1, filter: `drop-shadow(0 0 0 ${Y})` },
        { transform: 'scale(1.35)', opacity: 1, filter: `drop-shadow(0 0 8px ${Y}) drop-shadow(0 0 14px ${O}) brightness(1.5)`, offset: .35 },
        { transform: 'scale(1.9)', opacity: 0, filter: `drop-shadow(0 0 12px ${Y}) drop-shadow(0 0 20px ${O}) brightness(2)` }
      ], { duration: 650, easing: 'ease-out', fill: 'forwards' }).onfinish = () => cl.remove();
      const sz = Math.max(r.width, r.height);
      ring(cx, cy, sz * 1.2, 0, 650, 3);
      ring(cx, cy, sz * 1.2, 160, 650, 2);
    }
    // ② 敵本体：黄色い波動が広がり、少しの間まとう
    const ur = unit.getBoundingClientRect(), ex = ur.left + ur.width / 2, ey = ur.top + ur.height * 0.45, es = Math.max(ur.width, ur.height * 0.8);
    ring(ex, ey, es, 0, 800, 4);
    ring(ex, ey, es, 200, 800, 3);
    ring(ex, ey, es, 400, 800, 2);
    const img = unit.querySelector('.enemy-img-wrap img');
    if (img) img.animate([
      { filter: 'drop-shadow(0 0 0 rgba(255,228,94,0)) brightness(1)' },
      { filter: `drop-shadow(0 0 10px ${Y}) drop-shadow(0 0 22px ${O}) brightness(1.35)`, offset: .3 },
      { filter: 'drop-shadow(0 0 0 rgba(255,228,94,0)) brightness(1)' }
    ], { duration: 900, easing: 'ease-out' });
    if (enemy._superGut) enemy._superGut._fxDone = true;   // 演出は出した
  } catch (e) {}
  updateEnemyUI();   // 本物の超根性アイコンを消す
}
let baseMoveMs = 4000;
let currentMoveMs = 5000;
let timeStopActive = false;
let timeStopStart = 0;
let timeStopDuration = 5000;   // 時を止める長さ(ms)。スキルの seconds で変わる（省略時5秒）
let timeStopRAF = null;
let moveTimeFixed = null;
let leaderMoveAddMs = 0;   // リーダースキルの「操作時間○秒延長／短縮」（ms。マイナス＝短縮）
// リーダースキル分を足した、基本の操作時間(ms)。最短1秒
function leaderBaseMoveMs() { return Math.max(1000, baseMoveMs + leaderMoveAddMs); }

// ============================================================
// HP計算（partyUids + レベルをキーにキャッシュ）
// ============================================================
let _hpCache = { key: '', value: 0 };
// バインド中のモンスターのHPはチーム合計から引く（本家と同じ）。解除されると元に戻る（減った分のHPは回復しない）。
// ignoreBind=true の時はバインドを無視した値（出撃準備画面の表示用）
function calcTotalHP(ignoreBind) {
  let key = '';
  for (const uid of partyUids) {
    if (uid === null) { key += ','; continue; }
    const e = box.find(b => b.uid === uid);
    if (e) key += `${e.monsterId}:${e.level}${(!ignoreBind && bindTimers[uid] > 0) ? 'B' : ''},`;
    else key += ',';
  }
  if (key === _hpCache.key) return _hpCache.value;

  let total = 0;
  const hpEffects = [];
  [0, 5].forEach(idx => {
    if (partyUids.length > idx && partyUids[idx] !== null) {
      const entry = box.find(b => b.uid === partyUids[idx]);
      if (entry) {
        const mon = MONSTER_DATA[entry.monsterId];
        if (mon && mon.leaderSkill && mon.leaderSkill.effects) {
          for (const eff of mon.leaderSkill.effects) {
            if (eff.type === 'hp') hpEffects.push(eff);
          }
        }
      }
    }
  });
  for (const uid of partyUids) {
    if (uid === null) continue;
    if (!ignoreBind && bindTimers[uid] > 0) continue;   // バインド中：このモンスターのHPは数えない
    const entry = box.find(b => b.uid === uid);
    if (entry) {
      const mon = MONSTER_DATA[entry.monsterId];
      if (mon) {
        let base = calcMonsterStats(entry).hp;
        for (const eff of hpEffects) {
          let apply = false;
          if (eff.condition === 'type') { if (mon.type === eff.attr) apply = true; }
          else if (!eff.attr || eff.attr === mon.attr) { apply = true; }
          if (apply) base *= eff.value;
        }
        total += base;
      }
    }
  }
  _hpCache.key = key;
  _hpCache.value = Math.max(1, Math.floor(total));   // 全員バインドでも最大HPは1以上（HP0で即やられにならないように）
  return _hpCache.value;
}

// ===== 毒ダメージ表示（HPバーの紫ゲージ＋ダメージ数値） =====
let _poisonNet = null;   // 毒を受けた手番中だけ数値。毒ダメージ(−)に回復(＋)を足した合計を表示する
function _showPoisonLabel(net) {
  const el = document.getElementById('hp-delta');
  if (!el) return;
  clearTimeout(el._timer);
  el.className = '';
  void el.offsetWidth;
  const v = Math.round(net);
  el.textContent = (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toLocaleString();
  el.classList.add(v >= 0 ? 'heal-delta' : 'poison-delta');
  el.style.display = 'block';
}
// 毒ドロップを消している最中：これから受ける毒ダメージ分を、HPバー上で紫に表示する
function showPoisonPreview(poisonOrbCount) {
  const seg = document.getElementById('hp-poison');
  if (!seg || playerMaxHP <= 0) return;
  if (poisonOrbCount < 3 || leaderHasEffect('poisonImmune')) { seg.style.opacity = '0'; return; }
  const dmg = Math.floor(playerMaxHP * (poisonOrbCount + 1) * 0.05);
  const shown = Math.min(dmg, playerCurrentHP);
  const left = (playerCurrentHP - shown) / playerMaxHP * 100;
  seg.style.left = left + '%';
  seg.style.width = (shown / playerMaxHP * 100) + '%';
  seg.classList.add('preview');
  seg.style.opacity = '1';
  _showPoisonLabel(-dmg);
}
function hidePoisonPreview(delay) {
  const seg = document.getElementById('hp-poison');
  if (seg) { seg.classList.remove('preview'); seg.style.opacity = '0'; }
}

function updatePlayerHP(delta) {
  if (window.MultiShare && MultiShare.remoteView) { MultiShare.paintRemoteHp(); return; }   // マルチ：相手のパーティーを表示中
  const maxHP = calcTotalHP();
  playerMaxHP = maxHP;
  if (playerCurrentHP > playerMaxHP) playerCurrentHP = playerMaxHP;
  const bar = document.getElementById('player-hp-bar');
  const label = document.getElementById('hp-label');
  const hpPct = playerMaxHP > 0 ? (playerCurrentHP / playerMaxHP * 100) : 0;
  if (bar) bar.style.width = hpPct + '%';
  const ghost = document.getElementById('hp-ghost');          // 減った分が少し遅れて追いかける
  if (ghost) ghost.style.width = hpPct + '%';
  const wrap = document.getElementById('bars-wrap');          // 残り25%以下は赤みを強める
  if (wrap) { wrap.classList.toggle('hp-low', playerMaxHP > 0 && hpPct <= 25); wrap.classList.toggle('hp-crit', playerMaxHP > 0 && hpPct <= 10); }
  if (label) label.textContent = `${playerCurrentHP.toLocaleString()} / ${playerMaxHP.toLocaleString()}`;
  // 敵から受けたダメージの合計表示（-1234 など）は出さない。回復量(+)だけ表示する。
  if (delta && delta > 0 && _poisonNet !== null) {
    // 毒を受けた後の回復：毒の「−」分に回復量を足した合計を表示（例: -500 → 回復+300 → -200）
    _poisonNet += delta;
    _showPoisonLabel(_poisonNet);
    const el = document.getElementById('hp-delta');
    if (el) el._timer = setTimeout(() => { el.style.display = 'none'; }, 1700);
  } else if (delta && delta > 0) {
    const el = document.getElementById('hp-delta');
    if (el) {
      el.className = '';
      void el.offsetWidth;
      el.textContent = (delta > 0 ? '+' : '') + Math.round(delta).toLocaleString();
      el.classList.add(delta > 0 ? 'heal-delta' : 'dmg-delta');
      el.style.display = 'block';
      clearTimeout(el._timer);
      el._timer = setTimeout(() => { el.style.display = 'none'; }, 1700);
    }
  }
  if (window.MultiShare) MultiShare.fx('hp', { hp: Math.round(playerCurrentHP), mx: Math.round(playerMaxHP) });   // マルチ：相手の画面のHPバーへ
}

let enemyDefeatedHandled = false;
let _battleEndRunning = false;

async function handleBattleEnd() {
  if (_battleEndRunning) return;
  _battleEndRunning = true;
  clearRoulettes();   // 敵を倒したらルーレットも消える
  try {
    // 敵の消滅演出とドロップ表示が終わるまで待つ
    while (_defeatPending.length) {
      const list = _defeatPending; _defeatPending = [];
      await Promise.all(list);
    }
    const isLast = currentBattleIndex >= currentDungeonBattles.length - 1;
    for (const enemy of enemyList) {
      if (enemy.hp <= 0 && !enemy._fled) {   // にげた敵は経験値・エナなし
        totalExp += (enemy.exp || 0);
        // コインは tryDrop で加算済み。通らなかった敵だけ、ここで補填（二重加算しない）
        if (!enemy._dropChecked) { enemy._dropChecked = true; addCoin(enemy.coin || 0); }
      }
    }

    if (window.MultiShare) MultiShare.recordKill();   // マルチ：この階層で倒した敵の記録（相手の端末が、自分の分の経験値・ドロップを受け取るのに使う）
    if (isLast) {
      if (window.MultiShare) MultiShare.sendClear();   // マルチ：相手の画面もクリアにする
      await finishDungeonClear();
      return;
    }
    currentBattleIndex++;
    if (window.MultiShare) MultiShare.fx('nf', { bi: currentBattleIndex, k: MultiShare.kills });   // マルチ：次の階層への移動を、相手の画面でも同時に始める
    const nextNum = currentBattleIndex + 1;
    const totalNum = currentDungeonBattles.length;
    // 前のバトルの敵のHP・「あと〇」表示を消してから BATTLE n / m を出す
    const enemyAreaEl = document.getElementById('enemy-area');
    if (enemyAreaEl) enemyAreaEl.innerHTML = '';
    // 次がBOSSなら道中BGMを止める（BOSS BGMはアニメ後の playBattleBgm で開始）
    const nextIsBoss = isBossBattleIndex(currentBattleIndex);
    if (nextIsBoss) stopDungeonBGM();   // BOSS SE は菱形がBOSSに切り替わる瞬間に鳴らす
    await showBattleBanner(nextNum, totalNum, nextIsBoss, (nextIsBoss && window.BossCloud && BossCloud.bannerOf) ? BossCloud.bannerOf(currentDungeonKey) : null);
    // ラスボス演出（js/boss-cloud.js）：暗転 → 雲の中 → 雲が晴れて専用背景 ＋ ボスBGM
    if (nextIsBoss && window.BossCloud && BossCloud.has(currentDungeonKey)) {
      await BossCloud.play(currentDungeonKey, currentBattleIndex);
    }
    if (!(nextIsBoss && hasBossIntro())) playBattleBgm(currentBattleIndex);   // サンダー等は登場演出の中でボスBGM
    // 先制攻撃の演出が終わるまで待つ（待たないと呼び出し元の busy=false の後に
    // loadBattle が busy=true を書き戻し、操作不能になる）
    await loadBattle(currentDungeonBattles[currentBattleIndex]);
    if (window.MultiShare) MultiShare.fx('ss', MultiShare.snapshot());   // マルチ：次の階層の敵の状態（先制攻撃の結果など）を相手の画面へ
    // 次のバトルの先制「にげる」で敵が全員いなくなった場合も、そのまま先へ進める
    if (enemyList.length && enemyList.every(e => e.hp <= 0)) {
      _battleEndRunning = false;
      enemyDefeatedHandled = true;
      await sleep(600);
      await handleBattleEnd();
    }
  } finally {
    _battleEndRunning = false;
  }
}

// ダンジョンクリアの締め（マルチでは、相手の端末からも呼ばれる）
async function finishDungeonClear() {
  markDungeonCleared(currentDungeonKey);   // このダンジョンをクリア済みにする（出撃準備の表示用）
  // エリアのBOSSを初めてクリアしたら、次のエリアを開放する
  const unlockedArea = (!isEventArea(currentAreaNum) && currentStageType === 'boss' && markBossCleared(currentAreaNum) && currentAreaNum < TOTAL_STAGES) ? currentAreaNum + 1 : 0;
  await playDungeonClear(unlockedArea);   // チップ/卵が光に包まれて消える → CLEAR! ＋ 花火 ＋ ホームへボタン
}

// ============================================================
// ★ リザルト画面 ★
// ============================================================
// ── ドロップの表示・付与（クリア画面 / ダンジョン中メニュー / リタイア で共通） ──
// 今ドロップしているモンスター・チップを container に並べる（所持への加算はしない）
function renderDropItems(container) {
  container.innerHTML = '';
  let n = 0;
  for (const mid of droppedMonsters) {
    const mon = MONSTER_DATA[mid];
    if (!mon) continue;
    const item = document.createElement('div');
    item.className = 'res-drop-item';
    item.innerHTML = `<img src="${monsterImg(mon)}" onerror="this.style.display='none'" alt="${mon.name}"><span>${mon.name}</span>`;
    container.appendChild(item);
    n++;
  }
  // 同じアイテムは個数をまとめて表示
  const itemTotals = {};
  for (const di of droppedItems) itemTotals[di.item] = (itemTotals[di.item] || 0) + di.count;
  for (const [itemId, cnt] of Object.entries(itemTotals)) {
    const def = ITEM_DATA[itemId];
    if (!def) continue;
    const el = document.createElement('div');
    el.className = 'res-drop-item is-item';
    el.innerHTML = `<img src="${def.img}" onerror="this.style.visibility='hidden'" alt="${def.name}"><b class="res-drop-count">×${cnt}</b><span>${def.name}</span>`;
    container.appendChild(el);
    n++;
  }
  if (!n) container.innerHTML = '<div class="res-no-drops">ドロップなし</div>';
  return n;
}
// 今ドロップしているモンスター・チップを BOX / 所持品へ加算し、ドロップ記録を空にする（二重付与しない）
function grantDrops() {
  let n = 0;
  for (const mid of droppedMonsters) {
    if (!MONSTER_DATA[mid]) continue;
    box.push({ uid: nextUid++, monsterId: mid, level: 1, exp: 0, sp: 0, memory: 0, plusHp: 0, plusAtk: 0, plusRec: 0 });
    n++;
  }
  for (const di of droppedItems) {
    if (!ITEM_DATA[di.item]) continue;
    itemInventory[di.item] = (itemInventory[di.item] || 0) + di.count;
    n += di.count;
  }
  droppedMonsters = [];
  droppedItems = [];
  updateDropCount();
  saveGame();
  return n;
}

// ── リザルト：経験値バー／レベルアップ演出 ──
let _resultMembers = [];
let _resultAnimToken = 0;
function resultExpRatio(lv, exp, maxLv) {
  if (lv >= maxLv) return 100;
  const a = EXP_CUMULATIVE[lv - 1] || 0, b = EXP_CUMULATIVE[lv];
  if (!(b > a)) return 100;
  return Math.max(0, Math.min(100, (exp - a) / (b - a) * 100));
}
async function playResultExpAnim(members) {
  members = members || _resultMembers || [];
  const token = ++_resultAnimToken;
  const btn = document.getElementById('res-close-btn');
  if (btn) { btn.disabled = true; btn.classList.add('res-wait'); }
  let lastSE = 0;
  const lvSE = () => { const t = Date.now(); if (t - lastSE > 350) { lastSE = t; playSE('levelup'); } };
  const alive = () => token === _resultAnimToken;
  const runMember = async (m, idx) => {
    const row = m.row;
    if (!row) return;
    const fill = row.querySelector('.res-exp-bar-fill');
    const lvEl = row.querySelector('.res-lv-now');
    const badge = row.querySelector('.res-up-badge');
    const diff = row.querySelector('.res-lv-diff');
    const setW = (w, ms) => { fill.style.transition = ms ? `width ${ms}ms ease-out` : 'none'; fill.style.width = w + '%'; };
    const steps = (m.newLv - m.oldLv) + 1;
    const segMs = Math.max(160, Math.min(800, 2600 / steps));
    await sleep(500 + idx * 90);
    let lv = m.oldLv;
    while (alive() && lv < m.newLv) {
      setW(100, segMs);                       // バーが満タンまで上がる
      await sleep(segMs + 30);
      if (!alive()) return;
      lv++;
      lvEl.textContent = lv;                  // レベル表記が上がる
      lvEl.classList.remove('lvpop'); void lvEl.offsetWidth; lvEl.classList.add('lvpop');
      row.classList.remove('lvup-flash'); void row.offsetWidth; row.classList.add('lvup-flash');
      badge.classList.remove('show'); void badge.offsetWidth; badge.classList.add('show');
      lvSE();
      setW(0, 0);
      await sleep(steps > 4 ? 120 : 260);
    }
    if (!alive()) return;
    const fr = resultExpRatio(m.newLv, m.newExp, m.maxLv);
    if (m.newLv === m.oldLv || fr > 0) { setW(fr, segMs); await sleep(segMs + 30); }
    if (m.newLv > m.oldLv) {
      diff.innerHTML = `Lv${m.oldLv} <i>→</i> <b>Lv${m.newLv}</b> <em>+${m.newLv - m.oldLv}</em>`;
      diff.classList.add('show');
    } else if (m.newLv >= m.maxLv) {
      diff.textContent = 'MAX'; diff.classList.add('show', 'max');
    }
  };
  try {
    await Promise.all(members.map(runMember));
    if (alive()) await sleep(250);
  } catch (e) { console.error(e); }
  if (alive() && btn) { btn.disabled = false; btn.classList.remove('res-wait'); }   // 演出が終わったら閉じられる
}

async function showResultScreen(silent = false) {
  restoreTransforms();   // 変身はここまで。経験値は元のモンスターに入れる
  if (!silent) playSE('clear');
  let anyLevelUp = false;
  const dropCount = droppedMonsters.length + droppedItems.reduce((a, d) => a + (d.count || 0), 0);
  const screen = document.getElementById('result-screen');
  const coinEl = document.getElementById('res-coin');
  const expEl = document.getElementById('res-exp');
  const dropsContainer = document.getElementById('res-drops-container');
  const membersContainer = document.getElementById('res-exp-members');

  coinEl.textContent = totalCoin.toLocaleString();
  expEl.textContent = totalExp.toLocaleString();
  addPlayerCoin(totalCoin);   // クリアで獲得したコインを所持コインに加算

  dropsContainer.innerHTML = '';
  if (droppedMonsters.length === 0 && droppedItems.length === 0) {
    dropsContainer.innerHTML = '<div class="res-no-drops">ドロップなし</div>';
  } else {
    renderDropItems(dropsContainer);   // 表示
    grantDrops();                      // BOX・所持品へ実際に追加
  }

  const partyMembers = partyUids.filter(uid => uid !== null);
  const perExp = partyMembers.length > 0 ? Math.floor(totalExp / partyMembers.length) : 0;
  membersContainer.innerHTML = '';
  const members = [];   // 演出用：各モンスターの 前のレベル/経験値 → 今のレベル/経験値

  for (const uid of partyMembers) {
    const entry = box.find(b => b.uid === uid);
    if (!entry) continue;
    const mon = MONSTER_DATA[entry.monsterId];
    if (!mon) continue;
    const maxLv = getMonsterMaxLevel(mon);
    const oldExp = entry.exp || 0;
    const oldLv = entry.level;
    const newExp = oldExp + perExp;
    entry.exp = Math.min(newExp, EXP_CUMULATIVE[maxLv - 1]);
    while (entry.level < maxLv && entry.exp >= EXP_CUMULATIVE[entry.level]) {
      entry.level++;
    }
    const lvGain = entry.level - oldLv;
    if (lvGain > 0) anyLevelUp = true;
    members.push({ oldLv, newLv: entry.level, oldExp, newExp: entry.exp, maxLv, gain: perExp });

    const row = document.createElement('div');
    row.className = 'res-exp-row';
    row.innerHTML = `
      <img class="res-icon" src="${monsterImg(mon)}" onerror="this.style.display='none'" alt="${mon.name}">
      <div class="res-mid">
        <div class="res-line1">
          <span class="res-name">${mon.name}</span>
          <span class="res-lv">Lv<b class="res-lv-now">${oldLv}</b></span>
          <span class="res-lv-diff"></span>
        </div>
        <div class="res-exp-bar-bg"><div class="res-exp-bar-fill" style="width:0%;"></div></div>
      </div>
      <span class="res-up-badge">LEVEL UP!</span>
    `;
    membersContainer.appendChild(row);
    members[members.length - 1].row = row;
    // 演出前は「今回の獲得前」のレベル・バーを表示しておく
    const r0 = resultExpRatio(oldLv, oldExp, maxLv);
    row.querySelector('.res-exp-bar-fill').style.width = r0 + '%';
  }
  _resultMembers = members;

  saveGame();    // 獲得したモンスター・チップ・経験値/レベルを保存
  if (silent) return { anyLevelUp, dropCount, coin: totalCoin, exp: totalExp, members };   // 報酬の加算・保存だけ行い、リザルト画面は出さない
  startResultMenuBGM(); // クリア画面中はmenu.mp3を小さめの音量で流す（閉じるとフェードイン）
  screen.style.display = 'flex';
  playResultExpAnim(members);
  return { anyLevelUp, dropCount, coin: totalCoin, exp: totalExp, members };
}


// ============================================================
// ダンジョンクリア演出（パズドラ風）
//  1) 倒した敵が落としたチップ／卵は、しばらくして光に包まれて消える
//  2) モンスターのいた所に「CLEAR!」が出る（clear.mp3 と同時）＋ 水色・紫・黄色の花火
//  3) 同時に盤面に重なって「ホームへ」ボタンが出る → 押すとホームへ（clear.mp3 を止める）
// ============================================================
let _clearActive = false, _clearResolve = null;
let _fwRAF = 0, _fwTimer = 0;

// 「CLEAR!」ロゴ（水色の太文字＋白フチ＋黒フチ）
function clearLogoSVG() {
  const G = [
    [60, 'M50 10H10V90H50'],                   // C
    [60, 'M10 10V90H50'],                      // L
    [60, 'M50 10H10V90H50M10 50H44'],          // E
    [60, 'M9 90L18 10H42L51 90M12 60H48'],     // A
    [60, 'M10 90V10H50V50H10M28 50L50 90'],    // R
    [40, 'M20 10V58M20 86V90']                 // !
  ];
  const GAP = 26;
  let x = 0, paths = '';
  G.forEach(([w, d]) => { paths += `<path transform="translate(${x} 0)" d="${d}"/>`; x += w + GAP; });
  const total = x - GAP, pad = 24;
  return `<svg viewBox="${-pad} ${-pad} ${total + pad * 2} ${100 + pad * 2}" xmlns="http://www.w3.org/2000/svg" aria-label="CLEAR!">` +
    `<defs><linearGradient id="clBlue" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100">` +
    `<stop offset="0" stop-color="#9af3ff"/><stop offset=".5" stop-color="#34b6ff"/><stop offset="1" stop-color="#1668e0"/></linearGradient></defs>` +
    `<g fill="none" stroke="#0a0a1e" stroke-width="50" stroke-linejoin="round" stroke-linecap="round" transform="translate(0 4)">${paths}</g>` +
    `<g fill="none" stroke="#0a0a1e" stroke-width="50" stroke-linejoin="round" stroke-linecap="round">${paths}</g>` +
    `<g fill="none" stroke="#ffffff" stroke-width="34" stroke-linejoin="round" stroke-linecap="round">${paths}</g>` +
    `<g fill="none" stroke="url(#clBlue)" stroke-width="21" stroke-linejoin="miter" stroke-miterlimit="3" stroke-linecap="butt">${paths}</g>` +
    `</svg>`;
}

// 花火（水色・紫・黄色）。ホームへ戻るまで打ち上げ続ける
function startClearFireworks() {
  stopClearFireworks();
  const game = document.getElementById('game');
  const dungeon = document.getElementById('dungeon');
  if (!game || !dungeon) return;
  const cv = document.createElement('canvas');
  cv.id = 'clear-fireworks';
  game.appendChild(cv);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = game.clientWidth, H = game.clientHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  const gr = game.getBoundingClientRect(), dr = dungeon.getBoundingClientRect();
  const areaTop = Math.max(0, dr.top - gr.top), areaH = dr.height, areaBottom = areaTop + areaH;
  const COLORS = ['#5ee7ff', '#b36bff', '#ffe14d'];   // 水色・紫・黄色
  const rockets = [], sparks = [];
  const rnd = (a, b) => a + Math.random() * (b - a);
  let colorIdx = Math.floor(Math.random() * 3);

  function launch() {
    const color = COLORS[colorIdx % 3]; colorIdx++;
    const x = rnd(W * 0.12, W * 0.88);
    rockets.push({ x, y: areaBottom, tx: x + rnd(-20, 20), ty: areaTop + rnd(areaH * 0.12, areaH * 0.6), color, t: 0, dur: rnd(0.55, 0.85), sx: x, sy: areaBottom });
  }
  function burst(x, y, color) {
    const ring = Math.random() < 0.5;
    const n = Math.round(rnd(46, 66));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (ring ? 0 : rnd(-.2, .2));
      const sp = ring ? rnd(190, 215) : rnd(60, 250);
      sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: rnd(0.9, 1.5), color, w: Math.random() < 0.18 });
    }
    if (Math.random() < 0.4) {   // 内側にもう1色の輪
      const c2 = COLORS[(COLORS.indexOf(color) + 1 + Math.floor(Math.random() * 2)) % 3];
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2;
        sparks.push({ x, y, vx: Math.cos(a) * 105, vy: Math.sin(a) * 105, life: 0, max: rnd(0.8, 1.2), color: c2, w: false });
      }
    }
  }
  function schedule() {
    launch();
    _fwTimer = setTimeout(schedule, rnd(320, 650));
  }
  launch(); setTimeout(launch, 160); setTimeout(launch, 330);
  _fwTimer = setTimeout(schedule, 520);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.t += dt;
      const k = Math.min(1, r.t / r.dur), e = 1 - (1 - k) * (1 - k);
      const nx = r.sx + (r.tx - r.sx) * e, ny = r.sy + (r.ty - r.sy) * e;
      ctx.strokeStyle = r.color; ctx.globalAlpha = 0.9; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(nx, ny); ctx.stroke();
      r.x = nx; r.y = ny;
      if (k >= 1) { burst(r.x, r.y, r.color); rockets.splice(i, 1); }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.life += dt;
      if (p.life >= p.max) { sparks.splice(i, 1); continue; }
      const ox = p.x, oy = p.y;
      const drag = Math.pow(0.12, dt);
      p.vx *= drag; p.vy = p.vy * drag + 140 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const a = 1 - p.life / p.max;
      ctx.strokeStyle = p.w ? '#ffffff' : p.color;
      ctx.globalAlpha = a; ctx.lineWidth = p.w ? 2.6 : 2;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.globalAlpha = a * 0.3; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    _fwRAF = requestAnimationFrame(frame);
  }
  _fwRAF = requestAnimationFrame(frame);
}
function stopClearFireworks() {
  cancelAnimationFrame(_fwRAF); _fwRAF = 0;
  clearTimeout(_fwTimer); _fwTimer = 0;
  const cv = document.getElementById('clear-fireworks');
  if (cv) cv.remove();
}

// チップ／卵が光に包まれて消える
function vanishGiftsInLight(gifts) {
  playSE('kieru');
  const DUR = 600;   // 卵が光に包まれて消えるまで（以前は1000）
  return new Promise(resolve => {
    gifts.forEach(g => {
      const row = g.parentNode;
      // 後ろに白い光のかたまり
      const glow = document.createElement('div');
      glow.className = 'gift-glow';
      const r = g.getBoundingClientRect(), pr = row.getBoundingClientRect();
      const sz = Math.max(r.width, r.height) * 1.7;
      glow.style.cssText = `position:absolute;left:${r.left - pr.left + r.width / 2 - sz / 2}px;top:${r.top - pr.top + r.height / 2 - sz / 2}px;width:${sz}px;height:${sz}px;border-radius:50%;` +
        'background:radial-gradient(circle,rgba(255,255,255,.95) 0%,rgba(190,235,255,.65) 38%,rgba(190,235,255,0) 70%);opacity:0;pointer-events:none;';
      row.appendChild(glow);
      if (glow.animate) glow.animate([
        { opacity: 0, transform: 'scale(.4)' },
        { opacity: 1, transform: 'scale(1)', offset: .45 },
        { opacity: 0, transform: 'scale(1.5)' }
      ], { duration: DUR, easing: 'ease-in-out', fill: 'forwards' });
      if (g.animate) g.animate([
        { opacity: 1, filter: 'brightness(1)', transform: 'scale(1)' },
        { opacity: 1, filter: 'brightness(2.6) saturate(.5)', transform: 'scale(1.1)', offset: .45 },
        { opacity: 0, filter: 'brightness(5) saturate(0)', transform: 'scale(1.25)' }
      ], { duration: DUR, easing: 'ease-in', fill: 'forwards' });
    });
    setTimeout(() => {
      document.querySelectorAll('#enemy-area .enemy-gift-row').forEach(r => r.remove());
      resolve();
    }, DUR + 30);
  });
}

async function playDungeonClear(unlockedArea) {
  _clearActive = true;
  busy = true;
  try { stopTimer(); } catch (e) {}
  timerStarted = false;
  try { if (dragEl) { dragEl.style.transform = ''; dragEl.classList.remove('dragging'); dragEl = null; } } catch (e) {}
  dragging = false;
  const gameEl = document.getElementById('game');
  if (gameEl) gameEl.classList.add('game-clear');   // パーティ・Menu・盤面の操作を止める
  const lbl = document.getElementById('combo-label');
  if (lbl) lbl.textContent = '';

  // 報酬（エナ・経験値・ドロップ）はここで確定して保存（リザルト画面は出さない）
  let rewards = { anyLevelUp: false, dropCount: 0, coin: 0, exp: 0 };
  try { rewards = await showResultScreen(true); } catch (e) { console.error(e); }

  // ① チップ／卵が落ちていたら、少し見せてから光に包まれて消える
  const gifts = Array.from(document.querySelectorAll('#enemy-area .enemy-gift'));
  if (gifts.length) {
    await sleep(500);   // 少し見せてから消える（以前は1000）
    await vanishGiftsInLight(gifts);
  }
  await sleep(250);

  // ② CLEAR! ＋ clear.mp3 ＋ 花火 ＋ ホームへボタン（同時）
  stopDungeonBGM();
  stopClearSE();
  playSE('clear');
  const ea = document.getElementById('enemy-area');
  if (ea) { ea.style.transition = 'opacity .35s'; ea.style.opacity = '0'; }   // 倒したモンスターのHP表示などを消す
  const dungeon = document.getElementById('dungeon');
  if (dungeon) {
    const t = document.createElement('div');
    t.id = 'clear-text-overlay';
    t.innerHTML = '<div id="clear-text">' + clearLogoSVG() + '</div>';
    dungeon.appendChild(t);
    requestAnimationFrame(() => { const x = t.querySelector('#clear-text'); if (x) x.classList.add('show'); });
  }
  startClearFireworks();
  const wrap = document.getElementById('grid-wrap');
  if (wrap) {
    const ov = document.createElement('div');
    ov.id = 'clear-board-overlay';
    ov.innerHTML = '<button id="clear-home-btn" class="btn btn-primary btn-cta" type="button">ホームへ</button>';
    wrap.appendChild(ov);
    ['touchstart', 'touchmove', 'mousedown'].forEach(ev => ov.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
    const btn = ov.querySelector('#clear-home-btn');
    requestAnimationFrame(() => { ov.classList.add('show'); btn.classList.add('show'); });
    btn.addEventListener('click', () => {
      if (!_clearActive) return;
      _clearGoHome(unlockedArea, rewards);
    });
  } else {
    _clearGoHome(unlockedArea, rewards);
  }

  // ホームへ戻るまで待つ（busy を保つ）
  await new Promise(resolve => { _clearResolve = resolve; });
}

// マルチ：ゲームオーバーで観戦していた人に出す、報酬なしのCLEAR画面（クリア済み扱い・エナ・経験値・ドロップはなし）
async function playSpectatorClear() {
  _clearActive = true;
  busy = true;
  try { stopTimer(); } catch (e) {}
  timerStarted = false;
  dragging = false;
  const gameEl = document.getElementById('game');
  if (gameEl) { gameEl.classList.add('game-clear'); gameEl.classList.remove('mt-spectate'); }
  const lbl = document.getElementById('combo-label');
  if (lbl) lbl.textContent = '';
  while (_defeatPending.length) { const list = _defeatPending; _defeatPending = []; await Promise.all(list); }
  await sleep(250);
  stopDungeonBGM();
  stopClearSE();
  playSE('clear');
  const ea = document.getElementById('enemy-area');
  if (ea) { ea.style.transition = 'opacity .35s'; ea.style.opacity = '0'; }
  const dungeon = document.getElementById('dungeon');
  if (dungeon) {
    const t = document.createElement('div');
    t.id = 'clear-text-overlay';
    t.innerHTML = '<div id="clear-text">' + clearLogoSVG() + '</div>';
    dungeon.appendChild(t);
    requestAnimationFrame(() => { const x = t.querySelector('#clear-text'); if (x) x.classList.add('show'); });
  }
  startClearFireworks();
  const wrap = document.getElementById('grid-wrap');
  if (wrap) {
    const ov = document.createElement('div');
    ov.id = 'clear-board-overlay';
    ov.className = 'spec';
    ov.innerHTML = '<div class="mt-spec-note">観戦のため、クリア報酬はありません</div><button id="clear-home-btn" class="btn btn-primary btn-cta" type="button">ホームへ</button>';
    wrap.appendChild(ov);
    ['touchstart', 'touchmove', 'mousedown'].forEach(ev => ov.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
    const btn = ov.querySelector('#clear-home-btn');
    requestAnimationFrame(() => { ov.classList.add('show'); btn.classList.add('show'); });
    btn.addEventListener('click', () => { _gameOverGoHome(); });   // 報酬なし・クリア記録なしでホームへ
  } else {
    _gameOverGoHome();
  }
}

function resetClearState() {
  _clearActive = false;
  stopClearFireworks();
  stopClearSE();
  ['clear-text-overlay', 'clear-board-overlay'].forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
  const ea = document.getElementById('enemy-area');
  if (ea) { ea.style.opacity = ''; ea.style.transition = ''; }
  const g = document.getElementById('game');
  if (g) g.classList.remove('game-clear');
}

function _clearGoHome(unlockedArea, rewards) {
  _clearActive = false;
  setHomeFocusFromCurrent();
  stopClearSE();                      // ★ホームへ戻る時にクリア音を必ず止める
  resetClearState();
  document.getElementById('game').style.display = 'none';
  document.getElementById('home').style.display = 'flex';
  stopDungeonBGM();
  stopClearSE();
  if (window.MultiTurn) MultiTurn.end();
  busy = false;
  setTimeout(() => { try { scrollHomeToFrontier(); } catch (e) {} }, 50);

  // ホームに戻ったら、前と同じリザルト画面（エナ・経験値・ドロップ・レベル）を出す。
  // 内容はクリア時に作成・加算・保存済み。「閉じる」を押してからホームのBGMを流す。
  const screen = document.getElementById('result-screen');
  startResultMenuBGM();   // リザルト中も menu.mp3 を小さめの音量で流す
  if (screen) screen.style.display = 'flex';
  playResultExpAnim(rewards && rewards.members);   // レベル表記・バーが上がってレベルアップ演出
  waitResultClose().then(() => {
    startMenuBGM();   // 念のため（既に再生中なら何もしない）
    if (unlockedArea) homeToast(`エリア${unlockedArea}「${AREA_NAMES[unlockedArea] || ''}」が開放されました！`, 3200);
  });

  const r = _clearResolve; _clearResolve = null;
  if (r) r();
}

// クリア画面が閉じられるまで待つための Promise 解決用
let _resultCloseResolvers = [];
function waitResultClose() {
  return new Promise(resolve => _resultCloseResolvers.push(resolve));
}
document.getElementById('res-close-btn').addEventListener('click', () => {
  document.getElementById('result-screen').style.display = 'none';
  fadeInMenuBGM();   // 閉じたらホームBGMを通常音量までフェードイン
  const rs = _resultCloseResolvers; _resultCloseResolvers = [];
  rs.forEach(r => r());
});

// ============================================================
// 編成画面
// ============================================================
const TEAM_BADGES = ['①','②','③','④','⑤','⑥'];
let activeAttrFilters = new Set();
let searchQuery = '';
// 並び替え（js/box-sort.js）。入手順 / レベル / 属性 / 名前 / HP / こうげき / かいふく / タイプ / レア度 / スキル / リダスキ
//   編成画面では、編成済みでも先頭には移動しない（並び替え設定の順のまま）。合計経験値順は合成画面だけ
const teSort = BoxSort.makeState('te', BoxSort.MODES.map(m => m.id).filter(id => id !== 'exp'), false);
let teLS = null;   // リーダースキル検索（js/ls-search.js）。下の「te-sort-btn」のあたりで作る

// ── タップ編成 ──
//  ・カードをダブルタップ：チームの空き枠へ入る（編成済みなら外れる）
//  ・カードを長押し：モンスター詳細
//  ・シングルタップだけでは何も起きない（スクロールの邪魔もしない）
let _teFlying = false;
const TAP_MAX_MS = 450;      // この時間以内に離せばタップ
const TAP_DOUBLE_MS = 350;   // 2回タップとみなす間隔
const TE_LONGPRESS_MS = 350; // 長押し判定（ボックスのカードを長押し → ステータス/詳細。以前は500）
let _teLastTap = { uid: null, t: 0 };

function teSlotEls() {
  return Array.from(document.querySelectorAll('#te-party-scroll .te-party-slot'));
}

// 画面上の点(x,y)がどのチーム枠か。枠外でもチームエリア付近なら一番近い枠。-1なら範囲外
function teSlotIndexAt(x, y) {
  const slots = teSlotEls();
  for (let i = 0; i < slots.length; i++) {
    const r = slots[i].getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
  }
  const area = document.getElementById('te-party-area');
  if (!area || !slots.length) return -1;
  const ar = area.getBoundingClientRect();
  if (y < ar.top - 24 || y > ar.bottom + 24) return -1;
  let best = -1, bestD = Infinity;
  slots.forEach((s, i) => {
    const r = s.getBoundingClientRect();
    const d = Math.abs((r.left + r.right) / 2 - x);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

function teAdvanceSelected(from) {
  for (let i = 0; i < 6; i++) {
    const s = (from + i) % 6;
    if (currentTeam[s] === null) { selectedSlotIndex = s; return; }
  }
  selectedSlotIndex = from;
}

// 指定枠へ配置（すでに編成済みの場合は枠同士を入れ替え）
function tePlaceToSlot(uid, idx) {
  const prev = currentTeam.indexOf(uid);
  if (prev === idx) { renderTeamEdit(); return; }
  if (prev !== -1) currentTeam[prev] = currentTeam[idx];
  currentTeam[idx] = uid;
  teAdvanceSelected(idx);
  renderTeamEdit();
}

function teClearHover() {
  teSlotEls().forEach(s => s.classList.remove('drop-target'));
}

function setupCardTap(card, entry) {
  let lastTouchAt = -10000;
  let sx = 0, sy = 0, st = 0;
  let tracking = false, moved = false, longFired = false;
  let lpTimer = null;

  // ダブルタップ：空き枠へ自動配置 / 編成済みなら外す
  function toggleTeam() {
    if (_teFlying) return;
    const prev = currentTeam.indexOf(entry.uid);
    if (prev !== -1) {
      currentTeam[prev] = null;
      selectedSlotIndex = prev;
      renderTeamEdit();
      return;
    }
    let target = -1;
    for (let i = 0; i < 6; i++) {
      const s = (selectedSlotIndex + i) % 6;
      if (currentTeam[s] === null) { target = s; break; }
    }
    if (target < 0) target = selectedSlotIndex;
    playTapSound();

    // 枠へ飛んでいく演出
    const slotEl = teSlotEls()[target];
    const mon = MONSTER_DATA[entry.monsterId];
    if (slotEl && card.animate) {
      _teFlying = true;
      const cr = card.getBoundingClientRect();
      const sr = slotEl.getBoundingClientRect();
      const g = document.createElement('div');
      g.className = 'te-swipe-ghost';
      g.style.width = cr.width + 'px';
      g.style.height = cr.width + 'px';
      g.style.left = (cr.left + cr.width / 2) + 'px';
      g.style.top = (cr.top + cr.height / 2) + 'px';
      const im = document.createElement('img');
      im.src = monsterImg(mon);
      im.onerror = function () { this.style.display = 'none'; };
      g.appendChild(im);
      document.body.appendChild(g);
      const dx = (sr.left + sr.width / 2) - (cr.left + cr.width / 2);
      const dy = (sr.top + sr.height / 2) - (cr.top + cr.height / 2);
      let done = false;
      const finish = () => { if (done) return; done = true; g.remove(); _teFlying = false; tePlaceToSlot(entry.uid, target); };
      const anim = g.animate([
        { transform: 'translate(-50%,-50%) scale(1.1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.9)`, opacity: 0.9 }
      ], { duration: 220, easing: 'cubic-bezier(0.3,0.7,0.3,1)', fill: 'forwards' });
      anim.onfinish = finish;
      anim.oncancel = finish;
    } else {
      tePlaceToSlot(entry.uid, target);
    }
  }

  function onDown(x, y) {
    sx = x; sy = y; st = performance.now();
    tracking = true; moved = false; longFired = false;
    clearTimeout(lpTimer);
    lpTimer = setTimeout(() => {
      if (!tracking || moved) return;
      longFired = true;
      _teLastTap = { uid: null, t: 0 };
      playTapSound();
      openMonsterDetail(box.indexOf(entry), 'team-edit', true);
    }, TE_LONGPRESS_MS);
  }

  function onMove(x, y) {
    if (!tracking) return;
    if (Math.abs(x - sx) > 10 || Math.abs(y - sy) > 10) {
      moved = true;
      clearTimeout(lpTimer);   // スクロール等 → 長押し・タップ扱いにしない
    }
  }

  // 戻り値 true = タップ/長押しとして処理した（疑似クリックを止める）
  function onUp() {
    if (!tracking) return false;
    tracking = false;
    clearTimeout(lpTimer);
    if (longFired) { longFired = false; return true; }
    if (moved) return false;
    if ((performance.now() - st) >= TAP_MAX_MS) { _teLastTap = { uid: null, t: 0 }; return false; }
    const now = performance.now();
    if (_teLastTap.uid === entry.uid && now - _teLastTap.t <= TAP_DOUBLE_MS) {
      _teLastTap = { uid: null, t: 0 };
      toggleTeam();
    } else {
      _teLastTap = { uid: entry.uid, t: now };
    }
    return true;
  }

  function onCancel() {
    tracking = false;
    clearTimeout(lpTimer);
  }

  // タッチ
  card.addEventListener('touchstart', (e) => {
    lastTouchAt = performance.now();
    const t = e.touches[0];
    onDown(t.clientX, t.clientY);
  }, { passive: true });
  card.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    onMove(t.clientX, t.clientY);
  }, { passive: true });
  card.addEventListener('touchend', (e) => {
    lastTouchAt = performance.now();
    // 処理した場合は後から来る疑似マウス/クリックを止める
    // （詳細画面が開いた直後に下のボタンが誤タップされるのを防ぐ）
    if (onUp() && e.cancelable) e.preventDefault();
  });
  card.addEventListener('touchcancel', onCancel);
  // 長押し時のコンテキストメニュー（画像保存など）を出さない
  card.addEventListener('contextmenu', (e) => e.preventDefault());

  // マウス（PC確認用）
  card.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (performance.now() - lastTouchAt < 800) return; // タッチ由来の疑似マウスは無視
    onDown(e.clientX, e.clientY);
    const mv = (ev) => { onMove(ev.clientX, ev.clientY); };
    const up = () => {
      window.removeEventListener('mousemove', mv);
      window.removeEventListener('mouseup', up);
      onUp();
    };
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up);
  });
}

function renderTeamEdit() {
  persistTeams();
  updateTeamNavLabels();
  renderTePartySlots();
  renderTeMonsterGrid();
  updateTeStats();
}

// チーム合計（HP / 攻撃 / 回復）
function updateTeStats() {
  const sums = calcTeamSums();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v.toLocaleString(); };
  set('te-stat-hp', sums.hp); set('te-stat-atk', sums.atk); set('te-stat-rec', sums.rec);
}

// ── 入れ替えモード ──
//  ボタンでON/OFF。ONの間は上のチーム枠をスワイプ（ドラッグ）して別の枠に重ねると入れ替わる
let teSwapMode = false;

function teSetSwapMode(on) {
  teSwapMode = !!on;
  const btn = document.getElementById('te-swap-btn');
  if (btn) {
    btn.classList.toggle('active', teSwapMode);
    const lbl = document.getElementById('te-swap-label');
    if (lbl) lbl.textContent = teSwapMode ? '入れ替え中' : '入れ替え';
  }
  const area = document.getElementById('te-party-area');
  if (area) area.classList.toggle('swap-mode', teSwapMode);
  document.body.classList.remove('te-dragging');
  document.querySelectorAll('.te-swipe-ghost').forEach(g => g.remove());
  teClearHover();
}

function setupSlotSwap(slot, idx) {
  if (currentTeam[idx] === null) return;   // 空き枠は動かせない（入れ替え先にはできる）
  const entry = box.find(b => b.uid === currentTeam[idx]);
  if (!entry) return;
  let tracking = false, dragging = false, ghost = null, ghostSize = 0, hoverIdx = -1;
  let sx = 0, sy = 0, lastTouchAt = -10000;

  function makeGhost(x, y) {
    const r = slot.getBoundingClientRect();
    ghostSize = r.width;
    ghost = document.createElement('div');
    ghost.className = 'te-swipe-ghost';
    ghost.style.width = ghostSize + 'px';
    ghost.style.height = ghostSize + 'px';
    const img = document.createElement('img');
    img.src = monsterImg(MONSTER_DATA[entry.monsterId]);
    img.onerror = function () { this.style.display = 'none'; };
    ghost.appendChild(img);
    document.body.appendChild(ghost);
    slot.classList.add('swap-src');
    document.body.classList.add('te-dragging');
    moveGhost(x, y);
  }
  function moveGhost(x, y) {
    if (!ghost) return;
    ghost.style.left = x + 'px';
    ghost.style.top = (y - ghostSize * 0.2) + 'px';
    const h = swapIndexAt(x, y - ghostSize * 0.2);
    if (h !== hoverIdx) {
      teClearHover();
      hoverIdx = h;
      if (h >= 0 && h !== idx) { const el = teSlotEls()[h]; if (el) el.classList.add('drop-target'); }
    }
  }
  // 枠の中にある時だけ対象にする（近い枠への吸着はしない＝誤入れ替え防止）
  function swapIndexAt(x, y) {
    const slots = teSlotEls();
    for (let i = 0; i < slots.length; i++) {
      const r = slots[i].getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
    }
    return -1;
  }
  function cleanup() {
    if (ghost) { ghost.remove(); ghost = null; }
    slot.classList.remove('swap-src');
    document.body.classList.remove('te-dragging');
    teClearHover();
    hoverIdx = -1;
  }
  function onDown(x, y) { tracking = true; dragging = false; sx = x; sy = y; }
  function onMove(x, y) {
    if (!tracking) return false;
    if (!dragging) {
      if (Math.abs(x - sx) < 8 && Math.abs(y - sy) < 8) return false;
      dragging = true;
      makeGhost(x, y);
    }
    moveGhost(x, y);
    return true;
  }
  function onUp(x, y) {
    if (!tracking) return;
    tracking = false;
    if (!dragging) return;
    const to = swapIndexAt(x, y - ghostSize * 0.2);
    cleanup();
    dragging = false;
    if (to >= 0 && to !== idx) {
      const tmp = currentTeam[idx];
      currentTeam[idx] = currentTeam[to];
      currentTeam[to] = tmp;
      selectedSlotIndex = to;
      playTapSound();
      renderTeamEdit();
    }
  }
  function onCancel() { if (!tracking) return; tracking = false; if (dragging) { cleanup(); dragging = false; } }

  slot.addEventListener('touchstart', (e) => {
    lastTouchAt = performance.now();
    const t = e.touches[0]; onDown(t.clientX, t.clientY);
  }, { passive: true });
  slot.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (onMove(t.clientX, t.clientY) && e.cancelable) e.preventDefault();
  }, { passive: false });
  slot.addEventListener('touchend', (e) => {
    lastTouchAt = performance.now();
    const t = e.changedTouches[0]; onUp(t.clientX, t.clientY);
  });
  slot.addEventListener('touchcancel', onCancel);
  slot.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || performance.now() - lastTouchAt < 800) return;
    onDown(e.clientX, e.clientY);
    const mv = (ev) => { onMove(ev.clientX, ev.clientY); };
    const up = (ev) => {
      window.removeEventListener('mousemove', mv);
      window.removeEventListener('mouseup', up);
      onUp(ev.clientX, ev.clientY);
    };
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up);
  });
}

let _teSlotLastTap = { idx: -1, t: 0 };
function renderTePartySlots() {
  const scroll = document.getElementById('te-party-scroll');
  scroll.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const slot = document.createElement('div');
    slot.className = 'te-party-slot' + (i === selectedSlotIndex ? ' selected' : '');
    slot.dataset.index = i;
    const uid = currentTeam[i];
    if (uid !== null) {
      const entry = box.find(b => b.uid === uid);
      if (entry) {
        const mon = MONSTER_DATA[entry.monsterId];
        slot.dataset.attr = mon.attr;
        const img = document.createElement('img');
        img.className = 'te-slot-img';
        img.src = monsterImg(mon);
        img.alt = mon.name;
        img.onerror = function(){ this.style.display='none'; };
        slot.appendChild(img);
        const lv = document.createElement('div');
        lv.className = 'te-slot-lv';
        lv.textContent = `Lv.${entry.level}`;
        slot.appendChild(lv);
      }
    } else {
      const empty = document.createElement('span');
      empty.className = 'te-slot-empty-icon';
      empty.textContent = '＋';
      slot.appendChild(empty);
    }
    if (teSwapMode) {
      setupSlotSwap(slot, i);
      scroll.appendChild(slot);
      continue;
    }
    // タップ：選択 / 2回高速タップ：チームから外す / 長押し：詳細
    slot.addEventListener('click', () => {
      if (_longPressTriggered) { _longPressTriggered = false; return; }
      const now = performance.now();
      if (currentTeam[i] !== null && _teSlotLastTap.idx === i && now - _teSlotLastTap.t <= TAP_DOUBLE_MS) {
        _teSlotLastTap = { idx: -1, t: 0 };
        currentTeam[i] = null;
        selectedSlotIndex = i;
        renderTeamEdit();
        return;
      }
      _teSlotLastTap = { idx: i, t: now };
      selectedSlotIndex = i;
      renderTeamEdit();
    });
    if (uid !== null) {
      addLongPress(slot, () => {
        const boxIdx = box.findIndex(b => b.uid === uid);
        if (boxIdx !== -1) { _teSlotLastTap = { idx: -1, t: 0 }; openMonsterDetail(boxIdx, 'team-edit'); }
      });
      // 長押し後に飛んでくる疑似クリックを止める（詳細画面直後の誤タップ防止）
      slot.addEventListener('touchend', (e) => {
        if (_longPressTriggered && e.cancelable) e.preventDefault();
      });
    }
    scroll.appendChild(slot);
  }
}

function renderTeMonsterGrid() {
  const grid = document.getElementById('te-monster-grid');
  grid.innerHTML = '';
  const filtered = box.filter(entry => {
    const mon = MONSTER_DATA[entry.monsterId];
    if (!mon) return false;
    if (activeAttrFilters.size > 0 && !activeAttrFilters.has(mon.attr)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!mon.name.toLowerCase().includes(q) && !(mon.skill && mon.skill.name.toLowerCase().includes(q))) return false;
    }
    if (teLS && !teLS.match(mon)) return false;   // リーダースキル検索
    return true;
  });
  const teamMap = {};
  for (let i = 0; i < 6; i++) if (currentTeam[i] !== null) teamMap[currentTeam[i]] = i;
  const sorted = BoxSort.sort(filtered, teSort, { monsters: MONSTER_DATA, stats: calcMonsterStats });   // 編成済みでも先頭には移動しない
  detailListOrder['team-edit'] = sorted.map(e => e.uid);   // ステータス画面の左右ボタンは、この並び順で巡回する
  const countEl = document.getElementById('te-count');
  if (countEl) countEl.textContent = filtered.length === box.length ? `所持 ${box.length}体` : `${filtered.length} / ${box.length}体`;
  let anyVal = false;
  sorted.forEach(entry => {
    const mon = MONSTER_DATA[entry.monsterId];
    const card = document.createElement('div');
    card.className = 'te-mon-card';
    if (teamMap[entry.uid] !== undefined) card.classList.add('in-team');
    card.dataset.attr = mon.attr;
    const img = document.createElement('img');
    img.className = 'te-mon-img';
    img.src = monsterImg(mon);
    img.alt = mon.name;
    img.onerror = function(){ this.style.display='none'; };
    card.appendChild(img);
    const lv = document.createElement('div');
    lv.className = 'te-mon-lv';
    lv.textContent = `Lv.${entry.level}`;
    card.appendChild(lv);
    if (teamMap[entry.uid] !== undefined) {
      const badge = document.createElement('div');
      badge.className = 'te-mon-badge';
      badge.textContent = teamMap[entry.uid] + 1;
      card.appendChild(badge);
    }
    if (BoxSort.attachValue(card, teSort.mode, entry, { monsters: MONSTER_DATA, stats: calcMonsterStats })   // HP順などのとき数値を出す
        || (teLS && teLS.attachLabel(card, mon))) anyVal = true;                                              // リダスキ検索中は倍率を出す
    setupCardTap(card, entry);   // ダブルタップ=編成 / 長押し=詳細
    grid.appendChild(card);
  });
  grid.classList.toggle('has-val', anyVal);
}

let teamEditReturnTo = 'home';

function openTeamEdit() {
  teSetSwapMode(false);
  teamEditReturnTo = 'home';
  activeAttrFilters.clear();
  searchQuery = '';
  if (teLS) teLS.reset();
  document.querySelectorAll('.te-attr-btn').forEach(b => b.classList.remove('active'));
  const inp = document.getElementById('te-search-input');
  if (inp) inp.value = '';
  document.getElementById('team-edit').style.display = 'flex';
  selectedSlotIndex = 0;
  renderTeamEdit();
  startMenuBGM();
}

function openTeamEditFromDungeonEntry() {
  teSetSwapMode(false);
  teamEditReturnTo = 'dungeon-entry';
  activeAttrFilters.clear();
  searchQuery = '';
  if (teLS) teLS.reset();
  document.querySelectorAll('.te-attr-btn').forEach(b => b.classList.remove('active'));
  const inp = document.getElementById('te-search-input');
  if (inp) inp.value = '';
  document.getElementById('dungeon-entry').style.display = 'none';
  document.getElementById('team-edit').style.display = 'flex';
  selectedSlotIndex = 0;
  renderTeamEdit();
  startMenuBGM();
}

function closeTeamEdit(save = true) {
  document.getElementById('team-edit').style.display = 'none';
  if (save) {
    persistTeams();
    const newPartyUids = currentTeam.map(uid => uid);
    for (let i = 0; i < 6; i++) {
      if (i < partyUids.length) partyUids[i] = newPartyUids[i] !== undefined ? newPartyUids[i] : null;
      else partyUids.push(newPartyUids[i] !== undefined ? newPartyUids[i] : null);
    }
    if (document.getElementById('game').style.display === 'flex') {
      renderParty();
      updateLeaderSkill2();
      updatePlayerHP();
    }
  }
  if (teamEditReturnTo === 'dungeon-entry') {
    renderDungeonEntry();
    document.getElementById('dungeon-entry').style.display = 'flex';
  } else {
    document.getElementById('home').style.display = 'flex';
  }
  startMenuBGM();
}

// ============================================================
// 育成画面
// ============================================================
let ikuBaseUid    = null;
let ikuMatUids    = [null, null, null, null, null];
let ikuAttrFilter = new Set();
let ikuSelectMode = 'base';
// 並び替え（js/box-sort.js）。編成中のモンスターは、どの並びでも先頭に出す。合計経験値順は合成画面だけ
const ikuSort = BoxSort.makeState('iku', null, true);
let ikuLS = null;   // リーダースキル検索（js/ls-search.js）
let ikuPrevSortMode = 'acq';   // 「EXP」ボタンをもう一度押したときに戻る並び
// 合成の大成功：素材1体ごとに +3%（5体で15%）で、素材の経験値の合計が2倍
const IKU_GREAT_RATE_PER_MAT = 0.03;
const IKU_GREAT_MULT = 2;

function openIkuScreen() {
  ikuBaseUid = null;
  ikuMatUids = [null,null,null,null,null];
  ikuAttrFilter.clear();
  if (ikuLS) ikuLS.reset();
  document.querySelectorAll('.iku-attr-btn').forEach(b => b.classList.remove('active'));
  ikuSelectMode = 'base';
  document.getElementById('iku-screen').style.display = 'flex';
  renderIkuScreen();
  startMenuBGM();
}
function closeIkuScreen() {
  document.getElementById('iku-screen').style.display = 'none';
  document.getElementById('home').style.display = 'flex';
}

function renderIkuScreen() {
  renderIkuBaseSlot();
  renderIkuMatSlots();
  renderIkuGrid();
  updateIkuGasshoBtn();
  updateIkuPreview();
}

// ★ 合成に必要なエナ（素材1体ごと。ベースのレアリティで決まる）★
//   ★1〜2 = 10 / ★3 = 20 / ★4 = 30 / ★5 = 50 / ★6以上 = 100
function ikuCostPerMat(baseMon) {
  const r = Number(baseMon && baseMon.rarity) || 1;
  if (r <= 2) return 10;
  if (r === 3) return 20;
  if (r === 4) return 30;
  if (r === 5) return 50;
  return 100;
}
// 実際に素材になる体数（編成中・存在しないものは数えない。doGassho と同じ条件）
function ikuValidMatCount() {
  let n = 0;
  for (const uid of ikuMatUids) {
    if (uid === null) continue;
    const m = box.find(b => b.uid === uid);
    if (!m || currentTeam.includes(uid)) continue;
    n++;
  }
  return n;
}
function calcIkuCost() {
  const baseEntry = box.find(b => b.uid === ikuBaseUid);
  if (!baseEntry) return 0;
  return ikuValidMatCount() * ikuCostPerMat(MONSTER_DATA[baseEntry.monsterId]);
}

// 素材にしたときの経験値（ベースと同じ属性なら1.5倍）。baseMon が無いときは属性ボーナスなし
//   calcIkuGain / doGassho / 一覧の「合計経験値」表示で共通
function ikuMatExp(matEntry, baseMon) {
  const mm = MONSTER_DATA[matEntry.monsterId];
  if (!mm) return 0;
  let exp = mm.baseExp * matEntry.level;
  if (baseMon && mm.attr === baseMon.attr) exp = Math.floor(exp * 1.5);
  return exp;
}
// 大成功の確率（有効な素材の数 × 3%）
function calcIkuGreatRate() {
  return Math.min(1, ikuValidMatCount() * IKU_GREAT_RATE_PER_MAT);
}

// 合成で得られる経験値と、上がるレベルの見込み（doGassho と同じ計算。大成功の2倍は含まない）
function calcIkuGain() {
  const baseEntry = box.find(b => b.uid === ikuBaseUid);
  if (!baseEntry) return null;
  const baseMon = MONSTER_DATA[baseEntry.monsterId];
  let gain = 0;
  for (const uid of ikuMatUids) {
    if (uid === null) continue;
    const m = box.find(b => b.uid === uid);
    if (!m || currentTeam.includes(uid)) continue;
    gain += ikuMatExp(m, baseMon);
  }
  const maxLv = getMonsterMaxLevel(baseMon);
  let lv = baseEntry.level;
  const total = (baseEntry.exp || 0) + gain;
  while (lv < maxLv && total >= EXP_CUMULATIVE[lv]) lv++;
  return { gain, fromLv: baseEntry.level, toLv: lv, maxLv, total, baseEntry };
}

function updateIkuPreview() {
  const expEl = document.getElementById('iku-preview-exp');
  const lvEl = document.getElementById('iku-preview-lv');
  const gainBar = document.getElementById('iku-exp-bar-gain');
  const fillBar = document.getElementById('iku-exp-bar-fill');
  const hasMat = ikuMatUids.some(u => u !== null);
  // 合成の道すじ（ベース → 素材）を、入っている素材ぶん点灯
  document.querySelectorAll('.iku-spoke').forEach(sp => {
    sp.classList.toggle('lit', ikuMatUids[+sp.dataset.mat] !== null);
  });
  const g = calcIkuGain();
  // 大成功の確率（ベースを選んだら表示。素材1体ごとに +3%）
  const greatEl = document.getElementById('iku-great-rate');
  if (greatEl) {
    if (g) {
      const pct = Math.round(calcIkuGreatRate() * 100);
      greatEl.textContent = `大成功 ${pct}%`;
      greatEl.classList.toggle('on', pct > 0);
    } else {
      greatEl.textContent = '';
      greatEl.classList.remove('on');
    }
  }
  if (!g) {
    expEl.textContent = ''; lvEl.textContent = '';
    if (gainBar) gainBar.style.width = '0%';
    return;
  }
  if (!hasMat) {
    expEl.textContent = ''; lvEl.textContent = '';
    if (gainBar) gainBar.style.width = '0%';
    return;
  }
  expEl.textContent = `合計 +${g.gain.toLocaleString()} EXP`;
  lvEl.textContent = g.toLv > g.fromLv ? `Lv ${g.fromLv} → ${g.toLv}` : (g.toLv >= g.maxLv ? 'Lv MAX' : 'レベルは変わらず');
  // バーに見込みぶんを重ねる（次のレベルを超えるなら満タン）
  if (gainBar && g.fromLv < g.maxLv) {
    const thisLvExp = EXP_CUMULATIVE[g.fromLv - 1];
    const nextLvExp = EXP_CUMULATIVE[g.fromLv];
    const cur = (g.baseEntry.exp || 0);
    const span = Math.max(1, nextLvExp - thisLvExp);
    const after = Math.min(1, (cur + g.gain - thisLvExp) / span);
    gainBar.style.width = Math.max(0, after * 100) + '%';
  }
}

function renderIkuBaseSlot() {
  const slot = document.getElementById('iku-base-slot');
  const nameEl = document.getElementById('iku-base-name');
  const detailEl = document.getElementById('iku-base-detail-txt');
  const expFill = document.getElementById('iku-exp-bar-fill');
  const expText = document.getElementById('iku-exp-text');

  slot.innerHTML = '';
  if (ikuBaseUid !== null) {
    const entry = box.find(b => b.uid === ikuBaseUid);
    if (entry) {
      const mon = MONSTER_DATA[entry.monsterId];
      slot.classList.add('has-mon');
      const img = document.createElement('img');
      img.src = monsterImg(mon);
      img.onerror = () => img.style.display='none';
      slot.appendChild(img);
      const lv = document.createElement('div');
      lv.className = 'slot-lv';
      lv.textContent = `Lv.${entry.level}`;
      slot.appendChild(lv);
      const bx = document.createElement('div');
      bx.className = 'slot-x';
      bx.textContent = '✕';
      slot.appendChild(bx);
      nameEl.textContent = mon.name;
      nameEl.style.color = '';
      const maxLvB = getMonsterMaxLevel(mon);
      detailEl.textContent = `No.${mon.id}  ${mon.type}  Lv.${entry.level} / ${maxLvB}`;
      const curExp = entry.exp || 0;
      if (entry.level >= maxLvB) {
        expFill.style.width = '100%';
        expText.textContent = `Lv MAX`;
      } else {
        const thisLvExp = EXP_CUMULATIVE[entry.level - 1];
        const nextLvExp = EXP_CUMULATIVE[entry.level];
        const ratio = nextLvExp > thisLvExp ? (curExp - thisLvExp) / (nextLvExp - thisLvExp) * 100 : 100;
        expFill.style.width = Math.min(100, Math.max(0, ratio)) + '%';
        expText.textContent = `EXP ${(curExp - thisLvExp).toLocaleString()} / ${(nextLvExp - thisLvExp).toLocaleString()}`;
      }
    }
  } else {
    slot.classList.remove('has-mon');
    const emp = document.createElement('span');
    emp.className = 'slot-empty';
    emp.textContent = '＋';
    slot.appendChild(emp);
    nameEl.textContent = 'ベースを選択';
    nameEl.style.color = 'var(--ink-3)';
    detailEl.textContent = '';
    expFill.style.width = '0%';
    expText.textContent = 'EXP 0 / ---';
  }
}

function renderIkuMatSlots() {
  for (let i = 0; i < 5; i++) {
    const slot = document.querySelector(`.iku-mat-slot[data-mat="${i}"]`);
    slot.innerHTML = '';
    const uid = ikuMatUids[i];
    if (uid !== null) {
      const entry = box.find(b => b.uid === uid);
      if (entry) {
        const mon = MONSTER_DATA[entry.monsterId];
        slot.classList.add('has-mon');
        const img = document.createElement('img');
        img.src = monsterImg(mon);
        img.onerror = () => img.style.display='none';
        slot.appendChild(img);
        const lv = document.createElement('div');
        lv.className = 'slot-lv';
        lv.textContent = `Lv${entry.level}`;
        slot.appendChild(lv);
        const x = document.createElement('div');
        x.className = 'slot-x';
        x.textContent = '✕';
        x.addEventListener('click', (e) => {
          e.stopPropagation();
          ikuMatUids[i] = null;
          renderIkuScreen();
        });
        slot.appendChild(x);
      }
    } else {
      slot.classList.remove('has-mon');
      const emp = document.createElement('span');
      emp.className = 'slot-empty-icon';
      emp.textContent = '＋';
      slot.appendChild(emp);
    }
  }
}

function renderIkuGrid() {
  const grid = document.getElementById('iku-monster-grid');
  grid.innerHTML = '';

  const filtered = box.filter(entry => {
    const mon = MONSTER_DATA[entry.monsterId];
    if (!mon) return false;
    if (ikuAttrFilter.size > 0 && !ikuAttrFilter.has(mon.attr)) return false;
    if (ikuLS && !ikuLS.match(mon)) return false;   // リーダースキル検索
    return true;
  });

  // 並び替え：今のチームのモンスターが先頭 → その中でも、外でも、選んだ並び順。
  //   合計経験値は「このモンスターを素材にしたときの経験値」。ベースを選んでいれば同属性ボーナス(×1.5)込み
  const baseEntryForSort = ikuBaseUid !== null ? box.find(b => b.uid === ikuBaseUid) : null;
  const baseMonForSort = baseEntryForSort ? MONSTER_DATA[baseEntryForSort.monsterId] : null;
  const sortCtx = {
    monsters: MONSTER_DATA, stats: calcMonsterStats,
    teamUids: currentTeam,
    expOf: e => ikuMatExp(e, baseMonForSort)
  };
  const sorted = BoxSort.sort(filtered, ikuSort, sortCtx);
  detailListOrder['iku-screen'] = sorted.map(e => e.uid);   // ステータス画面の左右ボタンは、この並び順で巡回する
  let anyVal = false;

  sorted.forEach(entry => {
    const mon = MONSTER_DATA[entry.monsterId];
    const card = document.createElement('div');
    card.className = 'iku-mon-card';
    card.dataset.attr = mon.attr;
    if (currentTeam.includes(entry.uid)) card.dataset.team = '1';   // 編成中の印

    const isBase = entry.uid === ikuBaseUid;
    const matIdx = ikuMatUids.indexOf(entry.uid);
    if (isBase) card.classList.add('as-base');
    else if (matIdx !== -1) {
      card.classList.add('as-mat');
      const badge = document.createElement('div');
      badge.className = 'iku-mat-num';
      badge.textContent = matIdx + 1;
      card.appendChild(badge);
    }

    const img = document.createElement('img');
    img.className = 'iku-mon-img';
    img.src = monsterImg(mon);
    img.onerror = () => img.style.display='none';
    card.appendChild(img);

    const lv = document.createElement('div');
    lv.className = 'iku-mon-lv';
    lv.textContent = `Lv.${entry.level}`;
    card.appendChild(lv);

    if (BoxSort.attachValue(card, ikuSort.mode, entry, sortCtx)   // HP順・合計経験値順などのとき数値を出す
        || (ikuLS && ikuLS.attachLabel(card, mon))) anyVal = true;  // リダスキ検索中は倍率を出す

    // 素材を選ぶ段階では、編成中のモンスターは選べない（薄く表示）
    const inTeam = currentTeam.includes(entry.uid);
    if (inTeam && ikuBaseUid !== null && !isBase) card.classList.add('locked');

    card.addEventListener('click', () => {
      syncIkuSelectMode();
      // ベースをもう一度タップすると、ベースから解除
      if (entry.uid === ikuBaseUid) {
        ikuBaseUid = null;
        ikuSelectMode = 'base';
        renderIkuScreen();
        return;
      }
      if (ikuSelectMode === 'base') {
        const matI = ikuMatUids.indexOf(entry.uid);
        if (matI !== -1) ikuMatUids[matI] = null;
        ikuBaseUid = entry.uid;
        ikuSelectMode = 'mat';
      } else {
        const alreadyMat = ikuMatUids.indexOf(entry.uid);
        if (alreadyMat !== -1) {
          ikuMatUids[alreadyMat] = null;
        } else {
          if (currentTeam.includes(entry.uid)) return;   // 編成中は素材にできない
          const emptyIdx = ikuMatUids.indexOf(null);
          if (emptyIdx !== -1) ikuMatUids[emptyIdx] = entry.uid;
        }
      }
      renderIkuScreen();
    });

    addLongPress(card, () => {
      const idx = box.indexOf(entry);
      openMonsterDetail(idx, 'iku-screen');
    });

    grid.appendChild(card);
  });
  grid.classList.toggle('has-val', anyVal);
  updateIkuSortUI();
}

// 並び替えボタン / 「EXP」ボタンの表示を、今の並びに合わせる
function updateIkuSortUI() {
  const lbl = document.getElementById('iku-sort-label');
  if (lbl) lbl.textContent = BoxSort.buttonLabel(ikuSort);
  const eb = document.getElementById('iku-expsort-btn');
  if (eb) {
    const on = ikuSort.mode === 'exp';
    eb.classList.toggle('active', on);
    eb.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

function updateIkuGasshoBtn() {
  const btn = document.getElementById('iku-gassho-btn');
  const hasMat = ikuMatUids.some(u => u !== null);
  const cost = calcIkuCost();
  btn.disabled = !(ikuBaseUid !== null && hasMat && playerCoin >= cost);   // エナが足りない時は押せない
  // ボタンに必要エナを表示（足りない時は赤）
  const cw = document.getElementById('iku-gassho-costwrap'), cn = document.getElementById('iku-gassho-cost');
  if (cn) cn.textContent = cost.toLocaleString();
  if (cw) { cw.style.visibility = cost > 0 ? 'visible' : 'hidden'; cw.classList.toggle('short', playerCoin < cost); }
  updateIkuCoin();
}
// 合成画面の所持エナ表示（ホームと同じ値）
function updateIkuCoin() {
  const el = document.getElementById('iku-coin-num');
  if (!el) return;
  const t = playerCoin.toLocaleString();
  el.textContent = t;
  el.dataset.len = String(t.length);
}

function doGassho() {
  if (ikuBaseUid === null) return;
  const baseEntry = box.find(b => b.uid === ikuBaseUid);
  if (!baseEntry) return;
  const baseMon = MONSTER_DATA[baseEntry.monsterId];

  // エナ消費（素材1体ごと）。足りなければ合成しない
  const cost = calcIkuCost();
  if (cost <= 0) return;   // 有効な素材がない
  if (playerCoin < cost) { updateIkuGasshoBtn(); updateIkuPreview(); return; }

  let totalExp = 0;
  const removedUids = [];

  for (const uid of ikuMatUids) {
    if (uid === null) continue;
    const matEntry = box.find(b => b.uid === uid);
    if (!matEntry) continue;
    if (currentTeam.includes(uid)) continue;   // 編成中は素材にしない
    totalExp += ikuMatExp(matEntry, baseMon);
    removedUids.push(uid);
  }
  // ★ 大成功：素材1体ごとに3%（最大5体で15%）。素材の経験値の合計が2倍 ★
  const greatRate = Math.min(1, removedUids.length * IKU_GREAT_RATE_PER_MAT);
  const isGreat = removedUids.length > 0 && Math.random() < greatRate;
  if (isGreat) totalExp *= IKU_GREAT_MULT;

  addPlayerCoin(-cost);   // エナを支払う
  updateIkuCoin();
  if (!baseEntry.exp) baseEntry.exp = 0;
  const prevLevel = baseEntry.level;
  baseEntry.exp += totalExp;
  const baseMon2 = MONSTER_DATA[baseEntry.monsterId];
  const maxLv = getMonsterMaxLevel(baseMon2);
  while (baseEntry.level < maxLv) {
    const neededCumul = EXP_CUMULATIVE[baseEntry.level];
    if (baseEntry.exp >= neededCumul) baseEntry.level++;
    else break;
  }
  if (baseEntry.level >= maxLv) baseEntry.exp = Math.min(baseEntry.exp, EXP_CUMULATIVE[maxLv - 1]);
  const newLevel = baseEntry.level;

  for (const uid of removedUids) {
    const idx = box.findIndex(b => b.uid === uid);
    if (idx !== -1) box.splice(idx, 1);
  }
  // 素材にしたモンスターが編成に残らないようにする（空き枠にする）
  purgeUidsFromTeams(removedUids);
  saveGame();
  _hpCache.key = '';

  document.getElementById('iku-result-exp').textContent = `+${totalExp.toLocaleString()} EXP 獲得！`;
  // 大成功のときは見た目を変えて知らせる
  const resBox = document.getElementById('iku-result-box');
  resBox.classList.toggle('great', isGreat);
  document.getElementById('iku-result-title').textContent = isGreat ? '大成功！' : '合成完了';
  const greatEl = document.getElementById('iku-result-great');
  greatEl.textContent = isGreat ? `経験値が${IKU_GREAT_MULT}倍になった！` : '';
  if (isGreat) playSE('attackup');
  const lvEl = document.getElementById('iku-result-lv');
  if (newLevel > prevLevel) { lvEl.textContent = `Lv ${prevLevel} → Lv ${newLevel}`; playSE('levelup'); }
  else lvEl.textContent = '';
  const slvEl = document.getElementById('iku-result-skill');
  if (slvEl) slvEl.textContent = `消費エナ ${cost.toLocaleString()}`;
  document.getElementById('iku-result-overlay').style.display = 'flex';

  ikuMatUids = [null,null,null,null,null];
  ikuBaseUid = null;
}

function syncIkuSelectMode() {
  ikuSelectMode = ikuBaseUid === null ? 'base' : 'mat';
}

// ============================================================
// モンスター詳細画面
// ============================================================
const ATTR_TO_IMG = { fire:'1', water:'2', wood:'3', light:'4', dark:'5', heal:'6' };
let detailBoxIndex = 0;
let detailFromScreen = 'team-edit';
let detailFromList = false;        // ボックス一覧のカードから開いた（→ 左右ボタンは一覧の並び順で巡回）
const detailListOrder = {};        // 画面ごとの「いま一覧に出ている並び順」(uidの配列)

function openMonsterDetail(boxIdx, fromScreen, fromList) {
  detailBoxIndex = boxIdx;
  detailFromScreen = fromScreen || 'team-edit';
  detailFromList = (fromList !== undefined) ? !!fromList : (detailFromScreen === 'iku-screen');
  renderMonsterDetail();
  document.getElementById('monster-detail').style.display = 'flex';
}
function closeMonsterDetail() {
  document.getElementById('monster-detail').style.display = 'none';
  if (detailFromScreen === 'iku-screen') renderIkuScreen();
  if (detailFromScreen === 'team-edit') renderTeamEdit();
  if (detailFromScreen === 'dungeon-entry') { try { renderDungeonEntry(); } catch (e) {} }
}

function renderMonsterDetail() {
  const entry = box[detailBoxIndex];
  if (!entry) return;
  const mon = MONSTER_DATA[entry.monsterId];
  if (!mon) return;
  const img = document.getElementById('md-monster-img');
  const placeholder = document.getElementById('md-img-placeholder');
  // 詳細画面の大きな画像は m1.png → mp1.png（sm1.png → smp1.png）
  img.src = monsterImg(mon).replace(/(m)(\d+\.png)$/, '$1p$2');
  img.style.display = 'block';
  img.onerror = () => { img.style.display = 'none'; placeholder.style.display = 'block'; };
  img.onload = () => { placeholder.style.display = 'none'; };
  placeholder.style.display = 'none';
  document.getElementById('monster-detail').dataset.attr = mon.attr;
  document.getElementById('md-attr-icons').dataset.attr = mon.attr;
  document.getElementById('md-no').textContent = `No.${String(mon.id).padStart(3,'0')}`;
  document.getElementById('md-stars').textContent = '★'.repeat(mon.rarity);
  const attrEl = document.getElementById('md-attr-icons');
  attrEl.innerHTML = '';
  const aImg = document.createElement('img');
  aImg.className = 'md-attr-icon';
  aImg.src = `${ATTR_TO_IMG[mon.attr] || '1'}.png`;
  aImg.alt = mon.attr;
  aImg.onerror = () => { aImg.style.display = 'none'; };
  attrEl.appendChild(aImg);
  document.getElementById('md-name').textContent = mon.name;
  const maxLvD = getMonsterMaxLevel(mon);
  document.getElementById('md-level').textContent = `Lv${entry.level} / ${maxLvD}`;
  const curExpD = entry.exp || 0;
  const expBarEl = document.getElementById('md-exp-bar');
  if (entry.level >= maxLvD) {
    document.getElementById('md-exp-text').textContent = 'Lv MAX';
    if (expBarEl) expBarEl.style.width = '100%';
  } else {
    const thisLvE = EXP_CUMULATIVE[entry.level - 1];
    const nextLvE = EXP_CUMULATIVE[entry.level];
    const ratioE = nextLvE > thisLvE ? (curExpD - thisLvE) / (nextLvE - thisLvE) * 100 : 100;
    if (expBarEl) expBarEl.style.width = Math.min(100, Math.max(0, ratioE)) + '%';
    document.getElementById('md-exp-text').textContent = `${(curExpD - thisLvE).toLocaleString()} / ${(nextLvE - thisLvE).toLocaleString()}`;
  }
  const lvStats = calcMonsterStats(entry);
  const skill = mon.skill;
  const requiredSp = getRequiredSp(entry, mon);
  const skillLabel = document.querySelector('#md-skill-header .md-section-label');
  if (skillLabel) skillLabel.textContent = `スキル：${skill.name}`;
  document.getElementById('md-skill-turn').textContent = `必要SP ${requiredSp}`;
  const slvRow = document.getElementById('md-skill-lv-row');
  if (slvRow) slvRow.style.display = 'none';
  setSkillText(document.getElementById('md-skill-desc'), skill.desc);
  document.getElementById('md-hp').textContent = lvStats.hp.toLocaleString();
  document.getElementById('md-atk').textContent = lvStats.atk.toLocaleString();
  document.getElementById('md-rec').textContent = lvStats.rec.toLocaleString();
  // タイプはアイコンで名前の右に表示（たいりょく=typ1 / こうげき=typ2 / かいふく=typ3 / バランス=typ4）。他のタイプは文字
  const typeEl = document.getElementById('md-type');
  if (typeEl) {
    const TYPE_ICON = { 'たいりょく': 'typ1', 'こうげき': 'typ2', 'かいふく': 'typ3', '回復': 'typ3', 'バランス': 'typ4' };
    const tf = TYPE_ICON[mon.type];
    typeEl.innerHTML = '';
    typeEl.title = mon.type || '';
    typeEl.classList.remove('as-text');
    const asText = () => { typeEl.innerHTML = ''; typeEl.classList.add('as-text'); typeEl.textContent = mon.type || ''; };
    if (tf) {
      const ti = document.createElement('img');
      ti.className = 'md-type-icon'; ti.alt = mon.type;
      ti.onerror = asText;
      ti.src = `${tf}.png`;
      typeEl.appendChild(ti);
    } else if (mon.type) asText();
  }
  const lsNameEl = document.getElementById('md-ls-name');
  const lsDescEl = document.getElementById('md-ls-desc');
  if (lsNameEl) lsNameEl.textContent = mon.leaderSkill ? mon.leaderSkill.name || '' : '';
  if (lsDescEl) setSkillText(lsDescEl, mon.leaderSkill ? mon.leaderSkill.desc : '---');
  // 進化ボタン（進化先があり、バトル中でないときだけ表示）
  const evoBtn = document.getElementById('md-evolve-btn');
  if (evoBtn) evoBtn.style.display = (detailFromScreen !== 'game' && getEvolutions(entry.monsterId).length) ? '' : 'none';
}

// 左右ボタンの巡回先：パーティー編成中のモンスターを開いているときはパーティー内（空き枠は飛ばす）、
// それ以外（ボックスから開いた／育成画面など）はボックス全体
function getDetailNavList() {
  const cur = box[detailBoxIndex];
  // 一覧（並び替え・絞り込み後）から開いたときは、一覧に見えている順番どおりに巡回する
  if (detailFromList && detailListOrder[detailFromScreen] && cur) {
    const order = detailListOrder[detailFromScreen];
    if (order.includes(cur.uid)) {
      const list = [];
      order.forEach(uid => { const idx = box.findIndex(b => b.uid === uid); if (idx !== -1) list.push(idx); });
      if (list.length) return list;
    }
  }
  if ((detailFromScreen === 'team-edit' || detailFromScreen === 'dungeon-entry') && cur && currentTeam.includes(cur.uid)) {
    const list = [];
    currentTeam.forEach(uid => {
      if (uid === null || uid === undefined) return;
      const idx = box.findIndex(b => b.uid === uid);
      if (idx !== -1) list.push(idx);
    });
    if (list.length) return list;
  }
  return box.map((_, i) => i);
}
function stepMonsterDetail(dir) {
  const list = getDetailNavList();
  if (!list.length) return;
  const pos = list.indexOf(detailBoxIndex);
  const nextPos = pos === -1 ? 0 : (pos + dir + list.length) % list.length;
  detailBoxIndex = list[nextPos];
  renderMonsterDetail();
}
document.getElementById('md-prev').addEventListener('click', () => stepMonsterDetail(-1));
document.getElementById('md-next').addEventListener('click', () => stepMonsterDetail(1));
document.getElementById('md-back-btn').addEventListener('click', closeMonsterDetail);
document.getElementById('md-levelup-btn').addEventListener('click', () => {
  const entry = box[detailBoxIndex];
  if (!entry) return;
  ikuBaseUid = entry.uid;
  ikuMatUids = [null,null,null,null,null];
  ikuAttrFilter.clear();
  if (ikuLS) ikuLS.reset();
  document.querySelectorAll('.iku-attr-btn').forEach(b => b.classList.remove('active'));
  ikuSelectMode = 'mat';
  document.getElementById('monster-detail').style.display = 'none';
  document.getElementById('iku-screen').style.display = 'flex';
  renderIkuScreen();
  startMenuBGM();
});

// ============================================================
// ★ 進化 ★
//   データ: 進化先・素材は js/data/monsters.js の evolutions / アイテムは js/data/items.js
// ============================================================
const itemInventory = Object.assign({}, INITIAL_ITEMS);
if (_saved && _saved.items && typeof _saved.items === 'object') {
  for (const k in _saved.items) { const n = Number(_saved.items[k]); if (Number.isFinite(n) && n >= 0) itemInventory[k] = n; }
}
// メールの「受け取り済み / 既読」を復元
if (_saved && _saved.mail) {
  MAIL_DATA.forEach(m => { const sm = _saved.mail[m.id]; if (sm) { m.received = !!sm.received; m.unread = !!sm.unread; } });
}
function getItemCount(id) { return itemInventory[id] || 0; }
function getEvolutions(monsterId) { const m = MONSTER_DATA[monsterId]; return ((m && m.evolutions) || []).filter(e => MONSTER_DATA[e.to]); }
// 進化に必要なLv：最大Lvが75以下なら最大Lv、75を超えるなら75
const EVO_REQUIRED_LV_CAP = 75;
function evoRequiredLevel(monsterId) {
  const mon = MONSTER_DATA[monsterId];
  return Math.min(getMonsterMaxLevel(mon), EVO_REQUIRED_LV_CAP);
}
function hasEvoLevel(entry) {
  return !!entry && entry.level >= evoRequiredLevel(entry.monsterId);
}
function hasEvoMaterials(evo) {
  return evo.materials.every(m => getItemCount(m.item) >= m.count);
}
// 進化に使うエナ：進化させたいモンスター（進化前）のレア度で決まる  ★1=100 / ★2=200 / ★3=300 / ★4以上=500
function evoCoinCost(monsterId) {
  const mon = MONSTER_DATA[monsterId];
  const r = Math.max(1, Number(mon && mon.rarity) || 1);
  if (r >= 4) return 500;
  return r * 100;
}
function hasEvoCoin(entry) {
  return !!entry && playerCoin >= evoCoinCost(entry.monsterId);
}
function canEvolve(evo, entry) {
  return hasEvoMaterials(evo) && hasEvoLevel(entry) && hasEvoCoin(entry);
}

let evoEntryUid = null;
let evoIndex = 0;

let evoFromScreen = 'detail';   // 'detail' | 'iku'
function openEvoScreen() {
  openEvoScreenFor(box[detailBoxIndex], 'detail');
}
function openEvoScreenFor(entry, from) {
  if (!entry || !getEvolutions(entry.monsterId).length) return;
  evoFromScreen = from || 'detail';
  evoEntryUid = entry.uid;
  evoIndex = 0;
  renderEvoScreen();
  document.getElementById('evo-result').style.display = 'none';
  document.getElementById('evo-screen').style.display = 'flex';
}
function closeEvoScreen() {
  document.getElementById('evo-screen').style.display = 'none';
}

function setEvoImg(imgEl, mon) {
  imgEl.style.display = 'block';
  imgEl.onerror = () => { imgEl.style.display = 'none'; };
  imgEl.src = monsterImg(mon);
}
// 進化後の演出用画像：mp{id}.png（無ければ通常の画像）
function setEvoMpImg(imgEl, mon) {
  imgEl.style.display = 'block';
  let fell = false;
  imgEl.onerror = () => { if (!fell) { fell = true; imgEl.src = monsterImg(mon); } else imgEl.style.display = 'none'; };
  imgEl.src = `mp${mon.id}.png`;
}
function evoMaxStats(monsterId) {
  const mon = MONSTER_DATA[monsterId];
  return calcMonsterStats({ monsterId, level: getMonsterMaxLevel(mon) });
}

function renderEvoScreen() {
  const entry = box.find(b => b.uid === evoEntryUid);
  if (!entry) { closeEvoScreen(); return; }
  const evos = getEvolutions(entry.monsterId);
  if (!evos.length) { closeEvoScreen(); return; }
  if (evoIndex >= evos.length) evoIndex = 0;
  const evo = evos[evoIndex];
  const fromMon = MONSTER_DATA[entry.monsterId];
  const toMon = MONSTER_DATA[evo.to];

  // 分岐進化の選択ボタン
  const branch = document.getElementById('evo-branch');
  branch.innerHTML = '';
  if (evos.length > 1) {
    evos.forEach((ev, i) => {
      const b = document.createElement('button');
      b.className = 'evo-branch-btn' + (i === evoIndex ? ' active' : '');
      b.textContent = MONSTER_DATA[ev.to].name;
      b.addEventListener('click', () => { evoIndex = i; renderEvoScreen(); });
      branch.appendChild(b);
    });
    branch.style.display = 'flex';
  } else {
    branch.style.display = 'none';
  }

  // 進化前 → 進化後
  setEvoImg(document.getElementById('evo-from-img'), fromMon);
  setEvoImg(document.getElementById('evo-to-img'), toMon);
  document.getElementById('evo-from-name').textContent = fromMon.name;
  document.getElementById('evo-to-name').textContent = toMon.name;
  document.getElementById('evo-from-sub').textContent = `Lv${entry.level} / ${'★'.repeat(fromMon.rarity)}`;
  document.getElementById('evo-to-sub').textContent = `Lv1 / ${'★'.repeat(toMon.rarity)}`;

  // 素材
  const matEl = document.getElementById('evo-materials');
  matEl.innerHTML = '';
  evo.materials.forEach(m => {
    const item = ITEM_DATA[m.item] || { name: m.item, img: '' };
    const have = getItemCount(m.item);
    const ok = have >= m.count;
    const row = document.createElement('div');
    row.className = 'evo-mat-row' + (ok ? '' : ' short');
    row.innerHTML =
      `<img class="evo-mat-icon" src="${item.img}" onerror="this.style.visibility='hidden'" alt="">` +
      `<span class="evo-mat-name">${item.name}</span>` +
      `<span class="evo-mat-right"><span class="evo-mat-count"><b>${have}</b> / ${m.count}</span>` +
      `<button type="button" class="evo-mat-detail">詳細</button></span>`;
    row.querySelector('.evo-mat-detail').addEventListener('click', (e) => { e.stopPropagation(); openChipSpots(m.item); });
    matEl.appendChild(row);
  });

  // 必要エナ（進化前のレア度で決まる）
  const costEl = document.getElementById('evo-cost');
  if (costEl) {
    const cost = evoCoinCost(entry.monsterId);
    const coinOk = playerCoin >= cost;
    costEl.className = 'evo-mat-row evo-cost-row' + (coinOk ? '' : ' short');
    costEl.innerHTML =
      `<img class="evo-mat-icon" src="hcoin.png" onerror="this.style.visibility='hidden'" alt="">` +
      `<span class="evo-mat-name">エナ</span>` +
      `<span class="evo-mat-right"><span class="evo-mat-count"><b>${playerCoin.toLocaleString()}</b> / ${cost.toLocaleString()}</span></span>`;
  }

  // 進化後の最大ステータス
  const st = evoMaxStats(evo.to);
  document.getElementById('evo-stats').innerHTML =
    `<span>Lv${getMonsterMaxLevel(toMon)}時</span>` +
    `<span>HP <b>${st.hp.toLocaleString()}</b></span>` +
    `<span>攻撃 <b>${st.atk.toLocaleString()}</b></span>` +
    `<span>回復 <b>${st.rec.toLocaleString()}</b></span>`;

  const btn = document.getElementById('evo-exec-btn');
  const lvOk = hasEvoLevel(entry);
  const matOk = hasEvoMaterials(evo);
  const coinOk2 = hasEvoCoin(entry);
  btn.disabled = !(lvOk && matOk && coinOk2);
  btn.textContent = !lvOk ? `Lv${evoRequiredLevel(entry.monsterId)}まで育てると進化できます`
                  : (!matOk ? '素材が足りません'
                  : (!coinOk2 ? 'エナが足りません' : '進化させる'));
}

// ============================================================
// ★ チップの入手場所（進化画面の素材「詳細」）★
//   DUNGEON_DATA の敵データ（drops）を調べて、チップごとに
//     ・メイン：エリアごとに「落ちる最初のステージ」を1つ  例）ハジマリ草原-1
//     ・イベント：月〜日曜ダンジョンだけ、曜日ごとに最初のステージを1つ
//   を一覧にする。ダンジョンデータを編集すると自動で反映される（保存データは使わない）。
// ============================================================
let _chipSpotIndex = null;
function stageOrd(k) { return /^\d+$/.test(k) ? Number(k) : (k === 'boss' ? 1e9 : 1e6); }
// チップが落ちる敵を探して、アイテムIDを found に入れる
function collectChipDrops(node, found) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(n => collectChipDrops(n, found)); return; }
  if (Array.isArray(node.drops)) node.drops.forEach(d => { if (d && d.item && !(Number(d.rate) <= 0)) found.add(d.item); });
  for (const k in node) { const v = node[k]; if (v && typeof v === 'object') collectChipDrops(v, found); }
}
// モンスターが落ちる敵を探して、モンスターIDを found に入れる（図鑑の「入手場所」用）
//   敵のドロップ設定は、戦闘中の判定（②モンスターのドロップ）と同じ決まり：
//     monsterDrop.enabled が false なら落ちない ／ rate が 0 以下なら落ちない
//     monsterDrop.monsterId があればそのモンスター、なければ敵画像（mpXX.png）と同じID
function collectMonsterDrops(node, found) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(n => collectMonsterDrops(n, found)); return; }
  if (typeof node.img === 'string' && node.hp !== undefined) {   // 敵データ
    const md = node.monsterDrop || {};
    let rate = md.rate;
    if (rate === undefined) rate = node.name === 'mp11' ? 0.30 : 0.10;
    if (md.enabled !== false && Number(rate) > 0) {
      let id = parseInt(md.monsterId);
      if (!id) { const m = node.img.match(/mp(\d+)\.png/); id = m ? parseInt(m[1]) : 0; }
      if (id && MONSTER_DATA[id]) found.add(id);
    }
  }
  for (const k in node) {
    if (k === 'intrusion') continue;   // 乱入で出るモンスターは入手場所に書かない
    const v = node[k]; if (v && typeof v === 'object') collectMonsterDrops(v, found);
  }
}
function buildChipSpotIndex() { return buildDropSpotIndex(collectChipDrops); }
let _monSpotIndex = null;
function buildDropSpotIndex(collect) {
  const idx = {};   // 品物ID -> { main: { エリア番号: ステージ }, daily: { 曜日(0=日): { area, stage } } }
  Object.keys(DUNGEON_DATA).forEach(key => {
    const i = key.lastIndexOf('-'); if (i < 0) return;
    const area = key.slice(0, i), stage = key.slice(i + 1);
    const found = new Set(); collect(DUNGEON_DATA[key], found);
    if (!found.size) return;
    let dow = -1;
    if (isEventArea(area)) {
      dow = dailyDowOf(area);
      if (dow < 0 && EVENT_INFO[area].weekday != null) dow = Number(EVENT_INFO[area].weekday);
      if (!(dow >= 0 && dow <= 6)) {                // けいけんパークなど、曜日ダンジョン以外のイベント
        if (EVENT_INFO[area].hidden) return;
        found.forEach(item => {
          const e = idx[item] || (idx[item] = { main: {}, daily: {} });
          const ev = e.events || (e.events = {});
          const cur = ev[area];
          if (cur === undefined || stageOrd(stage) < stageOrd(cur)) ev[area] = stage;
        });
        return;
      }
    } else if (!/^\d+$/.test(area)) return;
    found.forEach(item => {
      const e = idx[item] || (idx[item] = { main: {}, daily: {} });
      if (dow >= 0) {
        const cur = e.daily[dow];
        if (!cur || stageOrd(stage) < stageOrd(cur.stage)) e.daily[dow] = { area, stage };
      } else {
        const n = Number(area), cur = e.main[n];
        if (cur === undefined || stageOrd(stage) < stageOrd(cur)) e.main[n] = stage;
      }
    });
  });
  return idx;
}
// そのステージにいま入れるか（エリア開放済み＆前のステージをクリア済み）。入れないものは一覧に出さない
function chipSpotEnterable(area, stageKey) {
  const stages = getStageList(area);
  const i = stages.findIndex(st => st.key === stageKey);
  if (i < 0) return false;
  return i === 0 || isStageCleared(area, stages[i - 1].key);
}
function getChipSpots(itemId) {
  if (!_chipSpotIndex) _chipSpotIndex = buildChipSpotIndex();
  return dropSpotsOf(_chipSpotIndex[itemId]);
}
// 図鑑：そのモンスターが落ちるステージ（まだ入れないステージ・エリア・曜日ダンジョンは出さない。チップの入手場所と同じ決まり）
function getMonsterSpots(monsterId) {
  if (!_monSpotIndex) _monSpotIndex = buildDropSpotIndex(collectMonsterDrops);
  return dropSpotsOf(_monSpotIndex[monsterId]);
}
function dropSpotsOf(e) {
  const out = { main: [], daily: [], events: [] };
  if (!e) return out;
  Object.keys(e.main).map(Number).sort((a, b) => a - b).forEach(n => {
    const st = e.main[n];
    if (!isAreaUnlocked(n) || !chipSpotEnterable(n, st)) return;   // まだ開放していないエリア/ステージは出さない
    out.main.push({ label: `${areaNameOf(n)}-${st === 'boss' ? 'BOSS' : st}`, area: n, stage: st, canJump: true, tag: '' });
  });
  if (isEventUnlocked()) {
    Object.keys(e.events || {}).forEach(a => {   // けいけんパークなど（曜日のないイベント）
      const st = e.events[a];
      if (!chipSpotEnterable(a, st)) return;
      out.events.push({ label: `${areaNameOf(a)}-${st === 'boss' ? 'BOSS' : st}`, area: a, stage: st, canJump: true, tag: '' });
    });
    const today = todayDow();
    Object.keys(e.daily).map(Number).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).forEach(d => {   // 月→日の順
      const v = e.daily[d];
      if (!chipSpotEnterable(v.area, v.stage)) return;
      out.daily.push({ label: `${'日月火水木金土'[d]}曜ダンジョン-${v.stage === 'boss' ? 'BOSS' : v.stage}`, area: v.area, stage: v.stage,
        canJump: d === today, tag: d === today ? '' : `${'日月火水木金土'[d]}曜のみ` });
    });
  }
  return out;
}
function openChipSpots(itemId) {
  const item = ITEM_DATA[itemId] || { name: itemId, img: '' };
  const img = document.getElementById('cs-item-img');
  img.src = item.img || ''; img.style.visibility = item.img ? 'visible' : 'hidden';
  document.getElementById('cs-item-name').textContent = item.name;
  const spots = getChipSpots(itemId);
  const list = document.getElementById('cs-list');
  list.innerHTML = '';
  const section = (title, arr) => {
    if (!arr.length) return;
    const h = document.createElement('div'); h.className = 'cs-head'; h.textContent = title; list.appendChild(h);
    arr.forEach(sp => {
      const r = document.createElement(sp.canJump ? 'button' : 'div');
      r.className = 'cs-spot' + (sp.canJump ? ' go' : ' off');
      if (sp.canJump) r.type = 'button';
      const t = document.createElement('span'); t.className = 'cs-spot-name'; t.textContent = sp.label; r.appendChild(t);
      if (sp.tag) { const tag = document.createElement('span'); tag.className = 'cs-tag'; tag.textContent = sp.tag; r.appendChild(tag); }
      if (sp.canJump) {
        r.insertAdjacentHTML('beforeend', '<svg class="ic cs-chev"><use href="#i-chev"/></svg>');
        r.addEventListener('click', () => askChipJump(sp));
      }
      list.appendChild(r);
    });
  };
  section('メインステージ', spots.main);
  section('曜日ダンジョン', spots.daily);
  if (!spots.main.length && !spots.daily.length) {
    const em = document.createElement('div'); em.className = 'cs-empty'; em.textContent = 'いまのところ入手できる場所がありません'; list.appendChild(em);
  }
  list.scrollTop = 0;
  document.getElementById('chip-spots').style.display = 'flex';
}
function closeChipSpots() { document.getElementById('chip-spots').style.display = 'none'; }
document.getElementById('cs-close').addEventListener('click', closeChipSpots);
// 入手場所をタップ → 確認ダイアログ → 「移動する」でそのダンジョンのパーティ確認画面へ
let _chipJumpTarget = null;
function askChipJump(sp) {
  _chipJumpTarget = sp;
  document.getElementById('cj-desc').innerHTML = `「${sp.label}」へ移動します。<br>いまの画面は閉じます。`;
  document.getElementById('chip-jump').style.display = 'flex';
}
function closeChipJump() { document.getElementById('chip-jump').style.display = 'none'; }
function doChipJump() {
  const sp = _chipJumpTarget; _chipJumpTarget = null;
  closeChipJump(); closeChipSpots();
  if (!sp) return;
  // 進化・BOX・編成などの画面を閉じてから、ダンジョン画面へ（戻るボタンで、そのエリアのステージ選択→ホームへ戻れるようにしておく）
  document.querySelectorAll('.ui-screen').forEach(el => { el.style.display = 'none'; });
  currentAreaNum = sp.area;
  applyAreaBackground('stage-select', sp.area);
  renderStageSelect();
  openDungeonEntry(sp.area, sp.stage);
}
document.getElementById('cj-no').addEventListener('click', () => { _chipJumpTarget = null; closeChipJump(); });
document.getElementById('cj-yes').addEventListener('click', doChipJump);
document.getElementById('chip-spots').addEventListener('click', (e) => { if (e.target.id === 'chip-spots') closeChipSpots(); });

function executeEvolution() {
  const entry = box.find(b => b.uid === evoEntryUid);
  if (!entry) return;
  const evos = getEvolutions(entry.monsterId);
  const evo = evos[evoIndex];
  if (!evo || !canEvolve(evo, entry)) return;
  const fromMon = MONSTER_DATA[entry.monsterId];
  const toMon = MONSTER_DATA[evo.to];

  // 素材とエナを消費 → 本体を進化後に差し替え（+値・uid は引き継ぐ。Lvは1に戻る）
  evo.materials.forEach(m => { itemInventory[m.item] -= m.count; });
  addPlayerCoin(-evoCoinCost(entry.monsterId));   // 進化前のレア度に応じたエナ（★1=100 ★2=200 ★3=300 ★4以上=500）
  entry.monsterId = evo.to;
  entry.level = 1;
  entry.exp = 0;
  entry.sp = 0;
  entry.memory = 0;
  saveGame();
  _hpCache.key = '';   // パーティHPのキャッシュを破棄

  // 演出
  setEvoMpImg(document.getElementById('evo-result-img'), toMon);   // 進化後の mp{id}.png
  document.getElementById('evo-result-text').textContent = `${fromMon.name} は ${toMon.name} に進化した！`;
  const res = document.getElementById('evo-result');
  res.style.display = 'flex';
  res.classList.remove('play'); void res.offsetWidth; res.classList.add('play');
}

document.getElementById('md-evolve-btn').addEventListener('click', openEvoScreen);
document.getElementById('evo-back-btn').addEventListener('click', closeEvoScreen);
// 「進化させる」→ まず進化パズル画面へ（完成したら js/evo-puzzle.js が executeEvolution() を呼ぶ）
document.getElementById('evo-exec-btn').addEventListener('click', () => { if (typeof startEvoPuzzle === 'function') startEvoPuzzle(); else executeEvolution(); });
document.getElementById('evo-result-ok').addEventListener('click', () => {
  document.getElementById('evo-result').style.display = 'none';
  closeEvoScreen();
  if (evoFromScreen === 'iku') renderIkuScreen();
  else if (evoFromScreen === 'list') renderEvoList();
  else renderMonsterDetail();
});
// ---- ホーム →「進化」：進化できるモンスターの一覧 ----
// 進化の一覧の並び替え（js/box-sort.js）。編成中のモンスターは、どの並びでも先頭
const evoSort = BoxSort.makeState('evo', BoxSort.MODES.map(m => m.id).filter(id => id !== 'exp'), true);
let evoLS = null;   // リーダースキル検索（js/ls-search.js）
function renderEvoList() {
  const grid = document.getElementById('evo-list-grid');
  const emptyEl = document.getElementById('evo-list-empty');
  grid.innerHTML = '';
  const lbl = document.getElementById('evo-sort-label');
  if (lbl) lbl.textContent = BoxSort.buttonLabel(evoSort);
  const evoAll = box.filter(e => MONSTER_DATA[e.monsterId] && getEvolutions(e.monsterId).length);
  const list = evoLS && evoLS.active() ? evoAll.filter(e => evoLS.match(MONSTER_DATA[e.monsterId])) : evoAll;   // リーダースキル検索
  emptyEl.textContent = evoAll.length && !list.length ? '条件に合うモンスターがいません' : '進化できるモンスターがいません';
  emptyEl.style.display = list.length ? 'none' : 'block';
  const sortCtx = { monsters: MONSTER_DATA, stats: calcMonsterStats, teamUids: currentTeam };
  let anyVal = false;
  BoxSort.sort(list, evoSort, sortCtx).forEach(entry => {
    const mon = MONSTER_DATA[entry.monsterId];
    const card = document.createElement('div');
    card.className = 'iku-mon-card' + (getEvolutions(entry.monsterId).some(ev => canEvolve(ev, entry)) ? ' evo-ready' : '')
                   + (currentTeam.includes(entry.uid) ? ' in-team' : '');
    card.dataset.attr = mon.attr;
    const img = document.createElement('img');
    img.className = 'iku-mon-img';
    img.src = monsterImg(mon);
    img.alt = mon.name;
    img.onerror = () => { img.style.display = 'none'; };
    card.appendChild(img);
    const lv = document.createElement('div');
    lv.className = 'iku-mon-lv';
    lv.textContent = `Lv.${entry.level}`;
    card.appendChild(lv);
    if (BoxSort.attachValue(card, evoSort.mode, entry, sortCtx)
        || (evoLS && evoLS.attachLabel(card, mon))) anyVal = true;   // リダスキ検索中は倍率を出す
    card.addEventListener('click', () => openEvoScreenFor(entry, 'list'));
    grid.appendChild(card);
  });
  grid.classList.toggle('has-val', anyVal);
}
function openEvoList() {
  if (evoLS) evoLS.reset();
  renderEvoList();
  document.getElementById('evo-list-screen').style.display = 'flex';
  startMenuBGM();
}
document.getElementById('btn-evo').addEventListener('click', openEvoList);
evoLS = LSSearch.mount({
  key: 'evo', host: document.getElementById('evo-list-screen'),
  before: document.getElementById('evo-sort-btn'), after: document.getElementById('evo-list-hint'),
  candidates: () => box.filter(e => MONSTER_DATA[e.monsterId] && getEvolutions(e.monsterId).length).map(e => MONSTER_DATA[e.monsterId]),
  onChange: () => { const wrap = document.getElementById('evo-list-box'); if (wrap) wrap.scrollTop = 0; renderEvoList(); }
});
document.getElementById('evo-sort-btn').addEventListener('click', () => {
  BoxSort.openSheet(document.getElementById('evo-list-screen'), evoSort, () => {
    const wrap = document.getElementById('evo-list-box'); if (wrap) wrap.scrollTop = 0;
    renderEvoList();
  });
});
document.getElementById('evo-list-back').addEventListener('click', () => {
  document.getElementById('evo-list-screen').style.display = 'none';
});

let _lpTimer = null;
let _longPressTriggered = false;
function addLongPress(el, callback, ms) {
  ms = ms || 350;   // 長押し判定（以前は500）
  let _lpStartX = 0, _lpStartY = 0;
  const start = (e) => {
    e.stopPropagation();
    _longPressTriggered = false;
    const t = e.touches ? e.touches[0] : e;
    _lpStartX = t.clientX; _lpStartY = t.clientY;
    _lpTimer = setTimeout(() => { _longPressTriggered = true; callback(); }, ms);
  };
  const move = (e) => {
    const t = e.touches ? e.touches[0] : e;
    const dx = Math.abs(t.clientX - _lpStartX);
    const dy = Math.abs(t.clientY - _lpStartY);
    if (dx > 10 || dy > 10) clearTimeout(_lpTimer);
  };
  const cancel = () => clearTimeout(_lpTimer);
  el.addEventListener('touchstart', start, {passive:true});
  el.addEventListener('touchmove', move, {passive:true});
  el.addEventListener('touchend', cancel);
  el.addEventListener('mousedown', start);
  el.addEventListener('mousemove', move);
  el.addEventListener('mouseup', cancel);
  el.addEventListener('mouseleave', cancel);
}

document.querySelectorAll('.te-attr-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const attr = btn.dataset.attr;
    if (activeAttrFilters.has(attr)) { activeAttrFilters.delete(attr); btn.classList.remove('active'); }
    else { activeAttrFilters.add(attr); btn.classList.add('active'); }
    renderTeMonsterGrid();
  });
});
document.getElementById('te-search-input').addEventListener('input', e => {
  searchQuery = e.target.value;
  renderTeMonsterGrid();
});
document.getElementById('te-search-clear').addEventListener('click', () => {
  searchQuery = '';
  document.getElementById('te-search-input').value = '';
  renderTeMonsterGrid();
});
document.getElementById('te-back').addEventListener('click', () => closeTeamEdit(true));
document.getElementById('te-swap-btn').addEventListener('click', () => { teSetSwapMode(!teSwapMode); renderTeamEdit(); });
document.getElementById('te-sort-label').textContent = BoxSort.buttonLabel(teSort);
teLS = LSSearch.mount({
  key: 'te', host: document.getElementById('team-edit'),
  before: document.getElementById('te-sort-btn'), after: document.getElementById('te-tools'),
  candidates: () => box.map(e => MONSTER_DATA[e.monsterId]).filter(Boolean),
  onChange: () => { const wrap = document.getElementById('te-box-wrap'); if (wrap) wrap.scrollTop = 0; renderTeMonsterGrid(); }
});
document.getElementById('te-sort-btn').addEventListener('click', () => {
  BoxSort.openSheet(document.getElementById('team-edit'), teSort, () => {
    document.getElementById('te-sort-label').textContent = BoxSort.buttonLabel(teSort);
    const wrap = document.getElementById('te-box-wrap'); if (wrap) wrap.scrollTop = 0;
    renderTeMonsterGrid();
  });
});
document.getElementById('te-help-btn').addEventListener('click', () => document.getElementById('te-help-sheet').classList.add('show'));
document.getElementById('te-help-close').addEventListener('click', () => document.getElementById('te-help-sheet').classList.remove('show'));
document.getElementById('te-help-sheet').addEventListener('click', (e) => { if (e.target.id === 'te-help-sheet') e.target.classList.remove('show'); });
document.getElementById('te-reset-btn').addEventListener('click', () => {
  currentTeam = [null,null,null,null,null,null];   // 今のパーティーだけ空にする
  selectedSlotIndex = 0;
  renderTeamEdit();
});

// パーティー切り替え（矢印ボタン / 左右スワイプ）
document.querySelectorAll('.team-nav .tn-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTeam(parseInt(btn.dataset.dir, 10)));
});
attachTeamSwipe(document.getElementById('te-party-area'), t => teSwapMode && t.closest && t.closest('.te-party-slot'));
attachTeamSwipe(document.getElementById('de-team-panel'), t => t.closest && t.closest('.btn, .team-nav'));
updateTeamNavLabels();

// ============================================================
// ゲームコア
// ============================================================
const ROWS = 5, COLS = 6;
const TYPES = ['fire','water','wood','light','dark','heal'];
let grid = [], orbEls = [];
// ── お邪魔ドロップ ──
// 'ojama' は本家と同じ「攻撃力のないドロップ」。3つ以上つなげると消え、コンボには数えるが、どの属性の攻撃にもならない。
// 動かす・入れ替える・落下するのは普通のドロップと同じ。敵スキル board_change の to:'ojama'、味方スキルの to/attr:'ojama' で盤面に現れる。
// 不要になったら：board_change／orbChange系の 'ojama'、css の .orb.ojama、editor の ORB/ATTRS を消せばOK。
// ── 暗闇ギミック ──
// blindCells[r][c] === true のマスのドロップは見えない（?マーク表示）。
//  ・ドロップを「持った」だけでは消えない。実際に動かして入れ替わったドロップだけ暗闇が解ける。
//  ・消えたドロップ／新しく落ちてきたドロップ／スキルで変換されたドロップは暗闇ではない。
let blindCells = [];
// 直前のプレイヤーのターン（消した結果）。敵の攻撃時の「ダメージ軽減」条件の判定に使う
let lastTurnCtx = null;
function defenseCtx(enemy) {
  const b = lastTurnCtx || { comboCount: 0, exact4Count: 0, orbCounts: {}, crossCount: 0, crossAttrs: {}, lAttrs: {}, poisonCount: 0, fireCombos: 0, lShapes: 0,
    darkCombos: 0, healCombos: 0, attrCombos: {}, hasWaterConnect5: false, hasDarkConnect5: false, maxConnect: {}, exactAttrCounts: {},
    remainingOrbs: undefined, skillUsed: false };
  return { ...b, attr: 'none', enemyAttr: enemy ? enemy.attr : 'dark', hpRatio: playerCurrentHP / Math.max(1, playerMaxHP) };
}
// ============================================================
// ★ リーダースキルのダメージ軽減：発動演出（kei.mp3）＋HPバー右端のマーク ★
// ============================================================
let lsGuardRate = 0;   // いま発動している軽減の合計（0〜1）
function lsAllEffects() {
  const list = [];
  [0, 5].forEach(idx => {
    if (partyUids.length > idx && partyUids[idx] !== null) {
      const e = box.find(b => b.uid === partyUids[idx]);
      const m = e && MONSTER_DATA[e.monsterId];
      if (m && m.leaderSkill && m.leaderSkill.effects) list.push(...m.leaderSkill.effects);
    }
  });
  return list;
}
function lsGuardTotal(effects, ctx) {
  const res = applyLeaderEffects(effects, ctx);
  let keep = 1;
  if (res.dmgReduction) for (const r of res.dmgReduction) keep *= (1 - r);
  return 1 - keep;
}
function setLsGuardBadge(rate, pop) {
  const el = document.getElementById('ls-guard');
  if (!el) return;
  const pct = Math.floor(rate * 100 + 1e-9);   // 小数点切り捨て
  if (pct <= 0) { el.classList.remove('on', 'pop'); return; }
  const t = document.getElementById('ls-guard-pct');
  if (t) t.textContent = pct + '%';
  el.classList.add('on');
  if (pop) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
}
function resetLsGuard() { lsGuardRate = 0; setLsGuardBadge(0); }
// 軽減が発動した場所（消したドロップ）に「ガードした」演出を出し、kei.mp3 を鳴らす
//   エネルギーの盾が展開 → 光がスッと走る → 衝撃波とスパークで弾く
function lsGuardFx(cells) {
  playSE('kei');
  try {
    const gridEl = document.getElementById('grid');
    if (!gridEl) return;
    const rect = gridEl.getBoundingClientRect();
    let x, y;
    if (cells && cells.length) {
      const ar = cells.reduce((q, w) => q + w.r, 0) / cells.length;
      const ac = cells.reduce((q, w) => q + w.c, 0) / cells.length;
      x = rect.left + (ac + 0.5) * rect.width / COLS;
      y = rect.top + (ar + 0.5) * rect.height / ROWS;
    } else { x = rect.left + rect.width / 2; y = rect.top + rect.height / 2; }
    const root = document.createElement('div');
    root.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:0;height:0;z-index:260;pointer-events:none;`;
    document.body.appendChild(root);
    const uid = 'lsg' + Math.floor(Math.random() * 1e9);
    const W = 92, H = 101;
    // 盾（エネルギーバリア）：六角形の模様＋光の帯が走る
    const shield = document.createElement('div');
    shield.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform:translate(-50%,-50%);`;
    shield.innerHTML = `
      <svg viewBox="0 0 100 110" width="${W}" height="${H}" style="overflow:visible;display:block">
        <defs>
          <clipPath id="${uid}c"><path d="M50 4 L92 16 V52 C92 78 72 98 50 107 C28 98 8 78 8 52 V16 Z"/></clipPath>
          <linearGradient id="${uid}f" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#e8f6ff" stop-opacity="0.85"/>
            <stop offset="0.55" stop-color="#6ab8ff" stop-opacity="0.5"/>
            <stop offset="1" stop-color="#2a6fe0" stop-opacity="0.65"/>
          </linearGradient>
          <linearGradient id="${uid}s" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#fff" stop-opacity="0"/>
            <stop offset="0.5" stop-color="#fff" stop-opacity="0.95"/>
            <stop offset="1" stop-color="#fff" stop-opacity="0"/>
          </linearGradient>
          <pattern id="${uid}h" width="14" height="12" patternUnits="userSpaceOnUse" patternTransform="scale(1)">
            <path d="M3.5 0 L10.5 0 L14 6 L10.5 12 L3.5 12 L0 6 Z" fill="none" stroke="#dff2ff" stroke-opacity="0.55" stroke-width="0.9"/>
          </pattern>
        </defs>
        <path d="M50 4 L92 16 V52 C92 78 72 98 50 107 C28 98 8 78 8 52 V16 Z" fill="url(#${uid}f)"/>
        <g clip-path="url(#${uid}c)">
          <rect x="0" y="0" width="100" height="110" fill="url(#${uid}h)"/>
          <rect class="sw" x="-50" y="-10" width="38" height="130" fill="url(#${uid}s)" transform="skewX(-18)"/>
        </g>
        <path d="M50 4 L92 16 V52 C92 78 72 98 50 107 C28 98 8 78 8 52 V16 Z" fill="none" stroke="#f2fbff" stroke-width="4" stroke-linejoin="round"/>
        <path d="M50 4 L92 16 V52 C92 78 72 98 50 107 C28 98 8 78 8 52 V16 Z" fill="none" stroke="#5db4ff" stroke-width="1.6" stroke-linejoin="round" transform="translate(0,0)" opacity="0.9"/>
        <path d="M50 14 L82 23 V51 C82 71 67 87 50 95 C33 87 18 71 18 51 V23 Z" fill="none" stroke="#ffffff" stroke-opacity="0.7" stroke-width="1.4"/>
      </svg>`;
    shield.style.filter = 'drop-shadow(0 0 10px rgba(110,190,255,0.95)) drop-shadow(0 0 22px rgba(80,150,255,0.7))';
    root.appendChild(shield);
    shield.animate([
      { transform: 'translate(-50%,-50%) scale(1.7)', opacity: 0, filter: 'brightness(3) drop-shadow(0 0 22px #fff)', offset: 0 },
      { transform: 'translate(-50%,-50%) scale(0.92)', opacity: 1, filter: 'brightness(2.2) drop-shadow(0 0 18px #bfe3ff)', offset: 0.22 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, filter: 'brightness(1.2) drop-shadow(0 0 10px #6ab8ff)', offset: 0.4 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.7 },
      { transform: 'translate(-50%,-50%) scale(1.14)', opacity: 0, offset: 1 }
    ], { duration: 820, easing: 'ease-out', fill: 'forwards' });
    const sw = shield.querySelector('.sw');
    if (sw && sw.animate) sw.animate([{ transform: 'skewX(-18deg) translateX(0px)' }, { transform: 'skewX(-18deg) translateX(190px)' }], { duration: 520, delay: 180, easing: 'ease-in-out', fill: 'both' });

    // 衝撃波（攻撃を受け止めた瞬間）
    [0, 90].forEach((dl, i) => {
      const ring = document.createElement('div');
      ring.style.cssText = `position:absolute;left:0;top:0;width:100px;height:100px;border-radius:50%;border:${i ? 2 : 3}px solid rgba(190,228,255,0.95);box-shadow:0 0 14px rgba(110,190,255,0.9),inset 0 0 10px rgba(150,210,255,0.6);transform:translate(-50%,-50%) scale(0.3);opacity:0;`;
      root.appendChild(ring);
      ring.animate([{ transform: 'translate(-50%,-50%) scale(0.3)', opacity: 0.95 }, { transform: 'translate(-50%,-50%) scale(1.9)', opacity: 0 }], { duration: 520, delay: 150 + dl, easing: 'ease-out', fill: 'both' });
    });
    // 受け止めた中心の閃光（十字のきらめき）
    const star = document.createElement('div');
    star.style.cssText = 'position:absolute;left:0;top:0;width:70px;height:70px;transform:translate(-50%,-50%);opacity:0;background:radial-gradient(circle, #fff 0 12%, rgba(190,230,255,0.9) 22%, transparent 60%),linear-gradient(#fff,#fff) center/100% 3px no-repeat,linear-gradient(#fff,#fff) center/3px 100% no-repeat;filter:drop-shadow(0 0 8px #9fd4ff);';
    root.appendChild(star);
    star.animate([
      { transform: 'translate(-50%,-50%) scale(0.2) rotate(0deg)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(1.15) rotate(20deg)', opacity: 1, offset: 0.35 },
      { transform: 'translate(-50%,-50%) scale(0.7) rotate(45deg)', opacity: 0 }
    ], { duration: 420, delay: 160, easing: 'ease-out', fill: 'both' });
    // 弾かれた火花（盾に当たって外へ飛ぶ）
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + Math.random() * 0.4, d = 46 + Math.random() * 34;
      const len = 10 + Math.random() * 10;
      const sp = document.createElement('div');
      sp.style.cssText = `position:absolute;left:0;top:0;width:${len}px;height:2px;border-radius:1px;background:linear-gradient(90deg,transparent,#fff);box-shadow:0 0 6px #8fd0ff;opacity:0;transform:translate(-50%,-50%) rotate(${a}rad);`;
      root.appendChild(sp);
      sp.animate([
        { transform: `translate(-50%,-50%) rotate(${a}rad) translateX(14px)`, opacity: 1 },
        { transform: `translate(-50%,-50%) rotate(${a}rad) translateX(${d}px)`, opacity: 0 }
      ], { duration: 380 + Math.random() * 220, delay: 170, easing: 'cubic-bezier(.1,.7,.3,1)', fill: 'both' });
    }
    setTimeout(() => root.remove(), 1100);
  } catch (e) {}
}
// 軽減率が増えたら（発動）演出つきで、変わらなければ何もせず、減ったら表示だけ更新する
function checkLsGuard(effects, ctx, cells) {
  const rate = lsGuardTotal(effects, ctx);
  if (rate > lsGuardRate + 1e-9) {
    lsGuardRate = rate;
    setLsGuardBadge(rate, true);
    lsGuardFx(cells);
  } else if (rate < lsGuardRate - 1e-9) {
    lsGuardRate = rate;
    setLsGuardBadge(rate, false);
  }
}
function setBlindEl(r, c) {
  const el = orbEls[r] && orbEls[r][c];
  if (!el) return;
  if (blindCells[r] && blindCells[r][c] && grid[r] && grid[r][c]) el.dataset.blind = '1';
  else delete el.dataset.blind;
}
function revealBlind(r, c) {
  if (blindCells[r]) blindCells[r][c] = false;
  setBlindEl(r, c);
}
function clearBlindAll() {
  blindCells = Array.from({length:ROWS}, () => Array(COLS).fill(false));
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) setBlindEl(r, c);
}
function blindBoard() {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    blindCells[r][c] = !!grid[r][c];
    setBlindEl(r, c);
  }
}
// ============================================================
// ★ ルーレットギミック ★
//   敵スキル { type:'roulette', count:3, turn:3, sec:2 }
//     盤面のランダムなマスに「ルーレット」を count 個つくる（turn ターン続く）。
//     ルーレットのマスのドロップは、時計の針が1周するたび（sec 秒＝2/1/0.5/0.2）に
//     火→水→木→光→闇→回復→火… の順に変化する。（位置は固定。消して新しく降ってきたドロップも変化する）
//   ・すでに盤面にルーレットがある時に新しく生成すると、今あるルーレットは全て消えて新しいものに置き換わる。
//   ・敵の演出中／消している最中／時を止めている間は針が止まる。
//   ・いま指で掴んでいるドロップは、針が1周しても手を離すまで変化しない。
//   不要になったらこのブロックと、'roulette' を書いた箇所（case／fxRoulette／各clear）を消せばOK。
// ============================================================
const ROULETTE_SEQ = ['fire', 'water', 'wood', 'light', 'dark', 'heal'];
const ROULETTE_SECS = [2, 1, 0.5, 0.2];
let roulettes = [];          // { r, c, turns, period(ms), t(ms), el(上の飾り), elB(下の石タイル) }
let _rlRaf = null, _rlLast = 0;
let _rlHold = false;         // 指を離してから判定が始まるまでの一瞬は針を止める（盤面が勝手に変わらないように）
function rouletteLayer() {
  const wrap = document.getElementById('grid-wrap');
  if (!wrap) return null;
  let L = document.getElementById('roulette-layer');
  if (!L) { L = document.createElement('div'); L.id = 'roulette-layer'; wrap.appendChild(L); }
  return L;
}
// ドロップより下に敷く、石のタイル用のレイヤー（#grid より前に置く＝ドロップの背面になる）
function rouletteBackLayer() {
  const wrap = document.getElementById('grid-wrap');
  if (!wrap) return null;
  let B = document.getElementById('roulette-back');
  if (!B) { B = document.createElement('div'); B.id = 'roulette-back'; wrap.insertBefore(B, wrap.firstChild); }
  return B;
}
function renderRoulette(o) {
  const k = Math.max(0, Math.min(1, o.t / o.period));
  const p = (k * 100).toFixed(2) + '%', d = (k * 360).toFixed(2) + 'deg';
  for (const e of [o.el, o.elB]) { if (!e) continue; e.style.setProperty('--p', p); e.style.setProperty('--deg', d); }
}
function spawnRoulettes(count, turns, sec) {
  const L = rouletteLayer(), B = rouletteBackLayer();
  if (!L || !B) return;
  const s = ROULETTE_SECS.includes(Number(sec)) ? Number(sec) : 2;
  playSE('roo');   // ルーレット生成音（roo.mp3）：敵・味方どちらのスキルでもここで鳴る
  clearRoulettes();   // 盤面にルーレットがある時は（敵・味方どちらのスキルでも）全部リセットして、新しいルーレットで上書きする
  const used = new Set(roulettes.map(o => o.r * COLS + o.c));
  const cells = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!used.has(r * COLS + c)) cells.push([r, c]);
  cells.sort(() => Math.random() - 0.5);
  const n = Math.max(0, Math.min(cells.length, Math.floor(count) || 0));
  for (let i = 0; i < n; i++) {
    const [r, c] = cells[i];
    const el = document.createElement('div');
    el.className = 'rl spawn';
    el.style.gridRow = String(r + 1);
    el.style.gridColumn = String(c + 1);
    el.innerHTML = '<i class="rl-sweep"></i><i class="rl-ring"></i><b class="rl-turn"></b>';
    L.appendChild(el);
    const elB = document.createElement('div');   // ドロップの下に敷く石のタイル
    elB.className = 'rlb spawn';
    elB.style.gridRow = String(r + 1);
    elB.style.gridColumn = String(c + 1);
    elB.innerHTML = '<i class="rl-sweep-b"></i>';
    B.appendChild(elB);
    const o = { r, c, turns: Math.max(1, Math.floor(turns) || 1), period: s * 1000, t: 0, el, elB };
    el.querySelector('.rl-turn').textContent = o.turns;
    roulettes.push(o);
    renderRoulette(o);
  }
  startRouletteLoop();
}
function startRouletteLoop() {
  if (_rlRaf || !roulettes.length) return;
  _rlLast = performance.now();
  _rlRaf = requestAnimationFrame(rouletteLoop);
}
function rouletteStep(o, steps) {
  const cur = grid[o.r] && grid[o.r][o.c];
  if (!cur) return;
  const i = ROULETTE_SEQ.indexOf(cur);   // 毒などの順番にない色は、火から始める
  const nxt = ROULETTE_SEQ[(i + steps + 6) % 6];
  grid[o.r][o.c] = nxt;
  const el = orbEls[o.r] && orbEls[o.r][o.c];
  if (el) el.className = 'orb ' + nxt + (el.classList.contains('dragging') ? ' dragging' : '');
  if (grabSnapshot !== null && !grabMoved) grabSnapshot = gridSnapshot();   // 掴んだだけの時、ルーレットの変化で「動かした」扱いにならないように
}
function rouletteLoop(now) {
  _rlRaf = null;
  if (!roulettes.length) return;
  const dt = Math.min(250, now - _rlLast);
  _rlLast = now;
  if (!busy && !timeStopActive && !_rlHold) {
    for (const o of roulettes) {
      o.t += dt;
      if (o.t >= o.period) {
        if (dragging && dragR === o.r && dragC === o.c) o.t = o.period;   // 掴んでいる間は満タンのまま待つ
        else {
          const steps = Math.floor(o.t / o.period);
          o.t -= steps * o.period;
          rouletteStep(o, steps);
        }
      }
      renderRoulette(o);
    }
  }
  _rlRaf = requestAnimationFrame(rouletteLoop);
}
// プレイヤーの1ターンが終わるごとに残りターンを減らす（0になったら消える）
function tickRouletteTurns() {
  for (const o of roulettes) {
    o.turns--;
    const b = o.el.querySelector('.rl-turn');
    if (b) b.textContent = Math.max(0, o.turns);
  }
  const gone = roulettes.filter(o => o.turns <= 0);
  roulettes = roulettes.filter(o => o.turns > 0);
  for (const o of gone) {
    o.el.classList.add('out');
    if (o.elB) o.elB.classList.add('out');
    setTimeout(() => { o.el.remove(); if (o.elB) o.elB.remove(); }, 300);
  }
}
function clearRoulettes() {
  roulettes.forEach(o => { o.el.remove(); if (o.elB) o.elB.remove(); });
  roulettes = [];
  if (_rlRaf) { cancelAnimationFrame(_rlRaf); _rlRaf = null; }
  const L = document.getElementById('roulette-layer');
  if (L) L.innerHTML = '';
  const B = document.getElementById('roulette-back');
  if (B) B.innerHTML = '';
}
let dragging = false, dragR = -1, dragC = -1, dragEl = null;
let lastMoveX = 0, lastMoveY = 0;
let busy = false;
let turn = 1, totalDmg = 0;
let timerRaf = null, timerStart = 0;
let comboChips = [];
let timerStarted = false;
let playerMaxHP = 0, playerCurrentHP = 0;
let damageElements = [];
let isUsingSkill = false;
let skillTargetUid = null;
let skillUsedThisTurn = false;

function updateLeaderSkill2() {
  if (window.MultiShare && MultiShare.remoteView) { MultiShare.paintRemoteLs(); return; }   // マルチ：相手のパーティーを表示中
  let text0 = '（なし）', text1 = '（なし）';
  if (partyUids.length > 0 && partyUids[0] !== null) {
    const e0 = box.find(b => b.uid === partyUids[0]);
    if (e0) { const m0 = MONSTER_DATA[e0.monsterId]; if (m0 && m0.leaderSkill) text0 = m0.leaderSkill.desc || '（なし）'; }
  }
  if (partyUids.length > 5 && partyUids[5] !== null) {
    const e5 = box.find(b => b.uid === partyUids[5]);
    if (e5) { const m5 = MONSTER_DATA[e5.monsterId]; if (m5 && m5.leaderSkill) text1 = m5.leaderSkill.desc || '（なし）'; }
  }
  setLeaderSkillText(0, text0);
  setLeaderSkillText(1, text1);
}
// スキル説明を表示する。「1.2倍」「3%」など数値部分だけ強調（.ls-num）し、スキルが無い枠は薄く表示する
function setLeaderSkillText(i, text) {
  const el = document.getElementById('ls-text-' + i);
  if (!el) return;
  const none = !text || text === '（なし）';
  if (none) el.textContent = '（なし）'; else setSkillText(el, text, true);
  const row = document.getElementById('ls-row-' + i);
  if (row) row.classList.toggle('empty', none);
}

// ============================================================
// スキル関連（パズドラZ風 スキルポイント[SP]システム）
//   ・スキルターン方式は廃止。パーティ全体で共有するSPゲージを新設。
//   ・1コンボごとにメモリが1進み、メモリが5貯まるとSP+1（パーティ共通）。
//   ・スキル発動には必要SP（今回は全モンスター共通1）を消費する。
// ============================================================
const SP_MEMORY_MAX = 5; // このメモリ数が貯まるとSP+1
const SP_CAP = 10; // SPが貯まる上限（本家パズドラZ仕様）
const SKILL_SP_COST = 1; // スキル発動に必要なSP（共通・固定）

let partySp = 0;     // パーティ共有の現在SP
let partyMemory = 0; // パーティ共有の現在メモリ（0〜4）

// 必要SP（スキル発動に必要な最低SP。全モンスター共通で1に固定）
function getRequiredSp(entry, mon) {
  const sp = mon && mon.skill && mon.skill.sp;
  return (typeof sp === 'number' && sp >= 1) ? Math.min(SP_CAP, Math.floor(sp)) : SKILL_SP_COST;
}

// パーティ共有SPにメモリを進める（1コンボ=1メモリ）。
function addMemoryToParty(comboCount) {
  if (!comboCount || comboCount <= 0) return;
  if (partySp >= SP_CAP) return; // 上限まで貯まっていたら進めない
  partyMemory += comboCount;
  while (partyMemory >= SP_MEMORY_MAX) {
    partyMemory -= SP_MEMORY_MAX;
    if (partySp < SP_CAP) partySp++;
    if (partySp >= SP_CAP) { partyMemory = 0; break; }
  }
}

// 共通SPを直接加算（「いっかつ」等のスキル効果用）
function addPartySp(amount) {
  partySp = Math.min(SP_CAP, partySp + (amount || 1));
}

// 今スキルが使えるモンスターの数（SPが足りているメンバー数）。
// この数が増えた瞬間だけ skills.mp3 を鳴らす。
// 例：SP0→1でチーム全員が使用可能になった時に1回、以降SPが増えても鳴らない。
// スキルを使ってSPが足りなくなって下がり、再び使えるようになったらまた鳴る。
let _lastReadySkillCount = 0;
function countReadySkills() {
  let n = 0;
  for (const uid of partyUids) {
    if (uid === null || uid === undefined) continue;
    const entry = box.find(b => b.uid === uid);
    if (!entry) continue;
    const mon = MONSTER_DATA[entry.monsterId];
    if (!mon) continue;
    if (partySp >= getRequiredSp(entry, mon)) n++;
  }
  return isSkillSealed() ? 0 : n;   // スキル使用不可の間は「使える」扱いにしない
}
function checkSkillReadySE() {
  // 「スキルが溜まった」効果音は renderParty() 側で、枠が出て画像が持ち上がる瞬間（＝攻撃が終わったあと）に鳴らす
  _lastReadySkillCount = countReadySkills();
}
let _liftedSkillUids = new Set();   // いま「スキルが溜まって持ち上がっている」モンスターのuid（描き直しても状態を引き継ぐ）

function updateSpGaugeUI() {
  if (window.MultiShare && MultiShare.remoteView) { MultiShare.paintRemoteSp(); return; }   // マルチ：相手のパーティーを表示中
  checkSkillReadySE();
  const bar = document.getElementById('sp-common-bar');
  const countEl = document.getElementById('sp-common-count');
  if (!bar) return;
  bar.innerHTML = '';
  const isReady = partySp >= SKILL_SP_COST;
  for (let i = 0; i < SP_CAP; i++) {
    const seg = document.createElement('div');
    seg.className = 'sp-common-seg';
    if (i < partySp) {
      seg.classList.add('filled');
      if (partySp >= SP_CAP) seg.classList.add('ready');
    }
    bar.appendChild(seg);
  }
  if (countEl) countEl.textContent = `${partySp} / ${SP_CAP}`;
  if (window.MultiShare) MultiShare.fx('sp', { sp: partySp, mem: partyMemory });   // マルチ：相手の画面のSPへ
}

function openSkillConfirm(uid) {
  if (busy || isUsingSkill) return;
  if (isSkillSealed()) { showSkillMessage(`スキル使用不可！（あと${enemySkillSeal.turns}ターン）`, 1100); return; }
  const entry = box.find(b => b.uid === uid);
  if (!entry) return;
  const mon = MONSTER_DATA[entry.monsterId];
  if (!mon) return;
  const requiredSp = getRequiredSp(entry, mon);
  if (partySp < requiredSp) return;

  skillTargetUid = uid;
  document.getElementById('sp-title').textContent = mon.skill.name;
  setSkillText(document.getElementById('sp-desc'), mon.skill.desc);
  document.getElementById('sp-cooldown').textContent = `SP ${partySp} / ${SP_CAP}（消費${requiredSp}）`;
  document.getElementById('skill-confirm').style.display = 'flex';
}

function closeSkillConfirm() {
  document.getElementById('skill-confirm').style.display = 'none';
  skillTargetUid = null;
}

function generateWoodReverseL() {
  const shape = [[0,0],[0,1],[0,2],[1,0],[2,0]];
  for (const [r,c] of shape) {
    if (r < ROWS && c < COLS) {
      grid[r][c] = 'wood'; revealBlind(r, c);
      if (orbEls[r] && orbEls[r][c]) orbEls[r][c].className = 'orb wood';
    }
  }
}

function generateCross(r, c, color) {
  const positions = [[r,c],[r-1,c],[r+1,c],[r,c-1],[r,c+1]];
  for (const [cr, cc] of positions) {
    if (cr >= 0 && cr < ROWS && cc >= 0 && cc < COLS) {
      grid[cr][cc] = color; revealBlind(cr, cc);
      if (orbEls[cr] && orbEls[cr][cc]) orbEls[cr][cc].className = `orb ${color}`;
    }
  }
}

// ============================================================
// ★ アクティブスキル 汎用実行エンジン ★
// モンスターごとの分岐を書かず、MONSTER_DATA[id].skill.effects に
// 効果オブジェクトを並べるだけで新スキルを追加できるようにするための実行部。
// 新しい効果タイプを増やしたい場合は、下の runSkillEffect の switch に
// case を1つ追加するだけでよい。
// ============================================================
function showSkillMessage(text, ms) {
  const el = document.getElementById('combo-label');
  if (!el) return;
  el.textContent = text;
  setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, ms || 1000);
}

// スキル1回の発動中、複数のorbChange系effectが同じ空きマスを取り合わないように
// 共有する「今回すでに使ったマス」の集合。runSkillEffects開始時にリセットする。
let _skillUsedCells = null;

function getEmptyCellsForSkill() {
  let cells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (_skillUsedCells.has(r + '_' + c)) continue;
      if (grid[r][c] === null || grid[r][c] === undefined) cells.push({ r, c });
    }
  }
  if (cells.length === 0) {
    // 空きマスが尽きたら、まだ使っていない全マスから選ぶ（既存仕様を踏襲）
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!_skillUsedCells.has(r + '_' + c)) cells.push({ r, c });
      }
    }
  }
  return cells.sort(() => Math.random() - 0.5);
}

function setOrb(r, c, attr) {
  grid[r][c] = attr; revealBlind(r, c);
  if (orbEls[r] && orbEls[r][c]) orbEls[r][c].className = 'orb ' + attr;
  _skillUsedCells.add(r + '_' + c);
}

function damageAllEnemies(rawDmg, attr, se = 'skilldamage', ignoreDef = false) {
  if (enemyList.some(e => e.hp > 0)) playSE(se);
  const attrMult = (attr && !ignoreDef) ? getAttrMulti(attr, enemyList[0]?.attr || 'dark') : 1;   // 固定ダメージは相性無視
  const finalDmgBase = Math.floor(rawDmg * attrMult);
  const enemyUnits = document.querySelectorAll('#enemy-area .enemy-unit');
  for (let i = 0; i < enemyList.length; i++) {
    const enemy = enemyList[i];
    if (enemy.hp <= 0) continue;
    // 固定ダメージ(ignoreDef)は防御無視。それ以外も最低ダメージ1
    const gm = (attr && !ignoreDef) ? enemyAttrGuardMult(enemy, attr) : 1;   // 属性軽減
    const dmg2 = ignoreDef ? Math.max(1, finalDmgBase) : Math.max(1, Math.floor(finalDmgBase * gm) - getEnemyDef(enemy));
    const dealt = enemyTakeDamage(enemy, dmg2);   // 超根性対応（実際に与えたダメージ）
    if (window.DamageTotal) DamageTotal.add(i, dealt);   // HPバー上の合計ダメージ
    const unit = enemyUnits[i];
    if (unit) {
      const rect = unit.getBoundingClientRect();
      showFloatingDamage(rect.left + rect.width / 2, rect.top + rect.height / 2, dealt, ignoreDef ? undefined : attr, attrMult > 1);
    }
    if (enemy.hp <= 0) tryDrop(enemy);
  }
  updateEnemyUI();
  return finalDmgBase;
}

// 敵単体（生きている先頭の敵）にダメージ
function damageSingleEnemy(rawDmg, attr, se = 'skilldamage', ignoreDef = false) {
  const idx = getTargetIdx();
  if (idx < 0) return 0;
  playSE(se);
  const enemy = enemyList[idx];
  const attrMult = (attr && !ignoreDef) ? getAttrMulti(attr, enemy.attr || 'dark') : 1;   // 固定ダメージは相性無視
  const finalDmgBase = Math.floor(rawDmg * attrMult);
  const gm = (attr && !ignoreDef) ? enemyAttrGuardMult(enemy, attr) : 1;   // 属性軽減
  const dmg2 = ignoreDef ? Math.max(1, finalDmgBase) : Math.max(1, Math.floor(finalDmgBase * gm) - getEnemyDef(enemy));
  const dealt = enemyTakeDamage(enemy, dmg2);   // 超根性対応（実際に与えたダメージ）
  if (window.DamageTotal) DamageTotal.add(idx, dealt);   // HPバー上の合計ダメージ
  const unit = document.querySelectorAll('#enemy-area .enemy-unit')[idx];
  if (unit) {
    const rect = unit.getBoundingClientRect();
    showFloatingDamage(rect.left + rect.width / 2, rect.top + rect.height / 2, dealt, ignoreDef ? undefined : attr, attrMult > 1);
  }
  if (enemy.hp <= 0) tryDrop(enemy);
  updateEnemyUI();
  return finalDmgBase;
}

// 敵の頭上にダメージ数値を大きくポップアップ表示する
function showFloatingDamage(x, y, dmg, attr, weak = false) {
  if (window.DamageNumber) { window.DamageNumber.show(x, y - 10, dmg, attr, weak); return; }   // 太い数字（属性色・弱点は特大）
  const pop = document.createElement('div');
  pop.style.cssText = `position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);font-size:1.3rem;font-weight:900;color:#fff;text-shadow:0 0 6px #000, 0 0 12px #ff4400, 0 2px 4px rgba(0,0,0,0.9);pointer-events:none;z-index:250;white-space:nowrap;animation:skillDmgPop 1s ease-out forwards;`;
  pop.textContent = dmg.toLocaleString();
  document.body.appendChild(pop);
  setTimeout(() => pop.remove(), 1050);
}

// 効果オブジェクト1つを実行する。context には発動元 entry/mon を渡す。
function runSkillEffect(eff, context) {
  switch (eff.type) {
    // ── ダメージ系 ──
    case 'damageAll': { // 敵全体（target:'single' なら敵単体）に固定ダメージ
      if (eff.target === 'single') damageSingleEnemy(eff.value, eff.attr, 'skilldamage', true); else damageAllEnemies(eff.value, eff.attr, 'skilldamage', true);
      if (eff.message) showSkillMessage(eff.message, 1000);
      break;
    }
    case 'atkBuff': { // 属性/タイプ/全員の攻撃を ○ターン ○倍
      const nb = { attr: eff.attr || null, monType: eff.monType || null, value: eff.value || 1, turns: eff.turns || 1 };
      if (!nb.monType) overrideAtkDownByEnhance(nb.attr);   // エンハンスで敵の攻撃力ダウンを上書き
      const same = atkBuffs.find(b => b.attr === nb.attr && b.monType === nb.monType);
      if (same) { same.value = nb.value; same.turns = nb.turns; } else atkBuffs.push(nb);
      renderBuffIcons();
      if (eff.message) showSkillMessage(eff.message, 1000);
      break;
    }
    case 'defenseDown': { // 敵の防御力を ○ターンの間 ○% ダウン（target:'single' なら先頭の敵のみ、それ以外は敵全体）
      const targets = eff.target === 'single' ? [enemyList[getTargetIdx()]] : enemyList.filter(e => e.hp > 0);
      let rate = Number(eff.value) || 0;
      if (rate > 1) rate = rate / 100;                 // 50 と入力された場合も 50% として扱う
      rate = Math.min(1, Math.max(0, rate));
      const turns = Math.max(1, Math.floor(Number(eff.turns) || 1));
      for (const e of targets) {
        if (!e || e._statusShield > 0) continue;       // 状態異常無効中は効かない
        const cur = e.defDown;
        // すでに掛かっている場合は、ダウン率・ターン数とも大きい方を採用
        e.defDown = { value: cur ? Math.max(cur.value, rate) : rate, turns: cur ? Math.max(cur.turns, turns) : turns };
      }
      updateEnemyUI();
      showSkillMessage(eff.message || `🛡️ ${turns}ターン 敵${eff.target === 'single' ? '単体' : '全体'}の防御力${Math.round(rate * 100)}%ダウン！`, 1200);
      break;
    }
    case 'damageSingle': { // 敵単体に固定ダメージ
      damageSingleEnemy(eff.value, eff.attr, 'skilldamage', true);
      if (eff.message) showSkillMessage(eff.message, 1000);
      break;
    }
    case 'damagePartyAtkMult':   // （旧）味方全員の攻撃力合計 × 倍率
    case 'damageSelfAtkMult':    // 自分（スキルを使ったモンスター）の攻撃力 × 倍率
    case 'damageAttrAtkMult': {  // 指定属性（srcAttr）の味方の攻撃力合計 × 倍率
      const atkOf = (e) => (e && MONSTER_DATA[e.monsterId]) ? calcMonsterStats(e).atk : 0;
      let baseAtk = 0, label = '攻撃力';
      if (eff.type === 'damageSelfAtkMult') {
        baseAtk = atkOf(context && context.entry);
      } else {
        const srcAttr = eff.type === 'damageAttrAtkMult' ? eff.srcAttr : null;
        for (const uid of partyUids) {
          if (uid === null) continue;
          const e = box.find(b => b.uid === uid);
          if (!e) continue;
          const m = MONSTER_DATA[e.monsterId];
          if (!m || (srcAttr && m.attr !== srcAttr)) continue;
          baseAtk += atkOf(e);
        }
        label = srcAttr ? '攻撃力' : '攻撃力合計';
      }
      const rawDmg = Math.floor(baseAtk * (eff.value || 1));
      const finalDmg = eff.target === 'single' ? damageSingleEnemy(rawDmg, eff.attr, 'skillk') : damageAllEnemies(rawDmg, eff.attr, 'skillk');
      const enemyFrame = document.querySelector('#enemy-area .enemy-unit');
      if (enemyFrame) {
        const rect = enemyFrame.getBoundingClientRect();
        createHitEffect(rect.left + rect.width / 2, rect.top + rect.height / 2, eff.attr || 'fire');
      }
      showSkillMessage(`🔥 ${label}${baseAtk.toLocaleString()} × ${eff.value || 1}倍 = ${finalDmg.toLocaleString()} ダメージ！`, 1800);
      break;
    }
    case 'damageHalfHp': { // 自分の現在HP半分を消費し、その分のダメージを敵全体へ
      if (playerCurrentHP > 1) {
        const halfHP = Math.floor(playerCurrentHP / 2);
        playerCurrentHP = Math.max(0, playerCurrentHP - halfHP);
        updatePlayerHP();
        damageAllEnemies(halfHP, eff.attr);
      }
      if (eff.message) showSkillMessage(eff.message, 1000);
      break;
    }

    // ── 自傷系 ──
    case 'selfDamage': { // 自分のHPを減らす（mode:'percent'=最大HPの value 割合を減少 / 'toOne'=HPが1になる）。HPは1未満にならない
      const before = playerCurrentHP;
      if (eff.mode === 'toOne') {
        playerCurrentHP = Math.min(playerCurrentHP, 1);
      } else {
        let v = Number(eff.value) || 0;
        if (v > 1) v /= 100;                     // 20 と入力された場合も 20% として扱う
        v = Math.min(1, Math.max(0, v));
        playerCurrentHP = Math.max(1, playerCurrentHP - Math.floor(playerMaxHP * v));
      }
      updatePlayerHP();
      showSkillMessage(eff.message || (eff.mode === 'toOne' ? '🩸 HPが1になった！' : `🩸 HPが${(before - playerCurrentHP).toLocaleString()}減少！`), 1000);
      break;
    }

    // ── ランダム変身 ──
    // 設定したモンスターIDのどれかに変身。そのダンジョン中は変身後の姿（画像・スキル・リーダースキル）になり、
    // ダンジョンが終わる／負ける／リタイアすると必ず元に戻る。レベルは元のモンスターのまま引き継ぐ。
    // （演出はスキル処理のあとで runPendingTransforms が行う）
    case 'transformRandom': {
      const cands = (Array.isArray(eff.ids) ? eff.ids : []).map(Number)
        .filter(id => MONSTER_DATA[id] && id !== (context.entry && context.entry.monsterId));
      if (cands.length && context.entry) _pendingTransforms.push({ entry: context.entry, newId: cands[Math.floor(Math.random() * cands.length)] });
      break;
    }

    // ── 回復系 ──
    case 'heal': { // 自分の最大HPの割合分を回復
      const heal = Math.floor(playerMaxHP * eff.value);
      playerCurrentHP = Math.min(playerMaxHP, playerCurrentHP + heal);
      updatePlayerHP();
      if (eff.message) showSkillMessage(eff.message, 1000);
      break;
    }

    // ── バフ系（効果ごとに個別実装） ──
    // ○ターンの間、ダメージを○%軽減（value は 0〜1。50 のように 1 を超える値は % とみなす）
    case 'dmgReductionBuff': {
      let v = Number(eff.value) || 0;
      if (v > 1) v /= 100;
      v = Math.min(1, Math.max(0, v));
      playSE('bshield');   // 軽減の効果音
      buffDamageReduction = true;
      buffDamageReductionValue = v;
      buffDamageReductionTurns = eff.turns || 1;
      renderBuffIcons();
      if (eff.message) showSkillMessage(eff.message, 1000);
      break;
    }
    // ○ターンの間、回復力が○倍（0なら回復力0）
    case 'recMult': {
      enemyRecDown = null;   // 敵の回復力ダウンを上書き
      buffRecMult = true;
      buffRecMultValue = Math.max(0, Number(eff.value) >= 0 ? Number(eff.value) : 1);
      buffRecMultTurns = eff.turns || 1;
      renderBuffIcons();
      if (eff.message) showSkillMessage(eff.message, 1000);
      break;
    }
    // ○ターンの間、操作時間を○倍＋○秒（倍率<1・秒<0 で短縮）
    case 'moveTimeBuff': {
      const mult = (eff.mult !== undefined && eff.mult !== '' && Number(eff.mult) >= 0) ? Number(eff.mult) : 1;
      const sec = Number(eff.seconds) || 0;
      enemyMoveDown = null;   // 敵の操作時間ダウンを上書き
      if (mult !== 1 || sec !== 0) {
        buffMoveTime = true;
        buffMoveTimeMult = mult;
        buffMoveTimeSec = sec;
        buffMoveTimeTurns = eff.turns || 1;
        currentMoveMs = calcCurrentMoveMs();
      }
      renderBuffIcons();
      if (eff.message) showSkillMessage(eff.message, 1000);
      break;
    }
    // ○ターンの間、全員の攻撃が敵全体に当たる
    case 'allAttackBuff': {
      buffAllAttack = true;
      buffAllAttackTurns = eff.turns || 1;
      renderBuffIcons();
      if (eff.message) showSkillMessage(eff.message, 1000);
      break;
    }

    // ── ドロップ変化系 ──
    case 'orbChangeRow': { // 指定行を単色に変換
      playDropcOnce();
      for (let c = 0; c < COLS; c++) setOrb(eff.row, c, eff.attr);
      if (eff.message) showSkillMessage(eff.message, 1000);
      break;
    }
    case 'orbChangeLine': { // 横(row)/縦(col)の列を、index から count 列ぶん単色に変換
      playDropcOnce();
      const isCol = eff.dir === 'col';
      const max = isCol ? COLS : ROWS;
      const start = Math.max(0, Math.min(max - 1, Math.floor(Number(eff.index) || 0)));
      const cnt = Math.max(1, Math.floor(Number(eff.count) || 1));
      for (let i = start; i < Math.min(max, start + cnt); i++) {
        if (isCol) { for (let r = 0; r < ROWS; r++) setOrb(r, i, eff.attr); }
        else { for (let c = 0; c < COLS; c++) setOrb(i, c, eff.attr); }
      }
      if (eff.message) showSkillMessage(eff.message, 1000);
      break;
    }
    case 'orbChangeReverseL': { // 左上に逆L字を生成
      playDropcOnce();
      const shape = [[0,0],[0,1],[0,2],[1,0],[2,0]];
      for (const [r, c] of shape) if (r < ROWS && c < COLS) setOrb(r, c, eff.attr);
      if (eff.message) showSkillMessage(eff.message, 1000);
      break;
    }
    case 'orbChangeCross': { // 指定座標を中心に十字を生成
      playDropcOnce();
      const positions = [[eff.row, eff.col], [eff.row - 1, eff.col], [eff.row + 1, eff.col], [eff.row, eff.col - 1], [eff.row, eff.col + 1]];
      for (const [r, c] of positions) if (r >= 0 && r < ROWS && c >= 0 && c < COLS) setOrb(r, c, eff.attr);
      if (eff.message) showSkillMessage(eff.message, 1000);
      break;
    }
    case 'orbChangeRandom': { // 空きマス優先でランダムにcount個を指定属性に変換
      playDropcOnce();
      const cells = getEmptyCellsForSkill();
      const n = Math.min(eff.count || 1, cells.length);
      for (let i = 0; i < n; i++) setOrb(cells[i].r, cells[i].c, eff.attr);
      if (eff.message) showSkillMessage(eff.message, 1000);
      break;
    }
    case 'orbChangeAllRandom': { // 盤面全体を指定属性群からランダムに変換
      playDropcOnce();
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const t = eff.attrs[Math.floor(Math.random() * eff.attrs.length)];
        setOrb(r, c, t);
      }
      if (eff.message) showSkillMessage(eff.message, 1000);
      break;
    }
    case 'orbChangeMulti':
    case 'orbChange5ColorHeal': { // 盤面全体を指定した色だけにランダム変換（選んだ各色は必ず3個以上）
      playDropcOnce();
      const ALLK = ['fire','water','wood','light','dark','heal','ojama'];
      let kinds = eff.type === 'orbChange5ColorHeal'
        ? ['fire','water','wood','light','dark','heal']

        : (Array.isArray(eff.orbs) ? eff.orbs.filter(k => ALLK.includes(k)) : ALLK.filter(k => eff['orb_' + k]));
      if (kinds.length === 0) kinds = ['fire'];   // 未選択の保険
      const cells = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) cells.push([r, c]);
      cells.sort(() => Math.random() - 0.5);
      const minEach = Math.min(3, Math.floor(cells.length / kinds.length));
      let ci = 0;
      for (const k of kinds) for (let n = 0; n < minEach; n++) { const [r, c] = cells[ci++]; setOrb(r, c, k); }
      while (ci < cells.length) { const [r, c] = cells[ci++]; setOrb(r, c, kinds[Math.floor(Math.random() * kinds.length)]); }
      if (eff.message) showSkillMessage(eff.message, 1000);
      break;
    }
    case 'orbConvert': { // 盤面上のfrom属性をto属性に一括変換
      playDropcOnce();
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (grid[r][c] === eff.from) setOrb(r, c, eff.to);
      }
      if (eff.message) showSkillMessage(eff.message, 1000);
      break;
    }

    // ── その他 ──
    case 'skillChargeOthers': { // 共通SPを1加算
      addPartySp(1);
      updateSpGaugeUI();
      renderParty();
      if (eff.message) showSkillMessage(eff.message, 1000);
      break;
    }
    case 'enemyDelay': { // 敵全体（target:'single' なら先頭の敵のみ）の行動を指定ターン遅らせる
      const delayTargets = eff.target === 'single' ? [enemyList[getTargetIdx()]].filter(Boolean) : enemyList;
      for (const enemy of delayTargets) {
        if (enemy._statusShield > 0) continue;   // 状態異常無効中は効かない
        if (enemy._delayed) continue;            // 行動遅延アイコン(tien.png)が付いている間は2回目の遅延を無効
        enemy.turnInterval += (eff.turns || 1);
        enemy._delayed = true;                   // 次に行動するまでアイコンを表示
      }
      enemyTurnProgress = 0;
      updateEnemyTurnBadge();
      updateEnemyUI();
      if (eff.message) showSkillMessage(eff.message, 1000);
      break;
    }
    case 'timeStop': { // 時を止める（seconds で秒数指定。省略時は5秒）
      const sec = Number(eff.seconds);
      activateTimeStop(sec > 0 ? sec : 5);
      break;
    }
    case 'bindRecover': { // バインドを○ターン回復（全員のバインド残りターンを減らす）
      const n = Math.max(0, Math.floor(Number(eff.turns) || 1));
      for (const key of Object.keys(bindTimers)) {
        bindTimers[key] -= n;
        if (bindTimers[key] <= 0) delete bindTimers[key];
      }
      updatePlayerHP();   // バインドが解けたぶん最大HPが戻る（現在HPは増えない）
      renderParty();
      renderBuffIcons();
      if (eff.message) showSkillMessage(eff.message, 1000);
      break;
    }
    case 'roulette': { // 味方スキル：○ターンの間、ルーレットを○つ生成（sec: 2=低速 / 1=標準 / 0.5=高速 / 0.2=超高速）
      spawnRoulettes(Number(eff.count) || 1, Number(eff.turns) || 1, Number(eff.sec) || 1);
      if (eff.message) showSkillMessage(eff.message, 1000);
      break;
    }
    case 'note': {
      // 演出のみ・現状ゲーム性に影響しない効果のプレースホルダー
      break;
    }
    default:
      console.warn('未知のスキル効果タイプ:', eff.type);
  }
}

let _dropcPlayed = false;
function playDropcOnce() { if (_dropcPlayed) return; _dropcPlayed = true; playSE('dropc'); }
// ============================================================
// ★ ランダム変身（そのダンジョン中だけ） ★
//   変身中のモンスターは entry.monsterId を変身先に書き換え、元のIDを entry._tfFrom に控える。
//   画像・スキル・リーダースキルは、すべて entry.monsterId から引くので自動で変身先のものになる。
//   レベルは entry.level のまま（変身先の最大レベルを超える分は、能力値の計算で上限に丸められる）。
//   元に戻す（restoreTransforms）タイミング：ホームに戻った時／クリアの経験値を配る前／次のダンジョンに入る時。
//   セーブ（saveGame）は、変身中でも必ず元の姿で書き出す。
// ============================================================
const _pendingTransforms = [];
function restoreTransforms() {
  _pendingTransforms.length = 0;
  let changed = false;
  for (const e of box) {
    if (e && e._tfFrom !== undefined) { e.monsterId = e._tfFrom; delete e._tfFrom; changed = true; }
  }
  if (changed) {
    _hpCache.key = '';
    try { if (typeof renderParty === 'function' && document.getElementById('party-grid')) renderParty(); } catch (err) {}
  }
  return changed;
}
async function runPendingTransforms() {
  while (_pendingTransforms.length) {
    const { entry, newId } = _pendingTransforms.shift();
    const newMon = MONSTER_DATA[newId];
    if (!newMon || !entry || !box.includes(entry)) continue;
    const ratio = playerMaxHP > 0 ? playerCurrentHP / playerMaxHP : 1;
    if (entry._tfFrom === undefined) entry._tfFrom = entry.monsterId;   // 最初の姿だけ控える（変身を重ねても元は変わらない）
    entry.monsterId = newId;
    // 最大HPはモンスターやリーダースキルが変わると変わるので、HPの割合を保ったまま計算し直す
    _hpCache.key = '';
    playerMaxHP = calcTotalHP();
    playerCurrentHP = Math.max(1, Math.min(playerMaxHP, Math.round(playerMaxHP * ratio)));
    updatePlayerHP();
    renderParty();
    try { updateLeaderSkill2(); } catch (err) {}
    renderBuffIcons();
    // 敵の⚠️技と同じカットイン（変身後の姿を大きく出す）
    try { if (window.EnemyCutIn) await window.EnemyCutIn.show({ attr: newMon.attr, img: monsterImg(newMon) }, newMon.name + 'に へんしん！'); } catch (err) {}
  }
}

function runSkillEffects(effects, entry, mon) {
  _dropcPlayed = false;
  _skillUsedCells = new Set();
  const context = { entry, mon };
  for (const eff of effects) runSkillEffect(eff, context);
  clearFiredSuperGut();   // スキルダメージで超根性が発動していたら、このスキルの終わりで消滅（次の攻撃まで残さない）
}

async function confirmSkill() {
  if (skillTargetUid === null) return;
  const entry = box.find(b => b.uid === skillTargetUid);
  if (!entry) return;
  const mon = MONSTER_DATA[entry.monsterId];
  if (!mon) return;
  const requiredSp = getRequiredSp(entry, mon);
  if (partySp < requiredSp || isSkillSealed()) { closeSkillConfirm(); return; }

  closeSkillConfirm();
  busy = true;
  isUsingSkill = true;
  skillUsedThisTurn = true;
  playSkillSound();

  if (window.MultiShare) MultiShare.fx('sk', { n: mon.skill.name });   // マルチ：スキル発動を相手の画面へ
  if (mon.skill.effects && mon.skill.effects.length) {
    runSkillEffects(mon.skill.effects, entry, mon);
  }
  if (window.MultiShare) { MultiShare.fxGrid(); MultiShare.fx('en', { hp: enemyList.map(e => e.hp) }); }   // スキルで変わった盤面・敵のHP

  partySp -= requiredSp;
  if (partySp < 0) partySp = 0;
  updateSpGaugeUI();
  renderParty();
  renderBuffIcons();
  document.getElementById('combo-label').textContent = 'スキル発動！';
  setTimeout(() => { if (document.getElementById('combo-label').textContent === 'スキル発動！') document.getElementById('combo-label').textContent = ''; }, 800);
  isUsingSkill = false;

  await runPendingTransforms();   // 「ランダム変身」の演出と入れ替え

  // スキルダメージで敵を全滅させた場合、演出を見せてから次のバトルへ自動進行する
  const allDead = enemyList.every(e => e.hp <= 0);
  // （updateEnemyUI が先に enemyDefeatedHandled を true にするため、フラグでは判定しない。二重実行は handleBattleEnd 側で防ぐ）
  if (allDead && !_battleEndRunning) {
    enemyDefeatedHandled = true;
    await sleep(900);
    await handleBattleEnd();
  }

  busy = false;
}

function updateSkillTurnsNormal(comboCount) {
  tickRouletteTurns();   // ルーレットの残りターン
  addMemoryToParty(comboCount || 0);
  updateSpGaugeUI();
  let _bindEnded = false;
  for (const key in bindTimers) {
    if (bindTimers[key] > 0) {
      bindTimers[key]--;
      if (bindTimers[key] <= 0) { delete bindTimers[key]; _bindEnded = true; }
    }
  }
  if (_bindEnded) updatePlayerHP();   // バインドが解けたぶん最大HPが戻る（現在HPは増えない）
}

// 敵の弱体（攻撃力ダウン／回復力ダウン／操作時間ダウン／スキル使用不可／落ちコンなし）の残りターンを減らす
//   ★ 味方の攻撃演出が全部終わったあとに呼ぶ（攻撃前にアイコンが消えないように）
function tickEnemyDebuffsAfterAttack() {
  let _dbgChanged = false;
  if (enemyAtkDowns.length) {
    enemyAtkDowns.forEach(d => d.turns--);
    enemyAtkDowns = enemyAtkDowns.filter(d => d.turns > 0);
    _dbgChanged = true;
  }
  if (enemyRecDown && --enemyRecDown.turns <= 0) { enemyRecDown = null; _dbgChanged = true; }
  if (enemyMoveDown && --enemyMoveDown.turns <= 0) { enemyMoveDown = null; _dbgChanged = true; }
  if (enemySkillSeal && --enemySkillSeal.turns <= 0) { enemySkillSeal = null; _dbgChanged = true; }   // スキル使用不可（このあと renderParty で枠が戻る）
  if (enemyNoFall && --enemyNoFall.turns <= 0) { enemyNoFall = null; _dbgChanged = true; }
  if (_dbgChanged) { renderBuffIcons(); try { renderParty(); } catch (e) {} }
}

// ============================================================
// ★ 時を止めるスキル実装 ★
// ============================================================
let _tsHideTimer = null;
// カチッの間隔：停止時間の長さに合わせて変わる。
//   ・加速し始めるのは「残り3秒」か「全体の60%」のうち短い方から（短い停止でも最後に向けて加速する）
//   ・通常の間隔は最大0.5秒（短い停止では少し詰める）、最後は約0.11秒おき
function buildTimeStopTicks(durMs) {
  const out = [];
  const baseInt = Math.min(500, Math.max(220, durMs / 8));   // 通常のカチッ間隔(ms)
  const fastInt = Math.min(110, baseInt * 0.5);              // 最後の間隔(ms)
  const accelMs = Math.min(3000, durMs * 0.6);               // 加速区間の長さ(ms)
  let t = Math.min(350, durMs * 0.15);                       // 開始音の立ち上がりの後から刻み始める
  while (t < durMs - 40) {
    out.push(t);
    const rem = durMs - t;
    t += rem > accelMs ? baseInt : fastInt + (baseInt - fastInt) * Math.pow(rem / accelMs, 1.2);
  }
  if (!out.length) out.push(Math.max(0, durMs * 0.5));
  return out;
}
function _tsSetVisual(on) {
  const gameEl = document.getElementById('game'), neg = document.getElementById('time-stop-negative');
  if (gameEl) gameEl.classList.toggle('ts-on', on);
  if (neg) { neg.classList.remove('on'); if (on) { void neg.offsetWidth; neg.classList.add('on'); } }
}
function _tsHideClock(animated) {
  const clock = document.getElementById('time-stop-clock');
  if (!clock) return;
  clearTimeout(_tsHideTimer);
  if (!animated) { clock.style.display = 'none'; clock.classList.remove('ts-in', 'ts-out'); return; }
  clock.classList.remove('ts-in'); clock.classList.add('ts-out');
  _tsHideTimer = setTimeout(() => { clock.style.display = 'none'; clock.classList.remove('ts-out'); }, 230);
}
// 途中で強制終了（リタイア・バトル切り替えなど）
function abortTimeStop() {
  timeStopActive = false;
  cancelAnimationFrame(timeStopRAF);
  _tsHideClock(false);
  _tsSetVisual(false);
  _stopSEByName('tsstart'); _stopSEByName('tstick');
}
// 時計の針：短針は 0時の位置 → 反時計回りに1周して 0時の位置へ、長針は短針の12倍の速さで反時計回り。
//   短針が0時に着いた瞬間（=長針も0分）が時間停止の終わり。終わりに近づくほど針も速くなる（カチカチ音と同じ）
const TS_HOUR_START = 360;  // 短針の回転量（360=0時の位置から反時計回りにちょうど1周して0時に戻る）
function setTimeStopHands(u) {   // u: 0〜1（時間停止の経過割合）
  const p = 0.5 * u + 0.5 * u * u * u;                 // 0→1（後半ほど速い）
  const hourDeg = TS_HOUR_START * (1 - p);             // 360 → 0（見た目は0時スタート→0時でおわり）
  const hr = document.getElementById('clock-hour'), mn = document.getElementById('clock-hand');
  if (hr) hr.style.transform = `rotate(${hourDeg.toFixed(2)}deg)`;
  if (mn) mn.style.transform = `rotate(${(hourDeg * 12).toFixed(2)}deg)`;   // 短針の12倍＝長針（角度が減っていく＝反時計回り）
}
function activateTimeStop(seconds) {
  if (timeStopActive) return;
  timeStopDuration = Math.max(0.1, Number(seconds) || 5) * 1000;
  timeStopActive = true;
  const clock = document.getElementById('time-stop-clock');

  // 時計を敵エリアの中央に大きく出す
  const dg = document.getElementById('dungeon');
  const r = dg ? dg.getBoundingClientRect() : null;
  if (r && r.width) {
    const d = Math.round(Math.max(76, Math.min(r.width * 0.3, r.height * 0.55, 190)));
    clock.style.setProperty('--ts-d', d + 'px');
    clock.style.left = (r.left + r.width / 2) + 'px';
    clock.style.top = (r.top + r.height * 0.48) + 'px';
  }
  clearTimeout(_tsHideTimer);
  clock.classList.remove('ts-in', 'ts-out');
  clock.style.display = 'block';
  void clock.offsetWidth;
  clock.classList.add('ts-in');
  setTimeStopHands(0);
  _tsSetVisual(true);                  // ネガ反転 + フラッシュ
  playSE('tsstart');                   // 開始音 (start.mp3)

  // 時計の音(time.mp3)：カチ／コチを交互に、終わりに近づくほど速く
  const ticks = buildTimeStopTicks(timeStopDuration);
  let tickIdx = 0;

  timeStopStart = performance.now();
  if (timerStarted) { stopTimer(); timerStarted = false; }
  function tickTimeStop(now) {
    if (!timeStopActive) return;
    const elapsed = now - timeStopStart;
    while (tickIdx < ticks.length && elapsed >= ticks[tickIdx]) {
      playSE('tstick', tickIdx % 2 === 0 ? 1 : 0.8);       // カチ(高) / コチ(低)
      tickIdx++;
    }
    setTimeStopHands(Math.min(1, elapsed / timeStopDuration));
    if (elapsed < timeStopDuration) timeStopRAF = requestAnimationFrame(tickTimeStop);
    else {                              // 短針が0時の位置に着いた → 時間停止おわり
      timeStopActive = false;
      _tsHideClock(true);
      _tsSetVisual(false);
      if (dragging) { timerStarted = true; startTimer(); }
      evaluateIfMoved();
    }
  }
  timeStopRAF = requestAnimationFrame(tickTimeStop);
}

// ============================================================
// 効果ポップアップ（敵の状態異常アイコン／自分のバフアイコンをタップ → 画面中央に数秒表示）
// ============================================================
let _effectPopupTimer = null;
function showEffectPopup(o) {
  let el = document.getElementById('effect-popup');
  if (!el) { el = document.createElement('div'); el.id = 'effect-popup'; document.body.appendChild(el); }
  el.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'ep-head';
  if (o.svg) {
    const w = document.createElement('span'); w.className = 'ep-icon'; w.innerHTML = o.svg; head.appendChild(w);
  } else if (o.icon) {
    const im = document.createElement('img'); im.className = 'ep-icon'; im.src = o.icon; im.alt = '';
    im.onerror = function(){ this.style.display = 'none'; };
    head.appendChild(im);
  }
  const name = document.createElement('span'); name.className = 'ep-name'; name.textContent = o.name || '';
  head.appendChild(name);
  el.appendChild(head);
  const lines = Array.isArray(o.lines) ? o.lines : [o.text];
  for (const t of lines) {
    if (!t) continue;
    const d = document.createElement('div'); d.className = 'ep-text'; d.textContent = t; el.appendChild(d);
  }
  if (o.turns > 0) {
    const d = document.createElement('div'); d.className = 'ep-turns'; d.textContent = `残り ${o.turns} ターン`; el.appendChild(d);
  }
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(_effectPopupTimer);   // 時間では消さない（画面のどこかをタップしたら消える）
}
// ポップアップ表示中に画面のどこかを押したら、すぐ閉じる（別のアイコンを押した場合は、閉じてからそのアイコンの説明が出る）
document.addEventListener('pointerdown', () => {
  const el = document.getElementById('effect-popup');
  if (el && el.classList.contains('show')) el.classList.remove('show');
}, true);
function hideEffectPopup() { const el = document.getElementById('effect-popup'); if (el) el.classList.remove('show'); }

// ============================================================
// バフアイコン表示
// ============================================================
function buildBuffItems() {
  const items = [];
  if (buffDamageReduction) items.push({ icon:'j2.png', turns: buffDamageReductionTurns, name:'ダメージ軽減', text:`敵から受けるダメージを${Math.round(buffDamageReductionValue*100)}%軽減する` });
  if (buffRecMult) items.push({ icon:'j6.png', turns: buffRecMultTurns, name: buffRecMultValue === 0 ? '回復力0' : `回復力${buffRecMultValue}倍`, text: buffRecMultValue === 0 ? '回復ドロップで回復できない' : `回復力が${buffRecMultValue}倍になる` });
  if (buffMoveTime) {
    const parts = [];
    if (buffMoveTimeMult !== 1) parts.push(`${buffMoveTimeMult}倍`);
    if (buffMoveTimeSec !== 0) parts.push(`${Math.abs(buffMoveTimeSec)}秒${buffMoveTimeSec < 0 ? '短縮' : '延長'}`);
    const up = Math.floor(leaderBaseMoveMs() * buffMoveTimeMult + buffMoveTimeSec * 1000) >= leaderBaseMoveMs();
    items.push({ icon: up ? 'j3.png' : 'j4.png', turns: buffMoveTimeTurns, name: up ? '操作時間アップ' : '操作時間ダウン', text: `ドロップ操作時間が${parts.join('・')}になる` });
  }
  if (buffAllAttack)       items.push({ icon:'zen.png', turns: buffAllAttackTurns, name:'全体攻撃', text:'敵全体に攻撃する' });
  for (const b of atkBuffs) items.push({ icon:'j1.png', turns: b.turns, name:'攻撃力アップ', text: atkBuffLabel(b).replace(/^\d+ターン\s*/, '') });
  if (enemyMoveDown && !moveTimeFixed) items.push({ icon:'j4.png', turns: enemyMoveDown.turns, name:'操作時間ダウン', text:`敵の効果でドロップ操作時間が${enemyMoveDown.seconds}秒短くなる` });
  if (enemyRecDown) items.push({ icon:'j6.png', turns: enemyRecDown.turns, name: enemyRecDown.value === 0 ? '回復力ダウン（0）' : `回復力ダウン（${enemyRecDown.value}倍）`, text: enemyRecDown.value === 0 ? '敵の効果で回復ドロップで回復できない' : `敵の効果で回復力が${enemyRecDown.value}倍になる` });
  if (enemySkillSeal) items.push({ icon: ICON_SKILL_SEAL, turns: enemySkillSeal.turns, name:'スキル使用不可', text:'敵の効果で、チーム全員のスキルが使えない' });
  if (enemyNoFall) items.push({ icon: ICON_NO_FALL, turns: enemyNoFall.turns, name:'落ちコンなし', text:'敵の効果で、ドロップを消しても新しいドロップが降ってこない（消し終わってから補充される）' });
  if (buffMoveTimeShort && !moveTimeFixed) items.push({ icon:'j4.png', turns: buffMoveTimeShortTurns, name:'操作時間ダウン', text:'敵の効果でドロップ操作時間が1秒短くなる' });
  for (const d of enemyAtkDowns) {
    if (d.turns <= 0) continue;
    const nm = d.attr === 'all' ? '全属性' : (ATTR_NAME_JP[d.attr] || d.attr) + '属性';
    items.push({ icon:'j8.png', turns: d.turns, name:`${nm}の攻撃力ダウン`, text:`${nm}のモンスターの攻撃力が${Math.round(d.rate * 100)}%下がっている` });
  }
  // バインドはモンスター側のオーバーレイ（バインド〇T）だけで表現するので、バフアイコン／詳細表示は出さない
  return items;
}

function renderBuffIcons() {
  try { if (typeof updateEnemyUI === 'function' && enemyList && enemyList.length) updateEnemyUI(); } catch(e) {}   // 敵の防御ダウン表示も更新
  const old = document.getElementById('buff-icon-container');
  if (old) old.remove();

  const items = buildBuffItems();
  if (items.length === 0) return;

  const partyGrid = document.getElementById('party-grid');
  if (!partyGrid) return;
  const slots = partyGrid.querySelectorAll('.party-slot');
  if (slots.length < 6) return;
  const slot6 = slots[5];
  const slotRect = slot6.getBoundingClientRect();
  const partyRect = document.getElementById('party-area').getBoundingClientRect();

  const container = document.createElement('div');
  container.id = 'buff-icon-container';
  container.style.cssText = `
    position:absolute;
    bottom: ${partyRect.bottom - slotRect.top + 4}px;
    right: 6px;
    display:flex;
    flex-direction:column;
    align-items:flex-end;
    gap:3px;
    z-index:20;
    pointer-events:none;
  `;

  const ICON_SIZE = 22;
  const ICONS_PER_COL = 5;
  const cols = [];
  for (let i = 0; i < items.length; i += ICONS_PER_COL) cols.push(items.slice(i, i + ICONS_PER_COL));

  const row = document.createElement('div');
  row.style.cssText = 'display:flex; flex-direction:row; align-items:flex-end; gap:3px;';

  cols.forEach(colItems => {
    const col = document.createElement('div');
    col.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:3px;';
    colItems.slice().reverse().forEach(item => {
      const wrap = document.createElement('div');
      wrap.style.cssText = `display:flex; flex-direction:row; align-items:center; gap:2px; background:rgba(0,0,0,0.72); border:1px solid rgba(255,255,255,0.18); border-radius:5px; padding:1px 3px 1px 2px; pointer-events:auto; cursor:pointer;`;
      wrap.addEventListener('click', (ev) => { ev.stopPropagation(); showEffectPopup({ icon:item.icon, name:item.name, text:item.text, turns:item.turns }); });
      const img = document.createElement('img');
      img.src = item.icon;
      img.style.cssText = `width:${ICON_SIZE}px; height:${ICON_SIZE}px; object-fit:contain; display:block;${item.filter ? 'filter:' + item.filter + ';' : ''}`;
      img.onerror = () => { img.style.display='none'; };
      wrap.appendChild(img);
      if (item.turns > 0) {
        const t = document.createElement('span');
        t.textContent = item.turns;
        t.style.cssText = 'font-size:0.6rem; font-weight:900; color:#fff; min-width:8px; text-align:center; text-shadow:0 1px 2px rgba(0,0,0,0.9);';
        wrap.appendChild(t);
      }
      col.appendChild(wrap);
    });
    row.appendChild(col);
  });

  container.appendChild(row);
  // 横画面の時は、盤面の下の「状態異常アイコン欄」へ入れる（縦画面は今までどおりチーム欄の上）
  const _lsHost = (typeof window.landscapeStatusHost === 'function') ? window.landscapeStatusHost() : null;
  if (_lsHost) {
    _lsHost.appendChild(container);
  } else {
    document.getElementById('party-area').style.position = 'relative';
    document.getElementById('party-area').appendChild(container);
  }
}

// ============================================================
// ★ 十字消し判定 ★
// ============================================================
function isCrossGroup(cells) {
  if (cells.length !== 5) return false;
  const positions = cells.map(c => ({r:c.r, c:c.c}));
  for (const p of positions) {
    const hasUp = positions.some(n => n.r === p.r-1 && n.c === p.c);
    const hasDown = positions.some(n => n.r === p.r+1 && n.c === p.c);
    const hasLeft = positions.some(n => n.r === p.r && n.c === p.c-1);
    const hasRight = positions.some(n => n.r === p.r && n.c === p.c+1);
    if (hasUp && hasDown && hasLeft && hasRight) {
      const expected = [{r:p.r,c:p.c},{r:p.r-1,c:p.c},{r:p.r+1,c:p.c},{r:p.r,c:p.c-1},{r:p.r,c:p.c+1}];
      const matched = expected.every(e => positions.some(n => n.r === e.r && n.c === e.c));
      if (matched) return true;
    }
  }
  return false;
}

// ============================================================
// ★ L字消し判定 ★
// ============================================================
function isLShape(cells) {
  if (cells.length !== 5) return false;
  const positions = cells.map(c => ({r:c.r, c:c.c}));
  for (const p of positions) {
    const neighbors = positions.filter(n => {
      const dr = Math.abs(n.r - p.r), dc = Math.abs(n.c - p.c);
      return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
    });
    if (neighbors.length === 2) {
      const dirs = neighbors.map(n => ({dr: n.r - p.r, dc: n.c - p.c}));
      const hasV = dirs.some(d => d.dr !== 0 && d.dc === 0);
      const hasH = dirs.some(d => d.dr === 0 && d.dc !== 0);
      if (hasV && hasH) {
        const dir1 = dirs[0];
        const dir2 = dirs[1];
        const extend = (dr, dc) => {
          let count = 1;
          let r = p.r + dr, c = p.c + dc;
          while (positions.some(n => n.r === r && n.c === c)) { count++; r += dr; c += dc; }
          r = p.r - dr; c = p.c - dc;
          while (positions.some(n => n.r === r && n.c === c)) { count++; r -= dr; c -= dc; }
          return count;
        };
        const c1 = extend(dir1.dr, dir1.dc);
        const c2 = extend(dir2.dr, dir2.dc);
        if (c1 === 3 && c2 === 3) return true;
      }
    }
  }
  return false;
}

// ============================================================
// ★ リーダースキル発動の「形」演出 ★
//   リーダー／フレンドのスキルに下記の条件があり、それを満たして消したドロップだけ、
//   そのドロップの形に沿って控えめに光る（条件にない普通の消しでは何も出さない）
//     ・ちょうど4個消し(exact4) ・L字消し(lShapes) ・十字消し(cross)
//     ・〇個以上つなげて消し(orbConnect／2属性同時つなげ) ・ちょうど〇個消し(exactCount)
// ============================================================
const LS_SHAPE_CONDS = ['exact4', 'lShapes', 'cross', 'orbConnect', 'exactCount'];
function lsShapeEffects() {
  return lsAllEffects().filter(e => e && LS_SHAPE_CONDS.includes(e.condition) && (e.type === 'atk' || e.type === 'dmgReduction'));
}
const LS_SHAPE_COLOR = { cross: '#ffd700', lShapes: '#d9a6ff', exact4: '#7fe9ff' };
// この1グループが、リーダースキルのどの条件を満たしたか（満たしていなければ null）
//   info: { color, cells, isCross, isL, maxConnect, passMax }
function lsShapeMatch(effects, info) {
  const { color, cells, isCross, isL } = info;
  const n = cells.length;
  for (const e of effects) {
    switch (e.condition) {
      case 'cross':  if (isCross && (!e.shapeAttr || e.shapeAttr === color)) return LS_SHAPE_COLOR.cross; break;
      case 'lShapes': if (isL && (!e.shapeAttr || e.shapeAttr === color)) return LS_SHAPE_COLOR.lShapes; break;
      case 'exact4': if (n === 4) return LS_SHAPE_COLOR.exact4; break;
      case 'exactCount':
        if (e.attr === color && n === e.count) return ATTR_FX_COLOR[color] || '#fff'; break;
      case 'orbConnect': {
        const need = e.count || 0;
        if (e.attr2) {
          if ((color === e.attr || color === e.attr2) && n >= need) {
            // 2属性が両方そろったときだけ発動（同じ巡で後から消える分も数える）
            const got = (a) => Math.max(info.maxConnect[a] || 0, info.passMax[a] || 0);
            if (got(e.attr) >= need && got(e.attr2) >= need) return ATTR_FX_COLOR[color] || '#fff';
            return { pending: true, need, pair: [e.attr, e.attr2] };
          }
        } else if (e.attr === color && n >= need) return ATTR_FX_COLOR[color] || '#fff';
        break;
      }
    }
  }
  return null;
}
// ドロップの形にそってふわっと光るエフェクト（邪魔にならないよう薄く短く）
function lsShapeFx(cells, color) {
  try {
    const set = new Set(cells.map(({ r, c }) => r + ',' + c));
    const rects = cells.map(({ r, c }) => {
      const el = orbEls[r] && orbEls[r][c];
      return el ? { r, c, rc: el.getBoundingClientRect() } : null;
    }).filter(Boolean);
    if (!rects.length) return;
    let L = Infinity, T = Infinity, R = -Infinity, B = -Infinity;
    rects.forEach(({ rc }) => { L = Math.min(L, rc.left); T = Math.min(T, rc.top); R = Math.max(R, rc.right); B = Math.max(B, rc.bottom); });
    const pad = 6, W = R - L + pad * 2, H = B - T + pad * 2;
    const root = document.createElement('div');
    root.style.cssText = `position:fixed;left:${L - pad}px;top:${T - pad}px;width:${W}px;height:${H}px;z-index:240;pointer-events:none;` +
      `filter:drop-shadow(0 0 5px ${color});`;
    document.body.appendChild(root);
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible;';
    root.appendChild(svg);
    const sid = 'lss' + Math.floor(Math.random() * 1e9);
    // 光の帯が形の中だけを走る（クリップ）
    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = `<clipPath id="${sid}"></clipPath>
      <linearGradient id="${sid}g" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>`;
    svg.appendChild(defs);
    const clip = defs.querySelector('clipPath');
    const fillG = document.createElementNS(NS, 'g');
    svg.appendChild(fillG);
    const edgeG = document.createElementNS(NS, 'g');
    edgeG.setAttribute('stroke', color); edgeG.setAttribute('stroke-width', '2.5'); edgeG.setAttribute('stroke-linecap', 'round');
    svg.appendChild(edgeG);
    const mk = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };
    rects.forEach(({ r, c, rc }) => {
      const x = rc.left - L + pad, y = rc.top - T + pad, w = rc.width, h = rc.height;
      // 面（薄く色づける）
      mk('rect', { x, y, width: w, height: h, rx: 6, fill: color, 'fill-opacity': 0.22 }, fillG);
      mk('rect', { x, y, width: w, height: h }, clip);
      // 外周の辺（隣に同じグループのドロップがない側だけ線を引く＝形の輪郭）
      const e = 1.5;
      if (!set.has((r - 1) + ',' + c)) mk('line', { x1: x + e, y1: y + e, x2: x + w - e, y2: y + e }, edgeG);
      if (!set.has((r + 1) + ',' + c)) mk('line', { x1: x + e, y1: y + h - e, x2: x + w - e, y2: y + h - e }, edgeG);
      if (!set.has(r + ',' + (c - 1))) mk('line', { x1: x + e, y1: y + e, x2: x + e, y2: y + h - e }, edgeG);
      if (!set.has(r + ',' + (c + 1))) mk('line', { x1: x + w - e, y1: y + e, x2: x + w - e, y2: y + h - e }, edgeG);
    });
    const sweep = mk('rect', { x: -W * 0.4, y: -10, width: W * 0.4, height: H + 20, fill: `url(#${sid}g)`, 'clip-path': `url(#${sid})` }, svg);
    root.animate([
      { opacity: 0, transform: 'scale(1.06)' },
      { opacity: 1, transform: 'scale(1)', offset: 0.25 },
      { opacity: 0.85, transform: 'scale(1)', offset: 0.7 },
      { opacity: 0, transform: 'scale(1)' }
    ], { duration: 640, easing: 'ease-out', fill: 'both' });
    if (sweep.animate) sweep.animate([{ transform: 'translateX(0px)' }, { transform: `translateX(${W * 1.5}px)` }], { duration: 480, delay: 80, easing: 'ease-in-out', fill: 'both' });
    setTimeout(() => root.remove(), 760);
  } catch (err) {}
}

// ============================================================
// ★ ヒットエフェクト ★
// ============================================================
function createHitEffect(x, y, attr) {
  const container = document.createElement('div');
  container.style.cssText = `position:fixed; left:${x}px; top:${y}px; width:0; height:0; z-index:200; pointer-events:none;`;
  document.body.appendChild(container);
  const colors = {
    fire: ['#ff4500','#ff8c00','#ffd700','#ff2200','#ff6600'],
    water: ['#00bfff','#1e90ff','#87ceeb','#0066ff','#66ccff'],
    wood: ['#32cd32','#228b22','#9acd32','#00ff00','#66ff66'],
    light: ['#ffffff','#ffffe0','#f0e68c','#fffaaf','#fff8dc'],
    dark: ['#8b008b','#4b0082','#9400d3','#6a0dad','#ba55d3']
  };
  const c = colors[attr] || ['#fff'];
  const count = 35;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    const size = 6 + Math.random() * 28;
    const angle = Math.random() * 2 * Math.PI;
    const dist = 40 + Math.random() * 140;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 30;
    const rot = Math.random() * 720;
    const color = c[Math.floor(Math.random() * c.length)];
    const isRing = i < count * 0.3;
    p.style.cssText = `position:absolute; left:0; top:0; width:${size}px; height:${size}px; ${isRing ? 'border-radius:50%; border:3px solid ' + color + '; background:transparent;' : 'border-radius:50%; background:' + color + '; box-shadow: 0 0 30px ' + color + ';'} transform:translate(-50%,-50%) rotate(0deg);`;
    container.appendChild(p);
    p.animate([
      { transform: `translate(-50%, -50%) scale(1) rotate(0deg)`, opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(${isRing ? 3 + Math.random()*2 : 0}) rotate(${rot}deg)`, opacity: 0 }
    ], { duration: 400 + Math.random()*400, easing: 'cubic-bezier(0.2,0.8,0.3,1)', fill: 'forwards' });
  }
  setTimeout(() => container.remove(), 1200);
}

// ============================================================
// ★ 属性別の攻撃エフェクト（パズドラ風：炎・水・風・雷・闇） ★
//   fire=炎の玉 / water=水の塊 / wood=風(旋風と葉) / light=雷光 / dark=闇の渦
// ============================================================
const ATTR_FX_COLOR = { fire:'#ff5a00', water:'#2fa4ff', wood:'#5ee35e', light:'#ffe14a', dark:'#9a4be0', heal:'#ff88aa' };

function fxAdd(css, life) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;pointer-events:none;z-index:150;' + css;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), life || 900);
  return el;
}
const fxRand = (a, b) => a + Math.random() * (b - a);

// 飛んでいく本体
function makeAttrProjectile(attr) {
  const col = ATTR_FX_COLOR[attr] || '#fff';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;width:46px;height:46px;z-index:100;pointer-events:none;will-change:transform;';
  const add = (css) => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;' + css; wrap.appendChild(d); return d; };
  if (attr === 'fire') {
    for (let i = 0; i < 3; i++) {
      const t = add(`left:${-70 + i * 6}%;top:${14 + i * 24}%;width:90%;height:30%;border-radius:50%;background:linear-gradient(to left,#ffb000,rgba(255,60,0,0));filter:blur(1px);`);
      t.animate([{ transform:'scaleX(.7)', opacity:.9 }, { transform:'scaleX(1.25)', opacity:.5 }], { duration:140 + i * 40, iterations:Infinity, direction:'alternate' });
    }
    const b = add('inset:0;border-radius:50%;background:radial-gradient(circle at 42% 42%,#fffbd0 0%,#ffd23a 24%,#ff7a00 55%,#d81e00 82%,rgba(216,30,0,0) 100%);box-shadow:0 0 22px #ff6a00,0 0 60px rgba(255,90,0,.7);');
    b.animate([{ transform:'scale(.9)' }, { transform:'scale(1.12)' }], { duration:120, iterations:Infinity, direction:'alternate' });
  } else if (attr === 'water') {
    const b = add('inset:0;border-radius:50% 50% 50% 50% / 60% 60% 40% 40%;background:radial-gradient(circle at 35% 30%,#fff 0%,#c4ecff 20%,#36a9ff 55%,#0b5fd6 100%);box-shadow:0 0 20px #4cb8ff,inset 0 -6px 12px rgba(0,40,140,.5);opacity:.95;');
    b.animate([{ transform:'scale(1.12,.88)' }, { transform:'scale(.88,1.12)' }], { duration:160, iterations:Infinity, direction:'alternate' });
    const r = add('inset:-30%;border-radius:50%;border:2px solid rgba(170,225,255,.7);');
    r.animate([{ transform:'scale(.7)', opacity:.9 }, { transform:'scale(1.3)', opacity:0 }], { duration:360, iterations:Infinity });
  } else if (attr === 'wood') {
    add('inset:15%;border-radius:50%;background:radial-gradient(circle,rgba(230,255,220,.85) 0%,rgba(94,227,94,.35) 60%,rgba(94,227,94,0) 100%);');
    [[-10, '#d8ffc0', '#5ee35e', 420], [-45, '#b7ffa0', '#2fbf4a', 300], [-80, '#eaffdc', '#7dff7d', 220]].forEach(([inset, c1, c2, dur]) => {
      const a = add(`inset:${inset}%;border-radius:50%;border:3px solid transparent;border-top-color:${c1};border-right-color:${c2};filter:drop-shadow(0 0 6px ${c2});`);
      a.animate([{ transform:'rotate(0)' }, { transform:'rotate(360deg)' }], { duration:dur, iterations:Infinity });
    });
  } else if (attr === 'light') {
    add('inset:-20%;border-radius:50%;background:radial-gradient(circle,#fff 0%,rgba(255,240,120,.8) 30%,rgba(255,225,74,0) 70%);');
    const s = add('left:-70%;right:-70%;top:44%;height:12%;background:linear-gradient(to right,rgba(255,255,255,0),#fff,rgba(255,255,255,0));box-shadow:0 0 12px #ffe14a;border-radius:50%;');
    const s2 = add('top:-70%;bottom:-70%;left:44%;width:12%;background:linear-gradient(to bottom,rgba(255,255,255,0),#fff,rgba(255,255,255,0));box-shadow:0 0 12px #ffe14a;border-radius:50%;');
    [s, s2].forEach(e => e.animate([{ opacity:1, transform:'scale(1)' }, { opacity:.5, transform:'scale(.75)' }], { duration:90, iterations:Infinity, direction:'alternate' }));
  } else if (attr === 'dark') {
    add('inset:-35%;border-radius:50%;background:radial-gradient(circle,rgba(120,40,190,.0) 40%,rgba(120,40,190,.55) 70%,rgba(60,0,110,0) 100%);');
    const sw = add('inset:-12%;border-radius:50%;background:conic-gradient(from 0deg,#1a0030,#8a3cd6,#1a0030,#5a1a9c,#1a0030);filter:blur(1px);');
    sw.animate([{ transform:'rotate(0)' }, { transform:'rotate(-360deg)' }], { duration:380, iterations:Infinity });
    add('inset:12%;border-radius:50%;background:radial-gradient(circle,#000 0%,#14002a 70%,#3a0a66 100%);box-shadow:0 0 18px #7a2cc0;');
  } else {
    wrap.style.background = `radial-gradient(circle at 30% 28%,#fff 0%,${col} 40%,rgba(0,0,0,.25) 85%)`;
    wrap.style.borderRadius = '50%';
    wrap.style.boxShadow = `0 0 30px ${col}`;
  }
  return wrap;
}

// 飛んでいる間の軌跡
function spawnAttrTrail(attr, x, y, ang) {
  const bx = -Math.cos(ang), by = -Math.sin(ang);   // 進行方向の後ろ
  if (attr === 'fire') {
    for (let i = 0; i < 2; i++) {
      const s = fxRand(10, 22), c = ['#ff9a00', '#ff5a00', '#ffd23a'][Math.floor(Math.random() * 3)];
      const e = fxAdd(`left:${x + fxRand(-8, 8)}px;top:${y + fxRand(-8, 8)}px;width:${s}px;height:${s * 1.3}px;margin:${-s * .65}px 0 0 ${-s / 2}px;border-radius:50% 50% 50% 50% / 65% 65% 35% 35%;background:radial-gradient(circle at 50% 70%,${c},rgba(255,60,0,0) 75%);`, 500);
      e.animate([{ transform:'translate(0,0) scale(1)', opacity:.95 }, { transform:`translate(${bx * 20}px,${by * 20 - 28}px) scale(.2)`, opacity:0 }], { duration:420, easing:'ease-out', fill:'forwards' });
    }
  } else if (attr === 'water') {
    for (let i = 0; i < 2; i++) {
      const s = fxRand(5, 11);
      const e = fxAdd(`left:${x + fxRand(-8, 8)}px;top:${y + fxRand(-8, 8)}px;width:${s}px;height:${s}px;margin:${-s / 2}px 0 0 ${-s / 2}px;border-radius:50% 50% 50% 50% / 60% 60% 40% 40%;background:radial-gradient(circle at 35% 30%,#fff,#6cc4ff 60%,#1f7ae0);`, 600);
      e.animate([{ transform:'translate(0,0)', opacity:1 }, { transform:`translate(${bx * 26 + fxRand(-14, 14)}px,${by * 26 + 34}px)`, opacity:0 }], { duration:520, easing:'cubic-bezier(.3,0,.9,.6)', fill:'forwards' });
    }
  } else if (attr === 'wood') {
    if (Math.random() < .6) {
      const s = fxRand(9, 15);
      const e = fxAdd(`left:${x + fxRand(-10, 10)}px;top:${y + fxRand(-10, 10)}px;width:${s}px;height:${s * .55}px;margin:${-s * .28}px 0 0 ${-s / 2}px;border-radius:0 100% 0 100%;background:linear-gradient(135deg,#b8ff90,#2fa83a);box-shadow:0 0 6px #5ee35e;`, 650);
      e.animate([{ transform:'translate(0,0) rotate(0)', opacity:1 }, { transform:`translate(${bx * 30 + fxRand(-12, 12)}px,${by * 30 + fxRand(-12, 12)}px) rotate(${fxRand(-360, 360)}deg)`, opacity:0 }], { duration:560, easing:'ease-out', fill:'forwards' });
    }
    const L = fxAdd(`left:${x + fxRand(-6, 6)}px;top:${y + fxRand(-14, 14)}px;width:30px;height:2px;margin:-1px 0 0 -15px;border-radius:2px;background:linear-gradient(to left,rgba(255,255,255,.9),rgba(120,255,120,0));transform:rotate(${ang}rad);transform-origin:right center;`, 400);
    L.animate([{ opacity:.9 }, { opacity:0, transform:`rotate(${ang}rad) scaleX(1.6)` }], { duration:300, fill:'forwards' });
  } else if (attr === 'light') {
    const s = fxRand(3, 6);
    const e = fxAdd(`left:${x + fxRand(-12, 12)}px;top:${y + fxRand(-12, 12)}px;width:${s}px;height:${s}px;border-radius:50%;background:#fff;box-shadow:0 0 10px #ffe14a,0 0 20px #ffe14a;`, 400);
    e.animate([{ transform:'scale(1)', opacity:1 }, { transform:`translate(${fxRand(-14, 14)}px,${fxRand(-14, 14)}px) scale(0)`, opacity:0 }], { duration:300, fill:'forwards' });
  } else if (attr === 'dark') {
    const s = fxRand(14, 26);
    const e = fxAdd(`left:${x + fxRand(-6, 6)}px;top:${y + fxRand(-6, 6)}px;width:${s}px;height:${s}px;margin:${-s / 2}px 0 0 ${-s / 2}px;border-radius:50%;background:radial-gradient(circle,rgba(40,0,70,.85),rgba(120,40,190,.0) 75%);`, 600);
    e.animate([{ transform:'scale(.6)', opacity:.9 }, { transform:`translate(${bx * 14}px,${by * 14}px) scale(2)`, opacity:0 }], { duration:480, fill:'forwards' });
  }
}

// 着弾エフェクト
function spawnAttrImpact(attr, x, y, big) {
  const k = big ? 1.3 : 1;
  if (attr === 'fire') {
    const ring = fxAdd(`left:${x}px;top:${y}px;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;background:radial-gradient(circle,#fff6c0 0%,#ffb000 30%,#ff4a00 60%,rgba(255,40,0,0) 100%);`, 700);
    ring.animate([{ transform:'scale(.2)', opacity:1 }, { transform:`scale(${1.5 * k})`, opacity:0 }], { duration:520, easing:'ease-out', fill:'forwards' });
    for (let i = 0; i < 12; i++) {
      const w = fxRand(14, 28), dx = fxRand(-70, 70) * k;
      const f = fxAdd(`left:${x}px;top:${y}px;width:${w}px;height:${w * 1.7}px;margin:${-w * .85}px 0 0 ${-w / 2}px;border-radius:50% 50% 50% 50% / 70% 70% 30% 30%;background:radial-gradient(circle at 50% 75%,#ffe27a,#ff6a00 55%,rgba(255,40,0,0) 90%);`, 900);
      f.animate([{ transform:'translate(0,0) scale(.5)', opacity:1 }, { transform:`translate(${dx}px,${-fxRand(60, 140) * k}px) scale(1.1)`, opacity:0 }], { duration:fxRand(500, 800), easing:'ease-out', fill:'forwards' });
    }
  } else if (attr === 'water') {
    for (let i = 0; i < 2; i++) {
      const r = fxAdd(`left:${x}px;top:${y}px;width:100px;height:46px;margin:-23px 0 0 -50px;border-radius:50%;border:3px solid rgba(190,235,255,.9);box-shadow:0 0 12px #4cb8ff;`, 800);
      r.animate([{ transform:'scale(.2)', opacity:1 }, { transform:`scale(${(1.6 + i * .7) * k})`, opacity:0 }], { duration:520 + i * 140, delay:i * 90, easing:'ease-out', fill:'both' });
    }
    for (let i = 0; i < 16; i++) {
      const s = fxRand(6, 14), dx = fxRand(-90, 90) * k, up = fxRand(50, 120) * k;
      const d = fxAdd(`left:${x}px;top:${y}px;width:${s}px;height:${s}px;margin:${-s / 2}px 0 0 ${-s / 2}px;border-radius:50% 50% 50% 50% / 60% 60% 40% 40%;background:radial-gradient(circle at 35% 30%,#fff,#6cc4ff 60%,#1f7ae0);`, 1000);
      d.animate([{ transform:'translate(0,0)', opacity:1 }, { transform:`translate(${dx * .6}px,${-up}px)`, opacity:1, offset:.45 }, { transform:`translate(${dx}px,${fxRand(10, 50)}px)`, opacity:0 }], { duration:fxRand(600, 850), easing:'ease-in-out', fill:'forwards' });
    }
  } else if (attr === 'wood') {
    for (let i = 0; i < 3; i++) {
      const a = fxAdd(`left:${x}px;top:${y}px;width:${90 + i * 40}px;height:${90 + i * 40}px;margin:${-(45 + i * 20)}px 0 0 ${-(45 + i * 20)}px;border-radius:50%;border:4px solid transparent;border-top-color:#d8ffc0;border-right-color:#5ee35e;filter:drop-shadow(0 0 6px #5ee35e);`, 800);
      a.animate([{ transform:`scale(.2) rotate(${i * 90}deg)`, opacity:1 }, { transform:`scale(${1.3 * k}) rotate(${i * 90 + 300}deg)`, opacity:0 }], { duration:560, delay:i * 60, easing:'ease-out', fill:'both' });
    }
    for (let i = 0; i < 14; i++) {
      const s = fxRand(10, 18), ang = Math.random() * Math.PI * 2, dist = fxRand(50, 130) * k;
      const l = fxAdd(`left:${x}px;top:${y}px;width:${s}px;height:${s * .55}px;margin:${-s * .28}px 0 0 ${-s / 2}px;border-radius:0 100% 0 100%;background:linear-gradient(135deg,#b8ff90,#2fa83a);box-shadow:0 0 6px #5ee35e;`, 1000);
      l.animate([{ transform:'translate(0,0) rotate(0)', opacity:1 }, { transform:`translate(${Math.cos(ang) * dist}px,${Math.sin(ang) * dist}px) rotate(${fxRand(-540, 540)}deg)`, opacity:0 }], { duration:fxRand(550, 850), easing:'ease-out', fill:'forwards' });
    }
  } else if (attr === 'light') {
    const fl = fxAdd(`left:${x}px;top:${y}px;width:150px;height:150px;margin:-75px 0 0 -75px;border-radius:50%;background:radial-gradient(circle,#fff 0%,rgba(255,240,120,.85) 35%,rgba(255,225,74,0) 70%);`, 600);
    fl.animate([{ transform:'scale(.3)', opacity:1 }, { transform:`scale(${1.4 * k})`, opacity:0 }], { duration:420, easing:'ease-out', fill:'forwards' });
    for (let i = 0; i < 3; i++) {
      let px = 100, py = 0, pts = '100,0';
      for (let j = 1; j <= 7; j++) { py = j * 34; px = j === 7 ? 100 : 100 + fxRand(-34, 34); pts += ` ${px},${py}`; }
      const sx = x + (i - 1) * fxRand(14, 30) - 100, sy = y - 238;
      const svg = fxAdd(`left:${sx}px;top:${sy}px;width:200px;height:240px;`, 500);
      svg.innerHTML = `<svg width="200" height="240" viewBox="0 0 200 240" style="overflow:visible"><polyline points="${pts}" fill="none" stroke="#fffbd0" stroke-width="${4 - i}" stroke-linejoin="round" style="filter:drop-shadow(0 0 6px #ffe14a) drop-shadow(0 0 14px #ffd000)"/></svg>`;
      svg.animate([{ opacity:1 }, { opacity:.2 }, { opacity:1 }, { opacity:0 }], { duration:380, delay:i * 50, fill:'both' });
    }
    for (let i = 0; i < 10; i++) {
      const ang = Math.random() * Math.PI * 2, dist = fxRand(40, 110) * k;
      const sp = fxAdd(`left:${x}px;top:${y}px;width:4px;height:4px;border-radius:50%;background:#fff;box-shadow:0 0 10px #ffe14a;`, 700);
      sp.animate([{ transform:'translate(0,0)', opacity:1 }, { transform:`translate(${Math.cos(ang) * dist}px,${Math.sin(ang) * dist}px)`, opacity:0 }], { duration:fxRand(300, 550), easing:'ease-out', fill:'forwards' });
    }
  } else if (attr === 'dark') {
    const v = fxAdd(`left:${x}px;top:${y}px;width:140px;height:140px;margin:-70px 0 0 -70px;border-radius:50%;background:conic-gradient(from 0deg,#0a0016,#8a3cd6,#0a0016,#5a1a9c,#0a0016);filter:blur(1px);box-shadow:0 0 30px #7a2cc0;`, 800);
    v.animate([{ transform:'scale(.2) rotate(0)', opacity:0 }, { transform:`scale(${1.1 * k}) rotate(-200deg)`, opacity:.95, offset:.35 }, { transform:'scale(.1) rotate(-540deg)', opacity:0 }], { duration:700, easing:'ease-in-out', fill:'forwards' });
    for (let i = 0; i < 12; i++) {
      const ang = Math.random() * Math.PI * 2, dist = fxRand(60, 120) * k, s = fxRand(8, 18);
      const w = fxAdd(`left:${x}px;top:${y}px;width:${s}px;height:${s}px;margin:${-s / 2}px 0 0 ${-s / 2}px;border-radius:50%;background:radial-gradient(circle,#2a0050,rgba(130,50,200,0) 75%);`, 900);
      w.animate([{ transform:`translate(${Math.cos(ang) * dist}px,${Math.sin(ang) * dist}px) scale(1.4)`, opacity:.9 }, { transform:'translate(0,0) scale(.2)', opacity:0 }], { duration:fxRand(450, 700), easing:'ease-in', fill:'forwards' });
    }
  } else {
    createHitEffect(x, y, attr);
  }
}

// ============================================================
// ★ 攻撃アニメーション（複数敵対応） ★
// ============================================================
function attackAnimation(slotIndex, damage, attr, enemyIndex) {
  return new Promise((resolve) => {
    const slots = document.querySelectorAll('#party-grid .party-slot');
    if (slotIndex >= slots.length) { resolve(); return; }
    const slot = slots[slotIndex];
    const enemyUnits = document.querySelectorAll('#enemy-area .enemy-unit');
    if (enemyIndex >= enemyUnits.length) { resolve(); return; }
    const enemyUnit = enemyUnits[enemyIndex];
    if (!slot || !enemyUnit) { resolve(); return; }

    const slotRect = slot.getBoundingClientRect();
    const enemyRect = enemyUnit.getBoundingClientRect();
    const startX = slotRect.left + slotRect.width / 2;
    const startY = slotRect.top + slotRect.height / 2;
    const endX = enemyRect.left + enemyRect.width / 2;
    const endY = enemyRect.top + enemyRect.height / 2;

    const colors = { fire:'#ff5500', water:'#33aaff', wood:'#44dd44', light:'#ffdd44', dark:'#aa55dd', heal:'#ff88aa' };
    const color = colors[attr] || '#ffffff';
    // 攻撃するモンスター側の溜め・踏み込み。盤面の攻撃を「飛ばす」感覚にする。
    spawnCastRing(startX, startY, attr, 1);
    if (slot.animate) slot.animate([
      { transform:'translateY(0) scale(1)' }, { transform:'translateY(-9px) scale(1.11)' },
      { transform:'translateY(2px) scale(.97)' }, { transform:'translateY(0) scale(1)' }
    ], { duration: 360, easing:'cubic-bezier(.18,.82,.28,1)' });

    let resolved = false;
    const applyDamageAndResolve = () => {
      if (resolved) return;
      resolved = true;
      const enemy = enemyList[enemyIndex];
      if (enemy && enemy.hp > 0) {
        playAttrHitSE(attr);   // 攻撃が敵に当たった瞬間の効果音
        const attrMult = getAttrMulti(attr, enemy.attr);
        const def = getEnemyDef(enemy);
        let finalDmg = Math.floor(damage * attrMult * enemyAttrGuardMult(enemy, attr));   // 属性軽減
        finalDmg = Math.max(1, finalDmg - def);   // 最低ダメージ1
        const absorbed = !!(enemy._comboAbsorb && enemy._comboAbsorb.turns > 0 &&
          attackPhaseCombo > 0 && attackPhaseCombo <= enemy._comboAbsorb.max);
        if (absorbed) {
          // コンボ吸収：ダメージの代わりに、その分だけ敵のHPが回復する
          enemy.hp = Math.min(enemy.maxHp, enemy.hp + finalDmg);
        } else {
          finalDmg = enemyTakeDamage(enemy, finalDmg);   // 超根性対応（実際に与えたダメージ）
          if (window.DamageTotal) DamageTotal.add(enemyIndex, finalDmg);   // HPバー上の合計ダメージ
        }
        // 着弾の瞬間に敵本体へノックバックと属性の爆発を重ねる。
        if (enemyUnit && enemyUnit.animate) enemyUnit.animate([
          { transform:'translate(0,0) scale(1)' }, { transform:'translate(-5px,2px) scale(1.06)' },
          { transform:'translate(7px,-2px) scale(.98)' }, { transform:'translate(0,0) scale(1)' }
        ], { duration:230, easing:'ease-out' });
        spawnEnergyBurst(endX, endY, attr, attrMult > 1 ? 1.45 : 1);
        if (absorbed) {
          const ab = document.createElement('div');
          ab.style.cssText = `position:fixed;left:${endX}px;top:${endY-10}px;transform:translate(-50%,-50%);font-size:1.25rem;font-weight:900;color:#7dff9a;text-shadow:0 0 8px #000,0 2px 0 #000;pointer-events:none;z-index:230;white-space:nowrap;animation:dmgPop ${DMG_NUM_MS}ms ease-out forwards;`;
          ab.textContent = `吸収! +${finalDmg.toLocaleString()}`;
          document.body.appendChild(ab);
          setTimeout(() => ab.remove(), DMG_NUM_MS + 100);
        } else showDamageNumber(endX, endY - 10, finalDmg, attr, attrMult > 1, slotIndex);
      }
      spawnAttrImpact(attr, endX, endY, false);
      updateEnemyUI();
      if (enemy && enemy.hp <= 0) tryDrop(enemy);
      resolve();
    };

    flyAttrProjectile(startX, startY, endX, endY, attr, ATK_FLY_MS).then(applyDamageAndResolve);
  });
}

// 攻撃弾を飛ばす（単体攻撃・全体攻撃で共通）。相手に届いた瞬間に resolve する
function flyAttrProjectile(startX, startY, endX, endY, attr, duration = ATK_FLY_MS) {
  return new Promise((resolve) => {
    const projectile = makeAttrProjectile(attr);
    projectile.style.left = startX + 'px';
    projectile.style.top = startY + 'px';
    projectile.style.transform = 'translate(-50%, -50%) scale(0.6)';
    document.body.appendChild(projectile);

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (projectile.parentNode) projectile.remove();
      resolve();
    };
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2 - 60;

    let startTime = null;
    function animStep(now) {
      if (done) return;
      if (!startTime) startTime = now;
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const mt = 1 - t;
      const cx = mt*mt*startX + 2*mt*t*midX + t*t*endX;
      const cy = mt*mt*startY + 2*mt*t*midY + t*t*endY;
      const scale = 0.6 + t * 1.4;
      const tdx = 2*mt*(midX - startX) + 2*t*(endX - midX);
      const tdy = 2*mt*(midY - startY) + 2*t*(endY - midY);
      const ang = Math.atan2(tdy, tdx);
      projectile.style.left = cx + 'px';
      projectile.style.top = cy + 'px';
      projectile.style.transform = `translate(-50%, -50%) rotate(${ang}rad) scale(${scale})`;
      spawnAttrTrail(attr, cx, cy, ang);
      if (t < 1) requestAnimationFrame(animStep);
      else finish();
    }
    requestAnimationFrame(animStep);
    setTimeout(finish, duration + 300);
  });
}

// （全体攻撃の演出・ダメージ処理は js/allattack-fx.js に移動：allAttackAnimation）

// ============================================================
// ゲーム初期化
// ============================================================
document.getElementById('start').addEventListener('click', async () => {
  try { (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen).call(document.documentElement); } catch(e) {}
  document.getElementById('start').style.display = 'none';
  document.getElementById('game').style.display = 'flex';
  stopMenuBGM();
  init();
});

// ============================================================
// エリア・ステージデータ
// ============================================================
const AREA_NAMES = {
  1:'ハジマリ草原', 2:'霧の森',    3:'炎の山道',   4:'氷河の洞窟',
  5:'砂漠の神殿',  6:'天空の城',  7:'魔王の塔',   8:'深淵の海',
  9:'古代の遺跡',  10:'神々の頂'
};
const STAGE_BATTLE_COUNTS = { '1':3, '2':5, 'boss':7 };
const STAGE_ENEMY_HP     = { '1':1500, '2':3000, 'boss':8000 };
const STAGE_ENEMY_NAMES  = { '1': 'スライム', '2': 'ゴブリン', 'boss': '???ボス' };

// ★ ボスクリアの記録（クリア済みエリア番号。ブラウザに保存） ★
const CLEARED_DUNGEONS_KEY = 'puzzdra_clearedDungeons';
const clearedDungeons = new Set();
(function () {
  let raw = null;
  try { raw = localStorage.getItem(CLEARED_DUNGEONS_KEY); } catch (e) {}
  if (raw !== null) { try { JSON.parse(raw).forEach(k => clearedDungeons.add(String(k))); } catch (e) {} }
  else {
    // 旧データ引き継ぎ：すでにボスをクリアしたエリアは、そのエリアのダンジョンを全部クリア済み扱いにする
    try {
      JSON.parse(localStorage.getItem('puzzdra_clearedBosses') || '[]').forEach(n => {
        Object.keys(DUNGEON_DATA).forEach(k => { if (k.startsWith(Number(n) + '-')) clearedDungeons.add(k); });
      });
    } catch (e) {}
  }
})();
function markDungeonCleared(key) {
  if (!key || clearedDungeons.has(key)) return;
  clearedDungeons.add(key);
  try { localStorage.setItem(CLEARED_DUNGEONS_KEY, JSON.stringify([...clearedDungeons])); } catch (e) {}
}
function isDungeonCleared(key) { return clearedDungeons.has(key); }
// ステージのクリア判定（ロック用）。エリアのBOSSをクリア済みなら、そのエリアの前のステージは全部クリア済み扱い
function isStageCleared(area, stageKey) {
  return clearedDungeons.has(`${area}-${stageKey}`) || (typeof clearedBosses !== 'undefined' && clearedBosses.has(area));
}

const CLEARED_BOSSES_KEY = 'puzzdra_clearedBosses';
const clearedBosses = new Set();
try { JSON.parse(localStorage.getItem(CLEARED_BOSSES_KEY) || '[]').forEach(n => clearedBosses.add(Number(n))); } catch (e) {}
// 初めてクリアしたら true（次のエリアが開放される）
function markBossCleared(n) {
  if (clearedBosses.has(n)) return false;
  clearedBosses.add(n);
  try { localStorage.setItem(CLEARED_BOSSES_KEY, JSON.stringify([...clearedBosses])); } catch (e) {}
  return true;
}
let currentAreaNum   = 1;
let currentStageType = '1';

// ============================================================
// ★ ランダムバトルの組み立て ★
//   dungeonData.random があれば、floors 回ぶん patterns から weight で抽選して
//   ランダム階層を作り、そのあとに固定の battles（ボス等）を続ける。
//   random が無いダンジョンは、今まで通り battles をそのまま使う。
// ============================================================
function buildDungeonBattles(d) {
  const r = d && d.random;
  if (!r || !r.monsters || !Array.isArray(r.patterns) || !r.patterns.length) return d.battles;
  const floors = Math.max(1, Math.min(6, Math.floor(r.floors) || 1));
  const w = p => Math.max(0, Number(p.weight) || 0);
  const total = r.patterns.reduce((s, p) => s + w(p), 0);
  const pick = () => {
    if (total <= 0) return r.patterns[Math.floor(Math.random() * r.patterns.length)];
    let x = Math.random() * total;
    for (const p of r.patterns) { x -= w(p); if (x < 0) return p; }
    return r.patterns[r.patterns.length - 1];
  };
  const out = [];
  for (let i = 0; i < floors; i++) {
    const enemies = (pick().enemies || []).slice(0, 9)
      .map(k => r.monsters[k]).filter(Boolean)
      .map(e => JSON.parse(JSON.stringify(e)));
    if (enemies.length) out.push({ enemies });
  }
  return out.concat(d.battles || []);
}
// ============================================================
// ★ 乱入モンスター ★
//   dungeonData.intrusion = { rate: 20, monsters: [ {敵データ}, ... ] }
//   ・ダンジョンに入った時に1回だけ rate(%) で抽選する（バトルごとの抽選ではない）。
//   ・当たったら、登録されている monsters 全員が乱入する（1匹登録なら1匹、2匹登録なら2匹確定）。
//   ・乱入モンスターは「ボス以外で、同じサイズ（S/M/L/XL）の敵」とランダムに入れ替わる。
//     2匹以上のときは、入れ替え先がバラバラのバトルになることも、同じバトルになることもある。
//   ・同じサイズの入れ替え先が無い乱入モンスターは出ない。
//   ・ステータス・行動・ドロップは通常の敵と同じ（敵データをそのまま使う）。
// ============================================================
function applyIntrusion(d, battles) {
  const it = d && d.intrusion;
  if (!it || !Array.isArray(it.monsters) || !it.monsters.length || !Array.isArray(battles) || !battles.length) return battles;
  const rate = Math.max(0, Math.min(100, Number(it.rate) || 0));
  if (!(Math.random() * 100 < rate)) return battles;           // 外れ：何も変えない
  const out = JSON.parse(JSON.stringify(battles));             // 元データ（DUNGEON_DATA）は書き換えない
  const used = new Set();
  const placed = [];
  for (const src of it.monsters) {
    if (!src) continue;
    const size = src.size || 'S';
    const slots = [];
    out.forEach((b, bi) => (b.enemies || []).forEach((e, ei) => {
      if (e && !e.isBoss && (e.size || 'S') === size && !used.has(bi + '-' + ei)) slots.push([bi, ei]);
    }));
    if (!slots.length) continue;                               // 同じサイズの入れ替え先なし
    const [bi, ei] = slots[Math.floor(Math.random() * slots.length)];
    used.add(bi + '-' + ei);
    out[bi].enemies[ei] = JSON.parse(JSON.stringify(src));
    placed.push(`${bi + 1}戦目・${ei + 1}体目 ← ${src.name || '?'}`);
  }
  if (placed.length) console.info('[乱入]', placed.join(' / '));
  return out;
}
function dungeonBattleCount(key) {
  const d = DUNGEON_DATA[key];
  if (!d || !d.random) return null;
  return Math.max(1, Math.min(6, Math.floor(d.random.floors) || 1)) + (d.battles ? d.battles.length : 0);
}

function isAreaUnlocked(n) { return n === 1 || clearedBosses.has(n - 1); }
function isAreaBossCleared(n) { return clearedBosses.has(n); }
// 隠しエリア（AREA_DATA の hidden:true）：開放されるまで存在自体を見せない
function isAreaHidden(n) { return !!(typeof AREA_DATA !== 'undefined' && AREA_DATA[n] && AREA_DATA[n].hidden) && !isAreaUnlocked(n); }

// エリアの名前・背景・色は js/data/areas.js（AREA_DATA）で設定する
const AREA_INFO = (typeof AREA_DATA !== 'undefined' && AREA_DATA) || {};
const TOTAL_STAGES = Math.max(10, ...Object.keys(AREA_INFO).map(Number));
const AREA_HUES = [120,170,18,200,40,215,275,225,28,48]; // エリア1〜10の色相（AREA_DATA に hue があればそちらを優先）
for (const k in AREA_INFO) {
  if (AREA_INFO[k].name) AREA_NAMES[k] = AREA_INFO[k].name;
  if (AREA_INFO[k].hue != null) AREA_HUES[k - 1] = AREA_INFO[k].hue;
}
// ★ イベントステージ（js/data/areas.js の EVENT_AREA_DATA。イベントIDは文字列。ダンジョンのキーは「イベントID-番号」） ★
const EVENT_INFO = (typeof EVENT_AREA_DATA !== 'undefined' && EVENT_AREA_DATA) || {};
const EVENT_UNLOCK = (typeof EVENT_UNLOCK_AREA !== 'undefined' && EVENT_UNLOCK_AREA) || 6;
function isEventArea(a) { return typeof a === 'string' && Object.prototype.hasOwnProperty.call(EVENT_INFO, a); }
function isMultiArea(a) { return typeof MULTI_AREA_IDS !== 'undefined' && MULTI_AREA_IDS.indexOf(a) >= 0; }
function isEventUnlocked() { return isAreaBossCleared(EVENT_UNLOCK); }
function areaNameOf(a) { return isEventArea(a) ? (EVENT_INFO[a].name || String(a)) : (AREA_NAMES[a] || `エリア${a}`); }
function areaHue(a) {
  if (isEventArea(a)) return EVENT_INFO[a].hue != null ? EVENT_INFO[a].hue : 200;
  return AREA_HUES[a - 1] != null ? AREA_HUES[a - 1] : 200;
}
// エリアの大きな数字(1,2,3…)の色。areas.js の color で指定（赤・青・緑・黄・紫・白・黒、または red/blue… や #ff0000 などCSSの色）
const AREA_NUM_COLORS = {
  '赤':'#ff3b30','red':'#ff3b30', '青':'#2f7bff','blue':'#2f7bff', '緑':'#2fc25b','green':'#2fc25b',
  '黄':'#ffd400','黄色':'#ffd400','yellow':'#ffd400', '紫':'#9b4dff','purple':'#9b4dff',
  '白':'#ffffff','white':'#ffffff', '黒':'#000000','black':'#000000'
};
function areaNumColor(a) {
  const info = isEventArea(a) ? EVENT_INFO[a] : AREA_INFO[a];
  const c = info && info.color;
  if (!c) return null;
  return AREA_NUM_COLORS[String(c).trim().toLowerCase()] || c;
}
// ============================================================
// ★ おふだ（入場チケット）／日替わりダンジョン ★
//   設定は js/data/areas.js（EVENT_AREA_DATA の entryItem / entryCost、DAILY_DUNGEON）と js/data/items.js
// ============================================================
const DAILY_INFO = (typeof DAILY_DUNGEON !== 'undefined' && DAILY_DUNGEON) || null;
const WEEKDAY_JP = ['日', '月', '火', '水', '木', '金', '土'];
// 今日の曜日（0=日〜6=土）。テスト用に、URL の末尾に ?dow=3 を付けるとその曜日として動く
function todayDow() {
  try {
    const m = /[?&]dow=([0-6])(?:&|$)/.exec(location.search);
    if (m) return Number(m[1]);
  } catch (e) {}
  return new Date().getDay();
}
function dailyEventIdFor(dow) {
  const id = DAILY_INFO && DAILY_INFO.days && DAILY_INFO.days[dow];
  return (id && isEventArea(id)) ? id : null;
}
function dailyTodayId() { return dailyEventIdFor(todayDow()); }
// その日替わりダンジョン（イベントID）が何曜日のものか。日替わりでなければ -1
function dailyDowOf(a) {
  if (!DAILY_INFO || !DAILY_INFO.days || !isEventArea(a)) return -1;
  for (let d = 0; d < 7; d++) if (DAILY_INFO.days[d] === a) return d;
  return -1;
}
function isDailyArea(a) { return dailyDowOf(a) >= 0; }
// イベントに入るときに消費するアイテム { item, cost }。消費なしなら null
function eventEntry(a) {
  if (!isEventArea(a)) return null;
  const ev = EVENT_INFO[a], daily = isDailyArea(a);
  const item = ev.entryItem || (daily && DAILY_INFO.item) || null;
  if (!item || !ITEM_DATA[item]) return null;
  let cost = ev.entryCost !== undefined ? ev.entryCost : (daily && DAILY_INFO.cost !== undefined ? DAILY_INFO.cost : 1);
  cost = Math.floor(Number(cost));
  if (!Number.isFinite(cost)) cost = 1;
  return cost > 0 ? { item, cost } : null;
}
// おふだの絵（画像が無いときは「札」マークの代わりの絵が見える）
function ofudaIconHtml(itemId) {
  const def = ITEM_DATA[itemId];
  if (!def) return '';
  return `<span class="ofuda-ico"><img src="${def.img}" alt="${def.name}" onload="this.parentNode.classList.add('ok')" onerror="this.style.visibility='hidden'"></span>`;
}
// 「いま いくつ持っているか」のUI（日替わりダンジョン・けいけんパークのカード／ステージ選択に出す）
function ofudaChipHtml(itemId) {
  const def = ITEM_DATA[itemId];
  if (!def) return '';
  return `<span class="ofuda-chip" title="${def.name}">${ofudaIconHtml(itemId)}<span class="ofuda-txt"><small>${def.name}</small><b>×${getItemCount(itemId)}</b></span></span>`;
}

// ============================================================
// ★ ログインボーナス（24時間ごとに「ようびのおふだ」） ★
//   設定は js/data/items.js の LOGIN_BONUS。最後に受け取った時刻は loginBonusAt（セーブに保存）
//   ホームを開いたとき／アプリに戻ってきたときに、前回から24時間たっていればもらえる
// ============================================================
function loginBonusReady() {
  if (typeof LOGIN_BONUS === 'undefined' || !LOGIN_BONUS || !ITEM_DATA[LOGIN_BONUS.item]) return false;
  const now = Date.now();
  const interval = Math.max(1, Number(LOGIN_BONUS.intervalHours) || 24) * 3600000;
  if (!loginBonusAt) return true;                       // まだ一度ももらっていない
  if (loginBonusAt > now + 300000) {                    // 端末の時計が過去に戻された：ここから数え直す（ずっともらえなくなるのを防ぐ）
    loginBonusAt = now; saveGame();
    return false;
  }
  return now - loginBonusAt >= interval;
}
// ── 8コンボボーナス：1周期（ログインボーナスと同じリセット）に1回、8コンボ以上するとホームに戻ったとき +1枚 ──
function combo8Need() { return Math.max(1, Math.floor(Number(typeof LOGIN_BONUS !== 'undefined' && LOGIN_BONUS && LOGIN_BONUS.comboNeed)) || 8); }
function combo8Count() { return Math.max(1, Math.floor(Number(typeof LOGIN_BONUS !== 'undefined' && LOGIN_BONUS && LOGIN_BONUS.comboCount)) || 1); }
function syncCombo8Period() {   // ログインボーナスを受け取って周期が変わっていたら、リセット
  if (combo8Bonus.period !== loginBonusAt) combo8Bonus = { period: loginBonusAt, reached: false, claimed: false };
}
function markCombo8Bonus(combo) {
  try {
    if (typeof LOGIN_BONUS === 'undefined' || !LOGIN_BONUS || !ITEM_DATA[LOGIN_BONUS.item]) return;
    if (!(combo >= combo8Need())) return;
    syncCombo8Period();
    if (combo8Bonus.reached || combo8Bonus.claimed) return;
    combo8Bonus.reached = true;
    saveGame();
  } catch (e) { console.warn('[combo8 bonus]', e); }
}
function showLoginBonusPopup(itemId, n) {
  const def = ITEM_DATA[itemId], root = document.getElementById('login-bonus');
  if (!def || !root) return;
  const ico = document.getElementById('lb-ico');
  ico.innerHTML = ofudaIconHtml(itemId);
  document.getElementById('lb-name').textContent = def.name;
  document.getElementById('lb-count').textContent = `×${n}`;
  document.getElementById('lb-have').textContent = `いま ${getItemCount(itemId)}枚 もっているよ`;
  root.classList.add('show');
  try { playSE('chip'); } catch (e) {}
}
function checkLoginBonus() {
  try {
    const home = document.getElementById('home'), root = document.getElementById('login-bonus');
    if (!home || !root || home.style.display !== 'flex') return;     // ホームが出ているときだけ
    if (root.classList.contains('show')) return;                      // 表示中
    if (typeof LOGIN_BONUS === 'undefined' || !LOGIN_BONUS || !ITEM_DATA[LOGIN_BONUS.item]) return;
    syncCombo8Period();
    const comboPending = combo8Bonus.reached && !combo8Bonus.claimed;   // 8コンボ達成ぶん（周期が変わる前に先に受け取る）
    const loginReady = loginBonusReady();
    if (!comboPending && !loginReady) return;
    const id = LOGIN_BONUS.item;
    let n = 0;
    if (loginReady) n += Math.max(1, Math.floor(Number(LOGIN_BONUS.count)) || 1);
    if (comboPending) { n += combo8Count(); combo8Bonus.claimed = true; }
    itemInventory[id] = getItemCount(id) + n;
    if (loginReady) { loginBonusAt = Date.now(); syncCombo8Period(); }   // 新しい周期＝8コンボボーナスもリセット
    saveGame();
    showLoginBonusPopup(id, n);
    if (homeMode === 'event') buildStageMap();                        // カードのおふだの数を更新
  } catch (e) { console.warn('[login bonus]', e); }
}
document.getElementById('lb-ok-btn').addEventListener('click', () => {
  document.getElementById('login-bonus').classList.remove('show');
  if (homeMode === 'event') buildStageMap();
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(checkLoginBonus, 300); });

// ステージの短い表記（メイン: 3-2 / 3-BOSS ・ イベント: ステージ 2 / BOSS）
function stageShortLabel(area, key) {
  const k = key === 'boss' ? 'BOSS' : key;
  return isEventArea(area) ? (key === 'boss' ? 'BOSS' : `ステージ ${k}`) : `${area}-${k}`;
}
function areaBgImage(n) {
  if (isEventArea(n)) {
    if (EVENT_INFO[n].bg) return EVENT_INFO[n].bg;
    const de = DUNGEON_DATA[n + '-1'];
    return (de && de.bgImg) || 'dungeon1.png';
  }
  if (AREA_INFO[n] && AREA_INFO[n].bg) return AREA_INFO[n].bg;
  const d = DUNGEON_DATA[n + '-1'] || DUNGEON_DATA[n + '-2'];
  return (d && d.bgImg) || ('dungeon' + n + '.png');
}
// そのエリアのステージ一覧を DUNGEON_DATA のキー（「エリア-ステージ」）から自動で作る
// 数字の順 → boss が最後。データが無いエリアは従来どおり 1 / 2 / BOSS の仮ステージ。
function getStageList(area) {
  const pre = area + '-';
  const keys = Object.keys(DUNGEON_DATA).filter(k => k.startsWith(pre)).map(k => k.slice(pre.length));
  if (!keys.length && isEventArea(area)) return [];   // イベントは仮ステージを出さない
  if (!keys.length) {
    return [ { key:'1', label:`ステージ ${area}-1`, battles:3, boss:false },
             { key:'2', label:`ステージ ${area}-2`, battles:5, boss:false },
             { key:'boss', label:`ステージ ${area}-BOSS`, battles:7, boss:true } ];
  }
  const ord = k => /^\d+$/.test(k) ? Number(k) : (k === 'boss' ? 1e9 : 1e6);
  keys.sort((a, b) => ord(a) - ord(b) || a.localeCompare(b));
  return keys.map(key => {
    const boss = key === 'boss', dk = pre + key, d = DUNGEON_DATA[dk];
    const battles = dungeonBattleCount(dk) || (d && d.battles && d.battles.length) || 3;
    let label = boss ? `ステージ ${area}-BOSS` : `ステージ ${area}-${key}`;
    if (isEventArea(area)) {
      const custom = EVENT_INFO[area].stageNames && EVENT_INFO[area].stageNames[key];
      label = custom || (boss ? 'BOSS' : `ステージ ${key}`);
    }
    // ステージ名の下に出す小さな文字（初級・中級 など）。areas.js の stageLevels で指定
    const level = (isEventArea(area) && EVENT_INFO[area].stageLevels && EVENT_INFO[area].stageLevels[key]) || '';
    return { key, label, battles, boss, level };
  });
}
// ステージ選択・パーティ選択(潜入確認)画面の上部バナーを、そのエリアの画像に差し替える
// （css/ui.css の --area-art / --h を使う。画像が無ければ、エリアの色相のグラデーションになる）
function applyAreaBackground(elId, n) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.style.setProperty('--area-art', `url('${new URL(areaBgImage(n), document.baseURI).href}')`);
  el.style.setProperty('--h', areaHue(n));
}
// ホームの表示モード：'main'（メインのエリア一覧）／'event'（イベントステージ一覧）。右上のボタンで切り替え
let homeMode = 'main';   // 'main' | 'event' | 'multi'
function buildStageMap() {
  if (homeMode === 'event' && !isEventUnlocked()) homeMode = 'main';
  if (homeMode === 'event') buildEventMap(); else if (homeMode === 'multi') buildMultiMap(); else buildMainMap();
  updateModeBtn();
}
const HOME_MODES = [
  { key: 'main',  label: 'メイン',   icon: '#i-map' },
  { key: 'event', label: 'イベント', icon: '#i-event' },
  { key: 'multi', label: 'マルチ',   icon: '#i-multi' },
];
function updateModeBtn() {
  const btn = document.getElementById('mode-toggle-btn');
  if (!btn) return;
  const cur = HOME_MODES.find(m => m.key === homeMode) || HOME_MODES[0];
  btn.classList.toggle('is-multi', homeMode === 'multi');
  btn.setAttribute('aria-label', `表示中：${cur.label}（タップで切り替え）`);
  const use = btn.querySelector('use');
  if (use) use.setAttribute('href', cur.icon);          // いま表示中のモードのアイコン
  const lbl = btn.querySelector('.hh-lbl');
  if (lbl) lbl.textContent = cur.label;
  renderModeMenu();
}
function renderModeMenu() {
  const menu = document.getElementById('mode-menu');
  if (!menu) return;
  menu.innerHTML = '';
  HOME_MODES.forEach(m => {
    const it = document.createElement('button');
    it.type = 'button'; it.setAttribute('role', 'menuitem');
    const locked = m.key === 'event' && !isEventUnlocked();
    it.className = 'mm-item ' + m.key + (m.key === homeMode ? ' on' : '') + (locked ? ' locked' : '');
    it.innerHTML = `<svg class="ic"><use href="${m.icon}"/></svg><span>${m.label}</span>`;
    it.addEventListener('click', (e) => { e.stopPropagation(); selectHomeMode(m.key); });
    menu.appendChild(it);
  });
}
function closeModeMenu() {
  const menu = document.getElementById('mode-menu'), btn = document.getElementById('mode-toggle-btn');
  if (menu) menu.hidden = true;
  if (btn) btn.setAttribute('aria-expanded', 'false');
}
function openModeMenu() {
  const menu = document.getElementById('mode-menu'), btn = document.getElementById('mode-toggle-btn');
  if (!menu || !btn) return;
  renderModeMenu();
  menu.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
  const r = btn.getBoundingClientRect();
  menu.style.top = (r.bottom + 8) + 'px';
  const mw = menu.offsetWidth;
  menu.style.left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.right - mw)) + 'px';
}
function selectHomeMode(key) {
  closeModeMenu();
  if (key === 'event' && !isEventUnlocked()) {
    homeToast(`エリア${EVENT_UNLOCK}をクリアするとイベントステージが開放されます`, 2200);
    return;
  }
  if (key === homeMode) return;
  homeMode = key;
  buildStageMap();
  scrollHomeToFrontier();
}
function buildEventMap() {
  const map = document.getElementById('stage-map');
  map.innerHTML = '';
  map.classList.add('event');
  const head = document.createElement('div');
  head.className = 'ev-head'; head.textContent = 'イベントステージ';
  map.appendChild(head);
  const ids = Object.keys(EVENT_INFO).filter(id => !EVENT_INFO[id].hidden);
  const dailyId = dailyTodayId();
  if (dailyId) map.appendChild(buildDailyCard(dailyId));   // 日替わりダンジョン（今日の曜日のぶん）は一番上
  if (!ids.length && !dailyId) {
    const em = document.createElement('div'); em.className = 'ev-empty'; em.textContent = 'いまはイベントがありません';
    map.appendChild(em);
  }
  ids.forEach(id => map.appendChild(buildEventBand(id)));
}
function buildEventBand(id) {
  const ev = EVENT_INFO[id];
  const b = document.createElement('div');
  b.className = 'area-band evt';
  b.style.setProperty('--h', areaHue(id));
  const art = document.createElement('span');
  art.className = 'area-art';
  art.style.backgroundImage = `url('${areaBgImage(id)}')`;
  const text = document.createElement('span'); text.className = 'area-text';
  if (ev.desc) { const ds = document.createElement('span'); ds.className = 'area-sub'; ds.textContent = ev.desc; text.appendChild(ds); }
  const nm = document.createElement('span'); nm.className = 'area-name fit1';   // fit1 = 長い行は縮めて絵にかからないよう収める
  // bannerName があればそれを表示（\n で改行。例 'ハッピー\nハロウィン'）。無ければ name を1行で
  (ev.bannerName || ev.name || id).split('\n').forEach((ln, i) => { if (i) nm.appendChild(document.createElement('br')); nm.appendChild(document.createTextNode(ln)); });
  text.appendChild(nm);
  const ent = eventEntry(id);   // 入るのにおふだが要るイベント：持っている数を出す
  if (ent) { const row = document.createElement('span'); row.className = 'ofuda-row'; row.innerHTML = ofudaChipHtml(ent.item); text.appendChild(row); }
  const go = document.createElement('button');
  go.type = 'button'; go.className = 'area-state area-go';
  go.innerHTML = '挑戦<svg class="ic"><use href="#i-chev"/></svg>';
  go.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!getStageList(id).length) { homeToast('準備中です'); return; }
    openStageSelect(id);
  });
  b.appendChild(art); b.appendChild(text); b.appendChild(go);
  fitAreaNameObserve(b);
  return b;
}
// マルチプレイステージ一覧（ホームの「マルチ」ボタン）。バナーはイベントと同じ作り
function buildMultiMap() {
  const map = document.getElementById('stage-map');
  map.innerHTML = '';
  map.classList.add('event');
  const head = document.createElement('div');
  head.className = 'ev-head'; head.textContent = 'マルチプレイステージ';
  map.appendChild(head);
  const ids = MULTI_AREA_IDS.filter(id => isEventArea(id));
  if (!ids.length) {
    const em = document.createElement('div'); em.className = 'ev-empty'; em.textContent = 'いまはマルチステージがありません';
    map.appendChild(em);
  }
  ids.forEach(id => map.appendChild(buildEventBand(id)));
}
// 日替わりダンジョンのカード（今日の曜日のバナー＋ダンジョン名＋ようびのおふだの所持数＋1週間のカレンダー）
function buildDailyCard(id) {
  const ev = EVENT_INFO[id], dow = todayDow();
  const card = document.createElement('div');
  card.className = 'daily-card';
  const b = document.createElement('div');
  b.className = 'area-band evt daily';
  b.style.setProperty('--h', areaHue(id));
  const art = document.createElement('span');
  art.className = 'area-art';
  art.style.backgroundImage = `url('${areaBgImage(id)}')`;   // 曜日ごとのバナー画像
  const text = document.createElement('span'); text.className = 'area-text';
  const sub = document.createElement('span'); sub.className = 'area-sub';
  sub.textContent = `${(DAILY_INFO && DAILY_INFO.name) || '日替わりダンジョン'} ・ ${WEEKDAY_JP[dow]}曜日`;
  const nm = document.createElement('span'); nm.className = 'area-name fit1'; nm.textContent = ev.name || id;   // fit1 = 長い名前は縮めて1行に収める
  text.appendChild(sub); text.appendChild(nm);
  const ent = eventEntry(id);
  if (ent) { const row = document.createElement('span'); row.className = 'ofuda-row'; row.innerHTML = ofudaChipHtml(ent.item); text.appendChild(row); }
  const go = document.createElement('button');
  go.type = 'button'; go.className = 'area-state area-go';
  go.innerHTML = '挑戦<svg class="ic"><use href="#i-chev"/></svg>';
  go.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dailyTodayId() !== id) { homeToast('日付が変わりました'); buildStageMap(); return; }   // 0:00をまたいだとき
    if (!getStageList(id).length) { homeToast('準備中です'); return; }
    openStageSelect(id);
  });
  b.appendChild(art); b.appendChild(text); b.appendChild(go);
  card.appendChild(b);
  fitAreaNameObserve(b);

  // 1週間のカレンダー（今日を光らせる）＋あしたの予告
  const week = document.createElement('div');
  week.className = 'daily-week';
  const days = [1, 2, 3, 4, 5, 6, 0].map(d => `<span class="dw-day${d === dow ? ' today' : ''}">${WEEKDAY_JP[d]}</span>`).join('');
  const nextDow = (dow + 1) % 7, nextId = dailyEventIdFor(nextDow);
  const now = new Date(), midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const hrs = Math.max(1, Math.ceil((midnight - now) / 3600000));
  const note = nextId ? `あしたは ${WEEKDAY_JP[nextDow]}曜日：${EVENT_INFO[nextId].name}（あと約${hrs}時間で切りかわり）` : '';
  week.innerHTML = `<div class="dw-row">${days}</div>` + (note ? `<div class="dw-note"></div>` : '');
  if (note) week.querySelector('.dw-note').textContent = note;
  card.appendChild(week);
  return card;
}
function buildMainMap() {
  const map = document.getElementById('stage-map');
  map.innerHTML = '';
  map.classList.remove('event');
  // 開放済みの最先端エリア＋先2つまで表示（それより先は非表示）
  let frontierArea = 1;
  for (let k = 1; k <= TOTAL_STAGES; k++) if (isAreaUnlocked(k)) frontierArea = k;
  const maxVisibleArea = Math.min(TOTAL_STAGES, frontierArea + 2);
  for (let n = maxVisibleArea; n >= 1; n--) {
    if (isAreaHidden(n)) continue;   // 隠しエリアは前のボスをクリアするまで描画しない
    const unlocked = isAreaUnlocked(n), cleared = isAreaBossCleared(n);
    const state = !unlocked ? 'locked' : cleared ? 'cleared' : 'unlocked';
    const b = document.createElement('div');
    b.className = 'area-band ' + state;
    b.style.setProperty('--h', areaHue(n));
    b.dataset.area = n; b.dataset.num = n;
    { const nc = areaNumColor(n); if (nc) { b.style.setProperty('--num-color', nc); b.style.setProperty('--num-opacity', '0.3'); if (/^(#fff(fff)?|white)$/i.test(nc)) b.style.setProperty('--num-stroke', '2px rgba(26,26,60,0.35)'); } }
    const sub = cleared ? `エリア ${n} ・ クリア済み` : unlocked ? `エリア ${n} ・ 挑戦中` : `エリア ${n}`;
    const icChev = '<svg class="ic"><use href="#i-chev"/></svg>';
    const icLock = '<svg class="ic"><use href="#i-lock"/></svg>';
    const stateHtml = unlocked
      ? `<button type="button" class="area-state area-go">挑戦${icChev}</button>`
      : `<span class="area-state">${icLock}未開放</span>`;
    // マップ背景画像を右側の絵に（画像が無い場合は色相のグラデーション＋しま模様）
    b.innerHTML = `<span class="area-node"></span><span class="area-art" style="background-image:url('${areaBgImage(n)}')"></span><span class="area-text"><span class="area-sub">${sub}</span><span class="area-name fit1">${AREA_NAMES[n] || 'エリア' + n}</span></span>${stateHtml}`;
    fitAreaNameObserve(b);
    if (unlocked) b.querySelector('.area-go').addEventListener('click', (e) => { e.stopPropagation(); openStageSelect(n); });
    map.appendChild(b);
  }
  // 横画面は左→右へ「エリア1, 2, 3…」の順に並べる（縦画面は上が最新のまま）
  if (window.isLandscapeHome && window.isLandscapeHome()) Array.from(map.children).reverse().forEach(c => map.appendChild(c));
}
// エリア名を「1行のまま」右の画像（斜めの境目）にはみ出さないように、長い名前だけ文字を縮めて収める
function fitAreaName(band) {
  const art = band.querySelector('.area-art');
  if (!art) return;
  const br = band.getBoundingClientRect();
  if (!br.width) return;   // 非表示中（表示された時にObserverが再計算する）
  // 対象：エリア名（fit1）と、イベントカードの説明文（area-sub）
  const targets = [band.querySelector('.area-name.fit1')];
  if (band.classList.contains('evt')) targets.push(band.querySelector('.area-sub'));
  for (const nm of targets) {
    if (!nm) continue;
    nm.style.fontSize = '';
    const ar = art.getBoundingClientRect();
    const nr = nm.getBoundingClientRect();
    const yFrac = Math.min(1, Math.max(0, ((nr.top + nr.bottom) / 2 - ar.top) / ar.height));
    // 画像の左の境目は上が26%・下が0%の斜め線（clip-path）。文字の高さでの境目のx座標
    const edge = ar.left + ar.width * 0.26 * (1 - yFrac);
    const avail = edge - 10 - nr.left;
    const base = parseFloat(getComputedStyle(nm).fontSize);
    const w = nm.scrollWidth;
    if (avail > 0 && w > avail) nm.style.fontSize = Math.max(9, base * avail / w * 0.98) + 'px';
  }
}
function fitAreaNameObserve(band) {
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => fitAreaName(band)).observe(band);
  else requestAnimationFrame(() => fitAreaName(band));
}
let homeFocusArea = 0;   // リタイア/クリアしたエリア番号（ホームのスクロール位置に使う）
function setHomeFocusFromCurrent() {
  homeFocusArea = (typeof isEventArea === 'function' && isEventArea(currentAreaNum)) || (typeof isDailyArea === 'function' && isDailyArea(currentAreaNum)) ? 0 : (currentAreaNum || 0);
}
function scrollHomeToFrontier() {
  const sc = document.getElementById('home-scroll');
  const land = !!(window.isLandscapeHome && window.isLandscapeHome());
  if (homeMode === 'event' || homeMode === 'multi') { if (sc) { sc.scrollTop = 0; sc.scrollLeft = 0; } return; }
  let t = null;
  if (homeFocusArea) t = document.querySelector(`.area-band[data-area="${homeFocusArea}"]`);   // リタイア/クリアした直後はそのエリアの位置へ
  if (!t) t = document.querySelector('.area-band.unlocked') || document.querySelector('.area-band.cleared');
  if (!sc || !t) return;
  if (land) {   // 横画面：そのエリアが画面の真ん中に来るよう、横にスクロール（アニメなしで即移動）
    const prev = sc.style.scrollBehavior; sc.style.scrollBehavior = 'auto';
    sc.scrollLeft = Math.max(0, t.offsetLeft - (sc.clientWidth - t.offsetWidth) / 2);
    sc.style.scrollBehavior = prev;
    return;
  }
  sc.scrollTop = Math.max(0, t.offsetTop - (sc.clientHeight - t.offsetHeight) / 2);
}
let homeToastTimer = null;
function homeToast(msg, ms = 1400) {
  const t = document.getElementById('home-toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(homeToastTimer);
  homeToastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
document.querySelectorAll('#home [data-soon]').forEach(b => b.addEventListener('click', () => homeToast('準備中です')));
// 右上ボタン：タップするとタブ（メイン／イベント／マルチ）が開いて選べる。イベントはエリア6（EVENT_UNLOCK）クリアまで使えない
document.getElementById('mode-toggle-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  const menu = document.getElementById('mode-menu');
  if (menu && menu.hidden) openModeMenu(); else closeModeMenu();
});
document.addEventListener('click', closeModeMenu);
window.addEventListener('resize', closeModeMenu);
// ホームが表示されるたびに、マップ・パーティ表示を更新して進行中のエリアへスクロール
new MutationObserver(() => {
  if (document.getElementById('home').style.display !== 'flex') return;
  buildStageMap(); scrollHomeToFrontier();
  updateMailBadge();   // 赤丸は未読/未受取があるときだけ
  setTimeout(checkLoginBonus, 400);   // ログインボーナス（24時間たっていれば）
}).observe(document.getElementById('home'), { attributes:true, attributeFilter:['style'] });

function openStageSelect(areaNum) {
  currentAreaNum = areaNum;
  applyAreaBackground('stage-select', areaNum);
  renderStageSelect();
  document.getElementById('home').style.display = 'none';
  document.getElementById('stage-select').style.display = 'flex';
  startMenuBGM();
}

let stageToastTimer = null;
function stageToast(msg, ms = 1800) {
  const t = document.getElementById('ss-toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(stageToastTimer);
  stageToastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

function closeStageSelect() {
  document.getElementById('stage-select').style.display = 'none';
  document.getElementById('home').style.display = 'flex';
  setTimeout(scrollHomeToFrontier, 50);
  startMenuBGM();
}

function renderStageSelect() {
  const areaName = areaNameOf(currentAreaNum);
  document.getElementById('ss-header-area-name').textContent = areaName;
  document.getElementById('ss-area-bigname').textContent = areaName;
  const areaNumEl = document.getElementById('ss-area-num');
  if (areaNumEl) areaNumEl.textContent = isDailyArea(currentAreaNum) ? `日替わり ・ ${WEEKDAY_JP[dailyDowOf(currentAreaNum)]}曜日` : isMultiArea(currentAreaNum) ? 'マルチプレイ' : isEventArea(currentAreaNum) ? 'イベント' : `エリア ${currentAreaNum}`;
  const ssOf = document.getElementById('ss-ofuda');   // おふだ所持数
  if (ssOf) {
    const ent = eventEntry(currentAreaNum);
    ssOf.innerHTML = ent ? `${ofudaChipHtml(ent.item)}<span class="ofuda-cost">1回 ${ent.cost}枚つかう</span>` : '';
    ssOf.style.display = ent ? '' : 'none';
  }

  const content = document.getElementById('ss-content');
  content.querySelectorAll('.ss-stage-btn').forEach(b => b.remove());

  const stages = getStageList(currentAreaNum);

  stages.forEach((stage, idx) => {
    // 前のステージ（3-2 なら 3-1）をクリアするまでロック。各エリアの最初のステージは常に挑戦可能
    const prev = idx > 0 ? stages[idx - 1] : null;
    const locked = !!prev && !isStageCleared(currentAreaNum, prev.key);
    const btn = document.createElement('button');
    btn.className = `ss-stage-btn ${stage.boss ? 'boss' : 'normal'}${locked ? ' locked' : ''}`;
    const num = isEventArea(currentAreaNum) ? (stage.boss ? 'B' : stage.key) : (stage.boss ? `${currentAreaNum}-B` : `${currentAreaNum}-${stage.key}`);
    const crown = stage.boss ? '<svg class="ic ss-crown"><use href="#i-crown"/></svg>' : '';
    btn.innerHTML =
      `<span class="ss-stage-num">${num}</span>` +
      `<span class="ss-stage-body">` +
      (dungeonRequiresAllAttr(currentAreaNum, stage.key) ? `<span class="ss-stage-req">【全属性必須】</span>` : '') +
      `<span class="ss-stage-label">${stage.label}${crown}</span>` +
      (stage.level ? `<span class="ss-stage-level">${stage.level}</span>` : '') +
      `</span>` +
      (locked ? `<svg class="ic ss-arrow ss-lock"><use href="#i-lock"/></svg>` : `<svg class="ic ss-arrow"><use href="#i-chev"/></svg>`);
    if (locked) btn.setAttribute('aria-disabled', 'true');
    btn.addEventListener('click', () => {
      if (locked) {
        const prevLabel = stageShortLabel(currentAreaNum, prev.key);
        stageToast(`${prevLabel} をクリアすると解放されます`);
        return;
      }
      currentStageType = stage.key;
      if (isMultiArea(currentAreaNum) && window.MultiOnline) { startMultiMatching(currentAreaNum, stage.key); return; }   // マルチ：自動マッチング
      openDungeonEntry(currentAreaNum, stage.key);
    });
    content.appendChild(btn);
  });
}

document.getElementById('ss-back-btn').addEventListener('click', closeStageSelect);

// ダンジョン中のチーム背景（下部）を、今のステージの背景画像に合わせる。
// 上のダンジョン背景とは「同じ1枚の画像をひと続きで」見せる（境目で絵が切り替わって見えないように）
let _battleBgImg = null;
function setPartyBackground(img) {
  const pa = document.getElementById('party-area');
  if (!pa) return;
  if (!img) { _battleBgImg = null; pa.style.removeProperty('--party-bg'); pa.style.removeProperty('--party-bg-size'); pa.style.removeProperty('--party-bg-pos'); return; }
  const url = new URL(img, document.baseURI).href;
  pa.style.setProperty('--party-bg', `url('${url}')`);
  const im = new Image();
  im.onload = () => { if (_battleBgImg === im) layoutBattleBg(); };
  _battleBgImg = im;
  im.src = url;
}
// ダンジョン部分＋チーム部分を1つの大きな領域とみなして画像を cover し、上下で同じ画像の続きを表示する
function layoutBattleBg() {
  const im = _battleBgImg;
  const d = document.getElementById('dungeon'), p = document.getElementById('party-area');
  if (!im || !im.naturalWidth || !d || !p) return;
  const dr = d.getBoundingClientRect(), pr = p.getBoundingClientRect();
  if (!dr.width || !dr.height || !pr.height) return;
  const W = dr.width, H = pr.bottom - dr.top;
  const k = Math.max(W / im.naturalWidth, H / im.naturalHeight);
  const iw = im.naturalWidth * k, ih = im.naturalHeight * k;
  const x = (W - iw) / 2, y = (H - ih) / 2;
  if (d.style.backgroundImage) {           // ダンジョン側に背景画像があるときだけ合わせる
    d.style.backgroundRepeat = 'no-repeat';
    d.style.backgroundSize = `${iw}px ${ih}px`;
    d.style.backgroundPosition = `${x}px ${y}px`;
  }
  p.style.setProperty('--party-bg-size', `${iw}px ${ih}px`);
  p.style.setProperty('--party-bg-pos', `${x}px ${y - dr.height}px`);
}
window.addEventListener('resize', layoutBattleBg);
if (window.ResizeObserver) {
  const _ro = new ResizeObserver(() => layoutBattleBg());
  _ro.observe(document.getElementById('dungeon'));
  _ro.observe(document.getElementById('party-area'));
}

async function startGameFromHome() {
  restoreTransforms();   // 念のため：前のダンジョンの変身が残っていたら戻す
  document.getElementById('home').style.display = 'none';
  document.getElementById('game').style.display = 'flex';
  stopMenuBGM();
  try { (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)?.call(document.documentElement); } catch(e) {}

  totalCoin = 0;
  totalExp = 0;
  droppedMonsters = [];
  droppedItems = [];
  updateCoinDisplay();
  updateDropCount();

  partySp = 0;
  partyMemory = 0;

  const newPartyUids = currentTeam.map(uid => uid);
  for (let i = 0; i < 6; i++) {
    if (i < partyUids.length) partyUids[i] = newPartyUids[i] !== undefined ? newPartyUids[i] : null;
    else partyUids.push(newPartyUids[i] !== undefined ? newPartyUids[i] : null);
  }
  resetPlayerBuffs();
  moveTimeFixed = null;
  currentMoveMs = baseMoveMs;
  skillUsedThisTurn = false;
  bindTimers = {};
  _hpCache.key = '';
  playerCurrentHP = calcTotalHP();
  enemyAtkDowns = [];
  enemyRecDown = null; enemyMoveDown = null; enemySkillSeal = null; enemyNoFall = null;
  clearRoulettes();

  const stageKey = currentStageType === 'boss' ? 'boss' : currentStageType;
  const dungeonKey = `${currentAreaNum}-${stageKey}`;
  const dungeonData = DUNGEON_DATA[dungeonKey];
  currentDungeonKey = dungeonKey;
  const dungeon = document.getElementById('dungeon');

  if (dungeonData) {
    // マルチ(オンライン)：ランダム階層・乱入の抽選は、部屋IDのシードで2人とも同じ結果にする
    currentDungeonBattles = (window.MultiShare ? MultiShare.withSeed : (t, f) => f())('battles', () => applyIntrusion(dungeonData, buildDungeonBattles(dungeonData)));
    currentBattleIndex    = 0;
    let battleBg = dungeonData.bgImg || areaBgImage(currentAreaNum);
    if (window.BossCloud && BossCloud.has(dungeonKey)) {
      BossCloud.preload(dungeonKey);   // ラスボス背景を先読み（雲が晴れたときにすぐ出せるように）
      if (isBossBattleIndex(0)) battleBg = BossCloud.bgOf(dungeonKey);   // 最初からボス戦なら演出なしで専用背景
    }
    dungeon.style.backgroundImage = `url('${battleBg}')`;
    dungeon.style.backgroundSize  = 'cover';
    dungeon.style.backgroundPosition = 'center';
    setPartyBackground(battleBg);
    playBattleBgm(0, hasBossIntro() && isBossBattleIndex(0));   // 登場演出つきボスが最初なら、まず道中BGM
    loadBattle(currentDungeonBattles[0], false);   // 先制はSTART表示のあとに実行
  } else {
    currentDungeonBattles = [];
    currentBattleIndex    = 0;
    dungeon.style.backgroundImage = '';
    setPartyBackground(areaBgImage(currentAreaNum));
    const hp    = STAGE_ENEMY_HP[currentStageType] || 2000;
    const eName = STAGE_ENEMY_NAMES[currentStageType] || '???';
    enemyList = [ { name:eName, img:'', attr:'dark', maxHp:hp, hp:hp, atk:100, def:0, turnInterval:2, size:'S', actions:[{name:'通常攻撃', weight:100, fn:(e)=>applyPlayerDamage(e.atk||0, e)}] } ];
    renderEnemyUI();
    updateEnemyUI();
    playBattleBgm(0);
  }

  init();
  if (window.MultiTurn) { if (isMultiArea(currentAreaNum)) MultiTurn.begin(); else MultiTurn.end(); }   // マルチ：交代制ターン（Aから）
  // START表示が終わるまでは盤面操作・スキル・メニュー・敵の先制を止める。表示後に先制→操作可能
  busy = true;
  setEnemyActing(true);
  setTimeout(async () => {
    try {
      await showDungeonAnim('start');
    } finally {
      setEnemyActing(false);
    }
    if (currentDungeonBattles.length) {
      // 最初からボス戦で登場演出つき：BOSSバナー → 登場演出（ボスBGMは姿があらわれる瞬間から）
      if (hasBossIntro() && isBossBattleIndex(currentBattleIndex)) {
        stopDungeonBGM();
        await showBattleBanner(currentBattleIndex + 1, currentDungeonBattles.length, true, null);
      }
      await playEnemyAppear(); await runBattleStartActions();
    }
    if (window.MultiTurn && MultiTurn.active) await MultiTurn.announce();   // マルチ：「Aのターン」
    if (window.MultiTurn && MultiTurn.active && MultiTurn.online) await MultiTurn.markReady();   // マルチ(オンライン)：先攻は最初の状態を渡す／待たされた相手の状態を反映
    busy = !!(window.MultiTurn && MultiTurn.online && MultiTurn.active && !MultiTurn.isMyTurn());   // マルチ(オンライン)：自分の番まで待つ
  }, 200);
}

document.getElementById('btn-team').addEventListener('click', openTeamEdit);
document.getElementById('btn-grow').addEventListener('click', openIkuScreen);

document.getElementById('iku-back').addEventListener('click', closeIkuScreen);

document.querySelectorAll('.iku-attr-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const attr = btn.dataset.attr;
    if (ikuAttrFilter.has(attr)) { ikuAttrFilter.delete(attr); btn.classList.remove('active'); }
    else { ikuAttrFilter.add(attr); btn.classList.add('active'); }
    renderIkuGrid();
  });
});

// リーダースキル検索（js/ls-search.js）。「EXP」ボタンの左に「リダスキ」ボタンが付く
ikuLS = LSSearch.mount({
  key: 'iku', host: document.getElementById('iku-screen'),
  before: document.getElementById('iku-expsort-btn'), after: document.getElementById('iku-filter-row'),
  candidates: () => box.map(e => MONSTER_DATA[e.monsterId]).filter(Boolean),
  onChange: () => { const wrap = document.getElementById('iku-box-wrap'); if (wrap) wrap.scrollTop = 0; renderIkuGrid(); }
});
// 並び替え（ボタンでシートを開く / 「EXP」ボタンは合計経験値順をワンタップで入り切り）
document.getElementById('iku-sort-btn').addEventListener('click', () => {
  BoxSort.openSheet(document.getElementById('iku-screen'), ikuSort, () => {
    const wrap = document.getElementById('iku-box-wrap'); if (wrap) wrap.scrollTop = 0;
    renderIkuGrid();
  });
});
document.getElementById('iku-expsort-btn').addEventListener('click', () => {
  if (ikuSort.mode === 'exp') {
    // もう一度押すと、直前の並びに戻る
    ikuSort.mode = ikuPrevSortMode === 'exp' ? 'acq' : ikuPrevSortMode;
    ikuSort.rev = false;
  } else {
    ikuPrevSortMode = ikuSort.mode;
    ikuSort.mode = 'exp';
    ikuSort.rev = false;
  }
  BoxSort.saveState(ikuSort);
  const wrap = document.getElementById('iku-box-wrap'); if (wrap) wrap.scrollTop = 0;
  renderIkuGrid();
});

document.getElementById('iku-base-slot').addEventListener('click', () => {
  ikuBaseUid = null;
  ikuSelectMode = 'base';
  renderIkuScreen();
});

document.querySelectorAll('.iku-mat-slot').forEach((slot, i) => {
  slot.addEventListener('click', () => {
    if (ikuMatUids[i] !== null) { ikuMatUids[i] = null; renderIkuScreen(); }
    else ikuSelectMode = 'mat';
  });
});

document.getElementById('iku-gassho-btn').addEventListener('click', doGassho);

document.getElementById('iku-result-ok').addEventListener('click', () => {
  document.getElementById('iku-result-overlay').style.display = 'none';
  renderIkuScreen();
});

// ============================================================
// 潜入確認画面
// ============================================================
const ATTR_BORDER = { fire:'de-attr-fire', water:'de-attr-water', wood:'de-attr-wood', light:'de-attr-light', dark:'de-attr-dark' };

function calcTotalREC() {
  let total = 0;
  for (const uid of currentTeam) {
    if (uid === null) continue;
    const entry = box.find(b => b.uid === uid);
    if (entry) total += calcMonsterStats(entry).rec;
  }
  return total;
}
// 編成画面・出撃準備に表示する「チーム合計」（リーダースキル補正なし）
function calcTeamSums() {
  const sums = { hp: 0, atk: 0, rec: 0 };
  for (const uid of currentTeam) {
    if (uid === null) continue;
    const entry = box.find(b => b.uid === uid);
    if (!entry) continue;
    const st = calcMonsterStats(entry);
    sums.hp += st.hp; sums.atk += st.atk; sums.rec += st.rec;
  }
  return sums;
}

// 出撃準備の「挑戦する」ボタンに、つかうおふだと持っている数を出す（足りないと赤）
function updateDungeonEntryCost() {
  const el = document.getElementById('de-cost'), btn = document.getElementById('de-challenge-btn');
  if (!el || !btn) return;
  const ent = eventEntry(currentAreaNum);
  if (!ent) { el.style.display = 'none'; el.innerHTML = ''; btn.classList.remove('short'); return; }
  const have = getItemCount(ent.item), short = have < ent.cost;
  el.style.display = '';
  el.classList.toggle('short', short);
  btn.classList.toggle('short', short);
  el.innerHTML = `${ofudaIconHtml(ent.item)}<span class="de-cost-txt">×${ent.cost}<small>所持 ${have}</small></span>`;
}
let deToastTimer = null;
function deToast(msg, ms = 2000) {
  const t = document.getElementById('de-toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(deToastTimer);
  deToastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

function renderDungeonEntry() {
  updateDungeonEntryCost();
  const stageLabel = stageShortLabel(currentAreaNum, currentStageType);
  document.getElementById('de-stage-label').textContent = stageLabel;
  const dKey = `${currentAreaNum}-${currentStageType}`, dd = DUNGEON_DATA[dKey];
  const battleCount = dungeonBattleCount(dKey) || (dd && dd.battles && dd.battles.length) || STAGE_BATTLE_COUNTS[currentStageType] || 5;
  document.getElementById('de-battle-count').textContent = battleCount;

  const row = document.getElementById('de-monster-row');
  row.innerHTML = '';
  // 【全属性必須】の帯表示は、パーティー画面では出さない（入場時のチェックは startDungeon 側で行う）
  const reqEl = document.getElementById('de-req-all');
  if (reqEl) reqEl.style.display = 'none';
  for (let i = 0; i < 6; i++) {
    const uid = currentTeam[i];
    const card = document.createElement('div');
    card.className = 'de-mon-card';
    if (uid !== null) {
      const entry = box.find(b => b.uid === uid);
      if (entry) {
        const mon = MONSTER_DATA[entry.monsterId];
        if (ATTR_BORDER[mon.attr]) card.classList.add(ATTR_BORDER[mon.attr]);
        const img = document.createElement('img');
        img.className = 'de-mon-img';
        img.src = monsterImg(mon);
        img.alt = mon.name;
        img.onerror = function(){ this.style.display='none'; };
        card.appendChild(img);
        const lv = document.createElement('div');
        lv.className = 'de-mon-lv';
        lv.textContent = `Lv.${entry.level}`;
        card.appendChild(lv);
      }
    }
    if (!card.querySelector('img')) card.classList.add('de-mon-empty');
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      if (_longPressTriggered) { _longPressTriggered = false; return; }   // 長押しで詳細を開いた後の誤タップ防止
      openTeamEditFromDungeonEntry();
    });
    if (uid !== null && card.querySelector('img')) {
      addLongPress(card, () => {
        const boxIdx = box.findIndex(b => b.uid === uid);
        if (boxIdx !== -1) { playTapSound(); openMonsterDetail(boxIdx, 'dungeon-entry'); }
      });
      card.addEventListener('touchend', (e) => { if (_longPressTriggered && e.cancelable) e.preventDefault(); });
      card.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    row.appendChild(card);
  }


  const totalHP  = calcTotalHP(true);
  const totalREC = calcTotalREC();
  document.getElementById('de-total-hp').textContent  = totalHP.toLocaleString();
  document.getElementById('de-total-rec').textContent = totalREC.toLocaleString();
  const atkEl = document.getElementById('de-total-atk');
  if (atkEl) atkEl.textContent = calcTeamSums().atk.toLocaleString();

  let ls1Name = '', ls1Desc = '（なし）';
  let ls2Name = '', ls2Desc = '（なし）';
  if (currentTeam[0] !== null) {
    const e = box.find(b => b.uid === currentTeam[0]);
    if (e) { const m = MONSTER_DATA[e.monsterId]; if (m) { ls1Name = m.name; ls1Desc = m.leaderSkill.desc; } }
  }
  if (currentTeam[5] !== null) {
    const e = box.find(b => b.uid === currentTeam[5]);
    if (e) { const m = MONSTER_DATA[e.monsterId]; if (m) { ls2Name = m.name; ls2Desc = m.leaderSkill.desc; } }
  }
  document.getElementById('de-ls1-name').textContent = ls1Name;
  setSkillText(document.getElementById('de-ls1-desc'), ls1Desc);
  document.getElementById('de-ls2-name').textContent = ls2Name;
  setSkillText(document.getElementById('de-ls2-desc'), ls2Desc);

  renderDungeonEntryInfo(dKey, dd);
  multiLobbyRefresh();   // マルチ：編成を変えたら「決定」を取り消す／あいてへ編成を送る
}

// 画像の「透明でない部分」だけを正方形に切り出して、中身が枠の真ん中に来るようにする
// （おふだなど、画像内の余白が偏っているアイテムのズレ対策。読み込めない／加工できない時はそのまま表示）
function centerCropImg(img) {
  if (!img) return;
  const run = () => {
    try {
      if (img.dataset.centered) return;
      const w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h) return;
      const sc = Math.min(1, 256 / Math.max(w, h));
      const cw = Math.max(1, Math.round(w * sc)), ch = Math.max(1, Math.round(h * sc));
      const c = document.createElement('canvas'); c.width = cw; c.height = ch;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, cw, ch);
      const d = g.getImageData(0, 0, cw, ch).data;
      let x0 = cw, y0 = ch, x1 = -1, y1 = -1;
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        if (d[(y * cw + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 < 0) return;
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1, side = Math.max(bw, bh);
      const c2 = document.createElement('canvas'); c2.width = side; c2.height = side;
      c2.getContext('2d').drawImage(c, x0, y0, bw, bh, (side - bw) / 2, (side - bh) / 2, bw, bh);
      const url = c2.toDataURL('image/png');
      img.dataset.centered = '1';
      img.src = url;
    } catch (e) { /* 加工できなければ元の画像のまま */ }
  };
  if (img.complete && img.naturalWidth) run(); else img.addEventListener('load', run, { once: true });
}
// 出撃準備：出現モンスター(mX.png) と 落ちるチップ。クリア済みのダンジョンだけ表示する
function renderDungeonEntryInfo(dKey, dd) {
  const section = document.getElementById('de-info-section');
  const monBlock = document.getElementById('de-mon-block'), chipBlock = document.getElementById('de-chip-block');
  const monList = document.getElementById('de-mon-list'), chipList = document.getElementById('de-chip-list');
  monList.innerHTML = ''; chipList.innerHTML = '';
  section.style.display = 'none';
  if (!dd || !isDungeonCleared(dKey)) return;   // 未クリアはUIごと非表示

  const enemies = [];
  (dd.battles || []).forEach(b => (b.enemies || []).forEach(e => enemies.push(e)));
  if (dd.random && dd.random.monsters) Object.values(dd.random.monsters).forEach(e => enemies.push(e));

  const seenMon = new Set(), seenChip = new Set();
  for (const e of enemies) {
    if (!e) continue;
    if (e.img) {
      const src = e.img.replace(/(m)p(\d+\.png)$/, '$1$2');   // mp10.png → m10.png
      if (!seenMon.has(src)) {
        seenMon.add(src);
        const cell = document.createElement('div');
        cell.className = 'de-info-cell';
        cell.innerHTML = `<img src="${src}" alt="${e.name || ''}" onerror="this.parentNode.style.display='none'">`;
        monList.appendChild(cell);
      }
    }
    for (const d of (e.drops || [])) {
      const def = ITEM_DATA[d.item];
      if (!def || seenChip.has(d.item)) continue;
      seenChip.add(d.item);
      const cell = document.createElement('div');
      cell.className = 'de-info-cell chip-cell';
      cell.title = def.name;
      cell.innerHTML = `<img src="${def.img}" alt="${def.name}" onerror="this.parentNode.style.display='none'">`;
      chipList.appendChild(cell);
      centerCropImg(cell.querySelector('img'));   // 画像の余白が偏っていても、中身を枠の真ん中に
    }
    const fd = e.ofudaDrop;   // おふだドロップ（ONの敵だけ）
    if (fd && fd.enabled && ITEM_DATA[fd.item] && !seenChip.has(fd.item)) {
      const def = ITEM_DATA[fd.item];
      seenChip.add(fd.item);
      const cell = document.createElement('div');
      cell.className = 'de-info-cell chip-cell';
      cell.title = def.name;
      cell.innerHTML = `<img src="${def.img}" alt="${def.name}" onerror="this.parentNode.style.display='none'">`;
      chipList.appendChild(cell);
      centerCropImg(cell.querySelector('img'));   // 画像の余白が偏っていても、中身を枠の真ん中に
    }
  }
  monBlock.style.display = seenMon.size ? '' : 'none';
  chipBlock.style.display = seenChip.size ? '' : 'none';
  if (seenMon.size || seenChip.size) section.style.display = 'flex';
}

// 【全属性必須】ダンジョン：火〜闇の5属性がパーティーに1匹以上いないと入れない（dungeonData.requireAllAttr = true で有効）
function dungeonRequiresAllAttr(areaNum, stageKey) {
  const d = DUNGEON_DATA[`${areaNum}-${stageKey}`];
  return !!(d && d.requireAllAttr);
}
function teamHasAllAttrs() {
  const got = new Set();
  for (const uid of currentTeam) {
    if (uid === null || uid === undefined) continue;
    const entry = box.find(b => b.uid === uid);
    const mon = entry && MONSTER_DATA[entry.monsterId];
    if (mon) got.add(mon.attr);
  }
  return ['fire', 'water', 'wood', 'light', 'dark'].every(a => got.has(a));
}
function openDungeonEntry(areaNum, stageType) {
  currentAreaNum   = areaNum   || 1;
  currentStageType = stageType || '1';
  applyAreaBackground('dungeon-entry', currentAreaNum);
  renderDungeonEntry();
  document.getElementById('stage-select').style.display = 'none';
  document.getElementById('home').style.display = 'none';
  document.getElementById('dungeon-entry').style.display = 'flex';
  startMenuBGM();
}

// ============================================================
// マルチ：自動マッチング → 出撃準備でお互い編成 → 両者「決定」で開始
//   multiLobby = { room, seat, ready, sig, opp, seen } / ひとりで交代プレイ = { solo:true } / 通常 = null
// ============================================================
let multiLobby = null;
const _moEl = id => document.getElementById(id);
function moTeamStr() {   // 自分の編成を「モンスターID:Lv,…」(6枠)にして相手へ見せる
  return currentTeam.map(uid => { const e = uid !== null && uid !== undefined && box.find(b => b.uid === uid); return e ? e.monsterId + ':' + e.level : ''; }).join(',');
}
function moRenderOpp() {
  const panel = _moEl('mo-opp');
  if (!panel) return;
  if (!multiLobby || multiLobby.solo) { panel.style.display = 'none'; return; }
  panel.style.display = 'flex';
  _moEl('mo-opp-seat').textContent = MultiTurn.name(1 - multiLobby.seat);
  const o = multiLobby.opp, here = !!(o && o.present);
  const row = _moEl('mo-opp-mons'); row.innerHTML = '';
  const parts = (here && o.team ? String(o.team) : '').split(',');
  for (let i = 0; i < 6; i++) {
    const span = document.createElement('span');
    const t = parts[i] || '', id = t ? t.slice(0, t.lastIndexOf(':')) : '', mon = id && MONSTER_DATA[id];
    if (mon) { const im = document.createElement('img'); im.src = monsterImg(mon); im.alt = mon.name; im.onerror = function () { this.style.display = 'none'; }; span.appendChild(im); }
    row.appendChild(span);
  }
  const st = _moEl('mo-opp-state');
  panel.classList.toggle('ready', here && !!o.ready);
  panel.classList.toggle('gone', !here && multiLobby.seen);
  st.textContent = here ? (o.ready ? '準備OK！' : '編成中…') : (multiLobby.seen ? '退出しました' : '入室待ち…');
}
function moRefreshBtn() {
  const t = _moEl('de-cta-txt'), b = _moEl('de-challenge-btn');
  if (!t) return;
  if (multiLobby && !multiLobby.solo) { t.textContent = multiLobby.ready ? 'あいて待ち…（タップで取消）' : '決定'; b.classList.toggle('waiting', !!multiLobby.ready); }
  else { t.textContent = '挑戦する'; b.classList.remove('waiting'); }
}
function multiLobbyRefresh() {
  if (multiLobby && !multiLobby.solo) {
    const sig = moTeamStr();
    if (multiLobby.ready && sig !== multiLobby.sig) { multiLobby.ready = false; deToast('編成を変えたので「決定」を取り消しました'); }
    MultiOnline.setReady(multiLobby.ready, sig);   // 編成中でも、あいてに今の編成が見える
  }
  moRenderOpp(); moRefreshBtn();
}
function moLeaveLobby() {
  if (multiLobby && !multiLobby.solo && window.MultiOnline) MultiOnline.leave();
  multiLobby = null; moRenderOpp(); moRefreshBtn();
}
// 「決定」ボタン：準備OK ⇔ 取り消し
function moOnDecide() {
  const lob = multiLobby;
  if (lob.ready) { lob.ready = false; MultiOnline.setReady(false, moTeamStr()); moRefreshBtn(); return; }
  if (lob.seen && !(lob.opp && lob.opp.present)) { deToast('あいてが退出しました。戻ってもういちど探してね', 2800); return; }
  if (partyMemberCount() === 0) { deToast('パーティーにモンスターがいません。編成してね', 2600); return; }
  if (dungeonRequiresAllAttr(currentAreaNum, currentStageType) && !teamHasAllAttrs()) { deToast('【全属性必須】火・水・木・光・闇のモンスターを1匹ずつ以上編成してね', 3000); return; }
  lob.ready = true; lob.sig = moTeamStr();
  MultiOnline.setReady(true, lob.sig);
  moRefreshBtn();
}
// 2人とも「決定」→ 同時にスタート（自分の番号は seat：0=A / 1=B）
function moStartBattle() {
  const lob = multiLobby;
  if (!lob || lob.solo) return;
  MultiTurn.online = true; MultiTurn.localId = lob.seat; MultiTurn.count = 2;
  MultiTurn.transport = { send: s => MultiOnline.sendTurn(s) };
  multiLobby = null;
  moRenderOpp(); moRefreshBtn();
  document.getElementById('dungeon-entry').style.display = 'none';
  startGameFromHome();
}
function moOnOpponent(o) {
  if (multiLobby && !multiLobby.solo) {
    multiLobby.opp = o;
    if (o && o.present) multiLobby.seen = true;
    if (multiLobby.seen && !(o && o.present)) multiLobby.ready = false;
    moRenderOpp(); moRefreshBtn();
    return;
  }
  // マルチ：あいてが脱落（ゲームオーバー）した → のこりの自分だけで続ける／自分も脱落済みなら全滅
  if (window.MultiShare && MultiTurn.online && MultiTurn.active && o && o.present) MultiShare.onPartnerState(o);
  // ダンジョン中にあいてが抜けたら、のこりは自由に操作できるようにする
  if (window.MultiTurn && MultiTurn.online && MultiTurn.active && !(o && o.present)) {
    if (_gameOverActive || _clearActive) return;   // クリア／ゲームオーバー画面の間は、あいてが先にホームへ戻っても何もしない
    if (window.MultiShare && MultiShare.spectating) { if (MultiTurn.banner) MultiTurn.banner('MULTI', 'あいてが退出しました', 1); return; }   // 観戦中：もう見るものがない（ホームへは上のボタンから）
    const waiting = !MultiTurn.isMyTurn();
    MultiTurn.localId = null;
    if (MultiTurn.banner) MultiTurn.banner('MULTI', 'あいてが退出しました', 1);
    if (waiting) busy = false;
  }
}
async function startMultiMatching(areaNum, stageKey) {
  const ov = _moEl('mo-matching'), spin = _moEl('mo-spin'), msg = _moEl('mo-msg'), tm = _moEl('mo-time');
  const cancel = _moEl('mo-cancel'), solo = _moEl('mo-solo');
  _moEl('mo-stage').textContent = stageShortLabel(areaNum, stageKey);
  spin.classList.remove('off'); msg.textContent = 'あいてをさがしています…'; tm.textContent = '';
  cancel.textContent = 'キャンセル'; solo.style.display = 'none';
  ov.classList.add('show');
  const t0 = Date.now();
  const tick = setInterval(() => { tm.textContent = `${Math.floor((Date.now() - t0) / 1000)} 秒`; }, 500);
  const close = () => { clearInterval(tick); ov.classList.remove('show'); };
  cancel.onclick = () => { MultiOnline.cancelMatch(); close(); };
  solo.onclick = () => { close(); multiLobby = { solo: true }; openDungeonEntry(areaNum, stageKey); };   // 通信なし：いままで通り1台で交代
  try {
    if (!MultiOnline.available()) throw new Error('offline');
    const r = await MultiOnline.findMatch(`${areaNum}-${stageKey}`);
    clearInterval(tick);
    spin.classList.add('off'); msg.textContent = 'マッチしました！'; tm.textContent = '';
    await new Promise(res => setTimeout(res, 700));
    ov.classList.remove('show');
    multiLobby = { room: r.room, seat: r.seat, ready: false, sig: '', opp: null, seen: false };
    MultiOnline.enterRoom(r.room, r.seat, {
      onOpponent: moOnOpponent,
      onBothReady: moStartBattle,
      onTurn: s => { if (window.MultiTurn) MultiTurn.receive(s); },
      onEvent: v => { if (window.MultiShare) MultiShare.onEvent(v); },   // クリア／ゲームオーバー
      onLive: v => { if (window.MultiShare) MultiShare.onLive(v); },     // 相手が動かしている盤面
      onParty: v => { if (window.MultiShare) MultiShare.onParty(v); },   // 相手のパーティー（モンスター・HP・SP）
      onFx: v => { if (window.MultiShare) MultiShare.onFx(v); },         // 相手の操作中の出来事（コンボ・攻撃・HP…）
    });
    openDungeonEntry(areaNum, stageKey);
  } catch (e) {
    if (e && e.message === 'cancel') return;
    clearInterval(tick);
    spin.classList.add('off'); msg.textContent = 'つうしんできませんでした'; tm.textContent = 'ネット接続を確認してね';
    cancel.textContent = '閉じる'; solo.style.display = '';
  }
}
if (window.MultiTurn) MultiTurn.onMyTurn = () => { busy = false; };   // あいてのターンが終わったら盤面のロックを解く

document.getElementById('de-edit-btn').addEventListener('click', openTeamEditFromDungeonEntry);
document.getElementById('de-back-btn').addEventListener('click', () => {
  moLeaveLobby();   // マルチ：部屋から退出
  document.getElementById('dungeon-entry').style.display = 'none';
  document.getElementById('stage-select').style.display = 'flex';
  startMenuBGM();
});
// パーティーにいるモンスターの数（BOXにいない・空き枠は数えない）
function partyMemberCount() {
  return currentTeam.filter(uid => uid !== null && uid !== undefined && box.some(b => b.uid === uid)).length;
}
document.getElementById('de-challenge-btn').addEventListener('click', () => {
  if (multiLobby && !multiLobby.solo) { moOnDecide(); return; }   // マルチ：「決定」（両者そろったら自動で始まる）
  if (multiLobby && multiLobby.solo) { multiLobby = null; moRenderOpp(); moRefreshBtn(); }
  // パーティーが0匹ならダンジョンに入れない（おふだも消費しない）
  if (partyMemberCount() === 0) {
    deToast('パーティーにモンスターがいません。編成してね', 2600);
    return;
  }
  // 【全属性必須】：火〜闇の5属性がそろっていなければ入れない（おふだも消費しない）
  if (dungeonRequiresAllAttr(currentAreaNum, currentStageType) && !teamHasAllAttrs()) {
    deToast('【全属性必須】火・水・木・光・闇のモンスターを1匹ずつ以上編成してね', 3000);
    return;
  }
  // 日替わりダンジョン：0:00をまたいで曜日が変わっていたら入れない（ホームに戻す）
  if (isDailyArea(currentAreaNum) && dailyTodayId() !== currentAreaNum) {
    deToast('日付が変わりました。もういちど選びなおしてね', 2600);
    setTimeout(() => {
      document.getElementById('dungeon-entry').style.display = 'none';
      document.getElementById('home').style.display = 'flex';
      startMenuBGM();
    }, 1200);
    return;
  }
  // おふだが要るイベント（日替わり／けいけんパーク）：足りなければ入れない。足りていれば出撃のときに消費
  const ent = eventEntry(currentAreaNum);
  if (ent) {
    const name = ITEM_DATA[ent.item].name;
    if (getItemCount(ent.item) < ent.cost) {
      deToast(`${name}が足りません（${ent.cost}枚いります）`);
      updateDungeonEntryCost();
      return;
    }
    itemInventory[ent.item] = getItemCount(ent.item) - ent.cost;
    saveGame();
  }
  document.getElementById('dungeon-entry').style.display = 'none';
  startGameFromHome();
});

document.getElementById('home').style.display = 'flex';
buildStageMap();
setTimeout(scrollHomeToFrontier, 50);
startMenuBGM();
setTimeout(checkLoginBonus, 600);   // 起動時のログインボーナス

let homeFullscreen = false;
document.getElementById('home').addEventListener('click', () => {
  if (homeFullscreen) return;
  homeFullscreen = true;
  try { (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)?.call(document.documentElement); } catch(e) {}
}, {capture: true, once: true});

// Menu → 「続ける / ドロップを見る / リタイア」
function showMenuView(name) {
  ['main', 'drops', 'retire'].forEach(v => {
    document.getElementById('menu-view-' + v).style.display = (v === name) ? '' : 'none';
  });
}
function closeMenu() {
  document.getElementById('quit-confirm').style.display = 'none';
  showMenuView('main');
}
// Menu（リタイア）を受け付けない状態：敵の行動中／自分の攻撃・スキル演出中（busy）／戦闘終了処理中
function isMenuLocked() { return isEnemyActing() || busy || _battleEndRunning; }
document.getElementById('menu-btn').addEventListener('click', function() {
  if (isMenuLocked()) return;   // 敵の行動中・自分の攻撃中はメニューを押せない
  showMenuView('main');
  document.getElementById('quit-confirm').style.display = 'flex';
});
document.getElementById('quit-no').addEventListener('click', closeMenu);          // 続ける
document.getElementById('quit-confirm').addEventListener('click', function(e) {
  if (e.target === this) closeMenu();
});
document.getElementById('menu-drops-btn').addEventListener('click', () => {      // ドロップを見る
  renderDropItems(document.getElementById('menu-drops-list'));
  showMenuView('drops');
});
document.getElementById('menu-drops-back').addEventListener('click', () => showMenuView('main'));
document.getElementById('menu-retire-btn').addEventListener('click', () => showMenuView('retire'));
document.getElementById('menu-retire-no').addEventListener('click', () => showMenuView('main'));
document.getElementById('quit-yes').addEventListener('click', function() {       // リタイア
  if (isMenuLocked()) { closeMenu(); return; }   // 開いたまま攻撃が始まった場合もホームへ戻さない
  closeMenu();
  stopTimer(); timerStarted = false;
  if (timeStopActive) abortTimeStop();
  if (dragEl) { dragEl.style.transform = ''; dragEl.classList.remove('dragging'); dragEl = null; }
  dragging = false; busy = false; grabSnapshot = null; grabMoved = false;
  restoreTransforms();   // リタイアしたら変身は解ける
  setHomeFocusFromCurrent();
  const got = grantDrops();   // リタイアしても、ここまでに手に入れたドロップは受け取れる
  document.getElementById('game').style.display = 'none';
  document.getElementById('home').style.display = 'flex';
  stopDungeonBGM();
  startMenuBGM();
  if (window.MultiTurn) MultiTurn.end();
  setTimeout(scrollHomeToFrontier, 50);
  if (got > 0) homeToast(`ドロップ ${got}個を受け取りました`, 2600);
});

document.getElementById('sp-yes').addEventListener('click', confirmSkill);
document.getElementById('sp-no').addEventListener('click', closeSkillConfirm);
document.getElementById('skill-confirm').addEventListener('click', function(e) { if (e.target === this) closeSkillConfirm(); });

const rand = () => TYPES[Math.floor(Math.random() * TYPES.length)];

function init() {
  _gameOverActive = false;
  stopGameOverSE();
  resetClearState();
  { const o = document.getElementById('gameover-overlay'); if (o) o.remove(); const w = document.getElementById('grid-wrap'); if (w) w.classList.remove('go-collapsing'); const g = document.getElementById('game'); if (g) g.classList.remove('game-over', 'mt-spectate'); }
  moveTimeFixed = null;
  leaderMoveAddMs = 0;
  lastTurnCtx = null;
  resetLsGuard();
  [0,5].forEach(idx => {
    if (partyUids.length > idx && partyUids[idx] !== null) {
      const e = box.find(b => b.uid === partyUids[idx]);
      if (e) {
        const m = MONSTER_DATA[e.monsterId];
        if (m && m.leaderSkill && m.leaderSkill.effects) {
          for (const eff of m.leaderSkill.effects) {
            if (eff.type === 'moveTimeFixed') moveTimeFixed = eff.value;
            if (eff.type === 'moveTimeAdd') leaderMoveAddMs += Math.round((Number(eff.value) || 0) * 1000);
          }
        }
      }
    }
  });
  currentMoveMs = calcCurrentMoveMs();

  enemyDefeatedHandled = false;
  grid = (window.MultiShare && MultiShare.initialGrid()) || Array.from({length:ROWS}, () => Array.from({length:COLS}, rand));   // マルチ(オンライン)は2人とも同じ最初の盤面
  buildDOM();
  renderParty();
  updateLeaderSkill2();
  playerCurrentHP = Math.min(playerCurrentHP || playerMaxHP, playerMaxHP);
  updatePlayerHP();
  updateEnemyUI();
  setTimerRatio(1);
  timerStarted = false;
  damageElements.forEach(el => { if (el) { el.textContent = ''; el.classList.remove('show', 'pop'); } });
  document.getElementById('combo-label').textContent = '';
  renderBuffIcons();
  if (timeStopActive) abortTimeStop();
}

function buildDOM() {
  const con = document.getElementById('grid');
  con.innerHTML = '';
  orbEls = [];
  clearRoulettes();
  blindCells = Array.from({length:ROWS}, () => Array(COLS).fill(false));
  for (let r = 0; r < ROWS; r++) {
    orbEls[r] = [];
    for (let c = 0; c < COLS; c++) {
      const el = document.createElement('div');
      el.className = 'orb ' + grid[r][c];
      con.appendChild(el);
      orbEls[r][c] = el;
    }
  }
  con.addEventListener('touchstart', onStart, {passive:false});
  con.addEventListener('touchmove',  onMove,  {passive:false});
  con.addEventListener('touchend',   onEnd);
  con.addEventListener('mousedown',  onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup',   onEnd);
}

// ── 自分のモンスターを長押し → 敵エリアにスキル説明と必要SPを表示（離したら消える） ──
let _skHoldEndAt = 0;
function showSkillHoldInfo(mon, entry) {
  const dg = document.getElementById('dungeon');
  if (!dg || !mon || !mon.skill) return false;
  let box = document.getElementById('skill-hold-info');
  if (!box) { box = document.createElement('div'); box.id = 'skill-hold-info'; dg.appendChild(box); }
  const need = getRequiredSp(entry, mon);
  box.innerHTML = '';
  const head = document.createElement('div'); head.className = 'shi-head';
  const nm = document.createElement('span'); nm.className = 'shi-name'; nm.textContent = mon.skill.name || 'スキル';
  const sp = document.createElement('span'); sp.className = 'shi-sp'; sp.textContent = `必要SP ${need}`;
  head.append(nm, sp);
  const ds = document.createElement('div'); ds.className = 'shi-desc'; setSkillText(ds, mon.skill.desc || '');
  const who = document.createElement('div'); who.className = 'shi-who'; who.textContent = mon.name;
  box.append(who, head, ds);
  box.classList.add('on');
  return true;
}
function hideSkillHoldInfo() {
  const box = document.getElementById('skill-hold-info');
  if (box) box.classList.remove('on');
}
// スロットに表示用データを持たせるだけ。長押しの検知は下の document レベルの処理でまとめて行う
//（長押ししたまま別のモンスターへ指をスライドしたら、すぐ表示を切り替えるため）
function attachSkillHold(slot, mon, entry) { slot._sk = { mon, entry }; }
(function setupSkillHold() {
  let timer = null, shown = false, active = false, sx = 0, sy = 0, cur = null;
  const slotAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const sl = el && el.closest ? el.closest('#party-grid .party-slot') : null;
    return sl && sl._sk ? sl : null;
  };
  const end = () => {
    clearTimeout(timer); timer = null; active = false; cur = null;
    if (shown) { shown = false; _skHoldEndAt = Date.now(); hideSkillHoldInfo(); }
  };
  document.addEventListener('pointerdown', (e) => {
    const sl = e.target.closest ? e.target.closest('#party-grid .party-slot') : null;
    if (!sl || !sl._sk) return;
    active = true; cur = sl; sx = e.clientX; sy = e.clientY;
    try { sl.releasePointerCapture(e.pointerId); } catch (_) {}   // タッチでも他のスロット上の移動を拾えるように
    clearTimeout(timer);
    timer = setTimeout(() => { if (active && cur && showSkillHoldInfo(cur._sk.mon, cur._sk.entry)) shown = true; }, 350);
  }, true);
  document.addEventListener('pointermove', (e) => {
    if (!active) return;
    const sl = slotAt(e.clientX, e.clientY);
    if (shown) {                                  // 表示中：指の下のモンスターに即切り替え
      if (sl && sl !== cur) { cur = sl; showSkillHoldInfo(sl._sk.mon, sl._sk.entry); }
      else if (!sl) { cur = null; hideSkillHoldInfo(); }
      else if (sl === cur) { /* 同じスロット */ }
      return;
    }
    if (Math.abs(e.clientX - sx) > 12 || Math.abs(e.clientY - sy) > 12 || (sl && sl !== cur)) {
      clearTimeout(timer); timer = null; active = false;   // 表示前に動いたらキャンセル
    }
  }, true);
  ['pointerup', 'pointercancel'].forEach(ev => document.addEventListener(ev, end, true));
})();

function renderParty() {
  if (window.MultiShare && MultiShare.remoteView) { MultiShare.paintRemote(); return; }   // マルチ：相手のパーティーを表示中
  const grid = document.getElementById('party-grid');
  grid.innerHTML = '';
  damageElements = [];
  const _prevLift = _liftedSkillUids;          // 前回の描画で持ち上がっていたモンスター
  const _nextLift = new Set();                 // 今回スキルが使える（＝持ち上げる）モンスター
  let _newlyReady = false;                     // 今回あらたに溜まったモンスターがいたか
  const _raf2 = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));
  for (let i = 0; i < 6; i++) {
    const slot = document.createElement('div');
    slot.className = 'party-slot';
    const uid = (i < partyUids.length) ? partyUids[i] : null;
    if (uid !== null) {
      const entry = box.find(b => b.uid === uid);
      if (entry) {
        const mon = MONSTER_DATA[entry.monsterId];
        if (mon) {
          const img = document.createElement('img');
          img.src = monsterImg(mon);
          img.alt = mon.name;
          img.draggable = false;
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'cover';
          img.style.borderRadius = '0';
          img.onerror = function() { this.style.display = 'none'; };
          slot.appendChild(img);

          const requiredSp = getRequiredSp(entry, mon);
          const isSpReady = partySp >= requiredSp && !isSkillSealed(); // 共通SPで発動可能か（スキル使用不可の間は不可）
          // スキル使用不可中の印は、右のバフアイコン欄に出すので、各モンスターには付けない

          if (isSpReady) {
            // スキルが使える印：金色に脈打つ枠＋走る光（⚡「スキル」の札は削除）
            const ready = document.createElement('div');
            ready.className = 'skill-ready';
            ready.style.setProperty('--sr-phase', `-${Math.round(performance.now() % 3200)}ms`);   // 描き直しても脈打つタイミングがズレない
            ready.innerHTML =
              '<i class="sr-frame"></i><i class="sr-shine"></i>';
            slot.appendChild(ready);

            // 本家風：スキルが溜まったモンスターは、画像と枠をほんの少し上に持ち上げる
            _nextLift.add(uid);
            const wasLifted = _prevLift.has(uid);
            if (!wasLifted) _newlyReady = true;
            if (!(bindTimers[uid] && bindTimers[uid] > 0)) {   // バインド中は上げない（暗幕とズレるため）
              if (wasLifted) { img.classList.add('sk-lift'); ready.classList.add('sk-lift'); }   // すでに上がっている：そのまま
              else _raf2(() => { img.classList.add('sk-lift'); ready.classList.add('sk-lift'); });   // あらたに溜まった：ふわっと上がる
            }
          } else if (_prevLift.has(uid) && !(bindTimers[uid] && bindTimers[uid] > 0)) {
            // スキルが使えなくなった：上がった位置から、元の位置へ戻る
            img.classList.add('sk-lift');
            _raf2(() => img.classList.remove('sk-lift'));
          }

          if (bindTimers[uid] && bindTimers[uid] > 0) {
            slot.classList.add('bound');
            const bindOverlay = document.createElement('div');
            bindOverlay.className = 'bind-overlay';
            slot.appendChild(bindOverlay);
            const bindLabel = document.createElement('div');
            bindLabel.className = 'bind-turn-label';
            bindLabel.textContent = `バインド ${bindTimers[uid]}T`;
            slot.appendChild(bindLabel);
            if (isSpReady) {
              const cd2 = slot.querySelector('.skill-ready');
              if (cd2) { cd2.style.opacity = '0.3'; cd2.classList.add('dim'); }   // バインド中は枠を薄く
            }
          }

          const dmgEl = document.createElement('div');
          dmgEl.className = 'monster-damage';
          const colors = { fire: '#ff5555', water: '#55aaff', wood: '#55ff55', light: '#ffdd44', dark: '#cc77ff', heal: '#ff88aa' };
          dmgEl.style.color = colors[mon.attr] || '#ffffff';
          slot.appendChild(dmgEl);
          damageElements.push(dmgEl);

          attachSkillHold(slot, mon, entry);
          slot.addEventListener('click', function(e) {
            if (_longPressTriggered) { _longPressTriggered = false; return; }
            if (Date.now() - _skHoldEndAt < 350) return;   // 長押しでスキル説明を見た直後の誤発動を防ぐ
            const idx = Array.from(document.querySelectorAll('#party-grid .party-slot')).indexOf(this);
            if (idx !== -1 && idx < partyUids.length && partyUids[idx] !== null) openSkillConfirm(partyUids[idx]);
          });

        }
      }
    } else damageElements.push(null);
    grid.appendChild(slot);
  }
  _liftedSkillUids = _nextLift;
  if (_newlyReady) playSE('skills');   // スキルが溜まった効果音（画像が持ち上がる瞬間に鳴らす）
  updatePlayerHP();
  updateSpGaugeUI();
}

// 操作時間バーの残り割合(0〜1)を反映する。CSS側(--t)がバーの長さ・先端の光・残りわずかの色替えを担当
let _timerTrackEl = null, _timerLow = false;
function setTimerRatio(ratio) {
  if (!_timerTrackEl || !_timerTrackEl.isConnected) _timerTrackEl = document.getElementById('timer-track');
  if (!_timerTrackEl) return;
  const r = Math.min(1, Math.max(0, ratio));
  _timerTrackEl.style.setProperty('--t', r.toFixed(4));
  const low = r < 0.25;                                       // 残り25%を切ったら琥珀色へ
  if (low !== _timerLow) { _timerLow = low; _timerTrackEl.classList.toggle('low', low); }
}

function startTimer() {
  setTimerRatio(1);
  timerStart = performance.now();
  function tick(now) {
    const ratio = Math.max(0, 1 - (now - timerStart) / currentMoveMs);
    setTimerRatio(ratio);
    if (ratio <= 0) {
      stopTimer(); timerStarted = false;
      if (dragging) { dragging = false; if (dragEl) { dragEl.style.transform = ''; dragEl.classList.remove('dragging'); dragEl = null; } gridRectCache = null; evaluateIfMoved(); }
      return;
    }
    timerRaf = requestAnimationFrame(tick);
  }
  timerRaf = requestAnimationFrame(tick);
}
function stopTimer() { cancelAnimationFrame(timerRaf); setTimerRatio(1); }

const pt = e => { const t = e.touches?.[0] ?? e; return [t.clientX, t.clientY]; };
function cellAt(x, y) {
  const g = document.getElementById('grid');
  const b = g.getBoundingClientRect();
  const c = Math.floor((x - b.left) / (b.width / COLS));
  const r = Math.floor((y - b.top) / (b.height / ROWS));
  return (r>=0&&r<ROWS&&c>=0&&c<COLS) ? {r,c} : null;
}
// 斜め移動の調整：
//  DIAG_DEPTH  … 斜めマスに入ってから実際に斜め入れ替えするまでの深さ（マス幅の割合）。小さいほど反応が早い
//  DIAG_CORNER … 縦／横の隣マスに入った時、指が「角寄り」（掴んだマスの中心から垂直方向にこの割合以上ずれている）なら
//                すぐ縦横に入れ替えず、斜めに入るのを少し待つ（斜めに動かしたつもりが縦横に化けるのを防ぐ）
//  DIAG_WAIT   … 角寄りでも、縦横方向にこの割合以上深く入ったら待たずに縦横で入れ替える（本当に縦横に動かしたい時用）
const DIAG_DEPTH  = 0.18;
const DIAG_CORNER = 0.28;
const DIAG_WAIT   = 0.25;
let grabOffsetX = 0, grabOffsetY = 0, curCellW = 0, curCellH = 0, gridRectCache = null;

// ★ ドロップを掴んだだけ（盤面が変わっていない）場合はターンを消費しない ★
let grabSnapshot = null;
let grabMoved = false;   // 掴んだドロップが実際に別のマスへ動いた（入れ替えが起きた）か。同じ属性同士の入れ替えでも true になる
function gridSnapshot() { return grid.map(row => row.join(',')).join('|'); }
function evaluateIfMoved() {
  _rlHold = false;
  // 「掴んだだけ」＝入れ替えが一度も起きていない時だけターンを消費しない（同属性同士を入れ替えても動かした扱い）
  const unchanged = grabSnapshot !== null && !grabMoved && grabSnapshot === gridSnapshot();
  grabSnapshot = null;
  grabMoved = false;
  if (unchanged) return;   // 盤面が掴む前と同じ → 評価もターン消費（敵の攻撃）もしない
  evaluate();
}

function onStart(e) {
  if (busy) return;
  e.preventDefault();
  const [x, y] = pt(e);
  const cell = cellAt(x, y);
  if (!cell) return;
  const g = document.getElementById('grid');
  gridRectCache = g.getBoundingClientRect();
  curCellW = gridRectCache.width / COLS;
  curCellH = gridRectCache.height / ROWS;
  dragging = true;
  if (grabSnapshot === null) { grabSnapshot = gridSnapshot(); grabMoved = false; }
  dragR = cell.r; dragC = cell.c;
  dragEl = orbEls[dragR][dragC];
  dragEl.classList.add('dragging');
  lastMoveX = x; lastMoveY = y;
  timerStarted = false;
}

function onMove(e) {
  if (!dragging || busy) return;
  e.preventDefault();
  const [x, y] = pt(e);
  const targetCell = cellAt(x, y);

  if (targetCell && (targetCell.r !== dragR || targetCell.c !== dragC)) {
    while (dragR !== targetCell.r || dragC !== targetCell.c) {
      let nr = dragR, nc = dragC;
      const dr = targetCell.r - dragR, dc = targetCell.c - dragC;
      if (Math.abs(dr) === 1 && Math.abs(dc) === 1) {
        // ★ 斜め移動：斜めのマスに「しっかり」入った時だけ斜めに動かす ★
        // 指が斜めマスの角をかすめただけ（境界から DIAG_DEPTH×マス幅 未満）では動かさない。
        // 動かさないまま指を進めれば、通常の縦／横の入れ替えか、深く入った時の斜め入れ替えになる。
        const cx = gridRectCache.left + (dragC + 0.5) * curCellW;
        const cy = gridRectCache.top + (dragR + 0.5) * curCellH;
        if (Math.abs(x - cx) >= (0.5 + DIAG_DEPTH) * curCellW &&
            Math.abs(y - cy) >= (0.5 + DIAG_DEPTH) * curCellH) { nr = dragR + dr; nc = dragC + dc; }
        else break;
      } else {
        // ★ 縦／横の隣マスに入った時：指が角寄りなら、斜めマスに入るかどうかを少しだけ待つ ★
        const ocx = gridRectCache.left + (dragC + 0.5) * curCellW;
        const ocy = gridRectCache.top + (dragR + 0.5) * curCellH;
        const ux = (x - ocx) / curCellW, uy = (y - ocy) / curCellH;
        const vertical = dragR !== targetCell.r && dragC === targetCell.c;
        const along = vertical ? Math.abs(uy) : Math.abs(ux);
        const perp  = vertical ? Math.abs(ux) : Math.abs(uy);
        if (perp >= DIAG_CORNER && along < 0.5 + DIAG_WAIT) {
          // 待った先の斜めマスが盤面内にある時だけ待つ（端なら普通に縦横）
          const wr = vertical ? dragR + (targetCell.r > dragR ? 1 : -1) : dragR + (uy > 0 ? 1 : -1);
          const wc = vertical ? dragC + (ux > 0 ? 1 : -1) : dragC + (targetCell.c > dragC ? 1 : -1);
          if (wr >= 0 && wr < ROWS && wc >= 0 && wc < COLS) break;
        }
        if (dragR !== targetCell.r) nr = dragR + (targetCell.r > dragR ? 1 : -1);
        else nc = dragC + (targetCell.c > dragC ? 1 : -1);
      }
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
      if (!timerStarted && !timeStopActive) { timerStarted = true; startTimer(); }
      [grid[dragR][dragC], grid[nr][nc]] = [grid[nr][nc], grid[dragR][dragC]];
      grabMoved = true;   // 入れ替えが起きた（中身が同じ属性でも動かした扱い）
      revealBlind(dragR, dragC); revealBlind(nr, nc);   // 動かしたドロップは暗闇が解ける（掴んだだけでは解けない）
      const otherEl = orbEls[nr][nc];
      otherEl.style.transition = 'none';
      otherEl.className = 'orb ' + grid[nr][nc];
      otherEl.style.transform = '';
      void otherEl.offsetWidth;
      otherEl.style.transition = '';
      const vacatedEl = orbEls[dragR][dragC];
      vacatedEl.style.transition = 'none';
      vacatedEl.className = 'orb ' + grid[dragR][dragC];
      vacatedEl.style.transform = '';
      void vacatedEl.offsetWidth;
      vacatedEl.style.transition = '';
      dragR = nr; dragC = nc;
      dragEl = orbEls[dragR][dragC];
      dragEl.classList.add('dragging');
      playDropSound();
      if (window.MultiShare) MultiShare.live();   // マルチ：動かしている盤面を相手の画面にも見せる
    }
  }

  const limX = curCellW * 1.0, limY = curCellH * 1.0;
  const centerX = gridRectCache.left + (dragC + 0.5) * curCellW;
  const centerY = gridRectCache.top + (dragR + 0.5) * curCellH;
  let offX = Math.max(-limX, Math.min(limX, x - centerX));
  let offY = Math.max(-limY, Math.min(limY, y - centerY));
  dragEl.style.transform = `translate(${offX}px, ${offY}px) scale(1.28)`;
  lastMoveX = x; lastMoveY = y;
}

function onEnd(e) {
  if (!dragging) return;
  dragging = false;
  if (!timeStopActive) { stopTimer(); timerStarted = false; }
  if (dragEl) { dragEl.style.transform = ''; dragEl.classList.remove('dragging'); }
  dragEl = null; gridRectCache = null;
  if (window.MultiShare) MultiShare.live(true);   // マルチ：指を離した時の盤面
  if (!timeStopActive) { _rlHold = roulettes.length > 0; setTimeout(evaluateIfMoved, 80); }
}

function findGroups() {
  const hit = Array.from({length:ROWS}, () => Array(COLS).fill(false));
  for (let r=0; r<ROWS; r++) for (let c=0; c<COLS-2; c++) {
    const t = grid[r][c];
    if (t && grid[r][c+1]===t && grid[r][c+2]===t) {
      let l=3; while(c+l<COLS&&grid[r][c+l]===t) l++;
      for(let i=0;i<l;i++) hit[r][c+i]=true;
    }
  }
  for (let c=0; c<COLS; c++) for (let r=0; r<ROWS-2; r++) {
    const t = grid[r][c];
    if (t && grid[r+1][c]===t && grid[r+2][c]===t) {
      let l=3; while(r+l<ROWS&&grid[r+l][c]===t) l++;
      for(let i=0;i<l;i++) hit[r+i][c]=true;
    }
  }
  const visited = Array.from({length:ROWS}, () => Array(COLS).fill(false));
  const groups = [];
  for (let r=0; r<ROWS; r++) for (let c=0; c<COLS; c++) {
    if (!hit[r][c] || visited[r][c]) continue;
    const color = grid[r][c];
    const cells = []; const queue = [{r, c}];
    visited[r][c] = true;
    while (queue.length) {
      const {r:cr, c:cc} = queue.shift();
      cells.push({r:cr, c:cc});
      for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr=cr+dr, nc=cc+dc;
        if (nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&!visited[nr][nc]&&hit[nr][nc]&&grid[nr][nc]===color) {
          visited[nr][nc]=true; queue.push({r:nr,c:nc});
        }
      }
    }
    groups.push({color, cells});
  }
  return groups;
}

// 「残りドロップ○個以下」のリーダースキルが発動したとき、コンボの最後に盤面の真ん中へ合計倍率を出す
function showRemainingOrbsMult(mult) {
  try {
    const gridEl = document.getElementById('grid');
    const wrapEl = document.getElementById('grid-wrap');
    const overlay = document.getElementById('combo-overlay');
    if (!gridEl || !wrapEl || !overlay) return;
    const gRect = gridEl.getBoundingClientRect();
    const wRect = wrapEl.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'remain-mult';
    el.textContent = '\u00d7' + (Math.round(mult * 100) / 100).toString();
    el.style.cssText = `position:absolute;left:${(gRect.left - wRect.left) + gRect.width / 2}px;top:${(gRect.top - wRect.top) + gRect.height / 2}px;` +
      'transform:translate(-50%,-50%);font-weight:900;font-size:' + Math.max(40, Math.floor(gRect.width / 6)) + 'px;color:#fff;white-space:nowrap;pointer-events:none;' +
      'text-shadow:0 0 6px #ffb300,0 0 14px #ff8c00,0 2px 0 #b34700,2px 0 0 #b34700,-2px 0 0 #b34700,0 -2px 0 #b34700;';
    overlay.appendChild(el);
    comboChips.push(el);   // 次のターンの頭で、コンボ表示と一緒に消える
    if (el.animate) el.animate([
      { opacity: 0, transform: 'translate(-50%,-50%) scale(0.4)' },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1.25)', offset: 0.35 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }
    ], { duration: 380, easing: 'ease-out', fill: 'both' });
  } catch (err) {}
}

function addComboChip(n, cells, totalBoost) {
  const gridEl = document.getElementById('grid');
  const wrapEl = document.getElementById('grid-wrap');
  const gRect = gridEl.getBoundingClientRect();
  const wRect = wrapEl.getBoundingClientRect();
  const cellW = gRect.width / COLS;
  const cellH = gRect.height / ROWS;
  const avgR = cells.reduce((s,c) => s+c.r, 0) / cells.length;
  const avgC = cells.reduce((s,c) => s+c.c, 0) / cells.length;
  const x = (gRect.left - wRect.left) + (avgC + 0.5) * cellW;
  const y = (gRect.top - wRect.top) + (avgR + 0.5) * cellH;
  const el = document.createElement('div');
  el.className = 'combo-chip';
  let html = `Combo ${n}`;
  if (totalBoost > 1.0) html += `<span class="combo-boost"> ×${totalBoost.toFixed(1)}</span>`;
  el.innerHTML = html;
  el.style.left = x + 'px'; el.style.top = y + 'px';
  document.getElementById('combo-overlay').appendChild(el);
  comboChips.push(el);
}
function clearComboChips() { comboChips.forEach(el => el.remove()); comboChips = []; }

// ============================================================
// ★ メイン評価（コンボ補正を最終コンボで一括適用） ★
// ============================================================
// 自分の攻撃（消す→コンボ→ダメージ）中もMenuを押せないようにする（見た目用に #game へ player-acting を付ける）
async function evaluate() {
  if (busy) return;
  const g = document.getElementById('game');
  if (g) g.classList.add('player-acting');
  try { await _evaluateInner(); }
  finally { if (g) g.classList.remove('player-acting'); }
}
async function _evaluateInner() {
  if (busy) return;
  busy = true;
  enemyJudgeBoard = null;
  let totalCombo = 0; let turnDmg = 0;
  let pendingDamages = new Array(6).fill(0);
  clearComboChips();
  resetLsGuard();
  let lastGroupCells = null;
  damageElements.forEach(el => { if (el) { el.textContent = ''; el.classList.remove('show', 'pop'); } });
  const attrCounts = { fire: 0, water: 0, wood: 0, light: 0, dark: 0, heal: 0, poison: 0, ojama: 0 };
  let exact4Count = 0;
  let crossCount = 0;
  let lShapes = 0;
  const crossAttrs = {};   // 属性ごとの十字消しの数
  const lAttrs = {};       // 属性ごとのL字消しの数
  let fireCombos = 0;
  let darkCombos = 0;
  let healCombos = 0;
  // 属性ごとのコンボ数。新しい属性コンボ条件はこの値を使う。
  const attrCombos = { fire: 0, water: 0, wood: 0, light: 0, dark: 0, heal: 0, poison: 0, ojama: 0 };
  let hasWaterConnect5 = false;
  let hasDarkConnect5 = false;
  let exactAttrCounts = {};
  let maxConnect = {}; // 属性ごとの「最大つながり数」（orbConnect の2属性同時判定用）
  let comboIndex = 0;

  let moveFixed = null;
  let moveAdd = 0;
  [0,5].forEach(idx => {
    if (partyUids.length > idx && partyUids[idx] !== null) {
      const e = box.find(b => b.uid === partyUids[idx]);
      if (e) {
        const m = MONSTER_DATA[e.monsterId];
        if (m && m.leaderSkill && m.leaderSkill.effects) {
          for (const eff of m.leaderSkill.effects) {
            if (eff.type === 'moveTimeFixed') moveFixed = eff.value;
            if (eff.type === 'moveTimeAdd') moveAdd += Math.round((Number(eff.value) || 0) * 1000);
          }
        }
      }
    }
  });
  moveTimeFixed = moveFixed;
  leaderMoveAddMs = moveAdd;
  currentMoveMs = calcCurrentMoveMs();

  let noDropFlagTriggered = false;
  const _enemyNoFallNow = !!(enemyNoFall && enemyNoFall.turns > 0);   // 敵の「落ちコンなし」：このターンの消しに適用（ターン数は消し終えてから減る）
  let comboAddTriggered = false;
  const comboAddFired = new Set();   // このターンに発動済みのコンボ加算（リーダー効果の番号）
  const shapeFxEffects = lsShapeEffects();   // リーダー／フレンドの「形」条件（4つ消し・L字・十字・〇個以上つなげ）
  const shapeFxPending = [];                 // 2属性同時つなげで、相方がまだそろっていない塊（そろったら光らせる）

  while (true) {
    const groups = findGroups();
    if (!groups.length) break;
    const passMax = {};   // この巡で消える塊の、属性ごとの最大つながり数
    for (const g of groups) passMax[g.color] = Math.max(passMax[g.color] || 0, g.cells.length);
    for (const {color, cells} of groups) {
      comboIndex++; totalCombo = comboIndex;
      if (cells.length === 4) exact4Count++;
      let isCross = false;
      if (isCrossGroup(cells)) { crossCount++; isCross = true; crossAttrs[color] = (crossAttrs[color] || 0) + 1; }
      let isL = false;
      if (isLShape(cells)) { lShapes++; isL = true; lAttrs[color] = (lAttrs[color] || 0) + 1; }

      if (color === 'fire') fireCombos++;
      if (color === 'dark') darkCombos++;
      if (color === 'heal') healCombos++;
      if (attrCombos[color] !== undefined) attrCombos[color]++;
      if (color === 'water' && cells.length >= 5) hasWaterConnect5 = true;
      if (color === 'dark' && cells.length >= 5) hasDarkConnect5 = true;
      if (color) maxConnect[color] = Math.max(maxConnect[color] || 0, cells.length);
      if (color) {
        // その属性で消した塊の個数を全て記録（例: 木4個の塊 → exactAttrCounts.wood[4] = true）
        if (!exactAttrCounts[color]) exactAttrCounts[color] = {};
        exactAttrCounts[color][cells.length] = true;
      }

      // ★ リーダースキルの条件を満たした塊だけ、その形に光る（条件にない普通の消しは演出なし） ★
      if (shapeFxEffects.length) {
        const hit = lsShapeMatch(shapeFxEffects, { color, cells, isCross, isL, maxConnect, passMax });
        if (typeof hit === 'string') {
          lsShapeFx(cells, hit);
          // 先に消えた相方の塊も、条件がそろったので光らせる
          for (let pi = shapeFxPending.length - 1; pi >= 0; pi--) {
            const pd = shapeFxPending[pi];
            if (pd.pair.every(a => (maxConnect[a] || 0) >= pd.need)) { lsShapeFx(pd.cells, ATTR_FX_COLOR[pd.color] || '#fff'); shapeFxPending.splice(pi, 1); }
          }
        } else if (hit && hit.pending) {
          shapeFxPending.push({ cells: cells.map(q => ({ r: q.r, c: q.c })), color, need: hit.need, pair: hit.pair });
        }
      }

      playComboSound(totalCombo);
      cells.forEach(({r,c}) => { revealBlind(r, c); orbEls[r][c].className = `orb ${color} glow`; });
      if (window.MultiShare) MultiShare.fx('cb', { n: totalCombo, c: color, k: cells.map(q => [q.r, q.c]) });   // マルチ：相手の画面にもコンボを流す

      const lsEffects = [];
      [0, 5].forEach(idx => {
        if (partyUids.length > idx && partyUids[idx] !== null) {
          const e = box.find(b => b.uid === partyUids[idx]);
          if (e) { const m = MONSTER_DATA[e.monsterId]; if (m && m.leaderSkill && m.leaderSkill.effects) lsEffects.push(...m.leaderSkill.effects); }
        }
      });
      // 今消す塊も数えた個数で判定する（そうしないと「4色以上」は、4色目を消した瞬間には成立せず、5個目の塊まで倍率が出ない）
      const ctxCounts = { ...attrCounts };
      if (ctxCounts[color] !== undefined) ctxCounts[color] += cells.length;
      const ctx = { attr: color, comboCount: totalCombo, exact4Count, orbCounts: ctxCounts, enemyAttr: enemyList[0]?.attr || 'dark', crossCount, crossAttrs, lAttrs, poisonCount: ctxCounts.poison, fireCombos, lShapes, hpRatio: playerCurrentHP / playerMaxHP, skillUsed: skillUsedThisTurn, darkCombos, healCombos, attrCombos, hasWaterConnect5, hasDarkConnect5, maxConnect, exactAttrCounts };
      const result = applyLeaderEffects(lsEffects, ctx);
      lastGroupCells = cells;
      checkLsGuard(lsEffects, ctx, cells);   // ダメージ軽減が発動（増えた）ならそのドロップの場所で演出
      addComboChip(totalCombo, cells, result.atkMultiplier);
      await sleep(220);
      cells.forEach(({r,c}) => { orbEls[r][c].className = `orb ${color} vanish`; });
      await sleep(140);
      if (attrCounts[color] !== undefined) attrCounts[color] += cells.length;
      if (color === 'poison') showPoisonPreview(attrCounts.poison);   // 毒ダメージ予告（HPバーを紫に）
      cells.forEach(({r,c}) => { grid[r][c] = null; });

      // ★ コンボ加算：リーダー効果の「comboAdd」。その効果の条件を達成したドロップが消えた場所に、コンボが加算されて出る ★
      //   各効果は1ターンに1回だけ発動
      for (let ei = 0; ei < lsEffects.length; ei++) {
        const ce = lsEffects[ei];
        if (!ce || !(ce.comboAdd > 0) || comboAddFired.has(ei)) continue;
        const n = ce.count || 1;
        let ok = false;
        switch (ce.condition) {
          case 'cross': ok = isCross && (!ce.shapeAttr || ce.shapeAttr === color); break;
          case 'lShapes': ok = isL && (!ce.shapeAttr || ce.shapeAttr === color); break;
          case 'exact4': ok = cells.length === 4; break;
          case 'combo': ok = totalCombo >= n; break;
          case 'poison': ok = color === 'poison'; break;
          case 'attrCombos': ok = color === ce.attr && (attrCombos[color] || 0) >= n; break;
          case 'fireCombos': ok = color === 'fire' && fireCombos >= n; break;
          case 'darkCombos': ok = color === 'dark' && darkCombos >= n; break;
          case 'healCombos': ok = color === 'heal' && healCombos >= n; break;
          case 'orbConnect':
            if (ce.attr2) ok = (color === ce.attr || color === ce.attr2) && (maxConnect[ce.attr] || 0) >= n && (maxConnect[ce.attr2] || 0) >= n;
            else ok = color === ce.attr && cells.length >= n;   // 今消した塊がつながった個数で判定
            break;
        }
        if (!ok) continue;
        comboAddFired.add(ei);
        const avgR = cells.reduce((q, w) => q + w.r, 0) / cells.length;
        const avgC = cells.reduce((q, w) => q + w.c, 0) / cells.length;
        for (let ca = 0; ca < Math.floor(ce.comboAdd); ca++) {
          comboIndex++; totalCombo = comboIndex;
          addComboChip(totalCombo, [{ r: Math.min(ROWS - 0.5, avgR + ca * 0.5), c: avgC }], 1.0);
          if (window.MultiShare) MultiShare.fx('cb', { n: totalCombo, add: 1, k: [[Math.min(ROWS - 0.5, avgR + ca * 0.5), avgC]] });
          playComboSound(totalCombo);
          await sleep(220);
        }
      }

      // ★ グループ単位の基礎ダメージ（orbBonus のみ。comboBonus は後で一括適用） ★
      const temp = [];
      for (let i = 0; i < partyUids.length; i++) {
        const uid = partyUids[i];
        if (uid === null) { temp.push(0); continue; }
        const entry = box.find(b => b.uid === uid);
        if (!entry) { temp.push(0); continue; }
        const mon = MONSTER_DATA[entry.monsterId];
        if (!mon) { temp.push(0); continue; }
        // 本家仕様：今消した「この1グループ」と同じ属性のモンスターだけが、そのグループの個数ぶんで攻撃する
        //（他の色を消した時に、以前消した色の攻撃が重複加算されないようにする）
        if (mon.attr !== color) { temp.push(0); continue; }
        const count = cells.length;
        if (count < 3) { temp.push(0); continue; }
        if (bindTimers[uid] && bindTimers[uid] > 0) { temp.push(0); continue; }

        const orbBonus = 1 + 0.25 * (count - 3);
        const entryAtk = calcMonsterStats(entry).atk;
        let dmg = Math.floor(entryAtk * orbBonus * enemyAtkDownMult(mon.attr));   // 敵の攻撃力ダウンを反映
        if (dmg > 2147483647) dmg = 2147483647;
        temp.push(dmg);
      }
      for (let i = 0; i < temp.length; i++) {
        if (temp[i] > 0) {
          pendingDamages[i] = (pendingDamages[i] || 0) + temp[i];
          const el = damageElements[i];
          if (el) {
            el.textContent = pendingDamages[i].toLocaleString();
            el.classList.add('show');
            el.classList.remove('pop');
            void el.offsetWidth;
            el.classList.add('pop');
          }
        }
      }
      if (window.MultiShare) MultiShare.fx('pd', pendingDamages.slice());   // マルチ：各モンスターの攻撃力の積み上がりを相手の画面へ
    }

    if (!comboAddTriggered && hasWaterConnect5 && hasDarkConnect5) {
      const lsEffectsCA = [];
      [0, 5].forEach(idx => {
        if (partyUids.length > idx && partyUids[idx] !== null) {
          const e = box.find(b => b.uid === partyUids[idx]);
          if (e) { const m = MONSTER_DATA[e.monsterId]; if (m && m.leaderSkill && m.leaderSkill.effects) lsEffectsCA.push(...m.leaderSkill.effects); }
        }
      });
      const caCtx = { attr:'none', comboCount:totalCombo, exact4Count, orbCounts:attrCounts, enemyAttr:enemyList[0]?.attr || 'dark', crossCount, crossAttrs, lAttrs, poisonCount:attrCounts.poison, fireCombos, lShapes, hpRatio:playerCurrentHP/playerMaxHP, skillUsed:skillUsedThisTurn, darkCombos, healCombos, attrCombos, hasWaterConnect5, hasDarkConnect5, maxConnect, exactAttrCounts };
      const caResult = applyLeaderEffects(lsEffectsCA, caCtx);
      if (caResult.comboAdd > 0) {
        comboAddTriggered = true;
        const addCount = caResult.comboAdd;
        for (let ca = 0; ca < addCount; ca++) {
          comboIndex++;
          totalCombo = comboIndex;
          const bonusCells = [{r: 2, c: Math.min(ca * 2, COLS - 1)}];
          addComboChip(totalCombo, bonusCells, 1.0);
          if (window.MultiShare) MultiShare.fx('cb', { n: totalCombo, add: 1, k: bonusCells.map(q => [q.r, q.c]) });
          playComboSound(totalCombo);
          await sleep(180);
        }
      }
    }

    let noDropFlag = false;
    [0, 5].forEach(idx => {
      if (partyUids.length > idx && partyUids[idx] !== null) {
        const e = box.find(b => b.uid === partyUids[idx]);
        if (e) {
          const m = MONSTER_DATA[e.monsterId];
          if (m && m.leaderSkill && m.leaderSkill.effects) {
            for (const eff of m.leaderSkill.effects) {
              if (eff.type === 'noDrop') noDropFlag = true;
            }
          }
        }
      }
    });

    // ★ 落ちコンなし（本家仕様） ★
    //   盤面に残ったドロップは通常どおり下へ詰める（＝詰めた結果できたコンボは数える）が、
    //   上から新しいドロップは降らせない。新ドロップはコンボ・ダメージが全部終わってから補充する。
    if (noDropFlag || _enemyNoFallNow) { noDropFlagTriggered = true; await drop(false); await sleep(40); }
    else { await drop(); await sleep(40); }
  }

  let remainingOrbs = 0;
  for (let r=0; r<ROWS; r++) for (let c=0; c<COLS; c++) if (grid[r][c] !== null) remainingOrbs++;
  lastTurnCtx = { comboCount: totalCombo, exact4Count, orbCounts: { ...attrCounts }, crossCount, crossAttrs, lAttrs, poisonCount: attrCounts.poison, fireCombos, lShapes,
    darkCombos, healCombos, attrCombos: { ...attrCombos }, hasWaterConnect5, hasDarkConnect5, maxConnect: { ...maxConnect },
    exactAttrCounts: { ...exactAttrCounts }, remainingOrbs, skillUsed: skillUsedThisTurn };
  // 盤面に残ったドロップ数で決まる軽減など、最後にわかる軽減もここで発動させる
  if (totalCombo > 0) checkLsGuard(lsAllEffects(), defenseCtx(enemyList[0]), lastGroupCells);

  // 残りドロップ数の条件（remainingOrbs）が成立していたら、合計倍率を盤面の真ん中に出す
  if (totalCombo > 0) {
    const lsAll = lsAllEffects();
    const hit = lsAll.some(e => e && e.condition === 'remainingOrbs' && (e.type === 'atk' || e.type === 'dmgReduction')
      && remainingOrbs <= e.threshold);
    if (hit) {
      let best = 1;
      for (const uid of partyUids) {
        if (uid === null) continue;
        const en = box.find(b => b.uid === uid);
        const mn = en && MONSTER_DATA[en.monsterId];
        if (!mn) continue;
        const rr = applyLeaderEffects(lsAll, { attr: mn.attr, monsterType: mn.type, comboCount: totalCombo, exact4Count, orbCounts: attrCounts,
          enemyAttr: enemyList[0]?.attr || 'dark', crossCount, crossAttrs, lAttrs, poisonCount: attrCounts.poison, fireCombos, lShapes,
          hpRatio: playerCurrentHP / playerMaxHP, skillUsed: skillUsedThisTurn, darkCombos, healCombos, attrCombos,
          hasWaterConnect5, hasDarkConnect5, maxConnect, exactAttrCounts, remainingOrbs });
        if (rr.atkMultiplier > best) best = rr.atkMultiplier;
      }
      if (best > 1) showRemainingOrbsMult(best);
    }
  }

  if (totalCombo > 0) {
    const _recDownSnap = enemyRecDown ? enemyRecDown.value : 1;   // 敵の回復力ダウン（ターン経過の前の値で回復を計算）
    updateSkillTurnsNormal(totalCombo);

    // ★ 最終コンボ補正を一括適用し、LS/エンハンス倍率を乗算 ★
    const finalComboBonus = 1 + 0.25 * (totalCombo - 1);
    let finalDamages = [];
    let anyAtkUp = false;   // 攻撃力アップ(LS/バフ倍率 or コンボ補正)がかかったか
    // 毒・回復の「前」のHP割合（この後 回復が入っても「HP〇%以下」を判定できるよう覚えておく）
    const _hpStartRatio = playerCurrentHP / Math.max(1, playerMaxHP);
    // ダメージ計算。回復後にもう一度呼んで、回復でHP満タン／HP〇%以上になった分も反映する
    const calcFinalDamages = () => {
    finalDamages = []; anyAtkUp = false;
    for (let i = 0; i < partyUids.length; i++) {
      const uid = partyUids[i];
      if (uid === null) { finalDamages.push(0); continue; }
      const entry = box.find(b => b.uid === uid);
      if (!entry) { finalDamages.push(0); continue; }
      const mon = MONSTER_DATA[entry.monsterId];
      if (!mon) { finalDamages.push(0); continue; }
      if (bindTimers[uid] && bindTimers[uid] > 0) { finalDamages.push(0); continue; }

      let baseDmg = pendingDamages[i] || 0;
      if (baseDmg === 0) { finalDamages.push(0); continue; }

      // コンボ補正をここで一括適用
      baseDmg = Math.floor(baseDmg * finalComboBonus);

      let atkMult = 1.0;
      const lse = [];
      [0, 5].forEach(idx => {
        if (partyUids.length > idx && partyUids[idx] !== null) {
          const e = box.find(b => b.uid === partyUids[idx]);
          if (e) { const m = MONSTER_DATA[e.monsterId]; if (m && m.leaderSkill && m.leaderSkill.effects) lse.push(...m.leaderSkill.effects); }
        }
      });
      // 「満タン／HP〇%以上」系：毒・回復を済ませた今のHP（回復で条件達成でも発動）。回復前に条件を満たしていた場合も従来どおり発動
      // 「HP〇%以下」系：回復する前のHPでも判定（回復して%を超えても発動）
      const _hpNowRatio = playerCurrentHP / Math.max(1, playerMaxHP);
      const hpRatioFinal = Math.max(_hpStartRatio, _hpNowRatio);
      const hpRatioLowFinal = Math.min(_hpStartRatio, _hpNowRatio);
      const context = { attr: mon.attr, monsterType: mon.type, comboCount: totalCombo, exact4Count, orbCounts: attrCounts, enemyAttr: enemyList[0]?.attr || 'dark', crossCount, crossAttrs, lAttrs, poisonCount: attrCounts.poison, fireCombos, lShapes, hpRatio: hpRatioFinal, hpRatioLow: hpRatioLowFinal, skillUsed: skillUsedThisTurn, darkCombos, healCombos, attrCombos, hasWaterConnect5, hasDarkConnect5, maxConnect, exactAttrCounts, remainingOrbs };
      const res = applyLeaderEffects(lse, context);
      atkMult = res.atkMultiplier;
      for (const b of atkBuffs) {
        if ((!b.attr || mon.attr === b.attr) && (!b.monType || mon.type === b.monType)) atkMult *= b.value;
      }

      let finalDmg = Math.floor(baseDmg * atkMult);
      if (finalDmg > 2147483647) finalDmg = 2147483647;
      // リーダースキル等の倍率、またはコンボ補正(2コンボ以上)でダメージが増える時に攻撃上昇SEを鳴らす
      if ((atkMult > 1.0 || finalComboBonus > 1) && finalDmg > 0) anyAtkUp = true;
      finalDamages.push(finalDmg);
    }
    };
    calcFinalDamages();

    // ★ 毒ダメージ（回復より先。回復があれば毒の後に回復する） ★
    _poisonNet = null;
    if (attrCounts.poison >= 3 && !leaderHasEffect('poisonImmune')) {   // リーダー／フレンドに「毒ダメージ無効」があれば受けない
      const poisonDmg = Math.floor(playerMaxHP * (attrCounts.poison + 1) * 0.05);
      const prevHP3 = playerCurrentHP;
      playSE('poison');
      playerCurrentHP = Math.max(0, playerCurrentHP - poisonDmg);
      updatePlayerHP(0);
      _poisonNet = -poisonDmg;
      _showPoisonLabel(_poisonNet);
      const seg = document.getElementById('hp-poison');
      if (seg) { seg.classList.remove('preview'); setTimeout(() => { seg.style.opacity = '0'; }, 500); }
      const pel = document.getElementById('hp-delta');
      if (pel) pel._timer = setTimeout(() => { pel.style.display = 'none'; }, 1700);
      document.getElementById('combo-label').textContent = `☠️ 毒 ${poisonDmg} ダメージ！`;
      await sleep(900);
    } else {
      hidePoisonPreview();
    }

    // ★ 回復処理（攻撃より先に処理） ★
    if (attrCounts.heal >= 3) {
      let totalRec = 0;
      const recEffects = [];
      [0, 5].forEach(idx => {
        if (partyUids.length > idx && partyUids[idx] !== null) {
          const leaderEntry = box.find(b => b.uid === partyUids[idx]);
          const leader = leaderEntry && MONSTER_DATA[leaderEntry.monsterId];
          if (leader && leader.leaderSkill && leader.leaderSkill.effects) {
            for (const eff of leader.leaderSkill.effects) if (eff.type === 'rec') recEffects.push(eff);
          }
        }
      });
      for (const uid of partyUids) {
        if (uid === null) continue;
        if (bindTimers[uid] && bindTimers[uid] > 0) continue;   // バインド中：回復力も数えない
        const entry = box.find(b => b.uid === uid);
        if (entry) {
          const mon = MONSTER_DATA[entry.monsterId];
          if (mon) {
            let rec = calcMonsterStats(entry).rec;
            for (const eff of recEffects) {
              const apply = eff.condition === 'type' ? mon.type === eff.attr : (!eff.attr || mon.attr === eff.attr);
              if (apply) rec *= eff.value;
            }
            totalRec += rec;
          }
        }
      }
      const orbBonus = 1 + 0.25 * (attrCounts.heal - 3);
      const comboBonus = 1 + 0.25 * (totalCombo - 1);
      const healAmount = Math.floor(totalRec * orbBonus * comboBonus * (buffRecMult ? buffRecMultValue : 1) * _recDownSnap);
      if (healAmount > 0) {
        playSE('heal');
        const prevHP2 = playerCurrentHP;
        playerCurrentHP = Math.min(playerMaxHP, playerCurrentHP + healAmount);
        updatePlayerHP(playerCurrentHP - prevHP2);
        document.getElementById('combo-label').textContent = `❤️ ${healAmount} 回復！`;
        // 攻撃がある場合は回復SEの少し後に攻撃開始、回復のみなら従来通り余韻を残す
        await sleep(finalDamages.some(d => d > 0) ? 350 : 800);
      }
    }
    // 回復を済ませたあとのHPでリーダースキルを判定し直す（回復してHP満タン／〇%以上になった分も発動）
    calcFinalDamages();

    // ★ 毒でHPが0なら（回復後も0なら）ゲームオーバー ★
    if (playerCurrentHP <= 0) {
      _poisonNet = null;
      triggerGameOver();
      return;
    }

    const slots = document.querySelectorAll('#party-grid .party-slot');
    await sleep(250);
    slots.forEach((slot, i) => { if (finalDamages[i] > 0) slot.classList.add('charging'); });
    await sleep(300);

    if (anyAtkUp) playSE('attackup');
    for (let i = 0; i < finalDamages.length; i++) {
      if (finalDamages[i] > 0) {
        const el = damageElements[i];
        if (el) {
          el.textContent = finalDamages[i].toLocaleString();
          el.classList.add('show');
          el.classList.remove('pop', 'boosting');
          void el.offsetWidth;
          el.classList.add('boosting');
        }
      }
    }
    if (window.MultiShare) MultiShare.fx('fd', finalDamages.slice());   // マルチ：溜め→最終ダメージを相手の画面へ
    await sleep(900);
    slots.forEach(slot => slot.classList.remove('charging'));
    damageElements.forEach(el => { if (el) el.classList.remove('boosting'); });

    const bigOrbs = {};
    for (const attr of ['fire','water','wood','light','dark']) {
      if ((maxConnect[attr] || 0) >= 5) bigOrbs[attr] = true;   // 合計個数ではなく「1つの塊で5個以上つながった」時だけ全体攻撃
    }

    const attackTargets = [];
    for (let i = 0; i < finalDamages.length; i++) {
      if (finalDamages[i] <= 0) continue;
      const uid = partyUids[i];
      if (uid === null) continue;
      const entry = box.find(b => b.uid === uid);
      if (!entry) continue;
      const mon = MONSTER_DATA[entry.monsterId];
      if (!mon) continue;
      if (bindTimers[uid] && bindTimers[uid] > 0) continue;

      const isAllAttack = bigOrbs[mon.attr] || buffAllAttack;
      if (isAllAttack) {
        attackTargets.push([i, finalDamages[i], mon.attr, -2]);   // -2 = 全体攻撃（足元から属性エフェクト・全員に同時ダメージ・待たない）
      } else {
        attackTargets.push([i, finalDamages[i], mon.attr, -1]);   // -1 = 攻撃する瞬間にターゲット決定
      }
    }

    attackPhaseCombo = totalCombo;
    markCombo8Bonus(totalCombo);   // 8コンボ以上したら、ホームに戻ったときにようびのおふだをもう1枚
    if (window.DamageTotal) DamageTotal.reset();   // 合計ダメージは、この攻撃の分を 0 から数える
    try {
      for (const [slotIdx, dmg, attr, plannedIdx] of attackTargets) {
        if (plannedIdx === -2) {
          if (!enemyList.some(e => e.hp > 0)) continue;
          // 全体攻撃：単体攻撃と同じく弾を飛ばし、当たったら ATK_GAP_MS 後に次へ（演出は裏で流れ続ける）
          if (window.MultiShare) MultiShare.fx('at0', { s: slotIdx, a: attr, e: -2 });
          await allAttackAnimation(slotIdx, dmg, attr);
          if (window.MultiShare) MultiShare.fx('at1', { s: slotIdx, a: attr, cb: totalCombo, hp: enemyList.map(e => e.hp) });
          continue;
        }
        let eIdx = plannedIdx;
        if (eIdx === -1) eIdx = getTargetIdx();   // 1匹倒しても、次の敵（ロック中ならその敵）へ自動で狙いを移す
        if (eIdx < 0 || !enemyList[eIdx] || enemyList[eIdx].hp <= 0) continue;
        if (window.MultiShare) MultiShare.fx('at0', { s: slotIdx, a: attr, e: eIdx });
        await attackAnimation(slotIdx, dmg, attr, eIdx);
        if (window.MultiShare) MultiShare.fx('at1', { s: slotIdx, a: attr, cb: totalCombo, hp: enemyList.map(e => e.hp) });
        await sleep(ATK_GAP_MS);   // 当たったあと、次の攻撃までの間（全体攻撃と共通）
      }
      if (window.DamageTotal) DamageTotal.finish();   // 全員の攻撃が終わった：合計は0.3秒残ってから、上がって消える
      if (attackTargets.length) await sleep(350);   // 最後の数字を読んでから敵の番へ
    } finally {
      attackPhaseCombo = 0;
      clearFiredSuperGut();   // 超根性：発動していたら、このターンの攻撃が終わった時点で消滅
    }

    // ★ 落ちコンなし：相手へのダメージが終わったあとに、空いたマスへ新しいドロップを上から補充（コンボ判定はしない） ★
    if (noDropFlagTriggered) { enemyJudgeBoard = grid.map(row => row.slice()); await drop(true, true); await sleep(80); noDropFlagTriggered = false; }   // 補充の前の盤面を、敵の行動判定用に控える

    // ★ 攻撃が全部終わったあとで、敵の弱体（攻撃力ダウンなど）のターンを減らす → アイコンは攻撃後に消える ★
    tickEnemyDebuffsAfterAttack();

    // ★ LS HP回復 ★
    const hpRecoveryEffects = [];
    [0,5].forEach(idx => {
      if (partyUids.length > idx && partyUids[idx] !== null) {
        const e = box.find(b => b.uid === partyUids[idx]);
        if (e) {
          const m = MONSTER_DATA[e.monsterId];
          if (m && m.leaderSkill && m.leaderSkill.effects) {
            for (const eff of m.leaderSkill.effects) {
              if (eff.type === 'hpRecovery') hpRecoveryEffects.push(eff.value);
            }
          }
        }
      }
    });
    for (const val of hpRecoveryEffects) {
      const rec = Math.floor(playerMaxHP * val);
      const prevHP4 = playerCurrentHP;
      playerCurrentHP = Math.min(playerMaxHP, playerCurrentHP + rec);
      updatePlayerHP(playerCurrentHP - prevHP4);
      document.getElementById('combo-label').textContent = `💚 ${rec} 回復！`;
      await sleep(600);
    }

    _poisonNet = null;
    totalDmg += finalDamages.reduce((a,b) => a + b, 0);
    document.getElementById('combo-label').textContent = totalCombo + ' コンボ';
    turn++;
  }

  // 念のため：空きマスが残っていたら（落ちコンなしの補充漏れ）ここで必ず埋める
  if (grid.some(row => row.some(v => v === null))) { await drop(true, true); await sleep(80); }

  await sleep(300);
  damageElements.forEach(el => { if (el) { el.textContent = ''; el.classList.remove('show', 'pop'); } });
  clearComboChips();
  skillUsedThisTurn = false;
  renderParty();

  // コンボ吸収・状態異常無効：プレイヤーの1ターンが終わるごとに残りターンを減らす
  for (const en of enemyList) {
    if (en._comboAbsorb && --en._comboAbsorb.turns <= 0) delete en._comboAbsorb;
    if (en._statusShield > 0) en._statusShield--;
    if (en._dmgReduce && en._dmgReduce.turns > 0 && --en._dmgReduce.turns <= 0) delete en._dmgReduce;   // ダメージ軽減（-1=無期限）
    if (en._attrGuards) for (const a of Object.keys(en._attrGuards)) {   // 属性軽減（-1=無期限は減らさない）
      if (en._attrGuards[a].turns > 0 && --en._attrGuards[a].turns <= 0) delete en._attrGuards[a];
    }
    // 敵の攻撃アップ：残りターンを減らし、切れたら元の攻撃力に戻す
    if (en._atkBuffTurns > 0 && --en._atkBuffTurns <= 0) { en._atkBuffTurns = 0; if (en._baseAtk) { en.atk = en._baseAtk; delete en._baseAtk; } }
  }
  updateEnemyUI();

  if (window.DamageTotal) DamageTotal.clear();   // 敵のターンに入るので、合計ダメージを消す
  if (enemyList.some(e => e.hp > 0) && playerCurrentHP > 0 && !enemyDefeatedHandled) {
    try { await doEnemyAttack(); } finally { enemyJudgeBoard = null; }
    if (_gameOverActive || (window.MultiShare && MultiShare.spectating)) return;   // ゲームオーバー演出中／観戦中は以降の処理をしない
  }
  enemyJudgeBoard = null;

  // リーダースキルのダメージ軽減は、そのターンの敵の攻撃で役目を終える（攻撃されなくても次のターン／ラウンドへ持ち越さない）
  lastTurnCtx = null;
  resetLsGuard();

  tickPlayerBuffs();
  currentMoveMs = calcCurrentMoveMs();

  const allDead = enemyList.every(e => e.hp <= 0);
  if (allDead && !enemyDefeatedHandled) enemyDefeatedHandled = true;

  if (enemyDefeatedHandled) await handleBattleEnd();

  // マルチ：1人分のパズルが終わったら、同じ盤面のまま次の人へ交代（クリア／ゲームオーバー／ホーム復帰中は交代しない）
  if (window.MultiTurn && MultiTurn.active && !_gameOverActive && !(window.MultiShare && MultiShare.spectating) && !_clearActive && document.getElementById('game').style.display === 'flex') {
    await MultiTurn.endTurn();
  }

  busy = !!(window.MultiTurn && MultiTurn.online && MultiTurn.active && !MultiTurn.isMyTurn());   // マルチ(オンライン)：あいてのターン中は操作できない
}

// (r,c) に type を置いたとき、縦か横に3つ以上つながるか（空きマスはつながらない扱い）
function wouldMatchAt(r, c, type) {
  const run = (dr, dc) => {
    let n = 0, rr = r + dr, cc = c + dc;
    while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && grid[rr][cc] === type) { n++; rr += dr; cc += dc; }
    return n;
  };
  return run(0, -1) + run(0, 1) + 1 >= 3 || run(-1, 0) + run(1, 0) + 1 >= 3;
}

// ドロップを下へ詰める。
//   fill=true  : 空きマスに新しいドロップを上から補充する（通常の落ちコンあり）
//   fill=false : 盤面に残ったドロップを下へ詰めるだけ。上は空きマスのまま（落ちコンなし中の途中経過）
//   noMatch=true : 補充するドロップが3つ以上つながらないように選ぶ（落ちコンなしの最終補充用）
async function drop(fill = true, noMatch = false) {
  const gridEl = document.getElementById('grid');
  const rect = gridEl.getBoundingClientRect();
  const cellH = rect.height / ROWS;
  let maxFall = 0;
  for (let c = 0; c < COLS; c++) {
    const existing = [];
    for (let r = 0; r < ROWS; r++) { if (grid[r][c] !== null) existing.push({type: grid[r][c], origR: r, blind: !!(blindCells[r] && blindCells[r][c])}); }
    const fillCount = ROWS - existing.length;
    const newCol = [];
    for (let i = 0; i < fillCount; i++) {
      if (!fill) { newCol.push(null); continue; }
      if (!noMatch) { newCol.push(rand()); continue; }
      // 補充ドロップが縦横3つ以上つながらない属性を選ぶ（盤面は消した直後なので空きマスは各列の上側だけ）
      const opts = TYPES.filter(t => !wouldMatchAt(i, c, t));
      const pick = opts.length ? opts[Math.floor(Math.random() * opts.length)] : rand();
      grid[i][c] = pick;
      newCol.push(pick);
    }
    for (const {type} of existing) newCol.push(type);
    for (let destR = 0; destR < ROWS; destR++) {
      const type = newCol[destR];
      grid[destR][c] = type;
      blindCells[destR][c] = destR >= fillCount ? existing[destR - fillCount].blind : false;   // 暗闇のドロップは一緒に落ちる。新しいドロップは見える
      setBlindEl(destR, c);
      const el = orbEls[destR][c];
      if (type === null) {
        // 補充しない空きマス：見えない状態にしておく
        el.style.transition = 'none';
        el.style.transform = '';
        el.className = 'orb vanish';
        continue;
      }
      let startOffsetRows;
      if (destR < fillCount) startOffsetRows = destR + 1;
      else {
        const idx = destR - fillCount;
        const origR = existing[idx].origR;
        startOffsetRows = destR - origR;
      }
      if (startOffsetRows <= 0) { el.style.transition = ''; el.className = `orb ${type}`; el.style.transform = ''; continue; }
      if (startOffsetRows > maxFall) maxFall = startOffsetRows;
      const fallDist = startOffsetRows * cellH;
      el.style.transition = 'none';
      el.style.transform = `translateY(-${fallDist}px)`;
      el.className = `orb ${type}`;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transition = '';
          el.classList.add('drop-fast');
          el.style.setProperty('--fall-delay', `${c * 0.008}s`);
          el.style.transform = '';
        });
      });
    }
  }
  if (window.MultiShare) MultiShare.fxGrid();   // マルチ：消えたあとの詰め・補充を相手の画面へ
  const waitMs = 140 + maxFall * 22 + COLS * 6;
  await sleep(waitMs);
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) orbEls[r][c].classList.remove('drop-fast');
}

function getExpForLevel(lv) { if (lv <= 1) return 0; const idx = Math.min(lv - 1, EXP_CUMULATIVE.length - 1); return EXP_CUMULATIVE[idx]; }
function getExpNeededForNext(lv, maxLv) { if (lv >= maxLv) return 0; return EXP_CUMULATIVE[lv] - EXP_CUMULATIVE[lv - 1]; }
function getMaxLevel(rarity) { if (!rarity || rarity <= 1) return 25; if (rarity === 2) return 50; if (rarity === 3) return 75; return 99; }
// モンスター個別の最大レベル。MONSTER_DATA の maxLevel を優先し、未指定ならレアリティ別の既定値。
// EXP テーブルの長さ（99）を超えないようにする。
function getMonsterMaxLevel(mon) {
  if (!mon) return getMaxLevel(1);
  const v = Math.floor(Number(mon.maxLevel));
  if (v >= 1) return Math.min(v, EXP_CUMULATIVE.length);
  return getMaxLevel(mon.rarity);
}

function calcMonsterStats(entry) {
  const mon = MONSTER_DATA[entry.monsterId]; if (!mon) return { hp:0, atk:0, rec:0 };
  const maxLv = getMonsterMaxLevel(mon);
  const lv = Math.max(1, Math.min(entry.level || 1, maxLv));
  const ratio = maxLv <= 1 ? 1 : (lv - 1) / (maxLv - 1);
  return {
    hp:  Math.floor(mon.stats.hp.min  + (mon.stats.hp.max  - mon.stats.hp.min)  * ratio),
    atk: Math.floor(mon.stats.atk.min + (mon.stats.atk.max - mon.stats.atk.min) * ratio),
    rec: Math.floor(mon.stats.rec.min + (mon.stats.rec.max - mon.stats.rec.min) * ratio),
  };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

let currentMailId = null;

function openMailScreen() {
  renderMailList();
  document.getElementById('mail-screen').style.display = 'flex';
}
function closeMailScreen() { document.getElementById('mail-screen').style.display = 'none'; updateMailBadge(); }
function renderMailList() {
  const list = document.getElementById('mail-list');
  list.innerHTML = '';
  if (MAIL_DATA.length === 0) {
    list.innerHTML = '<div class="mail-empty">メールはありません</div>';
    return;
  }
  MAIL_DATA.forEach(mail => {
    const item = document.createElement('div');
    item.className = 'mail-item' + (mail.unread ? ' unread' : '');
    const hasReward = mail.reward && !mail.received;
    const gotReward = mail.reward && mail.received;
    const tag = hasReward ? '<span class="mail-tag"><svg class="ic"><use href="#i-gift"/></svg>プレゼント</span>'
              : gotReward ? '<span class="mail-tag done"><svg class="ic"><use href="#i-check"/></svg>受取済</span>' : '';
    item.innerHTML = `
      <span class="mail-ico"><svg class="ic"><use href="#i-mail"/></svg></span>
      <div class="mail-main">
        <div class="mail-item-title">${mail.title}</div>
        <div class="mail-item-preview">${mail.body.replace(/\n/g, ' ')}</div>
        <div class="mail-item-date">${mail.date}${tag}</div>
      </div>
    `;
    item.addEventListener('click', () => openMailDetail(mail.id));
    list.appendChild(item);
  });
}
function openMailDetail(id) {
  const mail = MAIL_DATA.find(m => m.id === id);
  if (!mail) return;
  mail.unread = false;
  saveGame();
  updateMailBadge();
  currentMailId = id;
  document.getElementById('md2-title').textContent = mail.title;
  document.getElementById('md2-content-text').textContent = mail.body;
  const rewardArea   = document.getElementById('md2-reward-area');
  const receiveBtn   = document.getElementById('md2-receive-btn');
  const receivedArea = document.getElementById('md2-received-area');
  rewardArea.innerHTML = '';
  receiveBtn.style.display = 'none';
  receivedArea.innerHTML = '';
  if (mail.reward) {
    const mon = MONSTER_DATA[mail.reward.monsterId];
    const box2 = document.createElement('div');
    box2.className = 'md2-reward-box';
    const imgHtml = mon ? `<img class="md2-reward-img" src="${monsterImg(mon)}" onerror="this.style.display='none'" alt="${mon.name}">` : '';
    const displayName = mon ? mon.name : mail.reward.name;
    const displaySub  = mon ? `No.${mon.id}  ★${mon.rarity}  ${mon.attr}属性` : '';
    box2.innerHTML = `
      <div class="md2-reward-label"><svg class="ic"><use href="#i-gift"/></svg>プレゼント内容</div>
      <div class="md2-reward-item">
        ${imgHtml}
        <div class="md2-reward-info">
          <div class="md2-reward-name">${displayName}</div>
          <div class="md2-reward-sub">${displaySub}</div>
        </div>
      </div>`;
    rewardArea.appendChild(box2);
    if (!mail.received) {
      receiveBtn.style.display = 'inline-flex';
      receiveBtn.disabled = false;
      receiveBtn.textContent = '受け取る';
    } else {
      receivedArea.innerHTML = '<div class="md2-received-stamp">受け取り済みです</div>';
    }
  }
  document.getElementById('mail-detail').style.display = 'flex';
  renderMailList();
}
function closeMailDetail() { document.getElementById('mail-detail').style.display = 'none'; }
function updateMailBadge() {
  const hasUnread = MAIL_DATA.some(m => m.unread) || MAIL_DATA.some(m => m.reward && !m.received);
  const badge = document.querySelector('#mail-open-btn .hh-badge');
  if (badge) badge.style.display = hasUnread ? 'block' : 'none';
}

document.getElementById('mail-close-btn').addEventListener('click', closeMailScreen);
document.getElementById('md2-back-btn').addEventListener('click', closeMailDetail);
document.getElementById('md2-receive-btn').addEventListener('click', () => {
  const mail = MAIL_DATA.find(m => m.id === currentMailId);
  if (!mail || !mail.reward || mail.received) return;
  const monsterId = mail.reward.monsterId;
  const mon = MONSTER_DATA[monsterId];
  if (mon) {
    box.push({ uid: nextUid++, monsterId, level: 1, exp: 0, sp: 0, memory: 0, plusHp: 0, plusAtk: 0, plusRec: 0 });
    mail.received = true;
    saveGame();
    const receiveBtn = document.getElementById('md2-receive-btn');
    receiveBtn.style.display = 'none';
    document.getElementById('md2-received-area').innerHTML = '<div class="md2-received-stamp">' + mon.name + ' を受け取りました！</div>';
    updateMailBadge();
    renderMailList();
  }
});
document.getElementById('mail-open-btn').addEventListener('click', openMailScreen);
updateMailBadge();   // 起動時にも反映（保存データの既読状態を見て赤丸を出す/消す）

document.addEventListener('contextmenu', e => e.preventDefault());


// ============================================================
// ★ データ整合チェック（開発用）★
//   敵の属性と、その敵がドロップするアイテムの属性が違うとコンソールに警告を出す
// ============================================================
(function validateEnemyDrops() {
  for (const [dn, dun] of Object.entries(DUNGEON_DATA)) {
    const _allBt = dun.battles.concat(dun.random ? [{ enemies: Object.values(dun.random.monsters || {}) }] : [], dun.intrusion ? [{ enemies: dun.intrusion.monsters || [] }] : []);
    for (const bt of _allBt) for (const e of bt.enemies) {
      const attr = getMonsterAttrFromImg(e.img) || e.attr;
      for (const d of (e.drops || [])) {
        const item = ITEM_DATA[d.item];
        if (!item) { console.warn(`[drops] ${dn} ${e.name}: ITEM_DATA に ${d.item} がありません`); continue; }
        if (item.attr && attr && item.attr !== attr)
          console.warn(`[drops] ${dn} ${e.name}(${attr}) が ${item.name}(${item.attr}) をドロップします（属性不一致）`);
      }
    }
  }
})();

// ============================================================
// カバン（所持チップ一覧）
// ============================================================
function renderBag() {
  const grid = document.getElementById('bag-grid');
  grid.innerHTML = '';
  const ids = Object.keys(ITEM_DATA).filter(id => getItemCount(id) > 0);
  document.getElementById('bag-total').textContent = `${ids.length}種類`;
  if (!ids.length) { grid.innerHTML = '<div class="bag-empty">チップを持っていません</div>'; return; }
  ids.forEach(id => {
    const def = ITEM_DATA[id];
    const cell = document.createElement('div');
    cell.className = 'bag-item';
    cell.innerHTML = `<img src="${def.img}" alt="${def.name}" onerror="this.style.visibility='hidden'"><b class="bag-count">×${getItemCount(id)}</b><span class="bag-name">${def.name}</span>`;
    grid.appendChild(cell);
  });
}
document.getElementById('bag-open-btn').addEventListener('click', () => {
  renderBag();
  document.getElementById('bag-screen').style.display = 'flex';
});
document.getElementById('bag-close-btn').addEventListener('click', () => {
  document.getElementById('bag-screen').style.display = 'none';
});
