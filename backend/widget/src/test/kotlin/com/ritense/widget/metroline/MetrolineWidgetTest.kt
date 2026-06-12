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

import com.ritense.widget.domain.WidgetColor
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.util.UUID

class MetrolineWidgetTest {

    @Test
    fun `getUnresolvedValues should include the source expression`() {
        val widget = metrolineWidget()

        assertThat(widget.getUnresolvedValues()).contains("iko:/statushistorie")
    }

    @Test
    fun `copy should preserve properties and override id key and order`() {
        val original = metrolineWidget()
        val newId = UUID.fromString("11111111-1111-1111-1111-111111111111")

        val duplicate = original.copy(id = newId, key = "duplicate", order = 9)

        assertThat(duplicate).isInstanceOf(MetrolineWidget::class.java)
        assertThat(duplicate.id).isEqualTo(newId)
        assertThat(duplicate.key).isEqualTo("duplicate")
        assertThat(duplicate.order).isEqualTo(9)
        // Properties are passed by reference and not deep-copied; both entities reference the same instance.
        assertThat((duplicate as MetrolineWidget).properties).isSameAs(original.properties)
    }

    @Test
    fun `toDto should produce a MetrolineWidgetDto with the same properties`() {
        val widget = metrolineWidget()

        val dto = widget.toDto()

        assertThat(dto).isInstanceOf(MetrolineWidgetDto::class.java)
        val metrolineDto = dto as MetrolineWidgetDto
        assertThat(metrolineDto.key).isEqualTo(widget.key)
        assertThat(metrolineDto.title).isEqualTo(widget.title)
        assertThat(metrolineDto.width).isEqualTo(widget.width)
        assertThat(metrolineDto.highContrast).isEqualTo(widget.highContrast)
        assertThat(metrolineDto.properties).isSameAs(widget.properties)
    }

    private fun metrolineWidget() = MetrolineWidget(
        id = UUID.fromString("3ab43f1a-0154-4658-82b8-41527def0ae2"),
        key = "status_verloop",
        title = "Status verloop",
        color = WidgetColor.WHITE,
        order = 0,
        width = 1,
        highContrast = false,
        isCompact = null,
        properties = MetrolineWidgetProperties(
            orientation = MetrolineOrientation.VERTICAL,
            source = "iko:/statushistorie",
            titlePath = "/statustype/omschrijving",
            labelPath = "/statustype/toelichting",
            completedPath = "/datumStatusGezet",
        ),
    )
}
