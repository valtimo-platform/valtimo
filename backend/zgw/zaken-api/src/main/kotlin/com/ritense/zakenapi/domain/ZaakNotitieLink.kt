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
        require(noteId != null || documentId != null) { "NoteId or DocumentId is required" }
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
