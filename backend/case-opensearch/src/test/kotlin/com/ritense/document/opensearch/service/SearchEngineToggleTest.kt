/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.document.opensearch.service

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class SearchEngineToggleTest {

    @Test
    fun `default engine is OPENSEARCH`() {
        val toggle = SearchEngineToggle()

        assertThat(toggle.get()).isEqualTo(SearchEngineToggle.Engine.OPENSEARCH)
    }

    @Test
    fun `can override default engine`() {
        val toggle = SearchEngineToggle(default = SearchEngineToggle.Engine.POSTGRES)

        assertThat(toggle.get()).isEqualTo(SearchEngineToggle.Engine.POSTGRES)
    }

    @Test
    fun `set changes engine`() {
        val toggle = SearchEngineToggle()

        toggle.set(SearchEngineToggle.Engine.POSTGRES)

        assertThat(toggle.get()).isEqualTo(SearchEngineToggle.Engine.POSTGRES)
    }

    @Test
    fun `can toggle back to OPENSEARCH`() {
        val toggle = SearchEngineToggle()
        toggle.set(SearchEngineToggle.Engine.POSTGRES)

        toggle.set(SearchEngineToggle.Engine.OPENSEARCH)

        assertThat(toggle.get()).isEqualTo(SearchEngineToggle.Engine.OPENSEARCH)
    }
}
