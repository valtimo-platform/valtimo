package com.ritense.zakenapi.domain

import java.net.URI

data class PatchZaakNotitieRequest(
    val onderwerp: String? = null,
    val tekst: String? = null,
    val aangemaaktDoor: String? = null,
    val notitieType: NotitieType? = null,
    val status: NotitieStatus? = null,
    val gerelateerdAan: URI? = null,
)
