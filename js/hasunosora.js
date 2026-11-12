/* ============================================================
   蓮ノ空コラボ（イベント画面の「蓮ノ空コラボ」ボタン → この全画面が開く）
   ・ボタンは3つ：蓮ノ空コラボ-1 / -2 / -BOSS  →  ダンジョン hasu-1 / hasu-2 / hasu-boss に対応
   ・ステージの中身は ダンジョン設定ツールで「hasu-1」「hasu-2」「hasu-boss」を作って dungeons.js を差し替えるだけ
     （まだ作っていないステージのボタンは「準備中」。作ると自動で押せるようになる）
   ・前のステージをクリアすると次のボタンが解放される（-1 → -2 → -BOSS）
   ・右下の「コラボガチャ」ボタン → 蓮ノ空ガチャ（ガチャ5ページ目）へ。もどるとこの画面に戻る
   ・イベントID（hasu）は js/data/areas.js の EVENT_AREA_DATA.hasu
   ============================================================ */
const HASU_COLLAB = {
  title: '蓮ノ空コラボ',
  eventId: 'hasu',
  stages: [
    { key: '1',    name: '蓮ノ空コラボ-1' },
    { key: '2',    name: '蓮ノ空コラボ-2' },
    { key: 'boss', name: '蓮ノ空コラボ-BOSS' },
  ],
};

(function () {
  const $ = id => document.getElementById(id);
  let toastTimer = null;

  function toast(msg) {
    const t = $('hasu-toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
  }

  function dungeonKey(st) { return HASU_COLLAB.eventId + '-' + st.key; }
  function hasDungeon(st) { return typeof DUNGEON_DATA !== 'undefined' && !!DUNGEON_DATA[dungeonKey(st)]; }
  function isCleared(st) {
    return typeof isStageCleared === 'function' && isStageCleared(HASU_COLLAB.eventId, st.key);
  }

  function renderStages() {
    const box = $('hasu-stages'); if (!box) return;
    box.innerHTML = '';
    const list = HASU_COLLAB.stages;
    list.forEach((s, i) => {
      const prev = i > 0 ? list[i - 1] : null;
      const ready = hasDungeon(s);                       // ダンジョンが作ってあるか
      const locked = ready && !!prev && !isCleared(prev); // 前のステージ未クリアなら鍵
      const cleared = ready && isCleared(s);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'hasu-stage' + ((ready && !locked) ? '' : ' soon') + (locked ? ' locked' : '');
      b.innerHTML = '<span class="hs-no"></span><span class="hs-txt"><b class="hs-name"></b><span class="hs-sub"></span></span><span class="hs-go"></span>';
      b.querySelector('.hs-no').textContent = s.key === 'boss' ? '★' : s.key;
      b.querySelector('.hs-name').textContent = s.name;
      b.querySelector('.hs-sub').textContent = !ready ? '準備中' : locked ? (prev.name + ' をクリアで解放') : cleared ? 'クリア済み' : 'タップで挑戦';
      b.querySelector('.hs-go').textContent = !ready ? '…' : locked ? '🔒' : '▶';
      b.addEventListener('click', () => {
        if (!ready) { toast('このステージは準備中です'); return; }
        if (locked) { toast(prev.name + ' をクリアすると解放されます'); return; }
        window.HASU_BACK_TO_COLLAB = true;             // 出撃準備の「戻る」で、通常のステージ選択ではなくこの画面に戻す（game.js の de-back-btn が見る）
        closeHasuCollab(true);
        openDungeonEntry(HASU_COLLAB.eventId, s.key);  // 押したステージの出撃準備へ直行
      });
      box.appendChild(b);
    });
  }

  function buildPetals() {
    const p = $('hasu-petals'); if (!p || p.childElementCount) return;
    for (let i = 0; i < 14; i++) {
      const e = document.createElement('i');
      e.style.left = (Math.random() * 100) + '%';
      e.style.setProperty('--dx', (Math.random() * 90 - 20) + 'px');
      e.style.animationDuration = (7 + Math.random() * 7) + 's';
      e.style.animationDelay = (-Math.random() * 12) + 's';
      e.style.transform = 'scale(' + (0.7 + Math.random() * 0.8) + ')';
      p.appendChild(e);
    }
  }

  window.openHasuCollab = function () {
    const s = $('hasu-screen'); if (!s) return;
    const t = s.querySelector('.hasu-title');
    if (t) t.textContent = HASU_COLLAB.title;
    buildPetals(); renderStages();
    s.style.display = 'flex';            // 先にこの画面を出してからホームを隠す（間に下地が見えない）
    $('home').style.display = 'none';
    const sc = s.querySelector('.hasu-scroll'); if (sc) sc.scrollTop = 0;
  };
  window.closeHasuCollab = function (keepHomeHidden) {
    const s = $('hasu-screen'); if (!s) return;
    if (!keepHomeHidden) $('home').style.display = 'flex';   // 先にホームを出してからこの画面を隠す
    s.style.display = 'none';
  };

  // 右下の「コラボガチャ」：蓮ノ空ガチャ（ガチャの5ページ目）へ直接とぶ。
  //   ガチャ画面は、この画面の上に重ねて開く → ガチャの「もどる」でこの画面（ステージ選択）に戻る（ホームには戻らない）
  const gbtn = $('hasu-gacha-btn');
  if (gbtn) gbtn.addEventListener('click', () => {
    if (window.GachaScreen) GachaScreen.open(5);
    else toast('ガチャは準備中です');
  });

  // ホームが表示されたら（バトル後・ホームへ戻ったときなど）、「蓮ノ空に戻る」の目印はリセット
  const homeEl = $('home');
  if (homeEl) new MutationObserver(() => { if (homeEl.style.display === 'flex') window.HASU_BACK_TO_COLLAB = false; })
    .observe(homeEl, { attributes: true, attributeFilter: ['style'] });

  const back = $('hasu-back-btn');
  if (back) back.addEventListener('click', () => window.closeHasuCollab());
})();
