/* ============================================================
   GOOD GIRLS — js/blog-public.js
   Public blog: listing on blog.html, single article on blog-post.html.
   Only PUBLISHED posts are fetched (also enforced by Supabase RLS).
   ============================================================ */
(function () {
  'use strict';

  var sb = window.supabaseClient;
  var G = window.GGBlog;
  var listEl = document.getElementById('blogGrid');
  var articleEl = document.getElementById('article');

  function showError(el, text) {
    if (el) { el.hidden = false; el.textContent = text; }
  }

  // ---------- LISTING ----------
  function renderList(posts) {
    var loading = document.getElementById('blogLoading');
    var empty = document.getElementById('blogEmpty');
    if (loading) loading.hidden = true;
    if (!posts.length) { if (empty) empty.hidden = false; return; }
    listEl.innerHTML = posts.map(function (p) {
      var img = p.cover_url
        ? '<div class="blog-card-img"><img src="' + G.esc(p.cover_url) + '" alt="' + G.esc(p.title) + '" loading="lazy" /></div>'
        : '';
      return '<a class="blog-card" href="blog-post.html?slug=' + encodeURIComponent(p.slug) + '">' +
        img +
        '<div class="blog-card-body">' +
          '<span class="blog-date">' + G.esc(G.formatDate(p.published_at)) + '</span>' +
          '<h2>' + G.esc(p.title) + '</h2>' +
          (p.excerpt ? '<p>' + G.esc(p.excerpt) + '</p>' : '') +
          '<span class="blog-more">Read article &rarr;</span>' +
        '</div></a>';
    }).join('');
  }

  function loadList() {
    if (!sb) { showError(document.getElementById('blogLoading'), 'Blog is temporarily unavailable.'); return; }
    sb.from('blog_posts')
      .select('slug,title,excerpt,cover_url,published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .then(function (res) {
        if (res.error) { showError(document.getElementById('blogLoading'), 'Could not load articles. Please refresh.'); return; }
        renderList(res.data || []);
      });
  }

  // ---------- SINGLE ARTICLE ----------
  function loadArticle() {
    var loading = document.getElementById('loading');
    var notFound = document.getElementById('notFound');
    var slug = new URLSearchParams(location.search).get('slug');
    if (!slug) { if (loading) loading.hidden = true; if (notFound) notFound.hidden = false; return; }
    if (!sb) { showError(loading, 'Article is temporarily unavailable.'); return; }

    sb.from('blog_posts')
      .select('title,excerpt,cover_url,body_html,published_at')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle()
      .then(function (res) {
        if (loading) loading.hidden = true;
        if (res.error) { showError(notFound, 'Could not load this article. Please refresh.'); return; }
        if (!res.data) { if (notFound) notFound.hidden = false; return; }
        var p = res.data;

        document.title = p.title + ' | Good Girls';
        var md = document.querySelector('meta[name="description"]');
        if (md && p.excerpt) md.setAttribute('content', p.excerpt);

        document.getElementById('title').textContent = p.title;
        document.getElementById('meta').textContent = G.formatDate(p.published_at);
        if (p.cover_url) {
          var cw = document.getElementById('coverWrap');
          document.getElementById('cover').setAttribute('src', p.cover_url);
          document.getElementById('cover').setAttribute('alt', p.title);
          cw.hidden = false;
        }
        document.getElementById('body').innerHTML = G.sanitize(p.body_html);
        articleEl.hidden = false;
      });
  }

  if (listEl) loadList();
  if (articleEl) loadArticle();
})();
