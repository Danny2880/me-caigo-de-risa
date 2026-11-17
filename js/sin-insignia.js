/* Quita la insignia «Powered by Netlify» (y su tarjeta) si el hosting la inserta.
   Llega como un iframe o un bloque .nl-wrap pegado al <body>, fuera de #app y #layer.
   La regla CSS de index.html la oculta antes de pintarse; este guardián la elimina
   y vuelve a hacerlo si se inyecta de nuevo. Nunca toca nada dentro de la app. */
(function () {
  'use strict';
  const PATTERN = /netlify|nl-hud|nl-badge|nl-wrap/i;

  function isOurs(el) {
    return el.id === 'app' || el.id === 'layer' || !!(el.closest && el.closest('#app, #layer'));
  }

  function isBadge(el) {
    if (!el || el.nodeType !== 1 || isOurs(el)) return false;
    const tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'LINK' || tag === 'STYLE' || tag === 'META') return false;
    const attrs = [el.id, el.className && String(el.className), el.getAttribute('src'),
      el.getAttribute('title'), el.getAttribute('name'), el.getAttribute('aria-label')].join(' ');
    if (PATTERN.test(attrs)) return true;
    if (el.querySelector && el.querySelector('.nl-wrap, .nl-badge, #nl-badge, iframe[src*="netlify" i], iframe[title*="netlify" i]')) return true;
    return false;
  }

  function sweep(root) {
    (root || document).querySelectorAll('body > *, html > iframe, html > div').forEach((el) => {
      if (isBadge(el)) el.remove();
    });
  }

  sweep();
  document.addEventListener('DOMContentLoaded', () => sweep());
  window.addEventListener('load', () => sweep());

  new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach((n) => { if (isBadge(n)) n.remove(); });
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
