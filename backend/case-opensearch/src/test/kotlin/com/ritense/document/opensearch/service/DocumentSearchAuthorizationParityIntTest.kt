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

package com.ritense.document.opensearch.service

import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.permission.ConditionContainer
import com.ritense.authorization.permission.Permission
import com.ritense.authorization.permission.condition.ExpressionPermissionCondition
import com.ritense.authorization.permission.condition.PermissionConditionOperator.EQUAL_TO
import com.ritense.authorization.role.Role
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.domain.search.AdvancedSearchRequest
import com.ritense.document.opensearch.BaseOpenSearchIntegrationTest
import com.ritense.document.opensearch.domain.JsonSchemaDocumentOsDocument
import com.ritense.document.opensearch.domain.OsBlueprintId
import com.ritense.document.opensearch.domain.OsDefinitionId
import com.ritense.document.service.DocumentSearchService
import com.ritense.document.service.JsonSchemaDocumentActionProvider
import com.ritense.document.service.impl.JsonSchemaDocumentSearchService
import com.ritense.testutilscommon.junit.extension.LiquibaseRunnerExtension
import com.ritense.valtimo.contract.blueprint.BlueprintType
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.data.domain.PageRequest
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.context.junit.jupiter.SpringExtension
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * Proves a permission condition on a document-**content** field filters the same cases on PostgreSQL (JPA) and
 * OpenSearch — the parity that exercises the `flat_object` mapping + the condition translator's `.keyword`
 * handling. Scenario A targets a top-level scalar content path (mapped text + keyword); scenario B targets a
 * field nested inside an object (a `flat_object` leaf, queried without the `.keyword` suffix).
 */
@SpringBootTest
@ExtendWith(SpringExtension::class, LiquibaseRunnerExtension::class)
@Tag("integration")
@Transactional
@WithMockUser(username = BaseOpenSearchIntegrationTest.USERNAME, authorities = [DocumentSearchAuthorizationParityIntTest.CONTENT_ROLE])
class DocumentSearchAuthorizationParityIntTest : BaseOpenSearchIntegrationTest() {

    @Autowired
    @Qualifier("jpaDocumentSearchService")
    lateinit var jpaSearchService: JsonSchemaDocumentSearchService

    @Autowired
    @Qualifier("openSearchDocumentSearchService")
    lateinit var openSearchSearchService: JsonSchemaDocumentOpenSearchService

    @BeforeEach
    fun setUp() {
        permissionRepository.deleteAll()
        searchEngineToggle.set(SearchEngineToggle.Engine.OPENSEARCH)
    }

    @Test
    fun `a permission on a top-level scalar content field filters identically on JPA and OpenSearch`() {
        val match = seedPerson(firstName = "Alice", openzaakX = "secret")
        seedPerson(firstName = "Bob", openzaakX = "other")

        setUpContentPermission(path = "$.firstName", value = "Alice")

        val expected = setOf(match.id().toString())
        assertThat(searchIds(jpaSearchService)).`as`("JPA").isEqualTo(expected)
        assertThat(searchIds(openSearchSearchService)).`as`("OpenSearch").isEqualTo(expected)
    }

    @Test
    fun `a permission on a field nested inside an object filters identically on JPA and OpenSearch`() {
        val match = seedPerson(firstName = "Alice", openzaakX = "secret")
        seedPerson(firstName = "Bob", openzaakX = "other")

        setUpContentPermission(path = "$.openzaakgegevens.x", value = "secret")

        val expected = setOf(match.id().toString())
        assertThat(searchIds(jpaSearchService)).`as`("JPA").isEqualTo(expected)
        assertThat(searchIds(openSearchSearchService)).`as`("OpenSearch").isEqualTo(expected)
    }

    private fun searchIds(service: DocumentSearchService): Set<String> =
        service.search("person", BlueprintType.CASE, AdvancedSearchRequest(), PageRequest.of(0, 50))
            .content.map { it.id().toString() }.toSet()

    private fun setUpContentPermission(path: String, value: String) {
        val role = roleRepository.findByKey(CONTENT_ROLE) ?: roleRepository.save(Role(UUID.randomUUID(), CONTENT_ROLE))
        permissionRepository.save(
            Permission(
                UUID.randomUUID(),
                JsonSchemaDocument::class.java,
                mutableListOf(JsonSchemaDocumentActionProvider.VIEW_LIST),
                ConditionContainer(
                    listOf(ExpressionPermissionCondition("content", path, EQUAL_TO, value, String::class.java))
                ),
                role,
            )
        )
    }

    private fun seedPerson(firstName: String, openzaakX: String): JsonSchemaDocument {
        val content = objectMapper.createObjectNode().apply {
            put("firstName", firstName)
            set<ObjectNode>("openzaakgegevens", objectMapper.createObjectNode().put("x", openzaakX))
        }
        val jpaDoc = runWithoutAuthorization {
            documentService.createDocument(NewDocumentRequest("person", "person", "1.0.0", content))
                .resultingDocument().get()
        }
        indexOsDocument(
            JsonSchemaDocumentOsDocument(
                id = jpaDoc.id().toString(),
                content = mapOf("firstName" to firstName, "openzaakgegevens" to mapOf("x" to openzaakX)),
                definitionId = OsDefinitionId(
                    name = "person",
                    version = null,
                    blueprintId = OsBlueprintId(
                        blueprintType = "CASE",
                        blueprintKey = null,
                        blueprintVersionTag = null,
                        isBuildingBlock = null,
                        isCase = null,
                    ),
                ),
                createdOn = null,
                modifiedOn = null,
                createdBy = null,
                sequence = null,
                version = null,
                assigneeId = null,
                assigneeFullName = null,
                internalStatus = null,
                caseTags = null,
                relations = null,
                relatedFiles = null,
                retentionDate = null,
                contentText = "$firstName $openzaakX",
            )
        )
        refreshIndex()
        return jpaDoc
    }

    companion object {
        const val CONTENT_ROLE = "content-parity-test-role"
    }
}
