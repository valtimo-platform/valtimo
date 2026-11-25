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

package com.ritense.externalplugin.event

import com.fasterxml.jackson.annotation.JsonCreator
import com.fasterxml.jackson.annotation.JsonProperty
import com.fasterxml.jackson.annotation.JsonView
import com.ritense.valtimo.contract.audit.AuditEvent
import com.ritense.valtimo.contract.audit.AuditMetaData
import com.ritense.valtimo.contract.audit.view.AuditView
import java.time.LocalDateTime
import java.util.UUID

/** An administrator read the decrypted request and result payloads of a contract job. */
class ExternalPluginContractJobPayloadViewedEvent @JsonCreator constructor(
    id: UUID,
    origin: String,
    occurredOn: LocalDateTime,
    user: String,
    private val documentId: UUID?,
    private val jobId: UUID,
    private val contract: String,
    private val operation: String,
) : AuditMetaData(id, origin, occurredOn, user), AuditEvent {

    override fun getDocumentId(): UUID? = documentId

    @JsonProperty
    @JsonView(AuditView.Public::class)
    fun getJobId(): UUID = jobId

    @JsonProperty
    @JsonView(AuditView.Public::class)
    fun getContract(): String = contract

    @JsonProperty
    @JsonView(AuditView.Public::class)
    fun getOperation(): String = operation
}
