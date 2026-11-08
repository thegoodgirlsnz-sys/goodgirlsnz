/* ============================================================
   GOOD GIRLS — js/admin-editor.js
   One editor for every page: loads rows of table `site_content`
   for ?page=<name>, shows a form, saves changed rows, uploads images.
   ============================================================ */
(function () {
  'use strict';

  var PAGES = {
    home:     { title: 'Home Page',               url: 'index.html' },
    about:    { title: 'About',                   url: 'about.html' },
    services: { title: 'Services & Prices',       url: 'services.html' },
    meet:     { title: 'Meet the Girls',          url: 'meet-the-girls.html' },
    faqs:     { title: 'FAQs & Etiquette',        url: 'faqs.html' },
    contact:  { title: 'Contact Page',            url: 'contact.html' },
    global:   { title: 'Phone, Email & Footer',   url: 'index.html' }
  };
  var BUCKET = 'site-images';
  var MAX_WIDTH = 1600;

  var sb = window.supabaseClient;
  var page = new URLSearchParams(location.search).get('page');
  var $ = function (id) { return document.getElementById(id); };
  var msgEl = $('message');

  var rows = [];            // [{key,label,type,value,section,sort_order}]
  var original = {};        // key -> saved value
  var values = {};          // key -> current value
  var fieldEls = {};        // key -> wrapper element
  var previews = {};        // key -> <img>

  function show(type, text) {
    msgEl.className = 'message ' + type + ' show';
    msgEl.textContent = text;
    if (type === 'success') setTimeout(function () { msgEl.className = 'message'; }, 4500);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (!sb) { show('error', 'Supabase is not configured. Please check supabase-config.js.'); return; }
  if (!PAGES[page]) { location.href = 'admin-dashboard.html'; return; }

  $('pageTitle').textContent = PAGES[page].title;
  document.title = PAGES[page].title + ' | Admin | Good Girls';
  $('viewLink').href = PAGES[page].url;

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

  /* ---------- load ---------- */
  function load() {
    $('loadingState').style.display = 'block';
    $('editor').style.display = 'none';
    sb.from('site_content')
      .select('key,label,type,value,section,sort_order')
      .eq('page', page)
      .order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error) { $('loadingState').textContent = 'Could not load: ' + res.error.message; return; }
        rows = res.data || [];
        if (!rows.length) { $('loadingState').textContent = 'No editable fields found for this page.'; return; }
        original = {}; values = {};
        rows.forEach(function (r) { original[r.key] = r.value || ''; values[r.key] = r.value || ''; });
        render();
        $('loadingState').style.display = 'none';
        $('editor').style.display = 'block';
        updateDirty();
      });
  }

  /* ---------- render ---------- */
  function render() {
    var host = $('sections');
    host.innerHTML = '';
    fieldEls = {}; previews = {};

    var order = [], groups = {};
    rows.forEach(function (r) {
      var s = r.section || 'Page';
      if (!groups[s]) { groups[s] = []; order.push(s); }
      groups[s].push(r);
    });

    order.forEach(function (name, i) {
      var det = document.createElement('details');
      det.className = 'section';
      if (i === 0) det.open = true;
      var sum = document.createElement('summary');
      var t = document.createElement('span'); t.textContent = name;
      var c = document.createElement('small'); c.textContent = groups[name].length + ' fields';
      sum.appendChild(t); sum.appendChild(c);
      det.appendChild(sum);
      var body = document.createElement('div'); body.className = 'section-body';
      groups[name].forEach(function (r) { body.appendChild(buildField(r)); });
      det.appendChild(body);
      host.appendChild(det);
    });
  }

  function buildField(r) {
    var wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.dataset.search = ((r.label || '') + ' ' + (r.value || '')).toLowerCase();
    var lab = document.createElement('label');
    lab.textContent = (r.label || r.key).replace(/^[^:]+:\s*/, function (m) { return m; });
    wrap.appendChild(lab);
    fieldEls[r.key] = wrap;

    if (r.type === 'image') {
      var row = document.createElement('div'); row.className = 'img-row';
      var img = document.createElement('img'); img.alt = ''; img.src = values[r.key];
      previews[r.key] = img;
      var file = document.createElement('input'); file.type = 'file'; file.accept = 'image/jpeg,image/png,image/webp';
      var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn-outline'; btn.textContent = 'Change image';
      var st = document.createElement('span'); st.className = 'img-status';
      btn.addEventListener('click', function () { file.click(); });
      file.addEventListener('change', function () {
        if (file.files && file.files[0]) uploadImage(r, file.files[0], img, st);
        file.value = '';
      });
      row.appendChild(img); row.appendChild(btn); row.appendChild(file); row.appendChild(st);
      wrap.appendChild(row);
      var h = document.createElement('div'); h.className = 'hint';
      h.textContent = 'JPG, PNG or WebP. Large photos are resized automatically. Press Save Changes after uploading.';
      wrap.appendChild(h);
      return wrap;
    }

    var multi = r.type === 'longtext' || (values[r.key] || '').indexOf('\n') !== -1;
    var input = document.createElement(multi ? 'textarea' : 'input');
    if (!multi) input.type = 'text'; else input.rows = r.type === 'longtext' ? 4 : 2;
    input.value = values[r.key];
    input.addEventListener('input', function () {
      values[r.key] = input.value;
      updateDirty();
    });
    wrap.appendChild(input);
    if (r.type === 'price') {
      var hp = document.createElement('div'); hp.className = 'hint';
      hp.textContent = 'Keep the same format, for example: $140 · $190 · $290 · $380';
      wrap.appendChild(hp);
    }
    return wrap;
  }

  /* ---------- dirty tracking ---------- */
  function changedKeys() {
    return rows.filter(function (r) { return values[r.key] !== original[r.key]; }).map(function (r) { return r.key; });
  }
  function updateDirty() {
    var ch = changedKeys();
    rows.forEach(function (r) {
      var w = fieldEls[r.key]; if (!w) return;
      w.classList.toggle('dirty', values[r.key] !== original[r.key]);
    });
    $('dirtyCount').textContent = ch.length ? ch.length + ' unsaved change' + (ch.length > 1 ? 's' : '') : '';
  }
  window.addEventListener('beforeunload', function (e) {
    if (changedKeys().length) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ---------- search ---------- */
  $('search').addEventListener('input', function () {
    var q = this.value.trim().toLowerCase();
    document.querySelectorAll('details.section').forEach(function (d) {
      var any = false;
      d.querySelectorAll('.field').forEach(function (f) {
        var hit = !q || f.dataset.search.indexOf(q) !== -1;
        f.style.display = hit ? '' : 'none';
        if (hit) any = true;
      });
      d.style.display = any ? '' : 'none';
      if (q && any) d.open = true;
    });
  });

  /* ---------- image upload ---------- */
  function resizeToJpeg(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var im = new Image();
      im.onload = function () {
        var w = im.naturalWidth, h = im.naturalHeight;
        if (w > MAX_WIDTH) { h = Math.round(h * MAX_WIDTH / w); w = MAX_WIDTH; }
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        var ctx = cv.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
        ctx.drawImage(im, 0, 0, w, h);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) { b ? resolve(b) : reject(new Error('Could not process image')); }, 'image/jpeg', 0.86);
      };
      im.onerror = function () { URL.revokeObjectURL(url); reject(new Error('This file is not a valid image')); };
      im.src = url;
    });
  }

  function uploadImage(r, file, img, st) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { st.textContent = 'Please choose a JPG, PNG or WebP image.'; return; }
    st.textContent = 'Uploading…';
    resizeToJpeg(file).then(function (blob) {
      var path = page + '/' + r.key.replace(/[^a-z0-9.]/gi, '_') + '-' + Date.now() + '.jpg';
      return sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false }).then(function (res) {
        if (res.error) throw res.error;
        var pub = sb.storage.from(BUCKET).getPublicUrl(path);
        return pub.data.publicUrl;
      });
    }).then(function (url) {
      values[r.key] = url; img.src = url;
      st.textContent = 'Uploaded. Press Save Changes to publish.';
      updateDirty();
    }).catch(function (err) {
      st.textContent = 'Upload failed: ' + (err && err.message ? err.message : err);
    });
  }

  /* ---------- save ---------- */
  var saving = false;
  function save() {
    if (saving) return;
    var keys = changedKeys();
    if (!keys.length) { show('success', 'No changes to save.'); return; }
    saving = true;
    $('saveBtn').disabled = true; $('saveBtn').textContent = 'Saving…';

    Promise.all(keys.map(function (k) {
      var v = values[k].trim();
      return sb.from('site_content').update({ value: v }).eq('key', k).select('key').then(function (res) {
        if (res.error) return { key: k, ok: false, err: res.error.message };
        if (!res.data || !res.data.length) return { key: k, ok: false, err: 'not saved (permission)' };
        return { key: k, ok: true, value: v };
      });
    })).then(function (results) {
      var bad = [];
      results.forEach(function (x) {
        if (x.ok) { original[x.key] = x.value; values[x.key] = x.value; var w = fieldEls[x.key]; if (w) { var inp = w.querySelector('input[type=text],textarea'); if (inp) inp.value = x.value; } }
        else bad.push(x.key + ' (' + x.err + ')');
      });
      updateDirty();
      if (bad.length) show('error', 'Some changes could not be saved: ' + bad.join(', '));
      else show('success', 'Saved! Your website is updated. Refresh the public page to see it.');
    }).catch(function (e) {
      show('error', 'Save failed: ' + (e && e.message ? e.message : e));
    }).then(function () {
      saving = false; $('saveBtn').disabled = false; $('saveBtn').textContent = 'Save Changes';
    });
  }
  $('saveBtn').addEventListener('click', save);

  $('resetBtn').addEventListener('click', function () {
    if (changedKeys().length && !confirm('Discard all unsaved changes on this page?')) return;
    rows.forEach(function (r) { values[r.key] = original[r.key]; });
    render(); updateDirty();
  });
})();
