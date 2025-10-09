# Waypoint Digital Library

This repository provides a zero-dependency static library site that you can deploy straight to GitHub Pages. Everything — the home page, search interface, record detail views, and placeholder downloads — lives in the committed `docs/` folder so Pages can publish it without running any workflows. When you update metadata, a small Node.js script rebuilds the HTML and refreshed search index for you.

## Repository layout

- `docs/` — Generated HTML, CSS, JavaScript, and placeholder book downloads ready for GitHub Pages.
- `_records/` — JSON catalog records. Edit these to update metadata and copy.
- `books/` — Source folders for reading editions (cover art, markdown chapters, etc.).
- `scripts/` — Lightweight Node helpers (`validate-records.mjs`, `build-site.mjs`) that only use the Node standard library.

## Local workflow

You do not need `npm install`. Node 18+ is enough for the helper scripts.

```bash
node scripts/validate-records.mjs   # optional metadata lint
node scripts/build-site.mjs         # regenerates docs/ and search/index.json
```

`build-site.mjs` rebuilds every HTML page, refreshes the search index at both `search/index.json` and `docs/search/index.json`, and regenerates the record detail views under `docs/record/<id>/`.

## Publish to GitHub Pages

1. Commit your changes and push them to GitHub.
2. In **Settings → Pages**, choose **Deploy from a branch** and select the branch that contains the site (for example `main`).
3. Set the folder to `/docs` and save. The generator drops a `.nojekyll` file both at the repository root and inside `docs/` so GitHub Pages skips the default Jekyll build step even if the Pages configuration accidentally targets the root. The build script also creates lightweight redirects at the repository root (`index.html`, `record/<id>/`, etc.), so the site still works if GitHub Pages is configured to publish from the root by mistake.
4. GitHub Pages will serve the files exactly as committed. Whenever you edit records, run `node scripts/build-site.mjs`, commit the regenerated `docs/` outputs (including `.nojekyll` and the root-level redirects), and push again.

## Updating content

- Edit catalog records in `_records/`, then rerun `node scripts/build-site.mjs` to rebuild the site.
- Replace the placeholder book files under `docs/books/<slug>/` with your actual HTML/EPUB/PDF outputs.
- Adjust site styling or layout by editing the assets in `docs/assets/`.

## License

Released under the MIT License. See `LICENSE` for details.
