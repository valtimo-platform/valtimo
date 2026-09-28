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
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.plugin.service.EncryptionService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Component

/**
 * Walks a configuration JSON Schema, locates fields marked with `x-secret: true`, and encrypts /
 * decrypts the corresponding values in a properties payload using the existing
 * [EncryptionService]. Only top-level fields are inspected — nested objects and arrays are not
 * recursed.
 */
@Component
@SkipComponentScan
class PluginPropertyEncryptor(
    private val encryptionService: EncryptionService,
) {

    fun encryptSecretFields(properties: ObjectNode, schema: JsonNode?): ObjectNode {
        secretFieldNames(schema).forEach { field ->
            val value = properties.get(field)
            if (value != null && value.isTextual && value.asText().isNotEmpty()) {
                properties.put(field, encryptionService.encrypt(value.asText()))
            }
        }
        return properties
    }

    fun decryptSecretFields(properties: ObjectNode, schema: JsonNode?): ObjectNode {
        secretFieldNames(schema).forEach { field ->
            val value = properties.get(field)
            if (value != null && value.isTextual && value.asText().isNotEmpty()) {
                properties.put(field, encryptionService.decrypt(value.asText()))
            }
        }
        return properties
    }

    fun secretFieldNames(schema: JsonNode?): Set<String> {
        val schemaProperties = schema?.get("properties") ?: return emptySet()
        val secrets = mutableSetOf<String>()
        schemaProperties.fieldNames().forEachRemaining { field ->
            val fieldSchema = schemaProperties.get(field)
            if (fieldSchema?.get("x-secret")?.asBoolean(false) == true) {
                secrets += field
            }
        }
        return secrets
    }
}
