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

package com.ritense.externalplugin.service

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.endpoint.EndpointDescriptionProvider
import com.ritense.valtimo.contract.endpoint.EndpointDescriptor
import org.springframework.stereotype.Service

/**
 * Aggregates all [EndpointDescriptionProvider] beans and resolves human-readable descriptions
 * for API endpoint patterns. Used by the management UI when an admin grants endpoint permissions
 * to an external plugin.
 */
@Service
@SkipComponentScan
class EndpointDescriptionService(
    private val providers: List<EndpointDescriptionProvider>,
) {

    private val descriptorsByKey: Map<String, EndpointDescriptor> by lazy {
        providers
            .flatMap { it.getEndpointDescriptors() }
            .associateBy { "${it.method.uppercase()}:${it.pattern}" }
    }

    /**
     * Returns all known endpoint descriptors.
     */
    fun getAllDescriptors(): List<EndpointDescriptor> = descriptorsByKey.values.toList()

    /**
     * Resolves descriptions for the given endpoint keys in the requested locale.
     * Falls back to English, then to the raw key if no description is registered.
     */
    fun resolveDescriptions(
        endpoints: List<EndpointQuery>,
        locale: String = "en",
    ): List<EndpointDescription> = endpoints.map { query ->
        val method = query.method.uppercase()
        val descriptor = findDescriptor(method, query.pattern)
        val description = descriptor?.descriptions?.get(locale)
            ?: descriptor?.descriptions?.get("en")

        EndpointDescription(
            method = method,
            pattern = query.pattern,
            description = description,
        )
    }

    private fun findDescriptor(method: String, pattern: String): EndpointDescriptor? {
        // Try exact match first
        val exactKey = "$method:$pattern"
        descriptorsByKey[exactKey]?.let { return it }

        // If the queried pattern contains wildcards, match against registered patterns.
        // Plugin manifests use glob-style `*` while providers use Spring `{param}` placeholders.
        // Convert the query glob into a regex: `*` matches a single path segment (`[^/]+`),
        // `**` matches any number of segments (`.+`).
        if ("*" in pattern) {
            val regex = buildGlobRegex(pattern)
            return descriptorsByKey.entries
                .firstOrNull { (key, _) -> key.startsWith("$method:") && regex.matches(key.substringAfter(":")) }
                ?.value
        }

        // If the queried pattern contains {param} placeholders, also try matching registered
        // patterns that might use different placeholder names or `*`.
        if ("{" in pattern) {
            val regex = buildGlobRegex(pattern.replace(Regex("\\{[^}]+}"), "*"))
            return descriptorsByKey.entries
                .firstOrNull { (key, _) -> key.startsWith("$method:") && regex.matches(key.substringAfter(":")) }
                ?.value
        }

        return null
    }

    private fun buildGlobRegex(glob: String): Regex {
        val regexStr = buildString {
            append("^")
            var i = 0
            while (i < glob.length) {
                when {
                    glob[i] == '*' && i + 1 < glob.length && glob[i + 1] == '*' -> {
                        append(".+")
                        i += 2
                    }
                    glob[i] == '*' -> {
                        append("[^/]+")
                        i++
                    }
                    glob[i] in "\\{}()[].\$^|+?" -> {
                        append("\\")
                        append(glob[i])
                        i++
                    }
                    else -> {
                        append(glob[i])
                        i++
                    }
                }
            }
            append("$")
        }
        return Regex(regexStr)
    }
}

data class EndpointQuery(
    val method: String,
    val pattern: String,
)

data class EndpointDescription(
    val method: String,
    val pattern: String,
    val description: String?,
)
