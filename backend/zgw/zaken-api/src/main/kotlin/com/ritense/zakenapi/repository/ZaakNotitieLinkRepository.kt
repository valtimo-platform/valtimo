package com.ritense.zakenapi.repository

import org.springframework.data.jpa.repository.JpaRepository

interface ZaakNotitieLinkRepository: JpaRepository<ZaakNotitieLink, ZaakNotitieLinkId> {
}