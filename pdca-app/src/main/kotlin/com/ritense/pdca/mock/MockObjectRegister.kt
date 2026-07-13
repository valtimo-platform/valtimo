package com.ritense.pdca.mock

import org.springframework.stereotype.Component

data class ObjectRecord(
    val id: String,
    val naam: String,
    val type: String,
    val monumentnummer: String,
    val bouwperiode: String,
    val adres: String,
    val eigenaar: String,
    val beheerder: String,
    val functie: String,
    val status: String
)

@Component
class MockObjectRegister {

    private val objects = mapOf(
        "binnenhof-001" to ObjectRecord(
            id = "binnenhof-001",
            naam = "Binnenhof",
            type = "Rijksmonument",
            monumentnummer = "RM-15234",
            bouwperiode = "1230-1992",
            adres = "Binnenhof 1, 2513 AA Den Haag",
            eigenaar = "Rijksvastgoedbedrijf",
            beheerder = "Rijksvastgoedbedrijf",
            functie = "Regeringsgebouw",
            status = "In renovatie"
        ),
        "domtoren-001" to ObjectRecord(
            id = "domtoren-001",
            naam = "Domtoren",
            type = "Rijksmonument",
            monumentnummer = "RM-36264",
            bouwperiode = "1321-1382",
            adres = "Domplein 21, 3512 JE Utrecht",
            eigenaar = "Gemeente Utrecht",
            beheerder = "Gemeente Utrecht",
            functie = "Kerktoren",
            status = "In gebruik"
        ),
        "centraal-museum-001" to ObjectRecord(
            id = "centraal-museum-001",
            naam = "Centraal Museum",
            type = "Rijksmonument",
            monumentnummer = "RM-18225",
            bouwperiode = "1838",
            adres = "Agnietenstraat 1, 3512 XA Utrecht",
            eigenaar = "Gemeente Utrecht",
            beheerder = "Gemeente Utrecht",
            functie = "Museum",
            status = "In gebruik"
        )
    )

    fun findById(objectId: String): ObjectRecord? {
        return objects[objectId]
    }

    fun findAll(): List<ObjectRecord> {
        return objects.values.toList()
    }
}
