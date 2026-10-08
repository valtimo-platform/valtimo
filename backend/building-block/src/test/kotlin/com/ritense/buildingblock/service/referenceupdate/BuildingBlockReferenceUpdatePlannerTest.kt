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

package com.ritense.buildingblock.service.referenceupdate

import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateContainerType.BUILDING_BLOCK
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.semver4j.Semver

class BuildingBlockReferenceUpdatePlannerTest {

    @Test
    fun `a new draft version bumps the key's latest version by the component that differs between source and target, or major for another key`() {
        val notify = { version: String -> ReferenceContainer(BUILDING_BLOCK, "notify", Semver.parse(version)!!) }
        val versions = BuildingBlockReferenceIndex(
            references = emptyList(),
            containers = listOf("1.1.0", "1.2.0").map { ReferenceContainerInfo(notify(it), true, null, "Notify") },
        )

        fun allocate(sourceVersion: String, targetVersion: String, targetKey: String = "send-email") = BuildingBlockReferenceUpdatePlanner(
            versions,
            BuildingBlockDefinitionId.of("send-email", sourceVersion),
            BuildingBlockDefinitionId.of(targetKey, targetVersion),
            TargetFields(emptyList()),
            emptySet(),
            true,
        ).allocateDraftVersions(listOf(notify("1.1.0"))).getValue(notify("1.1.0")).toString()

        assertThat(allocate("1.0.0", "1.0.1")).isEqualTo("1.2.1")
        assertThat(allocate("1.0.1", "1.0.0")).isEqualTo("1.2.1")
        assertThat(allocate("1.0.0", "1.1.0")).isEqualTo("1.3.0")
        assertThat(allocate("1.0.0", "2.0.0")).isEqualTo("2.0.0")
        assertThat(allocate("1.0.0", "1.0.1", targetKey = "send-letter")).isEqualTo("2.0.0")
    }
}
