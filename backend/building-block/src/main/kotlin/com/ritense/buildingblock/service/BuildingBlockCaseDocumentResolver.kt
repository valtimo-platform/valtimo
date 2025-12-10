package com.ritense.buildingblock.service

import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.document.domain.JsonSchemaDocumentDefinitionSolutionModuleType
import com.ritense.valtimo.contract.annotation.AllOpen
import com.ritense.valtimo.contract.document.CaseDocumentResolutionException
import com.ritense.valtimo.contract.document.SolutionModuleCaseDocumentResolver
import java.util.UUID

@AllOpen
class BuildingBlockCaseDocumentResolver(
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository
) : SolutionModuleCaseDocumentResolver {

    override fun supports(solutionModuleType: String): Boolean {
        return JsonSchemaDocumentDefinitionSolutionModuleType.BUILDING_BLOCK.name == solutionModuleType
    }

    override fun resolveCaseDocumentId(documentId: UUID): UUID {
        return buildingBlockInstanceRepository.findByDocumentId(documentId)?.caseDocumentId
            ?: throw CaseDocumentResolutionException("No building block instance found for document id $documentId")
    }
}
