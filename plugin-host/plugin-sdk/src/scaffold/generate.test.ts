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

import {existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {validatePluginManifest} from "../manifest-validation.js";
import {
  ALL_BUNDLE_SUBSETS,
  ALL_PART_COMBINATIONS,
  TEMPLATES_DIR,
  optionsFor,
  optionsWith,
} from "../test-support/scaffold-fixtures.js";
import {generatePlugin} from "./generate.js";
import {ScaffoldError} from "./options.js";
import {PARTS} from "./parts.js";

const BASE_FILES = [".gitignore", "README.md", "manifest.json", "package.json", "src/plugin.ts", "tsconfig.json"];

let tempRoot: string;

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "valtimo-scaffold-"));
});

afterEach(() => {
  rmSync(tempRoot, {recursive: true, force: true});
});

/** Generates into a fresh subdirectory of the test's temp root. */
function generateInto(name: string, parts: Parameters<typeof optionsWith>[0], force = false) {
  const targetDir = join(tempRoot, name);
  return generatePlugin({
    options: optionsWith(parts, {targetDir}),
    templatesDir: TEMPLATES_DIR,
    force,
  });
}

describe("generatePlugin", () => {
  it.each(ALL_PART_COMBINATIONS)("writes exactly the files %s needs", (label, parts) => {
    const result = generateInto(label, parts);

    const expected = [
      ...BASE_FILES,
      ...(parts.configBundle ? ["frontend/config.html", "frontend/config.tsx"] : []),
      ...(parts.caseTab ? ["frontend/case-tab.html", "frontend/case-tab.tsx"] : []),
    ].sort();
    expect(result.files).toEqual(expected);
    for (const file of expected) {
      expect(existsSync(join(result.targetDir, file)), file).toBe(true);
    }
  });

  it.each(ALL_BUNDLE_SUBSETS)("writes two frontend files per bundle for %s", (label, ids) => {
    const result = generatePlugin({
      options: optionsFor(ids, {targetDir: join(tempRoot, `bundles-${label}`)}),
      templatesDir: TEMPLATES_DIR,
    });

    const expected = [
      ...BASE_FILES,
      ...ids.flatMap((id) => {
        const {stem} = PARTS[id].frontend!;
        return [`frontend/${stem}.html`, `frontend/${stem}.tsx`];
      }),
    ].sort();
    expect(result.files).toEqual(expected);
  });

  it("generates the same project whatever order the bundles were named in", () => {
    const read = (name, ids) =>
      generatePlugin({
        options: optionsFor(ids, {targetDir: join(tempRoot, name)}),
        templatesDir: TEMPLATES_DIR,
      }).files.map((file) => readFileSync(join(tempRoot, name, file), "utf-8"));

    expect(read("order-a", ["page", "config"])).toEqual(read("order-b", ["config", "page"]));
  });

  it("writes .gitignore, never the _gitignore npm would have dropped", () => {
    const result = generateInto("dotfile", {});

    expect(existsSync(join(result.targetDir, ".gitignore"))).toBe(true);
    expect(existsSync(join(result.targetDir, "_gitignore"))).toBe(false);
    expect(readFileSync(join(result.targetDir, ".gitignore"), "utf-8")).toContain("node_modules/");
  });

  it("writes a manifest the pack tool accepts", () => {
    const result = generateInto("manifest", {});
    const manifest = JSON.parse(readFileSync(join(result.targetDir, "manifest.json"), "utf-8"));

    expect(validatePluginManifest(manifest)).toEqual([]);
  });

  it("writes JSON with a two-space indent and a trailing newline", () => {
    const result = generateInto("json", {});
    const content = readFileSync(join(result.targetDir, "package.json"), "utf-8");

    expect(content.endsWith("}\n")).toBe(true);
    expect(content).toContain('\n  "name": "my-plugin",');
  });

  it("creates the target directory when it does not exist yet", () => {
    const result = generateInto("nested/deeper", {});

    expect(existsSync(join(result.targetDir, "src", "plugin.ts"))).toBe(true);
  });

  it("writes into an existing but empty directory", () => {
    const targetDir = mkdtempSync(join(tempRoot, "empty-"));

    const result = generatePlugin({
      options: optionsWith({}, {targetDir}),
      templatesDir: TEMPLATES_DIR,
    });

    expect(result.targetDir).toBe(targetDir);
  });

  it.each([[".DS_Store"], ["Thumbs.db"], ["desktop.ini"], [".ds_store"]])(
    "writes into a directory holding only %s — a file manager put it there, not an author",
    (metadata) => {
      const targetDir = mkdtempSync(join(tempRoot, "finder-"));
      writeFileSync(join(targetDir, metadata), "");

      const result = generatePlugin({
        options: optionsWith({}, {targetDir}),
        templatesDir: TEMPLATES_DIR,
      });

      expect(result.files).toContain("manifest.json");
      // Left alone: it is not ours to delete, and the scaffold never writes to that name.
      expect(existsSync(join(targetDir, metadata))).toBe(true);
    }
  );

  it("still refuses when real work sits alongside the OS metadata", () => {
    const targetDir = mkdtempSync(join(tempRoot, "busy-finder-"));
    writeFileSync(join(targetDir, ".DS_Store"), "");
    writeFileSync(join(targetDir, "work-in-progress.ts"), "// mine\n");

    expect(() =>
      generatePlugin({options: optionsWith({}, {targetDir}), templatesDir: TEMPLATES_DIR})
    ).toThrow(ScaffoldError);
    expect(readdirSync(targetDir).sort()).toEqual([".DS_Store", "work-in-progress.ts"]);
  });

  it("refuses a non-empty target and leaves it exactly as it was", () => {
    const targetDir = mkdtempSync(join(tempRoot, "busy-"));
    writeFileSync(join(targetDir, "work-in-progress.ts"), "// mine\n");

    expect(() =>
      generatePlugin({options: optionsWith({}, {targetDir}), templatesDir: TEMPLATES_DIR})
    ).toThrow(ScaffoldError);
    expect(readdirSync(targetDir)).toEqual(["work-in-progress.ts"]);
  });

  it("names what is in the way, including the dotfiles a file manager hides", () => {
    const targetDir = mkdtempSync(join(tempRoot, "hidden-"));
    writeFileSync(join(targetDir, ".DS_Store"), "");
    writeFileSync(join(targetDir, ".gitignore"), "node_modules/\n");

    // The refusal has to be checkable from a GUI that shows neither of these files.
    expect(() =>
      generatePlugin({options: optionsWith({}, {targetDir}), templatesDir: TEMPLATES_DIR})
    ).toThrow(/it contains \.gitignore\. Pass --force/);
  });

  it("summarises rather than pasting a whole directory listing into one sentence", () => {
    const targetDir = mkdtempSync(join(tempRoot, "crowded-"));
    for (const name of ["a", "b", "c", "d", "e", "f", "g"]) {
      writeFileSync(join(targetDir, `${name}.ts`), "");
    }

    expect(() =>
      generatePlugin({options: optionsWith({}, {targetDir}), templatesDir: TEMPLATES_DIR})
    ).toThrow(/contains a\.ts, b\.ts, c\.ts, d\.ts, e\.ts and 2 more\./);
  });

  it("writes into a non-empty target with force", () => {
    const targetDir = mkdtempSync(join(tempRoot, "forced-"));
    writeFileSync(join(targetDir, "keep-me.txt"), "kept\n");

    const result = generatePlugin({
      options: optionsWith({}, {targetDir}),
      templatesDir: TEMPLATES_DIR,
      force: true,
    });

    expect(result.files).toContain("manifest.json");
    // force overwrites what collides; it does not clear the directory.
    expect(existsSync(join(targetDir, "keep-me.txt"))).toBe(true);
  });

  it("refuses a target that is a file", () => {
    const targetDir = join(tempRoot, "a-file");
    writeFileSync(targetDir, "");

    expect(() =>
      generatePlugin({options: optionsWith({}, {targetDir}), templatesDir: TEMPLATES_DIR})
    ).toThrow(/not a directory/);
  });

  it("leaves nothing behind when rendering fails", () => {
    const targetDir = join(tempRoot, "never-created");

    expect(() =>
      generatePlugin({
        options: optionsWith({}, {targetDir}),
        templatesDir: join(tempRoot, "no-templates-here"),
      })
    ).toThrow(/Scaffold template not found/);
    expect(existsSync(targetDir)).toBe(false);
  });
});
