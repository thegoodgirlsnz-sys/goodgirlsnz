/* ==========================================================
   GOOD GIRLS — js/admin-blog-editor.js
   Blog article editor (admin). Rich text, pictures, videos,
   cover image, drafts, preview, publish, delete.
   Requires: supabase-config.js, blog-common.js,
             tables blog_posts + storage bucket blog-media
   ========================================================== */
(function () {
  'use strict';

  var sb = window.supabaseClient;
  var G = window.GGBlog;
  var MAX_BYTES = 50 * 1024 * 1024;
  var BUCKET = 'blog-media';

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    msg: $('message'), loading: $('loadingState'), wrap: $('editorWrap'),
    title: $('titleInput'), slug: $('slugInput'), slugHint: $('slugHint'), excerpt: $('excerptInput'),
    pageTitle: $('pageTitle'), pill: $('statusPill'), dirty: $('dirtyTag'), saved: $('savedInfo'),
    coverPreview: $('coverPreview'), coverBtn: $('coverBtn'), coverRemove: $('coverRemove'), coverFile: $('coverFile'),
    toolbar: $('toolbar'), blockSelect: $('blockSelect'), sizeSelect: $('sizeSelect'), colorInput: $('colorInput'),
    editor: $('editor'), mediaBar: $('mediaBar'), uploadStatus: $('uploadStatus'),
    imgFile: $('imgFile'), vidFile: $('vidFile'),
    primary: $('primaryBtn'), secondary: $('secondaryBtn'), preview: $('previewBtn'), previewModal: $('previewModal'),
    previewClose: $('previewClose'), viewLink: $('viewLink'), del: $('deleteBtn'), slugTouched: false
  };

  var state = {
    id: null, status: 'draft', published_at: null,
    cover_url: '', cover_path: '', original_cover_path: '',
    dirty: false
  };
  var savedRange = null;
  var selectedFig = null;

  // ---------- helpers ----------
  function msg(type, text) {
    el.msg.className = 'message ' + type + ' show';
    el.msg.textContent = text;
    if (type === 'success') setTimeout(function () { el.msg.className = 'message'; }, 3500);
  }
  function setUploadStatus(text) { el.uploadStatus.textContent = text || ''; }

  function markDirty() {
    state.dirty = true;
    el.dirty.textContent = 'Unsaved changes';
  }
  function clearDirty() {
    state.dirty = false;
    el.dirty.textContent = '';
  }

  function editorHasContent() {
    return el.editor.textContent.trim().length > 0 || el.editor.querySelector('figure, img, video, iframe') !== null;
  }

  function renderStatus() {
    var pub = state.status === 'published';
    el.pill.className = 'pill ' + (pub ? 'pub' : 'draft');
    el.pill.textContent = pub ? 'Published' : 'Draft';
    el.pageTitle.innerHTML = state.id ? 'Edit <em>article</em>' : 'New <em>article</em>';
    el.primary.textContent = pub ? 'Save changes' : 'Save draft';
    el.secondary.textContent = pub ? 'Move to drafts' : 'Publish now';
    el.viewLink.hidden = !pub;
    if (pub) el.viewLink.href = 'blog-post.html?slug=' + encodeURIComponent(el.slug.value.trim());
    el.del.hidden = !state.id;
  }

  function updateSlugHint() {
    var s = el.slug.value.trim();
    el.slugHint.textContent = s ? 'Address: blog-post.html?slug=' + s : 'Created from the title if left empty';
  }

  function setCover(url, path) {
    state.cover_url = url || '';
    state.cover_path = path || '';
    if (state.cover_url) {
      el.coverPreview.outerHTML = '<img id="coverPreview" src="' + G.esc(state.cover_url) + '" alt="" />';
      el.coverPreview = $('coverPreview');
    } else {
      el.coverPreview.outerHTML = '<div id="coverPreview" class="cover-empty">No cover</div>';
      el.coverPreview = $('coverPreview');
    }
  }

  // ---------- upload ----------
  function uploadToBucket(file, folder) {
    if (file.size > MAX_BYTES) return Promise.reject(new Error('This file is larger than 50 MB.'));
    var ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    var path = folder + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    return sb.storage.from(BUCKET)
      .upload(path, file, { contentType: file.type || undefined, cacheControl: '31536000', upsert: false })
      .then(function (res) {
        if (res.error) throw res.error;
        return { url: sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, path: path };
      });
  }

  // ---------- selection handling inside the editor ----------
  function saveRange() {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    var r = sel.getRangeAt(0);
    if (el.editor.contains(r.commonAncestorContainer)) savedRange = r.cloneRange();
  }
  function restoreRange() {
    el.editor.focus();
    if (!savedRange) return;
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }

  // Wrap the selected text in a <span> with one style (font size or colour)
  function applySpanStyle(prop, value) {
    restoreRange();
    var sel = window.getSelection();
    if (!sel.rangeCount) return;
    var range = sel.getRangeAt(0);
    if (range.collapsed) { msg('error', 'Select the words first, then choose the size or colour.'); return; }
    if (!el.editor.contains(range.commonAncestorContainer)) return;

    var span = document.createElement('span');
    span.style[prop] = value;
    try {
      range.surroundContents(span);
    } catch (e) {
      var frag = range.extractContents();
      span.appendChild(frag);
      range.insertNode(span);
    }
    var r = document.createRange();
    r.selectNodeContents(span);
    sel.removeAllRanges();
    sel.addRange(r);
    saveRange();
    markDirty();
  }

  function runCommand(cmd) {
    restoreRange();
    var map = {
      bold: function () { document.execCommand('bold'); },
      italic: function () { document.execCommand('italic'); },
      left: function () { document.execCommand('justifyLeft'); },
      center: function () { document.execCommand('justifyCenter'); },
      right: function () { document.execCommand('justifyRight'); },
      ul: function () { document.execCommand('insertUnorderedList'); },
      ol: function () { document.execCommand('insertOrderedList'); },
      clear: function () { document.execCommand('removeFormat'); },
      link: function () {
        var url = prompt('Paste the web address (starts with https://)');
        if (!url) return;
        url = url.trim();
        if (!/^https?:\/\//i.test(url) && !/^mailto:|^tel:/i.test(url)) url = 'https://' + url;
        document.execCommand('createLink', false, url);
      },
      image: function () { el.imgFile.click(); },
      video: function () { el.vidFile.click(); },
      embed: function () {
        var link = prompt('Paste a YouTube or Vimeo link');
        if (!link) return;
        var embed = G.videoEmbedUrl(link);
        if (!embed) { msg('error', 'That link is not a YouTube or Vimeo link.'); return; }
        insertMedia({ kind: 'embed', url: embed });
      }
    };
    if (map[cmd]) map[cmd]();
    saveRange();
    markDirty();
  }

  // ---------- media insertion & controls ----------
  function insertMedia(item) {
    var fig = document.createElement('figure');
    fig.className = 'blog-media bm-size-m bm-align-center' + (item.kind === 'image' ? '' : ' bm-video');
    fig.contentEditable = 'false';

    if (item.kind === 'image') {
      var img = document.createElement('img');
      img.src = item.url;
      img.alt = '';
      img.loading = 'lazy';
      fig.appendChild(img);
    } else {
      var frame = document.createElement('div');
      frame.className = 'bm-frame';
      if (item.kind === 'embed') {
        var ifr = document.createElement('iframe');
        ifr.src = item.url;
        ifr.setAttribute('allowfullscreen', '');
        ifr.setAttribute('loading', 'lazy');
        ifr.setAttribute('allow', 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
        frame.appendChild(ifr);
      } else {
        var v = document.createElement('video');
        v.src = item.url;
        v.controls = true;
        v.setAttribute('playsinline', '');
        frame.appendChild(v);
      }
      fig.appendChild(frame);
    }

    // Place the media after the paragraph the cursor is in (keeps it out of text lines)
    var block = null;
    if (savedRange && el.editor.contains(savedRange.startContainer)) {
      block = savedRange.startContainer.nodeType === 3 ? savedRange.startContainer.parentNode : savedRange.startContainer;
      while (block && block.parentNode !== el.editor && block !== el.editor) block = block.parentNode;
    }
    if (!block || block === el.editor) el.editor.appendChild(fig);
    else block.parentNode.insertBefore(fig, block.nextSibling);

    var after = document.createElement('p');
    after.appendChild(document.createElement('br'));
    fig.parentNode.insertBefore(after, fig.nextSibling);

    var r = document.createRange();
    r.setStart(after, 0);
    r.collapse(true);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    savedRange = r.cloneRange();
    selectFigure(fig);
    markDirty();
  }

  function selectFigure(fig) {
    if (selectedFig) selectedFig.classList.remove('is-selected');
    selectedFig = fig || null;
    if (!fig) { el.mediaBar.hidden = true; return; }
    fig.classList.add('is-selected');
    el.mediaBar.hidden = false;
    syncMediaButtons();
  }

  function syncMediaButtons() {
    if (!selectedFig) return;
    el.mediaBar.querySelectorAll('[data-size]').forEach(function (b) {
      var cls = 'bm-size-' + b.getAttribute('data-size');
      b.classList.toggle('on', selectedFig.classList.contains(cls));
    });
    el.mediaBar.querySelectorAll('[data-align]').forEach(function (b) {
      var cls = 'bm-align-' + b.getAttribute('data-align');
      b.classList.toggle('on', selectedFig.classList.contains(cls));
    });
  }

  function setMediaClass(prefix, value) {
    if (!selectedFig) return;
    Array.prototype.slice.call(selectedFig.classList).forEach(function (c) {
      if (c.indexOf(prefix) === 0) selectedFig.classList.remove(c);
    });
    selectedFig.classList.add(prefix + value);
    syncMediaButtons();
    markDirty();
  }

  // ---------- preview ----------
  function openPreview() {
    $('pvTitle').textContent = el.title.value.trim() || 'Untitled';
    $('pvMeta').textContent = state.published_at ? G.formatDate(state.published_at) : G.formatDate(new Date().toISOString());
    if (state.cover_url) { $('pvCover').src = state.cover_url; $('pvCoverWrap').hidden = false; }
    else { $('pvCoverWrap').hidden = true; }
    $('pvBody').innerHTML = G.sanitize(el.editor.innerHTML);
    el.previewModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closePreview() {
    el.previewModal.hidden = true;
    document.body.style.overflow = '';
  }

  // ---------- save / publish ----------
  function buildPayload(newStatus) {
    var title = el.title.value.trim() || 'Untitled';
    var slugRaw = el.slug.value.trim() || title;
    var publishedAt = state.published_at;
    if (newStatus === 'published' && !publishedAt) publishedAt = new Date().toISOString();
    return {
      title: title,
      slug: G.slugify(slugRaw),
      excerpt: el.excerpt.value.trim(),
      cover_url: state.cover_url,
      cover_path: state.cover_path,
      body_html: G.sanitize(el.editor.innerHTML),
      status: newStatus,
      published_at: publishedAt,
      updated_at: new Date().toISOString()
    };
  }

  function writePost(payload, retriedSlug) {
    var req = state.id
      ? sb.from('blog_posts').update(payload).eq('id', state.id).select('id').single()
      : sb.from('blog_posts').insert(payload).select('id').single();
    return req.then(function (res) {
      if (res.error && res.error.code === '23505' && !retriedSlug) {
        // slug already used by another article: make it unique and retry once
        payload.slug = payload.slug + '-' + Math.random().toString(36).slice(2, 6);
        return writePost(payload, true);
      }
      return res;
    });
  }

  function save(newStatus) {
    if (newStatus === 'published' && !el.title.value.trim()) { msg('error', 'Please add a title before publishing.'); el.title.focus(); return; }
    if (newStatus === 'published' && !editorHasContent()) { msg('error', 'Please write something in the article before publishing.'); return; }

    var payload = buildPayload(newStatus);
    var oldCover = state.original_cover_path;
    el.primary.disabled = el.secondary.disabled = true;
    el.saved.textContent = 'Saving…';

    writePost(payload).then(function (res) {
      el.primary.disabled = el.secondary.disabled = false;
      if (res.error) { el.saved.textContent = ''; msg('error', 'Could not save: ' + res.error.message); return; }

      if (!state.id) {
        state.id = res.data.id;
        history.replaceState(null, '', 'admin-blog-editor.html?id=' + state.id);
      }
      // remove an old cover image if it was replaced or removed
      if (oldCover && oldCover !== payload.cover_path) sb.storage.from(BUCKET).remove([oldCover]).catch(function () {});
      state.original_cover_path = payload.cover_path;
      state.status = newStatus;
      state.published_at = payload.published_at;
      el.slug.value = payload.slug;
      updateSlugHint();
      renderStatus();
      clearDirty();
      el.saved.textContent = 'Saved ' + new Date().toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' });
      msg('success', newStatus === 'published' ? 'Article is published and live on the Blog page.' : 'Draft saved.');
    });
  }

  function deleteArticle() {
    if (!state.id) { location.href = 'admin-blog.html'; return; }
    if (!confirm('Delete this article? This cannot be undone.')) return;
    el.del.disabled = true;
    sb.from('blog_posts').delete().eq('id', state.id).then(function (res) {
      if (res.error) { el.del.disabled = false; msg('error', 'Could not delete: ' + res.error.message); return; }
      if (state.cover_path) sb.storage.from(BUCKET).remove([state.cover_path]).catch(function () {});
      clearDirty();
      location.href = 'admin-blog.html';
    });
  }

  // pictures and videos stay as blocks: the caret goes around them, not inside them
  function lockFigures() {
    el.editor.querySelectorAll('figure.blog-media').forEach(function (f) { f.contentEditable = 'false'; });
  }

  // ---------- load existing ----------
  function fillForm(p) {
    state.id = p.id;
    state.status = p.status;
    state.published_at = p.published_at;
    state.cover_path = p.cover_path || '';
    state.original_cover_path = p.cover_path || '';
    el.title.value = p.title || '';
    el.slug.value = p.slug || '';
    el.slugTouched = true;
    el.excerpt.value = p.excerpt || '';
    el.editor.innerHTML = G.sanitize(p.body_html || '');
    lockFigures();
    setCover(p.cover_url || '', p.cover_path || '');
    updateSlugHint();
    renderStatus();
    clearDirty();
  }

  // ---------- wire up ----------
  function wire() {
    el.editor.setAttribute('contenteditable', 'true');
    document.execCommand('defaultParagraphSeparator', false, 'p');

    // keep the text selection when clicking toolbar buttons (but not dropdowns / colour)
    el.toolbar.addEventListener('mousedown', function (e) {
      if (!e.target.closest('select, input, label')) e.preventDefault();
    });
    el.toolbar.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-cmd]');
      if (b) runCommand(b.getAttribute('data-cmd'));
    });
    el.blockSelect.addEventListener('change', function () {
      restoreRange();
      document.execCommand('formatBlock', false, '<' + el.blockSelect.value + '>');
      el.blockSelect.value = 'p';
      saveRange(); markDirty();
    });
    el.sizeSelect.addEventListener('change', function () {
      if (el.sizeSelect.value) applySpanStyle('fontSize', el.sizeSelect.value);
      el.sizeSelect.value = '';
    });
    el.colorInput.addEventListener('change', function () { applySpanStyle('color', el.colorInput.value); });

    // remember where the cursor is
    ['keyup', 'mouseup', 'touchend'].forEach(function (ev) { el.editor.addEventListener(ev, saveRange); });
    document.addEventListener('selectionchange', saveRange);
    el.editor.addEventListener('input', markDirty);
    el.editor.addEventListener('paste', function () { setTimeout(lockFigures, 0); });

    // select a picture/video to resize, align or remove it
    el.editor.addEventListener('click', function (e) {
      var fig = e.target.closest('figure.blog-media');
      selectFigure(fig);
    });
    el.mediaBar.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-size')) setMediaClass('bm-size-', b.getAttribute('data-size'));
      else if (b.hasAttribute('data-align')) setMediaClass('bm-align-', b.getAttribute('data-align'));
      else if (b.hasAttribute('data-remove') && selectedFig) {
        if (confirm('Remove this picture or video from the article?')) {
          selectedFig.parentNode.removeChild(selectedFig);
          selectFigure(null);
          markDirty();
        }
      }
    });

    // uploads
    el.imgFile.addEventListener('change', function () {
      var f = el.imgFile.files[0]; el.imgFile.value = '';
      if (!f) return;
      if (!/^image\//.test(f.type)) { msg('error', 'Please choose a picture file (JPG, PNG, WEBP or GIF).'); return; }
      setUploadStatus('Uploading picture…');
      uploadToBucket(f, 'images').then(function (r) {
        setUploadStatus('');
        insertMedia({ kind: 'image', url: r.url });
        msg('success', 'Picture added. Select it to change its size or position.');
      }).catch(function (err) { setUploadStatus(''); msg('error', 'Upload failed: ' + err.message); });
    });
    el.vidFile.addEventListener('change', function () {
      var f = el.vidFile.files[0]; el.vidFile.value = '';
      if (!f) return;
      if (!/^video\//.test(f.type)) { msg('error', 'Please choose a video file (MP4, WEBM or MOV).'); return; }
      setUploadStatus('Uploading video… this can take a little while for large files.');
      uploadToBucket(f, 'videos').then(function (r) {
        setUploadStatus('');
        insertMedia({ kind: 'video', url: r.url });
        msg('success', 'Video added. Select it to change its size or position.');
      }).catch(function (err) { setUploadStatus(''); msg('error', 'Upload failed: ' + err.message); });
    });
    el.coverBtn.addEventListener('click', function () { el.coverFile.click(); });
    el.coverFile.addEventListener('change', function () {
      var f = el.coverFile.files[0]; el.coverFile.value = '';
      if (!f) return;
      if (!/^image\//.test(f.type)) { msg('error', 'Please choose a picture file for the cover.'); return; }
      setUploadStatus('Uploading cover…');
      uploadToBucket(f, 'covers').then(function (r) {
        setUploadStatus('');
        setCover(r.url, r.path);
        markDirty();
      }).catch(function (err) { setUploadStatus(''); msg('error', 'Upload failed: ' + err.message); });
    });
    el.coverRemove.addEventListener('click', function () { setCover('', ''); markDirty(); });

    // title / slug / excerpt
    el.title.addEventListener('input', function () {
      if (!el.slugTouched) el.slug.value = G.slugify(el.title.value);
      updateSlugHint(); markDirty();
    });
    el.slug.addEventListener('input', function () { el.slugTouched = true; updateSlugHint(); markDirty(); });
    el.excerpt.addEventListener('input', markDirty);

    // buttons
    el.primary.addEventListener('click', function () { save(state.status === 'published' ? 'published' : 'draft'); });
    el.secondary.addEventListener('click', function () { save(state.status === 'published' ? 'draft' : 'published'); });
    el.preview.addEventListener('click', openPreview);
    el.previewClose.addEventListener('click', closePreview);
    el.previewModal.addEventListener('click', function (e) { if (e.target === el.previewModal) closePreview(); });
    el.del.addEventListener('click', deleteArticle);

    // Ctrl/Cmd+S to save as draft / keep published
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save(state.status === 'published' ? 'published' : 'draft');
      }
    });

    window.addEventListener('beforeunload', function (e) {
      if (state.dirty) { e.preventDefault(); e.returnValue = ''; }
    });

    $('logoutBtn').addEventListener('click', function () {
      var go = function () { location.href = 'admin-login.html'; };
      sb.auth.signOut().then(go, go);
    });
  }

  // ---------- start ----------
  if (!sb) { msg('error', 'Supabase is not configured. Please check supabase-config.js.'); el.loading.hidden = true; return; }

  sb.auth.getSession().then(function (r) {
    var s = r && r.data ? r.data.session : null;
    if (!s) { location.href = 'admin-login.html'; return; }
    var u = $('userEmail'); if (u && s.user) u.textContent = s.user.email || '';
    wire();

    var id = new URLSearchParams(location.search).get('id');
    if (!id) {
      el.loading.hidden = true;
      el.wrap.hidden = false;
      renderStatus();
      return;
    }
    sb.from('blog_posts').select('*').eq('id', id).maybeSingle().then(function (res) {
      el.loading.hidden = true;
      if (res.error || !res.data) { msg('error', 'Could not find this article.'); el.wrap.hidden = false; return; }
      fillForm(res.data);
      el.wrap.hidden = false;
    });
  });
})();
