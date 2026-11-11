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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.document.opensearch.service

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Duration

class IndexCompletenessServiceTest {

    @Test
    fun `retries a rejected case after 10 minutes, then hourly, then daily`() {
        assertThat((1..3).map(IndexCompletenessService::retryDelayAfter)).containsOnly(Duration.ofMinutes(10))
        assertThat((4..6).map(IndexCompletenessService::retryDelayAfter)).containsOnly(Duration.ofHours(1))
        assertThat(listOf(7, 50, Int.MAX_VALUE).map(IndexCompletenessService::retryDelayAfter)).containsOnly(Duration.ofHours(24))
    }
}
