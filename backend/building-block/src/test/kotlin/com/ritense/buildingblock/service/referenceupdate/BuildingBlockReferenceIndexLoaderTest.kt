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
package com.ritense.buildingblock.service.referenceupdate

import com.ritense.buildingblock.domain.CaseDefinitionBuildingBlockLink
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinition
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinitionId
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.repository.BuildingBlockProcessLinkRepository
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.repository.ProcessDefinitionCaseDefinitionRepository
import com.ritense.processlink.domain.ActivityTypeWithEventName.CALL_ACTIVITY_START
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doAnswer
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.mockito.stubbing.Answer
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.repository.ProcessDefinition
import org.operaton.bpm.engine.repository.ProcessDefinitionQuery
import java.util.UUID

class BuildingBlockReferenceIndexLoaderTest {

    private val child = BuildingBlockDefinitionId.of("send-email", "1.0.0")
    private val owner = BuildingBlockDefinitionId.of("notify", "1.0.0")

    private val buildingBlockProcessLinkRepository = mock<BuildingBlockProcessLinkRepository>()
    private val caseDefinitionBuildingBlockLinkRepository = mock<CaseDefinitionBuildingBlockLinkRepository>()
    private val processDefinitionBuildingBlockDefinitionRepository = mock<ProcessDefinitionBuildingBlockDefinitionRepository>()
    private val queriedIds = mutableListOf<List<String>>()

    @Test
    fun `with a child key only references to that key are queried`() {
        val owned = processLink("notify-process:1")
        val caseLink = CaseDefinitionBuildingBlockLink(caseDefinitionId = CaseDefinitionId.of("moving", "1.0.0"), buildingBlockDefinitionId = child)
        own("notify-process:1")
        buildingBlockProcessLinkRepository.stub(byKey = listOf(owned))
        caseDefinitionBuildingBlockLinkRepository.stub(byKey = listOf(caseLink))

        val index = loader(mapOf("notify-process:1" to "notify-process")).load(child.key)

        verify(buildingBlockProcessLinkRepository).findAllByBuildingBlockDefinitionIdKey(child.key)
        verify(buildingBlockProcessLinkRepository, never()).findAll()
        verify(caseDefinitionBuildingBlockLinkRepository).findAllByBuildingBlockDefinitionIdKey(child.key)
        verify(caseDefinitionBuildingBlockLinkRepository, never()).findAll()
        assertThat(index.references.map { it.linkId }).containsExactly(owned.id, caseLink.id)
        assertThat(index.references.first().location).isEqualTo(ProcessLinkLocation("notify-process", "call-send-email"))
        assertThat(index.references.first().container).isEqualTo(ReferenceContainer.of(owner))
        assertThat(index.references.last().location).isEqualTo(CaseLinkLocation(child.key))
    }

    @Test
    fun `without a child key all references are queried`() {
        own("notify-process:1")
        buildingBlockProcessLinkRepository.stub(all = listOf(processLink("notify-process:1")))
        caseDefinitionBuildingBlockLinkRepository.stub(all = emptyList())

        val index = loader(mapOf("notify-process:1" to "notify-process")).load()

        verify(buildingBlockProcessLinkRepository).findAll()
        verify(buildingBlockProcessLinkRepository, never()).findAllByBuildingBlockDefinitionIdKey(any())
        verify(caseDefinitionBuildingBlockLinkRepository).findAll()
        verify(caseDefinitionBuildingBlockLinkRepository, never()).findAllByBuildingBlockDefinitionIdKey(any())
        assertThat(index.references).hasSize(1)
    }

    @Test
    fun `unowned links and links whose process definition is missing are skipped`() {
        val owned = processLink("notify-process:1")
        own("notify-process:1", "deleted-process:1")
        buildingBlockProcessLinkRepository.stub(
            all = listOf(owned, processLink("unowned-process:1"), processLink("deleted-process:1"))
        )
        caseDefinitionBuildingBlockLinkRepository.stub(all = emptyList())

        val index = loader(mapOf("notify-process:1" to "notify-process", "unowned-process:1" to "unowned-process")).load()

        assertThat(index.references.map { it.linkId }).containsExactly(owned.id)
        assertThat(queriedIds.flatten()).containsExactlyInAnyOrder("notify-process:1", "deleted-process:1")
    }

