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

package com.ritense.processdocument.web.rest

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.service.DocumentService
import com.ritense.logging.domain.LoggingEvent
import com.ritense.logging.domain.LoggingEventProperty
import com.ritense.logging.domain.LoggingEventPropertyId
import com.ritense.logging.repository.LoggingEventPropertyRepository
import com.ritense.logging.repository.LoggingEventRepository
import com.ritense.processdocument.BaseIntegrationTest
import com.ritense.processdocument.service.ProcessDocumentAssociationService
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.ADMIN
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.RuntimeService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.transaction.support.TransactionTemplate
import org.springframework.web.context.WebApplicationContext
import java.time.LocalDateTime
import java.time.ZoneId
import java.util.UUID
import kotlin.random.Random

class LogInspectionResourceIT : BaseIntegrationTest() {

    @Autowired
    private lateinit var webApplicationContext: WebApplicationContext

    @Autowired
    private lateinit var documentService: DocumentService

    @Autowired
    private lateinit var loggingEventRepository: LoggingEventRepository

    @Autowired
    private lateinit var loggingEventPropertyRepository: LoggingEventPropertyRepository

    @Autowired
    private lateinit var objectMapper: ObjectMapper

    @Autowired
    private lateinit var transactionTemplate: TransactionTemplate

    @Autowired
    private lateinit var runtimeService: RuntimeService

    @Autowired
    private lateinit var processDocumentAssociationService: ProcessDocumentAssociationService

    private lateinit var mockMvc: MockMvc
    private lateinit var caseId: UUID
    private val seededEventIds = mutableListOf<Long>()

    @BeforeEach
    fun init() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build()

