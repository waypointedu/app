const eraOptions = ['Ancient', 'Medieval', 'Renaissance', 'Early Modern', 'Modern', 'Contemporary'];
const synonyms = new Map([
  ['patristics', ['church fathers']],
  ['church fathers', ['patristics']]
]);

const normalize = (value = '') =>
  String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const expandQuery = (raw) => {
  const normalized = normalize(raw);
  const extra = synonyms.get(normalized) ?? [];
  return [raw, ...extra].filter(Boolean);
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
  const cardId = `search-${safeId}`;
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
  const previewSource = (() => {
    const source = record.abstract ?? record.summary ?? '';
    return typeof source === 'string' ? source.trim() : '';
  })();
  const preview = previewSource ? escapeHtml(previewSource) : '';
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

const debounce = (callback, delay = 200) => {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => callback(...args), delay);
  };
};

document.addEventListener('DOMContentLoaded', () => {
  const app = document.querySelector('[data-search-app]');
  if (!app) return;

  let records = [];
  try {
    records = JSON.parse(app.dataset.records ?? '[]');
  } catch (error) {
    console.error('Unable to parse search records payload', error);
    records = [];
  }

  const params = new URLSearchParams(window.location.search);
  const initialSubjects = params.getAll('subject');
  const state = {
    query: params.get('q') ?? '',
    subjects: initialSubjects.filter(Boolean),
    author: params.get('author') ?? '',
    era: params.get('era') ?? ''
  };

  const subjects = Array.from(
    new Set(records.flatMap((record) => Array.isArray(record.subjects) ? record.subjects : []).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const authors = Array.from(
    new Set(
      records.flatMap((record) =>
        Array.isArray(record.authors)
          ? record.authors
          : Array.isArray(record.creators)
          ? record.creators
          : []
      )
    )
  )
    .filter(Boolean)
    .sort((a, b) => String(a).localeCompare(String(b)));

  const prepared = records.map((item) => ({
    item,
    normalized: {
      title: normalize(item.title ?? ''),
      authors: Array.isArray(item.authors)
        ? item.authors.map((author) => normalize(author))
        : Array.isArray(item.creators)
        ? item.creators.map((creator) => normalize(creator))
        : [],
      subjects: Array.isArray(item.subjects) ? item.subjects.map((subject) => normalize(subject)) : [],
      collection: normalize(item.collection ?? ''),
      combined: normalize(
        [
          item.title ?? '',
          ...(Array.isArray(item.authors) ? item.authors : []),
          ...(Array.isArray(item.creators) ? item.creators : []),
          ...(Array.isArray(item.subjects) ? item.subjects : []),
          item.collection ?? ''
        ].join(' ')
      )
    }
  }));

  const searchInput = app.querySelector('[data-search-input]');
  const subjectsContainer = app.querySelector('[data-subject-options]');
  const authorInput = app.querySelector('[data-author-input]');
  const authorList = app.querySelector('#author-options');
  const eraSelect = app.querySelector('[data-era-select]');
  const chipsRegion = app.querySelector('[data-active-filters]');
  const resultsRegion = app.querySelector('[data-results-region]');
  const countEl = app.querySelector('[data-result-count]');
  const summaryEl = app.querySelector('[data-result-summary]');
  const filterSummaryEl = app.querySelector('[data-filter-summary]');
  const clearButtons = app.querySelectorAll('[data-clear]');

  if (searchInput) searchInput.value = state.query;
  if (authorInput) authorInput.value = state.author;
  if (eraSelect) eraSelect.value = state.era;

  if (authorList) {
    authorList.innerHTML = authors.map((author) => `<option value="${escapeHtml(author)}"></option>`).join('');
  }

  if (subjectsContainer) {
    subjectsContainer.innerHTML = subjects
      .map((subject) => {
        const id = `subject-${subject.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
        const checked = state.subjects.includes(subject) ? 'checked' : '';
        return `
          <label class="facet-option">
            <input type="checkbox" value="${escapeHtml(subject)}" ${checked} data-subject-checkbox />
            <span>${escapeHtml(subject)}</span>
          </label>
        `;
      })
      .join('');
  }

  const runSearch = (term) => {
    const trimmed = term.trim();
    if (!trimmed) {
      return prepared.map(({ item }) => ({ item, score: 0 }));
    }
    const expansions = expandQuery(trimmed);
    const matches = new Map();
    for (const [index, expansion] of expansions.entries()) {
      const normalizedExpansion = normalize(expansion);
      for (const entry of prepared) {
        const { item, normalized } = entry;
        const scores = [];
        if (normalized.title === normalizedExpansion) {
          scores.push(-1);
        } else if (normalized.title.includes(normalizedExpansion)) {
          scores.push(0.05);
        }
        if (normalized.authors.some((value) => value.includes(normalizedExpansion))) {
          scores.push(0.15);
        }
        if (normalized.subjects.some((value) => value.includes(normalizedExpansion))) {
          scores.push(0.25);
        }
        if (normalized.collection.includes(normalizedExpansion)) {
          scores.push(0.3);
        }
        if (normalized.combined.includes(normalizedExpansion)) {
          scores.push(0.35);
        }
        if (!scores.length) continue;
        const baseScore = Math.min(...scores);
        const adjusted = index === 0 ? baseScore : Math.max(baseScore, 0.2);
        const current = matches.get(item.id);
        if (!current || adjusted < current.score) {
          matches.set(item.id, { item, score: adjusted });
        }
      }
    }
    if (!matches.size) {
      return prepared.map(({ item }) => ({ item, score: 0.9 }));
    }
    return Array.from(matches.values());
  };

  const applyFilters = (results) => {
    const normalizedQuery = state.query ? normalize(state.query) : '';
    return results
      .map(({ item, score }) => ({
        ...item,
        _score: normalizedQuery && normalize(item.title ?? '') === normalizedQuery ? -1 : score ?? 0
      }))
      .filter((record) => {
        const subjectMatch = !state.subjects.length || state.subjects.every((subject) => record.subjects?.includes(subject));
        const authorMatch =
          !state.author || normalize((record.authors ?? record.creators ?? []).join(' ')).includes(normalize(state.author));
        const eraMatch = !state.era || record.era === state.era;
        return subjectMatch && authorMatch && eraMatch;
      })
      .sort((a, b) => a._score - b._score || String(a.title).localeCompare(String(b.title)));
  };

  const updateUrl = () => {
    const next = new URL(window.location.href);
    next.searchParams.delete('q');
    next.searchParams.delete('author');
    next.searchParams.delete('era');
    next.searchParams.delete('subject');
    if (state.query) next.searchParams.set('q', state.query);
    if (state.author) next.searchParams.set('author', state.author);
    if (state.era) next.searchParams.set('era', state.era);
    for (const subject of state.subjects) {
      next.searchParams.append('subject', subject);
    }
    const nextUrl = `${next.pathname}${next.search}${next.hash}`;
    window.history.replaceState({}, '', nextUrl);
  };

  const renderChips = () => {
    const chips = [];
    if (state.query) {
      chips.push(`<button type="button" class="chip" data-remove="query">Keyword: ${escapeHtml(state.query)}<span aria-hidden="true">×</span></button>`);
    }
    for (const subject of state.subjects) {
      chips.push(`<button type="button" class="chip" data-remove-subject="${escapeHtml(subject)}">Subject: ${escapeHtml(subject)}<span aria-hidden="true">×</span></button>`);
    }
    if (state.author) {
      chips.push(`<button type="button" class="chip" data-remove="author">Author: ${escapeHtml(state.author)}<span aria-hidden="true">×</span></button>`);
    }
    if (state.era) {
      chips.push(`<button type="button" class="chip" data-remove="era">Era: ${escapeHtml(state.era)}<span aria-hidden="true">×</span></button>`);
    }
    chipsRegion.innerHTML = chips.join('');
    chipsRegion.toggleAttribute('hidden', chips.length === 0);
  };

  const renderResults = () => {
    const searchResults = runSearch(state.query);
    const filtered = applyFilters(searchResults);
    const total = filtered.length;
    countEl.textContent = `${total} result${total === 1 ? '' : 's'}`;
    summaryEl.textContent = `Showing ${total} item${total === 1 ? '' : 's'}`;
    const filtersActive = state.subjects.length + (state.author ? 1 : 0) + (state.era ? 1 : 0);
    filterSummaryEl.textContent = filtersActive
      ? `${filtersActive} filter${filtersActive === 1 ? '' : 's'} active`
      : 'No filters active';
    clearButtons.forEach((button) => {
      button.hidden = filtersActive === 0 && !state.query;
    });
    if (!total) {
      resultsRegion.innerHTML = `<p class="card" style="text-align:center;border-style:dashed;border-color:var(--line);box-shadow:none">No results match “${escapeHtml(state.query)}”. Reset filters or browse highlighted subjects.</p>`;
      window.WaypointBookCards?.mount(resultsRegion);
      return;
    }
    const markup = filtered.map((record) => renderBook(record)).join('');
    resultsRegion.innerHTML = `<div class="results-grid">${markup}</div>`;
    window.WaypointBookCards?.mount(resultsRegion);
  };

  const update = () => {
    updateUrl();
    renderChips();
    renderResults();
  };

  renderChips();
  renderResults();

  if (searchInput) {
    searchInput.addEventListener(
      'input',
      debounce((event) => {
        state.query = event.target.value.trim();
        update();
      })
    );
  }

  if (authorInput) {
    authorInput.addEventListener(
      'input',
      debounce((event) => {
        state.author = event.target.value.trim();
        update();
      })
    );
  }

  if (eraSelect) {
    eraSelect.addEventListener('change', (event) => {
      state.era = event.target.value;
      update();
    });
  }

  subjectsContainer?.addEventListener('change', (event) => {
    const input = event.target.closest('[data-subject-checkbox]');
    if (!(input instanceof HTMLInputElement)) return;
    if (input.checked) {
      if (!state.subjects.includes(input.value)) state.subjects.push(input.value);
    } else {
      state.subjects = state.subjects.filter((subject) => subject !== input.value);
    }
    update();
  });

  chipsRegion.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-remove], button[data-remove-subject]');
    if (!button) return;
    if (button.dataset.remove === 'query') {
      state.query = '';
      if (searchInput) searchInput.value = '';
    } else if (button.dataset.remove === 'author') {
      state.author = '';
      if (authorInput) authorInput.value = '';
    } else if (button.dataset.remove === 'era') {
      state.era = '';
      if (eraSelect) eraSelect.value = '';
    } else if (button.dataset.removeSubject) {
      state.subjects = state.subjects.filter((subject) => subject !== button.dataset.removeSubject);
      const checkbox = subjectsContainer?.querySelector(
        `[data-subject-checkbox][value="${CSS.escape(button.dataset.removeSubject)}"]`
      );
      if (checkbox instanceof HTMLInputElement) {
        checkbox.checked = false;
      }
    }
    update();
  });

  clearButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.query = '';
      state.subjects = [];
      state.author = '';
      state.era = '';
      if (searchInput) searchInput.value = '';
      if (authorInput) authorInput.value = '';
      if (eraSelect) eraSelect.value = '';
      subjectsContainer?.querySelectorAll('[data-subject-checkbox]').forEach((checkbox) => {
        if (checkbox instanceof HTMLInputElement) checkbox.checked = false;
      });
      update();
    });
  });
});
