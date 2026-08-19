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

package com.ritense.buildingblock.service.migration

import com.ritense.buildingblock.domain.CaseDefinitionBuildingBlockLink
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinition
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinitionId
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinition
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinitionId
import com.ritense.processdocument.repository.ProcessDefinitionCaseDefinitionRepository
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.repository.ProcessDefinition
import org.operaton.bpm.model.bpmn.BpmnModelInstance
import org.operaton.bpm.model.bpmn.instance.CallActivity
import org.semver4j.Semver
import java.util.UUID

class LinkedBuildingBlockVersionResolverTest {

    private lateinit var caseLinkRepository: CaseDefinitionBuildingBlockLinkRepository
    private lateinit var processDefCaseDefRepository: ProcessDefinitionCaseDefinitionRepository
    private lateinit var processDefBbDefRepository: ProcessDefinitionBuildingBlockDefinitionRepository
    private lateinit var processLinkRepository: ProcessLinkRepository
    private lateinit var pathResolver: BuildingBlockMigrationPathResolver
    private lateinit var repositoryService: RepositoryService
    private lateinit var resolver: LinkedBuildingBlockVersionResolver

    private val caseDefinitionId = CaseDefinitionId("verhuizing", "1.0.2")
    private val bbKey = "verhuizing-inspectie"
    private val processDefinitionId = "verhuizing:1:abc"

    @BeforeEach
    fun setUp() {
        caseLinkRepository = mock()
        processDefCaseDefRepository = mock()
        processDefBbDefRepository = mock()
        processLinkRepository = mock()
        pathResolver = mock()
        repositoryService = mock()
        resolver = LinkedBuildingBlockVersionResolver(
            caseLinkRepository,
            processDefCaseDefRepository,
            processDefBbDefRepository,
            processLinkRepository,
            pathResolver,
            repositoryService,
        )
        // Unless a test says otherwise, every version an owner links is reachable through the plans, so
        // reachability never silently narrows the candidates a test set up.
        whenever(pathResolver.isReachable(any(), any())).thenReturn(true)
        whenever(caseLinkRepository.findAllByCaseDefinitionId(caseDefinitionId)).thenReturn(emptyList())
        whenever(processDefCaseDefRepository.findByIdCaseDefinitionId(caseDefinitionId)).thenReturn(emptyList())
        whenever(processLinkRepository.findByProcessDefinitionId(processDefinitionId)).thenReturn(emptyList())
    }

    @Test
    fun `should resolve a version linked as a startable item`() {
        startableItemLink("1.0.1")

        val target = resolver.resolveTarget(caseDefinitionId, instance("1.0.0"))

        assertThat(target).isEqualTo(BuildingBlockDefinitionId.of(bbKey, "1.0.1"))
    }

    @Test
    fun `should resolve a version linked from a call activity`() {
        callActivityLink("inspectie_uitvoeren", "1.0.1")

        val target = resolver.resolveTarget(caseDefinitionId, instance("1.0.0", activityId = "inspectie_uitvoeren"))

        assertThat(target).isEqualTo(BuildingBlockDefinitionId.of(bbKey, "1.0.1"))
    }

    @Test
    fun `should match a call-activity instance to its own call activity, not to another link for the same block`() {
        startableItemLink("3.0.0")
        callActivityLink("inspectie_uitvoeren", "1.0.1")
        callActivityLink("herinspectie_uitvoeren", "2.0.0")

        val target = resolver.resolveTarget(caseDefinitionId, instance("1.0.0", activityId = "herinspectie_uitvoeren"))

        assertThat(target).isEqualTo(BuildingBlockDefinitionId.of(bbKey, "2.0.0"))
    }

    @Test
    fun `should match an instance without an activity to the startable-item link`() {
        startableItemLink("1.0.1")
        callActivityLink("inspectie_uitvoeren", "2.0.0")

        val target = resolver.resolveTarget(caseDefinitionId, instance("1.0.0"))

        assertThat(target).isEqualTo(BuildingBlockDefinitionId.of(bbKey, "1.0.1"))
    }

    @Test
    fun `should use the one linked version when the recorded call activity no longer exists`() {
        // The case's process migration renamed the activity the block was started from. Both links
        // name 1.0.1, so which of them governs this instance does not change the answer.
        callActivityLink("inspectie_uitvoeren_v2", "1.0.1")
        callActivityLink("herinspectie_uitvoeren", "1.0.1")

        val target = resolver.resolveTarget(caseDefinitionId, instance("1.0.0", activityId = "inspectie_uitvoeren"))

        assertThat(target).isEqualTo(BuildingBlockDefinitionId.of(bbKey, "1.0.1"))
    }

