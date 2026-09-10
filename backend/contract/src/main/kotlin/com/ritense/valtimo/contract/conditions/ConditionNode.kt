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

package com.ritense.valtimo.contract.conditions

import jakarta.persistence.criteria.CriteriaBuilder
import jakarta.persistence.criteria.Expression
import jakarta.persistence.criteria.Predicate
import jakarta.persistence.criteria.Root

/**
 * A node in a condition tree: either a leaf [Condition] or an [AndConditionGroup]/[OrConditionGroup]
 * combining child nodes. A JSON list of nodes at the top level is combined with AND (legacy semantics).
 *
 * IMPORTANT: do not add a class-level @JsonDeserialize to this interface — Jackson resolves
 * class annotations through implemented interfaces, which would break/recurse [Condition]
 * deserialization. Annotate properties with
 * @JsonDeserialize(contentUsing = ConditionNodeDeserializer::class) instead.
 */
sealed interface ConditionNode {
    fun isValid(expressionResolver: (String) -> Any?): Boolean

    fun toPredicate(
        root: Root<*>,
        criteriaBuilder: CriteriaBuilder,
        pathExpressionFunction: (Class<Any>, String, Root<*>, CriteriaBuilder) -> Expression<Any>
    ): Predicate
}

data class AndConditionGroup(
    val and: List<ConditionNode>
) : ConditionNode {
    override fun isValid(expressionResolver: (String) -> Any?) =
        and.all { it.isValid(expressionResolver) }

    override fun toPredicate(
        root: Root<*>,
        criteriaBuilder: CriteriaBuilder,
        pathExpressionFunction: (Class<Any>, String, Root<*>, CriteriaBuilder) -> Expression<Any>
    ): Predicate = criteriaBuilder.and(
        *and.map { it.toPredicate(root, criteriaBuilder, pathExpressionFunction) }.toTypedArray()
    )
}

data class OrConditionGroup(
    val or: List<ConditionNode>
) : ConditionNode {
    override fun isValid(expressionResolver: (String) -> Any?) =
        or.any { it.isValid(expressionResolver) }

    override fun toPredicate(
        root: Root<*>,
        criteriaBuilder: CriteriaBuilder,
        pathExpressionFunction: (Class<Any>, String, Root<*>, CriteriaBuilder) -> Expression<Any>
    ): Predicate = criteriaBuilder.or(
        *or.map { it.toPredicate(root, criteriaBuilder, pathExpressionFunction) }.toTypedArray()
    )
}