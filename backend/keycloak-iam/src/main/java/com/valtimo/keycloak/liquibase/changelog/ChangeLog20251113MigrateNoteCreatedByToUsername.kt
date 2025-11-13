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

class ChangeLog20251113MigrateNoteCreatedByToUsername : AbstractMigrateWithKeycloakChangeLog(), CustomTaskChange {

    override fun execute(database: Database) {
        logger.info { "Starting ${this::class.simpleName}" }

        val connection = database.connection as JdbcConnection
        pingKeycloak()
        migrateNote(database, connection)
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

    private fun migrateNote(database: Database, connection: JdbcConnection) {
        if (!checkTableExists(connection, "note")) {
            return
        }
        val result = connection.prepareStatement("SELECT id,created_by_user_id FROM note").executeQuery()

        while (result.next()) {
            val noteId = getIdFromResultSet(database, result, "id")
            val creator = result.getString("created_by_user_id")
            if (creator != null) {
                try {
                    val creatorUsername = getKeycloakUser(creator)?.username
                    if (creator != creatorUsername) {
                        executeUpdate(
                            connection, "UPDATE note SET created_by_user_id = ? WHERE id = ?",
                            creatorUsername, noteId
                        )
                    }
                } catch (_: KeycloakUserNotFoundException) {
                    logger.error { "Failed to migrate note '$noteId'. Unknown creator: '$creator'. Skipping note update." }
                } catch (ex: Exception) {
                    logger.error(ex) { "Failed to migrate note '$noteId' for assignee: '$creator'. Skipping note update." }
                }
            }
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
