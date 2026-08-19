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
import {validateEgressEntry} from "./egress.js";

/**
 * `pluginId` and `version` become path components (`<storage>/<pluginId>/<version>/`) and URL
 * segments, so they are restricted to a charset that cannot express a traversal or a hidden
 * directory: alphanumerics at both ends, and `.` `-` `_` only inside. That rejects `.`, `..`,
 * anything containing `/` or `\`, and any leading-dot name outright.
 *
 * `pluginId` is lowercase-only because a case-insensitive filesystem would fold `Foo` and `foo`
 * into one package directory while the database treats them as two distinct definitions.
 * `version` additionally allows uppercase and `+` so semver prerelease/build metadata such as
 * `1.0.0-RC1+build.5` stays expressible.
 */
export const PLUGIN_ID_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;
export const PLUGIN_VERSION_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._+-]*[A-Za-z0-9])?$/;
/** A logo is a plain file at the package root, in a format a browser renders as an image. */
export const PLUGIN_LOGO_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:svg|png|jpe?g)$/i;
export const MAX_PLUGIN_IDENTIFIER_LENGTH = 64;

/**
 * The `..` check is redundant against the anchored patterns for the dangerous cases (`.` and `..`
 * are already rejected because both ends must be alphanumeric), but it is kept so the rule reads as
 * "never `..`, anywhere" without the reader having to re-derive it from the regex.
 */
export function isValidPluginId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= MAX_PLUGIN_IDENTIFIER_LENGTH &&
    !value.includes("..") &&
    PLUGIN_ID_PATTERN.test(value)
  );
}

export function isValidPluginVersion(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= MAX_PLUGIN_IDENTIFIER_LENGTH &&
    !value.includes("..") &&
    PLUGIN_VERSION_PATTERN.test(value)
  );
}

export function isValidPluginLogo(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= MAX_PLUGIN_IDENTIFIER_LENGTH &&
    !value.includes("..") &&
    PLUGIN_LOGO_PATTERN.test(value)
  );
}

export function validatePluginManifest(manifest: unknown): string[] {
  const errors: string[] = [];

  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    return ["manifest.json must be a JSON object"];
  }

  const m = manifest as Record<string, unknown>;

  if (!isValidPluginId(m.pluginId)) {
    errors.push(
      `manifest.json 'pluginId' must be 1-${MAX_PLUGIN_IDENTIFIER_LENGTH} characters of lowercase letters, digits, '.', '-' or '_', starting and ending with a letter or digit (it is used as a directory and URL path segment)`
    );
  }
  if (!isValidPluginVersion(m.version)) {
    errors.push(
      `manifest.json 'version' must be 1-${MAX_PLUGIN_IDENTIFIER_LENGTH} characters of letters, digits, '.', '-', '_' or '+', starting and ending with a letter or digit (it is used as a directory and URL path segment)`
    );
  }
  // Optional — only the pack tool sets it. When present it names a file the host copies into the
  // stored package, so it may not name a path.
  if (m.logo !== undefined && !isValidPluginLogo(m.logo)) {
    errors.push(
      "manifest.json 'logo' must be a file name at the package root ending in .svg, .png, .jpg or .jpeg"
    );
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
      const egress = p.egress;
      if (egress !== undefined) {
        if (!Array.isArray(egress)) {
          errors.push("manifest.json 'permissions.egress' must be an array when present");
        } else {
          egress.forEach((entry, i) => {
            const reason = validateEgressEntry(entry);
            if (reason !== null) {
              errors.push(`manifest.json permissions.egress[${i}] ${reason}`);
            }
          });
          // Same shape as the endpoints→gzac_api rule: declaring destinations without the capability
          // that reaches them is always an authoring mistake.
          if (
            egress.length > 0 &&
            capabilities !== undefined &&
            Array.isArray(capabilities) &&
            !capabilities.includes("http_request")
          ) {
            errors.push(
              "manifest.json declares 'permissions.egress' but does not include 'http_request' in 'permissions.capabilities' — egress targets require the http_request capability"
            );
          }
        }
      }
    }
  }

  errors.push(...validateEgressTargetProperties(m.configurationSchema));

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

/**
 * Checks the `x-egress-target` markers in `configurationSchema`. The keyword tells GZAC that the
 * admin-supplied value of that property is an `http_request` destination, so GZAC derives an egress
 * grant from it at activation — the counterpart to `permissions.egress` for targets that differ per
 * environment. It only makes sense on a URI-shaped string property: GZAC has to parse the value into
 * an origin, and a property that never holds a URL would contribute nothing while looking like it
 * grants something.
 *
 * Only top-level properties are inspected, matching how GZAC walks the schema for `x-secret`.
 */
function validateEgressTargetProperties(configurationSchema: unknown): string[] {
  const errors: string[] = [];
  if (typeof configurationSchema !== "object" || configurationSchema === null || Array.isArray(configurationSchema)) {
    return errors;
  }
  const properties = (configurationSchema as Record<string, unknown>).properties;
  if (typeof properties !== "object" || properties === null || Array.isArray(properties)) {
    return errors;
  }

  for (const [name, value] of Object.entries(properties as Record<string, unknown>)) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) continue;
    const property = value as Record<string, unknown>;
    if (property["x-egress-target"] !== true) continue;
    if (property.type !== "string") {
      errors.push(
        `manifest.json configurationSchema.properties.${name} is marked 'x-egress-target' but is not a string property`
      );
    }
    if (property.format !== "uri") {
      errors.push(
        `manifest.json configurationSchema.properties.${name} is marked 'x-egress-target' but does not declare "format": "uri"`
      );
    }
  }

  return errors;
}
