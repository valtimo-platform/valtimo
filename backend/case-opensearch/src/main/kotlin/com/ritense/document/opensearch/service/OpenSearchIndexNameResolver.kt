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

package com.ritense.document.opensearch.service

import java.security.MessageDigest

/**
 * Single owner of the case-definition-key → OpenSearch-index-name translation. Every writer, reader,
 * reconciler and reindexer resolves index names through this one helper so the per-definition topology
 * stays consistent across the whole module.
 *
 * Names are `json_schema_document_<sanitizedKey>`. The key is sanitized to OpenSearch's index-name rules
 * (lowercase, illegal characters replaced, leading `-`/`_`/`+` stripped, truncated to the byte budget). A
 * short deterministic hash suffix is appended only when sanitization actually had to change the key — so a
 * key that is already a valid lowercase name keeps a clean, operable index name, while any key that needed
 * rewriting (or two keys that would otherwise sanitize to the same name) resolve to distinct names.
 */
open class OpenSearchIndexNameResolver {

    /**
     * The per-definition **read** alias spanning every version of [definitionKey]. Single-definition readers and
     * the delete-resolution path target this; it points at the current concrete of each version of the key.
     */
    open fun indexNameFor(definitionKey: String): String = INDEX_PREFIX + sanitize(definitionKey)

    /**
     * The per-(definition, version-tag) **write** alias — `json_schema_document_<key>_v<versionTag>`. Every write
     * routes here so a field whose type changed across schema versions lands in that version's own index instead
     * of colliding in a shared one. Routing is on the case-definition version TAG (Semver), the only
     * per-document version the model carries (`definitionId.blueprintId.blueprintVersionTag`).
     */
    open fun writeAliasFor(definitionKey: String, versionTag: String): String =
        indexNameFor(definitionKey) + VERSION_INFIX + sanitizeVersion(versionTag)

    private fun sanitize(key: String): String {
        val lowered = key.lowercase()
        val cleaned = lowered.replace(ILLEGAL_CHARS, "_").trimStart('-', '_', '+')
        // Hash a key that would resolve to READ_ALIAS ("all"), or that looks like "<key>_v<tag>" and would equal
        // another definition's version write alias.
        val needsHash = cleaned != key || cleaned.isEmpty() || cleaned.length > MAX_KEY_LENGTH ||
            INDEX_PREFIX + cleaned == READ_ALIAS || VERSION_LIKE.containsMatchIn(cleaned)
        if (!needsHash) {
            return cleaned
        }
        return withHash(cleaned, key, MAX_KEY_LENGTH)
    }

    // Hashed whenever sanitizing changed the tag, so tags differing only in case or punctuation get their own index.
    private fun sanitizeVersion(versionTag: String): String {
        val cleaned = versionTag.lowercase().replace(ILLEGAL_CHARS, "_")
        if (cleaned == versionTag && cleaned.length <= MAX_VERSION_LENGTH) {
            return cleaned
        }
        return withHash(cleaned, versionTag, MAX_VERSION_LENGTH)
    }

    private fun withHash(cleaned: String, original: String, maxLength: Int): String {
        val hash = shortHash(original)
        val base = cleaned.take(maxLength - hash.length - 1)
        return if (base.isEmpty()) hash else "${base}_$hash"
    }

    private fun shortHash(value: String): String =
        MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray(Charsets.UTF_8))
            .take(HASH_BYTES)
            .joinToString("") { "%02x".format(it) }

    companion object {
        /** Shared read alias spanning every per-definition index — serves the "All cases" list. */
        const val READ_ALIAS = "json_schema_document_all"

        /**
         * The single shared index used before the per-definition topology. Pre-fix installations still hold
         * it; migration reindexes off it and then drops it. New installations never create it.
         */
        const val LEGACY_INDEX = "json_schema_document"

        private const val INDEX_PREFIX = "json_schema_document_"

        /** Separates the sanitized key from the version tag in a write alias / concrete name. */
        private const val VERSION_INFIX = "_v"
        private const val VERSION_INFIX_LENGTH = 2
        private val VERSION_LIKE = Regex("_v[0-9]")

        // OpenSearch index names are capped at 255 bytes. The resolved key value is a read alias; the write alias
        // adds "_v<versionTag>" and the concrete index behind it is "<writeAlias>_<suffix>". Reserve room for the
        // prefix, the version infix and tag, AND the longest concrete suffix the initializer appends — "_" + epoch
        // millis (<=14 digits) and, on a same-millisecond collision, "_" + a positive Int (<=10 digits) — so the
        // concrete name, not just the alias, fits.
        private const val HASH_BYTES = 4
        private const val MAX_VERSION_LENGTH = 40
        private const val MAX_CONCRETE_SUFFIX = VERSION_INFIX_LENGTH + MAX_VERSION_LENGTH + 1 + 14 + 1 + 10
        private const val MAX_KEY_LENGTH = 255 - INDEX_PREFIX.length - MAX_CONCRETE_SUFFIX

        private val ILLEGAL_CHARS = Regex("[^a-z0-9_.-]")
    }
}
