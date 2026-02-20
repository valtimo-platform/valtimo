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

import com.ritense.valtimo.contract.database.QueryDialectHelper
import jakarta.persistence.criteria.AbstractQuery
import jakarta.persistence.criteria.CriteriaBuilder
import jakarta.persistence.criteria.Expression
import jakarta.persistence.criteria.Path
import jakarta.persistence.criteria.Subquery
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import java.util.UUID
import kotlin.test.assertNotNull

class BuildingBlockCaseTaskContributorTest {

    private val queryDialectHelper: QueryDialectHelper = mock()
    private val contributor = BuildingBlockCaseTaskContributor(queryDialectHelper)

    @Test
    fun `resolveBusinessKeyExpression returns a non-null subquery expression`() {
        val cb: CriteriaBuilder = mock()
        val query: AbstractQuery<*> = mock()
        val businessKeyPath: Path<String> = mock()
        val subquery: Subquery<String> = mock()
        val uuidExpression: Expression<String> = mock()

        whenever(query.subquery(String::class.java)).thenReturn(subquery)
        whenever(subquery.from(any<Class<*>>())).thenReturn(mock())
        whenever(queryDialectHelper.uuidToString(any(), any<Path<UUID>>())).thenReturn(uuidExpression)
        whenever(subquery.select(any())).thenReturn(subquery)
        whenever(subquery.where(any<Expression<Boolean>>())).thenReturn(subquery)
        whenever(cb.equal(any(), any<Expression<*>>())).thenReturn(mock())

        val result = contributor.resolveBusinessKeyExpression(cb, query, businessKeyPath)

        assertNotNull(result)
    }
}
