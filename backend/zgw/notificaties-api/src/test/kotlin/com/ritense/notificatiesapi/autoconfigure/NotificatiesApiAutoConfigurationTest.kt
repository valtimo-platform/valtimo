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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.notificatiesapi.autoconfigure

import com.ritense.notificatiesapi.config.NotificatiesApiProcessingProperties
import org.junit.jupiter.api.Test
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor
import kotlin.test.assertEquals

class NotificatiesApiAutoConfigurationTest {

    private val configuration = NotificatiesApiAutoConfiguration()

    @Test
    fun `task executor uses processing property values`() {
        val properties = NotificatiesApiProcessingProperties().apply {
            executorCorePoolSize = 3
            executorMaxPoolSize = 6
            executorQueueCapacity = 11
        }

        val executor = configuration.notificatiesApiTaskExecutor(properties) as ThreadPoolTaskExecutor

        assertEquals(3, executor.corePoolSize)
        assertEquals(6, executor.maxPoolSize)
        val queue = executor.threadPoolExecutor.queue
        assertEquals(11, queue.remainingCapacity() + queue.size)
        executor.shutdown()
    }
}
