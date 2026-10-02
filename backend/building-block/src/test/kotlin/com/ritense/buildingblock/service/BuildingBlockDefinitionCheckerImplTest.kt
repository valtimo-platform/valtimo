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

import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.core.env.Environment
import org.springframework.core.env.StandardEnvironment

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

    private fun checkerWith(environment: Environment) = BuildingBlockDefinitionCheckerImpl(
        repository,
        environment,
        "dev,test",
        false,
    )
}
