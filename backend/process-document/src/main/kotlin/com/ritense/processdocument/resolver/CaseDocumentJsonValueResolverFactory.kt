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

package com.ritense.processdocument.resolver

import com.fasterxml.jackson.core.JsonPointer
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.NullNode
import com.fasterxml.jackson.databind.node.ObjectNode
import com.jayway.jsonpath.InvalidPathException
import com.jayway.jsonpath.JsonPath
import com.jayway.jsonpath.PathNotFoundException
import com.jayway.jsonpath.internal.path.PathCompiler
import com.ritense.authorization.AuthorizationContext
import com.ritense.document.config.DocumentProperties
import com.ritense.document.domain.Document
import com.ritense.document.domain.NullWriteStrategy
import com.ritense.document.domain.collectValueResolverOptions
import com.ritense.document.domain.determineNullWriteStrategy
import com.ritense.document.domain.impl.JsonDocumentContent
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.domain.patch.JsonPatchFilterFlag.allowRemovalOperations
import com.ritense.document.domain.patch.JsonPatchFilterFlag.defaultPatchFlags
import com.ritense.document.domain.patch.JsonPatchService
import com.ritense.document.exception.ModifyDocumentException
import com.ritense.document.exception.UnknownDocumentDefinitionException
import com.ritense.document.service.DocumentService
import com.ritense.document.service.impl.JsonSchemaDocumentDefinitionService
import com.ritense.processdocument.domain.impl.OperatonProcessInstanceId
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.json.patch.JsonPatchBuilder
import com.ritense.valueresolver.ValueResolverFactory
import com.ritense.valueresolver.ValueResolverOption
import com.ritense.valueresolver.exception.ValueResolverValidationException
import org.everit.json.schema.Schema
import org.operaton.bpm.engine.delegate.VariableScope
import org.springframework.dao.OptimisticLockingFailureException
import java.util.UUID
import java.util.function.Function
import kotlin.random.Random

/**
 * This resolver can resolve requestedValues against the Document JSON content
 *
 * The value of the requestedValue should be in the format doc:some.json.path
 */
