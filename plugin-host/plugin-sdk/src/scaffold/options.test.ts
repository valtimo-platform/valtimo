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
  ScaffoldError,
  pluginIdFromDirectoryName,
  resolveOptions,
  titleCaseFromPluginId,
} from "./options.js";

const CTX = {sdkVersion: "0.1.0"};

describe("pluginIdFromDirectoryName", () => {
  it.each([
    ["./My Plugin/", "my-plugin"],
    ["./My_Plugin", "my-plugin"],
    ["/tmp/scaffold-check", "scaffold-check"],
    ["C:\\Users\\dev\\My Plugin", "my-plugin"],
    ["plugin.", "plugin"],
    ["123", "123"],
    ["com.acme.plugin", "com.acme.plugin"],
    ["  spaced  ", "spaced"],
  ])("derives %s -> %s", (dir, expected) => {
    expect(pluginIdFromDirectoryName(dir)).toBe(expected);
  });

  it.each([
    // No name to derive from, and both are exactly what the id charset exists to reject.
    ["."],
    [".."],
    ["../.."],
    // `..` anywhere is refused rather than silently collapsed.
    ["a..b"],
    // Nothing alphanumeric survives.
    ["!!!"],
    ["___"],
    [""],
  ])("returns null for %s", (dir) => {
    expect(pluginIdFromDirectoryName(dir)).toBeNull();
  });

  it("truncates an over-long directory name to a valid id instead of giving up", () => {
    const derived = pluginIdFromDirectoryName("a".repeat(80));
    expect(derived).toBe("a".repeat(64));
  });

  it("trims a hyphen left behind by truncation", () => {
    const derived = pluginIdFromDirectoryName(`${"a".repeat(63)} tail`);
    expect(derived).toBe("a".repeat(63));
  });
});

describe("titleCaseFromPluginId", () => {
  it.each([
    ["my-plugin", "My Plugin"],
    ["my_plugin", "My Plugin"],
    ["com.acme.plugin", "Com Acme Plugin"],
    ["plugin", "Plugin"],
  ])("%s -> %s", (pluginId, expected) => {
    expect(titleCaseFromPluginId(pluginId)).toBe(expected);
  });
});

