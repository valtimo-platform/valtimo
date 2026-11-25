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

package com.ritense.case.service

import com.ritense.BaseIntegrationTest
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case.domain.ColumnDefaultSort
import com.ritense.case.service.CaseInstanceServiceIntTest.FailingValueResolverFactory
import com.ritense.case.service.CaseInstanceServiceIntTest.PoisoningTransactionalOperation
import com.ritense.case.service.CaseInstanceServiceIntTest.PoisoningValueResolverFactory
import com.ritense.case.web.rest.dto.GroupListColumnDto
import com.ritense.case.web.rest.dto.GroupListColumnPathMappingDto
import com.ritense.document.domain.search.SearchWithConfigRequest
import com.ritense.search.domain.DisplayType
import com.ritense.search.domain.EmptyDisplayTypeParameter
import com.ritense.valtimo.contract.authentication.ManageableUser
import com.ritense.valtimo.contract.authentication.model.ValtimoUserBuilder
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.data.domain.Pageable
import org.springframework.security.test.context.support.WithMockUser
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

@Import(GroupCaseInstanceServiceIntTest.GroupValueResolverTestConfiguration::class)
class GroupCaseInstanceServiceIntTest @Autowired constructor(
    private val groupCaseInstanceService: GroupCaseInstanceService,
    private val groupService: CaseDefinitionGroupService,
    private val poisoningValueResolverFactory: PoisoningValueResolverFactory,
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
    @WithMockUser(username = USERNAME, authorities = [FULL_ACCESS_ROLE])
    fun `should return null and flag failed for a group column whose resolver fails`() {
        val group = createGroupWithColumns(
            "Group 983 failing",
            columnDto("street", "doc:street"),
            columnDto("failing", "failing:someField")
        )

        try {
            val document = createDocument(definition(), """{"street": "Sesame Street"}""")

            val result = runWithoutAuthorization {
                groupCaseInstanceService.search(group.key, SearchWithConfigRequest(), Pageable.ofSize(10))
            }

            assertEquals(1, result.totalElements)
            val row = result.content.first { it.id == document.id().toString() }
            val streetCell = row.items.first { it.key == "street" }
            assertEquals("Sesame Street", streetCell.value)
            assertFalse(streetCell.failed)
            val failingCell = row.items.first { it.key == "failing" }
            assertNull(failingCell.value)
            assertTrue(failingCell.failed)
        } finally {
            documentRepository.deleteAll()
            deleteGroup(group.key)
        }
    }

    @Test
    @WithMockUser(username = USERNAME, authorities = [FULL_ACCESS_ROLE])
    fun `should flag a poisoning resolver column as failed while another group row still resolves`() {
        // Not transactional: the poisoning column marks the read-only transaction rollback-only,
        // so the group search must survive the real commit boundary rather than 500.
        val group = createGroupWithColumns(
            "Group 983 poisoning",
            columnDto("street", "doc:street"),
            columnDto("poison", "poison:someField")
        )

        try {
            val healthyDocument = createDocument(definition(), """{"street": "Sesame Street"}""")
            val poisoningDocument = createDocument(definition(), """{"street": "Evergreen Terrace"}""")
            poisoningValueResolverFactory.poisonDocumentId = poisoningDocument.id().id.toString()

            val result = runWithoutAuthorization {
                groupCaseInstanceService.search(group.key, SearchWithConfigRequest(), Pageable.ofSize(10))
            }

            assertEquals(2, result.totalElements)

            val poisoningRow = result.content.first { it.id == poisoningDocument.id().toString() }
            val poisonCell = poisoningRow.items.first { it.key == "poison" }
            assertNull(poisonCell.value)
            assertTrue(poisonCell.failed)

            val healthyRow = result.content.first { it.id == healthyDocument.id().toString() }
            val healthyStreetCell = healthyRow.items.first { it.key == "street" }
            assertEquals("Sesame Street", healthyStreetCell.value)
            assertFalse(healthyStreetCell.failed)
        } finally {
            poisoningValueResolverFactory.poisonDocumentId = null
            documentRepository.deleteAll()
            deleteGroup(group.key)
        }
    }

    private fun createGroupWithColumns(title: String, vararg columns: GroupListColumnDto) =
        runWithoutAuthorization {
            val group = groupService.createGroup(title, null)
            groupService.addMember(group.key, CASE_DEFINITION_KEY)
            groupService.updateListColumns(group.key, columns.toList())
            group
        }

    private fun deleteGroup(groupKey: String) {
        runWithoutAuthorization { groupService.deleteGroup(groupKey) }
    }

    private fun columnDto(key: String, path: String) = GroupListColumnDto(
        key = key,
        title = key,
        displayType = DisplayType("string", EmptyDisplayTypeParameter()),
        sortable = false,
        defaultSort = null as ColumnDefaultSort?,
        order = null,
        pathMappings = listOf(GroupListColumnPathMappingDto(CASE_DEFINITION_KEY, path))
    )

    companion object {
        private const val CASE_DEFINITION_KEY = "house"
        private const val CURRENT_USER = "group-case-instance-search-user"
    }

    @TestConfiguration
    class GroupValueResolverTestConfiguration {
        @Bean
        fun failingValueResolverFactory(): FailingValueResolverFactory {
            return FailingValueResolverFactory()
        }

        @Bean
        fun poisoningTransactionalOperation(): PoisoningTransactionalOperation {
            return PoisoningTransactionalOperation()
        }

        @Bean
        fun poisoningValueResolverFactory(
            poisoningTransactionalOperation: PoisoningTransactionalOperation
        ): PoisoningValueResolverFactory {
            return PoisoningValueResolverFactory(poisoningTransactionalOperation)
        }
    }
}
