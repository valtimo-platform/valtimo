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

import jakarta.persistence.AttributeConverter
import jakarta.persistence.Converter

/**
 * The host functions an external plugin can be granted access to. Mirrors `HOST_CAPABILITIES` in
 * the plugin SDK (`plugin-host/plugin-sdk/src/models/types.ts`) — the two lists must stay in sync.
 *
 * [value] is the wire/manifest representation (`manifest.permissions.capabilities`, the config
 * push to the host, and the `capability` database column all carry this lowercase form).
 */
enum class ExternalPluginCapability(val value: String) {
    GZAC_API("gzac_api"),
    HTTP_REQUEST("http_request"),
    KV("kv"),
    LOG("log");

    companion object {
        fun fromValue(value: String): ExternalPluginCapability = entries.firstOrNull { it.value == value }
            ?: throw IllegalArgumentException(
                "Unknown capability '$value'. Known capabilities: ${entries.joinToString(", ") { it.value }}"
            )
    }
}

/**
 * Persists the wire representation ([ExternalPluginCapability.value]) rather than the enum name,
 * so the database column holds the same identifier the manifest and the host protocol use.
 */
@Converter
class ExternalPluginCapabilityConverter : AttributeConverter<ExternalPluginCapability, String> {

    override fun convertToDatabaseColumn(attribute: ExternalPluginCapability): String = attribute.value

    override fun convertToEntityAttribute(dbData: String): ExternalPluginCapability =
        ExternalPluginCapability.fromValue(dbData)
}
