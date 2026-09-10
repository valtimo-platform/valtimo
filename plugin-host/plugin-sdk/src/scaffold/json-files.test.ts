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
import {validatePluginManifest} from "../manifest-validation.js";
import {buildManifest, buildPackageJson, buildTsConfig} from "./json-files.js";
import {
  ALL_BUNDLE_SUBSETS,
  ALL_PART_COMBINATIONS,
  describeParts,
  optionsFor,
  optionsWith,
} from "../test-support/scaffold-fixtures.js";
import {PARTS, type PartId} from "./parts.js";

/** Bundle types that fetch their own data, and so need `frontend_data` and a `request` handler. */
const DATA_FETCHING: PartId[] = ["case-tab", "case-widget", "page"];

describe("buildManifest over every bundle subset", () => {
  // The contract that matters, widened from the three parts the scaffold started with: whatever an
  // author selects, the pack tool must accept the result.
  it.each(ALL_BUNDLE_SUBSETS)("passes validatePluginManifest for %s", (_label, ids) => {
    expect(validatePluginManifest(buildManifest(optionsFor(ids)))).toEqual([]);
    expect(
      validatePluginManifest(buildManifest(optionsFor(["event", ...ids], {locales: ["en", "nl"]})))
    ).toEqual([]);
  });

  it.each(ALL_BUNDLE_SUBSETS)("declares one bundle per selected type for %s", (_label, ids) => {
    const bundles = buildManifest(optionsFor(ids)).frontendBundles ?? [];

    expect(bundles.map((bundle) => bundle.type)).toEqual(ids);
    expect(bundles.map((bundle) => bundle.path)).toEqual(
      ids.map((id) => `/bundles/${PARTS[id].frontend?.stem}.html`)
    );
  });

  it.each(ALL_BUNDLE_SUBSETS)("declares frontend_data once, iff needed, for %s", (_label, ids) => {
    const capabilities = buildManifest(optionsFor(ids)).permissions?.capabilities ?? [];
    const needed = ids.some((id) => DATA_FETCHING.includes(id));

    expect(capabilities.filter((capability) => capability === "frontend_data")).toEqual(
      needed ? ["frontend_data"] : []
    );
    expect(capabilities).toContain("log");
  });

  it.each(ALL_BUNDLE_SUBSETS)("keeps the translation buckets in step for %s", (_label, ids) => {
    const {translations} = buildManifest(optionsFor(ids, {locales: ["en", "nl", "fr"]}));

    // A key present in one bucket and missing from another renders as a raw key for those users.
    expect(Object.keys(translations.nl).sort()).toEqual(Object.keys(translations.en).sort());
    // No strings exist for `fr`, so it falls back to English rather than to nothing.
    expect(Object.keys(translations.fr).sort()).toEqual(Object.keys(translations.en).sort());
  });

  it("resolves a page's title through the translations, in every bucket", () => {
    const manifest = buildManifest(optionsFor(["page"], {locales: ["en", "nl"]}));
    const [bundle] = manifest.frontendBundles ?? [];

    // The one bundle type whose title GZAC resolves as a key rather than rendering literally.
    expect(bundle).toEqual({
      type: "page",
      key: "overview",
      title: "page.overview.title",
      icon: "icon mdi mdi-view-dashboard",
      path: "/bundles/page.html",
    });
    for (const bucket of Object.values(manifest.translations)) {
      expect(bucket["page.overview.title"]).toBe("My Plugin");
    }
  });

  it("marks the task form as validated and keys it on the submit hook", () => {
    expect(buildManifest(optionsFor(["task-form"])).frontendBundles).toEqual([
      {
        type: "task-form",
        key: "review",
        title: "My Plugin",
        path: "/bundles/task-form.html",
        submitHandler: true,
      },
    ]);
  });

  it("keys the process-link action bundle on the action it configures", () => {
    const manifest = buildManifest(optionsFor(["process-link-action"]));

    expect(manifest.frontendBundles?.[0].key).toBe(manifest.actions[0].key);
  });

  it("keeps the key order stable whatever is selected", () => {
    const order = (ids: PartId[]) => Object.keys(buildManifest(optionsFor(ids)));

    expect(order(["event", "config", "page"])).toEqual([
      "pluginId",
      "version",
      "translations",
      "configurationSchema",
      "permissions",
      "frontendBundles",
      "actions",
      "eventSubscriptions",
    ]);
    expect(order([])).toEqual([
      "pluginId",
      "version",
      "translations",
      "permissions",
      "actions",
    ]);
  });
});

