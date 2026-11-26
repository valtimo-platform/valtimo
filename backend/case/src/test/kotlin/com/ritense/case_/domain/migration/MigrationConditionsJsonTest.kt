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

package com.ritense.case_.domain.migration

import com.ritense.valtimo.contract.hibernate.RuntimeTypeJsonFormatMapper
import com.ritense.valtimo.contract.json.MapperSingleton
import org.assertj.core.api.Assertions.assertThat
import org.hibernate.type.descriptor.WrapperOptions
import org.hibernate.type.descriptor.java.JavaType
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever

class MigrationConditionsJsonTest {

    private val formatMapper = RuntimeTypeJsonFormatMapper(MapperSingleton.get())
    private val conditionsType = CaseDefinitionMigration::class.java.getDeclaredField("conditions").genericType

    private val conditions: List<MigrationConditionNode> = listOf(
        MigrationCondition("doc:/scenario", "==", "genest"),
        AnyOfMigrationCondition(
            listOf(
                MigrationCondition("doc:/spoed", "==", true),
                AllOfMigrationCondition(listOf(MigrationCondition("doc:/oppervlakte", ">=", 50))),
            )
        ),
    )

    @Test
    fun `stored conditions survive the copy Hibernate makes through their declared type`() {
        val javaType = mock<JavaType<List<MigrationConditionNode>>>()
        whenever(javaType.javaType).thenReturn(conditionsType)
        val options = mock<WrapperOptions>()

        val copy = formatMapper.fromString(formatMapper.toString(conditions, javaType, options), javaType, options)

        assertThat(copy).isEqualTo(conditions)
    }
}
