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

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.operaton.bpm.model.bpmn.Bpmn
import org.operaton.bpm.model.bpmn.instance.EndEvent
import org.operaton.bpm.model.bpmn.instance.FlowNode
import org.operaton.bpm.model.bpmn.instance.Process
import org.operaton.bpm.model.bpmn.instance.ServiceTask

class BpmnInvisibleOrphanCleanerTest {

    private lateinit var cleaner: BpmnInvisibleOrphanCleaner

    @BeforeEach
    fun setUp() {
        cleaner = BpmnInvisibleOrphanCleaner()
    }

    @Test
    fun `should remove element without BpmnShape`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("start")
            .endEvent("end")
            .done()

        val process = model.getModelElementsByType(Process::class.java).first()
        val orphanTask = model.newInstance(ServiceTask::class.java)
        orphanTask.id = "orphan-task"
        orphanTask.name = "Orphan Task"
        process.addChildElement(orphanTask)

        val result = cleaner.clean(model)

        assertThat(result.hasRemovals).isTrue()
        assertThat(result.removedElements).hasSize(1)
        assertThat(result.removedElements[0].elementId).isEqualTo("orphan-task")
        assertThat(result.removedElements[0].elementType).isEqualTo("serviceTask")
        assertThat(result.removedElements[0].elementName).isEqualTo("Orphan Task")

        val remainingNodes = model.getModelElementsByType(FlowNode::class.java)
        assertThat(remainingNodes.map { it.id }).containsExactlyInAnyOrder("start", "end")
    }

    @Test
    fun `should remove multiple disconnected orphan elements`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("start")
            .endEvent("end")
            .done()

        val process = model.getModelElementsByType(Process::class.java).first()

        val orphanTask = model.newInstance(ServiceTask::class.java)
        orphanTask.id = "orphan-task"
        process.addChildElement(orphanTask)

        val orphanEnd = model.newInstance(EndEvent::class.java)
        orphanEnd.id = "orphan-end"
        process.addChildElement(orphanEnd)

        val result = cleaner.clean(model)

        assertThat(result.hasRemovals).isTrue()
        assertThat(result.removedElements.map { it.elementId })
            .containsExactlyInAnyOrder("orphan-task", "orphan-end")

        val remainingNodes = model.getModelElementsByType(FlowNode::class.java)
        assertThat(remainingNodes.map { it.id }).containsExactlyInAnyOrder("start", "end")
    }

    @Test
    fun `should not remove elements with BpmnShape`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("start")
            .serviceTask("visible-task").operatonExpression("\${true}")
            .endEvent("end")
            .done()

        val result = cleaner.clean(model)

        assertThat(result.hasRemovals).isFalse()
        assertThat(result.removedElements).isEmpty()

        val remainingNodes = model.getModelElementsByType(FlowNode::class.java)
        assertThat(remainingNodes.map { it.id }).containsExactlyInAnyOrder("start", "visible-task", "end")
    }

    @Test
    fun `should return empty result when no orphans exist`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("start")
            .endEvent("end")
            .done()

        val result = cleaner.clean(model)

        assertThat(result.hasRemovals).isFalse()
        assertThat(result.removedElements).isEmpty()
    }

    @Test
    fun `should remove multiple orphan elements`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("start")
            .endEvent("end")
            .done()

        val process = model.getModelElementsByType(Process::class.java).first()

        val orphan1 = model.newInstance(ServiceTask::class.java)
        orphan1.id = "orphan-1"
        process.addChildElement(orphan1)

        val orphan2 = model.newInstance(ServiceTask::class.java)
        orphan2.id = "orphan-2"
        process.addChildElement(orphan2)

        val orphan3 = model.newInstance(EndEvent::class.java)
        orphan3.id = "orphan-3"
        process.addChildElement(orphan3)

        val result = cleaner.clean(model)

        assertThat(result.hasRemovals).isTrue()
        assertThat(result.removedElements).hasSize(3)
        assertThat(result.removedElements.map { it.elementId })
            .containsExactlyInAnyOrder("orphan-1", "orphan-2", "orphan-3")
    }
}
