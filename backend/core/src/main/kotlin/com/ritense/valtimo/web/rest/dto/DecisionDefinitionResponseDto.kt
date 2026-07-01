/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.valtimo.web.rest.dto

import com.ritense.valtimo.operaton.domain.OperatonDecisionDefinition

/**
 * Response for a decision definition. The field names mirror the Operaton REST
 * `DecisionDefinitionDto` so existing clients can consume it interchangeably.
 */
data class DecisionDefinitionResponseDto(
    val id: String,
    val key: String,
    val category: String?,
    val name: String?,
    val version: Int,
    val resource: String?,
    val deploymentId: String?,
    val tenantId: String?,
    val decisionRequirementsDefinitionId: String?,
    val decisionRequirementsDefinitionKey: String?,
    val versionTag: String?,
    val historyTimeToLive: Int?,
) {
    companion object {

        @JvmStatic
        fun from(decisionDefinition: OperatonDecisionDefinition): DecisionDefinitionResponseDto {
            return DecisionDefinitionResponseDto(
                id = decisionDefinition.id,
                key = decisionDefinition.key,
                category = decisionDefinition.category,
                name = decisionDefinition.name,
                version = decisionDefinition.version,
                resource = decisionDefinition.resourceName,
                deploymentId = decisionDefinition.deploymentId,
                tenantId = decisionDefinition.tenantId,
                decisionRequirementsDefinitionId = decisionDefinition.decisionRequirementsId,
                decisionRequirementsDefinitionKey = decisionDefinition.decisionRequirementsKey,
                versionTag = decisionDefinition.versionTag,
                historyTimeToLive = decisionDefinition.historyTimeToLive,
            )
        }
    }
}
