/* ============================================================
   GOOD GIRLS — js/admin-workers.js
   Lists every worker profile, lets the client reorder them,
   show/hide them on the website, and add a new one.
   ============================================================ */
(function () {
  'use strict';

  var sb = window.supabaseClient;
  var $ = function (id) { return document.getElementById(id); };
  var msgEl = $('message');
  var workers = [];
  var busy = false;

  function show(type, text) {
    msgEl.className = 'message ' + type + ' show';
    msgEl.textContent = text;
    if (type === 'success') setTimeout(function () { msgEl.className = 'message'; }, 4500);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function errText(err) {
    return (err && err.message) ? err.message : String(err);
  }

  if (!sb) {
    show('error', 'Supabase is not configured. Please check supabase-config.js.');
    $('loadingState').style.display = 'none';
    return;
  }

  /* ---------- auth ---------- */
  function logout() {
    var go = function () { location.href = 'admin-login.html'; };
    sb.auth.signOut().then(go, go);
  }
  $('logoutBtn').addEventListener('click', logout);

  sb.auth.getSession().then(function (r) {
    var s = r && r.data ? r.data.session : null;
    if (!s) { location.href = 'admin-login.html'; return; }
    if (s.user) $('userEmail').textContent = s.user.email || '';
    load();
  });

  $('addBtn').addEventListener('click', function () {
    location.href = 'admin-worker.html?id=new';
  });

  /* ---------- load ---------- */
  function load() {
    $('loadingState').style.display = 'block';
    $('list').hidden = true;
    $('emptyState').hidden = true;

    sb.from('workers')
      .select('id,name,slug,title,published,sort_order,worker_media(id,kind,url,sort_order)')
      .order('sort_order', { ascending: true })
      .then(function (res) {
        $('loadingState').style.display = 'none';
        if (res.error) { show('error', 'Could not load workers: ' + errText(res.error)); return; }
        workers = res.data || [];
        workers.forEach(function (w) {
          w.worker_media = (w.worker_media || []).sort(function (a, b) { return a.sort_order - b.sort_order; });
        });
        render();
      });
  }

  /* ---------- render ---------- */
  function render() {
    var list = $('list');
    list.innerHTML = '';

    if (!workers.length) {
      $('emptyState').hidden = false;
      list.hidden = true;
      return;
    }
    list.hidden = false;

    workers.forEach(function (w, i) {
      var media = w.worker_media || [];
      var photos = media.filter(function (m) { return m.kind === 'image'; }).length;
      var videos = media.length - photos;

      var row = el('div', 'wk-row' + (w.published ? '' : ' wk-row--hidden'));

      // thumbnail
      var thumb = el('div', 'wk-thumb');
      var cover = media[0];
      if (cover && cover.kind === 'video') {
        var v = document.createElement('video');
        v.muted = true; v.playsInline = true; v.preload = 'metadata';
        v.src = cover.url + '#t=0.1';
        thumb.appendChild(v);
      } else if (cover) {
        var img = document.createElement('img');
        img.alt = ''; img.loading = 'lazy'; img.src = cover.url;
        thumb.appendChild(img);
      } else {
        thumb.appendChild(el('span', null, (w.name || '?').charAt(0).toUpperCase()));
      }
      row.appendChild(thumb);

      // info
      var info = el('div', 'wk-row-info');
      var name = el('div', 'wk-row-name', w.name || 'Unnamed');
      var pill = el('span', 'wk-pill' + (w.published ? '' : ' off'), w.published ? 'On website' : 'Hidden');
      name.appendChild(pill);
      info.appendChild(name);
      info.appendChild(el('div', 'wk-row-meta',
        (w.title ? w.title + ' · ' : '') +
        photos + ' photo' + (photos === 1 ? '' : 's') + ' · ' +
        videos + ' video' + (videos === 1 ? '' : 's')));
      row.appendChild(info);

      // actions
      var actions = el('div', 'wk-row-actions');
      var move = el('div', 'wk-move');
      var up = el('button', 'wk-btn-small', '↑ Up');
      up.type = 'button'; up.setAttribute('aria-label', 'Move ' + w.name + ' up');
      up.disabled = i === 0 || busy;
      up.addEventListener('click', function () { reorder(i, -1); });
      var down = el('button', 'wk-btn-small', '↓ Down');
      down.type = 'button'; down.setAttribute('aria-label', 'Move ' + w.name + ' down');
      down.disabled = i === workers.length - 1 || busy;
      down.addEventListener('click', function () { reorder(i, 1); });
      move.appendChild(up); move.appendChild(down);
      actions.appendChild(move);

      var edit = el('a', 'wk-btn-small', 'Edit profile');
      edit.href = 'admin-worker.html?id=' + encodeURIComponent(w.id);
      actions.appendChild(edit);

      var toggle = el('button', 'wk-btn-small wk-btn-ghost', w.published ? 'Hide from website' : 'Show on website');
      toggle.type = 'button';
      toggle.disabled = busy;
      toggle.addEventListener('click', function () { togglePublished(w); });
      actions.appendChild(toggle);

      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  /* ---------- actions ---------- */
  function setBusy(on) {
    busy = on;
    document.querySelectorAll('#list button').forEach(function (b) {
      if (on) b.disabled = true;
    });
  }

  // Swap a worker with its neighbour, then renumber so the order is always clean.
  function reorder(i, dir) {
    var j = i + dir;
    if (busy || j < 0 || j >= workers.length) return;
    var moved = workers.slice();
    var tmp = moved[i]; moved[i] = moved[j]; moved[j] = tmp;

    var writes = [];
    moved.forEach(function (w, idx) {
      var n = idx + 1;
      if (w.sort_order !== n) {
        writes.push(
          sb.from('workers').update({ sort_order: n }).eq('id', w.id).select('id')
            .then(function (res) {
              if (res.error) throw res.error;
              if (!res.data || !res.data.length) throw new Error('Permission denied');
              w.sort_order = n;
            })
        );
      }
    });

    setBusy(true);
    Promise.all(writes).then(function () {
      workers = moved.slice().sort(function (a, b) { return a.sort_order - b.sort_order; });
      render();
    }).catch(function (e) {
      show('error', 'Could not change the order: ' + errText(e));
      load();
    }).then(function () { busy = false; });
  }

  function togglePublished(w) {
    if (busy) return;
    var next = !w.published;
    var msg = next
      ? 'Show ' + w.name + ' on the website?'
      : 'Hide ' + w.name + ' from the website? (Her profile is kept and you can show it again later.)';
    if (!confirm(msg)) return;

    setBusy(true);
    sb.from('workers').update({ published: next, updated_at: new Date().toISOString() })
      .eq('id', w.id).select('id')
      .then(function (res) {
        if (res.error) throw res.error;
        if (!res.data || !res.data.length) throw new Error('Permission denied');
        w.published = next;
        show('success', next ? w.name + ' is now shown on the website.' : w.name + ' is hidden from the website.');
        busy = false;
        render();
      })
      .catch(function (e) {
        show('error', 'Could not update: ' + errText(e));
        busy = false;
        render();
      });
  }
})();
