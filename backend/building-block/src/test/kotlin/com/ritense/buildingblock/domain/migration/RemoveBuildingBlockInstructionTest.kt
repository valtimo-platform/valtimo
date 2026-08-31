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

package com.ritense.buildingblock.domain.migration

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

/** G29: a component stored before `buildingBlockVersionTag` was required must stay readable, because opening the plan to name the version is the only repair there is. */
class RemoveBuildingBlockInstructionTest {

    private val objectMapper = jacksonObjectMapper()

    @Test
    fun `should read a component stored before the version tag existed, leaving the version blank`() {
        val stored = """
            [
              {
                "buildingBlockKey": "inspectie-dossier",
                "dataMigration": [{"source": "doc:/dossierStatus", "target": "doc:/status"}],
                "processMigration": []
              }
            ]
        """.trimIndent()

        val instructions: List<RemoveBuildingBlockInstruction> = objectMapper.readValue(stored)

        assertThat(instructions).singleElement().satisfies({
            assertThat(it.buildingBlockKey).isEqualTo("inspectie-dossier")
            assertThat(it.buildingBlockVersionTag).isEmpty()
            // Everything else survives, so the plan the author reopens is the plan they wrote.
            assertThat(it.dataMigration).singleElement()
                .satisfies({ patch -> assertThat(patch.target).isEqualTo("doc:/status") })
        })
    }

    @Test
    fun `should read a version tag when one is stored`() {
        val stored = """[{"buildingBlockKey": "inspectie-dossier", "buildingBlockVersionTag": "1.0.0"}]"""

        val instructions: List<RemoveBuildingBlockInstruction> = objectMapper.readValue(stored)

        assertThat(instructions).singleElement()
            .satisfies({ assertThat(it.buildingBlockVersionTag).isEqualTo("1.0.0") })
    }

    @Test
    fun `should carry the version out again, so re-saving a repaired plan keeps it`() {
        val instruction = RemoveBuildingBlockInstruction(
            buildingBlockKey = "inspectie-dossier",
            buildingBlockVersionTag = "1.0.0",
        )

        assertThat(objectMapper.writeValueAsString(instruction))
            .contains("\"buildingBlockVersionTag\":\"1.0.0\"")
    }
}
