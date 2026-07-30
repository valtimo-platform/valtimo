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
import com.ritense.exporter.ExportService
import com.ritense.exporter.request.GlobalProcessDefinitionExportRequest
import com.ritense.importer.ImportService
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
import java.io.ByteArrayInputStream

/**
 * Exports the autodeployed `test-system-process` and imports the resulting package again, which is
 * how a process is moved to another environment.
 */
@Transactional
class GlobalProcessDefinitionRoundTripIntTest @Autowired constructor(
    private val exportService: ExportService,
    private val importService: ImportService,
    private val processLinkService: ProcessLinkService,
    private val repositoryService: OperatonRepositoryService,
) : BaseIntegrationTest() {

    @Test
    fun `should restore the process links of the package`(): Unit = runWithoutAuthorization {
        val exported = export()
        val originalLinks = processLinkService.getProcessLinks(processDefinitionId())
        assertThat(originalLinks).hasSize(1)

        processLinkService.deleteProcessLink(originalLinks.single().id)
        assertThat(processLinkService.getProcessLinks(processDefinitionId())).isEmpty()

        importService.importGlobal(ByteArrayInputStream(exported))

        val importedLinks = processLinkService.getProcessLinks(processDefinitionId())
        assertThat(importedLinks).hasSize(1)
        assertThat(importedLinks.single().activityId).isEqualTo(originalLinks.single().activityId)
        assertThat(importedLinks.single().activityType).isEqualTo(originalLinks.single().activityType)
        assertThat((importedLinks.single() as TestProcessLink).someValue)
            .isEqualTo((originalLinks.single() as TestProcessLink).someValue)
    }

    @Test
    fun `should remove a process link that was added after the export`(): Unit = runWithoutAuthorization {
        val exported = export()
        processLinkService.createProcessLink(
            TestProcessLinkCreateRequestDto(
                processDefinitionId = processDefinitionId(),
                activityId = "another-user-task",
                activityType = ActivityTypeWithEventName.USER_TASK_CREATE,
                someValue = "added after the export",
            ),
            null,
        )
        assertThat(processLinkService.getProcessLinks(processDefinitionId())).hasSize(2)

        importService.importGlobal(ByteArrayInputStream(exported))

        val processLinks = processLinkService.getProcessLinks(processDefinitionId())
        assertThat(processLinks).hasSize(1)
        assertThat(processLinks.single().activityId).isEqualTo("test-user-task")
    }

    private fun export(): ByteArray =
        exportService.export(GlobalProcessDefinitionExportRequest(processDefinitionId())).toByteArray()

    private fun processDefinitionId(): String =
        requireNotNull(repositoryService.findLatestProcessDefinition(PROCESS_DEFINITION_KEY)).id

    private companion object {
        const val PROCESS_DEFINITION_KEY = "test-system-process"
    }
}
