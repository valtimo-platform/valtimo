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

package com.ritense.authorization.deployment

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.authorization.Action
import com.ritense.authorization.BaseIntegrationTest
import com.ritense.authorization.permission.ConditionContainer
import com.ritense.authorization.permission.Permission
import com.ritense.authorization.permission.condition.FieldPermissionCondition
import com.ritense.authorization.permission.condition.PermissionConditionOperator
import com.ritense.authorization.role.RoleRepository
import com.ritense.authorization.testimpl.TestDocument
import com.ritense.authorization.testimpl.TestEntity
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional

@Transactional
class PermissionDtoRoundTripIntTest @Autowired constructor(
    private val objectMapper: ObjectMapper,
    private val roleRepository: RoleRepository,
    private val migrator: PermissionResourceTypeMigrator
) : BaseIntegrationTest() {

    @Test
    fun `context-bearing permission survives from serialize deserialize toPermission round trip`() {
        val role = roleRepository.findByKey("EXPRESSION_CONTAINS_ROLE_FOR_CONTEXT")!!
        val permission = Permission(
            resourceType = TestEntity::class.java,
            actions = mutableListOf(Action<Any>(Action.VIEW)),
            conditionContainer = ConditionContainer(),
            role = role,
            contextResourceType = TestDocument::class.java,
            contextConditionContainer = ConditionContainer(
                listOf(
                    FieldPermissionCondition(
                        field = "name",
                        operator = PermissionConditionOperator.IN,
                        value = listOf("loan", "gift")
                    )
                )
            )
        )

        val dto = PermissionDto.from(permission)
        val json = objectMapper.writeValueAsString(listOf(dto))
        val parsed = objectMapper.readValue<List<PermissionDto>>(json)
        val rebuilt = parsed.single().toPermission(roleRepository, migrator)

        assertThat(rebuilt).isEqualTo(permission)
        assertThat(rebuilt.contextResourceType).isEqualTo(TestDocument::class.java)
        assertThat(rebuilt.contextConditionContainer?.conditions).isEqualTo(permission.contextConditionContainer?.conditions)
    }
}
