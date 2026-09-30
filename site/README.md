# Landing page

Public page for Cursor Cost Tracker, same idea as [Cursor Usage Dashboard](https://iair0007.github.io/cursor-usage/): one static HTML file, real screenshots, install steps, feature scenes, privacy. Hosting is **GitHub Pages**, which is free for this public repository.

The folder `docs/` stays local-only (social copy, gitignored). This site lives in `site/` so it can be committed.

## What goes live

| Piece | Where |
| --- | --- |
| Page | `site/index.html`, `site/styles.css`, `site/main.js` |
| Icon | `icon.png` (copied at publish time) |
| Scenes | files listed in `site/pages-assets.txt` |
| URL after the first deploy | https://lukasz0303.github.io/cursor-cost-tracker/ |

Download count, version, and rating start from the Open VSX snapshot in the HTML (**1,522** downloads, **1.0.5**, rating **5.0** / 2 reviews on 27 Sep 2026) and refresh from `https://open-vsx.org/api/lukasz0303/cursor-cost-tracker` when the browser allows it.

Screenshots are shown at their real aspect ratio. There is no walkthrough video.

## Preview locally

```bash
sh site/preview.sh
```

Open http://127.0.0.1:4173. On macOS the script opens that address.

## Publish (once)

1. Merge `site/` and `.github/workflows/pages.yml` to **`main`** and push. The workflow only runs on `main`.
2. GitHub → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Actions → **Deploy landing page** should go green. The environment URL is the live page.
4. Optional, after the URL loads: set `homepage` in `package.json` to `https://lukasz0303.github.io/cursor-cost-tracker/`.

Later edits to `site/**`, `screenshots/**`, or `icon.png` on `main` republish automatically. **Run workflow** works without a path change.

Pages does not bill for this traffic. The repository must stay public. A custom domain would be a `CNAME` later; it is not required.
