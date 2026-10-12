/* Profile: checks live whether this account can read incidents. */
(function () {
  var note = document.getElementById('canDashNote'); if (!note || !window.CG) return;
  CG.incidents.list().then(function (r) {
    var mk = document.querySelector('#canDash .mk'), ask = document.getElementById('askAccess');
    if (r.live) { mk.className = 'mk yes'; mk.textContent = '✓'; note.textContent = 'Yes. Your roles include access to incidents.'; if (ask) ask.hidden = true; }
    else if (r.restricted) { mk.className = 'mk no'; mk.textContent = '✕'; note.textContent = 'Not yet. You need the SOC Analyst role; a portal admin can add it.'; }
    else { mk.className = 'mk wait'; mk.textContent = '–'; note.textContent = (r.failed ? 'Couldn’t check right now. ' : 'Can’t check here. ') + r.reason; }
  });
})();
