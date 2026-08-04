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
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.byBlueprintId
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.byKey
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.byNotLinkedToBuildingBlock
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.byNotLinkedToCaseDefinition
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.maxVersionOf
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
        // Authorization has to be checked against the definition that will actually be started, so this
        // mirrors how OperatonProcessService resolves one: by version tag when the document belongs to a
        // blueprint, and otherwise the latest version of the key among processes without a blueprint.
        val processDefinition = runWithoutAuthorization {
            val blueprintId = document?.definitionId()?.asBlueprintId()
            val unlinked = byNotLinkedToCaseDefinition().and(byNotLinkedToBuildingBlock())
            blueprintId?.let {
                operatonRepositoryService.findProcessDefinition(byKey(processDefinitionKey).and(byBlueprintId(it)))
            } ?: operatonRepositoryService.findProcessDefinition(
                byKey(processDefinitionKey)
                    .and(unlinked)
                    .and(maxVersionOf(unlinked))
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