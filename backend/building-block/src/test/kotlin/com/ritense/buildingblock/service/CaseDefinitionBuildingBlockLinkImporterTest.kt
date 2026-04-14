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

package com.ritense.buildingblock.service

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.ritense.buildingblock.domain.CaseDefinitionBuildingBlockLink
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.importer.ImportRequest
import com.ritense.importer.ValtimoImportTypes.Companion.BUILDING_BLOCK_DEFINITION
import com.ritense.importer.ValtimoImportTypes.Companion.CASE_BUILDING_BLOCK_LINK
import com.ritense.importer.ValtimoImportTypes.Companion.DOCUMENT_DEFINITION
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.times
import org.mockito.kotlin.verify

@ExtendWith(MockitoExtension::class)
class CaseDefinitionBuildingBlockLinkImporterTest(
    @Mock private val linkRepository: CaseDefinitionBuildingBlockLinkRepository,
) {

    private val objectMapper = jacksonObjectMapper()
    private lateinit var importer: CaseDefinitionBuildingBlockLinkImporter

    private val caseDefinitionId = CaseDefinitionId("my-case", "1.0.0")

    @BeforeEach
    fun setUp() {
        importer = CaseDefinitionBuildingBlockLinkImporter(objectMapper, linkRepository)
    }

    @Test
    fun `should have correct type`() {
        assertThat(importer.type()).isEqualTo(CASE_BUILDING_BLOCK_LINK)
    }

    @Test
    fun `should depend on document definition and building block definition`() {
        assertThat(importer.dependsOn()).containsExactlyInAnyOrder(DOCUMENT_DEFINITION, BUILDING_BLOCK_DEFINITION)
    }

    @Test
    fun `should be part of case definition`() {
        assertThat(importer.partOfCaseDefinition()).isTrue()
    }

    @Test
    fun `should not be part of building block definition`() {
        assertThat(importer.partOfBuildingBlockDefinition()).isFalse()
    }

    @Test
    fun `should support valid filename`() {
        assertThat(importer.supports("/building-block-link/my-case.case-building-block-links.json")).isTrue()
    }

    @Test
    fun `should not support invalid filename`() {
        assertThat(importer.supports("/building-block-link/test.json")).isFalse()
        assertThat(importer.supports("/other/my-case.case-building-block-links.json")).isFalse()
    }

    @Test
    fun `should delete existing links and save new ones on import`() {
        val json = """
            [
                {
                    "buildingBlockDefinitionKey": "income-check",
                    "buildingBlockDefinitionVersionTag": "1.0.0",
                    "inputMappings": [{"source": "doc:/income", "target": "/amount"}],
                    "outputMappings": [{"source": "/result", "target": "doc:/checkResult", "syncTiming": "END"}],
                    "pluginConfigurationMappings": {}
                }
            ]
        """.trimIndent()

        val request = ImportRequest(
            fileName = "/building-block-link/my-case.case-building-block-links.json",
            content = json.toByteArray(),
            caseDefinitionId = caseDefinitionId
        )

        importer.import(request)

        verify(linkRepository).deleteAllByCaseDefinitionId(caseDefinitionId)

        val captor = argumentCaptor<CaseDefinitionBuildingBlockLink>()
        verify(linkRepository).save(captor.capture())

        val saved = captor.firstValue
        assertThat(saved.caseDefinitionId).isEqualTo(caseDefinitionId)
        assertThat(saved.buildingBlockDefinitionId.key).isEqualTo("income-check")
        assertThat(saved.buildingBlockDefinitionId.versionTag.toString()).isEqualTo("1.0.0")
        assertThat(saved.inputMappings).hasSize(1)
        assertThat(saved.inputMappings[0].source).isEqualTo("doc:/income")
        assertThat(saved.inputMappings[0].target).isEqualTo("/amount")
        assertThat(saved.outputMappings).hasSize(1)
        assertThat(saved.outputMappings[0].source).isEqualTo("/result")
        assertThat(saved.outputMappings[0].target).isEqualTo("doc:/checkResult")
    }

    @Test
    fun `should import multiple links`() {
        val json = """
            [
                {
                    "buildingBlockDefinitionKey": "bb-one",
                    "buildingBlockDefinitionVersionTag": "1.0.0",
                    "inputMappings": [],
                    "outputMappings": [],
                    "pluginConfigurationMappings": {}
                },
                {
                    "buildingBlockDefinitionKey": "bb-two",
                    "buildingBlockDefinitionVersionTag": "2.0.0",
                    "inputMappings": [],
                    "outputMappings": [],
                    "pluginConfigurationMappings": {}
                }
            ]
        """.trimIndent()

        val request = ImportRequest(
            fileName = "/building-block-link/my-case.case-building-block-links.json",
            content = json.toByteArray(),
            caseDefinitionId = caseDefinitionId
        )

        importer.import(request)

        val captor = argumentCaptor<CaseDefinitionBuildingBlockLink>()
        verify(linkRepository, times(2)).save(captor.capture())

        assertThat(captor.allValues.map { it.buildingBlockDefinitionId.key })
            .containsExactly("bb-one", "bb-two")
    }

    @Test
    fun `should not save anything when content is empty array`() {
        val request = ImportRequest(
            fileName = "/building-block-link/my-case.case-building-block-links.json",
            content = "[]".toByteArray(),
            caseDefinitionId = caseDefinitionId
        )

        importer.import(request)

        verify(linkRepository, times(0)).deleteAllByCaseDefinitionId(caseDefinitionId)
        verify(linkRepository, times(0)).save(org.mockito.kotlin.any())
    }
}
