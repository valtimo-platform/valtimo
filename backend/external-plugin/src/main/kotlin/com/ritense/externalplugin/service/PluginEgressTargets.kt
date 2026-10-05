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
import java.net.URI

/**
 * The `x-egress-target` half of the `http_request` egress allowlist.
 *
 * A plugin's egress targets come from two places, and which one applies is decided by who actually
 * knows the value. Fixed services the author calls in every environment (`api.kvk.nl`) are declared
 * in `manifest.permissions.egress` and granted through the acceptance screen. A target that differs
 * per customer or environment (`https://smartdocuments.acme-acc.internal:8443`) is not knowable at
 * build time — declaring it in a manifest would force either a wildcard broad enough to be
 * meaningless or a per-environment rebuild — so the author instead marks the *configuration property*
 * that holds it with `x-egress-target: true`, and the admin typing the value **is** the grant. No
 * grant table and no separate acceptance step: the value is already something the admin entered and
 * can see.
 *
 * `x-egress-target` follows the `x-secret` precedent — a JSON-Schema keyword the plugin author puts
 * on a property that GZAC walks server-side to decide behaviour (see
 * [PluginPropertyEncryptor.secretFieldNames]). Like that walker, only top-level properties are
 * inspected.
 *
 * Origins are normalised the same way the plugin host and the SDK's `manifest-validation` do (see
 * `@valtimo/plugin-sdk/egress`), so a value GZAC accepts at activation is the value the host
 * enforces: scheme + host + port, with an absent port meaning the scheme's default port — never
 * "any port".
 */
object PluginEgressTargets {

    private val DEFAULT_PORTS = mapOf("http" to 80, "https" to 443)

    /** Names of the top-level configuration properties marked `x-egress-target: true`. */
    fun egressTargetFieldNames(schema: JsonNode?): Set<String> {
        val schemaProperties = schema?.get("properties") ?: return emptySet()
        return schemaProperties.fields().asSequence()
            .filter { (_, fieldSchema) -> fieldSchema?.get("x-egress-target")?.asBoolean(false) == true }
            .map { (field, _) -> field }
            .toSet()
    }

    /**
     * Canonical `scheme://host:port` for one property value, or null when it is not a usable
     * absolute URL. Callers reject the configuration on null rather than dropping the entry — an
     * unparseable value that silently contributes nothing would leave the admin believing they had
     * granted a destination the host will refuse.
     */
    fun normalizeOrigin(value: String?): String? {
        val trimmed = value?.trim().orEmpty()
        if (trimmed.isEmpty()) return null
        val uri = try {
            URI(trimmed)
        } catch (_: Exception) {
            return null
        }
        val scheme = uri.scheme?.lowercase() ?: return null
        val defaultPort = DEFAULT_PORTS[scheme] ?: return null
        val host = uri.host?.lowercase()
        if (host.isNullOrEmpty()) return null
        if (uri.userInfo != null) return null
        val port = if (uri.port == -1) defaultPort else uri.port
        return "$scheme://$host:$port"
    }

    /**
     * The origins to grant from a configuration's own properties. Returns the origins for every
     * marked property that carries a value; [missingOrInvalid] names the marked properties whose
     * value could not be turned into an origin, so the caller can fail the activation with a message
     * that points at the field.
     *
     * A marked property with no value at all is *not* an error — the property may be optional, and
     * an unset optional URL simply grants nothing.
     */
    fun deriveFrom(schema: JsonNode?, properties: JsonNode?): DerivedEgress {
        val origins = linkedSetOf<String>()
        val invalid = mutableListOf<String>()
        egressTargetFieldNames(schema).forEach { field ->
            val value = properties?.get(field)
            if (value == null || value.isNull) return@forEach
            if (!value.isTextual) {
                invalid += field
                return@forEach
            }
            val text = value.asText().trim()
            // An optional URL the admin left blank grants nothing; that is not an error.
            if (text.isEmpty()) return@forEach
            val origin = normalizeOrigin(text)
            if (origin == null) invalid += field else origins += origin
        }
        return DerivedEgress(origins.toList(), invalid)
    }

    data class DerivedEgress(
        val origins: List<String>,
        val missingOrInvalid: List<String>,
    )
}
