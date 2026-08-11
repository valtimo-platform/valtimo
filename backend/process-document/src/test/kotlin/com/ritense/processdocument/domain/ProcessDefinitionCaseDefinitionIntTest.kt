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

package com.ritense.processdocument.domain

import com.ritense.processdocument.BaseIntegrationTest
import com.ritense.processdocument.repository.ProcessDefinitionCaseDefinitionRepository
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional

@Transactional
class ProcessDefinitionCaseDefinitionIntTest @Autowired constructor(
    private val repository: ProcessDefinitionCaseDefinitionRepository
) : BaseIntegrationTest() {

    @Test
    fun `should load entity when process definition does not exist`() {
        val nonExistentProcessDefinitionId = "non-existent-process:1:12345"
        val caseDefinitionId = CaseDefinitionId("house", "1.0.0")

        val orphanedLink = ProcessDefinitionCaseDefinition(
            id = ProcessDefinitionCaseDefinitionId(
                processDefinitionId = ProcessDefinitionId(nonExistentProcessDefinitionId),
                caseDefinitionId = caseDefinitionId
            ),
            canInitializeDocument = false,
            startableByUser = true
        )
        repository.saveAndFlush(orphanedLink)

        val loaded = repository.findByIdCaseDefinitionId(caseDefinitionId)

        val orphanedEntity = loaded.find { it.id.processDefinitionId.id == nonExistentProcessDefinitionId }
        assertThat(orphanedEntity).isNotNull
        assertThat(orphanedEntity!!.draft).isFalse
        assertThat(orphanedEntity.processDefinitionName).isNull()
        assertThat(orphanedEntity.processDefinitionKey).isNull()
    }
}
