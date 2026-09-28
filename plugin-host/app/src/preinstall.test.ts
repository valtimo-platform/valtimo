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

import {mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import AdmZip from "adm-zip";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {preinstallPlugins} from "./preinstall";
import {testConfig} from "./test-support/harness";

/**
 * The pre-install path is exercised against a fake plugin manager: the real install/hash/load
 * mechanics already have their own coverage in plugin-manager.test.ts, and what matters here is the
 * decision table — install, leave alone, replace, or skip — plus the guarantee that no single bad
 * package can stop the host from starting.
 */
function makeZip(manifest: unknown, wasm = Buffer.from([0x00, 0x61, 0x73, 0x6d])): Buffer {
  const zip = new AdmZip();
  zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest)));
  zip.addFile("plugin.wasm", wasm);
  return zip.toBuffer();
}

const validManifest = {
  pluginId: "case-summary",
  version: "0.1.0",
  translations: {en: {name: "Case Summary", description: "desc"}},
  actions: [],
};

/**
 * Minimal stand-in for PluginManager.installPackage: remembers what is installed per
 * pluginId@version, and refuses a differing re-install without `overwrite` exactly as the real
 * manager does.
 */
function fakePluginManager() {
  const installed = new Map<string, string>();
  const installPackage = vi.fn(
    async (input: {
      pluginId: string;
      version: string;
      wasmBuffer: Buffer;
      overwrite: boolean;
    }) => {
      const key = `${input.pluginId}@${input.version}`;
      // Stand-in for the real content hash: derived from the wasm bytes, so "same zip" and
      // "different zip" behave the way real content hashing would.
      const uploadedContentHash = `sha256:${input.wasmBuffer.toString("hex")}`;
      const current = installed.get(key) ?? null;
      if (current !== null && !input.overwrite) {
        return {outcome: "conflict" as const, currentContentHash: current, uploadedContentHash};
      }
      installed.set(key, uploadedContentHash);
      return {
        outcome: "installed" as const,
        manifest: validManifest,
        contentHash: uploadedContentHash,
      };
    }
  );
  return {installed, installPackage};
}

function captureLogger() {
  const lines: Array<{level: string; obj: Record<string, unknown>; msg?: string}> = [];
  const record = (level: string) =>
    (objOrMsg: Record<string, unknown> | string, msg?: string) => {
      if (typeof objOrMsg === "string") lines.push({level, obj: {}, msg: objOrMsg});
      else lines.push({level, obj: objOrMsg, msg});
    };
  const logger = {
    info: record("info"),
    warn: record("warn"),
    error: record("error"),
    debug: record("debug"),
    child: () => logger,
  };
  return {logger, lines};
}

