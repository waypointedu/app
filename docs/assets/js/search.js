const basePath = document.documentElement.dataset.basePath || document.body.dataset.basePath || '';

function resolveUrl(path) {
  if (/^[a-z]+:/i.test(path) || path.startsWith('//')) return path;
  return `${basePath}${path}`;
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function highlight(text, term) {
  if (!term) return text;
  const pattern = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(pattern, '<mark>$1</mark>');
}

function formatMeta(record) {
  const segments = [];
  if (Array.isArray(record.creators) && record.creators.length) {
    segments.push(record.creators.join(', '));
  }
  if (record.year) {
    segments.push(record.year);
  }
  return segments.join(' · ');
}

document.addEventListener('DOMContentLoaded', async () => {
  const root = document.querySelector('[data-search-root]');
  if (!root) return;

  const resultsEl = root.querySelector('[data-results]');
  const emptyEl = root.querySelector('[data-empty]');
  const totalEl = root.querySelector('[data-total]');
  const chipsEl = root.querySelector('[data-active-filters]');
  const searchInput = root.querySelector('[data-search-input]');
  const collectionSelect = root.querySelector('[data-filter-collection]');
  const subjectSelect = root.querySelector('[data-filter-subject]');
  const genreSelect = root.querySelector('[data-filter-genre]');
  const clearButton = root.querySelector('[data-clear]');
  const previewGrid = document.querySelector('[data-shelf-preview-grid]');

  const params = new URLSearchParams(window.location.search);
  const state = {
    query: params.get('q') ?? '',
    collection: params.get('collection') ?? '',
    subject: params.get('subject') ?? '',
    genre: params.get('genre') ?? '',
  };

  if (state.query) searchInput.value = state.query;

  let records = [];

  try {
    const response = await fetch(resolveUrl('search/index.json'), { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    records = await response.json();
  } catch (error) {
    resultsEl.innerHTML = `<li class="result-item"><strong>Unable to load search index.</strong><br>${error.message}</li>`;
    totalEl.textContent = 'Search unavailable';
    return;
  }

  hydrateFilters(records);
  applyStateToControls();
  update();

  let inputTimer;
  searchInput.addEventListener('input', (event) => {
    clearTimeout(inputTimer);
    inputTimer = setTimeout(() => {
      state.query = event.target.value.trim();
      update();
    }, 150);
  });

  collectionSelect.addEventListener('change', (event) => {
    state.collection = event.target.value;
    update();
  });

  subjectSelect.addEventListener('change', (event) => {
    state.subject = event.target.value;
    update();
  });

  genreSelect.addEventListener('change', (event) => {
    state.genre = event.target.value;
    update();
  });

  clearButton.addEventListener('click', () => {
    state.query = '';
    state.collection = '';
    state.subject = '';
    state.genre = '';
    applyStateToControls();
    update();
  });

  chipsEl.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-remove]');
    if (!button) return;
    const key = button.dataset.remove;
    if (!key) return;
    state[key] = '';
    applyStateToControls();
    update();
  });

  function applyStateToControls() {
    if (collectionSelect) collectionSelect.value = state.collection;
    if (subjectSelect) subjectSelect.value = state.subject;
    if (genreSelect) genreSelect.value = state.genre;
    if (!searchInput.value && state.query) {
      searchInput.value = state.query;
    }
    if (!state.query && searchInput.value) {
      // ensure cleared when chip removes query
      searchInput.value = state.query;
    }
  }

  function hydrateFilters(items) {
    const collections = uniqueSorted(items.map((item) => item.collection));
    const subjects = uniqueSorted(items.flatMap((item) => item.subjects || []));
    const genres = uniqueSorted(items.flatMap((item) => item.genres || []));

    for (const value of collections) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      collectionSelect.append(option);
    }

    for (const value of subjects) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      subjectSelect.append(option);
    }

    for (const value of genres) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      genreSelect.append(option);
    }
  }

  function matches(record) {
    const query = state.query.toLowerCase();
    const haystack = [
      record.title,
      ...(record.creators || []),
      ...(record.subjects || []),
      ...(record.genres || []),
    ]
      .join(' ')
      .toLowerCase();

    const matchesQuery = query ? haystack.includes(query) : true;
    const matchesCollection = state.collection ? record.collection === state.collection : true;
    const matchesSubject = state.subject ? (record.subjects || []).includes(state.subject) : true;
    const matchesGenre = state.genre ? (record.genres || []).some((genre) => genre === state.genre) : true;

    return matchesQuery && matchesCollection && matchesSubject && matchesGenre;
  }

  function score(record) {
    const query = state.query.toLowerCase();
    if (!query) return 0;
    let total = 0;
    if (record.title.toLowerCase().includes(query)) total += 5;
    if ((record.creators || []).some((creator) => creator.toLowerCase().includes(query))) total += 3;
    if ((record.subjects || []).some((subject) => subject.toLowerCase().includes(query))) total += 2;
    if ((record.genres || []).some((genre) => genre.toLowerCase().includes(query))) total += 1;
    return total;
  }

  function formatChip(label, key, value) {
    return `<button type="button" class="chip" data-remove="${key}">${label}: ${value}<span aria-hidden="true">×</span></button>`;
  }

  function renderChips() {
    const chips = [];
    if (state.query) chips.push(formatChip('Keyword', 'query', escapeHtml(state.query)));
    if (state.collection) chips.push(formatChip('Collection', 'collection', escapeHtml(state.collection)));
    if (state.subject) chips.push(formatChip('Subject', 'subject', escapeHtml(state.subject)));
    if (state.genre) chips.push(formatChip('Genre', 'genre', escapeHtml(state.genre)));
    chipsEl.innerHTML = chips.join('');
    chipsEl.toggleAttribute('hidden', chips.length === 0);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderResultCard(record, query) {
    const link = resolveUrl(record.permalink);
    const creators = Array.isArray(record.creators) ? record.creators.join(', ') : '';
    const meta = [creators || null, record.year || null].filter(Boolean).join(' · ');
    const tagsSource = record.subjects && record.subjects.length ? record.subjects : record.genres || [];
    const highlightedTitle = highlight(escapeHtml(record.title), query);
    const highlightedMeta = meta ? highlight(escapeHtml(meta), query) : '';
    const highlightedSpineAuthor = creators ? highlight(escapeHtml(creators), query) : '';
    const highlightedTags = tagsSource
      .slice(0, 4)
      .map((tag) => `<span class="book-card__tag">${highlight(escapeHtml(tag), query)}</span>`)
      .join('');

    return `
      <li class="result-item">
        <article class="book-card">
          <a class="book-card__link" href="${link}">
            <span class="book-card__spine" aria-hidden="true">
              <span class="book-card__spine-title">${highlightedTitle}</span>
              ${highlightedSpineAuthor ? `<span class="book-card__spine-author">${highlightedSpineAuthor}</span>` : ''}
            </span>
            <span class="book-card__cover">
              <span class="book-card__title">${highlightedTitle}</span>
              ${highlightedMeta ? `<span class="book-card__meta">${highlightedMeta}</span>` : ''}
              ${highlightedTags ? `<span class="book-card__tags">${highlightedTags}</span>` : ''}
            </span>
          </a>
          <a class="book-card__cta" href="${link}">Open record</a>
        </article>
      </li>
    `;
  }

  function renderResults(items) {
    if (!items.length) {
      resultsEl.innerHTML = '';
      emptyEl.hidden = false;
      return;
    }

    emptyEl.hidden = true;

    const query = state.query;
    resultsEl.innerHTML = items.map((record) => renderResultCard(record, query)).join('');
  }

  function updateShelfPreview(items) {
    if (!previewGrid) return;
    const source = items.length ? items : records;
    const groups = new Map();

    for (const record of source) {
      const genres = record.genres && record.genres.length ? record.genres : ['Highlights'];
      for (const genre of genres) {
        if (!groups.has(genre)) groups.set(genre, []);
        const bucket = groups.get(genre);
        if (bucket.length < 4) {
          bucket.push(record);
        }
      }
    }

    const preview = Array.from(groups.entries())
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .slice(0, 3);

    if (!preview.length) {
      previewGrid.innerHTML = '<p class="meta">Add more records to see shelf previews.</p>';
      return;
    }

    previewGrid.innerHTML = preview
      .map(
        ([genre, items]) => `
          <article class="preview-group">
            <h4>${escapeHtml(genre)}</h4>
            <div class="preview-track">
              ${items
                .map(
                  (record) => `
                    <a class="preview-card" href="${resolveUrl(record.permalink)}">
                      <span class="preview-title">${escapeHtml(record.title)}</span>
                      <span class="preview-meta">${escapeHtml(formatMeta(record))}</span>
                    </a>
                  `,
                )
                .join('')}
            </div>
          </article>
        `,
      )
      .join('');
  }

  function updateUrl() {
    const next = new URLSearchParams();
    if (state.query) next.set('q', state.query);
    if (state.collection) next.set('collection', state.collection);
    if (state.subject) next.set('subject', state.subject);
    if (state.genre) next.set('genre', state.genre);
    const queryString = next.toString();
    const newUrl = queryString ? `?${queryString}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }

  function update() {
    const filtered = records
      .filter((record) => matches(record))
      .map((record) => ({ ...record, __score: score(record) }))
      .sort((a, b) => {
        if (b.__score !== a.__score) return b.__score - a.__score;
        if (b.year && a.year) return b.year - a.year;
        return a.title.localeCompare(b.title);
      });

    if (totalEl) {
      totalEl.textContent = `${filtered.length} record${filtered.length === 1 ? '' : 's'}`;
    }

    renderChips();
    renderResults(filtered);
    updateShelfPreview(filtered);
    updateUrl();
  }
});
