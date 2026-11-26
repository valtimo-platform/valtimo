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

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.SerializationFeature
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.JsonNodeFactory
import com.fasterxml.jackson.databind.node.ObjectNode
import com.fasterxml.jackson.databind.node.TextNode
import org.skyscreamer.jsonassert.JSONAssert
import org.skyscreamer.jsonassert.JSONCompareMode
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths

/**
 * Compares JSON against a golden file recorded on an earlier build.
 *
 * Golden files live in `src/test/resources/golden/<TestClass>/<name>.json` of the module under test. They are written
 * only when the environment variable `VALTIMO_GOLDEN_UPDATE` (or system property `valtimo.golden.update`) is `true`.
 *
 * Before comparing, UUIDs become `<uuid>` and date strings become `<date:...>` with only their digits masked, so a
 * change in date format, precision or zone still fails. Paths in `ignorePaths` become `<ignored:type>`; a `*` segment
 * matches any field or array index. Object key order is ignored, array order is not, except for arrays at
 * `unorderedPaths`, whose elements are sorted after normalising.
 */
object GoldenJson {

    private val mapper = ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT)
    private val uuidPattern = Regex("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
    private val datePattern = Regex(
        """\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}([.,]\d+)?)?)?(Z|[+-]\d{2}(:?\d{2})?)?(\[[^\]]+])?"""
    )

    @JvmStatic
    @JvmOverloads
    fun assertMatchesGolden(
        testClass: Class<*>,
        name: String,
        actualJson: String,
        ignorePaths: Collection<String> = emptyList(),
        unorderedPaths: Collection<String> = emptyList(),
    ) {
        val actual = normalize(actualJson, ignorePaths, unorderedPaths)
        val baseFile = goldenFile(testClass, name, ".json")
        val variantFile = goldenFile(testClass, name, ".mysql.json")

        if (isUpdateMode()) {
            record(actual, baseFile, variantFile)
            return
        }

        val expectedFile = if (isMysql() && Files.exists(variantFile)) variantFile else baseFile
        check(Files.exists(expectedFile)) {
            "No golden file at $expectedFile. Golden files are recorded on the baseline build only."
        }
        val expected = mapper.readTree(Files.readString(expectedFile))
        reportKeyOrder(expected, actual, "", "${testClass.simpleName}/$name")
        try {
            JSONAssert.assertEquals(toText(expected), toText(actual), JSONCompareMode.STRICT)
        } catch (e: AssertionError) {
            val actualFile = Paths.get("build", "golden-actual", testClass.simpleName, "$name.json")
            Files.createDirectories(actualFile.parent)
            Files.writeString(actualFile, toText(actual))
            throw AssertionError("Golden mismatch for $expectedFile (actual written to $actualFile): ${e.message}", e)
        }
    }

    @JvmStatic
    @JvmOverloads
    fun normalize(
        json: String,
        ignorePaths: Collection<String> = emptyList(),
        unorderedPaths: Collection<String> = emptyList(),
    ): JsonNode = normalizeNode(mapper.readTree(json), emptyList(), parse(ignorePaths), parse(unorderedPaths))

    @JvmStatic
    fun normalizeText(value: String): String {
        if (datePattern.matches(value)) {
            return "<date:${value.replace(Regex("\\d"), "d")}>"
        }
        return uuidPattern.replace(value, "<uuid>")
    }

    fun toText(node: JsonNode): String = mapper.writeValueAsString(node) + "\n"

    internal fun isUpdateMode(): Boolean =
        System.getenv("VALTIMO_GOLDEN_UPDATE") == "true" || System.getProperty("valtimo.golden.update") == "true"

    internal fun isMysql(): Boolean =
        System.getProperty("spring.profiles.include")?.split(',')?.contains("mysql") == true

    internal fun goldenFile(testClass: Class<*>, name: String, suffix: String): Path =
        Paths.get("src", "test", "resources", "golden", testClass.simpleName, name + suffix)

    private fun record(actual: JsonNode, baseFile: Path, variantFile: Path) {
        val target = if (isMysql() && Files.exists(baseFile)) {
            val base = mapper.readTree(Files.readString(baseFile))
            if (base == actual) return
            variantFile
        } else {
            baseFile
        }
        Files.createDirectories(target.parent)
        Files.writeString(target, toText(actual))
    }

    private fun parse(paths: Collection<String>): List<List<String>> =
        paths.map { path -> path.trim('/').split('/').filter { it.isNotEmpty() } }

    private fun normalizeNode(
        node: JsonNode,
        path: List<String>,
        ignorePaths: List<List<String>>,
        unorderedPaths: List<List<String>>,
    ): JsonNode {
        if (ignorePaths.any { matches(it, path) }) {
            return TextNode("<ignored:${node.nodeType.name.lowercase()}>")
        }
        return when (node) {
            is ObjectNode -> {
                val result = JsonNodeFactory.instance.objectNode()
                node.properties().forEach { (key, value) ->
                    var normalizedKey = normalizeText(key)
                    var suffix = 2
                    while (result.has(normalizedKey)) {
                        normalizedKey = "${normalizeText(key)}~${suffix++}"
                    }
                    result.set<JsonNode>(normalizedKey, normalizeNode(value, path + key, ignorePaths, unorderedPaths))
                }
                result
            }
            is ArrayNode -> {
                val elements = node.mapIndexed { index, value ->
                    normalizeNode(value, path + index.toString(), ignorePaths, unorderedPaths)
                }
                val sorted = if (unorderedPaths.any { matches(it, path) }) {
                    elements.sortedBy { mapper.writeValueAsString(it) }
                } else {
                    elements
                }
                JsonNodeFactory.instance.arrayNode().addAll(sorted)
            }
            is TextNode -> TextNode(normalizeText(node.textValue()))
            else -> node
        }
    }

    private fun matches(pattern: List<String>, path: List<String>): Boolean =
        pattern.size == path.size && pattern.zip(path).all { (p, s) -> p == "*" || p == s }

    private fun reportKeyOrder(expected: JsonNode, actual: JsonNode, path: String, label: String) {
        if (expected is ObjectNode && actual is ObjectNode) {
            val expectedKeys = expected.fieldNames().asSequence().toList()
            val actualKeys = actual.fieldNames().asSequence().toList()
            if (expectedKeys.toSet() == actualKeys.toSet() && expectedKeys != actualKeys) {
                println("[golden] key order changed in $label at '${path.ifEmpty { "/" }}': $expectedKeys -> $actualKeys")
            }
            expectedKeys.filter { actual.has(it) }.forEach {
                reportKeyOrder(expected.get(it), actual.get(it), "$path/$it", label)
            }
        } else if (expected is ArrayNode && actual is ArrayNode) {
            (0 until minOf(expected.size(), actual.size())).forEach {
                reportKeyOrder(expected.get(it), actual.get(it), "$path/$it", label)
            }
        }
    }
}
