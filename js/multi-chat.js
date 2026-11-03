// ============================================================
// マルチ：定型文チャット
//   ダンジョン内のエナの右の「💬」ボタン → 定型文を選ぶ → 自分と相手の画面の「右の真ん中」に約3秒表示＋ chat.mp3
//   （通信は MultiOnline.sendChat / onChat。game.js の onChat から MultiChat.receive が呼ばれる）
//   定型文を足すときは PHRASES に1行足すだけ
// ============================================================
(function () {
  const PHRASES = ['ナイス！', '攻撃して！', '倒さないで！', '回復して！', 'リタイアして！', 'ニャオニクス亜種', 'いいパズル！', '回復残して！', 'ラッキー！', 'アーリャ！', 'マーシャ！'];
  const SHOW_MS = 3000;
  const COOLDOWN_MS = 1200;   // 連打防止
  const $ = id => document.getElementById(id);
  let lastSent = 0, hideTimer = null;

  function senderName(seat) { return (window.MultiTurn && MultiTurn.name) ? MultiTurn.name(seat) : ''; }

  function show(seat, idx) {
    const text = PHRASES[idx];
    const g = $('game');
    if (!text || !g) return;
    let el = $('mt-chat-msg');
    if (!el) { el = document.createElement('div'); el.id = 'mt-chat-msg'; g.appendChild(el); }
    const me = window.MultiTurn && MultiTurn.localId === seat;
    el.className = 'p' + seat;
    el.innerHTML = '';
    const who = document.createElement('span'); who.className = 'mc-who'; who.textContent = senderName(seat) + (me ? '(あなた)' : '');
    const tx = document.createElement('span'); tx.className = 'mc-text'; tx.textContent = text;
    el.append(who, tx);
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => el.classList.remove('on'), SHOW_MS);
    try { playSE('chat'); } catch (e) {}
  }

  function closeMenu() { const m = $('mt-chat-menu'); if (m) m.classList.remove('on'); }
  function buildMenu() {
    let m = $('mt-chat-menu');
    if (m) return m;
    m = document.createElement('div'); m.id = 'mt-chat-menu';
    PHRASES.forEach((t, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = t;
      b.addEventListener('click', e => { e.stopPropagation(); send(i); });
      m.appendChild(b);
    });
    m.addEventListener('click', e => e.stopPropagation());
    $('game').appendChild(m);
    return m;
  }
  function send(idx) {
    const now = Date.now();
    if (now - lastSent < COOLDOWN_MS) return;
    if (!window.MultiOnline || !MultiTurn.online || MultiTurn.localId === null) return;
    lastSent = now;
    closeMenu();
    try { MultiOnline.sendChat(idx); } catch (e) {}
    show(MultiTurn.localId, idx);   // 自分の画面にも出す
  }

  window.MultiChat = {
    PHRASES,
    receive(v) {
      if (!v || !window.MultiTurn || !MultiTurn.active || !MultiTurn.online) return;
      show(v.by, v.i);
    },
  };

  document.addEventListener('DOMContentLoaded', () => {});
  const btn = $('mt-chat-btn');
  if (btn) {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const m = buildMenu();
      m.classList.toggle('on');
    });
  }
  document.addEventListener('pointerdown', e => {
    const m = $('mt-chat-menu');
    if (m && m.classList.contains('on') && !m.contains(e.target) && e.target !== btn) closeMenu();
  }, true);
  // マルチが終わったら閉じる
  setInterval(() => { if (!(window.MultiTurn && MultiTurn.active && MultiTurn.online)) { closeMenu(); const el = $('mt-chat-msg'); if (el) el.classList.remove('on'); } }, 1000);
})();
