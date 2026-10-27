// ============================================================
// ★ スキル説明文の「画像化」 ★
//   リーダースキル／スキルの説明を、ゲーム内で表示するときだけ画像入りに変える。
//   データ（monsters.js）の文章はそのまま。ここの表を直せば全画面に反映される。
//
//   火ドロップ        → 1.png      （水=2 木=3 光=4 闇=5）
//   バランスタイプ    → typ4.png   （たいりょく=typ1 こうげき=typ2 かいふく/回復=typ3）
//   3色以上同時消し   → 3z.png     （4色=4z.png 5色=5z.png）
//   「5色同時に消すと」「4色以上同時に消すと」のように「以上」の有無どちらでも画像になる
//   5色以上+回復同時消し は文字のまま
//   画像が読み込めなかったときは、元の文字に戻る。
// ============================================================
(function () {
  const ATTR_NO = { '火': 1, '水': 2, '木': 3, '光': 4, '闇': 5 };
  const TYPE_NO = { 'たいりょく': 'typ1', 'こうげき': 'typ2', 'かいふく': 'typ3', '回復': 'typ3', 'バランス': 'typ4' };

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 画像タグ。読み込めない時は元の文字（alt）に差し替える
  const img = (src, alt, cls) =>
    `<img class="sk-ic ${cls}" src="${src}" alt="${esc(alt)}" data-alt="${esc(alt)}" draggable="false" ` +
    `onerror="this.replaceWith(document.createTextNode(this.dataset.alt))">`;

  function skillTextHTML(text) {
    let s = esc(text == null ? '' : text);

    // 「5色以上＋回復同時消し」は文字のまま残す（一時的に退避）
    const keep = [];
    s = s.replace(/5色(?:以上)?\s*[+＋]\s*回復[^、。，,\s]*?同時(?:に)?消(?:し|す)/g, m => { keep.push(m); return `\u0001${keep.length - 1}\u0002`; });

    // ○色以上同時消し（同時に消す／同時消し どちらの書き方も）
    s = s.replace(/([345])色(?:以上)?(?:を)?同時(?:に)?消(?:し|す)(?:と|ると)?/g, (m, n) => img(`${n}z.png`, m, 'sk-z'));   // 直後の「と」も一緒に消す

    // ○タイプ（「バランスタイプ」→ typ4 画像。「タイプ」の文字は消す）
    s = s.replace(/(たいりょく|こうげき|かいふく|回復|バランス)タイプ/g, (m, t) => img(`${TYPE_NO[t]}.png`, m, 'sk-type'));

    // ○ドロップ（「火ドロップ」「火と水ドロップ」「火属性ドロップ」など）
    s = s.replace(/((?:[火水木光闇])(?:属性)?(?:[・と、][火水木光闇](?:属性)?)*)(?:の)?ドロップ/g, (m, attrs) =>
      attrs.replace(/[火水木光闇]/g, a => img(`${ATTR_NO[a]}.png`, a, 'sk-orb')).replace(/属性/g, ''));

    // 退避した文字を戻す
    s = s.replace(/\u0001(\d+)\u0002/g, (m, i) => keep[+i]);
    return s;
  }

  // 要素に画像入りの説明文を入れる。numHL=true なら「1.5倍」「3%」などの数値を強調（リーダースキル欄用）
  function setSkillText(el, text, numHL) {
    if (!el) return;
    let html = skillTextHTML(text);
    if (numHL) html = html.replace(/(\d+(?:\.\d+)?(?:倍|%|％|秒))/g, '<b class="ls-num">$1</b>');
    el.innerHTML = html;
  }

  window.skillTextHTML = skillTextHTML;
  window.setSkillText = setSkillText;
})();
