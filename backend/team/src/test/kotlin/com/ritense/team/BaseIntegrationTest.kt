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

package com.ritense.team

import com.ritense.testutilscommon.junit.extension.LiquibaseRunnerExtension
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.authentication.model.ValtimoUser
import com.ritense.valtimo.contract.mail.MailSender
import com.ritense.valtimo.service.ProcessDefinitionCaseDefinitionLinker
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.kotlin.whenever
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.context.junit.jupiter.SpringExtension

@SpringBootTest(classes = [TestApplication::class])
@ExtendWith(SpringExtension::class, LiquibaseRunnerExtension::class)
@Tag("integration")
abstract class BaseIntegrationTest {

    @MockitoBean
    lateinit var userManagementService: UserManagementService

    @MockitoBean
    lateinit var processDefinitionCaseDefinitionLinker: ProcessDefinitionCaseDefinitionLinker

    @MockitoBean
    lateinit var mailSender: MailSender

    @BeforeEach
    fun beforeEach() {
        val adminUser = ValtimoUser().apply {
            id = ADMIN_USER_ID
            username = ADMIN_USER_NAME
            firstName = "Asha"
            lastName = "Miller"
            email = "admin@example.com"
            roles = listOf(ADMIN)
        }
        val normalUser = ValtimoUser().apply {
            id = NORMAL_USER_ID
            username = NORMAL_USER_NAME
            firstName = "James"
            lastName = "Vance"
            email = "user@example.com"
            roles = listOf(USER)
        }
        whenever(userManagementService.currentUser).thenReturn(adminUser)
        whenever(userManagementService.findByUsername(ADMIN_USER_NAME)).thenReturn(adminUser)
        whenever(userManagementService.findByUsername(NORMAL_USER_NAME)).thenReturn(normalUser)
    }

    companion object {
        const val ADMIN = "ROLE_ADMIN"
        const val USER = "ROLE_USER"
        const val ADMIN_USER_NAME = "admin"
        const val ADMIN_USER_ID = "admin-id"
        const val NORMAL_USER_NAME = "user"
        const val NORMAL_USER_ID = "user-id"
    }
}
