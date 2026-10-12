/* Dashboard: severity tabs (counts double as filters), search and filters, sortable table, detail panel, log dialog.
   Data: Dataverse table cg_incident through CG.incidents (Header web template). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  if (!$('rows') || !window.CG) return;
  var esc = CG.esc, PAGE = 15, data = [], live = false, restricted = false, lastFocus = null;
  var st = { sev: 'all', status: 'open', owner: 'all', q: '', page: 1, sort: 'sev', dir: 1, open: null };
  var qs = new URLSearchParams(location.search);
  if (CG.RANK.hasOwnProperty(qs.get('sev'))) st.sev = qs.get('sev');

  function me() { return (CG.user && CG.user.name) || ''; }
  function isOpen(i) { return i.status !== 'resolved'; }
  function owner(i) { return CG.isUnassigned(i) ? '' : i.owner; }

  function filtered() {
    var q = st.q.toLowerCase(), m = me().toLowerCase();
    var out = data.filter(function (i) {
      if (st.sev !== 'all' && i.sev !== st.sev) return false;
      if (st.status === 'open' ? !isOpen(i) : (st.status !== 'all' && i.status !== st.status)) return false;
      if (st.owner === 'none' && !CG.isUnassigned(i)) return false;
      if (st.owner === 'me' && (!m || String(i.owner).toLowerCase().indexOf(m) < 0)) return false;
      return !q || [i.ref, i.title, i.host, i.account, i.mitre, i.cat, i.src, i.owner].join(' ').toLowerCase().indexOf(q) !== -1;
    });
    var k = st.sort, d = st.dir;
    out.sort(function (a, b) {
      var r;
      if (k === 'sev') r = CG.RANK[a.sev] - CG.RANK[b.sev] || b.created - a.created;
      else if (k === 'created') r = b.created - a.created;
      else if (k === 'owner') r = owner(a).localeCompare(owner(b));
      else r = String(a[k] || '').localeCompare(String(b[k] || ''));
      return r * d;
    });
    return out;
  }

  function paintTabs() {
    var s = CG.stats(data);
    $('tabs').innerHTML = ['all'].concat(CG.SEV).map(function (v) {
      var n = v === 'all' ? s.open : s.bySev[v];
      return '<button type="button" class="' + (v === 'critical' ? 'crit' : '') + '" data-sev="' + v + '" aria-pressed="' + (st.sev === v) + '"><span>' + (v === 'all' ? 'All open' : CG.LBL[v]) + '</span><b class="' + (v === 'critical' && n > 0 ? 'hot' : '') + '">' + n + '</b></button>';
    }).join('');
  }

  function paintTable() {
    var list = filtered(), pages = Math.max(1, Math.ceil(list.length / PAGE));
    st.page = Math.max(1, Math.min(st.page, pages));
    var from = (st.page - 1) * PAGE, view = list.slice(from, from + PAGE);
    $('rows').innerHTML = view.length ? view.map(function (i) {
      return '<tr class="click" tabindex="0" data-id="' + esc(i.id) + '" aria-label="' + esc(CG.LBL[i.sev] + ': ' + i.title) + '">' +
        '<td class="bar ' + esc(i.sev) + '">' + CG.sevTag(i.sev) + '</td>' +
        '<td><div class="t">' + esc(i.title) + '</div><div class="s">' + esc([i.ref, i.cat].filter(Boolean).join(', ')) + '</div></td>' +
        '<td data-label="Asset">' + esc(i.host || '—') + (i.src ? '<div class="s">' + esc(i.src) + '</div>' : '') + '</td>' +
        '<td data-label="Owner">' + (owner(i) ? esc(i.owner) : '<span class="ld-muted">No owner</span>') + '</td>' +
        '<td data-label="Opened"><span title="' + esc(CG.date(i.created)) + '">' + CG.ago(i.created) + '</span></td>' +
        '<td>' + CG.statusTag(i.status) + '</td></tr>';
    }).join('') : '<tr><td colspan="6"><div class="ld-empty">' + (restricted ? (CG.incidents.last && CG.incidents.last.failed ? 'Nothing to show until incidents load.' : 'Incidents appear here once your account has access.') : data.length ? '<b>No incidents match</b>Clear the search or choose another filter.' : '<b>No incidents yet</b>Use Report incident to add the first one.') + '</div></td></tr>';
    $('info').textContent = list.length ? 'Showing ' + (from + 1) + '–' + (from + view.length) + ' of ' + list.length : '';
    $('prev').disabled = st.page <= 1; $('next').disabled = st.page >= pages;
    $('prev').hidden = $('next').hidden = pages <= 1;
    [].forEach.call(document.querySelectorAll('th[data-sort]'), function (th) {
      var k = th.getAttribute('data-sort'), asc = k === 'created' ? st.dir < 0 : st.dir > 0;
      if (k === st.sort) th.setAttribute('aria-sort', asc ? 'ascending' : 'descending'); else th.removeAttribute('aria-sort');
    });
  }
  function paint() { paintTabs(); paintTable(); }

  function load(force) {
    return CG.incidents.list(force).then(function (res) {
      data = res.items; live = res.live; restricted = !!(res.restricted || res.failed);
      var t = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      var bad = !!(res.restricted || res.failed);
      $('source').textContent = res.live ? 'Live from Dataverse. Updated ' + t + '.' : res.restricted ? 'No access.' : res.failed ? 'Not loaded.' : 'Sample data. Updated ' + t + '.';
      $('conn').hidden = live; $('conn').className = 'ld-note' + (bad ? ' warn' : '');
      $('connText').innerHTML = res.restricted
        ? '<b>No access to incidents.</b> ' + esc(res.reason) + ' <a href="/contact-us/?topic=Dashboard%20access">Ask for access</a>'
        : res.failed ? '<b>Incidents couldn’t be loaded.</b> ' + esc(res.reason) + ' If something is urgent, call ' + CG.hotline + '.'
        : '<b>Showing sample data.</b> ' + esc(res.reason) + ' Changes you make here stay in this browser.';
      $('btnCsv').disabled = bad; /* everyone who signs in may report, so Report incident stays enabled */
      paint();
      var want = qs.get('open');
      if (want && !st.open) { qs.delete('open'); try { history.replaceState(null, '', location.pathname + (qs.toString() ? '?' + qs : '') + location.hash); } catch (e) {} var hit = data.filter(function (i) { return i.id === want; })[0]; if (hit) openDrawer(hit.id); }
    });
  }

  /* detail panel */
  function cur() { return data.filter(function (x) { return x.id === st.open; })[0]; }
  function openDrawer(id) {
    var i = data.filter(function (x) { return x.id === id; })[0]; if (!i) return;
    lastFocus = document.activeElement; st.open = id;
    $('dTags').innerHTML = CG.sevTag(i.sev) + CG.statusTag(i.status) + (i.ref ? '<span class="ref">' + esc(i.ref) + '</span>' : '');
    $('dTitle').textContent = i.title; $('dDesc').textContent = i.desc || 'No description yet.';
    var rows = [['Asset', i.host], ['Account', i.account], ['Category', i.cat], ['Technique', i.mitre], ['Detected by', i.src], ['Risk score', i.risk !== '' && i.risk != null ? i.risk + ' of 100' : ''], ['Opened', CG.date(i.created) + ', ' + CG.ago(i.created)]];
    $('dMeta').innerHTML = rows.filter(function (r) { return r[1]; }).map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('');
    $('dIoc').innerHTML = i.iocs.length ? i.iocs.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') : '<li style="background:none;padding:0;font-family:inherit;color:var(--mute)">None recorded.</li>';
    $('dTl').innerHTML = i.tl.length ? i.tl.map(function (t) { return '<li>' + (t.time ? '<time>' + esc(t.time) + '</time>' : '') + esc(t.event) + '</li>'; }).join('') : '<li>No entries yet.</li>';
    $('dStatus').value = i.status; $('dOwner').value = owner(i); $('dNotes').value = i.notes || '';
    $('drawer').classList.add('is-open'); $('dBg').classList.add('is-open'); $('drawer').setAttribute('aria-hidden', 'false'); document.body.classList.add('ld-lock');
    $('drawer').querySelector('.body').scrollTop = 0;
    setTimeout(function () { $('dClose').focus(); }, 30);
  }
  function closeDrawer() {
    $('drawer').classList.remove('is-open'); $('dBg').classList.remove('is-open'); $('drawer').setAttribute('aria-hidden', 'true'); document.body.classList.remove('ld-lock'); st.open = null;
    if (lastFocus && document.body.contains(lastFocus)) lastFocus.focus();
  }
  $('drawer').addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var f = [].filter.call($('drawer').querySelectorAll('button,input,select,textarea,a[href]'), function (x) { return !x.disabled && x.offsetParent !== null; });
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });

  /* events */
  var tmr; $('fQ').addEventListener('input', function (e) { clearTimeout(tmr); tmr = setTimeout(function () { st.q = e.target.value.trim(); st.page = 1; paintTable(); }, 120); });
  $('fStatus').addEventListener('change', function (e) { st.status = e.target.value; st.page = 1; paintTable(); });
  $('fOwner').addEventListener('change', function (e) { st.owner = e.target.value; st.page = 1; paintTable(); });
  $('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-sev]'); if (!b) return;
    st.sev = b.getAttribute('data-sev'); st.page = 1;
    if (st.status === 'resolved') { st.status = 'open'; $('fStatus').value = 'open'; }
    paint(); var nb = $('tabs').querySelector('[data-sev="' + st.sev + '"]'); if (nb) nb.focus();
  });
  $('prev').addEventListener('click', function () { st.page--; paintTable(); });
  $('next').addEventListener('click', function () { st.page++; paintTable(); });
  [].forEach.call(document.querySelectorAll('th[data-sort] button'), function (b) {
    b.addEventListener('click', function () { var k = b.parentNode.getAttribute('data-sort'); if (st.sort === k) st.dir = -st.dir; else { st.sort = k; st.dir = 1; } paintTable(); });
  });
  $('rows').addEventListener('click', function (e) { var r = e.target.closest('tr[data-id]'); if (r) openDrawer(r.getAttribute('data-id')); });
  $('rows').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { var r = e.target.closest('tr[data-id]'); if (r) { e.preventDefault(); openDrawer(r.getAttribute('data-id')); } } });
  $('dClose').addEventListener('click', closeDrawer); $('dBg').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && st.open && !document.getElementById('ldPal').classList.contains('is-open')) closeDrawer(); });
  $('dMe').addEventListener('click', function () { if (me()) { $('dOwner').value = me(); $('dOwner').focus(); } else CG.toast('Sign in to assign incidents to yourself'); });
  $('dCopy').addEventListener('click', function () {
    var i = cur(); if (!i) return;
    CG.copy([(i.ref ? i.ref + ' ' : '') + '[' + CG.LBL[i.sev] + ', ' + CG.LBL[i.status] + ']', i.title, 'Asset: ' + (i.host || '-'), 'Owner: ' + (owner(i) || '-'), '', i.desc].join('\n'));
  });
  $('dSave').addEventListener('click', function () {
    var i = cur(); if (!i) return; var btn = $('dSave'); btn.disabled = true; btn.textContent = 'Saving…';
    var patch = { status: $('dStatus').value, owner: $('dOwner').value.trim(), notes: $('dNotes').value.trim() };
    CG.incidents.update(i.id, patch).then(function () { Object.assign(i, patch); paint(); closeDrawer(); CG.toast('Saved ' + (i.ref || 'incident')); })
      .catch(function (e) { CG.toast('Not saved. ' + CG.why(e, 'incidents')); })
      .then(function () { btn.disabled = false; btn.textContent = 'Save changes'; });
  });
  $('btnRefresh').addEventListener('click', function () { load(true).then(function () { CG.toast('Up to date'); }); });
  $('btnCsv').addEventListener('click', function () {
    var list = filtered();
    var rows = [['Reference', 'Severity', 'Status', 'Title', 'Category', 'Asset', 'Account', 'Detected by', 'Owner', 'Opened']].concat(list.map(function (i) { return [i.ref, CG.LBL[i.sev], CG.LBL[i.status] || i.status, i.title, i.cat, i.host, i.account, i.src, owner(i), new Date(i.created).toISOString()]; }));
    CG.csv('incidents-' + new Date().toISOString().slice(0, 10) + '.csv', rows); CG.toast('Exported ' + CG.plural(list.length, 'incident'));
  });

  /* log dialog */
  var dlg = $('newDlg');
  function closeDlg() { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
  $('btnNew').addEventListener('click', function () { $('nTitleF').classList.remove('bad'); if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); setTimeout(function () { $('nTitle').focus(); }, 20); });
  $('nCancel').addEventListener('click', closeDlg);
  $('nTitle').addEventListener('input', function () { $('nTitleF').classList.remove('bad'); });
  $('newForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var title = $('nTitle').value.trim(); $('nTitleF').classList.toggle('bad', !title); if (!title) { $('nTitle').focus(); return; }
    var go = $('nGo'); go.disabled = true; go.textContent = 'Sending…';
    CG.incidents.create({ title: title, sev: (document.querySelector('input[name=nSev]:checked') || {}).value || 'medium', host: $('nHost').value.trim(), cat: $('nCat').value, src: $('nSrc').value, desc: $('nDesc').value.trim(), status: 'new' })
      .then(function (r) {
        closeDlg(); $('newForm').reset(); st.status = 'open'; $('fStatus').value = 'open'; st.sev = 'all';
        return load(true).then(function () { CG.toast('Reported ' + (r.item.ref || 'incident') + (r.live ? '' : ' (sample data, this browser only)')); });
      })
      .catch(function (err) { CG.toast('Not sent. ' + CG.why(err, 'incidents')); })
      .then(function () { go.disabled = false; go.textContent = 'Report incident'; });
  });

  load();
  /* refresh every minute, but never while someone is using the table, filters or a panel */
  setInterval(function () {
    var a = document.activeElement, busy = a && a !== document.body && (a.closest('.ld-tablewrap,#tabs,.ld-toolbar,.ld-pager') || a.closest('#drawer'));
    if (!document.hidden && !st.open && !dlg.open && !busy) load(true);
  }, 60000);
})();
