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

package com.ritense.authorization.web.request

import jakarta.validation.Validation
import jakarta.validation.Validator
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class PermissionAvailableRequestValidationTest {

    @Test
    fun `should accept a fully qualified class name`() {
        val violations = validator.validate(
            PermissionAvailableRequest(
                "com.ritense.authorization.testimpl.TestEntity",
                "view",
                PermissionContext("com.ritense.authorization.testimpl.TestEntity", "123"),
            )
        )

        assertTrue(violations.isEmpty(), "Unexpected violations: $violations")
    }

    @Test
    fun `should reject a resource that is not shaped like a class name`() {
        val violations = validator.validate(
            PermissionAvailableRequest("../../etc/passwd", "view")
        )

        assertEquals(1, violations.size)
        assertEquals("resource", violations.single().propertyPath.toString())
    }

    @Test
    fun `should reject a resource containing a newline`() {
        val violations = validator.validate(
            PermissionAvailableRequest("java.lang.System\ninjected", "view")
        )

        assertEquals(1, violations.size)
    }

    @Test
    fun `should reject a resource that is too long`() {
        val violations = validator.validate(
            PermissionAvailableRequest("a".repeat(513), "view")
        )

        assertEquals(1, violations.size)
    }

    @Test
    fun `should reject a context resource that is not shaped like a class name`() {
        val violations = validator.validate(
            PermissionAvailableRequest(
                "com.ritense.authorization.testimpl.TestEntity",
                "view",
                PermissionContext("not a class name", "123"),
            )
        )

        assertEquals(1, violations.size)
        assertEquals("context.resource", violations.single().propertyPath.toString())
    }

    companion object {
        private lateinit var validator: Validator
        private lateinit var validatorFactory: jakarta.validation.ValidatorFactory

        @JvmStatic
        @BeforeAll
        fun setUpValidator() {
            validatorFactory = Validation.buildDefaultValidatorFactory()
            validator = validatorFactory.validator
        }

        @JvmStatic
        @AfterAll
        fun tearDownValidator() {
            validatorFactory.close()
        }
    }
}
