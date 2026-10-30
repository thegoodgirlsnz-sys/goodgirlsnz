/* ============================================================
   GOOD GIRLS — js/loader.js
   Reads editable content (text, prices, images) from Supabase
   table `site_content` and fills it into the public pages.
   If anything fails, the page simply keeps its built-in content.
   ============================================================ */
(function () {
  var CACHE_KEY = 'gg_site_content_v1';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  // client-friendly markup: **bold**, *italic*, new line
  function toHTML(value) {
    return esc(value)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\r?\n/g, '<br>');
  }

  function toTel(text) {
    var d = String(text).replace(/[^\d+]/g, '');
    if (d.charAt(0) === '+') return 'tel:' + d;
    if (d.charAt(0) === '0') return 'tel:+64' + d.slice(1);
    return 'tel:' + d;
  }

  function applyText(map) {
    document.querySelectorAll('[data-cms]').forEach(function (el) {
      var key = el.getAttribute('data-cms');
      if (!(key in map)) return;
      var v = map[key];
      el.innerHTML = toHTML(v);
      if (el.tagName === 'A') {
        var href = el.getAttribute('href') || '';
        if (href.indexOf('tel:') === 0) el.setAttribute('href', toTel(v));
        else if (href.indexOf('mailto:') === 0) el.setAttribute('href', 'mailto:' + String(v).trim());
      }
    });
  }

  function applyImages(map) {
    document.querySelectorAll('[data-cms-img]').forEach(function (img) {
      var key = img.getAttribute('data-cms-img');
      var v = map[key];
      if (!v) return;
      if (img.getAttribute('src') !== v) {
        img.removeAttribute('srcset');
        img.setAttribute('src', v);
      }
    });
  }

  /* ---- booking pages: header price/description + dropdown labels ---- */
  function nums(str, re) { return String(str || '').match(re) || []; }

  function priceLong(map, type) {
    var durs = nums(map['service.' + type + '.durations'], /\d+/g);
    var prices = nums(map['service.' + type + '.prices'], /\$\s?[\d,.]+/g);
    if (durs.length && durs.length === prices.length) {
      return durs.map(function (d, i) { return d + ' Mins / ' + prices[i].replace(/\s/g, ''); }).join(' · ');
    }
    return (map['service.' + type + '.durations'] || '') + ' — ' + (map['service.' + type + '.prices'] || '');
  }

  function range(map, type) {
    var p = nums(map['service.' + type + '.prices'], /\$\s?[\d,.]+/g)
      .map(function (x) { return { t: x.replace(/\s/g, ''), n: parseFloat(x.replace(/[^\d.]/g, '')) }; })
      .filter(function (x) { return !isNaN(x.n); });
    if (!p.length) return null;
    p.sort(function (a, b) { return a.n - b.n; });
    return p[0].t + ' – ' + p[p.length - 1].t;
  }

  function applyBookingPages(map) {
    var price = document.getElementById('servicePrice');
    var desc = document.getElementById('serviceDescription');
    var sel = document.getElementById('serviceSelect');
    if (!price && !sel) return;

    var q = new URLSearchParams(location.search).get('service');
    var type = (q === 'training') ? 'training' : 'signature';

    if (price && map['service.' + type + '.prices']) price.textContent = priceLong(map, type);
    if (desc && map['service.' + type + '.description']) desc.textContent = map['service.' + type + '.description'];

    if (sel) {
      var names = { signature: 'The Signature Experience', training: 'Bi Doubles' };
      var message = document.getElementById('message');
      Array.prototype.forEach.call(sel.options, function (opt) {
        ['signature', 'training'].forEach(function (t) {
          if (opt.value.indexOf(names[t]) !== 0) return;
          var r = range(map, t);
          if (!r) return;
          var oldVal = opt.value;
          var newVal = names[t] + ' (' + r + ')';
          if (oldVal === newVal) return;
          var wasSelected = sel.value === oldVal;
          opt.value = newVal;
          if (wasSelected) sel.value = newVal;
          if (message && message.value.indexOf(oldVal) !== -1) {
            message.value = message.value.split(oldVal).join(newVal);
          }
        });
      });
    }
  }

  function applyAll(map) {
    applyText(map);
    applyImages(map);
    applyBookingPages(map);
  }

  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; }
  }
  function writeCache(map) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(map)); } catch (e) {}
  }

  function load() {
    // 1) instant paint from last visit (avoids flicker of old text)
    var cached = readCache();
    if (cached) applyAll(cached);

    // 2) always refresh from the database
    if (!window.supabaseClient) { console.warn('[CMS] Supabase not connected - showing built-in content.'); return; }
    window.supabaseClient.from('site_content').select('key, value').then(function (res) {
      if (res.error || !res.data) { console.warn('[CMS] Could not load content:', res.error); return; }
      var map = {};
      res.data.forEach(function (r) { map[r.key] = r.value; });
      writeCache(map);
      applyAll(map);
    }, function (err) { console.warn('[CMS] Load failed:', err); });
  }

  document.addEventListener('DOMContentLoaded', load);
  window.addEventListener('pageshow', function (e) { if (e.persisted) load(); });
})();
