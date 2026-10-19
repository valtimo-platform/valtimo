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

    open fun indexNameFor(definitionKey: String): String = INDEX_PREFIX + sanitize(definitionKey)

    private fun sanitize(key: String): String {
        val lowered = key.lowercase()
        val cleaned = lowered.replace(ILLEGAL_CHARS, "_").trimStart('-', '_', '+')
        val needsHash = cleaned != key || cleaned.isEmpty() || cleaned.length > MAX_KEY_LENGTH
        if (!needsHash) {
            return cleaned
        }
        val hash = shortHash(key)
        val base = cleaned.take(MAX_KEY_LENGTH)
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

        private const val INDEX_PREFIX = "json_schema_document_"

        // OpenSearch index names are capped at 255 bytes; reserve room for the prefix and a hash suffix.
        private const val HASH_BYTES = 4
        private const val MAX_KEY_LENGTH = 255 - INDEX_PREFIX.length - (HASH_BYTES * 2) - 1

        private val ILLEGAL_CHARS = Regex("[^a-z0-9_.-]")
    }
}
