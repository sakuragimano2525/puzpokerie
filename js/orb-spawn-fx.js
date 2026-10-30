// ============================================================
// ★ スキルでドロップが生成・変換される時の演出 ★
//
//   これまで：スキルを使うと盤面のドロップが「いきなり」入れ替わっていた。
//   いま　　：ドロップごとに ↓ の流れで生まれる。演出が終わるまで盤面は触れない。
//
//     ① 古いドロップがくるくる回りながら小さく吸い込まれる
//     ② その場に属性色の魔法陣（回る輪＋星形）が開く
//     ③ 新しいドロップが回転しながら飛び出して「ポヨン」と定着
//        ＋ 衝撃波のリング／閃光／光の柱／火花が弾ける
//     ④ 盤面の縁が属性色にふわっと光り、数が多い時は光の帯がサッと横切る
//
//   ・出る順番：まとまった形（横1列・十字・盤面全体…）は中心から波紋のように広がる。
//               バラバラな位置（ランダム生成）は、ランダムな順にポンポンと生まれる。
//   ・数が多いほど1個あたりの演出を軽くする（LOD）。全面変換でもチカチカしない／重くならない。
//   ・すでに同じ属性だったドロップは、入れ替えずに「ピカッ」と脈打つだけ。
//   ・OSの「動きを減らす」設定がオンなら、フェードで入れ替えるだけの静かな演出になる。
//
//   ■ game.js の後に読み込む。公開しているのは window.OrbSpawnFx だけ：
//       OrbSpawnFx.play(items, ctx)  … 演出を再生し、終わったら resolve する Promise（reject はしない）
//         items: [{ r, c, el, from, to }]   el=そのマスの .orb 要素 / from=変わる前の属性 / to=変わった後の属性
//         ctx  : { rows, cols, wrap, swap(item) }
//                wrap … #grid-wrap（この中に演出レイヤー #orb-fx-layer を作る）
//                swap … 「見た目のクラスを新しい属性に差し替える」処理（game.js 側が渡す）。
//                       盤面データ(grid)は呼ぶ前にすでに書き換え済み。ここでは見た目だけ。
//       OrbSpawnFx.abort()           … 再生中の演出を打ち切って、見た目を最終状態にそろえる
//     ※ 何があっても最後に必ず swap が呼ばれる（見た目と盤面データがズレたままにならない）。
//
//   ■ 調整したいとき（ここの数字）
//       OUT_MS … 古いドロップが吸い込まれる時間
//       IN_MS  … 新しいドロップが飛び出して定着するまでの時間
//       MAX_SPREAD … 波紋・ポンポンが広がるのにかける最大時間（全面変換でもこの時間で頭打ち）
//       COLORS … 属性ごとの色 [メイン色, 明るい色]
//   不要になったら：このファイルと css/orb-spawn-fx.css、index.html の2行、
//                   game.js の setOrb / flushOrbSpawnFx / confirmSkill 内の OrbSpawnFx 部分を消せばOK。
// ============================================================
(function () {
  'use strict';

  const OUT_MS = 170;         // ① 古いドロップが吸い込まれる
  const IN_MS = 470;          // ③ 新しいドロップが飛び出して定着
  const MAX_SPREAD = 520;     // 波紋が盤面の端まで広がる時間の上限
  const GUARD_MS = 800;       // 何かの理由で終わらなかった時の保険（想定の長さ＋この時間で強制終了）

  const COLORS = {
    fire:   ['#ff5a2e', '#ffc489'],
    water:  ['#2f9bff', '#b3e0ff'],
    wood:   ['#3ddc62', '#ccffb8'],
    light:  ['#ffd23f', '#fff6c4'],
    dark:   ['#b44dff', '#e6c2ff'],
    heal:   ['#ff6fb8', '#ffd3ec'],
    poison: ['#a03dff', '#ddb8ff'],
    ojama:  ['#aeb4bc', '#eceff3']
  };
  const NEUTRAL = ['#ffe08a', '#fff4cf'];   // いろいろな色が混ざる時（全面変換など）の盤面の光

  let _abort = null;   // 再生中の演出を打ち切る関数

  const rnd = (a, b) => a + Math.random() * (b - a);
  function prefersReduced() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  }

  // 出る順番（各ドロップの開始の遅れ ms）を決める
  function planDelays(items) {
    const n = items.length;
    const out = new Array(n).fill(0);
    if (n <= 1) return out;
    const spread = Math.min(MAX_SPREAD, 70 + n * 16);
    let r0 = 99, r1 = -1, c0 = 99, c1 = -1, sr = 0, sc = 0;
    for (const it of items) {
      if (it.r < r0) r0 = it.r; if (it.r > r1) r1 = it.r;
      if (it.c < c0) c0 = it.c; if (it.c > c1) c1 = it.c;
      sr += it.r; sc += it.c;
    }
    const fill = n / ((r1 - r0 + 1) * (c1 - c0 + 1));   // 囲んだ四角の中がどれだけ埋まっているか
    if (fill < 0.5) {
      // バラバラな位置：ランダムな順にポンポンと生まれる
      const order = items.map((_, i) => i).sort(() => Math.random() - 0.5);
      order.forEach((idx, k) => { out[idx] = Math.round(k * spread / (n - 1)); });
    } else {
      // まとまった形：中心から外へ波紋のように広がる
      const cr = sr / n, cc = sc / n;
      const ds = items.map(it => Math.hypot(it.r - cr, it.c - cc));
      const max = Math.max.apply(null, ds);
      ds.forEach((d, i) => { out[i] = max > 0 ? Math.round(d / max * spread) : 0; });
    }
    return out;
  }

  // 盤面全体の光の色：ほぼ同じ色ならその色、混ざっていれば金白
  function boardColor(items) {
    const cnt = {};
    let best = null, bn = 0;
    for (const it of items) { cnt[it.to] = (cnt[it.to] || 0) + 1; if (cnt[it.to] > bn) { bn = cnt[it.to]; best = it.to; } }
    return (COLORS[best] && bn / items.length >= 0.6) ? COLORS[best] : NEUTRAL;
  }

  function play(items, ctx) {
    items = (items || []).filter(it => it && it.el);
    if (!items.length) return Promise.resolve();
    if (_abort) _abort();   // 前の演出が残っていたら先に終わらせる

    const canAnim = typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';
    const wrap = ctx && ctx.wrap;
    const swap = (ctx && ctx.swap) || function () {};
    if (!canAnim || !wrap) {   // 演出できない環境：今までどおり、いきなり差し替える
      items.forEach(it => { try { swap(it); } catch (e) {} });
      return Promise.resolve();
    }

    return new Promise(resolve => {
      const reduce = prefersReduced();
      const n = items.length;
      const lod = reduce ? 'none' : n <= 8 ? 'high' : n <= 16 ? 'mid' : 'low';   // 数が多いほど1個あたりを軽く
      const delays = reduce ? new Array(n).fill(0) : planDelays(items);
      const spread = Math.max.apply(null, delays);
      const total = reduce ? 260 : spread + OUT_MS + IN_MS;   // 最後のドロップが定着するまで
      const anims = [];
      const track = a => { anims.push(a); return a; };
      let ended = false, remaining = n, guard = null;
      const swapped = new Set();
      const swapOnce = it => {
        if (swapped.has(it)) return;
        swapped.add(it);
        try { swap(it); } catch (e) { console.warn('OrbSpawnFx swap', e); }
      };

      function finalize() {
        if (ended) return;
        ended = true;
        clearTimeout(guard);
        if (_abort === finalize) _abort = null;
        anims.forEach(a => { try { a.cancel(); } catch (e) {} });
        items.forEach(it => { swapOnce(it); it.el.style.zIndex = ''; });   // 何があっても最後は必ず最終状態
        if (layer.parentNode) layer.parentNode.removeChild(layer);
        resolve();
      }
      const cellDone = () => { if (--remaining <= 0) finalize(); };
      _abort = finalize;
      guard = setTimeout(finalize, total + GUARD_MS);

      // ── 演出レイヤー（ルーレットと同じ、盤面に重なる 6×5 のグリッド）──
      const old = wrap.querySelector('#orb-fx-layer');
      if (old) old.remove();
      const layer = document.createElement('div');
      layer.id = 'orb-fx-layer';
      layer.style.gridTemplateColumns = `repeat(${ctx.cols || 6}, 1fr)`;
      layer.style.gridTemplateRows = `repeat(${ctx.rows || 5}, 1fr)`;
      const bc = boardColor(items);
      layer.style.setProperty('--c', bc[0]);
      layer.style.setProperty('--c2', bc[1]);
      const boxes = items.map(it => {
        const b = document.createElement('div');
        b.className = 'osf-cell';
        b.style.gridRow = String(it.r + 1);
        b.style.gridColumn = String(it.c + 1);
        const col = COLORS[it.to] || NEUTRAL;
        b.style.setProperty('--c', col[0]);
        b.style.setProperty('--c2', col[1]);
        layer.appendChild(b);
        return b;
      });
      wrap.appendChild(layer);
      const W = (boxes[0] && boxes[0].offsetWidth) || 50;   // 1マスの大きさ(px)。火花の飛ぶ距離に使う

      try {
        // ── ④ 盤面全体の光（縁がふわっと光る／数が多い時は光の帯が横切る）──
        if (lod !== 'none') {
          const glow = document.createElement('i');
          glow.className = 'osf-board-glow';
          layer.appendChild(glow);
          track(glow.animate([{ opacity: 0 }, { opacity: 0.6, offset: 0.4 }, { opacity: 0 }],
            { duration: total + 120, easing: 'ease-in-out', fill: 'both' }));
          if (n >= 8) {
            const sw = document.createElement('i');
            sw.className = 'osf-sweep';
            layer.appendChild(sw);
            track(sw.animate([
              { transform: 'skewX(-18deg) translateX(0%)', opacity: 0 },
              { opacity: 1, offset: 0.15 },
              { opacity: 1, offset: 0.8 },
              { transform: 'skewX(-18deg) translateX(520%)', opacity: 0 }
            ], { duration: Math.max(500, spread + 380), easing: 'ease-in-out', fill: 'both' }));
          }
        }

        // ── ドロップ1個ごとの演出 ──
        items.forEach((it, i) => {
          const d = delays[i];
          const box = boxes[i];
          const el = it.el;
          const changed = it.from !== it.to;
          const tIn = d + OUT_MS;   // 新しいドロップが生まれる瞬間
          el.style.zIndex = '3';    // 大きくなった時に隣のドロップより手前に出す

          const add = (cls, tag) => { const e = document.createElement(tag || 'i'); e.className = cls; box.appendChild(e); return e; };
          const fx = (e, frames, opt) => track(e.animate(frames, Object.assign({ fill: 'both' }, opt)));

          // 動きを減らす設定：フェードで入れ替えるだけ
          if (lod === 'none') {
            if (!changed) { swapOnce(it); cellDone(); return; }
            const o = track(el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 100, fill: 'both' }));
            o.onfinish = () => {
              if (ended) return;
              swapOnce(it); o.cancel();
              track(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 })).onfinish = cellDone;
            };
            return;
          }

          // ② 魔法陣（回る輪＋星形）。数が多い時は出さない
          if (changed && lod !== 'low') {
            const circ = add('osf-circle');
            circ.innerHTML = '<b class="co"></b><b class="ci"></b><b class="cs"></b><b class="cs b"></b>';
            fx(circ, [
              { transform: 'scale(.3)', opacity: 0 },
              { transform: 'scale(1)', opacity: 0.95, offset: 0.28 },
              { transform: 'scale(1.06)', opacity: 0.9, offset: 0.62 },
              { transform: 'scale(1.35)', opacity: 0 }
            ], { duration: OUT_MS + IN_MS * 0.9, delay: d, easing: 'linear' });
            if (lod === 'high') {   // 少数の時だけ、輪と星形をそれぞれ逆向きに回す
              const dur = OUT_MS + IN_MS;
              fx(circ.children[0], [{ transform: 'rotate(0deg)' }, { transform: 'rotate(210deg)' }], { duration: dur, delay: d, easing: 'ease-out' });
              fx(circ.children[2], [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-150deg)' }], { duration: dur, delay: d, easing: 'ease-out' });
              fx(circ.children[3], [{ transform: 'rotate(45deg)' }, { transform: 'rotate(-105deg)' }], { duration: dur, delay: d, easing: 'ease-out' });
            }
          }

          // ③ 光の柱（少数の時だけ）
          if (changed && lod === 'high') {
            fx(add('osf-pillar'), [
              { transform: 'scaleY(0)', opacity: 0 },
              { transform: 'scaleY(1)', opacity: 0.95, offset: 0.22 },
              { transform: 'scaleY(1.05) scaleX(.55)', opacity: 0 }
            ], { duration: 520, delay: tIn - 40, easing: 'cubic-bezier(.2,.7,.3,1)' });
          }

          // ③ 閃光（数が多いほど控えめに：隣どうしが重なって白飛びしないように）
          const flarePeak = (lod === 'high' ? 1 : lod === 'mid' ? 0.8 : 0.55) * (changed ? 1 : 0.7);
          fx(add('osf-flare'), [
            { transform: 'scale(.15)', opacity: 0 },
            { transform: 'scale(.85)', opacity: flarePeak, offset: 0.3 },
            { transform: 'scale(1.15)', opacity: 0 }
          ], { duration: 380, delay: tIn - 30, easing: 'ease-out' });

          // ③ 衝撃波のリング
          const rings = lod === 'high' ? 2 : 1;
          for (let k = 0; k < rings; k++) {
            fx(add(k ? 'osf-ring thin' : 'osf-ring'), [
              { transform: 'scale(.45)', opacity: 0 },
              { transform: 'scale(.62)', opacity: 0.95, offset: 0.1 },
              { transform: 'scale(1.75)', opacity: 0 }
            ], { duration: 460, delay: tIn + k * 110, easing: 'cubic-bezier(.1,.7,.3,1)' });
          }

          // ③ 火花
          let ns = lod === 'high' ? 9 : lod === 'mid' ? 5 : 2;
          if (!changed) ns = Math.floor(ns / 2);
          for (let k = 0; k < ns; k++) {
            const a = (k / ns) * Math.PI * 2 + rnd(-0.35, 0.35);
            const dist = W * rnd(0.62, 1.0);
            const dx = Math.cos(a) * dist, dy = Math.sin(a) * dist + W * 0.12;   // 少し下に落ちる
            const s = Math.max(3, W * rnd(0.07, 0.13));
            const sp = add('osf-spark');
            sp.style.width = sp.style.height = s + 'px';
            fx(sp, [
              { transform: 'translate(-50%,-50%) translate(0px,0px) rotate(45deg) scale(.3)', opacity: 0 },
              { transform: `translate(-50%,-50%) translate(${dx * 0.45}px,${dy * 0.45}px) rotate(120deg) scale(1)`, opacity: 1, offset: 0.25 },
              { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) rotate(220deg) scale(.15)`, opacity: 0 }
            ], { duration: rnd(420, 620), delay: tIn + rnd(0, 50), easing: 'cubic-bezier(.1,.75,.3,1)' });
          }

          // ドロップ本体
          if (changed) {
            // ① 古いドロップが回りながら吸い込まれる → 新しい属性に差し替え → ③ 回転しながら飛び出して定着
            const out = track(el.animate([
              { transform: 'scale(1) rotate(0deg)', filter: 'brightness(1) saturate(1)', opacity: 1 },
              { transform: 'scale(.7) rotate(-70deg)', filter: 'brightness(1.9) saturate(1)', opacity: 1, offset: 0.6 },
              { transform: 'scale(0) rotate(-170deg)', filter: 'brightness(3) saturate(1)', opacity: 0.6 }
            ], { duration: OUT_MS, delay: d, easing: 'cubic-bezier(.6,0,.9,.5)', fill: 'both' }));
            out.onfinish = () => {
              if (ended) return;
              swapOnce(it);   // 大きさ0の瞬間に見た目を新しい属性へ（ここでパッと切り替わっても見えない）
              out.cancel();
              const pop = lod === 'high' ? 1.3 : lod === 'mid' ? 1.24 : 1.18;   // 飛び出す時の大きさ（数が多いほど小さく）
              const flash = lod === 'low' ? 1.5 : 1.9;                            // 飛び出す時の明るさ
              const inn = track(el.animate([
                { transform: 'scale(0) rotate(220deg)', filter: 'brightness(3.2) saturate(1.5)', opacity: 1, easing: 'cubic-bezier(.2,.9,.25,1)' },
                { transform: `scale(${pop}) rotate(-12deg)`, filter: `brightness(${flash}) saturate(1.2)`, offset: 0.45, easing: 'ease-in-out' },
                { transform: 'scale(.93) rotate(4deg)', filter: 'brightness(1.2) saturate(1)', offset: 0.72, easing: 'ease-in-out' },
                { transform: 'scale(1) rotate(0deg)', filter: 'brightness(1) saturate(1)' }
              ], { duration: IN_MS, easing: 'linear' }));
              inn.onfinish = cellDone;
            };
          } else {
            // すでに同じ属性：入れ替えず、ピカッと脈打つだけ
            swapOnce(it);
            const p = track(el.animate([
              { transform: 'scale(1)', filter: 'brightness(1) saturate(1)' },
              { transform: 'scale(1.22)', filter: 'brightness(2.1) saturate(1.3)', offset: 0.38 },
              { transform: 'scale(.97)', filter: 'brightness(1.15) saturate(1)', offset: 0.72 },
              { transform: 'scale(1)', filter: 'brightness(1) saturate(1)' }
            ], { duration: 420, delay: tIn, easing: 'linear' }));
            p.onfinish = cellDone;
          }
        });
      } catch (err) {
        console.warn('OrbSpawnFx', err);
        finalize();   // 演出でエラーになっても、盤面は必ず最終状態にして先へ進める
      }
    });
  }

  function abort() { if (_abort) _abort(); }

  window.OrbSpawnFx = { play, abort };
})();
