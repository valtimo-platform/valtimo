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

package com.ritense.processdocument.service

import com.ritense.document.domain.impl.JsonDocumentContent
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import com.ritense.document.service.impl.JsonSchemaDocumentService
import com.ritense.processdocument.BaseTest
import com.ritense.valtimo.contract.OauthConfigHolder
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.authentication.model.ValtimoUserBuilder
import com.ritense.valtimo.contract.config.ValtimoProperties.Oauth
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import com.ritense.valtimo.contract.json.MapperSingleton
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.mockito.kotlin.any as anyKt
import org.operaton.bpm.engine.delegate.DelegateExecution
import java.time.LocalDateTime
import java.util.Optional
import java.util.UUID


internal class DocumentDelegateServiceTest : BaseTest() {

    private lateinit var documentService: DocumentService
    private lateinit var jsonSchemaDocumentService: JsonSchemaDocumentService
    private lateinit var userManagementService: UserManagementService
    private lateinit var caseDocumentResolver: CaseDocumentResolver
    private lateinit var documentDelegateService: DocumentDelegateService

    lateinit var definition: JsonSchemaDocumentDefinition
    private lateinit var delegateExecution: DelegateExecution

    private val documentId = "11111111-1111-1111-1111-111111111111"
    private val processInstanceId = "00000000-0000-0000-0000-000000000000"

    private val documentMock = mock<JsonSchemaDocument>()
    private val jsonSchemaDocumentId = JsonSchemaDocumentId.existingId(UUID.fromString(documentId))

    companion object {
        private const val STREET_NAME = "street"
        private const val HOUSE_NUMBER = "3"
        private const val NO = false
    }

    @BeforeEach
    fun setup() {
        definition = definition()
        documentSequenceGeneratorService = mock()
        whenever(documentSequenceGeneratorService.next(any())).thenReturn(1L)
        userManagementService = mock()
        documentService = mock()
        jsonSchemaDocumentService = mock()
        jsonSchemaDocumentService = mock()
        caseDocumentResolver = mock()
        whenever(caseDocumentResolver.resolveCaseDocumentId(anyKt())).thenAnswer { it.arguments[0] }
        documentDelegateService = DocumentDelegateService(
            documentService,
            jsonSchemaDocumentService,
            userManagementService,
            MapperSingleton.get(),
            caseDocumentResolver
        )
        delegateExecution = mock<DelegateExecution>()
        whenever(delegateExecution.id).thenReturn("id")
        whenever(delegateExecution.businessKey).thenReturn("56f29315-c581-4c26-9b70-8bc818e8c86e")

        OauthConfigHolder(Oauth())
    }

    @Test
    fun `get modifiedOn from document`() {
        val delegateExecution = mock<DelegateExecution>()
        whenever(delegateExecution.id).thenReturn("id")
        whenever(delegateExecution.processInstanceId).thenReturn(processInstanceId)
        val modifiedOn = LocalDateTime.now()

        whenever(documentMock.modifiedOn()).thenReturn(Optional.of(modifiedOn))
        prepareDocument(delegateExecution, jsonSchemaDocumentService)

        val modifiedOnResult = documentDelegateService.getDocumentModifiedOn(delegateExecution)

        assertEquals(modifiedOnResult, modifiedOn)
        verifyTest(delegateExecution, jsonSchemaDocumentService)
    }

    @Test
    fun `get assigneeId from document`() {
        val delegateExecution = mock<DelegateExecution>()
        whenever(delegateExecution.id).thenReturn("id")
        whenever(delegateExecution.processInstanceId).thenReturn(processInstanceId)
        val assigneeId = "1234"

        whenever(documentMock.assigneeId()).thenReturn(assigneeId)
        prepareDocument(delegateExecution, jsonSchemaDocumentService)

        val assigneeIdResult = documentDelegateService.getDocumentAssigneeId(delegateExecution)

        assertEquals(assigneeIdResult, assigneeId)
        verifyTest(delegateExecution, jsonSchemaDocumentService)
    }

    @Test
    fun `get createdBy from document`() {
        val delegateExecution = mock<DelegateExecution>()
        whenever(delegateExecution.id).thenReturn("id")
        whenever(delegateExecution.processInstanceId).thenReturn(processInstanceId)
        val createdBy = "Pietersen"

        whenever(documentMock.createdBy()).thenReturn(createdBy)
        prepareDocument(delegateExecution, jsonSchemaDocumentService)

        val createdByResult = documentDelegateService.getDocumentCreatedBy(delegateExecution)

        assertEquals(createdByResult, createdBy)
        verifyTest(delegateExecution, jsonSchemaDocumentService)
    }