describe("resolveOptions", () => {
  it("derives every default from the target directory", () => {
    const options = resolveOptions({targetDir: "/tmp/my-plugin"}, CTX);

    expect(options).toMatchObject({
      pluginId: "my-plugin",
      version: "0.1.0",
      name: "My Plugin",
      description: "A Valtimo external plugin",
      locales: ["en"],
      sdkSpec: "^0.1.0",
    });
    expect(options.provider).toBeUndefined();
  });

  it("defaults to the event handler and the config bundle, so --yes and the wizard agree", () => {
    const options = resolveOptions({targetDir: "/tmp/my-plugin"}, CTX);

    // config alone: the only bundle with a structural claim to being default. Defaulting any of the
    // other five would privilege one user-facing surface over its peers.
    expect(options.selection).toEqual([
      {id: "event", key: null},
      {id: "config", key: null},
    ]);
  });

  it("selects the bundles it was asked for, each with its default key", () => {
    const options = resolveOptions(
      {targetDir: "/tmp/my-plugin", bundles: ["page", "task-form", "process-link-action"]},
      CTX
    );

    expect(options.selection).toEqual([
      {id: "event", key: null},
      {id: "process-link-action", key: "my-plugin"},
      {id: "task-form", key: "review"},
      {id: "page", key: "overview"},
    ]);
  });

  it("ignores the order the bundles were named in", () => {
    const asked = (bundles: string[]) =>
      resolveOptions({targetDir: "/tmp/my-plugin", bundles}, CTX).selection;

    expect(asked(["page", "config"])).toEqual(asked(["config", "page"]));
  });

  it("deduplicates bundles, so an alias repeating --bundles is harmless", () => {
    const options = resolveOptions(
      {targetDir: "/tmp/my-plugin", bundles: ["config", "case-tab", "config"]},
      CTX
    );

    expect(options.selection.map(({id}) => id)).toEqual(["event", "config", "case-tab"]);
  });

  it("expands all and none", () => {
    const all = resolveOptions({targetDir: "/tmp/my-plugin", bundles: ["all"]}, CTX);
    const none = resolveOptions({targetDir: "/tmp/my-plugin", bundles: ["none"]}, CTX);

    expect(all.selection.map(({id}) => id)).toEqual([
      "event",
      "config",
      "process-link-action",
      "case-tab",
      "case-widget",
      "task-form",
      "page",
    ]);
    expect(none.selection.map(({id}) => id)).toEqual(["event"]);
  });

  it("takes an empty bundle list as 'explicitly nothing', which is what --minimal passes", () => {
    const options = resolveOptions({targetDir: "/tmp/my-plugin", bundles: [], onEvent: false}, CTX);

    expect(options.selection).toEqual([]);
  });

  it("refuses an unknown bundle type by naming the valid ones", () => {
    expect(() =>
      resolveOptions({targetDir: "/tmp/my-plugin", bundles: ["nonsense"]}, CTX)
    ).toThrow(ScaffoldError);
    expect(() =>
      resolveOptions({targetDir: "/tmp/my-plugin", bundles: ["case-tabs"]}, CTX)
    ).toThrow(/is not a frontend bundle type\. Choose from: config, process-link-action, case-tab/);
  });

  it("takes an explicit plugin id over the directory name", () => {
    const options = resolveOptions({targetDir: "/tmp/whatever", pluginId: "ci-scaffold"}, CTX);

    expect(options.pluginId).toBe("ci-scaffold");
    expect(options.name).toBe("Ci Scaffold");
  });

  it("fails with an actionable message when no id can be derived", () => {
    expect(() => resolveOptions({targetDir: ".."}, CTX)).toThrow(/Pass --plugin-id/);
  });

  it.each([
    ["PluginFoo", "uppercase"],
    ["-x", "leading punctuation"],
    ["x-", "trailing punctuation"],
    ["a..b", "a traversal-shaped id"],
    ["a/b", "a path separator"],
    ["a".repeat(65), "an over-long id"],
  ])("rejects %s (%s) with the shared validator's sentence", (pluginId) => {
    expect(() => resolveOptions({targetDir: "/tmp/x", pluginId}, CTX)).toThrow(ScaffoldError);
    expect(() => resolveOptions({targetDir: "/tmp/x", pluginId}, CTX)).toThrow(
      /must be 1-64 characters of lowercase letters/
    );
  });

  it.each([[""], ["  "], ["1.0.0/beta"], ["-1.0"], ["1..0"]])(
    "rejects the version %s",
    (version) => {
      expect(() => resolveOptions({targetDir: "/tmp/x", version}, CTX)).toThrow(
        /must be 1-64 characters of letters/
      );
    }
  );

  it("keeps semver prerelease and build metadata", () => {
    expect(resolveOptions({targetDir: "/tmp/x", version: "1.0.0-RC1+build.5"}, CTX).version).toBe(
      "1.0.0-RC1+build.5"
    );
  });

  it("omits a blank provider rather than writing an empty string", () => {
    expect(resolveOptions({targetDir: "/tmp/x", provider: "   "}, CTX).provider).toBeUndefined();
    expect(resolveOptions({targetDir: "/tmp/x", provider: " Acme "}, CTX).provider).toBe("Acme");
  });

  it("lets --sdk win over the derived range", () => {
    const options = resolveOptions(
      {targetDir: "/tmp/x", sdkSpec: "file:../../plugin-sdk"},
      {sdkVersion: "9.9.9"}
    );

    expect(options.sdkSpec).toBe("file:../../plugin-sdk");
  });

  it("derives the range from the SDK's own version when --sdk is absent", () => {
    expect(resolveOptions({targetDir: "/tmp/x"}, {sdkVersion: "2.3.4"}).sdkSpec).toBe("^2.3.4");
  });

  it("deduplicates locales and keeps the requested order", () => {
    expect(resolveOptions({targetDir: "/tmp/x", locales: ["en", "nl", "en"]}, CTX).locales).toEqual([
      "en",
      "nl",
    ]);
  });

  it("rejects something that is not a language tag", () => {
    expect(() => resolveOptions({targetDir: "/tmp/x", locales: ["english"]}, CTX)).toThrow(
      /not a language tag/
    );
  });

  it("rejects an empty locale list — a manifest with no translations has no name", () => {
    expect(() => resolveOptions({targetDir: "/tmp/x", locales: ["  "]}, CTX)).toThrow(
      /At least one locale/
    );
  });

  it("rejects a blank display name", () => {
    expect(() => resolveOptions({targetDir: "/tmp/x", name: "  "}, CTX)).toThrow(
      /display name is required/
    );
  });

  it("rejects a blank description", () => {
    expect(() => resolveOptions({targetDir: "/tmp/x", description: " "}, CTX)).toThrow(
      /description is required/
    );
  });

  it("says what to do when the SDK's own version could not be read", () => {
    expect(() => resolveOptions({targetDir: "/tmp/x"}, {sdkVersion: ""})).toThrow(
      /Pass --sdk <spec>/
    );
  });

  it("rejects a blank target directory", () => {
    expect(() => resolveOptions({targetDir: "  "}, CTX)).toThrow(/target directory is required/);
  });
});
