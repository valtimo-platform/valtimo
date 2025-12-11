package com.ritense.document.service

import com.ritense.document.domain.JsonSchemaDocumentDefinitionSolutionModuleType
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.valtimo.contract.annotation.AllOpen
import com.ritense.valtimo.contract.document.CaseDocumentResolutionException
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import com.ritense.valtimo.contract.document.SolutionModuleCaseDocumentResolver
import java.util.UUID

@AllOpen
class DefaultCaseDocumentResolver(
    private val documentService: DocumentService,
    private val solutionModuleCaseDocumentResolvers: List<SolutionModuleCaseDocumentResolver>
) : CaseDocumentResolver {

    override fun resolveCaseDocumentId(documentId: UUID): UUID {
        val document = documentService.findBy(JsonSchemaDocumentId.existingId(documentId))
            .orElseThrow {
                CaseDocumentResolutionException("No document found for id $documentId")
            } as JsonSchemaDocument

        val solutionModuleType = document.definitionId().solutionModuleId().solutionModuleType

        if (solutionModuleType == JsonSchemaDocumentDefinitionSolutionModuleType.CASE) {
            return document.id().id
        }

        val resolver = solutionModuleCaseDocumentResolvers.firstOrNull {
            it.supports(solutionModuleType.name)
        } ?: throw CaseDocumentResolutionException(
            "No resolver available for solution module type ${solutionModuleType.name}"
        )

        return resolver.resolveCaseDocumentId(document.id().id)
    }
}
