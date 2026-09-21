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

package com.ritense.processlink

import com.ritense.valtimo.processautofill.domain.AutofillModificationType
import com.ritense.valtimo.processautofill.repository.ProcessDefinitionAutofillRepository
import com.ritense.valtimo.processautofill.service.AutofillModification
import com.ritense.valtimo.processautofill.service.ProcessDefinitionAutofillService
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

class ProcessDefinitionAutofillServiceIntegrationTest : BaseIntegrationTest() {

    @Autowired
    lateinit var processDefinitionAutofillService: ProcessDefinitionAutofillService

    @Autowired
    lateinit var processDefinitionAutofillRepository: ProcessDefinitionAutofillRepository

    @AfterEach
    fun cleanup() {
        processDefinitionAutofillRepository.deleteAll()
    }

    @Test
    fun `should inject ProcessDefinitionAutofillService`() {
        assertNotNull(processDefinitionAutofillService)
    }

    @Test
    fun `should query autofill records`() {
        val result = processDefinitionAutofillService.findByProcessDefinitionId("non-existent-id")
        assertNotNull(result)
    }

    @Test
    fun `should save and delete autofill record by activity`() {
        val processDefinitionId = "test-process-def-123"
        val activityId = "service-task-1"

        processDefinitionAutofillService.saveAutofillRecords(
            processDefinitionId,
            listOf(
                AutofillModification(
                    activityId = activityId,
                    modificationType = AutofillModificationType.SERVICE_TASK_EXPRESSION,
                    appliedValue = "\${null}"
                ),
                AutofillModification(
                    activityId = "other-task",
                    modificationType = AutofillModificationType.TIMER_DURATION,
                    appliedValue = "PT60S"
                )
            )
        )

        var records = processDefinitionAutofillService.findByProcessDefinitionId(processDefinitionId)
        assertEquals(2, records.size)

        processDefinitionAutofillService.deleteByProcessDefinitionIdAndActivityId(
            processDefinitionId, activityId
        )

        records = processDefinitionAutofillService.findByProcessDefinitionId(processDefinitionId)
        assertEquals(1, records.size)
        assertEquals("other-task", records[0].activityId)
    }

    @Test
    fun `should clean up autofill records when deleting all for process`() {
        val processDefinitionId = "test-cleanup-process"

        processDefinitionAutofillService.saveAutofillRecords(
            processDefinitionId,
            listOf(
                AutofillModification(
                    activityId = "task-1",
                    modificationType = AutofillModificationType.SERVICE_TASK_EXPRESSION,
                    appliedValue = "\${null}"
                ),
                AutofillModification(
                    activityId = "task-2",
                    modificationType = AutofillModificationType.SERVICE_TASK_EXPRESSION,
                    appliedValue = "\${null}"
                )
            )
        )

        assertEquals(2, processDefinitionAutofillService.findByProcessDefinitionId(processDefinitionId).size)

        // Saving empty list should delete all previous records
        processDefinitionAutofillService.saveAutofillRecords(processDefinitionId, emptyList())

        assertEquals(0, processDefinitionAutofillService.findByProcessDefinitionId(processDefinitionId).size)
    }
}
