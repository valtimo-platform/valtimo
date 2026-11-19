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

package com.ritense.buildingblock

import com.ritense.plugin.annotation.Plugin
import com.ritense.plugin.annotation.PluginAction
import com.ritense.processlink.domain.ActivityTypeWithEventName.SERVICE_TASK_START
import com.ritense.buildingblock.TestBpmnErrorPlugin.Companion.PLUGIN_KEY
import com.ritense.buildingblock.TestBpmnErrorPlugin.Companion.THROW_BPMN_ERROR
import com.ritense.buildingblock.TestBpmnErrorPlugin.Companion.THROW_RUNTIME_EXCEPTION
import com.ritense.processlink.domain.ActivityTypeWithEventName.USER_TASK_CREATE
import org.operaton.bpm.engine.delegate.BpmnError

@Plugin(
    key = PLUGIN_KEY,
    title = "Test BPMN error plugin",
    description = "Throws a BpmnError or a technical failure"
)
class TestBpmnErrorPlugin {

    @PluginAction(
        key = THROW_BPMN_ERROR,
        title = "Throw BPMN error",
        description = "Throws a BpmnError with error code $ERROR_CODE",
        activityTypes = [SERVICE_TASK_START, USER_TASK_CREATE]
    )
    fun throwBpmnError() {
        throw BpmnError(ERROR_CODE, "Business failure")
    }

    @PluginAction(
        key = THROW_RUNTIME_EXCEPTION,
        title = "Throw runtime exception",
        description = "Throws a technical failure",
        activityTypes = [SERVICE_TASK_START]
    )
    fun throwRuntimeException() {
        throw IllegalStateException("Technical failure")
    }

    companion object {
        const val PLUGIN_KEY = "test-bpmn-error-plugin"
        const val THROW_BPMN_ERROR = "throw-bpmn-error"
        const val THROW_RUNTIME_EXCEPTION = "throw-runtime-exception"
        const val ERROR_CODE = "TEST_ERROR"
    }
}
