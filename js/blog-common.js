/* ============================================================
   GOOD GIRLS — js/blog-common.js
   Shared helpers for the blog (admin editor + public pages).
   Exposes window.GGBlog
   ============================================================ */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function slugify(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80) || ('post-' + Date.now());
  }

  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // Turn a YouTube / Vimeo link into an embeddable URL (or null)
  function videoEmbedUrl(url) {
    var u = String(url || '').trim();
    var m;
    m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/);
    if (m) return 'https://www.youtube-nocookie.com/embed/' + m[1];
    m = u.match(/vimeo\.com\/(?:video\/)?(\d{5,12})/);
    if (m) return 'https://player.vimeo.com/video/' + m[1];
    return null;
  }

  var ALLOWED_TAGS = {
    P: 1, BR: 1, H2: 1, H3: 1, H4: 1, STRONG: 1, B: 1, EM: 1, I: 1, U: 1, SPAN: 1,
    UL: 1, OL: 1, LI: 1, A: 1, BLOCKQUOTE: 1, DIV: 1, FIGURE: 1, FIGCAPTION: 1,
    IMG: 1, IFRAME: 1, VIDEO: 1, SOURCE: 1
  };
  var DROP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, OBJECT: 1, EMBED: 1, LINK: 1, META: 1, FORM: 1 };

  function safeStyle(styleText) {
    var out = [];
    String(styleText || '').split(';').forEach(function (decl) {
      var i = decl.indexOf(':');
      if (i < 0) return;
      var prop = decl.slice(0, i).trim().toLowerCase();
      var val = decl.slice(i + 1).trim();
      if (prop === 'text-align' && /^(left|center|right|justify)$/.test(val)) out.push(prop + ':' + val);
      else if (prop === 'font-size' && /^\d+(\.\d+)?(px|rem|em)$/.test(val)) out.push(prop + ':' + val);
      else if (prop === 'color' && /^#[0-9a-f]{3,8}$/i.test(val)) out.push(prop + ':' + val);
    });
    return out.join(';');
  }

  function safeUrl(url, allowHttpsOnly) {
    var u = String(url || '').trim();
    if (/^https:\/\//i.test(u)) return u;
    if (!allowHttpsOnly && /^(mailto:|tel:)/i.test(u)) return u;
    return null;
  }

  function cleanNode(node, doc) {
    var kids = Array.prototype.slice.call(node.childNodes);
    kids.forEach(function (child) {
      if (child.nodeType === 3) return;               // text: keep
      if (child.nodeType !== 1) { node.removeChild(child); return; }
      var tag = child.tagName.toUpperCase();
      if (DROP_TAGS[tag]) { node.removeChild(child); return; }
      if (!ALLOWED_TAGS[tag]) {
        cleanNode(child, doc);                        // unwrap: keep its safe children
        while (child.firstChild) node.insertBefore(child.firstChild, child);
        node.removeChild(child);
        return;
      }
      // attributes: whitelist
      Array.prototype.slice.call(child.attributes).forEach(function (attr) {
        var name = attr.name.toLowerCase();
        var keep = false;
        if (name === 'class') {
          var cls = attr.value.split(/\s+/).filter(function (c) { return /^bm-[a-z0-9-]+$/.test(c); });
          child.removeAttribute('class');
          if (cls.length) child.setAttribute('class', cls.join(' '));
          return;
        }
        if (name === 'style') {
          var st = safeStyle(attr.value);
          child.removeAttribute('style');
          if (st) child.setAttribute('style', st);
          return;
        }
        if (tag === 'A' && name === 'href') {
          var h = safeUrl(attr.value, false);
          if (h) { child.setAttribute('href', h); child.setAttribute('target', '_blank'); child.setAttribute('rel', 'noopener'); keep = true; }
        }
        if (tag === 'IMG' && (name === 'src')) { var s = safeUrl(attr.value, true); if (s) { child.setAttribute('src', s); keep = true; } }
        if ((tag === 'VIDEO' || tag === 'SOURCE') && name === 'src') { var vs = safeUrl(attr.value, true); if (vs) { child.setAttribute('src', vs); keep = true; } }
        if (tag === 'IFRAME' && name === 'src') {
          if (/^https:\/\/(www\.youtube-nocookie\.com\/embed\/|player\.vimeo\.com\/video\/)/.test(attr.value)) { child.setAttribute('src', attr.value); keep = true; }
        }
        if (tag === 'SOURCE' && name === 'type') keep = true;
        if (tag === 'IMG' && name === 'alt') keep = true;
        if (tag === 'VIDEO' && (name === 'controls' || name === 'playsinline')) { child.setAttribute(name, ''); keep = true; }
        if (tag === 'IFRAME' && (name === 'allowfullscreen')) { child.setAttribute(name, ''); keep = true; }
        if (tag === 'IFRAME' && name === 'loading') { child.setAttribute('loading', 'lazy'); keep = true; }
        if (!keep) child.removeAttribute(attr.name);
      });
      // hard requirements
      if (tag === 'IMG' && !child.getAttribute('src')) { node.removeChild(child); return; }
      if (tag === 'IFRAME' && !child.getAttribute('src')) { node.removeChild(child); return; }
      if (tag === 'VIDEO' && !child.getAttribute('src') && !child.querySelector('source')) { node.removeChild(child); return; }
      if (tag === 'IFRAME') child.setAttribute('allow', 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
      if (tag === 'A') child.setAttribute('rel', 'noopener');
      cleanNode(child, doc);
    });
  }

  // Remove anything unsafe from article HTML. Used on save AND before display.
  function sanitize(html) {
    var doc = document.implementation.createHTMLDocument('');
    var wrap = doc.createElement('div');
    wrap.innerHTML = String(html || '');
    cleanNode(wrap, doc);
    return wrap.innerHTML;
  }

  window.GGBlog = {
    esc: esc,
    slugify: slugify,
    formatDate: formatDate,
    videoEmbedUrl: videoEmbedUrl,
    sanitize: sanitize
  };
})();
