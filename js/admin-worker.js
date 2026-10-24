/* ============================================================
   GOOD GIRLS — js/admin-worker.js
   Editor for ONE worker profile:
   details · links · weekly availability · photo & video gallery
   ============================================================ */
(function () {
  'use strict';

  var BUCKET = 'worker-media';
  var MAX_IMG_WIDTH = 1600;
  var MAX_IMAGE_BYTES = 25 * 1024 * 1024;
  var MAX_VIDEO_BYTES = 50 * 1024 * 1024;
  var DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var STATUSES = [
    { value: 'available', label: 'Available' },
    { value: 'limited',   label: 'Limited availability' },
    { value: 'booked',    label: 'Fully booked' },
    { value: 'closed',    label: 'Closed' }
  ];

  var sb = window.supabaseClient;
  var $ = function (id) { return document.getElementById(id); };
  var msgEl = $('message');
  var params = new URLSearchParams(location.search);
  var workerId = params.get('id');
  var isNew = workerId === 'new';

  var media = [];        // gallery items for this worker, in display order
  var availRows = [];    // [{ day, status, hours, note }] element refs
  var busy = false;
  var snapshot = '';
  var currentName = '';

  function show(type, text) {
    msgEl.className = 'message ' + type + ' show';
    msgEl.textContent = text;
    if (type === 'success') setTimeout(function () { msgEl.className = 'message'; }, 6000);
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

  function slugify(s) {
    return String(s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  // Only allow web links, email, phone, or a page on this site.
  function isSafeUrl(u) {
    if (!u) return true;
    if (/^(https?:\/\/|mailto:|tel:)/i.test(u)) return true;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u) || u.indexOf('//') === 0) return false;
    return true;
  }

  if (!sb) {
    show('error', 'Supabase is not configured. Please check supabase-config.js.');
    $('loadingState').style.display = 'none';
    return;
  }
  if (!isNew && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workerId || '')) {
    location.replace('admin-workers.html');
    return;
  }

  /* ---------- auth ---------- */
  $('logoutBtn').addEventListener('click', function () {
    var go = function () { location.href = 'admin-login.html'; };
    sb.auth.signOut().then(go, go);
  });

  sb.auth.getSession().then(function (r) {
    var s = r && r.data ? r.data.session : null;
    if (!s) { location.href = 'admin-login.html'; return; }
    if (s.user) $('userEmail').textContent = s.user.email || '';
    if (isNew) setupNew(); else loadWorker();
  });

  /* ---------- availability rows ---------- */
  function defaultAvailability() {
    return DAYS.map(function (d) { return { day: d, status: 'available', hours: '', note: '' }; });
  }

  function normalizeAvailability(arr) {
    var byDay = {};
    (Array.isArray(arr) ? arr : []).forEach(function (x) { if (x && x.day) byDay[x.day] = x; });
    return DAYS.map(function (d) {
      var x = byDay[d] || {};
      var st = STATUSES.some(function (s) { return s.value === x.status; }) ? x.status : 'available';
      return { day: d, status: st, hours: x.hours || '', note: x.note || '' };
    });
  }

  function buildAvailability(list) {
    var host = $('availList');
    host.innerHTML = '';
    availRows = [];
    list.forEach(function (item) {
      var row = el('div', 'wk-avail-row');
      row.appendChild(el('div', 'wk-avail-day', item.day));

      var sel = document.createElement('select');
      sel.setAttribute('aria-label', item.day + ' status');
      STATUSES.forEach(function (s) {
        var o = document.createElement('option');
        o.value = s.value; o.textContent = s.label;
        sel.appendChild(o);
      });
      sel.value = item.status;
      row.appendChild(sel);

      var hours = document.createElement('input');
      hours.type = 'text'; hours.maxLength = 40; hours.autocomplete = 'off';
      hours.placeholder = 'e.g. 10am – 4pm';
      hours.value = item.hours;
      hours.setAttribute('aria-label', item.day + ' hours');
      row.appendChild(hours);

      var note = document.createElement('input');
      note.type = 'text'; note.maxLength = 60; note.autocomplete = 'off';
      note.placeholder = 'e.g. Busy';
      note.value = item.note;
      note.className = 'wk-avail-note';
      note.setAttribute('aria-label', item.day + ' note');
      row.appendChild(note);

      host.appendChild(row);
      availRows.push({ day: item.day, sel: sel, hours: hours, note: note });
    });
  }

  function readAvailability() {
    return availRows.map(function (r) {
      return {
        day: r.day,
        status: r.sel.value,
        hours: r.hours.value.trim(),
        note: r.note.value.trim()
      };
    });
  }

  // "www.instagram.com/x" -> "https://www.instagram.com/x" so the link works.
  function normUrl(u) {
    u = String(u || '').trim();
    if (/^www\./i.test(u)) return 'https://' + u;
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|co\.nz|nz|net|org|me|link|io|app)(\/|$)/i.test(u)) return 'https://' + u;
    return u;
  }

  /* ---------- form ---------- */
  function fillForm(w) {
    $('f_name').value = w.name || '';
    $('f_slug').value = w.slug || '';
    $('f_title').value = w.title || '';
    $('f_about').value = w.about || '';
    $('f_tags').value = w.tags || '';
    $('f_published').checked = !!w.published;
    $('f_btn_label').value = w.button_label || '';
    $('f_btn_url').value = w.button_url || '';
    $('f_x_label').value = w.extra_label || '';
    $('f_x_url').value = w.extra_url || '';
    buildAvailability(normalizeAvailability(w.availability));
  }

  function readForm() {
    var name = $('f_name').value.trim();
    var tags = $('f_tags').value.split(',').map(function (t) { return t.trim(); })
      .filter(Boolean).join(', ');
    return {
      name: name,
      slug: slugify($('f_slug').value.trim() || name),
      title: $('f_title').value.trim(),
      about: $('f_about').value.replace(/\r\n/g, '\n').trim(),
      tags: tags,
      published: $('f_published').checked,
      button_label: $('f_btn_label').value.trim(),
      button_url: normUrl($('f_btn_url').value),
      extra_label: $('f_x_label').value.trim(),
      extra_url: normUrl($('f_x_url').value),
      availability: readAvailability()
    };
  }

  function validate(d) {
    if (!d.name) { $('f_name').classList.add('wk-invalid'); return 'Please enter her name.'; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.slug)) {
      $('f_slug').classList.add('wk-invalid');
      return 'The web address can only contain letters, numbers and hyphens (for example: missy).';
    }
    if (d.button_label && !d.button_url) { $('f_btn_url').classList.add('wk-invalid'); return 'Add a link for the button, or clear the button text.'; }
    if (d.button_url && !d.button_label) { $('f_btn_label').classList.add('wk-invalid'); return 'Add text for the button, or clear the button link.'; }
    if (d.extra_label && !d.extra_url) { $('f_x_url').classList.add('wk-invalid'); return 'Add an address for the second link, or clear its text.'; }
    if (d.extra_url && !d.extra_label) { $('f_x_label').classList.add('wk-invalid'); return 'Add text for the second link, or clear its address.'; }
    if (!isSafeUrl(d.button_url)) { $('f_btn_url').classList.add('wk-invalid'); return 'The button link must start with https:// or be a page on this site (for example booking.html).'; }
    if (!isSafeUrl(d.extra_url)) { $('f_x_url').classList.add('wk-invalid'); return 'The second link must start with https:// or be a page on this site.'; }
    return '';
  }

  function clearInvalid() {
    document.querySelectorAll('.wk-invalid').forEach(function (n) { n.classList.remove('wk-invalid'); });
  }

  /* ---------- dirty tracking ---------- */
  function takeSnapshot() {
    snapshot = JSON.stringify(readForm());
    updateDirty();
  }

  function isDirty() {
    return JSON.stringify(readForm()) !== snapshot;
  }

  function updateDirty() {
    $('saveNote').textContent = isDirty() ? 'You have unsaved changes.' : '';
  }

  $('editor').addEventListener('input', updateDirty);
  $('editor').addEventListener('change', updateDirty);

  window.addEventListener('beforeunload', function (e) {
    if (!$('editor').hidden && isDirty()) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ---------- setup ---------- */
  function showEditor() {
    $('loadingState').style.display = 'none';
    $('editor').hidden = false;
  }

  function setupNew() {
    $('pageTitle').textContent = 'New worker';
    $('pageSub').textContent = 'Fill in her details and press Save Worker. After saving you can add her photos and videos.';
    document.title = 'New Worker | Good Girls Admin';
    fillForm({ published: true, availability: defaultAvailability() });
    $('mediaLocked').hidden = false;
    $('mediaTools').hidden = true;
    $('deleteBtn').hidden = true;
    showEditor();
    takeSnapshot();
  }

  function loadWorker() {
    $('loadingState').style.display = 'block';
    sb.from('workers').select('*').eq('id', workerId).maybeSingle().then(function (res) {
      if (res.error) { $('loadingState').textContent = 'Could not load: ' + errText(res.error); return; }
      if (!res.data) { $('loadingState').textContent = 'This worker could not be found.'; return; }
      var w = res.data;
      currentName = w.name || '';
      $('pageTitle').textContent = w.name || 'Worker profile';
      document.title = (w.name || 'Worker') + ' | Good Girls Admin';
      $('pageSub').textContent = 'Changes go live when you press Save Worker. Refresh the Meet the Girls page to see them.';
      fillForm(w);
      $('mediaLocked').hidden = true;
      $('mediaTools').hidden = false;
      $('deleteBtn').hidden = false;
      showEditor();
      takeSnapshot();
      if (params.get('created')) {
        show('success', 'Worker created. Now add her photos and videos below.');
      }
      loadMedia();
    });
  }

  /* ---------- save worker ---------- */
  $('saveBtn').addEventListener('click', saveWorker);
  $('cancelBtn').addEventListener('click', function () {
    if (isDirty() && !confirm('You have unsaved changes. Leave without saving?')) return;
    location.href = 'admin-workers.html';
  });
  $('deleteBtn').addEventListener('click', deleteWorker);

  function setButtons(disabled) {
    $('saveBtn').disabled = disabled;
    $('deleteBtn').disabled = disabled;
    $('saveBtn').textContent = disabled && busy ? 'Saving…' : 'Save Worker';
    renderMedia();
  }

  function saveError(e) {
    if (e && e.code === '23505') {
      $('f_slug').classList.add('wk-invalid');
      return 'Another worker already uses that web address. Please choose a different one.';
    }
    return 'Could not save: ' + errText(e);
  }

  function saveWorker() {
    if (busy) return;
    clearInvalid();
    var d = readForm();
    var problem = validate(d);
    if (problem) { show('error', problem); return; }

    var payload = {
      name: d.name,
      slug: d.slug,
      title: d.title,
      about: d.about,
      tags: d.tags,
      availability: d.availability,
      button_label: d.button_label,
      button_url: d.button_url,
      extra_label: d.extra_label,
      extra_url: d.extra_url,
      published: d.published,
      updated_at: new Date().toISOString()
    };

    busy = true; setButtons(true);
    $('saveNote').textContent = '';

    if (isNew) {
      sb.from('workers').select('sort_order').order('sort_order', { ascending: false }).limit(1)
        .then(function (r) {
          if (r.error) throw r.error;
          payload.sort_order = r.data && r.data[0] ? (r.data[0].sort_order || 0) + 1 : 1;
          return sb.from('workers').insert(payload).select('id').single();
        })
        .then(function (res) {
          if (res.error) throw res.error;
          location.replace('admin-worker.html?id=' + encodeURIComponent(res.data.id) + '&created=1');
        })
        .catch(function (e) {
          show('error', saveError(e));
          busy = false; setButtons(false);
        });
      return;
    }

    sb.from('workers').update(payload).eq('id', workerId).select('id')
      .then(function (res) {
        if (res.error) throw res.error;
        if (!res.data || !res.data.length) throw new Error('Permission denied');
        currentName = d.name;
        $('pageTitle').textContent = d.name;
        document.title = d.name + ' | Good Girls Admin';
        $('f_slug').value = d.slug;
        takeSnapshot();
        show('success', 'Saved! Refresh the Meet the Girls page to see the changes.');
      })
      .catch(function (e) { show('error', saveError(e)); })
      .then(function () { busy = false; setButtons(false); });
  }

  /* ---------- delete worker ---------- */
  function deleteWorker() {
    if (busy || isNew) return;
    if (!confirm('Delete ' + (currentName || 'this worker') + ' and all of her photos and videos? This cannot be undone.')) return;
    busy = true; setButtons(true);

    var paths = media.map(function (m) { return m.storage_path; }).filter(Boolean);
    var removeFiles = paths.length
      ? sb.storage.from(BUCKET).remove(paths).catch(function () { })
      : Promise.resolve();

    removeFiles
      .then(function () { return sb.from('workers').delete().eq('id', workerId).select('id'); })
      .then(function (res) {
        if (res.error) throw res.error;
        if (!res.data || !res.data.length) throw new Error('Permission denied');
        location.href = 'admin-workers.html';
      })
      .catch(function (e) {
        show('error', 'Could not delete: ' + errText(e));
        busy = false; setButtons(false);
      });
  }

  /* ---------- gallery: load ---------- */
  function sortMedia(list) {
    return list.slice().sort(function (a, b) { return a.sort_order - b.sort_order; });
  }

  function loadMedia() {
    sb.from('worker_media').select('*').eq('worker_id', workerId).order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error) { show('error', 'Could not load photos and videos: ' + errText(res.error)); return; }
        media = sortMedia(res.data || []);
        renderMedia();
      });
  }

  /* ---------- gallery: render ---------- */
  function renderMedia() {
    var grid = $('mediaGrid');
    grid.innerHTML = '';
    $('mediaEmpty').hidden = media.length > 0;

    media.forEach(function (m, i) {
      var tile = el('div', 'wk-tile');
      var box = el('div', 'wk-tile-media');

      if (m.kind === 'video') {
        var v = document.createElement('video');
        v.muted = true; v.playsInline = true; v.preload = 'metadata';
        v.src = m.url + '#t=0.1';
        box.appendChild(v);
        box.appendChild(el('span', 'wk-tile-badge', 'Video'));
      } else {
        var img = document.createElement('img');
        img.alt = ''; img.loading = 'lazy'; img.src = m.url;
        box.appendChild(img);
        box.appendChild(el('span', 'wk-tile-badge', 'Photo'));
      }
      box.appendChild(el('span', 'wk-tile-num', String(i + 1)));
      tile.appendChild(box);

      var acts = el('div', 'wk-tile-actions');
      var left = el('button', null, '←');
      left.type = 'button'; left.title = 'Move earlier'; left.setAttribute('aria-label', 'Move earlier');
      left.disabled = busy || i === 0;
      left.addEventListener('click', function () { moveMedia(i, -1); });

      var del = el('button', 'wk-del', 'Delete');
      del.type = 'button'; del.setAttribute('aria-label', 'Delete this ' + m.kind);
      del.disabled = busy;
      del.addEventListener('click', function () { deleteMedia(m); });

      var right = el('button', null, '→');
      right.type = 'button'; right.title = 'Move later'; right.setAttribute('aria-label', 'Move later');
      right.disabled = busy || i === media.length - 1;
      right.addEventListener('click', function () { moveMedia(i, 1); });

      acts.appendChild(left); acts.appendChild(del); acts.appendChild(right);
      tile.appendChild(acts);
      grid.appendChild(tile);
    });
  }

  // Write new sort numbers (1, 2, 3…) only for rows that changed.
  function saveMediaOrder(list) {
    var writes = [];
    list.forEach(function (item, idx) {
      var n = idx + 1;
      if (item.sort_order === n) return;
      writes.push(
        sb.from('worker_media').update({ sort_order: n }).eq('id', item.id).select('id')
          .then(function (res) {
            if (res.error) throw res.error;
            if (!res.data || !res.data.length) throw new Error('Permission denied');
            item.sort_order = n;
          })
      );
    });
    return Promise.all(writes);
  }

  function moveMedia(i, dir) {
    var j = i + dir;
    if (busy || j < 0 || j >= media.length) return;
    var list = media.slice();
    var t = list[i]; list[i] = list[j]; list[j] = t;
    busy = true; renderMedia();
    saveMediaOrder(list)
      .then(function () { media = sortMedia(list); })
      .catch(function (e) { show('error', 'Could not change the order: ' + errText(e)); loadMedia(); })
      .then(function () { busy = false; renderMedia(); });
  }

  function deleteMedia(m) {
    if (busy) return;
    var what = m.kind === 'video' ? 'video' : 'photo';
    if (!confirm('Remove this ' + what + ' from the gallery?')) return;
    busy = true; renderMedia();

    sb.from('worker_media').delete().eq('id', m.id).select('id')
      .then(function (res) {
        if (res.error) throw res.error;
        if (!res.data || !res.data.length) throw new Error('Permission denied');
        media = media.filter(function (x) { return x.id !== m.id; });
        if (m.storage_path) sb.storage.from(BUCKET).remove([m.storage_path]).catch(function () { });
        // renumber the rest so the order stays tidy
        return saveMediaOrder(media);
      })
      .then(function () { show('success', 'Removed from the gallery.'); })
      .catch(function (e) { show('error', 'Could not remove: ' + errText(e)); loadMedia(); })
      .then(function () { busy = false; renderMedia(); });
  }

  /* ---------- gallery: upload ---------- */
  $('chooseBtn').addEventListener('click', function () {
    if (busy) return;
    $('f_files').click();
  });

  $('f_files').addEventListener('change', function () {
    var files = Array.prototype.slice.call(this.files || []);
    this.value = '';
    if (!files.length) return;
    if (busy) { show('error', 'Please wait for the current change to finish, then try again.'); return; }
    uploadFiles(files);
  });

  function uploadFiles(files) {
    var status = $('uploadStatus');
    status.innerHTML = '';
    busy = true; renderMedia();

    var nextSort = media.reduce(function (mx, m) { return Math.max(mx, m.sort_order || 0); }, 0) + 1;
    var ok = 0, failed = 0;

    files.reduce(function (chain, file, idx) {
      return chain.then(function () {
        var line = el('div', null, 'Adding ' + (idx + 1) + ' of ' + files.length + ': ' + file.name + '…');
        status.appendChild(line);
        return uploadOne(file, nextSort + idx)
          .then(function (row) {
            media.push(row);
            ok++;
            line.className = 'ok';
            line.textContent = '✓ ' + file.name + ' added';
            renderMedia();
          })
          .catch(function (e) {
            failed++;
            line.className = 'bad';
            line.textContent = '✕ ' + file.name + ' — ' + errText(e);
          });
      });
    }, Promise.resolve()).then(function () {
      busy = false;
      media = sortMedia(media);
      renderMedia();
      var summary = el('div', null, ok + ' added' + (failed ? ', ' + failed + ' could not be added (see above).' : '.'));
      summary.className = failed ? 'bad' : 'ok';
      status.appendChild(summary);
    });
  }

  function uploadOne(file, sort) {
    var name = (file.name || '').toLowerCase();
    var isVideo = /^video\//.test(file.type) || /\.(mp4|mov|webm)$/.test(name);
    var isImage = /^image\//.test(file.type) || /\.(jpe?g|png|webp|gif)$/.test(name);

    if (isVideo) {
      if (file.size > MAX_VIDEO_BYTES) {
        return Promise.reject(new Error('this video is over 50 MB. Please shorten or compress it, then try again.'));
      }
      var vType = file.type;
      var vExt = 'mp4';
      if (vType === 'video/webm' || /\.webm$/.test(name)) { vType = 'video/webm'; vExt = 'webm'; }
      else if (vType === 'video/quicktime' || /\.mov$/.test(name)) { vType = 'video/quicktime'; vExt = 'mov'; }
      else { vType = 'video/mp4'; vExt = 'mp4'; }
      return uploadBlob(file, 'video', vExt, vType, sort);
    }

    if (!isImage) {
      return Promise.reject(new Error('this is not a photo or video. Use JPG, PNG, WebP, MP4, MOV or WebM.'));
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return Promise.reject(new Error('this photo is over 25 MB. Please choose a smaller one.'));
    }
    if (/image\/gif/.test(file.type) || /\.gif$/.test(name)) {
      return uploadBlob(file, 'image', 'gif', 'image/gif', sort);
    }
    return resizeToJpeg(file).then(function (blob) {
      return uploadBlob(blob, 'image', 'jpg', 'image/jpeg', sort);
    });
  }

  function resizeToJpeg(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var im = new Image();
      im.onload = function () {
        var w = im.naturalWidth, h = im.naturalHeight;
        if (!w || !h) { URL.revokeObjectURL(url); reject(new Error('this photo could not be read.')); return; }
        if (w > MAX_IMG_WIDTH) { h = Math.round(h * MAX_IMG_WIDTH / w); w = MAX_IMG_WIDTH; }
        var cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        var ctx = cv.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(im, 0, 0, w, h);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) {
          if (b) resolve(b); else reject(new Error('this photo could not be processed.'));
        }, 'image/jpeg', 0.86);
      };
      im.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('this photo could not be read. Please try a JPG or PNG.'));
      };
      im.src = url;
    });
  }

  function uploadBlob(blob, kind, ext, contentType, sort) {
    var path = workerId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    return sb.storage.from(BUCKET)
      .upload(path, blob, { contentType: contentType, cacheControl: '31536000', upsert: false })
      .then(function (res) {
        if (res.error) throw res.error;
        var url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        var row = { worker_id: workerId, kind: kind, url: url, storage_path: path, sort_order: sort };
        return sb.from('worker_media').insert(row).select('*').single().then(function (r2) {
          if (r2.error) {
            // nothing should be left behind if the gallery row could not be saved
            sb.storage.from(BUCKET).remove([path]).catch(function () { });
            throw r2.error;
          }
          return r2.data;
        });
      });
  }
})();
