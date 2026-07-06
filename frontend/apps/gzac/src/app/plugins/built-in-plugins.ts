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
 * Plugins shipped with this app as Native Federation remotes, loaded at start
 * time (see StartupPluginLoaderService, wired via APP_INITIALIZER). Each entry
 * is the URL of the remote's `remoteEntry.json`, served as a static asset. A
 * plugin the deploying party does not include simply is not present, and its
 * entry can be omitted — the host build and startup are unaffected.
 */
export const BUILT_IN_PLUGINS: string[] = [
  '/assets/plugins/freemarker/remoteEntry.json',
  '/assets/plugins/smtpmail/remoteEntry.json',
];
