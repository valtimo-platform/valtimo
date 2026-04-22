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

package com.ritense.valtimo.contract.dashboard

import com.ritense.authorization.UserManagementServiceHolder
import com.ritense.valtimo.contract.authentication.ManageableUser
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.valtimo.contract.repository.ExpressionOperator
import jakarta.persistence.criteria.CriteriaBuilder
import jakarta.persistence.criteria.Expression
import jakarta.persistence.criteria.Root
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.Mockito.mock
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.expression.spel.SpelEvaluationException
import java.time.LocalDateTime

class QueryConditionTest {

    companion object {
        @JvmStatic
        @BeforeAll
        fun setUpUserManagementService() {
            val mockUser = mock(ManageableUser::class.java)
            whenever(mockUser.id).thenReturn("test-user-id")
            whenever(mockUser.email).thenReturn("test@example.com")
            whenever(mockUser.roles).thenReturn(emptyList())
            whenever(mockUser.username).thenReturn("test-user")

            val mockService = mock(UserManagementService::class.java)
            whenever(mockService.currentUser).thenReturn(mockUser)

            UserManagementServiceHolder(mockService)
        }
    }

    @Test
    fun `should deserialize with number value`() {
        val value = MapperSingleton.get().readValue(
            """
            {
                "queryPath": "/xyz",
                "queryOperator": "==",
                "queryValue": 69
            }
        """.trimIndent(), QueryCondition::class.java
        )

        assertThat(value).isNotNull
        assertThat(value.queryValue).isEqualTo(69)
        assertThat(value.queryValue).isNotEqualTo("69")
    }

    @Test
    fun `should deserialize with string value`() {
        val value = MapperSingleton.get().readValue(
            """
            {
                "queryPath": "/xyz",
                "queryOperator": "==",
                "queryValue": "69"
            }
        """.trimIndent(), QueryCondition::class.java
        )

        assertThat(value).isNotNull
        assertThat(value.queryValue).isEqualTo("69")
        assertThat(value.queryValue).isNotEqualTo(69)
    }

    /**
     * Tests below verify that the SimpleEvaluationContext used in QueryCondition's SpEL
     * evaluation blocks dangerous type references and operations. Each test calls
     * [QueryCondition.toPredicate] with a malicious queryValue that passes the
     * dateTimeSpelExpression gate (contains "localDateTimeNow"). The SpEL evaluation
     * throws before any predicate logic runs.
     */
    private val mockRoot: Root<*> = mock()
    private val mockCriteriaBuilder: CriteriaBuilder = mock()
    private val mockPathExpressionFunction: (Class<Any>, String, Root<*>, CriteriaBuilder) -> Expression<Any> =
        { _, _, _, _ -> mock() }

    private fun evaluateMaliciousQueryCondition(expression: String) {
        val condition = QueryCondition(
            queryPath = "/test",
            queryOperator = ExpressionOperator.EQUAL_TO,
            queryValue = expression
        )
        condition.toPredicate(mockRoot, mockCriteriaBuilder, mockPathExpressionFunction)
    }

    @Test
    fun `should block OS command execution via Runtime in query condition`() {
        assertThrows<SpelEvaluationException> {
            evaluateMaliciousQueryCondition("\${T(java.lang.Runtime).getRuntime().exec(localDateTimeNow.toString())}")
        }
    }

    @Test
    fun `should block access to environment variables in query condition`() {
        assertThrows<SpelEvaluationException> {
            evaluateMaliciousQueryCondition("\${T(java.lang.System).getenv().toString() + localDateTimeNow}")
        }
    }

    @Test
    fun `should block class loading via Class forName in query condition`() {
        assertThrows<SpelEvaluationException> {
            evaluateMaliciousQueryCondition("\${T(java.lang.Class).forName(localDateTimeNow.toString())}")
        }
    }

    @Test
    fun `should block access to system properties in query condition`() {
        assertThrows<SpelEvaluationException> {
            evaluateMaliciousQueryCondition("\${T(java.lang.System).getProperties().toString() + localDateTimeNow}")
        }
    }

    @Test
    fun `should block ProcessBuilder command execution in query condition`() {
        assertThrows<SpelEvaluationException> {
            evaluateMaliciousQueryCondition("\${new java.lang.ProcessBuilder(localDateTimeNow.toString()).start()}")
        }
    }

    @Test
    fun `should block arbitrary constructor invocation in query condition`() {
        assertThrows<SpelEvaluationException> {
            evaluateMaliciousQueryCondition("\${new java.io.File(localDateTimeNow.toString()).exists()}")
        }
    }

    @Test
    fun `should block class loader access in query condition`() {
        assertThrows<SpelEvaluationException> {
            evaluateMaliciousQueryCondition("\${T(java.lang.Thread).currentThread().getContextClassLoader().toString() + localDateTimeNow}")
        }
    }

    @Test
    fun `should still allow legitimate localDateTimeNow expression`() {
        val condition = QueryCondition(
            queryPath = "/test",
            queryOperator = ExpressionOperator.GREATER_THAN_OR_EQUAL_TO,
            queryValue = "\${localDateTimeNow.plusMinutes(1)}"
        )
        val mockExpression: Expression<Any> = mock()
        val mockPredicate: jakarta.persistence.criteria.Predicate = mock()
        whenever(mockCriteriaBuilder.greaterThanOrEqualTo<Comparable<Any>>(any(), any<Comparable<Any>>()))
            .thenReturn(mockPredicate)

        val result = condition.toPredicate(mockRoot, mockCriteriaBuilder) { _, _, _, _ -> mockExpression }

        assertThat(result).isEqualTo(mockPredicate)
    }

    @Test
    fun `should allow method chaining on localDateTimeNow`() {
        val condition = QueryCondition(
            queryPath = "/test",
            queryOperator = ExpressionOperator.LESS_THAN_OR_EQUAL_TO,
            queryValue = "\${localDateTimeNow.minusDays(7).plusHours(2)}"
        )
        val mockExpression: Expression<Any> = mock()
        val mockPredicate: jakarta.persistence.criteria.Predicate = mock()
        whenever(mockCriteriaBuilder.lessThanOrEqualTo<Comparable<Any>>(any(), any<Comparable<Any>>()))
            .thenReturn(mockPredicate)

        val result = condition.toPredicate(mockRoot, mockCriteriaBuilder) { _, _, _, _ -> mockExpression }

        assertThat(result).isEqualTo(mockPredicate)
    }

}