package com.ritense.zakenapi.domain

import java.net.URI

data class CreateZaakNotitieRequest(
    val onderwerp: String,
    val tekst: String,
    val gerelateerdAan: URI,
    val aangemaaktDoor: String? = null,
    val notitieType: NotitieType? = null,
    val status: NotitieStatus? = null
)
