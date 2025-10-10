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

function createBookCard(record, { compact = false, showCta = false } = {}) {
  const classes = ['book-card'];
  if (compact) classes.push('book-card--compact');
  const creators = Array.isArray(record.creators) ? record.creators.join(', ') : '';
  const meta = [creators || null, record.year || null].filter(Boolean).join(' · ');
  const topics = (record.subjects && record.subjects.length ? record.subjects : record.genres) || [];
  const tags = topics
    .slice(0, compact ? 2 : 4)
    .map((subject) => `<span class="book-card__tag">${escapeHtml(subject)}</span>`)
    .join('');
  const link = record.permalink || '#';

  return `
    <article class="${classes.join(' ')}" data-record-id="${record.id}">
      <a class="book-card__link" href="${escapeHtml(link)}">
        <span class="book-card__spine" aria-hidden="true">
          <span class="book-card__spine-title">${escapeHtml(record.title)}</span>
          ${creators ? `<span class="book-card__spine-author">${escapeHtml(creators)}</span>` : ''}
        </span>
        <span class="book-card__cover">
          <span class="book-card__title">${escapeHtml(record.title)}</span>
          ${meta ? `<span class="book-card__meta">${escapeHtml(meta)}</span>` : ''}
          ${tags ? `<span class="book-card__tags">${tags}</span>` : ''}
        </span>
      </a>
      ${showCta ? `<a class="book-card__cta" href="${escapeHtml(link)}">Open record</a>` : ''}
    </article>
  `;
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
  const subjects = ((record.subjects && record.subjects.length ? record.subjects : record.genres) || [])
    .slice(0, 3)
    .map((genre) => `<span>${escapeHtml(genre)}</span>`)
    .join('');
  const permalink = record.permalink || '#';

  return `
    <div class="hero-spotlight-card" data-hero-card data-record="${record.id}">
      <p class="eyebrow">Featured volume</p>
      <h3>${escapeHtml(record.title)}</h3>
      ${meta.length ? `<p class="meta">${escapeHtml(meta.join(' · '))}</p>` : ''}
      ${subjects ? `<p class="meta meta--tags">${subjects}</p>` : ''}
      <div class="hero-spotlight-book">${createBookCard(record, { showCta: false })}</div>
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

    if (!reduceMotion) {
      track.addEventListener('pointermove', (event) => {
        const rect = track.getBoundingClientRect();
        const ratio = (event.clientX - rect.left) / rect.width;
        const tilt = (ratio - 0.5) * 14;
        track.style.setProperty('--shelf-tilt', `${tilt.toFixed(2)}deg`);
      });
      track.addEventListener('pointerleave', () => {
        track.style.removeProperty('--shelf-tilt');
      });
    }
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

function enhanceAmbientHall() {
  const hall = document.querySelector('[data-ambient-hall]');
  if (!hall || reduceMotion) return;

  hall.addEventListener('pointermove', (event) => {
    const rect = hall.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    hall.style.setProperty('--pointer-x', x.toFixed(2));
    hall.style.setProperty('--pointer-y', y.toFixed(2));
  });

  hall.addEventListener('pointerleave', () => {
    hall.style.removeProperty('--pointer-x');
    hall.style.removeProperty('--pointer-y');
  });
}

function enhanceHeroGallery() {
  const gallery = document.querySelector('[data-hero-gallery]');
  if (!gallery) return;
  const items = Array.from(gallery.querySelectorAll('.hero-gallery__item'));
  if (items.length <= 1) return;

  let index = 0;

  function activate(newIndex) {
    index = newIndex % items.length;
    items.forEach((item, itemIndex) => {
      item.classList.toggle('is-active', itemIndex === index);
    });
  }

  activate(0);

  if (!reduceMotion) {
    setInterval(() => {
      activate((index + 1) % items.length);
    }, 9000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  animateStats();
  enhanceHero();
  enhanceShelves();
  enhanceGenres();
  bootstrapShelfPayload();
  enhanceAmbientHall();
  enhanceHeroGallery();
});
