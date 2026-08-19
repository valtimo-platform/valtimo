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

import type {Plugin as ExtismPlugin} from "@extism/extism";
import createPlugin from "@extism/extism";
import {cp, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile} from "node:fs/promises";
import {basename, dirname, join, resolve, sep} from "node:path";
import {existsSync} from "node:fs";
import {createHash, randomUUID} from "node:crypto";
import {
  isValidPluginId,
  isValidPluginLogo,
  isValidPluginVersion,
} from "@valtimo/plugin-sdk/manifest-validation";
import type {HostLogger, PluginConfiguration, PluginManifest} from "./models/index.js";
import {createGzacApiHostFunction, type GzacApiCallContext} from "./host-functions/gzac-api.js";
import type {KvRepository} from "./db/kv-repository.js";
import type {LogRepository} from "./db/log-repository.js";
import {createKvHostFunction} from "./host-functions/kv.js";
import {createLogHostFunction} from "./host-functions/log.js";
import {createHttpRequestHostFunction} from "./host-functions/http-request.js";
import type {AllowedInternalCidrs} from "./security/url-guard.js";
import {InvalidPluginPackageError} from "./errors.js";
import {applyMaxMemoryPages} from "./wasm-memory-limit.js";
import {WasmInstancePool} from "./wasm-instance-pool.js";

interface LoadedPlugin {
  pluginId: string;
  version: string;
  manifest: PluginManifest;
  /** Package content hash (see {@link computeContentHash}) — GZAC pins this at discovery. */
  contentHash: string;
  /**
   * The module bytes every instance is created from, read once at load and patched with the
   * configured memory cap. Cached rather than re-read per instance, and deliberately kept while the
   * plugin is loaded even when the pool has evicted every instance — a few MB per loaded version
   * buys cheap re-instantiation. Passing bytes (not a path) also means no long-lived open handle on
   * plugin.wasm, which is what lets an overwrite rename the version directory on Windows too.
   */
  moduleBytes: Uint8Array;
  /**
   * Instances for this version. Extism instances are not reentrant, so parallel calls need
   * parallel instances; the pool bounds how many can exist and guarantees an instance is never
   * closed while a call is running against it.
   */
  pool: WasmInstancePool<ExtismPlugin>;
}

/**
 * The subset of the configuration store the manager needs: per-call grant lookups. Satisfied by
 * both `ConfigRegistry` (cached — what production wires in) and a bare `ConfigRepository`.
 */
export interface ConfigProvider {
  get(configurationId: string): Promise<PluginConfiguration | undefined>;
}

export interface PluginManagerOptions {
  /** Allow plain-http targets in `http_request` (dev only). */
  allowHttp?: boolean;
  /** Allow private/loopback targets in `http_request` (dev only). */
  allowPrivateNetwork?: boolean;
  /**
   * Operator-declared internal ranges `http_request` may reach despite them being private
   * (`HOST_ALLOWED_INTERNAL_CIDRS`). A carve-out from the address envelope, not a grant: the target
   * still has to be in the configuration's egress allowlist.
   */
  allowedInternalCidrs?: AllowedInternalCidrs;
  /** Hard wall-clock limit per Wasm call; Extism cancels the call when exceeded. */
  wasmTimeoutMs?: number;
  /** Cap on the module's linear memory in 64 KiB pages; 0 disables the cap. */
  wasmMaxMemoryPages?: number;
  /** Timeout for the `gzac_api` callback fetch. */
  gzacApiTimeoutMs?: number;
  /** Idle Extism instances are closed after this long without a call; 0 disables eviction. */
  instanceIdleTtlMs?: number;
  /** Instances of one plugin version kept alive once created. */
  poolMinInstances?: number;
  /** Hard ceiling on concurrent instances of one plugin version. */
  poolMaxInstances?: number;
  /** How long a call waits for a free instance before failing. */
  poolAcquireTimeoutMs?: number;
}

const DEFAULT_WASM_TIMEOUT_MS = 30_000;
const DEFAULT_WASM_MAX_MEMORY_PAGES = 4096; // 64 KiB/page → 256 MiB
const DEFAULT_GZAC_API_TIMEOUT_MS = 60_000;
const DEFAULT_INSTANCE_IDLE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_POOL_MIN_INSTANCES = 1;
const DEFAULT_POOL_MAX_INSTANCES = 10;
const DEFAULT_POOL_ACQUIRE_TIMEOUT_MS = 30_000;

