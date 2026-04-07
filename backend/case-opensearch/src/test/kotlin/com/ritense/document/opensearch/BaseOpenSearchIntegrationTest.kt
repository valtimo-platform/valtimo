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

package com.ritense.document.opensearch

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.audit.service.AuditEventProcessor
import com.ritense.authorization.permission.ConditionContainer
import com.ritense.authorization.permission.Permission
import com.ritense.authorization.permission.PermissionRepository
import com.ritense.authorization.role.Role
import com.ritense.authorization.role.RoleRepository
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.domain.impl.snapshot.JsonSchemaDocumentSnapshot
import com.ritense.document.domain.impl.searchfield.SearchField
import com.ritense.document.opensearch.repository.JsonSchemaDocumentOpenSearchRepository
import com.ritense.document.service.impl.JsonSchemaDocumentService
import com.ritense.document.service.JsonSchemaDocumentActionProvider
import com.ritense.document.service.JsonSchemaDocumentDefinitionActionProvider
import com.ritense.document.service.JsonSchemaDocumentSnapshotActionProvider
import com.ritense.document.service.SearchFieldActionProvider
import com.ritense.outbox.OutboxService
import com.ritense.testutilscommon.junit.extension.LiquibaseRunnerExtension
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.mail.MailSender
import com.ritense.valtimo.service.ProcessDefinitionCaseDefinitionLinker
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Answers
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.event.SimpleApplicationEventMulticaster
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean
import org.springframework.test.context.junit.jupiter.SpringExtension
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@SpringBootTest
@ExtendWith(SpringExtension::class, LiquibaseRunnerExtension::class)
@Tag("integration")
@Transactional
abstract class BaseOpenSearchIntegrationTest {

    @MockitoBean(answers = Answers.RETURNS_DEEP_STUBS)
    lateinit var userManagementService: UserManagementService

    @MockitoBean
    lateinit var applicationEventMulticaster: SimpleApplicationEventMulticaster

    @MockitoBean
    lateinit var processDefinitionCaseDefinitionLinker: ProcessDefinitionCaseDefinitionLinker

    @MockitoBean
    lateinit var auditEventProcessor: AuditEventProcessor

    @MockitoBean
    lateinit var mailSender: MailSender

    @MockitoSpyBean
    lateinit var outboxService: OutboxService

    @Autowired
    lateinit var documentService: JsonSchemaDocumentService

    @Autowired
    lateinit var openSearchRepository: JsonSchemaDocumentOpenSearchRepository

    @Autowired
    lateinit var roleRepository: RoleRepository

    @Autowired
    lateinit var permissionRepository: PermissionRepository

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @BeforeEach
    fun setUpBase() {
        setUpPermissions()
        openSearchRepository.deleteAll()
    }

    @AfterEach
    fun tearDownBase() {
        openSearchRepository.deleteAll()
    }

    private fun setUpPermissions() {
        var role = roleRepository.findByKey(FULL_ACCESS_ROLE)
        if (role == null) {
            role = roleRepository.save(Role(UUID.randomUUID(), FULL_ACCESS_ROLE))
        }

        val permissions = listOf(
            Permission(UUID.randomUUID(), com.ritense.document.domain.impl.JsonSchemaDocument::class.java,
                mutableListOf(JsonSchemaDocumentActionProvider.VIEW_LIST), ConditionContainer(emptyList()), role!!),
            Permission(UUID.randomUUID(), com.ritense.document.domain.impl.JsonSchemaDocument::class.java,
                mutableListOf(JsonSchemaDocumentActionProvider.VIEW), ConditionContainer(emptyList()), role!!),
            Permission(UUID.randomUUID(), com.ritense.document.domain.impl.JsonSchemaDocument::class.java,
                mutableListOf(JsonSchemaDocumentActionProvider.MODIFY), ConditionContainer(emptyList()), role!!),
            Permission(UUID.randomUUID(), com.ritense.document.domain.impl.JsonSchemaDocument::class.java,
                mutableListOf(JsonSchemaDocumentActionProvider.CREATE), ConditionContainer(emptyList()), role!!),
            Permission(UUID.randomUUID(), com.ritense.document.domain.impl.JsonSchemaDocument::class.java,
                mutableListOf(JsonSchemaDocumentActionProvider.CLAIM), ConditionContainer(emptyList()), role!!),
            Permission(UUID.randomUUID(), com.ritense.document.domain.impl.JsonSchemaDocument::class.java,
                mutableListOf(JsonSchemaDocumentActionProvider.ASSIGN), ConditionContainer(emptyList()), role!!),
            Permission(UUID.randomUUID(), com.ritense.document.domain.impl.JsonSchemaDocument::class.java,
                mutableListOf(JsonSchemaDocumentActionProvider.ASSIGNABLE), ConditionContainer(emptyList()), role!!),
            Permission(UUID.randomUUID(), com.ritense.document.domain.impl.JsonSchemaDocument::class.java,
                mutableListOf(JsonSchemaDocumentActionProvider.DELETE), ConditionContainer(emptyList()), role!!),
            Permission(UUID.randomUUID(), SearchField::class.java,
                mutableListOf(SearchFieldActionProvider.VIEW_LIST), ConditionContainer(emptyList()), role!!),
            Permission(UUID.randomUUID(), JsonSchemaDocumentDefinition::class.java,
                mutableListOf(JsonSchemaDocumentDefinitionActionProvider.VIEW), ConditionContainer(emptyList()), role!!),
            Permission(UUID.randomUUID(), JsonSchemaDocumentDefinition::class.java,
                mutableListOf(JsonSchemaDocumentDefinitionActionProvider.VIEW_LIST), ConditionContainer(emptyList()), role!!),
            Permission(UUID.randomUUID(), JsonSchemaDocumentDefinition::class.java,
                mutableListOf(JsonSchemaDocumentDefinitionActionProvider.CREATE), ConditionContainer(emptyList()), role!!),
            Permission(UUID.randomUUID(), JsonSchemaDocumentDefinition::class.java,
                mutableListOf(JsonSchemaDocumentDefinitionActionProvider.MODIFY), ConditionContainer(emptyList()), role!!),
            Permission(UUID.randomUUID(), JsonSchemaDocumentDefinition::class.java,
                mutableListOf(JsonSchemaDocumentDefinitionActionProvider.DELETE), ConditionContainer(emptyList()), role!!),
            Permission(UUID.randomUUID(), JsonSchemaDocumentSnapshot::class.java,
                mutableListOf(JsonSchemaDocumentSnapshotActionProvider.VIEW_LIST), ConditionContainer(emptyList()), role!!),
        )
        permissionRepository.saveAll(permissions)
    }

    companion object {
        const val FULL_ACCESS_ROLE: String = "full access role"
        const val USERNAME: String = "test@test.com"
    }
}
