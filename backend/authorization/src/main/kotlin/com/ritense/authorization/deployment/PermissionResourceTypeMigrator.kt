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

package com.ritense.authorization.deployment

import com.ritense.authorization.permission.condition.ContainerPermissionCondition
import com.ritense.authorization.permission.condition.PermissionCondition

object PermissionResourceTypeMigrator {
    private val renames: Map<String, String> = mapOf(
        "com.ritense.resource.authorization.ResourcePermission"
            to "com.ritense.documentenapi.authorization.ZgwDocument",
    )

    fun migrate(resourceType: Class<*>?): Class<*>? {
        if (resourceType == null) return null
        val replacement = renames[resourceType.name] ?: return resourceType
        return try {
            Class.forName(replacement)
        } catch (_: ClassNotFoundException) {
            resourceType
        }
    }

    fun migrateConditions(conditions: List<PermissionCondition>): List<PermissionCondition> =
        conditions.map { c ->
            when (c) {
                is ContainerPermissionCondition<*> -> ContainerPermissionCondition(
                    resourceType = migrate(c.resourceType)!!,
                    conditions = migrateConditions(c.conditions)
                )
                else -> c
            }
        }
}
