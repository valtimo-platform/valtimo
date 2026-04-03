/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.document.mongodb.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.Action
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.permission.ConditionContainer
import com.ritense.authorization.permission.Permission
import com.ritense.authorization.role.Role
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.search.AdvancedSearchRequest
import com.ritense.document.mongodb.authorization.MongoAuthorizationEntityMapper
import com.ritense.document.mongodb.authorization.MongoPermissionConditionTranslator
import com.ritense.document.mongodb.domain.JsonSchemaDocumentDocument
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.document.service.JsonSchemaDocumentActionProvider
import com.ritense.document.service.SearchFieldService
import com.ritense.outbox.OutboxService
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.blueprint.BlueprintType
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.data.domain.PageRequest
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Query
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder

class JsonSchemaDocumentMongoSearchServiceTest {

    private val mongoTemplate: MongoTemplate = mock()
    private val authorizationService: AuthorizationService = mock()
    private val jpaRepository: JsonSchemaDocumentRepository = mock()
    private val userManagementService: UserManagementService = mock()
    private val searchFieldService: SearchFieldService = mock()
    private val outboxService: OutboxService = mock()
    private val objectMapper: ObjectMapper = ObjectMapper()

    private lateinit var service: JsonSchemaDocumentMongoSearchService

    @BeforeEach
    fun setUp() {
        val translator = MongoPermissionConditionTranslator(
            mongoMappers = emptyList<MongoAuthorizationEntityMapper<*, *>>(),
            authorizationService = authorizationService,
            documentRepository = jpaRepository,
        )
        service = JsonSchemaDocumentMongoSearchService(
            mongoTemplate = mongoTemplate,
            translator = translator,
            authorizationService = authorizationService,
            jpaRepository = jpaRepository,
            userManagementService = userManagementService,
            searchFieldService = searchFieldService,
            outboxService = outboxService,
            objectMapper = objectMapper,
        )

        val auth = UsernamePasswordAuthenticationToken(
            USERNAME,
            null,
            listOf(SimpleGrantedAuthority(FULL_ACCESS_ROLE)),
        )
        SecurityContextHolder.getContext().authentication = auth

        val role = Role(key = FULL_ACCESS_ROLE)
        val viewListPermission = Permission(
            resourceType = JsonSchemaDocument::class.java,
            actions = mutableListOf(JsonSchemaDocumentActionProvider.VIEW_LIST),
            conditionContainer = ConditionContainer(emptyList()),
            role = role,
        )
        whenever(
            authorizationService.getPermissions(
                eq(JsonSchemaDocument::class.java),
                eq(JsonSchemaDocumentActionProvider.VIEW_LIST),
            )
        ).thenReturn(listOf(viewListPermission))

        whenever(mongoTemplate.count(any(), eq(JsonSchemaDocumentDocument::class.java))).thenReturn(0L)
        whenever(mongoTemplate.find(any(), eq(JsonSchemaDocumentDocument::class.java))).thenReturn(emptyList())
        whenever(jpaRepository.findAllById(any())).thenReturn(emptyList())
    }

    @AfterEach
    fun tearDown() {
        SecurityContextHolder.clearContext()
    }

    @Test
    fun `search with globalSearchFilter adds contentText regex to query`() {
        val queryCaptor = argumentCaptor<Query>()
        whenever(mongoTemplate.count(queryCaptor.capture(), eq(JsonSchemaDocumentDocument::class.java))).thenReturn(0L)

        val request = AdvancedSearchRequest().globalSearchFilter("Amsterdam")
        service.search("house", BlueprintType.CASE, request, PageRequest.of(0, 10))

        val queryJson = queryCaptor.firstValue.queryObject.toJson()
        assertThat(queryJson).contains("contentText")
    }

    @Test
    fun `search without globalSearchFilter does not include contentText criterion`() {
        val queryCaptor = argumentCaptor<Query>()
        whenever(mongoTemplate.count(queryCaptor.capture(), eq(JsonSchemaDocumentDocument::class.java))).thenReturn(0L)

        val request = AdvancedSearchRequest()
        service.search("house", BlueprintType.CASE, request, PageRequest.of(0, 10))

        val queryJson = queryCaptor.firstValue.queryObject.toJson()
        assertThat(queryJson).doesNotContain("contentText")
    }

    @Test
    fun `search with empty globalSearchFilter does not include contentText criterion`() {
        val queryCaptor = argumentCaptor<Query>()
        whenever(mongoTemplate.count(queryCaptor.capture(), eq(JsonSchemaDocumentDocument::class.java))).thenReturn(0L)

        val request = AdvancedSearchRequest().globalSearchFilter("")
        service.search("house", BlueprintType.CASE, request, PageRequest.of(0, 10))

        val queryJson = queryCaptor.firstValue.queryObject.toJson()
        assertThat(queryJson).doesNotContain("contentText")
    }

    @Test
    fun `search with globalSearchFilter uses case-insensitive regex`() {
        val queryCaptor = argumentCaptor<Query>()
        whenever(mongoTemplate.count(queryCaptor.capture(), eq(JsonSchemaDocumentDocument::class.java))).thenReturn(0L)

        val request = AdvancedSearchRequest().globalSearchFilter("john")
        service.search("house", BlueprintType.CASE, request, PageRequest.of(0, 10))

        val queryJson = queryCaptor.firstValue.queryObject.toJson()
        assertThat(queryJson).contains("contentText")
        assertThat(queryJson).contains("options")
        assertThat(queryJson).contains("\"i\"") // case-insensitive flag
    }

    @Test
    fun `search result uses count from mongodb`() {
        whenever(mongoTemplate.count(any(), eq(JsonSchemaDocumentDocument::class.java))).thenReturn(5L)
        whenever(mongoTemplate.find(any(), eq(JsonSchemaDocumentDocument::class.java))).thenReturn(emptyList())

        val request = AdvancedSearchRequest().globalSearchFilter("test")
        val page = service.search("house", BlueprintType.CASE, request, PageRequest.of(0, 10))

        assertThat(page.totalElements).isEqualTo(5L)
    }

    companion object {
        private const val FULL_ACCESS_ROLE = "full access role"
        private const val USERNAME = "test@test.com"
    }
}
