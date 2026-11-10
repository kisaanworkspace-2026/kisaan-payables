/* Kisaan Payables - dashboard.js  (PHASE 2)
   Shows cached data instantly, then refreshes from the API. */
(function () {
  'use strict';

  var CFG = window.KISAAN_CONFIG || {};
  var TZ = CFG.TIMEZONE || 'Australia/Melbourne';
  var Util = window.Util, Api = window.Api, Router = window.Router;
  var $ = function (id) { return document.getElementById(id); };
  var el = $('screen-dashboard');

  var CACHE_KEY = 'dashboard';
  var STALE_MS = 60 * 1000;
  var state = { data: null, at: 0, loading: false };

  function set(id, text) { var n = $(id); if (n) n.textContent = text; }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function compact(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'k';
    return '$' + Math.round(n);
  }
  function monthLabel(key, opts) {
    var p = key.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, 1)).toLocaleDateString('en-AU', Object.assign({ timeZone: 'UTC' }, opts));
  }

  /* ----- header: greeting, date, last-updated ----- */
  function renderHeader() {
    set('dashGreeting', Util.greeting() + ' ਸੱਜਣੋ 🙏');
    var now = new Date();
    var date = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
    var upd = state.at
      ? ' · Updated ' + new Intl.DateTimeFormat('en-AU', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(state.at))
      : '';
    set('dashDate', date + upd);
  }

  /* ----- main render ----- */
  function render() {
    var d = state.data;
    if (!d) return;
    var s = d.stats || {}, c = d.counts || {};

    set('heroOutstanding', Util.money(s.outstanding));
    set('heroGross', Util.money(s.grossOutstanding));
    set('heroCredits', Util.money(s.appliedCredits));

    set('mOverdue', Util.money(s.overdue));
    set('mOverdueCount', plural(c.overdue || 0, 'invoice'));
    set('mDue', Util.money(s.dueToday));
    set('mDueCount', plural(c.due || 0, 'invoice'));
    set('mUpcoming', Util.money(s.upcoming30));
    set('mUpcomingCount', plural(c.upcoming || 0, 'invoice'));
    set('mGross', Util.money(s.grossInvoiceValue));
    set('mGrossCount', plural(c.invoices || 0, 'invoice') + ' · ' + plural(c.creditNotes || 0, 'credit note'));

    renderMonths(d);
    renderVendors(d.topVendors || []);
    renderHeader();
  }

  // One "Overdue" bar for all past months, then the next 5 months.
  function renderMonths(d) {
    var box = $('monthChart');
    var cur = String(d.todayIso || '').slice(0, 7);
    var over = { amount: 0, count: 0 }, future = [];
    (d.monthwise || []).forEach(function (m) {
      if (m.month < cur) { over.amount += m.amount; over.count += m.count; }
      else future.push(m);
    });

    var bars = [];
    if (over.count) bars.push({ label: 'Overdue', full: 'Overdue', amount: over.amount, count: over.count, cls: 'is-over', go: 'invoices?filter=overdue' });
    future.slice(0, 5).forEach(function (m) {
      bars.push({
        label: monthLabel(m.month, { month: 'short' }),
        full: monthLabel(m.month, { month: 'long', year: 'numeric' }),
        amount: m.amount, count: m.count, cls: '', go: 'invoices?month=' + m.month
      });
    });

    if (!bars.length) { box.innerHTML = '<div class="empty">Nothing due. All caught up.</div>'; return; }
    var max = Math.max.apply(null, bars.map(function (b) { return b.amount; }).concat([1]));

    box.innerHTML = bars.map(function (b) {
      var pct = Math.max(8, Math.round((b.amount / max) * 100));
      return '<button type="button" class="month ' + b.cls + '" data-go="' + Util.esc(b.go) + '"' +
        ' aria-label="' + Util.esc(b.full + ': ' + Util.money(b.amount) + ', ' + plural(b.count, 'invoice')) + '">' +
        '<span class="m-amt">' + compact(b.amount) + '</span>' +
        '<span class="bar-area"><span class="bar" style="height:' + pct + '%"></span></span>' +
        '<span class="m-lbl">' + Util.esc(b.label) + '</span>' +
        '<span class="m-cnt">' + plural(b.count, 'inv') + '</span></button>';
    }).join('');
  }

  function renderVendors(list) {
    var box = $('topVendors');
    if (!list.length) { box.innerHTML = '<div class="empty">No vendor data</div>'; return; }
    box.innerHTML = list.map(function (v) {
      var n = Number(v.dueInvoiceCount) || 0;
      return '<button type="button" class="row" data-go="vendors?name=' + Util.esc(encodeURIComponent(v.name)) + '">' +
        '<span class="avatar">' + Util.esc(Util.initials(v.name)) + '</span>' +
        '<span class="row-main"><b>' + Util.esc(v.name) + '</b><small>' + plural(n, 'invoice') + '</small></span>' +
        '<span class="amount">' + Util.money(v.outstanding) + '</span>' +
        '<svg class="ic chev"><use href="#i-chevron-right"/></svg></button>';
    }).join('');
  }

  /* ----- error banner ----- */
  function showError(e) {
    var b = $('dashError');
    if (!e) { b.hidden = true; return; }
    var reason = e.code === 'config' ? e.message
      : e.code === 'network' ? 'no connection'
      : e.code === 'timeout' ? 'the server took too long'
      : e.message;
    var lead = state.data ? 'Showing saved data. Could not refresh: ' : 'Could not load the dashboard: ';
    b.innerHTML = '<svg class="ic"><use href="#i-alert-circle"/></svg><span></span>' +
      '<button type="button" data-action="dash-refresh">Retry</button>';
    b.querySelector('span').textContent = lead + reason + '.';
    b.hidden = false;
  }

  /* ----- loading ----- */
  function load(force) {
    if (state.loading) return;
    if (!force && state.data && Date.now() - state.at < STALE_MS) return;
    state.loading = true;
    el.classList.add('is-loading');
    showError(null);

    Api.call('dashboard').then(function (d) {
      state.data = d; state.at = Date.now();
      Api.cacheSet(CACHE_KEY, d);
      render();
    }).catch(function (e) {
      if (e.code === 'unauthorized') { askPin(e); return; }
      showError(e);
    }).finally(function () {
      state.loading = false;
      el.classList.remove('is-loading');
      renderHeader();
    });
  }

  /* ----- PIN prompt (only if you set APP_PIN on the server) ----- */
  function askPin(e) {
    var sheet = $('pinSheet');
    $('pinError').textContent = Api.getPin() ? 'That PIN was not accepted.' : '';
    $('pinInput').value = '';
    sheet.hidden = false;
    setTimeout(function () { $('pinInput').focus(); }, 50);
  }
  $('pinForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var v = $('pinInput').value.trim();
    if (!v) return;
    Api.setPin(v);
    $('pinSheet').hidden = true;
    load(true);
  });

  /* ----- events ----- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-action]');
    if (!t) return;
    var a = t.getAttribute('data-action');
    if (a === 'dash-refresh') load(true);
    else if (a === 'close-pin') $('pinSheet').hidden = true;
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && !el.hidden) load(false);
  });
  setInterval(function () { if (!el.hidden) renderHeader(); }, 60 * 1000);

  /* ----- register with the router ----- */
  var cached = Api.cacheGet(CACHE_KEY);
  if (cached && cached.data) { state.data = cached.data; state.at = cached.at || 0; }

  Router.register('dashboard', {
    el: el,
    onShow: function () {
      renderHeader();
      if (state.data) render();
      load(false);
    }
  });
})();
