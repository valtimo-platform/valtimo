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

package com.ritense.document.service

import com.ritense.document.domain.JsonSchemaDocumentDefinitionBlueprintType
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.valtimo.contract.annotation.AllOpen
import com.ritense.valtimo.contract.document.BlueprintCaseDocumentResolver
import com.ritense.valtimo.contract.document.CaseDocumentResolutionException
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import java.util.UUID

@AllOpen
class DefaultCaseDocumentResolver(
    private val documentService: DocumentService,
    private val blueprintCaseDocumentResolvers: List<BlueprintCaseDocumentResolver>
) : CaseDocumentResolver {

    override fun resolveCaseDocumentId(documentId: UUID): UUID {
        val document = documentService.findBy(JsonSchemaDocumentId.existingId(documentId))
            .orElseThrow {
                CaseDocumentResolutionException("No document found for id $documentId")
            } as JsonSchemaDocument

        val blueprintType = document.definitionId().blueprintId().blueprintType

        if (blueprintType == JsonSchemaDocumentDefinitionBlueprintType.CASE) {
            return document.id().id
        }

        val resolver = blueprintCaseDocumentResolvers.firstOrNull {
            it.supports(blueprintType.name)
        } ?: throw CaseDocumentResolutionException(
            "No resolver available for blueprint type ${blueprintType.name}"
        )

        return resolver.resolveCaseDocumentId(document.id().id)
    }
}
