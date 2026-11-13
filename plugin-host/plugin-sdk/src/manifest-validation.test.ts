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

const PLUGIN_ID_ERROR =
  "manifest.json 'pluginId' must be 1-64 characters of lowercase letters, digits, '.', '-' or '_', starting and ending with a letter or digit (it is used as a directory and URL path segment)";
const VERSION_ERROR =
  "manifest.json 'version' must be 1-64 characters of letters, digits, '.', '-', '_' or '+', starting and ending with a letter or digit (it is used as a directory and URL path segment)";
const LOGO_ERROR =
  "manifest.json 'logo' must be a file name at the package root ending in .svg, .png, .jpg or .jpeg";

/**
 * `validatePluginManifest` is the single rule set enforced at BOTH the pack tool (build-time) and
 * the host upload route (runtime). These cases pin that shared contract so the two gates
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
    expect(errors).toContain(PLUGIN_ID_ERROR);
  });

  it("requires a non-empty version", () => {
    const m = validManifest() as Record<string, unknown>;
    delete m.version;
    expect(validatePluginManifest(m)).toContain(VERSION_ERROR);
  });

  /**
   * `pluginId` and `version` become directory names under the host's plugin storage and segments of
   * public URLs. These cases are the containment boundary: anything that could name a path, escape
   * a directory, or collide on a case-insensitive filesystem must be refused here, because this is
   * the one rule set both the pack tool and the host upload route run.
   */
  describe("package identity charset", () => {
    it.each([
      ["a parent-directory traversal", "../../app/dist"],
      ["a bare dot", "."],
      ["a bare double dot", ".."],
      ["a POSIX separator", "a/b"],
      ["a Windows separator", "a\\b"],
      ["a leading dot (hidden directory)", ".hidden"],
      ["an uppercase letter", "Foo"],
      ["an absolute path", "/etc/passwd"],
      ["a trailing separator", "case-summary/"],
      ["a NUL byte", "case\u0000summary"],
      ["a trailing dot", "case-summary."],
      ["an empty string", ""],
      ["65 characters", "a".repeat(65)],
      ["a non-string", 42],
    ])("rejects a pluginId that is %s", (_label, pluginId) => {
      expect(validatePluginManifest({ ...validManifest(), pluginId })).toContain(PLUGIN_ID_ERROR);
    });

    it.each([
      ["case-summary"],
      ["plugin.v2"],
      ["a"],
      ["my_plugin-2"],
      ["a".repeat(64)],
    ])("accepts the pluginId %s", (pluginId) => {
      expect(validatePluginManifest({ ...validManifest(), pluginId })).toEqual([]);
    });

    it.each([
      ["a traversal", "../1.0.0"],
      ["a separator", "1.0.0/x"],
      ["a bare double dot", ".."],
      ["a leading dot", ".1.0.0"],
      ["an empty string", ""],
      ["65 characters", "1".repeat(65)],
    ])("rejects a version that is %s", (_label, version) => {
      expect(validatePluginManifest({ ...validManifest(), version })).toContain(VERSION_ERROR);
    });

    it.each([["0.1.0"], ["1.0.0-RC1+build.5"], ["1"], ["2.0.0_beta"]])(
      "accepts the version %s",
      (version) => {
        expect(validatePluginManifest({ ...validManifest(), version })).toEqual([]);
      }
    );

    it("reports both identity fields when both are unusable", () => {
      const errors = validatePluginManifest({ ...validManifest(), pluginId: "..", version: ".." });
      expect(errors).toEqual([PLUGIN_ID_ERROR, VERSION_ERROR]);
    });
  });

  /**
   * The logo is copied into the stored package under its own name, and therefore into the content
   * hash GZAC pins — so it must name a plain image file at the package root and nothing else.
   */
  describe("logo", () => {
    it("accepts a manifest without a logo (only the pack tool sets one)", () => {
      expect(validatePluginManifest(validManifest())).toEqual([]);
    });

    it.each([
      ["a traversal", "../../../etc/passwd"],
      ["a subdirectory", "sub/logo.svg"],
      ["a Windows separator", "sub\\logo.svg"],
      ["a non-image extension", "logo.exe"],
      ["no basename", ".svg"],
      ["no extension", "logo"],
      ["an empty string", ""],
      ["a non-string", 42],
    ])("rejects a logo that is %s", (_label, logo) => {
      expect(validatePluginManifest({ ...validManifest(), logo })).toContain(LOGO_ERROR);
    });

    it.each([["logo.svg"], ["logo.PNG"], ["icon-2.jpeg"], ["a.jpg"]])(
      "accepts the logo %s",
      (logo) => {
        expect(validatePluginManifest({ ...validManifest(), logo })).toEqual([]);
      }
    );
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
    expect(errors).toContain(PLUGIN_ID_ERROR);
    expect(errors).toContain(VERSION_ERROR);
    expect(errors).toContain("manifest.json translations.en must contain a non-empty 'name'");
    expect(errors).toContain("manifest.json translations.en must contain a non-empty 'description'");
    expect(errors).toContain("manifest.json translations.fr must contain a non-empty 'description'");
    expect(errors.length).toBeGreaterThanOrEqual(5);
  });

  describe("permissions", () => {
    const withPermissions = (permissions: unknown) => ({ ...validManifest(), permissions });

    it("rejects permissions that is not an object", () => {
      expect(validatePluginManifest(withPermissions(["gzac_api"]))).toContain(
        "manifest.json 'permissions' must be an object when present"
      );
    });

    it("accepts every known capability name", () => {
      expect(
        validatePluginManifest(
          withPermissions({
            capabilities: ["gzac_api", "http_request", "kv", "log", "frontend_data"],
          })
        )
      ).toEqual([]);
    });

    it("rejects an unknown capability name, listing the allowed set", () => {
      // The host enforces capabilities by exact name, so a typo must fail the upload rather
      // than silently granting nothing at runtime.
      const errors = validatePluginManifest(withPermissions({ capabilities: ["gzac-api"] }));
      expect(errors).toEqual([
        "manifest.json permissions.capabilities[0] must be one of: gzac_api, http_request, kv, log, frontend_data",
      ]);
    });

    it("rejects a non-string capability entry and reports its index", () => {
      const errors = validatePluginManifest(withPermissions({ capabilities: ["kv", 42] }));
      expect(errors).toEqual([
        "manifest.json permissions.capabilities[1] must be one of: gzac_api, http_request, kv, log, frontend_data",
      ]);
    });

    it("rejects capabilities that is not an array", () => {
      expect(validatePluginManifest(withPermissions({ capabilities: "kv" }))).toContain(
        "manifest.json 'permissions.capabilities' must be an array when present"
      );
    });

    it("rejects endpoints that is not an array", () => {
      expect(
        validatePluginManifest(
          withPermissions({ capabilities: ["gzac_api"], endpoints: "/api/v1/**" })
        )
      ).toContain("manifest.json 'permissions.endpoints' must be an array when present");
    });

    it("rejects endpoints declared without the gzac_api capability", () => {
      // endpoints only scope which GZAC routes gzac_api may reach; declaring them without the
      // capability is a manifest the admin could accept but the host would always deny.
      const errors = validatePluginManifest(
        withPermissions({
          capabilities: ["kv"],
          endpoints: [{ method: "GET", pattern: "/api/v1/document/*" }],
        })
      );
      expect(errors).toContain(
        "manifest.json declares 'permissions.endpoints' but does not include 'gzac_api' in 'permissions.capabilities' — endpoints require the gzac_api capability"
      );
    });

    it("accepts endpoints alongside the gzac_api capability", () => {
      expect(
        validatePluginManifest(
          withPermissions({
            capabilities: ["gzac_api"],
            endpoints: [{ method: "GET", pattern: "/api/v1/document/*" }],
          })
        )
      ).toEqual([]);
    });

    it("does not require the gzac_api pairing when no capability list is declared at all", () => {
      // An older manifest without a capabilities block cannot be judged against it.
      expect(
        validatePluginManifest(
          withPermissions({ endpoints: [{ method: "GET", pattern: "/api/v1/document/*" }] })
        )
      ).toEqual([]);
    });

    describe("egress", () => {
      const withEgress = (egress: unknown, capabilities: unknown = ["http_request"]) =>
        withPermissions({ capabilities, egress });

      it.each([
        ["a bare hostname (https on 443 by default)", "api.kvk.nl"],
        ["an explicit https origin", "https://api.kvk.nl"],
        ["an explicit non-default port", "https://sd.acme-acc.internal:8443"],
        ["an explicit http downgrade", "http://legacy.internal:8080"],
        ["a wildcard with two labels beneath it", "*.blob.core.windows.net"],
      ])("accepts %s", (_label, entry) => {
        expect(validatePluginManifest(withEgress([entry]))).toEqual([]);
      });

      it("rejects egress that is not an array", () => {
        expect(validatePluginManifest(withEgress("api.kvk.nl"))).toContain(
          "manifest.json 'permissions.egress' must be an array when present"
        );
      });

      it.each([
        ["a bare wildcard", "*"],
        ["a whole-TLD wildcard", "*.com"],
        ["a wildcard in the middle", "api.*.vendor.com"],
        ["a non-http scheme", "ftp://files.vendor.com"],
        ["an entry with credentials", "https://user:pass@api.vendor.com"],
        ["an entry narrowed to a path", "https://api.vendor.com/v1"],
        ["an empty entry", "  "],
        ["a non-string entry", 42],
      ])("rejects %s", (_label, entry) => {
        const errors = validatePluginManifest(withEgress([entry]));
        expect(errors.length).toBeGreaterThanOrEqual(1);
        expect(errors[0]).toContain("manifest.json permissions.egress[0]");
      });

      it("rejects egress declared without the http_request capability", () => {
        // Same shape as the endpoints→gzac_api rule: a destination the plugin can never reach.
        expect(validatePluginManifest(withEgress(["api.kvk.nl"], ["kv"]))).toContain(
          "manifest.json declares 'permissions.egress' but does not include 'http_request' in 'permissions.capabilities' — egress targets require the http_request capability"
        );
      });

      it("does not require the http_request pairing for an empty egress list", () => {
        expect(validatePluginManifest(withEgress([], ["kv"]))).toEqual([]);
      });

      it("does not require the pairing when no capability list is declared at all", () => {
        expect(validatePluginManifest(withPermissions({ egress: ["api.kvk.nl"] }))).toEqual([]);
      });

      it("reports the index of each bad entry", () => {
        const errors = validatePluginManifest(withEgress(["api.kvk.nl", "*", "*.com"]));
        expect(errors.some((e) => e.includes("egress[1]"))).toBe(true);
        expect(errors.some((e) => e.includes("egress[2]"))).toBe(true);
        expect(errors.some((e) => e.includes("egress[0]"))).toBe(false);
      });
    });
  });

  describe("x-egress-target configuration properties", () => {
    const withSchema = (properties: unknown) => ({
      ...validManifest(),
      configurationSchema: { type: "object", properties },
    });

    it("accepts the marker on a uri-formatted string property", () => {
      expect(
        validatePluginManifest(
          withSchema({
            smartDocumentsUrl: { type: "string", format: "uri", "x-egress-target": true },
          })
        )
      ).toEqual([]);
    });

    it("ignores unmarked properties entirely", () => {
      expect(
        validatePluginManifest(withSchema({ currency: { type: "string" }, retries: { type: "number" } }))
      ).toEqual([]);
    });

    it("rejects the marker on a non-string property", () => {
      // GZAC has to parse the value into an origin, so a non-string can only ever grant nothing.
      expect(
        validatePluginManifest(withSchema({ port: { type: "number", "x-egress-target": true } }))
      ).toContain(
        "manifest.json configurationSchema.properties.port is marked 'x-egress-target' but is not a string property"
      );
    });

    it("requires format: uri so the admin's field is validated as a URL", () => {
      expect(
        validatePluginManifest(withSchema({ url: { type: "string", "x-egress-target": true } }))
      ).toContain(
        'manifest.json configurationSchema.properties.url is marked \'x-egress-target\' but does not declare "format": "uri"'
      );
    });

    it("tolerates a schema with no properties block", () => {
      expect(validatePluginManifest({ ...validManifest(), configurationSchema: {} })).toEqual([]);
      expect(
        validatePluginManifest({ ...validManifest(), configurationSchema: "not-a-schema" })
      ).toEqual([]);
    });
  });

  describe("action outputs", () => {
    const withActions = (actions: unknown) => ({ ...validManifest(), actions });

    it("accepts unique non-empty output keys", () => {
      expect(
        validatePluginManifest(withActions([{ key: "summarize", outputs: ["summary", "title"] }]))
      ).toEqual([]);
    });

    it("accepts an action without an outputs block", () => {
      expect(validatePluginManifest(withActions([{ key: "summarize" }]))).toEqual([]);
    });

    it("rejects actions that is not an array", () => {
      expect(validatePluginManifest(withActions({ key: "x" }))).toContain(
        "manifest.json 'actions' must be an array when present"
      );
    });

    it("rejects a non-object action entry, reporting its index", () => {
      expect(validatePluginManifest(withActions(["summarize"]))).toContain(
        "manifest.json actions[0] must be an object"
      );
    });

    it("rejects outputs that is not an array", () => {
      expect(
        validatePluginManifest(withActions([{ key: "summarize", outputs: "summary" }]))
      ).toContain("manifest.json actions[0].outputs must be an array when present");
    });

    it.each([
      ["a blank string", ""],
      ["whitespace", "   "],
      ["a number", 7],
      ["null", null],
    ])("rejects %s as an output key", (_label, value) => {
      expect(
        validatePluginManifest(withActions([{ key: "summarize", outputs: [value] }]))
      ).toContain("manifest.json actions[0].outputs[0] must be a non-empty string");
    });

    it("rejects a duplicated output key, naming it", () => {
      // The result-contract check on the host matches result keys against this list, so duplicates
      // would make the declared contract ambiguous.
      expect(
        validatePluginManifest(
          withActions([{ key: "summarize", outputs: ["summary", "summary"] }])
        )
      ).toContain(
        "manifest.json actions[0].outputs must contain unique keys; 'summary' is duplicated"
      );
    });

    it("reports the offending action's index when several are declared", () => {
      const errors = validatePluginManifest(
        withActions([{ key: "a", outputs: ["ok"] }, { key: "b", outputs: [""] }])
      );
      expect(errors).toEqual(["manifest.json actions[1].outputs[0] must be a non-empty string"]);
    });
  });

  describe("frontend bundles", () => {
    const withBundles = (frontendBundles: unknown) => ({ ...validManifest(), frontendBundles });

    it("accepts every known bundle type", () => {
      expect(
        validatePluginManifest(
          withBundles([
            { type: "config", path: "/frontend/config.html" },
            { type: "process-link-action", path: "/frontend/action.html" },
            { type: "case-tab", path: "/frontend/case-tab.html" },
            { type: "case-widget", path: "/frontend/case-widget.html" },
            { type: "page", path: "/frontend/page.html" },
            { type: "task-form", path: "/frontend/task-form.html", submitHandler: true },
          ])
        )
      ).toEqual([]);
    });

    it("rejects frontendBundles that is not an array", () => {
      expect(validatePluginManifest(withBundles({ type: "config" }))).toContain(
        "manifest.json 'frontendBundles' must be an array when present"
      );
    });

    it("rejects a non-object bundle entry", () => {
      expect(validatePluginManifest(withBundles(["config"]))).toContain(
        "manifest.json frontendBundles[0] must be an object"
      );
    });

    it("rejects an unknown bundle type, listing the allowed set", () => {
      expect(
        validatePluginManifest(withBundles([{ type: "dashboard", path: "/frontend/x.html" }]))
      ).toContain(
        "manifest.json frontendBundles[0].type must be one of: config, process-link-action, case-tab, case-widget, page, task-form, side-panel"
      );
    });

    it.each([
      ["a missing path", { type: "case-tab" }],
      ["a blank path", { type: "case-tab", path: "   " }],
      ["a non-string path", { type: "case-tab", path: 7 }],
    ])("rejects a bundle with %s", (_label, bundle) => {
      expect(validatePluginManifest(withBundles([bundle]))).toContain(
        "manifest.json frontendBundles[0] must contain a non-empty 'path'"
      );
    });

    it("reports both the type and path problems of one entry", () => {
      const errors = validatePluginManifest(withBundles([{ type: "nope" }]));
      expect(errors).toHaveLength(2);
    });
  });

  // GZAC silently drops a bound its semver parser rejects and then reports "compatible", so a
  // bound that cannot drive the gate must never reach a package.
  describe("compatibility bounds", () => {
    const withCompatibility = (compatibility: unknown) => ({
      ...validManifest(),
      compatibility,
    });

    it("accepts an absent compatibility block", () => {
      expect(validatePluginManifest(validManifest())).toEqual([]);
    });

    it.each([
      ["a full range", { minGzacVersion: "12.0.0", maxGzacVersion: "12.1.0" }],
      ["an equal range", { minGzacVersion: "12.0.0", maxGzacVersion: "12.0.0" }],
      ["only a minimum", { minGzacVersion: "12.0.0" }],
      ["only a maximum", { maxGzacVersion: "12.1.0" }],
      ["an empty object", {}],
      ["build metadata", { minGzacVersion: "12.0.0+build.5" }],
    ])("accepts %s", (_label, compatibility) => {
      expect(validatePluginManifest(withCompatibility(compatibility))).toEqual([]);
    });

    it.each([
      ["a major-only bound", "13"],
      ["a major.minor bound", "13.1"],
      ["a v-prefixed bound", "v13.1.3"],
      ["a word", "latest"],
      ["a number", 13],
      ["a leading-zero core", "13.01.3"],
    ])("rejects %s as minGzacVersion", (_label, minGzacVersion) => {
      const errors = validatePluginManifest(withCompatibility({ minGzacVersion }));
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("compatibility.minGzacVersion must be a semver version string");
    });

    it("rejects a malformed maxGzacVersion", () => {
      const errors = validatePluginManifest(withCompatibility({ maxGzacVersion: "banana" }));
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("compatibility.maxGzacVersion must be a semver version string");
    });

    it.each([
      ["a string", "1.0"],
      ["an array", ["1.0.0"]],
      ["null", null],
    ])("rejects a compatibility block that is %s", (_label, compatibility) => {
      expect(validatePluginManifest(withCompatibility(compatibility))).toEqual([
        "manifest.json 'compatibility' must be an object when present",
      ]);
    });

    it("rejects an inverted stable range", () => {
      const errors = validatePluginManifest(
        withCompatibility({ minGzacVersion: "13.0.0", maxGzacVersion: "12.1.0" })
      );
      expect(errors).toEqual([
        "manifest.json compatibility.minGzacVersion ('13.0.0') must not be greater than compatibility.maxGzacVersion ('12.1.0')",
      ]);
    });

    it("accepts a prerelease bound and skips the ordering comparison", () => {
      expect(
        validatePluginManifest(
          withCompatibility({ minGzacVersion: "13.0.0", maxGzacVersion: "13.0.0-rc.1" })
        )
      ).toEqual([]);
    });

    it("reports both bounds when both are malformed", () => {
      const errors = validatePluginManifest(
        withCompatibility({ minGzacVersion: "13", maxGzacVersion: "14" })
      );
      expect(errors).toHaveLength(2);
    });
  });

  it("accumulates errors across capabilities, actions and bundles in one pass", () => {
    const errors = validatePluginManifest({
      ...validManifest(),
      permissions: { capabilities: ["nope"] },
      actions: [{ key: "a", outputs: ["", ""] }],
      frontendBundles: [{ type: "unknown", path: "" }],
    });
    expect(errors.length).toBeGreaterThanOrEqual(5);
  });
});