/** Extism cancels a timed-out call with "EXTISM: call canceled due to timeout". */
function isWasmTimeoutError(err: unknown): boolean {
  return err instanceof Error && /canceled due to timeout/i.test(err.message);
}

/**
 * The outcome of {@link PluginManager.installPackage}: either the package is now the stored one for
 * this version, or an identical-named version already existed and the caller did not confirm an
 * overwrite. The conflict carries both hashes so the caller can tell a byte-identical re-upload
 * (nothing to do) from genuinely different content (admin review required).
 */
export type InstallOutcome =
  | { outcome: "installed"; manifest: PluginManifest; contentHash: string }
  | { outcome: "conflict"; currentContentHash: string | null; uploadedContentHash: string };

export interface InstallPackageInput {
  pluginId: string;
  version: string;
  manifestJson: string;
  wasmBuffer: Buffer;
  frontendDir?: string;
  logoSourcePath?: string;
  overwrite: boolean;
}

/**
 * Computes the package content hash: SHA-256 over every file in the plugin version directory
 * (manifest.json, plugin.wasm, the logo, frontend/**), each record bound to its relative path and
 * byte length so files cannot be renamed or shuffled without changing the hash. GZAC pins this
 * value at discovery and flags the definition for re-acceptance when it changes — the on-disk
 * package is tamper-evident even though the host itself is only semi-trusted.
 *
 * Exported so the install path can hash a staged-but-not-yet-swapped-in package and tell an
 * identical re-upload apart from one with different content.
 */
export async function computeContentHash(pluginDir: string): Promise<string> {
  const files: string[] = [];
  const walk = async (dir: string, prefix: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(join(dir, entry.name), rel);
      } else if (entry.isFile()) {
        files.push(rel);
      }
    }
  };
  await walk(pluginDir, "");
  files.sort();

  const hash = createHash("sha256");
  for (const rel of files) {
    const content = await readFile(join(pluginDir, rel));
    hash.update(`${rel}\0${content.length}\0`);
    hash.update(content);
  }
  return `sha256:${hash.digest("hex")}`;
}

/**
 * Manages the lifecycle of Wasm plugins.
 *
 * Composite key: pluginId@version identifies a loaded plugin.
 * Multiple versions of the same plugin can coexist.
 */
export class PluginManager {
  private plugins = new Map<string, LoadedPlugin>();
  private logger: HostLogger;
  private storageDir: string;
  private configProvider: ConfigProvider;
  private kvRepository: KvRepository;
  private logRepository: LogRepository;
  private readonly allowHttp: boolean;
  private readonly allowPrivateNetwork: boolean;
  private readonly allowedInternalCidrs?: AllowedInternalCidrs;
  private readonly wasmTimeoutMs: number;
  private readonly wasmMaxMemoryPages: number;
  private readonly gzacApiTimeoutMs: number;
  private readonly instanceIdleTtlMs: number;
  private readonly poolMinInstances: number;
  private readonly poolMaxInstances: number;
  private readonly poolAcquireTimeoutMs: number;
  private evictionTimer: ReturnType<typeof setInterval> | null = null;
  /**
   * Serialises check-then-install per `pluginId@version`. Without this, two uploads of the same
   * version both pass the "does it already exist" check before either writes: the confirmation gate
   * is bypassed, the two write sequences interleave into one directory, and the content hash can be
   * computed over the other upload's bytes.
   */
  private installLocks = new Map<string, Promise<unknown>>();

