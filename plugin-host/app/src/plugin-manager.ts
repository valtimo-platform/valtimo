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
import {mkdir, readdir, readFile, rm, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {existsSync} from "node:fs";
import {createHash} from "node:crypto";
import type {HostLogger, PluginConfiguration, PluginManifest} from "./models/index.js";
import {createGzacApiHostFunction, type GzacApiCallContext} from "./host-functions/gzac-api.js";
import type {KvRepository} from "./db/kv-repository.js";
import type {LogRepository} from "./db/log-repository.js";
import {createKvHostFunction} from "./host-functions/kv.js";
import {createLogHostFunction} from "./host-functions/log.js";
import {createHttpRequestHostFunction} from "./host-functions/http-request.js";

interface LoadedPlugin {
  pluginId: string;
  version: string;
  manifest: PluginManifest;
  /** Package content hash (see {@link computeContentHash}) — GZAC pins this at discovery. */
  contentHash: string;
  wasmPath: string;
  extismPlugin: ExtismPlugin | null;
  /**
   * Serializes access to {@link extismPlugin}. Extism instances are not reentrant — a second
   * `plugin.call` (or a concurrent instance creation) while one is in flight throws "plugin is not
   * reentrant". Calls chain through this promise so only one runs at a time per loaded plugin.
   * Unload/remove and idle eviction chain through the same promise, so an instance is never closed
   * mid-execution.
   */
  lock: Promise<unknown>;
  /** When the instance last finished a call — drives idle eviction. */
  lastUsedAt: number;
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
  /** Hard wall-clock limit per Wasm call; Extism cancels the call when exceeded. */
  wasmTimeoutMs?: number;
  /** Cap on the module's linear memory in 64 KiB pages; 0 disables the cap. */
  wasmMaxMemoryPages?: number;
  /** Timeout for the `gzac_api` callback fetch. */
  gzacApiTimeoutMs?: number;
  /** Idle Extism instances are closed after this long without a call; 0 disables eviction. */
  instanceIdleTtlMs?: number;
}

const DEFAULT_WASM_TIMEOUT_MS = 30_000;
const DEFAULT_WASM_MAX_MEMORY_PAGES = 4096; // 64 KiB/page → 256 MiB
const DEFAULT_GZAC_API_TIMEOUT_MS = 60_000;
const DEFAULT_INSTANCE_IDLE_TTL_MS = 10 * 60 * 1000;

/** Extism cancels a timed-out call with "EXTISM: call canceled due to timeout". */
function isWasmTimeoutError(err: unknown): boolean {
  return err instanceof Error && /canceled due to timeout/i.test(err.message);
}

/**
 * Computes the package content hash: SHA-256 over every file in the plugin version directory
 * (manifest.json, plugin.wasm, the logo, frontend/**), each record bound to its relative path and
 * byte length so files cannot be renamed or shuffled without changing the hash. GZAC pins this
 * value at discovery and flags the definition for re-acceptance when it changes — the on-disk
 * package is tamper-evident even though the host itself is only semi-trusted.
 */
async function computeContentHash(pluginDir: string): Promise<string> {
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
  private readonly wasmTimeoutMs: number;
  private readonly wasmMaxMemoryPages: number;
  private readonly gzacApiTimeoutMs: number;
  private readonly instanceIdleTtlMs: number;
  private evictionTimer: ReturnType<typeof setInterval> | null = null;

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
    this.wasmTimeoutMs = options.wasmTimeoutMs ?? DEFAULT_WASM_TIMEOUT_MS;
    this.wasmMaxMemoryPages = options.wasmMaxMemoryPages ?? DEFAULT_WASM_MAX_MEMORY_PAGES;
    this.gzacApiTimeoutMs = options.gzacApiTimeoutMs ?? DEFAULT_GZAC_API_TIMEOUT_MS;
    this.instanceIdleTtlMs = options.instanceIdleTtlMs ?? DEFAULT_INSTANCE_IDLE_TTL_MS;

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
   * Load a plugin from its storage directory.
   * Expects: {storageDir}/{pluginId}/{version}/manifest.json and plugin.wasm
   */
  async loadPlugin(pluginId: string, version: string): Promise<void> {
    const pluginDir = join(this.storageDir, pluginId, version);
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

    const k = this.key(pluginId, version);

    // If already loaded, unload first (hot-reload)
    if (this.plugins.has(k)) {
      this.logger.info({ pluginId, version }, "Hot-reloading plugin");
      await this.unloadPlugin(pluginId, version);
    }

    this.plugins.set(k, {
      pluginId,
      version,
      manifest,
      contentHash,
      wasmPath,
      extismPlugin: null,
      lock: Promise.resolve(),
      lastUsedAt: Date.now(),
    });

    this.logger.info({ pluginId, version, contentHash }, "Plugin loaded");
  }

  /**
   * Unload a plugin version, freeing its Wasm instance.
   *
   * The entry is removed from the map first (new calls fail fast with "Plugin not found"), then
   * the instance is closed through the same per-plugin lock every call runs on — so an in-flight
   * call finishes before its instance is closed rather than being killed mid-execution.
   */
  async unloadPlugin(pluginId: string, version: string): Promise<void> {
    const k = this.key(pluginId, version);
    const loaded = this.plugins.get(k);
    if (!loaded) return;

    this.plugins.delete(k);
    await this.runExclusive(loaded, async () => {
      if (loaded.extismPlugin) {
        try {
          await loaded.extismPlugin.close();
        } catch {
          // Ignore close errors
        }
        loaded.extismPlugin = null;
      }
    });

    this.logger.info({ pluginId, version }, "Plugin unloaded");
  }

  /**
   * Store a plugin package to disk and load it.
   * If frontendDir is provided, copies the frontend directory into the plugin storage.
   * If logoSourcePath is provided and exists, copies the file to the plugin storage so the host
   * can serve it at GET /plugins/:id/:version/logo.
   */
  async storeAndLoad(
    pluginId: string,
    version: string,
    manifestJson: string,
    wasmBuffer: Buffer,
    frontendDir?: string,
    logoSourcePath?: string
  ): Promise<PluginManifest> {
    const pluginDir = join(this.storageDir, pluginId, version);
    await mkdir(pluginDir, { recursive: true });

    await writeFile(join(pluginDir, "manifest.json"), manifestJson);
    await writeFile(join(pluginDir, "plugin.wasm"), wasmBuffer);

    if (frontendDir && existsSync(frontendDir)) {
      const { cp } = await import("node:fs/promises");
      const destFrontendDir = join(pluginDir, "frontend");
      await cp(frontendDir, destFrontendDir, { recursive: true });
      this.logger.info({ pluginId, version }, "Frontend assets stored");
    }

    if (logoSourcePath && existsSync(logoSourcePath)) {
      const { cp } = await import("node:fs/promises");
      const logoFilename = logoSourcePath.split("/").pop()!;
      await cp(logoSourcePath, join(pluginDir, logoFilename));
      this.logger.info({ pluginId, version, logo: logoFilename }, "Logo stored");
    }

    await this.loadPlugin(pluginId, version);
    return JSON.parse(manifestJson);
  }

  /**
   * Get the storage directory path for a plugin version.
   */
  getPluginDir(pluginId: string, version: string): string {
    return join(this.storageDir, pluginId, version);
  }

  /**
   * Remove a plugin version from disk and memory. Waits for an in-flight call to finish (via
   * {@link unloadPlugin}'s lock) before the instance is closed and the files are deleted.
   */
  async removePlugin(pluginId: string, version: string): Promise<void> {
    await this.unloadPlugin(pluginId, version);

    const pluginDir = join(this.storageDir, pluginId, version);
    if (existsSync(pluginDir)) {
      await rm(pluginDir, { recursive: true });
    }

    // Clean up empty parent directory
    const parentDir = join(this.storageDir, pluginId);
    if (existsSync(parentDir)) {
      const remaining = await readdir(parentDir);
      if (remaining.length === 0) {
        await rm(parentDir, { recursive: true });
      }
    }
  }

  /**
   * Get or create the Extism plugin instance for a loaded plugin.
   *
   * Plugin uses WASI for stdio (console.log from QuickJS goes to stdout).
   *
   * `runInWorker: true` is required so that async host functions (e.g. `gzac_api`, which fetches
   * from GZAC) can suspend the Wasm call until the JS promise resolves. Without this, async host
   * functions only work on Node 23+ via JSPI. It is also what makes `timeoutMs` enforceable —
   * Extism cancels a call that exceeds it by terminating and restarting the worker.
   */
  private async getOrCreateExtismPlugin(
    loaded: LoadedPlugin
  ): Promise<ExtismPlugin> {
    if (loaded.extismPlugin) {
      return loaded.extismPlugin;
    }

    const plugin = await createPlugin(loaded.wasmPath, {
      useWasi: true,
      enableWasiOutput: true,
      runInWorker: true,
      // Execution limits: a plugin stuck in an infinite loop is cancelled after wasmTimeoutMs
      // (surfacing as a HOST_ERROR to the caller), and its linear memory cannot grow beyond
      // wasmMaxMemoryPages (0 = uncapped).
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
            this.allowPrivateNetwork
          ),
        },
      },
    });

    loaded.extismPlugin = plugin;
    return plugin;
  }

  /**
   * Runs `fn` with exclusive access to the loaded plugin's Extism instance. Calls are chained
   * through {@link LoadedPlugin.lock} so only one is ever in flight — Extism instances are not
   * reentrant, and a burst of events would otherwise call the same cached instance concurrently
   * ("plugin is not reentrant"). The tail swallows the result/rejection so one failed call never
   * breaks the chain for the next.
   */
  private runExclusive<T>(loaded: LoadedPlugin, fn: () => Promise<T>): Promise<T> {
    const run = loaded.lock.then(fn, fn);
    loaded.lock = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  /** Closes cached instances that haven't served a call for {@link instanceIdleTtlMs}. */
  private evictIdleInstances(): void {
    const now = Date.now();
    for (const loaded of this.plugins.values()) {
      if (!loaded.extismPlugin || now - loaded.lastUsedAt < this.instanceIdleTtlMs) continue;
      // Through the lock, so an instance is never closed while a call is executing. Re-check
      // idleness inside: a call may have queued between the sweep and the lock being free.
      void this.runExclusive(loaded, async () => {
        if (!loaded.extismPlugin || Date.now() - loaded.lastUsedAt < this.instanceIdleTtlMs) {
          return;
        }
        try {
          await loaded.extismPlugin.close();
        } catch {
          // Ignore close errors
        }
        loaded.extismPlugin = null;
        this.logger.info(
          { pluginId: loaded.pluginId, version: loaded.version },
          "Evicted idle plugin instance"
        );
      });
    }
  }

  /** Stops the idle-eviction sweep and closes every cached instance. Call on shutdown. */
  async close(): Promise<void> {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = null;
    }
    await Promise.all(
      Array.from(this.plugins.values()).map((loaded) =>
        this.runExclusive(loaded, async () => {
          if (loaded.extismPlugin) {
            try {
              await loaded.extismPlugin.close();
            } catch {
              // Ignore close errors
            }
            loaded.extismPlugin = null;
          }
        })
      )
    );
  }

  /**
   * Resolves the grants (capabilities + gzac_api endpoint allowlist) the admin gave a
   * configuration. Read per call so a re-push takes effect immediately.
   */
  private async resolveGrants(
    configurationId: string | undefined
  ): Promise<Pick<GzacApiCallContext, "grantedCapabilities" | "grantedEndpoints">> {
    if (!configurationId) {
      return { grantedCapabilities: [] };
    }
    const config = await this.configProvider.get(configurationId);
    return {
      grantedCapabilities: config?.grantedCapabilities ?? [],
      grantedEndpoints: config?.grantedEndpoints,
    };
  }

  /**
   * Invokes one exported plugin function with exclusive access to the Extism instance and parses
   * its JSON reply. All four exports (`handle_action` / `handle_event` / `handle_request` /
   * `handle_submit`) funnel through here; the public wrappers only shape their input/host-context.
   *
   * A call cancelled by the Wasm timeout is rethrown with a clear message — the routes map any
   * thrown error to a 5xx `HOST_ERROR` result — and the cached instance is dropped so the next
   * call starts from a fresh one.
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

    const output = await this.runExclusive(loaded, async () => {
      const plugin = await this.getOrCreateExtismPlugin(loaded);
      try {
        const result = await plugin.call(exportName, wasmInput, hostCtx);
        if (!result) {
          throw new Error(`${exportName} returned null for ${pluginId}@${version}`);
        }
        return JSON.parse(result.text()) as T;
      } catch (err) {
        if (isWasmTimeoutError(err)) {
          loaded.extismPlugin = null;
          void plugin.close().catch(() => {});
          throw new Error(
            `Plugin execution timed out after ${this.wasmTimeoutMs}ms (${pluginId}@${version} ${exportName})`
          );
        }
        throw err;
      } finally {
        loaded.lastUsedAt = Date.now();
      }
    });

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
   * Whether this plugin version exists — loaded in memory or present on disk. Used by the upload
   * route to make versions immutable: a version that ever existed cannot be silently replaced.
   */
  hasVersion(pluginId: string, version: string): boolean {
    if (this.plugins.has(this.key(pluginId, version))) return true;
    return existsSync(join(this.storageDir, pluginId, version, "manifest.json"));
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
   */
  async loadAllFromDisk(): Promise<void> {
    if (!existsSync(this.storageDir)) {
      await mkdir(this.storageDir, { recursive: true });
      return;
    }

    const pluginDirs = await readdir(this.storageDir);
    for (const pluginId of pluginDirs) {
      const pluginPath = join(this.storageDir, pluginId);
      try {
        const versionDirs = await readdir(pluginPath);
        for (const version of versionDirs) {
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
