(function () {
  'use strict';
  const canvas = document.querySelector('#botanical');
  const pause = document.querySelector('#pause');
  const status = document.querySelector('#study-status');
  const tune = document.querySelector('#tune');
  const panel = document.querySelector('#tune-panel');
  const cover = document.querySelector('.cover');
  const garden = document.querySelector('#garden');
  const about = document.querySelector('#about');
  function updatePause(paused) {
    pause.setAttribute('aria-pressed', String(paused));
    pause.textContent = paused ? 'Resume' : 'Pause';
    pause.setAttribute('aria-label', paused ? 'Resume fern motion' : 'Pause fern motion');
  }
  document.querySelector('#about-open').addEventListener('click', () => about.showModal());
  about.addEventListener('click', event => {
    if (event.target !== about) return;
    const box = about.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) about.close();
  });
  const fern = window.ArecaBotanical.mount(canvas, { onPause: updatePause });
  if (!fern) {
    document.querySelector('.play-controls').hidden = true;
    garden.hidden = true;
    status.textContent = 'The fern is unavailable in this browser.';
    return;
  }
  updatePause(fern.paused);
  document.querySelector('#regrow').addEventListener('click', () => {
    fern.regrow();
    status.textContent = fern.paused ? 'Fern restored.' : 'Fern growth restarted.';
  });
  pause.addEventListener('click', () => {
    fern.pause(!fern.paused); updatePause(fern.paused);
    status.textContent = fern.paused ? 'Fern motion paused.' : 'Fern motion resumed.';
  });
  tune.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    tune.setAttribute('aria-expanded', String(!panel.hidden));
  });
  garden.addEventListener('click', () => {
    const active = cover.classList.toggle('garden-only');
    garden.setAttribute('aria-pressed', String(active));
    garden.textContent = active ? 'Back to Areca' : 'Just the fern';
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      panel.hidden = true; tune.setAttribute('aria-expanded', 'false'); tune.focus();
    } else if (event.key === 'Escape' && cover.classList.contains('garden-only') && !about.open) {
      garden.click(); garden.focus();
    }
  });
  document.querySelector('#wind').addEventListener('input', event => fern.wind(Number(event.target.value) / 100));
  let densityTimer;
  document.querySelector('#fullness').addEventListener('input', event => {
    clearTimeout(densityTimer);
    densityTimer = setTimeout(() => fern.fullness(Number(event.target.value) / 100), 70);
  });
})();
