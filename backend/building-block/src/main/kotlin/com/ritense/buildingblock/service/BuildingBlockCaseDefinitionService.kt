package com.ritense.buildingblock.service

import com.ritense.authorization.Action
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.service.OperatonProcessService
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class BuildingBlockCaseDefinitionService(
    private val operatonProcessService: OperatonProcessService,
    private val processLinkService: ProcessLinkService,
    private val buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
    private val authorizationService: AuthorizationService,
) {
    @Transactional(readOnly = true)
    fun isCaseDefinitionFinalizable(caseDefinitionKey: String, caseDefinitionVersionTag: String): Boolean {
        denyManagementOperation()

        val caseDefinitionId = CaseDefinitionId.of(caseDefinitionKey, caseDefinitionVersionTag)

        return runWithoutAuthorization {
            val deployedProcessDefinitions = operatonProcessService.getDeployedDefinitions(caseDefinitionId)

            val referencedBuildingBlockDefinitionIds =
                deployedProcessDefinitions
                    .asSequence()
                    .flatMap { def -> processLinkService.getProcessLinks(def.id).asSequence() }
                    .filter { it.processLinkType === BuildingBlockProcessLink.PROCESS_LINK_TYPE }
                    .map { (it as BuildingBlockProcessLink).buildingBlockDefinitionId }
                    .distinct()

            referencedBuildingBlockDefinitionIds.all { buildingBlockDefinitionId ->
                val buildingBlockDefinition = buildingBlockDefinitionRepository.findByIdOrNull(buildingBlockDefinitionId)
                buildingBlockDefinition?.final == true
            }
        }
    }

    private fun denyManagementOperation() {
        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                Any::class.java,
                Action.deny()
            )
        )
    }
}