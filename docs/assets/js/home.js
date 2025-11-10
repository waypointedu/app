const STORAGE_KEY = 'waypoint-spotlight';

const seededOrder = (length, key) => {
  if (!length) return [];
  let seed = 0;
  for (const char of key) {
    seed = (seed * 31 + char.charCodeAt(0)) % 2147483647;
  }
  if (seed === 0) seed = 1;
  const indices = Array.from({ length }, (_, idx) => idx);
  let state = seed;
  for (let i = indices.length - 1; i > 0; i--) {
    state = (state * 1103515245 + 12345) % 2147483647;
    const j = state % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
};

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderBook = (record) => {
  const title = escapeHtml(record.title ?? 'Untitled');
  const safeId = (record.id ?? record.record_id ?? record.permalink ?? title)
    .toString()
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase();
  const cardId = `book-${safeId}`;
  const metaId = `${cardId}-meta`;
  const previewId = `${cardId}-preview`;
  const previewTitleId = `${cardId}-preview-title`;
  const permalink = record.permalink?.startsWith('/') ? record.permalink : `/${record.permalink ?? ''}`;
  const authors = Array.isArray(record.creators)
    ? record.creators.filter(Boolean)
    : Array.isArray(record.authors)
    ? record.authors.filter(Boolean)
    : [];
  const year = record.year ?? record.date ?? '';
  const collection = record.collection ? escapeHtml(record.collection) : '';
  const subjects = Array.isArray(record.subjects) ? record.subjects.slice(0, 3) : [];
  const cover = record.coverUrl
    ? `<img src="${escapeHtml(record.coverUrl)}" alt="Cover of ${title}" loading="lazy" decoding="async" fetchpriority="low" />`
    : `<div class="book__fallback" aria-hidden="true">${escapeHtml(String(title).slice(0, 1).toUpperCase())}</div>`;
  const authorsLine = authors.length
    ? `${escapeHtml(authors.join(', '))}${year ? '<span class="sep"> · </span>' + escapeHtml(String(year)) : ''}`
    : year
    ? `<span class="book__year">${escapeHtml(String(year))}</span>`
    : '';
  const tags = subjects
    .map((subject) => `<span role="listitem" class="chip">${escapeHtml(subject)}</span>`)
    .join('');
  const rawPreview = (() => {
    const source = record.abstract ?? record.summary ?? '';
    return typeof source === 'string' ? source.trim() : '';
  })();
  const preview = rawPreview ? escapeHtml(rawPreview) : '';
  const hasPreview = preview.length > 0;
  const quality = record.quality ?? record.quality_grade ?? '';
  const qualityChip = quality
    ? `<span class="chip" aria-label="Quality grade ${escapeHtml(String(quality))}">Quality ${escapeHtml(String(quality))}</span>`
    : '<span class="card__meta text-xs" style="opacity:0.7">Digital edition</span>';
  const toggleLabel = hasPreview ? `Show synopsis for ${title}` : '';
  const returnLabel = hasPreview ? `Hide synopsis for ${title}` : '';
  const peekPrompt = hasPreview ? '<span class="book__peek" aria-hidden="true">View synopsis</span>' : '';
  const previewControl = hasPreview
    ? `<button type="button" class="book__preview-button" data-book-toggle aria-haspopup="true" aria-expanded="false" aria-controls="${previewId}" aria-label="${toggleLabel}">Preview</button>`
    : '<span class="card__meta text-xs" style="opacity:0.8">Open for full details</span>';

  return `
    <article class="book" role="article" data-book-card${hasPreview ? ' data-has-preview="true"' : ''}>
      <div class="book__wrapper">
        <div class="book__face book__face--front">
          <a class="book__stretched" href="${escapeHtml(permalink)}" aria-labelledby="${cardId}" aria-describedby="${metaId}">
            <span class="sr-only">Open record: ${title}</span>
          </a>
          <figure class="book__figure"${hasPreview ? ` data-book-toggle role="button" tabindex="0" aria-controls="${previewId}" aria-expanded="false" aria-label="${toggleLabel}"` : ''}>
            ${cover}
            <span class="book__edge" aria-hidden="true"></span>
            ${peekPrompt}
          </figure>
          <div class="book__info">
            <h3 id="${cardId}" class="book__title">${title}</h3>
            ${authorsLine ? `<p class="book__author" id="${metaId}">${authorsLine}</p>` : ''}
            ${collection ? `<p class="card__meta text-xs uppercase tracking" style="margin:0">${collection}</p>` : ''}
            ${tags ? `<div class="book__tags" role="list">${tags}</div>` : ''}
          </div>
          <div class="book__footer">
            ${qualityChip}
            ${previewControl}
          </div>
        </div>
        ${hasPreview ? `
          <div class="book__face book__face--back" id="${previewId}" role="region" aria-labelledby="${previewTitleId}">
            <header>
              <h3 id="${previewTitleId}">${title}</h3>
              ${authorsLine ? `<p class="book__author">${authorsLine}</p>` : ''}
              ${collection ? `<span class="chip" style="width:fit-content">${collection}</span>` : ''}
            </header>
            <p class="book__summary" tabindex="-1">${preview}</p>
            <div class="book__actions">
              <a class="button" href="${escapeHtml(permalink)}">Open record</a>
              <button type="button" class="book__preview-close" data-book-toggle aria-expanded="true" aria-controls="${previewId}" aria-label="${returnLabel}">Return to cover</button>
            </div>
          </div>
        ` : ''}
      </div>
    </article>
  `;
};

const initSpotlight = () => {
  const root = document.querySelector('[data-spotlight-root]');
  if (!root) return;
  const grid = root.querySelector('[data-spotlight-grid]');
  if (!grid) return;
  let records = [];
  try {
    records = JSON.parse(root.dataset.spotlightRecords ?? '[]');
  } catch (error) {
    console.warn('Unable to parse spotlight data', error);
    records = [];
  }
  if (!records.length) return;

  const dateKey = new Date().toISOString().slice(0, 10);
  let order = null;
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (stored?.key === dateKey && Array.isArray(stored.order)) {
      order = stored.order;
    }
  } catch (error) {
    console.warn('Unable to read stored spotlight order', error);
  }
  if (!order) {
    order = seededOrder(records.length, dateKey);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ key: dateKey, order }));
    } catch (error) {
      console.warn('Unable to persist spotlight order', error);
    }
  }

  const sliceSize = Math.min(4, order.length);
  let offset = 0;

  const render = () => {
    const selection = [];
    for (let i = 0; i < sliceSize; i++) {
      const index = order[(offset + i) % order.length];
      selection.push(renderBook(records[index] ?? {}));
    }
    grid.innerHTML = selection.map((markup) => `<div role="listitem">${markup}</div>`).join('');
    window.WaypointBookCards?.mount(grid);
  };

  const advance = () => {
    offset = (offset + sliceSize) % order.length;
    render();
  };

  root.querySelectorAll('[data-spotlight-shuffle]').forEach((button) => {
    button.addEventListener('click', advance);
  });

  render();
};

