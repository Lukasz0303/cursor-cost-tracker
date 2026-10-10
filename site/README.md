# Landing page

Public page for Cursor Cost Tracker, same idea as [Cursor Usage Dashboard](https://iair0007.github.io/cursor-usage/): one static HTML file, real screenshots, install steps, feature scenes, privacy. Hosting is **GitHub Pages**, which is free for this public repository.

The folder `docs/` stays local-only (social copy, gitignored). This site lives in `site/` so it can be committed.

## What goes live

| Piece | Where |
| --- | --- |
| Page | `site/index.html`, `site/styles.css`, `site/main.js` |
| Icon | `icon.png` (copied at publish time) |
| Scenes | files listed in `site/pages-assets.txt` |
| Release gallery | folders under `screenshots/releases/<semver>/` (copied + `releases-manifest.json` at publish/preview) |
| Public URL | https://cursorcosttracker.com/ (custom domain → GitHub Pages) |
| Fallback Pages URL | https://lukasz0303.github.io/cursor-cost-tracker/ |

Download count, version, and rating start from the fallback in the HTML (**1.0.7**) and refresh from `https://open-vsx.org/api/lukasz0303/cursor-cost-tracker` when the browser allows it. Until 1.0.7 is on Open VSX, that request still shows the published version.

Screenshots are shown at their real aspect ratio. There is no walkthrough video.

## Release screenshots

Put numbered PNGs in `screenshots/releases/<semver>/` (for example `screenshots/releases/1.0.6/1.png`). Preview and GitHub Pages run `site/copy-releases.sh`, which copies those folders and writes `releases-manifest.json`. The Screenshots section defaults to the highest semver and shows chips for every release folder. No HTML edit is needed when you add a version.

## Preview locally

```bash
sh site/preview.sh
```

Open http://127.0.0.1:4173. On macOS the script opens that address.

## Publish (once)

1. Merge `site/` and `.github/workflows/pages.yml` to **`main`** and push. The workflow only runs on `main`.
2. GitHub → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Actions → **Deploy landing page** should go green. The environment URL is the live page.
4. After the custom domain loads: set `homepage` in `package.json` to `https://cursorcosttracker.com/` and publish that version to Open VSX (needed for Cursor publisher verification).

Later edits to `site/**`, `screenshots/**`, or `icon.png` on `main` republish automatically. **Run workflow** works without a path change.

Pages does not bill for this traffic. The repository must stay public. Custom domain is configured in GitHub → Settings → Pages (and DNS at the registrar, e.g. Cloudflare).
