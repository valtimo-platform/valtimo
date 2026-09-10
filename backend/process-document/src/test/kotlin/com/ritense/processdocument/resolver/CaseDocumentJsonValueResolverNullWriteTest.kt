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

package com.ritense.processdocument.resolver

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.node.MissingNode
import com.fasterxml.jackson.databind.node.NullNode
import com.fasterxml.jackson.databind.node.TextNode
import com.ritense.document.config.DocumentProperties
import com.ritense.document.domain.impl.JsonDocumentContent
import com.ritense.document.domain.impl.JsonSchema
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.service.DocumentService
import com.ritense.document.service.impl.JsonSchemaDocumentDefinitionService
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.valueresolver.exception.ValueResolverValidationException
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.Optional
import java.util.UUID

internal class CaseDocumentJsonValueResolverNullWriteTest {

    private lateinit var documentService: DocumentService
    private lateinit var documentDefinitionService: JsonSchemaDocumentDefinitionService
    private lateinit var resolver: CaseDocumentJsonValueResolverFactory

    private lateinit var documentId: UUID
    private lateinit var document: JsonSchemaDocument

    @BeforeEach
    fun setUp() {
        documentService = mock()
        documentDefinitionService = mock()
        resolver = CaseDocumentJsonValueResolverFactory(
            mock<ProcessDocumentService>(),
            documentService,
            documentDefinitionService,
            MapperSingleton.get(),
            DocumentProperties(null)
        )

        documentId = UUID.randomUUID()
        document = mock()
        whenever(documentService.get(documentId.toString())).thenReturn(document)
    }

    @Test
    fun `should write null when the schema allows null`() {
        mockDocument(
            schemaProperties = """"middleName": { "type": ["string", "null"] }""",
            content = """{"middleName":"Peter"}"""
        )

        resolver.handleValues(documentId, mapOf("doc:/middleName" to null))

        assertThat(capturedContent().at("/middleName")).isEqualTo(NullNode.instance)
    }

    @Test
    fun `should remove the node when null is not allowed but the property is optional`() {
        mockDocument(
            schemaProperties = """"firstName": { "type": "string" }""",
            content = """{"firstName":"John"}"""
        )

        resolver.handleValues(documentId, mapOf("doc:/firstName" to null))

        assertThat(capturedContent().at("/firstName")).isEqualTo(MissingNode.getInstance())
    }

    @Test
    fun `should be a no-op when removing an already absent optional node`() {
        mockDocument(
            schemaProperties = """"firstName": { "type": "string" }""",
            content = """{}"""
        )

        resolver.handleValues(documentId, mapOf("doc:/firstName" to null))

        assertThat(capturedContent().at("/firstName")).isEqualTo(MissingNode.getInstance())
    }

    @Test
    fun `should throw when null is not allowed and the property is required`() {
        mockDocument(
            schemaProperties = """"firstName": { "type": "string" }""",
            required = """"firstName"""",
            content = """{"firstName":"John"}"""
        )

        assertThatThrownBy { resolver.handleValues(documentId, mapOf("doc:/firstName" to null)) }
            .isInstanceOf(ValueResolverValidationException::class.java)
            .hasMessageContaining("doc:/firstName")

        verify(documentService, never()).modifyDocument(eq(document), any())
    }

    @Test
    fun `should write nothing at all when one of several values is refused`() {
        mockDocument(
            schemaProperties = """"firstName": { "type": "string" }, "lastName": { "type": "string" }""",
            required = """"lastName"""",
            content = """{"firstName":"John","lastName":"Doe"}"""
        )

        assertThatThrownBy {
            resolver.handleValues(documentId, mapOf("doc:/firstName" to null, "doc:/lastName" to null))
        }.isInstanceOf(ValueResolverValidationException::class.java)
            .hasMessageContaining("doc:/lastName")

        verify(documentService, never()).modifyDocument(eq(document), any())
    }

    @Test
    fun `should apply a mix of null and non-null values in one call`() {
        mockDocument(
            schemaProperties = """"firstName": { "type": "string" }, "lastName": { "type": "string" }""",
            content = """{"firstName":"John","lastName":"Doe"}"""
        )

        resolver.handleValues(documentId, mapOf("doc:/firstName" to null, "doc:/lastName" to "Lovelace"))

        val content = capturedContent()
        assertThat(content.at("/firstName")).isEqualTo(MissingNode.getInstance())
        assertThat(content.at("/lastName")).isEqualTo(TextNode.valueOf("Lovelace"))
    }

