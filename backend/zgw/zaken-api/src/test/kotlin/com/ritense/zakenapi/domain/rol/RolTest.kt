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

package com.ritense.zakenapi.domain.rol

import com.ritense.valtimo.contract.json.MapperSingleton
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.skyscreamer.jsonassert.JSONAssert
import java.net.URI
import java.time.LocalDateTime
import java.util.UUID

internal class RolTest {

    private val mapper = MapperSingleton.get()

    @Test
    fun `should serialize natuurlijk persoon`() {
        val rol = Rol(
            url = URI("http://rol.uri"),
            uuid = UUID.fromString("3dd4ea1f-3419-43ae-aca2-def868083689"),
            zaak = URI("http://zaak.uri"),
            betrokkene = URI("http://betrokkene.uri"),
            betrokkeneType = BetrokkeneType.NATUURLIJK_PERSOON,
            roltype = URI("http://role.type"),
            omschrijving = "omschrijving",
            omschrijvingGeneriek = ZaakRolOmschrijving.INITIATOR,
            roltoelichting = "role-description",
            registratiedatum = LocalDateTime.of(2023, 2, 15, 10, 23, 43),
            indicatieMachtigingString = IndicatieMachtiging.GEMACHTIGDE.key,
            betrokkeneIdentificatie = RolNatuurlijkPersoon(
                inpBsn = "bsn"
            )
        )

        val result = mapper.writeValueAsString(rol)

        val expectation =  """
            {
                "url": "http://rol.uri",
                "uuid": "3dd4ea1f-3419-43ae-aca2-def868083689",
                "zaak": "http://zaak.uri",
                "betrokkene": "http://betrokkene.uri",
                "betrokkeneType": "natuurlijk_persoon",
                "roltype": "http://role.type",
                "omschrijving": "omschrijving",
                "omschrijvingGeneriek": "initiator",
                "roltoelichting": "role-description",
                "registratiedatum": "2023-02-15T10:23:43.000Z",
                "indicatieMachtiging": "gemachtigde",
                "betrokkeneIdentificatie": {
                    "inpBsn": "bsn"
                }
            }
            """.trimIndent()

        JSONAssert.assertEquals(expectation, result, false)
    }

    @Test
    fun `should serialize niet natuurlijk persoon`() {
        val rol = Rol(
            url = URI("http://rol.uri"),
            uuid = UUID.fromString("3dd4ea1f-3419-43ae-aca2-def868083689"),
            zaak = URI("http://zaak.uri"),
            betrokkene = URI("http://betrokkene.uri"),
            betrokkeneType = BetrokkeneType.NATUURLIJK_PERSOON,
            roltype = URI("http://role.type"),
            omschrijving = "omschrijving",
            omschrijvingGeneriek = ZaakRolOmschrijving.INITIATOR,
            roltoelichting = "roltoelichting",
            registratiedatum = LocalDateTime.of(2023, 2, 15, 10, 23, 43),
            indicatieMachtigingString = IndicatieMachtiging.GEMACHTIGDE.key,
            betrokkeneIdentificatie = RolNietNatuurlijkPersoon(
                annIdentificatie = "kvk",
                innNnpId = "innNnpId",
                kvkNummer = "kvkNummer",
                vestigingsNummer = "vestigingsNummer"
            )
        )

        val result = mapper.writeValueAsString(rol)

        val expectation =  """
            {
                "url": "http://rol.uri",
                "uuid": "3dd4ea1f-3419-43ae-aca2-def868083689",
                "zaak": "http://zaak.uri",
                "betrokkene": "http://betrokkene.uri",
                "betrokkeneType": "natuurlijk_persoon",
                "roltype": "http://role.type",
                "omschrijving": "omschrijving",
                "omschrijvingGeneriek": "initiator",
                "roltoelichting": "roltoelichting",
                "registratiedatum": "2023-02-15T10:23:43.000Z",
                "indicatieMachtiging": "gemachtigde",
                "betrokkeneIdentificatie": {
                    "annIdentificatie": "kvk",
                    "innNnpId": "innNnpId",
                    "kvkNummer": "kvkNummer",
                    "vestigingsNummer": "vestigingsNummer"
                }
            }
            """.trimIndent()

        JSONAssert.assertEquals(expectation, result, false)
    }

