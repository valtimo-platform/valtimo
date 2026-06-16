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

package com.ritense.processdocument.service

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.logging.scope.CaseLogScopeContributor
import com.ritense.logging.scope.MdcScopeEntry
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Component
import java.util.UUID

@Component
@SkipComponentScan
class ProcessDocumentCaseLogScopeContributor(
    private val processDocumentAssociationService: ProcessDocumentAssociationService,
) : CaseLogScopeContributor {

    override fun scopeFor(caseId: UUID): List<MdcScopeEntry> {
        val processInstanceIds = runWithoutAuthorization {
            processDocumentAssociationService.findProcessDocumentInstances(
                JsonSchemaDocumentId.existingId(caseId)
            )
        }.map { it.processDocumentInstanceId().processInstanceId().toString() }

        if (processInstanceIds.isEmpty()) return emptyList()

        return listOf(MdcScopeEntry(PROCESS_INSTANCE_ID_KEY, processInstanceIds))
    }

    companion object {
        const val PROCESS_INSTANCE_ID_KEY: String = "processInstanceId"
    }
}
