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

package com.ritense.externalplugin.web.rest

import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.externalplugin.service.ExternalPluginConfigurationService
import com.ritense.externalplugin.service.ExternalPluginDefinitionService
import com.ritense.externalplugin.service.ExternalPluginHostService
import com.ritense.externalplugin.web.rest.dto.ConfigurationCreateRequest
import com.ritense.externalplugin.web.rest.dto.ConfigurationDetailResponse
import com.ritense.externalplugin.web.rest.dto.ConfigurationResponse
import com.ritense.externalplugin.web.rest.dto.ConfigurationUpdateRequest
import com.ritense.externalplugin.web.rest.dto.DefinitionResponse
import com.ritense.externalplugin.web.rest.dto.HostCreateRequest
import com.ritense.externalplugin.web.rest.dto.HostResponse
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import java.util.UUID

@Controller
@SkipComponentScan
@RequestMapping("/api/management/v1/external-plugin", produces = [APPLICATION_JSON_UTF8_VALUE])
class ExternalPluginManagementResource(
    private val hostService: ExternalPluginHostService,
    private val definitionService: ExternalPluginDefinitionService,
    private val configurationService: ExternalPluginConfigurationService,
) {

    @RunWithoutAuthorization
    @GetMapping("/host")
    fun listHosts(): ResponseEntity<List<HostResponse>> =
        ResponseEntity.ok(hostService.list().map(HostResponse::from))

    @RunWithoutAuthorization
    @PostMapping("/host")
    fun createHost(@RequestBody request: HostCreateRequest): ResponseEntity<HostResponse> {
        val host = hostService.register(request.name, request.baseUrl, request.secret)
        return ResponseEntity.status(HttpStatus.CREATED).body(HostResponse.from(host))
    }

    @RunWithoutAuthorization
    @GetMapping("/definition")
    fun listDefinitions(): ResponseEntity<List<DefinitionResponse>> =
        ResponseEntity.ok(definitionService.list().map(DefinitionResponse::from))

    @RunWithoutAuthorization
    @GetMapping("/definition/{definitionId}")
    fun getDefinition(@PathVariable definitionId: UUID): ResponseEntity<DefinitionResponse> =
        ResponseEntity.ok(DefinitionResponse.from(definitionService.get(definitionId)))

    @RunWithoutAuthorization
    @GetMapping("/configuration")
    fun listConfigurations(
        @RequestParam(required = false) definitionId: UUID?,
    ): ResponseEntity<List<ConfigurationResponse>> =
        ResponseEntity.ok(configurationService.list(definitionId).map(ConfigurationResponse::from))

    @RunWithoutAuthorization
    @GetMapping("/configuration/{configurationId}")
    fun getConfiguration(
        @PathVariable configurationId: UUID,
    ): ResponseEntity<ConfigurationDetailResponse> {
        val configuration = configurationService.get(configurationId)
        val decrypted = configurationService.decryptedProperties(configuration)
        return ResponseEntity.ok(
            ConfigurationDetailResponse(
                id = configuration.id,
                definitionId = configuration.definitionId,
                title = configuration.title,
                properties = decrypted,
                createdAt = configuration.createdAt,
            )
        )
    }

    @RunWithoutAuthorization
    @PostMapping("/configuration")
    fun createConfiguration(
        @RequestBody request: ConfigurationCreateRequest,
    ): ResponseEntity<ConfigurationResponse> {
        val configuration = configurationService.create(request.definitionId, request.title, request.properties)
        return ResponseEntity.status(HttpStatus.CREATED).body(ConfigurationResponse.from(configuration))
    }

    @RunWithoutAuthorization
    @PutMapping("/configuration/{configurationId}")
    fun updateConfiguration(
        @PathVariable configurationId: UUID,
        @RequestBody request: ConfigurationUpdateRequest,
    ): ResponseEntity<ConfigurationResponse> {
        val configuration = configurationService.update(configurationId, request.title, request.properties)
        return ResponseEntity.ok(ConfigurationResponse.from(configuration))
    }

    @RunWithoutAuthorization
    @DeleteMapping("/configuration/{configurationId}")
    fun deleteConfiguration(
        @PathVariable configurationId: UUID,
    ): ResponseEntity<Void> {
        configurationService.delete(configurationId)
        return ResponseEntity.noContent().build()
    }
}
