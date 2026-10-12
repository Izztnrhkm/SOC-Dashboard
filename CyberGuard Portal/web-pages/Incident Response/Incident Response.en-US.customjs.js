/* Incident response: on-page navigation highlight, report form -> Dataverse (cg_incident). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  if (!$('irForm') || !window.CG) return;
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-print]')) window.print(); });
  /* old playbook links now live on /playbooks/ */
  if (/^#pb-/.test(location.hash)) { location.replace('/playbooks/' + location.hash); return; }

  /* on-page navigation highlight */
  var links = [].slice.call(document.querySelectorAll('#toc a')), secs = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  function spy() {
    var y = window.scrollY + 120, cur = 0;
    secs.forEach(function (s, i) { if (s && s.getBoundingClientRect().top + window.scrollY <= y) cur = i; });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = secs.length - 1;
    links.forEach(function (a, i) { a.classList.toggle('on', i === cur); if (i === cur) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  }
  window.addEventListener('scroll', spy, { passive: true }); spy();

  /* report form */
  var f = $('irForm'), t = $('irTitle');
  t.addEventListener('input', function () { t.closest('.ld-field').classList.remove('bad'); });
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var fld = t.closest('.ld-field'), ok = $('irOk');
    if (!t.value.trim()) { fld.classList.add('bad'); t.focus(); return; }
    var btn = $('irGo'); btn.disabled = true; btn.textContent = 'Sending…'; ok.className = 'ld-note ld-result';
    var sev = (document.querySelector('input[name="irSev"]:checked') || {}).value || 'medium';
    CG.incidents.create({ title: t.value.trim(), sev: sev, status: 'new', host: $('irHost').value.trim(), cat: $('irCat').value, desc: $('irDesc').value.trim(), src: 'Portal report' }).then(function (r) {
      var ref = r.item && r.item.ref;
      ok.innerHTML = '<div><b>Incident reported' + (ref ? ': ' + CG.esc(ref) : '') + '.</b> ' + (r.live ? 'It is in the SOC queue now.' : 'Sample data mode: it is saved in this browser only.') + ' <a href="/dashboard/">See it on the dashboard</a></div>';
      ok.className = 'ld-note ld-result ok is-open'; f.reset();
      CG.toast('Incident reported');
    }, function (err) {
      ok.innerHTML = '<div><b>The report was not sent.</b> ' + CG.esc(CG.why(err, 'incidents')) + ' If it is urgent, call ' + CG.hotline + '.</div>';
      ok.className = 'ld-note ld-result warn is-open';
    }).then(function () { btn.disabled = false; btn.textContent = 'Report incident'; });
  });
})();
