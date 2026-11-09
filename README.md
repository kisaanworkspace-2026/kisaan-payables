# Kisaan Payables (PWA)

Installable app, hosted free on GitHub Pages. Built in phases:

| Phase | Screen | Status |
|---|---|---|
| 1 | Welcome + install + offline shell | Done |
| 2 | Dashboard | next |
| 3 | All Vendors | |
| 4 | All Invoices | |
| 5 | Reports | |
| 6 | Fixes and extras | |

## Deploy on GitHub Pages
1. Create a repo (e.g. `kisaan-payables`), upload everything in this folder (keep the folders; include `.nojekyll`).
2. Repo > Settings > Pages > Source: **Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
3. Open `https://<your-username>.github.io/kisaan-payables/` on your phone.
4. Android Chrome: tap **Install App**. iPhone Safari: Share > Add to Home Screen.

## Add your pictures
Copy your own files into `assets/`:
- `kisaan-logo.png` (the logo shown on Welcome)
- `welcome-bg.png` (the background, formerly `welcome-bg-kisaan.png`)

Without them the app shows a text logo and a green gradient.

## Releasing an update
Change `VERSION` in `sw.js` (e.g. `kisaan-payables-v1.0.1`) and commit. Users see an "Update" prompt.