describe("buildManifest", () => {
  // The contract that matters: the scaffold and the pack tool must never disagree about what a
  // valid plugin is, for any selection of parts.
  it.each(ALL_PART_COMBINATIONS)(
    "passes validatePluginManifest with zero errors for %s",
    (_label, parts) => {
      expect(validatePluginManifest(buildManifest(optionsWith(parts)))).toEqual([]);
    }
  );

  it.each(ALL_PART_COMBINATIONS)("stays valid with a Dutch bucket too, for %s", (_label, parts) => {
    const manifest = buildManifest(optionsWith(parts, {locales: ["en", "nl"]}));

    expect(validatePluginManifest(manifest)).toEqual([]);
    expect(Object.keys(manifest.translations)).toEqual(["en", "nl"]);
  });

  it("declares frontend_data exactly when a case tab is generated", () => {
    for (const [label, parts] of ALL_PART_COMBINATIONS) {
      const capabilities = buildManifest(optionsWith(parts)).permissions?.capabilities ?? [];

      expect(capabilities, label).toContain("log");
      expect(capabilities.includes("frontend_data"), label).toBe(parts.caseTab);
    }
  });

  it("emits a configurationSchema exactly when the config bundle is generated", () => {
    for (const [label, parts] of ALL_PART_COMBINATIONS) {
      const manifest = buildManifest(optionsWith(parts));

      expect(manifest.configurationSchema !== undefined, label).toBe(parts.configBundle);
    }
  });

  it("subscribes to an event exactly when the onEvent handler is generated", () => {
    for (const [label, parts] of ALL_PART_COMBINATIONS) {
      const manifest = buildManifest(optionsWith(parts));

      expect(manifest.eventSubscriptions, label).toEqual(
        parts.onEvent ? ["com.ritense.valtimo.document.created"] : undefined
      );
    }
  });

  it("declares one frontend bundle per selected frontend part", () => {
    for (const [label, parts] of ALL_PART_COMBINATIONS) {
      const bundles = buildManifest(optionsWith(parts)).frontendBundles ?? [];
      const types = bundles.map((bundle) => bundle.type);

      expect(types.includes("config"), label).toBe(parts.configBundle);
      expect(types.includes("case-tab"), label).toBe(parts.caseTab);
      expect(bundles.length, label).toBe(Number(parts.configBundle) + Number(parts.caseTab));
    }
  });

  it("keys the case-tab bundle on the path the request handler serves", () => {
    const bundle = buildManifest(optionsWith({onEvent: false, configBundle: false, caseTab: true}))
      .frontendBundles?.[0];

    expect(bundle).toEqual({
      type: "case-tab",
      key: "summary",
      title: "My Plugin",
      path: "/bundles/case-tab.html",
    });
  });

  it("keys the action on the plugin id and offers the greeting property", () => {
    const manifest = buildManifest(optionsWith({onEvent: false, configBundle: false, caseTab: false}));

    expect(manifest.actions).toEqual([
      {
        key: "my-plugin",
        title: "My Plugin",
        description: "A Valtimo external plugin",
        activityTypes: ["SERVICE_TASK_START"],
        properties: [{key: "greeting", type: "string", required: false}],
      },
    ]);
  });

  it("omits provider when it was left blank, and writes it when it wasn't", () => {
    expect("provider" in buildManifest(optionsWith({}, {provider: undefined}))).toBe(false);
    expect(buildManifest(optionsWith({}, {provider: "Acme"})).provider).toBe("Acme");
  });

  it("carries a translation key for every string the bundles look up", () => {
    const bucket = buildManifest(optionsWith({onEvent: true, configBundle: true, caseTab: true}))
      .translations.en;

    expect(Object.keys(bucket)).toEqual([
      "name",
      "description",
      "config.title.label",
      "config.title.placeholder",
      "config.greeting.label",
      "caseTab.title",
      "caseTab.loading",
      "caseTab.error",
    ]);
  });

  it("gives the Dutch bucket Dutch strings and a copy of the name to translate", () => {
    const {nl} = buildManifest(optionsWith({}, {locales: ["en", "nl"]})).translations;

    expect(nl["config.title.label"]).toBe("Naam van de configuratie");
    expect(nl["caseTab.loading"]).toBe("Laden…");
    // Copied, not translated: the validator requires both in every bucket, and an English string
    // in a Dutch bucket is an obvious "translate me" where an empty string looks like a bug.
    expect(nl.name).toBe("My Plugin");
    expect(nl.description).toBe("A Valtimo external plugin");
  });

  it("falls back to English strings for a locale the scaffold has none for", () => {
    const {fr} = buildManifest(optionsWith({}, {locales: ["fr"]})).translations;

    expect(fr["caseTab.loading"]).toBe("Loading…");
    expect(validatePluginManifest(buildManifest(optionsWith({}, {locales: ["fr"]})))).toEqual([]);
  });
});