    @Test
    fun `should refuse to pick a version when the links disagree and the instance matches none of them`() {
        callActivityLink("inspectie_uitvoeren_v2", "1.0.1")
        callActivityLink("herinspectie_uitvoeren", "2.0.0")

        assertThatThrownBy {
            resolver.resolveTarget(caseDefinitionId, instance("1.0.0", activityId = "inspectie_uitvoeren"))
        }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("1.0.1")
            .hasMessageContaining("2.0.0")
            .hasMessageContaining("inspectie_uitvoeren")
    }

    @Test
    fun `should refuse to pick a version for a startable-item instance when only disagreeing call activities link it`() {
        callActivityLink("inspectie_uitvoeren", "1.0.1")
        callActivityLink("herinspectie_uitvoeren", "2.0.0")

        assertThatThrownBy { resolver.resolveTarget(caseDefinitionId, instance("1.0.0")) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("startable item")
    }

    @Test
    fun `should use the matched link even when the links disagree`() {
        // Ambiguity only matters when nothing matches: a block that names its own call activity is
        // governed by that link, whatever the others say.
        callActivityLink("inspectie_uitvoeren", "1.0.1")
        callActivityLink("herinspectie_uitvoeren", "2.0.0")

        val target = resolver.resolveTarget(caseDefinitionId, instance("1.0.0", activityId = "inspectie_uitvoeren"))

        assertThat(target).isEqualTo(BuildingBlockDefinitionId.of(bbKey, "1.0.1"))
    }

    @Test
    fun `should resolve nothing when nothing the target version links can be reached from this block`() {
        // The owner links an unrelated building block, and no plan leads from this one to it. That is
        // the honest reading of "this block is no longer linked": leave it where it is.
        callActivityLink("andere_activiteit", "1.0.0", key = "income-check")
        whenever(pathResolver.isReachable(any(), any())).thenReturn(false)

        val target = resolver.resolveTarget(caseDefinitionId, instance("1.0.0"))

        assertThat(target).isNull()
    }

    @Test
    fun `should follow the link of a different building block key when the instance's own activity names it`() {
        // The owner's new version points the very activity this block was started from at another
        // building block. Nothing is in doubt, so the key change is followed without consulting the plans.
        callActivityLink("foto_maken", "1.0.0", key = "inspectie-dossier")

        val target = resolver.resolveTarget(
            caseDefinitionId,
            instance("1.0.1", key = "inspectie-fotos", activityId = "foto_maken"),
        )

        assertThat(target).isEqualTo(BuildingBlockDefinitionId.of("inspectie-dossier", "1.0.0"))
    }

    @Test
    fun `should pick the only linked block a migration plan can reach when no link matches the origin`() {
        // The activity was renamed past what the remap could follow. Two blocks are linked, but only one
        // of them is somewhere this instance can be migrated to, so which link governs it is moot.
        callActivityLink("dossier_vaststellen", "1.0.0", key = "inspectie-dossier")
        callActivityLink("inkomen_toetsen", "1.0.0", key = "income-check")
        val instance = instance("1.0.1", key = "inspectie-fotos", activityId = "foto_maken")
        whenever(pathResolver.isReachable(any(), any())).thenReturn(false)
        whenever(
            pathResolver.isReachable(
                BuildingBlockDefinitionId.of("inspectie-fotos", "1.0.1"),
                BuildingBlockDefinitionId.of("inspectie-dossier", "1.0.0"),
            )
        ).thenReturn(true)

        val target = resolver.resolveTarget(caseDefinitionId, instance)

        assertThat(target).isEqualTo(BuildingBlockDefinitionId.of("inspectie-dossier", "1.0.0"))
    }

    @Test
    fun `should refuse when several linked blocks are reachable and none matches the origin`() {
        callActivityLink("dossier_vaststellen", "1.0.0", key = "inspectie-dossier")
        callActivityLink("archief_vullen", "1.0.0", key = "inspectie-archief")

        assertThatThrownBy {
            resolver.resolveTarget(
                caseDefinitionId,
                instance("1.0.1", key = "inspectie-fotos", activityId = "foto_maken"),
            )
        }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("inspectie-dossier:1.0.0")
            .hasMessageContaining("inspectie-archief:1.0.0")
            .hasMessageContaining("foto_maken")
    }

    @Test
    fun `should leave a startable-item instance alone when the only startable item is another block`() {
        // A block just created by `addBuildingBlock` has no activity id, so it reads as startable-item
        // origin. Matching it on origin kind alone pinned it to whatever startable item the owner
        // happened to offer — here an unrelated block, which then failed the whole case for having no
        // migration path. The key is the only thing that identifies a startable-item link.
        startableItemLink("1.0.0", key = "verhuizing-inspectie")
        whenever(pathResolver.isReachable(any(), any())).thenReturn(false)

        val target = resolver.resolveTarget(caseDefinitionId, instance("1.0.0", key = "income-check"))

        assertThat(target).isNull()
    }

    @Test
    fun `should match a startable-item instance to the startable item for its own key`() {
        startableItemLink("2.0.0", key = "income-check")
        startableItemLink("1.0.1")

        val target = resolver.resolveTarget(caseDefinitionId, instance("1.0.0"))

        assertThat(target).isEqualTo(BuildingBlockDefinitionId.of(bbKey, "1.0.1"))
    }

    @Test
    fun `should resolve call-activity links of a building block owner`() {
        val ownerId = BuildingBlockDefinitionId.of("verhuizing-inspectie", "2.0.0")
        val bbProcessDefinitionId = "inspectie-process:1:xyz"
        whenever(processDefBbDefRepository.findAllByIdBuildingBlockDefinitionId(ownerId)).thenReturn(
            listOf(
                ProcessDefinitionBuildingBlockDefinition(
                    ProcessDefinitionBuildingBlockDefinitionId(ProcessDefinitionId(bbProcessDefinitionId), ownerId)
                )
            )
        )
        whenever(processLinkRepository.findByProcessDefinitionId(bbProcessDefinitionId)).thenReturn(
            listOf(buildingBlockProcessLink(bbProcessDefinitionId, "foto_maken", "photo-upload", "1.0.1"))
        )

        val target = resolver.resolveTarget(
            ownerId,
            instance("1.0.0", key = "photo-upload", activityId = "foto_maken"),
        )

        assertThat(target).isEqualTo(BuildingBlockDefinitionId.of("photo-upload", "1.0.1"))
    }

    private fun startableItemLink(versionTag: String, key: String = bbKey) {
        val existing = caseLinkRepository.findAllByCaseDefinitionId(caseDefinitionId)
        whenever(caseLinkRepository.findAllByCaseDefinitionId(caseDefinitionId)).thenReturn(
            existing + CaseDefinitionBuildingBlockLink(
                caseDefinitionId = caseDefinitionId,
                buildingBlockDefinitionId = BuildingBlockDefinitionId.of(key, versionTag),
            )
        )
    }

    @Test
    fun `should resolve call-activity-linked blocks transitively, through the blocks themselves`() {
        // case -> uitvoeren, and uitvoeren -> besluit, which only uitvoeren's own definition declares.
        callActivityLink("UitvoerenCallActivity", "1.0.0", key = "bijstand-uitvoeren")
        val uitvoeren = BuildingBlockDefinitionId.of("bijstand-uitvoeren", "1.0.0")
        blockCallActivityLink(uitvoeren, "besluit:1:x", "BesluitCallActivity", "bijstand-besluit", "1.0.0")

        assertThat(resolver.resolveCallActivityReachable(caseDefinitionId)).containsExactly(
            uitvoeren,
            BuildingBlockDefinitionId.of("bijstand-besluit", "1.0.0"),
        )
    }

    @Test
    fun `should terminate on a cyclic call-activity link graph`() {
        // A block that links itself: the walk must stop rather than spin.
        callActivityLink("UitvoerenCallActivity", "1.0.0", key = "bijstand-uitvoeren")
        val uitvoeren = BuildingBlockDefinitionId.of("bijstand-uitvoeren", "1.0.0")
        blockCallActivityLink(uitvoeren, "loop:1:x", "SelfCallActivity", "bijstand-uitvoeren", "1.0.0")

        assertThat(resolver.resolveCallActivityReachable(caseDefinitionId)).containsExactly(uitvoeren)
    }

    @Test
    fun `should resolve nothing reachable when the owner links no call activity`() {
        startableItemLink("1.0.1") // a startable item is not something a running tree nests through

        assertThat(resolver.resolveCallActivityReachable(caseDefinitionId)).isEmpty()
    }

    /** [owner] (a building block) declares [key]:[versionTag] on [activityId] of its own process. */
    private fun blockCallActivityLink(
        owner: BuildingBlockDefinitionId,
        ownerProcessDefinitionId: String,
        activityId: String,
        key: String,
        versionTag: String,
    ) {
        whenever(processDefBbDefRepository.findAllByIdBuildingBlockDefinitionId(owner)).thenReturn(
            listOf(
                ProcessDefinitionBuildingBlockDefinition(
                    ProcessDefinitionBuildingBlockDefinitionId(
                        ProcessDefinitionId(ownerProcessDefinitionId), owner
                    )
                )
            )
        )
        whenever(processLinkRepository.findByProcessDefinitionId(ownerProcessDefinitionId)).thenReturn(
            listOf(buildingBlockProcessLink(ownerProcessDefinitionId, activityId, key, versionTag))
        )
    }

    private fun callActivityLink(activityId: String, versionTag: String, key: String = bbKey) {
        whenever(processDefCaseDefRepository.findByIdCaseDefinitionId(caseDefinitionId)).thenReturn(
            listOf(
                ProcessDefinitionCaseDefinition(
                    ProcessDefinitionCaseDefinitionId(ProcessDefinitionId(processDefinitionId), caseDefinitionId)
                )
            )
        )
        val existing = processLinkRepository.findByProcessDefinitionId(processDefinitionId)
        whenever(processLinkRepository.findByProcessDefinitionId(processDefinitionId)).thenReturn(
            existing + buildingBlockProcessLink(processDefinitionId, activityId, key, versionTag)
        )
    }

    private fun buildingBlockProcessLink(
        processDefinitionId: String,
        activityId: String,
        key: String,
        versionTag: String,
    ) = BuildingBlockProcessLink(
        id = UUID.randomUUID(),
        processDefinitionId = processDefinitionId,
        activityId = activityId,
        activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
        buildingBlockDefinitionId = BuildingBlockDefinitionId.of(key, versionTag),
        pluginConfigurationMappings = emptyMap(),
    )

    @Test
    fun `should resolve a link that sits behind an unlinked building-block call activity`() {
        // The shape of a case mid-way through the v12 upgrade: the case calls a building block's
        // deployment as a plain sub-process (tagged, not linked), and *that* block declares the nested
        // one. Reading only linked hops would stop at the case and find nothing.
        caseProcessDefinition()
        bbTaggedCallActivity(processDefinitionId, "bijstand-uitvoeren", "1.0.0")
        val uitvoeren = BuildingBlockDefinitionId.of("bijstand-uitvoeren", "1.0.0")
        blockCallActivityLink(uitvoeren, "besluit:1:x", "BesluitCallActivity", "bijstand-besluit", "1.0.0")

        // Only the linked one is authorisable — the hop itself is called, never declared, so a plan may
        // not name it and adoption will leave it a plain sub-process.
        assertThat(resolver.resolveCallActivityReachable(caseDefinitionId))
            .containsExactly(BuildingBlockDefinitionId.of("bijstand-besluit", "1.0.0"))
    }

    @Test
    fun `should not authorise a building block that is only called, never linked`() {
        caseProcessDefinition()
        bbTaggedCallActivity(processDefinitionId, "bijstand-uitvoeren", "1.0.0")

        assertThat(resolver.resolveCallActivityReachable(caseDefinitionId)).isEmpty()
    }

    @Test
    fun `should terminate when unlinked call activities form a cycle`() {
        caseProcessDefinition()
        bbTaggedCallActivity(processDefinitionId, "bijstand-uitvoeren", "1.0.0")
        val uitvoeren = BuildingBlockDefinitionId.of("bijstand-uitvoeren", "1.0.0")
        blockProcessDefinition(uitvoeren, "loop:1:x")
        bbTaggedCallActivity("loop:1:x", "bijstand-uitvoeren", "1.0.0") // calls itself, still unlinked

        assertThat(resolver.resolveCallActivityReachable(caseDefinitionId)).isEmpty()
    }

    /**
     * G23: the runtime counterpart of the two-set closure. A hop left as a plain sub-process keeps running
     * the old blueprint's copy of its process, which carries none of the new model's links — so the link
     * for what it calls has to be read from the blueprint the *target model* says deploys that process.
     */
    @Test
    fun `should resolve a link from the blueprint the target model says deploys the process`() {
        caseProcessDefinition()
        bbTaggedCallActivity(processDefinitionId, "bijstand-uitvoeren", "1.0.0")
        val uitvoeren = BuildingBlockDefinitionId.of("bijstand-uitvoeren", "1.0.0")
        blockCallActivityLink(uitvoeren, "uitvoeren:bb", "BesluitCallActivity", "bijstand-besluit", "1.0.0")
        val uitvoerenDefinition = mock<ProcessDefinition>() // built first: stubbing inside whenever() breaks Mockito
        whenever(uitvoerenDefinition.key).thenReturn("bijstand-uitvoeren")
        whenever(repositoryService.getProcessDefinition("uitvoeren:bb")).thenReturn(uitvoerenDefinition)

        val link = resolver.resolveCallActivityLink(caseDefinitionId, "bijstand-uitvoeren", "BesluitCallActivity")

        assertThat(link?.buildingBlockDefinitionId)
            .isEqualTo(BuildingBlockDefinitionId.of("bijstand-besluit", "1.0.0"))
    }

    @Test
    fun `should resolve no link for an activity the target model does not declare`() {
        caseProcessDefinition()
        bbTaggedCallActivity(processDefinitionId, "bijstand-uitvoeren", "1.0.0")
        val uitvoeren = BuildingBlockDefinitionId.of("bijstand-uitvoeren", "1.0.0")
        blockCallActivityLink(uitvoeren, "uitvoeren:bb", "BesluitCallActivity", "bijstand-besluit", "1.0.0")
        val uitvoerenDefinition = mock<ProcessDefinition>() // built first: stubbing inside whenever() breaks Mockito
        whenever(uitvoerenDefinition.key).thenReturn("bijstand-uitvoeren")
        whenever(repositoryService.getProcessDefinition("uitvoeren:bb")).thenReturn(uitvoerenDefinition)

        assertThat(resolver.resolveCallActivityLink(caseDefinitionId, "bijstand-uitvoeren", "AndereActivity")).isNull()
        assertThat(resolver.resolveCallActivityLink(caseDefinitionId, "ander-proces", "BesluitCallActivity")).isNull()
    }

    /** The case owns [processDefinitionId], with no building-block links on it. */
    private fun caseProcessDefinition() {
        whenever(processDefCaseDefRepository.findByIdCaseDefinitionId(caseDefinitionId)).thenReturn(
            listOf(
                ProcessDefinitionCaseDefinition(
                    ProcessDefinitionCaseDefinitionId(ProcessDefinitionId(processDefinitionId), caseDefinitionId)
                )
            )
        )
    }

    /** [owner] (a building block) owns [ownerProcessDefinitionId], with no links on it. */
    private fun blockProcessDefinition(owner: BuildingBlockDefinitionId, ownerProcessDefinitionId: String) {
        whenever(processDefBbDefRepository.findAllByIdBuildingBlockDefinitionId(owner)).thenReturn(
            listOf(
                ProcessDefinitionBuildingBlockDefinition(
                    ProcessDefinitionBuildingBlockDefinitionId(
                        ProcessDefinitionId(ownerProcessDefinitionId), owner
                    )
                )
            )
        )
    }

    /**
     * [processDefinitionId] has a call activity bound to [key]:[versionTag]'s deployment by version tag
     * and **no** building-block process link — a block called as a plain sub-process.
     */
    private fun bbTaggedCallActivity(processDefinitionId: String, key: String, versionTag: String) {
        val callActivity = mock<CallActivity>()
        whenever(callActivity.operatonCalledElementVersionTag).thenReturn("BB:$key:$versionTag")
        val model = mock<BpmnModelInstance>()
        whenever(model.getModelElementsByType(CallActivity::class.java)).thenReturn(listOf(callActivity))
        whenever(repositoryService.getBpmnModelInstance(processDefinitionId)).thenReturn(model)
    }

    private fun instance(versionTag: String, key: String = bbKey, activityId: String? = null) = BuildingBlockInstance(
        documentId = UUID.randomUUID(),
        activityId = activityId,
        definition = BuildingBlockDefinition(
            id = BuildingBlockDefinitionId.of(key, versionTag),
            name = key,
        ),
    )
}
