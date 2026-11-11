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

package com.ritense.case_.caseconfiguration.web.rest

import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.case_.caseconfiguration.exception.CaseConfigurationAlreadyExistsException
import com.ritense.case_.caseconfiguration.exception.CaseConfigurationNotFoundException
import com.ritense.case_.caseconfiguration.service.CaseConfigurationService
import com.ritense.case_.caseconfiguration.web.rest.dto.CaseConfigurationCreateRequestDto
import com.ritense.case_.caseconfiguration.web.rest.dto.CaseConfigurationEnvironmentValueRequestDto
import com.ritense.case_.caseconfiguration.web.rest.dto.CaseConfigurationResponseDto
import com.ritense.case_.caseconfiguration.web.rest.dto.CaseConfigurationUpdateRequestDto
import com.ritense.logging.LoggableResource
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.domain.ValtimoMediaType
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException

@RestController
@SkipComponentScan
@RequestMapping("/api/management", produces = [ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE])
class CaseConfigurationManagementResource(
    private val caseConfigurationService: CaseConfigurationService,
) {

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "List case definition configuration",
        nl = "Dossierdefinitie-configuratie ophalen",
    )
    @GetMapping(BASE_PATH)
    fun getConfiguration(
        @LoggableResource("caseDefinitionKey") @PathVariable caseDefinitionKey: String,
        @LoggableResource("caseDefinitionVersionTag") @PathVariable caseDefinitionVersionTag: String,
    ): ResponseEntity<List<CaseConfigurationResponseDto>> {
        val caseDefinitionId = CaseDefinitionId.of(caseDefinitionKey, caseDefinitionVersionTag)
        return ResponseEntity.ok(caseConfigurationService.getConfiguration(caseDefinitionId).map(CaseConfigurationResponseDto::of))
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Create case definition configuration key",
        nl = "Dossierdefinitie-configuratiesleutel aanmaken",
    )
    @PostMapping(BASE_PATH)
    fun createDeclaration(
        @LoggableResource("caseDefinitionKey") @PathVariable caseDefinitionKey: String,
        @LoggableResource("caseDefinitionVersionTag") @PathVariable caseDefinitionVersionTag: String,
        @RequestBody request: CaseConfigurationCreateRequestDto,
    ): ResponseEntity<CaseConfigurationResponseDto> {
        val caseDefinitionId = CaseDefinitionId.of(caseDefinitionKey, caseDefinitionVersionTag)
        return handle {
            caseConfigurationService.createDeclaration(caseDefinitionId, request.key, request.defaultValue)
            ResponseEntity.ok(CaseConfigurationResponseDto.of(caseConfigurationService.getConfiguration(caseDefinitionId, request.key)))
        }
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Update case definition configuration key",
        nl = "Dossierdefinitie-configuratiesleutel bijwerken",
    )
    @PutMapping("$BASE_PATH/{configurationKey}")
    fun updateDeclaration(
        @LoggableResource("caseDefinitionKey") @PathVariable caseDefinitionKey: String,
        @LoggableResource("caseDefinitionVersionTag") @PathVariable caseDefinitionVersionTag: String,
        @PathVariable configurationKey: String,
        @RequestBody request: CaseConfigurationUpdateRequestDto,
    ): ResponseEntity<CaseConfigurationResponseDto> {
        val caseDefinitionId = CaseDefinitionId.of(caseDefinitionKey, caseDefinitionVersionTag)
        return handle {
            caseConfigurationService.updateDeclaration(caseDefinitionId, configurationKey, request.defaultValue)
            ResponseEntity.ok(CaseConfigurationResponseDto.of(caseConfigurationService.getConfiguration(caseDefinitionId, configurationKey)))
        }
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Delete case definition configuration key",
        nl = "Dossierdefinitie-configuratiesleutel verwijderen",
    )
    @DeleteMapping("$BASE_PATH/{configurationKey}")
    fun deleteDeclaration(
        @LoggableResource("caseDefinitionKey") @PathVariable caseDefinitionKey: String,
        @LoggableResource("caseDefinitionVersionTag") @PathVariable caseDefinitionVersionTag: String,
        @PathVariable configurationKey: String,
    ): ResponseEntity<Unit> {
        val caseDefinitionId = CaseDefinitionId.of(caseDefinitionKey, caseDefinitionVersionTag)
        return handle {
            caseConfigurationService.deleteDeclaration(caseDefinitionId, configurationKey)
            ResponseEntity.noContent().build()
        }
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Set environment value of a case definition configuration key",
        nl = "Omgevingswaarde van een dossierdefinitie-configuratiesleutel instellen",
    )
    @PutMapping("$BASE_PATH/{configurationKey}/environment-value")
    fun setEnvironmentValue(
        @LoggableResource("caseDefinitionKey") @PathVariable caseDefinitionKey: String,
        @LoggableResource("caseDefinitionVersionTag") @PathVariable caseDefinitionVersionTag: String,
        @PathVariable configurationKey: String,
        @RequestBody request: CaseConfigurationEnvironmentValueRequestDto,
    ): ResponseEntity<CaseConfigurationResponseDto> {
        val caseDefinitionId = CaseDefinitionId.of(caseDefinitionKey, caseDefinitionVersionTag)
        return handle {
            ResponseEntity.ok(
                CaseConfigurationResponseDto.of(
                    caseConfigurationService.setEnvironmentValue(caseDefinitionId, configurationKey, request.value)
                )
            )
        }
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Clear environment value of a case definition configuration key",
        nl = "Omgevingswaarde van een dossierdefinitie-configuratiesleutel wissen",
    )
    @DeleteMapping("$BASE_PATH/{configurationKey}/environment-value")
    fun clearEnvironmentValue(
        @LoggableResource("caseDefinitionKey") @PathVariable caseDefinitionKey: String,
        @LoggableResource("caseDefinitionVersionTag") @PathVariable caseDefinitionVersionTag: String,
        @PathVariable configurationKey: String,
    ): ResponseEntity<Unit> {
        val caseDefinitionId = CaseDefinitionId.of(caseDefinitionKey, caseDefinitionVersionTag)
        return handle {
            caseConfigurationService.clearEnvironmentValue(caseDefinitionId, configurationKey)
            ResponseEntity.noContent().build()
        }
    }

    private fun <T> handle(block: () -> ResponseEntity<T>): ResponseEntity<T> {
        return try {
            block()
        } catch (ex: CaseConfigurationAlreadyExistsException) {
            throw ResponseStatusException(HttpStatus.CONFLICT, ex.message)
        } catch (ex: CaseConfigurationNotFoundException) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, ex.message)
        } catch (ex: IllegalArgumentException) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, ex.message)
        } catch (ex: IllegalStateException) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, ex.message)
        }
    }

    companion object {
        const val BASE_PATH = "/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/configuration"
    }
}
