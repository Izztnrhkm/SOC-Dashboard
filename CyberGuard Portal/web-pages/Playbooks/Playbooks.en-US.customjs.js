/* Playbooks: search, severity filter, ticks saved in this browser, deep links (#pb-...). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  if (!$('pbList') || !window.CG) return;
  var KEY = 'ld_playbooks', state = {}, sev = 'all';
  try { state = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function all() { return [].slice.call(document.querySelectorAll('.ld-pb')); }
  function paint(pb) { var n = 0; [].forEach.call(pb.querySelectorAll('input[data-k]'), function (c) { if (c.checked) n++; }); pb.querySelector('.pgn').textContent = n; }
  all().forEach(function (pb) {
    [].forEach.call(pb.querySelectorAll('input[data-k]'), function (c) {
      c.checked = !!state[c.getAttribute('data-k')];
      c.addEventListener('change', function () { state[c.getAttribute('data-k')] = c.checked; save(); paint(pb); });
    });
    paint(pb);
  });
  document.addEventListener('click', function (e) {
    var r = e.target.closest && e.target.closest('[data-reset]');
    if (r) { var pb = $('pb-' + r.getAttribute('data-reset')); [].forEach.call(pb.querySelectorAll('input[data-k]'), function (c) { c.checked = false; delete state[c.getAttribute('data-k')]; }); save(); paint(pb); CG.toast('Ticks cleared'); }
    if (e.target.closest && e.target.closest('[data-print]')) window.print();
  });
  function run() {
    var q = $('pbQ').value.trim().toLowerCase(), n = 0;
    all().forEach(function (d) {
      var hit = (sev === 'all' || d.getAttribute('data-sev') === sev) && (!q || d.textContent.toLowerCase().indexOf(q) > -1);
      d.hidden = !hit; if (hit) n++;
    });
    $('pbNone').hidden = n > 0;
  }
  var t; $('pbQ').addEventListener('input', function () { clearTimeout(t); t = setTimeout(run, 100); });
  $('pbSev').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-sev]'); if (!b) return; sev = b.getAttribute('data-sev');
    [].forEach.call($('pbSev').children, function (c) { c.setAttribute('aria-pressed', c === b ? 'true' : 'false'); }); run();
  });
  $('pbAll').addEventListener('click', function () {
    var open = all().some(function (d) { return !d.hidden && !d.open; });
    all().forEach(function (d) { if (!d.hidden) d.open = open; }); this.textContent = open ? 'Close all' : 'Open all';
  });
  function fromHash() { if (/^#pb-/.test(location.hash)) { var d = document.querySelector(location.hash); if (d) { d.hidden = false; d.open = true; d.scrollIntoView(); } } }
  fromHash(); window.addEventListener('hashchange', fromHash);
})();
