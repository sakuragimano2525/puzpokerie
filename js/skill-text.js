// ============================================================
// ★ スキル説明文の「画像化」 ★
//   リーダースキル／スキルの説明を、ゲーム内で表示するときだけ画像入りに変える。
//   データ（monsters.js）の文章はそのまま。ここの表を直せば全画面に反映される。
//
//   火ドロップ        → 1.png      （水=2 木=3 光=4 闇=5）
//   火をちょうど4個消すと → [1.png]を[2way.png]で消すと（水・木・光・闇・毒・お邪魔も同様）
//   2コンボ以上=co1〜5.png（3コンボ以上=co1s〜co5s.png）／ ちょうど4個消し=2way.png
//   十字消し=ju.png L字消し=lg.png
//   回復ドロップ      → 6.png      （「回復ドロップの2コンボ」→ [6.png]の2コンボ）
//   毒ドロップ        → 8.png      お邪魔ドロップ → ojama.png
//   バランスタイプ    → typ4.png   （たいりょく=typ1 こうげき=typ2 かいふく=typ3）
//   3色以上同時消し   → 3z.png     （4色=4z.png 5色=5z.png）
//   「5色同時に消すと」「4色以上同時に消すと」のように「以上」の有無どちらでも画像になる
//   5色以上+回復同時消し は文字のまま
//   「水と光を同時に5個以上…」のように「ドロップ」なしでも、「を」の直後が「同時」「○個」なら属性は画像になる
//   画像が読み込めなかったときは、元の文字に戻る。
// ============================================================
(function () {
  const ATTR_NO = { '火': 1, '水': 2, '木': 3, '光': 4, '闇': 5 };
  // ドロップの画像ファイル（毒ドロップ=8.png／お邪魔ドロップ=ojama.png も画像で表示する）
  const ORB_IMG = { '火': '1.png', '水': '2.png', '木': '3.png', '光': '4.png', '闇': '5.png', '回復': '6.png', '毒': '8.png', 'お邪魔': 'ojama.png' };
  const TYPE_NO = { 'たいりょく': 'typ1', 'こうげき': 'typ2', 'かいふく': 'typ3', 'バランス': 'typ4', '神秘': 'typ5' };

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
    s = s.replace(/([345])色(?:以上)?(?:を)?同時(?:に)?消(?:し|す)(?:と|ると)?/g, (m, n) => img(`${n}z.png`, m, 'sk-z') + (/と$/.test(m) ? 'で' : ''));   // 画像は「○色以上同時消し」まで。直後の「と」は「で」に置き換える（例: [4z画像]で攻撃1.4倍）

    // 属性ごとのコンボ条件：「火ドロップの2コンボ以上」「火の2コンボ以上」→ co1.png（水=co2 木=co3 光=co4 闇=co5）
    //   2コンボ以上＝coN.png ／ 3コンボ以上＝coNs.png（それ以外のコンボ数は文字のまま）。直後の「で」は文字で残す
    s = s.replace(/([火水木光闇])(?:属性)?(?:ドロップ)?の([23])コンボ以上/g, (m, a, n) =>
      img(`co${ATTR_NO[a]}${n === '3' ? 's' : ''}.png`, `${a}の${n}コンボ以上`, 'sk-z'));   // alt に「○ドロップ」を入れない（後の変換で壊れるため）

    // 属性指定のちょうど4個消し：「火をちょうど4個消すと」→ [火]を[2way]で消すと ／「…消す度に」→ [火]を[2way]で消す度に
    //   火〜闇・毒・お邪魔どれも同じ（「火ドロップを…」と書いても可）
    s = s.replace(/(火|水|木|光|闇|回復|毒|お邪魔)(?:属性)?(?:の)?(?:ドロップ)?をちょうど4個消(す度に|すと)/g, (m, a, t) =>
      img(ORB_IMG[a], a, 'sk-orb') + 'を' + img('2way.png', 'ちょうど4個消し', 'sk-z') + (t === 'すと' ? 'で消すと' : 'で消す度に'));

    // 属性を消す度：「火を消す度に」→ [火]を消す度に（「火ドロップを消す度に」は下のドロップ変換で画像になる）
    s = s.replace(/(火|水|木|光|闇|回復|毒|お邪魔)(?:属性)?を消す度に/g, (m, a) => img(ORB_IMG[a], a, 'sk-orb') + 'を消す度に');

    // ちょうど4個消し（属性を指定しないもの）→ 2way.png
    //   「ドロップをちょうど4個消す度に」→ [2way]で消す度に ／「…消すと」「ちょうど4個消しで」→ [2way]で
    s = s.replace(/ドロップをちょうど4個消(す度に|すと)/g, (m, t) => img('2way.png', m, 'sk-z') + (t === 'すと' ? 'で' : 'で消す度に'));
    s = s.replace(/(^|[\n。、】])ちょうど4個消しで/g, (m, pre) => pre + img('2way.png', 'ちょうど4個消し', 'sk-z') + 'で');

    // 十字消し／L字消し → ju.png／lg.png（文字入りの画像）
    //   「水属性の十字消しをすると」→ [水]の[十字消し]をすると ／「十字消しする度に」→ [十字消し]する度に
    //   「十字/L字消しすると」→ [十字消し]/[L字消し]をすると（「を」がなければ補う）
    s = s.replace(/(?:([火水木光闇])(?:属性)?の)?(十字\/L字|十字|L字)消し(?=(する(?!度)|をする|を消す)?)/g, (m, attr, shape, tail) => {
      const one = n => (n === '十字' ? img('ju.png', '十字消し', 'sk-z') : img('lg.png', 'L字消し', 'sk-z'));
      const body = shape === '十字/L字' ? one('十字') + '/' + one('L字') : one(shape);
      const pre = attr ? img(ORB_IMG[attr], attr, 'sk-orb') + 'の' : '';
      return pre + body + (tail === "する" ? "を" : "");
    });

    // ○タイプ（「バランスタイプ」→ typ4 画像。「タイプ」の文字は消す）
    s = s.replace(/(たいりょく|こうげき|かいふく|バランス|神秘)タイプ/g, (m, t) => img(`${TYPE_NO[t]}.png`, m, 'sk-type'));

    // ○ドロップ（「火ドロップ」「火と水ドロップ」「火属性ドロップ」「毒ドロップ」「お邪魔ドロップ」など）
    s = s.replace(/((?:火|水|木|光|闇|回復|毒|お邪魔)(?:属性)?(?:[・と、](?:火|水|木|光|闇|回復|毒|お邪魔)(?:属性)?)*)(?:の)?ドロップ/g, (m, attrs) =>
      attrs.replace(/火|水|木|光|闇|回復|毒|お邪魔/g, a => img(ORB_IMG[a], a, 'sk-orb')).replace(/属性/g, ''));

    // 「ドロップ」が付かない属性名：「水と光を同時に5個以上繋げて消すと」「火を5個以上…」→ [水]と[光]を同時に…（「を」の直後が「同時」「○個」のとき）
    s = s.replace(/((?:火|水|木|光|闇|回復|毒|お邪魔)(?:属性)?(?:[・と、](?:火|水|木|光|闇|回復|毒|お邪魔)(?:属性)?)*)を(?=同時|\d+個)/g, (m, attrs) =>
      attrs.replace(/(火|水|木|光|闇|回復|毒|お邪魔)(?:属性)?/g, (x, a) => img(ORB_IMG[a], a, 'sk-orb')) + 'を');

    // 「ロック」の文字を lock.png に置き換える（「ブロック」など別の語は対象外）。読み込めない時は元の文字「ロック」に戻る
    s = s.replace(/(?<![ァ-ヶー])ロック(?![ァ-ヶー])/g, m => img('lock.png', 'ロック', 'sk-lock'));

    // 「スキル2に変化。」→ 青文字（変化スキル。数字は半角・全角どちらでも）
    s = s.replace(/スキル([0-9０-９]{1,2})に変化。?/g, m => `<span class="sk-change">${m}</span>`);

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

  // ── スキルの発動条件（skill.condition）の説明文 ──
  //   { type:'orbCount', attr:'fire', value:5 }  盤面に火ドロップが5個以上ある場合、使用可能。
  //   { type:'hpBelow', value:50 }               HP50%以下で使用可能。
  //   { type:'battleBefore', value:3 }           バトル3以前で使用可能。
  //   { type:'battleAfter', value:3 }            バトル3以降で使用可能。
  //   { type:'orbBoost', attr:'fire' }           火ドロップの目覚め中使用可能。
  //   attr は fire/water/wood/light/dark/heal/poison/ojama（毒・お邪魔も可）
  const COND_ORB = { fire: '火', water: '水', wood: '木', light: '光', dark: '闇', heal: '回復', poison: '毒', ojama: 'お邪魔' };
  function skillCondText(c) {
    if (!c || !c.type) return '';
    const o = COND_ORB[c.attr] || '火';
    const v = Math.max(0, Math.floor(Number(c.value) || 0));
    switch (c.type) {
      case 'orbCount':     return `盤面に${o}ドロップが${v || 1}個以上ある場合、使用可能。`;
      case 'hpBelow':      return `HP${v || 1}%以下で使用可能。`;
      case 'battleBefore': return `バトル${v || 1}以前で使用可能。`;
      case 'battleAfter':  return `バトル${v || 1}以降で使用可能。`;
      case 'orbBoost':     return `${o}ドロップの目覚め中使用可能。`;
    }
    return '';
  }
  // ── 変化スキル（skill.stages）──
  //   skill.stages = [ { name?, sp?, desc, effects:[…] }, … ]（スキル2〜スキル10。スキル1は skill 本体）
  //   スキル1 → 2 → … → 最後まで使うと、またスキル1に戻る。説明の「スキルXに変化。」は青文字で出す
  const stageNo = n => n + 2;   // stages[0] = スキル2
  function skillStagesHTML(skill) {
    const st = skill && Array.isArray(skill.stages) ? skill.stages : [];
    if (!st.length) return '';
    return st.map((s, i) => {
      const nm = s.name && s.name !== skill.name ? '　' + esc(s.name) : '';
      const sp = (typeof s.sp === 'number' && s.sp >= 1) ? s.sp : (skill.sp || 1);
      return `<div class="sk-stage"><div class="sk-stage-h">スキル${stageNo(i)}${nm}　必要SP ${sp}</div>${skillTextHTML(s.desc || '')}</div>`;
    }).join('');
  }
  // ── 変化スキルの「全段階の一覧」（スキル確認・変化スキル一覧ポップアップ用）──
  //   skill は monsters.js の skill 本体（stages つき）。cur = 今のスキル番号（0=スキル1）。
  //   cur を渡すと、その段階に「いま」の印と強調がつき、それ以外は少し薄く出る。cur を省略（-1）すると印なしの一覧。
  //   発動条件はスキル1だけのものなので、スキル1の枠の中に出す。
  //   only = [段階番号…] を渡すと、その段階だけを出す（長押し説明の「次のスキル」用）。tag を渡すと、その段階に「次」などのバッジをつける
  function skillStageListHTML(skill, cur, only, tag) {
    const st = skill && Array.isArray(skill.stages) ? skill.stages : [];
    if (!st.length) return '';
    const items = [{ name: skill.name, sp: skill.sp, desc: skill.desc, cond: skill.condition }]
      .concat(st.map(s => ({ name: s.name || skill.name, sp: (typeof s.sp === 'number' && s.sp >= 1) ? s.sp : skill.sp, desc: s.desc, cond: null })));
    const showName = items.some(x => x.name !== items[0].name);   // 全段階が同じ名前なら、名前は繰り返さない
    const cI = (typeof cur === 'number' && cur >= 0) ? cur % items.length : -1;
    const idxs = Array.isArray(only) ? only.filter(i => i >= 0 && i < items.length) : items.map((x, i) => i);
    return `<div class="sk-sl${cI >= 0 ? ' has-cur' : ''}">` + idxs.map(i => {
      const x = items[i];
      const sp = (typeof x.sp === 'number' && x.sp >= 1) ? x.sp : 1;
      const ct = skillCondText(x.cond);
      return `<div class="sk-sl-item${i === cI ? ' is-cur' : ''}" data-stage="${i}">` +
        `<div class="sk-sl-h"><span class="sk-sl-no">スキル${i + 1}</span>` +
        (showName && x.name ? `<span class="sk-sl-name">${esc(x.name)}</span>` : '') +
        `<span class="sk-sl-sp">必要SP ${sp}</span>` +
        (i === cI ? '<span class="sk-sl-now">いま</span>' : '') +
        (tag && i !== cI ? `<span class="sk-sl-next">${esc(tag)}</span>` : '') + `</div>` +
        (ct ? `<span class="sk-cond">${skillTextHTML(ct)}</span>` : '') +
        `<div class="sk-sl-desc">${skillTextHTML(x.desc || '')}</div></div>`;
    }).join('') + `</div>`;
  }

  // スキルの説明を入れる。発動条件があれば、必ず先頭に青文字で出す。変化スキルなら、スキル1〜Xを順に並べる
  //   opts.list = true      … 変化スキルは、全段階の一覧（skillStageListHTML）にする。opts.cur = 今のスキル番号
  //   opts.noStages = true  … 変化スキルでも、スキル1だけを出す（段階の一覧は別のボタンで見せる画面用）
  function setSkillDesc(el, skill, numHL, opts) {
    if (!el) return;
    const o = opts || {};
    if (o.list && skill && Array.isArray(skill.stages) && skill.stages.length) { el.innerHTML = skillStageListHTML(skill, o.cur); return; }
    setSkillText(el, skill && skill.desc, numHL);
    const stages = o.noStages ? '' : skillStagesHTML(skill);
    if (stages) el.innerHTML = `<div class="sk-stage-h">スキル1　必要SP ${(skill && skill.sp) || 1}</div>` + el.innerHTML + stages;
    const ct = skillCondText(skill && skill.condition);
    if (ct) el.innerHTML = `<span class="sk-cond">${skillTextHTML(ct)}</span>` + el.innerHTML;
  }

  window.skillCondText = skillCondText;
  window.setSkillDesc = setSkillDesc;
  window.skillTextHTML = skillTextHTML;
  window.setSkillText = setSkillText;
  window.skillStagesHTML = skillStagesHTML;
  window.skillStageListHTML = skillStageListHTML;
})();
