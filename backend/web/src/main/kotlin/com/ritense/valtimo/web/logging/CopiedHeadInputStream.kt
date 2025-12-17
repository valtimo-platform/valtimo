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

package com.ritense.valtimo.web.logging

import io.github.oshai.kotlinlogging.KotlinLogging
import java.io.IOException
import java.io.InputStream

class CopiedHeadInputStream(
    val inputStream: InputStream,
    val buffer: IntArray = IntArray(DEFAULT_BUFFER_SIZE),
    val onHeadReady: (ByteArray) -> Unit = { _: ByteArray -> }
) : InputStream() {
    private var index: Int = 0

    private var closed: Boolean = false
    private var headSent: Boolean = false
    private val byteBuffer: ByteArray = ByteArray(buffer.size)

    override fun read(): Int {
        checkClosed()
        val b = inputStream.read()
        if (b == -1) {
            maybeSendHead()
            return -1
        }

        if (index < buffer.size) {
            buffer[index] = b
            byteBuffer[index] = b.toByte()
            index++
            if (index == buffer.size) {
                maybeSendHead()
            }
        } else {
            // Buffer already full, ensure we sent the head
            maybeSendHead()
        }
        return b
    }

    override fun read(b: ByteArray): Int {
        checkClosed()
        return super.read(b)
    }

    override fun read(b: ByteArray, off: Int, len: Int): Int {
        checkClosed()
        return super.read(b, off, len)
    }

    override fun skip(n: Long): Long {
        checkClosed()
        return inputStream.skip(n)
    }

    override fun available(): Int {
        checkClosed()
        return inputStream.available()
    }

    override fun close() {
        if (!closed) {
            closed = true
            inputStream.close()
        }
    }

    override fun mark(readlimit: Int) = inputStream.mark(readlimit)
    override fun reset() = inputStream.reset()
    override fun markSupported() = inputStream.markSupported()

    private fun checkClosed() {
        if (closed) {
            throw IOException("Stream is closed")
        }
    }

    private fun maybeSendHead() {
        if (headSent) return
        val length = validUtf8PrefixLength(byteBuffer, index)
        val head = byteBuffer.copyOfRange(0, length)
        onHeadReady(head)
        headSent = true
    }

    /**
     * Returns the length (in bytes) of the longest valid UTF-8 prefix
     * within bytes[0, currentIndex). If currentIndex ends in a partial
     * multi-byte sequence, the incomplete tail is trimmed off.
     */
    private fun validUtf8PrefixLength(bytes: ByteArray, currentIndex: Int): Int {
        var i = currentIndex
        if (i <= 0) return 0

        // Fast-path: if last byte ends a sequence properly, return as-is
        // We still need to verify only the tail; scanning backwards to the start of the last sequence
        var k = i - 1
        // Count continuation bytes (10xxxxxx)
        var cont = 0
        while (k >= 0 && (bytes[k].toInt() and 0xC0) == 0x80) {
            cont++
            k--
        }

        if (k < 0) {
            // Buffer ends with continuation bytes without a lead byte in view -> drop them
            return i - cont
        }

        val lead = bytes[k].toInt() and 0xFF
        val expected = when {
            (lead and 0x80) == 0x00 -> 1
            (lead and 0xE0) == 0xC0 -> 2
            (lead and 0xF0) == 0xE0 -> 3
            (lead and 0xF8) == 0xF0 -> 4
            else -> 1 // invalid lead; treat as single byte to avoid negative cut
        }

        return if (cont >= expected - 1 && k + expected <= i) {
            // Last sequence complete
            i
        } else {
            // Trim incomplete sequence starting at k
            k
        }
    }

    companion object {
        val logger = KotlinLogging.logger {}
    }
}