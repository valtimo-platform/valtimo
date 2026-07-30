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

import com.ritense.importer.ImportRequest
import com.ritense.importer.ValtimoImportTypes.Companion.GLOBAL_PROCESS_DEFINITION
import com.ritense.processdocument.service.ProcessDefinitionCaseDefinitionService
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.domain.ProcessLink
import com.ritense.processlink.importer.ProcessLinkImporterTest.TestProcessLinkDeployDto
import com.ritense.processlink.mapper.ProcessLinkMapper
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.Mockito
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.context.ApplicationEventPublisher
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class GlobalProcessLinkImporterTest {

    @Mock
    lateinit var processLinkService: ProcessLinkService

    @Mock
    lateinit var repositoryService: OperatonRepositoryService

    @Mock
    lateinit var processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService

    @Mock
    lateinit var applicationEventPublisher: ApplicationEventPublisher

    private lateinit var importer: GlobalProcessLinkImporter

    private val objectMapper = MapperSingleton.get().also {
        it.registerSubtypes(TestProcessLinkDeployDto::class.java)
    }

    @BeforeEach
    fun before() {
        importer = GlobalProcessLinkImporter(
            processLinkService,
            repositoryService,
            processDefinitionCaseDefinitionService,
            objectMapper,
            emptyList<ProcessLinkMapper>(),
            applicationEventPublisher,
        )
    }

    @Test
    fun `should be of type 'globalprocesslink'`() {
        assertThat(importer.type()).isEqualTo("globalprocesslink")
    }

    @Test
    fun `should depend on 'globalprocessdefinition' type`() {
        whenever(processLinkService.getImporterDependsOnTypes()).thenReturn(setOf("x"))

        assertThat(importer.dependsOn()).isEqualTo(setOf(GLOBAL_PROCESS_DEFINITION, "x"))
    }

    @Test
    fun `should support global processlink fileName only`() {
        assertThat(importer.supports(FILENAME)).isTrue()
        assertThat(importer.supports("/process-link/my.process-link.json")).isFalse()
    }

    @Test
    fun `should not be part of a case definition`() {
        assertThat(importer.partOfCaseDefinition()).isFalse()
    }

    @Test
    fun `import deletes process links that are not in the imported file`() {
        val staleLink = processLink("Task_stale", ActivityTypeWithEventName.SERVICE_TASK_START)
        val keptLink = processLink("Task_1", ActivityTypeWithEventName.SERVICE_TASK_START)
        mockProcessDefinition(listOf(staleLink, keptLink))

        importer.import(ImportRequest(FILENAME, singleLinkFor("Task_1").toByteArray()))

        verify(processLinkService).deleteProcessLink(staleLink.id)
        verify(processLinkService, never()).deleteProcessLink(keptLink.id)
    }

    @Test
    fun `import keeps a process link when the same activity is in the imported file`() {
        val keptLink = processLink("Task_1", ActivityTypeWithEventName.SERVICE_TASK_START)
        mockProcessDefinition(listOf(keptLink))

        importer.import(ImportRequest(FILENAME, singleLinkFor("Task_1").toByteArray()))

        verify(processLinkService, never()).deleteProcessLink(any())
    }

    @Test
    fun `import deletes a process link of the same activity with another activity type`() {
        val otherActivityTypeLink = processLink("Task_1", ActivityTypeWithEventName.USER_TASK_CREATE)
        mockProcessDefinition(listOf(otherActivityTypeLink))

        importer.import(ImportRequest(FILENAME, singleLinkFor("Task_1").toByteArray()))

        verify(processLinkService).deleteProcessLink(otherActivityTypeLink.id)
    }

    private fun mockProcessDefinition(existingLinks: List<ProcessLink>) {
        val processDefinition = mock<OperatonProcessDefinition>()
        whenever(processDefinition.id).thenReturn(PROCESS_DEFINITION_ID)
        whenever(repositoryService.findLatestProcessDefinition(PROCESS_DEFINITION_KEY))
            .thenReturn(processDefinition)
        whenever(processLinkService.getProcessLinks(PROCESS_DEFINITION_ID)).thenReturn(existingLinks)
        whenever(processLinkService.getProcessLinkMapper("test-type"))
            .thenReturn(ProcessLinkImporterTest.TestMapper())
        doReturn(mock<ProcessLink>()).whenever(processLinkService).createProcessLink(any(), anyOrNull())
    }

    private fun processLink(activityId: String, activityType: ActivityTypeWithEventName): ProcessLink {
        val processLink = mock<ProcessLink>()
        // The id is only read when the link is deleted
        Mockito.lenient().`when`(processLink.id).thenReturn(UUID.randomUUID())
        whenever(processLink.activityId).thenReturn(activityId)
        whenever(processLink.activityType).thenReturn(activityType)
        return processLink
    }

    private fun singleLinkFor(activityId: String) = """
        [
          {
            "activityId": "$activityId",
            "activityType": "bpmn:ServiceTask:start",
            "processLinkType": "test-type"
          }
        ]
    """.trimIndent()

    private companion object {
        const val PROCESS_DEFINITION_KEY = "my"
        const val PROCESS_DEFINITION_ID = "pd-1"
        const val FILENAME = "/global/process-link/$PROCESS_DEFINITION_KEY.process-link.json"
    }
}
