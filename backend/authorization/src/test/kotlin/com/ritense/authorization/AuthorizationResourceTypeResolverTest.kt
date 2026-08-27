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

package com.ritense.authorization

import com.ritense.authorization.testimpl.RelatedTestEntity
import com.ritense.authorization.testimpl.RelatedTestEntitySpecificationFactory
import com.ritense.authorization.testimpl.TestEntity
import com.ritense.authorization.testimpl.TestEntityActionProvider
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class AuthorizationResourceTypeResolverTest {

    private lateinit var resolver: AuthorizationResourceTypeResolver

    @BeforeEach
    fun setUp() {
        resolver = AuthorizationResourceTypeResolver(
            actionProviders = listOf(TestEntityActionProvider()),
            specificationFactories = listOf(RelatedTestEntitySpecificationFactory()),
        )
    }

    @Test
    fun `should allow resource types from action providers`() {
        val allowedResourceTypes = resolver.getAllowedResourceTypes()

        assertTrue(TestEntity::class.java.name in allowedResourceTypes)
    }

    @Test
    fun `should allow resource types from specification factories`() {
        val allowedResourceTypes = resolver.getAllowedResourceTypes()

        assertTrue(RelatedTestEntity::class.java.name in allowedResourceTypes)
    }

    @Test
    fun `should resolve every allowed resource type`() {
        resolver.getAllowedResourceTypes().forEach { resourceType ->
            assertEquals(resourceType, resolver.resolve(resourceType).name)
        }
    }

    @Test
    fun `should reject a class that is on the classpath but is not a resource type`() {
        assertThrows<UnknownAuthorizationResourceTypeException> {
            resolver.resolve(Action::class.java.name)
        }
    }

    @Test
    fun `should reject java lang System`() {
        assertThrows<UnknownAuthorizationResourceTypeException> {
            resolver.resolve("java.lang.System")
        }
    }

    @Test
    fun `should reject java lang Runtime`() {
        assertThrows<UnknownAuthorizationResourceTypeException> {
            resolver.resolve("java.lang.Runtime")
        }
    }

    /**
     * A name that does not exist must be rejected by the allowlist, not by the class loader. If a
     * [ClassNotFoundException] were to surface here the class loader would have been consulted,
     * which is what makes the endpoint usable to probe the classpath.
     */
    @Test
    fun `should reject a name that does not exist without consulting the class loader`() {
        assertThrows<UnknownAuthorizationResourceTypeException> {
            resolver.resolve("com.example.DoesNotExist")
        }
    }

    @Test
    fun `should reject a resource type that only differs in case`() {
        assertThrows<UnknownAuthorizationResourceTypeException> {
            resolver.resolve(TestEntity::class.java.name.lowercase())
        }
    }

    @Test
    fun `should not repeat the rejected value in the failure message`() {
        val submitted = "com.example.SecretlyPresentOnTheClasspath"

        val exception = assertThrows<UnknownAuthorizationResourceTypeException> {
            resolver.resolve(submitted)
        }

        assertFalse(
            exception.message.orEmpty().contains(submitted),
            "The rejection message must not echo the submitted resource type, " +
                "because that turns the check into a classpath oracle",
        )
    }

    @Test
    fun `should not allow arbitrary classes on the classpath`() {
        val allowedResourceTypes = resolver.getAllowedResourceTypes()

        assertFalse("java.lang.System" in allowedResourceTypes)
        assertFalse("java.lang.Runtime" in allowedResourceTypes)
        assertFalse("java.lang.ProcessBuilder" in allowedResourceTypes)
        assertFalse(AuthorizationResourceTypeResolver::class.java.name in allowedResourceTypes)
        assertFalse(Action::class.java.name in allowedResourceTypes)
    }

    @Test
    fun `should cache the allowed resource types`() {
        assert(
            resolver.getAllowedResourceTypes() === resolver.getAllowedResourceTypes()
        )
    }
}
