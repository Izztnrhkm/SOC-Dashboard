/* ==========================================================================
   CyberGuard — Dashboard controller
   Data: Dataverse table cg_incident through the Power Pages Web API (CG.incidents).
   If the API is not reachable yet, CG.incidents falls back to sample data and says why.
   ========================================================================== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  if (!$('rows') || !window.CG) return;
  var esc = CG.esc, RANK = { critical: 0, high: 1, medium: 2, low: 3 }, SEV = ['critical', 'high', 'medium', 'low'];
  var LBL = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', 'new': 'New', investigating: 'Investigating', contained: 'Contained', resolved: 'Resolved' };
  var PAGE = 10, data = [], live = false;
  var st = { sev: 'all', status: 'open', owner: 'all', q: '', page: 1, sort: 'sev', dir: 1, open: null };

  function me() { return (CG.user && CG.user.name) || ''; }
  function sevBadge(s) { return '<span class="cg-badge ' + s + '"><span class="cg-dot ' + s + '"></span>' + LBL[s] + '</span>'; }
  function isOpen(i) { return i.status !== 'resolved'; }

  function filtered() {
    var q = st.q.toLowerCase(), m = me().toLowerCase();
    var out = data.filter(function (i) {
      if (st.sev !== 'all' && i.sev !== st.sev) return false;
      if (st.status === 'open' ? !isOpen(i) : (st.status !== 'all' && i.status !== st.status)) return false;
      if (st.owner === 'none' && i.owner && !/unassigned/i.test(i.owner)) return false;
      if (st.owner === 'me' && (!m || String(i.owner).toLowerCase().indexOf(m) < 0)) return false;
      return !q || [i.ref, i.title, i.host, i.account, i.mitre, i.cat, i.src, i.owner].join(' ').toLowerCase().indexOf(q) !== -1;
    });
    var k = st.sort, d = st.dir;
    out.sort(function (a, b) {
      var r;
      if (k === 'sev') r = RANK[a.sev] - RANK[b.sev] || b.created - a.created;
      else if (k === 'created') r = a.created - b.created;
      else r = String(a[k] || '').localeCompare(String(b[k] || ''));
      return r * d;
    });
    return out;
  }

  function paintStats() {
    var open = data.filter(isOpen), s = CG.stats(data);
    CG.count($('kOpen'), s.open); CG.count($('kCrit'), s.bySev.critical);
    CG.count($('kUnassigned'), open.filter(function (i) { return !i.owner || /unassigned/i.test(i.owner); }).length);
    $('kMttr').textContent = s.mttr ? s.mttr + ' min' : '—';
    // 14-day bars
    var days = [], now = new Date(); now.setHours(0, 0, 0, 0);
    for (var n = 13; n >= 0; n--) days.push({ t: now.getTime() - n * 86400000, c: 0 });
    data.forEach(function (i) { for (var k = days.length - 1; k >= 0; k--) { if (i.created >= days[k].t) { days[k].c++; break; } } });
    var max = Math.max.apply(null, days.map(function (d) { return d.c; })) || 1;
    $('barDays').innerHTML = days.map(function (d, k) { return '<div class="b' + (k === 13 ? ' today' : '') + '" title="' + new Date(d.t).toDateString() + ': ' + d.c + '"><b>' + d.c + '</b><i style="height:' + Math.max(2, Math.round(d.c / max * 100)) + '%"></i><span>' + (k % 2 === 0 || k === 13 ? new Date(d.t).getDate() : '&nbsp;') + '</span></div>'; }).join('');
    // donut
    var colors = { critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#3b82f6' }, tot = s.open || 1, C = 2 * Math.PI * 46, off = 0, arcs = '';
    SEV.forEach(function (v) { var c = s.bySev[v]; if (!c) return; var len = c / tot * C; arcs += '<circle cx="60" cy="60" r="46" fill="none" stroke="' + colors[v] + '" stroke-width="16" stroke-dasharray="' + len + ' ' + (C - len) + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 60 60)"></circle>'; off += len; });
    $('donut').innerHTML = '<circle cx="60" cy="60" r="46" fill="none" stroke="#e2e8f0" stroke-width="16"></circle>' + arcs + '<text x="60" y="58" text-anchor="middle" font-size="24" font-weight="800" fill="#0a2540">' + s.open + '</text><text x="60" y="76" text-anchor="middle" font-size="10" fill="#526173">open</text>';
    $('legend').innerHTML = SEV.map(function (v) { return '<div><span class="cg-dot ' + v + '"></span>' + LBL[v] + '<b>' + s.bySev[v] + '</b></div>'; }).join('');
    // chips
    $('chips').innerHTML = ['all'].concat(SEV).map(function (v) { var n = v === 'all' ? open.length : s.bySev[v]; return '<button class="cg-chip" data-sev="' + v + '" aria-pressed="' + (st.sev === v) + '">' + (v === 'all' ? 'All open' : LBL[v]) + '<span class="n">' + n + '</span></button>'; }).join('');
  }

  function paintTable() {
    var list = filtered(), pages = Math.max(1, Math.ceil(list.length / PAGE));
    st.page = Math.min(st.page, pages);
    var from = (st.page - 1) * PAGE, view = list.slice(from, from + PAGE);
    $('rows').innerHTML = view.length ? view.map(function (i) {
      var own = i.owner && !/unassigned/i.test(i.owner) ? esc(i.owner) : '<span class="cg-muted">Unassigned</span>';
      return '<tr class="click" tabindex="0" data-id="' + esc(i.id) + '"><td>' + sevBadge(i.sev) + '</td>' +
        '<td><div class="t">' + esc(i.title) + '</div><div class="sub"><span class="cg-mono">' + esc(i.ref) + '</span>' + (i.cat ? ' · ' + esc(i.cat) : '') + '</div></td>' +
        '<td>' + esc(i.host || '—') + '<div class="sub">' + esc(i.src) + '</div></td><td>' + own + '</td><td>' + CG.ago(i.created) + '</td>' +
        '<td><span class="cg-badge ' + i.status + '">' + LBL[i.status] + '</span></td></tr>';
    }).join('') : '<tr><td colspan="6"><div class="cg-empty"><b>No incidents match</b>Try clearing a filter or searching for something else.</div></td></tr>';
    $('info').textContent = list.length ? 'Showing ' + (from + 1) + '–' + (from + view.length) + ' of ' + list.length : '';
    $('prev').disabled = st.page <= 1; $('next').disabled = st.page >= pages;
    [].forEach.call(document.querySelectorAll('th[data-sort]'), function (th) { th.querySelector('.arrow').textContent = th.getAttribute('data-sort') === st.sort ? (st.dir > 0 ? '▲' : '▼') : ''; });
  }
  function paint() { paintStats(); paintTable(); }

  function load(force) {
    return CG.incidents.list(force).then(function (res) {
      data = res.items; live = res.live;
      $('liveBadge').className = 'cg-badge ' + (live ? 'ok' : 'medium'); $('liveBadge').innerHTML = '<span class="cg-dot ' + (live ? 'ok' : 'medium') + '"></span>' + (live ? 'Live data · Dataverse' : (res.restricted ? 'No access' : 'Sample data'));
      $('updated').textContent = 'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      $('conn').style.display = live ? 'none' : 'flex'; $('connText').innerHTML = (res.restricted ? '<b>No access.</b> ' : '<b>Showing sample data.</b> ') + esc(res.reason);
      paint();
      var want = new URLSearchParams(location.search).get('open');
      if (want && !st.open) { var hit = data.filter(function (i) { return i.id === want; })[0]; if (hit) openDrawer(hit.id); }
    });
  }

  /* drawer */
  function cur() { return data.filter(function (x) { return x.id === st.open; })[0]; }
  function openDrawer(id) {
    var i = data.filter(function (x) { return x.id === id; })[0]; if (!i) return;
    st.open = id;
    $('dBadges').innerHTML = sevBadge(i.sev) + '<span class="cg-badge cg-mono">' + esc(i.ref || 'new') + '</span><span class="cg-badge ' + i.status + '">' + LBL[i.status] + '</span>';
    $('dTitle').textContent = i.title; $('dSum').textContent = i.desc || 'No description provided.';
    var rows = [['Category', i.cat], ['Technique', i.mitre], ['Host', i.host], ['Account', i.account], ['Detected by', i.src], ['Risk score', i.risk !== '' ? i.risk + ' / 100' : ''], ['Opened', CG.date(i.created) + ' (' + CG.ago(i.created) + ')']];
    $('dMeta').innerHTML = rows.filter(function (r) { return r[1]; }).map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('');
    $('dIoc').innerHTML = i.iocs.length ? i.iocs.map(function (x) { return '<li class="cg-mono" style="margin-bottom:5px;word-break:break-all">' + esc(x) + '</li>'; }).join('') : '<li style="list-style:none;margin-left:-20px;color:var(--muted)">None recorded.</li>';
    $('dTl').innerHTML = i.tl.length ? i.tl.map(function (t) { return '<li>' + (t.time ? '<time>' + esc(t.time) + '</time>' : '') + esc(t.event) + '</li>'; }).join('') : '<li>No timeline entries yet.</li>';
    $('dStatus').value = i.status; $('dOwner').value = /unassigned/i.test(i.owner) ? '' : i.owner; $('dNotes').value = i.notes || '';
    $('drawer').classList.add('show'); $('dBg').classList.add('show'); $('drawer').setAttribute('aria-hidden', 'false'); document.body.classList.add('cg-lock'); $('dClose').focus();
  }
  function closeDrawer() { $('drawer').classList.remove('show'); $('dBg').classList.remove('show'); $('drawer').setAttribute('aria-hidden', 'true'); document.body.classList.remove('cg-lock'); st.open = null; }

  /* events */
  var t; $('fQ').addEventListener('input', function (e) { clearTimeout(t); t = setTimeout(function () { st.q = e.target.value; st.page = 1; paintTable(); }, 120); });
  $('fStatus').addEventListener('change', function (e) { st.status = e.target.value; st.page = 1; paintTable(); });
  $('fOwner').addEventListener('change', function (e) { st.owner = e.target.value; st.page = 1; paintTable(); });
  $('chips').addEventListener('click', function (e) { var b = e.target.closest('.cg-chip'); if (!b) return; st.sev = b.getAttribute('data-sev'); st.page = 1; paint(); });
  $('prev').addEventListener('click', function () { st.page--; paintTable(); });
  $('next').addEventListener('click', function () { st.page++; paintTable(); });
  [].forEach.call(document.querySelectorAll('th[data-sort]'), function (th) { th.addEventListener('click', function () { var k = th.getAttribute('data-sort'); if (st.sort === k) st.dir = -st.dir; else { st.sort = k; st.dir = 1; } paintTable(); }); });
  $('rows').addEventListener('click', function (e) { var r = e.target.closest('tr[data-id]'); if (r) openDrawer(r.getAttribute('data-id')); });
  $('rows').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { var r = e.target.closest('tr[data-id]'); if (r) { e.preventDefault(); openDrawer(r.getAttribute('data-id')); } } });
  $('dClose').addEventListener('click', closeDrawer); $('dBg').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && st.open) closeDrawer(); });
  $('dMe').addEventListener('click', function () { if (me()) $('dOwner').value = me(); else CG.toast('Sign in to assign incidents to yourself'); });
  $('dCopy').addEventListener('click', function () { var i = cur(); if (i) CG.copy([i.ref + ' · ' + i.sev.toUpperCase() + ' · ' + i.status, i.title, 'Host: ' + (i.host || '-'), 'Owner: ' + (i.owner || '-'), '', i.desc].join('\n')); });
  $('dSave').addEventListener('click', function () {
    var i = cur(); if (!i) return; var btn = $('dSave'); btn.disabled = true; btn.textContent = 'Saving…';
    var patch = { status: $('dStatus').value, owner: $('dOwner').value.trim() || 'Unassigned', notes: $('dNotes').value };
    CG.incidents.update(i.id, patch).then(function () { Object.assign(i, patch); paint(); closeDrawer(); CG.toast('Saved ' + (i.ref || 'incident')); })
      .catch(function (e) { CG.toast('Could not save: ' + CG.why(e, 'incidents').split('.')[0]); })
      .then(function () { btn.disabled = false; btn.textContent = 'Save changes'; });
  });
  $('btnRefresh').addEventListener('click', function () { load(true).then(function () { CG.toast('Refreshed'); }); });
  $('btnCsv').addEventListener('click', function () {
    var rows = [['Reference', 'Severity', 'Status', 'Title', 'Category', 'Host', 'Account', 'Detected by', 'Owner', 'Opened']].concat(filtered().map(function (i) { return [i.ref, i.sev, i.status, i.title, i.cat, i.host, i.account, i.src, i.owner, new Date(i.created).toISOString()]; }));
    CG.csv('incidents.csv', rows); CG.toast('Exported ' + (rows.length - 1) + ' incidents');
  });
  var dlg = $('newDlg');
  $('btnNew').addEventListener('click', function () { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); $('nTitle').focus(); });
  $('nCancel').addEventListener('click', function () { dlg.close ? dlg.close() : dlg.removeAttribute('open'); });
  $('newForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var title = $('nTitle').value.trim(); $('nTitleF').classList.toggle('bad', !title); if (!title) { $('nTitle').focus(); return; }
    var go = $('nGo'); go.disabled = true; go.textContent = 'Logging…';
    CG.incidents.create({ title: title, sev: (document.querySelector('input[name=nSev]:checked') || {}).value || 'medium', host: $('nHost').value.trim(), src: $('nSrc').value, desc: $('nDesc').value.trim(), status: 'new', owner: 'Unassigned' })
      .then(function (r) { dlg.close ? dlg.close() : dlg.removeAttribute('open'); $('newForm').reset(); st.status = 'open'; $('fStatus').value = 'open'; return load(true).then(function () { CG.toast('Logged ' + (r.item.ref || 'incident') + (r.live ? '' : ' (sample mode)')); }); })
      .catch(function (err) { CG.toast('Could not log incident: ' + CG.why(err, 'incidents').split('.')[0]); })
      .then(function () { go.disabled = false; go.textContent = 'Log incident'; });
  });
  load(); setInterval(function () { if (!document.hidden && !st.open) load(true); }, 60000);
})();
