package com.ritense.pdca.mock

import org.springframework.stereotype.Component

data class Adres(
    val straat: String,
    val huisnummer: String,
    val postcode: String,
    val woonplaats: String
)

data class Kind(
    val naam: String,
    val geboortedatum: String
)

data class PersonRecord(
    val bsn: String,
    val naam: String,
    val geboortedatum: String,
    val geslacht: String,
    val nationaliteit: String,
    val adres: Adres,
    val burgerlijkeStaat: String,
    val kinderen: List<Kind>
)

@Component
class MockPersonRegister {

    private val persons = mapOf(
        "445775187" to PersonRecord(
            bsn = "445775187",
            naam = "Erika de Goede",
            geboortedatum = "1986-06-18",
            geslacht = "Vrouw",
            nationaliteit = "Nederlandse",
            adres = Adres(
                straat = "Laakkade",
                huisnummer = "72",
                postcode = "2521 SJ",
                woonplaats = "Den Haag"
            ),
            burgerlijkeStaat = "Gescheiden",
            kinderen = listOf(
                Kind(naam = "Daan", geboortedatum = "2019-03-15"),
                Kind(naam = "Lisa", geboortedatum = "2022-08-22")
            )
        ),
        "123456789" to PersonRecord(
            bsn = "123456789",
            naam = "Jan van Dijk",
            geboortedatum = "1975-03-22",
            geslacht = "Man",
            nationaliteit = "Nederlandse",
            adres = Adres(
                straat = "Prinsengracht",
                huisnummer = "100",
                postcode = "1015 DV",
                woonplaats = "Amsterdam"
            ),
            burgerlijkeStaat = "Gehuwd",
            kinderen = listOf(
                Kind(naam = "Sophie", geboortedatum = "2010-07-12")
            )
        ),
        "987654321" to PersonRecord(
            bsn = "987654321",
            naam = "Fatima El Amrani",
            geboortedatum = "1992-11-05",
            geslacht = "Vrouw",
            nationaliteit = "Nederlandse",
            adres = Adres(
                straat = "Kanaalstraat",
                huisnummer = "45",
                postcode = "3511 KC",
                woonplaats = "Utrecht"
            ),
            burgerlijkeStaat = "Ongehuwd",
            kinderen = emptyList()
        )
    )

    fun findByBsn(bsn: String): PersonRecord? {
        return persons[bsn]
    }

    fun findAll(): List<PersonRecord> {
        return persons.values.toList()
    }
}
