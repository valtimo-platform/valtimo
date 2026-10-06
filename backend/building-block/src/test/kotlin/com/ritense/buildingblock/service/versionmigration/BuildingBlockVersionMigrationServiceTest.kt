/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.buildingblock.service.versionmigration

import com.ritense.buildingblock.exception.BuildingBlockVersionMigrationException
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionMigrationContainerType.BUILDING_BLOCK
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionMigrationContainerType.CASE
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionMigrationExecuteRequestDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionMigrationPreviewRequestDto
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.verifyNoInteractions
import org.semver4j.Semver
import java.util.UUID

class BuildingBlockVersionMigrationServiceTest {

    private val source = BuildingBlockDefinitionId.of("send-email", "1.0.0")
    private val target = BuildingBlockDefinitionId.of("send-email", "1.0.1")
    private val case = MigrationContainer(CASE, "moving", Semver.parse("1.3.0")!!)

    private val index = BuildingBlockUsageIndex(
        references = listOf(
            UsageReference(
                container = case,
                location = CaseLinkLocation(source.key),
                child = source,
                linkId = UUID.randomUUID(),
                processDefinitionId = null,
                inputMappings = emptyList(),
                outputMappings = emptyList(),
                pluginConfigurationMappings = emptyMap(),
            )
        ),
        containers = listOf(
            MigrationContainerInfo(MigrationContainer.of(source), final = true, basedOnVersionTag = null, name = "Send email"),
            MigrationContainerInfo(MigrationContainer.of(target), final = true, basedOnVersionTag = null, name = "Send email"),
            MigrationContainerInfo(case, final = false, basedOnVersionTag = null, name = "Moving"),
        ),
    )
    private val usageIndexLoader = mock<BuildingBlockUsageIndexLoader> {
        on { load(anyOrNull()) } doReturn index
    }
    private val checker = mock<BuildingBlockDefinitionChecker> {
        on { canUpdateGlobalConfiguration() } doReturn false
    }
    private val buildingBlockManagementService = mock<com.ritense.buildingblock.service.BuildingBlockManagementService>()
    private val caseDefinitionService = mock<com.ritense.case.service.CaseDefinitionService>()
    private val operatonProcessService = mock<com.ritense.valtimo.service.OperatonProcessService>()

    private val service = BuildingBlockVersionMigrationService(
        usageIndexLoader = usageIndexLoader,
        buildingBlockManagementService = buildingBlockManagementService,
        caseDefinitionService = caseDefinitionService,
        buildingBlockFieldService = mock { on { getFields(any()) } doReturn emptyList() },
        buildingBlockPluginDefinitionService = mock { on { getPluginDefinitionKeysForBuildingBlock(any()) } doReturn emptySet() },
        buildingBlockDefinitionChecker = checker,
        operatonProcessService = operatonProcessService,
        repositoryService = mock(),
        processDefinitionBuildingBlockDefinitionRepository = mock(),
        processDefinitionCaseDefinitionRepository = mock(),
        processLinkRepository = mock(),
        buildingBlockProcessLinkRepository = mock(),
        caseDefinitionBuildingBlockLinkRepository = mock(),
        pluginService = mock(),
        authorizationService = mock(),
        entityManager = mock(),
    )

    @Test
    fun `the preview marks every chain not migratable where drafts are not allowed`() {
        val preview = service.preview(BuildingBlockVersionMigrationPreviewRequestDto("send-email", "1.0.0", "1.0.1"))

        assertThat(preview.draftsAllowed).isFalse()
        val chain = preview.chains.single()
        assertThat(chain.migratable).isFalse()
        assertThat(chain.notMigratableReason).contains("does not allow drafts")
    }

    @Test
    fun `execution fails early where drafts are not allowed and changes nothing`() {
        val chainId = service.preview(BuildingBlockVersionMigrationPreviewRequestDto("send-email", "1.0.0", "1.0.1"))
            .chains.single().id

        assertThatThrownBy {
            service.execute(BuildingBlockVersionMigrationExecuteRequestDto("send-email", "1.0.0", "1.0.1", listOf(chainId)))
        }
            .isInstanceOf(BuildingBlockVersionMigrationException::class.java)
            .hasMessageContaining("does not allow drafts")
        verifyNoInteractions(buildingBlockManagementService, caseDefinitionService, operatonProcessService)
    }

    @Test
    fun `a new draft version bumps the key's latest version by the component that differs between source and target`() {
        val notify = { version: String -> MigrationContainer(BUILDING_BLOCK, "notify", Semver.parse(version)!!) }
        val versions = BuildingBlockUsageIndex(
            references = emptyList(),
            containers = listOf("1.1.0", "1.2.0").map { MigrationContainerInfo(notify(it), true, null, "Notify") },
        )

        fun allocate(sourceVersion: String, targetVersion: String) = BuildingBlockVersionMigrationPlanner(
            versions,
            BuildingBlockDefinitionId.of("send-email", sourceVersion),
            BuildingBlockDefinitionId.of("send-email", targetVersion),
            TargetFields(emptyList()),
            emptySet(),
            true,
        ).allocateDraftVersions(listOf(notify("1.1.0"))).getValue(notify("1.1.0")).toString()

        assertThat(allocate("1.0.0", "1.0.1")).isEqualTo("1.2.1")
        assertThat(allocate("1.0.1", "1.0.0")).isEqualTo("1.2.1")
        assertThat(allocate("1.0.0", "1.1.0")).isEqualTo("1.3.0")
        assertThat(allocate("1.0.0", "2.0.0")).isEqualTo("2.0.0")
    }
}
