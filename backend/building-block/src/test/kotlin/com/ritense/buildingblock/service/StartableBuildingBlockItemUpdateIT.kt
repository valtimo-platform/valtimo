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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.web.rest.dto.CreateBuildingBlockDefinitionDto
import com.ritense.case.service.StartableItemManagementService
import com.ritense.case.web.rest.dto.StartableItemType
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional

/**
 * Regression test for GZAC issue 851: changing the version of a building block action on a case
 * definition's Actions tab failed with "entity not found" because the version change was never
 * applied to the link.
 */
@Transactional
class StartableBuildingBlockItemUpdateIT @Autowired constructor(
    private val startableItemManagementService: StartableItemManagementService,
    private val caseDefinitionBuildingBlockLinkService: CaseDefinitionBuildingBlockLinkService,
    private val objectMapper: ObjectMapper,
) : BaseIntegrationTest() {

    @Test
    fun `should move a linked building block action to another version`() {
        createBuildingBlockVersion(FIRST_VERSION)
        createBuildingBlockVersion(SECOND_VERSION)

        val created = runWithoutAuthorization {
            startableItemManagementService.createItem(
                caseDefinitionId,
                StartableItemType.BUILDING_BLOCK,
                properties(FIRST_VERSION)
            )
        }
        assertThat(created.versionTag).isEqualTo(FIRST_VERSION)

        val updated = runWithoutAuthorization {
            startableItemManagementService.updateItem(
                caseDefinitionId,
                BUILDING_BLOCK_KEY,
                FIRST_VERSION,
                StartableItemType.BUILDING_BLOCK,
                properties(SECOND_VERSION)
            )
        }

        assertThat(updated.key).isEqualTo(BUILDING_BLOCK_KEY)
        assertThat(updated.versionTag).isEqualTo(SECOND_VERSION)

        val versionTags = runWithoutAuthorization {
            caseDefinitionBuildingBlockLinkService.getLinks(caseDefinitionId)
        }
            .filter { it.buildingBlockDefinitionKey == BUILDING_BLOCK_KEY }
            .map { it.buildingBlockDefinitionVersionTag }
        assertThat(versionTags).containsExactly(SECOND_VERSION)

        val startableVersionTags = runWithoutAuthorization {
            startableItemManagementService.getStartableItems(caseDefinitionId)
        }
            .filter { it.key == BUILDING_BLOCK_KEY }
            .map { it.versionTag }
        assertThat(startableVersionTags).containsExactly(SECOND_VERSION)
    }

    private fun createBuildingBlockVersion(versionTag: String) {
        runWithoutAuthorization {
            buildingBlockManagementService.create(
                CreateBuildingBlockDefinitionDto(
                    key = BUILDING_BLOCK_KEY,
                    versionTag = versionTag,
                    name = "Version switch $versionTag",
                    description = null
                )
            )
        }
    }

    private fun properties(versionTag: String) = objectMapper.createObjectNode().apply {
        put("buildingBlockDefinitionKey", BUILDING_BLOCK_KEY)
        put("buildingBlockDefinitionVersionTag", versionTag)
        putArray("inputMappings")
        putArray("outputMappings")
        putObject("pluginConfigurationMappings")
    }

    private val caseDefinitionId = CaseDefinitionId.of(CASE_DEFINITION_KEY, CASE_DEFINITION_VERSION)

    private companion object {
        // Deliberately distinctive so other integration tests in this module cannot have created it.
        const val BUILDING_BLOCK_KEY = "version-switch"
        const val FIRST_VERSION = "1.0.0"
        const val SECOND_VERSION = "2.0.0"
        const val CASE_DEFINITION_KEY = "bb-case"
        const val CASE_DEFINITION_VERSION = "1.0.0"
    }
}
