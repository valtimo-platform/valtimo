/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.pdca.web.rest.dto

import com.ritense.pdca.domain.PhaseConfig
import java.time.LocalDateTime
import java.util.UUID

data class CreatePhaseConfigRequest(
    val caseDefinitionKey: String,
    val phases: String,
    val evaluationTypes: String
)

data class UpdatePhaseConfigRequest(
    val phases: String? = null,
    val evaluationTypes: String? = null
)

data class PhaseConfigResponse(
    val id: UUID,
    val caseDefinitionKey: String,
    val phases: String,
    val evaluationTypes: String,
    val createdAt: LocalDateTime,
    val updatedAt: LocalDateTime
) {
    constructor(config: PhaseConfig) : this(
        id = config.id,
        caseDefinitionKey = config.caseDefinitionKey,
        phases = config.phases,
        evaluationTypes = config.evaluationTypes,
        createdAt = config.createdAt,
        updatedAt = config.updatedAt
    )
}
