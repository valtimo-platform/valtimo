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

package com.ritense.authorization

import com.ritense.authorization.role.RoleRepository
import com.ritense.authorization.testimpl.RelatedTestEntity
import com.ritense.authorization.testimpl.RelatedTestEntitySpecificationFactory
import com.ritense.authorization.testimpl.TestEntity
import com.ritense.authorization.testimpl.TestEntityActionProvider
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertSame
import kotlin.test.assertTrue

class PbacRegistryServiceTest {

    private lateinit var roleRepository: RoleRepository
    private lateinit var pbacRegistryService: PbacRegistryService

    @BeforeEach
    fun setUp() {
        roleRepository = mock()
        pbacRegistryService = PbacRegistryService(
            actionProviders = listOf(TestEntityActionProvider()),
            mappers = emptyList(),
            specificationFactories = listOf(RelatedTestEntitySpecificationFactory()),
            roleRepository = roleRepository,
        )
    }

    @Test
    fun `should allow resource types from action providers and specification factories`() {
        val allowedResourceTypes = pbacRegistryService.getAllowedResourceTypes()

        assertTrue(TestEntity::class.java.name in allowedResourceTypes)
        assertTrue(RelatedTestEntity::class.java.name in allowedResourceTypes)
    }

    /**
     * The allowlist only contains types that the application itself declares as a resource, through
     * a [ResourceActionProvider] or an
     * [com.ritense.authorization.specification.AuthorizationSpecificationFactory]. Everything else
     * on the classpath stays out of it.
     */
    @Test
    fun `should not allow arbitrary classes on the classpath`() {
        val allowedResourceTypes = pbacRegistryService.getAllowedResourceTypes()

        assertFalse("java.lang.System" in allowedResourceTypes)
        assertFalse("java.lang.Runtime" in allowedResourceTypes)
        assertFalse("java.lang.ProcessBuilder" in allowedResourceTypes)
        assertFalse(PbacRegistryService::class.java.name in allowedResourceTypes)
        assertFalse(Action::class.java.name in allowedResourceTypes)
    }

    @Test
    fun `should cache the allowed resource types`() {
        assertSame(
            pbacRegistryService.getAllowedResourceTypes(),
            pbacRegistryService.getAllowedResourceTypes(),
        )
    }

    /**
     * The allowlist is used on a request path that the frontend calls on nearly every page, so it
     * must not drag in the full registry build. That build additionally walks the fields of every
     * resource class reflectively.
     */
    @Test
    fun `should not build the registry metadata to determine the allowed resource types`() {
        pbacRegistryService.getAllowedResourceTypes()

        assertNull(cachedRegistryMetadata())

        // The metadata cache is populated by the registry itself, which confirms that reading the
        // field above is a meaningful assertion.
        pbacRegistryService.getRegistry()

        assertNotNull(cachedRegistryMetadata())
    }

    private fun cachedRegistryMetadata(): Any? {
        return PbacRegistryService::class.java
            .getDeclaredField("cachedRegistryMetadata")
            .apply { isAccessible = true }
            .get(pbacRegistryService)
    }
}
