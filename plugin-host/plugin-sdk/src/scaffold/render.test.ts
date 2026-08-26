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
import {
  ALL_BUNDLE_SUBSETS,
  ALL_PART_COMBINATIONS,
  TEMPLATES_DIR,
  optionsFor,
  optionsWith,
} from "../test-support/scaffold-fixtures.js";
import {ScaffoldError} from "./options.js";
import {PARTS, frontendTemplatePath} from "./parts.js";
import {
  TEMPLATE_PATHS,
  buildSdkImports,
  renderPluginSource,
  renderReadme,
  renderTemplateFile,
  substituteTokens,
  templateTokens,
} from "./render.js";

/** Anything token-shaped left in a rendered file is a generator bug, not a stylistic choice. */
const ANY_TOKEN = /__[A-Z0-9_]+__/;

describe("substituteTokens", () => {
  it("replaces every occurrence", () => {
    expect(substituteTokens("__A__ and __A__ and __B__", {A: "1", B: "2"})).toBe("1 and 1 and 2");
  });

  it("reads two adjacent tokens as two tokens", () => {
    expect(substituteTokens("__A____B__", {A: "1", B: "2"})).toBe("12");
  });

  it("throws on an unknown token instead of shipping it into someone's plugin", () => {
    expect(() => substituteTokens("__PLUGIN_ID__ __RENAMED__", {PLUGIN_ID: "x"})).toThrow(
      ScaffoldError
    );
    expect(() => substituteTokens("__RENAMED__", {PLUGIN_ID: "x"})).toThrow(/__RENAMED__/);
  });

  it("leaves lowercase and mixed-case underscore names alone", () => {
    expect(substituteTokens("__not_a_token__ _A_", {})).toBe("__not_a_token__ _A_");
  });
});

describe("buildSdkImports", () => {
  it.each([
    [
      {onEvent: false, configBundle: false, caseTab: false},
      'import type {ActionInput} from "@valtimo/plugin-sdk";\nimport {action, log} from "@valtimo/plugin-sdk";',
    ],
    [
      {onEvent: true, configBundle: false, caseTab: false},
      'import type {ActionInput, EventInput} from "@valtimo/plugin-sdk";\nimport {action, log, onEvent} from "@valtimo/plugin-sdk";',
    ],
    [
      {onEvent: false, configBundle: true, caseTab: false},
      'import type {ActionInput} from "@valtimo/plugin-sdk";\nimport {action, config, log} from "@valtimo/plugin-sdk";',
    ],
    [
      {onEvent: false, configBundle: false, caseTab: true},
      'import type {ActionInput, RequestInput} from "@valtimo/plugin-sdk";\nimport {action, log, request} from "@valtimo/plugin-sdk";',
    ],
    [
      {onEvent: true, configBundle: true, caseTab: true},
      'import type {ActionInput, EventInput, RequestInput} from "@valtimo/plugin-sdk";\nimport {action, config, log, onEvent, request} from "@valtimo/plugin-sdk";',
    ],
  ])("imports exactly the symbols the selected parts use", (parts, expected) => {
    expect(buildSdkImports(optionsWith(parts))).toBe(expected);
  });

  it("imports a shared symbol once however many parts ask for it", () => {
    // case-tab, case-widget and page all fetch through `request`.
    expect(buildSdkImports(optionsFor(["case-tab", "case-widget", "page"]))).toBe(
      'import type {ActionInput, RequestInput} from "@valtimo/plugin-sdk";\nimport {action, log, request} from "@valtimo/plugin-sdk";'
    );
  });
});

describe("the GREETING_SOURCE token", () => {
  it("reads the configuration only when there is a config bundle to set it from", () => {
    expect(templateTokens(optionsFor([])).GREETING_SOURCE).toBe(
      '(input.properties.greeting as string) || "Hello"'
    );
    expect(templateTokens(optionsFor(["config"])).GREETING_SOURCE).toContain(
      'config.get("greeting")'
    );
  });
});

