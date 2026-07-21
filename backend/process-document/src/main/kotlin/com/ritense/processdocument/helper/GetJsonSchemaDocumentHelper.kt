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

package com.ritense.processdocument.helper

import com.ritense.valtimo.operaton.domain.OperatonExecution
import com.ritense.valtimo.operaton.domain.OperatonTask
import java.util.UUID
import org.operaton.bpm.engine.delegate.BaseDelegateExecution
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.operaton.bpm.engine.delegate.DelegateTask
import org.operaton.bpm.engine.delegate.VariableScope
import org.operaton.bpm.engine.externaltask.ExternalTask
import org.operaton.bpm.engine.externaltask.LockedExternalTask
import org.operaton.bpm.engine.history.HistoricCaseInstance
import org.operaton.bpm.engine.history.HistoricProcessInstance
import org.operaton.bpm.engine.runtime.CaseInstance
import org.operaton.bpm.engine.runtime.ProcessInstance

object GetJsonSchemaDocumentHelper {

    @JvmStatic
    fun VariableScope.getJsonSchemaDocumentId(): UUID = when (this) {
        is DelegateTask -> getJsonSchemaDocumentId()
        is DelegateExecution -> getJsonSchemaDocumentId()
        is BaseDelegateExecution -> getJsonSchemaDocumentId()
        is OperatonTask -> getJsonSchemaDocumentId()
        is OperatonExecution -> getJsonSchemaDocumentId()
        is ProcessInstance -> businessKey.toUUID()
        is HistoricProcessInstance -> businessKey.toUUID()
        is HistoricCaseInstance -> businessKey.toUUID()
        is CaseInstance -> businessKey.toUUID()
        is ExternalTask -> businessKey.toUUID()
        is LockedExternalTask -> businessKey.toUUID()
        else -> error("Failed to resolve document id" + joinToString("variableScope" to toString()))
    }

    @JvmStatic
    fun VariableScope.getJsonSchemaDocumentIdOrNull(): UUID? = when (this) {
        is DelegateTask -> getJsonSchemaDocumentIdOrNull()
        is DelegateExecution -> getJsonSchemaDocumentIdOrNull()
        is BaseDelegateExecution -> getJsonSchemaDocumentIdOrNull()
        is OperatonTask -> getJsonSchemaDocumentIdOrNull()
        is OperatonExecution -> getJsonSchemaDocumentIdOrNull()
        is ProcessInstance -> businessKey?.toUUIDOrNull()
        is HistoricProcessInstance -> businessKey?.toUUIDOrNull()
        is HistoricCaseInstance -> businessKey?.toUUIDOrNull()
        is CaseInstance -> businessKey?.toUUIDOrNull()
        is ExternalTask -> businessKey?.toUUIDOrNull()
        is LockedExternalTask -> businessKey?.toUUIDOrNull()
        else -> null
    }

    @JvmStatic
    fun OperatonExecution.getJsonSchemaDocumentId(): UUID = getJsonSchemaDocumentIdOrNull() ?: error(
        "Failed to resolve document id" + joinToString(
            "processInstanceId" to (processInstance?.id ?: id),
            "processDefinitionKey" to processDefinition?.key,
            "activityId" to activityId,
        )
    )

    @JvmStatic
    fun OperatonExecution.getJsonSchemaDocumentIdOrNull(): UUID? =
        businessKey?.toUUIDOrNull()
            ?: (if (superExecution != this) superExecution?.getJsonSchemaDocumentIdOrNull() else null)
            ?: (if (processInstance != this) processInstance?.getJsonSchemaDocumentIdOrNull() else null)
            ?: (if (parent != this) parent?.getJsonSchemaDocumentIdOrNull() else null)

    @JvmStatic
    fun DelegateExecution.getJsonSchemaDocumentId(): UUID = getJsonSchemaDocumentIdOrNull() ?: error(
        "Failed to resolve document id" + joinToString(
            "processInstanceId" to processInstanceId,
            "activityId" to currentActivityId,
            "activityName" to currentActivityName,
        )
    )

    @JvmStatic
    fun DelegateExecution.getJsonSchemaDocumentIdOrNull(): UUID? =
        businessKey?.toUUIDOrNull()
            ?: (if (superExecution != this) superExecution?.getJsonSchemaDocumentIdOrNull() else null)
            ?: (if (processInstance != this) processInstance?.getJsonSchemaDocumentIdOrNull() else null)

    @JvmStatic
    fun DelegateTask.getJsonSchemaDocumentId(): UUID = getJsonSchemaDocumentIdOrNull() ?: error(
        "Failed to resolve document id" + joinToString(
            "processInstanceId" to processInstanceId,
            "taskDefinitionKey" to taskDefinitionKey,
            "taskName" to name,
        )
    )

