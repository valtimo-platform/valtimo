/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.processlink.repository

import com.ritense.plugin.domain.PluginProcessLink
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface ValtimoPluginProcessLinkRepository : BaseProcessLinkRepository<PluginProcessLink> {
    fun findByPluginActionDefinitionKey(pluginActionDefinitionKey: String): List<PluginProcessLink>

    @Query(
        "SELECT DISTINCT link.pluginConfigurationReference.pluginDefinitionKey " +
            "FROM PluginProcessLink link " +
            "WHERE link.pluginConfigurationReference.type = com.ritense.plugin.domain.PluginConfigurationReferenceType.BUILDING_BLOCK " +
            "AND link.processDefinitionId IN :processDefinitionIds " +
            "AND link.pluginConfigurationReference.pluginDefinitionKey IS NOT NULL"
    )
    fun findPluginDefinitionKeysByProcessDefinitionIds(
        @Param("processDefinitionIds") processDefinitionIds: Collection<String>
    ): List<String>

    /**
     * `ExternalPluginProcessLink` (the `external_plugin` `process_link_type` row) lives in
     * `:backend:external-plugin`, which `:backend:building-block` does not depend on. Rather than
     * introduce that module dependency, this reads the shared `process_link` columns
     * (`plugin_definition_key`/`plugin_definition_version`, populated by both the embedded and
     * external plugin systems via the shared `PluginConfigurationReference` embeddable) natively,
     * filtered to external `BUILDING_BLOCK` references only.
     */
    @Query(
        value = """
            SELECT DISTINCT
                plugin_definition_key AS pluginDefinitionKey,
                plugin_definition_version AS pluginDefinitionVersion
            FROM process_link
            WHERE process_link_type = 'external_plugin'
                AND reference_type = 'BUILDING_BLOCK'
                AND process_definition_id IN :processDefinitionIds
                AND plugin_definition_key IS NOT NULL
                AND plugin_definition_version IS NOT NULL
        """,
        nativeQuery = true
    )
    fun findExternalPluginReferencesByProcessDefinitionIds(
        @Param("processDefinitionIds") processDefinitionIds: Collection<String>
    ): List<ExternalPluginReferenceProjection>
}

interface ExternalPluginReferenceProjection {
    fun getPluginDefinitionKey(): String
    fun getPluginDefinitionVersion(): String
}
