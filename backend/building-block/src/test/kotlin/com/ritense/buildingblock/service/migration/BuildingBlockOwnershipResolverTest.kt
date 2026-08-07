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

package com.ritense.buildingblock.service.migration

import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.UUID

class BuildingBlockOwnershipResolverTest {

    private lateinit var instanceRepository: BuildingBlockInstanceRepository
    private lateinit var resolver: BuildingBlockOwnershipResolver

    private val caseDocumentId = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        instanceRepository = mock()
        resolver = BuildingBlockOwnershipResolver(instanceRepository)
    }

    @Test
    fun `should return only the top-level blocks of a case owner`() {
        val topLevel = block()
        whenever(instanceRepository.findByDocumentId(caseDocumentId)).thenReturn(null)
        whenever(
            instanceRepository.findAllByCaseDocumentIdAndParentBuildingBlockInstanceIdIsNull(caseDocumentId)
        ).thenReturn(listOf(topLevel))

        assertThat(resolver.directChildrenOf(caseDocumentId)).containsExactly(topLevel)
    }

    @Test
    fun `should return the children of a building block owner, not every block of its case`() {
        val parent = block()
        val child = block(parentBuildingBlockInstanceId = parent.id)
        whenever(instanceRepository.findByDocumentId(parent.documentId)).thenReturn(parent)
        whenever(instanceRepository.findAllByParentBuildingBlockInstanceId(parent.id)).thenReturn(listOf(child))

        assertThat(resolver.directChildrenOf(parent.documentId)).containsExactly(child)
        verify(instanceRepository, never())
            .findAllByCaseDocumentIdAndParentBuildingBlockInstanceIdIsNull(parent.documentId)
    }

    private fun block(parentBuildingBlockInstanceId: UUID? = null) = BuildingBlockInstance(
        documentId = UUID.randomUUID(),
        caseDocumentId = caseDocumentId,
        parentBuildingBlockInstanceId = parentBuildingBlockInstanceId,
        definition = BuildingBlockDefinition(
            id = BuildingBlockDefinitionId.of("verhuizing-inspectie", "1.0.0"),
            name = "verhuizing-inspectie",
        ),
    )
}
