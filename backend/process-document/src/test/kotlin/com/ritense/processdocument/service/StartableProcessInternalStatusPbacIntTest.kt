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

package com.ritense.processdocument.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.permission.ConditionContainer
import com.ritense.authorization.permission.Permission
import com.ritense.authorization.permission.PermissionRepository
import com.ritense.authorization.permission.condition.ContainerPermissionCondition
import com.ritense.authorization.permission.condition.FieldPermissionCondition
import com.ritense.authorization.permission.condition.PermissionConditionOperator.EQUAL_TO
import com.ritense.authorization.role.Role
import com.ritense.authorization.role.RoleRepository
import com.ritense.case.service.StartableItemService
import com.ritense.document.domain.InternalCaseStatus
import com.ritense.document.domain.InternalCaseStatusColor
import com.ritense.document.domain.InternalCaseStatusId
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.repository.InternalCaseStatusRepository
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.BaseIntegrationTest
import com.ritense.valtimo.operaton.authorization.OperatonExecutionActionProvider
import com.ritense.valtimo.operaton.domain.OperatonExecution
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * Reproduces the issue where restricting ad hoc (supporting) processes in PBAC on the internal case status
 * fails for cases that do not have an internal status yet, and verifies the startable items follow the
 * internal status of the case.
 */
@Transactional
class StartableProcessInternalStatusPbacIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var startableItemService: StartableItemService

    @Autowired
    lateinit var documentService: DocumentService

    @Autowired
    lateinit var internalCaseStatusRepository: InternalCaseStatusRepository

    @Autowired
    lateinit var permissionRepository: PermissionRepository

    @Autowired
    lateinit var roleRepository: RoleRepository

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @BeforeEach
    fun setUp() {
        createInternalStatus(STATUS_IN_PROGRESS, 0)
        createInternalStatus(STATUS_CLOSED, 1)

        val role = roleRepository.findByKey(ROLE) ?: roleRepository.save(Role(key = ROLE))
        permissionRepository.deleteAll()
        permissionRepository.saveAllAndFlush(
            listOf(
                Permission(
                    UUID.randomUUID(),
                    OperatonExecution::class.java,
                    mutableListOf(OperatonExecutionActionProvider.CREATE),
                    ConditionContainer(
                        listOf(
                            ContainerPermissionCondition(
                                JsonSchemaDocument::class.java,
                                listOf(FieldPermissionCondition("internalStatus.id.key", EQUAL_TO, STATUS_IN_PROGRESS))
                            )
                        )
                    ),
                    role
                )
            )
        )
    }

    @Test
    @WithMockUser(username = USERNAME, authorities = [ROLE])
    fun `should not fail when case has no internal status yet`() {
        val documentId = createDocument()

        val startableItems = startableItemService.getStartableItems(caseDocumentId = documentId)

        assertThat(startableItems.map { it.key }).doesNotContain(PROCESS_KEY)
    }

    @Test
    @WithMockUser(username = USERNAME, authorities = [ROLE])
    fun `should make process startable once internal status matches the PBAC condition`() {
        val documentId = createDocument()
        setInternalStatus(documentId, STATUS_IN_PROGRESS)

        val startableItems = startableItemService.getStartableItems(caseDocumentId = documentId)

        assertThat(startableItems.map { it.key }).contains(PROCESS_KEY)
    }

    @Test
    @WithMockUser(username = USERNAME, authorities = [ROLE])
    fun `should no longer make process startable once internal status no longer matches the PBAC condition`() {
        val documentId = createDocument()
        setInternalStatus(documentId, STATUS_IN_PROGRESS)
        assertThat(startableItemService.getStartableItems(caseDocumentId = documentId).map { it.key })
            .contains(PROCESS_KEY)

        setInternalStatus(documentId, STATUS_CLOSED)

        assertThat(startableItemService.getStartableItems(caseDocumentId = documentId).map { it.key })
            .doesNotContain(PROCESS_KEY)
    }

    private fun createInternalStatus(key: String, order: Int) {
        internalCaseStatusRepository.save(
            InternalCaseStatus(
                InternalCaseStatusId(DOCUMENT_DEFINITION_NAME, key),
                key,
                true,
                order,
                -1,
                InternalCaseStatusColor.BLUE
            )
        )
    }

    private fun createDocument(): UUID = runWithoutAuthorization {
        documentService.createDocument(
            NewDocumentRequest(
                DOCUMENT_DEFINITION_NAME,
                DOCUMENT_DEFINITION_NAME,
                "1.0.0",
                objectMapper.readTree("""{"street": "aStreet"}""")
            )
        ).resultingDocument().orElseThrow()
    }.id().id

    private fun setInternalStatus(documentId: UUID, statusKey: String) = runWithoutAuthorization {
        documentService.setInternalStatus(JsonSchemaDocumentId.existingId(documentId), statusKey)
    }

    private companion object {
        const val ROLE = "ROLE_ADHOC_STATUS_TEST"
        const val PROCESS_KEY = "loan-process-demo"
        const val STATUS_IN_PROGRESS = "in-progress"
        const val STATUS_CLOSED = "closed"
    }
}
