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
import com.ritense.document.domain.Document
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.BaseIntegrationTest
import com.ritense.processdocument.repository.ProcessDocumentInstanceRepository
import com.ritense.valtimo.operaton.repository.OperatonTaskSpecificationHelper.Companion.byName
import com.ritense.valtimo.service.OperatonTaskService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.RuntimeService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional

/**
 * Integration test for [CorrelationService] restricted to case processes. The building-block
 * module is on the test classpath, so its business-key provider is active and simply contributes
 * nothing for these cases — delivery to the case's own processes must keep the behaviour of
 * [CorrelationService], including the [com.ritense.processdocument.domain.ProcessDocumentInstance]
 * association.
 */
@Transactional
class CorrelationServiceCaseScopeIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var correlationService: CorrelationService

    @Autowired
    lateinit var documentService: DocumentService

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @Autowired
    lateinit var processDocumentInstanceRepository: ProcessDocumentInstanceRepository

    @Autowired
    lateinit var runtimeService: RuntimeService

    @Autowired
    lateinit var taskService: OperatonTaskService

    @Test
    fun `should only correlate the case that was targeted`() {
        val documentOne = createDocument()
        val documentTwo = createDocument()
        startCatchEventProcessOne(documentOne)
        startCatchEventProcessTwo(documentTwo)

        val results = correlationService.sendCatchEventMessageToCase(MESSAGE, documentOne.id().toString())

        assertThat(results).hasSize(1)
        assertThat(findTask(TASK_ONE)).isNotNull()
        assertThat(findTask(TASK_TWO)).isNull()
    }

    @Test
    fun `should associate the receiving case process with the case document`() {
        val document = createDocument()
        startCatchEventProcessOne(document)

        correlationService.sendCatchEventMessageToCase(MESSAGE, document.id().toString())

        val associations = processDocumentInstanceRepository
            .findAllByProcessDocumentInstanceIdDocumentId(JsonSchemaDocumentId.existingId(document.id().id))
        assertThat(associations.map { it.processName() }).containsExactly(PROCESS_ONE_NAME)
    }

    @Test
    fun `should set variables on the receiving case process`() {
        val document = createDocument()
        startCatchEventProcessOne(document)

        correlationService.sendCatchEventMessageToCase(
            MESSAGE,
            document.id().toString(),
            "varName1",
            "varValue1"
        )

        val task = findTask(TASK_ONE)!!
        val variables = runWithoutAuthorization {
            runtimeService.getVariables(task.getProcessInstanceId())
        }
        assertThat(variables["varName1"]).isEqualTo("varValue1")
    }

    @Test
    fun `should return an empty result when nothing is subscribed`() {
        val document = createDocument()

        val results = correlationService.sendCatchEventMessageToCase(MESSAGE, document.id().toString())

        assertThat(results).isEmpty()
    }

    private fun createDocument(): Document {
        return runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest(
                    "house",
                    "house",
                    "1.0.0",
                    objectMapper.readTree(DOCUMENT_JSON)
                )
            ).resultingDocument().orElseThrow()
        }
    }

    private fun startCatchEventProcessOne(document: Document) {
        runtimeService.startProcessInstanceByKey(PROCESS_ONE_KEY, document.id().toString(), emptyMap())
        check(findTask(TASK_ONE) == null) { "Process '$PROCESS_ONE_KEY' should wait on the catch event" }
    }

    private fun startCatchEventProcessTwo(document: Document) {
        runtimeService.startProcessInstanceByKey(PROCESS_TWO_KEY, document.id().toString(), emptyMap())
        check(findTask(TASK_TWO) == null) { "Process '$PROCESS_TWO_KEY' should wait on the catch event" }
    }

    private fun findTask(name: String) = runWithoutAuthorization { taskService.findTask(byName(name)) }

    companion object {
        private const val MESSAGE = "intermediate-catch-event-ref"
        private const val PROCESS_ONE_KEY = "intermediate-catch-event-sample-one-id"
        private const val PROCESS_TWO_KEY = "intermediate-catch-event-sample-two-id"
        private const val PROCESS_ONE_NAME = "intermediate-catch-event-sample-one"
        private const val TASK_ONE = "intermediate-catch-event-1-user-task"
        private const val TASK_TWO = "intermediate-catch-event-2-user-task"
        private const val DOCUMENT_JSON = """{"street": "aStreet", "houseNumber": 1}"""
    }
}
