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

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.JsonNodeFactory
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.domain.CaseDefinitionBuildingBlockLink
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinition
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinitionId
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.exception.BuildingBlockReferenceUpdateException
import com.ritense.buildingblock.processlink.domain.BuildingBlockInputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockOutputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.processlink.dto.BuildingBlockInputMappingDto
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateChainDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateChainResolutionDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateContainerType.BUILDING_BLOCK
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateContainerType.CASE
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateExecuteRequestDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdatePreviewDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdatePreviewRequestDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceKind
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateResultDto
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.document.domain.impl.JsonSchema
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.repository.impl.JsonSchemaDocumentDefinitionRepository
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.repository.ProcessDefinitionCaseDefinitionRepository
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.service.OperatonProcessService
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.model.bpmn.instance.CallActivity
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.transaction.support.TransactionTemplate
import java.io.ByteArrayInputStream
import java.time.LocalDateTime
import java.util.UUID

/** Each test builds its own uniquely keyed fixture. */
class BuildingBlockReferenceUpdateIT @Autowired constructor(
    private val referenceUpdateService: BuildingBlockReferenceUpdateService,
    private val caseDefinitionRepository: CaseDefinitionRepository,
    private val documentDefinitionRepository: JsonSchemaDocumentDefinitionRepository,
    private val documentService: DocumentService,
    private val operatonProcessService: OperatonProcessService,
    private val repositoryService: RepositoryService,
    private val processLinkRepository: ProcessLinkRepository,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    private val processDefinitionCaseDefinitionRepository: ProcessDefinitionCaseDefinitionRepository,
    private val caseDefinitionBuildingBlockLinkRepository: CaseDefinitionBuildingBlockLinkRepository,
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val transactionTemplate: TransactionTemplate,
    private val mockMvc: MockMvc,
    private val objectMapper: ObjectMapper,
) : BaseIntegrationTest() {

    @Test
    fun `lists the direct references to a version, cases first`() {
        val f = workedExample()
        caseDefinitionBuildingBlockLinkRepository.saveAndFlush(
            CaseDefinitionBuildingBlockLink(caseDefinitionId = f.income, buildingBlockDefinitionId = f.sendEmail100)
        )
        // A link in a process nothing owns is not a reference.
        processLinkRepository.saveAndFlush(
            buildingBlockLink("orphan-process:1:${f.uid}", "callOrphan", f.sendEmail101)
        )

        val references = references(f.sendEmail100)

        assertThat(references.map { "${it.container.type} ${it.container.key} ${it.kind} ${it.processDefinitionKey}#${it.activityId}" })
            .containsExactly(
                "CASE ${f.income.key} CASE_LINK null#null",
                "CASE ${f.moving.key} PROCESS_LINK mv-${f.uid}#callSendEmail",
                "BUILDING_BLOCK ${f.notify110.key} PROCESS_LINK nt-${f.uid}#callSendEmail",
            )
        assertThat(references.single { it.container.key == f.moving.key }.container.final).isFalse()
        assertThat(references(f.sendEmail101)).isEmpty()
    }

    @Test
    fun `previews every chain to the source with its full path, draft labels and default selection`() {
        val f = workedExample()

        val preview = preview(f.sendEmail100, f.sendEmail101)

        assertThat(preview.chains).hasSize(2)
        val moving = chainWithTop(preview, f.moving.key)
        assertThat(moving.containers.map { "${it.type}:${it.key}:${it.versionTag}:${it.final}" })
            .containsExactly("$CASE:${f.moving.key}:1.3.0:false")
        assertThat(moving.selectedByDefault).isTrue()
        assertThat(moving.selected).isTrue()
        assertThat(moving.requiresDrafts).isFalse()
        assertThat(moving.modifiesExistingDraft).isFalse()
        assertThat(moving.updatable).isTrue()
        assertThat(moving.link.kind).isEqualTo(BuildingBlockReferenceKind.PROCESS_LINK)
        assertThat(moving.link.activityId).isEqualTo("callSendEmail")
        assertThat(moving.link.buildingBlockVersionTag).isEqualTo("1.0.0")

        val income = chainWithTop(preview, f.income.key)
        assertThat(income.containers.map { "${it.type}:${it.key}:${it.versionTag}:${it.final}" }).containsExactly(
            "$CASE:${f.income.key}:2.0.0:true",
            "$BUILDING_BLOCK:${f.notify110.key}:1.1.0:true",
        )
        assertThat(income.references.map { "${it.container.key}#${it.activityId}->${it.buildingBlockKey}:${it.buildingBlockVersionTag}" })
            .containsExactly(
                "${f.income.key}#callNotify->${f.notify110}",
                "${f.notify110.key}#callSendEmail->${f.sendEmail100}",
            )
        assertThat(income.link).isEqualTo(income.references.last())
        assertThat(income.selectedByDefault).isFalse()
        assertThat(income.selected).isFalse()
        assertThat(income.requiresDrafts).isTrue()

        // Finalized chain skipped until opted in
        assertThat(preview.changeset.draftsToCreate).isEmpty()
        assertThat(preview.changeset.skippedChainIds).containsExactly(income.id)

        val optedIn = preview(f.sendEmail100, f.sendEmail101, selected = listOf(moving.id, income.id))
        assertThat(optedIn.changeset.draftsToCreate.map { "${it.type}:${it.key}:${it.basedOnVersionTag}->${it.versionTag}" })
            .containsExactlyInAnyOrder(
                "$CASE:${f.income.key}:2.0.0->2.0.1",
                "$BUILDING_BLOCK:${f.notify110.key}:1.1.0->1.1.1",
            )
        assertThat(optedIn.changeset.draftsToModify.map { "${it.key}:${it.versionTag}" })
            .containsExactly("${f.moving.key}:1.3.0")
        assertThat(
            optedIn.changeset.linksToRepoint.map {
                "${it.container.key}:${it.container.versionTag}#${it.activityId}:" +
                    "${it.fromVersionTag}->${it.toVersionTag}:${it.containerReference}"
            }
        )
            .containsExactlyInAnyOrder(
                "${f.moving.key}:1.3.0#callSendEmail:1.0.0->1.0.1:false",
                "${f.notify110.key}:1.1.1#callSendEmail:1.0.0->1.0.1:false",
                "${f.income.key}:2.0.1#callNotify:1.1.0->1.1.1:true",
            )
        assertThat(optedIn.changeset.skippedChainIds).isEmpty()
    }

    @Test
    fun `updates the worked example from the issue`() {
        val f = workedExample()
        var instanceDefinitionAfter: BuildingBlockDefinitionId? = null
        val instanceDocumentId = createBuildingBlockDocument(f.notify110)
        val instance = buildingBlockInstanceRepository.saveAndFlush(
            BuildingBlockInstance(documentId = instanceDocumentId, definition = definitionOf(f.notify110))
        )
        val preview = preview(f.sendEmail100, f.sendEmail101)

        val result = try {
            execute(f.sendEmail100, f.sendEmail101, preview.chains.map { it.id })
        } finally {
            instanceDefinitionAfter = transactionTemplate.execute {
                buildingBlockInstanceRepository.findById(instance.id).orElseThrow().definition.id
            }
            // Other tests count every instance in the shared database.
            buildingBlockInstanceRepository.deleteById(instance.id)
        }

        // Draft moving 1.3.0 updated in place
        val movingLink = linkIn(ReferenceContainer.of(f.moving), "mv-${f.uid}", "callSendEmail")
        assertThat(movingLink.buildingBlockDefinitionId).isEqualTo(f.sendEmail101)
        assertThat(calledVersionTag(movingLink)).isEqualTo("BB:${f.sendEmail101}")
        assertThat(caseDefinitionRepository.findAllByIdKeyOrderByIdVersionTagDesc(f.moving.key)).hasSize(1)

        // A new notify draft based on 1.1.0, pointing to send-email 1.0.1.
        val notifyDraft = BuildingBlockDefinitionId.of(f.notify110.key, "1.1.1")
        val notifyDraftDefinition = definitionOf(notifyDraft)
        assertThat(notifyDraftDefinition.final).isFalse()
        assertThat(notifyDraftDefinition.basedOnVersionTag.toString()).isEqualTo("1.1.0")
        val notifyDraftLink = linkIn(ReferenceContainer.of(notifyDraft), "nt-${f.uid}", "callSendEmail")
        assertThat(notifyDraftLink.buildingBlockDefinitionId).isEqualTo(f.sendEmail101)
        assertThat(calledVersionTag(notifyDraftLink)).isEqualTo("BB:${f.sendEmail101}")

        // A new income draft based on 2.0.0, pointing to the new notify draft.
        val incomeDraft = CaseDefinitionId.of(f.income.key, "2.0.1")
        val incomeDraftDefinition = caseDefinitionRepository.findById(incomeDraft).orElseThrow()
        assertThat(incomeDraftDefinition.final).isFalse()
        assertThat(incomeDraftDefinition.basedOnVersionTag.toString()).isEqualTo("2.0.0")
        val incomeDraftLink = linkIn(ReferenceContainer.of(incomeDraft), "in-${f.uid}", "callNotify")
        assertThat(incomeDraftLink.buildingBlockDefinitionId).isEqualTo(notifyDraft)
        assertThat(calledVersionTag(incomeDraftLink)).isEqualTo("BB:$notifyDraft")
        assertThat(calledElement(incomeDraftLink)).isEqualTo("nt-${f.uid}")

        // income 2.0.0 and notify 1.1.0 remain untouched.
        assertThat(linkIn(ReferenceContainer.of(f.income), "in-${f.uid}", "callNotify").buildingBlockDefinitionId)
            .isEqualTo(f.notify110)
        val notifyLink = linkIn(ReferenceContainer.of(f.notify110), "nt-${f.uid}", "callSendEmail")
        assertThat(notifyLink.buildingBlockDefinitionId).isEqualTo(f.sendEmail100)
        assertThat(calledVersionTag(notifyLink)).isEqualTo("BB:${f.sendEmail100}")
        assertThat(definitionOf(f.notify110).final).isTrue()
        assertThat(caseDefinitionRepository.findById(f.income).orElseThrow().final).isTrue()

        // The summary.
        assertThat(result.chainsUpdatedDirectly).containsExactly(chainWithTop(preview, f.moving.key).id)
        assertThat(result.draftsCreated.map { "${it.type}:${it.key}:${it.basedOnVersionTag}->${it.versionTag}" })
            .containsExactlyInAnyOrder(
                "$CASE:${f.income.key}:2.0.0->2.0.1",
                "$BUILDING_BLOCK:${f.notify110.key}:1.1.0->1.1.1",
            )
        assertThat(result.draftsModified.map { "${it.key}:${it.versionTag}" }).containsExactly("${f.moving.key}:1.3.0")
        assertThat(result.linksRepointed).hasSize(3)
        assertThat(result.skippedChainIds).isEmpty()
        assertThat(result.remainingReferences.map { "${it.container.key}:${it.container.versionTag}#${it.activityId}" })
            .containsExactly("${f.notify110.key}:1.1.0#callSendEmail")

        // Nothing is finalized and no running building block is touched.
        verify(buildingBlockManagementService, never()).finalize(any(), any())
        assertThat(instanceDefinitionAfter).isEqualTo(f.notify110)
    }

    @Test
    fun `a deselected chain is skipped and keeps the source version`() {
        val f = workedExample()
        val preview = preview(f.sendEmail100, f.sendEmail101)

        val result = execute(f.sendEmail100, f.sendEmail101, listOf(chainWithTop(preview, f.moving.key).id))

        assertThat(result.skippedChainIds).containsExactly(chainWithTop(preview, f.income.key).id)
        assertThat(result.draftsCreated).isEmpty()
        assertThat(buildingBlockDefinitionRepository.findAllByIdKeyOrderByIdVersionTag(f.notify110.key)).hasSize(1)
        assertThat(caseDefinitionRepository.findAllByIdKeyOrderByIdVersionTagDesc(f.income.key)).hasSize(1)
        assertThat(result.remainingReferences.map { "${it.container.key}#${it.activityId}" })
            .containsExactly("${f.notify110.key}#callSendEmail")
    }

    @Test
    fun `a container shared by several chains gets one draft`() {
        val uid = uid()
        val sendEmail100 = buildingBlock("send-email-$uid", "1.0.0", final = true)
        val sendEmail101 = buildingBlock("send-email-$uid", "1.0.1", final = true)
        deployBuildingBlockProcess(sendEmail100, "se-$uid", calls = emptyList())
        deployBuildingBlockProcess(sendEmail101, "se-$uid", calls = emptyList())
        val notify = buildingBlock("notify-$uid", "1.1.0", final = true)
        deployBuildingBlockProcess(notify, "nt-$uid", calls = listOf("callSendEmail" to sendEmail100))
        val caseA = case("case-a-$uid", "1.0.0", final = true, processKey = "ca-$uid", calls = listOf("callNotify" to notify))
        val caseB = case("case-b-$uid", "1.0.0", final = true, processKey = "cb-$uid", calls = listOf("callNotify" to notify))

        val preview = preview(sendEmail100, sendEmail101)
        assertThat(preview.chains).hasSize(2)
        val result = execute(sendEmail100, sendEmail101, preview.chains.map { it.id })

        assertThat(result.draftsCreated.filter { it.key == notify.key }).hasSize(1)
        assertThat(buildingBlockDefinitionRepository.findAllByIdKeyOrderByIdVersionTag(notify.key)).hasSize(2)
        val notifyDraft = BuildingBlockDefinitionId.of(notify.key, "1.1.1")
        listOf(caseA to "ca-$uid", caseB to "cb-$uid").forEach { (case, processKey) ->
            val draft = CaseDefinitionId.of(case.key, "1.0.1")
            assertThat(linkIn(ReferenceContainer.of(draft), processKey, "callNotify").buildingBlockDefinitionId)
                .isEqualTo(notifyDraft)
        }
    }

    @Test
    fun `two final versions of one container never get two new drafts`() {
        val uid = uid()
        val sendEmail100 = buildingBlock("send-email-$uid", "1.0.0", final = true)
        val sendEmail101 = buildingBlock("send-email-$uid", "1.0.1", final = true)
        deployBuildingBlockProcess(sendEmail100, "se-$uid", calls = emptyList())
        deployBuildingBlockProcess(sendEmail101, "se-$uid", calls = emptyList())
        val orders100 = case("orders-$uid", "1.0.0", final = true, processKey = "or-$uid", calls = listOf("callSendEmail" to sendEmail100))
        case("orders-$uid", "2.0.0", final = true, processKey = "or-$uid", calls = listOf("callSendEmail" to sendEmail100))

        val chainIds = preview(sendEmail100, sendEmail101).chains.map { it.id }
        val conflicting = preview(sendEmail100, sendEmail101, chainIds).chains.single { !it.updatable }
        assertThat(conflicting.notUpdatableReason).contains("new draft of ${orders100.key}")
        assertThatThrownBy { execute(sendEmail100, sendEmail101, chainIds) }
            .isInstanceOf(BuildingBlockReferenceUpdateException::class.java)

        val result = execute(sendEmail100, sendEmail101, chainIds - conflicting.id)

        assertThat(result.draftsCreated).hasSize(1)
        assertThat(caseDefinitionRepository.findAllByIdKeyOrderByIdVersionTagDesc(orders100.key)).hasSize(3)
    }

    @Test
    fun `a container with an open draft gets no second draft and the chain says so`() {
        val uid = uid()
        val sendEmail100 = buildingBlock("send-email-$uid", "1.0.0", final = true)
        val sendEmail101 = buildingBlock("send-email-$uid", "1.0.1", final = true)
        deployBuildingBlockProcess(sendEmail100, "se-$uid", calls = emptyList())
        deployBuildingBlockProcess(sendEmail101, "se-$uid", calls = emptyList())
        val released = case("orders-$uid", "1.0.0", final = true, processKey = "or-$uid", calls = listOf("callSendEmail" to sendEmail100))
        case("orders-$uid", "1.1.0", final = false, processKey = "or-$uid", calls = listOf("callSendEmail" to sendEmail100), basedOn = "1.0.0")

        val preview = preview(sendEmail100, sendEmail101)
        val throughFinal = preview.chains.single { it.containers.single().versionTag == "1.0.0" }
        assertThat(throughFinal.modifiesExistingDraft).isTrue()
        assertThat(throughFinal.requiresDrafts).isFalse()
        assertThat(throughFinal.existingDrafts.single().draftVersionTag).isEqualTo("1.1.0")
        assertThat(throughFinal.existingDrafts.single().draftBasedOnVersionTag).isEqualTo("1.0.0")

        val result = execute(sendEmail100, sendEmail101, preview.chains.map { it.id })

        assertThat(result.draftsCreated).isEmpty()
        assertThat(result.draftsModified.map { "${it.key}:${it.versionTag}" }).containsExactly("${released.key}:1.1.0")
        assertThat(caseDefinitionRepository.findAllByIdKeyOrderByIdVersionTagDesc(released.key)).hasSize(2)
        val openDraft = CaseDefinitionId.of(released.key, "1.1.0")
        assertThat(linkIn(ReferenceContainer.of(openDraft), "or-$uid", "callSendEmail").buildingBlockDefinitionId)
            .isEqualTo(sendEmail101)
        assertThat(linkIn(ReferenceContainer.of(released), "or-$uid", "callSendEmail").buildingBlockDefinitionId)
            .isEqualTo(sendEmail100)
    }

    @Test
    fun `an open draft that no longer holds the reference makes the chain not updatable`() {
        val uid = uid()
        val sendEmail100 = buildingBlock("send-email-$uid", "1.0.0", final = true)
        val sendEmail101 = buildingBlock("send-email-$uid", "1.0.1", final = true)
        deployBuildingBlockProcess(sendEmail100, "se-$uid", calls = emptyList())
        deployBuildingBlockProcess(sendEmail101, "se-$uid", calls = emptyList())
        case("orders-$uid", "1.0.0", final = true, processKey = "or-$uid", calls = listOf("callSendEmail" to sendEmail100))
        case("orders-$uid", "1.1.0", final = false, processKey = "or-$uid", calls = emptyList(), basedOn = "1.0.0")

        val chain = preview(sendEmail100, sendEmail101).chains.single()

        assertThat(chain.updatable).isFalse()
        assertThat(chain.notUpdatableReason).contains("1.1.0").contains("no longer contains the reference")
        assertThatThrownBy { execute(sendEmail100, sendEmail101, listOf(chain.id)) }
            .isInstanceOf(BuildingBlockReferenceUpdateException::class.java)
            .hasMessageContaining("cannot be updated")
        assertThat(caseDefinitionRepository.findAllByIdKeyOrderByIdVersionTagDesc("orders-$uid")).hasSize(2)
    }

    @Test
    fun `an open draft whose link already points to a third version is left alone and the chain is not updatable`() {
        val uid = uid()
        val sendEmail100 = buildingBlock("send-email-$uid", "1.0.0", final = true)
        val sendEmail101 = buildingBlock("send-email-$uid", "1.0.1", final = true)
        val sendEmail102 = buildingBlock("send-email-$uid", "1.0.2", final = true)
        listOf(sendEmail100, sendEmail101, sendEmail102).forEach { deployBuildingBlockProcess(it, "se-$uid", calls = emptyList()) }
        case("orders-$uid", "1.0.0", final = true, processKey = "or-$uid", calls = listOf("callSendEmail" to sendEmail100))
        val openDraft = case(
            "orders-$uid", "1.1.0", final = false, processKey = "or-$uid", calls = listOf("callSendEmail" to sendEmail100), basedOn = "1.0.0"
        )
        pointLinkAt(openDraft, "or-$uid", "callSendEmail", sendEmail102)

        val chain = preview(sendEmail100, sendEmail101).chains.single()

        assertThat(chain.updatable).isFalse()
        assertThat(chain.notUpdatableReason).contains("1.1.0").contains("no longer contains the reference")
        assertThatThrownBy { execute(sendEmail100, sendEmail101, listOf(chain.id)) }
            .isInstanceOf(BuildingBlockReferenceUpdateException::class.java)
            .hasMessageContaining("cannot be updated")
        assertThat(linkIn(ReferenceContainer.of(openDraft), "or-$uid", "callSendEmail").buildingBlockDefinitionId).isEqualTo(sendEmail102)
    }

    @Test
    fun `an open draft that points a container higher up at another version is left alone and the chain is not updatable`() {
        val uid = uid()
        val sendEmail100 = buildingBlock("send-email-$uid", "1.0.0", final = true)
        val sendEmail101 = buildingBlock("send-email-$uid", "1.0.1", final = true)
        listOf(sendEmail100, sendEmail101).forEach { deployBuildingBlockProcess(it, "se-$uid", calls = emptyList()) }
        val wrapper100 = buildingBlock("wrapper-$uid", "1.0.0", final = true)
        deployBuildingBlockProcess(wrapper100, "wr-$uid", calls = listOf("callSendEmail" to sendEmail100))
        val wrapper200 = buildingBlock("wrapper-$uid", "2.0.0", final = true)
        deployBuildingBlockProcess(wrapper200, "wr-$uid", calls = emptyList())
        case("orders-$uid", "1.0.0", final = true, processKey = "or-$uid", calls = listOf("callWrapper" to wrapper100))
        val openDraft = case(
            "orders-$uid", "1.1.0", final = false, processKey = "or-$uid", calls = listOf("callWrapper" to wrapper100), basedOn = "1.0.0"
        )
        pointLinkAt(openDraft, "or-$uid", "callWrapper", wrapper200)

        val chain = preview(sendEmail100, sendEmail101).chains.single()

        assertThat(chain.updatable).isFalse()
        assertThat(chain.notUpdatableReason).contains("1.1.0").contains("no longer contains the reference")
        assertThatThrownBy { execute(sendEmail100, sendEmail101, listOf(chain.id)) }
            .isInstanceOf(BuildingBlockReferenceUpdateException::class.java)
            .hasMessageContaining("cannot be updated")
        assertThat(linkIn(ReferenceContainer.of(openDraft), "or-$uid", "callWrapper").buildingBlockDefinitionId).isEqualTo(wrapper200)
    }

    @Test
    fun `reports the differences per chain, refuses an unconfigured chain and applies the resolution`() {
        val uid = uid()
        val sendEmail100 = buildingBlock("send-email-$uid", "1.0.0", final = true, properties = listOf("recipient", "legacy"))
        val sendEmail101 = buildingBlock(
            "send-email-$uid", "1.0.1", final = true, properties = listOf("recipient", "subject"), required = listOf("subject")
        )
        deployBuildingBlockProcess(sendEmail100, "se-$uid", calls = emptyList())
        deployBuildingBlockProcess(sendEmail101, "se-$uid", calls = emptyList())
        val wrapper = buildingBlock("wrapper-$uid", "1.0.0", final = true)
        deployBuildingBlockProcess(
            wrapper,
            "wr-$uid",
            calls = listOf("callSendEmail" to sendEmail100),
            inputMappings = listOf(
                BuildingBlockInputMapping("doc:/to", "doc:/recipient"),
                BuildingBlockInputMapping("doc:/old", "doc:/legacy"),
            ),
            outputMappings = listOf(BuildingBlockOutputMapping("doc:/legacy", "doc:/old")),
        )
        val orders = case("orders-$uid", "1.0.0", final = false, processKey = "or-$uid", calls = listOf("callWrapper" to wrapper))
        doReturn(setOf(PLUGIN_DEFINITION_KEY))
            .whenever(buildingBlockPluginDefinitionService).getPluginDefinitionKeysForBuildingBlock(eq(sendEmail101))

        val chain = preview(sendEmail100, sendEmail101).chains.single()
        val differences = chain.differences
        assertThat(differences.missingRequiredInputs).containsExactly("/subject")
        assertThat(differences.droppedInputMappings.map { it.target }).containsExactly("doc:/legacy")
        assertThat(differences.droppedOutputMappings.map { it.source }).containsExactly("doc:/legacy")
        assertThat(differences.missingPluginDefinitionKeys).containsExactly(PLUGIN_DEFINITION_KEY)
        // Plugin configurations go on the case's link to the outermost block
        assertThat(differences.pluginConfigurationLink!!.container.key).isEqualTo(orders.key)
        assertThat(differences.pluginConfigurationLink!!.activityId).isEqualTo("callWrapper")
        assertThat(differences.configured).isFalse()

        val linkCountBefore = processLinkRepository.count()
        assertThatThrownBy { execute(sendEmail100, sendEmail101, listOf(chain.id)) }
            .isInstanceOf(BuildingBlockReferenceUpdateException::class.java)
            .hasMessageContaining("not fully configured")
            .hasMessageContaining("/subject")
            .hasMessageContaining(PLUGIN_DEFINITION_KEY)
        assertThat(buildingBlockDefinitionRepository.findAllByIdKeyOrderByIdVersionTag(wrapper.key)).hasSize(1)
        assertThat(processLinkRepository.count()).isEqualTo(linkCountBefore)

        val resolution = BuildingBlockReferenceUpdateChainResolutionDto(
            chainId = chain.id,
            inputMappings = listOf(BuildingBlockInputMappingDto("doc:/title", "doc:/subject")),
            pluginConfigurations = mapOf(PLUGIN_DEFINITION_KEY to PLUGIN_CONFIGURATION_ID),
        )
        val resolved = referenceUpdateService.previewAsAdmin(
            BuildingBlockReferenceUpdatePreviewRequestDto(sendEmail100.key, "1.0.0", "1.0.1", listOf(chain.id), listOf(resolution))
        ).chains.single().differences
        assertThat(resolved.configured).isTrue()
        assertThat(resolved.unresolvedRequiredInputs).isEmpty()
        assertThat(resolved.unresolvedPluginDefinitionKeys).isEmpty()

        execute(sendEmail100, sendEmail101, listOf(chain.id), listOf(resolution))

        val wrapperDraftLink = linkIn(ReferenceContainer.of(BuildingBlockDefinitionId.of(wrapper.key, "1.0.1")), "wr-$uid", "callSendEmail")
        assertThat(wrapperDraftLink.buildingBlockDefinitionId).isEqualTo(sendEmail101)
        assertThat(wrapperDraftLink.inputMappings.map { "${it.source}->${it.target}" })
            .containsExactly("doc:/to->doc:/recipient", "doc:/title->doc:/subject")
        assertThat(wrapperDraftLink.outputMappings).isEmpty()
        assertThat(wrapperDraftLink.pluginConfigurationMappings).isEmpty()
        val caseLink = linkIn(ReferenceContainer.of(orders), "or-$uid", "callWrapper")
        assertThat(caseLink.buildingBlockDefinitionId).isEqualTo(BuildingBlockDefinitionId.of(wrapper.key, "1.0.1"))
        assertThat(caseLink.pluginConfigurationMappings).containsEntry(PLUGIN_DEFINITION_KEY, PLUGIN_CONFIGURATION_ID)
    }

    @Test
    fun `re-points a case definition building block link`() {
        val uid = uid()
        val sendEmail100 = buildingBlock("send-email-$uid", "1.0.0", final = true)
        val sendEmail101 = buildingBlock("send-email-$uid", "1.0.1", final = true)
        deployBuildingBlockProcess(sendEmail100, "se-$uid", calls = emptyList())
        deployBuildingBlockProcess(sendEmail101, "se-$uid", calls = emptyList())
        val orders = case("orders-$uid", "1.0.0", final = true, processKey = "or-$uid", calls = emptyList())
        caseDefinitionBuildingBlockLinkRepository.saveAndFlush(
            CaseDefinitionBuildingBlockLink(
                caseDefinitionId = orders,
                buildingBlockDefinitionId = sendEmail100,
                inputMappings = listOf(BuildingBlockInputMapping("doc:/to", "doc:/recipient")),
                startableByUser = false,
            )
        )

        val chain = preview(sendEmail100, sendEmail101).chains.single()
        assertThat(chain.link.kind).isEqualTo(BuildingBlockReferenceKind.CASE_LINK)
        val result = execute(sendEmail100, sendEmail101, listOf(chain.id))

        assertThat(result.draftsCreated.map { "${it.key}:${it.versionTag}" }).containsExactly("${orders.key}:1.0.1")
        val draftLink = caseDefinitionBuildingBlockLinkRepository
            .findAllByCaseDefinitionId(CaseDefinitionId.of(orders.key, "1.0.1")).single()
        assertThat(draftLink.buildingBlockDefinitionId).isEqualTo(sendEmail101)
        assertThat(draftLink.inputMappings.map { it.target }).containsExactly("doc:/recipient")
        assertThat(caseDefinitionBuildingBlockLinkRepository.findAllByCaseDefinitionId(orders).single().buildingBlockDefinitionId)
            .isEqualTo(sendEmail100)
    }

    @Test
    fun `updates a call activity to another building block`() {
        val uid = uid()
        val sendEmail = buildingBlock("send-email-$uid", "1.0.0", final = true)
        deployBuildingBlockProcess(sendEmail, "se-$uid", calls = emptyList())
        val sendLetter = buildingBlock("send-letter-$uid", "3.1.0", final = true)
        deployBuildingBlockProcess(sendLetter, "sl-$uid", calls = emptyList())
        val orders = case("orders-$uid", "1.0.0", final = true, processKey = "or-$uid", calls = listOf("callSendEmail" to sendEmail))

        val preview = preview(sendEmail, sendLetter)
        assertThat(preview.targetKey).isEqualTo(sendLetter.key)
        val result = execute(sendEmail, sendLetter, preview.chains.map { it.id })

        val ordersDraft = CaseDefinitionId.of(orders.key, "2.0.0")
        assertThat(result.draftsCreated.map { "${it.key}:${it.versionTag}" }).containsExactly("${orders.key}:2.0.0")
        val draftLink = linkIn(ReferenceContainer.of(ordersDraft), "or-$uid", "callSendEmail")
        assertThat(draftLink.buildingBlockDefinitionId).isEqualTo(sendLetter)
        assertThat(calledElement(draftLink)).isEqualTo("sl-$uid")
        assertThat(calledVersionTag(draftLink)).isEqualTo("BB:$sendLetter")
        assertThat(result.linksRepointed.single().toBuildingBlockKey).isEqualTo(sendLetter.key)
        assertThat(linkIn(ReferenceContainer.of(orders), "or-$uid", "callSendEmail").buildingBlockDefinitionId).isEqualTo(sendEmail)
    }

    @Test
    fun `updates a case definition building block link to another building block unless the case already links it`() {
        val uid = uid()
        val sendEmail = buildingBlock("send-email-$uid", "1.0.0", final = true)
        val sendLetter = buildingBlock("send-letter-$uid", "1.0.0", final = true)
        val orders = case("orders-$uid", "1.0.0", final = false, processKey = "or-$uid", calls = emptyList())
        val returns = case("returns-$uid", "1.0.0", final = false, processKey = "re-$uid", calls = emptyList())
        listOf(orders to sendEmail, returns to sendEmail, returns to sendLetter).forEach { (case, child) ->
            caseDefinitionBuildingBlockLinkRepository.saveAndFlush(
                CaseDefinitionBuildingBlockLink(caseDefinitionId = case, buildingBlockDefinitionId = child)
            )
        }

        val preview = preview(sendEmail, sendLetter)
        val returnsChain = chainWithTop(preview, returns.key)
        assertThat(returnsChain.updatable).isFalse()
        assertThat(returnsChain.notUpdatableReason).contains("already links building block ${sendLetter.key}")
        execute(sendEmail, sendLetter, listOf(chainWithTop(preview, orders.key).id))

        assertThat(caseDefinitionBuildingBlockLinkRepository.findAllByCaseDefinitionId(orders).single().buildingBlockDefinitionId)
            .isEqualTo(sendLetter)
        assertThat(caseDefinitionBuildingBlockLinkRepository.findAllByCaseDefinitionId(returns).map { it.buildingBlockDefinitionId })
            .containsExactlyInAnyOrder(sendEmail, sendLetter)
    }

    @Test
    fun `a target that uses the draft it would be linked from is not updatable`() {
        val uid = uid()
        val sendEmail = buildingBlock("send-email-$uid", "1.0.0", final = true)
        deployBuildingBlockProcess(sendEmail, "se-$uid", calls = emptyList())
        val notify = buildingBlock("notify-$uid", "1.0.0", final = false)
        deployBuildingBlockProcess(notify, "nt-$uid", calls = listOf("callSendEmail" to sendEmail))
        val bundle = buildingBlock("bundle-$uid", "1.0.0", final = true)
        deployBuildingBlockProcess(bundle, "bu-$uid", calls = listOf("callNotify" to notify))

        val chain = preview(sendEmail, bundle).chains.single()

        assertThat(chain.updatable).isFalse()
        assertThat(chain.notUpdatableReason).contains("creates a cycle")
    }

    @Test
    fun `a failure halfway rolls back every draft, link, ownership row and deployment`() {
        val f = workedExample()
        // Non-call-activity link: invisible to preview, fails on execute
        val broken = case("zz-broken-${f.uid}", "1.0.0", final = false, processKey = "br-${f.uid}", calls = emptyList(), userTask = "notACall")
        processLinkRepository.saveAndFlush(
            buildingBlockLink(processDefinitionIn(ReferenceContainer.of(broken), "br-${f.uid}"), "notACall", f.sendEmail100)
        )
        caseDefinitionBuildingBlockLinkRepository.saveAndFlush(
            CaseDefinitionBuildingBlockLink(caseDefinitionId = f.moving, buildingBlockDefinitionId = f.sendEmail100)
        )
        val preview = preview(f.sendEmail100, f.sendEmail101)
        assertThat(preview.chains).hasSize(4)

        val linkCount = processLinkRepository.count()
        val buildingBlockOwnershipCount = processDefinitionBuildingBlockDefinitionRepository.count()
        val caseOwnershipCount = processDefinitionCaseDefinitionRepository.count()
        val caseLinkCount = caseDefinitionBuildingBlockLinkRepository.count()
        val processDefinitionCount = repositoryService.createProcessDefinitionQuery().count()

        assertThatThrownBy { execute(f.sendEmail100, f.sendEmail101, preview.chains.map { it.id }) }
            .isInstanceOf(BuildingBlockReferenceUpdateException::class.java)
            .hasMessageContaining("notACall")

        assertThat(caseDefinitionRepository.findAllByIdKeyOrderByIdVersionTagDesc(f.income.key)).hasSize(1)
        assertThat(buildingBlockDefinitionRepository.findAllByIdKeyOrderByIdVersionTag(f.notify110.key)).hasSize(1)
        assertThat(processLinkRepository.count()).isEqualTo(linkCount)
        assertThat(processDefinitionBuildingBlockDefinitionRepository.count()).isEqualTo(buildingBlockOwnershipCount)
        assertThat(processDefinitionCaseDefinitionRepository.count()).isEqualTo(caseOwnershipCount)
        assertThat(caseDefinitionBuildingBlockLinkRepository.count()).isEqualTo(caseLinkCount)
        assertThat(repositoryService.createProcessDefinitionQuery().count()).isEqualTo(processDefinitionCount)
        assertThat(repositoryService.createProcessDefinitionQuery().versionTag("CD:${f.income.key}:2.0.1").count()).isZero()
        assertThat(repositoryService.createProcessDefinitionQuery().versionTag("BB:${f.notify110.key}:1.1.1").count()).isZero()
        assertThat(caseDefinitionBuildingBlockLinkRepository.findAllByCaseDefinitionId(f.moving).single().buildingBlockDefinitionId)
            .isEqualTo(f.sendEmail100)
        assertThat(linkIn(ReferenceContainer.of(f.moving), "mv-${f.uid}", "callSendEmail").buildingBlockDefinitionId)
            .isEqualTo(f.sendEmail100)
    }

    @Test
    fun `the REST endpoints drive the wizard from source to summary`() {
        val f = workedExample()

        mockMvc.get("$BASE/references/${f.sendEmail100.key}/version/1.0.0")
            .andExpect {
                status { isOk() }
                jsonPath("$.length()") { value(2) }
                jsonPath("$[0].container.key") { value(f.moving.key) }
                jsonPath("$[0].buildingBlockVersionTag") { value("1.0.0") }
            }

        val previewJson = mockMvc.post("$BASE/preview") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(
                BuildingBlockReferenceUpdatePreviewRequestDto(f.sendEmail100.key, "1.0.0", "1.0.1")
            )
        }.andExpect {
            status { isOk() }
            jsonPath("$.draftsAllowed") { value(true) }
            jsonPath("$.chains.length()") { value(2) }
            jsonPath("$.chains[0].containers[0].type") { exists() }
            jsonPath("$.chains[0].differences.missingRequiredInputs") { isArray() }
            jsonPath("$.changeset.linksToRepoint.length()") { value(1) }
        }.andReturn().response.contentAsString
        val chainIds = objectMapper.readValue(previewJson, BuildingBlockReferenceUpdatePreviewDto::class.java)
            .chains.map { it.id }

        mockMvc.post("$BASE/execute") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(
                BuildingBlockReferenceUpdateExecuteRequestDto(f.sendEmail100.key, "1.0.0", "1.0.1", chainIds)
            )
        }.andExpect {
            status { isOk() }
            jsonPath("$.draftsCreated.length()") { value(2) }
            jsonPath("$.draftsModified[0].key") { value(f.moving.key) }
            jsonPath("$.remainingReferences.length()") { value(1) }
        }

        mockMvc.post("$BASE/execute") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(
                BuildingBlockReferenceUpdateExecuteRequestDto(f.sendEmail100.key, "1.0.0", "1.0.0", chainIds)
            )
        }.andExpect { status { isBadRequest() } }
    }

    private fun workedExample(): WorkedExample {
        val uid = uid()
        val sendEmail100 = buildingBlock("send-email-$uid", "1.0.0", final = true)
        val sendEmail101 = buildingBlock("send-email-$uid", "1.0.1", final = true)
        deployBuildingBlockProcess(sendEmail100, "se-$uid", calls = emptyList())
        deployBuildingBlockProcess(sendEmail101, "se-$uid", calls = emptyList())
        val notify110 = buildingBlock("notify-$uid", "1.1.0", final = true)
        deployBuildingBlockProcess(notify110, "nt-$uid", calls = listOf("callSendEmail" to sendEmail100))
        val moving = case("moving-$uid", "1.3.0", final = false, processKey = "mv-$uid", calls = listOf("callSendEmail" to sendEmail100))
        val income = case("income-$uid", "2.0.0", final = true, processKey = "in-$uid", calls = listOf("callNotify" to notify110))
        return WorkedExample(uid, sendEmail100, sendEmail101, notify110, moving, income)
    }

    private fun buildingBlock(
        key: String,
        versionTag: String,
        final: Boolean,
        properties: List<String> = listOf("recipient"),
        required: List<String> = emptyList(),
    ): BuildingBlockDefinitionId {
        val id = BuildingBlockDefinitionId.of(key, versionTag)
        buildingBlockDefinitionRepository.saveAndFlush(
            BuildingBlockDefinition(id = id, name = key, createdBy = "tester", createdDate = LocalDateTime.now(), final = final)
        )
        documentDefinitionRepository.saveAndFlush(
            JsonSchemaDocumentDefinition(JsonSchemaDocumentDefinitionId.forBuildingBlock(key, id), JsonSchema.fromString(schema(key, properties, required)))
        )
        return id
    }

    private fun deployBuildingBlockProcess(
        owner: BuildingBlockDefinitionId,
        processKey: String,
        calls: List<Pair<String, BuildingBlockDefinitionId>>,
        inputMappings: List<BuildingBlockInputMapping> = emptyList(),
        outputMappings: List<BuildingBlockOutputMapping> = emptyList(),
    ) {
        val processDefinitionId = deploy(owner, processKey, calls)
        processDefinitionBuildingBlockDefinitionRepository.saveAndFlush(
            ProcessDefinitionBuildingBlockDefinition(
                ProcessDefinitionBuildingBlockDefinitionId(ProcessDefinitionId.of(processDefinitionId), owner),
                main = true,
            )
        )
        calls.forEach { (activityId, child) ->
            processLinkRepository.saveAndFlush(buildingBlockLink(processDefinitionId, activityId, child, inputMappings, outputMappings))
        }
    }

    private fun case(
        key: String,
        versionTag: String,
        final: Boolean,
        processKey: String,
        calls: List<Pair<String, BuildingBlockDefinitionId>>,
        basedOn: String? = null,
        userTask: String? = null,
    ): CaseDefinitionId {
        val id = CaseDefinitionId.of(key, versionTag)
        val draft = caseDefinitionRepository.saveAndFlush(
            CaseDefinition(
                id = id,
                name = key,
                createdDate = LocalDateTime.now(),
                basedOnVersionTag = basedOn?.let { org.semver4j.Semver.parse(it) },
                final = false,
            )
        )
        documentDefinitionRepository.saveAndFlush(
            JsonSchemaDocumentDefinition(JsonSchemaDocumentDefinitionId.forCase(key, id), JsonSchema.fromString(schema(key, listOf("value"))))
        )
        val processDefinitionId = deploy(id, processKey, calls, userTask)
        calls.forEach { (activityId, child) ->
            // Later case version already got links copied on deploy
            if (processLinkRepository.findByProcessDefinitionIdAndActivityId(processDefinitionId, activityId).isEmpty()) {
                processLinkRepository.saveAndFlush(buildingBlockLink(processDefinitionId, activityId, child))
            }
        }
        if (final) {
            caseDefinitionRepository.saveAndFlush(draft.copy(final = true))
        }
        return id
    }

    private fun deploy(
        owner: BlueprintId,
        processKey: String,
        calls: List<Pair<String, BuildingBlockDefinitionId>>,
        userTask: String? = null,
    ): String {
        val steps = calls.map { (activityId, child) ->
            activityId to """
                <bpmn:callActivity id="$activityId" calledElement="${mainProcessKeyOf(child)}"
                    camunda:calledElementBinding="versionTag" camunda:calledElementVersionTag="BB:$child">
                  <bpmn:extensionElements><camunda:in businessKey="#{buildingBlockDocumentId}" /></bpmn:extensionElements>
                </bpmn:callActivity>
            """.trimIndent()
        } + listOfNotNull(userTask?.let { it to """<bpmn:userTask id="$it" />""" })
        val ids = listOf("start") + steps.map { it.first } + listOf("end")
        val flows = ids.zipWithNext().mapIndexed { i, (from, to) ->
            """<bpmn:sequenceFlow id="flow$i" sourceRef="$from" targetRef="$to" />"""
        }
        val bpmn = """<?xml version="1.0" encoding="UTF-8"?>
            <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" id="Definitions_$processKey" targetNamespace="http://bpmn.io/schema/bpmn">
              <bpmn:process id="$processKey" isExecutable="true">
                <bpmn:startEvent id="start" />
                ${steps.joinToString("\n") { it.second }}
                <bpmn:endEvent id="end" />
                ${flows.joinToString("\n")}
              </bpmn:process>
            </bpmn:definitions>
        """.trimIndent()
        val deployment = runWithoutAuthorization {
            operatonProcessService.deploy(owner, "$processKey.bpmn", ByteArrayInputStream(bpmn.toByteArray()))
        }
        return deployment.deployedProcessDefinitions.single().id
    }

    private fun mainProcessKeyOf(id: BuildingBlockDefinitionId): String {
        val processDefinitionId = processDefinitionBuildingBlockDefinitionRepository.findAllByIdBuildingBlockDefinitionId(id)
            .single { it.main }.id.processDefinitionId.id
        return repositoryService.getProcessDefinition(processDefinitionId).key
    }

    private fun buildingBlockLink(
        processDefinitionId: String,
        activityId: String,
        child: BuildingBlockDefinitionId,
        inputMappings: List<BuildingBlockInputMapping> = emptyList(),
        outputMappings: List<BuildingBlockOutputMapping> = emptyList(),
    ) = BuildingBlockProcessLink(
        id = UUID.randomUUID(),
        processDefinitionId = processDefinitionId,
        activityId = activityId,
        activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
        buildingBlockDefinitionId = child,
        pluginConfigurationMappings = emptyMap(),
        inputMappings = inputMappings,
        outputMappings = outputMappings,
    )

    private fun processDefinitionIn(container: ReferenceContainer, processKey: String): String {
        val ids = when (container.type) {
            BUILDING_BLOCK -> processDefinitionBuildingBlockDefinitionRepository
                .findAllByIdBuildingBlockDefinitionId(BuildingBlockDefinitionId(container.key, container.versionTag))
                .map { it.id.processDefinitionId.id }
            CASE -> processDefinitionCaseDefinitionRepository
                .findByIdCaseDefinitionId(CaseDefinitionId.of(container.key, container.versionTag.toString()))
                .map { it.id.processDefinitionId.id }
        }
        return repositoryService.createProcessDefinitionQuery()
            .processDefinitionIdIn(*ids.toTypedArray())
            .processDefinitionKey(processKey)
            .singleResult()
            .id
    }

    private fun pointLinkAt(container: CaseDefinitionId, processKey: String, activityId: String, child: BuildingBlockDefinitionId) {
        val processDefinitionId = processDefinitionIn(ReferenceContainer.of(container), processKey)
        processLinkRepository.deleteAll(processLinkRepository.findByProcessDefinitionIdAndActivityId(processDefinitionId, activityId))
        processLinkRepository.flush()
        processLinkRepository.saveAndFlush(buildingBlockLink(processDefinitionId, activityId, child))
    }

    private fun linkIn(container: ReferenceContainer, processKey: String, activityId: String): BuildingBlockProcessLink =
        processLinkRepository.findByProcessDefinitionIdAndActivityId(processDefinitionIn(container, processKey), activityId)
            .filterIsInstance<BuildingBlockProcessLink>()
            .single()

    private fun callActivityOf(link: BuildingBlockProcessLink): CallActivity =
        repositoryService.getBpmnModelInstance(link.processDefinitionId).getModelElementById(link.activityId)

    private fun calledVersionTag(link: BuildingBlockProcessLink) = callActivityOf(link).operatonCalledElementVersionTag

    private fun calledElement(link: BuildingBlockProcessLink) = callActivityOf(link).calledElement

    private fun createBuildingBlockDocument(id: BuildingBlockDefinitionId): UUID = runWithoutAuthorization {
        documentService.createDocument(
            NewDocumentRequest(
                id.key,
                null,
                null,
                id.key,
                id.versionTag.toString(),
                JsonNodeFactory.instance.objectNode().put("recipient", "someone"),
            )
        ).resultingDocument().orElseThrow().id().getId()
    }

    private fun definitionOf(id: BuildingBlockDefinitionId): BuildingBlockDefinition =
        buildingBlockDefinitionRepository.findById(id).orElseThrow()

    private fun references(id: BuildingBlockDefinitionId) =
        runWithoutAuthorization { referenceUpdateService.getReferences(id.key, id.versionTag.toString()) }

    private fun preview(
        source: BuildingBlockDefinitionId,
        target: BuildingBlockDefinitionId,
        selected: List<String>? = null,
    ): BuildingBlockReferenceUpdatePreviewDto = referenceUpdateService.previewAsAdmin(
        BuildingBlockReferenceUpdatePreviewRequestDto(
            source.key, source.versionTag.toString(), target.versionTag.toString(), selected, targetKey = target.key
        )
    )

    private fun execute(
        source: BuildingBlockDefinitionId,
        target: BuildingBlockDefinitionId,
        selected: List<String>,
        resolutions: List<BuildingBlockReferenceUpdateChainResolutionDto> = emptyList(),
    ): BuildingBlockReferenceUpdateResultDto = runWithoutAuthorization {
        referenceUpdateService.execute(
            BuildingBlockReferenceUpdateExecuteRequestDto(
                source.key, source.versionTag.toString(), target.versionTag.toString(), selected, resolutions, target.key
            )
        )
    }

    private fun BuildingBlockReferenceUpdateService.previewAsAdmin(request: BuildingBlockReferenceUpdatePreviewRequestDto) =
        runWithoutAuthorization { preview(request) }

    private fun chainWithTop(preview: BuildingBlockReferenceUpdatePreviewDto, key: String): BuildingBlockReferenceUpdateChainDto =
        preview.chains.single { it.containers.first().key == key }

    private fun schema(name: String, properties: List<String>, required: List<String> = emptyList()): String {
        val props = properties.joinToString(",") { "\"$it\": {\"type\": \"string\"}" }
        val req = required.joinToString(",") { "\"$it\"" }
        return """{"${'$'}schema": "http://json-schema.org/draft-07/schema#", "${'$'}id": "$name.schema", """ +
            """"type": "object", "properties": {$props}, "required": [$req]}"""
    }

    private fun uid() = UUID.randomUUID().toString().take(6)

    private data class WorkedExample(
        val uid: String,
        val sendEmail100: BuildingBlockDefinitionId,
        val sendEmail101: BuildingBlockDefinitionId,
        val notify110: BuildingBlockDefinitionId,
        val moving: CaseDefinitionId,
        val income: CaseDefinitionId,
    )

    private companion object {
        const val BASE = "/api/management/v1/building-block/reference-update"
        const val PLUGIN_DEFINITION_KEY = "test-mail-plugin"
        val PLUGIN_CONFIGURATION_ID: UUID = UUID.fromString("3f1b5aa8-6b34-4bfe-9f78-3f1d8f2a1a01")
    }
}
