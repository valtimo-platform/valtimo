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

package com.ritense.processdocument.helper

import com.ritense.processdocument.helper.GetJsonSchemaDocumentHelper.getJsonSchemaDocumentId
import com.ritense.processdocument.helper.GetJsonSchemaDocumentHelper.getJsonSchemaDocumentIdOrNull
import com.ritense.valtimo.operaton.domain.OperatonExecution
import com.ritense.valtimo.operaton.domain.OperatonTask
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.delegate.BaseDelegateExecution
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.operaton.bpm.engine.delegate.DelegateTask
import org.operaton.bpm.engine.delegate.VariableScope
import org.operaton.bpm.engine.externaltask.ExternalTask
import org.operaton.bpm.engine.externaltask.LockedExternalTask
import org.operaton.bpm.engine.history.HistoricCaseInstance
import org.operaton.bpm.engine.history.HistoricProcessInstance
import org.operaton.bpm.engine.runtime.CaseInstance
import org.operaton.bpm.engine.runtime.ProcessInstance
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNull

class GetJsonSchemaDocumentHelperTest {

    private val documentId = UUID.fromString("11111111-2222-3333-4444-555555555555")
    private val documentIdString = documentId.toString()

    @Test
    fun `should resolve document id from base delegate execution business key`() {
        val execution = mock<BaseDelegateExecution>()
        whenever(execution.businessKey).thenReturn(documentIdString)

        assertEquals(documentId, execution.getJsonSchemaDocumentId())
        assertEquals(documentId, execution.getJsonSchemaDocumentIdOrNull())
    }

    @Test
    fun `should return null when base delegate execution business key is null`() {
        val execution = mock<BaseDelegateExecution>()

        assertNull(execution.getJsonSchemaDocumentIdOrNull())
    }

    @Test
    fun `should return null when base delegate execution business key is not a uuid`() {
        val execution = mock<BaseDelegateExecution>()
        whenever(execution.businessKey).thenReturn("not-a-uuid")

        assertNull(execution.getJsonSchemaDocumentIdOrNull())
    }

    @Test
    fun `should throw when base delegate execution document id cannot be resolved`() {
        val execution = mock<BaseDelegateExecution>()

        assertThrows(IllegalStateException::class.java) { execution.getJsonSchemaDocumentId() }
    }

    @Test
    fun `should resolve document id from delegate execution own business key`() {
        val execution = mock<DelegateExecution>()
        whenever(execution.businessKey).thenReturn(documentIdString)

        assertEquals(documentId, execution.getJsonSchemaDocumentId())
    }

    @Test
    fun `should resolve document id from delegate execution super execution when own business key is missing`() {
        val superExecution = mock<DelegateExecution>()
        whenever(superExecution.businessKey).thenReturn(documentIdString)
        val execution = mock<DelegateExecution>()
        whenever(execution.superExecution).thenReturn(superExecution)

        assertEquals(documentId, execution.getJsonSchemaDocumentIdOrNull())
    }

    @Test
    fun `should resolve document id from delegate execution process instance when super execution is missing`() {
        val processInstance = mock<DelegateExecution>()
        whenever(processInstance.businessKey).thenReturn(documentIdString)
        val execution = mock<DelegateExecution>()
        whenever(execution.processInstance).thenReturn(processInstance)

        assertEquals(documentId, execution.getJsonSchemaDocumentIdOrNull())
    }

    @Test
    fun `should not recurse into itself for delegate execution`() {
        val execution = mock<DelegateExecution>()
        whenever(execution.superExecution).thenReturn(execution)
        whenever(execution.processInstance).thenReturn(execution)

        assertNull(execution.getJsonSchemaDocumentIdOrNull())
    }

    @Test
    fun `should throw when delegate execution document id cannot be resolved`() {
        val execution = mock<DelegateExecution>()

        assertThrows(IllegalStateException::class.java) { execution.getJsonSchemaDocumentId() }
    }

    @Test
    fun `should resolve document id from delegate task execution`() {
        val execution = mock<DelegateExecution>()
        whenever(execution.businessKey).thenReturn(documentIdString)
        val task = mock<DelegateTask>()
        whenever(task.execution).thenReturn(execution)

        assertEquals(documentId, task.getJsonSchemaDocumentId())
    }

    @Test
    fun `should return null when delegate task execution is null`() {
        val task = mock<DelegateTask>()

        assertNull(task.getJsonSchemaDocumentIdOrNull())
    }

