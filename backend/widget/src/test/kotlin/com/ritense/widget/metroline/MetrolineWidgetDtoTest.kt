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

package com.ritense.widget.metroline

import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.widget.domain.WidgetColor
import com.ritense.widget.web.rest.dto.WidgetDto
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.util.UUID

class MetrolineWidgetDtoTest {

    private val objectMapper = MapperSingleton.get().copy().apply {
        registerSubtypes(MetrolineWidgetDto::class.java)
    }

    @Test
    fun `toEntity should preserve all configured properties`() {
        val dto = dto()

        val entity = dto.toEntity(UUID.fromString("3ab43f1a-0154-4658-82b8-41527def0ae2"), 7) as MetrolineWidget

        assertThat(entity.key).isEqualTo("status_verloop")
        assertThat(entity.title).isEqualTo("Status verloop")
        assertThat(entity.order).isEqualTo(7)
        assertThat(entity.width).isEqualTo(1)
        assertThat(entity.highContrast).isFalse()
        assertThat(entity.properties.orientation).isEqualTo(MetrolineOrientation.VERTICAL)
        assertThat(entity.properties.source).isEqualTo("iko:/statushistorie")
        assertThat(entity.properties.titlePath).isEqualTo("/statustype/omschrijving")
        assertThat(entity.properties.labelPath).isEqualTo("/statustype/toelichting")
        assertThat(entity.properties.completedPath).isEqualTo("/datumStatusGezet")
    }

    @Test
    fun `toEntity should default color to WHITE`() {
        val dto = dto(color = null, highContrast = false)

        val entity = dto.toEntity(UUID.randomUUID(), 0) as MetrolineWidget

        assertEquals(WidgetColor.WHITE, entity.color)
    }

    @Test
    fun `toEntity should set color to HIGHCONTRAST when highContrast is true and color is null`() {
        val dto = dto(color = null, highContrast = true)

        val entity = dto.toEntity(UUID.randomUUID(), 0) as MetrolineWidget

        assertEquals(WidgetColor.HIGHCONTRAST, entity.color)
    }

    @Test
    fun `should deserialize a metroline payload polymorphically via the type discriminator`() {
        val json = """
            {
              "type": "metroline",
              "key": "status_verloop",
              "title": "Status verloop",
              "icon": null,
              "color": null,
              "width": 1,
              "highContrast": false,
              "isCompact": null,
              "actions": [],
              "displayConditions": [],
              "properties": {
                "orientation": "VERTICAL",
                "source": "iko:/statushistorie",
                "titlePath": "/statustype/omschrijving",
                "labelPath": "/statustype/toelichting",
                "completedPath": "/datumStatusGezet"
              }
            }
        """.trimIndent()

        val dto = objectMapper.readValue(json, WidgetDto::class.java)

        assertThat(dto).isInstanceOf(MetrolineWidgetDto::class.java)
        val metroline = dto as MetrolineWidgetDto
        assertThat(metroline.key).isEqualTo("status_verloop")
        assertThat(metroline.properties.source).isEqualTo("iko:/statushistorie")
        assertThat(metroline.properties.titlePath).isEqualTo("/statustype/omschrijving")
        assertThat(metroline.properties.labelPath).isEqualTo("/statustype/toelichting")
        assertThat(metroline.properties.completedPath).isEqualTo("/datumStatusGezet")
    }

    @Test
    fun `should ignore unknown legacy mode property when deserializing`() {
        // Existing persisted widgets may still carry a 'mode' field from earlier versions.
        val json = """
            {
              "type": "metroline",
              "key": "status_verloop",
              "title": "Status verloop",
              "icon": null,
              "color": null,
              "width": 1,
              "highContrast": false,
              "isCompact": null,
              "actions": [],
              "displayConditions": [],
              "properties": {
                "orientation": "VERTICAL",
                "mode": "STATUS_HISTORY",
                "source": "iko:/statushistorie",
                "titlePath": "/statustype/omschrijving",
                "labelPath": "/statustype/toelichting",
                "completedPath": "/datumStatusGezet"
              }
            }
        """.trimIndent()

        val dto = objectMapper.readValue(json, WidgetDto::class.java) as MetrolineWidgetDto

        assertThat(dto.properties.orientation).isEqualTo(MetrolineOrientation.VERTICAL)
        assertThat(dto.properties.source).isEqualTo("iko:/statushistorie")
    }

    private fun dto(
        color: WidgetColor? = null,
        highContrast: Boolean = false,
        labelPath: String? = "/statustype/toelichting",
    ) = MetrolineWidgetDto(
        key = "status_verloop",
        title = "Status verloop",
        icon = null,
        color = color,
        width = 1,
        highContrast = highContrast,
        isCompact = null,
        actions = emptyList(),
        displayConditions = emptyList(),
        properties = MetrolineWidgetProperties(
            orientation = MetrolineOrientation.VERTICAL,
            source = "iko:/statushistorie",
            titlePath = "/statustype/omschrijving",
            labelPath = labelPath,
            completedPath = "/datumStatusGezet",
        ),
    )
}
