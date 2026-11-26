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

package com.ritense.valtimo.test.golden

import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Assertions.assertEquals
import java.io.ByteArrayInputStream
import java.nio.file.Files
import java.nio.file.Path
import java.util.zip.ZipInputStream

/**
 * Compares a zip against golden files: one for the sorted list of entry names, one per entry. JSON entries go through
 * [GoldenJson]; other entries are compared as text with normalised line endings. Recording also keeps the zip itself,
 * so later builds can import what the baseline exported.
 */
object GoldenZip {

    private val mapper = ObjectMapper()

    @JvmStatic
    @JvmOverloads
    fun assertMatchesGolden(
        testClass: Class<*>,
        name: String,
        zip: ByteArray,
        ignorePaths: Map<String, Collection<String>> = emptyMap(),
        unorderedPaths: Map<String, Collection<String>> = emptyMap(),
    ) {
        if (GoldenJson.isUpdateMode() && !GoldenJson.isMysql()) {
            val file = recordedZip(testClass, name)
            Files.createDirectories(file.parent)
            Files.write(file, zip)
        }
        val entries = readEntries(zip)
        GoldenJson.assertMatchesGolden(testClass, "$name/entries", mapper.writeValueAsString(entries.keys.toList()))
        entries.forEach { (entryName, content) ->
            if (entryName.endsWith(".json")) {
                GoldenJson.assertMatchesGolden(
                    testClass,
                    "$name/${entryName.removeSuffix(".json")}",
                    content,
                    ignorePaths[entryName] ?: emptyList(),
                    unorderedPaths[entryName] ?: emptyList(),
                )
            } else {
                assertMatchesGoldenText(testClass, "$name/$entryName", content)
            }
        }
    }

    @JvmStatic
    fun recordedZip(testClass: Class<*>, name: String): Path = GoldenJson.goldenFile(testClass, name, ".zip")

    @JvmStatic
    fun assertMatchesGoldenText(testClass: Class<*>, name: String, actualText: String) {
        val actual = actualText.replace("\r\n", "\n")
        val file = GoldenJson.goldenFile(testClass, name, "")
        if (GoldenJson.isUpdateMode()) {
            Files.createDirectories(file.parent)
            Files.writeString(file, actual)
            return
        }
        check(Files.exists(file)) { "No golden file at $file. Golden files are recorded on the baseline build only." }
        assertEquals(Files.readString(file), actual, "Golden mismatch for $file")
    }

    private fun readEntries(zip: ByteArray): Map<String, String> {
        val entries = sortedMapOf<String, String>()
        ZipInputStream(ByteArrayInputStream(zip)).use { stream ->
            generateSequence { stream.nextEntry }
                .filterNot { it.isDirectory }
                .forEach { entries[it.name] = String(stream.readAllBytes(), Charsets.UTF_8) }
        }
        return entries
    }
}
