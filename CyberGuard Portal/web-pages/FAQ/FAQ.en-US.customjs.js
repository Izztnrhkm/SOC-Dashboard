/* FAQ — topic filter, text filter, helpful votes (stored on this device), optional live articles from Dataverse (cg_article) */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var list = $('faqList'); if (!list) return;
  var cat = 'All', VKEY = 'cg_faq_votes', votes = {};
  try { votes = JSON.parse(localStorage.getItem(VKEY) || '{}'); } catch (e) {}
  function items() { return [].slice.call(list.querySelectorAll('details')); }

  function run() {
    var q = $('faqFilter').value.trim().toLowerCase(), n = 0, all = items();
    all.forEach(function (d) {
      var hit = (cat === 'All' || d.dataset.cat === cat) && (!q || d.textContent.toLowerCase().indexOf(q) !== -1);
      d.hidden = !hit; if (hit) n++;
      if (q && hit) d.open = true; else if (!q) d.open = false;
    });
    $('faqCount').textContent = (q || cat !== 'All') ? n + ' of ' + all.length + ' questions' : all.length + ' questions';
    $('faqNone').hidden = n !== 0;
  }
  $('faqFilter').addEventListener('input', run);
  $('faqChips').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-cat]'); if (!b) return;
    cat = b.dataset.cat; [].forEach.call($('faqChips').children, function (c) { c.classList.toggle('on', c === b); }); run();
  });
  $('faqToggle').addEventListener('click', function () {
    var open = this.textContent === 'Expand all'; items().forEach(function (d) { if (!d.hidden) d.open = open; }); this.textContent = open ? 'Collapse all' : 'Expand all';
  });
  list.addEventListener('click', function (e) {
    var b = e.target.closest('.vote button'); if (!b) return;
    var d = b.closest('details'); votes[d.id] = b.dataset.v; try { localStorage.setItem(VKEY, JSON.stringify(votes)); } catch (x) {}
    markVote(d);
  });
  function markVote(d) {
    var v = votes[d.id], box = d.querySelector('.vote'); if (!box || !v) return;
    [].forEach.call(box.querySelectorAll('button'), function (b) { b.style.borderColor = b.dataset.v === v ? 'var(--brand)' : ''; b.style.background = b.dataset.v === v ? 'var(--brand-soft)' : ''; });
    box.querySelector('.thanks').hidden = false;
  }
  items().forEach(markVote);

  function deepLink() { if (location.hash.length > 1) { try { var t = document.querySelector(location.hash); if (t && t.tagName === 'DETAILS') { t.open = true; t.scrollIntoView(); } } catch (e) {} } }

  /* live articles: add rows from cg_article that are not already shown */
  if (window.CG && CG.req) {
    CG.req('GET', 'cg_articles?$orderby=cg_sortorder asc&$top=100').then(function (d) {
      var seen = {}; items().forEach(function (x) { seen[x.querySelector('summary').textContent.trim().toLowerCase()] = 1; });
      (d.value || []).forEach(function (r, i) {
        var q = (r.cg_title || '').trim(); if (!q || seen[q.toLowerCase()]) return;
        var el = document.createElement('details'); el.id = 'a' + (r.cg_articleid || i); el.dataset.cat = r.cg_category || 'General';
        el.innerHTML = '<summary>' + CG.esc(q) + '</summary><div class="body">' + CG.esc(r.cg_answer || '').replace(/\n/g, '<br>') + '<div class="vote">Was this helpful? <button type="button" data-v="up">Yes</button><button type="button" data-v="down">No</button><span class="thanks" hidden>Thanks for the feedback.</span></div></div>';
        list.appendChild(el); markVote(el);
        if (![].some.call($('faqChips').children, function (c) { return c.dataset.cat === el.dataset.cat; })) {
          var c = document.createElement('button'); c.type = 'button'; c.className = 'cg-chip'; c.dataset.cat = el.dataset.cat; c.textContent = el.dataset.cat; $('faqChips').appendChild(c);
        }
      });
      run(); deepLink();
    }, function () { /* static answers stay */ });
  }
  run(); deepLink();
})();
