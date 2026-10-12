/* Escalation: on-page navigation highlight and deep links to templates. Copy buttons use data-copy (Header template). */
(function () {
  'use strict';
  var links = [].slice.call(document.querySelectorAll('#toc a')); if (!links.length) return;
  var secs = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  function spy() {
    var y = window.scrollY + 120, cur = 0;
    secs.forEach(function (s, i) { if (s && s.getBoundingClientRect().top + window.scrollY <= y) cur = i; });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = secs.length - 1;
    links.forEach(function (a, i) { a.classList.toggle('on', i === cur); if (i === cur) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  }
  window.addEventListener('scroll', spy, { passive: true }); spy();
  function fromHash() { if (/^#tpl-/.test(location.hash)) { var d = document.querySelector(location.hash); if (d) { d.open = true; d.scrollIntoView(); } } }
  fromHash(); window.addEventListener('hashchange', fromHash);
})();
