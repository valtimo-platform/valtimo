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

import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.importer.ImportService
import com.ritense.importer.exception.ImportServiceException
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.isNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.io.ByteArrayInputStream
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class CaseDefinitionImportServiceTest {

    lateinit var importService: ImportService
    lateinit var caseDefinitionService: CaseDefinitionService
    lateinit var caseDefinitionRepository: CaseDefinitionRepository
    lateinit var service: CaseDefinitionImportService

    @BeforeEach
    fun setUp() {
        importService = mock()
        caseDefinitionService = mock()
        caseDefinitionRepository = mock()
        service = CaseDefinitionImportService(importService, caseDefinitionService, caseDefinitionRepository)
    }

    @Test
    fun `should activate the latest version after importing`() {
        val importedId = CaseDefinitionId("my-case", "1.0.0")
        whenever(caseDefinitionRepository.findAllByFinalTrue()).thenReturn(emptyList())
        whenever(importService.import(any(), any(), isNull(), isNull(), isNull())).thenReturn(importedId)

        val result = service.import(inputStream())

        assertEquals(importedId, result)
        verify(caseDefinitionService).setLatestToActiveIfNoneIsActive()
    }

    @Test
    fun `should skip case definitions that are already final`() {
        val finalId = CaseDefinitionId("existing-case", "1.0.0")
        whenever(caseDefinitionRepository.findAllByFinalTrue()).thenReturn(
            listOf(CaseDefinition(id = finalId, name = "existing-case", createdDate = null, final = true))
        )

        service.import(inputStream())

        verify(importService).import(any(), eq(listOf(finalId)), isNull(), isNull(), isNull())
    }

    @Test
    fun `should pass the overrides and plugin configuration mappings on to the import service`() {
        val source = UUID.randomUUID()
        val target = UUID.randomUUID()
        whenever(caseDefinitionRepository.findAllByFinalTrue()).thenReturn(emptyList())

        service.import(inputStream(), "new-key", "New Name", mapOf(source to target))

        verify(importService).import(
            any(),
            any(),
            eq("new-key"),
            eq("New Name"),
            eq(mapOf(source to target)),
        )
    }

    @Test
    fun `should not activate anything when the import fails`() {
        whenever(caseDefinitionRepository.findAllByFinalTrue()).thenReturn(emptyList())
        whenever(importService.import(any(), any(), isNull(), isNull(), isNull()))
            .thenThrow(ImportServiceException("Invalid zip"))

        assertFailsWith<ImportServiceException> { service.import(inputStream()) }

        verify(caseDefinitionService, never()).setLatestToActiveIfNoneIsActive()
    }

    private fun inputStream() = ByteArrayInputStream(byteArrayOf(1, 2, 3))
}
