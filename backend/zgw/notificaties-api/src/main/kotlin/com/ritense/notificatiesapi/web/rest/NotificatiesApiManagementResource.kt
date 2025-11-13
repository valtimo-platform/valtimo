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

import com.ritense.notificatiesapi.service.NotificatiesApiInboundEventAdminService
import com.ritense.notificatiesapi.service.NotificatiesApiInboundEventQueryService
import com.ritense.notificatiesapi.web.dto.NotificatiesApiInboundEventResponse
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@SkipComponentScan
@RequestMapping("/api/management", produces = [APPLICATION_JSON_UTF8_VALUE])
class NotificatiesApiManagementResource(
    private val inboundEventQueryService: NotificatiesApiInboundEventQueryService,
    private val inboundEventAdminService: NotificatiesApiInboundEventAdminService
) {

    @GetMapping("/v1/notificatiesapi/inbound-events/failed")
    fun getFailedEvents(pageable: Pageable): Page<NotificatiesApiInboundEventResponse> {
        return inboundEventQueryService.findFailedEvents(pageable)
    }

    @GetMapping("/v1/notificatiesapi/inbound-events/failed/count")
    fun getFailedEventCount(): Map<String, Long> {
        val count = inboundEventAdminService.getFailedEventCount()
        return mapOf("count" to count)
    }

    @PostMapping("/v1/notificatiesapi/inbound-events/{id}/retry")
    fun retryFailedEvent(@PathVariable id: UUID): ResponseEntity<Void> {
        inboundEventAdminService.retryFailedEvent(id)
        return ResponseEntity.accepted().build()
    }
}
