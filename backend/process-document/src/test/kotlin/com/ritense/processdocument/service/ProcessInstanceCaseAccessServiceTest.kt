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

package com.ritense.processdocument.service

import com.ritense.document.domain.Document
import com.ritense.processdocument.domain.ProcessDocumentInstanceId
import com.ritense.processdocument.domain.ProcessInstanceId
import com.ritense.processdocument.domain.impl.ProcessDocumentInstanceDto
import java.util.UUID
import kotlin.test.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.web.server.ResponseStatusException

class ProcessInstanceCaseAccessServiceTest {

    private lateinit var processDocumentAssociationService: ProcessDocumentAssociationService

    private lateinit var service: ProcessInstanceCaseAccessService

    private val caseId: UUID = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        processDocumentAssociationService = mock()

        service = ProcessInstanceCaseAccessService(
            processDocumentAssociationService
        )
    }

    @Test
    fun `requireBelongsToCase passes when the process instance is associated with the case`() {
        val processInstanceId = UUID.randomUUID().toString()
        val dto = instanceDto(processInstanceId)
        whenever(processDocumentAssociationService.findProcessDocumentInstanceDtos(any<Document.Id>()))
            .thenReturn(listOf(dto))

        service.requireBelongsToCase(caseId, processInstanceId)
    }

    @Test
    fun `requireBelongsToCase throws 404 when the process instance is not associated with the case`() {
        whenever(processDocumentAssociationService.findProcessDocumentInstanceDtos(any<Document.Id>()))
            .thenReturn(emptyList())

        val ex = assertThrows<ResponseStatusException> {
            service.requireBelongsToCase(caseId, "unknown-pid")
        }
        assertEquals(404, ex.statusCode.value())
    }

    private fun instanceDto(processInstanceId: String): ProcessDocumentInstanceDto {
        val pInstanceId = mock<ProcessInstanceId>()
        whenever(pInstanceId.toString()).thenReturn(processInstanceId)
        val id = mock<ProcessDocumentInstanceId>()
        whenever(id.processInstanceId()).thenReturn(pInstanceId)
        return ProcessDocumentInstanceDto(id, "p", true, 1, 1, null, null)
    }
}
