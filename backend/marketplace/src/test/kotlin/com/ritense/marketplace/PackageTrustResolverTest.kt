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

package com.ritense.marketplace

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test

class PackageTrustResolverTest {

    private val resolver = PackageTrustResolver(listOf("valtimo-platform", "generiekzaakafhandelcomponent"))

    @Test
    fun `should mark a package from a trusted organisation as verified`() {
        assertEquals(
            PackageTrust.VERIFIED,
            resolver.resolve("https://github.com/valtimo-platform/freemarker-plugin")
        )
        assertEquals(
            PackageTrust.VERIFIED,
            resolver.resolve("https://github.com/generiekzaakafhandelcomponent/haal-centraal-plugin")
        )
    }

    @Test
    fun `should mark a package from any other organisation as community`() {
        assertEquals(
            PackageTrust.COMMUNITY,
            resolver.resolve("https://github.com/some-other-org/rogue-plugin")
        )
    }

    @Test
    fun `should mark a package without a source repository as unknown`() {
        // Distinguished from COMMUNITY on purpose: an absent origin is not the same as a
        // known-but-untrusted one, and the UI says so.
        assertEquals(PackageTrust.UNKNOWN, resolver.resolve(null))
        assertEquals(PackageTrust.UNKNOWN, resolver.resolve(""))
        assertEquals(PackageTrust.UNKNOWN, resolver.resolve("   "))
        assertEquals(PackageTrust.UNKNOWN, resolver.resolve("https://example.com/some/path"))
    }

    @Test
    fun `should match the organisation regardless of casing`() {
        assertEquals(
            PackageTrust.VERIFIED,
            resolver.resolve("https://GitHub.com/Valtimo-Platform/freemarker-plugin")
        )
    }

    @Test
    fun `should read the owner from the org and ssh url forms`() {
        assertEquals("valtimo-platform", resolver.ownerOf("https://github.com/orgs/valtimo-platform"))
        assertEquals("valtimo-platform", resolver.ownerOf("git@github.com:valtimo-platform/freemarker-plugin"))
        assertNull(resolver.ownerOf(null))
    }
}
