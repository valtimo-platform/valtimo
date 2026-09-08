/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.formflow

import com.ritense.authorization.AuthorizationContext
import com.ritense.document.exception.DocumentNotFoundException
import com.ritense.document.service.DocumentService
import com.ritense.logging.withLoggingContext
import com.ritense.processdocument.helper.GetJsonSchemaDocumentHelper.getJsonSchemaDocumentIdOrNull
import com.ritense.valtimo.operaton.domain.OperatonTask
import org.operaton.bpm.engine.RuntimeService

abstract class AbstractFormFlowLinkTaskProvider(
    protected val documentService: DocumentService,
    private val runtimeService: RuntimeService,
) {

    protected fun getAdditionalProperties(task: OperatonTask): Map<String, Any> {
        return withLoggingContext(OperatonTask::class, task.id) {
            val processInstance = runtimeService.createProcessInstanceQuery()
                .processInstanceId(task.getProcessInstanceId())
                .singleResult()

            val additionalProperties = mutableMapOf(
                PROCESS_INSTANCE_ID to task.getProcessInstanceId(),
                PROCESS_INSTANCE_BUSINESS_KEY to processInstance.businessKey,
                TASK_INSTANCE_ID to task.id
            )

            val documentId = task.getJsonSchemaDocumentIdOrNull()
            if (documentId != null) {
                try {
                    val document = AuthorizationContext.runWithoutAuthorization {
                        documentService[documentId.toString()]
                    }
                    if (document != null) {
                        additionalProperties[DOCUMENT_ID] = documentId.toString()
                    }
                } catch (_: DocumentNotFoundException) {
                    // we do nothing here, intentional
                }
            }

            additionalProperties
        }
    }

    companion object {
        const val FORM_FLOW_TASK_TYPE_KEY = "form-flow"

        // The keys of the additional properties that are available to SpEL expressions in a form
        // flow. These are also published through the form flow registry, so the editor can show
        // which context data a definition can rely on.
        const val PROCESS_INSTANCE_ID = "processInstanceId"
        const val PROCESS_INSTANCE_BUSINESS_KEY = "processInstanceBusinessKey"
        const val TASK_INSTANCE_ID = "taskInstanceId"
        const val DOCUMENT_ID = "documentId"
        const val PROCESS_DEFINITION_KEY = "processDefinitionKey"
        const val PROCESS_DEFINITION_ID = "processDefinitionId"
        const val DOCUMENT_DEFINITION_NAME = "documentDefinitionName"
    }

}
