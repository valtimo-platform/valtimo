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

package com.ritense.assistant.service

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class TikaAttachmentTextExtractorTest {

    private val extractor = TikaAttachmentTextExtractor()

    @Test
    fun `should extract text from plain text file`() {
        val content = "Hello, this is test content."
        val inputStream = content.byteInputStream()

        val result = extractor.extractText(inputStream, "test.txt", "text/plain")

        assertNotNull(result)
        assertEquals("Hello, this is test content.", result)
    }

    @Test
    fun `should return null for empty content`() {
        val inputStream = "".byteInputStream()

        val result = extractor.extractText(inputStream, "empty.txt", "text/plain")

        assertNull(result)
    }

    @Test
    fun `should truncate text to max length`() {
        val extractor = TikaAttachmentTextExtractor(maxTextLength = 10)
        val content = "This is a very long text that should be truncated"
        val inputStream = content.byteInputStream()

        val result = extractor.extractText(inputStream, "test.txt", "text/plain")

        assertNotNull(result)
        assertTrue(result.length <= 10)
    }

    @Test
    fun `should return true for supported mime types`() {
        assertTrue(extractor.isSupported("application/pdf"))
        assertTrue(extractor.isSupported("text/plain"))
        assertTrue(extractor.isSupported("application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
        assertTrue(extractor.isSupported("application/json"))
    }

    @Test
    fun `should return false for unsupported mime types`() {
        assertTrue(!extractor.isSupported("image/png"))
        assertTrue(!extractor.isSupported("video/mp4"))
        assertTrue(!extractor.isSupported(null))
    }

    @Test
    fun `should handle mime type with charset parameter`() {
        assertTrue(extractor.isSupported("text/plain; charset=utf-8"))
    }

    @Test
    fun `supportedMimeTypes should return expected set`() {
        val supported = extractor.supportedMimeTypes()

        assertTrue(supported.contains("application/pdf"))
        assertTrue(supported.contains("text/plain"))
        assertTrue(supported.contains("application/json"))
    }
}
