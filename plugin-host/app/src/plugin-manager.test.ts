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
 * L1 tests for the PluginManager's *wiring* around Extism: the execution-limit options passed to
 * `createPlugin`, timeout error mapping, grant plumbing into the per-call host context, the
 * unload-vs-in-flight-call lock, and idle-instance eviction. The real Wasm behaviour is covered by
 * the L3 suite (`test/wasm/`), which needs the extism-js toolchain.
 */

import {existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {HostLogger} from "./models/index.js";
import {InvalidPluginPackageError} from "./errors.js";

const createPluginMock = vi.fn();
vi.mock("@extism/extism", () => ({
  default: (...args: unknown[]) => createPluginMock(...args),
}));

// Stands in for the http_request host function so the manager's *wiring* into it can be asserted.
// Extism itself is mocked, so the returned closure is registered but never invoked.
const createHttpRequestMock = vi.fn(() => async () => 0n);
vi.mock("./host-functions/http-request.js", () => ({
  createHttpRequestHostFunction: (...args: unknown[]) => createHttpRequestMock(...(args as [])),
}));

// Import AFTER the mocks so plugin-manager picks them up.
const {PluginManager, computeContentHash} = await import("./plugin-manager.js");

const PLUGIN_ID = "test-plugin";
const VERSION = "1.0.0";

/**
 * A minimal but genuinely valid Wasm module: header + a memory section declaring `min` pages and no
 * maximum, which is exactly the shape the extism-js toolchain emits and the shape the host has to
 * patch a maximum into.
 */
function wasmModuleWithMemory(min = 2): Buffer {
  return Buffer.from([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, // \0asm, version 1
    0x05, 0x03, 0x01, 0x00, min, // memory section: 1 memory, flags 0 (no maximum), min pages
  ]);
}

function manifestJson(pluginId = PLUGIN_ID, version = VERSION): string {
  return JSON.stringify({
    pluginId,
    version,
    translations: { en: { name: "Test", description: "d" } },
    actions: [],
  });
}

function noopLogger(): HostLogger {
  const l: HostLogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    child: () => l,
  };
  return l;
}

function fakeExtismPlugin() {
  return {
    call: vi.fn(async () => ({ text: () => JSON.stringify({ status: "completed" }) })),
    close: vi.fn(async () => {}),
  };
}

const configProvider = {
  get: vi.fn(async () => ({
    configurationId: "cfg-1",
    pluginId: PLUGIN_ID,
    pluginVersion: VERSION,
    properties: {},
    serviceToken: "svc",
    gzacBaseUrl: "http://gzac:8080",
    eventSubscriptions: [],
    grantedCapabilities: ["gzac_api"],
    grantedEndpoints: [{ method: "GET", pattern: "/api/v1/document/*" }],
  })),
};

const stubRepos = { kv: {} as never, log: {} as never };

const actionInput = {
  configurationId: "cfg-1",
  configuration: {},
  processInstanceId: "p",
  documentId: "d",
  activityId: "a",
  properties: {},
  serviceToken: "svc",
  gzacBaseUrl: "http://gzac:8080",
};

