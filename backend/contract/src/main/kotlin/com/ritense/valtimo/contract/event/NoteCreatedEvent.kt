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

package com.ritense.valtimo.contract.event

import com.fasterxml.jackson.annotation.JsonCreator
import com.fasterxml.jackson.annotation.JsonIgnore
import com.ritense.valtimo.contract.audit.AuditEvent
import com.ritense.valtimo.contract.audit.AuditMetaData
import com.ritense.valtimo.contract.audit.utils.AuditHelper
import com.ritense.valtimo.contract.utils.RequestHelper
import java.time.LocalDateTime
import java.util.UUID

class NoteCreatedEvent @JsonCreator constructor(
    id: UUID = UUID.randomUUID(),
    origin: String = RequestHelper.getOrigin(),
    occurredOn: LocalDateTime = LocalDateTime.now(),
    user: String = AuditHelper.getActor(),
    val noteId: UUID,
    @JsonIgnore
    val noteDocumentId: UUID? = null,
    @JsonIgnore
    val noteContent: String? = null,
    @JsonIgnore
    val noteCreatedByUserId: String? = null,
    @JsonIgnore
    val noteCreatedByUserFullName: String? = null,
    @JsonIgnore
    val noteCreatedOn: LocalDateTime? = null,
) : AuditMetaData(id, origin, occurredOn, user), AuditEvent {

    override fun getDocumentId(): UUID? = noteDocumentId
}
