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
import com.networknt.schema.JsonSchemaFactory
import com.networknt.schema.SpecVersion
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

@Service
@SkipComponentScan
@Transactional
class ExternalPluginConfigurationService(
    private val configurationRepository: ExternalPluginConfigurationRepository,
    private val definitionRepository: ExternalPluginDefinitionRepository,
    private val propertyEncryptor: PluginPropertyEncryptor,
    private val objectMapper: ObjectMapper,
) {

    @Transactional(readOnly = true)
    fun list(definitionId: UUID? = null): List<ExternalPluginConfiguration> = if (definitionId != null) {
        configurationRepository.findAllByDefinitionId(definitionId)
    } else {
        configurationRepository.findAll()
    }

    @Transactional(readOnly = true)
    fun get(id: UUID): ExternalPluginConfiguration = configurationRepository.findById(id)
        .orElseThrow { IllegalArgumentException("External plugin configuration $id not found") }

    fun create(definitionId: UUID, title: String, properties: ObjectNode): ExternalPluginConfiguration {
        val definition = definitionRepository.findById(definitionId)
            .orElseThrow { IllegalArgumentException("External plugin definition $definitionId not found") }

        validateAgainstSchema(properties, definition.configSchema)

        val encrypted = propertyEncryptor.encryptSecretFields(properties.deepCopy(), definition.configSchema)

        val configuration = ExternalPluginConfiguration(
            id = UUID.randomUUID(),
            definitionId = definitionId,
            title = title,
            properties = encrypted,
            createdAt = Instant.now(),
        )
        return configurationRepository.save(configuration)
    }

    @Transactional(readOnly = true)
    fun decryptedProperties(configuration: ExternalPluginConfiguration): ObjectNode {
        val definition = definitionRepository.findById(configuration.definitionId)
            .orElseThrow { IllegalArgumentException("External plugin definition ${configuration.definitionId} not found") }
        val source = configuration.properties ?: objectMapper.createObjectNode()
        return propertyEncryptor.decryptSecretFields(source.deepCopy(), definition.configSchema)
    }

    private fun validateAgainstSchema(properties: ObjectNode, schemaNode: com.fasterxml.jackson.databind.node.ObjectNode?) {
        if (schemaNode == null || schemaNode.isEmpty) return
        val factory = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012)
        val schema = factory.getSchema(schemaNode)
        val errors = schema.validate(properties)
        if (errors.isNotEmpty()) {
            val message = errors.joinToString("; ") { it.message }
            throw IllegalArgumentException("Configuration does not match schema: $message")
        }
    }
}
