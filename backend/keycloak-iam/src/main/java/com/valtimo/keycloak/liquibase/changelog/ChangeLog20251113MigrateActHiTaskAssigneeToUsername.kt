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

class ChangeLog20251113MigrateActHiTaskAssigneeToUsername : AbstractMigrateWithKeycloakChangeLog(), CustomTaskChange {

    override fun execute(database: Database) {
        logger.info { "Starting ${this::class.simpleName}" }

        val connection = database.connection as JdbcConnection
        if (!checkTableIsNotEmpty(connection, TABLE_NAME)) {
            return
        }
        pingKeycloak()
        migrateActHiTask(connection)
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

    private fun migrateActHiTask(connection: JdbcConnection) {
        val result = connection.prepareStatement("SELECT id_,assignee_ FROM $TABLE_NAME").executeQuery()

        while (result.next()) {
            val taskId = result.getString("id_")
            val assignee = result.getString("assignee_")
            if (assignee != null) {
                try {
                    val assigneeUsername = getKeycloakUser(assignee)?.username
                    if (assignee != assigneeUsername) {
                        executeUpdate(
                            connection, "UPDATE $TABLE_NAME SET assignee_ = ? WHERE id_ = ?",
                            assigneeUsername, taskId
                        )
                    }
                } catch (_: KeycloakUserNotFoundException) {
                    logger.error { "Failed to migrate $TABLE_NAME '$taskId'. Unknown assignee: '$assignee'. Skipping $TABLE_NAME update." }
                } catch (ex: Exception) {
                    logger.error(ex) { "Failed to migrate $TABLE_NAME '$taskId' for assignee: '$assignee'. Skipping $TABLE_NAME update." }
                }
            }
        }
    }

    companion object {
        private const val TABLE_NAME = "act_hi_taskinst"
        private val logger = KotlinLogging.logger {}
    }
}
