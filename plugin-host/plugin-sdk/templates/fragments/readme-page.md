
## The menu page (`frontend/page.tsx`)

A page of its own in the Valtimo menu, mounted once the plugin has a configuration. It fetches its
data exactly like the case surfaces do — `sdk.getPluginData("/summary")` → the
`request("/summary", …)` handler in `src/plugin.ts` → the `frontend_data` capability.

Two things are specific to a page, and both live in `manifest.json`:

- **`title` is a translation key**, not a literal. GZAC resolves `page.__BUNDLE_KEY__.title` against
  every locale bucket to build the menu label, so that key must exist in each of them — it does, in
  `translations`. Every other bundle type takes its title literally.
- **`icon`** is the menu icon class, e.g. `icon mdi mdi-view-dashboard`. Change it to any Material
  Design Icons class.

A page is not opened from a case, so its context carries no `documentId`. It carries the plugin
configuration id instead, which the page displays — that is what makes the app-level scope visible.
