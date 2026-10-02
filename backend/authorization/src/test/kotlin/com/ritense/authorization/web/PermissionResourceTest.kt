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

package com.ritense.authorization.web

import com.ritense.authorization.AuthorizationResourceTypeResolver
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.PbacRegistryService
import com.ritense.authorization.request.AuthorizationRequest
import com.ritense.authorization.testimpl.RelatedTestEntity
import com.ritense.authorization.testimpl.StaticInitializerProbeFlag
import com.ritense.authorization.testimpl.TestEntity
import com.ritense.authorization.web.request.PermissionAvailableRequest
import com.ritense.authorization.web.request.PermissionContext
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PermissionResourceTest {

    private lateinit var authorizationService: AuthorizationService
    private lateinit var pbacRegistryService: PbacRegistryService
    private lateinit var permissionResource: PermissionResource

    @BeforeEach
    fun setUp() {
        authorizationService = mock()
        pbacRegistryService = mock()
        whenever(pbacRegistryService.getAllowedResourceTypes()).thenReturn(
            setOf(
                TestEntity::class.java.name,
                RelatedTestEntity::class.java.name,
            )
        )
        permissionResource = PermissionResource(
            authorizationService,
            AuthorizationResourceTypeResolver(pbacRegistryService),
        )
    }

    /**
     * The regression test for the reported issue. `Class.forName(String)` initializes the class it
     * loads, so before the allowlist was introduced any authenticated caller could run the static
     * initializer of any class on the classpath by naming it in the request body.
     */
    @Test
    fun `should not run the static initializer of a class named in the request`() {
        val probeName = "com.ritense.authorization.testimpl.StaticInitializerProbe"

        assertFalse(
            StaticInitializerProbeFlag.initialized,
            "The probe must not have been initialized before the request",
        )

        val response = permissionResource.userHasPermission(
            listOf(PermissionAvailableRequest(probeName, "view"))
        )

        assertEquals(false, response.body!!.single().available)
        assertFalse(
            StaticInitializerProbeFlag.initialized,
            "The static initializer of a resource type named in the request was run, " +
                "so the class was loaded before it was checked against the allowlist",
        )
        verify(authorizationService, never()).hasPermission(any<AuthorizationRequest<Any>>())

        // Proves the probe is actually observable, so the assertions above cannot pass by accident.
        Class.forName(probeName)
        assertTrue(
            StaticInitializerProbeFlag.initialized,
            "The probe does not observe class initialization, so this test proves nothing",
        )
    }

    @Test
    fun `should report no permission for an unknown resource type`() {
        val response = permissionResource.userHasPermission(
            listOf(PermissionAvailableRequest("java.lang.System", "view"))
        )

        val result = response.body!!.single()
        assertEquals("java.lang.System", result.resource)
        assertEquals("view", result.action)
        assertEquals(false, result.available)
    }

    @Test
    fun `should report no permission when the context resource type is unknown`() {
        val response = permissionResource.userHasPermission(
            listOf(
                PermissionAvailableRequest(
                    TestEntity::class.java.name,
                    "view",
                    PermissionContext("java.lang.System", "123"),
                )
            )
        )

        assertEquals(false, response.body!!.single().available)
        verify(authorizationService, never()).hasPermission(any<AuthorizationRequest<Any>>())
    }

    @Test
    fun `should evaluate a known resource type`() {
        whenever(authorizationService.hasPermission(any<AuthorizationRequest<Any>>())).thenReturn(true)

        val response = permissionResource.userHasPermission(
            listOf(
                PermissionAvailableRequest(
                    TestEntity::class.java.name,
                    "view",
                    PermissionContext(RelatedTestEntity::class.java.name, "123"),
                )
            )
        )

        assertEquals(true, response.body!!.single().available)
        verify(authorizationService).hasPermission(any<AuthorizationRequest<Any>>())
    }

    @Test
    fun `should keep evaluating the other entries when one resource type is unknown`() {
        whenever(authorizationService.hasPermission(any<AuthorizationRequest<Any>>())).thenReturn(true)

        val response = permissionResource.userHasPermission(
            listOf(
                PermissionAvailableRequest("java.lang.System", "view"),
                PermissionAvailableRequest(TestEntity::class.java.name, "view"),
            )
        )

        val results = response.body!!
        assertEquals(2, results.size)
        assertEquals(false, results[0].available)
        assertEquals(true, results[1].available)
    }
}
