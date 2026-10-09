/* FAQ — live filter */
(function () {
  var input = document.getElementById('faqFilter');
  if (!input) return;
  var items = [].slice.call(document.querySelectorAll('#faqList details'));
  var count = document.getElementById('faqCount');
  var none = document.getElementById('faqNone');
  function run() {
    var q = input.value.trim().toLowerCase(), n = 0;
    items.forEach(function (d) {
      var hit = !q || d.textContent.toLowerCase().indexOf(q) !== -1;
      d.hidden = !hit; if (hit) n++;
      if (q && hit) d.open = true; else if (!q) d.open = false;
    });
    count.textContent = q ? n + ' of ' + items.length : '';
    none.hidden = n !== 0;
  }
  input.addEventListener('input', run);
  if (location.hash && location.hash.length > 1) { try { var t = document.querySelector(location.hash); if (t && t.tagName === 'DETAILS') t.open = true; } catch (e) {} }
})();
