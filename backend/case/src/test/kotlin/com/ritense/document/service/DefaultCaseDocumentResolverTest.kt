package com.ritense.document.service

import com.ritense.document.domain.JsonSchemaDocumentDefinitionSolutionModuleType
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.document.CaseDocumentResolutionException
import com.ritense.valtimo.contract.document.SolutionModuleCaseDocumentResolver
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
    private val moduleResolver: SolutionModuleCaseDocumentResolver = mock()
    private val resolver = DefaultCaseDocumentResolver(
        documentService,
        listOf(moduleResolver)
    )

    @Test
    fun `returns document id for case documents`() {
        val documentId = UUID.randomUUID()
        val document = createDocument(documentId, JsonSchemaDocumentDefinitionSolutionModuleType.CASE)
        whenever(documentService.findBy(JsonSchemaDocumentId.existingId(documentId))).thenReturn(Optional.of(document))

        val result = resolver.resolveCaseDocumentId(documentId)

        assertEquals(documentId, result)
    }

    @Test
    fun `delegates to module resolver for non-case documents`() {
        val documentId = UUID.randomUUID()
        val caseDocumentId = UUID.randomUUID()
        val document = createDocument(documentId, JsonSchemaDocumentDefinitionSolutionModuleType.BUILDING_BLOCK)
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
        val document = createDocument(documentId, JsonSchemaDocumentDefinitionSolutionModuleType.BUILDING_BLOCK)
        whenever(documentService.findBy(JsonSchemaDocumentId.existingId(documentId))).thenReturn(Optional.of(document))
        whenever(moduleResolver.supports(any())).thenReturn(false)

        val ex = assertThrows<CaseDocumentResolutionException> {
            resolver.resolveCaseDocumentId(documentId)
        }

        assertEquals("No resolver available for solution module type BUILDING_BLOCK", ex.message)
    }

    @Test
    fun `propagates resolver exceptions`() {
        val documentId = UUID.randomUUID()
        val document = createDocument(documentId, JsonSchemaDocumentDefinitionSolutionModuleType.BUILDING_BLOCK)
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
        solutionModuleType: JsonSchemaDocumentDefinitionSolutionModuleType
    ): JsonSchemaDocument {
        val document = mock<JsonSchemaDocument>()

        val definitionId = when (solutionModuleType) {
            JsonSchemaDocumentDefinitionSolutionModuleType.CASE ->
                JsonSchemaDocumentDefinitionId.forCase("name", CaseDefinitionId.of("key", "1.0.0"))
            JsonSchemaDocumentDefinitionSolutionModuleType.BUILDING_BLOCK ->
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
