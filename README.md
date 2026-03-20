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

**Live site:** [https://dmytroqaengineer.github.io/QA-Hub_TCMS/](https://dmytroqaengineer.github.io/QA-Hub_TCMS/)

## Stack

- [Vite](https://vite.dev/) + [React 19](https://react.dev/)
- [Firebase](https://firebase.google.com/) (Realtime DB via `src/storage.js`)
