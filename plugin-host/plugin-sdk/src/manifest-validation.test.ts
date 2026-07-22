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

import {describe, expect, it} from "vitest";
import {validatePluginManifest} from "./manifest-validation";

/**
 * `validatePluginManifest` is the single rule set enforced at BOTH the pack tool (build-time) and
 * the host upload route (runtime) — plan §9. These cases pin that shared contract so the two gates
 * cannot drift.
 */
describe("validatePluginManifest", () => {
  const validManifest = () => ({
    pluginId: "case-summary",
    version: "0.1.0",
    translations: {
      en: { name: "Case Summary", description: "Shows a case summary" },
      nl: { name: "Zaakoverzicht", description: "Toont een zaakoverzicht" },
    },
  });

  it("accepts a well-formed manifest with per-locale name + description", () => {
    expect(validatePluginManifest(validManifest())).toEqual([]);
  });

  it.each([
    ["null", null],
    ["an array", [{ pluginId: "x" }]],
    ["a string", "not-an-object"],
    ["a number", 42],
  ])("rejects a manifest that is %s", (_label, input) => {
    const errors = validatePluginManifest(input);
    expect(errors).toContain("manifest.json must be a JSON object");
  });

  it("requires a non-empty pluginId", () => {
    const errors = validatePluginManifest({ ...validManifest(), pluginId: "  " });
    expect(errors).toContain("manifest.json must contain a non-empty 'pluginId'");
  });

  it("requires a non-empty version", () => {
    const m = validManifest() as Record<string, unknown>;
    delete m.version;
    expect(validatePluginManifest(m)).toContain("manifest.json must contain a non-empty 'version'");
  });

  it("accepts the pack-tool-stamped sdkVersion and the frontend_data capability", () => {
    const m = {
      ...validManifest(),
      sdkVersion: "0.1.0",
      permissions: { capabilities: ["gzac_api", "frontend_data"] },
    };
    expect(validatePluginManifest(m)).toEqual([]);
  });

  it("rejects a non-string or empty sdkVersion (when present)", () => {
    expect(validatePluginManifest({ ...validManifest(), sdkVersion: 42 })).toContain(
      "manifest.json 'sdkVersion' must be a non-empty string when present"
    );
    expect(validatePluginManifest({ ...validManifest(), sdkVersion: " " })).toContain(
      "manifest.json 'sdkVersion' must be a non-empty string when present"
    );
  });

  it("rejects a missing translations block and stops there", () => {
    const m = validManifest() as Record<string, unknown>;
    delete m.translations;
    const errors = validatePluginManifest(m);
    expect(errors).toEqual([
      "manifest.json must contain a 'translations' object with at least one locale; 'name' and 'description' are defined per locale, not at the top level",
    ]);
  });

  it("rejects an empty translations object", () => {
    const errors = validatePluginManifest({ ...validManifest(), translations: {} });
    expect(errors).toContain("manifest.json 'translations' must declare at least one locale");
  });

  it("rejects a non-object locale bucket", () => {
    const errors = validatePluginManifest({
      ...validManifest(),
      translations: { en: "nope" },
    });
    expect(errors).toContain("manifest.json translations.en must be an object");
  });

  it("requires a non-empty name in every declared locale", () => {
    const errors = validatePluginManifest({
      ...validManifest(),
      translations: {
        en: { name: "Case Summary", description: "ok" },
        nl: { name: "  ", description: "Toont een zaakoverzicht" },
      },
    });
    expect(errors).toContain("manifest.json translations.nl must contain a non-empty 'name'");
    expect(errors).not.toContain("manifest.json translations.en must contain a non-empty 'name'");
  });

  it("requires a non-empty description in every declared locale", () => {
    const errors = validatePluginManifest({
      ...validManifest(),
      translations: { en: { name: "Case Summary" } },
    });
    expect(errors).toContain("manifest.json translations.en must contain a non-empty 'description'");
  });

  it("accumulates multiple errors across fields and locales", () => {
    const errors = validatePluginManifest({
      version: "",
      translations: { en: {}, fr: { name: "Résumé" } },
    });
    // missing pluginId, blank version, en missing name+description, fr missing description
    expect(errors).toContain("manifest.json must contain a non-empty 'pluginId'");
    expect(errors).toContain("manifest.json must contain a non-empty 'version'");
    expect(errors).toContain("manifest.json translations.en must contain a non-empty 'name'");
    expect(errors).toContain("manifest.json translations.en must contain a non-empty 'description'");
    expect(errors).toContain("manifest.json translations.fr must contain a non-empty 'description'");
    expect(errors.length).toBeGreaterThanOrEqual(5);
  });
});
