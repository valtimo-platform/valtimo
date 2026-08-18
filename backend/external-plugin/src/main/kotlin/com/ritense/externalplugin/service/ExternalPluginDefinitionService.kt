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
import com.ritense.externalplugin.exception.ExternalPluginNotFoundException
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
        .orElseThrow { ExternalPluginNotFoundException("External plugin definition", id) }

    fun getAllByPluginId(pluginId: String): List<ExternalPluginDefinition> =
        definitionRepository.findAllByPluginId(pluginId)

    /**
     * Re-pins a definition whose host package changed after acceptance. The caller must echo the
     * exact pending hash it reviewed: this is acceptance of a *specific* package, not of "whatever
     * the host happens to serve by now" — if the host changed again since the admin looked, the
     * echoed hash no longer matches and the request is rejected until the newest state is reviewed.
     */
    @Transactional
    fun acceptContent(id: UUID, contentHash: String): ExternalPluginDefinition {
        val definition = get(id)
        val pending = definition.pendingContentHash
            ?: throw IllegalStateException(
                "External plugin definition ${definition.pluginId}@${definition.version} " +
                    "has no pending content change to accept"
            )
        require(contentHash == pending) {
            "The accepted content hash does not match the pending one — the plugin package " +
                "changed again on the host; review the current state before accepting"
        }
        definition.contentHash = pending
        definition.pendingContentHash = null
        return definitionRepository.save(definition)
    }
}
