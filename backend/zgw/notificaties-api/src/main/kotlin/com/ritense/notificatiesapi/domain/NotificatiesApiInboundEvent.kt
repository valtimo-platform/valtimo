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

package com.ritense.notificatiesapi.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Lob
import jakarta.persistence.Table
import java.time.LocalDateTime
import java.util.UUID

@Entity
@Table(name = "notificaties_api_inbound_event")
class NotificatiesApiInboundEvent(
    @Id
    @Column(name = "id", nullable = false)
    var id: UUID = UUID.randomUUID(),

    @Column(name = "idempotence_key", nullable = false, length = 128)
    var idempotenceKey: String,

    @Lob
    @Column(name = "payload", nullable = false)
    var payload: String,

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    var status: NotificatiesApiInboundEventStatus,

    @Column(name = "pending_retries")
    var pendingRetries: Int? = null,

    @Column(name = "last_processed_at")
    var lastProcessedAt: LocalDateTime? = null,

    @Lob
    @Column(name = "last_error_message")
    var lastErrorMessage: String? = null,

    @Column(name = "received_at", nullable = false)
    var receivedAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "next_due_at")
    var nextDueAt: LocalDateTime? = receivedAt
)
