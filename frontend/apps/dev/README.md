# Developer console (frontend)

The web interface used for **local development**. It includes extra showcase
pages and demo content, and is the variant served by default. Use it together
with the backend developer console.

## How to start

From the `frontend` folder (after `npm install`, and with a backend running):

```bash
npm start
```

Then open <http://localhost:4200>.

## Plugin packages from npm

`@epistola.app/valtimo-plugin` is wired into the local dev build through
`src/app/app-plugins.ts`. A published plugin imports the `@valtimo/*` libraries
as bare specifiers, which do not resolve from inside `node_modules` against the
workspace links. So `npm install` (its `postinstall` step,
`scripts/copy-dev-plugin-packages.js`) copies the package to
`frontend/dev-plugin-packages/`, and `tsconfig.json` maps it there. If
`npm start` reports `Could not resolve "@valtimo/plugin"` (or another
`@valtimo/*` library) inside `node_modules/@epistola.app/valtimo-plugin`, that
copy is missing: run `npm run postinstall` once.
