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

package com.ritense.zakenapi.web.rest

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.zakenapi.exception.MultipleZakenFoundException
import com.ritense.zakenapi.exception.ZaakNotFoundException
import com.ritense.zakenapi.service.ZaakService
import java.util.UUID
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@SkipComponentScan
@RequestMapping(value = ["/api"], produces = [APPLICATION_JSON_UTF8_VALUE])
class ZaakResource(
    private val zaakService: ZaakService
) {

    @GetMapping("/v1/zaken-api/zaak/{zaakIdentificatie}/actief")
    fun getActiefStatus(
        @PathVariable zaakIdentificatie: String,
        @RequestParam(value = "zaken_api_plugin_id", required = false) zakenApiPluginId: UUID?,
    ): ResponseEntity<Map<String, Any>> {
        return try {
            val actief = zaakService.getActiveStatus(zaakIdentificatie, zakenApiPluginId)
            ResponseEntity.ok(mapOf("actief" to actief))
        } catch (e: ZaakNotFoundException) {
            ResponseEntity.status(HttpStatus.NOT_FOUND).body(
                mapOf(
                    "errorCode" to "ZAAK_NOT_FOUND",
                    "errorMessage" to "No authorized zaak was found for the given identificatie."
                )
            )
        } catch (e: MultipleZakenFoundException) {
            ResponseEntity.status(HttpStatus.CONFLICT).body(
                mapOf(
                    "errorCode" to "MORE_THAN_ONE_ZAAK_FOUND",
                    "errorMessage" to "More than one authorized zaak was found for the given identificatie."
                )
            )
        }
    }
}
