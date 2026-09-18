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

/** Applies one plan to one instance: re-home onto the target blueprint version, then run every component. Split out so an executor can apply a further plan to a nested instance, in the same transaction. */
class MigrationPlanApplier(
    private val documentRepository: JsonSchemaDocumentRepository,
    private val documentDefinitionRepository: JsonSchemaDocumentDefinitionRepository,
    private val componentExecutors: List<MigrationComponentExecutor>,
) {

    /** Re-home [documentId] onto [target] and run every component of [migrationId]; returns the version it was on before, for the audit trail. */
    fun apply(migrationId: BlueprintMigrationId, target: BlueprintId, documentId: UUID): BlueprintId {
        val source = rehome(documentId, target)
        // Spring injects the executors pre-sorted by @Order, so the caller need not know which exist.
        componentExecutors.forEach { it.execute(migrationId, target, documentId) }
        return source
    }

    /** Point the document at [target] and at that blueprint's own document definition name — looked up, not carried over, since a plan may migrate onto a different key. Returns the source version. */
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

    /** The document definition id of [target] — the one document definition deployed under that version. */
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
