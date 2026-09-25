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

package com.ritense.zakenapi.service

import com.ritense.authorization.permission.ConditionContainer
import com.ritense.authorization.permission.Permission
import com.ritense.authorization.permission.PermissionRepository
import com.ritense.authorization.role.Role
import com.ritense.authorization.role.RoleRepository
import com.ritense.documentenapi.authorization.ZgwDocument
import com.ritense.documentenapi.authorization.ZgwDocumentActionProvider
import com.ritense.zakenapi.BaseIntegrationTest
import com.ritense.zakenapi.ZaakUrlProvider
import com.ritense.zakenapi.link.ZaakInstanceLinkNotFoundException
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import kotlin.test.assertTrue

@Transactional
class ZaakDocumentServiceIT @Autowired constructor(
    private val roleRepository: RoleRepository,
    private val permissionRepository: PermissionRepository,
) : BaseIntegrationTest() {


    lateinit var roleTest: Role

    @BeforeEach
    fun setUp() {
        roleTest = roleRepository.findByKey("ROLE_TEST")!!
        permissionRepository.deleteByRoleKeyIn(listOf("ROLE_TEST"))
    }

    @Test
    @WithMockUser(authorities = ["ROLE_TEST"])
    fun `should return empty list when user lacks VIEW_LIST permission`() {
        val caseDocumentId = UUID.randomUUID()

        val result = zaakDocumentService.getInformatieObjectenAsRelatedFiles(caseDocumentId)

        assertTrue(result.isEmpty())
        verify(zaakUrlProvider, never()).getZaakUrl(any())
    }

    @Test
    @WithMockUser(authorities = ["ROLE_TEST"])
    fun `should proceed past permission check when user has VIEW_LIST permission`() {
        val caseDocumentId = UUID.randomUUID()
        val permissions = listOf(
            Permission(
                id = caseDocumentId,
                resourceType = ZgwDocument::class.java,
                actions = mutableListOf(ZgwDocumentActionProvider.VIEW_LIST),
                conditionContainer = ConditionContainer(),
                role = roleTest,
                contextResourceType = null,
                contextConditionContainer = null
            )
        )
        permissionRepository.saveAllAndFlush(permissions)

        // Should throw ZaakInstanceLinkNotFoundException because no zaak link exists,
        // but this proves the permission check passed (otherwise would return empty list)
        assertThrows<ZaakInstanceLinkNotFoundException> {
            zaakDocumentService.getInformatieObjectenAsRelatedFiles(caseDocumentId)
        }
    }
}
