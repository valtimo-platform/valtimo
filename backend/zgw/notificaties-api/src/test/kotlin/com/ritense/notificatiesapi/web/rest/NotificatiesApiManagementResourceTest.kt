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

import com.ritense.notificatiesapi.domain.Abonnement
import com.ritense.notificatiesapi.domain.NotificatiesApiInboundEventStatus
import com.ritense.notificatiesapi.service.NotificatiesApiInboundEventAdminService
import com.ritense.notificatiesapi.service.NotificatiesApiInboundEventQueryService
import com.ritense.notificatiesapi.service.NotificatiesApiService
import com.ritense.notificatiesapi.web.dto.NotificatiesApiInboundEventResponse
import com.ritense.notificatiesapi.web.dto.NotificatiesApiManualAbonnementResponse
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.http.HttpStatus
import java.time.LocalDateTime
import java.util.UUID
import kotlin.test.assertEquals

class NotificatiesApiManagementResourceTest {

    private val queryService: NotificatiesApiInboundEventQueryService = mock()
    private val adminService: NotificatiesApiInboundEventAdminService = mock()
    private val notificatiesApiService: NotificatiesApiService = mock()
    private val resource = NotificatiesApiManagementResource(queryService, adminService, notificatiesApiService)

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

    @Test
    fun `returns the manual abonnement of a manual configuration`() {
        val configurationId = UUID.randomUUID()
        val manualAbonnement = NotificatiesApiManualAbonnementResponse(
            callbackUrl = "https://gzac.example.com/api/v1/notificatiesapi/callback",
            kanalen = listOf(Abonnement.Kanaal(naam = "zaken", filters = mapOf("actie" to "create")))
        )
        doReturn(manualAbonnement).whenever(notificatiesApiService).getManualAbonnement(configurationId)

        val response = resource.getManualAbonnement(configurationId)

        assertEquals(HttpStatus.OK, response.statusCode)
        assertEquals(manualAbonnement, response.body)
    }

    @Test
    fun `returns not found when the configuration is not manual`() {
        val configurationId = UUID.randomUUID()
        doReturn(null).whenever(notificatiesApiService).getManualAbonnement(configurationId)

        val response = resource.getManualAbonnement(configurationId)

        assertEquals(HttpStatus.NOT_FOUND, response.statusCode)
    }

    @Test
    fun `returns not found without a notificaties api service`() {
        val response = NotificatiesApiManagementResource(queryService, adminService)
            .getManualAbonnement(UUID.randomUUID())

        assertEquals(HttpStatus.NOT_FOUND, response.statusCode)
    }
}
