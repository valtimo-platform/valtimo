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

class ChangeLog20251113MigrateJsonSchemaDocumentAssigneeToUserId : AbstractMigrateWithKeycloakChangeLog(), CustomTaskChange {

    override fun execute(database: Database) {
        logger.info { "Starting ${this::class.simpleName}" }

        val connection = database.connection as JdbcConnection
        pingKeycloak()
        migrateJsonSchemaDocument(database, connection)
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

    private fun migrateJsonSchemaDocument(database: Database, connection: JdbcConnection) {
        if (!checkTableExists(connection, "json_schema_document")) {
            return
        }
        val result = connection.prepareStatement("SELECT json_schema_document_id,assignee_id FROM json_schema_document")
            .executeQuery()

        while (result.next()) {
            val documentId = getIdFromResultSet(database, result, "json_schema_document_id")
            val assignee = result.getString("assignee_id")
            if (assignee != null) {
                try {
                    val assigneeUsername = getKeycloakUser(assignee)?.username
                    if (assignee != assigneeUsername) {
                        executeUpdate(
                            connection,
                            "UPDATE json_schema_document SET assignee_id = ? WHERE json_schema_document_id = ?",
                            assigneeUsername,
                            documentId
                        )
                    }
                } catch (_: KeycloakUserNotFoundException) {
                    logger.error {
                        "Failed to migrate json_schema_document '$documentId'. Unknown assignee: '$assignee'. Unassigning user from json_schema_document."
                    }
                    executeUpdate(
                        connection,
                        "UPDATE json_schema_document SET assignee_id = ? WHERE json_schema_document_id = ?",
                        null,
                        documentId
                    )
                } catch (ex: Exception) {
                    logger.error(ex) { "Failed to migrate json_schema_document '$documentId' for assignee: '$assignee'. Skipping json_schema_document update." }
                }
            }
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