    @Test
    fun `get fullname assignee from document`() {
        val delegateExecution = mock<DelegateExecution>()
        whenever(delegateExecution.id).thenReturn("id")
        whenever(delegateExecution.processInstanceId).thenReturn(processInstanceId)
        val assigneeFullname = "Jan Jansen"

        whenever(documentMock.assigneeFullName()).thenReturn(assigneeFullname)
        prepareDocument(delegateExecution, jsonSchemaDocumentService)

        val assigneFullNameResult = documentDelegateService.getDocumentAssigneeFullName(delegateExecution)

        assertEquals(assigneFullNameResult, assigneeFullname)
        verifyTest(delegateExecution, jsonSchemaDocumentService)
    }

    @Test
    fun `get version from document`() {
        val delegateExecution = mock<DelegateExecution>()
        whenever(delegateExecution.id).thenReturn("id")
        whenever(delegateExecution.processInstanceId).thenReturn(processInstanceId)
        val version = documentMock.version()

        whenever(documentMock.version()).thenReturn(version)
        prepareDocument(delegateExecution, jsonSchemaDocumentService)

        val versionResult = documentDelegateService.getDocumentVersion(delegateExecution)

        assertEquals(versionResult, version)
        verifyTest(delegateExecution, jsonSchemaDocumentService)
    }

    @Test
    fun `get createdOn from document`() {
        val delegateExecution = mock<DelegateExecution>()
        whenever(delegateExecution.id).thenReturn("id")
        whenever(delegateExecution.processInstanceId).thenReturn(processInstanceId)
        val createdOn = LocalDateTime.now()

        whenever(documentMock.createdOn()).thenReturn(createdOn)
        prepareDocument(delegateExecution, jsonSchemaDocumentService)

        val createdOnResult = documentDelegateService.getDocumentCreatedOn(delegateExecution)

        assertEquals(createdOnResult, createdOn)
        verifyTest(delegateExecution, jsonSchemaDocumentService)
    }

    @Test
    fun `get document by execution`() {
        val delegateExecution = mock<DelegateExecution>()
        whenever(delegateExecution.id).thenReturn("id")
        whenever(delegateExecution.processInstanceId).thenReturn(processInstanceId)

        prepareDocument(delegateExecution, jsonSchemaDocumentService)

        val resultDocument = documentDelegateService.getDocument(delegateExecution)

        assertEquals(documentMock, resultDocument)
        verifyTest(delegateExecution, jsonSchemaDocumentService)
    }

    private fun prepareDocument(delegateExecution: DelegateExecution,
                                jsonSchemaDocumentService: JsonSchemaDocumentService) {
        whenever(delegateExecution.businessKey).thenReturn(documentId)

        whenever(jsonSchemaDocumentService.getDocumentBy(jsonSchemaDocumentId))
            .thenReturn(documentMock)
    }

    private fun verifyTest(delegateExecution: DelegateExecution,
                           jsonSchemaDocumentService: JsonSchemaDocumentService) {
        verify(jsonSchemaDocumentService).getDocumentBy(jsonSchemaDocumentId)
    }

    @Test
    fun `find value by json pointer`() {
        val jsonSchemaDocument = createDocument()

        whenever(documentService.findBy(any<JsonSchemaDocumentId>())).thenReturn(Optional.of(jsonSchemaDocument))
        val value: Any = documentDelegateService.findValueByJsonPointer(
            "/applicant/number", delegateExecution
        )

        assertEquals(HOUSE_NUMBER, value)
    }

    @Test
    fun `incorrect path should return default value`() {
        val jsonSchemaDocument = createDocument()
        val defaultValue = "DEFAULT_VALUE"
        whenever(documentService.findBy(any<JsonSchemaDocumentId>())).thenReturn(Optional.of(jsonSchemaDocument))
        val value: Any? = documentDelegateService.findValueByJsonPointerOrDefault(
            "/incorrectpath", delegateExecution, defaultValue
        )

        assertEquals(defaultValue, value)
    }

    @Test
    fun `should accept null for default value`() {
        val jsonSchemaDocument = createDocument()
        val defaultValue = null
        whenever(documentService.findBy(any<JsonSchemaDocumentId>())).thenReturn(Optional.of(jsonSchemaDocument))
        val value: Any? = documentDelegateService.findValueByJsonPointerOrDefault(
            "/incorrectpath", delegateExecution, defaultValue
        )

        assertEquals(defaultValue, value)
    }

    @Test
    fun `should assign user to document`() {
        val documentId = "11111111-1111-1111-1111-111111111111"
        val processInstanceId = "00000000-0000-0000-0000-000000000000"
        val delegateExecution = mock<DelegateExecution>()
        whenever(delegateExecution.id).thenReturn("id")
        whenever(delegateExecution.processInstanceId).thenReturn(processInstanceId)
        whenever(delegateExecution.businessKey).thenReturn(documentId)
        whenever(userManagementService.findByEmail("john@example.com"))
            .thenReturn(Optional.of(ValtimoUserBuilder().id("anId").build()))

        documentDelegateService.setAssignee(delegateExecution, "john@example.com")

        verify(caseDocumentResolver).resolveCaseDocumentId(UUID.fromString(documentId))
        verify(documentService, times(1)).assignUserToDocument(UUID.fromString(documentId), "anId")
    }

