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
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.exception.BuildingBlockReferenceUpdateException
import com.ritense.buildingblock.exception.UnknownBuildingBlockDefinitionException
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateContainerType.CASE
import com.ritense.case.domain.StartableItem
import com.ritense.case.domain.StartableItemId
import com.ritense.case.repository.StartableItemRepository
import com.ritense.case.web.rest.dto.StartableItemType
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionChecker
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import jakarta.persistence.EntityManager
import jakarta.persistence.LockModeType
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.assertj.core.api.Assertions.catchThrowableOfType
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.inOrder
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.semver4j.Semver
import org.zalando.problem.Status
import java.util.UUID

class BuildingBlockReferenceUpdateApplierTest {

    private val caseDraft = ReferenceContainer(CASE, "moving", Semver("1.3.0"))
    private val caseDefinitionId = CaseDefinitionId.of("moving", "1.3.0")
    private val caseDefinition = mock<CaseDefinition>()
    private val entityManager = mock<EntityManager> {
        on { find(CaseDefinition::class.java, caseDefinitionId) } doReturn caseDefinition
    }
    private val sendEmail = BuildingBlockDefinitionId.of("send-email", "1.0.0")

    @Test
    fun `a container finalized since the index was read is locked, rechecked and refused`() {
        val caseDefinitionChecker = mock<CaseDefinitionChecker> {
            on { canUpdateCaseDefinition(caseDefinitionId) } doReturn false
        }

        assertThatThrownBy { applier(caseDefinitionChecker).assertWritable(planWritingTo(caseDraft)) }
            .isInstanceOf(BuildingBlockReferenceUpdateException::class.java)
            .hasMessage("case moving 1.3.0 can no longer be changed; it was finalized or removed. Refresh the preview and try again.")
        inOrder(entityManager, caseDefinitionChecker) {
            verify(entityManager).refresh(caseDefinition, LockModeType.PESSIMISTIC_WRITE)
            verify(caseDefinitionChecker).canUpdateCaseDefinition(caseDefinitionId)
        }
    }

    @Test
    fun `a container that is still a draft is locked, rechecked and passes`() {
        val caseDefinitionChecker = mock<CaseDefinitionChecker> {
            on { canUpdateCaseDefinition(any()) } doReturn true
        }

        applier(caseDefinitionChecker).assertWritable(planWritingTo(caseDraft))

        inOrder(entityManager, caseDefinitionChecker) {
            verify(entityManager).refresh(caseDefinition, LockModeType.PESSIMISTIC_WRITE)
            verify(caseDefinitionChecker).canUpdateCaseDefinition(caseDefinitionId)
        }
    }

    @Test
    fun `locking a building block that does not exist fails as not found`() {
        assertThatThrownBy { applier().lock(ReferenceContainer.of(sendEmail)) }
            .isInstanceOf(UnknownBuildingBlockDefinitionException::class.java)
            .hasMessage("Building block definition with id send-email:1.0.0 could not be found")
        verify(entityManager).find(BuildingBlockDefinition::class.java, sendEmail)
        verify(entityManager, never()).refresh(any(), any<LockModeType>())
    }

    @Test
    fun `locking a case definition that does not exist fails as not found`() {
        val missing = ReferenceContainer(CASE, "moving", Semver("9.0.0"))

        val thrown = catchProblem { applier().lock(missing) }

        assertThat(thrown.status).isEqualTo(Status.NOT_FOUND)
        assertThat(thrown.message).isEqualTo("case moving 9.0.0 no longer exists. Refresh the preview and try again.")
        verify(entityManager, never()).refresh(any(), any<LockModeType>())
    }

    @Test
    fun `re-pointing to another key moves the startable item row and keeps its sort order`() {
        val row = startableItem(sendEmail.key, "1.0.0", sortOrder = 3)
        val startableItemRepository = startableItemRepository(row)
        val newChild = BuildingBlockDefinitionId.of("send-sms", "2.0.0")

        applier(startableItemRepository = startableItemRepository, linkRepository = linkRepository(sendEmail))
            .applyChanges(context(), planWritingTo(caseDraft, newChild))

        verify(startableItemRepository).deleteAll(listOf(row))
        verify(startableItemRepository).save(startableItem("send-sms", "2.0.0", sortOrder = 3))
    }

    @Test
    fun `re-pointing to another version moves the versioned startable item row`() {
        val row = startableItem(sendEmail.key, "1.0.0", sortOrder = 3)
        val startableItemRepository = startableItemRepository(row)

        applier(startableItemRepository = startableItemRepository, linkRepository = linkRepository(sendEmail))
            .applyChanges(context(), planWritingTo(caseDraft))

        verify(startableItemRepository).deleteAll(listOf(row))
        verify(startableItemRepository).save(startableItem(sendEmail.key, "1.0.1", sortOrder = 3))
    }

