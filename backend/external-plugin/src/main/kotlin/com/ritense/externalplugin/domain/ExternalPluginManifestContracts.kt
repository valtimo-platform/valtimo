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

import com.fasterxml.jackson.databind.JsonNode
import java.time.Duration

/** Reads the contract keys of a manifest: `permissions.contracts` (consumer) and `provides` (provider). */
object ExternalPluginManifestContracts {

    const val MODE_SYNC = "sync"
    const val MODE_JOB = "job"

    data class Operation(
        val key: String,
        val title: String?,
        val description: String?,
        val mode: String,
        /** ISO-8601 duration as declared; only meaningful for [MODE_JOB]. */
        val timeout: String?,
        val outputs: List<String>,
        /** JSON Schema the request payload must satisfy. */
        val input: JsonNode? = null,
        /** JSON Schema a completed result must satisfy. */
        val output: JsonNode? = null,
    ) {
        val isJob: Boolean
            get() = mode == MODE_JOB

        /** Null when absent or unparseable — callers fall back to the platform default. */
        val timeoutDuration: Duration?
            get() = timeout?.let { runCatching { Duration.parse(it) }.getOrNull() }?.takeIf { !it.isNegative && !it.isZero }
    }

    data class ProvidedContract(
        val contract: String,
        val title: String?,
        val operations: List<Operation>,
    )

    /** One `permissions.contracts` entry. Null [operations] (the string form) means any operation the provider offers. */
    data class DeclaredContract(
        val contract: String,
        val operations: List<String>?,
    )

    /** First entry wins when a contract is declared twice. */
    fun declaredContractEntries(manifest: JsonNode?): List<DeclaredContract> {
        val declared = manifest?.get("permissions")?.get("contracts") ?: return emptyList()
        if (!declared.isArray) return emptyList()
        return declared.mapNotNull(::declaredContract).distinctBy { it.contract }
    }

    fun declaredContracts(manifest: JsonNode?): List<String> = declaredContractEntries(manifest).map { it.contract }

    /** The operations a consumer limits itself to for [contract]; null when it may call any. */
    fun declaredOperations(manifest: JsonNode?, contract: String): List<String>? =
        declaredContractEntries(manifest).firstOrNull { it.contract == contract }?.operations

    fun providedContracts(manifest: JsonNode?): List<ProvidedContract> {
        val provides = manifest?.get("provides") ?: return emptyList()
        if (!provides.isArray) return emptyList()
        return provides.mapNotNull { entry ->
            val contract = entry.get("contract")?.asText()?.trim()?.takeIf { it.isNotEmpty() } ?: return@mapNotNull null
            val operations = entry.get("operations")?.takeIf { it.isArray }?.mapNotNull(::operation).orEmpty()
            ProvidedContract(contract, entry.get("title")?.textOrNull(), operations)
        }
    }

    fun provides(manifest: JsonNode?, contract: String): Boolean =
        providedContracts(manifest).any { it.contract == contract }

    fun findOperation(manifest: JsonNode?, contract: String, operation: String): Operation? =
        providedContracts(manifest).firstOrNull { it.contract == contract }
            ?.operations?.firstOrNull { it.key == operation }

    /** [required] operations of [contract] that the provider manifest does not offer. */
    fun missingOperations(providerManifest: JsonNode?, contract: String, required: List<String>?): List<String> {
        if (required.isNullOrEmpty()) return emptyList()
        val offered = providedContracts(providerManifest).firstOrNull { it.contract == contract }
            ?.operations?.map { it.key }?.toSet().orEmpty()
        return required.filterNot { it in offered }
    }

    /** Language → key → text, limited to the `contracts.<contract>.` keys of the manifest's `translations`. */
    fun contractTranslations(manifest: JsonNode?, contract: String): Map<String, Map<String, String>> {
        val translations = manifest?.get("translations")?.takeIf { it.isObject } ?: return emptyMap()
        val prefix = "contracts.$contract."
        return translations.properties().mapNotNull { (language, bucket) ->
            if (!bucket.isObject) return@mapNotNull null
            val entries = bucket.properties()
                .filter { (key, value) -> key.startsWith(prefix) && value.isTextual }
                .associate { (key, value) -> key to value.asText() }
            if (entries.isEmpty()) null else language to entries
        }.toMap()
    }

    private fun declaredContract(node: JsonNode): DeclaredContract? = when {
        node.isTextual -> node.asText().trim().takeIf { it.isNotEmpty() }?.let { DeclaredContract(it, null) }
        node.isObject -> node.get("contract")?.textOrNull()?.trim()?.takeIf { it.isNotEmpty() }?.let { contract ->
            val operations = node.get("operations")?.takeIf { it.isArray }
                ?.mapNotNull { it.textOrNull()?.trim()?.takeIf(String::isNotEmpty) }?.distinct()
            DeclaredContract(contract, operations)
        }
        else -> null
    }

    private fun operation(node: JsonNode): Operation? {
        val key = node.get("key")?.asText()?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        val mode = node.get("mode")?.textOrNull()?.takeIf { it == MODE_JOB } ?: MODE_SYNC
        val outputs = node.get("outputs")?.takeIf { it.isArray }
            ?.mapNotNull { if (it.isTextual) it.asText() else null }.orEmpty()
        return Operation(
            key = key,
            title = node.get("title")?.textOrNull(),
            description = node.get("description")?.textOrNull(),
            mode = mode,
            timeout = node.get("timeout")?.textOrNull(),
            outputs = outputs,
            input = node.get("input")?.takeUnless { it.isNull },
            output = node.get("output")?.takeUnless { it.isNull },
        )
    }

    private fun JsonNode.textOrNull(): String? = if (isTextual) asText() else null
}