    @Test
    fun `should set status to document`() {
        val documentUuid = UUID.fromString("11111111-1111-1111-1111-111111111111")
        val documentId = JsonSchemaDocumentId.existingId(documentUuid)
        val processInstanceId = "00000000-0000-0000-0000-000000000000"
        val delegateExecution = mock<DelegateExecution>()
        whenever(delegateExecution.id).thenReturn("id")
        whenever(delegateExecution.processInstanceId).thenReturn(processInstanceId)
        whenever(delegateExecution.businessKey).thenReturn(documentId.toString())
        val newStatus = "test"
        documentDelegateService.setInternalStatus(delegateExecution, newStatus)

        verify(caseDocumentResolver).resolveCaseDocumentId(documentUuid)
        verify(documentService).setInternalStatus(documentId, newStatus)
    }

    @Test
    fun `should set status to parent case document when called from building block`() {
        val buildingBlockDocumentUuid = UUID.fromString("11111111-1111-1111-1111-111111111111")
        val caseDocumentUuid = UUID.fromString("22222222-2222-2222-2222-222222222222")
        val buildingBlockDocumentId = JsonSchemaDocumentId.existingId(buildingBlockDocumentUuid)
        val caseDocumentId = JsonSchemaDocumentId.existingId(caseDocumentUuid)
        val processInstanceId = "00000000-0000-0000-0000-000000000000"
        val delegateExecution = mock<DelegateExecution>()
        whenever(delegateExecution.id).thenReturn("id")
        whenever(delegateExecution.processInstanceId).thenReturn(processInstanceId)
        whenever(delegateExecution.businessKey).thenReturn(buildingBlockDocumentUuid.toString())
        whenever(caseDocumentResolver.resolveCaseDocumentId(buildingBlockDocumentUuid)).thenReturn(caseDocumentUuid)

        val newStatus = "test"
        documentDelegateService.setInternalStatus(delegateExecution, newStatus)

        verify(caseDocumentResolver).resolveCaseDocumentId(buildingBlockDocumentUuid)
        verify(documentService).setInternalStatus(caseDocumentId, newStatus)
    }

    @Test
    fun `should add case tag to document`() {
        val documentUuid = UUID.fromString("11111111-1111-1111-1111-111111111111")
        val documentId = JsonSchemaDocumentId.existingId(documentUuid)
        val processInstanceId = "00000000-0000-0000-0000-000000000000"
        val delegateExecution = mock<DelegateExecution>()
        whenever(delegateExecution.id).thenReturn("id")
        whenever(delegateExecution.processInstanceId).thenReturn(processInstanceId)
        whenever(delegateExecution.businessKey).thenReturn(documentId.toString())
        documentDelegateService.addCaseTag(delegateExecution, "important")

        verify(caseDocumentResolver).resolveCaseDocumentId(documentUuid)
        verify(documentService).addCaseTag(documentId, "important")
    }

    @Test
    fun `should remove case tag from document`() {
        val documentUuid = UUID.fromString("11111111-1111-1111-1111-111111111111")
        val documentId = JsonSchemaDocumentId.existingId(documentUuid)
        val processInstanceId = "00000000-0000-0000-0000-000000000000"
        val delegateExecution = mock<DelegateExecution>()
        whenever(delegateExecution.id).thenReturn("id")
        whenever(delegateExecution.processInstanceId).thenReturn(processInstanceId)
        whenever(delegateExecution.businessKey).thenReturn(documentId.toString())
        documentDelegateService.removeCaseTag(delegateExecution, "important")

        verify(caseDocumentResolver).resolveCaseDocumentId(documentUuid)
        verify(documentService).removeCaseTag(documentId, "important")
    }

    @Test
    fun `should unassign user from document`() {
        val documentId = "11111111-1111-1111-1111-111111111111"
        val processInstanceId = "00000000-0000-0000-0000-000000000000"
        val delegateExecution = mock<DelegateExecution>()
        whenever(delegateExecution.id).thenReturn("id")
        whenever(delegateExecution.processInstanceId).thenReturn(processInstanceId)
        whenever(delegateExecution.businessKey).thenReturn(documentId)
        documentDelegateService.unassign(delegateExecution)

        verify(caseDocumentResolver).resolveCaseDocumentId(UUID.fromString(documentId))
        verify(documentService, times(1)).unassignUserFromDocument(UUID.fromString(documentId))
    }


    private fun createDocument(): JsonSchemaDocument {
        return JsonSchemaDocument.create(
            definition, JsonDocumentContent(
                """
                {
                    "applicant": {
                        "street": "$STREET_NAME",
                        "number": "$HOUSE_NUMBER",
                        "prettyHouse": "$NO"
                    },
                    "cars":[
                        { "mark":"volvo", "year": 1991 },
                        { "mark":"audi", "year": 2016 }
                    ]
                }
            """.trimIndent()
            ),
            "USERNAME",
            documentSequenceGeneratorService,
            null
        ).resultingDocument().get()
    }
}
