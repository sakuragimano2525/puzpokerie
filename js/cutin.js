// ============================================================
// ★ 敵の必殺技カットイン（技名に ⚠️ が付いている行動）★
//
//   ・⚠️付きの技は、青いスキルウインドウの代わりに、パズドラ本家のコラボ演出のような
//     カットイン（ギザギザの白枠＋敵の大写し＋斜めの技名帯）を出します。
//   ・カットインが終わったあとは、いつもどおり（自己強化の演出 → 攻撃の弾 → ダメージ／妨害）。
//   ・色は敵の属性で変わります（火＝赤 / 水＝青 / 木＝緑 / 光＝金 / 闇＝紫）。
//   ・効果音は cutin.mp3（game.js の BATTLE_SE の "cutin"）。
//
//   ■ 調整したいとき（ここの数字）
//       CUTIN_MIN_MS … 効果音の長さが取れない時のカットインの長さ（ミリ秒）
//       CUTIN_MAX_MS … cutin.mp3 が長くても、ここで頭打ち
//       ※ cutin.mp3 の長さが分かるときは、その長さにぴったり合わせて出します。
//
//   ※ game.js の後に読み込む。公開しているのは window.EnemyCutIn だけ：
//       EnemyCutIn.isCutin(技名, 行動)  … ⚠️付き（または 行動.cutin === true）なら true
//       EnemyCutIn.show(敵, 技名)       … カットインを出して、終わったら resolve する Promise
//     game.js 側の既存関数（playSE / battleShake / enemyList）が無くても壊れません。
// ============================================================
(function () {
  'use strict';

  const CUTIN_MIN_MS = 1890;   // 効果音の長さが分からない時の長さ（cutin.mp3 は約1.89秒）
  const CUTIN_MAX_MS = 3400;   // 効果音が長くても、これより長くはしない
  const IN_MS  = 300;          // 帯が滑り込む時間
  const OUT_MS = 260;          // 帯が滑り出る時間

  // 属性ごとの色（main＝帯の色 / deep＝濃い側 / dark＝背景 / glow＝光 / light＝いちばん明るい色）
  const THEMES = {
    fire:  { main:'#ff3d1e', deep:'#8a0c0c', dark:'#2b0606', glow:'#ff8a3d', light:'#ffe2b4' },
    water: { main:'#1e8cff', deep:'#0b3f9a', dark:'#04122f', glow:'#58c8ff', light:'#d6f2ff' },
    wood:  { main:'#2fbf4a', deep:'#0e6025', dark:'#041b0b', glow:'#86ff7e', light:'#e2ffd2' },
    light: { main:'#ffc414', deep:'#a06a00', dark:'#2f1e00', glow:'#fff27a', light:'#fffbe2' },
    dark:  { main:'#9b3cff', deep:'#43107f', dark:'#13051f', glow:'#cc84ff', light:'#f2dcff' }
  };

  // iPhone / iPad（iOS Safari は画面メモリが少なく、重い演出で落ちやすい）
  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent || '') ||
              (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1);
  const STAR_N  = IOS ? 12 : 26;   // 星の数
  const EMBER_N = IOS ? 8  : 16;   // 火の粉の数

  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // 技名の「⚠️」を見分ける／表示用に取り除く
  const WARN_HEAD = /^[\s　]*⚠/;
  const WARN_ALL  = /⚠️?/g;
  function isCutin(name, action) {
    if (action && (action.cutin === true || action.special === true)) return true;
    return typeof name === 'string' && WARN_HEAD.test(name);
  }
  function cleanName(name) {
    const s = String(name == null ? '' : name);
    return s.replace(WARN_ALL, '').replace(/^[\s　]+|[\s　]+$/g, '') || s.trim();
  }

  // ギザギザの帯の形：上辺・下辺それぞれの「ギザギザの高さ」を用意し、3枚（黒縁／白／中身）で同じ形をずらして使う
  function makeEdge(w, h) {
    const n = Math.max(16, Math.round(w / 18));
    const amp = Math.max(5, h * 0.05);
    const top = [], bot = [];
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * w;
      const hi = i % 2 === 1;
      top.push([x, hi ? amp * rnd(.65, 1.15) : amp * rnd(0, .3)]);
      bot.push([x, hi ? amp * rnd(0, .3) : amp * rnd(.65, 1.15)]);
    }
    return { top, bot };
  }
  // oyTop / oyBot：上辺・下辺をどれだけ内側（＋）／外側（−）にずらすか。y0＝レイヤー内での帯の上端
  function polygon(edge, w, y0, hStage, oyTop, oyBot) {
    const pts = [];
    edge.top.forEach(p => pts.push(`${p[0].toFixed(1)}px ${(y0 + p[1] + oyTop).toFixed(1)}px`));
    for (let i = edge.bot.length - 1; i >= 0; i--) {
      const p = edge.bot[i];
      pts.push(`${p[0].toFixed(1)}px ${(y0 + hStage - p[1] + oyBot).toFixed(1)}px`);
    }
    return `polygon(${pts.join(',')})`;
  }

  // 集中線：不規則な太さの放射状の線
  function raysGradient() {
    const stops = [];
    let a = 0;
    while (a < 345) {
      const gap = rnd(3, 11), wid = rnd(1.5, 6);
      stops.push(`transparent ${a.toFixed(1)}deg ${(a + gap).toFixed(1)}deg`);
      stops.push(`rgba(255,255,255,${rnd(.12, .3).toFixed(2)}) ${(a + gap).toFixed(1)}deg ${(a + gap + wid).toFixed(1)}deg`);
      a += gap + wid;
    }
    stops.push(`transparent ${a.toFixed(1)}deg 360deg`);
    return `conic-gradient(from 0deg at 50% 50%, ${stops.join(',')})`;
  }

  let _active = null;   // 再生中のカットイン（二重に出さない）

  function show(enemy, rawName) {
    return new Promise(resolve => {
      if (_active) { try { _active(); } catch (e) {} }

      const host = document.getElementById('dungeon') || document.getElementById('game') || document.body;
      const hr = host.getBoundingClientRect();
      const W = Math.round(hr.width), DH = Math.round(hr.height);
      if (!W || !DH) { resolve(); return; }   // 画面が見えていない時は飛ばす

      const th = THEMES[enemy && enemy.attr] || THEMES.fire;
      const name = cleanName(rawName);

      // ── 効果音（cutin.mp3）：鳴らせたら、その長さに合わせて表示時間を決める ──
      let T = CUTIN_MIN_MS;
      try {
        if (typeof playSE === 'function') {
          playSE('cutin');
          const st = typeof _seState !== 'undefined' && _seState.cutin;
          const au = st && st.pool && st.pool[(st.idx + st.pool.length - 1) % st.pool.length];
          if (au && isFinite(au.duration) && au.duration > 0) T = clamp(au.duration * 1000, 1200, CUTIN_MAX_MS);   // 効果音の長さにぴったり合わせる
        } else {
          const a = new Audio('cutin.mp3'); a.volume = 1; a.play().catch(() => {});
        }
      } catch (e) {}

      // ── 大きさ：画面幅いっぱいの帯。高さは幅の約46％（縦に収まらない時は縮める）──
      const H = Math.round(Math.min(W * 0.46, DH * 0.78));
      const stageTop = Math.max(4, Math.round(DH * 0.46 - H / 2));
      const stripH = Math.round(H * 0.38);
      const stripBottom = Math.round(H * 0.09);

      const root = document.createElement('div');
      root.className = 'cutin-root';
      Object.entries({ '--c-main': th.main, '--c-deep': th.deep, '--c-dark': th.dark, '--c-glow': th.glow, '--c-light': th.light })
        .forEach(([k, v]) => root.style.setProperty(k, v));

      // 背景（暗転＋星＋フラッシュ）
      const dim = document.createElement('div'); dim.className = 'cutin-dim';
      const stars = document.createElement('div'); stars.className = 'cutin-stars';
      for (let i = 0; i < STAR_N; i++) {
        const s = document.createElement('i'), z = rnd(1, 3);
        s.style.cssText = `left:${rnd(0, 100)}%;top:${rnd(0, 100)}%;width:${z}px;height:${z}px;`;
        stars.appendChild(s);
        if (s.animate) s.animate([{ opacity: .15 }, { opacity: 1 }, { opacity: .15 }], { duration: rnd(500, 1300), delay: rnd(0, 600), iterations: Infinity });
      }
      const flash = document.createElement('div'); flash.className = 'cutin-flash';
      const halo = document.createElement('div'); halo.className = 'cutin-halo';
      halo.style.cssText = `top:${stageTop + H * 0.1}px;height:${H * 0.8}px;`;
      root.append(dim, stars, halo, flash);

      // 帯
      const stage = document.createElement('div'); stage.className = 'cutin-stage';
      stage.style.cssText = `top:${stageTop}px;height:${H}px;transform:translateX(-110%);`;
      const layerW = W + 8, layerH = H + 16;
      const edge = makeEdge(layerW, H);
      const bw = Math.max(5, Math.round(H * 0.035));   // 白い縁の太さ
      const mkLayer = (cls, oyT, oyB) => {
        const d = document.createElement('div');
        d.className = 'cutin-layer ' + cls;
        d.style.clipPath = d.style.webkitClipPath = polygon(edge, layerW, 8, H, oyT, oyB);
        return d;
      };
      const outline = mkLayer('cutin-outline', -3.5, 3.5);
      const paper   = mkLayer('cutin-paper', 0, 0);
      const panel   = mkLayer('cutin-panel', bw, -bw);
      stage.append(outline, paper, panel);

      const content = document.createElement('div'); content.className = 'cutin-content';
      panel.appendChild(content);

      const bg = document.createElement('div'); bg.className = 'cutin-bg';
      content.appendChild(bg);

      // 集中線
      const RS = Math.round(Math.max(W, H) * 1.5);
      const R0 = Math.max(W, H) * 2.2 * Math.SQRT1_2;   // 元の大きさ(2.2倍)のときのマスクの半径
      const rayMask = `radial-gradient(circle ${R0.toFixed(0)}px at 50% 50%, #000 ${(R0 * .12).toFixed(0)}px, transparent ${(R0 * .68).toFixed(0)}px)`;
      const rays = document.createElement('div'); rays.className = 'cutin-rays';
      rays.style.cssText = `width:${RS}px;height:${RS}px;left:${Math.round(W * 0.6 - RS / 2)}px;top:${Math.round(H * 0.38 - RS / 2)}px;background:${raysGradient()};-webkit-mask-image:${rayMask};mask-image:${rayMask};`;
      content.appendChild(rays);

      const burst = document.createElement('div'); burst.className = 'cutin-burst';
      content.appendChild(burst);

      // 敵の画像（大写し）。下側は技名の帯に隠れるので、画像の「上〜真ん中あたり（顔・上半身）」が
      // 帯の上の空き（高さの約52%）にちょうど入るように、大きめにして上へずらして置く
      const monWrap = document.createElement('div'); monWrap.className = 'cutin-monwrap';
      monWrap.style.cssText = `left:${W * 0.27}px;width:${W * 0.62}px;top:${-H * 0.23}px;height:${H * 1.3}px;`;
      const mon = document.createElement('img'); mon.className = 'cutin-mon';
      mon.alt = ''; mon.draggable = false;
      mon.onerror = function () { this.style.display = 'none'; };
      mon.src = (enemy && enemy.img) || '';
      monWrap.appendChild(mon);
      content.appendChild(monWrap);

      const slash = document.createElement('div'); slash.className = 'cutin-slash';
      slash.style.width = Math.round(W * 0.2) + 'px';
      content.appendChild(slash);

      // 火の粉（下から舞い上がる光の粒）
      const embers = [];
      for (let i = 0; i < EMBER_N; i++) {
        const e = document.createElement('i'); e.className = 'cutin-ember';
        const z = rnd(3, 8);
        e.style.cssText = `left:${rnd(2, 98)}%;top:${H * rnd(.5, .95)}px;width:${z}px;height:${z}px;opacity:0;`;
        content.appendChild(e); embers.push(e);
      }

      // 技名の帯
      const strip = document.createElement('div'); strip.className = 'cutin-strip';
      strip.style.cssText = `bottom:${stripBottom}px;height:${stripH}px;`;
      const hit = document.createElement('div'); hit.className = 'cutin-hit';
      const nameEl = document.createElement('div'); nameEl.className = 'cutin-name';
      const chars = Array.from(name);
      const chEls = chars.map(c => {
        const s = document.createElement('span'); s.className = 'cutin-ch';
        s.dataset.c = c; s.textContent = c; nameEl.appendChild(s); return s;
      });
      strip.append(hit, nameEl);   // hit（白い光）は文字の下
      content.append(strip);

      root.appendChild(stage);
      host.appendChild(root);

      // 文字の大きさ：帯の高さに合わせ、横にはみ出す長い技名は縮める
      let fs = stripH * 0.74;
      nameEl.style.fontSize = fs + 'px';
      const maxW = W * 0.88;
      const nw = nameEl.offsetWidth;
      if (nw > maxW) { fs = Math.max(12, fs * maxW / nw); nameEl.style.fontSize = fs + 'px'; }

      // ── 動き ──
      let done = false, timer = 0;
      const finish = () => {
        if (done) return; done = true;
        clearTimeout(timer);
        if (_active === finish) _active = null;
        root.remove();
        resolve();
      };
      _active = finish;
      timer = setTimeout(finish, T);

      if (!root.animate) { setTimeout(finish, T); return; }   // 古い環境：アニメ無しで時間だけ待つ

      const fIn = IN_MS / T, fOut = 1 - OUT_MS / T;
      const A = (el, kf, opt) => { try { return el.animate(kf, Object.assign({ fill: 'both' }, opt)); } catch (e) { return null; } };

      // 暗転・星・光
      A(dim,   [{ opacity: 0 }, { opacity: 1, offset: fIn * .7 }, { opacity: 1, offset: fOut }, { opacity: 0 }], { duration: T });
      A(stars, [{ opacity: 0 }, { opacity: 1, offset: fIn }, { opacity: 1, offset: fOut }, { opacity: 0 }], { duration: T });
      A(halo,  [{ opacity: 0 }, { opacity: .75, offset: fIn }, { opacity: .5, offset: fOut }, { opacity: 0 }], { duration: T });
      A(flash, [{ opacity: .85 }, { opacity: 0 }], { duration: 260 });

      // 帯：左から滑り込む（少し行き過ぎて戻る）→ 止まる → 右へ抜ける
      A(stage, [
        { offset: 0,        transform: 'translateX(-108%) scaleY(.7)', easing: 'cubic-bezier(.12,.85,.25,1)' },
        { offset: fIn * .8, transform: 'translateX(1.6%) scaleY(1.05)', easing: 'ease-out' },
        { offset: fIn,      transform: 'translateX(0) scaleY(1)' },
        { offset: fOut,     transform: 'translateX(0) scaleY(1)', easing: 'cubic-bezier(.6,0,.9,.5)' },
        { offset: 1,        transform: 'translateX(108%) scaleY(.86)' }
      ], { duration: T });

      // 敵：ぐっと寄ってから、ゆっくり引く（光ってから元の明るさへ）
      A(mon, [
        { transform: 'translateX(7%) scale(1.3)', filter: 'brightness(2.6) saturate(.4)' },
        { transform: 'translateX(3%) scale(1.14)', filter: 'brightness(1.1) saturate(1)', offset: .22 },
        { transform: 'translateX(-1%) scale(1.04)', filter: 'brightness(1) saturate(1)' }
      ], { duration: T, easing: 'cubic-bezier(.1,.7,.3,1)' });

      // 集中線はゆっくり回り続ける／左の光は脈打つ
      A(rays,  [{ transform: 'rotate(0deg)' }, { transform: 'rotate(30deg)' }], { duration: T });
      A(burst, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: .95, transform: 'scale(1)', offset: .16 },
                { opacity: .55, transform: 'scale(1.06)', offset: .5 }, { opacity: .9, transform: 'scale(1)', offset: .75 },
                { opacity: .55, transform: 'scale(1.04)' }], { duration: T });

      // 斬撃のような光が左→右に走る（2本）
      [0, 90].forEach((d, i) => {
        A(slash, [
          { opacity: 0, transform: `translateX(${-W * .3}px) skewX(-24deg)` },
          { opacity: 1, offset: .15 },
          { opacity: 0, transform: `translateX(${W * 1.15}px) skewX(-24deg)` }
        ], { duration: 420, delay: IN_MS * .7 + d });
      });

      // 火の粉
      embers.forEach(e => {
        const dx = rnd(-30, 60), dy = -rnd(H * .4, H * .9), dur = rnd(700, 1400);
        A(e, [
          { opacity: 0, transform: 'translate(0,0) scale(.6)' },
          { opacity: 1, offset: .2 },
          { opacity: 0, transform: `translate(${dx}px,${dy}px) scale(1.1)` }
        ], { duration: dur, delay: rnd(IN_MS * .5, T * .55), iterations: 2 });
      });

      // 技名：1文字ずつ「ドン！」と叩きつけるように入る
      const TEXT_AT = IN_MS * .75, STEP = Math.min(45, 340 / Math.max(1, chars.length));
      chEls.forEach((c, i) => {
        const an = A(c, [
          { opacity: 0, transform: `translate(${W * .05}px,${-stripH * .35}px) scale(2.8)` },
          { opacity: 1, transform: 'translate(0,0) scale(.9)', offset: .58 },
          { opacity: 1, transform: 'translate(0,0) scale(1)' }
        ], { duration: 280, delay: TEXT_AT + i * STEP, easing: 'cubic-bezier(.2,.8,.3,1)' });
        if (an) an.onfinish = () => { try { an.cancel(); } catch (e) {} };
      });
      const landAt = TEXT_AT + 280 * .58;
      A(hit, [{ opacity: 0 }, { opacity: .9, offset: .2 }, { opacity: 0 }], { duration: 380, delay: landAt });
      setTimeout(() => { if (!done && typeof battleShake === 'function') { try { battleShake(10); } catch (e) {} } }, landAt);
      // 最後の文字が入った瞬間にもう一度、帯が少し膨らむ
      A(strip, [{ transform: 'scaleY(1)' }, { transform: 'scaleY(1.08)', offset: .35 }, { transform: 'scaleY(1)' }],
        { duration: 260, delay: TEXT_AT + (chars.length - 1) * STEP + 170 });
    });
  }

  window.EnemyCutIn = { show, isCutin, cleanName, THEMES };
})();
