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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.document.opensearch.service

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class OpenSearchIndexNameResolverTest {

    private val resolver = OpenSearchIndexNameResolver()

    @Test
    fun `a clean lowercase key maps to a readable prefixed name without a hash`() {
        assertThat(resolver.indexNameFor("house")).isEqualTo("json_schema_document_house")
        assertThat(resolver.indexNameFor("my-case.v2")).isEqualTo("json_schema_document_my-case.v2")
    }

    @Test
    fun `uppercase is lowercased and a hash disambiguates it from a clashing lowercase key`() {
        val mixed = resolver.indexNameFor("MyCase")
        val lower = resolver.indexNameFor("mycase")

        assertThat(mixed).startsWith("json_schema_document_mycase_")
        assertThat(lower).isEqualTo("json_schema_document_mycase")
        assertThat(mixed).isNotEqualTo(lower)
    }

    @Test
    fun `illegal characters are replaced and the rewritten name gets a hash suffix`() {
        val name = resolver.indexNameFor("foo/bar baz")

        assertThat(name).startsWith("json_schema_document_foo_bar_baz_")
        // Every character is now a legal index-name character.
        assertThat(name.removePrefix("json_schema_document_")).matches("[a-z0-9_.-]+")
    }

    @Test
    fun `distinct keys that sanitize to the same base resolve to distinct names`() {
        assertThat(resolver.indexNameFor("foo!")).isNotEqualTo(resolver.indexNameFor("foo?"))
    }

    @Test
    fun `the resolver is deterministic`() {
        assertThat(resolver.indexNameFor("Aanvraag#1")).isEqualTo(resolver.indexNameFor("Aanvraag#1"))
    }

    @Test
    fun `a very long key is truncated to stay within the OpenSearch byte budget`() {
        val name = resolver.indexNameFor("x".repeat(400))

        assertThat(name.toByteArray(Charsets.UTF_8).size).isLessThanOrEqualTo(255)
        assertThat(name).startsWith("json_schema_document_")
    }

    @Test
    fun `the read alias is the shared all-cases alias`() {
        assertThat(OpenSearchIndexNameResolver.READ_ALIAS).isEqualTo("json_schema_document_all")
    }
}
