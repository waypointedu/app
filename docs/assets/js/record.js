const basePath = document.documentElement.dataset.basePath || document.body.dataset.basePath || '';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function resolveUrl(path) {
  if (/^[a-z]+:/i.test(path) || path.startsWith('//')) return path;
  return `${basePath}${path}`;
}

function safeParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn('Unable to parse related payload', error);
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderCompactCard(record) {
  const creators = Array.isArray(record.creators) ? record.creators.join(', ') : '';
  const meta = [creators || null, record.year || null].filter(Boolean).join(' · ');
  const subjects = (record.subjects || [])
    .slice(0, 2)
    .map((subject) => `<span class="book-card__tag">${escapeHtml(subject)}</span>`)
    .join('');

  const href = resolveUrl(record.permalink);

  return `
    <article class="book-card book-card--compact">
      <a class="book-card__link" href="${href}">
        <span class="book-card__spine" aria-hidden="true">
          <span class="book-card__spine-title">${escapeHtml(record.title)}</span>
          ${creators ? `<span class="book-card__spine-author">${escapeHtml(creators)}</span>` : ''}
        </span>
        <span class="book-card__cover">
          <span class="book-card__title">${escapeHtml(record.title)}</span>
          ${meta ? `<span class="book-card__meta">${escapeHtml(meta)}</span>` : ''}
          ${subjects ? `<span class="book-card__tags">${subjects}</span>` : ''}
        </span>
      </a>
    </article>
  `;
}

function computeRelated(current, records) {
  const subjectSet = new Set(current.subjects || []);
  const genreSet = new Set(current.genres || []);
  return records
    .filter((record) => record.id !== current.id)
    .map((record) => {
      let score = 0;
      (record.subjects || []).forEach((subject) => {
        if (subjectSet.has(subject)) score += 3;
      });
      (record.genres || []).forEach((genre) => {
        if (genreSet.has(genre)) score += 4;
      });
      if (current.collection && record.collection === current.collection) score += 2;
      return { record, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.record.year && a.record.year) return b.record.year - a.record.year;
      return a.record.title.localeCompare(b.record.title);
    })
    .slice(0, 4)
    .map((entry) => entry.record);
}

document.addEventListener('DOMContentLoaded', () => {
  enhanceCopyButtons();
  enhanceReadingRoom();
  enhanceRelated();
});

function enhanceCopyButtons() {
  document.querySelectorAll('[data-copy-citation]').forEach((button) => {
    button.addEventListener('click', async () => {
      const targetSelector = button.dataset.copyTarget;
      const status = button.closest('.citation')?.querySelector('[data-copy-status]');
      const source = targetSelector ? document.querySelector(targetSelector) : null;
      const text = source ? source.textContent.trim() : '';
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        if (status) {
          status.textContent = 'Citations copied';
          setTimeout(() => {
            status.textContent = '';
          }, 2000);
        }
      } catch (error) {
        console.error('Unable to copy citation', error);
        if (status) status.textContent = 'Copy failed';
      }
    });
  });
}

async function enhanceRelated() {
  const related = document.querySelector('[data-related]');
  if (!related) return;
  const payload = safeParse(related.dataset.relatedPayload, null);
  if (!payload || !payload.id) return;
  const list = related.querySelector('[data-related-list]');
  if (!list) return;

  try {
    const response = await fetch(resolveUrl('search/index.json'), { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const index = await response.json();
    const relatedRecords = computeRelated(payload, index);
    if (!relatedRecords.length) return;
    list.innerHTML = relatedRecords.map(renderCompactCard).join('');
  } catch (error) {
    console.warn('Unable to populate related titles', error);
  }
}

function enhanceReadingRoom() {
  const trigger = document.querySelector('[data-open-reader]');
  const room = document.querySelector('[data-reading-room]');
  if (!trigger || !room) return;

  const source = trigger.dataset.readerSrc;
  if (!source) return;

  const panel = room.querySelector('[data-reading-panel]') || room.querySelector('.reading-room__panel');
  const content = room.querySelector('[data-reading-content]');
  const status = room.querySelector('[data-reading-status]');
  const themeButtons = Array.from(room.querySelectorAll('[data-reader-theme]'));
  const sizeControl = room.querySelector('[data-reader-size]');
  const closeTargets = room.querySelectorAll('[data-reader-close]');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  let loaded = false;
  let loading = false;
  let restoreFocus = null;
  let previousOverflow = '';

  function setTheme(theme) {
    room.dataset.readerTheme = theme;
    themeButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.readerTheme === theme);
    });
  }

  function updateScale() {
    if (!sizeControl) return;
    const offset = Number(sizeControl.value || 0);
    const scale = 1 + offset * 0.08;
    room.style.setProperty('--reader-font-scale', scale.toFixed(2));
  }

  async function loadContent() {
    if (loaded || loading || !content) return;
    loading = true;
    if (status) status.textContent = 'Loading edition…';
    try {
      const response = await fetch(resolveUrl(source), { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      const main = doc.querySelector('main');
      const article = doc.querySelector('article');
      const body = doc.body;
      const fragment = (main && main.innerHTML) || (article && article.innerHTML) || (body && body.innerHTML) || text;
      content.innerHTML = fragment || '<p>The HTML reading edition is not available yet.</p>';
      decorateReaderContent(content);
      content.scrollTop = 0;
      room.classList.add('is-loaded');
      if (status) status.textContent = '';
      loaded = true;
    } catch (error) {
      console.error('Unable to load reader content', error);
      if (status) status.textContent = 'Unable to load the HTML edition. Use the downloads above instead.';
      if (content) {
        content.innerHTML = '<p class="reading-room__error">Unable to load the HTML edition. Use the downloads above instead.</p>';
      }
      room.classList.add('is-error');
    } finally {
      loading = false;
    }
  }

  function decorateReaderContent(container) {
    container.querySelectorAll('a').forEach((link) => {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noreferrer noopener');
    });
  }

  function openRoom() {
    if (!room.hidden && room.classList.contains('is-active')) return;
    restoreFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    room.hidden = false;
    room.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
      room.classList.add('is-active');
      const focusTarget = panel || room;
      if (focusTarget && typeof focusTarget.focus === 'function') {
        focusTarget.focus({ preventScroll: true });
      }
    });
    loadContent();
  }

  function closeRoom() {
    if (room.hidden) return;
    room.classList.remove('is-active');
    room.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = previousOverflow;
    const delay = reduceMotion ? 0 : 250;
    window.setTimeout(() => {
      room.hidden = true;
      if (restoreFocus && typeof restoreFocus.focus === 'function' && document.contains(restoreFocus)) {
        restoreFocus.focus({ preventScroll: true });
      }
    }, delay);
  }

  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    openRoom();
  });

  closeTargets.forEach((element) => {
    element.addEventListener('click', () => {
      closeRoom();
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !room.hidden) {
      closeRoom();
    }
  });

  themeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const theme = button.dataset.readerTheme;
      if (theme) setTheme(theme);
    });
  });

  if (sizeControl) {
    sizeControl.addEventListener('input', updateScale);
    updateScale();
  }

  const initialTheme = prefersDark ? 'night' : 'day';
  if (themeButtons.some((button) => button.dataset.readerTheme === initialTheme)) {
    setTheme(initialTheme);
  } else {
    setTheme(themeButtons[0]?.dataset.readerTheme || 'day');
  }
}
