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

import com.ritense.buildingblock.exception.BuildingBlockReferenceUpdateException
import com.ritense.buildingblock.repository.BuildingBlockProcessLinkRepository
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.buildingblock.service.BuildingBlockManagementService
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateContainerType.CASE
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateExecuteRequestDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdatePreviewRequestDto
import com.ritense.case.service.CaseDefinitionService
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.service.OperatonProcessService
import jakarta.persistence.EntityManager
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

class BuildingBlockReferenceUpdateServiceTest {

    private val source = BuildingBlockDefinitionId.of("send-email", "1.0.0")
    private val target = BuildingBlockDefinitionId.of("send-email", "1.0.1")
    private val case = ReferenceContainer(CASE, "moving", Semver.parse("1.3.0")!!)

    private val index = BuildingBlockReferenceIndex(
        references = listOf(
            IndexedReference(
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
            ReferenceContainerInfo(ReferenceContainer.of(source), final = true, basedOnVersionTag = null, name = "Send email"),
            ReferenceContainerInfo(ReferenceContainer.of(target), final = true, basedOnVersionTag = null, name = "Send email"),
            ReferenceContainerInfo(case, final = false, basedOnVersionTag = null, name = "Moving"),
        ),
    )
    private val referenceIndexLoader = mock<BuildingBlockReferenceIndexLoader> {
        on { load(anyOrNull()) } doReturn index
    }
    private val checker = mock<BuildingBlockDefinitionChecker> {
        on { canUpdateGlobalConfiguration() } doReturn false
    }
    private val buildingBlockManagementService = mock<BuildingBlockManagementService>()
    private val caseDefinitionService = mock<CaseDefinitionService>()
    private val operatonProcessService = mock<OperatonProcessService>()
    private val processLinkRepository = mock<ProcessLinkRepository>()
    private val buildingBlockProcessLinkRepository = mock<BuildingBlockProcessLinkRepository>()
    private val caseDefinitionBuildingBlockLinkRepository = mock<CaseDefinitionBuildingBlockLinkRepository>()
    private val entityManager = mock<EntityManager>()

    private val service = BuildingBlockReferenceUpdateService(
        referenceIndexLoader = referenceIndexLoader,
        buildingBlockManagementService = buildingBlockManagementService,
        caseDefinitionService = caseDefinitionService,
        buildingBlockFieldService = mock { on { getFields(any()) } doReturn emptyList() },
        buildingBlockPluginDefinitionService = mock { on { getPluginDefinitionKeysForBuildingBlock(any()) } doReturn emptySet() },
        buildingBlockDefinitionChecker = checker,
        operatonProcessService = operatonProcessService,
        repositoryService = mock(),
        processDefinitionBuildingBlockDefinitionRepository = mock(),
        processDefinitionCaseDefinitionRepository = mock(),
        processLinkRepository = processLinkRepository,
        buildingBlockProcessLinkRepository = buildingBlockProcessLinkRepository,
        caseDefinitionBuildingBlockLinkRepository = caseDefinitionBuildingBlockLinkRepository,
        startableItemRepository = mock(),
        pluginService = mock(),
        authorizationService = mock(),
        entityManager = entityManager,
    )

    @Test
    fun `the preview marks every chain not updatable where drafts are not allowed`() {
        val preview = service.preview(BuildingBlockReferenceUpdatePreviewRequestDto("send-email", "1.0.0", "1.0.1"))

        assertThat(preview.draftsAllowed).isFalse()
        val chain = preview.chains.single()
        assertThat(chain.updatable).isFalse()
        assertThat(chain.notUpdatableReason).contains("does not allow drafts")
    }

    @Test
    fun `execution fails early where drafts are not allowed and changes nothing`() {
        val chainId = service.preview(BuildingBlockReferenceUpdatePreviewRequestDto("send-email", "1.0.0", "1.0.1"))
            .chains.single().id

        assertThatThrownBy {
            service.execute(BuildingBlockReferenceUpdateExecuteRequestDto("send-email", "1.0.0", "1.0.1", listOf(chainId)))
        }
            .isInstanceOf(BuildingBlockReferenceUpdateException::class.java)
            .hasMessageContaining("does not allow drafts")
        verifyNoInteractions(
            buildingBlockManagementService,
            caseDefinitionService,
            operatonProcessService,
            processLinkRepository,
            buildingBlockProcessLinkRepository,
            caseDefinitionBuildingBlockLinkRepository,
            entityManager,
        )
    }
}
