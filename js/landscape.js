// ============================================================
// 横画面レイアウト用の補助
//  ・操作時間バー(#time-row)を、横画面の時だけ右カラム(#ls-timer-slot)へ移す（縦画面に戻したら元の場所へ）
//  ・状態異常アイコン(#buff-icon-container)を、横画面の時は盤面の下(#player-status-row)へ入れる
// ============================================================
(function(){
  var mq = window.matchMedia('(orientation: landscape)');

  function moveTimer(){
    var row = document.getElementById('time-row');
    var slot = document.getElementById('ls-timer-slot');
    var wrap = document.getElementById('bars-wrap');
    if (!row || !slot || !wrap) return;
    if (mq.matches) {
      if (row.parentNode !== slot) slot.appendChild(row);
    } else {
      if (row.parentNode !== wrap) wrap.appendChild(row);
    }
  }

  function apply(){
    moveTimer();
    try { if (typeof renderBuffIcons === 'function') renderBuffIcons(); } catch(e) {}
    try { if (typeof layoutBattleBg === 'function') layoutBattleBg(); } catch(e) {}
  }

  // 公開：renderBuffIcons が「今は横画面か／入れ先はどこか」を調べるのに使う
  window.landscapeStatusHost = function(){
    return mq.matches ? document.getElementById('player-status-row') : null;
  };

  if (mq.addEventListener) mq.addEventListener('change', function(){ setTimeout(apply, 50); });
  else if (mq.addListener) mq.addListener(function(){ setTimeout(apply, 50); });
  window.addEventListener('resize', function(){ moveTimer(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', moveTimer);
  else moveTimer();
})();

// ============================================================
// 横画面のホーム：エリアを左右スライド
// ============================================================
(function(){
  var mq = window.matchMedia('(orientation: landscape)');
  window.isLandscapeHome = function(){ return mq.matches; };

  // 縦⇄横が切り替わったら、ホームが開いていればマップを作り直す（並び順・スクロール方向が変わるため）
  function rebuildHome(){
    var home = document.getElementById('home');
    if (!home || home.style.display !== 'flex') return;
    try { buildStageMap(); scrollHomeToFrontier(); } catch(e) {}
  }
  if (mq.addEventListener) mq.addEventListener('change', function(){ setTimeout(rebuildHome, 80); });
  else if (mq.addListener) mq.addListener(function(){ setTimeout(rebuildHome, 80); });

  // PCのマウスホイール（縦回転）でも横にスライドできるように
  var sc = document.getElementById('home-scroll');
  if (sc) sc.addEventListener('wheel', function(e){
    if (!mq.matches || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    sc.scrollLeft += e.deltaY; e.preventDefault();
  }, { passive: false });
})();
