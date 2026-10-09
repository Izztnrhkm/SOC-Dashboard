/* Incident response — playbook progress (saved on this device), scrollspy, severity picker, report form -> Dataverse */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'cg_playbook_progress', state = {};
  try { state = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  function paint(pb) {
    var boxes = pb.querySelectorAll('input[data-k]'), n = 0;
    [].forEach.call(boxes, function (c) { if (c.checked) n++; });
    pb.querySelector('.pgn').textContent = n;
    pb.querySelector('.cg-progress i').style.width = (boxes.length ? Math.round(n / boxes.length * 100) : 0) + '%';
  }
  [].forEach.call(document.querySelectorAll('.cg-pb'), function (pb) {
    [].forEach.call(pb.querySelectorAll('input[data-k]'), function (c) {
      c.checked = !!state[c.dataset.k];
      c.addEventListener('change', function () { state[c.dataset.k] = c.checked; save(); paint(pb); });
    });
    paint(pb);
  });
  document.addEventListener('click', function (e) {
    var r = e.target.closest && e.target.closest('[data-reset]');
    if (r) { var pb = $('pb-' + r.getAttribute('data-reset')); [].forEach.call(pb.querySelectorAll('input[data-k]'), function (c) { c.checked = false; delete state[c.dataset.k]; }); save(); paint(pb); if (window.CG) CG.toast('Checklist reset'); }
    if (e.target.closest && e.target.closest('[data-print]')) window.print();
  });
  function setAll(open) { [].forEach.call(document.querySelectorAll('.cg-pb'), function (d) { d.open = open; }); }
  $('pbOpen').addEventListener('click', function () { setAll(true); });
  $('pbClose').addEventListener('click', function () { setAll(false); });
  if (/^#pb-/.test(location.hash)) { var t = document.querySelector(location.hash); if (t) t.open = true; }
  else if (location.hash === '#playbooks') { var d = document.querySelector('.cg-pb'); if (d) d.open = true; }

  /* sticky nav highlight */
  var links = [].slice.call(document.querySelectorAll('#pageNav a')), secs = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  function spy() {
    var y = window.scrollY + 140, cur = 0;
    secs.forEach(function (s, i) { if (s && s.offsetTop <= y) cur = i; });
    links.forEach(function (a, i) { a.classList.toggle('on', i === cur); });
  }
  window.addEventListener('scroll', spy, { passive: true }); spy();

  /* severity rows pre-select the form */
  [].forEach.call(document.querySelectorAll('[data-pick]'), function (row) {
    row.addEventListener('click', function () {
      var r = document.querySelector('input[name="irSev"][value="' + row.dataset.pick + '"]'); if (r) r.checked = true;
      $('report').scrollIntoView({ behavior: 'smooth' }); setTimeout(function () { $('irTitle').focus(); }, 500);
    });
  });
  if (/[?&]report=/.test(location.search)) setTimeout(function () { $('report').scrollIntoView(); }, 50);

  /* report form */
  var f = $('irForm'); if (!f) return;
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var t = $('irTitle'), fld = t.closest('.cg-field'), ok = $('irOk');
    if (!t.value.trim()) { fld.classList.add('bad'); t.focus(); return; }
    fld.classList.remove('bad');
    var btn = $('irGo'); btn.disabled = true; btn.textContent = 'Submitting…'; ok.className = 'cg-ok';
    var sev = (document.querySelector('input[name="irSev"]:checked') || {}).value || 'medium';
    CG.incidents.create({ title: t.value.trim(), sev: sev, status: 'new', host: $('irHost').value.trim(), cat: $('irCat').value, desc: $('irDesc').value.trim(), src: 'Portal report' }).then(function (r) {
      var ref = r.item && r.item.ref;
      ok.innerHTML = '<b>Report received' + (ref ? ' as ' + CG.esc(ref) : '') + '.</b> ' + (r.live ? 'It is now in the SOC queue.' : 'Preview mode: it is kept on this device and shown on the dashboard.') + ' <a href="/dashboard/">View the dashboard</a>';
      ok.className = 'cg-ok show'; f.reset(); document.querySelector('input[name="irSev"][value="medium"]').checked = true;
      CG.toast('Incident reported');
    }, function (err) {
      ok.innerHTML = '<b>We could not submit the report.</b> ' + CG.esc(CG.why(err, 'incidents')) + ' For anything urgent, call the hotline: +1 (800) 555-2923.';
      ok.className = 'cg-ok show fail';
    }).then(function () { btn.disabled = false; btn.textContent = 'Submit report'; });
  });
  t_clear();
  function t_clear() { $('irTitle').addEventListener('input', function () { this.closest('.cg-field').classList.remove('bad'); }); }
})();
