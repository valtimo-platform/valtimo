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
 * Validates a plugin manifest. Shared by the pack tool (`valtimo-plugin-pack`, build-time gate) and
 * the plugin host's upload route (runtime gate) so the rules are defined once.
 *
 * The plugin's display name and description are sourced exclusively from per-locale translation
 * buckets — there are no top-level `name`/`description` fields — so every locale declared under
 * `translations` must carry both a non-empty `name` and a non-empty `description`. This guarantees
 * the GZAC management UI can always render a localised name/description for whichever language the
 * operator is using.
 *
 * Operates on the raw parsed JSON (untrusted input), not the typed `PluginManifest`. Its only import
 * is the dependency-free {@link FRONTEND_BUNDLE_TYPES} list, so it still pulls in none of the
 * plugin-author runtime and can be consumed by the pack tool and host upload route alike.
 *
 * @returns a list of human-readable error messages; an empty array means the manifest is valid.
 */

import {FRONTEND_BUNDLE_TYPES, HOST_CAPABILITIES} from "./models/types.js";

export function validatePluginManifest(manifest: unknown): string[] {
  const errors: string[] = [];

  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    return ["manifest.json must be a JSON object"];
  }

  const m = manifest as Record<string, unknown>;

  if (typeof m.pluginId !== "string" || m.pluginId.trim() === "") {
    errors.push("manifest.json must contain a non-empty 'pluginId'");
  }
  if (typeof m.version !== "string" || m.version.trim() === "") {
    errors.push("manifest.json must contain a non-empty 'version'");
  }
  // Written by the pack tool; optional so hand-rolled/older manifests stay valid.
  if (m.sdkVersion !== undefined && (typeof m.sdkVersion !== "string" || m.sdkVersion.trim() === "")) {
    errors.push("manifest.json 'sdkVersion' must be a non-empty string when present");
  }

  const translations = m.translations;
  if (typeof translations !== "object" || translations === null || Array.isArray(translations)) {
    errors.push(
      "manifest.json must contain a 'translations' object with at least one locale; 'name' and 'description' are defined per locale, not at the top level"
    );
    return errors;
  }

  const locales = Object.keys(translations as Record<string, unknown>);
  if (locales.length === 0) {
    errors.push("manifest.json 'translations' must declare at least one locale");
    return errors;
  }

  for (const locale of locales) {
    const bucket = (translations as Record<string, unknown>)[locale];
    if (typeof bucket !== "object" || bucket === null || Array.isArray(bucket)) {
      errors.push(`manifest.json translations.${locale} must be an object`);
      continue;
    }
    const b = bucket as Record<string, unknown>;
    if (typeof b.name !== "string" || b.name.trim() === "") {
      errors.push(`manifest.json translations.${locale} must contain a non-empty 'name'`);
    }
    if (typeof b.description !== "string" || b.description.trim() === "") {
      errors.push(`manifest.json translations.${locale} must contain a non-empty 'description'`);
    }
  }

  const permissions = m.permissions;
  if (permissions !== undefined) {
    if (typeof permissions !== "object" || permissions === null || Array.isArray(permissions)) {
      errors.push("manifest.json 'permissions' must be an object when present");
    } else {
      const p = permissions as Record<string, unknown>;
      const capabilities = p.capabilities;
      if (capabilities !== undefined) {
        if (!Array.isArray(capabilities)) {
          errors.push("manifest.json 'permissions.capabilities' must be an array when present");
        } else {
          for (let i = 0; i < capabilities.length; i++) {
            const cap = capabilities[i];
            if (typeof cap !== "string" || !(HOST_CAPABILITIES as readonly string[]).includes(cap)) {
              errors.push(
                `manifest.json permissions.capabilities[${i}] must be one of: ${HOST_CAPABILITIES.join(", ")}`
              );
            }
          }
        }
      }
      const endpoints = p.endpoints;
      if (endpoints !== undefined) {
        if (!Array.isArray(endpoints)) {
          errors.push("manifest.json 'permissions.endpoints' must be an array when present");
        }
        if (capabilities !== undefined && Array.isArray(capabilities) && !capabilities.includes("gzac_api")) {
          errors.push(
            "manifest.json declares 'permissions.endpoints' but does not include 'gzac_api' in 'permissions.capabilities' — endpoints require the gzac_api capability"
          );
        }
      }
    }
  }

  const actions = m.actions;
  if (actions !== undefined) {
    if (!Array.isArray(actions)) {
      errors.push("manifest.json 'actions' must be an array when present");
    } else {
      actions.forEach((action, index) => {
        if (typeof action !== "object" || action === null || Array.isArray(action)) {
          errors.push(`manifest.json actions[${index}] must be an object`);
          return;
        }
        const a = action as Record<string, unknown>;
        const outputs = a.outputs;
        if (outputs !== undefined) {
          if (!Array.isArray(outputs)) {
            errors.push(`manifest.json actions[${index}].outputs must be an array when present`);
          } else {
            const seen = new Set<string>();
            outputs.forEach((output, outputIndex) => {
              if (typeof output !== "string" || output.trim() === "") {
                errors.push(
                  `manifest.json actions[${index}].outputs[${outputIndex}] must be a non-empty string`
                );
                return;
              }
              if (seen.has(output)) {
                errors.push(
                  `manifest.json actions[${index}].outputs must contain unique keys; '${output}' is duplicated`
                );
              }
              seen.add(output);
            });
          }
        }
      });
    }
  }

  const frontendBundles = m.frontendBundles;
  if (frontendBundles !== undefined) {
    if (!Array.isArray(frontendBundles)) {
      errors.push("manifest.json 'frontendBundles' must be an array when present");
    } else {
      frontendBundles.forEach((bundle, index) => {
        if (typeof bundle !== "object" || bundle === null || Array.isArray(bundle)) {
          errors.push(`manifest.json frontendBundles[${index}] must be an object`);
          return;
        }
        const fb = bundle as Record<string, unknown>;
        if (typeof fb.type !== "string" || !(FRONTEND_BUNDLE_TYPES as readonly string[]).includes(fb.type)) {
          errors.push(
            `manifest.json frontendBundles[${index}].type must be one of: ${FRONTEND_BUNDLE_TYPES.join(", ")}`
          );
        }
        if (typeof fb.path !== "string" || fb.path.trim() === "") {
          errors.push(`manifest.json frontendBundles[${index}] must contain a non-empty 'path'`);
        }
      });
    }
  }

  return errors;
}
