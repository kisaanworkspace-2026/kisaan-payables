/* Kisaan Payables - app.js
   PHASE 1: router, welcome screen, install prompt, offline bar, update toast.
   Later phases register their screens with Router.register(). No inline onclick anywhere. */
(function () {
  'use strict';

  var CFG = window.KISAAN_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- Utilities (shared by all phases) ---------- */
  var Util = {
    // HTML-escape for text AND attribute values (fixes the old escAttr bug).
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    // Today's date (yyyy-mm-dd) in the business timezone, never the browser's UTC date.
    todayIso: function () {
      return new Intl.DateTimeFormat('en-CA', { timeZone: CFG.TIMEZONE || 'Australia/Melbourne' }).format(new Date());
    },
    // 0-23 hour in the business timezone.
    hour: function () {
      return Number(new Intl.DateTimeFormat('en-GB', { timeZone: CFG.TIMEZONE || 'Australia/Melbourne', hour: '2-digit', hour12: false }).format(new Date())) % 24;
    },
    greeting: function () {
      var h = Util.hour();
      return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : h < 21 ? 'Good Evening' : 'Good Night';
    },
    isStandalone: function () {
      return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    },
    isIOS: function () {
      var ua = navigator.userAgent;
      return /iphone|ipad|ipod/i.test(ua) || (ua.indexOf('Mac') > -1 && navigator.maxTouchPoints > 1);
    }
  };
  window.Util = Util;

  /* ---------- Toast ---------- */
  var toastTimer;
  function toast(msg, action) {
    var el = $('toast');
    el.innerHTML = '';
    var span = document.createElement('span');
    span.textContent = msg;
    el.appendChild(span);
    if (action) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = action.label;
      b.addEventListener('click', action.run);
      el.appendChild(b);
    }
    el.hidden = false;
    clearTimeout(toastTimer);
    if (!action) toastTimer = setTimeout(function () { el.hidden = true; }, 3000);
  }
  window.toast = toast;

  /* ---------- Router (hash based: works on GitHub Pages, Back button works) ---------- */
  var screens = {};
  var PLACEHOLDERS = {
    dashboard: { phase: 2, title: 'Dashboard' },
    vendors: { phase: 3, title: 'All Vendors' },
    invoices: { phase: 4, title: 'All Invoices' },
    reports: { phase: 5, title: 'Reports' }
  };

  var Router = {
    // A phase calls Router.register('dashboard', { el: sectionElement, onShow: fn })
    register: function (name, def) { screens[name] = def; },
    go: function (name) { location.hash = '#/' + name; },
    current: function () { return (location.hash.replace(/^#\/?/, '') || 'welcome').split('?')[0]; },
    render: function () {
      var name = Router.current();
      var wel = $('screen-welcome'), ph = $('screen-placeholder');
      Object.keys(screens).forEach(function (k) { if (screens[k].el) screens[k].el.hidden = true; });
      wel.hidden = true; ph.hidden = true;

      if (name === 'welcome') {
        wel.hidden = false;
      } else if (screens[name]) {
        screens[name].el.hidden = false;
        if (screens[name].onShow) screens[name].onShow();
      } else if (PLACEHOLDERS[name]) {
        $('phTitle').textContent = PLACEHOLDERS[name].title;
        $('phText').textContent = 'This screen is built in Phase ' + PLACEHOLDERS[name].phase + '.';
        ph.hidden = false;
      } else {
        wel.hidden = false; // unknown route
      }
      document.body.classList.toggle('on-welcome', name === 'welcome');
      window.scrollTo(0, 0);
    }
  };
  window.Router = Router;
  window.addEventListener('hashchange', Router.render);

  /* ---------- Install (PWA) ---------- */
  var deferredPrompt = null;

  function refreshInstallButton() {
    var btn = $('installBtn');
    var canShow = !Util.isStandalone() && (deferredPrompt || Util.isIOS());
    btn.hidden = !canShow;
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    refreshInstallButton();
  });
  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    refreshInstallButton();
    toast('Kisaan Payables installed');
  });

  function installApp() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () { deferredPrompt = null; refreshInstallButton(); });
    } else if (Util.isIOS()) {
      $('iosSheet').hidden = false;
    }
  }

  /* ---------- Offline bar ---------- */
  function syncOnline() { $('offlineBar').hidden = navigator.onLine; }
  window.addEventListener('online', syncOnline);
  window.addEventListener('offline', syncOnline);

  /* ---------- Service worker + "update available" ---------- */
  function setupServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      function promptUpdate(worker) {
        toast('A new version is ready', {
          label: 'Update',
          run: function () { worker.postMessage('SKIP_WAITING'); }
        });
      }
      if (reg.waiting && navigator.serviceWorker.controller) promptUpdate(reg.waiting);
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) promptUpdate(nw);
        });
      });
      // Check for a new version each time the app returns to the foreground.
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') reg.update().catch(function () {});
      });
    }).catch(function () { /* app still works without the SW */ });

    var reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloaded) return;
      reloaded = true;
      location.reload();
    });
  }

  /* ---------- Welcome logo fallback (if assets/kisaan-logo.png is missing) ---------- */
  function setupLogo() {
    var img = $('welcomeLogo');
    function useFallback() { img.hidden = true; $('logoFallback').hidden = false; }
    img.addEventListener('error', useFallback);
    // The image may already have failed before this script ran.
    if (img.complete && img.naturalWidth === 0) useFallback();
  }

  /* ---------- One delegated click handler (no inline onclick) ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-action]');
    if (!t) return;
    switch (t.getAttribute('data-action')) {
      case 'enter': Router.go('dashboard'); break;
      case 'home': Router.go('welcome'); break;
      case 'install': installApp(); break;
      case 'close-ios': $('iosSheet').hidden = true; break;
    }
  });
  $('iosSheet').addEventListener('click', function (e) { if (e.target === this) this.hidden = true; });

  /* ---------- Boot ---------- */
  // Launching the app always starts on Welcome (same as the old app); deep links to other screens are ignored on cold start.
  if (location.hash && Router.current() !== 'welcome') history.replaceState(null, '', location.pathname + location.search);
  setupLogo();
  syncOnline();
  refreshInstallButton();
  Router.render();
  setupServiceWorker();
})();
