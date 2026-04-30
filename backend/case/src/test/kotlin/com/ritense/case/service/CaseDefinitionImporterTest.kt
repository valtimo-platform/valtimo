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

import CaseDefinitionDto
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.importer.ImportRequest
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify

@ExtendWith(MockitoExtension::class)
class CaseDefinitionImporterTest(
    @Mock private val caseDefinitionRepository: CaseDefinitionRepository
) {
    private val objectMapper = jacksonObjectMapper()
    private lateinit var importer: CaseDefinitionImporter

    @BeforeEach
    fun before() {
        importer = CaseDefinitionImporter(objectMapper, caseDefinitionRepository, mock(), mock())
    }

    @Test
    fun `should be of type 'casesettings'`() {
        assertThat(importer.type()).isEqualTo("casedefinition")
    }

    @Test
    fun `should not depend on any type`() {
        assertThat(importer.dependsOn()).isEqualTo(emptySet<String>())
    }

    @Test
    fun `should support casesettings fileName`() {
        assertThat(importer.supports(FILENAME)).isTrue()
    }

    @Test
    fun `should not support non-caselist fileName`() {
        assertThat(importer.supports("/case/definition/x/test.case-definition.json")).isFalse()
        assertThat(importer.supports("/case/definition/test.case-definition-json")).isFalse()
    }

    @Test
    fun `should import with key and name overrides`() {
        val content = objectMapper.writeValueAsBytes(CASE_DEFINITION_DTO)
        val caseDefinitionId = CaseDefinitionId("overridden-key", "1.0.0")
        val request = ImportRequest(
            FILENAME, content, caseDefinitionId,
            keyOverride = "overridden-key",
            nameOverride = "Overridden Name",
        )

        importer.import(request)

        val captor = argumentCaptor<CaseDefinition>()
        verify(caseDefinitionRepository).save(captor.capture())
        assertThat(captor.firstValue.id.key).isEqualTo("overridden-key")
        assertThat(captor.firstValue.name).isEqualTo("Overridden Name")
    }

    @Test
    fun `should import with original key and name when no overrides`() {
        val content = objectMapper.writeValueAsBytes(CASE_DEFINITION_DTO)
        val caseDefinitionId = CaseDefinitionId("original-key", "1.0.0")
        val request = ImportRequest(FILENAME, content, caseDefinitionId)

        importer.import(request)

        val captor = argumentCaptor<CaseDefinition>()
        verify(caseDefinitionRepository).save(captor.capture())
        assertThat(captor.firstValue.id.key).isEqualTo("original-key")
        assertThat(captor.firstValue.name).isEqualTo("Original Name")
    }

    @Test
    fun `should apply overrides in afterImport for final definition`() {
        val dto = CASE_DEFINITION_DTO.copy(final = true)
        val content = objectMapper.writeValueAsBytes(dto)
        val caseDefinitionId = CaseDefinitionId("overridden-key", "1.0.0")
        val request = ImportRequest(
            FILENAME, content, caseDefinitionId,
            keyOverride = "overridden-key",
            nameOverride = "Overridden Name",
        )

        importer.afterImport(request)

        val captor = argumentCaptor<CaseDefinition>()
        verify(caseDefinitionRepository).save(captor.capture())
        assertThat(captor.firstValue.id.key).isEqualTo("overridden-key")
        assertThat(captor.firstValue.name).isEqualTo("Overridden Name")
    }

    private companion object {
        const val FILENAME = "/case/definition/my-case-list.case-definition.json"
        val CASE_DEFINITION_DTO = CaseDefinitionDto(
            key = "original-key",
            versionTag = "1.0.0",
            name = "Original Name",
            description = null,
            createdBy = null,
            createdDate = null,
            basedOnVersionTag = null,
            final = false,
        )
    }
}