describe("buildPackageJson", () => {
  it("writes the build scripts a generated project is driven by", () => {
    expect(buildPackageJson(optionsWith({})).scripts).toEqual({
      build: "valtimo-plugin-build --input src/plugin.ts --output dist/plugin.wasm",
      pack: "valtimo-plugin-pack --wasm dist/plugin.wasm --output dist",
      "build:pack": "npm run build && npm run pack",
    });
  });

  it("is private and names no licence — the project belongs to its author", () => {
    const pkg = buildPackageJson(optionsWith({}));

    expect(pkg.private).toBe(true);
    expect("license" in pkg).toBe(false);
    expect("type" in pkg).toBe(false);
  });

  it("sorts devDependency keys so the file is stable to diff", () => {
    for (const [label, parts] of ALL_PART_COMBINATIONS) {
      const keys = Object.keys(buildPackageJson(optionsWith(parts)).devDependencies);

      expect(keys, label).toEqual([...keys].sort());
    }
  });

  it("adds React exactly when a frontend bundle is generated", () => {
    for (const [label, parts] of ALL_PART_COMBINATIONS) {
      const deps = buildPackageJson(optionsWith(parts)).devDependencies;

      expect("react" in deps, label).toBe(parts.configBundle || parts.caseTab);
      expect("@types/react-dom" in deps, label).toBe(parts.configBundle || parts.caseTab);
      // Always needed: the Wasm globals, the bundler, and the type-checker.
      expect(deps["@extism/js-pdk"], label).toBeDefined();
      expect(deps.esbuild, label).toBeDefined();
      expect(deps.typescript, label).toBeDefined();
    }
  });

  it("writes the SDK spec it was given", () => {
    expect(
      buildPackageJson(optionsWith({}, {sdkSpec: "file:../../plugin-sdk"})).devDependencies[
        "@valtimo/plugin-sdk"
      ]
    ).toBe("file:../../plugin-sdk");
  });
});

describe("buildTsConfig", () => {
  it("type-checks only — the Wasm build is esbuild's job", () => {
    const tsconfig = buildTsConfig(optionsWith({}));

    expect(tsconfig.compilerOptions.noEmit).toBe(true);
    expect(tsconfig.compilerOptions.outDir).toBeUndefined();
    // A rootDir of src/ would make every frontend/** file an error.
    expect(tsconfig.compilerOptions.rootDir).toBeUndefined();
  });

  it("resolves package exports, which the frontend subpath import needs", () => {
    expect(buildTsConfig(optionsWith({})).compilerOptions.moduleResolution).toBe("bundler");
  });

  it("includes and configures JSX exactly when a frontend bundle is generated", () => {
    for (const [label, parts] of ALL_PART_COMBINATIONS) {
      const tsconfig = buildTsConfig(optionsWith(parts));
      const usesFrontend = parts.configBundle || parts.caseTab;

      expect(tsconfig.include.includes("frontend/**/*"), label).toBe(usesFrontend);
      expect(tsconfig.compilerOptions.jsx, label).toBe(usesFrontend ? "react-jsx" : undefined);
      expect(tsconfig.include, label).toContain("src/**/*");
    }
  });
});

describe("the combinations under test", () => {
  it("covers all eight original part combinations", () => {
    expect(ALL_PART_COMBINATIONS).toHaveLength(8);
    expect(describeParts({onEvent: true, configBundle: false, caseTab: true})).toBe(
      "onEvent+caseTab"
    );
    expect(describeParts({onEvent: false, configBundle: false, caseTab: false})).toBe("minimal");
  });

  it("enumerates all sixty-four bundle subsets rather than sampling them", () => {
    expect(ALL_BUNDLE_SUBSETS).toHaveLength(64);
    expect(ALL_BUNDLE_SUBSETS[0]).toEqual(["no bundles", []]);
    expect(ALL_BUNDLE_SUBSETS[63][1]).toHaveLength(6);
  });
});
