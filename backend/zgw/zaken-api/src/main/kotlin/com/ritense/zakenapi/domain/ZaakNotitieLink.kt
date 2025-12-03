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

package com.ritense.zakenapi.domain

import com.fasterxml.jackson.annotation.JsonProperty
import com.ritense.valtimo.contract.repository.UriAttributeConverter
import com.ritense.valtimo.contract.validation.Validatable
import jakarta.persistence.Column
import jakarta.persistence.Convert
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.Table
import org.springframework.data.domain.Persistable
import java.net.URI
import java.util.UUID

@Entity
@Table(name = "zaak_notitie_link")
class ZaakNotitieLink(

    @EmbeddedId
    @JsonProperty("id")
    val zaakNotitieLinkId: ZaakNotitieLinkId,

    @Convert(converter = UriAttributeConverter::class)
    @Column(name = "zaak_notitie_url", columnDefinition = "VARCHAR(512)", nullable = false)
    val zaakNotitieUrl: URI,

    @Column(name = "note_id", nullable = true)
    val noteId: UUID? = null,

    @Column(name = "document_id", nullable = true)
    val documentId: UUID? = null

) : Persistable<ZaakNotitieLinkId>, Validatable {

    init {
        require( noteId != null || documentId != null ) {
            "At least the noteId or documentId should be provided!"
        }
        validate()
    }

    @JsonProperty("id")
    override fun getId(): ZaakNotitieLinkId {
        return zaakNotitieLinkId
    }

    override fun isNew(): Boolean {
        return zaakNotitieLinkId.isNew
    }
}