        caseId = transactionTemplate.execute {
            runWithoutAuthorization {
                documentService.createDocument(
                    NewDocumentRequest(
                        "house",
                        "house",
                        "1.0.0",
                        objectMapper.readTree(
                            """{ "street": "main", "houseNumber": 1 }"""
                        )
                    )
                ).resultingDocument().orElseThrow().id().id
            }
        }!!
    }

    @AfterEach
    fun cleanup() {
        if (seededEventIds.isEmpty()) return
        transactionTemplate.executeWithoutResult {
            seededEventIds.forEach { eventId ->
                val event = loggingEventRepository.findById(eventId).orElse(null) ?: return@forEach
                val props = event.properties.toList()
                loggingEventPropertyRepository.deleteAll(props)
                loggingEventRepository.delete(event)
            }
        }
        seededEventIds.clear()
    }

    @Test
    @WithMockUser(username = "admin@test.com", authorities = [ADMIN])
    fun `should return case logs with lazy MDC properties resolved by the controller's transaction`() {
        val seeded = transactionTemplate.execute {
            val event = saveLogEvent("lazy-init-check", "INFO")
            saveProperty(event, JSON_SCHEMA_DOCUMENT_KEY, caseId.toString())
            event.id
        }!!
        seededEventIds.add(seeded)

        mockMvc.perform(
            post("/api/management/v1/case/{caseId}/logs", caseId)
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .content("{}")
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.content[0].formattedMessage").value("lazy-init-check"))
            .andExpect(jsonPath("$.content[0].level").value("INFO"))
            .andExpect(jsonPath("$.content[0].properties").isArray)
            .andExpect(jsonPath("$.content[0].properties[0].key").value(JSON_SCHEMA_DOCUMENT_KEY))
            .andExpect(jsonPath("$.content[0].properties[0].value").value(caseId.toString()))
    }

    @Test
    @WithMockUser(username = "admin@test.com", authorities = [ADMIN])
    fun `should not return logs from other cases`() {
        val otherCaseId = UUID.randomUUID()
        val mine = transactionTemplate.execute {
            val a = saveLogEvent("for-this-case", "INFO")
            saveProperty(a, JSON_SCHEMA_DOCUMENT_KEY, caseId.toString())
            val b = saveLogEvent("for-other-case", "INFO")
            saveProperty(b, JSON_SCHEMA_DOCUMENT_KEY, otherCaseId.toString())
            listOf(a.id, b.id)
        }!!
        seededEventIds.addAll(mine)

        mockMvc.perform(
            post("/api/management/v1/case/{caseId}/logs", caseId)
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .content("{}")
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.content[0].formattedMessage").value("for-this-case"))
    }

    @Test
    @WithMockUser(username = "admin@test.com", authorities = [ADMIN])
    fun `should include logs tagged only with a process instance id associated with the case`() {
        // Start a real BPMN process linked to the case so the ProcessDocumentCaseLogScopeContributor finds it
        val processInstanceId = transactionTemplate.execute {
            val pi = runtimeService.startProcessInstanceByKey(
                "single-user-task-process",
                caseId.toString()
            )
            runWithoutAuthorization {
                processDocumentAssociationService.createProcessDocumentInstance(
                    pi.id,
                    caseId,
                    "single user task process",
                )
            }
            pi.id
        }!!

        // Seed two log rows: one tagged only with processInstanceId (no JsonSchemaDocument MDC), one unrelated
        val seeded = transactionTemplate.execute {
            val piOnly = saveLogEvent("pi-only-event", "INFO")
            saveProperty(piOnly, "processInstanceId", processInstanceId)

            val unrelated = saveLogEvent("unrelated-event", "INFO")
            saveProperty(unrelated, "processInstanceId", "some-other-pi")

            listOf(piOnly.id, unrelated.id)
        }!!
        seededEventIds.addAll(seeded)

        mockMvc.perform(
            post("/api/management/v1/case/{caseId}/logs", caseId)
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .content("{}")
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.content[0].formattedMessage").value("pi-only-event"))
    }

    @Test
    @WithMockUser(username = "admin@test.com", authorities = [ADMIN])
    fun `should include logs tagged only with a businessKey equal to the case id`() {
        val seeded = transactionTemplate.execute {
            val bkOnly = saveLogEvent("bk-only-event", "INFO")
            saveProperty(bkOnly, "businessKey", caseId.toString())

            val unrelated = saveLogEvent("unrelated-event", "INFO")
            saveProperty(unrelated, "businessKey", UUID.randomUUID().toString())

            listOf(bkOnly.id, unrelated.id)
        }!!
        seededEventIds.addAll(seeded)

        mockMvc.perform(
            post("/api/management/v1/case/{caseId}/logs", caseId)
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .content("{}")
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.content[0].formattedMessage").value("bk-only-event"))
    }

    @Test
    @WithMockUser(username = "admin@test.com", authorities = [ADMIN])
    fun `should overwrite a client-supplied businessKey property with the path case`() {
        val otherCaseId = UUID.randomUUID()
        val seeded = transactionTemplate.execute {
            val mine = saveLogEvent("mine", "INFO")
            saveProperty(mine, "businessKey", caseId.toString())
            val theirs = saveLogEvent("theirs", "INFO")
            saveProperty(theirs, "businessKey", otherCaseId.toString())
            listOf(mine.id, theirs.id)
        }!!
        seededEventIds.addAll(seeded)

        val body = """
            {
              "additionalProperties": [
                { "key": "businessKey", "value": "$otherCaseId" }
              ]
            }
        """.trimIndent()

        mockMvc.perform(
            post("/api/management/v1/case/{caseId}/logs", caseId)
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .content(body)
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.content[0].formattedMessage").value("mine"))
    }

    @Test
    @WithMockUser(username = "admin@test.com", authorities = [ADMIN])
    fun `should overwrite a client-supplied JsonSchemaDocument property with the path case`() {
        val otherCaseId = UUID.randomUUID()
        val seeded = transactionTemplate.execute {
            val mine = saveLogEvent("mine", "INFO")
            saveProperty(mine, JSON_SCHEMA_DOCUMENT_KEY, caseId.toString())
            val theirs = saveLogEvent("theirs", "INFO")
            saveProperty(theirs, JSON_SCHEMA_DOCUMENT_KEY, otherCaseId.toString())
            listOf(mine.id, theirs.id)
        }!!
        seededEventIds.addAll(seeded)

        val body = """
            {
              "additionalProperties": [
                { "key": "$JSON_SCHEMA_DOCUMENT_KEY", "value": "$otherCaseId" }
              ]
            }
        """.trimIndent()

        mockMvc.perform(
            post("/api/management/v1/case/{caseId}/logs", caseId)
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .content(body)
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.content[0].formattedMessage").value("mine"))
    }

    private fun saveLogEvent(message: String, level: String): LoggingEvent {
        val event = LoggingEvent(
            id = Random.nextLong(Long.MAX_VALUE),
            timestamp = LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli(),
            formattedMessage = message,
            loggerName = "test-logger",
            level = level,
            threadName = "test",
            referenceFlag = 0,
            arg0 = null,
            arg1 = null,
            arg2 = null,
            arg3 = null,
            callerFilename = "Test.kt",
            callerClass = "Test",
            callerMethod = "test",
            callerLine = 0,
            properties = emptyList(),
            exceptions = emptyList(),
        )
        return loggingEventRepository.save(event)
    }

    private fun saveProperty(event: LoggingEvent, key: String, value: String) {
        loggingEventPropertyRepository.save(
            LoggingEventProperty(
                id = LoggingEventPropertyId(event.id, key),
                event = event,
                value = value,
            )
        )
    }

    companion object {
        private val JSON_SCHEMA_DOCUMENT_KEY: String = JsonSchemaDocument::class.java.canonicalName
    }
}
