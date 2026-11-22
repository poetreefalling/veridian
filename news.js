/* Veridian news feed. Posts live in posts.json (newest first); every post is by the author named there.
   news.html shows the list; news.html#<slug> shows one post. */
(function () {
  'use strict';
  var main = document.getElementById('news');
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function when(post) {
    if (!post.date) return post.label || '';
    var d = new Date(post.date + 'T00:00:00');
    var s = isNaN(d) ? post.date : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
    return post.label ? post.label + ' · ' + s : s;
  }
  function byline(author) {
    var p = el('p', 'v-byline'); p.append('By ', el('b', null, author)); return p;
  }
  function list(data) {
    document.title = 'News — Veridian';
    var head = el('div', 'v-feed-head');
    head.append(el('p', 'v-eyebrow', 'Veridian | Gen.1'), el('h1', 'v-display', 'News'),
      el('p', 'v-lead', 'A record of the first generation of Veridian implants, by ' + data.author + '.'));
    var ol = el('ol', 'v-feed');
    data.posts.forEach(function (post) {
      var li = el('li', 'v-post-item');
      var h = el('h2', 'v-title'), a = el('a', 'v-post-link', post.title);
      a.href = '#' + post.slug; h.append(a);
      li.append(el('p', 'v-eyebrow', when(post)), h);
      if (post.summary) li.append(el('p', 'v-lead', post.summary));
      li.append(byline(post.author || data.author));
      ol.append(li);
    });
    main.replaceChildren(head, ol);
  }
  function article(data, post) {
    document.title = post.title + ' — Veridian';
    var back = el('a', 'v-back', '← All news'); back.href = 'news.html';
    var art = el('article', 'v-article');
    art.append(el('p', 'v-eyebrow', when(post)), el('h1', 'v-display', post.title), byline(post.author || data.author));
    var body = el('div', 'v-article-body');
    (post.body || []).forEach(function (line) {
      if (line.indexOf('## ') === 0) body.append(el('h2', null, line.slice(3)));
      else if (line.charAt(0) === '*') body.append(el('p', 'v-small', line));
      else body.append(el('p', null, line));
    });
    art.append(body);
    main.replaceChildren(back, art);
  }
  function render(data) {
    var slug = decodeURIComponent(location.hash.replace(/^#/, ''));
    var post = slug && data.posts.filter(function (p) { return p.slug === slug; })[0];
    if (post) article(data, post); else list(data);
    var page = document.querySelector('.v-page'); if (page) page.scrollTop = 0;
    main.focus({ preventScroll: true });
  }
  fetch('posts.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      render(data);
      window.addEventListener('hashchange', function () { render(data); });
    })
    .catch(function () {
      main.replaceChildren(el('p', 'v-lead', 'The news feed could not be loaded. Please try again in a moment.'));
    });
})();
