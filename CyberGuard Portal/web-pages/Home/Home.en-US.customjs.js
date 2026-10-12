/* Home: one plain sentence about what is open right now, and the most urgent open incidents. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  if (!$('feed') || !window.CG) return;
  var h = new Date().getHours(), name = CG.firstName();
  $('hello').textContent = (h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening') + (name ? ', ' + name : '') + '.';

  /* last shift handover */
  CG.handovers.list().then(function (r) {
    var el = $('lastHo'), h = r.items.slice().sort(function (a, b) { return b.created - a.created; })[0];
    if (!r.live && (r.restricted || r.failed)) { el.innerHTML = '<p class="ld-muted">' + (r.restricted ? 'Handovers appear here once your account has the SOC Analyst role.' : 'Handovers couldn’t be loaded.') + '</p>'; return; }
    if (!h) { el.innerHTML = '<p class="ld-muted">No handover yet. <a href="/handover/#write">Write the first one</a>.</p>'; return; }
    var txt = String(h.summary || ''); if (txt.length > 180) txt = txt.slice(0, 177).replace(/\s+\S*$/, '') + '…';
    el.innerHTML = '<p class="ld-small ld-muted">' + CG.esc(h.title || 'Shift') + ', ' + CG.esc(h.author || 'unknown') + ', ' + CG.ago(h.created) + '</p><p style="margin-top:6px">' + CG.esc(txt) + '</p><p style="margin-top:8px"><a class="ld-small" href="/handover/">Read the full handover</a></p>';
  });

  CG.incidents.list().then(function (res) {
    var now = $('now'), sub = $('nowSub'), feed = $('feed');
    if (res.restricted || res.failed) {
      now.textContent = res.failed ? 'Incidents couldn’t be loaded.' : res.status === 401 ? 'Sign in to see open incidents.' : 'You can’t see incidents yet.';
      sub.innerHTML = CG.esc(res.reason) + (res.status === 403 ? ' <a href="/contact-us/?topic=Dashboard%20access">Ask for access</a>' : '');
      feed.innerHTML = '<li class="ld-empty">' + (res.failed ? 'Try again in a minute. If something is urgent, call the hotline.' : 'Incidents appear here once your account has access.') + '</li>';
      $('allLink').hidden = true;
      return;
    }
    var s = CG.stats(res.items), c = s.bySev.critical;
    if (c > 0) now.innerHTML = '<span class="n">' + CG.plural(c, 'critical incident') + '</span> ' + (c === 1 ? 'is' : 'are') + ' open.';
    else if (s.open > 0) now.textContent = CG.plural(s.open, 'incident') + ' open, none critical.';
    else now.textContent = 'No open incidents.';
    var bits = [];
    if (c > 0) bits.push(CG.plural(s.open, 'incident') + ' open in total');
    if (s.unassigned > 0) bits.push(s.unassigned + ' without an owner');
    if (s.mttr) bits.push('average time to resolve ' + CG.duration(s.mttr));
    var txt = bits.length ? bits.join(', ') + '.' : '';
    sub.innerHTML = (txt ? txt.charAt(0).toUpperCase() + txt.slice(1) : '') + (res.live ? '' : '<br><span class="ld-muted ld-small">Sample data. ' + CG.esc(res.reason) + '</span>');

    var open = res.items.filter(function (i) { return i.status !== 'resolved'; })
      .sort(function (a, b) { return CG.RANK[a.sev] - CG.RANK[b.sev] || b.created - a.created; }).slice(0, 6);
    feed.innerHTML = open.length ? open.map(function (i) {
      return '<li><a class="ld-row ld-bar ' + CG.esc(i.sev) + '" href="/dashboard/?open=' + encodeURIComponent(i.id) + '">' + CG.sevTag(i.sev) +
        '<span><span class="t">' + CG.esc(i.title) + '</span><span class="s">' + CG.esc([i.ref, i.host, CG.isUnassigned(i) ? 'no owner' : i.owner].filter(Boolean).join(', ')) + '</span></span>' +
        '<span class="age">' + CG.ago(i.created) + '</span></a></li>';
    }).join('') : '<li class="ld-empty"><b>All clear</b>Nothing is open. New reports will show up here.</li>';
    $('allLink').textContent = s.open > open.length ? 'All ' + s.open + ' open incidents' : 'Open the dashboard';
  });
})();
