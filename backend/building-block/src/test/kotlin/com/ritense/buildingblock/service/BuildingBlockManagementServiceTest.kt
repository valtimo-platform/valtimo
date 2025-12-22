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

import com.ritense.authorization.AuthorizationService
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.exception.UnknownBuildingBlockDefinitionException
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.web.rest.dto.UpdateBuildingBlockDefinitionDto
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.event.BuildingBlockDefinitionCreatedEvent
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.InjectMocks
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.context.ApplicationEventPublisher
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class BuildingBlockManagementServiceTest {

    @Mock
    private lateinit var buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository

    @Mock
    private lateinit var buildingBlockDocumentDefinitionService: BuildingBlockDocumentDefinitionService

    @Mock
    private lateinit var buildingBlockDefinitionProcessDefinitionService: BuildingBlockDefinitionProcessDefinitionService

    @Mock
    private lateinit var buildingBlockDefinitionChecker: BuildingBlockDefinitionChecker

    @Mock
    private lateinit var authorizationService: AuthorizationService

    @Mock
    private lateinit var applicationEventPublisher: ApplicationEventPublisher

    @InjectMocks
    private lateinit var buildingBlockManagementService: BuildingBlockManagementService

    private val definitionId = BuildingBlockDefinitionId("test", "1.0.0")

    private val draftDefinition = BuildingBlockDefinition(
        id = definitionId,
        name = "Draft block",
        description = "draft",
        createdBy = "creator",
        createdDate = null,
        basedOnVersionTag = null,
        final = false
    )

    private val finalizedDefinition = draftDefinition.copy(final = true)

    private val newDraftId = BuildingBlockDefinitionId("test", "2.0.0")

    @Test
    fun `finalize transitions definition to final`() {
        val expectedFinal = draftDefinition.copy(final = true)

        whenever(buildingBlockDefinitionRepository.findById(definitionId)).thenReturn(Optional.of(draftDefinition))
        whenever(buildingBlockDefinitionRepository.save(expectedFinal)).thenReturn(expectedFinal)

        val dto = buildingBlockManagementService.finalize(definitionId.key, definitionId.versionTag.toString())

        assertTrue(dto.final)
        verify(buildingBlockDefinitionRepository).save(expectedFinal)
    }

    @Test
    fun `finalize returns existing dto when already final`() {
        whenever(buildingBlockDefinitionRepository.findById(definitionId)).thenReturn(Optional.of(finalizedDefinition))

        val dto = buildingBlockManagementService.finalize(definitionId.key, definitionId.versionTag.toString())

        assertTrue(dto.final)
        verify(buildingBlockDefinitionRepository, never()).save(any())
    }

    @Test
    fun `finalize throws when definition missing`() {
        whenever(buildingBlockDefinitionRepository.findById(definitionId)).thenReturn(Optional.empty())

        assertThrows(UnknownBuildingBlockDefinitionException::class.java) {
            buildingBlockManagementService.finalize(definitionId.key, definitionId.versionTag.toString())
        }
    }

    @Test
    fun `update enforces checker before persisting`() {
        whenever(buildingBlockDefinitionRepository.findById(definitionId)).thenReturn(Optional.of(draftDefinition))
        whenever(buildingBlockDefinitionRepository.save(any())).thenAnswer { invocation ->
            invocation.getArgument<BuildingBlockDefinition>(0)
        }

        val dto = UpdateBuildingBlockDefinitionDto("Updated title", "Updated description")

        val result = buildingBlockManagementService.update(definitionId.key, definitionId.versionTag.toString(), dto)

        assertNotNull(result)
        assertEquals("Updated title", result!!.name)
        assertEquals("Updated description", result.description)
        verify(buildingBlockDefinitionChecker).assertCanUpdateBuildingBlockDefinition(definitionId)
    }

    @Test
    fun `update throws when definition missing`() {
        whenever(buildingBlockDefinitionRepository.findById(definitionId)).thenReturn(Optional.empty())

        assertThrows(UnknownBuildingBlockDefinitionException::class.java) {
            buildingBlockManagementService.update(definitionId.key, definitionId.versionTag.toString(), UpdateBuildingBlockDefinitionDto("t", null))
        }
        verify(buildingBlockDefinitionChecker, never()).assertCanUpdateBuildingBlockDefinition(definitionId)
    }

    @Test
    fun `createDraft clones metadata and related resources`() {
        whenever(buildingBlockDefinitionRepository.existsById(newDraftId)).thenReturn(false)
        whenever(buildingBlockDefinitionRepository.findById(definitionId)).thenReturn(Optional.of(finalizedDefinition))
        whenever(buildingBlockDefinitionRepository.saveAndFlush(any())).thenAnswer { invocation ->
            invocation.getArgument<BuildingBlockDefinition>(0)
        }

        val result = buildingBlockManagementService.createDraft(
            definitionId.key,
            definitionId.versionTag.toString(),
            newDraftId.versionTag.toString()
        )

        assertEquals(newDraftId.versionTag.toString(), result.versionTag)
        assertEquals(definitionId.versionTag.toString(), result.basedOnVersionTag)
        assertTrue(!result.final)
        verify(applicationEventPublisher).publishEvent(any<BuildingBlockDefinitionCreatedEvent>())
    }
}
