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

import com.ritense.processdocument.domain.ProcessDocumentInstance
import com.ritense.processdocument.domain.ProcessDocumentInstanceId
import com.ritense.processdocument.domain.impl.OperatonProcessInstanceId
import com.ritense.valtimo.service.OperatonProcessService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.operaton.bpm.engine.runtime.ProcessInstance
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
    fun `should keep the root of the calling execution rather than its own process instance`() {
        // Every mock is built before any stubbing starts: creating a mock inside a whenever() chain leaves
        // Mockito with an unfinished stubbing.
        val execution = mock<DelegateExecution>()
        val callingExecutionInstance = processInstance(SUB_PROCESS_INSTANCE_ID, CALLING_ROOT_ID)
        val roots = listOf(
            processInstance(CALLING_ROOT_ID, CALLING_ROOT_ID),
            processInstance(OTHER_ROOT_ID, OTHER_ROOT_ID)
        )
        val associations = listOf(
            processDocumentInstance(CALLING_ROOT_ID),
            processDocumentInstance(OTHER_ROOT_ID)
        )

        whenever(execution.businessKey).thenReturn(DOCUMENT_ID)
        whenever(execution.processInstanceId).thenReturn(SUB_PROCESS_INSTANCE_ID)
        whenever(operatonProcessService.findProcessInstanceById(SUB_PROCESS_INSTANCE_ID))
            .thenReturn(Optional.of(callingExecutionInstance))
        whenever(associationService.findProcessDocumentInstances(any())).thenReturn(associations)
        whenever(operatonProcessService.findProcessInstancesByIds(setOf(CALLING_ROOT_ID, OTHER_ROOT_ID)))
            .thenReturn(roots)

        processDocumentsService.deleteAllOtherProcessInstancesForThisDocument(execution, "Case cancelled")

        verify(operatonProcessService).deleteProcessInstanceById(OTHER_ROOT_ID, "Case cancelled")
        verify(operatonProcessService, never()).deleteProcessInstanceById(eq(CALLING_ROOT_ID), any())
        verify(operatonProcessService, never()).deleteProcessInstanceById(eq(SUB_PROCESS_INSTANCE_ID), any())
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

    private fun processInstance(processInstanceId: String, rootProcessInstanceId: String?): ProcessInstance =
        mock {
            on { this.id } doReturn processInstanceId
            on { this.processInstanceId } doReturn processInstanceId
            on { this.rootProcessInstanceId } doReturn rootProcessInstanceId
        }

    private fun processDocumentInstance(processInstanceId: String): ProcessDocumentInstance {
        val id = mock<ProcessDocumentInstanceId> {
            on { processInstanceId() } doReturn OperatonProcessInstanceId(processInstanceId)
        }
        return mock { on { processDocumentInstanceId() } doReturn id }
    }

    companion object {
        private const val DOCUMENT_ID = "11111111-1111-1111-1111-111111111111"
        private const val PROCESS_INSTANCE_ID = "00000000-0000-0000-0000-000000000000"
        private const val CALLING_ROOT_ID = "22222222-2222-2222-2222-222222222222"
        private const val SUB_PROCESS_INSTANCE_ID = "33333333-3333-3333-3333-333333333333"
        private const val OTHER_ROOT_ID = "44444444-4444-4444-4444-444444444444"
    }
}
