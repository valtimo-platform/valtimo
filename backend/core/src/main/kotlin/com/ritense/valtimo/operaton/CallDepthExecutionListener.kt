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

package com.ritense.valtimo.operaton

import com.ritense.valtimo.contract.config.ValtimoProperties
import com.ritense.valtimo.event.OperatonExecutionEvent
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.slf4j.LoggerFactory
import org.springframework.context.event.EventListener

class CallDepthExecutionListener(
    private val valtimoProperties: ValtimoProperties,
) {

    @EventListener(
        condition = """#event.delegateExecution.bpmnModelElementInstance != null
            && #event.delegateExecution.bpmnModelElementInstance.elementType.typeName == T(org.operaton.bpm.engine.ActivityTypes).START_EVENT
            && #event.eventName == T(org.operaton.bpm.engine.delegate.ExecutionListener).EVENTNAME_START
        """
    )
    fun onProcessStart(event: OperatonExecutionEvent) {
        val execution = event.delegateExecution
        val initialSuperExecution = execution.processInstance?.superExecution
        if (initialSuperExecution != null) {
            val parentDepth = findAndSetParentDepthIfNotPresent(initialSuperExecution)

            val callDepthWarningThreshold = valtimoProperties.process.callDepthWarningThreshold
            if (parentDepth >= callDepthWarningThreshold) {
                logger.warn(
                    "Call depth for process with business key '{}' has exceeded {}. Current call depth: {}. " +
                        "Consider stopping the corresponding case or building block.",
                    execution.processBusinessKey,
                    callDepthWarningThreshold,
                    parentDepth + 1
                )
            }
            execution.setVariableLocal(CALL_DEPTH_VARIABLE, parentDepth + 1)
            return
        }

        if (execution.getVariableLocal(CALL_DEPTH_VARIABLE) == null) {
            execution.setVariableLocal(CALL_DEPTH_VARIABLE, DEFAULT_CALL_DEPTH)
        }
    }

    private fun findAndSetParentDepthIfNotPresent(
        execution: DelegateExecution,
    ): Int {
        val parentDepth = toInt(execution.getVariableLocal(CALL_DEPTH_VARIABLE))
        if (parentDepth != null) {
            return parentDepth
        }

        val superExecution = execution.processInstance?.superExecution
        return if (superExecution != null) {
            var depth = findAndSetParentDepthIfNotPresent(superExecution)
            if (superExecution.processInstance.processInstanceId != execution.processInstance.processInstanceId) {
                ++depth
            }
            execution.setVariableLocal(CALL_DEPTH_VARIABLE, depth)
            depth
        } else {
            execution.setVariableLocal(CALL_DEPTH_VARIABLE, DEFAULT_CALL_DEPTH)
            DEFAULT_CALL_DEPTH
        }
    }

    private fun toInt(value: Any?): Int? {
        return when (value) {
            is Number -> value.toInt()
            is String -> value.toIntOrNull()
            else -> null
        }
    }

    companion object {
        private val logger = LoggerFactory.getLogger(CallDepthExecutionListener::class.java)
        const val CALL_DEPTH_VARIABLE = "VTM_callDepth"
        private const val DEFAULT_CALL_DEPTH = 0
    }
}
