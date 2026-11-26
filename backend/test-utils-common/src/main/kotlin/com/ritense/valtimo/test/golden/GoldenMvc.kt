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
import com.fasterxml.jackson.databind.node.TextNode
import org.springframework.test.web.servlet.MvcResult

/**
 * Compares an MVC response, as `{status, contentType, body}`, against a golden file. Ignore paths start at that
 * envelope, so a body field is `/body/...`.
 */
object GoldenMvc {

    private val mapper = ObjectMapper()

    @JvmStatic
    @JvmOverloads
    fun assertMatchesGolden(
        testClass: Class<*>,
        name: String,
        result: MvcResult,
        ignorePaths: Collection<String> = emptyList(),
        unorderedPaths: Collection<String> = emptyList(),
    ) {
        val response = result.response
        val text = response.getContentAsString(Charsets.UTF_8)
        val body = if (text.isBlank()) {
            mapper.nullNode()
        } else {
            runCatching { mapper.readTree(text) }.getOrElse { TextNode(text) }
        }
        val envelope = mapper.createObjectNode()
            .put("status", response.status)
            .put("contentType", response.contentType)
            .set<JsonNode>("body", body)
        GoldenJson.assertMatchesGolden(testClass, name, mapper.writeValueAsString(envelope), ignorePaths, unorderedPaths)
    }
}
