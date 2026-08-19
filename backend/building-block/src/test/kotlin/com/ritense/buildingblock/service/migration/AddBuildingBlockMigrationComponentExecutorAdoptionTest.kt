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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinition
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.domain.migration.AddBuildingBlockConfiguration
import com.ritense.buildingblock.domain.migration.AddBuildingBlockInstruction
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.repository.AddBuildingBlockConfigurationRepository
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.buildingblock.service.BuildingBlockInstanceService
import com.ritense.case_.service.migration.MigrationDataPatchApplier
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.valtimo.migration.domain.ProcessMigrationInstruction
import com.ritense.processdocument.migration.ProcessMigrationVariableResolver
import com.ritense.processdocument.service.ProcessDocumentAssociationService
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationWarnings
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.operaton.domain.OperatonExecution
import com.ritense.valtimo.operaton.repository.OperatonExecutionRepository
import com.ritense.valueresolver.ValueResolverService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.Mockito.RETURNS_DEEP_STUBS
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.repository.ProcessDefinition
import org.operaton.bpm.engine.runtime.ProcessInstance
import org.operaton.bpm.engine.runtime.ProcessInstanceQuery
import org.springframework.jdbc.core.JdbcTemplate
import java.util.Optional
import java.util.UUID

/**
 * The tree walk: what is adopted, what is left as a plain sub-process, and how far down it goes.
 *
 * Every fixture here is the shape a pre-building-block case has after migrating: one family of running
 * processes, all carrying the **case** document id as business key, nested by call activity. That
 * inherited business key is exactly what stops `addBuildingBlock` from reaching past the first level,
 * so the tests deliberately give every node the same business key.
 */
class AddBuildingBlockMigrationComponentExecutorAdoptionTest {

    private lateinit var configurationRepository: AddBuildingBlockConfigurationRepository
    private lateinit var dataPatchApplier: MigrationDataPatchApplier
    private lateinit var instanceRepository: BuildingBlockInstanceRepository
    private lateinit var instanceService: BuildingBlockInstanceService
    private lateinit var processDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository
    private lateinit var processLinkService: ProcessLinkService
    private lateinit var valueResolverService: ValueResolverService
    private lateinit var executionRepository: OperatonExecutionRepository
    private lateinit var runtimeService: RuntimeService
    private lateinit var repositoryService: RepositoryService
    private lateinit var jdbcTemplate: JdbcTemplate
    private lateinit var linkedResolver: LinkedBuildingBlockVersionResolver
    private lateinit var executor: AddBuildingBlockMigrationComponentExecutor

    private val target = CaseDefinitionId("bijstand", "1.0.1")
    private val migrationId = BlueprintMigrationId.from(target, "bijstand-bouwstenen")
    private val caseDocumentId: UUID = UUID.fromString("00000000-0000-0000-0000-0000000000aa")

    // Operaton process instance ids are UUIDs, and the process-document association insists on it.
    private val rootPi: String = UUID.fromString("00000000-0000-0000-0000-0000000000b1").toString()
    private val uitvoerenPi: String = UUID.fromString("00000000-0000-0000-0000-0000000000b2").toString()
    private val besluitPi: String = UUID.fromString("00000000-0000-0000-0000-0000000000b3").toString()

    /** The running tree under test. */
    private val nodes = mutableListOf<Node>()

    /** The plan's `addBuildingBlock` entries — what the author authorised. */
    private val authorised = mutableListOf<AddBuildingBlockInstruction>()

    /** What the executor created, in order. */
    private val created = mutableListOf<Created>()

    private data class Node(
        val processInstanceId: String,
        val processDefinitionId: String,
        val processDefinitionKey: String,
        val parent: String? = null,
        val callerActivityId: String? = null,
        val callerProcessDefinitionId: String? = null,
    )

    private data class Created(
        val key: String,
        val versionTag: String,
        val activityId: String?,
        val parentInstanceId: UUID?,
        val processInstanceId: String?,
        val instanceId: UUID,
        val documentId: UUID,
    )

