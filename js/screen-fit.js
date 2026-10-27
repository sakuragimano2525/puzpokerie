// ============================================================
// 画面サイズ補正 & どこをタップしても全画面
// ============================================================
(function(){
  function setAppHeight(){
    var h = (window.visualViewport ? window.visualViewport.height : window.innerHeight);
    document.documentElement.style.setProperty('--app-h', h + 'px');
  }
  setAppHeight();
  window.addEventListener('resize', setAppHeight);
  window.addEventListener('orientationchange', function(){ setTimeout(setAppHeight, 200); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', setAppHeight);
  document.addEventListener('fullscreenchange', function(){ setTimeout(setAppHeight, 100); });
  document.addEventListener('webkitfullscreenchange', function(){ setTimeout(setAppHeight, 100); });

  function isFs(){ return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function goFullscreen(){
    if (isFs()) return;
    var el = document.documentElement;
    var fn = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (!fn) return;
    try {
      var r = fn.call(el, { navigationUI: 'hide' });
      if (r && r.catch) r.catch(function(){});
    } catch(e) {}
  }
  // 全画面でない間は、タップのたびに再試行する（解除された場合も再度タップで復帰）
  ['click','touchend','pointerup'].forEach(function(ev){
    document.addEventListener(ev, goFullscreen, true);
  });
})();
