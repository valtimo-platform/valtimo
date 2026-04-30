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

package com.ritense.valtimo.contract.document

import java.util.UUID

/**
 * Resolves the owning case document id for a document that belongs to another blueprint.
 */
interface BlueprintCaseDocumentResolver {

    /**
     * @param blueprintType discriminator of the originating blueprint (e.g. "BUILDING_BLOCK")
     */
    fun supports(blueprintType: String): Boolean

    /**
     * @param documentId id of the document that originates from the supported blueprint
     * @return id of the case document that owns the provided document
     * @throws CaseDocumentResolutionException when the mapping cannot be resolved
     */
    @Throws(CaseDocumentResolutionException::class)
    fun resolveCaseDocumentId(documentId: UUID): UUID
}
