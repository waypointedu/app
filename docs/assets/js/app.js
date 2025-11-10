const enhanceBookCard = (card) => {
  if (!(card instanceof HTMLElement) || card.dataset.bookReady) return;
  const toggles = Array.from(card.querySelectorAll('[data-book-toggle]'));
  if (!toggles.length) {
    card.dataset.bookReady = 'true';
    return;
  }

  const backFace = card.querySelector('.book__face--back');
  const setState = (flipped) => {
    card.toggleAttribute('data-flipped', flipped);
    card.dataset.flipped = flipped ? 'true' : 'false';
    toggles.forEach((toggle) => toggle.setAttribute('aria-expanded', flipped ? 'true' : 'false'));
    if (flipped) {
      const summary = backFace?.querySelector('.book__summary');
      if (summary instanceof HTMLElement) summary.focus();
    }
  };

  const activate = (event) => {
    if (event instanceof KeyboardEvent) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
    } else {
      event.preventDefault();
    }
    const flipped = card.hasAttribute('data-flipped');
    setState(!flipped);
  };

  toggles.forEach((toggle) => {
    toggle.addEventListener('click', activate);
    if (!(toggle instanceof HTMLButtonElement)) {
      toggle.addEventListener('keydown', activate);
    }
  });

  card.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && card.hasAttribute('data-flipped')) {
      setState(false);
      const trigger = toggles[0];
      if (trigger instanceof HTMLElement) trigger.focus();
    }
  });

  const frontLink = card.querySelector('.book__stretched');
  frontLink?.addEventListener('focus', () => {
    if (card.hasAttribute('data-flipped')) setState(false);
  });

  card.dataset.bookReady = 'true';
};

const mountBookCards = (scope = document) => {
  scope.querySelectorAll('[data-book-card]').forEach((card) => enhanceBookCard(card));
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mountBookCards(), { once: true });
} else {
  mountBookCards();
}

window.WaypointBookCards = {
  mount: mountBookCards,
  enhance: enhanceBookCard
};
