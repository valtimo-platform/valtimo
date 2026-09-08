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
     * Used when copying a case definition into a draft and when importing a link; the result follows the
     * latest system process version while the case definition is a draft, and freezes on finalization.
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

        // Always null - the assert above leaves only drafts - but kept as a call so the rule stays in one place.
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
     * Links from `config/case` are imported before the global process definitions, so there is often no
     * version to pin yet; without this a case definition shipping as final would stay unpinned forever.
     */
    fun pinLinksThatCanNoLongerChange() {
        pinUnpinnedLinks(caseDefinitionProcessLinkRepository.findAll())
    }

    /**
     * Freezes the links of a just-finalized case definition, which were left unpinned while it was a
     * draft and would otherwise wait for [pinLinksThatCanNoLongerChange] at the next startup.
     */
    fun pinLinksOf(caseDefinitionId: CaseDefinitionId) {
        pinUnpinnedLinks(caseDefinitionProcessLinkRepository.findAllByIdCaseDefinitionId(caseDefinitionId))
    }

    private fun pinUnpinnedLinks(links: List<CaseDefinitionProcessLink>) {
        links
            .filter { it.processDefinitionVersion == null }
            // Finality, not `canUpdateCaseDefinition`: that is also false for a draft where drafts are disabled.
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
     * `null` for an owned process, which the case definition's own version tag already resolves, and
     * `null` while it is a draft, which follows the latest version until finalization pins it.
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
     * A pinned version missing from the engine falls back to the latest, rather than leaving no process.
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
