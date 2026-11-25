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
package com.ritense.buildingblock.service

import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.form.domain.FormProcessLink
import com.ritense.form.exception.FormDefinitionInUseException
import com.ritense.form.repository.FormDefinitionRepository
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import org.zalando.problem.Status
import java.time.LocalDateTime
import java.util.UUID

@Transactional
class BuildingBlockFormDefinitionDeletionIT : BaseIntegrationTest() {

    @Autowired
    lateinit var buildingBlockFormDefinitionService: BuildingBlockFormDefinitionService

    @Autowired
    lateinit var formDefinitionRepository: FormDefinitionRepository

    @PersistenceContext
    lateinit var entityManager: EntityManager

    @Autowired
    lateinit var processLinkRepository: ProcessLinkRepository

    @Test
    fun `should not delete a building block form that a form process link uses`() {
        val definitionId = createDraftDefinition()
        val formId = createForm(definitionId)
        processLinkRepository.saveAndFlush(
            FormProcessLink(
                id = UUID.randomUUID(),
                processDefinitionId = "linked-process:1:${UUID.randomUUID()}",
                activityId = "start-event",
                activityType = ActivityTypeWithEventName.START_EVENT_START,
                formDefinitionId = formId,
            )
        )

        val exception = assertThrows<FormDefinitionInUseException> {
            buildingBlockFormDefinitionService.deleteFormDefinition(definitionId, formId)
        }

        assertThat(exception.status).isEqualTo(Status.CONFLICT)
        assertThat(formDefinitionRepository.existsById(formId)).isTrue()
    }

    @Test
    fun `should delete a building block form that nothing links to`() {
        val definitionId = createDraftDefinition()
        val formId = createForm(definitionId)

        buildingBlockFormDefinitionService.deleteFormDefinition(definitionId, formId)

        formDefinitionRepository.flush()
        assertThat(formDefinitionRepository.findById(formId)).isEmpty
    }

    private fun createDraftDefinition(): BuildingBlockDefinitionId {
        val definitionId = BuildingBlockDefinitionId.of("form-delete-${UUID.randomUUID().toString().take(8)}", "1.0.0")
        buildingBlockDefinitionRepository.saveAndFlush(
            BuildingBlockDefinition(
                id = definitionId,
                name = "Form delete block",
                description = "description",
                createdBy = "tester",
                createdDate = LocalDateTime.now(),
                basedOnVersionTag = null,
                final = false
            )
        )
        return definitionId
    }

    private fun createForm(definitionId: BuildingBlockDefinitionId): UUID {
        val formId = buildingBlockFormDefinitionService.createFormDefinition(definitionId, "linked-form", "{}").id
        entityManager.flush()
        entityManager.clear()
        return formId
    }
}
