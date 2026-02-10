/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.valtimo.contract.liquibase.precondition

import liquibase.changelog.DatabaseChangeLog
import liquibase.database.Database
import liquibase.exception.PreconditionErrorException
import liquibase.exception.PreconditionFailedException
import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock

class ClassExistsConditionTest {

    private val database: Database = mock()
    private val changeLog = DatabaseChangeLog("test-changelog.xml")

    @Test
    fun `check passes when class exists`() {
        val condition = ClassExistsCondition()
        condition.className = ClassExistsCondition::class.java.name

        assertDoesNotThrow {
            condition.check(database, changeLog, null, null)
        }
    }

    @Test
    fun `check fails when class does not exist`() {
        val condition = ClassExistsCondition()
        condition.className = "com.example.MissingChangeLog"

        assertThrows(PreconditionFailedException::class.java) {
            condition.check(database, changeLog, null, null)
        }
    }

    @Test
    fun `check errors when className is blank`() {
        val condition = ClassExistsCondition()
        condition.className = "  "

        assertThrows(PreconditionErrorException::class.java) {
            condition.check(database, changeLog, null, null)
        }
    }
}
