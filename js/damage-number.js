// ============================================================
// ★ ダメージ数字（動画の見た目に合わせた版）★
//
//   ◆ モンスターごとの数字（チームの1体が1回攻撃するたびに、その敵の上に数字が1つ出る）
//       ・数字は 0 から攻撃力まで、リアルタイムにすっと増えます。色は攻撃した属性の色。
//       ・同じ敵に当たった数字は、攻撃した順に縦に並びます（少し重なる）。
//       ・弱点属性で当たった数字は、増えながら大きくなって、上にせり上がります（パズドラと同じ）。
//       ・弱点じゃない数字は、最後の攻撃から少しして消えて、弱点の数字だけが残ります。
//   ◆ 合計ダメージ（敵のHPバーの上に出る白い数字）
//       ・こちらもヒットを待たずに、滑らかに数字が増え続けます。
//
//   公開：window.DamageNumber.show(x, y, value, attr, weak, slotIndex)  … slotIndex = 攻撃したパーティの番号   … 呼び出し側は今までと同じ
//         window.DamageTotal.add(敵の番号, ダメージ) / reset() / clear()
//
//   ★ 見た目の調整はこのファイルの先頭の定数だけでOK
//       BASE_RATIO / BASE_MIN / BASE_MAX … 属性ごとの数字の大きさ
//       ATTR_GAP        … 数字を縦に並べるときの間隔（数字の高さ × この値。小さいほど重なる）
//       WEAK_MAX_SCALE  … 弱点の数字の最大倍率   / WEAK_RISE … せり上がる量 / WEAK_LANE_GAP … 弱点が複数のときの間隔（数字の高さ × この値）
//       DRIFT_X / DRIFT_Y / DRIFT_MS … 数字が斜め上に上がる量と速さ   / FADE_MS … 消える速さ
//       ATTR_TAU / WEAK_TAU / TOTAL_TAU … 数字が増える速さ（小さいほど速い・ms）
//       TOTAL_*         … 合計ダメージの大きさ / TOTAL_HOLD_MS（残す時間）/ TOTAL_RISE_MS・TOTAL_RISE（上がって消える）
//   ◆ 敵を倒したとき：その敵の数字と合計は、倒した瞬間に上に上がって消えます。
//   公開：DamageTotal.finish() … 全員の攻撃が終わったときに呼ぶ（0.3秒残して、上がって消える）
// ============================================================
(function () {
  'use strict';

  const FONT = "'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Noto Sans CJK JP', sans-serif";
  const WEIGHT = 700;         // 文字の太さ（400=細い / 700=太め）

  // ---- 属性ごとの数字 ----
  const ATTR_SUM = true;       // true=モンスターごとに1つの数字（増えていく）  / false=従来どおりヒットごとに出す
  const SHOW_MS    = 1200;     // （ATTR_SUM=false のときの）数字が残る時間
  const BASE_RATIO = 0.034;    // 戦闘画面の横幅 × この値 ＝ 通常の数字の高さ
  const BASE_MIN   = 10, BASE_MAX = 16;   // 通常の数字の高さの下限・上限（px）
  const ATTR_GAP   = 0.66;     // 数字を縦に並べる間隔（最大）
  const ATTR_GAP_MIN = 0.56;   // 敵が小さいときに詰める間隔（最小）（高さ × 値）
  const ATTR_Y     = 0.50;     // 数字を出す高さ（敵の上端からの割合。0.5=真ん中）
  const ATTR_TAU   = 90;       // 属性の数字が増える速さ（ms）
  const NONWEAK_IDLE_MS = 800; // 弱点以外の数字が、最後のヒットから消えるまで
  const WEAK_IDLE_MS    = 1400;// 弱点の数字が、最後のヒットから消えるまで
  const DRIFT_X  = 0.5;        // 数字がゆっくり斜め上（右上）に上がる量：横（数字の高さ × 値）
  const DRIFT_Y  = -1.3;       //                                     ：縦（マイナス＝上）
  const DRIFT_MS = 2000;       // 上がりきるまでの時間（ms）。大きいほどゆっくり
  const FADE_MS  = 450;        // 消えるときにかける時間（ms）
  const WEAK_SCALE = 1.25;     // （ATTR_SUM=false のときの）弱点の倍率
  const WEAK_TAU = 140;        // 弱点の数字が増える速さ（ms）。少しゆっくり増えるので、大きくなる動きが見える
  const WEAK_MAX_SCALE = 1.7;  // 弱点の数字の最大倍率
  const WEAK_RISE      = 0.9;  // 弱点の数字が下から上にせり上がる量（高さ × 値）
  const WEAK_LANE_GAP  = 1.6;  // 弱点の数字が複数あるとき、上へ積む間隔（高さ × 値）

  // ---- 合計ダメージ（白）----
  const TOTAL_TAU = 130;       // 合計が増える速さ（ms）。ヒットを待たず、この速さで追いかけ続ける
  const TOTAL_IDLE_MS  = 2600; // 攻撃中以外（スキルなど）のとき、合計を残す時間
  const TOTAL_HOLD_MS  = 300;  // 全員の攻撃が終わってから、合計をそのまま残す時間
  const TOTAL_RISE_MS  = 900;  // そのあと、ゆっくり上に上がって消えるまでの時間
  const TOTAL_RISE     = 1.8;  // 上がる量（数字の高さ × 値）
  const TOTAL_MIN = 11, TOTAL_MAX = 17, TOTAL_RATIO = .1;   // 合計の数字の高さ：敵の幅×RATIO（下限・上限px）

  // ---------- 属性ごとの色：color = 文字色 / edge = 縁取りの色 ----------
  const PAL = {
    fire:  { color: '#ff6b6b', edge: '#4a0c14' },
    water: { color: '#6bb8ff', edge: '#0a2150' },
    wood:  { color: '#6fdc70', edge: '#0b3512' },
    light: { color: '#ffe066', edge: '#4a3000' },
    dark:  { color: '#c58bff', edge: '#2a0b55' },
    none:  { color: '#f2f2f6', edge: '#1c1c26' },   // 属性なし（固定ダメージなど）
    total: { color: '#ffffff', edge: '#0c0c12' }    // 合計ダメージ（白＋黒い縁）
  };

  // 細い縁取り（4方向 1px）＋ごく弱い影
  function textStyle(attr, px) {
    const P = PAL[attr] || PAL.none, e = P.edge;
    const o = Math.max(1, Math.round(px / 16));
    return `font-family:${FONT};font-weight:${WEIGHT};font-style:normal;font-size:${px}px;line-height:1;` +
           `letter-spacing:.02em;font-variant-numeric:tabular-nums;white-space:nowrap;color:${P.color};` +
           `text-shadow:${o}px 0 0 ${e},-${o}px 0 0 ${e},0 ${o}px 0 ${e},0 -${o}px 0 ${e},` +
           `${o}px ${o}px 0 ${e},-${o}px ${o}px 0 ${e},${o}px -${o}px 0 ${e},-${o}px -${o}px 0 ${e},` +
           `0 ${o + 1}px ${o + 2}px rgba(0,0,0,.45);`;
  }

  // ---------- 共通：数字を「追いかけて」増やすタイマー（リアルタイムに増えて見える） ----------
  const counters = new Set();      // { target, shown, tau, apply(shown) }
  let tickRaf = 0, lastT = 0;
  function tick(now) {
    const dt = Math.min(64, now - (lastT || now)); lastT = now;
    for (const c of counters) {
      const diff = c.target - c.shown;
      if (diff < 1) { c.shown = c.target; }
      else c.shown += Math.max(diff * (1 - Math.exp(-dt / c.tau)), Math.min(diff, dt * .02));
      c.apply(c.shown);
      if (c.shown >= c.target) counters.delete(c);
    }
    tickRaf = counters.size ? requestAnimationFrame(tick) : 0;
    if (!tickRaf) lastT = 0;
  }
  function run(c) { counters.add(c); if (!tickRaf) tickRaf = requestAnimationFrame(tick); }

  const attackNow = () => (typeof attackPhaseCombo !== 'undefined' && attackPhaseCombo > 0);   // 攻撃フェーズ中か
  const gameW = () => {
    const dg = document.getElementById('dungeon'), dr = dg ? dg.getBoundingClientRect() : null;
    return dr && dr.width > 100 ? dr.width : Math.min(window.innerWidth, 480);
  };
  function fadeEl(el, ms, done) {
    if (el.animate) { const a = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, fill: 'forwards' }); a.onfinish = done; }
    else done();
  }

  // ============================================================
  // モンスターごとの数字（敵1体 × 攻撃したモンスター1体）
  // ============================================================
  const ATT = [];   // 敵の番号 → { unit, list:[entry...], settle, weakT }   entry = { key, attr, sum, weak, el, inner, c, slot, h }
  let uniq = 0;
  const isDead = (idx) => (typeof enemyList !== 'undefined' && enemyList[idx] && enemyList[idx].hp <= 0);
  function enemyIndexAt(x, y) {
    const units = document.querySelectorAll('#enemy-area .enemy-unit');
    let best = -1, bd = Infinity;
    units.forEach((u, i) => {
      const r = u.getBoundingClientRect(); if (r.width < 1) return;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const inside = x >= r.left - 8 && x <= r.right + 8 && y >= r.top - 40 && y <= r.bottom + 8;
      const d = Math.hypot(x - cx, y - cy) - (inside ? 1e5 : 0);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }
  function attrState(idx, unit) {
    let st = ATT[idx];
    if (!st || st.unit !== unit || !unit.isConnected) {      // 新しい敵（次のウェーブなど）は最初から
      if (st) dropAttState(st);
      st = ATT[idx] = { unit, list: [], settle: 0, weakT: 0 };
    }
    return st;
  }
  function dropAttState(st) { clearTimeout(st.settle); clearTimeout(st.weakT); st.list.forEach(removeAttr); }
  function removeAttr(e) {
    counters.delete(e.c);
    if (e.el && e.el.parentNode) e.el.remove();
    e.el = null; e.inner = null;
  }
  function hideAttr(e, ms) {            // 見た目だけ消す
    const el = e.el; if (!el) return;
    const inner = e.inner;
    e.el = null; e.inner = null; counters.delete(e.c);
    const d = ms == null ? FADE_MS : ms;
    if (inner && inner.animate) inner.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${(-e.h * .9).toFixed(1)}px)` }], { duration: d, easing: 'ease-out', fill: 'forwards' });
    fadeEl(el, d, () => el.remove());
  }
  function applyAttr(e, v) {
    if (!e.inner) return;
    e.inner.textContent = String(Math.round(v));
    // 弱点：増えるにつれて大きく・上へ（0 → 最終ダメージ に合わせて 1倍 → WEAK_MAX_SCALE倍）
    let g = 0;
    if (e.weak) { g = Math.max(0, Math.min(1, e.sum > 0 ? v / e.sum : 1)); g = g * g * (3 - 2 * g); }
    const sc = 1 + (WEAK_MAX_SCALE - 1) * g;
    e.el.style.transform = `translate(-50%,-50%) translateY(${((1 - g) * e.h * WEAK_RISE).toFixed(1)}px) scale(${sc.toFixed(3)})`;
  }
  function addAttr(idx, unit, attr, value, weak, slotIndex) {
    const st = attrState(idx, unit);
    const key = (slotIndex == null) ? 'u' + (++uniq) : 's' + slotIndex;   // 攻撃したモンスターごとに1つ
    let e = st.list.find(o => o.key === key);
    if (!e) { e = { key, attr, sum: 0, weak: false, el: null, inner: null, c: null, slot: st.list.length, h: 0 }; st.list.push(e); }
    if (weak) e.weak = true;
    const before = e.sum;
    e.sum += value;
    if (!e.el) {                                           // まだ出ていない／消えていた → 出す
      const dw = gameW(), r = unit.getBoundingClientRect();
      const h = Math.max(BASE_MIN, Math.min(BASE_MAX, dw * BASE_RATIO));
      e.h = h;
      // 白い合計の「上」で止まるように並べる（下へ積んでも合計に被らない）。弱点の数字は山の上の段へ。
      const totH = Math.max(TOTAL_MIN, Math.min(TOTAL_MAX, r.width * TOTAL_RATIO));
      const hpEl = unit.querySelector('.enemy-hp-row'), hpH = hpEl ? hpEl.offsetHeight : 0;
      const limit = r.bottom - hpH - 3 - totH * 1.3 - h * 1.15;                 // 一番下の数字の中心がここより下に来ない
      const cy0 = r.top + r.height * ATTR_Y;
      const minGap = h * ATTR_GAP_MIN, maxGap = h * ATTR_GAP;
      const startNon = Math.min(cy0 - h * .2, limit - 4 * minGap);            // 非弱点の山の一番上（最大5段ぶん確保）
      const gap = Math.max(minGap, Math.min(maxGap, (limit - startNon) / 4));
      const lane = st.list.filter(o => o !== e && o.weak === e.weak).length;
      let x = r.left + r.width / 2, y = e.weak ? startNon - h * .75 - lane * h * WEAK_LANE_GAP : Math.min(limit, startNon + lane * gap);
      const dg = document.getElementById('dungeon'), dr = dg ? dg.getBoundingClientRect() : null;
      if (dr && dr.width > 100) { x = Math.max(dr.left + dw * .18, Math.min(dr.right - dw * .18, x)); y = Math.max(dr.top + h * 1.4, Math.min(dr.bottom - h * 2.2, y)); }
      const el = document.createElement('div');
      el.className = 'dmg-number dmg-attr' + (e.weak ? ' weak' : '');
      el.style.cssText = `position:fixed;left:${x}px;top:${y}px;z-index:${e.weak ? 296 : 290 - e.slot};pointer-events:none;will-change:transform,opacity;transform-origin:50% 60%;transform:translate(-50%,-50%);`;
      const drift = document.createElement('div');           // ゆっくり斜め上へ上がる動き（大きさ・せり上がりは el 側）
      const inner = document.createElement('div');
      inner.style.cssText = textStyle(attr, h) + (e.weak ? 'filter:brightness(1.1);' : '');
      drift.appendChild(inner); el.appendChild(drift); document.body.appendChild(el);
      if (drift.animate) drift.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${(DRIFT_X * h).toFixed(1)}px,${(DRIFT_Y * h).toFixed(1)}px)` }],
        { duration: DRIFT_MS, easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'forwards' });
      e.el = el; e.inner = inner;
      e.c = { target: e.sum, shown: before, tau: e.weak ? WEAK_TAU : ATTR_TAU, apply: v => applyAttr(e, v) };
      applyAttr(e, before);
      if (inner.animate) inner.animate([{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 140, easing: 'ease-out' });
    }
    if (e.weak && e.el) e.el.style.zIndex = 296;
    e.c.tau = e.weak ? WEAK_TAU : ATTR_TAU;
    e.c.target = e.sum; run(e.c);                          // 0 → ダメージまで、リアルタイムに増える

    // 最後の攻撃から少しして、弱点じゃない数字だけ消える（弱点の数字は残る）
    clearTimeout(st.settle);
    st.settle = setTimeout(() => st.list.forEach(o => { if (!o.weak) hideAttr(o); }), NONWEAK_IDLE_MS);
    clearTimeout(st.weakT);
    st.weakT = setTimeout(() => st.list.forEach(o => hideAttr(o)), WEAK_IDLE_MS);
    if (isDead(idx)) {                                     // 倒した瞬間：数字は上に上がって消える
      clearTimeout(st.settle); clearTimeout(st.weakT);
      st.weakT = setTimeout(() => st.list.forEach(o => hideAttr(o, 600)), 120);
    }
  }

  function show(x, y, value, attr, weak, slotIndex) {
    value = Math.max(0, Math.floor(value));
    if (ATTR_SUM && value > 0) {
      const idx = enemyIndexAt(x, y);
      const unit = idx >= 0 ? document.querySelectorAll('#enemy-area .enemy-unit')[idx] : null;
      if (unit) { addAttr(idx, unit, attr || 'none', value, !!weak, slotIndex); return null; }
    }
    return showOne(x, y, value, attr, weak);
  }

  // ---------- 従来のヒットごとの数字（ATTR_SUM=false のとき／敵が見つからないとき） ----------
  const recent = [];
  function stackOffset(x, y, w, h) {
    const now = performance.now();
    while (recent.length && now - recent[0].t > 900) recent.shift();
    let n = 0;
    for (const r of recent) if (Math.abs(r.x - x) < (w + r.w) * .45 && Math.abs(r.y - y) < (h + r.h) * .5) n++;
    recent.push({ x, y, w, h, t: now });
    return Math.min(n, 2) * h * 1.05;
  }
  function showOne(x, y, value, attr, weak) {
    const str = String(Math.max(0, Math.floor(value)));
    const dg = document.getElementById('dungeon'), dr = dg ? dg.getBoundingClientRect() : null;
    const dw = gameW();
    let h = Math.max(BASE_MIN, Math.min(BASE_MAX, dw * BASE_RATIO));
    if (weak) h *= WEAK_SCALE;
    h = Math.min(h, (dw * .92) / (str.length * .62));
    const pxW = str.length * h * .62, pxH = h * 1.3;
    y -= stackOffset(x, y, pxW, h);
    if (dr && dr.width > 100) {
      x = Math.max(dr.left + pxW / 2 + 2, Math.min(dr.right - pxW / 2 - 2, x));
      y = Math.max(dr.top + pxH, Math.min(dr.bottom - pxH * .5, y));
    }
    const el = document.createElement('div');
    el.className = 'dmg-number' + (weak ? ' weak' : '');
    el.style.cssText = `position:fixed;left:${x}px;top:${y}px;z-index:${weak ? 296 : 290};pointer-events:none;will-change:transform,opacity;${weak ? 'filter:brightness(1.12);' : ''}` + textStyle(attr, h);
    el.textContent = str;
    document.body.appendChild(el);
    if (el.animate) {
      el.animate([
        { offset: 0,   opacity: 0, transform: 'translate(-50%,-40%) scale(.9)' },
        { offset: .12, opacity: 1, transform: 'translate(-50%,-70%) scale(1.04)' },
        { offset: .24, opacity: 1, transform: 'translate(-50%,-80%) scale(1)' },
        { offset: .78, opacity: 1, transform: 'translate(-50%,-100%) scale(1)' },
        { offset: 1,   opacity: 0, transform: 'translate(-50%,-115%) scale(1)' }
      ], { duration: SHOW_MS, easing: 'ease-out', fill: 'forwards' });
    }
    setTimeout(() => el.remove(), SHOW_MS + 100);
    return el;
  }

  function markup(str, attr, h) {
    str = String(str);
    return { html: `<span style="${textStyle(PAL[attr] ? attr : 'none', h)}">${str}</span>`, w: str.length * h * .62, h: h * 1.3, pad: 0 };
  }

  // ============================================================
  // 合計ダメージ（敵ごと。HPバーの真上に白い数字で出て、ヒットを待たずに増え続ける）
  // ============================================================
  const TOT = [];   // 敵の番号 → { unit, el, inner, total, shown, c, timer, h }
  function dropTotal(idx) {
    const st = TOT[idx];
    if (!st) return;
    clearTimeout(st.timer); counters.delete(st.c);
    if (st.el && st.el.parentNode) st.el.remove();
    TOT[idx] = null;
  }
  function finishTotal(idx, hold) {      // hold(ms) そのまま残してから、ゆっくり上に上がって消える
    const st = TOT[idx];
    if (!st || (st.fin && st.anim)) return;           // もう上がって消え始めているなら何もしない
    st.fin = true; clearTimeout(st.timer);
    st.timer = setTimeout(() => {
      const inner = st.inner, el = st.el;
      if (!inner || !el) return;
      if (inner.animate) {
        st.anim = inner.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: `translateY(${(-st.h * TOTAL_RISE).toFixed(1)}px)` }],
          { duration: TOTAL_RISE_MS, easing: 'cubic-bezier(.3,.1,.35,1)', fill: 'forwards' });
        st.anim.onfinish = () => { if (TOT[idx] === st) dropTotal(idx); else if (el.parentNode) el.remove(); };
      } else dropTotal(idx);
    }, hold);
  }
  function placeTotal(st) {            // 敵のHPバーのすぐ上に合わせる
    const r = st.unit.getBoundingClientRect(), hp = st.unit.querySelector('.enemy-hp-row');
    if (!st.unit.isConnected) return;                  // 敵が消えたあとは、最後の位置のまま
    st.el.style.left = r.left + 'px'; st.el.style.width = r.width + 'px';
    st.el.style.top = (r.bottom - (hp ? hp.offsetHeight : 0) - 3) + 'px';
    st.el.style.transform = 'translateY(-100%)';
  }
  function addTotal(idx, dmg) {
    dmg = Math.floor(dmg);
    if (!(dmg > 0)) return;
    const unit = document.querySelectorAll('#enemy-area .enemy-unit')[idx];
    if (!unit) return;
    let st = TOT[idx];
    if (!st || st.unit !== unit || !st.el.isConnected) {            // 新しい敵（次のウェーブなど）は 0 から数え直す
      dropTotal(idx);
      const h = Math.max(TOTAL_MIN, Math.min(TOTAL_MAX, unit.getBoundingClientRect().width * TOTAL_RATIO));
      const el = document.createElement('div');
      el.className = 'dmg-total';
      el.style.cssText = 'position:fixed;display:flex;justify-content:center;pointer-events:none;z-index:295;';
      const inner = document.createElement('div');
      inner.style.cssText = 'transform-origin:50% 85%;will-change:transform;' + textStyle('total', h);
      el.appendChild(inner);
      document.body.appendChild(el);   // エフェクトより手前に出すため、敵の中ではなく画面の最前面に置く
      st = TOT[idx] = { unit, el, inner, total: 0, shown: 0, c: null, timer: 0, h };
      st.c = { target: 0, shown: 0, tau: TOTAL_TAU, apply: v => { st.shown = v; st.inner.textContent = String(Math.round(v)); placeTotal(st); } };
    }
    placeTotal(st);
    clearTimeout(st.timer);
    if (st.fin) { st.fin = false; clearTimeout(st.timer); if (st.anim) { st.anim.cancel(); st.anim = null; } }   // 消えかけなら取り消す
    st.total += dmg;
    st.c.target = st.total; run(st.c);                      // ヒットのたびに目標だけ上げる → 数字は滑らかに増え続ける
    if (isDead(idx)) { st.c.shown = st.c.target; st.c.apply(st.c.shown); finishTotal(idx, 60); }   // 倒した瞬間：すぐ上がって消える
    else if (!attackNow()) finishTotal(idx, TOTAL_IDLE_MS);   // スキルなど攻撃フェーズ外は、少ししたら消す
  }

  const DamageTotal = {
    add(idx, dmg) { addTotal(idx, dmg); },
    value(idx) { const st = TOT[idx]; return st ? { total: st.total, shown: Math.round(st.shown) } : null; },
    reset() {
      for (let i = 0; i < TOT.length; i++) dropTotal(i);
      for (let i = 0; i < ATT.length; i++) if (ATT[i]) { dropAttState(ATT[i]); ATT[i] = null; }
    },
    finish() { for (let i = 0; i < TOT.length; i++) finishTotal(i, TOTAL_HOLD_MS); },   // 全員の攻撃が終わった：0.3秒残して、上がって消える
    clear() {
      for (let i = 0; i < TOT.length; i++) finishTotal(i, 0);
      for (let i = 0; i < ATT.length; i++) if (ATT[i]) { const st = ATT[i]; ATT[i] = null; clearTimeout(st.settle); clearTimeout(st.weakT); st.list.forEach(e => hideAttr(e, 320)); }
    }
  };

  window.DamageNumber = { show, markup, SHOW_MS };
  window.DamageTotal = DamageTotal;
})();
