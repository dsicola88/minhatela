function escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Página hospedeira do embed Bunny + Player.js (seek/play/tempo reais).
 */
export function buildBunnyPlayerPage(embedUrl, { startSeconds = 0 } = {}) {
  const src = escapeAttr(embedUrl);
  const start = Math.max(0, Number(startSeconds) || 0);
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>html,body{margin:0;background:#000;height:100%;overflow:hidden}iframe{border:0;width:100%;height:100%}</style>
<script src="https://assets.mediadelivery.net/playerjs/player-0.1.0.min.js"></script>
</head><body>
<iframe id="bp" src="${src}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>
<script>
(function(){
  var start = ${start};
  var player = null;
  function emit(payload){
    try {
      var msg = JSON.stringify(payload);
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(msg);
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(msg, '*');
      }
    } catch (e) {}
  }
  function bind(){
    if (typeof playerjs === 'undefined') { setTimeout(bind, 80); return; }
    player = new playerjs.Player(document.getElementById('bp'));
    player.on('ready', function(){
      emit({ type: 'ready' });
      if (start > 3 && player.setCurrentTime) player.setCurrentTime(start);
      player.on('timeupdate', function(d){
        var sec = (d && (d.seconds || d.duration === undefined && d)) || 0;
        if (typeof d === 'object' && d.seconds != null) sec = d.seconds;
        emit({ type: 'time', seconds: Number(sec) || 0, duration: d && d.duration ? Number(d.duration) : 0 });
      });
      player.on('ended', function(){ emit({ type: 'ended' }); });
      player.on('play', function(){ emit({ type: 'play' }); });
      player.on('pause', function(){ emit({ type: 'pause' }); });
    });
  }
  bind();
  function onHost(raw){
    try {
      var data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!data || !player) return;
      if (data.type === 'seek' && player.setCurrentTime) player.setCurrentTime(Number(data.seconds) || 0);
      if (data.type === 'play' && player.play) player.play();
      if (data.type === 'pause' && player.pause) player.pause();
    } catch (e) {}
  }
  document.addEventListener('message', function(e){ onHost(e.data); });
  window.addEventListener('message', function(e){ onHost(e.data); });
  document.addEventListener('contextmenu', function(e){ e.preventDefault(); });
})();
</script>
</body></html>`;
}
