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

import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.importer.ImportContext.Companion.runImporter
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertDoesNotThrow
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.whenever
import org.springframework.core.env.Environment
import org.springframework.core.env.StandardEnvironment
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class BuildingBlockDefinitionCheckerImplTest {

    @Mock
    private lateinit var repository: BuildingBlockDefinitionRepository

    @Test
    fun `canUpdateGlobalConfiguration should match a draft profile that is only set as default profile`() {
        val checker = checkerWith(StandardEnvironment().apply { setDefaultProfiles("dev") })

        assertTrue(checker.canUpdateGlobalConfiguration())
    }

    @Test
    fun `canUpdateGlobalConfiguration should not match a default profile that is no draft profile`() {
        val checker = checkerWith(StandardEnvironment().apply { setDefaultProfiles("prod") })

        assertFalse(checker.canUpdateGlobalConfiguration())
    }

    @Test
    fun `canUpdateGlobalConfiguration should ignore default profiles when an active profile is set`() {
        val checker = checkerWith(
            StandardEnvironment().apply {
                setDefaultProfiles("dev")
                setActiveProfiles("prod")
            }
        )

        assertFalse(checker.canUpdateGlobalConfiguration())
    }

    @Test
    fun `canUpdateGlobalConfiguration should match an active draft profile`() {
        val checker = checkerWith(StandardEnvironment().apply { setActiveProfiles("test") })

        assertTrue(checker.canUpdateGlobalConfiguration())
    }

    @Test
    fun `assertCanCreateOrUpdateBuildingBlockDefinition should allow final definition in non-draft environment`() {
        val checker = checkerWith(prodEnvironment())

        assertDoesNotThrow { checker.assertCanCreateOrUpdateBuildingBlockDefinition(id, true) }
    }

    @Test
    fun `assertCanCreateOrUpdateBuildingBlockDefinition should reject draft definition in non-draft environment`() {
        val checker = checkerWith(prodEnvironment())

        assertThrows<IllegalStateException> { checker.assertCanCreateOrUpdateBuildingBlockDefinition(id, false) }
    }

    @Test
    fun `assertCanCreateOrUpdateBuildingBlockDefinition should allow draft definition in draft environment`() {
        val checker = checkerWith(testEnvironment())

        assertDoesNotThrow { checker.assertCanCreateOrUpdateBuildingBlockDefinition(id, false) }
    }

    @Test
    fun `assertCanCreateOrUpdateBuildingBlockDefinition should allow final definition in draft environment`() {
        val checker = checkerWith(testEnvironment())

        assertDoesNotThrow { checker.assertCanCreateOrUpdateBuildingBlockDefinition(id, true) }
    }

    @Test
    fun `assertCanCreateOrUpdateBuildingBlockDefinition should allow draft definition when drafts are enabled`() {
        val checker = BuildingBlockDefinitionCheckerImpl(repository, prodEnvironment(), "dev,test", true)

        assertDoesNotThrow { checker.assertCanCreateOrUpdateBuildingBlockDefinition(id, false) }
    }

    @Test
    fun `assertCanCreateOrUpdateBuildingBlockDefinition should reject when existing definition is final`() {
        whenever(repository.findById(id)).thenReturn(Optional.of(buildingBlockDefinition(final = true)))
        val checker = checkerWith(prodEnvironment())

        assertThrows<IllegalStateException> { checker.assertCanCreateOrUpdateBuildingBlockDefinition(id, true) }
    }

    @Test
    fun `assertCanCreateOrUpdateBuildingBlockDefinition should allow final payload when existing definition is not final`() {
        whenever(repository.findById(id)).thenReturn(Optional.of(buildingBlockDefinition(final = false)))
        val checker = checkerWith(prodEnvironment())

        assertDoesNotThrow { checker.assertCanCreateOrUpdateBuildingBlockDefinition(id, true) }
    }

    @Test
    fun `assertCanUpdateBuildingBlockDefinition should reject final definition in non-draft environment`() {
        val checker = checkerWith(prodEnvironment())

        assertThrows<IllegalArgumentException> { checker.assertCanUpdateBuildingBlockDefinition(id) }
    }

    @Test
    fun `assertCanUpdateBuildingBlockDefinition should reject final definition in draft environment`() {
        whenever(repository.findById(id)).thenReturn(Optional.of(buildingBlockDefinition(final = true)))
        val checker = checkerWith(testEnvironment())

        assertThrows<IllegalArgumentException> { checker.assertCanUpdateBuildingBlockDefinition(id) }
    }

    @Test
    fun `assertCanUpdateBuildingBlockDefinition should allow non-final definition while importing in non-draft environment`() {
        whenever(repository.findById(id)).thenReturn(Optional.of(buildingBlockDefinition(final = false)))
        val checker = checkerWith(prodEnvironment())

        assertDoesNotThrow {
            runImporter<Unit> { checker.assertCanUpdateBuildingBlockDefinition(id) }
        }
    }

    private fun prodEnvironment() = StandardEnvironment().apply { setActiveProfiles("prod") }

    private fun testEnvironment() = StandardEnvironment().apply { setActiveProfiles("test") }

    private fun buildingBlockDefinition(final: Boolean) = BuildingBlockDefinition(
        id = id,
        name = "Test",
        description = "description",
        final = final,
    )

    private fun checkerWith(environment: Environment) = BuildingBlockDefinitionCheckerImpl(
        repository,
        environment,
        "dev,test",
        false,
    )

    private companion object {
        val id = BuildingBlockDefinitionId("bb-key", "1.0.0")
    }
}
