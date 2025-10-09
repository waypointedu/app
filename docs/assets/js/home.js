const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function safeParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn('Unable to parse payload', error);
    return fallback;
  }
}

function createHeroMarkup(record) {
  if (!record) {
    return '<div class="hero-spotlight-card empty">New titles are on the way. Explore the shelves below.</div>';
  }
  const meta = [];
  if (Array.isArray(record.creators) && record.creators.length) {
    meta.push(record.creators.join(', '));
  }
  if (record.year) {
    meta.push(record.year);
  }
  const subjects = (record.genres || [])
    .slice(0, 3)
    .map((genre) => `<span>${escapeHtml(genre)}</span>`)
    .join('');
  const permalink = record.permalink || '#';

  return `
    <div class="hero-spotlight-card" data-hero-card data-record="${record.id}">
      <p class="eyebrow">Spotlight edition</p>
      <h3>${escapeHtml(record.title)}</h3>
      ${meta.length ? `<p class="meta">${escapeHtml(meta.join(' · '))}</p>` : ''}
      ${subjects ? `<p class="meta meta--tags">${subjects}</p>` : ''}
      <a class="button" href="${permalink}">View record</a>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hashToHue(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

function setHeroAccent(element, record) {
  if (!element || !record || !record.id) return;
  const hue = hashToHue(record.id);
  element.style.setProperty('--hero-accent', `hsl(${hue} 70% 65%)`);
}

function animateStats() {
  const counters = document.querySelectorAll('[data-stat][data-target]');
  counters.forEach((counter) => {
    const target = Number(counter.dataset.target);
    if (!Number.isFinite(target)) return;
    if (reduceMotion) {
      counter.textContent = target;
      return;
    }
    const duration = 900;
    const startTime = performance.now();

    function tick(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      counter.textContent = Math.round(target * eased);
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  });
}

function enhanceHero() {
  const hero = document.querySelector('[data-hero]');
  if (!hero) return;
  const heroSpotlight = hero.querySelector('[data-hero-spotlight]');
  const cycleButton = hero.querySelector('[data-hero-cycle]');
  const payload = safeParse(hero.dataset.heroPayload, []);
  if (!payload.length || !heroSpotlight) return;

  let index = 0;

  function update(newIndex) {
    index = newIndex % payload.length;
    const record = payload[index];
    heroSpotlight.innerHTML = createHeroMarkup(record);
    setHeroAccent(hero, record);
  }

  update(0);

  if (cycleButton) {
    cycleButton.addEventListener('click', () => {
      update((index + 1) % payload.length);
    });
  }

  if (!reduceMotion && payload.length > 1) {
    setInterval(() => {
      update((index + 1) % payload.length);
    }, 10000);
  }
}

function enhanceShelves() {
  document.querySelectorAll('[data-shelf]').forEach((shelf) => {
    const track = shelf.querySelector('[data-shelf-track]');
    const prev = shelf.querySelector('[data-shelf-prev]');
    const next = shelf.querySelector('[data-shelf-next]');
    if (!track) return;

    function updateButtons() {
      if (!prev || !next) return;
      const maxScroll = track.scrollWidth - track.clientWidth;
      prev.disabled = track.scrollLeft <= 5;
      next.disabled = track.scrollLeft >= maxScroll - 5;
    }

    prev?.addEventListener('click', () => {
      track.scrollBy({ left: -track.clientWidth * 0.75, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
    next?.addEventListener('click', () => {
      track.scrollBy({ left: track.clientWidth * 0.75, behavior: reduceMotion ? 'auto' : 'smooth' });
    });

    track.addEventListener('scroll', () => {
      window.requestAnimationFrame(updateButtons);
    });

    updateButtons();
  });
}

function enhanceGenres() {
  const shelf = document.querySelector('[data-genre-shelf]');
  if (!shelf) return;
  const controls = shelf.querySelector('[data-genre-controls]');
  const panels = shelf.querySelectorAll('[data-genre-panel]');
  if (!controls || !panels.length) return;

  controls.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-genre-switch]');
    if (!button) return;
    const target = button.dataset.genreSwitch;
    controls.querySelectorAll('button[data-genre-switch]').forEach((control) => {
      control.classList.toggle('is-active', control === button);
    });
    panels.forEach((panel) => {
      panel.classList.toggle('is-active', panel.dataset.genrePanel === target);
    });
  });
}

function bootstrapShelfPayload() {
  const container = document.querySelector('[data-shelves]');
  if (!container) return;
  const payload = safeParse(container.dataset.shelfPayload, { carousels: [], genres: [] });
  if (payload.carousels.length && payload.genres.length) {
    container.classList.add('is-hydrated');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  animateStats();
  enhanceHero();
  enhanceShelves();
  enhanceGenres();
  bootstrapShelfPayload();
});
