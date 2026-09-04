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
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinition
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinitionId
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.repository.ProcessDefinitionCaseDefinitionRepository
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.valtimo.contract.blueprint.migration.MigrationRunCache
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import java.util.UUID
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.Mockito
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.repository.ProcessDefinition
import org.operaton.bpm.engine.repository.ProcessDefinitionQuery
import org.operaton.bpm.model.bpmn.BpmnModelInstance
import org.operaton.bpm.model.bpmn.instance.CallActivity

class LinkedBuildingBlockVersionResolverTest {

    private lateinit var caseLinkRepository: CaseDefinitionBuildingBlockLinkRepository
    private lateinit var processDefCaseDefRepository: ProcessDefinitionCaseDefinitionRepository
    private lateinit var processDefBbDefRepository: ProcessDefinitionBuildingBlockDefinitionRepository
    private lateinit var processLinkRepository: ProcessLinkRepository
    private lateinit var pathResolver: BuildingBlockMigrationPathResolver
    private lateinit var repositoryService: RepositoryService

    /** Self-returning, so an id no test declared answers null — "not deployed" — rather than throwing. */
    private lateinit var processDefinitionQuery: ProcessDefinitionQuery
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
        processDefinitionQuery = mock(defaultAnswer = Mockito.RETURNS_SELF)
        whenever(repositoryService.createProcessDefinitionQuery()).thenReturn(processDefinitionQuery)
        resolver = LinkedBuildingBlockVersionResolver(
            caseLinkRepository,
            processDefCaseDefRepository,
            processDefBbDefRepository,
            processLinkRepository,
            pathResolver,
            repositoryService,
        )
        // Unless a test says otherwise every linked version is reachable, so reachability never silently narrows the candidates.
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
        // The activity was renamed; both links name 1.0.1, so which governs does not change the answer.
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
        // Ambiguity only matters when nothing matches: a block naming its own call activity is governed by that link.
        callActivityLink("inspectie_uitvoeren", "1.0.1")
        callActivityLink("herinspectie_uitvoeren", "2.0.0")

        val target = resolver.resolveTarget(caseDefinitionId, instance("1.0.0", activityId = "inspectie_uitvoeren"))

