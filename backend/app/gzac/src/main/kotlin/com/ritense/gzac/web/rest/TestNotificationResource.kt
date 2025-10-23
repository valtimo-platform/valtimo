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

package com.ritense.gzac.web.rest

import com.ritense.notificatiesapi.NotificatiesApiPlugin
import com.ritense.plugin.service.PluginService
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import mu.KotlinLogging
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.client.RestClient
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/test-impl")
class TestNotificationResource(
    private val pluginService: PluginService,
    private val restClientBuilder: RestClient.Builder,
) {
    data class NotificationRequest(
        @field:NotBlank
        val message: String,
    )

    @PostMapping("/notification")
    fun sendTestNotification(@Valid @RequestBody request: NotificationRequest): ResponseEntity<Void> {
        val plugin = pluginService.createInstance(NotificatiesApiPlugin::class.java) { true }
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "No Notificaties API plugin configuration available")

        logger.info {
            "Received test notification '${request.message}' for configuration ${plugin.notificatiesApiConfigurationId}"
        }

        val restClient = restClientBuilder
            .clone()
            .apply {
                plugin.authenticationPluginConfiguration.applyAuth(it)
            }
            .baseUrl(plugin.url.toASCIIString())
            .build()

        restClient
            .put()
            .uri { it.pathSegment("notificaties").build() }
            .contentType(MediaType.APPLICATION_JSON)
            .body(request.message)
            .retrieve()

        return ResponseEntity.accepted().build()
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
