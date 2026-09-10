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

package com.ritense.externalplugin.domain

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.util.UUID

/**
 * Decides which of the two re-acceptance prompts an admin sees, so a rebuilt package that asks for
 * nothing new is never presented as a permission change.
 */
class ExternalPluginDefinitionTest {

    private val objectMapper = ObjectMapper()

    @Test
    fun `a rebuilt package with an identical footprint is not a permission change`() {
        val definition = definition(
            accepted = manifest(capabilities = listOf("gzac_api", "log")),
            pending = manifest(capabilities = listOf("log", "gzac_api")),
        )

        assertThat(definition.pendingPermissionsChanged).isFalse()
    }

    @Test
    fun `an added capability is a permission change`() {
        val definition = definition(
            accepted = manifest(capabilities = listOf("gzac_api")),
            pending = manifest(capabilities = listOf("gzac_api", "http_request")),
        )

        assertThat(definition.pendingPermissionsChanged).isTrue()
    }

    @Test
    fun `a removed capability is a permission change`() {
        val definition = definition(
            accepted = manifest(capabilities = listOf("gzac_api", "kv")),
            pending = manifest(capabilities = listOf("gzac_api")),
        )

        assertThat(definition.pendingPermissionsChanged).isTrue()
    }

    @Test
    fun `an added egress target is a permission change`() {
        val definition = definition(
            accepted = manifest(egress = listOf("api.kvk.nl")),
            pending = manifest(egress = listOf("api.kvk.nl", "some.hacker.com")),
        )

        assertThat(definition.pendingPermissionsChanged).isTrue()
    }

    @Test
    fun `an added endpoint is a permission change`() {
        val definition = definition(
            accepted = manifest(endpoints = listOf("GET" to "/api/v1/document/*")),
            pending = manifest(
                endpoints = listOf("GET" to "/api/v1/document/*", "POST" to "/api/v1/task/*/complete")
            ),
        )

        assertThat(definition.pendingPermissionsChanged).isTrue()
    }

    @Test
    fun `an added event subscription is a permission change`() {
        val definition = definition(
            accepted = manifest(events = listOf("com.ritense.valtimo.document.created")),
            pending = manifest(
                events = listOf("com.ritense.valtimo.document.created", "com.ritense.valtimo.task.completed")
            ),
        )

        assertThat(definition.pendingPermissionsChanged).isTrue()
    }

    @Test
    fun `a change outside the permission block is not a permission change`() {
        val accepted = manifest(capabilities = listOf("gzac_api"))
        val pending = manifest(capabilities = listOf("gzac_api")).apply { put("provider", "Someone else") }

        assertThat(definition(accepted, pending).pendingPermissionsChanged).isFalse()
    }

    @Test
    fun `nothing pending is never a permission change`() {
        val definition = definition(accepted = manifest(capabilities = listOf("gzac_api")), pending = null)

        assertThat(definition.pendingPermissionsChanged).isFalse()
        assertThat(definition.requiresReacceptance).isFalse()
    }

    private fun definition(accepted: ObjectNode?, pending: ObjectNode?) = ExternalPluginDefinition(
        id = UUID.randomUUID(),
        pluginId = "case-summary",
        version = "0.1.0",
        hostId = UUID.randomUUID(),
        baseUrl = "http://localhost:8090/plugins/case-summary",
        status = ExternalPluginDefinitionStatus.AVAILABLE,
        manifestJson = accepted,
        contentHash = "sha256:accepted",
        pendingContentHash = pending?.let { "sha256:pending" },
        pendingManifestJson = pending,
    )

    private fun manifest(
        capabilities: List<String> = emptyList(),
        egress: List<String> = emptyList(),
        endpoints: List<Pair<String, String>> = emptyList(),
        events: List<String> = emptyList(),
    ): ObjectNode = objectMapper.createObjectNode().apply {
        putObject("permissions").apply {
            putArray("capabilities").apply { capabilities.forEach { add(it) } }
            putArray("egress").apply { egress.forEach { add(it) } }
            putArray("endpoints").apply {
                endpoints.forEach { (method, pattern) ->
                    addObject().put("method", method).put("pattern", pattern)
                }
            }
        }
        putArray("eventSubscriptions").apply { events.forEach { add(it) } }
    }
}
