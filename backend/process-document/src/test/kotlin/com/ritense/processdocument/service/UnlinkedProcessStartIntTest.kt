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
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.BaseIntegrationTest
import com.ritense.processdocument.domain.impl.request.StartProcessForDocumentRequest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.RuntimeService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional

/**
 * Unlinked ("system") process definitions have no version tag, so they can only ever be resolved by key.
 * Excluding blueprint-owned definitions from that key-based lookup must not change anything for them.
 */
@Transactional
class UnlinkedProcessStartIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var processDocumentService: ProcessDocumentService

    @Autowired
    lateinit var documentService: DocumentService

    @Autowired
    lateinit var repositoryService: RepositoryService

    @Autowired
    lateinit var runtimeService: RuntimeService

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @Test
    fun `should start the latest version of an unlinked process when only its key is given`() {
        deploySystemProcess()
        val latestDefinitionId = deploySystemProcess()
        val documentId = createDocument()

        val result = runWithoutAuthorization {
            processDocumentService.startProcessForDocument(
                StartProcessForDocumentRequest(documentId, SYSTEM_PROCESS_KEY, emptyMap())
            )
        }

        assertThat(result.errors()).isEmpty()
        assertThat(startedDefinitionIdOf(result.processInstanceId().orElseThrow().toString()))
            .isEqualTo(latestDefinitionId)
    }

    @Test
    fun `should start the requested version of an unlinked process when its process definition id is given`() {
        val firstDefinitionId = deploySystemProcess()
        deploySystemProcess()
        val documentId = createDocument()

        val result = runWithoutAuthorization {
            processDocumentService.startProcessForDocument(
                StartProcessForDocumentRequest(documentId, SYSTEM_PROCESS_KEY, emptyMap())
                    .withProcessDefinitionId(firstDefinitionId)
            )
        }

        assertThat(result.errors()).isEmpty()
        assertThat(startedDefinitionIdOf(result.processInstanceId().orElseThrow().toString()))
            .isEqualTo(firstDefinitionId)
    }

    private fun deploySystemProcess(): String {
        return repositoryService.createDeployment()
            .addClasspathResource("bpmn/$SYSTEM_PROCESS_KEY.bpmn")
            .deployWithResult()
            .deployedProcessDefinitions
            .first()
            .id
    }

    private fun createDocument() = runWithoutAuthorization {
        documentService.createDocument(
            NewDocumentRequest("house", "house", "1.0.0", objectMapper.readTree("""{"street": "aStreet"}"""))
        ).resultingDocument().orElseThrow()
    }.id()

    private fun startedDefinitionIdOf(processInstanceId: String) = runtimeService.createProcessInstanceQuery()
        .processInstanceId(processInstanceId)
        .singleResult()
        .processDefinitionId

    private companion object {
        const val SYSTEM_PROCESS_KEY = "system-process"
    }
}
