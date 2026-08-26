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

package com.ritense.processlink.service

import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.domain.AnotherTestProcessLink
import com.ritense.processlink.domain.ProcessLink
import com.ritense.processlink.domain.TestProcessLink
import com.ritense.processlink.event.ProcessLinkDeletedEvent
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.contract.case_.CaseDefinitionChecker
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.context.ApplicationEventPublisher
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class ProcessLinkServiceTest {

    @Mock
    lateinit var processLinkRepository: ProcessLinkRepository

    @Mock
    lateinit var operatonRepositoryService: OperatonRepositoryService

    @Mock
    lateinit var caseDefinitionChecker: CaseDefinitionChecker

    @Mock
    lateinit var buildingBlockDefinitionChecker: BuildingBlockDefinitionChecker

    @Mock
    lateinit var applicationEventPublisher: ApplicationEventPublisher

    private lateinit var processLinkService: ProcessLinkService

    @BeforeEach
    fun before() {
        processLinkService = ProcessLinkService(
            processLinkRepository,
            emptyList(),
            emptyList(),
            operatonRepositoryService,
            caseDefinitionChecker,
            buildingBlockDefinitionChecker,
            applicationEventPublisher,
        )
    }

    @Test
    fun `deleteProcessLinksForProcessDefinition publishes a deleted event per process link type`() {
        whenever(processLinkRepository.findByProcessDefinitionId(PROCESS_DEFINITION_ID)).thenReturn(
            listOf(
                testProcessLink("Task_1"),
                testProcessLink("Task_2"),
                anotherTestProcessLink("Task_3"),
            )
        )

        processLinkService.deleteProcessLinksForProcessDefinition(PROCESS_DEFINITION_ID)

        verify(processLinkRepository).deleteAllByProcessDefinitionId(PROCESS_DEFINITION_ID)
        val captor = argumentCaptor<ProcessLinkDeletedEvent>()
        verify(applicationEventPublisher, times(2)).publishEvent(captor.capture())
        assertThat(captor.allValues.map { it.processLinkType }).containsExactlyInAnyOrder(
            TestProcessLink.PROCESS_LINK_TYPE_TEST,
            AnotherTestProcessLink.PROCESS_LINK_TYPE,
        )
        assertThat(captor.allValues.map { it.processDefinitionId }).containsOnly(PROCESS_DEFINITION_ID)
    }

    @Test
    fun `deleteProcessLinksForProcessDefinition publishes no event when there are no process links`() {
        whenever(processLinkRepository.findByProcessDefinitionId(PROCESS_DEFINITION_ID)).thenReturn(emptyList())

        processLinkService.deleteProcessLinksForProcessDefinition(PROCESS_DEFINITION_ID)

        verify(processLinkRepository).deleteAllByProcessDefinitionId(PROCESS_DEFINITION_ID)
        verify(applicationEventPublisher, never()).publishEvent(any<ProcessLinkDeletedEvent>())
    }

    private fun testProcessLink(activityId: String): ProcessLink = TestProcessLink(
        id = UUID.randomUUID(),
        processDefinitionId = PROCESS_DEFINITION_ID,
        activityId = activityId,
        activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
    )

    private fun anotherTestProcessLink(activityId: String): ProcessLink = AnotherTestProcessLink(
        id = UUID.randomUUID(),
        processDefinitionId = PROCESS_DEFINITION_ID,
        activityId = activityId,
        activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
    )

    companion object {
        private const val PROCESS_DEFINITION_ID = "pd-1"
    }
}
