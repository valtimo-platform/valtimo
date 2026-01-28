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

package com.ritense.authorization.permission.condition

import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.BaseIntegrationTest
import com.ritense.authorization.permission.ConditionContainer
import com.ritense.authorization.permission.Permission
import com.ritense.authorization.permission.PermissionRepository
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.authorization.role.Role
import com.ritense.authorization.role.RoleRepository
import com.ritense.authorization.testimpl.TestEntity
import com.ritense.authorization.testimpl.TestEntityActionProvider
import com.ritense.authorization.testimpl.TestEntityRepository
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import kotlin.test.assertEquals

@Transactional
class AuthorizationFieldAliasIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var authorizationService: AuthorizationService

    @Autowired
    lateinit var roleRepository: RoleRepository

    @Autowired
    lateinit var permissionRepository: PermissionRepository

    @Autowired
    lateinit var testEntityRepository: TestEntityRepository

    @BeforeEach
    fun beforeEach() {
        permissionRepository.deleteAll()
        roleRepository.deleteByKeyIn(listOf("ALIAS_ROLE"))
        roleRepository.save(Role(key = "ALIAS_ROLE"))
        testEntityRepository.deleteAll()
    }

    @Test
    @WithMockUser(authorities = ["ALIAS_ROLE"])
    fun `should honor field aliases for in-memory authorization checks`() {
        val role = roleRepository.findByKey("ALIAS_ROLE")!!
        val permission = Permission(
            id = UUID.randomUUID(),
            resourceType = TestEntity::class.java,
            actions = mutableListOf(TestEntityActionProvider.view),
            conditionContainer = ConditionContainer(
                listOf(
                    FieldPermissionCondition(
                        field = "legacyName",
                        operator = PermissionConditionOperator.EQUAL_TO,
                        value = "alias-ok"
                    )
                )
            ),
            role = role
        )

        permissionRepository.saveAndFlush(permission)

        val hasPermission = authorizationService.hasPermission(
            EntityAuthorizationRequest(
                TestEntity::class.java,
                TestEntityActionProvider.view,
                TestEntity(name = "alias-ok")
            )
        )

        assertEquals(true, hasPermission)
    }

    @Test
    @WithMockUser(authorities = ["ALIAS_ROLE"])
    fun `should honor field aliases for database predicates`() {
        val role = roleRepository.findByKey("ALIAS_ROLE")!!
        val permission = Permission(
            id = UUID.randomUUID(),
            resourceType = TestEntity::class.java,
            actions = mutableListOf(TestEntityActionProvider.view_list),
            conditionContainer = ConditionContainer(
                listOf(
                    FieldPermissionCondition(
                        field = "legacyName",
                        operator = PermissionConditionOperator.EQUAL_TO,
                        value = "alias-ok"
                    )
                )
            ),
            role = role
        )

        permissionRepository.saveAndFlush(permission)
        testEntityRepository.saveAndFlush(TestEntity(name = "alias-ok"))

        val spec = authorizationService.getAuthorizationSpecification(
            EntityAuthorizationRequest(
                TestEntity::class.java,
                TestEntityActionProvider.view_list,
                null
            )
        )

        val results = testEntityRepository.findAll(spec)
        assertEquals(1, results.size)
        assertEquals("alias-ok", results[0].name)
    }
}
