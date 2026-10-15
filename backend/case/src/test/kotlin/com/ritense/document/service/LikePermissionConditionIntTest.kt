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

package com.ritense.document.service

import com.ritense.BaseIntegrationTest
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.permission.ConditionContainer
import com.ritense.authorization.permission.Permission
import com.ritense.authorization.permission.condition.ExpressionPermissionCondition
import com.ritense.authorization.permission.condition.PermissionConditionOperator.LIKE
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.authorization.role.Role
import com.ritense.document.domain.impl.JsonSchemaDocument
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Transactional
class LikePermissionConditionIntTest @Autowired constructor(
    private val authorizationService: AuthorizationService
) : BaseIntegrationTest() {

    @Test
    fun `should only find cases whose document value contains the like value ignoring case`() {
        documentRepository.deleteAll()
        val definition = definition()
        val matching = listOf("Foo street", "my FOO").map { createDocument(definition, """{"street": "$it"}""") }
        listOf("Bar", "F o o").forEach { createDocument(definition, """{"street": "$it"}""") }
        val condition = ExpressionPermissionCondition("content.content", "$.street", LIKE, "foo", String::class.java)

        val found = documentRepository.findAll(specificationFor(condition))

        assertThat(found.map { it.id() }).containsExactlyInAnyOrderElementsOf(matching.map { it.id() })
        assertThat(documentRepository.findAll().filter { condition.isValid(it) }.map { it.id() })
            .containsExactlyInAnyOrderElementsOf(matching.map { it.id() })
    }

    private fun specificationFor(condition: ExpressionPermissionCondition<String>) =
        authorizationService.getAuthorizationSpecification(
            EntityAuthorizationRequest(JsonSchemaDocument::class.java, JsonSchemaDocumentActionProvider.VIEW_LIST, null),
            listOf(
                Permission(
                    UUID.randomUUID(),
                    JsonSchemaDocument::class.java,
                    mutableListOf(JsonSchemaDocumentActionProvider.VIEW_LIST),
                    ConditionContainer(listOf(condition)),
                    Role(key = "like-role")
                )
            )
        )
}
