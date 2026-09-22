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

package com.ritense.buildingblock.processlink.service

import com.ritense.buildingblock.domain.CaseDefinitionBuildingBlockLink
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.repository.BuildingBlockProcessLinkRepository
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import java.util.UUID

class DefaultBuildingBlockPluginMappingUsageFinderTest {

    private lateinit var processLinkRepository: BuildingBlockProcessLinkRepository
    private lateinit var caseLinkRepository: CaseDefinitionBuildingBlockLinkRepository
    private lateinit var finder: DefaultBuildingBlockPluginMappingUsageFinder

    private val configurationId = UUID.randomUUID()
    private val otherConfigurationId = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        processLinkRepository = mock()
        caseLinkRepository = mock()
        whenever(processLinkRepository.findAll()).thenReturn(emptyList())
        whenever(caseLinkRepository.findAll()).thenReturn(emptyList())
        finder = DefaultBuildingBlockPluginMappingUsageFinder(processLinkRepository, caseLinkRepository)
    }

    @Test
    fun `reports a call-activity process link whose mappings reference the configuration`() {
        val link = processLink(
            mappings = mapOf(
                "external-plugin:case-summary@0.1.0" to configurationId,
                "zakenapi" to otherConfigurationId,
            )
        )
        whenever(processLinkRepository.findAll()).thenReturn(listOf(link))

        val usages = finder.findUsages(configurationId)

        assertThat(usages).hasSize(1)
        val usage = usages[0]
        assertThat(usage.mappingKey).isEqualTo("external-plugin:case-summary@0.1.0")
        assertThat(usage.buildingBlockDefinitionKey).isEqualTo("send-notification")
        assertThat(usage.processLinkId).isEqualTo(link.id)
        assertThat(usage.processDefinitionId).isEqualTo("bezwaar:3:abc")
        assertThat(usage.activityId).isEqualTo("CallSendNotification")
        assertThat(usage.caseDefinitionKey).isNull()
    }

    @Test
    fun `reports a case-definition link whose mappings reference the configuration`() {
        val caseLink = CaseDefinitionBuildingBlockLink(
            caseDefinitionId = CaseDefinitionId("bezwaar", "1.0.1"),
            buildingBlockDefinitionId = BuildingBlockDefinitionId("send-notification", "2.0.0"),
            pluginConfigurationMappings = mapOf("external-plugin:case-summary@0.1.0" to configurationId),
        )
        whenever(caseLinkRepository.findAll()).thenReturn(listOf(caseLink))

        val usages = finder.findUsages(configurationId)

        assertThat(usages).hasSize(1)
        val usage = usages[0]
        assertThat(usage.mappingKey).isEqualTo("external-plugin:case-summary@0.1.0")
        assertThat(usage.buildingBlockDefinitionKey).isEqualTo("send-notification")
        assertThat(usage.caseDefinitionKey).isEqualTo("bezwaar")
        assertThat(usage.caseDefinitionVersionTag).isEqualTo("1.0.1")
        assertThat(usage.processDefinitionId).isNull()
    }

    @Test
    fun `mappings referencing other configurations are not reported`() {
        whenever(processLinkRepository.findAll()).thenReturn(
            listOf(processLink(mappings = mapOf("zakenapi" to otherConfigurationId)))
        )
        whenever(caseLinkRepository.findAll()).thenReturn(
            listOf(
                CaseDefinitionBuildingBlockLink(
                    caseDefinitionId = CaseDefinitionId("bezwaar", "1.0.1"),
                    buildingBlockDefinitionId = BuildingBlockDefinitionId("send-notification", "2.0.0"),
                    pluginConfigurationMappings = mapOf("zakenapi" to otherConfigurationId),
                )
            )
        )

        assertThat(finder.findUsages(configurationId)).isEmpty()
    }

    private fun processLink(mappings: Map<String, UUID>): BuildingBlockProcessLink = BuildingBlockProcessLink(
        id = UUID.randomUUID(),
        processDefinitionId = "bezwaar:3:abc",
        activityId = "CallSendNotification",
        activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
        buildingBlockDefinitionId = BuildingBlockDefinitionId("send-notification", "2.0.0"),
        pluginConfigurationMappings = mappings,
    )
}
