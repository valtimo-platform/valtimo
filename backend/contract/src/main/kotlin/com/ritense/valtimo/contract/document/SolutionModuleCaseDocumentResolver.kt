package com.ritense.valtimo.contract.document

import java.util.UUID

/**
 * Resolves the owning case document id for a document that belongs to another solution module.
 */
interface SolutionModuleCaseDocumentResolver {

    /**
     * @param solutionModuleType discriminator of the originating solution module (e.g. "BUILDING_BLOCK")
     */
    fun supports(solutionModuleType: String): Boolean

    /**
     * @param documentId id of the document that originates from the supported solution module
     * @return id of the case document that owns the provided document
     * @throws CaseDocumentResolutionException when the mapping cannot be resolved
     */
    @Throws(CaseDocumentResolutionException::class)
    fun resolveCaseDocumentId(documentId: UUID): UUID
}
