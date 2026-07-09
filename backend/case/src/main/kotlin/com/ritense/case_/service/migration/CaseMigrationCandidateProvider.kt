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

package com.ritense.case_.service.migration

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.document.service.DocumentDefinitionService
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.blueprint.migration.MigrationCandidateProvider
import org.semver4j.Semver
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Slice
import org.springframework.data.domain.SliceImpl
import java.util.UUID

/**
 * Enumerates the candidate cases for a case-definition migration plan: the documents belonging to
 * the given source case-definition version (resolved by document-definition name), paged by
 * document id.
 */
class CaseMigrationCandidateProvider(
    private val documentRepository: JsonSchemaDocumentRepository,
    private val documentDefinitionService: DocumentDefinitionService,
    private val caseDefinitionRepository: CaseDefinitionRepository,
) : MigrationCandidateProvider {

    override fun supports(blueprintType: BlueprintType) = blueprintType == BlueprintType.CASE

    override fun basedOnVersionTag(blueprintId: BlueprintId): Semver? {
        return runWithoutAuthorization {
            caseDefinitionRepository.findById(blueprintId as CaseDefinitionId).orElse(null)?.basedOnVersionTag
        }
    }

    override fun findCandidateIds(source: BlueprintId, pageable: Pageable): Slice<UUID> {
        val documentDefinitionName = runWithoutAuthorization {
            documentDefinitionService.findByBlueprintId(source).orElse(null)?.id()?.name()
        } ?: return SliceImpl(emptyList(), pageable, false)

        return runWithoutAuthorization {
            documentRepository.findCaseIdsByDocumentDefinitionName(documentDefinitionName, pageable)
        }
    }
}
