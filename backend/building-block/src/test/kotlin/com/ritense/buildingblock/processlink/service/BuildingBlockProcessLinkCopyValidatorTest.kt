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

package com.ritense.buildingblock.processlink.service

import ch.qos.logback.classic.Level
import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.domain.ProcessLink
import com.ritense.processlink.domain.ProcessLinksCopiedEvent
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.operaton.bpm.model.bpmn.Bpmn
import org.operaton.bpm.model.bpmn.BpmnModelInstance
import org.slf4j.LoggerFactory
import java.util.UUID

class BuildingBlockProcessLinkCopyValidatorTest {

    private val validator = BuildingBlockProcessLinkCopyValidator()

    @Test
    fun `should not log an error for a correctly mapped call activity`() {
        val errors = errorsLoggedBy(
            event(
                links = listOf(buildingBlockProcessLink(activityId = CALL_ACTIVITY_ID)),
                model = bpmnModelWith("""<camunda:in businessKey="#{buildingBlockDocumentId}" />""")
            )
        )

        assertThat(errors).isEmpty()
    }

    @Test
    fun `should log an error when the activity is not a call activity in the new definition`() {
        val errors = errorsLoggedBy(
            event(
                links = listOf(buildingBlockProcessLink(activityId = "someOtherActivity")),
                model = bpmnModelWith("""<camunda:in businessKey="#{buildingBlockDocumentId}" />""")
            )
        )

        assertThat(errors).singleElement().asString().contains("is not a call activity")
    }

    @Test
    fun `should log an error when the activity id belongs to another element type`() {
        // A morphed call activity keeps its id, so the copied link still resolves - to a non-call-activity.
        val errors = errorsLoggedBy(
            event(
                links = listOf(buildingBlockProcessLink(activityId = CALL_ACTIVITY_ID)),
                model = bpmnModelWithUserTask()
            )
        )

        assertThat(errors).singleElement().asString().contains("is not a call activity")
    }

    @Test
    fun `should log an error when the copied call activity does not map the business key`() {
        val errors = errorsLoggedBy(
            event(
                links = listOf(buildingBlockProcessLink(activityId = CALL_ACTIVITY_ID)),
                model = bpmnModelWith("""<camunda:in variables="all" />""")
            )
        )

        assertThat(errors).singleElement().asString()
            .contains("invalid call activity configuration")
            .contains("#{buildingBlockDocumentId}")
    }

    @Test
    fun `should do nothing when the event carries no bpmn model`() {
        val errors = errorsLoggedBy(
            event(
                links = listOf(buildingBlockProcessLink(activityId = CALL_ACTIVITY_ID)),
                model = null
            )
        )

        assertThat(errors).isEmpty()
    }

    private fun errorsLoggedBy(event: ProcessLinksCopiedEvent): List<String> {
        val targetLogger = LoggerFactory.getLogger(BuildingBlockProcessLinkCopyValidator::class.java) as Logger
        val listAppender = ListAppender<ILoggingEvent>().apply { start() }
        targetLogger.addAppender(listAppender)

        try {
            validator.validateCopiedBuildingBlockLinks(event)
        } finally {
            targetLogger.detachAppender(listAppender)
            listAppender.stop()
        }

        return listAppender.list.filter { it.level == Level.ERROR }.map { it.formattedMessage }
    }

    private fun event(links: List<ProcessLink>, model: BpmnModelInstance?) = ProcessLinksCopiedEvent(
        copiedProcessLinks = links,
        processDefinitionId = PROCESS_DEFINITION_ID,
        processDefinitionModelInstance = model
    )

    private fun buildingBlockProcessLink(activityId: String) = BuildingBlockProcessLink(
        id = UUID.randomUUID(),
        processDefinitionId = PROCESS_DEFINITION_ID,
        activityId = activityId,
        activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
        buildingBlockDefinitionId = BuildingBlockDefinitionId.of("some-building-block", "1.0.0"),
        pluginConfigurationMappings = emptyMap()
    )

    private fun bpmnModelWithUserTask(): BpmnModelInstance {
        val xml = """<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
    xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
    xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
    xmlns:operaton="http://operaton.org/schema/1.0/bpmn"
    id="Definitions_test"
    targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="test-process" isExecutable="true">
    <bpmn:userTask id="$CALL_ACTIVITY_ID" name="No longer a call activity" />
  </bpmn:process>
</bpmn:definitions>"""
        return Bpmn.readModelFromStream(xml.byteInputStream())
    }

    private fun bpmnModelWith(extensionXml: String): BpmnModelInstance {
        val xml = """<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
    xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
    xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
    xmlns:operaton="http://operaton.org/schema/1.0/bpmn"
    id="Definitions_test"
    targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="test-process" isExecutable="true">
    <bpmn:callActivity id="$CALL_ACTIVITY_ID" calledElement="some-building-block-process">
      <bpmn:extensionElements>$extensionXml</bpmn:extensionElements>
    </bpmn:callActivity>
  </bpmn:process>
</bpmn:definitions>"""
        return Bpmn.readModelFromStream(xml.byteInputStream())
    }

    companion object {
        private const val PROCESS_DEFINITION_ID = "test-process:2:0e88d5f0-a170-11f1-bb30-0a2497bbf7c4"
        private const val CALL_ACTIVITY_ID = "buildingBlockCallActivity"
    }
}