    @Test
    fun `should write null for a path the schema does not describe`() {
        mockDocument(
            schemaProperties = """"firstName": { "type": "string" }""",
            content = """{"extra":{"child":"value"}}"""
        )

        resolver.handleValues(documentId, mapOf("doc:/extra/child" to null))

        assertThat(capturedContent().at("/extra/child")).isEqualTo(NullNode.instance)
    }

    @Test
    fun `should write null for an array element, which its parent has no say over`() {
        mockDocument(
            schemaProperties = """"items": { "type": "array", "items": { "type": "string" } }""",
            content = """{"items":["a","b"]}"""
        )

        resolver.handleValues(documentId, mapOf("doc:/items/0" to null))

        val content = capturedContent()
        assertThat(content.at("/items/0")).isEqualTo(NullNode.instance)
        assertThat(content.at("/items/1")).isEqualTo(TextNode.valueOf("b"))
    }

    @Test
    fun `preProcessValuesForNewDocument should write null when the schema allows null`() {
        mockActiveDefinition(""""middleName": { "type": ["string", "null"] }""")

        val content = resolver.preProcessValuesForNewDocument(mapOf("doc:/middleName" to null), "test")

        assertThat(content.at("/middleName")).isEqualTo(NullNode.instance)
    }

    @Test
    fun `preProcessValuesForNewDocument should omit the node when null is not allowed but the property is optional`() {
        mockActiveDefinition(""""firstName": { "type": "string" }""")

        val content = resolver.preProcessValuesForNewDocument(mapOf("doc:/firstName" to null), "test")

        assertThat(content.at("/firstName")).isEqualTo(MissingNode.getInstance())
    }

    @Test
    fun `preProcessValuesForNewDocument should throw when null is not allowed and the property is required`() {
        mockActiveDefinition(""""firstName": { "type": "string" }""", required = """"firstName"""")

        assertThatThrownBy { resolver.preProcessValuesForNewDocument(mapOf("doc:/firstName" to null), "test") }
            .isInstanceOf(ValueResolverValidationException::class.java)
            .hasMessageContaining("doc:/firstName")
    }

    @Test
    fun `preProcessValuesForNewDocument should write non-null values`() {
        mockActiveDefinition(""""firstName": { "type": "string" }""")

        val content = resolver.preProcessValuesForNewDocument(mapOf("doc:/firstName" to "John"), "test")

        assertThat(content.at("/firstName")).isEqualTo(TextNode.valueOf("John"))
    }

    @Test
    fun `preProcessValuesForNewDocument should fall back to writing null when the definition is unknown`() {
        whenever(documentDefinitionService.findActiveByName("unknown")).thenReturn(Optional.empty())

        val content = resolver.preProcessValuesForNewDocument(mapOf("doc:/firstName" to null), "unknown")

        assertThat(content.at("/firstName")).isEqualTo(NullNode.instance)
    }

    private val definitionId = JsonSchemaDocumentDefinitionId.of("test", CaseDefinitionId("test", "1.0.0"))

    private fun buildDefinition(schemaProperties: String, required: String?): JsonSchemaDocumentDefinition {
        val requiredLine = required?.let { """"required": [$it],""" }.orEmpty()
        val schema = JsonSchema.fromString(
            """
            {
              "${'$'}id": "test.schema",
              "${'$'}schema": "http://json-schema.org/draft-07/schema#",
              "type": "object",
              $requiredLine
              "properties": { $schemaProperties }
            }
            """.trimIndent()
        )
        return JsonSchemaDocumentDefinition(definitionId, schema)
    }

    private fun mockDocument(schemaProperties: String, required: String? = null, content: String) {
        val definition = buildDefinition(schemaProperties, required)
        whenever(document.content()).thenReturn(JsonDocumentContent(content))
        whenever(document.definitionId()).thenReturn(definitionId)
        whenever(documentDefinitionService.findBy(definitionId)).thenReturn(Optional.of(definition))
    }

    private fun mockActiveDefinition(schemaProperties: String, required: String? = null) {
        whenever(documentDefinitionService.findActiveByName("test"))
            .thenReturn(Optional.of(buildDefinition(schemaProperties, required)))
    }

    private fun capturedContent(): JsonNode {
        val captor = argumentCaptor<JsonNode>()
        verify(documentService).modifyDocument(eq(document), captor.capture())
        return captor.firstValue
    }
}
