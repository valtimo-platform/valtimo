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

package com.ritense.zakenapi.uploadprocess

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.service.impl.JsonSchemaDocumentService
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.domain.ProcessDocumentDefinitionRequest
import com.ritense.processdocument.domain.impl.request.DocumentDefinitionProcessRequest
import com.ritense.processdocument.service.CaseDefinitionProcessLinkService
import com.ritense.processdocument.service.ProcessDefinitionCaseDefinitionService
import com.ritense.resource.service.TemporaryResourceStorageService
import com.ritense.temporaryresource.domain.StorageMetadataKeys
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.zakenapi.BaseIntegrationTest
import com.ritense.zakenapi.uploadprocess.UploadProcessService.Companion.DOCUMENT_UPLOAD
import com.ritense.zakenapi.uploadprocess.UploadProcessService.Companion.RESOURCE_ID_PROCESS_VAR
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.HistoryService
import org.operaton.bpm.engine.history.HistoricProcessInstance
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Transactional
class UploadProcessServiceIT @Autowired constructor(
    private val documentService: JsonSchemaDocumentService,
    private val temporaryResourceStorageService: TemporaryResourceStorageService,
    private val uploadProcessService: UploadProcessService,
    private val historyService: HistoryService,
    private val processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService,
    private val caseDefinitionProcessLinkService: CaseDefinitionProcessLinkService,
    private val objectMapper: ObjectMapper,
) : BaseIntegrationTest() {

    val caseDefinitionId = CaseDefinitionId("profile", "1.0.0")

    @BeforeEach
    fun beforeEach() {
        runWithoutAuthorization {
            processDefinitionCaseDefinitionService.createProcessDocumentDefinition(
                ProcessDocumentDefinitionRequest(
                    ProcessDefinitionId(UPLOAD_DOCUMENT_PROCESS_DEFINITION_KEY),
                    caseDefinitionId,
                    true
                )
            )
            caseDefinitionProcessLinkService.saveDocumentDefinitionProcess(
                caseDefinitionId,
                DocumentDefinitionProcessRequest(
                    UPLOAD_DOCUMENT_PROCESS_DEFINITION_KEY,
                    DOCUMENT_UPLOAD
                )
            )
        }
    }

    @Test
    fun `should start upload process when a resource is attached to a document`() {
        val documentId = createDocument()
        val resourceId = temporaryResourceStorageService.store("My file data".byteInputStream())

        runWithoutAuthorization {
            uploadProcessService.startUploadResourceProcess(documentId, resourceId)
        }

        val documentUploadProcess =
            getHistoricProcessInstance(UPLOAD_DOCUMENT_PROCESS_DEFINITION_KEY, documentId.toString())
        val retrievedResourceId =
            getHistoricVariable(documentUploadProcess.rootProcessInstanceId, RESOURCE_ID_PROCESS_VAR) as String
        assertThat(documentUploadProcess.startTime).isNotNull
        assertThat(retrievedResourceId).isEqualTo(resourceId)
    }

    @Test
    fun `should not start upload process for a resource that is already part of a case`() {
        val documentId = createDocument()
        val resourceId = temporaryResourceStorageService.store("My file data".byteInputStream())
        temporaryResourceStorageService.saveMetadataValue(
            resourceId,
            StorageMetadataKeys.DOCUMENT_URL,
            "http://localhost/documenten/api/v1/enkelvoudiginformatieobjecten/${UUID.randomUUID()}"
        )
        temporaryResourceStorageService.deleteResource(resourceId)

        runWithoutAuthorization {
            uploadProcessService.startUploadResourceProcess(documentId, resourceId)
        }

        val documentUploadProcess = historyService.createHistoricProcessInstanceQuery()
            .processInstanceBusinessKey(documentId.toString())
            .singleResult()
        assertThat(documentUploadProcess).isNull()
    }

    private fun createDocument(): UUID {
        return runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest(
                    DOCUMENT_DEFINITION_KEY,
                    "profile",
                    "1.0.0",
                    objectMapper.createObjectNode()
                )
            ).resultingDocument().get().id!!.id
        }
    }

    private fun getHistoricProcessInstance(processDefinitionKey: String, documentId: String): HistoricProcessInstance {
        return historyService.createHistoricProcessInstanceQuery()
            .processDefinitionKey(processDefinitionKey)
            .processInstanceBusinessKey(documentId)
            .singleResult()
    }

    private fun <T> getHistoricVariable(processInstanceId: String, variableKey: String): T {
        return historyService.createHistoricVariableInstanceQuery()
            .processInstanceId(processInstanceId)
            .variableName(variableKey)
            .singleResult()
            .value as T
    }

    companion object {
        private const val DOCUMENT_DEFINITION_KEY = "profile"
        private const val UPLOAD_DOCUMENT_PROCESS_DEFINITION_KEY = "document-upload"
    }
}