    @Test
    fun `should deserialize natuurlijk persoon`() {
        val json =  """
            {
                "url": "http://rol.uri",
                "uuid": "3dd4ea1f-3419-43ae-aca2-def868083689",
                "zaak": "http://zaak.uri",
                "betrokkene": "http://betrokkene.uri",
                "betrokkeneType": "natuurlijk_persoon",
                "roltype": "http://role.type",
                "omschrijving": "omschrijving",
                "omschrijvingGeneriek": "initiator",
                "roltoelichting": "role-description",
                "registratiedatum": "2023-02-15T10:23:43Z",
                "indicatieMachtiging": "gemachtigde",
                "betrokkeneIdentificatie": {
                    "inpBsn": "bsn"
                }
            }
            """.trimIndent()

        val result = mapper.readValue(json, Rol::class.java)

        assertThat(result.betrokkeneIdentificatie).isInstanceOf(RolNatuurlijkPersoon::class.java)
        with(result.betrokkeneIdentificatie as RolNatuurlijkPersoon) {
            assertThat(this.inpBsn).isEqualTo("bsn")
        }
    }

    @Test
    fun `should deserialize niet natuurlijk persoon`() {
        val json =  """
            {
                "url": "http://rol.uri",
                "uuid": "3dd4ea1f-3419-43ae-aca2-def868083689",
                "zaak": "http://zaak.uri",
                "betrokkene": "http://betrokkene.uri",
                "betrokkeneType": "niet_natuurlijk_persoon",
                "roltype": "http://role.type",
                "omschrijving": "omschrijving",
                "omschrijvingGeneriek": "initiator",
                "roltoelichting": "role-description",
                "registratiedatum": "2023-02-15T10:23:43Z",
                "indicatieMachtiging": "gemachtigde",
                "betrokkeneIdentificatie": {
                    "annIdentificatie": "kvk",
                    "kvkNummer": "kvkNummer"
                }
            }
            """.trimIndent()

        val result = mapper.readValue(json, Rol::class.java)

        assertThat(result.betrokkeneIdentificatie).isInstanceOf(RolNietNatuurlijkPersoon::class.java)
        with(result.betrokkeneIdentificatie as RolNietNatuurlijkPersoon) {
            assertThat(this.annIdentificatie).isEqualTo("kvk")
            assertThat(this.kvkNummer).isEqualTo("kvkNummer")
        }
    }

    @Test
    fun `should serialize vestiging`() {
        val rol = Rol(
            url = URI("http://rol.uri"),
            uuid = UUID.fromString("3dd4ea1f-3419-43ae-aca2-def868083689"),
            zaak = URI("http://zaak.uri"),
            betrokkene = URI("http://betrokkene.uri"),
            betrokkeneType = BetrokkeneType.VESTIGING,
            roltype = URI("http://role.type"),
            omschrijving = "omschrijving",
            omschrijvingGeneriek = ZaakRolOmschrijving.INITIATOR,
            roltoelichting = "roltoelichting",
            registratiedatum = LocalDateTime.of(2023, 2, 15, 10, 23, 43),
            indicatieMachtigingString = IndicatieMachtiging.GEMACHTIGDE.key,
            betrokkeneIdentificatie = RolVestiging(
                vestigingsNummer = "12345678",
                handelsnaam = listOf("Handelsnaam 1", "Handelsnaam 2"),
                kvkNummer = "87654321"
            )
        )

        val result = mapper.writeValueAsString(rol)

        val expectation = """
            {
                "url": "http://rol.uri",
                "uuid": "3dd4ea1f-3419-43ae-aca2-def868083689",
                "zaak": "http://zaak.uri",
                "betrokkene": "http://betrokkene.uri",
                "betrokkeneType": "vestiging",
                "roltype": "http://role.type",
                "omschrijving": "omschrijving",
                "omschrijvingGeneriek": "initiator",
                "roltoelichting": "roltoelichting",
                "registratiedatum": "2023-02-15T10:23:43.000Z",
                "indicatieMachtiging": "gemachtigde",
                "betrokkeneIdentificatie": {
                    "vestigingsNummer": "12345678",
                    "handelsnaam": ["Handelsnaam 1", "Handelsnaam 2"],
                    "kvkNummer": "87654321"
                }
            }
            """.trimIndent()

        JSONAssert.assertEquals(expectation, result, false)
    }

