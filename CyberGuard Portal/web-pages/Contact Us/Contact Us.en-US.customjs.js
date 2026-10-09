/* Contact form — demo behaviour: validates, then confirms on screen.
   To deliver messages, replace the handler body with a Power Pages Web API call
   (POST /_api/<table>) or switch the page to a Dataverse basic form. */
(function () {
  var f = document.getElementById('contactForm');
  if (!f) return;
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var bad = ['cName', 'cEmail', 'cMsg'].filter(function (id) {
      var el = document.getElementById(id);
      var invalid = !el.value.trim() || (el.type === 'email' && !/^\S+@\S+\.\S+$/.test(el.value));
      el.style.borderColor = invalid ? 'var(--crit)' : '';
      return invalid;
    });
    if (bad.length) { document.getElementById(bad[0]).focus(); return; }
    var ref = 'MSG-' + Math.floor(10000 + Math.random() * 90000);
    var ok = document.getElementById('contactOk');
    ok.textContent = 'Thanks. Your message is recorded as ' + ref + '. We will reply by email.';
    ok.classList.add('show');
    f.reset();
  });
})();
