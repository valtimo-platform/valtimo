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

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.ritense.buildingblock.service.migration.LinkedBuildingBlockVersionResolver.LinkOrigin
import com.ritense.buildingblock.service.migration.LinkedBuildingBlockVersionResolver.LinkedBuildingBlock
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever

class AddBuildingBlockMigrationComponentValidatorTest {

    private val objectMapper = ObjectMapper().registerKotlinModule()
    private lateinit var linkResolver: LinkedBuildingBlockVersionResolver
    private lateinit var validator: AddBuildingBlockMigrationComponentValidator

    private val source = CaseDefinitionId("verhuizing", "1.0.0")
    private val target = CaseDefinitionId("verhuizing", "1.0.1")

    private val component = objectMapper.readTree(
        """
        [
            {
                "buildingBlockKey": "income-check",
                "buildingBlockVersionTag": "1.0.0",
                "dataMigration": [{"target": "doc:/checkStatus", "source": "doc:/status"}],
                "processMigration": []
            }
        ]
        """.trimIndent()
    )

    @BeforeEach
    fun setUp() {
        linkResolver = mock()
        validator = AddBuildingBlockMigrationComponentValidator(
            objectMapper, AddBuildingBlockLinkChecker(linkResolver)
        )
    }

    @Test
    fun `should report the plan component key it validates`() {
        assertThat(validator.componentKey()).isEqualTo("addBuildingBlock")
    }

    @Test
    fun `should find no problem when the target links the added version`() {
        linksOn(linked("income-check", "1.0.0"))

        assertThat(validator.validate(source, target, component)).isEmpty()
    }

    @Test
    fun `should reject a plan adding a building block version the target does not link`() {
        linksOn(linked("verhuizing-inspectie", "1.0.0"))

        assertThat(validator.validate(source, target, component)).singleElement().asString()
            .contains("adds building block 'income-check:1.0.0', which is never used")
    }

    private fun linked(key: String, versionTag: String) =
        LinkedBuildingBlock(BuildingBlockDefinitionId.of(key, versionTag), LinkOrigin.STARTABLE_ITEM)

    private fun linksOn(vararg links: LinkedBuildingBlock) {
        whenever(linkResolver.resolveLinkedVersions(target)).thenReturn(links.toList())
    }
}
