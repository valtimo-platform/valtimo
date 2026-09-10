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

package com.ritense.externalplugin.repository

import com.ritense.externalplugin.domain.ExternalPluginProcessLink
import com.ritense.plugin.domain.PluginConfigurationReferenceType
import com.ritense.processlink.domain.ActivityTypeWithEventName
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

interface ExternalPluginProcessLinkRepository : JpaRepository<ExternalPluginProcessLink, UUID> {

    fun findByProcessDefinitionIdAndActivityIdAndActivityType(
        processDefinitionId: String,
        activityId: String,
        activityType: ActivityTypeWithEventName,
    ): List<ExternalPluginProcessLink>

    fun findByProcessDefinitionId(processDefinitionId: String): List<ExternalPluginProcessLink>

    fun findAllByExternalPluginConfigurationIdIn(
        externalPluginConfigurationIds: Collection<UUID>,
    ): List<ExternalPluginProcessLink>

    /**
     * Links whose (design-time) reference pins one of the given plugin definition keys with the
     * given reference type — used by the host delete guard to find `BUILDING_BLOCK` references,
     * which carry no configuration id and are therefore invisible to the configuration-based
     * usage queries above.
     */
    @Query(
        """
        select link from ExternalPluginProcessLink link
        where link.pluginConfigurationReference.type = :referenceType
        and link.pluginConfigurationReference.pluginDefinitionKey in :pluginDefinitionKeys
        """
    )
    fun findAllByReferenceTypeAndPluginDefinitionKeyIn(
        @Param("referenceType") referenceType: PluginConfigurationReferenceType,
        @Param("pluginDefinitionKeys") pluginDefinitionKeys: Collection<String>,
    ): List<ExternalPluginProcessLink>
}
