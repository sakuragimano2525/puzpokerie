// ============================================================
// 炎の枠（盤面のまわりがリアルな炎になる演出）
//   ★ game.js の後に読み込む（currentDungeonKey / dungeonBGMAudio / dungeonBGMFile / DUNGEON_BGM を使うため）
//
//   ・monhan-1 のボスBGMが流れているとき、下の「windows」の時間帯だけ盤面の枠が炎になる
//   ・時間は <audio> の再生位置（currentTime）で見ているので、BGMがループしても、
//     最初に戻ったあと同じ時間になればまた炎の枠になる
//   ・BGMが止まる／別の曲になる／別のダンジョンに行くと、炎はゆっくり消える
//
//   【炎の作り方（軽さの工夫）】
//     「熱マップ」方式。盤面のまわりを小さなマス目（3px＝1マス）に区切って、
//       ① ふちのマスに熱を注ぐ → ② 熱が上へ昇りながら、まわりと混ざって冷める → ③ 熱を色に変換する
//     を 1秒に30回くりかえす。熱の高いところは白っぽい黄色、冷めるにつれて橙→赤→消える（本物の炎と同じ色の並び）。
//     冷め方にゆらぐノイズを使っているので、炎の舌が伸びたり、ちぎれて消えたりする。
//     ・計算するのは「炎が出るところだけ」（盤面の真ん中は計算しない）
//     ・小さな絵を拡大して表示するだけなので、描画はほぼ一瞬
//     ・端末が重いと自動でマスを粗くして軽くする（見た目はやわらかくなるだけ）
//
//   【変えたいとき】
//     dungeon … 炎の枠を出すダンジョンのキー
//     file    … 対象のBGMファイル名。null なら「そのダンジョンのボスBGM」
//     windows … [開始秒, 終了秒] の一覧（1:25 → 85 のように秒で書く）
//     見た目  … 下の LOOK（炎の高さ・勢い・火の粉の数など）
//
//   【ブラウザのコンソールで確認したいとき】
//     FireFrame.force(true)  … 時間に関係なく炎の枠を出す
//     FireFrame.force(false) … 強制を解除（もとの時間制御に戻る）
//     FireFrame.stats()      … いまのマスの粗さと、1コマの計算時間(ms)を見る
// ============================================================
(function () {
  'use strict';

  const CFG = {
    dungeon: 'monhan-1',
    file: null,
    windows: [
      [56, 85],     // 00:56 〜 01:25
      [141, 170],   // 02:21 〜 02:50
      [226, 256],   // 03:46 〜 04:16
    ],
  };

  // ── 見た目の調整（数字を変えるだけ） ──
  const LOOK = {
    height: 0.057,     // ★炎の高さ：小さいほど高く燃える（0.045=かなり高い / 0.070=低め）
    tongue: 0.085,     // ★炎の舌のメリハリ：大きいほど「伸びる所／短い所」の差が大きい
    fuel: 1.00,        // ふちの熱の強さ（1.0 が最大）
    inner: 24,         // 盤面の内側へ炎が入ってくる深さ(px)。大きいとオーブが炎で隠れる
    innerAlpha: 0.88,  // 盤面の内側での炎の濃さの上限（1 で完全に不透明）
    sparks: 22,        // 火の粉の数の上限（0 で無し）
  };

  const MT = 78, MS = 24, MB = 14;   // 盤面の外側にはみ出す広さ(px)：上／左右／下
  const LEVELS = [3, 4, 6];    // 1マスの大きさ(px)。大きいほど軽い。重い端末は自動で右へ進む
  const STEP = 1 / 30;         // 炎は30コマ/秒で更新（炎は30fpsで十分なめらかに見える）
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const TEX = 128;             // ノイズ画像の大きさ（2のべき乗）

  let wrap = null, frame = null, cv = null, ctx = null, sp = null, sctx = null;
  let img = null, pix = null;
  let W = 0, H = 0;                     // 盤面の大きさ(px)
  let CS = 3, gw = 0, gh = 0, pw = 0;   // 1マス(px)／マスの数(横・縦)／熱マップの1行の長さ
  let xl = 0, xr = 0, yt = 0, yb = 0;   // 盤面のふちのマス位置
  let heat = null, mask = null, runs = null, runN = 0;
  let bias = null, colTex = null, rowTex = null;
  let src = null, srcN = 0;             // 熱を注ぐマス
  let sparks = [];
  let want = false, forced = false;
  let intensity = 0;                    // 0〜1（ふわっと点いて、ふわっと消える）
  let raf = 0, last = 0, acc = 0, T = 0, seed = 123456789;
  let level = 0, msAvg = 0, msN = 0, resizeCheck = 0, built = false;

  // ── 部品：ノイズ画像と色のならび ──
  const tex = new Float32Array(TEX * TEX);
  (function buildTex() {
    const oct = (g, w) => {                       // g×g の乱数格子をなめらかにつないだ「値ノイズ」（上下左右につながる）
      const L = new Float32Array(g * g);
      for (let i = 0; i < L.length; i++) L[i] = Math.random();
      const cell = TEX / g;
      for (let y = 0; y < TEX; y++) {
        const gy = y / cell, y0 = Math.floor(gy), fy0 = gy - y0, fy = fy0 * fy0 * (3 - 2 * fy0), y1 = (y0 + 1) % g;
        for (let x = 0; x < TEX; x++) {
          const gx = x / cell, x0 = Math.floor(gx), fx0 = gx - x0, fx = fx0 * fx0 * (3 - 2 * fx0), x1 = (x0 + 1) % g;
          const a = L[y0 * g + x0] + (L[y0 * g + x1] - L[y0 * g + x0]) * fx;
          const b = L[y1 * g + x0] + (L[y1 * g + x1] - L[y1 * g + x0]) * fx;
          tex[y * TEX + x] += (a + (b - a) * fy) * w;
        }
      }
    };
    oct(16, 0.58); oct(32, 0.42);
    for (let i = 0; i < tex.length; i++) {       // 値ノイズは真ん中に寄りがちなので、メリハリをつける
      const v = (tex[i] - 0.5) * 1.9 + 0.5;
      tex[i] = v < 0 ? 0 : v > 1 ? 1 : v;
    }
  })();

  // 熱(0〜255) → 色。黒体放射のように 暗い赤 → 赤 → 橙 → 黄 → 白っぽい黄
  const lutR = new Uint8Array(256), lutG = new Uint8Array(256), lutB = new Uint8Array(256), lutA = new Uint8Array(256);
  (function buildPalette() {
    const S = [[0.00, 80, 4, 0], [0.16, 175, 20, 0], [0.34, 246, 66, 4], [0.52, 255, 130, 14],
               [0.70, 255, 196, 56], [0.86, 255, 236, 140], [1.00, 255, 252, 222]];
    for (let k = 0; k < 256; k++) {
      const t = k / 255;
      let i = 0;
      while (i < S.length - 2 && t > S[i + 1][0]) i++;
      const a = S[i], b = S[i + 1], u = Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0])));
      lutR[k] = a[1] + (b[1] - a[1]) * u;
      lutG[k] = a[2] + (b[2] - a[2]) * u;
      lutB[k] = a[3] + (b[3] - a[3]) * u;
      const v = Math.max(0, Math.min(1, (t - 0.055) / 0.30));   // 熱が低いところはうっすら透ける（炎のふち）
      lutA[k] = Math.round(v * v * (3 - 2 * v) * 245);
    }
  })();

  // ── 土台（DOM）を作る ──
  function mount() {
    wrap = document.getElementById('grid-wrap');
    if (!wrap) return false;
    if (frame && frame.parentNode === wrap) return true;
    frame = document.createElement('div');
    frame.id = 'fire-frame';
    frame.innerHTML = '<div class="ff-glow"></div><canvas class="ff-canvas"></canvas><canvas class="ff-sparks"></canvas><div class="ff-rim"></div>';
    wrap.appendChild(frame);
    cv = frame.querySelector('.ff-canvas');
    ctx = cv.getContext('2d');
    sp = frame.querySelector('.ff-sparks');
    sctx = sp.getContext('2d');
    built = false;   // 次の resize() で作り直す
    return true;
  }

  // ── 盤面の大きさに合わせて、熱マップ・計算する範囲・熱を注ぐマスを作り直す ──
  function build() {
    CS = LEVELS[level];
    gw = Math.ceil((W + MS * 2) / CS);
    xl = Math.ceil(MS / CS);
    yt = Math.ceil(MT / CS);
    xr = xl + Math.round(W / CS);
    yb = yt + Math.round(H / CS);
    gh = yb + Math.ceil(MB / CS);
    pw = gw + 4;                                      // 左右に 2マスずつ余白（はみ出し読みの保険）

    // 熱マップの絵（小さな canvas を CSS で拡大して表示）
    cv.width = gw; cv.height = gh;
    const css = `left:${-xl * CS}px;top:${-yt * CS}px;width:${gw * CS}px;height:${gh * CS}px`;
    cv.style.cssText = css;
    img = ctx.createImageData(gw, gh);
    pix = img.data;
    // 火の粉は別の canvas（同じ位置・同じ大きさ）
    sp.width = Math.round(gw * CS * DPR); sp.height = Math.round(gh * CS * DPR);
    sp.style.cssText = css;
    sctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    heat = new Float32Array(pw * (gh + 3));
    mask = new Uint8Array(pw * (gh + 3));

    // 計算する範囲：炎が出るところだけ（上の外側／左右のふち／下のふち）。盤面の真ん中は計算しない
    const inB = Math.max(2, Math.round(LOOK.inner / CS));
    const list = [];
    for (let y = 0; y < gh - 1; y++) {
      if (y < yt + 2 || y >= yb - inB) list.push(y, 0, gw);      // 上のふち（熱を注ぐ行を含む）と下のふちは横いっぱい
      else { list.push(y, 0, Math.min(gw, xl + inB)); list.push(y, Math.max(0, xr - inB), gw); }
    }
    runs = Int32Array.from(list);
    runN = runs.length;

    // 盤面の内側は、深くなるほど薄くする（オーブを隠しすぎない）
    mask.fill(255);
    const full = 8 / CS, none = LOOK.inner / CS;
    for (let y = yt; y < yb; y++) {
      for (let x = xl; x < xr; x++) {
        const d = Math.min(x - xl, xr - 1 - x, y - yt, yb - 1 - y);
        let m = d <= full ? 1 : d >= none ? 0 : 1 - (d - full) / (none - full);
        m = LOOK.innerAlpha * (m * m * (3 - 2 * m));
        mask[y * pw + x + 2] = Math.round(m * 255);
      }
    }

    // 列ごとの傾き：左右のふちの炎は、少し外へ傾く（0 なら真上）。プラス＝左へ、マイナス＝右へ
    bias = new Float32Array(gw);
    colTex = new Int32Array(gw);
    rowTex = new Int32Array(gh + 3);
    const k = CS / 3;
    const span = 14;
    for (let x = 0; x < gw; x++) {
      bias[x] = 0.30 * Math.max(0, Math.min(1, (xl + span - x) / span))
              - 0.30 * Math.max(0, Math.min(1, (x - (xr - span)) / span));
      colTex[x] = Math.floor(x * k);
    }
    for (let y = 0; y < rowTex.length; y++) rowTex[y] = Math.floor(y * k * 0.55);   // 縦にのばして「炎の舌」らしくする

    // 熱を注ぐマス：ふちに沿った「帯」。外側ほど強く、盤面の内側へ入るほど弱くなる。
    //   上＝2マス／左右＝内側へ数マス／下＝盤面の下から内側へ数マス
    //   各マスの x, y は「ノイズ画像のどこを見るか」にも使う（場所ごとに強さにムラを出す）
    const s = [];
    const side = Math.max(3, Math.round(15 / CS));     // 左右の帯の厚み（内側へ）
    const bot = Math.max(3, Math.round(10 / CS));       // 下の帯の厚み（内側へ）
    for (let x = xl; x < xr; x++) { s.push(yt - 1, x, 1.0, yt, x, 1.0); }                                  // 上
    for (let y = yt; y < yb; y++) {
      for (let d = -1; d < side; d++) { const w = d < 1 ? 1.0 : 1 - (d / side) * 0.55; s.push(y, xr - 1 - d + 1, w); s.push(y, xl + d, w); }   // 右・左
    }
    for (let x = xl; x < xr; x++) {
      for (let d = -1; d < bot; d++) { const w = d < 1 ? 1.0 : 1 - (d / bot) * 0.6; s.push(yb - d + 1, x, w); }                                // 下
    }
    src = Float32Array.from(s);
    srcN = src.length;

    built = true;
  }
  function resize() {
    if (!wrap || !cv) return;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (built && w === W && h === H) return;
    W = w; H = h;
    if (W < 40 || H < 40) { built = false; return; }
    build();
  }

  // ── 熱マップを1コマ進める ──
  function step(dt) {
    // 風：炎全体がゆっくり左右にたなびく
    const wind = 0.20 * Math.sin(T * 0.9) + 0.10 * Math.sin(T * 2.3 + 1.7) + 0.05 * Math.sin(T * 6.1);
    const ox = (T * 5) | 0;                    // ノイズ画像を横へゆっくり流す
    const oy = (T * 34) | 0;                   // ノイズ画像を上へ流す（炎の舌が昇っていく）
    const cBase = LOOK.height * 0.35, cAmp = LOOK.height * 0.65 + LOOK.tongue * 0.6;
    const cMul = cAmp, cMin = cBase;
    const h = heat;

    for (let r = 0; r < runN; r += 3) {
      const y = runs[r], x0 = runs[r + 1], x1 = runs[r + 2];
      const base = y * pw + 2, below = base + pw, below2 = below + pw;
      const ty = ((rowTex[y] + oy) & (TEX - 1)) * TEX;
      for (let x = x0; x < x1; x++) {
        // 乱数（xorshift）
        seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
        const rv = (seed >>> 8) * (1 / 16777216);
        const p = bias[x] + wind;
        const sh = rv < p ? 1 : (rv > 1 + p ? -1 : 0);      // 熱が昇るとき、たまに横へずれる（ゆらぎ）
        const s = below + x + sh;
        let v = (h[s - 1] + h[s] + h[s + 1] + h[below2 + x]) * 0.25;
        v -= cMin + cMul * tex[ty + ((colTex[x] + ox) & (TEX - 1))];   // 冷める（ノイズで冷め方にムラ→炎の舌）
        h[base + x] = v > 0 ? v : 0;
      }
    }

    // ふちのマスに熱を注ぐ（場所と時間でムラのあるノイズ＋重み。強さは「勢い」で増減）
    const fuel = LOOK.fuel * intensity;
    const sy = (T * 26) | 0, sx = (T * 4) | 0;
    for (let i = 0; i < srcN; i += 3) {
      const y = src[i], x = src[i + 1];
      const n = tex[((((rowTex[y] * 2 + sy) & (TEX - 1))) * TEX) + ((colTex[x] * 2 + sx + 40) & (TEX - 1))];
      const f = fuel * src[i + 2] * (0.25 + 0.95 * n);
      const idx = y * pw + x + 2;
      if (h[idx] < f) h[idx] = f > 1 ? 1 : f;
    }
  }

  // ── 熱を色にして絵にする ──
  function paint() {
    const d = pix, h = heat;
    let mx = 0;
    for (let r = 0; r < runN; r += 3) {
      const y = runs[r], x0 = runs[r + 1], x1 = runs[r + 2];
      const base = y * pw + 2;
      let o = (y * gw + x0) * 4;
      for (let x = x0; x < x1; x++, o += 4) {
        const v = h[base + x];
        if (v < 0.02) { d[o + 3] = 0; continue; }
        if (v > mx) mx = v;
        const k = v >= 1 ? 255 : (v * 255) | 0;
        d[o] = lutR[k]; d[o + 1] = lutG[k]; d[o + 2] = lutB[k];
        d[o + 3] = (lutA[k] * mask[base + x]) >> 8;
      }
    }
    ctx.putImageData(img, 0, 0);
    return mx;
  }

  // ── 火の粉（ときどき舞い上がる小さな光） ──
  function spawnSpark() {
    // 上のふちから多め、左右のふちから少し
    let x, y, vx;
    const q = Math.random();
    if (q < 0.65) { x = Math.random() * W; y = 4; vx = (Math.random() - 0.5) * 26; }
    else if (q < 0.825) { x = 2; y = Math.random() * H * 0.9; vx = -8 - Math.random() * 16; }
    else { x = W - 2; y = Math.random() * H * 0.9; vx = 8 + Math.random() * 16; }
    sparks.push({
      x: x + xl * CS, y: y + yt * CS, vx,
      vy: -(35 + Math.random() * 70),
      life: 0.8 + Math.random() * 1.1, age: 0,
      r: 0.8 + Math.random() * 1.1, ph: Math.random() * 6.283,
    });
  }
  function drawSparks(dt) {
    const had = sparks.length > 0;
    if (want && LOOK.sparks > 0 && sparks.length < LOOK.sparks * Math.min(1, intensity * 1.2) && Math.random() < 0.45) spawnSpark();
    if (!had && !sparks.length) return;
    sctx.clearRect(0, 0, gw * CS, gh * CS);
    sctx.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.age += dt;
      if (p.age >= p.life || p.y < 4) { sparks[i] = sparks[sparks.length - 1]; sparks.pop(); continue; }
      p.x += (p.vx + Math.sin(p.ph + p.age * 6) * 14) * dt;
      p.y += p.vy * dt;
      const u = p.age / p.life;
      const a = Math.max(0, (1 - u) * Math.min(1, p.y / 28) * (0.6 + 0.4 * Math.sin(p.age * 34 + p.ph)) * intensity);
      sctx.fillStyle = u < 0.5 ? `rgba(255,228,140,${a.toFixed(3)})` : `rgba(255,140,40,${a.toFixed(3)})`;
      sctx.beginPath();
      sctx.arc(p.x, p.y, p.r * (1 - u * 0.5), 0, 6.283);
      sctx.fill();
    }
    sctx.globalCompositeOperation = 'source-over';
    if (!sparks.length) sctx.clearRect(0, 0, gw * CS, gh * CS);
  }

  // ── 1コマ ──
  function tick(now) {
    raf = 0;
    if (!frame || !frame.isConnected) { if (!mount()) return; }
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 0.016;
    if (dt > 0.1) dt = 0.1;
    acc += dt;
    if (acc < STEP * 0.85) { schedule(); return; }      // 30コマ/秒に間引く
    const sdt = Math.min(acc, 0.1);
    acc = 0;
    T += sdt;

    if (!built || ++resizeCheck >= 20) { resizeCheck = 0; resize(); }
    if (!built) { if (want || intensity > 0) schedule(); return; }      // 盤面が隠れているあいだは待つだけ

    // ふわっと点く／ふわっと消える
    const target = want ? 1 : 0;
    intensity += (target - intensity) * Math.min(1, sdt * (want ? 2.4 : 2.2));
    if (!want && intensity < 0.02) intensity = 0;

    const t0 = performance.now();
    step(sdt);
    const mx = paint();
    drawSparks(sdt);
    const ms = performance.now() - t0;

    // 重い端末では、マスを粗くして軽くする（30コマぶんの平均が 6ms を超えたら）
    msAvg += ms; msN++;
    if (msN >= 30) {
      const avg = msAvg / msN;
      msAvg = 0; msN = 0;
      lastAvg = avg;
      if (avg > 6 && level < LEVELS.length - 1) { level++; built = false; }
    }

    // 次へ（炎がすっかり消えて、熱も火の粉も無くなったら止める）
    if (want || intensity > 0 || mx > 0.02 || sparks.length) schedule();
    else { ctx.clearRect(0, 0, gw, gh); sctx.clearRect(0, 0, gw * CS, gh * CS); heat.fill(0); sparks.length = 0; }
  }
  let lastAvg = 0;
  function schedule() {
    if (raf || document.hidden) return;
    raf = requestAnimationFrame(tick);
  }

  // ── いま炎の時間帯かを判定（150ms ごとに見る） ──
  function bossTime() {
    try {
      if (typeof currentDungeonKey === 'undefined' || currentDungeonKey !== CFG.dungeon) return -1;
      if (typeof dungeonBGMAudio === 'undefined' || !dungeonBGMAudio || dungeonBGMAudio.paused) return -1;
      let file = CFG.file;
      if (!file) {
        const c = (typeof DUNGEON_BGM !== 'undefined') ? DUNGEON_BGM[CFG.dungeon] : null;
        file = c && c.boss;
      }
      if (file && typeof dungeonBGMFile !== 'undefined' && dungeonBGMFile !== file) return -1;
      return dungeonBGMAudio.currentTime;
    } catch (e) { return -1; }
  }
  function inWindow(t) {
    if (t < 0) return false;
    for (let i = 0; i < CFG.windows.length; i++) {
      if (t >= CFG.windows[i][0] && t < CFG.windows[i][1]) return true;
    }
    return false;
  }
  function poll() {
    const on = forced || inWindow(bossTime());
    if (on === want && !on && !sparks.length && intensity === 0 && !raf) return;
    want = on;
    if (on || sparks.length || intensity > 0 || raf) {
      if (!mount()) return;
      frame.classList.toggle('on', on);
      if (!raf) { last = performance.now(); acc = 0; schedule(); }
    } else if (frame) {
      frame.classList.remove('on');
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && (want || sparks.length || intensity > 0)) { last = performance.now(); acc = 0; schedule(); }
  });
  setInterval(poll, 150);

  window.FireFrame = {
    cfg: CFG,
    look: LOOK,
    force(v) { forced = !!v; poll(); },
    stats() {
      let hot = 0;
      if (heat) for (let i = 0; i < heat.length; i++) if (heat[i] > hot) hot = heat[i];
      return { cell: CS, ms: +lastAvg.toFixed(2), grid: gw + '×' + gh, running: !!raf, intensity: +intensity.toFixed(3), hot: +hot.toFixed(3), sparks: sparks.length };
    },
  };
})();
