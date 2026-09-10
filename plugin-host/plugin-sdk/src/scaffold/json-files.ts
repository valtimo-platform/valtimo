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

/**
 * The three JSON files a generated plugin needs. They are assembled as objects rather than
 * templated as text, because each one gains and loses whole keys per selected part — conditional
 * JSON as string substitution is unreadable and impossible to assert on.
 *
 * Nothing here knows what a case tab or a menu page is: every per-part effect comes from
 * `parts.ts`, and this file only decides where those effects land and in what order.
 *
 * `buildManifest` output is checked by `validatePluginManifest` in the unit tests for every
 * combination of parts, so the scaffold and the pack tool can never disagree about what a valid
 * plugin is.
 */

import type {PluginManifest, PluginTranslations} from "../models/index.js";
import {BASE_DEV_DEPENDENCIES, FRONTEND_DEV_DEPENDENCIES} from "./dependencies.js";
import type {ScaffoldOptions} from "./options.js";
import {hasFrontend, selectedParts} from "./parts.js";

/**
 * `SERVICE_TASK_START` is a GZAC `ActivityTypeWithEventName` constant: it makes the action
 * selectable on a BPMN service task, which is where a scaffolded plugin's first action belongs.
 */
const DEFAULT_ACTIVITY_TYPES = ["SERVICE_TASK_START"];

/**
 * The base manifest declares **every** key in its final order, including the ones only a part
 * fills, and the unused slots are dropped at the end. Assigning a fresh key would append it, so a
 * plugin's manifest would come out in a different key order depending on what was selected.
 */
export function buildManifest(options: ScaffoldOptions): PluginManifest {
  const {pluginId, version, name, description} = options;

  const manifest: PluginManifest = {
    pluginId,
    version,
    ...(options.provider === undefined ? {} : {provider: options.provider}),
    translations: buildTranslations(options),
    configurationSchema: undefined,
    permissions: {capabilities: ["log"]},
    frontendBundles: [],
    actions: [
      {
        key: pluginId,
        title: name,
        description,
        activityTypes: DEFAULT_ACTIVITY_TYPES,
        properties: [{key: "greeting", type: "string" as const, required: false}],
      },
    ],
    eventSubscriptions: undefined,
  };

  for (const {descriptor, ctx} of selectedParts(options)) {
    for (const capability of descriptor.capabilities) {
      const capabilities = manifest.permissions?.capabilities;
      // Declared once however many parts ask for it — three bundle types want `frontend_data`.
      if (capabilities !== undefined && !capabilities.includes(capability)) {
        capabilities.push(capability);
      }
    }
    descriptor.applyToManifest(manifest, ctx);
  }

  if (manifest.configurationSchema === undefined) delete manifest.configurationSchema;
  if (manifest.frontendBundles?.length === 0) delete manifest.frontendBundles;
  if (manifest.eventSubscriptions === undefined) delete manifest.eventSubscriptions;
  return manifest;
}

/**
 * One bucket per locale. `name` and `description` are copied into every locale rather than left out
 * of the non-default ones: the validator requires both in each declared bucket, so a bucket without
 * them would fail the pack tool, and a copied English string is an obvious "translate me".
 */
function buildTranslations(options: ScaffoldOptions): Record<string, PluginTranslations> {
  const translations: Record<string, PluginTranslations> = {};
  for (const locale of options.locales) {
    const bucket: PluginTranslations = {
      name: options.name,
      description: options.description,
    };
    for (const {descriptor, ctx} of selectedParts(options)) {
      const titleKey = descriptor.titleKey(ctx);
      if (titleKey !== null) bucket[titleKey] = options.name;
      Object.assign(bucket, descriptor.strings[locale] ?? descriptor.strings.en ?? {});
    }
    translations[locale] = bucket;
  }
  return translations;
}

export interface GeneratedPackageJson {
  name: string;
  version: string;
  description: string;
  private: true;
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
}

/**
 * No `"type": "module"` and no `license` field. The first matches the reference sample, whose
 * CommonJS output from esbuild this pairing is built for; the second is deliberate — the generated
 * project belongs to its author, so the scaffold does not pick a licence for them.
 */
export function buildPackageJson(options: ScaffoldOptions): GeneratedPackageJson {
  const usesFrontend = hasFrontend(options);
  const devDependencies: Record<string, string> = {
    ...BASE_DEV_DEPENDENCIES,
    "@valtimo/plugin-sdk": options.sdkSpec,
    ...(usesFrontend ? FRONTEND_DEV_DEPENDENCIES : {}),
  };

  return {
    name: options.pluginId,
    version: options.version,
    description: options.description,
    private: true,
    scripts: {
      build: "valtimo-plugin-build --input src/plugin.ts --output dist/plugin.wasm",
      pack: "valtimo-plugin-pack --wasm dist/plugin.wasm --output dist",
      "build:pack": "npm run build && npm run pack",
    },
    // Sorted so the file is stable to diff and to assert on, whatever order the parts added keys in.
    devDependencies: sortKeys(devDependencies),
  };
}

export interface GeneratedTsConfig {
  compilerOptions: Record<string, unknown>;
  include: string[];
  exclude: string[];
}

/**
 * Type-checking only: `npm run build` compiles with esbuild + extism-js, so tsc never emits here
 * and the config carries `noEmit` instead of `outDir`/`rootDir` (a `rootDir` of `src` would make
 * every `frontend/**` file an error).
 *
 * `moduleResolution: "bundler"` rather than the reference sample's `"node"`, because the frontend
 * bundles import the `@valtimo/plugin-sdk/frontend` **subpath**, and only the modern resolvers read
 * a package's `exports` map. The sample gets away with `"node"` only because its `include` leaves
 * `frontend/` out — so it never type-checks its own bundles.
 */
export function buildTsConfig(options: ScaffoldOptions): GeneratedTsConfig {
  const usesFrontend = hasFrontend(options);
  return {
    compilerOptions: {
      target: "ES2020",
      module: "ES2020",
      moduleResolution: "bundler",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      noEmit: true,
      ...(usesFrontend ? {jsx: "react-jsx"} : {}),
    },
    include: ["src/**/*", ...(usesFrontend ? ["frontend/**/*"] : [])],
    exclude: ["node_modules", "dist"],
  };
}

function sortKeys(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : 1)));
}
