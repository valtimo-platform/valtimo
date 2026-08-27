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
package com.ritense.processdocument.service

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.processdocument.domain.CaseDefinitionProcess
import com.ritense.processdocument.domain.CaseDefinitionProcessLink
import com.ritense.processdocument.domain.CaseDefinitionProcessLinkId.Companion.newId
import com.ritense.processdocument.domain.impl.request.DocumentDefinitionProcessLinkResponse
import com.ritense.processdocument.domain.impl.request.DocumentDefinitionProcessRequest
import com.ritense.processdocument.repository.CaseDefinitionProcessLinkRepository
import com.ritense.valtimo.contract.case_.CaseDefinitionChecker
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.byBlueprintId
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.byKey
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.byVersion
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.maxVersionOf
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.byNotLinkedToCaseDefinition
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.transaction.annotation.Transactional

@Transactional
open class CaseDefinitionProcessLinkService(
    private val caseDefinitionProcessLinkRepository: CaseDefinitionProcessLinkRepository,
    private val repositoryService: OperatonRepositoryService,
    private val caseDefinitionChecker: CaseDefinitionChecker,
) {
    fun getDocumentDefinitionProcess(caseDefinitionId: CaseDefinitionId, type: String): CaseDefinitionProcess? {
        val link = caseDefinitionProcessLinkRepository.findByIdCaseDefinitionIdAndType(caseDefinitionId, type)

        return link?.let {
            val processDefinition = findProcessDefinition(
                link.id.processDefinitionKey,
                caseDefinitionId,
                link.processDefinitionVersion
            )

            CaseDefinitionProcess(processDefinition!!.key, processDefinition.name!!, processDefinition.version)
        }
    }

    fun getDocumentDefinitionProcessLinks(caseDefinitionId: CaseDefinitionId): List<CaseDefinitionProcessLink> {
        return caseDefinitionProcessLinkRepository.findAllByIdCaseDefinitionId(caseDefinitionId)
    }

    fun getDocumentDefinitionProcessLink(
        caseDefinitionId: CaseDefinitionId,
        type: String
    ): CaseDefinitionProcessLink? {
        return caseDefinitionProcessLinkRepository.findByIdCaseDefinitionIdAndType(caseDefinitionId, type)
    }

    /**
     * Used when a case definition is copied into a new draft and when a link is imported. The
     * resulting link follows the latest system process version for as long as the case definition
     * is a draft, and is frozen when it is finalized.
     */
    fun saveDocumentDefinitionProcessLink(
        caseDefinitionId: CaseDefinitionId,
        processDefinitionKey: String,
        linkType: String
    ): CaseDefinitionProcessLink {
        return caseDefinitionProcessLinkRepository.save(
            CaseDefinitionProcessLink(
                newId(
                    caseDefinitionId,
                    processDefinitionKey
                ),
                linkType,
                findVersionToPin(processDefinitionKey, caseDefinitionId)
            )
        )
    }

    fun saveDocumentDefinitionProcess(
        caseDefinitionId: CaseDefinitionId,
        request: DocumentDefinitionProcessRequest
    ): DocumentDefinitionProcessLinkResponse {
        caseDefinitionChecker.assertCanUpdateCaseDefinition(caseDefinitionId)

        val ownedProcessDefinition = findOwnedProcessDefinition(request.processDefinitionKey, caseDefinitionId)
        // Needed when linking the 'document-upload' process:
        val processDefinition = ownedProcessDefinition
            ?: findUnownedProcessDefinition(request.processDefinitionKey, null)

        requireNotNull(processDefinition) { "Unknown process definition with key: " + request.getProcessDefinitionKey() }

        // Always null: the assert above rejects a final case definition, so this only ever runs
        // against a draft, whose links follow the latest version until finalization pins them. Kept
        // as a call so the rule stays in one place if that assert is ever relaxed.
        val versionToPin = findVersionToPin(request.processDefinitionKey, caseDefinitionId)

        val currentLink = caseDefinitionProcessLinkRepository.findByIdCaseDefinitionIdAndType(
            caseDefinitionId,
            request.linkType
        )
        if (currentLink != null) {
            // If there is already a link set for this document definition then delete the current link
            // before storing the new one
            caseDefinitionProcessLinkRepository.deleteByIdCaseDefinitionIdAndType(
                caseDefinitionId,
                request.linkType
            )
        }

        val link = CaseDefinitionProcessLink(
            newId(
                caseDefinitionId,
                request.processDefinitionKey
            ),
            request.linkType,
            versionToPin
        )

        caseDefinitionProcessLinkRepository.save(link)

        return DocumentDefinitionProcessLinkResponse(
            processDefinition.key,
            processDefinition.name,
            processDefinition.version
        )
    }

    fun deleteDocumentDefinitionProcess(caseDefinitionId: CaseDefinitionId, type: String) {
        caseDefinitionChecker.assertCanUpdateCaseDefinition(caseDefinitionId)
        caseDefinitionProcessLinkRepository.deleteByIdCaseDefinitionIdAndType(caseDefinitionId, type)
    }

    /**
     * Needed because a link deployed from the `config/case` folder is imported before the global
     * process definitions are — CaseDefinitionDeploymentService deploys cases first — so at import
     * time there is often no system process version to pin yet. A case definition that ships as
     * final is skipped on every later boot, so without this its link would stay unpinned forever.
     */
    fun pinLinksThatCanNoLongerChange() {
        pinUnpinnedLinks(caseDefinitionProcessLinkRepository.findAll())
    }

    /**
     * Freezes the links of a case definition that has just been finalized. Needed because its links
     * were left unpinned for as long as it was a draft, and [pinLinksThatCanNoLongerChange] would
     * not get to them until the next startup.
     */
    fun pinLinksOf(caseDefinitionId: CaseDefinitionId) {
        pinUnpinnedLinks(caseDefinitionProcessLinkRepository.findAllByIdCaseDefinitionId(caseDefinitionId))
    }

    private fun pinUnpinnedLinks(links: List<CaseDefinitionProcessLink>) {
        links
            .filter { it.processDefinitionVersion == null }
            // Finality rather than `canUpdateCaseDefinition`: that one is also false for a draft on
            // an environment where drafts are disabled, which would pin a draft at startup.
            .filter { caseDefinitionChecker.isCaseDefinitionFinal(it.id.caseDefinitionId) }
            .forEach { link ->
                val version = findVersionToPin(link.id.processDefinitionKey, link.id.caseDefinitionId)
                if (version != null) {
                    logger.info {
                        "Pinning case-definition-process-link ${link.type} of ${link.id.caseDefinitionId} " +
                            "to ${link.id.processDefinitionKey} version $version"
                    }
                    caseDefinitionProcessLinkRepository.save(
                        CaseDefinitionProcessLink(link.id, link.type, version)
                    )
                }
            }
    }

    fun deleteDocumentDefinitionProcesses(caseDefinitionId: CaseDefinitionId) {
        caseDefinitionChecker.assertCanUpdateCaseDefinition(caseDefinitionId)
        caseDefinitionProcessLinkRepository.deleteAllByIdCaseDefinitionId(caseDefinitionId)
    }

    private fun findProcessDefinition(
        processDefinitionKey: String,
        caseDefinitionId: CaseDefinitionId?,
        pinnedVersion: Int?
    ): OperatonProcessDefinition? {
        return findOwnedProcessDefinition(processDefinitionKey, caseDefinitionId)
            // Needed when linking the 'document-upload' process:
            ?: findUnownedProcessDefinition(processDefinitionKey, pinnedVersion)
    }

    /**
     * `null` for a process the case definition owns: that is resolved by the case definition's own
     * version tag, so pinning it would only duplicate what the tag already says.
     *
     * `null` too while the case definition is a draft: it follows the latest system process version
     * and is pinned to whatever that is once it is finalized.
     *
     * Finality is asked for directly rather than through `canUpdateCaseDefinition`, which is also
     * false for a draft on an environment where drafts are disabled — there every draft would be
     * pinned instead of following the latest version.
     */
    private fun findVersionToPin(processDefinitionKey: String, caseDefinitionId: CaseDefinitionId): Int? {
        if (!caseDefinitionChecker.isCaseDefinitionFinal(caseDefinitionId)) {
            return null
        }
        if (findOwnedProcessDefinition(processDefinitionKey, caseDefinitionId) != null) {
            return null
        }
        return findUnownedProcessDefinition(processDefinitionKey, null)?.version
    }

    private fun findOwnedProcessDefinition(
        processDefinitionKey: String,
        caseDefinitionId: CaseDefinitionId?
    ): OperatonProcessDefinition? {
        return runWithoutAuthorization {
            repositoryService.findProcessDefinition(
                byKey(processDefinitionKey)
                    .and(byBlueprintId(caseDefinitionId))
            )
        }
    }

    /**
     * A pinned version that is no longer in the engine falls back to the latest, rather than leaving
     * the case definition without a process at all.
     */
    private fun findUnownedProcessDefinition(
        processDefinitionKey: String,
        pinnedVersion: Int?
    ): OperatonProcessDefinition? {
        return runWithoutAuthorization {
            val pinned = pinnedVersion?.let {
                repositoryService.findProcessDefinition(byKey(processDefinitionKey).and(byVersion(it)))
            }
            pinned ?: repositoryService.findProcessDefinition(
                byKey(processDefinitionKey)
                    .and(maxVersionOf(byNotLinkedToCaseDefinition()))
            )
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