    @Test
    fun `should throw when delegate task execution has no business key`() {
        val task = mock<DelegateTask>()
        whenever(task.execution).thenReturn(mock())

        assertThrows(IllegalStateException::class.java) { task.getJsonSchemaDocumentId() }
    }

    @Test
    fun `should resolve document id from operaton execution own business key`() {
        val execution = mock<OperatonExecution>()
        whenever(execution.businessKey).thenReturn(documentIdString)

        assertEquals(documentId, execution.getJsonSchemaDocumentId())
    }

    @Test
    fun `should resolve document id from operaton execution super execution`() {
        val superExecution = mock<OperatonExecution>()
        whenever(superExecution.businessKey).thenReturn(documentIdString)
        val execution = mock<OperatonExecution>()
        whenever(execution.superExecution).thenReturn(superExecution)

        assertEquals(documentId, execution.getJsonSchemaDocumentIdOrNull())
    }

    @Test
    fun `should resolve document id from operaton execution process instance`() {
        val processInstance = mock<OperatonExecution>()
        whenever(processInstance.businessKey).thenReturn(documentIdString)
        val execution = mock<OperatonExecution>()
        whenever(execution.processInstance).thenReturn(processInstance)

        assertEquals(documentId, execution.getJsonSchemaDocumentIdOrNull())
    }

    @Test
    fun `should resolve document id from operaton execution parent`() {
        val parent = mock<OperatonExecution>()
        whenever(parent.businessKey).thenReturn(documentIdString)
        val execution = mock<OperatonExecution>()
        whenever(execution.parent).thenReturn(parent)

        assertEquals(documentId, execution.getJsonSchemaDocumentIdOrNull())
    }

    @Test
    fun `should not recurse into itself for operaton execution`() {
        val execution = mock<OperatonExecution>()
        whenever(execution.superExecution).thenReturn(execution)
        whenever(execution.processInstance).thenReturn(execution)
        whenever(execution.parent).thenReturn(execution)

        assertNull(execution.getJsonSchemaDocumentIdOrNull())
    }

    @Test
    fun `should throw when operaton execution document id cannot be resolved`() {
        val execution = mock<OperatonExecution>()

        assertThrows(IllegalStateException::class.java) { execution.getJsonSchemaDocumentId() }
    }

    @Test
    fun `should prefer operaton task process instance over execution`() {
        val processInstance = mock<OperatonExecution>()
        whenever(processInstance.businessKey).thenReturn(documentIdString)
        val task = mock<OperatonTask>()
        whenever(task.processInstance).thenReturn(processInstance)

        assertEquals(documentId, task.getJsonSchemaDocumentId())
    }

    @Test
    fun `should fall back to operaton task execution when process instance is null`() {
        val execution = mock<OperatonExecution>()
        whenever(execution.businessKey).thenReturn(documentIdString)
        val task = mock<OperatonTask>()
        whenever(task.execution).thenReturn(execution)

        assertEquals(documentId, task.getJsonSchemaDocumentIdOrNull())
    }

    @Test
    fun `should return null when operaton task process instance and execution are null`() {
        val task = mock<OperatonTask>()

        assertNull(task.getJsonSchemaDocumentIdOrNull())
    }

    @Test
    fun `should throw when operaton task document id cannot be resolved`() {
        val task = mock<OperatonTask>()

        assertThrows(IllegalStateException::class.java) { task.getJsonSchemaDocumentId() }
    }

    @Test
    fun `should resolve document id for process instance`() {
        val processInstance = mock<ProcessInstance>()
        whenever(processInstance.businessKey).thenReturn(documentIdString)

        assertEquals(documentId, processInstance.getJsonSchemaDocumentId())
        assertEquals(documentId, processInstance.getJsonSchemaDocumentIdOrNull())
    }

    @Test
    fun `should resolve document id for historic process instance`() {
        val historicProcessInstance = mock<HistoricProcessInstance>()
        whenever(historicProcessInstance.businessKey).thenReturn(documentIdString)

        assertEquals(documentId, historicProcessInstance.getJsonSchemaDocumentId())
        assertEquals(documentId, historicProcessInstance.getJsonSchemaDocumentIdOrNull())
    }

    @Test
    fun `should resolve document id for case instance`() {
        val caseInstance = mock<CaseInstance>()
        whenever(caseInstance.businessKey).thenReturn(documentIdString)

        assertEquals(documentId, caseInstance.getJsonSchemaDocumentId())
        assertEquals(documentId, caseInstance.getJsonSchemaDocumentIdOrNull())
    }

