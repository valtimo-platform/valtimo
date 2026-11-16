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

package com.ritense.dashboard.liquibase.changelog

import com.ritense.dashboard.service.DashboardKeys
import io.github.oshai.kotlinlogging.KotlinLogging
import liquibase.change.custom.CustomTaskChange
import liquibase.database.Database
import liquibase.database.jvm.JdbcConnection
import liquibase.exception.ValidationErrors
import liquibase.resource.ResourceAccessor

/**
 * Gives the widget with an empty key (created from a name without letters) a valid key.
 * Without this, the widget can't be edited or deleted.
 */
class ChangeLog20261116FixEmptyWidgetKey : CustomTaskChange {

    override fun execute(database: Database) {
        val connection = database.connection as JdbcConnection
        val keyColumn = database.escapeColumnName(null, null, WIDGET_TABLE, "key")

        val title = connection.prepareStatement("SELECT title FROM $WIDGET_TABLE WHERE $keyColumn = ''").use {
            it.executeQuery().use { result -> if (result.next()) result.getString("title") else null }
        } ?: return

        val usedKeys = connection.prepareStatement("SELECT $keyColumn FROM $WIDGET_TABLE").use {
            it.executeQuery().use { result -> generateSequence { if (result.next()) result.getString(1) else null }.toSet() }
        }
        val newKey = DashboardKeys.generate(title, DashboardKeys.WIDGET_PREFIX) { it in usedKeys }

        connection.prepareStatement("UPDATE $WIDGET_TABLE SET $keyColumn = ? WHERE $keyColumn = ''").use {
            it.setString(1, newKey)
            it.executeUpdate()
        }

        logger.info { "Changed the empty key of widget '$title' to '$newKey'" }
    }

    override fun getConfirmationMessage(): String {
        return "${this::class.simpleName} executed"
    }

    override fun setUp() {
        // This interface method is not needed
    }

    override fun setFileOpener(resourceAccessor: ResourceAccessor) {
        // This interface method is not needed
    }

    override fun validate(database: Database): ValidationErrors {
        return ValidationErrors()
    }

    companion object {
        private val logger = KotlinLogging.logger {}
        private const val WIDGET_TABLE = "dashboard_widget_configuration"
    }
}
