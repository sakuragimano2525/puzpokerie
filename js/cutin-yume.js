// ============================================================
// ★ ゆめかわふわカットイン（モンスターエディターで「ゆめかわふわカットイン」にチェックしたモンスター用）★
//
//   パズドラ本家のコラボ演出のような 2段構えのカットインを、ゆめかわ・ふわふわな見た目で出します。
//
//     ① 画面の真ん中に ★ の付いた2本線がスーッと左→右へ走り、上下にパカッと開いて「タイトルカード」が出る
//        （白＋パステルのきらきら背景に、オリジナルのロゴ「ゆめかわ ふわふわ」）
//     ② ちょっとあとに、タイトルカードの枠が上下へ大きく広がり（盤面に少しはみ出す）、
//        モンスター（mp{ID}.png）が、属性色のゆめかわ背景（雲・星・ハート・きらきら）の中に登場
//     ③ スキル名が、白フチ＋ピンクのフチのふわふわ文字で「ぽよん」と入る
//     ④ すっと閉じて終わり
//
//   ・背景の色は属性で変わります：火＝コーラルピンク / 水＝そらいろ / 木＝ミントグリーン / 光＝レモンイエロー / 闇＝ラベンダー
//   ・軽量化：背景・雲・文字・キャラのふちどりは、最初に canvas へ1回だけ描き、あとは位置・透明度・大きさだけを動かします
//     （動いているものに filter / clip-path / blur は使いません。iPhone でも落ちにくい作りです）
//   ・スキル名が長くても、①縮める ②2行にする ③横に潰す、の順で必ず収めます。
//
//   ※ js/cutin.js から呼ばれます。単体では何もしません。
//       CutInYume.run({ host, W, DH, anchor, T, theme, name, label, info, face, IOS, shake }, onDone) → 途中で止める関数
//         anchor＝{ top, bottom, board }：敵エリアの上端・下端と盤面の上端（host の中での位置）。あれば、2枚目の段の下端が盤面の一番上に少しかかる
// ============================================================
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const FONT = "'Hiragino Maru Gothic ProN','Hiragino Sans','Zen Maru Gothic','M PLUS Rounded 1c','Yu Gothic','Noto Sans JP','Noto Sans CJK JP',sans-serif";

  // ── 調整用の数字 ──────────────────────────────
  const OUT_MS      = 300;    // 閉じる時間
  const LINE_MS     = 380;    // ★の線が左→右へ走る時間
  const OPEN1_MS    = 300;    // タイトルカードが上下に開く時間
  const CARD_HOLD   = 650;    // タイトルカードを見せている時間（開ききってから）
  const OPEN2_MS    = 380;    // 枠が上下へ大きく広がる時間
  const CARD_H      = 0.27;   // タイトルカードの高さ（画面幅に対する割合）
  const STAGE_H     = 0.74;   // モンスターの段の高さ（画面幅に対する割合。縦に入りきらない時は縮める）
  const OVERSHOOT   = 0.10;   // 盤面の位置が分からない時：段の下端を、敵エリアの下端より「段の高さの何割」下へはみ出させるか（縦画面）
  const BOARD_OVER  = 0.08;   // 盤面の位置が分かる時：段の下端を、盤面の上端より「段の高さの何割」盤面側へかぶせるか（縦画面）
  const STAGE_MAX   = 0.80;   // モンスターの段の高さの上限（見えている画面の高さに対する割合）
  const CENTER_Y    = 0.46;   // 段の真ん中の縦位置（画面の高さに対する割合）
  const FACE_HEAD   = 0.30;   // 縦長キャラ：頭の高さ（段の高さに対する割合）
  const FACE_X      = 0.32;   // 縦長キャラ：顔を置く横位置（画面幅に対する割合）
  const FACE_Y      = 0.42;   // 縦長キャラ：顔を置く縦位置（段の高さに対する割合）
  const NAME_ONE_MAX = 0.17;  // スキル名（1行）の最大の大きさ（段の高さに対する割合）
  const NAME_ONE_MIN = 0.12;  // これより小さくなるなら2行にする
  const NAME_TWO_MAX = 0.15;  // スキル名（2行）の最大の大きさ
  const NAME_TWO_MIN = 0.09;  // これより小さくなるなら横に潰す
  const NAME_AREA_W  = 0.62;  // スキル名が使える横幅（画面幅に対する割合。右寄せ）

  // 属性ごとの色（ぜんぶパステル）
  //  bg＝背景のグラデ3色 / acc＝濃いめのアクセント（文字のフチ・星） / l1,l2＝枠の2本線 / glow＝光 / txt＝文字グラデ（上→下）/ star＝星の色たち
  const PAL = {
    fire:  { bg: ['#ffc2b8', '#ffdcb0', '#ff9fc2'], acc: '#ff6b8e', l1: '#ff7eaa', l2: '#ffc875', glow: '#fff0e0', txt: ['#ffffff', '#ffe3ea', '#ffb3c9'], star: ['#ff7eaa', '#ffc875', '#ffffff', '#ff9a8a'] },
    water: { bg: ['#b4e9ff', '#c8d4ff', '#9fe6ff'], acc: '#3fa9ff', l1: '#5cc3ff', l2: '#ff9fd0', glow: '#e8f8ff', txt: ['#ffffff', '#e0f3ff', '#a9dcff'], star: ['#5cc3ff', '#ff9fd0', '#ffffff', '#a8b8ff'] },
    wood:  { bg: ['#bff5b6', '#eafbb2', '#a4ecd2'], acc: '#33c26e', l1: '#58d68d', l2: '#ffb3d9', glow: '#f0ffe6', txt: ['#ffffff', '#e6ffe0', '#a9f0b4'], star: ['#58d68d', '#ffb3d9', '#ffffff', '#f6e87a'] },
    light: { bg: ['#fff4b0', '#ffe2f1', '#ffdc86'], acc: '#ffae00', l1: '#ffc83d', l2: '#ff9fd0', glow: '#fffbe0', txt: ['#ffffff', '#fff6c8', '#ffe084'], star: ['#ffc83d', '#ff9fd0', '#ffffff', '#b9ecff'] },
    dark:  { bg: ['#d8baff', '#ffc0ea', '#b2b0ff'], acc: '#9a4dff', l1: '#b07cff', l2: '#ff8fd0', glow: '#f6eaff', txt: ['#ffffff', '#f1e4ff', '#d3b6ff'], star: ['#b07cff', '#ff8fd0', '#ffffff', '#8fd6ff'] }
  };

  function mkCanvas(w, h, dpr) {
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(w * dpr)); cv.height = Math.max(1, Math.ceil(h * dpr));
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const g = cv.getContext('2d');
    if (g) g.scale(dpr, dpr);
    return { cv, g };
  }

  // ── 小さな図形（星・4つ角のきらきら・ハート・雲）──
  function starPath(g, x, y, R, r, rot) {   // 5つ角の星
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = rot + i * Math.PI / 5 - Math.PI / 2, d = i % 2 ? r : R;
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath();
  }
  function sparklePath(g, x, y, R, k) {   // 4つ角のきらきら（細い ✦）
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 - Math.PI / 2, d = i % 2 ? R * (k || .28) : R;
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath();
  }
  function heartPath(g, x, y, s) {   // ハート（幅≒2s）
    g.beginPath();
    g.moveTo(x, y + s * .9);
    g.bezierCurveTo(x - s * 2.1, y - s * .1, x - s * .9, y - s * 1.3, x, y - s * .38);
    g.bezierCurveTo(x + s * .9, y - s * 1.3, x + s * 2.1, y - s * .1, x, y + s * .9);
    g.closePath();
  }
  function cloud(g, x, y, s, col) {   // もこもこの雲（幅≒4s）
    g.fillStyle = col;
    g.beginPath();
    g.arc(x - s * 1.3, y, s * .78, 0, TAU);
    g.arc(x - s * .45, y - s * .5, s * .95, 0, TAU);
    g.arc(x + s * .55, y - s * .38, s * 1.05, 0, TAU);
    g.arc(x + s * 1.4, y + s * .02, s * .74, 0, TAU);
    g.rect(x - s * 1.3, y, s * 2.7, s * .78);
    g.fill();
  }

  // 星（フチつき）：白いフチ → 色。本家の「★の枠」の星
  function drawStar(g, x, y, R, col, rot) {
    g.save();
    g.lineJoin = 'round';
    starPath(g, x, y, R, R * .5, rot || 0);
    g.lineWidth = R * .34; g.strokeStyle = '#fff'; g.stroke();
    g.lineWidth = R * .1; g.strokeStyle = 'rgba(255,255,255,.0)';
    g.fillStyle = col; g.fill();
    starPath(g, x - R * .12, y - R * .16, R * .42, R * .2, rot || 0);   // つや
    g.fillStyle = 'rgba(255,255,255,.55)'; g.fill();
    g.restore();
  }

  // ── ① タイトルカードの絵（白＋パステルのきらきら＋ロゴ） ──
  function paintCard(W, H, pal, dpr) {
    const { cv, g } = mkCanvas(W, H, dpr);
    if (!g) return cv;
    // ふわっとした白→ピンク→空色のグラデ
    const gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(.35, '#fff1f8'); gr.addColorStop(.7, '#eaf6ff'); gr.addColorStop(1, '#f3ecff');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // ぼんやり丸いボケ
    const bokeh = ['rgba(255,182,213,.30)', 'rgba(160,220,255,.30)', 'rgba(210,190,255,.28)', 'rgba(255,240,170,.34)', 'rgba(180,245,215,.28)'];
    for (let i = 0; i < 14; i++) {
      const x = rnd(0, W), y = rnd(0, H), r = H * rnd(.1, .3);
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, bokeh[i % bokeh.length]); rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    // ひし形のきらきら模様（本家の白いカードの水色の星模様のかわり）
    const sp = ['#ffc3dc', '#bfe6ff', '#d9c8ff', '#fff0a6', '#c4f2dc'];
    const cols = Math.ceil(W / (H * .42)) + 1;
    for (let r = 0; r < 3; r++) for (let c = 0; c < cols; c++) {
      const x = c * H * .42 + (r % 2 ? H * .21 : 0), y = H * (.18 + r * .32);
      g.globalAlpha = .55; g.fillStyle = sp[(r + c) % sp.length];
      sparklePath(g, x, y, H * .09, .3); g.fill();
    }
    g.globalAlpha = 1;
    // ちらばる ✦ ♡ ★
    for (let i = 0; i < 22; i++) {
      const x = rnd(0, W), y = rnd(0, H), s = H * rnd(.025, .06), k = i % 3;
      g.fillStyle = sp[i % sp.length]; g.globalAlpha = rnd(.6, 1);
      if (k === 0) { sparklePath(g, x, y, s * 1.5, .3); g.fill(); }
      else if (k === 1) { heartPath(g, x, y, s); g.fill(); }
      else { starPath(g, x, y, s * 1.2, s * .6, rnd(0, 1)); g.fill(); }
    }
    g.globalAlpha = 1;
    // 下のふち：雲
    for (let i = 0; i < 9; i++) cloud(g, (i + .5) / 9 * W + rnd(-12, 12), H * 1.02, H * rnd(.12, .2), 'rgba(255,255,255,.95)');
    // ※ロゴ・サブタイトル文字は削除（背景のみ表示）
    return cv;
  }

  // ── ② モンスターの段の背景：属性色のゆめかわ背景（雲・星・ハート・きらきら）──
  function paintBack(W, H, pal, dpr) {
    const { cv, g } = mkCanvas(W, H, dpr);
    if (!g) return cv;
    const gr = g.createLinearGradient(0, 0, W * .8, H);
    gr.addColorStop(0, pal.bg[0]); gr.addColorStop(.52, pal.bg[1]); gr.addColorStop(1, pal.bg[2]);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // やわらかい光の玉
    const glowAt = (x, y, r, a) => {
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(255,255,255,' + a + ')'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    };
    glowAt(W * .62, H * .42, H * .75, .75);
    glowAt(W * .12, H * .15, H * .35, .5);
    glowAt(W * .95, H * .85, H * .4, .45);
    // 水玉もよう
    g.fillStyle = 'rgba(255,255,255,.22)';
    const pitch = H * .17;
    for (let r = 0; r * pitch < H + pitch; r++) for (let c = 0; c * pitch < W + pitch; c++) {
      g.beginPath(); g.arc(c * pitch + (r % 2 ? pitch / 2 : 0), r * pitch, pitch * .16, 0, TAU); g.fill();
    }
    // ふわふわの大きなリボン状の波（背景の奥ゆき）
    g.fillStyle = 'rgba(255,255,255,.28)';
    g.beginPath(); g.moveTo(0, H * .70);
    for (let x = 0; x <= W; x += W / 24) g.lineTo(x, H * .70 + Math.sin(x / W * 9) * H * .04);
    g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
    // ちらばる 星・ハート・きらきら
    for (let i = 0; i < 34; i++) {
      const x = rnd(0, W), y = rnd(0, H * .92), s = H * rnd(.022, .06), k = i % 4;
      g.globalAlpha = rnd(.65, 1);
      if (k === 0) { g.fillStyle = '#fff'; sparklePath(g, x, y, s * 1.7, .26); g.fill(); }
      else if (k === 1) { g.fillStyle = pal.star[i % pal.star.length]; heartPath(g, x, y, s * .9); g.fill(); }
      else if (k === 2) { g.fillStyle = pal.star[(i + 1) % pal.star.length]; starPath(g, x, y, s * 1.2, s * .6, rnd(-.4, .4)); g.fill(); }
      else { g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(x, y, s * .35, 0, TAU); g.fill(); }
    }
    g.globalAlpha = 1;
    // 下のふち：もこもこ雲を2段
    for (let i = 0; i < 11; i++) cloud(g, (i + .3) / 11 * W + rnd(-10, 10), H * 1.03, H * rnd(.12, .19), 'rgba(255,255,255,.62)');
    for (let i = 0; i < 9; i++) cloud(g, (i + .7) / 9 * W + rnd(-10, 10), H * 1.08, H * rnd(.13, .21), '#ffffff');
    // 上のふちにも小さな雲
    for (let i = 0; i < 6; i++) cloud(g, (i + .5) / 6 * W + rnd(-14, 14), -H * .02, H * rnd(.07, .11), 'rgba(255,255,255,.7)');
    return cv;
  }

  // ふわふわ流れる ✦（横長の canvas をゆっくり動かす）
  function paintDrift(W, H, pal, dpr) {
    const { cv, g } = mkCanvas(W * 1.4, H, dpr);
    if (!g) return cv;
    for (let i = 0; i < 26; i++) {
      const x = rnd(0, W * 1.4), y = rnd(0, H), s = H * rnd(.012, .035), k = i % 3;
      g.globalAlpha = rnd(.5, .95);
      if (k === 0) { g.fillStyle = '#fff'; sparklePath(g, x, y, s * 2, .28); g.fill(); }
      else if (k === 1) { g.fillStyle = pal.star[i % pal.star.length]; heartPath(g, x, y, s); g.fill(); }
      else { g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, s * .7, 0, TAU); g.fill(); }
    }
    return cv;
  }

  // ── 枠の2本線（本家の「ピンク＋水色の2本線」）＋ 星。幅 W・線の太さ th の横線1本分を描いた canvas ──
  function paintLine(W, th, pal, dpr) {
    const h = Math.ceil(th * 3.2);
    const { cv, g } = mkCanvas(W, h, dpr);
    if (!g) return { cv, h };
    const y0 = h / 2;
    // 外側のふわっとした光
    const gl = g.createLinearGradient(0, y0 - th * 1.5, 0, y0 + th * 1.5);
    gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(.5, 'rgba(255,255,255,.55)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl; g.fillRect(0, y0 - th * 1.5, W, th * 3);
    // 白フチ → 太いライン1 → 細いライン2
    g.fillStyle = '#fff'; g.fillRect(0, y0 - th * .95, W, th * 1.9);
    g.fillStyle = pal.l1; g.fillRect(0, y0 - th * .72, W, th * .86);
    g.fillStyle = pal.l2; g.fillRect(0, y0 + th * .2, W, th * .42);
    g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(0, y0 - th * .66, W, th * .2);   // つや
    return { cv, h };
  }

  // 角の星のかたまり（大小2つ＋ちっちゃいきらきら）
  function paintStars(S, pal, dpr, flip) {
    const { cv, g } = mkCanvas(S, S, dpr);
    if (!g) return cv;
    g.translate(S / 2, S / 2); if (flip) g.scale(-1, -1); g.translate(-S / 2, -S / 2);
    drawStar(g, S * .38, S * .55, S * .27, pal.l1, -.15);
    drawStar(g, S * .72, S * .30, S * .17, pal.l2, .25);
    g.fillStyle = '#fff';
    sparklePath(g, S * .16, S * .22, S * .1, .26); g.fill();
    sparklePath(g, S * .86, S * .72, S * .08, .26); g.fill();
    heartPath(g, S * .62, S * .86, S * .05); g.fillStyle = pal.l1; g.fill();
    return cv;
  }

  // ── キャラ：白いステッカー風のふちどり（canvas に1回だけ描く）──
  function paintSticker(im, w, h, pal, dpr) {
    const maxSide = 1100;
    let k = dpr;
    if (Math.max(w, h) * k > maxSide) k = maxSide / Math.max(w, h);
    const pad = Math.ceil(Math.max(w, h) * .035);
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round((w + pad * 2) * k)); cv.height = Math.max(1, Math.round((h + pad * 2) * k));
    const g = cv.getContext('2d');
    if (!g) return { cv, pad };
    try {
      // 1) シルエットを作る（白）
      const sil = document.createElement('canvas');
      sil.width = cv.width; sil.height = cv.height;
      const s = sil.getContext('2d');
      s.drawImage(im, pad * k, pad * k, w * k, h * k);
      s.globalCompositeOperation = 'source-in'; s.fillStyle = '#fff'; s.fillRect(0, 0, sil.width, sil.height);
      // 2) 属性色のうっすらした外側の光 → 白いふち（まわりに少しずつずらして重ねる）
      const ring = (r, tint) => {
        const t = document.createElement('canvas'); t.width = sil.width; t.height = sil.height;
        const tg = t.getContext('2d');
        tg.drawImage(sil, 0, 0);
        tg.globalCompositeOperation = 'source-in'; tg.fillStyle = tint; tg.fillRect(0, 0, t.width, t.height);
        const n = 20;
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU;
          g.drawImage(t, Math.cos(a) * r * k, Math.sin(a) * r * k);
        }
      };
      g.globalAlpha = .55; ring(pad * .95, pal.l1); g.globalAlpha = 1;
      ring(pad * .5, '#ffffff');
    } catch (e) { /* 読めなければふちなし */ }
    return { cv, pad };
  }

  // ── スキル名：長くても収める（縮小 → 2行 → 横に潰す）──
  const NO_HEAD = /^[ーッャュョァィゥェォっゃゅょぁぃぅぇぉ゛゜、。，．」』）!！?？…・]/;
  function planName(name, W, H) {
    const meas = document.createElement('canvas').getContext('2d');
    const U = 100;
    meas.font = '900 ' + U + 'px ' + FONT;
    const GAP = .03;
    const unit = s => {
      let w = 0; const a = Array.from(s);
      a.forEach((c, i) => { w += meas.measureText(c).width / U + (i ? GAP : 0); });
      return w;
    };
    const chars = Array.from(name);
    const areaW = W * NAME_AREA_W, EXTRA = .62;   // 太いフチぶんの余白（文字サイズ比）
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
      // カタカナ・英数字の単語の途中では、できるだけ割らない／ひらがな↔カタカナ↔漢字の切れ目なら割りやすく
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

  // 1行ぶんの文字を canvas に描く（やわらかいかげ・ピンクの太フチ・白フチ・パステルのグラデ文字・つや）
  function paintNameLine(line, unitW, fs, sx, pal, dpr) {
    const pad = fs * .42;
    const w = unitW * fs * sx + pad * 2 + fs * .2, h = fs * 1.5;
    const { cv, g } = mkCanvas(w, h, dpr);
    if (!g) return { cv, w, h };
    g.font = '900 ' + fs + 'px ' + FONT;
    g.textBaseline = 'middle'; g.textAlign = 'left'; g.lineJoin = 'round'; g.miterLimit = 2;
    g.translate(pad, h * .5);
    g.transform(sx, 0, -.10, 1, 0, 0);   // ほんの少しだけ傾ける
    const chars = Array.from(line);
    const xs = []; let x = 0;
    chars.forEach(c => { xs.push(x); x += g.measureText(c).width + fs * .03; });
    const each = fn => chars.forEach((c, i) => { if (c.trim()) fn(c, xs[i]); });
    g.lineWidth = fs * .5; g.strokeStyle = 'rgba(120,80,170,.28)';
    each((c, px) => g.strokeText(c, px + fs * .03, fs * .09));            // やわらかいかげ
    g.lineWidth = fs * .44; g.strokeStyle = pal.acc;
    each((c, px) => g.strokeText(c, px, 0));                                // 属性色の外ぶち
    g.lineWidth = fs * .30; g.strokeStyle = '#ffffff';
    each((c, px) => g.strokeText(c, px, 0));                                // 白フチ
    g.lineWidth = fs * .08; g.strokeStyle = pal.l2;
    each((c, px) => g.strokeText(c, px, 0));                                // 白フチの内側にうすい色の線
    const gr = g.createLinearGradient(0, -fs * .5, 0, fs * .5);
    gr.addColorStop(0, pal.txt[0]); gr.addColorStop(.5, pal.txt[1]); gr.addColorStop(1, pal.txt[2]);
    g.fillStyle = gr;
    each((c, px) => g.fillText(c, px, 0));                                  // 文字
    // 上半分にだけ白いつや
    g.save(); g.beginPath(); g.rect(-pad, -fs * .62, w + pad, fs * .5); g.clip();
    g.globalAlpha = .55; g.fillStyle = '#fff';
    each((c, px) => g.fillText(c, px, 0));
    g.restore();
    return { cv, w, h };
  }

  // モンスター名のリボン（ピンクのまるい帯に ♡ 名前 ♡）
  function paintLabel(text, fs, pal, dpr, maxW) {
    const meas = document.createElement('canvas').getContext('2d');
    meas.font = '800 ' + fs + 'px ' + FONT;
    let tw = meas.measureText(text).width;
    if (maxW && tw + fs * 2.6 > maxW) {   // 長い名前は、リボンごと縮めて収める
      fs = Math.max(7, fs * maxW / (tw + fs * 2.6));
      meas.font = '800 ' + fs + 'px ' + FONT;
      tw = meas.measureText(text).width;
    }
    const padX = fs * 1.3, h = fs * 1.9, w = tw + padX * 2;
    const { cv, g } = mkCanvas(w + 8, h + 8, dpr);
    if (!g) return { cv, w: w + 8, h: h + 8 };
    g.translate(4, 4);
    const r = h / 2;
    const rr = (x, y, ww, hh, rad) => { g.beginPath(); g.moveTo(x + rad, y); g.arcTo(x + ww, y, x + ww, y + hh, rad); g.arcTo(x + ww, y + hh, x, y + hh, rad); g.arcTo(x, y + hh, x, y, rad); g.arcTo(x, y, x + ww, y, rad); g.closePath(); };
    rr(0, fs * .08, w, h, r); g.fillStyle = 'rgba(120,80,170,.25)'; g.fill();   // かげ
    rr(0, 0, w, h, r); g.fillStyle = '#fff'; g.fill();
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, pal.l1); gr.addColorStop(1, pal.l2);
    rr(fs * .16, fs * .16, w - fs * .32, h - fs * .32, r - fs * .16); g.fillStyle = gr; g.fill();
    g.fillStyle = '#fff'; g.font = '800 ' + fs + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = fs * .16; g.strokeStyle = pal.acc;
    g.strokeText(text, w / 2, h / 2 + fs * .04); g.fillText(text, w / 2, h / 2 + fs * .04);
    heartPath(g, padX * .52, h / 2, fs * .2); g.fillStyle = '#fff'; g.fill();
    heartPath(g, w - padX * .52, h / 2, fs * .2); g.fill();
    return { cv, w: w + 8, h: h + 8 };
  }

  // 絵の置き場所（段の中での位置と大きさ）
  function layoutArt(info, face, W, H) {
    const nw = info.nw, nh = info.nh;
    if (face) {   // 縦長：顔をアップ
      const sc = (FACE_HEAD * H) / face.headH, fw = nw * sc, fh = nh * sc;
      return { left: W * FACE_X - face.fx * fw, top: H * FACE_Y - face.fy * fh, w: fw, h: fh, ox: face.fx * 100, oy: face.fy * 100 };
    }
    const bw = info.bw || nw, bh = info.bh || nh, bx0 = info.bx0 || 0, by0 = info.by0 || 0;
    const sc = Math.min(.98 * H / bh, .56 * W / bw), fw = nw * sc, fh = nh * sc, vis = bh * sc;
    const top = (H - vis) * .42 - by0 * sc;   // 少し上寄せ（下はスキル名のため）
    return { left: W * .34 - (bx0 + bw / 2) * sc, top, w: fw, h: fh, ox: (bx0 + bw / 2) / nw * 100, oy: (by0 + bh * .5) / nh * 100 };
  }

  function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

  function run(o, onDone) {
    const host = o.host, W = o.W, DH = o.DH, T = o.T, IOS = !!o.IOS;
    const pal = PAL[o.theme] || PAL.fire;
    const dpr = Math.min(IOS ? 2 : 2.5, Math.max(1, window.devicePixelRatio || 1));

    // 大きさ：1枚目のカード（細め）と、2枚目の段（大きく、盤面に少しはみ出す）
    const H1 = Math.round(Math.min(W * CARD_H, DH * .36));
    const H2 = Math.max(H1 + 20, Math.round(Math.min(W * STAGE_H, DH * STAGE_MAX)));
    const hHalf = H2 / 2;
    let stageTop;
    if (o.anchor) {
      // 段の下端を、盤面の上端より BOARD_OVER ぶん盤面にかぶせる（盤面の位置が無ければ、敵エリアの下端から OVERSHOOT ぶん下へ）。
      // 上は敵エリアの上端（少しだけ上まで）を越えない
      const a = o.anchor;
      stageTop = Math.round(a.board != null ? a.board + H2 * BOARD_OVER - H2 : a.bottom + H2 * OVERSHOOT - H2);
      stageTop = Math.max(stageTop, Math.round(o.anchor.top - H2 * .04));
      stageTop = Math.min(stageTop, DH - H2 - 2);
      stageTop = Math.max(2, stageTop);
    } else {
      stageTop = Math.max(2, Math.round(DH * CENTER_Y - hHalf));
    }
    const th = Math.max(4, Math.round(Math.min(W, H2) * .018));   // 枠の線の太さ

    // 時刻（ミリ秒）
    const tLine = LINE_MS;                         // 線が走り終わる
    const tOpen1 = tLine + OPEN1_MS;               // タイトルカードが開ききる
    const tOpen2 = Math.max(tOpen1 + CARD_HOLD, 1250);   // 2枚目へ広がり始める
    const tFace = tOpen2 + OPEN2_MS;               // 広がりきる
    const tName = tOpen2 + OPEN2_MS * .55;         // スキル名が入る
    const total = Math.max(T, tFace + 900 + OUT_MS);
    const f = ms => clamp(ms / total, 0, 1);
    const fOut = f(total - OUT_MS);

    const root = el('div', 'cvy-root');
    const dim = el('div', 'cvy-dim');
    root.appendChild(dim);

    // ── 窓：真ん中から上下へ開く「ただの四角（overflow:hidden）」1枚。中身は逆向きに動かして、絵が動かないようにする ──
    const stage = el('div', 'cvy-stage');
    stage.style.cssText = 'top:' + stageTop + 'px;height:' + H2 + 'px;';
    const win = el('div', 'cvy-win');
    win.style.cssText = 'top:' + hHalf + 'px;height:0px;';
    const inner = el('div', 'cvy-win-in');
    inner.style.cssText = 'top:' + (-hHalf) + 'px;height:' + H2 + 'px;';
    win.appendChild(inner);
    stage.appendChild(win);
    root.appendChild(stage);

    // 1枚目：タイトルカード（窓の真ん中に H1 の高さで）
    const card = paintCard(W, H1, pal, dpr); card.className = 'cvy-card';
    card.style.top = Math.round((H2 - H1) / 2) + 'px';

    // 2枚目：背景＋流れるきらきら＋キャラ＋きらきら＋スキル名
    const stack = el('div', 'cvy-stack');
    const back = paintBack(W, H2, pal, dpr); back.className = 'cvy-back';
    const drift = paintDrift(W, H2, pal, dpr); drift.className = 'cvy-drift';
    stack.append(back, drift);

    const info = o.info, L = layoutArt(info, o.face, W, H2);
    const stk = paintSticker(info.im, L.w, L.h, pal, dpr);
    const art = el('div', 'cvy-art');
    art.style.cssText = 'left:' + L.left + 'px;top:' + L.top + 'px;width:' + L.w + 'px;height:' + L.h + 'px;transform-origin:' + L.ox + '% ' + L.oy + '%;';
    stk.cv.className = 'cvy-sticker';
    stk.cv.style.cssText = 'left:' + (-stk.pad) + 'px;top:' + (-stk.pad) + 'px;width:' + (L.w + stk.pad * 2) + 'px;height:' + (L.h + stk.pad * 2) + 'px;';
    const mon = el('img', 'cvy-mon');
    mon.alt = ''; mon.draggable = false; mon.src = info.url;
    art.append(stk.cv, mon);
    stack.appendChild(art);

    // きらきら（段の中で瞬く）
    const twinkles = [];
    const TN = IOS ? 7 : 14;
    for (let i = 0; i < TN; i++) {
      const s = el('i', 'cvy-tw'), z = rnd(9, 20);
      s.style.cssText = 'left:' + rnd(2, 96).toFixed(1) + '%;top:' + rnd(4, 88).toFixed(1) + '%;width:' + z.toFixed(1) + 'px;height:' + z.toFixed(1) + 'px;opacity:0;';
      stack.appendChild(s); twinkles.push(s);
    }

    // スキル名（と、モンスター名のリボン）
    const plan = planName(o.name, W, H2);
    const lineH = plan.fs * 1.08;
    const blockH = plan.lines.length * lineH;
    const labelFs = Math.max(9, Math.round(H2 * .042));
    const hasLabel = !!o.label;
    const bottomGap = Math.max(8, H2 * .07);
    const nameRight = Math.round(W * .03);
    const lineEls = [];
    let labelEl = null, labelH = 0;
    if (hasLabel) {
      const lb = paintLabel(String(o.label), labelFs, pal, dpr, W * NAME_AREA_W);
      labelH = lb.h;
      labelEl = el('div', 'cvy-line');
      labelEl.style.cssText = 'right:' + nameRight + 'px;top:' + Math.round(H2 - bottomGap - lb.h) + 'px;width:' + lb.w + 'px;height:' + lb.h + 'px;transform-origin:100% 50%;';
      lb.cv.className = 'cvy-line-cv'; labelEl.appendChild(lb.cv);
    }
    const blockBottom = H2 - bottomGap - labelH - (hasLabel ? H2 * .01 : 0);
    const blockTop = Math.max(H2 * .28, blockBottom - blockH);
    plan.lines.forEach((ln, i) => {
      const p = paintNameLine(ln, plan.units[i], plan.fs, plan.sx, pal, dpr);
      const w = el('div', 'cvy-line');
      w.style.cssText = 'right:' + nameRight + 'px;top:' + Math.round(blockTop + i * lineH - (p.h - plan.fs) / 2) + 'px;width:' + p.w + 'px;height:' + p.h + 'px;transform-origin:100% 60%;';
      p.cv.className = 'cvy-line-cv'; w.appendChild(p.cv);
      lineEls.push(w);
    });
    // 入る順：スキル名（1行目→2行目）→ モンスター名のリボン
    const ordered = labelEl ? lineEls.concat(labelEl) : lineEls;
    ordered.forEach(e => stack.appendChild(e));

    inner.append(card, stack);

    // ── 枠：2本線＋星。窓の上端・下端に張りつく（窓の外側なので、別の入れ物）──
    const lineInfo = paintLine(W, th, pal, dpr);
    const SZ = Math.round(Math.min(W * .2, H2 * .3));
    const mkLine = () => {
      const c = document.createElement('canvas');
      c.width = lineInfo.cv.width; c.height = lineInfo.cv.height;
      try { c.getContext('2d').drawImage(lineInfo.cv, 0, 0); } catch (e) {}
      c.className = 'cvy-frameline';
      c.style.cssText = 'left:0;top:' + (-Math.round(lineInfo.h / 2)) + 'px;width:' + W + 'px;height:' + lineInfo.h + 'px;';
      return c;
    };
    const frameLayer = el('div', 'cvy-framelayer');
    frameLayer.style.cssText = 'top:' + stageTop + 'px;height:' + H2 + 'px;';
    const topBox = el('div', 'cvy-linebox'); topBox.style.top = '0px';
    const botBox = el('div', 'cvy-linebox'); botBox.style.top = H2 + 'px';
    const lnTop = mkLine(), lnBot = mkLine();
    const stTop = paintStars(SZ, pal, dpr, false), stBot = paintStars(SZ, pal, dpr, true);
    stTop.className = stBot.className = 'cvy-frame-stars';
    stTop.style.left = Math.round(-SZ * .12) + 'px'; stTop.style.top = Math.round(-SZ * .6) + 'px';
    stBot.style.right = Math.round(-SZ * .12) + 'px'; stBot.style.top = Math.round(-SZ * .4) + 'px';
    topBox.append(lnTop, stTop); botBox.append(lnBot, stBot);
    frameLayer.append(topBox, botBox);
    root.appendChild(frameLayer);

    // 広がる瞬間のふわっとした光
    const flash = el('div', 'cvy-flash');
    flash.style.cssText = 'top:' + stageTop + 'px;height:' + H2 + 'px;background:radial-gradient(ellipse at 50% 50%,#fff 0%,' + pal.glow + ' 55%,rgba(255,255,255,0) 100%);';
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
    const EASE_OPEN2 = 'cubic-bezier(.2,.9,.25,1)';

    // 暗転（ラベンダー色）
    A(dim, [{ opacity: 0 }, { opacity: 1, offset: f(260) }, { opacity: 1, offset: fOut }, { opacity: 0 }], { duration: total });

    // 窓の開き方：細い線 → タイトルカードの高さ(H1) → 段の高さ(H2) → すっと閉じる
    //   v＝真ん中から上下それぞれに見せる高さ。窓の top・height と、中身の top を同じ時刻・同じ動きで変える（中身は動かない）
    const openPx = [0, 2, H1 / 2, H1 / 2, hHalf, hHalf, 0];
    const openAt = [0, f(tLine), f(tOpen1), f(tOpen2), f(tFace), fOut, 1];
    const ease = i => (i === 4 ? EASE_OPEN2 : (i === 5 || i === 6) ? 'cubic-bezier(.6,0,.9,.5)' : 'ease-out');
    A(win,   openPx.map((v, i) => ({ top: (hHalf - v) + 'px', height: (2 * v) + 'px', offset: openAt[i], easing: ease(i + 1) })), { duration: total });
    A(inner, openPx.map((v, i) => ({ top: (-(hHalf - v)) + 'px', offset: openAt[i], easing: ease(i + 1) })), { duration: total });
    // 枠の線：窓の上端・下端に張りつく
    A(topBox, openPx.map((v, i) => ({ transform: 'translateY(' + (hHalf - v) + 'px)', offset: openAt[i], easing: ease(i + 1) })), { duration: total });
    A(botBox, openPx.map((v, i) => ({ transform: 'translateY(' + (-(hHalf - v)) + 'px)', offset: openAt[i], easing: ease(i + 1) })), { duration: total });

    // ★の線が左→右へ走る（2本とも左から）。星は線が着いたあと「ぽん」と弾む
    [lnTop, lnBot].forEach((ln, i) => {
      A(ln, [
        { transform: 'translateX(' + (-W) + 'px)' },
        { transform: 'translateX(0)', offset: f(tLine + i * 50), easing: 'cubic-bezier(.15,.85,.25,1)' },
        { transform: 'translateX(0)' }
      ], { duration: total });
    });
    [stTop, stBot].forEach((st, i) => {
      A(st, [
        { opacity: 0, transform: 'scale(.1) rotate(-60deg)' },
        { opacity: 0, transform: 'scale(.1) rotate(-60deg)', offset: f(tLine * .6) },
        { opacity: 1, transform: 'scale(1.25) rotate(10deg)', offset: f(tLine + 150), easing: 'cubic-bezier(.2,.9,.3,1.3)' },
        { opacity: 1, transform: 'scale(1) rotate(0deg)', offset: f(tLine + 330) },
        { opacity: 1, transform: 'scale(1) rotate(0deg)', offset: f(tOpen2) },
        { opacity: 1, transform: 'scale(1.12) rotate(-6deg)', offset: f(tFace + 80), easing: 'ease-out' },
        { opacity: 1, transform: 'scale(1) rotate(0deg)', offset: f(tFace + 380) },
        { opacity: 1, transform: 'scale(1) rotate(0deg)' }
      ], { duration: total });
    });

    // タイトルカード：ふわっと入って、2枚目に切り替わる時に消える
    A(card, [
      { opacity: 0, transform: 'scale(1.08)' },
      { opacity: 0, transform: 'scale(1.08)', offset: f(tLine) },
      { opacity: 1, transform: 'scale(1)', offset: f(tOpen1), easing: 'ease-out' },
      { opacity: 1, offset: f(tOpen2 + 40) },
      { opacity: 0, offset: f(tOpen2 + OPEN2_MS * .6) },
      { opacity: 0 }
    ], { duration: total });
    // 2枚目の中身：窓が広がる間に現れる
    A(stack, [
      { opacity: 0 }, { opacity: 0, offset: f(tOpen2 - 30) },
      { opacity: 1, offset: f(tOpen2 + OPEN2_MS * .5) }, { opacity: 1 }
    ], { duration: total });
    A(back, [
      { transform: 'scale(1.12)' }, { transform: 'scale(1.12)', offset: f(tOpen2) },
      { transform: 'scale(1)', easing: 'ease-out' }
    ], { duration: total });
    A(drift, [{ transform: 'translateX(0)' }, { transform: 'translateX(' + (-W * .3) + 'px)' }], { duration: total, easing: 'linear' });

    // キャラ：右からぽよんと入って、ふわふわ浮かぶ
    A(art, [
      { opacity: 0, transform: 'translateX(14%) scale(.82)' },
      { opacity: 0, transform: 'translateX(14%) scale(.82)', offset: f(tOpen2 + 40) },
      { opacity: 1, transform: 'translateX(-1%) scale(1.06)', offset: f(tOpen2 + OPEN2_MS + 120), easing: 'cubic-bezier(.2,.9,.3,1.2)' },
      { opacity: 1, transform: 'translateX(0) scale(1)', offset: f(tOpen2 + OPEN2_MS + 330) },
      { opacity: 1, transform: 'translateX(0) translateY(-1.4%) scale(1.01)' }
    ], { duration: total });

    // きらきら
    twinkles.forEach(tw => {
      A(tw, [
        { opacity: 0, transform: 'scale(.3) rotate(0deg)' },
        { opacity: 1, transform: 'scale(1) rotate(45deg)', offset: .5 },
        { opacity: 0, transform: 'scale(.3) rotate(90deg)' }
      ], { duration: rnd(700, 1300), delay: rnd(tOpen2, tOpen2 + 900), iterations: 3 });
    });

    // スキル名・リボン：ぽよんと弾んで入る
    ordered.forEach((ln, i) => {
      A(ln, [
        { opacity: 0, transform: 'translateX(' + (W * .25) + 'px) scale(1.5,.7)' },
        { opacity: 1, transform: 'translateX(-1.5%) scale(.94,1.1)', offset: .5, easing: 'ease-out' },
        { opacity: 1, transform: 'translateX(0) scale(1.03,.97)', offset: .75 },
        { opacity: 1, transform: 'translateX(0) scale(1,1)' }
      ], { duration: 460, delay: tName + i * 90, easing: 'cubic-bezier(.2,.8,.3,1)' });
    });

    // 切り替わりの光
    A(flash, [
      { opacity: 0 }, { opacity: 0, offset: f(tOpen2 - 20) },
      { opacity: .8, offset: f(tOpen2 + OPEN2_MS * .55) },
      { opacity: 0, offset: f(tOpen2 + OPEN2_MS + 260) }, { opacity: 0 }
    ], { duration: total });

    // 名前が入った瞬間に、画面をやさしく揺らす
    const shake = typeof o.shake === 'function' ? o.shake : null;
    if (shake) setTimeout(() => { if (!done) { try { shake(6); } catch (e) {} } }, tName + 240);

    return finish;
  }

  window.CutInYume = { run, PAL, planName };
})();
