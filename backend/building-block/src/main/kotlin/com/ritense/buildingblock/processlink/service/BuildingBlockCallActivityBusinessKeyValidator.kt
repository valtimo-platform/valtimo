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

import com.ritense.valtimo.contract.buildingblock.BuildingBlockConstants.Companion.BUILDING_BLOCK_DOCUMENT_ID_VARIABLE
import org.operaton.bpm.model.bpmn.impl.BpmnModelConstants.CAMUNDA_NS
import org.operaton.bpm.model.bpmn.impl.BpmnModelConstants.OPERATON_NS
import org.operaton.bpm.model.bpmn.instance.CallActivity

/**
 * Validates that a building-block call activity propagates the building block document id as the
 * business key of the called process. Everything inside a building block resolves its context
 * (`doc:` references, plugin configuration mappings) through that business key; with a wrong or
 * missing mapping the building block silently runs against the wrong document.
 *
 * Validation follows the engine's namespace semantics, not the BPMN model API's: the engine reads
 * `<camunda:in>` elements only as a fallback when a call activity has no `<operaton:in>` elements
 * at all. A correct `<camunda:in businessKey="..."/>` next to any `<operaton:in>` element is
 * therefore dead configuration, even though the model API still returns it.
 */
object BuildingBlockCallActivityBusinessKeyValidator {

    const val BUSINESS_KEY_EXPRESSION = "#{$BUILDING_BLOCK_DOCUMENT_ID_VARIABLE}"

    /**
     * @throws IllegalStateException when the call activity does not effectively map the business
     * key to [BUSINESS_KEY_EXPRESSION], with a message that explains what the engine will do and
     * how to fix the BPMN.
     */
    fun validate(callActivity: CallActivity, processDefinitionKey: String) {
        val context = "Call activity '${callActivity.id}' in process definition '$processDefinitionKey'"

        val inElements = callActivity.extensionElements
            ?.domElement
            ?.childElements
            ?.filter { it.localName == IN_ELEMENT }
            ?: emptyList()

        val operatonInElements = inElements.filter { it.namespaceURI == OPERATON_NS }
        val camundaInElements = inElements.filter { it.namespaceURI == CAMUNDA_NS }
        // The engine reads camunda:in elements only when there are no operaton:in elements
        val effectiveInElements = operatonInElements.ifEmpty { camundaInElements }

        val businessKeys = effectiveInElements
            .mapNotNull { element -> element.getAttribute(BUSINESS_KEY_ATTRIBUTE)?.takeIf { it.isNotBlank() } }
            .distinct()

        val camundaMappingIsShadowed = operatonInElements.isNotEmpty() &&
            camundaInElements.any { it.getAttribute(BUSINESS_KEY_ATTRIBUTE) == BUSINESS_KEY_EXPRESSION }

        when {
            businessKeys.isEmpty() -> error(
                "$context must define <camunda:in businessKey=\"$BUSINESS_KEY_EXPRESSION\" />, so that the " +
                    "building block runs under its own document." +
                    shadowingExplanation(camundaMappingIsShadowed)
            )

            businessKeys.size > 1 -> error(
                "$context defines multiple business key mappings " +
                    "(${businessKeys.joinToString { "'$it'" }}). Define exactly one: " +
                    "<camunda:in businessKey=\"$BUSINESS_KEY_EXPRESSION\" />." +
                    shadowingExplanation(camundaMappingIsShadowed)
            )

            businessKeys.single() != BUSINESS_KEY_EXPRESSION -> error(
                "$context must map the business key to $BUSINESS_KEY_EXPRESSION, but maps it to " +
                    "'${businessKeys.single()}'. With this mapping the building block runs under the wrong " +
                    "document, and doc: references inside the building block silently resolve to null." +
                    shadowingExplanation(camundaMappingIsShadowed)
            )
        }
    }

    private fun shadowingExplanation(camundaMappingIsShadowed: Boolean): String =
        if (camundaMappingIsShadowed) {
            " Note: this call activity does contain <camunda:in businessKey=\"$BUSINESS_KEY_EXPRESSION\" />, " +
                "but the engine ignores it because <operaton:in> elements are also present; camunda-namespace " +
                "elements are only read when no operaton-namespace elements exist. Move the business key " +
                "mapping to an <operaton:in> element, or remove all <operaton:in> elements."
        } else {
            ""
        }

    private const val IN_ELEMENT = "in"
    private const val BUSINESS_KEY_ATTRIBUTE = "businessKey"
}
