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

package com.ritense.processdocument.service

import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.valtimo.contract.database.QueryDialectHelper
import com.ritense.valtimo.operaton.domain.OperatonExecution
import com.ritense.valtimo.operaton.domain.OperatonTask
import com.ritense.valtimo.service.TaskBusinessKeyResolver
import com.ritense.valtimo.service.TaskCaseDefinitionSpecificationFactory
import jakarta.persistence.criteria.Expression
import org.springframework.data.jpa.domain.Specification
import java.util.UUID

class DocumentTaskCaseDefinitionSpecificationFactory(
    private val queryDialectHelper: QueryDialectHelper,
    private val taskBusinessKeyResolvers: List<TaskBusinessKeyResolver> = emptyList(),
) : TaskCaseDefinitionSpecificationFactory {

    override fun byCaseDefinitionName(caseDefinitionName: String): Specification<OperatonTask> =
        Specification { root, query, cb ->
            val businessKeyPath = root.get<OperatonExecution>("processInstance").get<String>("businessKey")

            // Building-block (and similar) tasks have a business key that doesn't directly refer
            // to the case document. Mirrors CaseTaskListSearchService.constructWhere.
            val resolverExpressions = taskBusinessKeyResolvers.mapNotNull { resolver ->
                resolver.resolveCaseDocumentId(cb, query, businessKeyPath)
            }
            val caseDocumentId: Expression<UUID> = if (resolverExpressions.isEmpty()) {
                queryDialectHelper.stringToUuid(cb, businessKeyPath)
            } else {
                cb.coalesce<UUID>().apply {
                    resolverExpressions.forEach { value(it) }
                    value(queryDialectHelper.stringToUuid(cb, businessKeyPath))
                }
            }

            val subquery = query.subquery(UUID::class.java)
            val documentRoot = subquery.from(JsonSchemaDocument::class.java)
            subquery.select(documentRoot.get<JsonSchemaDocumentId>("id").get<UUID>("id"))
            subquery.where(
                cb.equal(
                    documentRoot.get<JsonSchemaDocumentDefinitionId>("documentDefinitionId").get<String>("name"),
                    caseDefinitionName
                )
            )
            caseDocumentId.`in`(subquery)
        }
}
