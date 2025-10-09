package com.ritense.zakenapi.domain

import java.net.URI
import java.time.LocalDateTime

data class ZaakNotitie(
    val url: URI,
    val onderwerp: String,
    val tekst: String,
    val aangemaaktDoor: String? = null,
    val notitieType: NotitieType? = null,
    val status: NotitieStatus? = null,
    val aanmaakdatum: LocalDateTime,
    val wijzigingsdatum: LocalDateTime,
    val gerelateerdAan: URI,
)