/**
 * Contracts: `provides` (provider side) and `permissions.contracts` (requester side). Both keys are
 * optional; a manifest without them is judged on the other rules alone.
 */
describe("validatePluginManifest — contracts", () => {
  const base = () => ({
    pluginId: "openplan",
    version: "0.1.0",
    translations: { en: { name: "Open Plan", description: "Open Plan register" } },
  });
  const operation = (overrides: Record<string, unknown> = {}) => ({
    key: "list",
    title: "List resources",
    ...overrides,
  });
  const provides = (operations: unknown[], extra: Record<string, unknown> = {}) => ({
    ...base(),
    provides: [{ contract: "nl.ritense.openplan@1", operations, ...extra }],
  });

  it("accepts a manifest without contract keys", () => {
    expect(validatePluginManifest(base())).toEqual([]);
    expect(validatePluginManifest({ ...base(), permissions: { capabilities: ["log"] } })).toEqual([]);
  });

  it("accepts sync and job operations with outputs and a timeout", () => {
    const manifest = provides(
      [
        operation(),
        operation({ key: "generate-report", mode: "job", timeout: "PT2H", outputs: ["documentRef", "contentHash"] }),
        operation({ key: "get", mode: "sync", description: "One resource" }),
      ],
      { title: "Open Plan" }
    );
    expect(validatePluginManifest(manifest)).toEqual([]);
  });

  it("accepts declared contracts on the requester side", () => {
    expect(
      validatePluginManifest({
        ...base(),
        permissions: { contracts: ["nl.ritense.openplan@1", "nl.ritense.document.generate@2"] },
      })
    ).toEqual([]);
  });

  it.each([
    ["no major version", "nl.ritense.openplan"],
    ["a single segment", "openplan@1"],
    ["uppercase", "nl.Ritense.openplan@1"],
    ["a non-numeric major", "nl.ritense.openplan@v1"],
    ["a non-string", 42],
  ])("rejects a contract name with %s", (_label, contract) => {
    expect(validatePluginManifest({ ...base(), permissions: { contracts: [contract] } })).toEqual([
      expect.stringContaining("manifest.json permissions.contracts[0] must be a contract name"),
    ]);
    expect(
      validatePluginManifest({ ...base(), permissions: { contracts: [{ contract, operations: ["list"] }] } })
    ).toEqual([expect.stringContaining("manifest.json permissions.contracts[0].contract must be a contract name")]);
    expect(validatePluginManifest(provides([operation()], { contract }))).toEqual([
      expect.stringContaining("manifest.json provides[0].contract must be a contract name"),
    ]);
  });

  describe("declared operations (object form)", () => {
    const declaring = (...contracts: unknown[]) => ({ ...base(), permissions: { contracts } });

    it("accepts a contract limited to named operations, next to the string form", () => {
      expect(
        validatePluginManifest(
          declaring("nl.ritense.bsn-lookup@1", {
            contract: "nl.ritense.document.generate@1",
            operations: ["render", "generate-pdf"],
          })
        )
      ).toEqual([]);
    });

    it.each([
      ["missing", undefined],
      ["empty", []],
      ["not an array", "render"],
    ])("rejects operations that are %s", (_label, operations) => {
      expect(validatePluginManifest(declaring({ contract: "nl.ritense.document.generate@1", operations }))).toEqual([
        "manifest.json permissions.contracts[0].operations must be a non-empty array of operation keys",
      ]);
    });

    it.each([["Render"], ["1render"], ["render_pdf"], [""], [7], [null]])("rejects operation key %j", (key) => {
      expect(
        validatePluginManifest(declaring({ contract: "nl.ritense.document.generate@1", operations: ["render", key] }))
      ).toEqual([
        "manifest.json permissions.contracts[0].operations[1] must start with a lowercase letter and contain only lowercase letters, digits and '-'",
      ]);
    });

    it("rejects a duplicated operation key", () => {
      expect(
        validatePluginManifest(
          declaring({ contract: "nl.ritense.document.generate@1", operations: ["render", "render"] })
        )
      ).toEqual(["manifest.json permissions.contracts[0].operations must contain unique keys; 'render' is duplicated"]);
    });

    it("reports both an invalid contract and invalid operations of one entry", () => {
      expect(validatePluginManifest(declaring({ contract: "nope", operations: [] }))).toEqual([
        expect.stringContaining("manifest.json permissions.contracts[0].contract must be a contract name"),
        "manifest.json permissions.contracts[0].operations must be a non-empty array of operation keys",
      ]);
    });

    it("keeps contract names unique across both forms", () => {
      expect(
        validatePluginManifest(
          declaring("nl.ritense.document.generate@1", {
            contract: "nl.ritense.document.generate@1",
            operations: ["render"],
          })
        )
      ).toEqual([
        "manifest.json 'permissions.contracts' must contain unique contracts; 'nl.ritense.document.generate@1' is duplicated",
      ]);
      expect(
        validatePluginManifest(
          declaring(
            { contract: "nl.ritense.document.generate@1", operations: ["render"] },
            { contract: "nl.ritense.document.generate@1", operations: ["generate"] }
          )
        )
      ).toEqual([
        "manifest.json 'permissions.contracts' must contain unique contracts; 'nl.ritense.document.generate@1' is duplicated",
      ]);
    });

    it.each([
      ["null", null],
      ["an array", ["nl.ritense.document.generate@1"]],
      ["a boolean", true],
    ])("rejects an entry that is %s", (_label, entry) => {
      expect(validatePluginManifest(declaring(entry))).toEqual([
        "manifest.json permissions.contracts[0] must be a contract name of the form 'name@major' or an object with 'contract' and 'operations'",
      ]);
    });
  });

  it("rejects duplicated contracts in permissions.contracts and in provides", () => {
    expect(
      validatePluginManifest({
        ...base(),
        permissions: { contracts: ["nl.ritense.openplan@1", "nl.ritense.openplan@1"] },
      })
    ).toEqual([
      "manifest.json 'permissions.contracts' must contain unique contracts; 'nl.ritense.openplan@1' is duplicated",
    ]);
    const duplicated = {
      ...base(),
      provides: [
        { contract: "nl.ritense.openplan@1", operations: [operation()] },
        { contract: "nl.ritense.openplan@1", operations: [operation()] },
      ],
    };
    expect(validatePluginManifest(duplicated)).toEqual([
      "manifest.json 'provides' must contain unique contracts; 'nl.ritense.openplan@1' is duplicated",
    ]);
  });

  it("rejects non-array contract keys", () => {
    expect(validatePluginManifest({ ...base(), permissions: { contracts: "nl.ritense.openplan@1" } })).toEqual([
      "manifest.json 'permissions.contracts' must be an array when present",
    ]);
    expect(validatePluginManifest({ ...base(), provides: {} })).toEqual([
      "manifest.json 'provides' must be an array when present",
    ]);
    expect(validatePluginManifest({ ...base(), provides: ["x"] })).toEqual([
      "manifest.json provides[0] must be an object",
    ]);
  });

  it("requires a non-empty operations list", () => {
    expect(validatePluginManifest(provides([]))).toEqual([
      "manifest.json provides[0].operations must be a non-empty array",
    ]);
    expect(validatePluginManifest({ ...base(), provides: [{ contract: "nl.ritense.openplan@1" }] })).toEqual([
      "manifest.json provides[0].operations must be a non-empty array",
    ]);
  });

  it("rejects an empty contract title", () => {
    expect(validatePluginManifest(provides([operation()], { title: " " }))).toEqual([
      "manifest.json provides[0].title must be a non-empty string when present",
    ]);
  });

  it.each([["List"], ["1list"], ["list_all"], [""], [7]])("rejects operation key %j", (key) => {
    expect(validatePluginManifest(provides([operation({ key })]))).toEqual([
      "manifest.json provides[0].operations[0].key must start with a lowercase letter and contain only lowercase letters, digits and '-'",
    ]);
  });

  it("rejects a duplicated operation key within one contract", () => {
    expect(validatePluginManifest(provides([operation(), operation({ title: "Again" })]))).toEqual([
      "manifest.json provides[0].operations[1].key 'list' is duplicated within its contract",
    ]);
  });

  it("allows the same operation key in two different contracts", () => {
    const manifest = {
      ...base(),
      provides: [
        { contract: "nl.ritense.openplan@1", operations: [operation()] },
        { contract: "nl.ritense.openplan@2", operations: [operation()] },
      ],
    };
    expect(validatePluginManifest(manifest)).toEqual([]);
  });

  it("requires an operation title", () => {
    expect(validatePluginManifest(provides([{ key: "list" }]))).toEqual([
      "manifest.json provides[0].operations[0].title must be a non-empty string",
    ]);
  });

  it("rejects an unknown mode", () => {
    expect(validatePluginManifest(provides([operation({ mode: "async" })]))).toEqual([
      "manifest.json provides[0].operations[0].mode must be one of: sync, job",
    ]);
  });

  it("only allows a timeout with mode job", () => {
    const error = "manifest.json provides[0].operations[0].timeout is only allowed with mode 'job'";
    expect(validatePluginManifest(provides([operation({ timeout: "PT1H" })]))).toEqual([error]);
    expect(validatePluginManifest(provides([operation({ mode: "sync", timeout: "PT1H" })]))).toEqual([error]);
  });

  it.each([["PT2H"], ["P1D"], ["PT30M"], ["PT45S"], ["P1DT12H"], ["PT0.5S"]])(
    "accepts timeout %s",
    (timeout) => {
      expect(validatePluginManifest(provides([operation({ mode: "job", timeout })]))).toEqual([]);
    }
  );

  it.each([["2h"], ["P"], ["PT"], ["P1DT"], ["P1M"], ["P1W"], ["P1Y"], ["PT0S"], ["-PT1H"], [3600]])(
    "rejects timeout %j",
    (timeout) => {
      expect(validatePluginManifest(provides([operation({ mode: "job", timeout })]))).toEqual([
        "manifest.json provides[0].operations[0].timeout must be a positive ISO-8601 duration in days, hours, minutes or seconds, e.g. 'PT2H' or 'P1D'",
      ]);
    }
  );

  it("rejects malformed outputs", () => {
    expect(validatePluginManifest(provides([operation({ outputs: "a" })]))).toEqual([
      "manifest.json provides[0].operations[0].outputs must be an array when present",
    ]);
    expect(validatePluginManifest(provides([operation({ outputs: ["a", ""] })]))).toEqual([
      "manifest.json provides[0].operations[0].outputs[1] must be a non-empty string",
    ]);
    expect(validatePluginManifest(provides([operation({ outputs: ["a", "a"] })]))).toEqual([
      "manifest.json provides[0].operations[0].outputs must contain unique keys; 'a' is duplicated",
    ]);
  });

  it("rejects a non-string description", () => {
    expect(validatePluginManifest(provides([operation({ description: 1 })]))).toEqual([
      "manifest.json provides[0].operations[0].description must be a string when present",
    ]);
  });

  describe("input and output schemas", () => {
    it("accepts JSON Schema objects without judging their content", () => {
      const manifest = provides([
        operation({
          input: { type: "object", required: ["resource"], properties: { resource: { type: "string" } } },
          output: { type: "object", required: ["items"] },
        }),
        // GZAC compiles schemas; the pack tool only checks the shape.
        operation({ key: "get", input: {}, output: { type: "no-such-type" } }),
      ]);
      expect(validatePluginManifest(manifest)).toEqual([]);
    });

    it.each([
      ["an array", [{ type: "object" }]],
      ["a string", "object"],
      ["a boolean schema", true],
      ["null", null],
      ["a number", 1],
    ])("rejects an input or output that is %s", (_label, schema) => {
      expect(validatePluginManifest(provides([operation({ input: schema, output: schema })]))).toEqual([
        "manifest.json provides[0].operations[0].input must be a JSON Schema object when present",
        "manifest.json provides[0].operations[0].output must be a JSON Schema object when present",
      ]);
    });
  });
});
