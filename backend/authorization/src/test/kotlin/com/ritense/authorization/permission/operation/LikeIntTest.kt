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

package com.ritense.authorization.permission.operation

import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.BaseIntegrationTest
import com.ritense.authorization.permission.ConditionContainer
import com.ritense.authorization.permission.Permission
import com.ritense.authorization.permission.condition.ExpressionPermissionCondition
import com.ritense.authorization.permission.condition.FieldPermissionCondition
import com.ritense.authorization.permission.condition.PermissionCondition
import com.ritense.authorization.permission.condition.PermissionConditionOperator.LIKE
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.authorization.role.Role
import com.ritense.authorization.testimpl.TestChildEntity
import com.ritense.authorization.testimpl.TestEntity
import com.ritense.authorization.testimpl.TestEntityActionProvider.Companion.view_list
import com.ritense.authorization.testimpl.TestEntityRepository
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.authorization.UserManagementServiceHolder
import com.ritense.valtimo.contract.json.MapperSingleton
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.Mockito
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Transactional
class LikeIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var repository: TestEntityRepository

    @Autowired
    lateinit var authorizationService: AuthorizationService

    private val entities = mutableMapOf<String, TestEntity>()
    private val currentUsers = mock<UserManagementService>(defaultAnswer = Mockito.RETURNS_DEEP_STUBS)

    @BeforeEach
    fun setUp() {
        UserManagementServiceHolder(currentUsers)
        save("street", "Foo street")
        save("upper", "my FOO")
        save("other", "Bar")
        save("list", listOf("x", "a foo"))
        save("listWithoutMatch", listOf("x", "bar"))
        save("number", 42)
        save("object", mapOf("name" to "foo"))
        save("nestedList", listOf(listOf("foo")))
        save("listOfObjects", listOf(mapOf("name" to "foo")))
        save("percent", "100%_off")
        save("noPercent", "100x_off")
        save("quoted", "say \"hi\\there\"")
        save("regex", "a.b")
        save("notRegex", "axb")
    }

    @AfterEach
    fun tearDown() {
        repository.deleteAll()
        UserManagementServiceHolder(userManagementService)
    }

    @Test
    fun `expression like matches strings and string list elements containing the value ignoring case`() {
        assertLike(expressionLike("foo"), "street", "upper", "list")
    }

    @Test
    fun `expression like matches wildcard characters literally`() {
        assertLike(expressionLike("0%_"), "percent")
    }

    @Test
    fun `expression like matches regex characters literally`() {
        assertLike(expressionLike("a.b"), "regex")
    }

    @Test
    fun `expression like matches quotes and backslashes literally`() {
        assertLike(expressionLike("\"hi\\there\""), "quoted")
    }

    @Test
    fun `expression like does not match numbers`() {
        assertLike(expressionLike("4"))
    }

    @Test
    fun `expression like with a blank value matches nothing`() {
        assertLike(expressionLike(" "))
        assertLike(expressionLike(""))
    }

    @Test
    fun `expression like with a null value matches nothing`() {
        assertLike(expressionLike(null))
    }

    @Test
    fun `expression like resolves the current user placeholder`() {
        whenever(currentUsers.currentUser.username).thenReturn("FOO")

        assertLike(expressionLike("\${currentUsername}"), "street", "upper", "list")
    }

    @Test
    fun `expression like with a placeholder that resolves to a list matches nothing`() {
        whenever(currentUsers.currentUser.roles).thenReturn(listOf("foo"))

        assertLike(expressionLike("\${currentUserRoles}"))
    }

    @Test
    fun `field like matches a text field containing the value ignoring case`() {
        repository.save(TestEntity(name = "Henk FOOBAR").also { entities["named"] = it })

        assertLike(fieldLike("name", "foob"), "named")
    }

    @Test
    fun `field like on a non-text field matches nothing`() {
        repository.save(TestEntity(someNumber = 42).also { entities["numbered"] = it })

        assertLike(fieldLike("someNumber", "4"))
    }

    @Test
    fun `field like with a blank value matches nothing`() {
        assertLike(fieldLike("name", " "))
    }

    private fun save(key: String, property: Any) {
        entities[key] = repository.save(TestEntity(TestChildEntity(property), key))
    }

    private fun expressionLike(value: String?): PermissionCondition =
        MapperSingleton.get().copy().apply { registerSubtypes(ExpressionPermissionCondition::class.java) }.readValue(
            """
            {
                "type": "expression",
                "field": "child",
                "path": "$.property",
                "operator": "like",
                "value": ${MapperSingleton.get().writeValueAsString(value)},
                "clazz": "java.lang.String"
            }
            """.trimIndent()
        )

    private fun fieldLike(field: String, value: String): PermissionCondition =
        FieldPermissionCondition(field, LIKE, value)

    private fun assertLike(condition: PermissionCondition, vararg expectedKeys: String) {
        val permission = Permission(
            UUID.randomUUID(),
            TestEntity::class.java,
            mutableListOf(view_list),
            ConditionContainer(listOf(condition)),
            Role(key = "like-role")
        )
        val spec = authorizationService.getAuthorizationSpecification(
            EntityAuthorizationRequest(TestEntity::class.java, view_list, null),
            listOf(permission)
        )
        val fromDatabase = repository.findAll(spec).map { it.name }
        val inMemory = repository.findAll().filter { condition.isValid(it) }.map { it.name }

        assertThat(fromDatabase).containsExactlyInAnyOrder(*expectedKeys.map(::nameOf).toTypedArray())
        assertThat(inMemory).containsExactlyInAnyOrder(*expectedKeys.map(::nameOf).toTypedArray())
    }

    private fun nameOf(key: String) = entities.getValue(key).name
}
