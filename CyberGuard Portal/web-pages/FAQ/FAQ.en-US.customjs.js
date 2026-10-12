/* FAQ: text search, topic filter, links to a question by #id, and extra answers from Dataverse (cg_article) when available. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var list = $('faqList'); if (!list) return;
  var cat = 'All';
  function items() { return [].slice.call(list.querySelectorAll('details')); }

  function run() {
    var q = $('faqQ').value.trim().toLowerCase(), n = 0, all = items();
    all.forEach(function (d) {
      var hit = (cat === 'All' || d.getAttribute('data-cat') === cat) && (!q || d.textContent.toLowerCase().indexOf(q) !== -1);
      d.hidden = !hit; if (hit) n++;
      if (q) d.open = hit;
    });
    $('faqCount').textContent = n + ' of ' + all.length + ' questions shown';
    $('faqNone').hidden = n !== 0;
  }
  var tmr; $('faqQ').addEventListener('input', function () { clearTimeout(tmr); tmr = setTimeout(run, 100); });
  $('faqTopics').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-cat]'); if (!b) return;
    cat = b.getAttribute('data-cat');
    [].forEach.call($('faqTopics').children, function (c) { c.setAttribute('aria-pressed', c === b ? 'true' : 'false'); });
    run();
  });
  function deepLink() {
    if (location.hash.length < 2) return;
    try { var t = document.querySelector(location.hash); if (t && t.tagName === 'DETAILS') { t.open = true; t.scrollIntoView(); } } catch (e) {}
  }

  if (window.CG && CG.req) {
    CG.req('GET', 'cg_articles?$orderby=cg_sortorder asc&$top=100').then(function (d) {
      var seen = {}; items().forEach(function (x) { seen[x.querySelector('.q').textContent.trim().toLowerCase()] = 1; });
      (d.value || []).forEach(function (r, i) {
        var q = (r.cg_title || '').trim(); if (!q || seen[q.toLowerCase()]) return;
        var c = r.cg_category || 'General', el = document.createElement('details');
        el.id = 'a-' + (r.cg_articleid || i); el.setAttribute('data-cat', c);
        el.innerHTML = '<summary><span class="q">' + CG.esc(q) + '</span></summary><div class="ans"><p>' + CG.esc(r.cg_answer || '').replace(/\n+/g, '</p><p>') + '</p></div>';
        list.appendChild(el);
        if (![].some.call($('faqTopics').children, function (b) { return b.getAttribute('data-cat') === c; })) {
          var b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-cat', c); b.setAttribute('aria-pressed', 'false'); b.textContent = c; $('faqTopics').appendChild(b);
        }
      });
      run(); deepLink();
    }, function () { /* the answers above stay */ });
  }
  run(); deepLink(); window.addEventListener('hashchange', deepLink);
})();
