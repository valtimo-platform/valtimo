/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.processdocument.domain.impl.delegate

import com.ritense.authorization.AuthorizationContext
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.domain.impl.OperatonProcessInstanceId
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.valtimo.contract.annotation.ProcessBean
import com.ritense.valtimo.contract.annotation.ProcessBeanMethod
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.delegate.DelegateExecution

@ProcessBean(description = "Case document operations (deprecated, use documentDelegateService)")
@Deprecated(message = "Since 11.0.0", ReplaceWith("com.ritense.processdocument.service.DocumentDelegateService"))
class DocumentDelegate(
    val processDocumentService: ProcessDocumentService,
    val userManagementService: UserManagementService,
    val documentService: DocumentService,
    val caseDocumentResolver: CaseDocumentResolver,
) {

    @ProcessBeanMethod(description = "Assigns a user to the case document by email (deprecated)")
    fun setAssignee(execution: DelegateExecution, userEmail: String?) {
        AuthorizationContext.runWithoutAuthorization {
            if (userEmail == null) {
                unassign(execution)
            }
            logger.debug("Assigning user {} to document {}", userEmail, execution.processBusinessKey)
            val caseDocumentId = getCaseDocumentId(execution)
            val user = userManagementService.findByEmail(userEmail)
                .orElseThrow { IllegalArgumentException("No user found with email: $userEmail") }
            AuthorizationContext
                .runWithoutAuthorization { documentService.assignUserToDocument(caseDocumentId, user.id) }
        }
    }

    @ProcessBeanMethod(description = "Removes the assignee from the case document (deprecated)")
    fun unassign(execution: DelegateExecution) {
        logger.debug("Unassigning user from document {}", execution.processBusinessKey)
        val caseDocumentId = getCaseDocumentId(execution)
        documentService.unassignUserFromDocument(caseDocumentId)
    }

    private fun getCaseDocumentId(execution: DelegateExecution): java.util.UUID {
        val documentId = processDocumentService.getDocumentId(OperatonProcessInstanceId(execution.processInstanceId), execution)
        return caseDocumentResolver.resolveCaseDocumentId(documentId.id)
    }

    companion object {
        val logger = KotlinLogging.logger {}
    }
}
