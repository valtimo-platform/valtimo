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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.externalplugin.domain.ExternalPluginManifestContracts.DeclaredContract
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class ExternalPluginManifestContractsTest {

    private val objectMapper = ObjectMapper()
    private val openplan = "nl.ritense.openplan@1"
    private val generate = "nl.ritense.document.generate@1"

    @Test
    fun `consumer declarations come as a name or as a name with operations`() {
        val manifest = manifest(
            """
            {"permissions": {"contracts": [
                "$openplan",
                {"contract": "$generate", "operations": ["generate", "archive", "generate"]}
            ]}}
            """
        )

        assertThat(ExternalPluginManifestContracts.declaredContractEntries(manifest)).containsExactly(
            DeclaredContract(openplan, null),
            DeclaredContract(generate, listOf("generate", "archive")),
        )
        assertThat(ExternalPluginManifestContracts.declaredContracts(manifest)).containsExactly(openplan, generate)
        assertThat(ExternalPluginManifestContracts.declaredOperations(manifest, openplan)).isNull()
        assertThat(ExternalPluginManifestContracts.declaredOperations(manifest, generate)).containsExactly("generate", "archive")
        assertThat(ExternalPluginManifestContracts.declaredOperations(manifest, "nl.ritense.other@1")).isNull()
    }

    @Test
    fun `unusable entries are skipped and the first declaration of a contract wins`() {
        val manifest = manifest(
            """
            {"permissions": {"contracts": [
                "",
                7,
                {"operations": ["x"]},
                {"contract": "$generate", "operations": ["generate"]},
                "$generate"
            ]}}
            """
        )

        assertThat(ExternalPluginManifestContracts.declaredContractEntries(manifest))
            .containsExactly(DeclaredContract(generate, listOf("generate")))
    }

    @Test
    fun `a manifest without contract keys declares and provides nothing`() {
        val manifest = manifest("""{"permissions": {"capabilities": ["log"]}}""")

        assertThat(ExternalPluginManifestContracts.declaredContractEntries(manifest)).isEmpty()
        assertThat(ExternalPluginManifestContracts.providedContracts(manifest)).isEmpty()
        assertThat(ExternalPluginManifestContracts.declaredContractEntries(null)).isEmpty()
    }

    @Test
    fun `provided operations carry their input and output schemas`() {
        val manifest = manifest(
            """
            {"provides": [{"contract": "$openplan", "title": "Open Plan", "operations": [
                {"key": "search", "input": {"type": "object"}, "output": {"type": "array"}},
                {"key": "list", "input": null}
            ]}]}
            """
        )

        val search = ExternalPluginManifestContracts.findOperation(manifest, openplan, "search")!!
        val list = ExternalPluginManifestContracts.findOperation(manifest, openplan, "list")!!
        assertThat(search.input).isEqualTo(objectMapper.readTree("""{"type": "object"}"""))
        assertThat(search.output).isEqualTo(objectMapper.readTree("""{"type": "array"}"""))
        assertThat(list.input).isNull()
        assertThat(list.output).isNull()
    }

    @Test
    fun `missing operations are the declared ones the provider does not offer`() {
        val provider = manifest(
            """{"provides": [{"contract": "$openplan", "operations": [{"key": "list"}, {"key": "get"}]}]}"""
        )

        assertThat(ExternalPluginManifestContracts.missingOperations(provider, openplan, listOf("get", "search", "delete")))
            .containsExactly("search", "delete")
        assertThat(ExternalPluginManifestContracts.missingOperations(provider, openplan, null)).isEmpty()
        assertThat(ExternalPluginManifestContracts.missingOperations(provider, generate, listOf("generate")))
            .containsExactly("generate")
    }

    @Test
    fun `contract translations are limited to the contract's own keys`() {
        val manifest = manifest(
            """
            {"translations": {
                "en": {"name": "Open Plan", "contracts.$openplan.title": "Plans", "contracts.$openplan.operations.list.title": "List"},
                "nl": {"name": "Open Plan", "contracts.$openplan.title": "Plannen", "contracts.$generate.title": "Genereren"},
                "de": {"name": "Open Plan"},
                "fr": "broken"
            }}
            """
        )

        assertThat(ExternalPluginManifestContracts.contractTranslations(manifest, openplan)).isEqualTo(
            mapOf(
                "en" to mapOf(
                    "contracts.$openplan.title" to "Plans",
                    "contracts.$openplan.operations.list.title" to "List",
                ),
                "nl" to mapOf("contracts.$openplan.title" to "Plannen"),
            )
        )
        assertThat(ExternalPluginManifestContracts.contractTranslations(null, openplan)).isEmpty()
    }

    private fun manifest(json: String) = objectMapper.readTree(json.trimIndent())
}
