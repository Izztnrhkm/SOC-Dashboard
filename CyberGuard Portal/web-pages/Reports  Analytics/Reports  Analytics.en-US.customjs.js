/* Reports: figures, 14-day chart, severity bars and the closed-incident log, all calculated from CG.incidents. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  if (!$('rRows') || !window.CG) return;
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-print]')) window.print(); });
  var PAGE = 10, page = 1, rows = [];
  function mins(i) { return Math.max(1, Math.round((i.modified - i.created) / 60000)); }

  function draw() {
    var total = rows.length, pages = Math.max(1, Math.ceil(total / PAGE)); page = Math.max(1, Math.min(page, pages));
    var slice = rows.slice((page - 1) * PAGE, page * PAGE);
    $('rRows').innerHTML = slice.length ? slice.map(function (i) {
      return '<tr><td class="bar ' + CG.esc(i.sev) + '"><div class="t">' + CG.esc(i.title) + '</div><div class="s">' + CG.esc(i.ref) + '</div></td><td data-label="Severity">' + CG.sevTag(i.sev) + '</td><td data-label="Asset">' + CG.esc(i.host || '—') + '</td><td data-label="Time to resolve">' + CG.duration(mins(i)) + '</td><td data-label="Resolved">' + CG.esc(CG.date(i.modified)) + '</td></tr>';
    }).join('') : '<tr><td colspan="5"><div class="ld-empty"><b>Nothing resolved yet</b>Incidents appear here when they are marked resolved.</div></td></tr>';
    $('rPager').innerHTML = total > PAGE ? '<span>Page ' + page + ' of ' + pages + '</span><span><button class="ld-btn sm" type="button" data-p="-1"' + (page <= 1 ? ' disabled' : '') + '>Previous</button><button class="ld-btn sm" type="button" data-p="1"' + (page >= pages ? ' disabled' : '') + '>Next</button></span>' : '';
  }
  $('rPager').addEventListener('click', function (e) { var b = e.target.closest('button[data-p]'); if (b) { page += +b.getAttribute('data-p'); draw(); } });

  CG.incidents.list().then(function (res) {
    var t = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    var bad = !!(res.restricted || res.failed);
    $('rSource').textContent = res.live ? 'Live from Dataverse. Updated ' + t + '.' : res.restricted ? 'No access.' : res.failed ? 'Not loaded.' : 'Sample data.';
    if (!res.live) { $('rConn').hidden = false; $('rConn').className = 'ld-note' + (bad ? ' warn' : ''); $('rConnText').innerHTML = (res.restricted ? '<b>No access to incidents.</b> ' : res.failed ? '<b>Incidents couldn’t be loaded.</b> ' : '<b>Showing sample data.</b> ') + CG.esc(res.reason); }
    var items = res.items, s = CG.stats(items), month = Date.now() - 30 * 86400000;
    rows = items.filter(function (i) { return i.status === 'resolved'; }).sort(function (a, b) { return b.modified - a.modified; });
    var timed = rows.filter(function (i) { return i.modified > i.created; });
    $('fOpen').textContent = s.open;
    $('fClosed').textContent = rows.filter(function (i) { return i.modified >= month; }).length;
    $('fMttr').textContent = CG.duration(s.mttr);
    $('fFast').textContent = timed.length ? Math.round(timed.filter(function (i) { return mins(i) <= 30; }).length / timed.length * 100) + '%' : '—';
    $('rCount').textContent = rows.length ? CG.plural(rows.length, 'incident') : '';

    var days = [], d0 = new Date(); d0.setHours(0, 0, 0, 0);
    for (var n = 13; n >= 0; n--) days.push({ t: d0.getTime() - n * 86400000, c: 0 });
    items.forEach(function (i) { for (var k = days.length - 1; k >= 0; k--) { if (i.created >= days[k].t) { if (k < 13 || i.created < days[k].t + 86400000) days[k].c++; break; } } });
    var max = Math.max.apply(null, days.map(function (x) { return x.c; })) || 1;
    $('chart').setAttribute('aria-label', 'New incidents per day for the last 14 days: ' + days.map(function (x) { return new Date(x.t).getDate() + ' ' + new Date(x.t).toLocaleString('en-GB', { month: 'short' }) + ': ' + x.c; }).join(', '));
    $('chart').innerHTML = days.map(function (x, k) {
      return '<div class="c' + (k === 13 ? ' today' : '') + '" title="' + new Date(x.t).toDateString() + ': ' + x.c + '"><b>' + (x.c || '') + '</b><i style="height:' + (x.c ? Math.max(4, Math.round(x.c / max * 130)) : 1) + 'px"></i><span>' + new Date(x.t).getDate() + '</span></div>';
    }).join('');

    var colors = { critical: 'var(--sev-crit)', high: 'var(--sev-high)', medium: 'var(--sev-med)', low: 'var(--sev-low)' }, top = Math.max(1, Math.max.apply(null, CG.SEV.map(function (v) { return s.bySev[v]; })));
    $('hbars').innerHTML = CG.SEV.map(function (v) {
      return '<div><span>' + CG.LBL[v] + '</span><span class="track"><span class="fill" style="width:' + Math.round(s.bySev[v] / top * 100) + '%;background:' + colors[v] + '"></span></span><b>' + s.bySev[v] + '</b></div>';
    }).join('') + '<p class="ld-muted ld-small" style="margin-top:8px"><a href="/dashboard/">Open the dashboard</a> to work on them.</p>';
    draw();

    $('rCsv').disabled = bad;
    $('rCsv').onclick = function () {
      CG.csv('resolved-incidents-' + new Date().toISOString().slice(0, 10) + '.csv', [['Reference', 'Title', 'Severity', 'Asset', 'Detected by', 'Minutes to resolve', 'Resolved']].concat(rows.map(function (i) { return [i.ref, i.title, CG.LBL[i.sev], i.host, i.src, mins(i), new Date(i.modified).toISOString()]; })));
      CG.toast('Exported ' + CG.plural(rows.length, 'incident'));
    };
  });
})();
