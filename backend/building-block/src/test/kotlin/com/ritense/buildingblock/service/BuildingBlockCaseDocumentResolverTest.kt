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

import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.document.CaseDocumentResolutionException
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import java.util.UUID
import kotlin.test.assertEquals

class BuildingBlockCaseDocumentResolverTest {

    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository = mock()
    private val resolver = BuildingBlockCaseDocumentResolver(buildingBlockInstanceRepository)

    @Test
    fun `supports building block solution module`() {
        assertEquals(true, resolver.supports("BUILDING_BLOCK"))
        assertEquals(false, resolver.supports("CASE"))
    }

    @Test
    fun `resolves case document id`() {
        val documentId = UUID.randomUUID()
        val caseDocumentId = UUID.randomUUID()
        val instance = BuildingBlockInstance(
            id = UUID.randomUUID(),
            documentId = documentId,
            caseDocumentId = caseDocumentId,
            activityId = "activity",
            definition = BuildingBlockDefinition(
                id = BuildingBlockDefinitionId.of("key", "1.0.0"),
                name = "name"
            )
        )

        whenever(buildingBlockInstanceRepository.findByDocumentId(documentId)).thenReturn(instance)

        val result = resolver.resolveCaseDocumentId(documentId)

        assertEquals(caseDocumentId, result)
    }

    @Test
    fun `throws when instance missing`() {
        val documentId = UUID.randomUUID()
        whenever(buildingBlockInstanceRepository.findByDocumentId(documentId)).thenReturn(null)

        assertThrows<CaseDocumentResolutionException> {
            resolver.resolveCaseDocumentId(documentId)
        }
    }
}
