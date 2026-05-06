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

package com.ritense.zakenapi.sync

import com.ritense.valtimo.contract.case_.CaseDefinitionId
import java.net.URI

data class CaseZakenApiSyncRequest(
    val assigneeSyncEnabled: Boolean = false,
    val roltypeUrl: URI = URI(""),
    val noteSyncEnabled: Boolean = false,
    val noteSubject: String = CaseZakenApiSync.DEFAULT_NOTE_SUBJECT,
) {

    fun toEntity(caseDefinitionId: CaseDefinitionId): CaseZakenApiSync = CaseZakenApiSync(
        caseDefinitionId = caseDefinitionId,
        assigneeSyncEnabled = assigneeSyncEnabled,
        roltypeUrl = roltypeUrl,
        noteSyncEnabled = noteSyncEnabled,
        noteSubject = noteSubject,
    )

    companion object {
        fun of(sync: CaseZakenApiSync): CaseZakenApiSyncRequest = CaseZakenApiSyncRequest(
            assigneeSyncEnabled = sync.assigneeSyncEnabled,
            roltypeUrl = sync.roltypeUrl,
            noteSyncEnabled = sync.noteSyncEnabled,
            noteSubject = sync.noteSubject,
        )
    }
}
