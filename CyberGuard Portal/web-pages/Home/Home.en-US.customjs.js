/* Home — live posture + latest incidents (falls back to sample data automatically) */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  if (!$('feed') || !window.CG) return;
  var RANK = { critical: 0, high: 1, medium: 2, low: 3 };
  CG.incidents.list().then(function (res) {
    if (res.restricted) { $('postLvl').textContent = 'Restricted'; $('pSrc').textContent = res.status === 401 ? 'Sign in to see live data' : 'Needs the SOC Analyst role'; $('feedSub').textContent = 'You do not have access to incident data'; $('feed').innerHTML = '<li><div class="cg-empty" style="width:100%;padding:28px"><b>No access</b>' + CG.esc(res.reason) + '</div></li>'; return; }
    var s = CG.stats(res.items), week = Date.now() - 7 * 86400000;
    var resolvedWeek = res.items.filter(function (i) { return i.status === 'resolved' && i.modified > week; }).length;
    var lvl, pos, cls;
    if (s.bySev.critical >= 3) { lvl = 'Critical'; pos = 90; cls = 'bad'; }
    else if (s.bySev.critical >= 1) { lvl = 'Elevated'; pos = 66; cls = 'bad'; }
    else if (s.bySev.high >= 3) { lvl = 'Guarded'; pos = 38; cls = 'warn'; }
    else { lvl = 'Normal'; pos = 12; cls = ''; }
    $('postLvl').textContent = lvl; $('postDot').className = 'cg-pulse ' + cls; $('postPin').style.left = pos + '%';
    CG.count($('pOpen'), s.open); CG.count($('pCrit'), s.bySev.critical); CG.count($('pRes'), resolvedWeek);
    $('pMttr').textContent = s.mttr ? s.mttr + ' min' : '—';
    $('pSrc').textContent = res.live ? 'Live (Dataverse)' : 'Sample data';
    var open = res.items.filter(function (i) { return i.status !== 'resolved'; })
      .sort(function (a, b) { return RANK[a.sev] - RANK[b.sev] || b.created - a.created; }).slice(0, 6);
    $('feedSub').textContent = open.length ? s.open + ' open in total, most severe first' : 'Nothing open right now';
    $('feed').innerHTML = open.length ? open.map(function (i) {
      return '<li><a href="/dashboard/?open=' + encodeURIComponent(i.id) + '" style="display:flex;gap:14px;align-items:center;width:100%;color:inherit"><span class="cg-badge ' + i.sev + '" style="min-width:86px;justify-content:center">' + CG.esc(i.sev.charAt(0).toUpperCase() + i.sev.slice(1)) + '</span><span class="txt"><b>' + CG.esc(i.title) + '</b><small>' + CG.esc(i.ref) + (i.host ? ' · ' + CG.esc(i.host) : '') + '</small></span><span class="when">' + CG.ago(i.created) + '</span></a></li>';
    }).join('') : '<li><div class="cg-empty" style="width:100%;padding:28px"><b>All clear</b>No open incidents.</div></li>';
  });
})();
