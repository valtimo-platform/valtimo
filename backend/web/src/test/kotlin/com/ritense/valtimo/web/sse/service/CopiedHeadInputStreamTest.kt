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

package com.ritense.valtimo.web.sse.service

import com.ritense.valtimo.web.logging.CopiedHeadInputStream
import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.text.Charsets.UTF_8

class CopiedHeadInputStreamTest {

    @Test
    fun `should copy head of stream without altering original stream`() {
        val inputStream = "0123456789".byteInputStream(UTF_8)

        val inStream = CopiedHeadInputStream(inputStream, IntArray(5)) { head ->
            assertEquals("01234", String(head))
        }

        val result = inStream.bufferedReader().use { it.readText() }
        assertEquals("0123456789", result)
    }

    @Test
    fun `should handle multiple EOF`() {
        val result = mutableListOf<ByteArray>()
        val inStream = CopiedHeadInputStream(
            inputStream = "012".byteInputStream(UTF_8),
            buffer = IntArray(5),
            onHeadReady = { head -> result += head }
        )
        assertArrayEquals("012".toByteArray(), inStream.readBytes())

        // When
        repeat(3) { assertEquals(-1, inStream.read()) }

        // Then
        assertEquals(1, result.size)
        assertEquals("012", String(result.first(), UTF_8))
    }
}