    @BeforeEach
    fun setUp() {
        MigrationWarnings.clear()
        authorised.clear()
        configurationRepository = mock()
        dataPatchApplier = mock()
        instanceRepository = mock()
        instanceService = mock()
        processDefinitionRepository = mock()
        processLinkService = mock()
        valueResolverService = mock()
        executionRepository = mock()
        runtimeService = mock(defaultAnswer = RETURNS_DEEP_STUBS)
        repositoryService = mock()
        jdbcTemplate = mock()

        // The plan's entries are read once per run, and `authorised` is mutated by `declares` afterwards,
        // so the answer has to be computed at call time rather than captured here.
        whenever(configurationRepository.findById(migrationId))
            .thenAnswer { Optional.of(AddBuildingBlockConfiguration(migrationId, authorised.toList())) }

        whenever(instanceRepository.findByDocumentId(caseDocumentId)).thenReturn(null) // the owner is a case
        whenever(instanceRepository.findByProcessInstanceId(any())).thenReturn(null)
        whenever(processLinkService.getProcessLinks(any(), any())).thenReturn(emptyList())
        whenever(valueResolverService.resolveValues(any<String>(), any())).thenReturn(emptyMap())
        whenever(valueResolverService.preProcessValuesForNewDocument(any(), any()))
            .thenReturn(mapOf("doc" to emptyMap<String, Any>()))
        whenever(processDefinitionRepository.findAllByIdBuildingBlockDefinitionId(any())).thenReturn(emptyList())
        stubProcessInstanceQueries()
        stubCreate()

        linkedResolver = mock()
        // Everything the plan authorises is declared on a call activity in these fixtures, which is what
        // makes the tree walk (pass 2) rather than the business-key route (pass 1) own it. Computed at
        // call time because `authorised` is still being mutated by the tests' own setup.
        whenever(linkedResolver.resolveCallActivityReachable(target)).thenAnswer {
            authorised.map { BuildingBlockDefinitionId.of(it.buildingBlockKey, it.buildingBlockVersionTag) }.toSet()
        }

        executor = AddBuildingBlockMigrationComponentExecutor(
            ObjectMapper(),
            configurationRepository,
            instanceService,
            instanceRepository,
            processDefinitionRepository,
            processLinkService,
            linkedResolver,
            runtimeService,
            repositoryService,
            executionRepository,
            mock<ProcessMigrationVariableResolver>(),
            mock<ProcessDocumentAssociationService>(defaultAnswer = RETURNS_DEEP_STUBS),
            valueResolverService,
            dataPatchApplier,
            mock<AddBuildingBlockLinkChecker>(),
            mock<AddBuildingBlockProcessChecker>(),
            jdbcTemplate,
        )
    }

    @AfterEach
    fun tearDown() {
        MigrationWarnings.clear()
    }

    @Test
    fun `should adopt a running child the target version declares a building block`() {
        running(Node(rootPi, "bijstand-process:1", "bijstand-process"))
        running(
            Node(
                uitvoerenPi, "bijstand-uitvoeren:cd", "bijstand-uitvoeren",
                parent = rootPi, callerActivityId = "UitvoerenCallActivity",
                callerProcessDefinitionId = "bijstand-process:1",
            )
        )
        declares("bijstand-process:1", "UitvoerenCallActivity", "bijstand-uitvoeren", "1.0.0")
        deploys("bijstand-uitvoeren", "1.0.0", "bijstand-uitvoeren", "bijstand-uitvoeren:bb")

        executor.execute(migrationId, target, caseDocumentId)

        assertThat(created).singleElement().satisfies({
            assertThat(it.key).isEqualTo("bijstand-uitvoeren")
            assertThat(it.activityId).isEqualTo("UitvoerenCallActivity")
            assertThat(it.parentInstanceId).isNull() // directly under the case
            assertThat(it.processInstanceId).isEqualTo(uitvoerenPi)
        })
        // the running process moved from the case's deployment onto the block's
        verify(runtimeService).createMigrationPlan("bijstand-uitvoeren:cd", "bijstand-uitvoeren:bb")
        verify(jdbcTemplate).update(any<String>(), eq(created[0].documentId.toString()), eq(uitvoerenPi))
    }

