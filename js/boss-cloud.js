// ============================================================
// ★ ラスボス演出：「暗転 → 雲の中に入る → 雲がゆっくり晴れて、ラスボスの背景があらわれる」 ★
//
//   BOSS 表記（菱形バナー）が出たあと、道中の背景から ラスボス専用の背景 に切り替える演出です。
//   雲が晴れていく途中でボスBGMが流れはじめ、晴れきったらボスが登場します。
//
//   ◆ 使いたいダンジョンを増やすとき
//       BOSS_CLOUD_STAGES に  'ダンジョンキー': '背景画像'  を1行足すだけ。
//       例）'14-boss': 'dungeon14.png'
//
//       ラスボス用の特別版は、文字列の代わりに { } で書きます（15-boss を参照）
//         bg       … 背景画像
//         banner   … 'last' にすると BOSS バナーが「紫の波動 ＋ LAST BOSS」表記になる
//         transition … 'cave' にすると、雲の代わりに「ハナダの洞窟」の切り替え演出になる（省略すると雲）
//         via        … 洞窟の演出で最初に映す絵（奥の光るトンネルへ近づいていく）。例）'dungeon15.png'
//         entrance … 'mewtwo' にすると、背景が出たあとミュウツーが念力で現れる登場演出になる
//                    ミュウツーが完全に出てきたところで効果音 mewtwo.mp3 が鳴る（game.js の BATTLE_SE）
//
//   ◆ サンダー／フリーザー／ファイヤーの登場演出（背景は変えない）は BOSS_INTRO_STAGES（下のほう）
//
//   ◆ 速さ・長さの調整は下の BOSS_CLOUD_TIMING（ミリ秒）
//
//   ※ ダンジョン設定ツール（dungeon-editor）で dungeons.js を作り直しても、
//      この設定は別ファイルなので消えません。
// ============================================================
const BOSS_CLOUD_STAGES = {
  '14-boss': 'dungeon14.png',
  // ★ 最終ボス（ミュウツー）：ハナダの洞窟の切り替え → 背景 dungeon15-1.png ／ 紫の波動の LAST BOSS バナー ／ ミュウツー登場演出
  '15-boss': { bg: 'dungeon15-1.png', banner: 'last', entrance: 'mewtwo', transition: 'cave', via: 'dungeon15.png' },
};

const BOSS_CLOUD_TIMING = {
  dark:      900,    // ① 画面が暗くなる
  darkHold:  250,    //    真っ暗のまま少し待つ
  cloudIn:   1700,   // ② 暗闇から雲の中へ（雲がせまってくる）
  cloudHold: 700,    //    雲で真っ白のあいだに背景を入れ替える
  clear:     5600,   // ③ 雲がゆっくり晴れていく（長いほどゆっくり）
  bgmAt:     0.5,    //    晴れる途中のこの割合（0〜1）でボスBGMを流す
};

// ハナダの洞窟の切り替え演出の速さ・長さ（ミリ秒）
const BOSS_CAVE_TIMING = {
  dark:     700,    // ① 画面が暗くなる
  darkHold: 200,    //    真っ暗のまま少し待つ
  zoom:     3600,   // ② 洞窟の絵が浮かび、奥の紫に光るトンネルへ近づく（長いほどゆっくり）
  hold:     350,    //    紫の光で画面がうまっているあいだに背景を入れ替える
  clear:    3600,   // ③ 光がうすれて、背景があらわれる（紫の波動つき）
  bgmAt:    0.4,    //    晴れる途中のこの割合（0〜1）でボスBGMを流す
};

// ============================================================
// ★ 伝説の鳥の登場演出：どのダンジョンで、どの鳥の演出を出すか ★
//   背景は変えません。BOSS バナーのあと、ボスが「その鳥らしい演出」で登場します。
//   ボスBGMは、姿があらわれる瞬間に流れはじめます（それまでは無音）。
//
//     'thunder' … サンダー：暗い雲 → 稲妻が3本おちて、3本目の直撃で姿があらわれる
//     'freezer' … フリーザー：冷気 → 氷の柱と氷塊に閉じこめられ、ひび割れて砕け散る
//     'fire'    … ファイヤー：足もとから炎 → 炎が集まって爆発し、翼をひろげる
//
//   ◆ 増やすとき：  'ダンジョンキー': 'thunder' / 'freezer' / 'fire'  を1行足すだけ。
//   ◆ 長さ・BGMのタイミングは、下の INTROS の ms / bgmAt（ミリ秒）。
//   ※ ダンジョン設定ツールで dungeons.js を作り直しても、この設定は別ファイルなので消えません。
// ============================================================
const BOSS_INTRO_STAGES = {
  '11-boss': 'thunder',   // サンダー
  '12-boss': 'freezer',   // フリーザー
  '13-boss': 'fire',      // ファイヤー
};

