// ============================================================
// 画像の読み込み失敗を自動でやり直す（たまに画像が「読み込みエラー」になる対策）
//   ★ index.html の <head> で読み込む（ページ前半の <img> の失敗も拾うため）
//   ・失敗した <img> を 0.4→1→2→4→8→15秒後に最大6回やり直す
//   ・エラーイベントを取りこぼした画像も、定期チェックで「壊れた画像」を見つけて再読み込み
//   ・回線復帰(online)・タブ復帰・ページ復帰のときは、あきらめた画像ももう一度挑戦
//   ・成功したら、読み込み失敗時に隠された画像（display:none など）を元に戻す
//   ・本当にファイルが無い場合は、6回やり直してから諦める（今まで通り非表示）
// ============================================================
(function () {
  const DELAYS = [400, 1000, 2000, 4000, 8000, 15000];
  const MAX = DELAYS.length;

  function baseOf(u) { return u.replace(/([?&])_r=\d+(&|$)/, (m, a, b) => (b ? a : '')).replace(/[?&]$/, ''); }
  function withRetry(u, n) { const b = baseOf(u); return b + (b.includes('?') ? '&' : '?') + '_r=' + n; }

  function schedule(im) {
    const src = im.getAttribute('src');
    if (!src || /^(data:|blob:)/.test(src) || /\.svg(\?|$)/i.test(src)) return;
    const base = baseOf(src);
    if (im._rBase !== base) { im._rBase = base; im._rN = 0; im._rTok = null; }   // 別の画像に差し替わったら数え直す
    if (im._rTok || im._rN >= MAX) return;
    const n = im._rN++;
    const tok = im._rTok = {};
    setTimeout(function () {
      if (im._rTok !== tok) return;
      im._rTok = null;
      if (im.getAttribute('src') !== src) return;             // 他の処理が別の画像に差し替え済みなら何もしない
      if (im.complete && im.naturalWidth > 0) return;         // すでに読み込めていれば何もしない
      im.dataset.retrying = '1';
      im.src = withRetry(src, n + 1);
    }, DELAYS[n]);
  }

  // 1) 失敗した瞬間に拾う（error は bubble しないので capture で受ける）
  window.addEventListener('error', function (e) {
    const im = e.target;
    if (!im || im.tagName !== 'IMG') return;
    schedule(im);
  }, true);

  // 2) 成功したら、失敗時に隠された分を元に戻す
  window.addEventListener('load', function (e) {
    const im = e.target;
    if (!im || im.tagName !== 'IMG') return;
    im._rN = 0; im._rTok = null;
    if (!im.dataset || !im.dataset.retrying) return;
    delete im.dataset.retrying;
    im.style.display = '';
    im.style.visibility = '';
  }, true);

  // 3) 取りこぼし対策：壊れたままの画像を探してやり直す
  function sweep(reset) {
    const list = document.images;
    for (let i = 0; i < list.length; i++) {
      const im = list[i];
      if (!im.complete || im.naturalWidth > 0 || !im.getAttribute('src')) continue;
      if (reset) { im._rN = 0; im._rTok = null; }
      schedule(im);
    }
  }
  document.addEventListener('DOMContentLoaded', function () { sweep(false); });
  window.addEventListener('load', function () { sweep(false); });
  setInterval(function () { if (!document.hidden) sweep(false); }, 4000);

  // 4) 回線が戻った・画面に戻ってきたときは、あきらめた画像ももう一度
  window.addEventListener('online', function () { sweep(true); });
  window.addEventListener('pageshow', function () { sweep(true); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) sweep(true); });
})();
