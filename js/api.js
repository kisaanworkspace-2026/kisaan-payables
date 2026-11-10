/* Kisaan Payables - api.js
   Talks to the Apps Script JSON API. GET only (no preflight, works from GitHub Pages).
   Every failure is an Error with .code: config | network | timeout | http | unauthorized | server */
(function () {
  'use strict';

  var CFG = window.KISAAN_CONFIG || {};
  var PIN_KEY = 'kp_pin';
  var CACHE_PREFIX = 'kp_cache_';

  function err(msg, code) { var e = new Error(msg); e.code = code; return e; }

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode / full */ } }

  var Api = {
    getPin: function () { return lsGet(PIN_KEY) || ''; },
    setPin: function (v) { lsSet(PIN_KEY, String(v || '')); },

    call: function (action, params, timeoutMs) {
      if (!CFG.API_URL) return Promise.reject(err('API_URL is not set in js/config.js', 'config'));
      var q = new URLSearchParams(Object.assign({ action: action }, params || {}));
      var pin = Api.getPin();
      if (pin) q.set('pin', pin);

      var ctrl = new AbortController();
      var timer = setTimeout(function () { ctrl.abort(); }, timeoutMs || 30000);

      return fetch(CFG.API_URL + '?' + q.toString(), { signal: ctrl.signal, redirect: 'follow', credentials: 'omit' })
        .then(function (r) {
          if (!r.ok) throw err('Server error ' + r.status, 'http');
          return r.json();
        })
        .then(function (j) {
          if (!j || j.ok !== true) throw err((j && j.error) || 'Request failed', (j && j.code) || 'server');
          return j.data;
        })
        .catch(function (e) {
          if (e && e.name === 'AbortError') throw err('The server took too long', 'timeout');
          if (e instanceof TypeError) throw err('Cannot reach the server', 'network');
          throw e;
        })
        .finally(function () { clearTimeout(timer); });
    },

    // Last good response, so the app opens instantly and works offline (read only).
    cacheGet: function (key) {
      try { return JSON.parse(lsGet(CACHE_PREFIX + key)); } catch (e) { return null; }
    },
    cacheSet: function (key, data) {
      lsSet(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), data: data }));
    }
  };

  window.Api = Api;
})();
