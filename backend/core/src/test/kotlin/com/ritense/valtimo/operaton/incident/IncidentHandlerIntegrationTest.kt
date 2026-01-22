package com.ritense.valtimo.operaton.incident

import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import com.ritense.valtimo.BaseIntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.ManagementService
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.context.TestPropertySource

@TestPropertySource(properties = [
    "operaton.incident.alert-log.enabled=true"
])
class IncidentHandlerIntegrationTest(
    @Autowired val managementService: ManagementService
): BaseIntegrationTest() {

    @Test
    fun `engine triggers decorator and logs alert line`() {
        val targetLogger = LoggerFactory.getLogger(OperatonIncidentHandlerDecorator::class.java) as Logger
        val listAppender = ListAppender<ILoggingEvent>().apply { start() }
        targetLogger.addAppender(listAppender)

        try {
            // Start a process instance that will create a failing async job
            val procInstance = runtimeService.startProcessInstanceByKey("failing-process")

            // Execute jobs until retries exhausted / incident created
            for (i in 1..10) {
                val job = managementService.createJobQuery().processInstanceId(procInstance.id).singleResult() ?: break
                try {
                    managementService.executeJob(job.id)
                } catch (_: Exception) {
                    // expected; keep going until incident is created
                }

                val incident = runtimeService.createIncidentQuery()
                    .processInstanceId(procInstance.id)
                    .singleResult()

                if (incident != null) break
            }

            val incident = runtimeService.createIncidentQuery().processInstanceId(procInstance.id).singleResult()
            assertThat(incident).isNotNull

            // Assert log line
            val msg = listAppender.list.joinToString("\n") { it.formattedMessage }
            assertThat(msg).contains("OPERATON_INCIDENT_FAILED_JOB")
        } finally {
            targetLogger.detachAppender(listAppender)
            listAppender.stop()
        }
    }
}
