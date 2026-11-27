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

package com.ritense.processdocument.listener

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.BaseIntegrationTest
import com.ritense.processdocument.domain.impl.OperatonProcessInstanceId
import java.util.UUID
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.ManagementService
import org.operaton.bpm.engine.RuntimeService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional

@Transactional
class TimerStartEventCaseListenerIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var managementService: ManagementService

    @Autowired
    lateinit var runtimeService: RuntimeService

    @Autowired
    lateinit var documentService: DocumentService

    @Test
    fun `should create case when timer starts a process that starts a case`() {
        managementService.executeJob(timerJobId(TIMER_PROCESS_WITH_CASE))

        val processInstance = runtimeService.createProcessInstanceQuery()
            .processDefinitionKey(TIMER_PROCESS_WITH_CASE)
            .singleResult()
        assertThat(processInstance).isNotNull
        assertThat(processInstance.businessKey).isNotNull()

        val documentId = JsonSchemaDocumentId.existingId(UUID.fromString(processInstance.businessKey))
        val document = runWithoutAuthorization { documentService.findBy(documentId) }
        assertThat(document).isPresent
        assertThat(document.get().definitionId().name()).isEqualTo(CASE_KEY)

        val link = runWithoutAuthorization {
            operatonProcessJsonSchemaDocumentAssociationService
                .findProcessDocumentInstance(OperatonProcessInstanceId(processInstance.id))
        }
        assertThat(link).isPresent
        assertThat(link.get().processDocumentInstanceId().documentId()).isEqualTo(documentId)
    }

    @Test
    fun `should not create case when timer starts a process that does not start a case`() {
        val jobId = timerJobId(TIMER_PROCESS_WITHOUT_CASE)

        assertThatThrownBy { managementService.executeJob(jobId) }
            .hasMessageContaining("Failed to resolve document id")
    }

    private fun timerJobId(processDefinitionKey: String): String =
        managementService.createJobQuery()
            .processDefinitionKey(processDefinitionKey)
            .timers()
            .singleResult()
            .id

    private companion object {
        const val CASE_KEY = "house"
        const val TIMER_PROCESS_WITH_CASE = "timer-start-process"
        const val TIMER_PROCESS_WITHOUT_CASE = "timer-start-process-without-case"
    }
}
