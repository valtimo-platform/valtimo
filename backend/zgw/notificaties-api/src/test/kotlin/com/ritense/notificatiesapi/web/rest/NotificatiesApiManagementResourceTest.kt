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

package com.ritense.notificatiesapi.web.rest

import com.ritense.notificatiesapi.domain.NotificatiesApiInboundEventStatus
import com.ritense.notificatiesapi.service.NotificatiesApiInboundEventAdminService
import com.ritense.notificatiesapi.service.NotificatiesApiInboundEventQueryService
import com.ritense.notificatiesapi.web.dto.NotificatiesApiInboundEventResponse
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import java.time.LocalDateTime
import java.util.UUID
import kotlin.test.assertEquals

class NotificatiesApiManagementResourceTest {

    private val queryService: NotificatiesApiInboundEventQueryService = mock()
    private val adminService: NotificatiesApiInboundEventAdminService = mock()
    private val resource = NotificatiesApiManagementResource(queryService, adminService)

    @Test
    fun `returns failed events page`() {
        val response = NotificatiesApiInboundEventResponse(
            id = UUID.randomUUID(),
            idempotenceKey = "key",
            status = NotificatiesApiInboundEventStatus.FAILED,
            pendingRetries = 1,
            receivedAt = LocalDateTime.now(),
            lastProcessedAt = null,
            lastErrorMessage = "error",
            payload = "payload"
        )
        doReturn(PageImpl(listOf(response))).whenever(queryService).findFailedEvents(any())

        val page = resource.getFailedEvents(Pageable.unpaged())

        assertEquals(1, page.totalElements)
        assertEquals(response, page.content.first())
    }

    @Test
    fun `returns failed event count`() {
        doReturn(5L).whenever(adminService).getFailedEventCount()

        val response = resource.getFailedEventCount()

        assertEquals(5L, response["count"])
    }

    @Test
    fun `retry delegates to admin service`() {
        val id = UUID.randomUUID()

        resource.retryFailedEvent(id)

        verify(adminService).retryFailedEvent(id)
    }
}
