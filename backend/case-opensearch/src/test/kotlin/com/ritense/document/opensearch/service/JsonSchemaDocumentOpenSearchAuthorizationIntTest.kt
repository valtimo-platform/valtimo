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

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.permission.ConditionContainer
import com.ritense.authorization.permission.Permission
import com.ritense.authorization.permission.condition.FieldPermissionCondition
import com.ritense.authorization.permission.condition.PermissionConditionOperator.EQUAL_TO
import com.ritense.authorization.permission.condition.PermissionConditionOperator.LIST_CONTAINS
import com.ritense.authorization.role.Role
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.domain.search.AdvancedSearchRequest
import com.ritense.document.opensearch.BaseOpenSearchIntegrationTest
import com.ritense.document.opensearch.domain.JsonSchemaDocumentOsDocument
import com.ritense.document.opensearch.domain.OsBlueprintId
import com.ritense.document.opensearch.domain.OsCaseTag
import com.ritense.document.opensearch.domain.OsDefinitionId
import com.ritense.document.service.DocumentSearchService
import com.ritense.document.service.JsonSchemaDocumentActionProvider
import com.ritense.testutilscommon.junit.extension.LiquibaseRunnerExtension
import com.ritense.valtimo.contract.blueprint.BlueprintType
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.data.domain.PageRequest
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.context.junit.jupiter.SpringExtension
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@SpringBootTest
@ExtendWith(SpringExtension::class, LiquibaseRunnerExtension::class)
@Tag("integration")
@Transactional
class JsonSchemaDocumentOpenSearchAuthorizationIntTest : BaseOpenSearchIntegrationTest() {

    @Autowired
    lateinit var documentSearchService: DocumentSearchService

    @BeforeEach
    fun setUp() {
        permissionRepository.deleteAll()
        searchEngineToggle.set(SearchEngineToggle.Engine.OPENSEARCH)
    }

    @Test
    @WithMockUser(username = USERNAME, authorities = [STATUS_ROLE])
    fun `search filters documents by internalStatus permission`() {
        setUpStatusPermission("open")

        val openDoc = seedDocumentWithStatus("open")
        seedDocumentWithStatus("closed")
        seedDocumentWithStatus("archived")

        val page = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest(),
            PageRequest.of(0, 10)
        )

