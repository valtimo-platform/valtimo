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

package com.ritense.valtimo.service

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.mock

class TimerServiceImplTest {

    private val timerService = TimerServiceImpl(
        managementService = mock(),
        runtimeService = mock(),
    )

    @Test
    fun `should throw IllegalArgumentException when newDate is not valid ISO-8601`() {
        val exception = assertThrows<IllegalArgumentException> {
            timerService.updateActiveTimers("any-business-key", "not-a-date")
        }
        assertThat(exception.message).startsWith("updateActiveTimers(): invalid date format:")
    }
}
