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

package com.ritense.exporter.manifest

/**
 * Resolves the Valtimo version to record in the export manifest.
 */
fun interface ValtimoVersionResolver {
    fun getValtimoVersion(): String
}

/**
 * Default resolver that reads the `Implementation-Version` from the JAR manifest of the exporter
 * module (set to the Valtimo project version at build time). Returns an empty string when running
 * outside a packaged JAR (e.g. during tests). Applications may register their own bean to supply a
 * more precise version.
 */
class DefaultValtimoVersionResolver : ValtimoVersionResolver {
    override fun getValtimoVersion(): String =
        javaClass.`package`?.implementationVersion ?: ""
}
