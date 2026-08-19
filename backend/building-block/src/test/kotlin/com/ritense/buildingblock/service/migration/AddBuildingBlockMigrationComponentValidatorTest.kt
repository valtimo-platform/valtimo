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
import com.ritense.processdocument.migration.ProcessDefinitionBlueprintResolver
import com.ritense.processdocument.migration.ProcessMigrationActivityValidator
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever

class AddBuildingBlockMigrationComponentValidatorTest {

    private val objectMapper = ObjectMapper().registerKotlinModule()
    private lateinit var linkResolver: LinkedBuildingBlockVersionResolver
    private lateinit var activityValidator: ProcessMigrationActivityValidator
    private lateinit var validator: AddBuildingBlockMigrationComponentValidator

    private val source = CaseDefinitionId("verhuizing", "1.0.0")
    private val target = CaseDefinitionId("verhuizing", "1.0.1")

    /** What each blueprint version deploys, keyed by blueprint; drives the fake resolvers. */
    private val deployedProcesses = mutableMapOf<BlueprintId, Map<String, String>>()

    private val component = component(
        """"processMigration": [
            {
                "sourceProcessDefinitionKey": "verhuizing-process",
                "targetProcessDefinitionKey": "income-check-process"
            }
        ]"""
    )

    @BeforeEach
    fun setUp() {
        linkResolver = mock()
        activityValidator = mock()
        whenever(activityValidator.findInvalidActivityMappings(any(), any(), any())).thenReturn(emptyMap())
        deployedProcesses[source] = mapOf("verhuizing-process" to "verhuizing:1")
        deployedProcesses[target] = mapOf("verhuizing-process" to "verhuizing:2")
        deployedProcesses[BuildingBlockDefinitionId.of("income-check", "1.0.0")] =
            mapOf("income-check-process" to "income-check:1")

        validator = AddBuildingBlockMigrationComponentValidator(
            objectMapper,
            AddBuildingBlockLinkChecker(linkResolver),
            AddBuildingBlockProcessChecker(
                listOf(fakeResolver(BlueprintType.CASE), fakeResolver(BlueprintType.BUILDING_BLOCK)),
                activityValidator,
                linkResolver,
            ),
        )
    }

    @Test
    fun `should report the plan component key it validates`() {
        assertThat(validator.componentKey()).isEqualTo("addBuildingBlock")
    }

    @Test
    fun `should find no problem when the target links the added version and the processes resolve`() {
        linksOn(linked("income-check", "1.0.0"))

        assertThat(validator.validate(source, target, component)).isEmpty()
    }

    @Test
    fun `should reject a plan adding a building block version the target does not link`() {
        linksOn(linked("verhuizing-inspectie", "1.0.0"))

        assertThat(validator.validate(source, target, component)).singleElement().asString()
            .contains("adds building block 'income-check:1.0.0', which is never used")
    }

    @Test
    fun `should reject an entry with no process migration, which could never create a block`() {
        linksOn(linked("income-check", "1.0.0"))

        assertThat(validator.validate(source, target, component(""""processMigration": []""")))
            .singleElement().asString()
            .contains("adds building block 'income-check:1.0.0' without a 'processMigration'")
    }

    @Test
    fun `should reject an entry whose process migration section is absent altogether`() {
        linksOn(linked("income-check", "1.0.0"))

        assertThat(validator.validate(source, target, component(""""dataMigration": []""")))
            .singleElement().asString()
            .contains("without a 'processMigration'")
    }

    @Test
    fun `should reject a source process key neither the source nor the target deploys`() {
        linksOn(linked("income-check", "1.0.0"))
        val typo = component(
            """"processMigration": [
                {
                    "sourceProcessDefinitionKey": "verhuizing-proces",
                    "targetProcessDefinitionKey": "income-check-process"
                }
            ]"""
        )

        assertThat(validator.validate(source, target, typo)).singleElement().asString()
            .contains("taking over process 'verhuizing-proces', which neither")
            .contains("'verhuizing-process'")
    }

    @Test
    fun `should accept a source process key only the source deploys, since the hijack may precede a bump`() {
        linksOn(linked("income-check", "1.0.0"))
        deployedProcesses[target] = emptyMap()

        assertThat(validator.validate(source, target, component)).isEmpty()
    }

    @Test
    fun `should reject a target process key the added building block version does not deploy`() {
        linksOn(linked("income-check", "1.0.0"))
        val typo = component(
            """"processMigration": [
                {
                    "sourceProcessDefinitionKey": "verhuizing-process",
                    "targetProcessDefinitionKey": "income-check-proces"
                }
            ]"""
        )

        assertThat(validator.validate(source, target, typo)).singleElement().asString()
            .contains("migrating into process 'income-check-proces', which 'income-check:1.0.0' does not deploy")
    }

    @Test
    fun `should report an activity mapping the engine refuses`() {
        linksOn(linked("income-check", "1.0.0"))
        whenever(activityValidator.findInvalidActivityMappings(any(), any(), any()))
            .thenReturn(mapOf("BeoordeelTask" to listOf("ENGINE-23001 no such activity")))

        assertThat(validator.validate(source, target, component)).singleElement().asString()
            .contains("activity 'BeoordeelTask': ENGINE-23001 no such activity")
    }

    private fun component(section: String) = objectMapper.readTree(
        """
        [
            {
                "buildingBlockKey": "income-check",
                "buildingBlockVersionTag": "1.0.0",
                $section
            }
        ]
        """.trimIndent()
    )

    private fun fakeResolver(type: BlueprintType) = object : ProcessDefinitionBlueprintResolver {
        override fun supports(blueprintType: BlueprintType) = blueprintType == type
        override fun resolveProcessDefinitions(blueprintId: BlueprintId) =
            deployedProcesses[blueprintId].orEmpty()
    }

    private fun linked(key: String, versionTag: String) =
        LinkedBuildingBlock(BuildingBlockDefinitionId.of(key, versionTag), LinkOrigin.STARTABLE_ITEM)

    private fun linksOn(vararg links: LinkedBuildingBlock) {
        whenever(linkResolver.resolveLinkedVersions(target)).thenReturn(links.toList())
    }
}
