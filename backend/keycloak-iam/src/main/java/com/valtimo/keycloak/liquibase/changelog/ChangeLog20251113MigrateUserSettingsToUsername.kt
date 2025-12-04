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

package com.valtimo.keycloak.liquibase.changelog

import io.github.oshai.kotlinlogging.KotlinLogging
import liquibase.change.custom.CustomTaskChange
import liquibase.database.Database
import liquibase.database.jvm.JdbcConnection
import liquibase.exception.ValidationErrors
import liquibase.resource.ResourceAccessor

class ChangeLog20251113MigrateUserSettingsToUsername : AbstractMigrateWithKeycloakChangeLog(), CustomTaskChange {

    override fun execute(database: Database) {
        logger.info { "Starting ${this::class.simpleName}" }

        val connection = database.connection as JdbcConnection
        if (!checkTableIsNotEmpty(connection, TABLE_NAME)) {
            return
        }
        pingKeycloak()
        migrateUserSettings(connection)
        pingKeycloak()

        logger.info { "Finished ${this::class.simpleName}" }
    }

    override fun getConfirmationMessage(): String {
        return "${this::class.simpleName} executed"
    }

    override fun setUp() {
        // This interface method is not needed
    }

    override fun setFileOpener(resourceAccessor: ResourceAccessor?) {
        // This interface method is not needed
    }

    override fun validate(database: Database?): ValidationErrors {
        return ValidationErrors()
    }

    private fun migrateUserSettings(connection: JdbcConnection) {
        val result = connection.prepareStatement("SELECT user_id,settings FROM $TABLE_NAME").executeQuery()

        while (result.next()) {
            val userId = result.getString("user_id")
            val settings = result.getObject("settings")
            try {
                val username = getKeycloakUser(userId)?.username
                if (userId != username) {
                    executeUpdate(
                        connection, """
                        INSERT INTO $TABLE_NAME (user_id, settings)
                        SELECT ?, ?
                        WHERE NOT EXISTS (
                            SELECT 1 FROM $TABLE_NAME WHERE user_id = ?
                        );
                     """.trimIndent(), username, settings, username
                    )
                    executeUpdate(connection, "DELETE FROM $TABLE_NAME WHERE user_id = ?", userId)
                }
            } catch (_: KeycloakUserNotFoundException) {
                logger.error { "Failed to migrate $TABLE_NAME. Unknown user: '$userId'. Skipping $TABLE_NAME update." }
            } catch (ex: Exception) {
                logger.error(ex) { "Failed to migrate $TABLE_NAME for user '$userId'. Skipping $TABLE_NAME update." }
            }
        }
    }

    companion object {
        private const val TABLE_NAME = "user_settings"
        private val logger = KotlinLogging.logger {}
    }
}
