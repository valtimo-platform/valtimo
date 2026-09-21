/*
 *  Copyright 2015-2024 Ritense BV, the Netherlands.
 *
 *  Licensed under EUPL, Version 1.2 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" basis,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package com.ritense.formflow.service

import com.fasterxml.jackson.core.JsonPointer
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.MissingNode
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.Document
import com.ritense.document.domain.patch.JsonPatchService
import com.ritense.document.service.DocumentService
import com.ritense.form.domain.FormIoFormDefinition
import com.ritense.form.domain.submission.formfield.FormField
import com.ritense.form.service.impl.FormIoFormDefinitionService
import com.ritense.formflow.domain.definition.configuration.step.FormStepTypeProperties
import com.ritense.formflow.domain.instance.FormFlowInstance
import com.ritense.formflow.domain.instance.FormFlowStepInstance
import com.ritense.logging.withLoggingContext
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.json.patch.JsonPatchBuilder
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.context.ApplicationEventPublisher
import org.springframework.stereotype.Service
import java.util.UUID
import kotlin.jvm.optionals.getOrNull

@Service
@SkipComponentScan
class FormFlowValtimoService(
    private val formDefinitionService: FormIoFormDefinitionService,
    private val objectMapper: ObjectMapper,
    private val documentService: DocumentService,
    private val applicationEventPublisher: ApplicationEventPublisher,
    private val doSubmissionDataFiltering: Boolean
) {
    constructor(
        formDefinitionService: FormIoFormDefinitionService,
        objectMapper: ObjectMapper,
        documentService: DocumentService,
        applicationEventPublisher: ApplicationEventPublisher
    ) : this(formDefinitionService, objectMapper, documentService, applicationEventPublisher, true)

    fun getVerifiedSubmissionData(submissionData: JsonNode?, formFlowInstance: FormFlowInstance): JsonNode? {
        return withLoggingContext(FormFlowInstance::class, formFlowInstance.id) {
            if (submissionData == null) {
                return@withLoggingContext null
            }

            val currentStepTypeProperties = formFlowInstance.getCurrentStep().definition.type.properties
            if (currentStepTypeProperties !is FormStepTypeProperties || !doSubmissionDataFiltering) {
                return@withLoggingContext submissionData
            }

            val jsonPatchBuilder = JsonPatchBuilder()
            val verifiedSubmissionData = objectMapper.createObjectNode()

            val validJsonPointers = getFormDefinition(formFlowInstance, currentStepTypeProperties.definition)
                .inputFields
                .mapNotNull { field -> FormIoFormDefinition.getKey(field).getOrNull() }
                .map { fieldKey -> JsonPointer.valueOf("/${fieldKey.replace('.', '/')}") }

            validJsonPointers.forEach { validJsonPointer ->
                val verifiedSubmissionNode = submissionData.at(validJsonPointer)
                if (verifiedSubmissionNode !is MissingNode) {
                    jsonPatchBuilder.addJsonNodeValue(verifiedSubmissionData, validJsonPointer, verifiedSubmissionNode)
                }
            }

            JsonPatchService.apply(jsonPatchBuilder.build(), verifiedSubmissionData)

            verifiedSubmissionData
        }
    }

    fun attachSubmittedFilesToCase(formFlowInstance: FormFlowInstance, onCompleteResult: List<Any>) {
        withLoggingContext(FormFlowInstance::class, formFlowInstance.id) {
            val documentId = resolveDocumentId(formFlowInstance, onCompleteResult)
            if (documentId == null) {
                logger.debug { "Form flow ended without a document. Nothing to add to a case." }
                return@withLoggingContext
            }

            val document = runWithoutAuthorization { documentService.get(documentId.toString()) }
            formFlowInstance.getHistory()
                .sortedBy { it.submissionOrder }
                .forEach { stepInstance -> attachSubmittedFiles(stepInstance, document) }
        }
    }

    private fun attachSubmittedFiles(stepInstance: FormFlowStepInstance, document: Document) {
        val stepTypeProperties = stepInstance.definition.type.properties as? FormStepTypeProperties ?: return
        val submissionData = stepInstance.getCurrentSubmissionData() ?: return

        val formDefinition = getFormDefinition(stepInstance.instance, stepTypeProperties.definition)
        FormField.getFormFields(formDefinition, objectMapper.readTree(submissionData), applicationEventPublisher)
            .forEach { formField -> formField.postProcess(document) }
    }

    private fun resolveDocumentId(formFlowInstance: FormFlowInstance, onCompleteResult: List<Any>): UUID? {
        val createdDocumentId = onCompleteResult
            .filterIsInstance<Map<*, *>>()
            .firstNotNullOfOrNull { it[DOCUMENT_ID_PROPERTY] }

        return (createdDocumentId ?: formFlowInstance.getAdditionalProperties()[DOCUMENT_ID_PROPERTY])?.toUuidOrNull()
    }

    private fun getFormDefinition(formFlowInstance: FormFlowInstance, definitionName: String): FormIoFormDefinition {
        val blueprintId = formFlowInstance.formFlowDefinition.id.blueprintId
        val resolvedId: BlueprintId = blueprintId.asBuildingBlockDefinitionId()
            ?: blueprintId.asCaseDefinitionId()
            ?: throw IllegalStateException("Cannot resolve blueprint id for form '$definitionName'")
        return formDefinitionService.getFormDefinitionByName(definitionName, resolvedId).orElseThrow()
    }

    private fun Any.toUuidOrNull(): UUID? = when (this) {
        is UUID -> this
        is String -> try {
            UUID.fromString(this)
        } catch (_: IllegalArgumentException) {
            logger.warn { "Failed to parse document id '$this' of a form flow." }
            null
        }

        else -> null
    }

    companion object {
        private val logger = KotlinLogging.logger {}

        private const val DOCUMENT_ID_PROPERTY = "documentId"
    }
}
