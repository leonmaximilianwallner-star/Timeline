// ui/loader.js — loading screen: fades out once the app is ready. Moved unchanged from index.html lines 617–628 on 21 Oct 2026.
  (function(){
    var loader = document.getElementById('tl-loader');
    var animDone = new Promise(function(r){ setTimeout(r, 1800); }); // 2.9s draw + 0.4s hold
    var appReady = new Promise(function(r){
      if (document.readyState === 'complete') r();
      else window.addEventListener('load', r, { once: true });
    });
    Promise.all([animDone, appReady]).then(function(){
      loader.classList.add('fade-out');
      loader.addEventListener('transitionend', function(){ loader.remove(); }, { once: true });
    });
  })();
