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

package com.ritense.case.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.ritense.case.domain.StartableItem
import com.ritense.case.domain.StartableItemId
import com.ritense.case.repository.StartableItemRepository
import com.ritense.case.web.rest.dto.StartableItemType
import com.ritense.exporter.request.StartableItemExportRequest
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.whenever

@ExtendWith(MockitoExtension::class)
class StartableItemExporterTest(
    @Mock private val startableItemRepository: StartableItemRepository,
) {

    private val objectMapper: ObjectMapper = jacksonObjectMapper()
    private lateinit var exporter: StartableItemExporter

    private val caseDefinitionId = CaseDefinitionId("my-case", "1.2.3")

    @BeforeEach
    fun setUp() {
        exporter = StartableItemExporter(objectMapper, startableItemRepository)
    }

    @Test
    fun `should support StartableItemExportRequest`() {
        assertThat(exporter.supports()).isEqualTo(StartableItemExportRequest::class.java)
    }

    @Test
    fun `should return empty result when no startable items exist`() {
        whenever(startableItemRepository.findAllByIdCaseDefinitionId(caseDefinitionId)).thenReturn(emptyList())

        val result = exporter.export(StartableItemExportRequest(caseDefinitionId))

        assertThat(result.exportFiles).isEmpty()
        assertThat(result.relatedRequests).isEmpty()
    }

    @Test
    fun `should export startable items with correct path and content`() {
        val processItem = StartableItem(
            id = StartableItemId(caseDefinitionId, "my-process", StartableItemType.PROCESS, ""),
            sortOrder = 0
        )
        val buildingBlockItem = StartableItem(
            id = StartableItemId(caseDefinitionId, "income-check", StartableItemType.BUILDING_BLOCK, "2.0.0"),
            sortOrder = 1
        )
        whenever(startableItemRepository.findAllByIdCaseDefinitionId(caseDefinitionId))
            .thenReturn(listOf(buildingBlockItem, processItem))

        val result = exporter.export(StartableItemExportRequest(caseDefinitionId))

        assertThat(result.exportFiles).hasSize(1)
        val exportFile = result.exportFiles.first()
        assertThat(exportFile.path).isEqualTo(
            "config/case/my-case/1-2-3/startable-item/my-case.startable-items.json"
        )
        assertThat(result.relatedRequests).isEmpty()

        val exportedJson = objectMapper.readTree(exportFile.content)
        assertThat(exportedJson.isArray).isTrue()
        assertThat(exportedJson).hasSize(2)
        assertThat(exportedJson.any { it.has("sortOrder") }).isFalse()

        val first = exportedJson[0]
        assertThat(first.get("type").asText()).isEqualTo("PROCESS")
        assertThat(first.get("key").asText()).isEqualTo("my-process")
        assertThat(first.has("versionTag")).isFalse()

        val second = exportedJson[1]
        assertThat(second.get("type").asText()).isEqualTo("BUILDING_BLOCK")
        assertThat(second.get("key").asText()).isEqualTo("income-check")
        assertThat(second.get("versionTag").asText()).isEqualTo("2.0.0")
    }

    @Test
    fun `should sort exported items by sortOrder`() {
        val itemA = StartableItem(
            id = StartableItemId(caseDefinitionId, "a", StartableItemType.PROCESS, ""),
            sortOrder = 5
        )
        val itemB = StartableItem(
            id = StartableItemId(caseDefinitionId, "b", StartableItemType.PROCESS, ""),
            sortOrder = 1
        )
        val itemC = StartableItem(
            id = StartableItemId(caseDefinitionId, "c", StartableItemType.PROCESS, ""),
            sortOrder = 3
        )
        whenever(startableItemRepository.findAllByIdCaseDefinitionId(caseDefinitionId))
            .thenReturn(listOf(itemA, itemB, itemC))

        val result = exporter.export(StartableItemExportRequest(caseDefinitionId))

        val exportedJson = objectMapper.readTree(result.exportFiles.first().content)
        assertThat(exportedJson.map { it.get("key").asText() })
            .containsExactly("b", "c", "a")
    }
}
