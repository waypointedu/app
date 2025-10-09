const indexUrl = new URL('../../search/index.json', import.meta.url);
const searchInput = document.querySelector('#searchQuery');
const resultsEl = document.querySelector('#results');
const facetsEl = document.querySelector('#facets');
const emptyStateEl = document.querySelector('#emptyState');
const resetButton = document.querySelector('#resetButton');

const state = {
  query: '',
  subject: null,
  collection: null
};

let records = [];

async function loadIndex() {
  const response = await fetch(indexUrl);
  if (!response.ok) {
    resultsEl.innerHTML = '';
    emptyStateEl.style.display = 'block';
    emptyStateEl.textContent = 'Unable to load the search index. Please check that docs/search/index.json exists.';
    return;
  }
  records = await response.json();
  renderFacets();
  renderResults();
}

function setState(partial) {
  Object.assign(state, partial);
  renderResults();
  updateFacetHighlights();
}

function renderFacets() {
  const subjects = new Set();
  const collections = new Set();

  for (const record of records) {
    (record.subjects || []).forEach((subject) => subjects.add(subject));
    if (record.collection) collections.add(record.collection);
  }

  facetsEl.innerHTML = '';

  if (subjects.size > 0) {
    const subjectLabel = document.createElement('span');
    subjectLabel.textContent = 'Subjects:';
    subjectLabel.className = 'metadata-label';
    facetsEl.append(subjectLabel);
    subjects.forEach((subject) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = subject;
      button.dataset.facet = 'subject';
      button.dataset.value = subject;
      button.addEventListener('click', () => {
        setState({ subject: state.subject === subject ? null : subject });
      });
      facetsEl.append(button);
    });
  }

  if (collections.size > 0) {
    const collectionLabel = document.createElement('span');
    collectionLabel.textContent = 'Collections:';
    collectionLabel.className = 'metadata-label';
    facetsEl.append(collectionLabel);
    collections.forEach((collection) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = collection;
      button.dataset.facet = 'collection';
      button.dataset.value = collection;
      button.addEventListener('click', () => {
        setState({ collection: state.collection === collection ? null : collection });
      });
      facetsEl.append(button);
    });
  }

  updateFacetHighlights();
}

function updateFacetHighlights() {
  facetsEl.querySelectorAll('button').forEach((button) => {
    const facet = button.dataset.facet;
    const value = button.dataset.value;
    button.classList.toggle('active', state[facet] === value);
  });
}

function matchRecord(record) {
  const { query, subject, collection } = state;
  if (subject && !(record.subjects || []).includes(subject)) return false;
  if (collection && record.collection !== collection) return false;

  if (!query) return true;
  const haystack = [
    record.title,
    ...(record.creators || []),
    ...(record.subjects || [])
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function renderResults() {
  const matches = records.filter(matchRecord);
  resultsEl.innerHTML = '';

  if (matches.length === 0) {
    emptyStateEl.style.display = 'block';
    return;
  }

  emptyStateEl.style.display = 'none';

  for (const match of matches) {
    const article = document.createElement('article');
    article.className = 'card';

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = `${match.quality || 'Unrated'} edition`;
    article.append(badge);

    const heading = document.createElement('h3');
    const link = document.createElement('a');
    link.href = `../record/${match.id}/index.html`;
    link.textContent = match.title;
    heading.append(link);
    article.append(heading);

    const meta = document.createElement('p');
    meta.textContent = `${(match.creators || []).join(', ')} · ${match.year || 'n.d.'}`;
    article.append(meta);

    const collection = document.createElement('p');
    collection.textContent = match.collection || 'Unfiled collection';
    article.append(collection);

    resultsEl.append(article);
  }
}

searchInput?.addEventListener('input', (event) => {
  setState({ query: event.target.value });
});

resetButton?.addEventListener('click', () => {
  searchInput.value = '';
  setState({ query: '', subject: null, collection: null });
});

loadIndex();
