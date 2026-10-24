'use strict';

(() => {
  const card = document.getElementById('nexo-update-card');
  const trigger = document.getElementById('nexo-update-trigger');
  const button = document.getElementById('nexo-update-button');
  const closeButton = document.getElementById('nexo-update-close');
  const installCard = document.getElementById('nexo-install-card');
  if (!card || !trigger || !button || !closeButton || !installCard) return;

  const message = card.querySelector('.nexo-update-copy span');
  const originalMessage = message ? message.textContent : '';
  let registration = null;
  let firstFrameReady = false;
  let reloadWhenControlled = false;
  let reloaded = false;
  let updateTimer = null;
  let started = false;

  const refresh = () => {
    const ready = firstFrameReady && !!registration?.waiting;
    trigger.hidden = !ready;
    if (!ready) {
      card.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    }
    card.classList.toggle('is-below-install', !installCard.hidden);
  };

  const warmLoadedFiles = () => {
    const worker = registration?.active;
    if (!worker || worker.state !== 'activated' || !window.performance) return;
    // The worker independently restricts these hints to public static files.
    const urls = performance.getEntriesByType('resource')
      .map((entry) => entry.name).slice(0, 150);
    try { worker.postMessage({ type: 'NEXO_WARM_STATIC', urls }); } catch (_) {}
  };

  const trackRegistration = (nextRegistration) => {
    registration = nextRegistration;
    refresh();
    warmLoadedFiles();
    const watchInstalling = (worker) => {
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed') refresh();
        if (worker.state === 'activated') warmLoadedFiles();
      });
    };
    watchInstalling(registration.installing);
    registration.addEventListener('updatefound', () => watchInstalling(registration.installing));
  };
  window.nexoTrackPwaUpdate = trackRegistration;

  const resetUpdateButton = () => {
    reloadWhenControlled = false;
    button.disabled = false;
    button.textContent = 'Tentar atualizar';
    if (message) {
      message.textContent = 'A atualização ainda não terminou. Sua tela foi mantida. Tente novamente quando estiver conectado.';
    }
  };

  trigger.addEventListener('click', () => {
    card.hidden = !card.hidden;
    trigger.setAttribute('aria-expanded', String(!card.hidden));
    if (!card.hidden) button.focus();
  });

  button.addEventListener('click', () => {
    const worker = registration?.waiting;
    if (!worker) {
      refresh();
      return;
    }
    reloadWhenControlled = true;
    button.disabled = true;
    button.textContent = 'Atualizando…';
    if (message) message.textContent = originalMessage;
    window.clearTimeout(updateTimer);
    updateTimer = window.setTimeout(resetUpdateButton, 15000);
    try {
      worker.postMessage({ type: 'NEXO_ACTIVATE_UPDATE' });
    } catch (_) {
      window.clearTimeout(updateTimer);
      resetUpdateButton();
    }
  });

  const hideCard = (restoreFocus) => {
    card.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus();
  };
  closeButton.addEventListener('click', () => hideCard(true));
  document.addEventListener('pointerdown', (event) => {
    if (!card.hidden && !card.contains(event.target) && !trigger.contains(event.target)) {
      hideCard(false);
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !card.hidden) hideCard(true);
  });
  new MutationObserver(() => {
    card.classList.toggle('is-below-install', !installCard.hidden);
  }).observe(installCard, { attributes: true, attributeFilter: ['hidden'] });

  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadWhenControlled && !reloaded) {
      reloaded = true;
      window.clearTimeout(updateTimer);
      window.location.reload();
    } else {
      warmLoadedFiles();
      refresh();
    }
  });

  const checkForUpdate = () => {
    if (registration && !document.hidden) registration.update().catch(() => {});
  };
  document.addEventListener('visibilitychange', checkForUpdate);
  window.addEventListener('online', checkForUpdate);

  const register = async () => {
    const revision = document.querySelector('meta[name="nexo-release"]')?.content;
    // Debug builds run normally without installing a production offline cache.
    if (!/^[a-f0-9]{7,40}$/.test(revision || '')) return;
    const workerUrl = new URL('nexo_service_worker.js', document.baseURI);
    workerUrl.searchParams.set('v', revision);
    const resources = window.performance ? performance.getEntriesByType('resource') : [];
    const renderer = resources.some((entry) => /\/canvaskit\/chromium\//.test(entry.name))
      ? 'chromium'
      : resources.some((entry) => /\/canvaskit\/webparagraph\//.test(entry.name))
        ? 'webparagraph' : 'full';
    workerUrl.searchParams.set('renderer', renderer);
    try {
      const next = await navigator.serviceWorker.register(workerUrl.href, {
        scope: new URL('.', document.baseURI).pathname,
        updateViaCache: 'none',
      });
      trackRegistration(next);
      window.setInterval(checkForUpdate, 60 * 60 * 1000);
    } catch (_) {
      // A cache failure must not prevent the online application from opening.
      console.warn('NEXO: o cache para uso sem conexão ainda não está disponível.');
    }
  };

  window.addEventListener('flutter-first-frame', () => {
    firstFrameReady = true;
    refresh();
    if (started) return;
    started = true;
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(register, { timeout: 2000 });
    } else {
      window.setTimeout(register, 0);
    }
  }, { once: true });
})();
