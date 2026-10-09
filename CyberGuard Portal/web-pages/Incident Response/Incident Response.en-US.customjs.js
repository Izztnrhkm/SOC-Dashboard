/* Incident response — playbook progress + report form (saves to this device; shows on the Dashboard) */
(function () {
  'use strict';
  // playbook checkboxes persist
  var KEY = 'cg_playbook_progress', state = {};
  try { state = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  [].forEach.call(document.querySelectorAll('#pbList input[data-k]'), function (c) {
    c.checked = !!state[c.dataset.k];
    c.addEventListener('change', function () { state[c.dataset.k] = c.checked; try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} });
  });
  // open the playbook list if linked to directly
  if (location.hash === '#playbooks') { var d = document.querySelector('#pbList details'); if (d) d.open = true; }

  var f = document.getElementById('irForm');
  if (!f) return;
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var t = document.getElementById('irTitle');
    if (!t.value.trim()) { t.style.borderColor = 'var(--crit)'; t.focus(); return; }
    t.style.borderColor = '';
    var inc = { title: t.value.trim(), sev: document.getElementById('irSev').value, host: document.getElementById('irHost').value.trim(), sum: document.getElementById('irDesc').value.trim() || 'Reported from the Incident response page.', src: 'Manual report', status: 'new' };
    if (window.CG) CG.addIncident(inc);
    var ok = document.getElementById('irOk');
    ok.innerHTML = 'Report received' + (inc.id ? ' as <strong>' + inc.id + '</strong>' : '') + '. <a href="/Dashboard/">View it on the dashboard</a>.';
    ok.classList.add('show');
    f.reset();
  });
})();
