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

package com.ritense.plugin.service

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.plugin.domain.PluginActionResultMapping
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valueresolver.ValueResolverService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.springframework.stereotype.Component
import java.util.UUID

/**
 * Writes a plugin action's JSON result back to process variables / the case (or building-block)
 * document through [PluginActionResultMapping]s, reusing the same split-and-dispatch shape as
 * `BuildingBlockCallActivityListener.onCallActivityEnd` (`pv:` targets go to the process instance,
 * everything else to `execution`'s business-key document — inside a building-block process that is
 * the BB instance document, which BB output mappings then sync to the case as usual).
 */
@Component
@SkipComponentScan
class PluginActionResultHandler(
    private val valueResolverService: ValueResolverService,
    private val objectMapper: ObjectMapper,
) {

    /**
     * @param execution the execution the action ran on; its business key (if present) is the
     *   document targeted by non-`pv:` mappings.
     * @param result the action's return value, already serialized to JSON — `null` is a no-op
     *   except for a warning when mappings were configured (author error: an action that can
     *   return nothing was wired to a result mapping).
     */
    fun handle(execution: DelegateExecution, result: JsonNode?, mappings: List<PluginActionResultMapping>) {
        if (mappings.isEmpty()) {
            return
        }
        if (result == null || result.isNull || result.isMissingNode) {
            logger.warn {
                "Plugin action for activity '${execution.currentActivityId}' of process instance " +
                    "'${execution.processInstanceId}' has ${mappings.size} result mapping(s) configured, " +
                    "but returned no result to map."
            }
            return
        }

        val valuesToHandle = mappings.mapNotNull { mapping ->
            val pointer = mapping.source.ifBlank { "" }
            val node = result.at(pointer)
            if (node.isMissingNode || node.isNull) {
                // A null result value is skipped like a missing one: writing JSON null would wipe
                // existing data and fails schema validation on non-nullable document fields.
                logger.warn {
                    "Plugin action result mapping source pointer '${mapping.source}' was " +
                        (if (node.isNull) "null" else "absent") +
                        " in the action result for activity '${execution.currentActivityId}' " +
                        "of process instance '${execution.processInstanceId}' — target " +
                        "'${mapping.target}' was not written."
                }
                return@mapNotNull null
            }
            mapping.target to objectMapper.treeToValue(node, Any::class.java)
        }.toMap()

        if (valuesToHandle.isEmpty()) {
            return
        }

        val pvTargets = valuesToHandle.filter { it.key.startsWith("pv:") }
        val otherTargets = valuesToHandle.filter { !it.key.startsWith("pv:") }

        if (pvTargets.isNotEmpty()) {
            valueResolverService.handleValues(execution.processInstanceId, execution, pvTargets)
        }

        if (otherTargets.isNotEmpty()) {
            val businessKey = execution.processBusinessKey
                ?: error(
                    "Cannot write plugin action result mappings for activity " +
                        "'${execution.currentActivityId}' — process instance " +
                        "'${execution.processInstanceId}' has no business-key document."
                )
            valueResolverService.handleValues(UUID.fromString(businessKey), otherTargets)
        }
    }

    private companion object {
        val logger = KotlinLogging.logger {}
    }
}
