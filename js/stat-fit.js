// ============================================================
// 数字の自動フィット
//   HP・攻撃・回復の数字（6桁でも）が枠からはみ出さないよう、はみ出すときだけ文字を小さくする。
//   レイアウトは変えない（1行のまま）。
// ============================================================
(function () {
  'use strict';
  const IDS = ['te-stat-hp', 'te-stat-atk', 'te-stat-rec', 'de-total-hp', 'de-total-atk', 'de-total-rec', 'md-hp', 'md-atk', 'md-rec'];
  const MIN_PX = 7;
  let busy = false;

  function fit(el) {
    if (busy || !el) return;
    busy = true;
    try {
      el.style.fontSize = '';
      if (!el.clientWidth) return;                       // 画面が非表示のあいだは何もしない（表示されたら ResizeObserver が呼ぶ）
      let size = parseFloat(getComputedStyle(el).fontSize) || 16;
      while (el.scrollWidth > el.clientWidth + 0.5 && size > MIN_PX) {
        size -= 0.5;
        el.style.fontSize = size + 'px';
      }
    } finally { busy = false; }
  }

  function init() {
    IDS.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      new MutationObserver(() => fit(el)).observe(el, { childList: true, characterData: true, subtree: true });
      if (typeof ResizeObserver === 'function') new ResizeObserver(() => fit(el)).observe(el);
      fit(el);
    });
    window.addEventListener('resize', () => IDS.forEach(id => fit(document.getElementById(id))));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
