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
  '/assets/plugins/archief/remoteEntry.json',
  '/assets/plugins/open-vtb/remoteEntry.json',
  '/assets/plugins/cloud-event/remoteEntry.json',
  '/assets/plugins/externe-klanttaak/remoteEntry.json',
  '/assets/plugins/graph-mail/remoteEntry.json',
  '/assets/plugins/haal-centraal/remoteEntry.json',
  '/assets/plugins/haal-centraal-auth/remoteEntry.json',
  '/assets/plugins/hasura/remoteEntry.json',
  '/assets/plugins/kvk-handelsregister/remoteEntry.json',
  '/assets/plugins/lrk-import/remoteEntry.json',
  '/assets/plugins/mtls-sslcontext/remoteEntry.json',
  '/assets/plugins/notify-nl/remoteEntry.json',
  '/assets/plugins/open-product/remoteEntry.json',
  '/assets/plugins/openklant/remoteEntry.json',
  '/assets/plugins/publictask/remoteEntry.json',
  '/assets/plugins/samenwerkfunctionaliteit/remoteEntry.json',
  '/assets/plugins/slack/remoteEntry.json',
  '/assets/plugins/socrates/remoteEntry.json',
  '/assets/plugins/spotler/remoteEntry.json',
  '/assets/plugins/suwinet/remoteEntry.json',
  '/assets/plugins/suwinet-auth/remoteEntry.json',
  '/assets/plugins/token-authentication/remoteEntry.json',
  '/assets/plugins/valtimo-llm/remoteEntry.json',
  '/assets/plugins/valtimo-ocr/remoteEntry.json',
  '/assets/plugins/value-mapper/remoteEntry.json',
  '/assets/plugins/xential/remoteEntry.json',
];