const initShelves = () => {
  document.querySelectorAll('[data-shelf]').forEach((shelf) => {
    const track = shelf.querySelector('[data-shelf-track]');
    const items = Array.from(track?.querySelectorAll('[data-shelf-item]') ?? []);
    if (!track || !items.length) return;
    let index = items.findIndex((item) => item.tabIndex === 0);
    if (index < 0) index = 0;

    const setActive = (nextIndex) => {
      const clamped = Math.max(0, Math.min(nextIndex, items.length - 1));
      if (clamped === index) {
        items[index].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
        return;
      }
      items[index].tabIndex = -1;
      items[index].setAttribute('aria-selected', 'false');
      index = clamped;
      items[index].tabIndex = 0;
      items[index].setAttribute('aria-selected', 'true');
      items[index].focus();
      items[index].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    };

    track.addEventListener('focus', () => {
      if (document.activeElement === track) {
        items[index]?.focus();
      }
    });

    track.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setActive(index + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setActive(index - 1);
      }
    });

    items.forEach((item, itemIndex) => {
      item.addEventListener('focus', () => {
        items[index].setAttribute('aria-selected', 'false');
        items[index].tabIndex = -1;
        index = itemIndex;
        items[index].tabIndex = 0;
        items[index].setAttribute('aria-selected', 'true');
      });
    });

    const prev = shelf.querySelector('[data-shelf-prev]');
    const next = shelf.querySelector('[data-shelf-next]');
    prev?.addEventListener('click', () => setActive(index - 1));
    next?.addEventListener('click', () => setActive(index + 1));
  });
};

const init = () => {
  initSpotlight();
  initShelves();
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  init();
} else {
  document.addEventListener('DOMContentLoaded', init);
}