describe("preinstallPlugins", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "preinstall-test-"));
  });

  afterEach(async () => {
    await rm(dir, {recursive: true, force: true}).catch(() => {});
  });

  function run(
    manager: ReturnType<typeof fakePluginManager>,
    overrides: {dirOverride?: string; overwrite?: boolean} = {}
  ) {
    const {logger, lines} = captureLogger();
    const config = testConfig({
      PLUGIN_PREINSTALL_DIR: overrides.dirOverride ?? dir,
      PLUGIN_PREINSTALL_OVERWRITE: overrides.overwrite ?? false,
    });
    return preinstallPlugins(manager as never, config, logger as never).then(() => lines);
  }

  it("is a no-op when the pre-install directory does not exist", async () => {
    const manager = fakePluginManager();
    const lines = await run(manager, {dirOverride: join(dir, "does-not-exist")});

    expect(manager.installPackage).not.toHaveBeenCalled();
    // Not a warning: an image shipping an empty pre-install directory is the normal case.
    expect(lines.every((line) => line.level !== "warn")).toBe(true);
  });

  it("installs every zip it finds", async () => {
    const manager = fakePluginManager();
    await writeFile(join(dir, "case-summary-0.1.0.zip"), makeZip(validManifest));
    await writeFile(
      join(dir, "other-1.0.0.zip"),
      makeZip({...validManifest, pluginId: "other", version: "1.0.0"})
    );

    await run(manager);

    expect(manager.installPackage).toHaveBeenCalledTimes(2);
    expect([...manager.installed.keys()].sort()).toEqual(["case-summary@0.1.0", "other@1.0.0"]);
  });

  it("treats an identical package already installed as unchanged", async () => {
    const manager = fakePluginManager();
    await writeFile(join(dir, "case-summary-0.1.0.zip"), makeZip(validManifest));

    await run(manager);
    const lines = await run(manager);

    // Second boot: one attempt, refused as a conflict with an equal hash, nothing replaced.
    expect(manager.installPackage).toHaveBeenCalledTimes(2);
    expect(lines.find((line) => line.msg === "Plugin pre-install complete")?.obj).toMatchObject({
      installed: 0,
      unchanged: 1,
      skipped: 0,
    });
  });

  it("keeps the installed version when the pre-install package has different content", async () => {
    const manager = fakePluginManager();
    await writeFile(join(dir, "case-summary-0.1.0.zip"), makeZip(validManifest));
    await run(manager);
    const installedHash = manager.installed.get("case-summary@0.1.0");

    // Same pluginId@version, different bytes — the content GZAC pinned must not change silently.
    await writeFile(
      join(dir, "case-summary-0.1.0.zip"),
      makeZip(validManifest, Buffer.from([0x00, 0x61, 0x73, 0x6d, 0xff]))
    );
    const lines = await run(manager);

    expect(manager.installed.get("case-summary@0.1.0")).toBe(installedHash);
    expect(lines.some((line) => line.level === "warn")).toBe(true);
    expect(lines.find((line) => line.msg === "Plugin pre-install complete")?.obj).toMatchObject({
      installed: 0,
      unchanged: 0,
      skipped: 1,
    });
  });

  it("replaces differing content when PLUGIN_PREINSTALL_OVERWRITE is enabled", async () => {
    const manager = fakePluginManager();
    await writeFile(join(dir, "case-summary-0.1.0.zip"), makeZip(validManifest));
    await run(manager);
    const installedHash = manager.installed.get("case-summary@0.1.0");

    await writeFile(
      join(dir, "case-summary-0.1.0.zip"),
      makeZip(validManifest, Buffer.from([0x00, 0x61, 0x73, 0x6d, 0xff]))
    );
    await run(manager, {overwrite: true});

    expect(manager.installed.get("case-summary@0.1.0")).not.toBe(installedHash);
  });

  it("skips a corrupt zip and still installs the others", async () => {
    const manager = fakePluginManager();
    await writeFile(join(dir, "aaa-corrupt.zip"), Buffer.from("this is not a zip file"));
    await writeFile(join(dir, "bbb-valid.zip"), makeZip(validManifest));

    const lines = await run(manager);

    expect([...manager.installed.keys()]).toEqual(["case-summary@0.1.0"]);
    expect(lines.find((line) => line.msg === "Plugin pre-install complete")?.obj).toMatchObject({
      installed: 1,
      skipped: 1,
    });
  });

  it("skips a package whose manifest is invalid", async () => {
    const manager = fakePluginManager();
    await writeFile(join(dir, "bad.zip"), makeZip({pluginId: "x", version: "1.0.0"}));

    const lines = await run(manager);

    expect(manager.installPackage).not.toHaveBeenCalled();
    expect(
      lines.some(
        (line) =>
          line.level === "warn" && line.msg === "Skipping pre-install package: invalid plugin manifest"
      )
    ).toBe(true);
  });

  it("ignores files that are not .zip", async () => {
    const manager = fakePluginManager();
    await writeFile(join(dir, "README.md"), "not a package");
    await writeFile(join(dir, "case-summary-0.1.0.zip.bak"), makeZip(validManifest));

    await run(manager);

    expect(manager.installPackage).not.toHaveBeenCalled();
  });
});
