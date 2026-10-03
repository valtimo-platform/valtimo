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

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class FieldsWidgetTest {

    private val document = mapOf(
        "doc:/voornaam" to "Jan",
        "doc:/tussenvoegsel" to null,
        "doc:/achternaam" to "Jansen",
        "doc:/straat" to "Kerkstraat",
        "doc:/huisnummer" to 12,
        "doc:/huisletter" to "",
        "doc:/telefoon" to listOf("0612345678", null, "0201234567"),
    )

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
    fun `should resolve a template to null when every placeholder is empty`() {
        val widget = widget("leeg" to "\${doc:/tussenvoegsel} - \${doc:/huisletter}")

        val values = widget.getExposedValues(::resolve)

        assertThat(values).containsKey("leeg")
        assertThat(values["leeg"]).isNull()
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
