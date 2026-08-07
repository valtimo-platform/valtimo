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
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentExecutor
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import java.util.UUID

/**
 * Applies a single migration plan to a single instance (a case document, or a building block
 * document): re-home the instance onto the target blueprint version, then run every registered
 * migration component.
 *
 * Extracted from [CaseMigrationService] so that a component executor can apply a *further* plan to a
 * *nested* instance — a building block whose owner just migrated is aligned by re-applying this same
 * step for the building block's own plan chain. Always runs in the caller's transaction, so the whole
 * tree of applications commits or rolls back as one unit.
 */
class MigrationPlanApplier(
    private val documentRepository: JsonSchemaDocumentRepository,
    private val componentExecutors: List<MigrationComponentExecutor>,
) {

    /**
     * Re-home [documentId] onto the [target] blueprint version and run every component of the plan
     * [migrationId]. Returns the version tag the document was on *before* the re-home, so the caller
     * can record an accurate from → to on the audit trail.
     */
    fun apply(migrationId: BlueprintMigrationId, target: BlueprintId, documentId: UUID): String {
        val fromVersionTag = rehome(documentId, target)
        // Spring injects componentExecutors already sorted by each executor's @Order, so they run in
        // a dependency-correct order without the caller knowing which executors exist or what their
        // component keys are.
        componentExecutors.forEach { it.execute(migrationId, target, documentId) }
        return fromVersionTag
    }

    /**
     * Detach the document [documentId] from its source blueprint version and attach it to the
     * [target] version: keep the document-definition name but point the `documentDefinitionId` at the
     * target blueprint (case definition or building block definition), then persist it.
     *
     * Returns the version tag the document was on *before* the re-home (the source version).
     */
    fun rehome(documentId: UUID, target: BlueprintId): String {
        return runWithoutAuthorization {
            val document = findDocument(documentId)
            val definitionId = document.definitionId() as JsonSchemaDocumentDefinitionId
            val fromVersionTag = definitionId.blueprintId().blueprintVersionTag().toString()
            document.setDefinitionId(targetDefinitionId(definitionId.name(), target))
            documentRepository.save(document)
            fromVersionTag
        }
    }

    private fun findDocument(documentId: UUID): JsonSchemaDocument =
        documentRepository.findById(JsonSchemaDocumentId.existingId(documentId)).orElseThrow {
            NoSuchElementException("No document found for '$documentId' to migrate to the target blueprint")
        }

    private fun targetDefinitionId(name: String, target: BlueprintId) = when (target) {
        is CaseDefinitionId -> JsonSchemaDocumentDefinitionId.forCase(name, target)
        is BuildingBlockDefinitionId -> JsonSchemaDocumentDefinitionId.forBuildingBlock(name, target)
        else -> throw IllegalArgumentException("Unsupported target blueprint '$target' for migration")
    }
}
