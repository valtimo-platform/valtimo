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

import com.ritense.valtimo.service.OperatonProcessService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.delegate.DelegateExecution
import java.util.Optional

internal class ProcessDocumentsServiceTest {

    lateinit var operatonProcessService: OperatonProcessService
    lateinit var associationService: ProcessDocumentAssociationService
    lateinit var processDocumentsService: ProcessDocumentsService

    @BeforeEach
    fun beforeEach() {
        operatonProcessService = mock()
        associationService = mock()
        processDocumentsService = ProcessDocumentsService(
            mock(),
            operatonProcessService,
            associationService,
            mock(),
            mock(),
        )
    }

    @Test
    fun `should delete nothing when the calling process instance cannot be found`() {
        val execution = mock<DelegateExecution>()
        whenever(execution.businessKey).thenReturn(DOCUMENT_ID)
        whenever(execution.processInstanceId).thenReturn(PROCESS_INSTANCE_ID)
        whenever(operatonProcessService.findProcessInstanceById(PROCESS_INSTANCE_ID)).thenReturn(Optional.empty())

        processDocumentsService.deleteAllOtherProcessInstancesForThisDocument(execution, "Case cancelled")

        verify(operatonProcessService, never()).deleteProcessInstanceById(any(), any())
        verifyNoInteractions(associationService)
    }

    companion object {
        private const val DOCUMENT_ID = "11111111-1111-1111-1111-111111111111"
        private const val PROCESS_INSTANCE_ID = "00000000-0000-0000-0000-000000000000"
    }
}
