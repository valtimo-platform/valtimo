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

/*
 * ============================================================================
 * NF-INTERNAL — REVISIT ON NATIVE FEDERATION UPGRADE (v3 -> v4)
 * ============================================================================
 * This module is the single boundary that reaches into Native Federation's
 * *undocumented* runtime internals. It is intentionally isolated here so a
 * future NF/Angular upgrade is "fix this one file", not "hunt across the app".
 *
 * On NF v4 this shim is expected to become UNNECESSARY: v4 ships a supported
 * `versionMapping: true` feature (enabled by default) that performs exactly the
 * host<->remote version dedupe done manually below. When upgrading, prefer
 * enabling `versionMapping` in the federation config and deleting this module
 * over porting it to the v4 runtime shape.
 * ============================================================================
 */

/** The Native Federation `remoteEntry.json` produced by a plugin's build. */
interface RemoteEntry {
  name?: string;
  exposes?: Array<{key: string; outFileName: string}>;
  shared?: Array<{packageName: string; outFileName: string; version: string}>;
}

/** Native Federation's global runtime cache (see @softarc/native-federation-runtime). */
interface NativeFederationGlobal {
  externals?: Map<string, string>;
}

/**
 * Bridge the version-key gap between the host and a prebuilt remote. Native
 * Federation keys every shared dependency by `packageName@version`; the host
 * shares its workspace `@valtimo/*` libs as tsconfig path-mappings (no version)
 * while the remote declares a real version (e.g. `@valtimo/plugin@13.34.0`). We
 * point each version the remote declares at the host's already-loaded chunk
 * URL so the remote dedupes onto the host's instances — otherwise it loads its
 * own copies and `PLUGINS_TOKEN` / tab-token identity breaks. Runs before
 * loadRemoteModule, which reads these entries when building the import-map scope.
 */
function aliasRemoteSharedToHost(entry: RemoteEntry): void {
  const nf = (globalThis as unknown as {__NATIVE_FEDERATION__?: NativeFederationGlobal})
    .__NATIVE_FEDERATION__;
  const externals = nf?.externals;
  if (!externals || !entry.shared?.length) return;

  const hostUrlByPackage = new Map<string, string>();
  for (const [key, url] of externals) {
    const at = key.lastIndexOf('@');
    const packageName = at > 0 ? key.slice(0, at) : key;
    if (!hostUrlByPackage.has(packageName)) {
      hostUrlByPackage.set(packageName, url);
    }
  }

  for (const shared of entry.shared) {
    const hostUrl = hostUrlByPackage.get(shared.packageName);
    if (hostUrl) {
      externals.set(`${shared.packageName}@${shared.version}`, hostUrl);
    }
  }
}

export {RemoteEntry, aliasRemoteSharedToHost};
