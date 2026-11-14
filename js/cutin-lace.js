// ============================================================
// ★ レース額縁カットイン（モンスターエディターで「レース額縁カットイン」にチェックしたモンスター用）★
//
//   パズドラ本家のコラボ演出のような、アンティークな額縁つきのカットインです。
//
//     ① 画面の真ん中に、金のレース柄の帯が左右へ伸びる（細い金の線）
//     ② 帯が上下へ開いて、縞模様＋レース模様の壁紙の「窓」が現れる（窓の四隅は、凹んだ丸い角）
//     ③ 金色の三日月の斬撃が走り、モンスター（mp{ID}.png）が左からスッと登場
//     ④ スキル名が、金ぶちの文字で右下に入る
//     ⑤ すっと閉じて終わり
//
//   ・色は属性で変わります：光＝金 / 火＝赤銅 / 水＝青 / 木＝緑 / 闇＝紫
//   ・軽量化（iPhone でも落ちにくい作り）：壁紙・帯・斬撃・文字・キャラのふちどりは、最初に canvas へ1回だけ描き、
//     あとは位置・透明度・大きさだけを動かします。動いているものに filter / clip-path / blur は使いません。
//   ・スキル名が長くても、①縮める ②2行にする ③横に潰す、の順で必ず収めます。
//
//   ■ 調整したいとき（下の「調整用の数字」）
//       WIN_H … 窓の高さ（画面幅に対する割合）／ BAND_H … レース帯の高さ
//       FACE_HEAD … 縦長キャラの顔の大きさ ／ SHOW_NAME … false にするとスキル名を出さない（本家と同じ絵だけにする）
//
//   ※ js/cutin.js から呼ばれます。単体では何もしません。
//       CutInLace.run({ host, W, DH, T, theme, name, info, face, IOS, shake }, onDone) → 途中で止める関数
// ============================================================
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const FONT = "'Hiragino Mincho ProN','Hiragino Mincho Pro','Yu Mincho','YuMincho','Noto Serif JP','Noto Serif CJK JP','Source Han Serif JP','Zen Old Mincho',serif";

  // ── 調整用の数字 ──────────────────────────────
  const SHOW_NAME   = true;   // スキル名を出す（本家の絵はスキル名なし。敵の技名などが見えなくなるので、普段は true のまま）
  const OUT_MS      = 300;    // 閉じる時間
  const LINE_MS     = 240;    // 金の線が左右へ伸びる時間
  const OPEN_MS     = 420;    // 窓が上下に開く時間
  const WIN_H       = 0.44;   // 窓の高さ（画面幅に対する割合）
  const BAND_H      = 0.07;   // レース帯の高さ（画面幅に対する割合）
  const TOTAL_MAX   = 0.82;   // 帯を含めた全体の高さの上限（見えている画面の高さに対する割合）
  const CENTER_Y    = 0.46;   // 真ん中の縦位置（画面の高さに対する割合）
  const FACE_HEAD   = 0.46;   // 縦長キャラ：頭の高さ（窓の高さに対する割合）
  const FACE_X      = 0.34;   // 縦長キャラ：顔を置く横位置（画面幅に対する割合）
  const FACE_Y      = 0.46;   // 縦長キャラ：顔を置く縦位置（窓の高さに対する割合）
  const NAME_ONE_MAX = 0.20;  // スキル名（1行）の最大の大きさ（窓の高さに対する割合）
  const NAME_ONE_MIN = 0.13;  // これより小さくなるなら2行にする
  const NAME_TWO_MAX = 0.17;  // スキル名（2行）の最大の大きさ
  const NAME_TWO_MIN = 0.10;  // これより小さくなるなら横に潰す
  const NAME_AREA_W  = 0.58;  // スキル名が使える横幅（画面幅に対する割合。右寄せ）

  // 属性ごとの色
  //  wall＝壁紙の3色（暗・中・明） / gold＝金属の3色（明・中・暗） / slash＝斬撃（芯・明るい縁・外側） / trail＝斬撃の尾・光
  //  glow＝光 / txt＝文字グラデ（上→下） / edge＝帯のいちばん濃い色・文字の外ぶち
  const PAL = {
    light: { wall: ['#2c1f0a', '#8d6c26', '#e8cf80'], gold: ['#fff4b8', '#e2b53f', '#7c5512'], slash: ['#ffffff', '#ffe96a', '#ff9a1f'], trail: '#ff8a1a', glow: '#fff2a8', txt: ['#ffffff', '#fff0b0', '#ffd35a'], edge: '#3a2406' },
    fire:  { wall: ['#2a0c08', '#8a2a16', '#f0905a'], gold: ['#ffe2c0', '#e8803a', '#6e2610'], slash: ['#ffffff', '#ffd070', '#ff4a1a'], trail: '#ff5a1e', glow: '#ffd2a0', txt: ['#ffffff', '#ffe0c0', '#ffa070'], edge: '#3e0c04' },
    water: { wall: ['#07162e', '#1f5da0', '#7ec8f0'], gold: ['#e6f6ff', '#6ab4e8', '#17497e'], slash: ['#ffffff', '#a8ecff', '#2a8cff'], trail: '#38a8ff', glow: '#c8f0ff', txt: ['#ffffff', '#d8f0ff', '#8cd0ff'], edge: '#04162f' },
    wood:  { wall: ['#08200d', '#2f7a2f', '#a0e070'], gold: ['#eaffd0', '#86d060', '#2a6a1c'], slash: ['#ffffff', '#d4ff80', '#2fbf4a'], trail: '#4cd04c', glow: '#d8ffb0', txt: ['#ffffff', '#e4ffd0', '#a8f08a'], edge: '#08240c' },
    dark:  { wall: ['#14081f', '#5a2a8a', '#c090f0'], gold: ['#f4e0ff', '#b074e0', '#4a2080'], slash: ['#ffffff', '#e0b8ff', '#a040ff'], trail: '#a050ff', glow: '#e8c8ff', txt: ['#ffffff', '#f0e0ff', '#d0a8ff'], edge: '#1c0a2c' }
  };

  function mkCanvas(w, h, dpr) {
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(w * dpr)); cv.height = Math.max(1, Math.ceil(h * dpr));
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const g = cv.getContext('2d');
    if (g) g.scale(dpr, dpr);
    return { cv, g };
  }
  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  // 金属のグラデ（横に流れて、きらっと光る所と暗い所がある）
  function metal(g, x0, x1, gold) {
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    [[0, 2], [.12, 1], [.26, 0], [.4, 1], [.55, 2], [.7, 1], [.86, 0], [1, 1]].forEach(s => gr.addColorStop(s[0], gold[s[1]]));
    return gr;
  }
  function sparklePath(g, x, y, R, k) {   // 4つ角のきらきら（細い ✦）
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 - Math.PI / 2, d = i % 2 ? R * (k || .26) : R;
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath();
  }

  // ── レース柄の帯（上の帯。下の帯は flip=true で上下反転して描く）──
  //   帯の高さ Hb ＋ 窓の中へ出っぱる「凹んだ丸い角」の高さ er。窓との境目（金の2本線）は、キャンバスの y=Hb
  function paintBand(W, Hb, er, pal, dpr, flip) {
    const H = Hb + er;
    const { cv, g } = mkCanvas(W, H, dpr);
    if (!g) return cv;
    if (flip) { g.translate(0, H); g.scale(1, -1); }
    const gold = pal.gold;
    const lw1 = Math.max(1, Hb * .035);

    // 1) 黒い地
    const bg = g.createLinearGradient(0, 0, 0, Hb);
    bg.addColorStop(0, '#040302'); bg.addColorStop(1, pal.edge);
    g.fillStyle = bg; g.fillRect(0, 0, W, Hb);

    // 2) レース：うろこ状の半円の列＋小さな点
    const s = Hb * .5;
    g.lineWidth = lw1; g.strokeStyle = metal(g, 0, W, gold); g.globalAlpha = .82;
    for (let r = 0; r < 3; r++) {
      const cy = Hb * (.12 + r * .2), off = r % 2 ? s / 2 : 0;
      for (let x = -s + off; x < W + s; x += s) {
        g.beginPath(); g.arc(x + s / 2, cy, s / 2, 0, Math.PI); g.stroke();
      }
    }
    g.globalAlpha = .9; g.fillStyle = gold[0];
    for (let r = 0; r < 3; r++) {
      const cy = Hb * (.12 + r * .2) + s / 2, off = r % 2 ? s / 2 : 0;
      for (let x = -s + off; x < W + s; x += s) { g.beginPath(); g.arc(x + s / 2, cy, lw1 * .9, 0, TAU); g.fill(); }
    }
    g.globalAlpha = 1;

    // 3) 窓の中へ落ちる、やわらかい影
    const sh = g.createLinearGradient(0, Hb, 0, Hb + Hb * .7);
    sh.addColorStop(0, 'rgba(0,0,0,.5)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh; g.fillRect(0, Hb, W, Hb * .7);

    // 4) 金の線：外側の細い線／窓との境目の太い線と細い線
    g.strokeStyle = metal(g, 0, W, gold);
    g.lineWidth = lw1; g.beginPath(); g.moveTo(0, lw1); g.lineTo(W, lw1); g.stroke();
    const thick = Math.max(2, Hb * .1);
    g.lineWidth = thick; g.beginPath(); g.moveTo(0, Hb - thick / 2); g.lineTo(W, Hb - thick / 2); g.stroke();
    g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,.55)';
    g.beginPath(); g.moveTo(0, Hb - thick + .5); g.lineTo(W, Hb - thick + .5); g.stroke();
    g.lineWidth = lw1; g.strokeStyle = metal(g, 0, W, gold);
    const y2 = Hb - thick - Hb * .09;
    g.beginPath(); g.moveTo(0, y2); g.lineTo(W, y2); g.stroke();

    // 5) 両端の「凹んだ丸い角」：四分円の黒い板に金のふち
    const ear = flipX => {
      g.save();
      if (flipX) { g.translate(W, 0); g.scale(-1, 1); }
      const eg = g.createRadialGradient(0, Hb, 0, 0, Hb, er);
      eg.addColorStop(0, '#030201'); eg.addColorStop(1, pal.edge);
      g.beginPath(); g.moveTo(0, Hb - 1); g.lineTo(er, Hb - 1); g.arc(0, Hb, er, 0, Math.PI / 2, false); g.lineTo(0, Hb - 1); g.closePath();
      g.fillStyle = eg; g.fill();
      g.strokeStyle = metal(g, 0, er * 2, gold); g.lineWidth = Math.max(2, Hb * .09);
      g.beginPath(); g.arc(0, Hb, er - g.lineWidth / 2, 0, Math.PI / 2, false); g.stroke();
      g.lineWidth = lw1; g.beginPath(); g.arc(0, Hb, er * .8, 0, Math.PI / 2, false); g.stroke();
      // 角の飾り（小さな丸）
      g.fillStyle = gold[0];
      g.beginPath(); g.arc(er * .5, Hb + er * .5, Math.max(1.5, Hb * .07), 0, TAU); g.fill();
      g.restore();
    };
    ear(false); ear(true);

    // 6) まん中の飾り：ひし形と、両側に並ぶ点
    const cx = W / 2, d = Hb * .34, yy = Hb - thick / 2;
    g.fillStyle = metal(g, cx - d * 3, cx + d * 3, gold);
    for (let k = 1; k <= 3; k++) {
      [-1, 1].forEach(sg => { g.beginPath(); g.arc(cx + sg * (d * 1.8 + k * d * .85), yy, Math.max(1.3, d * (.3 - k * .05)), 0, TAU); g.fill(); });
    }
    g.beginPath(); g.moveTo(cx - d * 1.6, yy); g.lineTo(cx, yy - d * 1.05); g.lineTo(cx + d * 1.6, yy); g.lineTo(cx, yy + d * 1.2); g.closePath();
    g.fillStyle = metal(g, cx - d * 1.6, cx + d * 1.6, gold); g.fill();
    g.lineWidth = Math.max(1, d * .14); g.strokeStyle = pal.edge; g.stroke();
    g.beginPath(); g.arc(cx, yy, d * .26, 0, TAU); g.fillStyle = pal.edge; g.fill();
    return cv;
  }

  // ── 壁紙：縞模様＋大きなレース模様＋周りが暗いビネット ──
  function paintWall(W, H, pal, dpr) {
    const { cv, g } = mkCanvas(W, H, dpr);
    if (!g) return cv;
    const w = pal.wall;
    const cx = W * .42, cy = H * .5;
    const rg = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * .78);
    rg.addColorStop(0, w[2]); rg.addColorStop(.45, w[1]); rg.addColorStop(1, w[0]);
    g.fillStyle = rg; g.fillRect(0, 0, W, H);

    const sw = Math.max(10, W * .052);
    for (let i = 0, x = 0; x < W; i++, x += sw) {
      g.fillStyle = i % 2 ? 'rgba(255,245,200,.08)' : 'rgba(0,0,0,.11)';
      g.fillRect(x, 0, sw, H);
    }

    const doily = (px, py, R, a) => {
      g.save(); g.translate(px, py);
      const col = 'rgba(255,240,190,' + a + ')';
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = Math.max(1, R * .014);
      [1, .86, .64, .42, .2].forEach(k => { g.beginPath(); g.arc(0, 0, R * k, 0, TAU); g.stroke(); });
      for (let i = 0; i < 30; i++) {   // ふちのまるい飾り
        const ang = (i + .5) / 30 * TAU;
        g.beginPath(); g.arc(Math.cos(ang) * R * .93, Math.sin(ang) * R * .93, R * .042, 0, TAU); g.stroke();
      }
      for (let i = 0; i < 12; i++) {   // 花びら
        g.save(); g.rotate(i / 12 * TAU);
        g.beginPath(); g.ellipse(R * .42, 0, R * .2, R * .052, 0, 0, TAU); g.stroke();
        g.beginPath(); g.arc(R * .75, 0, R * .022, 0, TAU); g.fill();
        g.restore();
      }
      g.restore();
    };
    doily(W * .13, H * .82, H * .66, .14);
    doily(W * .55, H * .02, H * .62, .11);
    doily(W * .92, H * .74, H * .72, .14);

    // 金のちり
    for (let i = 0; i < 46; i++) {
      g.fillStyle = 'rgba(255,248,200,' + rnd(.12, .4).toFixed(2) + ')';
      g.beginPath(); g.arc(rnd(0, W), rnd(0, H), rnd(.6, 1.7), 0, TAU); g.fill();
    }

    // まわりを暗く（だ円）
    g.save(); g.translate(W / 2, H / 2); g.scale(W / H, 1);
    const vg = g.createRadialGradient(0, 0, H * .42, 0, 0, H * 1.0);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.66)');
    g.fillStyle = vg; g.fillRect(-W, -H, W * 2, H * 2);
    g.restore();
    // 帯に近い上下も少し暗く
    const tb = g.createLinearGradient(0, 0, 0, H);
    tb.addColorStop(0, 'rgba(0,0,0,.45)'); tb.addColorStop(.16, 'rgba(0,0,0,0)'); tb.addColorStop(.84, 'rgba(0,0,0,0)'); tb.addColorStop(1, 'rgba(0,0,0,.45)');
    g.fillStyle = tb; g.fillRect(0, 0, W, H);
    return cv;
  }

  // ── 金色の三日月の斬撃 ──
  //   p0・p1＝両端の点 / c1＝外側のふくらみ / c2＝内側のふくらみ（c1より小さいほど太い）。ふくらむ向きは「p0→p1 の左手前」
  function crescentPath(g, p0, p1, c1, c2) {
    const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
    let nx = p1[1] - p0[1], ny = -(p1[0] - p0[0]);
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    g.beginPath(); g.moveTo(p0[0], p0[1]);
    g.quadraticCurveTo(mx + nx * c1, my + ny * c1, p1[0], p1[1]);
    g.quadraticCurveTo(mx + nx * c2, my + ny * c2, p0[0], p0[1]);
    g.closePath();
    return { mx, my, nx, ny };
  }
  function paintCrescent(g, p0, p1, c1, c2, pal, glowPx) {
    const m = crescentPath(g, p0, p1, c1, c2);
    const gr = g.createLinearGradient(m.mx + m.nx * c1 / 2, m.my + m.ny * c1 / 2, m.mx + m.nx * c2 / 2, m.my + m.ny * c2 / 2);
    gr.addColorStop(0, pal.slash[2]); gr.addColorStop(.38, pal.slash[1]); gr.addColorStop(1, pal.slash[0]);
    g.save(); g.shadowColor = pal.trail; g.shadowBlur = glowPx; g.fillStyle = gr; g.fill(); g.restore();
  }
  // 後ろ側（尾の線＋大きな三日月）
  function paintSlashBack(W, H, pal, dpr) {
    const { cv, g } = mkCanvas(W, H, dpr);
    if (!g) return cv;
    g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {   // 流れる尾
      const wide = i < 2;
      const x0 = W * rnd(.4, .78), y0 = H * rnd(.75, 1.05), x1 = W * rnd(.98, 1.18), y1 = H * rnd(-.15, .3);
      const gr = g.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, rgba(pal.trail, 0)); gr.addColorStop(.5, rgba(pal.trail, wide ? .2 : .72)); gr.addColorStop(1, rgba(pal.trail, 0));
      g.strokeStyle = gr; g.lineWidth = wide ? H * rnd(.06, .1) : rnd(1.5, 4.5);
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(W * rnd(.72, 1.0), H * rnd(.2, .65), x1, y1); g.stroke();
    }
    paintCrescent(g, [W * .56, H * 1.04], [W * .98, H * .12], H * .56, H * .34, pal, H * .07);
    paintCrescent(g, [W * .74, H * 1.0], [W * 1.02, H * .46], H * .3, H * .17, pal, H * .045);
    return cv;
  }
  // 手前側（小さな三日月＋きらきら）
  function paintSlashFront(W, H, pal, dpr) {
    const { cv, g } = mkCanvas(W, H, dpr);
    if (!g) return cv;
    paintCrescent(g, [W * .03, H * .12], [W * .05, H * .88], -H * .2, -H * .12, pal, H * .035);
    paintCrescent(g, [W * .2, H * .035], [W * .5, H * -.02], H * .1, H * .035, pal, H * .04);
    paintCrescent(g, [W * .96, H * .98], [W * 1.02, H * .62], H * .14, H * .05, pal, H * .04);
    g.save(); g.shadowColor = pal.trail; g.shadowBlur = 8;
    [[.9, .2, .05], [.7, .62, .035], [.16, .24, .04], [.5, .88, .03], [.97, .45, .03], [.08, .66, .028]].forEach(p => {
      sparklePath(g, W * p[0], H * p[1], H * p[2] * 1.9, .22);
      g.fillStyle = '#fff'; g.fill();
    });
    g.restore();
    return cv;
  }

  // ── キャラのふちどり（暗い細ぶち＋属性色のうっすらした光）──
  function paintSticker(im, w, h, pal, dpr) {
    const maxSide = 1100;
    let k = dpr;
    if (Math.max(w, h) * k > maxSide) k = maxSide / Math.max(w, h);
    const pad = Math.ceil(Math.max(w, h) * .03);
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round((w + pad * 2) * k)); cv.height = Math.max(1, Math.round((h + pad * 2) * k));
    const g = cv.getContext('2d');
    if (!g) return { cv, pad };
    try {
      const sil = document.createElement('canvas');
      sil.width = cv.width; sil.height = cv.height;
      const s = sil.getContext('2d');
      s.drawImage(im, pad * k, pad * k, w * k, h * k);
      s.globalCompositeOperation = 'source-in'; s.fillStyle = '#fff'; s.fillRect(0, 0, sil.width, sil.height);
      const ring = (r, tint) => {
        const t = document.createElement('canvas'); t.width = sil.width; t.height = sil.height;
        const tg = t.getContext('2d');
        tg.drawImage(sil, 0, 0);
        tg.globalCompositeOperation = 'source-in'; tg.fillStyle = tint; tg.fillRect(0, 0, t.width, t.height);
        const n = 18;
        for (let i = 0; i < n; i++) { const a = i / n * TAU; g.drawImage(t, Math.cos(a) * r * k, Math.sin(a) * r * k); }
      };
      g.globalAlpha = .5; ring(pad * .95, pal.glow); g.globalAlpha = 1;
      g.globalAlpha = .9; ring(pad * .38, pal.edge); g.globalAlpha = 1;
    } catch (e) { /* 読めなければふちなし */ }
    return { cv, pad };
  }

  // ── スキル名：長くても収める（縮小 → 2行 → 横に潰す）──
  const NO_HEAD = /^[ーッャュョァィゥェォっゃゅょぁぃぅぇぉ゛゜、。，．」』）!！?？…・]/;
  function planName(name, W, H) {
    const meas = document.createElement('canvas').getContext('2d');
    const U = 100;
    meas.font = '900 ' + U + 'px ' + FONT;
    const GAP = .05;
    const unit = s => {
      let w = 0; const a = Array.from(s);
      a.forEach((c, i) => { w += meas.measureText(c).width / U + (i ? GAP : 0); });
      return w;
    };
    const chars = Array.from(name);
    const areaW = W * NAME_AREA_W, EXTRA = .7;   // 太いフチぶんの余白（文字サイズ比）
    const u1 = unit(name);
    const fs1 = Math.min(NAME_ONE_MAX * H, areaW / (u1 + EXTRA));
    if (fs1 >= NAME_ONE_MIN * H || chars.length < 3) return { lines: [name], units: [u1], fs: fs1, sx: 1 };
    let best = null;
    const mid = chars.length / 2;
    for (let i = 1; i < chars.length; i++) {
      if (NO_HEAD.test(chars[i])) continue;
      const a = chars.slice(0, i).join(''), b = chars.slice(i).join('');
      const ua = unit(a), ub = unit(b);
      let score = Math.max(ua, ub) + Math.abs(i - mid) * .02;
      if (/[ 　・、]/.test(chars[i - 1])) score -= .35;
      const kind = c => /[ァ-ヺー]/.test(c) ? 'k' : /[ぁ-ゟ]/.test(c) ? 'h' : /[一-龥々]/.test(c) ? 'j' : /[A-Za-z0-9]/.test(c) ? 'a' : 'o';
      const k0 = kind(chars[i - 1]), k1 = kind(chars[i]);
      if (k0 === k1 && (k0 === 'k' || k0 === 'a')) score += 1.6;
      else if (k0 !== k1 && k0 !== 'o' && k1 !== 'o') score -= .25;
      if (!best || score < best.score) best = { score, lines: [a.replace(/[ 　]+$/, ''), b.replace(/^[ 　]+/, '')], units: [ua, ub] };
    }
    if (!best) return { lines: [name], units: [u1], fs: Math.max(fs1, 8), sx: 1 };
    const uMax = Math.max(best.units[0], best.units[1]);
    let fs2 = Math.min(NAME_TWO_MAX * H, areaW / (uMax + EXTRA)), sx = 1;
    if (fs2 < NAME_TWO_MIN * H) {
      fs2 = NAME_TWO_MIN * H;
      sx = clamp(areaW / (fs2 * (uMax + EXTRA)), .45, 1);
    }
    return { lines: best.lines, units: best.units, fs: fs2, sx };
  }

  // 1行ぶんの文字を canvas に描く（濃い外ぶち → 金のふち → 細い濃い線 → 明るい文字グラデ → つや）
  function paintNameLine(line, unitW, fs, sx, pal, dpr) {
    const pad = fs * .5;
    const w = unitW * fs * sx + pad * 2 + fs * .2, h = fs * 1.55;
    const { cv, g } = mkCanvas(w, h, dpr);
    if (!g) return { cv, w, h };
    g.font = '900 ' + fs + 'px ' + FONT;
    g.textBaseline = 'middle'; g.textAlign = 'left'; g.lineJoin = 'round'; g.miterLimit = 2;
    g.translate(pad, h * .5);
    g.transform(sx, 0, 0, 1, 0, 0);
    const chars = Array.from(line);
    const xs = []; let x = 0;
    chars.forEach(c => { xs.push(x); x += g.measureText(c).width + fs * .05; });
    const each = fn => chars.forEach((c, i) => { if (c.trim()) fn(c, xs[i]); });
    g.save(); g.shadowColor = pal.trail; g.shadowBlur = fs * .45;
    g.lineWidth = fs * .36; g.strokeStyle = pal.edge;
    each((c, px) => g.strokeText(c, px, 0));                                 // 濃い外ぶち（光をまとう）
    g.restore();
    g.lineWidth = fs * .36; g.strokeStyle = pal.edge;
    each((c, px) => g.strokeText(c, px, 0));
    g.lineWidth = fs * .2; g.strokeStyle = metal(g, 0, w, pal.gold);
    each((c, px) => g.strokeText(c, px, 0));                                 // 金のふち
    g.lineWidth = fs * .06; g.strokeStyle = pal.edge;
    each((c, px) => g.strokeText(c, px, 0));                                 // 金のふちの内側の細い線
    const gr = g.createLinearGradient(0, -fs * .5, 0, fs * .5);
    gr.addColorStop(0, pal.txt[0]); gr.addColorStop(.55, pal.txt[1]); gr.addColorStop(1, pal.txt[2]);
    g.fillStyle = gr;
    each((c, px) => g.fillText(c, px, 0));                                   // 文字
    g.save(); g.beginPath(); g.rect(-pad, -fs * .62, w + pad, fs * .48); g.clip();
    g.globalAlpha = .5; g.fillStyle = '#fff';
    each((c, px) => g.fillText(c, px, 0));                                   // 上半分に白いつや
    g.restore();
    return { cv, w, h };
  }
  // 文字の下の飾り線（金の線＋まん中のひし形。両端はすっと消える）
  function paintFlourish(w, fs, pal, dpr) {
    const h = Math.max(8, fs * .3);
    const { cv, g } = mkCanvas(w, h, dpr);
    if (!g) return { cv, w, h };
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, rgba(pal.gold[1], 0)); gr.addColorStop(.35, pal.gold[0]); gr.addColorStop(.5, pal.gold[1]); gr.addColorStop(.65, pal.gold[0]); gr.addColorStop(1, rgba(pal.gold[1], 0));
    g.strokeStyle = gr; g.lineWidth = Math.max(1, fs * .045);
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    const d = h * .36;
    g.beginPath(); g.moveTo(w * .5 - d * 1.5, h / 2); g.lineTo(w * .5, h / 2 - d); g.lineTo(w * .5 + d * 1.5, h / 2); g.lineTo(w * .5, h / 2 + d); g.closePath();
    g.fillStyle = pal.gold[0]; g.fill(); g.lineWidth = 1; g.strokeStyle = pal.edge; g.stroke();
    return { cv, w, h };
  }

  // 絵の置き場所（窓の中での位置と大きさ）
  function layoutArt(info, face, W, H) {
    const nw = info.nw, nh = info.nh;
    if (face) {   // 縦長：顔をアップ
      const sc = (FACE_HEAD * H) / face.headH, fw = nw * sc, fh = nh * sc;
      return { left: W * FACE_X - face.fx * fw, top: H * FACE_Y - face.fy * fh, w: fw, h: fh, ox: face.fx * 100, oy: face.fy * 100 };
    }
    const bw = info.bw || nw, bh = info.bh || nh, bx0 = info.bx0 || 0, by0 = info.by0 || 0;
    const sc = Math.min(1.12 * H / bh, .66 * W / bw), fw = nw * sc, fh = nh * sc, vis = bh * sc;
    const top = (vis > H * .95 ? H * .045 : (H - vis) * .45) - by0 * sc;   // 窓より大きい時は、頭を残して足もとを切る
    return { left: W * .36 - (bx0 + bw / 2) * sc, top, w: fw, h: fh, ox: (bx0 + bw / 2) / nw * 100, oy: (by0 + bh * .5) / nh * 100 };
  }

  function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

  function run(o, onDone) {
    const host = o.host, W = o.W, DH = o.DH, T = o.T, IOS = !!o.IOS;
    const pal = PAL[o.theme] || PAL.light;
    const dpr = Math.min(IOS ? 2 : 2.5, Math.max(1, window.devicePixelRatio || 1));

    // 大きさ：窓（Hw）と、その上下にぴったり付くレース帯（Hb）。全体が画面に収まるようにする
    const Hb = Math.max(14, Math.round(W * BAND_H));
    let Hw = Math.round(W * WIN_H);
    if (Hw + 2 * Hb > DH * TOTAL_MAX) Hw = Math.max(60, Math.round(DH * TOTAL_MAX - 2 * Hb));
    const er = Math.round(Hb * 1.15);
    const hHalf = Hw / 2;
    let stageTop = Math.round(DH * CENTER_Y - hHalf);
    stageTop = Math.min(stageTop, DH - Hw - Hb - 2);
    stageTop = Math.max(stageTop, Hb + 2);

    // 時刻（ミリ秒）
    const tLine = LINE_MS, tOpen = tLine + OPEN_MS;
    const tSlash = tLine + 140, tChar = tLine + 220;
    const tName = tLine + OPEN_MS * .9 + 120;
    const total = Math.max(T, tName + 1300 + OUT_MS);
    const f = ms => clamp(ms / total, 0, 1);
    const fOut = f(total - OUT_MS);

    const root = el('div', 'cvl-root');
    const dim = el('div', 'cvl-dim');
    root.appendChild(dim);

    // ── 窓：真ん中から上下へ開く「ただの四角（overflow:hidden）」1枚。中身は逆向きに動かして、絵が動かないようにする ──
    const stage = el('div', 'cvl-stage');
    stage.style.cssText = 'top:' + stageTop + 'px;height:' + Hw + 'px;';
    const win = el('div', 'cvl-win');
    win.style.cssText = 'top:' + hHalf + 'px;height:0px;';
    const inner = el('div', 'cvl-win-in');
    inner.style.cssText = 'top:' + (-hHalf) + 'px;height:' + Hw + 'px;';
    win.appendChild(inner);
    stage.appendChild(win);
    root.appendChild(stage);

    // 窓の中身：壁紙 → 斬撃（奥）→ キャラ → 斬撃（手前）→ 光の筋 → きらきら → スキル名
    const stack = el('div', 'cvl-stack');
    const wall = paintWall(W, Hw, pal, dpr); wall.className = 'cvl-wall';
    const slB = paintSlashBack(W, Hw, pal, dpr); slB.className = 'cvl-slash';
    const slF = paintSlashFront(W, Hw, pal, dpr); slF.className = 'cvl-slash';
    stack.appendChild(wall); stack.appendChild(slB);

    const info = o.info, L = layoutArt(info, o.face, W, Hw);
    const stk = paintSticker(info.im, L.w, L.h, pal, dpr);
    const art = el('div', 'cvl-art');
    art.style.cssText = 'left:' + L.left + 'px;top:' + L.top + 'px;width:' + L.w + 'px;height:' + L.h + 'px;transform-origin:' + L.ox + '% ' + L.oy + '%;';
    stk.cv.className = 'cvl-sticker';
    stk.cv.style.cssText = 'left:' + (-stk.pad) + 'px;top:' + (-stk.pad) + 'px;width:' + (L.w + stk.pad * 2) + 'px;height:' + (L.h + stk.pad * 2) + 'px;';
    const mon = el('img', 'cvl-mon');
    mon.alt = ''; mon.draggable = false; mon.src = info.url;
    art.append(stk.cv, mon);
    stack.appendChild(art);
    stack.appendChild(slF);

    const glint = el('div', 'cvl-glint');
    glint.style.cssText = 'width:' + Math.round(W * .16) + 'px;';
    stack.appendChild(glint);

    const twinkles = [];
    const TN = IOS ? 6 : 12;
    for (let i = 0; i < TN; i++) {
      const s = el('i', 'cvl-tw'), z = rnd(8, 18);
      s.style.cssText = 'left:' + rnd(2, 96).toFixed(1) + '%;top:' + rnd(6, 88).toFixed(1) + '%;width:' + z.toFixed(1) + 'px;height:' + z.toFixed(1) + 'px;opacity:0;';
      stack.appendChild(s); twinkles.push(s);
    }

    // スキル名（右下）。文字の後ろに、うっすら暗い板を敷いて読みやすくする
    const ordered = [];
    let plate = null;
    if (SHOW_NAME && o.name) {
      const plan = planName(o.name, W, Hw);
      const lineH = plan.fs * 1.12;
      const blockH = plan.lines.length * lineH;
      const bottomGap = Math.max(10, Hw * .1);
      const nameRight = Math.round(W * .035);
      const flW = Math.min(W * NAME_AREA_W, Math.max.apply(null, plan.units) * plan.fs * plan.sx + plan.fs * 1.2);
      const fl = paintFlourish(flW, plan.fs, pal, dpr);
      const flTop = Math.round(Hw - bottomGap - fl.h * .5);
      const blockBottom = flTop - plan.fs * .02;
      const blockTop = Math.max(Hw * .22, blockBottom - blockH);
      plate = el('div', 'cvl-plate');
      const plateH = Math.round(Math.min(Hw, blockH + plan.fs * 1.6 + bottomGap));
      plate.style.cssText = 'height:' + plateH + 'px;width:' + Math.round(W * .8) + 'px;';
      stack.appendChild(plate);
      plan.lines.forEach((ln, i) => {
        const p = paintNameLine(ln, plan.units[i], plan.fs, plan.sx, pal, dpr);
        const w = el('div', 'cvl-line');
        w.style.cssText = 'right:' + nameRight + 'px;top:' + Math.round(blockTop + i * lineH - (p.h - plan.fs) / 2) + 'px;width:' + p.w + 'px;height:' + p.h + 'px;transform-origin:100% 55%;';
        p.cv.className = 'cvl-line-cv'; w.appendChild(p.cv);
        ordered.push(w);
      });
      const flEl = el('div', 'cvl-line');
      flEl.style.cssText = 'right:' + (nameRight + Math.round(plan.fs * .1)) + 'px;top:' + flTop + 'px;width:' + fl.w + 'px;height:' + fl.h + 'px;transform-origin:100% 50%;';
      fl.cv.className = 'cvl-line-cv'; flEl.appendChild(fl.cv);
      ordered.push(flEl);
      ordered.forEach(e => stack.appendChild(e));
    }

    inner.appendChild(stack);

    // ── レース帯：窓の上端・下端に張りつく（窓の外側なので、別の入れ物）。最初は真ん中の細い帯が左右へ伸びる ──
    const bands = el('div', 'cvl-bands');
    bands.style.cssText = 'top:' + stageTop + 'px;height:' + Hw + 'px;opacity:0;';
    const topBox = el('div', 'cvl-bandbox'); topBox.style.top = '0px';
    const botBox = el('div', 'cvl-bandbox'); botBox.style.top = Hw + 'px';
    const bTop = paintBand(W, Hb, er, pal, dpr, false); bTop.className = 'cvl-band';
    bTop.style.cssText = 'left:0;top:' + (-Hb) + 'px;width:' + W + 'px;height:' + (Hb + er) + 'px;';
    const bBot = paintBand(W, Hb, er, pal, dpr, true); bBot.className = 'cvl-band';
    bBot.style.cssText = 'left:0;top:' + (-er) + 'px;width:' + W + 'px;height:' + (Hb + er) + 'px;';
    topBox.appendChild(bTop); botBox.appendChild(bBot);
    bands.append(topBox, botBox);
    root.appendChild(bands);

    // 斬撃が走る瞬間の光
    const flash = el('div', 'cvl-flash');
    flash.style.cssText = 'top:' + stageTop + 'px;height:' + Hw + 'px;background:radial-gradient(ellipse at 50% 50%,#fff 0%,' + pal.glow + ' 50%,rgba(255,255,255,0) 100%);';
    root.appendChild(flash);

    host.appendChild(root);

    // ── 動き ──
    let done = false, timer = 0;
    const finish = () => {
      if (done) return; done = true;
      clearTimeout(timer);
      root.remove();
      try { onDone && onDone(); } catch (e) {}
    };
    timer = setTimeout(finish, total);
    if (!root.animate) return finish;   // 古い環境：アニメ無しで時間だけ待つ

    const A = (e, kf, opt) => { try { return e.animate(kf, Object.assign({ fill: 'both' }, opt)); } catch (er) { return null; } };
    const OPEN_EASE = 'cubic-bezier(.2,.9,.25,1)', CLOSE_EASE = 'cubic-bezier(.6,0,.9,.5)';

    // 暗転
    A(dim, [{ opacity: 0 }, { opacity: 1, offset: f(260) }, { opacity: 1, offset: fOut }, { opacity: 0 }], { duration: total });

    // 窓の開き方：細い線 → 窓の高さ → すっと閉じる。窓の top・height と、中身の top を同じ時刻・同じ動きで変える（中身は動かない）
    const openPx = [0, 0, hHalf, hHalf, 0];
    const openAt = [0, f(tLine), f(tOpen), fOut, 1];
    const seg = ['ease-out', OPEN_EASE, 'linear', CLOSE_EASE, 'linear'];
    A(win,   openPx.map((v, i) => ({ top: (hHalf - v) + 'px', height: (2 * v) + 'px', offset: openAt[i], easing: seg[i] })), { duration: total });
    A(inner, openPx.map((v, i) => ({ top: (-(hHalf - v)) + 'px', offset: openAt[i], easing: seg[i] })), { duration: total });
    // 帯：窓の上端・下端に張りつく
    A(topBox, openPx.map((v, i) => ({ transform: 'translateY(' + (hHalf - v) + 'px)', offset: openAt[i], easing: seg[i] })), { duration: total });
    A(botBox, openPx.map((v, i) => ({ transform: 'translateY(' + (-(hHalf - v)) + 'px)', offset: openAt[i], easing: seg[i] })), { duration: total });
    // 帯全体：真ん中の細い線として左右へ伸びる ／ 最後にすっと消える
    A(bands, [
      { opacity: 0, transform: 'scaleX(.04)' },
      { opacity: 1, transform: 'scaleX(1)', offset: f(tLine), easing: 'cubic-bezier(.15,.85,.25,1)' },
      { opacity: 1, transform: 'scaleX(1)', offset: f(total - 110) },
      { opacity: 0, transform: 'scaleX(1)' }
    ], { duration: total });

    // 壁紙：少し大きい所からゆっくり寄っていく
    A(wall, [
      { transform: 'scale(1.16)' }, { transform: 'scale(1.16)', offset: f(tLine) },
      { transform: 'scale(1.04)', offset: f(tOpen + 500), easing: 'ease-out' }, { transform: 'scale(1.07)' }
    ], { duration: total });

    // 斬撃（奥の大きな三日月＋尾）：左から走り抜けて、すっと消える
    A(slB, [
      { opacity: 0, transform: 'translateX(-30%) scale(.9) rotate(-4deg)' },
      { opacity: 0, transform: 'translateX(-30%) scale(.9) rotate(-4deg)', offset: f(tSlash) },
      { opacity: 1, transform: 'translateX(4%) scale(1.03) rotate(0deg)', offset: f(tSlash + 240), easing: 'cubic-bezier(.1,.8,.2,1)' },
      { opacity: .9, transform: 'translateX(9%) scale(1.06) rotate(0deg)', offset: f(tSlash + 600) },
      { opacity: 0, transform: 'translateX(24%) scale(1.12) rotate(0deg)', offset: f(tSlash + 1150) },
      { opacity: 0 }
    ], { duration: total });
    // 斬撃（手前の小さな三日月＋きらきら）：少し遅れて入り、名前が入る時にもう一度ぱっと光る
    A(slF, [
      { opacity: 0, transform: 'translateX(-14%) scale(.94)' },
      { opacity: 0, transform: 'translateX(-14%) scale(.94)', offset: f(tSlash + 110) },
      { opacity: 1, transform: 'translateX(0) scale(1)', offset: f(tSlash + 420), easing: 'cubic-bezier(.1,.8,.2,1)' },
      { opacity: .6, transform: 'translateX(1%) scale(1.01)', offset: f(tName - 40) },
      { opacity: 1, transform: 'translateX(1%) scale(1.07)', offset: f(tName + 140), easing: 'ease-out' },
      { opacity: .55, transform: 'translateX(2%) scale(1.03)', offset: f(tName + 700) },
      { opacity: .55, transform: 'translateX(3%) scale(1.03)' }
    ], { duration: total });
    // 光の筋：斜めに画面を横切る
    A(glint, [
      { opacity: 0, transform: 'translateX(' + (-W * .3) + 'px) rotate(18deg)' },
      { opacity: 0, transform: 'translateX(' + (-W * .3) + 'px) rotate(18deg)', offset: f(tSlash) },
      { opacity: .85, offset: f(tSlash + 120) },
      { opacity: 0, transform: 'translateX(' + (W * 1.15) + 'px) rotate(18deg)', offset: f(tSlash + 520) },
      { opacity: 0 }
    ], { duration: total });

    // キャラ：左からスッと入って、ゆっくり寄っていく
    A(art, [
      { opacity: 0, transform: 'translateX(-14%) scale(.94)' },
      { opacity: 0, transform: 'translateX(-14%) scale(.94)', offset: f(tChar) },
      { opacity: 1, transform: 'translateX(1.5%) scale(1.03)', offset: f(tChar + 380), easing: 'cubic-bezier(.15,.9,.25,1)' },
      { opacity: 1, transform: 'translateX(0) scale(1)', offset: f(tChar + 580) },
      { opacity: 1, transform: 'translateX(0) scale(1.045)' }
    ], { duration: total });

    // きらきら
    twinkles.forEach(tw => {
      A(tw, [
        { opacity: 0, transform: 'scale(.3) rotate(0deg)' },
        { opacity: 1, transform: 'scale(1) rotate(45deg)', offset: .5 },
        { opacity: 0, transform: 'scale(.3) rotate(90deg)' }
      ], { duration: rnd(650, 1200), delay: rnd(tChar + 150, tChar + 1100), iterations: 3 });
    });

    // スキル名：右から「スッ」と入る
    if (plate) A(plate, [{ opacity: 0 }, { opacity: 1 }], { duration: 360, delay: tName - 60, easing: 'ease-out' });
    ordered.forEach((ln, i) => {
      A(ln, [
        { opacity: 0, transform: 'translateX(' + (W * .22) + 'px) scale(1.4,.8)' },
        { opacity: 1, transform: 'translateX(-1.5%) scale(.97,1.05)', offset: .55, easing: 'ease-out' },
        { opacity: 1, transform: 'translateX(0) scale(1,1)' }
      ], { duration: 420, delay: tName + i * 90, easing: 'cubic-bezier(.2,.8,.3,1)' });
    });

    // 斬撃が走る瞬間の光
    A(flash, [
      { opacity: 0 }, { opacity: 0, offset: f(tSlash + 20) },
      { opacity: .7, offset: f(tSlash + 110) },
      { opacity: 0, offset: f(tSlash + 480) }, { opacity: 0 }
    ], { duration: total });

    // 名前が入った瞬間に、画面をやさしく揺らす
    const shake = typeof o.shake === 'function' ? o.shake : null;
    if (shake) setTimeout(() => { if (!done) { try { shake(6); } catch (e) {} } }, tName + 200);

    return finish;
  }

  window.CutInLace = { run, PAL, planName };
})();
