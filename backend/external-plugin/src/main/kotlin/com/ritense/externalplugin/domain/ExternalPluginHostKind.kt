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

package com.ritense.externalplugin.domain

/**
 * The kind of remote integration a row in `external_plugin_host` represents. Both kinds speak the
 * exact same HTTP contract to GZAC (discovery, HMAC-signed pushes/actions, iframe/data routes), so
 * everything downstream of registration is shared; the kind only drives the admin UX and a couple
 * of registration-time behaviours.
 *
 * - [PLUGIN_HOST]: a multi-plugin, multi-version host that plugins are uploaded to as `.wasm`
 *   packages (the Extism-based `plugin-host/app`). The default for new and pre-existing rows.
 * - [APP]: a remote service, added by URL, that *is* a plugin-host-plus-single-plugin — it serves
 *   its own single, natively-implemented plugin and accepts no uploads. GZAC discovers that plugin
 *   immediately on registration.
 */
enum class ExternalPluginHostKind { PLUGIN_HOST, APP }
