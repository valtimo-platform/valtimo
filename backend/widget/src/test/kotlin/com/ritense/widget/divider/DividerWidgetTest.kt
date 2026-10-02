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

package com.ritense.widget.divider

import com.ritense.widget.custom.CustomWidget
import com.ritense.widget.custom.CustomWidgetProperties
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatIllegalArgumentException
import org.assertj.core.api.Assertions.assertThatNoException
import org.junit.jupiter.api.Test
import java.util.UUID

class DividerWidgetTest {

    @Test
    fun `should allow a blank title`() {
        assertThatNoException().isThrownBy {
            dividerWidget(title = "")
        }
    }

    @Test
    fun `should keep the title empty when created without one`() {
        val widget = dividerWidget(title = "")

        assertThat(widget.title).isEmpty()
        assertThat(widget.toDto().title).isEmpty()
    }

    @Test
    fun `should still require a title on other widget types`() {
        assertThatIllegalArgumentException().isThrownBy {
            CustomWidget(
                id = UUID.randomUUID(),
                key = "my-custom-widget",
                title = "",
                order = 0,
                width = 4,
                highContrast = false,
                isCompact = false,
                properties = CustomWidgetProperties(componentKey = "my-component"),
            )
        }.withMessage("title was blank!")
    }

    private fun dividerWidget(title: String) = DividerWidget(
        id = UUID.randomUUID(),
        key = "my-divider",
        title = title,
        order = 0,
        width = 4,
        highContrast = false,
        isCompact = false,
    )
}
