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

package com.ritense.externalplugin.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

/**
 * The `x-egress-target` walker: how GZAC turns admin-entered configuration values into the
 * `http_request` destinations it pushes to the host.
 *
 * Origins have to normalise exactly as the host and the SDK validator do (`@valtimo/plugin-sdk/egress`)
 * — scheme + host + port, absent port meaning the scheme's default — or a value GZAC accepts at
 * activation would be refused at runtime.
 */
class PluginEgressTargetsTest {

    private val objectMapper = ObjectMapper()

    private fun schema(json: String): ObjectNode = objectMapper.readTree(json) as ObjectNode

    private fun properties(vararg pairs: Pair<String, String>): ObjectNode =
        objectMapper.createObjectNode().apply { pairs.forEach { (k, v) -> put(k, v) } }

    private val markedSchema = schema(
        """
        {
          "type": "object",
          "properties": {
            "smartDocumentsUrl": {"type": "string", "format": "uri", "x-egress-target": true},
            "apiKey": {"type": "string", "x-secret": true},
            "currency": {"type": "string"}
          }
        }
        """.trimIndent(),
    )

    @Test
    fun `finds only the marked top-level properties`() {
        assertThat(PluginEgressTargets.egressTargetFieldNames(markedSchema))
            .containsExactly("smartDocumentsUrl")
    }

    @Test
    fun `returns nothing for a schema with no properties or no schema at all`() {
        assertThat(PluginEgressTargets.egressTargetFieldNames(null)).isEmpty()
        assertThat(PluginEgressTargets.egressTargetFieldNames(schema("""{"type":"object"}"""))).isEmpty()
    }

    @Test
    fun `derives the origin of a marked property, dropping path and query`() {
        val derived = PluginEgressTargets.deriveFrom(
            markedSchema,
            properties("smartDocumentsUrl" to "https://sd.acme-acc.internal:8443/api/documents?v=2"),
        )

        assertThat(derived.origins).containsExactly("https://sd.acme-acc.internal:8443")
        assertThat(derived.missingOrInvalid).isEmpty()
    }

    @Test
    fun `fills in the scheme's default port so the host matches the same origin`() {
        assertThat(
            PluginEgressTargets.deriveFrom(
                markedSchema,
                properties("smartDocumentsUrl" to "https://sd.acme.internal/api"),
            ).origins
        ).containsExactly("https://sd.acme.internal:443")

        assertThat(
            PluginEgressTargets.deriveFrom(
                markedSchema,
                properties("smartDocumentsUrl" to "http://legacy.acme.internal/api"),
            ).origins
        ).containsExactly("http://legacy.acme.internal:80")
    }

    @Test
    fun `lower-cases the host so matching is case-insensitive on both sides`() {
        assertThat(
            PluginEgressTargets.deriveFrom(
                markedSchema,
                properties("smartDocumentsUrl" to "https://SD.ACME.INTERNAL:8443/x"),
            ).origins
        ).containsExactly("https://sd.acme.internal:8443")
    }

    @Test
    fun `treats a blank value as an optional property left unset, not an error`() {
        val derived = PluginEgressTargets.deriveFrom(markedSchema, properties("smartDocumentsUrl" to "   "))

        assertThat(derived.origins).isEmpty()
        assertThat(derived.missingOrInvalid).isEmpty()
    }

    @Test
    fun `ignores a marked property that is absent entirely`() {
        val derived = PluginEgressTargets.deriveFrom(markedSchema, properties("currency" to "EUR"))

        assertThat(derived.origins).isEmpty()
        assertThat(derived.missingOrInvalid).isEmpty()
    }

    @Test
    fun `reports a value that is not a parseable absolute URL rather than dropping it`() {
        // Fail closed: silently contributing nothing would leave the admin believing they granted a
        // destination the host refuses.
        for (bad in listOf("sd.internal:8443", "not a url", "/api/documents", "ftp://files.internal")) {
            val derived = PluginEgressTargets.deriveFrom(markedSchema, properties("smartDocumentsUrl" to bad))
            assertThat(derived.missingOrInvalid)
                .describedAs("value '%s' should be reported as invalid", bad)
                .containsExactly("smartDocumentsUrl")
            assertThat(derived.origins).isEmpty()
        }
    }

    @Test
    fun `reports a marked property holding a non-string value`() {
        val derived = PluginEgressTargets.deriveFrom(
            markedSchema,
            objectMapper.createObjectNode().put("smartDocumentsUrl", 8443),
        )

        assertThat(derived.missingOrInvalid).containsExactly("smartDocumentsUrl")
    }

    @Test
    fun `rejects a URL carrying credentials — the grant is an origin, not a credential store`() {
        val derived = PluginEgressTargets.deriveFrom(
            markedSchema,
            properties("smartDocumentsUrl" to "https://user:pass@sd.internal:8443/api"),
        )

        assertThat(derived.missingOrInvalid).containsExactly("smartDocumentsUrl")
    }

    @Test
    fun `dedupes two marked properties pointing at the same origin`() {
        val twoMarked = schema(
            """
            {
              "type": "object",
              "properties": {
                "readUrl": {"type": "string", "format": "uri", "x-egress-target": true},
                "writeUrl": {"type": "string", "format": "uri", "x-egress-target": true}
              }
            }
            """.trimIndent(),
        )

        val derived = PluginEgressTargets.deriveFrom(
            twoMarked,
            properties(
                "readUrl" to "https://sd.internal:8443/read",
                "writeUrl" to "https://sd.internal:8443/write",
            ),
        )

        assertThat(derived.origins).containsExactly("https://sd.internal:8443")
    }
}
