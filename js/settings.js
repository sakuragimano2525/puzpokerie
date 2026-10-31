// ============================================================
// 設定（音楽・効果音の音量）
//   ・ホーム右上の ⚙ から開く
//   ・値は localStorage に保存（0〜100）
//   ・全ての <audio>/new Audio() の音量に、ここで決めた倍率を自動でかける
//     （game.js などの既存コードは変更不要）
//   ・loop=true の音（ホームBGM・ダンジョンBGM）＝「音楽」、それ以外＝「効果音」
//   ・スライダー 50 ＝ もとの音量 / 100 ＝ 2倍（上限1.0）/ 0 ＝ 無音
// ============================================================
(function () {
  'use strict';
  const KEY = 'game_audio_settings_v1';
  const DEFAULTS = { bgm: 70, se: 50 };   // ★ 初期値：音楽はすこし大きめ

  const cfg = Object.assign({}, DEFAULTS);
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s) {
      if (isFinite(s.bgm)) cfg.bgm = Math.max(0, Math.min(100, +s.bgm));
      if (isFinite(s.se))  cfg.se  = Math.max(0, Math.min(100, +s.se));
    }
  } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} }

  const clamp01 = (v) => Math.max(0, Math.min(1, +v || 0));
  const mult = (el) => (el.loop ? cfg.bgm : cfg.se) / 50;

  // ---- 音量の補正層 ---------------------------------------------------
  const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');
  const live = new Set();   // 音量を触った要素（設定変更時にまとめて反映する）
  if (desc && desc.get && desc.set) {
    const apply = (el) => { try { desc.set.call(el, clamp01(el.__rv * mult(el))); } catch (e) {} };
    Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
      configurable: true, enumerable: desc.enumerable,
      get() { return this.__rv !== undefined ? this.__rv : desc.get.call(this); },
      set(v) { this.__rv = clamp01(v); live.add(this); apply(this); }
    });
    // 音量を一度も指定していない音（evolution など）も、再生時に補正をかける
    const origPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.__rv === undefined) this.__rv = clamp01(desc.get.call(this));
      live.add(this); apply(this);
      return origPlay.apply(this, arguments);
    };
    window.__applyAudioSettings = function () { live.forEach(apply); };
  } else {
    window.__applyAudioSettings = function () {};
  }

  window.GameSettings = {
    get: () => Object.assign({}, cfg),
    set(kind, v) { cfg[kind] = Math.max(0, Math.min(100, Math.round(+v || 0))); save(); window.__applyAudioSettings(); }
  };

  // ---- 設定画面 -------------------------------------------------------
  function build() {
    const modal = document.createElement('div');
    modal.id = 'settings-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', '設定');
    modal.innerHTML =
      '<div id="settings-panel">' +
        '<div class="st-title">⚙️ 設定</div>' +
        '<div class="st-row"><div class="st-head"><span>🎵 音楽</span><b id="st-bgm-val"></b></div>' +
          '<input type="range" id="st-bgm" min="0" max="100" step="1" aria-label="音楽の音量"></div>' +
        '<div class="st-row"><div class="st-head"><span>🔔 効果音</span><b id="st-se-val"></b></div>' +
          '<input type="range" id="st-se" min="0" max="100" step="1" aria-label="効果音の音量"></div>' +
        '<div class="st-foot">' +
          '<button type="button" class="btn btn-sm" id="settings-reset-btn">もとに戻す</button>' +
          '<button type="button" class="btn btn-sm btn-primary" id="settings-close-btn">とじる</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    const q = (id) => document.getElementById(id);
    const bgm = q('st-bgm'), se = q('st-se');
    function paint(input, valEl) {
      valEl.textContent = input.value;
      input.style.setProperty('--p', input.value + '%');
    }
    function sync() {
      bgm.value = cfg.bgm; se.value = cfg.se;
      paint(bgm, q('st-bgm-val')); paint(se, q('st-se-val'));
    }
    function open()  { sync(); modal.classList.add('open'); }
    function close() { modal.classList.remove('open'); }

    bgm.addEventListener('input', () => { GameSettings.set('bgm', bgm.value); paint(bgm, q('st-bgm-val')); });
    se.addEventListener('input',  () => { GameSettings.set('se',  se.value);  paint(se,  q('st-se-val')); });
    // 効果音は、スライダーを離した時に試し聴き
    se.addEventListener('change', () => { try { if (typeof playUiSE === 'function') playUiSE('tap'); } catch (e) {} });
    q('settings-reset-btn').addEventListener('click', () => {
      GameSettings.set('bgm', DEFAULTS.bgm); GameSettings.set('se', DEFAULTS.se); sync();
      try { if (typeof playUiSE === 'function') playUiSE('tap'); } catch (e) {}
    });
    q('settings-close-btn').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) { close(); try { if (typeof playModoSound === 'function') playModoSound(); } catch (e2) {} } });

    const openBtn = q('settings-open-btn');
    if (openBtn) openBtn.addEventListener('click', open);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