    @Test
    fun `should deserialize vestiging`() {
        val json = """
            {
                "url": "http://rol.uri",
                "uuid": "3dd4ea1f-3419-43ae-aca2-def868083689",
                "zaak": "http://zaak.uri",
                "betrokkene": "http://betrokkene.uri",
                "betrokkeneType": "vestiging",
                "roltype": "http://role.type",
                "omschrijving": "omschrijving",
                "omschrijvingGeneriek": "initiator",
                "roltoelichting": "roltoelichting",
                "registratiedatum": "2023-02-15T10:23:43Z",
                "indicatieMachtiging": "gemachtigde",
                "betrokkeneIdentificatie": {
                    "vestigingsNummer": "12345678",
                    "kvkNummer": "87654321"
                }
            }
            """.trimIndent()

        val result = mapper.readValue(json, Rol::class.java)

        assertThat(result.betrokkeneIdentificatie).isInstanceOf(RolVestiging::class.java)
        with(result.betrokkeneIdentificatie as RolVestiging) {
            assertThat(this.vestigingsNummer).isEqualTo("12345678")
            assertThat(this.kvkNummer).isEqualTo("87654321")
        }
    }

    @Test
    fun `should serialize medewerker`() {
        val rol = Rol(
            url = URI("http://rol.uri"),
            uuid = UUID.fromString("3dd4ea1f-3419-43ae-aca2-def868083689"),
            zaak = URI("http://zaak.uri"),
            betrokkene = URI("http://betrokkene.uri"),
            betrokkeneType = BetrokkeneType.MEDEWERKER,
            roltype = URI("http://role.type"),
            omschrijving = "omschrijving",
            omschrijvingGeneriek = ZaakRolOmschrijving.INITIATOR,
            roltoelichting = "roltoelichting",
            registratiedatum = LocalDateTime.of(2023, 2, 15, 10, 23, 43),
            indicatieMachtigingString = IndicatieMachtiging.GEMACHTIGDE.key,
            betrokkeneIdentificatie = RolMedewerker(
                identificatie = "M123",
                achternaam = "Jansen",
                voorletters = "A.",
                voorvoegselAchternaam = "van"
            )
        )

        val result = mapper.writeValueAsString(rol)

        val expectation = """
            {
                "url": "http://rol.uri",
                "uuid": "3dd4ea1f-3419-43ae-aca2-def868083689",
                "zaak": "http://zaak.uri",
                "betrokkene": "http://betrokkene.uri",
                "betrokkeneType": "medewerker",
                "roltype": "http://role.type",
                "omschrijving": "omschrijving",
                "omschrijvingGeneriek": "initiator",
                "roltoelichting": "roltoelichting",
                "registratiedatum": "2023-02-15T10:23:43.000Z",
                "indicatieMachtiging": "gemachtigde",
                "betrokkeneIdentificatie": {
                    "identificatie": "M123",
                    "achternaam": "Jansen",
                    "voorletters": "A.",
                    "voorvoegselAchternaam": "van"
                }
            }
            """.trimIndent()

        JSONAssert.assertEquals(expectation, result, false)
    }