    @JvmStatic
    fun DelegateTask.getJsonSchemaDocumentIdOrNull(): UUID? = execution?.getJsonSchemaDocumentIdOrNull()

    @JvmStatic
    fun BaseDelegateExecution.getJsonSchemaDocumentId(): UUID = getJsonSchemaDocumentIdOrNull()
        ?: error("Failed to resolve document id" + joinToString("id" to id))

    @JvmStatic
    fun BaseDelegateExecution.getJsonSchemaDocumentIdOrNull(): UUID? = businessKey?.toUUIDOrNull()

    @JvmStatic
    fun OperatonTask.getJsonSchemaDocumentId(): UUID = getJsonSchemaDocumentIdOrNull() ?: error(
        "Failed to resolve document id" + joinToString(
            "processInstanceId" to (processInstance?.id ?: execution?.id),
            "processDefinitionKey" to processDefinition?.key,
            "taskDefinitionKey" to taskDefinitionKey,
            "taskName" to name,
        )
    )

    @JvmStatic
    fun OperatonTask.getJsonSchemaDocumentIdOrNull(): UUID? =
        (processInstance ?: execution)?.getJsonSchemaDocumentIdOrNull()

    @JvmStatic
    fun ProcessInstance.getJsonSchemaDocumentId(): UUID = getJsonSchemaDocumentIdOrNull()
        ?: error("Failed to resolve document id" + joinToString("processInstanceId" to processInstanceId))

    @JvmStatic
    fun ProcessInstance.getJsonSchemaDocumentIdOrNull(): UUID? = businessKey?.toUUIDOrNull()

    @JvmStatic
    fun HistoricProcessInstance.getJsonSchemaDocumentId(): UUID = getJsonSchemaDocumentIdOrNull() ?: error(
        "Failed to resolve document id" + joinToString(
            "HistoricProcessInstance id" to id,
            "processDefinitionKey" to processDefinitionKey,
        )
    )

    @JvmStatic
    fun HistoricProcessInstance.getJsonSchemaDocumentIdOrNull(): UUID? = businessKey?.toUUIDOrNull()

    @JvmStatic
    fun HistoricCaseInstance.getJsonSchemaDocumentId(): UUID = getJsonSchemaDocumentIdOrNull() ?: error(
        "Failed to resolve document id" + joinToString(
            "Operaton HistoricCaseInstance id" to id,
            "caseDefinitionKey" to caseDefinitionKey,
        )
    )

    @JvmStatic
    fun HistoricCaseInstance.getJsonSchemaDocumentIdOrNull(): UUID? = businessKey?.toUUIDOrNull()

    @JvmStatic
    fun CaseInstance.getJsonSchemaDocumentId(): UUID = getJsonSchemaDocumentIdOrNull()
        ?: error("Failed to resolve document id" + joinToString("Operaton CaseInstance id" to id))

    @JvmStatic
    fun CaseInstance.getJsonSchemaDocumentIdOrNull(): UUID? = businessKey?.toUUIDOrNull()

    @JvmStatic
    fun ExternalTask.getJsonSchemaDocumentId(): UUID = getJsonSchemaDocumentIdOrNull() ?: error(
        "Failed to resolve document id" + joinToString(
            "processInstanceId" to processInstanceId,
            "processDefinitionKey" to processDefinitionKey,
            "activityId" to activityId,
        )
    )

    @JvmStatic
    fun ExternalTask.getJsonSchemaDocumentIdOrNull(): UUID? = businessKey?.toUUIDOrNull()

    @JvmStatic
    fun LockedExternalTask.getJsonSchemaDocumentId(): UUID = getJsonSchemaDocumentIdOrNull() ?: error(
        "Failed to resolve document id" + joinToString(
            "processInstanceId" to processInstanceId,
            "processDefinitionKey" to processDefinitionKey,
            "activityId" to activityId,
        )
    )

    @JvmStatic
    fun LockedExternalTask.getJsonSchemaDocumentIdOrNull(): UUID? = businessKey?.toUUIDOrNull()

    private fun joinToString(vararg entries: Pair<String, String?>): String {
        val details = entries
            .filter { !it.second.isNullOrBlank() }
            .joinToString(", ") { "${it.first}: '${it.second}'" }
        return if (details.isEmpty()) "" else " $details"
    }

    private fun String?.toUUIDOrNull(): UUID? {
        return if (this != null && UUID_REGEX.matches(this)) {
            UUID.fromString(this)
        } else {
            null
        }
    }

    private fun String?.toUUID(): UUID = toUUIDOrNull() ?: error("Failed to parse UUID from '$this'.")

    const val UUID_REGEX_PATTERN = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
    @JvmField
    val UUID_REGEX = UUID_REGEX_PATTERN.toRegex()
}
