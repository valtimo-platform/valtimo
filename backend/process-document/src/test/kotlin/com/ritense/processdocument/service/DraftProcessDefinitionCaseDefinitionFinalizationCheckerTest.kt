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

import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.service.OperatonProcessService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.impl.persistence.entity.SuspensionState

class DraftProcessDefinitionCaseDefinitionFinalizationCheckerTest {

    lateinit var operatonProcessService: OperatonProcessService
    lateinit var checker: DraftProcessDefinitionCaseDefinitionFinalizationChecker

    private val caseDefinitionId = CaseDefinitionId("test-case", "1.0.0")

    @BeforeEach
    fun setUp() {
        operatonProcessService = mock()
        checker = DraftProcessDefinitionCaseDefinitionFinalizationChecker(operatonProcessService)
    }

    @Test
    fun `check should return not finalizable when process definitions are in draft`() {
        val draftProcess = createProcessDefinition(suspended = true)
        whenever(operatonProcessService.getAllDefinitions(caseDefinitionId))
            .thenReturn(listOf(draftProcess))

        val result = checker.check(caseDefinitionId)

        assertThat(result.finalizable).isFalse()
        assertThat(result.code).isEqualTo("PROCESS_DEFINITION_IN_DRAFT")
    }

    @Test
    fun `check should return finalizable when no process definitions are in draft`() {
        val activeProcess = createProcessDefinition(suspended = false)
        whenever(operatonProcessService.getAllDefinitions(caseDefinitionId))
            .thenReturn(listOf(activeProcess))

        val result = checker.check(caseDefinitionId)

        assertThat(result.finalizable).isTrue()
        assertThat(result.code).isEqualTo("OK")
    }

    @Test
    fun `check should return finalizable when no process definitions exist`() {
        whenever(operatonProcessService.getAllDefinitions(caseDefinitionId))
            .thenReturn(emptyList())

        val result = checker.check(caseDefinitionId)

        assertThat(result.finalizable).isTrue()
        assertThat(result.code).isEqualTo("OK")
    }

    @Test
    fun `check should return not finalizable when at least one process definition is in draft`() {
        val activeProcess = createProcessDefinition(suspended = false)
        val draftProcess = createProcessDefinition(suspended = true)
        whenever(operatonProcessService.getAllDefinitions(caseDefinitionId))
            .thenReturn(listOf(activeProcess, draftProcess))

        val result = checker.check(caseDefinitionId)

        assertThat(result.finalizable).isFalse()
        assertThat(result.code).isEqualTo("PROCESS_DEFINITION_IN_DRAFT")
    }

    private fun createProcessDefinition(suspended: Boolean): OperatonProcessDefinition {
        return OperatonProcessDefinition(
            id = "process-def-id",
            revision = 1,
            category = null,
            name = "Test Process",
            key = "test-process",
            version = 1,
            deploymentId = "deployment-id",
            resourceName = "test.bpmn",
            diagramResourceName = null,
            hasStartFormKey = false,
            suspensionState = if (suspended) SuspensionState.SUSPENDED.stateCode else SuspensionState.ACTIVE.stateCode,
            tenantId = null,
            versionTag = "case:test-case:1.0.0",
            historyTimeToLive = null,
            isStartableInTasklist = true
        )
    }
}
