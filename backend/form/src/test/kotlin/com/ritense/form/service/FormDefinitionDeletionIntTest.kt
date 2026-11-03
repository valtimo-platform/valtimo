/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
 *
 *  Licensed under EUPL, Version 1.2 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" basis,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

package com.ritense.form.service

import com.ritense.form.BaseIntegrationTest
import com.ritense.form.domain.FormProcessLink
import com.ritense.form.domain.request.CreateFormDefinitionRequest
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import org.zalando.problem.Status
import org.zalando.problem.ThrowableProblem
import java.util.UUID

@Transactional
internal class FormDefinitionDeletionIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var formDefinitionService: FormDefinitionService

    @Autowired
    lateinit var processLinkRepository: ProcessLinkRepository

    @Test
    fun `should not delete a form definition that a form process link uses`() {
        val caseDefinitionId = CaseDefinitionId.of("person", "1.0.0")
        val formId = formDefinitionService.createFormDefinition(
            caseDefinitionId,
            CreateFormDefinitionRequest("linked-form", "{}", false)
        ).id
        processLinkRepository.saveAndFlush(
            FormProcessLink(
                id = UUID.randomUUID(),
                processDefinitionId = "linked-process:1:${UUID.randomUUID()}",
                activityId = "start-event",
                activityType = ActivityTypeWithEventName.START_EVENT_START,
                formDefinitionId = formId,
            )
        )

        val exception = assertThrows<ThrowableProblem> {
            formDefinitionService.deleteFormDefinition(caseDefinitionId, formId)
        }

        assertThat(exception.status).isEqualTo(Status.CONFLICT)
        assertThat(formDefinitionRepository.existsById(formId)).isTrue()
    }
}
