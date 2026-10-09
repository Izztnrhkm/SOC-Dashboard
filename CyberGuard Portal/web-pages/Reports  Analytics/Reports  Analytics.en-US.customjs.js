/* Reports — animated compliance rings, report filter, closed incidents from Dataverse (or sample data) */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  if (!$('rRows') || !window.CG) return;
  setTimeout(function () { [].forEach.call(document.querySelectorAll('#rings .arc'), function (a) { a.style.transition = 'stroke-dashoffset 1s ease'; a.setAttribute('stroke-dashoffset', a.getAttribute('data-off')); }); }, 150);
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-print]')) window.print(); });
  $('rFilter').addEventListener('input', function () {
    var q = this.value.trim().toLowerCase();
    [].forEach.call(document.querySelectorAll('#repTable tbody tr'), function (r) { r.hidden = q && r.textContent.toLowerCase().indexOf(q) === -1; });
  });
  var PAGE = 8, page = 1, rows = [];
  function mins(i) { return Math.max(1, Math.round((i.modified - i.created) / 60000)); }
  function draw() {
    var total = rows.length, pages = Math.max(1, Math.ceil(total / PAGE)); page = Math.min(page, pages);
    var slice = rows.slice((page - 1) * PAGE, page * PAGE);
    $('rRows').innerHTML = slice.length ? slice.map(function (i) {
      return '<tr><td data-label="ID" class="cg-mono">' + CG.esc(i.ref) + '</td><td data-label="Incident"><strong>' + CG.esc(i.title) + '</strong></td><td data-label="Asset">' + CG.esc(i.host || '—') + '</td><td data-label="Detected by">' + CG.esc(i.src || '—') + '</td><td data-label="Time to contain">' + mins(i) + ' min</td><td data-label="Closed"><span class="cg-dot ok"></span> ' + CG.date(i.modified) + '</td></tr>';
    }).join('') : '<tr><td colspan="6"><div class="cg-empty"><b>Nothing closed yet</b>Resolved incidents will appear here.</div></td></tr>';
    $('rPager').innerHTML = total > PAGE ? '<button class="cg-btn ghost sm" ' + (page <= 1 ? 'disabled' : '') + ' data-p="-1">Previous</button><span>Page ' + page + ' of ' + pages + '</span><button class="cg-btn ghost sm" ' + (page >= pages ? 'disabled' : '') + ' data-p="1">Next</button>' : '';
  }
  $('rPager').addEventListener('click', function (e) { var b = e.target.closest('button[data-p]'); if (b) { page += +b.dataset.p; draw(); } });
  CG.incidents.list().then(function (res) {
    var s = CG.stats(res.items);
    rows = res.items.filter(function (i) { return i.status === 'resolved'; }).sort(function (a, b) { return b.modified - a.modified; });
    $('rClosed').textContent = rows.length; $('rOpen').textContent = s.open; $('rMttr').textContent = s.mttr ? s.mttr + ' min' : '—';
    $('rFast').textContent = rows.length ? Math.round(rows.filter(function (i) { return mins(i) <= 30; }).length / rows.length * 100) + '%' : '—';
    $('rSub').textContent = (res.live ? 'Live data from Dataverse' : 'Sample data') + ' · ' + rows.length + ' closed';
    draw();
    $('rCsv').onclick = function () {
      CG.csv('closed-incidents.csv', [['Reference', 'Title', 'Severity', 'Asset', 'Detected by', 'Minutes to contain', 'Closed']].concat(rows.map(function (i) { return [i.ref, i.title, i.sev, i.host, i.src, mins(i), new Date(i.modified).toISOString()]; })));
    };
  });
})();
