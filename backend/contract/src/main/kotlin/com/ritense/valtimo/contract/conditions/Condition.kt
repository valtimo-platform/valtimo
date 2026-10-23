/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

import com.fasterxml.jackson.annotation.JsonAlias
import com.fasterxml.jackson.databind.annotation.JsonDeserialize
import com.ritense.valtimo.contract.dashboard.ConditionSpelEvaluationContext
import com.ritense.valtimo.contract.repository.ExpressionOperator
import jakarta.persistence.criteria.CriteriaBuilder
import jakarta.persistence.criteria.Expression
import jakarta.persistence.criteria.Predicate
import jakarta.persistence.criteria.Root
import java.math.BigDecimal
import org.springframework.expression.spel.standard.SpelExpressionParser
import org.springframework.expression.spel.support.DataBindingMethodResolver
import org.springframework.expression.spel.support.SimpleEvaluationContext

/**
 * A condition that can generically be used for different features where user entered conditions are required.
 * Because the condition can be used in different contexts, the actual value resolution is done outside of this class.
 * The [expressionResolver] or [pathExpressionFunction] function is used to resolve the actual value of the field that
 * needs to be evaluated.
 */
data class Condition<T : Comparable<T>>(
    @JsonAlias("queryPath")
    val path: String,
    @JsonAlias("queryOperator")
    val operator: ExpressionOperator,
    @JsonAlias("queryValue")
    @JsonDeserialize(using = ComparableDeserializer::class)
    val value: T
) : ConditionNode {

    init {
        // A list is never equal to a scalar, so '==' would always be false and '!=' always true.
        require(value !is Collection<*> || operator in LIST_VALUE_OPERATORS) {
            "Operator '${operator.asText}' does not accept a list value, use 'in' or 'list_contains'"
        }
    }

    override fun isValid(
        expressionResolver: (String) -> Any?
    ): Boolean {
        val fieldValue = expressionResolver.invoke(path)
        val resolvedValue = resolveValue(value)
        val (left, right) = alignNumbers(fieldValue, resolvedValue)
        return operator.evaluate(left, right)
    }

    override fun toPredicate(
        root: Root<*>,
        criteriaBuilder: CriteriaBuilder,
        pathExpressionFunction: (Class<Any>, String, Root<*>, CriteriaBuilder) -> Expression<Any>
    ): Predicate {
        pathExpressionFunction as (Class<T>, String, Root<*>, CriteriaBuilder) -> Expression<T>

        val resolvedValue = resolveValue(value)
        // For collection values (e.g. the 'in' operator) the path expression must be cast to the
        // element type, not to the collection type itself.
        val valueClass = when {
            resolvedValue is Collection<*> ->
                (resolvedValue.firstOrNull()?.let { it::class.java } ?: Any::class.java) as Class<T>
            resolvedValue != null -> resolvedValue::class.java as Class<T>
            else -> Any::class.java as Class<T>
        }

        val expression = pathExpressionFunction(valueClass, path, root, criteriaBuilder)

        return operator.toPredicate<T>(
            criteriaBuilder,
            expression,
            resolvedValue
        )
    }

    private fun resolveValue(value: T): Any? {
        return (value as? String)?.let {
            if (it.isNotEmpty() && it.startsWith("\${") && it.endsWith('}')) {
                val parser = SpelExpressionParser()
                val expressionWithoutPrefixSuffix = it.substringAfter("\${").substringBefore("}")

                val expressionContextRoot = getExpressionContextRoot()
                val context = SimpleEvaluationContext
                    .forReadOnlyDataBinding()
                    .withMethodResolvers(DataBindingMethodResolver.forInstanceMethodInvocation())
                    .withRootObject(expressionContextRoot)
                    .build()

                val spelExpression = parser.parseExpression(expressionWithoutPrefixSuffix)

                val value = spelExpression.getValue(context)
                return value
            } else {
                value
            }
        } ?: value
    }

    // Admin-entered values arrive as strings, e.g. "0" vs an Integer field
    private fun alignNumbers(left: Any?, right: Any?): Pair<Any?, Any?> {
        if (left is Collection<*> || right is Collection<*>) {
            return alignNumbersWithList(left, right)
        }
        if ((left !is Number && right !is Number) || left?.javaClass == right?.javaClass) {
            return left to right
        }
        val leftNumber = toBigDecimal(left) ?: return left to right
        val rightNumber = toBigDecimal(right) ?: return left to right
        return leftNumber to rightNumber
    }

    // For 'in' and 'list_contains'
    private fun alignNumbersWithList(left: Any?, right: Any?): Pair<Any?, Any?> {
        val values = listOf(left, right).flatMap { if (it is Collection<*>) it else listOf(it) }
        if (values.none { it is Number }) {
            return left to right
        }
        return toBigDecimalWhereNumeric(left) to toBigDecimalWhereNumeric(right)
    }

    private fun toBigDecimalWhereNumeric(value: Any?): Any? = when (value) {
        is Collection<*> -> value.map { toBigDecimal(it) ?: it }
        else -> toBigDecimal(value) ?: value
    }

    private fun toBigDecimal(value: Any?): BigDecimal? = when (value) {
        is Number, is String -> value.toString().trim().toBigDecimalOrNull()?.stripTrailingZeros()
        else -> null
    }

    private fun getExpressionContextRoot(): ConditionSpelEvaluationContext {
        return ConditionSpelEvaluationContext()
    }

    companion object {
        private val LIST_VALUE_OPERATORS = setOf(ExpressionOperator.IN, ExpressionOperator.LIST_CONTAINS)
    }
}