    @Test
    fun `should adopt two levels in one run, nesting the second under the first`() {
        givenTwoLevelTree()

        executor.execute(migrationId, target, caseDocumentId)

        assertThat(created).hasSize(2)
        assertThat(created[0].key).isEqualTo("bijstand-uitvoeren")
        assertThat(created[1].key).isEqualTo("bijstand-besluit")
        // the nested block hangs off the block adopted a moment earlier, not off the case
        assertThat(created[1].parentInstanceId).isEqualTo(created[0].instanceId)
        assertThat(created[1].processInstanceId).isEqualTo(besluitPi)
        verify(runtimeService).createMigrationPlan("bijstand-besluit:cd", "bijstand-besluit:bb")
    }

    @Test
    fun `should leave an undeclared child a plain sub-process but still adopt a declared grandchild`() {
        givenTwoLevelTree()
        // the case version models 'uitvoeren' as a plain sub-process after all
        whenever(processLinkService.getProcessLinks("bijstand-process:1", "UitvoerenCallActivity"))
            .thenReturn(emptyList())

        executor.execute(migrationId, target, caseDocumentId)

        assertThat(created).singleElement().satisfies({
            assertThat(it.key).isEqualTo("bijstand-besluit")
            // its owner is still the case: the level above it never became a block
            assertThat(it.parentInstanceId).isNull()
        })
    }

    @Test
    fun `should descend into a child that is already a building block without adopting it again`() {
        givenTwoLevelTree()
        val existingId = UUID.randomUUID()
        val existing = mock<BuildingBlockInstance>()
        whenever(existing.id).thenReturn(existingId)
        whenever(existing.documentId).thenReturn(UUID.randomUUID())
        whenever(existing.processInstanceId).thenReturn(uitvoerenPi) // it already owns its process
        whenever(instanceRepository.findByProcessInstanceId(uitvoerenPi)).thenReturn(existing)

        executor.execute(migrationId, target, caseDocumentId)

        assertThat(created).singleElement().satisfies({
            assertThat(it.key).isEqualTo("bijstand-besluit")
            assertThat(it.parentInstanceId).isEqualTo(existingId)
        })
    }

    /**
     * The state the first live run turned up: a building-block process link attaches to *every*
     * deployment sharing the process definition key, so the runtime listener creates a block even on a
     * pre-migration case — one with no `processInstanceId`, since the listener never sets one. Adoption
     * must take that instance over rather than create a second document for the same running process.
     */
    @Test
    fun `should claim a half-formed block the runtime listener left on the call activity`() {
        givenTwoLevelTree()
        val halfFormedId = UUID.randomUUID()
        val halfFormedDocumentId = UUID.randomUUID()
        val halfFormed = mock<BuildingBlockInstance>()
        whenever(halfFormed.id).thenReturn(halfFormedId)
        whenever(halfFormed.documentId).thenReturn(halfFormedDocumentId)
        whenever(halfFormed.processInstanceId).thenReturn(null) // never given a process
        val definition = definitionOf("bijstand-besluit", "1.0.0") // built first: stubbing inside a
        whenever(halfFormed.definition).thenReturn(definition)     // whenever() argument breaks Mockito
        whenever(instanceRepository.findByDocumentId(halfFormedDocumentId)).thenReturn(halfFormed)
        whenever(instanceService.save(halfFormed)).thenReturn(halfFormed)
        // the listener recorded it on the call activity execution that started 'besluit'
        whenever(
            runtimeService.getVariableLocal("$uitvoerenPi-callactivity-execution", "buildingBlockDocumentId")
        ).thenReturn(halfFormedDocumentId.toString())

        executor.execute(migrationId, target, caseDocumentId)

        // only the outer block is new; the nested one was the existing instance, now given its process
        assertThat(created).singleElement().satisfies({ assertThat(it.key).isEqualTo("bijstand-uitvoeren") })
        verify(halfFormed).processInstanceId = besluitPi
        // and re-homed under the outer block: the listener had created it parentless
        verify(halfFormed).parentBuildingBlockInstanceId = created[0].instanceId
        verify(instanceService).save(halfFormed)
        verify(runtimeService).createMigrationPlan("bijstand-besluit:cd", "bijstand-besluit:bb")
    }

