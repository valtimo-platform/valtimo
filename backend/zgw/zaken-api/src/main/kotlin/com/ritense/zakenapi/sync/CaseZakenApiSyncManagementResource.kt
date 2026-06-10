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

package com.ritense.zakenapi.sync

import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@SkipComponentScan
@RequestMapping("/api/management", produces = [APPLICATION_JSON_UTF8_VALUE])
class CaseZakenApiSyncManagementResource(
    private val caseZakenApiSyncManagementService: CaseZakenApiSyncManagementService,
) {

    @RunWithoutAuthorization
    @GetMapping("/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/zaken-api-sync")
    fun getSyncConfiguration(
        @PathVariable("caseDefinitionKey") caseDefinitionKey: String,
        @PathVariable("caseDefinitionVersionTag") caseDefinitionVersionTag: String,
    ): ResponseEntity<CaseZakenApiSyncResponse?> {
        val caseDefinitionId = CaseDefinitionId(caseDefinitionKey, caseDefinitionVersionTag)
        val sync = caseZakenApiSyncManagementService.getSyncConfiguration(caseDefinitionId)
            ?: return ResponseEntity.ok(null)
        return ResponseEntity.ok(CaseZakenApiSyncResponse.of(sync))
    }

    @RunWithoutAuthorization
    @PutMapping("/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/zaken-api-sync")
    fun createOrUpdateSyncConfiguration(
        @PathVariable("caseDefinitionKey") caseDefinitionKey: String,
        @PathVariable("caseDefinitionVersionTag") caseDefinitionVersionTag: String,
        @Valid @RequestBody syncRequest: CaseZakenApiSyncRequest,
    ): ResponseEntity<Unit> {
        val caseDefinitionId = CaseDefinitionId(caseDefinitionKey, caseDefinitionVersionTag)
        caseZakenApiSyncManagementService.saveSyncConfiguration(syncRequest.toEntity(caseDefinitionId))
        return ResponseEntity.ok().build()
    }

    @RunWithoutAuthorization
    @DeleteMapping("/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/zaken-api-sync")
    fun deleteSyncConfiguration(
        @PathVariable("caseDefinitionKey") caseDefinitionKey: String,
        @PathVariable("caseDefinitionVersionTag") caseDefinitionVersionTag: String,
    ): ResponseEntity<Unit> {
        val caseDefinitionId = CaseDefinitionId(caseDefinitionKey, caseDefinitionVersionTag)
        caseZakenApiSyncManagementService.deleteSyncConfigurationByCaseDefinition(caseDefinitionId)
        return ResponseEntity.ok().build()
    }
}
