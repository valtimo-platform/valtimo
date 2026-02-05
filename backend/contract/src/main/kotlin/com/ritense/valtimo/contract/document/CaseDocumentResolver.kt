package com.ritense.valtimo.contract.document

import java.util.UUID

/**
 * Resolves the owning case document id for any supported document.
 */
interface CaseDocumentResolver {
    @Throws(CaseDocumentResolutionException::class)
    fun resolveCaseDocumentId(documentId: UUID): UUID
}
