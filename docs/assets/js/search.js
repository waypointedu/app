document.addEventListener('DOMContentLoaded', async () => {
  const basePath =
    document.documentElement.dataset.basePath || document.body.dataset.basePath || '';
  const resultsEl = document.querySelector('[data-results]');
  const emptyEl = document.querySelector('[data-empty]');
  const totalEl = document.querySelector('[data-total]');
  const searchInput = document.querySelector('input[name="q"]');
  const collectionSelect = document.querySelector('select[name="collection"]');
  const subjectSelect = document.querySelector('select[name="subject"]');

  let records = [];

  try {
    const response = await fetch('../search/index.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to load search index');
    records = await response.json();
    hydrateFilters(records);
    render(records);
  } catch (error) {
    resultsEl.innerHTML = `<li class="result-item"><strong>Unable to load search index.</strong><br>${error.message}</li>`;
    return;
  }

  function hydrateFilters(items) {
    const collections = Array.from(new Set(items.map((item) => item.collection).filter(Boolean))).sort();
    const subjects = Array.from(new Set(items.flatMap((item) => item.subjects || [])).values()).sort();

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
  }

  function getFilters() {
    return {
      query: searchInput.value.trim().toLowerCase(),
      collection: collectionSelect.value,
      subject: subjectSelect.value,
    };
  }

  function matches(record, filters) {
    const { query, collection, subject } = filters;
    const haystack = [record.title, ...(record.creators || []), ...(record.subjects || [])]
      .join(' ')
      .toLowerCase();
    const matchesQuery = query ? haystack.includes(query) : true;
    const matchesCollection = collection ? record.collection === collection : true;
    const matchesSubject = subject ? (record.subjects || []).includes(subject) : true;
    return matchesQuery && matchesCollection && matchesSubject;
  }

  function render(items) {
    const filters = getFilters();
    const filtered = items.filter((record) => matches(record, filters));

    if (totalEl) {
      totalEl.textContent = `${filtered.length} record${filtered.length === 1 ? '' : 's'}`;
    }

    if (!filtered.length) {
      resultsEl.innerHTML = '';
      emptyEl.hidden = false;
      return;
    }

    emptyEl.hidden = true;

    resultsEl.innerHTML = filtered
      .map((record) => {
        const subjects = (record.subjects || []).map((subject) => `<span>${subject}</span>`).join(' ');
        return `
          <li class="result-item">
            <h3><a href="${basePath}${record.permalink}">${record.title}</a></h3>
            <p>${[record.creators?.join(', '), record.year].filter(Boolean).join(' · ')}</p>
            ${subjects ? `<p class="meta">${subjects}</p>` : ''}
          </li>
        `;
      })
      .join('');
  }

  searchInput.addEventListener('input', () => render(records));
  collectionSelect.addEventListener('change', () => render(records));
  subjectSelect.addEventListener('change', () => render(records));
});
