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
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.blueprint.migration.BlueprintVersionLineage
import com.ritense.valtimo.contract.blueprint.migration.MigrationCandidateProvider
import org.semver4j.Semver
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Slice
import java.util.UUID

/**
 * Enumerates the candidate cases for a case-definition migration plan: the documents currently homed
 * on the plan's declared source case-definition version (key **and** version tag), paged by document
 * id.
 *
 * Both halves of the source are part of the selection, and both come from the plan. A plan deployed on
 * `1.0.3` migrates exactly the cases sitting on the version it says it migrates from — its predecessor
 * in the ordinary case, but equally a version several steps back, or a case definition with an entirely
 * different key. Cases on any *other* version are left to the plans that claim them.
 */
class CaseMigrationCandidateProvider(
    private val documentRepository: JsonSchemaDocumentRepository,
    private val caseDefinitionRepository: CaseDefinitionRepository,
) : MigrationCandidateProvider, BlueprintVersionLineage {

    override fun supports(blueprintType: BlueprintType) = blueprintType == BlueprintType.CASE

    override fun basedOnVersionTag(blueprintId: BlueprintId): Semver? {
        return runWithoutAuthorization {
            caseDefinitionRepository.findById(blueprintId as CaseDefinitionId).orElse(null)?.basedOnVersionTag
        }
    }

    override fun exists(blueprintId: BlueprintId): Boolean {
        return runWithoutAuthorization {
            caseDefinitionRepository.existsById(blueprintId as CaseDefinitionId)
        }
    }

    override fun deployedVersionTags(blueprintId: BlueprintId): List<Semver> {
        return runWithoutAuthorization {
            caseDefinitionRepository.findAllByIdKeyOrderByIdVersionTagDesc(blueprintId.getIdKey())
                .map { it.id.versionTag }
        }
    }

    override fun findCandidateIds(source: BlueprintId, pageable: Pageable): Slice<UUID> {
        return runWithoutAuthorization {
            documentRepository.findCaseIdsByBlueprintVersion(
                source.blueprintType(),
                source.getIdKey(),
                source.blueprintVersionTag(),
                pageable,
            )
        }
    }
}
