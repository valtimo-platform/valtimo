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

package com.ritense.widget.fields

import com.fasterxml.jackson.annotation.JsonValue
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import java.math.BigDecimal
import java.net.URI
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.time.ZonedDateTime
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class FieldsWidgetTest {

    private val adres = mapOf("straat" to "Kerkstraat", "huisnummer" to 12)

    private val document = mapOf(
        "doc:/voornaam" to "Jan",
        "doc:/tussenvoegsel" to null,
        "doc:/achternaam" to "Jansen",
        "doc:/straat" to "Kerkstraat",
        "doc:/huisnummer" to 12,
        "doc:/huisletter" to "",
        "doc:/telefoon" to listOf("0612345678", null, "0201234567"),
        "doc:/spatie" to " ",
        "doc:/spaties" to listOf(" ", " "),
        "doc:/whole" to 12.0,
        "doc:/fraction" to 12.5,
        "doc:/large" to 10000000.0,
        "doc:/exact" to BigDecimal("1.50"),
        "doc:/json" to ObjectMapper().readTree("2.250"),
        "case:createdOn" to LocalDateTime.of(2026, 10, 3, 8, 25, 4, 123456000),
        "case:modifiedOn" to ZonedDateTime.of(2026, 10, 3, 8, 25, 0, 0, ZoneOffset.ofHours(2)),
        "doc:/datum" to LocalDate.of(2026, 10, 3),
        "doc:/adres" to adres,
        "doc:/adressen" to listOf(adres, adres),
        "doc:/jsonAdres" to ObjectMapper().valueToTree<JsonNode>(adres),
        "case:tag" to Tag("urgent", "Urgent"),
        "case:tags" to listOf(Tag("urgent", "Urgent"), Tag("vip", "VIP")),
        "zaak:zaaktype" to URI("https://openzaak.local/catalogi/api/v1/zaaktypen/1"),
        "zaak:bronorganisatie" to Rsin("002564440"),
        "zaak:vertrouwelijkheidaanduiding" to Vertrouwelijkheid.ZAAKVERTROUWELIJK,
    )

    private data class Tag(val key: String, val title: String)

    private class Rsin(private val value: String) {
        @JsonValue
        override fun toString() = value
    }

    private enum class Vertrouwelijkheid(@get:JsonValue val key: String) { ZAAKVERTROUWELIJK("zaakvertrouwelijk") }

    @Test
    fun `should resolve each placeholder of a template field`() {
        val widget = widget("naam" to "\${doc:/voornaam} \${doc:/tussenvoegsel} \${doc:/achternaam}")

        assertThat(widget.getUnresolvedValues())
            .containsExactlyInAnyOrder("doc:/voornaam", "doc:/tussenvoegsel", "doc:/achternaam")
    }

    @Test
    fun `should combine template placeholders into one value`() {
        val widget = widget(
            "naam" to "\${doc:/voornaam} \${doc:/tussenvoegsel} \${doc:/achternaam}",
            "adres" to "\${doc:/straat} \${doc:/huisnummer}\${doc:/huisletter}",
        )

        val values = widget.getExposedValues(::resolve)

        assertThat(values["naam"]).isEqualTo("Jan Jansen")
        assertThat(values["adres"]).isEqualTo("Kerkstraat 12")
    }

    @Test
    fun `should join a list placeholder with commas`() {
        val widget = widget("telefoon" to "Tel: \${doc:/telefoon}")

        val values = widget.getExposedValues(::resolve)

        assertThat(values["telefoon"]).isEqualTo("Tel: 0612345678, 0201234567")
    }

    @Test
    fun `should render numbers in plain form`() {
        val widget = widget(
            "decimal" to "\${doc:/whole} \${doc:/fraction}",
            "large" to "\${doc:/large}",
            "exact" to "\${doc:/exact} \${doc:/json}",
        )

        val values = widget.getExposedValues(::resolve)

        assertThat(values["decimal"]).isEqualTo("12 12.5")
        assertThat(values["large"]).isEqualTo("10000000")
        assertThat(values["exact"]).isEqualTo("1.5 2.25")
    }

    @Test
    fun `should render date-times to the second`() {
        val widget = widget(
            "local" to "\${case:createdOn}",
            "zoned" to "\${case:modifiedOn}",
            "date" to "\${doc:/datum}",
        )

        val values = widget.getExposedValues(::resolve)

        assertThat(values["local"]).isEqualTo("2026-10-03T08:25:04")
        assertThat(values["zoned"]).isEqualTo("2026-10-03T08:25:00+02:00")
        assertThat(values["date"]).isEqualTo("2026-10-03")
    }

    @Test
    fun `should render a single value by its JSON form`() {
        val widget = widget(
            "zaak" to "\${zaak:bronorganisatie} \${zaak:vertrouwelijkheidaanduiding}",
            "type" to "\${zaak:zaaktype}",
        )

        val values = widget.getExposedValues(::resolve)

        assertThat(values["zaak"]).isEqualTo("002564440 zaakvertrouwelijk")
        assertThat(values["type"]).isEqualTo("https://openzaak.local/catalogi/api/v1/zaaktypen/1")
    }

    @Test
    fun `should leave out a placeholder that resolves to an object`() {
        val widget = widget(
            "adres" to "\${doc:/straat} \${doc:/adres}",
            "lijst" to "\${doc:/adressen}",
            "json" to "\${doc:/jsonAdres}",
            "tag" to "\${doc:/straat} \${case:tag}",
            "tags" to "\${case:tags}",
        )

        val values = widget.getExposedValues(::resolve)

        assertThat(values["adres"]).isEqualTo("Kerkstraat")
        assertThat(values["lijst"]).isNull()
        assertThat(values["json"]).isNull()
        assertThat(values["tag"]).isEqualTo("Kerkstraat")
        assertThat(values["tags"]).isNull()
    }

    @Test
    fun `should resolve a template to null when every placeholder is empty`() {
        val widget = widget(
            "leeg" to "\${doc:/tussenvoegsel} - \${doc:/huisletter}",
            "spatie" to "Tel: \${doc:/spatie}",
            "spaties" to "\${doc:/spaties}",
        )

        val values = widget.getExposedValues(::resolve)

        assertThat(values).containsKey("leeg")
        assertThat(values["leeg"]).isNull()
        assertThat(values["spatie"]).isNull()
        assertThat(values["spaties"]).isNull()
    }

    @Test
    fun `should resolve a plain value as a single path`() {
        val widget = widget("nummer" to "doc:/huisnummer")

        assertThat(widget.getUnresolvedValues()).containsExactly("doc:/huisnummer")
        assertThat(widget.getExposedValues(::resolve)["nummer"]).isEqualTo(12)
    }

    private fun resolve(path: String): Any? {
        require(path in document) { "No resolver for '$path'" }
        return document[path]
    }

    private fun widget(vararg fields: Pair<String, String>) = FieldsWidget(
        key = "widget",
        title = "Widget",
        order = 0,
        width = 1,
        highContrast = false,
        properties = FieldsWidgetProperties(
            columns = listOf(fields.map { (key, value) -> FieldsWidgetProperties.Field(key, key, value) })
        )
    )
}
