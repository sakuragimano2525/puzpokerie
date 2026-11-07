// ============================================================
// ★ ボスの「変身」★   （ダンジョン設定ツールの「変身」で設定。js/data/dungeons.js の敵データの transform）
//
//   敵データに transform:{ …変身後の敵データ… } があると、その敵は倒れそうになった時に倒れず、
//     ① HP1で踏みとどまる（ターンの攻撃が全部終わるまで。ダメージの表示はHP1で止まったぶん）
//     ② 白く点滅する
//     ③ 光に包まれて、バトル画面が真っ白になる
//     ④ 真っ白な間に、敵が transform のモンスターに入れ替わる（HP・攻撃・行動・ドロップなどは変身後のもの）
//     ⑤ 光がフェードアウトすると、変身後のモンスターがいる
//     ⑥ 青い菱形の「BOSS」バナーをもう一度出す（通常のBOSSは赤）
//     ⑦ transform.bgm があれば、そのBGMに切り替える（無ければBGMはそのまま）
//     ⑧ 変身後の敵の先制行動（あれば）を、ここで行う
//   変身したターンは、敵の行動はありません（そのままプレイヤーの番）。
//   変身前のモンスターは「倒していない」扱いなので、経験値・エナ・ドロップは出ません（変身後のモンスターを倒した時に出ます）。
//
//   ■ 調整したいとき（ここの数字）
//       BLINK_MS … 白く点滅している時間 / WHITE_IN_MS … 光が広がって真っ白になるまで
//       WHITE_HOLD_MS … 真っ白のまま止まる時間 / WHITE_OUT_MS … 白がフェードアウトする時間
//
//   公開しているのは window.EnemyTransform だけ：
//       EnemyTransform.has()  … 変身待ちの敵がいれば true
//       EnemyTransform.run()  … 変身の演出をして、入れ替えて、先制まで行う Promise（変身したら true）
//   ※ game.js の後に読み込む。
// ============================================================
(function () {
  'use strict';

  // ── 青い BOSS バナーの見た目（CSS）。別のCSSファイルだと、更新の時にアップロード漏れ・キャッシュで効かなくなる（その場合は赤いBOSSになる）ので、
  //    この JS が読み込まれた時に <style> として自分で入れる（変身の処理と必ず同じ版になる）
  const BLUE_BANNER_CSS = `/* ============================================================
   ボス変身後の「青い BOSS バナー」（js/enemy-transform.js が showBattleBanner(…, 'blue') で出す）
   通常のBOSS（赤い菱形）の色を、青に置き換えただけ。赤に戻したい時は、このファイルを外せばOK。
   ============================================================ */
#dungeon-anim-overlay.bn-boss.bn-blueboss { animation:bnDimBlue .35s ease-out forwards; }
#dungeon-anim-overlay.bn-boss.bn-blueboss.bn-out { animation:bnUndimBlue .4s ease-in forwards; }
@keyframes bnDimBlue   { to { background:rgba(0,12,44,.55); } }
@keyframes bnUndimBlue { from { background:rgba(0,12,44,.55); } to { background:rgba(0,12,44,0); } }
.bn-wrap.bn-blue-wrap .bn-side.bn-rear .bn-shape {
  border-color:#2f8cff;
  box-shadow:
    0 0 0 max(1px,.4vw) rgba(190,222,255,.9),
    0 0 28px 8px rgba(40,130,255,.85),
    0 0 70px 16px rgba(0,80,230,.5),
    inset 0 0 18px rgba(255,255,255,.95),
    inset 0 -10px 24px rgba(0,60,170,.12);
}
.bn-wrap.bn-blue-wrap .bn-deco { border-color:rgba(50,130,240,.34); }
.bn-wrap.bn-blue-wrap .bn-deco::before { border-color:rgba(50,130,240,.24); }
.bn-wrap.bn-blue-wrap .bn-deco::after  { border-color:rgba(50,130,240,.18); }
.bn-wrap.bn-blue-wrap .bn-ring {
  border-color:#3d9bff;
  box-shadow:0 0 16px 3px rgba(60,150,255,.8), inset 0 0 16px 2px rgba(60,150,255,.5);
}
.bn-wrap.bn-blue-wrap .bn-boss-text {
  color:#1769e8; text-shadow:0 0 1px rgba(23,105,232,.6), 0 2px 10px rgba(60,150,255,.35);
}

/* 変身版は「Battle n/m」を見せず、最初から BOSS 面で出す（くるっと回らない） */
.bn-wrap.bn-blue-wrap .bn-flip { transform:rotateY(180deg); }
.bn-wrap.bn-blue-wrap .bn-side.bn-front { display:none; }
.bn-wrap.bn-blue-wrap .bn-side.bn-rear { opacity:1; visibility:visible; }
.bn-wrap.bn-blue-wrap .bn-flip.bn-do-flip,
.bn-wrap.bn-blue-wrap .bn-flip.bn-do-flip .bn-side.bn-rear { animation:none; }
`;
  try {
    if (!document.getElementById('enemy-transform-css')) {
      const st = document.createElement('style');
      st.id = 'enemy-transform-css';
      st.textContent = BLUE_BANNER_CSS;
      document.head.appendChild(st);
    }
  } catch (e) {}

  const BLINK_MS      = 1250;   // 点滅の長さ（このうち後半に、光が広がり始める）
  const WHITE_START   = 500;    // 点滅を始めてから、光が広がり始めるまで
  const WHITE_IN_MS   = 750;    // 光が広がって真っ白になるまで
  const WHITE_HOLD_MS = 250;    // 真っ白のまま止まる
  const WHITE_OUT_MS  = 1000;   // 白がフェードアウトする

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const pending = () => enemyList.filter(e => e && e._tfPending && e.hp > 0 && e.transform && !e._tfDone);

  function unitOf(enemy) {
    const i = enemyList.indexOf(enemy);
    const units = document.querySelectorAll('#enemy-area .enemy-unit');
    return i >= 0 && i < units.length ? units[i] : null;
  }

  // 画像が読み込まれるまで少し待つ（真っ白な間に済ませる）
  function imgsReady(maxMs) {
    const imgs = [...document.querySelectorAll('#enemy-area .enemy-unit .enemy-img-wrap img')];
    const t0 = performance.now();
    return new Promise(res => {
      const chk = () => {
        if (imgs.every(im => im.complete) || performance.now() - t0 > maxMs) res();
        else setTimeout(chk, 40);
      };
      chk();
    });
  }

  let running = false;
  async function run() {
    const list = pending();
    if (!list.length || running) return false;
    running = true;
    try {
      const host = document.getElementById('dungeon') || document.body;
      const hr = host.getBoundingClientRect();

      // 変身後のBGM（複数いれば最初の1つ）。変身後の絵は先に読み込んでおく
      const nb = (list.map(e => String(e.transform.bgm || '').trim()).find(Boolean)) || '';
      if (nb) { try { if (window.AudioFast && AudioFast.prefetchBGM) AudioFast.prefetchBGM(nb, true); } catch (e) {} }
      list.forEach(e => { if (e.transform.img) { const im = new Image(); im.src = e.transform.img; } });
      try { clearRoulettes(); } catch (e) {}
      try { if (typeof lockedEnemy !== 'undefined') lockedEnemy = null; } catch (e) {}

      // 光の中心＝変身する敵（複数なら、まとめた範囲の中心）
      let L = 1e9, T = 1e9, R = -1e9, B = -1e9;
      list.forEach(e => {
        const u = unitOf(e); if (!u) return;
        const r = (u.querySelector('.enemy-img-wrap') || u).getBoundingClientRect();
        L = Math.min(L, r.left); T = Math.min(T, r.top); R = Math.max(R, r.right); B = Math.max(B, r.bottom);
      });
      const cx = L < 1e8 ? ((L + R) / 2 - hr.left) : hr.width / 2;
      const cy = L < 1e8 ? ((T + B) / 2 - hr.top) : hr.height / 2;

      // ① 白く点滅（だんだん速く・強く）
      try { playSE('kieru'); } catch (e) {}
      list.forEach(e => {
        const u = unitOf(e), img = u && u.querySelector('.enemy-img-wrap img');
        if (!img || !img.animate) return;
        const kf = [], N = 10;
        for (let i = 0; i <= N; i++) {
          const o = Math.pow(i / N, .7);                          // 後ろほど細かく
          const on = i % 2 === 1 || i === N;
          kf.push({ offset: o, filter: on ? `brightness(${(2.6 + 2.4 * o).toFixed(2)}) saturate(${(0.5 - .5 * o).toFixed(2)})` : 'brightness(1) saturate(1)' });
        }
        img.animate(kf, { duration: BLINK_MS, easing: 'linear', fill: 'forwards' });
      });

      // ② 光に包まれて真っ白に（変身する敵の位置から円く広がる）
      await wait(WHITE_START);
      const white = document.createElement('div');
      white.style.cssText = 'position:absolute;inset:0;z-index:55;pointer-events:none;' +
        'background:radial-gradient(circle at ' + cx + 'px ' + cy + 'px,#fff 0%,#fff 60%,#eaf3ff 100%);';
      host.appendChild(white);
      const reach = Math.hypot(Math.max(cx, hr.width - cx), Math.max(cy, hr.height - cy)) + 20;
      let inAn = null;
      if (white.animate) {
        inAn = white.animate([
          { clipPath: `circle(0px at ${cx}px ${cy}px)`, opacity: .85 },
          { clipPath: `circle(${reach}px at ${cx}px ${cy}px)`, opacity: 1 }
        ], { duration: WHITE_IN_MS, easing: 'ease-in', fill: 'forwards' });
      }
      await wait(WHITE_IN_MS);
      if (inAn) { try { inAn.cancel(); } catch (e) {} }
      white.style.clipPath = 'none'; white.style.opacity = '1';
      if (BLINK_MS > WHITE_START + WHITE_IN_MS) await wait(BLINK_MS - WHITE_START - WHITE_IN_MS);

      // ③ 真っ白な間に入れ替える
      if (nb) { try { stopDungeonBGM(); } catch (e) {} }
      const newIdx = [];
      list.forEach(old => {
        const idx = enemyList.indexOf(old); if (idx < 0) return;
        const def = JSON.parse(JSON.stringify(old.transform));
        const ne = buildEnemyFromDef(def);
        ne._tfFrom = old.name || '';
        enemyList[idx] = ne;
        newIdx.push(idx);
        try { if (window.Zukan && Zukan.noteEnemies) Zukan.noteEnemies([def]); } catch (e) {}
      });
      renderEnemyUI(false);
      updateEnemyUI();
      updateEnemyTurnBadge();
      // いっしょにいた倒れている敵は、描き直しで画像が出てしまうので消しておく
      const units = document.querySelectorAll('#enemy-area .enemy-unit');
      enemyList.forEach((e, i) => {
        if (e.hp > 0) return;
        const im = units[i] && units[i].querySelector('.enemy-img-wrap img');
        if (im) im.style.display = 'none';
      });
      if (window.DamageTotal) { try { DamageTotal.clear(); } catch (e) {} }
      await imgsReady(700);
      await wait(WHITE_HOLD_MS);

      // ④ 光がフェードアウト → 変身後の姿（光の中から現れる）
      try { playSE('change'); } catch (e) {}
      const units2 = document.querySelectorAll('#enemy-area .enemy-unit');
      newIdx.forEach(i => {
        const u = units2[i], img = u && u.querySelector('.enemy-img-wrap img');
        if (img && img.animate) img.animate([
          { filter: 'brightness(4) saturate(.2) blur(3px)', transform: 'scale(1.14)' },
          { filter: 'brightness(1.8) saturate(.7) blur(1px)', transform: 'scale(1.06)', offset: .5 },
          { filter: 'brightness(1) saturate(1) blur(0)', transform: 'scale(1)' }
        ], { duration: WHITE_OUT_MS + 250, easing: 'ease-out' });
      });
      if (white.animate) {
        const outAn = white.animate([{ opacity: 1 }, { opacity: 0 }], { duration: WHITE_OUT_MS, easing: 'ease-out', fill: 'forwards' });
        await new Promise(res => { outAn.onfinish = res; setTimeout(res, WHITE_OUT_MS + 200); });
      } else await wait(WHITE_OUT_MS);
      white.remove();

      // ⑤ 青い BOSS バナー → BGM
      await wait(150);
      try { await showBattleBanner(currentBattleIndex + 1, currentDungeonBattles.length, true, 'blue'); } catch (e) {}
      if (nb) { try { startDungeonBGM(nb); } catch (e) {} }

      // ⑥ 変身後の敵の先制行動（あれば）
      await wait(200);
      await runBattleStartActions();
      return true;
    } finally {
      running = false;
    }
  }

  window.EnemyTransform = { run, has: () => !running && pending().length > 0 };
})();
