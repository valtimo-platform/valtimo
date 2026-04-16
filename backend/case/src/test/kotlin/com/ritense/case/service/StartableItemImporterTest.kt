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

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.ritense.case.domain.StartableItem
import com.ritense.case.repository.StartableItemRepository
import com.ritense.case.web.rest.dto.StartableItemType
import com.ritense.importer.ImportRequest
import com.ritense.importer.ValtimoImportTypes.Companion.CASE_BUILDING_BLOCK_LINK
import com.ritense.importer.ValtimoImportTypes.Companion.DOCUMENT_DEFINITION
import com.ritense.importer.ValtimoImportTypes.Companion.PROCESS_DOCUMENT_LINK
import com.ritense.importer.ValtimoImportTypes.Companion.STARTABLE_ITEM
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify

@ExtendWith(MockitoExtension::class)
class StartableItemImporterTest(
    @Mock private val startableItemRepository: StartableItemRepository,
) {

    private val objectMapper = jacksonObjectMapper()
    private lateinit var importer: StartableItemImporter

    private val caseDefinitionId = CaseDefinitionId("my-case", "1.0.0")

    @BeforeEach
    fun setUp() {
        importer = StartableItemImporter(objectMapper, startableItemRepository)
    }

    @Test
    fun `should have correct type`() {
        assertThat(importer.type()).isEqualTo(STARTABLE_ITEM)
    }

    @Test
    fun `should depend on document definition, process document link and case building block link`() {
        assertThat(importer.dependsOn()).containsExactlyInAnyOrder(
            DOCUMENT_DEFINITION,
            PROCESS_DOCUMENT_LINK,
            CASE_BUILDING_BLOCK_LINK,
        )
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
        assertThat(importer.supports("/startable-item/my-case.startable-items.json")).isTrue()
    }

    @Test
    fun `should not support invalid filename`() {
        assertThat(importer.supports("/startable-item/test.json")).isFalse()
        assertThat(importer.supports("/other/my-case.startable-items.json")).isFalse()
        assertThat(importer.supports("/startable-item/my-case.startable-items-json")).isFalse()
    }

    @Test
    fun `should delete existing items and save new ones on import, using array position as sort order`() {
        val json = """
            [
                {
                    "type": "PROCESS",
                    "key": "my-process",
                    "versionTag": ""
                },
                {
                    "type": "BUILDING_BLOCK",
                    "key": "income-check",
                    "versionTag": "1.0.0"
                }
            ]
        """.trimIndent()

        val request = ImportRequest(
            fileName = "/startable-item/my-case.startable-items.json",
            content = json.toByteArray(),
            caseDefinitionId = caseDefinitionId
        )

        importer.import(request)

        verify(startableItemRepository).deleteAllByIdCaseDefinitionId(caseDefinitionId)

        val captor = argumentCaptor<List<StartableItem>>()
        verify(startableItemRepository).saveAll(captor.capture())

        val saved = captor.firstValue
        assertThat(saved).hasSize(2)

        assertThat(saved[0].id.caseDefinitionId).isEqualTo(caseDefinitionId)
        assertThat(saved[0].id.itemType).isEqualTo(StartableItemType.PROCESS)
        assertThat(saved[0].id.itemKey).isEqualTo("my-process")
        assertThat(saved[0].id.itemVersionTag).isEqualTo("")
        assertThat(saved[0].sortOrder).isEqualTo(0)

        assertThat(saved[1].id.itemType).isEqualTo(StartableItemType.BUILDING_BLOCK)
        assertThat(saved[1].id.itemKey).isEqualTo("income-check")
        assertThat(saved[1].id.itemVersionTag).isEqualTo("1.0.0")
        assertThat(saved[1].sortOrder).isEqualTo(1)
    }

    @Test
    fun `should default versionTag to empty string when omitted`() {
        val json = """
            [
                {
                    "type": "PROCESS",
                    "key": "my-process"
                }
            ]
        """.trimIndent()

        val request = ImportRequest(
            fileName = "/startable-item/my-case.startable-items.json",
            content = json.toByteArray(),
            caseDefinitionId = caseDefinitionId
        )

        importer.import(request)

        val captor = argumentCaptor<List<StartableItem>>()
        verify(startableItemRepository).saveAll(captor.capture())
        assertThat(captor.firstValue.single().id.itemVersionTag).isEqualTo("")
    }

    @Test
    fun `should delete existing items but not save when content is empty array`() {
        val request = ImportRequest(
            fileName = "/startable-item/my-case.startable-items.json",
            content = "[]".toByteArray(),
            caseDefinitionId = caseDefinitionId
        )

        importer.import(request)

        verify(startableItemRepository).deleteAllByIdCaseDefinitionId(caseDefinitionId)
        verify(startableItemRepository, never()).saveAll(any<List<StartableItem>>())
    }

    @Test
    fun `should throw IllegalArgumentException when content is invalid json`() {
        val request = ImportRequest(
            fileName = "/startable-item/my-case.startable-items.json",
            content = "not-json".toByteArray(),
            caseDefinitionId = caseDefinitionId
        )

        org.junit.jupiter.api.assertThrows<IllegalArgumentException> {
            importer.import(request)
        }
        verify(startableItemRepository, times(0)).saveAll(any<List<StartableItem>>())
    }
}
