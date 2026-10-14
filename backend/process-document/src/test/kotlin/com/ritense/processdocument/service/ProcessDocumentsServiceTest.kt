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

import ch.qos.logback.classic.Level
import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.classic.spi.ThrowableProxy
import ch.qos.logback.core.read.ListAppender
import com.ritense.processdocument.domain.ProcessDocumentInstance
import com.ritense.processdocument.domain.ProcessDocumentInstanceId
import com.ritense.processdocument.domain.impl.OperatonProcessInstanceId
import com.ritense.valtimo.service.OperatonProcessService
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.operaton.bpm.engine.runtime.ProcessInstance
import org.slf4j.LoggerFactory
import kotlin.test.assertEquals
import kotlin.test.assertSame

internal class ProcessDocumentsServiceTest {

    lateinit var operatonProcessService: OperatonProcessService
    lateinit var associationService: ProcessDocumentAssociationService
    lateinit var processDocumentsService: ProcessDocumentsService
    lateinit var logger: Logger
    lateinit var logEvents: ListAppender<ILoggingEvent>

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
        logger = LoggerFactory.getLogger(ProcessDocumentsService::class.java) as Logger
        logEvents = ListAppender<ILoggingEvent>().apply { start() }
        logger.addAppender(logEvents)
    }

    @AfterEach
    fun afterEach() {
        logger.detachAppender(logEvents)
        logEvents.stop()
    }

    @Test
    fun `should keep the root process of the calling execution when called from a called subprocess`() {
        // Every mock is built before any stubbing starts: creating a mock inside a whenever() chain leaves
        // Mockito with an unfinished stubbing.
        val execution = executionIn(SUB_PROCESS_INSTANCE_ID, superProcessInstanceId = CALLING_ROOT_ID)
        val instances = listOf(
            processInstance(CALLING_ROOT_ID, CALLING_ROOT_ID),
            processInstance(OTHER_ROOT_ID, OTHER_ROOT_ID)
        )
        stubDocument(instances)

        processDocumentsService.deleteAllOtherProcessInstancesForThisDocument(execution, REASON)

        verify(operatonProcessService).deleteProcessInstanceById(OTHER_ROOT_ID, REASON)
        verify(operatonProcessService, never()).deleteProcessInstanceById(eq(CALLING_ROOT_ID), any())
        verify(operatonProcessService, never()).deleteProcessInstanceById(eq(SUB_PROCESS_INSTANCE_ID), any())
    }

    @Test
    fun `should delete nothing and warn when the calling process instance cannot be determined`() {
        val execution = mock<DelegateExecution>()
        whenever(execution.businessKey).thenReturn(DOCUMENT_ID)
        whenever(execution.processInstanceId).thenReturn(CALLING_ROOT_ID)
        whenever(execution.processInstance).thenReturn(null)

        processDocumentsService.deleteAllOtherProcessInstancesForThisDocument(execution, REASON)

        verify(operatonProcessService, never()).deleteProcessInstanceById(any(), any())
        verifyNoInteractions(associationService)
        assertEquals(1, logEvents.list.count { it.level == Level.WARN })
    }

    @Test
    fun `should delete only root process instances of the document`() {
        val execution = executionIn(CALLING_ROOT_ID, superProcessInstanceId = null)
        val instances = listOf(
            processInstance(CALLING_ROOT_ID, CALLING_ROOT_ID),
            processInstance(OTHER_ROOT_ID, OTHER_ROOT_ID),
            processInstance(OTHER_CHILD_ID, OTHER_ROOT_ID)
        )
        stubDocument(instances)

        processDocumentsService.deleteAllOtherProcessInstancesForThisDocument(execution, REASON)

        verify(operatonProcessService).deleteProcessInstanceById(OTHER_ROOT_ID, REASON)
        verify(operatonProcessService, never()).deleteProcessInstanceById(eq(OTHER_CHILD_ID), any())
        verify(operatonProcessService, never()).deleteProcessInstanceById(eq(CALLING_ROOT_ID), any())
    }

    @Test
    fun `should try every deletion, log each failure and rethrow the first`() {
        val execution = executionIn(CALLING_ROOT_ID, superProcessInstanceId = null)
        val instances = listOf(
            processInstance(CALLING_ROOT_ID, CALLING_ROOT_ID),
            processInstance(OTHER_ROOT_ID, OTHER_ROOT_ID),
            processInstance(SECOND_ROOT_ID, SECOND_ROOT_ID),
            processInstance(THIRD_ROOT_ID, THIRD_ROOT_ID)
        )
        stubDocument(instances)
        val firstFailure = IllegalStateException("first")
        val secondFailure = IllegalStateException("second")
        doThrow(firstFailure).whenever(operatonProcessService).deleteProcessInstanceById(OTHER_ROOT_ID, REASON)
        doThrow(secondFailure).whenever(operatonProcessService).deleteProcessInstanceById(SECOND_ROOT_ID, REASON)

        val thrown = assertThrows<IllegalStateException> {
            processDocumentsService.deleteAllOtherProcessInstancesForThisDocument(execution, REASON)
        }

        assertSame(firstFailure, thrown)
        verify(operatonProcessService).deleteProcessInstanceById(THIRD_ROOT_ID, REASON)
        val errors = logEvents.list.filter { it.level == Level.ERROR }
        assertEquals(2, errors.size)
        assertSame(firstFailure, (errors[0].throwableProxy as ThrowableProxy).throwable)
        assertSame(secondFailure, (errors[1].throwableProxy as ThrowableProxy).throwable)
    }

    @Test
    fun `should still delete the calling process itself with deleteAllProcessInstancesForThisDocument`() {
        val execution = executionIn(CALLING_ROOT_ID, superProcessInstanceId = null)
        val instances = listOf(
            processInstance(CALLING_ROOT_ID, CALLING_ROOT_ID),
            processInstance(OTHER_ROOT_ID, OTHER_ROOT_ID),
            processInstance(SECOND_ROOT_ID, SECOND_ROOT_ID)
        )
        stubDocument(instances)
        val firstFailure = IllegalStateException("first")
        doThrow(firstFailure).whenever(operatonProcessService).deleteProcessInstanceById(CALLING_ROOT_ID, REASON)

        val thrown = assertThrows<IllegalStateException> {
            processDocumentsService.deleteAllProcessInstancesForThisDocument(execution, REASON)
        }

        assertSame(firstFailure, thrown)
        verify(operatonProcessService).deleteProcessInstanceById(CALLING_ROOT_ID, REASON)
        verify(operatonProcessService).deleteProcessInstanceById(OTHER_ROOT_ID, REASON)
        verify(operatonProcessService).deleteProcessInstanceById(SECOND_ROOT_ID, REASON)
    }

    private fun stubDocument(instances: List<ProcessInstance>) {
        val associations = instances.map { processDocumentInstance(it.id) }
        whenever(associationService.findProcessDocumentInstances(any())).thenReturn(associations)
        whenever(operatonProcessService.findProcessInstancesByIds(instances.map { it.id }.toSet()))
            .thenReturn(instances)
    }

    private fun executionIn(processInstanceId: String, superProcessInstanceId: String?): DelegateExecution {
        val superProcessInstance = superProcessInstanceId?.let { delegateProcessInstance(it, superExecution = null) }
        val superExecution = superProcessInstance?.let { parent ->
            mock<DelegateExecution> { on { this.processInstance } doReturn parent }
        }
        val processInstance = delegateProcessInstance(processInstanceId, superExecution)
        return mock {
            on { businessKey } doReturn DOCUMENT_ID
            on { this.processInstanceId } doReturn processInstanceId
            on { this.processInstance } doReturn processInstance
        }
    }

    private fun delegateProcessInstance(id: String, superExecution: DelegateExecution?): DelegateExecution =
        mock {
            on { this.id } doReturn id
            on { this.processInstanceId } doReturn id
            on { this.superExecution } doReturn superExecution
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
        private const val REASON = "Case cancelled"
        private const val DOCUMENT_ID = "11111111-1111-1111-1111-111111111111"
        private const val CALLING_ROOT_ID = "22222222-2222-2222-2222-222222222222"
        private const val SUB_PROCESS_INSTANCE_ID = "33333333-3333-3333-3333-333333333333"
        private const val OTHER_ROOT_ID = "44444444-4444-4444-4444-444444444444"
        private const val OTHER_CHILD_ID = "55555555-5555-5555-5555-555555555555"
        private const val SECOND_ROOT_ID = "66666666-6666-6666-6666-666666666666"
        private const val THIRD_ROOT_ID = "77777777-7777-7777-7777-777777777777"
    }
}
