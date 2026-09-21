# Front-end migration

{% hint style="info" %}
Every step on this page is optional. The on-demand loading of the heavy editors comes
automatically with the upgraded `@valtimo/*` packages — no code changes needed. The steps below
only remove leftovers from the application shell that Valtimo no longer uses. Skipping them breaks
nothing; the application only keeps downloading files it does not use.
{% endhint %}

## Faster first page load

### 1. Remove unused global scripts

Remove the following entries from the `scripts` array in `angular.json`, if present:

* `node_modules/select2/dist/js/select2.min.js`
* `node_modules/components-jqueryui/jquery-ui.min.js`
* `node_modules/dmn-js/dist/dmn-modeler.development.js`
* the `ValtimoBPMNModeler.js` entry pointing into the app's `assets/bpmn/` folder

None of these are used by Valtimo 13.45.0. The `dmn-js` entry matters most: the DMN editor now
loads its own copy on demand, so keeping the entry ships the editor twice. The
`ValtimoBPMNModeler.js` file under the app's assets folder can be deleted as well.

### 2. Ship only the used part of the code editor

In the `assets` array of `angular.json`, narrow the Monaco editor entry from `"glob": "**/*"` to
`"glob": "min/**/*"`:

```json
{
  "glob": "min/**/*",
  "input": "node_modules/monaco-editor",
  "output": "assets/monaco-editor"
}
```

The editor loads from `assets/monaco-editor/min/vs`; the rest of the package only makes the
deployment bigger.

### 3. Trim old browser polyfills

Remove the `core-js/es/...` imports from `polyfills.ts`. They exist for browsers Valtimo no longer
supports; every supported browser ships these features natively.

### 4. Cache the hashed bundles

The application is now split into more, smaller files, which makes proper caching more valuable:
bundle files carry a content hash and can be cached indefinitely, while `index.html` and
`assets/config.js` must never be cached. When serving the frontend with your own web server
configuration, the reference nginx configuration in the Valtimo repository
(`frontend/conf/default.conf`) shows the corresponding rules:

```nginx
# Hashed bundles are immutable
location ~ ^/[^/]+\.(js|css)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# These point at the current bundles and must never be cached
location = /index.html { add_header Cache-Control "no-store"; }
location = /assets/config.js { add_header Cache-Control "no-store"; }
```
