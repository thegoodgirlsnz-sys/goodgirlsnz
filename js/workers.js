/* ============================================================
   GOOD GIRLS — js/workers.js
   Builds one profile per published worker on the Meet the Girls
   page, using the same layout as the original profile card.
   Each profile has a left-to-right photo & video gallery.
   If the database cannot be reached, the built-in content stays.
   ============================================================ */
(function () {
  'use strict';

  var grid = document.getElementById('workersGrid');
  if (!grid) return;

  var DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var STATUS_LABEL = {
    available: 'Available',
    limited: 'Limited availability',
    booked: 'Fully booked',
    closed: 'Closed'
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // Web links, email, phone, or a page on this site only.
  function isSafeUrl(u) {
    if (!u) return false;
    if (/^(https?:\/\/|mailto:|tel:)/i.test(u)) return true;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u) || u.indexOf('//') === 0) return false;
    return true;
  }

  function sortMedia(list) {
    return (list || []).slice().sort(function (a, b) { return a.sort_order - b.sort_order; });
  }

  /* ---------- profile pieces ---------- */

  function paragraphs(text, parent) {
    String(text || '')
      .split(/\n\s*\n/)
      .map(function (p) { return p.trim(); })
      .filter(Boolean)
      .forEach(function (p) {
        parent.appendChild(el('p', 'girl-description wk-para', p));
      });
  }

  function tagList(tags) {
    var list = String(tags || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean);
    if (!list.length) return null;
    var wrap = el('div', 'girl-tags');
    list.forEach(function (t) { wrap.appendChild(el('span', 'girl-tag', t)); });
    return wrap;
  }

  function availabilityBlock(list) {
    var rows = (Array.isArray(list) ? list : []).filter(function (x) { return x && x.day; });
    if (!rows.length) return null;

    var box = el('div', 'wk-avail');
    box.appendChild(el('h4', null, 'Availability'));
    var ul = el('ul', 'wk-avail-list');
    var added = 0;

    DAY_ORDER.forEach(function (day) {
      var x = null;
      rows.some(function (r) { if (r.day === day) { x = r; return true; } return false; });
      if (!x) return;

      var status = STATUS_LABEL[x.status] ? x.status : null;
      var label = (x.note && String(x.note).trim()) || (status ? STATUS_LABEL[status] : '');
      var hours = String(x.hours || '').trim();
      if (hours && (status === 'available' || status === 'limited')) label += ' · ' + hours;
      if (!label) return;

      var li = el('li');
      li.appendChild(el('span', 'wk-day', day));
      li.appendChild(el('span', 'wk-status' + (status ? ' wk-status--' + status : ''), label));
      ul.appendChild(li);
      added++;
    });

    if (!added) return null;
    box.appendChild(ul);
    return box;
  }

  function linksBlock(w) {
    var wrap = el('div', 'wk-links');
    var has = false;

    if (w.button_label && isSafeUrl(w.button_url)) {
      wrap.appendChild(linkEl(w.button_label, w.button_url));
      has = true;
    }
    if (w.extra_label && isSafeUrl(w.extra_url)) {
      wrap.appendChild(linkEl(w.extra_label, w.extra_url));
      has = true;
    }
    return has ? wrap : null;
  }

  function linkEl(label, url) {
    var a = el('a', 'girl-link', label);
    a.href = url;
    if (/^https?:\/\//i.test(url)) {
      a.target = '_blank';
      a.rel = 'noopener';
    }
    return a;
  }

  /* ---------- left-to-right gallery ---------- */

  function buildGallery(w, media) {
    var wrap = el('section', 'wk-gallery');
    wrap.setAttribute('aria-label', (w.name || 'Worker') + ' photos and videos');

    var head = el('div', 'wk-gallery-head');
    head.appendChild(el('span', 'wk-gallery-title', 'Gallery'));
    var arrows = el('div', 'wk-arrows');
    var prev = el('button', 'wk-arrow', '‹');
    prev.type = 'button';
    prev.setAttribute('aria-label', 'Scroll gallery left');
    var next = el('button', 'wk-arrow', '›');
    next.type = 'button';
    next.setAttribute('aria-label', 'Scroll gallery right');
    arrows.appendChild(prev);
    arrows.appendChild(next);
    head.appendChild(arrows);
    wrap.appendChild(head);

    if (!media.length) {
      wrap.appendChild(el('p', 'wk-gallery-empty', 'Photos and videos coming soon.'));
      return wrap;
    }

    var track = el('div', 'wk-track');
    track.tabIndex = 0;
    track.setAttribute('role', 'region');
    track.setAttribute('aria-label', 'Scroll sideways to see more photos and videos');

    var name = w.name || 'Worker';

    media.forEach(function (m, i) {
      var item = el('figure', 'wk-item');
      var node;
      if (m.kind === 'video') {
        node = document.createElement('video');
        node.controls = true;
        node.playsInline = true;
        node.preload = 'metadata';
        node.setAttribute('aria-label', name + ' video ' + (i + 1));
        node.addEventListener('loadedmetadata', update);
      } else {
        node = document.createElement('img');
        node.loading = 'lazy';
        node.decoding = 'async';
        node.alt = name + ' photo ' + (i + 1);
        node.addEventListener('load', update);
      }
      node.src = m.url;
      item.appendChild(node);
      track.appendChild(item);
    });

    wrap.appendChild(track);

    var hint = el('p', 'wk-gallery-hint', 'Swipe sideways to see more');
    wrap.appendChild(hint);

    function amount() {
      return Math.max(200, Math.round(track.clientWidth * 0.8));
    }

    prev.addEventListener('click', function () {
      track.scrollBy({ left: -amount(), behavior: 'smooth' });
    });
    next.addEventListener('click', function () {
      track.scrollBy({ left: amount(), behavior: 'smooth' });
    });

    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { track.scrollBy({ left: 200, behavior: 'smooth' }); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { track.scrollBy({ left: -200, behavior: 'smooth' }); e.preventDefault(); }
    });

    function update() {
      var max = track.scrollWidth - track.clientWidth - 2;
      var overflow = max > 0;
      arrows.hidden = !overflow;
      hint.hidden = !overflow;
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max;
    }

    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    requestAnimationFrame(update);
    update();

    return wrap;
  }

  /* ---------- one profile ---------- */

  function renderWorker(w, media) {
    var article = el('article', 'girl-profile');
    if (w.slug) article.id = w.slug;

    var card = el('div', 'girl-card');

    var imgBox = el('div', 'girl-image');
    var cover = media.filter(function (m) { return m.kind === 'image'; })[0];
    if (cover) {
      var img = document.createElement('img');
      img.src = cover.url;
      img.alt = (w.name || 'Worker') + (w.title ? ' – ' + w.title.toLowerCase() : '');
      img.loading = 'lazy';
      imgBox.appendChild(img);
    } else {
      imgBox.className += ' girl-image--placeholder';
      imgBox.appendChild(el('span', null, String(w.name || '?').charAt(0).toUpperCase()));
    }
    card.appendChild(imgBox);

    var content = el('div', 'girl-content');
    content.appendChild(el('h3', 'girl-name', w.name || ''));
    if (w.title) content.appendChild(el('p', 'girl-title', w.title));
    paragraphs(w.about, content);

    var tags = tagList(w.tags);
    if (tags) content.appendChild(tags);

    var avail = availabilityBlock(w.availability);
    if (avail) content.appendChild(avail);

    var links = linksBlock(w);
    if (links) content.appendChild(links);

    card.appendChild(content);
    article.appendChild(card);
    article.appendChild(buildGallery(w, media));
    return article;
  }


  /* ---------- DEMO MODE (for layout checks, no database needed) ----------
     Open meet-the-girls.html?demo=1 to see sample profiles.           */
  var DEMO_WORKERS = [
    {
      id: 'demo-1', slug: 'missy', name: 'Missy', title: 'FOUNDER · PRACTITIONER',
      about: 'With a background in dance, breathwork, Reiki and embodied practices, Missy brings a naturally intuitive and sensual approach to her work.\n\nWarm, playful and attentive, her style is slow and sensual, shaped around presence and making you feel completely at ease.',
      tags: 'Signature, Training Doubles, Long Sessions, First-Timers Welcome',
      availability: [
        { day: 'Monday', status: 'available', hours: '10am – 4pm', note: '' },
        { day: 'Tuesday', status: 'available', hours: '12pm – 8pm', note: '' },
        { day: 'Wednesday', status: 'booked', hours: '', note: 'Fully Booked' },
        { day: 'Thursday', status: 'available', hours: '10am – 6pm', note: '' },
        { day: 'Friday', status: 'limited', hours: '2pm – 8pm', note: '' },
        { day: 'Saturday', status: 'limited', hours: '', note: '' },
        { day: 'Sunday', status: 'closed', hours: '', note: '' }
      ],
      button_label: 'Request Missy →', button_url: 'booking.html',
      extra_label: '', extra_url: '',
      worker_media: [
        { kind: 'image', url: 'images/Missy.jpg', sort_order: 1 },
        { kind: 'image', url: 'images/01.jpg', sort_order: 2 },
        { kind: 'image', url: 'images/02.jpg', sort_order: 3 },
        { kind: 'image', url: 'images/03.jpg', sort_order: 4 },
        { kind: 'image', url: 'images/04.jpg', sort_order: 5 }
      ]
    },
    {
      id: 'demo-2', slug: 'sample-worker', name: 'Sample Worker', title: 'PRACTITIONER',
      about: 'This is a sample profile to check the layout. Real details will come from the admin panel.',
      tags: 'Signature, Long Sessions',
      availability: [
        { day: 'Monday', status: 'closed', hours: '', note: '' },
        { day: 'Tuesday', status: 'available', hours: '9am – 1pm', note: '' },
        { day: 'Wednesday', status: 'available', hours: '9am – 1pm', note: 'Busy' }
      ],
      button_label: 'Request Session', button_url: 'booking.html',
      extra_label: 'Contact', extra_url: 'contact.html',
      worker_media: [
        { kind: 'image', url: 'images/05.jpg', sort_order: 1 },
        { kind: 'image', url: 'images/06.jpg', sort_order: 2 },
        { kind: 'image', url: 'images/07.jpg', sort_order: 3 },
        { kind: 'image', url: 'images/08.jpg', sort_order: 4 },
        { kind: 'image', url: 'images/23.jpg', sort_order: 5 },
        { kind: 'image', url: 'images/33.jpg', sort_order: 6 }
      ]
    },
    {
      id: 'demo-3', slug: 'new-worker', name: 'New Worker', title: '',
      about: 'A profile with no photos yet, to check the empty gallery message.',
      tags: '',
      availability: [],
      button_label: '', button_url: '', extra_label: '', extra_url: '',
      worker_media: []
    }
  ];

  /* Demo stays on after refresh (per browser tab).
     Turn it on:  ...meet-the-girls.html?demo=1
     Turn it off: ...meet-the-girls.html?demo=0            */
  function isDemoOn() {
    var q = location.search;
    try {
      if (/[?&]demo=0\b/.test(q)) { sessionStorage.removeItem('gg_demo'); return false; }
      if (/[?&]demo=1\b/.test(q)) sessionStorage.setItem('gg_demo', '1');
      return sessionStorage.getItem('gg_demo') === '1';
    } catch (e) {
      return /[?&]demo=1\b/.test(q);
    }
  }

  function showDemoBanner() {
    var b = el('p', 'wk-demo-banner', 'DEMO MODE: sample profiles only. Live profiles come from the database once it is connected.');
    grid.parentNode.insertBefore(b, grid);
  }

  /* ---------- load + render ---------- */

  function render(list) {
    var frag = document.createDocumentFragment();
    list.forEach(function (w) {
      frag.appendChild(renderWorker(w, sortMedia(w.worker_media)));
    });

    grid.innerHTML = '';
    if (!list.length) {
      grid.appendChild(el('p', 'wk-gallery-empty', 'Our girls will be introduced here soon.'));
    } else {
      grid.appendChild(frag);
    }
    grid.classList.add('revealed');
  }

  function load() {
    if (isDemoOn()) {
      showDemoBanner();
      render(DEMO_WORKERS);
      return;
    }
    if (!window.supabaseClient) {
      console.warn('[Workers] Supabase not connected - showing built-in profile.');
      return;
    }
    window.supabaseClient.from('workers')
      .select('id,slug,name,title,about,tags,availability,button_label,button_url,extra_label,extra_url,worker_media(id,kind,url,sort_order)')
      .eq('published', true)
      .order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error || !res.data) {
          console.warn('[Workers] Could not load profiles:', res.error);
          return;
        }
        render(res.data);
      }, function (err) {
        console.warn('[Workers] Load failed:', err);
      });
  }

  load();
  window.addEventListener('pageshow', function (e) { if (e.persisted) load(); });
})();