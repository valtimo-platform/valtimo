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

package com.ritense.notificatiesapi.service

import com.ritense.notificatiesapi.config.NotificatiesApiProcessingProperties
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertDoesNotThrow
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.orm.ObjectOptimisticLockingFailureException

class NotificatiesApiInboundEventWorkerTest {

    private val processingService: NotificatiesApiInboundEventProcessingService = mock()
    private val properties = NotificatiesApiProcessingProperties()
    private val worker = NotificatiesApiInboundEventWorker(properties, processingService)

    @Test
    fun `poll only processes and leaves maintenance to its own job`() {
        worker.poll()

        verify(processingService).processBatch()
        verify(processingService, never()).runMaintenance()
    }

    @Test
    fun `maintenance failure is logged and does not propagate`() {
        doThrow(ObjectOptimisticLockingFailureException("NotificatiesApiInboundEvent", "id"))
            .whenever(processingService).runMaintenance()

        assertDoesNotThrow { worker.runMaintenance() }

        verify(processingService).runMaintenance()
    }

    @Test
    fun `maintenance does nothing when processing is disabled`() {
        properties.enabled = false

        worker.runMaintenance()

        verify(processingService, never()).runMaintenance()
    }
}
