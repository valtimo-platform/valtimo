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

package com.ritense.processdocument.repository

import com.ritense.authorization.AuthorizationEntityMapper
import com.ritense.authorization.AuthorizationEntityMapperResult
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.processdocument.domain.impl.OperatonProcessInstanceId
import com.ritense.processdocument.service.impl.OperatonProcessJsonSchemaDocumentService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.database.QueryDialectHelper
import com.ritense.valtimo.operaton.domain.OperatonExecution
import com.ritense.valtimo.operaton.domain.OperatonExecution.Companion.DUMMY_OPERATON_EXECUTION_ID
import jakarta.persistence.criteria.AbstractQuery
import jakarta.persistence.criteria.CriteriaBuilder
import jakarta.persistence.criteria.Root
import org.springframework.stereotype.Component

@Component
@SkipComponentScan
class OperatonExecutionJsonSchemaDocumentMapper(
    private val processDocumentService: OperatonProcessJsonSchemaDocumentService,
    private val queryDialectHelper: QueryDialectHelper,
) : AuthorizationEntityMapper<OperatonExecution, JsonSchemaDocument> {

    override fun mapRelated(entity: OperatonExecution): List<JsonSchemaDocument> {
        return if (entity.id == DUMMY_OPERATON_EXECUTION_ID) {
            // This process is not yet linked to a document. This can happen for the action:CREATE on resource:OperatonExecution
            emptyList()
        } else {
            listOf(
                processDocumentService.getDocument(
                    OperatonProcessInstanceId(entity.getProcessInstanceId()),
                    entity
                )
            )
        }
    }

    override fun mapQuery(
        root: Root<OperatonExecution>,
        query: AbstractQuery<*>,
        cb: CriteriaBuilder
    ): AuthorizationEntityMapperResult<JsonSchemaDocument> {

        val subquery = query.subquery(Int::class.java)
        val documentRoot = subquery.from(JsonSchemaDocument::class.java)

        subquery.select(cb.literal(1))
            .where(
                cb.equal(
                    root.get<String>("businessKey"),
                    queryDialectHelper.uuidToString(cb, documentRoot.get<JsonSchemaDocumentId>("id").get("id"))
                )
            )

        return AuthorizationEntityMapperResult(
            documentRoot,
            subquery,
            cb.exists(subquery)
        )
    }

    override fun supports(fromClass: Class<*>, toClass: Class<*>): Boolean {
        return fromClass == OperatonExecution::class.java && toClass == JsonSchemaDocument::class.java
    }
}