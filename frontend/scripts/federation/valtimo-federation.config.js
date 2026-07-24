/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const {withNativeFederation, share} = require('@angular-architects/native-federation/config');

/**
 * Shared Native Federation host (console app) build configuration.
 *
 * Every app's own `federation.config.js` is a thin wrapper that calls this
 * factory, so the host federation setup lives in ONE place. The NF builder
 * resolves each app's config relative to the build target's `tsConfig`
 * directory (`src/`), which is why the per-app file must physically live next
 * to `tsconfig.app.json` and merely re-export what this factory returns.
 *
 * We deliberately do NOT use `shareAll()`. The package.json pulls in a very large
 * dependency graph (bpmn-js, dmn-js, table-js, formio, carbon, …) with broken
 * peer-dep chains; asking NF/esbuild to scan and share all of them produces a wall
 * of unrelated resolution errors. Instead we share the Angular runtime plus a few
 * cross-cutting singletons, and map the @valtimo workspace libs, so the
 * application resolves its bare `@angular/*` / `rxjs` / `@valtimo/*` imports to a
 * single shared instance of each — one Angular instance on the page and consistent
 * DI token identity (services provided once aren't duplicated).
 *
 * NOTE (NF v4 upgrade): on v4, `ignoreUnusedDeps` (default on) scans and shares
 * only the deps actually used, which is the reason we hand-curate `share()` here.
 * Re-evaluate switching to `shareAll()` + overrides when upgrading.
 */
function createValtimoFederationConfig(overrides = {}) {
  return withNativeFederation({
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
        // the latter supplied by TranslateModule.forRoot()). It must be a single
        // instance, or a separately-built chunk's TranslateService can't find the
        // app's TranslateStore ("No provider for TranslateStore").
        '@ngx-translate/core': {singleton: true, strictVersion: false, requiredVersion: 'auto'},
        // ngx-logger likewise provides a root singleton (NGXLogger + the
        // TOKEN_LOGGER_CONFIG supplied by LoggerModule.forRoot()), used across the host
        // and the mapped @valtimo libs, so it must be a single instance or NGXLogger
        // can't find its config token.
        'ngx-logger': {singleton: true, strictVersion: false, requiredVersion: 'auto'},
        // keycloak-angular's KeycloakService is an app-provided root service used by
        // several @valtimo libs. A duplicate copy in a mapped chunk would be a
        // different class/token than the one the app provides ("No provider for
        // KeycloakService"), so share it as a singleton.
        'keycloak-angular': {singleton: true, strictVersion: false, requiredVersion: 'auto'},
        // ---------------------------------------------------------------------
        // NF-INTERNAL — REVISIT ON NATIVE FEDERATION UPGRADE (v3 -> v4)
        // Sharing @angular/common externalises ALL of its subpaths (esbuild matches
        // by prefix), including the locale-data modules imported via
        // `registerLocaleData(import '@angular/common/locales/nl')`. That subpath
        // must be mapped explicitly, or the browser can't resolve that bare specifier
        // once @angular/common is externalised. (NF's shareAngularLocales helper
        // hardcodes a `.mjs` entry point that doesn't exist in this Angular build, so
        // we point at the real `nl.js`.) On Angular 22 the locale files ARE ESM
        // (`.mjs`), so re-check whether this workaround is still needed on upgrade.
        // ---------------------------------------------------------------------
        '@angular/common/locales/nl': {
          singleton: false,
          strictVersion: false,
          requiredVersion: 'auto',
          packageInfo: {entryPoint: 'node_modules/@angular/common/locales/nl.js'},
        },
      }),
      ...(overrides.shared ?? {}),
    },

    // The @valtimo workspace libs are path-MAPPINGS, never `share()`: they're
    // resolved via tsconfig `paths`, and only NF's shared-mappings plugin externalises
    // path-mapped imports from the main bundle consistently. (Using `share()` for one
    // would leave the main bundle with its OWN copy alongside the shared chunk, so
    // separately-built chunks would see different instances of that lib's
    // services/tokens.) As mappings they stay single instances within the federated
    // build.
    sharedMappings: [
      '@valtimo/plugin',
      '@valtimo/shared',
      '@valtimo/components',
      '@valtimo/process',
      '@valtimo/document',
      '@valtimo/security',
      '@valtimo/resource',
      ...(overrides.sharedMappings ?? []),
    ],

    skip: [
      'rxjs/ajax',
      'rxjs/fetch',
      'rxjs/testing',
      'rxjs/webSocket',
      // Node-only deps that occasionally show up in scanned transitives:
      'zone.js/node',
      'zone.js/testing',
      ...(overrides.skip ?? []),
    ],
  });
}

module.exports = {createValtimoFederationConfig};
