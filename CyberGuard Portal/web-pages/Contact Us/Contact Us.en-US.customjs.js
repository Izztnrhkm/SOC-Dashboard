/* Contact: prefill from the signed-in user and the query string (?topic=...&subject=...), validation, save to Dataverse (cg_contactmessage). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var f = $('contactForm'); if (!f || !window.CG) return;
  var qs = new URLSearchParams(location.search);
  if (qs.get('topic')) { var o = [].filter.call($('cTopic').options, function (x) { return x.text.toLowerCase() === qs.get('topic').toLowerCase(); })[0]; if (o) $('cTopic').value = o.value; }
  if (qs.get('subject')) $('cMsg').value = 'About: ' + qs.get('subject') + '\n\n';
  function prefill() { var u = CG.user; if (u && u.signedIn) { if (!$('cName').value) $('cName').value = u.name || ''; if (!$('cEmail').value && u.email) $('cEmail').value = u.email; } }
  prefill();
  function count() { $('cCount').textContent = $('cMsg').value.length; }
  $('cMsg').addEventListener('input', count); count();
  [].forEach.call(f.querySelectorAll('.ld-input,.ld-text'), function (el) { el.addEventListener('input', function () { el.closest('.ld-field').classList.remove('bad'); }); });
  function bad(id, cond) { var el = $(id); el.closest('.ld-field').classList.toggle('bad', cond); el.setAttribute('aria-invalid', cond ? 'true' : 'false'); return cond; }
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var b = [bad('cName', !$('cName').value.trim()), bad('cEmail', !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($('cEmail').value.trim())), bad('cMsg', !$('cMsg').value.trim())];
    var first = ['cName', 'cEmail', 'cMsg'].filter(function (id, i) { return b[i]; })[0];
    if (first) { $(first).focus(); return; }
    var btn = $('cGo'), ok = $('contactOk'); btn.disabled = true; btn.textContent = 'Sending…'; ok.className = 'ld-note ld-result';
    CG.messages.create({ name: $('cName').value.trim(), email: $('cEmail').value.trim(), topic: $('cTopic').value, message: $('cMsg').value.trim() }).then(function (r) {
      ok.innerHTML = '<div><b>Message sent.</b> ' + (r.live ? 'We’ll reply to ' + CG.esc($('cEmail').value.trim()) + '.' : 'Sample data mode: it is saved in this browser only.') + '</div>';
      ok.className = 'ld-note ld-result ok is-open'; $('cMsg').value = ''; count(); CG.toast('Message sent');
    }, function (err) {
      ok.innerHTML = '<div><b>The message was not sent.</b> ' + CG.esc(CG.why(err, 'contact messages')) + ' You can email <a href="mailto:enquiry@landasandigital.com">enquiry@landasandigital.com</a> instead.</div>';
      ok.className = 'ld-note ld-result warn is-open';
    }).then(function () { btn.disabled = false; btn.textContent = 'Send message'; });
  });
})();