    @Test
    fun `process definitions are queried in chunks of 500`() {
        val processDefinitionIds = (1..1001).map { "process-$it:1" }
        own(*processDefinitionIds.toTypedArray())
        buildingBlockProcessLinkRepository.stub(all = processDefinitionIds.map { processLink(it) })
        caseDefinitionBuildingBlockLinkRepository.stub(all = emptyList())

        val index = loader(processDefinitionIds.associateWith { it.substringBefore(':') }).load()

        assertThat(queriedIds.map { it.size }).containsExactly(500, 500, 1)
        assertThat(queriedIds.flatten()).containsExactlyInAnyOrderElementsOf(processDefinitionIds)
        assertThat(index.references).hasSize(1001)
    }

    private fun own(vararg processDefinitionIds: String) {
        val owners = processDefinitionIds.map {
            ProcessDefinitionBuildingBlockDefinition(ProcessDefinitionBuildingBlockDefinitionId(ProcessDefinitionId(it), owner))
        }
        whenever(processDefinitionBuildingBlockDefinitionRepository.findAll()).thenReturn(owners)
    }

    private fun BuildingBlockProcessLinkRepository.stub(
        all: List<BuildingBlockProcessLink> = emptyList(),
        byKey: List<BuildingBlockProcessLink> = emptyList(),
    ) {
        whenever(findAll()).thenReturn(all)
        whenever(findAllByBuildingBlockDefinitionIdKey(any())).thenReturn(byKey)
    }

    private fun CaseDefinitionBuildingBlockLinkRepository.stub(
        all: List<CaseDefinitionBuildingBlockLink> = emptyList(),
        byKey: List<CaseDefinitionBuildingBlockLink> = emptyList(),
    ) {
        whenever(findAll()).thenReturn(all)
        whenever(findAllByBuildingBlockDefinitionIdKey(any())).thenReturn(byKey)
    }

    private fun processLink(processDefinitionId: String) = BuildingBlockProcessLink(
        id = UUID.randomUUID(),
        processDefinitionId = processDefinitionId,
        activityId = "call-send-email",
        activityType = CALL_ACTIVITY_START,
        buildingBlockDefinitionId = child,
        pluginConfigurationMappings = emptyMap(),
    )

    /** [processDefinitionKeys]: process definitions the engine knows, id to key. */
    private fun loader(processDefinitionKeys: Map<String, String>) = BuildingBlockReferenceIndexLoader(
        buildingBlockDefinitionRepository = mock<BuildingBlockDefinitionRepository> { on { findAll() } doReturn mutableListOf() },
        caseDefinitionRepository = mock<CaseDefinitionRepository> { on { findAll() } doReturn mutableListOf() },
        buildingBlockProcessLinkRepository = buildingBlockProcessLinkRepository,
        caseDefinitionBuildingBlockLinkRepository = caseDefinitionBuildingBlockLinkRepository,
        processDefinitionBuildingBlockDefinitionRepository = processDefinitionBuildingBlockDefinitionRepository,
        processDefinitionCaseDefinitionRepository = mock<ProcessDefinitionCaseDefinitionRepository> {
            on { findAll() } doReturn mutableListOf()
        },
        repositoryService = mock<RepositoryService> {
            on { createProcessDefinitionQuery() } doAnswer { processDefinitionQuery(processDefinitionKeys) }
        },
    )

    private fun processDefinitionQuery(processDefinitionKeys: Map<String, String>): ProcessDefinitionQuery {
        var ids = emptyList<String>()
        return mock<ProcessDefinitionQuery>(defaultAnswer = Answer { invocation ->
            when (invocation.method.name) {
                "processDefinitionIdIn" -> {
                    ids = invocation.arguments.flatMap { argument ->
                        (argument as? Array<*>)?.map { it as String } ?: listOf(argument as String)
                    }
                    queriedIds += ids
                    invocation.mock
                }
                "list" -> ids.mapNotNull { id -> processDefinitionKeys[id]?.let { processDefinition(id, it) } }
                else -> null
            }
        })
    }

    private fun processDefinition(id: String, key: String) = mock<ProcessDefinition> {
        on { this.id } doReturn id
        on { this.key } doReturn key
    }
}
