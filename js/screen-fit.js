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
  // ホーム画面のアプリ(PWA)として開いているときは、最初から全画面。Fullscreen APIを使うと
  // 「全画面表示を終了するには…」の表示が出てプレイの邪魔になるので、その場合は何もしない
  function isStandalone(){
    try {
      return (window.matchMedia && (matchMedia('(display-mode: standalone)').matches ||
                                    matchMedia('(display-mode: fullscreen)').matches ||
                                    matchMedia('(display-mode: minimal-ui)').matches)) ||
             window.navigator.standalone === true;
    } catch(e) { return false; }
  }
  // 全画面にする（game.js からも使う）。すでに全画面／アプリ表示なら何もしない
  window.requestAppFullscreen = function(){
    if (isFs() || isStandalone()) return;
    var el = document.documentElement;
    var fn = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (!fn) return;
    try {
      var r = fn.call(el, { navigationUI: 'hide' });
      if (r && r.catch) r.catch(function(){});
    } catch(e) {}
  };
  // ※以前は「全画面でない間、タップのたびに再試行」していたが、フチをなぞって全画面が解除されるたびに
  //   次のタップで入り直して、毎回「全画面表示を終了するには…」の表示が出てしまうため廃止
  //   （全画面にするのは、スタート／ホームの最初のタップ時だけ）
})();