  constructor(
    storageDir: string,
    logger: HostLogger,
    configProvider: ConfigProvider,
    kvRepository: KvRepository,
    logRepository: LogRepository,
    options: PluginManagerOptions = {}
  ) {
    this.storageDir = storageDir;
    this.logger = logger.child({ component: "PluginManager" });
    this.configProvider = configProvider;
    this.kvRepository = kvRepository;
    this.logRepository = logRepository;
    this.allowHttp = options.allowHttp ?? false;
    this.allowPrivateNetwork = options.allowPrivateNetwork ?? false;
    this.allowedInternalCidrs = options.allowedInternalCidrs;
    this.wasmTimeoutMs = options.wasmTimeoutMs ?? DEFAULT_WASM_TIMEOUT_MS;
    this.wasmMaxMemoryPages = options.wasmMaxMemoryPages ?? DEFAULT_WASM_MAX_MEMORY_PAGES;
    this.gzacApiTimeoutMs = options.gzacApiTimeoutMs ?? DEFAULT_GZAC_API_TIMEOUT_MS;
    this.instanceIdleTtlMs = options.instanceIdleTtlMs ?? DEFAULT_INSTANCE_IDLE_TTL_MS;
    this.poolMinInstances = Math.max(1, options.poolMinInstances ?? DEFAULT_POOL_MIN_INSTANCES);
    this.poolMaxInstances = Math.max(
      this.poolMinInstances,
      options.poolMaxInstances ?? DEFAULT_POOL_MAX_INSTANCES
    );
    this.poolAcquireTimeoutMs = Math.max(
      1,
      options.poolAcquireTimeoutMs ?? DEFAULT_POOL_ACQUIRE_TIMEOUT_MS
    );

    if (this.instanceIdleTtlMs > 0) {
      // Periodic sweep closing instances that have been idle longer than the TTL. Cached Extism
      // instances each hold a worker thread + Wasm memory, so a burst of activity would otherwise
      // pin that footprint forever. `unref()` keeps the timer from holding the process open.
      const sweepEvery = Math.min(this.instanceIdleTtlMs, 60_000);
      this.evictionTimer = setInterval(() => this.evictIdleInstances(), sweepEvery);
      this.evictionTimer.unref?.();
    }
  }

  private key(pluginId: string, version: string): string {
    return `${pluginId}@${version}`;
  }

  /**
   * Resolves `<storageDir>/<pluginId>/<version>` and refuses anything that could step outside the
   * storage directory. The identity charset is re-checked here, not only at upload: a directory name
   * found on disk, a route parameter, or a manifest that reached an older validator all arrive as
   * plain strings, and a single `..` component would turn a package write into an arbitrary file
   * write.
   */
  private resolveVersionDir(pluginId: string, version: string): string {
    if (!isValidPluginId(pluginId) || !isValidPluginVersion(version)) {
      throw new InvalidPluginPackageError(`Illegal plugin identity: ${pluginId}@${version}`);
    }
    const root = resolve(this.storageDir);
    const dir = resolve(root, pluginId, version);
    if (!dir.startsWith(root + sep)) {
      throw new InvalidPluginPackageError(
        `Plugin directory escapes the storage directory: ${pluginId}@${version}`
      );
    }
    return dir;
  }

  /**
   * Load a plugin from its storage directory.
   * Expects: {storageDir}/{pluginId}/{version}/manifest.json and plugin.wasm
   */
  async loadPlugin(pluginId: string, version: string): Promise<void> {
    const pluginDir = this.resolveVersionDir(pluginId, version);
    const manifestPath = join(pluginDir, "manifest.json");
    const wasmPath = join(pluginDir, "plugin.wasm");

    if (!existsSync(manifestPath)) {
      throw new Error(`Manifest not found: ${manifestPath}`);
    }
    if (!existsSync(wasmPath)) {
      throw new Error(`Wasm module not found: ${wasmPath}`);
    }

    const manifest: PluginManifest = JSON.parse(
      await readFile(manifestPath, "utf-8")
    );

    if (manifest.pluginId !== pluginId || manifest.version !== version) {
      throw new Error(
        `Manifest pluginId/version mismatch: expected ${pluginId}@${version}, got ${manifest.pluginId}@${manifest.version}`
      );
    }

    const contentHash = await computeContentHash(pluginDir);

    // Read + patch the module once per load. The cap has to be written into the module's own memory
    // declaration because that is the only bound the engine enforces on guest memory growth.
    const rawModule = new Uint8Array(await readFile(wasmPath));
    const limited = applyMaxMemoryPages(rawModule, this.wasmMaxMemoryPages);
    if (this.wasmMaxMemoryPages > 0 && limited.reason) {
      this.logger.warn(
        { pluginId, version, applied: limited.applied, reason: limited.reason },
        "Wasm memory cap could not be applied verbatim to the module"
      );
    }

    const k = this.key(pluginId, version);

    // If already loaded, unload first (hot-reload)
    if (this.plugins.has(k)) {
      this.logger.info({ pluginId, version }, "Hot-reloading plugin");
      await this.unloadPlugin(pluginId, version);
    }

    const moduleBytes = limited.bytes;
    this.plugins.set(k, {
      pluginId,
      version,
      manifest,
      contentHash,
      moduleBytes,
      pool: new WasmInstancePool<ExtismPlugin>(
        () => this.createExtismInstance(moduleBytes),
        async (instance) => {
          await instance.close();
        },
        {
          minInstances: this.poolMinInstances,
          maxInstances: this.poolMaxInstances,
          acquireTimeoutMs: this.poolAcquireTimeoutMs,
          label: k,
        }
      ),
    });

    this.logger.info({ pluginId, version, contentHash }, "Plugin loaded");
  }

