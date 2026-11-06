/* Shared current-page/section navigation. Links work without JavaScript. */
(() => {
  'use strict';
  const header = document.querySelector('[data-site-header]');
  const nav = document.querySelector('.content-nav-inner');
  if (!header || !nav) return;
  const links = [...nav.querySelectorAll('[data-nav]')];
  const updateHeaderHeight = () => document.documentElement.style.setProperty('--site-header-height', `${Math.ceil(header.getBoundingClientRect().height)}px`);
  updateHeaderHeight();
  if ('ResizeObserver' in window) new ResizeObserver(updateHeaderHeight).observe(header);
  else window.addEventListener('resize', updateHeaderHeight);
  const showCurrent = () => {
    const active = nav.querySelector('[aria-current]');
    if (!active) return;
    const n = nav.getBoundingClientRect(), a = active.getBoundingClientRect();
    if (a.left < n.left || a.right > n.right) nav.scrollLeft += a.left - n.left - 8;
  };
  showCurrent();
  window.addEventListener('resize', showCurrent);
  if (document.body.dataset.page !== 'home') return;
  const sections = [ ['home', document.querySelector('.hero')], ['finance', document.getElementById('my-finance')], ['library', document.getElementById('fp-library')] ];
  let scheduled = false;
  const updateCurrent = () => {
    scheduled = false;
    const threshold = header.getBoundingClientRect().bottom + 40;
    let active = 'home';
    for (const [key, element] of sections) if (element && element.getBoundingClientRect().top <= threshold) active = key;
    links.forEach(link => {
      if (link.dataset.nav === active) link.setAttribute('aria-current', active === 'home' ? 'page' : 'location');
      else link.removeAttribute('aria-current');
    });
  };
  const schedule = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(updateCurrent); } };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('pageshow', schedule);
  window.addEventListener('hashchange', schedule);
  updateCurrent();
})();
