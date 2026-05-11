/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.widget.domain

import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.valtimo.contract.json.MapperSingleton
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class NavigateToWidgetActionTest {

    private val mapper = MapperSingleton.get()

    @Test
    fun `should default openInNewTab to null when missing in JSON`() {
        val json = """{"name":"Open IKO","navigateTo":"/iko/foo"}"""

        val action: NavigateToWidgetAction = mapper.readValue(json)

        assertThat(action.openInNewTab).isNull()
        assertThat(action.navigateTo).isEqualTo("/iko/foo")
    }

    @Test
    fun `should omit openInNewTab from JSON when null`() {
        val action = NavigateToWidgetAction(
            name = "Open IKO",
            navigateTo = "/iko/foo",
            openInNewTab = null,
        )

        val json = mapper.writeValueAsString(action)

        assertThat(json).doesNotContain("openInNewTab")
    }

    @Test
    fun `should preserve openInNewTab when set to true`() {
        val action = NavigateToWidgetAction(
            name = "Open IKO",
            navigateTo = "/iko/foo",
            openInNewTab = true,
        )

        val json = mapper.writeValueAsString(action)
        val roundTripped: NavigateToWidgetAction = mapper.readValue(json)

        assertThat(roundTripped.openInNewTab).isTrue()
        assertThat(json).contains("\"openInNewTab\":true")
    }
}
