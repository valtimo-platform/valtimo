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
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test

/** The version tag a `removeBuildingBlock` entry must name, refused at both points a plan can still be corrected: the save path and deploy, which is what a file-deployed plan passes. */
class RemoveBuildingBlockVersionCheckerTest {

    private val objectMapper = ObjectMapper()
    private val checker = RemoveBuildingBlockVersionChecker()
    private val validator = RemoveBuildingBlockMigrationComponentValidator(checker)

    private val source = CaseDefinitionId("verhuizing", "1.0.7")
    private val target = CaseDefinitionId("verhuizing", "1.0.8")

    @Test
    fun `should accept entries that name a version`() {
        val component = component(
            """[{"buildingBlockKey": "inspectie-dossier", "buildingBlockVersionTag": "1.0.0"}]"""
        )

        assertThat(checker.findVersionless(component)).isEmpty()
        assertThat(validator.validate(source, target, component)).isEmpty()
    }

    @Test
    fun `should refuse an entry with no version, naming the entry and its building block`() {
        val component = component("""[{"buildingBlockKey": "inspectie-dossier"}]""")

        assertThat(checker.findVersionless(component))
            .singleElement()
            .asString()
            .contains("entry 1 for building block 'inspectie-dossier'")
            .contains("names no 'buildingBlockVersionTag'")
    }

    @Test
    fun `should refuse a blank version, which is no version at all`() {
        val component = component(
            """[{"buildingBlockKey": "inspectie-dossier", "buildingBlockVersionTag": " "}]"""
        )

        assertThat(checker.findVersionless(component)).hasSize(1)
    }

    @Test
    fun `should report every offending entry, by position`() {
        val component = component(
            """
            [
              {"buildingBlockKey": "case-notification", "buildingBlockVersionTag": "1.0.0"},
              {"buildingBlockKey": "inspectie-dossier"},
              {"buildingBlockVersionTag": "1.0.0"},
              {}
            ]
            """.trimIndent()
        )

        assertThat(checker.findVersionless(component)).hasSize(2)
        assertThat(checker.findVersionless(component)[0]).contains("entry 2 for building block 'inspectie-dossier'")
        assertThat(checker.findVersionless(component)[1]).contains("entry 4 for building block '(no key)'")
    }

    @Test
    fun `should throw an IllegalArgumentException on assert, which the save path answers as a 400`() {
        val component = component("""[{"buildingBlockKey": "inspectie-dossier"}]""")

        assertThatThrownBy { checker.assertVersioned(component) }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("Migration plan cannot be deployed")
            .hasMessageContaining("names no 'buildingBlockVersionTag'")
    }

    @Test
    fun `should pass an assert when every entry names a version`() {
        checker.assertVersioned(
            component("""[{"buildingBlockKey": "inspectie-dossier", "buildingBlockVersionTag": "1.0.0"}]""")
        )
    }

    private fun component(json: String) = objectMapper.readTree(json)
}
