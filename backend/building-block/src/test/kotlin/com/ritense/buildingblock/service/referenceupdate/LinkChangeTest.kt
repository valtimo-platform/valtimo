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

import com.ritense.buildingblock.processlink.domain.BuildingBlockInputMapping
import com.ritense.buildingblock.processlink.dto.BuildingBlockFieldDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateContainerType.CASE
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateReasonCode.CONFLICT_CHILD
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateReasonCode.CONFLICT_INPUT
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateReasonCode.CONFLICT_PLUGIN
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.semver4j.Semver
import java.util.UUID

class LinkChangeTest {

    private val case = ReferenceContainer(CASE, "moving", Semver("1.0.0"))
    private val source = BuildingBlockDefinitionId.of("send-email", "1.0.0")
    private val target = BuildingBlockDefinitionId.of("send-email", "1.0.1")
    private val link = IndexedReference(
        container = case,
        location = CaseLinkLocation(source.key),
        child = source,
        linkId = UUID.randomUUID(),
        processDefinitionId = null,
        inputMappings = emptyList(),
        outputMappings = emptyList(),
        pluginConfigurationMappings = emptyMap(),
    )
    private val pluginConfigurationId = UUID.randomUUID()

    @Test
    fun `identical changes do not conflict`() {
        val change = change(
            newChild = target,
            addInputs = listOf(BuildingBlockInputMapping("a", "/a")),
            addPlugins = mapOf("smtp" to pluginConfigurationId),
        )

        assertThat(change.conflictWith(change.copy())).isNull()
    }

    @Test
    fun `different new children conflict`() {
        val other = BuildingBlockDefinitionId.of("send-email", "1.0.2")

        val conflict = change(newChild = target).conflictWith(change(newChild = other))

        assertThat(conflict?.code).isEqualTo(CONFLICT_CHILD)
        assertThat(conflict?.parameters).containsEntry("first", "$target").containsEntry("second", "$other")
    }

    @Test
    fun `a change without new child does not conflict on child`() {
        assertThat(change(newChild = null).conflictWith(change(newChild = target))).isNull()
    }

    @Test
    fun `different sources for the same normalized input conflict`() {
        val conflict = change(addInputs = listOf(BuildingBlockInputMapping("a", "doc:/field")))
            .conflictWith(change(addInputs = listOf(BuildingBlockInputMapping("b", "/field/"))))

        assertThat(conflict?.code).isEqualTo(CONFLICT_INPUT)
        assertThat(conflict?.parameters).containsEntry("input", "doc:/field")
    }

    @Test
    fun `same source for the same input or inputs to different fields do not conflict`() {
        val mine = change(addInputs = listOf(BuildingBlockInputMapping("a", "doc:/field")))

        assertThat(mine.conflictWith(change(addInputs = listOf(BuildingBlockInputMapping("a", "/field"))))).isNull()
        assertThat(mine.conflictWith(change(addInputs = listOf(BuildingBlockInputMapping("b", "/other"))))).isNull()
    }

    @Test
    fun `different plugin configurations for the same plugin conflict`() {
        val conflict = change(addPlugins = mapOf("smtp" to pluginConfigurationId))
            .conflictWith(change(addPlugins = mapOf("smtp" to UUID.randomUUID())))

        assertThat(conflict?.code).isEqualTo(CONFLICT_PLUGIN)
        assertThat(conflict?.parameters).containsEntry("plugin", "smtp")
    }

    @Test
    fun `configurations for different plugins do not conflict`() {
        val conflict = change(addPlugins = mapOf("smtp" to pluginConfigurationId))
            .conflictWith(change(addPlugins = mapOf("sms" to UUID.randomUUID())))

        assertThat(conflict).isNull()
    }

    @Test
    fun `merging combines flags, inputs and plugins and dedups identical inputs`() {
        val shared = BuildingBlockInputMapping("a", "/a")
        val first = change(newChild = null, addInputs = listOf(shared), addPlugins = mapOf("smtp" to pluginConfigurationId))
        val second = change(
            newChild = target,
            containerReference = true,
            dropAgainstTarget = true,
            addInputs = listOf(shared, BuildingBlockInputMapping("b", "/b")),
            addPlugins = mapOf("sms" to pluginConfigurationId),
        )

        val merged = first.mergedWith(second)

        assertThat(merged.newChild).isEqualTo(target)
        assertThat(merged.containerReference).isTrue()
        assertThat(merged.dropAgainstTarget).isTrue()
        assertThat(merged.addInputs).containsExactly(shared, BuildingBlockInputMapping("b", "/b"))
        assertThat(merged.addPlugins).containsOnlyKeys("smtp", "sms")
        assertThat(merged.key).isEqualTo(first.key)
    }

    @Test
    fun `merged inputs to the same normalized field give one mapping`() {
        val merged = change(addInputs = listOf(BuildingBlockInputMapping("a", "doc:/a")))
            .mergedWith(change(addInputs = listOf(BuildingBlockInputMapping("a", "/a"))))

        val mappings = merged.inputMappings(TargetFields(listOf(BuildingBlockFieldDto("/a", true))), emptyList())

        assertThat(mappings).hasSize(1)
    }

    private fun change(
        newChild: BuildingBlockDefinitionId? = target,
        containerReference: Boolean = false,
        dropAgainstTarget: Boolean = false,
        addInputs: List<BuildingBlockInputMapping> = emptyList(),
        addPlugins: Map<String, UUID> = emptyMap(),
    ) = LinkChange(InPlaceDraft(case), link, newChild, containerReference, dropAgainstTarget, addInputs, addPlugins)
}
