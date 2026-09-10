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

package com.ritense.processdocument.migration

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever

class ProcessMigrationComponentValidatorTest {

    private val objectMapper = ObjectMapper().registerKotlinModule()
    private lateinit var activityValidator: ProcessMigrationActivityValidator
    private lateinit var validator: ProcessMigrationComponentValidator

    private val source = CaseDefinitionId("verhuizing", "1.0.0")
    private val target = CaseDefinitionId("verhuizing", "1.0.1")

    private val deployedProcesses = mutableMapOf<BlueprintId, Map<String, String>>()

    @BeforeEach
    fun setUp() {
        activityValidator = mock()
        whenever(activityValidator.findInvalidActivityMappings(any(), any(), any())).thenReturn(emptyMap())
        deployedProcesses[source] = mapOf("verhuizing-process" to "verhuizing:1")
        deployedProcesses[target] = mapOf("verhuizing-process" to "verhuizing:2")
        validator = ProcessMigrationComponentValidator(
            listOf(object : ProcessDefinitionBlueprintResolver {
                override fun supports(blueprintType: BlueprintType) = blueprintType == BlueprintType.CASE
                override fun resolveProcessDefinitions(blueprintId: BlueprintId) =
                    deployedProcesses[blueprintId].orEmpty()
            }),
            activityValidator,
            objectMapper,
        )
    }

    @Test
    fun `should find no problem when both process keys are deployed`() {
        assertThat(validator.validate(source, target, component("verhuizing-process", "verhuizing-process")))
            .isEmpty()
    }

    @Test
    fun `should reject a source process key the source does not deploy`() {
        assertThat(validator.validate(source, target, component("verhuizing-proces", "verhuizing-process")))
            .singleElement().asString()
            .contains("'verhuizing-proces' is not a process of 'verhuizing:1.0.0'")
            .contains("would be skipped for every case")
            .contains("Available: 'verhuizing-process'")
    }

    @Test
    fun `should reject a target process key the target does not deploy`() {
        assertThat(validator.validate(source, target, component("verhuizing-process", "verhuizing-proces")))
            .singleElement().asString()
            .contains("'verhuizing-proces' is not a process of 'verhuizing:1.0.1'")
    }

    @Test
    fun `should refuse an instruction that names no target, rather than answering 500`() {
        // `targetProcessDefinitionKey` is not nullable, so this threw out of the validator and the save answered 500 for an ordinary mistake.
        val nullTarget = objectMapper.readTree(
            """[{"sourceProcessDefinitionKey": "verhuizing-process", "targetProcessDefinitionKey": null}]"""
        )

        assertThat(validator.validate(source, target, nullTarget))
            .singleElement().asString()
            .contains("the instruction for 'verhuizing-process' names no 'targetProcessDefinitionKey'")
            .contains("remove the instruction to leave instances of 'verhuizing-process' where they are")
            .contains("Available: 'verhuizing-process'")
    }

    @Test
    fun `should refuse an instruction whose target field is absent entirely`() {
        val absentTarget = objectMapper.readTree("""[{"sourceProcessDefinitionKey": "verhuizing-process"}]""")

        assertThat(validator.validate(source, target, absentTarget))
            .singleElement().asString()
            .contains("names no 'targetProcessDefinitionKey'")
    }

    @Test
    fun `should report every instruction that names no target, not only the first`() {
        val twoNulls = objectMapper.readTree(
            """
            [
                {"sourceProcessDefinitionKey": "a", "targetProcessDefinitionKey": null},
                {"sourceProcessDefinitionKey": "b"}
            ]
            """.trimIndent()
        )

        assertThat(validator.validate(source, target, twoNulls)).hasSize(2)
    }

    @Test
    fun `should stay silent when the blueprint type has no resolver`() {
        val validatorWithoutResolvers = ProcessMigrationComponentValidator(
            emptyList(), activityValidator, objectMapper
        )

        assertThat(validatorWithoutResolvers.validate(source, target, component("anything", "at-all")))
            .isEmpty()
    }

    @Test
    fun `should report an activity mapping the engine refuses`() {
        whenever(activityValidator.findInvalidActivityMappings(any(), any(), any()))
            .thenReturn(mapOf("BeoordeelTask" to listOf("ENGINE-23001 no such activity")))

        assertThat(validator.validate(source, target, component("verhuizing-process", "verhuizing-process")))
            .singleElement().asString()
            .contains("activity 'BeoordeelTask': ENGINE-23001 no such activity")
    }

    private fun component(sourceKey: String, targetKey: String) = objectMapper.readTree(
        """
        [
            {
                "sourceProcessDefinitionKey": "$sourceKey",
                "targetProcessDefinitionKey": "$targetKey",
                "mapActivities": {"a": "b"}
            }
        ]
        """.trimIndent()
    )
}
