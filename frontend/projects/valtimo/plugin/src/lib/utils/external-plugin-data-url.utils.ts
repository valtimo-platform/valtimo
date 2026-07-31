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
 * Derives the plugin host data route (`{base}/data`) from a bundle URL
 * (`{base}/bundles/<bundle>.html`) — the route that backs `target: "plugin"` proxy requests.
 * Returns null when the URL does not follow the bundle layout. Shared by every external-plugin
 * hosting surface (case tab, task form, routed page).
 */
const derivePluginDataUrl = (bundleUrl: string | null): string | null => {
  if (!bundleUrl) return null;
  const idx = bundleUrl.indexOf('/bundles/');
  return idx >= 0 ? `${bundleUrl.substring(0, idx)}/data` : null;
};

export {derivePluginDataUrl};
