// ============================================================
// 敵画像の「ぴったり自動フィット」
//   大きな画像（余白つきのイラストなど）を置いても、本家のように
//   「モンスターの絵そのもの」が敵エリアいっぱいに、HPバーのすぐ上に収まるようにします。
//
//   やっていること
//     1) 画像の「透明な余白」を自動で見つけて切り落とす（元のファイルは変更しません）
//        ※動く画像（アニメーション.png などのAPNG／GIF／アニメWebP）は動きが止まるので加工しません
//     2) 切り落とした画像を、敵エリアの幅×高さに収まる最大の大きさで表示（fitEnemyImages が計算）
//
//   ・画像を追加してデータに書くだけで、自動でこの処理がかかります
//   ・オフにしたい時：下の ENABLED を false に（以前の表示に戻ります）
//   ・加工できない時（file:// で開いている等）は、元の画像のまま表示します
//   （このファイルは game.js より前に読み込む）
// ============================================================
(function () {
  const ENABLED  = true;
  const ALPHA_TH = 24;     // これより薄い（ほぼ透明な）ピクセルは「余白」とみなす
  const SCAN_MAX = 256;    // 余白を探す時の縮小サイズ（軽くするため）
  const OUT_MAX  = 1024;   // 切り出した画像の長辺の上限（メモリ節約。表示には十分）
  const KEEP_MAX = 24;     // 加工済み画像を覚えておく数（古いものから捨てる）
  const MIN_GAIN = 0.03;   // 余白がほぼ無い（各辺3%未満）画像は加工しない

  const done = new Map();      // 元のURL → 加工後のURL（加工不要・失敗は null）
  const pending = new Map();   // 元のURL → 加工中の Promise

  function loadImg(src) {
    return new Promise(res => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => res(im.naturalWidth > 0 ? im : null);
      im.onerror = () => res(null);
      im.src = src;
    });
  }

  // 動く画像（APNG / アニメGIF / アニメWebP）かどうか。動く画像を canvas に通すと静止画になってしまうので、加工しない
  function isAnimated(src) {
    if (/\.gif(\?|$)/i.test(src)) return Promise.resolve(true);
    return fetch(src).then(r => r.ok ? r.arrayBuffer() : null).then(buf => {
      if (!buf) return true;                       // 中身を確認できない → 安全のため加工しない
      const u = new Uint8Array(buf), n = u.length;
      const str = (o, l) => String.fromCharCode.apply(null, u.subarray(o, o + l));
      if (n > 12 && str(1, 3) === 'PNG') {         // PNG：IDAT(画像本体)より前に acTL があれば APNG
        let o = 8;
        while (o + 8 <= n) {
          const len = ((u[o] << 24) | (u[o + 1] << 16) | (u[o + 2] << 8) | u[o + 3]) >>> 0;
          const type = str(o + 4, 4);
          if (type === 'acTL') return true;
          if (type === 'IDAT' || type === 'IEND') return false;
          o += 12 + len;
        }
        return false;
      }
      if (n > 12 && str(0, 4) === 'RIFF' && str(8, 4) === 'WEBP') {   // WebP：ANIM があればアニメ
        for (let i = 12; i < Math.min(n - 4, 200); i++) if (str(i, 4) === 'ANIM') return true;
        return false;
      }
      return false;
    }).catch(() => true);
  }

  function trim(src) {
    return isAnimated(src).then(anim => anim ? 'KEEP' : loadImg(src)).then(im => {
      if (im === 'KEEP') return src;   // 動く画像：加工はしないが、大きさのフィットはかける
      if (!im) return null;
      try {
        const w = im.naturalWidth, h = im.naturalHeight;
        const sc = Math.min(1, SCAN_MAX / Math.max(w, h));
        const cw = Math.max(1, Math.round(w * sc)), ch = Math.max(1, Math.round(h * sc));
        const c = document.createElement('canvas'); c.width = cw; c.height = ch;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(im, 0, 0, cw, ch);
        const d = g.getImageData(0, 0, cw, ch).data;   // file:// だとここで例外 → 元の画像のまま
        let x0 = cw, y0 = ch, x1 = -1, y1 = -1;
        for (let y = 0; y < ch; y++) {
          for (let x = 0; x < cw; x++) {
            if (d[(y * cw + x) * 4 + 3] > ALPHA_TH) {
              if (x < x0) x0 = x; if (x > x1) x1 = x;
              if (y < y0) y0 = y; if (y > y1) y1 = y;
            }
          }
        }
        if (x1 < 0) return null;   // 真っ透明（何も描かれていない）
        // 縮小画像での範囲 → 元の大きさでの範囲（縮小で削れないよう1マスぶん外側に広げる）
        const px = Math.ceil(1 / sc);
        const sx = Math.max(0, Math.floor(x0 / sc) - px), sy = Math.max(0, Math.floor(y0 / sc) - px);
        const ex = Math.min(w, Math.ceil((x1 + 1) / sc) + px), ey = Math.min(h, Math.ceil((y1 + 1) / sc) + px);
        const bw = ex - sx, bh = ey - sy;
        const gain = Math.max(sx / w, sy / h, (w - ex) / w, (h - ey) / h);
        if (bw <= 0 || bh <= 0 || gain < MIN_GAIN) return src;   // ほとんど余白が無い → 切り取りは不要。でも大きさのフィットはかける（元のURLのまま）
        const k = Math.min(1, OUT_MAX / Math.max(bw, bh));
        const ow = Math.max(1, Math.round(bw * k)), oh = Math.max(1, Math.round(bh * k));
        const c2 = document.createElement('canvas'); c2.width = ow; c2.height = oh;
        c2.getContext('2d').drawImage(im, sx, sy, bw, bh, 0, 0, ow, oh);
        return new Promise(res => {
          if (c2.toBlob) c2.toBlob(b => res(b ? URL.createObjectURL(b) : null), 'image/png');
          else res(c2.toDataURL('image/png'));
        });
      } catch (e) { return src; }   // file:// 等で加工できない → 元の画像のままフィットだけかける
    });
  }

  function remember(src, url) {
    done.set(src, url);
    if (done.size <= KEEP_MAX) return;
    for (const [k, v] of done) {   // 古いものから捨てる（いま画面で使っている画像は捨てない）
      if (done.size <= KEEP_MAX) break;
      if (v && document.querySelector('img[src="' + v + '"]')) continue;
      if (v && v.startsWith('blob:')) { try { URL.revokeObjectURL(v); } catch (e) {} }
      done.delete(k);
    }
  }

  // 加工した画像のURLを返す（まだ準備できていなければ、元のURLでPromiseを返す）
  function prepare(src) {
    if (!ENABLED || !src) return Promise.resolve(null);
    if (done.has(src)) return Promise.resolve(done.get(src));
    if (pending.has(src)) return pending.get(src);
    const p = trim(src).then(url => { pending.delete(src); remember(src, url); return url; });
    pending.set(src, p);
    return p;
  }

  // 最初に img.src へ入れるURL（加工済みならそれ、まだなら元のまま）
  function srcFor(src) {
    if (!ENABLED || !src) return src;
    return (done.has(src) && done.get(src)) || src;
  }

  function mark(img, unit, url) {
    img.dataset.afOrig = img.dataset.afOrig || '';
    if (unit) unit.classList.add('autofit');
    if (img.getAttribute('src') !== url) img.src = url;   // 読み込み完了で fitEnemyImagesSoon が走る
    // 動く画像（APNG/GIF）や余白なしの画像は src が変わらず load も起きない → ここで明示的にフィットをかけ直す
    // （これが無いと、小さい原寸のまま（XSのような大きさ）で表示されてしまう）
    if (typeof window.fitEnemyImagesSoon === 'function') window.fitEnemyImagesSoon();
    else if (typeof fitEnemyImagesSoon === 'function') fitEnemyImagesSoon();
  }

  // renderEnemyUI から呼ぶ：img（敵画像）と unit（.enemy-unit）に自動フィットをかける
  function attach(img, unit, src) {
    if (!ENABLED || !img || !src) return;
    img.dataset.afOrig = src;
    if (done.has(src)) {
      const url = done.get(src);
      if (url) mark(img, unit, url);
      return;
    }
    // まだ加工前：一瞬「余白つきの大きい絵」が見えないよう、準備できるまで隠す（最長1.2秒）
    img.style.visibility = 'hidden';
    const show = () => { img.style.visibility = ''; };
    const timer = setTimeout(show, 1200);
    prepare(src).then(url => {
      clearTimeout(timer);
      if (url && img.dataset.afOrig === src && img.isConnected) mark(img, unit, url);
      show();
      if (typeof fitEnemyImagesSoon === 'function') fitEnemyImagesSoon();
    });
  }

  window.EnemyAutoFit = { enabled: ENABLED, prepare, srcFor, attach };
})();