describe("PluginManager (mocked Extism)", () => {
  let storageDir: string;
  let manager: InstanceType<typeof PluginManager>;

  function makeManager(options: ConstructorParameters<typeof PluginManager>[5] = {}) {
    return new PluginManager(
      storageDir,
      noopLogger(),
      configProvider as never,
      stubRepos.kv,
      stubRepos.log,
      options
    );
  }

  beforeEach(() => {
    createPluginMock.mockReset();
    createPluginMock.mockImplementation(async () => fakeExtismPlugin());
    configProvider.get.mockClear();
    storageDir = mkdtempSync(join(tmpdir(), "plugin-manager-test-"));
    const pluginDir = join(storageDir, PLUGIN_ID, VERSION);
    mkdirSync(pluginDir, { recursive: true });
    writeFileSync(
      join(pluginDir, "manifest.json"),
      JSON.stringify({
        pluginId: PLUGIN_ID,
        version: VERSION,
        translations: { en: { name: "Test", description: "d" } },
        actions: [],
      })
    );
    writeFileSync(join(pluginDir, "plugin.wasm"), Buffer.from([0x00, 0x61, 0x73, 0x6d]));
  });

  afterEach(async () => {
    await manager?.close();
    rmSync(storageDir, { recursive: true, force: true });
    vi.useRealTimers();
  });

  it("passes the configured timeout and memory cap to createPlugin", async () => {
    manager = makeManager({ wasmTimeoutMs: 12_345, wasmMaxMemoryPages: 512 });
    await manager.loadPlugin(PLUGIN_ID, VERSION);
    await manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput);

    expect(createPluginMock).toHaveBeenCalledOnce();
    const options = createPluginMock.mock.calls[0][1] as Record<string, unknown>;
    expect(options.timeoutMs).toBe(12_345);
    expect(options.memory).toEqual({ maxPages: 512 });
    expect(options.runInWorker).toBe(true);
  });

  it("hands the http_request host function its target policy, including the internal-CIDR carve-out", async () => {
    // The carve-out only takes effect if it is threaded all the way through to the host function;
    // stored-but-unused, HOST_ALLOWED_INTERNAL_CIDRS would silently do nothing.
    const allowedInternalCidrs = ["10.1.0.0/16"] as never;
    manager = makeManager({ allowHttp: true, allowPrivateNetwork: true, allowedInternalCidrs });
    await manager.loadPlugin(PLUGIN_ID, VERSION);
    await manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput);

    expect(createHttpRequestMock).toHaveBeenCalledWith(
      expect.anything(), // logger
      expect.anything(), // log repository
      true,
      true,
      allowedInternalCidrs
    );
  });

  it("defaults the limits and omits the memory cap when it is disabled (0)", async () => {
    manager = makeManager({ wasmMaxMemoryPages: 0 });
    await manager.loadPlugin(PLUGIN_ID, VERSION);
    await manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput);

    const options = createPluginMock.mock.calls[0][1] as Record<string, unknown>;
    expect(options.timeoutMs).toBe(30_000);
    expect(options.memory).toBeUndefined();
  });

  it("maps Extism's timeout cancellation to a clear error and drops the cached instance", async () => {
    manager = makeManager({ wasmTimeoutMs: 500 });
    await manager.loadPlugin(PLUGIN_ID, VERSION);
    const stuck = fakeExtismPlugin();
    stuck.call.mockRejectedValueOnce(new Error("EXTISM: call canceled due to timeout"));
    createPluginMock.mockResolvedValueOnce(stuck);

    await expect(
      manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput)
    ).rejects.toThrow(/timed out after 500ms/);
    // The stale worker was discarded…
    expect(stuck.close).toHaveBeenCalled();

    // …and the next call gets a fresh instance and succeeds.
    const result = await manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput);
    expect(result.status).toBe("completed");
    expect(createPluginMock).toHaveBeenCalledTimes(2);
  });

  it("threads the configuration's grants (capabilities + endpoints) into the per-call host context", async () => {
    manager = makeManager();
    await manager.loadPlugin(PLUGIN_ID, VERSION);
    const instance = fakeExtismPlugin();
    createPluginMock.mockResolvedValueOnce(instance);

    await manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput);

    const hostCtx = instance.call.mock.calls[0][2] as Record<string, unknown>;
    expect(hostCtx.grantedCapabilities).toEqual(["gzac_api"]);
    expect(hostCtx.grantedEndpoints).toEqual([{ method: "GET", pattern: "/api/v1/document/*" }]);
    expect(hostCtx.serviceToken).toBe("svc");
  });

  it("does not close an in-flight call's instance on unloadPlugin — it waits for the lock", async () => {
    manager = makeManager();
    await manager.loadPlugin(PLUGIN_ID, VERSION);

    const instance = fakeExtismPlugin();
    let finishCall!: () => void;
    let closedDuringCall = false;
    instance.call.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        finishCall = resolve;
      });
      closedDuringCall = instance.close.mock.calls.length > 0;
      return { text: () => JSON.stringify({ status: "completed" }) };
    });
    createPluginMock.mockResolvedValueOnce(instance);

    const inFlight = manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput);
    // Let the call reach the Extism instance, then race a delete against it.
    await vi.waitFor(() => expect(instance.call).toHaveBeenCalled());
    const unloading = manager.unloadPlugin(PLUGIN_ID, VERSION);

    finishCall();
    await expect(inFlight).resolves.toMatchObject({ status: "completed" });
    await unloading;

    expect(closedDuringCall).toBe(false);
    expect(instance.close).toHaveBeenCalled();
  });

  describe("package content hash", () => {
    it("computes a stable hash at load time and exposes it via getContentHash and listPlugins", async () => {
      manager = makeManager();
      await manager.loadPlugin(PLUGIN_ID, VERSION);

      const hash = manager.getContentHash(PLUGIN_ID, VERSION);
      expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(manager.listPlugins()[0]).toMatchObject({ pluginId: PLUGIN_ID, contentHash: hash });
      expect(manager.listVersions(PLUGIN_ID)[0]).toMatchObject({ contentHash: hash });

      // Reloading unchanged bytes yields the same hash.
      await manager.loadPlugin(PLUGIN_ID, VERSION);
      expect(manager.getContentHash(PLUGIN_ID, VERSION)).toBe(hash);
    });

    it("changes the hash when any packaged file changes — including frontend assets", async () => {
      manager = makeManager();
      await manager.loadPlugin(PLUGIN_ID, VERSION);
      const original = manager.getContentHash(PLUGIN_ID, VERSION);

      const frontendDir = join(storageDir, PLUGIN_ID, VERSION, "frontend");
      mkdirSync(frontendDir, { recursive: true });
      writeFileSync(join(frontendDir, "case-tab.bundle.js"), "console.log('v2');");
      await manager.loadPlugin(PLUGIN_ID, VERSION);

      expect(manager.getContentHash(PLUGIN_ID, VERSION)).not.toBe(original);
    });

    it("hasVersion reports loaded versions and unloaded-but-on-disk versions", async () => {
      manager = makeManager();
      expect(manager.hasVersion(PLUGIN_ID, VERSION)).toBe(true); // on disk, not loaded
      await manager.loadPlugin(PLUGIN_ID, VERSION);
      expect(manager.hasVersion(PLUGIN_ID, VERSION)).toBe(true); // loaded
      expect(manager.hasVersion(PLUGIN_ID, "9.9.9")).toBe(false);
    });
  });

  describe("callSubmit (task-form Level 1 hook)", () => {
    const submitInput = {
      configurationId: "cfg-1",
      configuration: { setting: "x" },
      taskId: "task-1",
      processInstanceId: "pi-1",
      documentId: "doc-1",
      submission: { "pv:approved": true },
      serviceToken: "svc",
      gzacBaseUrl: "http://gzac:8080",
    };

    it("dispatches to the handle_submit export with the submit key in the Wasm input", async () => {
      manager = makeManager();
      await manager.loadPlugin(PLUGIN_ID, VERSION);
      const instance = fakeExtismPlugin();
      instance.call.mockResolvedValueOnce({
        text: () => JSON.stringify({ status: "completed", variables: { approved: true } }),
      });
      createPluginMock.mockResolvedValueOnce(instance);

      const result = await manager.callSubmit(PLUGIN_ID, VERSION, "review", submitInput);

      expect(result).toEqual({ status: "completed", variables: { approved: true } });
      const [exportName, wasmInput] = instance.call.mock.calls[0];
      expect(exportName).toBe("handle_submit");
      expect(JSON.parse(wasmInput as string)).toEqual({
        submitKey: "review",
        configurationId: "cfg-1",
        configuration: { setting: "x" },
        taskId: "task-1",
        processInstanceId: "pi-1",
        documentId: "doc-1",
        submission: { "pv:approved": true },
      });
    });

    it("keeps the service token and callback URL host-only (never in the Wasm input)", async () => {
      manager = makeManager();
      await manager.loadPlugin(PLUGIN_ID, VERSION);
      const instance = fakeExtismPlugin();
      createPluginMock.mockResolvedValueOnce(instance);

      await manager.callSubmit(PLUGIN_ID, VERSION, "review", submitInput);

      const wasmInput = instance.call.mock.calls[0][1] as string;
      expect(wasmInput).not.toContain("svc");
      expect(wasmInput).not.toContain("gzac:8080");

      const hostCtx = instance.call.mock.calls[0][2] as Record<string, unknown>;
      expect(hostCtx.serviceToken).toBe("svc");
      expect(hostCtx.gzacBaseUrl).toBe("http://gzac:8080");
      // A server-to-server hook gets no user token — only handle_request forwards one.
      expect(hostCtx.userToken).toBeUndefined();
    });

    it("resolves the configuration's grants into the hook's host context", async () => {
      manager = makeManager();
      await manager.loadPlugin(PLUGIN_ID, VERSION);
      const instance = fakeExtismPlugin();
      createPluginMock.mockResolvedValueOnce(instance);

      await manager.callSubmit(PLUGIN_ID, VERSION, "review", submitInput);

      const hostCtx = instance.call.mock.calls[0][2] as Record<string, unknown>;
      expect(hostCtx.grantedCapabilities).toEqual(["gzac_api"]);
      expect(hostCtx.grantedEndpoints).toEqual([{ method: "GET", pattern: "/api/v1/document/*" }]);
    });

    it("throws for an unknown plugin version", async () => {
      manager = makeManager();
      await expect(
        manager.callSubmit(PLUGIN_ID, "9.9.9", "review", submitInput)
      ).rejects.toThrow(/Plugin not found/);
    });
  });

  describe("loadAllFromDisk", () => {
    it("loads every version found under the storage directory", async () => {
      const secondVersion = "2.0.0";
      const dir = join(storageDir, PLUGIN_ID, secondVersion);
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, "manifest.json"),
        JSON.stringify({
          pluginId: PLUGIN_ID,
          version: secondVersion,
          translations: { en: { name: "Test", description: "d" } },
        })
      );
      writeFileSync(join(dir, "plugin.wasm"), Buffer.from([0x00, 0x61, 0x73, 0x6d]));

      manager = makeManager();
      await manager.loadAllFromDisk();

      expect(manager.listVersions(PLUGIN_ID).map((v) => v.version).sort()).toEqual([
        VERSION,
        secondVersion,
      ]);
    });

    it("skips a version whose package is unloadable instead of failing the boot", async () => {
      const broken = join(storageDir, PLUGIN_ID, "3.0.0");
      mkdirSync(broken, { recursive: true });
      writeFileSync(join(broken, "manifest.json"), "{not json");

      manager = makeManager();
      await manager.loadAllFromDisk();

      expect(manager.hasVersion(PLUGIN_ID, VERSION)).toBe(true);
      expect(manager.listVersions(PLUGIN_ID).map((v) => v.version)).toEqual([VERSION]);
    });

    it("creates the storage directory when it does not exist yet", async () => {
      const missing = join(storageDir, "nested", "plugins");
      manager = new PluginManager(
        missing,
        noopLogger(),
        configProvider as never,
        stubRepos.kv,
        stubRepos.log,
        {}
      );
      await manager.loadAllFromDisk();

      // The empty list alone would also hold if `loadAllFromDisk` returned early without the
      // mkdir, so assert the directory itself — that is the branch under test.
      expect(existsSync(missing)).toBe(true);
      expect(manager.listPlugins()).toEqual([]);
    });
  });

  /**
   * The manager builds `<storage>/<pluginId>/<version>` from strings that reach it from a manifest,
   * a route parameter, or a directory listing. A single `..` component would turn a package write
   * into an arbitrary file write, so containment is re-checked here rather than trusted upstream.
   */
  describe("storage-directory containment", () => {
    it.each([
      ["a traversing pluginId", "../../evil", VERSION],
      ["an absolute pluginId", "/etc", VERSION],
      ["a traversing version", PLUGIN_ID, "../../evil"],
      ["an uppercase pluginId", "Test-Plugin", VERSION],
    ])("refuses to load %s and creates nothing", async (_label, pluginId, version) => {
      manager = makeManager();
      const before = readdirSync(storageDir).sort();

      await expect(manager.loadPlugin(pluginId, version)).rejects.toThrow(
        InvalidPluginPackageError
      );
      expect(readdirSync(storageDir).sort()).toEqual(before);
    });

    it("refuses to install a package whose identity names a path, writing nothing", async () => {
      manager = makeManager();
      const before = readdirSync(storageDir).sort();

      await expect(
        manager.installPackage({
          pluginId: "../../evil",
          version: VERSION,
          manifestJson: manifestJson("../../evil"),
          wasmBuffer: wasmModuleWithMemory(),
          overwrite: false,
        })
      ).rejects.toThrow(InvalidPluginPackageError);
      expect(readdirSync(storageDir).sort()).toEqual(before);
    });

    it("refuses to resolve a plugin directory for an illegal identity", () => {
      manager = makeManager();
      expect(() => manager.getPluginDir("../../evil", VERSION)).toThrow(InvalidPluginPackageError);
    });

    it("answers hasVersion with false for an identity that could never have been stored", () => {
      // A query, not a command: "no such version" is the truthful answer for a name the manager
      // refuses to build a path for.
      manager = makeManager();
      expect(manager.hasVersion("../../evil", VERSION)).toBe(false);
      expect(manager.hasVersion(PLUGIN_ID, "../../evil")).toBe(false);
    });

    it("skips directories whose names do not satisfy the identity rules at boot", async () => {
      // Also what keeps an install's transient .staging-* / .trash-* siblings invisible to boot.
      for (const name of [".staging-abc123", "UPPER", "..hidden"]) {
        const dir = join(storageDir, name, VERSION);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "manifest.json"), manifestJson(name));
        writeFileSync(join(dir, "plugin.wasm"), wasmModuleWithMemory());
      }
      const badVersion = join(storageDir, PLUGIN_ID, "..evil");
      mkdirSync(badVersion, { recursive: true });
      writeFileSync(join(badVersion, "manifest.json"), manifestJson(PLUGIN_ID, "..evil"));
      writeFileSync(join(badVersion, "plugin.wasm"), wasmModuleWithMemory());

      manager = makeManager();
      await manager.loadAllFromDisk();

      expect(manager.listPlugins().map((p) => `${p.pluginId}@${p.version}`)).toEqual([
        `${PLUGIN_ID}@${VERSION}`,
      ]);
    });
  });

  /**
   * #614/#615: the existence check and the directory swap have to be one critical section, and the
   * swap has to replace the version directory rather than write into it.
   */
  describe("installPackage", () => {
    const install = (overrides: Record<string, unknown> = {}) =>
      manager.installPackage({
        pluginId: PLUGIN_ID,
        version: "2.0.0",
        manifestJson: manifestJson(PLUGIN_ID, "2.0.0"),
        wasmBuffer: wasmModuleWithMemory(),
        overwrite: false,
        ...overrides,
      } as never);

    /** Every file under the stored version directory, relative and sorted. */
    function storedFiles(version = "2.0.0"): string[] {
      const root = join(storageDir, PLUGIN_ID, version);
      const walk = (dir: string, prefix: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
          entry.isDirectory()
            ? walk(join(dir, entry.name), `${prefix}${entry.name}/`)
            : [`${prefix}${entry.name}`]
        );
      return walk(root, "").sort();
    }

    it("installs a package and reports the hash of exactly what is on disk", async () => {
      manager = makeManager();
      const result = await install();

      expect(result).toMatchObject({ outcome: "installed" });
      expect(storedFiles()).toEqual(["manifest.json", "plugin.wasm"]);
      const fresh = await computeContentHash(join(storageDir, PLUGIN_ID, "2.0.0"));
      expect((result as { contentHash: string }).contentHash).toBe(fresh);
      expect(manager.getContentHash(PLUGIN_ID, "2.0.0")).toBe(fresh);
    });

    it("resolves exactly one of two concurrent installs of the same version", async () => {
      // Without one critical section both callers pass the existence check before either writes:
      // the confirmation gate is bypassed and the two write sequences interleave into one directory.
      manager = makeManager();
      const [a, b] = await Promise.all([
        install({ manifestJson: manifestJson(PLUGIN_ID, "2.0.0") }),
        install({ wasmBuffer: wasmModuleWithMemory(3) }),
      ]);

      const outcomes = [a.outcome, b.outcome].sort();
      expect(outcomes).toEqual(["conflict", "installed"]);
      // The directory holds one coherent package, and the reported hash matches it.
      expect(storedFiles()).toEqual(["manifest.json", "plugin.wasm"]);
      const fresh = await computeContentHash(join(storageDir, PLUGIN_ID, "2.0.0"));
      expect(manager.getContentHash(PLUGIN_ID, "2.0.0")).toBe(fresh);
    });

    it("refuses a re-install without an explicit overwrite, reporting both hashes", async () => {
      manager = makeManager();
      const first = await install();
      const second = await install();

      expect(second.outcome).toBe("conflict");
      const conflict = second as { currentContentHash: string; uploadedContentHash: string };
      // Byte-identical content: the two hashes agree, which is how the caller recognises an upload
      // with nothing to do.
      expect(conflict.uploadedContentHash).toBe(conflict.currentContentHash);
      expect(conflict.currentContentHash).toBe((first as { contentHash: string }).contentHash);
    });

    it("reports different hashes when the same version is re-uploaded with different content", async () => {
      manager = makeManager();
      await install();
      const conflict = (await install({ wasmBuffer: wasmModuleWithMemory(9) })) as {
        currentContentHash: string;
        uploadedContentHash: string;
      };
      expect(conflict.uploadedContentHash).not.toBe(conflict.currentContentHash);
    });

    /** Version directories that are not a real package: leftover staging or trash siblings. */
    function transientDirs(): string[] {
      return readdirSync(join(storageDir, PLUGIN_ID)).filter((name) => name.startsWith("."));
    }

    it("leaves no staging directory behind after a refused install", async () => {
      manager = makeManager();
      await install();
      await install();
      expect(transientDirs()).toEqual([]);
    });

    it("replaces the version directory wholesale on overwrite, dropping stale files", async () => {
      // #615: writing into the existing directory would leave the old bundle in place — still
      // served, and still counted in the content hash GZAC pins.
      manager = makeManager();
      const frontendDir = join(storageDir, "src-frontend");
      mkdirSync(frontendDir, { recursive: true });
      writeFileSync(join(frontendDir, "old.js"), "console.log('v1');");
      await install({ frontendDir });
      expect(storedFiles()).toEqual(["frontend/old.js", "manifest.json", "plugin.wasm"]);

      const result = await install({ overwrite: true }); // no frontend this time

      expect(storedFiles()).toEqual(["manifest.json", "plugin.wasm"]);
      const fresh = await computeContentHash(join(storageDir, PLUGIN_ID, "2.0.0"));
      expect((result as { contentHash: string }).contentHash).toBe(fresh);
    });

    it("copies a logo under its basename and refuses one that names a path", async () => {
      manager = makeManager();
      const logoDir = join(storageDir, "src-logo");
      mkdirSync(logoDir, { recursive: true });
      writeFileSync(join(logoDir, "logo.svg"), "<svg/>");

      await install({ logoSourcePath: join(logoDir, "logo.svg") });
      expect(storedFiles()).toEqual(["logo.svg", "manifest.json", "plugin.wasm"]);

      writeFileSync(join(logoDir, "evil.exe"), "MZ");
      await expect(
        install({ overwrite: true, logoSourcePath: join(logoDir, "evil.exe") })
      ).rejects.toThrow(InvalidPluginPackageError);
    });

    it("names its transient directories so a crashed install stays invisible at boot", async () => {
      // A crash between the two renames of an overwrite can leave a `.trash-*` (or `.staging-*`)
      // sibling behind. Those names must fail the identity rules, or the next boot would try to
      // load one as if it were a real version.
      manager = makeManager();
      await install();
      for (const leftover of [".staging-abc123", `.trash-2.0.0-${"a".repeat(8)}`]) {
        const dir = join(storageDir, PLUGIN_ID, leftover);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "manifest.json"), manifestJson(PLUGIN_ID, "2.0.0"));
        writeFileSync(join(dir, "plugin.wasm"), wasmModuleWithMemory());
      }

      const rebooted = makeManager();
      try {
        await rebooted.loadAllFromDisk();
        expect(rebooted.listVersions(PLUGIN_ID).map((v) => v.version).sort()).toEqual([
          VERSION,
          "2.0.0",
        ]);
      } finally {
        await rebooted.close();
      }
    });

    it("keeps the previous package on disk and loaded when the new one fails to load", async () => {
      manager = makeManager();
      await install();
      const originalHash = manager.getContentHash(PLUGIN_ID, "2.0.0");

      await expect(
        // A manifest whose identity disagrees with the directory it was installed into.
        install({ overwrite: true, manifestJson: manifestJson(PLUGIN_ID, "9.9.9") })
      ).rejects.toThrow(/mismatch/);

      expect(manager.getContentHash(PLUGIN_ID, "2.0.0")).toBe(originalHash);
      expect(storedFiles()).toEqual(["manifest.json", "plugin.wasm"]);
      // Neither the staging copy nor the trashed previous package survives a failure.
      expect(transientDirs()).toEqual([]);
    });
  });

  /**
   * #612: Extism's own `maxPages` option only bounds the host-side blocks used to pass input and
   * output across the boundary. The guest declares and exports its own linear memory, so the cap
   * has to be written into the module's memory declaration — the only bound the engine enforces.
   */
  describe("memory cap enforcement", () => {
    beforeEach(() => {
      writeFileSync(join(storageDir, PLUGIN_ID, VERSION, "plugin.wasm"), wasmModuleWithMemory());
    });

    it("instantiates from patched module bytes that differ from the file on disk", async () => {
      manager = makeManager({ wasmMaxMemoryPages: 512 });
      await manager.loadPlugin(PLUGIN_ID, VERSION);
      await manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput);

      const [manifestArg, options] = createPluginMock.mock.calls[0] as [
        { wasm: Array<{ data: Uint8Array }> },
        Record<string, unknown>,
      ];
      const patched = manifestArg.wasm[0].data;
      // flags 0x01 (a maximum is present) followed by min=2, max=512 as LEB128.
      expect([...patched.slice(8)]).toEqual([0x05, 0x05, 0x01, 0x01, 0x02, 0x80, 0x04]);
      expect([...patched]).not.toEqual([...wasmModuleWithMemory()]);
      // The host-side buffer cap is still passed — it bounds a different allocation and is worth
      // keeping alongside the module-level bound.
      expect(options.memory).toEqual({ maxPages: 512 });
    });

    it("leaves the module untouched when the cap is disabled", async () => {
      manager = makeManager({ wasmMaxMemoryPages: 0 });
      await manager.loadPlugin(PLUGIN_ID, VERSION);
      await manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput);

      const [manifestArg, options] = createPluginMock.mock.calls[0] as [
        { wasm: Array<{ data: Uint8Array }> },
        Record<string, unknown>,
      ];
      expect([...manifestArg.wasm[0].data]).toEqual([...wasmModuleWithMemory()]);
      expect(options.memory).toBeUndefined();
    });

    it("loads a module the cap cannot be applied to, rather than failing the load", async () => {
      // The stub package's plugin.wasm is not a parseable module; Extism would reject it with a
      // far clearer message than a section-walker error.
      writeFileSync(
        join(storageDir, PLUGIN_ID, VERSION, "plugin.wasm"),
        Buffer.from([0x00, 0x61, 0x73, 0x6d])
      );
      manager = makeManager({ wasmMaxMemoryPages: 512 });
      await expect(manager.loadPlugin(PLUGIN_ID, VERSION)).resolves.toBeUndefined();
    });
  });

  /**
   * #611: instances are pooled rather than shared behind a lock, so calls to one plugin overlap.
   */
  describe("instance pool", () => {
    /** An instance whose call blocks until the returned `finish` is invoked. */
    function blockingInstance() {
      const instance = fakeExtismPlugin();
      const finishers: Array<() => void> = [];
      instance.call.mockImplementation(async () => {
        await new Promise<void>((resolve) => finishers.push(resolve));
        return { text: () => JSON.stringify({ status: "completed" }) };
      });
      return { instance, finishAll: () => finishers.splice(0).forEach((f) => f()) };
    }

    it("runs two concurrent calls on two instances instead of queueing them", async () => {
      manager = makeManager({ poolMaxInstances: 2 });
      await manager.loadPlugin(PLUGIN_ID, VERSION);
      const first = blockingInstance();
      const second = blockingInstance();
      createPluginMock.mockResolvedValueOnce(first.instance).mockResolvedValueOnce(second.instance);

      const calls = [
        manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput),
        manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput),
      ];

      // Both reach a Wasm instance before either finishes — impossible under the old single-lock
      // design, where the second call could not start until the first returned.
      await vi.waitFor(() => {
        expect(first.instance.call).toHaveBeenCalled();
        expect(second.instance.call).toHaveBeenCalled();
      });
      first.finishAll();
      second.finishAll();
      await expect(Promise.all(calls)).resolves.toMatchObject([
        { status: "completed" },
        { status: "completed" },
      ]);
      expect(createPluginMock).toHaveBeenCalledTimes(2);
    });

    it("serialises calls onto one instance when the pool maximum is 1", async () => {
      manager = makeManager({ poolMaxInstances: 1 });
      await manager.loadPlugin(PLUGIN_ID, VERSION);
      const only = blockingInstance();
      createPluginMock.mockResolvedValue(only.instance);

      const calls = [
        manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput),
        manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput),
      ];

      await vi.waitFor(() => expect(only.instance.call).toHaveBeenCalledTimes(1));
      only.finishAll();
      await vi.waitFor(() => expect(only.instance.call).toHaveBeenCalledTimes(2));
      only.finishAll();

      await Promise.all(calls);
      expect(createPluginMock).toHaveBeenCalledTimes(1);
    });

    it("fails a call that waits longer than the acquire timeout for a free instance", async () => {
      manager = makeManager({ poolMaxInstances: 1, poolAcquireTimeoutMs: 20 });
      await manager.loadPlugin(PLUGIN_ID, VERSION);
      const only = blockingInstance();
      createPluginMock.mockResolvedValue(only.instance);

      const held = manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput);
      await vi.waitFor(() => expect(only.instance.call).toHaveBeenCalled());

      await expect(manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput)).rejects.toThrow(
        /Timed out after 20ms waiting for a free Wasm instance/
      );
      only.finishAll();
      await held;
    });

    it("discards only the failing call's instance, leaving a concurrent call untouched", async () => {
      manager = makeManager({ poolMaxInstances: 2 });
      await manager.loadPlugin(PLUGIN_ID, VERSION);
      const healthy = blockingInstance();
      const doomed = fakeExtismPlugin();
      doomed.call.mockRejectedValueOnce(new Error("EXTISM: call canceled due to timeout"));
      createPluginMock
        .mockResolvedValueOnce(healthy.instance)
        .mockResolvedValueOnce(doomed)
        .mockResolvedValue(fakeExtismPlugin());

      const surviving = manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput);
      await vi.waitFor(() => expect(healthy.instance.call).toHaveBeenCalled());

      await expect(manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput)).rejects.toThrow(
        /timed out after/
      );
      expect(doomed.close).toHaveBeenCalled();
      expect(healthy.instance.close).not.toHaveBeenCalled();

      healthy.finishAll();
      await expect(surviving).resolves.toMatchObject({ status: "completed" });
    });

    it("drops an instance that fails for a reason other than the timeout", async () => {
      // A trapped instance is in an undefined state; with the memory cap enforced at the module
      // boundary a trap is an expected failure mode rather than an exotic one.
      manager = makeManager();
      await manager.loadPlugin(PLUGIN_ID, VERSION);
      const trapped = fakeExtismPlugin();
      trapped.call.mockRejectedValueOnce(new Error("unreachable executed"));
      createPluginMock.mockResolvedValueOnce(trapped);

      await expect(
        manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput)
      ).rejects.toThrow(/unreachable executed/);
      expect(trapped.close).toHaveBeenCalled();

      await expect(
        manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput)
      ).resolves.toMatchObject({ status: "completed" });
      expect(createPluginMock).toHaveBeenCalledTimes(2);
    });

    it("waits for every in-flight call before removePlugin deletes the files", async () => {
      manager = makeManager({ poolMaxInstances: 2 });
      await manager.loadPlugin(PLUGIN_ID, VERSION);
      const first = blockingInstance();
      const second = blockingInstance();
      createPluginMock.mockResolvedValueOnce(first.instance).mockResolvedValueOnce(second.instance);

      const calls = [
        manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput),
        manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput),
      ];
      await vi.waitFor(() => {
        expect(first.instance.call).toHaveBeenCalled();
        expect(second.instance.call).toHaveBeenCalled();
      });

      let removed = false;
      const removing = manager.removePlugin(PLUGIN_ID, VERSION).then(() => {
        removed = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(removed).toBe(false);
      expect(existsSync(join(storageDir, PLUGIN_ID, VERSION))).toBe(true);

      first.finishAll();
      second.finishAll();
      await Promise.all(calls);
      await removing;

      expect(existsSync(join(storageDir, PLUGIN_ID))).toBe(false);
    });
  });

  it("evicts an instance that has been idle past the TTL, via the periodic sweep", async () => {
    vi.useFakeTimers();
    manager = makeManager({ instanceIdleTtlMs: 1_000 });
    await manager.loadPlugin(PLUGIN_ID, VERSION);
    const instance = fakeExtismPlugin();
    createPluginMock.mockResolvedValueOnce(instance);

    await manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput);
    expect(instance.close).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2_500);
    expect(instance.close).toHaveBeenCalled();

    // The next call transparently re-instantiates.
    await manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput);
    expect(createPluginMock).toHaveBeenCalledTimes(2);
  });
});