        assertThat(target).isEqualTo(BuildingBlockDefinitionId.of(bbKey, "1.0.1"))
    }

    @Test
    fun `should resolve nothing when nothing the target version links can be reached from this block`() {
        // The owner links an unrelated block and no plan leads there — leave it where it is.
        callActivityLink("andere_activiteit", "1.0.0", key = "income-check")
        whenever(pathResolver.isReachable(any(), any())).thenReturn(false)

        val target = resolver.resolveTarget(caseDefinitionId, instance("1.0.0"))

        assertThat(target).isNull()
    }

    @Test
    fun `should follow the link of a different building block key when the instance's own activity names it`() {
        // The activity is re-pointed at another block; nothing is in doubt, so the key change is followed.
        callActivityLink("foto_maken", "1.0.0", key = "inspectie-dossier")

        val target = resolver.resolveTarget(
            caseDefinitionId,
            instance("1.0.1", key = "inspectie-fotos", activityId = "foto_maken"),
        )

        assertThat(target).isEqualTo(BuildingBlockDefinitionId.of("inspectie-dossier", "1.0.0"))
    }

    @Test
    fun `should pick the only linked block a migration plan can reach when no link matches the origin`() {
        // Renamed past what the remap could follow, but only one linked version is reachable, so which link governs is moot.
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
        // A block just created by `addBuildingBlock` has no activity id, so only its key identifies which startable-item link it came from.
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
    fun `should record the shallowest declarer for a block that also declares itself`() {
        // A recursive block: the case must stay its declarer, or the remove suggester computes the mapping against the block itself.
        callActivityLink("HerhaalCallActivity", "1.0.0", key = "herhaling")
        val herhaling = BuildingBlockDefinitionId.of("herhaling", "1.0.0")
        blockCallActivityLink(herhaling, "herhaling:bb", "HerhaalCallActivity", "herhaling", "1.0.0")

        val declarers = resolver.resolveCallActivityDeclarers(caseDefinitionId)

        assertThat(declarers).containsExactly(java.util.Map.entry(herhaling, caseDefinitionId))
    }

    /** Counted, not asserted on the result: repeating the reads changes nothing but the bill (G31). */
    @Test
    fun `should read each process definition's links once while building the link index`() {
        callActivityLink("UitvoerenCallActivity", "1.0.0", key = "bijstand-uitvoeren")
        val uitvoeren = BuildingBlockDefinitionId.of("bijstand-uitvoeren", "1.0.0")
        blockCallActivityLink(uitvoeren, "uitvoeren:bb", "BesluitCallActivity", "bijstand-besluit", "1.0.0")
        deployed(processDefinitionId, key = "bijstand")
        deployed("uitvoeren:bb", key = "bijstand-uitvoeren")
        // `callActivityLink` reads the repository itself while stubbing, so start the count from zero.
        Mockito.clearInvocations(processLinkRepository)

        val index = resolver.resolveCallActivityLinkIndex(caseDefinitionId)

        assertThat(index.keys).containsExactly(
            "bijstand" to "UitvoerenCallActivity",
            "bijstand-uitvoeren" to "BesluitCallActivity",
        )
        verify(processLinkRepository, times(1)).findByProcessDefinitionId(processDefinitionId)
        verify(processLinkRepository, times(1)).findByProcessDefinitionId("uitvoeren:bb")
    }

    /** First-declarer-wins means shallowest. Two blueprints declare the same activity on processes sharing a definition key. */
    @Test
    fun `should keep the shallowest declarer when two blueprints declare the same call activity`() {
        callActivityLink("SharedCallActivity", "1.0.0", key = "bijstand-uitvoeren")
        val uitvoeren = BuildingBlockDefinitionId.of("bijstand-uitvoeren", "1.0.0")
        blockCallActivityLink(uitvoeren, "uitvoeren:bb", "SharedCallActivity", "bijstand-besluit", "1.0.0")
        // Both are deployed under the same key, so both links compete; the case is shallower and wins.
        deployed(processDefinitionId, key = "gedeeld")
        deployed("uitvoeren:bb", key = "gedeeld")

        val link = resolver.resolveCallActivityLink(caseDefinitionId, "gedeeld", "SharedCallActivity")

        assertThat(link?.buildingBlockDefinitionId).isEqualTo(uitvoeren)
    }

    /** The three call sites all pass the same target for every case in a run (G31). */
    @Test
    fun `should walk the tree once per run however many times it is asked`() {
        callActivityLink("UitvoerenCallActivity", "1.0.0", key = "bijstand-uitvoeren")
        val uitvoeren = BuildingBlockDefinitionId.of("bijstand-uitvoeren", "1.0.0")
        blockCallActivityLink(uitvoeren, "uitvoeren:bb", "BesluitCallActivity", "bijstand-besluit", "1.0.0")
        deployed(processDefinitionId, key = "bijstand")
        deployed("uitvoeren:bb", key = "bijstand-uitvoeren")
        Mockito.clearInvocations(processLinkRepository)

        MigrationRunCache.inRun {
            repeat(3) {
                resolver.resolveCallActivityReachable(caseDefinitionId)
                resolver.resolveCallActivityLinkIndex(caseDefinitionId)
                resolver.resolveGoverningBlueprint(caseDefinitionId, instance("1.0.0"))
            }
        }

        verify(processLinkRepository, times(1)).findByProcessDefinitionId(processDefinitionId)
        verify(processLinkRepository, times(1)).findByProcessDefinitionId("uitvoeren:bb")
    }

    /** Outside a run nothing is cached, so a stale tree can never outlive the run that built it. */
    @Test
    fun `should walk the tree again for each call outside a run`() {
        callActivityLink("UitvoerenCallActivity", "1.0.0", key = "bijstand-uitvoeren")
        deployed(processDefinitionId, key = "bijstand")
        Mockito.clearInvocations(processLinkRepository)

        repeat(3) { resolver.resolveCallActivityReachable(caseDefinitionId) }

        verify(processLinkRepository, times(3)).findByProcessDefinitionId(processDefinitionId)
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
        // A case mid-way through the v12 upgrade: the hop is tagged but not linked, and that block declares the nested one.
        caseProcessDefinition()
        bbTaggedCallActivity(processDefinitionId, "bijstand-uitvoeren", "1.0.0")
        val uitvoeren = BuildingBlockDefinitionId.of("bijstand-uitvoeren", "1.0.0")
        blockCallActivityLink(uitvoeren, "besluit:1:x", "BesluitCallActivity", "bijstand-besluit", "1.0.0")

        // Only the linked one is authorisable — the hop itself is called, never declared.
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

    /** G23: a hop left as a plain sub-process runs the old blueprint's copy, so the link for what it calls comes from the blueprint the target model says deploys it. */
    @Test
    fun `should resolve a link from the blueprint the target model says deploys the process`() {
        caseProcessDefinition()
        bbTaggedCallActivity(processDefinitionId, "bijstand-uitvoeren", "1.0.0")
        val uitvoeren = BuildingBlockDefinitionId.of("bijstand-uitvoeren", "1.0.0")
        blockCallActivityLink(uitvoeren, "uitvoeren:bb", "BesluitCallActivity", "bijstand-besluit", "1.0.0")
        deployed("uitvoeren:bb", key = "bijstand-uitvoeren")

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
        deployed("uitvoeren:bb", key = "bijstand-uitvoeren")

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

    /** [processDefinitionId] calls [key]:[versionTag]'s deployment by version tag with no process link — a block called as a plain sub-process. */
    private fun bbTaggedCallActivity(processDefinitionId: String, key: String, versionTag: String) {
        val callActivity = mock<CallActivity>()
        whenever(callActivity.operatonCalledElementVersionTag).thenReturn("BB:$key:$versionTag")
        val model = mock<BpmnModelInstance>()
        whenever(model.getModelElementsByType(CallActivity::class.java)).thenReturn(listOf(callActivity))
        deployed(processDefinitionId)
        whenever(repositoryService.getBpmnModelInstance(processDefinitionId)).thenReturn(model)
    }

    /** Operaton has a process definition under [processDefinitionId], carrying [key] when one is given. */
    private fun deployed(processDefinitionId: String, key: String? = null) {
        val definition = mock<ProcessDefinition>() // built first: stubbing inside whenever() breaks Mockito
        key?.let { whenever(definition.key).thenReturn(it) }
        val idQuery = mock<ProcessDefinitionQuery>()
        whenever(idQuery.singleResult()).thenReturn(definition)
        whenever(processDefinitionQuery.processDefinitionId(processDefinitionId)).thenReturn(idQuery)
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
