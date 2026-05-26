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

package com.ritense.buildingblock.service

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.logging.scope.CaseLogScopeContributor
import com.ritense.logging.scope.MdcScopeEntry
import com.ritense.processdocument.service.ProcessDocumentAssociationService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Component
import java.util.UUID

@Component
@SkipComponentScan
class BuildingBlockCaseLogScopeContributor(
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val processDocumentAssociationService: ProcessDocumentAssociationService,
) : CaseLogScopeContributor {

    override fun scopeFor(caseId: UUID): List<MdcScopeEntry> {
        val children = buildingBlockInstanceRepository.findAllByCaseDocumentId(caseId)
        if (children.isEmpty()) return emptyList()

        val childDocumentIds = children.map { it.documentId.toString() }

        val childProcessInstanceIds = runWithoutAuthorization {
            children.flatMap { child ->
                processDocumentAssociationService.findProcessDocumentInstances(
                    JsonSchemaDocumentId.existingId(child.documentId)
                )
            }
        }.map { it.processDocumentInstanceId().processInstanceId().toString() }

        val entries = mutableListOf(
            MdcScopeEntry(JSON_SCHEMA_DOCUMENT_KEY, childDocumentIds)
        )
        if (childProcessInstanceIds.isNotEmpty()) {
            entries += MdcScopeEntry(PROCESS_INSTANCE_ID_KEY, childProcessInstanceIds)
        }
        return entries
    }

    companion object {
        val JSON_SCHEMA_DOCUMENT_KEY: String = JsonSchemaDocument::class.java.canonicalName
        const val PROCESS_INSTANCE_ID_KEY: String = "processInstanceId"
    }
}