  /**
   * Unload a plugin version, freeing its Wasm instances.
   *
   * The entry is removed from the map first (new calls fail fast with "Plugin not found"), then the
   * pool is drained — which waits for every in-flight call to finish before closing its instance,
   * rather than killing a call mid-execution.
   */
  async unloadPlugin(pluginId: string, version: string): Promise<void> {
    const k = this.key(pluginId, version);
    const loaded = this.plugins.get(k);
    if (!loaded) return;

    this.plugins.delete(k);
    await loaded.pool.drain();

    this.logger.info({ pluginId, version }, "Plugin unloaded");
  }

  /**
   * Serialises `fn` against other installs of the same `pluginId@version`, so the existence check
   * and the directory swap cannot interleave with another upload of the same identity.
   */
  private runInstallExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.installLocks.get(key) ?? Promise.resolve();
    const run = previous.then(fn, fn);
    const tail = run.then(
      () => undefined,
      () => undefined
    );
    this.installLocks.set(key, tail);
    // Drop the entry once this is the last queued install, so the map doesn't grow with every upload.
    void tail.then(() => {
      if (this.installLocks.get(key) === tail) this.installLocks.delete(key);
    });
    return run;
  }

  /**
   * Installs a plugin package as `pluginId@version` and loads it.
   *
   * The package is written to a staging directory first and swapped in with a rename, so the stored
   * version directory always holds exactly one package: a partial write is never visible, and an
   * overwrite cannot leave files from the previous package behind (which would keep being served
   * and would still count towards the content hash GZAC pins).
   *
   * A refused (conflicting) install briefly creates and removes a staging directory. That is what
   * makes `uploadedContentHash` the hash of the package *as it would be stored*, rather than of the
   * extraction directory — which can differ, e.g. an undeclared logo or a `frontend/` directory with
   * no declared bundle.
   */
  async installPackage(input: InstallPackageInput): Promise<InstallOutcome> {
    const { pluginId, version } = input;
    return this.runInstallExclusive(this.key(pluginId, version), async () => {
      const versionDir = this.resolveVersionDir(pluginId, version);
      const parentDir = dirname(versionDir);
      await mkdir(parentDir, { recursive: true });

      // A sibling of the version directory, so the final rename stays on one filesystem.
      const staging = await mkdtemp(join(parentDir, ".staging-"));
      let staged = true;
      try {
        await writeFile(join(staging, "manifest.json"), input.manifestJson);
        await writeFile(join(staging, "plugin.wasm"), input.wasmBuffer);

        if (input.frontendDir && existsSync(input.frontendDir)) {
          await cp(input.frontendDir, join(staging, "frontend"), { recursive: true });
          this.logger.info({ pluginId, version }, "Frontend assets staged");
        }

        if (input.logoSourcePath && existsSync(input.logoSourcePath)) {
          // `basename` rather than splitting on "/", so a Windows-style separator cannot survive
          // into the destination name.
          const logoFilename = basename(input.logoSourcePath);
          if (!isValidPluginLogo(logoFilename)) {
            throw new InvalidPluginPackageError(
              `Illegal logo file name: ${logoFilename}`
            );
          }
          await cp(input.logoSourcePath, join(staging, logoFilename));
          this.logger.info({ pluginId, version, logo: logoFilename }, "Logo staged");
        }

        const uploadedContentHash = await computeContentHash(staging);

        if (this.hasVersion(pluginId, version) && !input.overwrite) {
          return {
            outcome: "conflict" as const,
            currentContentHash: this.getContentHash(pluginId, version),
            uploadedContentHash,
          };
        }

        const replacing = existsSync(versionDir);
        if (replacing) {
          this.logger.warn(
            { pluginId, version },
            "Overwriting existing plugin version (admin-confirmed)"
          );
          // Drop the running instances before their files are replaced, so no call is executing
          // against a package that is about to disappear.
          await this.unloadPlugin(pluginId, version);
        }

        // Two renames rather than `rm -rf` + rename: the previous package stays recoverable if the
        // second rename fails, and renaming onto an existing directory fails on Windows anyway.
        // Dot-prefixed like the staging directory, so a crash between the renames leaves behind a
        // name the identity rules reject — invisible to `loadAllFromDisk` rather than a half-loaded
        // extra version.
        const trash = join(parentDir, `.trash-${version}-${randomUUID()}`);
        if (replacing) await rename(versionDir, trash);
        try {
          await rename(staging, versionDir);
          staged = false;
        } catch (err) {
          if (replacing) await rename(trash, versionDir).catch(() => {});
          throw err;
        }

        try {
          await this.loadPlugin(pluginId, version);
        } catch (err) {
          // A package that cannot be loaded must not replace one that works: undo the swap and
          // bring the previous package back, rather than leaving the version broken on disk.
          await rm(versionDir, { recursive: true, force: true }).catch(() => {});
          if (replacing) {
            await rename(trash, versionDir).catch(() => {});
            await this.loadPlugin(pluginId, version).catch(() => {});
          }
          throw err;
        } finally {
          await rm(trash, { recursive: true, force: true }).catch(() => {});
        }

        const contentHash = this.getContentHash(pluginId, version)!;
        if (contentHash !== uploadedContentHash) {
          // The stored package is byte-for-byte what was staged, so these must agree; a divergence
          // means something else wrote into the version directory and is worth surfacing.
          this.logger.warn(
            { pluginId, version, uploadedContentHash, contentHash },
            "Stored package hash differs from the staged package hash"
          );
        }

        return {
          outcome: "installed" as const,
          manifest: this.getManifest(pluginId, version)!,
          contentHash,
        };
      } finally {
        if (staged) await rm(staging, { recursive: true, force: true }).catch(() => {});
      }
    });
  }

  /**
   * Get the storage directory path for a plugin version.
   */
  getPluginDir(pluginId: string, version: string): string {
    return this.resolveVersionDir(pluginId, version);
  }

  /**
   * Remove a plugin version from disk and memory. Waits for an in-flight call to finish (via
   * {@link unloadPlugin}'s pool drain) before the instances are closed and the files are deleted.
   */
  async removePlugin(pluginId: string, version: string): Promise<void> {
    const versionDir = this.resolveVersionDir(pluginId, version);

    await this.unloadPlugin(pluginId, version);

    if (existsSync(versionDir)) {
      await rm(versionDir, { recursive: true });
    }

    // Clean up empty parent directory
    const parentDir = dirname(versionDir);
    if (existsSync(parentDir)) {
      const remaining = await readdir(parentDir);
      if (remaining.length === 0) {
        await rm(parentDir, { recursive: true });
      }
    }
  }

  /**
   * Creates one Extism instance for a loaded plugin — the pool's factory.
   *
   * Plugin uses WASI for stdio (console.log from QuickJS goes to stdout).
   *
   * `runInWorker: true` is required so that async host functions (e.g. `gzac_api`, which fetches
   * from GZAC) can suspend the Wasm call until the JS promise resolves. Without this, async host
   * functions only work on Node 23+ via JSPI. It is also what makes `timeoutMs` enforceable —
   * Extism cancels a call that exceeds it by terminating and restarting the worker.
   *
   * The module is passed as bytes rather than a path: those bytes carry the memory cap written into
   * the module's own memory declaration, which is the only bound the engine enforces on guest
   * memory growth.
   */
  private async createExtismInstance(moduleBytes: Uint8Array): Promise<ExtismPlugin> {
    return createPlugin(
      { wasm: [{ data: moduleBytes }] },
      {
        useWasi: true,
        enableWasiOutput: true,
        runInWorker: true,
        // Execution limits: a plugin stuck in an infinite loop is cancelled after wasmTimeoutMs
        // (surfacing as a HOST_ERROR to the caller). `memory.maxPages` bounds the host-side blocks
        // Extism allocates to pass input and output across the sandbox boundary; the guest heap is
        // bounded by the patched module declaration in `moduleBytes` (0 = uncapped).
        timeoutMs: this.wasmTimeoutMs,
        ...(this.wasmMaxMemoryPages > 0
          ? { memory: { maxPages: this.wasmMaxMemoryPages } }
          : {}),
        functions: {
          "extism:host/user": {
            gzac_api: createGzacApiHostFunction(this.logger, {
              timeoutMs: this.gzacApiTimeoutMs,
            }),
            kv: createKvHostFunction(this.logger, this.kvRepository),
            log: createLogHostFunction(this.logger, this.logRepository),
            http_request: createHttpRequestHostFunction(
              this.logger,
              this.logRepository,
              this.allowHttp,
              this.allowPrivateNetwork,
              this.allowedInternalCidrs
            ),
          },
        },
      }
    );
  }

  /** Closes pooled instances that haven't served a call for {@link instanceIdleTtlMs}. */
  private evictIdleInstances(): void {
    for (const loaded of this.plugins.values()) {
      void loaded.pool.evictIdle(this.instanceIdleTtlMs).catch(() => {
        // Eviction is best-effort housekeeping; a close failure must not surface here.
      });
    }
  }

  /** Stops the idle-eviction sweep and closes every pooled instance. Call on shutdown. */
  async close(): Promise<void> {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = null;
    }
    await Promise.all(Array.from(this.plugins.values()).map((loaded) => loaded.pool.drain()));
  }

  /**
   * Resolves the grants (capabilities, the gzac_api endpoint allowlist, and the http_request egress
   * allowlist) the admin gave a configuration. Read per call so a re-push takes effect immediately.
   */
  private async resolveGrants(
    configurationId: string | undefined
  ): Promise<
    Pick<GzacApiCallContext, "grantedCapabilities" | "grantedEndpoints" | "allowedEgress">
  > {
    if (!configurationId) {
      return { grantedCapabilities: [], allowedEgress: [] };
    }
    const config = await this.configProvider.get(configurationId);
    return {
      grantedCapabilities: config?.grantedCapabilities ?? [],
      grantedEndpoints: config?.grantedEndpoints,
      // Deny-by-default: an unresolvable configuration grants no destinations.
      allowedEgress: config?.allowedEgress ?? [],
    };
  }

  /**
   * Invokes one exported plugin function on a pooled Extism instance and parses its JSON reply. All
   * four exports (`handle_action` / `handle_event` / `handle_request` / `handle_submit`) funnel
   * through here; the public wrappers only shape their input/host-context.
   *
   * A call cancelled by the Wasm timeout is rethrown with a clear message — the routes map any
   * thrown error to a 5xx `HOST_ERROR` result. Any failing call discards its instance rather than
   * returning it to the pool: a trapped or cancelled instance is in an undefined state, and with
   * the memory cap enforced at the module boundary a trap is an expected failure mode.
   */
  private async callExport<T extends { status?: unknown }>(
    pluginId: string,
    version: string,
    exportName: string,
    wasmInput: string,
    hostCtx: GzacApiCallContext,
    logContext: Record<string, unknown>
  ): Promise<T> {
    const k = this.key(pluginId, version);
    const loaded = this.plugins.get(k);

    if (!loaded) {
      throw new Error(`Plugin not found: ${pluginId}@${version}`);
    }

    this.logger.debug({ pluginId, version, ...logContext }, `Calling ${exportName}`);

    const lease = await loaded.pool.acquire();
    let succeeded = false;
    let output: T;
    try {
      const result = await lease.instance.call(exportName, wasmInput, hostCtx);
      if (!result) {
        throw new Error(`${exportName} returned null for ${pluginId}@${version}`);
      }
      output = JSON.parse(result.text()) as T;
      succeeded = true;
    } catch (err) {
      if (isWasmTimeoutError(err)) {
        throw new Error(
          `Plugin execution timed out after ${this.wasmTimeoutMs}ms (${pluginId}@${version} ${exportName})`
        );
      }
      throw err;
    } finally {
      if (succeeded) lease.release();
      else lease.discard();
    }

    this.logger.debug(
      { pluginId, version, ...logContext, status: output.status },
      `${exportName} completed`
    );

    return output;
  }

  /**
   * Call the handle_action exported function on a plugin.
   *
   * `serviceToken` and `gzacBaseUrl` are passed via Extism's per-call host context — they are
   * never serialized into the Wasm input. Host functions (e.g. `gzac_api`) read them via
   * `callContext.hostContext()`.
   */
  async callAction(
    pluginId: string,
    version: string,
    actionKey: string,
    input: {
      configurationId: string;
      configuration: Record<string, unknown>;
      processInstanceId: string;
      documentId: string;
      activityId: string;
      properties: Record<string, unknown>;
      serviceToken: string;
      gzacBaseUrl: string;
    }
  ): Promise<{
    status: string;
    variables?: Record<string, unknown>;
    result?: unknown;
    errorCode?: string;
    errorMessage?: string;
  }> {
    const { serviceToken, gzacBaseUrl, ...wasmFields } = input;
    const wasmInput = JSON.stringify({
      actionKey,
      ...wasmFields,
    });

    const hostCtx: GzacApiCallContext = {
      configurationId: input.configurationId,
      pluginId,
      pluginVersion: version,
      serviceToken,
      gzacBaseUrl,
      ...(await this.resolveGrants(input.configurationId)),
    };

    return this.callExport(pluginId, version, "handle_action", wasmInput, hostCtx, { actionKey });
  }

  /**
   * Call the handle_event exported function on a plugin.
   *
   * Like {@link callAction}, `serviceToken` and `gzacBaseUrl` are passed via Extism's per-call
   * host context so the event handler can call back into GZAC via `gzac_api`; they are never
   * serialized into the Wasm input.
   */
  async callEvent(
    pluginId: string,
    version: string,
    input: {
      configurationId: string;
      configuration: Record<string, unknown>;
      event: Record<string, unknown>;
      serviceToken: string;
      gzacBaseUrl: string;
    }
  ): Promise<{ status: string; errorCode?: string; errorMessage?: string }> {
    // The Wasm input is the EventInput shape: the event envelope/payload plus the configuration.
    const wasmInput = JSON.stringify({
      ...input.event,
      configuration: input.configuration,
    });

    const hostCtx: GzacApiCallContext = {
      configurationId: input.configurationId,
      pluginId,
      pluginVersion: version,
      serviceToken: input.serviceToken,
      gzacBaseUrl: input.gzacBaseUrl,
      ...(await this.resolveGrants(input.configurationId)),
    };

    const eventType = (input.event as { type?: string }).type;
    return this.callExport(pluginId, version, "handle_event", wasmInput, hostCtx, { eventType });
  }

  /**
   * Call the handle_request exported function on a plugin — the RPC-style data route used by the
   * plugin's iframe (forwarded by the host's `/plugins/:id/:version/data` route).
   *
   * Like {@link callAction}, `serviceToken` and `gzacBaseUrl` (when present) are passed via Extism's
   * per-call host context so a request handler *could* call back into GZAC via `gzac_api`; they are
   * never serialized into the Wasm input.
   */
  async callRequest(
    pluginId: string,
    version: string,
    input: {
      configurationId?: string;
      configuration: Record<string, unknown>;
      method: string;
      path: string;
      query?: Record<string, string>;
      body?: unknown;
      context?: Record<string, unknown>;
      serviceToken?: string;
      gzacBaseUrl?: string;
      userToken?: string;
    }
  ): Promise<{ status: number; headers?: Record<string, string>; body?: unknown }> {
    // serviceToken / gzacBaseUrl / userToken are host-only — destructured out so they are never
    // serialized into the Wasm input the plugin sees. They reach GZAC only via the gzac_api host
    // function, which reads them from the per-call host context below.
    const { serviceToken, gzacBaseUrl, userToken, ...wasmFields } = input;
    const wasmInput = JSON.stringify({
      ...wasmFields,
      configuration: input.configuration,
    });

    const hostCtx: GzacApiCallContext = {
      configurationId: input.configurationId ?? "",
      pluginId,
      pluginVersion: version,
      serviceToken: serviceToken ?? "",
      gzacBaseUrl: gzacBaseUrl ?? "",
      userToken: userToken,
      ...(await this.resolveGrants(input.configurationId)),
    };

    return this.callExport(pluginId, version, "handle_request", wasmInput, hostCtx, {
      method: input.method,
      path: input.path,
    });
  }

  /**
   * Call the handle_submit exported function on a plugin — the task-form submit hook (Level 1)
   * GZAC invokes during submission. Like {@link callAction}, `serviceToken` and `gzacBaseUrl` are
   * passed via Extism's per-call host context so the hook *could* enrich via `gzac_api` (service
   * token only — no user token is forwarded on this server-to-server path); they are never
   * serialized into the Wasm input.
   */
  async callSubmit(
    pluginId: string,
    version: string,
    submitKey: string,
    input: {
      configurationId: string;
      configuration: Record<string, unknown>;
      taskId?: string;
      processInstanceId?: string;
      documentId?: string;
      submission: Record<string, unknown>;
      serviceToken: string;
      gzacBaseUrl: string;
    }
  ): Promise<{
    status: string;
    variables?: Record<string, unknown>;
    documentContent?: Record<string, unknown>;
    errorCode?: string;
    errorMessage?: string;
    fieldErrors?: Record<string, string>;
  }> {
    // Wasm input excludes serviceToken / gzacBaseUrl — they're host-only.
    const { serviceToken, gzacBaseUrl, ...wasmFields } = input;
    const wasmInput = JSON.stringify({
      submitKey,
      ...wasmFields,
    });

    const hostCtx: GzacApiCallContext = {
      configurationId: input.configurationId,
      pluginId,
      pluginVersion: version,
      serviceToken,
      gzacBaseUrl,
      ...(await this.resolveGrants(input.configurationId)),
    };

    return this.callExport(pluginId, version, "handle_submit", wasmInput, hostCtx, { submitKey });
  }

  /**
   * Get the manifest for a loaded plugin.
   */
  getManifest(pluginId: string, version: string): PluginManifest | null {
    const k = this.key(pluginId, version);
    return this.plugins.get(k)?.manifest ?? null;
  }

  /**
   * Get the package content hash for a loaded plugin.
   */
  getContentHash(pluginId: string, version: string): string | null {
    const k = this.key(pluginId, version);
    return this.plugins.get(k)?.contentHash ?? null;
  }

  /**
   * Whether this plugin version exists — loaded in memory or present on disk. Used by the install
   * path to make versions immutable: a version that ever existed cannot be silently replaced.
   *
   * An identity that could never have been stored answers `false` rather than throwing: this is a
   * query, and "no such version" is the truthful answer for a name the manager refuses to build a
   * path for.
   */
  hasVersion(pluginId: string, version: string): boolean {
    if (this.plugins.has(this.key(pluginId, version))) return true;
    let versionDir: string;
    try {
      versionDir = this.resolveVersionDir(pluginId, version);
    } catch {
      return false;
    }
    return existsSync(join(versionDir, "manifest.json"));
  }

  /**
   * List all loaded plugins.
   */
  listPlugins(): Array<{
    pluginId: string;
    version: string;
    contentHash: string;
    manifest: PluginManifest;
  }> {
    return Array.from(this.plugins.values()).map((p) => ({
      pluginId: p.pluginId,
      version: p.version,
      contentHash: p.contentHash,
      manifest: p.manifest,
    }));
  }

  /**
   * List all versions of a specific plugin.
   */
  listVersions(
    pluginId: string
  ): Array<{ version: string; contentHash: string; manifest: PluginManifest }> {
    return Array.from(this.plugins.values())
      .filter((p) => p.pluginId === pluginId)
      .map((p) => ({ version: p.version, contentHash: p.contentHash, manifest: p.manifest }));
  }

  /**
   * Scan storage directory and load all plugins found on disk.
   *
   * Directory names that do not satisfy the package identity rules are skipped: they can never have
   * been produced by an install, and skipping them is also what keeps an install's transient
   * `.staging-*` / `.trash-*` siblings invisible to boot.
   */
  async loadAllFromDisk(): Promise<void> {
    if (!existsSync(this.storageDir)) {
      await mkdir(this.storageDir, { recursive: true });
      return;
    }

    const pluginDirs = await readdir(this.storageDir);
    for (const pluginId of pluginDirs) {
      if (!isValidPluginId(pluginId)) {
        this.logger.warn({ pluginId }, "Skipping plugin directory with a non-conforming name");
        continue;
      }
      const pluginPath = join(this.storageDir, pluginId);
      try {
        const versionDirs = await readdir(pluginPath);
        for (const version of versionDirs) {
          if (!isValidPluginVersion(version)) {
            this.logger.warn(
              { pluginId, version },
              "Skipping plugin directory with a non-conforming name"
            );
            continue;
          }
          try {
            await this.loadPlugin(pluginId, version);
          } catch (err) {
            this.logger.warn(
              { pluginId, version, error: (err as Error).message },
              "Failed to load plugin from disk"
            );
          }
        }
      } catch {
        // Not a directory, skip
      }
    }
  }
}
