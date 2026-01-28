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

package com.ritense.plugin.repository

import com.ritense.plugin.domain.PluginDefinition
import com.ritense.processlink.domain.ActivityTypeWithEventName
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface PluginDefinitionRepository: JpaRepository<PluginDefinition, String> {
    fun findAllByOrderByTitleAsc(): List<PluginDefinition>
    @Query(
        """
        SELECT DISTINCT def
        FROM PluginDefinition def
        LEFT JOIN def.actions pad
        WHERE :activityType IS NULL
            OR (:activityType IS NOT NULL AND pad IS NOT NULL AND :activityType MEMBER OF pad.activityTypes)
        ORDER BY def.title ASC
        """
    )
    fun findAllWithActivityType(activityType: ActivityTypeWithEventName?): List<PluginDefinition>
}
