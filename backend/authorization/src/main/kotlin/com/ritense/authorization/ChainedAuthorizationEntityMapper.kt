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

package com.ritense.authorization

import jakarta.persistence.criteria.AbstractQuery
import jakarta.persistence.criteria.CriteriaBuilder
import jakarta.persistence.criteria.Root
import jakarta.persistence.criteria.Subquery

class ChainedAuthorizationEntityMapper<A, B, C>(
    val first: AuthorizationEntityMapper<A, B>,
    val second: AuthorizationEntityMapper<B, C>
) : AuthorizationEntityMapper<A, C> {

    private val bClass = ValtimoAuthorizationService.getMapperPair(first).second

    override fun mapRelated(entity: A): List<C> =
        first.mapRelated(entity).flatMap { b -> second.mapRelated(b) }

    override fun mapQuery(
        root: Root<A>,
        query: AbstractQuery<*>,
        cb: CriteriaBuilder
    ): AuthorizationEntityMapperResult<C> {

        val firstResult = first.mapQuery(root, query, cb)
        val secondResult = second.mapQuery(firstResult.root, firstResult.query, cb)

        val sub1 = firstResult.query as? Subquery<*>
            ?: error("Chaining expects first mapper to return a Subquery as its query")

        val existing = sub1.restriction
        val nested = secondResult.joinPredicate
        sub1.where(if (existing != null) cb.and(existing, nested) else nested)

        return AuthorizationEntityMapperResult(
            secondResult.root,
            sub1,
            cb.exists(sub1)
        )
    }

    override fun supports(fromClass: Class<*>, toClass: Class<*>): Boolean =
        first.supports(fromClass, bClass) && second.supports(bClass, toClass)

}