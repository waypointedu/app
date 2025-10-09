# Waypoint Digital Library

This repository now ships as a purely static site so you can publish to GitHub Pages without any build tooling or GitHub Actions.
All pages, search assets, and download files already live inside the `docs/` folder, so Pages can serve them directly from the `main` branch (or any branch you choose).

## What's included

- `docs/` — Production-ready HTML, CSS, and JavaScript. Upload this folder to GitHub Pages.
- `_records/` — JSON catalog records used to regenerate the search index.
- `books/` — Source materials for your reading editions.
- `scripts/` — Small Node.js helpers for rebuilding the search index or validating records (no dependencies required).

## Getting started

You do not need to run `npm install`. Node's built-in runtime is enough for the helper scripts.

```bash
node scripts/validate-records.mjs
node scripts/build-search-index.mjs
```

`build-search-index.mjs` writes the catalog index to both `search/index.json` and `docs/search/index.json`, keeping the static site in sync with your record updates.

## Publishing to GitHub Pages

1. Commit the repository and push to GitHub.
2. In **Settings → Pages**, choose **Deploy from a branch** and select the branch containing your site (for example `main`).
3. Set the folder to `/docs` and save.
4. GitHub Pages will serve the static files exactly as committed. Whenever you edit records or pages, rerun `node scripts/build-search-index.mjs`, commit the changes under `docs/`, and push again.

## Updating content

- Edit existing records by updating the JSON files in `_records/` and rerun the build script.
- Replace the placeholder book files under `docs/books/<slug>/` with your actual HTML/EPUB/PDF outputs.
- Update or add static pages directly within `docs/` — they are plain HTML files with lightweight CSS.

## License

Released under the MIT License. See `LICENSE` for details.
