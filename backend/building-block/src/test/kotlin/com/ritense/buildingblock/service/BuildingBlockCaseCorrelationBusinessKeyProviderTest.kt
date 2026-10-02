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

package com.ritense.buildingblock.service

import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import java.util.UUID

class BuildingBlockCaseCorrelationBusinessKeyProviderTest {

    private lateinit var buildingBlockInstanceRepository: BuildingBlockInstanceRepository
    private lateinit var provider: BuildingBlockCaseCorrelationBusinessKeyProvider

    private val caseDocumentId: UUID = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        buildingBlockInstanceRepository = mock()
        provider = BuildingBlockCaseCorrelationBusinessKeyProvider(buildingBlockInstanceRepository)
    }

    @Test
    fun `should return the document id of every building block instance of the case`() {
        val documentIdOne = UUID.randomUUID()
        val documentIdTwo = UUID.randomUUID()
        val instances = listOf(instanceWithDocumentId(documentIdOne), instanceWithDocumentId(documentIdTwo))
        whenever(buildingBlockInstanceRepository.findAllByCaseDocumentId(caseDocumentId)).thenReturn(instances)

        val businessKeys = provider.getBusinessKeysForCase(caseDocumentId)

        assertThat(businessKeys).containsExactly(documentIdOne.toString(), documentIdTwo.toString())
    }

    @Test
    fun `should return no business keys when the case has no building block instances`() {
        whenever(buildingBlockInstanceRepository.findAllByCaseDocumentId(caseDocumentId)).thenReturn(emptyList())

        assertThat(provider.getBusinessKeysForCase(caseDocumentId)).isEmpty()
    }

    private fun instanceWithDocumentId(documentId: UUID): BuildingBlockInstance {
        val instance = mock<BuildingBlockInstance>()
        whenever(instance.documentId).thenReturn(documentId)
        return instance
    }
}
