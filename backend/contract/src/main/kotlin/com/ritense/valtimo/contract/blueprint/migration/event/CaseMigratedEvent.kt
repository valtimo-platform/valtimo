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

package com.ritense.valtimo.contract.blueprint.migration.event

import com.fasterxml.jackson.annotation.JsonCreator
import com.fasterxml.jackson.annotation.JsonIgnore
import com.fasterxml.jackson.annotation.JsonView
import com.ritense.valtimo.contract.audit.AuditEvent
import com.ritense.valtimo.contract.audit.AuditMetaData
import com.ritense.valtimo.contract.audit.utils.AuditHelper
import com.ritense.valtimo.contract.audit.view.AuditView
import com.ritense.valtimo.contract.utils.RequestHelper
import java.time.LocalDateTime
import java.util.UUID

/** Audit event for a single migrated case, persisted against its [documentId]. [fromBlueprintKey] records the definition it left, which differs from [blueprintKey] only on a cross-key plan. */
class CaseMigratedEvent @JsonCreator constructor(
    id: UUID = UUID.randomUUID(),
    origin: String = RequestHelper.getOrigin(),
    occurredOn: LocalDateTime = LocalDateTime.now(),
    user: String = AuditHelper.getActor(),
    // Nullable so the record round-trips: caseId is not serialized into the event body, so it is null when the stored event is read back.
    @JsonIgnore
    val caseId: UUID? = null,
    @get:JsonView(AuditView.Public::class)
    val blueprintKey: String,
    @get:JsonView(AuditView.Public::class)
    val fromBlueprintKey: String = blueprintKey,
    @get:JsonView(AuditView.Public::class)
    val fromVersionTag: String,
    @get:JsonView(AuditView.Public::class)
    val toVersionTag: String,
    @get:JsonView(AuditView.Public::class)
    val migrationKey: String,
) : AuditMetaData(id, origin, occurredOn, user), AuditEvent {

    override fun getDocumentId(): UUID? = caseId
}
