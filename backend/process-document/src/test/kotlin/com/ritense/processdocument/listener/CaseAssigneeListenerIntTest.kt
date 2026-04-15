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
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.processdocument.listener

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case.web.rest.dto.CaseSettingsDto
import com.ritense.document.domain.Document
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.BaseIntegrationTest
import com.ritense.processdocument.service.CaseTaskListSearchService
import com.ritense.processdocument.service.ProcessDocumentAssociationService
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.ADMIN
import com.ritense.valtimo.contract.authentication.ManageableUser
import com.ritense.valtimo.contract.authentication.model.ValtimoUserBuilder
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.operaton.repository.OperatonTaskSpecificationHelper.Companion.byName
import com.ritense.valtimo.service.OperatonTaskService
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RuntimeService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.domain.PageRequest
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.transaction.annotation.Transactional
import kotlin.test.assertEquals

@Transactional
class CaseAssigneeListenerIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var caseDefinitionService: CaseDefinitionService

    @Autowired
    lateinit var documentService: DocumentService

    @Autowired
    lateinit var processDocumentAssociationService: ProcessDocumentAssociationService

    @Autowired
    lateinit var runtimeService: RuntimeService

    @Autowired
    lateinit var taskService: OperatonTaskService

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @Autowired
    lateinit var buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository

    @Autowired
    lateinit var buildingBlockInstanceRepository: BuildingBlockInstanceRepository

    @Autowired
    lateinit var caseTaskListSearchService: CaseTaskListSearchService

    lateinit var testDocument: Document

    lateinit var testUser: ManageableUser

    lateinit var testUser2: ManageableUser

    lateinit var caseDefinitionId: CaseDefinitionId

    @BeforeEach
    fun init() {
        caseDefinitionId = CaseDefinitionId("house", "1.0.0")

        testUser = ValtimoUserBuilder()
            .id("AAAA-1111")
            .username("test1")
            .firstName("Test")
            .lastName("User")
            .email("test@valtimo.nl")
            .roles(listOf("ROLE_USER"))
            .build()

        testUser2 = ValtimoUserBuilder()
            .id("BBBB-2222")
            .username("test2")
            .firstName("Test")
            .lastName("User 2")
            .email("test2@valtimo.nl")
            .roles(listOf("ROLE_USER"))
            .build()

        val documentJson =
            """
            {
                "street": "aStreet",
                "houseNumber": 1
            }
            """.trimIndent()

        testDocument = runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest(
                    "house",
                    "house",
                    "1.0.0",
                    objectMapper.readTree(documentJson)
                )
            ).resultingDocument().orElseThrow()
        }

        runWithoutAuthorization {
            caseDefinitionService.updateCaseSettings(
                caseDefinitionId,
                CaseSettingsDto(
                    canHaveAssignee = true,
                    autoAssignTasks = true
                )
            )
        }
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [ADMIN])
    fun `should set assignee when task is created and autoAssignTasks is on`() {

        whenever(userManagementService.findById(any())).thenReturn(testUser)
        whenever(userManagementService.findByUsername(any())).thenReturn(testUser)
        whenever(userManagementService.currentUser).thenReturn(testUser)

        val processInstance = runtimeService.startProcessInstanceByKey(
            "parent-process",
            testDocument.id().toString()
        )
        runWithoutAuthorization {
            processDocumentAssociationService.createProcessDocumentInstance(
                processInstance.id,
                testDocument.id().id,
                "parent process"
            )
        }
        runWithoutAuthorization { documentService.assignUserToDocument(testDocument.id().id, testUser.username) }

        val task = runWithoutAuthorization {
            taskService.findTask(byName("child process user task"))
        }
        assertEquals(testUser.username, task.assignee)
    }

    @Test
    fun `should do nothing when and task is created and autoAssignTasks is off`() {
        runWithoutAuthorization {
            caseDefinitionService.updateCaseSettings(
                caseDefinitionId,
                CaseSettingsDto(
                    canHaveAssignee = true,
                    autoAssignTasks = false
                )
            )
        }

        whenever(userManagementService.findById(any())).thenReturn(testUser)
        whenever(userManagementService.findByUsername(any())).thenReturn(testUser)
        whenever(userManagementService.currentUser).thenReturn(testUser)

        val task = runWithoutAuthorization {
            documentService.assignUserToDocument(testDocument.id().id, testUser.username)
            val processInstance = runtimeService.startProcessInstanceByKey(
                "parent-process",
                testDocument.id().toString()
            )
            processDocumentAssociationService.createProcessDocumentInstance(
                processInstance.id,
                testDocument.id().id,
                "parent process"
            )

            taskService.findTask(byName("child process user task"))
        }

        assertNull(task.assignee)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [ADMIN])
    fun `should should update task assignee when document assignee is changed`() {

        whenever(userManagementService.findById(testUser.id)).thenReturn(testUser)
        whenever(userManagementService.findById(testUser2.id)).thenReturn(testUser2)
        whenever(userManagementService.findByUsername(testUser.username)).thenReturn(testUser)
        whenever(userManagementService.findByUsername(testUser2.username)).thenReturn(testUser2)
        whenever(userManagementService.currentUser).thenReturn(testUser)

        val updatedTask = runWithoutAuthorization {
            documentService.assignUserToDocument(testDocument.id().id, testUser.id)
            val processInstance = runtimeService.startProcessInstanceByKey(
                "parent-process",
                testDocument.id().toString()
            )

            processDocumentAssociationService.createProcessDocumentInstance(
                processInstance.id,
                testDocument.id().id,
                "parent process"
            )

            documentService.assignUserToDocument(testDocument.id().id, testUser2.id)

            taskService.findTask(byName("child process user task"))
        }
        assertEquals(testUser2.username, updatedTask.assignee)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [ADMIN])
    fun `should should remove task assignee when document assignee is removed`() {

        whenever(userManagementService.findById(any())).thenReturn(testUser)
        whenever(userManagementService.findByUsername(any())).thenReturn(testUser)
        whenever(userManagementService.currentUser).thenReturn(testUser)

        val task = runWithoutAuthorization {
            documentService.assignUserToDocument(testDocument.id().id, testUser.username)
            val processInstance = runtimeService.startProcessInstanceByKey(
                "parent-process",
                testDocument.id().toString()
            )

            processDocumentAssociationService.createProcessDocumentInstance(
                processInstance.id,
                testDocument.id().id,
                "parent process"
            )

            documentService.unassignUserFromDocument(testDocument.id().id)

            taskService.findTask(byName("child process user task"))
        }
        assertNull(task.assignee)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [ADMIN])
    fun `should update assignee on building block task when case assignee changes`() {
        whenever(userManagementService.findById(any())).thenReturn(testUser)
        whenever(userManagementService.findByUsername(any())).thenReturn(testUser)
        whenever(userManagementService.currentUser).thenReturn(testUser)

        val bbDocument = runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest(
                    "house",
                    "house",
                    "1.0.0",
                    objectMapper.readTree("""{"street": "bbStreet", "houseNumber": 2}""")
                )
            ).resultingDocument().orElseThrow()
        }

        val processInstance = runtimeService.startProcessInstanceByKey(
            "bb-parent-process",
            testDocument.id().toString(),
            mapOf("bbDocumentId" to bbDocument.id().id.toString())
        )
        runWithoutAuthorization {
            processDocumentAssociationService.createProcessDocumentInstance(
                processInstance.id,
                testDocument.id().id,
                "bb parent process"
            )
        }

        val bbDefinition = buildingBlockDefinitionRepository.save(
            BuildingBlockDefinition(
                id = BuildingBlockDefinitionId("test-bb", "1.0.0"),
                name = "Test Building Block"
            )
        )
        buildingBlockInstanceRepository.save(
            BuildingBlockInstance(
                documentId = bbDocument.id().id,
                caseDocumentId = testDocument.id().id,
                activityId = "bb-call-activity",
                definition = bbDefinition
            )
        )

        runWithoutAuthorization { documentService.assignUserToDocument(testDocument.id().id, testUser.username) }

        val task = runWithoutAuthorization {
            taskService.findTask(byName("building block user task"))
        }
        assertEquals(testUser.username, task.assignee)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [ADMIN])
    fun `should remove assignee from building block task when case assignee is removed`() {
        whenever(userManagementService.findById(any())).thenReturn(testUser)
        whenever(userManagementService.findByUsername(any())).thenReturn(testUser)
        whenever(userManagementService.currentUser).thenReturn(testUser)

        val bbDocument = runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest(
                    "house",
                    "house",
                    "1.0.0",
                    objectMapper.readTree("""{"street": "bbStreet", "houseNumber": 2}""")
                )
            ).resultingDocument().orElseThrow()
        }

        val processInstance = runtimeService.startProcessInstanceByKey(
            "bb-parent-process",
            testDocument.id().toString(),
            mapOf("bbDocumentId" to bbDocument.id().id.toString())
        )
        runWithoutAuthorization {
            processDocumentAssociationService.createProcessDocumentInstance(
                processInstance.id,
                testDocument.id().id,
                "bb parent process"
            )
        }

        val bbDefinition = buildingBlockDefinitionRepository.save(
            BuildingBlockDefinition(
                id = BuildingBlockDefinitionId("test-bb-2", "1.0.0"),
                name = "Test Building Block 2"
            )
        )
        buildingBlockInstanceRepository.save(
            BuildingBlockInstance(
                documentId = bbDocument.id().id,
                caseDocumentId = testDocument.id().id,
                activityId = "bb-call-activity",
                definition = bbDefinition
            )
        )

        runWithoutAuthorization { documentService.assignUserToDocument(testDocument.id().id, testUser.username) }
        runWithoutAuthorization { documentService.unassignUserFromDocument(testDocument.id().id) }

        val task = runWithoutAuthorization {
            taskService.findTask(byName("building block user task"))
        }
        assertNull(task.assignee)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [com.ritense.valtimo.contract.authentication.AuthoritiesConstants.ADMIN])
    fun `should include building block task in case-filtered task list with correct documentInstanceId`() {
        whenever(userManagementService.findById(any())).thenReturn(testUser)
        whenever(userManagementService.findByUsername(any())).thenReturn(testUser)
        whenever(userManagementService.currentUser).thenReturn(testUser)

        val bbDocument = runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest(
                    "house",
                    "house",
                    "1.0.0",
                    com.fasterxml.jackson.databind.ObjectMapper().readTree("""{"street": "bbStreet", "houseNumber": 3}""")
                )
            ).resultingDocument().orElseThrow()
        }

        val processInstance = runtimeService.startProcessInstanceByKey(
            "bb-parent-process",
            testDocument.id().toString(),
            mapOf("bbDocumentId" to bbDocument.id().id.toString())
        )
        runWithoutAuthorization {
            processDocumentAssociationService.createProcessDocumentInstance(
                processInstance.id,
                testDocument.id().id,
                "bb parent process"
            )
        }

        val bbDefinition = buildingBlockDefinitionRepository.save(
            BuildingBlockDefinition(
                id = BuildingBlockDefinitionId("test-bb-filtered", "1.0.0"),
                name = "Test Building Block Filtered"
            )
        )
        buildingBlockInstanceRepository.save(
            BuildingBlockInstance(
                documentId = bbDocument.id().id,
                caseDocumentId = testDocument.id().id,
                activityId = "bb-call-activity",
                definition = bbDefinition
            )
        )

        val result = runWithoutAuthorization {
            caseTaskListSearchService.search(
                "house",
                com.ritense.processdocument.tasksearch.AdvancedSearchRequest()
                    .assigneeFilter(OperatonTaskService.TaskFilter.ALL),
                PageRequest.of(0, 100)
            )
        }

        val bbTask = result.content.find { it.name == "building block user task" }
        assert(bbTask != null) { "Building block task should appear in case-filtered task list" }
        assertEquals(testDocument.id().id, bbTask!!.documentInstanceId)
    }
}