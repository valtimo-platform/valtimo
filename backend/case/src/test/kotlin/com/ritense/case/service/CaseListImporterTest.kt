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

import com.fasterxml.jackson.databind.jsontype.NamedType
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.ritense.case.web.rest.dto.CaseListColumnDto
import com.ritense.importer.ImportRequest
import com.ritense.importer.ValtimoImportTypes.Companion.CASE_LIST
import com.ritense.importer.ValtimoImportTypes.Companion.DOCUMENT_DEFINITION
import com.ritense.search.domain.DateFormatDisplayTypeParameter
import com.ritense.search.domain.DisplayType
import com.ritense.search.domain.EmptyDisplayTypeParameter
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.core.io.ByteArrayResource
import org.springframework.core.io.support.ResourcePatternResolver

@ExtendWith(MockitoExtension::class)
class CaseListImporterTest(
    @Mock private val resourcePatternResolver: ResourcePatternResolver,
    @Mock private val caseDefinitionService: CaseDefinitionService
) {
    private lateinit var importer: CaseListImporter

    @BeforeEach
    fun before() {
        val schemaJson = """
            {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "title": { "type": "string" },
                  "key": { "type": "string" },
                  "path": { "type": "string" },
                  "displayType": { "type": "object" },
                  "sortable": { "type": "boolean" },
                  "defaultSort": {},
                  "exportable": { "type": "boolean" }
                },
                "required": ["key", "path", "displayType", "sortable"]
              }
            }
        """.trimIndent()
        whenever(resourcePatternResolver.getResource(any()))
            .thenReturn(ByteArrayResource(schemaJson.toByteArray()))

        val objectMapper = jacksonObjectMapper().apply {
            registerSubtypes(
                NamedType(EmptyDisplayTypeParameter::class.java, "text"),
                NamedType(DateFormatDisplayTypeParameter::class.java, "date"),
            )
        }
        importer = CaseListImporter(resourcePatternResolver, objectMapper, caseDefinitionService)
    }

    @Test
    fun `should be of type 'caselist'`() {
        assertThat(importer.type()).isEqualTo(CASE_LIST)
    }

    @Test
    fun `should depend on 'documentdefinition' type`() {
        assertThat(importer.dependsOn()).isEqualTo(setOf(DOCUMENT_DEFINITION))
    }

    @Test
    fun `should support caselist fileName`() {
        assertThat(importer.supports("/case/list/my-case.case-list.json")).isTrue()
    }

    @Test
    fun `should not support non-caselist fileName`() {
        assertThat(importer.supports("/case/list/my-case.json")).isFalse()
        assertThat(importer.supports("/case/other/my-case.case-list.json")).isFalse()
    }

    @Test
    fun `should use caseDefinitionId key instead of filename for import`() {
        val jsonContent = """
            [
                {
                    "key": "col1",
                    "path": "doc:createdOn",
                    "displayType": { "type": "date", "displayTypeParameters": {} },
                    "sortable": true
                }
            ]
        """.trimIndent()

        whenever(caseDefinitionService.getListColumns(any())).thenReturn(emptyList())

        val caseDefinitionId = CaseDefinitionId("overridden-key", "1.0.0")
        importer.import(
            ImportRequest(
                "/case/list/original-key.case-list.json",
                jsonContent.toByteArray(),
                caseDefinitionId
            )
        )

        val nameCaptor = argumentCaptor<String>()
        val columnsCaptor = argumentCaptor<List<CaseListColumnDto>>()

        verify(caseDefinitionService).updateListColumns(nameCaptor.capture(), columnsCaptor.capture())

        assertThat(nameCaptor.firstValue).isEqualTo("overridden-key")
        assertThat(columnsCaptor.firstValue).hasSize(1)
        assertThat(columnsCaptor.firstValue[0].key).isEqualTo("col1")
    }

    @Test
    fun `should delete columns that are no longer in the import`() {
        val jsonContent = """
            [
                {
                    "key": "col1",
                    "path": "doc:createdOn",
                    "displayType": { "type": "date", "displayTypeParameters": {} },
                    "sortable": true
                }
            ]
        """.trimIndent()

        val existingColumn = CaseListColumnDto(
            title = "Old Column",
            key = "old-col",
            path = "doc:oldPath",
            displayType = DisplayType("text", EmptyDisplayTypeParameter()),
            sortable = false,
            defaultSort = null,
            order = 0
        )
        val caseDefinitionId = CaseDefinitionId("my-case", "1.0.0")

        whenever(caseDefinitionService.getListColumns("my-case")).thenReturn(listOf(existingColumn))

        importer.import(
            ImportRequest(
                "/case/list/my-case.case-list.json",
                jsonContent.toByteArray(),
                caseDefinitionId
            )
        )

        verify(caseDefinitionService).deleteCaseListColumn("my-case", "old-col")
    }

    @Test
    fun `should not delete columns that are still in the import`() {
        val jsonContent = """
            [
                {
                    "key": "col1",
                    "path": "doc:createdOn",
                    "displayType": { "type": "date", "displayTypeParameters": {} },
                    "sortable": true
                }
            ]
        """.trimIndent()

        val existingColumn = CaseListColumnDto(
            title = "Existing",
            key = "col1",
            path = "doc:createdOn",
            displayType = DisplayType("date", EmptyDisplayTypeParameter()),
            sortable = true,
            defaultSort = null,
            order = 0
        )
        val caseDefinitionId = CaseDefinitionId("my-case", "1.0.0")

        whenever(caseDefinitionService.getListColumns("my-case")).thenReturn(listOf(existingColumn))

        importer.import(
            ImportRequest(
                "/case/list/my-case.case-list.json",
                jsonContent.toByteArray(),
                caseDefinitionId
            )
        )

        verify(caseDefinitionService).updateListColumns(eq("my-case"), any())
    }
}