        assertThat(page.totalElements).isEqualTo(1L)
        assertThat(page.content[0].id()).isEqualTo(openDoc.id())
    }

    @Test
    @WithMockUser(username = USERNAME, authorities = [TAGS_ROLE])
    fun `search filters documents by caseTags permission with LIST_CONTAINS`() {
        setUpTagsPermission("urgent")

        seedDocumentWithTags(listOf(OsCaseTag("urgent", "Urgent")))
        seedDocumentWithTags(listOf(OsCaseTag("normal", "Normal")))
        seedDocumentWithTags(listOf(OsCaseTag("urgent", "Urgent"), OsCaseTag("vip", "VIP")))

        val page = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest(),
            PageRequest.of(0, 10)
        )

        assertThat(page.totalElements).isEqualTo(2L)
    }

    @Test
    @WithMockUser(username = USERNAME, authorities = [COMBINED_ROLE])
    fun `search with combined status and tags permissions`() {
        setUpCombinedPermission("open", "urgent")

        val matchingDoc = seedDocumentWithStatusAndTags("open", listOf(OsCaseTag("urgent", "Urgent")))
        seedDocumentWithStatusAndTags("open", listOf(OsCaseTag("normal", "Normal")))
        seedDocumentWithStatusAndTags("closed", listOf(OsCaseTag("urgent", "Urgent")))
        seedDocumentWithStatusAndTags("closed", listOf(OsCaseTag("normal", "Normal")))

        val page = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest(),
            PageRequest.of(0, 10)
        )

        assertThat(page.totalElements).isEqualTo(1L)
        assertThat(page.content[0].id()).isEqualTo(matchingDoc.id())
    }

    private fun setUpStatusPermission(statusKey: String) {
        var role = roleRepository.findByKey(STATUS_ROLE)
        if (role == null) {
            role = roleRepository.save(Role(UUID.randomUUID(), STATUS_ROLE))
        }

        val permission = Permission(
            UUID.randomUUID(),
            JsonSchemaDocument::class.java,
            mutableListOf(JsonSchemaDocumentActionProvider.VIEW_LIST),
            ConditionContainer(listOf(
                FieldPermissionCondition("internalStatus.id.key", EQUAL_TO, statusKey)
            )),
            role!!
        )
        permissionRepository.save(permission)
    }

    private fun setUpTagsPermission(tagKey: String) {
        var role = roleRepository.findByKey(TAGS_ROLE)
        if (role == null) {
            role = roleRepository.save(Role(UUID.randomUUID(), TAGS_ROLE))
        }

        val permission = Permission(
            UUID.randomUUID(),
            JsonSchemaDocument::class.java,
            mutableListOf(JsonSchemaDocumentActionProvider.VIEW_LIST),
            ConditionContainer(listOf(
                FieldPermissionCondition("caseTags", LIST_CONTAINS, tagKey)
            )),
            role!!
        )
        permissionRepository.save(permission)
    }

    private fun setUpCombinedPermission(statusKey: String, tagKey: String) {
        var role = roleRepository.findByKey(COMBINED_ROLE)
        if (role == null) {
            role = roleRepository.save(Role(UUID.randomUUID(), COMBINED_ROLE))
        }

        val permission = Permission(
            UUID.randomUUID(),
            JsonSchemaDocument::class.java,
            mutableListOf(JsonSchemaDocumentActionProvider.VIEW_LIST),
            ConditionContainer(listOf(
                FieldPermissionCondition("internalStatus.id.key", EQUAL_TO, statusKey),
                FieldPermissionCondition("caseTags", LIST_CONTAINS, tagKey)
            )),
            role!!
        )
        permissionRepository.save(permission)
    }

    private fun seedDocumentWithStatus(status: String): JsonSchemaDocument {
        val content = objectMapper.createObjectNode().apply { put("street", "Test Street") }
        val jpaDoc = runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest("house", "house", "1.0.0", content)
            ).resultingDocument().get()
        }
        openSearchRepository.save(
            JsonSchemaDocumentOsDocument(
                id = jpaDoc.id().toString(),
                content = mapOf("street" to "Test Street"),
                definitionId = OsDefinitionId(
                    name = "house",
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
                internalStatus = status,
                caseTags = null,
                relations = null,
                relatedFiles = null,
                retentionDate = null,
                contentText = "Test Street",
            )
        )
        refreshIndex()
        return jpaDoc
    }

    private fun seedDocumentWithTags(tags: List<OsCaseTag>): JsonSchemaDocument {
        val content = objectMapper.createObjectNode().apply { put("street", "Test Street") }
        val jpaDoc = runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest("house", "house", "1.0.0", content)
            ).resultingDocument().get()
        }
        openSearchRepository.save(
            JsonSchemaDocumentOsDocument(
                id = jpaDoc.id().toString(),
                content = mapOf("street" to "Test Street"),
                definitionId = OsDefinitionId(
                    name = "house",
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
                caseTags = tags,
                relations = null,
                relatedFiles = null,
                retentionDate = null,
                contentText = "Test Street",
            )
        )
        refreshIndex()
        return jpaDoc
    }

    private fun seedDocumentWithStatusAndTags(status: String, tags: List<OsCaseTag>): JsonSchemaDocument {
        val content = objectMapper.createObjectNode().apply { put("street", "Test Street") }
        val jpaDoc = runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest("house", "house", "1.0.0", content)
            ).resultingDocument().get()
        }
        openSearchRepository.save(
            JsonSchemaDocumentOsDocument(
                id = jpaDoc.id().toString(),
                content = mapOf("street" to "Test Street"),
                definitionId = OsDefinitionId(
                    name = "house",
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
                internalStatus = status,
                caseTags = tags,
                relations = null,
                relatedFiles = null,
                retentionDate = null,
                contentText = "Test Street",
            )
        )
        refreshIndex()
        return jpaDoc
    }

    companion object {
        const val STATUS_ROLE = "status-test-role"
        const val TAGS_ROLE = "tags-test-role"
        const val COMBINED_ROLE = "combined-test-role"
    }
}
