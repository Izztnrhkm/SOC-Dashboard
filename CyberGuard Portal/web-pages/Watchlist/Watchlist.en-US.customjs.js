/* Watchlist: indicators to block or monitor. Data: Dataverse table cg_indicator through CG.indicators (Header template). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  if (!$('wRows') || !window.CG) return;
  var esc = CG.esc, data = [], st = { act: 'active', type: 'all', q: '' }, live = false, armed = null, armT;
  var TYPES = ['IP address', 'Domain', 'URL', 'File hash', 'Email address'];

  /* recognise what kind of indicator a value is */
  CG.iocType = function (v) {
    v = String(v || '').trim();
    if (/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(v) && v.split('/')[0].split('.').every(function (n) { return +n <= 255; })) return 'IP address';
    if (/^[0-9a-f:]+$/i.test(v) && v.indexOf(':') > -1 && v.split(':').length > 2) return 'IP address';
    if (/^[a-f0-9]{32}$|^[a-f0-9]{40}$|^[a-f0-9]{64}$/i.test(v)) return 'File hash';
    if (/^https?:\/\//i.test(v)) return 'URL';
    if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v)) return 'Email address';
    if (/^(?=.{3,253}$)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/i.test(v)) return 'Domain';
    return '';
  };
  function expired(i) { return i.expires && Date.parse(i.expires) < Date.now(); }
  function active(i) { return !expired(i); }
  function filtered() {
    var q = st.q.toLowerCase();
    return data.filter(function (i) {
      if (st.act === 'active' && !active(i)) return false;
      if (st.act === 'Block' && !(active(i) && i.action === 'Block')) return false;
      if (st.act === 'Monitor' && !(active(i) && i.action === 'Monitor')) return false;
      if (st.act === 'expired' && !expired(i)) return false;
      if (st.type !== 'all' && i.type !== st.type) return false;
      return !q || [i.value, i.reason, i.incident, i.by, i.type].join(' ').toLowerCase().indexOf(q) > -1;
    }).sort(function (a, b) { return b.created - a.created; });
  }
  function paintTabs() {
    var c = { active: 0, Block: 0, Monitor: 0, expired: 0 };
    data.forEach(function (i) { if (expired(i)) c.expired++; else { c.active++; if (c[i.action] != null) c[i.action]++; } });
    $('wTabs').innerHTML = [['active', 'Active'], ['Block', 'Block'], ['Monitor', 'Monitor'], ['expired', 'Expired']].map(function (t) {
      return '<button type="button" data-act="' + t[0] + '" aria-pressed="' + (st.act === t[0]) + '"><span>' + t[1] + '</span><b>' + c[t[0]] + '</b></button>';
    }).join('');
  }
  function when(iso) { if (!iso) return 'Never'; var t = Date.parse(iso); return isNaN(t) ? '—' : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function paintRows() {
    armed = null; clearTimeout(armT);
    var list = filtered();
    $('wRows').innerHTML = list.length ? list.map(function (i) {
      var ex = expired(i);
      return '<tr class="' + (ex ? 'is-expired' : '') + '"><td><div class="ld-ioc">' + esc(i.value) + '</div>' + (i.reason || i.incident ? '<div class="s">' + esc(i.reason) + (i.incident ? (i.reason ? ' ' : '') + '<span class="ld-nowrap">(' + esc(i.incident) + ')</span>' : '') + '</div>' : '') + '</td>' +
        '<td data-label="Type">' + esc(i.type || '—') + '</td>' +
        '<td data-label="Action"><span class="ld-act ' + (i.action === 'Block' ? 'block' : 'monitor') + '">' + esc(i.action || 'Monitor') + '</span></td>' +
        '<td data-label="Added">' + esc(i.by || '—') + '<div class="s">' + CG.ago(i.created) + '</div></td>' +
        '<td data-label="Expires">' + (ex ? '<span class="ld-muted">Expired ' + esc(when(i.expires)) + '</span>' : esc(when(i.expires))) + '</td>' +
        '<td class="ld-right"><button class="ld-btn sm quiet" type="button" data-copyval="' + esc(i.value) + '" aria-label="Copy ' + esc(i.value) + '">Copy</button><button class="ld-btn sm quiet" type="button" data-del="' + esc(i.id) + '" aria-label="Remove ' + esc(i.value) + '">Remove</button></td></tr>';
    }).join('') : '<tr><td colspan="6"><div class="ld-empty">' + (data.length ? '<b>Nothing matches</b>Clear the search or choose another filter.' : '<b>The watchlist is empty</b>Use Add indicator to add the first one.') + '</div></td></tr>';
    $('wInfo').textContent = list.length ? CG.plural(list.length, 'indicator') : '';
  }
  function paint() { paintTabs(); paintRows(); }
  function load() {
    return CG.indicators.list().then(function (res) {
      data = res.items; live = res.live;
      var t = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), bad = !!(res.restricted || res.failed);
      $('wSource').textContent = res.live ? 'Live from Dataverse. Updated ' + t + '.' : res.restricted ? 'No access.' : res.failed ? 'Not loaded.' : 'Sample data.';
      $('wConn').hidden = res.live; $('wConn').className = 'ld-note' + (bad ? ' warn' : '');
      $('wConnText').innerHTML = res.restricted ? '<b>No access to the watchlist.</b> ' + esc(res.reason) : res.failed ? '<b>The watchlist couldn’t be loaded.</b> ' + esc(res.reason) : '<b>Showing sample data.</b> ' + esc(res.reason) + ' Changes stay in this browser.';
      $('wNew').disabled = $('wCsv').disabled = $('wCopy').disabled = bad;
      paint();
    });
  }

  $('wTabs').addEventListener('click', function (e) { var b = e.target.closest('button[data-act]'); if (!b) return; st.act = b.getAttribute('data-act'); paint(); var nb = $('wTabs').querySelector('[data-act="' + st.act + '"]'); if (nb) nb.focus(); });
  var tmr; $('wQ').addEventListener('input', function (e) { clearTimeout(tmr); tmr = setTimeout(function () { st.q = e.target.value.trim(); paintRows(); }, 120); });
  $('wType').addEventListener('change', function (e) { st.type = e.target.value; paintRows(); });
  $('wRows').addEventListener('click', function (e) {
    var c = e.target.closest('[data-copyval]'); if (c) { CG.copy(c.getAttribute('data-copyval')); return; }
    var d = e.target.closest('[data-del]'); if (!d) return;
    var id = d.getAttribute('data-del');
    if (armed !== id) { /* two-step remove: first click asks, second click removes */
      [].forEach.call(document.querySelectorAll('[data-del]'), function (x) { x.textContent = 'Remove'; x.classList.remove('confirm'); });
      armed = id; d.textContent = 'Confirm remove'; d.classList.add('confirm'); clearTimeout(armT);
      armT = setTimeout(function () { armed = null; d.textContent = 'Remove'; d.classList.remove('confirm'); }, 4000); return;
    }
    armed = null; d.disabled = true; d.textContent = 'Removing…';
    var item = data.filter(function (x) { return x.id === id; })[0];
    CG.indicators.remove(id).then(function () { data = data.filter(function (x) { return x.id !== id; }); paint(); CG.toast('Removed ' + (item ? item.value : 'indicator')); },
      function (err) { d.disabled = false; d.textContent = 'Remove'; CG.toast('Not removed. ' + CG.why(err, 'the watchlist')); });
  });
  $('wCopy').addEventListener('click', function () {
    var vals = data.filter(function (i) { return active(i) && i.action === 'Block' && (st.type === 'all' || i.type === st.type); }).map(function (i) { return i.value; });
    if (!vals.length) { CG.toast('Nothing to copy'); return; }
    CG.copy(vals.join('\n'), 'Copied ' + CG.plural(vals.length, 'value') + (st.type === 'all' ? '' : ' (' + st.type + ')'));
  });
  $('wCsv').addEventListener('click', function () {
    var list = filtered();
    CG.csv('watchlist-' + new Date().toISOString().slice(0, 10) + '.csv', [['Indicator', 'Type', 'Action', 'Reason', 'Incident', 'Added by', 'Added', 'Expires']].concat(list.map(function (i) { return [i.value, i.type, i.action, i.reason, i.incident, i.by, new Date(i.created).toISOString(), i.expires || '']; })));
    CG.toast('Exported ' + CG.plural(list.length, 'indicator'));
  });

  /* add dialog */
  var dlg = $('wDlg');
  /* accepts defanged values such as hxxps://bad[.]example or user[@]bad[.]example, and removes repeats */
  function refang(x) { return x.trim().replace(/^hxxp(s?)/i, 'http$1').replace(/\[\.\]|\(\.\)|\{\.\}/g, '.').replace(/\[:\]/g, ':').replace(/\[@\]|\(@\)/g, '@'); }
  function vals() { var seen = {}; return $('wVal').value.split(/\r?\n/).map(refang).filter(function (x) { var k = x.toLowerCase(); if (!x || seen[k]) return false; seen[k] = 1; return true; }); }
  function detect() {
    var v = vals(), unknown = v.filter(function (x) { return !CG.iocType(x); });
    var dupes = v.filter(function (x) { return data.some(function (i) { return active(i) && i.value.toLowerCase() === x.toLowerCase(); }); });
    var parts = [];
    if (v.length) { var by = {}; v.forEach(function (x) { var t = CG.iocType(x) || 'Unrecognised'; by[t] = (by[t] || 0) + 1; }); parts.push(Object.keys(by).map(function (k) { return by[k] + ' ' + k.toLowerCase(); }).join(', ')); }
    if (dupes.length) parts.push(dupes.length + (dupes.length === 1 ? ' is' : ' are') + ' already on the watchlist and will be skipped');
    $('wDetect').textContent = parts.join('. ') + (parts.length ? '.' : '');
    return { v: v, unknown: unknown, dupes: dupes };
  }
  $('wVal').addEventListener('input', function () { $('wValF').classList.remove('bad'); detect(); });
  $('wWhy').addEventListener('input', function () { $('wWhyF').classList.remove('bad'); });
  $('wNew').addEventListener('click', function () { $('wForm').reset(); detect(); $('wValF').classList.remove('bad'); $('wWhyF').classList.remove('bad'); if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); setTimeout(function () { $('wVal').focus(); }, 20); });
  function closeDlg() { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
  $('wCancel').addEventListener('click', closeDlg);
  $('wForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var r = detect(), why = $('wWhy').value.trim();
    var add = r.v.filter(function (x) { return r.dupes.indexOf(x) < 0; });
    var long = r.v.filter(function (x) { return x.length > 850; });
    var badVal = !r.v.length || r.unknown.length > 0 || long.length > 0;
    $('wValErr').textContent = !r.v.length ? 'Add at least one indicator.' : long.length ? 'Too long: indicators can be up to 850 characters. Shorten long URLs to the domain and path.' : r.unknown.length ? 'Not recognised: ' + r.unknown.slice(0, 3).join(', ') + '. Use an IP address, domain, URL, file hash (MD5, SHA-1, SHA-256) or email address.' : '';
    $('wValF').classList.toggle('bad', badVal); $('wWhyF').classList.toggle('bad', !why);
    if (badVal) { $('wVal').focus(); return; } if (!why) { $('wWhy').focus(); return; }
    if (!add.length) { closeDlg(); CG.toast('All of these are already on the watchlist'); return; }
    var days = +$('wExp').value, exp = days ? new Date(Date.now() + days * 86400000).toISOString() : '';
    var act = (document.querySelector('input[name=wAct]:checked') || {}).value || 'Block';
    var go = $('wGo'); go.disabled = true; go.textContent = 'Adding…';
    var done = 0, failed = null;
    add.reduce(function (p, v) {
      return p.then(function () {
        if (failed) return;
        return CG.indicators.create({ value: v, type: CG.iocType(v), action: act, reason: why, expires: exp, by: CG.user.name || CG.user.email || 'Unknown', incident: $('wInc').value.trim() }).then(function () { done++; }, function (err) { failed = err; });
      });
    }, Promise.resolve()).then(function () {
      go.disabled = false; go.textContent = 'Add to watchlist';
      if (failed && !done) { CG.toast('Not added. ' + CG.why(failed, 'the watchlist')); return; }
      closeDlg(); st.act = 'active';
      return load().then(function () { CG.toast('Added ' + CG.plural(done, 'indicator') + (failed ? '; some failed, try again' : '') + (r.dupes.length ? ', skipped ' + r.dupes.length + ' already listed' : '')); });
    });
  });
  load();
})();
