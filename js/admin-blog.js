/* ==========================================================
   GOOD GIRLS — js/admin-blog.js
   Blog list in the admin: publish/unpublish, edit, delete.
   Requires: supabase-config.js, blog-common.js, table blog_posts
   ========================================================== */
(function () {
  'use strict';

  var sb = window.supabaseClient;
  var G = window.GGBlog;
  var listEl = document.getElementById('list');
  var emptyEl = document.getElementById('emptyState');
  var loadingEl = document.getElementById('loadingState');
  var countEl = document.getElementById('count');
  var msgEl = document.getElementById('message');
  var posts = [];

  function msg(type, text) {
    msgEl.className = 'message ' + type + ' show';
    msgEl.textContent = text;
    if (type === 'success') setTimeout(function () { msgEl.className = 'message'; }, 3500);
  }

  if (!sb) { msg('error', 'Supabase is not configured. Please check supabase-config.js.'); loadingEl.hidden = true; return; }

  function checkSession() {
    return sb.auth.getSession().then(function (r) {
      var s = r && r.data ? r.data.session : null;
      if (!s) { location.href = 'admin-login.html'; return null; }
      var u = document.getElementById('userEmail'); if (u && s.user) u.textContent = s.user.email || '';
      return s;
    });
  }

  function render() {
    loadingEl.hidden = true;
    countEl.textContent = posts.length + (posts.length === 1 ? ' article' : ' articles');
    if (!posts.length) { listEl.hidden = true; emptyEl.hidden = false; return; }
    emptyEl.hidden = true;
    listEl.hidden = false;
    listEl.innerHTML = posts.map(function (p) {
      var pub = p.status === 'published';
      var thumb = p.cover_url
        ? '<img src="' + G.esc(p.cover_url) + '" alt="" />'
        : '<div class="noimg">No image</div>';
      var when = pub ? 'Published ' + G.formatDate(p.published_at) : 'Draft · edited ' + G.formatDate(p.updated_at);
      return '<div class="post-row" data-id="' + p.id + '">' +
        thumb +
        '<div>' +
          '<div class="post-title">' + G.esc(p.title || 'Untitled') +
            '<span class="badge ' + (pub ? 'pub' : 'draft') + '">' + (pub ? 'Published' : 'Draft') + '</span></div>' +
          '<div class="post-meta">' + G.esc(when) + '</div>' +
        '</div>' +
        '<div class="row-actions">' +
          '<a class="btn-outline" href="admin-blog-editor.html?id=' + p.id + '">Edit</a>' +
          (pub ? '<a class="btn-outline" target="_blank" rel="noopener" href="blog-post.html?slug=' + encodeURIComponent(p.slug) + '">View</a>' : '') +
          '<button class="btn-outline" type="button" data-act="toggle">' + (pub ? 'Unpublish' : 'Publish') + '</button>' +
          '<button class="btn-outline danger" type="button" data-act="delete">Delete</button>' +
        '</div></div>';
    }).join('');
  }

  function load() {
    sb.from('blog_posts')
      .select('id,slug,title,status,cover_url,cover_path,published_at,updated_at')
      .order('updated_at', { ascending: false })
      .then(function (res) {
        if (res.error) { loadingEl.hidden = true; msg('error', 'Could not load articles: ' + res.error.message); return; }
        posts = res.data || [];
        render();
      });
  }

  function findPost(id) { return posts.filter(function (p) { return p.id === id; })[0]; }

  listEl.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var row = btn.closest('.post-row');
    var post = findPost(row.getAttribute('data-id'));
    if (!post) return;

    if (btn.getAttribute('data-act') === 'toggle') {
      var nextStatus = post.status === 'published' ? 'draft' : 'published';
      var patch = { status: nextStatus, updated_at: new Date().toISOString() };
      if (nextStatus === 'published' && !post.published_at) patch.published_at = new Date().toISOString();
      btn.disabled = true;
      sb.from('blog_posts').update(patch).eq('id', post.id).then(function (res) {
        btn.disabled = false;
        if (res.error) { msg('error', 'Could not change status: ' + res.error.message); return; }
        msg('success', nextStatus === 'published' ? 'Article published.' : 'Article moved to drafts.');
        load();
      });
    }

    if (btn.getAttribute('data-act') === 'delete') {
      if (!confirm('Delete "' + (post.title || 'Untitled') + '"? This cannot be undone.')) return;
      btn.disabled = true;
      sb.from('blog_posts').delete().eq('id', post.id).then(function (res) {
        if (res.error) { btn.disabled = false; msg('error', 'Could not delete: ' + res.error.message); return; }
        if (post.cover_path) sb.storage.from('blog-media').remove([post.cover_path]).catch(function () {});
        msg('success', 'Article deleted.');
        load();
      });
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', function () {
    var go = function () { location.href = 'admin-login.html'; };
    sb.auth.signOut().then(go, go);
  });

  checkSession().then(function (s) { if (s) load(); });
})();
