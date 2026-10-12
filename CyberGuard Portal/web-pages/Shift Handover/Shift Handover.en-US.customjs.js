/* Shift handover: latest handover, history, write form. Data: Dataverse table cg_handover through CG.handovers (Header template). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  if (!$('hoForm') || !window.CG) return;
  var esc = CG.esc, items = [];

  function lines(s) { return String(s || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function block(label, text) {
    var l = lines(text);
    if (!l.length) return '<div class="blk"><h3>' + label + '</h3><p class="ld-muted">Nothing noted.</p></div>';
    return '<div class="blk"><h3>' + label + '</h3>' + (l.length > 1 ? '<ul>' + l.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '<p>' + esc(l[0]) + '</p>') + '</div>';
  }
  function meta(h) { return esc(h.title || 'Shift') + ' by ' + esc(h.author || 'unknown') + (h.to ? ' to ' + esc(h.to) : '') + ', <span title="' + esc(CG.date(h.created)) + '">' + CG.ago(h.created) + '</span>'; }

  function paint(res) {
    items = res.items.slice().sort(function (a, b) { return b.created - a.created; });
    var t = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), bad = !!(res.restricted || res.failed);
    $('hoSource').textContent = res.live ? 'Live from Dataverse. Updated ' + t + '.' : res.restricted ? 'No access.' : res.failed ? 'Not loaded.' : 'Sample data.';
    $('hoConn').hidden = res.live; $('hoConn').className = 'ld-note' + (bad ? ' warn' : '');
    $('hoConnText').innerHTML = res.restricted ? '<b>No access to handovers.</b> ' + esc(res.reason) : res.failed ? '<b>Handovers couldn’t be loaded.</b> ' + esc(res.reason) : '<b>Showing sample data.</b> ' + esc(res.reason) + ' New handovers stay in this browser.';
    var h = items[0];
    $('latest').innerHTML = h ? '<p class="ld-small ld-muted">Latest handover</p><p class="who">' + meta(h) + '</p><div class="cols">' + block('What happened', h.summary) + block('Still open', h.open) + block('Keep an eye on', h.watch) + '</div>'
      : '<div class="ld-empty"><b>No handover yet</b>' + (bad ? 'Handovers appear here once they can be loaded.' : 'Write the first one below.') + '</div>';
    var rest = items.slice(1);
    $('hoCount').textContent = rest.length ? CG.plural(rest.length, 'handover') : '';
    $('history').innerHTML = rest.length ? rest.map(function (x) {
      return '<details><summary><span class="q">' + esc(x.title || 'Shift') + ', ' + esc(x.author || 'unknown') + '<small>' + esc(CG.date(x.created)) + '</small></span></summary><div class="ans ld-ho">' + (x.to ? '<p class="ld-small ld-muted">Handed over to ' + esc(x.to) + '</p>' : '') + '<div class="cols one">' + block('What happened', x.summary) + block('Still open', x.open) + block('Keep an eye on', x.watch) + '</div></div></details>';
    }).join('') : '<p class="ld-muted" style="padding:16px 0">Earlier handovers will appear here.</p>';
  }
  function load() { return CG.handovers.list().then(paint); }

  /* default shift from the time of day */
  var hr = new Date().getHours(), def = (new Date().getDay() % 6 === 0) ? 'Weekend shift' : (hr >= 7 && hr < 19 ? 'Day shift' : 'Night shift');
  var radio = document.querySelector('input[name=hoShift][value="' + def + '"]'); if (radio) radio.checked = true;

  $('hoAddOpen').addEventListener('click', function () {
    var b = this; b.disabled = true;
    CG.incidents.list(true).then(function (r) {
      b.disabled = false;
      if (r.restricted) { CG.toast('You need the SOC Analyst role to read incidents'); return; }
      if (r.failed) { CG.toast('Incidents couldn’t be loaded. ' + r.reason); return; }
      var open = r.items.filter(function (i) { return i.status !== 'resolved'; }).sort(function (a, c) { return CG.RANK[a.sev] - CG.RANK[c.sev]; });
      if (!open.length) { CG.toast('No open incidents'); return; }
      var add = open.map(function (i) { return (i.ref ? i.ref + ' ' : '') + CG.LBL[i.sev] + ': ' + i.title + (CG.isUnassigned(i) ? ' (no owner)' : ', ' + i.owner) + ', ' + (CG.LBL[i.status] || i.status).toLowerCase() + '.'; }).join('\n');
      var ta = $('hoOpen'); ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '') + add; ta.focus();
      CG.toast('Added ' + CG.plural(open.length, 'open incident'));
    });
  });
  $('hoSum').addEventListener('input', function () { $('hoSumF').classList.remove('bad'); });
  $('hoForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var sum = $('hoSum').value.trim(); $('hoSumF').classList.toggle('bad', !sum); if (!sum) { $('hoSum').focus(); return; }
    var btn = $('hoGo'), ok = $('hoOk'); btn.disabled = true; btn.textContent = 'Saving…'; ok.className = 'ld-note ld-result';
    var o = { title: (document.querySelector('input[name=hoShift]:checked') || {}).value || 'Shift', to: $('hoTo').value.trim(), summary: sum, open: $('hoOpen').value.trim(), watch: $('hoWatch').value.trim(), author: CG.user.name || CG.user.email || 'Unknown' };
    CG.handovers.create(o).then(function (r) {
      ok.innerHTML = '<div><b>Handover saved.</b> ' + (r.live ? 'The next shift will see it at the top of this page and on Home.' : 'Sample data mode: it is saved in this browser only.') + '</div>';
      ok.className = 'ld-note ld-result ok is-open'; $('hoForm').reset(); if (radio) radio.checked = true; CG.toast('Handover saved');
      return load().then(function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    }, function (err) {
      ok.innerHTML = '<div><b>The handover was not saved.</b> ' + esc(CG.why(err, 'handovers')) + ' Copy your text somewhere safe before leaving this page.</div>';
      ok.className = 'ld-note ld-result warn is-open';
    }).then(function () { btn.disabled = false; btn.textContent = 'Save handover'; });
  });
  load();
})();
