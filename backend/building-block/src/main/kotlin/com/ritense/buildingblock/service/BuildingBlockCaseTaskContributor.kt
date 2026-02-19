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

package com.ritense.buildingblock.service

import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.processdocument.service.CaseTaskContributor
import com.ritense.valtimo.contract.database.QueryDialectHelper
import com.ritense.valtimo.operaton.domain.OperatonExecution
import com.ritense.valtimo.operaton.domain.OperatonTask
import com.ritense.valtimo.service.TaskBusinessKeyResolver
import jakarta.persistence.criteria.AbstractQuery
import jakarta.persistence.criteria.CriteriaBuilder
import jakarta.persistence.criteria.Expression
import jakarta.persistence.criteria.Path
import jakarta.persistence.criteria.Predicate
import jakarta.persistence.criteria.Root
import java.util.UUID

/**
 * Integrates building block tasks into the case task list infrastructure.
 *
 * Building block processes use the building block document ID as their process instance business key,
 * not the case document ID. This causes two problems:
 * 1. BB tasks are missing from case-filtered task views (solved by [CaseTaskContributor])
 * 2. The task list returns the BB document ID instead of the case document ID (solved by [TaskBusinessKeyResolver])
 *
 * Both are solved via correlated subqueries on [BuildingBlockInstance], which links
 * the BB document (documentId) back to the parent case document (caseDocumentId).
 */
class BuildingBlockCaseTaskContributor(
    private val queryDialectHelper: QueryDialectHelper
) : CaseTaskContributor, TaskBusinessKeyResolver {

    /**
     * Includes building block tasks in the case-filtered task list.
     *
     * Without this, tasks from BB sub-processes are excluded because their business key
     * points to the BB document, not the case document. This predicate is OR'd with the
     * default direct business key match in [CaseTaskListSearchService].
     *
     * Generates: EXISTS (SELECT 1 FROM building_block_instance bbi
     *   WHERE CAST(bbi.document_id AS VARCHAR) = pi.business_key_
     *     AND bbi.case_document_id = doc.id)
     */
    override fun createTaskInclusionPredicate(
        cb: CriteriaBuilder,
        query: AbstractQuery<*>,
        taskRoot: Root<OperatonTask>,
        documentRoot: Root<JsonSchemaDocument>,
        caseDefinitionName: String
    ): Predicate? {
        val subquery = query.subquery(Long::class.java)
        val bbiRoot = subquery.from(BuildingBlockInstance::class.java)
        subquery.select(cb.literal(1L))
        subquery.where(
            cb.and(
                // Link BB instance to the task via the process instance business key
                cb.equal(
                    queryDialectHelper.uuidToString(cb, bbiRoot.get("documentId")),
                    taskRoot.get<OperatonExecution>("processInstance").get<String>("businessKey")
                ),
                // Link BB instance to the case document
                cb.equal(
                    bbiRoot.get<UUID>("caseDocumentId"),
                    documentRoot.get<JsonSchemaDocumentId>("id").get<UUID>("id")
                )
            )
        )

        return cb.exists(subquery)
    }

    /**
     * Resolves building block business keys to case document IDs in the task list query.
     *
     * Used by [OperatonTaskService.findTasksFiltered] inside a COALESCE expression so that
     * BB tasks return the case document ID as their business key instead of the BB document ID.
     * For non-BB tasks (where no matching BuildingBlockInstance exists) the subquery returns null,
     * and COALESCE falls through to the original business key.
     *
     * Generates: (SELECT CAST(bbi.case_document_id AS VARCHAR) FROM building_block_instance bbi
     *   WHERE CAST(bbi.document_id AS VARCHAR) = pi.business_key_)
     */
    override fun resolveBusinessKeyExpression(
        cb: CriteriaBuilder,
        query: AbstractQuery<*>,
        businessKeyPath: Path<String>
    ): Expression<String> {
        val subquery = query.subquery(String::class.java)
        val bbiRoot = subquery.from(BuildingBlockInstance::class.java)
        subquery.select(queryDialectHelper.uuidToString(cb, bbiRoot.get("caseDocumentId")))
        subquery.where(
            cb.equal(
                queryDialectHelper.uuidToString(cb, bbiRoot.get("documentId")),
                businessKeyPath
            )
        )
        return subquery
    }
}
