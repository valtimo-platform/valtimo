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

package com.ritense.zakenapi

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.net.URI
import java.util.UUID

internal class ExtractUuidTest {

    private val uuid = UUID.fromString("e1e96e94-e7ff-47d1-9ea1-7c7c81713480")

    @Test
    fun `should extract UUID from URI`() {
        val uri = URI("https://example.com/zaken/$uuid")

        val result = ExtractUuid.extractUuidFromUri(uri)

        assertThat(result).isEqualTo(uuid)
    }

    @Test
    fun `should return null when URI last segment is not a UUID`() {
        val uri = URI("https://example.com/zaken/not-a-uuid")

        val result = ExtractUuid.extractUuidFromUri(uri)

        assertThat(result).isNull()
    }

    @Test
    fun `should return null when URI ends with a trailing slash`() {
        val uri = URI("https://example.com/zaken/$uuid/")

        val result = ExtractUuid.extractUuidFromUri(uri)

        assertThat(result).isNull()
    }

    @Test
    fun `should extract UUID from string`() {
        val result = ExtractUuid.extractUuidFromUri("https://example.com/zaken/$uuid")

        assertThat(result).isEqualTo(uuid)
    }

    @Test
    fun `should return null when string is not a valid URI`() {
        val result = ExtractUuid.extractUuidFromUri("not a valid uri")

        assertThat(result).isNull()
    }
}