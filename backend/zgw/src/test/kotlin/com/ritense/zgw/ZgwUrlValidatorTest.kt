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

package com.ritense.zgw

import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.net.URI

class ZgwUrlValidatorTest {

    private val base = URI("https://oz.example.com/besluiten/api/v1")

    private fun under(baseUrl: URI, url: String) = ZgwUrlValidator.isUrlUnderBaseUrl(baseUrl, URI(url))

    @Test
    fun `should accept same url`() {
        assertTrue(under(base, "https://oz.example.com/besluiten/api/v1"))
    }

    @Test
    fun `should accept sub path`() {
        assertTrue(under(base, "https://oz.example.com/besluiten/api/v1/besluiten/123"))
    }

    @Test
    fun `should accept trailing slash variants`() {
        val baseWithSlash = URI("https://oz.example.com/besluiten/api/v1/")
        assertTrue(under(baseWithSlash, "https://oz.example.com/besluiten/api/v1"))
        assertTrue(under(baseWithSlash, "https://oz.example.com/besluiten/api/v1/"))
        assertTrue(under(baseWithSlash, "https://oz.example.com/besluiten/api/v1/besluiten/123"))
        assertTrue(under(base, "https://oz.example.com/besluiten/api/v1/"))
        assertTrue(under(base, "https://oz.example.com/besluiten/api/v1/besluiten/123/"))
    }

    @Test
    fun `should reject foreign host`() {
        assertFalse(under(base, "https://evil.example.org/besluiten/api/v1/besluiten/123"))
        assertFalse(under(base, "http://127.0.0.1:9999/steal-token"))
    }

    @Test
    fun `should reject subdomain suffix trick`() {
        assertFalse(under(base, "https://oz.example.com.evil.tld/besluiten/api/v1/besluiten/123"))
    }

    @Test
    fun `should reject user info trick`() {
        assertFalse(under(base, "https://oz.example.com@evil.tld/besluiten/api/v1/besluiten/123"))
        assertFalse(under(base, "https://user:pass@oz.example.com/besluiten/api/v1/besluiten/123"))
    }

    @Test
    fun `should accept user info equal to base user info`() {
        val baseWithUser = URI("https://user@oz.example.com/besluiten/api/v1")
        assertTrue(under(baseWithUser, "https://user@oz.example.com/besluiten/api/v1/besluiten/123"))
    }

    @Test
    fun `should reject scheme mismatch`() {
        assertFalse(under(base, "http://oz.example.com/besluiten/api/v1/besluiten/123"))
    }

    @Test
    fun `should reject port mismatch`() {
        assertFalse(under(base, "https://oz.example.com:8443/besluiten/api/v1/besluiten/123"))
    }

    @Test
    fun `should treat default ports as equivalent`() {
        assertTrue(under(base, "https://oz.example.com:443/besluiten/api/v1/besluiten/123"))
        assertTrue(under(URI("http://oz.example.com/api"), "http://oz.example.com:80/api/besluiten/123"))
        assertFalse(under(URI("http://oz.example.com/api"), "http://oz.example.com:443/api/besluiten/123"))
    }

    @Test
    fun `should reject dot dot traversal`() {
        assertFalse(under(base, "https://oz.example.com/besluiten/api/v1/../../../admin"))
        assertFalse(under(base, "https://oz.example.com/besluiten/api/v1/besluiten/../123"))
    }

    @Test
    fun `should reject path outside base`() {
        assertFalse(under(base, "https://oz.example.com/other/api/v1/besluiten/123"))
        assertFalse(under(base, "https://oz.example.com/besluiten/api/v10/besluiten/123"))
        assertFalse(under(base, "https://oz.example.com/besluiten/api"))
    }

    @Test
    fun `should reject opaque uri`() {
        assertFalse(under(base, "mailto:someone@oz.example.com"))
        assertFalse(ZgwUrlValidator.isUrlUnderBaseUrl(URI("mailto:someone@oz.example.com"), base))
    }

    @Test
    fun `should reject relative uri`() {
        assertFalse(under(base, "/besluiten/api/v1/besluiten/123"))
        assertFalse(under(base, "besluiten/123"))
    }

    @Test
    fun `should compare scheme and host case insensitively`() {
        assertTrue(under(base, "HTTPS://OZ.Example.COM/besluiten/api/v1/besluiten/123"))
    }
}
