package com.ritense.formviewmodel.service

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.AuthorizationResourceContext
import com.ritense.authorization.request.RelatedEntityAuthorizationRequest
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.valtimo.operaton.authorization.OperatonExecutionActionProvider
import com.ritense.valtimo.operaton.domain.OperatonExecution
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.bySolutionModuleId
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.byKey
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.maxVersionOf
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.byNotLinkedToCaseDefinition
import org.springframework.stereotype.Service

@Service
@SkipComponentScan
class ProcessAuthorizationService(
    private val operatonRepositoryService: OperatonRepositoryService,
    private val authorizationService: AuthorizationService
) {

    fun checkStartProcessAuthorization(
        processDefinitionKey: String,
        document: JsonSchemaDocument? = null,
    ) {
        val processDefinition = runWithoutAuthorization {
            operatonRepositoryService.findProcessDefinition(
                byKey(processDefinitionKey)
                    .and(bySolutionModuleId(document?.definitionId()?.caseDefinitionId()))
            )
                // Needed by form-view-model
                ?: operatonRepositoryService.findProcessDefinition(
                    byKey(processDefinitionKey)
                        .and(maxVersionOf(byNotLinkedToCaseDefinition()))
                )
        }
        require(processDefinition != null)

        authorizationService.requirePermission(
            RelatedEntityAuthorizationRequest(
                OperatonExecution::class.java,
                OperatonExecutionActionProvider.CREATE,
                OperatonProcessDefinition::class.java,
                processDefinition.id
            ).apply {
                if (document != null) {
                    withContext(
                        AuthorizationResourceContext(
                            JsonSchemaDocument::class.java,
                            document
                        )
                    )
                }
            }
        )
    }

}