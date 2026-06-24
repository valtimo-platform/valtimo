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

package com.ritense.formflow.domain.definition

import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.semver4j.Semver

class FormFlowDefinitionBlueprintIdTest {

    @Test
    fun `forCase creates id with CASE type and correct fields`() {
        val caseDefinitionId = CaseDefinitionId("my-case", "2.1.0")

        val blueprintId = FormFlowDefinitionBlueprintId.forCase(caseDefinitionId)

        assertThat(blueprintId.blueprintType).isEqualTo(BlueprintType.CASE)
        assertThat(blueprintId.blueprintKey).isEqualTo("my-case")
        assertThat(blueprintId.blueprintVersionTag).isEqualTo(caseDefinitionId.versionTag)
    }

    @Test
    fun `forBuildingBlock creates id with BUILDING_BLOCK type and correct fields`() {
        val bbId = BuildingBlockDefinitionId("my-bb", "1.0.0")

        val blueprintId = FormFlowDefinitionBlueprintId.forBuildingBlock(bbId)

        assertThat(blueprintId.blueprintType).isEqualTo(BlueprintType.BUILDING_BLOCK)
        assertThat(blueprintId.blueprintKey).isEqualTo("my-bb")
        assertThat(blueprintId.blueprintVersionTag).isEqualTo(bbId.versionTag)
    }

    @Test
    fun `two ids with same values are equal`() {
        val caseDefinitionId = CaseDefinitionId("my-case", "1.0.0")

        val id1 = FormFlowDefinitionBlueprintId.forCase(caseDefinitionId)
        val id2 = FormFlowDefinitionBlueprintId.forCase(caseDefinitionId)

        assertThat(id1).isEqualTo(id2)
        assertThat(id1.hashCode()).isEqualTo(id2.hashCode())
    }

    @Test
    fun `two ids with different blueprint types are not equal`() {
        val caseId = FormFlowDefinitionBlueprintId.forCase(CaseDefinitionId("shared-key", "1.0.0"))
        val bbId = FormFlowDefinitionBlueprintId.forBuildingBlock(BuildingBlockDefinitionId("shared-key", "1.0.0"))

        assertThat(caseId).isNotEqualTo(bbId)
    }

    @Test
    fun `two ids with different keys are not equal`() {
        val id1 = FormFlowDefinitionBlueprintId.forCase(CaseDefinitionId("case-a", "1.0.0"))
        val id2 = FormFlowDefinitionBlueprintId.forCase(CaseDefinitionId("case-b", "1.0.0"))

        assertThat(id1).isNotEqualTo(id2)
    }

    @Test
    fun `two ids with different version tags are not equal`() {
        val id1 = FormFlowDefinitionBlueprintId.forCase(CaseDefinitionId("my-case", "1.0.0"))
        val id2 = FormFlowDefinitionBlueprintId.forCase(CaseDefinitionId("my-case", "2.0.0"))

        assertThat(id1).isNotEqualTo(id2)
    }

    @Test
    fun `toString includes type, key, and version tag`() {
        val bbId = BuildingBlockDefinitionId("my-bb", "1.2.3")

        val blueprintId = FormFlowDefinitionBlueprintId.forBuildingBlock(bbId)
        val str = blueprintId.toString()

        assertThat(str).contains("BUILDING_BLOCK")
        assertThat(str).contains("my-bb")
        assertThat(str).contains("1.2.3")
    }

    @Test
    fun `asCaseDefinitionId returns CaseDefinitionId for CASE type`() {
        val caseDefinitionId = CaseDefinitionId("my-case", "1.0.0")
        val blueprintId = FormFlowDefinitionBlueprintId.forCase(caseDefinitionId)

        val result = blueprintId.asCaseDefinitionId()

        assertThat(result).isNotNull
        assertThat(result!!.key).isEqualTo("my-case")
    }

    @Test
    fun `asCaseDefinitionId returns null for BUILDING_BLOCK type`() {
        val blueprintId = FormFlowDefinitionBlueprintId.forBuildingBlock(BuildingBlockDefinitionId("my-bb", "1.0.0"))

        assertThat(blueprintId.asCaseDefinitionId()).isNull()
    }

    @Test
    fun `asBuildingBlockDefinitionId returns BuildingBlockDefinitionId for BUILDING_BLOCK type`() {
        val bbId = BuildingBlockDefinitionId("my-bb", "1.0.0")
        val blueprintId = FormFlowDefinitionBlueprintId.forBuildingBlock(bbId)

        val result = blueprintId.asBuildingBlockDefinitionId()

        assertThat(result).isNotNull
        assertThat(result!!.key).isEqualTo("my-bb")
    }

    @Test
    fun `asBuildingBlockDefinitionId returns null for CASE type`() {
        val blueprintId = FormFlowDefinitionBlueprintId.forCase(CaseDefinitionId("my-case", "1.0.0"))

        assertThat(blueprintId.asBuildingBlockDefinitionId()).isNull()
    }
}
