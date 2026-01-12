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

package com.ritense.document.service

import com.ritense.document.domain.JsonSchemaDocumentDefinitionBlueprintType
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.document.BlueprintCaseDocumentResolver
import com.ritense.valtimo.contract.document.CaseDocumentResolutionException
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals

class DefaultCaseDocumentResolverTest {

    private val documentService: DocumentService = mock()
    private val moduleResolver: BlueprintCaseDocumentResolver = mock()
    private val resolver = DefaultCaseDocumentResolver(
        documentService,
        listOf(moduleResolver)
    )

    @Test
    fun `returns document id for case documents`() {
        val documentId = UUID.randomUUID()
        val document = createDocument(documentId, JsonSchemaDocumentDefinitionBlueprintType.CASE)
        whenever(documentService.findBy(JsonSchemaDocumentId.existingId(documentId))).thenReturn(Optional.of(document))

        val result = resolver.resolveCaseDocumentId(documentId)

        assertEquals(documentId, result)
    }

    @Test
    fun `delegates to module resolver for non-case documents`() {
        val documentId = UUID.randomUUID()
        val caseDocumentId = UUID.randomUUID()
        val document = createDocument(documentId, JsonSchemaDocumentDefinitionBlueprintType.BUILDING_BLOCK)
        whenever(documentService.findBy(JsonSchemaDocumentId.existingId(documentId))).thenReturn(Optional.of(document))
        whenever(moduleResolver.supports("BUILDING_BLOCK")).thenReturn(true)
        whenever(moduleResolver.resolveCaseDocumentId(documentId)).thenReturn(caseDocumentId)

        val result = resolver.resolveCaseDocumentId(documentId)

        assertEquals(caseDocumentId, result)
    }

    @Test
    fun `throws when document not found`() {
        val documentId = UUID.randomUUID()
        whenever(documentService.findBy(JsonSchemaDocumentId.existingId(documentId))).thenReturn(Optional.empty())

        val ex = assertThrows<CaseDocumentResolutionException> {
            resolver.resolveCaseDocumentId(documentId)
        }

        assertEquals("No document found for id $documentId", ex.message)
    }

    @Test
    fun `throws when no resolver available`() {
        val documentId = UUID.randomUUID()
        val document = createDocument(documentId, JsonSchemaDocumentDefinitionBlueprintType.BUILDING_BLOCK)
        whenever(documentService.findBy(JsonSchemaDocumentId.existingId(documentId))).thenReturn(Optional.of(document))
        whenever(moduleResolver.supports(any())).thenReturn(false)

        val ex = assertThrows<CaseDocumentResolutionException> {
            resolver.resolveCaseDocumentId(documentId)
        }

        assertEquals("No resolver available for blueprint type BUILDING_BLOCK", ex.message)
    }

    @Test
    fun `propagates resolver exceptions`() {
        val documentId = UUID.randomUUID()
        val document = createDocument(documentId, JsonSchemaDocumentDefinitionBlueprintType.BUILDING_BLOCK)
        whenever(documentService.findBy(JsonSchemaDocumentId.existingId(documentId))).thenReturn(Optional.of(document))
        whenever(moduleResolver.supports("BUILDING_BLOCK")).thenReturn(true)
        whenever(moduleResolver.resolveCaseDocumentId(documentId)).thenThrow(
            CaseDocumentResolutionException("fail")
        )

        val ex = assertThrows<CaseDocumentResolutionException> {
            resolver.resolveCaseDocumentId(documentId)
        }

        assertEquals("fail", ex.message)
    }

    private fun createDocument(
        documentId: UUID,
        blueprintType: JsonSchemaDocumentDefinitionBlueprintType
    ): JsonSchemaDocument {
        val document = mock<JsonSchemaDocument>()

        val definitionId = when (blueprintType) {
            JsonSchemaDocumentDefinitionBlueprintType.CASE ->
                JsonSchemaDocumentDefinitionId.forCase("name", CaseDefinitionId.of("key", "1.0.0"))
            JsonSchemaDocumentDefinitionBlueprintType.BUILDING_BLOCK ->
                JsonSchemaDocumentDefinitionId.forBuildingBlock(
                    "name",
                    BuildingBlockDefinitionId.of("key", "1.0.0")
                )
        }

        whenever(document.id()).thenReturn(JsonSchemaDocumentId.existingId(documentId))
        whenever(document.definitionId()).thenReturn(definitionId)

        return document
    }
}
