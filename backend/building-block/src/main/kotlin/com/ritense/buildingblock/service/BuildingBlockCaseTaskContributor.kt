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
import com.ritense.valtimo.contract.database.QueryDialectHelper
import com.ritense.valtimo.service.TaskBusinessKeyResolver
import jakarta.persistence.criteria.AbstractQuery
import jakarta.persistence.criteria.CriteriaBuilder
import jakarta.persistence.criteria.Expression
import jakarta.persistence.criteria.Path
import java.util.UUID

/**
 * Resolves building block business keys to case document IDs.
 *
 * Building block processes use the building block document ID as their process instance business key,
 * not the case document ID. This resolver maps BB document IDs back to case document IDs via a
 * correlated subquery on [BuildingBlockInstance]. It is used inside a COALESCE expression so that
 * BB tasks are matched to the correct case document, while non-BB tasks fall through to the
 * original business key.
 */
class BuildingBlockCaseTaskContributor(
    private val queryDialectHelper: QueryDialectHelper
) : TaskBusinessKeyResolver {

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

    override fun resolveCaseDocumentId(
        cb: CriteriaBuilder,
        query: AbstractQuery<*>,
        businessKeyPath: Path<String>
    ): Expression<UUID> {
        val subquery = query.subquery(UUID::class.java)
        val bbiRoot = subquery.from(BuildingBlockInstance::class.java)
        subquery.select(bbiRoot.get("caseDocumentId"))
        subquery.where(
            cb.equal(
                bbiRoot.get<UUID>("documentId"),
                queryDialectHelper.stringToUuid(cb, businessKeyPath)
            )
        )
        return subquery
    }
}
