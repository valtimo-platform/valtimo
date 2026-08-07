/*
 *
 *  * Copyright 2015-2026 Ritense BV, the Netherlands.
 *  *
 *  * Licensed under EUPL, Version 1.2 (the "License");
 *  * you may not use this file except in compliance with the License.
 *  * You may obtain a copy of the License at
 *  *
 *  * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *  *
 *  * Unless required by applicable law or agreed to in writing, software
 *  * distributed under the License is distributed on an "AS IS" basis,
 *  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  * See the License for the specific language governing permissions and
 *  * limitations under the License.
 *
 */

package com.ritense.processlink.service

import org.operaton.bpm.model.bpmn.BpmnModelInstance
import org.operaton.bpm.model.bpmn.instance.FlowNode
import org.operaton.bpm.model.bpmn.instance.bpmndi.BpmnShape

/**
 * Cleans up orphaned elements that have no visual representation in the BPMN diagram.
 *
 * These elements exist in the process definition XML but have no corresponding BPMNShape,
 * making them invisible to users in the BPMN editor. Since users cannot see or fix these
 * elements, we remove them automatically before validation.
 */
class BpmnInvisibleOrphanCleaner {

    fun clean(bpmnModel: BpmnModelInstance): CleanupResult {
        val removedElements = mutableListOf<RemovedElement>()

        val visibleElementIds = bpmnModel.getModelElementsByType(BpmnShape::class.java)
            .mapNotNull { it.bpmnElement?.id }
            .toSet()

        val flowNodesToRemove = bpmnModel.getModelElementsByType(FlowNode::class.java)
            .filter { it.id !in visibleElementIds }

        for (flowNode in flowNodesToRemove) {
            val incomingFlows = flowNode.incoming.toList()
            val outgoingFlows = flowNode.outgoing.toList()

            for (flow in incomingFlows + outgoingFlows) {
                removedElements.add(RemovedElement(flow.id, "SequenceFlow", flow.name))
                flow.parentElement.removeChildElement(flow)
            }

            removedElements.add(RemovedElement(flowNode.id, flowNode.elementType.typeName, flowNode.name))
            flowNode.parentElement.removeChildElement(flowNode)
        }

        return CleanupResult(removedElements)
    }

    data class CleanupResult(
        val removedElements: List<RemovedElement>
    ) {
        val hasRemovals: Boolean get() = removedElements.isNotEmpty()
    }

    data class RemovedElement(
        val elementId: String,
        val elementType: String,
        val elementName: String?
    )
}
