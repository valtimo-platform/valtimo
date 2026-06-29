const {withNativeFederation, share} = require('@angular-architects/native-federation/config');

/**
 * Host (shell) Native Federation config.
 *
 * The NF builder resolves this file relative to the build target's `tsConfig`
 * directory (here: `src/`), so it must live next to `tsconfig.app.json`.
 *
 * We deliberately do NOT use `shareAll()`. The host's package.json pulls in a
 * very large dependency graph (bpmn-js, dmn-js, table-js, formio, carbon, …)
 * with broken peer-dep chains; asking NF/esbuild to scan and share all of them
 * produces a wall of unrelated resolution errors. Instead we share only the
 * runtime that an extension's remote bundle declares as shared, so the remote's
 * bare `@angular/*` / `rxjs` / `@valtimo/*` imports resolve to the HOST's
 * already-loaded instances (one Angular instance on the page, and stable
 * InjectionToken identity so PLUGINS_TOKEN / CASE_MANAGEMENT_TAB_TOKEN
 * contributions register against the host's services).
 */
module.exports = withNativeFederation({
  shared: {
    ...share({
      '@angular/animations': {singleton: true, strictVersion: true, requiredVersion: 'auto'},
      '@angular/common': {singleton: true, strictVersion: true, requiredVersion: 'auto'},
      '@angular/compiler': {singleton: true, strictVersion: true, requiredVersion: 'auto'},
      '@angular/core': {singleton: true, strictVersion: true, requiredVersion: 'auto'},
      '@angular/forms': {singleton: true, strictVersion: true, requiredVersion: 'auto'},
      '@angular/platform-browser': {singleton: true, strictVersion: true, requiredVersion: 'auto'},
      '@angular/platform-browser-dynamic': {
        singleton: true,
        strictVersion: true,
        requiredVersion: 'auto',
      },
      '@angular/router': {singleton: true, strictVersion: true, requiredVersion: 'auto'},
      rxjs: {singleton: true, strictVersion: true, requiredVersion: 'auto'},
      tslib: {singleton: false, strictVersion: false, requiredVersion: 'auto'},
      'zone.js': {singleton: true, strictVersion: true, requiredVersion: 'auto'},
      // ngx-translate provides root singletons (TranslateService + TranslateStore,
      // the latter supplied by TranslateModule.forRoot()). The shared @valtimo/plugin
      // chunk and the remote both use it via PluginTranslatePipe, so it must be a
      // single instance — otherwise a chunk's TranslateService can't find the app's
      // TranslateStore ("No provider for TranslateStore").
      '@ngx-translate/core': {singleton: true, strictVersion: false, requiredVersion: 'auto'},
      // ngx-logger likewise provides a root singleton (NGXLogger + the
      // TOKEN_LOGGER_CONFIG supplied by LoggerModule.forRoot()). @valtimo/components
      // / security / resource (bundled into the @valtimo/plugin chunk) use it, so it
      // must be a single instance or NGXLogger can't find its config token.
      'ngx-logger': {singleton: true, strictVersion: false, requiredVersion: 'auto'},
      // keycloak-angular's KeycloakService is an app-provided root service injected
      // by @valtimo/components' MenuService (and others). A duplicate copy in a
      // mapped chunk is a different class/token than the one the app provides →
      // "No provider for KeycloakService". Share it as a singleton.
      'keycloak-angular': {singleton: true, strictVersion: false, requiredVersion: 'auto'},
      // Sharing @angular/common externalises ALL of its subpaths (esbuild matches
      // by prefix), including the locale-data modules the host imports via
      // `registerLocaleData(import '@angular/common/locales/nl')`. That subpath
      // must be mapped explicitly or it resolves to nothing at runtime under shim
      // mode. (NF's shareAngularLocales helper hardcodes a `.mjs` entry point that
      // doesn't exist in this Angular build, so we point at the real `nl.js`.)
      '@angular/common/locales/nl': {
        singleton: false,
        strictVersion: false,
        requiredVersion: 'auto',
        packageInfo: {entryPoint: 'node_modules/@angular/common/locales/nl.js'},
      },
    }),
  },

  // All @valtimo workspace libs the host shares are path-MAPPINGS, never `share()`:
  // they're resolved via tsconfig `paths`, and only NF's shared-mappings plugin
  // externalises path-mapped imports from the main bundle consistently. Using
  // `share()` for `@valtimo/plugin` left the main bundle with its OWN copy
  // (PluginService etc.) alongside the shared chunk → `No provider for PLUGINS_TOKEN`
  // within the host. As mappings they're single instances, so the host's own pages
  // and the remote both see the same PLUGINS_TOKEN / ConfigService / valtimoConfig.
  //
  // Mappings carry no version, so the weather remote (which keys on
  // `@valtimo/plugin@13.34.0`) won't auto-dedupe to these. That version-key bridge
  // is done at load time in ExtensionService.aliasRemoteSharedToHost (it points the
  // remote's declared shared versions at the host's already-loaded chunk URLs).
  sharedMappings: [
    '@valtimo/plugin',
    '@valtimo/shared',
    '@valtimo/components',
    '@valtimo/process',
    '@valtimo/document',
    '@valtimo/security',
    '@valtimo/resource',
  ],

  skip: [
    'rxjs/ajax',
    'rxjs/fetch',
    'rxjs/testing',
    'rxjs/webSocket',
    // Node-only deps that occasionally show up in scanned transitives:
    'zone.js/node',
    'zone.js/testing',
  ],
});
