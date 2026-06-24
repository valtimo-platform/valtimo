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
 * Operates on the raw parsed JSON (untrusted input), not the typed `PluginManifest`. This module
 * intentionally has no imports so it can be consumed without pulling in the plugin-author runtime.
 *
 * @returns a list of human-readable error messages; an empty array means the manifest is valid.
 */
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

  return errors;
}
