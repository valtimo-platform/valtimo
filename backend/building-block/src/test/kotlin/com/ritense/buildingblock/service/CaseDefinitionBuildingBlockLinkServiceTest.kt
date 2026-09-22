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

import com.ritense.buildingblock.domain.CaseDefinitionBuildingBlockLink
import com.ritense.buildingblock.processlink.domain.BuildingBlockInputMapping
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.buildingblock.web.rest.dto.UpdateCaseDefinitionBuildingBlockLinkDto
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

class CaseDefinitionBuildingBlockLinkServiceTest {

    private lateinit var linkRepository: CaseDefinitionBuildingBlockLinkRepository
    private lateinit var buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository
    private lateinit var service: CaseDefinitionBuildingBlockLinkService

    private val caseDefinitionId = CaseDefinitionId("my-case", "1.0.0")
    private val oldBuildingBlockDefinitionId = BuildingBlockDefinitionId.of("income-check", "1.0.0")
    private val newBuildingBlockDefinitionId = BuildingBlockDefinitionId.of("income-check", "2.0.0")

    @BeforeEach
    fun setUp() {
        linkRepository = mock()
        buildingBlockDefinitionRepository = mock()
        service = CaseDefinitionBuildingBlockLinkService(linkRepository, buildingBlockDefinitionRepository)

        whenever(linkRepository.save(any())).thenAnswer { it.arguments[0] }
    }

    @Test
    fun `should move link to the new building block version`() {
        val link = existingLink()
        whenever(
            linkRepository.findByCaseDefinitionIdAndBuildingBlockDefinitionId(
                caseDefinitionId,
                oldBuildingBlockDefinitionId
            )
        ).thenReturn(link)
        whenever(
            linkRepository.findByCaseDefinitionIdAndBuildingBlockDefinitionId(
                caseDefinitionId,
                newBuildingBlockDefinitionId
            )
        ).thenReturn(null)
        whenever(buildingBlockDefinitionRepository.existsById(newBuildingBlockDefinitionId)).thenReturn(true)

        val inputMappings = listOf(BuildingBlockInputMapping("doc:/income", "doc:/bb-income"))
        val result = service.updateLink(
            caseDefinitionId,
            oldBuildingBlockDefinitionId,
            UpdateCaseDefinitionBuildingBlockLinkDto(
                buildingBlockDefinitionKey = "income-check",
                buildingBlockDefinitionVersionTag = "2.0.0",
                inputMappings = inputMappings
            )
        )

        assertThat(result.buildingBlockDefinitionKey).isEqualTo("income-check")
        assertThat(result.buildingBlockDefinitionVersionTag).isEqualTo("2.0.0")
        assertThat(result.inputMappings).isEqualTo(inputMappings)

        verify(linkRepository).delete(link)
        val savedLink = argumentCaptor<CaseDefinitionBuildingBlockLink>()
        verify(linkRepository).save(savedLink.capture())
        assertThat(savedLink.firstValue.buildingBlockDefinitionId).isEqualTo(newBuildingBlockDefinitionId)
        assertThat(savedLink.firstValue.caseDefinitionId).isEqualTo(caseDefinitionId)
    }

    @Test
    fun `should update mappings in place when the version is unchanged`() {
        val link = existingLink()
        whenever(
            linkRepository.findByCaseDefinitionIdAndBuildingBlockDefinitionId(
                caseDefinitionId,
                oldBuildingBlockDefinitionId
            )
        ).thenReturn(link)

        val result = service.updateLink(
            caseDefinitionId,
            oldBuildingBlockDefinitionId,
            UpdateCaseDefinitionBuildingBlockLinkDto(
                buildingBlockDefinitionKey = "income-check",
                buildingBlockDefinitionVersionTag = "1.0.0"
            )
        )

        assertThat(result.id).isEqualTo(link.id)
        assertThat(result.buildingBlockDefinitionVersionTag).isEqualTo("1.0.0")
        verify(linkRepository, never()).delete(any())
    }

    @Test
    fun `should keep the current version when properties carry no building block key`() {
        val link = existingLink()
        whenever(
            linkRepository.findByCaseDefinitionIdAndBuildingBlockDefinitionId(
                caseDefinitionId,
                oldBuildingBlockDefinitionId
            )
        ).thenReturn(link)

        val result = service.updateLink(
            caseDefinitionId,
            oldBuildingBlockDefinitionId,
            UpdateCaseDefinitionBuildingBlockLinkDto()
        )

        assertThat(result.id).isEqualTo(link.id)
        assertThat(result.buildingBlockDefinitionVersionTag).isEqualTo("1.0.0")
        verify(linkRepository, never()).delete(any())
    }

    @Test
    fun `should fail when the new building block version does not exist`() {
        whenever(
            linkRepository.findByCaseDefinitionIdAndBuildingBlockDefinitionId(
                caseDefinitionId,
                oldBuildingBlockDefinitionId
            )
        ).thenReturn(existingLink())
        whenever(buildingBlockDefinitionRepository.existsById(newBuildingBlockDefinitionId)).thenReturn(false)

        assertThatThrownBy {
            service.updateLink(
                caseDefinitionId,
                oldBuildingBlockDefinitionId,
                UpdateCaseDefinitionBuildingBlockLinkDto(
                    buildingBlockDefinitionKey = "income-check",
                    buildingBlockDefinitionVersionTag = "2.0.0"
                )
            )
        }.isInstanceOf(NoSuchElementException::class.java)

        verify(linkRepository, never()).delete(any())
    }

    @Test
    fun `should fail when the new building block version is already linked`() {
        val link = existingLink()
        whenever(
            linkRepository.findByCaseDefinitionIdAndBuildingBlockDefinitionId(
                caseDefinitionId,
                oldBuildingBlockDefinitionId
            )
        ).thenReturn(link)
        whenever(
            linkRepository.findByCaseDefinitionIdAndBuildingBlockDefinitionId(
                caseDefinitionId,
                newBuildingBlockDefinitionId
            )
        ).thenReturn(
            CaseDefinitionBuildingBlockLink(
                caseDefinitionId = caseDefinitionId,
                buildingBlockDefinitionId = newBuildingBlockDefinitionId
            )
        )
        whenever(buildingBlockDefinitionRepository.existsById(newBuildingBlockDefinitionId)).thenReturn(true)

        assertThatThrownBy {
            service.updateLink(
                caseDefinitionId,
                oldBuildingBlockDefinitionId,
                UpdateCaseDefinitionBuildingBlockLinkDto(
                    buildingBlockDefinitionKey = "income-check",
                    buildingBlockDefinitionVersionTag = "2.0.0"
                )
            )
        }.isInstanceOf(IllegalStateException::class.java)

        verify(linkRepository, never()).delete(any())
    }

    private fun existingLink() = CaseDefinitionBuildingBlockLink(
        caseDefinitionId = caseDefinitionId,
        buildingBlockDefinitionId = oldBuildingBlockDefinitionId
    )
}
