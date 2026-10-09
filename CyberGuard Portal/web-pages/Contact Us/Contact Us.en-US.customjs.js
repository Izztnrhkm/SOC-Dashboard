/* Contact — validation, query-string prefill (?topic=Report request&subject=...), saves to Dataverse via the Web API */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var f = $('contactForm'); if (!f) return;
  var qs = new URLSearchParams(location.search);
  if (qs.get('topic')) { var o = [].filter.call($('cTopic').options, function (x) { return x.text.toLowerCase() === qs.get('topic').toLowerCase(); })[0]; if (o) $('cTopic').value = o.value; }
  if (qs.get('subject')) $('cMsg').value = qs.get('subject') + '\n\n';
  try { var u = window.CG_USER; if (u && u.signedIn) { if (!$('cName').value) $('cName').value = u.name || ''; if (!$('cEmail').value && u.email) $('cEmail').value = u.email; } } catch (e) {}
  $('cMsg').addEventListener('input', function () { $('cCount').textContent = this.value.length; });
  [].forEach.call(f.querySelectorAll('.cg-in,.cg-ta'), function (el) { el.addEventListener('input', function () { el.closest('.cg-field').classList.remove('bad'); }); });
  function bad(id, cond) { var fld = $(id).closest('.cg-field'); fld.classList.toggle('bad', cond); return cond; }
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var b = [bad('cName', !$('cName').value.trim()), bad('cEmail', !/^\S+@\S+\.\S+$/.test($('cEmail').value.trim())), bad('cMsg', !$('cMsg').value.trim())];
    var first = ['cName', 'cEmail', 'cMsg'].filter(function (id, i) { return b[i]; })[0];
    if (first) { $(first).focus(); return; }
    var btn = $('cGo'), ok = $('contactOk'); btn.disabled = true; btn.textContent = 'Sending…'; ok.className = 'cg-ok';
    CG.messages.create({ name: $('cName').value.trim(), email: $('cEmail').value.trim(), topic: $('cTopic').value, message: $('cMsg').value.trim() }).then(function (r) {
      ok.innerHTML = '<b>Thanks, your message has been ' + (r.live ? 'sent' : 'recorded on this device (preview mode)') + '.</b> We will reply by email. For anything urgent, call +1 (800) 555-2923.';
      ok.className = 'cg-ok show'; f.reset(); $('cCount').textContent = '0'; CG.toast('Message sent');
    }, function (err) {
      ok.innerHTML = '<b>We could not send your message.</b> ' + CG.esc(CG.why(err, 'contact messages')) + ' You can also email soc-dispatch@cyberguard.sec.';
      ok.className = 'cg-ok show fail';
    }).then(function () { btn.disabled = false; btn.textContent = 'Send message'; });
  });
})();
