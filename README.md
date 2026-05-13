# QA-Hub_TCMS

React + Vite app for test case management.

## Scripts

| Command        | Description              |
| -------------- | ------------------------ |
| `npm run dev`  | Local dev server         |
| `npm run build`| Production build         |
| `npm run lint` | ESLint                   |
| `npm run deploy` | Publish `dist` via gh-pages |

## GitHub Pages

Production builds set `base: '/QA-Hub_TCMS/'` in `vite.config.js` so assets load correctly for a project site.

`.github/workflows/deploy.yml` builds and publishes `./dist` to the `gh-pages` branch (works for any repo name).  
Do not add a second Pages workflow that uploads the raw repo — that serves unbuilt `index.html` and breaks the app.

**Live site:** [https://dmytroqaengineer.github.io/QA-Hub_TCMS/](https://dmytroqaengineer.github.io/QA-Hub_TCMS/)

**Pages settings:** Repository → **Settings** → **Pages** → **Build and deployment** → set source to **Deploy from a branch**, branch **`gh-pages`**, folder **`/ (root)`**.  
If the source is **`main`** and **`/`**, GitHub serves the **source** `index.html`, which still points at `/src/main.jsx` — that file is never built for the web, so you get a blank page and **404** (often shown as `main.js` or `main.jsx` in DevTools).

After fixing the source, run the **Deploy to GitHub Pages** workflow (or push to `main`) and wait a minute for the site to update.

### Blank page but Pages points at `gh-pages`

If **View Page Source** still shows `<script … src="/src/main.jsx">`, the `gh-pages` branch holds the **wrong tree** (repo root), not `npm run build` output.

1. **Remove the other workflow**  
   In **Actions**, open **Deploy static content to Pages** (or any workflow that uploads `.` / the whole repo). Either delete `.github/workflows/static.yml` (or similar) on the default branch, or disable the workflow. That job republishes unbuilt files and matches the “deployed by Deploy static content to Pages” line in Settings.

2. **Republish only `dist`**  
   Push these workflow changes, then either push to `main` or run **Actions → Deploy to GitHub Pages → Run workflow**. This repo uses [peaceiris/actions-gh-pages](https://github.com/peaceiris/actions-gh-pages) with `publish_dir: ./dist` and `force_orphan: true` so `gh-pages` contains only the Vite build.

3. **Sanity-check on GitHub**  
   On the **`gh-pages`** branch, open `index.html`. It must contain `/QA-Hub_TCMS/assets/…` (hashed JS/CSS), not `/src/main.jsx`.

**Local fallback:** `npm run build && npm run deploy` (requires SSH access to the remote in `package.json`).

## CSV export / import (Xray & Zephyr)

**Export CSV** opens a modal with three formats:

| Tab | Use case |
| --- | --- |
| **QA Hub (round-trip)** | One row per test; **Import CSV** in the sidebar can re-import this file. |
| **Xray Test Importer** | Multi-row manual tests: same `Test Case Identifier` = one test. `Component` is `Team / Suite`. Map columns in [Xray’s Test Case Importer](https://docs.getxray.app/display/XRAYCLOUD/Importing+Tests+using+Test+Case+Importer). |
| **Zephyr Squad** | Columns align with [Zephyr Squad CSV import](https://support.smartbear.com/zephyr-squad-cloud/docs/en/test-cases/import-test-cases.html) (`Name`, `Folder` = `Team/Suite`, step columns). Map fields in the Jira import wizard. |

Save files as UTF-8 `.csv`. Jira-side priority/status values may need mapping to your project’s allowed values.

## Stack

- [Vite](https://vite.dev/) + [React 19](https://react.dev/)
- [Firebase](https://firebase.google.com/) (Realtime DB via `src/storage.js`)
