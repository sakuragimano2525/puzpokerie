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
//   ■ iPhone（Safari）で重くて落ちないための軽量化（見た目は同じ）
//       ・ギザギザ枠は clip-path で「動いているものごと」切り抜かず、止まった枠（SVG）を上に重ねる
//       ・集中線は、巨大なマスクつきの回転レイヤーをやめて、小さな絵（canvas）にあらかじめ描いておく
//       ・敵の明るさフィルターは、効いている間だけ（そのあとは外す）
//       ・出番の終わった光・火の粉は、その場で消してレイヤーを減らす
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
  // 枠の輪郭（SVGのパス）。oyTop / oyBot：上辺・下辺をどれだけ内側（＋）／外側（−）にずらすか。y0＝レイヤー内での帯の上端
  // minY / maxY を渡すと、その範囲より外へはみ出さないように切りそろえる（中身の四角に合わせる用）
  function ringPath(edge, y0, hStage, oyTop, oyBot, minY, maxY) {
    const cl = y => (minY == null ? y : Math.max(minY, Math.min(maxY, y)));
    const pts = [];
    edge.top.forEach(p => pts.push(p[0].toFixed(1) + ' ' + cl(y0 + p[1] + oyTop).toFixed(1)));
    for (let i = edge.bot.length - 1; i >= 0; i--) {
      const p = edge.bot[i];
      pts.push(p[0].toFixed(1) + ' ' + cl(y0 + hStage - p[1] + oyBot).toFixed(1));
    }
    return 'M' + pts.join('L') + 'Z';
  }

  // cubic-bezier のイージング（敵の画像の明るさフィルターを、本来の動きのまま短い時間に写し取るのに使う）
  function bezierEase(x1, y1, x2, y2) {
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let lo = 0, hi = 1, t = x;
      for (let i = 0; i < 30; i++) {
        const cx = 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
        if (Math.abs(cx - x) < 1e-5) break;
        if (cx < x) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
      return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
    };
  }
  const MON_EASE = bezierEase(.1, .7, .3, 1);   // 敵の寄りの動きのイージング（下の A(mon …) と同じもの）

  // 集中線：不規則な太さの放射状の線。
  //   以前は conic-gradient ＋ 巨大な radial-gradient のマスクを回していた（iPhoneで一番重い）。
  //   今は、同じ線（太さ・濃さ・中心から外へ薄くなる具合）を小さな canvas に1回だけ描き、それを回すだけ。
  function makeRays(RS, R0, scale) {
    const sc = Math.max(0.3, scale);
    const S = Math.max(64, Math.round(RS * sc));
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const ctx = cv.getContext && cv.getContext('2d');
    if (!ctx) return cv;
    const k = S / RS, c = S / 2, big = S;                 // k＝実寸→canvasの倍率 / big＝画面の外まで届く長さ
    const rad = d => (d - 90) * Math.PI / 180;             // conic-gradient は真上が0度・時計まわり
    let a = 0;
    while (a < 345) {
      const gap = rnd(3, 11), wid = rnd(1.5, 6), al = rnd(.12, .3);   // 乱数を引く順番は以前と同じ
      const a1 = a + gap, a2 = Math.min(360, a + gap + wid);
      if (a1 < 360) {
        ctx.fillStyle = 'rgba(255,255,255,' + al.toFixed(2) + ')';
        ctx.beginPath();
        ctx.moveTo(c, c);
        ctx.lineTo(c + Math.cos(rad(a1)) * big, c + Math.sin(rad(a1)) * big);
        ctx.lineTo(c + Math.cos(rad(a2)) * big, c + Math.sin(rad(a2)) * big);
        ctx.closePath();
        ctx.fill();
      }
      a += gap + wid;
    }
    // 中心は濃く、外へ向かって消える（以前の mask-image と同じ形）
    const g = ctx.createRadialGradient(c, c, 0, c, c, R0 * .68 * k);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(Math.min(1, .12 / .68), 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    return cv;
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

      // ── 枠のつくり（軽量化）──
      //   中身は「ただの四角（overflow:hidden）」の中に入れる。ギザギザの形は、止まった SVG の枠（黒縁＋白）を中身の上に重ねて作る。
      //   四角は、いちばん深いギザギザの谷より内側にとってあるので、枠の外側に中身がはみ出すことはない。
      let maxTop = 0, maxBot = 0;
      edge.top.forEach(p => { if (p[1] > maxTop) maxTop = p[1]; });
      edge.bot.forEach(p => { if (p[1] > maxBot) maxBot = p[1]; });
      const Rtop = Math.ceil(8 - 3.5 + maxTop);              // 中身の四角の上端（レイヤー内の y）
      const Rbot = Math.floor(8 + H + 3.5 - maxBot);         // 中身の四角の下端

      const clip = document.createElement('div'); clip.className = 'cutin-clip';
      clip.style.cssText = `left:-4px;top:${Rtop - 8}px;width:${layerW}px;height:${Rbot - Rtop}px;`;

      const NS = 'http://www.w3.org/2000/svg';
      const frame = document.createElementNS(NS, 'svg');
      frame.setAttribute('class', 'cutin-frame');
      frame.setAttribute('width', layerW); frame.setAttribute('height', layerH);
      frame.setAttribute('viewBox', `0 0 ${layerW} ${layerH}`);
      frame.setAttribute('aria-hidden', 'true');
      const mkPath = (d, fill) => {
        const el = document.createElementNS(NS, 'path');
        el.setAttribute('d', d); el.setAttribute('fill', fill); el.setAttribute('fill-rule', 'evenodd');
        return el;
      };
      // 黒い縁（外側のギザギザ〜白の少し内側まで。白の縁の下に潜らせて、すきまが出ないようにする）
      frame.appendChild(mkPath(ringPath(edge, 8, H, -3.5, 3.5) + ringPath(edge, 8, H, 1.2, -1.2), '#000'));
      // 白い縁（紙）：外側のギザギザ〜中身の四角まで
      frame.appendChild(mkPath(ringPath(edge, 8, H, 0, 0) + ringPath(edge, 8, H, bw, -bw, Rtop, Rbot), '#fff'));
      stage.append(clip, frame);

      const content = document.createElement('div'); content.className = 'cutin-content';
      content.style.cssText = `left:4px;top:${8 - Rtop}px;width:${W}px;height:${H}px;`;
      clip.appendChild(content);

      const bg = document.createElement('div'); bg.className = 'cutin-bg';
      content.appendChild(bg);

      // 集中線（小さな canvas に描いてあるだけ。回すのは位置・大きさの指定のみ）
      const RS = Math.round(Math.max(W, H) * 1.5);
      const R0 = Math.max(W, H) * 2.2 * Math.SQRT1_2;   // 元の大きさ(2.2倍)のときのマスクの半径
      const rays = makeRays(RS, R0, IOS ? 0.7 : 1);
      rays.className = 'cutin-rays';
      rays.style.cssText = `width:${RS}px;height:${RS}px;left:${Math.round(W * 0.6 - RS / 2)}px;top:${Math.round(H * 0.38 - RS / 2)}px;`;
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
      const flashAn = A(flash, [{ opacity: .85 }, { opacity: 0 }], { duration: 260 });
      if (flashAn) flashAn.onfinish = () => flash.remove();   // 終わったら外す（全画面のレイヤーを残さない）

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
        { transform: 'translateX(7%) scale(1.3)' },
        { transform: 'translateX(3%) scale(1.14)', offset: .22 },
        { transform: 'translateX(-1%) scale(1.04)' }
      ], { duration: T, easing: 'cubic-bezier(.1,.7,.3,1)' });
      // 明るさ・色のフィルター：以前と同じ変化を、ほぼ元の明るさに戻るところまで（約半分の時間）だけ再現し、そのあと外す。
      //   （フィルターを最後まで掛けっぱなしにすると、iPhoneは大きな画像を毎フレーム別に描き直して重くなるため）
      if (mon.animate) {
        const prog = x => {                       // 本来のキーフレーム（0 → .22 → 1）での進み具合
          const p = MON_EASE(x);
          return p < .22 ? [2.6 + (1.1 - 2.6) * p / .22, .4 + (1 - .4) * p / .22]
                         : [1.1 - .1 * (p - .22) / .78, 1];
        };
        let endX = .5;
        for (let x = .05; x <= .8; x += .01) { if (MON_EASE(x) >= .92) { endX = x; break; } }
        const FT = Math.round(T * endX), N = 18, fkf = [];
        for (let i = 0; i <= N; i++) {
          const o = (i / N) * (i / N), x = endX * o;   // 最初の「ぱっと光る」ところを細かく取る（時間 o ↔ 本来の時間 x）
          const v = i === N ? [1, 1] : prog(x);
          fkf.push({ offset: o, filter: `brightness(${v[0].toFixed(3)}) saturate(${v[1].toFixed(3)})` });
        }
        A(mon, fkf, { duration: FT, easing: 'linear', fill: 'none' });
      }

      // 集中線はゆっくり回り続ける／左の光は脈打つ
      A(rays,  [{ transform: 'rotate(0deg)' }, { transform: 'rotate(30deg)' }], { duration: T });
      A(burst, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: .95, transform: 'scale(1)', offset: .16 },
                { opacity: .55, transform: 'scale(1.06)', offset: .5 }, { opacity: .9, transform: 'scale(1)', offset: .75 },
                { opacity: .55, transform: 'scale(1.04)' }], { duration: T });

      // 斬撃のような光が左→右に走る（2本）。2本とも走り終わったら外す
      let slashLeft = 0;
      [0, 90].forEach((d, i) => {
        const an = A(slash, [
          { opacity: 0, transform: `translateX(${-W * .3}px) skewX(-24deg)` },
          { opacity: 1, offset: .15 },
          { opacity: 0, transform: `translateX(${W * 1.15}px) skewX(-24deg)` }
        ], { duration: 420, delay: IN_MS * .7 + d });
        if (an) { slashLeft++; an.onfinish = () => { if (--slashLeft <= 0) slash.remove(); }; }
      });

      // 火の粉
      embers.forEach(e => {
        const dx = rnd(-30, 60), dy = -rnd(H * .4, H * .9), dur = rnd(700, 1400);
        const an = A(e, [
          { opacity: 0, transform: 'translate(0,0) scale(.6)' },
          { opacity: 1, offset: .2 },
          { opacity: 0, transform: `translate(${dx}px,${dy}px) scale(1.1)` }
        ], { duration: dur, delay: rnd(IN_MS * .5, T * .55), iterations: 2 });
        if (an) an.onfinish = () => e.remove();   // 消えたあとは外す
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
