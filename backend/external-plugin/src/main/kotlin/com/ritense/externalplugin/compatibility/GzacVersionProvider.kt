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

package com.ritense.externalplugin.compatibility

/**
 * Resolves the version of the running GZAC instance, used to judge whether an external plugin's
 * declared `compatibility` range covers this deployment. A plugin's range targets the Valtimo
 * *platform*, so the resolved version is the Valtimo library version (not the wrapping
 * application's build version) — the same value the UI sidebar shows for the backend. Returns
 * `null` when the version cannot be determined (e.g. an unpackaged dev run with no jar manifest or
 * build metadata); callers treat an unknown version as "cannot judge" rather than raising a false
 * incompatibility warning.
 */
fun interface GzacVersionProvider {
    fun getCurrentVersion(): String?
}
