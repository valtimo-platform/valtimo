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

import com.ritense.valtimo.contract.authentication.ManageableUser
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.authorization.UserManagementServiceHolder
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.valtimo.contract.repository.ExpressionOperator
import java.time.LocalDateTime
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.Mockito.mock
import org.mockito.kotlin.whenever
import org.springframework.expression.spel.SpelEvaluationException

class ConditionTest {

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
        """.trimIndent(), Condition::class.java
        )

        assertThat(value).isNotNull
        assertThat(value.value).isEqualTo(69)
        assertThat(value.value).isNotEqualTo("69")
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
        """.trimIndent(), Condition::class.java
        )

        assertThat(value).isNotNull
        assertThat(value.value).isEqualTo("69")
        assertThat(value.value).isNotEqualTo(69)
    }

    @Test
    fun `should allow instance method calls like plusMinutes on LocalDateTime`() {
        val condition = Condition(
            path = "/xyz",
            operator = ExpressionOperator.LESS_THAN,
            value = "\${localDateTimeNow.plusMinutes(1)}" as Comparable<Any>
        )

        val result = condition.isValid { LocalDateTime.now() }
        assertThat(result).isTrue()
    }

    @Test
    fun `should block SpEL type reference for Runtime exec`() {
        val condition = Condition(
            path = "/xyz",
            operator = ExpressionOperator.EQUAL_TO,
            value = "\${T(java.lang.Runtime).getRuntime().exec('id')}" as Comparable<Any>
        )

        assertThrows<SpelEvaluationException> {
            condition.isValid { "some-value" }
        }
    }

    @Test
    fun `should block SpEL type reference for System getenv`() {
        val condition = Condition(
            path = "/xyz",
            operator = ExpressionOperator.EQUAL_TO,
            value = "\${T(java.lang.System).getenv()}" as Comparable<Any>
        )

        assertThrows<SpelEvaluationException> {
            condition.isValid { "some-value" }
        }
    }

    @Test
    fun `should block SpEL type reference for Class forName`() {
        val condition = Condition(
            path = "/xyz",
            operator = ExpressionOperator.EQUAL_TO,
            value = "\${T(java.lang.Class).forName('java.lang.Runtime')}" as Comparable<Any>
        )

        assertThrows<SpelEvaluationException> {
            condition.isValid { "some-value" }
        }
    }

    @Test
    fun `should block SpEL type reference for System getProperties`() {
        val condition = Condition(
            path = "/xyz",
            operator = ExpressionOperator.EQUAL_TO,
            value = "\${T(java.lang.System).getProperties()}" as Comparable<Any>
        )

        assertThrows<SpelEvaluationException> {
            condition.isValid { "some-value" }
        }
    }

}