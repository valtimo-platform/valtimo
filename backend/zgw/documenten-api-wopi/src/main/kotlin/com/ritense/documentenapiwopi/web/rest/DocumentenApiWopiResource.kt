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

package com.ritense.documentenapiwopi.web.rest

import com.ritense.documentenapiwopi.service.DocumentenApiWopiService
import com.ritense.documentenapiwopi.web.rest.dto.WopiHostPageResponse
import com.ritense.logging.LoggableResource
import com.ritense.plugin.domain.PluginConfiguration
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@SkipComponentScan
@RequestMapping("/api", produces = [APPLICATION_JSON_UTF8_VALUE])
class DocumentenApiWopiResource(
    private val documentenApiWopiService: DocumentenApiWopiService
) {
    @GetMapping("/v1/documenten-api-wopi/configuration-exists/{documentenApiConfigurationId}")
    fun isWopiConfigured(
        @PathVariable documentenApiConfigurationId: String,
    ): ResponseEntity<Boolean> {
        return ResponseEntity.ok(
            documentenApiWopiService.isWopiConfigured(documentenApiConfigurationId)
        )
    }

    @GetMapping("/v1/documenten-api-wopi/{documentenApiConfigurationId}/case-document/{caseDocumentId}/wopi-host-page/{documentId}")
    fun getWopiHostPage(
        @PathVariable @LoggableResource(resourceType = PluginConfiguration::class) documentenApiConfigurationId: String,
        @PathVariable caseDocumentId: UUID,
        @PathVariable documentId: String,
    ): ResponseEntity<WopiHostPageResponse> {
        // the browser must navigate to this URL directly rather than us fetching and relaying its HTML,
        // so that markup returned by the WOPI host renders under its own origin, not ours
        val wopiHostPageUrl = documentenApiWopiService.getWopiHostPageUrl(documentenApiConfigurationId, documentId, caseDocumentId)

        return ResponseEntity.ok(WopiHostPageResponse(wopiHostPageUrl.toString()))
    }
}