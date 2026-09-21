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

package com.ritense.processlink.importer

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.importer.ImportRequest
import com.ritense.processlink.BaseIntegrationTest
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.domain.TestProcessLink
import com.ritense.processlink.domain.TestProcessLinkCreateRequestDto
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional

/**
 * Imports process links for the autodeployed `test-system-process`, which is not part of a case
 * definition. The imported file is the complete set of process links for the process.
 */
@Transactional
class GlobalProcessLinkImporterIntTest @Autowired constructor(
    private val globalProcessLinkImporter: GlobalProcessLinkImporter,
    private val processLinkService: ProcessLinkService,
    private val repositoryService: OperatonRepositoryService,
) : BaseIntegrationTest() {

    @Test
    fun `should update the process link that is in the imported file`(): Unit = runWithoutAuthorization {
        globalProcessLinkImporter.import(importRequest(json("test-user-task", "imported value")))

        val processLinks = processLinkService.getProcessLinks(processDefinitionId())
        assertThat(processLinks).hasSize(1)
        assertThat((processLinks.single() as TestProcessLink).someValue).isEqualTo("imported value")
    }

    @Test
    fun `should delete a process link that is not in the imported file`(): Unit = runWithoutAuthorization {
        val addedLink = processLinkService.createProcessLink(
            TestProcessLinkCreateRequestDto(
                processDefinitionId = processDefinitionId(),
                activityId = "another-user-task",
                activityType = ActivityTypeWithEventName.USER_TASK_CREATE,
                someValue = "added through the interface",
            ),
            null,
        )
        assertThat(processLinkService.getProcessLinks(processDefinitionId())).hasSize(2)

        globalProcessLinkImporter.import(importRequest(json("test-user-task", "imported value")))

        val processLinks = processLinkService.getProcessLinks(processDefinitionId())
        assertThat(processLinks).hasSize(1)
        assertThat(processLinks.single().activityId).isEqualTo("test-user-task")
        assertThat(processLinks.map { it.id }).doesNotContain(addedLink.id)
    }

    @Test
    fun `should delete every process link when the imported file is empty`(): Unit = runWithoutAuthorization {
        globalProcessLinkImporter.import(importRequest("[]"))

        assertThat(processLinkService.getProcessLinks(processDefinitionId())).isEmpty()
    }

    /**
     * A process definition can hold only one process link per activity, so an activity type that
     * changed in the source has to replace the process link of the target instead of updating it.
     */
    @Test
    fun `should replace a process link of which the activity type changed`(): Unit = runWithoutAuthorization {
        val existingLink = processLinkService.getProcessLinks(processDefinitionId()).single()
        processLinkService.deleteProcessLink(existingLink.id)
        processLinkService.createProcessLink(
            TestProcessLinkCreateRequestDto(
                processDefinitionId = processDefinitionId(),
                activityId = "test-user-task",
                activityType = ActivityTypeWithEventName.USER_TASK_COMPLETE,
                someValue = "before the import",
            ),
            null,
        )

        globalProcessLinkImporter.import(importRequest(json("test-user-task", "imported value")))

        val processLinks = processLinkService.getProcessLinks(processDefinitionId())
        assertThat(processLinks).hasSize(1)
        assertThat(processLinks.single().activityType).isEqualTo(ActivityTypeWithEventName.USER_TASK_CREATE)
        assertThat((processLinks.single() as TestProcessLink).someValue).isEqualTo("imported value")
    }

    private fun importRequest(content: String) = ImportRequest(FILE_NAME, content.toByteArray(Charsets.UTF_8))

    private fun processDefinitionId(): String =
        requireNotNull(repositoryService.findLatestProcessDefinition(PROCESS_DEFINITION_KEY)).id

    private fun json(activityId: String, someValue: String) = """
        [
            {
                "activityId": "$activityId",
                "activityType": "${ActivityTypeWithEventName.USER_TASK_CREATE.value}",
                "processLinkType": "test",
                "someValue": "$someValue"
            }
        ]
    """.trimIndent()

    private companion object {
        const val PROCESS_DEFINITION_KEY = "test-system-process"
        const val FILE_NAME = "/global/process-link/$PROCESS_DEFINITION_KEY.process-link.json"
    }
}
