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

class ChangeLog20251113MigrateIntermediateSubmissionCreatedByEditedByToUsername : AbstractMigrateWithKeycloakChangeLog(), CustomTaskChange {

    override fun execute(database: Database) {
        logger.info { "Starting ${this::class.simpleName}" }

        val connection = database.connection as JdbcConnection
        pingKeycloak()
        migrateIntermediateSubmission(database, connection)
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

    private fun migrateIntermediateSubmission(database: Database, connection: JdbcConnection) {
        if (!checkTableExists(connection, "intermediate_submission")) {
            return
        }
        val result = connection.prepareStatement("SELECT id,created_by,edited_by FROM intermediate_submission")
            .executeQuery()

        while (result.next()) {
            val id = getIdFromResultSet(database, result, "id")
            val creator = result.getString("created_by")
            val editor = result.getString("edited_by")
            try {
                val creatorUsername = try {
                    getKeycloakUser(creator)?.username
                } catch (_: KeycloakUserNotFoundException) {
                    logger.error { "Failed to migrate intermediate_submission '$id'. Unknown creator: '$creator'. Skipping intermediate_submission.created_by update." }
                    creator
                }
                val editorUsername = try {
                    getKeycloakUser(editor)?.username
                } catch (_: KeycloakUserNotFoundException) {
                    logger.error { "Failed to migrate intermediate_submission '$id'. Unknown editor: '$editor'. Skipping intermediate_submission.edited_by update." }
                    editor
                }
                if (creator != creatorUsername || editor != editorUsername) {
                    executeUpdate(
                        connection, "UPDATE intermediate_submission SET created_by = ?, edited_by = ? WHERE id = ?",
                        creatorUsername, editorUsername, id
                    )
                }
            } catch (ex: Exception) {
                logger.error(ex) { "Failed to migrate intermediate_submission '$id' for creator '$creator' and editor '$editor'. Skipping intermediate_submission update." }
            }
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
