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
package com.ritense.valtimo.scripttask

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.valtimo.BaseIntegrationTest
import com.ritense.valtimo.service.CamundaProcessService
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.camunda.bpm.engine.DecisionService
import org.camunda.bpm.engine.HistoryService
import org.camunda.bpm.engine.ProcessEngineConfiguration
import org.camunda.bpm.engine.ScriptEvaluationException
import org.camunda.bpm.engine.impl.cfg.ProcessEngineConfigurationImpl
import org.camunda.bpm.engine.impl.scripting.engine.ScriptEngineResolver
import org.camunda.bpm.engine.impl.scripting.engine.ScriptingEngines
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.context.transaction.TestTransaction
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class GraalJsContextCleanupIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var camundaProcessService: CamundaProcessService

    @Autowired
    lateinit var historyService: HistoryService

    @Autowired
    lateinit var decisionService: DecisionService

    @Autowired
    lateinit var processEngineConfiguration: ProcessEngineConfiguration

    private lateinit var originalResolver: ScriptEngineResolver
    private lateinit var recording: RecordingScriptEngineResolver

    @BeforeEach
    fun installRecorder() {
        val scriptingEngines = (processEngineConfiguration as ProcessEngineConfigurationImpl).scriptingEngines
        originalResolver = ScriptingEngines::class.java.getDeclaredField("scriptEngineResolver")
            .apply { isAccessible = true }
            .get(scriptingEngines) as ScriptEngineResolver
        recording = RecordingScriptEngineResolver(originalResolver)
        scriptingEngines.setScriptEngineResolver(recording)
    }

    @AfterEach
    fun restoreResolver() {
        (processEngineConfiguration as ProcessEngineConfigurationImpl).scriptingEngines
            .setScriptEngineResolver(originalResolver)
    }

    private fun assertAllClosed(expectedCount: Int? = null) {
        if (expectedCount != null) {
            assertEquals(expectedCount, recording.contexts.size)
        } else {
            assertTrue(recording.contexts.isNotEmpty())
        }
        assertTrue(recording.contexts.all { RecordingScriptEngineResolver.isClosed(it) })
    }

    @Test
    fun `should close contexts of many script task runs`() {
        val runs = 250
        val businessKeys = (1..runs).map { UUID.randomUUID().toString() }

        val processInstanceIds = businessKeys.map { key ->
            runWithoutAuthorization {
                camundaProcessService.startProcess(
                    "javascript-script-task-process",
                    key,
                    mapOf("a" to 1, "b" to 2)
                ).processInstanceDto.id
            }
        }

        assertEquals(
            runs,
            historyService.createHistoricProcessInstanceQuery()
                .processInstanceIds(processInstanceIds.toSet())
                .completed()
                .count().toInt()
        )
        processInstanceIds.forEach { id ->
            val c = historyService.createHistoricVariableInstanceQuery()
                .processInstanceId(id)
                .variableName("c")
                .singleResult()
                .value
            assertEquals(3, c)
        }
        assertAllClosed(runs)
    }

    @Test
    @Transactional
    fun `should keep context open until transaction ends`() {
        runWithoutAuthorization {
            camundaProcessService.startProcess(
                "javascript-script-task-process",
                UUID.randomUUID().toString(),
                mapOf("a" to 1, "b" to 2)
            )
        }

        assertEquals(1, recording.contexts.size)
        assertTrue(recording.contexts.none { RecordingScriptEngineResolver.isClosed(it) })

        TestTransaction.flagForRollback()
        TestTransaction.end()

        assertAllClosed(1)
    }

    @Test
    fun `should keep json string result after context is closed`() {
        val processInstance = runWithoutAuthorization {
            camundaProcessService.startProcess(
                "javascript-json-result-process",
                UUID.randomUUID().toString(),
                emptyMap()
            ).processInstanceDto
        }

        val json = historyService.createHistoricVariableInstanceQuery()
            .processInstanceId(processInstance.id)
            .variableName("json")
            .singleResult()
            .value
        assertEquals("{\"a\":1}", json)
        assertAllClosed()
    }

    @Test
    fun `should close contexts of dmn javascript evaluation`() {
        val result = decisionService
            .evaluateDecisionTableByKey("javascript-expression-decision")
            .variables(mapOf("size" to 60))
            .evaluate()

        assertEquals("High-60", result.singleResult.getSingleEntry<String>())
        assertAllClosed()
    }

    @Test
    fun `should close contexts of dmn javascript in business rule task`() {
        val processInstance = runWithoutAuthorization {
            camundaProcessService.startProcess(
                "javascript-dmn-process",
                UUID.randomUUID().toString(),
                mapOf("size" to 10)
            ).processInstanceDto
        }

        val risk = historyService.createHistoricVariableInstanceQuery()
            .processInstanceId(processInstance.id)
            .variableName("risk")
            .singleResult()
            .value
        assertEquals("Low-10", risk)
        assertAllClosed()
    }

    @Test
    fun `dmn compiled script stays restricted with option-like variable`() {
        repeat(2) { attempt ->
            val variables = mutableMapOf<String, Any>("size" to 60)
            if (attempt == 0) variables["polyglot.js.allowHostClassLookup"] = true
            val error = assertThrows<Exception> {
                decisionService
                    .evaluateDecisionTableByKey("javascript-restricted-decision")
                    .variables(variables)
                    .evaluate()
            }
            assertTrue(generateSequence<Throwable>(error) { it.cause }.any { it.message?.contains("java.lang.System") == true })
        }
    }

    @Test
    fun `dmn object output is readable after context is closed`() {
        val result = decisionService
            .evaluateDecisionTableByKey("javascript-object-output-decision")
            .variables(mapOf("size" to 60))
            .evaluate()

        val entry = result.singleResult.getEntry<Any>("result")

        assertEquals(mapOf("level" to "High", "size" to 60), entry)
        assertAllClosed()
    }

    @Test
    fun `dmn map output is readable after context is closed`() {
        val result = decisionService
            .evaluateDecisionTableByKey("javascript-map-output-decision")
            .variables(mapOf("size" to 60))
            .evaluate()

        val entry = result.singleResult.getEntry<Any>("result")

        assertEquals(mapOf("level" to "High", "size" to 60), entry)
        assertAllClosed()
    }

    @Test
    fun `should close contexts when transaction rolls back`() {
        val businessKey = UUID.randomUUID().toString()

        assertThrows<ScriptEvaluationException> {
            runWithoutAuthorization {
                camundaProcessService.startProcess(
                    "javascript-script-task-rollback-process",
                    businessKey,
                    mapOf("a" to 1, "b" to 2)
                )
            }
        }

        assertNull(
            historyService.createHistoricProcessInstanceQuery()
                .processInstanceBusinessKey(businessKey)
                .singleResult()
        )
        assertAllClosed(2)
    }
}