    @Test
    fun `should deserialize medewerker`() {
        val json = """
            {
                "url": "http://rol.uri",
                "uuid": "3dd4ea1f-3419-43ae-aca2-def868083689",
                "zaak": "http://zaak.uri",
                "betrokkene": "http://betrokkene.uri",
                "betrokkeneType": "medewerker",
                "roltype": "http://role.type",
                "omschrijving": "omschrijving",
                "omschrijvingGeneriek": "initiator",
                "roltoelichting": "roltoelichting",
                "registratiedatum": "2023-02-15T10:23:43Z",
                "indicatieMachtiging": "gemachtigde",
                "betrokkeneIdentificatie": {
                    "identificatie": "M123",
                    "achternaam": "Jansen",
                    "voorletters": "A.",
                    "voorvoegselAchternaam": "van"
                }
            }
            """.trimIndent()

        val result = mapper.readValue(json, Rol::class.java)

        assertThat(result.betrokkeneIdentificatie).isInstanceOf(RolMedewerker::class.java)
        with(result.betrokkeneIdentificatie as RolMedewerker) {
            assertThat(this.identificatie).isEqualTo("M123")
            assertThat(this.achternaam).isEqualTo("Jansen")
            assertThat(this.voorletters).isEqualTo("A.")
            assertThat(this.voorvoegselAchternaam).isEqualTo("van")
        }
    }

    @Test
    fun `should serialize organisatorische eenheid`() {
        val rol = Rol(
            url = URI("http://rol.uri"),
            uuid = UUID.fromString("3dd4ea1f-3419-43ae-aca2-def868083689"),
            zaak = URI("http://zaak.uri"),
            betrokkene = URI("http://betrokkene.uri"),
            betrokkeneType = BetrokkeneType.ORGANISATORISCHE_EENHEID,
            roltype = URI("http://role.type"),
            omschrijving = "omschrijving",
            omschrijvingGeneriek = ZaakRolOmschrijving.INITIATOR,
            roltoelichting = "roltoelichting",
            registratiedatum = LocalDateTime.of(2023, 2, 15, 10, 23, 43),
            indicatieMachtigingString = IndicatieMachtiging.GEMACHTIGDE.key,
            betrokkeneIdentificatie = RolOrganisatorischeEenheid(
                identificatie = "OE-001",
                naam = "Afdeling Vergunningen",
                isGehuisvestIn = "Huis A"
            )
        )

        val result = mapper.writeValueAsString(rol)

        val expectation = """
            {
                "url": "http://rol.uri",
                "uuid": "3dd4ea1f-3419-43ae-aca2-def868083689",
                "zaak": "http://zaak.uri",
                "betrokkene": "http://betrokkene.uri",
                "betrokkeneType": "organisatorische_eenheid",
                "roltype": "http://role.type",
                "omschrijving": "omschrijving",
                "omschrijvingGeneriek": "initiator",
                "roltoelichting": "roltoelichting",
                "registratiedatum": "2023-02-15T10:23:43.000Z",
                "indicatieMachtiging": "gemachtigde",
                "betrokkeneIdentificatie": {
                    "identificatie": "OE-001",
                    "naam": "Afdeling Vergunningen",
                    "isGehuisvestIn": "Huis A"
                }
            }
            """.trimIndent()

        JSONAssert.assertEquals(expectation, result, false)
    }

    @Test
    fun `should deserialize organisatorische eenheid`() {
        val json = """
            {
                "url": "http://rol.uri",
                "uuid": "3dd4ea1f-3419-43ae-aca2-def868083689",
                "zaak": "http://zaak.uri",
                "betrokkene": "http://betrokkene.uri",
                "betrokkeneType": "organisatorische_eenheid",
                "roltype": "http://role.type",
                "omschrijving": "omschrijving",
                "omschrijvingGeneriek": "initiator",
                "roltoelichting": "roltoelichting",
                "registratiedatum": "2023-02-15T10:23:43Z",
                "indicatieMachtiging": "gemachtigde",
                "betrokkeneIdentificatie": {
                    "identificatie": "OE-001",
                    "naam": "Afdeling Vergunningen",
                    "isGehuisvestIn": "Huis A"
                }
            }
            """.trimIndent()

        val result = mapper.readValue(json, Rol::class.java)

        assertThat(result.betrokkeneIdentificatie).isInstanceOf(RolOrganisatorischeEenheid::class.java)
        with(result.betrokkeneIdentificatie as RolOrganisatorischeEenheid) {
            assertThat(this.identificatie).isEqualTo("OE-001")
            assertThat(this.naam).isEqualTo("Afdeling Vergunningen")
            assertThat(this.isGehuisvestIn).isEqualTo("Huis A")
        }
    }
}
