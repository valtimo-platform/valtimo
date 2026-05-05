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

import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
@SkipComponentScan
@Transactional(readOnly = true)
class ExternalPluginDefinitionService(
    private val definitionRepository: ExternalPluginDefinitionRepository,
) {

    fun list(): List<ExternalPluginDefinition> = definitionRepository.findAll()

    fun get(id: UUID): ExternalPluginDefinition = definitionRepository.findById(id)
        .orElseThrow { IllegalArgumentException("External plugin definition $id not found") }

    fun getByPluginId(pluginId: String): ExternalPluginDefinition = definitionRepository.findByPluginId(pluginId)
        ?: throw IllegalArgumentException("External plugin definition with pluginId '$pluginId' not found")
}
