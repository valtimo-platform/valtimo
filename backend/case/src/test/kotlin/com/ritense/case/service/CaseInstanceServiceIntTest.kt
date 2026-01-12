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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.case.service

import com.ritense.BaseIntegrationTest
import com.ritense.authorization.Action
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.case.domain.CaseListColumn
import com.ritense.case.domain.CaseListColumnId
import com.ritense.case.domain.ColumnDefaultSort
import com.ritense.case.repository.CaseDefinitionListColumnRepository
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.search.SearchWithConfigRequest
import com.ritense.search.domain.DisplayType
import com.ritense.search.domain.EmptyDisplayTypeParameter
import com.ritense.valtimo.contract.authentication.ManageableUser
import com.ritense.valtimo.contract.authentication.model.ValtimoUserBuilder
import com.ritense.valueresolver.ValueResolverFactory
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.data.domain.Pageable
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.transaction.annotation.Transactional
import java.util.function.Function
import kotlin.test.assertEquals

@Import(CaseInstanceServiceIntTest.ValueResolverTestConfiguration::class)
class CaseInstanceServiceIntTest @Autowired constructor(
    private val caseInstanceService: CaseInstanceService,
    private val caseDefinitionListColumnRepository: CaseDefinitionListColumnRepository,
) : BaseIntegrationTest() {

    private lateinit var currentUser: ManageableUser

    @BeforeEach
    fun setUp() {
        currentUser = ValtimoUserBuilder()
            .id(CURRENT_USER)
            .username(CURRENT_USER)
            .roles(listOf(FULL_ACCESS_ROLE))
            .build()

        whenever(userManagementService.getCurrentUser()).thenReturn(currentUser)
        whenever(userManagementService.currentUser).thenReturn(currentUser)
    }

    @Test
    @Transactional
    @WithMockUser(username = USERNAME, authorities = [FULL_ACCESS_ROLE])
    fun `should resolve values during search without extra permissions`() {
        documentRepository.deleteAll()
        caseDefinitionListColumnRepository.deleteByIdCaseDefinitionKey(CASE_DEFINITION_NAME)

        val caseListColumn = caseDefinitionListColumnRepository.save(
            CaseListColumn(
                id = CaseListColumnId(CASE_DEFINITION_NAME, "perm-field"),
                title = "Permission based field",
                path = "perm:someField",
                displayType = DisplayType("string", EmptyDisplayTypeParameter()),
                sortable = true,
                defaultSort = ColumnDefaultSort.ASC,
                order = 0,
                exportable = false
            )
        )

        val document = createDocument(definition(), """{"street": "Sesame Street"}""")

        val result = caseInstanceService.search(
            CASE_DEFINITION_NAME,
            SearchWithConfigRequest(),
            Pageable.ofSize(10)
        )

        assertEquals(1, result.totalElements)
        val row = result.content.first { it.id == document.id().toString() }
        assertEquals("dummy-permission-value", row.items.first { it.key == caseListColumn.id.key }.value)
    }

    companion object {
        private const val CASE_DEFINITION_NAME = "house"
        private const val CURRENT_USER = "case-instance-search-user"
    }

    @TestConfiguration
    class ValueResolverTestConfiguration {
        @Bean
        fun permissionCheckingValueResolverFactory(
            authorizationService: AuthorizationService
        ): ValueResolverFactory {
            return PermissionCheckingValueResolverFactory(authorizationService)
        }
    }

    class PermissionCheckingValueResolverFactory(
        private val authorizationService: AuthorizationService
    ) : ValueResolverFactory {
        override fun supportedPrefix(): String = "perm"

        override fun createResolver(documentId: String): Function<String, Any?> {
            authorizationService.requirePermission(
                EntityAuthorizationRequest(
                    JsonSchemaDocument::class.java,
                    Action("some-action")
                )
            )
            return Function { "dummy-permission-value" }
        }
    }
}
