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
import type {HostLogger, PluginManifest} from "./models/index.js";
import {createGzacApiHostFunction, GzacApiCallContext,} from "./host-functions/gzac-api.js";

interface LoadedPlugin {
  pluginId: string;
  version: string;
  manifest: PluginManifest;
  wasmPath: string;
  extismPlugin: ExtismPlugin | null;
  /**
   * Serializes access to {@link extismPlugin}. Extism instances are not reentrant — a second
   * `plugin.call` (or a concurrent instance creation) while one is in flight throws "plugin is not
   * reentrant". Calls chain through this promise so only one runs at a time per loaded plugin.
   */
  lock: Promise<unknown>;
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

  constructor(storageDir: string, logger: HostLogger) {
    this.storageDir = storageDir;
    this.logger = logger.child({ component: "PluginManager" });
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
      wasmPath,
      extismPlugin: null,
      lock: Promise.resolve(),
    });

    this.logger.info({ pluginId, version }, "Plugin loaded");
  }

  /**
   * Unload a plugin version, freeing its Wasm instance.
   */
  async unloadPlugin(pluginId: string, version: string): Promise<void> {
    const k = this.key(pluginId, version);
    const loaded = this.plugins.get(k);
    if (!loaded) return;

    if (loaded.extismPlugin) {
      try {
        await loaded.extismPlugin.close();
      } catch {
        // Ignore close errors
      }
    }

    this.plugins.delete(k);
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
   * Remove a plugin version from disk and memory.
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
   * functions only work on Node 23+ via JSPI.
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
      functions: {
        "extism:host/user": {
          gzac_api: createGzacApiHostFunction(this.logger),
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
    errorCode?: string;
    errorMessage?: string;
  }> {
    const k = this.key(pluginId, version);
    const loaded = this.plugins.get(k);

    if (!loaded) {
      throw new Error(`Plugin not found: ${pluginId}@${version}`);
    }

    // Wasm input excludes serviceToken / gzacBaseUrl — they're host-only.
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
    };

    this.logger.debug(
      { pluginId, version, actionKey },
      "Calling handle_action"
    );

    const output = await this.runExclusive(loaded, async () => {
      const plugin = await this.getOrCreateExtismPlugin(loaded);
      const result = await plugin.call("handle_action", wasmInput, hostCtx);
      if (!result) {
        throw new Error(`handle_action returned null for ${pluginId}@${version}`);
      }
      return JSON.parse(result.text());
    });

    this.logger.debug(
      { pluginId, version, actionKey, status: output.status },
      "handle_action completed"
    );

    return output;
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
    const k = this.key(pluginId, version);
    const loaded = this.plugins.get(k);

    if (!loaded) {
      throw new Error(`Plugin not found: ${pluginId}@${version}`);
    }

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
    };

    const eventType = (input.event as { type?: string }).type;
    this.logger.debug({ pluginId, version, eventType }, "Calling handle_event");

    const output = await this.runExclusive(loaded, async () => {
      const plugin = await this.getOrCreateExtismPlugin(loaded);
      const result = await plugin.call("handle_event", wasmInput, hostCtx);
      if (!result) {
        throw new Error(`handle_event returned null for ${pluginId}@${version}`);
      }
      return JSON.parse(result.text());
    });

    this.logger.debug(
      { pluginId, version, eventType, status: output.status },
      "handle_event completed"
    );

    return output;
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
    const k = this.key(pluginId, version);
    const loaded = this.plugins.get(k);

    if (!loaded) {
      throw new Error(`Plugin not found: ${pluginId}@${version}`);
    }

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
    };

    this.logger.debug(
      { pluginId, version, method: input.method, path: input.path },
      "Calling handle_request"
    );

    const output = await this.runExclusive(loaded, async () => {
      const plugin = await this.getOrCreateExtismPlugin(loaded);
      const result = await plugin.call("handle_request", wasmInput, hostCtx);
      if (!result) {
        throw new Error(`handle_request returned null for ${pluginId}@${version}`);
      }
      return JSON.parse(result.text());
    });

    this.logger.debug(
      { pluginId, version, path: input.path, status: output.status },
      "handle_request completed"
    );

    return output;
  }

  /**
   * Get the manifest for a loaded plugin.
   */
  getManifest(pluginId: string, version: string): PluginManifest | null {
    const k = this.key(pluginId, version);
    return this.plugins.get(k)?.manifest ?? null;
  }

  /**
   * List all loaded plugins.
   */
  listPlugins(): Array<{
    pluginId: string;
    version: string;
    manifest: PluginManifest;
  }> {
    return Array.from(this.plugins.values()).map((p) => ({
      pluginId: p.pluginId,
      version: p.version,
      manifest: p.manifest,
    }));
  }

  /**
   * List all versions of a specific plugin.
   */
  listVersions(
    pluginId: string
  ): Array<{ version: string; manifest: PluginManifest }> {
    return Array.from(this.plugins.values())
      .filter((p) => p.pluginId === pluginId)
      .map((p) => ({ version: p.version, manifest: p.manifest }));
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
