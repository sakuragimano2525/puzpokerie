// ============================================================
// ★ 進化パズル（パズドラZ風）★
//   進化画面の「進化させる」→ このパズル画面 → 完成したら進化の演出（js/evo-scene.js）へ。
//   ・パズルの画像は「進化した先」の通常画像 m{id}.png（例: フシギソウ(ID2) → m2.png）
//   ・お手本（同じ画像）を画面の上・真ん中に小さく表示。押している間は盤面に大きく表示
//   ・5×5 = 25ピース。最初は全部のピースが正しい位置からずれている（バラバラ）
//   ・ピースをドラッグして別のピースと入れ替え（タップ → タップでも入れ替え可）
//   ・完成したら、右下の「進化させる」ボタンが押せるようになる（押すと進化の演出へ）
//   ・進化先がすでに図鑑に登録されているモンスターは、パズルをしなくてもボタンが押せる（スキップ）
//   ・途中で戻っても素材は減らない（進化が実行されるのは、演出の10秒目）
// ============================================================
(function () {
  const N = 5;
  const TOTAL = N * N;

  const screen   = document.getElementById('evo-puzzle');
  const board    = document.getElementById('pz-board');
  const movesEl  = document.getElementById('pz-moves');
  const nameEl   = document.getElementById('pz-name');
  const loadEl   = document.getElementById('pz-loading');
  const clearEl  = document.getElementById('pz-clear');
  const prevEl   = document.getElementById('pz-preview');
  const sampleEl = document.getElementById('pz-sample');
  const sampleImg = document.getElementById('pz-sample-img');
  const backBtn  = document.getElementById('pz-back-btn');
  const evoBtn   = document.getElementById('pz-evo-btn');
  const hintEl   = document.getElementById('pz-hint');
  const HINT_TEXT = hintEl ? hintEl.innerHTML : '';
  if (!screen || !board) return;

  // perm[マス番号] = そのマスにあるピース番号（ピース番号 = 正しいマス番号）
  const pz = { perm: [], moves: 0, sel: null, drag: null, busy: false, token: 0, pieces: [], url: '', kw: 1, kh: 1, fromMon: null, toMon: null, solved: false, skip: false };

  // ---------- 画像の読み込み（候補を順に試す → 全部ダメなら自動生成の絵） ----------
  function tryLoad(url) {
    return new Promise(resolve => {
      const im = new Image();
      im.onload  = () => resolve(im.naturalWidth > 0 ? { url, w: im.naturalWidth, h: im.naturalHeight } : null);
      im.onerror = () => resolve(null);
      im.src = url;
    });
  }
  async function loadWithRetry(url) {
    let r = await tryLoad(url);
    if (r) return r;
    await new Promise(res => setTimeout(res, 400));
    return tryLoad(url + (url.includes('?') ? '&' : '?') + '_p=1');
  }
  async function loadFirst(cands, mon) {
    const seen = [];
    for (const u of cands) {
      if (!u || seen.includes(u)) continue;
      seen.push(u);
      const r = await loadWithRetry(u);
      if (r) return r;
    }
    return makePlaceholder(mon);
  }
  // 画像が1枚も見つからないときの代わりの絵（これでも進化はできる）
  function makePlaceholder(mon) {
    const S = 600, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const col = { fire: '#ff5a3d', water: '#2b86ff', wood: '#22b866', light: '#ffb400', dark: '#8a5cf6' }[mon && mon.attr] || '#2b86ff';
    const grad = g.createLinearGradient(0, 0, S, S);
    grad.addColorStop(0, col); grad.addColorStop(1, '#1c1f4f');
    g.fillStyle = grad; g.fillRect(0, 0, S, S);
    g.fillStyle = 'rgba(255,255,255,0.14)';
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if ((i + j) % 2 === 0) g.fillRect(i * S / N, j * S / N, S / N, S / N);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 54px sans-serif';
    g.fillText((mon && mon.name) || '', S / 2, S / 2);
    g.font = '700 22px sans-serif';
    for (let i = 0; i < TOTAL; i++) g.fillText(String(i + 1), (i % N + 0.5) * S / N, (Math.floor(i / N) + 0.15) * S / N);
    return { url: c.toDataURL('image/png'), w: S, h: S };
  }
  // 演出（js/evo-scene.js）からも使う
  window.evoLoadFirst = loadFirst;

  // パズルの画像：進化後の通常画像（m{id}.png）。無ければ mp{id}.png
  function puzzleCandidates(toMon) {
    const c = [];
    try { c.push(monsterImg(toMon)); } catch (e) {}
    c.push(`mp${toMon.id}.png`);
    return c;
  }

  // ---------- 盤面 ----------
  // 全部のピースが正しい位置にない並び（完全順列）を作る
  function scramble() {
    let a;
    do {
      a = Array.from({ length: TOTAL }, (_, i) => i);
      for (let i = TOTAL - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
    } while (a.some((p, i) => p === i));
    return a;
  }

  // 画像が正方形でないときは、中央を正方形に切り取って使う（cover）
  function bgStyle(el, p, kw, kh) {
    const c = p % N, r = Math.floor(p / N);
    el.style.backgroundSize = `${kw * N * 100}% ${kh * N * 100}%`;
    const px = (c + (N / 2) * (kw - 1)) / (N * kw - 1) * 100;
    const py = (r + (N / 2) * (kh - 1)) / (N * kh - 1) * 100;
    el.style.backgroundPosition = `${px}% ${py}%`;
  }

  function buildBoard() {
    board.querySelectorAll('.pz-piece').forEach(e => e.remove());
    pz.pieces = [];
    for (let p = 0; p < TOTAL; p++) {
      const el = document.createElement('div');
      el.className = 'pz-piece';
      el.dataset.p = p;
      el.style.backgroundImage = `url("${pz.url}")`;
      bgStyle(el, p, pz.kw, pz.kh);
      board.appendChild(el);
      pz.pieces[p] = el;
    }
    layout();
  }

  function layout() {
    pz.perm.forEach((p, cell) => {
      const el = pz.pieces[p];
      el.style.left = (cell % N) * (100 / N) + '%';
      el.style.top = Math.floor(cell / N) * (100 / N) + '%';
      el.classList.toggle('sel', pz.sel === p);
    });
    movesEl.textContent = pz.moves;
  }

  function swapCells(a, b) {
    if (a === b) return;
    [pz.perm[a], pz.perm[b]] = [pz.perm[b], pz.perm[a]];
    pz.moves++;
    try { playTapSound(); } catch (e) {}
    layout();
    if (pz.perm.every((p, i) => p === i)) onSolved();
  }

  // ---------- 完成 → 「進化させる」ボタンが押せるようになる ----------
  function onSolved() {
    pz.busy = true;
    pz.solved = true;
    pz.sel = null;
    if (pz.drag) { pz.drag.el.classList.remove('drag'); pz.drag.el.style.transform = ''; pz.drag = null; }
    layout();
    board.classList.add('done');
    clearEl.classList.remove('play'); void clearEl.offsetWidth; clearEl.classList.add('play');
    clearEl.style.display = 'flex';
    // （COMPLETE! の効果音は鳴らさない）
    evoBtn.disabled = false;
  }

  // 右下「進化させる」→ 進化の演出へ
  evoBtn.addEventListener('click', () => {
    if ((!pz.solved && !pz.skip) || evoBtn.disabled) return;
    evoBtn.disabled = true;                    // 二重タップ防止
    const from = pz.fromMon, to = pz.toMon;
    if (typeof window.startEvoScene === 'function') {
      window.startEvoScene(from, to);          // 「○○の ようすが…」→ 次へ → 進化演出（10秒目に進化を実行）
      closePuzzle();
    } else {
      closePuzzle();
      if (typeof executeEvolution === 'function') executeEvolution();
    }
  });

  // ---------- 操作（ドラッグ入れ替え / タップ → タップ入れ替え） ----------
  function cellAt(clientX, clientY, rect) {
    const cx = Math.min(N - 1, Math.max(0, Math.floor((clientX - rect.left) / (rect.width / N))));
    const cy = Math.min(N - 1, Math.max(0, Math.floor((clientY - rect.top) / (rect.height / N))));
    return cy * N + cx;
  }
  function clearTarget() { board.querySelectorAll('.pz-piece.target').forEach(e => e.classList.remove('target')); }

  board.addEventListener('pointerdown', (e) => {
    if (pz.busy || pz.drag) return;
    const el = e.target.closest('.pz-piece');
    if (!el) return;
    e.preventDefault();
    const p = Number(el.dataset.p);
    pz.drag = { p, el, cell: pz.perm.indexOf(p), sx: e.clientX, sy: e.clientY, moved: false, id: e.pointerId, rect: board.getBoundingClientRect(), hover: -1 };
    try { board.setPointerCapture(e.pointerId); } catch (err) {}
  });

  board.addEventListener('pointermove', (e) => {
    const d = pz.drag;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) > 8) {
      d.moved = true;
      pz.sel = null; layout();
      d.el.classList.add('drag');
    }
    if (!d.moved) return;
    d.el.style.transform = `translate(${dx}px, ${dy}px) scale(1.06)`;
    const h = cellAt(e.clientX, e.clientY, d.rect);
    if (h !== d.hover) {
      clearTarget();
      d.hover = h;
      if (h !== d.cell) pz.pieces[pz.perm[h]].classList.add('target');
    }
  });

  function endDrag(e, cancelled) {
    const d = pz.drag;
    if (!d || e.pointerId !== d.id) return;
    pz.drag = null;
    try { board.releasePointerCapture(d.id); } catch (err) {}
    clearTarget();
    d.el.classList.remove('drag');
    d.el.style.transform = '';
    if (cancelled) { layout(); return; }
    if (d.moved) {
      const t = cellAt(e.clientX, e.clientY, d.rect);
      if (t !== d.cell) swapCells(d.cell, t); else layout();
    } else {
      // タップ：1つ目を選ぶ → 2つ目をタップで入れ替え（同じピースをもう一度タップで選択解除）
      if (pz.sel === null) pz.sel = d.p;
      else if (pz.sel === d.p) pz.sel = null;
      else { const a = pz.perm.indexOf(pz.sel); pz.sel = null; swapCells(a, d.cell); return; }
      layout();
    }
  }
  board.addEventListener('pointerup', (e) => endDrag(e, false));
  board.addEventListener('pointercancel', (e) => endDrag(e, true));
  board.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---------- お手本（上の小さい画像を押している間、盤面に大きく表示） ----------
  const showPrev = (on) => { prevEl.style.display = on && !pz.busy && pz.url ? 'block' : 'none'; };
  sampleEl.addEventListener('pointerdown', (e) => { e.preventDefault(); showPrev(true); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => sampleEl.addEventListener(ev, () => showPrev(false)));
  sampleEl.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---------- 開く / 閉じる ----------
  async function openPuzzle(fromMon, toMon) {
    const token = ++pz.token;
    pz.busy = true; pz.solved = false; pz.sel = null; pz.drag = null; pz.moves = 0; pz.url = '';
    pz.fromMon = fromMon; pz.toMon = toMon;
    // 進化先がすでに図鑑に登録されている（いちど進化させた）なら、パズルをしなくても進化できる
    pz.skip = !!(window.Zukan && Zukan.isOwned && Zukan.isOwned(toMon.id));
    evoBtn.disabled = !pz.skip;
    hintEl.innerHTML = pz.skip ? '図鑑に登録ずみ！<br>パズルをとばして進化できます' : HINT_TEXT;
    board.classList.remove('done');
    clearEl.style.display = 'none';
    prevEl.style.display = 'none';
    board.querySelectorAll('.pz-piece').forEach(e => e.remove());
    sampleImg.removeAttribute('src');
    movesEl.textContent = '0';
    nameEl.textContent = toMon.name;
    loadEl.style.display = 'flex';
    screen.style.display = 'flex';

    // 演出の準備（画像と音）を先に始めておく
    try { if (typeof window.prepareEvoScene === 'function') window.prepareEvoScene(fromMon, toMon); } catch (e) {}

    const img = await loadFirst(puzzleCandidates(toMon), toMon);
    if (token !== pz.token) return;              // 読み込み中に戻られた
    const m = Math.min(img.w, img.h) || 1;
    pz.url = img.url; pz.kw = img.w / m; pz.kh = img.h / m;
    sampleImg.src = img.url;
    prevEl.style.backgroundImage = `url("${img.url}")`;
    prevEl.style.backgroundSize = 'cover';
    pz.perm = scramble();
    buildBoard();
    loadEl.style.display = 'none';
    pz.busy = false;
  }
  function closePuzzle() {
    pz.token++;                                  // 読み込み中・完成待ちの処理を無効にする
    pz.busy = false; pz.solved = false; pz.skip = false; pz.drag = null;
    evoBtn.disabled = true;
    screen.style.display = 'none';
    board.classList.remove('done');
    clearEl.style.display = 'none';
  }
  backBtn.addEventListener('click', closePuzzle);

  // game.js の「進化させる」ボタンから呼ばれる
  window.startEvoPuzzle = function () {
    const entry = box.find(b => b.uid === evoEntryUid);
    if (!entry) return;
    const evo = getEvolutions(entry.monsterId)[evoIndex];
    if (!evo || !canEvolve(evo, entry)) return;
    openPuzzle(MONSTER_DATA[entry.monsterId], MONSTER_DATA[evo.to]);
  };
})();
