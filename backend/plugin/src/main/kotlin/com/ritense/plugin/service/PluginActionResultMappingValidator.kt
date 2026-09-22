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

package com.ritense.plugin.service

import com.ritense.plugin.domain.PluginActionResultMapping
import com.ritense.valueresolver.exception.ValueResolverValidationException

/**
 * Save-time guard shared by the embedded ([com.ritense.plugin.domain.PluginProcessLink]) and
 * external process-link mappers. Only `doc:`, `pv:` and `case:` targets support writes today
 * (mirrors `ValueResolverService.handleValues`'s actual capabilities — `zaak:` and friends are
 * read-only resolvers); anything else is rejected before it reaches the database so authors get
 * immediate feedback instead of a silent no-op at process-run time.
 */
object PluginActionResultMappingValidator {

    private val WRITABLE_PREFIXES = setOf("doc", "pv", "case")

    fun validate(mappings: List<PluginActionResultMapping>) {
        mappings.forEach { mapping ->
            val prefix = mapping.target.substringBefore(":", missingDelimiterValue = "")
            if (prefix !in WRITABLE_PREFIXES) {
                throw ValueResolverValidationException(
                    "Action result mapping target '${mapping.target}' is not writable — only " +
                        "${WRITABLE_PREFIXES.joinToString { "'$it:'" }} targets are supported."
                )
            }
        }
    }
}
