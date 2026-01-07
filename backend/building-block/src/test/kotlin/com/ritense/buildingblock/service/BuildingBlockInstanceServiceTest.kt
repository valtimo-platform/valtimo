/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.buildingblock.service

import com.fasterxml.jackson.databind.node.JsonNodeFactory
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.exception.UnknownBuildingBlockDefinitionException
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.document.domain.Document
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.service.DocumentService
import com.ritense.document.service.result.CreateDocumentResult
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.LocalDateTime
import java.util.Optional
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class BuildingBlockInstanceServiceTest(
    @Mock private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    @Mock private val buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
    @Mock private val documentService: DocumentService
) {
    private lateinit var service: BuildingBlockInstanceService

    @BeforeEach
    fun setup() {
        service = BuildingBlockInstanceService(
            buildingBlockInstanceRepository,
            buildingBlockDefinitionRepository,
            documentService
        )
    }

    @Test
    fun `create succeeds with known bb definition and document definition`() {
        val definitionId = BuildingBlockDefinitionId.of("bb-key", "1.0.0")
        val definition = BuildingBlockDefinition(
            definitionId,
            "Test block",
            "desc",
            "creator",
            LocalDateTime.now(),
            null,
            false
        )
        whenever(buildingBlockDefinitionRepository.findById(definitionId)).thenReturn(Optional.of(definition))

        val newDocumentRequest = NewDocumentRequest(
            "document-definition",
            null,
            null,
            definitionId.key,
            definitionId.versionTag.toString(),
            JsonNodeFactory.instance.objectNode()
        )

        val buildingBlockDocumentId = UUID.randomUUID()
        val document = mock<Document>()
        val documentInternalId = mock<Document.Id>()
        whenever(documentInternalId.getId()).thenReturn(buildingBlockDocumentId)
        whenever(document.id()).thenReturn(documentInternalId)

        val createDocumentResult = mock<CreateDocumentResult>()
        whenever(createDocumentResult.resultingDocument()).thenReturn(Optional.of(document))
        whenever(documentService.createDocument(newDocumentRequest)).thenReturn(createDocumentResult)

        val caseDocumentId = UUID.randomUUID()
        whenever(buildingBlockInstanceRepository.save(any())).thenAnswer { it.arguments[0] as BuildingBlockInstance }

        val instance = service.create(
            newDocumentRequest,
            caseDocumentId,
            "call-activity"
        )

        assertThat(instance.definition).isEqualTo(definition)
        assertThat(instance.documentId).isEqualTo(buildingBlockDocumentId)
        assertThat(instance.caseDocumentId).isEqualTo(caseDocumentId)
        assertThat(instance.activityId).isEqualTo("call-activity")

        verify(documentService).createDocument(newDocumentRequest)
        verify(buildingBlockInstanceRepository).save(any())
    }

    @Test
    fun `create fails with unknown bb definition`() {
        val definitionId = BuildingBlockDefinitionId.of("missing", "1.0.0")
        val newDocumentRequest = NewDocumentRequest(
            "document-definition",
            null,
            null,
            definitionId.key,
            definitionId.versionTag.toString(),
            JsonNodeFactory.instance.objectNode()
        )
        whenever(buildingBlockDefinitionRepository.findById(definitionId)).thenReturn(Optional.empty())

        assertThatThrownBy {
            service.create(newDocumentRequest, UUID.randomUUID(), "call-activity")
        }
        .isInstanceOf(UnknownBuildingBlockDefinitionException::class.java)

        verify(documentService, never()).createDocument(any())
    }
}
