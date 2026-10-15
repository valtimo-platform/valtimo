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

package com.ritense.authorization.permission.condition

import com.ritense.valtimo.contract.json.MapperSingleton
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class PermissionSchemaOperatorTest {

    @Test
    fun `permission schema should list every operator for field and expression conditions`() {
        val schema = MapperSingleton.get().readTree(javaClass.getResource("/config/permission-schema.json"))
        val operators = PermissionConditionOperator.entries.map { it.asText }

        listOf("fieldCondition", "expressionCondition").forEach { condition ->
            val listed = schema.findValue(condition).at("/properties/operator/enum").map { it.asText() }
            assertThat(listed).describedAs(condition).containsExactlyInAnyOrderElementsOf(operators)
        }
    }
}
