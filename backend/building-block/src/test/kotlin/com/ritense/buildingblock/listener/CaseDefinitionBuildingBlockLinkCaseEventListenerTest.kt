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

package com.ritense.buildingblock.listener

import com.ritense.buildingblock.domain.CaseDefinitionBuildingBlockLink
import com.ritense.buildingblock.processlink.domain.BuildingBlockInputMapping
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.event.CaseDefinitionCreatedEvent
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

class CaseDefinitionBuildingBlockLinkCaseEventListenerTest {

    private val linkRepository: CaseDefinitionBuildingBlockLinkRepository = mock()
    private val listener = CaseDefinitionBuildingBlockLinkCaseEventListener(linkRepository)

    private val sourceId = CaseDefinitionId("my-case", "1.0.0")
    private val newId = CaseDefinitionId("my-case", "1.0.1")
    private val hiddenBlockId = BuildingBlockDefinitionId.of("hidden-check", "1.0.0")
    private val visibleBlockId = BuildingBlockDefinitionId.of("visible-check", "1.0.0")
    private val mappings = listOf(BuildingBlockInputMapping("doc:/income", "doc:/bb-income"))

    @Test
    fun `should keep the start menu visibility of links when duplicating a case definition`() {
        whenever(linkRepository.findAllByCaseDefinitionId(sourceId)).thenReturn(
            listOf(
                CaseDefinitionBuildingBlockLink(
                    caseDefinitionId = sourceId,
                    buildingBlockDefinitionId = hiddenBlockId,
                    inputMappings = mappings,
                    startableByUser = false
                ),
                CaseDefinitionBuildingBlockLink(
                    caseDefinitionId = sourceId,
                    buildingBlockDefinitionId = visibleBlockId,
                    inputMappings = mappings,
                    startableByUser = true
                )
            )
        )
        whenever(linkRepository.save(any<CaseDefinitionBuildingBlockLink>())).thenAnswer { it.arguments[0] }

        listener.handleCaseDefinitionCreatedEvent(
            CaseDefinitionCreatedEvent(
                caseDefinitionId = newId,
                caseDefinitionName = "x",
                basedOnCaseDefinitionId = sourceId,
                duplicate = true
            )
        )

        val saved = argumentCaptor<CaseDefinitionBuildingBlockLink>()
        verify(linkRepository, times(2)).save(saved.capture())
        assertThat(saved.allValues).allMatch { it.caseDefinitionId == newId }
        assertThat(saved.allValues).allMatch { it.inputMappings == mappings }
        assertThat(saved.allValues.first { it.buildingBlockDefinitionId == hiddenBlockId }.startableByUser).isFalse()
        assertThat(saved.allValues.first { it.buildingBlockDefinitionId == visibleBlockId }.startableByUser).isTrue()
    }
}
