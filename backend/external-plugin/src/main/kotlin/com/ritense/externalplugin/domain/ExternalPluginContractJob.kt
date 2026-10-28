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

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.Instant
import java.util.UUID

/**
 * Ledger row of one asynchronous contract request: the outbox for both directions (request to the
 * provider, reply to the requester). Payload columns hold ciphertext — a request may carry personal
 * data from the case.
 */
@Entity
@Table(
    name = "external_plugin_contract_job",
    uniqueConstraints = [
        UniqueConstraint(
            name = "ext_plugin_contract_job_idempotency_uq",
            columnNames = ["requester_configuration_id", "idempotency_key"],
        )
    ],
)
class ExternalPluginContractJob(

    @Id
    @Column(name = "id")
    val id: UUID,

    @Column(name = "contract", nullable = false)
    val contract: String,

    @Column(name = "operation", nullable = false)
    val operation: String,

    @Column(name = "requester_configuration_id", nullable = false)
    val requesterConfigurationId: UUID,

    @Column(name = "provider_configuration_id", nullable = false)
    val providerConfigurationId: UUID,

    @Column(name = "requested_by")
    val requestedBy: String? = null,

    /** The case the job acts on. A user token always names one; a service token may. */
    @Column(name = "document_id")
    val documentId: String? = null,

    /** Unique per requester; a repeated create with the same key answers with this job. */
    @Column(name = "idempotency_key")
    val idempotencyKey: String? = null,

    @Column(name = "status", nullable = false)
    @Enumerated(EnumType.STRING)
    var status: ExternalPluginContractJobStatus = ExternalPluginContractJobStatus.PENDING,

    /** COMPLETED, FAILED or EXPIRED once finished; kept through DELIVERED and UNDELIVERABLE. */
    @Column(name = "outcome")
    @Enumerated(EnumType.STRING)
    var outcome: ExternalPluginContractJobStatus? = null,

    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "request_payload", nullable = false)
    val requestPayload: String,

    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "result_payload")
    var resultPayload: String? = null,

    @Column(name = "error_code")
    var errorCode: String? = null,

    /** The provider's own error code, next to the platform's [errorCode]. */
    @Column(name = "provider_error_code")
    var providerErrorCode: String? = null,

    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "error_message")
    var errorMessage: String? = null,

    @Column(name = "reply_to_process_instance_id")
    val replyToProcessInstanceId: String? = null,

    @Column(name = "reply_to_business_key")
    val replyToBusinessKey: String? = null,

    /** Comma-separated configuration ids of the call chain this job was requested in, requester last. */
    @Column(name = "chain")
    val chain: String? = null,

    @Column(name = "deadline", nullable = false)
    val deadline: Instant,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = createdAt,

    @Column(name = "completed_at")
    var completedAt: Instant? = null,

    @Column(name = "delivered_at")
    var deliveredAt: Instant? = null,

    @Column(name = "delivery_attempts", nullable = false)
    var deliveryAttempts: Int = 0,

    @Column(name = "next_attempt_at")
    var nextAttemptAt: Instant? = createdAt,

    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "last_delivery_error")
    var lastDeliveryError: String? = null,
) {
    val chainIds: List<UUID>
        get() = chain?.split(',')?.mapNotNull { runCatching { UUID.fromString(it.trim()) }.getOrNull() }.orEmpty()
}