    private fun definitionOf(key: String, versionTag: String): BuildingBlockDefinition {
        val definition = mock<BuildingBlockDefinition>()
        whenever(definition.id).thenReturn(BuildingBlockDefinitionId.of(key, versionTag))
        return definition
    }

    @Test
    fun `should warn and adopt nothing when the declared version does not deploy the running process`() {
        running(Node(rootPi, "bijstand-process:1", "bijstand-process"))
        running(
            Node(
                uitvoerenPi, "bijstand-uitvoeren:cd", "bijstand-uitvoeren",
                parent = rootPi, callerActivityId = "UitvoerenCallActivity",
                callerProcessDefinitionId = "bijstand-process:1",
            )
        )
        declares("bijstand-process:1", "UitvoerenCallActivity", "bijstand-uitvoeren", "1.0.0")
        // ...but that block version deploys no such process definition

        executor.execute(migrationId, target, caseDocumentId)

        assertThat(created).isEmpty()
        verify(instanceService, never()).create(any(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull())
        assertThat(MigrationWarnings.drain())
            .contains("Left the running process 'bijstand-uitvoeren'")
            .contains("declares building block 'bijstand-uitvoeren:1.0.0'")
            .contains("does not deploy 'bijstand-uitvoeren'")
    }

    @Test
    fun `should not adopt a declared block the plan does not authorise`() {
        givenTwoLevelTree()
        // The links declare both levels, but the author asked for neither.
        authorised.clear()

        executor.execute(migrationId, target, caseDocumentId)

        assertThat(created).isEmpty()
        verify(runtimeService, never()).createMigrationPlan(any(), any())
    }

    @Test
    fun `should not adopt anything when the plan has no addBuildingBlock section`() {
        givenTwoLevelTree()
        authorised.clear()
        whenever(configurationRepository.findById(migrationId)).thenReturn(Optional.empty())

        executor.execute(migrationId, target, caseDocumentId)

        assertThat(created).isEmpty()
        // Not a warning either: a plan with no section is asking for no adoption, which is unremarkable.
        assertThat(MigrationWarnings.drain()).isNull()
    }

    @Test
    fun `should warn but keep walking when only the outer block is authorised`() {
        givenTwoLevelTree()
        authorised.removeIf { it.buildingBlockKey == "bijstand-besluit" }

        executor.execute(migrationId, target, caseDocumentId)

        assertThat(created).singleElement().satisfies({
            assertThat(it.key).isEqualTo("bijstand-uitvoeren")
        })
        assertThat(MigrationWarnings.drain())
            .contains("no 'addBuildingBlock' entry")
            .contains("bijstand-besluit:1.0.0")
    }

    @Test
    fun `should apply the entry's mapActivities on top of mapEqualActivities`() {
        running(Node(rootPi, "bijstand-process:1", "bijstand-process"))
        running(
            Node(
                uitvoerenPi, "bijstand-uitvoeren:cd", "bijstand-uitvoeren",
                parent = rootPi, callerActivityId = "UitvoerenCallActivity",
                callerProcessDefinitionId = "bijstand-process:1",
            )
        )
        declares("bijstand-process:1", "UitvoerenCallActivity", "bijstand-uitvoeren", "1.0.0")
        deploys("bijstand-uitvoeren", "1.0.0", "bijstand-uitvoeren", "bijstand-uitvoeren:bb")
        authorised.clear()
        authorises(
            "bijstand-uitvoeren", "1.0.0",
            mapActivities = mapOf("BeoordelenOud" to "BeoordelenNieuw"),
            processDefinitionKey = "bijstand-uitvoeren",
        )

        executor.execute(migrationId, target, caseDocumentId)

        assertThat(created).hasSize(1)
        verify(runtimeService.createMigrationPlan("bijstand-uitvoeren:cd", "bijstand-uitvoeren:bb").mapEqualActivities())
            .mapActivities("BeoordelenOud", "BeoordelenNieuw")
    }

    @Test
    fun `should do nothing when the owner has no running process at all`() {
        executor.execute(migrationId, target, caseDocumentId)

        assertThat(created).isEmpty()
        assertThat(MigrationWarnings.drain()).isNull()
    }

    /** case process → uitvoeren (declared) → besluit (declared by the block's own definition). */
    private fun givenTwoLevelTree() {
        running(Node(rootPi, "bijstand-process:1", "bijstand-process"))
        running(
            Node(
                uitvoerenPi, "bijstand-uitvoeren:cd", "bijstand-uitvoeren",
                parent = rootPi, callerActivityId = "UitvoerenCallActivity",
                callerProcessDefinitionId = "bijstand-process:1",
            )
        )
        running(
            Node(
                besluitPi, "bijstand-besluit:cd", "bijstand-besluit",
                parent = uitvoerenPi, callerActivityId = "BesluitCallActivity",
                // the caller has already been moved onto the block's deployment by the time it is read
                callerProcessDefinitionId = "bijstand-uitvoeren:bb",
            )
        )
        declares("bijstand-process:1", "UitvoerenCallActivity", "bijstand-uitvoeren", "1.0.0")
        declares("bijstand-uitvoeren:bb", "BesluitCallActivity", "bijstand-besluit", "1.0.0")
        deploys("bijstand-uitvoeren", "1.0.0", "bijstand-uitvoeren", "bijstand-uitvoeren:bb")
        deploys("bijstand-besluit", "1.0.0", "bijstand-besluit", "bijstand-besluit:bb")
    }

    /** Adds a node to the running tree, its calling execution and its process definition. */
    private fun running(node: Node) {
        nodes += node

        val processDefinition = mock<ProcessDefinition>()
        whenever(processDefinition.key).thenReturn(node.processDefinitionKey)
        whenever(repositoryService.getProcessDefinition(node.processDefinitionId)).thenReturn(processDefinition)

        val execution = mock<OperatonExecution>()
        if (node.parent != null) {
            val superExecution = mock<OperatonExecution>()
            whenever(superExecution.id).thenReturn("${node.parent}-callactivity-execution")
            whenever(superExecution.activityId).thenReturn(node.callerActivityId)
            whenever(superExecution.getProcessDefinitionId()).thenReturn(node.callerProcessDefinitionId)
            whenever(execution.superExecution).thenReturn(superExecution)
        } else {
            whenever(execution.superExecution).thenReturn(null)
        }
        whenever(executionRepository.findById(node.processInstanceId)).thenReturn(Optional.of(execution))
    }

    /**
     * The call activity [activityId] on [callerProcessDefinitionId] declares a building block, **and** the
     * plan authorises it. Both are required to adopt, and every test but
     * `should not adopt a declared block the plan does not authorise` wants both, so they are set together.
     */
    private fun declares(
        callerProcessDefinitionId: String,
        activityId: String,
        blockKey: String,
        blockVersionTag: String,
    ) {
        val link = mock<BuildingBlockProcessLink>()
        whenever(link.buildingBlockDefinitionId).thenReturn(BuildingBlockDefinitionId.of(blockKey, blockVersionTag))
        whenever(link.inputMappings).thenReturn(emptyList())
        whenever(processLinkService.getProcessLinks(callerProcessDefinitionId, activityId)).thenReturn(listOf(link))
        authorises(blockKey, blockVersionTag)
    }

    /** The plan carries an `addBuildingBlock` entry for [blockKey]:[blockVersionTag]. */
    private fun authorises(
        blockKey: String,
        blockVersionTag: String,
        mapActivities: Map<String, String> = emptyMap(),
        processDefinitionKey: String? = null,
    ) {
        authorised += AddBuildingBlockInstruction(
            buildingBlockKey = blockKey,
            buildingBlockVersionTag = blockVersionTag,
            processMigration = processDefinitionKey?.let {
                listOf(
                    ProcessMigrationInstruction(
                        sourceProcessDefinitionKey = it,
                        targetProcessDefinitionKey = it,
                        mapActivities = mapActivities,
                    )
                )
            }.orEmpty(),
        )
    }

    /** Building block version [blockKey]:[blockVersionTag] deploys [processDefinitionKey]. */
    private fun deploys(
        blockKey: String,
        blockVersionTag: String,
        processDefinitionKey: String,
        processDefinitionId: String,
    ) {
        val definition = mock<ProcessDefinitionBuildingBlockDefinition>(defaultAnswer = RETURNS_DEEP_STUBS)
        whenever(definition.processDefinitionKey).thenReturn(processDefinitionKey)
        whenever(definition.main).thenReturn(true)
        whenever(definition.id.processDefinitionId.id).thenReturn(processDefinitionId)
        whenever(
            processDefinitionRepository.findAllByIdBuildingBlockDefinitionId(
                BuildingBlockDefinitionId.of(blockKey, blockVersionTag)
            )
        ).thenReturn(listOf(definition))
    }

    private fun stubCreate() {
        whenever(instanceService.create(any(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull()))
            .thenAnswer { invocation ->
                val request = invocation.getArgument<NewDocumentRequest>(0)
                val instanceId = UUID.randomUUID()
                val documentId = UUID.randomUUID()
                val instance = mock<BuildingBlockInstance>()
                whenever(instance.id).thenReturn(instanceId)
                whenever(instance.documentId).thenReturn(documentId)
                created += Created(
                    key = request.buildingBlockDefinitionKey()!!,
                    versionTag = request.buildingBlockDefinitionVersionTag()!!,
                    activityId = invocation.getArgument(2),
                    parentInstanceId = invocation.getArgument(3),
                    processInstanceId = invocation.getArgument(4),
                    instanceId = instanceId,
                    documentId = documentId,
                )
                instance
            }
    }

    /**
     * A fresh query per call that answers from [nodes]: whichever filter the executor applied decides
     * what comes back, so one fake serves the business-key lookup, the child walk and the parent lookup.
     */
    private fun stubProcessInstanceQueries() {
        whenever(runtimeService.createProcessInstanceQuery()).thenAnswer {
            val filters = mutableMapOf<String, String>()
            val query = mock<ProcessInstanceQuery>()
            whenever(query.processInstanceBusinessKey(any())).thenAnswer { i ->
                filters["businessKey"] = i.getArgument(0); query
            }
            whenever(query.processDefinitionKey(any())).thenAnswer { i ->
                filters["processDefinitionKey"] = i.getArgument(0); query
            }
            whenever(query.superProcessInstanceId(any())).thenAnswer { i ->
                filters["childrenOf"] = i.getArgument(0); query
            }
            whenever(query.subProcessInstanceId(any())).thenAnswer { i ->
                filters["parentOf"] = i.getArgument(0); query
            }
            whenever(query.processInstanceId(any())).thenAnswer { i ->
                filters["id"] = i.getArgument(0); query
            }
            whenever(query.list()).thenAnswer { matching(filters) }
            whenever(query.singleResult()).thenAnswer { matching(filters).singleOrNull() }
            query
        }
    }

    private fun matching(filters: Map<String, String>): List<ProcessInstance> {
        val matched = when {
            // every node in this tree carries the case document id, as an inherited business key does
            filters.containsKey("businessKey") -> {
                val own = if (filters["businessKey"] == caseDocumentId.toString()) nodes else emptyList()
                // pass 1 narrows by process definition key as well
                filters["processDefinitionKey"]?.let { key -> own.filter { it.processDefinitionKey == key } } ?: own
            }

            filters.containsKey("childrenOf") -> nodes.filter { it.parent == filters["childrenOf"] }
            filters.containsKey("parentOf") -> {
                val child = nodes.singleOrNull { it.processInstanceId == filters["parentOf"] }
                nodes.filter { it.processInstanceId == child?.parent }
            }

            filters.containsKey("id") -> nodes.filter { it.processInstanceId == filters["id"] }
            else -> emptyList()
        }
        return matched.map { node ->
            val instance = mock<ProcessInstance>()
            whenever(instance.processInstanceId).thenReturn(node.processInstanceId)
            whenever(instance.processDefinitionId).thenReturn(node.processDefinitionId)
            instance
        }
    }
}
