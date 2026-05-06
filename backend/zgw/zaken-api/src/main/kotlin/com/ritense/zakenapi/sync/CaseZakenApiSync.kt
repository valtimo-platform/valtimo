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
import com.ritense.valtimo.contract.repository.UriAttributeConverter
import jakarta.persistence.Column
import jakarta.persistence.Convert
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.Table
import java.net.URI

@Entity
@Table(name = "case_zaken_api_sync")
data class CaseZakenApiSync(

    @EmbeddedId
    val caseDefinitionId: CaseDefinitionId,

    @Column(name = "assignee_sync_enabled")
    val assigneeSyncEnabled: Boolean = false,

    @Convert(converter = UriAttributeConverter::class)
    @Column(name = "roltype_url")
    val roltypeUrl: URI = URI(""),

    @Column(name = "note_sync_enabled")
    val noteSyncEnabled: Boolean = false,

    @Column(name = "note_subject")
    val noteSubject: String = DEFAULT_NOTE_SUBJECT,
) {
    companion object {
        const val DEFAULT_NOTE_SUBJECT = "Note created by Valtimo GZAC"
    }
}
