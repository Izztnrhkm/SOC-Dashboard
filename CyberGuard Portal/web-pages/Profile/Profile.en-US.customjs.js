/* Profile — shows whether the signed-in account can use the live dashboard */
(function () {
  var note = document.getElementById('canDashNote'); if (!note || !window.CG) return;
  CG.incidents.list().then(function (r) {
    var dot = document.querySelector('#canDash .cg-dot');
    if (r.live) { note.textContent = '(yes)'; dot.className = 'cg-dot ok'; }
    else if (r.status === 403) { note.textContent = '(no: needs the SOC Analyst role)'; }
    else { note.textContent = '(sample data only: Dataverse is not connected)'; }
  });
})();
