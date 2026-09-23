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

import com.fasterxml.jackson.databind.JsonNode
import io.github.oshai.kotlinlogging.KotlinLogging

/**
 * Operator warnings for a plugin's configuration schema losing behaviour-carrying flags between
 * accepted manifests. Called wherever the stored (accepted) schema is about to be replaced — the
 * discovery upsert and the admin accept flow — so a flag drop is surfaced no matter which path
 * applies the new schema first.
 */
object PluginSchemaChangeWarnings {

    /**
     * A property that loses its `x-secret: true` flag between manifest versions silently changes
     * from "encrypted at rest, masked in the API" to plain text on the next save. That is almost
     * always a plugin-author mistake, so surface it loudly for the operator.
     */
    fun warnOnDroppedSecretFlags(pluginId: String, version: String, previousSchema: JsonNode?, newSchema: JsonNode?) {
        val previousSecrets = secretFieldNames(previousSchema)
        if (previousSecrets.isEmpty()) return
        val droppedSecrets = previousSecrets - secretFieldNames(newSchema)
        if (droppedSecrets.isNotEmpty()) {
            logger.warn {
                "Plugin '$pluginId@$version' dropped the x-secret flag from " +
                    "previously secret propert${if (droppedSecrets.size == 1) "y" else "ies"} " +
                    "${droppedSecrets.joinToString(", ")} in its new configuration schema — these values " +
                    "will no longer be encrypted or masked"
            }
        }
    }

    /**
     * A property that loses its `x-egress-target: true` flag stops contributing its URL to the
     * configuration's egress allowlist, so the next push silently narrows what the plugin can reach
     * and its outbound calls start failing. The mirror image of [warnOnDroppedSecretFlags]: almost
     * always a plugin-author mistake, and invisible without this.
     */
    fun warnOnDroppedEgressTargetFlags(pluginId: String, version: String, previousSchema: JsonNode?, newSchema: JsonNode?) {
        val previous = PluginEgressTargets.egressTargetFieldNames(previousSchema)
        if (previous.isEmpty()) return
        val dropped = previous - PluginEgressTargets.egressTargetFieldNames(newSchema)
        if (dropped.isNotEmpty()) {
            logger.warn {
                "Plugin '$pluginId@$version' dropped the x-egress-target flag from " +
                    "propert${if (dropped.size == 1) "y" else "ies"} ${dropped.joinToString(", ")} in its new " +
                    "configuration schema — the URLs they hold will no longer be allowed as http_request " +
                    "destinations, and calls to them will be refused"
            }
        }
    }

    private fun secretFieldNames(schema: JsonNode?): Set<String> {
        val schemaProperties = schema?.get("properties") ?: return emptySet()
        return schemaProperties.fields().asSequence()
            .filter { (_, fieldSchema) -> fieldSchema.get("x-secret")?.asBoolean(false) == true }
            .map { (field, _) -> field }
            .toSet()
    }

    private val logger = KotlinLogging.logger {}
}
