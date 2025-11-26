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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.buildingblock.service

import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.document.domain.Document
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.service.DocumentService
import com.ritense.document.service.result.CreateDocumentResult
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.semver4j.Semver
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.context.bean.override.mockito.MockitoBean
import java.time.LocalDateTime
import java.util.Optional
import java.util.UUID

class BuildingBlockInstanceServiceIT : BaseIntegrationTest() {

    @Autowired
    lateinit var buildingBlockInstanceService: BuildingBlockInstanceService

    @Autowired
    lateinit var buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository

    @Autowired
    lateinit var buildingBlockInstanceRepository: BuildingBlockInstanceRepository

    @Autowired
    lateinit var documentService: DocumentService

    @Test
    fun `create should store instance with document id`() {
        val definitionId = BuildingBlockDefinitionId.of("bezwaar", "1.0.0")



//        val documentId = UUID.randomUUID()
//        val document = mock<Document>()
//        val documentInternalId = mock<Document.Id>()
//        whenever(documentInternalId.getId()).thenReturn(documentId)
//        whenever(document.id()).thenReturn(documentInternalId)
//        val createDocumentResult = mock<CreateDocumentResult>()
//        whenever(createDocumentResult.resultingDocument()).thenReturn(Optional.of(document))
//        whenever(createDocumentResult.errors()).thenReturn(emptyList())
//        whenever(documentService.createDocument(any())).thenReturn(createDocumentResult)

        val instance = buildingBlockInstanceService.create(NewDocumentRequest(

        ))

        assertThat(instance.documentId).isEqualTo(documentId)
        assertThat(instance.definition.id).isEqualTo(definitionId)

        val stored = buildingBlockInstanceRepository.findById(instance.id)
        assertThat(stored).isPresent
        assertThat(stored.get().documentId).isEqualTo(documentId)
    }
}
