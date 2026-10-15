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

package com.ritense.externalplugin.web.rest.dto

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.databind.JsonNode
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus
import com.ritense.externalplugin.domain.ExternalPluginHostKind
import java.time.Instant
import java.util.UUID

// ---------------------------------------------------------------- management (ADMIN)

data class ContractProviderResponse(
    val configurationId: UUID,
    val configurationTitle: String,
    val definitionId: UUID,
    val pluginId: String,
    val version: String,
    val hostId: UUID,
    val hostName: String?,
    val hostKind: ExternalPluginHostKind?,
    /** False while the provider's definition is unavailable, a placeholder, or awaits re-acceptance. */
    val available: Boolean,
    val operations: List<ContractProviderOperationResponse>,
)

data class ContractProviderOperationResponse(
    val key: String,
    val title: String?,
    val mode: String?,
    val timeout: String?,
)

data class ContractJobSummaryResponse(
    val id: UUID,
    val contract: String,
    val operation: String,
    val requesterConfigurationId: UUID,
    val requesterTitle: String?,
    val requesterPluginId: String?,
    val providerConfigurationId: UUID,
    val providerTitle: String?,
    val providerPluginId: String?,
    val status: ExternalPluginContractJobStatus,
    val requestedBy: String?,
    val createdAt: Instant,
    val updatedAt: Instant?,
    val completedAt: Instant?,
    val deliveredAt: Instant?,
    val deadline: Instant?,
    val deliveryAttempts: Int,
    val errorCode: String?,
    val errorMessage: String?,
)

data class ContractJobDetailResponse(
    val id: UUID,
    val contract: String,
    val operation: String,
    val requesterConfigurationId: UUID,
    val requesterTitle: String?,
    val requesterPluginId: String?,
    val providerConfigurationId: UUID,
    val providerTitle: String?,
    val providerPluginId: String?,
    val status: ExternalPluginContractJobStatus,
    val requestedBy: String?,
    val createdAt: Instant,
    val updatedAt: Instant?,
    val completedAt: Instant?,
    val deliveredAt: Instant?,
    val deadline: Instant?,
    val deliveryAttempts: Int,
    val errorCode: String?,
    val errorMessage: String?,
    val requestPayload: JsonNode?,
    val resultPayload: JsonNode?,
    val replyToProcessInstanceId: String?,
    val lastDeliveryError: String?,
)

// ---------------------------------------------------------------- plugin-facing (/api/v1/plugin-contract)

data class ContractCallRequest(
    val contract: String? = null,
    val operation: String? = null,
    val payload: JsonNode? = null,
)

data class ContractJobCreateRequest(
    val contract: String? = null,
    val operation: String? = null,
    val payload: JsonNode? = null,
    val replyTo: ContractReplyTo? = null,
    val documentId: String? = null,
)

data class ContractReplyTo(
    val processInstanceId: String? = null,
)

data class ContractJobCompleteRequest(
    val status: String? = null,
    val result: JsonNode? = null,
    val errorCode: String? = null,
    val errorMessage: String? = null,
)

/** `status` is `completed`, `accepted` or `error`; absent fields are omitted. */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class ContractResponse(
    val status: String,
    val result: JsonNode? = null,
    val jobId: UUID? = null,
    val errorCode: String? = null,
    val errorMessage: String? = null,
)

/** Plugin-facing job view; `status` is the lowercase job status. */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class ContractJobView(
    val jobId: UUID,
    val contract: String,
    val operation: String,
    val status: String,
    val result: JsonNode? = null,
    val errorCode: String? = null,
    val errorMessage: String? = null,
    val requestedAt: Instant,
    val completedAt: Instant? = null,
)
