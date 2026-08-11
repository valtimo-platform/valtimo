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
import com.ritense.document.repository.impl.JsonSchemaDocumentDefinitionRepository
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.document.repository.impl.specification.JsonSchemaDocumentDefinitionSpecificationHelper.Companion.byIdBlueprintId
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentExecutor
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
    private val documentDefinitionRepository: JsonSchemaDocumentDefinitionRepository,
    private val componentExecutors: List<MigrationComponentExecutor>,
) {

    /**
     * Re-home [documentId] onto the [target] blueprint version and run every component of the plan
     * [migrationId]. Returns the blueprint version the document was on *before* the re-home, so the
     * caller can record an accurate from → to on the audit trail.
     */
    fun apply(migrationId: BlueprintMigrationId, target: BlueprintId, documentId: UUID): BlueprintId {
        val source = rehome(documentId, target)
        // Spring injects componentExecutors already sorted by each executor's @Order, so they run in
        // a dependency-correct order without the caller knowing which executors exist or what their
        // component keys are.
        componentExecutors.forEach { it.execute(migrationId, target, documentId) }
        return source
    }

    /**
     * Detach the document [documentId] from its source blueprint version and attach it to the
     * [target] version: point its `documentDefinitionId` at the target blueprint (case definition or
     * building block definition) *and* at that blueprint's own document definition name, then persist
     * it.
     *
     * The name is looked up rather than carried over, because a plan may migrate instances onto a
     * blueprint with a different key, whose document definition is a different one with a different
     * name. Keeping the source's name would leave the document claiming a definition that does not
     * exist under the target blueprint.
     *
     * Returns the blueprint version the document was on *before* the re-home (the source).
     */
    fun rehome(documentId: UUID, target: BlueprintId): BlueprintId {
        return runWithoutAuthorization {
            val document = findDocument(documentId)
            val definitionId = document.definitionId() as JsonSchemaDocumentDefinitionId
            val source = definitionId.blueprintId().let { it.asCaseDefinitionId() ?: it.asBuildingBlockDefinitionId() }
                ?: throw IllegalStateException(
                    "Document '$documentId' is homed on '${definitionId.blueprintId()}', which is not a " +
                        "blueprint version a migration can move it away from"
                )
            document.setDefinitionId(targetDefinitionId(target))
            documentRepository.save(document)
            source
        }
    }

    private fun findDocument(documentId: UUID): JsonSchemaDocument =
        documentRepository.findById(JsonSchemaDocumentId.existingId(documentId)).orElseThrow {
            NoSuchElementException("No document found for '$documentId' to migrate to the target blueprint")
        }

    /**
     * The document definition id of [target] — the one document definition deployed under that
     * blueprint version.
     */
    private fun targetDefinitionId(target: BlueprintId): JsonSchemaDocumentDefinitionId =
        documentDefinitionRepository.findOne(byIdBlueprintId(target))
            .orElseThrow {
                NoSuchElementException(
                    "No document definition is deployed for blueprint '$target', so no document can be " +
                        "migrated onto it. A migration plan's target blueprint version must carry its own " +
                        "document definition."
                )
            }
            .id() as JsonSchemaDocumentDefinitionId
}