    @Test
    fun `a blank startable item row shared with another link to the key is kept`() {
        val blank = startableItem(sendEmail.key, "", sortOrder = 5)
        val otherLinkRow = startableItem(sendEmail.key, "2.0.0", sortOrder = 6)
        val startableItemRepository = startableItemRepository(blank, otherLinkRow)
        val newChild = BuildingBlockDefinitionId.of("send-sms", "2.0.0")

        applier(
            startableItemRepository = startableItemRepository,
            linkRepository = linkRepository(sendEmail, BuildingBlockDefinitionId.of(sendEmail.key, "2.0.0")),
        ).applyChanges(context(), planWritingTo(caseDraft, newChild))

        verify(startableItemRepository, never()).deleteAll(any<Iterable<StartableItem>>())
        verify(startableItemRepository, never()).delete(any())
        verify(startableItemRepository).save(startableItem("send-sms", "", sortOrder = 5))
    }

    @Test
    fun `a stale versioned startable item row of the only link to the key is moved`() {
        val stale = startableItem(sendEmail.key, "0.9.0", sortOrder = 4)
        val startableItemRepository = startableItemRepository(stale)

        applier(startableItemRepository = startableItemRepository, linkRepository = linkRepository(sendEmail))
            .applyChanges(context(), planWritingTo(caseDraft))

        verify(startableItemRepository).deleteAll(listOf(stale))
        verify(startableItemRepository).save(startableItem(sendEmail.key, "1.0.1", sortOrder = 4))
    }

    private fun catchProblem(block: () -> Unit): BuildingBlockReferenceUpdateException =
        catchThrowableOfType(BuildingBlockReferenceUpdateException::class.java) { block() }

    private fun startableItem(key: String, versionTag: String, sortOrder: Int) =
        StartableItem(StartableItemId(caseDefinitionId, key, StartableItemType.BUILDING_BLOCK, versionTag), sortOrder)

    private fun startableItemRepository(vararg rows: StartableItem) = mock<StartableItemRepository> {
        on { findAllByIdCaseDefinitionId(caseDefinitionId) } doReturn rows.toList()
    }

    private fun linkRepository(vararg children: BuildingBlockDefinitionId) = mock<CaseDefinitionBuildingBlockLinkRepository> {
        on { findAllByCaseDefinitionId(caseDefinitionId) } doReturn children.map {
            CaseDefinitionBuildingBlockLink(caseDefinitionId = caseDefinitionId, buildingBlockDefinitionId = it)
        }
    }

    private fun context() = ReferenceUpdateContext(
        source = sendEmail,
        target = BuildingBlockDefinitionId.of("send-email", "1.0.1"),
        index = BuildingBlockReferenceIndex(references = emptyList(), containers = emptyList()),
        planner = mock(),
        targetFields = TargetFields(emptyList()),
        analyses = emptyList(),
        draftsAllowed = true,
    )

    private fun applier(
        caseDefinitionChecker: CaseDefinitionChecker = mock(),
        startableItemRepository: StartableItemRepository = mock(),
        linkRepository: CaseDefinitionBuildingBlockLinkRepository = mock(),
    ) = BuildingBlockReferenceUpdateApplier(
        buildingBlockManagementService = mock(),
        caseDefinitionService = mock(),
        buildingBlockDefinitionChecker = mock(),
        caseDefinitionChecker = caseDefinitionChecker,
        operatonProcessService = mock(),
        repositoryService = mock(),
        processDefinitionBuildingBlockDefinitionRepository = mock(),
        processDefinitionCaseDefinitionRepository = mock(),
        processLinkRepository = mock(),
        buildingBlockProcessLinkRepository = mock(),
        caseDefinitionBuildingBlockLinkRepository = linkRepository,
        startableItemRepository = startableItemRepository,
        applicationEventPublisher = mock(),
        entityManager = entityManager,
    )

    private fun planWritingTo(
        container: ReferenceContainer,
        newChild: BuildingBlockDefinitionId = BuildingBlockDefinitionId.of("send-email", "1.0.1"),
    ): ReferenceUpdatePlan {
        val link = IndexedReference(
            container = container,
            location = CaseLinkLocation(sendEmail.key),
            child = sendEmail,
            linkId = UUID.randomUUID(),
            processDefinitionId = null,
            inputMappings = emptyList(),
            outputMappings = emptyList(),
            pluginConfigurationMappings = emptyMap(),
        )
        return ReferenceUpdatePlan(
            selectedAnalyses = emptyList(),
            newDraftVersions = emptyMap(),
            changes = listOf(
                LinkChange(
                    writable = InPlaceDraft(container),
                    link = link,
                    newChild = newChild,
                    containerReference = false,
                    dropAgainstTarget = true,
                    addInputs = emptyList(),
                    addPlugins = emptyMap(),
                )
            ),
            conflicts = emptyMap(),
            covered = emptySet(),
            skipped = emptyList(),
            resolutions = emptyMap(),
        )
    }
}
