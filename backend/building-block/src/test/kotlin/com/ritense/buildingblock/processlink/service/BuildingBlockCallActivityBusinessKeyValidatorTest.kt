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

import org.assertj.core.api.Assertions.assertThatCode
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.operaton.bpm.model.bpmn.Bpmn
import org.operaton.bpm.model.bpmn.instance.CallActivity

class BuildingBlockCallActivityBusinessKeyValidatorTest {

    @Test
    fun `should accept a correct camunda namespace business key mapping`() {
        val callActivity = callActivityWith("""<camunda:in businessKey="#{buildingBlockDocumentId}" />""")

        assertThatCode {
            BuildingBlockCallActivityBusinessKeyValidator.validate(callActivity, PROCESS_KEY)
        }.doesNotThrowAnyException()
    }

    @Test
    fun `should accept a correct operaton namespace business key mapping`() {
        val callActivity = callActivityWith("""<operaton:in businessKey="#{buildingBlockDocumentId}" />""")

        assertThatCode {
            BuildingBlockCallActivityBusinessKeyValidator.validate(callActivity, PROCESS_KEY)
        }.doesNotThrowAnyException()
    }

    @Test
    fun `should reject a missing business key mapping`() {
        val callActivity = callActivityWith("""<camunda:in variables="all" />""")

        assertThatThrownBy {
            BuildingBlockCallActivityBusinessKeyValidator.validate(callActivity, PROCESS_KEY)
        }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("must define")
            .hasMessageContaining("#{buildingBlockDocumentId}")
    }

    @Test
    fun `should reject a call activity without extension elements`() {
        val callActivity = callActivityWith(null)

        assertThatThrownBy {
            BuildingBlockCallActivityBusinessKeyValidator.validate(callActivity, PROCESS_KEY)
        }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("must define")
    }

    @Test
    fun `should reject a wrong business key expression`() {
        val callActivity = callActivityWith("""<camunda:in businessKey="#{execution.processBusinessKey}" />""")

        assertThatThrownBy {
            BuildingBlockCallActivityBusinessKeyValidator.validate(callActivity, PROCESS_KEY)
        }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("#{execution.processBusinessKey}")
            .hasMessageContaining("wrong document")
    }

    @Test
    fun `should reject a correct camunda mapping that is shadowed by an operaton business key mapping`() {
        // The exact shape of the customer bug: the correct camunda:in is dead XML because the
        // engine only reads camunda-namespace elements when no operaton-namespace elements exist
        val callActivity = callActivityWith(
            """
                <operaton:in businessKey="#{execution.processBusinessKey}" />
                <camunda:in businessKey="#{buildingBlockDocumentId}" />
            """.trimIndent()
        )

        assertThatThrownBy {
            BuildingBlockCallActivityBusinessKeyValidator.validate(callActivity, PROCESS_KEY)
        }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("'#{execution.processBusinessKey}'")
            .hasMessageContaining("<operaton:in>")
            .hasMessageContaining("only read when no operaton-namespace elements exist")
    }

    @Test
    fun `should reject a correct camunda mapping that is shadowed by an operaton element without business key`() {
        val callActivity = callActivityWith(
            """
                <operaton:in variables="all" />
                <camunda:in businessKey="#{buildingBlockDocumentId}" />
            """.trimIndent()
        )

        assertThatThrownBy {
            BuildingBlockCallActivityBusinessKeyValidator.validate(callActivity, PROCESS_KEY)
        }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("must define")
            .hasMessageContaining("<operaton:in>")
    }

    @Test
    fun `should reject conflicting business key mappings`() {
        val callActivity = callActivityWith(
            """
                <camunda:in businessKey="#{buildingBlockDocumentId}" />
                <camunda:in businessKey="#{execution.processBusinessKey}" />
            """.trimIndent()
        )

        assertThatThrownBy {
            BuildingBlockCallActivityBusinessKeyValidator.validate(callActivity, PROCESS_KEY)
        }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("multiple business key mappings")
    }

    private fun callActivityWith(extensionXml: String?): CallActivity {
        val extensionElements = extensionXml
            ?.let { "<bpmn:extensionElements>$it</bpmn:extensionElements>" }
            ?: ""
        val xml = """<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
    xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
    xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
    xmlns:operaton="http://operaton.org/schema/1.0/bpmn"
    id="Definitions_test"
    targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="$PROCESS_KEY" isExecutable="true">
    <bpmn:callActivity id="callActivity" calledElement="some-building-block-process">$extensionElements</bpmn:callActivity>
  </bpmn:process>
</bpmn:definitions>"""
        val model = Bpmn.readModelFromStream(xml.byteInputStream())
        return model.getModelElementById("callActivity")
    }

    companion object {
        private const val PROCESS_KEY = "test-process"
    }
}