describe("templateTokens", () => {
  it("names a part's own bundle only when rendering that part's file", () => {
    const options = optionsFor(["task-form"]);
    const [selection] = options.selection;

    expect(templateTokens(options).BUNDLE_KEY).toBeUndefined();
    expect(
      templateTokens(options, {options, id: selection.id, key: selection.key}).BUNDLE_KEY
    ).toBe("review");
    expect(
      templateTokens(options, {options, id: selection.id, key: selection.key}).BUNDLE_STEM
    ).toBe("task-form");
  });
});

describe("renderPluginSource", () => {
  it.each(ALL_PART_COMBINATIONS)("leaves no token behind for %s", (_label, parts) => {
    expect(renderPluginSource(TEMPLATES_DIR, optionsWith(parts))).not.toMatch(ANY_TOKEN);
  });

  it.each(ALL_PART_COMBINATIONS)("registers exactly the selected handlers for %s", (_label, parts) => {
    const source = renderPluginSource(TEMPLATES_DIR, optionsWith(parts));

    expect(source).toContain('action("my-plugin"');
    expect(source.includes("onEvent(")).toBe(parts.onEvent);
    expect(source.includes('request("/summary"')).toBe(parts.caseTab);
    // Every imported symbol is used, and every used symbol is imported.
    expect(source.includes("config.get(")).toBe(parts.configBundle);
  });

  it("starts with the generated import block", () => {
    const source = renderPluginSource(
      TEMPLATES_DIR,
      optionsWith({onEvent: false, configBundle: false, caseTab: false})
    );

    expect(source.startsWith('import type {ActionInput} from "@valtimo/plugin-sdk";\n')).toBe(true);
  });

  it("substitutes the plugin id inside an appended fragment too", () => {
    const source = renderPluginSource(
      TEMPLATES_DIR,
      optionsWith({onEvent: false, configBundle: false, caseTab: true}, {pluginId: "acme-thing"})
    );

    expect(source).toContain("Hello from the acme-thing plugin backend");
  });
});

describe("renderReadme", () => {
  it.each(ALL_PART_COMBINATIONS)("documents exactly the selected parts for %s", (_label, parts) => {
    const readme = renderReadme(TEMPLATES_DIR, optionsWith(parts));

    expect(readme).not.toMatch(ANY_TOKEN);
    expect(readme.startsWith("# My Plugin\n")).toBe(true);
    expect(readme.includes("## The configuration bundle")).toBe(parts.configBundle);
    expect(readme.includes("## The case tab")).toBe(parts.caseTab);
    expect(readme).toContain("dist/my-plugin-0.1.0.zip");
  });
});

describe("renderTemplateFile", () => {
  it.each(ALL_BUNDLE_SUBSETS)("renders %s without leaving a token", (_label, ids) => {
    const options = optionsFor(ids);

    expect(renderTemplateFile(TEMPLATES_DIR, TEMPLATE_PATHS.gitignore, options)).not.toMatch(
      ANY_TOKEN
    );
    for (const {id, key} of options.selection) {
      const {frontend} = PARTS[id];
      if (frontend === null) continue;
      for (const extension of ["html", "tsx"] as const) {
        const path = frontendTemplatePath(frontend, extension);
        expect(
          renderTemplateFile(TEMPLATES_DIR, path, options, {options, id, key}),
          path
        ).not.toMatch(ANY_TOKEN);
      }
    }
  });

  it.each(ALL_BUNDLE_SUBSETS)("points %s at the bundles the pack tool compiles", (_label, ids) => {
    const options = optionsFor(ids);

    for (const {id, key} of options.selection) {
      const {frontend} = PARTS[id];
      if (frontend === null) continue;
      const html = renderTemplateFile(
        TEMPLATES_DIR,
        frontendTemplatePath(frontend, "html"),
        options,
        {options, id, key}
      );

      expect(html, id).toContain(`<script src="${frontend.stem}.bundle.js">`);
    }
  });

  it("explains itself when the templates are missing", () => {
    expect(() =>
      renderTemplateFile("/nonexistent/templates", TEMPLATE_PATHS.gitignore, optionsWith({}))
    ).toThrow(/Scaffold template not found/);
  });
});
