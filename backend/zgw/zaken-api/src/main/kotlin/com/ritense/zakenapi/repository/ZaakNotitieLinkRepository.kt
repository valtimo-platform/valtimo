package com.ritense.zakenapi.repository

import com.ritense.zakenapi.domain.ZaakNotitieLink
import com.ritense.zakenapi.domain.ZaakNotitieLinkId
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface ZaakNotitieLinkRepository: JpaRepository<ZaakNotitieLink, ZaakNotitieLinkId> {

    fun existsByNoteId(noteId: UUID): Boolean

    fun getByNoteId(noteId: UUID): ZaakNotitieLink
}