    @Test
    fun `should resolve document id for historic case instance`() {
        val historicCaseInstance = mock<HistoricCaseInstance>()
        whenever(historicCaseInstance.businessKey).thenReturn(documentIdString)

        assertEquals(documentId, historicCaseInstance.getJsonSchemaDocumentId())
        assertEquals(documentId, historicCaseInstance.getJsonSchemaDocumentIdOrNull())
    }

    @Test
    fun `should resolve document id for external task`() {
        val externalTask = mock<ExternalTask>()
        whenever(externalTask.businessKey).thenReturn(documentIdString)

        assertEquals(documentId, externalTask.getJsonSchemaDocumentId())
        assertEquals(documentId, externalTask.getJsonSchemaDocumentIdOrNull())
    }

    @Test
    fun `should resolve document id for locked external task`() {
        val lockedExternalTask = mock<LockedExternalTask>()
        whenever(lockedExternalTask.businessKey).thenReturn(documentIdString)

        assertEquals(documentId, lockedExternalTask.getJsonSchemaDocumentId())
        assertEquals(documentId, lockedExternalTask.getJsonSchemaDocumentIdOrNull())
    }

    @Test
    fun `should return null and throw when business key only type has no business key`() {
        val processInstance = mock<ProcessInstance>()

        assertNull(processInstance.getJsonSchemaDocumentIdOrNull())
        assertThrows(IllegalStateException::class.java) { processInstance.getJsonSchemaDocumentId() }
    }

    @Test
    fun `should dispatch variable scope to delegate task`() {
        val execution = mock<DelegateExecution>()
        whenever(execution.businessKey).thenReturn(documentIdString)
        val task = mock<DelegateTask>()
        whenever(task.execution).thenReturn(execution)
        val scope: VariableScope = task

        assertEquals(documentId, scope.getJsonSchemaDocumentId())
        assertEquals(documentId, scope.getJsonSchemaDocumentIdOrNull())
    }

    @Test
    fun `should dispatch variable scope to delegate execution`() {
        val execution = mock<DelegateExecution>()
        whenever(execution.businessKey).thenReturn(documentIdString)
        val scope: VariableScope = execution

        assertEquals(documentId, scope.getJsonSchemaDocumentId())
        assertEquals(documentId, scope.getJsonSchemaDocumentIdOrNull())
    }

    @Test
    fun `should dispatch variable scope to operaton execution`() {
        val execution = mock<OperatonExecution>()
        whenever(execution.businessKey).thenReturn(documentIdString)
        val scope: VariableScope = execution

        assertEquals(documentId, scope.getJsonSchemaDocumentId())
        assertEquals(documentId, scope.getJsonSchemaDocumentIdOrNull())
    }

    @Test
    fun `should dispatch variable scope to operaton task`() {
        val processInstance = mock<OperatonExecution>()
        whenever(processInstance.businessKey).thenReturn(documentIdString)
        val task = mock<OperatonTask>()
        whenever(task.processInstance).thenReturn(processInstance)
        val scope: VariableScope = task

        assertEquals(documentId, scope.getJsonSchemaDocumentId())
        assertEquals(documentId, scope.getJsonSchemaDocumentIdOrNull())
    }

    @Test
    fun `should return null for unsupported variable scope`() {
        val scope = mock<VariableScope>()

        assertNull(scope.getJsonSchemaDocumentIdOrNull())
    }

    @Test
    fun `should throw for unsupported variable scope`() {
        val scope = mock<VariableScope>()

        assertThrows(IllegalStateException::class.java) { scope.getJsonSchemaDocumentId() }
    }

    @Test
    fun `should accept uppercase hexadecimal uuid`() {
        val execution = mock<ProcessInstance>()
        whenever(execution.businessKey).thenReturn("ABCDEF01-2345-6789-ABCD-EF0123456789")

        assertEquals(UUID.fromString("ABCDEF01-2345-6789-ABCD-EF0123456789"), execution.getJsonSchemaDocumentIdOrNull())
    }

    @Test
    fun `should reject business key with surrounding text`() {
        val execution = mock<ProcessInstance>()
        whenever(execution.businessKey).thenReturn(" $documentIdString ")

        assertNull(execution.getJsonSchemaDocumentIdOrNull())
    }

    @Test
    fun `should reject business key with wrong length`() {
        val execution = mock<ProcessInstance>()
        whenever(execution.businessKey).thenReturn("11111111-2222-3333-4444-5555")

        assertNull(execution.getJsonSchemaDocumentIdOrNull())
    }
}
