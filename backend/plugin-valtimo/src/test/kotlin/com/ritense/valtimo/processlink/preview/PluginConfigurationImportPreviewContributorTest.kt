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

package com.ritense.valtimo.processlink.preview

import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.valtimo.contract.plugin.PluginConfigurationExistenceChecker
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.util.UUID

class PluginConfigurationImportPreviewContributorTest {

    private val objectMapper = MapperSingleton.get()

    @Test
    fun `should contribute a fixed plugin process link that exists here`() {
        val pluginConfigurationId = UUID.randomUUID()
        val contributor = contributor(existing = setOf(pluginConfigurationId))

        val contributions = contributor.contributePreview(
            zipOf(GLOBAL_PROCESS_LINK_PATH to pluginProcessLinkJson(pluginConfigurationId))
        )

        val contribution = contributions.single()
        assertThat(contribution.pluginConfigurationId).isEqualTo(pluginConfigurationId)
        assertThat(contribution.pluginDefinitionKey).isEqualTo("my-plugin")
        assertThat(contribution.pluginActionDefinitionKey).isEqualTo("my-action")
        assertThat(contribution.processDefinitionKey).isEqualTo(PROCESS_DEFINITION_KEY)
        assertThat(contribution.activityId).isEqualTo("Task_1")
        assertThat(contribution.existsInTargetEnvironment).isTrue()
    }

    @Test
    fun `should mark a plugin configuration as not existing when it is unknown here`() {
        val pluginConfigurationId = UUID.randomUUID()
        val contributor = contributor(existing = emptySet())

        val contributions = contributor.contributePreview(
            zipOf(GLOBAL_PROCESS_LINK_PATH to pluginProcessLinkJson(pluginConfigurationId))
        )

        assertThat(contributions.single().existsInTargetEnvironment).isFalse()
    }

    @Test
    fun `should mark a plugin configuration as not existing when there is no existence checker`() {
        val contributor = PluginConfigurationImportPreviewContributor(objectMapper, null)

        val contributions = contributor.contributePreview(
            zipOf(GLOBAL_PROCESS_LINK_PATH to pluginProcessLinkJson())
        )

        assertThat(contributions.single().existsInTargetEnvironment).isFalse()
    }

    @Test
    fun `should ignore a case scoped process link`() {
        // A case export bundles its process links under config/case/.../process-link; only the global
        // process links belong to the process being imported, so a case process link must be ignored.
        val contributions = contributor().contributePreview(
            zipOf(CASE_PROCESS_LINK_PATH to pluginProcessLinkJson())
        )

        assertThat(contributions).isEmpty()
    }

    @Test
    fun `should ignore a process link that is not a plugin link`() {
        val contributions = contributor().contributePreview(
            zipOf(GLOBAL_PROCESS_LINK_PATH to pluginProcessLinkJson(processLinkType = "form"))
        )

        assertThat(contributions).isEmpty()
    }

    @Test
    fun `should ignore a plugin process link that is not a fixed reference`() {
        val contributions = contributor().contributePreview(
            zipOf(GLOBAL_PROCESS_LINK_PATH to pluginProcessLinkJson(referenceType = "DYNAMIC"))
        )

        assertThat(contributions).isEmpty()
    }

    @Test
    fun `should ignore a plugin process link with an invalid plugin configuration id`() {
        val json = """
            [
              {
                "activityId": "Task_1",
                "processLinkType": "plugin",
                "pluginConfigurationId": "not-a-uuid",
                "pluginActionDefinitionKey": "my-action"
              }
            ]
        """.trimIndent()

        val contributions = contributor().contributePreview(zipOf(GLOBAL_PROCESS_LINK_PATH to json))

        assertThat(contributions).isEmpty()
    }

    @Test
    fun `should ignore an entry that is not a json array`() {
        val contributions = contributor().contributePreview(zipOf(GLOBAL_PROCESS_LINK_PATH to "{}"))

        assertThat(contributions).isEmpty()
    }

    private fun contributor(existing: Set<UUID> = emptySet()) =
        PluginConfigurationImportPreviewContributor(
            objectMapper,
            PluginConfigurationExistenceChecker { it in existing },
        )

    private fun pluginProcessLinkJson(
        pluginConfigurationId: UUID = UUID.randomUUID(),
        processLinkType: String = "plugin",
        referenceType: String? = null,
    ): String {
        val referenceTypeField = referenceType?.let { """"referenceType": "$it",""" } ?: ""
        return """
            [
              {
                "activityId": "Task_1",
                "processLinkType": "$processLinkType",
                $referenceTypeField
                "pluginConfigurationId": "$pluginConfigurationId",
                "pluginDefinitionKey": "my-plugin",
                "pluginActionDefinitionKey": "my-action"
              }
            ]
        """.trimIndent()
    }

    private fun zipOf(vararg entries: Pair<String, String>): Map<String, ByteArray> =
        entries.associate { (path, content) -> path to content.toByteArray() }

    private companion object {
        const val PROCESS_DEFINITION_KEY = "my-process"
        const val GLOBAL_PROCESS_LINK_PATH =
            "config/global/process-link/$PROCESS_DEFINITION_KEY.process-link.json"
        const val CASE_PROCESS_LINK_PATH =
            "config/case/my-case/1.0.0/process-link/$PROCESS_DEFINITION_KEY.process-link.json"
    }
}