const BossCloud = (() => {
  const has    = key => Object.prototype.hasOwnProperty.call(BOSS_CLOUD_STAGES, key);
  const stageOf = key => BOSS_CLOUD_STAGES[key];
  const bgOf   = key => { const s = stageOf(key); return (s && typeof s === 'object') ? s.bg : s; };
  const bannerOf = key => { const s = stageOf(key); return (s && typeof s === 'object' && s.banner) || null; };
  const wait   = ms => new Promise(r => setTimeout(r, ms));
  const rand   = (a, b) => a + Math.random() * (b - a);
  const done   = anims => Promise.all(anims.map(a => a.finished.catch(() => {})));

  function preload(key) {
    if (!has(key)) return;
    try { const im = new Image(); im.src = bgOf(key); } catch (e) {}
    try { const st = stageOf(key); if (st && typeof st === 'object' && st.via) { const v = new Image(); v.src = st.via; } } catch (e) {}
    // 登場の効果音も先読み（鳴らす瞬間に遅れないように）
    try {
      const en = entranceOf(key);
      if (en && en.se && typeof BATTLE_SE !== 'undefined' && BATTLE_SE[en.se]) { const a = new Audio(BATTLE_SE[en.se].file); a.preload = 'auto'; }
    } catch (e) {}
  }

  // 雲のかたまり1つ（ぼかした白い円）
  function makePuff(layer, W, H) {
    const back = layer === 'back';
    const el = document.createElement('div');
    const size = rand(0.55, 1.05) * Math.max(W, H * 0.8);
    const x = rand(-0.1, 1.1), y = rand(-0.1, 1.1);
    el.style.cssText =
      `position:absolute;left:${x * 100}%;top:${y * 100}%;` +
      `width:${size}px;height:${size * rand(0.5, 0.75)}px;border-radius:50%;` +
      `background:radial-gradient(closest-side, ` +
      (back
        ? `rgba(128,146,188,.95) 0%, rgba(128,146,188,.6) 55%, rgba(128,146,188,0) 100%`
        : `rgba(255,255,255,.98) 0%, rgba(255,255,255,.65) 55%, rgba(255,255,255,0) 100%`) +
      `);filter:blur(${back ? 10 : 6}px);opacity:0;will-change:transform,opacity;` +
      `transform:translate(-50%,-50%) scale(.5);`;
    el._x = x; el._y = y;
    return el;
  }

  // 「ダンジョン上部 〜 パーティ下端」ぶん（背景がひと続きの範囲）に重ねる
  function placeOverlay(ov) {
    const d = document.getElementById('dungeon'), p = document.getElementById('party-area');
    if (!d || !p) return false;
    const dr = d.getBoundingClientRect(), pr = p.getBoundingClientRect();
    ov.style.left = dr.left + 'px';
    ov.style.top = dr.top + 'px';
    ov.style.width = dr.width + 'px';
    ov.style.height = (pr.bottom - dr.top) + 'px';
    return true;
  }

  // 演出を再生する。終わったら呼び出し側が敵を登場させる。
  //   key … ダンジョンキー（例 '14-boss'） / battleIdx … ボス戦の番号（BGM選択用）
  async function play(key, battleIdx) {
    if (!has(key)) return;
    { const st = stageOf(key); if (st && typeof st === 'object' && st.transition === 'cave') return playCave(key, battleIdx); }
    const T = BOSS_CLOUD_TIMING;
    const dungeon = document.getElementById('dungeon');
    const ov = document.createElement('div');
    ov.id = 'boss-cloud-ov';
    ov.style.cssText = 'position:fixed;z-index:60;overflow:hidden;pointer-events:auto;';
    if (!placeOverlay(ov)) return;
    const onResize = () => placeOverlay(ov);
    window.addEventListener('resize', onResize);

    const W = parseFloat(ov.style.width) || 360, H = parseFloat(ov.style.height) || 640;

    // 下から順に：雲の地色 → 奥の雲 → 手前の雲 → 暗幕
    const base = document.createElement('div');
    base.style.cssText = 'position:absolute;inset:0;opacity:0;' +
      'background:linear-gradient(180deg,#d9e0ee 0%,#b9c5de 55%,#9fb0d0 100%);';
    const layerBack = document.createElement('div');
    const layerFront = document.createElement('div');
    [layerBack, layerFront].forEach(l => { l.style.cssText = 'position:absolute;inset:0;'; });
    const puffs = [];
    for (let i = 0; i < 12; i++) { const p = makePuff('back', W, H);  layerBack.appendChild(p);  puffs.push(p); }
    for (let i = 0; i < 14; i++) { const p = makePuff('front', W, H); layerFront.appendChild(p); puffs.push(p); }
    const dark = document.createElement('div');
    dark.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0;';
    ov.append(base, layerBack, layerFront, dark);
    document.body.appendChild(ov);

    const fwd = { fill: 'forwards' };
    try {
      // ① 暗転
      await done([dark.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T.dark, easing: 'ease-in', ...fwd })]);
      await wait(T.darkHold);

      // ② 暗闇から雲の中へ（雲がふくらんでせまり、暗幕が引いていく）
      const inAnims = [
        dark.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T.cloudIn, easing: 'ease-out', ...fwd }),
        base.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T.cloudIn, delay: T.cloudIn * 0.25, easing: 'ease-in', ...fwd }),
      ];
      for (const p of puffs) {
        inAnims.push(p.animate(
          [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.45)' },
           { opacity: 1, transform: 'translate(-50%,-50%) scale(1.2)' }],
          { duration: T.cloudIn * rand(0.7, 1), delay: rand(0, T.cloudIn * 0.3), easing: 'ease-out', ...fwd }));
      }
      await done(inAnims);
      await wait(T.cloudHold);

      // 雲で隠れているあいだに、背景をラスボス用に入れ替える
      const bg = bgOf(key);
      dungeon.style.backgroundImage = `url('${bg}')`;
      dungeon.style.backgroundSize = 'cover';
      dungeon.style.backgroundPosition = 'center';
      if (typeof setPartyBackground === 'function') setPartyBackground(bg);
      if (typeof layoutBattleBg === 'function') layoutBattleBg();
      // 画像が読み込み前でも、表示される前にはそろえておく
      try {
        const im = new Image(); im.src = bg;
        if (im.decode) await Promise.race([im.decode().catch(() => {}), wait(1500)]);
      } catch (e) {}

      // ③ 雲がゆっくり晴れる（外へ流れて薄くなる）
      const outAnims = [
        base.animate([{ opacity: 1 }, { opacity: 1, offset: 0.12 }, { opacity: 0 }],
          { duration: T.clear, easing: 'ease-in-out', ...fwd }),
      ];
      for (const p of puffs) {
        const dx = (p._x - 0.5) * W * rand(0.9, 1.6) + rand(-30, 30);
        const dy = (p._y - 0.5) * H * rand(0.5, 1.1) + rand(-30, 30);
        outAnims.push(p.animate(
          [{ opacity: 1, transform: 'translate(-50%,-50%) scale(1.2)' },
           { opacity: 0.85, offset: 0.35 },
           { opacity: 0, transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(1.7)` }],
          { duration: T.clear * rand(0.8, 1), delay: rand(0, T.clear * 0.15), easing: 'ease-in-out', ...fwd }));
      }
      // 晴れていく途中でボスBGM
      const bgmTimer = wait(T.clear * T.bgmAt).then(() => {
        if (typeof playBattleBgm === 'function') playBattleBgm(battleIdx);
      });
      await Promise.all([done(outAnims), bgmTimer]);
    } finally {
      window.removeEventListener('resize', onResize);
      ov.remove();
    }
  }


  // ── ハナダの洞窟の切り替え演出 ─────────────────────────────────
  //   暗転 → 洞窟の絵（via）が浮かび、奥の紫に光るトンネルへ、少し回りながら近づく
  //   → 紫の光があふれて画面をつつむ（そのあいだに背景を入れ替え）→ 光がうすれ、紫の波動がひろがって背景があらわれる
  const CAVE_GLOW = { x: 0.706, y: 0.228 };   // via の絵の中の、紫に光るトンネルの位置（絵に対する割合）

  function loadImg(src) {
    return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  }

  async function swapBackground(key) {
    const dungeon = document.getElementById('dungeon');
    const bg = bgOf(key);
    dungeon.style.backgroundImage = `url('${bg}')`;
    dungeon.style.backgroundSize = 'cover';
    dungeon.style.backgroundPosition = 'center';
    if (typeof setPartyBackground === 'function') setPartyBackground(bg);
    if (typeof layoutBattleBg === 'function') layoutBattleBg();
    try {
      const im = new Image(); im.src = bg;
      if (im.decode) await Promise.race([im.decode().catch(() => {}), wait(1500)]);
    } catch (e) {}
  }

  async function playCave(key, battleIdx) {
    const T = BOSS_CAVE_TIMING;
    const st = stageOf(key);
    const via = (st && st.via) || 'dungeon15.png';
    const im = await loadImg(via);
    const ov = document.createElement('div');
    ov.id = 'boss-cloud-ov';
    ov.style.cssText = 'position:fixed;z-index:60;overflow:hidden;pointer-events:auto;';
    if (!placeOverlay(ov)) return;
    const onResize = () => placeOverlay(ov);
    window.addEventListener('resize', onResize);
    const fwd = { fill: 'forwards' };
    const W = parseFloat(ov.style.width) || 360, H = parseFloat(ov.style.height) || 640;

    // 絵は上をそろえて cover。トンネルが画面の真ん中・上寄りに来るよう横位置を合わせる
    const nw = (im && im.naturalWidth) || 1024, nh = (im && im.naturalHeight) || 768;
    const k = Math.max(W / nw, H / nh) * 1.15;
    const iw = nw * k, ih = nh * k;
    const tx0 = CAVE_GLOW.x * iw;
    const xo = Math.max(W - iw, Math.min(0, W / 2 - tx0));
    const tx = xo + tx0, ty = CAVE_GLOW.y * ih;     // トンネルの、画面上の位置

    const cave = document.createElement('div');
    cave.style.cssText = `position:absolute;inset:0;background:#05030c url('${via}') ${xo}px 0px / ${iw}px ${ih}px no-repeat;` +
      `transform-origin:${tx}px ${ty}px;will-change:transform;`;
    const vig = document.createElement('div');   // まわりを暗くして、奥の光に目が向くように
    vig.style.cssText = `position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse ${W * .75}px ${H * .6}px at ${tx}px ${ty}px, ` +
      `rgba(4,0,14,0) 0%, rgba(4,0,14,0) 25%, rgba(4,0,14,.88) 100%);`;
    const gl = Math.max(W, 260) * .5;
    const glow = document.createElement('div'); // トンネルの紫の光
    glow.style.cssText = `position:absolute;left:${tx}px;top:${ty}px;width:${gl}px;height:${gl}px;margin:${-gl / 2}px 0 0 ${-gl / 2}px;` +
      `border-radius:50%;opacity:0;mix-blend-mode:screen;will-change:transform,opacity;` +
      `background:radial-gradient(closest-side, rgba(238,225,255,.95), rgba(170,125,255,.6) 45%, rgba(120,60,220,0));`;
    const flood = document.createElement('div'); // 光があふれた画面
    flood.style.cssText = `position:absolute;inset:0;opacity:0;background:radial-gradient(circle at ${tx}px ${ty}px, #f6efff 0%, #d2bcff 55%, #a283ea 100%);`;
    const dark = document.createElement('div');
    dark.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0;';
    ov.append(cave, vig, glow, flood, dark);
    document.body.appendChild(ov);

    try {
      // ① 暗転
      await done([dark.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T.dark, easing: 'ease-in', ...fwd })]);
      await wait(T.darkHold);

      // ② 暗闇から洞窟の絵が浮かび、奥の紫のトンネルへ近づく（らせん状に少し回りながら加速）
      await done([
        dark.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 900, easing: 'ease-out', ...fwd }),
        cave.animate([
          { transform: 'scale(1) rotate(0deg)' },
          { transform: 'scale(1.15) rotate(1deg)', offset: .30 },
          { transform: 'scale(1.7) rotate(3.5deg)', offset: .55 },
          { transform: 'scale(3.2) rotate(7deg)', offset: .75 },
          { transform: 'scale(8) rotate(11deg)', offset: .90 },
          { transform: 'scale(22) rotate(15deg)' }
        ], { duration: T.zoom, easing: 'linear', ...fwd }),
        vig.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T.zoom * .8, easing: 'ease-in', ...fwd }),
        glow.animate([
          { opacity: 0,   transform: 'scale(.4)' },
          { opacity: .75, transform: 'scale(1)', offset: .5 },
          { opacity: 1,   transform: 'scale(3)', offset: .78 },
          { opacity: 1,   transform: 'scale(12)' }
        ], { duration: T.zoom, easing: 'linear', ...fwd }),
        flood.animate([{ opacity: 0 }, { opacity: 0, offset: .78 }, { opacity: 1 }], { duration: T.zoom, easing: 'ease-in', ...fwd }),
      ]);
      await wait(T.hold);

      // 紫の光で隠れているあいだに、背景を入れ替える
      cave.style.display = vig.style.display = glow.style.display = 'none';
      await swapBackground(key);

      // ③ 光がうすれて背景があらわれる ＋ 紫の波動
      const out = [flood.animate([{ opacity: 1 }, { opacity: 1, offset: .1 }, { opacity: 0 }], { duration: T.clear, easing: 'ease-in-out', ...fwd })];
      const R = Math.max(W, H);
      for (let i = 0; i < 3; i++) {
        const ring = document.createElement('div');
        ring.style.cssText = `position:absolute;left:${tx}px;top:${ty}px;width:${R}px;height:${R}px;margin:${-R / 2}px 0 0 ${-R / 2}px;border-radius:50%;opacity:0;` +
          `border:3px solid rgba(140,80,225,.85);box-shadow:0 0 18px 4px rgba(190,140,255,.75), inset 0 0 18px 3px rgba(190,140,255,.5);`;
        ov.insertBefore(ring, dark);
        out.push(ring.animate([
          { opacity: 0,   transform: 'scale(.05)' },
          { opacity: .9,  transform: 'scale(.2)', offset: .1 },
          { opacity: 0,   transform: 'scale(1.8)' }
        ], { duration: 1700, delay: i * 350, easing: 'ease-out', ...fwd }));
      }
      // 晴れていく途中でボスBGM
      const bgmTimer = wait(T.clear * T.bgmAt).then(() => {
        if (typeof playBattleBgm === 'function') playBattleBgm(battleIdx);
      });
      await Promise.all([done(out), bgmTimer]);
    } finally {
      window.removeEventListener('resize', onResize);
      ov.remove();
    }
  }

  // ── ミュウツー登場演出 ─────────────────────────────────────────
  //   黒いシルエット＋紫のオーラ → 白く光って姿が現れ、紫の波動が3つ広がって画面がゆれる
  function mewtwoFx(img) {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;z-index:55;overflow:hidden;pointer-events:none;';
    if (!placeOverlay(ov)) return;
    document.body.appendChild(ov);
    const or = ov.getBoundingClientRect(), r = img.getBoundingClientRect();
    const cx = r.left + r.width / 2 - or.left, cy = r.top + r.height / 2 - or.top;
    const base = Math.max(r.width, r.height, 120);
    const T = ENTRANCES.mewtwo.ms, flashAt = T * 0.58;
    const fwd = { fill: 'both' };
    const mk = css => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;border-radius:50%;pointer-events:none;' + css; ov.appendChild(d); return d; };
    const c = 'translate(-50%,-50%)';

    // ① 念力のオーラ（紫がふくらんで脈打つ）
    const aura = mk(`left:${cx}px;top:${cy}px;width:${base * 1.9}px;height:${base * 1.9}px;opacity:0;mix-blend-mode:screen;` +
      `background:radial-gradient(closest-side, rgba(190,100,255,.85), rgba(120,30,220,.45) 55%, rgba(90,0,180,0));`);
    aura.animate([
      { opacity: 0,  transform: `${c} scale(.2)` },
      { opacity: .9, transform: `${c} scale(.9)`, offset: .5 },
      { opacity: 1,  transform: `${c} scale(1.1)`, offset: .6 },
      { opacity: 0,  transform: `${c} scale(1.5)` }
    ], { duration: T, easing: 'ease-out', ...fwd });

    // ② 波動（紫の輪が3つ、姿が現れる瞬間に広がる）
    for (let i = 0; i < 3; i++) {
      const ring = mk(`left:${cx}px;top:${cy}px;width:${base}px;height:${base}px;opacity:0;` +
        `border:3px solid rgba(200,130,255,.95);box-shadow:0 0 18px 4px rgba(160,70,255,.8), inset 0 0 18px 3px rgba(160,70,255,.5);`);
      ring.animate([
        { opacity: 0,   transform: `${c} scale(.2)` },
        { opacity: .95, transform: `${c} scale(.5)`, offset: .15 },
        { opacity: 0,   transform: `${c} scale(2.6)` }
      ], { duration: 900, delay: flashAt + i * 160, easing: 'ease-out', ...fwd });
    }

    // ③ 紫の閃光
    const flash = document.createElement('div');
    flash.style.cssText = `position:absolute;inset:0;opacity:0;mix-blend-mode:screen;background:radial-gradient(circle at ${cx}px ${cy}px, rgba(230,190,255,.9), rgba(140,50,230,.5) 45%, rgba(60,0,120,0) 80%);`;
    ov.appendChild(flash);
    flash.animate([{ opacity: 0 }, { opacity: .8, offset: .25 }, { opacity: 0 }], { duration: 700, delay: flashAt - 80, easing: 'ease-out', ...fwd });

    // ④ 登場の瞬間に敵エリアがゆれる
    const area = document.getElementById('enemy-area');
    if (area && area.animate) {
      area.animate([
        { transform: 'translate(0,0)' }, { transform: 'translate(-6px,3px)', offset: .15 },
        { transform: 'translate(5px,-3px)', offset: .3 }, { transform: 'translate(-3px,2px)', offset: .5 },
        { transform: 'translate(2px,-1px)', offset: .75 }, { transform: 'translate(0,0)' }
      ], { duration: 520, delay: flashAt, easing: 'ease-out' });
    }
    setTimeout(() => ov.remove(), T + 1300);
  }

  const ENTRANCES = {
    mewtwo: {
      ms: 1900,            // 登場にかける時間（ミリ秒）
      se: 'mewtwo',        // 完全に出てきたところで鳴らす効果音（game.js の BATTLE_SE）
      easing: 'linear',
      frames: [            // 敵画像のアニメ：シルエット → 白く光る → 姿があらわれる
        { opacity: 0,  filter: 'brightness(0) saturate(1) drop-shadow(0 0 0px rgba(190,100,255,0))',    transform: 'scale(.92)' },
        { opacity: .9, filter: 'brightness(0) saturate(1) drop-shadow(0 0 18px rgba(190,100,255,.95))', transform: 'scale(.97)', offset: .45 },
        { opacity: 1,  filter: 'brightness(3) saturate(.3) drop-shadow(0 0 34px rgba(235,190,255,1))',  transform: 'scale(1.06)', offset: .58 },
        { opacity: 1,  filter: 'brightness(1.25) saturate(1) drop-shadow(0 0 20px rgba(190,100,255,.7))', transform: 'scale(1.01)', offset: .8 },
        { opacity: 1,  filter: 'brightness(1) saturate(1) drop-shadow(0 0 0px rgba(190,100,255,0))',    transform: 'scale(1)' }
      ],
      fx: mewtwoFx
    }
  };
  // ============================================================
  // ★ 伝説の鳥の登場演出（サンダー／フリーザー／ファイヤー）★
  //   背景は変えず、BOSS バナーのあとに「その鳥らしい演出」で姿があらわれる。
  //   炎・氷・雷は canvas に、粒子や結晶を毎フレーム描いて本物っぽく見せています。
  //   ボスBGMは姿があらわれる瞬間に流れはじめます（それまでは無音）。
  //   演出が終わると画面の幕（canvas）ごと必ず消えるので、あとに何も残りません。
  //   効果音は game.js の BATTLE_SE にある音（shiny / water / fire / skillk）を使っています。
  //   長さ・BGMのタイミングは、下の INTROS の ms / bgmAt（ミリ秒）で変えられます。
  // ============================================================
  const TAU = Math.PI * 2;
  const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
  const ramp = (t, a, b) => clamp01((t - a) / (b - a));
  const sstep = (t, a, b) => { const k = ramp(t, a, b); return k * k * (3 - 2 * k); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const wob = x => Math.sin(x) * .5 + Math.sin(x * 2.3 + 1.7) * .3 + Math.sin(x * 4.1 + 4.2) * .2;   // なめらかなゆらぎ（-1〜1）
  const easeOutBack = k => { const c1 = 1.70158, c3 = c1 + 1, x = k - 1; return 1 + c3 * x * x * x + c1 * x * x; };

  // 演出の舞台：ダンジョン上部〜パーティ下端に重ねる透明な幕（canvas 1枚）。ボスの位置・大きさも測っておく
  function introStage(img) {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;z-index:55;overflow:hidden;pointer-events:none;';
    if (!placeOverlay(ov)) return null;
    document.body.appendChild(ov);
    const or = ov.getBoundingClientRect(), r = img.getBoundingClientRect();
    const W = or.width || 360, H = or.height || 640;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cv = document.createElement('canvas');
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;';
    const ctx = cv.getContext && cv.getContext('2d');
    if (!ctx) { ov.remove(); return null; }
    ov.appendChild(cv);
    return {
      ov, ctx, W, H, dpr,
      cx: r.left + r.width / 2 - or.left, cy: r.top + r.height / 2 - or.top,
      base: Math.max(r.width, r.height, 120),
      rect: { w: r.width, h: r.height, top: r.top - or.top, bottom: r.bottom - or.top }
    };
  }

  // 毎フレーム draw(t, dt) を呼ぶ。T ミリ秒たったら、幕ごと必ず消す（何も残さない）
  function introRun(st, T, draw) {
    const { ov, ctx, W, H, dpr } = st;
    let done = false, last = 0;
    const finish = () => { if (done) return; done = true; try { ctx.clearRect(0, 0, W, H); ov.remove(); } catch (e) {} };
    const t0 = performance.now();
    const frame = now => {
      if (done) return;
      const t = Math.max(0, now - t0);
      if (t >= T) { finish(); return; }
      const dt = Math.min(.05, Math.max(0, (t - last) / 1000));
      last = t;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, W, H);
      try { draw(t, dt); } catch (e) { finish(); return; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    setTimeout(finish, T + 600);     // タブが裏に回って描画が止まっても、必ず消す
  }

  // 画面（敵エリア）をゆらす
  function introShake(delay, amp, dur) {
    const area = document.getElementById('enemy-area');
    if (!area || !area.animate) return;
    const a = amp || 6;
    area.animate([
      { transform: 'translate(0,0)' },
      { transform: `translate(${-a}px,${a * .5}px)`, offset: .15 },
      { transform: `translate(${a * .85}px,${-a * .5}px)`, offset: .3 },
      { transform: `translate(${-a * .5}px,${a * .35}px)`, offset: .5 },
      { transform: `translate(${a * .3}px,${-a * .2}px)`, offset: .75 },
      { transform: 'translate(0,0)' }
    ], { duration: dur || 520, delay, easing: 'ease-out' });
  }

  // 効果音（game.js の playSE）
  function introSE(name, delay) {
    setTimeout(() => { try { if (typeof playSE === 'function') playSE(name); } catch (e) {} }, delay);
  }

  // やわらかい光の玉（中心が明るく、まわりへすっと消える）。炎・煙・光・霧のもと
  const _sprites = {};
  function softSprite(r, g, b, core) {
    const key = r + ',' + g + ',' + b + ',' + core;
    if (_sprites[key]) return _sprites[key];
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${r},${g},${b},1)`);
    gr.addColorStop(core, `rgba(${r},${g},${b},.45)`);
    gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = gr;
    x.fillRect(0, 0, 64, 64);
    return (_sprites[key] = c);
  }
  const blob = (ctx, spr, x, y, size, alpha) => {
    if (alpha <= .004 || size <= .5) return;
    ctx.globalAlpha = alpha > 1 ? 1 : alpha;
    ctx.drawImage(spr, x - size / 2, y - size / 2, size, size);
  };

  const blobXY = (ctx, spr, x, y, w, h, alpha) => {
    if (alpha <= .004 || w <= .5) return;
    ctx.globalAlpha = alpha > 1 ? 1 : alpha;
    ctx.drawImage(spr, x - w / 2, y - h / 2, w, h);
  };

  // 点列 pts の先頭から割合 f ぶんだけ（伸びていく線・ひび割れ用）
  function partial(pts, f) {
    if (f >= 1) return pts;
    if (f <= 0) return [];
    const len = [];
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); len.push(l); total += l; }
    let rem = total * f;
    const out = [pts[0]];
    for (let i = 0; i < len.length; i++) {
      if (rem >= len[i]) { out.push(pts[i + 1]); rem -= len[i]; }
      else { const k = rem / (len[i] || 1); out.push([lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k)]); break; }
    }
    return out;
  }
  // ギザギザの点列
  function jag(x0, y0, x1, y1, segs, amp) {
    const pts = [[x0, y0]];
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      pts.push([lerp(x0, x1, t) + rand(-amp, amp), lerp(y0, y1, t) + rand(-amp, amp)]);
    }
    pts.push([x1, y1]);
    return pts;
  }
  // 円（リング）の点列
  function circlePts(x, y, r, n) {
    const p = [];
    for (let i = 0; i <= n; i++) { const a = i / n * TAU; p.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
    return p;
  }
  function strokePts(ctx, polys, w, style) {
    ctx.lineWidth = w;
    ctx.strokeStyle = style;
    ctx.beginPath();
    for (const pts of polys) {
      if (pts.length < 2) continue;
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    }
    ctx.stroke();
  }
  // 区間リストの折れ線（[{t,v}...] の値を線形に補間）
  function piece(arr, u) {
    if (u <= arr[0][0]) return arr[0][1];
    for (let i = 1; i < arr.length; i++) if (u <= arr[i][0]) return lerp(arr[i - 1][1], arr[i][1], (u - arr[i - 1][0]) / (arr[i][0] - arr[i - 1][0]));
    return 0;
  }

  // 敵画像のアニメ1コマ（シルエット → 閃光 → 姿、を filter と大きさで表す。関数の並びは全コマ同じにする）
  const introFrame = (rgb, o, op, b, s, g, a, sc) => ({
    offset: o, opacity: op,
    filter: `brightness(${b}) saturate(${s}) drop-shadow(0 0 ${g}px rgba(${rgb},${a}))`,
    transform: `scale(${sc})`
  });

  // ── サンダー ─────────────────────────────────────────────
  // 稲妻（中点変位法：まっすぐな線を何度も折って、本物のようなギザギザと枝わかれをつくる）
  function genBolt(x0, y0, x1, y1, rough, branchP, maxDepth, startDepth, iters) {
    const out = [], N = iters || 6;
    const build = (ax, ay, bx, by, rg, depth) => {
      let pts = [[ax, ay], [bx, by]], disp = rg;
      for (let it = 0; it < N; it++) {
        const np = [pts[0]];
        for (let i = 0; i < pts.length - 1; i++) {
          const p = pts[i], q = pts[i + 1], dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1, off = (Math.random() * 2 - 1) * disp;
          np.push([(p[0] + q[0]) / 2 - dy / len * off, (p[1] + q[1]) / 2 + dx / len * off], q);
        }
        pts = np;
        disp *= .55;
      }
      out.push({ pts, d: depth });
      if (depth >= maxDepth) return;
      const total = Math.hypot(bx - ax, by - ay);
      for (let i = 4; i < pts.length - 4; i++) {
        if (Math.random() >= branchP) continue;
        const p = pts[i], q = pts[Math.min(i + 3, pts.length - 1)];
        let ang = Math.atan2(q[1] - p[1], q[0] - p[0]) + (Math.random() < .5 ? -1 : 1) * rand(.35, .85);
        if (Math.sin(ang) < .15) ang = -ang;            // 枝は下向きに
        const len = total * rand(.12, .3);
        build(p[0], p[1], p[0] + Math.cos(ang) * len, p[1] + Math.sin(ang) * len, rg * .3, depth + 1);
      }
    };
    build(x0, y0, x1, y1, rough, startDepth || 0);
    return out;
  }
  const groupBolt = segs => [0, 1, 2].map(d => segs.filter(s => s.d === d).map(s => s.pts));
  // 稲妻を描く：太い光のにじみ → 青白い光 → 黄白 → 真っ白な芯、の順に重ねる
  const BOLT_PASS = [[24, .045, '120,135,255'], [14, .09, '150,165,255'], [8, .2, '195,205,255'], [3.8, .55, '255,238,185'], [1.5, 1, '255,255,255']];
  function drawBolt(ctx, lv, I, k) {
    if (I <= .01) return;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [w, a, col] of BOLT_PASS) {
      for (let d = 0; d < 3; d++) if (lv[d].length) strokePts(ctx, lv[d], w * k * Math.pow(.5, d), `rgba(${col},${Math.min(1, a * I)})`);
    }
  }
  // 稲光の強さの変化（落雷は一度ではなく、何度かちらついて消える）
  const FLK_BIG = [[0, 0], [15, 1], [60, .45], [100, 1], [150, .35], [200, .8], [260, .25], [340, .1], [420, 0]];
  const FLK_SM = [[0, 0], [15, 1], [55, .3], [95, .85], [150, .2], [230, 0]];

  function thunderFx(img) {
    const st = introStage(img); if (!st) return;
    const IN = INTROS.thunder, T = IN.ms, S1 = 650, S2 = 1200, S3 = IN.bgmAt;
    const { ctx, W, H, cx, cy, base } = st;
    const rw = Math.max(st.rect.w, base * .8) * .5, rh = Math.max(st.rect.h, base * .8) * .5;

    // 落雷（3本目がボスを直撃。そのあと左右にも1本ずつ追い打ち）
    const mk = (at, I, big, x0, tx, ty, depth) => ({
      at, I, big, tx, ty, x0, i: 0, done: false,
      lv: groupBolt(genBolt(x0, -10, tx, ty, big ? 90 : 70, big ? .05 : .035, 2, depth || 0))
    });
    const strikes = [
      mk(S1, .7, false, cx - W * .30, cx - base * .24, cy - base * .10),
      mk(S2, .8, false, cx + W * .33, cx + base * .26, cy + base * .06),
      mk(S3, 1, true, cx + rand(-12, 12), cx, cy),
      mk(S3 + 70, .65, false, cx - W * .24, cx - base * .40, cy + base * .12, 1),
      mk(S3 + 110, .6, false, cx + W * .26, cx + base * .40, cy + base * .10, 1)
    ];
    const clouds = [];
    for (let i = 0; i < 8; i++) clouds.push({ x: rand(-.1, 1.1) * W, y: rand(-.02, .2) * H, s: rand(.6, 1.1) * W, v: rand(-18, 18), a: rand(.35, .6) });
    const cloudDark = softSprite(26, 30, 56, .5), cloudLit = softSprite(150, 168, 255, .5);
    const glowS = softSprite(190, 205, 255, .3), whiteS = softSprite(255, 252, 235, .2);
    const sparks = [];
    let arcs = [], lastArc = -999;

    introSE('shiny', S1);
    introSE('shiny', S2);
    introSE('shiny', S3);
    introSE('skillk', S3);
    introShake(S1, 4, 360);
    introShake(S2, 4, 360);
    introShake(S3, 9, 640);

    introRun(st, T, (t, dt) => {
      const d = sstep(t, 0, 420) * (1 - sstep(t, T * .72, T - 150));      // 嵐の暗さ
      let lit = 0;
      strikes.forEach(s => { s.i = s.I * piece(s.big ? FLK_BIG : FLK_SM, t - s.at); if (s.i > lit) lit = s.i; });
      // 遠くの稲光（落雷の前に、雲の中でちらつく）
      const far = Math.max(piece([[220, 0], [235, .5], [300, 0]], t), piece([[430, 0], [445, .6], [520, .1], [560, 0]], t));
      lit = Math.max(lit, far * .5);

      // 嵐の空（暗い雲）
      ctx.globalCompositeOperation = 'source-over';
      const gd = ctx.createRadialGradient(cx, H * .35, 0, cx, H * .35, Math.max(W, H) * .9);
      gd.addColorStop(0, `rgba(18,24,60,${.5 * d})`);
      gd.addColorStop(1, `rgba(2,3,14,${.9 * d})`);
      ctx.globalAlpha = 1;
      ctx.fillStyle = gd;
      ctx.fillRect(0, 0, W, H);
      clouds.forEach(c => blob(ctx, cloudDark, c.x + c.v * t / 1000, c.y, c.s, c.a * d));
      ctx.globalCompositeOperation = 'lighter';
      clouds.forEach(c => {        // 稲妻の根もとに近い雲ほど、内側から青白く光る
        const cxn = c.x + c.v * t / 1000;
        let k = 0;
        strikes.forEach(s => { if (t >= s.at - 30) k = Math.max(k, s.i * Math.exp(-Math.pow((cxn - s.x0) / (W * .45), 2))); });
        blob(ctx, cloudLit, cxn, c.y, c.s, .4 * k * d);
      });
      strikes.forEach(s => { if (t >= s.at) blob(ctx, glowS, s.tx, s.ty * .5, W * 2.4, .26 * s.i); });   // 稲光で空全体が明るくなる
      if (lit > .02) { ctx.globalAlpha = 1; ctx.fillStyle = `rgba(185,200,255,${.16 * lit})`; ctx.fillRect(0, 0, W, H); }

      // 稲妻と、当たったところの光
      strikes.forEach(s => {
        if (t < s.at) return;
        if (!s.done) {
          s.done = true;
          const n = s.big ? 30 : 12;
          for (let i = 0; i < n; i++) {
            const a = rand(-Math.PI * .95, -Math.PI * .05), sp = rand(120, s.big ? 620 : 380);
            sparks.push({ x: s.tx, y: s.ty, px: s.tx, py: s.ty, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0, life: rand(.35, .9) });
          }
        }
        drawBolt(ctx, s.lv, s.i, s.big ? 1.25 : 1);
        blob(ctx, whiteS, s.tx, s.ty, base * (s.big ? 1.7 : 1), .9 * s.i);
      });

      // 直撃の衝撃（うすい光の輪）
      const ur = t - S3;
      if (ur > 0 && ur < 650) {
        const k = ur / 650, r = lerp(base * .15, base * 1.2, 1 - (1 - k) * (1 - k)), a = Math.pow(1 - k, 1.8) * .4, ring = circlePts(cx, cy, r, 56);
        ctx.globalAlpha = 1;
        strokePts(ctx, [ring], 8, `rgba(150,170,255,${a * .25})`);
        strokePts(ctx, [ring], 2.2, `rgba(235,240,255,${a})`);
      }

      // 火花（落ちながら消える）
      ctx.lineCap = 'round';
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.age += dt;
        if (p.age >= p.life) { sparks.splice(i, 1); continue; }
        p.px = p.x; p.py = p.y;
        p.vy += 900 * dt;
        p.vx *= Math.exp(-.6 * dt);
        p.x += p.vx * dt; p.y += p.vy * dt;
        const a = 1 - p.age / p.life;
        ctx.globalAlpha = 1;
        strokePts(ctx, [[[p.px, p.py], [p.x, p.y]]], 1.8, `rgba(255,${200 + 40 * a | 0},${120 + 100 * a | 0},${a})`);
      }

      // 姿のまわりにほとばしる電流（細かく、作り直しながらバチバチ走り、最後はきれいに消える）
      const df = sstep(t, S3 + 80, S3 + 260) * (1 - sstep(t, T - 950, T - 380));
      if (df > .02) {
        if (t - lastArc > 55) {
          lastArc = t;
          arcs = [];
          const n = 3 + Math.round(3 * df);
          for (let i = 0; i < n; i++) {
            const a = rand(0, TAU), k = rand(.45, 1), a2 = a + rand(-.9, .9), len = rand(45, 115);
            const x = cx + Math.cos(a) * rw * k, y = cy + Math.sin(a) * rh * k;
            arcs.push({ lv: groupBolt(genBolt(x, y, x + Math.cos(a2) * len, y + Math.sin(a2) * len, 16, .07, 1, 0, 4)), I: rand(.5, 1) });
          }
        }
        arcs.forEach(a => drawBolt(ctx, a.lv, a.I * df, .42));
      }
    });
    setTimeout(() => { try { st.ov.remove(); } catch (e) {} }, T + 700);
  }

  // ── ファイヤー ───────────────────────────────────────────
  // 炎の色の変化（生まれたては白っぽい黄 → 橙 → 赤 → 暗い赤）
  const FIRE_RAMP = (() => {
    const stops = [[0, 255, 248, 215], [.14, 255, 214, 100], [.38, 255, 140, 30], [.65, 235, 70, 12], [.88, 150, 25, 6], [1, 70, 10, 4]];
    const out = [];
    for (let i = 0; i < 20; i++) {
      const a = i / 19;
      let k = 1;
      while (k < stops.length - 1 && a > stops[k][0]) k++;
      const p = stops[k - 1], q = stops[k], f = (a - p[0]) / (q[0] - p[0]);
      out.push([0, 1, 2].map(j => Math.round(p[j + 1] + (q[j + 1] - p[j + 1]) * f)));
    }
    return out;
  })();
  const fireSprite = i => { const c = FIRE_RAMP[Math.max(0, Math.min(19, i | 0))]; return softSprite(c[0], c[1], c[2], .22); };

  function fireFx(img) {
    const st = introStage(img); if (!st) return;
    const IN = INTROS.fire, T = IN.ms, BU = IN.bgmAt;
    const { ctx, W, H, cx, cy, base } = st;
    const bh = Math.max(st.rect.h, base);
    const ps = [];
    const add = (p, force) => { if (force || ps.length < 640) ps.push(p); };      // 爆発の粒は上限に関係なく必ず出す
    const acc = { fl: 0, sm: 0, em: 0, sw: 0 };
    let burst = false;
    // 炎の舌が立ちのぼる「列」（列ごとに強さがゆらぐので、のっぺりした帯にならず、舌のように見える）
    const NCOL = 11, cols = [];
    for (let i = 0; i < NCOL; i++) cols.push({ x: (i + .5) / NCOL * W, ph: rand(0, 6), sp: rand(.003, .006) });
    const smokeS = softSprite(38, 28, 24, .35), emberS = softSprite(255, 205, 110, .15), heatS = softSprite(255, 120, 30, .35), orbS = softSprite(255, 190, 80, .3), coreS = softSprite(255, 250, 220, .2);

    introSE('fire', 600);
    introSE('fire', BU);
    introSE('skillk', BU);
    introShake(BU, 10, 700);

    introRun(st, T, (t, dt) => {
      const fade = 1 - sstep(t, T - 650, T - 130);
      // 足もとの炎の強さ（だんだん強まり、爆発のあとは少しおさまり、最後は静まる）
      const gI = sstep(t, 100, 1300) * (t < BU ? 1 : lerp(1, .38, sstep(t, BU, BU + 450))) * (1 - sstep(t, T - 1300, T - 700));

      // ── 発生 ──
      acc.fl += 380 * gI * dt; acc.sm += 18 * gI * dt; acc.em += 26 * gI * dt;
      while (acc.fl >= 1) {
        acc.fl--;
        const c = cols[(Math.random() * NCOL) | 0], ci = .5 + .5 * Math.sin(t * c.sp + c.ph), pw = (.5 + .5 * ci) * (.55 + .45 * gI);
        add({ k: 'f', x: c.x + wob(t * .0015 + c.ph) * 24 + rand(-22, 22), y: H + 8, vx: rand(-25, 25), vy: -rand(380, 760) * pw, age: 0, life: rand(.8, 1.4), s0: rand(30, 60) * (.7 + .3 * ci) * (.7 + .3 * gI), k0: 1, k1: .1, k2: -.85, asp: 1.6, asp1: 1.6, drag: .55, turb: 260, seed: rand(0, 99), al: .42, c1: 1 });
      }
      while (acc.sm >= 1) { acc.sm--; add({ k: 's', x: rand(0, W), y: H * (1 - rand(.35, .6)), vx: rand(-12, 12), vy: -rand(40, 90), age: 0, life: rand(1.8, 2.6), s0: rand(70, 110), seed: rand(0, 99) }); }
      while (acc.em >= 1) { acc.em--; add({ k: 'e', x: rand(0, W), y: H, vx: rand(-20, 20), vy: -rand(90, 260), age: 0, life: rand(1.6, 3.2), s0: rand(2.5, 4.5), seed: rand(0, 99) }); }
      // 炎がボスに吸い寄せられ、渦をまく（爆発の直前）
      if (t > 800 && t < BU) {
        acc.sw += 260 * dt;
        while (acc.sw >= 1) { acc.sw--; add({ k: 'w', ang: rand(0, TAU), R: base * rand(.8, 1.2), w: rand(3, 6), kk: 2.2, age: 0, life: .8, s0: 40 }); }
      }
      // 爆発（上へ吹きあがる火の玉）
      if (!burst && t >= BU) {
        burst = true;
        for (let i = 0; i < 220; i++) {
          const a = Math.random() < .55 ? rand(-Math.PI * .95, -Math.PI * .05) : rand(0, TAU), sp = Math.pow(Math.random(), .6) * 560 + 80;
          add({ k: 'f', x: cx + rand(-14, 14), y: cy + rand(-14, 14), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0, life: rand(.55, 1.0), s0: rand(55, 110), k0: .6, k1: 1.1, k2: -.8, asp: 1, asp1: .2, drag: 1.8, buoy: 150, turb: 140, seed: rand(0, 99), al: .36, c1: .95 }, true);
        }
        for (let i = 0; i < 36; i++) {
          const a = rand(0, TAU), sp = rand(80, 260);
          add({ k: 's', x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, age: 0, life: rand(1.6, 2.4), s0: rand(80, 140), seed: rand(0, 99) }, true);
        }
        for (let i = 0; i < 40; i++) {
          const a = rand(0, TAU), sp = rand(200, 650);
          add({ k: 'e', x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0, life: rand(1.2, 2.4), s0: rand(3, 5), seed: rand(0, 99), fast: 1 }, true);
        }
      }
      // 火柱（爆発のあと、ボスの足もとから炎が吹きあがる）
      if (t >= BU && t < BU + 300) {
        const gy = Math.min(H + 8, st.rect.bottom + 10);
        for (let n = 0; n < 9; n++) {
          add({ k: 'f', x: cx + rand(-.75, .75) * Math.max(st.rect.w, base * .8), y: gy + rand(0, 16), vx: rand(-40, 40), vy: -rand(450, 800), age: 0, life: rand(.5, .9), s0: rand(34, 64), k0: 1, k1: .1, k2: -.85, asp: 1.6, asp1: 1.4, drag: .9, turb: 220, seed: rand(0, 99), al: .45, c1: 1 }, true);
        }
      }
      // ── 更新 ──
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.age += dt;
        if (p.age >= p.life) { ps.splice(i, 1); continue; }
        if (p.k === 'w') {
          p.ang += p.w * dt;
          p.R *= Math.exp(-p.kk * dt);
          p.x = cx + Math.cos(p.ang) * p.R;
          p.y = cy + base * .08 + Math.sin(p.ang) * p.R * .85;
        } else {
          const f = Math.exp(-(p.drag || .3) * dt);
          if (p.k === 'f') { p.vx *= f; p.vy *= f; p.vx += wob(p.y * .011 + p.seed + t * .0028) * p.turb * dt; if (p.buoy) p.vy -= p.buoy * dt; }
          else if (p.k === 's') { p.vx += wob(p.y * .01 + p.seed + t * .002) * 60 * dt; p.vx *= Math.exp(-.5 * dt); p.vy *= Math.exp(-.5 * dt); }
          else { p.vx += wob(p.y * .02 + p.seed + t * .004) * 180 * dt; if (p.fast) { p.vx *= Math.exp(-1.2 * dt); p.vy *= Math.exp(-1.2 * dt); } p.vy -= 30 * dt; }
          p.x += p.vx * dt; p.y += p.vy * dt;
        }
      }

      // ── 描画 ──
      ctx.globalCompositeOperation = 'source-over';
      const dd = sstep(t, 0, 450) * (1 - sstep(t, T - 900, T - 150));
      const gd = ctx.createRadialGradient(cx, H * .6, 0, cx, H * .6, Math.max(W, H) * .9);
      gd.addColorStop(0, `rgba(90,16,2,${.35 * dd})`);
      gd.addColorStop(1, `rgba(14,1,0,${.86 * dd})`);
      ctx.globalAlpha = 1;
      ctx.fillStyle = gd;
      ctx.fillRect(0, 0, W, H);
      // 煙
      for (const p of ps) {
        if (p.k !== 's') continue;
        const a = p.age / p.life;
        blob(ctx, smokeS, p.x, p.y, p.s0 * (1 + 1.2 * a), .24 * Math.pow(Math.sin(Math.PI * a), .8) * fade);
      }
      ctx.globalCompositeOperation = 'lighter';
      const flick = .9 + .1 * Math.sin(t * .05) + .05 * Math.sin(t * .13);
      blob(ctx, heatS, W / 2, H, W * 2.2, .5 * gI * flick * fade);          // 足もとの熱
      // 炎・渦・火の粉
      for (const p of ps) {
        const a = p.age / p.life;
        if (p.k === 'f') {
          const w = p.s0 * (p.k0 + p.k1 * a + p.k2 * a * a);
          blobXY(ctx, fireSprite((a * p.c1) * 19), p.x, p.y, w, w * (p.asp + p.asp1 * a), p.al * Math.pow(1 - a, 1.0) * fade);
        } else if (p.k === 'w') {
          blob(ctx, fireSprite(a * 9), p.x, p.y, lerp(p.s0 * .75, 10, a), .4 * Math.sqrt(Math.sin(Math.PI * a)) * fade);
        } else if (p.k === 'e') {
          const tw = .65 + .35 * Math.sin(t * .018 + p.seed * 10);
          blobXY(ctx, emberS, p.x, p.y, p.s0 * 1.2, p.s0 * (p.fast ? 4 : 3), .65 * tw * (1 - a * a * a) * fade);
        }
      }
      // 集まった炎の玉
      const orb = sstep(t, 900, BU);
      if (orb > 0 && t < BU + 160) blob(ctx, orbS, cx, cy, base * 1.1 * orb * (1 + .06 * Math.sin(t * .03)), .55 * orb * (1 - sstep(t, BU, BU + 160)));
      // 爆発の閃光と、熱の波
      const fu = t - BU + 40;
      if (fu > 0) {
        const fa = .7 * Math.exp(-fu / 75);
        if (fa > .01) { ctx.globalAlpha = 1; ctx.fillStyle = `rgba(255,236,190,${fa * .4})`; ctx.fillRect(0, 0, W, H); blob(ctx, coreS, cx, cy, base * 2, fa); }
      }
      const ur = t - BU;
      if (ur > 0 && ur < 650) {
        const k = ur / 650, a = Math.pow(1 - k, 1.8) * .4, ring = circlePts(cx, cy + base * .08, lerp(base * .3, W * .7, 1 - (1 - k) * (1 - k)), 64);
        ctx.globalAlpha = 1;
        strokePts(ctx, [ring], 10, `rgba(255,150,40,${a * .25})`);
        strokePts(ctx, [ring], 3, `rgba(255,220,150,${a * .6})`);
      }
    });
    setTimeout(() => { try { st.ov.remove(); } catch (e) {} }, T + 700);
  }

  // ── フリーザー ───────────────────────────────────────────
  // 霜（画面のふちから結晶のように枝をのばして凍っていく）
  function genFrost(W, H) {
    const segs = [];
    const tree = (x, y, ang, len, s) => {
      const q = [[x, y, ang, len, 0, s]];
      let n = 0;
      while (q.length && n < 60) {
        const [px, py, a, l, depth, s0] = q.shift();
        if (l < 9) continue;
        const x1 = px + Math.cos(a) * l, y1 = py + Math.sin(a) * l, e = s0 + .05 + l / 900;
        segs.push({ x0: px, y0: py, x1, y1, s: s0, e });
        n++;
        q.push([x1, y1, a + rand(-.15, .15), l * .8, depth, e]);
        if (depth < 2) {
          if (Math.random() < .85) q.push([x1, y1, a + rand(.9, 1.15), l * .5, depth + 1, e]);      // 六角形の結晶のように約60度で枝わかれ
          if (Math.random() < .85) q.push([x1, y1, a - rand(.9, 1.15), l * .5, depth + 1, e]);
        }
      }
    };
    for (let i = 0; i < 12; i++) tree(rand(0, W), 0, Math.PI / 2 + rand(-.35, .35), rand(12, 24), rand(0, .3));
    for (let i = 0; i < 9; i++) { tree(0, rand(0, H * .8), rand(-.35, .35), rand(12, 24), rand(0, .3)); tree(W, rand(0, H * .8), Math.PI + rand(-.35, .35), rand(12, 24), rand(0, .3)); }
    let mx = 0;
    segs.forEach(s => { if (s.e > mx) mx = s.e; });
    segs.forEach(s => { s.s /= mx; s.e /= mx; });
    return segs;
  }
  function drawFrost(ctx, segs, g, alpha) {
    if (alpha <= .01) return;
    ctx.globalAlpha = 1;
    ctx.lineCap = 'round';
    for (const [w, a, col] of [[2.2, .1, '120,200,255'], [.8, .45, '240,250,255']]) {
      ctx.lineWidth = w;
      ctx.strokeStyle = `rgba(${col},${a * alpha})`;
      ctx.beginPath();
      for (const s of segs) {
        if (s.s >= g) continue;
        const f = clamp01((g - s.s) / (s.e - s.s));
        ctx.moveTo(s.x0, s.y0);
        ctx.lineTo(lerp(s.x0, s.x1, f), lerp(s.y0, s.y1, f));
      }
      ctx.stroke();
    }
  }
  // 氷の柱（六角柱の結晶。左右の面・稜線・先端を、明るさを変えて描くと立体に見える）
  function drawCrystal(ctx, c, h, a) {
    if (h < 2 || a <= .01) return;
    const x = c.x, g = c.g, w = c.w, sy = g - h * .74, tip = [x + c.lean, g - h];
    const BL = [x - w / 2, g], BR = [x + w / 2, g], BM = [x + w * .05, g + w * .12];
    const SL = [x - w / 2 + c.lean * .35, sy], SR = [x + w / 2 + c.lean * .35, sy], TM = [x + c.lean * .35 + w * .05, sy + h * .04];
    const face = (pts, top, bot) => {
      const gr = ctx.createLinearGradient(0, g, 0, tip[1]);
      gr.addColorStop(0, bot);
      gr.addColorStop(1, top);
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fill();
    };
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    face([BL, BM, TM, SL], `rgba(225,246,255,${.78 * a})`, `rgba(125,195,240,${.6 * a})`);
    face([BM, BR, SR, TM], `rgba(165,215,248,${.75 * a})`, `rgba(70,140,205,${.6 * a})`);
    face([SL, TM, tip], `rgba(245,252,255,${.9 * a})`, `rgba(245,252,255,${.9 * a})`);
    face([TM, SR, tip], `rgba(190,228,252,${.85 * a})`, `rgba(190,228,252,${.85 * a})`);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    strokePts(ctx, [[BL, BM, BR, SR, tip, SL, BL]], 1.2, `rgba(255,255,255,${.85 * a})`);
    strokePts(ctx, [[BM, TM, tip], [SL, TM, SR]], 1.5, `rgba(255,255,255,${.9 * a})`);
    strokePts(ctx, [[[x - w * .28, g - h * .05], [x - w * .2 + c.lean * .3, sy + h * .02]]], 1.6, `rgba(255,255,255,${.6 * a})`);
    ctx.globalCompositeOperation = 'lighter';
    strokePts(ctx, [[BL, SL, tip, SR, BR]], 5, `rgba(120,200,255,${.12 * a})`);
  }

  function freezerFx(img) {
    const st = introStage(img); if (!st) return;
    const IN = INTROS.freezer, T = IN.ms, SH = IN.bgmAt;
    const { ctx, W, H, cx, cy, base } = st;
    const bw = Math.max(st.rect.w, base), bh = Math.max(st.rect.h, base);
    const ground = Math.max(cy, Math.min(H - 16, st.rect.bottom - 6));
    const frost = genFrost(W, H);
    const dustS = softSprite(225, 242, 255, .25), fogS = softSprite(160, 200, 230, .12), fogL = softSprite(190, 225, 250, .12), flashS = softSprite(220, 245, 255, .2);

    // 氷の柱（中央ほど高く）
    const crystals = [];
    const NC = 13;
    for (let i = 0; i < NC; i++) {
      const k = i / (NC - 1), mid = 1 - Math.abs(k - .5) * 2, w = bw * rand(.09, .14);
      crystals.push({ x: cx + (k - .5) * bw * 1.25 + rand(-8, 8), g: ground + rand(-4, 6), w, h: bh * (.18 + mid * .36) * rand(.8, 1.2), lean: (k - .5) * w * 1.1 + rand(-.25, .25) * w, t0: 650 + Math.abs(k - .5) * 700 + rand(0, 140) });
    }
    crystals.sort((a, b) => a.g - b.g);
    // 氷塊（ボスを閉じこめる、面のある結晶）
    const rx = bw * .47, ry = bh * .52, NV = 11, verts = [];
    for (let i = 0; i < NV; i++) { const a = i / NV * TAU + rand(-.12, .12), rr = rand(.88, 1.08); verts.push([Math.cos(a) * rx * rr, Math.sin(a) * ry * rr, a]); }
    const facets = verts.map((v, i) => { const n = verts[(i + 1) % NV], am = (v[2] + n[2] + (i === NV - 1 ? TAU : 0)) / 2, lt = .5 + .5 * Math.cos(am + 2.3); return { a: v, b: n, lt, al: .1 + .14 * lt }; });
    const cracks = [];
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + rand(-.3, .3), R = Math.max(rx, ry) * rand(.8, 1.05); cracks.push(jag(cx, cy, cx + Math.cos(a) * R, cy + Math.sin(a) * R, 6, 11)); }
    const glints = [0, 3, 7].map(i => ({ v: verts[i], ph: rand(0, 6) }));
    // 雪・霧
    const snow = [];
    for (let i = 0; i < 46; i++) snow.push({ x: rand(0, W), y: rand(-H, H), vy: rand(40, 110), sz: rand(1.5, 4), ph: rand(0, 6), al: rand(.55, 1) });
    const fogs = [];
    for (let i = 0; i < 8; i++) fogs.push({ x: rand(0, W), y: rand(.62, .95) * H, s: rand(.9, 1.4) * W, v: rand(-14, 14), ph: rand(0, 6) });
    // 砕けたあとのかけら・氷の粉・霧
    const shards = [], dust = [], mist = [];
    let shattered = false;

    introSE('water', 700);
    introSE('water', SH);
    introSE('skillk', SH);
    introShake(SH, 7, 560);

    introRun(st, T, (t, dt) => {
      const d = sstep(t, 0, 450) * (1 - sstep(t, T * .66, T - 150));
      const g = sstep(t, 150, 1700);
      const frostA = 1 - sstep(t, SH + 100, SH + 900);
      const fade = 1 - sstep(t, T - 600, T - 130);

      // 冷気の暗さ
      ctx.globalCompositeOperation = 'source-over';
      const gd = ctx.createRadialGradient(cx, H * .45, 0, cx, H * .45, Math.max(W, H) * .9);
      gd.addColorStop(0, `rgba(30,80,140,${.35 * d})`);
      gd.addColorStop(1, `rgba(4,16,44,${.82 * d})`);
      ctx.globalAlpha = 1;
      ctx.fillStyle = gd;
      ctx.fillRect(0, 0, W, H);
      // 画面のふちが白く凍る
      const edge = (x0, y0, x1, y1, rx0, ry0, rw0, rh0) => {
        const gr = ctx.createLinearGradient(x0, y0, x1, y1);
        gr.addColorStop(0, `rgba(205,235,255,${.55 * g * frostA})`);
        gr.addColorStop(1, 'rgba(205,235,255,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(rx0, ry0, rw0, rh0);
      };
      edge(0, 0, 0, H * .22, 0, 0, W, H * .22);
      edge(0, H, 0, H * .78, 0, H * .78, W, H * .22);
      edge(0, 0, W * .22, 0, 0, 0, W * .22, H);
      edge(W, 0, W * .78, 0, W * .78, 0, W * .22, H);
      // 低くただよう冷気
      fogs.forEach(f => {
        blob(ctx, fogS, f.x + f.v * t / 1000 + Math.sin(t * .0008 + f.ph) * 20, f.y, f.s, .16 * d);
      });
      ctx.globalCompositeOperation = 'lighter';
      drawFrost(ctx, frost, g, frostA * d);
      fogs.forEach(f => blob(ctx, fogL, f.x + f.v * t / 1000 + Math.sin(t * .0008 + f.ph) * 20, f.y - 10, f.s * .8, .07 * d));
      // 舞う雪
      snow.forEach(p => {
        p.y += p.vy * dt;
        if (p.y > H + 10) p.y = -10;
        const x = p.x + Math.sin(t * .0012 + p.ph) * 18;
        blob(ctx, dustS, x, p.y, p.sz * 3.2, p.al * .8 * d * fade);
      });

      // 地面から氷の柱が生える → 氷塊に閉じこめられる（砕ける前まで）
      if (t < SH) {
        crystals.forEach(c => drawCrystal(ctx, c, c.h * easeOutBack(ramp(t, c.t0, c.t0 + 520)), .85));
        const bs = lerp(.4, 1, easeOutBack(ramp(t, 700, 1350))), ba = sstep(t, 700, 1100);
        if (ba > .01) {
          const P = verts.map(v => [cx + v[0] * bs, cy + v[1] * bs]);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1;
          const gr = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
          gr.addColorStop(0, `rgba(235,250,255,${.34 * ba})`);
          gr.addColorStop(1, `rgba(90,160,225,${.3 * ba})`);
          ctx.fillStyle = gr;
          ctx.beginPath();
          ctx.moveTo(P[0][0], P[0][1]);
          for (let i = 1; i < NV; i++) ctx.lineTo(P[i][0], P[i][1]);
          ctx.closePath();
          ctx.fill();
          facets.forEach((f, i) => {
            const a = P[i], b = P[(i + 1) % NV];
            ctx.fillStyle = `rgba(${190 + 40 * f.lt | 0},${232 + 18 * f.lt | 0},255,${f.al * ba})`;
            ctx.beginPath();
            ctx.moveTo(cx, cy); ctx.lineTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
            ctx.closePath();
            ctx.fill();
          });
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          const ring = P.concat([P[0]]);
          strokePts(ctx, P.map(p => [[cx, cy], p]), 1, `rgba(255,255,255,${.3 * ba})`);
          strokePts(ctx, [ring], 2.2, `rgba(245,253,255,${.9 * ba})`);
          ctx.globalCompositeOperation = 'lighter';
          strokePts(ctx, [ring], 8, `rgba(120,200,255,${.14 * ba})`);
          // きらりと光る
          glints.forEach(gl => {
            const tw = Math.max(0, Math.sin(t * .006 + gl.ph)) * ba;
            if (tw < .05) return;
            const x = cx + gl.v[0] * bs, y = cy + gl.v[1] * bs, L = 16 * tw;
            blob(ctx, flashS, x, y, 30 * tw, .9);
            ctx.globalAlpha = 1;
            strokePts(ctx, [[[x - L, y], [x + L, y]], [[x, y - L], [x, y + L]]], 1.4, `rgba(255,255,255,${tw})`);
          });
          // ひび割れ（砕ける直前に走る）
          if (t > SH - 430) {
            ctx.globalCompositeOperation = 'source-over';
            cracks.forEach((c, i) => {
              const f = ramp(t, SH - 420 + i * 40, SH - 120 + i * 40), pts = partial(c, f);
              if (pts.length < 2) return;
              ctx.globalAlpha = 1;
              strokePts(ctx, [pts], 3.4, 'rgba(150,220,255,.3)');
              strokePts(ctx, [pts], 1.5, 'rgba(255,255,255,.95)');
            });
          }
        }
      }

      // 砕け散る瞬間
      if (!shattered && t >= SH) {
        shattered = true;
        for (let i = 0; i < 80; i++) {
          const a = rand(0, TAU), rr = Math.sqrt(Math.random()), px = cx + Math.cos(a) * rx * rr, py = cy + Math.sin(a) * ry * rr, s = rand(.035, .11) * bw, nv = Math.random() < .5 ? 3 : 4, sh = [];
          const a0 = rand(0, TAU);
          for (let j = 0; j < nv; j++) { const aa = a0 + j / nv * TAU + rand(-.4, .4), r = s * rand(.55, 1.1); sh.push([Math.cos(aa) * r, Math.sin(aa) * r]); }
          const dir = Math.atan2(py - cy, px - cx), sp = rand(180, 620);
          shards.push({ x: px, y: py, vx: Math.cos(dir) * sp, vy: Math.sin(dir) * sp - rand(40, 160), sh, rot: rand(0, TAU), spin: rand(-8, 8), ph: rand(0, 6), age: 0, life: rand(1, 1.7) });
        }
        crystals.forEach(c => {          // 氷の柱も砕けて、小さなかけらになる
          for (let j = 0; j < 3; j++) {
            const s = c.w * rand(.5, 1), sh = [];
            const a0 = rand(0, TAU);
            for (let q = 0; q < 3; q++) { const aa = a0 + q / 3 * TAU + rand(-.4, .4), r = s * rand(.6, 1.1); sh.push([Math.cos(aa) * r, Math.sin(aa) * r]); }
            shards.push({ x: c.x + rand(-.4, .4) * c.w, y: c.g - rand(.1, .8) * c.h, vx: rand(-260, 260), vy: -rand(80, 420), sh, rot: rand(0, TAU), spin: rand(-8, 8), ph: rand(0, 6), age: 0, life: rand(.9, 1.5) });
          }
        });
        for (let i = 0; i < 100; i++) {
          const a = rand(0, TAU), sp = rand(80, 420);
          dust.push({ x: cx + rand(-.4, .4) * rx, y: cy + rand(-.4, .4) * ry, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, sz: rand(1.5, 3.8), age: 0, life: rand(1.1, 2.2), ph: rand(0, 6) });
        }
        for (let i = 0; i < 9; i++) { const a = rand(0, TAU), sp = rand(80, 200); mist.push({ x: cx, y: cy + rand(-.2, .3) * bh, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * .5, s0: rand(140, 220), age: 0, life: 1.4 }); }
      }
      if (shattered) {
        // 冷気のもや
        ctx.globalCompositeOperation = 'source-over';
        for (let i = mist.length - 1; i >= 0; i--) {
          const m = mist[i];
          m.age += dt;
          if (m.age >= m.life) { mist.splice(i, 1); continue; }
          const a = m.age / m.life;
          m.vx *= Math.exp(-1.5 * dt); m.vy *= Math.exp(-1.5 * dt);
          m.x += m.vx * dt; m.y += m.vy * dt;
          blob(ctx, fogS, m.x, m.y, m.s0 * (1 + 1.2 * a), .32 * (1 - a) * fade);
        }
        // 氷のかけら（回りながら飛び、光をはね返す）
        for (let i = shards.length - 1; i >= 0; i--) {
          const p = shards[i];
          p.age += dt;
          if (p.age >= p.life) { shards.splice(i, 1); continue; }
          p.vy += 620 * dt;
          p.vx *= Math.exp(-.5 * dt);
          p.x += p.vx * dt; p.y += p.vy * dt;
          const rot = p.rot + p.spin * p.age, c = Math.cos(rot), s = Math.sin(rot), a = p.age / p.life, al = 1 - sstep(a, .55, 1);
          const br = .55 + .45 * Math.abs(Math.cos(rot * 1.7 + p.ph));
          const pts = p.sh.map(v => [p.x + v[0] * c - v[1] * s, p.y + v[0] * s + v[1] * c]);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1;
          ctx.fillStyle = `rgba(${120 + 100 * br | 0},${185 + 55 * br | 0},255,${.5 * al * fade})`;
          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
          ctx.closePath();
          ctx.fill();
          ctx.lineJoin = 'round';
          strokePts(ctx, [pts.concat([pts[0]])], .8, `rgba(235,250,255,${.55 * al * fade})`);
          if (br > .93) { ctx.globalCompositeOperation = 'lighter'; blob(ctx, flashS, p.x, p.y, 26, .9 * al * fade); }
        }
        // 氷の粉（きらきら光りながら舞う）
        ctx.globalCompositeOperation = 'lighter';
        for (let i = dust.length - 1; i >= 0; i--) {
          const p = dust[i];
          p.age += dt;
          if (p.age >= p.life) { dust.splice(i, 1); continue; }
          p.vx *= Math.exp(-1.8 * dt); p.vy *= Math.exp(-1.8 * dt);
          p.vy += 40 * dt;
          p.x += p.vx * dt; p.y += p.vy * dt;
          const a = p.age / p.life, tw = .5 + .5 * Math.sin(t * .03 + p.ph * 7);
          blob(ctx, dustS, p.x, p.y, p.sz * 3.6, (1 - a) * (.4 + .6 * tw) * fade);
        }
        // 閃光と衝撃の輪
        const fu = t - SH + 40;
        if (fu > 0) {
          const fa = .6 * Math.exp(-fu / 90);
          if (fa > .01) { ctx.globalAlpha = 1; ctx.fillStyle = `rgba(210,240,255,${fa * .6})`; ctx.fillRect(0, 0, W, H); blob(ctx, flashS, cx, cy, base * 2.4, fa); }
        }
        const ur = t - SH;
        if (ur > 0 && ur < 700) {
          const k = ur / 700, a = Math.pow(1 - k, 1.8) * .4, ring = circlePts(cx, cy, lerp(base * .25, W * .7, 1 - (1 - k) * (1 - k)), 64);
          ctx.globalAlpha = 1;
          strokePts(ctx, [ring], 9, `rgba(120,200,255,${a * .25})`);
          strokePts(ctx, [ring], 2.6, `rgba(225,246,255,${a})`);
        }
      }
    });
    setTimeout(() => { try { st.ov.remove(); } catch (e) {} }, T + 700);
  }

  // 3匹の設定（ms … 演出の長さ ／ bgmAt … ボスBGMを流す（＝姿があらわれる）瞬間 ／ frames … 敵画像のアニメ）
  const INTROS = {
    thunder: {
      ms: 3000, bgmAt: 1850, easing: 'linear', fx: thunderFx,
      frames: [   // 稲光のたびに黒いシルエットがちらつき、3本目で白くはじけて姿があらわれる
        introFrame('255,225,70', 0,    0,   0,   1,   0,  0,   .96),
        introFrame('255,225,70', .21,  0,   0,   1,   0,  0,   .96),
        introFrame('255,225,70', .2167,.55, 0,   1,   16, .95, .98),
        introFrame('255,225,70', .26,  0,   0,   1,   0,  0,   .98),
        introFrame('255,225,70', .39,  0,   0,   1,   0,  0,   .98),
        introFrame('255,225,70', .40,  .8,  0,   1,   22, 1,   1),
        introFrame('255,225,70', .45,  .25, 0,   1,   8,  .6,  1),
        introFrame('255,225,70', .60,  .25, 0,   1,   8,  .6,  1),
        introFrame('255,225,70', .6167,1,   5,   .15, 46, 1,   1.1),
        introFrame('255,225,70', .66,  1,   2.2, .5,  34, 1,   1.04),
        introFrame('255,225,70', .70,  1,   3.4, .3,  40, 1,   1.05),
        introFrame('255,225,70', .76,  1,   1.5, .8,  26, .9,  1.01),
        introFrame('255,225,70', .88,  1,   1.2, 1,   14, .6,  1),
        introFrame('255,225,70', 1,    1,   1,   1,   0,  0,   1)
      ]
    },
    freezer: {
      ms: 3300, bgmAt: 2100, easing: 'linear', fx: freezerFx,
      frames: [   // 氷塊の中に青く凍った姿がうかび、砕けた瞬間に白く光って、本来の姿があらわれる
        introFrame('130,215,255', 0,    0,   .6,  .5,  0,  0,   .96),
        introFrame('130,215,255', .2,   0,   .6,  .5,  0,  0,   .96),
        introFrame('130,215,255', .36,  .9,  .8,  .5,  10, .8,  1),
        introFrame('130,215,255', .60,  1,   .9,  .45, 14, .9,  1),
        introFrame('130,215,255', .6364,1,   4,   .15, 48, 1,   1.07),
        introFrame('130,215,255', .70,  1,   2.2, .5,  34, 1,   1.03),
        introFrame('130,215,255', .82,  1,   1.3, .9,  22, .8,  1.01),
        introFrame('130,215,255', 1,    1,   1,   1,   0,  0,   1)
      ]
    },
    fire: {
      ms: 3300, bgmAt: 1950, easing: 'linear', fx: fireFx,
      frames: [   // 炎の中の暗いシルエットがふくらみ、爆発の瞬間に白く光って姿があらわれる
        introFrame('255,120,20', 0,     0,   .2,  1,   0,  0,   .85),
        introFrame('255,120,20', .18,   0,   .2,  1,   0,  0,   .85),
        introFrame('255,120,20', .28,   .6,  .2,  1,   14, .9,  .9),
        introFrame('255,120,20', .45,   .85, .25, 1,   24, 1,   .96),
        introFrame('255,120,20', .5909, 1,   5,   .15, 56, 1,   1.12),
        introFrame('255,120,20', .66,   1,   2.4, .5,  40, 1,   1.05),
        introFrame('255,120,20', .80,   1,   1.35,.9,  28, .9,  1.01),
        introFrame('255,120,20', 1,     1,   1,   1,   0,  0,   1)
      ]
    }
  };
  const introOf = key => (Object.prototype.hasOwnProperty.call(BOSS_INTRO_STAGES, key) && INTROS[BOSS_INTRO_STAGES[key]]) || null;

  // 登場演出：ラスボス用（BOSS_CLOUD_STAGES の entrance）→ なければ 伝説の鳥用（BOSS_INTRO_STAGES）
  const entranceOf = key => { const s = stageOf(key); return (s && typeof s === 'object' && ENTRANCES[s.entrance]) || introOf(key); };

  return { has, bgOf, bannerOf, entranceOf, introOf, preload, play };
})();
// ★ 重要：トップレベルの const は window のプロパティにならないため、game.js の window.BossCloud 判定が常に false になっていた
window.BossCloud = BossCloud;