class CaseDocumentJsonValueResolverFactory(
    private val processDocumentService: ProcessDocumentService,
    private val documentService: DocumentService,
    private val documentDefinitionService: JsonSchemaDocumentDefinitionService,
    private val objectMapper: ObjectMapper,
    private val documentProperties: DocumentProperties,
) : ValueResolverFactory {

    override fun supportedPrefix(): String {
        return PREFIX
    }

    override fun createResolver(
        processInstanceId: String,
        variableScope: VariableScope
    ): Function<String, Any?> {
        val document = processDocumentService.getDocument(OperatonProcessInstanceId(processInstanceId), variableScope)
        return createResolver(document)
    }

    override fun createValidator(documentDefinitionName: String): Function<String, Unit> {
        val documentDefinition = documentDefinitionService.findActiveByName(documentDefinitionName)
            .orElseThrow { UnknownDocumentDefinitionException(documentDefinitionName) }

        return Function { requestedValue ->
            if (isJsonPointer(requestedValue)) {
                validateJsonPointer(documentDefinition, requestedValue)
            } else {
                validateJsonPath(documentDefinition, requestedValue)
            }
        }
    }

    override fun createResolver(documentId: String): Function<String, Any?> {
        return createResolver(
            AuthorizationContext.runWithoutAuthorization { documentService.get(documentId) }
        )
    }

    override fun handleValues(
        processInstanceId: String,
        variableScope: VariableScope?,
        values: Map<String, Any?>
    ) {
        if (documentProperties.locking.valueResolver.isPessimisticEnabled) {
            handleValuesWithAtomicUpdate(processInstanceId, variableScope, values)
        } else {
            handleValuesWithOptimisticRetry(processInstanceId, variableScope, values)
        }
    }

    private fun handleValuesWithAtomicUpdate(
        processInstanceId: String,
        variableScope: VariableScope?,
        values: Map<String, Any?>
    ) {
        val documentId = AuthorizationContext.runWithoutAuthorization {
            processDocumentService.getDocumentId(OperatonProcessInstanceId(processInstanceId), variableScope)
        }

        AuthorizationContext.runWithoutAuthorization {
            documentService.modifyDocumentAtomic(documentId) { lockedDocument ->
                val jsonSchemaDoc = lockedDocument as JsonSchemaDocument
                val documentDefinition = documentDefinitionService.findBy(jsonSchemaDoc.definitionId()).orElseThrow()
                val documentContent = lockedDocument.content().asJson()
                buildJsonPatch(documentContent, values) { documentDefinition.schema.schema }

                val modifiedContent = JsonDocumentContent.build(
                    jsonSchemaDoc.content().asJson(),
                    documentContent,
                    null
                )
                val result = jsonSchemaDoc.applyModifiedContent(modifiedContent, documentDefinition)
                result.resultingDocument().orElseThrow()
            }
        }
    }

    private fun handleValuesWithOptimisticRetry(
        processInstanceId: String,
        variableScope: VariableScope?,
        values: Map<String, Any?>
    ) {
        var attempt = 0
        val maxAttempts = 3

        while (attempt < maxAttempts) {
            try {
                val document = AuthorizationContext.runWithoutAuthorization {
                    processDocumentService.getDocument(OperatonProcessInstanceId(processInstanceId), variableScope)
                }
                val documentContent = document.content().asJson()
                buildJsonPatch(documentContent, values) { getSchema(document) }

                //TODO: PBAC MODIFY check
                AuthorizationContext.runWithoutAuthorization {
                    documentService.modifyDocument(document, documentContent)
                }
                return // Success, exit retry loop
            } catch (exception: ModifyDocumentException) {
                val cause = exception.cause
                if (cause is OptimisticLockingFailureException && attempt < maxAttempts - 1) {
                    attempt++
                    val delayMs = (50 * (1 shl attempt)) + Random.nextInt(50) // Exponential backoff with jitter
                    Thread.sleep(delayMs.toLong())
                } else {
                    throw RuntimeException(
                        "Failed to handle values for processInstance '$processInstanceId'. Values: ${values}. Attempts: ${attempt + 1}",
                        exception
                    )
                }
            }
        }
    }

    override fun handleValues(documentId: UUID, values: Map<String, Any?>) {
        if (documentProperties.locking.valueResolver.isPessimisticEnabled) {
            handleValuesWithAtomicUpdate(documentId, values)
        } else {
            handleValuesWithOptimisticRetry(documentId, values)
        }
    }

    private fun handleValuesWithAtomicUpdate(documentId: UUID, values: Map<String, Any?>) {
        AuthorizationContext.runWithoutAuthorization {
            documentService.modifyDocumentAtomic(JsonSchemaDocumentId.existingId(documentId)) { lockedDocument ->
                // Return the document with modified content
                val jsonSchemaDoc = lockedDocument as JsonSchemaDocument
                val documentDefinition = documentDefinitionService.findBy(jsonSchemaDoc.definitionId()).orElseThrow()
                val documentContent = lockedDocument.content().asJson()
                buildJsonPatch(documentContent, values) { documentDefinition.schema.schema }

                val modifiedContent = JsonDocumentContent.build(
                    jsonSchemaDoc.content().asJson(),
                    documentContent,
                    null
                )
                val result = jsonSchemaDoc.applyModifiedContent(modifiedContent, documentDefinition)
                result.resultingDocument().orElseThrow()
            }
        }
    }

    private fun handleValuesWithOptimisticRetry(documentId: UUID, values: Map<String, Any?>) {
        var attempt = 0
        val maxAttempts = 3

        while (attempt < maxAttempts) {
            try {
                val document = AuthorizationContext.runWithoutAuthorization { documentService.get(documentId.toString()) }
                val documentContent = document.content().asJson()
                buildJsonPatch(documentContent, values) { getSchema(document) }

                AuthorizationContext.runWithoutAuthorization { documentService.modifyDocument(document, documentContent) }
                return // Success, exit retry loop
            } catch (exception: ModifyDocumentException) {
                val cause = exception.cause
                if (cause is OptimisticLockingFailureException && attempt < maxAttempts - 1) {
                    attempt++
                    val delayMs = (50 * (1 shl attempt)) + Random.nextInt(50) // Exponential backoff with jitter
                    Thread.sleep(delayMs.toLong())
                } else {
                    throw RuntimeException(
                        "Failed to handle values for document '$documentId'. Values: ${values}. Attempts: ${attempt + 1}",
                        exception
                    )
                }
            }
        }
    }

    @Deprecated("Replaced by preProcessValuesForNewDocument", level = DeprecationLevel.WARNING)
    override fun preProcessValuesForNewCase(values: Map<String, Any?>): ObjectNode {
        val emptyDocumentContent = objectMapper.createObjectNode()
        buildJsonPatch(emptyDocumentContent, values)
        return emptyDocumentContent
    }

    override fun preProcessValuesForNewDocument(values: Map<String, Any?>, documentDefinitionName: String): ObjectNode {
        val emptyDocumentContent = objectMapper.createObjectNode()
        // Resolve the schema so 'null' values are written according to what the definition allows. When the
        // definition can't be found we fall back to the legacy behavior of always writing JSON null.
        val definition = documentDefinitionService.findActiveByName(documentDefinitionName).orElse(null)
        buildJsonPatch(emptyDocumentContent, values) { definition?.schema?.schema }
        return emptyDocumentContent
    }

    override fun getResolvableKeyOptions(caseDefinitionId: CaseDefinitionId): List<ValueResolverOption> {
        val documentDefinition = documentDefinitionService.findByBlueprintId(caseDefinitionId).orElseThrow()
        return documentDefinition.schema.schema.collectValueResolverOptions("$PREFIX:")
    }

    override fun getResolvableKeyOptions(caseDefinitionKey: String): List<ValueResolverOption> {
        val documentDefinition = documentDefinitionService.findActiveByName(caseDefinitionKey).orElseThrow()
        return documentDefinition.schema.schema.collectValueResolverOptions("$PREFIX:")
    }

    override fun getResolvableKeyOptions(blueprintId: BlueprintId): List<ValueResolverOption> {
        val documentDefinition = documentDefinitionService.findByBlueprintId(blueprintId).orElseThrow()
        return documentDefinition.schema.schema.collectValueResolverOptions("$PREFIX:")
    }

    /**
     * @param schemaSupplier resolves the document schema, used to decide how to write 'null' values.
     * It is only invoked when a null value is actually encountered (and may return null to keep the
     * legacy behavior of always writing JSON null, e.g. for a not-yet-existing case).
     */
    private fun buildJsonPatch(
        jsonNode: JsonNode,
        values: Map<String, Any?>,
        schemaSupplier: () -> Schema? = { null }
    ) {
        val schema by lazy(schemaSupplier)
        values.forEach {
            val jsonPointer = toJsonPointer(it.key.substringAfter(":"))
            val jsonPatchBuilder = JsonPatchBuilder()
            // 'schema' (lazy) is only resolved when a null value is actually written
            val isRemoval = if (it.value == null) {
                applyNullValue(jsonNode, jsonPointer, schema, jsonPatchBuilder, it.key)
            } else {
                jsonPatchBuilder.addJsonNodeValue(jsonNode, jsonPointer, toValueNode(it.value))
                false
            }
            // removals are skipped by the default flags, so they need to be explicitly allowed
            val flags = if (isRemoval) allowRemovalOperations() else defaultPatchFlags()
            JsonPatchService.apply(jsonPatchBuilder.build(), jsonNode, flags)
        }
    }

    /**
     * Writes a 'null' value depending on what the document [schema] allows at [jsonPointer]:
     * write JSON null when null is allowed, remove the node when null is not allowed but the
     * property is not required, otherwise fail. When [schema] is null the legacy behavior of always
     * writing JSON null is kept. Returns true when a remove operation was added to [jsonPatchBuilder].
     */
    private fun applyNullValue(
        jsonNode: JsonNode,
        jsonPointer: JsonPointer,
        schema: Schema?,
        jsonPatchBuilder: JsonPatchBuilder,
        key: String,
    ): Boolean {
        val strategy = schema?.determineNullWriteStrategy(jsonPointer.toString()) ?: NullWriteStrategy.WRITE_NULL
        return when (strategy) {
            NullWriteStrategy.WRITE_NULL -> {
                jsonPatchBuilder.addJsonNodeValue(jsonNode, jsonPointer, NullNode.instance)
                false
            }

            NullWriteStrategy.REMOVE -> {
                val exists = !jsonNode.at(jsonPointer).isMissingNode
                if (exists) {
                    jsonPatchBuilder.remove(jsonPointer)
                }
                exists
            }

            NullWriteStrategy.NOT_ALLOWED ->
                throw IllegalStateException(
                    "Cannot write 'null' to '$key': the document schema does not allow null at this " +
                        "location and the property is required, so the node cannot be removed."
                )
        }
    }

    private fun getSchema(document: Document): Schema {
        val jsonSchemaDocument = document as JsonSchemaDocument
        return documentDefinitionService.findBy(jsonSchemaDocument.definitionId()).orElseThrow().schema.schema
    }

    private fun toJsonPointer(path: String): JsonPointer {
        var newPath: String = path
        if (!path.startsWith('/')) {
            newPath = "/${path}"
        }
        return JsonPointer.valueOf(newPath.replace('.', '/'))
    }

    private fun validateJsonPointer(documentDefinition: JsonSchemaDocumentDefinition, jsonPointer: String) {
        if (!documentDefinition.schema.schema.definesProperty(jsonPointer)) {
            throw ValueResolverValidationException(
                "JsonPointer '$jsonPointer' doesn't point to any property inside document definition '${documentDefinition.id.name()}'"
            )
        }
    }

    private fun validateJsonPath(documentDefinition: JsonSchemaDocumentDefinition, jsonPathPostfix: String) {
        val jsonPath = "$.$jsonPathPostfix"
        try {
            PathCompiler.compile(jsonPath)
        } catch (e: InvalidPathException) {
            throw ValueResolverValidationException(
                "Failed to compile JsonPath '$jsonPath' for document definition '${documentDefinition.id.name()}'",
                e
            )
        }
        if (!documentDefinitionService.isValidJsonPath(documentDefinition, jsonPath)) {
            throw ValueResolverValidationException(
                "JsonPath '$jsonPath' doesn't point to any property inside document definition '${documentDefinition.id.name()}'"
            )
        }
    }

    private fun createResolver(document: Document): Function<String, Any?> {
        return Function { requestedValue ->
            if (isJsonPointer(requestedValue)) {
                resolveForJsonPointer(document, requestedValue)
            } else {
                resolveForJsonPath(document, requestedValue)
            }
        }
    }

    private fun isJsonPointer(path: String) = path.startsWith("/")

    private fun resolveForJsonPointer(document: Document, jsonPointer: String): Any? {
        val node = document.content().getValueBy(JsonPointer.valueOf(jsonPointer)).orElse(null)
        return if (node == null || node.isMissingNode || node.isNull) {
            null
        } else if (node.isValueNode || node.isArray || node.isObject) {
            objectMapper.treeToValue(node, Object::class.java)
        } else {
            node.asText()
        }
    }

    private fun resolveForJsonPath(document: Document, jsonPathPostfix: String): Any? {
        return try {
            JsonPath.read<Any?>(document.content().asJson().toString(), "$.$jsonPathPostfix")
        } catch (ignore: PathNotFoundException) {
            null
        }
    }

    private fun toValueNode(value: Any?): JsonNode {
        return if (value == null) {
            NullNode.instance
        } else {
            objectMapper.valueToTree(value)
        }
    }

    companion object {
        const val PREFIX = "doc"
    }

}
